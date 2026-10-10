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
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { Card, Button } from '../../components';
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

const PLANO_COR = { get 0() { return colors.sage; }, get 1() { return colors.lav4; }, 2: '#7B5EA7', 3: '#C0843F' };

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
      <Card key={item.id} style={[s.itemCard, largo && s.itemCardLargo, !ativo && s.itemInativo]}>
        <View style={s.itemTop}>
          {item.tipo === 'imagem' && item.url ? (
            <Image source={{ uri: item.url }} style={s.thumbImg} resizeMode="cover" />
          ) : (
            <View style={[s.thumb, antigo && { backgroundColor: colors.border }]}>
              <Ionicons name={tipoInfo.icon} size={22} color={antigo ? colors.tm : colors.lav5} />
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
                <Ionicons name={tipoInfo.icon} size={10} color={colors.tm} />
                <Text style={s.badgeTxt}>{tipoInfo.label}</Text>
              </View>
              {antigo ? (
                <View style={[s.badge, s.badgeAntigo]}>
                  <Text style={[s.badgeTxt, { color: colors.goldFg }]}>formato antigo</Text>
                </View>
              ) : null}
              <View style={[s.badge, { backgroundColor: (PLANO_COR[plano] || colors.lav4) + '33' }]}>
                <Text style={[s.badgeTxt, { color: PLANO_COR[plano] || colors.lav4 }]}>
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
                <Ionicons name="create-outline" size={18} color={colors.lav5} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => handleToggleAtivo(item)}
              style={s.acaoBtn}
              accessibilityLabel={ativo ? 'Desativar' : 'Ativar'}
            >
              <Ionicons name={ativo ? 'eye-outline' : 'eye-off-outline'} size={18} color={ativo ? colors.lav5 : colors.tl} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleExcluir(item)} style={s.acaoBtn} accessibilityLabel="Excluir">
              <Ionicons name="trash-outline" size={18} color={colors.rose} />
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
      </Card>
    );
  };

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminOutrosConteudos">
      <AdminSubTabs grupo="biblioteca" atual="AdminOutrosConteudos" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>Outros conteúdos</Text>
            <Text style={s.pageSub}>Imagens, links e textos de apoio.</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={abrirNovo} activeOpacity={0.85}>
            <Ionicons name="add" size={16} color="white" />
            <Text style={s.addBtnTxt}>Novo conteúdo</Text>
          </TouchableOpacity>
        </View>

        <View style={s.ajuda}>
          <Ionicons name="information-circle-outline" size={18} color={colors.lav5} />
          <Text style={s.ajudaTxt}>
            Estes conteúdos aparecem para a usuária como sugestão logo depois do check-in, conforme a
            emoção escolhida, e ficam salvos nos Favoritos quando ela toca no coração. Imagem e texto
            abrem dentro do app; link abre no navegador. Áudios têm seção própria em Áudios Check-in.
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtroScroll} contentContainerStyle={s.filtroRow}>
          {filtros.map(f => {
            const sel = filtroTipo === f.id;
            return (
              <TouchableOpacity key={f.id} style={[s.chip, sel && s.chipSel]} onPress={() => setFiltroTipo(f.id)}>
                {f.icon ? <Ionicons name={f.icon} size={12} color={sel ? 'white' : colors.tm} /> : null}
                <Text style={[s.chipTxt, sel && s.chipTxtSel]}>{f.label} ({contagem[f.id] ?? 0})</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {erroLeitura ? (
          <View style={s.erroBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.roseFg} />
            <Text style={s.erroTxt}>{erroLeitura}</Text>
            <TouchableOpacity onPress={() => setTentativa(t => t + 1)} style={s.erroBtn}>
              <Text style={s.erroBtnTxt}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {carregando ? (
          <View style={s.vazio}><ActivityIndicator color={colors.lav4} /></View>
        ) : filtrados.length === 0 && !erroLeitura ? (
          <Card style={s.vazio}>
            <Ionicons name="albums-outline" size={32} color={colors.tl} />
            <Text style={s.vazioTxt}>
              {filtroTipo === 'todos' ? 'Nenhum conteúdo cadastrado ainda.' : 'Nenhum conteúdo deste tipo.'}
            </Text>
          </Card>
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
                  <TouchableOpacity onPress={fecharModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={22} color={colors.tm} />
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
                        <Ionicons name={t.icon} size={18} color={sel ? 'white' : colors.lav5} />
                        <Text style={[s.tipoTxt, sel && { color: 'white' }]}>{t.label}</Text>
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
                        ? <ActivityIndicator size="small" color={colors.lav5} />
                        : <Ionicons name="image-outline" size={20} color={colors.lav5} />}
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
                      style={[s.planoOpc, form.plano === p.id && { backgroundColor: PLANO_COR[p.id] + '33', borderColor: PLANO_COR[p.id] }]}
                      onPress={() => setForm(f => ({ ...f, plano: p.id }))}
                    >
                      <Text style={[s.planoTxt, form.plano === p.id && { color: PLANO_COR[p.id] }]}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {erroForm ? (
                  <View style={s.erroForm}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.roseFg} />
                    <Text style={s.erroFormTxt}>{erroForm}</Text>
                  </View>
                ) : null}

                <View style={s.formBtns}>
                  <Button
                    title="Cancelar"
                    onPress={fecharModal}
                    disabled={salvando}
                    style={{ flex: 1, marginRight: spacing.sm, backgroundColor: colors.lav1 }}
                    textStyle={{ color: colors.lav5 }}
                  />
                  <Button
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
  scroll: { padding: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.lav4, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  addBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },

  ajuda: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.lav1, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.lav2,
    padding: spacing.md, marginBottom: spacing.md,
  },
  ajudaTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.tm, lineHeight: 18 },

  filtroScroll: { marginBottom: spacing.md, flexGrow: 0 },
  filtroRow: { flexDirection: 'row', gap: 8, paddingRight: spacing.md },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: colors.lav1,
    borderWidth: 1, borderColor: colors.lav2,
  },
  chipSel: { backgroundColor: colors.botaoForte, borderColor: colors.botaoForte },
  chipTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTxtSel: { color: 'white' },

  erroBox: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    backgroundColor: colors.erroFundo, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md,
  },
  erroTxt: { flex: 1, minWidth: 180, fontFamily: fonts.body, fontSize: 12, color: colors.roseFg, lineHeight: 17 },
  erroBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rose },
  erroBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.roseFg },

  vazio: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  vazioTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.tl },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  itemCard: { marginBottom: spacing.sm },
  itemCardLargo: { width: '49%' },
  itemInativo: { opacity: 0.55 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  thumb: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: colors.lav1,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbImg: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.lav1 },
  itemTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: 2 },
  itemDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 3 },
  itemLink: { fontFamily: fonts.body, fontSize: 11, color: colors.lav5, marginBottom: 3 },
  itemTrecho: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, fontStyle: 'italic', marginBottom: 3 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.lav1, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeAntigo: { backgroundColor: colors.gold + '40' },
  badgeTxt: { fontFamily: fonts.body, fontSize: 10, color: colors.tm },
  acoes: { gap: 8 },
  acaoBtn: { padding: 4 },
  notaAntigo: {
    fontFamily: fonts.body, fontSize: 11, color: colors.goldFg, lineHeight: 16,
    backgroundColor: colors.gold + '22', borderRadius: radius.sm,
    padding: spacing.sm, marginTop: spacing.sm,
  },
  emocaoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  emocaoChip: { backgroundColor: colors.lav1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  emocaoChipTxt: { fontFamily: fonts.body, fontSize: 10, color: colors.lav5 },
  avisoEmocao: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: spacing.sm },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalOverlayLargo: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalCard: {
    backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg, maxHeight: '90%',
  },
  modalCardLargo: { width: '100%', maxWidth: 640, borderRadius: 20 },

  form: { marginTop: spacing.sm, gap: spacing.sm, paddingBottom: spacing.sm },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  formTit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 4, marginTop: 4 },
  dica: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  inputDescricao: { minHeight: 60 },
  inputTexto: { minHeight: 160, maxHeight: 280, lineHeight: 20 },
  tipoRow: { flexDirection: 'row', gap: 8 },
  tipoOpc: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.lav3,
    backgroundColor: colors.lav1,
  },
  tipoOpcSel: { backgroundColor: colors.botaoForte, borderColor: colors.botaoForte },
  tipoTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav5 },
  previaWrap: {
    borderRadius: radius.md, overflow: 'hidden',
    backgroundColor: colors.lav1, borderWidth: 1, borderColor: colors.lav2,
  },
  previa: { width: '100%', maxHeight: 260 },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.lav1, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.lav3, borderStyle: 'dashed',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    justifyContent: 'center',
  },
  uploadTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.lav5 },
  emocaoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emocaoOpc: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  emocaoOpcSel: { backgroundColor: colors.botaoForte, borderColor: colors.botaoForte },
  emocaoOpcTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  emocaoOpcTxtSel: { color: 'white' },
  planoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planoOpc: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  planoTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  erroForm: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.erroFundo, borderRadius: radius.sm, padding: spacing.sm,
  },
  erroFormTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.roseFg },
  formBtns: { flexDirection: 'row', marginTop: spacing.sm },
}), { escalar: false });
