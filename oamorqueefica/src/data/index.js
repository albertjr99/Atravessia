export const frases = [
  { id: 1, texto: '"O amor não se despede, ele se transforma em saudade."', autor: 'Shelby Forsythia' },
  { id: 2, texto: '"A saudade não é ausência. É a forma que o amor encontrou para continuar."', autor: '' },
  { id: 3, texto: '"Carregar o luto não significa parar de viver. Significa aprender a continuar com o coração mais cheio."', autor: '' },
  { id: 4, texto: '"Você não precisa superar a perda. Você precisa aprender a carregar o amor que ficou."', autor: '' },
  { id: 5, texto: '"A dor da perda é o preço do amor. E vale cada centavo."', autor: 'Colin Murray Parkes' },
  { id: 6, texto: '"Luto é amor sem lugar para ir. Mas ele encontra um caminho."', autor: '' },
  { id: 7, texto: '"Não existe prazo para sentir saudade. Existe apenas o tempo que você precisa."', autor: '' },
  { id: 8, texto: '"Quem parte deixa raízes. Quem fica, floresce com elas."', autor: '' },
  { id: 9, texto: '"A memória de quem amamos é o presente mais precioso que carregamos."', autor: '' },
  { id: 10, texto: '"Sentir falta é uma forma de continuar amando."', autor: '' },
];

export const reflexoes = [
  { id: 1, texto: 'Às vezes, tudo o que precisamos é de um respiro e a certeza de que não estamos sozinhos. Hoje, permita-se apenas existir — sem cobranças, sem pressa.' },
  { id: 2, texto: 'O luto não tem forma certa. Cada pessoa sente à sua maneira, no seu tempo. Não compare sua dor com a de ninguém.' },
  { id: 3, texto: 'Cuidar de si mesmo durante o luto não é egoísmo. É respeito pela vida que continua dentro de você.' },
  { id: 4, texto: 'Hoje pode ser um dia difícil. E está tudo bem. Dificuldade não é fraqueza — é humanidade.' },
  { id: 5, texto: 'Lembrar com amor não é viver no passado. É honrar o que foi real e continua sendo parte de quem você é.' },
  { id: 6, texto: 'Você não precisa estar bem o tempo todo. Existem dias para chorar, dias para respirar e dias para simplesmente seguir.' },
  { id: 7, texto: 'A saudade que você sente é prova de um amor verdadeiro. Deixe-a existir sem tentar apagá-la.' },
];

