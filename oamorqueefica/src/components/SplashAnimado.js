import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../theme';

const logo = require('../../assets/images/travessia_logo.png');
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Vinheta de abertura: entra por cima do app enquanto as fontes carregam e sai
// com um fade suave. `onFim` é chamado só depois que a saída termina, para a
// tela de login não aparecer por baixo antes da hora.
export default function SplashAnimado({ pronto, onFim }) {
  const halo = useRef(new Animated.Value(0)).current;
  const logoEscala = useRef(new Animated.Value(0.62)).current;
  const logoOpacidade = useRef(new Animated.Value(0)).current;
  const nomeOpacidade = useRef(new Animated.Value(0)).current;
  const nomeSubida = useRef(new Animated.Value(14)).current;
  const linha = useRef(new Animated.Value(0)).current;
  const fraseOpacidade = useRef(new Animated.Value(0)).current;
  const saida = useRef(new Animated.Value(1)).current;

  const petalas = useRef(
    [...Array(7)].map((_, i) => ({
      x: (SCREEN_W / 8) * (i + 1) + (i % 2 ? -18 : 18),
      atraso: 240 * i,
      escala: 0.5 + (i % 3) * 0.22,
      subida: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacidade, { toValue: 1, duration: 620, useNativeDriver: true }),
        Animated.spring(logoEscala, { toValue: 1, friction: 5.5, tension: 42, useNativeDriver: true }),
        Animated.timing(halo, {
          toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(nomeOpacidade, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(nomeSubida, {
          toValue: 0, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]),
      Animated.timing(linha, {
        toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(fraseOpacidade, { toValue: 1, duration: 560, useNativeDriver: true }),
    ]).start();

    petalas.forEach(p => {
      Animated.loop(
        Animated.timing(p.subida, {
          toValue: 1,
          duration: 5200,
          delay: p.atraso,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        })
      ).start();
    });
  }, []);

  // Só sai depois que o app está pronto E a vinheta teve tempo de acontecer.
  useEffect(() => {
    if (!pronto) return;
    const t = setTimeout(() => {
      Animated.timing(saida, {
        toValue: 0, duration: 620, easing: Easing.in(Easing.quad), useNativeDriver: true,
      }).start(() => onFim?.());
    }, 2150);
    return () => clearTimeout(t);
  }, [pronto]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.raiz, { opacity: saida }]} pointerEvents="none">
      <LinearGradient
        colors={['#F3EDF8', '#FAF7F3', '#F6EFE9']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {petalas.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            s.petala,
            {
              left: p.x,
              transform: [
                { translateY: p.subida.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H * 0.72, -60] }) },
                { translateX: p.subida.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 22, -10] }) },
                { scale: p.escala },
              ],
              opacity: p.subida.interpolate({ inputRange: [0, 0.18, 0.8, 1], outputRange: [0, 0.5, 0.35, 0] }),
            },
          ]}
        />
      ))}

      <View style={s.centro}>
        <Animated.View
          style={[
            s.halo,
            {
              opacity: halo.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.34, 0] }),
              transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.05] }) }],
            },
          ]}
        />
        <Animated.View
          style={[
            s.halo,
            s.haloInterno,
            {
              opacity: halo.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.42, 0.14] }),
              transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1.32] }) }],
            },
          ]}
        />

        <Animated.Image
          source={logo}
          resizeMode="contain"
          style={[s.logo, { opacity: logoOpacidade, transform: [{ scale: logoEscala }] }]}
        />

        <Animated.Text
          style={[s.nome, { opacity: nomeOpacidade, transform: [{ translateY: nomeSubida }] }]}
        >
          Atravessia
        </Animated.Text>

        <Animated.View style={[s.linha, { transform: [{ scaleX: linha }] }]} />

        <Animated.Text style={[s.frase, { opacity: fraseOpacidade }]}>
          Que você se permita sentir, acolher e seguir.
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  raiz: { alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  centro: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  halo: {
    position: 'absolute',
    width: 190, height: 190, borderRadius: 95,
    backgroundColor: colors.accent,
  },
  haloInterno: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#E4DAF0' },
  logo: { width: 132, height: 132, borderRadius: 34 },
  nome: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 46, color: colors.primary,
    marginTop: 22, letterSpacing: 1.1,
  },
  linha: {
    width: 62, height: 1.4, borderRadius: 1,
    backgroundColor: colors.ring, opacity: 0.55, marginTop: 12,
  },
  frase: {
    fontFamily: fonts.body, fontSize: 13, color: colors.tm,
    marginTop: 16, textAlign: 'center', letterSpacing: 0.3,
  },
  petala: {
    position: 'absolute', top: 0,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: colors.accent,
  },
});
