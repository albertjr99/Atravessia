import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { ScriptTitle, Card, Button, QuoteText, LavandaBg } from '../../components';
import { LinearGradient } from 'expo-linear-gradient';
import { Profundo } from '../../components/Efeitos';

const travessiaLogo = require('../../../assets/images/travessia_logo.png');

const formatos = [
  { id: 'online', titulo: 'Individual — online ao vivo', sub: 'Sessão 1:1 por videochamada', popular: true },
  { id: 'grupo', titulo: 'Grupo — online semanal', sub: 'Encontros ao vivo em grupo' },
  { id: 'gravada', titulo: 'Individual — gravada', sub: 'Acesse no seu horário' },
  { id: 'hibrida', titulo: 'Híbrida — online + presencial', sub: 'Flexibilidade total' },
];

const motivacoes = [
  { id: 'apoio', texto: 'Sinto que preciso de apoio' },
  { id: 'curiosidade', texto: 'Estou curioso(a) sobre terapia' },
  { id: 'info', texto: 'Só quero mais informações' },
];

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

export default function SessaoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [formatoSel, setFormatoSel] = useState('online');
  const [motivacaoSel, setMotiSel] = useState('apoio');

  const handleAgendar = () => {
    Alert.alert(
      'Solicitação enviada!',
      'Você receberá um contato em breve. Sem compromisso — você decide se avança.',
      [{ text: 'Perfeito', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Voltar">
            <Ionicons name="chevron-back" size={22} color={colors.lav6} />
          </TouchableOpacity>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTag}>Terapia Travessia</Text>
              <ScriptTitle size={32} style={{ color: colors.titulo }}>Agende sua sessão</ScriptTitle>
              <Text style={styles.headerSub}>Um próximo passo, no seu tempo</Text>
            </View>
            <Image source={travessiaLogo} style={styles.travessiaLogo} resizeMode="contain" />
          </View>
        </View>

        {/* Citação */}
        <Card style={styles.quoteCard}>
          <QuoteText style={{ fontSize: 19, lineHeight: 28, color: colors.titulo }}>
            "Ao usar o aplicativo, você criou um espaço de cuidado. O próximo passo pode ser um apoio ainda mais personalizado."
          </QuoteText>
        </Card>

        {/* Formatos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Escolha o formato</Text>
          {formatos.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[styles.formatoCard, formatoSel === f.id && styles.formatoCardSel]}
              onPress={() => setFormatoSel(f.id)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.formatoTop}>
                  <Text style={[styles.formatoTitulo, formatoSel === f.id && { color: colors.lilasTexto }]}>{f.titulo}</Text>
                  {f.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>Popular</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.formatoSub}>{f.sub}</Text>
              </View>
              <View style={[styles.radio, formatoSel === f.id && styles.radioOn]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Motivação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Como você está se sentindo?</Text>
          {motivacoes.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.motiCard, motivacaoSel === m.id && styles.motiCardSel]}
              onPress={() => setMotiSel(m.id)}
            >
              <View style={[styles.radio, motivacaoSel === m.id && styles.radioOn]} />
              <Text style={[styles.motiText, motivacaoSel === m.id && { color: colors.lilasTexto, fontFamily: fonts.bodyBold }]}>{m.texto}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.section}>
          <BotaoLilas onPress={handleAgendar} rotulo="Quero dar esse passo">
            <Text style={styles.btnTxt}>Quero dar esse passo</Text>
          </BotaoLilas>
          <Text style={styles.semComp}>Sem compromisso. Você decide se avança.</Text>
          <Text style={styles.disclaimer}>Este aplicativo não substitui acompanhamento médico ou psicológico profissional.</Text>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 22, overflow: 'hidden' },
  btnGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 5 },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: 'white' },
  btnVidro: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingHorizontal: 20,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro,
  },
  btnVidroTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  travessiaLogo: { width: 56, height: 56, borderRadius: 16 },
  headerTag: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.lilasTexto, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  headerSub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, marginTop: 3 },
  quoteCard: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.lg, borderRadius: 24 },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, marginBottom: spacing.sm, marginLeft: 4 },
  formatoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 20,
    borderWidth: 1, borderColor: colors.bordaLuz,
    padding: spacing.md, marginBottom: 10, minHeight: 64,
  },
  formatoCardSel: {
    backgroundColor: colors.escuro ? colors.lav2 : colors.cardSolido, borderColor: colors.lav3,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 2,
  },
  formatoTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' },
  formatoTitulo: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  formatoSub: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2 },
  popularBadge: { backgroundColor: colors.douradoFundo, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  popularText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.douradoTitulo },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.tl },
  radioOn: { backgroundColor: colors.botao, borderColor: colors.botao },
  motiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 18,
    borderWidth: 1, borderColor: colors.bordaLuz,
    paddingHorizontal: spacing.md, minHeight: 52, marginBottom: 8,
  },
  motiCardSel: { backgroundColor: colors.escuro ? colors.lav2 : colors.cardSolido, borderColor: colors.lav3 },
  motiText: { fontFamily: fonts.body, fontSize: 14, color: colors.titulo, flex: 1 },
  semComp: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2, textAlign: 'center', marginTop: spacing.md },
  disclaimer: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, textAlign: 'center', marginTop: 4, lineHeight: 16 },
}));
