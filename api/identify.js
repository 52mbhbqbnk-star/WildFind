export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { messages } = req.body;
    const imagePart = messages[0].content[0];
    const textPart = messages[0].content[1];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: imagePart.source.media_type, data: imagePart.source.data } },
              { text: `You are a wildlife expert. Identify what is in this photo. Respond ONLY with this exact JSON structure, no markdown, no extra text:
{"name":"common name here","scientificName":"scientific name here","category":"Bird or Mammal or Reptile or Amphibian or Fish or Insect or Plant or Fungus or Marine or Other","description":"2-3 sentences about this species","conservationStatus":"Least Concern or Vulnerable or Endangered or Unknown","confidence":"High or Medium or Low"}` }
            ]
          }],
          generationConfig: { temperature: 0.1 }
        })
      }
    );

    const data = await response.json();

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return res.status(200).json({ error: { message: "Gemini raw: " + JSON.stringify(data).slice(0, 300) } });
    }

    const text = data.candidates[0].content.parts[0].text;
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    if (s === -1 || e === -1) throw new Error("No JSON in: " + text.slice(0, 200));
    const parsed = JSON.parse(text.slice(s, e + 1));
    res.status(200).json({ content: [{ text: JSON.stringify(parsed) }] });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}
