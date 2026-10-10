// AtravessIA — análise de texto própria (sem serviços externos e sem custo
// por uso). Reconhece emoções, temas e sinais de risco a partir de um
// dicionário em português, pensado para o universo do luto e das perdas.
//
// Tudo roda no aparelho: o que a usuária escreve não sai do celular.

// Remove acentos e pontuação para comparar palavras ("Saudade!" → "saudade").
export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cada emoção tem raízes de palavras (prefixos) e expressões inteiras.
// Os ids são os mesmos do check-in.
const EMOCOES = {
  saudade: {
    raizes: ['saudad', 'falta del', 'falta dele', 'sinto falta', 'lembr', 'recorda', 'memori', 'queria que estivesse', 'queria ele', 'queria ela', 'nunca mais', 'se foi', 'partiu', 'perdi ', 'perda', 'luto', 'faleceu', 'morreu', 'morte', 'aniversario de morte'],
  },
  triste: {
    raizes: ['trist', 'chor', 'lagrim', 'dor ', 'doi ', 'doendo', 'doida de saudade', 'arrasad', 'abatid', 'magoad', 'machuc', 'vazio', 'vazia', 'pesad', 'angusti', 'sofr', 'deprimid', 'pra baixo', 'para baixo'],
  },
  sozinho: {
    raizes: ['sozinh', 'solidao', 'solitari', 'isolad', 'ninguem', 'abandon', 'sem ninguem', 'nao tenho com quem', 'invisivel'],
  },
  medo: {
    raizes: ['medo', 'assust', 'apavor', 'pavor', 'receio', 'insegur', 'perder mais', 'e se ', 'futuro'],
  },
  ansioso: {
    raizes: ['ansios', 'ansiedade', 'nervos', 'agitad', 'preocup', 'nao consigo parar de pensar', 'coracao acelerado', 'acelerad', 'aflit', 'inquiet', 'panico', 'tenso', 'tensa', 'tensao'],
  },
  culpado: {
    raizes: ['culpa', 'culpad', 'devia ter', 'deveria ter', 'se eu tivesse', 'nao fiz', 'nao disse', 'arrepend', 'remorso', 'minha culpa', 'nao me perdoo'],
  },
  raiva: {
    raizes: ['raiva', 'odio', 'revolt', 'injust', 'irritad', 'furios', 'brav', 'indign', 'nao aceito', 'por que comigo'],
  },
  desanimado: {
    raizes: ['desanim', 'cansad', 'exaust', 'sem forca', 'sem energia', 'sem vontade', 'desmotiv', 'nada faz sentido', 'tanto faz', 'nao aguento mais', 'esgotad', 'apatic', 'desist'],
  },
  grato: {
    raizes: ['grat', 'agradec', 'obrigad', 'abencoad', 'sorte de'],
  },
  tranquilo: {
    raizes: ['tranquil', 'calm', 'em paz', 'serena', 'sereno', 'leve', 'aliviad', 'descansad'],
  },
  esperancoso: {
    raizes: ['esperanc', 'vai melhorar', 'vai passar', 'confiant', 'otimis', 'recomec', 'seguir em frente', 'aos poucos'],
  },
  alegre: {
    raizes: ['feliz', 'alegr', 'content', 'sorri', 'rir', 'animad', 'bem hoje', 'dia bom', 'um bom dia'],
  },
  amoroso: {
    raizes: ['amor', 'amo ', 'carinho', 'abraco', 'saudade boa', 'lembranca boa', 'conexao'],
  },
};

// Temas do dia a dia que mudam a forma de acolher.
const TEMAS = {
  sono: ['dorm', 'insonia', 'sono', 'acordo de madrugada', 'pesadelo', 'madrugada'],
  data: ['aniversari', 'natal', 'dia das maes', 'dia dos pais', 'data', 'faz um ano', 'faz um mes', 'missa', 'finados'],
  memoria: ['foto', 'roupa', 'cheiro', 'musica', 'casa del', 'quarto', 'objeto', 'lembranca', 'carta'],
  familia: ['filh', 'mae', 'pai', 'marido', 'esposa', 'irma', 'irmao', 'familia', 'neto', 'avo', 'mamae', 'papai'],
  trabalho: ['trabalh', 'emprego', 'chefe', 'servico', 'faculdade', 'estud'],
  saude: ['doenca', 'hospital', 'remedio', 'medico', 'dor no peito', 'cabeca'],
  pet: ['cachorr', 'gat', 'pet', 'bichinho', 'animal'],
};

