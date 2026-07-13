import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Card, Button } from '../../components';
import { confirmar } from '../../utils/confirm';

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
  { id: 1, label: 'Acolher (plano pago)' },
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

  useEffect(() => {
    const ref = query(collection(db, 'conteudos'), orderBy('criadoEm', 'desc'));
    const unsub = onSnapshot(ref, (snap) => setConteudos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const handlePublicar = async () => {
    if (!titulo.trim() || !url.trim()) {
      Alert.alert('Atenção', 'Preencha o título e a URL/link do conteúdo.');
      return;
    }
    setEnviando(true);
    try {
      await addDoc(collection(db, 'conteudos'), {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        url: url.trim(),
        tipo, grupo, plano,
        criadoEm: serverTimestamp(),
      });
      setTitulo(''); setDescricao(''); setUrl('');
    } catch (e) {
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
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Conteúdos</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>

        {/* ── Formulário ── */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.cardTitle}>Novo conteúdo</Text>

          <Text style={styles.formLabel}>Tipo</Text>
          <View style={styles.chipRow}>
            {TIPOS.map(t => (
              <TouchableOpacity key={t.id} style={[styles.chip, tipo === t.id && styles.chipSel]} onPress={() => setTipo(t.id)}>
                <Ionicons name={t.icon} size={13} color={tipo === t.id ? colors.lav6 : colors.tm} />
                <Text style={[styles.chipText, tipo === t.id && styles.chipTextSel]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>Grupo / categoria</Text>
          <View style={styles.chipRow}>
            {GRUPOS.map(g => (
              <TouchableOpacity key={g.id} style={[styles.chip, grupo === g.id && styles.chipSel]} onPress={() => setGrupo(g.id)}>
                <Text style={[styles.chipText, grupo === g.id && styles.chipTextSel]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>Plano mínimo para acessar</Text>
          <View style={styles.chipRow}>
            {PLANOS.map(p => (
              <TouchableOpacity key={p.id} style={[styles.chip, plano === p.id && styles.chipSel]} onPress={() => setPlano(p.id)}>
                <Text style={[styles.chipText, plano === p.id && styles.chipTextSel]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>Título *</Text>
          <TextInput
            style={styles.input} placeholder="Ex: Áudio de acolhimento — Dia 1"
            placeholderTextColor={colors.tl} value={titulo} onChangeText={setTitulo}
          />

          <Text style={styles.formLabel}>Descrição <Text style={styles.optional}>(opcional)</Text></Text>
          <TextInput
            style={[styles.input, { minHeight: 56, textAlignVertical: 'top' }]}
            placeholder="Uma breve descrição do que o usuário vai encontrar..."
            placeholderTextColor={colors.tl} multiline
            value={descricao} onChangeText={setDescricao}
          />

          <Text style={styles.formLabel}>URL / link *</Text>
          <TextInput
            style={styles.input} placeholder="https://..."
            placeholderTextColor={colors.tl} autoCapitalize="none"
            value={url} onChangeText={setUrl}
          />
          <Text style={styles.hint}>Cole o link de um arquivo hospedado (Firebase Storage, Google Drive, YouTube, etc.).</Text>

          <Button title={enviando ? 'Publicando...' : 'Publicar conteúdo'} onPress={handlePublicar} style={{ marginTop: spacing.md }} />
        </Card>

        {/* ── Lista ── */}
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Publicados ({conteudos.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[{ id: 'todos', label: 'Todos' }, ...GRUPOS].map(g => (
                <TouchableOpacity key={g.id} style={[styles.filterChip, filtroGrupo === g.id && styles.filterChipSel]} onPress={() => setFiltroGrupo(g.id)}>
                  <Text style={[styles.filterText, filtroGrupo === g.id && styles.filterTextSel]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {listaFiltrada.length === 0 && (
          <Text style={styles.emptyText}>Nenhum conteúdo nesta categoria ainda.</Text>
        )}

        {listaFiltrada.map(c => {
          const tipoObj = TIPOS.find(t => t.id === c.tipo);
          const grupoObj = GRUPOS.find(g => g.id === c.grupo);
          return (
            <Card key={c.id} style={styles.item}>
              <View style={styles.itemIcon}>
                <Ionicons name={tipoObj?.icon || 'document-outline'} size={16} color={colors.lav5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitulo}>{c.titulo}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                  <Text style={styles.itemTag}>{grupoObj?.label || c.grupo}</Text>
                  <Text style={[styles.itemTag, { backgroundColor: c.plano === 0 ? colors.sage + '33' : colors.lav1, color: c.plano === 0 ? colors.sage : colors.lav6 }]}>
                    {c.plano === 0 ? 'Grátis' : 'Acolher'}
                  </Text>
                </View>
                {c.descricao ? <Text style={styles.itemDesc} numberOfLines={1}>{c.descricao}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => handleRemover(c.id)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={17} color={colors.peach2} />
              </TouchableOpacity>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: spacing.sm },
  formLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 6, marginTop: spacing.sm },
  optional: { color: colors.tl, fontSize: 11 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, paddingHorizontal: 10 },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },
  input: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  hint: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 4 },
  listHeader: { marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: 8 },
  filterChip: { backgroundColor: colors.bg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 4, paddingHorizontal: 10 },
  filterChipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  filterText: { fontFamily: fonts.body, fontSize: 11, color: colors.tm },
  filterTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, marginBottom: spacing.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8, ...shadow.soft },
  itemIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  itemTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  itemTag: { fontFamily: fonts.body, fontSize: 10, color: colors.tm, backgroundColor: colors.lav1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  itemDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: 2 },
});
