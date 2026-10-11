import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, criarEstilos } from '../theme';
import { vibrarLeve } from '../utils/vibrar';

// Barra de abas da usuária: Início · Meu caminho · AtravessIA (centro) ·
// Explorar · Perfil. As abas são telas da mesma pilha: o Início fica sempre
// por baixo e as outras se substituem entre si, então o "voltar" do Android
// leva ao Início em vez de empilhar abas.
export const ABAS = [
  { id: 'inicio', rotulo: 'Início', icone: 'home', rota: 'MainTabs' },
  { id: 'caminho', rotulo: 'Meu caminho', icone: 'footsteps', rota: 'MeuCaminho' },
  { id: 'ia', rotulo: 'AtravessIA', icone: 'sparkles', rota: 'AtravessIA', central: true },
  { id: 'explorar', rotulo: 'Explorar', icone: 'compass', rota: 'Explorar' },
  { id: 'perfil', rotulo: 'Perfil', icone: 'person', rota: 'PerfilUsuario' },
];

// Altura ocupada pela barra (sem a área do sistema), para o conteúdo não ficar por baixo.
export const ALTURA_BARRA = 72;

export default function BarraAbas({ navigation, ativo }) {
  const insets = useSafeAreaInsets();
  const ir = (aba) => {
    if (aba.id === ativo) return;
    vibrarLeve();
    if (ativo === 'inicio' || aba.rota === 'MainTabs') navigation.navigate(aba.rota);
    else navigation.replace(aba.rota);
  };

  return (
    <View style={[s.barra, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {ABAS.map(aba => {
        const sel = aba.id === ativo;
        if (aba.central) {
          return (
            <TouchableOpacity
              key={aba.id}
              style={s.item}
              onPress={() => ir(aba)}
              activeOpacity={0.85}
              accessibilityRole="tab"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={aba.rotulo}
            >
              <View style={[s.central, sel && s.centralSel]}>
                <Ionicons name={aba.icone} size={25} color="#FFFFFF" />
              </View>
              <Text style={[s.rotulo, s.rotuloCentral]} numberOfLines={1}>{aba.rotulo}</Text>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            key={aba.id}
            style={s.item}
            onPress={() => ir(aba)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={aba.rotulo}
          >
            <View style={[s.iconeCaixa, sel && s.iconeCaixaSel]}>
              <Ionicons name={sel ? aba.icone : `${aba.icone}-outline`} size={22} color={sel ? colors.lav5 : colors.texto2} />
            </View>
            <Text style={[s.rotulo, sel && s.rotuloSel]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{aba.rotulo}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = criarEstilos(() => ({
  barra: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.bordaSuave,
    paddingTop: 6,
    shadowColor: '#2E2740', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 12,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3, minHeight: 52 },
  iconeCaixa: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconeCaixaSel: { backgroundColor: colors.lav1 },
  rotulo: { fontFamily: 'Lato_400Regular', fontSize: 11, color: colors.texto2 },
  rotuloSel: { fontFamily: 'Lato_700Bold', color: colors.lav5 },
  central: {
    width: 58, height: 58, borderRadius: 29, marginTop: -26,
    backgroundColor: colors.botaoForte, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: colors.bg,
    shadowColor: '#5C3FA0', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 8,
  },
  centralSel: { borderColor: colors.lav2 },
  rotuloCentral: { fontFamily: 'Lato_700Bold', color: colors.titulo },
}), { escalar: false });
