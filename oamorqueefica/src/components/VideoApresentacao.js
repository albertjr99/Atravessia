import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, useWindowDimensions, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/AuthContext';
import { colors, fonts, spacing, radius, criarEstilos } from '../theme';
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
      <View style={st.botaoIcone}>
        <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Ionicons name="play" size={13} color="white" style={{ marginLeft: 2 }} />
      </View>
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
          <LinearGradient colors={['#7A65CB', '#5A46AD']} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Text style={st.continuarTxt}>Continuar para a tela</Text>
          <Ionicons name="arrow-forward" size={16} color="white" />
        </TouchableOpacity>
        <Text style={st.nota}>Você pode rever este vídeo quando quiser, pelo botão “Assistir à apresentação”.</Text>
      </View>
    </Modal>
  );
}

const st = criarEstilos(() => ({
  fundo: { flex: 1, backgroundColor: 'rgba(17,14,24,0.96)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: spacing.md },
  rotulo: { fontFamily: fonts.bodyBold, fontSize: 11, color: '#CFC2FF', letterSpacing: 1, textTransform: 'uppercase' },
  titulo: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 32, color: 'white', marginTop: 2 },
  fechar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  continuar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg, overflow: 'hidden',
    backgroundColor: '#7A65CB', borderRadius: radius.full, minHeight: 50, paddingHorizontal: 26,
    borderBottomWidth: 3, borderBottomColor: '#45358A',
  },
  continuarTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: 'white' },
  nota: { fontFamily: fonts.body, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: spacing.sm, maxWidth: 360 },
  // Botão "Assistir à apresentação": pílula de vidro com o play em degradê lilás
  botao: {
    flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz, borderRadius: radius.full,
    paddingVertical: 6, paddingLeft: 6, paddingRight: 16, minHeight: 44,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: colors.escuro ? 0.25 : 0.08, shadowRadius: 10, elevation: 2,
  },
  botaoIcone: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', backgroundColor: colors.botao, alignItems: 'center', justifyContent: 'center' },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.lilasTexto },
}));
