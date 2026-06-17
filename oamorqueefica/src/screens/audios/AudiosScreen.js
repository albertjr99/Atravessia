import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { audios } from '../../data';
import { ScriptTitle, PlanBadge } from '../../components';
import { useApp } from '../../hooks/AppContext';

const categorias = [
  { id: 'todos', label: 'Todos' },
  { id: 'acolhimento', label: 'Acolhimento' },
  { id: 'respiracao', label: 'Respiração' },
  { id: 'noturno', label: 'Noturnos' },
  { id: 'informativo', label: 'Informativos' },
];

const catIcones = {
  acolhimento: { icon: 'heart-outline', bg: colors.lav1, color: colors.lav5 },
  respiracao: { icon: 'leaf-outline', bg: '#E8F0E5', color: '#7a9870' },
  noturno: { icon: 'moon-outline', bg: '#F5EDE5', color: colors.peach2 },
  informativo: { icon: 'book-outline', bg: '#EAF0F5', color: '#7088A0' },
};

export default function AudiosScreen({ navigation }) {
  const { temAcesso } = useApp();
  const [catSel, setCatSel] = useState('todos');

  const filtrados = catSel === 'todos' ? audios : audios.filter(a => a.categoria === catSel);

  const handleAudio = (audio) => {
    if (!temAcesso(audio.plano)) {
      Alert.alert(
        'Conteúdo Premium',
        `Este áudio está disponível no Plano ${audio.plano}. Deseja conhecer os planos?`,
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Ver planos', onPress: () => navigation.navigate('Planos') },
        ]
      );
      return;
    }
    navigation.navigate('AudioPlayer', { audio });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <ScriptTitle size={24}>Conteúdos</ScriptTitle>
          <Text style={styles.sub}>Para cada momento do seu luto</Text>
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
          {filtrados.map(audio => {
            const bloqueado = !temAcesso(audio.plano);
            const icone = catIcones[audio.categoria] || catIcones.acolhimento;
            return (
              <TouchableOpacity
                key={audio.id}
                style={[styles.audioItem, bloqueado && styles.audioItemBloqueado]}
                onPress={() => handleAudio(audio)}
                activeOpacity={0.8}
              >
                <View style={[styles.audioThumb, { backgroundColor: icone.bg }]}>
                  <Ionicons name={bloqueado ? 'lock-closed-outline' : icone.icon} size={20} color={bloqueado ? colors.peach2 : icone.color} />
                </View>
                <View style={styles.audioInfo}>
                  <Text style={styles.audioTitulo}>{audio.titulo}</Text>
                  <Text style={styles.audioSub}>{audio.duracao} · {audio.categoria}</Text>
                </View>
                <View style={styles.audioRight}>
                  {audio.plano > 1 && <PlanBadge plano={audio.plano} />}
                  <View style={[styles.playBtn, { backgroundColor: bloqueado ? colors.peach : colors.lav4 }]}>
                    <Ionicons name={bloqueado ? 'lock-closed' : 'play'} size={12} color="white" style={!bloqueado && { marginLeft: 2 }} />
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },
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
