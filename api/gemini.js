// api/gemini.js
// Vercel Function — proxy autenticado hacia la API de Gemini. La key vive solo en el
// servidor (GEMINI_API_KEY), nunca en el bundle del cliente.

import { getSession } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "no_session" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "gemini_not_configured" });

  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: "missing_query" });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Eres un asistente de investigación para una agencia de relaciones públicas en México. Busca y resume las noticias más recientes sobre: ${query}. Responde en español con TENDENCIAS DEL SECTOR y OPORTUNIDADES DE PR. Máximo 300 palabras.` }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.3 },
        }),
      }
    );

    if (response.status === 429) return res.status(200).json({ text: null });
    if (!response.ok) return res.status(502).json({ error: "gemini_failed" });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    return res.status(200).json({ text });
  } catch (err) {
    console.error("gemini error:", err);
    return res.status(502).json({ error: "gemini_unreachable" });
  }
}
