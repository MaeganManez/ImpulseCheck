const db = require('../config/db');

/* ════════════════════════════════════════
   POST /api/budget
   Save or update budget for current month
════════════════════════════════════════ */
async function saveBudget(req, res) {
  try {
    const { amount, period, categories } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid budget amount.' });
    }
    if (!categories || categories.length === 0) {
      return res.status(400).json({ error: 'Please select at least one category.' });
    }

    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    // Check if budget already exists for this month/year
    const [existing] = await db.query(
      'SELECT id FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3',
      [userId, month, year]
    );

    let budgetId;

    if (existing.length > 0) {
      // UPDATE existing budget
      budgetId = existing[0].id;
      await db.query(
        'UPDATE budgets SET amount = $1, period = $2 WHERE id = $3',
        [amount, period || 'monthly', budgetId]
      );
      await db.query('DELETE FROM budget_categories WHERE budget_id = $1', [budgetId]);
    } else {
      // INSERT new budget
      const [result] = await db.query(
        'INSERT INTO budgets (user_id, amount, period, month, year) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [userId, amount, period || 'monthly', month, year]
      );
      budgetId = result[0].id;
    }

    // Insert categories one by one (PostgreSQL doesn't support VALUES ?)
    for (const cat of categories) {
      await db.query(
        'INSERT INTO budget_categories (budget_id, category_name) VALUES ($1, $2)',
        [budgetId, cat]
      );
    }

    // ── Budget set notification ──
    try {
      const sym = '₱';
      const amt = parseFloat(amount).toLocaleString();
      const isUpdate = existing.length > 0;
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
        [
          userId,
          isUpdate ? '💰 Budget Updated!' : '💰 Budget Set!',
          `Your monthly budget has been ${isUpdate ? 'updated' : 'set'} to ${sym}${amt}.`,
          'budget',
        ]
      );
    } catch (notifErr) {
      console.warn('Notification error (non-fatal):', notifErr.message);
    }

    return res.status(200).json({
      message: 'Budget saved successfully.',
      budget: { id: budgetId, amount, period, categories, month, year },
    });

  } catch (err) {
    console.error('SaveBudget error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

/* ════════════════════════════════════════
   GET /api/budget
   Get current month's budget
════════════════════════════════════════ */
async function getBudget(req, res) {
  try {
    const userId = req.user.id;
    const now    = new Date();
    const month  = now.getMonth() + 1;
    const year   = now.getFullYear();

    const [rows] = await db.query(
      `SELECT b.id, b.amount, b.period, b.month, b.year,
              STRING_AGG(bc.category_name, ',') AS categories
       FROM budgets b
       LEFT JOIN budget_categories bc ON bc.budget_id = b.id
       WHERE b.user_id = $1 AND b.month = $2 AND b.year = $3
       GROUP BY b.id, b.amount, b.period, b.month, b.year`,
      [userId, month, year]
    );

    if (rows.length === 0) {
      return res.status(200).json({ budget: null });
    }

    const budget = rows[0];
    budget.categories = budget.categories ? budget.categories.split(',') : [];

    return res.status(200).json({ budget });

  } catch (err) {
    console.error('GetBudget error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

module.exports = { saveBudget, getBudget };
