import { useState, useRef, useEffect } from "react";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const ALL_CLIENTS = [
  { id: "pfizer", name: "Pfizer México", industry: "Farmacéutica", color: "#4A90D9", initials: "PF", folderId: "1Z0iOscR22coaCxWLHNlGFMFUb6GLES69" },
  { id: "prudence", name: "Condones Prudence", industry: "Salud Sexual", color: "#D62B7C", initials: "PR", folderId: "1VJyRHA5VHyb9Ea6-kK9Iob0ZzQpsiWu0" },
  { id: "soriana", name: "Organización Soriana", industry: "Retail", color: "#C8102E", initials: "SO", folderId: "1ExtUJGposXvT0tXZTyyWg_jfkRejQw2e" },
];

const ACTIONS = [
  { id: "comunicado", icon: "📋", label: "Comunicado de prensa", color: "#4ADE80", prompt: (c) => `Necesito redactar un comunicado de prensa para ${c.name}. Con base en los archivos que tienes del cliente, ¿qué información adicional necesitas para generarlo?` },
  { id: "pitch", icon: "🎯", label: "Pitch para periodista", color: "#60A5FA", prompt: (c) => `Necesito un pitch para un periodista sobre ${c.name}. Usa el contexto que tienes del cliente para personalizarlo.` },
  { id: "posts", icon: "📱", label: "Posts redes sociales", color: "#F472B6", prompt: (c) => `Quiero crear posts para redes sociales de ${c.name}. Usa el tono y mensajes clave del cliente.` },
  { id: "talking", icon: "🎤", label: "Talking points vocero", color: "#FBBF24", prompt: (c) => `Necesito preparar talking points para el vocero de ${c.name}. Usa el contexto del cliente para personalizar.` },
  { id: "crisis", icon: "⚠️", label: "Crisis statement", color: "#FB923C", prompt: (c) => `Necesito un crisis statement para ${c.name}. ¿Cuáles son los detalles de la situación?` },
];

const MOCK_REPORT = {
  fecha: new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
  hora: "08:00 AM",
  resumenGeneral: "Día sin alertas críticas. Soriana tiene actividad alta por promociones de fin de semana. Pfizer con cobertura positiva por estudio clínico. Prudence sin menciones relevantes.",
  clientes: [
    { id: "pfizer", name: "Pfizer México", color: "#4A90D9", initials: "PF", alerta: false, sentimiento: "positivo", menciones: 12, mencionesAyer: 8, prensa: [{ titulo: "Pfizer presenta resultados positivos en estudio de oncología de precisión", medio: "El Universal", sentimiento: "positivo" }, { titulo: "Farmacéuticas aumentan inversión en I+D en México", medio: "Expansión", sentimiento: "positivo" }], redes: [{ plataforma: "Twitter/X", menciones: 45, sentimiento: "positivo", topPost: "@PfizerMexico anuncia nuevos resultados del ensayo clínico fase 3" }, { plataforma: "LinkedIn", menciones: 12, sentimiento: "positivo", topPost: "Constanza Losada comparte los logros de Pfizer México en Q1 2026" }], resumenLupita: "Cobertura mayoritariamente positiva. El estudio de oncología está generando interés editorial. Recomiendo preparar un pitch de seguimiento para medios especializados." },
    { id: "soriana", name: "Organización Soriana", color: "#C8102E", initials: "SO", alerta: true, alertaTexto: "Comentarios negativos en redes sobre precios de canasta básica", sentimiento: "mixto", menciones: 34, mencionesAyer: 19, prensa: [{ titulo: "Soriana lanza promoción de fin de semana con descuentos en productos básicos", medio: "Milenio", sentimiento: "positivo" }, { titulo: "Supermercados mexicanos bajo presión por inflación en alimentos", medio: "El Financiero", sentimiento: "neutro" }], redes: [{ plataforma: "Twitter/X", menciones: 89, sentimiento: "mixto", topPost: "Varios usuarios comparan precios de canasta básica entre Soriana y Walmart" }, { plataforma: "Facebook", menciones: 56, sentimiento: "negativo", topPost: "Quejas sobre aumento de precios en sucursal Perisur" }], resumenLupita: "⚠️ Atención: hay un pico de menciones negativas relacionadas a precios. No es crisis aún pero puede escalar. Recomiendo preparar un mensaje proactivo." },
    { id: "prudence", name: "Condones Prudence", color: "#D62B7C", initials: "PR", alerta: false, sentimiento: "neutro", menciones: 5, mencionesAyer: 3, prensa: [], redes: [{ plataforma: "Instagram", menciones: 18, sentimiento: "positivo", topPost: "Post de campaña de educación sexual alcanza 2.3k likes" }, { plataforma: "TikTok", menciones: 11, sentimiento: "positivo", topPost: "Video educativo sobre prevención de ITS supera 15k views" }], resumenLupita: "Día tranquilo. El contenido de redes sociales está funcionando bien. Sin menciones en prensa. Buen momento para enviar un pitch proactivo." },
  ],
};

