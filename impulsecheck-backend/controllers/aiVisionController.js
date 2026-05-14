async function scanProduct(req, res) {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No image provided.' });

    const prompt = `You are an AI spending intervention assistant for students. Analyze this product image and return ONLY a valid JSON object with no markdown, no explanation, no extra text — just the raw JSON.
{
  "productName": "best guess of the product name",
  "brand": "brand name or null if unknown",
  "category": "one of: Electronics, Clothing, Food, Beauty, Home, Entertainment, Sports, Education, Other",
  "estimatedPriceRange": { "min": number, "max": number },
  "needVsWant": "Need or Want or Uncertain",
  "impulseRiskScore": number between 0 and 100,
  "impulseRiskLabel": "Low or Moderate or High or Very High",
  "impulseRiskReason": "one sentence explaining the risk level",
  "alternatives": ["alternative 1", "alternative 2"],
  "interventionMessage": "a short empathetic message to help the student pause before buying"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } }
            ]
          }]
        })
      }
    );

    const json = await response.json();
    if (!response.ok) throw new Error(json.error?.message || 'Gemini API error');

    const raw     = json.candidates[0].content.parts[0].text.trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed  = JSON.parse(cleaned);
    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    console.error('[aiVisionController] scanProduct error:', err.message);
    if (err instanceof SyntaxError) return res.status(422).json({ error: 'AI returned unexpected format. Please try again.' });
    return res.status(500).json({ error: 'Image analysis failed. Please try again.' });
  }
}

module.exports = { scanProduct };