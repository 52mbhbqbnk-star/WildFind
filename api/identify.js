export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { model, messages } = req.body;
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
              { text: textPart.text }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ content: [{ text }] });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