function LoginScreen({ error }) {
  const handleLogin = () => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: `${window.location.origin}/auth/callback`,
      response_type: "code",
      scope: "openid email profile",
      hd: "neuma.mx",
      access_type: "online",
      prompt: "select_account",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const errorMessages = {
    domain_not_allowed: "Solo cuentas @neuma.mx pueden acceder.",
    user_not_authorized: "Tu cuenta no tiene permisos asignados. Contacta a la directora.",
    auth_failed: "Error de autenticación. Intenta de nuevo.",
    session_expired: "Tu sesión expiró. Inicia sesión nuevamente.",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#07090C", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif", padding: 20 }}>
      <style>{`@keyframes lupIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} } button:hover { opacity: 0.92; }`}</style>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center", animation: "lupIn 0.4s ease" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #052e16, #16A34A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 24px" }}>✦</div>
        <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "#1a4a1a", textTransform: "uppercase", marginBottom: 8 }}>Neuma · Agencia de RRPP</p>
        <h1 style={{ fontSize: 32, fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.02em", color: "#F0FDF4" }}>Bienvenida a <em style={{ color: "#4ADE80" }}>Lupita</em></h1>
        <p style={{ color: "#374151", fontSize: 14, margin: "0 0 36px", lineHeight: 1.7 }}>Tu agente de IA para Relaciones Públicas.<br />Inicia sesión con tu cuenta de Neuma.</p>
        {error && errorMessages[error] && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 16px", marginBottom: 20 }}>
            <p style={{ color: "#FCA5A5", fontSize: 13, margin: 0 }}>⚠ {errorMessages[error]}</p>
          </div>
        )}
        <button onClick={handleLogin} style={{ width: "100%", background: "#fff", border: "none", borderRadius: 12, padding: "14px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 15, fontWeight: 600, color: "#1a1a1a", transition: "all 0.2s", boxShadow: "0 2px 16px rgba(74,222,128,0.1)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Iniciar sesión con Google
        </button>
        <p style={{ fontSize: 11, color: "#1a3a1a", marginTop: 20, lineHeight: 1.6 }}>Solo cuentas <strong style={{ color: "#2a5a2a" }}>@neuma.mx</strong> tienen acceso.</p>
      </div>
    </div>
  );
}

function UnauthorizedScreen({ user, onLogout }) {
  return (
    <div style={{ minHeight: "100vh", background: "#07090C", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif", padding: 20 }}>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: "#F0FDF4", fontWeight: 400, marginBottom: 8 }}>Acceso restringido</h2>
        <p style={{ color: "#374151", fontSize: 14, marginBottom: 24 }}>Tu cuenta <strong style={{ color: "#6B7280" }}>{user?.email}</strong> no tiene permisos asignados.<br />Contacta a la directora para que te agregue al sistema.</p>
        <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 13 }}>Cerrar sesión</button>
      </div>
    </div>
  );
}

async function fetchDriveFiles(folderId) {
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.files || [];
}

async function fetchDocContent(file) {
  if (file.mimeType === "application/vnd.google-apps.document") {
    const url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  }
  return null;
}

async function loadClientContext(folderId) {
  const files = await fetchDriveFiles(folderId);
  const results = [];
  for (const file of files) {
    const content = await fetchDocContent(file);
    if (content) results.push({ name: file.name, content: content.slice(0, 8000) });
  }
  return results;
}

function buildSystemPrompt(client, driveFiles) {
  const fileSection = driveFiles.length > 0
    ? `\n\nARCHIVOS DEL CLIENTE EN DRIVE:\n` + driveFiles.map(f => `\n--- ${f.name} ---\n${f.content}`).join("\n")
    : "\n\n(No se encontraron archivos en Drive para este cliente aún.)";
  return `Eres Lupita, agente especializada en Relaciones Públicas para la agencia Neuma.\n\nCLIENTE ACTIVO: ${client.name}\nIndustria: ${client.industry}\n${fileSection}\n\nINSTRUCCIONES:\n- Siempre escribes en español\n- Usas la información de los archivos de Drive como base para todo el contenido\n- Si necesitas información que no está en los archivos, pregunta al equipo\n- Nunca inventas información del cliente\n- Respetas regulaciones sanitarias (COFEPRIS, FDA, EMA) cuando aplica\n- Al final de cada entrega sugieres qué más podría necesitar el equipo`;
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "12px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 14, width: "fit-content", border: "1px solid rgba(255,255,255,0.06)" }}>
      {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", opacity: 0.6, animation: "lupBounce 1.2s infinite", animationDelay: `${i*0.18}s` }} />)}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const fmt = (text) => text.split("\n").map((line, i) => {
    if (line.startsWith("# ")) return <div key={i} style={{ fontSize: 16, fontWeight: 700, color: "#4ADE80", margin: "10px 0 4px" }}>{line.slice(2)}</div>;
    if (line.startsWith("## ")) return <div key={i} style={{ fontSize: 14, fontWeight: 700, color: "#86EFAC", margin: "8px 0 3px" }}>{line.slice(3)}</div>;
    if (line.startsWith("- ") || line.startsWith("• ")) return <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 8, margin: "2px 0" }}><span style={{ color: "#4ADE80", flexShrink: 0 }}>·</span><span style={{ color: "#CBD5E1" }}>{line.slice(2)}</span></div>;
    if (line.match(/^\d+\. /)) return <div key={i} style={{ color: "#CBD5E1", paddingLeft: 8, margin: "2px 0" }}>{line}</div>;
    if (line.startsWith("---")) return <hr key={i} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", margin: "10px 0" }} />;
    if (line === "") return <div key={i} style={{ height: 5 }} />;
    const parts = line.split(/\*\*(.*?)\*\*/g);
    if (parts.length > 1) return <div key={i} style={{ color: "#CBD5E1", margin: "2px 0", lineHeight: 1.65 }}>{parts.map((p,j) => j%2===1 ? <strong key={j} style={{ color: "#E2E8F0" }}>{p}</strong> : p)}</div>;
    return <div key={i} style={{ color: "#CBD5E1", margin: "2px 0", lineHeight: 1.65 }}>{line}</div>;
  });
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14, animation: "lupFadeUp 0.28s ease" }}>
      {!isUser && <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #14532D, #22C55E)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 9, flexShrink: 0, marginTop: 2 }}>✦</div>}
      <div style={{ maxWidth: "75%", padding: isUser ? "10px 15px" : "14px 17px", background: isUser ? "linear-gradient(135deg, #14532D, #166534)" : "rgba(255,255,255,0.03)", borderRadius: isUser ? "17px 17px 4px 17px" : "4px 17px 17px 17px", border: isUser ? "none" : "1px solid rgba(255,255,255,0.06)", fontSize: 13.5, lineHeight: 1.6 }}>
        {isUser ? <span style={{ color: "#DCFCE7" }}>{msg.content}</span> : <div>{fmt(msg.content)}</div>}
      </div>
    </div>
  );
}

