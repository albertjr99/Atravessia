import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Alert, Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { abrirLink } from '../../utils/abrirLink';

// Tela de leitura dos "Outros conteúdos" do tipo imagem e texto.
// Recebe o item por params (vindo do check-in, da aba Conteúdos ou dos
// Favoritos). A cópia guardada no favorito não inclui o `texto`, então os
// dados atuais são sempre buscados em `conteudos` pelo id.
const limparId = (v) => String(v || '').replace(/^(audio|admin)-/, '');

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
          <Ionicons name="lock-closed-outline" size={32} color={colors.lav4} />
          <Text style={s.lockTit}>Conteúdo de um plano superior</Text>
          <Text style={s.lockSub}>Este conteúdo faz parte de outro plano. Conheça os planos para acessá-lo.</Text>
          <TouchableOpacity style={s.lockBtn} onPress={() => navigation.navigate('Planos')} activeOpacity={0.85}>
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
            <View style={s.imagemCarregando}><ActivityIndicator color={colors.lav4} /></View>
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
          <View style={s.imagemCarregando}><ActivityIndicator color={colors.lav4} /></View>
        );
      }
      return <Text style={s.texto} selectable>{item.texto}</Text>;
    }

    // Outros tipos não deveriam chegar aqui; oferece abrir o endereço.
    return item.url ? (
      <TouchableOpacity style={s.lockBtn} onPress={() => abrirLink(item.url)} activeOpacity={0.85}>
        <Text style={s.lockBtnTxt}>Abrir conteúdo</Text>
        <Ionicons name="open-outline" size={14} color="white" />
      </TouchableOpacity>
    ) : (
      <Text style={s.indisponivel}>Este conteúdo não está disponível.</Text>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LavandaBg />

      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>
          {item.tipo === 'imagem' ? 'Imagem' : item.tipo === 'texto' ? 'Leitura' : 'Conteúdo'}
        </Text>
        <TouchableOpacity
          onPress={toggleFavorito}
          style={s.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={favoritado ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
        >
          <Ionicons
            name={favoritado ? 'heart' : 'heart-outline'}
            size={22}
            color={favoritado ? '#C06080' : colors.tm}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: 40 + insets.bottom }]}
      >
        <View style={s.coluna}>
          <Text style={s.titulo}>{item.titulo}</Text>
          {item.descricao ? <Text style={s.descricao}>{item.descricao}</Text> : null}
          <View style={s.divisor} />
          {renderCorpo()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: colors.lav1,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 17, color: colors.td },
  scroll: { padding: spacing.lg },
  // Em tablet a linha de leitura não fica longa demais.
  coluna: { width: '100%', maxWidth: 680, alignSelf: 'center' },
  titulo: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 32, color: colors.lav6, marginBottom: spacing.sm },
  descricao: { fontFamily: fonts.bodyLight, fontSize: 15, lineHeight: 23, color: colors.tm },
  divisor: { height: 1, backgroundColor: colors.lav2, marginVertical: spacing.lg, width: 48 },
  texto: { fontFamily: fonts.body, fontSize: 17, lineHeight: 29, color: colors.td, letterSpacing: 0.1 },
  imagemWrap: {
    width: '100%', borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  imagem: { width: '100%' },
  imagemCarregando: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
  indisponivel: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.tm, textAlign: 'center', paddingVertical: spacing.xl },
  lockCard: {
    alignItems: 'center', gap: 10, backgroundColor: colors.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lav2, borderStyle: 'dashed',
    padding: spacing.xl,
  },
  lockTit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td, textAlign: 'center' },
  lockSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.tm, textAlign: 'center' },
  lockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center',
    backgroundColor: colors.lav4, borderRadius: radius.full,
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 6,
  },
  lockBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
});
