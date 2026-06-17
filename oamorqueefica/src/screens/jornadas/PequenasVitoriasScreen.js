import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { pequenasVitorias } from '../../data';
import { ScriptTitle, QuoteText, Card } from '../../components';
import { useApp } from '../../hooks/AppContext';

export default function PequenasVitoriasScreen({ navigation }) {
  const { vitorias, adicionarVitoria, temAcesso } = useApp();

  if (!temAcesso(3)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.lockWrap}>
          <Ionicons name="lock-closed-outline" size={36} color={colors.lav4} />
          <Text style={styles.lockTitle}>Disponível no Plano 3</Text>
          <Text style={styles.lockSub}>Registre suas conquistas cotidianas e acompanhe sua reconstrução.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Planos')} style={styles.lockBtn}>
            <Text style={styles.lockBtnText}>Ver planos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const registradosHoje = vitorias.filter(v => v.data?.slice(0, 10) === new Date().toISOString().slice(0, 10)).map(v => v.label);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Pequenas Vitórias</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ScriptTitle size={22}>Cada passo importa</ScriptTitle>
          <QuoteText style={{ marginTop: 8 }}>
            "As grandes reconstruções começam em passos quase invisíveis."
          </QuoteText>
        </View>

        <View style={styles.grid}>
          {pequenasVitorias.map(v => {
            const jaRegistrada = registradosHoje.includes(v.label);
            return (
              <TouchableOpacity
                key={v.id}
                style={[styles.chip, jaRegistrada && styles.chipFeito]}
                onPress={() => !jaRegistrada && adicionarVitoria({ label: v.label })}
                activeOpacity={0.85}
              >
                <Ionicons name={jaRegistrada ? 'checkmark-circle' : 'add-circle-outline'} size={16} color={jaRegistrada ? colors.sageFg : colors.lav5} />
                <Text style={[styles.chipText, jaRegistrada && { color: colors.sageFg, fontFamily: fonts.bodyBold }]}>{v.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suas conquistas registradas</Text>
          {vitorias.length === 0 ? (
            <Text style={styles.emptyText}>Suas pequenas vitórias aparecerão aqui.</Text>
          ) : (
            <Card style={{ gap: 8 }}>
              {[...vitorias].reverse().map(v => (
                <View key={v.id} style={styles.vitoriaRow}>
                  <Ionicons name="star" size={14} color={colors.gold} />
                  <Text style={styles.vitoriaText}>{v.label}</Text>
                  <Text style={styles.vitoriaData}>{new Date(v.data).toLocaleDateString('pt-BR')}</Text>
                </View>
              ))}
            </Card>
          )}
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
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.card, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  chipFeito: { backgroundColor: colors.sage + '30', borderColor: colors.sage },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.td },
  section: { paddingHorizontal: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', paddingVertical: spacing.lg },
  vitoriaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vitoriaText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  vitoriaData: { fontFamily: fonts.body, fontSize: 10, color: colors.tl },
  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  lockTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td, marginTop: 8 },
  lockSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, textAlign: 'center' },
  lockBtn: { marginTop: spacing.md, backgroundColor: colors.lav4, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  lockBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
});
