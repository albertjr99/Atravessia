import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, TextInput, Modal, Image,
} from 'react-native';

const ilustracao = require('../../../assets/images/il_rede_apoio.png');
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { vinculosRedeApoio } from '../../data';
import { Button, Card, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';

export default function RedeApoioScreen({ navigation }) {
  const { redeApoio, adicionarContatoRede, removerContatoRede, temAcesso } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ nome: '', vinculo: vinculosRedeApoio[0], obs: '' });

  if (!temAcesso(3)) {
    return (
      <SafeAreaView style={styles.safe}>
        <LavandaBg />
        <View style={styles.lockWrap}>
          <Ionicons name="lock-closed-outline" size={36} color={colors.lav4} />
          <Text style={styles.lockTitle}>Disponível no Plano 3</Text>
          <Text style={styles.lockSub}>Cadastre pessoas de confiança para fortalecer sua rede de apoio.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Planos')} style={styles.lockBtn}>
            <Text style={styles.lockBtnText}>Ver planos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleSalvar = () => {
    if (!form.nome) return;
    adicionarContatoRede(form);
    setForm({ nome: '', vinculo: vinculosRedeApoio[0], obs: '' });
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <LavandaBg />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Rede de Apoio</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.lista} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Cadastre até 3 pessoas de confiança (pode usar um codinome). O app pode sugerir essa rede em momentos difíceis — sem notificá-las automaticamente.
        </Text>

        {redeApoio.length === 0 ? (
          <View style={styles.empty}>
            <Image source={ilustracao} style={styles.emptyIlustracao} resizeMode="contain" />
            <Text style={styles.emptyText}>Nenhum contato cadastrado ainda.</Text>
          </View>
        ) : (
          redeApoio.map(c => (
            <Card key={c.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemNome}>{c.nome}</Text>
                <Text style={styles.itemVinculo}>{c.vinculo}{c.obs ? ` · ${c.obs}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => removerContatoRede(c.id)}>
                <Ionicons name="trash-outline" size={18} color={colors.tl} />
              </TouchableOpacity>
            </Card>
          ))
        )}

        {redeApoio.length < 3 && (
          <Button title="Adicionar pessoa" variant="secondary" onPress={() => setModalVisible(true)} style={{ marginTop: spacing.md }} />
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova pessoa</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.td} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Nome ou apelido</Text>
            <TextInput
              placeholder="Ex: Maria"
              placeholderTextColor={colors.tl}
              style={styles.input}
              value={form.nome}
              onChangeText={v => setForm(p => ({ ...p, nome: v }))}
            />
            <Text style={styles.fieldLabel}>Vínculo</Text>
            <View style={styles.grid2}>
              {vinculosRedeApoio.map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.optCard, form.vinculo === v && styles.optCardSel]}
                  onPress={() => setForm(p => ({ ...p, vinculo: v }))}
                >
                  <Text style={[styles.optText, form.vinculo === v && { color: colors.lav6, fontFamily: fonts.bodyBold }]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Observações (opcional)</Text>
            <TextInput
              placeholder="Ex: melhor amiga desde a infância"
              placeholderTextColor={colors.tl}
              style={styles.input}
              value={form.obs}
              onChangeText={v => setForm(p => ({ ...p, obs: v }))}
            />
            <Button title="Salvar contato" onPress={handleSalvar} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  lista: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  intro: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, lineHeight: 18, marginBottom: spacing.lg },
  item: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.sm },
  itemNome: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  itemVinculo: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: 8 },
  emptyIlustracao: { width: 100, height: 100 },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(74,63,85,0.35)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  fieldLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 6, marginTop: spacing.sm },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: 12 },
  optCardSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  optText: { fontFamily: fonts.body, fontSize: 12, color: colors.td },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  lockTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td, marginTop: 8 },
  lockSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, textAlign: 'center' },
  lockBtn: { marginTop: spacing.md, backgroundColor: colors.lav4, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  lockBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
});
