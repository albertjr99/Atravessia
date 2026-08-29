import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, Modal, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius } from '../../theme';

const PLANOS_PADRAO = [
  {
    id: 0, nome: 'Perceber', subtitulo: 'Gratuito', preco: 0, precoLabel: 'Grátis',
    descricao: 'O primeiro passo é perceber como você está.',
    mensagem: '',
    recursos: [
      'Cadastro básico', 'Frase do dia', 'Reflexão do dia',
      'Check-in emocional diário', 'Histórico emocional (últimos 7 dias)',
      'Relatório emocional mensal simples',
    ],
    destaque: false, emBreve: false,
  },
  {
    id: 1, nome: 'Acolher', subtitulo: 'Mensal', preco: 24.9, precoLabel: 'R$ 24,90/mês',
    descricao: 'Aqui, suas emoções encontram acolhimento.',
    mensagem: '',
    recursos: [
      'Tudo do Gratuito', 'Pequenas Vitórias', 'Áudios de acolhimento',
      'Biblioteca de conteúdos', 'Feedback emocional diário',
    ],
    destaque: true, emBreve: false,
  },
  {
    id: 2, nome: 'Compreender', subtitulo: 'Em breve', preco: 0, precoLabel: 'Em breve',
    descricao: 'Compreenda seus padrões emocionais com mais profundidade.',
    mensagem: '',
    recursos: ['Datas sensíveis', 'Jornadas guiadas', 'Relatório semanal'],
    destaque: false, emBreve: true,
  },
  {
    id: 3, nome: 'Evoluir', subtitulo: 'Em breve', preco: 0, precoLabel: 'Em breve',
    descricao: 'Evolua com ferramentas de acompanhamento completo.',
    mensagem: '',
    recursos: ['Rede de apoio', 'Memorial', 'Relatório mensal e anual'],
    destaque: false, emBreve: true,
  },
];

function formDe(plano) {
  return {
    nome: plano?.nome || '',
    subtitulo: plano?.subtitulo || '',
    precoLabel: plano?.precoLabel || '',
    descricao: plano?.descricao || '',
    mensagem: plano?.mensagem || '',
    recursos: (plano?.recursos || []).join('\n'),
    destaque: plano?.destaque === true,
    emBreve: plano?.emBreve === true,
  };
}

