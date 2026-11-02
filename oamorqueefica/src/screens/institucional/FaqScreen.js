import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import Recolhivel from '../../components/Recolhivel';
import TextoComLinks from '../../components/TextoComLinks';

// Perguntas frequentes (coleção faq, editada em "Sobre e parcerias" no
// painel). Só as publicadas aparecem; busca por pergunta, resposta e categoria.
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function FaqScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [itens, setItens] = useState(null);
  const [busca, setBusca] = useState('');

  useEffect(() => onSnapshot(
    query(collection(db, 'faq'), where('publicado', '==', true)),
    (snap) => setItens(snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999))),
    (e) => { console.warn('[FAQ]', e?.message); setItens([]); },
  ), []);

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    if (!termo) return itens || [];
    return (itens || []).filter(q => semAcento(`${q.pergunta} ${q.resposta} ${q.categoria || ''}`).includes(termo));
  }, [itens, busca]);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.conteudo, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}>
        <View style={s.topo}>
          <TouchableOpacity style={s.voltar} onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
            <Ionicons name="chevron-back" size={22} color={colors.lilasTexto} />
          </TouchableOpacity>
          <Text style={s.tituloTela} numberOfLines={1}>Perguntas frequentes</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={s.buscaCaixa}>
          <Ionicons name="search-outline" size={18} color={colors.texto2} />
          <TextInput
            style={s.buscaInput}
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar uma dúvida"
            placeholderTextColor={colors.tl}
            returnKeyType="search"
            accessibilityLabel="Buscar nas perguntas frequentes"
          />
          {!!busca && (
            <TouchableOpacity onPress={() => setBusca('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Limpar busca">
              <Ionicons name="close-circle" size={18} color={colors.texto2} />
            </TouchableOpacity>
          )}
        </View>

        {itens === null ? (
          <ActivityIndicator color={colors.lilasTexto} style={{ marginTop: 32 }} />
        ) : filtrados.length === 0 ? (
          <View style={s.vazio}>
            <Ionicons name="help-circle-outline" size={32} color={colors.lilasTexto} />
            <Text style={s.vazioTxt}>
              {busca.trim() ? 'Nenhuma pergunta encontrada para essa busca.' : 'Ainda não há perguntas por aqui. Em breve!'}
            </Text>
          </View>
        ) : (
          filtrados.map(q => (
            <Recolhivel key={q.id} titulo={q.pergunta} subtitulo={q.categoria || undefined}>
              <TextoComLinks style={s.resposta} selectable>{q.resposta}</TextoComLinks>
            </Recolhivel>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  conteudo: { paddingHorizontal: 16, width: '100%', maxWidth: 760, alignSelf: 'center' },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8 },
  voltar: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  tituloTela: { flex: 1, textAlign: 'center', fontFamily: 'Titulo', fontSize: 28, color: colors.titulo },
  buscaCaixa: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 14, marginBottom: 14,
    borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  buscaInput: { flex: 1, fontFamily: 'Figtree_400Regular', fontSize: 15, color: colors.titulo, paddingVertical: 10 },
  resposta: { fontFamily: 'Figtree_400Regular', fontSize: 15, lineHeight: 23, color: colors.titulo },
  vazio: { alignItems: 'center', gap: 10, paddingVertical: 36, paddingHorizontal: 20 },
  vazioTxt: { fontFamily: 'Figtree_500Medium', fontSize: 15, color: colors.texto2, textAlign: 'center' },
}));
