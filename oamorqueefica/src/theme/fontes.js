// Fontes carregadas na abertura do app (useFonts em App.js).
// Uma família só em todo o app: Figtree. "Titulo" e "TituloLeve" são apelidos
// da Figtree usados nos títulos e nas frases (antes eram outra fonte); ver
// ajustarEstilo em ./index.js, que calibra o tamanho desses textos.
import {
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold_Italic } from '@expo-google-fonts/cormorant-garamond';

export const FONTES = {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  Titulo: Figtree_700Bold,
  TituloLeve: Figtree_500Medium,
  // Fonte da marca: só no nome "Atravessia" ao lado do logo, na saudação e na Frase do dia.
  Marca: CormorantGaramond_600SemiBold_Italic,
  MarcaLeve: CormorantGaramond_500Medium_Italic,
};
