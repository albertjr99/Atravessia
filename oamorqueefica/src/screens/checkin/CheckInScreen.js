import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Platform, Image,
  Animated, useWindowDimensions,
} from 'react-native';

// Confete nas cores dos dados de emoção (Luz de Vidro).
const CONFETTI_COLORS = ['#A595DC', '#E39A72', '#6E9B7E', '#C9A15A', '#7F9BCB', '#D682A0', '#F2B9A0'];
const CONFETTI_COUNT = 20;
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { emocoes, audios as audiosEstaticos } from '../../data';
import { LavandaBg } from '../../components';
import { DicaTravessinho, useComemoracaoTravessinho } from '../../components/Travessinho';
import { Profundo } from '../../components/Efeitos';
import { useApp } from '../../hooks/AppContext';
import { abrirLink } from '../../utils/abrirLink';
import { ProximoPasso } from '../../components/DiarioDoDia';
import { BotaoFavoritar, AvisoRapido, useAvisoRapido, acaoDoConteudo } from '../../components/Favoritar';
import { useAuth } from '../../hooks/AuthContext';
import { vibrarLeve, vibrarSucesso } from '../../utils/vibrar';
import {
  carregarHistoricoSugestoes, registrarSugestoes, escolherSugestao, camadasPorEmocao, historicoParaPerfil,
} from '../../utils/sugestoes';
import { ehAcolhimento } from '../../utils/diario';

const ilustracao = require('../../../assets/images/il_onda_coracao.png');

const LOCAIS = [
  { id: 'saude', label: 'Saúde física', icon: 'fitness-outline' },
  { id: 'eu', label: 'Eu comigo mesmo(a)', icon: 'person-outline' },
  { id: 'trabalho', label: 'Trabalho e estudos', icon: 'briefcase-outline' },
  { id: 'relacionamentos', label: 'Relacionamentos', icon: 'people-outline' },
];

const TIPO_ICONE = { audio: 'headset-outline', video: 'videocam-outline', documento: 'document-text-outline', link: 'link-outline', imagem: 'image-outline', texto: 'document-text-outline' };

// Cores da "gota" de cada emoção: véu (fundo) e tinta (ícone). No noturno o
// véu claro vira um véu translúcido da cor do dado, e a tinta fica mais clara.
const veuEmo = (e) => (colors.escuro ? `${e?.dado || e?.color || '#A595DC'}33` : (e?.bg || colors.lav1));
const tintaEmo = (e) => (colors.escuro ? (e?.dado || e?.color) : e?.color) || colors.lilasIcone;

// Ilustração da marca numa moldura arredondada (sem tintColor). A imagem é
// um pouco maior que a moldura para esconder os cantos claros do arquivo.
function Moldura({ source, tamanho = 72 }) {
  const extra = Math.round(tamanho * 0.1);
  return (
    <View style={[s.moldura, { width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.26) }]}>
      <Image
        source={source}
        style={{ width: tamanho + extra * 2, height: tamanho + extra * 2, margin: -extra }}
        resizeMode="cover"
      />
    </View>
  );
}

// Botão principal "Luz de Vidro": degradê lilás com degrau que afunda ao toque.
function BotaoLuz({ titulo, onPress, icone, style }) {
  return (
    <Profundo
      externo={[s.btnExterno, style]}
      estilo={s.btnFace}
      base={colors.botaoBase}
      sombra={s.btnHalo}
      onPress={onPress}
      accessibilityLabel={titulo}
    >
      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={s.btnTxt}>{titulo}</Text>
      {icone ? <Ionicons name={icone} size={18} color="white" /> : null}
    </Profundo>
  );
}

function ConteudoCard({ c, onPress, isFav, onFav }) {
  const acao = acaoDoConteudo(c, false);
  return (
    <TouchableOpacity style={s.cCard} onPress={onPress} activeOpacity={0.85}>
      <View style={s.cLinha}>
        <View style={s.cThumb}>
          <Ionicons name={TIPO_ICONE[c.tipo] || 'document-outline'} size={21} color={colors.lilasIcone} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cTit} numberOfLines={2}>{c.titulo}</Text>
          {c.descricao ? <Text style={s.cDesc} numberOfLines={2}>{c.descricao}</Text> : null}
        </View>
      </View>
      {/* Rodapé: o que o toque abre (ex.: "Ler texto completo") + Favoritar. */}
      <View style={s.cRodape}>
        <View style={s.cAcao}>
          <Ionicons name={acao.icone} size={15} color={colors.lilasTexto} />
          <Text style={s.cAcaoTxt} numberOfLines={1}>{acao.rotulo}</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.lilasTexto} />
        </View>
        <BotaoFavoritar favoritado={isFav} onPress={onFav} />
      </View>
    </TouchableOpacity>
  );
}

