import './tokens.css'
import './App.css'
import './alinhamento.css'
import './imobiliarias.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import PortalImobiliaria from './PortalImobiliaria.jsx'

// Portal da imobiliária parceira: imobiliaria.html?t=<token> (sem login).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PortalImobiliaria />
  </React.StrictMode>,
)
