import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { jornadas } from '../../data';
import { ScriptTitle, ProgressBar, PlanBadge, LockedOverlay } from '../../components';
import { useApp } from '../../hooks/AppContext';

export default function JornadasScreen({ navigation }) {
  const { temAcesso } = useApp();

  const handleJornada = (j) => {
    if (!temAcesso(j.plano)) {
      Alert.alert(
        j.titulo,
        `Esta jornada está disponível no Plano ${j.plano}. Deseja conhecer os planos?`,
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Ver planos', onPress: () => navigation.navigate('Planos') },
        ]
      );
      return;
    }
    navigation.navigate('JornadaDetalhe', { jornada: j });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <ScriptTitle size={24}>Jornadas</ScriptTitle>
          <Text style={styles.sub}>Percursos estruturados de transformação</Text>
        </View>

        <View style={styles.lista}>
          {jornadas.map(j => {
            const bloqueado = !temAcesso(j.plano);
            const progresso = j.totalAtividades > 0 ? j.atividadesConcluidas / j.totalAtividades : 0;
            return (
              <TouchableOpacity
                key={j.id}
                style={[styles.jornadaCard, bloqueado && styles.cardBloqueado]}
                onPress={() => handleJornada(j)}
                activeOpacity={0.85}
              >
                <View style={styles.jornadaHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jornadaTitulo}>{j.titulo}</Text>
                    <Text style={styles.jornadaDesc}>{j.descricao}</Text>
                  </View>
                  <PlanBadge plano={j.plano} />
                </View>

                <View style={styles.jornadaProgress}>
                  <ProgressBar progress={progresso} color={bloqueado ? colors.lav2 : colors.lav4} />
                  <View style={styles.progressInfo}>
                    <Text style={styles.progressText}>{j.atividadesConcluidas} de {j.totalAtividades} atividades</Text>
                    {progresso > 0 && (
                      <Text style={[styles.progressPct, { color: colors.lav5 }]}>{Math.round(progresso * 100)}%</Text>
                    )}
                  </View>
                </View>

                {bloqueado && (
                  <LockedOverlay plano={j.plano} onUpgrade={() => navigation.navigate('Planos')} />
                )}
              </TouchableOpacity>
            );
          })}

          {/* Pequenas Vitórias */}
          <TouchableOpacity
            style={styles.vitoriaCard}
            onPress={() => navigation.navigate('PequenasVitorias')}
            activeOpacity={0.85}
          >
            <View style={styles.vitoriaIcon}>
              <Ionicons name="star-outline" size={22} color={colors.lav5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vitoriaTitulo}>Pequenas Vitórias</Text>
              <Text style={styles.vitoriaSub}>Registre conquistas do seu dia a dia</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.lav4} />
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },
  lista: { paddingHorizontal: spacing.lg, gap: 12 },
  jornadaCard: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    ...shadow.soft,
  },
  cardBloqueado: { opacity: 0.7 },
  jornadaHeader: { flexDirection: 'row', gap: 12, marginBottom: spacing.md, alignItems: 'flex-start' },
  jornadaTitulo: { fontFamily: fonts.script, fontSize: 16, color: colors.lav6, marginBottom: 3 },
  jornadaDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, lineHeight: 16 },
  jornadaProgress: { gap: 5 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontFamily: fonts.body, fontSize: 10, color: colors.tl },
  progressPct: { fontFamily: fonts.bodyBold, fontSize: 10 },
  vitoriaCard: {
    backgroundColor: colors.lav1, borderRadius: radius.xl,
    padding: spacing.md, borderWidth: 1, borderColor: colors.lav2,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  vitoriaIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lav2, alignItems: 'center', justifyContent: 'center' },
  vitoriaTitulo: { fontFamily: fonts.script, fontSize: 16, color: colors.lav6 },
  vitoriaSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
});
