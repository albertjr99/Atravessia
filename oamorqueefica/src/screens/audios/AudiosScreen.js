import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { abrirLink } from '../../utils/abrirLink';

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

// Função (e não objeto fixo) para acompanhar o tema claro/noturno.
const corDaCategoria = () => ({
  acolhimento: { bg: colors.lav1, color: colors.lav5 },
  noturno:     { bg: colors.escuro ? '#3A2E26' : '#F5EDE5', color: colors.escuro ? '#DDB49F' : '#B08070' },
  complementar:{ bg: colors.lav1, color: colors.lav5 },
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

      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Conteúdos</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Explicação */}
        <View style={s.infoCard}>
          <Ionicons name="heart" size={20} color="#C06080" />
          <Text style={s.infoTxt}>
            Aqui ficam salvos os conteúdos que você favoritou durante o check-in.
            Toque em <Text style={{ color: '#C06080' }}>♡</Text> nos conteúdos que aparecerem após o seu check-in para salvá-los aqui.
          </Text>
        </View>

        {favoritos.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="heart-outline" size={52} color={colors.lav3} />
            <Text style={s.emptyTit}>Nenhum conteúdo salvo ainda</Text>
            <Text style={s.emptySub}>
              Faça seu check-in emocional e toque no ícone de coração nos conteúdos sugeridos para salvá-los aqui.
            </Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('CheckIn')}>
              <Text style={s.emptyBtnTxt}>Ir para o check-in</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.lav5} />
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
                  <View style={[s.thumb, { backgroundColor: cat.bg }]}>
                    <Ionicons
                      name={bloqueado ? 'lock-closed-outline' : (TIPO_ICONE[item.tipo] || 'document-outline')}
                      size={20}
                      color={bloqueado ? colors.peach2 : cat.color}
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
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="heart" size={20} color="#C06080" />
                  </TouchableOpacity>
                  <View style={[s.playBtn, { backgroundColor: bloqueado ? colors.peach : colors.lav4 }]}>
                    <Ionicons
                      name={bloqueado ? 'lock-closed' : acaoIcone}
                      size={12} color="white"
                      style={!bloqueado && acaoIcone === 'play' ? { marginLeft: 2 } : undefined}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: colors.lav1,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.td },
  scroll: { padding: spacing.lg },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.roseFundo, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.escuro ? '#5A3A45' : '#F0C0D0',
    padding: spacing.md, marginBottom: spacing.lg,
  },
  infoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.tm, lineHeight: 18 },
  countLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: spacing.md },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: 10, ...shadow.soft,
  },
  itemBloqueado: { opacity: 0.65 },
  thumb: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1 },
  titulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  desc: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
  grupo: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: 2, textTransform: 'capitalize' },
  playBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.td },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.lav1, borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav3 },
  emptyBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav5 },
}));
