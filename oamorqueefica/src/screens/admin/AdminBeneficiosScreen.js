import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Platform,
  KeyboardAvoidingView, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { colors, fonts, spacing, radius } from '../../theme';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';

// ============================================================================
// Cupons e Comissões — acompanhamento financeiro das parcerias do tipo
// "cupom com comissão" (mesma lógica do painel web, admin-web/src/Beneficios.jsx).
//
// A tela só LÊ vouchers, resgates, fechamentos e parcerias. Fechar período e
// registrar pagamento passam pelas Cloud Functions — nunca gravamos direto.
//
// Os listeners escutam a coleção inteira, SEM orderBy (orderBy exclui
// documentos sem o campo), e a ordenação é feita aqui. Erros de leitura
// aparecem na tela. Todo dinheiro é somado em CENTAVOS inteiros.
// ============================================================================

const JANELA_CONTESTACAO_MS = 24 * 3600000;
const SIDEBAR_W = 230;

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
  const abs = Math.abs(c);
  const manual = () => {
    const reais = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${c < 0 ? '-' : ''}R$ ${reais},${String(abs % 100).padStart(2, '0')}`;
  };
  if (!FORMATO_BRL) return manual();
  const txt = FORMATO_BRL.format(c / 100);
  // Alguns motores sem dados de localidade devolvem "R$1,234.56": nesse caso, formata à mão.
  return /\d\.\d{2}$/.test(txt) ? manual() : txt;
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

const dataResgate = (r) => toMs(r.criadoEm) ?? toMs(r.concluidoEm);

// ---- Períodos --------------------------------------------------------------

const PERIODOS = [
  { id: 'mes', label: 'Este mês' },
  { id: 'mesAnterior', label: 'Mês passado' },
  { id: '90d', label: 'Últimos 90 dias' },
  { id: 'tudo', label: 'Todo o histórico' },
];

function intervaloDe(id) {
  const agora = new Date();
  const a = agora.getFullYear();
  const m = agora.getMonth();
  if (id === 'mes') return { inicio: new Date(a, m, 1).getTime(), fim: new Date(a, m + 1, 1).getTime() - 1 };
  if (id === 'mesAnterior') return { inicio: new Date(a, m - 1, 1).getTime(), fim: new Date(a, m, 1).getTime() - 1 };
  if (id === '90d') {
    return {
      inicio: new Date(a, m, agora.getDate() - 89).getTime(),
      fim: new Date(a, m, agora.getDate(), 23, 59, 59, 999).getTime(),
    };
  }
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
    rotulo: 'Aguardando a cliente confirmar', icone: 'hourglass-outline',
    ajuda: 'O parceiro registrou o atendimento. Falta a cliente confirmar no app que ele aconteceu.',
    cor: colors.gold, fg: colors.goldFg, bg: 'rgba(212,180,131,0.18)',
  },
  CONFIRMADO_USUARIO: {
    rotulo: 'Em prazo de contestação', icone: 'time-outline',
    ajuda: 'A cliente confirmou. Esperamos 24 horas por segurança; depois fica pronto para cobrar sozinho.',
    cor: '#8FA5C6', fg: '#46597A', bg: 'rgba(185,200,223,0.34)',
  },
  ELEGIVEL_LIQUIDACAO: {
    rotulo: 'Pronto para cobrar', icone: 'checkmark-done-outline',
    ajuda: 'Tudo certo com este atendimento. Ele entra na próxima cobrança que você gerar para o parceiro.',
    cor: colors.lav4, fg: colors.lav6, bg: colors.lav1,
  },
  AGUARDANDO_PAGAMENTO: {
    rotulo: 'Cobrado, aguardando pagamento', icone: 'document-text-outline',
    ajuda: 'Já faz parte de uma cobrança enviada ao parceiro. Quando ele pagar, registre o recebimento.',
    cor: '#D39A7C', fg: '#8A523A', bg: 'rgba(242,201,184,0.42)',
  },
  LIQUIDADO: {
    rotulo: 'Recebido', icone: 'wallet-outline',
    ajuda: 'O parceiro já pagou esta comissão. Nada mais a fazer.',
    cor: colors.sage, fg: colors.sageFg, bg: 'rgba(122,158,126,0.16)',
  },
  CONTESTADO: {
    rotulo: 'Contestado', icone: 'alert-circle-outline',
    ajuda: 'A cliente informou que o atendimento não aconteceu; esse valor não será cobrado.',
    cor: '#B4635A', fg: '#94463E', bg: 'rgba(180,99,90,0.11)',
  },
};
const ORDEM_STATUS = ['CONCLUIDO', 'CONFIRMADO_USUARIO', 'ELEGIVEL_LIQUIDACAO', 'AGUARDANDO_PAGAMENTO', 'LIQUIDADO', 'CONTESTADO'];

const infoStatus = (s) => STATUS[s] || {
  rotulo: s ? `Situação: ${s}` : 'Sem situação', icone: 'help-circle-outline',
  ajuda: 'Situação não reconhecida por esta tela.', cor: colors.tl, fg: colors.tm, bg: colors.bg,
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

const VOUCHER_USADO = ['CONCLUIDO', 'CONFIRMADO_USUARIO', 'CONTESTADO'];
const voucherFoiUsado = (v) => !!v.resgateId || VOUCHER_USADO.includes(v.status);

const FORMAS_PAGAMENTO = ['Pix', 'Transferência', 'Dinheiro', 'Outro'];

const PASSOS = [
  { quem: 'Cliente', titulo: 'Gera o cupom', texto: 'No app, a cliente escolhe a parceria e gera um código (ex.: TRV-AB12CD). Isso ainda não é venda nem comissão.' },
  { quem: 'Parceiro', titulo: 'Registra o atendimento', texto: 'Na hora do serviço, o parceiro valida o código e informa o valor. O sistema calcula o desconto e a comissão.', status: 'CONCLUIDO' },
  { quem: 'Cliente', titulo: 'Confirma no app', texto: 'A cliente recebe um aviso e confirma que o atendimento aconteceu. Se disser que não, vira "Contestado" e não é cobrado.' },
  { quem: 'Automático', titulo: '24 horas para contestar', texto: 'Um prazo de segurança, caso a cliente mude de ideia. Você não precisa fazer nada.', status: 'CONFIRMADO_USUARIO' },
  { quem: 'Automático', titulo: 'Pronto para cobrar', texto: 'Passado o prazo, o sistema libera o valor sozinho. Ele aparece em "Pronto para cobrar".', status: 'ELEGIVEL_LIQUIDACAO' },
  { quem: 'Você', titulo: 'Fecha o período e cobra', texto: 'Você junta tudo o que está pronto em uma cobrança e envia ao parceiro o valor da comissão.', status: 'AGUARDANDO_PAGAMENTO' },
  { quem: 'Você', titulo: 'Registra o recebimento', texto: 'Quando o parceiro pagar, registre aqui como e quando recebeu. Pronto: comissão recebida.', status: 'LIQUIDADO' },
];

const ROTULO_COLECAO = {
  parcerias: 'as parcerias', resgates: 'as utilizações de cupom', vouchers: 'os cupons gerados', fechamentos: 'as cobranças',
};

// ---- Pequenos componentes ----------------------------------------------------

function StatusPill({ status, compacto }) {
  const i = infoStatus(status);
  return (
    <View style={[s.pill, { backgroundColor: i.bg }]}>
      <View style={[s.pillDot, { backgroundColor: i.cor }]} />
      <Text style={[s.pillTxt, { color: i.fg }, compacto && { fontSize: 10 }]} numberOfLines={2}>{i.rotulo}</Text>
    </View>
  );
}

function Chip({ label, ativo, onPress }) {
  return (
    <TouchableOpacity style={[s.chip, ativo && s.chipSel]} onPress={onPress} activeOpacity={0.8}
      accessibilityRole="button" accessibilityState={{ selected: ativo }}>
      <Text style={[s.chipTxt, ativo && s.chipTxtSel]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Secao({ titulo, sub, direita }) {
  return (
    <View style={s.secaoTopo}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.secaoTitulo}>{titulo}</Text>
        {!!sub && <Text style={s.secaoSub}>{sub}</Text>}
      </View>
      {direita}
    </View>
  );
}

function Vazio({ icone = 'information-circle-outline', texto }) {
  return (
    <View style={s.vazio}>
      <Ionicons name={icone} size={22} color={colors.lav3} />
      <Text style={s.vazioTxt}>{texto}</Text>
    </View>
  );
}

function Botao({ titulo, icone, onPress, variante = 'primario', disabled, carregando, style }) {
  const prim = variante === 'primario';
  return (
    <TouchableOpacity
      style={[prim ? s.btnPrim : s.btnGhost, (disabled || carregando) && { opacity: 0.5 }, style]}
      onPress={onPress} disabled={disabled || carregando} activeOpacity={0.85} accessibilityRole="button"
    >
      {carregando
        ? <ActivityIndicator size="small" color={prim ? '#fff' : colors.lav5} />
        : icone ? <Ionicons name={icone} size={15} color={prim ? '#fff' : colors.lav5} /> : null}
      <Text style={prim ? s.btnPrimTxt : s.btnGhostTxt}>{titulo}</Text>
    </TouchableOpacity>
  );
}

function ModalBase({ visivel, onFechar, titulo, children, largo, bloqueado }) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={() => !bloqueado && onFechar()}>
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.modalCard, largo && { maxWidth: 620 }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo} numberOfLines={2}>{titulo}</Text>
            <TouchableOpacity onPress={onFechar} disabled={bloqueado} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Fechar">
              <Ionicons name="close" size={22} color={colors.tm} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CaixaValores({ status, titulo, itens, nota }) {
  const i = infoStatus(status);
  return (
    <View style={[s.caixa, { backgroundColor: i.bg, borderColor: i.cor }]}>
      {!!titulo && <Text style={[s.caixaTitulo, { color: i.fg }]}>{titulo}</Text>}
      <View style={s.caixaGrid}>
        {itens.map(it => (
          <View key={it.rotulo} style={s.caixaItem}>
            <Text style={[s.caixaRotulo, { color: i.fg }]}>{it.rotulo}</Text>
            <Text style={[s.caixaValor, it.destaque && { color: i.fg, fontSize: 19, fontFamily: fonts.serif }]}>{it.valor}</Text>
          </View>
        ))}
      </View>
      {!!nota && <Text style={[s.caixaNota, { color: i.fg }]}>{nota}</Text>}
    </View>
  );
}

// ============================================================================

export default function AdminBeneficiosScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const temSidebar = Platform.OS === 'web' || width >= 700;
  const larguraConteudo = Math.max(280, width - (temSidebar ? SIDEBAR_W : 0) - spacing.lg * 2);
  const colsKpi = larguraConteudo >= 880 ? 3 : larguraConteudo >= 330 ? 2 : 1;
  const colsResumo = larguraConteudo >= 760 ? 4 : 2;
  const colsParc = larguraConteudo >= 760 ? 2 : 1;
  const largura = (cols, gap) => (cols === 1 ? '100%' : Math.floor((larguraConteudo - gap * (cols - 1)) / cols));

  const [parcerias, setParcerias] = useState([]);
  const [resgates, setResgates] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [fechamentos, setFechamentos] = useState([]);
  const [carregado, setCarregado] = useState({ parcerias: false, resgates: false, vouchers: false, fechamentos: false });
  const [erros, setErros] = useState({});

  const [filtroParceria, setFiltroParceria] = useState(route?.params?.parceriaId || 'todas');
  const [periodo, setPeriodo] = useState(route?.params?.parceriaId ? 'tudo' : 'mes');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(30);

  const [comoAberto, setComoAberto] = useState(null);
  const [abaCobranca, setAbaCobranca] = useState('abertas');
  const [fechar, setFechar] = useState(null);
  const [pagamento, setPagamento] = useState(null);
  const [detalheCobrancaId, setDetalheCobrancaId] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [agora, setAgora] = useState(Date.now());

  const scrollRef = useRef(null);
  const posUtilizacoes = useRef(0);
  const avisoTimer = useRef(null);

  useEffect(() => {
    if (route?.params?.parceriaId) setFiltroParceria(route.params.parceriaId);
  }, [route?.params?.parceriaId]);

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 60000);
    return () => { clearInterval(id); if (avisoTimer.current) clearTimeout(avisoTimer.current); };
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
        console.error(`[AdminBeneficios] erro ao ler ${nome}:`, erro);
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

  const mostrarAviso = (texto, tipo = 'ok') => {
    setAviso({ texto, tipo });
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAviso(null), 6000);
  };

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

  const iv = useMemo(() => intervaloDe(periodo), [periodo]);
  const daParceria = (x) => filtroParceria === 'todas' || x.parceriaId === filtroParceria;

  const resgatesPeriodo = useMemo(
    () => resgates.filter(r => daParceria(r) && dentroDo(dataResgate(r), iv)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resgates, filtroParceria, iv],
  );

  const indicadores = useMemo(() => {
    const porStatus = {};
    ORDEM_STATUS.forEach(st => { porStatus[st] = { qtd: 0, comissao: 0 }; });
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
      const sd = saldoPorId.get(r.parceriaId);
      const c = centavosInteiros(r.valorComissaoCentavos);
      if (r.status === 'ELEGIVEL_LIQUIDACAO') { sd.pronto += c; sd.prontoQtd += 1; }
      if (r.status === 'AGUARDANDO_PAGAMENTO') sd.aguardando += c;
      if (r.status === 'CONCLUIDO' || r.status === 'CONFIRMADO_USUARIO') sd.emConfirmacao += c;
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
    return resgatesPeriodo
      .filter(r => {
        if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false;
        if (!termo) return true;
        return (r.codigoPublico || '').toLowerCase().includes(termo)
          || (nomesParceria.get(r.parceriaId) || r.parceriaNome || '').toLowerCase().includes(termo);
      })
      .sort((a, b) => (dataResgate(b) ?? 0) - (dataResgate(a) ?? 0));
  }, [resgatesPeriodo, filtroStatus, busca, nomesParceria]);

  useEffect(() => { setLimite(30); }, [filtroParceria, periodo, filtroStatus, busca]);

  const semNenhumDado = !carregando && resgates.length === 0 && fechamentos.length === 0;
  const comoEstaAberto = comoAberto ?? semNenhumDado;
  const filtrosAtivos = filtroParceria !== 'todas' || periodo !== 'mes' || filtroStatus !== 'todos' || busca.trim() !== '';

  // ---- Ações ----------------------------------------------------------------

  const verUtilizacoes = (parceriaId, status) => {
    if (parceriaId) setFiltroParceria(parceriaId);
    if (status) setFiltroStatus(status);
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, posUtilizacoes.current - 8), animated: true }), 80);
  };

  const abrirFechar = (p) => setFechar({ parceria: p, modo: 'tudo', resultado: null, erro: null });
  const intervaloFechar = fechar && fechar.modo !== 'tudo' ? intervaloDe(fechar.modo) : { inicio: null, fim: null };

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
      setFechar(f => ({
        ...f,
        resultado: {
          fechamentoId: data?.fechamentoId,
          totalResgates: Number(data?.totalResgates) || 0,
          comissaoCentavos: Math.round(Number(data?.comissao || 0) * 100),
        },
      }));
    } catch (e) {
      console.error('[AdminBeneficios] fecharPeriodoParceria:', e);
      setFechar(f => ({ ...f, erro: e?.message || 'Não foi possível fechar o período.' }));
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
      mostrarAviso('Pagamento registrado. A comissão agora aparece como recebida.');
    } catch (e) {
      console.error('[AdminBeneficios] registrarPagamentoFechamento:', e);
      setPagamento(p => (p ? { ...p, erro: e?.message || 'Não foi possível registrar o pagamento.' } : p));
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

  const listaErros = Object.entries(erros).filter(([, v]) => v);

  // ---- Render ---------------------------------------------------------------

  const renderConteudo = () => {
    if (carregando) {
      return (
        <View style={s.carregando}>
          <ActivityIndicator size="large" color={colors.lav4} />
          <Text style={s.carregandoTxt}>Carregando cupons e comissões...</Text>
        </View>
      );
    }

    if (parceriasCupom.length === 0) {
      return (
        <View style={[s.vazio, { paddingVertical: spacing.xl }]}>
          <Ionicons name="pricetag-outline" size={30} color={colors.lav3} />
          <Text style={[s.vazioTxt, { fontFamily: fonts.bodyBold, color: colors.td }]}>Nenhuma parceria com cupom ainda.</Text>
          <Text style={s.vazioTxt}>
            Em Parcerias, edite uma parceria e escolha o tipo "Cupom com comissão", definindo o desconto total e a sua
            comissão. Ela aparecerá aqui automaticamente. Parcerias do tipo "Link simples" não geram comissão.
          </Text>
          <Botao titulo="Ir para Parcerias" icone="arrow-forward" variante="ghost"
            onPress={() => navigation?.navigate?.('AdminParcerias')} style={{ marginTop: spacing.sm }} />
        </View>
      );
    }

    return (
      <>
        {/* ---------------- Filtros ---------------- */}
        <View style={s.filtros}>
          <Text style={s.filtroRotulo}>PARCERIA</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsLinha}>
            <Chip label="Todas" ativo={filtroParceria === 'todas'} onPress={() => setFiltroParceria('todas')} />
            {parceriasCupom.map(p => (
              <Chip key={p.id} label={`${p.titulo || 'Sem nome'}${p.ativo === false ? ' (inativa)' : ''}`}
                ativo={filtroParceria === p.id} onPress={() => setFiltroParceria(p.id)} />
            ))}
          </ScrollView>

          <Text style={s.filtroRotulo}>PERÍODO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsLinha}>
            {PERIODOS.map(p => <Chip key={p.id} label={p.label} ativo={periodo === p.id} onPress={() => setPeriodo(p.id)} />)}
          </ScrollView>

          <Text style={s.filtroRotulo}>SITUAÇÃO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsLinha}>
            <Chip label="Todas" ativo={filtroStatus === 'todos'} onPress={() => setFiltroStatus('todos')} />
            {ORDEM_STATUS.map(st => (
              <Chip key={st} label={STATUS[st].rotulo} ativo={filtroStatus === st} onPress={() => setFiltroStatus(st)} />
            ))}
          </ScrollView>

          <View style={s.filtroRodape}>
            <Text style={s.filtroResumo} numberOfLines={2}>
              Mostrando {descreverIntervalo(iv)}{filtroParceria !== 'todas' ? ` · ${nomesParceria.get(filtroParceria) || ''}` : ''}
            </Text>
            {filtrosAtivos && (
              <TouchableOpacity onPress={() => { setFiltroParceria('todas'); setPeriodo('mes'); setFiltroStatus('todos'); setBusca(''); }}>
                <Text style={s.link}>Limpar filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ---------------- Indicadores ---------------- */}
        <Secao titulo="Onde está o dinheiro das comissões"
          sub="Cada cartão é uma etapa da jornada, com a comissão da Atravessia no período. Toque para ver só aquelas utilizações." />
        <View style={s.grid}>
          {ORDEM_STATUS.map(st => {
            const info = STATUS[st];
            const dado = indicadores.porStatus[st];
            const ativo = filtroStatus === st;
            return (
              <TouchableOpacity key={st} activeOpacity={0.85}
                style={[s.kpi, { width: largura(colsKpi, 10), borderLeftColor: info.cor }, ativo && { backgroundColor: info.bg, borderColor: info.cor }]}
                onPress={() => verUtilizacoes(null, ativo ? 'todos' : st)}
                accessibilityRole="button" accessibilityState={{ selected: ativo }}>
                <View style={s.kpiTopo}>
                  <Ionicons name={info.icone} size={15} color={info.fg} />
                  <Text style={[s.kpiTitulo, { color: info.fg }]} numberOfLines={2}>{info.rotulo}</Text>
                </View>
                <Text style={[s.kpiValor, st === 'CONTESTADO' && s.riscado]} numberOfLines={1} adjustsFontSizeToFit>
                  {moeda(dado.comissao)}
                </Text>
                <Text style={s.kpiQtd}>
                  {plural(dado.qtd, 'atendimento', 'atendimentos')}{st === 'CONTESTADO' && dado.qtd > 0 ? ' · não cobrado' : ''}
                </Text>
                <Text style={s.kpiAjuda}>{info.ajuda}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[s.grid, s.resumo]}>
          {[
            { icone: 'trending-up-outline', cor: colors.lav5, bg: colors.lav1, valor: moeda(indicadores.movimentado), rotulo: 'Movimentado nas parceiras', ajuda: `Valor dos serviços em ${plural(indicadores.atendimentos, 'atendimento', 'atendimentos')} (sem contestados).` },
            { icone: 'heart-outline', cor: colors.sageFg, bg: 'rgba(122,158,126,0.16)', valor: moeda(indicadores.descontoClientes), rotulo: 'Economia das clientes', ajuda: 'Quanto as clientes deixaram de pagar graças aos cupons.' },
            { icone: 'cash-outline', cor: colors.goldFg, bg: 'rgba(212,180,131,0.2)', valor: moeda(indicadores.comissaoTotal), rotulo: 'Comissão total gerada', ajuda: 'A receber ou já recebida no período (sem contestados).' },
          ].map(it => (
            <View key={it.rotulo} style={[s.resumoItem, { width: largura(colsResumo, 10) }]}>
              <View style={[s.resumoIcone, { backgroundColor: it.bg }]}><Ionicons name={it.icone} size={16} color={it.cor} /></View>
              <Text style={s.resumoValor} numberOfLines={1} adjustsFontSizeToFit>{it.valor}</Text>
              <Text style={s.resumoRotulo}>{it.rotulo}</Text>
              <Text style={s.resumoAjuda}>{it.ajuda}</Text>
            </View>
          ))}
          <View style={[s.resumoItem, { width: largura(colsResumo, 10) }]}>
            <View style={[s.resumoIcone, { backgroundColor: colors.lav1 }]}><Ionicons name="ticket-outline" size={16} color={colors.lav5} /></View>
            {erros.vouchers ? (
              <Text style={s.resumoAjuda}>Não foi possível ler os cupons gerados.</Text>
            ) : !carregado.vouchers ? (
              <Text style={s.resumoAjuda}>Carregando cupons gerados...</Text>
            ) : (
              <>
                <Text style={s.resumoValor}>{usoCupons.usados}<Text style={s.resumoDe}> de {usoCupons.gerados}</Text></Text>
                <Text style={s.resumoRotulo}>Cupons usados x gerados</Text>
                <View style={s.barra}><View style={[s.barraFill, { width: `${usoCupons.taxa}%` }]} /></View>
                <Text style={s.resumoAjuda}>
                  {usoCupons.gerados === 0
                    ? 'Nenhum cupom gerado neste período.'
                    : `${usoCupons.taxa}% viraram atendimento${usoCupons.expirados ? ` · ${usoCupons.expirados} expiraram sem uso` : ''}.`}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* ---------------- Por parceria ---------------- */}
        <Secao titulo="Por parceria"
          sub={'Usos, movimentado e comissão seguem o período escolhido. "Pronto para cobrar" e "Aguardando pagamento" mostram o saldo de hoje, de qualquer data.'} />
        <View style={s.grid}>
          {porParceria.map(x => {
            const pct = (v) => Number(v) || 0;
            const descCliente = x.p.percentualDescontoCliente != null
              ? pct(x.p.percentualDescontoCliente)
              : Math.max(0, pct(x.p.percentualBeneficio) - pct(x.p.percentualComissao));
            return (
              <View key={x.p.id} style={[s.parc, { width: largura(colsParc, 10) }, x.pronto > 0 && s.parcDestaque]}>
                <View style={s.parcTopo}>
                  <View style={s.parcIcone}><Ionicons name="pricetag-outline" size={17} color={colors.lav5} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.parcNome}>{x.p.titulo || 'Parceria sem nome'}</Text>
                    <Text style={s.parcRegra}>
                      Desconto de {pct(x.p.percentualBeneficio)}%: {descCliente}% para a cliente e {pct(x.p.percentualComissao)}% de comissão
                      {x.p.baseCalculoComissao === 'valor_final' ? ' (sobre o valor com desconto)' : ' (sobre o valor cheio)'}
                    </Text>
                  </View>
                  {x.p.ativo === false && <View style={s.tagInativa}><Text style={s.tagInativaTxt}>Inativa</Text></View>}
                </View>

                <View style={s.parcMetricas}>
                  <View style={s.parcMetrica}>
                    <Text style={s.parcMetricaRot}>Usos no período</Text>
                    <Text style={s.parcMetricaVal}>{x.usos}</Text>
                    {x.contestados > 0 && <Text style={s.txtContestado}>+{x.contestados} contestado{x.contestados > 1 ? 's' : ''}</Text>}
                  </View>
                  <View style={s.parcMetrica}>
                    <Text style={s.parcMetricaRot}>Movimentado</Text>
                    <Text style={s.parcMetricaVal}>{moeda(x.movimentado)}</Text>
                  </View>
                  <View style={s.parcMetrica}>
                    <Text style={s.parcMetricaRot}>Comissão no período</Text>
                    <Text style={s.parcMetricaVal}>{moeda(x.comissao)}</Text>
                  </View>
                  <View style={s.parcMetrica}>
                    <Text style={s.parcMetricaRot}>Cupons usados</Text>
                    <Text style={s.parcMetricaVal}>{x.cupons.usados} de {x.cupons.gerados}</Text>
                  </View>
                </View>

                <View style={s.parcSaldos}>
                  <View style={[s.parcSaldo, { backgroundColor: STATUS.ELEGIVEL_LIQUIDACAO.bg }]}>
                    <Text style={[s.parcSaldoRot, { color: STATUS.ELEGIVEL_LIQUIDACAO.fg }]}>Pronto para cobrar</Text>
                    <Text style={[s.parcSaldoVal, { color: STATUS.ELEGIVEL_LIQUIDACAO.fg }]} numberOfLines={1} adjustsFontSizeToFit>{moeda(x.pronto)}</Text>
                    {x.prontoQtd > 0 && <Text style={[s.parcSaldoSub, { color: STATUS.ELEGIVEL_LIQUIDACAO.fg }]}>{plural(x.prontoQtd, 'atendimento', 'atendimentos')}</Text>}
                  </View>
                  <View style={[s.parcSaldo, { backgroundColor: STATUS.AGUARDANDO_PAGAMENTO.bg }]}>
                    <Text style={[s.parcSaldoRot, { color: STATUS.AGUARDANDO_PAGAMENTO.fg }]}>Aguardando pagamento</Text>
                    <Text style={[s.parcSaldoVal, { color: STATUS.AGUARDANDO_PAGAMENTO.fg }]} numberOfLines={1} adjustsFontSizeToFit>{moeda(x.aguardando)}</Text>
                  </View>
                </View>
                {x.emConfirmacao > 0 && (
                  <Text style={s.parcNota}>Mais {moeda(x.emConfirmacao)} ainda em confirmação pela cliente ou no prazo de 24h.</Text>
                )}

                <View style={s.parcAcoes}>
                  {x.pronto > 0 ? (
                    <Botao titulo="Fechar período e cobrar" icone="document-text-outline" onPress={() => abrirFechar(x.p)} style={{ flexGrow: 1 }} />
                  ) : (
                    <Text style={s.parcNada}>Nada pronto para cobrar agora.</Text>
                  )}
                  <Botao titulo="Ver utilizações" icone="eye-outline" variante="ghost" onPress={() => verUtilizacoes(x.p.id)} style={{ flexGrow: 1 }} />
                </View>
              </View>
            );
          })}
        </View>

        {/* ---------------- Cobranças ---------------- */}
        <Secao titulo="Cobranças aos parceiros"
          sub="Cada cobrança nasce quando você fecha um período. Envie o valor ao parceiro e, ao receber, registre o pagamento. Toque em uma cobrança para ver os atendimentos." />
        <View style={s.segmento}>
          {[['abertas', `Em aberto (${cobrancas.abertas.length})`], ['pagas', `Pagas (${cobrancas.pagas.length})`]].map(([id, rot]) => (
            <TouchableOpacity key={id} style={[s.segmentoBtn, abaCobranca === id && s.segmentoBtnAtivo]} onPress={() => setAbaCobranca(id)}
              accessibilityRole="tab" accessibilityState={{ selected: abaCobranca === id }}>
              <Text style={[s.segmentoTxt, abaCobranca === id && s.segmentoTxtAtivo]}>{rot}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {abaCobranca === 'abertas' && cobrancas.abertas.length > 0 && (
          <View style={[s.faixa, { backgroundColor: STATUS.AGUARDANDO_PAGAMENTO.bg }]}>
            <Text style={[s.faixaTxt, { color: STATUS.AGUARDANDO_PAGAMENTO.fg }]}>
              Total a receber em cobranças abertas: <Text style={{ fontFamily: fonts.bodyBold }}>{moeda(totalAbertas)}</Text>
            </Text>
          </View>
        )}
        {(abaCobranca === 'abertas' ? cobrancas.abertas : cobrancas.pagas).length === 0 ? (
          <Vazio icone="document-text-outline" texto={abaCobranca === 'abertas'
            ? 'Nenhuma cobrança em aberto. Quando uma parceria tiver valor "Pronto para cobrar", use "Fechar período e cobrar" no cartão dela.'
            : 'Nenhuma cobrança paga ainda. Quando você registrar um pagamento recebido, ele fica guardado aqui como histórico.'} />
        ) : (
          <View style={s.grid}>
            {(abaCobranca === 'abertas' ? cobrancas.abertas : cobrancas.pagas).map(f => {
              const paga = f.status === 'PAGO';
              const info = paga ? STATUS.LIQUIDADO : STATUS.AGUARDANDO_PAGAMENTO;
              return (
                <TouchableOpacity key={f.id} activeOpacity={0.85} onPress={() => setDetalheCobrancaId(f.id)}
                  style={[s.cob, { width: largura(colsParc, 10), borderLeftColor: info.cor }]}>
                  <View style={s.cobTopo}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.cobParceria}>{nomesParceria.get(f.parceriaId) || 'Parceria removida'}</Text>
                      <Text style={s.cobMeta}>{plural(Number(f.totalResgates) || 0, 'atendimento', 'atendimentos')} · {periodoCobranca(f)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={s.cobValor}>{moeda(f.valorComissaoTotalCentavos)}</Text>
                      <View style={[s.pill, { backgroundColor: info.bg }]}>
                        <View style={[s.pillDot, { backgroundColor: info.cor }]} />
                        <Text style={[s.pillTxt, { color: info.fg }]}>{paga ? 'Recebida' : 'Aguardando'}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={s.cobMeta}>Gerada em {fmtDataHora(toMs(f.geradoEm))}</Text>
                  {paga && (
                    <Text style={s.cobMeta}>
                      Paga em {fmtDataHora(toMs(f.pagoEm))}{f.metodoPagamento ? ` via ${f.metodoPagamento}` : ''}
                      {f.referenciaPagamento ? ` · Comprovante: ${f.referenciaPagamento}` : ''}
                    </Text>
                  )}
                  <View style={s.cobAcoes}>
                    <Text style={s.link}>Ver atendimentos</Text>
                    {!paga && (
                      <Botao titulo="Registrar pagamento recebido" icone="checkmark-circle-outline" onPress={() => abrirPagamento(f)} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ---------------- Utilizações ---------------- */}
        <View onLayout={e => { posUtilizacoes.current = e.nativeEvent.layout.y; }}>
          <Secao titulo="Utilizações de cupom" sub="Cada cartão é um atendimento registrado por um parceiro, do mais recente para o mais antigo." />
          <View style={s.busca}>
            <Ionicons name="search-outline" size={16} color={colors.tl} />
            <TextInput style={s.buscaInput} value={busca} onChangeText={setBusca} autoCapitalize="characters"
              placeholder="Buscar pelo código (ex.: TRV-AB12CD) ou parceria" placeholderTextColor={colors.tl} />
            {!!busca && (
              <TouchableOpacity onPress={() => setBusca('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color={colors.tl} />
              </TouchableOpacity>
            )}
          </View>

          {filtroStatus !== 'todos' && (
            <View style={[s.faixa, { backgroundColor: infoStatus(filtroStatus).bg }]}>
              <Text style={[s.faixaTxt, { color: infoStatus(filtroStatus).fg }]}>
                Mostrando só <Text style={{ fontFamily: fonts.bodyBold }}>{infoStatus(filtroStatus).rotulo}</Text>: {infoStatus(filtroStatus).ajuda}
              </Text>
              <TouchableOpacity onPress={() => setFiltroStatus('todos')}><Text style={s.link}>Ver todas</Text></TouchableOpacity>
            </View>
          )}

          <Text style={s.contagem}>
            {plural(listaUtilizacoes.length, 'utilização encontrada', 'utilizações encontradas')}
            {listaUtilizacoes.length > 0 ? ` · comissão somada: ${moeda(somar(listaUtilizacoes.filter(r => r.status !== 'CONTESTADO'), 'valorComissaoCentavos'))} (sem contestados)` : ''}
          </Text>

          {listaUtilizacoes.length === 0 ? (
            <Vazio icone="receipt-outline" texto={resgates.length === 0
              ? 'Ainda não houve nenhum atendimento com cupom. Quando uma cliente apresentar o cupom e o parceiro registrar o atendimento, ele aparece aqui na hora.'
              : 'Nenhuma utilização com esses filtros. Tente "Todo o histórico" no período ou limpe a busca.'} />
          ) : (
            <View style={s.grid}>
              {listaUtilizacoes.slice(0, limite).map(r => {
                const contestado = r.status === 'CONTESTADO';
                const info = infoStatus(r.status);
                return (
                  <View key={r.id} style={[s.uso, { width: largura(colsParc, 10), borderLeftColor: info.cor }, contestado && s.usoContestado]}>
                    <View style={s.usoTopo}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.usoCodigo}>{r.codigoPublico || '—'}</Text>
                        <Text style={s.usoMeta} numberOfLines={1}>{nomeParceria(r)} · {fmtDataHora(dataResgate(r))}</Text>
                      </View>
                      <StatusPill status={r.status} compacto />
                    </View>
                    <View style={s.usoValores}>
                      <View style={s.usoValor}><Text style={s.usoValorRot}>Valor do serviço</Text><Text style={s.usoValorNum}>{moeda(r.valorOriginalCentavos)}</Text></View>
                      <View style={s.usoValor}><Text style={s.usoValorRot}>Desconto da cliente</Text><Text style={[s.usoValorNum, { color: colors.sageFg }]}>-{moeda(r.valorDescontoClienteCentavos)}</Text></View>
                      <View style={s.usoValor}><Text style={s.usoValorRot}>Cliente pagou</Text><Text style={s.usoValorNum}>{moeda(r.valorFinalCentavos)}</Text></View>
                      <View style={s.usoValor}><Text style={s.usoValorRot}>Comissão</Text><Text style={[s.usoValorNum, s.comissao, contestado && s.riscado]}>{moeda(r.valorComissaoCentavos)}</Text></View>
                    </View>
                    {!!detalheStatus(r, agora) && (
                      <View style={s.usoDetalhe}>
                        <Ionicons name={contestado ? 'alert-circle-outline' : 'information-circle-outline'} size={14} color={contestado ? STATUS.CONTESTADO.fg : colors.tl} />
                        <Text style={[s.usoDetalheTxt, contestado && { color: STATUS.CONTESTADO.fg }]}>{detalheStatus(r, agora)}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          {listaUtilizacoes.length > limite && (
            <Botao titulo={`Mostrar mais (${listaUtilizacoes.length - limite} restantes)`} variante="ghost"
              onPress={() => setLimite(l => l + 30)} style={{ alignSelf: 'center', marginTop: spacing.sm }} />
          )}
        </View>
      </>
    );
  };

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminBeneficios">
      <AdminSubTabs grupo="parcerias" atual="AdminBeneficios" />
      <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.cabecalho}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <Text style={s.pageTitle}>Cupons e Comissões</Text>
            <Text style={s.pageSub}>
              Acompanhe cada uso de cupom, do atendimento no parceiro até a comissão cair na conta. Só conta como
              comissão o que a cliente confirmou — gerar um cupom não é receita.
            </Text>
          </View>
          <Botao titulo={comoEstaAberto ? 'Ocultar explicação' : 'Como funciona'} icone="help-circle-outline" variante="ghost"
            onPress={() => setComoAberto(!comoEstaAberto)} />
        </View>

        {!!aviso && (
          <View style={[s.aviso, aviso.tipo === 'erro' && s.avisoErro]}>
            <Ionicons name={aviso.tipo === 'erro' ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={18}
              color={aviso.tipo === 'erro' ? STATUS.CONTESTADO.fg : colors.sageFg} />
            <Text style={[s.avisoTxt, aviso.tipo === 'erro' && { color: STATUS.CONTESTADO.fg }]}>{aviso.texto}</Text>
          </View>
        )}

        {listaErros.length > 0 && (
          <View style={s.erro} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color={STATUS.CONTESTADO.fg} />
            <View style={{ flex: 1 }}>
              <Text style={[s.erroTxt, { fontFamily: fonts.bodyBold }]}>Não foi possível carregar tudo.</Text>
              {listaErros.map(([nome, cod]) => (
                <Text key={nome} style={s.erroTxt}>Falha ao ler {ROTULO_COLECAO[nome] || nome} ({cod}).</Text>
              ))}
              <Text style={[s.erroTxt, { marginTop: 4, fontSize: 11.5 }]}>
                Os números abaixo podem estar incompletos. Feche e abra a tela de novo; se continuar, confirme que entrou com
                uma conta de administradora e avise o suporte técnico com o código entre parênteses.
              </Text>
            </View>
          </View>
        )}

        {comoEstaAberto && (
          <View style={s.como}>
            <View style={s.comoTopo}>
              <View style={{ flex: 1 }}>
                <Text style={s.secaoTitulo}>Como funciona um cupom, do começo ao fim</Text>
                <Text style={s.secaoSub}>Cada etapa aparece nesta tela com o mesmo nome e a mesma cor. Você só age nas duas últimas.</Text>
              </View>
              <TouchableOpacity onPress={() => setComoAberto(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Fechar explicação">
                <Ionicons name="close" size={20} color={colors.tm} />
              </TouchableOpacity>
            </View>
            <View style={colsParc > 1 ? s.passosLargo : null}>
              {PASSOS.map((p, i) => {
                const voce = p.quem === 'Você';
                const ultimo = i === PASSOS.length - 1;
                return (
                  <View key={p.titulo} style={[s.passo, colsParc > 1 && { width: '50%', paddingRight: spacing.md }]}>
                    <View style={s.passoTrilho}>
                      <View style={[s.passoNum, voce && s.passoNumVoce]}>
                        <Text style={[s.passoNumTxt, voce && { color: '#fff' }]}>{i + 1}</Text>
                      </View>
                      {!ultimo && <View style={s.passoLinha} />}
                    </View>
                    <View style={s.passoCorpo}>
                      <Text style={[s.passoQuem, voce && { color: colors.lav5 }]}>{p.quem.toUpperCase()}</Text>
                      <Text style={s.passoTitulo}>{p.titulo}</Text>
                      <Text style={s.passoTexto}>{p.texto}</Text>
                      {!!p.status && <View style={{ marginTop: 6, alignSelf: 'flex-start' }}><StatusPill status={p.status} compacto /></View>}
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={[s.faixa, { backgroundColor: STATUS.CONTESTADO.bg, marginBottom: 0 }]}>
              <Text style={[s.faixaTxt, { color: STATUS.CONTESTADO.fg }]}>
                <Text style={{ fontFamily: fonts.bodyBold }}>E se a cliente contestar? </Text>
                Se ela disser no app que o atendimento não aconteceu, a utilização fica como "Contestado" e esse valor não é
                cobrado do parceiro. Vale conversar com o parceiro para entender o que houve.
              </Text>
            </View>
          </View>
        )}

        {renderConteudo()}
      </ScrollView>

      {/* ---------------- Modal: fechar período ---------------- */}
      <ModalBase visivel={!!fechar} onFechar={() => setFechar(null)} bloqueado={processando} largo
        titulo={fechar?.resultado ? 'Cobrança gerada' : `Fechar período — ${fechar?.parceria?.titulo || 'Parceria'}`}>
        {fechar && (fechar.resultado ? (
          <View style={{ alignItems: 'center' }}>
            <View style={s.resultadoIcone}><Ionicons name="checkmark" size={28} color={colors.sageFg} /></View>
            <Text style={s.resultadoValor}>{moeda(fechar.resultado.comissaoCentavos)}</Text>
            <Text style={s.explica}>
              {plural(fechar.resultado.totalResgates, 'atendimento foi incluído', 'atendimentos foram incluídos')} na cobrança de
              {' '}{fechar.parceria.titulo}. Eles agora aparecem como "Cobrado, aguardando pagamento".
            </Text>
            <View style={s.proximo}>
              <Text style={s.proximoTxt}>
                <Text style={{ fontFamily: fonts.bodyBold }}>Próximo passo: </Text>
                envie ao parceiro o valor de {moeda(fechar.resultado.comissaoCentavos)} (por Pix, transferência ou como vocês
                combinaram). Quando ele pagar, vá em "Cobranças aos parceiros", aba "Em aberto", e toque em "Registrar pagamento recebido".
              </Text>
            </View>
            <View style={s.modalAcoes}>
              {!!fechar.resultado.fechamentoId && (
                <Botao titulo="Ver a cobrança" variante="ghost" style={{ flex: 1 }}
                  onPress={() => { const id = fechar.resultado.fechamentoId; setFechar(null); setAbaCobranca('abertas'); setTimeout(() => setDetalheCobrancaId(id), 300); }} />
              )}
              <Botao titulo="Concluir" onPress={() => setFechar(null)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <>
            <Text style={s.explica}>
              Fechar o período junta os atendimentos "prontos para cobrar" desta parceria em uma única cobrança. Depois,
              você envia o valor ao parceiro e registra quando ele pagar. Nada é cobrado automaticamente — isso só organiza o que você vai cobrar.
            </Text>
            <Text style={s.campoRotulo}>Quais atendimentos entram?</Text>
            <View style={s.chipsWrap}>
              {[
                { id: 'tudo', label: 'Tudo o que está pronto' },
                { id: 'mesAnterior', label: 'Só do mês passado' },
                { id: 'mes', label: 'Só deste mês' },
              ].map(o => <Chip key={o.id} label={o.label} ativo={fechar.modo === o.id} onPress={() => setFechar(f => ({ ...f, modo: o.id }))} />)}
            </View>
            <Text style={s.dica}>Considera a data em que o parceiro registrou cada atendimento ({descreverIntervalo(intervaloFechar)}).</Text>

            <CaixaValores status="ELEGIVEL_LIQUIDACAO" titulo="PRÉVIA DA COBRANÇA"
              itens={[
                { rotulo: 'Atendimentos', valor: String(previaFechar.itens.length) },
                { rotulo: 'Valor dos serviços', valor: moeda(previaFechar.original) },
                { rotulo: 'Economia das clientes', valor: moeda(previaFechar.descontoCliente) },
                { rotulo: 'Comissão a cobrar', valor: moeda(previaFechar.comissao), destaque: true },
              ]}
              nota={previaFechar.foraDoPeriodo > 0
                ? `${plural(previaFechar.foraDoPeriodo, 'outro atendimento pronto fica', 'outros atendimentos prontos ficam')} fora deste período, para um próximo fechamento.`
                : null} />

            {previaFechar.itens.length === 0 ? (
              <Vazio texto='Nenhum atendimento pronto para cobrar nesse intervalo. Escolha "Tudo o que está pronto".' />
            ) : (
              <View style={s.listaMini}>
                <Text style={s.campoRotulo}>Atendimentos que entram</Text>
                {previaFechar.itens.map(r => (
                  <View key={r.id} style={s.listaMiniLinha}>
                    <Text style={s.listaMiniCod}>{r.codigoPublico}</Text>
                    <Text style={s.listaMiniData}>{fmtData(toMs(r.concluidoEm) ?? dataResgate(r))}</Text>
                    <Text style={s.listaMiniVal}>{moeda(r.valorComissaoCentavos)}</Text>
                  </View>
                ))}
              </View>
            )}

            {!!fechar.erro && (
              <View style={[s.erro, { marginTop: spacing.md, marginBottom: 0 }]}>
                <Ionicons name="alert-circle-outline" size={16} color={STATUS.CONTESTADO.fg} />
                <Text style={[s.erroTxt, { flex: 1 }]}>{fechar.erro}</Text>
              </View>
            )}

            <View style={s.modalAcoes}>
              <Botao titulo="Cancelar" variante="ghost" onPress={() => setFechar(null)} disabled={processando} style={{ flex: 1 }} />
              <Botao titulo={processando ? 'Gerando...' : `Gerar cobrança de ${moeda(previaFechar.comissao)}`}
                onPress={confirmarFechamento} carregando={processando} disabled={previaFechar.itens.length === 0}
                style={{ flex: 1.6 }} />
            </View>
          </>
        ))}
      </ModalBase>

      {/* ---------------- Modal: registrar pagamento ---------------- */}
      <ModalBase visivel={!!pagamento} onFechar={() => setPagamento(null)} bloqueado={processando} titulo="Registrar pagamento recebido">
        {pagamento && (
          <>
            <CaixaValores status="AGUARDANDO_PAGAMENTO"
              titulo={(nomesParceria.get(pagamento.fechamento.parceriaId) || 'Parceria').toUpperCase()}
              itens={[
                { rotulo: 'Atendimentos', valor: String(Number(pagamento.fechamento.totalResgates) || 0) },
                { rotulo: 'Valor a receber', valor: moeda(pagamento.fechamento.valorComissaoTotalCentavos), destaque: true },
              ]}
              nota={`Cobrança gerada em ${fmtData(toMs(pagamento.fechamento.geradoEm))} · ${periodoCobranca(pagamento.fechamento)}`} />

            <Text style={s.campoRotulo}>Como o parceiro pagou?</Text>
            <View style={s.chipsWrap}>
              {FORMAS_PAGAMENTO.map(fm => (
                <Chip key={fm} label={fm} ativo={pagamento.forma === fm} onPress={() => setPagamento(p => ({ ...p, forma: fm }))} />
              ))}
            </View>
            {pagamento.forma === 'Outro' && (
              <TextInput style={[s.input, { marginTop: spacing.sm }]} value={pagamento.formaOutro}
                placeholder="Qual? Ex.: boleto, permuta..." placeholderTextColor={colors.tl}
                onChangeText={t => setPagamento(p => ({ ...p, formaOutro: t }))} />
            )}

            <Text style={s.campoRotulo}>Referência ou comprovante</Text>
            <TextInput style={s.input} value={pagamento.referencia}
              placeholder="Ex.: ID da transação Pix" placeholderTextColor={colors.tl}
              onChangeText={t => setPagamento(p => ({ ...p, referencia: t }))} />
            <Text style={s.dica}>Opcional, mas ajuda a encontrar o pagamento depois.</Text>

            <Text style={s.campoRotulo}>Observação</Text>
            <TextInput style={[s.input, { minHeight: 64, textAlignVertical: 'top' }]} value={pagamento.observacao} multiline
              placeholder="Opcional" placeholderTextColor={colors.tl}
              onChangeText={t => setPagamento(p => ({ ...p, observacao: t }))} />

            <Text style={[s.explica, { marginTop: spacing.md }]}>
              Ao confirmar, a cobrança e todos os atendimentos dela passam para "Recebido". Faça isso só depois de conferir que o dinheiro entrou.
            </Text>

            {!!pagamento.erro && (
              <View style={[s.erro, { marginBottom: 0 }]}>
                <Ionicons name="alert-circle-outline" size={16} color={STATUS.CONTESTADO.fg} />
                <Text style={[s.erroTxt, { flex: 1 }]}>{pagamento.erro}</Text>
              </View>
            )}

            <View style={s.modalAcoes}>
              <Botao titulo="Cancelar" variante="ghost" onPress={() => setPagamento(null)} disabled={processando} style={{ flex: 1 }} />
              <Botao titulo={processando ? 'Registrando...' : 'Confirmar recebimento'} onPress={confirmarPagamento}
                carregando={processando} disabled={pagamento.forma === 'Outro' && !pagamento.formaOutro.trim()} style={{ flex: 1.4 }} />
            </View>
          </>
        )}
      </ModalBase>

      {/* ---------------- Modal: detalhe da cobrança ---------------- */}
      <ModalBase visivel={!!detalheCobrancaId} onFechar={() => setDetalheCobrancaId(null)} largo
        titulo={`Cobrança — ${detalheCobranca ? (nomesParceria.get(detalheCobranca.parceriaId) || 'Parceria removida') : 'carregando'}`}>
        {!detalheCobranca ? (
          <View style={s.carregando}><ActivityIndicator color={colors.lav4} /><Text style={s.carregandoTxt}>Carregando a cobrança...</Text></View>
        ) : (() => {
          const paga = detalheCobranca.status === 'PAGO';
          const itens = [...(resgatesPorFechamento.get(detalheCobranca.id) || [])]
            .sort((a, b) => (dataResgate(a) ?? 0) - (dataResgate(b) ?? 0));
          const notaPagamento = paga
            ? `Paga em ${fmtDataHora(toMs(detalheCobranca.pagoEm))}${detalheCobranca.metodoPagamento ? ` via ${detalheCobranca.metodoPagamento}` : ''}`
              + `${detalheCobranca.referenciaPagamento ? ` · Comprovante: ${detalheCobranca.referenciaPagamento}` : ''}`
              + `${detalheCobranca.observacaoPagamento ? ` · ${detalheCobranca.observacaoPagamento}` : ''}`
            : 'Aguardando o pagamento do parceiro.';
          return (
            <>
              <CaixaValores status={paga ? 'LIQUIDADO' : 'AGUARDANDO_PAGAMENTO'} titulo={paga ? 'RECEBIDA' : 'AGUARDANDO PAGAMENTO'}
                itens={[
                  { rotulo: 'Atendimentos', valor: String(Number(detalheCobranca.totalResgates) || 0) },
                  { rotulo: 'Valor dos serviços', valor: moeda(detalheCobranca.valorOriginalTotalCentavos) },
                  { rotulo: 'Desconto total', valor: moeda(detalheCobranca.valorDescontoTotalCentavos) },
                  { rotulo: 'Comissão', valor: moeda(detalheCobranca.valorComissaoTotalCentavos), destaque: true },
                ]}
                nota={`Período: ${periodoCobranca(detalheCobranca)} · Gerada em ${fmtDataHora(toMs(detalheCobranca.geradoEm))}\n${notaPagamento}`} />

              {itens.length === 0 ? (
                <Vazio texto="Não encontramos os atendimentos desta cobrança. Eles podem ter sido removidos ou ainda estar carregando." />
              ) : itens.map(r => (
                <View key={r.id} style={s.detalheLinha}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.usoCodigo}>{r.codigoPublico}</Text>
                    <Text style={s.usoMeta}>{fmtDataHora(dataResgate(r))} · serviço {moeda(r.valorOriginalCentavos)} · cliente pagou {moeda(r.valorFinalCentavos)}</Text>
                  </View>
                  <Text style={[s.usoValorNum, s.comissao]}>{moeda(r.valorComissaoCentavos)}</Text>
                </View>
              ))}

              {!paga && (
                <View style={s.modalAcoes}>
                  <Botao titulo="Registrar pagamento recebido" icone="checkmark-circle-outline" style={{ flex: 1 }}
                    onPress={() => { const f = detalheCobranca; setDetalheCobrancaId(null); setTimeout(() => abrirPagamento(f), 300); }} />
                </View>
              )}
            </>
          );
        })()}
      </ModalBase>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 64 },
  cabecalho: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.md },
  pageTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.lav6, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, lineHeight: 18 },

  carregando: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  carregandoTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.tm },

  link: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav5, textDecorationLine: 'underline' },
  riscado: { textDecorationLine: 'line-through', color: colors.tl },

  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(122,158,126,0.14)',
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  avisoErro: { backgroundColor: 'rgba(180,99,90,0.1)' },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.sageFg, lineHeight: 18 },

  erro: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(180,99,90,0.08)',
    borderWidth: 1, borderColor: 'rgba(180,99,90,0.3)', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  erroTxt: { fontFamily: fonts.body, fontSize: 12.5, color: '#8A3F37', lineHeight: 18 },

  // Como funciona
  como: {
    backgroundColor: colors.lav1, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lav2,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  comoTopo: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.sm },
  passosLargo: { flexDirection: 'row', flexWrap: 'wrap' },
  passo: { flexDirection: 'row', gap: spacing.md },
  passoTrilho: { alignItems: 'center', width: 28 },
  passoNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.lav3,
    alignItems: 'center', justifyContent: 'center',
  },
  passoNumVoce: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  passoNumTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav6 },
  passoLinha: { flex: 1, width: 2, backgroundColor: colors.lav2, marginVertical: 2, minHeight: 12 },
  passoCorpo: { flex: 1, paddingBottom: spacing.md },
  passoQuem: { fontFamily: fonts.bodyBold, fontSize: 9.5, letterSpacing: 1, color: colors.tl, marginTop: 2 },
  passoTitulo: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.td, marginTop: 1 },
  passoTexto: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, lineHeight: 17, marginTop: 2 },

  // Filtros
  filtros: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  filtroRotulo: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1, color: colors.tl, marginBottom: 6, marginTop: 4 },
  chipsLinha: { flexDirection: 'row', gap: 7, paddingBottom: spacing.sm },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    backgroundColor: colors.card, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 13, paddingVertical: 7,
  },
  chipSel: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  chipTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTxtSel: { fontFamily: fonts.bodyBold, color: '#fff' },
  filtroRodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: 2,
  },
  filtroResumo: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.tm },

  // Seções
  secaoTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.md },
  secaoTitulo: { fontFamily: fonts.serif, fontSize: 17, color: colors.lav6 },
  secaoSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, lineHeight: 17, marginTop: 3 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // Situação
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.full,
    paddingLeft: 7, paddingRight: 9, paddingVertical: 3, maxWidth: 190,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillTxt: { fontFamily: fonts.bodyBold, fontSize: 10.5, flexShrink: 1 },

  // Indicadores
  kpi: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4, padding: spacing.md, gap: 2,
  },
  kpiTopo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpiTitulo: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 12 },
  kpiValor: { fontFamily: fonts.serif, fontSize: 21, color: colors.td, marginTop: 6 },
  kpiQtd: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tm },
  kpiAjuda: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, lineHeight: 15, marginTop: 6 },

  resumo: { marginTop: 10 },
  resumoItem: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2,
  },
  resumoIcone: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  resumoValor: { fontFamily: fonts.serif, fontSize: 19, color: colors.td },
  resumoDe: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm },
  resumoRotulo: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.td },
  resumoAjuda: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, lineHeight: 15 },
  barra: { height: 6, borderRadius: 3, backgroundColor: colors.lav1, overflow: 'hidden', marginVertical: 5 },
  barraFill: { height: '100%', borderRadius: 3, backgroundColor: colors.lav4 },

  // Por parceria
  parc: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: spacing.md,
  },
  parcDestaque: { borderColor: colors.lav3 },
  parcTopo: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  parcIcone: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  parcNome: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td },
  parcRegra: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tm, lineHeight: 16, marginTop: 2 },
  tagInativa: { backgroundColor: colors.bg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
  tagInativaTxt: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.tl },
  parcMetricas: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  parcMetrica: { width: '50%', paddingRight: 8 },
  parcMetricaRot: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },
  parcMetricaVal: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.td },
  txtContestado: { fontFamily: fonts.body, fontSize: 11, color: '#94463E' },
  parcSaldos: { flexDirection: 'row', gap: 8 },
  parcSaldo: { flex: 1, borderRadius: radius.sm, padding: 10 },
  parcSaldoRot: { fontFamily: fonts.bodyBold, fontSize: 11 },
  parcSaldoVal: { fontFamily: fonts.serif, fontSize: 18, marginTop: 2 },
  parcSaldoSub: { fontFamily: fonts.body, fontSize: 11, opacity: 0.85 },
  parcNota: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tm, marginTop: -4 },
  parcAcoes: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md,
  },
  parcNada: { flexGrow: 1, fontFamily: fonts.body, fontSize: 12, color: colors.tl },

  // Botões
  btnPrim: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.lav4, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 11,
  },
  btnPrimTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: '#fff', textAlign: 'center', flexShrink: 1 },
  btnGhost: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.card, borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  btnGhostTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.lav5, textAlign: 'center', flexShrink: 1 },

  // Cobranças
  segmento: {
    flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    padding: 3, marginBottom: spacing.md, alignSelf: 'flex-start',
  },
  segmentoBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.full },
  segmentoBtnAtivo: { backgroundColor: colors.card, shadowColor: '#6b5b7a', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentoTxt: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm },
  segmentoTxtAtivo: { fontFamily: fonts.bodyBold, color: colors.lav6 },
  faixa: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md,
  },
  faixaTxt: { flex: 1, minWidth: 200, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  cob: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4, padding: spacing.md, gap: 4,
  },
  cobTopo: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginBottom: 2 },
  cobParceria: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td },
  cobMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tm, lineHeight: 16 },
  cobValor: { fontFamily: fonts.serif, fontSize: 19, color: colors.td },
  cobAcoes: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: 6,
  },

  // Utilizações
  busca: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.md,
  },
  buscaInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  contagem: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: spacing.sm },
  uso: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4, padding: spacing.md, gap: spacing.sm,
  },
  usoContestado: { backgroundColor: 'rgba(180,99,90,0.05)', borderColor: 'rgba(180,99,90,0.3)' },
  usoTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  usoCodigo: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.lav6, letterSpacing: 0.5 },
  usoMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tm, marginTop: 1 },
  usoValores: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  usoValor: { width: '50%', paddingRight: 6 },
  usoValorRot: { fontFamily: fonts.body, fontSize: 10.5, color: colors.tl },
  usoValorNum: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.td },
  comissao: { color: colors.goldFg },
  usoDetalhe: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  usoDetalheTxt: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, color: colors.tm, lineHeight: 16 },

  vazio: {
    alignItems: 'center', gap: 8, padding: spacing.lg, borderRadius: radius.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lav2, backgroundColor: colors.card,
  },
  vazioTxt: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, textAlign: 'center', lineHeight: 18 },

  // Modais
  modalOverlay: { flex: 1, backgroundColor: 'rgba(46,39,64,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.xl, width: '100%', maxWidth: 440, maxHeight: '92%', overflow: 'hidden' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitulo: { flex: 1, fontFamily: fonts.serif, fontSize: 17, color: colors.lav6 },
  modalBody: { padding: spacing.lg, paddingBottom: spacing.xl },
  modalAcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.lg, width: '100%' },
  explica: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, lineHeight: 18, marginBottom: spacing.md },
  campoRotulo: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.td, marginTop: spacing.md, marginBottom: 6 },
  dica: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: 6, marginBottom: spacing.md, lineHeight: 15 },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  caixa: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  caixaTitulo: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.7, marginBottom: 8 },
  caixaGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  caixaItem: { width: '50%', paddingRight: 6 },
  caixaRotulo: { fontFamily: fonts.body, fontSize: 11, opacity: 0.85 },
  caixaValor: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.td },
  caixaNota: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, marginTop: 8 },
  listaMini: { marginTop: spacing.xs },
  listaMiniLinha: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  listaMiniCod: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav6 },
  listaMiniData: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tm },
  listaMiniVal: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.goldFg, minWidth: 80, textAlign: 'right' },
  detalheLinha: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  resultadoIcone: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(122,158,126,0.16)',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  resultadoValor: { fontFamily: fonts.serif, fontSize: 28, color: colors.lav6, marginBottom: spacing.sm },
  proximo: { backgroundColor: colors.lav1, borderRadius: radius.md, padding: spacing.md, width: '100%' },
  proximoTxt: { fontFamily: fonts.body, fontSize: 12.5, color: colors.lav6, lineHeight: 18 },
});
