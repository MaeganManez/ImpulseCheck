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

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      })
    });

    const json = await response.json();
    if (!response.ok) throw new Error(json.error?.message || 'Groq API error');

    const raw     = json.choices[0].message.content.trim();
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