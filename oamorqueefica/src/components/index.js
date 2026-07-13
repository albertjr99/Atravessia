import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { colors, fonts, radius, shadow, spacing } from '../theme';

const lavLeft = require('../../assets/images/lavanda_left.png');
const lavRight = require('../../assets/images/lavanda_right.png');

export function LavandaBg() {
  return (
    <View style={bgSty.container} pointerEvents="none">
      <Image source={lavRight} style={bgSty.topRight} resizeMode="contain" />
      <Image source={lavLeft} style={bgSty.bottomLeft} resizeMode="contain" />
    </View>
  );
}

const bgSty = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  topRight: { position: 'absolute', top: -10, right: -10, width: 160, height: 160, opacity: 0.14 },
  bottomLeft: { position: 'absolute', bottom: 50, left: -10, width: 140, height: 140, opacity: 0.14 },
});

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  btn: {
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.lav4 },
  btnSecondary: { backgroundColor: colors.lav1, borderWidth: 1, borderColor: colors.lav3 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.lav3 },
  btnPeach: { backgroundColor: colors.peach2 },
  btnText: { fontSize: 14, fontFamily: fonts.bodyBold },
  btnTextPrimary: { color: colors.white },
  btnTextSecondary: { color: colors.lav6 },
  btnTextGhost: { color: colors.lav5 },
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
});
