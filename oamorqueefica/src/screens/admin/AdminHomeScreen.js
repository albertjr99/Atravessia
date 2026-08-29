import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, collectionGroup, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Card } from '../../components';
import AdminLayout from './AdminLayout';

const hojeStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

const normalizarPlano = (p) => {
  if (typeof p === 'number') return p;
  return ({ perceber: 0, acolher: 1, compreender: 2, evoluir: 3 })[String(p || '').toLowerCase()] ?? 0;
};

export default function AdminHomeScreen({ navigation }) {
  const [stats, setStats] = useState({ usuarias: 0, checkinsHoje: 0, porPlano: {} });
  const [conteudo, setConteudo] = useState({ conteudos: 0, audios: 0, parcerias: 0 });
  const [carregando, setCarregando] = useState(true);
  const [erroCheckins, setErroCheckins] = useState(false);

  useEffect(() => {
    const unsubs = [];

    // Cada assinatura é independente: antes, uma única consulta que falhava
    // (a de check-ins) impedia o setStats e zerava TODOS os indicadores.
    unsubs.push(onSnapshot(collection(db, 'usuarios'), snap => {
      const reais = snap.docs.map(d => d.data()).filter(u => u.role !== 'admin');
      const porPlano = {};
      reais.forEach(u => {
        const p = u.acessoTotal ? 3 : normalizarPlano(u.plano);
        porPlano[p] = (porPlano[p] || 0) + 1;
      });
      setStats(s => ({ ...s, usuarias: reais.length, porPlano }));
      setCarregando(false);
    }, () => setCarregando(false)));

    unsubs.push(onSnapshot(collectionGroup(db, 'checkins'), snap => {
      const hoje = hojeStr();
      let n = 0;
      snap.forEach(d => { if (d.data().data === hoje) n++; });
      setStats(s => ({ ...s, checkinsHoje: n }));
      setErroCheckins(false);
    }, () => setErroCheckins(true)));

    const cols = [['conteudos', 'conteudos'], ['audios', 'audiosAcolhimento'], ['parcerias', 'parcerias']];
    for (const [chave, col] of cols) {
      unsubs.push(onSnapshot(collection(db, col),
        snap => setConteudo(c => ({ ...c, [chave]: snap.size })),
        () => {}
      ));
    }

    return () => unsubs.forEach(u => u());
  }, []);

  const tiles = [
    { icon: 'people', color: colors.lav4, value: stats.usuarias, label: 'usuárias cadastradas' },
    { icon: 'heart', color: colors.peach2, value: erroCheckins ? '—' : stats.checkinsHoje, label: 'check-ins hoje' },
    { icon: 'leaf', color: colors.sage, value: stats.porPlano[0] || 0, label: 'Perceber (grátis)' },
    { icon: 'diamond', color: colors.gold, value: stats.porPlano[1] || 0, label: 'Acolher (pago)' },
    { icon: 'headset', color: colors.lav5, value: conteudo.conteudos, label: 'conteúdos publicados' },
    { icon: 'musical-notes', color: colors.lav3, value: conteudo.audios, label: 'áudios de check-in' },
    { icon: 'gift', color: colors.peach2, value: conteudo.parcerias, label: 'parcerias ativas' },
  ];

  const atalhos = [
    { icon: 'headset-outline', label: 'Conteúdos', sub: 'Gerencie áudios e materiais', screen: 'AdminConteudos', color: colors.lav1 },
    { icon: 'musical-notes-outline', label: 'Áudios Check-in', sub: 'Áudios de acolhimento por emoção', screen: 'AdminAudios', color: colors.lav1 },
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

        {erroCheckins && (
          <View style={s.avisoBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.gold} />
            <Text style={s.avisoTxt}>
              Não foi possível ler os check-ins. Publique as regras do Firestore
              (firebase deploy --only firestore:rules) para liberar esse indicador.
            </Text>
          </View>
        )}

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
  avisoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.gold + '18', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.gold + '55',
    padding: 10, marginBottom: spacing.md,
  },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: colors.td, lineHeight: 16 },
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
