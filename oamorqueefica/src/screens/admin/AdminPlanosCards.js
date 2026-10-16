import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Alert, Modal, ScrollView, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, Degrade } from './adminEstilo';

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
    preco: plano?.preco != null ? String(plano.preco).replace('.', ',') : '',
    precoLabel: plano?.precoLabel || '',
    precoAnual: plano?.precoAnual ? String(plano.precoAnual).replace('.', ',') : '',
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
    const precoTexto = form.preco.trim();
    const preco = precoTexto ? parseFloat(precoTexto.replace(',', '.')) : 0;
    if (precoTexto && Number.isNaN(preco)) { Alert.alert('Atenção', 'Informe um preço válido, ex: 24,90.'); return; }
    // Plano anual: vazio = 10 mensalidades (dois meses de presente).
    const anualTexto = (form.precoAnual || '').trim();
    const precoAnual = anualTexto ? parseFloat(anualTexto.replace(',', '.')) : 0;
    if (anualTexto && Number.isNaN(precoAnual)) { Alert.alert('Atenção', 'Informe um preço anual válido, ex: 249,00.'); return; }
    setSalvando(true);
    try {
      // setDoc + merge funciona mesmo se o documento ainda não existir.
      await setDoc(doc(db, 'planos', String(editando.id)), {
        id: editando.id,
        nome: form.nome.trim(),
        subtitulo: form.subtitulo.trim(),
        preco,
        precoLabel: form.precoLabel.trim(),
        precoAnual,
        descricao: form.descricao.trim(),
        mensagem: form.mensagem.trim(),
        recursos: form.recursos.split('\n').map(r => r.trim()).filter(Boolean),
        destaque: form.destaque,
        emBreve: form.emBreve,
        atualizadoEm: serverTimestamp(),
      }, { merge: true });

      // Espelha para configuracoes/precos (centavos) — é lá que a Cloud
      // Function do checkout confere o valor caso planos/{id} não tenha um
      // preço válido, então mantemos os dois sincronizados nos dois sentidos.
      if ([1, 2, 3].includes(editando.id) && preco > 0) {
        await setDoc(doc(db, 'configuracoes', 'precos'), {
          [`plano${editando.id}`]: Math.round(preco * 100),
        }, { merge: true });
      }

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
          <Ionicons name="add-circle-outline" size={18} color={colors.lilasTexto} />
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
            <Ionicons name="create-outline" size={19} color={colors.lilasIcone} />
          </TouchableOpacity>
        ))
      )}

      <Modal visible={!!editando} animationType="slide" transparent onRequestClose={fechar}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Editar — {editando?.nome}</Text>
              <TouchableOpacity onPress={fechar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.fechar}>
                <Ionicons name="close" size={20} color={colors.td} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <Text style={s.label}>Nome do plano *</Text>
              <TextInput style={s.input} value={form.nome} onChangeText={t => set('nome', t)} placeholder="Ex: Acolher" placeholderTextColor={colors.tl} />

              <Text style={s.label}>Subtítulo</Text>
              <TextInput style={s.input} value={form.subtitulo} onChangeText={t => set('subtitulo', t)} placeholder="Ex: Mensal" placeholderTextColor={colors.tl} />

              <View style={s.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Preço (R$)</Text>
                  <TextInput
                    style={s.input} value={form.preco} onChangeText={t => set('preco', t)}
                    placeholder="Ex: 24,90" placeholderTextColor={colors.tl} keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Rótulo do preço</Text>
                  <TextInput style={s.input} value={form.precoLabel} onChangeText={t => set('precoLabel', t)} placeholder="Ex: R$ 24,90/mês" placeholderTextColor={colors.tl} />
                </View>
              </View>
              <Text style={s.label}>Preço anual (R$)</Text>
              <TextInput
                style={s.input} value={form.precoAnual} onChangeText={t => set('precoAnual', t)}
                placeholder="Vazio = 10 mensalidades" placeholderTextColor={colors.tl} keyboardType="decimal-pad"
              />
              <Text style={s.hint}>
                O preço numérico é o valor realmente cobrado no checkout. O rótulo é só o texto exibido no card.
              </Text>

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
                  <Degrade />
                  <Text style={s.btnPrimTxt}>{salvando ? 'Salvando...' : 'Salvar'}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 220 }} />
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = criarEstilos(() => ({
  card: { ...est.vidro(26), padding: 18, marginBottom: spacing.md },
  cardTitle: { ...est.cartaoTitulo(), marginBottom: 4 },
  cardHint: { ...est.legenda(), marginBottom: spacing.md },

  criarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 18,
    borderWidth: 1.5, borderColor: colors.lav3, borderStyle: 'dashed',
    backgroundColor: colors.lav1,
  },
  criarTxt: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.lilasTexto },

  planoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderTopWidth: 1, borderTopColor: colors.bordaSuave,
  },
  planoTitRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  planoNome: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo },
  tagDestaque: { backgroundColor: acento('lilas').fundo, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tagDestaqueTxt: { fontFamily: fonts.bodyBold, fontSize: 11, color: acento('lilas').texto, letterSpacing: 0.6 },
  tagBreve: { backgroundColor: acento('neutro').fundo, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tagBreveTxt: { fontFamily: fonts.bodyBold, fontSize: 11, color: acento('neutro').texto, letterSpacing: 0.6 },
  planoDesc: { fontFamily: fonts.body, fontSize: 13.5, color: colors.texto2, marginTop: 3, lineHeight: 19 },
  planoMeta: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.tl, marginTop: 3 },

  modalOverlay: { ...est.veu(), justifyContent: 'flex-end' },
  modalCard: { ...est.folha(), padding: spacing.lg, maxHeight: '92%' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    marginBottom: spacing.sm,
  },
  modalTitle: { ...est.modalTitulo(), flex: 1 },
  fechar: est.fechar(),

  fieldRow: { flexDirection: 'row', gap: spacing.sm },
  label: est.rotulo(),
  input: est.campo(),
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  inputLista: { minHeight: 130, textAlignVertical: 'top' },
  hint: est.dica(),

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  switchLbl: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.td, flex: 1 },

  modalBtns: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  btnGhost: { ...est.botaoSec(), flex: 1 },
  btnGhostTxt: est.botaoSecTxt(),
  btnPrim: { ...est.botao(), flex: 1 },
  btnPrimTxt: est.botaoTxt(),
}), { escalar: false });
