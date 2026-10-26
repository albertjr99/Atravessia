import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, TextInput, Modal, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow, criarEstilos } from '../../theme';
import { ScriptTitle, QuoteText, Button, Card, LavandaBg } from '../../components';
import { hojeStrBR, formatDataBR } from '../../utils/date';
import { useApp } from '../../hooks/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Profundo } from '../../components/Efeitos';
import Recolhivel from '../../components/Recolhivel';

const ilustracao = require('../../../assets/images/memorial_coracao.png');

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

export default function MemorialScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { memorias, adicionarMemoria } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [novaMemoria, setNovaMemoria] = useState({ titulo: '', conteudo: '' });

  const handleSalvar = () => {
    if (!novaMemoria.titulo || !novaMemoria.conteudo) return;
    adicionarMemoria({
      titulo: novaMemoria.titulo,
      conteudo: novaMemoria.conteudo,
      tipo: 'texto',
      data: hojeStrBR(),
    });
    setNovaMemoria({ titulo: '', conteudo: '' });
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
        <View style={{ width: 44 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ScriptTitle size={32} style={{ color: colors.titulo }}>Caixa de Memórias</ScriptTitle>
            <Text style={styles.sub}>Um espaço sagrado só seu</Text>
          </View>
          <Image source={ilustracao} style={styles.headerIlustracao} resizeMode="contain" />
        </View>

        {/* Intro */}
        <Card style={styles.introCard}>
          <QuoteText style={{ fontSize: 19, lineHeight: 28, color: colors.titulo }}>
            "Guardar uma memória não é viver no passado. É honrar o que foi real e continua sendo parte de quem você é."
          </QuoteText>
          <BotaoLilas externo={{ marginTop: spacing.md }} onPress={() => setModalVisible(true)} rotulo="Adicionar memória">
            <Ionicons name="add" size={18} color="white" />
            <Text style={styles.btnTxt}>Adicionar memória</Text>
          </BotaoLilas>
        </Card>

        {/* Memórias */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suas memórias</Text>
          {memorias.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.vazioIcone}><Ionicons name="heart-outline" size={28} color={colors.roseTexto} /></View>
              <Text style={styles.emptyText}>Suas memórias aparecerão aqui.</Text>
              <Text style={styles.emptySubText}>Toque em "Adicionar memória" para começar.</Text>
            </View>
          ) : (
            // Cada memória fica recolhida: a lista mostra títulos e datas, um toque abre o texto.
            memorias.map(m => (
              <Recolhivel
                key={m.id}
                titulo={m.titulo}
                subtitulo={formatDataBR(m.data)}
                icone="heart-outline"
              >
                <Text style={styles.memoriaConteudo} selectable>{m.conteudo}</Text>
              </Recolhivel>
            ))
          )}
        </View>

        {/* Carta */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Escreva uma carta</Text>
          <Card style={styles.cartaCard}>
            <Text style={styles.cartaIntro}>Expressar sentimentos por escrito é uma forma poderosa de elaboração. Escreva para quem partiu, para si mesma, ou para o futuro.</Text>
            <TouchableOpacity style={styles.cartaBtn} onPress={() => navigation.navigate('Cartas')}>
              <Text style={styles.cartaBtnText}>Ir para Cartas</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.lilasIcone} />
            </TouchableOpacity>
          </Card>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova memória</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalFechar} accessibilityLabel="Fechar">
                <Ionicons name="close" size={20} color={colors.lilasTexto} />
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder="Título da memória"
              placeholderTextColor={colors.tl}
              style={styles.input}
              value={novaMemoria.titulo}
              onChangeText={t => setNovaMemoria(p => ({ ...p, titulo: t }))}
            />
            <TextInput
              placeholder="Escreva aqui sua memória..."
              placeholderTextColor={colors.tl}
              style={[styles.input, styles.inputMulti]}
              multiline
              value={novaMemoria.conteudo}
              onChangeText={t => setNovaMemoria(p => ({ ...p, conteudo: t }))}
            />
            <BotaoLilas externo={{ marginTop: spacing.md }} onPress={handleSalvar} rotulo="Salvar memória">
              <Text style={styles.btnTxt}>Salvar memória</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, marginTop: 2 },
  headerIlustracao: { width: 68, height: 68, borderRadius: 18 },
  introCard: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.lg, borderRadius: 24 },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, marginBottom: spacing.sm, marginLeft: 4 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: 8 },
  vazioIcone: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.roseFundo, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  emptySubText: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, textAlign: 'center' },
  memoriaCard: { marginBottom: 12, padding: spacing.lg, borderRadius: 22 },
  memoriaHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: spacing.sm },
  memoriaIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.roseFundo, alignItems: 'center', justifyContent: 'center' },
  memoriaTitulo: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  memoriaData: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: 1 },
  memoriaConteudo: { fontFamily: fonts.quote, fontSize: 19, color: colors.texto2, lineHeight: 28 },
  cartaCard: { padding: spacing.lg, borderRadius: 24 },
  cartaIntro: { fontFamily: fonts.body, fontSize: 15, color: colors.texto2, lineHeight: 23, marginBottom: spacing.md },
  cartaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 },
  cartaBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  inputMulti: { height: 140, textAlignVertical: 'top', marginTop: spacing.sm },
}));
