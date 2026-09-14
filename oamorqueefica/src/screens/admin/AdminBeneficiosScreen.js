import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { colors, fonts, spacing, radius } from '../../theme';
import { Card } from '../../components';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';

const centavosTxt = (c) => `R$ ${(Number(c || 0) / 100).toFixed(2).replace('.', ',')}`;

const STATUS_LABEL = {
  CONCLUIDO: 'Aguardando confirmação',
  CONFIRMADO_USUARIO: 'Confirmado',
  CONTESTADO: 'Contestado',
  ELEGIVEL_LIQUIDACAO: 'Elegível p/ fechamento',
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  LIQUIDADO: 'Pago',
};
const STATUS_COR = {
  CONCLUIDO: colors.gold,
  CONFIRMADO_USUARIO: colors.lav4,
  CONTESTADO: colors.peach2,
  ELEGIVEL_LIQUIDACAO: colors.lav5,
  AGUARDANDO_PAGAMENTO: colors.gold,
  LIQUIDADO: colors.sage,
};

// Reconciliação financeira do módulo de cupons: mostra o que já é comissão
// "de verdade" (confirmada pela usuária) versus o que ainda é só um voucher
// gerado ou um atendimento não confirmado — esses nunca entram nos totais.
export default function AdminBeneficiosScreen({ navigation, route }) {
  const [parcerias, setParcerias] = useState([]);
  const [parceriaSel, setParceriaSel] = useState(route?.params?.parceriaId || 'todas');
  const [resgates, setResgates] = useState([]);
  const [fechamentos, setFechamentos] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [modalPagamento, setModalPagamento] = useState(null);
  const [formPagamento, setFormPagamento] = useState({ metodo: '', referencia: '', observacao: '' });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'parcerias'), (snap) => {
      setParcerias(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.tipoBeneficio === 'cupom'));
    }, () => {});
    return unsub;
  }, []);

  useEffect(() => {
    let ref = collection(db, 'resgates');
    if (parceriaSel !== 'todas') ref = query(ref, where('parceriaId', '==', parceriaSel));
    const unsub = onSnapshot(ref, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));
      setResgates(docs);
    }, () => {});
    return unsub;
  }, [parceriaSel]);

  useEffect(() => {
    let ref = collection(db, 'fechamentos');
    if (parceriaSel !== 'todas') ref = query(ref, where('parceriaId', '==', parceriaSel));
    const unsub = onSnapshot(ref, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.geradoEm?.toMillis?.() ?? 0) - (a.geradoEm?.toMillis?.() ?? 0));
      setFechamentos(docs);
    }, () => {});
    return unsub;
  }, [parceriaSel]);

  const totais = useMemo(() => {
    const soma = (status) => resgates.filter(r => status.includes(r.status)).reduce((a, r) => a + (r.valorComissaoCentavos || 0), 0);
    return {
      pendente: soma(['CONCLUIDO', 'CONFIRMADO_USUARIO']),
      elegivel: soma(['ELEGIVEL_LIQUIDACAO']),
      aguardando: soma(['AGUARDANDO_PAGAMENTO']),
      recebido: soma(['LIQUIDADO']),
      contestado: resgates.filter(r => r.status === 'CONTESTADO').length,
    };
  }, [resgates]);

  const temElegiveis = resgates.some(r => r.status === 'ELEGIVEL_LIQUIDACAO');

  const fecharPeriodo = async () => {
    if (parceriaSel === 'todas') {
      Alert.alert('Selecione uma parceria', 'Escolha uma parceria específica para fechar o período.');
      return;
    }
    setProcessando(true);
    try {
      const fn = httpsCallable(functions, 'fecharPeriodoParceria');
      const { data } = await fn({ parceriaId: parceriaSel });
      const valorTxt = `R$ ${Number(data.comissao || 0).toFixed(2).replace('.', ',')}`;
      Alert.alert('', `Período fechado: ${data.totalResgates} utilização(ões), comissão de ${valorTxt}.`);
    } catch (e) {
      Alert.alert('', e?.message || 'Não foi possível fechar o período.');
    } finally {
      setProcessando(false);
    }
  };

  const registrarPagamento = async () => {
    if (!modalPagamento) return;
    setProcessando(true);
    try {
      const fn = httpsCallable(functions, 'registrarPagamentoFechamento');
      await fn({
        fechamentoId: modalPagamento.id,
        metodoPagamento: formPagamento.metodo,
        referencia: formPagamento.referencia,
        observacao: formPagamento.observacao,
      });
      setModalPagamento(null);
      setFormPagamento({ metodo: '', referencia: '', observacao: '' });
      Alert.alert('', 'Pagamento registrado!');
    } catch (e) {
      Alert.alert('', e?.message || 'Não foi possível registrar o pagamento.');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminBeneficios">
      <AdminSubTabs grupo="parcerias" atual="AdminBeneficios" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Cupons e Comissões</Text>
        <Text style={s.pageSub}>
          Só entra nos totais o que a usuária confirmou de fato — gerar um cupom nunca é contabilizado como receita.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[s.chip, parceriaSel === 'todas' && s.chipSel]}
              onPress={() => setParceriaSel('todas')}
            >
              <Text style={[s.chipTxt, parceriaSel === 'todas' && s.chipTxtSel]}>Todas as parcerias</Text>
            </TouchableOpacity>
            {parcerias.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[s.chip, parceriaSel === p.id && s.chipSel]}
                onPress={() => setParceriaSel(p.id)}
              >
                <Text style={[s.chipTxt, parceriaSel === p.id && s.chipTxtSel]}>{p.titulo}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {parcerias.length === 0 && (
          <Card style={{ marginBottom: spacing.lg, alignItems: 'center', gap: 8, paddingVertical: spacing.xl }}>
            <Ionicons name="pricetag-outline" size={28} color={colors.tl} />
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, textAlign: 'center' }}>
              Nenhuma parceria do tipo "cupom com comissão" cadastrada ainda.
            </Text>
          </Card>
        )}

        <View style={s.statsGrid}>
          <View style={s.statBox}>
            <Text style={[s.statNum, { color: colors.gold }]}>{centavosTxt(totais.pendente)}</Text>
            <Text style={s.statLbl}>Aguardando confirmação</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statNum, { color: colors.lav5 }]}>{centavosTxt(totais.elegivel)}</Text>
            <Text style={s.statLbl}>Elegível p/ fechamento</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statNum, { color: colors.gold }]}>{centavosTxt(totais.aguardando)}</Text>
            <Text style={s.statLbl}>Aguardando pagamento</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statNum, { color: colors.sage }]}>{centavosTxt(totais.recebido)}</Text>
            <Text style={s.statLbl}>Já recebido</Text>
          </View>
        </View>

        {parceriaSel !== 'todas' && (
          <TouchableOpacity
            style={[s.fecharBtn, !temElegiveis && s.fecharBtnDesativado]}
            onPress={fecharPeriodo}
            disabled={!temElegiveis || processando}
          >
            <Ionicons name="lock-closed-outline" size={16} color="white" />
            <Text style={s.fecharBtnTxt}>
              {processando ? 'Processando...' : 'Fechar período (gerar cobrança)'}
            </Text>
          </TouchableOpacity>
        )}

        {fechamentos.filter(f => f.status === 'ABERTO').length > 0 && (
          <>
            <Text style={s.sectionTitle}>Fechamentos aguardando pagamento</Text>
            {fechamentos.filter(f => f.status === 'ABERTO').map(f => (
              <Card key={f.id} style={s.fechamentoItem}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fechamentoTit}>{f.totalResgates} utilização(ões)</Text>
                  <Text style={s.fechamentoValor}>{centavosTxt(f.valorComissaoTotalCentavos)}</Text>
                </View>
                <TouchableOpacity
                  style={s.pagarBtn}
                  onPress={() => setModalPagamento(f)}
                >
                  <Text style={s.pagarBtnTxt}>Registrar pagamento</Text>
                </TouchableOpacity>
              </Card>
            ))}
          </>
        )}

        <Text style={s.sectionTitle}>Utilizações recentes</Text>
        {resgates.length === 0 && <Text style={s.emptyText}>Nenhuma utilização registrada ainda.</Text>}
        {resgates.slice(0, 50).map(r => (
          <Card key={r.id} style={s.resgateItem}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.resgateCodigo}>{r.codigoPublico} · {r.parceriaNome}</Text>
              <Text style={s.resgateValores}>
                {centavosTxt(r.valorOriginalCentavos)} → {centavosTxt(r.valorFinalCentavos)} · comissão {centavosTxt(r.valorComissaoCentavos)}
              </Text>
            </View>
            <View style={[s.statusPill, { borderColor: STATUS_COR[r.status] || colors.tl }]}>
              <Text style={[s.statusPillTxt, { color: STATUS_COR[r.status] || colors.tl }]}>
                {STATUS_LABEL[r.status] || r.status}
              </Text>
            </View>
          </Card>
        ))}
      </ScrollView>

      <Modal visible={!!modalPagamento} transparent animationType="fade" onRequestClose={() => setModalPagamento(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Registrar pagamento</Text>
            <Text style={s.modalSub}>
              {modalPagamento?.totalResgates} utilização(ões) · {centavosTxt(modalPagamento?.valorComissaoTotalCentavos)}
            </Text>
            <TextInput
              style={s.input} placeholder="Método (Pix, transferência...)"
              placeholderTextColor={colors.tl}
              value={formPagamento.metodo}
              onChangeText={t => setFormPagamento(f => ({ ...f, metodo: t }))}
            />
            <TextInput
              style={s.input} placeholder="Referência / comprovante"
              placeholderTextColor={colors.tl}
              value={formPagamento.referencia}
              onChangeText={t => setFormPagamento(f => ({ ...f, referencia: t }))}
            />
            <TextInput
              style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
              placeholder="Observação (opcional)" multiline
              placeholderTextColor={colors.tl}
              value={formPagamento.observacao}
              onChangeText={t => setFormPagamento(f => ({ ...f, observacao: t }))}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.sm }}>
              <TouchableOpacity style={s.modalBtnGhost} onPress={() => setModalPagamento(null)}>
                <Text style={s.modalBtnGhostTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnPrim} onPress={registrarPagamento} disabled={processando}>
                <Text style={s.modalBtnPrimTxt}>{processando ? 'Salvando...' : 'Confirmar pagamento'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, marginBottom: spacing.md, lineHeight: 18 },

  chip: {
    backgroundColor: colors.card, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  chipSel: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  chipTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTxtSel: { fontFamily: fonts.bodyBold, color: 'white' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  statBox: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  statNum: { fontFamily: fonts.bodyBold, fontSize: 18 },
  statLbl: { fontFamily: fonts.body, fontSize: 10.5, color: colors.tm, marginTop: 2 },

  fecharBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.lav4, borderRadius: radius.full, paddingVertical: 13, marginBottom: spacing.lg,
  },
  fecharBtnDesativado: { opacity: 0.4 },
  fecharBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: 'white' },

  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm, marginTop: spacing.sm },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, marginBottom: spacing.md },

  fechamentoItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  fechamentoTit: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.td },
  fechamentoValor: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.gold, marginTop: 2 },
  pagarBtn: { backgroundColor: colors.sage, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 9 },
  pagarBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: 'white' },

  resgateItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  resgateCodigo: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.td },
  resgateValores: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
  statusPill: { borderWidth: 1.3, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4 },
  statusPillTxt: { fontFamily: fonts.bodyBold, fontSize: 9.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, width: '100%', maxWidth: 380, gap: 10 },
  modalTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  modalSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, marginBottom: 4 },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  modalBtnGhost: { flex: 1, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  modalBtnGhostTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.tm },
  modalBtnPrim: { flex: 1, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.lav4 },
  modalBtnPrimTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
});
