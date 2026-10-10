// AtravessIA — diário guiado: uma pergunta gentil por dia, escolhida pela
// emoção do check-in, e uma devolutiva acolhedora depois que a pessoa escreve.
import { analisar, ehDificil } from './analise';

const PERGUNTAS = {
  saudade: [
    'De quem é a saudade de hoje? Conte uma lembrança boa que vocês viveram.',
    'Se você pudesse dizer uma coisa a essa pessoa agora, o que diria?',
    'Que gesto, cheiro ou música faz você lembrar dessa pessoa com carinho?',
    'O que essa pessoa te ensinou que continua com você?',
  ],
  triste: [
    'O que deixou o seu dia mais pesado? Escreva sem se preocupar com as palavras certas.',
    'Do que o seu coração está precisando hoje?',
    'Se a tristeza pudesse falar, o que ela diria?',
  ],
  sozinho: [
    'Em que momento do dia a solidão aparece mais? O que poderia fazer companhia a você nessa hora?',
    'Quem você gostaria que estivesse por perto agora? Por quê?',
    'Escreva sobre uma conexão (pessoa, lugar ou lembrança) que faz você se sentir acompanhado.',
  ],
  medo: [
    'Do que você tem medo hoje? Escrever ajuda a tirar o medo da cabeça e colocar no papel.',
    'O que está sob o seu controle hoje, mesmo que pequeno?',
    'O que você diria a si mesmo para se acalmar?',
  ],
  ansioso: [
    'O que está ocupando seus pensamentos? Liste tudo, sem filtro.',
    'Desta lista de preocupações, qual pode esperar até amanhã?',
    'O que acalma você quando a cabeça acelera?',
  ],
  culpado: [
    'Escreva uma carta para quem partiu, com o que ficou sem ser dito.',
    'Que palavras de perdão você precisa ouvir hoje? Escreva para você mesmo.',
    'O que você fez de bom por essa pessoa, que talvez esteja esquecendo agora?',
  ],
  raiva: [
    'O que despertou a sua raiva hoje? Escreva tudo, este espaço é seguro.',
    'Por trás dessa raiva, existe alguma dor que quer ser vista?',
    'O que ajudaria a aliviar um pouco essa tensão?',
  ],
  desanimado: [
    'Qual foi a menor coisa que você conseguiu fazer hoje? Ela conta.',
    'O que costuma devolver um pouco da sua energia?',
    'Escreva três coisas simples que você pode fazer amanhã por você.',
  ],
  positivo: [
    'O que fez o dia de hoje ser bom? Guarde esse momento aqui.',
    'Pelo que você se sente grato hoje?',
    'Que pequena vitória você quer lembrar daqui a um tempo?',
  ],
  geral: [
    'Como você está, de verdade, neste momento?',
    'O que você quer lembrar sobre o dia de hoje?',
    'O que você está levando no coração hoje?',
  ],
};

const POSITIVAS = ['grato', 'tranquilo', 'esperancoso', 'alegre', 'amoroso'];

const grupoDe = (emocao) => (!emocao ? 'geral' : POSITIVAS.includes(emocao) ? 'positivo' : (PERGUNTAS[emocao] ? emocao : 'geral'));

// Pergunta do dia: a mesma durante o dia (estável pela data), variando entre os dias.
export function perguntaDoDia(emocao, dataISO) {
  const lista = PERGUNTAS[grupoDe(emocao)];
  const seed = String(dataISO || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return lista[seed % lista.length];
}

export function outrasPerguntas(emocao) {
  return PERGUNTAS[grupoDe(emocao)];
}

// Devolutiva depois de escrever: acolhe sem julgar e sugere um próximo passo.
export function devolutiva(texto) {
  const a = analisar(texto);
  const palavras = String(texto || '').trim().split(/\s+/).filter(Boolean).length;
  if (a.risco) {
    return {
      risco: true,
      texto: 'O que você escreveu mostra uma dor muito grande. Você merece ajuda agora: ligue para o CVV no 188 (gratuito, 24 horas) ou procure alguém de confiança. Você não está só.',
    };
  }
  const partes = [];
  partes.push(palavras > 60
    ? 'Obrigada por se permitir escrever tanto. Colocar em palavras é uma forma corajosa de cuidar de si.'
    : 'Obrigada por escrever. Mesmo poucas linhas já são um gesto de cuidado com você.');
  if (a.principal && ehDificil(a.principal)) {
    const frases = {
      saudade: 'A saudade que aparece no seu texto fala de um amor que continua.',
      triste: 'A tristeza que você descreveu merece colo e tempo.',
      sozinho: 'Você não precisa atravessar isso sem companhia. Pensar em alguém da sua rede pode ajudar.',
      medo: 'O medo fica menor quando é nomeado, e você acabou de fazer isso.',
      ansioso: 'Agora que está no papel, talvez a cabeça consiga descansar um pouco.',
      culpado: 'Que você consiga olhar para si com a mesma gentileza que oferece a quem ama.',
      raiva: 'Sua raiva foi ouvida aqui, sem julgamento.',
      desanimado: 'Nos dias de pouca energia, escrever já é uma vitória.',
    };
    partes.push(frases[a.principal]);
  } else if (a.principal) {
    partes.push('Que bom poder guardar um momento assim. Volte a ele quando precisar.');
  }
  return { risco: false, texto: partes.join(' ') };
}
