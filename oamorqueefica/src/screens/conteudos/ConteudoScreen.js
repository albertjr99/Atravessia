import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Alert, Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { abrirLink } from '../../utils/abrirLink';
import TextoComLinks from '../../components/TextoComLinks';

// Tela de leitura dos "Outros conteúdos" (imagem, texto e link com descrição).
// Recebe o item por params (vindo do check-in, da aba Conteúdos ou dos
// Favoritos). A cópia guardada no favorito não inclui o `texto`, então os
// dados atuais são sempre buscados em `conteudos` pelo id.
const limparId = (v) => String(v || '').replace(/^(audio|admin)-/, '');
const hostDe = (url) => String(url).replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0];

export default function ConteudoScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const recebido = route.params?.conteudo || {};
  const { conteudos, isFavorito, adicionarFavorito, removerFavorito, temAcesso } = useApp();

  const id = limparId(recebido.conteudoId || recebido.id);
  const atual = useMemo(
    () => (conteudos || []).find(c => c.id === id),
    [conteudos, id]
  );
  // Dados atuais da biblioteca têm prioridade sobre os recebidos (que podem ser
  // a cópia antiga de um favorito).
  const item = useMemo(() => ({ ...recebido, ...(atual || {}), id }), [recebido, atual, id]);

  const plano = typeof item.plano === 'number' ? item.plano : 0;
  const bloqueado = !temAcesso(plano);
  const favoritado = !bloqueado && isFavorito(id);

  const [ratio, setRatio] = useState(null);
  const [erroImagem, setErroImagem] = useState(false);

  useEffect(() => {
    if (item.tipo !== 'imagem' || !item.url) return;
    let vivo = true;
    setErroImagem(false);
    Image.getSize(
      item.url,
      (w, h) => { if (vivo && w > 0 && h > 0) setRatio(w / h); },
      () => { if (vivo) setRatio(1); },
    );
    return () => { vivo = false; };
  }, [item.tipo, item.url]);

  const avisarPlano = () => {
    Alert.alert(
      'Conteúdo Premium',
      'Este conteúdo faz parte de um plano superior. Deseja conhecer os planos?',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Ver planos', onPress: () => navigation.navigate('Planos') },
      ]
    );
  };

  const toggleFavorito = () => {
    if (!id) return;
    if (bloqueado) { avisarPlano(); return; }
    favoritado ? removerFavorito(id) : adicionarFavorito(item);
  };

  const renderCorpo = () => {
    if (bloqueado) {
      return (
        <View style={s.lockCard}>
          <View style={s.pilulaGrande}>
            <Ionicons name="lock-closed-outline" size={30} color={colors.lilasIcone} />
          </View>
          <Text style={s.lockTit}>Conteúdo de um plano superior</Text>
          <Text style={s.lockSub}>Este conteúdo faz parte de outro plano. Conheça os planos para acessá-lo.</Text>
          <TouchableOpacity style={s.lockBtn} onPress={() => navigation.navigate('Planos')} activeOpacity={0.85}>
            <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Text style={s.lockBtnTxt}>Ver planos</Text>
            <Ionicons name="arrow-forward" size={14} color="white" />
          </TouchableOpacity>
        </View>
      );
    }

    if (item.tipo === 'imagem') {
      if (!item.url || erroImagem) {
        return <Text style={s.indisponivel}>Não foi possível carregar esta imagem agora. Tente de novo em instantes.</Text>;
      }
      return (
        <View style={s.imagemWrap}>
          {ratio == null ? (
            <View style={s.imagemCarregando}><ActivityIndicator color={colors.lilasIcone} /></View>
          ) : (
            <Image
              source={{ uri: item.url }}
              style={[s.imagem, { aspectRatio: ratio }]}
              resizeMode="contain"
              onError={() => setErroImagem(true)}
              accessibilityLabel={item.titulo}
            />
          )}
        </View>
      );
    }

    if (item.tipo === 'texto') {
      if (!item.texto) {
        return conteudos?.length ? (
          <Text style={s.indisponivel}>Este texto não está mais disponível.</Text>
        ) : (
          <View style={s.imagemCarregando}><ActivityIndicator color={colors.lilasIcone} /></View>
        );
      }
      return <TextoComLinks style={s.texto} selectable>{item.texto}</TextoComLinks>;
    }

    // Link (e documentos antigos): a descrição inteira aparece acima e o
    // endereço abre só pelo botão.
    const endereco = item.url || item.link;
    return endereco ? (
      <View style={s.linkCard}>
        <View style={s.linkIcone}><Ionicons name="link-outline" size={22} color={colors.lilasIcone} /></View>
        <Text style={s.linkHost} numberOfLines={1}>{hostDe(endereco)}</Text>
        <TouchableOpacity style={s.lockBtn} onPress={() => abrirLink(endereco)} activeOpacity={0.85}>
          <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Text style={s.lockBtnTxt}>Abrir o link</Text>
          <Ionicons name="open-outline" size={14} color="white" />
        </TouchableOpacity>
      </View>
    ) : (
      <Text style={s.indisponivel}>Este conteúdo não está disponível.</Text>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />

      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.titulo} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>
          {item.tipo === 'imagem' ? 'Imagem' : item.tipo === 'texto' ? 'Leitura' : item.tipo === 'link' ? 'Link' : 'Conteúdo'}
        </Text>
        <TouchableOpacity
          onPress={toggleFavorito}
          style={s.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={favoritado ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
        >
          <Ionicons
            name={favoritado ? 'heart' : 'heart-outline'}
            size={21}
            color={favoritado ? colors.roseTexto : colors.texto2}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: 40 + insets.bottom }]}
      >
        <View style={s.coluna}>
          <View style={s.cartao}>
            <Text style={s.titulo}>{item.titulo}</Text>
            {item.descricao ? <TextoComLinks style={s.descricao} selectable>{item.descricao}</TextoComLinks> : null}
            {item.tipo === 'texto' && !bloqueado ? (
              <>
                <View style={s.divisor} />
                {renderCorpo()}
              </>
            ) : null}
          </View>
          {item.tipo === 'texto' && !bloqueado ? null : renderCorpo()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Cartão de vidro: véu translúcido, borda de luz e sombra ameixa suave.
const vidro = () => ({
  backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.bordaLuz,
  shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 },
  shadowOpacity: colors.escuro ? 0.28 : 0.11, shadowRadius: 20, elevation: 2,
});

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: colors.escuro ? 0.25 : 0.08, shadowRadius: 10, elevation: 2,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.titulo },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 8 },
  coluna: { width: '100%', gap: 14 },
  cartao: { ...vidro(), padding: 20 },
  titulo: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.titulo, marginBottom: spacing.sm },
  descricao: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.texto2 },
  divisor: { height: 1, backgroundColor: colors.bordaSuave, marginVertical: spacing.lg },
  texto: { fontFamily: fonts.body, fontSize: 17, lineHeight: 29, color: colors.titulo, letterSpacing: 0.1 },
  imagemWrap: { ...vidro(), width: '100%', borderRadius: 22, overflow: 'hidden' },
  imagem: { width: '100%' },
  imagemCarregando: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
  indisponivel: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.texto2, textAlign: 'center', paddingVertical: spacing.xl },
  linkCard: { ...vidro(), alignItems: 'center', gap: 10, padding: spacing.lg },
  linkIcone: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  linkHost: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.texto2, maxWidth: '100%' },
  pilulaGrande: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  lockCard: { ...vidro(), alignItems: 'center', gap: 10, padding: spacing.xl, borderStyle: 'dashed', borderColor: colors.lav3 },
  lockTit: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 31, color: colors.titulo, textAlign: 'center' },
  lockSub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.texto2, textAlign: 'center' },
  lockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center',
    backgroundColor: colors.botao, borderRadius: radius.full, overflow: 'hidden',
    paddingHorizontal: 24, minHeight: 48, marginTop: 6,
    borderBottomWidth: 3, borderBottomColor: colors.botaoBase,
  },
  lockBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: 'white' },
}));
