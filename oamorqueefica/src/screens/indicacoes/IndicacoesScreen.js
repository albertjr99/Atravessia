import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, Image, Linking, useWindowDimensions, StyleSheet, Alert,
} from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { useAuth } from '../../hooks/AuthContext';
import { textoBotaoAfiliado, seloCashback, regraCashback, nomePlataforma } from '../../utils/afiliados';
import PedidoCashbackModal from './PedidoCashbackModal';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { LinearGradient } from 'expo-linear-gradient';
import { Profundo } from '../../components/Efeitos';
import SeletorOpcoes from '../../components/SeletorOpcoes';
import { useApp } from '../../hooks/AppContext';
import { urlDeImagem } from '../../utils/imagemUrl';
import { normalizarUrl } from '../../utils/abrirLink';

// Achados da Atravessia (antes "Indicações Atravessia"): curadoria de produtos
// (livros, cuidados, objetos) com link de afiliado de várias lojas (Amazon,
// Mercado Livre, Shopee, Magalu…). O link abre fora do app, como pedem os
// programas de afiliados. Itens com cashback mostram um selo e o botão
// "Já comprei — pedir meu cashback" (só com o cashback ligado e visível).
export const CATEGORIAS_INDICACAO = [
  { id: 'livros', rotulo: 'Livros' },
  { id: 'diario', rotulo: 'Diário e escrita' },
  { id: 'bemestar', rotulo: 'Bem-estar' },
  { id: 'casa', rotulo: 'Casa e conforto' },
  { id: 'presentes', rotulo: 'Para presentear' },
  { id: 'outros', rotulo: 'Outros' },
];
const rotuloCategoria = (id) => CATEGORIAS_INDICACAO.find(c => c.id === id)?.rotulo || 'Outros';

