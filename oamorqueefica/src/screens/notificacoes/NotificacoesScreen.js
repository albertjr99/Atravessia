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

const DESTINO = {
  inatividade: 'CheckIn',
  conteudo: 'CheckIn',
  data_sensivel: 'DatasSensiveis',
  feedback: 'Relatorios',
  relatorio: 'Relatorios',
  vitoria: 'Inicio',
  incentivo: 'CheckIn',
  live: 'Audios',
};

export default function NotificacoesScreen({ navigation }) {
  const { notificacoes, marcarLida } = useApp();
  const naoLidas = notificacoes.filter(n => !n.lida).length;

  const handlePress = (n) => {
    marcarLida(n.id);
    const dest = DESTINO[n.tipo];
    if (dest) navigation.navigate(dest);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.topTitle}>Notificações</Text>
          {naoLidas > 0 && (
            <Text style={styles.topSub}>
              {naoLidas === 1 ? '1 não lida' : `${naoLidas} não lidas`}
            </Text>
          )}
        </View>
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
              onPress={() => handlePress(n)}
              activeOpacity={0.85}
            >
              {!n.lida && <View style={styles.acento} />}
              <View style={[styles.itemIcon, !n.lida && styles.itemIconNaoLido]}>
                <Ionicons
                  name={ICONES[n.tipo] || 'notifications-outline'}
                  size={17}
                  color={n.lida ? colors.lav4 : '#fff'}
                />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                {!n.lida && (
                  <View style={styles.novaTag}>
                    <Text style={styles.novaTagTxt}>NOVA</Text>
                  </View>
                )}
                <Text style={[styles.itemTexto, !n.lida && styles.itemTextoNaoLido]}>{n.texto}</Text>
                {DESTINO[n.tipo] && (
                  <Text style={styles.itemAcao}>Toque para acessar</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={15} color={colors.tl} />
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
  itemNaoLido: {
    backgroundColor: colors.lav1, borderColor: colors.lav3,
    paddingLeft: spacing.md + 4,
    shadowColor: '#6b5b7a', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 9, elevation: 3,
  },
  acento: {
    position: 'absolute', left: 0, top: 10, bottom: 10,
    width: 3.5, borderRadius: 2, backgroundColor: colors.lav4,
  },
  itemIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    borderWidth: 1, borderColor: colors.border,
  },
  itemIconNaoLido: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  novaTag: {
    alignSelf: 'flex-start', backgroundColor: '#C4566B',
    borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2,
  },
  novaTagTxt: { fontFamily: fonts.bodyBold, fontSize: 8.5, color: '#fff', letterSpacing: 0.8 },
  itemTexto: { fontFamily: fonts.body, fontSize: 13, color: colors.td, lineHeight: 19 },
  itemTextoNaoLido: { fontFamily: fonts.bodyBold, color: colors.lav6 },
  itemAcao: { fontFamily: fonts.body, fontSize: 11, color: colors.lav5 },
  topSub: { fontFamily: fonts.body, fontSize: 10.5, color: colors.lav5, marginTop: 1 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: 8 },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl },
});
