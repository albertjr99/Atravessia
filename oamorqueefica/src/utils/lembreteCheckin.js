import { Platform, Linking } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lembrete diário de check-in com notificações LOCAIS (agendadas no próprio
// aparelho, sem depender de servidor).
//
// Por que não um lembrete repetitivo diário? Porque ele não sabe se o check-in
// do dia já foi feito. Em vez disso, agendamos notificações únicas para os
// próximos dias e reagendamos toda vez que o app abre (e quando um check-in é
// registrado): se ela já fez o check-in hoje, o lembrete de hoje simplesmente
// deixa de existir.

// Canal novo (o antigo era de importância média e não aparecia no topo da tela;
// no Android a importância de um canal não pode ser mudada depois de criado).
export const CANAL_LEMBRETES = 'lembretes-checkin';
// 30 dias à frente: o lembrete continua tocando mesmo se o app ficar dias sem
// ser aberto (o iOS aceita até 64 avisos agendados).
export const DIAS_AGENDADOS = 30;
export const PREFERENCIA_PADRAO = { ativo: false, hora: 20, minuto: 0 };

const PREFIXO_ID = 'lembrete-checkin-';
const CHAVE_IDS = '@atravessia/lembreteCheckin/ids';
const chavePreferencia = (uid) => `@atravessia/lembreteCheckin/pref/${uid || 'local'}`;

const FRASES = [
  'Como você está hoje? Seu check-in leva menos de um minuto.',
  'Que tal tirar um instante para você? Conte como está se sentindo.',
  'Um momento só seu: como está o seu coração hoje?',
  'Estamos aqui com você. Quando quiser, registre como foi o seu dia.',
];

const doisDigitos = (n) => String(n).padStart(2, '0');
export const formatarHorario = (hora, minuto) => `${doisDigitos(hora)}:${doisDigitos(minuto)}`;

// Chave YYYY-MM-DD de uma data no fuso do aparelho.
const chaveDia = (d) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

export function normalizarPreferencia(pref) {
  const hora = Number.isInteger(pref?.hora) && pref.hora >= 0 && pref.hora <= 23 ? pref.hora : PREFERENCIA_PADRAO.hora;
  const minuto = Number.isInteger(pref?.minuto) && pref.minuto >= 0 && pref.minuto <= 59 ? pref.minuto : PREFERENCIA_PADRAO.minuto;
  return { ativo: !!pref?.ativo, hora, minuto };
}

// Cálculo puro (sem expo-notifications): em quais datas/horários os lembretes
// devem tocar. Hoje é pulado se o check-in já foi feito ou se o horário já passou.
export function calcularDatasLembrete({ hora, minuto }, jaFezCheckinHoje, agora = new Date(), dias = DIAS_AGENDADOS) {
  const datas = [];
  for (let i = 0; i < dias; i += 1) {
    // new Date(ano, mês, dia + i, ...) resolve a virada de mês/ano sozinho.
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i, hora, minuto, 0, 0);
    if (i === 0 && (jaFezCheckinHoje || d.getTime() <= agora.getTime())) continue;
    datas.push(d);
  }
  return datas;
}

// Frase variada, estável por dia (a mesma data sempre recebe a mesma frase).
export function fraseDoLembrete(data) {
  const diasDesdeEpoca = Math.floor(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) / 86400000);
  return FRASES[diasDesdeEpoca % FRASES.length];
}

const suportado = () => Platform.OS !== 'web';

// ---- Permissão e canal ------------------------------------------------------

export async function statusPermissao() {
  if (!suportado()) return 'indisponivel';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status; // 'granted' | 'denied' | 'undetermined'
  } catch {
    return 'indisponivel';
  }
}

export async function pedirPermissao() {
  if (!suportado()) return 'indisponivel';
  // No Android 13+, a pergunta de permissão só aparece se já existir um canal.
  await criarCanalLembretes();
  try {
    const atual = await Notifications.getPermissionsAsync();
    if (atual.status === 'granted') return 'granted';
    if (atual.status === 'denied' && atual.canAskAgain === false) return 'denied';
    const { status } = await Notifications.requestPermissionsAsync();
    return status;
  } catch {
    return 'indisponivel';
  }
}

export async function criarCanalLembretes() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CANAL_LEMBRETES, {
      name: 'Lembretes de check-in',
      description: 'Um lembrete gentil para o seu check-in diário.',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 200, 250],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    // Remove o canal antigo, de importância média.
    await Notifications.deleteNotificationChannelAsync('lembretes').catch(() => {});
  } catch {}
}

