import React, { useState, useEffect } from 'react';
import { auth, db, isAdminEmail } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

import Login from './Login';
import Dashboard from './Dashboard';
import Travessia from './Travessia';
import Biblioteca from './Biblioteca';
import Planos from './Planos';
import Usuarias from './Usuarias';
import Vitorias from './Vitorias';
import Notificacoes from './Notificacoes';
import Perfil from './Perfil';
import Preview from './Preview';
import {
  IconDashboard, IconLibrary, IconCompass, IconStar, IconUsers,
  IconBell, IconTag, IconMenu, IconLogout, IconSpark,
} from './Icons';

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
      { id: 'biblioteca', Icon: IconLibrary, label: 'Biblioteca', sub: 'Frases · Conteúdos · Áudios · Parcerias' },
      { id: 'travessia',  Icon: IconCompass, label: 'Travessia',  sub: 'Links e materiais externos' },
      { id: 'vitorias',   Icon: IconStar,    label: 'Vitórias',   sub: 'Opções de pequenas vitórias' },
    ],
  },
  {
    titulo: 'Pessoas',
    itens: [
      { id: 'usuarias',     Icon: IconUsers, label: 'Usuárias',     sub: 'Planos e acessos' },
      { id: 'notificacoes', Icon: IconBell,  label: 'Notificações', sub: 'Avisos para as usuárias' },
    ],
  },
  {
    titulo: 'Configuração',
    itens: [
      { id: 'planos', Icon: IconTag, label: 'Planos', sub: 'Preços, recursos e mensagens' },
    ],
  },
];

const SCREENS = {
  dashboard:    Dashboard,
  travessia:    Travessia,
  biblioteca:   Biblioteca,
  planos:       Planos,
  usuarias:     Usuarias,
  vitorias:     Vitorias,
  notificacoes: Notificacoes,
  perfil:       Perfil,
};

export default function App() {
  const [user, setUser] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [screen, setScreen] = useState('dashboard');
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

      // Em tempo real, para a foto e o nome refletirem edições no perfil.
      unsubPerfil = onSnapshot(doc(db, 'usuarios', u.uid), snap => {
        setPerfil(snap.exists() ? { ...snap.data(), email: u.email, uid: u.uid } : { email: u.email, uid: u.uid });
      }, () => setPerfil({ email: u.email, uid: u.uid }));

      setUser(u);
    });

    return () => { unsubAuth(); if (unsubPerfil) unsubPerfil(); };
  }, []);

  const handleLogout = async () => { await signOut(auth); setUser(null); };

  const navigate = (id) => { setScreen(id); setMobileOpen(false); };

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
                {grupo.itens.map(({ id, Icon, label, sub }) => (
                  <button
                    key={id}
                    className={`nav-item ${screen === id ? 'active' : ''}`}
                    onClick={() => navigate(id)}
                  >
                    <span className="nav-icon"><Icon size={17} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="nav-label" style={{ display: 'block' }}>{label}</span>
                      {sub && <span className="nav-sub" style={{ display: 'block' }}>{sub}</span>}
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

          <Screen showToast={showToast} perfil={perfil} />
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
