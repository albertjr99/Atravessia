import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions, Alert,
} from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, fonts, spacing, radius } from '../../theme';
import { emocoes } from '../../data';
import { useApp } from '../../hooks/AppContext';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 48;

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
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

// ── Gráfico de linha (SVG) ────────────────────────────────────────────────────
function LineChart({ data, width = CHART_W, height = 90, color = colors.lav4, xLabels }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 5);
  const px = 12, py = 12;
  const w = width - px * 2;
  const h = height - py * 2;
  const pts = data.map((v, i) => ({
    x: px + (i / (data.length - 1)) * w,
    y: py + (1 - (v - 1) / (max - 1 || 1)) * h,
  }));
  const poly = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <View>
      <Svg width={width} height={height}>
        <Polyline points={poly} stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
        ))}
      </Svg>
      {xLabels && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: px }}>
          {xLabels.map((l, i) => (
            <Text key={i} style={{ fontFamily: fonts.body, fontSize: 8, color: colors.tl }}>{l}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Calendário emocional ──────────────────────────────────────────────────────
function CalendarGrid({ year, month, checkinsByDate }) {
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
          return (
            <View key={d} style={[
              cs.cell,
              emo && { backgroundColor: emo.color + '55' },
              isToday && { borderWidth: 1.5, borderColor: colors.lav4 },
              isFuture && { opacity: 0.3 },
            ]}>
              <Text style={[cs.dayNum, emo && { color: emo.color }, isToday && { fontFamily: fonts.bodyBold }]}>{d}</Text>
            </View>
          );
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
  lista.forEach(c => { map[c.emocao] = (map[c.emocao] || 0) + 1; });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function avgIntensidade(lista) {
  if (!lista.length) return 0;
  return lista.reduce((s, c) => s + (c.intensidade || 3), 0) / lista.length;
}

function checkinsByDate(checkins) {
  const map = {};
  checkins.forEach(c => {
    const key = c.data?.slice(0, 10);
    if (key) map[key] = getEmoObj(c.emocao);
  });
  return map;
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

// ── Cores para emoções no gráfico ─────────────────────────────────────────────
const EMO_CHART_COLORS = [
  colors.lav4, colors.rose, colors.sage, colors.gold,
  colors.azulNevoa, colors.peach, '#CDB9A6', colors.lav3,
  '#B0C4B1', colors.lav6, colors.lav5, '#D8B4B6',
];

// ── Gerador de HTML para PDF ─────────────────────────────────────────────────
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

function gerarLinhaHTML(data, labels, cor = '#8B7AC0') {
  if (!data || data.length < 2) return '<p style="color:#aaa;font-size:11px">Dados insuficientes</p>';
  const w = 400, h = 80, px = 16, py = 10;
  const max = Math.max(...data, 5);
  const pts = data.map((v, i) => ({
    x: px + (i / (data.length - 1)) * (w - px * 2),
    y: py + (1 - (v - 1) / (max - 1 || 1)) * (h - py * 2),
  }));
  const poly = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const dots = pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${cor}" />`).join('');
  const labelHtml = labels
    ? `<div style="display:flex;justify-content:space-between;padding:0 ${px}px;font-size:9px;color:#999;">${labels.map(l => `<span>${l}</span>`).join('')}</div>`
    : '';
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <polyline points="${poly}" stroke="${cor}" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
  </svg>${labelHtml}`;
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

function gerarRelatorioMensalHTML({ mesal, usuario, month, year, MONTH_NAMES, MONTH_SHORT }) {
  const dataStr = `${MONTH_NAMES[month].toUpperCase()}/${year}`;
  const nome = usuario?.apelido || usuario?.nome || 'você';
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

  const intensHtml = mesal.intensData.length >= 2 ? gerarLinhaHTML(mesal.intensData, mesal.intensLabels) : '<p style="color:#aaa;font-size:11px;text-align:center">Registre mais dias para ver a intensidade</p>';
  const calHtml = gerarCalendarioHTML(year, month, mesal.byDate);

  const emoObj = getEmoObj(mesal.dominante);
  const emoNome = emoObj?.label || '—';
  const emoCor = emoObj?.color || '#8B7AC0';

  const msgEmocao = (dominante) => {
    const e = getEmoObj(dominante);
    if (!e) return 'Continue fazendo seus registros. Cada check-in é um passo de autoconhecimento.';
    if (e.positiva) return `A ${e.label.toLowerCase()} esteve presente em você este mês. Guarde esse sentimento com carinho.`;
    return `A ${e.label.toLowerCase()} foi sua emoção mais frequente este mês. Cada sentimento que você nomeia é um passo de cuidado. Você não precisa atravessar isso sozinho.`;
  };

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #4a4453; }
  .page { width: 794px; padding: 40px; }
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

    <!-- 2. Intensidade -->
    <div class="card">
      <span class="card-num">2</span>
      <p class="card-title">Intensidade das emoções</p>
      <p style="font-size:10px;color:#aaa;margin-bottom:8px">Média da intensidade por dia (de 1 a 5)</p>
      ${intensHtml}
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
          <div style="text-align:center;flex:1">
            <div style="font-size:22px;font-weight:900;color:#7A9E7E">${mesal.avgInt}</div>
            <div style="font-size:10px;color:#aaa">intensidade<br>média</div>
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
  `}

  <div class="footer">
    <div class="left">Seu espaço seguro de acolhimento e autoconhecimento. • Atravessia</div>
    <div class="right">Perceber é o início.</div>
  </div>
</div>
</body>
</html>`;
}

function gerarRelatorioAnualHTML({ anual, usuario, year, MONTH_SHORT }) {
  const nome = usuario?.apelido || usuario?.nome || 'você';
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

  const intensHtml = anual.porMes.some(v => v > 0)
    ? gerarLinhaHTML(anual.porMes.map(v => v || 0), MONTH_SHORT.map(l => l.slice(0, 1)))
    : '<p style="color:#aaa;font-size:11px;text-align:center">Registre mais meses para ver</p>';

  const mesIntensHtml = anual.maisIntens.map(({ m, v }) =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:11px;color:#8B7AC0;font-weight:700;width:70px">${MONTH_SHORT[m]}</span>
      <div style="flex:1;height:8px;background:#EDE9F5;border-radius:4px">
        <div style="width:${Math.round((v / 5) * 100)}%;height:100%;background:#8B7AC0;border-radius:4px"></div>
      </div>
      <span style="font-size:11px;font-weight:700;color:#4a4453">${v.toFixed(1)}</span>
    </div>`).join('');

  const mesLevesHtml = anual.maisLeves.map(({ m, v }) =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:11px;color:#7A9E7E;font-weight:700;width:70px">${MONTH_SHORT[m]}</span>
      <div style="flex:1;height:8px;background:#E8F0E8;border-radius:4px">
        <div style="width:${Math.round((v / 5) * 100)}%;height:100%;background:#7A9E7E;border-radius:4px"></div>
      </div>
      <span style="font-size:11px;font-weight:700;color:#4a4453">${v.toFixed(1)}</span>
    </div>`).join('');

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
  .page { width: 794px; padding: 40px; }
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
    <div class="stat-tile">
      <div class="icon">📈</div>
      <div class="n" style="color:#7A9E7E">${anual.avgInt}</div>
      <div class="l">intensidade média do ano (1 a 5)</div>
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

    <!-- 2. Intensidade ao longo do ano -->
    <div class="card">
      <span class="card-num">2</span>
      <p class="card-title">Intensidade emocional ao longo do ano</p>
      <p style="font-size:10px;color:#aaa;margin-bottom:8px">Média da intensidade por mês (de 1 a 5)</p>
      ${intensHtml}
    </div>
  </div>

  <div class="grid2">
    <!-- 3. Meses mais intensos -->
    <div class="card">
      <span class="card-num">3</span>
      <p class="card-title">Meses mais intensos</p>
      <p style="font-size:10px;color:#aaa;margin-bottom:10px">Maiores intensidades médias</p>
      ${mesIntensHtml || '<p style="color:#aaa;font-size:11px">Dados insuficientes</p>'}
    </div>

    <!-- 4. Meses mais leves -->
    <div class="card">
      <span class="card-num">4</span>
      <p class="card-title">Meses mais leves</p>
      <p style="font-size:10px;color:#aaa;margin-bottom:10px">Menores intensidades médias</p>
      ${mesLevesHtml || '<p style="color:#aaa;font-size:11px">Dados insuficientes</p>'}
    </div>
  </div>

  <!-- 5. Distribuição por trimestre -->
  <div class="card" style="margin-bottom:16px">
    <span class="card-num">5</span>
    <p class="card-title">Distribuição por trimestre</p>
    ${trimHtml}
  </div>

  <!-- 6. Mensagem -->
  <div class="msg-card">
    <p style="font-size:20px;margin-bottom:8px">💜</p>
    <p class="msg-text">Você atravessou altos e baixos, dias leves e dias desafiadores. Cada emoção registrada mostra sua coragem de olhar para dentro. Que o próximo ano seja cheio de leveza, autoconhecimento e cuidado com você.</p>
  </div>

  <div class="footer">
    <div class="left">Você não está só nessa jornada. • Atravessia</div>
    <div class="right">Siga se cuidando. Você vale! 💜</div>
  </div>
</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RelatoriosScreen({ navigation }) {
  const { checkins, usuario, temAcesso } = useApp();
  const [tab, setTab] = useState('mensal');
  const [exportando, setExportando] = useState(false);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const temPlano1 = temAcesso(1);

  // ── Dados mensais ──
  const mesal = useMemo(() => {
    const lista = calcMes(checkins, year, month);
    const sorted = contagemEmo(lista);
    const total = lista.length;
    const donut = sorted.map(([id, v], i) => ({
      id, value: v, color: getEmoObj(id)?.color || EMO_CHART_COLORS[i % EMO_CHART_COLORS.length],
    }));

    // Intensidade por dia do mês
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const intensByDay = Array.from({ length: daysInMonth }, (_, d) => {
      const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
      const dayCheckins = lista.filter(c => c.data?.startsWith(dayKey));
      return dayCheckins.length ? avgIntensidade(dayCheckins) : null;
    });
    const intensData = intensByDay.filter(v => v !== null);
    // Labels: apenas 1, 8, 15, 22, último dia
    const intensLabels = ['01', '08', '15', '22', String(daysInMonth)];

    const byDate = checkinsByDate(lista);
    const dominante = sorted[0]?.[0];
    const { com, total: totalDias } = diasComRegistro(lista, year, month);
    const semRegistro = totalDias - com;
    const avgInt = avgIntensidade(lista).toFixed(1);

    return { lista, sorted, total, donut, intensData, intensLabels, byDate, dominante, com, semRegistro, avgInt };
  }, [checkins, year, month]);

  // ── Dados anuais ──
  const anual = useMemo(() => {
    const lista = calcAno(checkins, year);
    const sorted = contagemEmo(lista);
    const total = lista.length;
    const donut = sorted.map(([id, v], i) => ({
      id, value: v, color: getEmoObj(id)?.color || EMO_CHART_COLORS[i % EMO_CHART_COLORS.length],
    }));

    // Intensidade média por mês
    const porMes = Array.from({ length: 12 }, (_, m) => {
      const ml = calcMes(checkins, year, m);
      return ml.length ? avgIntensidade(ml) : 0;
    });

    // Dias com registro no ano
    const uniqueDays = new Set(lista.map(c => c.data?.slice(0, 10)));
    const totalDias = Math.floor((now - new Date(year, 0, 1)) / 86400000) + 1;
    const consistencia = Math.round((uniqueDays.size / totalDias) * 100);
    const avgInt = avgIntensidade(lista).toFixed(1);

    // Meses mais intensos e mais leves (que tiveram checkins)
    const mesComDados = porMes.map((v, i) => ({ m: i, v })).filter(x => x.v > 0);
    const sorted3asc = [...mesComDados].sort((a, b) => a.v - b.v);
    const sorted3desc = [...mesComDados].sort((a, b) => b.v - a.v);
    const maisIntens = sorted3desc.slice(0, 3);
    const maisLeves = sorted3asc.slice(0, 3);

    // Trimestres
    const trims = [0, 1, 2, 3].map(t => {
      const tl = [0, 1, 2].map(m => calcMes(checkins, year, t * 3 + m)).flat();
      return tl.length;
    });
    const totalTrims = trims.reduce((s, v) => s + v, 0) || 1;
    const trimPct = trims.map(v => Math.round((v / totalTrims) * 100));

    return { lista, sorted, total, donut, porMes, uniqueDays: uniqueDays.size, consistencia, avgInt, maisIntens, maisLeves, trimPct };
  }, [checkins, year]);

  const handleExportar = async () => {
    setExportando(true);
    try {
      const html = tab === 'mensal'
        ? gerarRelatorioMensalHTML({ mesal, usuario, month, year, MONTH_NAMES, MONTH_SHORT })
        : gerarRelatorioAnualHTML({ anual, usuario, year, MONTH_SHORT });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf' });
      } else {
        Alert.alert('PDF gerado', 'Arquivo salvo em: ' + uri);
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setExportando(false);
    }
  };

  const mensagem = (dominante) => {
    const emo = getEmoObj(dominante);
    if (!emo) return 'Cada check-in é um passo de autoconhecimento. Continue cuidando de si.';
    if (emo.positiva) return `A ${emo.label.toLowerCase()} esteve presente em você este mês. Guarde esse sentimento com carinho e continue se cuidando.`;
    return `A ${emo.label.toLowerCase()} foi sua emoção mais frequente este mês. Cada sentimento que você nomeia é um passo de cuidado. Você não precisa atravessar isso sozinho.`;
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
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
          {!temAcesso(3) && <Ionicons name="lock-closed" size={10} color={colors.tl} style={{ marginLeft: 4 }} />}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ═══════════════════════════════════ RELATÓRIO MENSAL ══════════════════ */}
        {tab === 'mensal' && (
          <>
            {/* Cabeçalho */}
            <View style={s.reportHeader}>
              <Text style={s.reportTitle}>RELATÓRIO MENSAL</Text>
              <View style={s.reportMes}>
                <Ionicons name="calendar-outline" size={14} color={colors.lav4} />
                <Text style={s.reportMesTxt}>{MONTH_NAMES[month].toUpperCase()}/{year}</Text>
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
                {/* 1. Emoções do mês */}
                <View style={s.card}>
                  <Text style={s.cardNum}>1</Text>
                  <Text style={s.cardTit}>Seu mês em emoções</Text>
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
                </View>

                {/* 2. Intensidade — Plan 1+ */}
                {temPlano1 && mesal.intensData.length >= 2 ? (
                  <View style={s.card}>
                    <Text style={s.cardNum}>2</Text>
                    <Text style={s.cardTit}>Intensidade das emoções</Text>
                    <Text style={s.cardSub}>Média da intensidade por dia (de 1 a 5)</Text>
                    <View style={{ marginVertical: 8 }}>
                      <LineChart data={mesal.intensData} color={colors.lav4} height={80} />
                    </View>
                    <View style={s.intensScale}>
                      {[1,2,3,4,5].map(v => (
                        <Text key={v} style={s.intensNum}>{v}</Text>
                      ))}
                    </View>
                  </View>
                ) : !temPlano1 && (
                  <View style={[s.card, s.lockedCard]}>
                    <View style={s.lockedRow}>
                      <Ionicons name="lock-closed-outline" size={18} color={colors.lav3} />
                      <Text style={s.lockedTxt}>Gráfico de intensidade disponível no Plano Acolher</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Planos')} style={s.lockedBtn}>
                      <Text style={s.lockedBtnTxt}>Conhecer o Plano Acolher →</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 3. Calendário emocional — Plan 1+ */}
                {temPlano1 ? (
                  <View style={s.card}>
                    <Text style={s.cardNum}>3</Text>
                    <Text style={s.cardTit}>Calendário emocional</Text>
                    <Text style={s.cardSub}>Cada cor representa a emoção predominante do dia</Text>
                    <View style={{ marginTop: 12 }}>
                      <CalendarGrid year={year} month={month} checkinsByDate={mesal.byDate} />
                    </View>
                    {/* Legenda do calendário */}
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
                ) : null}

                {/* 4. Emoção predominante */}
                {mesal.dominante && (
                  <View style={s.card}>
                    <Text style={s.cardNum}>4</Text>
                    <Text style={s.cardTit}>Emoção predominante</Text>
                    {(() => {
                      const emo = getEmoObj(mesal.dominante);
                      return (
                        <View style={s.predominRow}>
                          <View style={[s.predominCircle, { backgroundColor: emo?.bg || colors.lav1 }]}>
                            <Ionicons name={`${emo?.icon || 'heart'}-outline`} size={28} color={emo?.color || colors.lav4} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.predominNome, { color: emo?.color || colors.lav4 }]}>{emo?.label || mesal.dominante}</Text>
                            <Text style={s.predominDesc}>foi a emoção mais presente neste mês.</Text>
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                )}

                {/* 5. Seus registros */}
                <View style={s.card}>
                  <Text style={s.cardNum}>5</Text>
                  <Text style={s.cardTit}>Seus registros</Text>
                  <View style={s.statsRow}>
                    <View style={s.statBox}>
                      <Text style={s.statNum}>{mesal.total}</Text>
                      <Text style={s.statLbl}>check-ins realizados</Text>
                    </View>
                    <View style={s.statDivider} />
                    <View style={s.statBox}>
                      <Text style={[s.statNum, { color: mesal.semRegistro > 5 ? colors.rose : colors.sage }]}>{mesal.semRegistro}</Text>
                      <Text style={s.statLbl}>dias sem registro</Text>
                    </View>
                    {temPlano1 && (
                      <>
                        <View style={s.statDivider} />
                        <View style={s.statBox}>
                          <Text style={s.statNum}>{mesal.avgInt}</Text>
                          <Text style={s.statLbl}>intensidade média</Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                {/* 6. Mensagem */}
                <View style={[s.card, s.msgCard]}>
                  <Text style={s.cardNum}>6</Text>
                  <Text style={s.cardTit}>Mensagem para você</Text>
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
            {!temAcesso(3) ? (
              <View style={s.lockedAnnual}>
                <Ionicons name="bar-chart-outline" size={48} color={colors.lav3} />
                <Text style={s.lockedAnnualTit}>Relatório Anual</Text>
                <Text style={s.lockedAnnualDesc}>
                  Veja sua jornada emocional completa do ano — evolução por mês, meses mais intensos, distribuição por trimestre e muito mais.
                </Text>
                <Text style={s.lockedAnnualBadge}>Disponível em breve no Plano Evoluir</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('Planos')}>
                  <Text style={s.emptyBtnTxt}>Ver planos</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Cabeçalho anual */}
                <View style={s.reportHeader}>
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
                    { icon: 'pulse-outline', v: anual.avgInt, lbl: 'intensidade média', color: colors.sage },
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

                {/* 2. Intensidade ao longo do ano */}
                {anual.porMes.some(v => v > 0) && (
                  <View style={s.card}>
                    <Text style={s.cardNum}>2</Text>
                    <Text style={s.cardTit}>Intensidade emocional ao longo do ano</Text>
                    <Text style={s.cardSub}>Média da intensidade por mês (de 1 a 5)</Text>
                    <View style={{ marginTop: 8 }}>
                      <LineChart data={anual.porMes.map((v, i) => v || 0)} color={colors.lav4} height={80} xLabels={MONTH_SHORT} />
                    </View>
                  </View>
                )}

                {/* 3 e 4. Meses intensos e leves */}
                <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
                  <View style={[s.card, { flex: 1, margin: 0 }]}>
                    <Text style={s.cardNum}>3</Text>
                    <Text style={s.cardTit}>Meses mais intensos</Text>
                    {anual.maisIntens.map((x, i) => (
                      <View key={i} style={s.mesRow}>
                        <Text style={s.mesNome}>{MONTH_SHORT[x.m]}</Text>
                        <Text style={[s.mesVal, { color: colors.rose }]}>{x.v.toFixed(1)}</Text>
                        <View style={[s.mesBar, { backgroundColor: colors.rose + '50', width: `${Math.min(x.v / 5 * 100, 100)}%` }]} />
                      </View>
                    ))}
                    {!anual.maisIntens.length && <Text style={s.emptySmall}>—</Text>}
                  </View>
                  <View style={[s.card, { flex: 1, margin: 0 }]}>
                    <Text style={s.cardNum}>4</Text>
                    <Text style={s.cardTit}>Meses mais leves</Text>
                    {anual.maisLeves.map((x, i) => (
                      <View key={i} style={s.mesRow}>
                        <Text style={s.mesNome}>{MONTH_SHORT[x.m]}</Text>
                        <Text style={[s.mesVal, { color: colors.sage }]}>{x.v.toFixed(1)}</Text>
                        <View style={[s.mesBar, { backgroundColor: colors.sage + '50', width: `${Math.min(x.v / 5 * 100, 100)}%` }]} />
                      </View>
                    ))}
                    {!anual.maisLeves.length && <Text style={s.emptySmall}>—</Text>}
                  </View>
                </View>

                {/* 5. Distribuição por trimestre */}
                <View style={s.card}>
                  <Text style={s.cardNum}>5</Text>
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

                {/* 6. Mensagem anual */}
                <View style={[s.card, s.msgCard]}>
                  <Text style={s.cardNum}>6</Text>
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

      </ScrollView>
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

  mesRow: { marginBottom: 8, gap: 2 },
  mesNome: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.td },
  mesVal: { fontFamily: fonts.bodyBold, fontSize: 11 },
  mesBar: { height: 4, borderRadius: 2 },
  emptySmall: { fontFamily: fonts.body, fontSize: 12, color: colors.tl },

  trimRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  trimLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.td, width: 90 },
  trimTrack: { flex: 1, height: 8, backgroundColor: colors.lav1, borderRadius: 4, overflow: 'hidden' },
  trimFill: { height: '100%', borderRadius: 4 },
  trimPct: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.td, width: 32, textAlign: 'right' },

  lockedAnnual: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: spacing.xl },
  lockedAnnualTit: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.td, marginTop: 16 },
  lockedAnnualDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  lockedAnnualBadge: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lav4, marginTop: 16, backgroundColor: colors.lav1, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full },
});
