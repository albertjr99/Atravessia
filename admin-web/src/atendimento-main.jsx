import './tokens.css'
import './cursos.css'
import './atendimento.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import AtendimentoConvite from './AtendimentoConvite.jsx'

// Convite do atendimento online: atendimento.html?c=<token>.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AtendimentoConvite />
  </React.StrictMode>,
)
