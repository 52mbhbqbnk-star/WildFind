export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { messages } = req.body;
    const imagePart = messages[0].content[0];
    const textPart = messages[0].content[1];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: imagePart.source.media_type, data: imagePart.source.data } },
              { text: textPart.text + " Your entire response must be only a valid JSON object, nothing else." }
            ]
          }],
          generationConfig: { temperature: 0.1 }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const s = stripped.indexOf("{"), e = stripped.lastIndexOf("}");
    const json = s !== -1 && e !== -1 ? stripped.slice(s, e + 1) : "{}";
    const parsed = JSON.parse(json);
    res.status(200).json({ content: [{ text: JSON.stringify(parsed) }] });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}
