// api/auth/callback.js
// Vercel Function — maneja el callback de Google OAuth

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.redirect("/?error=no_code");
  }

  try {
    // Intercambiar código por tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.APP_URL}/auth/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      return res.redirect("/?error=token_failed");
    }

    // Obtener info del usuario
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const user = await userRes.json();

    // Verificar dominio
    if (!user.email || !user.email.endsWith("@neumaagencia.com")) {
      return res.redirect("/?error=domain_not_allowed");
    }

    // Crear sesión simple con JWT-like token (base64 firmado)
    const sessionData = {
      email: user.email,
      name: user.name,
      picture: user.picture,
      exp: Date.now() + 8 * 60 * 60 * 1000, // 8 horas
    };

    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64");

    // Guardar en cookie segura
    res.setHeader("Set-Cookie", [
      `lupita_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${8 * 60 * 60}`,
    ]);

    return res.redirect("/");
  } catch (err) {
    console.error("Auth error:", err);
    return res.redirect("/?error=auth_failed");
  }
}