function SentimentBadge({ s }) {
  const map = { positivo: ["#DCFCE7", "#166534", "↑ Positivo"], negativo: ["#FEE2E2", "#991B1B", "↓ Negativo"], mixto: ["#FEF9C3", "#854D0E", "~ Mixto"], neutro: ["#F1F5F9", "#475569", "→ Neutro"] };
  const [bg, color, label] = map[s] || map.neutro;
  return <span style={{ fontSize: 10, padding: "2px 8px", background: bg, color, borderRadius: 20, fontWeight: 700 }}>{label}</span>;
}

function ReportScreen({ onGoToClient, allowedClients }) {
  const r = MOCK_REPORT;
  const [expanded, setExpanded] = useState(null);
  const visibleClients = r.clientes.filter(c => allowedClients.includes("*") || allowedClients.includes(c.id));
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px", animation: "lupIn 0.4s ease" }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "#1a4a1a", textTransform: "uppercase", marginBottom: 6 }}>Monitoreo Matutino · {r.hora}</p>
        <h1 style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 400, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Buenos días, <em style={{ color: "#4ADE80" }}>Neuma</em></h1>
        <p style={{ fontSize: 12, color: "#374151", margin: 0, textTransform: "capitalize" }}>{r.fecha}</p>
      </div>
      <div style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 14, padding: "16px 18px", marginBottom: 20, display: "flex", gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #14532D, #22C55E)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>✦</div>
        <div><div style={{ fontSize: 11, color: "#4ADE80", fontWeight: 700, marginBottom: 4 }}>RESUMEN LUPITA</div><div style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6 }}>{r.resumenGeneral}</div></div>
      </div>
      {visibleClients.filter(c => c.alerta).map(c => (
        <div key={c.id} style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 14, padding: "14px 18px", marginBottom: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "#FCA5A5", fontWeight: 700, marginBottom: 2 }}>ALERTA · {c.name.toUpperCase()}</div><div style={{ fontSize: 13, color: "#FEE2E2" }}>{c.alertaTexto}</div></div>
          <button onClick={() => onGoToClient(c.id)} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>Ver detalle →</button>
        </div>
      ))}
      {visibleClients.map((c, idx) => (
        <div key={c.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${c.alerta ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 16, marginBottom: 12, overflow: "hidden", animation: `lupIn 0.4s ease ${idx * 0.08}s both` }}>
          <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: c.color + "18", border: `1.5px solid ${c.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: c.color, flexShrink: 0 }}>{c.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 3 }}>{c.name}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <SentimentBadge s={c.sentimiento} />
                <span style={{ fontSize: 11, color: "#4B5563" }}>{c.menciones} menciones <span style={{ color: c.menciones > c.mencionesAyer ? "#4ADE80" : "#F87171" }}>{c.menciones > c.mencionesAyer ? `↑ +${c.menciones - c.mencionesAyer}` : `↓ ${c.menciones - c.mencionesAyer}`} vs ayer</span></span>
                {c.alerta && <span style={{ fontSize: 10, color: "#FCA5A5", background: "rgba(239,68,68,0.1)", padding: "2px 7px", borderRadius: 20 }}>⚠ Alerta</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={(e) => { e.stopPropagation(); onGoToClient(c.id); }} style={{ background: `${c.color}15`, border: `1px solid ${c.color}33`, color: c.color, borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer" }}>Ir a chat →</button>
              <span style={{ color: "#4B5563", fontSize: 14, padding: "5px" }}>{expanded === c.id ? "▲" : "▼"}</span>
            </div>
          </div>
          {expanded === c.id && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "16px 18px" }}>
              <div style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#4ADE80", fontWeight: 700, marginBottom: 5 }}>✦ ANÁLISIS LUPITA</div>
                <div style={{ fontSize: 12.5, color: "#CBD5E1", lineHeight: 1.65 }}>{c.resumenLupita}</div>
              </div>
              {c.prensa.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>📰 PRENSA Y MEDIOS</div>
                  {c.prensa.map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <span style={{ fontSize: 10, padding: "2px 7px", background: p.sentimiento === "positivo" ? "#DCFCE7" : "#F1F5F9", color: p.sentimiento === "positivo" ? "#166534" : "#475569", borderRadius: 20, flexShrink: 0 }}>{p.medio}</span>
                      <span style={{ fontSize: 12.5, color: "#CBD5E1", lineHeight: 1.5 }}>{p.titulo}</span>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>📱 REDES SOCIALES</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                  {c.redes.map((r, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: "#E2E8F0" }}>{r.plataforma}</span><SentimentBadge s={r.sentimiento} /></div>
                      <div style={{ fontSize: 11, color: "#4ADE80", marginBottom: 4 }}>{r.menciones} menciones</div>
                      <div style={{ fontSize: 11, color: "#4B5563", fontStyle: "italic" }}>"{r.topPost.slice(0, 80)}..."</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function LupitaApp() {
  const [authState, setAuthState] = useState("loading");
  const [currentUser, setCurrentUser] = useState(null);
  const [screen, setScreen] = useState("home");
  const [activeClient, setActiveClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveStatus, setDriveStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const systemPromptRef = useRef("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) { setUrlError(error); window.history.replaceState({}, "", "/"); }
    checkSession();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        setAuthState("authorized");
      } else {
        const data = await res.json();
        if (data.error === "user_not_authorized") {
          setAuthState("unauthorized");
        } else {
          setAuthState("login");
        }
      }
    } catch { setAuthState("login"); }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout");
    setCurrentUser(null);
    setAuthState("login");
    setScreen("home");
    setShowUserMenu(false);
  };

  const CLIENTS = currentUser?.clients
    ? ALL_CLIENTS.filter(c => currentUser.clients.includes("*") || currentUser.clients.includes(c.id))
    : [];

  const canSeeReport = ["directora", "account"].includes(currentUser?.role);

  const goToClient = (clientId) => {
    const client = CLIENTS.find(c => c.id === clientId);
    if (client) startChat(client);
  };

  const startChat = async (client) => {
    setActiveClient(client); setScreen("chat"); setLoadingDrive(true);
    setDriveStatus("Leyendo archivos de Drive..."); setMessages([]);
    let files = [];
    try {
      files = await loadClientContext(client.folderId);
      setDriveFiles(files);
      setDriveStatus(files.length > 0 ? `${files.length} archivo${files.length > 1 ? "s" : ""} cargado${files.length > 1 ? "s" : ""} de Drive` : "No se encontraron archivos en Drive");
    } catch { setDriveStatus("Error al leer Drive"); }
    systemPromptRef.current = buildSystemPrompt(client, files);
    setLoadingDrive(false);
    const fileNames = files.map(f => `· ${f.name}`).join("\n");
    setMessages([{ role: "assistant", content: files.length > 0 ? `¡Hola! Soy Lupita, lista para trabajar con **${client.name}**.\n\nHe leído **${files.length} archivo${files.length > 1 ? "s" : ""}** de Drive:\n${fileNames}\n\n¿Qué necesitas generar hoy?` : `¡Hola! Soy Lupita, lista para trabajar con **${client.name}**.\n\n¿Qué necesitas generar?` }]);
  };

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");
    const newMsgs = [...messages, { role: "user", content: userText }];
    setMessages(newMsgs); setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, system: systemPromptRef.current, messages: newMsgs.map(m => ({ role: m.role, content: m.content })) }) });
      const data = await res.json();
      const reply = data.content?.map(b => b.text).join("") || "Error al obtener respuesta.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Error de conexión. Intenta de nuevo." }]); }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const copyLast = () => {
    const last = [...messages].reverse().find(m => m.role === "assistant");
    if (last) { navigator.clipboard.writeText(last.content); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const refreshDrive = async () => {
    if (!activeClient) return;
    setLoadingDrive(true); setDriveStatus("Actualizando archivos...");
    try {
      const files = await loadClientContext(activeClient.folderId);
      setDriveFiles(files);
      systemPromptRef.current = buildSystemPrompt(activeClient, files);
      setDriveStatus(`${files.length} archivo${files.length > 1 ? "s" : ""} cargado${files.length > 1 ? "s" : ""} de Drive`);
    } catch { setDriveStatus("Error al actualizar Drive"); }
    setLoadingDrive(false);
  };

  if (authState === "loading") return (
    <div style={{ minHeight: "100vh", background: "#07090C", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes lupSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "2px solid #4ADE80", borderTopColor: "transparent", borderRadius: "50%", animation: "lupSpin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 13, color: "#2a4a2a", fontFamily: "Georgia, serif" }}>Verificando sesión...</div>
      </div>
    </div>
  );

  if (authState === "login") return <LoginScreen error={urlError} />;
  if (authState === "unauthorized") return <UnauthorizedScreen user={currentUser} onLogout={handleLogout} />;

  const backLabel = screen === "chat" ? "← Clientes" : screen === "reporte" ? "← Inicio" : null;
  const backAction = screen === "chat" ? () => { setScreen("home"); setMessages([]); setActiveClient(null); setDriveFiles([]); } : screen === "reporte" ? () => setScreen("home") : null;

  return (
    <div style={{ minHeight: "100vh", background: "#07090C", fontFamily: "'Georgia', serif", color: "#E2E8F0" }}>
      <style>{`
        @keyframes lupFadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes lupBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes lupPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes lupIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes lupSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        textarea{resize:none;} textarea:focus{outline:none;}
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#1a2a1a;border-radius:3px}
      `}</style>

      {/* HEADER */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          {backLabel && <button onClick={backAction} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 10px", color: "#888", fontSize: 12, cursor: "pointer", marginRight: 4 }}>{backLabel}</button>}
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #052e16, #16A34A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F0FDF4", letterSpacing: "-0.01em" }}>
              Lupita
              {activeClient && screen === "chat" && <span style={{ color: activeClient.color, fontWeight: 400 }}> · {activeClient.name}</span>}
              {screen === "reporte" && <span style={{ color: "#FBBF24", fontWeight: 400 }}> · Reporte Matutino</span>}
            </div>
            <div style={{ fontSize: 10, color: "#4ADE80", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ADE80", display: "inline-block", animation: "lupPulse 2s infinite" }} />
              {currentUser?.name || currentUser?.email}
              {currentUser?.role === "directora" && <span style={{ color: "#FBBF24", marginLeft: 3 }}>✦ Directora</span>}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          {screen === "chat" && (
            <>
              {driveStatus && <span style={{ fontSize: 10, color: loadingDrive ? "#FBBF24" : "#4ADE80", display: "flex", alignItems: "center", gap: 5 }}>{loadingDrive ? <span style={{ display: "inline-block", width: 8, height: 8, border: "1.5px solid #FBBF24", borderTopColor: "transparent", borderRadius: "50%", animation: "lupSpin 0.7s linear infinite" }} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />}{driveStatus}</span>}
              <button onClick={refreshDrive} disabled={loadingDrive} style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", color: "#4ADE80", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer" }}>↻ Drive</button>
              <button onClick={copyLast} style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.18)", color: "#4ADE80", borderRadius: 8, padding: "5px 13px", fontSize: 11, cursor: "pointer" }}>{copied ? "✓ Copiado" : "📋 Copiar"}</button>
              <button onClick={() => setMessages([{ role: "assistant", content: `¡Listo para seguir con **${activeClient.name}**! ¿Qué necesitas ahora?` }])} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#666", borderRadius: 8, padding: "5px 13px", fontSize: 11, cursor: "pointer" }}>Nueva conv.</button>
            </>
          )}
          {screen === "home" && canSeeReport && (
            <button onClick={() => setScreen("reporte")} style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#FBBF24", borderRadius: 10, padding: "7px 14px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FBBF24", display: "inline-block", animation: "lupPulse 2s infinite" }} />
              📊 Reporte de hoy
            </button>
          )}
          {/* Avatar menu */}
          <div style={{ position: "relative" }}>
            <div onClick={() => setShowUserMenu(!showUserMenu)} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(74,222,128,0.12)", border: "1.5px solid rgba(74,222,128,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#4ADE80", cursor: "pointer", fontWeight: 700, userSelect: "none" }}>
              {(currentUser?.name || currentUser?.email || "?")[0].toUpperCase()}
            </div>
            {showUserMenu && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: "#0D1A0D", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 8, minWidth: 200, zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 2 }}>{currentUser?.name}</div>
                  <div style={{ fontSize: 11, color: "#4B5563" }}>{currentUser?.email}</div>
                  <div style={{ fontSize: 10, color: "#4ADE80", marginTop: 4 }}>{currentUser?.role === "directora" ? "✦ Directora · Acceso total" : `Account · ${CLIENTS.length} cliente${CLIENTS.length !== 1 ? "s" : ""}`}</div>
                </div>
                <button onClick={handleLogout} style={{ width: "100%", background: "transparent", border: "none", color: "#F87171", fontSize: 12, padding: "8px 12px", cursor: "pointer", textAlign: "left", borderRadius: 8 }}>
                  → Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HOME */}
      {screen === "home" && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "44px 20px", animation: "lupIn 0.4s ease" }}>
          <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "#1a3a1a", textTransform: "uppercase", marginBottom: 10 }}>Neuma · Agencia de RRPP</p>
          <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Hola, {currentUser?.name?.split(" ")[0]}<br /><em style={{ color: "#4ADE80" }}>¿con qué cliente trabajamos?</em>
          </h1>
          <p style={{ color: "#374151", fontSize: 13, margin: "0 0 8px", lineHeight: 1.7 }}>Selecciona el cliente y Lupita leerá automáticamente todos sus archivos de Google Drive.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 32, fontSize: 11, color: "#1a4a1a" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />
            Conectada a Google Drive · {CLIENTS.length} cliente{CLIENTS.length !== 1 ? "s" : ""} asignado{CLIENTS.length !== 1 ? "s" : ""}
          </div>
          {MOCK_REPORT.clientes.some(c => c.alerta && (currentUser?.clients?.includes("*") || currentUser?.clients?.includes(c.id))) && (
            <div onClick={() => setScreen("reporte")} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
              <span>🚨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#FCA5A5", fontWeight: 700, marginBottom: 2 }}>ALERTA EN REPORTE MATUTINO</div>
                <div style={{ fontSize: 12, color: "#FEE2E2" }}>{MOCK_REPORT.clientes.find(c => c.alerta && (currentUser?.clients?.includes("*") || currentUser?.clients?.includes(c.id)))?.alertaTexto}</div>
              </div>
              <span style={{ color: "#FCA5A5", fontSize: 13 }}>Ver →</span>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 40 }}>
            {CLIENTS.map((client, i) => (
              <button key={client.id} onClick={() => startChat(client)} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "18px 20px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 16, transition: "all 0.2s", animation: `lupIn 0.4s ease ${i * 0.07}s both` }}
                onMouseEnter={e => { e.currentTarget.style.background = `${client.color}10`; e.currentTarget.style.borderColor = `${client.color}40`; e.currentTarget.style.transform = "translateX(4px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: client.color + "18", border: `1.5px solid ${client.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: client.color, flexShrink: 0 }}>{client.initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#E2E8F0", marginBottom: 2 }}>{client.name}</div>
                  <div style={{ fontSize: 12, color: "#4B5563" }}>{client.industry}</div>
                </div>
                {MOCK_REPORT.clientes.find(c => c.id === client.id)?.alerta && <span style={{ fontSize: 10, color: "#FCA5A5", background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 20 }}>⚠ Alerta</span>}
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#2a4a2a" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block", opacity: 0.6 }} />Drive conectado
                </div>
                <span style={{ color: "#2D3748", fontSize: 16, marginLeft: 4 }}>→</span>
              </button>
            ))}
          </div>
          {currentUser?.role === "directora" && (
            <div style={{ border: "1.5px dashed rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#2D3748", flexShrink: 0 }}>+</div>
              <div><div style={{ fontSize: 13, color: "#374151", marginBottom: 2 }}>Agregar nuevo cliente o usuario</div><div style={{ fontSize: 11, color: "#1F2937" }}>Edita App.jsx + src/users.js en GitHub</div></div>
            </div>
          )}
        </div>
      )}

      {screen === "reporte" && <ReportScreen onGoToClient={goToClient} allowedClients={currentUser?.clients || []} />}

      {/* CHAT */}
      {screen === "chat" && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
          {driveFiles.length > 0 && (
            <div style={{ padding: "8px 0 6px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#2a4a2a", marginRight: 2 }}>📂</span>
              {driveFiles.map((f, i) => <span key={i} style={{ fontSize: 10, padding: "2px 8px", background: activeClient.color + "0F", border: `1px solid ${activeClient.color}22`, borderRadius: 20, color: activeClient.color }}>{f.name}</span>)}
            </div>
          )}
          {loadingDrive && messages.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, flexDirection: "column", gap: 12 }}>
              <div style={{ width: 32, height: 32, border: "2px solid #4ADE80", borderTopColor: "transparent", borderRadius: "50%", animation: "lupSpin 0.8s linear infinite" }} />
              <div style={{ fontSize: 13, color: "#2a4a2a" }}>Leyendo archivos de Drive...</div>
            </div>
          )}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 0 10px" }}>
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #14532D, #22C55E)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>✦</div>
                <TypingDots />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {!loading && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 8 }}>
              {ACTIONS.map(a => (
                <button key={a.id} onClick={() => sendMessage(a.prompt(activeClient))} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "5px 12px", fontSize: 11, color: "#4B5563", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.color = a.color; e.currentTarget.style.borderColor = a.color + "44"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#4B5563"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                >{a.icon} {a.label}</button>
              ))}
            </div>
          )}
          <div style={{ paddingBottom: 20 }}>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-end", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 15, padding: "11px 13px", transition: "border-color 0.2s" }}
              onFocusCapture={e => e.currentTarget.style.borderColor = "rgba(74,222,128,0.3)"}
              onBlurCapture={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}
            >
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={`Pídele algo a Lupita sobre ${activeClient?.name}…`}
                rows={2} style={{ flex: 1, background: "transparent", border: "none", color: "#E2E8F0", fontSize: 13.5, lineHeight: 1.6, fontFamily: "inherit" }}
              />
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, border: "none", cursor: input.trim() && !loading ? "pointer" : "default", background: input.trim() && !loading ? "linear-gradient(135deg, #15803D, #4ADE80)" : "rgba(255,255,255,0.04)", color: input.trim() && !loading ? "#fff" : "#2D3748", fontSize: 15, transition: "all 0.2s" }}>↑</button>
            </div>
            <p style={{ fontSize: 10, color: "#1a2a1a", textAlign: "center", marginTop: 7 }}>Enter para enviar · Shift+Enter para nueva línea</p>
          </div>
        </div>
      )}
    </div>
  );
}
