import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { colors, criarEstilos } from '../theme';
import { useAuth } from '../hooks/AuthContext';
import { hojeStrBR } from '../utils/date';

export const PERGUNTA_MEMORIA = 'Ao experimentar a vida hoje, que sensação boa você gostaria de guardar na memória?';

// Campo opcional do Experimente a vida: depois de um serviço de parceria, a
// pessoa pode guardar a sensação boa que viveu. O texto aparece na Carta do mês.
// `parcerias` (opcional) permite marcar com qual parceria foi a experiência.
export default function MemoriaExperiencia({ parcerias = [] }) {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [texto, setTexto] = useState('');
  const [parceria, setParceria] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const guardar = async () => {
    const t = texto.trim();
    if (!t || !uid) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, 'usuarios', uid, 'experiencias'), {
        texto: t.slice(0, 600),
        parceria: parceria?.titulo || null,
        parceriaId: parceria?.id || null,
        data: hojeStrBR(),
        criadoEm: serverTimestamp(),
      });
      setTexto(''); setParceria(null); setSalvo(true);
    } catch (e) {
      Alert.alert('Não foi possível guardar', e?.message || 'Tente novamente em instantes.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <View style={s.cartao}>
      <View style={s.topo}>
        <View style={s.pilula}><Ionicons name="sparkles-outline" size={18} color={colors.joiaPessegoTexto} /></View>
        <Text style={s.sobretitulo}>Guardar na memória · opcional</Text>
      </View>
      <Text style={s.pergunta}>{PERGUNTA_MEMORIA}</Text>

      {parcerias.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {parcerias.slice(0, 12).map(p => {
            const sel = parceria?.id === p.id;
            return (
              <TouchableOpacity key={p.id} style={[s.chip, sel && s.chipSel]} onPress={() => setParceria(sel ? null : p)} activeOpacity={0.8}>
                <Text style={[s.chipTxt, sel && s.chipTxtSel]} numberOfLines={1}>{p.titulo}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <TextInput
        style={s.input}
        value={texto}
        onChangeText={(t) => { setTexto(t); if (salvo) setSalvo(false); }}
        placeholder="Escreva com suas palavras, se quiser…"
        placeholderTextColor={colors.tl}
        multiline
        numberOfLines={4}
        maxLength={600}
        textAlignVertical="top"
      />
      {salvo ? (
        <View style={s.salvo}>
          <Ionicons name="checkmark-circle" size={18} color={colors.sageFg} />
          <Text style={s.salvoTxt}>Guardado. Essa lembrança vai aparecer na sua Carta do mês.</Text>
        </View>
      ) : (
        <TouchableOpacity style={[s.botao, !texto.trim() && s.botaoOff]} onPress={guardar} disabled={!texto.trim() || salvando} activeOpacity={0.85}>
          {salvando ? <ActivityIndicator color={colors.joiaPessegoTexto} /> : <Text style={s.botaoTxt}>Guardar memória</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = criarEstilos(() => ({
  cartao: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz, borderRadius: 26, padding: 18, marginBottom: 16,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 3,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  pilula: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.joiaPessego[1] },
  sobretitulo: { fontFamily: 'Figtree_700Bold', fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.lilasTexto },
  pergunta: { fontFamily: 'Titulo', fontSize: 22, lineHeight: 28, color: colors.titulo, marginBottom: 12 },
  chips: { gap: 8, paddingBottom: 10 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.vidroTenue, borderWidth: 1, borderColor: colors.lav2, maxWidth: 200 },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  chipTxt: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: colors.texto2 },
  chipTxtSel: { color: colors.lilasTexto, fontFamily: 'Figtree_700Bold' },
  input: {
    minHeight: 104, borderRadius: 16, padding: 14, backgroundColor: colors.cardSolido,
    borderWidth: 1, borderColor: colors.border, fontFamily: 'Figtree_400Regular', fontSize: 15.5, lineHeight: 22, color: colors.titulo,
  },
  botao: { marginTop: 12, alignItems: 'center', paddingVertical: 13, borderRadius: 999, backgroundColor: colors.joiaPessego[1] },
  botaoOff: { opacity: 0.55 },
  botaoTxt: { fontFamily: 'Figtree_700Bold', fontSize: 15, color: colors.joiaPessegoTexto },
  salvo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  salvoTxt: { flex: 1, fontFamily: 'Figtree_500Medium', fontSize: 13.5, color: colors.sageFg },
}));
