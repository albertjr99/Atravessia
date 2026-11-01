// Lar e recomeço — parceria Atravessia + imobiliárias + arquitetos.
// Constantes e funções usadas pelas telas da usuária e pelo painel no app.
// Mesmo conteúdo em admin-web/src/imoveisUtils.js (painel web e portal da
// imobiliária). Os status são gravados só pelo servidor (functions/index.js,
// seção IMOBILIÁRIAS).

export const STATUS_LEAD = {
  novo: { rotulo: 'Indicação enviada', curto: 'Novo', tom: 'lilas', icone: 'paper-plane-outline' },
  em_contato: { rotulo: 'Em contato com a imobiliária', curto: 'Em contato', tom: 'nevoa', icone: 'chatbubbles-outline' },
  visita: { rotulo: 'Visita marcada ou feita', curto: 'Visita', tom: 'nevoa', icone: 'walk-outline' },
  proposta: { rotulo: 'Proposta em andamento', curto: 'Proposta', tom: 'pessego', icone: 'document-text-outline' },
  fechado: { rotulo: 'Negócio fechado', curto: 'Fechado', tom: 'dourado', icone: 'key-outline' },
  pago: { rotulo: 'Consultoria liberada', curto: 'Repasse recebido', tom: 'salvia', icone: 'checkmark-done-outline' },
  consultoria_agendada: { rotulo: 'Consultoria agendada', curto: 'Consultoria agendada', tom: 'salvia', icone: 'calendar-outline' },
  concluido: { rotulo: 'Consultoria concluída', curto: 'Concluído', tom: 'salvia', icone: 'home-outline' },
  perdido: { rotulo: 'Negociação encerrada', curto: 'Encerrado', tom: 'neutro', icone: 'close-circle-outline' },
};

// Ordem da linha do tempo (sem "perdido", que encerra em qualquer ponto).
export const FASES_LEAD = ['novo', 'em_contato', 'visita', 'proposta', 'fechado', 'pago', 'consultoria_agendada', 'concluido'];
export const indiceFase = (status) => FASES_LEAD.indexOf(status);

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

export const FAIXAS_PRECO = {
  comprar: ['Até R$ 300 mil', 'R$ 300 mil a R$ 500 mil', 'R$ 500 mil a R$ 1 milhão', 'Acima de R$ 1 milhão', 'Ainda não sei'],
  alugar: ['Até R$ 1.500', 'R$ 1.500 a R$ 3.000', 'R$ 3.000 a R$ 5.000', 'Acima de R$ 5.000', 'Ainda não sei'],
};
export const PRAZOS = ['O quanto antes (até 1 mês)', 'Em até 3 meses', 'Em até 6 meses', 'Só pesquisando, sem pressa'];

// Filtro de preço da vitrine de imóveis (em reais).
export const FAIXAS_FILTRO = {
  venda: [
    { id: 'todos', rotulo: 'Qualquer valor' },
    { id: 'v1', rotulo: 'Até 300 mil', max: 300000 },
    { id: 'v2', rotulo: '300 a 500 mil', min: 300000, max: 500000 },
    { id: 'v3', rotulo: '500 mil a 1 mi', min: 500000, max: 1000000 },
    { id: 'v4', rotulo: 'Acima de 1 mi', min: 1000000 },
  ],
  aluguel: [
    { id: 'todos', rotulo: 'Qualquer valor' },
    { id: 'a1', rotulo: 'Até 1.500', max: 1500 },
    { id: 'a2', rotulo: '1.500 a 3.000', min: 1500, max: 3000 },
    { id: 'a3', rotulo: '3.000 a 5.000', min: 3000, max: 5000 },
    { id: 'a4', rotulo: 'Acima de 5.000', min: 5000 },
  ],
};

export const VERSAO_CONSENTIMENTO_IMOVEIS = '1.0';
export const TEXTO_CONSENTIMENTO_IMOVEIS =
  'Autorizo a Atravessia a compartilhar meu nome, meu telefone e o que escrevi aqui com esta imobiliária, '
  + 'só para que ela entre em contato sobre este interesse. A imobiliária não recebe nenhum outro dado meu '
  + '(nem check-ins, nem diário, nem plano). Posso pedir a exclusão a qualquer momento.';

export const TEXTO_BENEFICIO =
  'Quando o negócio for fechado e a imobiliária confirmar o pagamento, você ganha uma consultoria online '
  + 'com arquiteto parceiro (cerca de 2 horas) para pensar organização, decoração e aproveitamento do novo lar. '
  + 'Sem custo para você.';

export function precoTexto(valor, finalidade) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return 'Consulte';
  const t = n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  return finalidade === 'aluguel' ? `${t}/mês` : t;
}

export const brlCentavos = (c) => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function dataHoraTexto(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts._seconds ? ts._seconds * 1000 : ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function dataTexto(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts._seconds ? ts._seconds * 1000 : ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

// Link do WhatsApp com a mensagem pronta contendo o código da indicação.
export function linkWhatsapp(numero, texto) {
  let d = String(numero || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto || '')}`;
}

export function mensagemWhatsapp({ codigo, imovelTitulo, interesse }) {
  const acao = interesse === 'alugar' ? 'alugar' : 'comprar';
  return `Olá! Vim pela Atravessia (parceria Lar e recomeço) e tenho interesse em ${acao}`
    + `${imovelTitulo ? ` o imóvel "${imovelTitulo}"` : ' um imóvel'}. Meu código de indicação é ${codigo}.`;
}

// "Rua A, Centro" -> ['Rua A', 'Centro'] (listas digitadas com vírgula no painel).
export const listaDeTexto = (s) => String(s || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
