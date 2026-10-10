import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { colors, fonts, spacing, radius } from '../../theme';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';
import { brl } from '../cashback/CashbackScreen';

// Cashback: regras do programa, números gerais, crédito manual e estorno.
// Os créditos e usos só são gravados pelas Cloud Functions.
const dataCurta = (ms) => (ms ? new Date(ms).toLocaleDateString('pt-BR') : '');
const numero = (v) => Number(String(v).replace(',', '.'));

export function resumoCashback(movimentos, agora = Date.now()) {
  const r = { distribuido: 0, usado: 0, vencido: 0, aberto: 0, estornado: 0, pessoas: new Set() };
  movimentos.forEach(m => {
    if (m.tipo === 'credito') {
      r.distribuido += m.valorCentavos || 0;
      r.pessoas.add(m.usuarioId);
      const saldo = m.saldoCentavos || 0;
      if (m.estornado) return;
      if ((m.expiraEm?.toMillis?.() || 0) <= agora) r.vencido += saldo;
      else r.aberto += saldo;
    } else if (m.tipo === 'uso') r.usado += m.valorCentavos || 0;
    else if (m.tipo === 'estorno') r.estornado += m.valorCentavos || 0;
  });
  return { ...r, pessoas: r.pessoas.size };
}

export default function AdminCashbackScreen({ navigation }) {
  const [cfg, setCfg] = useState({ ativo: true, percentual: '1', validadeMeses: '6', limitePercentual: '100' });
  const [salvandoCfg, setSalvandoCfg] = useState(false);
  const [movimentos, setMovimentos] = useState([]);
  const [usuarias, setUsuarias] = useState({});
  const [conceder, setConceder] = useState({ email: '', valor: '', motivo: '' });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'cashback'), (snap) => {
    const c = snap.data() || {};
    setCfg({
      ativo: c.ativo !== false,
      percentual: String(c.percentual ?? 1).replace('.', ','),
      validadeMeses: String(c.validadeMeses ?? 6),
      limitePercentual: String(c.limitePercentual ?? 100),
    });
  }, () => {}), []);

  useEffect(() => onSnapshot(collection(db, 'cashback'), (snap) => {
    setMovimentos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => {}), []);

  useEffect(() => onSnapshot(collection(db, 'usuarios'), (snap) => {
    const m = {};
    snap.docs.forEach(d => { const u = d.data(); m[d.id] = u.nome || u.email || 'Usuária'; });
    setUsuarias(m);
  }, () => {}), []);

  const resumo = useMemo(() => resumoCashback(movimentos), [movimentos]);
  const recentes = useMemo(() => [...movimentos]
    .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0))
    .slice(0, 40), [movimentos]);

  const salvarCfg = async () => {
    const percentual = numero(cfg.percentual);
    const validadeMeses = Math.round(numero(cfg.validadeMeses));
    const limitePercentual = numero(cfg.limitePercentual);
    if (!(percentual >= 0 && percentual <= 50)) { Alert.alert('Atenção', 'O percentual deve ficar entre 0 e 50.'); return; }
    if (!(validadeMeses >= 1 && validadeMeses <= 24)) { Alert.alert('Atenção', 'A validade deve ficar entre 1 e 24 meses.'); return; }
    if (!(limitePercentual >= 1 && limitePercentual <= 100)) { Alert.alert('Atenção', 'O limite de desconto deve ficar entre 1% e 100%.'); return; }
    setSalvandoCfg(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'cashback'), { ativo: cfg.ativo, percentual, validadeMeses, limitePercentual, atualizadoEm: serverTimestamp() }, { merge: true });
      Alert.alert('Pronto', 'Regras do cashback salvas.');
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar.');
    } finally {
      setSalvandoCfg(false);
    }
  };

  const concederCredito = async () => {
    const valor = numero(conceder.valor);
    if (!conceder.email.trim()) { Alert.alert('Atenção', 'Informe o e-mail da usuária.'); return; }
    if (!(valor >= 1)) { Alert.alert('Atenção', 'Informe um valor a partir de R$ 1,00.'); return; }
    setEnviando(true);
    try {
      const r = await httpsCallable(functions, 'concederCashbackAdmin')({ email: conceder.email.trim(), valor, motivo: conceder.motivo.trim() });
      Alert.alert('Crédito concedido', `${brl(Math.round(valor * 100))} para ${r.data?.nome || conceder.email}.`);
      setConceder({ email: '', valor: '', motivo: '' });
    } catch (e) {
      Alert.alert('Não foi possível conceder', e.message || 'Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const estornar = (m) => Alert.alert('Estornar crédito', `Zerar o saldo restante (${brl(m.saldoCentavos)}) deste crédito?`, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Estornar', style: 'destructive',
      onPress: async () => {
        try { await httpsCallable(functions, 'estornarCashbackAdmin')({ creditoId: m.id }); }
        catch (e) { Alert.alert('Erro', e.message || 'Não foi possível estornar.'); }
      },
    },
  ]);

  const agora = Date.now();
  const CARDS = [
    { rotulo: 'Distribuído', valor: resumo.distribuido, cor: colors.lav5 },
    { rotulo: 'Usado em compras', valor: resumo.usado, cor: colors.sageFg },
    { rotulo: 'Em aberto', valor: resumo.aberto, cor: colors.td },
    { rotulo: 'Vencido', valor: resumo.vencido, cor: colors.tl },
  ];

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminCashback">
      <AdminSubTabs grupo="parcerias" atual="AdminCashback" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={st.scroll}>
        <Text style={st.pageTitle}>Cashback</Text>
        <Text style={st.pageSub}>Quem usa um cupom de parceria ganha uma parte do valor de volta, para usar como desconto no plano ou no relatório.</Text>

        <View style={st.grade}>
          {CARDS.map(c => (
            <View key={c.rotulo} style={st.stat}>
              <Text style={[st.statN, { color: c.cor }]}>{brl(c.valor)}</Text>
              <Text style={st.statL}>{c.rotulo}</Text>
            </View>
          ))}
        </View>
        <Text style={st.nota}>{resumo.pessoas} pessoa{resumo.pessoas === 1 ? '' : 's'} já receberam cashback.</Text>

        <Text style={st.secTit}>Regras do programa</Text>
        <View style={st.card}>
          <View style={st.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.switchTxt}>Programa ativo</Text>
              <Text style={st.ajuda}>Pausado, ninguém ganha nem usa novos créditos.</Text>
            </View>
            <Switch value={cfg.ativo} onValueChange={v => setCfg(c => ({ ...c, ativo: v }))} trackColor={{ true: colors.lav4 }} />
          </View>
          <View style={st.linha}>
            <View style={st.campo}>
              <Text style={st.label}>Cashback (%)</Text>
              <TextInput style={st.input} value={cfg.percentual} onChangeText={v => setCfg(c => ({ ...c, percentual: v }))} keyboardType="decimal-pad" />
            </View>
            <View style={st.campo}>
              <Text style={st.label}>Validade (meses)</Text>
              <TextInput style={st.input} value={cfg.validadeMeses} onChangeText={v => setCfg(c => ({ ...c, validadeMeses: v }))} keyboardType="number-pad" />
            </View>
            <View style={st.campo}>
              <Text style={st.label}>Desconto máx. (%)</Text>
              <TextInput style={st.input} value={cfg.limitePercentual} onChangeText={v => setCfg(c => ({ ...c, limitePercentual: v }))} keyboardType="number-pad" />
            </View>
          </View>
          <Text style={st.ajuda}>"Desconto máx." é quanto do preço o cashback pode cobrir. Sempre fica ao menos R$ 1,00 a pagar.</Text>
          <TouchableOpacity style={[st.btn, salvandoCfg && { opacity: 0.6 }]} onPress={salvarCfg} disabled={salvandoCfg}>
            {salvandoCfg ? <ActivityIndicator color="white" size="small" /> : <Text style={st.btnTxt}>Salvar regras</Text>}
          </TouchableOpacity>
        </View>

        <Text style={st.secTit}>Conceder crédito</Text>
        <View style={st.card}>
          <Text style={st.ajuda}>Para cortesias ou ajustes. A pessoa recebe uma notificação no app.</Text>
          <Text style={st.label}>E-mail da usuária</Text>
          <TextInput style={st.input} value={conceder.email} onChangeText={v => setConceder(c => ({ ...c, email: v }))} autoCapitalize="none" keyboardType="email-address" placeholder="nome@email.com" placeholderTextColor={colors.tl} />
          <View style={st.linha}>
            <View style={st.campo}>
              <Text style={st.label}>Valor (R$)</Text>
              <TextInput style={st.input} value={conceder.valor} onChangeText={v => setConceder(c => ({ ...c, valor: v }))} keyboardType="decimal-pad" placeholder="10,00" placeholderTextColor={colors.tl} />
            </View>
            <View style={[st.campo, { flex: 2 }]}>
              <Text style={st.label}>Motivo (aparece no extrato)</Text>
              <TextInput style={st.input} value={conceder.motivo} onChangeText={v => setConceder(c => ({ ...c, motivo: v }))} placeholder="Presente da Atravessia" placeholderTextColor={colors.tl} />
            </View>
          </View>
          <TouchableOpacity style={[st.btn, enviando && { opacity: 0.6 }]} onPress={concederCredito} disabled={enviando}>
            {enviando ? <ActivityIndicator color="white" size="small" /> : <Text style={st.btnTxt}>Conceder crédito</Text>}
          </TouchableOpacity>
        </View>

        <Text style={st.secTit}>Movimentos recentes</Text>
        {recentes.length === 0 ? (
          <Text style={st.vazio}>Nenhum movimento ainda.</Text>
        ) : (
          <View style={st.card}>
            {recentes.map((m, i) => {
              const credito = m.tipo === 'credito';
              const vencido = credito && (m.expiraEm?.toMillis?.() || 0) <= agora;
              const podeEstornar = credito && !m.estornado && !vencido && (m.saldoCentavos || 0) > 0;
              const status = !credito ? (m.tipo === 'uso' ? 'Usado' : 'Estorno')
                : m.estornado ? 'Estornado' : vencido ? 'Vencido' : `Saldo ${brl(m.saldoCentavos)} · até ${dataCurta(m.expiraEm?.toMillis?.())}`;
              return (
                <View key={m.id} style={[st.mov, i > 0 && st.movBorda]}>
                  <Ionicons name={credito ? 'add-circle-outline' : 'remove-circle-outline'} size={20} color={credito ? colors.sageFg : colors.tm} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.movTit} numberOfLines={1}>{usuarias[m.usuarioId] || 'Usuária'}</Text>
                    <Text style={st.movSub} numberOfLines={2}>{m.descricao || ''}{m.descricao ? ' · ' : ''}{dataCurta(m.criadoEm?.toMillis?.())} · {status}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[st.movValor, credito && { color: colors.sageFg }]}>{credito ? '+' : '−'} {brl(m.valorCentavos)}</Text>
                    {podeEstornar && (
                      <TouchableOpacity onPress={() => estornar(m)} hitSlop={8}>
                        <Text style={st.estornar}>Estornar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </AdminLayout>
  );
}

const st = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40, maxWidth: 900, width: '100%', alignSelf: 'center' },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg, lineHeight: 19 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '45%', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  statN: { fontFamily: fonts.bodyBold, fontSize: 19 },
  statL: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },
  nota: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, marginTop: 8 },
  secTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  switchTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td },
  linha: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  campo: { flex: 1, minWidth: 110 },
  label: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.td, marginBottom: 4, marginTop: spacing.sm },
  input: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 10, fontFamily: fonts.body, fontSize: 14, color: colors.td },
  ajuda: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, lineHeight: 17, marginTop: 4 },
  btn: { backgroundColor: colors.lav5, borderRadius: radius.full, paddingVertical: 12, alignItems: 'center', marginTop: spacing.md },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: 'white' },
  vazio: { fontFamily: fonts.body, fontSize: 13, color: colors.tm },
  mov: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  movBorda: { borderTopWidth: 1, borderTopColor: colors.border },
  movTit: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.td },
  movSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 1 },
  movValor: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.tm },
  estornar: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.roseTexto || colors.rose },
});
