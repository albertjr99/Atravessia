import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import MemoriaExperiencia from '../../components/MemoriaExperiencia';
import { useAuth } from '../../hooks/AuthContext';
import { formatDataBR } from '../../utils/date';

// Experimente a vida › Guardar na memória: a pergunta, o campo e as memórias já guardadas.
export default function GuardarMemoriaScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [memorias, setMemorias] = useState([]);

  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(collection(db, 'usuarios', uid, 'experiencias'), (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => (m.texto || '').trim());
      lista.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
      setMemorias(lista);
    }, () => {});
  }, [uid]);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.conteudo, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
          <View style={s.topo}>
            <TouchableOpacity style={s.voltar} onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
              <Ionicons name="chevron-back" size={22} color={colors.lilasTexto} />
            </TouchableOpacity>
            <Text style={s.titulo} numberOfLines={1}>Guardar na memória</Text>
            <View style={{ width: 44 }} />
          </View>
          <Text style={s.sub}>Um espaço só seu para guardar as sensações boas que você viveu. Elas aparecem na sua Carta do mês.</Text>

          <MemoriaExperiencia />

          {memorias.length > 0 && (
            <>
              <Text style={s.secao}>Memórias guardadas</Text>
              <View style={s.lista}>
                {memorias.map((m, i) => (
                  <View key={m.id} style={[s.item, i > 0 && s.itemBorda]}>
                    <Text style={s.data}>{formatDataBR(m.data)}</Text>
                    <Text style={s.texto}>{m.texto}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  conteudo: { paddingHorizontal: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  voltar: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  titulo: { flex: 1, textAlign: 'center', fontFamily: 'Titulo', fontSize: 30, color: colors.titulo },
  sub: { fontFamily: 'Figtree_400Regular', fontSize: 14.5, lineHeight: 21, color: colors.texto2, marginBottom: 16, textAlign: 'center', paddingHorizontal: 8 },
  secao: { fontFamily: 'Figtree_700Bold', fontSize: 18, color: colors.titulo, marginTop: 8, marginBottom: 10, marginLeft: 4 },
  lista: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz, borderRadius: 24, paddingHorizontal: 16,
  },
  item: { paddingVertical: 14 },
  itemBorda: { borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  data: { fontFamily: 'Figtree_700Bold', fontSize: 12, letterSpacing: 1, color: colors.lilasTexto },
  texto: { fontFamily: 'Figtree_400Regular', fontSize: 15, lineHeight: 22, color: colors.titulo, marginTop: 4 },
}));
