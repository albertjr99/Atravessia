import React, { useState } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, criarEstilos } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Cartão que abre e fecha pelo cabeçalho, com uma setinha à direita. Usado
// nos cartões com muito texto ou formulário, no app e no painel, para a tela
// ficar mais organizada: fechado por padrão, a pessoa abre quando quiser.
//
// Props: titulo, subtitulo?, icone? (Ionicons), inicialAberto=false,
// aberto/onAlternar (modo controlado), direita? (elemento extra no
// cabeçalho), estilo?, estiloConteudo?, children.
export default function Recolhivel({
  titulo, subtitulo, icone, inicialAberto = false, aberto: abertoControlado, onAlternar,
  direita, estilo, estiloConteudo, children,
}) {
  const [abertoInterno, setAbertoInterno] = useState(inicialAberto);
  const aberto = abertoControlado ?? abertoInterno;

  const alternar = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
    if (onAlternar) onAlternar(!aberto);
    if (abertoControlado == null) setAbertoInterno(!aberto);
  };

  return (
    <View style={[s.cartao, estilo]}>
      <TouchableOpacity
        style={s.cabecalho}
        onPress={alternar}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        accessibilityLabel={`${titulo}. ${aberto ? 'Toque para fechar' : 'Toque para abrir'}`}
      >
        {!!icone && (
          <View style={s.icone}><Ionicons name={icone} size={18} color={colors.lilasTexto} /></View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.titulo} numberOfLines={2}>{titulo}</Text>
          {!!subtitulo && <Text style={s.subtitulo} numberOfLines={2}>{subtitulo}</Text>}
        </View>
        {direita}
        <View style={[s.seta, aberto && s.setaAberta]}>
          <Ionicons name="chevron-down" size={18} color={colors.lilasTexto} />
        </View>
      </TouchableOpacity>
      {aberto && <View style={[s.conteudo, estiloConteudo]}>{children}</View>}
    </View>
  );
}

const s = criarEstilos(() => ({
  cartao: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz, borderRadius: 22, marginBottom: 12,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 2,
    overflow: 'hidden',
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 56 },
  icone: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lav1 },
  titulo: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: colors.titulo },
  subtitulo: { fontFamily: 'Figtree_400Regular', fontSize: 13, lineHeight: 18, color: colors.texto2, marginTop: 2 },
  seta: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.vidroTenue },
  setaAberta: { transform: [{ rotate: '180deg' }] },
  conteudo: { paddingHorizontal: 16, paddingBottom: 16 },
}));
