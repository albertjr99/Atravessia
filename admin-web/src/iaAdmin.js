// AtravessIA para as administradoras — inteligência própria (sem custo por
// uso): gera rascunhos de conteúdo no tom da Atravessia e lê os dados do app
// em linguagem simples, com sugestões práticas.
// Cópia de oamorqueefica/src/ia/iaAdmin.js — altere as duas juntas.

// ─── Assistente de conteúdo ────────────────────────────────────────────────

export const TIPOS_CONTEUDO = [
  { id: 'frase', rotulo: 'Frase do dia' },
  { id: 'reflexao', rotulo: 'Reflexão' },
  { id: 'notificacao', rotulo: 'Notificação de cuidado' },
  { id: 'jornada', rotulo: 'Passo de jornada' },
];

export const TEMAS_CONTEUDO = [
  { id: 'geral', rotulo: 'Geral' },
  { id: 'saudade', rotulo: 'Saudade' },
  { id: 'triste', rotulo: 'Tristeza' },
  { id: 'sozinho', rotulo: 'Solidão' },
  { id: 'medo', rotulo: 'Medo' },
  { id: 'ansioso', rotulo: 'Ansiedade' },
  { id: 'culpado', rotulo: 'Culpa' },
  { id: 'raiva', rotulo: 'Raiva' },
  { id: 'desanimado', rotulo: 'Desânimo' },
  { id: 'esperanca', rotulo: 'Esperança' },
  { id: 'gratidao', rotulo: 'Gratidão' },
];

const NUCLEO = {
  geral: ['Cada dia é um passo, mesmo quando parece pequeno', 'Você não precisa atravessar tudo hoje', 'O seu ritmo também é um caminho', 'Cuidar de si é uma forma de honrar quem você ama'],
  saudade: ['A saudade é o amor que ficou sem endereço', 'Sentir falta é lembrar que o vínculo continua', 'A saudade não pede pressa, pede espaço', 'Quem amamos segue vivo no que nos ensinou'],
  triste: ['A tristeza também merece colo', 'Dias pesados não apagam o caminho já feito', 'Chorar é uma forma de o coração respirar', 'Não existe jeito certo de sentir a dor'],
  sozinho: ['Você não precisa carregar tudo sem apoio', 'Pedir companhia também é um gesto de força', 'Mesmo na solidão, há mãos que querem estar perto', 'Há conexões que continuam, mesmo em silêncio'],
  medo: ['Um passo de cada vez é suficiente', 'O medo fica menor quando olhamos só para hoje', 'Você já atravessou dias que pareciam impossíveis', 'O agora é um lugar seguro para recomeçar'],
  ansioso: ['Respirar devagar também é cuidar', 'Nem tudo precisa ser resolvido agora', 'A ansiedade passa como uma onda', 'Uma pausa curta pode mudar o resto do dia'],
  culpado: ['Você fez o melhor que podia com o que sabia', 'A culpa muitas vezes é amor tentando reescrever a história', 'Gentileza com você também é amor', 'O que ficou sem ser dito ainda pode encontrar um lugar'],
  raiva: ['A raiva também faz parte do luto', 'Sentir revolta não faz de você uma pessoa ruim', 'A dor às vezes chega vestida de força', 'Dar nome à raiva é o primeiro passo para aliviá-la'],
  desanimado: ['Nos dias de pouca energia, o pequeno já é muito', 'Descansar não é desistir', 'Fazer só o essencial também é seguir', 'Toda força começa num gesto pequeno'],
  esperanca: ['A esperança é um recomeço silencioso', 'Seguir em frente não é esquecer', 'Há manhãs que chegam devagar, mas chegam', 'O amor que fica também ilumina o caminho'],
  gratidao: ['A gratidão acende uma luz ao lado da dor', 'Perceber o que é bom também é cura', 'Há presentes escondidos nos dias simples', 'Agradecer é guardar o que nos sustenta'],
};

const COMPLEMENTO = {
  frase: ['e tudo bem ir no seu tempo.', 'e você não está só nesse caminho.', 'um dia de cada vez.', 'com carinho por você.', 'e isso também é atravessar.'],
  convite: ['Que tal reservar um momento para você hoje?', 'Se fizer sentido, escreva sobre isso no seu diário.', 'Permita-se sentir, acolher e seguir.', 'Respire fundo e acolha o que vier.', 'Se precisar, conte com a sua rede de apoio.'],
  desenvolvimento: [
    'No luto, os sentimentos vêm em ondas e não seguem uma ordem.',
    'Não há prazo para sentir, nem um jeito certo de lembrar.',
    'Cada pessoa encontra o próprio caminho, no próprio ritmo.',
    'O cuidado começa quando a gente se permite parar e olhar para dentro.',
    'Às vezes, o maior avanço do dia é simplesmente continuar.',
  ],
};

const pegar = (lista, usados) => {
  const livres = lista.filter(x => !usados.has(x));
  const base = livres.length ? livres : lista;
  const item = base[Math.floor(Math.random() * base.length)];
  usados.add(item);
  return item;
};

