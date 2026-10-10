// AtravessIA — conversa de acolhimento (motor próprio, sem custo por uso).
//
// Não é terapia e não substitui atendimento profissional: acolhe, valida o
// sentimento, oferece um pequeno cuidado para o momento e aponta para o que o
// próprio app tem (áudios, diário, vitórias, rede de apoio). Diante de
// qualquer sinal de risco, responde com o CVV (188) e a Rede de Apoio.
import { analisar, escolher } from './analise';

export const AVISO_IA = 'A AtravessIA está aqui para acolher e caminhar com você, mas não substitui o cuidado de um profissional de saúde.';

// Um cuidado concreto quando a pessoa pede ajuda, conforme o que ela sente.
const CUIDADO_AGORA = {
  saudade: [
    'Uma ideia para agora: escreva algumas linhas como se fosse uma carta para essa pessoa, contando algo do seu dia. Muita gente sente que isso aproxima.',
    'Talvez ajude separar uns minutos para uma lembrança boa: uma foto, uma música que vocês ouviam, uma receita. Deixar a saudade ter um lugar também é cuidado.',
  ],
  triste: [
    'Uma ideia para agora: algo pequeno que acolha você, como um chá quente, um banho morno ou deitar um pouco com uma música calma.',
    'Se puder, mande uma mensagem para alguém de confiança dizendo só "hoje está difícil". Não precisa explicar mais nada.',
  ],
  ansioso: [
    'Vamos respirar juntos: inspire contando até 4, segure um pouco e solte contando até 6. Repita algumas vezes, no seu tempo.',
    'Tente notar 5 coisas que você vê, 4 que pode tocar e 3 sons ao redor. Isso ajuda o corpo a voltar para o agora.',
  ],
  medo: [
    'Respire devagar, soltando o ar mais longo do que puxa. E lembre: agora, neste instante, você está aqui e está seguro o bastante para respirar.',
    'Escrever o medo em uma frase às vezes diminui o tamanho dele. Quer tentar no diário guiado?',
  ],
  sozinho: [
    'Que tal escolher uma pessoa e mandar um "pensei em você hoje"? Pequenas conexões fazem diferença.',
    'Se não houver ninguém agora, fico aqui com você. E um áudio de acolhimento pode fazer companhia por alguns minutos.',
  ],
  culpado: [
    'Experimente escrever o que você gostaria de ter dito, e depois o que essa pessoa provavelmente diria para você. A resposta costuma ser mais gentil do que a culpa.',
  ],
  raiva: [
    'A raiva precisa sair por algum lugar: uma caminhada rápida, escrever sem filtro ou apertar uma almofada. Depois, respire fundo algumas vezes.',
  ],
  desanimado: [
    'Escolha a menor tarefa possível, como beber um copo de água ou abrir a janela. Já conta como passo.',
  ],
  geral: [
    'Uma ideia para agora: escolha uma coisa pequena que acolha você hoje, como um chá, um banho morno, uma música, ou escrever duas linhas sobre o que sente.',
    'Às vezes o primeiro cuidado é só desacelerar: alguns minutos sem tela, respirando devagar.',
  ],
};

