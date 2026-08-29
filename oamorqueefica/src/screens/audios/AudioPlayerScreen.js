import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio, Video, ResizeMode } from 'expo-av';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Disclaimer, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const THUMB_SIZE = 16;

function fmt(ms) {
  if (!ms || ms <= 0) return '0:00';
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export default function AudioPlayerScreen({ route, navigation }) {
  const { audio } = route.params;
  const {
    liberarConteudo, jaLiberado,
    isFavorito, adicionarFavorito, removerFavorito,
  } = useApp();
  const grupo = audio.categoria === 'acolhimento' ? 'acolhimento' : 'complementar';
  const favoritado = isFavorito(audio.id);

  const toggleFavorito = () => {
    favoritado ? removerFavorito(audio.id) : adicionarFavorito(audio);
  };

  const [tocando, setTocando]       = useState(false);
  const [posicao, setPosicao]       = useState(0);
  const [duracao, setDuracao]       = useState(0);
  const [velocidade, setVelocidade] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [barWidth, setBarWidth]     = useState(1);

  const somRef   = useRef(null);
  const videoRef = useRef(null);

  const temArquivoReal = !!audio.url;
  const isVideo = audio.tipo === 'video' && temArquivoReal;
  const progresso = duracao > 0 ? Math.min(posicao / duracao, 1) : 0;

  useEffect(() => () => { somRef.current?.unloadAsync(); }, []);

  useEffect(() => {
    if (isVideo && !jaLiberado(audio.id)) liberarConteudo(audio.id, grupo);
  }, []);

  const onStatus = useCallback((status) => {
    if (!status.isLoaded) return;
    setPosicao(status.positionMillis || 0);
    if (status.durationMillis) setDuracao(status.durationMillis);
    setTocando(!!status.isPlaying);
    if (status.didJustFinish) { setPosicao(0); setTocando(false); }
  }, []);

  const assegurarSom = async () => {
    if (somRef.current) return true;
    if (!temArquivoReal) return false;
    const liberado = jaLiberado(audio.id) || liberarConteudo(audio.id, grupo);
    if (!liberado) return false;
    setCarregando(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: audio.url },
        { shouldPlay: false, rate: velocidade, shouldCorrectPitch: true },
        onStatus,
      );
      somRef.current = sound;
      return true;
    } catch { return false; }
    finally { setCarregando(false); }
  };

  const handlePlayPause = async () => {
    if (!temArquivoReal) { setTocando(p => !p); return; }
    if (isVideo) {
      tocando ? await videoRef.current?.pauseAsync() : await videoRef.current?.playAsync();
      return;
    }
    const ok = await assegurarSom();
    if (!ok) return;
    tocando ? await somRef.current.pauseAsync() : await somRef.current.playAsync();
  };

  const handleSeek = async (x) => {
    if (duracao <= 0) return;
    const pct = Math.max(0, Math.min(x / barWidth, 1));
    const target = pct * duracao;
    setPosicao(target);
    if (somRef.current) await somRef.current.setPositionAsync(target);
    if (isVideo) await videoRef.current?.setPositionAsync(target);
  };

  const handleSkip = async (deltaMs) => {
    const target = Math.max(0, Math.min(posicao + deltaMs, duracao));
    setPosicao(target);
    if (somRef.current) await somRef.current.setPositionAsync(target);
    if (isVideo) await videoRef.current?.setPositionAsync(target);
  };

  const handleReiniciar = async () => {
    setPosicao(0);
    setTocando(false);
    if (somRef.current) {
      await somRef.current.setPositionAsync(0);
      await somRef.current.pauseAsync();
    }
    if (isVideo) {
      await videoRef.current?.setPositionAsync(0);
      await videoRef.current?.pauseAsync();
    }
  };

  const handleVelocidade = async () => {
    const idx = SPEEDS.indexOf(velocidade);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setVelocidade(next);
    if (somRef.current) await somRef.current.setRateAsync(next, true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <LavandaBg />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{isVideo ? 'Vídeo' : 'Áudio'}</Text>
        <TouchableOpacity
          onPress={toggleFavorito}
          style={styles.favTopBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={favoritado ? 'heart' : 'heart-outline'}
            size={22}
            color={favoritado ? colors.rose : colors.tm}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {isVideo ? (
          <Video
            ref={videoRef}
            source={{ uri: audio.url }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            onPlaybackStatusUpdate={onStatus}
          />
        ) : (
          <View style={styles.artCircle}>
            <Ionicons name="headset-outline" size={52} color={colors.lav5} />
          </View>
        )}

        <Text style={styles.titulo}>{audio.titulo}</Text>
        <Text style={styles.sub}>{[audio.categoria, audio.duracao].filter(Boolean).join(' · ')}</Text>
        {!!audio.descricao && <Text style={styles.desc}>{audio.descricao}</Text>}

        {!isVideo && (
          <View style={styles.playerBox}>
            {/* Time row */}
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{fmt(posicao)}</Text>
              <Text style={styles.timeText}>{fmt(duracao)}</Text>
            </View>

            {/* Seekbar */}
            <View
              style={styles.seekTrack}
              onLayout={e => setBarWidth(Math.max(1, e.nativeEvent.layout.width))}
              onStartShouldSetResponder={() => true}
              onResponderGrant={e => handleSeek(e.nativeEvent.locationX)}
              onResponderMove={e => handleSeek(e.nativeEvent.locationX)}
            >
              <View style={[styles.seekFill, { width: `${progresso * 100}%` }]} />
              <View style={[styles.seekThumb, {
                left: Math.max(0, progresso * (barWidth - THUMB_SIZE)),
              }]} />
            </View>

            {/* Controls */}
            <View style={styles.controls}>
              {/* Restart */}
              <TouchableOpacity
                onPress={handleReiniciar}
                style={styles.iconBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="refresh" size={20} color={colors.tm} />
              </TouchableOpacity>

              {/* Skip back 15s */}
              <TouchableOpacity
                onPress={() => handleSkip(-15000)}
                style={styles.skipBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="play-back-outline" size={24} color={colors.td} />
                <Text style={styles.skipLabel}>15</Text>
              </TouchableOpacity>

              {/* Play / Pause */}
              <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause} activeOpacity={0.85}>
                {carregando
                  ? <Ionicons name="hourglass-outline" size={24} color="white" />
                  : <Ionicons
                      name={tocando ? 'pause' : 'play'}
                      size={26}
                      color="white"
                      style={!tocando && { marginLeft: 3 }}
                    />
                }
              </TouchableOpacity>

              {/* Skip forward 15s */}
              <TouchableOpacity
                onPress={() => handleSkip(15000)}
                style={styles.skipBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="play-forward-outline" size={24} color={colors.td} />
                <Text style={styles.skipLabel}>15</Text>
              </TouchableOpacity>

              {/* Speed */}
              <TouchableOpacity
                onPress={handleVelocidade}
                style={styles.speedBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.speedText}>{velocidade}x</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Favoritar — salva o áudio na aba Conteúdos */}
        <TouchableOpacity
          onPress={toggleFavorito}
          style={[styles.favBtn, favoritado && styles.favBtnAtivo]}
          activeOpacity={0.85}
        >
          <Ionicons
            name={favoritado ? 'heart' : 'heart-outline'}
            size={18}
            color={favoritado ? 'white' : colors.rose}
          />
          <Text style={[styles.favBtnTxt, favoritado && styles.favBtnTxtAtivo]}>
            {favoritado ? 'Salvo nos seus conteúdos' : 'Salvar nos meus conteúdos'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.favHint}>
          {favoritado
            ? 'Você pode ouvir novamente quando quiser na aba Conteúdos.'
            : 'Toque no coração para guardar este áudio e ouvir de novo na aba Conteúdos.'}
        </Text>

        <View style={{ marginTop: spacing.lg }}>
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
  favTopBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  favBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: spacing.lg, paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: radius.full, backgroundColor: colors.card,
    borderWidth: 1.5, borderColor: colors.rose,
  },
  favBtnAtivo: { backgroundColor: colors.rose, borderColor: colors.rose },
  favBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.rose },
  favBtnTxtAtivo: { color: 'white' },
  favHint: {
    fontFamily: fonts.body, fontSize: 11, color: colors.tl,
    textAlign: 'center', marginTop: 8, maxWidth: 280, lineHeight: 16,
  },

  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
  },
  video: {
    width: '100%', height: 220, borderRadius: radius.lg,
    marginBottom: spacing.lg, backgroundColor: '#000',
  },
  artCircle: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.lav2,
    ...shadow.soft,
  },
  titulo: {
    fontFamily: fonts.script, fontSize: 22, color: colors.lav6,
    textAlign: 'center', marginBottom: 4,
  },
  sub: {
    fontFamily: fonts.body, fontSize: 12, color: colors.tm,
    textTransform: 'capitalize', marginBottom: spacing.sm,
  },
  desc: {
    fontFamily: fonts.quote, fontSize: 13, fontStyle: 'italic',
    color: colors.tm, textAlign: 'center', lineHeight: 20,
    marginBottom: spacing.lg, maxWidth: 300,
  },

  playerBox: {
    width: '100%', marginTop: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  timeRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10,
  },
  timeText: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },

  seekTrack: {
    height: 6, backgroundColor: colors.border, borderRadius: 3,
    marginBottom: spacing.lg + 4, position: 'relative', overflow: 'visible',
  },
  seekFill: {
    height: '100%', backgroundColor: colors.lav4, borderRadius: 3,
  },
  seekThumb: {
    position: 'absolute', top: -(THUMB_SIZE - 6) / 2,
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.lav4,
    borderWidth: 2.5, borderColor: colors.white,
    shadowColor: colors.lav4, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },

  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  skipBtn: {
    width: 44, height: 48, alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  skipLabel: {
    fontFamily: fonts.bodyBold, fontSize: 9, color: colors.td, lineHeight: 11,
  },
  playBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.lav4, alignItems: 'center', justifyContent: 'center',
    ...shadow.soft,
  },
  speedBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.lav1, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.lav2,
  },
  speedText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lav5 },
});
