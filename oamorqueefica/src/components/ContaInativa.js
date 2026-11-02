import React from 'react';
import { View, Text, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing, criarEstilos } from '../theme';
import { useAuth } from '../hooks/AuthContext';

// Mesmo contato indicado no FAQ do app.
const EMAIL_CONTATO = 'carla.zambi.psi@gmail.com';

// Tela única para contas marcadas como inativas pela equipe: nada é apagado,
// só o uso fica bloqueado até a reativação (feita pelo painel).
export default function ContaInativa() {
  const { sair, perfil } = useAuth();
  const insets = useSafeAreaInsets();
  const assunto = encodeURIComponent('Reativar minha conta Atravessia');
  const corpo = encodeURIComponent(`Olá! Gostaria de reativar minha conta (${perfil?.email || ''}).`);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[s.scroll, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}>
      <View style={s.icone}><Ionicons name="leaf-outline" size={30} color={colors.lilasTexto} /></View>
      <Text style={s.titulo}>Sua conta está inativa</Text>
      <Text style={s.texto}>
        Sua conta está inativa. Fale com a equipe Atravessia para reativar.
        {'\n\n'}Tudo o que você guardou continua seguro e volta a aparecer assim que a conta for reativada.
      </Text>

      <TouchableOpacity
        style={s.botao}
        onPress={() => Linking.openURL(`mailto:${EMAIL_CONTATO}?subject=${assunto}&body=${corpo}`).catch(() => {})}
        accessibilityRole="button"
      >
        <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
        <Text style={s.botaoTxt}>Falar com a equipe</Text>
      </TouchableOpacity>
      <Text style={s.contato}>{EMAIL_CONTATO}</Text>

      <TouchableOpacity style={s.sair} onPress={sair} accessibilityRole="button">
        <Text style={s.sairTxt}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = criarEstilos(() => ({
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.lg },
  icone: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  titulo: { fontFamily: fonts.serif, fontSize: 28, color: colors.titulo, textAlign: 'center' },
  texto: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 23, color: colors.texto2, textAlign: 'center', marginTop: spacing.sm, maxWidth: 420 },
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.xl,
    minHeight: 52, borderRadius: 999, backgroundColor: colors.botao, paddingHorizontal: 26,
  },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#FFFFFF' },
  contato: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.texto2, marginTop: 10 },
  sair: { marginTop: spacing.xl, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  sairTxt: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.lilasTexto, textDecorationLine: 'underline' },
}), { escalar: false });