export default function AdminPlanosCards() {
  const [planos, setPlanos] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formDe(null));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    // Sem orderBy: documentos sem o campo ordenado seriam descartados.
    return onSnapshot(collection(db, 'planos'), snap => {
      const docs = snap.docs
        .map(d => ({ ...d.data(), id: d.data().id ?? Number(d.id) }))
        .filter(p => Number.isFinite(p.id))
        .sort((a, b) => a.id - b.id);
      setPlanos(docs);
    }, () => {});
  }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const abrir = (p) => { setForm(formDe(p)); setEditando(p); };
  const fechar = () => setEditando(null);

  const salvar = async () => {
    if (!form.nome.trim()) { Alert.alert('Atenção', 'Informe o nome do plano.'); return; }
    setSalvando(true);
    try {
      // setDoc + merge funciona mesmo se o documento ainda não existir.
      await setDoc(doc(db, 'planos', String(editando.id)), {
        id: editando.id,
        nome: form.nome.trim(),
        subtitulo: form.subtitulo.trim(),
        precoLabel: form.precoLabel.trim(),
        descricao: form.descricao.trim(),
        mensagem: form.mensagem.trim(),
        recursos: form.recursos.split('\n').map(r => r.trim()).filter(Boolean),
        destaque: form.destaque,
        emBreve: form.emBreve,
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      Alert.alert('', 'Plano atualizado! A mudança já aparece no app.');
      fechar();
    } catch (e) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const criarPadrao = async () => {
    try {
      for (const p of PLANOS_PADRAO) {
        await setDoc(doc(db, 'planos', String(p.id)), { ...p, criadoEm: serverTimestamp() }, { merge: true });
      }
      Alert.alert('', 'Planos padrão criados. Agora você pode editar cada card.');
    } catch (e) {
      Alert.alert('Erro', e?.message || 'Não foi possível criar os planos.');
    }
  };

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Cards dos planos exibidos no app</Text>
      <Text style={s.cardHint}>
        Edite o nome, a descrição, a mensagem de destaque e a lista de recursos que a
        usuária vê em cada plano. Os valores em reais ficam na seção acima.
      </Text>

      {planos.length === 0 ? (
        <TouchableOpacity style={s.criarBtn} onPress={criarPadrao} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={18} color={colors.lav5} />
          <Text style={s.criarTxt}>Criar os 4 planos padrão para começar</Text>
        </TouchableOpacity>
      ) : (
        planos.map(p => (
          <TouchableOpacity key={p.id} style={s.planoRow} onPress={() => abrir(p)} activeOpacity={0.8}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.planoTitRow}>
                <Text style={s.planoNome}>{p.nome}</Text>
                {p.destaque && <View style={s.tagDestaque}><Text style={s.tagDestaqueTxt}>DESTAQUE</Text></View>}
                {p.emBreve && <View style={s.tagBreve}><Text style={s.tagBreveTxt}>EM BREVE</Text></View>}
              </View>
              <Text style={s.planoDesc} numberOfLines={2}>{p.descricao || 'Sem descrição'}</Text>
              <Text style={s.planoMeta}>
                {(p.recursos || []).length} recurso(s){p.mensagem ? ' · com mensagem' : ''}
              </Text>
            </View>
            <Ionicons name="create-outline" size={18} color={colors.lav4} />
          </TouchableOpacity>
        ))
      )}

      <Modal visible={!!editando} animationType="slide" transparent onRequestClose={fechar}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Editar — {editando?.nome}</Text>
              <TouchableOpacity onPress={fechar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.tm} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Nome do plano *</Text>
              <TextInput style={s.input} value={form.nome} onChangeText={t => set('nome', t)} placeholder="Ex: Acolher" placeholderTextColor={colors.tl} />

              <Text style={s.label}>Subtítulo</Text>
              <TextInput style={s.input} value={form.subtitulo} onChangeText={t => set('subtitulo', t)} placeholder="Ex: Mensal" placeholderTextColor={colors.tl} />

              <Text style={s.label}>Rótulo do preço</Text>
              <TextInput style={s.input} value={form.precoLabel} onChangeText={t => set('precoLabel', t)} placeholder="Ex: R$ 24,90/mês" placeholderTextColor={colors.tl} />

              <Text style={s.label}>Descrição curta</Text>
              <TextInput
                style={[s.input, s.inputMulti]} value={form.descricao}
                onChangeText={t => set('descricao', t)} multiline
                placeholder="Uma frase sobre o plano..." placeholderTextColor={colors.tl}
              />

              <Text style={s.label}>Mensagem de destaque</Text>
              <TextInput
                style={[s.input, s.inputMulti]} value={form.mensagem}
                onChangeText={t => set('mensagem', t)} multiline
                placeholder="Aparece em destaque no card, dentro do app." placeholderTextColor={colors.tl}
              />
              <Text style={s.hint}>Deixe em branco para não exibir a caixa de mensagem.</Text>

              <Text style={s.label}>Recursos incluídos (um por linha)</Text>
              <TextInput
                style={[s.input, s.inputLista]} value={form.recursos}
                onChangeText={t => set('recursos', t)} multiline
                placeholder={'Check-in diário\nÁudios de acolhimento'} placeholderTextColor={colors.tl}
              />
              <Text style={s.hint}>
                {form.recursos.split('\n').filter(r => r.trim()).length} recurso(s) configurado(s)
              </Text>

              <View style={s.switchRow}>
                <Text style={s.switchLbl}>Plano em destaque (recomendado)</Text>
                <Switch value={form.destaque} onValueChange={v => set('destaque', v)} trackColor={{ true: colors.lav4 }} />
              </View>
              <View style={s.switchRow}>
                <Text style={s.switchLbl}>Marcar como "Em breve"</Text>
                <Switch value={form.emBreve} onValueChange={v => set('emBreve', v)} trackColor={{ true: colors.lav4 }} />
              </View>

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.btnGhost} onPress={fechar}>
                  <Text style={s.btnGhostTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnPrim, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando}>
                  <Text style={s.btnPrimTxt}>{salvando ? 'Salvando...' : 'Salvar'}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: spacing.xl }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: 4 },
  cardHint: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginBottom: spacing.md, lineHeight: 16 },

  criarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.lav3, borderStyle: 'dashed',
    backgroundColor: colors.lav1,
  },
  criarTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav5 },

  planoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  planoTitRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  planoNome: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td },
  tagDestaque: { backgroundColor: colors.lav1, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  tagDestaqueTxt: { fontFamily: fonts.bodyBold, fontSize: 8, color: colors.lav5, letterSpacing: 0.5 },
  tagBreve: { backgroundColor: colors.border, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  tagBreveTxt: { fontFamily: fonts.bodyBold, fontSize: 8, color: colors.tm, letterSpacing: 0.5 },
  planoDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2, lineHeight: 15 },
  planoMeta: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 3 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg, maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td, flex: 1 },

  label: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 5, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 11,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  inputMulti: { minHeight: 64, textAlignVertical: 'top' },
  inputLista: { minHeight: 120, textAlignVertical: 'top' },
  hint: { fontFamily: fonts.body, fontSize: 10.5, color: colors.tl, marginTop: 4 },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  switchLbl: { fontFamily: fonts.body, fontSize: 13, color: colors.td, flex: 1 },

  modalBtns: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  btnGhost: {
    flex: 1, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  btnGhostTxt: { fontFamily: fonts.body, fontSize: 14, color: colors.tm },
  btnPrim: {
    flex: 1, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center',
    backgroundColor: colors.lav4,
  },
  btnPrimTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: 'white' },
});
