import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, Degrade } from './adminEstilo';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';

const TIPOS = [
  { id: 'link', label: 'Link externo', icon: 'link-outline' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
  { id: 'video', label: 'Vídeo (YouTube)', icon: 'videocam-outline' },
  { id: 'audio', label: 'Áudio / Podcast', icon: 'musical-notes-outline' },
];

const ICONES = [
  'link-outline', 'logo-whatsapp', 'videocam-outline', 'musical-notes-outline',
  'book-outline', 'heart-outline', 'star-outline', 'people-outline',
  'compass-outline', 'sparkles-outline', 'flower-outline', 'leaf-outline',
];

const FORM_INIT = { titulo: '', descricao: '', tipo: 'link', url: '', icone: 'link-outline', ativo: true };

export default function AdminTravessiaScreen({ navigation }) {
  const [itens, setItens] = useState([]);
  const [modalVis, setModalVis] = useState(false);
  const [form, setForm] = useState(FORM_INIT);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ref = query(collection(db, 'travessiaItens'), orderBy('ordem', 'asc'));
    const unsub = onSnapshot(ref, (snap) => {
      setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const abrirNovo = () => {
    setForm(FORM_INIT);
    setEditId(null);
    setModalVis(true);
  };

  const abrirEditar = (item) => {
    setForm({
      titulo: item.titulo || '',
      descricao: item.descricao || '',
      tipo: item.tipo || 'link',
      url: item.url || '',
      icone: item.icone || 'link-outline',
      ativo: item.ativo !== false,
    });
    setEditId(item.id);
    setModalVis(true);
  };

  const salvar = async () => {
    if (!form.titulo.trim()) { Alert.alert('', 'Informe o título.'); return; }
    if (!form.url.trim()) { Alert.alert('', 'Informe a URL ou link.'); return; }
    setSaving(true);
    try {
      if (editId) {
        await updateDoc(doc(db, 'travessiaItens', editId), { ...form });
      } else {
        await addDoc(collection(db, 'travessiaItens'), {
          ...form,
          ordem: itens.length,
          criadoEm: serverTimestamp(),
        });
      }
      setModalVis(false);
    } catch (e) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar. Verifique a conexão.');
    }
    setSaving(false);
  };

  const excluir = (item) => {
    Alert.alert('Excluir item', `Excluir "${item.titulo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteDoc(doc(db, 'travessiaItens', item.id)) },
    ]);
  };

  const toggleAtivo = (item) => {
    updateDoc(doc(db, 'travessiaItens', item.id), { ativo: item.ativo === false });
  };

  const moverOrdem = (item, dir) => {
    const idx = itens.findIndex(i => i.id === item.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= itens.length) return;
    const swap = itens[swapIdx];
    updateDoc(doc(db, 'travessiaItens', item.id), { ordem: swapIdx });
    updateDoc(doc(db, 'travessiaItens', swap.id), { ordem: idx });
  };

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminTravessia">
      <AdminSubTabs grupo="jornada" atual="AdminTravessia" />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.sobre}>Jornada</Text>
            <Text style={s.pageTitle}>Continue a Travessia</Text>
            <Text style={s.pageSub}>Adicione e edite os itens exibidos nessa seção no app.</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={abrirNovo}>
            <Degrade />
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.addBtnText}>Novo item</Text>
          </TouchableOpacity>
        </View>

        {itens.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="compass-outline" size={44} color={colors.lav2} />
            <Text style={s.emptyTitle}>Nenhum item ainda</Text>
            <Text style={s.emptySub}>
              Adicione terapia, livros, vídeos, WhatsApp ou qualquer conteúdo que quiser exibir aqui.
            </Text>
          </View>
        )}

        {itens.length > 0 && <View style={s.lista}>
        {itens.map((item, idx) => (
          <View key={item.id} style={[s.card, idx > 0 && s.cardDiv, item.ativo === false && s.cardInativo]}>
            <View style={s.cardMain}>
              <View style={s.cardIconWrap}>
                <Ionicons name={item.icone || 'link-outline'} size={20} color={item.ativo === false ? colors.tl : acento('lilas').tinta} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardTitulo, item.ativo === false && { color: colors.tl }]}>{item.titulo}</Text>
                {item.descricao ? <Text style={s.cardDesc}>{item.descricao}</Text> : null}
                <Text style={s.cardUrl} numberOfLines={1}>{item.url}</Text>
                <View style={s.cardBadgeRow}>
                  {!!(TIPOS.find(t => t.id === item.tipo)?.label || item.tipo) && <Text style={s.tipoBadge}>{TIPOS.find(t => t.id === item.tipo)?.label || item.tipo}</Text>}
                  {item.ativo === false && <Text style={s.inativoBadge}>Inativo</Text>}
                </View>
              </View>
            </View>
            <View style={s.cardActions}>
              <TouchableOpacity onPress={() => moverOrdem(item, -1)} style={s.actionBtn} disabled={idx === 0}>
                <Ionicons name="arrow-up" size={17} color={idx === 0 ? colors.border : colors.texto2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moverOrdem(item, 1)} style={s.actionBtn} disabled={idx === itens.length - 1}>
                <Ionicons name="arrow-down" size={17} color={idx === itens.length - 1 ? colors.border : colors.texto2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggleAtivo(item)} style={s.actionBtn}>
                <Ionicons name={item.ativo === false ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.texto2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => abrirEditar(item)} style={s.actionBtn}>
                <Ionicons name="create-outline" size={17} color={colors.lilasIcone} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => excluir(item)} style={s.actionBtn}>
                <Ionicons name="trash-outline" size={17} color={colors.roseTexto} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        </View>}
      </ScrollView>

      <Modal
        visible={modalVis}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVis(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editId ? 'Editar item' : 'Novo item'}</Text>
            <TouchableOpacity onPress={() => setModalVis(false)} style={s.modalClose}>
              <Ionicons name="close" size={20} color={colors.td} />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <Text style={s.label}>Título *</Text>
            <TextInput
              style={s.input} value={form.titulo} onChangeText={v => set('titulo', v)}
              placeholder="Ex: Terapia Integrativa" placeholderTextColor={colors.tl}
            />

            <Text style={s.label}>Descrição / subtítulo</Text>
            {/* Várias linhas: textos longos ficam visíveis por inteiro para revisar e editar. */}
            <TextInput
              style={[s.input, s.inputMulti]} value={form.descricao} onChangeText={v => set('descricao', v)}
              placeholder="Ex: Agende pelo WhatsApp" placeholderTextColor={colors.tl}
              multiline textAlignVertical="top"
            />

            <Text style={s.label}>URL / Link *</Text>
            <TextInput
              style={s.input} value={form.url} onChangeText={v => set('url', v)}
              placeholder="https://... ou https://wa.me/55..." placeholderTextColor={colors.tl}
              autoCapitalize="none" keyboardType="url"
            />
            <Text style={s.hint}>WhatsApp: https://wa.me/5511999999999?text=Olá</Text>

            <Text style={s.label}>Tipo</Text>
            <View style={s.tiposRow}>
              {TIPOS.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.tipoChip, form.tipo === t.id && s.tipoChipSel]}
                  onPress={() => { set('tipo', t.id); set('icone', t.icon); }}
                >
                  <Ionicons name={t.icon} size={15} color={form.tipo === t.id ? colors.lilasTexto : colors.texto2} />
                  <Text style={[s.tipoChipText, form.tipo === t.id && s.tipoChipTextSel]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Ícone</Text>
            <View style={s.iconesRow}>
              {ICONES.map(ic => (
                <TouchableOpacity
                  key={ic}
                  style={[s.iconeBtn, form.icone === ic && s.iconeBtnSel]}
                  onPress={() => set('icone', ic)}
                >
                  <Ionicons name={ic} size={19} color={form.icone === ic ? colors.lilasTexto : colors.texto2} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.switchRow}>
              <Text style={s.label}>Visível no app</Text>
              <Switch
                value={form.ativo}
                onValueChange={v => set('ativo', v)}
                trackColor={{ true: colors.lav3, false: colors.border }}
                thumbColor={form.ativo ? colors.lav5 : colors.tl}
              />
            </View>

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={salvar} disabled={saving}>
              <Degrade />
              <Text style={s.saveBtnText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: spacing.lg },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: est.subtitulo(),
  addBtn: { ...est.botao(), minHeight: 46, paddingHorizontal: 18 },
  addBtnText: est.botaoTxt(),
  empty: { ...est.vidro(26), alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20, gap: 10 },
  emptyTitle: est.cartaoTitulo(),
  emptySub: { ...est.legenda(), textAlign: 'center', maxWidth: 320 },
  lista: { ...est.vidro(26), paddingVertical: 2 },
  card: { gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  cardDiv: est.divisoria(),
  cardInativo: { opacity: 0.55 },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIconWrap: { ...est.pilula(42), backgroundColor: acento('lilas').fundo, flexShrink: 0 },
  cardTitulo: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo },
  cardDesc: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.texto2, marginTop: 2 },
  cardUrl: { fontFamily: fonts.body, fontSize: 12.5, color: colors.lilasTexto, marginTop: 3 },
  cardBadgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tipoBadge: {
    ...est.etiquetaTxt(), color: acento('lilas').texto, backgroundColor: acento('lilas').fundo,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden',
  },
  inativoBadge: {
    ...est.etiquetaTxt(), color: acento('neutro').texto, backgroundColor: acento('neutro').fundo,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden',
  },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, paddingLeft: 54 },
  actionBtn: est.botaoIcone(),
  modal: { flex: 1, backgroundColor: colors.cardSolido },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.bordaSuave },
  modalTitle: est.modalTitulo(),
  modalClose: est.fechar(),
  modalBody: { padding: spacing.lg },
  label: est.rotulo(),
  hint: { ...est.dica(), marginTop: 6, marginBottom: 4 },
  inputMulti: { minHeight: 120, maxHeight: 260, textAlignVertical: 'top', lineHeight: 21 },
  input: est.campo(),
  tiposRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoChip: est.chip(),
  tipoChipSel: est.chipSel(),
  tipoChipText: est.chipTxt(),
  tipoChipTextSel: est.chipTxtSel(),
  iconesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconeBtn: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardSolido, alignItems: 'center', justifyContent: 'center' },
  iconeBtnSel: { backgroundColor: colors.lav1, borderColor: colors.lav3 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  saveBtn: { ...est.botao(), marginTop: 24 },
  saveBtnText: est.botaoTxt(),
}), { escalar: false });
