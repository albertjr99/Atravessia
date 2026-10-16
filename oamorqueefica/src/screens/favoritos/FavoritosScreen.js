import React, { useRef } from 'react';
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
import { BotaoFavoritar, AvisoRapido, useAvisoRapido, DicaFavoritos, acaoDoConteudo } from '../../components/Favoritar';

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
  if (tipo === 'texto') return 'book-outline';
  if (tipo === 'documento' || tipo === 'link') return 'open-outline';
  return 'play';
};

// Plano mínimo do conteúdo. Itens sem o campo `plano` (ou com ele em texto)
// são gratuitos, como no painel. Antes `temAcesso(undefined)` dava falso: o
// cartão aparecia bloqueado e o toque num texto mostrava "Conteúdo Premium"
// em vez de abrir o texto completo.
const planoDe = (item) => Number(item?.plano) || 0;

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

export default function FavoritosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { favoritos, removerFavorito, adicionarFavorito, temAcesso, colecoesComFalha } = useApp();
  const { aviso, mostrar, fechar } = useAvisoRapido();
  // "Desfazer" roda depois que a lista já mudou: usa sempre a versão atual.
  const adicionarRef = useRef(adicionarFavorito);
  adicionarRef.current = adicionarFavorito;

  // Tirar dos Favoritos com aviso e opção de desfazer (o toque no coração
  // preenchido era fácil de fazer sem querer e o item sumia sem explicação).
  const desfavoritar = (item) => {
    removerFavorito(item.conteudoId || item.id);
    mostrar({
      texto: 'Tirado dos seus Favoritos',
      icone: 'heart-outline',
      acao: {
        rotulo: 'Desfazer',
        onPress: () => {
          adicionarRef.current({ ...item, id: item.id || item.conteudoId });
          mostrar({ texto: 'Guardado nos seus Favoritos', icone: 'heart' });
        },
      },
    });
  };
  const semBiblioteca = colecoesComFalha?.length > 0;

  const handleItem = (item) => {
    if (!temAcesso(planoDe(item))) {
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
          plano: planoDe(item),
        },
      });
      return;
    }
    if (item.tipo === 'documento' || item.tipo === 'link') {
      abrirLink(item.url || item.link);
      return;
    }
    // O id precisa ser o id real do conteúdo: é ele que o player usa para
    // favoritar/desfavoritar. Prefixar com "admin-" criava um favorito órfão,
    // que nunca mais aparecia nesta lista.
    navigation.navigate('AudioPlayer', {
      audio: {
        id: item.conteudoId || item.id,
        titulo: item.titulo,
        descricao: item.descricao,
        categoria: item.grupo || item.categoria,
        plano: planoDe(item),
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
        <Text style={s.topTitle} numberOfLines={1}>Meus favoritos</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {semBiblioteca ? (
          <View style={s.avisoBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.roseTexto} />
            <Text style={s.avisoTxt}>
              Não foi possível carregar a biblioteca de conteúdos agora, então alguns
              favoritos podem não aparecer. Tente de novo em instantes.
            </Text>
          </View>
        ) : null}
        {favoritos.length > 0 ? <DicaFavoritos /> : null}
        {favoritos.length === 0 ? (
          <View style={s.emptyWrap}>
            <Moldura source={ilVazio} tamanho={120} />
            <Text style={s.emptyTit}>Nenhum favorito ainda</Text>
            <Text style={s.emptySub}>
              Toque em ♡ Favoritar em qualquer conteúdo para guardá-lo aqui.
            </Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('Audios')}>
              <Text style={s.emptyBtnTxt}>Explorar conteúdos</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lilasTexto} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.countLabel}>{favoritos.length} conteúdo{favoritos.length !== 1 ? 's' : ''} salvo{favoritos.length !== 1 ? 's' : ''}</Text>
            {favoritos.map(item => {
              const bloqueado = !temAcesso(planoDe(item));
              const cat = corDaCategoria()[item.grupo] || corDaCategoria().acolhimento;
              const acaoIcone = acaoIconeDe(item.tipo);
              const acao = acaoDoConteudo(item, bloqueado);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.item, bloqueado && s.itemBloqueado]}
                  onPress={() => handleItem(item)}
                  activeOpacity={0.8}
                >
                  <View style={s.itemLinha}>
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
                    <View style={[s.playBtn, bloqueado && { backgroundColor: cores().pessegoTinta }]}>
                      {!bloqueado && <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} pointerEvents="none" />}
                      <Ionicons
                        name={bloqueado ? 'lock-closed' : acaoIcone}
                        size={14} color="white"
                        style={!bloqueado && acaoIcone === 'play' ? { marginLeft: 2 } : undefined}
                      />
                    </View>
                  </View>
                  {/* Rodapé: o que o toque no cartão faz + coração com rótulo. */}
                  <View style={s.itemRodape}>
                    <View style={s.acaoDica}>
                      <Ionicons name={acao.icone} size={15} color={colors.lilasTexto} />
                      <Text style={s.acaoDicaTxt} numberOfLines={1}>{acao.rotulo}</Text>
                      {!bloqueado ? <Ionicons name="chevron-forward" size={13} color={colors.lilasTexto} /> : null}
                    </View>
                    <BotaoFavoritar favoritado onPress={() => desfavoritar(item)} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
        <View style={{ height: 40 + insets.bottom }} />
      </ScrollView>
      <AvisoRapido aviso={aviso} onFechar={fechar} inferior={insets.bottom} />
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
  avisoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.erroFundo, borderRadius: 18, padding: 14, marginBottom: spacing.md },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.roseTexto, lineHeight: 18 },
  countLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lilasTexto, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 4 },
  item: { ...vidro(), gap: 10, padding: 14, marginBottom: 12 },
  itemLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemRodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.bordaSuave,
  },
  acaoDica: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  acaoDicaTxt: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lilasTexto },
  itemBloqueado: { opacity: 0.7 },
  thumb: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1 },
  titulo: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo, lineHeight: 20 },
  desc: { fontFamily: fonts.body, fontSize: 12.5, color: colors.texto2, marginTop: 2, lineHeight: 18 },
  grupo: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.texto2, marginTop: 2, textTransform: 'capitalize' },
  playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  emptyWrap: { ...vidro(), alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 10, marginTop: 8 },
  emptyTit: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.titulo, textAlign: 'center', marginTop: 6 },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', lineHeight: 21 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, minHeight: 46, paddingHorizontal: 22, backgroundColor: colors.vidro, borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2 },
  emptyBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
}));
