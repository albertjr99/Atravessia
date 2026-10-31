import { useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { abrirAvisoAtualizacao } from '../components/AvisoAtualizacao';

// Para onde cada notificação leva. As rotas são as registradas no
// AppNavigator (MainStack / AdminStack).
//
// data.screen (push do servidor e notificações locais) tem prioridade; sem
// ele, vale o tipo (data.tipo), igual ao sininho (NotificacoesScreen).

// Nomes antigos ou apelidos → rota registrada.
const APELIDOS = {
  Inicio: 'MainTabs',
  Home: 'MainTabs',
  FraseDoDia: 'MainTabs',
  Memorial: 'GuardarMemoria',
  Memoria: 'GuardarMemoria',
  Jornada: 'Jornadas',
  Cupons: 'MeusCupons',
  Relatorio: 'Relatorios',
  Lembrete: 'CheckIn',
};

// Tipo da notificação → rota (quando não há data.screen).
export const ROTA_POR_TIPO = {
  frase: 'MainTabs',
  lembrete: 'CheckIn',
  inatividade: 'CheckIn',
  emocao: 'CheckIn',
  conteudo: 'CheckIn',
  incentivo: 'CheckIn',
  data_sensivel: 'DatasSensiveis',
  rede_apoio: 'RedeApoio',
  memorial: 'GuardarMemoria',
  jornada: 'Jornadas',
  feedback: 'Relatorios',
  relatorio: 'Relatorios',
  vitoria: 'PequenasVitorias',
  live: 'Audios',
  novidade: 'Audios',
  confirmar_resgate: 'ConfirmarResgate',
  cupom: 'MeusCupons',
  cashback: 'Cashback',
  cashback_afiliado: 'MeusPedidosCashback',
  curso: 'Cursos',
  comunicacao: 'Notificacoes',
};

// No painel (administradoras) as telas da usuária não existem: algumas têm
// equivalente; as demais são ignoradas sem quebrar.
const NO_PAINEL = {
  Notificacoes: 'AdminNotificacoes',
  Cashback: 'AdminCashback',
  MeusPedidosCashback: 'AdminPedidosCashback',
  Cursos: 'AdminCursos',
  Curso: 'AdminCursos',
};

// Tipos/rotas que abrem o aviso de atualização em vez de uma tela.
const E_VERSAO = (d) => d?.tipo === 'versao' || d?.screen === 'AtualizarApp' || d?.acao === 'atualizar';

// Destino de um conjunto de dados de notificação: { rota, params } ou { acao }.
export function resolverDestino(data) {
  if (!data || typeof data !== 'object') return null;
  if (E_VERSAO(data)) return { acao: 'atualizar' };
  let rota = data.screen || ROTA_POR_TIPO[data.tipo];
  if (!rota) return null;
  rota = APELIDOS[rota] || rota;
  let params;
  if ((rota === 'Cursos' || rota === 'Curso') && data.cursoId) {
    rota = 'Curso';
    params = { cursoId: String(data.cursoId) };
  } else if (rota === 'Curso') {
    rota = 'Cursos';
  } else if (rota === 'ConfirmarResgate') {
    if (!data.resgateId) rota = 'Notificacoes';
    else params = { resgateId: data.resgateId };
  } else if (rota === 'MainTabs' && data.origem === 'fraseDoDia') {
    params = { destaque: 'frase' };
  }
  return { rota, params };
}

// Os dados podem vir em lugares diferentes conforme a plataforma e o estado do
// app (em alguns Androids, o push com o app fechado traz o JSON como texto).
function extrairDados(response) {
  const content = response?.notification?.request?.content || {};
  if (content.data && typeof content.data === 'object' && Object.keys(content.data).length) return content.data;
  const textos = [content.dataString, response?.notification?.request?.trigger?.remoteMessage?.data?.body];
  for (const t of textos) {
    if (typeof t !== 'string') continue;
    try {
      const d = JSON.parse(t);
      if (d && typeof d === 'object') return d;
    } catch {}
  }
  return content.data || null;
}

const chaveResposta = (r) => {
  const n = r?.notification;
  return `${n?.request?.identifier || ''}|${n?.date || ''}|${r?.actionIdentifier || ''}`;
};

// Respostas já tratadas (vale para todo o processo: o mesmo toque chega pelo
// listener e por getLastNotificationResponse).
const tratadas = new Set();
const ESPERA_MAX_MS = 60 * 1000;

// Abre a tela certa ao tocar numa notificação — com o app aberto, em segundo
// plano ou fechado (aberto pela própria notificação). Espera a navegação estar
// pronta e a pilha certa montada (login, carregamento do perfil).
export function useAbrirNotificacoes(navigationRef) {
  const pendente = useRef(null);
  const timer = useRef(null);

  const tentar = useCallback(() => {
    const alvo = pendente.current;
    if (!alvo) return true;
    if (Date.now() - alvo.desde > ESPERA_MAX_MS) { pendente.current = null; return true; }
    const nav = navigationRef.current;
    if (!nav?.isReady?.()) return false;
    const estado = nav.getRootState?.();
    const rotas = estado?.routeNames || [];
    // Carregando ou na tela de login: espera a pilha do app.
    if (!rotas.length || rotas.includes('Login')) return false;
    const atual = estado.routes?.[estado.index ?? 0]?.name;
    // Primeiro acesso: a apresentação não é interrompida.
    if (atual === 'Onboarding') { pendente.current = null; return true; }
    let rota = alvo.rota;
    if (!rotas.includes(rota)) rota = NO_PAINEL[rota];
    pendente.current = null;
    if (rota && rotas.includes(rota)) {
      try { nav.navigate(rota, rota === alvo.rota ? alvo.params : undefined); } catch {}
    }
    return true;
  }, [navigationRef]);

  const agendar = useCallback(() => {
    if (timer.current) return;
    const passo = () => {
      timer.current = null;
      if (!tentar()) timer.current = setTimeout(passo, 250);
    };
    passo();
  }, [tentar]);

  const receber = useCallback((response) => {
    if (!response) return;
    const chave = chaveResposta(response);
    if (tratadas.has(chave)) return;
    tratadas.add(chave);
    try { Notifications.clearLastNotificationResponse?.(); } catch {}
    const destino = resolverDestino(extrairDados(response));
    if (!destino) return;
    if (destino.acao === 'atualizar') { abrirAvisoAtualizacao(); return; }
    pendente.current = { ...destino, desde: Date.now() };
    agendar();
  }, [agendar]);

  useEffect(() => {
    let vivo = true;
    // App aberto a partir da notificação (estava fechado).
    try { receber(Notifications.getLastNotificationResponse?.()); } catch {}
    Notifications.getLastNotificationResponseAsync?.()
      .then(r => { if (vivo) receber(r); })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(receber);
    return () => {
      vivo = false;
      sub.remove();
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    };
  }, [receber]);
}
