import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { ScriptTitle, Card, Button } from '../../components';

const TIPOS = [
  { id: 'audio', label: 'Áudio', icon: 'headset-outline' },
  { id: 'documento', label: 'Documento', icon: 'document-text-outline' },
  { id: 'link', label: 'Link', icon: 'link-outline' },
];
const GRUPOS = [
  { id: 'acolhimento', label: 'Acolhimento' },
  { id: 'complementar', label: 'Complementar' },
  { id: 'sessao', label: 'Sessão' },
];

export default function AdminConteudosScreen({ navigation }) {
  const [conteudos, setConteudos] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [url, setUrl] = useState('');
  const [tipo, setTipo] = useState('audio');
  const [grupo, setGrupo] = useState('acolhimento');
  const [enviando, setEnviando] = useState(false);

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
        titulo: titulo.trim(), url: url.trim(), tipo, grupo, criadoEm: serverTimestamp(),
      });
      setTitulo(''); setUrl('');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível publicar o conteúdo.');
    } finally {
      setEnviando(false);
    }
  };

  const handleRemover = (id) => {
    Alert.alert('Remover conteúdo', 'Tem certeza que deseja remover este conteúdo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => deleteDoc(doc(db, 'conteudos', id)) },
    ]);
  };

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.formLabel}>Tipo</Text>
          <View style={styles.row}>
            {TIPOS.map(t => (
              <TouchableOpacity key={t.id} style={[styles.chip, tipo === t.id && styles.chipSel]} onPress={() => setTipo(t.id)}>
                <Ionicons name={t.icon} size={14} color={tipo === t.id ? colors.lav6 : colors.tm} />
                <Text style={[styles.chipText, tipo === t.id && styles.chipTextSel]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>Grupo de acesso</Text>
          <View style={styles.row}>
            {GRUPOS.map(g => (
              <TouchableOpacity key={g.id} style={[styles.chip, grupo === g.id && styles.chipSel]} onPress={() => setGrupo(g.id)}>
                <Text style={[styles.chipText, grupo === g.id && styles.chipTextSel]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>Título</Text>
          <TextInput style={styles.input} placeholder="Ex: Áudio de acolhimento — dia 1" placeholderTextColor={colors.tl} value={titulo} onChangeText={setTitulo} />

          <Text style={styles.formLabel}>URL / link do arquivo</Text>
          <TextInput style={styles.input} placeholder="https://..." placeholderTextColor={colors.tl} autoCapitalize="none" value={url} onChangeText={setUrl} />
          <Text style={styles.hint}>Cole o link de um arquivo hospedado (Firebase Storage, Google Drive, YouTube, etc).</Text>

          <Button title={enviando ? 'Publicando...' : 'Publicar conteúdo'} onPress={handlePublicar} style={{ marginTop: spacing.md }} />
        </Card>

        <Text style={styles.sectionTitle}>Conteúdos publicados</Text>
        {conteudos.length === 0 && <Text style={styles.emptyText}>Nenhum conteúdo publicado ainda.</Text>}
        {conteudos.map(c => (
          <Card key={c.id} style={styles.item}>
            <View style={styles.itemIcon}>
              <Ionicons name={TIPOS.find(t => t.id === c.tipo)?.icon || 'document-outline'} size={16} color={colors.lav5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitulo}>{c.titulo}</Text>
              <Text style={styles.itemSub}>{GRUPOS.find(g => g.id === c.grupo)?.label || c.grupo}</Text>
            </View>
            <TouchableOpacity onPress={() => handleRemover(c.id)}>
              <Ionicons name="trash-outline" size={18} color={colors.peach2} />
            </TouchableOpacity>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  formLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 6, marginTop: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, paddingHorizontal: 10 },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },
  input: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  hint: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 4 },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, marginBottom: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, ...shadow.soft },
  itemIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  itemSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 1 },
});
