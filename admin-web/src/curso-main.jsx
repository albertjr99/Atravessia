import './tokens.css'
import './cursos.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import CursoAluna from './CursoAluna.jsx'

// Área web da aluna: curso.html (login com a mesma conta do app).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CursoAluna />
  </React.StrictMode>,
)