export const emocoes = [
  // ── Negativas ──────────────────────────────────────────────
  {
    id: 'triste', label: 'Triste', icon: 'sad', positiva: false,
    bg: '#EDE5F5', color: '#8FA3BF',
    nomeRelatorio: 'a tristeza',
    mensagens: [
      'Percebemos que a tristeza esteve presente hoje. Que tal reservar alguns minutos para cuidar de você?',
      'Percebemos que hoje você está triste. Gostaria de ouvir um áudio de acolhimento?',
    ],
  },
  {
    id: 'saudade', label: 'Com saudade', icon: 'leaf', positiva: false,
    bg: '#E8E0F0', color: '#B8A6C9',
    nomeRelatorio: 'a saudade',
    mensagens: [
      'A saudade apareceu hoje. Você gostaria de acolher esse sentimento por alguns minutos?',
      'A saudade apareceu por aí hoje. Que tal reservar alguns minutos para ela?',
    ],
  },
  {
    id: 'sozinho', label: 'Sozinho', icon: 'person', positiva: false,
    bg: '#E8F0E5', color: '#7a9870',
    nomeRelatorio: 'o isolamento',
    mensagens: [
      'Sentir-se sozinho pode ser muito difícil. Que tal fazer uma pequena pausa para si agora?',
      'Sentir-se sozinho pode ser pesado. Gostaria de ouvir um áudio de acolhimento?',
    ],
  },
  {
    id: 'medo', label: 'Com medo', icon: 'shield', positiva: false,
    bg: '#EAF0F5', color: '#7088A0',
    nomeRelatorio: 'o medo',
    mensagens: [
      'Percebemos que o medo está presente hoje. Vamos atravessar este momento juntos?',
      'É corajoso reconhecer o medo. Que tal alguns minutos de acolhimento agora?',
    ],
  },
  {
    id: 'culpado', label: 'Culpado', icon: 'alert-circle', positiva: false,
    bg: '#F5EDE5', color: '#B0876A',
    nomeRelatorio: 'a culpa',
    mensagens: [
      'A culpa apareceu hoje. Você merece olhar para esse sentimento com gentileza.',
      'A culpa costuma trazer muitos questionamentos. Que tal ouvir um áudio de acolhimento?',
    ],
  },
  {
    id: 'ansioso', label: 'Ansioso', icon: 'pulse', positiva: false,
    bg: '#F5EDE5', color: '#B89870',
    nomeRelatorio: 'a ansiedade',
    mensagens: [
      'Hoje a ansiedade esteve presente. Que tal desacelerar por alguns minutos?',
      'Sua mente parece estar carregada hoje. Gostaria de um áudio de acolhimento?',
    ],
  },
  {
    id: 'raiva', label: 'Com raiva', icon: 'flash', positiva: false,
    bg: '#F5F0E8', color: '#B0A060',
    nomeRelatorio: 'a raiva',
    mensagens: [
      'A raiva também faz parte da experiência humana. Você gostaria de acolher esse momento?',
      'Percebemos que hoje existe algo que está incomodando você. Vamos acolher isso?',
    ],
  },
  {
    id: 'desanimado', label: 'Desanimado', icon: 'rainy', positiva: false,
    bg: '#EFEFEF', color: '#9088A0',
    nomeRelatorio: 'o desânimo',
    mensagens: [
      'Hoje parece estar mais difícil. Talvez alguns minutos de cuidado possam ajudar.',
      'Nem todos os dias precisam ser produtivos. Que tal alguns minutos para você?',
    ],
  },
  // ── Positivas ──────────────────────────────────────────────
  {
    id: 'grato', label: 'Grato', icon: 'heart', positiva: true,
    bg: '#F0EDE5', color: '#D4B483',
    mensagens: ['A gratidão é um sinal bonito de presença. Guarde esse sentimento com carinho.'],
  },
  {
    id: 'tranquilo', label: 'Em paz', icon: 'flower', positiva: true,
    bg: '#EDF5F0', color: '#70A890',
    mensagens: ['Que bom saber que hoje você está em paz. Permita-se sentir isso plenamente.'],
  },
  {
    id: 'esperancoso', label: 'Esperançoso', icon: 'sunny', positiva: true,
    bg: '#E5EDF0', color: '#A8B8A0',
    mensagens: ['Que bom perceber esperança em você hoje. Continue caminhando nesse ritmo.'],
  },
  {
    id: 'alegre', label: 'Alegre', icon: 'happy', positiva: true,
    bg: '#FFF8E5', color: '#C8A840',
    mensagens: ['A alegria apareceu hoje — que ela possa se expandir e iluminar o seu dia.'],
  },
  {
    id: 'amoroso', label: 'Amoroso', icon: 'rose', positiva: true,
    bg: '#FFF0F5', color: '#C07090',
    mensagens: ['Sentir amor é um ato de cura. Permita-se viver isso plenamente hoje.'],
  },
];

export const audios = [
  {
    id: 1, titulo: 'Quando a saudade aperta', categoria: 'acolhimento',
    duracao: '8 min', plano: 1,
    descricao: 'Um áudio de acolhimento para os momentos em que a saudade parece insuportável.',
    emocoes: ['saudade', 'triste'],
  },
  {
    id: 2, titulo: 'Respiração 4-7-8', categoria: 'respiracao',
    duracao: '5 min', plano: 2,
    descricao: 'Técnica de respiração para acalmar a ansiedade e o sistema nervoso.',
    emocoes: ['ansioso'],
  },
  {
    id: 3, titulo: 'Respirar com o luto', categoria: 'respiracao',
    duracao: '7 min', plano: 2,
    descricao: 'Uma pausa guiada para respirar fundo e se reconectar com o presente.',
    emocoes: ['ansioso', 'triste'],
  },
  {
    id: 4, titulo: 'Você não está sozinho', categoria: 'acolhimento',
    duracao: '10 min', plano: 1,
    descricao: 'Acolhimento para os dias em que o isolamento pesa mais que o normal.',
    emocoes: ['triste', 'sozinho'],
  },
  {
    id: 5, titulo: 'Para as noites difíceis', categoria: 'noturno',
    duracao: '12 min', plano: 1,
    descricao: 'Áudio especial para noites de insônia causadas pelo luto.',
    emocoes: ['ansioso', 'triste'],
  },
  {
    id: 6, titulo: 'Sono tranquilo', categoria: 'noturno',
    duracao: '15 min', plano: 1,
    descricao: 'Relaxamento profundo para um sono mais restaurador.',
    emocoes: ['ansioso'],
  },
  {
    id: 7, titulo: 'Sobre a culpa no luto', categoria: 'informativo',
    duracao: '18 min', plano: 3,
    descricao: 'Reflexão sobre o sentimento de culpa — um dos mais comuns no luto.',
    emocoes: ['culpado', 'raiva'],
  },
  {
    id: 8, titulo: 'O que é o luto complicado', categoria: 'informativo',
    duracao: '20 min', plano: 3,
    descricao: 'Baseado nas pesquisas de Robert Neimeyer sobre tipos de luto.',
    emocoes: ['triste', 'confuso'],
  },
  {
    id: 9, titulo: 'Acolhendo o medo', categoria: 'acolhimento',
    duracao: '9 min', plano: 1,
    descricao: 'Um espaço seguro para reconhecer o medo sem julgamento.',
    emocoes: ['medo'],
  },
  {
    id: 10, titulo: 'Quando o desânimo chega', categoria: 'acolhimento',
    duracao: '8 min', plano: 1,
    descricao: 'Acolhimento para os dias em que tudo parece mais pesado.',
    emocoes: ['desanimado', 'confuso'],
  },
];

