import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, Alert } from 'react-native';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, BotaoAdmin } from './adminEstilo';

// Formas de pagamento oferecidas em Planos (configuracoes/assinatura).
// Os preços ficam no editor de cada plano (planos/{id}.preco e .precoAnual).
const PADRAO = { mensalAtivo: true, anualAtivo: true, seloAnual: '2 meses de presente', textoAnual: '' };

export default function AdminAssinaturaCard({ estilo }) {
  const [cfg, setCfg] = useState(PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [editado, setEditado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'assinatura'), (snap) => {
    if (!editado) setCfg({ ...PADRAO, ...(snap.data() || {}) });
    setCarregando(false);
  }, () => setCarregando(false)), [editado]);

  const set = (k, v) => { setEditado(true); setCfg(p => ({ ...p, [k]: v })); };

  const salvar = async () => {
    if (!cfg.mensalAtivo && !cfg.anualAtivo) { Alert.alert('Atenção', 'Deixe pelo menos uma forma de pagamento ligada.'); return; }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'assinatura'), {
        mensalAtivo: !!cfg.mensalAtivo, anualAtivo: !!cfg.anualAtivo,
        seloAnual: (cfg.seloAnual || '').trim(), textoAnual: (cfg.textoAnual || '').trim(), atualizadoEm: serverTimestamp(),
      }, { merge: true });
      setEditado(false);
      Alert.alert('Pronto', 'Formas de pagamento salvas.');
    } catch (e) {
      Alert.alert('Não foi possível salvar', e?.message || 'Tente de novo.');
    } finally { setSalvando(false); }
  };

  const linha = (campo, titulo, sub) => (
    <View style={s.linha}>
      <View style={{ flex: 1 }}>
        <Text style={s.rotuloLinha}>{titulo}</Text>
        <Text style={s.subLinha}>{sub}</Text>
      </View>
      <Switch
        value={!!cfg[campo]} onValueChange={v => set(campo, v)} disabled={carregando}
        trackColor={{ true: colors.lav4 }} accessibilityLabel={titulo}
      />
    </View>
  );

  return (
    <View style={[s.card, estilo]}>
      <Text style={s.titulo}>Formas de pagamento</Text>
      <Text style={s.sub}>Escolha como a usuária pode assinar os planos pagos.</Text>
      {linha('mensalAtivo', 'Assinatura mensal', 'Cobrança todo mês.')}
      {linha('anualAtivo', 'Assinatura anual', 'Pagamento uma vez por ano.')}
      <Text style={s.label}>Selo da opção anual</Text>
      <TextInput
        style={[s.input, !cfg.anualAtivo && s.inputOff]} value={cfg.seloAnual} editable={!!cfg.anualAtivo}
        onChangeText={t => set('seloAnual', t)} placeholder="Ex.: 2 meses de presente" placeholderTextColor={colors.tl}
      />
      <Text style={s.label}>Frase sobre o anual (opcional)</Text>
      <TextInput
        style={[s.input, !cfg.anualAtivo && s.inputOff]} value={cfg.textoAnual} editable={!!cfg.anualAtivo}
        onChangeText={t => set('textoAnual', t)} placeholder="Ex.: pague uma vez e tenha o ano todo de cuidado" placeholderTextColor={colors.tl}
      />
      <BotaoAdmin
        title={salvando ? 'Salvando...' : 'Salvar formas de pagamento'} icone="checkmark"
        onPress={salvar} disabled={salvando || carregando || !editado} carregando={salvando}
        style={{ marginTop: spacing.lg }}
      />
    </View>
  );
}

const s = criarEstilos(() => ({
  card: { ...est.vidro(24), padding: 18 },
  titulo: est.cartaoTitulo(),
  sub: { ...est.legenda(), marginTop: 2, marginBottom: 6 },
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.bordaSuave,
  },
  rotuloLinha: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.titulo },
  subLinha: { ...est.legenda(), marginTop: 1 },
  label: est.rotulo(),
  input: est.campo(),
  inputOff: { opacity: 0.5 },
}), { escalar: false });
