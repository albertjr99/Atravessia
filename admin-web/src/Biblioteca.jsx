import React, { useState } from 'react';
import Frases from './Frases';
import Conteudos from './Conteudos';
import Audios from './Audios';
import Parcerias from './Parcerias';

const TABS = [
  { id: 'frases',    label: 'Frases',          Componente: Frases },
  { id: 'conteudos', label: 'Conteúdos',       Componente: Conteudos },
  { id: 'audios',    label: 'Áudios Check-in', Componente: Audios },
  { id: 'parcerias', label: 'Parcerias',       Componente: Parcerias },
];

export default function Biblioteca({ showToast }) {
  const [aba, setAba] = useState('frases');
  const Atual = (TABS.find(t => t.id === aba) || TABS[0]).Componente;

  return (
    <>
      <div className="subtabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`subtab ${aba === t.id ? 'active' : ''}`}
            onClick={() => setAba(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Atual showToast={showToast} />
    </>
  );
}
