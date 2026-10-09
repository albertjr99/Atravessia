import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, useWindowDimensions, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/AuthContext';
import { colors, fonts, spacing, radius } from '../theme';
import PlayerVideo from './PlayerVideo';

// Vídeos de apresentação gravados pela administradora (um para "Continue a
// travessia" e outro para "Experimente a vida"). Ficam em
// configuracoes/videos → { jornadas: { url, titulo }, parcerias: { url, titulo } },
// enviados pelo painel. Na primeira visita à tela o vídeo abre sozinho; depois
// fica disponível pelo botão "Assistir à apresentação".
export const VIDEOS = {
  jornadas: { titulo: 'Conheça o Continue a travessia' },
  parcerias: { titulo: 'Conheça o Experimente a vida' },
};

const chaveLocal = (uid, chave) => `@atravessia/videoVisto/${uid || 'local'}/${chave}`;

export function useVideoApresentacao(chave) {
  const { firebaseUser, perfil, atualizarPerfil } = useAuth();
  const uid = firebaseUser?.uid;
  const [video, setVideo] = useState(null);
  const [vistoLocal, setVistoLocal] = useState(null); // null = ainda lendo

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'videos'), (snap) => {
    const v = snap.exists() ? snap.data()?.[chave] : null;
    setVideo(v?.url && v.ativo !== false ? v : null);
  }, (e) => console.warn('[Vídeo] não foi possível ler a configuração:', e?.message)), [chave]);

  useEffect(() => {
    let vivo = true;
    AsyncStorage.getItem(chaveLocal(uid, chave))
      .then(v => { if (vivo) setVistoLocal(v === '1'); })
      .catch(() => { if (vivo) setVistoLocal(false); });
    return () => { vivo = false; };
  }, [uid, chave]);

  const vistoNoPerfil = perfil?.videosVistos?.[chave] === true || perfil?.[`videosVistos.${chave}`] === true;
  const visto = vistoNoPerfil || vistoLocal === true;

  const marcarVisto = useCallback(() => {
    setVistoLocal(true);
    AsyncStorage.setItem(chaveLocal(uid, chave), '1').catch(() => {});
    // No perfil, para não abrir de novo em outro aparelho.
    if (!vistoNoPerfil) {
      atualizarPerfil?.({ [`videosVistos.${chave}`]: true })
        .catch(e => console.warn('[Vídeo] não foi possível salvar no perfil:', e?.message));
    }
  }, [uid, chave, vistoNoPerfil, atualizarPerfil]);

  return {
    video,
    // Abre sozinho só quando há vídeo, a leitura local terminou e ainda não foi visto.
    abrirAutomatico: !!video && vistoLocal !== null && !visto,
    marcarVisto,
  };
}

// Botão discreto para (re)ver a apresentação.
export function BotaoApresentacao({ onPress, style }) {
  return (
    <TouchableOpacity style={[st.botao, style]} onPress={onPress} activeOpacity={0.85}>
      <View style={st.botaoIcone}><Ionicons name="play" size={13} color="white" style={{ marginLeft: 2 }} /></View>
      <Text style={st.botaoTxt}>Assistir à apresentação</Text>
    </TouchableOpacity>
  );
}

export function ModalVideoApresentacao({ visivel, onFechar, video, tituloPadrao }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const largura = Math.min(width - spacing.lg * 2, 900);
  const maxAltura = height - insets.top - insets.bottom - 190;

  return (
    <Modal visible={visivel} animationType="fade" transparent statusBarTranslucent onRequestClose={onFechar} supportedOrientations={['portrait', 'landscape']}>
      <StatusBar barStyle="light-content" />
      <View style={[st.fundo, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
        <View style={[st.topo, { width: largura }]}>
          <View style={{ flex: 1 }}>
            <Text style={st.rotulo}>Apresentação</Text>
            <Text style={st.titulo} numberOfLines={2}>{video?.titulo || tituloPadrao}</Text>
          </View>
          <TouchableOpacity style={st.fechar} onPress={onFechar} accessibilityLabel="Fechar vídeo" hitSlop={10}>
            <Ionicons name="close" size={22} color="white" />
          </TouchableOpacity>
        </View>

        {visivel && (
          <PlayerVideo url={video?.url} titulo={video?.titulo || tituloPadrao} largura={largura} maxAltura={maxAltura} />
        )}

        <TouchableOpacity style={st.continuar} onPress={onFechar} activeOpacity={0.85}>
          <Text style={st.continuarTxt}>Continuar para a tela</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={st.nota}>Você pode rever este vídeo quando quiser, pelo botão “Assistir à apresentação”.</Text>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(23,20,31,0.96)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: spacing.md },
  rotulo: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lav3, letterSpacing: 0.8, textTransform: 'uppercase' },
  titulo: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 28, color: 'white', marginTop: 2 },
  fechar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  continuar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg,
    backgroundColor: colors.lav1, borderRadius: radius.full, paddingVertical: 12, paddingHorizontal: 22,
  },
  continuarTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lav6 },
  nota: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: spacing.sm, maxWidth: 360 },
  botao: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: colors.lav1, borderWidth: 1, borderColor: colors.lav2, borderRadius: radius.full,
    paddingVertical: 7, paddingLeft: 7, paddingRight: 14,
  },
  botaoIcone: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.lav4, alignItems: 'center', justifyContent: 'center' },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav6 },
});
