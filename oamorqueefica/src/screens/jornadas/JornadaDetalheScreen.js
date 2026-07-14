import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { ScriptTitle, ProgressBar, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';

const tipoIcone = {
  audio: 'headset-outline',
  reflexao: 'moon-outline',
  escrita: 'create-outline',
  atividade: 'sparkles-outline',
};

export default function JornadaDetalheScreen({ route, navigation }) {
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
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <LavandaBg />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Jornada</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ScriptTitle size={22}>{jornada.titulo}</ScriptTitle>
          <Text style={styles.desc}>{jornada.descricao}</Text>
          <View style={{ marginTop: spacing.md }}>
            <ProgressBar progress={progresso} color={colors.lav4} />
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
                <View style={[styles.itemIcon, a.concluida && { backgroundColor: colors.sage + '40' }]}>
                  <Ionicons
                    name={a.concluida ? 'checkmark' : disponivel ? tipoIcone[a.tipo] : 'lock-closed-outline'}
                    size={16}
                    color={a.concluida ? colors.sageFg : colors.lav5}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  desc: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 6, lineHeight: 18 },
  progressText: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 6 },
  lista: { paddingHorizontal: spacing.lg, gap: 8 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
    ...shadow.soft,
  },
  itemBloqueado: { opacity: 0.55 },
  itemIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  itemTipo: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, textTransform: 'capitalize', marginTop: 1 },
});
