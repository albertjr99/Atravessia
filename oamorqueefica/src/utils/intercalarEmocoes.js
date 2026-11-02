// Ordem de exibição das emoções no check-in: intercala negativa, positiva,
// negativa, positiva… Quando um dos grupos acaba, as restantes seguem na
// ordem original. Não altera a lista (ids e ordem usadas em relatórios).
export function intercalarEmocoes(lista) {
  const neg = (lista || []).filter(e => !e.positiva);
  const pos = (lista || []).filter(e => e.positiva);
  const out = [];
  for (let i = 0; i < Math.max(neg.length, pos.length); i++) {
    if (i < neg.length) out.push(neg[i]);
    if (i < pos.length) out.push(pos[i]);
  }
  return out;
}
