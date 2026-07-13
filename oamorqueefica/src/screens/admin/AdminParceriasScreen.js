import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  Alert, Platform, Image, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy,
  query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius } from '../../theme';
import { Card, Button } from '../../components';
import { confirmar } from '../../utils/confirm';
import AdminLayout from './AdminLayout';

const CATEGORIAS = ['Saúde', 'Bem-estar', 'Terapias', 'Educação', 'Farmácia', 'Clínica', 'Produtos'];

export default function AdminParceriasScreen({ navigation }) {
  const [parcerias, setParcerias] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [link, setLink] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  const [categoriaSel, setCategoriaSel] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [uploadando, setUploadando] = useState(false);

  useEffect(() => {
    const ref = query(collection(db, 'parcerias'), orderBy('criadoEm', 'desc'));
    const unsub = onSnapshot(ref, (snap) => {
      setParcerias(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  const handleUploadImagem = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Upload', 'O upload de imagens está disponível apenas no portal web.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadando(true);
      try {
        const { ref: sRef, uploadBytes, getDownloadURL } = require('firebase/storage');
        const { storage } = require('../../services/firebase');
        const nomeArq = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const fileRef = sRef(storage, `parcerias/${nomeArq}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        setImagemUrl(url);
        Alert.alert('', 'Imagem carregada! O link foi preenchido automaticamente.');
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

  const toggleCategoria = (cat) => {
    setCategoriaSel(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handlePublicar = async () => {
    if (!titulo.trim() || !link.trim()) {
      Alert.alert('Atenção', 'Preencha pelo menos o título e o link de destino.');
      return;
    }
    setEnviando(true);
    try {
      await addDoc(collection(db, 'parcerias'), {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        link: link.trim(),
        imagemUrl: imagemUrl.trim(),
        categorias: categoriaSel,
        ativo: true,
        cliques: 0,
        criadoEm: serverTimestamp(),
      });
      setTitulo(''); setDescricao(''); setLink(''); setImagemUrl(''); setCategoriaSel([]);
      Alert.alert('', 'Parceria publicada com sucesso!');
    } catch {
      Alert.alert('Erro', 'Não foi possível publicar a parceria.');
    } finally {
      setEnviando(false);
    }
  };

  const handleToggleAtivo = (p) => {
    updateDoc(doc(db, 'parcerias', p.id), { ativo: !p.ativo }).catch(() => {});
  };

  const handleRemover = (id) => {
    confirmar('Remover parceria', 'Tem certeza que deseja remover esta parceria?',
      () => deleteDoc(doc(db, 'parcerias', id)), 'Remover');
  };

  const ativas = parcerias.filter(p => p.ativo !== false).length;
  const totalCliques = parcerias.reduce((s, p) => s + (p.cliques || 0), 0);

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminParcerias">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        <Text style={s.pageTitle}>Parcerias</Text>
        <Text style={s.pageSub}>
          Crie banners de parceria e benefícios exclusivos que aparecem para todas as usuárias no app, direto do plano gratuito.
        </Text>

        {/* ── Resumo ── */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Ionicons name="people-outline" size={18} color={colors.lav4} />
            <Text style={[s.statNum, { color: colors.lav4 }]}>{parcerias.length}</Text>
            <Text style={s.statLbl}>total</Text>
          </View>
          <View style={s.statBox}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.sage} />
            <Text style={[s.statNum, { color: colors.sage }]}>{ativas}</Text>
            <Text style={s.statLbl}>ativas</Text>
          </View>
          <View style={s.statBox}>
            <Ionicons name="stats-chart-outline" size={18} color={colors.gold} />
            <Text style={[s.statNum, { color: colors.gold }]}>{totalCliques}</Text>
            <Text style={s.statLbl}>cliques totais</Text>
          </View>
        </View>

        {/* ── Formulário ── */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={s.cardTitle}>Nova parceria / benefício</Text>

          <Text style={s.formLabel}>Título <Text style={s.required}>*</Text></Text>
          <TextInput
            style={s.input}
            placeholder="Ex: 10% de desconto na Farmácia X"
            placeholderTextColor={colors.tl}
            value={titulo}
            onChangeText={setTitulo}
          />

          <Text style={s.formLabel}>Descrição <Text style={s.optional}>(opcional)</Text></Text>
          <TextInput
            style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
            placeholder="Descreva o benefício ou como utilizá-lo..."
            placeholderTextColor={colors.tl}
            multiline
            value={descricao}
            onChangeText={setDescricao}
          />

          <Text style={s.formLabel}>Link de destino <Text style={s.required}>*</Text></Text>
          <TextInput
            style={s.input}
            placeholder="https://..."
            placeholderTextColor={colors.tl}
            autoCapitalize="none"
            value={link}
            onChangeText={setLink}
          />
          <Text style={s.hint}>Para onde o usuário será redirecionado ao clicar no banner.</Text>

          <Text style={s.formLabel}>Banner / imagem da parceria</Text>
          <TouchableOpacity
            style={[s.uploadArea, uploadando && { opacity: 0.6 }]}
            onPress={handleUploadImagem}
            disabled={uploadando}
          >
            <Ionicons name={uploadando ? 'hourglass-outline' : 'image-outline'} size={24} color={colors.lav4} />
            <Text style={s.uploadLabel}>
              {uploadando ? 'Fazendo upload...' : 'Clique para enviar imagem do banner'}
            </Text>
            <Text style={s.uploadHint}>PNG, JPG — Tamanho sugerido: 800×400 px</Text>
          </TouchableOpacity>
          <Text style={s.orText}>— ou cole um link de imagem —</Text>
          <TextInput
            style={s.input}
            placeholder="https://..."
            placeholderTextColor={colors.tl}
            autoCapitalize="none"
            value={imagemUrl}
            onChangeText={setImagemUrl}
          />
          {imagemUrl ? (
            <Image source={{ uri: imagemUrl }} style={s.previewImg} resizeMode="cover" />
          ) : null}

          <Text style={s.formLabel}>Categorias</Text>
          <View style={s.chipRow}>
            {CATEGORIAS.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[s.chip, categoriaSel.includes(cat) && s.chipSel]}
                onPress={() => toggleCategoria(cat)}
              >
                <Text style={[s.chipText, categoriaSel.includes(cat) && s.chipTextSel]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title={enviando ? 'Publicando...' : 'Publicar parceria no app'}
            onPress={handlePublicar}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* ── Lista ── */}
        <Text style={s.sectionTitle}>
          Publicadas ({parcerias.length}) · {ativas} ativas
        </Text>

        {parcerias.length === 0 && (
          <Text style={s.emptyText}>Nenhuma parceria publicada ainda.</Text>
        )}

        {parcerias.map(p => (
          <Card key={p.id} style={s.item}>
            {p.imagemUrl ? (
              <Image source={{ uri: p.imagemUrl }} style={s.itemThumb} resizeMode="cover" />
            ) : (
              <View style={[s.itemThumb, s.itemThumbPlaceholder]}>
                <Ionicons name="image-outline" size={20} color={colors.tl} />
              </View>
            )}
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <Text style={s.itemTitulo} numberOfLines={1}>{p.titulo}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {(p.categorias || []).slice(0, 2).map(cat => (
                  <Text key={cat} style={s.itemTag}>{cat}</Text>
                ))}
                <View style={s.cliquesTag}>
                  <Ionicons name="stats-chart-outline" size={10} color={colors.lav5} />
                  <Text style={s.cliquesTagTxt}>{p.cliques || 0} cliques</Text>
                </View>
              </View>
              <Text style={s.itemLink} numberOfLines={1}>{p.link}</Text>
            </View>
            <View style={s.itemActions}>
              <Switch
                value={p.ativo !== false}
                onValueChange={() => handleToggleAtivo(p)}
                trackColor={{ false: colors.border, true: colors.lav3 }}
                thumbColor={p.ativo !== false ? colors.lav4 : colors.tl}
              />
              <Text style={s.switchLbl}>{p.ativo !== false ? 'Ativa' : 'Oculta'}</Text>
              <TouchableOpacity onPress={() => handleRemover(p.id)} style={{ padding: 4, marginTop: 4 }}>
                <Ionicons name="trash-outline" size={17} color={colors.peach2} />
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </ScrollView>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg, lineHeight: 20 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  statBox: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  statNum: { fontFamily: fonts.bodyBold, fontSize: 22 },
  statLbl: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, textAlign: 'center' },

  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: spacing.sm },
  formLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 6, marginTop: spacing.sm },
  required: { color: colors.rose },
  optional: { color: colors.tl, fontSize: 11 },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  hint: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 4 },
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
  previewImg: { width: '100%', height: 130, borderRadius: radius.md, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  chip: {
    backgroundColor: colors.bg, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },

  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: 8 },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, marginBottom: spacing.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  itemThumb: { width: 56, height: 56, borderRadius: radius.md, flexShrink: 0 },
  itemThumbPlaceholder: { backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  itemTag: {
    fontFamily: fonts.body, fontSize: 10, color: colors.tm,
    backgroundColor: colors.lav1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full,
  },
  cliquesTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.sage + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full,
  },
  cliquesTagTxt: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.lav5 },
  itemLink: { fontFamily: fonts.body, fontSize: 10, color: colors.lav4 },
  itemActions: { alignItems: 'center', gap: 2 },
  switchLbl: { fontFamily: fonts.body, fontSize: 9, color: colors.tl },
});
