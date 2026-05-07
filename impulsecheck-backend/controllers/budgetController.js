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
      'SELECT id FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
      [userId, month, year]
    );

    let budgetId;

    if (existing.length > 0) {
      // UPDATE existing budget
      budgetId = existing[0].id;
      await db.query(
        'UPDATE budgets SET amount = ?, period = ? WHERE id = ?',
        [amount, period || 'monthly', budgetId]
      );
      // Delete old categories
      await db.query('DELETE FROM budget_categories WHERE budget_id = ?', [budgetId]);
    } else {
      // INSERT new budget
      const [result] = await db.query(
        'INSERT INTO budgets (user_id, amount, period, month, year) VALUES (?, ?, ?, ?, ?)',
        [userId, amount, period || 'monthly', month, year]
      );
      budgetId = result.insertId;
    }

    // Insert new categories
    const catValues = categories.map(cat => [budgetId, cat]);
    await db.query(
      'INSERT INTO budget_categories (budget_id, category_name) VALUES ?',
      [catValues]
    );

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
              GROUP_CONCAT(bc.category_name) AS categories
       FROM budgets b
       LEFT JOIN budget_categories bc ON bc.budget_id = b.id
       WHERE b.user_id = ? AND b.month = ? AND b.year = ?
       GROUP BY b.id`,
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
