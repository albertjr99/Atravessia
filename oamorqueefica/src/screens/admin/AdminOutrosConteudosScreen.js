import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert,
  Platform, ActivityIndicator, Modal, KeyboardAvoidingView, Image, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { ref as sRef, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { uploadToStorage } from '../../utils/storageUpload';
import { confirmar } from '../../utils/confirm';
import { db, storage } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, corPlano, BotaoAdmin, Degrade } from './adminEstilo';
import { emocoes as EMOCOES_APP } from '../../data';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';

// "Outros conteúdos": imagem, link e texto sugeridos à usuária no check-in
// conforme a emoção. Áudios têm seção própria (Áudios Check-in) e o antigo
// campo `grupo` deixou de existir. O modelo de dados é o mesmo do painel web —
// não renomear campos.
const COLECAO = 'conteudos';

// Usa exatamente os ids e rótulos das emoções do check-in.
const EMOCOES = EMOCOES_APP.map(e => ({ id: e.id, label: e.label }));

const TIPOS = [
  { id: 'imagem', label: 'Imagem', icon: 'image-outline' },
  { id: 'link',   label: 'Link',   icon: 'link-outline' },
  { id: 'texto',  label: 'Texto',  icon: 'document-text-outline' },
];
const TIPOS_NOVOS = TIPOS.map(t => t.id);

const TIPOS_ANTIGOS = {
  audio:     { label: 'Áudio',     icon: 'headset-outline' },
  video:     { label: 'Vídeo',     icon: 'videocam-outline' },
  documento: { label: 'Documento', icon: 'document-attach-outline' },
};

const PLANOS = [
  { id: 0, label: 'Grátis' },
  { id: 1, label: 'Acolher' },
  { id: 2, label: 'Compreender' },
  { id: 3, label: 'Evoluir' },
];


const ehAntigo = (item) => !TIPOS_NOVOS.includes(item.tipo);
const estaAtivo = (item) => item.ativo !== false;

function novoForm() {
  return {
    tipo: 'imagem', titulo: '', descricao: '', url: '', storagePath: '',
    texto: '', plano: 0, emocoes: [],
  };
}

function millis(v) {
  if (!v) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const n = new Date(v).getTime();
  return isNaN(n) ? null : n;
}

// Mais recentes primeiro; itens sem data vão para o fim (em vez de sumirem,
// como aconteceria com orderBy no Firestore).
function ordenar(lista) {
  return [...lista].sort((a, b) => {
    const va = millis(a.criadoEm) ?? millis(a.atualizadoEm);
    const vb = millis(b.criadoEm) ?? millis(b.atualizadoEm);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return vb - va;
  });
}

function comHttps(url) {
  const u = url.trim();
  if (!u) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
}

function nomeSeguro(nome, padrao) {
  const limpo = String(nome || '').trim().replace(/\s+/g, '_').replace(/[^\w.\-]/g, '');
  return limpo || padrao;
}

// Alert.alert com botões não funciona no navegador; mensagens simples sim no
// nativo e via window.alert no web.
function avisar(titulo, msg) {
  if (Platform.OS === 'web') { window.alert(msg ? `${titulo}\n\n${msg}` : titulo); return; }
  Alert.alert(titulo, msg);
}

async function apagarArquivo(path) {
  if (!path) return;
  try { await deleteObject(sRef(storage, path)); } catch {}
}

