import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Disclaimer } from '../../components';
import { useApp } from '../../hooks/AppContext';

export default function AudioPlayerScreen({ route, navigation }) {
  const { audio } = route.params;
  const { liberarConteudo, jaLiberado } = useApp();
  const grupo = audio.categoria === 'acolhimento' ? 'acolhimento' : 'complementar';
  const [tocando, setTocando] = useState(false);

  const handlePlay = () => {
    const liberado = jaLiberado(audio.id) || liberarConteudo(audio.id, grupo);
    if (!liberado) return;
    setTocando(p => !p);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Áudio</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.artCircle}>
          <Ionicons name="headset-outline" size={48} color={colors.lav5} />
        </View>
        <Text style={styles.titulo}>{audio.titulo}</Text>
        <Text style={styles.sub}>{audio.categoria} · {audio.duracao}</Text>
        <Text style={styles.desc}>{audio.descricao}</Text>

        <TouchableOpacity style={styles.playBtn} onPress={handlePlay} activeOpacity={0.85}>
          <Ionicons name={tocando ? 'pause' : 'play'} size={28} color="white" style={!tocando && { marginLeft: 3 }} />
        </TouchableOpacity>
        <Text style={styles.playLabel}>{tocando ? 'Reproduzindo...' : 'Tocar áudio'}</Text>

        <View style={{ marginTop: spacing.xl }}>
          <Disclaimer />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  artCircle: {
    width: 140, height: 140, borderRadius: 70, backgroundColor: colors.lav1,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  titulo: { fontFamily: fonts.script, fontSize: 22, color: colors.lav6, textAlign: 'center', marginBottom: 4 },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, textTransform: 'capitalize', marginBottom: spacing.md },
  desc: { fontFamily: fonts.quote, fontSize: 14, fontStyle: 'italic', color: colors.tm, textAlign: 'center', lineHeight: 21, marginBottom: spacing.xl },
  playBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.lav4,
    alignItems: 'center', justifyContent: 'center', ...shadow.soft,
  },
  playLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: spacing.sm },
});
