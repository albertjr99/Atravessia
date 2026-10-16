import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, BotaoAdmin } from './adminEstilo';
import { confirmar } from '../../utils/confirm';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';

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
  { id: 'plano2', label: 'Somente Compreender (futuro)' },
  { id: 'plano3', label: 'Somente Evoluir (futuro)' },
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
      <AdminSubTabs grupo="comunicacao" atual="AdminNotificacoes" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <Text style={styles.sobre}>Comunicação</Text>
        <Text style={styles.pageTitle}>Notificações</Text>
        <Text style={styles.pageSub}>Publique avisos e mensagens para as usuárias do app.</Text>

        <View style={styles.form}>
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
          <BotaoAdmin title={enviando ? 'Publicando...' : 'Publicar notificação'} onPress={handlePublicar} icone="paper-plane-outline" style={{ marginTop: spacing.lg }} />
        </View>

        <Text style={styles.sectionTitle}>Publicadas</Text>
        {lista.length === 0 && <Text style={styles.emptyText}>Nenhuma notificação publicada ainda.</Text>}
        {lista.length > 0 && (
          <View style={styles.lista}>
            {lista.map((n, i) => (
              <View key={n.id} style={[styles.item, i > 0 && styles.itemDiv]}>
                <View style={styles.itemIcone}>
                  <Ionicons name="megaphone-outline" size={19} color={acento('pessego').tinta} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.itemTipo}>{TIPOS.find(t => t.id === n.tipo)?.label || n.tipo}</Text>
                    {n.alvo && n.alvo !== 'todos' && (
                      <Text style={[styles.itemTipo, styles.itemAlvo]}>
                        {ALVOS.find(a => a.id === n.alvo)?.label || n.alvo}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.itemTexto}>{n.texto}</Text>
                </View>
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Switch value={!!n.ativa} onValueChange={() => handleToggle(n)} trackColor={{ true: colors.lav4 }} />
                  <TouchableOpacity onPress={() => handleRemover(n.id)} style={styles.acaoBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.roseTexto} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </AdminLayout>
  );
}

const styles = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },
  form: { ...est.vidro(26), padding: 18, marginBottom: spacing.xl },
  formLabel: { ...est.rotulo(), marginTop: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipText: est.chipTxt(),
  chipTextSel: est.chipTxtSel(),
  input: est.campo(),
  sectionTitle: { ...est.secao(), marginBottom: 10 },
  emptyText: { ...est.legenda(), marginBottom: spacing.md },
  lista: { ...est.vidro(26), paddingVertical: 2 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  itemDiv: est.divisoria(),
  itemIcone: { ...est.pilula(40), backgroundColor: acento('pessego').fundo },
  itemTipo: {
    ...est.etiquetaTxt(), color: acento('lilas').texto, backgroundColor: acento('lilas').fundo,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden',
  },
  itemAlvo: { color: acento('salvia').texto, backgroundColor: acento('salvia').fundo },
  itemTexto: { fontFamily: fonts.body, fontSize: 15, color: colors.td, lineHeight: 22 },
  acaoBtn: { padding: 6 },
}), { escalar: false });
