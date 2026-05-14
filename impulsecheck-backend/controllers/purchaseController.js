const db = require('../config/db');

/* ════════════════════════════════════════
   POST /api/purchases
   Save a purchase decision
════════════════════════════════════════ */
async function savePurchase(req, res) {
  try {
    const {
      item_name, price, category,
      reason, emotion,
      ai_tag, ai_title, ai_subtitle, ai_reasons,
      user_decision,
    } = req.body;

    const userId = req.user.id;

    if (!item_name || !price || !user_decision) {
      return res.status(400).json({ error: 'item_name, price, and user_decision are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO purchases
        (user_id, item_name, price, category, reason, emotion,
         ai_tag, ai_title, ai_subtitle, ai_reasons, user_decision)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        userId, item_name, price, category || 'Others',
        reason || null, emotion || null,
        ai_tag || user_decision,
        ai_title || null,
        ai_subtitle || null,
        ai_reasons ? JSON.stringify(ai_reasons) : null,
        user_decision,
      ]
    );

    const purchaseId = result[0]?.id;

    // ── Notifications based on decision ──
    try {
      const sym = '₱';
      const amt = parseFloat(price).toLocaleString();

      let notifTitle, notifMsg, notifType;

      if (user_decision === 'AVOID') {
        notifTitle = '🚫 Purchase Avoided!';
        notifMsg   = `Great choice! You saved ${sym}${amt} by skipping "${item_name}".`;
        notifType  = 'avoid';
      } else if (user_decision === 'WAIT') {
        notifTitle = '⏳ Purchase Delayed!';
        notifMsg   = `Good thinking! You delayed buying "${item_name}" for ${sym}${amt}.`;
        notifType  = 'wait';
      } else if (user_decision === 'BUY') {
        notifTitle = '✅ Purchase Recorded!';
        notifMsg   = `"${item_name}" for ${sym}${amt} has been added to your history.`;
        notifType  = 'buy';
      }

      if (notifTitle) {
        await db.query(
          `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
          [userId, notifTitle, notifMsg, notifType]
        );
      }

      // ── Low budget warning ──
      const now   = new Date();
      const month = now.getMonth() + 1;
      const year  = now.getFullYear();

      const [budgetRows] = await db.query(
        `SELECT b.amount,
                COALESCE(SUM(p.price), 0) AS spent
         FROM budgets b
         LEFT JOIN purchases p
           ON p.user_id = b.user_id
          AND EXTRACT(MONTH FROM p.created_at) = $2
          AND EXTRACT(YEAR  FROM p.created_at) = $3
         WHERE b.user_id = $1 AND b.month = $2 AND b.year = $3
         GROUP BY b.amount`,
        [userId, month, year]
      );

      if (budgetRows.length > 0) {
        const budget    = parseFloat(budgetRows[0].amount);
        const spent     = parseFloat(budgetRows[0].spent);
        const remaining = budget - spent;
        const pct       = remaining / budget;

        if (pct <= 0) {
          await db.query(
            `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
            [userId, '⚠️ Budget Exceeded!', `You've gone over your monthly budget of ${sym}${budget.toLocaleString()}.`, 'budget']
          );
        } else if (pct <= 0.2) {
          await db.query(
            `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
            [userId, '⚠️ Low Budget Warning!', `Only ${sym}${remaining.toLocaleString()} remaining from your ${sym}${budget.toLocaleString()} budget.`, 'budget']
          );
        }
      }
    } catch (notifErr) {
      console.warn('Notification error (non-fatal):', notifErr.message);
    }

    return res.status(201).json({
      message:    'Purchase saved.',
      purchaseId,
    });

  } catch (err) {
    console.error('SavePurchase error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

/* ════════════════════════════════════════
   GET /api/purchases
   Get all purchases for current user
════════════════════════════════════════ */
async function getPurchases(req, res) {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `SELECT id, item_name, price, category, reason, emotion,
              ai_tag, ai_title, ai_subtitle, ai_reasons,
              user_decision, created_at
       FROM purchases
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const purchases = rows.map(p => ({
      ...p,
      ai_reasons: p.ai_reasons
        ? (typeof p.ai_reasons === 'string' ? JSON.parse(p.ai_reasons) : p.ai_reasons)
        : [],
    }));

    return res.status(200).json({ purchases });

  } catch (err) {
    console.error('GetPurchases error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

/* ════════════════════════════════════════
   DELETE /api/purchases/:id
════════════════════════════════════════ */
async function deletePurchase(req, res) {
  try {
    const userId     = req.user.id;
    const purchaseId = req.params.id;

    const [rows] = await db.query(
      'SELECT id FROM purchases WHERE id = $1 AND user_id = $2',
      [purchaseId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found.' });
    }

    await db.query('DELETE FROM purchases WHERE id = $1', [purchaseId]);

    return res.status(200).json({ message: 'Purchase deleted.' });

  } catch (err) {
    console.error('DeletePurchase error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

/* ════════════════════════════════════════
   DELETE /api/purchases
   Clear ALL purchases for current user
════════════════════════════════════════ */
async function clearAllPurchases(req, res) {
  try {
    const userId = req.user.id;
    await db.query('DELETE FROM purchases WHERE user_id = $1', [userId]);
    return res.status(200).json({ message: 'All purchases cleared.' });
  } catch (err) {
    console.error('ClearAll error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

/* ════════════════════════════════════════
   GET /api/purchases/report
   Summary stats for spending report
════════════════════════════════════════ */
async function getReport(req, res) {
  try {
    const userId = req.user.id;
    const now    = new Date();
    const month  = now.getMonth() + 1;
    const year   = now.getFullYear();

    const [rows] = await db.query(
      `SELECT
         COUNT(*) AS total_count,
         COALESCE(SUM(price), 0) AS total_spent,
         COALESCE(SUM(CASE WHEN user_decision IN ('AVOID','WAIT') THEN price ELSE 0 END), 0) AS impulsive_amount,
         COUNT(CASE WHEN user_decision IN ('AVOID','WAIT') THEN 1 END) AS impulsive_count,
         COALESCE(SUM(CASE WHEN user_decision = 'AVOID' THEN price ELSE 0 END), 0) AS saved_amount
       FROM purchases
       WHERE user_id = $1
         AND EXTRACT(MONTH FROM created_at) = $2
         AND EXTRACT(YEAR  FROM created_at) = $3`,
      [userId, month, year]
    );

    return res.status(200).json({ report: rows[0] });

  } catch (err) {
    console.error('GetReport error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

module.exports = {
  savePurchase, getPurchases,
  deletePurchase, clearAllPurchases,
  getReport,
};
