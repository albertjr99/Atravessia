import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { emocoes } from '../../data';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';
import { est, acento, Degrade } from './adminEstilo';
import Recolhivel from '../../components/Recolhivel';

export default function AdminMensagensRelatorioScreen() {
  const [mensagens, setMensagens] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'configuracoes', 'mensagensRelatorio'))
      .then(snap => { if (snap.exists()) setMensagens(snap.data()); })
      .catch(() => {});
  }, []);

  const set = (id, text) => setMensagens(prev => ({ ...prev, [id]: text }));

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'mensagensRelatorio'), mensagens, { merge: true });
      Alert.alert('Salvo', 'Mensagens atualizadas com sucesso.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as mensagens.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AdminLayout currentScreen="AdminMensagens">
      <AdminSubTabs grupo="comunicacao" atual="AdminMensagens" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={sty.scroll}
      >
        <Text style={sty.sobre}>Comunicação</Text>
        <Text style={sty.pageTitle}>Mensagens dos Relatórios</Text>
        <Text style={sty.pageSub}>
          Personalize a mensagem exibida nos relatórios mensais para cada emoção predominante.
          Deixe vazio para usar o texto padrão do app.
        </Text>

        {/* Uma emoção por cartão recolhível: a tela fica curta e quem edita
            abre só a emoção que quer mudar. */}
        {emocoes.map((emo) => (
          <Recolhivel
            key={emo.id}
            titulo={emo.label}
            subtitulo={(mensagens[emo.id] || '').trim() ? 'Mensagem personalizada' : 'Usando o texto padrão do app'}
            direita={(
              <View style={sty.emoHeader}>
                <View style={[sty.emoDot, { backgroundColor: emo.dado || emo.color }]} />
                <Text style={[sty.emoType, emo.positiva && sty.emoTypePos]}>
                  {emo.positiva ? 'positiva' : 'negativa'}
                </Text>
              </View>
            )}
          >
            <TextInput
              style={sty.input}
              placeholder="Mensagem personalizada (deixe vazio para usar o padrão)"
              placeholderTextColor={colors.tl}
              value={mensagens[emo.id] || ''}
              onChangeText={v => set(emo.id, v)}
              multiline
              numberOfLines={3}
            />
          </Recolhivel>
        ))}

        <TouchableOpacity
          style={[sty.saveBtn, salvando && { opacity: 0.6 }]}
          onPress={handleSalvar}
          disabled={salvando}
        >
          <Degrade />
          <Text style={sty.saveBtnTxt}>{salvando ? 'Salvando...' : 'Salvar mensagens'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </AdminLayout>
  );
}

const sty = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },
  lista: { ...est.vidro(26), paddingVertical: 4 },
  emoBlock: { paddingVertical: 14, paddingHorizontal: 16 },
  emoDiv: est.divisoria(),
  emoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emoDot: { width: 12, height: 12, borderRadius: 6 },
  emoLabel: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo, flex: 1 },
  emoType: {
    ...est.etiquetaTxt(), color: acento('rosa').texto, backgroundColor: acento('rosa').fundo,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden',
  },
  emoTypePos: { color: acento('salvia').texto, backgroundColor: acento('salvia').fundo },
  input: { ...est.campo(), minHeight: 84, textAlignVertical: 'top', lineHeight: 21 },
  saveBtn: { ...est.botao(), marginTop: spacing.lg },
  saveBtnTxt: est.botaoTxt(),
}), { escalar: false });
