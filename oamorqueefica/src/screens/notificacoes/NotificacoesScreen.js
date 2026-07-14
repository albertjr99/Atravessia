import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { ScriptTitle, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';

const ICONES = {
  inatividade: 'time-outline',
  data_sensivel: 'calendar-outline',
  conteudo: 'headset-outline',
  feedback: 'analytics-outline',
  relatorio: 'document-text-outline',
  vitoria: 'star-outline',
  incentivo: 'heart-outline',
  live: 'videocam-outline',
};

export default function NotificacoesScreen({ navigation }) {
  const { notificacoes, marcarLida } = useApp();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <LavandaBg />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Notificações</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.lista}>
        {notificacoes.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={36} color={colors.lav3} />
            <Text style={styles.emptyText}>Nenhuma notificação por aqui ainda.</Text>
          </View>
        ) : (
          notificacoes.map(n => (
            <TouchableOpacity
              key={n.id}
              style={[styles.item, !n.lida && styles.itemNaoLido]}
              onPress={() => marcarLida(n.id)}
              activeOpacity={0.85}
            >
              <View style={styles.itemIcon}>
                <Ionicons name={ICONES[n.tipo] || 'notifications-outline'} size={16} color={colors.lav5} />
              </View>
              <Text style={styles.itemTexto}>{n.texto}</Text>
              {!n.lida && <View style={styles.dot} />}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  lista: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.xxl },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
    ...shadow.soft,
  },
  itemNaoLido: { backgroundColor: colors.lav1, borderColor: colors.lav2 },
  itemIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  itemTexto: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td, lineHeight: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rose },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: 8 },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl },
});
