import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Dimensions, Alert, Platform, Image, TextInput, Modal,
  useWindowDimensions, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { abrirPagamento, mensagemErroPagamento, aquecerPagamento } from '../../utils/pagamento';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { emocoes } from '../../data';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { LavandaBg } from '../../components';
import { Profundo } from '../../components/Efeitos';
import { functions, db } from '../../services/firebase';
import { gerarRelatorioMensalHTML, gerarRelatorioAnualHTML, gerarRelatorioPersonalizadoHTML } from '../../utils/relatorioHtml';
import UsarCashback from '../cashback/UsarCashback';


const { width: SCREEN_W } = Dimensions.get('window');
const logo = require('../../../assets/images/travessia_logo.png');
const ilVazio = require('../../../assets/images/il_coracao_ramos.png');
const CHART_W = SCREEN_W - 48;

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAY_LABELS  = ['D','S','T','Q','Q','S','S'];

// ── Gráfico de rosca (SVG) ────────────────────────────────────────────────────
function DonutChart({ data, size = 160, thickness = 30, total, label }) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const tot = data.reduce((s, d) => s + d.value, 0) || 1;
  let cum = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* Trilho */}
        <Circle cx={cx} cy={cx} r={r} stroke={colors.lav1} strokeWidth={thickness} fill="none" />
        {data.map((seg, i) => {
          const dash = (seg.value / tot) * circumference;
          const offset = -(cum / tot) * circumference;
          cum += seg.value;
          return (
            <Circle key={i} cx={cx} cy={cx} r={r}
              stroke={seg.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={offset}
              fill="none" rotation="-90" origin={`${cx},${cx}`}
            />
          );
        })}
      </Svg>
      {/* Total no centro */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Figtree_800ExtraBold', fontSize: Math.round(size * 0.19), lineHeight: Math.round(size * 0.22), color: colors.titulo }}>{total}</Text>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: size >= 120 ? 12 : 11, color: colors.texto2 }}>{label}</Text>
      </View>
    </View>
  );
}

// ── Calendário emocional ──────────────────────────────────────────────────────
function CalendarGrid({ year, month, checkinsByDate, onDayPress }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {DAY_LABELS.map((l, i) => (
          <Text key={i} style={cs.dayLabel}>{l}</Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={cs.cellVazia} />;
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const emo = checkinsByDate[key];
          const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const isFuture = new Date(year, month, d) > today;
          const cellStyle = [
            cs.cell,
            emo && { backgroundColor: dadoEmo(emo, 0) + (colors.escuro ? '59' : '4D') },
            isToday && cs.cellHoje,
            isFuture && { opacity: 0.35 },
          ];
          const dayText = <Text style={[cs.dayNum, emo && { color: tintaEmo(emo), fontFamily: fonts.bodySemi }, isToday && { fontFamily: fonts.bodyBold }]}>{d}</Text>;
          if (emo && onDayPress && !isFuture) {
            return (
              <View key={d} style={cs.cellCaixa}>
                <TouchableOpacity style={cellStyle} onPress={() => onDayPress(key)} activeOpacity={0.7}>
                  {dayText}
                </TouchableOpacity>
              </View>
            );
          }
          return <View key={d} style={cs.cellCaixa}><View style={cellStyle}>{dayText}</View></View>;
        })}
      </View>
    </View>
  );
}

const cs = criarEstilos(() => ({
  cellVazia: { width: `${100 / 7}%`, aspectRatio: 1 },
  cellCaixa: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2.5 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  cellHoje: { borderWidth: 2, borderColor: colors.botao },
  dayLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.lilasTexto },
  dayNum: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.texto2 },
}));

// ── Helpers de dados ──────────────────────────────────────────────────────────
function getEmoObj(id) { return emocoes.find(e => e.id === id); }

// Paleta de emoções "Luz de Vidro": `dado` (fatias, barras, legendas),
// `bg` (véu claro) e `color` (tinta do ícone/texto). No noturno, o véu vira a
// cor do dado translúcida e a tinta fica mais clara para continuar legível.
function dadoEmo(e, i = 0) { return e?.dado || e?.color || EMO_CHART_COLORS[i % EMO_CHART_COLORS.length]; }
function tintaEmo(e) { return (colors.escuro ? (e?.dado || e?.color) : e?.color) || colors.lilasIcone; }
function veuEmo(e) { return colors.escuro ? `${dadoEmo(e)}33` : (e?.bg || colors.lav1); }

