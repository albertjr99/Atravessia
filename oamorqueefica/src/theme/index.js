import { StyleSheet } from 'react-native';

// Design System — Atravessia
// Paleta oficial da identidade visual Atravessia (cores institucionais
// obrigatórias do Instagram + cores exclusivas de apoio do aplicativo)

const CLARO = {
  bg: '#FAF7F3',           // Creme — fundo principal
  card: '#FFFDF9',         // Cartão — bege claro
  primary: '#8B7AC0',      // Lilás Travessia — primária (oficial)
  primaryFg: '#ffffff',
  secondary: '#EADCCB',    // Bege Areia
  secondaryFg: '#4A4B4A',
  muted: '#EADCCB',        // Bege Areia
  mutedFg: '#4A4B4A',
  accent: '#D8D1E6',       // Lilás Neblina
  accentFg: '#4A4B4A',
  border: '#E6DDD2',
  ring: '#A89AC9',         // Lilás Suave

  td: '#4A4B4A',           // Texto escuro — Cinza Grafite
  tm: '#76737A',           // Texto médio
  tl: '#A39FA3',           // Texto leve

  // Cores secundárias
  rose: '#D4A89A',         // Rosa Empoeirado
  roseFg: '#6b4a42',
  sage: '#7A9E7E',         // Verde Sálvia
  sageFg: '#3F5440',
  gold: '#D4B483',
  goldFg: '#5e4d2c',
  azulNevoa: '#B9C8DF',    // Azul Névoa
  azulClaro: '#CFE3E3',    // Azul Claro
  taupesuave: '#CDB9A6',   // Taupe Suave

  // Emoções
  emotion: {
    triste: '#B9C8DF',
    saudoso: '#D8D1E6',
    ansioso: '#CFE3E3',
    grato: '#D4B483',
    esperancoso: '#7A9E7E',
    empaz: '#A8B8A0',
    alegria: '#F2C9B8',
  },

  // Escala lilás Atravessia (da mais clara à mais escura)
  lav1: '#EDE9F5',          // Lilás muito suave (backgrounds)
  lav2: '#D8D1E6',          // Lilás Neblina
  lav3: '#A89AC9',          // Lilás Suave
  lav4: '#8B7AC0',          // Lilás Travessia (principal)
  lav5: '#7B6BAF',          // Lilás mais escuro (ênfase)
  lav6: '#5C4F8A',          // Lilás profundo (títulos)
  peach: '#F2C9B8',         // Pêssego Claro
  peach2: '#D4A89A',        // Rosa Empoeirado
  white: '#FFFFFF',

  // Tokens de superfície/texto usados nas telas (antes eram cores fixas).
  titulo: '#4a4453',        // títulos e textos fortes da tela inicial
  texto2: '#8c8597',        // textos de apoio
  lilasIcone: '#9b86bd',    // ícones e links lilás
  botao: '#9b86bd',         // fundo de botão com texto branco
  botaoForte: '#7B6BAF',    // fundo de botão principal com texto branco
  lilasTexto: '#6b5b88',    // texto lilás sobre fundo lilás claro
  lavVeu: 'rgba(235,227,243,0.5)',
  bordaSuave: 'rgba(230,221,210,0.7)',
  vidro: 'rgba(255,253,249,0.8)',       // botões sobre a imagem do topo
  vidroForte: 'rgba(255,253,249,0.96)', // barra inferior
  headerVeu: 'transparent',             // véu sobre a imagem do topo (noturno)
  erroFundo: '#FFF0EE',
  sageFundo: '#EEF5EF',
  roseFundo: '#F7E8EA',
  roseTexto: '#A0525E',
  douradoFundo: '#FBF4E8',
  douradoBorda: '#EBD9B8',
  douradoIcone: '#F3E4C6',
  douradoTitulo: '#6B5326',
  douradoTexto: '#8A7550',
  sobreposicao: 'rgba(46,39,64,0.35)',
  statusBar: 'dark-content',
  escuro: false,
};
// Modo noturno em lilás profundo. Os tons de destaque (lilás, sálvia, dourado)
// continuam os mesmos para manter a identidade; fundos e textos se invertem.
const ESCURO = {
  ...CLARO,
  bg: '#1A1622',
  card: '#25202F',
  primary: '#9C8BD4',
  secondary: '#3A3245',
  secondaryFg: '#ECE7F4',
  muted: '#3A3245',
  mutedFg: '#ECE7F4',
  accent: '#3B3350',
  accentFg: '#ECE7F4',
  border: '#3A3348',
  ring: '#8E7FC2',
  td: '#ECE7F4',
  tm: '#B9B2C6',
  tl: '#8D869B',
  roseFg: '#E8BFB5',
  sageFg: '#A9CDAE',
  goldFg: '#E6CB97',
  lav1: '#2E2840',
  lav2: '#3E3654',
  lav3: '#8E7FC2',
  lav4: '#8270C4',
  lav5: '#B6A7EC',
  lav6: '#DCD2F7',
  peach: '#5A3F37',
  white: '#FFFFFF',
  titulo: '#EEE9F6',
  texto2: '#ADA6BB',
  lilasIcone: '#BBAAE6',
  botao: '#7562B8',
  botaoForte: '#6C5AB5',
  lilasTexto: '#D3C8F0',
  lavVeu: 'rgba(62,52,86,0.55)',
  bordaSuave: 'rgba(78,68,98,0.85)',
  vidro: 'rgba(37,32,47,0.85)',
  vidroForte: 'rgba(33,28,43,0.97)',
  headerVeu: 'rgba(26,22,34,0.55)',
  erroFundo: '#3A2626',
  sageFundo: '#24322A',
  roseFundo: '#3D2A2E',
  roseTexto: '#E7A9B2',
  douradoFundo: '#2E2719',
  douradoBorda: '#4D4027',
  douradoIcone: '#43391F',
  douradoTitulo: '#EED9AE',
  douradoTexto: '#C9B48A',
  sobreposicao: 'rgba(0,0,0,0.55)',
  statusBar: 'light-content',
  escuro: true,
};

