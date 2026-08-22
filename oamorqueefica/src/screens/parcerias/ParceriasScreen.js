import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Image, Linking, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';

export default function ParceriasScreen({ navigation }) {
  const { parcerias, registrarCliqueParceria } = useApp();

  const handleAbrirParceria = (p) => {
    if (!p.link) return;
    registrarCliqueParceria(p.id);
    if (Platform.OS === 'web') {
      window.open(p.link, '_blank');
    } else {
      Linking.openURL(p.link).catch(() => Alert.alert('', 'Não foi possível abrir o link.'));
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <LavandaBg />

      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Espaço para Parcerias</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Ionicons name="people-outline" size={30} color={colors.lav5} />
          </View>
          <Text style={s.heroTitle}>Aqui você encontra descontos{'\n'}exclusivos para cuidar:</Text>
          <Text style={s.heroSub}>
            Parcerias selecionadas com cuidado para apoiar você na sua jornada de cura e bem-estar.
          </Text>
          <View style={s.catRow}>
            {['Saúde física', 'Bem-estar', 'Terapias', 'Educação', 'e muito mais'].map(cat => (
              <View key={cat} style={s.catChip}>
                <Text style={s.catChipTxt}>{cat}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Benefícios ilustrativos */}
        <View style={s.beneficiosRow}>
          {[
            { icon: 'pricetag-outline', label: 'Descontos\nexclusivos' },
            { icon: 'ticket-outline', label: 'Cupons gerados\npelo aplicativo' },
            { icon: 'heart-outline', label: 'Parcerias que\nfazem bem' },
          ].map(b => (
            <View key={b.label} style={s.beneficioItem}>
              <View style={s.beneficioIcon}>
                <Ionicons name={b.icon} size={20} color={colors.lav4} />
              </View>
              <Text style={s.beneficioLbl}>{b.label}</Text>
            </View>
          ))}
        </View>

        {/* Lista de parcerias */}
        {parcerias.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="hourglass-outline" size={40} color={colors.lav3} />
            <Text style={s.emptyTit}>Em breve</Text>
            <Text style={s.emptySub}>
              Novas parcerias e benefícios exclusivos serão anunciados em breve. Fique de olho!
            </Text>
          </View>
        ) : (
          <View style={s.lista}>
            <Text style={s.listaTitle}>Parcerias disponíveis</Text>
            {parcerias.map(p => (
              <TouchableOpacity
                key={p.id}
                style={s.card}
                onPress={() => handleAbrirParceria(p)}
                activeOpacity={0.85}
              >
                {p.imagemUrl ? (
                  <Image source={{ uri: p.imagemUrl }} style={s.cardImg} resizeMode="cover" />
                ) : (
                  <View style={s.cardImgPlaceholder}>
                    <Ionicons name="people-outline" size={32} color={colors.lav3} />
                    <Text style={s.cardImgPlaceholderTxt}>Parceria Atravessia</Text>
                  </View>
                )}
                <View style={s.cardBody}>
                  <View style={s.cardTags}>
                    {(p.categorias || []).slice(0, 3).map(cat => (
                      <View key={cat} style={s.tag}>
                        <Text style={s.tagTxt}>{cat}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={s.cardTitulo}>{p.titulo}</Text>
                  {p.descricao ? (
                    <Text style={s.cardDesc} numberOfLines={3}>{p.descricao}</Text>
                  ) : null}
                  <View style={s.cardCta}>
                    <Ionicons name="arrow-forward-circle" size={16} color={colors.lav4} />
                    <Text style={s.cardCtaTxt}>Acessar benefício</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },

  hero: {
    alignItems: 'center', paddingHorizontal: spacing.xl,
    paddingTop: spacing.md, paddingBottom: spacing.lg,
  },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, borderWidth: 1, borderColor: colors.lav2,
  },
  heroTitle: {
    fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td,
    textAlign: 'center', lineHeight: 28, marginBottom: 10,
  },
  heroSub: {
    fontFamily: fonts.body, fontSize: 13, color: colors.tm,
    textAlign: 'center', lineHeight: 20, marginBottom: 14,
  },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  catChip: {
    backgroundColor: colors.lav1, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.lav2,
  },
  catChipTxt: { fontFamily: fonts.body, fontSize: 11, color: colors.lav5 },

  beneficiosRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginHorizontal: spacing.lg, marginBottom: spacing.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
  },
  beneficioItem: { alignItems: 'center', gap: 8, flex: 1 },
  beneficioIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.lav2,
  },
  beneficioLbl: {
    fontFamily: fonts.body, fontSize: 10, color: colors.td,
    textAlign: 'center', lineHeight: 15,
  },

  emptyBox: { alignItems: 'center', padding: spacing.xxl, gap: 10 },
  emptyTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.td },
  emptySub: {
    fontFamily: fonts.body, fontSize: 13, color: colors.tm,
    textAlign: 'center', lineHeight: 20,
  },

  lista: { paddingHorizontal: spacing.lg },
  listaTitle: {
    fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.card, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', marginBottom: 14,
    shadowColor: '#6b5b7a', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  cardImg: { width: '100%', height: 150 },
  cardImgPlaceholder: {
    width: '100%', height: 110,
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  cardImgPlaceholderTxt: { fontFamily: fonts.body, fontSize: 11, color: colors.lav4 },
  cardBody: { padding: spacing.md },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: {
    backgroundColor: colors.lav1, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagTxt: { fontFamily: fonts.body, fontSize: 10, color: colors.lav5 },
  cardTitulo: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td, marginBottom: 5 },
  cardDesc: {
    fontFamily: fonts.body, fontSize: 12, color: colors.tm,
    lineHeight: 18, marginBottom: 12,
  },
  cardCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  cardCtaTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav4 },
});
