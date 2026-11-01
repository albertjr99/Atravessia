// Lar e recomeço (imobiliárias + arquitetos). Mesmo conteúdo de
// oamorqueefica/src/utils/imoveis.js — usado pelo painel web e pelo portal da
// imobiliária (imobiliaria.html).

export const STATUS_LEAD = {
  novo: { rotulo: 'Indicação enviada', curto: 'Novo', tom: 'lilas' },
  em_contato: { rotulo: 'Em contato', curto: 'Em contato', tom: 'nevoa' },
  visita: { rotulo: 'Visita', curto: 'Visita', tom: 'nevoa' },
  proposta: { rotulo: 'Proposta', curto: 'Proposta', tom: 'pessego' },
  fechado: { rotulo: 'Negócio fechado', curto: 'Fechado', tom: 'dourado' },
  pago: { rotulo: 'Repasse recebido · consultoria liberada', curto: 'Repasse recebido', tom: 'salvia' },
  consultoria_agendada: { rotulo: 'Consultoria agendada', curto: 'Consultoria agendada', tom: 'salvia' },
  concluido: { rotulo: 'Concluído', curto: 'Concluído', tom: 'salvia' },
  perdido: { rotulo: 'Negociação encerrada', curto: 'Encerrado', tom: 'neutro' },
};
export const FASES_LEAD = ['novo', 'em_contato', 'visita', 'proposta', 'fechado', 'pago', 'consultoria_agendada', 'concluido'];
export const TODOS_STATUS = [...FASES_LEAD, 'perdido'];

export const TIPOS_IMOBILIARIA = [
  { id: 'venda', rotulo: 'Venda' },
  { id: 'aluguel', rotulo: 'Aluguel' },
  { id: 'lancamento', rotulo: 'Lançamentos' },
];
export const TIPOS_IMOVEL = [
  { id: 'apartamento', rotulo: 'Apartamento' },
  { id: 'casa', rotulo: 'Casa' },
  { id: 'casa_condominio', rotulo: 'Casa em condomínio' },
  { id: 'studio', rotulo: 'Studio / kitnet' },
  { id: 'cobertura', rotulo: 'Cobertura' },
  { id: 'terreno', rotulo: 'Terreno' },
  { id: 'comercial', rotulo: 'Comercial' },
  { id: 'outro', rotulo: 'Outro' },
];
export const rotuloTipoImovel = (t) => TIPOS_IMOVEL.find(x => x.id === t)?.rotulo || 'Imóvel';

export const brl = (reais) => Number(reais || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brlCentavos = (c) => brl(Number(c || 0) / 100);

export function precoTexto(valor, finalidade) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return 'Consulte';
  const t = n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  return finalidade === 'aluguel' ? `${t}/mês` : t;
}

const paraData = (ts) => {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(typeof ts === 'number' ? ts : ts._seconds ? ts._seconds * 1000 : ts);
  return Number.isNaN(d.getTime()) ? null : d;
};
export const dataTexto = (ts) => paraData(ts)?.toLocaleDateString('pt-BR') || '';
export const dataHoraTexto = (ts) => paraData(ts)?.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) || '';

export const listaDeTexto = (s) => String(s || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
export const numero = (v) => {
  let t = String(v ?? '').trim();
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
};

export function linkWhatsapp(numeroTel, texto) {
  let d = String(numeroTel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto || '')}`;
}

export const regraTexto = (r) => (!r || !Number(r.valor) ? 'a combinar'
  : r.tipo === 'percentual' ? `${String(r.valor).replace('.', ',')}% do valor` : `${brl(r.valor)} por negócio`);
