import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Dimensions, Alert, Platform, Image, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc, increment } from 'firebase/firestore';
import * as WebBrowser from 'expo-web-browser';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, fonts, spacing, radius } from '../../theme';
import { emocoes } from '../../data';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { LavandaBg } from '../../components';
import { functions, db } from '../../services/firebase';


const { width: SCREEN_W } = Dimensions.get('window');
const logo = require('../../../assets/images/travessia_logo.png');
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
        {/* Fundo cinza */}
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
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 22, color: colors.lav4 }}>{total}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 9, color: colors.tl }}>{label}</Text>
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
          if (!d) return <View key={`e${i}`} style={cs.cell} />;
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const emo = checkinsByDate[key];
          const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const isFuture = new Date(year, month, d) > today;
          const cellStyle = [
            cs.cell,
            emo && { backgroundColor: emo.color + '55' },
            isToday && { borderWidth: 1.5, borderColor: colors.lav4 },
            isFuture && { opacity: 0.3 },
          ];
          const dayText = <Text style={[cs.dayNum, emo && { color: emo.color }, isToday && { fontFamily: fonts.bodyBold }]}>{d}</Text>;
          if (emo && onDayPress && !isFuture) {
            return (
              <TouchableOpacity key={d} style={cellStyle} onPress={() => onDayPress(key)} activeOpacity={0.7}>
                {dayText}
              </TouchableOpacity>
            );
          }
          return <View key={d} style={cellStyle}>{dayText}</View>;
        })}
      </View>
    </View>
  );
}

const cs = StyleSheet.create({
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  dayLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 9, color: colors.lav4 },
  dayNum: { fontFamily: fonts.body, fontSize: 10, color: colors.tl },
});

// ── Helpers de dados ──────────────────────────────────────────────────────────
function getEmoObj(id) { return emocoes.find(e => e.id === id); }

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

function calcRange(checkins, inicio, fim) {
  const [diI, meI, anoI] = inicio.split('/').map(Number);
  const [diF, meF, anoF] = fim.split('/').map(Number);
  const dStart = new Date(anoI, meI - 1, diI);
  const dEnd = new Date(anoF, meF - 1, diF, 23, 59, 59);
  if (isNaN(dStart) || isNaN(dEnd) || dStart > dEnd) return [];
  return checkins.filter(c => {
    const d = new Date(c.data);
    return d >= dStart && d <= dEnd;
  });
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
      id, value: v, color: getEmoObj(id)?.color || EMO_CHART_COLORS[(li * 4 + i) % EMO_CHART_COLORS.length],
    }));
    return { ...loc, sorted, total, donut };
  });
}

function AreaDonutCard({ area }) {
  const empty = area.total === 0;
  const chartData = empty ? [{ value: 1, color: colors.lav2 }] : area.donut;
  return (
    <View style={areaStyles.card}>
      <View style={areaStyles.header}>
        <Ionicons name={area.icon} size={13} color={colors.lav5} />
        <Text style={areaStyles.name} numberOfLines={2}>{area.label}</Text>
      </View>
      <DonutChart data={chartData} size={90} thickness={16} total={empty ? 0 : area.total} label="reg." />
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

const areaStyles = StyleSheet.create({
  card: { width: 155, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10, alignItems: 'center', gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  name: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.td, flex: 1 },
  breakdown: { alignSelf: 'stretch', gap: 3 },
  emoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  emoName: { flex: 1, fontFamily: fonts.body, fontSize: 10, color: colors.td },
  emoPct: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.tm },
  empty: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, textAlign: 'center', paddingVertical: 4 },
  total: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.lav4, alignSelf: 'flex-end' },
});

// ── Cores para emoções no gráfico ─────────────────────────────────────────────
const EMO_CHART_COLORS = [
  colors.lav4, colors.rose, colors.sage, colors.gold,
  colors.azulNevoa, colors.peach, '#CDB9A6', colors.lav3,
  '#B0C4B1', colors.lav6, colors.lav5, '#D8B4B6',
];

// ── Gerador de HTML para PDF ─────────────────────────────────────────────────
const BOTANICA_WATERMARK = `
<div style="position:absolute;top:-20px;right:-25px;opacity:0.13;pointer-events:none;z-index:0">
  <svg width="190" height="260" viewBox="0 0 120 220" xmlns="http://www.w3.org/2000/svg">
    <line x1="60" y1="220" x2="60" y2="32" stroke="#8B7AC0" stroke-width="2"/>
    <ellipse cx="60" cy="22" rx="8" ry="14" fill="#9B8AD0"/>
    <ellipse cx="47" cy="42" rx="7" ry="11" fill="#AB9ADF" transform="rotate(-22 47 42)"/>
    <ellipse cx="73" cy="42" rx="7" ry="11" fill="#AB9ADF" transform="rotate(22 73 42)"/>
    <ellipse cx="43" cy="65" rx="6" ry="10" fill="#BB99E0" transform="rotate(-28 43 65)"/>
    <ellipse cx="77" cy="65" rx="6" ry="10" fill="#BB99E0" transform="rotate(28 77 65)"/>
    <ellipse cx="37" cy="140" rx="18" ry="8" fill="#B8C5A0" transform="rotate(-38 37 140)"/>
    <ellipse cx="83" cy="140" rx="18" ry="8" fill="#B8C5A0" transform="rotate(38 83 140)"/>
    <ellipse cx="42" cy="168" rx="15" ry="7" fill="#B8C5A0" transform="rotate(-26 42 168)"/>
    <ellipse cx="78" cy="168" rx="15" ry="7" fill="#B8C5A0" transform="rotate(26 78 168)"/>
  </svg>
</div>
<div style="position:absolute;bottom:30px;left:-22px;opacity:0.09;pointer-events:none;z-index:0;transform:scaleX(-1) rotate(15deg)">
  <svg width="140" height="190" viewBox="0 0 120 220" xmlns="http://www.w3.org/2000/svg">
    <line x1="60" y1="220" x2="60" y2="32" stroke="#8B7AC0" stroke-width="2"/>
    <ellipse cx="60" cy="22" rx="8" ry="14" fill="#9B8AD0"/>
    <ellipse cx="47" cy="42" rx="7" ry="11" fill="#AB9ADF" transform="rotate(-22 47 42)"/>
    <ellipse cx="73" cy="42" rx="7" ry="11" fill="#AB9ADF" transform="rotate(22 73 42)"/>
    <ellipse cx="43" cy="65" rx="6" ry="10" fill="#BB99E0" transform="rotate(-28 43 65)"/>
    <ellipse cx="77" cy="65" rx="6" ry="10" fill="#BB99E0" transform="rotate(28 77 65)"/>
    <ellipse cx="37" cy="140" rx="18" ry="8" fill="#B8C5A0" transform="rotate(-38 37 140)"/>
    <ellipse cx="83" cy="140" rx="18" ry="8" fill="#B8C5A0" transform="rotate(38 83 140)"/>
  </svg>
</div>`;

