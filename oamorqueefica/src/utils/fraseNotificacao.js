import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Frase do dia como notificação no aparelho, todos os dias de manhã.
// As notificações são locais: agendamos os próximos dias com a frase que cada
// dia vai ter (a mesma escolha da tela inicial) e refazemos ao abrir o app.

// Canal novo com prioridade alta: o importance de um canal já criado não muda
// no Android, e o antigo ('frase-do-dia') não aparecia em destaque.
export const CANAL_FRASE = 'frase-diaria';
export const FRASE_PADRAO = { ativo: true, hora: 8, minuto: 0 };
const DIAS = 14;
const PREFIXO_ID = 'frase-do-dia-';

const doisDigitos = (n) => String(n).padStart(2, '0');
const chaveDia = (d) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

// Índice da frase de uma data — determinístico por pessoa e dia do ano
// (é o mesmo cálculo usado para a Frase do dia da tela inicial).
export function indiceFraseDoDia(data, uid, total) {
  if (!total) return -1;
  const diaDoAno = Math.floor((data - new Date(data.getFullYear(), 0, 0)) / 86400000);
  const hashUid = uid ? uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) : 0;
  return (diaDoAno + hashUid) % total;
}

export function normalizarPrefFrase(pref) {
  const hora = Number.isInteger(pref?.hora) && pref.hora >= 0 && pref.hora <= 23 ? pref.hora : FRASE_PADRAO.hora;
  const minuto = Number.isInteger(pref?.minuto) && pref.minuto >= 0 && pref.minuto <= 59 ? pref.minuto : FRASE_PADRAO.minuto;
  return { ativo: pref?.ativo !== false, hora, minuto };
}

export async function criarCanal() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CANAL_FRASE, {
      name: 'Frase do dia',
      description: 'Uma frase de acolhimento todas as manhãs.',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {}
}

async function cancelar() {
  try {
    const agendadas = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(agendadas
      .filter(n => n.identifier?.startsWith(PREFIXO_ID))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
  } catch {}
}

let fila = Promise.resolve();

// Reagenda as próximas frases. Não pede permissão (isso é feito no lembrete
// ou no Perfil); sem permissão, simplesmente não agenda.
export function agendarFrasesDoDia(frases, uid, pref) {
  const tarefa = fila.then(() => agendarAgora(frases, uid, pref));
  fila = tarefa.catch(() => {});
  return tarefa;
}

async function agendarAgora(frases, uid, pref) {
  if (Platform.OS === 'web') return 0;
  const { ativo, hora, minuto } = normalizarPrefFrase(pref);
  await cancelar();
  if (!ativo || !frases?.length) return 0;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return 0;
  } catch { return 0; }
  await criarCanal();

  const agora = new Date();
  let agendadas = 0;
  for (let i = 0; i < DIAS; i += 1) {
    const data = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i, hora, minuto, 0, 0);
    if (data.getTime() <= agora.getTime()) continue;
    const frase = frases[indiceFraseDoDia(data, uid, frases.length)];
    if (!frase?.texto) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIXO_ID}${chaveDia(data)}`,
        content: {
          title: 'Frase do dia',
          body: `“${frase.texto}”${frase.autor ? ` — ${frase.autor}` : ''}`,
          data: { screen: 'MainTabs', origem: 'fraseDoDia', tipo: 'frase' },
          sound: 'default',
          color: '#6B54C6',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: data, channelId: CANAL_FRASE },
      });
      agendadas += 1;
    } catch {}
  }
  return agendadas;
}
