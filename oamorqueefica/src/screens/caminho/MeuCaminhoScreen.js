import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, criarEstilos } from '../../theme';
import { emocoes } from '../../data';
import { LavandaBg } from '../../components';
import BarraAbas, { ALTURA_BARRA } from '../../components/BarraAbas';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { IA_DIARIO_CARTA } from '../../config/recursos';

const ilCarta = require('../../../assets/images/il_onda_coracao.png');
const ilDiario = require('../../../assets/images/il_broto.png');

const TZ = 'America/Sao_Paulo';
const diaDe = (d) => (typeof d === 'string' ? d.slice(0, 10) : '');
const isoDiasAtras = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString('sv-SE', { timeZone: TZ });
const INICIAIS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const rotuloDia = (iso, hoje) => {
  if (iso === hoje) return 'Hoje';
  if (iso === isoDiasAtras(1)) return 'Ontem';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
};

// Meu caminho: o que a pessoa viveu e registrou — semana emocional, vitórias
// e relatórios (carta do mês e diário guiado entram com a AtravessIA).
export default function MeuCaminhoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { checkins, vitorias } = useApp();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [periodo, setPeriodo] = useState('semana');
  const [paginas, setPaginas] = useState([]);

  useEffect(() => {
    if (!uid || !IA_DIARIO_CARTA) return undefined;
    return onSnapshot(collection(db, 'usuarios', uid, 'diario'),
      (snap) => setPaginas(snap.docs.map(d => d.data())),
      (e) => console.warn('[Meu caminho] diário:', e?.message));
  }, [uid]);

  const hoje = isoDiasAtras(0);
  const semana = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const iso = isoDiasAtras(6 - i);
    const doDia = (checkins || []).filter(c => diaDe(c.data) === iso);
    const ultimo = doDia[doDia.length - 1];
    const emo = ultimo ? emocoes.find(e => e.id === ultimo.emocao) : null;
    const dow = new Date(`${iso}T12:00:00`).getDay();
    return { iso, emo, inicial: iso === hoje ? 'Hoje' : INICIAIS[dow] };
  }), [checkins, hoje]);

  const inicioPeriodo = periodo === 'semana' ? isoDiasAtras(6) : `${hoje.slice(0, 7)}-01`;
  const noPeriodo = (lista) => (lista || []).filter(x => diaDe(x.data) >= inicioPeriodo && diaDe(x.data) <= hoje);
  const ckPeriodo = noPeriodo(checkins);
  const vtPeriodo = noPeriodo(vitorias);
  const dgPeriodo = noPeriodo(paginas);

  const resumo = useMemo(() => {
    if (ckPeriodo.length === 0) return null;
    const dias = {};
    ckPeriodo.forEach(c => { (dias[c.emocao] = dias[c.emocao] || new Set()).add(diaDe(c.data)); });
    const ordem = Object.entries(dias).sort((a, b) => b[1].size - a[1].size);
    const [idTop, setTop] = ordem[0];
    const top = emocoes.find(e => e.id === idTop);
    const positiva = ordem.map(([id]) => emocoes.find(e => e.id === id)).find(e => e?.positiva && e.id !== idTop);
    const n = setTop.size;
    let txt = `${top?.label || 'Uma emoção'} apareceu em ${n} ${n === 1 ? 'dia' : 'dias'}.`;
    if (positiva) txt += ` ${positiva.label} também esteve por perto.`;
    return `${txt} Cada dia conta.`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ckPeriodo.length, periodo, checkins]);

  const ultimasVitorias = useMemo(() => [...(vitorias || [])]
    .sort((a, b) => diaDe(b.data).localeCompare(diaDe(a.data)))
    .slice(0, 3), [vitorias]);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: ALTURA_BARRA + Math.max(insets.bottom, 8) + 28 }}
      >
        <View style={s.coluna}>
          <Text style={s.titulo}>Meu caminho</Text>
          <Text style={s.sub}>Tudo o que você viveu e registrou, num só lugar.</Text>

          <View style={s.segmento} accessibilityRole="tablist">
            {[{ id: 'semana', r: 'Esta semana' }, { id: 'mes', r: 'Este mês' }].map(p => (
              <TouchableOpacity key={p.id} style={[s.segBtn, periodo === p.id && s.segBtnSel]} onPress={() => setPeriodo(p.id)}
                accessibilityRole="tab" accessibilityState={{ selected: periodo === p.id }}>
                <Text style={[s.segTxt, periodo === p.id && s.segTxtSel]}>{p.r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.cartao}>
            <View style={s.semana}>
              {semana.map(d => (
                <View key={d.iso} style={s.dia}>
                  <Text style={[s.diaTxt, d.iso === hoje && s.diaTxtHoje]}>{d.inicial}</Text>
                  {d.emo ? (
                    <View style={[s.bolinha, { backgroundColor: d.emo.bg }, d.iso === hoje && s.bolinhaHoje]} accessibilityLabel={`${d.inicial}: ${d.emo.label}`}>
                      <Ionicons name={`${d.emo.icon}-outline`} size={14} color={d.emo.color} />
                    </View>
                  ) : (
                    <View style={[s.bolinha, s.bolinhaVazia, d.iso === hoje && s.bolinhaHoje]} />
                  )}
                </View>
              ))}
            </View>
            {resumo ? <Text style={s.resumo}>{resumo}</Text> : (
              <TouchableOpacity onPress={() => navigation.navigate('CheckIn')}>
                <Text style={s.resumo}>Seus check-ins aparecem aqui. <Text style={s.link}>Que tal começar hoje?</Text></Text>
              </TouchableOpacity>
            )}
            <View style={s.numeros}>
              <View style={[s.numero, { backgroundColor: colors.lav1 }]}>
                <Text style={[s.numeroN, { color: colors.lav5 }]}>{ckPeriodo.length}</Text>
                <Text style={s.numeroL}>{ckPeriodo.length === 1 ? 'check-in' : 'check-ins'}</Text>
              </View>
              <View style={[s.numero, { backgroundColor: colors.douradoFundo }]}>
                <Text style={[s.numeroN, { color: colors.goldFg }]}>{vtPeriodo.length}</Text>
                <Text style={s.numeroL}>{vtPeriodo.length === 1 ? 'vitória' : 'vitórias'}</Text>
              </View>
              {IA_DIARIO_CARTA && (
                <View style={[s.numero, { backgroundColor: colors.sageFundo }]}>
                  <Text style={[s.numeroN, { color: colors.sageFg }]}>{dgPeriodo.length}</Text>
                  <Text style={s.numeroL}>{dgPeriodo.length === 1 ? 'página no diário' : 'páginas no diário'}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={s.cartao}>
            <View style={s.cabecalho}>
              <View style={s.cabTitLinha}>
                <Ionicons name="star-outline" size={18} color={colors.goldFg} />
                <Text style={s.cartaoTit}>Pequenas vitórias</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('PequenasVitorias')} style={s.linkCaixa}>
                <Text style={s.link}>Histórico</Text>
              </TouchableOpacity>
            </View>
            {ultimasVitorias.length > 0 ? (
              <View style={s.chips}>
                {ultimasVitorias.map((v, i) => (
                  <View key={v.id || i} style={[s.chip, diaDe(v.data) === hoje && s.chipHoje]}>
                    <Text style={[s.chipTxt, diaDe(v.data) === hoje && s.chipTxtHoje]} numberOfLines={1}>
                      {rotuloDia(diaDe(v.data), hoje)} · {v.label || v.texto}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={s.resumo}>Um passo, por menor que seja, merece ser lembrado.</Text>
            )}
            <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('PequenasVitorias')} activeOpacity={0.88}>
              <Text style={s.btnTxt}>Registrar uma vitória</Text>
            </TouchableOpacity>
          </View>

          {IA_DIARIO_CARTA && (
          <View style={s.dupla}>
            <TouchableOpacity style={[s.cartao, s.tile]} onPress={() => navigation.navigate('CartaMes')} activeOpacity={0.88}>
              <Image source={ilCarta} style={s.tileImg} />
              <Text style={s.cartaoTit}>Carta do mês</Text>
              <Text style={s.tileTxt}>Seu mês contado com carinho pela AtravessIA.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.cartao, s.tile]} onPress={() => navigation.navigate('DiarioGuiado')} activeOpacity={0.88}>
              <Image source={ilDiario} style={s.tileImg} />
              <Text style={s.cartaoTit}>Diário guiado</Text>
              <Text style={s.tileTxt}>Uma pergunta por dia para escrever no seu ritmo.</Text>
            </TouchableOpacity>
          </View>
          )}

          <View style={[s.cartao, s.lista]}>
            <Text style={[s.cartaoTit, s.listaTit]}>Relatórios</Text>
            {[
              { r: 'Relatório do mês', sub: 'Suas emoções, áreas da vida e vitórias', tab: 'mensal' },
              { r: 'Relatório do ano', sub: 'Como o ano foi se desenhando', tab: 'anual' },
              { r: 'Relatório de um período', sub: 'Escolha as datas que quiser', tab: 'personalizado' },
            ].map(item => (
              <TouchableOpacity key={item.tab} style={s.linha} onPress={() => navigation.navigate('Relatorios', { tab: item.tab })} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={s.linhaTxt}>{item.r}</Text>
                  <Text style={s.linhaSub}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.tl} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      <BarraAbas navigation={navigation} ativo="caminho" />
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  coluna: { width: '100%', paddingHorizontal: 16 },
  titulo: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 36, lineHeight: 40, color: colors.titulo, paddingHorizontal: 4 },
  sub: { fontFamily: 'Lato_400Regular', fontSize: 14.5, color: colors.texto2, paddingHorizontal: 4, marginTop: 2 },
  segmento: {
    flexDirection: 'row', gap: 4, padding: 4, marginTop: 18, borderRadius: 22,
    backgroundColor: colors.escuro ? '#2A2439' : '#EFEAF7',
  },
  segBtn: { flex: 1, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segBtnSel: { backgroundColor: colors.card },
  segTxt: { fontFamily: 'Lato_400Regular', fontSize: 14, color: colors.texto2 },
  segTxtSel: { fontFamily: 'Lato_700Bold', color: colors.titulo },
  cartao: { marginTop: 14, padding: 18, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaSuave, gap: 12 },
  semana: { flexDirection: 'row', justifyContent: 'space-between' },
  dia: { flex: 1, alignItems: 'center', gap: 6 },
  diaTxt: { fontFamily: 'Lato_400Regular', fontSize: 11.5, color: colors.texto2 },
  diaTxtHoje: { fontFamily: 'Lato_700Bold', color: colors.titulo },
  bolinha: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bolinhaVazia: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lav2 },
  bolinhaHoje: { borderWidth: 2, borderColor: colors.lav4 },
  resumo: { fontFamily: 'Lato_400Regular', fontSize: 14, lineHeight: 21, color: colors.texto2 },
  link: { fontFamily: 'Lato_700Bold', fontSize: 13.5, color: colors.lav5 },
  linkCaixa: { minHeight: 36, justifyContent: 'center' },
  numeros: { flexDirection: 'row', gap: 8 },
  numero: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 16, alignItems: 'center' },
  numeroN: { fontFamily: 'Lato_700Bold', fontSize: 20 },
  numeroL: { fontFamily: 'Lato_400Regular', fontSize: 12, color: colors.texto2, textAlign: 'center' },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cabTitLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartaoTit: { fontFamily: 'Lato_700Bold', fontSize: 16, color: colors.titulo },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.bg, justifyContent: 'center', maxWidth: '100%' },
  chipHoje: { backgroundColor: colors.douradoFundo },
  chipTxt: { fontFamily: 'Lato_400Regular', fontSize: 13, color: colors.texto2 },
  chipTxtHoje: { color: colors.goldFg },
  btn: { height: 46, borderRadius: 23, backgroundColor: colors.botaoForte, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { fontFamily: 'Lato_700Bold', fontSize: 14.5, color: '#FFFFFF' },
  dupla: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, gap: 8, padding: 16 },
  tileImg: { width: 56, height: 56, borderRadius: 14 },
  tileTxt: { fontFamily: 'Lato_400Regular', fontSize: 13, lineHeight: 18, color: colors.texto2 },
  lista: { paddingHorizontal: 0, paddingVertical: 4, gap: 0 },
  listaTit: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  linha: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  linhaTxt: { fontFamily: 'Lato_400Regular', fontSize: 14.5, color: colors.titulo },
  linhaSub: { fontFamily: 'Lato_400Regular', fontSize: 12.5, color: colors.texto2, marginTop: 1 },
}), { escalar: false });
