import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Vibração suave nas confirmações (check-in registrado, vitória marcada...).
// Pode ser desligada em Aparência; no navegador não faz nada.
let ativa = true;
export function definirVibracaoAtiva(v) { ativa = v !== false; }

function seguro(fn) {
  if (!ativa || Platform.OS === 'web') return;
  try { fn()?.catch?.(() => {}); } catch { /* aparelho sem motor de vibração */ }
}

// Toque leve: seleção de uma opção.
export const vibrarLeve = () => seguro(() => Haptics.selectionAsync());
// Confirmação: algo foi salvo com carinho.
export const vibrarSucesso = () => seguro(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
// Toque médio: um botão importante.
export const vibrarToque = () => seguro(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
