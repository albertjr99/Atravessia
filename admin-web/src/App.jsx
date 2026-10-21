import React, { useState, useEffect } from 'react';
import { auth, db, isAdminEmail } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import Login from './Login';
import Dashboard from './Dashboard';
import Audios from './Audios';
import Frases from './Frases';
import OutrosConteudos from './OutrosConteudos';
import Videos from './Videos';
import ProdutosAtravessia from './ProdutosAtravessia';
import AtravessIA from './AtravessIA';
import { IA_PAINEL } from './recursos';
import Travessia from './Travessia';
import Jornadas from './Jornadas';
import Vitorias from './Vitorias';
import Parcerias from './Parcerias';
import Beneficios from './Beneficios';
import Cashback from './Cashback';
import Indicacoes from './Indicacoes';
import Usuarias from './Usuarias';
import Notificacoes from './Notificacoes';
import Mensagens from './Mensagens';
import Relatorios from './Relatorios';
import PrecosPlanos from './PrecosPlanos';
import Perfil from './Perfil';
import Institucional from './Institucional';
import RecursosIA from './RecursosIA';
import Artes from './Artes';
import Preview from './Preview';
import {
  IconDashboard, IconLibrary, IconCompass, IconGift, IconUsers,
  IconMegaphone, IconChart, IconTag, IconEdit, IconPerson, IconMenu, IconLogout, IconSpark,
  Logo,
  IconDoc, IconPalette,
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
      ...(IA_PAINEL ? [{ id: 'atravessia', Icon: IconSpark, label: 'AtravessIA', sub: 'Leitura dos dados · Assistente' }] : []),
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
          { id: 'videos', label: 'Apresentações' },
          { id: 'produtosAtravessia', label: 'Produtos Atravessia' },
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
          { id: 'cashback', label: 'Cashback' },
          { id: 'indicacoes', label: 'Indicações Amazon' },
        ],
      },
    ],
  },
  {
    titulo: 'Pessoas',
    itens: [
      { id: 'usuarias', Icon: IconUsers, label: 'Usuárias', sub: 'Planos e acessos' },
      {
        id: 'comunicacao', Icon: IconMegaphone, label: 'Comunicação',
        abas: [
          { id: 'notificacoes', label: 'Notificações' },
          { id: 'mensagens', label: 'Mensagens' },
        ],
      },
      { id: 'relatorios', Icon: IconChart, label: 'Relatórios', sub: 'Geral · Emoções · Usuárias · Empresas' },
    ],
  },
  {
    titulo: 'Criação',
    itens: [
      { id: 'artes', Icon: IconPalette, label: 'Atravessia Artes', sub: 'Gerador de artes por IA · Compositor' },
    ],
  },
  {
    titulo: 'Configuração',
    itens: [
      { id: 'precos', Icon: IconTag, label: 'Preços e planos', sub: 'Cards dos planos e valores' },
      { id: 'recursosIA', Icon: IconSpark, label: 'Funções da AtravessIA', sub: 'Ligar, desligar e planos de cada uma' },
      { id: 'institucional', Icon: IconDoc, label: 'Sobre e parcerias', sub: 'Sobre o app · Seja nosso parceiro' },
      { id: 'perfil', Icon: IconPerson, label: 'Meu perfil', sub: 'Nome e foto' },
    ],
  },
];

// Uma entrada por tela (aba). Cada tela recebe { showToast, perfil }.
const SCREENS = {
  dashboard:       Dashboard,
  ...(IA_PAINEL ? { atravessia: AtravessIA } : {}),
  audios:          Audios,
  frases:          Frases,
  outrosConteudos: OutrosConteudos,
  videos:          Videos,
  produtosAtravessia: ProdutosAtravessia,
  travessia:       Travessia,
  jornadas:        Jornadas,
  vitorias:        Vitorias,
  parcerias:       Parcerias,
  beneficios:      Beneficios,
  cashback:        Cashback,
  indicacoes:      Indicacoes,
  usuarias:        Usuarias,
  notificacoes:    Notificacoes,
  mensagens:       Mensagens,
  relatorios:      Relatorios,
  precos:          PrecosPlanos,
  perfil:          Perfil,
  institucional:   Institucional,
  recursosIA:      RecursosIA,
  artes:           Artes,
};

const TODOS_ITENS = NAV_GRUPOS.flatMap(g => g.itens);
const itemDaTela = (tela) =>
  TODOS_ITENS.find(it => (it.abas ? it.abas.some(a => a.id === tela) : it.id === tela));
// Grupo do menu ao qual o item pertence — vira o sobretítulo da página.
const grupoDoItem = (item) => NAV_GRUPOS.find(g => g.itens.includes(item));

export default function App() {
  const [user, setUser] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [screen, setScreen] = useState('dashboard');
  // Parâmetros de um atalho entre telas (ex.: abrir Cupons já filtrado por uma parceria).
  const [parametros, setParametros] = useState(null);
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

  const navigate = (id, params = null) => {
    setParametros(params);
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
  const grupoAtual = grupoDoItem(itemAtual);
  const nomeCompleto = perfil?.nome || perfil?.email?.split('@')[0] || 'Administradora';
  const primeiroNome = nomeCompleto.split(' ')[0];
  const inicial = primeiroNome.charAt(0).toUpperCase();

  return (
    <>
      <div className="admin-root">
        <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-brand">
            <Logo size={44} respira className="sidebar-logo" />
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
            <span className="avatar-anel">
              {perfil?.fotoUrl
                ? <img className="avatar" src={perfil.fotoUrl} alt={primeiroNome} />
                : <span className="avatar">{inicial}</span>}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-profile-name">{primeiroNome}</div>
              <div className="sidebar-profile-sub">Administradora</div>
            </div>
            <span className="sidebar-profile-edit"><IconEdit size={17} /></span>
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
                    <span className="nav-icon"><Icon size={18} /></span>
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
              <IconLogout size={19} />
              <span>Encerrar sessão</span>
            </button>
          </div>
        </aside>

        <main className="content-area">
          <div className="mobile-header">
            <button onClick={() => setMobileOpen(v => !v)} aria-label="Abrir menu">
              <IconMenu size={24} />
            </button>
            <Logo size={30} />
            <span className="mobile-header-title">Atravessia</span>
          </div>

          {itemAtual && (
            <div className="page-top">
              <div className="migalha">
                {grupoAtual && <><span>{grupoAtual.titulo}</span><span aria-hidden="true">·</span></>}
                <b>{itemAtual.label}</b>
              </div>
            </div>
          )}

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

          <Screen key={screen} showToast={showToast} perfil={perfil} irPara={navigate} parametros={parametros} />
        </main>

        <div className="preview-panel">
          <div className="preview-scroll">
            <Preview currentScreen={screen} />
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="menu-veu" onClick={() => setMobileOpen(false)} />
      )}

      {toast && (
        <div key={toast.key} className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}
