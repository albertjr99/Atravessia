import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator,
  Platform, useWindowDimensions, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { doc, onSnapshot, setDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { uploadToStorage } from '../../utils/storageUpload';
import { confirmar } from '../../utils/confirm';
import PlayerVideo from '../../components/PlayerVideo';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';

// Vídeos de apresentação (mesma tela do painel web: admin-web/src/Videos.jsx).
// Ficam em configuracoes/videos → { jornadas: {...}, parcerias: {...} }.
const VIDEOS = [
  { chave: 'jornadas', nome: 'Continue a travessia', tituloPadrao: 'Conheça o Continue a travessia' },
  { chave: 'parcerias', nome: 'Experimente a vida', tituloPadrao: 'Conheça o Experimente a vida' },
  // Não abre sozinho: fica na tela "Produtos Atravessia" (cartão na tela inicial).
  { chave: 'produtos', nome: 'Produtos Atravessia', tituloPadrao: 'Leve a Atravessia com você', loja: true },
];

// Escolhe um arquivo de vídeo e devolve { uri | file, nome, tipo }.
function escolherVideoWeb() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = (e) => resolve(e.target.files?.[0] || null);
    input.click();
  });
}

async function enviarVideo(chave) {
  const ts = Date.now();
  if (Platform.OS === 'web') {
    const file = await escolherVideoWeb();
    if (!file) return null;
    const { ref: sRef, uploadBytes, getDownloadURL } = require('firebase/storage');
    const { storage } = require('../../services/firebase');
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const caminho = `videos/${chave}_${ts}.${ext}`;
    const r = sRef(storage, caminho);
    await uploadBytes(r, file, { contentType: file.type || 'video/mp4' });
    return { url: await getDownloadURL(r), storagePath: caminho };
  }
  const res = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
  if (res.canceled) return null;
  const a = res.assets[0];
  const ext = (a.name?.split('.').pop() || 'mp4').toLowerCase();
  const caminho = `videos/${chave}_${ts}.${ext}`;
  const url = await uploadToStorage(a.uri, caminho, a.mimeType || 'video/mp4');
  return { url, storagePath: caminho };
}

// Campo de texto que, ao ser tocado, pede para a tela rolar até ele — assim o
// teclado não cobre o que está sendo digitado.
function Campo({ aoFocar, ...props }) {
  const ref = useRef(null);
  return <TextInput ref={ref} {...props} onFocus={(e) => { aoFocar?.(ref); props.onFocus?.(e); }} />;
}

