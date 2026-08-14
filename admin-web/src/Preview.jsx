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

// ── Bottom nav tabs (matches actual HomeScreen.js) ────────────────────────────

const NAV_TABS = [
  { label: 'Início',     icon: '⌂',  activeFor: ['dashboard', 'frases', 'travessia', 'notificacoes'] },
  { label: 'Conteúdos', icon: '🎧', activeFor: ['conteudos', 'audios'] },
  { label: 'Vitórias',  icon: '⭐', activeFor: ['vitorias'] },
  { label: 'Relatórios',icon: '📊', activeFor: [] },
  { label: 'Planos',    icon: '💎', activeFor: ['usuarias'] },
];

// ── Phone shell ───────────────────────────────────────────────────────────────

function PhoneShell({ children, currentScreen }) {
  return (
    <div className="ph-phone">
      <div className="ph-notch" />
      <div className="ph-statusbar">
        <span className="ph-time">9:41</span>
        <span className="ph-icons">▰▰▰</span>
      </div>
      <div className="ph-appbar">Atravessia</div>
      <div className="ph-screen">{children}</div>
      <div className="ph-bottomnav">
        {NAV_TABS.map(tab => {
          const active = tab.activeFor.includes(currentScreen);
          return (
            <div key={tab.label} className={`ph-navtab${active ? ' ph-navtab-active' : ''}`}>
              <span className="ph-navtab-icon">{tab.icon}</span>
              <span className="ph-navtab-label">{tab.label}</span>
            </div>
          );
        })}
      </div>
      <div className="ph-homebar" />
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }) {
  return (
    <div className="pw-section-header">
      <span className="pw-section-icon">{icon}</span>
      <span className="pw-section-title">{title}</span>
    </div>
  );
}

// ── Row card (travessia, conteudos) ───────────────────────────────────────────

