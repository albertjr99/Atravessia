import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio, Video, ResizeMode } from 'expo-av';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Disclaimer, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';

export default function AudioPlayerScreen({ route, navigation }) {
  const { audio } = route.params;
  const { liberarConteudo, jaLiberado } = useApp();
  const grupo = audio.categoria === 'acolhimento' ? 'acolhimento' : 'complementar';
  const [tocando, setTocando] = useState(false);
  const [som, setSom] = useState(null);
  const [videoRef, setVideoRef] = useState(null);

  // Conteúdo publicado pelo painel admin tem `url` real; os áudios fixos de demonstração não.
  const temArquivoReal = !!audio.url;

  useEffect(() => () => { som?.unloadAsync(); }, [som]);

  // Vídeo usa controles nativos (sem botão próprio), então a liberação diária
  // do conteúdo precisa ser registrada já ao abrir a tela.
  useEffect(() => {
    if (audio.tipo === 'video' && temArquivoReal && !jaLiberado(audio.id)) {
      liberarConteudo(audio.id, grupo);
    }
  }, []);

  const handlePlay = async () => {
    const liberado = jaLiberado(audio.id) || liberarConteudo(audio.id, grupo);
    if (!liberado) return;

    if (!temArquivoReal) {
      setTocando(p => !p);
      return;
    }

    if (audio.tipo === 'video') {
      if (tocando) { await videoRef?.pauseAsync(); } else { await videoRef?.playAsync(); }
      setTocando(p => !p);
      return;
    }

    if (tocando) {
      await som?.pauseAsync();
      setTocando(false);
      return;
    }
    if (som) {
      await som.playAsync();
      setTocando(true);
      return;
    }
    const { sound } = await Audio.Sound.createAsync({ uri: audio.url }, { shouldPlay: true });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) setTocando(false);
    });
    setSom(sound);
    setTocando(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <LavandaBg />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{audio.tipo === 'video' ? 'Vídeo' : 'Áudio'}</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        {audio.tipo === 'video' && temArquivoReal ? (
          <Video
            ref={setVideoRef}
            source={{ uri: audio.url }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            onPlaybackStatusUpdate={(status) => setTocando(!!status.isPlaying)}
          />
        ) : (
          <View style={styles.artCircle}>
            <Ionicons name="headset-outline" size={48} color={colors.lav5} />
          </View>
        )}
        <Text style={styles.titulo}>{audio.titulo}</Text>
        <Text style={styles.sub}>{[audio.categoria, audio.duracao].filter(Boolean).join(' · ')}</Text>
        {!!audio.descricao && <Text style={styles.desc}>{audio.descricao}</Text>}

        {!(audio.tipo === 'video' && temArquivoReal) && (
          <>
            <TouchableOpacity style={styles.playBtn} onPress={handlePlay} activeOpacity={0.85}>
              <Ionicons name={tocando ? 'pause' : 'play'} size={28} color="white" style={!tocando && { marginLeft: 3 }} />
            </TouchableOpacity>
            <Text style={styles.playLabel}>{tocando ? 'Reproduzindo...' : 'Tocar áudio'}</Text>
          </>
        )}

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
  video: { width: '100%', height: 220, borderRadius: radius.lg, marginBottom: spacing.lg, backgroundColor: '#000' },
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
