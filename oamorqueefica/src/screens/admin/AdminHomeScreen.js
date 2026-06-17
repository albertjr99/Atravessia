import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { ScriptTitle, Card } from '../../components';
import { useAuth } from '../../hooks/AuthContext';

const hojeStr = () => new Date().toISOString().split('T')[0];

export default function AdminHomeScreen({ navigation }) {
  const { perfil, sair } = useAuth();
  const [stats, setStats] = useState({ usuarias: 0, checkinsHoje: 0, porPlano: { 1: 0, 2: 0, 3: 0 } });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const usuariasSnap = await getDocs(collection(db, 'usuarios'));
        const porPlano = { 1: 0, 2: 0, 3: 0 };
        usuariasSnap.forEach(d => {
          const plano = d.data().plano || 1;
          porPlano[plano] = (porPlano[plano] || 0) + 1;
        });

        const checkinsSnap = await getDocs(collectionGroup(db, 'checkins'));
        const hoje = hojeStr();
        let checkinsHoje = 0;
        checkinsSnap.forEach(d => { if (d.data().data === hoje) checkinsHoje++; });

        setStats({ usuarias: usuariasSnap.size, checkinsHoje, porPlano });
      } catch (e) {
        // Coleções ainda não populadas ou regras pendentes — segue com zeros.
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const handleSair = () => {
    Alert.alert('Sair', 'Deseja encerrar a sessão administrativa?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: sair },
    ]);
  };

  const menu = [
    { titulo: 'Conteúdos', sub: 'Áudios, documentos e links', icon: 'headset-outline', screen: 'AdminConteudos' },
    { titulo: 'Notificações', sub: 'Publicar avisos editoriais', icon: 'megaphone-outline', screen: 'AdminNotificacoes' },
    { titulo: 'Usuárias', sub: 'Planos e acesso', icon: 'people-outline', screen: 'AdminUsuarias' },
    { titulo: 'Relatórios', sub: 'Check-ins e engajamento', icon: 'bar-chart-outline', screen: 'AdminRelatorios' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={styles.header}>
          <View>
            <ScriptTitle size={24}>Painel administrativo</ScriptTitle>
            <Text style={styles.sub}>{perfil?.nome || 'Administradora'}</Text>
          </View>
          <TouchableOpacity onPress={handleSair} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.lav6} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{carregando ? '—' : stats.usuarias}</Text>
            <Text style={styles.statLabel}>usuárias</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statNumber, { color: colors.peach2 }]}>{carregando ? '—' : stats.checkinsHoje}</Text>
            <Text style={styles.statLabel}>check-ins hoje</Text>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usuárias por plano</Text>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[1, 2, 3].map(p => (
              <View key={p} style={{ alignItems: 'center' }}>
                <Text style={styles.planoNumero}>{carregando ? '—' : stats.porPlano[p] || 0}</Text>
                <Text style={styles.planoLabel}>Plano {p}</Text>
              </View>
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestão</Text>
          {menu.map(item => (
            <TouchableOpacity key={item.screen} style={styles.menuItem} onPress={() => navigation.navigate(item.screen)} activeOpacity={0.85}>
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon} size={18} color={colors.lav5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitulo}>{item.titulo}</Text>
                <Text style={styles.menuSub}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.tl} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },
  logoutBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 12, marginBottom: spacing.md },
  statCard: { flex: 1, alignItems: 'center' },
  statNumber: { fontFamily: fonts.bodyBold, fontSize: 28, color: colors.lav5 },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  planoNumero: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.lav6 },
  planoLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: 8, ...shadow.soft,
  },
  menuIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  menuTitulo: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td },
  menuSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 1 },
});
