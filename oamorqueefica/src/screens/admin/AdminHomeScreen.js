import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Card } from '../../components';
import AdminLayout from './AdminLayout';

const hojeStr = () => new Date().toISOString().split('T')[0];

export default function AdminHomeScreen({ navigation }) {
  const [stats, setStats] = useState({ usuarias: 0, checkinsHoje: 0, porPlano: { 0: 0, 1: 0 } });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const usuariasSnap = await getDocs(collection(db, 'usuarios'));
        const porPlano = { 0: 0, 1: 0 };
        usuariasSnap.forEach(d => {
          const plano = d.data().plano ?? 0;
          if (d.data().role !== 'admin') porPlano[plano] = (porPlano[plano] || 0) + 1;
        });

        const checkinsSnap = await getDocs(collectionGroup(db, 'checkins'));
        const hoje = hojeStr();
        let checkinsHoje = 0;
        checkinsSnap.forEach(d => { if (d.data().data === hoje) checkinsHoje++; });

        const totalUsuarias = usuariasSnap.docs.filter(d => d.data().role !== 'admin').length;
        setStats({ usuarias: totalUsuarias, checkinsHoje, porPlano });
      } catch {
        // sem dados
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const tiles = [
    { icon: 'people', color: colors.lav4, value: stats.usuarias, label: 'usuárias cadastradas' },
    { icon: 'heart', color: colors.peach2, value: stats.checkinsHoje, label: 'check-ins hoje' },
    { icon: 'leaf', color: colors.sage, value: stats.porPlano[0] || 0, label: 'Perceber (grátis)' },
    { icon: 'diamond', color: colors.gold, value: stats.porPlano[1] || 0, label: 'Acolher (pago)' },
  ];

  const atalhos = [
    { icon: 'headset-outline', label: 'Conteúdos', sub: 'Gerencie áudios e materiais', screen: 'AdminConteudos', color: colors.lav1 },
    { icon: 'megaphone-outline', label: 'Notificações', sub: 'Publique avisos para as usuárias', screen: 'AdminNotificacoes', color: colors.peach + '33' },
    { icon: 'people-outline', label: 'Usuárias', sub: 'Gerencie planos e acessos', screen: 'AdminUsuarias', color: colors.sage + '22' },
    { icon: 'bar-chart-outline', label: 'Relatórios', sub: 'Dados de engajamento', screen: 'AdminRelatorios', color: colors.gold + '22' },
    { icon: 'gift-outline', label: 'Parcerias', sub: 'Gerencie banners e benefícios exclusivos', screen: 'AdminParcerias', color: colors.peach + '33' },
  ];

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminHome">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Dashboard</Text>
          <Text style={s.pageSub}>Bem-vinda ao painel Atravessia</Text>
        </View>

        {/* Tiles de estatística */}
        <View style={s.tilesGrid}>
          {tiles.map((t, i) => (
            <Card key={i} style={s.tile}>
              <View style={[s.tileIcon, { backgroundColor: t.color + '22' }]}>
                <Ionicons name={t.icon} size={20} color={t.color} />
              </View>
              <Text style={[s.tileValue, { color: t.color }]}>{carregando ? '—' : t.value}</Text>
              <Text style={s.tileLabel}>{t.label}</Text>
            </Card>
          ))}
        </View>

        {/* Atalhos */}
        <Text style={s.sectionTitle}>Gestão do sistema</Text>
        {atalhos.map(item => (
          <Card
            key={item.screen}
            style={s.atalhoCard}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={[s.atalhoIcon, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon} size={20} color={colors.lav5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.atalhoLabel}>{item.label}</Text>
              <Text style={s.atalhoSub}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.tl} />
          </Card>
        ))}
      </ScrollView>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageHeader: { marginBottom: spacing.lg },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.td },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginTop: 2 },
  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  tile: { flexBasis: '47%', flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.md, ...shadow.card },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontFamily: fonts.bodyBold, fontSize: 26, color: colors.lav5 },
  tileLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.tm, textAlign: 'center' },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: spacing.sm },
  atalhoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 8, ...shadow.card,
  },
  atalhoIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  atalhoLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td },
  atalhoSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 1 },
});