const totalCamadas = (camadas) => (camadas || []).reduce((n, l) => n + (l?.length || 0), 0);

export default function CheckInScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  // Grade de emoções: 4 por linha no celular, até 7 no tablet.
  const { width: larguraTela } = useWindowDimensions();
  const colunasEmo = Math.max(4, Math.min(7, Math.floor((larguraTela - 64) / 96)));
  const { adicionarCheckin, checkins, podeLiberarNovo, liberarConteudo, jaLiberado, usuario, conteudos, audiosAcolhimento, adicionarFavorito, removerFavorito, isFavorito, temAcesso, conteudosLiberados, liberadoHoje } = useApp();
  const liberadoHojeAcolhimento = liberadoHoje?.('acolhimento') === true;
  const { firebaseUser, perfil, atualizarPerfil } = useAuth();
  const uid = firebaseUser?.uid;
  // Histórico das sugestões já mostradas, para não repetir o mesmo conteúdo
  // em dias seguidos.
  const [historicoSug, setHistoricoSug] = useState([]);
  useEffect(() => {
    let vivo = true;
    carregarHistoricoSugestoes(uid, perfil?.sugestoesRecentes).then(h => { if (vivo) setHistoricoSug(h); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Guarda as sugestões mostradas (no aparelho e no perfil) e atualiza a tela.
  const guardarSugestoes = async (entradas) => {
    const h = await registrarSugestoes(uid, historicoSug, entradas);
    if (!h) return;
    setHistoricoSug(h);
    atualizarPerfil?.({ sugestoesRecentes: historicoParaPerfil(h) })
      .catch(e => console.warn('[Sugestões] perfil:', e?.message));
  };
  // A emoção pode vir escolhida do Início (toque direto no cartão principal).
  const [emocaoSel, setEmocaoSel] = useState(() => (emocoes.some(e => e.id === route?.params?.emocao) ? route.params.emocao : null));
  const [localSel, setLocalSel] = useState(null);
  const [salvo, setSalvo] = useState(false);
  const { comemorar, elemento: festaTravessinho } = useComemoracaoTravessinho({ duracao: 3600 });
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

  // Áudios já liberados em dias anteriores, do mais antigo ao mais recente.
  const audiosJaOuvidos = useMemo(() => (conteudosLiberados || [])
    .filter(c => c.grupo === 'acolhimento' && c.data !== hojeStr)
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')))
    .map(c => c.id), [conteudosLiberados, hojeStr]);

  const audioRec = useMemo(() => {
    if (!emocaoSel || !emocaoObj || emocaoObj.positiva) return null;
    // Todos os áudios que ela pode ouvir (ou que o Plano Acolher libera), da
    // própria emoção e, se forem poucos, de emoções próximas.
    const acessiveis = fonteAudios.filter(a => (a.plano || 0) <= 1 || temAcesso(a.plano || 0));
    return escolherSugestao(camadasPorEmocao(acessiveis, emocaoSel), {
      historico: historicoSug, tipo: 'audio', emocao: emocaoSel, hoje: hojeStr, vistosExtras: audiosJaOuvidos,
    });
  }, [emocaoSel, emocaoObj, fonteAudios, historicoSug, hojeStr, audiosJaOuvidos]);

  const handleSalvar = () => {
    if (!emocaoSel) { Alert.alert('', 'Selecione como você está.'); return; }
    adicionarCheckin(emocaoSel, localSel);
    vibrarSucesso();
    setSalvo(true);
    comemorar('nanda', emocaoObj?.positiva
      ? 'Check-in feito! Que alegria ver você se cuidando hoje.'
      : 'Obrigada por parar um minutinho para se escutar. Estou aqui com você.');
  };

  const handleOuvirAudio = () => {
    if (!audioRec) return;
    // Plano gratuito: o áudio é visível, mas não reproduz.
    if (!temAcesso(1)) {
      Alert.alert(
        'Disponível no Plano Acolher',
        'A reprodução dos áudios de acolhimento faz parte do Plano Acolher. Deseja conhecer os planos?',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Ver planos', onPress: () => navigation.navigate('Planos') },
        ]
      );
      return;
    }
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
  const { aviso, mostrar, fechar } = useAvisoRapido();
  // Favoritar/desfavoritar com aviso curto, para ficar claro o que o coração faz.
  const alternarFavorito = (item) => {
    if (!item?.id) return;
    if (isFavorito(item.id)) {
      removerFavorito(item.id);
      mostrar({ texto: 'Tirado dos seus Favoritos', icone: 'heart-outline' });
    } else {
      adicionarFavorito(item);
      mostrar({
        texto: 'Guardado nos seus Favoritos',
        icone: 'heart',
        acao: { rotulo: 'Ver', onPress: () => navigation.navigate('Favoritos') },
      });
    }
  };
  const toggleFavAudio = alternarFavorito;

  const temPlano1 = temAcesso(1);

  // Conteúdos do Firestore vinculados à emoção
  const conteudosSugeridos = useMemo(
    // `ativo === false` = desativado no painel; itens antigos sem o campo contam como ativos.
    () => emocaoSel ? (conteudos || []).filter(c => c.ativo !== false && (c.emocoes || []).includes(emocaoSel)) : [],
    [emocaoSel, conteudos]
  );
  // Camadas: conteúdos da emoção e, se forem poucos, de emoções próximas.
  // Emoção positiva: nada de acolhimento (áudios ou conteúdos de acolhimento).
  const camadasConteudo = useMemo(
    () => emocaoSel
      ? camadasPorEmocao((conteudos || []).filter(c => c.ativo !== false && !(emocaoObj?.positiva && ehAcolhimento(c))), emocaoSel)
      : [[]],
    [emocaoSel, emocaoObj, conteudos]
  );

  const conteudoExibido = useMemo(() => {
    if (!emocaoSel || totalCamadas(camadasConteudo) === 0) return null;
    return escolherSugestao(camadasConteudo, {
      historico: historicoSug, tipo: 'conteudo', emocao: emocaoSel, hoje: hojeStr,
    });
  }, [emocaoSel, conteudosSugeridos, camadasConteudo, historicoSug, hojeStr]);

  // "Ver outra sugestão": troca pelo próximo item ainda não visto.
  const trocarSugestao = (tipo) => {
    const ehAudio = tipo === 'audio';
    const acessiveis = fonteAudios.filter(a => (a.plano || 0) <= 1 || temAcesso(a.plano || 0));
    const camadas = ehAudio ? camadasPorEmocao(acessiveis, emocaoSel) : camadasConteudo;
    const novo = escolherSugestao(camadas, {
      historico: historicoSug, tipo, emocao: emocaoSel, hoje: hojeStr, trocar: true,
      vistosExtras: ehAudio ? audiosJaOuvidos : [],
    });
    if (novo) guardarSugestoes([{ id: novo.id, tipo, emocao: emocaoSel, data: hojeStr }]);
  };
  const totalOpcoes = (camadas) => new Set(camadas.flat().map(i => i.id)).size;
  const podeTrocarConteudo = totalOpcoes(camadasConteudo) > 1;
  const podeTrocarAudio = emocaoSel ? totalOpcoes(camadasPorEmocao(
    fonteAudios.filter(a => (a.plano || 0) <= 1 || temAcesso(a.plano || 0)), emocaoSel,
  )) > 1 : false;

  // Ao registrar o check-in, guarda o que foi sugerido hoje: amanhã a escolha
  // evita estes itens.
  useEffect(() => {
    if (!salvo || !emocaoSel) return;
    guardarSugestoes([
      audioRec && { id: audioRec.id, tipo: 'audio', emocao: emocaoSel, data: hojeStr },
      conteudoExibido && { id: conteudoExibido.id, tipo: 'conteudo', emocao: emocaoSel, data: hojeStr },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salvo]);

  const handleAbrirConteudo = (c) => {
    // Imagem e texto abrem na tela de leitura (que também trata o plano).
    // Link com descrição (ex.: a história de uma música) também abre na tela
    // de leitura, para o texto aparecer inteiro; o link abre pelo botão.
    const linkComTexto = c.tipo === 'link' && !!String(c.descricao || '').trim();
    if (c.tipo === 'imagem' || c.tipo === 'texto' || linkComTexto) {
      navigation.navigate('Conteudo', { conteudo: { id: c.id, titulo: c.titulo, descricao: c.descricao, tipo: c.tipo, url: c.url, texto: c.texto, plano: c.plano } });
      return;
    }
    if (c.tipo === 'documento' || c.tipo === 'link') {
      abrirLink(c.url || c.link);
      return;
    }
    navigation.navigate('AudioPlayer', { audio: { id: c.id, titulo: c.titulo, descricao: c.descricao, duracao: c.duracao, categoria: c.grupo, plano: c.plano, tipo: c.tipo, url: c.url } });
  };

  if (jaFezCheckinHoje && !salvo) {
    return (
      <SafeAreaView style={s.safe} edges={['left', 'right']}>
        <LavandaBg />
        <ScrollView contentContainerStyle={[s.savedWrap, { paddingTop: insets.top + 28 }]} showsVerticalScrollIndicator={false}>
          <View style={s.celebCircle}>
            <Ionicons name="checkmark-circle-outline" size={46} color={colors.lilasIcone} />
          </View>
          <Text style={s.savedTit}>Check-in já registrado 💜</Text>
          <Text style={s.savedSub}>Você já registrou seu check-in hoje. Volte amanhã para continuar seu acompanhamento emocional.</Text>
          {/* Sugestão opcional do próximo passo do dia (some com "Agora não"). */}
          <ProximoPasso navigation={navigation} depoisDe="checkin" />
          <BotaoLuz titulo="Voltar ao início" onPress={() => navigation.goBack()} style={{ marginTop: 24 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (salvo) {
    // POSITIVO: confetti + conteúdos admin vinculados (se houver)
    if (emocaoObj?.positiva) {
      return (
        <SafeAreaView style={s.safe} edges={['left', 'right']}>
          <LavandaBg />
          {/* Confetti overlay */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {confettiAnims.map((a, i) => {
              const xPos = (larguraTela / (CONFETTI_COUNT + 1)) * (i + 1);
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
          <ScrollView contentContainerStyle={[s.savedWrap, { paddingTop: insets.top + 28 }]} showsVerticalScrollIndicator={false}>
            <View style={[s.celebCircle, s.celebDourado]}>
              <Ionicons name="sparkles-outline" size={46} color={colors.escuro ? '#E5C68B' : '#9A6B1F'} />
            </View>
            <Text style={s.savedTit}>Que bom saber disso! 💜</Text>
            <Text style={s.savedHint}>Continue se cuidando. Voltamos amanhã para o próximo check-in.</Text>
            {conteudoExibido && (
              <View style={s.sugestaoBloco}>
                <Text style={s.sugestaoTit}>Conteúdo para você</Text>
                <ConteudoCard c={conteudoExibido} onPress={() => handleAbrirConteudo(conteudoExibido)} isFav={isFavorito(conteudoExibido.id)} onFav={() => alternarFavorito(conteudoExibido)} />
                <View style={s.sugestaoAcoes}>
                  {podeTrocarConteudo && (
                    <TouchableOpacity style={s.verConteudosLink} onPress={() => trocarSugestao('conteudo')}>
                      <Ionicons name="shuffle" size={14} color={colors.lilasTexto} />
                      <Text style={s.verConteudosLinkTxt}>Ver outra sugestão</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.verConteudosLink} onPress={() => navigation.navigate('Audios')}>
                    <Text style={s.verConteudosLinkTxt}>Ver todos os conteúdos</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.lilasTexto} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <ProximoPasso navigation={navigation} depoisDe="checkin" />
            <BotaoLuz titulo="Voltar ao início" onPress={() => navigation.goBack()} style={{ marginTop: 24 }} />
          </ScrollView>
          <AvisoRapido aviso={aviso} onFechar={fechar} inferior={insets.bottom} />
          {festaTravessinho}
        </SafeAreaView>
      );
    }

    // NEGATIVO: mensagem de acolhimento + conteúdos admin + áudio estático (fallback)
    return (
      <SafeAreaView style={s.safe} edges={['left', 'right']}>
        <LavandaBg />
        <ScrollView contentContainerStyle={[s.savedWrap, { paddingTop: insets.top + 28 }]} showsVerticalScrollIndicator={false}>
          <View style={s.celebCircle}>
            <Ionicons name="heart-outline" size={42} color={colors.lilasIcone} />
          </View>
          <Text style={s.savedTit}>Check-in registrado</Text>

          {conteudoExibido && (
            <View style={s.sugestaoBloco}>
              <Text style={s.sugestaoTit}>Conteúdo para você agora</Text>
              <ConteudoCard c={conteudoExibido} onPress={() => handleAbrirConteudo(conteudoExibido)} isFav={isFavorito(conteudoExibido.id)} onFav={() => alternarFavorito(conteudoExibido)} />
              <View style={s.sugestaoAcoes}>
                {podeTrocarConteudo && (
                  <TouchableOpacity style={s.verConteudosLink} onPress={() => trocarSugestao('conteudo')}>
                    <Ionicons name="shuffle" size={14} color={colors.lilasTexto} />
                    <Text style={s.verConteudosLinkTxt}>Ver outra sugestão</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.verConteudosLink} onPress={() => navigation.navigate('Audios')}>
                  <Text style={s.verConteudosLinkTxt}>Ver todos os conteúdos</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.lilasTexto} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* O áudio aparece em qualquer plano (agora também junto com o
              conteúdo). No gratuito ele fica visível mas bloqueado: sem opção de
              salvar e sem reprodução — ao tocar, explica em que plano o recurso
              está disponível. */}
          {audioRec && (
            <View style={[s.recCard, !temPlano1 && s.recCardBloqueado]}>
              <View style={s.recTagRow}>
                <Text style={s.recTag}>Acolhimento</Text>
                {temPlano1 ? (
                  <BotaoFavoritar favoritado={isFavorito(audioRec.id)} onPress={() => toggleFavAudio(audioRec)} />
                ) : (
                  <View style={s.recLockTag}>
                    <Ionicons name="lock-closed" size={11} color={colors.lilasTexto} />
                    <Text style={s.recLockTxt}>Plano Acolher</Text>
                  </View>
                )}
              </View>

              {temPlano1 && !isFavorito(audioRec.id) && (
                <Text style={s.recFavHint}>Toque em ♡ Favoritar para guardar nos seus Favoritos</Text>
              )}

              <TouchableOpacity onPress={handleOuvirAudio} activeOpacity={0.85}>
                <View style={s.recRow}>
                  <View style={s.recThumb}>
                    <Ionicons
                      name={temPlano1 ? 'headset-outline' : 'lock-closed-outline'}
                      size={23}
                      color={temPlano1 ? colors.lilasIcone : colors.tl}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recTit}>{audioRec.titulo}</Text>
                    <Text style={s.recSub}>
                      {temPlano1 ? `Áudio · ${audioRec.duracao}` : 'Disponível no Plano Acolher'}
                    </Text>
                  </View>
                  <View style={[s.playBtn, !temPlano1 && s.playBtnBloqueado]}>
                    {temPlano1 && (
                      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                    )}
                    <Ionicons
                      name={temPlano1 ? 'play' : 'lock-closed'}
                      size={16}
                      color="white"
                      style={temPlano1 && { marginLeft: 2 }}
                    />
                  </View>
                </View>
              </TouchableOpacity>

              {temPlano1 && podeTrocarAudio && !audioLiberado && !liberadoHojeAcolhimento && (
                <TouchableOpacity style={s.trocarAudio} onPress={() => trocarSugestao('audio')}>
                  <Ionicons name="shuffle" size={14} color={colors.lilasTexto} />
                  <Text style={s.verConteudosLinkTxt}>Ver outro áudio</Text>
                </TouchableOpacity>
              )}

              {!temPlano1 && (
                <TouchableOpacity
                  style={s.recUpgradeLink}
                  onPress={() => navigation.navigate('Planos')}
                  activeOpacity={0.8}
                >
                  <Text style={s.recUpgradeTxt}>Conhecer o Plano Acolher</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.lilasTexto} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {!conteudoExibido && !audioRec && !temPlano1 && (
            <TouchableOpacity style={s.upgradeCard} onPress={() => navigation.navigate('Planos')} activeOpacity={0.85}>
              <View style={s.cThumb}>
                <Ionicons name="headset-outline" size={21} color={colors.lilasIcone} />
              </View>
              <Text style={s.upgradeTxt}>Áudios de acolhimento disponíveis no Plano Acolher</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.lilasTexto} />
            </TouchableOpacity>
          )}

          <ProximoPasso navigation={navigation} depoisDe="checkin" />

          <BotaoLuz titulo="Voltar ao início" onPress={() => navigation.goBack()} style={{ marginTop: 24 }} />
        </ScrollView>
        <AvisoRapido aviso={aviso} onFechar={fechar} inferior={insets.bottom} />
        {festaTravessinho}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.titulo} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Check-in emocional</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <DicaTravessinho
          chave="checkin"
          quem="nanda"
          fala="Não existe resposta certa por aqui. Escolha o que estiver mais perto do que você sente agora, e eu sugiro algo para acolher você."
        />
        {/* Pergunta + grade de emoções em "gotas" */}
        <View style={s.cartao}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.headerQ}>Como você está se sentindo hoje?</Text>
              <Text style={s.headerSub}>Sua resposta ajuda a te acolher e a receber conteúdos que fazem sentido para você.</Text>
            </View>
            <Moldura source={ilustracao} tamanho={72} />
          </View>

          <View style={s.emoGrid}>
            {emocoes.map(e => {
              const selected = emocaoSel === e.id;
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[s.gota, { width: `${100 / colunasEmo}%` }]}
                  onPress={() => { vibrarLeve(); setEmocaoSel(e.id); }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={e.label}
                >
                  <View style={[s.gotaAnel, selected && s.gotaAnelSel]}>
                    <View style={[s.gotaOrbe, { backgroundColor: veuEmo(e) }]}>
                      <Ionicons name={`${e.icon}-outline`} size={26} color={tintaEmo(e)} />
                    </View>
                  </View>
                  <Text
                    style={[s.emoName, selected && s.emoNameSel]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {e.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Pergunta sobre onde o sentimento está presente */}
        {emocaoSel && (
          <View style={s.cartao}>
            <Text style={s.sectTitle2}>Onde esse sentimento esteve/está mais presente hoje?</Text>
            <Text style={[s.headerSub, { marginBottom: 12, marginTop: 4 }]}>Opcional — ajuda a personalizar seu acompanhamento.</Text>
            <View style={s.localGrid}>
              {LOCAIS.map(l => {
                const sel = localSel === l.id;
                return (
                  <TouchableOpacity
                    key={l.id}
                    style={[s.localCard, sel && s.localCardSel]}
                    onPress={() => setLocalSel(sel ? null : l.id)}
                    activeOpacity={0.8}
                    accessibilityState={{ selected: sel }}
                  >
                    <View style={[s.localIcone, sel && s.localIconeSel]}>
                      <Ionicons name={l.icon} size={19} color={sel ? colors.white : colors.lilasIcone} />
                    </View>
                    <Text style={[s.localLabel, sel && s.localLabelSel]}>{l.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* A sugestão de acolhimento e a opção de salvar aparecem somente
            DEPOIS do check-in ser registrado (bloco acima, em `salvo`). */}

        {/* Histórico */}
        <View style={s.cartao}>
          <View style={s.histHeader}>
            <Text style={s.sectTitle2}>Seu histórico emocional</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Relatorios')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
                    <View style={[s.histDot, { backgroundColor: emoObj?.dado || emoObj?.color || colors.lav3 }]} />
                    <Text style={s.histLbl}>{d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</Text>
                  </View>
                );
              })}
              <View style={s.histPt}>
                <View style={[s.histDot, s.histDotHoje]} />
                <Text style={[s.histLbl, s.histLblHoje]}>Hoje</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ paddingBottom: 40 + insets.bottom, marginTop: 4 }}>
          <BotaoLuz titulo="Registrar check-in" onPress={handleSalvar} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Cartão de vidro: véu translúcido, borda de luz e sombra ameixa suave.
const vidro = () => ({
  backgroundColor: colors.card,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: colors.bordaLuz,
  shadowColor: colors.sombra,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: colors.escuro ? 0.28 : 0.11,
  shadowRadius: 20,
  elevation: 2,
});

const s = criarEstilos(() => ({
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
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 8 },

  cartao: { ...vidro(), padding: 18, marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  moldura: {
    overflow: 'hidden', flexShrink: 0, borderWidth: 1, borderColor: colors.bordaLuz,
    backgroundColor: colors.cardSolido,
  },
  headerQ: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 31, color: colors.titulo, marginBottom: 6 },
  headerSub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, lineHeight: 20 },

  // Gotas de emoção (como no Início): véu da cor da emoção + ícone na tinta dela
  emoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: 14 },
  gota: { alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  gotaAnel: { padding: 3, borderRadius: 999, borderWidth: 2.5, borderColor: 'transparent' },
  gotaAnelSel: { borderColor: colors.botao },
  gotaOrbe: {
    width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.escuro ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.8)',
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 3 }, shadowOpacity: colors.escuro ? 0.2 : 0.07, shadowRadius: 6, elevation: 1,
  },
  emoName: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.titulo, textAlign: 'center', alignSelf: 'stretch' },
  emoNameSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },

  sectTitle2: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.titulo },
  histHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 },
  histLink: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.lilasTexto },
  histCard: { position: 'relative', paddingTop: 4 },
  histLine: {
    position: 'absolute', left: 18, right: 18, top: 10,
    height: 2, backgroundColor: colors.lav2, borderRadius: 1,
  },
  histRow: { flexDirection: 'row', justifyContent: 'space-between' },
  histPt: { alignItems: 'center', gap: 6, flex: 1 },
  histDot: { width: 14, height: 14, borderRadius: 7, zIndex: 1, borderWidth: 2, borderColor: colors.cardSolido },
  histDotHoje: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.botao, borderWidth: 3, borderColor: colors.lav2, marginTop: -1 },
  histLbl: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.tl },
  histLblHoje: { color: colors.lilasTexto, fontFamily: fonts.bodyBold },

  // Botão principal com degradê e profundidade
  btnExterno: { alignSelf: 'stretch' },
  btnFace: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 54, paddingHorizontal: 24, overflow: 'hidden',
  },
  btnHalo: {
    shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 4,
  },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16.5, color: colors.white, letterSpacing: 0.2 },

  playBtn: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    backgroundColor: colors.botao, alignItems: 'center', justifyContent: 'center',
  },
  // flexGrow (e não flex) para o conteúdo continuar rolável quando passa da altura da tela.
  savedWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingBottom: 40 },
  celebCircle: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: colors.lav1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
    borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 12 }, shadowOpacity: colors.escuro ? 0.35 : 0.18, shadowRadius: 22, elevation: 3,
  },
  celebDourado: { backgroundColor: colors.douradoFundo },
  savedTit: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 38, color: colors.titulo, marginBottom: 8, textAlign: 'center' },
  savedSub: { fontFamily: fonts.quote, fontSize: 19, color: colors.texto2, marginBottom: 8, textAlign: 'center', lineHeight: 27 },
  savedHint: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  recCard: { ...vidro(), width: '100%', padding: 18, marginTop: 14 },
  recCardBloqueado: { borderStyle: 'dashed', borderColor: colors.lav3 },
  recLockTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.lav1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  recLockTxt: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.lilasTexto },
  playBtnBloqueado: { backgroundColor: colors.tl },
  recUpgradeLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  recUpgradeTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lilasTexto },
  recTagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  recTag: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lilasTexto, textTransform: 'uppercase', letterSpacing: 1 },
  recFavHint: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginBottom: 10 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recThumb: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  recTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  recSub: { fontFamily: fonts.body, fontSize: 12, color: colors.texto2, marginTop: 2 },
  upgradeCard: { ...vidro(), flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', padding: 16, marginTop: 14 },
  upgradeTxt: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.lilasTexto, lineHeight: 20 },
  sugestaoAcoes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingHorizontal: 4 },
  trocarAudio: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 12, paddingVertical: 4 },
  verConteudosLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingVertical: 4 },
  verConteudosLinkTxt: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.lilasTexto },
  localGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  localCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.lavVeu, borderRadius: 18, borderWidth: 1.5, borderColor: 'transparent',
    paddingVertical: 10, paddingHorizontal: 8, width: '48.5%', minHeight: 60,
  },
  localCardSel: { backgroundColor: colors.lav1, borderColor: colors.botao },
  localIcone: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.vidroForte, alignItems: 'center', justifyContent: 'center' },
  localIconeSel: { backgroundColor: colors.botao },
  localLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.titulo, flex: 1, lineHeight: 18 },
  localLabelSel: { color: colors.lilasTexto, fontFamily: fonts.bodyBold },
  sugestaoBloco: { width: '100%', marginTop: 18, gap: 8 },
  sugestaoTit: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lilasTexto, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 4 },
  cCard: { ...vidro(), gap: 10, padding: 14 },
  cLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cRodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.bordaSuave,
  },
  cAcao: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cAcaoTxt: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lilasTexto },
  cThumb: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  cDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.texto2, marginTop: 2, lineHeight: 17 },
}));
