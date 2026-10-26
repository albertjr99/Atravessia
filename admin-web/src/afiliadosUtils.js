// Afiliados no painel web. Mesmas regras do app
// (oamorqueefica/src/utils/afiliados.js) e do servidor (functions → AFILIADOS).

export const PLATAFORMAS_AFILIADO = [
  { id: 'amazon', nome: 'Amazon', exemplo: 'https://amzn.to/...', padrao: /amzn\.|amazon\./i },
  { id: 'mercadolivre', nome: 'Mercado Livre', exemplo: 'https://mercadolivre.com/sec/...', padrao: /mercadoli[vb]re|meli\.la/i },
  { id: 'shopee', nome: 'Shopee', exemplo: 'https://s.shopee.com.br/...', padrao: /shopee/i },
  { id: 'magalu', nome: 'Magalu', exemplo: 'https://www.magazinevoce.com.br/...', padrao: /magalu|magazineluiza|magazinevoce/i },
  { id: 'outra', nome: 'Outra loja', exemplo: 'https://...', padrao: null },
];

export const LIMITES_AFILIADO = { valorMaxCentavos: 300000, cashbackMaxCentavos: 10000, percentualMax: 50 };

export function nomePlataforma(item) {
  if (item?.plataforma === 'outra') return String(item.plataformaNome || '').trim() || 'loja';
  return PLATAFORMAS_AFILIADO.find(p => p.id === (item?.plataforma || 'amazon'))?.nome || 'Amazon';
}

export function textoBotaoAfiliado(item) {
  return String(item?.textoBotao || '').trim() || `Ver na ${nomePlataforma(item)}`;
}

export const brlCentavos = (c) => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n) => `${String(Math.round(Number(n) * 100) / 100).replace('.', ',')}%`;

export function regraCashback(item) {
  if (!item || item.cashbackAtivo !== true) return null;
  if (item.cashbackTipo === 'percentual') {
    const p = Number(item.cashbackPercentual);
    return p > 0 ? { tipo: 'percentual', percentual: Math.min(p, LIMITES_AFILIADO.percentualMax) } : null;
  }
  const f = Math.round(Number(item.cashbackFixoCentavos));
  return f > 0 ? { tipo: 'fixo', fixoCentavos: Math.min(f, LIMITES_AFILIADO.cashbackMaxCentavos) } : null;
}

export function calcularCashback(regra, valorCentavos) {
  if (!regra || !(valorCentavos > 0)) return 0;
  const bruto = regra.tipo === 'percentual' ? Math.floor(valorCentavos * (regra.percentual / 100)) : regra.fixoCentavos;
  return Math.max(0, Math.min(bruto, valorCentavos, LIMITES_AFILIADO.cashbackMaxCentavos));
}

export function seloCashback(item) {
  const r = regraCashback(item);
  if (!r) return null;
  return r.tipo === 'percentual'
    ? `Ganhe ${pct(r.percentual)} de volta em créditos`
    : `Ganhe ${brlCentavos(r.fixoCentavos)} de crédito`;
}

export function reaisParaCentavos(txt) {
  const limpo = String(txt ?? '').replace(/[^\d,.-]/g, '');
  if (!limpo) return null;
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
export const centavosParaTexto = (c) => (c == null || c === '' ? '' : (Number(c) / 100).toFixed(2).replace('.', ','));
export const numOuNull = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };

export const STATUS_PEDIDO = {
  pendente: { rotulo: 'Em análise', classe: 'af-status-pendente' },
  aprovado: { rotulo: 'Aprovado', classe: 'af-status-aprovado' },
  recusado: { rotulo: 'Recusado', classe: 'af-status-recusado' },
};
