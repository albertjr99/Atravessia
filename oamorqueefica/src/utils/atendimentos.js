import { useEffect, useState } from 'react';
import { Platform, Linking, Share } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../services/firebase';

// Atendimentos online (docs/atendimentos/PLANO.md). Mesmos horários das
// Cloud Functions: participante entra 10 min antes; a profissional, 30 min.
export const SITE_URL = 'https://o-amor-que-fica.web.app';
export const LIBERA_MIN = 10;
export const LIBERA_PROF_MIN = 30;
export const TOLERANCIA_MIN = 30;

export const chamar = (nome, dados) => httpsCallable(functions, nome)(dados).then(r => r.data);
export const ms = (t) => t?.toMillis?.() || (typeof t === 'number' ? t : 0);
export const dataHora = (v) => new Date(v).toLocaleString('pt-BR', {
  weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
});
export const linkConvite = (token) => `${SITE_URL}/atendimento.html?c=${token}`;
export const reais = (c) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;

export function salaAberta(a, agora = Date.now(), anfitria = false) {
  if (!a || a.status !== 'agendado') return false;
  const antes = (anfitria ? LIBERA_PROF_MIN : LIBERA_MIN) * 60000;
  return agora >= ms(a.inicio) - antes && agora <= ms(a.fim) + TOLERANCIA_MIN * 60000;
}
export const ehPassado = (a, agora = Date.now()) =>
  a.status === 'concluido' || a.status === 'cancelado' || ms(a.fim) + TOLERANCIA_MIN * 60000 < agora;

export function separar(lista, agora = Date.now()) {
  const todos = [...lista].sort((x, y) => ms(x.inicio) - ms(y.inicio));
  return { proximos: todos.filter(a => !ehPassado(a, agora)), passados: todos.filter(a => ehPassado(a, agora)).reverse() };
}

// Atendimentos em que a usuária está (convite aceito).
export function useMeusAtendimentos(uid) {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    if (!uid) { setLista([]); return undefined; }
    return onSnapshot(query(collection(db, 'atendimentos'), where('participantesUids', 'array-contains', uid)),
      s => setLista(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setLista([]));
  }, [uid]);
  return lista;
}

export function textoWhatsApp(p, a, link) {
  const primeiro = String(p.nome || '').split(' ')[0];
  return `Olá, ${primeiro}! Este é o link do seu atendimento online com ${a.profissionalNome || 'a sua psicóloga'}, `
    + `${dataHora(ms(a.inicio))}:\n${link}\n\nPelo link você cria seu acesso ao Atravessia (é rápido), testa a câmera e o microfone `
    + 'e entra na sala no horário. O link é pessoal: por favor, não compartilhe. 💜';
}

export async function compartilharLink(texto) {
  if (Platform.OS === 'web') {
    try { await navigator.clipboard.writeText(texto); return 'copiado'; } catch { window.prompt('Copie o texto:', texto); return 'manual'; }
  }
  await Share.share({ message: texto });
  return 'compartilhado';
}
export function abrirWhatsApp(texto) {
  return Linking.openURL(`https://wa.me/?text=${encodeURIComponent(texto)}`);
}

// "25/12/2026" + "14:30" → milissegundos (horário do aparelho).
export function dataDoFormulario(data, hora) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(data).trim());
  const h = /^(\d{1,2}):(\d{2})$/.exec(String(hora).trim());
  if (!m || !h) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(h[1]), Number(h[2]));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}
export function formularioDaData(v) {
  const d = new Date(v);
  const p = (n) => String(n).padStart(2, '0');
  return { data: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`, hora: `${p(d.getHours())}:${p(d.getMinutes())}` };
}