function calcMes(checkins, year, month) {
  return checkins.filter(c => {
    const d = new Date(c.data);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function calcAno(checkins, year) {
  return checkins.filter(c => new Date(c.data).getFullYear() === year);
}

function contagemEmo(lista) {
  const map = {};
  lista.forEach(c => {
    if (!map[c.emocao]) map[c.emocao] = { count: 0, ultima: '' };
    map[c.emocao].count++;
    if (c.data > map[c.emocao].ultima) map[c.emocao].ultima = c.data;
  });
  return Object.entries(map)
    .sort((a, b) => b[1].count - a[1].count || b[1].ultima.localeCompare(a[1].ultima))
    .map(([emocao, v]) => [emocao, v.count]);
}

function checkinsByDate(checkins) {
  const map = {};
  checkins.forEach(c => {
    const key = c.data?.slice(0, 10);
    if (key) map[key] = getEmoObj(c.emocao);
  });
  return map;
}

// DD/MM/AAAA -> AAAA-MM-DD (o formato gravado nos check-ins); null se inválida.
function paraIso(dataBr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr || '');
  if (!m) return null;
  const [, d, mes, ano] = m;
  const dt = new Date(Number(ano), Number(mes) - 1, Number(d));
  if (dt.getDate() !== Number(d) || dt.getMonth() !== Number(mes) - 1) return null;
  return `${ano}-${mes}-${d}`;
}

// Compara as datas como texto AAAA-MM-DD. Antes convertia com new Date(), que
// lê a data como meia-noite UTC (21h do dia anterior em Brasília): o período
// ficava deslocado em um dia — perdia o primeiro dia e incluía o seguinte ao fim.
function calcRange(checkins, inicio, fim) {
  const ini = paraIso(inicio);
  const f = paraIso(fim);
  if (!ini || !f || ini > f) return [];
  return checkins.filter(c => {
    const d = String(c.data || '').slice(0, 10);
    return d >= ini && d <= f;
  });
}

// Situação do período digitado, para só liberar a compra de um relatório que
// de fato terá conteúdo.
function avaliarPeriodo(checkins, inicio, fim) {
  const ini = paraIso(inicio);
  const f = paraIso(fim);
  if (!ini || !f) return { ok: false, motivo: 'Defina as datas de início e fim acima para liberar a compra.' };
  if (ini > f) return { ok: false, motivo: 'A data de início precisa ser anterior à data de fim.' };
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  if (ini > hoje) return { ok: false, motivo: 'O período escolhido ainda não começou.' };
  const lista = calcRange(checkins, inicio, fim);
  if (!lista.length) return { ok: false, motivo: 'Não há check-ins nesse período. Escolha outras datas para o seu relatório.' };
  const dias = new Set(lista.map(c => String(c.data).slice(0, 10))).size;
  return { ok: true, total: lista.length, dias };
}

function diasComRegistro(checkins, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const diasPassados = (year === today.getFullYear() && month === today.getMonth())
    ? today.getDate()
    : daysInMonth;
  const uniqueDays = new Set(checkins.map(c => c.data?.slice(0, 10)));
  return { com: uniqueDays.size, total: diasPassados };
}

// ── Áreas da vida ─────────────────────────────────────────────────────────────
const LOCAIS_INFO = [
  { id: 'saude',          label: 'Saúde física',     icon: 'fitness-outline'   },
  { id: 'eu',             label: 'Eu comigo',         icon: 'person-outline'    },
  { id: 'trabalho',       label: 'Trabalho',          icon: 'briefcase-outline' },
  { id: 'relacionamentos',label: 'Relacionamentos',   icon: 'people-outline'    },
];

function calcAreaData(lista) {
  return LOCAIS_INFO.map((loc, li) => {
    const items = lista.filter(c => c.local === loc.id);
    const sorted = contagemEmo(items);
    const total = items.length;
    const donut = sorted.map(([id, v], i) => ({
      id, value: v, color: dadoEmo(getEmoObj(id), li * 4 + i),
    }));
    return { ...loc, sorted, total, donut };
  });
}

// Celular: carrossel de áreas; tablet: as 4 áreas lado a lado, ocupando a largura.
function AreasDaVida({ areas, largo }) {
  if (largo) {
    return (
      <View style={areaStyles.linha}>
        {areas.map(area => <AreaDonutCard key={area.id} area={area} largo />)}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={areaStyles.carrossel}
      contentContainerStyle={areaStyles.carrosselConteudo}
    >
      {areas.map(area => <AreaDonutCard key={area.id} area={area} />)}
    </ScrollView>
  );
}

function AreaDonutCard({ area, largo }) {
  const empty = area.total === 0;
  const chartData = empty ? [{ value: 1, color: colors.lav2 }] : area.donut;
  return (
    <View style={[areaStyles.card, largo && areaStyles.cardLargo]}>
      <View style={areaStyles.header}>
        <View style={areaStyles.icone}>
          <Ionicons name={area.icon} size={15} color={colors.lilasIcone} />
        </View>
        <Text style={areaStyles.name} numberOfLines={2}>{area.label}</Text>
      </View>
      <DonutChart data={chartData} size={largo ? 110 : 96} thickness={largo ? 18 : 16} total={empty ? 0 : area.total} label="reg." />
      <View style={areaStyles.breakdown}>
        {empty ? (
          <Text style={areaStyles.empty}>Sem registros</Text>
        ) : (
          area.sorted.slice(0, 3).map(([id, v], i) => {
            const emo = getEmoObj(id);
            const pct = Math.round((v / area.total) * 100);
            return (
              <View key={id} style={areaStyles.emoRow}>
                <View style={[areaStyles.dot, { backgroundColor: area.donut[i]?.color || colors.lav3 }]} />
                <Text style={areaStyles.emoName} numberOfLines={1}>{emo?.label || id}</Text>
                <Text style={areaStyles.emoPct}>{pct}%</Text>
              </View>
            );
          })
        )}
      </View>
      <Text style={areaStyles.total}>Total: {area.total} reg.</Text>
    </View>
  );
}

const areaStyles = criarEstilos(() => ({
  carrossel: { marginHorizontal: -18 },
  carrosselConteudo: { gap: 10, paddingVertical: 10, paddingHorizontal: 18 },
  linha: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  // Bloco tênue dentro do cartão de vidro (sem borda dentro de borda).
  card: { width: 158, backgroundColor: colors.lavVeu, borderRadius: 20, padding: 12, alignItems: 'center', gap: 8 },
  cardLargo: { width: undefined, flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'stretch' },
  icone: { width: 28, height: 28, borderRadius: 10, backgroundColor: colors.vidroForte, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.titulo, flex: 1 },
  breakdown: { alignSelf: 'stretch', gap: 4 },
  emoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  emoName: { flex: 1, fontFamily: fonts.body, fontSize: 10.5, color: colors.titulo },
  emoPct: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.texto2 },
  empty: { fontFamily: fonts.body, fontSize: 10.5, color: colors.texto2, textAlign: 'center', paddingVertical: 4 },
  total: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.lilasTexto, alignSelf: 'flex-end' },
}));

// ── Pequenas Vitórias: ícone + cor por tema da conquista ─────────────────────
// `cor` = tinta no tema claro; `noite` = tom claro para o noturno (paleta d2).
const VIT_ICONES = [
  { re: /hidrat|água|agua|bebi/i,                     icon: 'water-outline',          cor: '#4C6C9E', noite: '#A9C1EC' },
  { re: /medit|respir|calma|pausa/i,                  icon: 'flower-outline',         cor: '#6A55BE', noite: '#BCAAF8' },
  { re: /caminh|andei|exerc|corri|treino|academia/i,  icon: 'walk-outline',           cor: '#3F7A5E', noite: '#9FD0B0' },
  { re: /dorm|sono|descans|repous/i,                  icon: 'moon-outline',           cor: '#56698C', noite: '#A9C1EC' },
  { re: /li |livro|leitur|estud/i,                    icon: 'book-outline',           cor: '#A8582E', noite: '#F2B79E' },
  { re: /gratid|grato|grata|agradec/i,                icon: 'heart-outline',          cor: '#A84868', noite: '#F2A2BC' },
  { re: /amig|encontr|social|convers|visit/i,         icon: 'people-outline',         cor: '#9A6B1F', noite: '#E5C68B' },
  { re: /aliment|comi|refei|cozinh/i,                 icon: 'restaurant-outline',     cor: '#94593F', noite: '#F2B79E' },
  { re: /música|musica|cant|dan[çc]/i,                icon: 'musical-notes-outline',  cor: '#8A4F9E', noite: '#D9B4F0' },
  { re: /sa[íi] de casa|passe|rua|ar livre|natur/i,   icon: 'sunny-outline',          cor: '#9A6B1F', noite: '#E5C68B' },
  { re: /apoio|rede|terapia|psic[óo]l/i,              icon: 'chatbubbles-outline',    cor: '#3F7A6E', noite: '#93D1C4' },
  { re: /jornada|conclu|termin|finaliz/i,             icon: 'compass-outline',        cor: '#524197', noite: '#CFC2FF' },
  { re: /banho|cuid|autocuid|arrum/i,                 icon: 'sparkles-outline',       cor: '#A84868', noite: '#F2A2BC' },
  { re: /chor|senti|emo[çc]/i,                        icon: 'rainy-outline',          cor: '#4C6C9E', noite: '#A9C1EC' },
];

const VIT_FALLBACK_CORES = [
  { cor: '#6A55BE', noite: '#BCAAF8' }, { cor: '#A8582E', noite: '#F2B79E' }, { cor: '#3F7A5E', noite: '#9FD0B0' },
  { cor: '#9A6B1F', noite: '#E5C68B' }, { cor: '#4C6C9E', noite: '#A9C1EC' }, { cor: '#A84868', noite: '#F2A2BC' },
];

function estiloVitoria(label, idx) {
  const achou = VIT_ICONES.find(v => v.re.test(label || ''));
  const base = achou || { icon: 'star-outline', ...VIT_FALLBACK_CORES[idx % VIT_FALLBACK_CORES.length] };
  return { icon: base.icon, cor: colors.escuro ? base.noite : base.cor };
}

// Agrupa as vitórias por rótulo e conta em quantos DIAS distintos cada uma ocorreu,
// devolvendo as `max` mais frequentes (é isso que o relatório destaca).
// "As 6 maiores vitórias" — com o número real, já que pode haver menos de 6.
function tituloVitorias(n) {
  return n === 1 ? 'A maior vitória' : `As ${n} maiores vitórias`;
}

function agruparVitorias(lista, max = 6) {
  const mapa = new Map();
  (lista || []).forEach(v => {
    const label = (v.label || '').trim();
    if (!label) return;
    if (!mapa.has(label)) mapa.set(label, new Set());
    mapa.get(label).add(v.data || v.id);
  });
  return [...mapa.entries()]
    .map(([label, dias]) => ({ label, dias: dias.size }))
    .sort((a, b) => b.dias - a.dias || a.label.localeCompare(b.label))
    .slice(0, max)
    .map((v, i) => ({ ...v, ...estiloVitoria(v.label, i) }));
}

function VitoriasDestaque({ itens }) {
  return (
    <View style={vitStyles.wrap}>
      {itens.map((v, i) => (
        <View key={`${v.label}-${i}`} style={vitStyles.item}>
          <View style={[vitStyles.iconBox, { backgroundColor: v.cor + (colors.escuro ? '29' : '1A') }]}>
            <Ionicons name={v.icon} size={18} color={v.cor} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={vitStyles.label} numberOfLines={2}>{v.label}</Text>
            <Text style={[vitStyles.dias, { color: v.cor }]}>
              {v.dias} {v.dias === 1 ? 'dia' : 'dias'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const vitStyles = criarEstilos(() => ({
  wrap: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    marginTop: 10, rowGap: 10,
  },
  // Blocos tênues dentro do cartão de vidro (sem borda dentro de borda).
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    width: '48.5%',
    backgroundColor: colors.lavVeu, borderRadius: 18,
    paddingVertical: 10, paddingHorizontal: 10,
  },
  iconBox: {
    width: 38, height: 38, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.titulo, lineHeight: 16 },
  dias: { fontFamily: fonts.bodySemi, fontSize: 11, marginTop: 2 },
}));

// ── Cores para emoções no gráfico ─────────────────────────────────────────────
// Paleta de dados d2 (sem oliva nem mostarda), usada quando a emoção não tem cor própria.
const EMO_CHART_COLORS = [
  '#A595DC', '#E39A72', '#6E9B7E', '#C9A15A', '#7F9BCB', '#D682A0',
  '#8EA3C8', '#B98A7A', '#8FA89A', '#C27C78', '#9A90AE', '#C7A07E',
];

// O HTML dos relatórios em PDF fica em src/utils/relatorioHtml.js.

// ─────────────────────────────────────────────────────────────────────────────
export default function RelatoriosScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  // Tablet: rosca maior e áreas da vida lado a lado.
  const { width: larguraTela } = useWindowDimensions();
  const largo = larguraTela >= 700;
  const tamanhoRosca = largo ? 200 : 148;
  const { checkins, usuario, temAcesso, mensagensRelatorio, vitorias } = useApp();
  const { perfil, firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || null;
  const [tab, setTab] = useState(() => (['mensal', 'anual', 'personalizado'].includes(route?.params?.tab) ? route.params.tab : 'mensal'));
  const [exportando, setExportando] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [usarCashback, setUsarCashback] = useState(false);
  // Preço do relatório por período definido pela administração
  // (configuracoes/precos.periodo, em centavos). Antes o valor era fixo na tela.
  const [precoPeriodo, setPrecoPeriodo] = useState(590);
  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'precos'), snap => {
    const c = snap.data()?.periodo;
    if (typeof c === 'number' && c > 0) setPrecoPeriodo(c);
  }, () => {}), []);
  // Como em Planos: "acorda" a Cloud Function (e pré-carrega o navegador no
  // Android) ao abrir a aba Período, para o pagamento abrir rápido.
  useEffect(() => {
    if (tab === 'personalizado') aquecerPagamento('criarCheckoutPeriodoUnlocked');
  }, [tab]);
  const precoPeriodoTxt = (precoPeriodo / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const [rangeInicio, setRangeInicio] = useState('');
  const [rangeFim, setRangeFim] = useState('');
  const [rangeData, setRangeData] = useState(null);
  const [creditoUsado, setCreditoUsado] = useState(false);
  const [calMes, setCalMes] = useState(new Date().getMonth());
  const [calAno, setCalAno] = useState(new Date().getFullYear());
  const [dayModal, setDayModal] = useState(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const temPlano1 = temAcesso(1);

  // ── Dados mensais (segue calMes/calAno para que o calendário conduza todos os gráficos) ──
  const mesal = useMemo(() => {
    const lista = calcMes(checkins, calAno, calMes);
    const sorted = contagemEmo(lista);
    const total = lista.length;
    const donut = sorted.map(([id, v], i) => ({
      id, value: v, color: dadoEmo(getEmoObj(id), i),
    }));
    const byDate = checkinsByDate(lista);
    const dominante = sorted[0]?.[0];
    const { com, total: totalDias } = diasComRegistro(lista, calAno, calMes);
    const semRegistro = totalDias - com;
    const areaData = calcAreaData(lista);

    return { lista, sorted, total, donut, byDate, dominante, com, semRegistro, totalDias, areaData };
  }, [checkins, calAno, calMes]);

  // ── Dados anuais ──
  const anual = useMemo(() => {
    const lista = calcAno(checkins, year);
    const sorted = contagemEmo(lista);
    const total = lista.length;
    const donut = sorted.map(([id, v], i) => ({
      id, value: v, color: dadoEmo(getEmoObj(id), i),
    }));

    const uniqueDays = new Set(lista.map(c => c.data?.slice(0, 10)));
    const totalDias = Math.floor((now - new Date(year, 0, 1)) / 86400000) + 1;
    const consistencia = Math.round((uniqueDays.size / totalDias) * 100);

    // Trimestres
    const trims = [0, 1, 2, 3].map(t => {
      const tl = [0, 1, 2].map(m => calcMes(checkins, year, t * 3 + m)).flat();
      return tl.length;
    });
    const totalTrims = trims.reduce((s, v) => s + v, 0) || 1;
    const trimPct = trims.map(v => Math.round((v / totalTrims) * 100));

    const areaData = calcAreaData(lista);
    return { lista, sorted, total, donut, uniqueDays: uniqueDays.size, consistencia, trimPct, areaData };
  }, [checkins, year]);

  const vitoriasMes = useMemo(() => {
    const prefixo = `${calAno}-${String(calMes + 1).padStart(2, '0')}`;
    return (vitorias || []).filter(v => v.data?.startsWith(prefixo));
  }, [vitorias, calAno, calMes]);

  const vitoriasAno = useMemo(
    () => (vitorias || []).filter(v => v.data?.startsWith(String(year))),
    [vitorias, year]
  );

  const vitoriasRange = useMemo(() => {
    if (!rangeData || !rangeInicio || !rangeFim) return [];
    const [dI, mI, yI] = rangeInicio.split('/').map(Number);
    const [dF, mF, yF] = rangeFim.split('/').map(Number);
    if (!yI || !yF) return [];
    const startStr = `${yI}-${String(mI).padStart(2, '0')}-${String(dI).padStart(2, '0')}`;
    const endStr = `${yF}-${String(mF).padStart(2, '0')}-${String(dF).padStart(2, '0')}`;
    return (vitorias || []).filter(v => v.data >= startStr && v.data <= endStr);
  }, [vitorias, rangeData, rangeInicio, rangeFim]);

  const handleCalNav = (dir) => {
    setCalMes(prev => {
      const next = prev + dir;
      if (next < 0) { setCalAno(a => a - 1); return 11; }
      if (next > 11) { setCalAno(a => a + 1); return 0; }
      return next;
    });
  };

  const handleDayPress = (dateKey) => {
    const dayCheckins = checkins.filter(c => c.data?.startsWith(dateKey));
    setDayModal({ date: dateKey, checkins: dayCheckins });
  };

  const formatarData = (text) => {
    const nums = text.replace(/\D/g, '');
    if (nums.length <= 2) return nums;
    if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`;
    return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4, 8)}`;
  };

  const periodo = useMemo(
    () => avaliarPeriodo(checkins, rangeInicio, rangeFim),
    [checkins, rangeInicio, rangeFim]
  );

  const handleDesbloquear = async () => {
    // No tablet o botão fica visível acima do teclado das datas. O teclado
    // aberto "engolia" o toque (a ScrollView só fechava o teclado) e o
    // pagamento nunca abria. Agora o toque chega ao botão e o teclado é
    // fechado aqui, antes de abrir o Stripe.
    Keyboard.dismiss();
    if (comprando) return;
    if (!periodo.ok) { Alert.alert('Defina o período', periodo.motivo); return; }
    setComprando(true);
    try {
      const criarCheckout = httpsCallable(functions, 'criarCheckoutPeriodoUnlocked');
      const { data } = await criarCheckout({ usarCashback });
      if (!data?.url) throw new Error('Não recebemos o link de pagamento. Tente novamente em alguns instantes.');
      await abrirPagamento(data.url);
    } catch (e) {
      Alert.alert('Não foi possível abrir o pagamento', mensagemErroPagamento(e));
    } finally {
      setComprando(false);
    }
  };

  const handleGerarRange = () => {
    const reDate = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!reDate.test(rangeInicio) || !reDate.test(rangeFim)) {
      Alert.alert('Atenção', 'Informe as datas no formato DD/MM/AAAA.');
      return;
    }
    const lista = calcRange(checkins, rangeInicio, rangeFim);
    if (!lista.length) {
      Alert.alert('Sem dados', 'Não há check-ins registrados no período selecionado.');
      return;
    }
    const sorted = contagemEmo(lista);
    const total = lista.length;
    const donut = sorted.map(([id, v], i) => ({
      id, value: v, color: dadoEmo(getEmoObj(id), i),
    }));
    const dominante = sorted[0]?.[0];
    const uniqueDays = new Set(lista.map(c => c.data?.slice(0, 10))).size;
    const areaData = calcAreaData(lista);
    setRangeData({ lista, sorted, total, donut, dominante, uniqueDays, areaData });
    if (!creditoUsado && uid) {
      setCreditoUsado(true);
      updateDoc(doc(db, 'usuarios', uid), { periodoCreditos: increment(-1) }).catch(() => {});
    }
  };

  // HTML do relatório da aba atual (mesmo conteúdo que aparece na tela).
  const montarHtml = () => (tab === 'mensal'
    ? gerarRelatorioMensalHTML({ mesal, usuario, month: calMes, year: calAno, vitorias: vitoriasMes, mensagem: mensagem(mesal.dominante) })
    : tab === 'anual'
      ? gerarRelatorioAnualHTML({ anual, usuario, year, vitorias: vitoriasAno })
      : gerarRelatorioPersonalizadoHTML({ rangeData, rangeInicio, rangeFim, usuario, vitorias: vitoriasRange }));

  const handleExportar = async () => {
    if (exportando) return;
    if (tab === 'anual' && !temAcesso(1)) {
      Alert.alert('Relatório Anual', 'O relatório anual está disponível no Plano Acolher.');
      return;
    }
    if (tab === 'personalizado' && !rangeData) {
      Alert.alert('Atenção', 'Gere o relatório do período antes de exportar.');
      return;
    }
    if (Platform.OS === 'web') {
      setExportando(true);
      try {
        const html = montarHtml();
        const w = typeof window !== 'undefined' && window.open ? window.open('', '_blank') : null;
        if (w) {
          w.document.write(html);
          w.document.close();
          w.focus();
          // Espera as fontes da marca carregarem antes de abrir a impressão.
          const imprimir = () => setTimeout(() => { w.print(); }, 300);
          if (w.document.fonts?.ready) w.document.fonts.ready.then(imprimir, imprimir); else setTimeout(imprimir, 600);
        } else {
          Alert.alert('PDF', 'Permita pop-ups neste site e tente novamente.');
        }
      } catch {
        Alert.alert('Erro', 'Não foi possível gerar o PDF.');
      } finally {
        setExportando(false);
      }
      return;
    }
    setExportando(true);
    try {
      const html = montarHtml();
      // A4 em pontos (o padrão do expo-print é Carta).
      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf', dialogTitle: 'Exportar relatório' });
      } else {
        Alert.alert('PDF gerado', 'Arquivo salvo em: ' + uri);
      }
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível gerar o PDF: ' + (err?.message || 'tente novamente.'));
    } finally {
      setExportando(false);
    }
  };

  const mensagem = (dominante) => {
    if (mensagensRelatorio?.[dominante]) return mensagensRelatorio[dominante];
    const emo = getEmoObj(dominante);
    if (!emo) return 'Cada check-in é um passo de autoconhecimento. Continue cuidando de si.';
    if (emo.positiva) return `${emo.label} esteve presente em você este mês. Guarde esse sentimento com carinho e continue se cuidando.`;
    const nomeEmo = emo.nomeRelatorio || emo.label.toLowerCase();
    return `Atravessando ${nomeEmo} — esse foi seu mês. Cada sentimento que você nomeia é um passo de cuidado. Você não precisa fazer essa travessia sem companhia.`;
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.titulo} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Relatórios</Text>
        <TouchableOpacity
          onPress={handleExportar}
          disabled={exportando}
          style={[s.backBtn, exportando && { opacity: 0.5 }]}
          accessibilityLabel="Exportar relatório em PDF"
        >
          <Ionicons name={exportando ? 'hourglass-outline' : 'download-outline'} size={20} color={colors.lilasIcone} />
        </TouchableOpacity>
      </View>

      {/* Abas: trilho de vidro com a ativa em branco */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, tab === 'mensal' && s.tabSel]} onPress={() => setTab('mensal')} accessibilityState={{ selected: tab === 'mensal' }}>
          <Text style={[s.tabTxt, tab === 'mensal' && s.tabTxtSel]}>Mensal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'anual' && s.tabSel]} onPress={() => setTab('anual')} accessibilityState={{ selected: tab === 'anual' }}>
          <Ionicons name={tab === 'anual' ? 'calendar' : 'calendar-outline'} size={14} color={tab === 'anual' ? colors.lilasTexto : colors.texto2} />
          <Text style={[s.tabTxt, tab === 'anual' && s.tabTxtSel]}>Anual</Text>
          {!temAcesso(1) && <Ionicons name="lock-closed" size={11} color={colors.texto2} />}
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'personalizado' && s.tabSel]} onPress={() => setTab('personalizado')} accessibilityState={{ selected: tab === 'personalizado' }}>
          <Ionicons name={tab === 'personalizado' ? 'options' : 'options-outline'} size={14} color={tab === 'personalizado' ? colors.lilasTexto : colors.texto2} />
          <Text style={[s.tabTxt, tab === 'personalizado' && s.tabTxtSel]}>Período</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom, paddingHorizontal: spacing.lg }}
      >

        {/* ═══════════════════════════════════ RELATÓRIO MENSAL ══════════════════ */}
        {tab === 'mensal' && (
          <>
            {/* Cabeçalho */}
            <View style={s.reportHeader}>
              <Image source={logo} style={s.reportLogo} resizeMode="contain" />
              <Text style={s.reportTitle}>RELATÓRIO MENSAL</Text>
              <View style={s.reportMes}>
                <Ionicons name="calendar-outline" size={14} color={colors.lilasTexto} />
                <Text style={s.reportMesTxt}>{MONTH_NAMES[calMes].toUpperCase()}/{calAno}</Text>
              </View>
              <Text style={s.reportSub}>Seu resumo emocional do mês</Text>
              {mesal.total > 0 && <ExportarPdf compacto onPress={handleExportar} exportando={exportando} />}
            </View>

            {mesal.total === 0 ? (
              <View style={[s.card, s.emptyBox]}>
                <Moldura source={ilVazio} tamanho={96} />
                <Text style={s.emptyTxt}>Ainda não há check-ins este mês.</Text>
                <Text style={s.emptyHint}>Faça seu primeiro check-in para ver seu relatório.</Text>
                <BotaoLuz titulo="Fazer check-in agora" onPress={() => navigation.navigate('CheckIn')} style={s.btnCentro} />
              </View>
            ) : (
              <>
                {/* Seção 1 — Suas emoções no mês */}
                <View style={s.card}>
                  <TituloCartao num="1">Suas emoções no mês</TituloCartao>
                  <View style={s.donutRow}>
                    <DonutChart data={mesal.donut} size={tamanhoRosca} thickness={largo ? 34 : 26} total={mesal.total} label="registros" />
                    <View style={[s.donutLegend, largo && s.donutLegendLargo]}>
                      {mesal.sorted.slice(0, 6).map(([id, v], i) => {
                        const emo = getEmoObj(id);
                        const pct = Math.round((v / mesal.total) * 100);
                        return (
                          <View key={id} style={s.legendRow}>
                            <View style={[s.legendDot, { backgroundColor: dadoEmo(emo, i) }]} />
                            <Text style={s.legendTxt} numberOfLines={1}>{emo?.label || id}</Text>
                            <Text style={[s.legendPct, { color: emo ? tintaEmo(emo) : colors.titulo }]}>{pct}%</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <Text style={s.registrosTxt}>
                    Você fez registros em <Text style={s.registrosBold}>{mesal.com}</Text> de <Text style={s.registrosBold}>{mesal.totalDias}</Text> dias deste mês.
                  </Text>
                </View>

                {/* Seção 2 — Suas emoções nas áreas da vida */}
                <View style={s.card}>
                  <TituloCartao num="2">Suas emoções nas áreas da vida</TituloCartao>
                  <AreasDaVida areas={mesal.areaData} largo={largo} />
                  <Text style={s.areasSummaryTxt}>
                    A soma dos registros nas áreas é{' '}
                    <Text style={s.registrosBold}>{mesal.areaData.reduce((acc, a) => acc + a.total, 0)}</Text> dias
                    {' '}(cada check-in conta para a área escolhida).
                  </Text>
                </View>

                {/* Seção 3 — Pequenas Vitórias */}
                {vitoriasMes.length > 0 && (
                  <View style={s.card}>
                    <TituloCartao num="3">
                      {tituloVitorias(agruparVitorias(vitoriasMes).length)}
                    </TituloCartao>
                    <VitoriasDestaque itens={agruparVitorias(vitoriasMes)} />
                    {vitoriasMes.length > 0 && (
                      <Text style={s.vitMore}>
                        {vitoriasMes.length} conquista{vitoriasMes.length === 1 ? '' : 's'} registrada{vitoriasMes.length === 1 ? '' : 's'} este mês
                      </Text>
                    )}
                  </View>
                )}

                {/* Calendário emocional — Plan 1+ */}
                {temPlano1 && (
                  <View style={s.card}>
                    <TituloCartao>Calendário emocional</TituloCartao>
                    <Text style={s.cardSub}>Toque num dia marcado para ver o check-in</Text>
                    <View style={s.calNavRow}>
                      <TouchableOpacity style={s.calNavBtn} onPress={() => handleCalNav(-1)} accessibilityLabel="Mês anterior">
                        <Ionicons name="chevron-back" size={18} color={colors.lilasIcone} />
                      </TouchableOpacity>
                      <Text style={s.calNavTitle}>{MONTH_NAMES[calMes]} {calAno}</Text>
                      <TouchableOpacity
                        style={[s.calNavBtn, (calAno === year && calMes >= month) && { opacity: 0.45 }]}
                        onPress={() => handleCalNav(1)}
                        disabled={calAno === year && calMes >= month}
                        accessibilityLabel="Próximo mês"
                      >
                        <Ionicons name="chevron-forward" size={18} color={colors.lilasIcone} />
                      </TouchableOpacity>
                    </View>
                    <View style={{ marginTop: 8 }}>
                      <CalendarGrid year={calAno} month={calMes} checkinsByDate={mesal.byDate} onDayPress={handleDayPress} />
                    </View>
                    <View style={s.calLegend}>
                      {mesal.sorted.slice(0, 4).map(([id], i) => {
                        const emo = getEmoObj(id);
                        return (
                          <View key={id} style={s.legendRow}>
                            <View style={[s.legendDot, { backgroundColor: dadoEmo(emo, i) }]} />
                            <Text style={s.legendTxtCurto}>{emo?.label || id}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Mensagem */}
                <View style={[s.card, s.msgCard]}>
                  <Text style={s.msgTxt}>{mensagem(mesal.dominante)}</Text>
                  <View style={s.msgRodape}>
                    <Ionicons name="leaf-outline" size={13} color={colors.lilasTexto} />
                    <Text style={s.msgRodapeTxt}>Atravessia</Text>
                  </View>
                </View>

                <ExportarPdf onPress={handleExportar} exportando={exportando} />
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════ RELATÓRIO ANUAL ═══════════════════ */}
        {tab === 'anual' && (
          <>
            {!temAcesso(1) ? (
              <View style={[s.card, s.lockedAnnual]}>
                <View style={s.periodoIconWrap}>
                  <Ionicons name="bar-chart-outline" size={34} color={colors.lilasIcone} />
                </View>
                <Text style={s.lockedAnnualTit}>Relatório Anual</Text>
                <Text style={s.lockedAnnualDesc}>
                  Veja sua jornada emocional completa do ano — emoções ao longo do ano, distribuição por trimestre, constância e muito mais.
                </Text>
                <Text style={s.lockedAnnualBadge}>Disponível no Plano Acolher</Text>
                <BotaoLuz titulo="Ver planos" onPress={() => navigation.navigate('Planos')} style={s.btnCentro} />
              </View>
            ) : (
              <>
                {/* Cabeçalho anual */}
                <View style={s.reportHeader}>
                  <Image source={logo} style={s.reportLogo} resizeMode="contain" />
                  <Text style={s.reportTitle}>RELATÓRIO ANUAL</Text>
                  <View style={s.reportMes}>
                    <Ionicons name="calendar-outline" size={14} color={colors.lilasTexto} />
                    <Text style={s.reportMesTxt}>{year}</Text>
                  </View>
                  <Text style={s.reportSub}>Sua jornada emocional do ano</Text>
                  <ExportarPdf compacto onPress={handleExportar} exportando={exportando} />
                </View>

                {/* Tiles de estatística */}
                <View style={s.tilesRow}>
                  {[
                    { icon: 'calendar-outline', v: anual.total, lbl: 'check-ins realizados', acento: acentoLilas() },
                    { icon: 'heart-outline', v: anual.uniqueDays, lbl: 'dias com registro', acento: acentoPessego() },
                    { icon: 'star-outline', v: `${anual.consistencia}%`, lbl: 'de constância', acento: acentoDourado() },
                  ].map((t, i) => (
                    <View key={i} style={s.tile}>
                      <View style={[s.tileIcone, { backgroundColor: t.acento.fundo }]}>
                        <Ionicons name={t.icon} size={18} color={t.acento.tinta} />
                      </View>
                      <Text style={[s.tileNum, { color: t.acento.texto }]}>{t.v}</Text>
                      <Text style={s.tileLbl}>{t.lbl}</Text>
                    </View>
                  ))}
                </View>

                {/* 1. Emoções do ano */}
                <View style={s.card}>
                  <TituloCartao num="1">Emoções do ano</TituloCartao>
                  <View style={s.donutRow}>
                    <DonutChart data={anual.donut} size={tamanhoRosca} thickness={largo ? 34 : 26} total={anual.total} label="registros" />
                    <View style={[s.donutLegend, largo && s.donutLegendLargo]}>
                      {anual.sorted.slice(0, 7).map(([id, v], i) => {
                        const emo = getEmoObj(id);
                        const pct = Math.round((v / anual.total) * 100);
                        return (
                          <View key={id} style={s.legendRow}>
                            <View style={[s.legendDot, { backgroundColor: dadoEmo(emo, i) }]} />
                            <Text style={s.legendTxt} numberOfLines={1}>{emo?.label || id}</Text>
                            <Text style={[s.legendPct, { color: emo ? tintaEmo(emo) : colors.titulo }]}>{pct}%</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Suas emoções nas áreas da vida — anual */}
                <View style={s.card}>
                  <TituloCartao num="2">Suas emoções nas áreas da vida</TituloCartao>
                  <AreasDaVida areas={anual.areaData} largo={largo} />
                  <Text style={s.areasSummaryTxt}>
                    Total de registros por área ao longo do ano.
                  </Text>
                </View>

                {/* 3. Distribuição por trimestre */}
                <View style={s.card}>
                  <TituloCartao num="3">Distribuição por trimestre</TituloCartao>
                  {['1º Trimestre','2º Trimestre','3º Trimestre','4º Trimestre'].map((label, i) => (
                    <View key={i} style={s.trimRow}>
                      <Text style={s.trimLabel}>{label}</Text>
                      <View style={s.trimTrack}>
                        <View style={[s.trimFill, { width: `${anual.trimPct[i]}%`, backgroundColor: TRIM_CORES[i] }]} />
                      </View>
                      <Text style={s.trimPct}>{anual.trimPct[i]}%</Text>
                    </View>
                  ))}
                </View>

                {vitoriasAno.length > 0 && (
                  <View style={s.card}>
                    <TituloCartao num="⭐">
                      {tituloVitorias(agruparVitorias(vitoriasAno).length)}
                    </TituloCartao>
                    <VitoriasDestaque itens={agruparVitorias(vitoriasAno)} />
                    {vitoriasAno.length > 0 && (
                      <Text style={s.vitMore}>
                        {vitoriasAno.length} conquista{vitoriasAno.length === 1 ? '' : 's'} registrada{vitoriasAno.length === 1 ? '' : 's'} este ano
                      </Text>
                    )}
                  </View>
                )}

                {/* 3. Mensagem anual */}
                <View style={[s.card, s.msgCard]}>
                  <TituloCartao num="3">Mensagem para você</TituloCartao>
                  <Text style={s.msgTxt}>
                    Você atravessou altos e baixos, dias leves e dias desafiadores. Cada emoção registrada mostra sua coragem de olhar para dentro. Que o próximo ano seja cheio de leveza, autoconhecimento e cuidado com você.
                  </Text>
                  <View style={s.msgRodape}>
                    <Ionicons name="leaf-outline" size={13} color={colors.lilasTexto} />
                    <Text style={s.msgRodapeTxt}>Atravessia</Text>
                  </View>
                </View>

                <ExportarPdf onPress={handleExportar} exportando={exportando} />
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════ RELATÓRIO PERSONALIZADO ═══════ */}
        {tab === 'personalizado' && (
          <>
            {/* Datas — sempre visíveis */}
            <View style={s.card}>
              <TituloCartao>Defina o período</TituloCartao>
              <Text style={s.cardSub}>Selecione o intervalo de datas para gerar o relatório</Text>
              <View style={s.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.dateLabel}>Início</Text>
                  <TextInput
                    style={s.dateInput}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={colors.tl}
                    value={rangeInicio}
                    onChangeText={t => setRangeInicio(formatarData(t))}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
                <View style={s.dateSeta}>
                  <Ionicons name="arrow-forward" size={16} color={colors.lilasIcone} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.dateLabel}>Fim</Text>
                  <TextInput
                    style={s.dateInput}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={colors.tl}
                    value={rangeFim}
                    onChangeText={t => setRangeFim(formatarData(t))}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>
            </View>

            {!(perfil?.periodoCreditos > 0) ? (
              <View style={[s.card, s.lockedAnnual]}>
                <View style={s.periodoIconWrap}>
                  <Ionicons name="calendar-outline" size={34} color={colors.lilasIcone} />
                </View>
                <Text style={s.lockedAnnualTit}>Relatório por Período</Text>
                <Text style={s.lockedAnnualDesc}>
                  Primeiro defina o período acima. Com as datas escolhidas, você adquire um crédito
                  e gera o relatório desse intervalo.
                </Text>

                {/* O relatório por período é uma compra avulsa: disponível em qualquer plano. */}
                {(
                  <View style={s.stripeWrap}>
                    <View style={s.stripePriceCard}>
                      <Text style={s.stripePriceTxt}>{precoPeriodoTxt}</Text>
                      <Text style={s.stripePriceSub}>por relatório gerado</Text>
                    </View>
                    <View style={[s.periodoStatus, periodo.ok ? s.periodoStatusOk : null]}>
                      <Ionicons
                        name={periodo.ok ? 'checkmark-circle' : 'information-circle-outline'}
                        size={18}
                        color={periodo.ok ? colors.sageFg : colors.lilasTexto}
                      />
                      <Text style={[s.periodoStatusTxt, periodo.ok && { color: colors.sageFg }]}>
                        {periodo.ok
                          ? `${periodo.total} check-in${periodo.total === 1 ? '' : 's'} em ${periodo.dias} dia${periodo.dias === 1 ? '' : 's'} nesse período — pronto para gerar.`
                          : periodo.motivo}
                      </Text>
                    </View>
                    <UsarCashback ativo={usarCashback} onChange={setUsarCashback} />
                    <BotaoLuz
                      titulo={comprando ? 'Abrindo pagamento...' : `Obter 1 relatório por ${precoPeriodoTxt}`}
                      iconeEsq="card-outline"
                      onPress={handleDesbloquear}
                      desabilitado={comprando || !periodo.ok}
                    />
                    <Text style={s.stripeHint}>
                      Após o pagamento, volte aqui. Seu crédito será liberado automaticamente.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <>
                <View style={{ marginBottom: spacing.lg }}>
                  <BotaoLuz titulo="Gerar relatório" iconeEsq="bar-chart-outline" onPress={handleGerarRange} />
                </View>

                {rangeData && (
                  <>
                    <View style={s.reportHeader}>
                      <Image source={logo} style={s.reportLogo} resizeMode="contain" />
                      <Text style={s.reportTitle}>RELATÓRIO PERSONALIZADO</Text>
                      <View style={s.reportMes}>
                        <Ionicons name="calendar-outline" size={14} color={colors.lilasTexto} />
                        <Text style={s.reportMesTxt}>{rangeInicio} → {rangeFim}</Text>
                      </View>
                      <ExportarPdf compacto onPress={handleExportar} exportando={exportando} />
                    </View>

                    <View style={s.tilesRow}>
                      {[
                        { icon: 'calendar-outline', v: rangeData.total, lbl: 'check-ins no período', acento: acentoLilas() },
                        { icon: 'today-outline', v: rangeData.uniqueDays, lbl: 'dias com registro', acento: acentoPessego() },
                      ].map((t, i) => (
                        <View key={i} style={s.tile}>
                          <View style={[s.tileIcone, { backgroundColor: t.acento.fundo }]}>
                            <Ionicons name={t.icon} size={18} color={t.acento.tinta} />
                          </View>
                          <Text style={[s.tileNum, { color: t.acento.texto }]}>{t.v}</Text>
                          <Text style={s.tileLbl}>{t.lbl}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={s.card}>
                      <TituloCartao num="1">Emoções no período</TituloCartao>
                      <View style={s.donutRow}>
                        <DonutChart data={rangeData.donut} size={tamanhoRosca} thickness={largo ? 34 : 26} total={rangeData.total} label="registros" />
                        <View style={[s.donutLegend, largo && s.donutLegendLargo]}>
                          {rangeData.sorted.slice(0, 7).map(([id, v], i) => {
                            const emo = getEmoObj(id);
                            const pct = Math.round((v / rangeData.total) * 100);
                            return (
                              <View key={id} style={s.legendRow}>
                                <View style={[s.legendDot, { backgroundColor: dadoEmo(emo, i) }]} />
                                <Text style={s.legendTxt} numberOfLines={1}>{emo?.label || id}</Text>
                                <Text style={[s.legendPct, { color: emo ? tintaEmo(emo) : colors.titulo }]}>{pct}%</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>

                    {/* Áreas da vida — período */}
                    {rangeData.areaData && (
                      <View style={s.card}>
                        <TituloCartao num="2">Suas emoções nas áreas da vida</TituloCartao>
                        <AreasDaVida areas={rangeData.areaData} largo={largo} />
                        <Text style={s.areasSummaryTxt}>
                          Total de registros por área no período selecionado.
                        </Text>
                      </View>
                    )}

                    {rangeData.dominante && (
                      <View style={s.card}>
                        <TituloCartao num="3">Emoção predominante</TituloCartao>
                        {(() => {
                          const emo = getEmoObj(rangeData.dominante);
                          return (
                            <View style={s.predominRow}>
                              <View style={[s.predominCircle, { backgroundColor: veuEmo(emo) }]}>
                                <Ionicons name={`${emo?.icon || 'heart'}-outline`} size={28} color={tintaEmo(emo)} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[s.predominNome, { color: tintaEmo(emo) }]}>{emo?.label || rangeData.dominante}</Text>
                                <Text style={s.predominDesc}>foi a emoção mais presente no período.</Text>
                              </View>
                            </View>
                          );
                        })()}
                      </View>
                    )}

                    {vitoriasRange.length > 0 && (
                      <View style={s.card}>
                        <TituloCartao num="⭐">
                          {tituloVitorias(agruparVitorias(vitoriasRange).length)}
                        </TituloCartao>
                        <VitoriasDestaque itens={agruparVitorias(vitoriasRange)} />
                        {vitoriasRange.length > 0 && (
                          <Text style={s.vitMore}>
                            {vitoriasRange.length} conquista{vitoriasRange.length === 1 ? '' : 's'} registrada{vitoriasRange.length === 1 ? '' : 's'} no período
                          </Text>
                        )}
                      </View>
                    )}

                    <View style={[s.card, s.msgCard]}>
                      <TituloCartao>Mensagem para você</TituloCartao>
                      <Text style={s.msgTxt}>Cada emoção registrada neste período é uma janela de autoconhecimento. Você teve coragem de olhar para dentro e nomear o que sentia. Continue se cuidando.</Text>
                      <View style={s.msgRodape}>
                        <Ionicons name="leaf-outline" size={13} color={colors.lilasTexto} />
                        <Text style={s.msgRodapeTxt}>Atravessia</Text>
                      </View>
                    </View>

                    <ExportarPdf onPress={handleExportar} exportando={exportando} />
                  </>
                )}
              </>
            )}
          </>
        )}

      </ScrollView>

      {/* Modal de detalhe do dia */}
      <Modal
        visible={dayModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDayModal(null)}
      >
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setDayModal(null)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              {dayModal?.date ? dayModal.date.split('-').reverse().join('/') : ''}
            </Text>
            {dayModal?.checkins.map((c, i) => {
              const emo = getEmoObj(c.emocao);
              return (
                <View key={i} style={s.modalRow}>
                  <View style={[s.modalGota, { backgroundColor: veuEmo(emo) }]}>
                    <Ionicons name={`${emo?.icon || 'heart'}-outline`} size={16} color={tintaEmo(emo)} />
                  </View>
                  <Text style={s.modalEmo}>{emo?.label || c.emocao}</Text>
                </View>
              );
            })}
            <TouchableOpacity onPress={() => setDayModal(null)} style={s.modalCloseBtn}>
              <Text style={s.modalCloseTxt}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Peças visuais "Luz de Vidro" ─────────────────────────────────────────────
const TRIM_CORES = ['#A595DC', '#E39A72', '#6E9B7E', '#C9A15A'];
const acentoLilas = () => ({ fundo: colors.lav1, tinta: colors.lilasIcone, texto: colors.lilasTexto });
const acentoPessego = () => ({
  fundo: colors.escuro ? 'rgba(242,183,158,0.14)' : '#FCE7DC',
  tinta: colors.escuro ? '#F2B79E' : '#D98A69',
  texto: colors.roseFg,
});
const acentoDourado = () => ({ fundo: colors.douradoFundo, tinta: colors.escuro ? '#E5C68B' : '#C9A15A', texto: colors.douradoTitulo });

// Título de cartão com o número da seção numa pílula.
function TituloCartao({ num, children }) {
  return (
    <View style={s.tituloLinha}>
      {num ? <View style={s.numPilula}><Text style={s.numTxt}>{num}</Text></View> : null}
      <Text style={s.cardTit}>{children}</Text>
    </View>
  );
}

// Ilustração da marca numa moldura arredondada (sem tintColor).
function Moldura({ source, tamanho = 96 }) {
  const extra = Math.round(tamanho * 0.1);
  return (
    <View style={[s.moldura, { width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.26) }]}>
      <Image source={source} style={{ width: tamanho + extra * 2, height: tamanho + extra * 2, margin: -extra }} resizeMode="cover" />
    </View>
  );
}

// Botão principal: degradê lilás com degrau que afunda ao toque.
function BotaoLuz({ titulo, onPress, icone, iconeEsq, desabilitado, style }) {
  return (
    <Profundo
      externo={[s.btnExterno, style, desabilitado && { opacity: 0.45 }]}
      estilo={s.btnFace}
      base={colors.botaoBase}
      sombra={s.btnHalo}
      onPress={desabilitado ? undefined : onPress}
      accessibilityLabel={titulo}
    >
      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {iconeEsq ? <Ionicons name={iconeEsq} size={17} color="white" /> : null}
      <Text style={s.btnTxt} numberOfLines={2}>{titulo}</Text>
      {icone ? <Ionicons name={icone} size={17} color="white" /> : null}
    </Profundo>
  );
}

// Botão "Exportar PDF" bem à vista em cada relatório gerado: pílula de vidro
// no cabeçalho (compacto) e botão principal no fim do relatório.
function ExportarPdf({ onPress, exportando, compacto }) {
  const titulo = exportando ? 'Gerando PDF...' : 'Exportar PDF';
  if (compacto) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={exportando}
        activeOpacity={0.8}
        style={[s.pdfChip, exportando && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Exportar relatório em PDF"
      >
        <Ionicons name={exportando ? 'hourglass-outline' : 'document-text-outline'} size={16} color={colors.lilasTexto} />
        <Text style={s.pdfChipTxt}>{titulo}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={s.pdfFim}>
      <BotaoLuz titulo={titulo} iconeEsq={exportando ? 'hourglass-outline' : 'document-text-outline'} onPress={onPress} desabilitado={exportando} />
      <Text style={s.pdfFimTxt}>Salve ou compartilhe este relatório em PDF.</Text>
    </View>
  );
}

// Cartão de vidro: véu translúcido, borda de luz e sombra ameixa suave.
const vidro = () => ({
  backgroundColor: colors.card,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: colors.bordaLuz,
  shadowColor: colors.sombra,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: colors.escuro ? 0.28 : 0.11,
  shadowRadius: 20,
  elevation: 2,
});

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: spacing.lg, paddingBottom: 10 },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: colors.escuro ? 0.25 : 0.08, shadowRadius: 10, elevation: 2,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.titulo },

  tabRow: {
    flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.vidro, borderRadius: radius.full, padding: 4,
    borderWidth: 1, borderColor: colors.bordaLuz,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: radius.full, gap: 5 },
  tabSel: {
    backgroundColor: colors.escuro ? colors.lav2 : colors.cardSolido,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 3 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 8, elevation: 2,
  },
  tabTxt: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.texto2 },
  tabTxtSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },

  reportLogo: { width: 54, height: 54, marginBottom: 10, borderRadius: 16 },
  reportHeader: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.lg },
  reportTitle: { fontFamily: 'Figtree_800ExtraBold', fontSize: 17, color: colors.titulo, letterSpacing: 1.6, textAlign: 'center' },
  reportMes: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: colors.lav1, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5,
  },
  reportMesTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lilasTexto, letterSpacing: 0.5 },
  reportSub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, marginTop: 8 },
  pdfChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14, minHeight: 44,
    paddingHorizontal: 18, borderRadius: radius.full,
    backgroundColor: colors.vidroForte, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: colors.escuro ? 0.25 : 0.1, shadowRadius: 10, elevation: 2,
  },
  pdfChipTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  pdfFim: { marginTop: spacing.sm, marginBottom: spacing.md, gap: 8 },
  pdfFimTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.texto2, textAlign: 'center' },

  card: { ...vidro(), marginBottom: spacing.md, padding: 18 },
  tituloLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  numPilula: { width: 28, height: 28, borderRadius: 10, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  numTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lilasTexto },
  vitMore: { fontFamily: fonts.body, fontSize: 12, color: colors.texto2, marginTop: 10 },
  cardTit: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 24, color: colors.titulo },
  cardSub: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginBottom: 4 },
  moldura: { overflow: 'hidden', borderWidth: 1, borderColor: colors.bordaLuz, backgroundColor: colors.cardSolido },

  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 12 },
  donutLegend: { flex: 1, gap: 8 },
  donutLegendLargo: { maxWidth: 420, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendTxt: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.titulo },
  legendTxtCurto: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.titulo },
  legendPct: { fontFamily: fonts.bodyBold, fontSize: 13 },

  calLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.bordaSuave },

  predominRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  predominCircle: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  predominNome: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 32 },
  predominDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2 },

  msgCard: { backgroundColor: colors.lavVeu },
  msgTxt: { fontFamily: fonts.quote, fontSize: 20, color: colors.lilasTexto, lineHeight: 28, marginTop: 6 },
  msgRodape: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, justifyContent: 'flex-end' },
  msgRodapeTxt: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.lilasTexto },

  emptyBox: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: spacing.xl, gap: 4 },
  emptyTxt: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.titulo, marginTop: 14, textAlign: 'center' },
  emptyHint: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2, textAlign: 'center' },

  tilesRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  tile: { ...vidro(), flex: 1, alignItems: 'center', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 6, gap: 4 },
  tileIcone: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tileNum: { fontFamily: 'Figtree_800ExtraBold', fontSize: 26, lineHeight: 30 },
  tileLbl: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.texto2, textAlign: 'center' },

  trimRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 },
  trimLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.titulo, width: 104 },
  trimTrack: { flex: 1, height: 10, backgroundColor: colors.lav1, borderRadius: 5, overflow: 'hidden' },
  trimFill: { height: '100%', borderRadius: 5 },
  trimPct: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.titulo, width: 40, textAlign: 'right' },

  pricingTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.titulo, marginTop: spacing.lg, marginBottom: spacing.sm, textAlign: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: spacing.md },
  dateSeta: { width: 32, height: 48, alignItems: 'center', justifyContent: 'center' },
  dateLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2, marginBottom: 6 },
  dateInput: {
    backgroundColor: colors.cardSolido, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, minHeight: 48,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.titulo,
  },

  lockedAnnual: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  lockedAnnualTit: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.titulo, marginTop: 14, textAlign: 'center' },
  lockedAnnualDesc: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  lockedAnnualBadge: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lilasTexto, marginTop: 16, backgroundColor: colors.lav1, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, overflow: 'hidden' },
  // Botão central de tamanho fixo: no tablet ele esticava e ficava desproporcional.
  btnCentro: { alignSelf: 'center', width: 280, maxWidth: '100%', flexGrow: 0, flexShrink: 0, marginTop: 20 },

  periodoIconWrap: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  stripeWrap: { alignSelf: 'stretch', marginTop: spacing.lg, gap: 12 },
  stripePriceCard: { backgroundColor: colors.lavVeu, borderRadius: 20, padding: spacing.lg, alignItems: 'center', gap: 4 },
  stripePriceTxt: { fontFamily: 'Figtree_800ExtraBold', fontSize: 34, lineHeight: 40, color: colors.lilasTexto },
  stripePriceSub: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.texto2 },
  periodoStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', padding: 12, borderRadius: 16, backgroundColor: colors.lav1 },
  periodoStatusOk: { backgroundColor: colors.sageFundo },
  periodoStatusTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.lilasTexto, lineHeight: 18 },
  stripeHint: { fontFamily: fonts.body, fontSize: 12, color: colors.texto2, textAlign: 'center', lineHeight: 17 },

  // Largura total no celular; no tablet para em 520 (não estica a tela inteira).
  btnExterno: { alignSelf: 'center', width: '100%', maxWidth: 520 },
  btnFace: { flexGrow: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, maxHeight: 72, paddingHorizontal: 22, paddingVertical: 10, overflow: 'hidden' },
  btnHalo: { shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 4 },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white, textAlign: 'center', flexShrink: 1 },

  registrosTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 14, lineHeight: 19 },
  registrosBold: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
  areasSummaryTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.texto2, marginTop: 2, lineHeight: 17 },
  calNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 4 },
  calNavBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lav1 },
  calNavTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo },

  modalOverlay: { flex: 1, backgroundColor: colors.sobreposicao, alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard: { backgroundColor: colors.cardSolido, borderRadius: 24, padding: spacing.lg, width: '100%', maxWidth: 340, gap: 8, borderWidth: 1, borderColor: colors.bordaLuz },
  modalTitle: { fontFamily: fonts.serif, fontSize: 26, color: colors.titulo, marginBottom: 4 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  modalGota: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  modalEmo: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.titulo },
  modalCloseBtn: { marginTop: 8, alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 28, backgroundColor: colors.lav1, borderRadius: radius.full },
  modalCloseTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
}));
