import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, Image, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow, criarEstilos } from '../../theme';
import { LavandaBg, ScriptTitle } from '../../components';
import PlayerVideo from '../../components/PlayerVideo';
import { LinearGradient } from 'expo-linear-gradient';
import { Profundo } from '../../components/Efeitos';
import TextoComLinks from '../../components/TextoComLinks';
import { abrirLink } from '../../utils/abrirLink';

// Produtos Atravessia: canecas, cadernos e outros itens com a marca do app.
// Vídeo, texto e link de compra vêm de configuracoes/videos.produtos, editados
// no painel (Biblioteca → Produtos Atravessia ou Apresentações) — dá para
// trocar tudo sem publicar um novo app. Abaixo do vídeo vêm os itens de
// divulgação da coleção `produtosItens` (texto, imagem, link e vídeo), na ordem
// definida no painel; só os ativos aparecem.
const TEXTO_PADRAO = 'Canecas, cadernos e outros carinhos com a marca da Atravessia, para ter por perto no dia a dia.';

// Botão principal: degradê lilás com "degrau" que afunda ao toque.
function BotaoLilas({ onPress, children, rotulo, externo, desativado }) {
  return (
    <Profundo
      externo={[externo, desativado && { opacity: 0.6 }]}
      estilo={s.btnFace}
      base={colors.botaoBase}
      sombra={s.btnHalo}
      onPress={desativado ? undefined : onPress}
      accessibilityLabel={rotulo}
    >
      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.btnGrad} />
      {children}
    </Profundo>
  );
}

// Pela `ordem`; sem ordem vão para o fim, mais antigos primeiro.
function ordenarItens(lista) {
  const ms = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : typeof v?.seconds === 'number' ? v.seconds * 1000 : Infinity);
  return [...lista].sort((a, b) => {
    const oa = typeof a.ordem === 'number' ? a.ordem : Infinity;
    const ob = typeof b.ordem === 'number' ? b.ordem : Infinity;
    return oa !== ob ? oa - ob : ms(a.criadoEm) - ms(b.criadoEm);
  });
}

