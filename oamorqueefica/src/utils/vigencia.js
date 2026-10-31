// Datas de vigência (parcerias) e de publicação (Achados da Atravessia).
// Todas as datas são gravadas como texto 'AAAA-MM-DD' (dia de Brasília), o
// mesmo formato de hojeStr() usado no resto do app. Mesmas regras no painel
// web (admin-web/src/vigenciaUtils.js) e no servidor (functions → seção
// ADMINISTRAÇÃO DE PARCERIAS).

const TZ = 'America/Sao_Paulo';
export const DIAS_ALERTA_CONTRATO = 60;
export const DIAS_ALERTA_ACHADO = 7;

export const hojeISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
export const ehDataISO = (s) => {
  const m = ISO.exec(String(s || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};

// Dias de `deISO` até `ateISO` (negativo = já passou).
export function diasEntreISO(deISO, ateISO) {
  if (!ehDataISO(deISO) || !ehDataISO(ateISO)) return null;
  const [a, b] = [deISO, ateISO].map(s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); });
  return Math.round((b - a) / 86400000);
}

export const isoParaBR = (s) => (ehDataISO(s) ? s.split('-').reverse().join('/') : '');
export const isoParaDiaMes = (s) => (ehDataISO(s) ? s.slice(8, 10) + '/' + s.slice(5, 7) : '');

// Campo de data no app: a pessoa digita só números e a barra entra sozinha.
export function mascaraDataBR(txt) {
  const d = String(txt || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// 'dd/mm/aaaa' → 'AAAA-MM-DD'. Vazio → '' ; inválido → null.
export function brParaISO(txt) {
  const s = String(txt || '').trim();
  if (!s) return '';
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return ehDataISO(iso) ? iso : null;
}

// Selo de vigência de uma parceria (dados de parceriasPrivado).
// tom: 'ok' | 'alerta' (≤ 60 dias, laranja) | 'vencida' (vermelho) | 'futura'.
export function seloVigencia(priv, hoje = hojeISO()) {
  const fim = priv?.fimParceria;
  const inicio = priv?.inicioParceria;
  if (ehDataISO(fim)) {
    const dias = diasEntreISO(hoje, fim);
    if (dias < 0) return { tom: 'vencida', dias, texto: `Vencida em ${isoParaBR(fim)}` };
    if (dias <= DIAS_ALERTA_CONTRATO) {
      return { tom: 'alerta', dias, texto: dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia${dias === 1 ? '' : 's'}` };
    }
    if (ehDataISO(inicio) && inicio > hoje) return { tom: 'futura', dias, texto: `Começa em ${isoParaBR(inicio)}` };
    return { tom: 'ok', dias, texto: `Vigente até ${isoParaBR(fim)}` };
  }
  if (ehDataISO(inicio) && inicio > hoje) return { tom: 'futura', dias: null, texto: `Começa em ${isoParaBR(inicio)}` };
  return null;
}

// Situação de publicação de um achado (indicacoes): 'agendado' | 'no_ar' | 'encerrado'.
export function situacaoAchado(item, hoje = hojeISO()) {
  const de = ehDataISO(item?.publicarDe) ? item.publicarDe : '';
  const ate = ehDataISO(item?.publicarAte) ? item.publicarAte : '';
  if (de && hoje < de) return { id: 'agendado', texto: `Agendado (começa ${isoParaDiaMes(de)})` };
  if (ate && hoje > ate) return { id: 'encerrado', texto: 'Encerrado' };
  if (ate) return { id: 'no_ar', texto: `No ar até ${isoParaDiaMes(ate)}` };
  return { id: 'no_ar', texto: '' };
}

// O que a usuária vê: ativo e dentro do período (datas opcionais).
export const achadoNoAr = (item, hoje = hojeISO()) => item?.ativo !== false && situacaoAchado(item, hoje).id === 'no_ar';

// Telefone do contato → número para wa.me / tel: (DDD sem o 55 ganha o 55).
export function telefoneNormalizado(bruto) {
  let d = String(bruto || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 15 ? d : '';
}
export const linkWhatsApp = (tel) => { const n = telefoneNormalizado(tel); return n ? `https://wa.me/${n}` : ''; };
export const linkLigar = (tel) => { const n = telefoneNormalizado(tel); return n ? `tel:+${n}` : ''; };

// Link do contrato: precisa ser um endereço http(s). Sem esquema ganha https://.
export function normalizarLinkContrato(bruto) {
  const s = String(bruto || '').trim();
  if (!s) return '';
  const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  return /^https?:\/\/[^\s/]+\.[^\s/]{2,}(\/\S*)?$/i.test(url) ? url : null;
}
export const ehLinkDrive = (url) => /(^|\/\/|\.)(drive|docs)\.google\.com\//i.test(String(url || ''));
