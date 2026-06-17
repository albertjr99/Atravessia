import React, { createContext, useContext, useState, useMemo } from 'react';

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

export function AppProvider({ children }) {
  const [usuario, setUsuario] = useState({
    nome: 'Ana',
    plano: 1,
    cadastrado: false,
  });

  const [checkins, setCheckins] = useState([
    { data: '2025-05-12', emocao: 'triste', intensidade: 3 },
    { data: '2025-05-13', emocao: 'ansioso', intensidade: 2 },
    { data: '2025-05-14', emocao: 'saudade', intensidade: 4 },
    { data: '2025-05-15', emocao: 'esperancoso', intensidade: 2 },
    { data: '2025-05-16', emocao: 'triste', intensidade: 3 },
    { data: '2025-05-17', emocao: 'esperancoso', intensidade: 3 },
  ]);

  const [memorias, setMemorias] = useState([
    { id: 1, titulo: 'Nossa última primavera', tipo: 'texto', conteudo: 'Uma lembrança especial...', data: '2025-05-20' },
    { id: 2, titulo: 'O jardim que você amava', tipo: 'texto', conteudo: 'Cada flor me lembra de você...', data: '2025-05-22' },
  ]);

  const [vitorias, setVitorias] = useState([]);
  const [cartasEscritas, setCartasEscritas] = useState([]);
  const [datasSensiveis, setDatasSensiveis] = useState([]);
  const [redeApoio, setRedeApoio] = useState([]);
  const [tipoLuto, setTipoLuto] = useState(null);

  // Conteúdos "novos" liberados por dia, por grupo (acolhimento | complementar)
  const [conteudosLiberados, setConteudosLiberados] = useState([]);
  const [lidas, setLidas] = useState({});

  const [notificacoesEditoriais] = useState([
    { id: 'ed1', tipo: 'incentivo', texto: 'Você está se cuidando. Isso importa muito.' },
    { id: 'ed2', tipo: 'live', texto: 'Nova live gratuita amanhã às 19h. Confirme presença!' },
  ]);

  const adicionarCheckin = (emocao, intensidade) => {
    setCheckins(prev => [...prev, { data: hojeStr(), emocao, intensidade }]);
  };

  const adicionarMemoria = (memoria) => {
    setMemorias(prev => [...prev, { ...memoria, id: Date.now() }]);
  };

  const adicionarVitoria = (vitoria) => {
    setVitorias(prev => [...prev, { ...vitoria, id: Date.now(), data: new Date().toISOString() }]);
  };

  const adicionarCarta = (carta) => {
    setCartasEscritas(prev => [...prev, { ...carta, id: Date.now(), data: hojeStr() }]);
  };

  const adicionarDataSensivel = (item) => {
    setDatasSensiveis(prev => (prev.length >= 3 ? prev : [...prev, { ...item, id: Date.now() }]));
  };
  const removerDataSensivel = (id) => setDatasSensiveis(prev => prev.filter(d => d.id !== id));

  const adicionarContatoRede = (item) => {
    setRedeApoio(prev => (prev.length >= 3 ? prev : [...prev, { ...item, id: Date.now() }]));
  };
  const removerContatoRede = (id) => setRedeApoio(prev => prev.filter(c => c.id !== id));

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
    setConteudosLiberados(prev => [...prev, { id, grupo, data: hojeStr() }]);
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
      temAcesso,
      podeLiberarNovo, liberarConteudo, jaLiberado, liberadoHoje,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
