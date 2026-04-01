import { useState, useRef, useEffect, useCallback } from "react";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const INBOX_SHEET_ID = "1iinP_KunZ3eNyM9olU6aY_BhOyGrVSjn6t0T9cGnb3c";
const JOURNALISTS_SHEET_ID = "1mY8b69fPrt_GfNK8Rn_-02vD1zIUj01pKxy5R1m-p_0";
const MEMORY_SHEET_ID = "1NtAYwQzfvG6FHHg-HrQrthOhf3020aDgGRf7n-11vKc";

const ALL_CLIENTS = [
  { id: "pfizer", name: "Pfizer México", industry: "Farmacéutica", color: "#4A90D9", initials: "PF", folderId: "1Z0iOscR22coaCxWLHNlGFMFUb6GLES69", searchQuery: "Pfizer México farmacéutica salud noticias", sectors: ["salud", "negocios", "general"] },
  { id: "prudence", name: "Condones Prudence", industry: "Salud Sexual", color: "#D62B7C", initials: "PR", folderId: "1VJyRHA5VHyb9Ea6-kK9Iob0ZzQpsiWu0", searchQuery: "salud sexual México condones planificación familiar noticias", sectors: ["salud", "estilo de vida", "general"] },
  { id: "soriana", name: "Organización Soriana", industry: "Retail", color: "#C8102E", initials: "SO", folderId: "1ExtUJGposXvT0tXZTyyWg_jfkRejQw2e", searchQuery: "Soriana retail supermercados México noticias", sectors: ["negocios", "estilo de vida", "general"] },
];

const ACTIONS = [
  { id: "comunicado", icon: "📋", label: "Comunicado de prensa", color: "#4ADE80", tipo: "comunicado", prompt: (c) => `Necesito redactar un comunicado de prensa para ${c.name}. Primero pregúntame qué información necesitas para redactarlo. Una vez que tengas todo y redactes el comunicado, al final sugiere a qué periodistas de la base enviarlo agrupado por sector con nombre, medio y correo.` },
  { id: "pitch", icon: "🎯", label: "Pitch para periodista", color: "#60A5FA", tipo: "pitch", prompt: (c) => `Necesito un pitch para un periodista sobre ${c.name}. Usa el contexto que tienes del cliente para personalizarlo.` },
  { id: "distribucion", icon: "📬", label: "Sugerir distribución", color: "#A78BFA", tipo: null, prompt: (c) => `El comunicado para ${c.name} está listo. Con base en la base de periodistas que tienes disponible, recomiéndame a quién enviarlo agrupado por sector con nombre, medio y correo.` },
  { id: "posts", icon: "📱", label: "Posts redes sociales", color: "#F472B6", tipo: null, prompt: (c) => `Quiero crear posts para redes sociales de ${c.name}. Usa el tono y mensajes clave del cliente.` },
  { id: "talking", icon: "🎤", label: "Talking points vocero", color: "#FBBF24", tipo: null, prompt: (c) => `Necesito preparar talking points para el vocero de ${c.name}. Usa el contexto del cliente para personalizar.` },
  { id: "crisis", icon: "⚠️", label: "Crisis statement", color: "#FB923C", tipo: null, prompt: (c) => `Necesito un crisis statement para ${c.name}. ¿Cuáles son los detalles de la situación?` },
];

