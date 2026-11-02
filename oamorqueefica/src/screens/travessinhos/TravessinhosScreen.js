import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StatusBar, Modal, FlatList, Platform,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors, fonts, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import YoutubePlayer from '../../components/PlayerYoutube';
import PlayerVideo from '../../components/PlayerVideo';
import SeletorOpcoes from '../../components/SeletorOpcoes';
import { abrirLink } from '../../utils/abrirLink';
import {
  PERSONAGENS, IMAGEM_GRUPO, TIPOS_MATERIAL, capaMaterial, useMateriaisTravessinhos, CarinhasTravessinhos,
} from '../../components/Travessinho';

// Área infantil "Os Travessinhos": vídeos, PDFs, quadrinhos e áudios
// cadastrados no painel (travessinhosMateriais, só os publicados).
export default function TravessinhosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const lista = useMateriaisTravessinhos();
  const [filtro, setFiltro] = useState('todos');
  const [aberto, setAberto] = useState(null);

  const larguraUtil = Math.min(width, 960) - 32;
  const colunas = larguraUtil >= 700 ? 3 : 2;
  const gap = 12;
  const larguraCard = Math.floor((larguraUtil - gap * (colunas - 1)) / colunas);
  const larguraArte = Math.min(larguraUtil, 560);

  const tiposPresentes = useMemo(() => Object.keys(TIPOS_MATERIAL).filter(t => (lista || []).some(m => m.tipo === t)), [lista]);
  const filtrados = (lista || []).filter(m => filtro === 'todos' || m.tipo === filtro);

  const abrir = (m) => {
    if (m.tipo === 'pdf') {
      if (!m.arquivoUrl) return;
      if (Platform.OS === 'web') abrirLink(m.arquivoUrl);
      else WebBrowser.openBrowserAsync(m.arquivoUrl).catch(() => abrirLink(m.arquivoUrl));
      return;
    }
    setAberto(m);
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView contentContainerStyle={[s.conteudo, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={[s.coluna, { width: larguraUtil }]}>
          <View style={s.topo}>
            <TouchableOpacity style={s.voltar} onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
              <Ionicons name="chevron-back" size={22} color={colors.lilasTexto} />
            </TouchableOpacity>
            <Text style={s.tituloTela}>Os Travessinhos</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={[s.arte, { width: larguraArte, height: Math.round(larguraArte * 0.8) }]}>
            <Image source={IMAGEM_GRUPO} style={{ width: '100%', height: '100%' }} resizeMode="cover"
              accessibilityLabel="Nanda, Brian e Maju acenando numa ponte de madeira" />
          </View>
          <View style={s.intro}>
            <CarinhasTravessinhos tamanho={34} />
            <Text style={s.introTxt}>
              Histórias, vídeos e quadrinhos para os pequenos atravessarem o luto com carinho, no tempo deles e pertinho de quem cuida.
            </Text>
          </View>

          {tiposPresentes.length > 1 && (
            <SeletorOpcoes
              titulo="Filtrar por tipo"
              limite={10}
              estilo={{ marginBottom: 12 }}
              opcoes={[{ id: 'todos', label: 'Tudo' }, ...tiposPresentes.map(t => ({ id: t, label: TIPOS_MATERIAL[t].rotulo, icone: TIPOS_MATERIAL[t].icone }))]}
              valor={filtro}
              onChange={setFiltro}
            />
          )}

          {lista === undefined ? (
            <ActivityIndicator color={colors.lav4} style={{ marginTop: 24 }} />
          ) : filtrados.length === 0 ? (
            <View style={s.vazio}>
              <Ionicons name="sparkles-outline" size={26} color={colors.lilasIcone} />
              <Text style={s.vazioTxt}>Os primeiros materiais estão sendo preparados com carinho. Volte em breve!</Text>
            </View>
          ) : (
            <View style={[s.grade, { gap }]}>
              {filtrados.map(m => (
                <CartaoMaterial key={m.id} m={m} largura={larguraCard} onPress={() => abrir(m)} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={!!aberto} animationType="fade" onRequestClose={() => setAberto(null)} supportedOrientations={['portrait', 'landscape']}>
        {aberto?.tipo === 'quadrinho'
          ? <VisualizadorQuadrinhos m={aberto} onFechar={() => setAberto(null)} />
          : aberto?.tipo === 'audio'
            ? <TocadorAudio m={aberto} onFechar={() => setAberto(null)} />
            : aberto ? <TocadorVideo m={aberto} onFechar={() => setAberto(null)} /> : null}
      </Modal>
    </SafeAreaView>
  );
}

function CartaoMaterial({ m, largura, onPress }) {
  const tipo = TIPOS_MATERIAL[m.tipo] || TIPOS_MATERIAL.video;
  const capa = capaMaterial(m);
  const p = PERSONAGENS[m.personagem];
  return (
    <TouchableOpacity style={[s.card, { width: largura }]} onPress={onPress} activeOpacity={0.85}
      accessibilityRole="button" accessibilityLabel={`${tipo.rotulo}: ${m.titulo || ''}`}>
      <View style={s.capa}>
        {capa
          ? <Image source={{ uri: capa }} style={s.capaImg} resizeMode="cover" />
          : <View style={[s.capaImg, s.capaVazia]}><Ionicons name={tipo.icone} size={34} color={colors.lilasIcone} /></View>}
        <View style={s.selo}>
          <Ionicons name={tipo.icone} size={13} color="#FFFFFF" />
          <Text style={s.seloTxt}>{tipo.rotulo}</Text>
        </View>
        {!!p && (
          <Image source={p.avatar} style={[s.avatarCanto, { backgroundColor: p.fundo, borderColor: p.cor }]} accessibilityLabel={p.nome} />
        )}
      </View>
      <View style={s.cardCorpo}>
        <Text style={s.cardTit} numberOfLines={2}>{m.titulo}</Text>
        {!!m.descricao && <Text style={s.cardDesc} numberOfLines={2}>{m.descricao}</Text>}
        {!!m.faixaEtaria && <Text style={s.cardIdade}>{m.faixaEtaria}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function CabecalhoModal({ titulo, onFechar, claro }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.modalTopo, { paddingTop: insets.top + 8 }]}>
      <Text style={[s.modalTit, claro && { color: '#FFFFFF' }]} numberOfLines={1}>{titulo}</Text>
      <TouchableOpacity onPress={onFechar} style={s.fechar} accessibilityLabel="Fechar" hitSlop={8}>
        <Ionicons name="close" size={22} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

function TocadorVideo({ m, onFechar }) {
  const { width, height } = useWindowDimensions();
  const larg = Math.min(width - 24, 960);
  const alt = Math.min(Math.round(larg * 9 / 16), height - 200);
  return (
    <View style={s.modalFundo}>
      <CabecalhoModal titulo={m.titulo} onFechar={onFechar} claro />
      <View style={s.modalCentro}>
        {m.youtubeId ? (
          <View style={{ width: larg, height: alt, backgroundColor: '#000' }}>
            <YoutubePlayer videoId={m.youtubeId} width={larg} height={alt} play
              initialPlayerParams={{ cc_lang_pref: 'pt', playerLang: 'pt', rel: false }} />
          </View>
        ) : m.arquivoUrl ? (
          <PlayerVideo url={m.arquivoUrl} titulo={m.titulo} largura={larg} maxAltura={height - 200} />
        ) : (
          <Text style={s.modalTxt}>Este vídeo ainda não está disponível.</Text>
        )}
        {!!m.descricao && <Text style={[s.modalTxt, { maxWidth: larg }]}>{m.descricao}</Text>}
      </View>
    </View>
  );
}

function VisualizadorQuadrinhos({ m, onFechar }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const paginas = (m.paginas || []).filter(p => p?.url);
  const [atual, setAtual] = useState(0);
  const lista = useRef(null);
  const alturaPagina = height - insets.top - insets.bottom - 130;

  const ir = (i) => {
    const alvo = Math.max(0, Math.min(paginas.length - 1, i));
    setAtual(alvo);
    lista.current?.scrollToOffset({ offset: alvo * width, animated: true });
  };

  return (
    <View style={s.modalFundo}>
      <CabecalhoModal titulo={m.titulo} onFechar={onFechar} claro />
      {paginas.length === 0 ? (
        <View style={s.modalCentro}><Text style={s.modalTxt}>Este quadrinho ainda não tem páginas.</Text></View>
      ) : (
        <>
          <FlatList
            ref={lista}
            data={paginas}
            keyExtractor={(p, i) => `${i}-${p.url}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(e) => setAtual(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item, index }) => (
              // No iOS, a ScrollView com zoom permite ampliar a página com pinça.
              <ScrollView
                style={{ width, height: alturaPagina }}
                contentContainerStyle={{ width, height: alturaPagina, alignItems: 'center', justifyContent: 'center' }}
                maximumZoomScale={3}
                minimumZoomScale={1}
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Image source={{ uri: item.url }} style={{ width: width - 16, height: alturaPagina }} resizeMode="contain"
                  accessibilityLabel={`Página ${index + 1} de ${paginas.length}`} />
              </ScrollView>
            )}
          />
          <View style={[s.navQuadrinho, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={[s.seta, atual === 0 && s.setaOff]} onPress={() => ir(atual - 1)} disabled={atual === 0}
              accessibilityLabel="Página anterior">
              <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={s.contador}>{atual + 1} de {paginas.length}</Text>
            <TouchableOpacity style={[s.seta, atual >= paginas.length - 1 && s.setaOff]} onPress={() => ir(atual + 1)}
              disabled={atual >= paginas.length - 1} accessibilityLabel="Próxima página">
              <Ionicons name="chevron-forward" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const mmss = (seg) => {
  const t = Math.max(0, Math.floor(seg || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

function TocadorAudio({ m, onFechar }) {
  const player = useAudioPlayer(m.arquivoUrl ? { uri: m.arquivoUrl } : null);
  const st = useAudioPlayerStatus(player);
  const capa = capaMaterial(m);
  const tocando = !!st?.playing;
  const alternar = () => {
    if (tocando) { player.pause(); return; }
    if (st?.duration && st.currentTime >= st.duration - 0.3) player.seekTo(0);
    player.play();
  };
  const pular = (d) => player.seekTo(Math.max(0, Math.min((st?.duration || 0), (st?.currentTime || 0) + d)));
  const prog = st?.duration ? Math.min(1, (st.currentTime || 0) / st.duration) : 0;
  return (
    <View style={s.modalFundo}>
      <CabecalhoModal titulo={m.titulo} onFechar={() => { try { player.pause(); } catch {} onFechar(); }} claro />
      <View style={s.modalCentro}>
        {capa
          ? <Image source={{ uri: capa }} style={s.audioCapa} resizeMode="cover" />
          : <View style={[s.audioCapa, s.capaVazia]}><Ionicons name="headset-outline" size={48} color={colors.lilasIcone} /></View>}
        {!!m.descricao && <Text style={s.modalTxt}>{m.descricao}</Text>}
        <View style={s.barra}><View style={[s.barraCheia, { width: `${prog * 100}%` }]} /></View>
        <Text style={s.tempo}>{mmss(st?.currentTime)} / {mmss(st?.duration)}</Text>
        <View style={s.audioBotoes}>
          <TouchableOpacity onPress={() => pular(-10)} style={s.seta} accessibilityLabel="Voltar 10 segundos">
            <Ionicons name="play-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={alternar} style={s.play} accessibilityLabel={tocando ? 'Pausar' : 'Tocar'} disabled={!m.arquivoUrl}>
            {st?.isBuffering && !tocando
              ? <ActivityIndicator color="#FFFFFF" />
              : <Ionicons name={tocando ? 'pause' : 'play'} size={32} color="#FFFFFF" style={!tocando && { marginLeft: 3 }} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => pular(10)} style={s.seta} accessibilityLabel="Avançar 10 segundos">
            <Ionicons name="play-forward" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  conteudo: { alignItems: 'center' },
  coluna: { alignItems: 'stretch' },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  voltar: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  tituloTela: { fontFamily: fonts.serif, fontSize: 26, color: colors.titulo },
  arte: { alignSelf: 'center', borderRadius: 26, overflow: 'hidden', borderWidth: 3, borderColor: colors.white, marginBottom: 14 },
  intro: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, padding: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz, borderRadius: 22,
  },
  introTxt: { flex: 1, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.td },
  vazio: {
    alignItems: 'center', gap: 10, padding: 24, borderRadius: 22,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  vazioTxt: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.texto2, textAlign: 'center' },
  grade: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz, borderRadius: 20, overflow: 'hidden',
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 8 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 16, elevation: 2,
  },
  capa: { width: '100%', aspectRatio: 1, backgroundColor: colors.lav1 },
  capaImg: { width: '100%', height: '100%' },
  capaVazia: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lav1 },
  selo: {
    position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(40,28,80,0.72)',
  },
  seloTxt: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: '#FFFFFF' },
  avatarCanto: { position: 'absolute', right: 8, bottom: 8, width: 34, height: 34, borderRadius: 17, borderWidth: 2 },
  cardCorpo: { padding: 10, gap: 3 },
  cardTit: { fontFamily: fonts.bodyBold, fontSize: 14.5, lineHeight: 19, color: colors.titulo },
  cardDesc: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.texto2 },
  cardIdade: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.lilasTexto, marginTop: 2 },

  modalFundo: { flex: 1, backgroundColor: '#14101F' },
  modalTopo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  modalTit: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo },
  fechar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  modalCentro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 12 },
  modalTxt: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.85)', textAlign: 'center', paddingHorizontal: 12 },
  navQuadrinho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingTop: 10 },
  seta: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  setaOff: { opacity: 0.3 },
  contador: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#FFFFFF', minWidth: 70, textAlign: 'center' },
  audioCapa: { width: 220, height: 220, borderRadius: 26 },
  barra: { width: '80%', maxWidth: 420, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  barraCheia: { height: 6, backgroundColor: '#C9B8F5' },
  tempo: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  audioBotoes: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  play: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7B5EA7' },
}));
