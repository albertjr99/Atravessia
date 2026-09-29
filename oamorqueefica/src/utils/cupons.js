// Endereço do site (Firebase Hosting) onde fica a página de validação do
// parceiro. Espelha SITE_URL de functions/index.js — se um mudar, mude o outro.
export const SITE_URL = 'https://o-amor-que-fica.web.app';

export const linkDoCupom = (tokenSeguro) => `${SITE_URL}/parceiro.html?t=${tokenSeguro}`;

const STATUS_EM_USO = ['GERADO', 'APRESENTADO', 'VALIDADO'];
const STATUS_USADO = ['CONFIRMADO_USUARIO', 'ELEGIVEL_LIQUIDACAO', 'AGUARDANDO_PAGAMENTO', 'LIQUIDADO', 'CONTESTADO'];

export function msDe(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts === 'number') return ts;
  const t = new Date(ts).getTime();
  return Number.isNaN(t) ? null : t;
}

// Em que situação o cupom está para a usuária:
// 'ativo'      — pode ser apresentado ao parceiro;
// 'aguardando' — o parceiro registrou o atendimento e falta ela confirmar;
// 'usado'      — já respondido (confirmado ou contestado);
// 'expirado'   — venceu ou foi cancelado.
// O job que marca EXPIRADO roda de hora em hora, então um cupom vencido pode
// ainda estar como GERADO por alguns minutos: aqui ele já conta como expirado.
export function situacaoCupom(v) {
  const status = v?.status || 'GERADO';
  if (status === 'CONCLUIDO') return 'aguardando';
  if (STATUS_USADO.includes(status)) return 'usado';
  if (STATUS_EM_USO.includes(status)) {
    const expira = msDe(v?.expiraEm);
    return expira != null && expira < Date.now() ? 'expirado' : 'ativo';
  }
  return 'expirado';
}

export function descontoDoCupom(v) {
  if (v?.percentualDescontoCliente != null) return Number(v.percentualDescontoCliente) || 0;
  return Math.max(0, (Number(v?.percentualBeneficio) || 0) - (Number(v?.percentualComissao) || 0));
}

export function dataCurta(ts) {
  const ms = msDe(ts);
  return ms == null ? '' : new Date(ms).toLocaleDateString('pt-BR');
}