/** Gera `quantidade` rascunhos diferentes para o tipo e tema escolhidos. */
export function gerarRascunhos(tipo, tema = 'geral', quantidade = 3) {
  const nucleo = NUCLEO[tema] || NUCLEO.geral;
  const usados = new Set();
  return Array.from({ length: quantidade }, () => {
    const base = pegar(nucleo, usados);
    if (tipo === 'frase') {
      return { texto: `${base}, ${pegar(COMPLEMENTO.frase, usados)}`, reflexao: `${pegar(COMPLEMENTO.desenvolvimento, usados)} ${pegar(COMPLEMENTO.convite, usados)}` };
    }
    if (tipo === 'reflexao') {
      return { texto: `${base}. ${pegar(COMPLEMENTO.desenvolvimento, usados)} ${pegar(COMPLEMENTO.convite, usados)}` };
    }
    if (tipo === 'notificacao') {
      const convites = ['Como você está hoje?', 'Que tal um check-in?', 'Tem um cuidado esperando por você.', 'Estamos aqui com você.'];
      return { texto: `${base}. ${pegar(convites, usados)}` };
    }
    // jornada: título curto + descrição de um passo
    const titulos = ['Um passo de cada vez', 'Lembrar com carinho', 'Respirar e seguir', 'O que fica', 'Pequenos recomeços', 'Cuidar de mim'];
    return {
      titulo: pegar(titulos, usados),
      texto: `${base}. Neste passo, reserve alguns minutos para ${pegar(['escrever sobre uma lembrança boa', 'ouvir um áudio de acolhimento', 'fazer uma caminhada leve', 'conversar com alguém de confiança', 'registrar uma pequena vitória'], usados)}. ${pegar(COMPLEMENTO.convite, usados)}`,
    };
  });
}

// ─── Leitura dos dados ─────────────────────────────────────────────────────

const NOMES = {
  triste: 'tristeza', saudade: 'saudade', sozinho: 'solidão', medo: 'medo', culpado: 'culpa',
  ansioso: 'ansiedade', raiva: 'raiva', desanimado: 'desânimo', grato: 'gratidão', tranquilo: 'paz',
  esperancoso: 'esperança', alegre: 'alegria', amoroso: 'amor',
};
const DIFICEIS = ['saudade', 'triste', 'sozinho', 'medo', 'ansioso', 'culpado', 'raiva', 'desanimado'];
const DIAS_SEMANA = ['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados'];

const diaUTC = (iso) => { const [a, m, d] = iso.split('-').map(Number); return Date.UTC(a, m - 1, d); };
const somar = (iso, n) => new Date(diaUTC(iso) + n * 86400000).toISOString().slice(0, 10);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

/**
 * @param {object} p { checkins: [{uid, data, emocao}], conteudos, audios, metricas (calcularMetricasFunil), hoje }
 * @returns {Array<{ nivel: 'info'|'atencao'|'sugestao', titulo, texto }>}
 */
