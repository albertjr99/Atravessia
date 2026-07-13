import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Card, Button } from '../../components';
import { confirmar } from '../../utils/confirm';
import AdminLayout from './AdminLayout';

const TIPOS = [
  { id: 'audio', label: 'Áudio', icon: 'headset-outline' },
  { id: 'video', label: 'Vídeo', icon: 'videocam-outline' },
  { id: 'documento', label: 'Documento', icon: 'document-text-outline' },
  { id: 'link', label: 'Link', icon: 'link-outline' },
];

const GRUPOS = [
  { id: 'acolhimento', label: 'Acolhimento' },
  { id: 'noturno', label: 'Noturno' },
  { id: 'complementar', label: 'Complementar' },
];

const PLANOS = [
  { id: 0, label: 'Perceber (grátis)' },
  { id: 1, label: 'Acolher (pago)' },
];

export default function AdminConteudosScreen({ navigation }) {
  const [conteudos, setConteudos] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [url, setUrl] = useState('');
  const [tipo, setTipo] = useState('audio');
  const [grupo, setGrupo] = useState('acolhimento');
  const [plano, setPlano] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [uploadando, setUploadando] = useState(false);

  useEffect(() => {
    const ref = query(collection(db, 'conteudos'), orderBy('criadoEm', 'desc'));
    const unsub = onSnapshot(ref, (snap) => setConteudos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const handleUpload = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Upload', 'O upload de arquivos está disponível apenas no portal web.\nNo celular, cole o link do arquivo no campo URL.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,video/*,application/pdf,image/*';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadando(true);
      try {
        const { ref: sRef, uploadBytes, getDownloadURL } = require('firebase/storage');
        const { storage } = require('../../services/firebase');
        const nomeArq = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const fileRef = sRef(storage, `conteudos/${nomeArq}`);
        await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(fileRef);
        setUrl(downloadURL);
        Alert.alert('Arquivo carregado!', 'O link foi preenchido automaticamente.');
      } catch (err) {
        Alert.alert('Erro no upload', err?.code || err?.message || 'Tente novamente.');
      } finally {
        setUploadando(false);
      }
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => { if (document.body.contains(input)) document.body.removeChild(input); }, 5000);
  };

  const handlePublicar = async () => {
    if (!titulo.trim() || !url.trim()) {
      Alert.alert('Atenção', 'Preencha o título e a URL do conteúdo.');
      return;
    }
    setEnviando(true);
    try {
      await addDoc(collection(db, 'conteudos'), {
        titulo: titulo.trim(), descricao: descricao.trim(),
        url: url.trim(), tipo, grupo, plano,
        criadoEm: serverTimestamp(),
      });
      setTitulo(''); setDescricao(''); setUrl('');
    } catch {
      Alert.alert('Erro', 'Não foi possível publicar o conteúdo.');
    } finally {
      setEnviando(false);
    }
  };

  const handleRemover = (id) => {
    confirmar('Remover conteúdo', 'Tem certeza que deseja remover?', () => deleteDoc(doc(db, 'conteudos', id)), 'Remover');
  };

  const listaFiltrada = filtroGrupo === 'todos'
    ? conteudos
    : conteudos.filter(c => c.grupo === filtroGrupo);

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminConteudos">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        <Text style={s.pageTitle}>Conteúdos</Text>
        <Text style={s.pageSub}>Publique áudios, vídeos, documentos e links para as usuárias.</Text>

        {/* ── Formulário ── */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={s.cardTitle}>Novo conteúdo</Text>

          <Text style={s.formLabel}>Tipo</Text>
          <View style={s.chipRow}>
            {TIPOS.map(t => (
              <TouchableOpacity key={t.id} style={[s.chip, tipo === t.id && s.chipSel]} onPress={() => setTipo(t.id)}>
                <Ionicons name={t.icon} size={13} color={tipo === t.id ? colors.lav6 : colors.tm} />
                <Text style={[s.chipText, tipo === t.id && s.chipTextSel]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.formLabel}>Grupo / categoria</Text>
          <View style={s.chipRow}>
            {GRUPOS.map(g => (
              <TouchableOpacity key={g.id} style={[s.chip, grupo === g.id && s.chipSel]} onPress={() => setGrupo(g.id)}>
                <Text style={[s.chipText, grupo === g.id && s.chipTextSel]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.formLabel}>Plano mínimo</Text>
          <View style={s.chipRow}>
            {PLANOS.map(p => (
              <TouchableOpacity key={p.id} style={[s.chip, plano === p.id && s.chipSel]} onPress={() => setPlano(p.id)}>
                <Text style={[s.chipText, plano === p.id && s.chipTextSel]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.formLabel}>Título <Text style={s.required}>*</Text></Text>
          <TextInput
            style={s.input} placeholder="Ex: Áudio de acolhimento — Dia 1"
            placeholderTextColor={colors.tl} value={titulo} onChangeText={setTitulo}
          />

          <Text style={s.formLabel}>Descrição <Text style={s.optional}>(opcional)</Text></Text>
          <TextInput
            style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
            placeholder="Breve descrição do conteúdo..."
            placeholderTextColor={colors.tl} multiline
            value={descricao} onChangeText={setDescricao}
          />

          <Text style={s.formLabel}>Arquivo ou URL <Text style={s.required}>*</Text></Text>

          {/* Upload area */}
          <TouchableOpacity
            style={[s.uploadArea, uploadando && { opacity: 0.6 }]}
            onPress={handleUpload}
            disabled={uploadando}
          >
            <Ionicons name={uploadando ? 'hourglass-outline' : 'cloud-upload-outline'} size={24} color={colors.lav4} />
            <Text style={s.uploadLabel}>
              {uploadando ? 'Fazendo upload...' : 'Clique para fazer upload de um arquivo'}
            </Text>
            <Text style={s.uploadHint}>Áudio, vídeo, PDF, imagem</Text>
          </TouchableOpacity>


          <Text style={s.orText}>— ou cole um link —</Text>
          <TextInput
            style={s.input} placeholder="https://..."
            placeholderTextColor={colors.tl} autoCapitalize="none"
            value={url} onChangeText={setUrl}
          />
          <Text style={s.hint}>Firebase Storage, Google Drive, YouTube, Spotify, etc.</Text>

          <Button title={enviando ? 'Publicando...' : 'Publicar conteúdo'} onPress={handlePublicar} style={{ marginTop: spacing.md }} />
        </Card>

        {/* ── Lista ── */}
        <View style={s.listHeader}>
          <Text style={s.sectionTitle}>Publicados ({conteudos.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[{ id: 'todos', label: 'Todos' }, ...GRUPOS].map(g => (
                <TouchableOpacity key={g.id} style={[s.filterChip, filtroGrupo === g.id && s.filterChipSel]} onPress={() => setFiltroGrupo(g.id)}>
                  <Text style={[s.filterText, filtroGrupo === g.id && s.filterTextSel]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {listaFiltrada.length === 0 && (
          <Text style={s.emptyText}>Nenhum conteúdo nesta categoria ainda.</Text>
        )}
        {listaFiltrada.map(c => {
          const tipoObj = TIPOS.find(t => t.id === c.tipo);
          const grupoObj = GRUPOS.find(g => g.id === c.grupo);
          return (
            <Card key={c.id} style={s.item}>
              <View style={s.itemIcon}>
                <Ionicons name={tipoObj?.icon || 'document-outline'} size={16} color={colors.lav5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitulo}>{c.titulo}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                  <Text style={s.itemTag}>{grupoObj?.label || c.grupo}</Text>
                  <Text style={[s.itemTag, { backgroundColor: c.plano === 0 ? colors.sage + '33' : colors.lav1, color: c.plano === 0 ? colors.sage : colors.lav6 }]}>
                    {c.plano === 0 ? 'Grátis' : 'Acolher'}
                  </Text>
                </View>
                {c.descricao ? <Text style={s.itemDesc} numberOfLines={1}>{c.descricao}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => handleRemover(c.id)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={17} color={colors.peach2} />
              </TouchableOpacity>
            </Card>
          );
        })}
      </ScrollView>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: spacing.sm },
  formLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 6, marginTop: spacing.sm },
  required: { color: colors.rose },
  optional: { color: colors.tl, fontSize: 11 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, paddingHorizontal: 10 },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },
  input: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  uploadArea: {
    borderWidth: 1.5, borderColor: colors.lav3, borderStyle: 'dashed',
    borderRadius: radius.lg, padding: spacing.lg,
    alignItems: 'center', gap: 6, backgroundColor: colors.lav1,
    marginVertical: spacing.sm,
  },
  uploadLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav5, textAlign: 'center' },
  uploadHint: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },
  progressTrack: { height: 6, backgroundColor: colors.lav1, borderRadius: radius.full, overflow: 'hidden', marginVertical: 4 },
  progressFill: { height: '100%', backgroundColor: colors.lav4, borderRadius: radius.full },
  orText: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, textAlign: 'center', marginVertical: 8 },
  hint: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 4 },
  listHeader: { marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: 8 },
  filterChip: { backgroundColor: colors.bg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 4, paddingHorizontal: 10 },
  filterChipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  filterText: { fontFamily: fonts.body, fontSize: 11, color: colors.tm },
  filterTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, marginBottom: spacing.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  itemIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  itemTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  itemTag: { fontFamily: fonts.body, fontSize: 10, color: colors.tm, backgroundColor: colors.lav1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  itemDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: 2 },
});
