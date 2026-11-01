import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { DicaTravessinho, VazioTravessinho } from '../../components/Travessinho';
import { useAuth } from '../../hooks/AuthContext';
import { abrirLink } from '../../utils/abrirLink';
import {
  useCursos, useMeusCursos, useCursosForaDaVitrine, TopoCursos, Capa, BarraProgresso,
  aulasOrdenadas, capaCurso, progressoCurso, brl, URL_CURSOS_WEB, useProfissional,
} from './cursosComum';

// Cursos Atravessia — vitrine. Cursos em vídeo criados pelas administradoras
// (painel → Conteúdo do app → Cursos). "Meus cursos" aparece primeiro, com o
// progresso; depois o curso em destaque e os demais em grade.

function NomeProfissional({ id, estilo }) {
  const prof = useProfissional(id);
  if (!prof?.nome) return null;
  return <Text style={estilo} numberOfLines={1}>com {prof.nome}</Text>;
}

function CartaoCurso({ curso, acesso, largura, onPress }) {
  const total = aulasOrdenadas(curso).length;
  const prog = progressoCurso(curso, acesso);
  return (
    <TouchableOpacity style={[s.card, { width: largura }]} onPress={onPress} activeOpacity={0.9}
      accessibilityLabel={`${curso.titulo}. ${acesso ? 'Seu curso' : brl(curso.preco)}`}>
      <Capa uri={capaCurso(curso)} raio={0} play>
        <View style={s.capaRodape}>
          <View style={s.selo}><Ionicons name="play-circle" size={13} color="white" /><Text style={s.seloTxt}>{total} {total === 1 ? 'aula' : 'aulas'}</Text></View>
          {acesso ? <View style={[s.selo, s.seloMeu]}><Ionicons name="checkmark-circle" size={13} color="white" /><Text style={s.seloTxt}>Seu curso</Text></View> : null}
        </View>
      </Capa>
      <View style={s.cardCorpo}>
        <Text style={s.cardTit} numberOfLines={2}>{curso.titulo}</Text>
        <NomeProfissional id={curso.profissionalId} estilo={s.cardProf} />
        {acesso ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            <BarraProgresso valor={prog} />
            <Text style={s.cardProg}>{prog >= 1 ? 'Concluído 💜' : prog > 0 ? `${Math.round(prog * 100)}% concluído` : 'Comece quando quiser'}</Text>
          </View>
        ) : (
          <Text style={s.cardPreco}>{brl(curso.preco)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function CursosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { firebaseUser } = useAuth();
  const cursos = useCursos();
  const meus = useMeusCursos(firebaseUser?.uid);

  const larguraUtil = Math.min(width, 1100) - spacing.lg * 2;
  const colunas = larguraUtil >= 900 ? 3 : larguraUtil >= 560 ? 2 : 1;
  const larguraCard = (larguraUtil - spacing.md * (colunas - 1)) / colunas;

  // Cursos comprados que saíram da vitrine continuam em "Meus cursos".
  const foraDaVitrine = useCursosForaDaVitrine(meus, cursos);
  const lista = cursos || [];
  const meusCursos = [...lista.filter(c => meus[c.id]), ...foraDaVitrine];
  const destaque = lista.find(c => c.destaque && !meus[c.id]);
  const outros = lista.filter(c => !meus[c.id] && c !== destaque);
  const abrir = (curso) => navigation.navigate('Curso', { cursoId: curso.id });

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <TopoCursos titulo="Cursos" onVoltar={() => navigation.goBack()} insetTop={insets.top} />

      {cursos === undefined ? (
        <View style={s.carregando}><ActivityIndicator color={colors.lav4} /></View>
      ) : (
        <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          <View style={s.coluna}>
            <View style={s.hero}>
              <Text style={s.heroSobre}>Cursos</Text>
              <Text style={s.heroMarca}>Atravessia</Text>
              <Text style={s.heroTxt}>Aulas em vídeo com profissionais que cuidam com carinho. Assista no seu ritmo, quantas vezes quiser.</Text>
            </View>

            {lista.length === 0 && meusCursos.length === 0 ? (
              <VazioTravessinho quem="brian" fala="Os primeiros cursos estão sendo preparados com carinho. Volte em breve!" />
            ) : (
              <DicaTravessinho
                chave="cursos"
                quem="brian"
                fala="Os cursos ficam com você: dá para pausar, voltar e rever cada aula quantas vezes quiser. Seu progresso fica guardado em “Meus cursos”."
              />
            )}

            {meusCursos.length > 0 && (
              <>
                <Text style={s.secao}>Meus cursos</Text>
                <View style={s.grade}>
                  {meusCursos.map(c => <CartaoCurso key={c.id} curso={c} acesso={meus[c.id]} largura={larguraCard} onPress={() => abrir(c)} />)}
                </View>
              </>
            )}

            {destaque && (
              <TouchableOpacity style={s.destaque} onPress={() => abrir(destaque)} activeOpacity={0.92} accessibilityLabel={`Em destaque: ${destaque.titulo}`}>
                <Capa uri={capaCurso(destaque)} raio={0} play tamPlay={64}>
                  <View style={s.destaqueTexto}>
                    <View style={[s.selo, s.seloDestaque]}><Ionicons name="star" size={12} color="#45358A" /><Text style={[s.seloTxt, { color: '#45358A' }]}>Em destaque</Text></View>
                    <Text style={s.destaqueTit} numberOfLines={2}>{destaque.titulo}</Text>
                    {!!destaque.subtitulo && <Text style={s.destaqueSub} numberOfLines={2}>{destaque.subtitulo}</Text>}
                  </View>
                </Capa>
                <View style={s.destaqueRodape}>
                  <NomeProfissional id={destaque.profissionalId} estilo={s.cardProf} />
                  <View style={{ flex: 1 }} />
                  <Text style={s.cardPreco}>{brl(destaque.preco)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.lilasTexto} />
                </View>
              </TouchableOpacity>
            )}

            {outros.length > 0 && (
              <>
                <Text style={s.secao}>{meusCursos.length || destaque ? 'Mais cursos' : 'Todos os cursos'}</Text>
                <View style={s.grade}>
                  {outros.map(c => <CartaoCurso key={c.id} curso={c} largura={larguraCard} onPress={() => abrir(c)} />)}
                </View>
              </>
            )}

            {meusCursos.length > 0 && (
              <TouchableOpacity style={s.web} onPress={() => abrirLink(URL_CURSOS_WEB)} activeOpacity={0.85}>
                <Ionicons name="laptop-outline" size={18} color={colors.lilasTexto} />
                <Text style={s.webTxt}>Assistir também no computador</Text>
                <Ionicons name="open-outline" size={15} color={colors.lilasTexto} />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, alignItems: 'center' },
  coluna: { width: '100%', maxWidth: 1100 - spacing.lg * 2, gap: spacing.lg },
  hero: { alignItems: 'center', paddingVertical: spacing.sm, gap: 2 },
  heroSobre: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.lilasTexto },
  heroMarca: { fontFamily: 'Marca', fontSize: 44, lineHeight: 50, color: colors.lav6 },
  heroTxt: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.texto2, textAlign: 'center', maxWidth: 460, marginTop: 4 },
  secao: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, marginBottom: -4 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    borderRadius: 24, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  capaRodape: { position: 'absolute', left: 12, right: 12, bottom: 10, flexDirection: 'row', gap: 6 },
  selo: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(28,23,38,0.55)',
  },
  seloMeu: { backgroundColor: 'rgba(90,70,173,0.9)' },
  seloDestaque: { backgroundColor: 'rgba(255,255,255,0.92)', alignSelf: 'flex-start' },
  seloTxt: { fontFamily: fonts.bodyBold, fontSize: 11, color: 'white' },
  cardCorpo: { padding: 14, gap: 3 },
  cardTit: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21, color: colors.titulo },
  cardProf: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.texto2 },
  cardPreco: { fontFamily: 'Figtree_800ExtraBold', fontSize: 16, color: colors.lilasTexto, marginTop: 4 },
  cardProg: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2 },
  destaque: {
    borderRadius: 28, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 14 }, shadowOpacity: colors.escuro ? 0.4 : 0.16, shadowRadius: 26, elevation: 3,
  },
  destaqueTexto: { position: 'absolute', left: 16, right: 16, bottom: 14, gap: 6 },
  destaqueTit: { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 27, color: 'white' },
  destaqueSub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: 'rgba(255,255,255,0.88)' },
  destaqueRodape: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  vazio: { alignItems: 'center', gap: 10, padding: spacing.xl, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz },
  vazioTxt: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.texto2, textAlign: 'center' },
  web: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center',
    minHeight: 46, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro,
  },
  webTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
}));