// `colors` é um objeto único que troca de valores conforme o tema (as telas
// leem `colors.x` na hora de desenhar). Os estilos criados com `criarEstilos`
// são refeitos quando o tema muda.
export const colors = { ...CLARO };
export const tema = { atual: 'claro', versao: 0 };

export function aplicarPaleta(nome) {
  const escuro = nome === 'escuro';
  if (tema.atual === (escuro ? 'escuro' : 'claro') && tema.versao > 0) return false;
  Object.assign(colors, escuro ? ESCURO : CLARO);
  tema.atual = escuro ? 'escuro' : 'claro';
  tema.versao += 1;
  return true;
}


export const fonts = {
  script: 'DancingScript_600SemiBold',
  serif: 'PlayfairDisplay_400Regular',
  serifItalic: 'PlayfairDisplay_400Regular_Italic',
  body: 'Lato_400Regular',
  bodyBold: 'Lato_700Bold',
  bodyLight: 'Lato_300Light',
  quote: 'CormorantGaramond_400Regular_Italic',
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
};

export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, '3xl': 24, full: 999,
};

export const shadow = {
  card: {
    shadowColor: '#6b5b7a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  soft: {
    shadowColor: '#9b86bd',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 6,
  },
};

// Letras maiores e mais confortáveis nas telas da usuária: os tamanhos
// pequenos crescem mais, os grandes ficam como estão (9→11, 11→13, 14→15).
function escalarFonte(fs) {
  if (typeof fs !== 'number') return fs;
  if (fs >= 16) return fs;
  if (fs >= 14) return fs + 1;
  if (fs >= 12) return fs + 1.5;
  return fs + 2;
}

function ajustarEstilo(estilo) {
  if (!estilo || typeof estilo !== 'object' || Array.isArray(estilo)) return estilo;
  if (typeof estilo.fontSize !== 'number') return estilo;
  const novo = escalarFonte(estilo.fontSize);
  const r = { ...estilo, fontSize: novo };
  if (typeof estilo.lineHeight === 'number') {
    r.lineHeight = Math.max(Math.round(estilo.lineHeight * (novo / estilo.fontSize)), Math.ceil(novo * 1.25));
  }
  return r;
}

/**
 * StyleSheet que acompanha o tema: `fabrica` é chamada de novo quando o tema
 * muda (claro/noturno), então os valores de `colors` usados nela são sempre
 * os atuais. Também aplica a escala de letras maiores.
 *   const s = criarEstilos(() => ({ caixa: { backgroundColor: colors.card } }));
 */
export function criarEstilos(fabrica, { escalar = true } = {}) {
  let cache = null;
  let versao = -1;
  const obter = () => {
    if (!cache || versao !== tema.versao) {
      const bruto = fabrica();
      const ajustado = {};
      Object.keys(bruto).forEach(k => { ajustado[k] = escalar ? ajustarEstilo(bruto[k]) : bruto[k]; });
      cache = StyleSheet.create(ajustado);
      versao = tema.versao;
    }
    return cache;
  };
  return new Proxy({}, {
    get: (_, k) => obter()[k],
    has: (_, k) => k in obter(),
    ownKeys: () => Reflect.ownKeys(obter()),
    getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, value: obter()[k] }),
  });
}
