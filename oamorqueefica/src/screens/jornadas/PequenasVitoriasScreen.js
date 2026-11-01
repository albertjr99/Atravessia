import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Image, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const ilustracao = require('../../../assets/images/il_broto.png');
const ilVazio = require('../../../assets/images/il_mulher_flores.png');
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { AvatarTravessinho, useComemoracaoTravessinho, useTravessinhosAtivos } from '../../components/Travessinho';
import { ProximoPasso } from '../../components/DiarioDoDia';
import { useApp } from '../../hooks/AppContext';
import { hojeStrBR } from '../../utils/date';
import { confirmar } from '../../utils/confirm';
import { vibrarLeve, vibrarSucesso } from '../../utils/vibrar';
import { iconeDaVitoria } from '../../data/iconesVitoria';

// Quantas opções prontas aparecem antes do "Ver mais".
const OPCOES_VISIVEIS = 8;

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const TZ = 'America/Sao_Paulo';
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const diaBrasilia = (date) => (
  date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('sv-SE', { timeZone: TZ })
    : ''
);

// Dia (AAAA-MM-DD, horário de Brasília) de um valor de data em qualquer formato
// já gravado: 'AAAA-MM-DD', 'DD/MM/AAAA', ISO com hora (ex.: '...T02:10:00.000Z'),
// Timestamp do Firestore, Date ou milissegundos.
function diaDoValor(valor) {
  if (valor == null || valor === '') return '';
  if (typeof valor === 'string') {
    const t = valor.trim();
    if (RE_DIA.test(t)) return t;
    const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    // ISO com fuso (Z ou ±hh:mm): converte para o dia de Brasília. Antes o
    // texto era cortado nos 10 primeiros caracteres, que é o dia em UTC — uma
    // vitória registrada depois das 21h caía no dia (e às vezes no mês) seguinte.
    if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/i.test(t)) return diaBrasilia(new Date(t));
    // ISO sem fuso: a data escrita já é a local.
    if (/^\d{4}-\d{2}-\d{2}[T ]/.test(t)) return t.slice(0, 10);
    return diaBrasilia(new Date(t));
  }
  if (typeof valor === 'number') return diaBrasilia(new Date(valor));
  if (valor instanceof Date) return diaBrasilia(valor);
  if (typeof valor.toDate === 'function') return diaBrasilia(valor.toDate());
  if (typeof valor.seconds === 'number') return diaBrasilia(new Date(valor.seconds * 1000));
  return '';
}

// Dia da vitória. Registros sem `data` legível (Timestamp, formato antigo ou
// ausente) eram descartados do agrupamento e ficavam fora dos meses; agora
// todos passam pelo mesmo cálculo, com `criadoEm` como reserva.
const diaDe = (v) => {
  const dia = diaDoValor(v?.data);
  return RE_DIA.test(dia) ? dia : diaDoValor(v?.criadoEm);
};
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

