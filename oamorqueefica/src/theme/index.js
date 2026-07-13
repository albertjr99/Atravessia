// Design System — Atravessia
// Paleta oficial da identidade visual Atravessia (cores institucionais
// obrigatórias do Instagram + cores exclusivas de apoio do aplicativo)

export const colors = {
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
};

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
