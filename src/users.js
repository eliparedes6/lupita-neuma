// src/users.js
// ─────────────────────────────────────────────────────────
// TABLA DE PERMISOS DE LUPITA · NEUMA AGENCIA
// ─────────────────────────────────────────────────────────
//
// Para agregar un usuario:
//   "correo@neumaagencia.com": { role: "account", clients: ["pfizer"] }
//
// Para dar acceso a todos los clientes:
//   clients: ["*"]
//
// Roles disponibles:
//   "directora"  → ve todo, sin restricciones
//   "account"    → solo ve sus clientes asignados
//   "junior"     → solo ve sus clientes asignados (sin reporte matutino)
//
// Para revocar acceso: elimina o comenta la línea del usuario
// ─────────────────────────────────────────────────────────

export const USERS = {

  // ── DIRECCIÓN ──────────────────────────────────────────
  "direccion@neumaagencia.com": {
    role: "directora",
    name: "Directora",
    clients: ["*"], // acceso total
  },

  // ── ACCOUNTS ───────────────────────────────────────────
  "ana.lopez@neumaagencia.com": {
    role: "account",
    name: "Ana López",
    clients: ["pfizer", "prudence"],
  },

  "pedro.martinez@neumaagencia.com": {
    role: "account",
    name: "Pedro Martínez",
    clients: ["soriana", "pfizer"],
  },

  // ── EJEMPLO: account con un solo cliente ───────────────
  // "maria.garcia@neumaagencia.com": {
  //   role: "account",
  //   name: "María García",
  //   clients: ["soriana"],
  // },

  // ── EJEMPLO: junior sin reporte matutino ───────────────
  // "junior@neumaagencia.com": {
  //   role: "junior",
  //   name: "Junior",
  //   clients: ["prudence"],
  // },

};
