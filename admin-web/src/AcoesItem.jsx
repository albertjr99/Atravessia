import React from 'react';
import { IconEdit, IconTrash } from './Icons';

// Rodapé de ações de um item de lista do painel: "Editar" (botão com rótulo)
// à esquerda e "Apagar" menor, em vermelho, afastado à direita, separados por
// uma linha. Áreas de clique ≥ 44px. A confirmação ao apagar fica com a tela.
// `children` entra entre os dois (ex.: ativar/ocultar, duplicar).
export default function AcoesItem({ onEditar, onApagar, rotuloEditar = 'Editar', rotuloApagar = 'Apagar', children, className = '' }) {
  return (
    <div className={`acoes-item ${className}`}>
      {onEditar && (
        <button type="button" className="acoes-item-editar" onClick={onEditar}>
          <IconEdit size={15} /> {rotuloEditar}
        </button>
      )}
      {children}
      <span className="acoes-item-espaco" />
      {onApagar && (
        <button type="button" className="acoes-item-apagar" onClick={onApagar}>
          <IconTrash size={14} /> {rotuloApagar}
        </button>
      )}
    </div>
  );
}
