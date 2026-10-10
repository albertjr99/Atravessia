import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator, PanResponder,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, criarEstilos } from '../theme';

// Player de vídeo no estilo do YouTube, com a cara do app: tocar/pausar,
// voltar e avançar 10 s, barra de progresso arrastável, velocidade (0,5× a 2×),
// som e tela cheia. Os controles somem sozinhos enquanto o vídeo toca e voltam
// com um toque.
const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const ESCONDER_APOS_MS = 3000;

const doisDigitos = (n) => String(n).padStart(2, '0');
function tempo(seg) {
  const s = Math.max(0, Math.floor(seg || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${doisDigitos(m)}:${doisDigitos(s % 60)}` : `${m}:${doisDigitos(s % 60)}`;
}
const rotuloVelocidade = (v) => `${String(v).replace('.', ',')}×`;

// `largura` e `maxAltura` definem o espaço disponível: o vídeo ocupa a largura
// toda e, se for vertical (gravado no celular), encolhe para caber na altura.
export default function PlayerVideo({ url, titulo, autoPlay = true, onTerminar, largura, maxAltura, style }) {
  const player = useVideoPlayer(url ? { uri: url, metadata: { title: titulo } } : null, (p) => {
    p.timeUpdateEventInterval = 0.25;
    // No Android a correção de tom vem desligada (apesar da documentação dizer
    // o contrário): ao acelerar, a voz ficava aguda. Com ela ligada, só a
    // velocidade muda.
    p.preservesPitch = true;
    p.loop = false;
    if (autoPlay) p.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  const { playbackRate } = useEvent(player, 'playbackRateChange', { playbackRate: player.playbackRate });
  const [atual, setAtual] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [proporcao, setProporcao] = useState(16 / 9);
  const [terminou, setTerminou] = useState(false);
  const [controles, setControles] = useState(true);
  const [menuVelocidade, setMenuVelocidade] = useState(false);
  const [arrastando, setArrastando] = useState(null); // 0..1 enquanto arrasta
  const viewRef = useRef(null);
  const larguraBarra = useRef(1);
  const timer = useRef(null);

  useEffect(() => {
    const subs = [
      player.addListener('timeUpdate', ({ currentTime }) => {
        setAtual(currentTime);
        if (player.duration > 0) setDuracao(player.duration);
      }),
      player.addListener('sourceLoad', ({ duration, availableVideoTracks }) => {
        if (duration > 0) setDuracao(duration);
        const t = availableVideoTracks?.[0]?.size;
        if (t?.width > 0 && t?.height > 0) setProporcao(t.width / t.height);
      }),
      player.addListener('videoTrackChange', ({ videoTrack }) => {
        const t = videoTrack?.size;
        if (t?.width > 0 && t?.height > 0) setProporcao(t.width / t.height);
      }),
      player.addListener('playToEnd', () => {
        setTerminou(true);
        setControles(true);
        onTerminar?.();
      }),
    ];
    return () => subs.forEach(s => s.remove());
  }, [player, onTerminar]);

  // Esconde os controles alguns segundos depois do último toque, se estiver tocando.
  const agendarEsconder = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setControles(false);
      setMenuVelocidade(false);
    }, ESCONDER_APOS_MS);
  };
  useEffect(() => {
    if (isPlaying && controles && !menuVelocidade && arrastando == null) agendarEsconder();
    else clearTimeout(timer.current);
    return () => clearTimeout(timer.current);
  }, [isPlaying, controles, menuVelocidade, arrastando]);

  const mostrarControles = () => setControles(true);

  const alternarPlay = () => {
    if (terminou) {
      setTerminou(false);
      player.replay();
      return;
    }
    if (isPlaying) player.pause(); else player.play();
  };
  const pular = (seg) => {
    setTerminou(false);
    player.seekBy(seg);
    mostrarControles();
  };
  const irPara = (fracao) => {
    if (!(duracao > 0)) return;
    player.currentTime = Math.min(duracao - 0.1, Math.max(0, fracao * duracao));
    setAtual(player.currentTime);
    setTerminou(false);
  };
  const escolherVelocidade = (v) => {
    player.preservesPitch = true;
    player.playbackRate = v;
    setMenuVelocidade(false);
  };
  const telaCheia = () => {
    viewRef.current?.enterFullscreen?.().catch?.(() => {});
  };

  // Barra de progresso: toque ou arraste para escolher o ponto.
  const fracaoDe = (x) => Math.min(1, Math.max(0, x / (larguraBarra.current || 1)));
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => setArrastando(fracaoDe(e.nativeEvent.locationX)),
    onPanResponderMove: (e) => setArrastando(fracaoDe(e.nativeEvent.locationX)),
    onPanResponderRelease: (e) => {
      irParaRef.current(fracaoDe(e.nativeEvent.locationX));
      setArrastando(null);
    },
    onPanResponderTerminate: () => setArrastando(null),
  })).current;
  const irParaRef = useRef(irPara);
  irParaRef.current = irPara;

  const progresso = arrastando ?? (duracao > 0 ? atual / duracao : 0);
  let tamanho = { aspectRatio: proporcao };
  if (largura > 0) {
    let w = largura;
    let h = w / proporcao;
    if (maxAltura > 0 && h > maxAltura) { h = maxAltura; w = h * proporcao; }
    tamanho = { width: w, height: h, alignSelf: 'center' };
  }
  const carregando = status === 'loading' || status === 'idle';

  if (!url) {
    return (
      <View style={[st.caixa, { aspectRatio: 16 / 9 }, style]}>
        <Text style={st.erroTxt}>Vídeo indisponível no momento.</Text>
      </View>
    );
  }

  return (
    <View style={[st.caixa, tamanho, style]}>
      <VideoView
        ref={viewRef}
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={false}
        contentFit="contain"
        // Tela cheia na orientação do vídeo: deitado para horizontal, em pé para vertical.
        fullscreenOptions={{ enable: true, orientation: proporcao > 1.05 ? 'landscape' : 'portrait' }}
        allowsPictureInPicture
      />

      {/* Camada de toque: mostra/esconde os controles */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setControles(c => !c)} />

      {status === 'error' ? (
        <View style={st.centro} pointerEvents="none">
          <Ionicons name="alert-circle-outline" size={34} color="white" />
          <Text style={st.erroTxt}>Não foi possível carregar o vídeo.{'\n'}Verifique sua internet e tente de novo.</Text>
          {!!error?.message && <Text style={st.erroDet} numberOfLines={2}>{error.message}</Text>}
        </View>
      ) : carregando && !isPlaying ? (
        <View style={st.centro} pointerEvents="none">
          <ActivityIndicator size="large" color="white" />
        </View>
      ) : null}

      {(controles || !isPlaying) && status !== 'error' && (
        <View style={st.camada} pointerEvents="box-none">
          <View style={st.sombra} pointerEvents="none" />

          {/* Centro: voltar 10 s · tocar/pausar · avançar 10 s */}
          <View style={st.centroControles} pointerEvents="box-none">
            <TouchableOpacity style={st.btnPulo} onPress={() => pular(-10)} accessibilityLabel="Voltar 10 segundos">
              <Ionicons name="play-back" size={22} color="white" />
              <Text style={st.puloTxt}>10</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.btnPlay} onPress={() => { alternarPlay(); mostrarControles(); }} accessibilityLabel={isPlaying ? 'Pausar' : 'Tocar'}>
              <Ionicons name={terminou ? 'refresh' : isPlaying ? 'pause' : 'play'} size={34} color="white" style={!isPlaying && !terminou ? { marginLeft: 4 } : null} />
            </TouchableOpacity>
            <TouchableOpacity style={st.btnPulo} onPress={() => pular(10)} accessibilityLabel="Avançar 10 segundos">
              <Ionicons name="play-forward" size={22} color="white" />
              <Text style={st.puloTxt}>10</Text>
            </TouchableOpacity>
          </View>

          {/* Barra inferior */}
          <View style={st.barraInferior}>
            <View
              style={st.trilhoToque}
              onLayout={e => { larguraBarra.current = e.nativeEvent.layout.width; }}
              {...pan.panHandlers}
            >
              <View style={st.trilho}>
                <View style={[st.trilhoFeito, { width: `${progresso * 100}%` }]} />
              </View>
              <View style={[st.bolinha, { left: `${progresso * 100}%` }]} />
            </View>
            <View style={st.linhaBotoes}>
              <Text style={st.tempo}>
                {tempo(arrastando != null ? arrastando * duracao : atual)} / {tempo(duracao)}
              </Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={st.btnPequeno} onPress={() => { setMenuVelocidade(m => !m); mostrarControles(); }} accessibilityLabel="Velocidade">
                <Text style={st.velocidadeTxt}>{rotuloVelocidade(playbackRate || 1)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.btnPequeno} onPress={() => { player.muted = !muted; mostrarControles(); }} accessibilityLabel={muted ? 'Ativar som' : 'Silenciar'}>
                <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={st.btnPequeno} onPress={telaCheia} accessibilityLabel="Tela cheia">
                <Ionicons name="expand" size={19} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {menuVelocidade && (
            <View style={st.menu}>
              <Text style={st.menuTit}>Velocidade</Text>
              {VELOCIDADES.map(v => {
                const sel = Math.abs((playbackRate || 1) - v) < 0.01;
                return (
                  <TouchableOpacity key={v} style={[st.menuItem, sel && st.menuItemSel]} onPress={() => escolherVelocidade(v)}>
                    <Text style={[st.menuTxt, sel && st.menuTxtSel]}>{v === 1 ? 'Normal' : rotuloVelocidade(v)}</Text>
                    {sel && <Ionicons name="checkmark" size={14} color={colors.lav3} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const st = criarEstilos(() => ({
  caixa: {
    width: '100%', backgroundColor: '#17141f', borderRadius: radius.lg, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
  },
  centro: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  erroTxt: { fontFamily: fonts.body, fontSize: 13.5, color: 'white', textAlign: 'center', lineHeight: 20 },
  erroDet: { fontFamily: fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  camada: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sombra: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(23,20,31,0.35)' },
  centroControles: {
    ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28,
  },
  btnPlay: {
    width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(139,122,192,0.92)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  btnPulo: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(23,20,31,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  puloTxt: { fontFamily: fonts.bodyBold, fontSize: 9.5, color: 'white', marginTop: -2 },
  barraInferior: { paddingHorizontal: 12, paddingBottom: 6 },
  trilhoToque: { height: 26, justifyContent: 'center' },
  trilho: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  trilhoFeito: { height: '100%', backgroundColor: colors.lav3 },
  bolinha: {
    position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7,
    backgroundColor: 'white', borderWidth: 2, borderColor: colors.lav4,
  },
  linhaBotoes: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tempo: { fontFamily: fonts.bodyBold, fontSize: 12, color: 'white' },
  btnPequeno: { minWidth: 36, height: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  velocidadeTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
  menu: {
    position: 'absolute', right: 10, bottom: 70, backgroundColor: 'rgba(23,20,31,0.94)',
    borderRadius: radius.md, paddingVertical: 6, minWidth: 130,
  },
  menuTit: { fontFamily: fonts.bodyBold, fontSize: 11, color: 'rgba(255,255,255,0.6)', paddingHorizontal: 14, paddingVertical: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 },
  menuItemSel: { backgroundColor: 'rgba(184,171,217,0.16)' },
  menuTxt: { fontFamily: fonts.body, fontSize: 13.5, color: 'white' },
  menuTxtSel: { fontFamily: fonts.bodyBold, color: colors.lav3 },
}));
