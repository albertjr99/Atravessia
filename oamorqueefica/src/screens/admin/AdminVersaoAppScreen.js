import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, Switch } from 'react-native';
import Constants from 'expo-constants';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, BotaoAdmin } from './adminEstilo';
import AdminLayout from './AdminLayout';

const VERSAO_RE = /^\d+(\.\d+){0,3}$/;

// Controle do aviso de atualização do app. Documento: configuracoes/versaoApp.
// versaoRecente → convite com "Depois"; versaoMinima ou obrigatoria → sem "Depois".
export default function AdminVersaoAppScreen({ navigation }) {
  const [form, setForm] = useState({ versaoMinima: '', versaoRecente: '', obrigatoria: false, novidades: '' });
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const versaoAqui = Constants.expoConfig?.version || '';

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'versaoApp'), (snap) => {
    if (carregado) return;
    const d = snap.data() || {};
    setForm({
      versaoMinima: d.versaoMinima || '',
      versaoRecente: d.versaoRecente || '',
      obrigatoria: d.obrigatoria === true,
      novidades: d.novidades || '',
    });
    setCarregado(true);
  }, () => setCarregado(true)), [carregado]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const salvar = async () => {
    const versaoMinima = form.versaoMinima.trim();
    const versaoRecente = form.versaoRecente.trim();
    if ((versaoMinima && !VERSAO_RE.test(versaoMinima)) || (versaoRecente && !VERSAO_RE.test(versaoRecente))) {
      Alert.alert('Atenção', 'Use o formato de versão com números e pontos, por exemplo 1.19.12.');
      return;
    }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'versaoApp'), {
        versaoMinima,
        versaoRecente,
        obrigatoria: !!form.obrigatoria,
        novidades: form.novidades.trim(),
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      Alert.alert('', 'Aviso de versão publicado no app.');
    } catch (e) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminVersaoApp">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
        <Text style={s.sobre}>Configuração</Text>
        <Text style={s.pageTitle}>Versão do app</Text>
        <Text style={s.pageSub}>
          Depois de publicar uma versão nova na Play Store, atualize aqui para avisar as usuárias.
          Quem estiver com uma versão mais antiga verá um convite para atualizar ao abrir o app.
        </Text>

        <View style={s.card}>
          <Text style={s.secao}>Versões</Text>
          <Text style={s.label}>Versão mais recente na loja</Text>
          <TextInput style={s.input} value={form.versaoRecente} onChangeText={t => set('versaoRecente', t)}
            autoCapitalize="none" keyboardType="numbers-and-punctuation" placeholder="Ex.: 1.19.12" placeholderTextColor={colors.tl} />
          <Text style={s.dica}>Quem tiver uma versão anterior recebe o convite, com a opção "Depois" (volta a lembrar em 24 h).</Text>

          <Text style={[s.label, { marginTop: 14 }]}>Versão mínima</Text>
          <TextInput style={s.input} value={form.versaoMinima} onChangeText={t => set('versaoMinima', t)}
            autoCapitalize="none" keyboardType="numbers-and-punctuation" placeholder="Ex.: 1.19.0" placeholderTextColor={colors.tl} />
          <Text style={s.dica}>Abaixo desta versão, a atualização é obrigatória (o aviso não tem "Depois").</Text>

          <View style={s.linha}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.label}>Tornar a versão mais recente obrigatória</Text>
              <Text style={s.dica}>Use só para correções importantes: todas precisarão atualizar para continuar.</Text>
            </View>
            <Switch value={form.obrigatoria} onValueChange={v => set('obrigatoria', v)}
              trackColor={{ true: colors.lav4 }} accessibilityLabel="Atualização obrigatória" />
          </View>
          {!!versaoAqui && <Text style={s.dica}>Versão instalada neste aparelho: {versaoAqui}</Text>}
        </View>

        <View style={s.card}>
          <Text style={s.secao}>O que há de novo</Text>
          <Text style={s.label}>Novidades (aparece no aviso)</Text>
          <TextInput style={[s.input, s.multi]} value={form.novidades} onChangeText={t => set('novidades', t)}
            multiline textAlignVertical="top" placeholder="Ex.: Check-in mais rápido, novos áudios e correções." placeholderTextColor={colors.tl} />
        </View>

        <BotaoAdmin title={salvando ? 'Salvando…' : 'Salvar e publicar'} icone="checkmark" onPress={salvar} disabled={salvando || !carregado} />
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },
  card: { ...est.vidro(26), padding: 18, marginBottom: spacing.md },
  secao: { ...est.secao(), marginBottom: 10 },
  label: { ...est.rotulo(), marginTop: 6 },
  input: est.campo(),
  multi: { minHeight: 120, maxHeight: 280, paddingTop: 12 },
  dica: { fontFamily: fonts.body, fontSize: 12.5, color: colors.texto2, marginTop: 6 },
  linha: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
}));
