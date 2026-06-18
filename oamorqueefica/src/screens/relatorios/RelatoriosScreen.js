import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { emocoes, audios, conteudosComplementares } from '../../data';
import { ScriptTitle, Card, ProgressBar } from '../../components';
import { useApp } from '../../hooks/AppContext';

const DIAS_PERIODO = { semana: 7, mes: 30, ano: 365 };

function diasDesde(dataStr) {
  return Math.floor((new Date() - new Date(dataStr)) / 86400000);
}

function filtrarPeriodo(checkins, periodo) {
  const limite = DIAS_PERIODO[periodo];
  return checkins.filter(c => diasDesde(c.data) < limite);
}

function periodoAnterior(checkins, periodo) {
  const limite = DIAS_PERIODO[periodo];
  return checkins.filter(c => {
    const d = diasDesde(c.data);
    return d >= limite && d < limite * 2;
  });
}

function pctNegativas(lista) {
  if (lista.length === 0) return null;
  const negativas = lista.filter(c => emocoes.find(e => e.id === c.emocao)?.positiva === false).length;
  return negativas / lista.length;
}

export default function RelatoriosScreen({ navigation }) {
  const { checkins, usuario, vitorias, temAcesso } = useApp();

  const periodosDisponiveis = temAcesso(3) ? ['semana', 'mes', 'ano'] : temAcesso(2) ? ['semana', 'mes'] : ['mes'];
  const [periodo, setPeriodo] = useState(periodosDisponiveis[0]);

  const checkinsPeriodo = filtrarPeriodo(checkins, periodo);
  const contagem = {};
  checkinsPeriodo.forEach(c => { contagem[c.emocao] = (contagem[c.emocao] || 0) + 1; });
  const total = checkinsPeriodo.length || 1;
  const sorted = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

  const sequencia = (() => {
    let seq = 0;
    const hoje = new Date();
    for (let i = checkins.length - 1; i >= 0; i--) {
      const diff = Math.floor((hoje - new Date(checkins[i].data)) / 86400000);
      if (diff === checkins.length - 1 - i) seq++;
      else break;
    }
    return seq;
  })();

  const emocaoDominante = sorted[0]?.[0];
  const emoDom = emocoes.find(e => e.id === emocaoDominante);

  // ---- Sugestão personalizada (Plano 2+): conteúdo ligado à emoção mais frequente do período ----
  const sugestao = temAcesso(2) && emoDom
    ? (audios.find(a => a.emocoes?.includes(emoDom.id) && a.plano <= usuario.plano)
        || conteudosComplementares.find(c => c.categoria === 'respiracao' || c.categoria === 'meditacao'))
    : null;

  // ---- Plano de ação (Plano 3): compara o período atual com o anterior de mesma duração ----
  const acaoPlano = (() => {
    if (!temAcesso(3)) return null;
    const atual = pctNegativas(checkinsPeriodo);
    const anterior = pctNegativas(periodoAnterior(checkins, periodo));
    if (atual === null) return null;

    if (anterior !== null && atual - anterior >= 0.2) {
      return {
        icone: 'cloud-outline',
        titulo: 'Um período mais desafiador',
        texto: 'Percebemos que este período foi especialmente desafiador. Você não precisa atravessar tudo sozinho — considere se aproximar de alguém da sua rede de apoio.',
        cta: { label: 'Ver rede de apoio', screen: 'RedeApoio' },
      };
    }
    if (anterior !== null && anterior - atual >= 0.2) {
      return {
        icone: 'trending-up-outline',
        titulo: 'Evolução positiva',
        texto: 'Percebemos avanços importantes na sua caminhada em relação ao período anterior. Continue respeitando seu próprio ritmo.',
        cta: null,
      };
    }
    if (atual >= 0.6) {
      return {
        icone: 'leaf-outline',
        titulo: 'Plano de ação sugerido',
        texto: 'As emoções mais difíceis estiveram presentes com frequência. Que tal reservar alguns minutos para uma técnica de respiração ou meditação guiada?',
        cta: { label: 'Ver conteúdos', screen: 'Audios' },
      };
    }
    return null;
  })();

  const labelPeriodo = { semana: 'da semana', mes: 'do mês', ano: 'do ano' };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <ScriptTitle size={24}>Relatórios</ScriptTitle>
          <Text style={styles.sub}>Seu acompanhamento emocional</Text>
        </View>

        {periodosDisponiveis.length > 1 && (
          <View style={styles.periodoRow}>
            {periodosDisponiveis.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.periodoBtn, periodo === p && styles.periodoBtnSel]}
                onPress={() => setPeriodo(p)}
              >
                <Text style={[styles.periodoTxt, periodo === p && styles.periodoTxtSel]}>
                  {p === 'semana' ? 'Semana' : p === 'mes' ? 'Mês' : 'Ano'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Cards de resumo */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Check-ins {labelPeriodo[periodo]}</Text>
            <Text style={styles.statNumber}>{checkinsPeriodo.length}</Text>
            <Text style={styles.statSub}>registros</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Sequência</Text>
            <Text style={[styles.statNumber, { color: colors.peach2 }]}>{sequencia}</Text>
            <Text style={styles.statSub}>dias seguidos</Text>
          </View>
        </View>

        {/* Emoções predominantes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emoções {labelPeriodo[periodo]}</Text>
          <Card style={{ gap: 12 }}>
            {sorted.map(([id, qtd]) => {
              const emo = emocoes.find(e => e.id === id);
              if (!emo) return null;
              const pct = Math.round((qtd / total) * 100);
              return (
                <View key={id}>
                  <View style={styles.emoRow}>
                    <View style={[styles.emoDot, { backgroundColor: emo.color }]} />
                    <Text style={styles.emoNome}>{emo.label}</Text>
                    <Text style={[styles.emoPct, { color: emo.color }]}>{pct}%</Text>
                  </View>
                  <ProgressBar progress={pct / 100} color={emo.color} />
                </View>
              );
            })}
            {sorted.length === 0 && (
              <Text style={styles.emptyText}>Faça check-ins para ver os dados aqui.</Text>
            )}
          </Card>
        </View>

        {/* Mensagem de evolução */}
        {emoDom && (
          <View style={styles.section}>
            <Card style={[styles.evolCard, { borderColor: emoDom.color, borderWidth: 1 }]}>
              <View style={styles.evolRow}>
                <Ionicons name="trending-up-outline" size={18} color={emoDom.color} />
                <Text style={styles.evolTitle}>Nota de evolução</Text>
              </View>
              <Text style={styles.evolText}>
                Sua emoção mais frequente {labelPeriodo[periodo]} foi <Text style={{ color: emoDom.color, fontFamily: fonts.bodyBold }}>{emoDom.label.toLowerCase()}</Text>. Cada sentimento que você nomeia é um passo de autoconhecimento. Continue cuidando de si.
              </Text>
            </Card>
          </View>
        )}

        {/* Sugestão personalizada (Plano 2+) */}
        {sugestao && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sugestão personalizada para você</Text>
            <Card style={styles.suggCard}>
              <Text style={styles.suggIntro}>Preparamos algo com base em como você se sentiu {labelPeriodo[periodo]}:</Text>
              <View style={styles.suggRow}>
                <View style={styles.suggThumb}>
                  <Ionicons name="headset-outline" size={20} color={colors.lav5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggTit}>{sugestao.titulo}</Text>
                  <Text style={styles.suggSub}>{sugestao.duracao}</Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Plano de ação / evolução emocional (Plano 3) */}
        {acaoPlano && (
          <View style={styles.section}>
            <Card style={styles.acaoCard}>
              <View style={styles.evolRow}>
                <Ionicons name={acaoPlano.icone} size={18} color={colors.lav6} />
                <Text style={styles.evolTitle}>{acaoPlano.titulo}</Text>
              </View>
              <Text style={styles.evolText}>{acaoPlano.texto}</Text>
              {acaoPlano.cta && (
                <TouchableOpacity onPress={() => navigation.navigate(acaoPlano.cta.screen)} style={styles.acaoCta}>
                  <Text style={styles.acaoCtaTxt}>{acaoPlano.cta.label}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.lav5} />
                </TouchableOpacity>
              )}
            </Card>
          </View>
        )}

        {/* Pequenas vitórias (Plano 3) */}
        {temAcesso(3) && vitorias.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pequenas vitórias {labelPeriodo[periodo]}</Text>
            <Card>
              <Text style={styles.evolText}>
                Você registrou <Text style={{ fontFamily: fonts.bodyBold, color: colors.lav6 }}>{vitorias.length}</Text> conquista(s). Cada passo importa.
              </Text>
            </Card>
          </View>
        )}

        {/* Histórico semanal */}
        <View style={styles.section}>
          <View style={styles.histHeader}>
            <Text style={styles.sectionTitle}>Histórico recente</Text>
          </View>
          <Card>
            <View style={styles.historicoLinha}>
              {checkins.slice(-7).map((c, i) => {
                const emo = emocoes.find(e => e.id === c.emocao);
                const data = new Date(c.data);
                return (
                  <View key={i} style={styles.histPt}>
                    <View style={[styles.histDot, { backgroundColor: emo?.color || colors.lav3 }]} />
                    <Text style={styles.histLbl}>
                      {data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legendRow}>
              {emocoes.slice(0, 4).map(e => (
                <View key={e.id} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: e.color }]} />
                  <Text style={styles.legendLabel}>{e.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },
  periodoRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 8, marginBottom: spacing.md },
  periodoBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  periodoBtnSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  periodoTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  periodoTxtSel: { fontFamily: fonts.bodyBold, color: colors.lav6 },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 12, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center' },
  statLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginBottom: 4, textAlign: 'center' },
  statNumber: { fontFamily: fonts.bodyBold, fontSize: 28, color: colors.lav5 },
  statSub: { fontFamily: fonts.body, fontSize: 10, color: colors.sageFg },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  emoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  emoDot: { width: 10, height: 10, borderRadius: 5 },
  emoNome: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  emoPct: { fontFamily: fonts.bodyBold, fontSize: 13 },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', paddingVertical: spacing.md },
  evolCard: { padding: spacing.md, backgroundColor: colors.lav1 },
  evolRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  evolTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  evolText: { fontFamily: fonts.quote, fontSize: 13, fontStyle: 'italic', color: colors.td, lineHeight: 20 },
  suggCard: { gap: 10 },
  suggIntro: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  suggRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggThumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  suggTit: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  suggSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: 2 },
  acaoCard: { padding: spacing.md, backgroundColor: '#FBF0E5', borderWidth: 1, borderColor: colors.peach2 },
  acaoCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  acaoCtaTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav5 },
  histHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historicoLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  histPt: { alignItems: 'center', gap: 4 },
  histDot: { width: 12, height: 12, borderRadius: 6 },
  histLbl: { fontFamily: fonts.body, fontSize: 8, color: colors.tl },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.tm },
});