function gerarInsightsMensais(mesal, diasPassados) {
  if (mesal.total === 0) return [];
  const insights = [];
  const pctDias = diasPassados > 0 ? Math.round((mesal.com / diasPassados) * 100) : 0;
  const emoObj = getEmoObj(mesal.dominante);

  if (pctDias >= 80) {
    insights.push({ tipo: 'positivo', icone: '⭐', titulo: 'Constância admirável', texto: `Você registrou ${mesal.com} de ${diasPassados} dias deste mês (${pctDias}%). Esse comprometimento com o autoconhecimento é um ato genuíno de cuidado consigo mesm@.` });
  } else if (pctDias >= 50) {
    insights.push({ tipo: 'neutro', icone: '📅', titulo: 'Boa frequência de registros', texto: `Você registrou ${mesal.com} de ${diasPassados} dias passados (${pctDias}%). Tente incluir o check-in nos dias sem registro para uma análise ainda mais completa.` });
  } else if (mesal.com > 0) {
    insights.push({ tipo: 'dica', icone: '💡', titulo: 'Continue registrando', texto: `Você registrou ${mesal.com} dia(s) este mês. Cada check-in, mesmo nos dias difíceis, é uma forma de cuidado próprio. Tente tornar esse hábito parte da rotina.` });
  }

  if (emoObj) {
    if (emoObj.positiva) {
      insights.push({ tipo: 'positivo', icone: '💜', titulo: `${emoObj.label} em destaque`, texto: `${emoObj.label} foi a emoção mais presente este mês. Identificar e acolher sentimentos positivos é parte essencial da jornada de cura.` });
    } else {
      const nomeEmo = emoObj.nomeRelatorio || emoObj.label.toLowerCase();
      insights.push({ tipo: 'acolhimento', icone: '🤍', titulo: `Atravessando ${nomeEmo}`, texto: `${emoObj.label} foi sua emoção mais frequente este mês. Sentir isso é natural no processo de luto — nomear o que você sente é o primeiro passo para atravessá-lo.` });
    }
  }

  if (mesal.sorted.length >= 5) {
    insights.push({ tipo: 'neutro', icone: '🎨', titulo: 'Alta consciência emocional', texto: `Você identificou ${mesal.sorted.length} emoções diferentes este mês. Essa riqueza de percepção mostra que está desenvolvendo um olhar mais atento para o que sente.` });
  }

  return insights;
}

function gerarInsightsAnuais(anual) {
  if (anual.total === 0) return [];
  const insights = [];
  const dominante = anual.sorted[0]?.[0];
  const emoObj = getEmoObj(dominante);

  if (anual.consistencia >= 70) {
    insights.push({ tipo: 'positivo', icone: '🏆', titulo: 'Constância ao longo do ano', texto: `Você registrou ${anual.uniqueDays} dias únicos — ${anual.consistencia}% de constância anual. Esse comprometimento ao longo de meses inteiros é extraordinário.` });
  } else if (anual.consistencia >= 40) {
    insights.push({ tipo: 'neutro', icone: '📅', titulo: 'Presença ao longo do ano', texto: `Você manteve registros em ${anual.uniqueDays} dias no ano (${anual.consistencia}% de constância). Cada período registrado conta uma parte importante da sua jornada.` });
  } else {
    insights.push({ tipo: 'dica', icone: '💡', titulo: 'Construa o hábito em doses', texto: `Você fez ${anual.total} check-ins este ano. No próximo período, tente pelo menos uma vez por semana — pequenos hábitos constantes constroem uma memória emocional muito valiosa.` });
  }

  if (emoObj) {
    if (emoObj.positiva) {
      insights.push({ tipo: 'positivo', icone: '💜', titulo: `${emoObj.label} marcou seu ano`, texto: `${emoObj.label} foi a emoção mais registrada no ano. Que ela continue sendo parte da sua jornada de cura.` });
    } else {
      const nomeEmo = emoObj.nomeRelatorio || emoObj.label.toLowerCase();
      insights.push({ tipo: 'acolhimento', icone: '🤍', titulo: `Um ano atravessando ${nomeEmo}`, texto: `${emoObj.label} foi sua emoção mais frequente do ano. Atravessar um ano inteiro com essa emoção presente exige uma coragem enorme — e você chegou até aqui.` });
    }
  }

  if (anual.total >= 100) {
    insights.push({ tipo: 'positivo', icone: '✨', titulo: `${anual.total} registros: um mapa emocional rico`, texto: `Mais de 100 check-ins neste ano! Seus dados formam um mapa detalhado de como você se sentiu ao longo dos meses — isso é autoconhecimento em ação.` });
  }

  return insights;
}

function gerarInsightsPeriodo(rangeData, diasPeriodo) {
  if (!rangeData || rangeData.total === 0) return [];
  const insights = [];
  const emoObj = getEmoObj(rangeData.dominante);
  const pctDias = diasPeriodo > 0 ? Math.round((rangeData.uniqueDays / diasPeriodo) * 100) : 0;

  if (pctDias >= 70) {
    insights.push({ tipo: 'positivo', icone: '⭐', titulo: 'Alta frequência no período', texto: `Você registrou ${rangeData.uniqueDays} de ${diasPeriodo} dias do período (${pctDias}%). Essa frequência fornece uma análise consistente da sua jornada emocional.` });
  } else {
    insights.push({ tipo: 'neutro', icone: '📅', titulo: 'Seus registros no período', texto: `Você fez ${rangeData.total} check-ins em ${rangeData.uniqueDays} dias dentro do período selecionado. Cada registro contribui para a sua análise emocional.` });
  }

  if (emoObj) {
    if (emoObj.positiva) {
      insights.push({ tipo: 'positivo', icone: '💜', titulo: `${emoObj.label} predominou`, texto: `${emoObj.label} foi a emoção mais registrada neste período. Identificar sentimentos positivos é parte fundamental da jornada de cura.` });
    } else {
      const nomeEmo = emoObj.nomeRelatorio || emoObj.label.toLowerCase();
      insights.push({ tipo: 'acolhimento', icone: '🤍', titulo: `Atravessando ${nomeEmo}`, texto: `${emoObj.label} foi a emoção mais frequente no período. Nomear e acolher esse sentimento é um ato de coragem e de autoconhecimento.` });
    }
  }

  return insights;
}

function renderInsightsHTML(insights) {
  if (!insights || !insights.length) return '';
  const corMap = {
    positivo: { bg: '#EDF7EE', border: '#7A9E7E', text: '#2D5A3D' },
    neutro: { bg: '#F0EDF8', border: '#8B7AC0', text: '#4A3D8A' },
    atencao: { bg: '#FFF5E6', border: '#E6A23C', text: '#7A5C14' },
    dica: { bg: '#E8F4FD', border: '#5BAFD6', text: '#1F5C7A' },
    acolhimento: { bg: '#FDF0F5', border: '#D4A8B5', text: '#7A3A5C' },
  };
  const cards = insights.map(ins => {
    const cor = corMap[ins.tipo] || corMap.neutro;
    return `<div style="background:${cor.bg};border:1px solid ${cor.border}77;border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px">
      <div style="font-size:18px;flex-shrink:0;line-height:1.4">${ins.icone}</div>
      <div>
        <div style="font-size:11px;font-weight:700;color:${cor.text};margin-bottom:3px">${ins.titulo}</div>
        <div style="font-size:11px;color:#555;line-height:1.6">${ins.texto}</div>
      </div>
    </div>`;
  }).join('');
  return `<div style="margin-top:16px;margin-bottom:16px;page-break-inside:avoid">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <div style="width:3px;height:18px;background:#8B7AC0;border-radius:2px;flex-shrink:0"></div>
      <span style="font-size:13px;font-weight:700;color:#4a4453">Interpretações e insights</span>
    </div>
    ${cards}
  </div>`;
}

