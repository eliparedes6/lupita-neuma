import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

4. Clic en **"Commit changes"**

---

### Último archivo — `src/App.jsx`

Este es el cerebro de Lupita. Es largo pero solo tienes que copiarlo completo.

1. Clic en **"Add file"** → **"Create new file"**
2. Nombre: `src/App.jsx`
3. Copia y pega **todo** el código de la app que construimos (el que está en el artifact de arriba — el bloque largo con `export default function LupitaApp`)
4. Clic en **"Commit changes"**

---

Cuando tengas los 5 archivos creados dímelo. Deberías ver en tu repositorio:
```
lupita-neuma/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    └── App.jsx
