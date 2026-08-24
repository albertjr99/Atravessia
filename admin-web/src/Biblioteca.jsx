import React, { useState } from 'react';
import Frases from './Frases';
import Conteudos from './Conteudos';
import Audios from './Audios';

const TABS = [
  { id: 'frases',    label: '💬 Frases' },
  { id: 'conteudos', label: '📚 Conteúdos' },
  { id: 'audios',    label: '🎵 Áudios Check-in' },
];

export default function Biblioteca({ showToast }) {
  const [aba, setAba] = useState('frases');

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--bg, #FAF7F3)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px 0',
      }}>
        <h1 style={{
          margin: '0 0 14px',
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text-dark)',
        }}>
          📖 Biblioteca
        </h1>
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              style={{
                padding: '10px 18px',
                border: 'none',
                borderBottom: aba === t.id
                  ? '2px solid var(--primary, #8B7AC0)'
                  : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: aba === t.id ? 700 : 400,
                color: aba === t.id ? 'var(--primary, #8B7AC0)' : 'var(--text-mid)',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {aba === 'frases'    && <Frases    showToast={showToast} />}
      {aba === 'conteudos' && <Conteudos showToast={showToast} />}
      {aba === 'audios'    && <Audios    showToast={showToast} />}
    </>
  );
}
