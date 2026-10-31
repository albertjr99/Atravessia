import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Image, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import Recolhivel from '../../components/Recolhivel';
import TextoComLinks from '../../components/TextoComLinks';
import { useAuth } from '../../hooks/AuthContext';
import { abrirLink } from '../../utils/abrirLink';
import { aquecerPagamento, abrirPagamento, mensagemErroPagamento } from '../../utils/pagamento';
import {
  useCursoCompleto, useProfissional, TopoCursos, Capa, BotaoCurso, BarraProgresso, MiniaturaAula, NotaPrivacidadeCurso,
  aulasOrdenadas, capaCurso, progressoCurso, brl, URL_CURSOS_WEB, URL_TERMOS,
} from './cursosComum';

// Página do curso: capa, profissional, descrição, programa (recolhíveis),
// aulas (com cadeado até a compra; as marcadas como grátis ficam abertas) e o
// botão de compra pelo Stripe. O acesso chega sozinho (webhook) assim que o
// pagamento é confirmado: esta tela escuta usuarios/{uid}/cursos/{cursoId}.
export default function CursoScreen({ navigation, route }) {
  const cursoId = route?.params?.cursoId;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { firebaseUser } = useAuth();
  const { curso, acesso } = useCursoCompleto(cursoId, firebaseUser?.uid);
  const prof = useProfissional(curso?.profissionalId);
  const [comprando, setComprando] = useState(false);
  const [aguardando, setAguardando] = useState(false);

  useEffect(() => { aquecerPagamento('criarCheckoutCurso'); }, []);
  useEffect(() => { if (acesso) setAguardando(false); }, [acesso]);

  const largo = width >= 820;
  const aulas = aulasOrdenadas(curso);
  const prog = progressoCurso(curso, acesso);
  const temAcesso = !!acesso;
  const proxima = aulas.find(a => !acesso?.progresso?.[a.id]) || aulas[0];

  const abrirAula = (aula) => {
    if (temAcesso || aula.gratis) { navigation.navigate('Aula', { cursoId, aulaId: aula.id }); return; }
    Alert.alert('Aula do curso completo', `Esta aula é liberada com a compra do curso (${brl(curso.preco)}).`, [
      { text: 'Agora não', style: 'cancel' },
      { text: 'Comprar curso', onPress: comprar },
    ]);
  };

  async function comprar() {
    setComprando(true);
    try {
      const { data } = await httpsCallable(functions, 'criarCheckoutCurso')({ cursoId });
      if (!data?.url) throw new Error('Não recebemos o link de pagamento. Tente novamente em alguns instantes.');
      await abrirPagamento(data.url);
      setAguardando(true);
    } catch (e) {
      Alert.alert('Não foi possível abrir o pagamento', mensagemErroPagamento(e));
    } finally {
      setComprando(false);
    }
  }

  if (curso === undefined) {
    return <View style={[s.safe, s.centro]}><LavandaBg /><ActivityIndicator color={colors.lav4} /></View>;
  }
  if (!curso || ((curso.ativo !== true || curso.arquivado === true) && !temAcesso)) {
    return (
      <SafeAreaView style={s.safe} edges={['left', 'right']}>
        <LavandaBg />
        <TopoCursos titulo="Curso" onVoltar={() => navigation.goBack()} insetTop={insets.top} />
        <View style={s.centro}><Text style={s.texto}>Este curso não está disponível no momento.</Text></View>
      </SafeAreaView>
    );
  }

  const blocoAulas = (
    <View style={s.cartao}>
      <View style={s.cartaoTopo}>
        <Text style={s.secao}>Aulas</Text>
        <Text style={s.legenda}>{aulas.length} {aulas.length === 1 ? 'aula' : 'aulas'}</Text>
      </View>
      {temAcesso && (
        <View style={{ gap: 6, marginBottom: 6 }}>
          <BarraProgresso valor={prog} altura={8} />
          <Text style={s.legenda}>{Math.round(prog * 100)}% concluído</Text>
        </View>
      )}
      {aulas.map((a, i) => {
        const aberta = temAcesso || a.gratis;
        const feita = !!acesso?.progresso?.[a.id];
        return (
          <TouchableOpacity key={a.id} style={s.aula} onPress={() => abrirAula(a)} activeOpacity={0.85}
            accessibilityLabel={`Aula ${i + 1}: ${a.titulo}${aberta ? '' : '. Bloqueada'}`}>
            <View style={s.aulaThumbWrap}>
              <MiniaturaAula aula={a} estilo={s.aulaThumb} />
              <View style={[s.aulaThumbVeu, !aberta && s.aulaThumbVeuForte]}>
                <Ionicons name={aberta ? 'play' : 'lock-closed'} size={16} color="white" />
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={s.aulaNum} numberOfLines={1}>Aula {i + 1}{a.duracao ? ` · ${a.duracao}` : ''}</Text>
              <Text style={s.aulaTit} numberOfLines={2}>{a.titulo}</Text>
              {a.gratis && !temAcesso && <Text style={s.gratis}>Aula grátis</Text>}
            </View>
            {feita
              ? <Ionicons name="checkmark-circle" size={22} color={colors.sage} />
              : <Ionicons name={aberta ? 'chevron-forward' : 'lock-closed-outline'} size={18} color={colors.tl} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <TopoCursos titulo="Curso" onVoltar={() => navigation.goBack()} insetTop={insets.top} />

      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + (temAcesso ? 130 : 170) }]} showsVerticalScrollIndicator={false}>
        <View style={s.coluna}>
          <View style={s.heroi}>
            <Capa uri={capaCurso(curso)} raio={0} play={!!proxima} tamPlay={62}>
              <TouchableOpacity style={StyleSheetFill} onPress={() => proxima && abrirAula(temAcesso ? proxima : (aulas.find(a => a.gratis) || proxima))}
                accessibilityLabel="Assistir" />
            </Capa>
            <View style={s.heroiCorpo}>
              <Text style={s.titulo}>{curso.titulo}</Text>
              {!!curso.subtitulo && <Text style={s.subtitulo}>{curso.subtitulo}</Text>}
              <View style={s.metas}>
                <View style={s.meta}><Ionicons name="play-circle-outline" size={15} color={colors.lilasTexto} /><Text style={s.metaTxt}>{aulas.length} aulas</Text></View>
                <View style={s.meta}><Ionicons name="infinite-outline" size={15} color={colors.lilasTexto} /><Text style={s.metaTxt}>Acesso sem prazo</Text></View>
                <View style={s.meta}><Ionicons name="phone-portrait-outline" size={15} color={colors.lilasTexto} /><Text style={s.metaTxt}>App e computador</Text></View>
              </View>
            </View>
          </View>

          <View style={[s.duas, largo && s.duasLado]}>
            <View style={[s.colPrincipal, largo && { flex: 1.35 }]}>
              {!!prof && (
                <View style={s.prof}>
                  {prof.fotoUrl ? <Image source={{ uri: prof.fotoUrl }} style={s.profFoto} /> : (
                    <View style={[s.profFoto, s.profInicial]}><Text style={s.profInicialTxt}>{(prof.nome || 'A')[0]}</Text></View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.profRot}>Com</Text>
                    <Text style={s.profNome}>{prof.nome}</Text>
                    {!!prof.bio && <Text style={s.profBio} numberOfLines={4}>{prof.bio}</Text>}
                  </View>
                </View>
              )}

              {!!curso.descricao && (
                <View style={s.cartao}>
                  <Text style={s.secao}>Sobre o curso</Text>
                  <TextoComLinks style={s.texto}>{curso.descricao}</TextoComLinks>
                </View>
              )}

              {(curso.programa || []).length > 0 && (
                <View style={{ gap: 0 }}>
                  <Text style={[s.secao, { marginBottom: 10 }]}>Conteúdo programático</Text>
                  {curso.programa.map((p, i) => (
                    <Recolhivel key={i} titulo={p.titulo || `Módulo ${i + 1}`} icone="bookmark-outline">
                      <Text style={s.texto}>{p.descricao}</Text>
                    </Recolhivel>
                  ))}
                </View>
              )}
            </View>
            <View style={[largo && { flex: 1 }]}>{blocoAulas}</View>
          </View>

          {acesso === null && (
            <View style={s.cartao}>
              <NotaPrivacidadeCurso onTermos={() => abrirLink(URL_TERMOS)} />
            </View>
          )}

          {temAcesso && (
            <TouchableOpacity style={s.web} onPress={() => abrirLink(`${URL_CURSOS_WEB}?curso=${cursoId}`)} activeOpacity={0.85}>
              <Ionicons name="laptop-outline" size={18} color={colors.lilasTexto} />
              <Text style={s.webTxt}>Assistir também no computador</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Rodapé fixo: comprar ou continuar */}
      <View style={[s.rodape, { paddingBottom: insets.bottom + 12 }]}>
        {acesso === undefined ? null : temAcesso ? (
          <BotaoCurso rotulo="Continuar o curso" onPress={() => proxima && navigation.navigate('Aula', { cursoId, aulaId: proxima.id })}>
            <Ionicons name="play" size={18} color="white" />
            <Text style={s.btnTxt}>{prog > 0 ? 'Continuar de onde parei' : 'Começar o curso'}</Text>
          </BotaoCurso>
        ) : (
          <>
            {aguardando && (
              <Text style={s.aguardando}>Assim que a Stripe confirmar o pagamento, o curso é liberado aqui sozinho. 💜</Text>
            )}
            <BotaoCurso rotulo={`Comprar curso por ${brl(curso.preco)}`} onPress={comprar} desativado={comprando}>
              {comprando ? <ActivityIndicator color="white" /> : <Ionicons name="lock-open-outline" size={18} color="white" />}
              <Text style={s.btnTxt} numberOfLines={1} adjustsFontSizeToFit>{comprando ? 'Abrindo pagamento...' : `Comprar curso — ${brl(curso.preco)}`}</Text>
            </BotaoCurso>
            <Text style={s.rodapeNota} numberOfLines={2}>
              Pagamento seguro pela Stripe. Ao comprar, você aceita os{' '}
              <Text style={s.rodapeLink} onPress={() => abrirLink(URL_TERMOS)}>Termos de Uso</Text>.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const StyleSheetFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, alignItems: 'center' },
  coluna: { width: '100%', maxWidth: 1060, gap: spacing.lg },
  heroi: {
    borderRadius: 28, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 14 }, shadowOpacity: colors.escuro ? 0.4 : 0.14, shadowRadius: 26, elevation: 3,
  },
  heroiCorpo: { padding: spacing.lg, gap: 6 },
  titulo: { fontFamily: fonts.bodyBold, fontSize: 24, lineHeight: 30, color: colors.titulo },
  subtitulo: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.texto2 },
  metas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.lav1 },
  metaTxt: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.lilasTexto },
  duas: { gap: spacing.lg },
  duasLado: { flexDirection: 'row', alignItems: 'flex-start' },
  colPrincipal: { gap: spacing.lg },
  prof: {
    flexDirection: 'row', gap: 14, padding: spacing.lg, borderRadius: 24,
    backgroundColor: colors.joiaLilas[0], borderBottomWidth: 4, borderBottomColor: colors.joiaLilas[2],
  },
  profFoto: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.lav2 },
  profInicial: { alignItems: 'center', justifyContent: 'center' },
  profInicialTxt: { fontFamily: fonts.bodyBold, fontSize: 24, color: colors.lav6 },
  profRot: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.joiaLilasTexto },
  profNome: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.joiaLilasTexto },
  profBio: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.texto2, marginTop: 4 },
  cartao: {
    padding: spacing.lg, borderRadius: 24, gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 8 }, shadowOpacity: colors.escuro ? 0.3 : 0.08, shadowRadius: 18, elevation: 2,
  },
  cartaoTopo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  secao: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo },
  legenda: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.texto2 },
  texto: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.td },
  aula: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  aulaThumbWrap: { width: 96, aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.lav2 },
  aulaThumb: { width: '100%', height: '100%' },
  aulaThumbVeu: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28,23,38,0.28)' },
  aulaThumbVeuForte: { backgroundColor: 'rgba(28,23,38,0.55)' },
  aulaNum: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.lilasTexto },
  aulaTit: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 19, color: colors.titulo },
  gratis: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.sageFg, alignSelf: 'flex-start', backgroundColor: colors.sageFundo, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', marginTop: 2 },
  web: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center',
    minHeight: 46, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro,
  },
  webTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  rodape: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: 12, gap: 8,
    backgroundColor: colors.vidroForte, borderTopWidth: 1, borderTopColor: colors.bordaLuz,
  },
  aguardando: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.texto2, textAlign: 'center' },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: 'white', flexShrink: 1 },
  rodapeNota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.texto2, textAlign: 'center' },
  rodapeLink: { fontFamily: fonts.bodyBold, color: colors.lilasTexto, textDecorationLine: 'underline' },
}));
