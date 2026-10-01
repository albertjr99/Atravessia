// "Seu dia na Atravessia" — sequência diária sugerida, sempre opcional.
//
// A função `montarDiarioDoDia` é pura: recebe os dados de `useApp()` e devolve
// os passos do dia, quais já foram feitos e qual seria o próximo passo gentil.
// Nada aqui bloqueia o uso do app; a sequência só orienta quem quiser segui-la.
//
// As funções de "dispensa" guardam, por data, que a usuária tocou em "Agora não"
// — assim o app não volta a insistir no mesmo dia.
import AsyncStorage from '@react-native-async-storage/async-storage';

const TZ = 'America/Sao_Paulo';

// Mesmo formato gravado em check-ins, vitórias e conteúdos liberados (AAAA-MM-DD).
export const hojeDiario = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

// Datas podem vir como 'AAAA-MM-DD' ou ISO completo (registros antigos).
const diaDe = (data) => (typeof data === 'string' ? data.slice(0, 10) : '');

// Ordem da sequência. `rastreavel: false` = passo opcional sem check (não há
// registro com data que permita saber se foi feito hoje).
export const PASSOS_DIARIO = [
  {
    id: 'checkin',
    titulo: 'Check-in',
    descricao: 'Como você está hoje?',
    rota: 'CheckIn',
    icone: 'heart-outline',
    plano: 0,
    rastreavel: true,
    pergunta: 'Quer começar contando como você está hoje?',
    acao: 'Fazer check-in',
  },
  {
    id: 'vitoria',
    titulo: 'Pequena vitória',
    descricao: 'Um passo, por menor que seja, merece ser lembrado.',
    rota: 'PequenasVitorias',
    icone: 'star-outline',
    plano: 1,
    rastreavel: true,
    pergunta: 'Quer registrar uma pequena vitória de hoje?',
    acao: 'Registrar',
  },
  {
    id: 'acolhimento',
    titulo: 'Acolhimento',
    descricao: 'Um áudio ou conteúdo para cuidar de você.',
    rota: 'Audios',
    icone: 'headset-outline',
    plano: 1,
    rastreavel: true,
    pergunta: 'Que tal um momento de acolhimento, com um áudio ou um conteúdo que você guardou?',
    acao: 'Ouvir',
  },
  {
    id: 'jornada',
    titulo: 'Jornada',
    descricao: 'Mais um trecho do seu caminho, se fizer sentido hoje.',
    rota: 'Jornadas',
    icone: 'compass-outline',
    plano: 0,
    rastreavel: false,
    pergunta: 'Quer dar mais um passo em uma jornada?',
    acao: 'Ver jornadas',
  },
  {
    id: 'caminho',
    titulo: 'Olhar para o caminho',
    descricao: 'Veja com carinho o quanto você já atravessou.',
    rota: 'Relatorios',
    icone: 'analytics-outline',
    plano: 0,
    rastreavel: false,
    pergunta: 'Quer olhar para o caminho que você já percorreu?',
    acao: 'Ver meu caminho',
  },
];

const chamar = (fn, ...args) => {
  try { return typeof fn === 'function' ? !!fn(...args) : false; } catch { return false; }
};

/**
 * Monta os passos do dia a partir dos dados do AppContext.
 *
 * @param {object} dados  — o objeto de `useApp()` (ou parte dele):
 *   { checkins, vitorias, liberadoHoje, temAcesso, jornadasComProgresso }
 * @param {string} [hoje] — 'AAAA-MM-DD' (padrão: hoje em America/Sao_Paulo)
 * @returns {{
 *   hoje: string,
 *   passos: Array<{ id, titulo, descricao, rota, feito, bloqueado, icone, opcional, pergunta, acao }>,
 *   proximo: object|null,   // próximo passo sugerido (pendente e liberado)
 *   feitos: number,         // passos com check já feitos
 *   total: number,          // passos com check disponíveis no plano
 *   completo: boolean,      // todos os passos com check disponíveis foram feitos
 * }}
 * `feito` é true/false nos passos rastreáveis e null nos opcionais sem check.
 */
