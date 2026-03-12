// api/auth/logout.js
// Vercel Function — cierra sesión

export default async function handler(req, res) {
  res.setHeader("Set-Cookie", "lupita_session=; Path=/; Max-Age=0; HttpOnly; Secure");
  return res.redirect("/");
}
