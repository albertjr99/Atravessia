import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { criarSomComTelaBloqueio } from '../../utils/somComTelaBloqueio';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
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
  const insets = useSafeAreaInsets();
  const { audio } = route.params;
  const {
    liberarConteudo, jaLiberado,
    isFavorito, adicionarFavorito, removerFavorito, temAcesso,
  } = useApp();
  const grupo = audio.categoria === 'acolhimento' ? 'acolhimento' : 'complementar';

  // Plano gratuito: o conteúdo é visível, mas não reproduz nem pode ser salvo.
  const planoNecessario = audio.plano ?? 1;
  const temAcessoAoAudio = temAcesso(planoNecessario);
  const favoritado = temAcessoAoAudio && isFavorito(audio.id);

  const avisarPlano = () => {
    Alert.alert(
      'Disponível em outro plano',
      'Este conteúdo faz parte de um plano superior. Deseja conhecer os planos?',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Ver planos', onPress: () => navigation.navigate('Planos') },
      ]
    );
  };

  const toggleFavorito = () => {
    if (!temAcessoAoAudio) { avisarPlano(); return; }
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

  // Antes, qualquer falha ao preparar o áudio era engolida e o botão
  // simplesmente não fazia nada (como relatado no tablet). Agora a pessoa
  // recebe um aviso, e o modo de áudio do Android é configurado por completo.
  const assegurarSom = async () => {
    if (somRef.current) return true;
    if (!temArquivoReal) return false;
    const liberado = jaLiberado(audio.id) || liberarConteudo(audio.id, grupo);
    if (!liberado) {
      Alert.alert('Limite de hoje', 'Você já ouviu o conteúdo liberado para hoje neste grupo. Amanhã um novo estará disponível para você.');
      return false;
    }
    setCarregando(true);
    try {
      // Toca com a tela bloqueada e mostra play/pausa na tela de bloqueio.
      somRef.current = await criarSomComTelaBloqueio({
        uri: audio.url, titulo: audio.titulo, rate: velocidade, onStatus,
      });
      return true;
    } catch (e) {
      console.warn('[Audio] não carregou:', e?.message);
      Alert.alert('Não foi possível tocar o áudio', 'Confira sua conexão com a internet e se o volume de mídia do aparelho está ligado. Depois, tente de novo.');
      return false;
    } finally { setCarregando(false); }
  };

  const handlePlayPause = async () => {
    if (!temAcessoAoAudio) { avisarPlano(); return; }
    if (!temArquivoReal) { setTocando(p => !p); return; }
    if (isVideo) {
      tocando ? await videoRef.current?.pauseAsync() : await videoRef.current?.playAsync();
      return;
    }
    const ok = await assegurarSom();
    if (!ok) return;
    try {
      tocando ? await somRef.current.pauseAsync() : await somRef.current.playAsync();
    } catch (e) {
      console.warn('[Audio] play/pause:', e?.message);
      // Tenta recriar o som uma vez (alguns aparelhos perdem o player ao trocar de app).
      try { await somRef.current?.unloadAsync(); } catch {}
      somRef.current = null;
      if (await assegurarSom()) await somRef.current?.playAsync().catch(() => {});
    }
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
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.titulo} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{isVideo ? 'Vídeo' : 'Áudio'}</Text>
        {temAcessoAoAudio ? (
          <TouchableOpacity
            onPress={toggleFavorito}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={favoritado ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
          >
            <Ionicons
              name={favoritado ? 'heart' : 'heart-outline'}
              size={21}
              color={favoritado ? colors.roseTexto : colors.texto2}
            />
          </TouchableOpacity>
        ) : <View style={{ width: 44 }} />}
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
          <View style={styles.capa}>
            <LinearGradient colors={colors.joiaLilas.slice(0, 2)} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.capaIcone}>
              <Ionicons name="headset-outline" size={46} color={colors.joiaLilasTexto} />
            </View>
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

            {/* Controls: pílulas de vidro em volta do botão principal */}
            <View style={styles.controls}>
              {/* Restart */}
              <TouchableOpacity
                onPress={handleReiniciar}
                style={styles.pilula}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Reiniciar"
              >
                <Ionicons name="refresh" size={19} color={colors.texto2} />
              </TouchableOpacity>

              {/* Skip back 15s */}
              <TouchableOpacity
                onPress={() => handleSkip(-15000)}
                style={styles.pilula}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Voltar 15 segundos"
              >
                <Ionicons name="play-back-outline" size={19} color={colors.titulo} />
                <Text style={styles.skipLabel}>15</Text>
              </TouchableOpacity>

              {/* Play / Pause */}
              <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause} activeOpacity={0.85} accessibilityLabel={tocando ? 'Pausar' : 'Tocar'}>
                <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                {carregando
                  ? <Ionicons name="hourglass-outline" size={24} color="white" />
                  : <Ionicons
                      name={tocando ? 'pause' : 'play'}
                      size={28}
                      color="white"
                      style={!tocando && { marginLeft: 3 }}
                    />
                }
              </TouchableOpacity>

              {/* Skip forward 15s */}
              <TouchableOpacity
                onPress={() => handleSkip(15000)}
                style={styles.pilula}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Avançar 15 segundos"
              >
                <Ionicons name="play-forward-outline" size={19} color={colors.titulo} />
                <Text style={styles.skipLabel}>15</Text>
              </TouchableOpacity>

              {/* Speed */}
              <TouchableOpacity
                onPress={handleVelocidade}
                style={[styles.pilula, styles.speedBtn]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Velocidade"
              >
                <Text style={styles.speedText}>{velocidade}x</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!temAcessoAoAudio ? (
          <TouchableOpacity style={styles.bloqBox} onPress={avisarPlano} activeOpacity={0.85}>
            <View style={styles.bloqIcone}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.lilasIcone} />
            </View>
            <Text style={styles.bloqTxt}>
              A reprodução deste áudio está disponível em outro plano.
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.lilasTexto} />
          </TouchableOpacity>
        ) : (
        <>
        {/* Favoritar — salva o áudio na aba Conteúdos */}
        <TouchableOpacity
          onPress={toggleFavorito}
          style={[styles.favBtn, favoritado && styles.favBtnAtivo]}
          activeOpacity={0.85}
        >
          <Ionicons
            name={favoritado ? 'heart' : 'heart-outline'}
            size={18}
            color={favoritado ? 'white' : colors.roseTexto}
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
        </>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <Disclaimer />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: colors.escuro ? 0.25 : 0.08, shadowRadius: 10, elevation: 2,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.titulo },
  bloqBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: spacing.lg, padding: 12, alignSelf: 'stretch',
    borderRadius: 20, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.bordaLuz,
  },
  bloqIcone: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  bloqTxt: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.lilasTexto, lineHeight: 18 },

  favBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: spacing.lg, minHeight: 46, paddingHorizontal: 20,
    borderRadius: radius.full, backgroundColor: colors.vidro,
    borderWidth: 1, borderColor: colors.escuro ? colors.bordaLuz : '#F0C6D2',
  },
  favBtnAtivo: { backgroundColor: colors.roseTexto, borderColor: colors.roseTexto },
  favBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.roseTexto },
  favBtnTxtAtivo: { color: colors.escuro ? '#1C1726' : 'white' },
  favHint: {
    fontFamily: fonts.body, fontSize: 12, color: colors.texto2,
    textAlign: 'center', marginTop: 8, lineHeight: 17, paddingHorizontal: spacing.lg,
  },

  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.lg,
  },
  video: {
    width: '100%', height: 220, borderRadius: 22,
    marginBottom: spacing.lg, backgroundColor: '#000',
  },
  // Capa do áudio: cartão-joia lilás com cantos arredondados
  capa: {
    width: 168, height: 168, borderRadius: 22, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 14 }, shadowOpacity: colors.escuro ? 0.4 : 0.22, shadowRadius: 24, elevation: 3,
  },
  capaIcone: { width: 84, height: 84, borderRadius: 26, backgroundColor: colors.vidroForte, alignItems: 'center', justifyContent: 'center' },
  titulo: {
    fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.titulo,
    textAlign: 'center', marginBottom: 4,
  },
  sub: {
    fontFamily: fonts.bodySemi, fontSize: 13, color: colors.lilasTexto,
    textTransform: 'capitalize', marginBottom: spacing.sm,
  },
  desc: {
    fontFamily: fonts.quote, fontSize: 18, color: colors.texto2, textAlign: 'center', lineHeight: 25,
    marginBottom: spacing.md, paddingHorizontal: spacing.md,
  },

  playerBox: {
    width: '100%', marginTop: spacing.md,
    backgroundColor: colors.card, borderRadius: 26,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.28 : 0.11, shadowRadius: 20, elevation: 2,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  timeText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2 },

  seekTrack: {
    height: 6, backgroundColor: colors.lav1, borderRadius: 3,
    marginBottom: spacing.lg + 6, position: 'relative', overflow: 'visible',
  },
  seekFill: { height: '100%', backgroundColor: colors.botao, borderRadius: 3 },
  seekThumb: {
    position: 'absolute', top: -(THUMB_SIZE - 6) / 2,
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.botao, borderWidth: 3, borderColor: colors.white,
    shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2,
  },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pilula: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidroForte, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 3 }, shadowOpacity: colors.escuro ? 0.2 : 0.07, shadowRadius: 6, elevation: 1,
  },
  skipLabel: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.titulo, lineHeight: 11, marginTop: -1 },
  playBtn: {
    width: 70, height: 70, borderRadius: 35, overflow: 'hidden',
    backgroundColor: colors.botao, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 4,
  },
  speedBtn: { backgroundColor: colors.lav1 },
  speedText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lilasTexto },
}));
