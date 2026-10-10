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
import TextoComLinks from '../../components/TextoComLinks';
import { abrirLink } from '../../utils/abrirLink';

// Produtos Atravessia: canecas, cadernos e outros itens com a marca do app.
// Vídeo, texto e link de compra vêm de configuracoes/videos.produtos, editados
// no painel (aba Vídeos) — dá para trocar tudo sem publicar um novo app.
const TEXTO_PADRAO = 'Canecas, cadernos e outros carinhos com a marca da Atravessia, para ter por perto no dia a dia.';

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

  const largura = Math.min(width - spacing.lg * 2, 720);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Produtos Atravessia</Text>
        <View style={{ width: 36 }} />
      </View>

      {dados === undefined ? (
        <View style={s.carregando}><ActivityIndicator color={colors.lav4} /></View>
      ) : (
        <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          <View style={s.coluna}>
            <ScriptTitle size={26} style={{ textAlign: 'center' }}>{dados?.titulo || 'Leve a Atravessia com você'}</ScriptTitle>

            {dados?.url ? (
              <View style={s.video}>
                <PlayerVideo url={dados.url} titulo={dados.titulo} autoPlay={false} largura={largura} maxAltura={height * 0.62} />
              </View>
            ) : null}

            <View style={s.cartao}>
              <View style={s.icones}>
                {['cafe-outline', 'book-outline', 'gift-outline'].map(ic => (
                  <View key={ic} style={s.iconeCirculo}><Ionicons name={ic} size={18} color={colors.lav5} /></View>
                ))}
              </View>
              <TextoComLinks style={s.texto}>{dados?.descricao || TEXTO_PADRAO}</TextoComLinks>
            </View>

            {dados?.link ? (
              <TouchableOpacity style={s.botao} onPress={() => abrirLink(dados.link)} activeOpacity={0.85}>
                <Ionicons name="bag-handle-outline" size={18} color="white" />
                <Text style={s.botaoTxt}>{dados.textoBotao || 'Quero meus produtos'}</Text>
              </TouchableOpacity>
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  coluna: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.md },
  video: { alignItems: 'center' },
  cartao: {
    backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: spacing.md, ...shadow.card,
  },
  icones: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  iconeCirculo: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  texto: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.tm, textAlign: 'center' },
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.botaoForte, borderRadius: radius.full, paddingVertical: 15,
  },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: 'white' },
  emBreve: { fontFamily: fonts.body, fontSize: 13, color: colors.tl, textAlign: 'center' },
}));
