// api/_lib/auth.js
// Verificación de sesión compartida entre Vercel Functions

import { createHmac, timingSafeEqual } from "crypto";

export function verifyToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no configurado");

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payload = token.slice(0, dotIndex);
  const receivedSig = token.slice(dotIndex + 1);
  const expectedSig = createHmac("sha256", secret).update(payload).digest("hex");

  const a = Buffer.from(receivedSig, "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
}

// Devuelve la sesión válida o null. No escribe la respuesta;
// cada handler decide cómo responder ante una sesión inválida.
export function getSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/lupita_session=([^;]+)/);
  if (!match) return null;

  try {
    const sessionData = verifyToken(match[1]);
    if (!sessionData) return null;
    if (Date.now() > sessionData.exp) return null;
    if (!sessionData.email || !sessionData.email.endsWith("@neuma.mx")) return null;
    return sessionData;
  } catch {
    return null;
  }
}
