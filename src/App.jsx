import { useState, useRef, useEffect } from "react";

const CLIENTS = [
  {
    id: "labsalud",
    name: "Laboratorios Salud+",
    industry: "Farmacéutica",
    color: "#4ADE80",
    initials: "LS",
    vocero: "Dr. Alejandro Ríos, Director Médico",
    productos: "Oncología, cardiología, diabetes",
    tono: "Científico y cercano",
    mensajes: [
      "Innovación con evidencia clínica comprobada",
      "Comprometidos con el acceso a la salud en México",
      "30 años liderando tratamientos de vanguardia",
    ],
    mercado: "México y Latam",
    regulacion: "COFEPRIS",
  },
  {
    id: "vitacare",
    name: "VitaCare México",
    industry: "Salud preventiva",
    color: "#60A5FA",
    initials: "VC",
    vocero: "Dra. Mariana Torres, CEO",
    productos: "Suplementos, vitaminas, bienestar",
    tono: "Cercano, optimista y accesible",
    mensajes: [
      "La prevención es la mejor medicina",
      "Ciencia al servicio del bienestar cotidiano",
      "Productos certificados para toda la familia",
    ],
    mercado: "México",
    regulacion: "COFEPRIS",
  },
  {
    id: "medtech",
    name: "MedTech Innovations",
    industry: "Tecnología médica",
    color: "#F472B6",
    initials: "MT",
    vocero: "Ing. Carlos Mendoza, Dir. Comercial",
    productos: "Dispositivos médicos, diagnóstico, IA médica",
    tono: "Innovador, técnico pero accesible",
    mensajes: [
      "Tecnología que salva vidas",
      "IA al servicio del diagnóstico temprano",
      "Socios estratégicos de hospitales líderes",
    ],
    mercado: "México, Colombia, Chile",
    regulacion: "COFEPRIS / FDA",
  },
];

const ACTIONS = [
  { id: "comunicado", icon: "📋", label: "Comunicado de prensa", color: "#4ADE80",
    prompt: (c) => `Soy del equipo de la agencia. Necesito redactar un comunicado de prensa para ${c.name}. ¿Qué información adicional necesitas para generarlo?` },
  { id: "pitch", icon: "🎯", label: "Pitch para periodista", color: "#60A5FA",
    prompt: (c) => `Necesito un pitch para un periodista sobre ${c.name}. ¿Qué datos necesitas para personalizarlo?` },
  { id: "posts", icon: "📱", label: "Posts redes sociales", color: "#F472B6",
    prompt: (c) => `Quiero crear posts para redes sociales de ${c.name}. ¿Por dónde empezamos?` },
  { id: "talking", icon: "🎤", label: "Talking points vocero", color: "#FBBF24",
    prompt: (c) => `Necesito preparar talking points para ${c.vocero} de ${c.name}. ¿Qué información necesitas?` },
  { id: "crisis", icon: "⚠️", label: "Crisis statement", color: "#FB923C",
    prompt: (c) => `Necesito un crisis statement para ${c.name}. ¿Cuáles son los detalles de la situación?` },
];