export default function AdminOutrosConteudosScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const largo = width >= 700;

  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLeitura, setErroLeitura] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const [mostraModal, setMostraModal] = useState(false);
  const [editando, setEditando] = useState(null); // item original em edição
  const [form, setForm] = useState(novoForm());
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [uploadando, setUploadando] = useState(false);
  // Arquivos enviados enquanto o modal está aberto — para apagar os que não
  // forem usados (troca de imagem, cancelar, mudar o tipo).
  const [enviadosSessao, setEnviadosSessao] = useState([]);
  const [ratioPrevia, setRatioPrevia] = useState(16 / 9);

  // Sem orderBy: ele exclui documentos sem o campo. E o listener tem callback de
  // erro — um onSnapshot que falha morre e não tenta de novo, por isso o botão
  // "Tentar novamente" recria a assinatura.
  useEffect(() => {
    setCarregando(true);
    setErroLeitura('');
    const unsub = onSnapshot(
      collection(db, COLECAO),
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
        setItens(ordenar(docs));
        setCarregando(false);
        setErroLeitura('');
      },
      (err) => {
        setCarregando(false);
        setErroLeitura(
          err?.code === 'permission-denied'
            ? 'Sem permissão para ler os conteúdos. Confira se esta conta é administradora.'
            : `Não foi possível carregar os conteúdos (${err?.code || err?.message || 'erro desconhecido'}).`
        );
      },
    );
    return unsub;
  }, [tentativa]);

  useEffect(() => {
    if (form.tipo !== 'imagem' || !form.url) return;
    let vivo = true;
    Image.getSize(
      form.url,
      (w, h) => { if (vivo && w > 0 && h > 0) setRatioPrevia(Math.max(0.5, Math.min(w / h, 2.5))); },
      () => {},
    );
    return () => { vivo = false; };
  }, [form.url, form.tipo]);

  const temAntigos = itens.some(ehAntigo);

  const contagem = useMemo(() => {
    const c = { todos: itens.length, antigos: 0 };
    TIPOS_NOVOS.forEach(t => { c[t] = 0; });
    itens.forEach(i => { if (ehAntigo(i)) c.antigos += 1; else c[i.tipo] += 1; });
    return c;
  }, [itens]);

  const filtrados = useMemo(() => {
    if (filtroTipo === 'todos') return itens;
    if (filtroTipo === 'antigos') return itens.filter(ehAntigo);
    return itens.filter(i => i.tipo === filtroTipo);
  }, [itens, filtroTipo]);

  // ── Modal ────────────────────────────────────────────────────────────────
  const abrirNovo = () => {
    setEditando(null);
    setForm(novoForm());
    setErroForm('');
    setEnviadosSessao([]);
    setMostraModal(true);
  };

  const abrirEdicao = (item) => {
    setEditando(item);
    setForm({
      tipo: item.tipo,
      titulo: item.titulo || '',
      descricao: item.descricao || '',
      url: item.url || '',
      storagePath: item.storagePath || '',
      texto: item.texto || '',
      plano: typeof item.plano === 'number' ? item.plano : 0,
      emocoes: Array.isArray(item.emocoes) ? item.emocoes : [],
    });
    setErroForm('');
    setEnviadosSessao([]);
    setMostraModal(true);
  };

  const fecharModal = async () => {
    if (salvando) return;
    setMostraModal(false);
    // Descarta imagens enviadas nesta sessão que não chegaram a ser salvas.
    const descartar = enviadosSessao;
    setEnviadosSessao([]);
    setForm(novoForm());
    setEditando(null);
    setErroForm('');
    await Promise.all(descartar.map(apagarArquivo));
  };

  const aplicarImagem = (url, path) => {
    setEnviadosSessao(prev => [...prev, path]);
    setForm(f => ({ ...f, url, storagePath: path }));
    setErroForm('');
  };

  const handleEscolherImagem = async () => {
    setErroForm('');
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadando(true);
        try {
          const path = `conteudos/${Date.now()}_${nomeSeguro(file.name, 'imagem.jpg')}`;
          const fileRef = sRef(storage, path);
          await uploadBytes(fileRef, file, { contentType: file.type || 'image/jpeg' });
          const url = await getDownloadURL(fileRef);
          aplicarImagem(url, path);
        } catch (err) {
          setErroForm(`Erro no upload da imagem: ${err?.code || err?.message || 'tente novamente.'}`);
        } finally {
          setUploadando(false);
        }
      };
      document.body.appendChild(input);
      input.click();
      setTimeout(() => { if (document.body.contains(input)) document.body.removeChild(input); }, 5000);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setErroForm('Permita o acesso à galeria nas configurações do aparelho para escolher uma imagem.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setUploadando(true);
    try {
      const mime = asset.mimeType || 'image/jpeg';
      const extensao = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      const path = `conteudos/${Date.now()}_${nomeSeguro(asset.fileName, `imagem.${extensao}`)}`;
      const url = await uploadToStorage(asset.uri, path, mime);
      aplicarImagem(url, path);
    } catch (err) {
      setErroForm(`Erro no upload da imagem: ${err?.message || 'tente novamente.'}`);
    } finally {
      setUploadando(false);
    }
  };

  const handleSalvar = async () => {
    const titulo = form.titulo.trim();
    const tipo = form.tipo;
    if (!TIPOS_NOVOS.includes(tipo)) { setErroForm('Escolha o tipo: imagem, link ou texto.'); return; }
    if (!titulo) { setErroForm('Informe o título.'); return; }
    if (tipo === 'imagem' && !form.url) { setErroForm('Escolha a imagem antes de salvar.'); return; }
    if (tipo === 'link' && !form.url.trim()) { setErroForm('Informe o endereço do link.'); return; }
    if (tipo === 'texto' && !form.texto.trim()) { setErroForm('Escreva o texto do conteúdo.'); return; }

    const dados = {
      titulo,
      descricao: form.descricao.trim(),
      tipo,
      url: tipo === 'imagem' ? form.url : tipo === 'link' ? comHttps(form.url) : '',
      storagePath: tipo === 'imagem' ? form.storagePath : '',
      texto: tipo === 'texto' ? form.texto.trim() : '',
      plano: form.plano,
      emocoes: form.emocoes,
    };

    setSalvando(true);
    setErroForm('');
    try {
      if (editando) {
        await updateDoc(doc(db, COLECAO, editando.id), { ...dados, atualizadoEm: serverTimestamp() });
      } else {
        await addDoc(collection(db, COLECAO), { ...dados, ativo: true, criadoEm: serverTimestamp() });
      }
      // Limpa do Storage o que deixou de ser usado: imagens trocadas nesta
      // sessão e a imagem original, se foi substituída ou o tipo mudou.
      const sobras = enviadosSessao.filter(p => p !== dados.storagePath);
      if (editando?.storagePath && editando.storagePath !== dados.storagePath) sobras.push(editando.storagePath);
      setEnviadosSessao([]);
      setMostraModal(false);
      setForm(novoForm());
      setEditando(null);
      await Promise.all(sobras.map(apagarArquivo));
    } catch (err) {
      setErroForm(`Não foi possível salvar: ${err?.code || err?.message || 'tente novamente.'}`);
    } finally {
      setSalvando(false);
    }
  };

  // ── Ações da lista ───────────────────────────────────────────────────────
  const handleToggleAtivo = async (item) => {
    try {
      await updateDoc(doc(db, COLECAO, item.id), { ativo: !estaAtivo(item), atualizadoEm: serverTimestamp() });
    } catch (err) {
      avisar('Erro', `Não foi possível alterar: ${err?.code || err?.message || 'tente novamente.'}`);
    }
  };

  const handleExcluir = (item) => {
    confirmar(
      'Excluir conteúdo',
      `Tem certeza que deseja excluir "${item.titulo || 'sem título'}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await deleteDoc(doc(db, COLECAO, item.id));
          await apagarArquivo(item.storagePath);
        } catch (err) {
          avisar('Erro', `Não foi possível excluir: ${err?.code || err?.message || 'tente novamente.'}`);
        }
      },
      'Excluir',
    );
  };

  const toggleEmocaoForm = (id) => {
    setForm(f => ({
      ...f,
      emocoes: f.emocoes.includes(id) ? f.emocoes.filter(e => e !== id) : [...f.emocoes, id],
    }));
  };

  const mudarTipo = (tipo) => {
    setErroForm('');
    setForm(f => {
      if (f.tipo === tipo) return f;
      // A URL da imagem não serve como link (e vice-versa).
      const limpaUrl = f.tipo === 'imagem' || tipo === 'imagem';
      return { ...f, tipo, ...(limpaUrl ? { url: '', storagePath: '' } : {}) };
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const filtros = [
    { id: 'todos', label: 'Todos' },
    ...TIPOS.map(t => ({ id: t.id, label: t.label, icon: t.icon })),
    ...(temAntigos ? [{ id: 'antigos', label: 'Formato antigo', icon: 'archive-outline' }] : []),
  ];

  const renderItem = (item) => {
    const antigo = ehAntigo(item);
    const ativo = estaAtivo(item);
    const tipoInfo = TIPOS.find(t => t.id === item.tipo) || TIPOS_ANTIGOS[item.tipo]
      || { label: item.tipo || 'Sem tipo', icon: 'help-circle-outline' };
    const plano = typeof item.plano === 'number' ? item.plano : 0;
    const semEmocao = !antigo && (item.emocoes || []).length === 0;

    return (
      <View key={item.id} style={[s.itemCard, largo && s.itemCardLargo, !ativo && s.itemInativo]}>
        <View style={s.itemTop}>
          {item.tipo === 'imagem' && item.url ? (
            <Image source={{ uri: item.url }} style={s.thumbImg} resizeMode="cover" />
          ) : (
            <View style={[s.thumb, antigo && { backgroundColor: acento('neutro').fundo }]}>
              <Ionicons name={tipoInfo.icon} size={22} color={antigo ? colors.texto2 : acento('lilas').tinta} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={[s.itemTit, !ativo && { color: colors.tl }]} numberOfLines={2}>
              {item.titulo || 'Sem título'}
            </Text>
            {item.descricao ? <Text style={s.itemDesc} numberOfLines={2}>{item.descricao}</Text> : null}
            {item.tipo === 'link' && item.url ? (
              <Text style={s.itemLink} numberOfLines={1}>{item.url}</Text>
            ) : null}
            {item.tipo === 'texto' && item.texto ? (
              <Text style={s.itemTrecho} numberOfLines={2}>{item.texto}</Text>
            ) : null}

            <View style={s.badgeRow}>
              <View style={s.badge}>
                <Ionicons name={tipoInfo.icon} size={13} color={colors.texto2} />
                <Text style={s.badgeTxt}>{tipoInfo.label}</Text>
              </View>
              {antigo ? (
                <View style={[s.badge, s.badgeAntigo]}>
                  <Text style={[s.badgeTxt, { color: acento('dourado').texto }]}>formato antigo</Text>
                </View>
              ) : null}
              <View style={[s.badge, { backgroundColor: corPlano(plano).fundo }]}>
                <Text style={[s.badgeTxt, { color: corPlano(plano).texto, fontFamily: fonts.bodyBold }]}>
                  {PLANOS.find(p => p.id === plano)?.label || 'Grátis'}
                </Text>
              </View>
              {!ativo ? (
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>Inativo</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={s.acoes}>
            {!antigo ? (
              <TouchableOpacity onPress={() => abrirEdicao(item)} style={s.acaoBtn} accessibilityLabel="Editar">
                <Ionicons name="create-outline" size={18} color={colors.lilasIcone} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => handleToggleAtivo(item)}
              style={s.acaoBtn}
              accessibilityLabel={ativo ? 'Desativar' : 'Ativar'}
            >
              <Ionicons name={ativo ? 'eye-outline' : 'eye-off-outline'} size={18} color={ativo ? colors.lilasIcone : colors.tl} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleExcluir(item)} style={s.acaoBtn} accessibilityLabel="Excluir">
              <Ionicons name="trash-outline" size={18} color={colors.roseTexto} />
            </TouchableOpacity>
          </View>
        </View>

        {antigo ? (
          <Text style={s.notaAntigo}>
            Áudios agora ficam em Áudios Check-in. Este formato não é mais cadastrado aqui —
            pode ser desativado ou excluído.
          </Text>
        ) : null}

        {(item.emocoes || []).length > 0 ? (
          <View style={s.emocaoRow}>
            {(item.emocoes || []).map(id => {
              const e = EMOCOES.find(em => em.id === id);
              return e ? (
                <View key={id} style={s.emocaoChip}>
                  <Text style={s.emocaoChipTxt}>{e.label}</Text>
                </View>
              ) : null;
            })}
          </View>
        ) : semEmocao ? (
          <Text style={s.avisoEmocao}>Sem emoção vinculada — não aparece no check-in.</Text>
        ) : null}
      </View>
    );
  };

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminOutrosConteudos">
      <AdminSubTabs grupo="biblioteca" atual="AdminOutrosConteudos" />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.sobre}>Biblioteca</Text>
            <Text style={s.pageTitle}>Outros conteúdos</Text>
            <Text style={s.pageSub}>Imagens, links e textos de apoio.</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={abrirNovo} activeOpacity={0.85}>
            <Degrade />
            <Ionicons name="add" size={16} color="white" />
            <Text style={s.addBtnTxt}>Novo conteúdo</Text>
          </TouchableOpacity>
        </View>

        <View style={s.ajuda}>
          <Ionicons name="information-circle-outline" size={18} color={acento('lilas').texto} />
          <Text style={s.ajudaTxt}>
            Estes conteúdos aparecem para a usuária como sugestão logo depois do check-in, conforme a
            emoção escolhida, e ficam salvos nos Favoritos quando ela toca no coração. Imagem e texto
            abrem dentro do app; link abre no navegador. Áudios têm seção própria em Áudios Check-in.
          </Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={s.filtroScroll} contentContainerStyle={s.filtroRow}>
          {filtros.map(f => {
            const sel = filtroTipo === f.id;
            return (
              <TouchableOpacity key={f.id} style={[s.chip, sel && s.chipSel]} onPress={() => setFiltroTipo(f.id)}>
                {f.icon ? <Ionicons name={f.icon} size={14} color={sel ? colors.lilasTexto : colors.texto2} /> : null}
                <Text style={[s.chipTxt, sel && s.chipTxtSel]}>{f.label} ({contagem[f.id] ?? 0})</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {erroLeitura ? (
          <View style={s.erroBox}>
            <Ionicons name="alert-circle-outline" size={18} color={acento('rosa').texto} />
            <Text style={s.erroTxt}>{erroLeitura}</Text>
            <TouchableOpacity onPress={() => setTentativa(t => t + 1)} style={s.erroBtn}>
              <Text style={s.erroBtnTxt}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {carregando ? (
          <View style={s.vazio}><ActivityIndicator color={colors.lav4} /></View>
        ) : filtrados.length === 0 && !erroLeitura ? (
          <View style={s.vazio}>
            <Ionicons name="albums-outline" size={32} color={colors.tl} />
            <Text style={s.vazioTxt}>
              {filtroTipo === 'todos' ? 'Nenhum conteúdo cadastrado ainda.' : 'Nenhum conteúdo deste tipo.'}
            </Text>
          </View>
        ) : (
          <View style={largo ? s.grid : null}>
            {filtrados.map(renderItem)}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal visible={mostraModal} animationType="slide" transparent onRequestClose={fecharModal}>
        <KeyboardAvoidingView
          style={[s.modalOverlay, largo && s.modalOverlayLargo]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[s.modalCard, largo && s.modalCardLargo]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <View style={s.form}>
                <View style={s.formHeader}>
                  <Text style={s.formTit}>{editando ? 'Editar conteúdo' : 'Novo conteúdo'}</Text>
                  <TouchableOpacity onPress={fecharModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.fechar}>
                    <Ionicons name="close" size={20} color={colors.td} />
                  </TouchableOpacity>
                </View>

                <Text style={s.label}>Tipo *</Text>
                <View style={s.tipoRow}>
                  {TIPOS.map(t => {
                    const sel = form.tipo === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[s.tipoOpc, sel && s.tipoOpcSel]}
                        onPress={() => mudarTipo(t.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={t.icon} size={18} color={sel ? colors.lilasTexto : colors.texto2} />
                        <Text style={[s.tipoTxt, sel && { color: colors.lilasTexto }]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {form.tipo === 'imagem' ? (
                  <>
                    {form.url ? (
                      <View style={s.previaWrap}>
                        <Image
                          source={{ uri: form.url }}
                          style={[s.previa, { aspectRatio: ratioPrevia }]}
                          resizeMode="contain"
                        />
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={[s.uploadBtn, uploadando && { opacity: 0.6 }]}
                      onPress={handleEscolherImagem}
                      disabled={uploadando}
                      activeOpacity={0.8}
                    >
                      {uploadando
                        ? <ActivityIndicator size="small" color={colors.lilasTexto} />
                        : <Ionicons name="image-outline" size={20} color={colors.lilasTexto} />}
                      <Text style={s.uploadTxt}>
                        {uploadando ? 'Enviando imagem...' : form.url ? 'Trocar imagem' : 'Escolher imagem *'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                {form.tipo === 'link' ? (
                  <>
                    <Text style={s.label}>Endereço (URL) *</Text>
                    <TextInput
                      style={s.input}
                      placeholder="Ex: https://site.com/artigo"
                      placeholderTextColor={colors.tl}
                      value={form.url}
                      onChangeText={v => setForm(f => ({ ...f, url: v }))}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                    <Text style={s.dica}>Se faltar, o https:// é acrescentado ao salvar.</Text>
                  </>
                ) : null}

                {form.tipo === 'texto' ? (
                  <>
                    <Text style={s.label}>Texto *</Text>
                    <TextInput
                      style={[s.input, s.inputTexto]}
                      placeholder="Escreva aqui o conteúdo que a usuária vai ler..."
                      placeholderTextColor={colors.tl}
                      value={form.texto}
                      onChangeText={v => setForm(f => ({ ...f, texto: v }))}
                      multiline
                      textAlignVertical="top"
                    />
                  </>
                ) : null}

                <Text style={s.label}>Título *</Text>
                <TextInput
                  style={s.input}
                  placeholder="Ex: Um abraço para hoje"
                  placeholderTextColor={colors.tl}
                  value={form.titulo}
                  onChangeText={v => setForm(f => ({ ...f, titulo: v }))}
                />

                <Text style={s.label}>Descrição (opcional)</Text>
                <TextInput
                  style={[s.input, s.inputDescricao]}
                  placeholder="Resumo curto exibido no cartão"
                  placeholderTextColor={colors.tl}
                  value={form.descricao}
                  onChangeText={v => setForm(f => ({ ...f, descricao: v }))}
                  multiline
                  textAlignVertical="top"
                />

                <Text style={s.label}>Sugerir no check-in quando a usuária estiver</Text>
                <View style={s.emocaoGrid}>
                  {EMOCOES.map(e => {
                    const sel = form.emocoes.includes(e.id);
                    return (
                      <TouchableOpacity
                        key={e.id}
                        style={[s.emocaoOpc, sel && s.emocaoOpcSel]}
                        onPress={() => toggleEmocaoForm(e.id)}
                      >
                        <Text style={[s.emocaoOpcTxt, sel && s.emocaoOpcTxtSel]}>{e.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {form.emocoes.length === 0 ? (
                  <Text style={s.dica}>Sem emoção marcada, o conteúdo não é sugerido no check-in.</Text>
                ) : null}

                <Text style={s.label}>Plano mínimo</Text>
                <View style={s.planoRow}>
                  {PLANOS.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[s.planoOpc, form.plano === p.id && { backgroundColor: corPlano(p.id).fundo, borderColor: corPlano(p.id).tinta }]}
                      onPress={() => setForm(f => ({ ...f, plano: p.id }))}
                    >
                      <Text style={[s.planoTxt, form.plano === p.id && { color: corPlano(p.id).texto, fontFamily: fonts.bodyBold }]}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {erroForm ? (
                  <View style={s.erroForm}>
                    <Ionicons name="alert-circle-outline" size={16} color={acento('rosa').texto} />
                    <Text style={s.erroFormTxt}>{erroForm}</Text>
                  </View>
                ) : null}

                <View style={s.formBtns}>
                  <BotaoAdmin
                    title="Cancelar"
                    variant="secondary"
                    onPress={fecharModal}
                    disabled={salvando}
                    style={{ flex: 1, marginRight: spacing.sm }}
                  />
                  <BotaoAdmin
                    title={salvando ? 'Salvando...' : 'Salvar'}
                    onPress={handleSalvar}
                    disabled={salvando || uploadando}
                    style={{ flex: 1 }}
                  />
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
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: spacing.md },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: est.subtitulo(),
  addBtn: { ...est.botao(), minHeight: 46, paddingHorizontal: 18 },
  addBtnTxt: est.botaoTxt(),

  ajuda: { ...est.aviso('lilas'), marginBottom: spacing.md },
  ajudaTxt: est.avisoTxt('lilas'),

  filtroScroll: { marginBottom: spacing.md, flexGrow: 0 },
  filtroRow: { flexDirection: 'row', gap: 8, paddingRight: spacing.md },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipTxt: est.chipTxt(),
  chipTxtSel: est.chipTxtSel(),

  erroBox: { ...est.aviso('rosa'), alignItems: 'center', flexWrap: 'wrap', marginBottom: spacing.md },
  erroTxt: { ...est.avisoTxt('rosa'), minWidth: 180 },
  erroBtn: { ...est.botaoSec(), minHeight: 36, paddingHorizontal: 14, borderColor: acento('rosa').tinta },
  erroBtnTxt: { ...est.botaoSecTxt(), fontSize: 13, color: colors.roseTexto },

  vazio: { ...est.vidro(26), alignItems: 'center', gap: 10, paddingVertical: 32 },
  vazioTxt: est.legenda(),

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  itemCard: { ...est.vidro(24), padding: 14, marginBottom: 12 },
  itemCardLargo: { width: '49%' },
  itemInativo: { opacity: 0.55 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: { ...est.pilula(54), borderRadius: 16, backgroundColor: acento('lilas').fundo },
  thumbImg: { width: 54, height: 54, borderRadius: 16, backgroundColor: colors.lav1 },
  itemTit: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo, marginBottom: 3 },
  itemDesc: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.texto2, marginBottom: 4 },
  itemLink: { fontFamily: fonts.body, fontSize: 12.5, color: colors.lilasTexto, marginBottom: 4 },
  itemTrecho: { fontFamily: fonts.serifItalic, fontSize: 15, color: colors.texto2, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: acento('neutro').fundo, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  badgeAntigo: { backgroundColor: acento('dourado').fundo },
  badgeTxt: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2 },
  acoes: { gap: 6 },
  acaoBtn: { ...est.botaoIcone(), width: 38, height: 38 },
  notaAntigo: { ...est.aviso('dourado'), ...est.avisoTxt('dourado'), fontSize: 13, marginTop: 10, flex: 0 },
  emocaoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  emocaoChip: { backgroundColor: acento('lilas').fundo, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  emocaoChipTxt: { fontFamily: fonts.bodySemi, fontSize: 12, color: acento('lilas').texto },
  avisoEmocao: { ...est.dica(), marginTop: 10 },

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
  inputDescricao: { minHeight: 64 },
  inputTexto: { minHeight: 160, maxHeight: 280, lineHeight: 21 },
  tipoRow: { flexDirection: 'row', gap: 8 },
  tipoOpc: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12,
    borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.cardSolido,
  },
  tipoOpcSel: { backgroundColor: colors.lav1, borderColor: colors.lav3 },
  tipoTxt: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.texto2 },
  previaWrap: { ...est.tenue(18), overflow: 'hidden' },
  previa: { width: '100%', maxHeight: 260 },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.lav1, borderRadius: 18,
    borderWidth: 1.5, borderColor: colors.lav3, borderStyle: 'dashed',
    paddingHorizontal: spacing.md, paddingVertical: 16,
    justifyContent: 'center',
  },
  uploadTxt: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.lilasTexto },
  emocaoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emocaoOpc: est.chip(),
  emocaoOpcSel: est.chipSel(),
  emocaoOpcTxt: est.chipTxt(),
  emocaoOpcTxtSel: est.chipTxtSel(),
  planoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planoOpc: est.chip(),
  planoTxt: est.chipTxt(),
  erroForm: { ...est.aviso('rosa'), alignItems: 'center', padding: 12 },
  erroFormTxt: est.avisoTxt('rosa'),
  formBtns: { flexDirection: 'row', marginTop: spacing.sm },
}), { escalar: false });