// Vídeo que o player do app consegue tocar (arquivo enviado pelo painel ou
// endereço direto de um arquivo). Links de YouTube/Instagram abrem fora.
const ehVideoDireto = (item) => !!item.videoPath
  || /firebasestorage\.googleapis\.com/i.test(item.videoUrl || '')
  || /\.(mp4|m4v|mov|webm|m3u8)(\?|#|$)/i.test(item.videoUrl || '');

// Imagem na largura toda, respeitando a proporção original.
function ImagemItem({ url, titulo }) {
  const [proporcao, setProporcao] = useState(4 / 3);
  useEffect(() => {
    let vivo = true;
    Image.getSize(url, (w, h) => { if (vivo && w > 0 && h > 0) setProporcao(Math.max(0.6, Math.min(w / h, 2.2))); }, () => {});
    return () => { vivo = false; };
  }, [url]);
  return (
    <Image source={{ uri: url }} style={[s.itemImg, { aspectRatio: proporcao }]} resizeMode="cover"
      accessibilityLabel={titulo || 'Imagem do produto'} />
  );
}

// O player só é montado ao tocar, para a tela não carregar vários vídeos de uma vez.
function VideoItem({ item, largura, maxAltura }) {
  const [tocando, setTocando] = useState(false);
  if (!ehVideoDireto(item)) {
    return (
      <TouchableOpacity style={s.btnVidro} onPress={() => abrirLink(item.videoUrl)} activeOpacity={0.85}>
        <Ionicons name="play-circle-outline" size={19} color={colors.lilasTexto} />
        <Text style={s.btnVidroTxt}>Assistir ao vídeo</Text>
      </TouchableOpacity>
    );
  }
  if (tocando) {
    return (
      <View style={s.video}>
        <PlayerVideo url={item.videoUrl} titulo={item.titulo} largura={largura} maxAltura={maxAltura} />
      </View>
    );
  }
  return (
    <TouchableOpacity style={s.videoCapa} onPress={() => setTocando(true)} activeOpacity={0.88}
      accessibilityLabel={`Assistir ${item.titulo || 'ao vídeo'}`}>
      <View style={s.videoPlay}><Ionicons name="play" size={26} color="white" style={{ marginLeft: 3 }} /></View>
      <Text style={s.videoCapaTxt}>Toque para assistir</Text>
    </TouchableOpacity>
  );
}

function ItemProduto({ item, largura, maxAltura }) {
  const larguraInterna = largura - spacing.lg * 2;
  return (
    <View style={s.item}>
      {item.tipo !== 'video' && item.imagemUrl ? <ImagemItem url={item.imagemUrl} titulo={item.titulo} /> : null}
      <View style={s.itemCorpo}>
        {item.titulo ? <Text style={s.itemTit}>{item.titulo}</Text> : null}
        {item.descricao ? <TextoComLinks style={s.itemTxt}>{item.descricao}</TextoComLinks> : null}
        {item.tipo === 'video' && item.videoUrl
          ? <VideoItem item={item} largura={larguraInterna} maxAltura={maxAltura} />
          : null}
        {item.link ? (
          <BotaoLilas onPress={() => abrirLink(item.link)} rotulo={item.botaoTexto || 'Saiba mais'}>
            <Ionicons name={item.tipo === 'link' ? 'open-outline' : 'bag-handle-outline'} size={18} color="white" />
            <Text style={s.btnTxt}>{item.botaoTexto || 'Saiba mais'}</Text>
          </BotaoLilas>
        ) : null}
      </View>
    </View>
  );
}

export default function ProdutosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [dados, setDados] = useState(undefined); // undefined = carregando

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'videos'), (snap) => {
    const p = snap.exists() ? snap.data()?.produtos : null;
    setDados(p && p.ativo !== false ? p : null);
  }, (e) => {
    console.warn('[Produtos] não foi possível carregar:', e?.message);
    setDados(null);
  }), []);

  const [itens, setItens] = useState([]);
  useEffect(() => onSnapshot(collection(db, 'produtosItens'), (snap) => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.ativo !== false);
    setItens(ordenarItens(docs));
  }, (e) => console.warn('[Produtos] itens:', e?.message)), []);

  const largura = width - spacing.lg * 2;

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Produtos Atravessia</Text>
        <View style={{ width: 44 }} />
      </View>

      {dados === undefined ? (
        <View style={s.carregando}><ActivityIndicator color={colors.lav4} /></View>
      ) : (
        <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          <View style={s.coluna}>
            <ScriptTitle size={30} style={s.titulo}>{dados?.titulo || 'Leve a Atravessia com você'}</ScriptTitle>

            {dados?.url ? (
              <View style={s.video}>
                <PlayerVideo url={dados.url} titulo={dados.titulo} autoPlay={false} largura={largura} maxAltura={height * 0.62} />
              </View>
            ) : null}

            {/* Cartão-joia dourado (degradê com "degrau" embaixo) */}
            <View style={s.cartao}>
              <LinearGradient colors={[colors.joiaDourado[0], colors.joiaDourado[1]]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.cartaoGrad} />
              <View style={s.icones}>
                {['cafe-outline', 'book-outline', 'gift-outline'].map(ic => (
                  <View key={ic} style={s.iconeCirculo}><Ionicons name={ic} size={20} color={colors.joiaDouradoTexto} /></View>
                ))}
              </View>
              <TextoComLinks style={s.texto}>{dados?.descricao || TEXTO_PADRAO}</TextoComLinks>
            </View>

            {dados?.link ? (
              <BotaoLilas onPress={() => abrirLink(dados.link)} rotulo={dados.textoBotao || 'Quero meus produtos'}>
                <Ionicons name="bag-handle-outline" size={19} color="white" />
                <Text style={s.btnTxt}>{dados.textoBotao || 'Quero meus produtos'}</Text>
              </BotaoLilas>
            ) : itens.length === 0 ? (
              <Text style={s.emBreve}>Em breve você poderá adquirir os produtos por aqui.</Text>
            ) : null}

            {itens.map(item => (
              <ItemProduto key={item.id} item={item} largura={largura} maxAltura={height * 0.62} />
            ))}
          </View>
        </ScrollView>
      )}
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
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 22, overflow: 'hidden' },
  btnGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 5 },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: 'white' },
  btnVidro: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingHorizontal: 20,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro,
  },
  btnVidroTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  coluna: { width: '100%', gap: spacing.lg },
  titulo: { textAlign: 'center', color: colors.titulo, lineHeight: 38, marginTop: spacing.sm },
  video: { alignItems: 'center', borderRadius: 24, overflow: 'hidden' },
  cartao: {
    borderRadius: 26, padding: spacing.xl, gap: spacing.md, overflow: 'hidden',
    backgroundColor: colors.joiaDourado[1],
    borderBottomWidth: 5, borderBottomColor: colors.joiaDourado[2],
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 12 }, shadowOpacity: colors.escuro ? 0.4 : 0.14, shadowRadius: 22, elevation: 3,
  },
  cartaoGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.5)' },
  icones: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  iconeCirculo: {
    width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.escuro ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
  },
  texto: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25, color: colors.joiaDouradoTexto, textAlign: 'center' },
  emBreve: { fontFamily: fonts.body, fontSize: 13.5, color: colors.texto2, textAlign: 'center' },
  // Itens de divulgação: cartão de vidro com imagem no topo.
  item: {
    borderRadius: 26, overflow: 'hidden',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  itemImg: { width: '100%', backgroundColor: colors.lav1 },
  itemCorpo: { padding: spacing.lg, gap: spacing.md },
  itemTit: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, color: colors.titulo },
  itemTxt: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 24, color: colors.td },
  videoCapa: {
    height: 180, borderRadius: 20, backgroundColor: '#1C1726',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  videoPlay: {
    width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.botaoForte, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  videoCapaTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: 'white' },
}));
