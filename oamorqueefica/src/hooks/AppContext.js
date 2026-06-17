import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';

const AppContext = createContext();

const hojeStr = () => new Date().toISOString().split('T')[0];

// Calcula a próxima ocorrência anual de uma data sensível (ignora o ano cadastrado)
function proximaOcorrencia(dataStr) {
  const original = new Date(dataStr);
  const agora = new Date();
  agora.setHours(0, 0, 0, 0);
  let candidata = new Date(agora.getFullYear(), original.getMonth(), original.getDate());
  candidata.setHours(0, 0, 0, 0);
  if (candidata < agora) candidata.setFullYear(candidata.getFullYear() + 1);
  return candidata;
}

// Sincroniza uma subcoleção usuarios/{uid}/{nome} com um state local.
function useSubcolecao(uid, nome, setState) {
  useEffect(() => {
    if (!uid) { setState([]); return; }
    const ref = query(collection(db, 'usuarios', uid, nome), orderBy('criadoEm', 'asc'));
    const unsub = onSnapshot(ref, (snap) => {
      setState(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, [uid, nome]);
}

export function AppProvider({ children }) {
  const { firebaseUser, perfil, atualizarPerfil } = useAuth() || {};
  const uid = firebaseUser?.uid || null;

  const [usuario, setUsuarioLocal] = useState({ nome: 'Você', plano: 1, cadastrado: false });

  useEffect(() => {
    if (perfil) {
      setUsuarioLocal({ nome: (perfil.nome || '').split(' ')[0] || 'Você', plano: perfil.plano || 1, cadastrado: true });
    }
  }, [perfil]);

  const setUsuario = (updater) => {
    setUsuarioLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (uid && next.plano !== prev.plano) atualizarPerfil?.({ plano: next.plano });
      return next;
    });
  };

  const [checkins, setCheckins] = useState([]);
  const [memorias, setMemorias] = useState([]);
  const [vitorias, setVitorias] = useState([]);
  const [cartasEscritas, setCartasEscritas] = useState([]);
  const [datasSensiveis, setDatasSensiveis] = useState([]);
  const [redeApoio, setRedeApoio] = useState([]);
  const [tipoLuto, setTipoLutoLocal] = useState(null);

  useSubcolecao(uid, 'checkins', setCheckins);
  useSubcolecao(uid, 'memorias', setMemorias);
  useSubcolecao(uid, 'vitorias', setVitorias);
  useSubcolecao(uid, 'cartas', setCartasEscritas);
  useSubcolecao(uid, 'datasSensiveis', setDatasSensiveis);
  useSubcolecao(uid, 'redeApoio', setRedeApoio);

  useEffect(() => {
    if (perfil?.tipoLuto) setTipoLutoLocal(perfil.tipoLuto);
  }, [perfil]);

  const setTipoLuto = (valor) => {
    setTipoLutoLocal(valor);
    if (uid) atualizarPerfil?.({ tipoLuto: valor });
  };

  // Conteúdos "novos" liberados por dia, por grupo (acolhimento | complementar)
  const [conteudosLiberados, setConteudosLiberados] = useState([]);
  useSubcolecao(uid, 'conteudosLiberados', setConteudosLiberados);

  const [lidas, setLidas] = useState({});

  // Notificações editoriais publicadas pela administração (Firestore: notificacoesEditoriais)
  const [notificacoesEditoriais, setNotificacoesEditoriais] = useState([]);
  useEffect(() => {
    const ref = query(collection(db, 'notificacoesEditoriais'), orderBy('criadoEm', 'desc'));
    const unsub = onSnapshot(ref, (snap) => {
      setNotificacoesEditoriais(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(n => n.ativa !== false));
    }, () => {});
    return unsub;
  }, []);

  // Biblioteca de conteúdos (áudios, documentos, links) publicada pela administração
  const [conteudos, setConteudos] = useState([]);
  useEffect(() => {
    const ref = query(collection(db, 'conteudos'), orderBy('criadoEm', 'desc'));
    const unsub = onSnapshot(ref, (snap) => {
      setConteudos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  const adicionarCheckin = (emocao, intensidade) => {
    const item = { data: hojeStr(), emocao, intensidade };
    setCheckins(prev => [...prev, item]);
    if (uid) addDoc(collection(db, 'usuarios', uid, 'checkins'), { ...item, criadoEm: serverTimestamp() });
  };

  const adicionarMemoria = (memoria) => {
    setMemorias(prev => [...prev, { ...memoria, id: Date.now() }]);
    if (uid) addDoc(collection(db, 'usuarios', uid, 'memorias'), { ...memoria, data: hojeStr(), criadoEm: serverTimestamp() });
  };

  const adicionarVitoria = (vitoria) => {
    setVitorias(prev => [...prev, { ...vitoria, id: Date.now(), data: new Date().toISOString() }]);
    if (uid) addDoc(collection(db, 'usuarios', uid, 'vitorias'), { ...vitoria, criadoEm: serverTimestamp() });
  };

  const adicionarCarta = (carta) => {
    setCartasEscritas(prev => [...prev, { ...carta, id: Date.now(), data: hojeStr() }]);
    if (uid) addDoc(collection(db, 'usuarios', uid, 'cartas'), { ...carta, data: hojeStr(), criadoEm: serverTimestamp() });
  };

  const adicionarDataSensivel = (item) => {
    setDatasSensiveis(prev => (prev.length >= 3 ? prev : [...prev, { ...item, id: Date.now() }]));
    if (uid && datasSensiveis.length < 3) addDoc(collection(db, 'usuarios', uid, 'datasSensiveis'), { ...item, criadoEm: serverTimestamp() });
  };
  const removerDataSensivel = (id) => {
    setDatasSensiveis(prev => prev.filter(d => d.id !== id));
    if (uid) deleteDoc(doc(db, 'usuarios', uid, 'datasSensiveis', String(id))).catch(() => {});
  };

  const adicionarContatoRede = (item) => {
    setRedeApoio(prev => (prev.length >= 3 ? prev : [...prev, { ...item, id: Date.now() }]));
    if (uid && redeApoio.length < 3) addDoc(collection(db, 'usuarios', uid, 'redeApoio'), { ...item, criadoEm: serverTimestamp() });
  };
  const removerContatoRede = (id) => {
    setRedeApoio(prev => prev.filter(c => c.id !== id));
    if (uid) deleteDoc(doc(db, 'usuarios', uid, 'redeApoio', String(id))).catch(() => {});
  };

  const temAcesso = (planoNecessario) => usuario.plano >= planoNecessario;

  // ---- Regras de liberação diária de conteúdo (Plano 1: 1 áudio de acolhimento/dia; Plano 2+: +1 complementar/dia) ----
  const liberadoHoje = (grupo) => conteudosLiberados.some(c => c.grupo === grupo && c.data === hojeStr());

  const podeLiberarNovo = (grupo) => {
    if (grupo === 'acolhimento') return temAcesso(1) && !liberadoHoje('acolhimento');
    if (grupo === 'complementar') return temAcesso(2) && !liberadoHoje('complementar');
    return temAcesso(3);
  };

  const jaLiberado = (id) => conteudosLiberados.some(c => c.id === id);

  const liberarConteudo = (id, grupo) => {
    if (jaLiberado(id)) return true;
    if (!podeLiberarNovo(grupo)) return false;
    const item = { id, grupo, data: hojeStr() };
    setConteudosLiberados(prev => [...prev, item]);
    if (uid) addDoc(collection(db, 'usuarios', uid, 'conteudosLiberados'), { ...item, criadoEm: serverTimestamp() });
    return true;
  };

  const marcarLida = (id) => setLidas(prev => ({ ...prev, [id]: true }));

  // ---- Notificações dinâmicas (regra automática) + editoriais (painel administrativo) ----
  const notificacoes = useMemo(() => {
    const lista = [];
    const ultimoCheckin = checkins[checkins.length - 1];

    if (ultimoCheckin) {
      const dias = Math.floor((new Date() - new Date(ultimoCheckin.data)) / 86400000);
      if (dias >= 14) {
        lista.push({ id: 'inat-14', tipo: 'inatividade', texto: 'Você não precisa passar por tudo sozinho. Quando quiser, estaremos aqui.' });
      } else if (dias >= 7) {
        lista.push({ id: 'inat-7', tipo: 'inatividade', texto: 'Já faz alguns dias que você não passa por aqui. Se desejar, estamos prontos para caminhar com você.' });
      } else if (dias >= 3) {
        lista.push({ id: 'inat-3', tipo: 'inatividade', texto: 'Sentimos sua falta por aqui. Como você está hoje?' });
      }
    }

    datasSensiveis.forEach(d => {
      const dataEvento = proximaOcorrencia(d.data);
      const agora = new Date();
      agora.setHours(0, 0, 0, 0);
      const diff = Math.round((dataEvento - agora) / 86400000);
      if (diff === 0) {
        lista.push({ id: `data-${d.id}-hoje`, tipo: 'data_sensivel', texto: 'Hoje é uma data significativa. Permita-se sentir o que vier, sem cobranças.' });
      } else if (diff > 0 && diff <= 3) {
        lista.push({ id: `data-${d.id}-prox`, tipo: 'data_sensivel', texto: 'Uma data importante está se aproximando. Talvez seja um bom momento para cuidar de você com carinho.' });
      }
    });

    if (temAcesso(1) && !liberadoHoje('acolhimento')) {
      lista.push({ id: 'novo-audio', tipo: 'conteudo', texto: 'Seu áudio de acolhimento de hoje está disponível.' });
    }

    if (temAcesso(2) && checkins.length > 0 && checkins.length % 7 === 0) {
      lista.push({ id: `feedback-semanal-${checkins.length}`, tipo: 'feedback', texto: 'Sua retrospectiva emocional da semana está pronta.' });
    }

    if (temAcesso(3)) {
      lista.push({ id: 'relatorio-mensal', tipo: 'relatorio', texto: 'Seu relatório emocional do mês está pronto.' });
    }

    if (vitorias.length > 0) {
      const ultima = vitorias[vitorias.length - 1];
      lista.push({ id: `vitoria-${ultima.id}`, tipo: 'vitoria', texto: 'Cada passo importa. Sua conquista foi registrada.' });
    }

    const editoriais = notificacoesEditoriais.map(n => ({ ...n }));

    return [...lista, ...editoriais].map(n => ({ ...n, lida: !!lidas[n.id] }));
  }, [checkins, datasSensiveis, conteudosLiberados, vitorias, usuario.plano, notificacoesEditoriais, lidas]);

  return (
    <AppContext.Provider value={{
      usuario, setUsuario,
      checkins, adicionarCheckin,
      memorias, adicionarMemoria,
      vitorias, adicionarVitoria,
      cartasEscritas, adicionarCarta,
      datasSensiveis, adicionarDataSensivel, removerDataSensivel,
      redeApoio, adicionarContatoRede, removerContatoRede,
      tipoLuto, setTipoLuto,
      notificacoes, marcarLida,
      conteudos,
      temAcesso,
      podeLiberarNovo, liberarConteudo, jaLiberado, liberadoHoje,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