export function montarDiarioDoDia(dados = {}, hoje = hojeDiario()) {
  const {
    checkins = [], vitorias = [], liberadoHoje, temAcesso, jornadasComProgresso = [],
  } = dados || {};

  const temPlano = (n) => (n <= 0 ? true : chamar(temAcesso, n));

  const feitoPorId = {
    checkin: (checkins || []).some(c => diaDe(c?.data) === hoje),
    vitoria: (vitorias || []).some(v => diaDe(v?.data) === hoje),
    acolhimento: chamar(liberadoHoje, 'acolhimento'),
  };

  // Jornada em andamento (se houver) deixa a descrição mais pessoal.
  const emAndamento = (jornadasComProgresso || []).find(j => {
    const total = j?.atividades?.length || 0;
    const feitas = j?.atividadesConcluidas || 0;
    return feitas > 0 && feitas < total;
  });

  const passos = PASSOS_DIARIO.map(p => {
    const bloqueado = !temPlano(p.plano);
    const feito = p.rastreavel ? !!feitoPorId[p.id] : null;
    let descricao = p.descricao;
    if (p.id === 'jornada' && emAndamento?.titulo) descricao = `Continue: ${emAndamento.titulo}`;
    return {
      id: p.id,
      titulo: p.titulo,
      descricao,
      rota: p.rota,
      icone: p.icone,
      feito,
      bloqueado,
      opcional: !p.rastreavel,
      plano: p.plano,
      pergunta: p.pergunta,
      acao: p.acao,
    };
  });

  const comCheck = passos.filter(p => !p.opcional && !p.bloqueado);
  const feitos = comCheck.filter(p => p.feito).length;
  const total = comCheck.length;
  const completo = total > 0 && feitos === total;
  const proximo = comCheck.find(p => !p.feito) || null;

  return { hoje, passos, proximo, feitos, total, completo };
}

/**
 * Próximo passo depois de `depoisDe` (id de um passo): o primeiro seguinte que
 * esteja liberado no plano e ainda não feito. Passos opcionais sem check
 * (jornada, caminho) também podem ser sugeridos. Retorna null se não houver.
 */
export function proximoDepoisDe(diario, depoisDe) {
  const passos = diario?.passos || [];
  const idx = passos.findIndex(p => p.id === depoisDe);
  const seguintes = idx >= 0 ? passos.slice(idx + 1) : passos;
  return seguintes.find(p => !p.bloqueado && p.feito !== true) || null;
}

// ── Dispensa do dia ("Agora não") ────────────────────────────────────────────
// Uma chave por data: '@atravessia/diario/dispensa/AAAA-MM-DD' → ['proximo', ...].
// `escopo` permite dispensar só a sugestão pós-passo ('proximo') ou recolher o
// cartão da tela inicial ('cartao') sem afetar um ao outro.
const PREFIXO = '@atravessia/diario/dispensa/';
const chaveDoDia = (hoje) => `${PREFIXO}${hoje}`;

async function lerEscopos(hoje) {
  try {
    const bruto = await AsyncStorage.getItem(chaveDoDia(hoje));
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export async function foiDispensadoHoje(escopo = 'proximo', hoje = hojeDiario()) {
  const escopos = await lerEscopos(hoje);
  return escopos.includes(escopo);
}

export async function dispensarHoje(escopo = 'proximo', hoje = hojeDiario()) {
  try {
    const escopos = await lerEscopos(hoje);
    if (!escopos.includes(escopo)) escopos.push(escopo);
    await AsyncStorage.setItem(chaveDoDia(hoje), JSON.stringify(escopos));
    limparDispensasAntigas(hoje);
  } catch {
    // Sem armazenamento, a dispensa vale só enquanto a tela estiver aberta.
  }
}

export async function desfazerDispensaHoje(escopo = 'proximo', hoje = hojeDiario()) {
  try {
    const escopos = (await lerEscopos(hoje)).filter(e => e !== escopo);
    await AsyncStorage.setItem(chaveDoDia(hoje), JSON.stringify(escopos));
  } catch {
    // ignora
  }
}

// Remove chaves de dias anteriores (melhor esforço, silencioso).
async function limparDispensasAntigas(hoje) {
  try {
    const chaves = await AsyncStorage.getAllKeys();
    const antigas = (chaves || []).filter(k => k.startsWith(PREFIXO) && k !== chaveDoDia(hoje));
    if (antigas.length) await AsyncStorage.multiRemove(antigas);
  } catch {
    // ignora
  }
}
