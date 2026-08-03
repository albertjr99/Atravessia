import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { emocoes } from '../../data';
import { colors, fonts, spacing, radius } from '../../theme';
import AdminLayout from './AdminLayout';

export default function AdminMensagensRelatorioScreen() {
  const [mensagens, setMensagens] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'configuracoes', 'mensagensRelatorio'))
      .then(snap => { if (snap.exists()) setMensagens(snap.data()); })
      .catch(() => {});
  }, []);

  const set = (id, text) => setMensagens(prev => ({ ...prev, [id]: text }));

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'mensagensRelatorio'), mensagens, { merge: true });
      Alert.alert('Salvo', 'Mensagens atualizadas com sucesso.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as mensagens.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AdminLayout currentScreen="AdminMensagens">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={sty.scroll}
      >
        <Text style={sty.pageTitle}>Mensagens dos Relatórios</Text>
        <Text style={sty.pageSub}>
          Personalize a mensagem exibida nos relatórios mensais para cada emoção predominante.
          Deixe vazio para usar o texto padrão do app.
        </Text>

        {emocoes.map(emo => (
          <View key={emo.id} style={sty.emoBlock}>
            <View style={sty.emoHeader}>
              <View style={[sty.emoDot, { backgroundColor: emo.color }]} />
              <Text style={sty.emoLabel}>{emo.label}</Text>
              <Text style={[sty.emoType, emo.positiva && { color: colors.sage }]}>
                {emo.positiva ? 'positiva' : 'negativa'}
              </Text>
            </View>
            <TextInput
              style={sty.input}
              placeholder="Mensagem personalizada (deixe vazio para usar o padrão)"
              placeholderTextColor={colors.tl}
              value={mensagens[emo.id] || ''}
              onChangeText={v => set(emo.id, v)}
              multiline
              numberOfLines={3}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[sty.saveBtn, salvando && { opacity: 0.6 }]}
          onPress={handleSalvar}
          disabled={salvando}
        >
          <Text style={sty.saveBtnTxt}>{salvando ? 'Salvando...' : 'Salvar mensagens'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </AdminLayout>
  );
}

const sty = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: {
    fontFamily: fonts.body, fontSize: 13, color: colors.tm,
    marginBottom: spacing.lg, lineHeight: 20,
  },
  emoBlock: {
    marginBottom: spacing.md, backgroundColor: colors.card,
    borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  emoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  emoDot: { width: 10, height: 10, borderRadius: 5 },
  emoLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, flex: 1 },
  emoType: { fontFamily: fonts.body, fontSize: 10, color: colors.tl },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
    minHeight: 80, textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: colors.lav4, borderRadius: radius.full,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.md,
  },
  saveBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: 'white' },
});
