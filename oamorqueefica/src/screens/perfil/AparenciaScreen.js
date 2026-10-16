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
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Aparência</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={s.coluna}>
          <Text style={s.secTit}>Tema</Text>
          {/* Opções em trilho de vidro: a escolhida fica em branco sólido */}
          <View style={s.trilho}>
            {MODOS_TEMA.map((m, i) => {
              const sel = modo === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[s.opcao, sel && s.opcaoSel]}
                  onPress={() => escolher(m.id)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                >
                  <View style={[s.icone, sel && s.iconeSel]}>
                    <Ionicons name={m.icone} size={20} color={sel ? 'white' : colors.lilasIcone} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.opcaoTit}>{m.rotulo}</Text>
                    <Text style={s.opcaoDesc}>{m.desc}</Text>
                  </View>
                  <Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={sel ? colors.lilasIcone : colors.tl} />
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
            <View style={s.icone}><Ionicons name="phone-portrait-outline" size={20} color={colors.lilasIcone} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.opcaoTit}>Vibração suave</Text>
              <Text style={s.opcaoDesc}>Uma vibração leve ao registrar o check-in e as vitórias.</Text>
            </View>
            <Switch
              value={vibracao}
              onValueChange={(v) => { setVibracao(v); if (v) setTimeout(vibrarSucesso, 50); }}
              trackColor={{ false: colors.lav2, true: colors.botao }}
              thumbColor={colors.cardSolido}
            />
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
  coluna: { width: '100%' },
  secTit: {
    fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.lilasTexto, letterSpacing: 1,
    textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: 6,
  },
  trilho: { backgroundColor: colors.vidro, borderRadius: 26, borderWidth: 1, borderColor: colors.bordaLuz, padding: 5, gap: 4 },
  cartao: {
    backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.bordaLuz, paddingHorizontal: spacing.md,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12, paddingHorizontal: 12, minHeight: 68, borderRadius: 21 },
  opcaoSel: {
    backgroundColor: colors.escuro ? colors.lav2 : colors.cardSolido,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 2,
  },
  icone: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  iconeSel: { backgroundColor: colors.botao },
  opcaoTit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo },
  opcaoDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2, lineHeight: 19 },
  nota: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: spacing.sm, marginLeft: 6 },
}));
