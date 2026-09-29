import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, functions } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  IconClose, IconSpark, IconTag, IconAlert, IconCheck, IconChart, IconDoc, IconUsers, IconEye, IconGift,
} from './Icons';
import './beneficios.css';

// ============================================================================
// Cupons e Comissões — acompanhamento financeiro das parcerias do tipo
// "cupom com comissão".
//
// Esta tela só LÊ vouchers, resgates, fechamentos e parcerias. Toda ação que
// mexe em dinheiro (fechar período, registrar pagamento) passa pelas Cloud
// Functions — nunca gravamos direto nessas coleções.
//
// Importante: os listeners escutam a coleção inteira, SEM orderBy (orderBy
// exclui documentos sem o campo), e toda ordenação acontece aqui no cliente.
// Erros de leitura aparecem na tela — nunca são engolidos.
//
// Todo dinheiro é somado em CENTAVOS inteiros.
// ============================================================================

const JANELA_CONTESTACAO_MS = 24 * 3600000;

// ---- Formatação ------------------------------------------------------------

const FORMATO_BRL = (() => {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }); } catch { return null; }
})();

const centavosInteiros = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

function moeda(centavos) {
  const c = centavosInteiros(centavos);
  if (FORMATO_BRL) return FORMATO_BRL.format(c / 100);
  const abs = Math.abs(c);
  const reais = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${c < 0 ? '-' : ''}R$ ${reais},${String(abs % 100).padStart(2, '0')}`;
}

// Número para planilha (Excel em português): sem "R$", sem milhar, vírgula decimal.
function decimalPlanilha(centavos) {
  const c = centavosInteiros(centavos);
  const abs = Math.abs(c);
  return `${c < 0 ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

const somar = (lista, campo) => lista.reduce((acc, item) => acc + centavosInteiros(item[campo]), 0);

function toMs(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const p = Date.parse(ts);
  return Number.isFinite(p) ? p : null;
}

const dois = (n) => String(n).padStart(2, '0');
function fmtData(ms) {
  if (ms == null) return '—';
  const d = new Date(ms);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function fmtHora(ms) {
  if (ms == null) return '';
  const d = new Date(ms);
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
}
const fmtDataHora = (ms) => (ms == null ? '—' : `${fmtData(ms)} às ${fmtHora(ms)}`);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function duracaoTexto(ms) {
  const horas = Math.floor(ms / 3600000);
  if (horas < 1) return 'menos de 1 hora';
  if (horas < 48) return plural(horas, 'hora', 'horas');
  return plural(Math.floor(horas / 24), 'dia', 'dias');
}

// Data de referência de uma utilização (para os filtros de período).
const dataResgate = (r) => toMs(r.criadoEm) ?? toMs(r.concluidoEm);

// ---- Períodos --------------------------------------------------------------

const PERIODOS = [
  { id: 'mes', label: 'Este mês' },
  { id: 'mesAnterior', label: 'Mês passado' },
  { id: '90d', label: 'Últimos 90 dias' },
  { id: 'tudo', label: 'Todo o histórico' },
  { id: 'custom', label: 'Escolher datas' },
];

function dataDoInput(valor, fimDoDia) {
  if (!valor) return null;
  const [a, m, d] = valor.split('-').map(Number);
  if (!a || !m || !d) return null;
  return fimDoDia ? new Date(a, m - 1, d, 23, 59, 59, 999).getTime() : new Date(a, m - 1, d).getTime();
}

function intervaloDe(id, custom = {}) {
  const agora = new Date();
  const a = agora.getFullYear();
  const m = agora.getMonth();
  const fimHoje = new Date(a, m, agora.getDate(), 23, 59, 59, 999).getTime();
  if (id === 'mes') return { inicio: new Date(a, m, 1).getTime(), fim: new Date(a, m + 1, 1).getTime() - 1 };
  if (id === 'mesAnterior') return { inicio: new Date(a, m - 1, 1).getTime(), fim: new Date(a, m, 1).getTime() - 1 };
  if (id === '90d') return { inicio: new Date(a, m, agora.getDate() - 89).getTime(), fim: fimHoje };
  if (id === 'custom') return { inicio: dataDoInput(custom.inicio, false), fim: dataDoInput(custom.fim, true) };
  return { inicio: null, fim: null };
}

function dentroDo(ms, iv) {
  if (iv.inicio == null && iv.fim == null) return true;
  if (ms == null) return false;
  if (iv.inicio != null && ms < iv.inicio) return false;
  if (iv.fim != null && ms > iv.fim) return false;
  return true;
}

function descreverIntervalo(iv) {
  if (iv.inicio == null && iv.fim == null) return 'todo o histórico';
  if (iv.inicio != null && iv.fim != null) return `de ${fmtData(iv.inicio)} a ${fmtData(iv.fim)}`;
  if (iv.inicio != null) return `a partir de ${fmtData(iv.inicio)}`;
  return `até ${fmtData(iv.fim)}`;
}

// ---- Situações de uma utilização (resgate) ---------------------------------

const STATUS = {
  CONCLUIDO: {
    rotulo: 'Aguardando a cliente confirmar',
    ajuda: 'O parceiro registrou o atendimento. Falta a cliente confirmar no app que ele aconteceu.',
    cor: '#C6A46E', fg: '#7A5C2E', bg: 'rgba(198,164,110,.16)',
  },
  CONFIRMADO_USUARIO: {
    rotulo: 'Em prazo de contestação',
    ajuda: 'A cliente confirmou. Esperamos 24 horas por segurança; depois fica pronto para cobrar sozinho.',
    cor: '#8FA5C6', fg: '#46597A', bg: 'rgba(185,200,223,.34)',
  },
  ELEGIVEL_LIQUIDACAO: {
    rotulo: 'Pronto para cobrar',
    ajuda: 'Tudo certo com este atendimento. Ele entra na próxima cobrança que você gerar para o parceiro.',
    cor: '#8B7AC0', fg: '#5C4F8A', bg: '#EDE9F5',
  },
  AGUARDANDO_PAGAMENTO: {
    rotulo: 'Cobrado, aguardando pagamento',
    ajuda: 'Já faz parte de uma cobrança enviada ao parceiro. Quando ele pagar, registre o recebimento.',
    cor: '#D39A7C', fg: '#8A523A', bg: 'rgba(242,201,184,.42)',
  },
  LIQUIDADO: {
    rotulo: 'Recebido',
    ajuda: 'O parceiro já pagou esta comissão. Nada mais a fazer.',
    cor: '#7A9E7E', fg: '#43614A', bg: 'rgba(122,158,126,.16)',
  },
  CONTESTADO: {
    rotulo: 'Contestado',
    ajuda: 'A cliente informou que o atendimento não aconteceu; esse valor não será cobrado.',
    cor: '#B4635A', fg: '#94463E', bg: 'rgba(180,99,90,.11)',
  },
};
const ORDEM_STATUS = ['CONCLUIDO', 'CONFIRMADO_USUARIO', 'ELEGIVEL_LIQUIDACAO', 'AGUARDANDO_PAGAMENTO', 'LIQUIDADO', 'CONTESTADO'];

const infoStatus = (s) => STATUS[s] || {
  rotulo: s ? `Situação: ${s}` : 'Sem situação',
  ajuda: 'Situação não reconhecida por esta tela.',
  cor: '#9C979F', fg: '#6E6B73', bg: 'var(--surface-2)',
};
const varsStatus = (s) => {
  const i = infoStatus(s);
  return { '--bnf-cor': i.cor, '--bnf-fg': i.fg, '--bnf-bg': i.bg };
};

function detalheStatus(r, agora) {
  switch (r.status) {
    case 'CONCLUIDO': {
      const t = toMs(r.concluidoEm) ?? dataResgate(r);
      return t ? `Esperando a cliente há ${duracaoTexto(Math.max(0, agora - t))}` : '';
    }
    case 'CONFIRMADO_USUARIO': {
      const c = toMs(r.confirmadoEm);
      if (!c) return 'Prazo de 24 horas em andamento';
      const falta = c + JANELA_CONTESTACAO_MS - agora;
      return falta > 0
        ? `Fica pronto para cobrar em cerca de ${duracaoTexto(falta)}`
        : 'Prazo encerrado — é liberado na próxima verificação automática (até 1 hora)';
    }
    case 'ELEGIVEL_LIQUIDACAO': return 'Entra no próximo fechamento desta parceria';
    case 'AGUARDANDO_PAGAMENTO': return 'Incluído em uma cobrança em aberto';
    case 'LIQUIDADO': return toMs(r.liquidadoEm) ? `Recebido em ${fmtData(toMs(r.liquidadoEm))}` : 'Comissão recebida';
    case 'CONTESTADO': return STATUS.CONTESTADO.ajuda;
    default: return '';
  }
}

// Um voucher conta como "usado" quando virou um atendimento registrado.
const VOUCHER_USADO = ['CONCLUIDO', 'CONFIRMADO_USUARIO', 'CONTESTADO'];
const voucherFoiUsado = (v) => !!v.resgateId || VOUCHER_USADO.includes(v.status);

const FORMAS_PAGAMENTO = ['Pix', 'Transferência', 'Dinheiro', 'Outro'];

// ---- Jornada do cupom ------------------------------------------------------

const PASSOS = [
  { quem: 'Cliente', titulo: 'Gera o cupom', texto: 'No app, a cliente escolhe a parceria e gera um código (ex.: TRV-AB12CD). Isso ainda não é venda nem comissão.' },
  { quem: 'Parceiro', titulo: 'Registra o atendimento', texto: 'Na hora do serviço, o parceiro valida o código e informa o valor. O sistema calcula o desconto e a comissão.', status: 'CONCLUIDO' },
  { quem: 'Cliente', titulo: 'Confirma no app', texto: 'A cliente recebe um aviso e confirma que o atendimento aconteceu. Se disser que não, vira "Contestado" e não é cobrado.' },
  { quem: 'Automático', titulo: '24 horas para contestar', texto: 'Um prazo de segurança, caso a cliente mude de ideia. Você não precisa fazer nada.', status: 'CONFIRMADO_USUARIO' },
  { quem: 'Automático', titulo: 'Pronto para cobrar', texto: 'Passado o prazo, o sistema libera o valor sozinho. Ele aparece em "Pronto para cobrar".', status: 'ELEGIVEL_LIQUIDACAO' },
  { quem: 'Você', titulo: 'Fecha o período e cobra', texto: 'Você junta tudo o que está pronto em uma cobrança e envia ao parceiro o valor da comissão.', status: 'AGUARDANDO_PAGAMENTO' },
  { quem: 'Você', titulo: 'Registra o recebimento', texto: 'Quando o parceiro pagar, registre aqui como e quando recebeu. Pronto: comissão recebida.', status: 'LIQUIDADO' },
];

// ---- CSV -------------------------------------------------------------------

function baixarCsv(nomeArquivo, linhas) {
  const escapar = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM para o Excel reconhecer acentos; ';' é o separador do Excel brasileiro.
  const conteudo = '﻿' + linhas.map(l => l.map(escapar).join(';')).join('\r\n');
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function linhasCsvResgates(lista, nomeParceria) {
  const cabecalho = [
    'Data', 'Hora', 'Código do cupom', 'Parceria', 'Valor do serviço (R$)', 'Desconto da cliente (R$)',
    'Desconto total (R$)', 'Valor pago pela cliente (R$)', 'Comissão Atravessia (R$)', 'Situação', 'Cobrança',
  ];
  return [cabecalho, ...lista.map(r => {
    const t = dataResgate(r);
    return [
      t == null ? '' : fmtData(t), t == null ? '' : fmtHora(t), r.codigoPublico || '', nomeParceria(r),
      decimalPlanilha(r.valorOriginalCentavos), decimalPlanilha(r.valorDescontoClienteCentavos),
      decimalPlanilha(r.valorDescontoCentavos), decimalPlanilha(r.valorFinalCentavos),
      decimalPlanilha(r.valorComissaoCentavos), infoStatus(r.status).rotulo, r.fechamentoId || '',
    ];
  })];
}

const hojeArquivo = () => {
  const d = new Date();
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
};

// ---- Pequenos componentes ----------------------------------------------------

function StatusBadge({ status }) {
  return (
    <span className="bnf-status" style={varsStatus(status)}>
      <span className="bnf-status-dot" />{infoStatus(status).rotulo}
    </span>
  );
}

function Carregando({ texto = 'Carregando...' }) {
  return <div className="bnf-carregando"><div className="spinner" />{texto}</div>;
}

const COLUNAS = [
  { id: 'data', label: 'Data e hora' },
  { id: 'codigo', label: 'Cupom' },
  { id: 'parceria', label: 'Parceria' },
  { id: 'original', label: 'Valor do serviço', num: true },
  { id: 'descCliente', label: 'Desconto da cliente', num: true },
  { id: 'final', label: 'Cliente pagou', num: true },
  { id: 'comissao', label: 'Comissão', num: true },
  { id: 'status', label: 'Situação' },
];

// ============================================================================

export default function Beneficios({ showToast }) {
  const toast = (msg, tipo) => { if (typeof showToast === 'function') showToast(msg, tipo); };

  // Dados
  const [parcerias, setParcerias] = useState([]);
  const [resgates, setResgates] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [fechamentos, setFechamentos] = useState([]);
  const [carregado, setCarregado] = useState({ parcerias: false, resgates: false, vouchers: false, fechamentos: false });
  const [erros, setErros] = useState({});

  // Filtros
  const [filtroParceria, setFiltroParceria] = useState('todas');
  const [periodo, setPeriodo] = useState('mes');
  const [custom, setCustom] = useState({ inicio: '', fim: '' });
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState({ col: 'data', dir: 'desc' });
  const [limite, setLimite] = useState(50);

  // Interface
  const [comoAberto, setComoAberto] = useState(null);
  const [abaCobranca, setAbaCobranca] = useState('abertas');
  const [fechar, setFechar] = useState(null);
  const [pagamento, setPagamento] = useState(null);
  const [detalheCobrancaId, setDetalheCobrancaId] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const refUtilizacoes = useRef(null);

  // Atualiza os "faltam X horas" a cada minuto.
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ouvir = (nome, setter) => onSnapshot(
      collection(db, nome),
      (snap) => {
        setter(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCarregado(c => ({ ...c, [nome]: true }));
        setErros(e => (e[nome] ? { ...e, [nome]: null } : e));
      },
      (erro) => {
        console.error(`[Beneficios] erro ao ler ${nome}:`, erro);
        setCarregado(c => ({ ...c, [nome]: true }));
        setErros(e => ({ ...e, [nome]: erro?.code || erro?.message || 'erro desconhecido' }));
      },
    );
    const unsubs = [
      ouvir('parcerias', setParcerias),
      ouvir('resgates', setResgates),
      ouvir('vouchers', setVouchers),
      ouvir('fechamentos', setFechamentos),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const carregando = !carregado.parcerias || !carregado.resgates || !carregado.fechamentos;

  // ---- Derivados ------------------------------------------------------------

  const nomesParceria = useMemo(() => {
    const m = new Map();
    parcerias.forEach(p => m.set(p.id, p.titulo || 'Parceria sem nome'));
    return m;
  }, [parcerias]);
  const nomeParceria = (r) => nomesParceria.get(r.parceriaId) || r.parceriaNome || 'Parceria removida';

  const parceriasCupom = useMemo(
    () => parcerias
      .filter(p => p.tipoBeneficio === 'cupom')
      .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR')),
    [parcerias],
  );

  const iv = useMemo(() => intervaloDe(periodo, custom), [periodo, custom.inicio, custom.fim]);
  const daParceria = (x) => filtroParceria === 'todas' || x.parceriaId === filtroParceria;

  const resgatesPeriodo = useMemo(
    () => resgates.filter(r => daParceria(r) && dentroDo(dataResgate(r), iv)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resgates, filtroParceria, iv],
  );

  const indicadores = useMemo(() => {
    const porStatus = {};
    ORDEM_STATUS.forEach(s => { porStatus[s] = { qtd: 0, comissao: 0 }; });
    resgatesPeriodo.forEach(r => {
      if (!porStatus[r.status]) return;
      porStatus[r.status].qtd += 1;
      porStatus[r.status].comissao += centavosInteiros(r.valorComissaoCentavos);
    });
    const validos = resgatesPeriodo.filter(r => r.status !== 'CONTESTADO');
    return {
      porStatus,
      atendimentos: validos.length,
      movimentado: somar(validos, 'valorOriginalCentavos'),
      descontoClientes: somar(validos, 'valorDescontoClienteCentavos'),
      comissaoTotal: somar(validos, 'valorComissaoCentavos'),
    };
  }, [resgatesPeriodo]);

  const usoCupons = useMemo(() => {
    const doPeriodo = vouchers.filter(v => daParceria(v) && dentroDo(toMs(v.geradoEm), iv));
    const usados = doPeriodo.filter(voucherFoiUsado).length;
    const expirados = doPeriodo.filter(v => v.status === 'EXPIRADO').length;
    const gerados = doPeriodo.length;
    return { gerados, usados, expirados, taxa: gerados ? Math.round((usados / gerados) * 100) : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vouchers, filtroParceria, iv]);

  const porParceria = useMemo(() => {
    const periodoPorId = new Map();
    resgatesPeriodo.forEach(r => {
      if (!periodoPorId.has(r.parceriaId)) periodoPorId.set(r.parceriaId, []);
      periodoPorId.get(r.parceriaId).push(r);
    });
    const saldoPorId = new Map();
    resgates.forEach(r => {
      if (!saldoPorId.has(r.parceriaId)) saldoPorId.set(r.parceriaId, { pronto: 0, prontoQtd: 0, aguardando: 0, emConfirmacao: 0 });
      const s = saldoPorId.get(r.parceriaId);
      const c = centavosInteiros(r.valorComissaoCentavos);
      if (r.status === 'ELEGIVEL_LIQUIDACAO') { s.pronto += c; s.prontoQtd += 1; }
      if (r.status === 'AGUARDANDO_PAGAMENTO') s.aguardando += c;
      if (r.status === 'CONCLUIDO' || r.status === 'CONFIRMADO_USUARIO') s.emConfirmacao += c;
    });
    const vouchersPorId = new Map();
    vouchers.forEach(v => {
      if (!dentroDo(toMs(v.geradoEm), iv)) return;
      if (!vouchersPorId.has(v.parceriaId)) vouchersPorId.set(v.parceriaId, { gerados: 0, usados: 0 });
      const x = vouchersPorId.get(v.parceriaId);
      x.gerados += 1;
      if (voucherFoiUsado(v)) x.usados += 1;
    });
    return parceriasCupom
      .filter(p => filtroParceria === 'todas' || p.id === filtroParceria)
      .map(p => {
        const lista = periodoPorId.get(p.id) || [];
        const validos = lista.filter(r => r.status !== 'CONTESTADO');
        return {
          p,
          usos: validos.length,
          contestados: lista.length - validos.length,
          movimentado: somar(validos, 'valorOriginalCentavos'),
          comissao: somar(validos, 'valorComissaoCentavos'),
          ...(saldoPorId.get(p.id) || { pronto: 0, prontoQtd: 0, aguardando: 0, emConfirmacao: 0 }),
          cupons: vouchersPorId.get(p.id) || { gerados: 0, usados: 0 },
        };
      })
      .sort((a, b) => (b.pronto > 0) - (a.pronto > 0) || (a.p.titulo || '').localeCompare(b.p.titulo || '', 'pt-BR'));
  }, [resgatesPeriodo, resgates, vouchers, parceriasCupom, filtroParceria, iv]);

  const resgatesPorFechamento = useMemo(() => {
    const m = new Map();
    resgates.forEach(r => {
      if (!r.fechamentoId) return;
      if (!m.has(r.fechamentoId)) m.set(r.fechamentoId, []);
      m.get(r.fechamentoId).push(r);
    });
    return m;
  }, [resgates]);

  const cobrancas = useMemo(() => {
    const doFiltro = fechamentos.filter(daParceria);
    return {
      abertas: doFiltro.filter(f => f.status !== 'PAGO').sort((a, b) => (toMs(b.geradoEm) ?? 0) - (toMs(a.geradoEm) ?? 0)),
      pagas: doFiltro.filter(f => f.status === 'PAGO').sort((a, b) => (toMs(b.pagoEm) ?? 0) - (toMs(a.pagoEm) ?? 0)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechamentos, filtroParceria]);
  const totalAbertas = somar(cobrancas.abertas, 'valorComissaoTotalCentavos');

  const listaUtilizacoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrada = resgatesPeriodo.filter(r => {
      if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false;
      if (!termo) return true;
      return (r.codigoPublico || '').toLowerCase().includes(termo)
        || (nomesParceria.get(r.parceriaId) || r.parceriaNome || '').toLowerCase().includes(termo);
    });
    const valor = (r) => {
      switch (ordem.col) {
        case 'codigo': return r.codigoPublico || '';
        case 'parceria': return (nomesParceria.get(r.parceriaId) || r.parceriaNome || '').toLowerCase();
        case 'original': return centavosInteiros(r.valorOriginalCentavos);
        case 'descCliente': return centavosInteiros(r.valorDescontoClienteCentavos);
        case 'final': return centavosInteiros(r.valorFinalCentavos);
        case 'comissao': return centavosInteiros(r.valorComissaoCentavos);
        case 'status': { const i = ORDEM_STATUS.indexOf(r.status); return i < 0 ? 99 : i; }
        default: return dataResgate(r) ?? 0;
      }
    };
    const sinal = ordem.dir === 'asc' ? 1 : -1;
    return [...filtrada].sort((a, b) => {
      const va = valor(a); const vb = valor(b);
      if (typeof va === 'string') return va.localeCompare(vb, 'pt-BR') * sinal;
      return (va - vb) * sinal;
    });
  }, [resgatesPeriodo, filtroStatus, busca, ordem, nomesParceria]);

  useEffect(() => { setLimite(50); }, [filtroParceria, periodo, custom.inicio, custom.fim, filtroStatus, busca]);

  const semNenhumDado = !carregando && resgates.length === 0 && fechamentos.length === 0;
  const comoEstaAberto = comoAberto ?? semNenhumDado;
  const filtrosAtivos = filtroParceria !== 'todas' || periodo !== 'mes' || filtroStatus !== 'todos' || busca.trim() !== '';

  // ---- Ações ----------------------------------------------------------------

  const verUtilizacoes = (parceriaId, status) => {
    if (parceriaId) setFiltroParceria(parceriaId);
    if (status) setFiltroStatus(status);
    setTimeout(() => refUtilizacoes.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const ordenarPor = (col) => {
    setOrdem(o => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'codigo' || col === 'parceria' || col === 'status' ? 'asc' : 'desc' }));
  };

  const exportarCsv = () => {
    if (listaUtilizacoes.length === 0) { toast('Não há utilizações neste filtro para exportar.', 'error'); return; }
    baixarCsv(`cupons-utilizacoes-${hojeArquivo()}.csv`, linhasCsvResgates(listaUtilizacoes, nomeParceria));
    toast(`Planilha gerada com ${plural(listaUtilizacoes.length, 'utilização', 'utilizações')}.`);
  };

  const abrirFechar = (p) => setFechar({ parceria: p, modo: 'tudo', inicio: '', fim: '', resultado: null, erro: null });

  const intervaloFechar = fechar
    ? (fechar.modo === 'tudo' ? { inicio: null, fim: null } : intervaloDe(fechar.modo, { inicio: fechar.inicio, fim: fechar.fim }))
    : { inicio: null, fim: null };

  const previaFechar = useMemo(() => {
    if (!fechar) return null;
    const prontos = resgates.filter(r => r.parceriaId === fechar.parceria.id && r.status === 'ELEGIVEL_LIQUIDACAO');
    // Mesmo critério da Cloud Function: data em que o parceiro concluiu o atendimento.
    const itens = prontos.filter(r => {
      const t = toMs(r.concluidoEm) ?? 0;
      if (intervaloFechar.inicio != null && t < intervaloFechar.inicio) return false;
      if (intervaloFechar.fim != null && t > intervaloFechar.fim) return false;
      return true;
    }).sort((a, b) => (toMs(a.concluidoEm) ?? 0) - (toMs(b.concluidoEm) ?? 0));
    return {
      itens,
      foraDoPeriodo: prontos.length - itens.length,
      original: somar(itens, 'valorOriginalCentavos'),
      descontoCliente: somar(itens, 'valorDescontoClienteCentavos'),
      comissao: somar(itens, 'valorComissaoCentavos'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechar, resgates, intervaloFechar.inicio, intervaloFechar.fim]);

  const confirmarFechamento = async () => {
    if (!fechar || !previaFechar || previaFechar.itens.length === 0) return;
    setProcessando(true);
    setFechar(f => ({ ...f, erro: null }));
    try {
      const payload = { parceriaId: fechar.parceria.id };
      if (intervaloFechar.inicio != null) payload.periodoInicio = new Date(intervaloFechar.inicio).toISOString();
      if (intervaloFechar.fim != null) payload.periodoFim = new Date(intervaloFechar.fim).toISOString();
      const { data } = await httpsCallable(functions, 'fecharPeriodoParceria')(payload);
      const resultado = {
        fechamentoId: data?.fechamentoId,
        totalResgates: Number(data?.totalResgates) || 0,
        comissaoCentavos: Math.round(Number(data?.comissao || 0) * 100),
      };
      setFechar(f => ({ ...f, resultado }));
      toast(`Cobrança gerada: ${moeda(resultado.comissaoCentavos)}.`, 'success');
    } catch (e) {
      console.error('[Beneficios] fecharPeriodoParceria:', e);
      const msg = e?.message || 'Não foi possível fechar o período.';
      setFechar(f => ({ ...f, erro: msg }));
      toast(msg, 'error');
    } finally {
      setProcessando(false);
    }
  };

  const abrirPagamento = (f) => setPagamento({ fechamento: f, forma: 'Pix', formaOutro: '', referencia: '', observacao: '', erro: null });

  const confirmarPagamento = async () => {
    if (!pagamento) return;
    const metodo = pagamento.forma === 'Outro' ? (pagamento.formaOutro.trim() || 'Outro') : pagamento.forma;
    setProcessando(true);
    setPagamento(p => ({ ...p, erro: null }));
    try {
      await httpsCallable(functions, 'registrarPagamentoFechamento')({
        fechamentoId: pagamento.fechamento.id,
        metodoPagamento: metodo,
        referencia: pagamento.referencia.trim(),
        observacao: pagamento.observacao.trim(),
      });
      setPagamento(null);
      toast('Pagamento registrado. A comissão agora aparece como recebida.', 'success');
    } catch (e) {
      console.error('[Beneficios] registrarPagamentoFechamento:', e);
      const msg = e?.message || 'Não foi possível registrar o pagamento.';
      setPagamento(p => (p ? { ...p, erro: msg } : p));
      toast(msg, 'error');
    } finally {
      setProcessando(false);
    }
  };

  const detalheCobranca = detalheCobrancaId ? fechamentos.find(f => f.id === detalheCobrancaId) : null;

  const periodoCobranca = (f) => {
    const i = toMs(f.periodoInicio); const fi = toMs(f.periodoFim);
    if (i != null || fi != null) return descreverIntervalo({ inicio: i, fim: fi });
    return `tudo o que estava pronto até ${fmtData(toMs(f.geradoEm))}`;
  };

  // ---- Render ---------------------------------------------------------------

  if (carregando) {
    return <div className="screen-content"><Carregando texto="Carregando cupons e comissões..." /></div>;
  }

  const ROTULO_COLECAO = {
    parcerias: 'as parcerias', resgates: 'as utilizações de cupom', vouchers: 'os cupons gerados', fechamentos: 'as cobranças',
  };
  const listaErros = Object.entries(erros).filter(([, v]) => v);

  return (
    <div className="screen-content bnf">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Cupons e Comissões</h1>
          <p className="screen-sub">
            Acompanhe cada uso de cupom, do atendimento no parceiro até a comissão cair na conta.
            Só conta como comissão o que a cliente confirmou — gerar um cupom não é receita.
          </p>
        </div>
        <button className="btn-ghost" onClick={() => setComoAberto(!comoEstaAberto)}>
          <IconSpark size={15} />{comoEstaAberto ? 'Ocultar explicação' : 'Como funciona'}
        </button>
      </div>

      {listaErros.length > 0 && (
        <div className="bnf-erro" role="alert">
          <IconAlert size={18} />
          <div>
            <strong>Não foi possível carregar tudo.</strong>
            {listaErros.map(([nome, cod]) => (
              <div key={nome}>Falha ao ler {ROTULO_COLECAO[nome] || nome} <span className="bnf-erro-cod">({cod})</span>.</div>
            ))}
            <div className="bnf-erro-dica">
              Os números abaixo podem estar incompletos. Recarregue a página; se continuar, confirme que você entrou
              com uma conta de administradora e avise o suporte técnico com o código entre parênteses.
            </div>
          </div>
        </div>
      )}

      {comoEstaAberto && (
        <section className="card bnf-como">
          <div className="bnf-como-topo">
            <div>
              <h2 className="bnf-titulo-secao">Como funciona um cupom, do começo ao fim</h2>
              <p className="bnf-sub-secao">
                Cada etapa abaixo aparece nesta tela com o mesmo nome e a mesma cor. Você só age nas duas últimas.
              </p>
            </div>
            <button className="modal-close" onClick={() => setComoAberto(false)} aria-label="Fechar explicação"><IconClose size={16} /></button>
          </div>
          <ol className="bnf-passos">
            {PASSOS.map((passo, i) => (
              <li key={passo.titulo} className={`bnf-passo ${passo.quem === 'Você' ? 'bnf-passo-voce' : ''}`}
                style={passo.status ? varsStatus(passo.status) : undefined}>
                <div className="bnf-passo-num">{i + 1}</div>
                <div className="bnf-passo-quem">{passo.quem}</div>
                <div className="bnf-passo-titulo">{passo.titulo}</div>
                <p className="bnf-passo-texto">{passo.texto}</p>
                {passo.status && <StatusBadge status={passo.status} />}
              </li>
            ))}
          </ol>
          <div className="bnf-como-desvio" style={varsStatus('CONTESTADO')}>
            <IconAlert size={16} />
            <span>
              <strong>E se a cliente contestar?</strong> Se ela disser no app que o atendimento não aconteceu, a utilização
              fica como <strong>Contestado</strong> e esse valor não é cobrado do parceiro. Vale conversar com o parceiro para entender o que houve.
            </span>
          </div>
        </section>
      )}

      {parceriasCupom.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconTag size={34} /></div>
          <p>
            <strong>Nenhuma parceria com cupom ainda.</strong><br />
            Em <strong>Parcerias</strong>, edite uma parceria e escolha o tipo <strong>"Cupom com comissão"</strong>,
            definindo o desconto total e a sua comissão. Ela aparecerá aqui automaticamente.
            <br />Parcerias do tipo "Link simples" não geram comissão e não entram nesta tela.
          </p>
        </div>
      ) : (
        <>
          {/* ---------------- Filtros ---------------- */}
          <section className="card bnf-filtros">
            <div className="bnf-filtro">
              <label htmlFor="bnf-parceria">Parceria</label>
              <select id="bnf-parceria" value={filtroParceria} onChange={e => setFiltroParceria(e.target.value)}>
                <option value="todas">Todas as parcerias com cupom</option>
                {parceriasCupom.map(p => (
                  <option key={p.id} value={p.id}>{p.titulo || 'Parceria sem nome'}{p.ativo === false ? ' (inativa)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="bnf-filtro bnf-filtro-periodo">
              <label>Período</label>
              <div className="bnf-chips">
                {PERIODOS.map(p => (
                  <button key={p.id} className={`chip ${periodo === p.id ? 'chip-active' : ''}`} onClick={() => setPeriodo(p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
              {periodo === 'custom' && (
                <div className="bnf-datas">
                  <label>De <input type="date" value={custom.inicio} onChange={e => setCustom(c => ({ ...c, inicio: e.target.value }))} /></label>
                  <label>até <input type="date" value={custom.fim} onChange={e => setCustom(c => ({ ...c, fim: e.target.value }))} /></label>
                </div>
              )}
            </div>
            <div className="bnf-filtro">
              <label htmlFor="bnf-status">Situação</label>
              <select id="bnf-status" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                <option value="todos">Todas as situações</option>
                {ORDEM_STATUS.map(s => <option key={s} value={s}>{STATUS[s].rotulo}</option>)}
              </select>
            </div>
            <div className="bnf-filtro-rodape">
              <span>Mostrando <strong>{descreverIntervalo(iv)}</strong>
                {filtroParceria !== 'todas' && <> · {nomesParceria.get(filtroParceria)}</>}
              </span>
              {filtrosAtivos && (
                <button className="bnf-link" onClick={() => {
                  setFiltroParceria('todas'); setPeriodo('mes'); setFiltroStatus('todos'); setBusca('');
                }}>Limpar filtros</button>
              )}
            </div>
          </section>

          {/* ---------------- Indicadores ---------------- */}
          <h2 className="bnf-titulo-secao">Onde está o dinheiro das comissões</h2>
          <p className="bnf-sub-secao">
            Cada cartão é uma etapa da jornada. Os valores são da comissão da Atravessia no período escolhido.
            Clique em um cartão para ver só aquelas utilizações.
          </p>
          <div className="bnf-kpis">
            {ORDEM_STATUS.map(s => {
              const dado = indicadores.porStatus[s];
              const ativo = filtroStatus === s;
              return (
                <button key={s} className={`bnf-kpi ${ativo ? 'bnf-kpi-ativo' : ''} ${s === 'CONTESTADO' ? 'bnf-kpi-contestado' : ''}`}
                  style={varsStatus(s)} onClick={() => verUtilizacoes(null, ativo ? 'todos' : s)} aria-pressed={ativo}>
                  <div className="bnf-kpi-titulo"><span className="bnf-status-dot" />{STATUS[s].rotulo}</div>
                  <div className="bnf-kpi-valor">{moeda(dado.comissao)}</div>
                  <div className="bnf-kpi-qtd">
                    {plural(dado.qtd, 'atendimento', 'atendimentos')}{s === 'CONTESTADO' && dado.qtd > 0 ? ' · não cobrado' : ''}
                  </div>
                  <div className="bnf-kpi-ajuda">{STATUS[s].ajuda}</div>
                </button>
              );
            })}
          </div>

          <div className="bnf-resumo">
            <div className="bnf-resumo-item">
              <div className="bnf-resumo-icone"><IconChart size={16} /></div>
              <div className="bnf-resumo-valor">{moeda(indicadores.movimentado)}</div>
              <div className="bnf-resumo-rotulo">Movimentado nas parceiras</div>
              <div className="bnf-resumo-ajuda">Soma do valor dos serviços em {plural(indicadores.atendimentos, 'atendimento', 'atendimentos')} (sem contestados).</div>
            </div>
            <div className="bnf-resumo-item">
              <div className="bnf-resumo-icone bnf-ic-sage"><IconGift size={16} /></div>
              <div className="bnf-resumo-valor">{moeda(indicadores.descontoClientes)}</div>
              <div className="bnf-resumo-rotulo">Economia das clientes</div>
              <div className="bnf-resumo-ajuda">Quanto as clientes deixaram de pagar graças aos cupons.</div>
            </div>
            <div className="bnf-resumo-item">
              <div className="bnf-resumo-icone bnf-ic-gold"><IconTag size={16} /></div>
              <div className="bnf-resumo-valor">{moeda(indicadores.comissaoTotal)}</div>
              <div className="bnf-resumo-rotulo">Comissão total gerada</div>
              <div className="bnf-resumo-ajuda">Tudo o que a Atravessia tem a receber ou já recebeu no período (sem contestados).</div>
            </div>
            <div className="bnf-resumo-item">
              <div className="bnf-resumo-icone"><IconUsers size={16} /></div>
              {erros.vouchers ? (
                <div className="bnf-resumo-ajuda">Não foi possível ler os cupons gerados.</div>
              ) : !carregado.vouchers ? (
                <div className="bnf-resumo-ajuda">Carregando cupons gerados...</div>
              ) : (
                <>
                  <div className="bnf-resumo-valor">{usoCupons.usados} <span className="bnf-resumo-de">de {usoCupons.gerados}</span></div>
                  <div className="bnf-resumo-rotulo">Cupons usados x gerados</div>
                  <div className="bnf-barra" aria-hidden="true"><span style={{ width: `${usoCupons.taxa}%` }} /></div>
                  <div className="bnf-resumo-ajuda">
                    {usoCupons.gerados === 0
                      ? 'Nenhum cupom gerado neste período.'
                      : `${usoCupons.taxa}% dos cupons gerados viraram atendimento${usoCupons.expirados ? ` · ${usoCupons.expirados} expiraram sem uso` : ''}.`}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ---------------- Por parceria ---------------- */}
          <h2 className="bnf-titulo-secao">Por parceria</h2>
          <p className="bnf-sub-secao">
            Usos, movimentado e comissão seguem o período escolhido. "Pronto para cobrar" e "Aguardando pagamento"
            mostram o saldo de hoje, de qualquer data.
          </p>
          <div className="bnf-parcerias">
            {porParceria.map(x => (
              <article key={x.p.id} className={`bnf-parc ${x.pronto > 0 ? 'bnf-parc-destaque' : ''}`}>
                <header className="bnf-parc-topo">
                  <div className="bnf-parc-icone"><IconTag size={17} /></div>
                  <div className="bnf-parc-nome-wrap">
                    <div className="bnf-parc-nome">{x.p.titulo || 'Parceria sem nome'}</div>
                    <div className="bnf-parc-regra">
                      Desconto de {Number(x.p.percentualBeneficio) || 0}%: {Number(x.p.percentualDescontoCliente ?? Math.max(0, (Number(x.p.percentualBeneficio) || 0) - (Number(x.p.percentualComissao) || 0)))}% para a cliente
                      e {Number(x.p.percentualComissao) || 0}% de comissão
                      {x.p.baseCalculoComissao === 'valor_final' ? ' (sobre o valor com desconto)' : ' (sobre o valor cheio)'}
                    </div>
                  </div>
                  {x.p.ativo === false && <span className="badge badge-inactive">Inativa</span>}
                </header>
                <div className="bnf-parc-metricas">
                  <div><span>Usos no período</span><strong>{x.usos}</strong>
                    {x.contestados > 0 && <em className="bnf-txt-contestado">+{x.contestados} contestado{x.contestados > 1 ? 's' : ''}</em>}
                  </div>
                  <div><span>Movimentado</span><strong>{moeda(x.movimentado)}</strong></div>
                  <div><span>Comissão no período</span><strong>{moeda(x.comissao)}</strong></div>
                  <div><span>Cupons usados</span><strong>{x.cupons.usados} de {x.cupons.gerados}</strong></div>
                </div>
                <div className="bnf-parc-saldos">
                  <div style={varsStatus('ELEGIVEL_LIQUIDACAO')}>
                    <span>Pronto para cobrar</span><strong>{moeda(x.pronto)}</strong>
                    {x.prontoQtd > 0 && <em>{plural(x.prontoQtd, 'atendimento', 'atendimentos')}</em>}
                  </div>
                  <div style={varsStatus('AGUARDANDO_PAGAMENTO')}>
                    <span>Aguardando pagamento</span><strong>{moeda(x.aguardando)}</strong>
                  </div>
                </div>
                {x.emConfirmacao > 0 && (
                  <div className="bnf-parc-nota">Mais {moeda(x.emConfirmacao)} ainda em confirmação pela cliente ou no prazo de 24h.</div>
                )}
                <footer className="bnf-parc-acoes">
                  {x.pronto > 0 ? (
                    <button className="btn-primary" onClick={() => abrirFechar(x.p)}><IconDoc size={15} />Fechar período e cobrar</button>
                  ) : (
                    <span className="bnf-parc-nada">Nada pronto para cobrar agora.</span>
                  )}
                  <button className="btn-ghost" onClick={() => verUtilizacoes(x.p.id)}><IconEye size={15} />Ver utilizações</button>
                </footer>
              </article>
            ))}
          </div>

          {/* ---------------- Cobranças ---------------- */}
          <section className="card bnf-cobrancas">
            <div className="bnf-cob-topo">
              <div>
                <h2 className="bnf-titulo-secao">Cobranças aos parceiros</h2>
                <p className="bnf-sub-secao">
                  Cada cobrança nasce quando você fecha um período. Envie o valor ao parceiro e, ao receber, registre o pagamento.
                </p>
              </div>
              <div className="bnf-segmento" role="tablist">
                <button role="tab" aria-selected={abaCobranca === 'abertas'} className={abaCobranca === 'abertas' ? 'ativo' : ''}
                  onClick={() => setAbaCobranca('abertas')}>Em aberto ({cobrancas.abertas.length})</button>
                <button role="tab" aria-selected={abaCobranca === 'pagas'} className={abaCobranca === 'pagas' ? 'ativo' : ''}
                  onClick={() => setAbaCobranca('pagas')}>Pagas ({cobrancas.pagas.length})</button>
              </div>
            </div>

            {abaCobranca === 'abertas' && cobrancas.abertas.length > 0 && (
              <div className="bnf-cob-total" style={varsStatus('AGUARDANDO_PAGAMENTO')}>
                Total a receber em cobranças abertas: <strong>{moeda(totalAbertas)}</strong>
              </div>
            )}

            {(abaCobranca === 'abertas' ? cobrancas.abertas : cobrancas.pagas).length === 0 ? (
              <div className="bnf-vazio">
                {abaCobranca === 'abertas'
                  ? 'Nenhuma cobrança em aberto. Quando uma parceria tiver valor "Pronto para cobrar", use "Fechar período e cobrar" no cartão dela.'
                  : 'Nenhuma cobrança paga ainda. Quando você registrar um pagamento recebido, ele fica guardado aqui como histórico.'}
              </div>
            ) : (
              <ul className="bnf-cob-lista">
                {(abaCobranca === 'abertas' ? cobrancas.abertas : cobrancas.pagas).map(f => {
                  const paga = f.status === 'PAGO';
                  return (
                    <li key={f.id} className="bnf-cob" style={varsStatus(paga ? 'LIQUIDADO' : 'AGUARDANDO_PAGAMENTO')}>
                      <div className="bnf-cob-info">
                        <div className="bnf-cob-parceria">{nomesParceria.get(f.parceriaId) || 'Parceria removida'}</div>
                        <div className="bnf-cob-meta">
                          Período: {periodoCobranca(f)} · {plural(Number(f.totalResgates) || 0, 'atendimento', 'atendimentos')}
                        </div>
                        <div className="bnf-cob-meta">
                          Gerada em {fmtDataHora(toMs(f.geradoEm))}
                          {paga && <> · Paga em {fmtDataHora(toMs(f.pagoEm))}{f.metodoPagamento ? ` via ${f.metodoPagamento}` : ''}</>}
                        </div>
                        {paga && f.referenciaPagamento && <div className="bnf-cob-meta">Comprovante: {f.referenciaPagamento}</div>}
                      </div>
                      <div className="bnf-cob-valor">
                        <strong>{moeda(f.valorComissaoTotalCentavos)}</strong>
                        <span className="bnf-status" style={varsStatus(paga ? 'LIQUIDADO' : 'AGUARDANDO_PAGAMENTO')}>
                          <span className="bnf-status-dot" />{paga ? 'Recebida' : 'Aguardando pagamento'}
                        </span>
                      </div>
                      <div className="bnf-cob-acoes">
                        <button className="btn-ghost" onClick={() => setDetalheCobrancaId(f.id)}>Ver atendimentos</button>
                        {!paga && <button className="btn-primary" onClick={() => abrirPagamento(f)}><IconCheck size={15} />Registrar pagamento recebido</button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ---------------- Utilizações ---------------- */}
          <section className="card bnf-utilizacoes" ref={refUtilizacoes}>
            <div className="bnf-cob-topo">
              <div>
                <h2 className="bnf-titulo-secao">Utilizações de cupom</h2>
                <p className="bnf-sub-secao">
                  Cada linha é um atendimento registrado por um parceiro. Clique no título de uma coluna para ordenar.
                </p>
              </div>
              <button className="btn-ghost" onClick={exportarCsv}><IconDoc size={15} />Exportar planilha (CSV)</button>
            </div>

            <div className="search-bar bnf-busca">
              <IconTag size={15} />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pelo código do cupom (ex.: TRV-AB12CD) ou parceria" />
              {busca && <button className="bnf-link" onClick={() => setBusca('')}>Limpar</button>}
            </div>

            {filtroStatus !== 'todos' && (
              <div className="bnf-filtro-status-aviso" style={varsStatus(filtroStatus)}>
                <span>Mostrando só <strong>{infoStatus(filtroStatus).rotulo}</strong>: {infoStatus(filtroStatus).ajuda}</span>
                <button className="bnf-link" onClick={() => setFiltroStatus('todos')}>Ver todas</button>
              </div>
            )}

            <div className="bnf-contagem">
              {plural(listaUtilizacoes.length, 'utilização encontrada', 'utilizações encontradas')}
              {listaUtilizacoes.length > 0 && <> · comissão somada: <strong>{moeda(somar(listaUtilizacoes.filter(r => r.status !== 'CONTESTADO'), 'valorComissaoCentavos'))}</strong> (sem contestados)</>}
            </div>

            {listaUtilizacoes.length === 0 ? (
              <div className="bnf-vazio">
                {resgates.length === 0
                  ? 'Ainda não houve nenhum atendimento com cupom. Quando uma cliente apresentar o cupom e o parceiro registrar o atendimento, ele aparece aqui na hora.'
                  : 'Nenhuma utilização com esses filtros. Tente escolher "Todo o histórico" no período ou limpar a busca.'}
              </div>
            ) : (
              <>
                <div className="bnf-tabela-wrap">
                  <table className="data-table bnf-tabela">
                    <thead>
                      <tr>
                        {COLUNAS.map(c => (
                          <th key={c.id} className={c.num ? 'bnf-num' : ''} aria-sort={ordem.col === c.id ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                            <button className={`bnf-ordenar ${ordem.col === c.id ? 'ativo' : ''}`} onClick={() => ordenarPor(c.id)}>
                              {c.label}<span className="bnf-seta">{ordem.col === c.id ? (ordem.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {listaUtilizacoes.slice(0, limite).map(r => {
                        const t = dataResgate(r);
                        const contestado = r.status === 'CONTESTADO';
                        return (
                          <tr key={r.id} className={contestado ? 'bnf-linha-contestada' : ''}>
                            <td className="bnf-nowrap">{fmtData(t)}<div className="bnf-td-sub">{fmtHora(t)}</div></td>
                            <td className="bnf-codigo">{r.codigoPublico || '—'}</td>
                            <td>{nomeParceria(r)}</td>
                            <td className="bnf-num">{moeda(r.valorOriginalCentavos)}</td>
                            <td className="bnf-num bnf-txt-sage">{moeda(r.valorDescontoClienteCentavos)}</td>
                            <td className="bnf-num">{moeda(r.valorFinalCentavos)}</td>
                            <td className={`bnf-num bnf-comissao ${contestado ? 'bnf-riscado' : ''}`}>{moeda(r.valorComissaoCentavos)}</td>
                            <td className="bnf-td-status">
                              <StatusBadge status={r.status} />
                              <div className={`bnf-td-sub ${contestado ? 'bnf-txt-contestado' : ''}`}>{detalheStatus(r, agora)}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {listaUtilizacoes.length > limite && (
                  <div className="bnf-mais">
                    <button className="btn-ghost" onClick={() => setLimite(l => l + 50)}>
                      Mostrar mais ({listaUtilizacoes.length - limite} restantes)
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {/* ---------------- Modal: fechar período ---------------- */}
      {fechar && (
        <div className="modal-overlay" onClick={() => !processando && setFechar(null)}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>{fechar.resultado ? 'Cobrança gerada' : `Fechar período — ${fechar.parceria.titulo || 'Parceria'}`}</h2>
              <button className="modal-close" onClick={() => setFechar(null)} disabled={processando}><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              {fechar.resultado ? (
                <div className="bnf-resultado">
                  <div className="bnf-resultado-icone"><IconCheck size={26} /></div>
                  <p className="bnf-resultado-valor">{moeda(fechar.resultado.comissaoCentavos)}</p>
                  <p>
                    {plural(fechar.resultado.totalResgates, 'atendimento foi incluído', 'atendimentos foram incluídos')} na cobrança
                    de <strong>{fechar.parceria.titulo}</strong>. Eles agora aparecem como <strong>Cobrado, aguardando pagamento</strong>.
                  </p>
                  <div className="bnf-proximo">
                    <strong>Próximo passo:</strong> envie ao parceiro o valor de {moeda(fechar.resultado.comissaoCentavos)} (por Pix,
                    transferência ou como vocês combinaram). Quando ele pagar, vá em <strong>Cobranças aos parceiros → Em aberto</strong> e
                    clique em <strong>Registrar pagamento recebido</strong>.
                  </div>
                  <div className="modal-footer">
                    {fechar.resultado.fechamentoId && (
                      <button className="btn-ghost" onClick={() => { setDetalheCobrancaId(fechar.resultado.fechamentoId); setAbaCobranca('abertas'); setFechar(null); }}>
                        Ver a cobrança
                      </button>
                    )}
                    <button className="btn-primary" onClick={() => setFechar(null)}>Concluir</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="bnf-explica">
                    Fechar o período junta os atendimentos <strong>prontos para cobrar</strong> desta parceria em uma única
                    cobrança. Depois disso, você envia o valor ao parceiro e registra quando ele pagar. Nada é cobrado
                    automaticamente — isso só organiza o que você vai cobrar.
                  </p>

                  <div className="field-group">
                    <label>Quais atendimentos entram?</label>
                    <div className="bnf-chips">
                      {[
                        { id: 'tudo', label: 'Tudo o que está pronto' },
                        { id: 'mesAnterior', label: 'Só do mês passado' },
                        { id: 'mes', label: 'Só deste mês' },
                        { id: 'custom', label: 'Escolher datas' },
                      ].map(o => (
                        <button key={o.id} className={`chip ${fechar.modo === o.id ? 'chip-active' : ''}`}
                          onClick={() => setFechar(f => ({ ...f, modo: o.id }))}>{o.label}</button>
                      ))}
                    </div>
                    {fechar.modo === 'custom' && (
                      <div className="bnf-datas">
                        <label>De <input type="date" value={fechar.inicio} onChange={e => setFechar(f => ({ ...f, inicio: e.target.value }))} /></label>
                        <label>até <input type="date" value={fechar.fim} onChange={e => setFechar(f => ({ ...f, fim: e.target.value }))} /></label>
                      </div>
                    )}
                    <span className="field-hint">Considera a data em que o parceiro registrou cada atendimento ({descreverIntervalo(intervaloFechar)}).</span>
                  </div>

                  <div className="bnf-previa" style={varsStatus('ELEGIVEL_LIQUIDACAO')}>
                    <div className="bnf-previa-titulo">Prévia da cobrança</div>
                    <div className="bnf-previa-grid">
                      <div><span>Atendimentos</span><strong>{previaFechar.itens.length}</strong></div>
                      <div><span>Valor dos serviços</span><strong>{moeda(previaFechar.original)}</strong></div>
                      <div><span>Economia das clientes</span><strong>{moeda(previaFechar.descontoCliente)}</strong></div>
                      <div className="bnf-previa-principal"><span>Comissão a cobrar</span><strong>{moeda(previaFechar.comissao)}</strong></div>
                    </div>
                    {previaFechar.foraDoPeriodo > 0 && (
                      <div className="bnf-previa-nota">
                        {plural(previaFechar.foraDoPeriodo, 'outro atendimento pronto fica', 'outros atendimentos prontos ficam')} fora
                        deste período, para um próximo fechamento.
                      </div>
                    )}
                  </div>

                  {previaFechar.itens.length === 0 ? (
                    <div className="bnf-vazio">Nenhum atendimento pronto para cobrar nesse intervalo. Escolha "Tudo o que está pronto" ou outras datas.</div>
                  ) : (
                    <details className="bnf-previa-lista">
                      <summary>Ver os {plural(previaFechar.itens.length, 'atendimento', 'atendimentos')} que entram</summary>
                      <table className="data-table">
                        <thead><tr><th>Data</th><th>Cupom</th><th className="bnf-num">Serviço</th><th className="bnf-num">Comissão</th></tr></thead>
                        <tbody>
                          {previaFechar.itens.map(r => (
                            <tr key={r.id}>
                              <td>{fmtData(toMs(r.concluidoEm) ?? dataResgate(r))}</td>
                              <td className="bnf-codigo">{r.codigoPublico}</td>
                              <td className="bnf-num">{moeda(r.valorOriginalCentavos)}</td>
                              <td className="bnf-num bnf-comissao">{moeda(r.valorComissaoCentavos)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}

                  {fechar.erro && <div className="bnf-erro bnf-erro-inline"><IconAlert size={16} /><div>{fechar.erro}</div></div>}

                  <div className="modal-footer">
                    <button className="btn-ghost" onClick={() => setFechar(null)} disabled={processando}>Cancelar</button>
                    <button className="btn-primary" onClick={confirmarFechamento} disabled={processando || previaFechar.itens.length === 0}>
                      {processando ? 'Gerando cobrança...' : `Confirmar e gerar cobrança de ${moeda(previaFechar.comissao)}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Modal: registrar pagamento ---------------- */}
      {pagamento && (
        <div className="modal-overlay" onClick={() => !processando && setPagamento(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Registrar pagamento recebido</h2>
              <button className="modal-close" onClick={() => setPagamento(null)} disabled={processando}><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              <div className="bnf-previa" style={varsStatus('AGUARDANDO_PAGAMENTO')}>
                <div className="bnf-previa-titulo">{nomesParceria.get(pagamento.fechamento.parceriaId) || 'Parceria'}</div>
                <div className="bnf-previa-grid bnf-previa-grid-2">
                  <div><span>Atendimentos</span><strong>{Number(pagamento.fechamento.totalResgates) || 0}</strong></div>
                  <div className="bnf-previa-principal"><span>Valor recebido</span><strong>{moeda(pagamento.fechamento.valorComissaoTotalCentavos)}</strong></div>
                </div>
                <div className="bnf-previa-nota">Cobrança gerada em {fmtData(toMs(pagamento.fechamento.geradoEm))} · {periodoCobranca(pagamento.fechamento)}</div>
              </div>

              <div className="field-group">
                <label>Como o parceiro pagou?</label>
                <div className="bnf-chips">
                  {FORMAS_PAGAMENTO.map(fm => (
                    <button key={fm} className={`chip ${pagamento.forma === fm ? 'chip-active' : ''}`}
                      onClick={() => setPagamento(p => ({ ...p, forma: fm }))}>{fm}</button>
                  ))}
                </div>
                {pagamento.forma === 'Outro' && (
                  <input style={{ marginTop: 8 }} type="text" value={pagamento.formaOutro} placeholder="Qual? Ex.: boleto, permuta..."
                    onChange={e => setPagamento(p => ({ ...p, formaOutro: e.target.value }))} />
                )}
              </div>
              <div className="field-group">
                <label>Referência ou comprovante</label>
                <input type="text" value={pagamento.referencia} placeholder="Ex.: ID da transação Pix, número do comprovante"
                  onChange={e => setPagamento(p => ({ ...p, referencia: e.target.value }))} />
                <span className="field-hint">Opcional, mas ajuda a encontrar o pagamento depois.</span>
              </div>
              <div className="field-group">
                <label>Observação</label>
                <textarea rows={2} value={pagamento.observacao} placeholder="Opcional"
                  onChange={e => setPagamento(p => ({ ...p, observacao: e.target.value }))} />
              </div>
              <p className="bnf-explica">
                Ao confirmar, a cobrança e todos os atendimentos dela passam para <strong>Recebido</strong>. Faça isso só depois
                de conferir que o dinheiro entrou.
              </p>
              {pagamento.erro && <div className="bnf-erro bnf-erro-inline"><IconAlert size={16} /><div>{pagamento.erro}</div></div>}
              <div className="modal-footer">
                <button className="btn-ghost" onClick={() => setPagamento(null)} disabled={processando}>Cancelar</button>
                <button className="btn-primary" onClick={confirmarPagamento} disabled={processando || (pagamento.forma === 'Outro' && !pagamento.formaOutro.trim())}>
                  {processando ? 'Registrando...' : 'Confirmar recebimento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Modal: detalhe da cobrança ---------------- */}
      {detalheCobrancaId && (
        <div className="modal-overlay" onClick={() => setDetalheCobrancaId(null)}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Cobrança — {detalheCobranca ? (nomesParceria.get(detalheCobranca.parceriaId) || 'Parceria removida') : 'carregando'}</h2>
              <button className="modal-close" onClick={() => setDetalheCobrancaId(null)}><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              {!detalheCobranca ? (
                <Carregando texto="Carregando a cobrança..." />
              ) : (() => {
                const paga = detalheCobranca.status === 'PAGO';
                const itens = [...(resgatesPorFechamento.get(detalheCobranca.id) || [])]
                  .sort((a, b) => (dataResgate(a) ?? 0) - (dataResgate(b) ?? 0));
                return (
                  <>
                    <div className="bnf-previa" style={varsStatus(paga ? 'LIQUIDADO' : 'AGUARDANDO_PAGAMENTO')}>
                      <div className="bnf-previa-titulo">
                        <span className="bnf-status" style={varsStatus(paga ? 'LIQUIDADO' : 'AGUARDANDO_PAGAMENTO')}>
                          <span className="bnf-status-dot" />{paga ? 'Recebida' : 'Aguardando pagamento'}
                        </span>
                      </div>
                      <div className="bnf-previa-grid">
                        <div><span>Atendimentos</span><strong>{Number(detalheCobranca.totalResgates) || 0}</strong></div>
                        <div><span>Valor dos serviços</span><strong>{moeda(detalheCobranca.valorOriginalTotalCentavos)}</strong></div>
                        <div><span>Desconto total</span><strong>{moeda(detalheCobranca.valorDescontoTotalCentavos)}</strong></div>
                        <div className="bnf-previa-principal"><span>Comissão</span><strong>{moeda(detalheCobranca.valorComissaoTotalCentavos)}</strong></div>
                      </div>
                      <div className="bnf-previa-nota">
                        Período: {periodoCobranca(detalheCobranca)} · Gerada em {fmtDataHora(toMs(detalheCobranca.geradoEm))}
                      </div>
                      {paga && (
                        <div className="bnf-previa-nota">
                          Paga em {fmtDataHora(toMs(detalheCobranca.pagoEm))}
                          {detalheCobranca.metodoPagamento ? ` via ${detalheCobranca.metodoPagamento}` : ''}
                          {detalheCobranca.referenciaPagamento ? ` · Comprovante: ${detalheCobranca.referenciaPagamento}` : ''}
                          {detalheCobranca.observacaoPagamento ? ` · ${detalheCobranca.observacaoPagamento}` : ''}
                        </div>
                      )}
                    </div>

                    {itens.length === 0 ? (
                      <div className="bnf-vazio">Não encontramos os atendimentos desta cobrança. Eles podem ter sido removidos ou ainda estar carregando.</div>
                    ) : (
                      <div className="bnf-tabela-wrap">
                        <table className="data-table">
                          <thead><tr><th>Data</th><th>Cupom</th><th className="bnf-num">Serviço</th><th className="bnf-num">Cliente pagou</th><th className="bnf-num">Comissão</th><th>Situação</th></tr></thead>
                          <tbody>
                            {itens.map(r => (
                              <tr key={r.id}>
                                <td className="bnf-nowrap">{fmtDataHora(dataResgate(r))}</td>
                                <td className="bnf-codigo">{r.codigoPublico}</td>
                                <td className="bnf-num">{moeda(r.valorOriginalCentavos)}</td>
                                <td className="bnf-num">{moeda(r.valorFinalCentavos)}</td>
                                <td className="bnf-num bnf-comissao">{moeda(r.valorComissaoCentavos)}</td>
                                <td><StatusBadge status={r.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="modal-footer">
                      {itens.length > 0 && (
                        <button className="btn-ghost" onClick={() => baixarCsv(
                          `cobranca-${(nomesParceria.get(detalheCobranca.parceriaId) || 'parceria').replace(/[^\w-]+/g, '-').toLowerCase()}-${fmtData(toMs(detalheCobranca.geradoEm)).replace(/\//g, '-')}.csv`,
                          linhasCsvResgates(itens, nomeParceria),
                        )}><IconDoc size={15} />Exportar CSV</button>
                      )}
                      {!paga && (
                        <button className="btn-primary" onClick={() => { const f = detalheCobranca; setDetalheCobrancaId(null); abrirPagamento(f); }}>
                          <IconCheck size={15} />Registrar pagamento recebido
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
