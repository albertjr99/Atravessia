import './tokens.css'
import './cursos.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import PortalProfissional from './PortalProfissional.jsx'

// Portal do profissional: profissional.html?t=<token> (sem login).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PortalProfissional />
  </React.StrictMode>,
)
