import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { LinearGradient } from 'expo-linear-gradient';
import { AVISO_IA } from '../../ia/conversa';

// Central da AtravessIA: a inteligência própria do app (sem custo por uso,
// tudo processado no aparelho).
const MODULOS = [
  {
    tela: 'ConversaIA', icone: 'chatbubbles-outline', titulo: 'Conversar', tom: 'lilas',
    desc: 'Conte como você está. A AtravessIA acolhe e sugere um cuidado para este momento.',
  },
  {
    tela: 'DiarioGuiado', icone: 'create-outline', titulo: 'Diário guiado', tom: 'salvia',
    desc: 'Uma pergunta gentil por dia, de acordo com o que você está sentindo.',
  },
  {
    tela: 'CartaMes', icone: 'mail-open-outline', titulo: 'Carta do mês', tom: 'pessego',
    desc: 'Uma carta carinhosa sobre o seu caminho, feita a partir dos seus registros.',
  },
];

// Pílula de cada módulo no acento dele (fundo tingido + tinta do acento).
function tomDe(tom) {
  if (tom === 'salvia') return { fundo: colors.sageFundo, tinta: colors.sageFg };
  if (tom === 'pessego') return { fundo: colors.roseFundo, tinta: colors.roseTexto };
  return { fundo: colors.lav1, tinta: colors.lilasIcone };
}

export default function AtravessIAScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <View style={s.coluna}>
          <View style={s.hero}>
            <View style={s.heroIcone}>
              <LinearGradient colors={[colors.auroraLilas, colors.auroraPessego]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroGrad} />
              <Ionicons name="sparkles" size={28} color="white" />
            </View>
            <Text style={s.heroTit}>AtravessIA</Text>
            <Text style={s.heroSub}>Um espaço de escuta para conversar, escrever e acolher o que você sente. O que você compartilha aqui fica entre nós.</Text>
          </View>

          {MODULOS.map(m => (
            <TouchableOpacity key={m.tela} style={s.modulo} onPress={() => navigation.navigate(m.tela)} activeOpacity={0.85}>
              <View style={[s.moduloIcone, { backgroundColor: tomDe(m.tom).fundo }]}><Ionicons name={m.icone} size={22} color={tomDe(m.tom).tinta} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.moduloTit}>{m.titulo}</Text>
                <Text style={s.moduloDesc}>{m.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.tl} />
            </TouchableOpacity>
          ))}

          <View style={s.aviso}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.lilasIcone} />
            <Text style={s.avisoTxt}>{AVISO_IA} Em situação de risco, ligue para o CVV: 188 (24 horas, gratuito).</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
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
  conteudo: { paddingHorizontal: spacing.lg },
  coluna: { width: '100%', gap: spacing.md },
  hero: { alignItems: 'center', gap: 8, paddingVertical: spacing.md },
  heroIcone: {
    width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    backgroundColor: colors.auroraLilas,
  },
  heroGrad: { ...StyleSheet.absoluteFillObject },
  heroTit: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 44, color: colors.titulo, marginTop: 4 },
  heroSub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.texto2, textAlign: 'center', maxWidth: 440 },
  modulo: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card,
    borderRadius: 24, borderWidth: 1, borderColor: colors.bordaLuz, padding: spacing.md, minHeight: 88,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  moduloIcone: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  moduloTit: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.titulo },
  moduloDesc: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.texto2, marginTop: 2 },
  aviso: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.vidroTenue,
    borderRadius: 18, padding: 14, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.texto2 },
}));
