import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { ref as sRef, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { uploadToStorage } from '../../utils/storageUpload';
import { db, storage } from '../../services/firebase';
import { colors, fonts, spacing, radius } from '../../theme';
import { Card, Button } from '../../components';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import AdminLayout from './AdminLayout';

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

const PLANO_COR = { 0: colors.sage, 1: colors.lav4, 2: '#7B5EA7', 3: '#C0843F' };

function novoForm() {
  return { titulo: '', descricao: '', duracao: '', plano: 1, emocoes: [], url: '', storagePath: '' };
}

export default function AdminAudiosScreen({ navigation }) {
  const [audios, setAudios] = useState([]);
  const [filtroEmocao, setFiltroEmocao] = useState('todos');
  const [mostraForm, setMostraForm] = useState(false);
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
          setForm(f => ({ ...f, url, storagePath: path, titulo: f.titulo || titulo }));
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
        setForm(f => ({ ...f, url, storagePath: path, titulo: f.titulo || titulo }));
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
        descricao: form.descricao.trim(),
        duracao: form.duracao.trim(),
        plano: form.plano,
        emocoes: form.emocoes,
        url: form.url.trim(),
        storagePath: form.storagePath,
        ativo: true,
        criadoEm: serverTimestamp(),
      });
      setForm(novoForm());
      setMostraForm(false);
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.pageTitle}>Áudios de Acolhimento</Text>
        <Text style={s.pageSub}>Áudios exibidos no check-in por emoção.</Text>

        {/* Filtro por emoção */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtroScroll} contentContainerStyle={s.filtroRow}>
          <TouchableOpacity
            style={[s.chip, filtroEmocao === 'todos' && s.chipSel]}
            onPress={() => setFiltroEmocao('todos')}
          >
            <Text style={[s.chipTxt, filtroEmocao === 'todos' && s.chipTxtSel]}>Todos</Text>
          </TouchableOpacity>
          {EMOCOES.map(e => (
            <TouchableOpacity
              key={e.id}
              style={[s.chip, filtroEmocao === e.id && s.chipSel]}
              onPress={() => setFiltroEmocao(e.id)}
            >
              <Text style={[s.chipTxt, filtroEmocao === e.id && s.chipTxtSel]}>{e.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Lista */}
        {audiosFiltrados.length === 0 ? (
          <Card style={s.vazio}>
            <Ionicons name="musical-notes-outline" size={32} color={colors.tl} />
            <Text style={s.vazioTxt}>Nenhum áudio{filtroEmocao !== 'todos' ? ' para esta emoção' : ''} ainda.</Text>
          </Card>
        ) : (
          audiosFiltrados.map(audio => (
            <Card key={audio.id} style={[s.audioCard, !audio.ativo && s.audioInativo]}>
              <View style={s.audioTop}>
                <TouchableOpacity style={s.playBtn} onPress={() => handleTocarPausar(audio)}>
                  <Ionicons
                    name={tocandoId === audio.id ? 'pause-circle' : 'play-circle'}
                    size={40}
                    color={audio.ativo ? colors.lav5 : colors.tl}
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
                        <Ionicons name="time-outline" size={10} color={colors.tm} />
                        <Text style={s.badgeTxt}>{audio.duracao}</Text>
                      </View>
                    ) : null}
                    <View style={[s.badge, { backgroundColor: PLANO_COR[audio.plano] + '33' }]}>
                      <Text style={[s.badgeTxt, { color: PLANO_COR[audio.plano] }]}>
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
                      color={audio.ativo ? colors.lav5 : colors.tl}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleExcluir(audio)} style={s.acaoBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.rose} />
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
            </Card>
          ))
        )}

        {/* Botão adicionar */}
        {!mostraForm && (
          <Button
            title="+ Adicionar áudio"
            onPress={() => setMostraForm(true)}
            style={{ marginTop: spacing.md }}
          />
        )}

        {/* Formulário de adição */}
        {mostraForm && (
          <Card style={s.form}>
            <Text style={s.formTit}>Novo áudio de acolhimento</Text>

            <TouchableOpacity
              style={[s.uploadBtn, uploadando && { opacity: 0.6 }]}
              onPress={handleUpload}
              disabled={uploadando}
              activeOpacity={0.8}
            >
              {uploadando
                ? <ActivityIndicator size="small" color={colors.lav5} />
                : <Ionicons name="cloud-upload-outline" size={20} color={colors.lav5} />
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

            <Text style={s.label}>Descrição</Text>
            <TextInput
              style={[s.input, { height: 64, textAlignVertical: 'top' }]}
              placeholder="Breve descrição do áudio..."
              placeholderTextColor={colors.tl}
              multiline
              value={form.descricao}
              onChangeText={v => setForm(f => ({ ...f, descricao: v }))}
            />

            <Text style={s.label}>Duração</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: 8 min"
              placeholderTextColor={colors.tl}
              value={form.duracao}
              onChangeText={v => setForm(f => ({ ...f, duracao: v }))}
            />

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
                  style={[s.planoOpc, form.plano === p.id && { backgroundColor: PLANO_COR[p.id] + '33', borderColor: PLANO_COR[p.id] }]}
                  onPress={() => setForm(f => ({ ...f, plano: p.id }))}
                >
                  <Text style={[s.planoTxt, form.plano === p.id && { color: PLANO_COR[p.id] }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.formBtns}>
              <Button
                title="Cancelar"
                onPress={() => { setMostraForm(false); setForm(novoForm()); }}
                style={{ flex: 1, marginRight: spacing.sm, backgroundColor: colors.lav1 }}
                textStyle={{ color: colors.lav5 }}
              />
              <Button
                title={salvando ? 'Salvando...' : 'Salvar'}
                onPress={handleSalvar}
                disabled={salvando}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.md },

  filtroScroll: { marginBottom: spacing.md },
  filtroRow: { flexDirection: 'row', gap: 8, paddingRight: spacing.md },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: colors.lav1,
    borderWidth: 1, borderColor: colors.lav2,
  },
  chipSel: { backgroundColor: colors.lav5, borderColor: colors.lav5 },
  chipTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTxtSel: { color: 'white' },

  vazio: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  vazioTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.tl },

  audioCard: { marginBottom: spacing.sm },
  audioInativo: { opacity: 0.55 },
  audioTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  playBtn: { paddingTop: 2 },
  audioTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: 2 },
  audioDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.lav1, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeTxt: { fontFamily: fonts.body, fontSize: 10, color: colors.tm },
  acoes: { gap: 8 },
  acaoBtn: { padding: 4 },
  emocaoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  emocaoChip: {
    backgroundColor: colors.lav1, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  emocaoChipTxt: { fontFamily: fonts.body, fontSize: 10, color: colors.lav5 },

  form: { marginTop: spacing.sm, gap: spacing.sm },
  formTit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td, marginBottom: 4 },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 4, marginTop: 4 },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
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
  emocaoOpcSel: { backgroundColor: colors.lav5, borderColor: colors.lav5 },
  emocaoOpcTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  emocaoOpcTxtSel: { color: 'white' },
  planoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planoOpc: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  planoTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  formBtns: { flexDirection: 'row', marginTop: spacing.sm },
});
