const db = require('../config/db');
require('dotenv').config();

async function analyzePurchase(req, res) {
  try {
    const { item_name, price, category, reason, emotion } = req.body;
    const userId = req.user.id;

    if (!item_name || !price) {
      return res.status(400).json({ error: 'Item name and price are required.' });
    }

    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    const [budgetRows] = await db.query(
      `SELECT b.amount,
              COALESCE(SUM(p.price), 0) AS spent
       FROM budgets b
       LEFT JOIN purchases p
         ON p.user_id = b.user_id
         AND MONTH(p.created_at) = b.month
         AND YEAR(p.created_at)  = b.year
       WHERE b.user_id = ? AND b.month = ? AND b.year = ?
       GROUP BY b.id`,
      [userId, month, year]
    );

    const budget    = budgetRows.length > 0 ? parseFloat(budgetRows[0].amount) : 0;
    const spent     = budgetRows.length > 0 ? parseFloat(budgetRows[0].spent)  : 0;
    const remaining = Math.max(0, budget - spent);

    const [recentRows] = await db.query(
      `SELECT item_name, price, category, user_decision
       FROM purchases
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    );

    const [userRow] = await db.query(
      'SELECT currency FROM users WHERE id = ?', [userId]
    );
    const currency = userRow[0]?.currency || 'PHP';

    const recentSummary = recentRows.length > 0
      ? recentRows.map(r =>
          `${r.item_name} (${r.category}) - ${r.price} ${currency} - ${r.user_decision}`
        ).join('\n')
      : 'No recent purchases';

    const prompt = `You are ImpulseCheck, a caring and practical AI spending coach that helps users make smarter financial decisions.

A user wants to make a purchase. Analyze it deeply and give a warm, personalized recommendation.

PURCHASE DETAILS:
- Item: ${item_name}
- Price: ${price} ${currency}
- Category: ${category || 'Not specified'}
- Reason for buying: ${reason || 'Not specified'}
- Current emotion: ${emotion || 'Not specified'}

USER'S FINANCIAL CONTEXT:
- Monthly budget: ${budget} ${currency}
- Total spent this month: ${spent} ${currency}
- Remaining budget: ${remaining} ${currency}
- Recent purchases:
${recentSummary}

TASK:
Based on the purchase details and financial context, decide one of:
- BUY — reasonable, within budget, genuinely needed or well-justified
- WAIT — borderline, consider waiting 24-48 hours before deciding
- AVOID — impulsive, over budget, emotionally driven, or unnecessary

Respond ONLY in this exact JSON format with no extra text or markdown:
{
  "tag": "BUY" or "WAIT" or "AVOID",
  "title": "short decision title in caps (e.g. GREAT CHOICE! or THINK IT OVER or AVOID THIS ONE)",
  "subtitle": "one warm, friendly sentence explaining the decision",
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "advice": "2-3 sentences of personalized advice. Be warm and specific — mention the item, price, emotion if relevant. Give a concrete suggestion.",
  "alternative": "One specific, actionable alternative they can do instead (e.g. wait for a sale, buy a cheaper version, use what they have, save toward it)"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 700 }
      })
    });

    if (!geminiResponse.ok) {
      const errData = await geminiResponse.json();
      throw new Error(errData.error?.message || 'Gemini API request failed');
    }

    const geminiData = await geminiResponse.json();
    const rawText    = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawText) throw new Error('Empty response from Gemini');

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI returned invalid response format');

    const recommendation = JSON.parse(jsonMatch[0]);

    if (!['BUY', 'WAIT', 'AVOID'].includes(recommendation.tag)) {
      throw new Error('Invalid tag from AI');
    }

    console.log(`✅ Gemini recommendation for "${item_name}": ${recommendation.tag}`);
    return res.status(200).json({ recommendation });

  } catch (err) {
    console.error('AI analyze error:', err.message);
    const { item_name, price, emotion, reason } = req.body;
    const fallback = getRuleBasedRecommendation(item_name, price, emotion, reason);
    return res.status(200).json({ recommendation: fallback, fallback: true });
  }
}

function getRuleBasedRecommendation(item_name, price, emotion, reason) {
  const lower = (item_name || '').toLowerCase();

  if (emotion === 'stressed' || emotion === 'sad' || emotion === 'bored') {
    return {
      tag:         'WAIT',
      title:       'THINK IT OVER FIRST',
      subtitle:    'Your current emotional state may be influencing this decision.',
      reasons:     ['Emotional spending often leads to regret', 'Consider waiting 24 hours before deciding', 'Ask yourself: do I need this or just want it right now?'],
      advice:      'When we feel stressed or sad, shopping can feel like a quick fix — but the feeling fades and the expense stays. Give yourself a day before deciding.',
      alternative: 'Write down why you want it. If you still feel the same tomorrow, reconsider then.',
    };
  }

  if (reason === 'impulse' || lower.includes('shoe') || lower.includes('bag') || lower.includes('gadget')) {
    return {
      tag:         'AVOID',
      title:       'AVOID THIS ONE',
      subtitle:    'This purchase shows signs of impulsive buying.',
      reasons:     ['This appears to be an unplanned purchase', 'Similar items may already be owned', 'Does not align with intentional spending'],
      advice:      'Impulse purchases feel exciting in the moment but often end up unused. Before buying, ask yourself when you will actually use this and if you already own something similar.',
      alternative: 'Add it to a wishlist and revisit in 2 weeks. If it still matters, save up for it intentionally.',
    };
  }

  return {
    tag:         'BUY',
    title:       'LOOKS GOOD TO BUY',
    subtitle:    'This appears to be a reasonable and intentional purchase.',
    reasons:     ['No major red flags detected', 'Seems like an intentional purchase', 'Within reasonable spending behavior'],
    advice:      'This purchase seems well thought out. Just make sure it fits within your monthly budget before going ahead.',
    alternative: 'Check if there is a discount or better deal available before purchasing.',
  };
}

module.exports = { analyzePurchase };
