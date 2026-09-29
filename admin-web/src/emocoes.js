// Emoções do check-in — cópia fiel de `emocoes` em
// oamorqueefica/src/data/index.js (mesmos ids, rótulos, cores e ordem).
// Se o app mudar essa lista, atualize aqui também.
export const EMOCOES = [
  { id: 'triste',      label: 'Triste',      positiva: false, color: '#8FA3BF', nomeRelatorio: 'a tristeza' },
  { id: 'saudade',     label: 'Com saudade', positiva: false, color: '#B8A6C9', nomeRelatorio: 'a saudade' },
  { id: 'sozinho',     label: 'Sozinho',     positiva: false, color: '#7a9870', nomeRelatorio: 'o isolamento' },
  { id: 'medo',        label: 'Com medo',    positiva: false, color: '#7088A0', nomeRelatorio: 'o medo' },
  { id: 'culpado',     label: 'Culpado',     positiva: false, color: '#B0876A', nomeRelatorio: 'a culpa' },
  { id: 'ansioso',     label: 'Ansioso',     positiva: false, color: '#B89870', nomeRelatorio: 'a ansiedade' },
  { id: 'raiva',       label: 'Com raiva',   positiva: false, color: '#B0A060', nomeRelatorio: 'a raiva' },
  { id: 'desanimado',  label: 'Desanimado',  positiva: false, color: '#9088A0', nomeRelatorio: 'o desânimo' },
  { id: 'grato',       label: 'Grato',       positiva: true,  color: '#D4B483' },
  { id: 'tranquilo',   label: 'Em paz',      positiva: true,  color: '#70A890' },
  { id: 'esperancoso', label: 'Esperançoso', positiva: true,  color: '#A8B8A0' },
  { id: 'alegre',      label: 'Alegre',      positiva: true,  color: '#C8A840' },
  { id: 'amoroso',     label: 'Amoroso',     positiva: true,  color: '#C07090' },
];

export const emocaoPorId = (id) => EMOCOES.find(e => e.id === id);

// Planos (níveis de acesso), mesma numeração usada no app.
export const PLANOS_NIVEIS = [
  { id: 0, label: 'Perceber (grátis)', curto: 'Perceber', cor: '#7A9E7E' },
  { id: 1, label: 'Acolher',           curto: 'Acolher',  cor: '#8B7AC0' },
  { id: 2, label: 'Compreender',       curto: 'Compreender', cor: '#7B5EA7' },
  { id: 3, label: 'Evoluir',           curto: 'Evoluir',  cor: '#C0843F' },
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
