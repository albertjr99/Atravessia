import { StyleSheet, Platform } from 'react-native';

// No Android, a sombra (elevation) aparece através de fundos translúcidos e
// acinzenta o cartão; lá o vidro fica um pouco mais opaco.
const ANDROID = Platform.OS === 'android';

// Design System — Atravessia
// Paleta oficial da identidade visual Atravessia (cores institucionais
// obrigatórias do Instagram + cores exclusivas de apoio do aplicativo)

// Revitalização "Luz de Vidro" (1.17.0): fundo porcelana com aurora suave
// (lilás, pêssego e sálvia), cartões de vidro translúcidos com borda de luz,
// Figtree na interface e Cormorant Garamond itálico nos títulos afetivos.
// Os nomes dos tokens continuam os mesmos; só os valores mudaram.
const CLARO = {
  bg: '#F6F1EE',           // Porcelana — fundo principal (a aurora vem por cima)
  card: ANDROID ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.66)', // Cartão de vidro sobre a aurora
  cardSolido: '#FFFCFA',   // Cartão opaco (menus, modais, campos sobre conteúdo)
  primary: '#8B7AC0',      // Lilás Travessia — primária (oficial)
  primaryFg: '#ffffff',
  secondary: '#F1E9EC',
  secondaryFg: '#2A2433',
  muted: '#F1E9EC',
  mutedFg: '#534C60',
  accent: '#DCD2F5',
  accentFg: '#2A2433',
  border: 'rgba(42,36,51,0.10)',
  ring: '#A595DC',

  td: '#2A2433',           // Texto forte (tinta ameixa)
  tm: '#534C60',           // Texto médio
  tl: '#6F6880',           // Texto leve / legendas

  // Cores secundárias
  rose: '#D4A89A',
  roseFg: '#94492F',
  sage: '#6E9B7E',
  sageFg: '#3D6A4E',
  gold: '#C9A15A',
  goldFg: '#765619',
  azulNevoa: '#B5C6E6',
  azulClaro: '#CFE3E3',
  taupesuave: '#CDB9A6',

  // Emoções
  emotion: {
    triste: '#B5C6E6',
    saudoso: '#DCD2F5',
    ansioso: '#CFE3E3',
    grato: '#E2C48E',
    esperancoso: '#6E9B7E',
    empaz: '#9EC4AB',
    alegria: '#F8D2C0',
  },

  // Escala lilás Atravessia (da mais clara à mais escura)
  lav1: '#ECE6FA',
  lav2: '#DCD2F5',
  lav3: '#C3B5EC',
  lav4: '#8B7AC0',          // Lilás Travessia (principal)
  lav5: '#7A65CB',          // ênfase (ícones, botões)
  lav6: '#45358A',          // títulos fortes
  peach: '#F8D2C0',
  peach2: '#D98A69',
  white: '#FFFFFF',

  // Tokens de superfície/texto usados nas telas.
  titulo: '#2A2433',
  texto2: '#534C60',
  lilasIcone: '#7A65CB',
  botao: '#7A65CB',         // topo do botão principal (branco 4,6:1)
  botaoForte: '#5A46AD',    // base do degradê do botão principal
  botaoBase: '#45358A',     // "degrau" do botão com profundidade
  lilasTexto: '#524197',    // links e textos lilás
  lavVeu: 'rgba(236,230,250,0.62)',
  bordaSuave: 'rgba(42,36,51,0.09)',
  bordaLuz: 'rgba(255,255,255,0.85)', // borda de luz dos cartões de vidro
  vidro: 'rgba(255,255,255,0.62)',
  vidroForte: 'rgba(255,255,255,0.86)',
  vidroTenue: 'rgba(255,255,255,0.40)',
  headerVeu: 'transparent',
  sombra: '#3A286E',        // sombras com tinta ameixa, nunca preto puro
  erroFundo: '#FBE6E8',
  sageFundo: '#E3F1E8',
  roseFundo: '#F9E1E9',
  roseTexto: '#A93B4B',
  douradoFundo: '#F7EBD3',
  douradoBorda: '#E2C48E',
  douradoIcone: '#F1DDB4',
  douradoTitulo: '#765619',
  douradoTexto: '#7E5A22',
  // Aurora do fundo
  auroraLilas: '#C5B2F3',
  auroraPessego: '#F8CDB8',
  auroraSalvia: '#C3DDCC',
  auroraOpacidade: 0.85,
  // Cartões-joia (pares do Início): [início, fim, base 3D]
  joiaLilas: ['#EEE7FC', '#D9CBF6', '#BDAAE9'],
  joiaPessego: ['#FEF0E8', '#F7D3C1', '#E9B49C'],
  joiaDourado: ['#FBF3E2', '#F1DDB4', '#DDBD84'],
  joiaLilasTexto: '#45358A',
  joiaPessegoTexto: '#94492F',
  joiaDouradoTexto: '#765619',
  sobreposicao: 'rgba(42,36,51,0.36)',
  statusBar: 'dark-content',
  escuro: false,
};
// Modo noturno: "noite de lavanda" com a aurora em tons profundos.
const ESCURO = {
  ...CLARO,
  bg: '#110E18',
  card: ANDROID ? 'rgba(30,25,43,0.92)' : 'rgba(30,25,43,0.66)',
  cardSolido: '#1C1726',
  primary: '#A996F0',
  secondary: '#2A2238',
  secondaryFg: '#F4F0FA',
  muted: '#2A2238',
  mutedFg: '#CDC5DC',
  accent: '#2E2648',
  accentFg: '#F4F0FA',
  border: 'rgba(255,255,255,0.12)',
  ring: '#BCAAF8',
  td: '#F4F0FA',
  tm: '#CDC5DC',
  tl: '#ABA2BE',
  roseFg: '#F6C8B4',
  sageFg: '#B7DEC4',
  goldFg: '#EED6A6',
  lav1: '#2A2340',
  lav2: '#3A3060',
  lav3: '#8E7FC2',
  lav4: '#8F7BE0',
  lav5: '#BCAAF8',
  lav6: '#D9CFFF',
  peach: '#5A3F37',
  peach2: '#D98A69',
  white: '#FFFFFF',
  titulo: '#F4F0FA',
  texto2: '#CDC5DC',
  lilasIcone: '#BCAAF8',
  botao: '#7560CC',
  botaoForte: '#5541A8',
  botaoBase: '#3A2C80',
  lilasTexto: '#CFC2FF',
  lavVeu: 'rgba(169,150,240,0.13)',
  bordaSuave: 'rgba(255,255,255,0.09)',
  bordaLuz: 'rgba(255,255,255,0.14)',
  vidro: 'rgba(30,25,43,0.62)',
  vidroForte: 'rgba(26,21,38,0.90)',
  vidroTenue: 'rgba(255,255,255,0.05)',
  headerVeu: 'rgba(17,14,24,0.55)',
  sombra: '#000000',
  erroFundo: '#3A2427',
  sageFundo: '#1E2E25',
  roseFundo: '#3A2430',
  roseTexto: '#F29AA6',
  douradoFundo: '#2C2416',
  douradoBorda: '#4D4027',
  douradoIcone: '#43391F',
  douradoTitulo: '#EED6A6',
  douradoTexto: '#CDB78E',
  auroraLilas: '#4B3A8C',
  auroraPessego: '#6A3A40',
  auroraSalvia: '#22503F',
  auroraOpacidade: 0.6,
  joiaLilas: ['#3D3270', '#2E2560', '#221A4A'],
  joiaPessego: ['#4A2C38', '#3A2130', '#2A1622'],
  joiaDourado: ['#4A3C22', '#3A2E15', '#2A210D'],
  joiaLilasTexto: '#D9CFFF',
  joiaPessegoTexto: '#F6C8B4',
  joiaDouradoTexto: '#EED6A6',
  sobreposicao: 'rgba(5,3,10,0.60)',
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


// Figtree na interface; Cormorant Garamond itálico nos títulos afetivos e na marca.
// As fontes carregadas ficam em ./fontes.js.
export const fonts = {
  script: 'CormorantGaramond_600SemiBold_Italic',
  serif: 'CormorantGaramond_600SemiBold_Italic',
  serifItalic: 'CormorantGaramond_500Medium_Italic',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
  bodyLight: 'Figtree_400Regular',
  quote: 'CormorantGaramond_500Medium_Italic',
}

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
};

export const radius = {
  sm: 10, md: 14, lg: 18, xl: 22, xxl: 26, '3xl': 28, full: 999,
};

// Sombras com tinta ameixa (ver colors.sombra).
export const shadow = {
  card: {
    shadowColor: '#3A286E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 3,
  },
  soft: {
    shadowColor: '#5B48A8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
}

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
