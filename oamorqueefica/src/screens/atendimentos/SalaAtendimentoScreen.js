import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Platform, PermissionsAndroid, Alert, StatusBar,
  BackHandler, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { chamar } from '../../utils/atendimentos';

// O WebView não existe na versão web do app: lá a sala abre em nova aba.
const WebView = Platform.OS === 'web' ? null : require('react-native-webview').WebView;

// Tela ligada durante a sessão. expo-keep-awake já vem com o pacote `expo`
// (dependência dele); se faltar, a sala funciona igual, só sem essa trava.
let keepAwake = null;
try { keepAwake = require('expo-keep-awake'); } catch { keepAwake = null; }
const TAG_TELA = 'sala-atendimento';

const CHAVE_EXPLICOU = 'atendimento:explicouPermissoes';

// Só o domínio do provedor abre dentro da sala (sem barra de endereço e sem
// links para fora). `dominios` vem do servidor (entrarNaSala).
function permitido(url, dominios) {
  if (!url || url === 'about:blank' || url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return true;
  const m = /^https:\/\/([^/?#:]+)/i.exec(url);
  if (!m) return false;
  const host = m[1].toLowerCase();
  return (dominios || []).some(d => host === d || host.endsWith(`.${d}`));
}

// Sala do atendimento online, embutida no app (WebView do provedor de vídeo).
// Parâmetros: { atendimentoId }. Usada pela paciente e pela profissional.
// Etapas: explicar (permissões, só na 1ª vez) → esperando (se cedo, conta e
// entra sozinha) → sala → encerrada.
export default function SalaAtendimentoScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const atendimentoId = route?.params?.atendimentoId;
  const [etapa, setEtapa] = useState('carregando'); // carregando | explicar | negada | esperando | sala | web | erro | encerrada
  const [sala, setSala] = useState(null);
  const [erro, setErro] = useState('');
  const [liberaEm, setLiberaEm] = useState(0);
  const [agora, setAgora] = useState(Date.now());
  const offsetRef = useRef(0);

  // ---- Permissões (explicação antes do pedido do sistema) -------------------
  const temPermissoes = async () => {
    if (Platform.OS === 'android') {
      const [cam, mic] = await Promise.all([
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO),
      ]);
      return cam && mic;
    }
    if (Platform.OS === 'ios') return (await AsyncStorage.getItem(CHAVE_EXPLICOU).catch(() => null)) === '1';
    return true; // web: o navegador pergunta na nova aba
  };

  const pedirPermissoes = async () => {
    await AsyncStorage.setItem(CHAVE_EXPLICOU, '1').catch(() => {});
    if (Platform.OS !== 'android') return true; // iOS: o sistema pergunta quando a sala abre
    const r = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    return Object.values(r).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
  };

  // ---- Entrar (pede o link individual ao servidor) --------------------------
  const entrar = useCallback(async () => {
    setErro('');
    setEtapa('carregando');
    try {
      const r = await chamar('entrarNaSala', { atendimentoId });
      setSala(r);
      if (Platform.OS === 'web' || !WebView) {
        window.open(r.url, '_blank', 'noopener');
        setEtapa('web');
      } else {
        setEtapa('sala');
      }
    } catch (e) {
      const d = e?.details;
      if (d?.motivo === 'cedo' && d.liberaEm) {
        offsetRef.current = (d.agora || Date.now()) - Date.now();
        setLiberaEm(d.liberaEm);
        setEtapa('esperando');
        return;
      }
      setErro(e?.message || 'Não foi possível abrir a sala agora.');
      setEtapa('erro');
    }
  }, [atendimentoId]);

  const iniciar = useCallback(async () => {
    if (await temPermissoes()) entrar();
    else setEtapa('explicar');
  }, [entrar]);

  useEffect(() => { iniciar(); }, [iniciar]);

  const permitirEEntrar = async () => {
    const ok = await pedirPermissoes();
    if (!ok) { setEtapa('negada'); return; }
    entrar();
  };

  // Contagem até a sala abrir; entra sozinha na hora.
  useEffect(() => {
    if (etapa !== 'esperando') return undefined;
    const t = setInterval(() => {
      const n = Date.now() + offsetRef.current;
      setAgora(n);
      if (n >= liberaEm + 1000) { clearInterval(t); entrar(); }
    }, 1000);
    return () => clearInterval(t);
  }, [etapa, liberaEm, entrar]);

  // Tela ligada enquanto a sala está aberta.
  useEffect(() => {
    if (etapa !== 'sala' || !keepAwake) return undefined;
    keepAwake.activateKeepAwakeAsync?.(TAG_TELA).catch?.(() => {});
    return () => { try { keepAwake.deactivateKeepAwake?.(TAG_TELA); } catch {} };
  }, [etapa]);

  // ---- Sair ----------------------------------------------------------------
  const sair = useCallback(() => {
    if (etapa !== 'sala') { navigation.goBack(); return true; }
    Alert.alert('Sair da sessão?', 'Você pode voltar enquanto o atendimento estiver acontecendo.', [
      { text: 'Continuar na sessão', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
    return true;
  }, [etapa, navigation]);

  // Botão "voltar" do Android também pergunta antes de sair.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', sair);
    return () => sub.remove();
  }, [sair]);

  // Bloqueia qualquer navegação para fora do provedor. O endereço de saída
  // (redirect_on_meeting_exit) fecha a sala e mostra "Sessão encerrada".
  const filtrarNavegacao = useCallback((req) => {
    const url = req?.url || '';
    if (sala?.urlSaida && url.startsWith(sala.urlSaida.split('?')[0]) && url.includes('saiu=1')) {
      setEtapa('encerrada');
      return false;
    }
    return permitido(url, sala?.dominios);
  }, [sala]);

  const minutos = Math.max(0, Math.ceil((liberaEm - agora) / 60000));

  let corpo;
  if (etapa === 'carregando') {
    corpo = <View style={s.centro}><ActivityIndicator color="#FFFFFF" size="large" /><Text style={s.msg}>Preparando a sala…</Text></View>;
  } else if (etapa === 'explicar' || etapa === 'negada') {
    corpo = (
      <View style={s.centro}>
        <Ionicons name="videocam-outline" size={44} color={colors.lav3} />
        <Text style={s.tit}>Câmera e microfone</Text>
        <Text style={s.msg}>
          Para a sessão por vídeo, o Atravessia precisa usar a câmera e o microfone apenas enquanto você estiver na sala.
          Nada é gravado. Na próxima tela, toque em “Permitir”.
        </Text>
        {etapa === 'negada' && (
          <Text style={s.alerta}>
            O acesso foi negado. Abra as configurações do aparelho (Apps › Atravessia › Permissões) e permita câmera e microfone.
          </Text>
        )}
        <TouchableOpacity style={s.botao} onPress={permitirEEntrar} accessibilityRole="button">
          <Text style={s.botaoTxt}>Permitir e entrar</Text>
        </TouchableOpacity>
        {etapa === 'negada' && (
          <TouchableOpacity style={s.botaoSec} onPress={() => Linking.openSettings().catch(() => {})} accessibilityRole="button">
            <Text style={s.botaoSecTxt}>Abrir configurações do aparelho</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  } else if (etapa === 'esperando') {
    corpo = (
      <View style={s.centro}>
        <Ionicons name="time-outline" size={44} color={colors.lav3} />
        <Text style={s.tit}>{minutos <= 1 ? 'A sala abre em instantes' : `A sala abre em ${minutos} min`}</Text>
        <Text style={s.msg}>Pode deixar esta tela aberta: você entra sozinha(o) quando a sala abrir. Enquanto isso, procure um lugar reservado e, se puder, use fones de ouvido.</Text>
      </View>
    );
  } else if (etapa === 'erro') {
    corpo = (
      <View style={s.centro}>
        <Ionicons name="videocam-off-outline" size={40} color={colors.lav3} />
        <Text style={s.msg}>{erro}</Text>
        <TouchableOpacity style={s.botao} onPress={iniciar}><Text style={s.botaoTxt}>Tentar de novo</Text></TouchableOpacity>
      </View>
    );
  } else if (etapa === 'encerrada') {
    corpo = (
      <View style={s.centro}>
        <Ionicons name="heart-outline" size={44} color={colors.lav3} />
        <Text style={s.tit}>Sessão encerrada</Text>
        <Text style={s.msg}>Obrigada por estar aqui. Cuide-se com carinho até o próximo encontro.</Text>
        <TouchableOpacity style={s.botao} onPress={() => navigation.goBack()}><Text style={s.botaoTxt}>Voltar ao app</Text></TouchableOpacity>
      </View>
    );
  } else if (etapa === 'web') {
    corpo = (
      <View style={s.centro}>
        <Ionicons name="open-outline" size={40} color={colors.lav3} />
        <Text style={s.msg}>A sala abriu em uma nova aba. Permita a câmera e o microfone quando o navegador pedir.</Text>
        <TouchableOpacity style={s.botao} onPress={() => window.open(sala.url, '_blank', 'noopener')}>
          <Text style={s.botaoTxt}>Abrir a sala de novo</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    corpo = (
      <WebView
        source={{ uri: sala.url }}
        style={s.web}
        originWhitelist={['https://*']}
        onShouldStartLoadWithRequest={filtrarNavegacao}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        allowsFullscreenVideo
        allowsBackForwardNavigationGestures={false}
        allowsLinkPreview={false}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        allowFileAccess={false}
        geolocationEnabled={false}
        startInLoadingState
        renderLoading={() => <View style={s.centroAbs}><ActivityIndicator color="#FFFFFF" size="large" /></View>}
        onError={() => { setErro('A conexão com a sala falhou. Confira a internet e tente de novo.'); setEtapa('erro'); }}
      />
    );
  }

  return (
    <View style={[s.raiz, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={s.topo}>
        <TouchableOpacity onPress={sair} style={s.botaoSair} accessibilityRole="button" accessibilityLabel="Sair da sessão">
          <Ionicons name="exit-outline" size={18} color="#FFFFFF" />
          <Text style={s.botaoSairTxt}>Sair da sessão</Text>
        </TouchableOpacity>
        <Text style={s.titulo} numberOfLines={1}>Atendimento online</Text>
      </View>
      {sala?.modoTeste && (
        <Text style={s.teste}>Modo de teste (Jitsi público): sem as travas de segurança. Use só para experimentar.</Text>
      )}
      {corpo}
      <View style={{ height: insets.bottom, backgroundColor: '#1B1530' }} />
    </View>
  );
}

const s = criarEstilos(() => ({
  raiz: { flex: 1, backgroundColor: '#1B1530' },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 8 },
  botaoSair: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: '#B4415A',
  },
  botaoSairTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#FFFFFF' },
  titulo: { flex: 1, textAlign: 'right', fontFamily: fonts.bodyBold, fontSize: 14, color: '#EDE7FA' },
  teste: { fontFamily: fonts.body, fontSize: 12.5, color: '#F7EBD3', textAlign: 'center', paddingHorizontal: spacing.md, paddingBottom: 6 },
  web: { flex: 1, backgroundColor: '#1B1530' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: spacing.lg },
  centroAbs: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B1530' },
  tit: { fontFamily: fonts.bodyBold, fontSize: 20, color: '#FFFFFF', textAlign: 'center' },
  msg: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: '#EDE7FA', textAlign: 'center', maxWidth: 340 },
  alerta: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: '#F7C9D3', textAlign: 'center', maxWidth: 340 },
  botao: { minHeight: 48, paddingHorizontal: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lav4 },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' },
  botaoSec: { minHeight: 44, paddingHorizontal: 20, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  botaoSecTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#FFFFFF' },
}));
