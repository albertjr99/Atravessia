import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { emocoes } from '../../data';
import { ScriptTitle, Card, ProgressBar } from '../../components';
import { useApp } from '../../hooks/AppContext';

export default function RelatoriosScreen() {
  const { checkins } = useApp();

  const contagem = {};
  checkins.forEach(c => { contagem[c.emocao] = (contagem[c.emocao] || 0) + 1; });
  const total = checkins.length || 1;
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <ScriptTitle size={24}>Relatórios</ScriptTitle>
          <Text style={styles.sub}>Seu acompanhamento emocional</Text>
        </View>

        {/* Cards de resumo */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Check-ins</Text>
            <Text style={styles.statNumber}>{checkins.length}</Text>
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
          <Text style={styles.sectionTitle}>Emoções do período</Text>
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
              <Text style={styles.emptyText}>Faça seu primeiro check-in para ver os dados aqui.</Text>
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
                Sua emoção mais frequente recentemente foi <Text style={{ color: emoDom.color, fontFamily: fonts.bodyBold }}>{emoDom.label.toLowerCase()}</Text>. Cada sentimento que você nomeia é um passo de autoconhecimento. Continue cuidando de si.
              </Text>
            </Card>
          </View>
        )}

        {/* Histórico semanal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Histórico recente</Text>
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 12, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center' },
  statLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginBottom: 4 },
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
  historicoLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  histPt: { alignItems: 'center', gap: 4 },
  histDot: { width: 12, height: 12, borderRadius: 6 },
  histLbl: { fontFamily: fonts.body, fontSize: 8, color: colors.tl },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.tm },
});
