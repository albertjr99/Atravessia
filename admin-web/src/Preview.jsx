import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { EMOCOES, ordenarPor } from './emocoes';

// Lê a coleção inteira (sem orderBy — ele esconderia documentos sem o campo e
// um erro mataria o listener) e ordena/limita no cliente.
function useCollection(col, { ordem, direcao = 'asc', max, filtro } = {}) {
  const [data, setData] = useState([]);
  const [erro, setErro] = useState('');
  useEffect(() => {
    return onSnapshot(collection(db, col), snap => {
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
      if (filtro) docs = docs.filter(filtro);
      if (ordem) docs = ordenarPor(docs, ordem, direcao);
      if (max) docs = docs.slice(0, max);
      setData(docs);
      setErro('');
    }, (e) => setErro(e?.message || 'erro ao ler'));
  }, [col]);
  return [data, erro];
}

function ErroPrevia({ erro }) {
  if (!erro) return null;
  return <div className="pw-empty aln-pw-erro">Não foi possível ler os dados: {erro}</div>;
}

// ── Bottom nav tabs (matches actual HomeScreen.js) ────────────────────────────

const NAV_TABS = [
  { label: 'Início',     icon: '⌂',  activeFor: ['dashboard', 'frases', 'travessia', 'notificacoes', 'parcerias', 'beneficios'] },
  { label: 'Conteúdos', icon: '🎧', activeFor: ['outrosConteudos', 'audios', 'jornadas'] },
  { label: 'Vitórias',  icon: '⭐', activeFor: ['vitorias'] },
  { label: 'Relatórios',icon: '📊', activeFor: ['relatorios', 'mensagens'] },
  { label: 'Planos',    icon: '💎', activeFor: ['usuarias', 'precos'] },
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
  const [itens, erro] = useCollection('travessiaItens', { ordem: 'ordem', filtro: i => i.ativo !== false, max: 6 });
  const TIPO_ICON = { link: '🔗', whatsapp: '💬', video: '▶', audio: '🎵' };

  return (
    <div className="pw-section">
      <SectionHeader icon="🧭" title="Continue a Travessia" />
      <ErroPrevia erro={erro} />
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
  const [frases] = useCollection('frases', { ordem: 'criadoEm', direcao: 'desc', max: 1 });
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

function OutrosConteudosPreview() {
  const [itens, erro] = useCollection('conteudos', {
    ordem: 'criadoEm', direcao: 'desc',
    filtro: i => i.ativo !== false && ['imagem', 'link', 'texto'].includes(i.tipo),
  });
  const TIPO_ICON = { imagem: '🖼', link: '🔗', texto: '📝' };
  const visiveis = itens.slice(0, 6);

  return (
    <div className="pw-section">
      <SectionHeader icon="💡" title="Sugestões para você" />
      <ErroPrevia erro={erro} />
      {visiveis.length === 0
        ? <Empty msg="Nenhum conteúdo ativo ainda" />
        : visiveis.map(item => (
          item.tipo === 'imagem' && item.url ? (
            <div key={item.id} className="aln-pw-img-card">
              <img src={item.url} alt={item.titulo || ''} />
              <div className="pw-row-title">{item.titulo}</div>
            </div>
          ) : (
            <RowCard
              key={item.id}
              icon={TIPO_ICON[item.tipo] || '📄'}
              title={item.titulo}
              sub={item.descricao || (item.tipo === 'texto' ? item.texto : '')}
            />
          )
        ))
      }
    </div>
  );
}

function JornadasPreview() {
  const [jornadas, erro] = useCollection('jornadas', { ordem: 'ordem', filtro: j => j.ativa !== false, max: 6 });
  const PLANOS = ['Grátis', 'Acolher', 'Compreender', 'Evoluir'];

  return (
    <div className="pw-section">
      <SectionHeader icon="🧭" title="Jornadas" />
      <ErroPrevia erro={erro} />
      {jornadas.length === 0
        ? <Empty msg="Nenhuma jornada ativa ainda" />
        : jornadas.map(j => (
          <RowCard key={j.id} icon="✦" title={j.titulo} sub={j.descricao || PLANOS[j.plano] || ''} />
        ))
      }
    </div>
  );
}

function ParceriasPreview() {
  const [parcerias, erro] = useCollection('parcerias', { ordem: 'criadoEm', direcao: 'desc', filtro: p => p.ativo !== false, max: 6 });

  return (
    <div className="pw-section">
      <SectionHeader icon="🎁" title="Parcerias e benefícios" />
      <ErroPrevia erro={erro} />
      {parcerias.length === 0
        ? <Empty msg="Nenhuma parceria ativa ainda" />
        : parcerias.map(p => (
          <RowCard key={p.id} icon="🎁" title={p.titulo} sub={p.descricao} />
        ))
      }
    </div>
  );
}

function MensagensPreview() {
  const [mensagens, setMensagens] = useState({});
  const [erro, setErro] = useState('');
  useEffect(() => onSnapshot(
    doc(db, 'configuracoes', 'mensagensRelatorio'),
    snap => { setMensagens(snap.exists() ? snap.data() : {}); setErro(''); },
    e => setErro(e?.message || 'erro ao ler'),
  ), []);
  const emo = EMOCOES[0];
  const padrao = `Atravessando ${emo.nomeRelatorio} — esse foi seu mês. Cada sentimento que você nomeia é um passo de cuidado. Você não precisa atravessar isso sozinho.`;

  return (
    <div className="pw-section">
      <SectionHeader icon="📊" title="Relatório do mês" />
      <ErroPrevia erro={erro} />
      <div className="pw-reflexao-card">
        <div className="pw-frase-label">EMOÇÃO PREDOMINANTE · {emo.label.toUpperCase()}</div>
        <div className="pw-reflexao-texto">{mensagens[emo.id] || padrao}</div>
      </div>
    </div>
  );
}

function AudiosPreview() {
  const [audios, erro] = useCollection('audiosAcolhimento', { ordem: 'criadoEm', direcao: 'desc', max: 5 });

  return (
    <div className="pw-section">
      <SectionHeader icon="🎵" title="Áudios de Acolhimento" />
      <ErroPrevia erro={erro} />
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
  const [opcoes, erro] = useCollection('vitoriasOpcoes', { ordem: 'criadoEm', max: 6 });

  return (
    <div className="pw-section">
      <SectionHeader icon="⭐" title="Pequenas Vitórias" />
      <ErroPrevia erro={erro} />
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
  const [usuarios, erro] = useCollection('usuarios', { ordem: 'criadoEm', direcao: 'desc', max: 5, filtro: u => u.role !== 'admin' });

  return (
    <div className="pw-section">
      <SectionHeader icon="👥" title="Usuárias" />
      <ErroPrevia erro={erro} />
      {usuarios.length === 0
        ? <Empty msg="Nenhuma usuária cadastrada" />
        : usuarios.map(u => (
          <div key={u.id} className="pw-row">
            <div className="pw-user-avatar">
              {(u.nome || u.email || 'U')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pw-row-title">{u.nome || '(sem nome)'}</div>
              <div className="pw-row-sub">{['Perceber', 'Acolher', 'Compreender', 'Evoluir'][u.plano || 0] || 'Perceber'}</div>
            </div>
          </div>
        ))
      }
    </div>
  );
}

function DashboardPreview() {
  const [frases] = useCollection('frases', { ordem: 'criadoEm', direcao: 'desc', max: 1 });
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
  // As notificações são gravadas uma por usuária; a prévia mostra os textos distintos.
  const [todas, erro] = useCollection('notificacoesEditoriais', { ordem: 'enviadoEm', direcao: 'desc' });
  const vistos = new Set();
  const notifs = todas.filter(n => {
    const chave = (n.texto || '').trim();
    if (!chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  }).slice(0, 5);

  return (
    <div className="pw-section">
      <SectionHeader icon="🔔" title="Notificações" />
      <ErroPrevia erro={erro} />
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
  dashboard:       DashboardPreview,
  audios:          AudiosPreview,
  frases:          FrasesPreview,
  outrosConteudos: OutrosConteudosPreview,
  travessia:       TravessiaPreview,
  jornadas:        JornadasPreview,
  vitorias:        VitoriasPreview,
  parcerias:       ParceriasPreview,
  beneficios:      ParceriasPreview,
  usuarias:        UsuariasPreview,
  notificacoes:    NotificacoesPreview,
  mensagens:       MensagensPreview,
  relatorios:      MensagensPreview,
};

const SCREEN_LABEL = {
  dashboard:       'Dashboard',
  audios:          'Áudios Check-in',
  frases:          'Frases',
  outrosConteudos: 'Outros conteúdos',
  travessia:       'Travessia',
  jornadas:        'Jornadas',
  vitorias:        'Vitórias',
  parcerias:       'Parcerias',
  beneficios:      'Cupons e Comissões',
  usuarias:        'Usuárias',
  notificacoes:    'Notificações',
  mensagens:       'Mensagens',
  relatorios:      'Relatórios',
  precos:          'Preços e planos',
  perfil:          'Meu perfil',
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
