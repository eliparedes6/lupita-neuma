// api/drive-doc.js
// Vercel Function — proxy autenticado hacia el Web App de Apps Script (doPost) que crea el Google Doc.
// La URL vive solo en el servidor (APPS_SCRIPT_URL), nunca en el bundle del cliente.

import { getSession } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "no_session" });

  const webhookUrl = process.env.APPS_SCRIPT_URL;
  if (!webhookUrl) return res.status(500).json({ error: "webhook_not_configured" });

  const { clientId, clientName, title, content, tipo, fecha, folderId } = req.body || {};
  if (!clientId || !title || !content) {
    return res.status(400).json({ error: "missing_fields" });
  }
  if (!folderId) {
    return res.status(400).json({ error: "missing_folder_id" });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "createDoc", clientId, clientName, title, content, tipo, fecha, folderId, token: process.env.APPS_SCRIPT_TOKEN }),
    });

    if (!response.ok) return res.status(502).json({ error: "webhook_failed" });

    // El Web App de Apps Script siempre responde HTTP 200; los errores de
    // aplicación (validación, excepciones dentro de doPost) vienen en el JSON.
    const data = await response.json();
    if (data.error || !data.docId) return res.status(502).json({ error: data.error || "no_doc_id" });
    return res.status(200).json({ docId: data.docId });
  } catch (err) {
    console.error("drive-doc error:", err);
    return res.status(502).json({ error: "webhook_unreachable" });
  }
}
