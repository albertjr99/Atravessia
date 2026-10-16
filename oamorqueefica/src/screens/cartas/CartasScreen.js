import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, TextInput, Modal, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow, criarEstilos } from '../../theme';
import { cartasInspiradoras } from '../../data';
import { ScriptTitle, Card, Button, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Profundo } from '../../components/Efeitos';
import { formatDataBR } from '../../utils/date';

const ilustracao = require('../../../assets/images/cartas_envelope.png');

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

export default function CartasScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { cartasEscritas, adicionarCarta, temAcesso } = useApp();
  const [tab, setTab] = useState('ler');
  const [modalVisible, setModalVisible] = useState(false);
  const [nova, setNova] = useState({ titulo: '', conteudo: '' });

  const podeEscrever = temAcesso(1);

  const handleSalvar = () => {
    if (!nova.titulo || !nova.conteudo) return;
    adicionarCarta(nova);
    setNova({ titulo: '', conteudo: '' });
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
        <Text style={styles.topTitle} numberOfLines={1}>Cartas</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'ler' && styles.tabAtivo]} onPress={() => setTab('ler')}>
          <Text style={[styles.tabText, tab === 'ler' && styles.tabTextAtivo]}>Ler cartas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'minhas' && styles.tabAtivo]} onPress={() => setTab('minhas')}>
          <Text style={[styles.tabText, tab === 'minhas' && styles.tabTextAtivo]}>Minhas cartas</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.lista}>
        {tab === 'ler' ? (
          cartasInspiradoras.map(c => (
            <Card key={c.id} style={styles.cartaCard}>
              <Text style={styles.cartaTitulo}>{c.titulo}</Text>
              <Text style={styles.cartaConteudo}>{c.conteudo}</Text>
              <Text style={styles.cartaAutor}>— {c.autor}</Text>
            </Card>
          ))
        ) : podeEscrever ? (
          cartasEscritas.length === 0 ? (
            <View style={styles.empty}>
              <Image source={ilustracao} style={styles.emptyIlustracao} resizeMode="contain" />
              <Text style={styles.emptyText}>Suas cartas aparecerão aqui.</Text>
            </View>
          ) : (
            [...cartasEscritas].reverse().map(c => (
              <Card key={c.id} style={styles.cartaCard}>
                <Text style={styles.cartaTitulo}>{c.titulo}</Text>
                <Text style={styles.cartaConteudo}>{c.conteudo}</Text>
                <Text style={styles.cartaAutor}>{formatDataBR(c.data)}</Text>
              </Card>
            ))
          )
        ) : (
          <View style={styles.empty}>
            <View style={styles.vazioIcone}><Ionicons name="lock-closed-outline" size={28} color={colors.lilasIcone} /></View>
            <Text style={styles.emptyText}>Escrever cartas está disponível a partir do Plano 1.</Text>
            <BotaoLilas externo={styles.lockBtn} onPress={() => navigation.navigate('Planos')} rotulo="Ver planos">
              <Text style={styles.btnTxt}>Ver planos</Text>
            </BotaoLilas>
          </View>
        )}
      </ScrollView>

      {tab === 'minhas' && podeEscrever && (
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Escrever carta</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalFechar} accessibilityLabel="Fechar">
                <Ionicons name="close" size={20} color={colors.lilasTexto} />
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder="Título"
              placeholderTextColor={colors.tl}
              style={styles.input}
              value={nova.titulo}
              onChangeText={t => setNova(p => ({ ...p, titulo: t }))}
            />
            <TextInput
              placeholder="Escreva sua carta..."
              placeholderTextColor={colors.tl}
              style={[styles.input, styles.inputMulti]}
              multiline
              value={nova.conteudo}
              onChangeText={t => setNova(p => ({ ...p, conteudo: t }))}
            />
            <Text style={styles.moderacao}>Todas as cartas passam por moderação antes de poderem ser compartilhadas com a comunidade.</Text>
            <BotaoLilas externo={{ marginTop: spacing.md }} onPress={handleSalvar} rotulo="Salvar carta">
              <Text style={styles.btnTxt}>Salvar carta</Text>
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
  tabs: {
    flexDirection: 'row', marginHorizontal: spacing.lg, gap: 4, padding: 4, marginBottom: spacing.md,
    backgroundColor: colors.vidro, borderRadius: radius.full, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  tab: { flex: 1, minHeight: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  tabAtivo: {
    backgroundColor: colors.escuro ? colors.lav2 : colors.cardSolido,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2,
  },
  tabText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.texto2 },
  tabTextAtivo: { color: colors.lilasTexto, fontFamily: fonts.bodyBold },
  lista: { paddingHorizontal: spacing.lg, gap: 12, paddingBottom: spacing.xxl },
  cartaCard: { padding: spacing.lg, borderRadius: 24 },
  cartaTitulo: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.titulo, marginBottom: 8 },
  cartaConteudo: { fontFamily: fonts.quote, fontSize: 19, color: colors.texto2, lineHeight: 28 },
  cartaAutor: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: 10, textAlign: 'right' },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: 10 },
  vazioIcone: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  emptyIlustracao: { width: 96, height: 96 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center' },
  lockBtn: { marginTop: spacing.sm, minWidth: 200 },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.botaoForte,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 5,
  },
  inputMulti: { height: 140, textAlignVertical: 'top', marginTop: spacing.sm },
  moderacao: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, lineHeight: 16, marginTop: spacing.sm },
}));