function CartaoIndicacao({ item, onAbrir, onPedir, largura, comCashback }) {
  const [aberto, setAberto] = useState(false);
  const [erroImg, setErroImg] = useState(false);
  const imagem = urlDeImagem(item.imagemUrl);
  const longa = String(item.descricao || '').length > 110;
  const selo = comCashback ? seloCashback(item) : null;
  const rotuloBotao = textoBotaoAfiliado(item);
  return (
    <View style={[s.card, { width: largura }]}>
      <View style={s.imagemCaixa}>
        {imagem && !erroImg
          ? <Image source={{ uri: imagem }} style={s.imagem} resizeMode="contain" onError={() => setErroImg(true)} />
          : <View style={s.imagemVazia}><Ionicons name="gift-outline" size={30} color={colors.lilasIcone} /></View>}
      </View>
      <View style={s.corpo}>
        <View style={s.categoriaChip}><Text style={s.categoria}>{rotuloCategoria(item.categoria)}</Text></View>
        {!!selo && (
          <View style={s.selo}>
            <Ionicons name="sparkles" size={12} color={colors.sageFg} />
            <Text style={s.seloTxt}>{selo}</Text>
          </View>
        )}
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
        <Profundo
          externo={s.botaoExterno}
          estilo={s.botao}
          base={colors.botaoBase}
          sombra={s.botaoHalo}
          altura={4}
          onPress={() => onAbrir(item)}
          accessibilityLabel={rotuloBotao}
        >
          <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.botaoGrad} />
          <Text style={s.botaoTxt} numberOfLines={1}>{rotuloBotao}</Text>
          <Ionicons name="open-outline" size={15} color="white" />
        </Profundo>
        {!!selo && (
          <TouchableOpacity style={s.jaComprei} onPress={() => onPedir(item)} accessibilityRole="button" hitSlop={4}>
            <Text style={s.jaCompreiTxt}>Já comprei — pedir meu cashback</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function IndicacoesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { indicacoes, registrarClique, cashbackVisivel } = useApp();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [filtro, setFiltro] = useState('todas');
  const [pedindo, setPedindo] = useState(null);
  // Rastreios: itens cujo link ela já abriu pelo app (pré-requisito do cashback).
  const [clicados, setClicados] = useState(() => new Set());
  useEffect(() => {
    if (!uid || !cashbackVisivel) return undefined;
    return onSnapshot(query(collection(db, 'rastreiosAfiliados'), where('usuarioId', '==', uid)), (snap) => {
      setClicados(new Set(snap.docs.map(d => d.data().itemId)));
    }, () => {});
  }, [uid, cashbackVisivel]);
  const temCashback = cashbackVisivel && indicacoes.some(i => regraCashback(i));

  const categorias = useMemo(() => {
    const presentes = new Set(indicacoes.map(i => i.categoria || 'outros'));
    return CATEGORIAS_INDICACAO.filter(c => presentes.has(c.id));
  }, [indicacoes]);
  const lista = filtro === 'todas' ? indicacoes : indicacoes.filter(i => (i.categoria || 'outros') === filtro);

  const colunas = width >= 900 ? 3 : 2;
  const larguraUtil = width - spacing.lg * 2;
  const largura = (larguraUtil - (colunas - 1) * 12) / colunas;

  const abrir = (item) => {
    const url = normalizarUrl(item.link);
    if (!url) return;
    // Soma o clique e guarda o rastreio do cashback; se a função nova ainda
    // não estiver publicada, cai no contador antigo.
    httpsCallable(functions, 'registrarCliqueAfiliado')({ id: item.id })
      .then(r => { if (r?.data?.ok) setClicados(prev => new Set(prev).add(item.id)); else registrarClique('indicacao', item.id); })
      .catch(() => registrarClique('indicacao', item.id));
    Linking.openURL(url).catch(e => console.warn('[Achados] não abriu:', e?.message));
  };

  const pedirCashback = (item) => {
    if (!clicados.has(item.id)) {
      Alert.alert(
        'Comece pelo botão da loja',
        `Para ganhar o cashback, a compra precisa ser feita pelo nosso link. Toque em “${textoBotaoAfiliado(item)}”, compre por lá e depois volte aqui para pedir o seu crédito.`,
        [{ text: 'Entendi', style: 'cancel' }, { text: 'Abrir a loja', onPress: () => abrir(item) }],
      );
      return;
    }
    setPedindo(item);
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Achados da Atravessia</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <View style={s.coluna}>
          <Text style={s.intro}>Escolhemos com carinho livros, objetos e cuidados que podem acompanhar você nessa travessia.</Text>

          {temCashback && (
            <View style={s.comoFunciona}>
              <View style={s.comoTopo}>
                <View style={s.comoIcone}><Ionicons name="wallet-outline" size={18} color={colors.sageFg} /></View>
                <Text style={s.comoTit}>Compre e ganhe créditos</Text>
              </View>
              <Text style={s.comoTxt}>
                Você paga o mesmo preço da loja. Comprando pelo nosso link, a Atravessia recebe uma pequena comissão e devolve parte para você em créditos para usar no app.
              </Text>
              <Text style={s.comoPassos}>1. Toque no botão da loja e compre por lá.{'\n'}2. Volte aqui e toque em “Já comprei — pedir meu cashback”.{'\n'}3. Envie o número do pedido, o valor e um print. Depois da análise, o crédito entra no seu cashback.</Text>
              <TouchableOpacity style={s.meusPedidos} onPress={() => navigation.navigate('MeusPedidosCashback')} accessibilityRole="button">
                <Ionicons name="receipt-outline" size={16} color={colors.lilasTexto} />
                <Text style={s.meusPedidosTxt}>Meus pedidos de cashback</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.lilasTexto} />
              </TouchableOpacity>
            </View>
          )}

          {categorias.length > 1 && (
            <SeletorOpcoes
              titulo="Categoria"
              opcoes={[{ id: 'todas', rotulo: 'Todas' }, ...categorias].map(c => ({ id: c.id, label: c.rotulo }))}
              valor={filtro}
              onChange={setFiltro}
            />
          )}

          {lista.length === 0 ? (
            <View style={s.vazio}>
              <View style={s.vazioIcone}><Ionicons name="book-outline" size={28} color={colors.lilasIcone} /></View>
              <Text style={s.vazioTit}>Em breve</Text>
              <Text style={s.vazioTxt}>Nossos achados estão sendo preparados. Volte em breve.</Text>
            </View>
          ) : (
            <View style={s.grade}>
              {lista.map(item => <CartaoIndicacao key={item.id} item={item} onAbrir={abrir} onPedir={pedirCashback} largura={largura} comCashback={cashbackVisivel} />)}
            </View>
          )}

          <View style={s.aviso}>
            <Ionicons name="information-circle-outline" size={18} color={colors.lilasIcone} />
            <Text style={s.avisoTxt}>
              A Atravessia participa de programas de afiliados, como o Amazon Associados, e recebe uma comissão por compras qualificadas feitas por estes links. O preço para você não muda, e isso ajuda a manter o app.
            </Text>
          </View>
        </View>
      </ScrollView>

      <PedidoCashbackModal
        item={pedindo}
        uid={uid}
        onFechar={() => setPedindo(null)}
        onEnviado={() => {
          const loja = nomePlataforma(pedindo);
          setPedindo(null);
          Alert.alert('Pedido enviado', `Recebemos seu pedido! Vamos conferir sua compra na ${loja} e avisar você assim que o crédito for liberado.`,
            [{ text: 'Ver meus pedidos', onPress: () => navigation.navigate('MeusPedidosCashback') }, { text: 'OK' }]);
        }}
      />
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 1,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 28, color: colors.titulo },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  coluna: { width: '100%', gap: spacing.md },
  intro: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.texto2, textAlign: 'center', paddingHorizontal: 8 },
  trilho: { borderRadius: radius.full, overflow: 'hidden', backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz },
  filtros: { padding: 4, gap: 4 },
  filtro: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.full },
  filtroSel: {
    backgroundColor: colors.escuro ? colors.lav2 : colors.cardSolido,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 1,
  },
  filtroTxt: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2 },
  filtroTxtSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Cartão de vidro do produto (a foto fica sobre branco, como na loja)
  card: {
    backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz, overflow: 'hidden',
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  imagemCaixa: { height: 140, backgroundColor: colors.escuro ? colors.vidroTenue : '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  imagemVazia: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  imagem: { width: '86%', height: 124 },
  corpo: { padding: 12, gap: 6, flex: 1, minHeight: 176 },
  categoriaChip: { alignSelf: 'flex-start', backgroundColor: colors.lav1, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  categoria: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.lilasTexto, letterSpacing: 0.4 },
  titulo: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20, color: colors.titulo },
  descricao: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.texto2 },
  verMais: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lilasTexto },
  botaoExterno: { marginTop: 8 },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, paddingHorizontal: 10, overflow: 'hidden' },
  botaoGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  botaoHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 6 }, shadowOpacity: colors.escuro ? 0.4 : 0.24, shadowRadius: 10, elevation: 3 },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white', flexShrink: 1 },
  selo: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.escuro ? 'rgba(159,208,176,0.14)' : '#E1EEE5', borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  seloTxt: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.sageFg, flexShrink: 1 },
  jaComprei: { marginTop: 6, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, borderWidth: 1, borderColor: colors.bordaLuz, backgroundColor: colors.vidroTenue, paddingHorizontal: 8 },
  jaCompreiTxt: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.lilasTexto, textAlign: 'center' },
  comoFunciona: { backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz, padding: 16, gap: 8 },
  comoTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  comoIcone: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.escuro ? 'rgba(159,208,176,0.14)' : '#E1EEE5' },
  comoTit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo },
  comoTxt: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.texto2 },
  comoPassos: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.texto2 },
  meusPedidos: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2, paddingVertical: 6 },
  meusPedidosTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  vazio: { alignItems: 'center', gap: 8, padding: spacing.xl },
  vazioIcone: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  vazioTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo },
  vazioTxt: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center' },
  aviso: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.vidroTenue,
    borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.texto2 },
}));
