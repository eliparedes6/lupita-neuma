// api/inbox.js
// Vercel Function — proxy autenticado hacia el Web App de Apps Script (doPost) para leer
// el monitoreo de Lupita BD (privada). La URL vive solo en el servidor, nunca en el bundle del cliente.

import { getSession } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "no_session" });

  const webhookUrl = process.env.APPS_SCRIPT_URL;
  if (!webhookUrl) return res.status(500).json({ error: "webhook_not_configured" });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getInbox", token: process.env.APPS_SCRIPT_TOKEN }),
    });

    if (!response.ok) {
      console.error("inbox: webhook_failed, status=" + response.status);
      return res.status(502).json({ error: "webhook_failed", debugStatus: response.status });
    }

    const data = await response.json();
    if (data.error) {
      console.error("inbox: apps script error:", data.error);
      return res.status(502).json({ error: data.error });
    }
    return res.status(200).json({ rows: data.rows || [] });
  } catch (err) {
    console.error("inbox error:", err);
    return res.status(502).json({ error: "webhook_unreachable" });
  }
}
