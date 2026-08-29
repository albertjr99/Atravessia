import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { abrirLink } from '../../utils/abrirLink';

const FILTROS = [
  { id: 'todos',           label: 'Todos',                       match: null },
  { id: 'saude',           label: 'Da saúde física',             match: ['saúde', 'saude', 'saúde física', 'saude fisica', 'fisio', 'nutrição'] },
  { id: 'voce',            label: 'De você e do ambiente',       match: ['você', 'voce', 'bem-estar', 'bem estar', 'ambiente', 'casa', 'moradia', 'espiritualidade', 'meditação'] },
  { id: 'trabalho',        label: 'Do trabalho e estudos',       match: ['trabalho', 'estudos', 'educação', 'educacao', 'carreira', 'curso'] },
  { id: 'relacionamentos', label: 'Dos relacionamentos',         match: ['relacionamentos', 'relacionamento', 'família', 'familia', 'social'] },
  { id: 'outros',          label: 'Outros',                      match: ['outros', 'other'] },
];

export default function ParceriasScreen({ navigation }) {
  const { parcerias, registrarCliqueParceria } = useApp();
  const [filtroAtivo, setFiltroAtivo] = useState('todos');

  const handleAbrirParceria = (p) => {
    // Aceita tanto `link` (painel web) quanto `url` (cadastros antigos do app).
    const destino = p.link || p.url;
    registrarCliqueParceria(p.id);
    abrirLink(destino);
  };

  const parceriasExibidas = filtroAtivo === 'todos'
    ? parcerias
    : parcerias.filter(p => {
        const cats = (p.categorias || []).map(c => c.toLowerCase());
        const filtro = FILTROS.find(f => f.id === filtroAtivo);
        if (!filtro?.match) return true;
        return filtro.match.some(m => cats.some(c => c.includes(m)));
      });

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LavandaBg />

      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Benefícios e Parcerias</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Ionicons name="gift-outline" size={28} color={colors.lav5} />
          </View>
          <Text style={s.heroTitle}>Aqui você encontra descontos{'\n'}exclusivos para cuidar:</Text>
          <Text style={s.heroSub}>
            Você é o autor da sua história e a Atravessia caminha com você.{'\n'}
            Experimente a vida — descubra novos parceiros, benefícios e descontos para cuidar de você e viver melhor o hoje.
          </Text>
        </View>

        {/* Filtros */}
        <View style={s.filtrosWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtrosRow}>
            {FILTROS.map(f => (
              <TouchableOpacity
                key={f.id}
                style={[s.filtroChip, filtroAtivo === f.id && s.filtroChipAtivo]}
                onPress={() => setFiltroAtivo(f.id)}
                activeOpacity={0.75}
              >
                <Text style={[s.filtroChipTxt, filtroAtivo === f.id && s.filtroChipTxtAtivo]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Benefícios ilustrativos */}
        <View style={s.beneficiosRow}>
          {[
            { icon: 'pricetag-outline', label: 'Descontos\nexclusivos' },
            { icon: 'ticket-outline', label: 'Cupons pelo\naplicativo' },
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
        ) : parceriasExibidas.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="search-outline" size={36} color={colors.lav3} />
            <Text style={s.emptyTit}>Sem parcerias aqui</Text>
            <Text style={s.emptySub}>Nenhuma parceria nesta categoria ainda. Tente outro filtro.</Text>
          </View>
        ) : (
          <View style={s.lista}>
            <Text style={s.listaTitle}>
              {filtroAtivo === 'todos' ? 'Parcerias disponíveis' : FILTROS.find(f => f.id === filtroAtivo)?.label}
            </Text>
            {parceriasExibidas.map(p => (
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
                    <Ionicons name="gift-outline" size={32} color={colors.lav3} />
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
    textAlign: 'center', lineHeight: 20, marginBottom: 8,
  },
  filtrosWrap: { marginBottom: spacing.sm },
  filtrosRow: { paddingHorizontal: spacing.lg, gap: 8, paddingVertical: 4 },
  filtroChip: {
    backgroundColor: colors.card, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: colors.border,
  },
  filtroChipAtivo: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  filtroChipTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.td },
  filtroChipTxtAtivo: { fontFamily: fonts.bodyBold, color: 'white' },

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