// Categorias de conteúdo complementar (Plano 2+) — 1 novo por dia, à escolha
export const conteudosComplementares = [
  { id: 'c1', titulo: 'Pausa guiada — Respirar e voltar ao presente', categoria: 'meditacao', duracao: '6 min' },
  { id: 'c2', titulo: 'Técnica 4-7-8 para momentos de tensão', categoria: 'respiracao', duracao: '5 min' },
  { id: 'c3', titulo: 'O que a neurociência diz sobre a saudade', categoria: 'informativo', duracao: '12 min' },
  { id: 'c4', titulo: 'Comentário: "Sobre o Luto e o Luto" — William Worden', categoria: 'livro', duracao: '10 min' },
  { id: 'c5', titulo: 'Exercício reflexivo — O que essa perda me ensinou', categoria: 'reflexivo', duracao: '7 min' },
  { id: 'c6', titulo: 'Carta inspiradora — "Para quem fica"', categoria: 'carta', duracao: '3 min' },
];

export const jornadas = [
  {
    id: 1,
    titulo: 'Jornada das Datas Sensíveis',
    descricao: 'Prepare-se emocionalmente para as datas que evocam memórias importantes.',
    totalAtividades: 7,
    atividadesConcluidas: 3,
    plano: 2,
    cor: '#DDD0EE',
    atividades: [
      { id: 1, titulo: 'Reconhecendo a data', tipo: 'reflexao', concluida: true },
      { id: 2, titulo: 'O que essa data representa', tipo: 'escrita', concluida: true },
      { id: 3, titulo: 'Respiração de preparação', tipo: 'audio', concluida: true },
      { id: 4, titulo: 'Criando um ritual de lembrança', tipo: 'atividade', concluida: false },
      { id: 5, titulo: 'Rede de apoio para esse dia', tipo: 'reflexao', concluida: false },
      { id: 6, titulo: 'O que você precisa nesse dia', tipo: 'escrita', concluida: false },
      { id: 7, titulo: 'Carta para si mesma', tipo: 'escrita', concluida: false },
    ],
  },
  {
    id: 2,
    titulo: 'Jornada da Saudade',
    descricao: 'Um percurso de 21 dias para aprender a conviver com a saudade.',
    totalAtividades: 21,
    atividadesConcluidas: 0,
    plano: 3,
    cor: '#E8F0E5',
    atividades: Array.from({ length: 21 }, (_, i) => ({
      id: i + 1, titulo: `Dia ${i + 1}`, tipo: i % 3 === 0 ? 'audio' : i % 3 === 1 ? 'reflexao' : 'escrita', concluida: false,
    })),
  },
  {
    id: 3,
    titulo: 'Reconexão com a Vida',
    descricao: 'Vinte e um passos para reencontrar sentido e alegria na vida.',
    totalAtividades: 21,
    atividadesConcluidas: 0,
    plano: 3,
    cor: '#F5EDE5',
    atividades: Array.from({ length: 21 }, (_, i) => ({
      id: i + 1, titulo: `Dia ${i + 1}`, tipo: i % 3 === 0 ? 'audio' : i % 3 === 1 ? 'reflexao' : 'atividade', concluida: false,
    })),
  },
];