function CartaoVideo({ info, dados, aoFocar }) {
  const { width } = useWindowDimensions();
  const [titulo, setTitulo] = useState(dados?.titulo || info.tituloPadrao);
  const [enviando, setEnviando] = useState(false);
  const [verPrevia, setVerPrevia] = useState(false);
  const [descricao, setDescricao] = useState(dados?.descricao || '');
  const [link, setLink] = useState(dados?.link || '');
  const [textoBotao, setTextoBotao] = useState(dados?.textoBotao || '');
  useEffect(() => {
    setDescricao(dados?.descricao || ''); setLink(dados?.link || ''); setTextoBotao(dados?.textoBotao || '');
  }, [dados?.descricao, dados?.link, dados?.textoBotao]);

  const salvarLoja = async () => {
    try {
      await salvar({
        descricao: descricao.trim(), link: link.trim(), textoBotao: textoBotao.trim(),
        titulo: titulo.trim() || info.tituloPadrao, ativo: dados?.ativo !== false,
      });
      Alert.alert('', 'Informações salvas.');
    } catch (e) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar.');
    }
  };

  useEffect(() => { setTitulo(dados?.titulo || info.tituloPadrao); }, [dados?.titulo, info.tituloPadrao]);

  const salvar = (campos) => setDoc(doc(db, 'configuracoes', 'videos'), {
    [info.chave]: { ...(dados || {}), ...campos, atualizadoEm: serverTimestamp() },
  }, { merge: true });

  const trocar = async () => {
    setEnviando(true);
    try {
      const novo = await enviarVideo(info.chave);
      if (!novo) return;
      await salvar({ ...novo, titulo: titulo.trim() || info.tituloPadrao, ativo: true });
      setVerPrevia(false);
      Alert.alert('', 'Vídeo publicado no app!');
    } catch (e) {
      Alert.alert('Erro no envio', e?.message || 'Tente novamente. Vídeos muito grandes podem falhar no celular — use o painel web.');
    } finally {
      setEnviando(false);
    }
  };

  const remover = () => confirmar(
    'Remover vídeo',
    `O vídeo de "${info.nome}" deixa de aparecer no app.`,
    () => setDoc(doc(db, 'configuracoes', 'videos'), { [info.chave]: deleteField() }, { merge: true })
      .catch(e => Alert.alert('Erro', e?.message || 'Não foi possível remover.')),
    'Remover',
  );

  return (
    <View style={s.card}>
      <View style={s.cardTopo}>
        <Ionicons name="play-circle-outline" size={20} color={colors.lav5} />
        <Text style={s.cardTit}>{info.nome}</Text>
        {!!dados?.url && (
          <Text style={[s.tag, dados.ativo === false && s.tagOculto]}>{dados.ativo === false ? 'Oculto' : 'No app'}</Text>
        )}
      </View>

      {dados?.url ? (
        verPrevia ? (
          <PlayerVideo url={dados.url} titulo={titulo} largura={Math.min(width - 80, 520)} maxAltura={360} />
        ) : (
          <TouchableOpacity style={s.previa} onPress={() => setVerPrevia(true)}>
            <Ionicons name="play" size={22} color="white" />
            <Text style={s.previaTxt}>Ver o vídeo</Text>
          </TouchableOpacity>
        )
      ) : (
        <Text style={s.vazio}>Nenhum vídeo enviado ainda.</Text>
      )}

      <Text style={s.label}>Título exibido no app</Text>
      <Campo
        aoFocar={aoFocar}
        style={s.input}
        value={titulo}
        onChangeText={setTitulo}
        onEndEditing={() => dados?.url && salvar({ titulo: titulo.trim() || info.tituloPadrao }).catch(() => {})}
      />

      {info.loja && (
        <View style={s.loja}>
          <Text style={s.label}>Texto da tela</Text>
          <Campo aoFocar={aoFocar} style={[s.input, { minHeight: 90, textAlignVertical: 'top' }]} multiline value={descricao} onChangeText={setDescricao}
            placeholder="Canecas, cadernos e outros carinhos com a marca da Atravessia..." placeholderTextColor={colors.tl} />
          <Text style={s.label}>Link para comprar (WhatsApp, Instagram ou loja)</Text>
          <Campo aoFocar={aoFocar} style={s.input} value={link} onChangeText={setLink} autoCapitalize="none" placeholder="https://..." placeholderTextColor={colors.tl} />
          <Text style={s.label}>Texto do botão</Text>
          <Campo aoFocar={aoFocar} style={s.input} value={textoBotao} onChangeText={setTextoBotao} placeholder="Quero meus produtos" placeholderTextColor={colors.tl} />
          <TouchableOpacity style={[s.btnSec, { alignSelf: 'flex-start', marginTop: 4 }]} onPress={salvarLoja}>
            <Text style={s.btnSecTxt}>Salvar informações</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.botoes}>
        <TouchableOpacity style={[s.btn, enviando && { opacity: 0.6 }]} onPress={trocar} disabled={enviando}>
          {enviando ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="cloud-upload-outline" size={16} color="white" />}
          <Text style={s.btnTxt}>{enviando ? 'Enviando...' : dados?.url ? 'Trocar vídeo' : 'Enviar vídeo'}</Text>
        </TouchableOpacity>
        {!!dados?.url && (
          <>
            <TouchableOpacity style={s.btnSec} onPress={() => salvar({ ativo: dados.ativo === false }).catch(() => {})}>
              <Text style={s.btnSecTxt}>{dados.ativo === false ? 'Mostrar' : 'Ocultar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnIcone} onPress={remover}>
              <Ionicons name="trash-outline" size={17} color={colors.peach2} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

export default function AdminVideosScreen() {
  // Teclado: a tela ganha espaço extra embaixo enquanto ele está aberto e rola
  // até o campo tocado, deixando-o visível acima do teclado.
  const rolagem = useRef(null);
  const conteudo = useRef(null);
  const [alturaTeclado, setAlturaTeclado] = useState(0);
  useEffect(() => {
    const mostrar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setAlturaTeclado(e?.endCoordinates?.height || 0));
    const esconder = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setAlturaTeclado(0));
    return () => { mostrar.remove(); esconder.remove(); };
  }, []);
  const rolarAte = (campoRef) => {
    // Espera o teclado abrir para calcular a posição.
    setTimeout(() => {
      const campo = campoRef?.current;
      if (!campo || !conteudo.current || !rolagem.current) return;
      campo.measureLayout(
        conteudo.current,
        (_x, y) => rolagem.current?.scrollTo({ y: Math.max(0, y - 110), animated: true }),
        () => {},
      );
    }, Platform.OS === 'ios' ? 50 : 300);
  };

  const [config, setConfig] = useState({});
  const [erro, setErro] = useState('');

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'videos'), (snap) => {
    setConfig(snap.exists() ? snap.data() : {});
    setErro('');
  }, (e) => setErro(e?.message || 'Não foi possível carregar os vídeos.')), []);

  return (
    <AdminLayout currentScreen="AdminVideos">
      <AdminSubTabs grupo="biblioteca" atual="AdminVideos" />
      <ScrollView
        ref={rolagem}
        contentContainerStyle={[s.scroll, { paddingBottom: 48 + alturaTeclado }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View ref={conteudo}>
        <Text style={s.title}>Vídeos de apresentação</Text>
        <Text style={s.sub}>
          Os vídeos de apresentação tocam sozinhos na primeira vez que a usuária abre a tela; depois ficam no botão “Assistir à apresentação”. O de Produtos fica na tela própria, com o link de compra.
          Para vídeos grandes, prefira enviar pelo painel web.
        </Text>
        {!!erro && <Text style={s.erro}>Não foi possível carregar: {erro}</Text>}
        {VIDEOS.map(v => <CartaoVideo key={v.chave} info={v} dados={config[v.chave]} aoFocar={rolarAte} />)}
        </View>
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  title: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, lineHeight: 19, marginBottom: spacing.lg },
  erro: { fontFamily: fonts.body, fontSize: 12.5, color: colors.roseFg, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md, gap: 8,
  },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTit: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td },
  tag: {
    fontFamily: fonts.bodyBold, fontSize: 11, color: colors.sageFg, backgroundColor: colors.sage + '26',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, overflow: 'hidden',
  },
  tagOculto: { color: colors.tm, backgroundColor: colors.border },
  previa: {
    height: 120, borderRadius: radius.md, backgroundColor: '#17141f',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  previaTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
  vazio: { fontFamily: fonts.body, fontSize: 13, color: colors.tl, paddingVertical: spacing.md, textAlign: 'center' },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.tm, marginTop: 4 },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 9, fontFamily: fonts.body, fontSize: 13.5, color: colors.td,
  },
  botoes: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.lav4,
    borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 16,
  },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
  btnSec: { borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: colors.lav1 },
  btnSecTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav5 },
  btnIcone: { padding: 8 },
  loja: { backgroundColor: colors.lav1, borderRadius: radius.md, padding: spacing.md, gap: 6 },
}), { escalar: false });
