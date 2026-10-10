// Escolha das sugestões do check-in (áudio de acolhimento e outros conteúdos)
// sem repetir o que a usuária viu nos últimos dias.
//
// - No mesmo dia e emoção, a sugestão fica a mesma (não muda a cada abertura),
//   a não ser que ela peça "ver outra sugestão".
// - Entre dias, evita o que foi mostrado recentemente. A busca é em camadas:
//   primeiro os itens da própria emoção; quando todos já apareceram, itens de
//   emoções próximas (ex.: saudade → tristeza, solidão); por fim, o visto há
//   mais tempo. Assim, mesmo com poucos itens por emoção, não fica sempre igual.
// - O histórico fica no aparelho e também no perfil (vale em outro celular ou
//   depois de reinstalar o app).
import AsyncStorage from '@react-native-async-storage/async-storage';

const chave = (uid) => `@atravessia/sugestoes/${uid || 'local'}`;
const MAX_HISTORICO = 120;
export const MAX_HISTORICO_PERFIL = 60;

// Emoções próximas, usadas quando a própria emoção tem poucos itens.
export const EMOCOES_PROXIMAS = {
  triste: ['saudade', 'desanimado', 'sozinho'],
  saudade: ['triste', 'sozinho', 'desanimado'],
  sozinho: ['saudade', 'triste', 'desanimado'],
  medo: ['ansioso', 'desanimado', 'triste'],
  ansioso: ['medo', 'raiva', 'desanimado'],
  culpado: ['triste', 'ansioso', 'desanimado'],
  raiva: ['ansioso', 'culpado', 'triste'],
  desanimado: ['triste', 'sozinho', 'saudade'],
  grato: ['amoroso', 'tranquilo', 'alegre', 'esperancoso'],
  tranquilo: ['grato', 'esperancoso', 'alegre', 'amoroso'],
  esperancoso: ['tranquilo', 'grato', 'alegre', 'amoroso'],
  alegre: ['grato', 'amoroso', 'esperancoso', 'tranquilo'],
  amoroso: ['grato', 'alegre', 'tranquilo', 'esperancoso'],
};

export async function carregarHistoricoSugestoes(uid, doPerfil = []) {
  let local = [];
  try {
    const bruto = await AsyncStorage.getItem(chave(uid));
    const lista = bruto ? JSON.parse(bruto) : [];
    local = Array.isArray(lista) ? lista : [];
  } catch {
    local = [];
  }
  return mesclar(local, Array.isArray(doPerfil) ? doPerfil : []);
}

function mesclar(a, b) {
  const visto = new Set();
  return [...a, ...b]
    .filter(e => e && e.id && e.data)
    .sort((x, y) => String(x.data).localeCompare(String(y.data)) || (x.ordem || 0) - (y.ordem || 0))
    .filter(e => {
      const k = `${e.tipo}|${e.emocao}|${e.data}|${e.id}`;
      if (visto.has(k)) return false;
      visto.add(k);
      return true;
    })
    .slice(-MAX_HISTORICO);
}

// entrada: { id, tipo: 'audio' | 'conteudo', emocao, data: 'AAAA-MM-DD' }.
// Uma nova entrada do mesmo dia/tipo/emoção substitui a anterior (quando ela
// pede outra sugestão), mas o item anterior continua contando como "visto".
export async function registrarSugestoes(uid, historicoAtual, entradas) {
  const validas = (entradas || []).filter(e => e && e.id).map((e, i) => ({ ...e, ordem: Date.now() + i }));
  if (validas.length === 0) return null;
  const nova = mesclar(historicoAtual || [], validas);
  try {
    await AsyncStorage.setItem(chave(uid), JSON.stringify(nova));
  } catch (e) {
    console.warn('[Sugestões] não foi possível salvar o histórico:', e?.message);
  }
  return nova;
}

// Sugestão atual do dia para um tipo/emoção: a última registrada.
function sugestaoDeHoje(historico, tipo, emocao, hoje) {
  const doDia = historico.filter(h => h.tipo === tipo && h.emocao === emocao && h.data === hoje);
  return doDia.length ? doDia[doDia.length - 1] : null;
}

/**
 * @param {Array<Array>} camadas  listas de itens, da mais específica à mais ampla
 * @param {object} p
 * @param {Array} p.historico
 * @param {'audio'|'conteudo'} p.tipo
 * @param {string} p.emocao
 * @param {string} p.hoje        'AAAA-MM-DD'
 * @param {Array} [p.vistosExtras] ids vistos em outro lugar, do mais antigo ao mais recente
 * @param {boolean} [p.trocar]   true = "ver outra sugestão": ignora a de hoje
 */
export function escolherSugestao(camadas, { historico = [], tipo, emocao, hoje, vistosExtras = [], trocar = false }) {
  const listas = (Array.isArray(camadas?.[0]) ? camadas : [camadas]).map(l => l || []);
  const todos = [];
  const ids = new Set();
  listas.forEach(l => l.forEach(item => {
    if (item?.id && !ids.has(item.id)) { ids.add(item.id); todos.push(item); }
  }));
  if (todos.length === 0) return null;

  const atual = sugestaoDeHoje(historico, tipo, emocao, hoje);
  if (atual && !trocar) {
    const item = todos.find(p => p.id === atual.id);
    if (item) return item;
  }
  if (todos.length === 1) return todos[0];

  // Ordem de "visto por último": quanto maior o índice, mais recente.
  const ultimaVez = new Map();
  vistosExtras.forEach((id, i) => ultimaVez.set(id, i));
  const base = vistosExtras.length;
  historico.filter(h => h.tipo === tipo).forEach((h, i) => ultimaVez.set(h.id, base + i));

  const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];

  for (const lista of listas) {
    const nunca = lista.filter(p => p?.id && !ultimaVez.has(p.id));
    if (nunca.length > 0) return sortear(nunca);
  }

  // Tudo já apareceu: escolhe entre a metade vista há mais tempo, sem repetir
  // a sugestão atual.
  const candidatos = todos.filter(p => p.id !== atual?.id);
  const ordenados = [...candidatos].sort((a, b) => ultimaVez.get(a.id) - ultimaVez.get(b.id));
  const antigos = ordenados.slice(0, Math.max(1, Math.ceil(ordenados.length / 2)));
  return sortear(antigos);
}

// Monta as camadas para uma emoção: itens da emoção, depois das emoções próximas.
export function camadasPorEmocao(itens, emocao) {
  const daEmocao = itens.filter(i => (i.emocoes || []).includes(emocao));
  const proximas = EMOCOES_PROXIMAS[emocao] || [];
  const vizinhos = itens.filter(i => !daEmocao.includes(i) && (i.emocoes || []).some(e => proximas.includes(e)));
  return [daEmocao, vizinhos];
}

// Versão enxuta do histórico para guardar no perfil.
export const historicoParaPerfil = (h) => (h || [])
  .slice(-MAX_HISTORICO_PERFIL)
  .map(({ id, tipo, emocao, data }) => ({ id, tipo, emocao, data }));
