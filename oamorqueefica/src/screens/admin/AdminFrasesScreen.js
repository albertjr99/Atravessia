import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  orderBy, query, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Card } from '../../components';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';
import { FRASES_SEED } from '../../data/frasesSeed';

const VAZIO = { texto: '', autor: '', reflexao: '' };

export default function AdminFrasesScreen({ navigation }) {
  const [frases, setFrases] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todas'); // todas | ativas | inativas
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', item }
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    const ref = query(collection(db, 'frases'), orderBy('criadoEm', 'asc'));
    const unsub = onSnapshot(ref, (snap) => {
      setFrases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  const lista = useMemo(() => {
    return frases.filter(f => {
      const matchBusca = !busca || [f.texto, f.autor, f.reflexao].some(
        v => v?.toLowerCase().includes(busca.toLowerCase())
      );
      const matchFiltro = filtro === 'todas'
        ? true
        : filtro === 'ativas' ? f.ativa !== false : f.ativa === false;
      return matchBusca && matchFiltro;
    });
  }, [frases, busca, filtro]);

  const totalAtivas = frases.filter(f => f.ativa !== false).length;
  const totalInativas = frases.filter(f => f.ativa === false).length;

  const abrirAdicionar = () => {
    setForm(VAZIO);
    setModal({ mode: 'add' });
  };

  const abrirEditar = (item) => {
    setForm({ texto: item.texto || '', autor: item.autor || '', reflexao: item.reflexao || '' });
    setModal({ mode: 'edit', item });
  };

  const fecharModal = () => { setModal(null); setForm(VAZIO); };

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSalvar = async () => {
    if (!form.texto.trim()) { Alert.alert('Atenção', 'O texto da frase é obrigatório.'); return; }
    if (!form.reflexao.trim()) { Alert.alert('Atenção', 'A reflexão é obrigatória.'); return; }
    setSalvando(true);
    try {
      if (modal.mode === 'add') {
        await addDoc(collection(db, 'frases'), {
          texto: form.texto.trim(),
          autor: form.autor.trim() || 'Autor desconhecido',
          reflexao: form.reflexao.trim(),
          ativa: true,
          criadoEm: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'frases', modal.item.id), {
          texto: form.texto.trim(),
          autor: form.autor.trim() || 'Autor desconhecido',
          reflexao: form.reflexao.trim(),
        });
      }
      fecharModal();
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleAtiva = (item) => {
    const novoEstado = item.ativa === false ? true : false;
    const label = novoEstado ? 'Ativar' : 'Desativar';
    Alert.alert(`${label} frase`, `Deseja ${label.toLowerCase()} esta frase?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: label, onPress: () => updateDoc(doc(db, 'frases', item.id), { ativa: novoEstado }) },
    ]);
  };

  const handleExcluir = (item) => {
    Alert.alert('Excluir frase', 'Tem certeza? Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: () => deleteDoc(doc(db, 'frases', item.id)),
      },
    ]);
  };

  const handleImportarSeed = () => {
    if (frases.length > 0) {
      Alert.alert(
        'Importar frases padrão',
        `Já existem ${frases.length} frases cadastradas. Deseja adicionar as ${FRASES_SEED.length} frases padrão (serão somadas às existentes)?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Importar', onPress: confirmarImportacao },
        ],
      );
    } else {
      confirmarImportacao();
    }
  };

  const confirmarImportacao = async () => {
    setImportando(true);
    try {
      // Firestore writeBatch suporta até 500 operações por batch
      const BATCH_SIZE = 400;
      for (let i = 0; i < FRASES_SEED.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const slice = FRASES_SEED.slice(i, i + BATCH_SIZE);
        slice.forEach(f => {
          const ref = doc(collection(db, 'frases'));
          batch.set(ref, {
            texto: f.texto,
            autor: f.autor || 'Autor desconhecido',
            reflexao: f.reflexao,
            ativa: true,
            criadoEm: serverTimestamp(),
          });
        });
        await batch.commit();
      }
      Alert.alert('Concluído', `${FRASES_SEED.length} frases importadas com sucesso!`);
    } catch (e) {
      Alert.alert('Erro na importação', e.message || 'Tente novamente.');
    } finally {
      setImportando(false);
    }
  };

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminFrases">
      <AdminSubTabs grupo="biblioteca" atual="AdminFrases" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Frases e Reflexões</Text>
        <Text style={styles.pageSub}>Gerencie as frases do dia e reflexões exibidas às usuárias.</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statN}>{frases.length}</Text>
            <Text style={styles.statL}>Total</Text>
          </View>
          <View style={[styles.statBox, { borderColor: colors.sage }]}>
            <Text style={[styles.statN, { color: colors.sage }]}>{totalAtivas}</Text>
            <Text style={styles.statL}>Ativas</Text>
          </View>
          <View style={[styles.statBox, { borderColor: colors.tl }]}>
            <Text style={[styles.statN, { color: colors.tl }]}>{totalInativas}</Text>
            <Text style={styles.statL}>Inativas</Text>
          </View>
        </View>

        {/* Ações */}
        <View style={styles.actRow}>
          <TouchableOpacity style={styles.addBtn} onPress={abrirAdicionar}>
            <Ionicons name="add" size={18} color="white" />
            <Text style={styles.addBtnTxt}>Nova frase</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.seedBtn, importando && { opacity: 0.6 }]}
            onPress={handleImportarSeed}
            disabled={importando}
          >
            {importando
              ? <ActivityIndicator size="small" color={colors.lav4} />
              : <Ionicons name="cloud-download-outline" size={16} color={colors.lav4} />
            }
            <Text style={styles.seedBtnTxt}>{importando ? 'Importando...' : 'Importar padrão'}</Text>
          </TouchableOpacity>
        </View>

        {/* Busca */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={colors.tl} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por frase, autor ou reflexão..."
            placeholderTextColor={colors.tl}
            value={busca}
            onChangeText={setBusca}
          />
          {busca ? (
            <TouchableOpacity onPress={() => setBusca('')}>
              <Ionicons name="close-circle" size={16} color={colors.tl} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filtro */}
        <View style={[styles.chipRow, { marginBottom: spacing.md }]}>
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'ativas', label: 'Ativas' },
            { id: 'inativas', label: 'Inativas' },
          ].map(f => (
            <TouchableOpacity
              key={f.id}
              style={[styles.chip, filtro === f.id && styles.chipSel]}
              onPress={() => setFiltro(f.id)}
            >
              <Text style={[styles.chipText, filtro === f.id && styles.chipTextSel]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info de seed */}
        {frases.length === 0 && (
          <View style={styles.seedHint}>
            <Ionicons name="information-circle-outline" size={18} color={colors.lav4} />
            <Text style={styles.seedHintTxt}>
              Nenhuma frase cadastrada. Clique em "Importar padrão" para carregar as {FRASES_SEED.length} frases da planilha de uma só vez.
            </Text>
          </View>
        )}

        {/* Lista */}
        {lista.map((item, i) => {
          const inativa = item.ativa === false;
          return (
            <Card key={item.id} style={[styles.item, inativa && styles.itemInativa]}>
              <View style={{ flex: 1 }}>
                <View style={styles.itemHeader}>
                  <Text style={[styles.itemNum, inativa && { color: colors.tl }]}>#{i + 1}</Text>
                  {inativa && (
                    <View style={styles.inativaBadge}>
                      <Text style={styles.inativaBadgeTxt}>inativa</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.itemFrase, inativa && { color: colors.tl }]} numberOfLines={2}>
                  "{item.texto}"
                </Text>
                {item.autor ? (
                  <Text style={styles.itemAutor}>— {item.autor}</Text>
                ) : null}
                {item.reflexao ? (
                  <Text style={styles.itemReflexao} numberOfLines={2}>{item.reflexao}</Text>
                ) : null}
              </View>
              <View style={styles.itemActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => abrirEditar(item)}>
                  <Ionicons name="pencil-outline" size={17} color={colors.lav4} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggleAtiva(item)}>
                  <Ionicons
                    name={inativa ? 'eye-outline' : 'eye-off-outline'}
                    size={17}
                    color={inativa ? colors.sage : colors.tl}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleExcluir(item)}>
                  <Ionicons name="trash-outline" size={17} color={colors.rose} />
                </TouchableOpacity>
              </View>
            </Card>
          );
        })}

        {lista.length === 0 && frases.length > 0 && (
          <Text style={styles.emptyText}>Nenhuma frase encontrada.</Text>
        )}
      </ScrollView>

      {/* Modal adicionar/editar */}
      <Modal visible={modal !== null} animationType="slide" transparent onRequestClose={fecharModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modal?.mode === 'add' ? 'Nova frase' : 'Editar frase'}
              </Text>
              <TouchableOpacity onPress={fecharModal}>
                <Ionicons name="close" size={22} color={colors.td} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Frase <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Texto da frase..."
                placeholderTextColor={colors.tl}
                value={form.texto}
                onChangeText={v => set('texto', v)}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.fieldLabel}>Autor</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome do autor ou 'Autor desconhecido'"
                placeholderTextColor={colors.tl}
                value={form.autor}
                onChangeText={v => set('autor', v)}
              />

              <Text style={styles.fieldLabel}>Reflexão <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Texto da reflexão do dia..."
                placeholderTextColor={colors.tl}
                value={form.reflexao}
                onChangeText={v => set('reflexao', v)}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[styles.saveBtn, salvando && { opacity: 0.6 }]}
                onPress={handleSalvar}
                disabled={salvando}
              >
                {salvando
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.saveBtnTxt}>Salvar</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  statN: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.lav5 },
  statL: { fontFamily: fonts.body, fontSize: 10, color: colors.tm, marginTop: 1 },

  actRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.lav4, borderRadius: radius.full, paddingVertical: 12 },
  addBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: 'white' },
  seedBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.full, paddingVertical: 12, borderWidth: 1.5, borderColor: colors.lav4, backgroundColor: colors.lav1 },
  seedBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav4 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 10, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td },

  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: colors.bg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 5, paddingHorizontal: 12 },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },

  seedHint: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.lav1, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  seedHintTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.lav6, lineHeight: 18 },

  item: { marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 10, ...shadow.soft },
  itemInativa: { opacity: 0.55 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  itemNum: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.lav4 },
  inativaBadge: { backgroundColor: colors.border, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  inativaBadgeTxt: { fontFamily: fonts.body, fontSize: 9, color: colors.tl },
  itemFrase: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, lineHeight: 18 },
  itemAutor: { fontFamily: fonts.body, fontSize: 11, color: colors.lav4, marginTop: 2 },
  itemReflexao: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 4, lineHeight: 16 },
  itemActions: { flexDirection: 'column', gap: 6, paddingTop: 2 },
  actionBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', marginTop: spacing.xl },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.td },
  fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.td, marginBottom: 4, marginTop: spacing.sm },
  required: { color: colors.rose },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.td, marginBottom: 4 },
  inputMulti: { textAlignVertical: 'top', minHeight: 80 },
  saveBtn: { backgroundColor: colors.lav4, borderRadius: radius.full, paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg },
  saveBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: 'white' },
});
