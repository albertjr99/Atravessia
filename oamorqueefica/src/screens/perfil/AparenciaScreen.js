import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Switch } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useTema, MODOS_TEMA } from '../../hooks/TemaContext';
import { vibrarLeve, vibrarSucesso } from '../../utils/vibrar';

// Aparência: tema claro, noturno ou automático pelo horário, e vibração suave.
export default function AparenciaScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { modo, setModo, vibracao, setVibracao, escuro } = useTema();

  const escolher = (m) => {
    vibrarLeve();
    setModo(m);
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={10} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Aparência</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={s.coluna}>
          <Text style={s.secTit}>Tema</Text>
          <View style={s.cartao}>
            {MODOS_TEMA.map((m, i) => {
              const sel = modo === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[s.opcao, i > 0 && s.opcaoBorda]}
                  onPress={() => escolher(m.id)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                >
                  <View style={[s.icone, sel && s.iconeSel]}>
                    <Ionicons name={m.icone} size={20} color={sel ? 'white' : colors.lav5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.opcaoTit}>{m.rotulo}</Text>
                    <Text style={s.opcaoDesc}>{m.desc}</Text>
                  </View>
                  <Ionicons name={sel ? 'radio-button-on' : 'radio-button-off'} size={22} color={sel ? colors.lav4 : colors.tl} />
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.nota}>
            {modo === 'auto'
              ? `Agora: ${escuro ? 'noturno' : 'claro'}. O app muda sozinho conforme o horário.`
              : 'Você pode trocar quando quiser.'}
          </Text>

          <Text style={s.secTit}>Toque</Text>
          <View style={[s.cartao, s.linha]}>
            <View style={s.icone}><Ionicons name="phone-portrait-outline" size={20} color={colors.lav5} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.opcaoTit}>Vibração suave</Text>
              <Text style={s.opcaoDesc}>Uma vibração leve ao registrar o check-in e as vitórias.</Text>
            </View>
            <Switch
              value={vibracao}
              onValueChange={(v) => { setVibracao(v); if (v) setTimeout(vibrarSucesso, 50); }}
              trackColor={{ false: colors.border, true: colors.lav3 }}
              thumbColor={vibracao ? colors.lav4 : colors.tl}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  conteudo: { paddingHorizontal: spacing.lg },
  coluna: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  secTit: {
    fontFamily: fonts.bodyBold, fontSize: 12, color: colors.tl, letterSpacing: 0.8,
    textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  cartao: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14, minHeight: 64 },
  opcaoBorda: { borderTopWidth: 1, borderTopColor: colors.border },
  icone: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  iconeSel: { backgroundColor: colors.lav4 },
  opcaoTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td },
  opcaoDesc: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, marginTop: 2, lineHeight: 18 },
  nota: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, marginTop: spacing.sm, marginLeft: 4 },
}));