function RowCard({ icon, title, sub }) {
  return (
    <div className="pw-row">
      <div className="pw-row-icon">{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pw-row-title">{title}</div>
        {sub && <div className="pw-row-sub">{sub}</div>}
      </div>
      <span className="pw-row-chevron">›</span>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty({ msg }) {
  return <div className="pw-empty">{msg}</div>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Preview components — one per admin screen
// ──────────────────────────────────────────────────────────────────────────────

function TravessiaPreview() {
  const itens = useCollection('travessiaItens', [orderBy('ordem', 'asc'), limit(6)]);
  const TIPO_ICON = { link: '🔗', whatsapp: '💬', video: '▶', audio: '🎵' };

  return (
    <div className="pw-section">
      <SectionHeader icon="🧭" title="Continue a Travessia" />
      {itens.filter(i => i.ativo !== false).length === 0
        ? <Empty msg="Nenhum item ativo ainda" />
        : itens.filter(i => i.ativo !== false).map(item => (
          <RowCard
            key={item.id}
            icon={TIPO_ICON[item.tipo] || '🔗'}
            title={item.titulo}
            sub={item.descricao}
          />
        ))
      }
    </div>
  );
}

function FrasesPreview() {
  const frases = useCollection('frases', [orderBy('criadoEm', 'desc'), limit(1)]);
  const frase = frases[0];

  return (
    <div>
      <div className="pw-home-header">
        <div className="pw-home-greet">Olá, Carla ✨</div>
        <div className="pw-home-sub">Como você está hoje?</div>
      </div>
      {frase ? (
        <div className="pw-frase-card">
          <div className="pw-frase-label">FRASE DO DIA</div>
          <div className="pw-frase-texto">"{frase.texto}"</div>
          {frase.autor && <div className="pw-frase-autor">— {frase.autor}</div>}
        </div>
      ) : (
        <div className="pw-frase-card">
          <div className="pw-frase-label">FRASE DO DIA</div>
          <div className="pw-frase-texto">"Cada dia traz uma nova chance de cuidar de si."</div>
        </div>
      )}
      {frase?.reflexao && (
        <div className="pw-reflexao-card">
          <div className="pw-frase-label">REFLEXÃO</div>
          <div className="pw-reflexao-texto">{frase.reflexao}</div>
        </div>
      )}
    </div>
  );
}

function ConteudosPreview() {
  const itens = useCollection('conteudos', [orderBy('criadoEm', 'desc'), limit(6)]);
  const TIPO_ICON = { audio: '🎧', video: '▶', documento: '📄', link: '🔗' };

  return (
    <div className="pw-section">
      <SectionHeader icon="📚" title="Conteúdos" />
      {itens.length === 0
        ? <Empty msg="Nenhum conteúdo ainda" />
        : itens.filter(i => i.ativo !== false).map(item => (
          <RowCard
            key={item.id}
            icon={TIPO_ICON[item.tipo] || '📄'}
            title={item.titulo}
          />
        ))
      }
    </div>
  );
}

function AudiosPreview() {
  const audios = useCollection('audiosAcolhimento', [orderBy('criadoEm', 'desc'), limit(5)]);

  return (
    <div className="pw-section">
      <SectionHeader icon="🎵" title="Áudios de Acolhimento" />
      {audios.length === 0
        ? <Empty msg="Nenhum áudio ainda" />
        : audios.filter(a => a.ativo !== false).map(item => (
          <div key={item.id} className="pw-row">
            <div className="pw-audio-play">▶</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pw-row-title">{item.titulo || item.nome || '—'}</div>
              {item.descricao && <div className="pw-row-sub">{item.descricao}</div>}
            </div>
          </div>
        ))
      }
    </div>
  );
}

function VitoriasPreview() {
  const opcoes = useCollection('vitoriasOpcoes', [orderBy('criadoEm', 'asc'), limit(6)]);

  return (
    <div className="pw-section">
      <SectionHeader icon="⭐" title="Pequenas Vitórias" />
      {opcoes.filter(o => o.ativo !== false).length === 0
        ? <Empty msg="Nenhuma vitória cadastrada" />
        : opcoes.filter(o => o.ativo !== false).map(item => (
          <div key={item.id} className="pw-row">
            <span className="pw-vitoria-star">{item.emoji || '⭐'}</span>
            <div className="pw-row-title">{item.label}</div>
          </div>
        ))
      }
    </div>
  );
}

function UsuariasPreview() {
  const usuarios = useCollection('usuarios', [orderBy('criadoEm', 'desc'), limit(5)]);

  return (
    <div className="pw-section">
      <SectionHeader icon="👥" title="Usuárias" />
      {usuarios.length === 0
        ? <Empty msg="Nenhuma usuária cadastrada" />
        : usuarios.map(u => (
          <div key={u.id} className="pw-row">
            <div className="pw-user-avatar">
              {(u.nome || u.email || 'U')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pw-row-title">{u.nome || '(sem nome)'}</div>
              <div className="pw-row-sub">{u.plano || 'perceber'}</div>
            </div>
          </div>
        ))
      }
    </div>
  );
}

function DashboardPreview() {
  const frases = useCollection('frases', [orderBy('criadoEm', 'desc'), limit(1)]);
  const frase = frases[0];

  return (
    <div>
      {/* Greeting */}
      <div className="pw-home-header">
        <div className="pw-home-greet">Olá, Carla ✨</div>
        <div className="pw-home-sub">Que hoje você se permita sentir, acolher e seguir.</div>
      </div>

      {/* Frase do dia */}
      <div className="pw-frase-card">
        <div className="pw-frase-label">FRASE DO DIA</div>
        <div className="pw-frase-texto">
          {frase
            ? `"${frase.texto}"`
            : '"Cada dia traz uma nova chance de cuidar de si."'}
        </div>
        {frase?.autor && <div className="pw-frase-autor">— {frase.autor}</div>}
      </div>

      {/* Quick access */}
      <div className="pw-section">
        <SectionHeader icon="⚡" title="Acesso Rápido" />
        <div className="pw-quick-grid">
          {[['🎧','Conteúdos'],['⭐','Vitórias'],['📊','Relatórios']].map(([ic, lb]) => (
            <div key={lb} className="pw-quick-card">
              <span className="pw-quick-icon">{ic}</span>
              <span className="pw-quick-label">{lb}</span>
            </div>
          ))}
        </div>
        <div className="pw-vida-btn">
          <div className="pw-vida-circle">🧭</div>
          <div style={{ flex: 1 }}>
            <div className="pw-vida-title">Continue a travessia</div>
            <div className="pw-vida-sub">Eu caminho junto com você</div>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>›</span>
        </div>
      </div>
    </div>
  );
}

function NotificacoesPreview() {
  const notifs = useCollection('notificacoes', [orderBy('enviadoEm', 'desc'), limit(5)]);

  return (
    <div className="pw-section">
      <SectionHeader icon="🔔" title="Notificações" />
      {notifs.length === 0
        ? <Empty msg="Nenhuma notificação enviada" />
        : notifs.map(n => (
          <div key={n.id} className="pw-row">
            <div className="pw-row-icon">🔔</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pw-row-title" style={{ whiteSpace: 'normal', lineHeight: '1.3' }}>{n.texto}</div>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ── Screen map ────────────────────────────────────────────────────────────────

const SCREEN_MAP = {
  dashboard:    DashboardPreview,
  travessia:    TravessiaPreview,
  frases:       FrasesPreview,
  conteudos:    ConteudosPreview,
  audios:       AudiosPreview,
  vitorias:     VitoriasPreview,
  usuarias:     UsuariasPreview,
  notificacoes: NotificacoesPreview,
};

const SCREEN_LABEL = {
  dashboard:    'Dashboard',
  travessia:    'Travessia',
  frases:       'Frases',
  conteudos:    'Conteúdos',
  audios:       'Áudios',
  vitorias:     'Vitórias',
  usuarias:     'Usuárias',
  notificacoes: 'Notificações',
};

export default function Preview({ currentScreen }) {
  const PreviewComponent = SCREEN_MAP[currentScreen] || DashboardPreview;

  return (
    <>
      <div className="preview-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4CAF50', display: 'inline-block' }} />
          <div className="preview-title">Prévia · Tempo real</div>
        </div>
        <div className="preview-sub">{SCREEN_LABEL[currentScreen] || 'Tela'}</div>
      </div>
      <div className="ph-wrap">
        <PhoneShell currentScreen={currentScreen}>
          <PreviewComponent />
        </PhoneShell>
      </div>
    </>
  );
}
