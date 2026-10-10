import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { AVISO_IA } from '../../ia/conversa';

// Central da AtravessIA: a inteligência própria do app (sem custo por uso,
// tudo processado no aparelho).
const MODULOS = [
  {
    tela: 'ConversaIA', icone: 'chatbubbles-outline', titulo: 'Conversar',
    desc: 'Conte como você está. A AtravessIA acolhe e sugere um cuidado para este momento.',
  },
  {
    tela: 'DiarioGuiado', icone: 'create-outline', titulo: 'Diário guiado',
    desc: 'Uma pergunta gentil por dia, de acordo com o que você está sentindo.',
  },
  {
    tela: 'CartaMes', icone: 'mail-open-outline', titulo: 'Carta do mês',
    desc: 'Uma carta carinhosa sobre o seu caminho, feita a partir dos seus registros.',
  },
];

export default function AtravessIAScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconeBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <View style={s.coluna}>
          <View style={s.hero}>
            <View style={s.heroIcone}><Ionicons name="sparkles" size={26} color="white" /></View>
            <Text style={s.heroTit}>AtravessIA</Text>
            <Text style={s.heroSub}>A inteligência do Atravessia, feita para acolher. Funciona aqui no seu celular: o que você escreve fica com você.</Text>
          </View>

          {MODULOS.map(m => (
            <TouchableOpacity key={m.tela} style={s.modulo} onPress={() => navigation.navigate(m.tela)} activeOpacity={0.85}>
              <View style={s.moduloIcone}><Ionicons name={m.icone} size={22} color={colors.lav5} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.moduloTit}>{m.titulo}</Text>
                <Text style={s.moduloDesc}>{m.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.tl} />
            </TouchableOpacity>
          ))}

          <View style={s.aviso}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.lav5} />
            <Text style={s.avisoTxt}>{AVISO_IA} Em situação de risco, ligue para o CVV: 188 (24 horas, gratuito).</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  iconeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  conteudo: { paddingHorizontal: spacing.lg },
  coluna: { width: '100%', maxWidth: 620, alignSelf: 'center', gap: spacing.md },
  hero: { alignItems: 'center', gap: 8, paddingVertical: spacing.md },
  heroIcone: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.botaoForte,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTit: { fontFamily: fonts.serif, fontSize: 30, color: colors.lav6 },
  heroSub: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.tm, textAlign: 'center', maxWidth: 420 },
  modulo: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 84,
  },
  moduloIcone: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  moduloTit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  moduloDesc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.tm, marginTop: 2 },
  aviso: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.lav1, borderRadius: radius.md, padding: 12, marginTop: spacing.sm },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.tm },
}));
