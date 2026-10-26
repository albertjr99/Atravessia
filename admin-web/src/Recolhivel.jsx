import React, { useId, useState } from 'react';

// Cartão que abre e fecha pelo cabeçalho, com setinha à direita. Fechado por
// padrão; usado nos cartões com formulário ou muito texto do painel.
// Props: titulo, subtitulo?, icone? (elemento), inicialAberto=false,
// aberto/onAlternar (modo controlado), direita? (elemento extra), className?, children.
export default function Recolhivel({
  titulo, subtitulo, icone, inicialAberto = false, aberto: abertoControlado, onAlternar,
  direita, className = '', children,
}) {
  const [abertoInterno, setAbertoInterno] = useState(inicialAberto);
  const aberto = abertoControlado ?? abertoInterno;
  const id = useId();
  const alternar = () => {
    onAlternar?.(!aberto);
    if (abertoControlado == null) setAbertoInterno(!aberto);
  };
  return (
    <section className={`card recolhivel ${aberto ? 'recolhivel-aberto' : ''} ${className}`}>
      <div className="recolhivel-cab">
        <button type="button" className="recolhivel-botao" onClick={alternar}
          aria-expanded={aberto} aria-controls={id}>
          {icone && <span className="recolhivel-icone">{icone}</span>}
          <span className="recolhivel-textos">
            <span className="recolhivel-titulo">{titulo}</span>
            {subtitulo && <span className="recolhivel-sub">{subtitulo}</span>}
          </span>
          <span className="recolhivel-seta" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </span>
        </button>
        {direita && <div className="recolhivel-direita">{direita}</div>}
      </div>
      {aberto && <div className="recolhivel-corpo" id={id}>{children}</div>}
    </section>
  );
}
