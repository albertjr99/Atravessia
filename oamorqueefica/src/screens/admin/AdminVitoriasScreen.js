import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius } from '../../theme';
import AdminLayout from './AdminLayout';

export default function AdminVitoriasScreen() {
  const [opcoes, setOpcoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novoLabel, setNovoLabel] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const ref = query(collection(db, 'vitoriasOpcoes'), orderBy('criadoEm', 'asc'));
    const unsub = onSnapshot(ref, (snap) => {
      setOpcoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    }, () => setCarregando(false));
    return unsub;
  }, []);

  const handleAdicionar = async () => {
    const label = novoLabel.trim();
    if (!label) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, 'vitoriasOpcoes'), {
        label,
        ativo: true,
        criadoEm: serverTimestamp(),
      });
      setNovoLabel('');
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar a vitória.');
    } finally {
      setSalvando(false);
    }
  };

  const handleToggle = async (item) => {
    try {
      await updateDoc(doc(db, 'vitoriasOpcoes', item.id), { ativo: !item.ativo });
    } catch {
      Alert.alert('Erro', 'Não foi possível alterar o status.');
    }
  };

  const handleExcluir = (item) => {
    Alert.alert(
      'Excluir vitória',
      `Remover "${item.label}" da lista?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'vitoriasOpcoes', item.id));
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir.');
            }
          },
        },
      ]
    );
  };

  return (
    <AdminLayout currentScreen="AdminVitorias">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.title}>Pequenas Vitórias</Text>
        <Text style={s.sub}>Gerencie as opções disponíveis para as usuárias registrarem suas conquistas.</Text>

        {/* Adicionar nova */}
        <View style={s.addCard}>
          <Text style={s.addTitle}>Adicionar nova vitória</Text>
          <View style={s.addRow}>
            <TextInput
              style={s.addInput}
              placeholder="Ex: Saí de casa hoje"
              placeholderTextColor={colors.tl}
              value={novoLabel}
              onChangeText={setNovoLabel}
              onSubmitEditing={handleAdicionar}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[s.addBtn, (!novoLabel.trim() || salvando) && { opacity: 0.5 }]}
              onPress={handleAdicionar}
              disabled={!novoLabel.trim() || salvando}
            >
              {salvando
                ? <ActivityIndicator size="small" color="white" />
                : <Ionicons name="add" size={20} color="white" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Lista */}
        <View style={s.listCard}>
          <Text style={s.listTitle}>Opções cadastradas ({opcoes.length})</Text>
          {carregando ? (
            <ActivityIndicator color={colors.lav4} style={{ marginTop: 20 }} />
          ) : opcoes.length === 0 ? (
            <Text style={s.empty}>Nenhuma vitória cadastrada ainda.</Text>
          ) : (
            opcoes.map(item => (
              <View key={item.id} style={s.itemRow}>
                <TouchableOpacity
                  style={[s.toggleBtn, item.ativo && s.toggleBtnOn]}
                  onPress={() => handleToggle(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={item.ativo ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={item.ativo ? colors.sage : colors.tl}
                  />
                </TouchableOpacity>
                <Text style={[s.itemLabel, !item.ativo && s.itemLabelOff]}>{item.label}</Text>
                <TouchableOpacity onPress={() => handleExcluir(item)} style={s.delBtn}>
                  <Ionicons name="trash-outline" size={16} color={colors.rose} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <Text style={s.hint}>
          Vitórias desativadas não aparecem para as usuárias, mas os registros anteriores são mantidos.
        </Text>
      </ScrollView>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  title: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg, lineHeight: 19 },

  addCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
  },
  addTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: {
    flex: 1, backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.lav4, alignItems: 'center', justifyContent: 'center',
  },

  listCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  listTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.tl, textAlign: 'center', paddingVertical: spacing.lg },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  toggleBtn: { padding: 2 },
  toggleBtnOn: {},
  itemLabel: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  itemLabelOff: { color: colors.tl, textDecorationLine: 'line-through' },
  delBtn: { padding: 6 },

  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: spacing.md, lineHeight: 17, textAlign: 'center' },
});
