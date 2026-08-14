import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';

function useCollection(col, q) {
  const [data, setData] = useState([]);
  useEffect(() => {
    const ref = q ? query(collection(db, col), ...q) : collection(db, col);
    return onSnapshot(ref, snap => setData(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
  }, [col]);
  return data;
}

function PhoneShell({ children }) {
  return (
    <div className="phone-wrap">
      <div className="phone-frame">
        <div className="phone-notch">
          <div className="phone-notch-pill" />
        </div>
        <div className="phone-screen">{children}</div>
        <div className="phone-home-bar">
          <div className="phone-home-pill" />
        </div>
      </div>
    </div>
  );
}

function TravessiaPreview() {
  const itens = useCollection('travessiaItens', [orderBy('ordem', 'asc'), limit(5)]);
  const TIPO_ICON = { link: '🔗', whatsapp: '💬', video: '▶️', audio: '🎵' };

  return (
    <PhoneShell>
      <div className="p-statusbar"><span>9:41</span><span>⚡</span></div>
      <div className="p-topbar">
        <div className="p-topbar-title">🧭 Continue a Travessia</div>
        <div className="p-topbar-sub">Recursos do seu percurso</div>
      </div>
      {itens.length === 0 ? (
        <div className="p-empty"><div className="p-empty-icon">🧭</div>Nenhum item ainda</div>
      ) : (
        <div className="p-list">
          {itens.filter(i => i.ativo !== false).map(item => (
            <div key={item.id} className="p-card">
              <div className="p-card-icon">{TIPO_ICON[item.tipo] || '🔗'}</div>
              <div className="p-card-body">
                <div className="p-card-title">{item.titulo}</div>
                {item.descricao && <div className="p-card-sub">{item.descricao}</div>}
                <div className="p-card-url">{item.url}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PhoneShell>
  );
}

function FrasesPreview() {
  const frases = useCollection('frases', [orderBy('criadoEm', 'asc'), limit(10)]);
  const ativas = frases.filter(f => f.ativa !== false);
  const frase = ativas[Math.floor(Math.random() * Math.max(1, ativas.length - 1))] || ativas[0];

  return (
    <PhoneShell>
      <div className="p-statusbar"><span>9:41</span><span>⚡</span></div>
      <div className="p-topbar">
        <div className="p-topbar-title">💬 Frase do dia</div>
      </div>
      {!frase ? (
        <div className="p-empty"><div className="p-empty-icon">💬</div>Nenhuma frase ativa</div>
      ) : (
        <div className="p-quote-wrap">
          <div className="p-quote-card">
            <div className="p-quote-text">"{frase.texto}"</div>
            {frase.autor && <div className="p-quote-author">— {frase.autor}</div>}
          </div>
          {frase.reflexao && (
            <div className="p-reflexao-card">
              <div className="p-reflexao-label">Reflexão do dia</div>
              <div className="p-reflexao-text">{frase.reflexao}</div>
            </div>
          )}
        </div>
      )}
    </PhoneShell>
  );
}

function ConteudosPreview() {
  const itens = useCollection('conteudos', [orderBy('criadoEm', 'desc'), limit(5)]);
  const TIPO_ICON = { audio: '🎧', video: '▶️', documento: '📄', link: '🔗' };

  return (
    <PhoneShell>
      <div className="p-statusbar"><span>9:41</span><span>⚡</span></div>
      <div className="p-topbar">
        <div className="p-topbar-title">📚 Conteúdos</div>
      </div>
      {itens.length === 0 ? (
        <div className="p-empty"><div className="p-empty-icon">📚</div>Nenhum conteúdo ainda</div>
      ) : (
        <div className="p-list">
          {itens.filter(i => i.ativo !== false).map(item => (
            <div key={item.id} className="p-card">
              <div className="p-card-icon">{TIPO_ICON[item.tipo] || '📄'}</div>
              <div className="p-card-body">
                <div className="p-card-title">{item.titulo}</div>
                {item.descricao && <div className="p-card-sub">{item.descricao}</div>}
                <span className="p-card-badge">{item.grupo || item.tipo}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PhoneShell>
  );
}

const EMOCAO_LABEL = {
  triste: 'Triste', saudade: 'Saudade', sozinho: 'Sozinho',
  medo: 'Medo', ansioso: 'Ansioso', culpado: 'Culpado',
  raiva: 'Raiva', desanimado: 'Desanimado', confuso: 'Confuso',
};

function AudiosPreview() {
  const audios = useCollection('audiosAcolhimento', [orderBy('criadoEm', 'desc'), limit(5)]);

  return (
    <PhoneShell>
      <div className="p-statusbar"><span>9:41</span><span>⚡</span></div>
      <div className="p-topbar">
        <div className="p-topbar-title">🎵 Áudios de Acolhimento</div>
        <div className="p-topbar-sub">Como você está se sentindo hoje?</div>
      </div>
      {audios.length === 0 ? (
        <div className="p-empty"><div className="p-empty-icon">🎵</div>Nenhum áudio ainda</div>
      ) : (
        <div style={{ paddingTop: 8 }}>
          {audios.filter(a => a.ativo !== false).map(item => (
            <div key={item.id} className="p-audio-card">
              <div className="p-audio-play">▶</div>
              <div className="p-audio-info">
                <div className="p-audio-title">{item.titulo}</div>
                <div className="p-audio-emocao">
                  {item.emocoes?.slice(0, 2).map(e => EMOCAO_LABEL[e] || e).join(' · ')}
                  {item.duracao && ` · ${item.duracao}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PhoneShell>
  );
}

function VitoriasPreview() {
  const opcoes = useCollection('vitoriasOpcoes', [orderBy('criadoEm', 'asc'), limit(6)]);

  return (
    <PhoneShell>
      <div className="p-statusbar"><span>9:41</span><span>⚡</span></div>
      <div className="p-topbar">
        <div className="p-topbar-title">⭐ Vitórias de hoje</div>
        <div className="p-topbar-sub">O que você conquistou?</div>
      </div>
      {opcoes.length === 0 ? (
        <div className="p-empty"><div className="p-empty-icon">⭐</div>Nenhuma vitória ainda</div>
      ) : (
        <div className="p-section">
          {opcoes.filter(o => o.ativo !== false).map(item => (
            <div key={item.id} className="p-vitoria-item">
              <span className="p-vitoria-check">{item.emoji || '⭐'}</span>
              <span className="p-vitoria-text">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </PhoneShell>
  );
}

function UsuariasPreview() {
  const usuarios = useCollection('usuarios', [orderBy('criadoEm', 'desc'), limit(5)]);

  return (
    <PhoneShell>
      <div className="p-statusbar"><span>9:41</span><span>⚡</span></div>
      <div className="p-topbar">
        <div className="p-topbar-title">👥 Usuárias</div>
        <div className="p-topbar-sub">{usuarios.length} cadastradas</div>
      </div>
      <div className="p-section">
        {usuarios.map(u => (
          <div key={u.id} className="p-user-item">
            <div className="p-user-avatar">{(u.nome || u.email || 'U')[0].toUpperCase()}</div>
            <div>
              <div className="p-user-name">{u.nome || '(sem nome)'}</div>
              <div className="p-user-plano">{u.plano || 'perceber'}</div>
            </div>
          </div>
        ))}
        {usuarios.length === 0 && <div className="p-empty">Nenhuma usuária</div>}
      </div>
    </PhoneShell>
  );
}

function DashboardPreview() {
  const usuarios = useCollection('usuarios', [limit(1)]);
  const checkins = useCollection('checkins', [limit(1)]);
  const frases = useCollection('frases', [limit(1)]);

  return (
    <PhoneShell>
      <div className="p-statusbar"><span>9:41</span><span>⚡</span></div>
      <div className="p-home-hero">
        <div className="p-home-greeting">Bem-vinda de volta</div>
        <div className="p-home-name">Atravessia 🌸</div>
        <div className="p-home-tag">Seu espaço de acolhimento</div>
      </div>
      <div className="p-stat-row">
        <div className="p-stat-box"><div className="p-stat-val">{usuarios.length > 0 ? '✓' : '0'}</div><div className="p-stat-label">Usuárias</div></div>
        <div className="p-stat-box"><div className="p-stat-val">{checkins.length > 0 ? '✓' : '0'}</div><div className="p-stat-label">Check-ins</div></div>
        <div className="p-stat-box"><div className="p-stat-val">{frases.length > 0 ? '✓' : '0'}</div><div className="p-stat-label">Frases</div></div>
      </div>
      <div className="p-section">
        <div className="p-section-title">Seções disponíveis</div>
        {['🎵 Check-in', '💬 Frase do dia', '🧭 Travessia', '⭐ Vitórias'].map(s => (
          <div key={s} className="p-vitoria-item" style={{ marginBottom: 5 }}>
            <span style={{ fontSize: 11 }}>{s}</span>
          </div>
        ))}
      </div>
    </PhoneShell>
  );
}

const SCREEN_MAP = {
  travessia: TravessiaPreview,
  frases: FrasesPreview,
  conteudos: ConteudosPreview,
  audios: AudiosPreview,
  vitorias: VitoriasPreview,
  usuarias: UsuariasPreview,
  dashboard: DashboardPreview,
};

const SCREEN_LABEL = {
  dashboard: 'Dashboard', travessia: 'Travessia', frases: 'Frases',
  conteudos: 'Conteúdos', audios: 'Áudios', vitorias: 'Vitórias',
  usuarias: 'Usuárias', notificacoes: 'Notificações',
};

export default function Preview({ currentScreen }) {
  const PreviewComponent = SCREEN_MAP[currentScreen] || DashboardPreview;

  return (
    <>
      <div className="preview-header">
        <div className="preview-title">🔍 Pré-visualização</div>
        <div className="preview-sub">Como aparece no app · {SCREEN_LABEL[currentScreen] || 'Tela'}</div>
      </div>
      <PreviewComponent />
    </>
  );
}
