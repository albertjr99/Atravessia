import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Card } from '../../components';

export default function AdminUsuariasScreen({ navigation }) {
  const [usuarias, setUsuarias] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), (snap) => {
      setUsuarias(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role !== 'admin'));
    });
    return unsub;
  }, []);

  const handleAlterarPlano = (usuaria) => {
    Alert.alert('Alterar plano', `Definir plano de ${usuaria.nome}:`, [
      { text: 'Plano 1', onPress: () => updateDoc(doc(db, 'usuarios', usuaria.id), { plano: 1 }) },
      { text: 'Plano 2', onPress: () => updateDoc(doc(db, 'usuarios', usuaria.id), { plano: 2 }) },
      { text: 'Plano 3', onPress: () => updateDoc(doc(db, 'usuarios', usuaria.id), { plano: 3 }) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Usuárias</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={styles.countText}>{usuarias.length} usuária(s) cadastrada(s)</Text>
        {usuarias.map(u => (
          <Card key={u.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nome}>{u.nome}</Text>
              <Text style={styles.email}>{u.email}</Text>
              <Text style={styles.detalhe}>{u.estado || '—'}</Text>
            </View>
            <TouchableOpacity style={styles.planoBadge} onPress={() => handleAlterarPlano(u)}>
              <Text style={styles.planoBadgeText}>Plano {u.plano || 1}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.lav6} />
            </TouchableOpacity>
          </Card>
        ))}
        {usuarias.length === 0 && <Text style={styles.emptyText}>Nenhuma usuária cadastrada ainda.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  countText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, ...shadow.soft },
  nome: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  email: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 1 },
  detalhe: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: 1 },
  planoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.lav1, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 10 },
  planoBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lav6 },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', marginTop: spacing.xl },
});
