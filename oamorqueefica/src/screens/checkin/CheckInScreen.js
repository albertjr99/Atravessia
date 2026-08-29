import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Platform, Image,
  Animated, Dimensions,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const CONFETTI_COLORS = ['#8B7AC0', '#D4A89A', '#7A9E7E', '#D4B483', '#B9C8DF', '#C8B4E0', '#F5D6A0'];
const CONFETTI_COUNT = 20;
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { emocoes, audios as audiosEstaticos } from '../../data';
import { Button, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { abrirLink } from '../../utils/abrirLink';

const ilustracao = require('../../../assets/images/il_onda_coracao.png');

const LOCAIS = [
  { id: 'saude', label: 'Saúde física', icon: 'fitness-outline' },
  { id: 'eu', label: 'Eu comigo mesmo(a)', icon: 'person-outline' },
  { id: 'trabalho', label: 'Trabalho e estudos', icon: 'briefcase-outline' },
  { id: 'relacionamentos', label: 'Relacionamentos', icon: 'people-outline' },
];

const TIPO_ICONE = { audio: 'headset-outline', video: 'videocam-outline', documento: 'document-text-outline', link: 'link-outline' };

function ConteudoCard({ c, onPress, isFav, onFav }) {
  return (
    <TouchableOpacity style={s.cCard} onPress={onPress} activeOpacity={0.85}>
      <View style={s.cThumb}>
        <Ionicons name={TIPO_ICONE[c.tipo] || 'document-outline'} size={20} color={colors.lav5} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.cTit} numberOfLines={2}>{c.titulo}</Text>
        {c.descricao ? <Text style={s.cDesc} numberOfLines={1}>{c.descricao}</Text> : null}
      </View>
      <TouchableOpacity onPress={onFav} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={18} color={isFav ? '#C06080' : colors.tl} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function CheckInScreen({ navigation }) {
  const { adicionarCheckin, checkins, podeLiberarNovo, liberarConteudo, jaLiberado, usuario, conteudos, audiosAcolhimento, adicionarFavorito, removerFavorito, isFavorito } = useApp();
  const [emocaoSel, setEmocaoSel] = useState(null);
  const [localSel, setLocalSel] = useState(null);
  const [salvo, setSalvo] = useState(false);
  const [audioLiberado, setAudioLiberado] = useState(false);

  const confettiAnims = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => ({
      y: new Animated.Value(-30),
      rot: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    if (!salvo || !emocaoObj?.positiva) return;
    confettiAnims.forEach(a => { a.y.setValue(-30); a.rot.setValue(0); a.opacity.setValue(1); });
    const animations = confettiAnims.map((a, i) =>
      Animated.parallel([
        Animated.timing(a.y, { toValue: 750, duration: 1200 + (i % 5) * 160, useNativeDriver: true }),
        Animated.timing(a.rot, { toValue: 1, duration: 1700, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(900),
          Animated.timing(a.opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ])
    );
    Animated.stagger(55, animations).start();
  }, [salvo]);

  const hojeStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const jaFezCheckinHoje = checkins.some(c => c.data === hojeStr);
  const historico = checkins.slice(-7);
  const emocaoObj = emocaoSel ? emocoes.find(e => e.id === emocaoSel) : null;
  const fonteAudios = audiosAcolhimento.filter(a => a.ativo !== false).length > 0
    ? audiosAcolhimento.filter(a => a.ativo !== false)
    : audiosEstaticos;

  // Índice aleatório fixado por sessão para evitar repetição entre check-ins consecutivos
  const randomIdxRef = useRef({});

  const audioRec = useMemo(() => {
    if (!emocaoSel || !emocaoObj || emocaoObj.positiva) return null;
    const candidatos = fonteAudios.filter(a =>
      (a.emocoes || []).includes(emocaoSel) && (a.plano || 0) <= 1
    );
    const pool = candidatos.length > 0 ? candidatos : fonteAudios.filter(a => (a.emocoes || []).includes(emocaoSel));
    if (pool.length === 0) return null;
    const key = `audio_${emocaoSel}`;
    if (randomIdxRef.current[key] === undefined) {
      randomIdxRef.current[key] = Math.floor(Math.random() * pool.length);
    }
    return pool[randomIdxRef.current[key] % pool.length];
  }, [emocaoSel, emocaoObj, fonteAudios]);

  const handleSalvar = () => {
    if (!emocaoSel) { Alert.alert('', 'Selecione como você está.'); return; }
    adicionarCheckin(emocaoSel, localSel);
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

  // Favoritar o áudio guardando o id REAL do documento. Antes era salvo como
  // `audio-<id>`, um id sintético que não existia em nenhuma coleção — por isso
  // o áudio favoritado nunca aparecia na aba Conteúdos.
  const toggleFavAudio = (audio) => {
    if (!audio?.id) return;
    isFavorito(audio.id) ? removerFavorito(audio.id) : adicionarFavorito(audio);
  };

  const temPlano1 = (usuario?.plano || 0) >= 1;

  // Conteúdos do Firestore vinculados à emoção
  const conteudosSugeridos = useMemo(
    () => emocaoSel ? (conteudos || []).filter(c => (c.emocoes || []).includes(emocaoSel)) : [],
    [emocaoSel, conteudos]
  );

  const conteudoExibido = useMemo(() => {
    if (!emocaoSel || conteudosSugeridos.length === 0) return null;
    if (randomIdxRef.current[emocaoSel] === undefined) {
      randomIdxRef.current[emocaoSel] = Math.floor(Math.random() * conteudosSugeridos.length);
    }
    return conteudosSugeridos[randomIdxRef.current[emocaoSel] % conteudosSugeridos.length];
  }, [emocaoSel, conteudosSugeridos]);

  const handleAbrirConteudo = (c) => {
    if (c.tipo === 'documento' || c.tipo === 'link') {
      abrirLink(c.url || c.link);
      return;
    }
    navigation.navigate('AudioPlayer', { audio: { id: c.id, titulo: c.titulo, descricao: c.descricao, duracao: c.duracao, categoria: c.grupo, plano: c.plano, tipo: c.tipo, url: c.url } });
  };

  if (jaFezCheckinHoje && !salvo) {
    return (
      <SafeAreaView style={s.safe}>
        <LavandaBg />
        <View style={s.savedWrap}>
          <View style={[s.celebCircle, { backgroundColor: colors.lav2 }]}>
            <Ionicons name="checkmark-circle" size={48} color={colors.lav4} />
          </View>
          <Text style={s.savedTit}>Check-in já registrado 💜</Text>
          <Text style={s.savedSub}>Você já registrou seu check-in hoje. Volte amanhã para continuar seu acompanhamento emocional.</Text>
          <Button title="Voltar ao início" onPress={() => navigation.goBack()} style={{ marginTop: 24, width: '100%' }} />
        </View>
      </SafeAreaView>
    );
  }

  if (salvo) {
    // POSITIVO: confetti + conteúdos admin vinculados (se houver)
    if (emocaoObj?.positiva) {
      return (
        <SafeAreaView style={s.safe}>
          <LavandaBg />
          {/* Confetti overlay */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {confettiAnims.map((a, i) => {
              const xPos = (SCREEN_W / (CONFETTI_COUNT + 1)) * (i + 1);
              const size = 8 + (i % 4) * 2;
              return (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: xPos - size / 2,
                    width: size,
                    height: size,
                    backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                    borderRadius: i % 3 === 0 ? size / 2 : 2,
                    transform: [
                      { translateY: a.y },
                      { rotate: a.rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] }) },
                    ],
                    opacity: a.opacity,
                  }}
                />
              );
            })}
          </View>
          <ScrollView contentContainerStyle={s.savedWrap} showsVerticalScrollIndicator={false}>
            <View style={s.celebCircle}>
              <Ionicons name="sparkles" size={48} color={colors.gold} />
            </View>
            <Text style={s.savedTit}>Que bom saber disso! 💜</Text>
            <Text style={s.savedHint}>Continue se cuidando. Voltamos amanhã para o próximo check-in.</Text>
            {conteudoExibido && (
              <View style={s.sugestaoBloco}>
                <Text style={s.sugestaoTit}>Conteúdo para você</Text>
                <ConteudoCard c={conteudoExibido} onPress={() => handleAbrirConteudo(conteudoExibido)} isFav={isFavorito(conteudoExibido.id)} onFav={() => isFavorito(conteudoExibido.id) ? removerFavorito(conteudoExibido.id) : adicionarFavorito(conteudoExibido)} />
                <TouchableOpacity style={s.verConteudosLink} onPress={() => navigation.navigate('Audios')}>
                  <Text style={s.verConteudosLinkTxt}>Ver todos os conteúdos</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.lav4} />
                </TouchableOpacity>
              </View>
            )}
            <Button title="Voltar ao início" onPress={() => navigation.goBack()} style={{ marginTop: 24, width: '100%' }} />
          </ScrollView>
        </SafeAreaView>
      );
    }

    // NEGATIVO: mensagem de acolhimento + conteúdos admin + áudio estático (fallback)
    return (
      <SafeAreaView style={s.safe}>
        <LavandaBg />
        <ScrollView contentContainerStyle={s.savedWrap} showsVerticalScrollIndicator={false}>
          <View style={[s.celebCircle, { backgroundColor: colors.lav2 }]}>
            <Ionicons name="heart" size={40} color={colors.lav4} />
          </View>
          <Text style={s.savedTit}>Check-in registrado</Text>

          {conteudoExibido && (
            <View style={s.sugestaoBloco}>
              <Text style={s.sugestaoTit}>Conteúdo para você agora</Text>
              <ConteudoCard c={conteudoExibido} onPress={() => handleAbrirConteudo(conteudoExibido)} isFav={isFavorito(conteudoExibido.id)} onFav={() => isFavorito(conteudoExibido.id) ? removerFavorito(conteudoExibido.id) : adicionarFavorito(conteudoExibido)} />
              <TouchableOpacity style={s.verConteudosLink} onPress={() => navigation.navigate('Audios')}>
                <Text style={s.verConteudosLinkTxt}>Ver todos os conteúdos</Text>
                <Ionicons name="arrow-forward" size={12} color={colors.lav4} />
              </TouchableOpacity>
            </View>
          )}

          {!conteudoExibido && temPlano1 && audioRec && (
            <View style={s.recCard}>
              <View style={s.recTagRow}>
                <Text style={s.recTag}>Acolhimento</Text>
                <TouchableOpacity
                  onPress={() => toggleFavAudio(audioRec)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={isFavorito(audioRec.id) ? 'heart' : 'heart-outline'}
                    size={18}
                    color={isFavorito(audioRec.id) ? '#C06080' : colors.tl}
                  />
                </TouchableOpacity>
              </View>
              {!isFavorito(audioRec.id) && (
                <Text style={s.recFavHint}>Toque no ♡ para salvar em Conteúdos</Text>
              )}
              <TouchableOpacity onPress={handleOuvirAudio} activeOpacity={0.85}>
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
            </View>
          )}

          {!conteudoExibido && !temPlano1 && (
            <TouchableOpacity style={s.upgradeCard} onPress={() => navigation.navigate('Planos')} activeOpacity={0.85}>
              <Ionicons name="headset-outline" size={20} color={colors.lav4} />
              <Text style={s.upgradeTxt}>Áudios de acolhimento disponíveis no Plano Acolher</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lav4} />
            </TouchableOpacity>
          )}

          <Button title="Voltar ao início" onPress={() => navigation.goBack()} style={{ marginTop: 24, width: '100%' }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
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
                <Text style={[s.emoName, selected && { color: e.color, fontFamily: fonts.bodyBold }]} numberOfLines={2} adjustsFontSizeToFit>{e.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Pergunta sobre onde o sentimento está presente */}
        {emocaoSel && (
          <View style={s.sect}>
            <Text style={s.sectTitle2}>Onde esse sentimento esteve mais presente?</Text>
            <Text style={[s.headerSub, { marginBottom: 10, marginTop: 4 }]}>Opcional — ajuda a personalizar seu acompanhamento.</Text>
            <View style={s.localGrid}>
              {LOCAIS.map(l => {
                const sel = localSel === l.id;
                return (
                  <TouchableOpacity
                    key={l.id}
                    style={[s.localCard, sel && { borderColor: colors.lav4, backgroundColor: colors.lav1 }]}
                    onPress={() => setLocalSel(sel ? null : l.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={l.icon} size={20} color={sel ? colors.lav4 : colors.tl} />
                    <Text style={[s.localLabel, sel && { color: colors.lav5, fontFamily: fonts.bodyBold }]}>{l.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Conteúdo sugerido (pré-save) */}
        {(conteudoExibido || audioRec) && (
          <View style={s.sect}>
            <View style={s.suggCard}>
              <View style={s.suggHeader}>
                <Text style={s.suggTit}>Conteúdo para te acompanhar</Text>
                {conteudoExibido ? (
                  <TouchableOpacity
                    onPress={() => isFavorito(conteudoExibido.id) ? removerFavorito(conteudoExibido.id) : adicionarFavorito(conteudoExibido)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={isFavorito(conteudoExibido.id) ? 'heart' : 'heart-outline'}
                      size={20}
                      color={isFavorito(conteudoExibido.id) ? '#C06080' : colors.tl}
                    />
                  </TouchableOpacity>
                ) : audioRec ? (
                  <TouchableOpacity
                    onPress={() => toggleFavAudio(audioRec)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={isFavorito(audioRec.id) ? 'heart' : 'heart-outline'}
                      size={20}
                      color={isFavorito(audioRec.id) ? '#C06080' : colors.tl}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => conteudoExibido ? handleAbrirConteudo(conteudoExibido) : handleOuvirAudio()}
                activeOpacity={0.85}
              >
                {conteudoExibido ? (
                  <View style={s.suggRow}>
                    <View style={s.suggThumb}>
                      <Ionicons name={TIPO_ICONE[conteudoExibido.tipo] || 'document-outline'} size={20} color={colors.lav5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.suggTag}>{conteudoExibido.tipo}</Text>
                      <Text style={s.suggName}>{conteudoExibido.titulo}</Text>
                    </View>
                    <View style={s.playBtnLg}>
                      <Ionicons name="arrow-forward" size={16} color="white" />
                    </View>
                  </View>
                ) : (
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
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.verConteudosLink} onPress={() => navigation.navigate('Audios')}>
              <Text style={s.verConteudosLinkTxt}>Ver todos os conteúdos</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.lav4} />
            </TouchableOpacity>
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
                const yOffset = 0;
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
    width: '22%', minWidth: 74,
    backgroundColor: 'white', borderRadius: 16,
    paddingVertical: 10, alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#E8E0F0',
  },
  emoIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emoName: { fontFamily: fonts.body, fontSize: 11, color: colors.td, textAlign: 'center' },
  sect: { paddingHorizontal: spacing.lg, marginTop: 14 },
  sectTitle2: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  suggCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E8E0F0',
    boxShadow: '0px 2px 10px rgba(184,166,201,0.12)',
  },
  suggMsg: { fontFamily: fonts.quote, fontSize: 13, fontStyle: 'italic', color: colors.tm, lineHeight: 20 },
  suggHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
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
  recTagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  recTag: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.lav4, textTransform: 'uppercase', letterSpacing: 0.5 },
  recFavHint: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginBottom: 8 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recThumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.lav2, alignItems: 'center', justifyContent: 'center' },
  recTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td },
  recSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
  upgradeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', backgroundColor: colors.lav1, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.lav2, marginTop: 8 },
  upgradeTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.lav4 },
  verConteudosLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 8 },
  verConteudosLinkTxt: { fontFamily: fonts.body, fontSize: 11, color: colors.lav4 },
  localGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  localCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'white', borderRadius: 12, borderWidth: 1.5, borderColor: '#E8E0F0',
    paddingVertical: 10, paddingHorizontal: 12, width: '48%',
  },
  localLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.td, flex: 1 },
  sugestaoBloco: { width: '100%', marginTop: 16, gap: 8 },
  sugestaoTit: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.tm, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  cCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.lav1, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.lav2 },
  cThumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.lav2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cTit: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  cDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
});
