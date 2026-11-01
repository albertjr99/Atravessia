import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator, Modal, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { ref as sRef, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { uploadToStorage } from '../../utils/storageUpload';
import { db, storage } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, corPlano, BotaoAdmin, Degrade, AcoesItem } from './adminEstilo';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';
import SeletorOpcoes from '../../components/SeletorOpcoes';

const EMOCOES = [
  { id: 'triste',      label: 'Triste' },
  { id: 'saudade',     label: 'Saudade' },
  { id: 'sozinho',     label: 'Sozinho' },
  { id: 'medo',        label: 'Medo' },
  { id: 'ansioso',     label: 'Ansioso' },
  { id: 'culpado',     label: 'Culpado' },
  { id: 'raiva',       label: 'Raiva' },
  { id: 'desanimado',  label: 'Desanimado' },
  { id: 'confuso',     label: 'Confuso' },
];

const PLANOS = [
  { id: 0, label: 'Grátis' },
  { id: 1, label: 'Acolher' },
  { id: 2, label: 'Compreender' },
  { id: 3, label: 'Evoluir' },
];


function novoForm() {
  return { titulo: '', duracao: '', plano: 1, emocoes: [], url: '', storagePath: '' };
}

// Lê a duração real do arquivo enviado, para a gestora não precisar digitá-la.
// Devolve '' se não for possível medir — o campo é apenas informativo.
async function medirDuracao(uri) {
  let som;
  try {
    const { sound, status } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
    som = sound;
    const ms = status?.durationMillis;
    if (!ms || !isFinite(ms)) return '';
    const totalSeg = Math.round(ms / 1000);
    const min = Math.floor(totalSeg / 60);
    const seg = totalSeg % 60;
    return min > 0 ? `${min} min${seg ? ` ${seg}s` : ''}` : `${seg}s`;
  } catch {
    return '';
  } finally {
    try { await som?.unloadAsync(); } catch {}
  }
}