// Sinais de risco: qualquer menção leva a uma resposta de cuidado imediata,
// com o CVV (188) e a Rede de Apoio. Melhor pecar pelo excesso de cuidado.
const RISCO = [
  'me matar', 'vou me matar', 'suicid', 'tirar minha vida', 'tirar a minha vida', 'acabar com tudo', 'acabar com a minha vida',
  'nao quero mais viver', 'nao quero viver', 'quero morrer', 'queria morrer', 'melhor morrer', 'melhor sem mim',
  'sumir pra sempre', 'sumir para sempre', 'me machucar', 'me cortar', 'autolesao', 'nao vejo saida', 'sem saida',
  'desistir de tudo', 'desistir da vida', 'ir junto com', 'ir embora junto', 'encontrar com ele do outro lado',
  'encontrar com ela do outro lado', 'nao aguento viver',
];

const SAUDACAO = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'opa', 'e ai'];
const DESPEDIDA = ['tchau', 'ate logo', 'ate mais', 'boa noite tchau', 'vou dormir', 'ate amanha', 'obrigada por hoje', 'obrigado por hoje'];
const PEDIDO = ['o que eu faco', 'o que faco', 'o que fazer', 'o que posso fazer', 'o que eu posso fazer', 'o que eu poderia', 'o que voce sugere', 'o que voce acha', 'como eu faco', 'como melhorar', 'como aliviar', 'me ajude', 'algum conselho', 'conselho', 'me ajuda', 'preciso de ajuda', 'como faco', 'como lidar', 'como passar', 'como superar', 'alguma dica', 'sugest'];
const AGRADECIMENTO = ['obrigad', 'valeu', 'agradeco', 'me ajudou', 'ajudou muito'];

// Os termos casam no início de uma palavra: "dor " não pega "dormir" e
// "trist" pega "triste" e "tristeza".
const contem = (texto, termos) => termos.filter(termo => texto.includes(` ${termo}`)).length;

/**
 * Lê uma mensagem e devolve o que ela expressa.
 * @returns {{ risco, emocoes: Array<{id, peso}>, principal, temas, saudacao, despedida, pedido, agradecimento, curta }}
 */
export function analisar(textoOriginal) {
  const t = ` ${normalizar(textoOriginal)} `;
  const risco = RISCO.some(r => t.includes(` ${r}`));

  const emocoes = Object.entries(EMOCOES)
    .map(([id, { raizes }]) => ({ id, peso: contem(t, raizes) }))
    .filter(e => e.peso > 0)
    .sort((a, b) => b.peso - a.peso);

  // "Não estou triste" não é tristeza: negação logo antes reduz o peso.
  emocoes.forEach(e => {
    const neg = new RegExp(`\\b(nao|nem|nunca) (estou|to|me sinto|sinto)? ?(${EMOCOES[e.id].raizes.slice(0, 3).join('|')})`);
    if (neg.test(t)) e.peso -= 1;
  });
  const validas = emocoes.filter(e => e.peso > 0);

  const temas = Object.entries(TEMAS).filter(([, termos]) => contem(t, termos) > 0).map(([id]) => id);
  const palavras = t.trim().split(' ').filter(Boolean).length;

  return {
    risco,
    emocoes: validas,
    principal: validas[0]?.id || null,
    temas,
    saudacao: palavras <= 4 && SAUDACAO.some(s => t.includes(` ${s} `) || t.trim().startsWith(s)),
    despedida: DESPEDIDA.some(d => t.includes(d)),
    pedido: PEDIDO.some(p => t.includes(p)),
    agradecimento: AGRADECIMENTO.some(a => t.includes(a)),
    curta: palavras <= 3,
  };
}

export const EMOCOES_DIFICEIS = ['saudade', 'triste', 'sozinho', 'medo', 'ansioso', 'culpado', 'raiva', 'desanimado'];
export const ehDificil = (id) => EMOCOES_DIFICEIS.includes(id);

// Escolhe um item de uma lista sem repetir os últimos usados.
export function escolher(lista, usados = []) {
  const livres = lista.filter(x => !usados.includes(x));
  const base = livres.length ? livres : lista;
  return base[Math.floor(Math.random() * base.length)];
}
