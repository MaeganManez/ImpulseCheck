const db                  = require('../config/db');
const { sendReportEmail } = require('../config/mailer');

async function sendReport(req, res) {
  try {
    const userId = req.user.id;
    const period = req.body.period || 'monthly';

    // ── Get user info ──
    const userResult = await db.query(
      'SELECT full_name, email, currency FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const user = userResult.rows[0];

    // ── Date range — PostgreSQL syntax ──
    let dateFilter;
    if (period === 'weekly') {
      dateFilter = `AND created_at >= NOW() - INTERVAL '7 days'`;
    } else {
      dateFilter = `AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
                    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())`;
    }

    // ── Get purchases for period ──
    const purchasesResult = await db.query(
      `SELECT item_name, price, category, user_decision, created_at
       FROM purchases
       WHERE user_id = $1 ${dateFilter}
       ORDER BY created_at DESC`,
      [userId]
    );
    const purchases = purchasesResult.rows;

    // ── Compute stats ──
    const totalSpent      = purchases.reduce((s, p) => s + parseFloat(p.price), 0);
    const impulsive       = purchases.filter(p => p.user_decision === 'AVOID' || p.user_decision === 'WAIT');
    const impulsiveCount  = impulsive.length;
    const impulsiveAmount = impulsive.reduce((s, p) => s + parseFloat(p.price), 0);
    const savedAmount     = purchases
      .filter(p => p.user_decision === 'AVOID')
      .reduce((s, p) => s + parseFloat(p.price), 0);

    const reportData = {
      totalSpent,
      impulsiveCount,
      impulsiveAmount,
      savedAmount,
      purchases,
      currency: user.currency,
    };

    // ── Send email ──
    await sendReportEmail(user.email, user.full_name, reportData, period);

    return res.status(200).json({
      message: `${period.charAt(0).toUpperCase() + period.slice(1)} report sent to ${user.email}`,
    });

  } catch (err) {
    console.error('SendReport error:', err);
    return res.status(500).json({ error: 'Failed to send report. Please try again.' });
  }
}

module.exports = { sendReport };