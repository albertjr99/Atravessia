import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert } from 'react-native';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, BotaoAdmin } from './adminEstilo';
import AdminLayout from './AdminLayout';

// Textos das telas "Sobre o app" e "Seja nosso parceiro" (com o link do
// formulário de parceria). Documento: configuracoes/institucional.
export default function AdminInstitucionalScreen({ navigation }) {
  const [form, setForm] = useState({ sobreTexto: '', parceiroTexto: '', parceiroLink: '' });
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'institucional'), (snap) => {
    if (carregado) return;
    const d = snap.data() || {};
    setForm({ sobreTexto: d.sobreTexto || '', parceiroTexto: d.parceiroTexto || '', parceiroLink: d.parceiroLink || '' });
    setCarregado(true);
  }, () => setCarregado(true)), [carregado]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const salvar = async () => {
    const link = form.parceiroLink.trim();
    if (link && !/^https?:\/\//i.test(link)) { Alert.alert('Atenção', 'O link precisa começar com https://'); return; }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'institucional'), {
        sobreTexto: form.sobreTexto.trim(),
        parceiroTexto: form.parceiroTexto.trim(),
        parceiroLink: link,
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      Alert.alert('', 'Textos publicados no app.');
    } catch (e) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminInstitucional">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
        <Text style={s.sobre}>Configuração</Text>
        <Text style={s.pageTitle}>Sobre e parcerias</Text>
        <Text style={s.pageSub}>Textos de "Sobre o app" e "Seja nosso parceiro". Campo vazio mostra o texto padrão no app.</Text>

        <View style={s.card}>
          <Text style={s.secao}>Sobre o app</Text>
          <Text style={s.label}>O que é o Atravessia</Text>
          <TextInput style={[s.input, s.multi]} value={form.sobreTexto} onChangeText={t => set('sobreTexto', t)}
            multiline textAlignVertical="top" placeholder="Conte o que é o app e como ele acolhe." placeholderTextColor={colors.tl} />
        </View>

        <View style={s.card}>
          <Text style={s.secao}>Seja nosso parceiro</Text>
          <Text style={s.label}>Texto-convite</Text>
          <TextInput style={[s.input, s.multi]} value={form.parceiroTexto} onChangeText={t => set('parceiroTexto', t)}
            multiline textAlignVertical="top" placeholder="Explique como funciona a parceria." placeholderTextColor={colors.tl} />
          <Text style={s.label}>Link do formulário (Google Forms)</Text>
          <TextInput style={s.input} value={form.parceiroLink} onChangeText={t => set('parceiroLink', t)}
            autoCapitalize="none" keyboardType="url" placeholder="https://forms.gle/..." placeholderTextColor={colors.tl} />
          <Text style={s.dica}>No app, o botão "Quero ser parceiro" abre este link. Sem link, o botão não aparece.</Text>
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
  multi: { minHeight: 140, maxHeight: 320, paddingTop: 12 },
  dica: { fontFamily: fonts.body, fontSize: 12.5, color: colors.texto2, marginTop: 6 },
}));
