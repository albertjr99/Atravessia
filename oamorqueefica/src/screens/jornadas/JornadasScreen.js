import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { ScriptTitle, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { abrirLink } from '../../utils/abrirLink';

const ilustracao = require('../../../assets/images/jornadas_caminho.png');

const PLANO_LABEL = { 0: 'Grátis', 1: 'Acolher', 2: 'Compreender', 3: 'Evoluir' };
const PLANO_COR = { 0: colors.sage, 1: colors.lav4, 2: '#7B5EA7', 3: '#C0843F' };

export default function JornadasScreen({ navigation }) {
  const { temAcesso, jornadasAdmin, travessiaItens } = useApp();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <LavandaBg />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ScriptTitle size={24}>Continue a travessia</ScriptTitle>
            <Text style={styles.sub}>Eu caminho junto com você</Text>
          </View>
          <Image source={ilustracao} style={styles.headerIlustracao} resizeMode="contain" />
        </View>

        {/* Itens da Travessia — gerenciados pela admin */}
        {travessiaItens.length > 0 && (
          <View style={styles.lista}>
            {travessiaItens.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.travessiaCard}
                onPress={() => abrirLink(item.url || item.link)}
                activeOpacity={0.85}
              >
                <View style={styles.travessiaIcon}>
                  <Ionicons name={item.icone || 'link-outline'} size={20} color={colors.lav5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.travessiaTitulo}>{item.titulo}</Text>
                  {item.descricao ? <Text style={styles.travessiaSub}>{item.descricao}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.lav4} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Jornadas criadas pela admin (Firestore) */}
        {jornadasAdmin.length > 0 && (
          <View style={styles.lista}>
            {jornadasAdmin.map(j => {
              const acesso = temAcesso(j.plano);
              const cor = PLANO_COR[j.plano] ?? colors.lav4;
              return (
                <TouchableOpacity
                  key={j.id}
                  style={[styles.jornadaCard, !acesso && styles.cardBloqueado]}
                  onPress={() => {
                    if (!acesso) {
                      Alert.alert(j.titulo, `Disponível no plano ${PLANO_LABEL[j.plano]}.`, [
                        { text: 'Agora não', style: 'cancel' },
                        { text: 'Ver planos', onPress: () => navigation.navigate('Planos') },
                      ]);
                      return;
                    }
                    Alert.alert(j.titulo, j.descricao || 'Jornada em breve.');
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.jornadaHeader}>
                    <View style={[styles.jornadaIcone, { backgroundColor: cor + '22' }]}>
                      <Ionicons name={acesso ? (j.icone || 'compass-outline') : 'lock-closed-outline'} size={22} color={cor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jornadaTitulo}>{j.titulo}</Text>
                      {j.descricao ? <Text style={styles.jornadaDesc}>{j.descricao}</Text> : null}
                      {!acesso && <Text style={[styles.planoLabel, { color: cor }]}>Plano {PLANO_LABEL[j.plano]}</Text>}
                    </View>
                    <Ionicons name={acesso ? 'chevron-forward' : 'lock-closed'} size={16} color={acesso ? colors.lav4 : colors.tl} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },
  headerIlustracao: { width: 64, height: 64 },
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
  jornadaIcone: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  planoLabel: { fontFamily: fonts.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.tm, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  travessiaCard: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    ...shadow.soft,
  },
  travessiaIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  travessiaTitulo: { fontFamily: fonts.script, fontSize: 16, color: colors.lav6 },
  travessiaSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
});
