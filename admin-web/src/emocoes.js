// Emoções do check-in — cópia fiel de `emocoes` em
// oamorqueefica/src/data/index.js (mesmos ids, rótulos e ordem). As cores
// seguem a paleta de emoções dos tokens D2 (--emo-*-dado), sem oliva/mostarda.
// Se o app mudar essa lista, atualize aqui também.
export const EMOCOES = [
  { id: 'triste',      label: 'Triste',      positiva: false, color: '#8EA3C8', nomeRelatorio: 'a tristeza' },
  { id: 'saudade',     label: 'Com saudade', positiva: false, color: '#A595DC', nomeRelatorio: 'a saudade' },
  { id: 'sozinho',     label: 'Sozinho',     positiva: false, color: '#8FA89A', nomeRelatorio: 'o isolamento' },
  { id: 'medo',        label: 'Com medo',    positiva: false, color: '#7C8FB0', nomeRelatorio: 'o medo' },
  { id: 'culpado',     label: 'Culpado',     positiva: false, color: '#B98A7A', nomeRelatorio: 'a culpa' },
  { id: 'ansioso',     label: 'Ansioso',     positiva: false, color: '#C7A07E', nomeRelatorio: 'a ansiedade' },
  { id: 'raiva',       label: 'Com raiva',   positiva: false, color: '#C27C78', nomeRelatorio: 'a raiva' },
  { id: 'desanimado',  label: 'Desanimado',  positiva: false, color: '#9A90AE', nomeRelatorio: 'o desânimo' },
  { id: 'grato',       label: 'Grato',       positiva: true,  color: '#C9A15A' },
  { id: 'tranquilo',   label: 'Em paz',      positiva: true,  color: '#6E9B7E' },
  { id: 'esperancoso', label: 'Esperançoso', positiva: true,  color: '#7F9BCB' },
  { id: 'alegre',      label: 'Alegre',      positiva: true,  color: '#E39A72' },
  { id: 'amoroso',     label: 'Amoroso',     positiva: true,  color: '#D682A0' },
];

export const emocaoPorId = (id) => EMOCOES.find(e => e.id === id);

// Planos (níveis de acesso), mesma numeração usada no app.
export const PLANOS_NIVEIS = [
  { id: 0, label: 'Perceber (grátis)', curto: 'Perceber', cor: '#6E9B7E' },
  { id: 1, label: 'Acolher',           curto: 'Acolher',  cor: '#8B7AC0' },
  { id: 2, label: 'Compreender',       curto: 'Compreender', cor: '#6F8CC2' },
  { id: 3, label: 'Evoluir',           curto: 'Evoluir',  cor: '#D98A69' },
];

// Datas de check-in são strings 'YYYY-MM-DD' no fuso de Brasília.
export function nDiasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

export function formatDataBR(dataStr) {
  if (!dataStr) return '';
  const s = String(dataStr);
  const str = s.length === 10 ? s + 'T12:00:00' : s;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Ordenação no cliente (nunca use orderBy no Firestore neste projeto:
// ele exclui documentos sem o campo). Aceita Timestamp, número ou string.
function valorOrdenavel(v) {
  if (v == null) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  return v;
}

export function ordenarPor(lista, campo, direcao = 'asc') {
  const mult = direcao === 'desc' ? -1 : 1;
  return [...lista].sort((a, b) => {
    const va = valorOrdenavel(a[campo]);
    const vb = valorOrdenavel(b[campo]);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;   // sem o campo vai para o fim
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult;
    return String(va).localeCompare(String(vb), 'pt-BR') * mult;
  });
}
