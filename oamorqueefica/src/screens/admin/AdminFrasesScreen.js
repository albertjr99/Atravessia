import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, TextInput,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  orderBy, query, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, Degrade, AcoesItem } from './adminEstilo';
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
        <Text style={styles.sobre}>Biblioteca</Text>
        <Text style={styles.pageTitle}>Frases e Reflexões</Text>
        <Text style={styles.pageSub}>Gerencie as frases do dia e reflexões exibidas às usuárias.</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statN}>{frases.length}</Text>
            <Text style={styles.statL}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statN, { color: acento('salvia').texto }]}>{totalAtivas}</Text>
            <Text style={styles.statL}>Ativas</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statN, { color: colors.texto2 }]}>{totalInativas}</Text>
            <Text style={styles.statL}>Inativas</Text>
          </View>
        </View>

        {/* Ações */}
        <View style={styles.actRow}>
          <TouchableOpacity style={styles.addBtn} onPress={abrirAdicionar}>
            <Degrade />
            <Ionicons name="add" size={18} color="white" />
            <Text style={styles.addBtnTxt}>Nova frase</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.seedBtn, importando && { opacity: 0.6 }]}
            onPress={handleImportarSeed}
            disabled={importando}
          >
            {importando
              ? <ActivityIndicator size="small" color={colors.lilasTexto} />
              : <Ionicons name="cloud-download-outline" size={17} color={colors.lilasTexto} />
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
            <Ionicons name="information-circle-outline" size={18} color={acento('lilas').texto} />
            <Text style={styles.seedHintTxt}>
              Nenhuma frase cadastrada. Clique em "Importar padrão" para carregar as {FRASES_SEED.length} frases da planilha de uma só vez.
            </Text>
          </View>
        )}

        {/* Lista */}
        {lista.length > 0 && <View style={styles.lista}>
        {lista.map((item, i) => {
          const inativa = item.ativa === false;
          return (
            <View key={item.id} style={[styles.item, i > 0 && styles.itemDiv, inativa && styles.itemInativa]}>
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
                <AcoesItem onEditar={() => abrirEditar(item)} onApagar={() => handleExcluir(item)} rotuloApagar="Apagar frase" />
              </View>
              <View style={styles.itemActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggleAtiva(item)}
                  accessibilityLabel={inativa ? 'Ativar frase' : 'Desativar frase'}>
                  <Ionicons
                    name={inativa ? 'eye-outline' : 'eye-off-outline'}
                    size={17}
                    color={inativa ? acento('salvia').tinta : colors.tl}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        </View>}

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
              <TouchableOpacity onPress={fecharModal} style={styles.fechar}>
                <Ionicons name="close" size={20} color={colors.td} />
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
                <Degrade />
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

const styles = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  statBox: { ...est.vidro(20), flex: 1, alignItems: 'center', paddingVertical: 14 },
  statN: { fontFamily: 'Figtree_800ExtraBold', fontSize: 24, color: acento('lilas').texto },
  statL: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2, marginTop: 2 },

  actRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  addBtn: { ...est.botao(), flex: 1 },
  addBtnTxt: est.botaoTxt(),
  seedBtn: { ...est.botaoSec(), flex: 1, minHeight: 50 },
  seedBtnTxt: est.botaoSecTxt(),

  searchRow: { ...est.campo(), flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.td, paddingVertical: 12 },

  chipRow: { flexDirection: 'row', gap: 8 },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipText: est.chipTxt(),
  chipTextSel: est.chipTxtSel(),

  seedHint: { ...est.aviso('lilas'), marginBottom: spacing.md },
  seedHintTxt: est.avisoTxt('lilas'),

  lista: { ...est.vidro(26), paddingVertical: 2 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  itemDiv: est.divisoria(),
  itemInativa: { opacity: 0.55 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  itemNum: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lilasTexto, letterSpacing: 0.5 },
  inativaBadge: { backgroundColor: acento('neutro').fundo, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  inativaBadgeTxt: { fontFamily: fonts.bodySemi, fontSize: 12, color: acento('neutro').texto },
  itemFrase: { fontFamily: fonts.serif, fontSize: 19, color: colors.titulo, lineHeight: 24 },
  itemAutor: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.lilasTexto, marginTop: 4 },
  itemReflexao: { fontFamily: fonts.body, fontSize: 13.5, color: colors.texto2, marginTop: 6, lineHeight: 19 },
  itemActions: { flexDirection: 'column', gap: 6, paddingTop: 2 },
  actionBtn: { ...est.botaoIcone(), width: 38, height: 38 },

  emptyText: { ...est.legenda(), textAlign: 'center', marginTop: spacing.xl },

  // Modal
  modalOverlay: { ...est.veu(), justifyContent: 'flex-end' },
  modalCard: { ...est.folha(), padding: spacing.lg, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  modalTitle: est.modalTitulo(),
  fechar: est.fechar(),
  fieldLabel: est.rotulo(),
  required: est.obrigatorio(),
  input: est.campo(),
  inputMulti: { textAlignVertical: 'top', minHeight: 90 },
  saveBtn: { ...est.botao(), marginTop: spacing.lg },
  saveBtnTxt: est.botaoTxt(),
}), { escalar: false });
