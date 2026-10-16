// Fontes carregadas na abertura do app (useFonts em App.js).
// Uma família só em todo o app: Figtree. "Titulo" e "TituloLeve" são apelidos
// da Figtree usados nos títulos e nas frases (antes eram outra fonte); ver
// ajustarEstilo em ./index.js, que calibra o tamanho desses textos.
import {
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';

export const FONTES = {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  Titulo: Figtree_700Bold,
  TituloLeve: Figtree_500Medium,
};
