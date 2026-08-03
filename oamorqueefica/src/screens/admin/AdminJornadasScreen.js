import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius } from '../../theme';
import { Card, Button } from '../../components';
import { confirmar } from '../../utils/confirm';
import AdminLayout from './AdminLayout';

const PLANOS = [
  { id: 0, label: 'Grátis (Perceber)' },
  { id: 1, label: 'Acolher' },
  { id: 2, label: 'Compreender' },
  { id: 3, label: 'Evoluir' },
];

const PLANO_CORES = { 0: colors.sage, 1: colors.lav4, 2: '#7B5EA7', 3: '#C0843F' };

const ICONES = [
  'heart-outline', 'leaf-outline', 'sunny-outline', 'moon-outline',
  'compass-outline', 'book-outline', 'flame-outline', 'walk-outline',
  'shield-outline', 'sparkles-outline', 'flower-outline', 'infinite-outline',
];

const novo = () => ({
  titulo: '', descricao: '', icone: 'compass-outline', plano: 1, ordem: 0, ativa: true,
});

export default function AdminJornadasScreen({ navigation }) {
  const [jornadas, setJornadas] = useState([]);
  const [form, setForm] = useState(null); // null = hidden, object = editing
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const ref = query(collection(db, 'jornadas'), orderBy('ordem', 'asc'));
    const unsub = onSnapshot(ref, snap => setJornadas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const abrirNova = () => setForm({ ...novo(), ordem: jornadas.length });
  const cancelar = () => setForm(null);

  const salvar = async () => {
    if (!form.titulo.trim()) { Alert.alert('', 'Informe um título para a jornada.'); return; }
    setSalvando(true);
    try {
      const dados = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        icone: form.icone,
        plano: form.plano,
        ordem: Number(form.ordem) || 0,
        ativa: form.ativa,
      };
      if (form.id) {
        await updateDoc(doc(db, 'jornadas', form.id), { ...dados, atualizadoEm: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'jornadas'), { ...dados, criadoEm: serverTimestamp() });
      }
      setForm(null);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a jornada.');
    }
    setSalvando(false);
  };

  const remover = (id) => confirmar('Remover jornada', 'Tem certeza?', () => deleteDoc(doc(db, 'jornadas', id)), 'Remover');

  const toggleAtiva = (j) => updateDoc(doc(db, 'jornadas', j.id), { ativa: !j.ativa }).catch(() => {});

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminJornadas">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.pageTitle}>Jornadas</Text>
        <Text style={s.pageSub}>Crie programas e trilhas de conteúdo, definindo plano de acesso e ordem de exibição.</Text>

        {/* ── Formulário ── */}
        {form && (
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={s.cardTitle}>{form.id ? 'Editar jornada' : 'Nova jornada'}</Text>

            <Text style={s.label}>Título <Text style={s.req}>*</Text></Text>
            <TextInput style={s.input} placeholder="Ex: Cuidando de mim" placeholderTextColor={colors.tl} value={form.titulo} onChangeText={v => setForm(f => ({ ...f, titulo: v }))} />

            <Text style={s.label}>Descrição</Text>
            <TextInput style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Descreva o objetivo desta jornada..." placeholderTextColor={colors.tl} multiline value={form.descricao} onChangeText={v => setForm(f => ({ ...f, descricao: v }))} />

            <Text style={s.label}>Ícone</Text>
            <View style={s.iconeGrid}>
              {ICONES.map(ic => (
                <TouchableOpacity key={ic} style={[s.iconeBtn, form.icone === ic && s.iconeBtnSel]} onPress={() => setForm(f => ({ ...f, icone: ic }))}>
                  <Ionicons name={ic} size={20} color={form.icone === ic ? colors.lav5 : colors.tm} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Plano mínimo de acesso</Text>
            <View style={s.chipRow}>
              {PLANOS.map(p => (
                <TouchableOpacity key={p.id} style={[s.chip, form.plano === p.id && { backgroundColor: PLANO_CORES[p.id] + '22', borderColor: PLANO_CORES[p.id] }]} onPress={() => setForm(f => ({ ...f, plano: p.id }))}>
                  <Text style={[s.chipTxt, form.plano === p.id && { color: PLANO_CORES[p.id], fontFamily: fonts.bodyBold }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Ordem (número)</Text>
            <TextInput style={s.input} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.tl} value={String(form.ordem)} onChangeText={v => setForm(f => ({ ...f, ordem: v }))} />

            <View style={s.switchRow}>
              <Text style={s.label}>Ativa (visível para usuários)</Text>
              <Switch value={form.ativa} onValueChange={v => setForm(f => ({ ...f, ativa: v }))} trackColor={{ true: colors.lav4 }} />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
              <Button title="Cancelar" onPress={cancelar} style={{ flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }} textStyle={{ color: colors.tm }} />
              <Button title={salvando ? 'Salvando...' : 'Salvar'} onPress={salvar} disabled={salvando} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {!form && (
          <Button title="+ Nova jornada" onPress={abrirNova} style={{ marginBottom: spacing.lg }} />
        )}

        {/* ── Lista ── */}
        <Text style={s.sectionTitle}>Jornadas ({jornadas.length})</Text>
        {jornadas.length === 0 && <Text style={s.empty}>Nenhuma jornada criada ainda.</Text>}

        {jornadas.map(j => {
          const planoObj = PLANOS.find(p => p.id === j.plano);
          const cor = PLANO_CORES[j.plano] ?? colors.lav4;
          return (
            <Card key={j.id} style={s.item}>
              <View style={[s.iconeCircle, { backgroundColor: cor + '22' }]}>
                <Ionicons name={j.icone || 'compass-outline'} size={18} color={cor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTit}>{j.titulo}</Text>
                {j.descricao ? <Text style={s.itemDesc} numberOfLines={1}>{j.descricao}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                  {planoObj && <Text style={[s.tag, { backgroundColor: cor + '22', color: cor }]}>{planoObj.label}</Text>}
                  <Text style={[s.tag, j.ativa ? s.tagAtiva : s.tagInativa]}>{j.ativa ? 'Ativa' : 'Inativa'}</Text>
                  <Text style={s.tag}>Ordem: {j.ordem ?? 0}</Text>
                </View>
              </View>
              <View style={s.actions}>
                <Switch value={!!j.ativa} onValueChange={() => toggleAtiva(j)} trackColor={{ true: colors.lav4 }} style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
                <TouchableOpacity onPress={() => setForm({ ...j })} style={s.actionBtn}>
                  <Ionicons name="create-outline" size={17} color={colors.lav5} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remover(j.id)} style={s.actionBtn}>
                  <Ionicons name="trash-outline" size={17} color={colors.peach2} />
                </TouchableOpacity>
              </View>
            </Card>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: spacing.sm },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: spacing.sm, marginBottom: 6 },
  req: { color: colors.rose },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  iconeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  iconeBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  iconeBtnSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  chip: { borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, paddingVertical: 5, paddingHorizontal: 10 },
  chipTxt: { fontFamily: fonts.body, fontSize: 11, color: colors.tm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: 8 },
  empty: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, marginBottom: spacing.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  iconeCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemTit: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  itemDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: 2 },
  tag: { fontFamily: fonts.body, fontSize: 10, color: colors.tm, backgroundColor: colors.lav1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  tagAtiva: { backgroundColor: colors.sage + '33', color: colors.sageFg },
  tagInativa: { backgroundColor: colors.peach + '33', color: colors.peach2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtn: { padding: 6 },
});
