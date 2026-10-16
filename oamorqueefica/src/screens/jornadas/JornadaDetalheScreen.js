import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { ProgressBar, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';

const tipoIcone = {
  audio: 'headset-outline',
  reflexao: 'moon-outline',
  escrita: 'create-outline',
  atividade: 'sparkles-outline',
};

export default function JornadaDetalheScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { jornadasComProgresso, concluirAtividadeJornada } = useApp();
  const jornada = jornadasComProgresso.find(j => j.id === route.params.jornadaId);
  const progresso = jornada.totalAtividades > 0 ? jornada.atividadesConcluidas / jornada.totalAtividades : 0;

  // Regra: conteúdo liberado gradualmente — apenas a próxima atividade não concluída fica disponível.
  const proximaIdx = jornada.atividades.findIndex(a => !a.concluida);

  const handleAtividade = (atividade, idx) => {
    if (atividade.concluida) {
      Alert.alert(atividade.titulo, 'Você já concluiu esta etapa. Pode revisitá-la quando quiser.');
      return;
    }
    if (idx !== proximaIdx) {
      Alert.alert('Um passo por vez', 'Esta etapa ainda não foi liberada. As jornadas são vividas gradualmente, um dia de cada vez.');
      return;
    }
    Alert.alert(atividade.titulo, 'Deseja marcar esta etapa como concluída?', [
      { text: 'Agora não', style: 'cancel' },
      { text: 'Concluir', onPress: () => concluirAtividadeJornada(jornada.id, atividade.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.titulo} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Jornada</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.titulo}>{jornada.titulo}</Text>
          <Text style={styles.desc}>{jornada.descricao}</Text>
          <View style={{ marginTop: spacing.md }}>
            <ProgressBar progress={progresso} color={colors.botao} />
            <Text style={styles.progressText}>{jornada.atividadesConcluidas} de {jornada.totalAtividades} etapas concluídas</Text>
          </View>
        </View>

        <View style={styles.lista}>
          {jornada.atividades.map((a, idx) => {
            const disponivel = a.concluida || idx === proximaIdx;
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.item, !disponivel && styles.itemBloqueado]}
                onPress={() => handleAtividade(a, idx)}
                activeOpacity={0.85}
              >
                <View style={[styles.itemIcon, a.concluida && { backgroundColor: colors.sageFundo }]}>
                  <Ionicons
                    name={a.concluida ? 'checkmark' : disponivel ? tipoIcone[a.tipo] : 'lock-closed-outline'}
                    size={19}
                    color={a.concluida ? colors.sageFg : colors.lilasIcone}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitulo}>{a.titulo}</Text>
                  <Text style={styles.itemTipo}>{a.tipo}</Text>
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

const styles = criarEstilos(() => ({
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
  header: { ...{
    backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.28 : 0.11, shadowRadius: 20, elevation: 2,
  }, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md, padding: 18 },
  titulo: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.titulo },
  desc: { fontFamily: fonts.body, fontSize: 15, color: colors.texto2, marginTop: 6, lineHeight: 21 },
  progressText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.lilasTexto, marginTop: 8 },
  lista: { paddingHorizontal: spacing.lg, gap: 10 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 22,
    borderWidth: 1, borderColor: colors.bordaLuz, padding: 14,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 8 }, shadowOpacity: colors.escuro ? 0.25 : 0.09, shadowRadius: 16, elevation: 2,
  },
  itemBloqueado: { opacity: 0.6 },
  itemIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  itemTipo: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.texto2, textTransform: 'capitalize', marginTop: 1 },
}));
