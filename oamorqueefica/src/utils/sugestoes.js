// Escolha das sugestões do check-in (áudio de acolhimento e outros conteúdos)
// sem repetir o que a usuária viu nos últimos dias.
//
// Antes a escolha era um sorteio simples a cada check-in: com poucos itens por
// emoção, o mesmo conteúdo aparecia em dias seguidos. Agora:
// - no mesmo dia e emoção, a sugestão fica a mesma (não muda a cada abertura);
// - entre dias, evita os itens mostrados mais recentemente e só repete quando
//   todos da emoção já apareceram — começando pelo que foi visto há mais tempo.
import AsyncStorage from '@react-native-async-storage/async-storage';

const chave = (uid) => `@atravessia/sugestoes/${uid || 'local'}`;
const MAX_HISTORICO = 120;

export async function carregarHistoricoSugestoes(uid) {
  try {
    const bruto = await AsyncStorage.getItem(chave(uid));
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

// entrada: { id, tipo: 'audio' | 'conteudo', emocao, data: 'AAAA-MM-DD' }
export async function registrarSugestoes(uid, entradas) {
  const validas = (entradas || []).filter(e => e && e.id);
  if (validas.length === 0) return null;
  try {
    const atual = await carregarHistoricoSugestoes(uid);
    const semDuplicar = atual.filter(a => !validas.some(v => v.tipo === a.tipo && v.data === a.data && v.emocao === a.emocao));
    const nova = [...semDuplicar, ...validas].slice(-MAX_HISTORICO);
    await AsyncStorage.setItem(chave(uid), JSON.stringify(nova));
    return nova;
  } catch (e) {
    console.warn('[Sugestões] não foi possível salvar o histórico:', e?.message);
    return null;
  }
}

/**
 * @param {Array} pool        itens candidatos (com `id`)
 * @param {object} p
 * @param {Array} p.historico entradas salvas por registrarSugestoes
 * @param {'audio'|'conteudo'} p.tipo
 * @param {string} p.emocao
 * @param {string} p.hoje     'AAAA-MM-DD'
 * @param {Array} [p.vistosExtras] ids vistos em outro lugar (ex.: áudios já
 *                            liberados), do mais antigo para o mais recente
 */
export function escolherSugestao(pool, { historico = [], tipo, emocao, hoje, vistosExtras = [] }) {
  if (!pool || pool.length === 0) return null;

  // Mesma sugestão no mesmo dia, para a mesma emoção.
  const deHoje = historico.find(h => h.tipo === tipo && h.emocao === emocao && h.data === hoje);
  if (deHoje) {
    const item = pool.find(p => p.id === deHoje.id);
    if (item) return item;
  }
  if (pool.length === 1) return pool[0];

  // Ordem de "visto por último": quanto maior o índice, mais recente.
  const ultimaVez = new Map();
  vistosExtras.forEach((id, i) => ultimaVez.set(id, i));
  const base = vistosExtras.length;
  historico
    .filter(h => h.tipo === tipo && h.data !== hoje)
    .forEach((h, i) => ultimaVez.set(h.id, base + i));

  const nunca = pool.filter(p => !ultimaVez.has(p.id));
  if (nunca.length > 0) return nunca[Math.floor(Math.random() * nunca.length)];

  // Todos já apareceram: escolhe entre a metade vista há mais tempo.
  const ordenados = [...pool].sort((a, b) => ultimaVez.get(a.id) - ultimaVez.get(b.id));
  const antigos = ordenados.slice(0, Math.max(1, Math.floor(ordenados.length / 2)));
  return antigos[Math.floor(Math.random() * antigos.length)];
}
