import React from 'react';
import { blocosTermo, trechosTermo } from './termoProfissional';

// Markdown simples do termo do profissional (## títulos, parágrafos, listas
// "- " e **negrito**), desenhado só com elementos React: nenhum HTML do texto
// é interpretado. Usado no portal (profissional.html) e na prévia do painel.

export function Trechos({ texto }) {
  return trechosTermo(texto).map((p, i) => (p.negrito ? <strong key={i}>{p.texto}</strong> : <React.Fragment key={i}>{p.texto}</React.Fragment>));
}

export default function TextoTermo({ texto }) {
  return blocosTermo(texto).map((b, i) => {
    if (b.tipo === 'titulo') return <h3 key={i}><Trechos texto={b.texto} /></h3>;
    if (b.tipo === 'lista') return <ul key={i}>{b.itens.map((t, j) => <li key={j}><Trechos texto={t} /></li>)}</ul>;
    return <p key={i}><Trechos texto={b.texto} /></p>;
  });
}
