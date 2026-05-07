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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    return res.status(201).json({
      message:    'Purchase saved.',
      purchaseId: result.insertId,
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
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    // Parse ai_reasons JSON
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

    // Make sure it belongs to this user
    const [rows] = await db.query(
      'SELECT id FROM purchases WHERE id = ? AND user_id = ?',
      [purchaseId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found.' });
    }

    await db.query('DELETE FROM purchases WHERE id = ?', [purchaseId]);

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
    await db.query('DELETE FROM purchases WHERE user_id = ?', [userId]);
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
         COUNT(CASE  WHEN user_decision IN ('AVOID','WAIT') THEN 1 END) AS impulsive_count,
         COALESCE(SUM(CASE WHEN user_decision = 'AVOID' THEN price ELSE 0 END), 0) AS saved_amount
       FROM purchases
       WHERE user_id = ?
         AND MONTH(created_at) = ?
         AND YEAR(created_at)  = ?`,
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
