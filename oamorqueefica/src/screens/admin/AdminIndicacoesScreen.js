import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, TextInput,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, Degrade } from './adminEstilo';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';
import { urlDeImagem } from '../../utils/imagemUrl';
import { normalizarUrl } from '../../utils/abrirLink';
import { CATEGORIAS_INDICACAO } from '../indicacoes/IndicacoesScreen';

// Indicações Atravessia (afiliados Amazon): vitrine de produtos com link de
// afiliada. Cada clique no app soma em `cliques` (via Cloud Function).
const VAZIO = { titulo: '', descricao: '', imagemUrl: '', link: '', categoria: 'livros', ordem: '', ativo: true };

export default function AdminIndicacoesScreen({ navigation }) {
  const [itens, setItens] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(collection(db, 'indicacoes'), (snap) => {
    setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => {}), []);

  const ordenados = useMemo(() => [...itens].sort((a, b) =>
    (Number(a.ordem) || 999) - (Number(b.ordem) || 999) || String(a.titulo || '').localeCompare(String(b.titulo || ''))), [itens]);
  const lista = filtro === 'todas' ? ordenados : ordenados.filter(i => (i.categoria || 'outros') === filtro);
  const totalCliques = itens.reduce((s, i) => s + (i.cliques || 0), 0);
  const ativos = itens.filter(i => i.ativo !== false).length;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const abrirNovo = () => { setForm(VAZIO); setModal({ mode: 'add' }); };
  const abrirEditar = (item) => {
    setForm({
      titulo: item.titulo || '', descricao: item.descricao || '', imagemUrl: item.imagemUrl || '',
      link: item.link || '', categoria: item.categoria || 'outros',
      ordem: item.ordem != null ? String(item.ordem) : '', ativo: item.ativo !== false,
    });
    setModal({ mode: 'edit', item });
  };
  const fechar = () => { setModal(null); setForm(VAZIO); };

  const salvar = async () => {
    if (!form.titulo.trim()) { Alert.alert('Atenção', 'Informe o nome do produto.'); return; }
    const link = normalizarUrl(form.link);
    if (!link) { Alert.alert('Atenção', 'Cole o link de afiliada da Amazon.'); return; }
    setSalvando(true);
    const dados = {
      titulo: form.titulo.trim(), descricao: form.descricao.trim(), imagemUrl: form.imagemUrl.trim(),
      link, categoria: form.categoria, ordem: Number(form.ordem) || null, ativo: form.ativo,
    };
    try {
      if (modal.mode === 'add') await addDoc(collection(db, 'indicacoes'), { ...dados, cliques: 0, criadoEm: serverTimestamp() });
      else await updateDoc(doc(db, 'indicacoes', modal.item.id), dados);
      fechar();
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const alternar = (item) => updateDoc(doc(db, 'indicacoes', item.id), { ativo: item.ativo === false });
  const excluir = (item) => Alert.alert('Excluir indicação', `Excluir "${item.titulo}"? Esta ação não pode ser desfeita.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: () => deleteDoc(doc(db, 'indicacoes', item.id)) },
  ]);

  const previa = urlDeImagem(form.imagemUrl);
  const linkAmazon = !form.link || /amzn\.|amazon\./i.test(form.link);

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminIndicacoes">
      <AdminSubTabs grupo="parcerias" atual="AdminIndicacoes" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={st.scroll}>
        <Text style={st.sobre}>Parcerias</Text>
        <Text style={st.pageTitle}>Indicações Atravessia</Text>
        <Text style={st.pageSub}>Vitrine de produtos com link de afiliada da Amazon. A comissão chega pela conta de Associados.</Text>

        <View style={st.statsRow}>
          <View style={st.statBox}><Text style={st.statN}>{itens.length}</Text><Text style={st.statL}>Produtos</Text></View>
          <View style={st.statBox}><Text style={[st.statN, { color: acento('salvia').texto }]}>{ativos}</Text><Text style={st.statL}>Visíveis</Text></View>
          <View style={st.statBox}><Text style={st.statN}>{totalCliques}</Text><Text style={st.statL}>Cliques</Text></View>
        </View>

        <TouchableOpacity style={st.addBtn} onPress={abrirNovo}>
          <Degrade />
          <Ionicons name="add" size={18} color="white" />
          <Text style={st.addBtnTxt}>Nova indicação</Text>
        </TouchableOpacity>

        <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipRow}>
          {[{ id: 'todas', rotulo: 'Todas' }, ...CATEGORIAS_INDICACAO].map(c => (
            <TouchableOpacity key={c.id} style={[st.chip, filtro === c.id && st.chipSel]} onPress={() => setFiltro(c.id)}>
              <Text style={[st.chipText, filtro === c.id && st.chipTextSel]}>{c.rotulo}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {itens.length === 0 && (
          <View style={st.dica}>
            <Ionicons name="information-circle-outline" size={18} color={acento('lilas').texto} />
            <Text style={st.dicaTxt}>
              Para começar: entre no programa Amazon Associados, gere o link de afiliada do produto (barra SiteStripe) e cadastre aqui com uma foto.
            </Text>
          </View>
        )}

        {lista.length > 0 && <View style={st.lista}>
        {lista.map((item, i) => {
          const inativo = item.ativo === false;
          const img = urlDeImagem(item.imagemUrl);
          return (
            <View key={item.id} style={[st.item, i > 0 && st.itemDiv, inativo && { opacity: 0.55 }]}>
              <View style={st.thumb}>
                {img ? <Image source={{ uri: img }} style={st.thumbImg} resizeMode="contain" /> : <Ionicons name="gift-outline" size={22} color={acento('pessego').tinta} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.itemCat}>{CATEGORIAS_INDICACAO.find(c => c.id === item.categoria)?.rotulo || 'Outros'}{inativo ? ' · oculta' : ''}</Text>
                <Text style={st.itemTit} numberOfLines={2}>{item.titulo}</Text>
                <Text style={st.itemSub}>{item.cliques || 0} clique{(item.cliques || 0) === 1 ? '' : 's'}{item.ordem ? ` · ordem ${item.ordem}` : ''}</Text>
              </View>
              <View style={st.acoes}>
                <TouchableOpacity style={st.acaoBtn} onPress={() => abrirEditar(item)} accessibilityLabel="Editar">
                  <Ionicons name="pencil-outline" size={18} color={colors.lilasIcone} />
                </TouchableOpacity>
                <TouchableOpacity style={st.acaoBtn} onPress={() => alternar(item)} accessibilityLabel={inativo ? 'Mostrar' : 'Ocultar'}>
                  <Ionicons name={inativo ? 'eye-outline' : 'eye-off-outline'} size={18} color={inativo ? colors.sageFg : colors.tl} />
                </TouchableOpacity>
                <TouchableOpacity style={st.acaoBtn} onPress={() => excluir(item)} accessibilityLabel="Excluir">
                  <Ionicons name="trash-outline" size={18} color={colors.roseTexto} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        </View>}
      </ScrollView>

      <Modal visible={modal !== null} animationType="slide" transparent onRequestClose={fechar}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={st.overlay}>
            <View style={st.modalCard}>
              <View style={st.modalHeader}>
                <Text style={st.modalTitle}>{modal?.mode === 'add' ? 'Nova indicação' : 'Editar indicação'}</Text>
                <TouchableOpacity onPress={fechar} accessibilityLabel="Fechar" style={st.fechar}><Ionicons name="close" size={20} color={colors.td} /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={st.label}>Nome do produto *</Text>
                <TextInput style={st.input} value={form.titulo} onChangeText={v => set('titulo', v)} placeholder="Ex.: O ano do pensamento mágico" placeholderTextColor={colors.tl} />

                <Text style={st.label}>Por que indicamos</Text>
                <TextInput style={[st.input, st.multi]} value={form.descricao} onChangeText={v => set('descricao', v)} multiline placeholder="Uma frase curta e acolhedora" placeholderTextColor={colors.tl} />

                <Text style={st.label}>Link de afiliada (Amazon) *</Text>
                <TextInput style={st.input} value={form.link} onChangeText={v => set('link', v)} autoCapitalize="none" keyboardType="url" placeholder="https://amzn.to/..." placeholderTextColor={colors.tl} />
                {!linkAmazon && <Text style={st.alerta}>Este link não parece ser da Amazon. Confira se é o link de afiliada.</Text>}

                <Text style={st.label}>Imagem (link direto ou Google Drive)</Text>
                <TextInput style={st.input} value={form.imagemUrl} onChangeText={v => set('imagemUrl', v)} autoCapitalize="none" placeholder="https://..." placeholderTextColor={colors.tl} />
                {!!previa && <Image source={{ uri: previa }} style={st.previa} resizeMode="contain" />}

                <Text style={st.label}>Categoria</Text>
                <View style={st.chipWrap}>
                  {CATEGORIAS_INDICACAO.map(c => (
                    <TouchableOpacity key={c.id} style={[st.chip, form.categoria === c.id && st.chipSel]} onPress={() => set('categoria', c.id)}>
                      <Text style={[st.chipText, form.categoria === c.id && st.chipTextSel]}>{c.rotulo}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={st.label}>Ordem na vitrine (opcional)</Text>
                <TextInput style={st.input} value={form.ordem} onChangeText={v => set('ordem', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="1 aparece primeiro" placeholderTextColor={colors.tl} />

                <View style={st.switchRow}>
                  <Text style={st.switchTxt}>Visível no app</Text>
                  <Switch value={form.ativo} onValueChange={v => set('ativo', v)} trackColor={{ true: colors.lav4 }} />
                </View>

                <TouchableOpacity style={[st.saveBtn, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando}>
                  <Degrade />
                  {salvando ? <ActivityIndicator size="small" color="white" /> : <Text style={st.saveBtnTxt}>Salvar</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AdminLayout>
  );
}

const st = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  statBox: { ...est.vidro(20), flex: 1, alignItems: 'center', paddingVertical: 14 },
  statN: { fontFamily: 'Figtree_800ExtraBold', fontSize: 24, color: acento('lilas').texto },
  statL: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2, marginTop: 2 },
  addBtn: { ...est.botao(), marginBottom: spacing.md },
  addBtnTxt: est.botaoTxt(),
  chipRow: { gap: 8, marginBottom: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipText: est.chipTxt(),
  chipTextSel: est.chipTxtSel(),
  dica: { ...est.aviso('lilas'), marginBottom: spacing.md },
  dicaTxt: est.avisoTxt('lilas'),
  lista: { ...est.vidro(26), paddingVertical: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  itemDiv: est.divisoria(),
  thumb: { width: 58, height: 58, borderRadius: 16, backgroundColor: colors.escuro ? colors.vidroTenue : '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: 52, height: 52 },
  itemCat: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lilasTexto, letterSpacing: 0.8, textTransform: 'uppercase' },
  itemTit: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo, marginTop: 2 },
  itemSub: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2 },
  acoes: { flexDirection: 'row', gap: 4 },
  acaoBtn: { ...est.botaoIcone(), width: 38, height: 38 },
  overlay: { ...est.veu(), justifyContent: 'flex-end' },
  modalCard: { ...est.folha(), padding: spacing.lg, paddingBottom: 40, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  modalTitle: est.modalTitulo(),
  fechar: est.fechar(),
  label: est.rotulo(),
  input: est.campo(),
  multi: { textAlignVertical: 'top', minHeight: 84 },
  alerta: { ...est.dica(), color: acento('dourado').texto },
  previa: { width: '100%', height: 150, marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  switchTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td },
  saveBtn: { ...est.botao(), marginTop: spacing.lg },
  saveBtnTxt: est.botaoTxt(),
}), { escalar: false });
