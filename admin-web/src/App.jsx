import React, { useState, useEffect } from 'react';
import { auth, db, isAdminEmail } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import Login from './Login';
import Dashboard from './Dashboard';
import Audios from './Audios';
import Frases from './Frases';
import OutrosConteudos from './OutrosConteudos';
import Travessia from './Travessia';
import Jornadas from './Jornadas';
import Vitorias from './Vitorias';
import Parcerias from './Parcerias';
import Beneficios from './Beneficios';
import Usuarias from './Usuarias';
import Notificacoes from './Notificacoes';
import Mensagens from './Mensagens';
import Relatorios from './Relatorios';
import PrecosPlanos from './PrecosPlanos';
import Perfil from './Perfil';
import Preview from './Preview';
import {
  IconDashboard, IconLibrary, IconCompass, IconGift, IconUsers,
  IconBell, IconChart, IconTag, IconEdit, IconMenu, IconLogout, IconSpark,
} from './Icons';
import './alinhamento.css';

// Mesma organização do painel do app (AdminLayout.js → NAV_GRUPOS e
// AdminSubTabs.js → GRUPOS_SUBTABS). Itens com `abas` reúnem telas irmãs em
// sub-abas; o estado de navegação guarda sempre a tela (aba) aberta.
const NAV_GRUPOS = [
  {
    titulo: 'Visão geral',
    itens: [
      { id: 'dashboard', Icon: IconDashboard, label: 'Dashboard' },
    ],
  },
  {
    titulo: 'Conteúdo do app',
    itens: [
      {
        id: 'biblioteca', Icon: IconLibrary, label: 'Biblioteca',
        abas: [
          { id: 'audios', label: 'Áudios Check-in' },
          { id: 'frases', label: 'Frases' },
          { id: 'outrosConteudos', label: 'Outros conteúdos' },
        ],
      },
      {
        id: 'jornada', Icon: IconCompass, label: 'Jornada',
        abas: [
          { id: 'travessia', label: 'Travessia' },
          { id: 'jornadas', label: 'Jornadas' },
          { id: 'vitorias', label: 'Vitórias' },
        ],
      },
      {
        id: 'secaoParcerias', Icon: IconGift, label: 'Parcerias',
        abas: [
          { id: 'parcerias', label: 'Parcerias' },
          { id: 'beneficios', label: 'Cupons e Comissões' },
        ],
      },
    ],
  },
  {
    titulo: 'Pessoas',
    itens: [
      { id: 'usuarias', Icon: IconUsers, label: 'Usuárias', sub: 'Planos e acessos' },
      {
        id: 'comunicacao', Icon: IconBell, label: 'Comunicação',
        abas: [
          { id: 'notificacoes', label: 'Notificações' },
          { id: 'mensagens', label: 'Mensagens' },
        ],
      },
      { id: 'relatorios', Icon: IconChart, label: 'Relatórios', sub: 'Geral · Emoções · Usuárias · Empresas' },
    ],
  },
  {
    titulo: 'Configuração',
    itens: [
      { id: 'precos', Icon: IconTag, label: 'Preços e planos', sub: 'Cards dos planos e valores' },
      { id: 'perfil', Icon: IconEdit, label: 'Meu perfil', sub: 'Nome e foto' },
    ],
  },
];

// Uma entrada por tela (aba). Cada tela recebe { showToast, perfil }.
const SCREENS = {
  dashboard:       Dashboard,
  audios:          Audios,
  frases:          Frases,
  outrosConteudos: OutrosConteudos,
  travessia:       Travessia,
  jornadas:        Jornadas,
  vitorias:        Vitorias,
  parcerias:       Parcerias,
  beneficios:      Beneficios,
  usuarias:        Usuarias,
  notificacoes:    Notificacoes,
  mensagens:       Mensagens,
  relatorios:      Relatorios,
  precos:          PrecosPlanos,
  perfil:          Perfil,
};

const TODOS_ITENS = NAV_GRUPOS.flatMap(g => g.itens);
const itemDaTela = (tela) =>
  TODOS_ITENS.find(it => (it.abas ? it.abas.some(a => a.id === tela) : it.id === tela));

