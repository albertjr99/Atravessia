import React, { useId } from 'react';

// Seletor sem rolagem lateral (equivalente a oamorqueefica/src/components/SeletorOpcoes.js).
//  · até `limite` opções (padrão 4) → pílulas que quebram linha;
//  · mais que isso → lista suspensa (<select> nativo, acessível no teclado e no leitor de tela).
// Props:
//   opcoes   [{ id, label, icone? }]  (icone = elemento React opcional, só nas pílulas)
//   valor    id selecionado
//   onChange (id) => void
//   titulo   rótulo da lista (fica visível ao lado do select e serve de aria-label)
//   variante 'abas' (trilho de vidro das sub-abas) | 'chips' (filtros, padrão)
//   limite, className
export default function SeletorOpcoes({
  opcoes = [], valor, onChange, titulo = 'Escolher', variante = 'chips', limite = 4, className = '',
}) {
  const idSelect = useId();
  if (!opcoes.length) return null;
  const atual = opcoes.find(o => o.id === valor) || opcoes[0];
  const escolher = (id) => { if (id !== valor) onChange?.(id); };

  if (opcoes.length <= limite) {
    const abas = variante === 'abas';
    return (
      <div className={`${abas ? 'subtabs' : 'chip-row sel-chips'} ${className}`} role="tablist" aria-label={titulo}>
        {opcoes.map(o => {
          const sel = o.id === atual.id;
          const classe = abas ? `subtab ${sel ? 'active' : ''}` : `chip ${sel ? 'chip-active' : ''}`;
          return (
            <button key={String(o.id)} type="button" role="tab" aria-selected={sel} className={classe} onClick={() => escolher(o.id)}>
              {o.icone}{o.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`sel-lista ${variante === 'abas' ? 'sel-lista-abas' : ''} ${className}`}>
      <label htmlFor={idSelect} className="sel-lista-rotulo">{titulo}</label>
      <div className="sel-lista-caixa">
        <select
          id={idSelect}
          value={String(atual.id)}
          onChange={(e) => {
            const o = opcoes.find(x => String(x.id) === e.target.value);
            if (o) escolher(o.id);
          }}
        >
          {opcoes.map(o => <option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}
        </select>
        <svg className="sel-lista-seta" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
