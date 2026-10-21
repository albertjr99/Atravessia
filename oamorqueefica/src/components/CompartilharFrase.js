import React, { useRef, useState } from 'react';
import { View, Text, Image, Modal, Pressable, TouchableOpacity, ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { colors, criarEstilos } from '../theme';

const logo = require('../../assets/images/travessia_logo.png');
const lavanda = require('../../assets/images/lavanda_pendente.png');

export const LINK_PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.atravessia';

// Prévia da Frase do dia em forma de cartão timbrado (logo, aurora, QR code da
// Google Play) e envio como imagem — o WhatsApp leva junto a mensagem com o link.
export default function CompartilharFrase({ visivel, frase, onFechar }) {
  const cartaoRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  if (!frase) return null;

  const mensagem = `"${frase.texto}"${frase.autor ? ` — ${frase.autor}` : ''}\n\n`
    + 'Recebi essa frase no app Atravessia e lembrei de você. Faça parte também desta Comunidade. '
    + LINK_PLAY_STORE;

  const compartilhar = async () => {
    setEnviando(true);
    try {
      const uri = await cartaoRef.current.capture();
      const url = uri.startsWith('file://') || uri.startsWith('data:') ? uri : `file://${uri}`;
      if (Platform.OS === 'web') {
        await navigator.share?.({ text: mensagem });
      } else {
        // Carregado só no aparelho: o módulo nativo não existe na versão web.
        const Share = require('react-native-share').default;
        await Share.open({ url, type: 'image/png', message: mensagem, title: 'Frase do dia', failOnCancel: false });
      }
      onFechar?.();
    } catch (e) {
      if (!String(e?.message || '').toLowerCase().includes('cancel')) {
        Alert.alert('Não foi possível compartilhar', 'Tente novamente em instantes.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={s.fundo} onPress={onFechar}>
        <Pressable onPress={() => {}} style={s.caixa}>
          <ViewShot ref={cartaoRef} options={{ format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' }}>
            <View style={s.cartao} collapsable={false}>
              <LinearGradient colors={['#EEE7FC', '#FCE7DC', '#E1EEE5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Image source={lavanda} style={s.lavanda} resizeMode="contain" />
              <View style={s.marca}>
                <Image source={logo} style={s.logo} />
                <Text style={s.marcaNome}>Atravessia</Text>
              </View>
              <Text style={s.sobretitulo}>Frase do dia</Text>
              <Text style={s.frase}>“{frase.texto}”</Text>
              {!!frase.autor && <Text style={s.autor}>— {frase.autor}</Text>}
              <View style={s.rodape}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rodapeTit}>Conheça o Atravessia</Text>
                </View>
                <View style={s.qr}>
                  <QRCode value={LINK_PLAY_STORE} size={58} color="#2A2433" backgroundColor="#FFFFFF" />
                </View>
              </View>
            </View>
          </ViewShot>
          <TouchableOpacity style={s.botao} onPress={compartilhar} disabled={enviando} activeOpacity={0.85} accessibilityLabel="Compartilhar imagem">
            <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} />
            {enviando ? <ActivityIndicator color="white" /> : (
              <>
                <Ionicons name="logo-whatsapp" size={19} color="white" />
                <Text style={s.botaoTxt}>Compartilhar imagem</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onFechar} style={s.fechar}>
            <Text style={s.fecharTxt}>Agora não</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// O cartão tem cores fixas (é uma imagem que vai para fora do app, igual no claro e no noturno).
const s = criarEstilos(() => ({
  fundo: { flex: 1, backgroundColor: colors.sobreposicao, alignItems: 'center', justifyContent: 'center', padding: 20 },
  caixa: { width: '100%', maxWidth: 380, alignItems: 'stretch' },
  cartao: { borderRadius: 28, overflow: 'hidden', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 18, backgroundColor: '#F6F1EE' },
  lavanda: { position: 'absolute', top: 0, right: 0, width: 170, height: 142, opacity: 0.6, transform: [{ scaleX: -1 }] },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 12 },
  marcaNome: { fontFamily: 'Marca', fontSize: 30, color: '#45358A' },
  sobretitulo: { fontFamily: 'Figtree_700Bold', fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#524197', marginTop: 26 },
  frase: { fontFamily: 'MarcaLeve', fontSize: 27, lineHeight: 35, color: '#2A2433', marginTop: 10 },
  autor: { fontFamily: 'Figtree_500Medium', fontSize: 14, color: '#534C60', marginTop: 10 },
  rodape: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 26, padding: 12, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
  },
  rodapeTit: { fontFamily: 'Figtree_800ExtraBold', fontSize: 15, color: '#45358A' },
  rodapeSub: { fontFamily: 'Figtree_400Regular', fontSize: 12, color: '#534C60', marginTop: 2, lineHeight: 16 },
  qr: { padding: 5, borderRadius: 10, backgroundColor: '#FFFFFF' },
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16,
    paddingVertical: 15, borderRadius: 999, overflow: 'hidden',
  },
  botaoTxt: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: 'white' },
  fechar: { alignItems: 'center', paddingVertical: 12 },
  fecharTxt: { fontFamily: 'Figtree_700Bold', fontSize: 15, color: '#FFFFFF' },
}));
