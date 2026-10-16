import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, TextInput, Modal, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const ilustracao = require('../../../assets/images/il_rede_apoio.png');
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { vinculosRedeApoio } from '../../data';
import { Button, Card, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Profundo } from '../../components/Efeitos';


// Ilustração em aquarela (cartão de papel sobre fundo branco, sem transparência):
// ampliada e recortada nas bordas do próprio cartão, para flutuar sobre a aurora.
function Ilustracao({ source, tamanho, style }) {
  const raio = Math.round(tamanho * 0.12);
  const extra = tamanho * 0.08;
  return (
    <View style={[{
      width: tamanho, height: tamanho, borderRadius: raio, backgroundColor: colors.cardSolido,
      shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.4 : 0.14, shadowRadius: 20, elevation: 3,
    }, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: raio, overflow: 'hidden' }]}>
        <Image
          source={source}
          resizeMode="cover"
          style={{ position: 'absolute', left: -extra, top: -extra, width: tamanho + extra * 2, height: tamanho + extra * 2, opacity: colors.escuro ? 0.9 : 1 }}
        />
      </View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: raio, borderWidth: 1, borderColor: colors.bordaLuz }]} />
    </View>
  );
}

// Botão principal: degradê lilás com "degrau" que afunda ao toque.
function BotaoLilas({ onPress, children, rotulo, externo, desativado }) {
  return (
    <Profundo
      externo={[externo, desativado && { opacity: 0.6 }]}
      estilo={styles.btnFace}
      base={colors.botaoBase}
      sombra={styles.btnHalo}
      onPress={desativado ? undefined : onPress}
      accessibilityLabel={rotulo}
    >
      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={styles.btnGrad} />
      {children}
    </Profundo>
  );
}

export default function RedeApoioScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { redeApoio, adicionarContatoRede, removerContatoRede, temAcesso } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ nome: '', vinculo: vinculosRedeApoio[0], obs: '' });

  if (!temAcesso(3)) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        <LavandaBg />
        <View style={styles.lockWrap}>
          <View style={styles.lockIcone}><Ionicons name="lock-closed-outline" size={30} color={colors.lilasIcone} /></View>
          <Text style={styles.lockTitle}>Disponível no Plano 3</Text>
          <Text style={styles.lockSub}>Cadastre pessoas de confiança para fortalecer sua rede de apoio.</Text>
          <BotaoLilas externo={styles.lockBtn} onPress={() => navigation.navigate('Planos')} rotulo="Ver planos">
            <Text style={styles.btnTxt}>Ver planos</Text>
          </BotaoLilas>
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
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>Rede de Apoio</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.lista} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Cadastre até 3 pessoas de confiança (pode usar um codinome). O app pode sugerir essa rede em momentos difíceis — sem notificá-las automaticamente.
        </Text>

        {redeApoio.length === 0 ? (
          <View style={styles.empty}>
            <Ilustracao source={ilustracao} tamanho={120} />
            <Text style={styles.emptyText}>Nenhum contato cadastrado ainda.</Text>
          </View>
        ) : (
          redeApoio.map(c => (
            <View key={c.id} style={styles.item}>
              <View style={[styles.itemIcone, { backgroundColor: colors.sageFundo }]}>
                <Ionicons name="person-outline" size={20} color={colors.sageFg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitulo}>{c.nome}</Text>
                <Text style={styles.itemSub}>{c.vinculo}{c.obs ? ` · ${c.obs}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => removerContatoRede(c.id)} style={styles.lixeira} accessibilityLabel="Remover pessoa">
                <Ionicons name="trash-outline" size={19} color={colors.tl} />
              </TouchableOpacity>
            </View>
          ))
        )}

        {redeApoio.length < 3 && (
          <TouchableOpacity style={[styles.btnVidro, { marginTop: spacing.sm }]} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={19} color={colors.lilasIcone} />
            <Text style={styles.btnVidroTxt}>Adicionar pessoa</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova pessoa</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalFechar} accessibilityLabel="Fechar">
                <Ionicons name="close" size={20} color={colors.lilasTexto} />
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
                  <Text style={[styles.optText, form.vinculo === v && styles.optTextSel]}>{v}</Text>
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
            <BotaoLilas externo={{ marginTop: spacing.lg }} onPress={handleSalvar} rotulo="Salvar contato">
              <Text style={styles.btnTxt}>Salvar contato</Text>
            </BotaoLilas>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 1,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 28, color: colors.titulo },
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 22, overflow: 'hidden' },
  btnGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 5 },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: 'white' },
  btnVidro: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingHorizontal: 20,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro,
  },
  btnVidroTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  lista: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  intro: { fontFamily: fonts.body, fontSize: 15, color: colors.texto2, lineHeight: 23, marginTop: spacing.sm, marginBottom: spacing.lg, textAlign: 'center' },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, marginBottom: 12,
    backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  itemIcone: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  itemSub: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2 },
  lixeira: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.lg, gap: 14 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2 },
  modalOverlay: { flex: 1, backgroundColor: colors.sobreposicao, justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.cardSolido, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.xl,
    borderWidth: 1, borderColor: colors.bordaLuz,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { fontFamily: fonts.serif, fontSize: 26, color: colors.titulo },
  modalFechar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2, marginBottom: 8, marginTop: 14 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optCard: { backgroundColor: colors.muted, borderRadius: radius.full, borderWidth: 1, borderColor: 'transparent', minHeight: 40, justifyContent: 'center', paddingHorizontal: 14 },
  optCardSel: { backgroundColor: colors.lav1, borderColor: colors.lav3 },
  optText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2 },
  optTextSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
  input: {
    minHeight: 50, backgroundColor: colors.cardSolido, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 14, color: colors.titulo,
  },
  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  lockIcone: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontFamily: fonts.serif, fontSize: 28, color: colors.titulo, marginTop: 8 },
  lockSub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.texto2, textAlign: 'center', maxWidth: 320 },
  lockBtn: { marginTop: spacing.md, minWidth: 200 },
}));
