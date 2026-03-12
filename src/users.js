// src/users.js
// ─────────────────────────────────────────────────────────
// TABLA DE PERMISOS DE LUPITA · NEUMA AGENCIA
// ─────────────────────────────────────────────────────────
//
// Para agregar un usuario:
//   "correo@neuma.mx": { role: "account", clients: ["pfizer"] }
//
// Para dar acceso a todos los clientes:
//   clients: ["*"]
//
// Roles disponibles:
//   "directora"  → ve todo, sin restricciones
//   "account"    → solo ve sus clientes asignados
//
// Para revocar acceso: elimina o comenta la línea del usuario
// ─────────────────────────────────────────────────────────

export const USERS = {

  // ── DIRECCIÓN ──────────────────────────────────────────
  "victor.paredes@neuma.mx": {
    role: "directora",
    name: "Victor Paredes",
    clients: ["*"],
  },

    "eliparedes@neuma.mx": {
    role: "directora",
    name: "Eli Paredes",
    clients: ["*"],
  },

  // ── ACCOUNTS ───────────────────────────────────────────
  "anapaola@neuma.mx": {
    role: "account",
    name: "Ana Paola",
    clients: ["soriana"],
  },

  "fernando@neuma.mx": {
    role: "account",
    name: "Fernando",
    clients: ["pfizer"],
  },

  "silvia@neuma.mx": {
    role: "account",
    name: "Silvia",
    clients: ["prudence"],
  },

};
