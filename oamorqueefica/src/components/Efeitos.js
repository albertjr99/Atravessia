import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, Pressable, Platform, AccessibilityInfo, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../theme';

// Respeita o "reduzir movimento" do aparelho: quem desligou animações vê tudo parado.
function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    let ativo = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(v => { if (ativo) setReduzido(!!v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', v => setReduzido(!!v));
    return () => { ativo = false; sub?.remove?.(); };
  }, []);
  return reduzido;
}

// Logotipo que "respira": cresce e volta bem devagar (4 s inspirando, 4 s soltando),
// com um halo lilás suave atrás.
export function LogoRespira({ source, style }) {
  const reduzido = useMovimentoReduzido();
  const fase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzido) { fase.setValue(0); return undefined; }
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(fase, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(fase, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [reduzido, fase]);

  const plano = StyleSheet.flatten(style) || {};
  const raio = plano.borderRadius || 13;
  const escala = fase.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const haloEscala = fase.interpolate({ inputRange: [0, 1], outputRange: [1, 1.32] });
  const haloOpacidade = fase.interpolate({ inputRange: [0, 1], outputRange: [0, colors.escuro ? 0.25 : 0.3] });

  return (
    <View style={{ width: plano.width, height: plano.height }} accessible accessibilityRole="image" accessibilityLabel="Logotipo Atravessia">
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {
          borderRadius: raio * 1.6, backgroundColor: '#B6A6DC',
          opacity: haloOpacidade, transform: [{ scale: haloEscala }],
        }]}
      />
      <Animated.Image source={source} resizeMode="contain" style={[style, { transform: [{ scale: escala }] }]} />
    </View>
  );
}

// Vidro fosco: desfoca o que está atrás (a aquarela do topo) com um véu claro por cima.
// No Android o desfoque nativo é o método experimental do expo-blur; se não houver
// suporte, o véu translúcido sozinho já dá o efeito.
export function Vidro({ style, children, intensidade = 40 }) {
  const plano = StyleSheet.flatten(style) || {};
  return (
    <View style={[style, { overflow: 'hidden' }]}>
      <BlurView
        intensity={intensidade}
        tint={colors.escuro ? 'dark' : 'light'}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={[StyleSheet.absoluteFill, { borderRadius: plano.borderRadius }]}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {
          backgroundColor: colors.escuro ? 'rgba(37,32,47,0.55)' : 'rgba(255,253,249,0.5)',
        }]}
      />
      {children}
    </View>
  );
}

// Botão com profundidade: tem uma "borda" mais escura embaixo e afunda ao toque.
// `externo` posiciona o conjunto (ex.: flex: 1 numa linha); `estilo` é a face do botão; `base` é a cor da borda inferior; `raio` o arredondamento.
export function Profundo({ externo, onPress, estilo, base, raio = 999, altura = 5, sombra, children, accessibilityLabel, accessibilityRole = 'button' }) {
  const desce = useRef(new Animated.Value(0)).current;
  const mover = (v) => Animated.timing(desce, { toValue: v, duration: 110, useNativeDriver: true }).start();
  const translateY = desce.interpolate({ inputRange: [0, 1], outputRange: [0, altura - 2] });
  return (
    <View style={[{ borderRadius: raio, backgroundColor: base, paddingBottom: altura }, sombra, externo]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => mover(1)}
        onPressOut={() => mover(0)}
        style={{ flexGrow: 1 }}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
      >
        <Animated.View style={[{ flexGrow: 1 }, estilo, { borderRadius: raio, transform: [{ translateY }] }]}>
          {children}
        </Animated.View>
      </Pressable>
    </View>
  );
}
