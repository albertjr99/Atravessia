import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, criarEstilos } from '../theme';

// Peças compartilhadas para deixar claro que o coração serve para FAVORITAR:
//  - BotaoFavoritar: coração com rótulo ("Favoritar" / "Favoritado"), vazio x
//    preenchido.
//  - useAvisoRapido + AvisoRapido: aviso curto ("Guardado nos seus Favoritos"),
//    com ação opcional (ex.: "Desfazer").
//  - DicaFavoritos: dica fixa explicando o coração e a leitura dos textos.
//  - acaoDoConteudo: o que acontece ao tocar no cartão (ex.: "Ler texto completo").

export function BotaoFavoritar({ favoritado, onPress, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.8}
      style={[s.botao, favoritado ? s.botaoAtivo : s.botaoVazio, style]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!favoritado }}
      accessibilityLabel={favoritado ? 'Favoritado. Toque para tirar dos seus Favoritos' : 'Favoritar este conteúdo'}
    >
      <Ionicons
        name={favoritado ? 'heart' : 'heart-outline'}
        size={17}
        color={favoritado ? colors.roseTexto : colors.lilasTexto}
      />
      <Text style={[s.botaoTxt, { color: favoritado ? colors.roseTexto : colors.lilasTexto }]}>
        {favoritado ? 'Favoritado' : 'Favoritar'}
      </Text>
    </TouchableOpacity>
  );
}

export function useAvisoRapido() {
  const [aviso, setAviso] = useState(null);
  const timer = useRef(null);
  const fechar = useCallback(() => {
    clearTimeout(timer.current);
    setAviso(null);
  }, []);
  const mostrar = useCallback((novo) => {
    clearTimeout(timer.current);
    setAviso({ ...novo, chave: Date.now() });
    AccessibilityInfo.announceForAccessibility?.(novo.texto);
    timer.current = setTimeout(() => setAviso(null), novo.acao ? 4500 : 2800);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { aviso, mostrar, fechar };
}

// Aviso flutuante no rodapé da tela. `inferior` soma a área segura de baixo.
export function AvisoRapido({ aviso, onFechar, inferior = 0 }) {
  const opacidade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!aviso) return;
    opacidade.setValue(0);
    Animated.timing(opacidade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [aviso?.chave]);
  if (!aviso) return null;
  const translateY = opacidade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return (
    <View pointerEvents="box-none" style={[s.avisoWrap, { bottom: 20 + inferior }]}>
      <Animated.View style={[s.aviso, { opacity: opacidade, transform: [{ translateY }] }]} accessibilityLiveRegion="polite">
        <Ionicons name={aviso.icone || 'heart'} size={18} color={colors.roseTexto} />
        <Text style={s.avisoTxt}>{aviso.texto}</Text>
        {aviso.acao ? (
          <TouchableOpacity
            onPress={() => { onFechar?.(); aviso.acao.onPress?.(); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={s.avisoAcao}
            accessibilityRole="button"
          >
            <Text style={s.avisoAcaoTxt}>{aviso.acao.rotulo}</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </View>
  );
}

export function DicaFavoritos({ texto }) {
  return (
    <View style={s.dica}>
      <View style={s.dicaIcone}>
        <Ionicons name="heart" size={18} color={colors.roseTexto} />
      </View>
      <Text style={s.dicaTxt}>
        {texto || (
          <>
            Toque em <Text style={s.dicaForte}>♡ Favoritar</Text> em qualquer conteúdo para guardá-lo aqui.
            Para tirar, toque em <Text style={s.dicaForte}>Favoritado</Text>. Nos textos, toque no cartão
            para ler o texto completo.
          </>
        )}
      </Text>
    </View>
  );
}

// O que o toque no cartão faz, conforme o tipo do conteúdo.
export function acaoDoConteudo(item, bloqueado) {
  if (bloqueado) return { rotulo: 'Disponível em outro plano', icone: 'lock-closed-outline' };
  const linkComTexto = item?.tipo === 'link' && !!String(item?.descricao || '').trim();
  switch (item?.tipo) {
    case 'texto': return { rotulo: 'Ler texto completo', icone: 'book-outline' };
    case 'imagem': return { rotulo: 'Ver imagem', icone: 'image-outline' };
    case 'link': return linkComTexto
      ? { rotulo: 'Ler e abrir o link', icone: 'book-outline' }
      : { rotulo: 'Abrir link', icone: 'open-outline' };
    case 'documento': return { rotulo: 'Abrir documento', icone: 'open-outline' };
    case 'video': return { rotulo: 'Assistir', icone: 'play-circle-outline' };
    default: return { rotulo: 'Ouvir', icone: 'headset-outline' };
  }
}

const s = criarEstilos(() => ({
  botao: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36,
    paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, flexShrink: 0,
  },
  botaoVazio: { backgroundColor: colors.vidro, borderColor: colors.lav2 },
  botaoAtivo: { backgroundColor: colors.roseFundo, borderColor: colors.roseFundo },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 13 },

  avisoWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 520,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.xl,
    backgroundColor: colors.cardSolido, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: colors.escuro ? 0.4 : 0.16, shadowRadius: 18, elevation: 6,
  },
  avisoTxt: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.titulo },
  avisoAcao: { paddingHorizontal: 6, minHeight: 32, justifyContent: 'center' },
  avisoAcaoTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },

  dica: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginBottom: spacing.lg,
    backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: colors.escuro ? 0.28 : 0.11, shadowRadius: 20, elevation: 2,
  },
  dicaIcone: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.roseFundo, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dicaTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.texto2, lineHeight: 19 },
  dicaForte: { fontFamily: fonts.bodyBold, color: colors.roseTexto },
}));
