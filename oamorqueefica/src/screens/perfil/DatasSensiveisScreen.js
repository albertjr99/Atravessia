import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, TextInput, Modal, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { tiposDataSensivel } from '../../data';
import { ScriptTitle, Button, Card } from '../../components';
import { useApp } from '../../hooks/AppContext';

const ilustracao = require('../../../assets/images/il_datas_sensiveis.png');

export default function DatasSensiveisScreen({ navigation }) {
  const { datasSensiveis, adicionarDataSensivel, removerDataSensivel, temAcesso } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ titulo: tiposDataSensivel[0], data: '' });

  if (!temAcesso(2)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.lockWrap}>
          <Ionicons name="lock-closed-outline" size={36} color={colors.lav4} />
          <Text style={styles.lockTitle}>Disponível no Plano 2</Text>
          <Text style={styles.lockSub}>Cadastre datas importantes e receba acolhimento com antecedência.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Planos')} style={styles.lockBtn}>
            <Text style={styles.lockBtnText}>Ver planos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleSalvar = () => {
    if (!form.data) return;
    adicionarDataSensivel(form);
    setForm({ titulo: tiposDataSensivel[0], data: '' });
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Datas Sensíveis</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.lista} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Cadastre até 3 datas importantes. Você receberá acolhimento com 3 dias de antecedência e no próprio dia.
        </Text>

        {datasSensiveis.length === 0 ? (
          <View style={styles.empty}>
            <Image source={ilustracao} style={styles.emptyIlustracao} resizeMode="contain" />
            <Text style={styles.emptyText}>Nenhuma data cadastrada ainda.</Text>
          </View>
        ) : (
          datasSensiveis.map(d => (
            <Card key={d.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitulo}>{d.titulo}</Text>
                <Text style={styles.itemData}>{new Date(d.data).toLocaleDateString('pt-BR')}</Text>
              </View>
              <TouchableOpacity onPress={() => removerDataSensivel(d.id)}>
                <Ionicons name="trash-outline" size={18} color={colors.tl} />
              </TouchableOpacity>
            </Card>
          ))
        )}

        {datasSensiveis.length < 3 && (
          <Button title="Adicionar data" variant="secondary" onPress={() => setModalVisible(true)} style={{ marginTop: spacing.md }} />
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova data sensível</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.td} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Tipo</Text>
            <View style={styles.grid2}>
              {tiposDataSensivel.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.optCard, form.titulo === t && styles.optCardSel]}
                  onPress={() => setForm(p => ({ ...p, titulo: t }))}
                >
                  <Text style={[styles.optText, form.titulo === t && { color: colors.lav6, fontFamily: fonts.bodyBold }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Data (AAAA-MM-DD)</Text>
            <TextInput
              placeholder="2025-12-25"
              placeholderTextColor={colors.tl}
              style={styles.input}
              value={form.data}
              onChangeText={v => setForm(p => ({ ...p, data: v }))}
            />
            <Button title="Salvar data" onPress={handleSalvar} style={{ marginTop: spacing.md }} />
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
  itemTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  itemData: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: 8 },
  emptyIlustracao: { width: 72, height: 72 },
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