export function lerDados({ checkins = [], conteudos = [], audios = [], metricas = null, hoje }) {
  const out = [];
  const validos = checkins.filter(c => typeof c.data === 'string' && /^\d{4}-\d{2}-\d{2}/.test(c.data));
  const entre = (de, ate) => validos.filter(c => c.data.slice(0, 10) >= de && c.data.slice(0, 10) <= ate);

  // 1) Volume de check-ins: últimos 30 dias x 30 anteriores.
  const atual = entre(somar(hoje, -29), hoje);
  const anterior = entre(somar(hoje, -59), somar(hoje, -30));
  if (atual.length || anterior.length) {
    const delta = anterior.length ? Math.round(((atual.length - anterior.length) / anterior.length) * 100) : null;
    out.push({
      nivel: delta != null && delta <= -20 ? 'atencao' : 'info',
      titulo: 'Check-ins no último mês',
      texto: delta == null
        ? `Foram ${atual.length} check-ins nos últimos 30 dias.`
        : `Foram ${atual.length} check-ins nos últimos 30 dias, ${delta >= 0 ? `${delta}% a mais` : `${Math.abs(delta)}% a menos`} que nos 30 dias anteriores (${anterior.length}).`,
    });
  }

  // 2) Emoções mais presentes e emoção em alta.
  if (atual.length >= 5) {
    const cont = {};
    atual.forEach(c => { cont[c.emocao] = (cont[c.emocao] || 0) + 1; });
    const top = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 3);
    out.push({
      nivel: 'info',
      titulo: 'Como as pessoas estão se sentindo',
      texto: `As emoções mais registradas foram ${top.map(([e, n]) => `${NOMES[e] || e} (${pct(n, atual.length)}%)`).join(', ')}.`,
    });
    const recente = entre(somar(hoje, -13), hoje);
    const antes = entre(somar(hoje, -27), somar(hoje, -14));
    if (recente.length >= 5 && antes.length >= 5) {
      const share = (lista, e) => lista.filter(c => c.emocao === e).length / lista.length;
      const alta = DIFICEIS.map(e => ({ e, d: share(recente, e) - share(antes, e) })).sort((a, b) => b.d - a.d)[0];
      if (alta && alta.d >= 0.1) {
        out.push({
          nivel: 'sugestao',
          titulo: `${(NOMES[alta.e] || alta.e).replace(/^./, c => c.toUpperCase())} em alta`,
          texto: `Nas últimas duas semanas, ${NOMES[alta.e]} apareceu ${Math.round(alta.d * 100)} pontos percentuais a mais. Vale publicar uma frase, um áudio ou uma notificação sobre esse sentimento.`,
        });
      }
    }
    // Dia da semana com mais check-ins.
    const porDia = Array(7).fill(0);
    atual.forEach(c => { porDia[new Date(diaUTC(c.data.slice(0, 10))).getUTCDay()] += 1; });
    const melhor = porDia.indexOf(Math.max(...porDia));
    out.push({ nivel: 'info', titulo: 'Melhor dia para falar com elas', texto: `As ${DIAS_SEMANA[melhor]} concentram mais check-ins. Notificações e novidades tendem a ter mais alcance nesse dia.` });
  }

  // 3) Funil e retenção.
  if (metricas) {
    if (metricas.maiorQueda) {
      const dicas = {
        checkin: 'Talvez o primeiro check-in não esteja claro logo após o cadastro: o tour e o lembrete diário ajudam.',
        voltou: 'Muitas fazem um check-in e não voltam: o lembrete diário e uma notificação no 2º dia podem ajudar.',
        pago: 'Muitas voltam, mas não assinam: destacar o que o plano oferece (áudios, vitórias, relatórios) pode ajudar.',
      };
      out.push({
        nivel: 'atencao',
        titulo: 'Onde mais pessoas param',
        texto: `A maior perda está entre "${metricas.maiorQueda.de}" e "${metricas.maiorQueda.para}": só ${metricas.maiorQueda.pctAnterior}% seguiram. ${dicas[metricas.maiorQueda.id] || ''}`.trim(),
      });
    }
    const d7 = metricas.retencaoD7;
    if (d7?.elegiveis >= 5) {
      out.push({
        nivel: d7.pct < 30 ? 'atencao' : 'info',
        titulo: 'Retorno depois de uma semana',
        texto: `${d7.pct}% das pessoas voltaram 7 dias ou mais depois do cadastro.${d7.pct < 30 ? ' Uma sequência de boas-vindas (frases e lembretes na primeira semana) pode aumentar esse número.' : ''}`,
      });
    }
    if (metricas.ativas7 != null) {
      out.push({ nivel: 'info', titulo: 'Pessoas ativas', texto: `${metricas.ativas7} pessoas fizeram check-in na última semana e ${metricas.ativas30} no último mês.` });
    }
  }

  // 4) Cobertura de conteúdos por emoção (evita repetição no acolhimento).
  const ativos = (lista) => lista.filter(i => i.ativo !== false);
  const cobertura = DIFICEIS.map(e => ({
    e,
    n: ativos(conteudos).filter(c => (c.emocoes || []).includes(e)).length
      + ativos(audios).filter(a => (a.emocoes || []).includes(e)).length,
  }));
  const poucas = cobertura.filter(c => c.n < 3).sort((a, b) => a.n - b.n);
  if (poucas.length) {
    out.push({
      nivel: 'sugestao',
      titulo: 'Emoções com poucos conteúdos',
      texto: `Para o acolhimento não se repetir, vale cadastrar mais áudios ou conteúdos para: ${poucas.map(c => `${NOMES[c.e]} (${c.n})`).join(', ')}. O ideal é ter pelo menos 3 para cada emoção.`,
    });
  } else if (cobertura.length) {
    out.push({ nivel: 'info', titulo: 'Conteúdos bem distribuídos', texto: 'Todas as emoções difíceis têm pelo menos 3 conteúdos ou áudios. Ótimo para variar o acolhimento.' });
  }

  // 5) Pessoas que sumiram há mais de 14 dias.
  const ultimoPorUid = {};
  validos.forEach(c => { if (!ultimoPorUid[c.uid] || c.data > ultimoPorUid[c.uid]) ultimoPorUid[c.uid] = c.data.slice(0, 10); });
  const sumidas = Object.values(ultimoPorUid).filter(d => d < somar(hoje, -14)).length;
  if (sumidas > 0) {
    out.push({
      nivel: 'sugestao',
      titulo: 'Pessoas afastadas',
      texto: `${sumidas} ${sumidas === 1 ? 'pessoa não faz' : 'pessoas não fazem'} check-in há mais de 14 dias. Uma mensagem carinhosa de "estamos aqui" pode reaproximá-las.`,
    });
  }

  if (!out.length) out.push({ nivel: 'info', titulo: 'Ainda poucos dados', texto: 'Quando houver mais check-ins, a AtravessIA mostra aqui o que está acontecendo e sugere ações.' });
  return out;
}
