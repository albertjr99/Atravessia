import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, corPlano, BotaoAdmin } from './adminEstilo';
import { confirmar } from '../../utils/confirm';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';

const PLANOS = [
  { id: 0, label: 'Grátis (Perceber)' },
  { id: 1, label: 'Acolher' },
  { id: 2, label: 'Compreender' },
  { id: 3, label: 'Evoluir' },
];


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
      <AdminSubTabs grupo="jornada" atual="AdminJornadas" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.sobre}>Jornada</Text>
        <Text style={s.pageTitle}>Jornadas</Text>
        <Text style={s.pageSub}>Crie programas e trilhas de conteúdo, definindo plano de acesso e ordem de exibição.</Text>

        {/* ── Formulário ── */}
        {form && (
          <View style={s.form}>
            <Text style={s.cardTitle}>{form.id ? 'Editar jornada' : 'Nova jornada'}</Text>

            <Text style={s.label}>Título <Text style={s.req}>*</Text></Text>
            <TextInput style={s.input} placeholder="Ex: Cuidando de mim" placeholderTextColor={colors.tl} value={form.titulo} onChangeText={v => setForm(f => ({ ...f, titulo: v }))} />

            <Text style={s.label}>Descrição</Text>
            <TextInput style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Descreva o objetivo desta jornada..." placeholderTextColor={colors.tl} multiline value={form.descricao} onChangeText={v => setForm(f => ({ ...f, descricao: v }))} />

            <Text style={s.label}>Ícone</Text>
            <View style={s.iconeGrid}>
              {ICONES.map(ic => (
                <TouchableOpacity key={ic} style={[s.iconeBtn, form.icone === ic && s.iconeBtnSel]} onPress={() => setForm(f => ({ ...f, icone: ic }))}>
                  <Ionicons name={ic} size={20} color={form.icone === ic ? colors.lilasTexto : colors.texto2} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Plano mínimo de acesso</Text>
            <View style={s.chipRow}>
              {PLANOS.map(p => (
                <TouchableOpacity key={p.id} style={[s.chip, form.plano === p.id && { backgroundColor: corPlano(p.id).fundo, borderColor: corPlano(p.id).tinta }]} onPress={() => setForm(f => ({ ...f, plano: p.id }))}>
                  <Text style={[s.chipTxt, form.plano === p.id && { color: corPlano(p.id).texto, fontFamily: fonts.bodyBold }]}>{p.label}</Text>
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
              <BotaoAdmin title="Cancelar" variant="secondary" onPress={cancelar} style={{ flex: 1 }} />
              <BotaoAdmin title={salvando ? 'Salvando...' : 'Salvar'} onPress={salvar} disabled={salvando} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {!form && (
          <BotaoAdmin title="+ Nova jornada" onPress={abrirNova} style={{ marginBottom: spacing.lg, alignSelf: 'flex-start' }} />
        )}

        {/* ── Lista ── */}
        <Text style={s.sectionTitle}>Jornadas ({jornadas.length})</Text>
        {jornadas.length === 0 && <Text style={s.empty}>Nenhuma jornada criada ainda.</Text>}

        {jornadas.length > 0 && <View style={s.lista}>
        {jornadas.map((j, i) => {
          const planoObj = PLANOS.find(p => p.id === j.plano);
          const cor = corPlano(j.plano);
          return (
            <View key={j.id} style={[s.item, i > 0 && s.itemDiv]}>
              <View style={[s.iconeCircle, { backgroundColor: cor.fundo }]}>
                <Ionicons name={j.icone || 'compass-outline'} size={20} color={cor.tinta} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTit}>{j.titulo}</Text>
                {j.descricao ? <Text style={s.itemDesc} numberOfLines={1}>{j.descricao}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                  {planoObj && <Text style={[s.tag, { backgroundColor: cor.fundo, color: cor.texto }]}>{planoObj.label}</Text>}
                  <Text style={[s.tag, j.ativa ? s.tagAtiva : s.tagInativa]}>{j.ativa ? 'Ativa' : 'Inativa'}</Text>
                  <Text style={s.tag}>Ordem: {j.ordem ?? 0}</Text>
                </View>
              </View>
              <View style={s.actions}>
                <Switch value={!!j.ativa} onValueChange={() => toggleAtiva(j)} trackColor={{ true: colors.lav4 }} style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
                <TouchableOpacity onPress={() => setForm({ ...j })} style={s.actionBtn}>
                  <Ionicons name="create-outline" size={18} color={colors.lilasIcone} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remover(j.id)} style={s.actionBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.roseTexto} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        </View>}
        <View style={{ height: 40 }} />
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },
  form: { ...est.vidro(26), padding: 18, marginBottom: spacing.lg },
  cardTitle: { ...est.cartaoTitulo(), fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, marginBottom: 4 },
  label: est.rotulo(),
  req: est.obrigatorio(),
  input: est.campo(),
  iconeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  iconeBtn: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardSolido, alignItems: 'center', justifyContent: 'center' },
  iconeBtnSel: { backgroundColor: colors.lav1, borderColor: colors.lav3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  chip: est.chip(),
  chipTxt: est.chipTxt(),
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { ...est.secao(), marginBottom: 10 },
  empty: { ...est.legenda(), marginBottom: spacing.md },
  lista: { ...est.vidro(26), paddingVertical: 2 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  itemDiv: est.divisoria(),
  iconeCircle: { ...est.pilula(42), flexShrink: 0 },
  itemTit: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo },
  itemDesc: { fontFamily: fonts.body, fontSize: 13.5, color: colors.texto2, marginTop: 2 },
  tag: {
    ...est.etiquetaTxt(), color: colors.texto2, backgroundColor: colors.escuro ? colors.vidroTenue : colors.lavVeu,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
  tagAtiva: { backgroundColor: colors.sageFundo, color: colors.sageFg },
  tagInativa: { backgroundColor: colors.roseFundo, color: colors.roseTexto },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtn: { padding: 6 },
}), { escalar: false });
