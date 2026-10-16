import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert,
  Platform, ActivityIndicator, Modal, KeyboardAvoidingView, Image, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch,
} from 'firebase/firestore';
import { ref as sRef, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { uploadToStorage } from '../../utils/storageUpload';
import { confirmar } from '../../utils/confirm';
import { db, storage } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, BotaoAdmin, Degrade } from './adminEstilo';
import { VIDEOS, CartaoVideo } from './AdminVideosScreen';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';

// "Produtos Atravessia" na Biblioteca do painel (mesma tela do painel web:
// admin-web/src/ProdutosAtravessia.jsx). Reúne o vídeo de produtos
// (configuracoes/videos → produtos, o mesmo cartão da aba Apresentações) e o
// espaço de divulgação: itens da coleção `produtosItens`, exibidos abaixo do
// vídeo na tela "Produtos Atravessia" do app, na ordem definida aqui.
// Modelo de dados igual ao do painel web — não renomear campos.
const COLECAO = 'produtosItens';

const TIPOS = [
  { id: 'texto',  label: 'Texto',  icon: 'document-text-outline', dica: 'Um recado, uma novidade ou a história de um produto.' },
  { id: 'imagem', label: 'Imagem', icon: 'image-outline',         dica: 'Foto de produto, coleção ou campanha.' },
  { id: 'link',   label: 'Link',   icon: 'link-outline',          dica: 'Leva para a loja, WhatsApp, Instagram ou qualquer página.' },
  { id: 'video',  label: 'Vídeo',  icon: 'videocam-outline',      dica: 'Vídeo enviado aqui ou endereço de um vídeo.' },
];
const tipoInfo = (id) => TIPOS.find(t => t.id === id) || TIPOS[0];

function novoForm(tipo = 'texto') {
  return {
    tipo, titulo: '', descricao: '',
    imagemUrl: '', imagemPath: '',
    link: '', botaoTexto: '',
    videoUrl: '', videoPath: '',
    ativo: true,
  };
}

function millis(v) {
  if (!v) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const n = new Date(v).getTime();
  return isNaN(n) ? null : n;
}

// Pela `ordem`; empate ou sem ordem: mais antigos primeiro. Nada é descartado.
function ordenar(lista) {
  return [...lista].sort((a, b) => {
    const oa = typeof a.ordem === 'number' ? a.ordem : Infinity;
    const ob = typeof b.ordem === 'number' ? b.ordem : Infinity;
    if (oa !== ob) return oa - ob;
    return (millis(a.criadoEm) ?? Infinity) - (millis(b.criadoEm) ?? Infinity);
  });
}

function comHttps(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
}

function nomeSeguro(nome, padrao) {
  const limpo = String(nome || '').trim().replace(/\s+/g, '_').replace(/[^\w.\-]/g, '');
  return limpo || padrao;
}

function avisar(titulo, msg) {
  if (Platform.OS === 'web') { window.alert(msg ? `${titulo}\n\n${msg}` : titulo); return; }
  Alert.alert(titulo, msg);
}

async function apagarArquivo(path) {
  if (!path) return;
  try { await deleteObject(sRef(storage, path)); } catch {}
}

function escolherArquivoWeb(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => resolve(e.target.files?.[0] || null);
    input.click();
  });
}

async function enviarArquivoWeb(file, path, padraoMime) {
  const r = sRef(storage, path);
  await uploadBytes(r, file, { contentType: file.type || padraoMime });
  return getDownloadURL(r);
}

