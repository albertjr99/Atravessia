import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow, criarEstilos } from '../../theme';
import { LavandaBg, ScriptTitle } from '../../components';
import PlayerVideo from '../../components/PlayerVideo';
import { LinearGradient } from 'expo-linear-gradient';
import { Profundo } from '../../components/Efeitos';
import TextoComLinks from '../../components/TextoComLinks';
import { abrirLink } from '../../utils/abrirLink';

// Produtos Atravessia: canecas, cadernos e outros itens com a marca do app.
// Vídeo, texto e link de compra vêm de configuracoes/videos.produtos, editados
// no painel (aba Vídeos) — dá para trocar tudo sem publicar um novo app.
const TEXTO_PADRAO = 'Canecas, cadernos e outros carinhos com a marca da Atravessia, para ter por perto no dia a dia.';

// Botão principal: degradê lilás com "degrau" que afunda ao toque.
function BotaoLilas({ onPress, children, rotulo, externo, desativado }) {
  return (
    <Profundo
      externo={[externo, desativado && { opacity: 0.6 }]}
      estilo={s.btnFace}
      base={colors.botaoBase}
      sombra={s.btnHalo}
      onPress={desativado ? undefined : onPress}
      accessibilityLabel={rotulo}
    >
      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.btnGrad} />
      {children}
    </Profundo>
  );
}

export default function ProdutosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [dados, setDados] = useState(undefined); // undefined = carregando

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'videos'), (snap) => {
    const p = snap.exists() ? snap.data()?.produtos : null;
    setDados(p && p.ativo !== false ? p : null);
  }, (e) => {
    console.warn('[Produtos] não foi possível carregar:', e?.message);
    setDados(null);
  }), []);

  const largura = width - spacing.lg * 2;

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Produtos Atravessia</Text>
        <View style={{ width: 44 }} />
      </View>

      {dados === undefined ? (
        <View style={s.carregando}><ActivityIndicator color={colors.lav4} /></View>
      ) : (
        <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          <View style={s.coluna}>
            <ScriptTitle size={30} style={s.titulo}>{dados?.titulo || 'Leve a Atravessia com você'}</ScriptTitle>

            {dados?.url ? (
              <View style={s.video}>
                <PlayerVideo url={dados.url} titulo={dados.titulo} autoPlay={false} largura={largura} maxAltura={height * 0.62} />
              </View>
            ) : null}

            {/* Cartão-joia dourado (degradê com "degrau" embaixo) */}
            <View style={s.cartao}>
              <LinearGradient colors={[colors.joiaDourado[0], colors.joiaDourado[1]]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.cartaoGrad} />
              <View style={s.icones}>
                {['cafe-outline', 'book-outline', 'gift-outline'].map(ic => (
                  <View key={ic} style={s.iconeCirculo}><Ionicons name={ic} size={20} color={colors.joiaDouradoTexto} /></View>
                ))}
              </View>
              <TextoComLinks style={s.texto}>{dados?.descricao || TEXTO_PADRAO}</TextoComLinks>
            </View>

            {dados?.link ? (
              <BotaoLilas onPress={() => abrirLink(dados.link)} rotulo={dados.textoBotao || 'Quero meus produtos'}>
                <Ionicons name="bag-handle-outline" size={19} color="white" />
                <Text style={s.btnTxt}>{dados.textoBotao || 'Quero meus produtos'}</Text>
              </BotaoLilas>
            ) : (
              <Text style={s.emBreve}>Em breve você poderá adquirir os produtos por aqui.</Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 1,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 28, color: colors.titulo },
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 22, overflow: 'hidden' },
  btnGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 5 },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: 'white' },
  btnVidro: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingHorizontal: 20,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro,
  },
  btnVidroTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  coluna: { width: '100%', gap: spacing.lg },
  titulo: { textAlign: 'center', color: colors.titulo, lineHeight: 38, marginTop: spacing.sm },
  video: { alignItems: 'center', borderRadius: 24, overflow: 'hidden' },
  cartao: {
    borderRadius: 26, padding: spacing.xl, gap: spacing.md, overflow: 'hidden',
    backgroundColor: colors.joiaDourado[1],
    borderBottomWidth: 5, borderBottomColor: colors.joiaDourado[2],
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 12 }, shadowOpacity: colors.escuro ? 0.4 : 0.14, shadowRadius: 22, elevation: 3,
  },
  cartaoGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.5)' },
  icones: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  iconeCirculo: {
    width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.escuro ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
  },
  texto: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25, color: colors.joiaDouradoTexto, textAlign: 'center' },
  emBreve: { fontFamily: fonts.body, fontSize: 13.5, color: colors.texto2, textAlign: 'center' },
}));
