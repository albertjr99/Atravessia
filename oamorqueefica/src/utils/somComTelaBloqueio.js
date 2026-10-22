import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const LOGO_URL = 'https://o-amor-que-fica.web.app/travessia_logo.png';

// Player de áudio com controles na tela de bloqueio e na barra de notificações
// (play/pausa, avançar e voltar), no celular e no tablet. Expõe os mesmos
// métodos que a tela do player já usava com o expo-av, e o status chega no
// mesmo formato (milissegundos), então o resto da tela não muda.
export async function criarSomComTelaBloqueio({ uri, titulo, rate = 1, onStatus }) {
  await setAudioModeAsync({
    playsInSilentMode: true,
    // Continua tocando com a tela bloqueada ou com o app em segundo plano.
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
    shouldRouteThroughEarpiece: false,
  }).catch(() => {});

  const player = createAudioPlayer({ uri }, { updateInterval: 500 });
  player.shouldCorrectPitch = true;
  if (rate !== 1) player.setPlaybackRate(rate);

  const sub = player.addListener('playbackStatusUpdate', (s) => {
    onStatus?.({
      isLoaded: s.isLoaded,
      positionMillis: Math.round((s.currentTime || 0) * 1000),
      durationMillis: Math.round((s.duration || 0) * 1000),
      isPlaying: !!s.playing,
      didJustFinish: !!s.didJustFinish,
    });
  });

  try {
    player.setActiveForLockScreen(
      true,
      { title: titulo || 'Atravessia', artist: 'Atravessia', artworkUrl: LOGO_URL },
      { showSeekForward: true, showSeekBackward: true },
    );
  } catch (e) {
    console.warn('[Audio] controles da tela de bloqueio indisponíveis:', e?.message);
  }

  return {
    playAsync: async () => player.play(),
    pauseAsync: async () => player.pause(),
    setPositionAsync: async (ms) => player.seekTo(ms / 1000),
    setRateAsync: async (r) => player.setPlaybackRate(r),
    unloadAsync: async () => {
      sub?.remove();
      try { player.clearLockScreenControls(); } catch {}
      player.remove();
    },
  };
}