function gerarDonutSVG(data, size = 120, thickness = 22) {
  const tot = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  let cum = 0;
  const circles = data.map((seg, i) => {
    const dash = (seg.value / tot) * circumference;
    const offset = -(cum / tot) * circumference;
    cum += seg.value;
    return `<circle cx="${cx}" cy="${cx}" r="${r}" stroke="${seg.color}" stroke-width="${thickness}"
      stroke-dasharray="${dash.toFixed(2)} ${circumference.toFixed(2)}"
      stroke-dashoffset="${offset.toFixed(2)}" fill="none"
      transform="rotate(-90 ${cx} ${cx})" />`;
  }).join('\n');
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cx}" r="${r}" stroke="#EDE9F5" stroke-width="${thickness}" fill="none" />
    ${circles}
  </svg>`;
}

function gerarCalendarioHTML(year, month, checkinsByDateMap) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const dias = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const header = dias.map(d => `<div style="text-align:center;font-weight:bold;font-size:9px;color:#8B7AC0">${d}</div>`).join('');
  const blanks = Array(firstDay).fill('<div></div>').join('');
  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const emo = checkinsByDateMap[key];
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const bg = emo ? emo.color + '55' : 'transparent';
    const border = isToday ? '1.5px solid #8B7AC0' : '1px solid transparent';
    return `<div style="text-align:center;font-size:10px;padding:4px 0;border-radius:4px;background:${bg};border:${border};color:${emo ? emo.color : '#888'}">${d}</div>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">
    ${header}${blanks}${cells}
  </div>`;
}

function gerarRelatorioMensalHTML({ mesal, usuario, month, year, MONTH_NAMES }) {
  const dataStr = `${MONTH_NAMES[month].toUpperCase()}/${year}`;
  const agoraStr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const nome = usuario?.apelido || usuario?.nome || 'você';
  const diasPassados = mesal.com + mesal.semRegistro;
  const insights = gerarInsightsMensais(mesal, diasPassados);
  const donutSVG = mesal.total > 0 ? gerarDonutSVG(mesal.donut, 130, 24) : '';
  const legendaEmocoes = mesal.sorted.map(([id, v], i) => {
    const emo = getEmoObj(id);
    const pct = Math.round((v / mesal.total) * 100);
    const cor = mesal.donut[i]?.color || '#aaa';
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <div style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0"></div>
      <span style="font-size:11px;color:#4a4453;flex:1">${emo?.label || id}</span>
      <span style="font-size:11px;font-weight:700;color:#4a4453">${pct}%</span>
    </div>`;
  }).join('');

  const calHtml = gerarCalendarioHTML(year, month, mesal.byDate);

  const emoObj = getEmoObj(mesal.dominante);
  const emoNome = emoObj?.label || '—';
  const emoCor = emoObj?.color || '#8B7AC0';

  const msgEmocao = (dominante) => {
    const e = getEmoObj(dominante);
    if (!e) return 'Continue fazendo seus registros. Cada check-in é um passo de autoconhecimento.';
    if (e.positiva) return `${e.label} esteve presente em você este mês. Guarde esse sentimento com carinho.`;
    const nomeEmo = e.nomeRelatorio || e.label.toLowerCase();
    return `Atravessando ${nomeEmo} — esse foi seu mês. Cada sentimento que você nomeia é um passo de cuidado. Você não precisa atravessar isso sozinho.`;
  };

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #4a4453; }
  .page { width: 794px; padding: 40px; position: relative; overflow: hidden; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #EDE9F5; padding-bottom: 16px; }
  .app-brand { display: flex; align-items: center; gap: 10px; }
  .app-name { font-family: Georgia, serif; font-style: italic; font-size: 22px; color: #5C4F8A; letter-spacing: 0.5px; }
  .app-sub { font-size: 10px; color: #8c8597; margin-top: 2px; }
  .report-title { text-align: right; }
  .report-title h1 { font-size: 26px; font-weight: 900; color: #5C4F8A; letter-spacing: 1px; }
  .report-title .mes-badge { display: inline-flex; align-items: center; gap: 6px; background: #EDE9F5; border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 700; color: #5C4F8A; margin-top: 6px; }
  .report-title p { font-size: 12px; color: #8c8597; margin-top: 4px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .card { background: #FDFBF8; border: 1px solid #E6DDD2; border-radius: 16px; padding: 18px; }
  .card-num { display: inline-block; width: 22px; height: 22px; background: #8B7AC0; color: #fff; border-radius: 50%; text-align: center; font-size: 11px; font-weight: 700; line-height: 22px; margin-bottom: 6px; }
  .card-title { font-size: 13px; font-weight: 700; color: #4a4453; margin-bottom: 12px; }
  .donut-row { display: flex; align-items: center; gap: 16px; }
  .stat-row { display: flex; gap: 12px; margin-bottom: 16px; }
  .stat-box { flex: 1; background: #FDFBF8; border: 1px solid #E6DDD2; border-radius: 12px; padding: 14px; text-align: center; }
  .stat-box .n { font-size: 26px; font-weight: 900; color: #8B7AC0; }
  .stat-box .l { font-size: 11px; color: #8c8597; margin-top: 3px; }
  .dominante-card { background: linear-gradient(135deg, #EDE9F5, #F5F0F9); border: 1px solid #D8D1E6; border-radius: 16px; padding: 18px; display: flex; align-items: center; gap: 14px; }
  .emo-circle { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
  .msg-card { background: linear-gradient(135deg, #EDE9F5 0%, #FAF7F3 100%); border-radius: 16px; padding: 20px; border: 1px solid #D8D1E6; margin-top: 16px; }
  .msg-icon { font-size: 20px; margin-bottom: 8px; }
  .msg-text { font-size: 13px; color: #5C4F8A; line-height: 1.6; font-style: italic; }
  .footer { border-top: 1px solid #E6DDD2; margin-top: 24px; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; }
  .footer .left { font-size: 10px; color: #aaa; }
  .footer .right { font-family: Georgia, serif; font-style: italic; font-size: 13px; color: #8B7AC0; }
</style>
</head>
<body>
<div class="page">
  ${BOTANICA_WATERMARK}
  <div class="header">
    <div class="app-brand">
      <div>
        <div class="app-name">Atravessia</div>
        <div class="app-sub">App de perdas e luto</div>
      </div>
    </div>
    <div class="report-title">
      <h1>RELATÓRIO MENSAL</h1>
      <div><span class="mes-badge">📅 ${dataStr}</span></div>
      <p>Seu resumo emocional do mês</p>
    </div>
  </div>

  ${mesal.total === 0 ? `<div style="text-align:center;padding:60px;color:#aaa"><p style="font-size:18px;margin-bottom:12px">💜</p><p>Ainda não há check-ins este mês.</p></div>` : `

  <div class="grid2">
    <!-- 1. Emoções -->
    <div class="card">
      <span class="card-num">1</span>
      <p class="card-title">Seu mês em emoções</p>
      <div class="donut-row">
        <div style="position:relative">
          ${donutSVG}
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
            <div style="font-size:18px;font-weight:900;color:#8B7AC0">${mesal.total}</div>
            <div style="font-size:8px;color:#aaa">registros</div>
          </div>
        </div>
        <div style="flex:1">${legendaEmocoes}</div>
      </div>
    </div>

  </div>

  <div class="grid2">
    <!-- 3. Calendário -->
    <div class="card">
      <span class="card-num">3</span>
      <p class="card-title">Calendário emocional</p>
      <p style="font-size:10px;color:#aaa;margin-bottom:10px">Cada cor representa a emoção predominante do dia</p>
      ${calHtml}
    </div>

    <!-- 4 + 5 -->
    <div style="display:flex;flex-direction:column;gap:12px">
      <!-- 4. Predominante -->
      <div class="card">
        <span class="card-num">4</span>
        <p class="card-title">Emoção predominante</p>
        <div class="dominante-card" style="padding:12px">
          <div class="emo-circle" style="background:${emoCor}22;font-size:20px">${emoObj?.icon ? '' : '💜'}</div>
          <div>
            <p style="font-size:13px;color:#4a4453">A <strong style="color:${emoCor}">${emoNome.toLowerCase()}</strong> foi a emoção mais presente neste mês.</p>
          </div>
        </div>
      </div>

      <!-- 5. Registros -->
      <div class="card">
        <span class="card-num">5</span>
        <p class="card-title">Seus registros</p>
        <div style="display:flex;gap:12px">
          <div style="text-align:center;flex:1">
            <div style="font-size:22px;font-weight:900;color:#8B7AC0">${mesal.com}</div>
            <div style="font-size:10px;color:#aaa">check-ins<br>realizados</div>
          </div>
          <div style="text-align:center;flex:1">
            <div style="font-size:22px;font-weight:900;color:#D4A89A">${mesal.semRegistro}</div>
            <div style="font-size:10px;color:#aaa">dias sem<br>registro</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 6. Mensagem -->
  <div class="msg-card">
    <div class="msg-icon">💜</div>
    <p class="msg-text">${msgEmocao(mesal.dominante)}</p>
  </div>

  ${renderInsightsHTML(insights)}
  `}

  <div class="footer">
    <div class="left">Gerado em ${agoraStr} (Brasília) • Atravessia</div>
    <div class="right">Perceber é o início.</div>
  </div>
</div>
</body>
</html>`;
}

function gerarRelatorioAnualHTML({ anual, usuario, year }) {
  const nome = usuario?.apelido || usuario?.nome || 'você';
  const agoraStr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const insights = gerarInsightsAnuais(anual);
  const donutSVG = anual.total > 0 ? gerarDonutSVG(anual.donut, 130, 24) : '';
  const legendaEmocoes = anual.sorted.map(([id, v], i) => {
    const emo = getEmoObj(id);
    const pct = Math.round((v / anual.total) * 100);
    const cor = anual.donut[i]?.color || '#aaa';
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <div style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0"></div>
      <span style="font-size:10px;color:#4a4453;flex:1">${emo?.label || id}</span>
      <span style="font-size:10px;font-weight:700;color:#4a4453">${pct}%</span>
    </div>`;
  }).join('');

  const trimColors = ['#8B7AC0', '#D4A89A', '#7A9E7E', '#B9C8DF'];
  const trimLabels = ['1º Trim.', '2º Trim.', '3º Trim.', '4º Trim.'];
  const trimHtml = anual.trimPct.map((pct, i) =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:11px;color:${trimColors[i]};font-weight:700;width:60px">${trimLabels[i]}</span>
      <div style="flex:1;height:10px;background:#EDE9F5;border-radius:5px">
        <div style="width:${pct}%;height:100%;background:${trimColors[i]};border-radius:5px"></div>
      </div>
      <span style="font-size:11px;font-weight:700;color:#4a4453">${pct}%</span>
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #4a4453; }
  .page { width: 794px; padding: 40px; position: relative; overflow: hidden; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #EDE9F5; padding-bottom: 16px; }
  .app-name { font-family: Georgia, serif; font-style: italic; font-size: 22px; color: #5C4F8A; }
  .app-sub { font-size: 10px; color: #8c8597; margin-top: 2px; }
  .report-title h1 { font-size: 26px; font-weight: 900; color: #5C4F8A; letter-spacing: 1px; text-align: right; }
  .report-title .year-badge { display: inline-flex; align-items: center; gap: 6px; background: #EDE9F5; border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 700; color: #5C4F8A; margin-top: 6px; }
  .stat-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
  .stat-tile { background: #FDFBF8; border: 1px solid #E6DDD2; border-radius: 14px; padding: 14px; text-align: center; }
  .stat-tile .icon { font-size: 20px; margin-bottom: 6px; }
  .stat-tile .n { font-size: 26px; font-weight: 900; }
  .stat-tile .l { font-size: 10px; color: #8c8597; margin-top: 3px; line-height: 1.4; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .card { background: #FDFBF8; border: 1px solid #E6DDD2; border-radius: 16px; padding: 18px; }
  .card-num { display: inline-block; width: 22px; height: 22px; background: #8B7AC0; color: #fff; border-radius: 50%; text-align: center; font-size: 11px; font-weight: 700; line-height: 22px; margin-bottom: 6px; }
  .card-title { font-size: 13px; font-weight: 700; color: #4a4453; margin-bottom: 12px; }
  .donut-row { display: flex; align-items: center; gap: 16px; }
  .msg-card { background: linear-gradient(135deg, #EDE9F5 0%, #FAF7F3 100%); border-radius: 16px; padding: 20px; border: 1px solid #D8D1E6; margin-top: 16px; }
  .msg-text { font-size: 13px; color: #5C4F8A; line-height: 1.6; font-style: italic; }
  .footer { border-top: 1px solid #E6DDD2; margin-top: 24px; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; }
  .footer .left { font-size: 10px; color: #aaa; }
  .footer .right { font-family: Georgia, serif; font-style: italic; font-size: 13px; color: #8B7AC0; }
</style>
</head>
<body>
<div class="page">
  ${BOTANICA_WATERMARK}
  <div class="header">
    <div>
      <div class="app-name">Atravessia</div>
      <div class="app-sub">App de perdas e luto</div>
    </div>
    <div class="report-title">
      <h1>RELATÓRIO ANUAL</h1>
      <div><span class="year-badge">📅 ${year}</span></div>
      <p style="font-size:12px;color:#8c8597;margin-top:4px;text-align:right">Sua jornada emocional do ano</p>
    </div>
  </div>

  <!-- Stat tiles -->
  <div class="stat-row">
    <div class="stat-tile">
      <div class="icon">📅</div>
      <div class="n" style="color:#8B7AC0">${anual.total}</div>
      <div class="l">check-ins realizados</div>
    </div>
    <div class="stat-tile">
      <div class="icon">💜</div>
      <div class="n" style="color:#D4A89A">${anual.uniqueDays}</div>
      <div class="l">dias com registro</div>
    </div>
    <div class="stat-tile">
      <div class="icon">⭐</div>
      <div class="n" style="color:#D4B483">${anual.consistencia}%</div>
      <div class="l">de constância no ano</div>
    </div>
  </div>

  <div class="grid2">
    <!-- 1. Emoções do ano -->
    <div class="card">
      <span class="card-num">1</span>
      <p class="card-title">Emoções do ano</p>
      <div class="donut-row">
        <div style="position:relative">
          ${donutSVG}
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
            <div style="font-size:16px;font-weight:900;color:#8B7AC0">${anual.total}</div>
            <div style="font-size:7px;color:#aaa">registros</div>
          </div>
        </div>
        <div style="flex:1">${legendaEmocoes}</div>
      </div>
    </div>

  </div>

  <!-- 2. Distribuição por trimestre -->
  <div class="card" style="margin-bottom:16px">
    <span class="card-num">2</span>
    <p class="card-title">Distribuição por trimestre</p>
    ${trimHtml}
  </div>

  <!-- 6. Mensagem -->
  <div class="msg-card">
    <p style="font-size:20px;margin-bottom:8px">💜</p>
    <p class="msg-text">Você atravessou altos e baixos, dias leves e dias desafiadores. Cada emoção registrada mostra sua coragem de olhar para dentro. Que o próximo ano seja cheio de leveza, autoconhecimento e cuidado com você.</p>
  </div>

  ${renderInsightsHTML(insights)}

  <div class="footer">
    <div class="left">Gerado em ${agoraStr} (Brasília) • Atravessia</div>
    <div class="right">Siga se cuidando. Você vale! 💜</div>
  </div>
</div>
</body>
</html>`;
}

function gerarRelatorioPersonalizadoHTML({ rangeData, rangeInicio, rangeFim }) {
  if (!rangeData) return '';
  const agoraStr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const [diI, meI, anoI] = (rangeInicio || '').split('/').map(Number);
  const [diF, meF, anoF] = (rangeFim || '').split('/').map(Number);
  const dStart = new Date(anoI, meI - 1, diI);
  const dEnd = new Date(anoF, meF - 1, diF);
  const diasPeriodo = (!isNaN(dStart) && !isNaN(dEnd)) ? Math.round((dEnd - dStart) / 86400000) + 1 : 0;
  const insights = gerarInsightsPeriodo(rangeData, diasPeriodo);
  const donutSVG = rangeData.total > 0 ? gerarDonutSVG(rangeData.donut, 130, 24) : '';
  const legendaEmocoes = rangeData.sorted.map(([id, v], i) => {
    const emo = getEmoObj(id);
    const pct = Math.round((v / rangeData.total) * 100);
    const cor = rangeData.donut[i]?.color || '#aaa';
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <div style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0"></div>
      <span style="font-size:11px;color:#4a4453;flex:1">${emo?.label || id}</span>
      <span style="font-size:11px;font-weight:700;color:#4a4453">${pct}%</span>
    </div>`;
  }).join('');
  const emoObj = getEmoObj(rangeData.dominante);
  const emoNome = emoObj?.label || '—';
  const emoCor = emoObj?.color || '#8B7AC0';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #4a4453; }
  .page { width: 794px; padding: 40px; position: relative; overflow: hidden; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #EDE9F5; padding-bottom: 16px; }
  .app-name { font-family: Georgia, serif; font-style: italic; font-size: 22px; color: #5C4F8A; letter-spacing: 0.5px; }
  .app-sub { font-size: 10px; color: #8c8597; margin-top: 2px; }
  .report-title { text-align: right; }
  .report-title h1 { font-size: 22px; font-weight: 900; color: #5C4F8A; letter-spacing: 1px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; background: #EDE9F5; border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 700; color: #5C4F8A; margin-top: 6px; }
  .stat-row { display: flex; gap: 12px; margin-bottom: 20px; }
  .stat-box { flex: 1; background: #FDFBF8; border: 1px solid #E6DDD2; border-radius: 12px; padding: 14px; text-align: center; }
  .stat-box .n { font-size: 26px; font-weight: 900; color: #8B7AC0; }
  .stat-box .l { font-size: 11px; color: #8c8597; margin-top: 3px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .card { background: #FDFBF8; border: 1px solid #E6DDD2; border-radius: 16px; padding: 18px; }
  .card-num { display: inline-block; width: 22px; height: 22px; background: #8B7AC0; color: #fff; border-radius: 50%; text-align: center; font-size: 11px; font-weight: 700; line-height: 22px; margin-bottom: 6px; }
  .card-title { font-size: 13px; font-weight: 700; color: #4a4453; margin-bottom: 12px; }
  .donut-row { display: flex; align-items: center; gap: 16px; }
  .msg-card { background: linear-gradient(135deg, #EDE9F5 0%, #FAF7F3 100%); border-radius: 16px; padding: 20px; border: 1px solid #D8D1E6; margin-top: 16px; }
  .msg-text { font-size: 13px; color: #5C4F8A; line-height: 1.6; font-style: italic; }
  .footer { border-top: 1px solid #E6DDD2; margin-top: 24px; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; }
  .footer .left { font-size: 10px; color: #aaa; }
  .footer .right { font-family: Georgia, serif; font-style: italic; font-size: 13px; color: #8B7AC0; }
</style>
</head>
<body>
<div class="page">
  ${BOTANICA_WATERMARK}
  <div class="header">
    <div>
      <div class="app-name">Atravessia</div>
      <div class="app-sub">App de perdas e luto</div>
    </div>
    <div class="report-title">
      <h1>RELATÓRIO PERSONALIZADO</h1>
      <div><span class="badge">📅 ${rangeInicio} → ${rangeFim}</span></div>
      <p style="font-size:12px;color:#8c8597;margin-top:4px">Resumo emocional do período</p>
    </div>
  </div>

  <div class="stat-row">
    <div class="stat-box">
      <div class="n">${rangeData.total}</div>
      <div class="l">check-ins no período</div>
    </div>
    <div class="stat-box">
      <div class="n">${rangeData.uniqueDays}</div>
      <div class="l">dias com registro</div>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <span class="card-num">1</span>
      <p class="card-title">Emoções no período</p>
      <div class="donut-row">
        <div style="position:relative">
          ${donutSVG}
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
            <div style="font-size:18px;font-weight:900;color:#8B7AC0">${rangeData.total}</div>
            <div style="font-size:8px;color:#aaa">registros</div>
          </div>
        </div>
        <div style="flex:1">${legendaEmocoes}</div>
      </div>
    </div>
    <div class="card">
      <span class="card-num">2</span>
      <p class="card-title">Emoção predominante</p>
      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:${emoCor}15;border-radius:12px;margin-top:8px">
        <div style="width:48px;height:48px;border-radius:50%;background:${emoCor}22;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">💜</div>
        <div>
          <p style="font-size:14px;font-weight:700;color:${emoCor}">${emoNome}</p>
          <p style="font-size:11px;color:#666;margin-top:3px">foi a emoção mais presente</p>
        </div>
      </div>
    </div>
  </div>

  <div class="msg-card">
    <p class="msg-text">Cada emoção registrada neste período é uma janela de autoconhecimento. Você teve coragem de olhar para dentro e nomear o que sentia. Continue se cuidando. 💜</p>
  </div>

  ${renderInsightsHTML(insights)}

  <div class="footer">
    <div class="left">Gerado em ${agoraStr} (Brasília) • Atravessia</div>
    <div class="right">Perceber é o início.</div>
  </div>
</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RelatoriosScreen({ navigation }) {
  const { checkins, usuario, temAcesso, mensagensRelatorio, vitorias } = useApp();
  const { perfil, firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || null;
  const [tab, setTab] = useState('mensal');
  const [exportando, setExportando] = useState(false);
  const [comprando, setComprando] = useState(false);
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
      id, value: v, color: getEmoObj(id)?.color || EMO_CHART_COLORS[i % EMO_CHART_COLORS.length],
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
      id, value: v, color: getEmoObj(id)?.color || EMO_CHART_COLORS[i % EMO_CHART_COLORS.length],
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

  const handleDesbloquear = async () => {
    setComprando(true);
    try {
      const criarCheckout = httpsCallable(functions, 'criarCheckoutPeriodoUnlocked');
      const { data } = await criarCheckout({});
      await WebBrowser.openBrowserAsync(data.url);
    } catch (e) {
      Alert.alert('Não foi possível abrir o checkout', e.message || 'Tente novamente em alguns instantes.');
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
      id, value: v, color: getEmoObj(id)?.color || EMO_CHART_COLORS[i % EMO_CHART_COLORS.length],
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

  const handleExportar = async () => {
    if (tab === 'personalizado' && !rangeData) {
      Alert.alert('Atenção', 'Gere o relatório do período antes de exportar.');
      return;
    }
    if (Platform.OS === 'web') {
      setExportando(true);
      try {
        const html = tab === 'mensal'
          ? gerarRelatorioMensalHTML({ mesal, usuario, month: calMes, year: calAno, MONTH_NAMES })
          : tab === 'anual'
            ? gerarRelatorioAnualHTML({ anual, usuario, year })
            : gerarRelatorioPersonalizadoHTML({ rangeData, rangeInicio, rangeFim });
        const w = typeof window !== 'undefined' && window.open ? window.open('', '_blank') : null;
        if (w) {
          w.document.write(html);
          w.document.close();
          w.focus();
          setTimeout(() => { w.print(); }, 400);
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
      const html = tab === 'mensal'
        ? gerarRelatorioMensalHTML({ mesal, usuario, month: calMes, year: calAno, MONTH_NAMES })
        : tab === 'anual'
          ? gerarRelatorioAnualHTML({ anual, usuario, year })
          : gerarRelatorioPersonalizadoHTML({ rangeData, rangeInicio, rangeFim });
      const { uri } = await Print.printToFileAsync({ html });
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
    return `Atravessando ${nomeEmo} — esse foi seu mês. Cada sentimento que você nomeia é um passo de cuidado. Você não precisa atravessar isso sozinho.`;
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <LavandaBg />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Relatórios</Text>
        <TouchableOpacity
          onPress={handleExportar}
          disabled={exportando}
          style={[s.exportBtn, exportando && { opacity: 0.5 }]}
        >
          <Ionicons name={exportando ? 'hourglass-outline' : 'download-outline'} size={18} color={colors.lav5} />
        </TouchableOpacity>
      </View>

      {/* Abas */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, tab === 'mensal' && s.tabSel]} onPress={() => setTab('mensal')}>
          <Text style={[s.tabTxt, tab === 'mensal' && s.tabTxtSel]}>Mensal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'anual' && s.tabSel]} onPress={() => setTab('anual')}>
          <Ionicons name={tab === 'anual' ? 'calendar' : 'calendar-outline'} size={13} color={tab === 'anual' ? colors.lav4 : colors.tl} style={{ marginRight: 4 }} />
          <Text style={[s.tabTxt, tab === 'anual' && s.tabTxtSel]}>Anual</Text>
          {!temAcesso(1) && <Ionicons name="lock-closed" size={10} color={colors.tl} style={{ marginLeft: 4 }} />}
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'personalizado' && s.tabSel]} onPress={() => setTab('personalizado')}>
          <Ionicons name={tab === 'personalizado' ? 'options' : 'options-outline'} size={13} color={tab === 'personalizado' ? colors.lav4 : colors.tl} style={{ marginRight: 4 }} />
          <Text style={[s.tabTxt, tab === 'personalizado' && s.tabTxtSel]}>Período</Text>
          {!temAcesso(1) && <Ionicons name="lock-closed" size={10} color={colors.tl} style={{ marginLeft: 4 }} />}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ═══════════════════════════════════ RELATÓRIO MENSAL ══════════════════ */}
        {tab === 'mensal' && (
          <>
            {/* Cabeçalho */}
            <View style={s.reportHeader}>
              <Image source={logo} style={s.reportLogo} resizeMode="contain" />
              <Text style={s.reportTitle}>RELATÓRIO MENSAL</Text>
              <View style={s.reportMes}>
                <Ionicons name="calendar-outline" size={14} color={colors.lav4} />
                <Text style={s.reportMesTxt}>{MONTH_NAMES[calMes].toUpperCase()}/{calAno}</Text>
              </View>
              <Text style={s.reportSub}>Seu resumo emocional do mês</Text>
            </View>

            {mesal.total === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="heart-outline" size={40} color={colors.lav3} />
                <Text style={s.emptyTxt}>Ainda não há check-ins este mês.</Text>
                <Text style={s.emptyHint}>Faça seu primeiro check-in para ver seu relatório.</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('CheckIn')}>
                  <Text style={s.emptyBtnTxt}>Fazer check-in agora</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Seção 1 — Suas emoções no mês */}
                <View style={s.card}>
                  <Text style={s.sectionLabel}>1</Text>
                  <Text style={s.cardTit}>Suas emoções no mês</Text>
                  <View style={s.donutRow}>
                    <DonutChart data={mesal.donut} size={150} thickness={28} total={mesal.total} label="registros" />
                    <View style={s.donutLegend}>
                      {mesal.sorted.slice(0, 6).map(([id, v], i) => {
                        const emo = getEmoObj(id);
                        const pct = Math.round((v / mesal.total) * 100);
                        return (
                          <View key={id} style={s.legendRow}>
                            <View style={[s.legendDot, { backgroundColor: emo?.color || EMO_CHART_COLORS[i] }]} />
                            <Text style={s.legendTxt} numberOfLines={1}>{emo?.label || id}</Text>
                            <Text style={[s.legendPct, { color: emo?.color || EMO_CHART_COLORS[i] }]}>{pct}%</Text>
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
                  <Text style={s.sectionLabel}>2</Text>
                  <Text style={s.cardTit}>Suas emoções nas áreas da vida</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
                    {mesal.areaData.map(area => (
                      <AreaDonutCard key={area.id} area={area} />
                    ))}
                  </ScrollView>
                  <Text style={s.areasSummaryTxt}>
                    A soma dos registros nas áreas é{' '}
                    <Text style={s.registrosBold}>{mesal.areaData.reduce((acc, a) => acc + a.total, 0)}</Text> dias
                    {' '}(cada check-in conta para a área escolhida).
                  </Text>
                </View>

                {/* Seção 3 — Pequenas Vitórias */}
                {vitoriasMes.length > 0 && (
                  <View style={s.card}>
                    <Text style={s.sectionLabel}>3</Text>
                    <Text style={s.cardTit}>As {Math.min(6, vitoriasMes.length)} maiores pequenas vitórias deste mês</Text>
                    <View style={s.vitCardsWrap}>
                      {vitoriasMes.slice(0, 6).map((v, i) => (
                        <View key={i} style={s.vitCardItem}>
                          <Ionicons name="star" size={13} color={colors.gold} />
                          <Text style={s.vitCardTxt} numberOfLines={2}>{v.label}</Text>
                        </View>
                      ))}
                    </View>
                    {vitoriasMes.length > 6 && (
                      <Text style={s.vitMore}>+{vitoriasMes.length - 6} mais conquistas este mês</Text>
                    )}
                  </View>
                )}

                {/* Calendário emocional — Plan 1+ */}
                {temPlano1 && (
                  <View style={s.card}>
                    <Text style={s.cardTit}>Calendário emocional</Text>
                    <Text style={s.cardSub}>Toque num dia marcado para ver o check-in</Text>
                    <View style={s.calNavRow}>
                      <TouchableOpacity style={s.calNavBtn} onPress={() => handleCalNav(-1)}>
                        <Ionicons name="chevron-back" size={18} color={colors.lav4} />
                      </TouchableOpacity>
                      <Text style={s.calNavTitle}>{MONTH_NAMES[calMes]} {calAno}</Text>
                      <TouchableOpacity
                        style={s.calNavBtn}
                        onPress={() => handleCalNav(1)}
                        disabled={calAno === year && calMes >= month}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={(calAno === year && calMes >= month) ? colors.lav2 : colors.lav4}
                        />
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
                            <View style={[s.legendDot, { backgroundColor: emo?.color || EMO_CHART_COLORS[i] }]} />
                            <Text style={s.legendTxt}>{emo?.label || id}</Text>
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
                    <Ionicons name="leaf-outline" size={12} color={colors.lav3} />
                    <Text style={s.msgRodapeTxt}>Atravessia</Text>
                  </View>
                </View>
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════ RELATÓRIO ANUAL ═══════════════════ */}
        {tab === 'anual' && (
          <>
            {!temAcesso(1) ? (
              <View style={s.lockedAnnual}>
                <Ionicons name="bar-chart-outline" size={48} color={colors.lav3} />
                <Text style={s.lockedAnnualTit}>Relatório Anual</Text>
                <Text style={s.lockedAnnualDesc}>
                  Veja sua jornada emocional completa do ano — emoções ao longo do ano, distribuição por trimestre, constância e muito mais.
                </Text>
                <Text style={s.lockedAnnualBadge}>Disponível no Plano Acolher</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('Planos')}>
                  <Text style={s.emptyBtnTxt}>Ver planos</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Cabeçalho anual */}
                <View style={s.reportHeader}>
                  <Image source={logo} style={s.reportLogo} resizeMode="contain" />
                  <Text style={s.reportTitle}>RELATÓRIO ANUAL</Text>
                  <View style={s.reportMes}>
                    <Ionicons name="calendar-outline" size={14} color={colors.lav4} />
                    <Text style={s.reportMesTxt}>{year}</Text>
                  </View>
                  <Text style={s.reportSub}>Sua jornada emocional do ano</Text>
                </View>

                {/* Tiles de estatística */}
                <View style={s.tilesRow}>
                  {[
                    { icon: 'calendar-outline', v: anual.total, lbl: 'check-ins realizados', color: colors.lav4 },
                    { icon: 'heart-outline', v: anual.uniqueDays, lbl: 'dias com registro', color: colors.rose },
                    { icon: 'star-outline', v: `${anual.consistencia}%`, lbl: 'de constância', color: colors.gold },
                  ].map((t, i) => (
                    <View key={i} style={s.tile}>
                      <Ionicons name={t.icon} size={18} color={t.color} />
                      <Text style={[s.tileNum, { color: t.color }]}>{t.v}</Text>
                      <Text style={s.tileLbl}>{t.lbl}</Text>
                    </View>
                  ))}
                </View>

                {/* 1. Emoções do ano */}
                <View style={s.card}>
                  <Text style={s.cardNum}>1</Text>
                  <Text style={s.cardTit}>Emoções do ano</Text>
                  <View style={s.donutRow}>
                    <DonutChart data={anual.donut} size={140} thickness={26} total={anual.total} label="registros" />
                    <View style={s.donutLegend}>
                      {anual.sorted.slice(0, 7).map(([id, v], i) => {
                        const emo = getEmoObj(id);
                        const pct = Math.round((v / anual.total) * 100);
                        return (
                          <View key={id} style={s.legendRow}>
                            <View style={[s.legendDot, { backgroundColor: emo?.color || EMO_CHART_COLORS[i] }]} />
                            <Text style={s.legendTxt} numberOfLines={1}>{emo?.label || id}</Text>
                            <Text style={[s.legendPct, { color: emo?.color || EMO_CHART_COLORS[i] }]}>{pct}%</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Suas emoções nas áreas da vida — anual */}
                <View style={s.card}>
                  <Text style={s.sectionLabel}>2</Text>
                  <Text style={s.cardTit}>Suas emoções nas áreas da vida</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
                    {anual.areaData.map(area => (
                      <AreaDonutCard key={area.id} area={area} />
                    ))}
                  </ScrollView>
                  <Text style={s.areasSummaryTxt}>
                    Total de registros por área ao longo do ano.
                  </Text>
                </View>

                {/* 3. Distribuição por trimestre */}
                <View style={s.card}>
                  <Text style={s.cardNum}>3</Text>
                  <Text style={s.cardTit}>Distribuição por trimestre</Text>
                  {['1º Trimestre','2º Trimestre','3º Trimestre','4º Trimestre'].map((label, i) => (
                    <View key={i} style={s.trimRow}>
                      <Text style={s.trimLabel}>{label}</Text>
                      <View style={s.trimTrack}>
                        <View style={[s.trimFill, { width: `${anual.trimPct[i]}%`, backgroundColor: [colors.lav4, colors.rose, colors.sage, colors.gold][i] }]} />
                      </View>
                      <Text style={s.trimPct}>{anual.trimPct[i]}%</Text>
                    </View>
                  ))}
                </View>

                {vitoriasAno.length > 0 && (
                  <View style={s.card}>
                    <Text style={s.sectionLabel}>⭐</Text>
                    <Text style={s.cardTit}>As {Math.min(6, vitoriasAno.length)} maiores pequenas vitórias do ano</Text>
                    <View style={s.vitCardsWrap}>
                      {vitoriasAno.slice(0, 6).map((v, i) => (
                        <View key={i} style={s.vitCardItem}>
                          <Ionicons name="star" size={13} color={colors.gold} />
                          <Text style={s.vitCardTxt} numberOfLines={2}>{v.label}</Text>
                        </View>
                      ))}
                    </View>
                    {vitoriasAno.length > 6 && (
                      <Text style={s.vitMore}>+{vitoriasAno.length - 6} mais conquistas este ano</Text>
                    )}
                  </View>
                )}

                {/* 3. Mensagem anual */}
                <View style={[s.card, s.msgCard]}>
                  <Text style={s.cardNum}>3</Text>
                  <Text style={s.cardTit}>Mensagem para você</Text>
                  <Text style={s.msgTxt}>
                    Você atravessou altos e baixos, dias leves e dias desafiadores. Cada emoção registrada mostra sua coragem de olhar para dentro. Que o próximo ano seja cheio de leveza, autoconhecimento e cuidado com você.
                  </Text>
                  <View style={s.msgRodape}>
                    <Ionicons name="leaf-outline" size={12} color={colors.lav3} />
                    <Text style={s.msgRodapeTxt}>Atravessia</Text>
                  </View>
                </View>
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════ RELATÓRIO PERSONALIZADO ═══════ */}
        {tab === 'personalizado' && (
          <>
            {/* Datas — sempre visíveis */}
            <View style={s.card}>
              <Text style={s.cardTit}>Defina o período</Text>
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
                <Ionicons name="arrow-forward" size={16} color={colors.tl} style={{ marginTop: 20 }} />
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
              <View style={s.lockedAnnual}>
                <View style={s.periodoIconWrap}>
                  <Ionicons name="calendar-outline" size={36} color={colors.lav4} />
                </View>
                <Text style={s.lockedAnnualTit}>Relatório por Período</Text>
                <Text style={s.lockedAnnualDesc}>
                  Adquira um crédito para gerar o relatório do período selecionado acima.
                </Text>

                {!temAcesso(1) ? (
                  <>
                    <Text style={s.pricingTitle}>Para acessar, assine um plano primeiro</Text>
                    <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('Planos')}>
                      <Text style={s.emptyBtnTxt}>Ver planos</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={s.stripeWrap}>
                    <View style={s.stripePriceCard}>
                      <Ionicons name="calendar-outline" size={28} color={colors.lav4} />
                      <Text style={[s.stripePriceTxt, { color: colors.lav4 }]}>R$ 5,90</Text>
                      <Text style={s.stripePriceSub}>por relatório gerado</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.stripeBtn, { backgroundColor: colors.lav4 }, comprando && { opacity: 0.6 }]}
                      onPress={handleDesbloquear}
                      disabled={comprando}
                    >
                      <Ionicons name="card-outline" size={16} color="white" />
                      <Text style={s.stripeBtnTxt}>
                        {comprando ? 'Abrindo checkout...' : 'Obter 1 relatório por R$ 5,90'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={s.stripeHint}>
                      Após o pagamento, volte aqui. Seu crédito será liberado automaticamente.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <>
                <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
                  <TouchableOpacity style={s.gerarBtn} onPress={handleGerarRange}>
                    <Ionicons name="bar-chart-outline" size={15} color="white" />
                    <Text style={s.gerarBtnTxt}>Gerar relatório</Text>
                  </TouchableOpacity>
                </View>

                {rangeData && (
                  <>
                    <View style={s.reportHeader}>
                      <Image source={logo} style={s.reportLogo} resizeMode="contain" />
                      <Text style={s.reportTitle}>RELATÓRIO PERSONALIZADO</Text>
                      <View style={s.reportMes}>
                        <Ionicons name="calendar-outline" size={14} color={colors.lav4} />
                        <Text style={s.reportMesTxt}>{rangeInicio} → {rangeFim}</Text>
                      </View>
                    </View>

                    <View style={s.tilesRow}>
                      {[
                        { icon: 'calendar-outline', v: rangeData.total, lbl: 'check-ins no período', color: colors.lav4 },
                        { icon: 'today-outline', v: rangeData.uniqueDays, lbl: 'dias com registro', color: colors.rose },
                      ].map((t, i) => (
                        <View key={i} style={[s.tile, { minWidth: '30%' }]}>
                          <Ionicons name={t.icon} size={18} color={t.color} />
                          <Text style={[s.tileNum, { color: t.color }]}>{t.v}</Text>
                          <Text style={s.tileLbl}>{t.lbl}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={s.card}>
                      <Text style={s.cardNum}>1</Text>
                      <Text style={s.cardTit}>Emoções no período</Text>
                      <View style={s.donutRow}>
                        <DonutChart data={rangeData.donut} size={140} thickness={26} total={rangeData.total} label="registros" />
                        <View style={s.donutLegend}>
                          {rangeData.sorted.slice(0, 7).map(([id, v], i) => {
                            const emo = getEmoObj(id);
                            const pct = Math.round((v / rangeData.total) * 100);
                            return (
                              <View key={id} style={s.legendRow}>
                                <View style={[s.legendDot, { backgroundColor: emo?.color || EMO_CHART_COLORS[i] }]} />
                                <Text style={s.legendTxt} numberOfLines={1}>{emo?.label || id}</Text>
                                <Text style={[s.legendPct, { color: emo?.color || EMO_CHART_COLORS[i] }]}>{pct}%</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>

                    {/* Áreas da vida — período */}
                    {rangeData.areaData && (
                      <View style={s.card}>
                        <Text style={s.sectionLabel}>2</Text>
                        <Text style={s.cardTit}>Suas emoções nas áreas da vida</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
                          {rangeData.areaData.map(area => (
                            <AreaDonutCard key={area.id} area={area} />
                          ))}
                        </ScrollView>
                        <Text style={s.areasSummaryTxt}>
                          Total de registros por área no período selecionado.
                        </Text>
                      </View>
                    )}

                    {rangeData.dominante && (
                      <View style={s.card}>
                        <Text style={s.cardNum}>3</Text>
                        <Text style={s.cardTit}>Emoção predominante</Text>
                        {(() => {
                          const emo = getEmoObj(rangeData.dominante);
                          return (
                            <View style={s.predominRow}>
                              <View style={[s.predominCircle, { backgroundColor: emo?.bg || colors.lav1 }]}>
                                <Ionicons name={`${emo?.icon || 'heart'}-outline`} size={28} color={emo?.color || colors.lav4} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[s.predominNome, { color: emo?.color || colors.lav4 }]}>{emo?.label || rangeData.dominante}</Text>
                                <Text style={s.predominDesc}>foi a emoção mais presente no período.</Text>
                              </View>
                            </View>
                          );
                        })()}
                      </View>
                    )}

                    {vitoriasRange.length > 0 && (
                      <View style={s.card}>
                        <Text style={s.sectionLabel}>⭐</Text>
                        <Text style={s.cardTit}>As {Math.min(6, vitoriasRange.length)} maiores pequenas vitórias do período</Text>
                        <View style={s.vitCardsWrap}>
                          {vitoriasRange.slice(0, 6).map((v, i) => (
                            <View key={i} style={s.vitCardItem}>
                              <Ionicons name="star" size={13} color={colors.gold} />
                              <Text style={s.vitCardTxt} numberOfLines={2}>{v.label}</Text>
                            </View>
                          ))}
                        </View>
                        {vitoriasRange.length > 6 && (
                          <Text style={s.vitMore}>+{vitoriasRange.length - 6} mais conquistas no período</Text>
                        )}
                      </View>
                    )}

                    <View style={[s.card, s.msgCard]}>
                      <Text style={s.cardTit}>Mensagem para você</Text>
                      <Text style={s.msgTxt}>Cada emoção registrada neste período é uma janela de autoconhecimento. Você teve coragem de olhar para dentro e nomear o que sentia. Continue se cuidando.</Text>
                      <View style={s.msgRodape}>
                        <Ionicons name="leaf-outline" size={12} color={colors.lav3} />
                        <Text style={s.msgRodapeTxt}>Atravessia</Text>
                      </View>
                    </View>
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
                  <View style={[s.legendDot, { backgroundColor: emo?.color || colors.lav3, width: 12, height: 12 }]} />
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  exportBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.lav1 },

  tabRow: { flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.lav1, borderRadius: radius.full, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: radius.full, gap: 4 },
  tabSel: { backgroundColor: colors.white },
  tabTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.tl },
  tabTxtSel: { fontFamily: fonts.bodyBold, color: colors.lav4 },

  reportLogo: { width: 48, height: 48, marginBottom: 8, borderRadius: 12 },
  reportHeader: { alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  reportTitle: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.lav6, letterSpacing: 1 },
  reportMes: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  reportMesTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav4 },
  reportSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 4 },

  card: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  vitRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  vitTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.td, flex: 1 },
  vitMore: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: 4 },
  cardNum: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.lav3, marginBottom: 2 },
  cardTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: 4 },
  cardSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginBottom: 4 },

  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  donutLegend: { flex: 1, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  legendTxt: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: colors.td },
  legendPct: { fontFamily: fonts.bodyBold, fontSize: 11 },

  calLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: colors.border },

  intensScale: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  intensNum: { fontFamily: fonts.body, fontSize: 9, color: colors.tl },

  predominRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  predominCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  predominNome: { fontFamily: fonts.bodyBold, fontSize: 18 },
  predominDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },

  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statNum: { fontFamily: fonts.bodyBold, fontSize: 24, color: colors.lav4 },
  statLbl: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, textAlign: 'center', marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },

  msgCard: { backgroundColor: colors.lav1, borderColor: colors.lav2 },
  msgTxt: { fontFamily: fonts.quote, fontSize: 14, fontStyle: 'italic', color: colors.lav6, lineHeight: 22, marginTop: 8 },
  msgRodape: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'flex-end' },
  msgRodapeTxt: { fontFamily: fonts.body, fontSize: 10, color: colors.lav3 },

  lockedCard: { backgroundColor: colors.bg, borderStyle: 'dashed', opacity: 0.9 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  lockedTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.tl, flex: 1 },
  lockedBtn: { alignSelf: 'flex-start' },
  lockedBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav4 },

  emptyBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: spacing.xl },
  emptyTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td, marginTop: 12, textAlign: 'center' },
  emptyHint: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 4, textAlign: 'center' },
  emptyBtn: { marginTop: 20, backgroundColor: colors.lav4, borderRadius: radius.full, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },

  tilesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  tile: { flex: 1, minWidth: '45%', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, gap: 4 },
  tileNum: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.lav4 },
  tileLbl: { fontFamily: fonts.body, fontSize: 9, color: colors.tl, textAlign: 'center' },


  trimRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  trimLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.td, width: 90 },
  trimTrack: { flex: 1, height: 8, backgroundColor: colors.lav1, borderRadius: 4, overflow: 'hidden' },
  trimFill: { height: '100%', borderRadius: 4 },
  trimPct: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.td, width: 32, textAlign: 'right' },

  pricingTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginTop: spacing.lg, marginBottom: spacing.sm, textAlign: 'center' },
  pricingCards: { alignSelf: 'stretch', flexDirection: 'row', gap: 8, marginBottom: spacing.sm, marginTop: 4 },
  pricingCard: {
    flex: 1, alignItems: 'center', padding: 10, paddingTop: 16, borderRadius: radius.lg,
    borderWidth: 1.5, backgroundColor: colors.card, position: 'relative',
  },
  pricingCardSel: { backgroundColor: colors.lav1 },
  pricingBadge: { position: 'absolute', top: -10, alignSelf: 'center', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  pricingBadgeTxt: { fontFamily: fonts.bodyBold, fontSize: 8, color: 'white' },
  pricingIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pricingCardNome: { fontFamily: fonts.bodyBold, fontSize: 10, textAlign: 'center', marginBottom: 4 },
  pricingPrecoWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  pricingPreco: { fontFamily: fonts.bodyBold, fontSize: 15 },
  pricingPer: { fontFamily: fonts.body, fontSize: 9, color: colors.tl },
  pricingDesc: { fontFamily: fonts.body, fontSize: 9, color: colors.tm, textAlign: 'center', marginTop: 6, lineHeight: 13 },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginVertical: spacing.md },
  dateLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginBottom: 4 },
  dateInput: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  gerarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.lav4, borderRadius: radius.full,
    paddingVertical: 13,
  },
  gerarBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: 'white' },

  lockedAnnual: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: spacing.xl },
  lockedAnnualTit: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.td, marginTop: 16 },
  lockedAnnualDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  lockedAnnualBadge: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lav4, marginTop: 16, backgroundColor: colors.lav1, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full },

  periodoIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stripeWrap: { alignSelf: 'stretch', marginTop: spacing.lg, gap: 12 },
  stripePriceCard: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, alignItems: 'center', gap: 6,
  },
  stripePriceTxt: { fontFamily: fonts.bodyBold, fontSize: 32, letterSpacing: 0.5 },
  stripePriceSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },
  stripeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: radius.full, paddingVertical: 14,
  },
  stripeBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: 'white' },
  stripeHint: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, textAlign: 'center', lineHeight: 17 },

  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.lav4, marginBottom: 2 },
  registrosTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 10, lineHeight: 18 },
  registrosBold: { fontFamily: fonts.bodyBold, color: colors.lav5 },
  areasSummaryTxt: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: 4, lineHeight: 16 },
  vitCardsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  vitCardItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, width: '47%', backgroundColor: colors.bg, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: colors.border },
  vitCardTxt: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: colors.td, lineHeight: 15 },
  calNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
  calNavBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  calNavTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 320, gap: 8 },
  modalTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td, marginBottom: 4 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  modalEmo: { fontFamily: fonts.body, fontSize: 14, color: colors.td },
  modalCloseBtn: { marginTop: 8, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 24, backgroundColor: colors.lav1, borderRadius: radius.full },
  modalCloseTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav5 },
});
