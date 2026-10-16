import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, Alert } from 'react-native';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, BotaoAdmin } from './adminEstilo';

// Formas de assinatura (mensal e anual) e preço anual de cada plano.
// configuracoes/assinatura + planos/{id}.precoAnual (espelhado em configuracoes/precos).
const PLANOS = [{ id: 1, nome: 'Acolher' }, { id: 2, nome: 'Compreender' }, { id: 3, nome: 'Evoluir' }];
const PADRAO = { mensalAtivo: true, anualAtivo: true, seloAnual: '2 meses de presente', textoAnual: '' };
const reais = (v) => (v ? String(v).replace('.', ',') : '');
const numero = (t) => { const n = parseFloat(String(t || '').replace(/[^0-9,.]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

export default function AdminAssinaturaCard() {
  const [cfg, setCfg] = useState(PADRAO);
  const [mensais, setMensais] = useState({});
  const [anuais, setAnuais] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'assinatura'), (snap) => setCfg({ ...PADRAO, ...(snap.data() || {}) }), () => {}), []);
  useEffect(() => {
    const unsubs = PLANOS.map(p => onSnapshot(doc(db, 'planos', String(p.id)), (snap) => {
      const d = snap.data() || {};
      setMensais(prev => ({ ...prev, [p.id]: d.preco || 0 }));
      setAnuais(prev => (prev[p.id] !== undefined ? prev : { ...prev, [p.id]: reais(d.precoAnual) }));
    }, () => {}));
    return () => unsubs.forEach(u => u());
  }, []);

  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }));
  const salvar = async () => {
    if (!cfg.mensalAtivo && !cfg.anualAtivo) { Alert.alert('Atenção', 'Deixe pelo menos uma forma de assinatura ligada.'); return; }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'assinatura'), {
        mensalAtivo: !!cfg.mensalAtivo, anualAtivo: !!cfg.anualAtivo,
        seloAnual: (cfg.seloAnual || '').trim(), textoAnual: (cfg.textoAnual || '').trim(), atualizadoEm: serverTimestamp(),
      }, { merge: true });
      const espelho = {};
      for (const p of PLANOS) {
        const v = numero(anuais[p.id]);
        await setDoc(doc(db, 'planos', String(p.id)), { precoAnual: v }, { merge: true });
        espelho[`plano${p.id}Anual`] = v > 0 ? Math.round(v * 100) : 0;
      }
      await setDoc(doc(db, 'configuracoes', 'precos'), espelho, { merge: true });
      Alert.alert('', 'Assinaturas atualizadas no app.');
    } catch (e) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar.');
    } finally { setSalvando(false); }
  };

  return (
    <View style={s.card}>
      <Text style={s.titulo}>Assinatura mensal e anual</Text>
      <Text style={s.sub}>Escolha quais formas de pagamento aparecem em Planos e o preço anual de cada plano.</Text>
      <View style={s.linha}><Text style={s.rotuloLinha}>Oferecer assinatura mensal</Text><Switch value={!!cfg.mensalAtivo} onValueChange={v => set('mensalAtivo', v)} trackColor={{ true: colors.lav4 }} /></View>
      <View style={s.linha}><Text style={s.rotuloLinha}>Oferecer assinatura anual</Text><Switch value={!!cfg.anualAtivo} onValueChange={v => set('anualAtivo', v)} trackColor={{ true: colors.lav4 }} /></View>
      <Text style={s.label}>Selo da opção anual</Text>
      <TextInput style={s.input} value={cfg.seloAnual} onChangeText={t => set('seloAnual', t)} placeholder="Ex.: 2 meses de presente" placeholderTextColor={colors.tl} />
      <Text style={s.label}>Texto curto sobre o anual (opcional)</Text>
      <TextInput style={s.input} value={cfg.textoAnual} onChangeText={t => set('textoAnual', t)} placeholder="Ex.: pague uma vez e tenha o ano todo de cuidado" placeholderTextColor={colors.tl} />
      {PLANOS.map(p => (
        <View key={p.id}>
          <Text style={s.label}>{`Plano ${p.nome} · anual (R$)${mensais[p.id] ? ` · mensal R$ ${reais(Number(mensais[p.id]).toFixed(2))}` : ''}`}</Text>
          <TextInput style={s.input} value={anuais[p.id] ?? ''} onChangeText={t => setAnuais(prev => ({ ...prev, [p.id]: t }))} keyboardType="decimal-pad"
            placeholder={mensais[p.id] ? `Vazio = ${reais((mensais[p.id] * 10).toFixed(2))}` : 'Ex.: 249,00'} placeholderTextColor={colors.tl} />
        </View>
      ))}
      <BotaoAdmin title={salvando ? 'Salvando…' : 'Salvar assinaturas'} icone="checkmark" onPress={salvar} disabled={salvando} style={{ marginTop: spacing.md }} />
    </View>
  );
}

const s = criarEstilos(() => ({
  card: { ...est.vidro(26), padding: 18, marginTop: spacing.lg, marginBottom: spacing.md },
  titulo: est.secao(),
  sub: { ...est.subtitulo(), marginBottom: 6 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  rotuloLinha: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.titulo },
  label: est.rotulo(),
  input: est.campo(),
}));
