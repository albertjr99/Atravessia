import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Image, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const ilustracao = require('../../../assets/images/il_broto.png');
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { ScriptTitle, QuoteText, LavandaBg } from '../../components';
import { ProximoPasso } from '../../components/DiarioDoDia';
import { useApp } from '../../hooks/AppContext';
import { hojeStrBR } from '../../utils/date';
import { confirmar } from '../../utils/confirm';
import { iconeDaVitoria } from '../../data/iconesVitoria';

// Quantas opções prontas aparecem antes do "Ver mais".
const OPCOES_VISIVEIS = 8;

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Datas gravadas como 'AAAA-MM-DD' (ou ISO completo, em registros antigos).
const diaDe = (data) => (typeof data === 'string' ? data.slice(0, 10) : '');
const diaUTC = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const diasEntre = (de, ate) => Math.round((diaUTC(ate) - diaUTC(de)) / 86400000);

function rotuloDoDia(iso, hoje) {
  const diff = diasEntre(iso, hoje);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  const [, m, d] = iso.split('-').map(Number);
  const semana = DIAS_SEMANA[new Date(diaUTC(iso)).getUTCDay()];
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${d} de ${MESES[m - 1]}`;
}

function rotuloDoMes(chave) {
  const [a, m] = chave.split('-').map(Number);
  const nome = MESES[m - 1];
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
}

// Organiza o histórico: dias recentes (últimos 7) abertos e o resto agrupado
// por mês, recolhido. Assim a tela continua leve mesmo com muitas vitórias.
function organizarHistorico(vitorias, hoje) {
  const porDia = new Map();
  vitorias.forEach(v => {
    const dia = diaDe(v.data);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return;
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(v);
  });
  const dias = [...porDia.keys()].sort().reverse();

  const recentes = [];
  const meses = new Map();
  dias.forEach(dia => {
    const item = { dia, itens: porDia.get(dia) };
    if (diasEntre(dia, hoje) < 7) recentes.push(item);
    else {
      const mes = dia.slice(0, 7);
      if (!meses.has(mes)) meses.set(mes, []);
      meses.get(mes).push(item);
    }
  });
  return {
    recentes,
    meses: [...meses.entries()].map(([mes, lista]) => ({
      mes, dias: lista, total: lista.reduce((n, d) => n + d.itens.length, 0),
    })),
    diasComVitoria: dias.length,
  };
}

export default function PequenasVitoriasScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { vitorias, adicionarVitoria, removerVitoria, temAcesso } = useApp();
  const [textoCustom, setTextoCustom] = useState('');
  const [mostraInputCustom, setMostraInputCustom] = useState(false);
  const [opcoesFirestore, setOpcoesFirestore] = useState([]);
  const [verTodasOpcoes, setVerTodasOpcoes] = useState(false);
  const [mesesAbertos, setMesesAbertos] = useState({});
  const [registrouAgora, setRegistrouAgora] = useState(false);

  useEffect(() => {
    // Sem orderBy: o Firestore descarta documentos que não tenham o campo
    // ordenado, fazendo opções válidas sumirem da tela.
    const unsub = onSnapshot(collection(db, 'vitoriasOpcoes'), (snap) => {
      setOpcoesFirestore(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(v => v.ativo !== false)
          .sort((a, b) => (a.criadoEm?.toMillis?.() ?? 0) - (b.criadoEm?.toMillis?.() ?? 0))
      );
    }, (e) => console.warn('[PequenasVitorias] opções:', e?.message));
    return unsub;
  }, []);

  const hoje = hojeStrBR();
  const historico = useMemo(() => organizarHistorico(vitorias || [], hoje), [vitorias, hoje]);

  if (!temAcesso(1)) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        <LavandaBg />
        <View style={styles.lockWrap}>
          <Ionicons name="lock-closed-outline" size={36} color={colors.lav4} />
          <Text style={styles.lockTitle}>Disponível no Plano Acolher</Text>
          <Text style={styles.lockSub}>Registre suas conquistas cotidianas e acompanhe sua reconstrução.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Planos')} style={styles.lockBtn}>
            <Text style={styles.lockBtnText}>Ver planos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const registradosHoje = vitorias.filter(v => diaDe(v.data) === hoje).map(v => v.label);
  const semana = vitorias.filter(v => {
    const dia = diaDe(v.data);
    return /^\d{4}-\d{2}-\d{2}$/.test(dia) && diasEntre(dia, hoje) < 7;
  }).length;

  const registrar = (label) => {
    if (!label || registradosHoje.includes(label)) return;
    adicionarVitoria({ label });
    setRegistrouAgora(true);
  };

  // Toque por engano: a vitória de hoje pode ser desfeita. Dias anteriores
  // ficam como estão.
  const pedirRemocao = (label) => {
    const registro = [...vitorias].reverse().find(v => diaDe(v.data) === hoje && v.label === label);
    if (!registro) return;
    confirmar(
      'Desfazer esta vitória?',
      `“${label}” sai do registro de hoje. Você pode marcar de novo quando quiser.`,
      () => removerVitoria(registro).catch(e => console.warn('[PequenasVitorias] remover:', e?.message)),
      'Desfazer',
    );
  };

  const handleAdicionarCustom = () => {
    registrar(textoCustom.trim());
    setTextoCustom('');
    setMostraInputCustom(false);
  };

  // Opções já registradas hoje vão para o fim, para as que faltam ficarem à vista.
  const opcoesOrdenadas = [
    ...opcoesFirestore.filter(o => !registradosHoje.includes(o.label)),
    ...opcoesFirestore.filter(o => registradosHoje.includes(o.label)),
  ];
  const opcoesVisiveis = verTodasOpcoes ? opcoesOrdenadas : opcoesOrdenadas.slice(0, OPCOES_VISIVEIS);
  const ocultas = opcoesOrdenadas.length - opcoesVisiveis.length;
  // Vitórias personalizadas de hoje (que não estão entre as opções prontas).
  const personalizadasHoje = registradosHoje.filter(l => !opcoesFirestore.some(o => o.label === l));

  const renderDia = ({ dia, itens }) => (
    <View key={dia} style={styles.diaCard}>
      <View style={styles.diaTopo}>
        <Text style={styles.diaTitulo}>{rotuloDoDia(dia, hoje)}</Text>
        <Text style={styles.diaQtd}>{itens.length === 1 ? '1 vitória' : `${itens.length} vitórias`}</Text>
      </View>
      <View style={styles.diaItens}>
        {itens.map(v => (dia === hoje ? (
          <TouchableOpacity key={v.id} style={styles.diaItem} onPress={() => pedirRemocao(v.label)} activeOpacity={0.8}>
            <Ionicons name="star" size={11} color={colors.gold} />
            <Text style={styles.diaItemTxt}>{v.label}</Text>
            <Ionicons name="close" size={12} color={colors.tl} />
          </TouchableOpacity>
        ) : (
          <View key={v.id} style={styles.diaItem}>
            <Ionicons name="star" size={11} color={colors.gold} />
            <Text style={styles.diaItemTxt}>{v.label}</Text>
          </View>
        )))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Pequenas Vitórias</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.coluna}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <ScriptTitle size={22}>Cada passo importa</ScriptTitle>
              <QuoteText style={{ marginTop: 6 }}>
                "As grandes reconstruções começam em passos quase invisíveis."
              </QuoteText>
            </View>
            <Image source={ilustracao} style={styles.headerIlustracao} resizeMode="contain" />
          </View>

          {/* Resumo */}
          <View style={styles.resumo}>
            {[
              { valor: registradosHoje.length, rotulo: 'hoje' },
              { valor: semana, rotulo: 'nos últimos 7 dias' },
              { valor: vitorias.length, rotulo: 'no total' },
            ].map((r, i) => (
              <View key={r.rotulo} style={[styles.resumoItem, i > 0 && styles.resumoBorda]}>
                <Text style={styles.resumoValor}>{r.valor}</Text>
                <Text style={styles.resumoRotulo}>{r.rotulo}</Text>
              </View>
            ))}
          </View>

          {/* Registrar */}
          <View style={styles.cartao}>
            <Text style={styles.cartaoTit}>O que você conquistou hoje?</Text>
            <Text style={styles.cartaoSub}>Toque em uma opção ou escreva a sua. Tudo conta.</Text>

            <View style={styles.grid}>
              {opcoesVisiveis.map(v => {
                const jaRegistrada = registradosHoje.includes(v.label);
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.chip, jaRegistrada && styles.chipFeito]}
                    onPress={() => (jaRegistrada ? pedirRemocao(v.label) : registrar(v.label))}
                    activeOpacity={0.85}
                    accessibilityHint={jaRegistrada ? 'Toque para desfazer' : undefined}
                  >
                    <Ionicons
                      name={jaRegistrada ? 'checkmark-circle' : iconeDaVitoria(v)}
                      size={15}
                      color={jaRegistrada ? colors.sageFg : colors.lav5}
                    />
                    <Text
                      style={[styles.chipText, jaRegistrada && styles.chipTextFeito]}
                      numberOfLines={2}
                    >
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {personalizadasHoje.map(l => (
                <TouchableOpacity key={`p-${l}`} style={[styles.chip, styles.chipFeito]} onPress={() => pedirRemocao(l)} activeOpacity={0.85}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.sageFg} />
                  <Text style={[styles.chipText, styles.chipTextFeito]} numberOfLines={2}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {registradosHoje.length > 0 && (
              <Text style={styles.dicaDesfazer}>Marcou por engano? Toque na vitória de hoje para desfazer.</Text>
            )}

            {ocultas > 0 || verTodasOpcoes ? (
              <TouchableOpacity style={styles.verMais} onPress={() => setVerTodasOpcoes(v => !v)}>
                <Text style={styles.verMaisTxt}>
                  {verTodasOpcoes ? 'Mostrar menos' : `Ver mais ${ocultas} ${ocultas === 1 ? 'opção' : 'opções'}`}
                </Text>
                <Ionicons name={verTodasOpcoes ? 'chevron-up' : 'chevron-down'} size={14} color={colors.lav5} />
              </TouchableOpacity>
            ) : null}

            {mostraInputCustom ? (
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  placeholder="Minha conquista de hoje..."
                  placeholderTextColor={colors.tl}
                  value={textoCustom}
                  onChangeText={setTextoCustom}
                  autoFocus
                  maxLength={80}
                  onSubmitEditing={handleAdicionarCustom}
                  returnKeyType="done"
                />
                <TouchableOpacity onPress={handleAdicionarCustom} style={styles.customBtnOk}>
                  <Ionicons name="checkmark" size={16} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setMostraInputCustom(false); setTextoCustom(''); }}
                  style={styles.customBtnCancel}
                >
                  <Ionicons name="close" size={16} color={colors.tl} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.personalizar} onPress={() => setMostraInputCustom(true)} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={15} color={colors.lav5} />
                <Text style={styles.personalizarTxt}>Escrever uma vitória minha</Text>
              </TouchableOpacity>
            )}
          </View>

          {registrouAgora && (
            <ProximoPasso navigation={navigation} depoisDe="vitoria" style={{ marginBottom: spacing.lg }} />
          )}

          {/* Histórico */}
          <Text style={styles.secTit}>Seu caminho de vitórias</Text>
          {vitorias.length === 0 ? (
            <View style={styles.vazio}>
              <Ionicons name="star-outline" size={26} color={colors.lav4} />
              <Text style={styles.vazioTit}>Sua primeira vitória está a um toque</Text>
              <Text style={styles.vazioTxt}>
                Levantar da cama, beber água, pedir ajuda: o que você registrar aparece aqui, organizado por dia.
              </Text>
            </View>
          ) : (
            <>
              {historico.recentes.map(renderDia)}

              {historico.meses.map(({ mes, dias, total }) => {
                const aberto = !!mesesAbertos[mes];
                return (
                  <View key={mes} style={styles.mesBloco}>
                    <TouchableOpacity
                      style={styles.mesTopo}
                      onPress={() => setMesesAbertos(m => ({ ...m, [mes]: !m[mes] }))}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={15} color={colors.lav5} />
                      <Text style={styles.mesTitulo}>{rotuloDoMes(mes)}</Text>
                      <Text style={styles.mesQtd}>
                        {total === 1 ? '1 vitória' : `${total} vitórias`} · {dias.length === 1 ? '1 dia' : `${dias.length} dias`}
                      </Text>
                      <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={16} color={colors.tl} />
                    </TouchableOpacity>
                    {aberto && <View style={styles.mesDias}>{dias.map(renderDia)}</View>}
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  coluna: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: spacing.lg },

  header: { paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center' },
  headerIlustracao: { width: 72, height: 72, marginLeft: 8 },

  resumo: {
    flexDirection: 'row', backgroundColor: colors.lav1, borderRadius: radius.xl,
    paddingVertical: spacing.md, marginBottom: spacing.md,
  },
  resumoItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  resumoBorda: { borderLeftWidth: 1, borderLeftColor: colors.lav2 },
  resumoValor: { fontFamily: fonts.serif, fontSize: 24, color: colors.lav6 },
  resumoRotulo: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 1, textAlign: 'center' },

  cartao: {
    backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, ...shadow.card,
  },
  cartaoTit: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.td },
  cartaoSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2, marginBottom: spacing.md },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    backgroundColor: colors.bg, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 7, paddingHorizontal: 11,
  },
  chipFeito: { backgroundColor: colors.sage + '26', borderColor: colors.sage },
  chipText: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, color: colors.td },
  chipTextFeito: { color: colors.sageFg, fontFamily: fonts.bodyBold },

  dicaDesfazer: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tl, marginTop: 8 },
  verMais: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 8, marginTop: 4 },
  verMaisTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav5 },

  personalizar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lav3, backgroundColor: colors.lav1,
    borderRadius: radius.full, paddingVertical: 10, marginTop: spacing.md,
  },
  personalizarTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.lav5 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  customInput: {
    flex: 1, backgroundColor: colors.bg, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.lav3,
    paddingVertical: 9, paddingHorizontal: 14,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  customBtnOk: {
    backgroundColor: colors.lav4, borderRadius: radius.full,
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
  },
  customBtnCancel: {
    backgroundColor: colors.bg, borderRadius: radius.full,
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },

  secTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: spacing.sm },

  diaCard: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  diaTopo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  diaTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav6 },
  diaQtd: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },
  diaItens: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  diaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%',
    backgroundColor: colors.bg, borderRadius: radius.full,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  diaItemTxt: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, color: colors.td },

  mesBloco: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, overflow: 'hidden',
  },
  mesTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md },
  mesTitulo: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  mesQtd: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },
  mesDias: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xs, backgroundColor: colors.bg },

  vazio: {
    alignItems: 'center', gap: 6, padding: spacing.xl,
    backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
  },
  vazioTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, textAlign: 'center' },
  vazioTxt: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, textAlign: 'center', lineHeight: 18 },

  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  lockTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td, marginTop: 8 },
  lockSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, textAlign: 'center' },
  lockBtn: { marginTop: spacing.md, backgroundColor: colors.lav4, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  lockBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
});
