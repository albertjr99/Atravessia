// Design System — "O Amor Que Fica"
// Cores extraídas do protótipo Lovable

export const colors = {
  bg: '#F8F4EE',           // Creme — fundo principal
  card: '#FFFDF9',         // Cartão — bege claro
  primary: '#9b86bd',      // Lavanda — primária
  primaryFg: '#ffffff',
  secondary: '#ECE3D6',    // Bege claro
  secondaryFg: '#5a5364',
  muted: '#EFE9E0',
  mutedFg: '#8c8597',
  accent: '#EBE3F3',       // Lavanda clara
  accentFg: '#6b5b88',
  border: '#E6DDD2',
  ring: '#C8B8DB',

  td: '#4a4453',           // Texto escuro
  tm: '#8c8597',           // Texto médio
  tl: '#a89eb8',           // Texto leve

  // Cores secundárias
  rose: '#D8B4B6',
  roseFg: '#6b4a4c',
  sage: '#A8B8A0',
  sageFg: '#475042',
  gold: '#D4B483',
  goldFg: '#5e4d2c',

  // Emoções
  emotion: {
    triste: '#8FA3BF',
    saudoso: '#B8A6C9',
    ansioso: '#9FB2C7',
    grato: '#D4B483',
    esperancoso: '#A8B8A0',
    empaz: '#A8B8A0',
    alegria: '#F4D6A0',
  },

  // Aliases antigos (compatibilidade)
  lav1: '#EBE3F3',
  lav2: '#DDD0EE',
  lav3: '#C8B8DB',
  lav4: '#B8A6C9',
  lav5: '#9b86bd',
  lav6: '#6b5b88',
  peach: '#EFD5C0',
  peach2: '#D4B483',
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
