import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius } from '../../theme';
import AdminLayout from './AdminLayout';
import AdminPlanosCards from './AdminPlanosCards';

const PLANOS_INFO = [
  { id: 1, nome: 'Plano Acolher', cor: colors.rose, campo: 'plano1' },
  { id: 2, nome: 'Plano Compreender', cor: colors.lav4, campo: 'plano2' },
  { id: 3, nome: 'Plano Evoluir', cor: colors.sage, campo: 'plano3' },
];

const DEFAULT_PRECOS = {
  plano1: 2490,
  plano2: 4990,
  plano3: 8990,
  periodo: 590,
};

function centavosParaReais(centavos) {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

function reaisParaCentavos(str) {
  const limpo = str.replace(/[^0-9,]/g, '').replace(',', '.');
  const valor = parseFloat(limpo);
  if (isNaN(valor)) return null;
  return Math.round(valor * 100);
}

function formatarInput(str) {
  const nums = str.replace(/\D/g, '');
  if (!nums) return '';
  const cents = parseInt(nums, 10);
  return (cents / 100).toFixed(2).replace('.', ',');
}

export default function AdminPrecosScreen() {
  const [precos, setPrecos] = useState(DEFAULT_PRECOS);
  const [inputs, setInputs] = useState({});
  const [ativarEm, setAtivarEm] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const ref = doc(db, 'configuracoes', 'precos');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPrecos({ ...DEFAULT_PRECOS, ...data });
        setInputs({
          plano1: centavosParaReais(data.plano1 ?? DEFAULT_PRECOS.plano1),
          plano2: centavosParaReais(data.plano2 ?? DEFAULT_PRECOS.plano2),
          plano3: centavosParaReais(data.plano3 ?? DEFAULT_PRECOS.plano3),
          periodo: centavosParaReais(data.periodo ?? DEFAULT_PRECOS.periodo),
        });
      } else {
        setInputs({
          plano1: centavosParaReais(DEFAULT_PRECOS.plano1),
          plano2: centavosParaReais(DEFAULT_PRECOS.plano2),
          plano3: centavosParaReais(DEFAULT_PRECOS.plano3),
          periodo: centavosParaReais(DEFAULT_PRECOS.periodo),
        });
      }
      setCarregando(false);
    }, () => setCarregando(false));
    return unsub;
  }, []);

  const handleSalvar = async () => {
    const novo = {};
    for (const campo of ['plano1', 'plano2', 'plano3', 'periodo']) {
      const inputVal = (inputs[campo] || '').trim();
      if (!inputVal) continue; // campo em branco → não altera
      const val = reaisParaCentavos(inputVal);
      if (val === null || val <= 0) {
        const nomes = { plano1: 'Plano Acolher', plano2: 'Plano Compreender', plano3: 'Plano Evoluir', periodo: 'Relatório por período' };
        Alert.alert('Valor inválido', `Verifique o preço de "${nomes[campo]}".`);
        return;
      }
      novo[campo] = val;
    }

    if (Object.keys(novo).length === 0) {
      Alert.alert('Nenhum campo', 'Preencha ao menos um preço para salvar.');
      return;
    }

    let ativarEmDate = null;
    if (ativarEm) {
      const [dia, mes, ano] = ativarEm.split('/').map(Number);
      const d = new Date(ano, mes - 1, dia);
      if (isNaN(d.getTime())) {
        Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.');
        return;
      }
      ativarEmDate = d;
    }

    setSalvando(true);
    try {
      const payload = {
        ...novo,
        atualizadoEm: serverTimestamp(),
      };
      if (ativarEmDate) payload.ativarEm = ativarEmDate;

      await setDoc(doc(db, 'configuracoes', 'precos'), payload, { merge: true });
      Alert.alert(
        'Preços salvos',
        ativarEmDate
          ? `Os preços serão ativados em ${ativarEm}.`
          : 'Os preços foram atualizados imediatamente.'
      );
      setAtivarEm('');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar os preços.');
    } finally {
      setSalvando(false);
    }
  };

  const formatarData = (text) => {
    const nums = text.replace(/\D/g, '');
    if (nums.length <= 2) return nums;
    if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`;
    return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4, 8)}`;
  };

  if (carregando) {
    return (
      <AdminLayout currentScreen="AdminPrecos">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.lav4} />
        </View>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentScreen="AdminPrecos">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.title}>Preços e Planos</Text>
        <Text style={s.sub}>
          Edite os valores dos planos e do relatório por período. Os preços são armazenados em centavos e usados pelas funções do Stripe.
        </Text>

        {/* Cards dos planos exibidos no app */}
        <AdminPlanosCards />

        {/* Planos */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Planos de assinatura (mensais)</Text>
        <Text style={s.cardHint}>Deixe em branco os campos que não deseja alterar.</Text>
          {PLANOS_INFO.map(p => (
            <View key={p.id} style={s.precoRow}>
              <View style={[s.planDot, { backgroundColor: p.cor }]} />
              <Text style={s.planNome}>{p.nome}</Text>
              <View style={s.inputWrap}>
                <Text style={s.cifrao}>R$</Text>
                <TextInput
                  style={s.precoInput}
                  keyboardType="numeric"
                  value={inputs[p.campo] || ''}
                  onChangeText={t => setInputs(prev => ({ ...prev, [p.campo]: formatarInput(t) }))}
                  placeholder="0,00"
                  placeholderTextColor={colors.tl}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Relatório por período */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Relatório por período (por crédito)</Text>
        <Text style={s.cardHint}>Deixe em branco para não alterar.</Text>
          <View style={s.precoRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.lav4} />
            <Text style={s.planNome}>Relatório personalizado</Text>
            <View style={s.inputWrap}>
              <Text style={s.cifrao}>R$</Text>
              <TextInput
                style={s.precoInput}
                keyboardType="numeric"
                value={inputs.periodo || ''}
                onChangeText={t => setInputs(prev => ({ ...prev, periodo: formatarInput(t) }))}
                placeholder="0,00"
                placeholderTextColor={colors.tl}
              />
            </View>
          </View>
        </View>

        {/* Ativação agendada */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Ativação agendada (opcional)</Text>
          <Text style={s.cardSub}>
            Defina uma data futura para os novos preços entrarem em vigor. Deixe em branco para ativar imediatamente.
          </Text>
          <View style={s.dateRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.tl} />
            <TextInput
              style={s.dateInput}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.tl}
              value={ativarEm}
              onChangeText={t => setAtivarEm(formatarData(t))}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        </View>

        {/* Salvar */}
        <TouchableOpacity
          style={[s.saveBtn, salvando && { opacity: 0.6 }]}
          onPress={handleSalvar}
          disabled={salvando}
        >
          {salvando
            ? <ActivityIndicator size="small" color="white" />
            : <Ionicons name="checkmark-circle-outline" size={18} color="white" />}
          <Text style={s.saveBtnTxt}>
            {salvando ? 'Salvando...' : 'Salvar preços'}
          </Text>
        </TouchableOpacity>

        <Text style={s.hint}>
          Atenção: alterar os preços aqui não reconfigura automaticamente os produtos no Stripe. Os valores são usados pelas Cloud Functions para criar novos checkouts.
        </Text>
      </ScrollView>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  title: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg, lineHeight: 19 },

  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
  },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  cardSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginBottom: spacing.sm, lineHeight: 17 },
  cardHint: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginBottom: spacing.sm },

  precoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  planDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  planNome: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 8, paddingVertical: 6,
  },
  cifrao: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.tm, marginRight: 2 },
  precoInput: {
    fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td,
    minWidth: 60, textAlign: 'right',
  },

  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 10,
  },
  dateInput: {
    flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.lav4, borderRadius: radius.full,
    paddingVertical: 14, marginBottom: spacing.md,
  },
  saveBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: 'white' },

  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, lineHeight: 17, textAlign: 'center' },
});
