import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { abrirLink } from '../../utils/abrirLink';

const ilVazio = require('../../../assets/images/il_coracao_ramos.png');

const TIPO_ICONE = {
  audio: 'headset-outline',
  video: 'videocam-outline',
  documento: 'document-text-outline',
  link: 'link-outline',
  imagem: 'image-outline',
  texto: 'document-text-outline',
};

// Ícone do botão de ação à direita do cartão.
const acaoIconeDe = (tipo) => {
  if (tipo === 'imagem') return 'image-outline';
  if (tipo === 'texto') return 'document-text-outline';
  if (tipo === 'documento' || tipo === 'link') return 'open-outline';
  return 'play';
};

// Rótulo exibido quando o item não tem descrição (o antigo `grupo` deixou de existir).
const TIPO_LABEL = { imagem: 'Imagem', texto: 'Texto', link: 'Link', documento: 'Documento', audio: 'Áudio', video: 'Vídeo' };


// Cores por categoria (função para acompanhar o tema claro/noturno).
const cores = () => ({
  pessegoFundo: colors.escuro ? 'rgba(242,183,158,0.14)' : '#FCE7DC',
  pessegoTinta: colors.escuro ? '#B4716A' : '#D98A69',
});
const corDaCategoria = () => ({
  acolhimento: { bg: colors.lav1, color: colors.lilasIcone },
  noturno:     { bg: cores().pessegoFundo, color: colors.escuro ? '#F2B79E' : '#A8582E' },
  complementar:{ bg: colors.lav1, color: colors.lilasIcone },
});

