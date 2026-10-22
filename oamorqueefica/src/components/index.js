import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { colors, fonts, radius, shadow, spacing, criarEstilos } from '../theme';

import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

const lavLeft = require('../../assets/images/lavanda_left.png');
const lavRight = require('../../assets/images/lavanda_right.png');
const lavSmall = require('../../assets/images/lavanda_small.png');
const florPeach = require('../../assets/images/flor_peach.png');

// Manchas da aurora: centro (%), raios (%) e cor. A tela estica o desenho
// (preserveAspectRatio="none"), então as manchas acompanham qualquer tamanho.
const MANCHAS = [
  { id: 'a1', cx: 8, cy: 4, rx: 70, ry: 38, cor: 'auroraLilas' },
  { id: 'a2', cx: 100, cy: 34, rx: 60, ry: 30, cor: 'auroraPessego' },
  { id: 'a3', cx: 0, cy: 62, rx: 65, ry: 32, cor: 'auroraSalvia' },
  { id: 'a4', cx: 100, cy: 88, rx: 70, ry: 36, cor: 'auroraLilas' },
];

// Fundo "Luz de Vidro": aurora suave (lilás, pêssego e sálvia) e ramos de
// lavanda discretos. Só imagens com transparência e sem tintColor: antes, as
// ilustrações sem canal alfa viravam retângulos chapados no Android.
export function LavandaBg() {
  return (
    <View style={bgSty.container} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          {MANCHAS.map(m => (
            <RadialGradient key={m.id} id={m.id} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
              <Stop offset="0" stopColor={colors[m.cor]} stopOpacity={colors.auroraOpacidade} />
              <Stop offset="0.45" stopColor={colors[m.cor]} stopOpacity={colors.auroraOpacidade * 0.45} />
              <Stop offset="1" stopColor={colors[m.cor]} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {MANCHAS.map(m => (
          <Ellipse key={m.id} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} fill={`url(#${m.id})`} />
        ))}
      </Svg>
      <Image source={lavRight} style={[bgSty.topRight, colors.escuro && bgSty.noite]} resizeMode="contain" />
      <Image source={lavLeft} style={[bgSty.bottomLeft, colors.escuro && bgSty.noite]} resizeMode="contain" />
      <Image source={florPeach} style={[bgSty.bottomRight, colors.escuro && bgSty.noite]} resizeMode="contain" />
      <Image source={lavSmall} style={[bgSty.centerRight, colors.escuro && bgSty.noite]} resizeMode="contain" />
    </View>
  );
}

const bgSty = criarEstilos(() => ({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: colors.bg },
  topRight: { position: 'absolute', top: -20, right: -30, width: 170, height: 170, opacity: 0.22 },
  bottomLeft: { position: 'absolute', bottom: 30, left: -30, width: 150, height: 150, opacity: 0.2 },
  bottomRight: { position: 'absolute', bottom: -10, right: -10, width: 90, height: 90, opacity: 0.25 },
  centerRight: { position: 'absolute', top: '52%', right: -16, width: 70, height: 70, opacity: 0.18 },
  noite: { opacity: 0.1 },
}));

export function Card({ children, style, onPress }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} style={[styles.card, style]}>
      {children}
    </Wrapper>
  );
}

export function Button({ title, onPress, variant = 'primary', style, textStyle, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'ghost' && styles.btnGhost,
        variant === 'peach' && styles.btnPeach,
        disabled && { opacity: 0.5 },
        style,
      ]}
      activeOpacity={0.8}
    >
      <Text style={[
        styles.btnText,
        variant === 'primary' && styles.btnTextPrimary,
        variant === 'secondary' && styles.btnTextSecondary,
        variant === 'ghost' && styles.btnTextGhost,
        variant === 'peach' && styles.btnTextPeach,
        textStyle,
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export function SectionHeader({ title, linkText, onLink }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {linkText && (
        <TouchableOpacity onPress={onLink}>
          <Text style={styles.sectionLink}>{linkText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function PlanBadge({ plano }) {
  if (plano === 0) return null;
  const labels = { 1: 'Plano 1', 2: 'Plano 2', 3: 'Plano 3' };
  const bgColors = { 1: colors.lav1, 2: colors.lav1, 3: '#FBF0E5' };
  const textColors = { 1: colors.lav6, 2: colors.lav6, 3: '#9a7040' };
  return (
    <View style={[styles.badge, { backgroundColor: bgColors[plano] }]}>
      <Text style={[styles.badgeText, { color: textColors[plano] }]}>{labels[plano]}</Text>
    </View>
  );
}

export function LockedOverlay({ plano, onUpgrade }) {
  return (
    <TouchableOpacity onPress={onUpgrade} style={styles.lockedRow}>
      <Text style={styles.lockedIcon}>🔒</Text>
      <Text style={styles.lockedText}>Disponível no Plano {plano}</Text>
    </TouchableOpacity>
  );
}

export function ScriptTitle({ children, size = 22, style }) {
  return (
    <Text style={[{ fontFamily: fonts.script, fontSize: size, color: colors.lav6 }, style]}>
      {children}
    </Text>
  );
}

export function QuoteText({ children, style }) {
  return (
    <Text style={[styles.quoteText, style]}>{children}</Text>
  );
}

export function Disclaimer() {
  return (
    <Text style={styles.disclaimer}>
      Este aplicativo não substitui acompanhamento médico ou psicológico profissional.
    </Text>
  );
}

export function ProgressBar({ progress, color = colors.lav4 }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = criarEstilos(() => ({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.bordaLuz,
    ...shadow.card,
  },
  btn: {
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.botao, borderBottomWidth: 3, borderBottomColor: colors.botaoBase,
    shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 4,
  },
  btnSecondary: { backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.lav2 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.lav3 },
  btnPeach: { backgroundColor: colors.peach2 },
  btnText: { fontSize: 14, fontFamily: fonts.bodyBold },
  btnTextPrimary: { color: colors.white },
  btnTextSecondary: { color: colors.lilasTexto },
  btnTextGhost: { color: colors.lilasTexto },
  btnTextPeach: { color: colors.white },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  sectionLink: { fontFamily: fonts.body, fontSize: 11, color: colors.lav5 },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 0.3 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  lockedText: { fontFamily: fonts.body, fontSize: 11, color: colors.peach2 },
  lockedIcon: { fontSize: 11 },
  quoteText: {
    fontFamily: fonts.quote,
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.td,
    lineHeight: 22,
    textAlign: 'center',
  },
  disclaimer: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.tl,
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: spacing.lg,
  },
  progressTrack: {
    height: 5,
    backgroundColor: colors.lav1,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
}));
