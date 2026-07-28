import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';

const TIPO_ICONE = {
  audio: 'headset-outline',
  video: 'videocam-outline',
  documento: 'document-text-outline',
  link: 'link-outline',
};

const CAT_ICONE = {
  acolhimento: { bg: colors.lav1, color: colors.lav5 },
  noturno:     { bg: '#F5EDE5', color: '#B08070' },
  complementar:{ bg: colors.lav1, color: colors.lav5 },
};

export default function FavoritosScreen({ navigation }) {
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
    if (item.tipo === 'documento' || item.tipo === 'link') {
      Linking.openURL(item.url).catch(() => Alert.alert('Erro', 'Não foi possível abrir este link.'));
      return;
    }
    navigation.navigate('AudioPlayer', { audio: { id: `admin-${item.id}`, titulo: item.titulo, categoria: item.grupo, plano: item.plano, tipo: item.tipo, url: item.url } });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <LavandaBg />

      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Meus favoritos</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {favoritos.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="heart-outline" size={52} color={colors.lav3} />
            <Text style={s.emptyTit}>Nenhum favorito ainda</Text>
            <Text style={s.emptySub}>
              Toque no ícone de coração em qualquer conteúdo para salvá-lo aqui.
            </Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('Audios')}>
              <Text style={s.emptyBtnTxt}>Explorar conteúdos</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.lav5} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.countLabel}>{favoritos.length} conteúdo{favoritos.length !== 1 ? 's' : ''} salvo{favoritos.length !== 1 ? 's' : ''}</Text>
            {favoritos.map(item => {
              const bloqueado = !temAcesso(item.plano);
              const cat = CAT_ICONE[item.grupo] || CAT_ICONE.acolhimento;
              const acaoIcone = item.tipo === 'documento' || item.tipo === 'link' ? 'open-outline' : 'play';
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
                      <Text style={s.desc} numberOfLines={1}>{item.descricao}</Text>
                    ) : (
                      <Text style={s.grupo}>{item.grupo}</Text>
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
                    <Ionicons name={bloqueado ? 'lock-closed' : acaoIcone} size={12} color="white" style={!bloqueado && acaoIcone === 'play' && { marginLeft: 2 }} />
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: colors.lav1,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.td },
  scroll: { padding: spacing.lg },
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
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.td },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.lav1, borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav3 },
  emptyBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav5 },
});
