import React, { useState, useEffect, createContext, useContext } from 'react';
import { auth, db, ADMIN_EMAIL } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import Login from './Login';
import Dashboard from './Dashboard';
import Travessia from './Travessia';
import Biblioteca from './Biblioteca';
import Planos from './Planos';
import Usuarias from './Usuarias';
import Vitorias from './Vitorias';
import Notificacoes from './Notificacoes';
import Preview from './Preview';

// Sidebar agrupada por finalidade — reduz a poluição visual e deixa claro
// onde a Carla encontra cada tipo de tarefa.
const NAV_GRUPOS = [
  {
    titulo: 'Visão geral',
    itens: [
      { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    ],
  },
  {
    titulo: 'Conteúdo do app',
    itens: [
      { id: 'biblioteca', icon: '📖', label: 'Biblioteca',  sub: 'Frases · Conteúdos · Áudios · Parcerias' },
      { id: 'travessia',  icon: '🧭', label: 'Travessia',   sub: 'Links e materiais externos' },
      { id: 'vitorias',   icon: '⭐', label: 'Vitórias',    sub: 'Opções de pequenas vitórias' },
    ],
  },
  {
    titulo: 'Pessoas',
    itens: [
      { id: 'usuarias',     icon: '👥', label: 'Usuárias',     sub: 'Planos e acessos' },
      { id: 'notificacoes', icon: '🔔', label: 'Notificações', sub: 'Avisos para as usuárias' },
    ],
  },
  {
    titulo: 'Configuração',
    itens: [
      { id: 'planos', icon: '💜', label: 'Planos', sub: 'Preços, recursos e mensagens' },
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
};

export default function App() {
  const [user, setUser] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [screen, setScreen] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { setUser(null); setPerfil(null); return; }

      let isAdmin = u.email === ADMIN_EMAIL;
      let perfilData = null;
      try {
        const snap = await getDoc(doc(db, 'usuarios', u.uid));
        if (snap.exists()) {
          perfilData = { ...snap.data(), email: u.email, uid: u.uid };
          if (perfilData.role === 'admin') isAdmin = true;
        }
      } catch {}

      if (!isAdmin) {
        await signOut(auth);
        setUser(null);
        showToast('Acesso não autorizado. Apenas administradoras.', 'error');
        return;
      }
      setPerfil(perfilData);
      setUser(u);
    });
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type, key: Date.now() });
    setTimeout(() => setToast(null), 3200);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const navigate = (id) => {
    setScreen(id);
    setMobileOpen(false);
  };

  if (user === undefined) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p style={{ color: 'var(--text-mid)', fontSize: 14 }}>Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Login showToast={showToast} />;
  }

  const Screen = SCREENS[screen] || Dashboard;
  const firstName = perfil?.nome?.split(' ')[0] || 'Admin';

  return (
    <>
      <div className="admin-root">
        {/* ── Sidebar ── */}
        <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-brand">
            <span className="sidebar-logo">🌸</span>
            <div>
              <div className="sidebar-app-name">Atravessia</div>
              <div className="sidebar-badge">PAINEL ADMIN</div>
            </div>
          </div>

          <div className="sidebar-profile">
            <div className="avatar">{firstName[0].toUpperCase()}</div>
            <div>
              <div className="sidebar-profile-name">{firstName}</div>
              <div className="sidebar-profile-sub">Administradora</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {NAV_GRUPOS.map(grupo => (
              <div key={grupo.titulo} style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                  textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)',
                  padding: '0 14px 6px',
                }}>
                  {grupo.titulo}
                </div>
                {grupo.itens.map(item => (
                  <button
                    key={item.id}
                    className={`nav-item ${screen === item.id ? 'active' : ''}`}
                    onClick={() => navigate(item.id)}
                    style={{ alignItems: 'flex-start' }}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
                      <span className="nav-label">{item.label}</span>
                      {item.sub && (
                        <span style={{
                          fontSize: 10, opacity: 0.55, fontWeight: 400,
                          lineHeight: 1.3, textAlign: 'left',
                        }}>
                          {item.sub}
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
              🚪 <span>Encerrar sessão</span>
            </button>
          </div>
        </aside>

        {/* ── Content ── */}
        <main className="content-area">
          {/* Mobile header */}
          <div style={{
            display: 'none',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            background: 'white',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }} className="mobile-header">
            <button
              onClick={() => setMobileOpen(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 4 }}
            >
              ☰
            </button>
            <span style={{ fontSize: 16, fontWeight: 700 }}>🌸 Atravessia Admin</span>
          </div>

          <Screen showToast={showToast} />
        </main>

        {/* ── Preview Panel ── */}
        <div className="preview-panel">
          <Preview currentScreen={screen} />
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 90,
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div key={toast.key} className={`toast toast-${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