export default function AdminProdutosScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const largo = width >= 700;

  const [config, setConfig] = useState({});
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLeitura, setErroLeitura] = useState('');
  const [tentativa, setTentativa] = useState(0);

  const [mostraModal, setMostraModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(novoForm());
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(''); // '' | 'imagem' | 'video'
  // Arquivos enviados com o modal aberto — apagados se não forem usados.
  const [enviadosSessao, setEnviadosSessao] = useState([]);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'videos'),
    (snap) => setConfig(snap.exists() ? snap.data() : {}),
    (e) => console.warn('[AdminProdutos] vídeo:', e?.message)), []);

  useEffect(() => {
    setCarregando(true);
    setErroLeitura('');
    return onSnapshot(
      collection(db, COLECAO),
      (snap) => {
        setItens(ordenar(snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))));
        setCarregando(false);
        setErroLeitura('');
      },
      (err) => {
        setCarregando(false);
        setErroLeitura(
          err?.code === 'permission-denied'
            ? 'Sem permissão para ler os itens. Confira se esta conta é administradora.'
            : `Não foi possível carregar os itens (${err?.code || err?.message || 'erro desconhecido'}).`
        );
      },
    );
  }, [tentativa]);

  const infoVideo = VIDEOS.find(v => v.chave === 'produtos');
  const ativos = useMemo(() => itens.filter(i => i.ativo !== false).length, [itens]);

  // ── Modal ────────────────────────────────────────────────────────────────
  const abrirNovo = (tipo = 'texto') => {
    setEditando(null); setForm(novoForm(tipo)); setErroForm(''); setEnviadosSessao([]); setMostraModal(true);
  };

  const abrirEdicao = (item) => {
    setEditando(item);
    setForm({
      tipo: TIPOS.some(t => t.id === item.tipo) ? item.tipo : 'texto',
      titulo: item.titulo || '',
      descricao: item.descricao || '',
      imagemUrl: item.imagemUrl || '',
      imagemPath: item.imagemPath || '',
      link: item.link || '',
      botaoTexto: item.botaoTexto || '',
      videoUrl: item.videoUrl || '',
      videoPath: item.videoPath || '',
      ativo: item.ativo !== false,
    });
    setErroForm(''); setEnviadosSessao([]); setMostraModal(true);
  };

  const fecharModal = async () => {
    if (salvando || enviando) return;
    setMostraModal(false);
    const descartar = enviadosSessao;
    setEnviadosSessao([]); setForm(novoForm()); setEditando(null); setErroForm('');
    await Promise.all(descartar.map(apagarArquivo));
  };

  const escolherImagem = async () => {
    setErroForm('');
    try {
      let url; let path;
      if (Platform.OS === 'web') {
        const file = await escolherArquivoWeb('image/*');
        if (!file) return;
        setEnviando('imagem');
        path = `produtos/${Date.now()}_${nomeSeguro(file.name, 'imagem.jpg')}`;
        url = await enviarArquivoWeb(file, path, 'image/jpeg');
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          setErroForm('Permita o acesso à galeria nas configurações do aparelho para escolher uma imagem.');
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
        if (res.canceled || !res.assets?.length) return;
        const a = res.assets[0];
        setEnviando('imagem');
        const mime = a.mimeType || 'image/jpeg';
        const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        path = `produtos/${Date.now()}_${nomeSeguro(a.fileName, `imagem.${ext}`)}`;
        url = await uploadToStorage(a.uri, path, mime);
      }
      setEnviadosSessao(prev => [...prev, path]);
      setForm(f => ({ ...f, imagemUrl: url, imagemPath: path }));
    } catch (err) {
      setErroForm(`Erro no envio da imagem: ${err?.code || err?.message || 'tente novamente.'}`);
    } finally {
      setEnviando('');
    }
  };

  const escolherVideo = async () => {
    setErroForm('');
    try {
      let url; let path;
      const ts = Date.now();
      if (Platform.OS === 'web') {
        const file = await escolherArquivoWeb('video/*');
        if (!file) return;
        setEnviando('video');
        const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
        path = `produtos/video_${ts}.${ext}`;
        url = await enviarArquivoWeb(file, path, 'video/mp4');
      } else {
        const res = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
        if (res.canceled || !res.assets?.length) return;
        const a = res.assets[0];
        setEnviando('video');
        const ext = (a.name?.split('.').pop() || 'mp4').toLowerCase();
        path = `produtos/video_${ts}.${ext}`;
        url = await uploadToStorage(a.uri, path, a.mimeType || 'video/mp4');
      }
      setEnviadosSessao(prev => [...prev, path]);
      setForm(f => ({ ...f, videoUrl: url, videoPath: path }));
    } catch (err) {
      setErroForm(`Erro no envio do vídeo: ${err?.code || err?.message || 'tente novamente. Vídeos grandes podem falhar no celular — use o painel web.'}`);
    } finally {
      setEnviando('');
    }
  };

  const salvar = async () => {
    const { tipo } = form;
    const titulo = form.titulo.trim();
    const descricao = form.descricao.trim();
    const link = comHttps(form.link);
    const videoUrl = comHttps(form.videoUrl);
    if (tipo === 'texto' && !titulo && !descricao) { setErroForm('Escreva um título ou uma descrição.'); return; }
    if (tipo === 'imagem' && !form.imagemUrl) { setErroForm('Escolha a imagem antes de salvar.'); return; }
    if (tipo === 'link' && !link) { setErroForm('Informe o endereço do link.'); return; }
    if (tipo === 'video' && !videoUrl) { setErroForm('Envie um vídeo ou cole o endereço dele.'); return; }

    const dados = {
      tipo, titulo, descricao, link,
      botaoTexto: form.botaoTexto.trim(),
      imagemUrl: tipo === 'video' ? '' : form.imagemUrl,
      imagemPath: tipo === 'video' ? '' : form.imagemPath,
      videoUrl: tipo === 'video' ? videoUrl : '',
      videoPath: tipo === 'video' ? form.videoPath : '',
      ativo: !!form.ativo,
    };

    setSalvando(true);
    setErroForm('');
    try {
      if (editando) {
        await updateDoc(doc(db, COLECAO, editando.id), { ...dados, atualizadoEm: serverTimestamp() });
      } else {
        const maior = itens.reduce((m, i) => (typeof i.ordem === 'number' && i.ordem > m ? i.ordem : m), -1);
        await addDoc(collection(db, COLECAO), { ...dados, ordem: maior + 1, criadoEm: serverTimestamp() });
      }
      // Limpa do Storage o que deixou de ser usado.
      const usados = [dados.imagemPath, dados.videoPath].filter(Boolean);
      const sobras = enviadosSessao.filter(p => !usados.includes(p));
      if (editando?.imagemPath && !usados.includes(editando.imagemPath)) sobras.push(editando.imagemPath);
      if (editando?.videoPath && !usados.includes(editando.videoPath)) sobras.push(editando.videoPath);
      setEnviadosSessao([]); setMostraModal(false); setForm(novoForm()); setEditando(null);
      await Promise.all(sobras.map(apagarArquivo));
    } catch (err) {
      setErroForm(`Não foi possível salvar: ${err?.code || err?.message || 'tente novamente.'}`);
    } finally {
      setSalvando(false);
    }
  };

  // ── Ações da lista ───────────────────────────────────────────────────────
  const alternarAtivo = async (item) => {
    try {
      await updateDoc(doc(db, COLECAO, item.id), { ativo: item.ativo === false, atualizadoEm: serverTimestamp() });
    } catch (err) {
      avisar('Erro', `Não foi possível alterar: ${err?.code || err?.message || 'tente novamente.'}`);
    }
  };

  const excluir = (item) => confirmar(
    'Excluir item',
    `Excluir "${item.titulo || 'item sem título'}"? Ele deixa de aparecer no app.`,
    async () => {
      try {
        await deleteDoc(doc(db, COLECAO, item.id));
        await apagarArquivo(item.imagemPath);
        await apagarArquivo(item.videoPath);
      } catch (err) {
        avisar('Erro', `Não foi possível excluir: ${err?.code || err?.message || 'tente novamente.'}`);
      }
    },
    'Excluir',
  );

  // Troca com o vizinho e regrava a ordem de todos (0, 1, 2...).
  const mover = async (idx, dir) => {
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= itens.length) return;
    const lista = [...itens];
    [lista[idx], lista[alvo]] = [lista[alvo], lista[idx]];
    try {
      const batch = writeBatch(db);
      lista.forEach((it, i) => { if (it.ordem !== i) batch.update(doc(db, COLECAO, it.id), { ordem: i }); });
      await batch.commit();
    } catch (err) {
      avisar('Erro', `Não foi possível reordenar: ${err?.code || err?.message || 'tente novamente.'}`);
    }
  };

  const mudarTipo = (tipo) => { setErroForm(''); setForm(f => ({ ...f, tipo })); };

  // ── Render ───────────────────────────────────────────────────────────────
  const renderItem = (item, idx) => {
    const info = tipoInfo(item.tipo);
    const ativo = item.ativo !== false;
    return (
      <View key={item.id} style={[s.itemCard, !ativo && s.itemInativo]}>
        <View style={s.itemTop}>
          {item.imagemUrl ? (
            <Image source={{ uri: item.imagemUrl }} style={s.thumbImg} resizeMode="cover" />
          ) : (
            <View style={s.thumb}><Ionicons name={info.icon} size={22} color={acento('dourado').tinta} /></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[s.itemTit, !ativo && { color: colors.tl }]} numberOfLines={2}>{item.titulo || 'Sem título'}</Text>
            {item.descricao ? <Text style={s.itemDesc} numberOfLines={3}>{item.descricao}</Text> : null}
            {item.link ? <Text style={s.itemLink} numberOfLines={1}>{item.link}</Text> : null}
            {item.tipo === 'video' && item.videoUrl ? (
              <Text style={s.itemLink} numberOfLines={1}>{item.videoPath ? 'Vídeo enviado' : item.videoUrl}</Text>
            ) : null}
            <View style={s.badgeRow}>
              <View style={s.badge}>
                <Ionicons name={info.icon} size={13} color={colors.texto2} />
                <Text style={s.badgeTxt}>{info.label}</Text>
              </View>
              {item.link ? (
                <View style={s.badge}><Text style={s.badgeTxt}>Botão: {item.botaoTexto || 'Saiba mais'}</Text></View>
              ) : null}
              {!ativo ? <View style={s.badge}><Text style={s.badgeTxt}>Inativo</Text></View> : null}
            </View>
          </View>
        </View>
        <View style={s.acoes}>
          <TouchableOpacity onPress={() => mover(idx, -1)} disabled={idx === 0} style={[s.acaoBtn, idx === 0 && s.acaoOff]} accessibilityLabel="Subir">
            <Ionicons name="arrow-up" size={18} color={colors.lilasIcone} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => mover(idx, 1)} disabled={idx === itens.length - 1} style={[s.acaoBtn, idx === itens.length - 1 && s.acaoOff]} accessibilityLabel="Descer">
            <Ionicons name="arrow-down" size={18} color={colors.lilasIcone} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => alternarAtivo(item)} style={s.acaoBtn} accessibilityLabel={ativo ? 'Desativar' : 'Ativar'}>
            <Ionicons name={ativo ? 'eye-outline' : 'eye-off-outline'} size={18} color={ativo ? colors.lilasIcone : colors.tl} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => abrirEdicao(item)} style={s.acaoBtn} accessibilityLabel="Editar">
            <Ionicons name="create-outline" size={18} color={colors.lilasIcone} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => excluir(item)} style={s.acaoBtn} accessibilityLabel="Excluir">
            <Ionicons name="trash-outline" size={18} color={colors.roseTexto} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const t = tipoInfo(form.tipo);

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminProdutos">
      <AdminSubTabs grupo="biblioteca" atual="AdminProdutos" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.sobre}>Biblioteca</Text>
        <Text style={s.pageTitle}>Produtos Atravessia</Text>
        <Text style={s.pageSub}>
          Tudo o que aparece na tela “Produtos Atravessia” do app: o vídeo no topo e, logo abaixo, os itens de divulgação.
        </Text>

        <View style={s.ajuda}>
          <Ionicons name="information-circle-outline" size={18} color={acento('lilas').texto} />
          <Text style={s.ajudaTxt}>
            O atalho na tela inicial aparece assim que houver vídeo, link de compra ou pelo menos um item ativo.
            O vídeo também pode ser editado na aba Apresentações.
          </Text>
        </View>

        {infoVideo ? <CartaoVideo info={infoVideo} dados={config.produtos} /> : null}

        <View style={s.headerRow}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Text style={s.secao}>Espaço de divulgação</Text>
            <Text style={s.legenda}>
              {itens.length === 0
                ? 'Textos, imagens, links e vídeos para apresentar os produtos.'
                : `${itens.length} ${itens.length === 1 ? 'item' : 'itens'} · ${ativos} no app`}
            </Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => abrirNovo()} activeOpacity={0.85}>
            <Degrade />
            <Ionicons name="add" size={16} color="white" />
            <Text style={s.addBtnTxt}>Novo item</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtroScroll} contentContainerStyle={s.filtroRow}>
          {TIPOS.map(tp => (
            <TouchableOpacity key={tp.id} style={s.chip} onPress={() => abrirNovo(tp.id)}>
              <Ionicons name={tp.icon} size={14} color={colors.texto2} />
              <Text style={s.chipTxt}>+ {tp.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {erroLeitura ? (
          <View style={s.erroBox}>
            <Ionicons name="alert-circle-outline" size={18} color={acento('rosa').texto} />
            <Text style={s.erroTxt}>{erroLeitura}</Text>
            <TouchableOpacity onPress={() => setTentativa(n => n + 1)} style={s.erroBtn}>
              <Text style={s.erroBtnTxt}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {carregando ? (
          <View style={s.vazio}><ActivityIndicator color={colors.lav4} /></View>
        ) : itens.length === 0 && !erroLeitura ? (
          <View style={s.vazio}>
            <Ionicons name="gift-outline" size={32} color={colors.tl} />
            <Text style={s.vazioTxt}>Nenhum item ainda. Comece com um texto, uma foto ou o link da loja.</Text>
          </View>
        ) : (
          <View>{itens.map(renderItem)}</View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal visible={mostraModal} animationType="slide" transparent onRequestClose={fecharModal}>
        <KeyboardAvoidingView style={[s.modalOverlay, largo && s.modalOverlayLargo]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[s.modalCard, largo && s.modalCardLargo]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
              <View style={s.form}>
                <View style={s.formHeader}>
                  <Text style={s.formTit}>{editando ? 'Editar item' : 'Novo item'}</Text>
                  <TouchableOpacity onPress={fecharModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.fechar}>
                    <Ionicons name="close" size={20} color={colors.td} />
                  </TouchableOpacity>
                </View>

                <Text style={s.label}>Tipo</Text>
                <View style={s.tipoRow}>
                  {TIPOS.map(tp => {
                    const sel = form.tipo === tp.id;
                    return (
                      <TouchableOpacity key={tp.id} style={[s.tipoOpc, sel && s.tipoOpcSel]} onPress={() => mudarTipo(tp.id)} activeOpacity={0.8}>
                        <Ionicons name={tp.icon} size={18} color={sel ? colors.lilasTexto : colors.texto2} />
                        <Text style={[s.tipoTxt, sel && { color: colors.lilasTexto }]}>{tp.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={s.dica}>{t.dica}</Text>

                <Text style={s.label}>Título{form.tipo === 'texto' ? '' : ' (opcional)'}</Text>
                <TextInput style={s.input} placeholder="Ex.: Caneca Atravessia" placeholderTextColor={colors.tl}
                  value={form.titulo} onChangeText={v => setForm(f => ({ ...f, titulo: v }))} />

                <Text style={s.label}>Descrição (opcional)</Text>
                <TextInput style={[s.input, form.tipo === 'texto' ? s.inputTexto : s.inputDescricao]}
                  placeholder="Conte sobre o produto, o material, o carinho por trás dele..." placeholderTextColor={colors.tl}
                  value={form.descricao} onChangeText={v => setForm(f => ({ ...f, descricao: v }))} multiline textAlignVertical="top" />

                {form.tipo !== 'video' ? (
                  <>
                    <Text style={s.label}>Imagem{form.tipo === 'imagem' ? ' *' : ' (opcional)'}</Text>
                    {form.imagemUrl ? (
                      <View style={s.previaWrap}>
                        <Image source={{ uri: form.imagemUrl }} style={s.previa} resizeMode="contain" />
                      </View>
                    ) : null}
                    <View style={s.linhaBtns}>
                      <TouchableOpacity style={[s.uploadBtn, { flex: 1 }, !!enviando && { opacity: 0.6 }]} onPress={escolherImagem} disabled={!!enviando} activeOpacity={0.8}>
                        {enviando === 'imagem'
                          ? <ActivityIndicator size="small" color={colors.lilasTexto} />
                          : <Ionicons name="image-outline" size={20} color={colors.lilasTexto} />}
                        <Text style={s.uploadTxt}>{enviando === 'imagem' ? 'Enviando imagem...' : form.imagemUrl ? 'Trocar imagem' : 'Escolher imagem'}</Text>
                      </TouchableOpacity>
                      {form.imagemUrl ? (
                        <TouchableOpacity style={s.acaoBtn} onPress={() => setForm(f => ({ ...f, imagemUrl: '', imagemPath: '' }))} accessibilityLabel="Remover imagem">
                          <Ionicons name="trash-outline" size={18} color={colors.roseTexto} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={s.label}>Vídeo *</Text>
                    {form.videoPath ? <Text style={s.dica}>Vídeo enviado pelo painel.</Text> : null}
                    <TouchableOpacity style={[s.uploadBtn, !!enviando && { opacity: 0.6 }]} onPress={escolherVideo} disabled={!!enviando} activeOpacity={0.8}>
                      {enviando === 'video'
                        ? <ActivityIndicator size="small" color={colors.lilasTexto} />
                        : <Ionicons name="cloud-upload-outline" size={20} color={colors.lilasTexto} />}
                      <Text style={s.uploadTxt}>{enviando === 'video' ? 'Enviando vídeo...' : form.videoUrl ? 'Trocar vídeo' : 'Enviar vídeo'}</Text>
                    </TouchableOpacity>
                    <Text style={s.label}>ou endereço do vídeo</Text>
                    <TextInput style={s.input} placeholder="https://.../video.mp4" placeholderTextColor={colors.tl}
                      value={form.videoPath ? '' : form.videoUrl}
                      onChangeText={v => setForm(f => ({ ...f, videoUrl: v, videoPath: '' }))}
                      autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                    <Text style={s.dica}>Arquivos de vídeo (MP4) tocam dentro do app. Links do YouTube ou Instagram abrem fora do app, pelo botão.</Text>
                  </>
                )}

                <View style={s.blocoLink}>
                  <Text style={[s.label, { marginTop: 0 }]}>Link{form.tipo === 'link' ? ' *' : ' (opcional)'}</Text>
                  <TextInput style={s.input} placeholder="Loja, WhatsApp, Instagram (https://...)" placeholderTextColor={colors.tl}
                    value={form.link} onChangeText={v => setForm(f => ({ ...f, link: v }))}
                    autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                  <Text style={s.label}>Texto do botão</Text>
                  <TextInput style={s.input} placeholder="Saiba mais" placeholderTextColor={colors.tl}
                    value={form.botaoTexto} onChangeText={v => setForm(f => ({ ...f, botaoTexto: v }))} />
                  <Text style={s.dica}>Com link, o item ganha um botão que abre o endereço. Sem texto, o botão diz “Saiba mais”.</Text>
                </View>

                <TouchableOpacity style={s.ativoRow} onPress={() => setForm(f => ({ ...f, ativo: !f.ativo }))} activeOpacity={0.8}>
                  <Ionicons name={form.ativo ? 'checkbox' : 'square-outline'} size={22} color={form.ativo ? colors.lilasTexto : colors.texto2} />
                  <Text style={s.ativoTxt}>Visível no app</Text>
                </TouchableOpacity>

                {erroForm ? (
                  <View style={s.erroForm}>
                    <Ionicons name="alert-circle-outline" size={16} color={acento('rosa').texto} />
                    <Text style={s.erroFormTxt}>{erroForm}</Text>
                  </View>
                ) : null}

                <View style={s.formBtns}>
                  <BotaoAdmin title="Cancelar" variant="secondary" onPress={fecharModal} disabled={salvando || !!enviando} style={{ flex: 1, marginRight: spacing.sm }} />
                  <BotaoAdmin title={salvando ? 'Salvando...' : 'Salvar'} onPress={salvar} disabled={salvando || !!enviando} style={{ flex: 1 }} />
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 32 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginTop: spacing.sm, marginBottom: spacing.md },
  secao: est.secao(),
  legenda: est.legenda(),
  addBtn: { ...est.botao(), minHeight: 46, paddingHorizontal: 18 },
  addBtnTxt: est.botaoTxt(),

  ajuda: { ...est.aviso('lilas'), marginBottom: spacing.md },
  ajudaTxt: est.avisoTxt('lilas'),

  filtroScroll: { marginBottom: spacing.md, flexGrow: 0 },
  filtroRow: { flexDirection: 'row', gap: 8, paddingRight: spacing.md },
  chip: est.chip(),
  chipTxt: est.chipTxt(),

  erroBox: { ...est.aviso('rosa'), alignItems: 'center', flexWrap: 'wrap', marginBottom: spacing.md },
  erroTxt: { ...est.avisoTxt('rosa'), minWidth: 180 },
  erroBtn: { ...est.botaoSec(), minHeight: 36, paddingHorizontal: 14, borderColor: acento('rosa').tinta },
  erroBtnTxt: { ...est.botaoSecTxt(), fontSize: 13, color: colors.roseTexto },

  vazio: { ...est.vidro(26), alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: spacing.lg },
  vazioTxt: { ...est.legenda(), textAlign: 'center' },

  itemCard: { ...est.vidro(24), padding: 14, marginBottom: 12, gap: 10 },
  itemInativo: { opacity: 0.55 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: { ...est.pilula(54), borderRadius: 16, backgroundColor: acento('dourado').fundo },
  thumbImg: { width: 54, height: 54, borderRadius: 16, backgroundColor: colors.lav1 },
  itemTit: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo, marginBottom: 3 },
  itemDesc: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.texto2, marginBottom: 4 },
  itemLink: { fontFamily: fonts.body, fontSize: 12.5, color: colors.lilasTexto, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: acento('neutro').fundo, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
  },
  badgeTxt: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2 },
  acoes: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' },
  acaoBtn: { ...est.botaoIcone(), width: 38, height: 38 },
  acaoOff: { opacity: 0.35 },

  modalOverlay: { ...est.veu(), justifyContent: 'flex-end' },
  modalOverlayLargo: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalCard: { ...est.folha(), padding: spacing.lg, maxHeight: '90%' },
  modalCardLargo: { width: '100%', maxWidth: 640, borderRadius: 28, borderBottomWidth: 1 },

  form: { marginTop: spacing.xs, gap: spacing.sm, paddingBottom: spacing.sm },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  formTit: est.modalTitulo(),
  fechar: est.fechar(),
  label: { ...est.rotulo(), marginTop: 6, marginBottom: 0 },
  dica: { ...est.dica(), marginTop: 0 },
  input: est.campo(),
  inputDescricao: { minHeight: 90, lineHeight: 21 },
  inputTexto: { minHeight: 160, maxHeight: 300, lineHeight: 21 },
  tipoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tipoOpc: {
    flexGrow: 1, flexBasis: 70, alignItems: 'center', gap: 4, paddingVertical: 12,
    borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardSolido,
  },
  tipoOpcSel: { backgroundColor: colors.lav1, borderColor: colors.lav3 },
  tipoTxt: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.texto2 },
  previaWrap: { ...est.tenue(18), overflow: 'hidden' },
  previa: { width: '100%', height: 200 },
  linhaBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.lav1, borderRadius: 18,
    borderWidth: 1.5, borderColor: colors.lav3, borderStyle: 'dashed',
    paddingHorizontal: spacing.md, paddingVertical: 16, justifyContent: 'center',
  },
  uploadTxt: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.lilasTexto },
  blocoLink: { ...est.tenue(18), padding: spacing.md, gap: 6, marginTop: 6 },
  ativoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  ativoTxt: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.td },
  erroForm: { ...est.aviso('rosa'), alignItems: 'center', padding: 12 },
  erroFormTxt: est.avisoTxt('rosa'),
  formBtns: { flexDirection: 'row', marginTop: spacing.sm },
}), { escalar: false });