// Planos Atravessia — lançamento inicial com Gratuito + Plano 1
// Planos 2 e 3 serão liberados em breve (emBreve: true)
export const planos = [
  {
    id: 0,
    nome: 'Perceber',
    subtitulo: 'Gratuito',
    preco: 0,
    precoLabel: 'Grátis',
    descricao: 'O primeiro passo é perceber como você está.',
    recursos: [
      'Cadastro básico',
      'Frase do dia (365 frases)',
      'Reflexão do dia',
      'Check-in emocional diário',
      'Histórico emocional (últimos 7 dias)',
      'Relatório emocional mensal simples',
      'Notificações de cuidado',
    ],
    emBreve: false,
  },
  {
    id: 1,
    nome: 'Acolher',
    subtitulo: 'R$ 24,90/mês',
    preco: 24.90,
    precoLabel: 'R$ 24,90/mês',
    descricao: 'Aqui, suas emoções encontram acolhimento.',
    recursos: [
      'Tudo do Gratuito',
      'Pequenas Vitórias — registre seus avanços',
      'Áudios noturnos (1 por dia)',
      'Biblioteca de áudios de acolhimento',
      'Feedback emocional diário personalizado',
    ],
    destaque: true,
    emBreve: false,
  },
  {
    id: 2,
    nome: 'Compreender',
    subtitulo: 'Em breve',
    preco: 0,
    precoLabel: 'Em breve',
    descricao: 'Compreenda seus padrões emocionais com mais profundidade.',
    recursos: [
      'Datas sensíveis (até 3 datas)',
      'Jornadas terapêuticas guiadas',
      'Técnicas de respiração e pausas guiadas',
      'Áudios informativos psicoeducativos',
      'Relatório emocional semanal',
    ],
    emBreve: true,
  },
  {
    id: 3,
    nome: 'Evoluir',
    subtitulo: 'Em breve',
    preco: 0,
    precoLabel: 'Em breve',
    descricao: 'Evolua com ferramentas de acompanhamento completo.',
    recursos: [
      'Rede de apoio (até 3 pessoas)',
      'Memorial — fotos e homenagens',
      'Lives exclusivas',
      'Relatório emocional mensal e anual',
    ],
    emBreve: true,
  },
];

export const pequenasVitorias = [
  { id: 1, label: 'Saí de casa' },
  { id: 2, label: 'Consegui dormir' },
  { id: 3, label: 'Encontrei amigos' },
  { id: 4, label: 'Fiz algo prazeroso' },
  { id: 5, label: 'Me alimentei bem' },
  { id: 6, label: 'Busquei minha rede de apoio' },
  { id: 7, label: 'Concluí uma jornada' },
  { id: 8, label: 'Ouvi música' },
  { id: 9, label: 'Me hidratei bem' },
  { id: 10, label: 'Pratiquei respiração' },
];

export const cartasInspiradoras = [
  { id: 1, titulo: 'Para quem fica', autor: 'Comunidade', conteudo: 'Eu também pensei que não fosse conseguir. Mas dia após dia, percebi que carregar essa saudade não me impede de continuar amando a vida.' },
  { id: 2, titulo: 'Um ano depois', autor: 'Comunidade', conteudo: 'Hoje, um ano depois, ainda sinto sua falta todos os dias. Mas aprendi que o amor que ficou também pode me ajudar a seguir.' },
  { id: 3, titulo: 'Continuar vivendo', autor: 'Comunidade', conteudo: 'Não foi fácil voltar a sorrir. Mas percebi que sorrir não é esquecer — é honrar o que vivemos juntos.' },
];

// Tipos de perda para o perfil emocional (cadastro)
export const tiposPerda = ['Mãe', 'Pai', 'Filho(a)', 'Companheiro(a)', 'Amigo(a)', 'Pet', 'Outro'];
export const temposPerda = ['Menos de 1 mês', '1 a 6 meses', '6 meses a 1 ano', '1 a 3 anos', 'Mais de 3 anos'];

// Vínculos para a rede de apoio
export const vinculosRedeApoio = ['Familiar', 'Amigo(a)', 'Companheiro(a)', 'Profissional', 'Outro'];

// Tipos de datas sensíveis
export const tiposDataSensivel = ['Aniversário da pessoa', 'Data da perda', 'Aniversário (seu)', 'Outra data importante'];

// Questionário estrutural inspirado nas dinâmicas de Robert Neimeyer sobre tipos de luto.
// Conteúdo placeholder: a versão final deve usar o texto oficial e validado do instrumento
// (ver página 82 do livro de referência citado no projeto) antes de publicar.
export const perguntasTipoLuto = [
  'Sinto que ainda preciso entender o que essa perda significa para mim.',
  'Tenho dificuldade em aceitar que a perda realmente aconteceu.',
  'Sinto raiva ou revolta quando penso na perda.',
  'Sinto culpa em relação a algo que fiz ou deixei de fazer.',
  'Evito lembranças ou lugares que me façam pensar na perda.',
  'Consigo falar sobre a pessoa/situação perdida sem me desorganizar emocionalmente.',
  'Sinto que minha rotina diária foi profundamente afetada pela perda.',
  'Tenho conseguido encontrar novos significados para minha vida após a perda.',
  'Sinto que tenho apoio de outras pessoas para lidar com essa perda.',
  'Tenho pensamentos frequentes e intrusivos sobre a perda.',
  'Sinto que, com o tempo, tenho conseguido conviver com a saudade sem que ela me impeça de viver.',
];
export const escalaTipoLuto = ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre'];