const VALIDACAO = {
  saudade: [
    'A saudade é o amor procurando um lugar para ficar. Faz sentido ela apertar assim.',
    'Sentir saudade não é estar parado no tempo: é a prova de um vínculo que continua importante.',
    'Saudade dói porque o amor foi grande. Você não precisa apressar esse sentimento.',
    'Tem dias em que a falta fica mais presente. Obrigada por me contar sobre ela.',
  ],
  triste: [
    'Sinto muito que hoje esteja pesado. A tristeza também merece espaço, sem pressa para passar.',
    'Chorar, ficar em silêncio, sentir o peito apertado: tudo isso faz parte. Você não está fazendo nada errado.',
    'Dias tristes não apagam o caminho que você já fez. Estou aqui com você neste momento.',
  ],
  sozinho: [
    'Sentir-se só no luto é muito comum, e mesmo assim dói. Que bom que você escreveu aqui.',
    'A solidão às vezes aparece mesmo com gente por perto. Você não precisa dar conta de tudo sem apoio.',
    'Você não é invisível. O que você sente importa.',
  ],
  medo: [
    'O medo costuma crescer quando a gente olha para o futuro inteiro de uma vez. Vamos olhar só para agora?',
    'É natural sentir medo depois de uma perda: o chão mudou. Neste momento, você está em segurança.',
    'O medo é um sinal de cuidado, mas não precisa conduzir o seu dia. Vamos respirar um pouco?',
  ],
  ansioso: [
    'Quando a ansiedade acelera, o corpo pede uma pausa. Que tal desacelerar comigo por um minuto?',
    'Pensamentos que não param cansam muito. Você não precisa resolver tudo agora.',
    'A ansiedade passa como uma onda. Vamos encontrar um ponto firme para atravessar essa?',
  ],
  culpado: [
    'A culpa no luto quase sempre é amor tentando reescrever a história. Você fez o melhor que podia com o que sabia naquele momento.',
    'Os "e se" machucam muito. Olhar para você com a mesma gentileza que teria com alguém que ama também é cuidado.',
    'Muitas pessoas carregam frases não ditas. Elas ainda podem encontrar um lugar, por exemplo, numa carta.',
  ],
  raiva: [
    'A raiva também faz parte do luto. Ela não faz de você uma pessoa ruim.',
    'É compreensível sentir revolta diante do que parece injusto. Sua raiva pode existir sem machucar você.',
    'Às vezes a raiva é a dor vestida de força. Quer colocar isso para fora de um jeito seguro?',
  ],
  desanimado: [
    'Quando falta energia, o pequeno já é muito. Hoje pode ser um dia de fazer só o essencial.',
    'Cansaço no luto é real: o corpo também sente. Descansar não é desistir.',
    'Nem todo dia precisa render. Estar aqui, conversando, já é um passo.',
  ],
  grato: [
    'Que bonito perceber a gratidão mesmo nos dias difíceis. Ela também ajuda a atravessar.',
    'A gratidão não apaga a dor, mas acende uma luz ao lado dela. Que bom que ela apareceu.',
  ],
  tranquilo: [
    'Que bom sentir um pouco de paz. Dá para guardar esse momento com carinho.',
    'Dias tranquilos também fazem parte do caminho. Aproveite essa calma sem culpa.',
  ],
  esperancoso: [
    'A esperança é um recomeço silencioso. Que bom que ela está com você hoje.',
    'Olhar para frente com esperança não significa esquecer. Significa continuar levando o amor junto.',
  ],
  alegre: [
    'Que alegria ler isso! Sentir-se bem também é permitido, e merece ser lembrado.',
    'Sorrir no meio do luto não é traição a ninguém. É vida pulsando.',
  ],
  amoroso: [
    'O amor continua, mesmo quando muda de forma. Que bonito sentir isso hoje.',
    'Esse carinho que você sente é um tesouro. Que tal guardar essa lembrança?',
  ],
};

const PERGUNTAS = {
  saudade: ['Quer me contar de quem é essa saudade?', 'Alguma lembrança apareceu mais forte hoje?', 'O que você mais gostaria de dizer a essa pessoa agora?'],
  triste: ['O que deixou o dia mais pesado?', 'O seu corpo está pedindo o quê agora: descanso, colo, silêncio?'],
  sozinho: ['Existe alguém com quem você se sinta à vontade para mandar uma mensagem hoje?', 'Em que momentos a solidão aparece mais: à noite, nos fins de semana?'],
  medo: ['Do que exatamente você tem medo agora?', 'O que te ajudaria a se sentir um pouco mais em paz hoje?'],
  ansioso: ['O que está ocupando mais os seus pensamentos?', 'Quer tentar um exercício rápido de respiração comigo?'],
  culpado: ['Qual frase não dita fica voltando para você?', 'O que você diria a alguém querido que estivesse sentindo essa mesma culpa?'],
  raiva: ['Contra o que (ou quem) essa raiva está apontando?', 'Onde você sente essa raiva no corpo?'],
  desanimado: ['Qual seria a menor coisa possível que você conseguiria fazer por você hoje?', 'Você tem conseguido descansar?'],
  positivo: ['O que contribuiu para esse momento bom?', 'Quer registrar isso como uma pequena vitória?'],
  geral: ['Como você está se sentindo agora, de verdade?', 'Quer me contar um pouco mais?', 'O que você está precisando neste momento?'],
};

const TEMA = {
  sono: 'Noites mal dormidas deixam tudo mais difícil. Um áudio calmo antes de deitar pode ajudar o corpo a desacelerar.',
  data: 'Datas especiais costumam reacender a falta. Vale preparar um gesto de carinho para esse dia, do seu jeito.',
  memoria: 'Objetos, fotos e músicas guardam muito de quem amamos. Escrever sobre essa lembrança pode trazer conforto.',
  familia: 'O luto mexe com toda a família, e cada pessoa sente de um jeito. Você também merece cuidado.',
  trabalho: 'Voltar à rotina com o coração ferido exige muita energia. Seja gentil com o seu ritmo.',
  saude: 'Cuidar do corpo também é cuidar do luto. Se algo estiver te preocupando na saúde, procure um profissional.',
  pet: 'A perda de um bichinho é luto de verdade. O amor que vocês viveram merece ser honrado.',
};