export default function App() {
  const [user, setUser] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [screen, setScreen] = useState('dashboard');
  // Última aba aberta em cada seção, para voltar a ela ao clicar no item.
  const [ultimaAba, setUltimaAba] = useState({});
  const [toast, setToast] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type, key: Date.now() });
    setTimeout(() => setToast(null), 3400);
  };

  useEffect(() => {
    let unsubPerfil = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (unsubPerfil) { unsubPerfil(); unsubPerfil = null; }
      if (!u) { setUser(null); setPerfil(null); return; }

      let autorizada = isAdminEmail(u.email);
      try {
        const snap = await getDoc(doc(db, 'usuarios', u.uid));
        if (snap.exists() && snap.data().role === 'admin') autorizada = true;
      } catch { /* perfil indisponível — decide pelo e-mail */ }

      if (!autorizada) {
        await signOut(auth);
        setUser(null);
        showToast('Acesso restrito às administradoras.', 'error');
        return;
      }

      // Auto-reparo: garante role: 'admin' no Firestore para os e-mails
      // autorizados. As regras do Firestore exigem esse papel (ou o e-mail) para
      // escrever; sem ele, uma conta criada fora do fluxo de cadastro entrava no
      // painel mas não conseguia salvar nada — e o acesso parecia "parar sozinho".
      if (isAdminEmail(u.email)) {
        try {
          const snap = await getDoc(doc(db, 'usuarios', u.uid));
          if (!snap.exists() || snap.data().role !== 'admin') {
            await setDoc(doc(db, 'usuarios', u.uid), {
              nome: snap.data()?.nome || u.displayName || 'Administradora',
              email: u.email,
              role: 'admin',
              acessoTotal: true,
              atualizadoEm: serverTimestamp(),
            }, { merge: true });
          }
        } catch { /* regras ainda não publicadas — segue pelo e-mail */ }
      }

      // Em tempo real, para a foto e o nome refletirem edições no perfil.
      unsubPerfil = onSnapshot(doc(db, 'usuarios', u.uid), snap => {
        setPerfil(snap.exists() ? { ...snap.data(), email: u.email, uid: u.uid } : { email: u.email, uid: u.uid });
      }, () => setPerfil({ email: u.email, uid: u.uid }));

      setUser(u);
    });

    return () => { unsubAuth(); if (unsubPerfil) unsubPerfil(); };
  }, []);

  const handleLogout = async () => { await signOut(auth); setUser(null); };

  const navigate = (id) => {
    const item = TODOS_ITENS.find(it => it.id === id);
    let tela = id;
    if (item?.abas) tela = ultimaAba[item.id] || item.abas[0].id;
    const dono = itemDaTela(tela);
    if (dono?.abas) setUltimaAba(prev => ({ ...prev, [dono.id]: tela }));
    setScreen(tela);
    setMobileOpen(false);
  };

  if (user === undefined) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Carregando painel…</p>
      </div>
    );
  }

  if (!user) return <Login showToast={showToast} />;

  const Screen = SCREENS[screen] || Dashboard;
  const itemAtual = itemDaTela(screen);
  const nomeCompleto = perfil?.nome || perfil?.email?.split('@')[0] || 'Administradora';
  const primeiroNome = nomeCompleto.split(' ')[0];
  const inicial = primeiroNome.charAt(0).toUpperCase();

  return (
    <>
      <div className="admin-root">
        <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-brand">
            <span className="sidebar-logo"><IconSpark size={20} /></span>
            <div>
              <div className="sidebar-app-name">Atravessia</div>
              <div className="sidebar-badge">Painel administrativo</div>
            </div>
          </div>

          <div
            className="sidebar-profile"
            onClick={() => navigate('perfil')}
            title="Editar meu perfil"
          >
            {perfil?.fotoUrl
              ? <img className="avatar" src={perfil.fotoUrl} alt={primeiroNome} />
              : <div className="avatar">{inicial}</div>}
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-profile-name">{primeiroNome}</div>
              <div className="sidebar-profile-sub">Administradora</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {NAV_GRUPOS.map(grupo => (
              <div className="nav-group" key={grupo.titulo}>
                <div className="nav-group-title">{grupo.titulo}</div>
                {grupo.itens.map(({ id, Icon, label, sub, abas }) => (
                  <button
                    key={id}
                    className={`nav-item ${itemAtual?.id === id ? 'active' : ''}`}
                    onClick={() => navigate(id)}
                  >
                    <span className="nav-icon"><Icon size={17} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="nav-label" style={{ display: 'block' }}>{label}</span>
                      {(sub || abas) && (
                        <span className="nav-sub" style={{ display: 'block' }}>
                          {sub || abas.map(a => a.label).join(' · ')}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button className="logout-btn" onClick={handleLogout}>
              <IconLogout size={15} />
              <span>Encerrar sessão</span>
            </button>
          </div>
        </aside>

        <main className="content-area">
          <div className="mobile-header">
            <button onClick={() => setMobileOpen(v => !v)} aria-label="Abrir menu">
              <IconMenu size={22} />
            </button>
            <span className="mobile-header-title">Atravessia</span>
          </div>

          {itemAtual?.abas && (
            <div className="subtabs">
              {itemAtual.abas.map(a => (
                <button
                  key={a.id}
                  className={`subtab ${screen === a.id ? 'active' : ''}`}
                  onClick={() => navigate(a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          <Screen key={screen} showToast={showToast} perfil={perfil} />
        </main>

        <div className="preview-panel">
          <Preview currentScreen={screen} />
        </div>
      </div>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(46,39,64,.44)', zIndex: 90 }}
        />
      )}

      {toast && (
        <div key={toast.key} className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}