// Organiza o histórico: TODOS os dias agrupados por mês (do mais recente ao
// mais antigo). Antes os últimos 7 dias ficavam soltos, fora dos meses, e o
// resto do mesmo mês ficava dentro do grupo — o mês atual aparecia partido.
// Agora o mês atual (e o de dias recentes) já vem aberto e os outros, recolhidos.
function organizarHistorico(vitorias, hoje) {
  const porDia = new Map();
  vitorias.forEach(v => {
    const dia = diaDe(v);
    if (!RE_DIA.test(dia)) return;
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(v);
  });
  const dias = [...porDia.keys()].sort().reverse();

  const meses = new Map();
  dias.forEach(dia => {
    const mes = dia.slice(0, 7);
    if (!meses.has(mes)) meses.set(mes, { mes, dias: [], total: 0, recente: false });
    const grupo = meses.get(mes);
    const itens = porDia.get(dia);
    grupo.dias.push({ dia, itens });
    grupo.total += itens.length;
    if (diasEntre(dia, hoje) < 7) grupo.recente = true;
  });
  return {
    meses: [...meses.values()].map(g => ({ ...g, abertoPadrao: g.recente || g.mes === hoje.slice(0, 7) })),
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
  const travessinhosAtivos = useTravessinhosAtivos();
  const { comemorar, elemento: festaTravessinho } = useComemoracaoTravessinho();

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
          <View style={styles.lockCard}>
            <Moldura source={ilustracao} tamanho={104} />
            <View style={styles.lockChip}>
              <Ionicons name="lock-closed" size={12} color={colors.lilasTexto} />
              <Text style={styles.lockTitle}>Disponível no Plano Acolher</Text>
            </View>
            <Text style={styles.lockSub}>Registre suas conquistas cotidianas e acompanhe sua reconstrução.</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Planos')} style={styles.lockBtn} activeOpacity={0.85}>
              <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <Text style={styles.lockBtnText}>Ver planos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const registradosHoje = vitorias.filter(v => diaDe(v) === hoje).map(v => v.label);
  const semana = vitorias.filter(v => {
    const dia = diaDe(v);
    return RE_DIA.test(dia) && diasEntre(dia, hoje) >= 0 && diasEntre(dia, hoje) < 7;
  }).length;

  const registrar = (label) => {
    if (!label || registradosHoje.includes(label)) return;
    adicionarVitoria({ label });
    vibrarSucesso();
    setRegistrouAgora(true);
    const frases = [
      'Isso conta, e muito! Que bom ver você celebrando os passos do caminho.',
      'Mais uma vitória guardada. Cada passinho importa!',
      'Que orgulho desse passo! Ele já ficou guardado no seu caminho.',
    ];
    comemorar(['nanda', 'maju', 'brian'][registradosHoje.length % 3], frases[registradosHoje.length % frases.length]);
  };

  // Toque por engano: a vitória de hoje pode ser desfeita. Dias anteriores
  // ficam como estão.
  const pedirRemocao = (label) => {
    const registro = [...vitorias].reverse().find(v => diaDe(v) === hoje && v.label === label);
    if (!registro) return;
    confirmar(
      'Desfazer esta vitória?',
      `“${label}” sai do registro de hoje. Você pode marcar de novo quando quiser.`,
      () => { vibrarLeve(); return removerVitoria(registro).catch(e => console.warn('[PequenasVitorias] remover:', e?.message)); },
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
            <Ionicons name="star" size={12} color={colors.escuro ? '#E5C68B' : '#C9A15A'} />
            <Text style={styles.diaItemTxt}>{v.label}</Text>
            <Ionicons name="close" size={13} color={colors.texto2} />
          </TouchableOpacity>
        ) : (
          <View key={v.id} style={styles.diaItem}>
            <Ionicons name="star" size={12} color={colors.escuro ? '#E5C68B' : '#C9A15A'} />
            <Text style={styles.diaItemTxt}>{v.label}</Text>
          </View>
        )))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.titulo} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>Pequenas Vitórias</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.coluna}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>Cada passo importa</Text>
              <Text style={styles.citacao}>
                "As grandes reconstruções começam em passos quase invisíveis."
              </Text>
            </View>
            <Moldura source={ilustracao} tamanho={76} />
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
                      color={jaRegistrada ? colors.sageFg : colors.lilasIcone}
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
                <Ionicons name={verTodasOpcoes ? 'chevron-up' : 'chevron-down'} size={15} color={colors.lilasTexto} />
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
                <TouchableOpacity onPress={handleAdicionarCustom} style={styles.customBtnOk} accessibilityLabel="Registrar">
                  <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                  <Ionicons name="checkmark" size={18} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setMostraInputCustom(false); setTextoCustom(''); }}
                  style={styles.customBtnCancel}
                >
                  <Ionicons name="close" size={18} color={colors.texto2} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.personalizar} onPress={() => setMostraInputCustom(true)} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={16} color={colors.lilasTexto} />
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
              {travessinhosAtivos ? <AvatarTravessinho quem="nanda" tamanho={96} comNome /> : <Moldura source={ilVazio} tamanho={112} />}
              <Text style={styles.vazioTit}>Sua primeira vitória está a um toque</Text>
              <Text style={styles.vazioTxt}>
                Levantar da cama, beber água, pedir ajuda: o que você registrar aparece aqui, organizado por dia.
              </Text>
            </View>
          ) : (
            <>
              {historico.meses.map(({ mes, dias, total, abertoPadrao }) => {
                const aberto = mesesAbertos[mes] ?? abertoPadrao;
                return (
                  <View key={mes} style={styles.mesBloco}>
                    <TouchableOpacity
                      style={styles.mesTopo}
                      onPress={() => setMesesAbertos(m => ({ ...m, [mes]: !(m[mes] ?? abertoPadrao) }))}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: aberto }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.mesIcone}>
                        <Ionicons name="calendar-outline" size={16} color={colors.lilasIcone} />
                      </View>
                      <Text style={styles.mesTitulo}>{rotuloDoMes(mes)}</Text>
                      <Text style={styles.mesQtd}>
                        {total === 1 ? '1 vitória' : `${total} vitórias`} · {dias.length === 1 ? '1 dia' : `${dias.length} dias`}
                      </Text>
                      <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={17} color={colors.texto2} />
                    </TouchableOpacity>
                    {aberto && <View style={styles.mesDias}>{dias.map(renderDia)}</View>}
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
      {festaTravessinho}
    </SafeAreaView>
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

// Ilustração da marca numa moldura arredondada (sem tintColor).
function Moldura({ source, tamanho = 120 }) {
  const extra = Math.round(tamanho * 0.1);
  return (
    <View style={{
      width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.26), overflow: 'hidden',
      borderWidth: 1, borderColor: colors.bordaLuz, backgroundColor: colors.cardSolido, flexShrink: 0,
    }}>
      <Image source={source} style={{ width: tamanho + extra * 2, height: tamanho + extra * 2, margin: -extra }} resizeMode="cover" />
    </View>
  );
}

const styles = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: colors.escuro ? 0.25 : 0.08, shadowRadius: 10, elevation: 2,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.titulo },
  coluna: { width: '100%', paddingHorizontal: spacing.lg, paddingTop: 8 },

  header: { paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  titulo: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.titulo },
  citacao: { fontFamily: fonts.quote, fontSize: 18, lineHeight: 25, color: colors.texto2, marginTop: 4 },

  resumo: { ...vidro(), flexDirection: 'row', paddingVertical: 16, marginBottom: spacing.md },
  resumoItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  resumoBorda: { borderLeftWidth: 1, borderLeftColor: colors.bordaSuave },
  resumoValor: { fontFamily: 'Figtree_800ExtraBold', fontSize: 28, lineHeight: 32, color: colors.lilasTexto },
  resumoRotulo: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.texto2, marginTop: 2, textAlign: 'center' },

  cartao: { ...vidro(), padding: 18, marginBottom: spacing.lg },
  cartaoTit: { fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 24, color: colors.titulo },
  cartaoSub: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2, marginBottom: spacing.md },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7, maxWidth: '100%',
    backgroundColor: colors.lavVeu, borderRadius: radius.full,
    borderWidth: 1, borderColor: 'transparent',
    minHeight: 40, paddingVertical: 7, paddingHorizontal: 13,
  },
  chipFeito: { backgroundColor: colors.sageFundo, borderColor: colors.escuro ? 'rgba(159,208,176,0.35)' : '#BFDCC9' },
  chipText: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.titulo },
  chipTextFeito: { color: colors.sageFg, fontFamily: fonts.bodyBold },

  dicaDesfazer: { fontFamily: fonts.body, fontSize: 12, color: colors.texto2, marginTop: 10 },
  verMais: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 8, marginTop: 4 },
  verMaisTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lilasTexto },

  personalizar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lav3, backgroundColor: colors.vidro,
    borderRadius: radius.full, minHeight: 46, marginTop: spacing.md,
  },
  personalizarTxt: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.lilasTexto },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  customInput: {
    flex: 1, backgroundColor: colors.cardSolido, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, minHeight: 48,
    paddingVertical: 10, paddingHorizontal: 14,
    fontFamily: fonts.body, fontSize: 14, color: colors.titulo,
  },
  customBtnOk: {
    backgroundColor: colors.botao, borderRadius: 24, overflow: 'hidden',
    width: 46, height: 46, alignItems: 'center', justifyContent: 'center',
  },
  customBtnCancel: {
    backgroundColor: colors.vidro, borderRadius: 24,
    width: 46, height: 46, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.bordaLuz,
  },

  secTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, marginBottom: spacing.sm, paddingHorizontal: 4 },

  diaCard: { ...vidro(), borderRadius: 22, padding: 16, marginBottom: 10 },
  diaTopo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  diaTitulo: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.titulo },
  diaQtd: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.lilasTexto },
  diaItens: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  diaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    backgroundColor: colors.douradoFundo, borderRadius: radius.full,
    paddingVertical: 6, paddingHorizontal: 11,
  },
  diaItemTxt: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.douradoTitulo },

  mesBloco: { ...vidro(), borderRadius: 22, marginBottom: 10, overflow: 'hidden' },
  mesTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  mesIcone: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  mesTitulo: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.titulo },
  mesQtd: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.texto2 },
  mesDias: { paddingHorizontal: 10, paddingBottom: 6, borderTopWidth: 1, borderTopColor: colors.bordaSuave, paddingTop: 10 },

  vazio: { ...vidro(), alignItems: 'center', gap: 8, padding: spacing.xl },
  vazioTit: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, color: colors.titulo, textAlign: 'center', marginTop: 6 },
  vazioTxt: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', lineHeight: 20 },

  lockWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  lockCard: { ...vidro(), alignItems: 'center', padding: spacing.xl, gap: 10 },
  lockChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.lav1, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, marginTop: 6 },
  lockTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lilasTexto },
  lockSub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', lineHeight: 20 },
  lockBtn: { marginTop: spacing.sm, backgroundColor: colors.botao, borderRadius: radius.full, overflow: 'hidden', paddingHorizontal: 28, minHeight: 50, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: colors.botaoBase },
  lockBtnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: 'white' },
}));