export default function AudiosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { favoritos, removerFavorito, temAcesso } = useApp();

  const handleItem = (item) => {
    if (!temAcesso(item.plano)) {
      Alert.alert(
        'Conteúdo Premium',
        `Este conteúdo requer um plano superior. Deseja ver os planos?`,
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Ver planos', onPress: () => navigation.navigate('Planos') },
        ]
      );
      return;
    }
    // Imagem e texto abrem na tela de leitura. O favorito não guarda o `texto`;
    // a tela busca a versão atual em `conteudos` pelo id.
    // Link com descrição (ex.: a história de uma música) também abre na tela
    // de leitura, para o texto aparecer inteiro; o link abre pelo botão.
    const linkComTexto = item.tipo === 'link' && !!String(item.descricao || '').trim();
    if (item.tipo === 'imagem' || item.tipo === 'texto' || linkComTexto) {
      navigation.navigate('Conteudo', {
        conteudo: {
          id: item.conteudoId || item.id,
          titulo: item.titulo,
          descricao: item.descricao,
          tipo: item.tipo,
          url: item.url,
          texto: item.texto,
          plano: item.plano,
        },
      });
      return;
    }
    if (item.tipo === 'documento' || item.tipo === 'link') {
      abrirLink(item.url || item.link);
      return;
    }
    // O id precisa ser o id real do conteúdo: é ele que o player usa para
    // favoritar/desfavoritar. Prefixar com "admin-" quebrava esse vínculo.
    navigation.navigate('AudioPlayer', {
      audio: {
        id: item.conteudoId || item.id,
        titulo: item.titulo,
        descricao: item.descricao,
        duracao: item.duracao,
        categoria: item.grupo || item.categoria,
        plano: item.plano,
        tipo: item.tipo,
        url: item.url,
      },
    });
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />

      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.titulo} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Conteúdos</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Explicação */}
        <View style={s.infoCard}>
          <View style={s.infoIcone}>
            <Ionicons name="heart" size={20} color={colors.roseTexto} />
          </View>
          <Text style={s.infoTxt}>
            Aqui ficam salvos os conteúdos que você favoritou durante o check-in.
            Toque em <Text style={{ color: colors.roseTexto, fontFamily: fonts.bodyBold }}>♡</Text> nos conteúdos que aparecerem após o seu check-in para salvá-los aqui.
          </Text>
        </View>

        {favoritos.length === 0 ? (
          <View style={s.emptyWrap}>
            <Moldura source={ilVazio} tamanho={120} />
            <Text style={s.emptyTit}>Nenhum conteúdo salvo ainda</Text>
            <Text style={s.emptySub}>
              Faça seu check-in emocional e toque no ícone de coração nos conteúdos sugeridos para salvá-los aqui.
            </Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('CheckIn')}>
              <Text style={s.emptyBtnTxt}>Ir para o check-in</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lilasTexto} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.countLabel}>{favoritos.length} conteúdo{favoritos.length !== 1 ? 's' : ''} salvo{favoritos.length !== 1 ? 's' : ''}</Text>
            {favoritos.map(item => {
              const bloqueado = !temAcesso(item.plano);
              const cat = corDaCategoria()[item.grupo] || corDaCategoria().acolhimento;
              const acaoIcone = acaoIconeDe(item.tipo);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.item, bloqueado && s.itemBloqueado]}
                  onPress={() => handleItem(item)}
                  activeOpacity={0.8}
                >
                  <View style={[s.thumb, { backgroundColor: bloqueado ? cores().pessegoFundo : cat.bg }]}>
                    <Ionicons
                      name={bloqueado ? 'lock-closed-outline' : (TIPO_ICONE[item.tipo] || 'document-outline')}
                      size={22}
                      color={bloqueado ? colors.roseFg : cat.color}
                    />
                  </View>
                  <View style={s.info}>
                    <Text style={s.titulo}>{item.titulo}</Text>
                    {item.descricao ? (
                      <Text style={s.desc} numberOfLines={2}>{item.descricao}</Text>
                    ) : (
                      <Text style={s.grupo}>{item.grupo || TIPO_LABEL[item.tipo] || ''}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => removerFavorito(item.conteudoId)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={s.favBtn}
                    accessibilityLabel="Remover dos favoritos"
                  >
                    <Ionicons name="heart" size={19} color={colors.roseTexto} />
                  </TouchableOpacity>
                  <View style={[s.playBtn, bloqueado && { backgroundColor: cores().pessegoTinta }]}>
                    {!bloqueado && <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} pointerEvents="none" />}
                    <Ionicons
                      name={bloqueado ? 'lock-closed' : acaoIcone}
                      size={14} color="white"
                      style={!bloqueado && acaoIcone === 'play' ? { marginLeft: 2 } : undefined}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
        <View style={{ height: 40 + insets.bottom }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Cartão de vidro: véu translúcido, borda de luz e sombra ameixa suave.
const vidro = () => ({
  backgroundColor: colors.card,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: colors.bordaLuz,
  shadowColor: colors.sombra,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: colors.escuro ? 0.28 : 0.11,
  shadowRadius: 20,
  elevation: 2,
});

// Ilustração da marca numa moldura arredondada (sem tintColor).
function Moldura({ source, tamanho = 120 }) {
  const extra = Math.round(tamanho * 0.1);
  return (
    <View style={{
      width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.26), overflow: 'hidden',
      borderWidth: 1, borderColor: colors.bordaLuz, backgroundColor: colors.cardSolido, flexShrink: 0,
    }}>
      <Image source={source} style={{ width: tamanho + extra * 2, height: tamanho + extra * 2, margin: -extra }} resizeMode="cover" />
    </View>
  );
}

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
  infoCard: { ...vidro(), flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginBottom: spacing.lg },
  infoIcone: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.roseFundo, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.texto2, lineHeight: 19 },
  countLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lilasTexto, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 4 },
  item: { ...vidro(), flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 12 },
  itemBloqueado: { opacity: 0.7 },
  thumb: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1 },
  titulo: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo, lineHeight: 20 },
  desc: { fontFamily: fonts.body, fontSize: 12.5, color: colors.texto2, marginTop: 2, lineHeight: 18 },
  grupo: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.texto2, marginTop: 2, textTransform: 'capitalize' },
  favBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.roseFundo },
  playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  emptyWrap: { ...vidro(), alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 10, marginTop: 8 },
  emptyTit: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.titulo, textAlign: 'center', marginTop: 6 },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', lineHeight: 21 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, minHeight: 46, paddingHorizontal: 22, backgroundColor: colors.vidro, borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2 },
  emptyBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
}));
