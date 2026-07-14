import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { emocoes, audios } from '../../data';
import { Button, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';

const ilustracao = require('../../../assets/images/il_onda_coracao.png');

export default function CheckInScreen({ navigation }) {
  const { adicionarCheckin, checkins, podeLiberarNovo, liberarConteudo, jaLiberado, usuario } = useApp();
  const [emocaoSel, setEmocaoSel] = useState(null);
  const [intensidade, setIntensidade] = useState(3);
  const [salvo, setSalvo] = useState(false);
  const [audioLiberado, setAudioLiberado] = useState(false);

  const intensLabels = ['', 'Leve', 'Leve', 'Moderado', 'Intenso', 'Intenso'];
  const historico = checkins.slice(-7);
  const emocaoObj = emocaoSel ? emocoes.find(e => e.id === emocaoSel) : null;
  const audioRec = emocaoSel && emocaoObj && !emocaoObj.positiva
    ? audios.find(a => a.emocoes.includes(emocaoSel))
    : null;
  const mensagemAcolhimento = emocaoObj
    ? emocaoObj.mensagens[Math.floor(Math.random() * emocaoObj.mensagens.length)]
    : null;

  const handleSalvar = () => {
    if (!emocaoSel) { Alert.alert('', 'Selecione como você está.'); return; }
    adicionarCheckin(emocaoSel, intensidade);
    setSalvo(true);
  };

  const handleOuvirAudio = () => {
    if (!audioRec) return;
    if (jaLiberado(audioRec.id) || podeLiberarNovo('acolhimento')) {
      liberarConteudo(audioRec.id, 'acolhimento');
      setAudioLiberado(true);
      navigation.navigate('AudioPlayer', { audio: audioRec });
    } else {
      Alert.alert('', 'Você já ouviu seu áudio de acolhimento de hoje. Volte amanhã para um novo.');
    }
  };

  const temPlano1 = (usuario?.plano || 0) >= 1;

  if (salvo) {
    // POSITIVO: celebração discreta, sem recomendação de conteúdo
    if (emocaoObj?.positiva) {
      return (
        <SafeAreaView style={s.safe}>
          <LavandaBg />
          <View style={s.savedWrap}>
            <View style={s.celebCircle}>
              <Ionicons name="sparkles" size={48} color={colors.gold} />
            </View>
            <Text style={s.savedTit}>Que bom saber disso! 💜</Text>
            <Text style={s.savedSub}>{mensagemAcolhimento}</Text>
            <Text style={s.savedHint}>Continue se cuidando. Voltamos amanhã para o próximo check-in.</Text>
            <Button title="Voltar ao início" onPress={() => navigation.goBack()} style={{ marginTop: 24, width: '100%' }} />
          </View>
        </SafeAreaView>
      );
    }

    // NEGATIVO: mensagem de acolhimento + botão de áudio (Plan 1+)
    return (
      <SafeAreaView style={s.safe}>
        <LavandaBg />
        <View style={s.savedWrap}>
          <View style={[s.celebCircle, { backgroundColor: colors.lav2 }]}>
            <Ionicons name="heart" size={40} color={colors.lav4} />
          </View>
          <Text style={s.savedTit}>Check-in registrado</Text>
          <Text style={s.savedSub}>{mensagemAcolhimento}</Text>

          {temPlano1 && audioRec && (
            <TouchableOpacity style={s.recCard} onPress={handleOuvirAudio} activeOpacity={0.85}>
              <Text style={s.recTag}>Áudio de acolhimento para você</Text>
              <View style={s.recRow}>
                <View style={s.recThumb}>
                  <Ionicons name="headset-outline" size={22} color={colors.lav4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.recTit}>{audioRec.titulo}</Text>
                  <Text style={s.recSub}>Áudio · {audioRec.duracao}</Text>
                </View>
                <View style={s.playBtn}>
                  <Ionicons name="play" size={14} color="white" style={{ marginLeft: 2 }} />
                </View>
              </View>
            </TouchableOpacity>
          )}

          {!temPlano1 && (
            <TouchableOpacity style={s.upgradeCard} onPress={() => navigation.navigate('Planos')} activeOpacity={0.85}>
              <Ionicons name="headset-outline" size={20} color={colors.lav4} />
              <Text style={s.upgradeTxt}>Áudios de acolhimento disponíveis no Plano Acolher</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lav4} />
            </TouchableOpacity>
          )}

          <Button title="Voltar ao início" onPress={() => navigation.goBack()} style={{ marginTop: 24, width: '100%' }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <LavandaBg />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Check-in emocional</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.headerBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.headerQ}>Como você está se sentindo hoje?</Text>
              <Text style={s.headerSub}>Sua resposta ajuda a te acolher e a receber conteúdos que fazem sentido para você.</Text>
            </View>
            <Image source={ilustracao} style={s.headerIlustracao} resizeMode="contain" />
          </View>
        </View>

        {/* Grid de emoções */}
        <View style={s.emoGrid}>
          {emocoes.map(e => {
            const selected = emocaoSel === e.id;
            return (
              <TouchableOpacity key={e.id}
                style={[s.emoCard, selected && { borderColor: e.color, backgroundColor: e.bg + '40' }]}
                onPress={() => setEmocaoSel(e.id)} activeOpacity={0.8}>
                <View style={[s.emoIcon, { backgroundColor: e.bg }]}>
                  <Ionicons name={`${e.icon}-outline`} size={24} color={e.color} />
                </View>
                <Text style={[s.emoName, selected && { color: e.color, fontFamily: fonts.bodyBold }]}>{e.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Intensidade */}
        <View style={s.intensSect}>
          <Text style={s.intensTitle}>Intensidade do que você está sentindo</Text>
          <View style={s.intensTrack}>
            {[1,2,3,4,5].map(v => (
              <TouchableOpacity key={v} onPress={() => setIntensidade(v)} style={{ flex: 1 }}>
                <View style={[s.intensBar, intensidade >= v && { backgroundColor: emocaoObj?.color || colors.lav4 }]} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.intensLabels}>
            <Text style={s.intensLbl}>Leve</Text>
            <Text style={[s.intensLbl, { color: emocaoObj?.color || colors.lav5, fontFamily: fonts.bodyBold }]}>{intensLabels[intensidade]}</Text>
            <Text style={s.intensLbl}>Intenso</Text>
          </View>
        </View>

        {/* Mensagem de acolhimento */}
        {mensagemAcolhimento && (
          <View style={s.sect}>
            <View style={s.suggCard}>
              <Text style={s.suggMsg}>{mensagemAcolhimento}</Text>
            </View>
          </View>
        )}

        {/* Conteúdo sugerido */}
        {audioRec && (
          <View style={s.sect}>
            <View style={s.suggCard}>
              <View style={s.suggHeader}>
                <Text style={s.suggTit}>Conteúdos que podem te ajudar agora</Text>
              </View>
              <View style={s.suggRow}>
                <View style={s.suggThumb}>
                  <Ionicons name="headset-outline" size={20} color={colors.lav5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.suggTag}>Áudio · {audioRec.duracao}</Text>
                  <Text style={s.suggName}>{audioRec.titulo}</Text>
                </View>
                <View style={s.playBtnLg}>
                  <Ionicons name="play" size={16} color="white" style={{ marginLeft: 1 }} />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Histórico */}
        <View style={s.sect}>
          <View style={s.histHeader}>
            <Text style={s.sectTitle2}>Seu histórico emocional</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Relatorios')}>
              <Text style={s.histLink}>Ver histórico</Text>
            </TouchableOpacity>
          </View>
          <View style={s.histCard}>
            {/* Linha conectora */}
            <View style={s.histLine} />
            <View style={s.histRow}>
              {historico.map((c, i) => {
                const emoObj = emocoes.find(e => e.id === c.emocao);
                const d = new Date(c.data);
                const yOffset = (5 - c.intensidade) * 5;
                return (
                  <View key={i} style={[s.histPt, { marginTop: yOffset }]}>
                    <View style={[s.histDot, { backgroundColor: emoObj?.color || colors.lav3 }]} />
                    <Text style={s.histLbl}>{d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</Text>
                  </View>
                );
              })}
              <View style={[s.histPt, { marginTop: 5 }]}>
                <View style={[s.histDot, s.histDotHoje]} />
                <Text style={[s.histLbl, { color: colors.lav5, fontFamily: fonts.bodyBold }]}>Hoje</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[s.sect, { paddingBottom: 40 }]}>
          <Button title="Registrar check-in" onPress={handleSalvar} />
        </View>
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
  headerBox: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  headerIlustracao: { width: 72, height: 72, marginLeft: 8, flexShrink: 0 },
  headerQ: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.td, marginBottom: 6 },
  headerSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, lineHeight: 19 },
  emoGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing.lg, gap: 10,
  },
  emoCard: {
    width: '22%', minWidth: 74, flex: 1,
    backgroundColor: 'white', borderRadius: 16,
    paddingVertical: 10, alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#E8E0F0',
  },
  emoIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emoName: { fontFamily: fonts.body, fontSize: 11, color: colors.td, textAlign: 'center' },
  intensSect: { paddingHorizontal: spacing.lg, marginTop: 16, marginBottom: 8 },
  intensTitle: { fontFamily: fonts.body, fontSize: 13, color: colors.td, marginBottom: 10 },
  intensTrack: { flexDirection: 'row', gap: 4 },
  intensBar: { height: 6, borderRadius: 3, backgroundColor: colors.lav1 },
  intensLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  intensLbl: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },
  sect: { paddingHorizontal: spacing.lg, marginTop: 14 },
  sectTitle2: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  suggCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E8E0F0',
    boxShadow: '0px 2px 10px rgba(184,166,201,0.12)',
  },
  suggMsg: { fontFamily: fonts.quote, fontSize: 13, fontStyle: 'italic', color: colors.tm, lineHeight: 20 },
  suggHeader: { marginBottom: 10 },
  suggTit: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.td },
  suggRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggThumb: {
    width: 50, height: 50, borderRadius: 12,
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center',
  },
  suggTag: { fontFamily: fonts.body, fontSize: 10, color: colors.tl },
  suggName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginTop: 2 },
  playBtnLg: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.lav4, alignItems: 'center', justifyContent: 'center',
  },
  histHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  histLink: { fontFamily: fonts.body, fontSize: 11, color: colors.lav5 },
  histCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 14, paddingBottom: 10,
    borderWidth: 1, borderColor: '#E8E0F0', position: 'relative',
  },
  histLine: {
    position: 'absolute', left: 24, right: 24, top: 22,
    height: 2, backgroundColor: colors.lav1, borderRadius: 1,
  },
  histRow: { flexDirection: 'row', justifyContent: 'space-between' },
  histPt: { alignItems: 'center', gap: 4, flex: 1 },
  histDot: { width: 12, height: 12, borderRadius: 6, zIndex: 1 },
  histDotHoje: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.lav4, borderWidth: 2, borderColor: colors.lav5 },
  histLbl: { fontFamily: fonts.body, fontSize: 9, color: colors.tl },
  playBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lav4, alignItems: 'center', justifyContent: 'center' },
  savedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  celebCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  savedTit: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.td, marginBottom: 8, textAlign: 'center' },
  savedSub: { fontFamily: fonts.quote, fontSize: 16, fontStyle: 'italic', color: colors.tm, marginBottom: 8, textAlign: 'center', lineHeight: 24 },
  savedHint: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', lineHeight: 18, marginBottom: 8 },
  recCard: { width: '100%', backgroundColor: colors.lav1, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.lav2, marginTop: 8 },
  recTag: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.lav4, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recThumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.lav2, alignItems: 'center', justifyContent: 'center' },
  recTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td },
  recSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
  upgradeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', backgroundColor: colors.lav1, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.lav2, marginTop: 8 },
  upgradeTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.lav4 },
});