export default function AdminAudiosScreen({ navigation }) {
  const [audios, setAudios] = useState([]);
  const [filtroEmocao, setFiltroEmocao] = useState('todos');
  const [mostraModal, setMostraModal] = useState(false);
  const [form, setForm] = useState(novoForm());
  const [salvando, setSalvando] = useState(false);
  const [uploadando, setUploadando] = useState(false);
  const [somAtual, setSomAtual] = useState(null);
  const [tocandoId, setTocandoId] = useState(null);

  useEffect(() => {
    const ref = query(collection(db, 'audiosAcolhimento'), orderBy('criadoEm', 'desc'));
    return onSnapshot(ref, (snap) => {
      setAudios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, []);

  useEffect(() => () => { somAtual?.unloadAsync(); }, [somAtual]);

  const audiosFiltrados = filtroEmocao === 'todos'
    ? audios
    : audios.filter(a => (a.emocoes || []).includes(filtroEmocao));

  const handleUpload = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadando(true);
        try {
          const nome = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
          const path = `audiosAcolhimento/${nome}`;
          const fileRef = sRef(storage, path);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          const titulo = file.name.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ').trim();
          const duracao = await medirDuracao(url);
          setForm(f => ({ ...f, url, storagePath: path, titulo: f.titulo || titulo, duracao }));
          Alert.alert('Áudio carregado!', 'Preencha os campos e clique em Salvar.');
        } catch (err) {
          Alert.alert('Erro no upload', err?.message || 'Tente novamente.');
        } finally {
          setUploadando(false);
        }
      };
      document.body.appendChild(input);
      input.click();
      setTimeout(() => { if (document.body.contains(input)) document.body.removeChild(input); }, 5000);
    } else {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      setUploadando(true);
      try {
        const nome = `${Date.now()}_${asset.name.replace(/\s+/g, '_')}`;
        const path = `audiosAcolhimento/${nome}`;
        const url = await uploadToStorage(asset.uri, path, asset.mimeType || 'audio/mpeg');
        const titulo = asset.name.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ').trim();
        // Mede no arquivo local, que já está em cache — mais rápido que baixar de volta.
        const duracao = await medirDuracao(asset.uri);
        setForm(f => ({ ...f, url, storagePath: path, titulo: f.titulo || titulo, duracao }));
        Alert.alert('Áudio carregado!', 'Preencha os campos e clique em Salvar.');
      } catch (err) {
        Alert.alert('Erro no upload', err?.message || 'Tente novamente.');
      } finally {
        setUploadando(false);
      }
    }
  };

  const handleSalvar = async () => {
    if (!form.titulo.trim()) { Alert.alert('Atenção', 'Informe o título do áudio.'); return; }
    if (form.emocoes.length === 0) { Alert.alert('Atenção', 'Selecione ao menos uma emoção.'); return; }
    if (!form.url.trim()) { Alert.alert('Atenção', 'Faça o upload do arquivo de áudio.'); return; }
    setSalvando(true);
    try {
      await addDoc(collection(db, 'audiosAcolhimento'), {
        titulo: form.titulo.trim(),
        duracao: form.duracao.trim(),
        plano: form.plano,
        emocoes: form.emocoes,
        url: form.url.trim(),
        storagePath: form.storagePath,
        ativo: true,
        criadoEm: serverTimestamp(),
      });
      setForm(novoForm());
      setMostraModal(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleAtivo = async (audio) => {
    await updateDoc(doc(db, 'audiosAcolhimento', audio.id), { ativo: !audio.ativo });
  };

  const handleExcluir = (audio) => {
    Alert.alert(
      'Excluir áudio',
      `Tem certeza que deseja excluir "${audio.titulo}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive', onPress: async () => {
            try {
              if (audio.storagePath) {
                await deleteObject(sRef(storage, audio.storagePath)).catch(() => {});
              }
              await deleteDoc(doc(db, 'audiosAcolhimento', audio.id));
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir.');
            }
          },
        },
      ]
    );
  };

  const handleTocarPausar = async (audio) => {
    if (tocandoId === audio.id) {
      await somAtual?.pauseAsync();
      setTocandoId(null);
      return;
    }
    if (somAtual) { await somAtual.unloadAsync(); setSomAtual(null); }
    if (!audio.url) { Alert.alert('', 'Este áudio não tem arquivo.'); return; }
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: audio.url }, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate(s => { if (s.didJustFinish) { setTocandoId(null); } });
      setSomAtual(sound);
      setTocandoId(audio.id);
    } catch {
      Alert.alert('Erro', 'Não foi possível reproduzir.');
    }
  };

  const toggleEmocaoForm = (id) => {
    setForm(f => ({
      ...f,
      emocoes: f.emocoes.includes(id) ? f.emocoes.filter(e => e !== id) : [...f.emocoes, id],
    }));
  };

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminAudios">
      <AdminSubTabs grupo="biblioteca" atual="AdminAudios" />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.sobre}>Biblioteca</Text>
            <Text style={s.pageTitle}>Áudios de Acolhimento</Text>
            <Text style={s.pageSub}>Áudios exibidos no check-in por emoção.</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setMostraModal(true)} activeOpacity={0.85}>
            <Degrade />
            <Ionicons name="add" size={16} color="white" />
            <Text style={s.addBtnTxt}>Novo áudio</Text>
          </TouchableOpacity>
        </View>

        {/* Filtro por emoção */}
        <SeletorOpcoes
          titulo="Filtrar por emoção"
          estilo={s.filtroScroll}
          opcoes={[{ id: 'todos', label: 'Todos' }, ...EMOCOES.map(e => ({ id: e.id, label: e.label }))]}
          valor={filtroEmocao}
          onChange={setFiltroEmocao}
        />

        {/* Lista */}
        {audiosFiltrados.length === 0 ? (
          <View style={s.vazio}>
            <Ionicons name="musical-notes-outline" size={32} color={colors.tl} />
            <Text style={s.vazioTxt}>Nenhum áudio{filtroEmocao !== 'todos' ? ' para esta emoção' : ''} ainda.</Text>
          </View>
        ) : (
          <View style={s.lista}>
          {audiosFiltrados.map((audio, i) => (
            <View key={audio.id} style={[s.audioCard, i > 0 && s.audioDiv, !audio.ativo && s.audioInativo]}>
              <View style={s.audioTop}>
                <TouchableOpacity style={s.playBtn} onPress={() => handleTocarPausar(audio)}>
                  <Ionicons
                    name={tocandoId === audio.id ? 'pause-circle' : 'play-circle'}
                    size={44}
                    color={audio.ativo ? acento('nevoa').tinta : colors.tl}
                  />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[s.audioTit, !audio.ativo && { color: colors.tl }]} numberOfLines={2}>
                    {audio.titulo}
                  </Text>
                  {audio.descricao ? <Text style={s.audioDesc} numberOfLines={1}>{audio.descricao}</Text> : null}
                  <View style={s.badgeRow}>
                    {audio.duracao ? (
                      <View style={s.badge}>
                        <Ionicons name="time-outline" size={13} color={colors.texto2} />
                        <Text style={s.badgeTxt}>{audio.duracao}</Text>
                      </View>
                    ) : null}
                    <View style={[s.badge, { backgroundColor: corPlano(audio.plano).fundo }]}>
                      <Text style={[s.badgeTxt, { color: corPlano(audio.plano).texto, fontFamily: fonts.bodyBold }]}>
                        {PLANOS.find(p => p.id === audio.plano)?.label || 'Grátis'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={s.acoes}>
                  <TouchableOpacity onPress={() => handleToggleAtivo(audio)} style={s.acaoBtn}>
                    <Ionicons
                      name={audio.ativo ? 'eye-outline' : 'eye-off-outline'}
                      size={18}
                      color={audio.ativo ? colors.lilasIcone : colors.tl}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Chips de emoção */}
              {(audio.emocoes || []).length > 0 && (
                <View style={s.emocaoRow}>
                  {(audio.emocoes || []).map(id => {
                    const e = EMOCOES.find(em => em.id === id);
                    return e ? (
                      <View key={id} style={s.emocaoChip}>
                        <Text style={s.emocaoChipTxt}>{e.label}</Text>
                      </View>
                    ) : null;
                  })}
                </View>
              )}
              <AcoesItem onApagar={() => handleExcluir(audio)} rotuloApagar="Apagar áudio" />
            </View>
          ))}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Novo áudio — modal acionado pelo botão no topo, para a gestora não
          precisar rolar até o fim de uma lista longa para cadastrar um item. */}
      <Modal
        visible={mostraModal}
        animationType="slide"
        transparent
        onRequestClose={() => setMostraModal(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={s.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.form}>
            <Text style={s.formTit}>Novo áudio de acolhimento</Text>

            <TouchableOpacity
              style={[s.uploadBtn, uploadando && { opacity: 0.6 }]}
              onPress={handleUpload}
              disabled={uploadando}
              activeOpacity={0.8}
            >
              {uploadando
                ? <ActivityIndicator size="small" color={colors.lilasTexto} />
                : <Ionicons name="cloud-upload-outline" size={20} color={colors.lilasTexto} />
              }
              <Text style={s.uploadTxt}>
                {form.url ? 'Arquivo carregado ✓' : uploadando ? 'Enviando...' : 'Selecionar arquivo de áudio'}
              </Text>
            </TouchableOpacity>

            <Text style={s.label}>Título *</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: Quando a saudade aperta"
              placeholderTextColor={colors.tl}
              value={form.titulo}
              onChangeText={v => setForm(f => ({ ...f, titulo: v }))}
            />

            {form.duracao ? (
              <Text style={s.duracaoInfo}>Duração detectada: {form.duracao}</Text>
            ) : null}

            <Text style={s.label}>Emoções *</Text>
            <View style={s.emocaoGrid}>
              {EMOCOES.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[s.emocaoOpc, form.emocoes.includes(e.id) && s.emocaoOpcSel]}
                  onPress={() => toggleEmocaoForm(e.id)}
                >
                  <Text style={[s.emocaoOpcTxt, form.emocoes.includes(e.id) && s.emocaoOpcTxtSel]}>
                    {e.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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

            <View style={s.formBtns}>
              <BotaoAdmin
                title="Cancelar"
                variant="secondary"
                onPress={() => { setMostraModal(false); setForm(novoForm()); }}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <BotaoAdmin
                title={salvando ? 'Salvando...' : 'Salvar'}
                onPress={handleSalvar}
                disabled={salvando}
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

  duracaoInfo: { ...est.dica() },
  modalOverlay: { ...est.veu(), justifyContent: 'flex-end' },
  modalCard: { ...est.folha(), padding: spacing.lg, maxHeight: '90%' },

  filtroScroll: { marginBottom: spacing.md, flexGrow: 0 },
  filtroRow: { flexDirection: 'row', gap: 8, paddingRight: spacing.md },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipTxt: est.chipTxt(),
  chipTxtSel: est.chipTxtSel(),

  vazio: { ...est.vidro(26), alignItems: 'center', gap: 10, paddingVertical: 32 },
  vazioTxt: est.legenda(),

  lista: { ...est.vidro(26), paddingVertical: 2 },
  audioCard: { paddingVertical: 13, paddingHorizontal: 14 },
  audioDiv: est.divisoria(),
  audioInativo: { opacity: 0.55 },
  audioTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  playBtn: { paddingTop: 0 },
  audioTit: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo, marginBottom: 4 },
  audioDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: acento('neutro').fundo, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  badgeTxt: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2 },
  acoes: { gap: 6 },
  acaoBtn: { ...est.botaoIcone(), width: 38, height: 38 },
  emocaoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 54 },
  emocaoChip: { backgroundColor: acento('lilas').fundo, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  emocaoChipTxt: { fontFamily: fonts.bodySemi, fontSize: 12, color: acento('lilas').texto },

  form: { marginTop: spacing.sm, gap: spacing.sm },
  formTit: { ...est.modalTitulo(), marginBottom: 4 },
  label: { ...est.rotulo(), marginTop: 6, marginBottom: 0 },
  input: est.campo(),
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
  formBtns: { flexDirection: 'row', marginTop: spacing.md },
}), { escalar: false });
