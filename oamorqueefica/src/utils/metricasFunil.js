// Métricas de funil e retenção para os relatórios das administradoras.
//
// Função pura (sem Firebase nem React): recebe as usuárias e os check-ins já
// carregados e devolve os números prontos para a tela. Há uma cópia idêntica
// em admin-web/src/metricasFunil.js — altere as duas juntas.

const TZ = 'America/Sao_Paulo';
const PLANO_MAP = { perceber: 0, acolher: 1, compreender: 2, evoluir: 3 };

export const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

// O plano pode estar gravado como número (app) ou texto (painel web).
export function planoNumero(p) {
  if (typeof p === 'number') return p;
  const n = Number(p);
  if (p !== '' && p != null && Number.isFinite(n)) return n;
  return PLANO_MAP[String(p || '').toLowerCase()] ?? 0;
}

// Converte Timestamp do Firestore, Date, número ou texto em 'AAAA-MM-DD' (SP).
export function diaDoRegistro(valor) {
  if (!valor) return null;
  try {
    if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
    let d = null;
    if (typeof valor.toDate === 'function') d = valor.toDate();
    else if (typeof valor.seconds === 'number') d = new Date(valor.seconds * 1000);
    else d = new Date(valor);
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('sv-SE', { timeZone: TZ });
  } catch {
    return null;
  }
}

const diaUTC = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
export const diasEntre = (de, ate) => Math.round((diaUTC(ate) - diaUTC(de)) / 86400000);

function somarDias(iso, n) {
  const d = new Date(diaUTC(iso) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

function cortesiaAtiva(c, agora = new Date()) {
  if (!c?.ativo) return false;
  if (!c.expiracao) return true;
  try {
    const exp = c.expiracao.toDate ? c.expiracao.toDate() : new Date(c.expiracao);
    return exp > agora;
  } catch {
    return false;
  }
}

const pct = (parte, todo) => (todo > 0 ? Math.round((parte / todo) * 100) : null);

/**
 * @param {object} p
 * @param {Array} p.usuarios   — documentos de `usuarios` (sem administradoras)
 * @param {Array} p.checkins   — check-ins com `uid` e `data`
 * @param {'30'|'90'|'all'} p.periodo — janela de CADASTRO considerada no funil
 * @param {string} [p.hoje]    — 'AAAA-MM-DD'
 */
export function calcularMetricasFunil({ usuarios = [], checkins = [], periodo = '30', hoje = hojeSP() }) {
  // Dias com check-in por usuária.
  const diasPorUid = new Map();
  checkins.forEach(c => {
    const dia = typeof c?.data === 'string' ? c.data.slice(0, 10) : null;
    if (!c?.uid || !dia || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return;
    if (!diasPorUid.has(c.uid)) diasPorUid.set(c.uid, new Set());
    diasPorUid.get(c.uid).add(dia);
  });

  // Quem tem acesso liberado sem pagar (acesso total ou cortesia) distorceria a
  // conversão para plano pago — fica fora do funil e é informado à parte.
  const semCusto = usuarios.filter(u => u.acessoTotal === true || cortesiaAtiva(u.cortesia));
  const idsSemCusto = new Set(semCusto.map(u => u.id));
  const base = usuarios
    .filter(u => !idsSemCusto.has(u.id))
    .map(u => ({
      id: u.id,
      cadastro: diaDoRegistro(u.criadoEm),
      plano: planoNumero(u.plano),
      dias: [...(diasPorUid.get(u.id) || [])].sort(),
    }));

  const limiar = periodo === 'all' ? null : somarDias(hoje, -Number(periodo));
  const semDataCadastro = base.filter(u => !u.cadastro).length;
  // Sem data de cadastro (contas antigas) só entram em "Tudo".
  const coorte = limiar ? base.filter(u => u.cadastro && u.cadastro >= limiar) : base;

  const fezCheckin = coorte.filter(u => u.dias.length >= 1);
  const voltou = coorte.filter(u => u.dias.length >= 2);
  const pagou = coorte.filter(u => u.plano >= 1);

  const etapas = [
    { id: 'cadastro', titulo: 'Cadastro', descricao: 'Criaram a conta', qtd: coorte.length },
    { id: 'checkin', titulo: '1º check-in', descricao: 'Fizeram pelo menos um check-in', qtd: fezCheckin.length },
    { id: 'voltou', titulo: 'Voltaram', descricao: 'Check-in em 2 dias ou mais', qtd: voltou.length },
    { id: 'pago', titulo: 'Plano pago', descricao: 'Estão em um plano pago', qtd: pagou.length },
  ].map((e, i, lista) => ({
    ...e,
    pctTotal: pct(e.qtd, lista[0].qtd),
    // Quem assina sem ter voltado ainda pode deixar a última etapa maior que a
    // anterior; a taxa fica limitada a 100%.
    pctAnterior: i === 0 ? null : Math.min(100, pct(e.qtd, lista[i - 1].qtd) ?? 0),
    perda: i === 0 ? 0 : Math.max(0, lista[i - 1].qtd - e.qtd),
  }));

  // Maior queda: a passagem com menor taxa de conversão (entre etapas com gente).
  let maiorQueda = null;
  etapas.forEach((e, i) => {
    if (i === 0 || etapas[i - 1].qtd === 0) return;
    if (!maiorQueda || e.pctAnterior < maiorQueda.pctAnterior) {
      maiorQueda = { de: etapas[i - 1].titulo, para: e.titulo, id: e.id, pctAnterior: e.pctAnterior, perda: e.perda };
    }
  });
  if (maiorQueda && maiorQueda.perda === 0) maiorQueda = null;

  // Retenção: entre quem se cadastrou há pelo menos N dias, quantas fizeram
  // check-in N dias ou mais depois do cadastro.
  const retencao = (n) => {
    const elegiveis = coorte.filter(u => u.cadastro && diasEntre(u.cadastro, hoje) >= n);
    const retidas = elegiveis.filter(u => u.dias.some(d => diasEntre(u.cadastro, d) >= n));
    return { elegiveis: elegiveis.length, retidas: retidas.length, pct: pct(retidas.length, elegiveis.length) };
  };

  // Atividade atual (todas as usuárias, independente do período de cadastro).
  const desde7 = somarDias(hoje, -6);
  const desde30 = somarDias(hoje, -29);
  let ativas7 = 0;
  let ativas30 = 0;
  let checkins30 = 0;
  usuarios.forEach(u => {
    const dias = diasPorUid.get(u.id);
    if (!dias) return;
    let noMes = 0;
    let naSemana = false;
    dias.forEach(d => {
      if (d >= desde30 && d <= hoje) noMes += 1;
      if (d >= desde7 && d <= hoje) naSemana = true;
    });
    if (noMes > 0) { ativas30 += 1; checkins30 += noMes; }
    if (naSemana) ativas7 += 1;
  });

  return {
    periodo,
    etapas,
    maiorQueda,
    retencaoD7: retencao(7),
    retencaoD30: retencao(30),
    ativas7,
    ativas30,
    mediaCheckinsAtiva30: ativas30 > 0 ? Math.round((checkins30 / ativas30) * 10) / 10 : 0,
    conversaoPago: pct(pagou.length, coorte.length),
    conversaoPagoEntreQueVoltaram: pct(voltou.filter(u => u.plano >= 1).length, voltou.length),
    totalPagantes: base.filter(u => u.plano >= 1).length,
    semCusto: semCusto.length,
    semDataCadastro: limiar ? semDataCadastro : 0,
  };
}