const SYSTEM_PROMPT = (client) => `Eres Lupita, agente especializada en Relaciones Públicas para el sector Salud y Farmacéutico. Formas parte del equipo interno de Neuma, una agencia de RRPP profesional.

CLIENTE ACTIVO: ${client.name}
Industria: ${client.industry}
Vocero principal: ${client.vocero}
Productos/servicios: ${client.productos}
Tono de comunicación: ${client.tono}
Mensajes clave:
${client.mensajes.map((m, i) => `  ${i + 1}. ${m}`).join("\n")}
Mercado: ${client.mercado}
Regulación aplicable: ${client.regulacion}

INSTRUCCIONES:
- Siempre escribes en español
- Conoces a fondo a este cliente, usa sus mensajes clave en todo lo que generes
- Si necesitas más datos para generar contenido, pregunta primero
- Nunca inventas información del cliente
- Respetas las reglas de COFEPRIS: no haces claims terapéuticos sin indicar aprobación regulatoria
- Incluyes "Consulte a su médico" cuando aplica
- Ofreces versión conservadora y versión más directa cuando el tono lo permite
- Al final de cada entrega sugieres qué más podría necesitar el equipo

PUEDES GENERAR:
1. Comunicados de prensa (estructura pirámide invertida, cita de vocero)
2. Pitches para periodistas (máx 200 palabras, gancho noticioso)
3. Posts para redes sociales (adaptados por plataforma)
4. Talking points para voceros (con preguntas difíciles y bridging phrases)
5. Crisis statements (mensajes de contención, protocolo de respuesta)`;

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "12px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 14, width: "fit-content", border: "1px solid rgba(255,255,255,0.06)" }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", opacity: 0.6, animation: "lupBounce 1.2s infinite", animationDelay: `${i*0.18}s` }} />
      ))}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const fmt = (text) => text.split("\n").map((line, i) => {
    if (line.startsWith("# ")) return <div key={i} style={{ fontSize: 16, fontWeight: 700, color: "#4ADE80", margin: "10px 0 4px" }}>{line.slice(2)}</div>;
    if (line.startsWith("## ")) return <div key={i} style={{ fontSize: 14, fontWeight: 700, color: "#86EFAC", margin: "8px 0 3px" }}>{line.slice(3)}</div>;
    if (line.startsWith("**") && line.endsWith("**")) return <div key={i} style={{ fontWeight: 700, color: "#E2E8F0", margin: "3px 0" }}>{line.slice(2,-2)}</div>;
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
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #14532D, #22C55E)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 9, flexShrink: 0, marginTop: 2 }}>✦</div>
      )}
      <div style={{ maxWidth: "75%", padding: isUser ? "10px 15px" : "14px 17px",
        background: isUser ? "linear-gradient(135deg, #14532D, #166534)" : "rgba(255,255,255,0.03)",
        borderRadius: isUser ? "17px 17px 4px 17px" : "4px 17px 17px 17px",
        border: isUser ? "none" : "1px solid rgba(255,255,255,0.06)", fontSize: 13.5, lineHeight: 1.6 }}>
        {isUser ? <span style={{ color: "#DCFCE7" }}>{msg.content}</span> : <div>{fmt(msg.content)}</div>}
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
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const startChat = (client) => {
    setActiveClient(client);
    setMessages([{
      role: "assistant",
      content: `¡Hola! Soy Lupita, lista para trabajar con **${client.name}**.\n\n¿Qué necesitas hoy? Puedo generar un comunicado de prensa, pitch para periodista, posts para redes, talking points para ${client.vocero.split(",")[0]}, o un crisis statement.`
    }]);
    setScreen("chat");
  };

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");
    const newMsgs = [...messages, { role: "user", content: userText }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-allow-browser": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT(activeClient),
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });
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

  return (
    <div style={{ minHeight: "100vh", background: "#07090C", fontFamily: "'Georgia', serif", color: "#E2E8F0" }}>
      <style>{`
        @keyframes lupFadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        @keyframes lupBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes lupPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes lupIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        textarea { resize:none; }
        textarea:focus { outline:none; }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#1a2a1a;border-radius:3px}
      `}</style>

      <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          {screen === "chat" && (
            <button onClick={() => { setScreen("home"); setMessages([]); setActiveClient(null); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 10px", color: "#888", fontSize: 12, cursor: "pointer", marginRight: 4 }}>← Clientes</button>
          )}
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #052e16, #16A34A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F0FDF4", letterSpacing: "-0.01em" }}>
              Lupita {activeClient && <span style={{ color: activeClient.color, fontWeight: 400 }}>· {activeClient.name}</span>}
            </div>
            <div style={{ fontSize: 10, color: "#4ADE80", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ADE80", display: "inline-block", animation: "lupPulse 2s infinite" }} />
              Neuma · Agente RRPP Salud
            </div>
          </div>
        </div>
        {screen === "chat" && (
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={copyLast} style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.18)", color: "#4ADE80", borderRadius: 8, padding: "5px 13px", fontSize: 11, cursor: "pointer" }}>
              {copied ? "✓ Copiado" : "📋 Copiar"}
            </button>
            <button onClick={() => setMessages([{ role: "assistant", content: `¡Listo para seguir con **${activeClient.name}**! ¿Qué necesitas ahora?` }])} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#666", borderRadius: 8, padding: "5px 13px", fontSize: 11, cursor: "pointer" }}>
              Nueva conversación
            </button>
          </div>
        )}
      </div>

      {screen === "home" && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "44px 20px", animation: "lupIn 0.4s ease" }}>
          <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "#1a3a1a", textTransform: "uppercase", marginBottom: 10 }}>Neuma · Agencia de RRPP</p>
          <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Hola, ¿con qué cliente<br /><em style={{ color: "#4ADE80" }}>trabajamos hoy?</em>
          </h1>
          <p style={{ color: "#374151", fontSize: 13, margin: "0 0 40px", lineHeight: 1.7 }}>
            Selecciona el cliente y Lupita tendrá listo su contexto, mensajes clave y tono de comunicación.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 40 }}>
            {CLIENTS.map((client, i) => (
              <button key={client.id} onClick={() => startChat(client)} style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16, padding: "18px 20px", cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: 16, transition: "all 0.2s",
                animation: `lupIn 0.4s ease ${i * 0.07}s both`,
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(74,222,128,0.05)"; e.currentTarget.style.borderColor = "rgba(74,222,128,0.2)"; e.currentTarget.style.transform = "translateX(4px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: client.color + "18", border: `1.5px solid ${client.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: client.color, flexShrink: 0 }}>
                  {client.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#E2E8F0", marginBottom: 2 }}>{client.name}</div>
                  <div style={{ fontSize: 12, color: "#4B5563" }}>{client.industry} · {client.mercado}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>Vocero</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{client.vocero.split(",")[0]}</div>
                </div>
                <span style={{ color: "#2D3748", fontSize: 16, marginLeft: 4 }}>→</span>
              </button>
            ))}
          </div>
          <div style={{ border: "1.5px dashed rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#2D3748", flexShrink: 0 }}>+</div>
            <div>
              <div style={{ fontSize: 13, color: "#374151", marginBottom: 2 }}>Agregar nuevo cliente</div>
              <div style={{ fontSize: 11, color: "#1F2937" }}>Edita el archivo App.jsx para agregar más clientes</div>
            </div>
          </div>
        </div>
      )}

      {screen === "chat" && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
          <div style={{ padding: "10px 0 6px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {activeClient.mensajes.map((m, i) => (
              <span key={i} style={{ fontSize: 10, padding: "3px 9px", background: activeClient.color + "0F", border: `1px solid ${activeClient.color}22`, borderRadius: 20, color: activeClient.color }}>
                {m}
              </span>
            ))}
          </div>
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
                <button key={a.id} onClick={() => sendMessage(a.prompt(activeClient))} style={{
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 20, padding: "5px 12px", fontSize: 11, color: "#4B5563",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = a.color; e.currentTarget.style.borderColor = a.color + "44"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#4B5563"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                >
                  {a.icon} {a.label}
                </button>
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
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0, border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
                background: input.trim() && !loading ? "linear-gradient(135deg, #15803D, #4ADE80)" : "rgba(255,255,255,0.04)",
                color: input.trim() && !loading ? "#fff" : "#2D3748", fontSize: 15, transition: "all 0.2s",
              }}>↑</button>
            </div>
            <p style={{ fontSize: 10, color: "#1a2a1a", textAlign: "center", marginTop: 7 }}>Enter para enviar · Shift+Enter para nueva línea</p>
          </div>
        </div>
      )}
    </div>
  );
}
