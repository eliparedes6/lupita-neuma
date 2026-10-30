// api/auth/session.js
// Vercel Function — verifica sesión
// Cualquier cuenta @neuma.mx tiene acceso total automáticamente

import { verifyToken } from "../_lib/auth.js";

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
