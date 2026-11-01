import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer from '../../components/PlayerYoutube';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useComemoracaoTravessinho } from '../../components/Travessinho';
import { useAuth } from '../../hooks/AuthContext';
import {
  useCursoCompleto, TopoCursos, BotaoCurso, BarraProgresso, MiniaturaAula,
  aulasOrdenadas, progressoCurso,
} from './cursosComum';

// Player da aula (YouTube não listado, sem vídeos relacionados de outros
// canais e com a marca discreta). No tablet a lista de aulas fica ao lado; no
// celular, abaixo. Ao terminar o vídeo a aula é marcada como concluída
// (usuarios/{uid}/cursos/{cursoId}.progresso) e aparece "Próxima aula".
export default function AulaScreen({ navigation, route }) {
  const { cursoId } = route?.params || {};
  const [aulaId, setAulaId] = useState(route?.params?.aulaId);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const { curso, acesso, conteudo } = useCursoCompleto(cursoId, uid);
  const [terminou, setTerminou] = useState(false);
  const [carregandoVideo, setCarregandoVideo] = useState(true);
  const { comemorar, elemento: festaTravessinho } = useComemoracaoTravessinho();
  const parabensAula = useCallback(() => comemorar('brian', 'Aula concluída! Seu progresso já ficou guardado. Mandou bem!'), [comemorar]);

  const tablet = width >= 900;
  const larguraConteudo = Math.min(width, 1280) - spacing.lg * 2;
  const larguraLista = tablet ? 340 : 0;
  const larguraPlayer = tablet ? larguraConteudo - larguraLista - spacing.lg : larguraConteudo;
  const alturaPlayer = Math.round(larguraPlayer * 9 / 16);

  const aulas = aulasOrdenadas(curso);
  const idx = Math.max(0, aulas.findIndex(a => a.id === aulaId));
  const aula = aulas[idx];
  const proxima = aulas[idx + 1];
  const temAcesso = !!acesso;
  const podeVer = !!aula && (temAcesso || aula.gratis);
  // Com acesso, o vídeo da aula paga chega de cursosConteudo (pode demorar um instante).
  const esperandoVideo = podeVer && !aula.youtubeId && temAcesso && conteudo === undefined;
  const feita = !!acesso?.progresso?.[aula?.id];
  const prog = progressoCurso(curso, acesso);

  const marcar = useCallback(async (concluida) => {
    if (!uid || !temAcesso || !aula) return;
    try {
      await updateDoc(doc(db, 'usuarios', uid, 'cursos', cursoId), {
        [`progresso.${aula.id}`]: concluida, ultimaAulaId: aula.id, progressoEm: serverTimestamp(),
      });
    } catch (e) { console.warn('[Aula] progresso:', e?.message); }
  }, [uid, temAcesso, aula, cursoId]);

  const irPara = (a) => {
    if (!a) return;
    if (!(temAcesso || a.gratis)) { navigation.navigate('Curso', { cursoId }); return; }
    setTerminou(false);
    setCarregandoVideo(true);
    setAulaId(a.id);
  };

  const aoMudarEstado = useCallback((estado) => {
    if (estado === 'ended') { setTerminou(true); marcar(true); if (temAcesso) parabensAula(); }
  }, [marcar, temAcesso, parabensAula]);

  if (curso === undefined || acesso === undefined) {
    return <View style={[s.safe, s.centro]}><LavandaBg /><ActivityIndicator color={colors.lav4} /></View>;
  }

  const lista = (
    <View style={[s.lista, tablet && { width: larguraLista }]}>
      <Text style={s.listaTit}>Aulas do curso</Text>
      {temAcesso && (
        <View style={{ gap: 6, marginBottom: 4 }}>
          <BarraProgresso valor={prog} altura={8} />
          <Text style={s.legenda}>{Math.round(prog * 100)}% concluído · {aulas.filter(a => acesso?.progresso?.[a.id]).length} de {aulas.length}</Text>
        </View>
      )}
      {aulas.map((a, i) => {
        const atual = a.id === aula?.id;
        const aberta = temAcesso || a.gratis;
        const ok = !!acesso?.progresso?.[a.id];
        return (
          <TouchableOpacity key={a.id} style={[s.item, atual && s.itemAtual]} onPress={() => irPara(a)} activeOpacity={0.85}
            accessibilityLabel={`Aula ${i + 1}: ${a.titulo}`} accessibilityState={{ selected: atual }}>
            <View style={s.itemThumbWrap}>
              <MiniaturaAula aula={a} estilo={s.itemThumb} />
              {atual && <View style={s.itemTocando}><Ionicons name="volume-high" size={14} color="white" /></View>}
              {!aberta && <View style={s.itemTocando}><Ionicons name="lock-closed" size={14} color="white" /></View>}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.itemNum} numberOfLines={1}>Aula {i + 1}{a.duracao ? ` · ${a.duracao}` : ''}</Text>
              <Text style={[s.itemTit, atual && { color: colors.lilasTexto }]} numberOfLines={2}>{a.titulo}</Text>
            </View>
            {ok && <Ionicons name="checkmark-circle" size={20} color={colors.sage} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <TopoCursos titulo={curso?.titulo || 'Aula'} onVoltar={() => navigation.goBack()} insetTop={insets.top} />

      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <View style={[s.coluna, tablet && s.colunaLado]}>
          <View style={{ width: larguraPlayer, gap: spacing.md }}>
            {esperandoVideo ? (
              <View style={[s.player, s.bloqueado, { height: alturaPlayer }]}><ActivityIndicator color="white" /></View>
            ) : podeVer && !aula.youtubeId ? (
              <View style={[s.player, s.bloqueado, { height: alturaPlayer }]}>
                <Ionicons name="cloud-offline-outline" size={30} color="white" />
                <Text style={s.bloqueadoTxt}>Não conseguimos carregar esta aula agora. Confira sua conexão e tente de novo em instantes.</Text>
              </View>
            ) : podeVer ? (
              <View style={[s.player, { height: alturaPlayer }]}>
                <YoutubePlayer
                  key={aula.youtubeId}
                  height={alturaPlayer}
                  width={larguraPlayer}
                  videoId={aula.youtubeId}
                  onReady={() => setCarregandoVideo(false)}
                  onChangeState={aoMudarEstado}
                  initialPlayerParams={{ modestbranding: true, rel: false, controls: true, iv_load_policy: 3, cc_lang_pref: 'pt', playerLang: 'pt' }}
                  webViewProps={{ allowsFullscreenVideo: true, allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
                />
                {carregandoVideo && (
                  <View style={s.playerCarregando} pointerEvents="none"><ActivityIndicator color="white" /></View>
                )}
              </View>
            ) : (
              <View style={[s.player, s.bloqueado, { height: alturaPlayer }]}>
                <Ionicons name="lock-closed" size={30} color="white" />
                <Text style={s.bloqueadoTxt}>Esta aula faz parte do curso completo.</Text>
                <TouchableOpacity style={s.bloqueadoBtn} onPress={() => navigation.navigate('Curso', { cursoId })}>
                  <Text style={s.bloqueadoBtnTxt}>Conhecer o curso</Text>
                </TouchableOpacity>
              </View>
            )}

            {!!aula && (
              <View style={s.info}>
                <Text style={s.infoNum}>Aula {idx + 1} de {aulas.length}{aula.duracao ? ` · ${aula.duracao}` : ''}</Text>
                <Text style={s.infoTit}>{aula.titulo}</Text>
                {terminou && <Text style={s.parabens}>Aula concluída. Que bom ter você aqui! 💜</Text>}
                <View style={s.acoes}>
                  {temAcesso && (
                    <TouchableOpacity style={[s.btnSec, feita && s.btnSecFeita]} onPress={() => { marcar(!feita); if (!feita) parabensAula(); }} activeOpacity={0.85}
                      accessibilityLabel={feita ? 'Desmarcar aula concluída' : 'Marcar aula como concluída'}>
                      <Ionicons name={feita ? 'checkmark-circle' : 'checkmark-circle-outline'} size={18} color={feita ? colors.sageFg : colors.lilasTexto} />
                      <Text style={[s.btnSecTxt, feita && { color: colors.sageFg }]}>{feita ? 'Concluída' : 'Marcar como concluída'}</Text>
                    </TouchableOpacity>
                  )}
                  {!temAcesso && aula.gratis && <Text style={s.gratis}>Aula grátis de amostra</Text>}
                </View>
                {proxima && (
                  <BotaoCurso rotulo="Próxima aula" onPress={() => irPara(proxima)} externo={{ marginTop: 6 }}>
                    <Text style={s.btnTxt} numberOfLines={1}>Próxima aula</Text>
                    <Ionicons name="arrow-forward" size={18} color="white" />
                  </BotaoCurso>
                )}
              </View>
            )}
          </View>
          {lista}
        </View>
      </ScrollView>
      {festaTravessinho}
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, alignItems: 'center' },
  coluna: { width: '100%', maxWidth: 1280 - spacing.lg * 2, gap: spacing.lg },
  colunaLado: { flexDirection: 'row', alignItems: 'flex-start' },
  player: {
    borderRadius: 22, overflow: 'hidden', backgroundColor: '#1C1726',
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 14 }, shadowOpacity: colors.escuro ? 0.5 : 0.22, shadowRadius: 26, elevation: 4,
  },
  playerCarregando: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C1726' },
  bloqueado: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: spacing.lg },
  bloqueadoTxt: { fontFamily: fonts.bodySemi, fontSize: 15, color: 'white', textAlign: 'center' },
  bloqueadoBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  bloqueadoBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#45358A' },
  info: {
    padding: spacing.lg, borderRadius: 24, gap: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 8 }, shadowOpacity: colors.escuro ? 0.3 : 0.08, shadowRadius: 18, elevation: 2,
  },
  infoNum: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.lilasTexto },
  infoTit: { fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 26, color: colors.titulo },
  parabens: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.sageFg },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  btnSec: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 999,
    borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro,
  },
  btnSecFeita: { backgroundColor: colors.sageFundo, borderColor: 'transparent' },
  btnSecTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: 'white' },
  gratis: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.sageFg, backgroundColor: colors.sageFundo, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  lista: {
    padding: spacing.md, borderRadius: 24, gap: 4, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 8 }, shadowOpacity: colors.escuro ? 0.3 : 0.08, shadowRadius: 18, elevation: 2,
  },
  listaTit: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.titulo, margin: 4 },
  legenda: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.texto2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 16 },
  itemAtual: { backgroundColor: colors.lav1 },
  itemThumbWrap: { width: 88, aspectRatio: 16 / 9, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.lav2 },
  itemThumb: { width: '100%', height: '100%' },
  itemTocando: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(69,53,138,0.55)' },
  itemNum: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.texto2 },
  itemTit: { fontFamily: fonts.bodySemi, fontSize: 13.5, lineHeight: 18, color: colors.titulo },
}));
