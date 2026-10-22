// Utilidades de preço da tela "Preços e planos".
//
// Fonte de verdade:
//   • planos/{id}.preco e .precoAnual (reais) — o que a usuária vê e o que o
//     checkout cobra (functions/index.js prioriza esses campos);
//   • configuracoes/precos.periodo (centavos) — relatório por período.
// Ao salvar um plano, o valor também é espelhado em configuracoes/precos
// (plano{id} e plano{id}Anual, em centavos) só por compatibilidade.

// A Stripe não aceita cobranças abaixo de R$ 0,50.
export const PRECO_MINIMO = 0.5;

// "24,90", "24.90", "R$ 1.234,56" → número (ou null se vazio/inválido).
export function lerReais(texto) {
  let t = String(texto ?? '').replace(/[^0-9,.]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // "1.000" = mil
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// 24.9 → "24,90" (para preencher um campo).
export function paraCampo(valor) {
  const n = Number(valor);
  return n > 0 ? n.toFixed(2).replace('.', ',') : '';
}

// 24.9 → "R$ 24,90"
export function formatarReais(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Anual efetivo: o valor salvo ou, se vazio, 10 mensalidades (mesma regra do
// app e da Cloud Function).
export function anualEfetivo(mensal, anual) {
  return anual > 0 ? anual : (mensal || 0) * 10;
}

// Economia do anual em relação a 12 mensalidades (inteiro, pode ser negativo).
export function economiaPct(mensal, anual) {
  if (!(mensal > 0) || !(anual > 0)) return 0;
  return Math.round((1 - anual / (mensal * 12)) * 100);
}

// Mensagem de erro para um valor, ou '' se estiver tudo certo.
export function validarPreco(valor, { obrigatorio = true } = {}) {
  if (valor === null) return obrigatorio ? 'Informe um valor, por exemplo 24,90.' : '';
  if (!(valor > 0)) return 'O valor precisa ser maior que zero.';
  if (valor < PRECO_MINIMO) return 'O mínimo aceito no pagamento é R$ 0,50.';
  return '';
}

export const status = (p) => (p.id === 0 ? 'gratuito' : p.emBreve ? 'emBreve' : 'ativo');
export const STATUS_ROTULO = { gratuito: 'Gratuito', ativo: 'Ativo', emBreve: 'Em breve' };
