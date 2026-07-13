import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Card, Button } from '../../components';
import { confirmar } from '../../utils/confirm';
import AdminLayout from './AdminLayout';

const TIPOS = [
  { id: 'incentivo', label: 'Incentivo' },
  { id: 'live', label: 'Live / Evento' },
  { id: 'novidade', label: 'Novidade' },
  { id: 'lembrete', label: 'Lembrete' },
];

const ALVOS = [
  { id: 'todos', label: 'Todas as usuárias' },
  { id: 'plano1', label: 'Somente Acolher (pago)' },
  { id: 'gratis', label: 'Somente Perceber (grátis)' },
];

export default function AdminNotificacoesScreen({ navigation }) {
  const [lista, setLista] = useState([]);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('incentivo');
  const [alvo, setAlvo] = useState('todos');
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
        tipo, alvo, texto: texto.trim(), ativa: true, criadoEm: serverTimestamp(),
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
    confirmar('Remover notificação', 'Tem certeza que deseja remover?', () => deleteDoc(doc(db, 'notificacoesEditoriais', id)), 'Remover');
  };

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminNotificacoes">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Notificações</Text>
        <Text style={styles.pageSub}>Publique avisos e mensagens para as usuárias do app.</Text>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.formLabel}>Tipo</Text>
          <View style={styles.row}>
            {TIPOS.map(t => (
              <TouchableOpacity key={t.id} style={[styles.chip, tipo === t.id && styles.chipSel]} onPress={() => setTipo(t.id)}>
                <Text style={[styles.chipText, tipo === t.id && styles.chipTextSel]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>Destinatárias</Text>
          <View style={styles.row}>
            {ALVOS.map(a => (
              <TouchableOpacity key={a.id} style={[styles.chip, alvo === a.id && styles.chipSel]} onPress={() => setAlvo(a.id)}>
                <Text style={[styles.chipText, alvo === a.id && styles.chipTextSel]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>Mensagem</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Escreva a mensagem que as usuárias verão..."
            placeholderTextColor={colors.tl}
            multiline
            value={texto}
            onChangeText={setTexto}
          />
          <Button title={enviando ? 'Publicando...' : 'Publicar notificação'} onPress={handlePublicar} style={{ marginTop: spacing.md }} />
        </Card>

        <Text style={styles.sectionTitle}>Publicadas</Text>
        {lista.length === 0 && <Text style={styles.emptyText}>Nenhuma notificação publicada ainda.</Text>}
        {lista.map(n => (
          <Card key={n.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                <Text style={styles.itemTipo}>{TIPOS.find(t => t.id === n.tipo)?.label || n.tipo}</Text>
                {n.alvo && n.alvo !== 'todos' && (
                  <Text style={[styles.itemTipo, { color: colors.sage }]}>
                    {ALVOS.find(a => a.id === n.alvo)?.label || n.alvo}
                  </Text>
                )}
              </View>
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
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg },
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
