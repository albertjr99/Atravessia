import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { audios } from '../../data';
import { ScriptTitle, PlanBadge } from '../../components';
import { useApp } from '../../hooks/AppContext';

const ilustracao = require('../../../assets/images/il_audio_respiracao.png');

const categorias = [
  { id: 'todos', label: 'Todos' },
  { id: 'acolhimento', label: 'Acolhimento' },
  { id: 'respiracao', label: 'Respiração' },
  { id: 'noturno', label: 'Noturnos' },
  { id: 'informativo', label: 'Informativos' },
  { id: 'complementar', label: 'Complementar' },
  { id: 'sessao', label: 'Sessão' },
];

const catIcones = {
  acolhimento: { icon: 'heart-outline', bg: colors.lav1, color: colors.lav5 },
  respiracao: { icon: 'leaf-outline', bg: '#E8F0E5', color: '#7a9870' },
  noturno: { icon: 'moon-outline', bg: '#F5EDE5', color: colors.peach2 },
  informativo: { icon: 'book-outline', bg: '#EAF0F5', color: '#7088A0' },
  complementar: { icon: 'sparkles-outline', bg: colors.lav1, color: colors.lav5 },
  sessao: { icon: 'people-outline', bg: '#EAF0F5', color: '#7088A0' },
};

const tipoIcone = {
  audio: 'headset-outline',
  video: 'videocam-outline',
  documento: 'document-text-outline',
  link: 'link-outline',
};

// Conteúdos publicados pelo painel admin não têm plano explícito —
// o grupo de acesso define o plano mínimo necessário (mesma regra do liberarConteudo).
const PLANO_POR_GRUPO = { acolhimento: 1, complementar: 2, sessao: 3 };

export default function AudiosScreen({ navigation }) {
  const { temAcesso, conteudos } = useApp();
  const [catSel, setCatSel] = useState('todos');

  const itensAdmin = conteudos.map(c => ({
    id: `admin-${c.id}`,
    titulo: c.titulo,
    categoria: c.grupo,
    duracao: '',
    descricao: '',
    plano: PLANO_POR_GRUPO[c.grupo] || 1,
    tipo: c.tipo,
    url: c.url,
  }));

  const todosItens = [...audios.map(a => ({ ...a, tipo: 'audio' })), ...itensAdmin];
  const filtrados = catSel === 'todos' ? todosItens : todosItens.filter(a => a.categoria === catSel);

  const handleItem = (item) => {
    if (!temAcesso(item.plano)) {
      Alert.alert(
        'Conteúdo Premium',
        `Este conteúdo está disponível no Plano ${item.plano}. Deseja conhecer os planos?`,
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
    navigation.navigate('AudioPlayer', { audio: item });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ScriptTitle size={24}>Conteúdos</ScriptTitle>
            <Text style={styles.sub}>Para cada momento do seu luto</Text>
          </View>
          <Image source={ilustracao} style={styles.headerIlustracao} resizeMode="contain" />
        </View>

        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
          {categorias.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, catSel === c.id && styles.chipAtivo]}
              onPress={() => setCatSel(c.id)}
            >
              <Text style={[styles.chipText, catSel === c.id && styles.chipTextAtivo]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Lista */}
        <View style={styles.lista}>
          {filtrados.map(item => {
            const bloqueado = !temAcesso(item.plano);
            const icone = catIcones[item.categoria] || catIcones.acolhimento;
            const acaoIcone = item.tipo === 'documento' || item.tipo === 'link' ? 'open-outline' : 'play';
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.audioItem, bloqueado && styles.audioItemBloqueado]}
                onPress={() => handleItem(item)}
                activeOpacity={0.8}
              >
                <View style={[styles.audioThumb, { backgroundColor: icone.bg }]}>
                  <Ionicons name={bloqueado ? 'lock-closed-outline' : (tipoIcone[item.tipo] || icone.icon)} size={20} color={bloqueado ? colors.peach2 : icone.color} />
                </View>
                <View style={styles.audioInfo}>
                  <Text style={styles.audioTitulo}>{item.titulo}</Text>
                  <Text style={styles.audioSub}>{[item.duracao, item.categoria].filter(Boolean).join(' · ')}</Text>
                </View>
                <View style={styles.audioRight}>
                  {item.plano > 1 && <PlanBadge plano={item.plano} />}
                  <View style={[styles.playBtn, { backgroundColor: bloqueado ? colors.peach : colors.lav4 }]}>
                    <Ionicons name={bloqueado ? 'lock-closed' : acaoIcone} size={12} color="white" style={!bloqueado && acaoIcone === 'play' && { marginLeft: 2 }} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },
  headerIlustracao: { width: 64, height: 64 },
  chipsScroll: { marginBottom: spacing.sm },
  chipsContent: { paddingHorizontal: spacing.lg, gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  chipAtivo: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTextAtivo: { color: colors.white, fontFamily: fonts.bodyBold },
  lista: { paddingHorizontal: spacing.lg, gap: 10 },
  audioItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    ...shadow.soft,
  },
  audioItemBloqueado: { opacity: 0.65 },
  audioThumb: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  audioInfo: { flex: 1 },
  audioTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  audioSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2, textTransform: 'capitalize' },
  audioRight: { alignItems: 'flex-end', gap: 6 },
  playBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
