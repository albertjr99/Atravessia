// Atravessia Artes — opções do gerador de artes por IA.
// Cópia de oamorqueefica/src/config/artes.js — altere as duas juntas.
// Os ids de formato e estilo precisam bater com FORMATOS_ARTE e ESTILOS_ARTE
// em functions/index.js (lá fica o texto que vai de fato para o modelo).

export const FORMATOS_ARTE = [
  { id: 'post', rotulo: 'Post', detalhe: 'Quadrado · feed', proporcao: [1, 1] },
  { id: 'story', rotulo: 'Story', detalhe: 'Vertical · tela cheia', proporcao: [9, 16] },
  { id: 'banner', rotulo: 'Banner', detalhe: 'Faixa larga · site e e-mail', proporcao: [21, 9] },
  { id: 'paisagem', rotulo: 'Paisagem', detalhe: 'Horizontal', proporcao: [16, 9] },
];

export const ESTILOS_ARTE = [
  { id: 'aquarela', rotulo: 'Aquarela lavanda', descricao: 'Manchas suaves de lilás que se dissolvem no papel.', cores: ['#C3B5EC', '#ECE6FA', '#F8D2C0'] },
  { id: 'botanico', rotulo: 'Botânico realista', descricao: 'Ginkgo, lavanda e ramos em traço fino e luz natural.', cores: ['#9EC4AB', '#E1EEE5', '#F6F1EE'] },
  { id: 'minimalista', rotulo: 'Minimalista suave', descricao: 'Poucas formas, muito respiro e degradês sutis.', cores: ['#F6F1EE', '#DCD2F5', '#FCE7DC'] },
  { id: 'fotografia', rotulo: 'Fotografia acolhedora', descricao: 'Luz de fim de tarde, chá, janela, jardim sereno.', cores: ['#F2B9A0', '#F7EBD3', '#C3DDCC'] },
  { id: 'afetiva', rotulo: 'Ilustração afetiva', descricao: 'Traço delicado, gestos de carinho e companhia.', cores: ['#F2B9A0', '#C3B5EC', '#9EC4AB'] },
];

// Ideias prontas: tocar preenche a descrição (e sugere formato/estilo).
export const IDEIAS_ARTE = [
  { rotulo: 'Frase do dia em fundo de lavanda', prompt: 'Fundo delicado de aquarela lavanda com uma folha de ginkgo num canto e bastante espaço livre no centro para receber a frase do dia.', formato: 'post', estilo: 'aquarela' },
  { rotulo: 'Post de boas-vindas', prompt: 'Uma porta entreaberta para um jardim florido e iluminado pela manhã, transmitindo acolhimento e boas-vindas a quem chega.', formato: 'post', estilo: 'afetiva' },
  { rotulo: 'Convite para o check-in', prompt: 'Uma xícara de chá fumegante ao lado de um caderno aberto, perto de uma janela com luz suave, convidando a parar um instante e olhar para dentro.', formato: 'story', estilo: 'fotografia' },
  { rotulo: 'Divulgação de parceria', prompt: 'Duas mãos entregando um pequeno buquê de lavanda uma para a outra, simbolizando cuidado compartilhado e parceria.', formato: 'paisagem', estilo: 'afetiva' },
  { rotulo: 'Datas sensíveis', prompt: 'Um ramo de flores do campo sobre uma mesa clara, com luz serena, lembrando que o amor permanece nas datas especiais.', formato: 'post', estilo: 'botanico' },
  { rotulo: 'Capa para o site', prompt: 'Paisagem aberta ao amanhecer, com um caminho suave entre campos de lavanda que se perde no horizonte claro.', formato: 'banner', estilo: 'aquarela' },
];

export const PROVEDORES_ARTE = [
  { id: 'openai', rotulo: 'DALL·E', detalhe: 'OpenAI · gpt-image-1' },
  { id: 'gemini', rotulo: 'Nano Banana', detalhe: 'Google · Gemini 2.5 Flash Image' },
];

export const rotuloFormato = (id) => FORMATOS_ARTE.find(f => f.id === id)?.rotulo || id;
export const rotuloEstilo = (id) => ESTILOS_ARTE.find(e => e.id === id)?.rotulo || id;
export const rotuloProvedor = (id) => (id === 'compositor' ? 'Compositor' : PROVEDORES_ARTE.find(p => p.id === id)?.rotulo || id);

// Mensagem amigável a partir do erro de uma callable.
export function mensagemErroArte(e) {
  const codigo = String(e?.code || '').replace('functions/', '');
  if (codigo === 'not-found') {
    return { naoConectado: true, texto: 'O gerador ainda não foi publicado no servidor.' };
  }
  if (codigo === 'failed-precondition' && /não foi conectado/i.test(e?.message || '')) {
    return { naoConectado: true, texto: e.message };
  }
  return { naoConectado: false, texto: e?.message || 'Não foi possível gerar a arte agora.' };
}
