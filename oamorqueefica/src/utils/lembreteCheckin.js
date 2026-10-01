import { Platform } from 'react-native';
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

export const CANAL_LEMBRETES = 'lembretes';
export const DIAS_AGENDADOS = 7;
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
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {}
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
