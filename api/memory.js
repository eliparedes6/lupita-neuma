// api/memory.js
// Vercel Function — proxy autenticado hacia el Web App de Apps Script (doPost) de PR Memory.
// La URL vive solo en el servidor (APPS_SCRIPT_URL), nunca en el bundle del cliente.

import { getSession } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "no_session" });

  const webhookUrl = process.env.APPS_SCRIPT_URL;
  if (!webhookUrl) return res.status(500).json({ error: "webhook_not_configured" });

  const { sheet, row } = req.body || {};
  if (!sheet || !row) return res.status(400).json({ error: "missing_fields" });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveMemory", sheet, row, token: process.env.APPS_SCRIPT_TOKEN }),
    });

    if (!response.ok) return res.status(502).json({ error: "webhook_failed" });

    // El Web App de Apps Script siempre responde HTTP 200; los errores de
    // aplicación (validación, excepciones dentro de doPost) vienen en el JSON.
    const data = await response.json();
    if (data.error || !data.ok) return res.status(502).json({ error: data.error || "save_failed" });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("memory error:", err);
    return res.status(502).json({ error: "webhook_unreachable" });
  }
}
