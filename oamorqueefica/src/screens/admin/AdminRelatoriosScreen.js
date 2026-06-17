import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collectionGroup, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { emocoes } from '../../data';
import { colors, fonts, spacing, radius } from '../../theme';
import { Card, ProgressBar } from '../../components';

export default function AdminRelatoriosScreen({ navigation }) {
  const [carregando, setCarregando] = useState(true);
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [porEmocao, setPorEmocao] = useState({});
  const [porDia, setPorDia] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collectionGroup(db, 'checkins'));
        const contagem = {};
        const dias = {};
        snap.forEach(d => {
          const { emocao, data } = d.data();
          contagem[emocao] = (contagem[emocao] || 0) + 1;
          dias[data] = (dias[data] || 0) + 1;
        });
        setTotalCheckins(snap.size);
        setPorEmocao(contagem);
        setPorDia(dias);
      } catch (e) {
        // sem dados ainda ou regras pendentes
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const sorted = Object.entries(porEmocao).sort((a, b) => b[1] - a[1]);
  const total = totalCheckins || 1;
  const ultimosDias = Object.entries(porDia).sort((a, b) => a[0].localeCompare(b[0])).slice(-7);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Relatórios gerais</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Card style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <Text style={styles.totalNumber}>{carregando ? '—' : totalCheckins}</Text>
          <Text style={styles.totalLabel}>check-ins registrados (todas as usuárias)</Text>
        </Card>

        <Text style={styles.sectionTitle}>Check-ins por tipo de emoção</Text>
        <Card style={{ gap: 12, marginBottom: spacing.lg }}>
          {sorted.map(([id, qtd]) => {
            const emo = emocoes.find(e => e.id === id);
            const pct = Math.round((qtd / total) * 100);
            return (
              <View key={id}>
                <View style={styles.emoRow}>
                  <View style={[styles.emoDot, { backgroundColor: emo?.color || colors.lav3 }]} />
                  <Text style={styles.emoNome}>{emo?.label || id}</Text>
                  <Text style={styles.emoQtd}>{qtd} ({pct}%)</Text>
                </View>
                <ProgressBar progress={pct / 100} color={emo?.color} />
              </View>
            );
          })}
          {sorted.length === 0 && <Text style={styles.emptyText}>Nenhum check-in registrado ainda.</Text>}
        </Card>

        <Text style={styles.sectionTitle}>Check-ins por dia (últimos registros)</Text>
        <Card style={{ gap: 8 }}>
          {ultimosDias.map(([dataStr, qtd]) => (
            <View key={dataStr} style={styles.diaRow}>
              <Text style={styles.diaLabel}>{new Date(dataStr).toLocaleDateString('pt-BR')}</Text>
              <Text style={styles.diaQtd}>{qtd}</Text>
            </View>
          ))}
          {ultimosDias.length === 0 && <Text style={styles.emptyText}>Sem dados ainda.</Text>}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  totalNumber: { fontFamily: fonts.bodyBold, fontSize: 32, color: colors.lav5 },
  totalLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  emoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  emoDot: { width: 10, height: 10, borderRadius: 5 },
  emoNome: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  emoQtd: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.tm },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', paddingVertical: spacing.md },
  diaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  diaLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.td },
  diaQtd: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav5 },
});
