import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, TextInput, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Card, Button } from '../../components';

const TIPOS = [
  { id: 'incentivo', label: 'Incentivo' },
  { id: 'live', label: 'Live / Evento' },
  { id: 'novidade', label: 'Novidade' },
];

export default function AdminNotificacoesScreen({ navigation }) {
  const [lista, setLista] = useState([]);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('incentivo');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const ref = query(collection(db, 'notificacoesEditoriais'), orderBy('criadoEm', 'desc'));
    const unsub = onSnapshot(ref, (snap) => setLista(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const handlePublicar = async () => {
    if (!texto.trim()) {
      Alert.alert('Atenção', 'Escreva o texto da notificação.');
      return;
    }
    setEnviando(true);
    try {
      await addDoc(collection(db, 'notificacoesEditoriais'), {
        tipo, texto: texto.trim(), ativa: true, criadoEm: serverTimestamp(),
      });
      setTexto('');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível publicar a notificação.');
    } finally {
      setEnviando(false);
    }
  };

  const handleToggle = (item) => updateDoc(doc(db, 'notificacoesEditoriais', item.id), { ativa: !item.ativa });

  const handleRemover = (id) => {
    Alert.alert('Remover notificação', 'Tem certeza que deseja remover?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => deleteDoc(doc(db, 'notificacoesEditoriais', id)) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Notificações editoriais</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.formLabel}>Tipo</Text>
          <View style={styles.row}>
            {TIPOS.map(t => (
              <TouchableOpacity key={t.id} style={[styles.chip, tipo === t.id && styles.chipSel]} onPress={() => setTipo(t.id)}>
                <Text style={[styles.chipText, tipo === t.id && styles.chipTextSel]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.formLabel}>Mensagem</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Escreva a mensagem que todas as usuárias verão..."
            placeholderTextColor={colors.tl}
            multiline
            value={texto}
            onChangeText={setTexto}
          />
          <Button title={enviando ? 'Publicando...' : 'Publicar para todas'} onPress={handlePublicar} style={{ marginTop: spacing.md }} />
        </Card>

        <Text style={styles.sectionTitle}>Publicadas</Text>
        {lista.length === 0 && <Text style={styles.emptyText}>Nenhuma notificação publicada ainda.</Text>}
        {lista.map(n => (
          <Card key={n.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTipo}>{TIPOS.find(t => t.id === n.tipo)?.label || n.tipo}</Text>
              <Text style={styles.itemTexto}>{n.texto}</Text>
            </View>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Switch value={!!n.ativa} onValueChange={() => handleToggle(n)} trackColor={{ true: colors.lav4 }} />
              <TouchableOpacity onPress={() => handleRemover(n.id)}>
                <Ionicons name="trash-outline" size={16} color={colors.peach2} />
              </TouchableOpacity>
            </View>
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
  chip: { backgroundColor: colors.bg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, paddingHorizontal: 10 },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },
  input: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, marginBottom: spacing.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8, ...shadow.soft },
  itemTipo: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lav5, marginBottom: 2 },
  itemTexto: { fontFamily: fonts.body, fontSize: 13, color: colors.td, lineHeight: 18 },
});
