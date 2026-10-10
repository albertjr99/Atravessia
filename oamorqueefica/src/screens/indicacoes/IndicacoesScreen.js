import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, Image, Linking, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { urlDeImagem } from '../../utils/imagemUrl';
import { normalizarUrl } from '../../utils/abrirLink';

// Indicações Atravessia: curadoria de produtos (livros, cuidados, objetos)
// com link de afiliada da Amazon. O link abre fora do app (no app da Amazon
// ou no navegador), como pede o programa de afiliados.
export const CATEGORIAS_INDICACAO = [
  { id: 'livros', rotulo: 'Livros' },
  { id: 'diario', rotulo: 'Diário e escrita' },
  { id: 'bemestar', rotulo: 'Bem-estar' },
  { id: 'casa', rotulo: 'Casa e conforto' },
  { id: 'presentes', rotulo: 'Para presentear' },
  { id: 'outros', rotulo: 'Outros' },
];
const rotuloCategoria = (id) => CATEGORIAS_INDICACAO.find(c => c.id === id)?.rotulo || 'Outros';

function CartaoIndicacao({ item, onAbrir, largura }) {
  const [aberto, setAberto] = useState(false);
  const [erroImg, setErroImg] = useState(false);
  const imagem = urlDeImagem(item.imagemUrl);
  const longa = String(item.descricao || '').length > 110;
  return (
    <View style={[s.card, { width: largura }]}>
      <View style={s.imagemCaixa}>
        {imagem && !erroImg
          ? <Image source={{ uri: imagem }} style={s.imagem} resizeMode="contain" onError={() => setErroImg(true)} />
          : <Ionicons name="gift-outline" size={34} color={colors.lav3} />}
      </View>
      <View style={s.corpo}>
        <Text style={s.categoria}>{rotuloCategoria(item.categoria)}</Text>
        <Text style={s.titulo} numberOfLines={3}>{item.titulo}</Text>
        {!!item.descricao && (
          <>
            <Text style={s.descricao} numberOfLines={aberto ? undefined : 3}>{item.descricao}</Text>
            {longa && (
              <TouchableOpacity onPress={() => setAberto(a => !a)} hitSlop={8}>
                <Text style={s.verMais}>{aberto ? 'ver menos' : 'ver mais'}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={s.botao} onPress={() => onAbrir(item)} activeOpacity={0.85}>
          <Text style={s.botaoTxt}>Ver na Amazon</Text>
          <Ionicons name="open-outline" size={14} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function IndicacoesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { indicacoes, registrarClique } = useApp();
  const [filtro, setFiltro] = useState('todas');

  const categorias = useMemo(() => {
    const presentes = new Set(indicacoes.map(i => i.categoria || 'outros'));
    return CATEGORIAS_INDICACAO.filter(c => presentes.has(c.id));
  }, [indicacoes]);
  const lista = filtro === 'todas' ? indicacoes : indicacoes.filter(i => (i.categoria || 'outros') === filtro);

  const colunas = width >= 900 ? 3 : 2;
  const larguraUtil = Math.min(width, 980) - spacing.lg * 2;
  const largura = (larguraUtil - (colunas - 1) * 12) / colunas;

  const abrir = (item) => {
    const url = normalizarUrl(item.link);
    if (!url) return;
    registrarClique('indicacao', item.id);
    Linking.openURL(url).catch(e => console.warn('[Indicações] não abriu:', e?.message));
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconeBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Indicações Atravessia</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <View style={s.coluna}>
          <Text style={s.intro}>Escolhemos com carinho livros, objetos e cuidados que podem acompanhar você nessa travessia.</Text>

          {categorias.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtros}>
              {[{ id: 'todas', rotulo: 'Todas' }, ...categorias].map(c => (
                <TouchableOpacity key={c.id} style={[s.filtro, filtro === c.id && s.filtroSel]} onPress={() => setFiltro(c.id)}>
                  <Text style={[s.filtroTxt, filtro === c.id && s.filtroTxtSel]}>{c.rotulo}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {lista.length === 0 ? (
            <View style={s.vazio}>
              <Ionicons name="book-outline" size={34} color={colors.lav3} />
              <Text style={s.vazioTit}>Em breve</Text>
              <Text style={s.vazioTxt}>Nossas indicações estão sendo preparadas. Volte em breve.</Text>
            </View>
          ) : (
            <View style={s.grade}>
              {lista.map(item => <CartaoIndicacao key={item.id} item={item} onAbrir={abrir} largura={largura} />)}
            </View>
          )}

          <View style={s.aviso}>
            <Ionicons name="information-circle-outline" size={16} color={colors.lav5} />
            <Text style={s.avisoTxt}>
              Como Associada da Amazon, a Atravessia recebe uma comissão por compras qualificadas feitas por estes links. O preço para você não muda, e isso ajuda a manter o app.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingBottom: 6 },
  iconeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  coluna: { width: '100%', maxWidth: 980, alignSelf: 'center', gap: spacing.md },
  intro: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.tm, textAlign: 'center' },
  filtros: { gap: 8 },
  filtro: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  filtroSel: { backgroundColor: colors.botaoForte, borderColor: colors.botaoForte },
  filtroTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.td },
  filtroTxtSel: { fontFamily: fonts.bodyBold, color: 'white' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  imagemCaixa: { height: 140, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  imagem: { width: '86%', height: 124 },
  corpo: { padding: 12, gap: 4, flex: 1, minHeight: 170 },
  categoria: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.lav5, letterSpacing: 0.6, textTransform: 'uppercase' },
  titulo: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 19, color: colors.td },
  descricao: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.tm },
  verMais: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav5 },
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8,
    backgroundColor: colors.botaoForte, borderRadius: radius.full, paddingVertical: 9,
  },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
  vazio: { alignItems: 'center', gap: 8, padding: spacing.xl },
  vazioTit: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.td },
  vazioTxt: { fontFamily: fonts.body, fontSize: 13.5, color: colors.tm, textAlign: 'center' },
  aviso: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.lav1, borderRadius: radius.md, padding: 12 },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.tm },
}));
