import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Modal, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Card } from '../../components';
import AdminLayout from './AdminLayout';

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
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar. Verifique a conexão.');
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>Continue a Travessia</Text>
            <Text style={s.pageSub}>Adicione e edite os itens exibidos nessa seção no app.</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={abrirNovo}>
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

        {itens.map((item, idx) => (
          <Card key={item.id} style={[s.card, item.ativo === false && s.cardInativo]}>
            <View style={s.cardMain}>
              <View style={s.cardIconWrap}>
                <Ionicons name={item.icone || 'link-outline'} size={20} color={item.ativo === false ? colors.tl : colors.lav5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardTitulo, item.ativo === false && { color: colors.tl }]}>{item.titulo}</Text>
                {item.descricao ? <Text style={s.cardDesc}>{item.descricao}</Text> : null}
                <Text style={s.cardUrl} numberOfLines={1}>{item.url}</Text>
                <View style={s.cardBadgeRow}>
                  <Text style={s.tipoBadge}>{TIPOS.find(t => t.id === item.tipo)?.label || item.tipo}</Text>
                  {item.ativo === false && <Text style={s.inativoBadge}>Inativo</Text>}
                </View>
              </View>
            </View>
            <View style={s.cardActions}>
              <TouchableOpacity onPress={() => moverOrdem(item, -1)} style={s.actionBtn} disabled={idx === 0}>
                <Ionicons name="arrow-up" size={13} color={idx === 0 ? colors.border : colors.tm} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moverOrdem(item, 1)} style={s.actionBtn} disabled={idx === itens.length - 1}>
                <Ionicons name="arrow-down" size={13} color={idx === itens.length - 1 ? colors.border : colors.tm} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggleAtivo(item)} style={s.actionBtn}>
                <Ionicons name={item.ativo === false ? 'eye-off-outline' : 'eye-outline'} size={13} color={colors.tm} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => abrirEditar(item)} style={s.actionBtn}>
                <Ionicons name="create-outline" size={13} color={colors.lav5} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => excluir(item)} style={s.actionBtn}>
                <Ionicons name="trash-outline" size={13} color={colors.peach2} />
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </ScrollView>

      <Modal
        visible={modalVis}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVis(false)}
      >
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editId ? 'Editar item' : 'Novo item'}</Text>
            <TouchableOpacity onPress={() => setModalVis(false)} style={s.modalClose}>
              <Ionicons name="close" size={22} color={colors.td} />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <Text style={s.label}>Título *</Text>
            <TextInput
              style={s.input} value={form.titulo} onChangeText={v => set('titulo', v)}
              placeholder="Ex: Terapia Integrativa" placeholderTextColor={colors.tl}
            />

            <Text style={s.label}>Descrição / subtítulo</Text>
            <TextInput
              style={s.input} value={form.descricao} onChangeText={v => set('descricao', v)}
              placeholder="Ex: Agende pelo WhatsApp" placeholderTextColor={colors.tl}
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
                  <Ionicons name={t.icon} size={13} color={form.tipo === t.id ? colors.lav5 : colors.tm} />
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
                  <Ionicons name={ic} size={18} color={form.icone === ic ? colors.lav5 : colors.tm} />
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
              <Text style={s.saveBtnText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: spacing.lg },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.lav5, borderRadius: radius.full,
    paddingVertical: 9, paddingHorizontal: 14,
  },
  addBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, textAlign: 'center', maxWidth: 280 },
  card: { marginBottom: 10, gap: 10, ...shadow.soft },
  cardInativo: { opacity: 0.55 },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitulo: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td },
  cardDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
  cardUrl: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 3 },
  cardBadgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  tipoBadge: { fontFamily: fonts.body, fontSize: 10, color: colors.lav5, backgroundColor: colors.lav1, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  inativoBadge: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, backgroundColor: colors.bg, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: colors.border },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  actionBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, borderRadius: radius.md },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.td },
  modalClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: spacing.lg },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: 6, marginTop: 14 },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: -4, marginBottom: 4 },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 11, fontFamily: fonts.body, fontSize: 14, color: colors.td,
  },
  tiposRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 7, paddingHorizontal: 12 },
  tipoChipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  tipoChipText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  tipoChipTextSel: { fontFamily: fonts.bodyBold, color: colors.lav5 },
  iconesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconeBtn: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  iconeBtnSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  saveBtn: { backgroundColor: colors.lav5, borderRadius: radius.full, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#fff' },
});
