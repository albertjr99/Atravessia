import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { criarCanalLembretes } from './lembreteCheckin';
import { criarCanal as criarCanalFrase } from './fraseNotificacao';

// Canal dos avisos enviados pelo servidor (comunicações da equipe, cupons,
// cashback, lembretes automáticos). É um canal novo, com prioridade alta e
// visível na tela de bloqueio: no Android, a prioridade de um canal já criado
// não muda, e o antigo ('default') foi criado com prioridade normal.
export const CANAL_AVISOS = 'avisos';

export async function garantirCanais() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CANAL_AVISOS, {
      name: 'Avisos da Atravessia',
      description: 'Mensagens da equipe, cupons, cashback e lembretes.',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 250, 200, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });
  } catch {}
  await criarCanalLembretes();
  await criarCanalFrase();
}
