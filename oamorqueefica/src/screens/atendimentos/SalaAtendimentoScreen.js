import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Platform, PermissionsAndroid, Alert, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { chamar } from '../../utils/atendimentos';

// O WebView não existe na versão web do app: lá a sala abre em nova aba.
const WebView = Platform.OS === 'web' ? null : require('react-native-webview').WebView;

// Sala do atendimento online, embutida no app (WebView do provedor de vídeo).
// Parâmetros: { atendimentoId }. Usada pela usuária e pela profissional.
export default function SalaAtendimentoScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const atendimentoId = route?.params?.atendimentoId;
  const [sala, setSala] = useState(null);
  const [erro, setErro] = useState('');
  const [abertaNaWeb, setAbertaNaWeb] = useState(false);

  const pedirPermissoes = async () => {
    if (Platform.OS !== 'android') return true;
    const r = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    return Object.values(r).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
  };

  const abrir = useCallback(async () => {
    setErro('');
    try {
      const ok = await pedirPermissoes();
      if (!ok) {
        setErro('Para participar, permita o uso da câmera e do microfone nas configurações do aparelho (Apps › Atravessia › Permissões).');
        return;
      }
      const r = await chamar('entrarNaSala', { atendimentoId });
      if (Platform.OS === 'web') {
        window.open(r.url, '_blank', 'noopener');
        setAbertaNaWeb(true);
      }
      setSala(r);
    } catch (e) {
      setErro(e?.message || 'Não foi possível abrir a sala agora.');
    }
  }, [atendimentoId]);

  useEffect(() => { abrir(); }, [abrir]);

  const sair = () => {
    if (Platform.OS === 'web' || !sala) { navigation.goBack(); return; }
    Alert.alert('Sair da sala?', 'Você pode voltar enquanto o atendimento estiver acontecendo.', [
      { text: 'Continuar na sala', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <View style={[s.raiz, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={s.topo}>
        <TouchableOpacity onPress={sair} style={s.botaoSair} accessibilityRole="button" accessibilityLabel="Sair da sala">
          <Ionicons name="close" size={20} color="#FFFFFF" />
          <Text style={s.botaoSairTxt}>Sair</Text>
        </TouchableOpacity>
        <Text style={s.titulo} numberOfLines={1}>Atendimento online</Text>
        <View style={{ width: 76 }} />
      </View>
      {sala?.modoTeste && (
        <Text style={s.teste}>Modo de teste: sala pública do Jitsi. Use só para experimentar.</Text>
      )}

      {erro ? (
        <View style={s.centro}>
          <Ionicons name="videocam-off-outline" size={40} color={colors.lav3} />
          <Text style={s.msg}>{erro}</Text>
          <TouchableOpacity style={s.botao} onPress={abrir}><Text style={s.botaoTxt}>Tentar de novo</Text></TouchableOpacity>
        </View>
      ) : !sala ? (
        <View style={s.centro}><ActivityIndicator color="#FFFFFF" size="large" /><Text style={s.msg}>Preparando a sala…</Text></View>
      ) : abertaNaWeb || !WebView ? (
        <View style={s.centro}>
          <Ionicons name="open-outline" size={40} color={colors.lav3} />
          <Text style={s.msg}>A sala abriu em uma nova aba. Permita a câmera e o microfone quando o navegador pedir.</Text>
          <TouchableOpacity style={s.botao} onPress={() => window.open(sala.url, '_blank', 'noopener')}>
            <Text style={s.botaoTxt}>Abrir a sala de novo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          source={{ uri: sala.url }}
          style={s.web}
          originWhitelist={['https://*']}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          allowsFullscreenVideo
          allowsBackForwardNavigationGestures={false}
          setSupportMultipleWindows={false}
          startInLoadingState
          renderLoading={() => <View style={s.centroAbs}><ActivityIndicator color="#FFFFFF" size="large" /></View>}
          onError={() => setErro('A conexão com a sala falhou. Confira a internet e tente de novo.')}
        />
      )}
      <View style={{ height: insets.bottom, backgroundColor: '#1B1530' }} />
    </View>
  );
}

const s = criarEstilos(() => ({
  raiz: { flex: 1, backgroundColor: '#1B1530' },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 8 },
  botaoSair: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  botaoSairTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#FFFFFF' },
  titulo: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' },
  teste: { fontFamily: fonts.body, fontSize: 12.5, color: '#F7EBD3', textAlign: 'center', paddingHorizontal: spacing.md, paddingBottom: 6 },
  web: { flex: 1, backgroundColor: '#1B1530' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: spacing.lg },
  centroAbs: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B1530' },
  msg: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: '#EDE7FA', textAlign: 'center', maxWidth: 340 },
  botao: { minHeight: 46, paddingHorizontal: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lav4 },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' },
}));
