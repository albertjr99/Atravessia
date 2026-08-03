import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Card } from '../../components';
import AdminLayout from './AdminLayout';

const PLANO_NOME = { 0: 'Perceber', 1: 'Acolher' };
const PLANO_COR = { 0: colors.sage, 1: colors.lav5 };

export default function AdminUsuariasScreen({ navigation }) {
  const [usuarias, setUsuarias] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroPlano, setFiltroPlano] = useState('todos');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), (snap) => {
      const todos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role !== 'admin')
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setUsuarias(todos);
    });
    return unsub;
  }, []);

  const handleAlterarPlano = (usuaria) => {
    Alert.alert('Alterar plano', `Plano de ${usuaria.apelido || usuaria.nome}:`, [
      { text: 'Perceber (gratuito)', onPress: () => updateDoc(doc(db, 'usuarios', usuaria.id), { plano: 0 }) },
      { text: 'Acolher (R$24,90)', onPress: () => updateDoc(doc(db, 'usuarios', usuaria.id), { plano: 1 }) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const lista = usuarias.filter(u => {
    const matchBusca = !busca || [u.nome, u.apelido, u.email, u.cidade].some(
      v => v?.toLowerCase().includes(busca.toLowerCase())
    );
    if (filtroPlano === 'empresa') return matchBusca && u.linkEmpresa === true;
    const matchPlano = filtroPlano === 'todos' || String(u.plano ?? 0) === filtroPlano;
    return matchBusca && matchPlano;
  });

  const totalGratis = usuarias.filter(u => (u.plano ?? 0) === 0).length;
  const totalPago = usuarias.filter(u => (u.plano ?? 0) === 1).length;
  const totalEmpresa = usuarias.filter(u => u.linkEmpresa === true).length;

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminUsuarias">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Usuárias</Text>
        <Text style={styles.pageSub}>Gerencie planos e acessos das usuárias cadastradas.</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statN}>{usuarias.length}</Text>
            <Text style={styles.statL}>Total</Text>
          </View>
          <View style={[styles.statBox, { borderColor: colors.sage }]}>
            <Text style={[styles.statN, { color: colors.sage }]}>{totalGratis}</Text>
            <Text style={styles.statL}>Perceber</Text>
          </View>
          <View style={[styles.statBox, { borderColor: colors.lav4 }]}>
            <Text style={[styles.statN, { color: colors.lav4 }]}>{totalPago}</Text>
            <Text style={styles.statL}>Acolher</Text>
          </View>
          <View style={[styles.statBox, { borderColor: colors.gold }]}>
            <Text style={[styles.statN, { color: colors.gold }]}>{totalEmpresa}</Text>
            <Text style={styles.statL}>Empresa</Text>
          </View>
        </View>

        {/* Busca */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={colors.tl} />
          <TextInput
            style={styles.searchInput} placeholder="Buscar por nome, e-mail ou cidade..."
            placeholderTextColor={colors.tl} value={busca} onChangeText={setBusca}
          />
          {busca ? (
            <TouchableOpacity onPress={() => setBusca('')}>
              <Ionicons name="close-circle" size={16} color={colors.tl} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filtro por plano */}
        <View style={[styles.chipRow, { marginBottom: spacing.md }]}>
          {[{ id: 'todos', label: 'Todos' }, { id: '0', label: 'Perceber' }, { id: '1', label: 'Acolher' }, { id: 'empresa', label: 'Empresa' }].map(f => (
            <TouchableOpacity key={f.id} style={[styles.chip, filtroPlano === f.id && styles.chipSel]} onPress={() => setFiltroPlano(f.id)}>
              <Text style={[styles.chipText, filtroPlano === f.id && styles.chipTextSel]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {lista.map(u => {
          const plano = u.plano ?? 0;
          const cor = PLANO_COR[plano] || colors.tl;
          return (
            <Card key={u.id} style={styles.item}>
              <View style={[styles.avatar, { backgroundColor: cor + '22' }]}>
                <Text style={[styles.avatarLetter, { color: cor }]}>
                  {(u.apelido || u.nome || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{u.apelido || u.nome}</Text>
                {u.apelido && u.nome !== u.apelido && (
                  <Text style={styles.nomeCompleto}>{u.nome}</Text>
                )}
                <Text style={styles.email}>{u.email}</Text>
                {(u.cidade || u.telefone) ? (
                  <Text style={styles.detalhe}>{[u.cidade, u.telefone].filter(Boolean).join(' · ')}</Text>
                ) : null}
                {u.linkEmpresa && (
                  <View style={styles.empresaTag}>
                    <Ionicons name="business-outline" size={10} color={colors.gold} />
                    <Text style={styles.empresaText}>
                      {u.empresa ? `Empresa: ${u.empresa}` : 'Via empresa/parceria'}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={[styles.planoBadge, { backgroundColor: cor + '22', borderColor: cor }]} onPress={() => handleAlterarPlano(u)}>
                <Text style={[styles.planoBadgeText, { color: cor }]}>{PLANO_NOME[plano] || 'Perceber'}</Text>
                <Ionicons name="chevron-down" size={11} color={cor} />
              </TouchableOpacity>
            </Card>
          );
        })}

        {lista.length === 0 && (
          <Text style={styles.emptyText}>
            {busca || filtroPlano !== 'todos' ? 'Nenhuma usuária encontrada.' : 'Nenhuma usuária cadastrada ainda.'}
          </Text>
        )}
      </ScrollView>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  statN: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.lav5 },
  statL: { fontFamily: fonts.body, fontSize: 10, color: colors.tm, marginTop: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 10, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: colors.bg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 5, paddingHorizontal: 12 },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8, ...shadow.soft },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  avatarLetter: { fontFamily: fonts.bodyBold, fontSize: 16 },
  nome: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  nomeCompleto: { fontFamily: fonts.body, fontSize: 11, color: colors.tm },
  email: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 1 },
  detalhe: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 1 },
  empresaTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  empresaText: { fontFamily: fonts.body, fontSize: 10, color: colors.gold },
  planoBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.full, borderWidth: 1.5, paddingVertical: 5, paddingHorizontal: 9, marginTop: 2 },
  planoBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', marginTop: spacing.xl },
});
