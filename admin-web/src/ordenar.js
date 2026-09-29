// No Firestore, orderBy('campo') EXCLUI do resultado todo documento sem aquele
// campo. Itens cadastrados pelo app (que grava outros campos), por seeds ou
// enquanto o serverTimestamp ainda não resolveu simplesmente sumiam do painel.
// Por isso as telas leem a coleção inteira e ordenam aqui, sem descartar nada.
// Mesma regra de src/hooks/AppContext.js no app.

function valorOrdem(doc, campos) {
  for (const campo of campos) {
    const v = doc?.[campo];
    if (v == null) continue;
    if (typeof v?.toMillis === 'function') return v.toMillis();
    if (typeof v === 'number') return v;
    const t = new Date(v).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

// `campo` pode ser uma lista: usa o primeiro que existir no documento.
// Documentos sem nenhum deles vão para o fim, nunca são descartados.
export function ordenarPor(docs, campo, dir = 'asc') {
  const campos = Array.isArray(campo) ? campo : [campo];
  const sinal = dir === 'desc' ? -1 : 1;
  return [...docs].sort((a, b) => {
    const va = valorOrdem(a, campos);
    const vb = valorOrdem(b, campos);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va - vb) * sinal;
  });
}
