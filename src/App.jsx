import { useState, useRef, useEffect } from "react";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

const CLIENTS = [
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

// Reporte matutino de ejemplo (en producción viene de Zapier via Drive)
const MOCK_REPORT = {
  fecha: new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
  hora: "08:00 AM",
  resumenGeneral: "Día sin alertas críticas. Soriana tiene actividad alta por promociones de fin de semana. Pfizer con cobertura positiva por estudio clínico. Prudence sin menciones relevantes.",
  clientes: [
    {
      id: "pfizer", name: "Pfizer México", color: "#4A90D9", initials: "PF",
      alerta: false,
      sentimiento: "positivo",
      menciones: 12,
      mencionesAyer: 8,
      prensa: [
        { titulo: "Pfizer presenta resultados positivos en estudio de oncología de precisión", medio: "El Universal", url: "#", sentimiento: "positivo" },
        { titulo: "Farmacéuticas aumentan inversión en I+D en México: Pfizer lidera", medio: "Expansión", url: "#", sentimiento: "positivo" },
      ],
      redes: [
        { plataforma: "Twitter/X", menciones: 45, sentimiento: "positivo", topPost: "@PfizerMexico anuncia nuevos resultados del ensayo clínico fase 3" },
        { plataforma: "LinkedIn", menciones: 12, sentimiento: "positivo", topPost: "Constanza Losada comparte los logros de Pfizer México en Q1 2026" },
      ],
      resumenLupita: "Cobertura mayoritariamente positiva. El estudio de oncología está generando interés editorial. Recomiendo preparar un pitch de seguimiento para medios especializados en salud que aún no cubrieron la nota.",
    },
    {
      id: "soriana", name: "Organización Soriana", color: "#C8102E", initials: "SO",
      alerta: true,
      alertaTexto: "Comentarios negativos en redes sobre precios de canasta básica",
      sentimiento: "mixto",
      menciones: 34,
      mencionesAyer: 19,
      prensa: [
        { titulo: "Soriana lanza promoción de fin de semana con descuentos en productos básicos", medio: "Milenio", url: "#", sentimiento: "positivo" },
        { titulo: "Supermercados mexicanos bajo presión por inflación en alimentos", medio: "El Financiero", url: "#", sentimiento: "neutro" },
      ],
      redes: [
        { plataforma: "Twitter/X", menciones: 89, sentimiento: "mixto", topPost: "Varios usuarios comparan precios de canasta básica entre Soriana y Walmart" },
        { plataforma: "Facebook", menciones: 56, sentimiento: "negativo", topPost: "Quejas sobre aumento de precios en sucursal Perisur" },
        { plataforma: "Instagram", menciones: 23, sentimiento: "positivo", topPost: "Promoción 2x1 en lácteos genera engagement positivo" },
      ],
      resumenLupita: "⚠️ Atención: hay un pico de menciones negativas relacionadas a precios. No es crisis aún pero puede escalar. Recomiendo preparar un mensaje proactivo sobre el compromiso de Soriana con el precio justo antes de que lleguen preguntas de medios.",
    },
    {
      id: "prudence", name: "Condones Prudence", color: "#D62B7C", initials: "PR",
      alerta: false,
      sentimiento: "neutro",
      menciones: 5,
      mencionesAyer: 3,
      prensa: [],
      redes: [
        { plataforma: "Instagram", menciones: 18, sentimiento: "positivo", topPost: "Post de campaña de educación sexual alcanza 2.3k likes" },
        { plataforma: "TikTok", menciones: 11, sentimiento: "positivo", topPost: "Video educativo sobre prevención de ITS supera 15k views" },
      ],
      resumenLupita: "Día tranquilo. El contenido de redes sociales está funcionando bien — el video de TikTok tiene buen alcance orgánico. Sin menciones en prensa. Buen momento para enviar un pitch proactivo a medios de salud sexual.",
    },
  ],
};

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
  return `Eres Lupita, agente especializada en Relaciones Públicas para la agencia Neuma. Tienes acceso completo al historial y contexto del siguiente cliente.\n\nCLIENTE ACTIVO: ${client.name}\nIndustria: ${client.industry}\n${fileSection}\n\nINSTRUCCIONES:\n- Siempre escribes en español\n- Usas la información de los archivos de Drive como base para todo el contenido que generes\n- Si los archivos contienen comunicados, pitches o campañas anteriores, los usas como referencia de estilo y tono\n- Si necesitas información que no está en los archivos, pregunta al equipo\n- Nunca inventas información del cliente\n- Respetas regulaciones sanitarias (COFEPRIS, FDA, EMA) cuando aplica\n- Incluyes "Consulte a su médico" en comunicaciones B2C de salud cuando aplica\n- Al final de cada entrega sugieres qué más podría necesitar el equipo\n\nPUEDES GENERAR:\n1. Comunicados de prensa\n2. Pitches para periodistas\n3. Posts para redes sociales\n4. Talking points para voceros\n5. Crisis statements`;
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

function ReportScreen({ onGoToClient }) {
  const r = MOCK_REPORT;
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px", animation: "lupIn 0.4s ease" }}>
      {/* Header reporte */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "#1a4a1a", textTransform: "uppercase", marginBottom: 6 }}>Monitoreo Matutino · {r.hora}</p>
        <h1 style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 400, margin: "0 0 6px", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Buenos días, <em style={{ color: "#4ADE80" }}>Neuma</em>
        </h1>
        <p style={{ fontSize: 12, color: "#374151", margin: 0, textTransform: "capitalize" }}>{r.fecha}</p>
      </div>

      {/* Resumen general */}
      <div style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 14, padding: "16px 18px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #14532D, #22C55E)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>✦</div>
        <div>
          <div style={{ fontSize: 11, color: "#4ADE80", fontWeight: 700, marginBottom: 4 }}>RESUMEN LUPITA</div>
          <div style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6 }}>{r.resumenGeneral}</div>
        </div>
      </div>

      {/* Alertas críticas primero */}
      {r.clientes.filter(c => c.alerta).map(c => (
        <div key={c.id} style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 14, padding: "14px 18px", marginBottom: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#FCA5A5", fontWeight: 700, marginBottom: 2 }}>ALERTA · {c.name.toUpperCase()}</div>
            <div style={{ fontSize: 13, color: "#FEE2E2" }}>{c.alertaTexto}</div>
          </div>
          <button onClick={() => onGoToClient(c.id)} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>
            Ver detalle →
          </button>
        </div>
      ))}

      {/* Cards por cliente */}
      {r.clientes.map((c, idx) => (
        <div key={c.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${c.alerta ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 16, marginBottom: 12, overflow: "hidden", animation: `lupIn 0.4s ease ${idx * 0.08}s both` }}>
          {/* Card header */}
          <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: c.color + "18", border: `1.5px solid ${c.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: c.color, flexShrink: 0 }}>{c.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 3 }}>{c.name}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <SentimentBadge s={c.sentimiento} />
                <span style={{ fontSize: 11, color: "#4B5563" }}>
                  {c.menciones} menciones
                  <span style={{ color: c.menciones > c.mencionesAyer ? "#4ADE80" : "#F87171", marginLeft: 4 }}>
                    {c.menciones > c.mencionesAyer ? `↑ +${c.menciones - c.mencionesAyer}` : `↓ ${c.menciones - c.mencionesAyer}`} vs ayer
                  </span>
                </span>
                {c.alerta && <span style={{ fontSize: 10, color: "#FCA5A5", background: "rgba(239,68,68,0.1)", padding: "2px 7px", borderRadius: 20, border: "1px solid rgba(239,68,68,0.2)" }}>⚠ Alerta</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={(e) => { e.stopPropagation(); onGoToClient(c.id); }} style={{ background: `${c.color}15`, border: `1px solid ${c.color}33`, color: c.color, borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer" }}>
                Ir a chat →
              </button>
              <span style={{ color: "#4B5563", fontSize: 14, padding: "5px" }}>{expanded === c.id ? "▲" : "▼"}</span>
            </div>
          </div>

          {/* Detalle expandido */}
          {expanded === c.id && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "16px 18px", animation: "lupFadeUp 0.2s ease" }}>
              {/* Resumen Lupita */}
              <div style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#4ADE80", fontWeight: 700, marginBottom: 5 }}>✦ ANÁLISIS LUPITA</div>
                <div style={{ fontSize: 12.5, color: "#CBD5E1", lineHeight: 1.65 }}>{c.resumenLupita}</div>
              </div>

              {/* Prensa */}
              {c.prensa.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>📰 PRENSA Y MEDIOS</div>
                  {c.prensa.map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", alignItems: "flex-start" }}>
                      <span style={{ fontSize: 10, padding: "2px 7px", background: p.sentimiento === "positivo" ? "#DCFCE7" : p.sentimiento === "negativo" ? "#FEE2E2" : "#F1F5F9", color: p.sentimiento === "positivo" ? "#166534" : p.sentimiento === "negativo" ? "#991B1B" : "#475569", borderRadius: 20, flexShrink: 0, marginTop: 1 }}>{p.medio}</span>
                      <span style={{ fontSize: 12.5, color: "#CBD5E1", lineHeight: 1.5 }}>{p.titulo}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Redes */}
              <div>
                <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>📱 REDES SOCIALES</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                  {c.redes.map((r, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#E2E8F0" }}>{r.plataforma}</span>
                        <SentimentBadge s={r.sentimiento} />
                      </div>
                      <div style={{ fontSize: 11, color: "#4ADE80", marginBottom: 4 }}>{r.menciones} menciones</div>
                      <div style={{ fontSize: 11, color: "#4B5563", lineHeight: 1.4, fontStyle: "italic" }}>"{r.topPost.slice(0, 80)}..."</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: 11, color: "#2a4a2a", marginBottom: 4 }}>⚡ Automatización</div>
        <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
          Este reporte se genera automáticamente cada día a las 8:00 AM vía Zapier + Brand24 + Lupita y se envía al equipo por email. 
          Los datos en esta pantalla se actualizan en tiempo real.
        </div>
      </div>
    </div>
  );
}

export default function LupitaApp() {
  const [screen, setScreen] = useState("home");
  const [activeClient, setActiveClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveStatus, setDriveStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const systemPromptRef = useRef("");

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const goToClient = (clientId) => {
    const client = CLIENTS.find(c => c.id === clientId);
    if (client) startChat(client);
  };

  const startChat = async (client) => {
    setActiveClient(client);
    setScreen("chat");
    setLoadingDrive(true);
    setDriveStatus("Leyendo archivos de Drive...");
    setMessages([]);
    let files = [];
    try {
      files = await loadClientContext(client.folderId);
      setDriveFiles(files);
      setDriveStatus(files.length > 0 ? `${files.length} archivo${files.length > 1 ? "s" : ""} cargado${files.length > 1 ? "s" : ""} de Drive` : "No se encontraron archivos en Drive");
    } catch {
      setDriveStatus("Error al leer Drive");
    }
    systemPromptRef.current = buildSystemPrompt(client, files);
    setLoadingDrive(false);
    const fileNames = files.map(f => `· ${f.name}`).join("\n");
    setMessages([{ role: "assistant", content: files.length > 0 ? `¡Hola! Soy Lupita, lista para trabajar con **${client.name}**.\n\nHe leído **${files.length} archivo${files.length > 1 ? "s" : ""}** de Drive:\n${fileNames}\n\n¿Qué necesitas generar hoy?` : `¡Hola! Soy Lupita, lista para trabajar con **${client.name}**.\n\nNo encontré archivos en Drive todavía.\n\n¿Qué necesitas generar?` }]);
  };

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");
    const newMsgs = [...messages, { role: "user", content: userText }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, system: systemPromptRef.current, messages: newMsgs.map(m => ({ role: m.role, content: m.content })) }) });
      const data = await res.json();
      const reply = data.content?.map(b => b.text).join("") || "Error al obtener respuesta.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error de conexión. Por favor intenta de nuevo." }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const copyLast = () => {
    const last = [...messages].reverse().find(m => m.role === "assistant");
    if (last) { navigator.clipboard.writeText(last.content); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const refreshDrive = async () => {
    if (!activeClient) return;
    setLoadingDrive(true);
    setDriveStatus("Actualizando archivos...");
    try {
      const files = await loadClientContext(activeClient.folderId);
      setDriveFiles(files);
      systemPromptRef.current = buildSystemPrompt(activeClient, files);
      setDriveStatus(`${files.length} archivo${files.length > 1 ? "s" : ""} cargado${files.length > 1 ? "s" : ""} de Drive`);
    } catch { setDriveStatus("Error al actualizar Drive"); }
    setLoadingDrive(false);
  };

  const backLabel = screen === "chat" ? "← Clientes" : screen === "reporte" ? "← Inicio" : null;
  const backAction = screen === "chat" ? () => { setScreen("home"); setMessages([]); setActiveClient(null); setDriveFiles([]); } : screen === "reporte" ? () => setScreen("home") : null;

  return (
    <div style={{ minHeight: "100vh", background: "#07090C", fontFamily: "'Georgia', serif", color: "#E2E8F0" }}>
      <style>{`
        @keyframes lupFadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        @keyframes lupBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes lupPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes lupIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes lupSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        textarea { resize:none; } textarea:focus { outline:none; }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#1a2a1a;border-radius:3px}
      `}</style>

      {/* HEADER */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          {backLabel && <button onClick={backAction} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 10px", color: "#888", fontSize: 12, cursor: "pointer", marginRight: 4 }}>{backLabel}</button>}
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #052e16, #16A34A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F0FDF4", letterSpacing: "-0.01em" }}>
              Lupita {activeClient && screen === "chat" && <span style={{ color: activeClient.color, fontWeight: 400 }}>· {activeClient.name}</span>}
              {screen === "reporte" && <span style={{ color: "#FBBF24", fontWeight: 400 }}> · Reporte Matutino</span>}
            </div>
            <div style={{ fontSize: 10, color: "#4ADE80", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ADE80", display: "inline-block", animation: "lupPulse 2s infinite" }} />
              Neuma · Agente RRPP + Google Drive
            </div>
          </div>
        </div>
        {screen === "chat" && (
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            {driveStatus && (
              <span style={{ fontSize: 10, color: loadingDrive ? "#FBBF24" : "#4ADE80", display: "flex", alignItems: "center", gap: 5 }}>
                {loadingDrive ? <span style={{ display: "inline-block", width: 8, height: 8, border: "1.5px solid #FBBF24", borderTopColor: "transparent", borderRadius: "50%", animation: "lupSpin 0.7s linear infinite" }} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />}
                {driveStatus}
              </span>
            )}
            <button onClick={refreshDrive} disabled={loadingDrive} style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", color: "#4ADE80", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer" }}>↻ Drive</button>
            <button onClick={copyLast} style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.18)", color: "#4ADE80", borderRadius: 8, padding: "5px 13px", fontSize: 11, cursor: "pointer" }}>{copied ? "✓ Copiado" : "📋 Copiar"}</button>
            <button onClick={() => setMessages([{ role: "assistant", content: `¡Listo para seguir con **${activeClient.name}**! ¿Qué necesitas ahora?` }])} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#666", borderRadius: 8, padding: "5px 13px", fontSize: 11, cursor: "pointer" }}>Nueva conv.</button>
          </div>
        )}
        {screen === "home" && (
          <button onClick={() => setScreen("reporte")} style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#FBBF24", borderRadius: 10, padding: "7px 14px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FBBF24", display: "inline-block", animation: "lupPulse 2s infinite" }} />
            📊 Reporte de hoy
          </button>
        )}
      </div>

      {/* HOME */}
      {screen === "home" && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "44px 20px", animation: "lupIn 0.4s ease" }}>
          <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "#1a3a1a", textTransform: "uppercase", marginBottom: 10 }}>Neuma · Agencia de RRPP</p>
          <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Hola, ¿con qué cliente<br /><em style={{ color: "#4ADE80" }}>trabajamos hoy?</em>
          </h1>
          <p style={{ color: "#374151", fontSize: 13, margin: "0 0 8px", lineHeight: 1.7 }}>Selecciona el cliente y Lupita leerá automáticamente todos sus archivos de Google Drive.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 32, fontSize: 11, color: "#1a4a1a" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />
            Conectada a Google Drive · {CLIENTS.length} clientes activos
          </div>

          {/* Alerta del reporte */}
          {MOCK_REPORT.clientes.some(c => c.alerta) && (
            <div onClick={() => setScreen("reporte")} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
              <span>🚨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#FCA5A5", fontWeight: 700, marginBottom: 2 }}>ALERTA EN REPORTE MATUTINO</div>
                <div style={{ fontSize: 12, color: "#FEE2E2" }}>{MOCK_REPORT.clientes.find(c => c.alerta)?.alertaTexto}</div>
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
                {MOCK_REPORT.clientes.find(c => c.id === client.id)?.alerta && <span style={{ fontSize: 10, color: "#FCA5A5", background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 20, border: "1px solid rgba(239,68,68,0.2)" }}>⚠ Alerta</span>}
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#2a4a2a" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block", opacity: 0.6 }} />
                  Drive conectado
                </div>
                <span style={{ color: "#2D3748", fontSize: 16, marginLeft: 4 }}>→</span>
              </button>
            ))}
          </div>
          <div style={{ border: "1.5px dashed rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#2D3748", flexShrink: 0 }}>+</div>
            <div>
              <div style={{ fontSize: 13, color: "#374151", marginBottom: 2 }}>Agregar nuevo cliente</div>
              <div style={{ fontSize: 11, color: "#1F2937" }}>Edita App.jsx · agrega nombre, color e ID de carpeta de Drive</div>
            </div>
          </div>
        </div>
      )}

      {/* REPORTE MATUTINO */}
      {screen === "reporte" && <ReportScreen onGoToClient={goToClient} />}

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