const RESPIRACAO = 'Vamos fazer juntos, sem pressa:\n\n1. Inspire pelo nariz contando até 4.\n2. Segure o ar contando até 4.\n3. Solte pela boca contando até 6.\n\nRepita 4 vezes. Se a mente fugir, tudo bem, é só voltar para o ar entrando e saindo.';
const ANCORAGEM = 'Um exercício para voltar ao presente:\n\n• 5 coisas que você vê\n• 4 coisas que você pode tocar\n• 3 sons que você escuta\n• 2 cheiros ao seu redor\n• 1 respiração lenta e profunda\n\nEle ajuda a acalmar quando a cabeça acelera.';

// Sugestões que levam a telas do app.
const ACOES = {
  audio: { rotulo: 'Ouvir um áudio de acolhimento', icone: 'headset-outline', tela: 'Audios' },
  diario: { rotulo: 'Escrever no diário guiado', icone: 'create-outline', tela: 'DiarioGuiado' },
  vitoria: { rotulo: 'Registrar uma pequena vitória', icone: 'star-outline', tela: 'PequenasVitorias' },
  rede: { rotulo: 'Ver minha rede de apoio', icone: 'people-outline', tela: 'RedeApoio' },
  checkin: { rotulo: 'Fazer meu check-in', icone: 'heart-outline', tela: 'CheckIn' },
  jornada: { rotulo: 'Continuar uma jornada', icone: 'compass-outline', tela: 'Jornadas' },
  respirar: { rotulo: 'Respirar comigo agora', icone: 'leaf-outline', interno: 'respirar' },
  ancorar: { rotulo: 'Exercício para voltar ao presente', icone: 'hand-left-outline', interno: 'ancorar' },
  cvv: { rotulo: 'Ligar para o CVV (188)', icone: 'call-outline', link: 'tel:188' },
};

const SUGESTOES = {
  saudade: ['audio', 'diario', 'jornada'],
  triste: ['audio', 'diario', 'respirar'],
  sozinho: ['rede', 'diario', 'audio'],
  medo: ['respirar', 'ancorar', 'audio'],
  ansioso: ['respirar', 'ancorar', 'audio'],
  culpado: ['diario', 'audio', 'rede'],
  raiva: ['respirar', 'diario', 'audio'],
  desanimado: ['vitoria', 'audio', 'diario'],
  positivo: ['vitoria', 'diario', 'jornada'],
  geral: ['checkin', 'audio', 'diario'],
};

export const RESPOSTAS_RAPIDAS = [
  'Estou com muita saudade',
  'Hoje está pesado',
  'A ansiedade está alta',
  'Não consigo dormir',
  'Estou sentindo culpa',
  'Hoje foi um dia bom',
];

const POSITIVAS = ['grato', 'tranquilo', 'esperancoso', 'alegre', 'amoroso'];
const nomeDe = (ctx) => (ctx?.nome ? `, ${ctx.nome}` : '');
const acoes = (chaves) => chaves.map(k => ({ id: k, ...ACOES[k] }));

export function mensagemInicial(ctx = {}) {
  const emocaoHoje = ctx.emocaoHoje;
  if (emocaoHoje && VALIDACAO[emocaoHoje]) {
    const rotulo = ctx.rotuloEmocaoHoje ? ctx.rotuloEmocaoHoje.toLowerCase() : 'como você estava';
    return {
      texto: `Oi${nomeDe(ctx)}. Eu sou a AtravessIA. Vi que no check-in de hoje você marcou "${rotulo}". Quer me contar um pouco sobre isso?`,
      sugestoes: [],
    };
  }
  return {
    texto: `Oi${nomeDe(ctx)}. Eu sou a AtravessIA. Pode me contar como você está agora, do seu jeito, sem pressa. Estou aqui para te ouvir.`,
    sugestoes: [],
  };
}

/**
 * Responde a uma mensagem da usuária.
 * @param {string} texto
 * @param {object} ctx  { nome, usados: string[], ultimaEmocao, turno }
 * @returns {{ texto, sugestoes, risco, emocao, usados }}
 */
