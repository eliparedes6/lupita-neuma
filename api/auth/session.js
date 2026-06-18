// api/auth/session.js
// Vercel Function — verifica sesión
// Cualquier cuenta @neuma.mx tiene acceso total automáticamente

import { createHmac, timingSafeEqual } from "crypto";

function verifyToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no configurado");

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payload = token.slice(0, dotIndex);
  const receivedSig = token.slice(dotIndex + 1);
  const expectedSig = createHmac("sha256", secret).update(payload).digest("hex");

  // Comparación en tiempo constante para evitar timing attacks
  const a = Buffer.from(receivedSig, "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
}

export default async function handler(req, res) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/lupita_session=([^;]+)/);

  if (!match) {
    return res.status(401).json({ error: "no_session" });
  }

  try {
    const sessionData = verifyToken(match[1]);
    if (!sessionData) {
      return res.status(401).json({ error: "invalid_session" });
    }

    // Verificar expiración
    if (Date.now() > sessionData.exp) {
      res.setHeader("Set-Cookie", "lupita_session=; Path=/; Max-Age=0");
      return res.status(401).json({ error: "session_expired" });
    }

    // Verificar dominio @neuma.mx — acceso total automático
    if (!sessionData.email || !sessionData.email.endsWith("@neuma.mx")) {
      return res.status(403).json({ error: "user_not_authorized" });
    }

    return res.status(200).json({
      email: sessionData.email,
      name: sessionData.name,
      picture: sessionData.picture,
      role: "directora",
      clients: ["*"],
    });

  } catch {
    return res.status(401).json({ error: "invalid_session" });
  }
}
