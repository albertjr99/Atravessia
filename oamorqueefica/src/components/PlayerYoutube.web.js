import React, { useEffect, useRef } from 'react';

// Versão web do player (o react-native-youtube-iframe não funciona no
// navegador): usa a API oficial de iframe do YouTube, com as mesmas props
// usadas na AulaScreen (videoId, width, height, onReady, onChangeState).
let carregandoApi = null;
function apiYoutube() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (!carregandoApi) {
    carregandoApi = new Promise((resolve) => {
      const anterior = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { anterior?.(); resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
  }
  return carregandoApi;
}

const ESTADOS = { '-1': 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'video cued' };

export default function PlayerYoutube({ videoId, width, height, onReady, onChangeState, initialPlayerParams = {} }) {
  const caixa = useRef(null);
  const player = useRef(null);
  const cb = useRef({ onReady, onChangeState });
  cb.current = { onReady, onChangeState };

  useEffect(() => {
    let ativo = true;
    apiYoutube().then((YT) => {
      if (!ativo || !caixa.current) return;
      const alvo = document.createElement('div');
      caixa.current.innerHTML = '';
      caixa.current.appendChild(alvo);
      player.current = new YT.Player(alvo, {
        videoId, width: '100%', height: '100%', host: 'https://www.youtube-nocookie.com',
        playerVars: {
          modestbranding: 1, rel: 0, controls: 1, iv_load_policy: 3, playsinline: 1,
          cc_lang_pref: initialPlayerParams.cc_lang_pref || 'pt', hl: initialPlayerParams.playerLang || 'pt',
        },
        events: {
          onReady: () => cb.current.onReady?.(),
          onStateChange: (e) => cb.current.onChangeState?.(ESTADOS[e.data] || String(e.data)),
        },
      });
    });
    return () => { ativo = false; try { player.current?.destroy(); } catch {} player.current = null; };
  }, [videoId]);

  return <div ref={caixa} style={{ width, height, background: '#000', borderRadius: 0, overflow: 'hidden' }} />;
}