// ---- Ajustes do aparelho (Android) -------------------------------------------
// No Android 12+, sem a permissão "Alarmes e lembretes" o sistema pode atrasar o
// aviso (às vezes por horas) para economizar bateria. Estas funções abrem a tela
// certa nas configurações para a pessoa permitir.
const pacote = () => Constants.expoConfig?.android?.package || 'com.atravessia';

export async function abrirAjusteAlarmes() {
  if (Platform.OS !== 'android') return false;
  try {
    await IntentLauncher.startActivityAsync('android.settings.REQUEST_SCHEDULE_EXACT_ALARM', { data: `package:${pacote()}` });
    return true;
  } catch {
    try { await Linking.openSettings(); return true; } catch { return false; }
  }
}

export async function abrirAjusteBateria() {
  if (Platform.OS !== 'android') return false;
  try {
    await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
    return true;
  } catch {
    try { await Linking.openSettings(); return true; } catch { return false; }
  }
}

// Aviso de teste em 10 segundos, para a pessoa conferir que as notificações chegam.
export async function testarLembrete() {
  if (!suportado()) return false;
  if ((await pedirPermissao()) !== 'granted') return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Atravessia',
        body: 'Tudo certo! É assim que o seu lembrete de check-in vai aparecer.',
        data: { screen: 'CheckIn', origem: 'lembreteTeste' },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, channelId: CANAL_LEMBRETES },
    });
    return true;
  } catch {
    return false;
  }
}

// ---- Preferência (AsyncStorage) ---------------------------------------------

export async function carregarPreferencia(uid, doPerfil) {
  try {
    const salvo = await AsyncStorage.getItem(chavePreferencia(uid));
    if (salvo) return normalizarPreferencia(JSON.parse(salvo));
  } catch {}
  // Aparelho novo ou app reinstalado: recupera o que está no perfil.
  if (doPerfil) {
    const pref = normalizarPreferencia(doPerfil);
    salvarPreferenciaLocal(uid, pref);
    return pref;
  }
  return { ...PREFERENCIA_PADRAO };
}

export async function salvarPreferenciaLocal(uid, pref) {
  try {
    await AsyncStorage.setItem(chavePreferencia(uid), JSON.stringify(normalizarPreferencia(pref)));
  } catch {}
}

// ---- Agendamento ------------------------------------------------------------

export async function cancelarLembretes() {
  if (!suportado()) return;
  const ids = new Set();
  try {
    const salvos = JSON.parse((await AsyncStorage.getItem(CHAVE_IDS)) || '[]');
    salvos.forEach(id => ids.add(id));
  } catch {}
  try {
    const agendadas = await Notifications.getAllScheduledNotificationsAsync();
    agendadas
      .filter(n => n.identifier?.startsWith(PREFIXO_ID) || n.content?.data?.origem === 'lembreteCheckin')
      .forEach(n => ids.add(n.identifier));
  } catch {}
  await Promise.all([...ids].map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  try { await AsyncStorage.removeItem(CHAVE_IDS); } catch {}
}

// Chamadas em sequência (foco da tela + chegada dos check-ins podem disparar
// quase juntas): cada uma espera a anterior terminar, para não duplicar.
let fila = Promise.resolve();

export function agendarLembretes(pref, jaFezCheckinHoje) {
  const tarefa = fila.then(() => agendarAgora(pref, jaFezCheckinHoje));
  fila = tarefa.catch(() => {});
  return tarefa;
}

async function agendarAgora(pref, jaFezCheckinHoje) {
  if (!suportado()) return { agendados: 0, motivo: 'indisponivel' };
  const { ativo, hora, minuto } = normalizarPreferencia(pref);

  await cancelarLembretes();
  if (!ativo) return { agendados: 0, motivo: 'desligado' };

  // Não pede permissão aqui (isso acontece na tela de Lembrete, a pedido dela).
  if ((await statusPermissao()) !== 'granted') return { agendados: 0, motivo: 'permissao' };
  await criarCanalLembretes();

  const ids = [];
  for (const data of calcularDatasLembrete({ hora, minuto }, jaFezCheckinHoje)) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIXO_ID}${chaveDia(data)}`,
        content: {
          title: 'Atravessia',
          body: fraseDoLembrete(data),
          data: { screen: 'CheckIn', origem: 'lembreteCheckin' },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: data,
          channelId: CANAL_LEMBRETES,
        },
      });
      ids.push(id);
    } catch {}
  }
  try { await AsyncStorage.setItem(CHAVE_IDS, JSON.stringify(ids)); } catch {}
  return { agendados: ids.length, motivo: null };
}