export function responder(texto, ctx = {}) {
  const a = analisar(texto);
  const usados = [...(ctx.usados || [])].slice(-12);
  const marcar = (frase) => { usados.push(frase); return frase; };

  // 1) Segurança sempre em primeiro lugar.
  if (a.risco) {
    return {
      risco: true,
      emocao: a.principal,
      usados,
      texto: `Obrigada por confiar isso a mim${nomeDe(ctx)}. O que você está sentindo é muito sério e você merece ajuda agora, de uma pessoa.\n\n• CVV: ligue 188 (gratuito, 24 horas) ou acesse cvv.org.br\n• Em emergência: SAMU 192\n• Fale com alguém da sua rede de confiança\n\nVocê não está só. Se puder, não fique sem companhia neste momento.`,
      sugestoes: acoes(['cvv', 'rede']),
    };
  }

  // 2) Pedidos diretos de exercício.
  const n = ` ${texto.toLowerCase()} `;
  if (/respir/.test(n)) {
    return { texto: RESPIRACAO, sugestoes: acoes(['ancorar', 'audio']), risco: false, emocao: ctx.ultimaEmocao, usados };
  }
  if (/presente|ancor|5 4 3|acalmar/.test(n)) {
    return { texto: ANCORAGEM, sugestoes: acoes(['respirar', 'audio']), risco: false, emocao: ctx.ultimaEmocao, usados };
  }

  // 3) Saudação, agradecimento e despedida.
  if (a.saudacao && !a.principal) {
    return {
      texto: marcar(escolher([`Oi${nomeDe(ctx)}. Que bom ter você aqui. Como está o seu coração hoje?`, `Olá${nomeDe(ctx)}. Estou aqui. Como você está se sentindo agora?`], usados)),
      sugestoes: [], risco: false, emocao: null, usados,
    };
  }
  if (a.despedida) {
    return {
      texto: `Obrigada por conversar comigo${nomeDe(ctx)}. Cuide-se com carinho. Quando quiser, estarei aqui.`,
      sugestoes: acoes(['vitoria']), risco: false, emocao: ctx.ultimaEmocao, usados,
    };
  }
  if (a.agradecimento && !a.principal) {
    return {
      texto: marcar(escolher(['Eu que agradeço pela confiança. Quer continuar conversando ou prefere um cuidado para agora?', 'Fico feliz em estar com você. Lembre-se: um passo de cada vez.'], usados)),
      sugestoes: acoes(['audio', 'diario']), risco: false, emocao: ctx.ultimaEmocao, usados,
    };
  }

  // Mensagens curtas ou pedidos de ajuda continuam o assunto anterior.
  const emocao = a.principal || ((a.curta || a.pedido) ? ctx.ultimaEmocao : null);
  const grupo = emocao ? (POSITIVAS.includes(emocao) ? 'positivo' : emocao) : 'geral';
  const partes = [];

  if (emocao && VALIDACAO[emocao]) {
    partes.push(marcar(escolher(VALIDACAO[emocao], usados)));
  } else if (!a.temas.length) {
    partes.push(marcar(escolher([
      'Obrigada por compartilhar. Estou aqui com você.',
      'Entendo. O que você sente faz sentido, mesmo quando é difícil colocar em palavras.',
      'Te ouvi. Às vezes só escrever já alivia um pouco.',
    ], usados)));
  }

  // Tema do dia a dia (sono, datas, memórias...), uma frase só.
  const tema = a.temas.find(tm => TEMA[tm] && !usados.includes(TEMA[tm]));
  if (tema) partes.push(marcar(TEMA[tema]));

  // Pedido de ajuda: oferece um cuidado concreto.
  if (a.pedido) {
    partes.push(marcar(escolher(CUIDADO_AGORA[emocao] || CUIDADO_AGORA.geral, usados)));
  }

  // Se a pessoa já disse de quem sente falta (mãe, filho, pet...), não pergunta de novo.
  const jaDisseQuem = a.temas.includes('familia') || a.temas.includes('pet') || ctx.jaDisseQuem;
  const opcoes = (PERGUNTAS[grupo] || PERGUNTAS.geral).filter(q => !(jaDisseQuem && /de quem/.test(q)));
  const pergunta = escolher(opcoes.length ? opcoes : PERGUNTAS.geral, usados);
  partes.push(marcar(pergunta));

  return {
    texto: partes.join('\n\n'),
    sugestoes: acoes(SUGESTOES[grupo] || SUGESTOES.geral),
    risco: false,
    emocao: emocao || ctx.ultimaEmocao || null,
    jaDisseQuem,
    usados,
  };
}

export const EXERCICIOS = { respirar: RESPIRACAO, ancorar: ANCORAGEM };