// ── GEMINI ────────────────────────────────────────────────────────────────────
async function searchGemini(query) {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Eres un asistente de investigación para una agencia de relaciones públicas en México.\n\nBusca y resume las noticias y tendencias más recientes (últimas 2 semanas) sobre: ${query}\n\nResponde en español con este formato exacto:\nTENDENCIAS DEL SECTOR:\n[3-5 tendencias o noticias relevantes, una por línea, comenzando con •]\n\nOPORTUNIDADES DE PR:\n[2-3 oportunidades concretas de relaciones públicas basadas en estas tendencias, una por línea, comenzando con →]\n\nSé específico y conciso. Máximo 300 palabras en total.` }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.3 }
        })
      }
    );
    if (res.status === 429) { console.warn("Gemini rate limit"); return null; }
    if (!res.ok) { console.warn("Gemini error:", res.status); return null; }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) { console.warn("Gemini error:", e); return null; }
}

// ── SHEETS: inbox ─────────────────────────────────────────────────────────────
async function fetchInboxAlerts() {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${INBOX_SHEET_ID}/values/Inbox%20General?key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.toLowerCase());
    const iCliente = headers.indexOf("cliente");
    const iFecha = headers.indexOf("fecha");
    const iFuente = headers.indexOf("fuente");
    const iAsunto = headers.indexOf("asunto");
    const iResumen = headers.indexOf("resumen");
    const iTipo = headers.indexOf("tipo");
    return rows.slice(1).slice(-50).reverse().map(row => ({
      cliente: row[iCliente] || "",
      fecha: row[iFecha] || "",
      fuente: row[iFuente] || "",
      asunto: row[iAsunto] || "",
      resumen: row[iResumen] || "",
      tipo: row[iTipo] || "",
    }));
  } catch (e) { console.warn("Sheets fetch failed:", e); return []; }
}

// ── MEMORY: guardar en Sheets ─────────────────────────────────────────────────
async function saveToMemory(sheet, row) {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${MEMORY_SHEET_ID}/values/${encodeURIComponent(sheet)}:append?valueInputOption=USER_ENTERED&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] })
    });
    return res.ok;
  } catch (e) { console.warn("Memory save failed:", e); return false; }
}

// ── SHEETS: periodistas ───────────────────────────────────────────────────────
async function fetchJournalists(sectors) {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${JOURNALISTS_SHEET_ID}/values/Directorio?key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => (h || "").toLowerCase().trim());
    const iNombre = headers.indexOf("nombre");
    const iMedio = headers.indexOf("medio");
    const iCargo = headers.indexOf("cargo");
    const iSector = headers.indexOf("sector");
    const iBeat = headers.indexOf("beat");
    const iCorreo = headers.indexOf("correo");
    const iEstado = headers.indexOf("estado");
    const iNotas = headers.indexOf("notas");
    return rows.slice(1).filter(row => {
      if (!row[iNombre] || !row[iMedio]) return false;
      if ((row[iEstado] || "").toLowerCase() === "baja") return false;
      if (!sectors || sectors.length === 0) return true;
      const sector = (row[iSector] || "").toLowerCase();
      const beat = (row[iBeat] || "").toLowerCase();
      return sectors.some(s => sector.includes(s) || beat.includes(s));
    }).map(row => ({
      nombre: row[iNombre] || "",
      medio: row[iMedio] || "",
      cargo: row[iCargo] || "",
      sector: row[iSector] || "",
      correo: row[iCorreo] || "",
      notas: row[iNotas] || "",
    }));
  } catch (e) { console.warn("Journalists fetch failed:", e); return []; }
}

function formatJournalistsContext(journalists) {
  if (!journalists || journalists.length === 0) return "";
  const byMedio = {};
  journalists.forEach(j => {
    if (!byMedio[j.medio]) byMedio[j.medio] = [];
    byMedio[j.medio].push(j);
  });
  let ctx = `\n\nBASE DE PERIODISTAS RELEVANTES (${journalists.length} contactos):\n`;
  Object.entries(byMedio).slice(0, 30).forEach(([medio, js]) => {
    ctx += `\n${medio}:\n`;
    js.forEach(j => {
      ctx += `  · ${j.nombre} | ${j.cargo}`;
      if (j.correo) ctx += ` | ${j.correo}`;
      if (j.notas) ctx += ` | Nota: ${j.notas}`;
      ctx += "\n";
    });
  });
  return ctx;
}

// ── DRIVE ─────────────────────────────────────────────────────────────────────
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

function buildSystemPrompt(client, driveFiles, newsContext, journalists) {
  const fileSection = driveFiles.length > 0
    ? `\n\nARCHIVOS DEL CLIENTE EN DRIVE:\n` + driveFiles.map(f => `\n--- ${f.name} ---\n${f.content}`).join("\n")
    : "\n\n(No se encontraron archivos en Drive para este cliente aún.)";
  const newsSection = newsContext ? `\n\nCONTEXTO DE NOTICIAS Y TENDENCIAS DEL SECTOR:\n${newsContext}` : "";
  const journalistsSection = formatJournalistsContext(journalists || []);
  return `Eres Lupita, agente especializada en Relaciones Públicas para la agencia Neuma.\n\nCLIENTE ACTIVO: ${client.name}\nIndustria: ${client.industry}\n${fileSection}${newsSection}${journalistsSection}\n\nINSTRUCCIONES:\n- Siempre escribes en español\n- Usas la información de los archivos de Drive como base para todo el contenido\n- La BASE DE PERIODISTAS DE NEUMA siempre está disponible. Úsala directamente\n- Cuando sugieras distribución usa ÚNICAMENTE los periodistas de esa base\n- Nunca inventas información del cliente\n- Respetas regulaciones sanitarias (COFEPRIS, FDA, EMA) cuando aplica`;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function isGoogleAlert(fuente) { return (fuente || "").toLowerCase().includes("google"); }
function isSentiOne(fuente) { return (fuente || "").toLowerCase().includes("sentione") || (fuente || "").toLowerCase().includes("lupita"); }

function isRecent(fechaStr, horas = 6) {
  if (!fechaStr) return false;
  try {
    const fecha = new Date(fechaStr);
    const diff = (new Date() - fecha) / (1000 * 60 * 60);
    return diff <= horas;
  } catch { return false; }
}

function fuenteStyle(fuente) {
  if (isSentiOne(fuente)) return { bg: "rgba(251,191,36,0.1)", color: "#FBBF24", label: "SentiOne" };
  if (isGoogleAlert(fuente)) return { bg: "rgba(96,165,250,0.1)", color: "#60A5FA", label: "Google Alerts" };
  return { bg: "rgba(156,163,175,0.1)", color: "#9CA3AF", label: fuente || "—" };
}

function detectMemoryType(content) {
  const lower = content.toLowerCase();
  if (lower.includes("comunicado") || lower.includes("boletín")) return "comunicado";
  if (lower.includes("pitch")) return "pitch";
  if (lower.includes("cobertura") || lower.includes("nota publicada") || lower.includes("salió en")) return "cobertura";
  return null;
}

// ── MARKDOWN ──────────────────────────────────────────────────────────────────
function renderInline(text) {
  return text.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} style={{ color: "#E2E8F0", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 4, fontSize: 12, color: "#86EFAC" }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function renderMarkdown(text) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <div key={i} style={{ fontSize: 13, fontWeight: 700, color: "#86EFAC", margin: "10px 0 3px" }}>{line.slice(4)}</div>;
    if (line.startsWith("## ")) return <div key={i} style={{ fontSize: 14, fontWeight: 700, color: "#4ADE80", margin: "12px 0 4px" }}>{line.slice(3)}</div>;
    if (line.startsWith("# ")) return <div key={i} style={{ fontSize: 16, fontWeight: 700, color: "#4ADE80", margin: "14px 0 5px" }}>{line.slice(2)}</div>;
    if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("· ")) return <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 8, margin: "3px 0" }}><span style={{ color: "#4ADE80", flexShrink: 0 }}>·</span><span style={{ color: "#CBD5E1" }}>{renderInline(line.slice(2))}</span></div>;
    if (line.match(/^\d+\. /)) return <div key={i} style={{ color: "#CBD5E1", paddingLeft: 8, margin: "3px 0" }}>{renderInline(line)}</div>;
    if (line.startsWith("→ ")) return <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 8, margin: "3px 0" }}><span style={{ color: "#60A5FA", flexShrink: 0 }}>→</span><span style={{ color: "#CBD5E1" }}>{renderInline(line.slice(2))}</span></div>;
    if (line.startsWith("---")) return <hr key={i} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", margin: "10px 0" }} />;
    if (line.trim() === "") return <div key={i} style={{ height: 6 }} />;
    return <div key={i} style={{ color: "#CBD5E1", margin: "2px 0", lineHeight: 1.65 }}>{renderInline(line)}</div>;
  });
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "12px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 14, width: "fit-content", border: "1px solid rgba(255,255,255,0.06)" }}>
      {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", opacity: 0.6, animation: "lupBounce 1.2s infinite", animationDelay: `${i*0.18}s` }} />)}
    </div>
  );
}

// ── MEMORY SAVE BANNER ────────────────────────────────────────────────────────
function MemoryBanner({ type, clientName, content, onSave, onDismiss }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState("");

  const typeLabels = { comunicado: "📋 Comunicado", pitch: "🎯 Pitch", cobertura: "📰 Cobertura" };
  const typeSheets = { comunicado: "Campañas", pitch: "Pitches", cobertura: "Cobertura" };

  const handleSave = async () => {
    setSaving(true);
    const fecha = new Date().toLocaleDateString("es-MX");
    let row;
    if (type === "comunicado") row = [fecha, clientName, title || "Sin título", "Comunicado", "Borrador", content.slice(0, 200)];
    else if (type === "pitch") row = [fecha, clientName, "", "", title || "Sin título", "Enviado", content.slice(0, 200)];
    else row = [fecha, clientName, title || "Sin título", "", "", "", "", content.slice(0, 200)];
    const ok = await onSave(typeSheets[type], row);
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(onDismiss, 2000); }
  };

  if (saved) return (
    <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: "#4ADE80", fontSize: 16 }}>✓</span>
      <span style={{ fontSize: 13, color: "#4ADE80" }}>Guardado en Lupita Memory</span>
    </div>
  );

  return (
    <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: "#FBBF24", fontWeight: 600 }}>💾 ¿Guardar en Lupita Memory?</span>
        <span style={{ fontSize: 11, color: "#4B5563" }}>{typeLabels[type]} · {clientName}</span>
      </div>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={`Título del ${type}...`}
        style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", color: "#E2E8F0", fontSize: 12, marginBottom: 10, boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "#FBBF24", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
          {saving ? "Guardando..." : "💾 Guardar"}
        </button>
        <button onClick={onDismiss}
          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#4B5563", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
          No ahora
        </button>
      </div>
    </div>
  );
}

// ── REPORTE MATUTINO ──────────────────────────────────────────────────────────
function ReportScreen({ onGoToClient, clients }) {
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const fecha = new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    const load = async () => {
      setLoadingAlerts(true);
      const data = await fetchInboxAlerts();
      setAlerts(data);
      setLoadingAlerts(false);
    };
    load();
  }, []);

  const liveAlerts = alerts.filter(a => isGoogleAlert(a.fuente) && isRecent(a.fecha, 6));
  const hasAlerts = alerts.some(a => a.tipo === "alerta");

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px", animation: "lupIn 0.4s ease" }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "#1a4a1a", textTransform: "uppercase", marginBottom: 6 }}>Monitoreo · En tiempo real</p>
        <h1 style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 400, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Buenos días, <em style={{ color: "#4ADE80" }}>Neuma</em></h1>
        <p style={{ fontSize: 12, color: "#374151", margin: 0, textTransform: "capitalize" }}>{fecha}</p>
      </div>

      <div style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 14, padding: "16px 18px", marginBottom: 20, display: "flex", gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #14532D, #22C55E)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>✦</div>
        <div>
          <div style={{ fontSize: 11, color: "#4ADE80", fontWeight: 700, marginBottom: 4 }}>RESUMEN LUPITA</div>
          <div style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6 }}>
            {loadingAlerts ? "Cargando alertas..." : hasAlerts ? "Hay alertas activas hoy." : `Sin alertas críticas hoy. ${alerts.length} registros en monitoreo.`}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {clients.map(c => (
          <button key={c.id} onClick={() => onGoToClient(c.id)}
            style={{ background: `${c.color}12`, border: `1px solid ${c.color}33`, color: c.color, borderRadius: 10, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
            {c.initials} → {c.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {liveAlerts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", display: "inline-block", animation: "lupPulse 1.5s infinite" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#EF4444", letterSpacing: "0.05em" }}>EN VIVO</span>
            <span style={{ fontSize: 11, color: "#4B5563" }}>· Últimas 6 horas</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {liveAlerts.map((a, i) => (
              <div key={i} style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, padding: "12px 16px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(96,165,250,0.1)", color: "#60A5FA", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 }}>Google Alerts</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#E2E8F0", marginBottom: 4 }}>{a.asunto}</div>
                    {a.resumen && <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>{a.resumen.slice(0, 200)}</div>}
                  </div>
                  <span style={{ fontSize: 10, color: "#4B5563", flexShrink: 0 }}>{(a.fecha || "").slice(11, 16)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0" }}>Historial de alertas</span>
          <span style={{ fontSize: 11, color: "#4B5563", marginLeft: "auto" }}>{alerts.length} registros</span>
        </div>
        {loadingAlerts ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#4B5563", fontSize: 13 }}>Cargando...</div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#4B5563", fontSize: 13 }}>Sin alertas registradas aún.</div>
        ) : (
          alerts.map((a, i) => {
            const fs = fuenteStyle(a.fuente);
            const isExp = expanded === i;
            return (
              <div key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: a.resumen ? "pointer" : "default" }}
                onClick={() => a.resumen && setExpanded(isExp ? null : i)}>
                <div style={{ padding: "12px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 90 }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", background: fs.bg, color: fs.color, borderRadius: 20, whiteSpace: "nowrap" }}>{fs.label}</span>
                    <span style={{ fontSize: 10, color: "#4B5563" }}>{(a.fecha || "").slice(0, 10)}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#E2E8F0", marginBottom: 4 }}>{a.asunto}</div>
                    {a.resumen && <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>{isExp ? a.resumen : a.resumen.slice(0, 200) + (a.resumen.length > 200 ? "..." : "")}</div>}
                    {a.resumen && a.resumen.length > 200 && <div style={{ fontSize: 11, color: "#4ADE80", marginTop: 5 }}>{isExp ? "▲ Ver menos" : "▼ Ver más"}</div>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function LupitaApp() {
  const [authState, setAuthState] = useState("loading");
  const [currentUser, setCurrentUser] = useState(null);
  const [screen, setScreen] = useState("home");
  const [activeClient, setActiveClient] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveStatus, setDriveStatus] = useState("");
  const [newsContext, setNewsContext] = useState(null);
  const [journalists, setJournalists] = useState([]);
  const [journalistsStatus, setJournalistsStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [memoryBanner, setMemoryBanner] = useState(null);
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
      if (res.ok) { const user = await res.json(); setCurrentUser(user); setAuthState("authorized"); }
      else { const data = await res.json(); setAuthState(data.error === "user_not_authorized" ? "unauthorized" : "login"); }
    } catch { setAuthState("login"); }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout");
    setCurrentUser(null); setAuthState("login"); setScreen("home"); setShowUserMenu(false);
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
    setDriveStatus("Cargando Drive y noticias del sector..."); setMessages([]);
    setNewsContext(null); setJournalists([]); setJournalistsStatus("Cargando periodistas...");
    setMemoryBanner(null); setActiveAction(null);
    try {
      const [files, news, journalistsList] = await Promise.all([
        loadClientContext(client.folderId), searchGemini(client.searchQuery), fetchJournalists(client.sectors || [client.industry])
      ]);
      setDriveFiles(files); setNewsContext(news); setJournalists(journalistsList);
      setJournalistsStatus(`${journalistsList.length} periodistas relevantes`);
      setDriveStatus(files.length > 0 ? `${files.length} archivo${files.length > 1 ? "s" : ""} · ${news ? "🌐 Noticias cargadas" : "sin noticias"}` : `Sin archivos · ${news ? "🌐 Noticias cargadas" : ""}`);
      systemPromptRef.current = buildSystemPrompt(client, files, news, journalistsList);
      const fileNames = files.map(f => `· ${f.name}`).join("\n");
      const newsLine = news ? "\n\n🌐 **Noticias del sector cargadas** — tengo contexto de las tendencias más recientes." : "";
      setMessages([{ role: "assistant", content: files.length > 0 ? `¡Hola! Soy Lupita, lista para trabajar con **${client.name}**.\n\nHe leído **${files.length} archivo${files.length > 1 ? "s" : ""}** de Drive:\n${fileNames}${newsLine}\n\n¿Qué necesitas generar hoy?` : `¡Hola! Soy Lupita, lista para trabajar con **${client.name}**.${newsLine}\n\n¿Qué necesitas generar?` }]);
    } catch {
      setDriveStatus("Error al cargar contexto"); setJournalistsStatus("");
      setMessages([{ role: "assistant", content: `¡Hola! Soy Lupita, lista para trabajar con **${client.name}**.\n\n¿Qué necesitas generar?` }]);
    }
    setLoadingDrive(false);
  };

  const sendMessage = async (text, actionTipo = null) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");
    if (actionTipo) setActiveAction(actionTipo);
    const newMsgs = [...messages, { role: "user", content: userText }];
    setMessages(newMsgs); setLoading(true); setMemoryBanner(null);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, system: systemPromptRef.current, messages: newMsgs.map(m => ({ role: m.role, content: m.content })) }) });
      const data = await res.json();
      const reply = data.content?.map(b => b.text).join("") || "Error al obtener respuesta.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);

      // Detectar si se generó algo guardable
      const tipo = actionTipo || detectMemoryType(reply);
      if (tipo && (tipo === "comunicado" || tipo === "pitch") && reply.length > 200) {
        setTimeout(() => setMemoryBanner({ type: tipo, content: reply }), 500);
      }
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Error de conexión. Intenta de nuevo." }]); }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleMemorySave = async (sheet, row) => {
    return await saveToMemory(sheet, row);
  };

  const copyLast = () => {
    const last = [...messages].reverse().find(m => m.role === "assistant");
    if (last) { navigator.clipboard.writeText(last.content); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const refreshDrive = async () => {
    if (!activeClient) return;
    setLoadingDrive(true); setDriveStatus("Actualizando...");
    try {
      const [files, news, journalistsList] = await Promise.all([loadClientContext(activeClient.folderId), searchGemini(activeClient.searchQuery), fetchJournalists(activeClient.sectors || [activeClient.industry])]);
      setDriveFiles(files); setNewsContext(news); setJournalists(journalistsList);
      setJournalistsStatus(`${journalistsList.length} periodistas relevantes`);
      systemPromptRef.current = buildSystemPrompt(activeClient, files, news, journalistsList);
      setDriveStatus(`${files.length} archivo${files.length > 1 ? "s" : ""} · ${news ? "🌐 Noticias actualizadas" : "sin noticias"}`);
    } catch { setDriveStatus("Error al actualizar"); }
    setLoadingDrive(false);
  };

  const errorMessages = {
    domain_not_allowed: "Solo cuentas @neuma.mx pueden acceder.",
    user_not_authorized: "Tu cuenta no tiene permisos asignados. Contacta a la directora.",
    auth_failed: "Error de autenticación. Intenta de nuevo.",
    session_expired: "Tu sesión expiró. Inicia sesión nuevamente.",
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

  if (authState === "login") return (
    <div style={{ minHeight: "100vh", background: "#07090C", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif", padding: 20 }}>
      <style>{`@keyframes lupIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} } button:hover { opacity: 0.92; }`}</style>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center", animation: "lupIn 0.4s ease" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #052e16, #16A34A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 24px" }}>✦</div>
        <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "#1a4a1a", textTransform: "uppercase", marginBottom: 8 }}>Neuma · Agencia de RRPP</p>
        <h1 style={{ fontSize: 32, fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.02em", color: "#F0FDF4" }}>Bienvenida a <em style={{ color: "#4ADE80" }}>Lupita</em></h1>
        <p style={{ color: "#374151", fontSize: 14, margin: "0 0 36px", lineHeight: 1.7 }}>Tu agente de IA para Relaciones Públicas.<br />Inicia sesión con tu cuenta de Neuma.</p>
        {urlError && errorMessages[urlError] && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 16px", marginBottom: 20 }}>
            <p style={{ color: "#FCA5A5", fontSize: 13, margin: 0 }}>⚠ {errorMessages[urlError]}</p>
          </div>
        )}
        <button onClick={() => {
          const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: `${window.location.origin}/auth/callback`, response_type: "code", scope: "openid email profile", hd: "neuma.mx", access_type: "online", prompt: "select_account" });
          window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
        }} style={{ width: "100%", background: "#fff", border: "none", borderRadius: 12, padding: "14px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 15, fontWeight: 600, color: "#1a1a1a", transition: "all 0.2s", boxShadow: "0 2px 16px rgba(74,222,128,0.1)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Iniciar sesión con Google
        </button>
        <p style={{ fontSize: 11, color: "#1a3a1a", marginTop: 20, lineHeight: 1.6 }}>Solo cuentas <strong style={{ color: "#2a5a2a" }}>@neuma.mx</strong> tienen acceso.</p>
      </div>
    </div>
  );

  if (authState === "unauthorized") return (
    <div style={{ minHeight: "100vh", background: "#07090C", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif", padding: 20 }}>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: "#F0FDF4", fontWeight: 400, marginBottom: 8 }}>Acceso restringido</h2>
        <p style={{ color: "#374151", fontSize: 14, marginBottom: 24 }}>Tu cuenta <strong style={{ color: "#6B7280" }}>{currentUser?.email}</strong> no tiene permisos asignados.</p>
        <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 13 }}>Cerrar sesión</button>
      </div>
    </div>
  );

  const backAction = screen === "chat"
    ? () => { setScreen("home"); setMessages([]); setActiveClient(null); setDriveFiles([]); setNewsContext(null); setJournalists([]); setJournalistsStatus(""); setMemoryBanner(null); }
    : screen === "reporte" ? () => setScreen("home") : null;

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
        input:focus{outline:none;}
      `}</style>

      {/* HEADER */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          {backAction && <button onClick={backAction} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 10px", color: "#888", fontSize: 12, cursor: "pointer", marginRight: 4 }}>{screen === "chat" ? "← Clientes" : "← Inicio"}</button>}
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
              {journalistsStatus && <span style={{ fontSize: 10, color: journalists.length > 0 ? "#A78BFA" : "#4B5563", display: "flex", alignItems: "center", gap: 4 }}>👥 {journalistsStatus}</span>}
              {driveStatus && <span style={{ fontSize: 10, color: loadingDrive ? "#FBBF24" : "#4ADE80", display: "flex", alignItems: "center", gap: 5 }}>{loadingDrive ? <span style={{ display: "inline-block", width: 8, height: 8, border: "1.5px solid #FBBF24", borderTopColor: "transparent", borderRadius: "50%", animation: "lupSpin 0.7s linear infinite" }} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />}{driveStatus}</span>}
              <button onClick={refreshDrive} disabled={loadingDrive} style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", color: "#4ADE80", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer" }}>↻ Drive</button>
              <button onClick={copyLast} style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.18)", color: "#4ADE80", borderRadius: 8, padding: "5px 13px", fontSize: 11, cursor: "pointer" }}>{copied ? "✓ Copiado" : "📋 Copiar"}</button>
              <button onClick={() => { setMessages([{ role: "assistant", content: `¡Listo para seguir con **${activeClient.name}**! ¿Qué necesitas ahora?` }]); setMemoryBanner(null); }} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#666", borderRadius: 8, padding: "5px 13px", fontSize: 11, cursor: "pointer" }}>Nueva conv.</button>
            </>
          )}
          {screen === "home" && canSeeReport && (
            <button onClick={() => setScreen("reporte")} style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#FBBF24", borderRadius: 10, padding: "7px 14px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FBBF24", display: "inline-block", animation: "lupPulse 2s infinite" }} />
              📊 Reporte de hoy
            </button>
          )}
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
                <button onClick={handleLogout} style={{ width: "100%", background: "transparent", border: "none", color: "#F87171", fontSize: 12, padding: "8px 12px", cursor: "pointer", textAlign: "left", borderRadius: 8 }}>→ Cerrar sesión</button>
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
          <p style={{ color: "#374151", fontSize: 13, margin: "0 0 8px", lineHeight: 1.7 }}>Selecciona el cliente y Lupita leerá automáticamente sus archivos de Drive y las noticias más recientes del sector.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 32, fontSize: 11, color: "#1a4a1a" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />
            Conectada a Google Drive · Gemini · {CLIENTS.length} cliente{CLIENTS.length !== 1 ? "s" : ""} asignado{CLIENTS.length !== 1 ? "s" : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 40 }}>
            {CLIENTS.map((client, i) => (
              <button key={client.id} onClick={() => startChat(client)}
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "18px 20px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 16, transition: "all 0.2s", animation: `lupIn 0.4s ease ${i * 0.07}s both` }}
                onMouseEnter={e => { e.currentTarget.style.background = `${client.color}10`; e.currentTarget.style.borderColor = `${client.color}40`; e.currentTarget.style.transform = "translateX(4px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: client.color + "18", border: `1.5px solid ${client.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: client.color, flexShrink: 0 }}>{client.initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#E2E8F0", marginBottom: 2 }}>{client.name}</div>
                  <div style={{ fontSize: 12, color: "#4B5563" }}>{client.industry}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#2a4a2a" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block", opacity: 0.6 }} />Drive + Gemini
                </div>
                <span style={{ color: "#2D3748", fontSize: 16, marginLeft: 4 }}>→</span>
              </button>
            ))}
          </div>
          {currentUser?.role === "directora" && (
            <div style={{ border: "1.5px dashed rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#2D3748", flexShrink: 0 }}>+</div>
              <div>
                <div style={{ fontSize: 13, color: "#374151", marginBottom: 2 }}>Agregar nuevo cliente o usuario</div>
                <div style={{ fontSize: 11, color: "#1F2937" }}>Edita App.jsx + src/users.js en GitHub</div>
              </div>
            </div>
          )}
        </div>
      )}

      {screen === "reporte" && <ReportScreen onGoToClient={goToClient} clients={CLIENTS} />}

      {/* CHAT */}
      {screen === "chat" && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
          {(driveFiles.length > 0 || newsContext) && (
            <div style={{ padding: "8px 0 6px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#2a4a2a", marginRight: 2 }}>📂</span>
              {driveFiles.map((f, i) => <span key={i} style={{ fontSize: 10, padding: "2px 8px", background: activeClient.color + "0F", border: `1px solid ${activeClient.color}22`, borderRadius: 20, color: activeClient.color }}>{f.name}</span>)}
              {newsContext && <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 20, color: "#818CF8" }}>🌐 Noticias del sector</span>}
              {journalists.length > 0 && <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 20, color: "#A78BFA" }}>👥 {journalists.length} periodistas</span>}
            </div>
          )}
          {loadingDrive && messages.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, flexDirection: "column", gap: 12 }}>
              <div style={{ width: 32, height: 32, border: "2px solid #4ADE80", borderTopColor: "transparent", borderRadius: "50%", animation: "lupSpin 0.8s linear infinite" }} />
              <div style={{ fontSize: 13, color: "#2a4a2a" }}>Cargando Drive y noticias del sector...</div>
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

          {/* Memory Banner */}
          {memoryBanner && !loading && (
            <MemoryBanner
              type={memoryBanner.type}
              clientName={activeClient?.name}
              content={memoryBanner.content}
              onSave={handleMemorySave}
              onDismiss={() => setMemoryBanner(null)}
            />
          )}

          {!loading && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 8 }}>
              {ACTIONS.map(a => (
                <button key={a.id} onClick={() => sendMessage(a.prompt(activeClient), a.tipo)}
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "5px 12px", fontSize: 11, color: "#4B5563", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.color = a.color; e.currentTarget.style.borderColor = a.color + "44"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#4B5563"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                >{a.icon} {a.label}</button>
              ))}
            </div>
          )}
          <div style={{ paddingBottom: 20 }}>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-end", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 15, padding: "11px 13px", transition: "border-color 0.2s" }}
              onFocusCapture={e => e.currentTarget.style.borderColor = "rgba(74,222,128,0.3)"}
              onBlurCapture={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={`Pídele algo a Lupita sobre ${activeClient?.name}…`}
                rows={2} style={{ flex: 1, background: "transparent", border: "none", color: "#E2E8F0", fontSize: 13.5, lineHeight: 1.6, fontFamily: "inherit" }} />
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, border: "none", cursor: input.trim() && !loading ? "pointer" : "default", background: input.trim() && !loading ? "linear-gradient(135deg, #15803D, #4ADE80)" : "rgba(255,255,255,0.04)", color: input.trim() && !loading ? "#fff" : "#2D3748", fontSize: 15, transition: "all 0.2s" }}>↑</button>
            </div>
            <p style={{ fontSize: 10, color: "#1a2a1a", textAlign: "center", marginTop: 7 }}>Enter para enviar · Shift+Enter para nueva línea</p>
          </div>
        </div>
      )}
    </div>
  );
}
