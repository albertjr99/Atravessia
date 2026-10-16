import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { abrirLink } from '../../utils/abrirLink';
import {
  useVideoApresentacao, BotaoApresentacao, ModalVideoApresentacao, VIDEOS,
} from '../../components/VideoApresentacao';

const ilustracao = require('../../../assets/images/jornadas_caminho.png');

const PLANO_LABEL = { 0: 'Perceber', 1: 'Acolher', 2: 'Compreender', 3: 'Evoluir' };
// Cores dos planos (Perceber = sálvia, Acolher = lilás, Compreender = névoa,
// Evoluir = pêssego): [fundo, tinta]. Função para acompanhar o tema.
const corPlano = (n) => {
  const e = colors.escuro;
  return ({
    0: { fundo: colors.sageFundo, tinta: e ? '#9FD0B0' : '#3F7A5E' },
    1: { fundo: colors.lav1, tinta: colors.lilasIcone },
    2: { fundo: e ? 'rgba(169,193,236,0.14)' : '#E3EAF7', tinta: e ? '#A9C1EC' : '#3F5A86' },
    3: { fundo: e ? 'rgba(242,183,158,0.14)' : '#FCE7DC', tinta: e ? '#F2B79E' : '#94492F' },
  })[n] || { fundo: colors.lav1, tinta: colors.lilasIcone };
};
const PLANO_TEXTO = { perceber: 0, gratis: 0, acolher: 1, compreender: 2, evoluir: 3 };

// O plano pode vir como número (app) ou texto (painel web, ex.: 'acolher').
function planoNumero(p) {
  if (typeof p === 'number') return p;
  const n = Number(p);
  if (p !== '' && p != null && Number.isFinite(n)) return n;
  return PLANO_TEXTO[String(p || '').toLowerCase()] ?? 0;
}

export default function JornadasScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { temAcesso, jornadasAdmin, travessiaItens, usuario } = useApp();
  const meuPlano = PLANO_LABEL[usuario?.plano] || 'Perceber';

  // Vídeo de apresentação: abre sozinho na primeira visita.
  const { video, abrirAutomatico, marcarVisto } = useVideoApresentacao('jornadas');
  const [verVideo, setVerVideo] = useState(false);
  useEffect(() => {
    if (abrirAutomatico) { setVerVideo(true); marcarVisto(); }
  }, [abrirAutomatico, marcarVisto]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.titulo} />
        </TouchableOpacity>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom }}>

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Continue a travessia</Text>
            <Text style={styles.sub}>Eu caminho junto com você</Text>
          </View>
          <Image source={ilustracao} style={styles.headerIlustracao} resizeMode="contain" />
        </View>
        {!!video && (
          <BotaoApresentacao onPress={() => setVerVideo(true)} style={styles.botaoVideo} />
        )}

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
                  <Ionicons name={item.icone || 'link-outline'} size={21} color={colors.lilasIcone} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.travessiaTitulo}>{item.titulo}</Text>
                  {item.descricao ? <Text style={styles.travessiaSub}>{item.descricao}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.lilasTexto} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Jornadas criadas pela admin (Firestore) */}
        {jornadasAdmin.length > 0 && (
          <View style={styles.lista}>
            {jornadasAdmin.map(j => {
              const planoJornada = planoNumero(j.plano);
              const acesso = temAcesso(planoJornada);
              const cor = corPlano(planoJornada);
              return (
                <TouchableOpacity
                  key={j.id}
                  style={[styles.jornadaCard, !acesso && styles.cardBloqueado]}
                  onPress={() => {
                    if (!acesso) {
                      Alert.alert(j.titulo, `Esta jornada faz parte do plano ${PLANO_LABEL[planoJornada]}. Seu plano atual é o ${meuPlano}.`, [
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
                    <View style={[styles.jornadaIcone, { backgroundColor: cor.fundo }]}>
                      <Ionicons name={acesso ? (j.icone || 'compass-outline') : 'lock-closed-outline'} size={21} color={cor.tinta} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jornadaTitulo}>{j.titulo}</Text>
                      {j.descricao ? <Text style={styles.jornadaDesc}>{j.descricao}</Text> : null}
                      {/* Antes aparecia só "PLANO EVOLUIR", que parecia ser o plano dela. */}
                      {!acesso && (
                        <View style={[styles.planoChip, { backgroundColor: cor.fundo }]}>
                          <Text style={[styles.planoLabel, { color: cor.tinta }]}>Disponível no plano {PLANO_LABEL[planoJornada]}</Text>
                        </View>
                      )}
                    </View>
                    <Ionicons name={acesso ? 'chevron-forward' : 'lock-closed'} size={acesso ? 18 : 15} color={acesso ? colors.lilasTexto : colors.texto2} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <ModalVideoApresentacao
        visivel={verVideo}
        onFechar={() => setVerVideo(false)}
        video={video}
        tituloPadrao={VIDEOS.jornadas.titulo}
      />
    </SafeAreaView>
  );
}

// Cartão de vidro: véu translúcido, borda de luz e sombra ameixa suave.
const vidro = () => ({
  backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.bordaLuz,
  shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 },
  shadowOpacity: colors.escuro ? 0.28 : 0.11, shadowRadius: 20, elevation: 2,
});

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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  titulo: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 40, color: colors.titulo },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.texto2, marginTop: 2 },
  headerIlustracao: { width: 72, height: 72 },
  lista: { paddingHorizontal: spacing.lg, gap: 12, marginBottom: 12 },
  botaoVideo: { marginLeft: spacing.lg, marginBottom: spacing.md },
  jornadaCard: { ...vidro(), padding: 16 },
  cardBloqueado: { opacity: 0.78 },
  jornadaHeader: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  jornadaTitulo: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 23, color: colors.titulo, marginBottom: 3 },
  jornadaDesc: { fontFamily: fonts.body, fontSize: 15, color: colors.texto2, lineHeight: 21 },
  jornadaIcone: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  planoChip: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  planoLabel: { fontFamily: fonts.bodyBold, fontSize: 12 },
  travessiaCard: { ...vidro(), padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  travessiaIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  travessiaTitulo: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 23, color: colors.titulo },
  travessiaSub: { fontFamily: fonts.body, fontSize: 15, color: colors.texto2, marginTop: 3, lineHeight: 21 },
}));
