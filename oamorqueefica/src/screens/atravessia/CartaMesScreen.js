import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Share } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { montarCarta } from '../../ia/carta';

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Os últimos 6 meses, do atual para trás.
function ultimosMeses() {
  const hoje = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), rotulo: i === 0 ? 'Este mês' : `${MESES_CURTOS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` };
  });
}

export default function CartaMesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { checkins, vitorias, usuario } = useApp();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const meses = useMemo(ultimosMeses, []);
  const [sel, setSel] = useState(0);
  const [diario, setDiario] = useState([]);

  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(collection(db, 'usuarios', uid, 'diario'),
      (snap) => setDiario(snap.docs.map(d => d.data())),
      (e) => console.warn('[Carta] diário:', e?.message));
  }, [uid]);

  const nome = usuario?.apelido || (usuario?.nome !== 'Você' ? usuario?.nome : '');
  const { ano, mes } = meses[sel];
  const carta = useMemo(
    () => montarCarta({ nome, ano, mes, checkins, vitorias, diario }),
    [nome, ano, mes, checkins, vitorias, diario],
  );

  const compartilhar = () => {
    Share.share({ message: `${carta.titulo}\n\n${carta.paragrafos.join('\n\n')}` }).catch(() => {});
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconeBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Carta do mês</Text>
        <TouchableOpacity onPress={compartilhar} style={s.iconeBtn} accessibilityLabel="Compartilhar carta" disabled={carta.vazio}>
          <Ionicons name="share-outline" size={21} color={carta.vazio ? colors.tl : colors.lav5} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <View style={s.coluna}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.meses}>
            {meses.map((m, i) => (
              <TouchableOpacity key={m.rotulo} style={[s.mes, i === sel && s.mesSel]} onPress={() => setSel(i)}>
                <Text style={[s.mesTxt, i === sel && s.mesTxtSel]}>{m.rotulo}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {!carta.vazio && (
            <View style={s.numeros}>
              {[
                { v: carta.numeros.dias, r: 'dias com check-in' },
                { v: carta.numeros.vitorias, r: 'vitórias' },
                { v: carta.numeros.diario, r: 'páginas no diário' },
              ].map((n, i) => (
                <View key={n.r} style={[s.numero, i > 0 && s.numeroBorda]}>
                  <Text style={s.numeroV}>{n.v}</Text>
                  <Text style={s.numeroR}>{n.r}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.papel}>
            <View style={s.selo}><Ionicons name="mail-open-outline" size={18} color={colors.lav5} /></View>
            <Text style={s.titulo}>{carta.titulo}</Text>
            {carta.paragrafos.map((p, i) => (
              <Text key={i} style={[s.paragrafo, i === 0 && s.saudacao, i === carta.paragrafos.length - 1 && s.assinatura]}>{p}</Text>
            ))}
          </View>
          <Text style={s.nota}>Escrita com carinho pela AtravessIA a partir do que você viveu e registrou no mês.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingBottom: 6 },
  iconeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  coluna: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: spacing.md },
  meses: { gap: 8 },
  mes: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  mesSel: { backgroundColor: colors.botaoForte, borderColor: colors.botaoForte },
  mesTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.td },
  mesTxtSel: { fontFamily: fonts.bodyBold, color: 'white' },
  numeros: { flexDirection: 'row', backgroundColor: colors.lav1, borderRadius: radius.xl, paddingVertical: spacing.md },
  numero: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  numeroBorda: { borderLeftWidth: 1, borderLeftColor: colors.lav2 },
  numeroV: { fontFamily: fonts.serif, fontSize: 24, color: colors.lav6 },
  numeroR: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tm, textAlign: 'center' },
  papel: {
    backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: 12,
  },
  selo: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  titulo: { fontFamily: fonts.serif, fontSize: 23, color: colors.lav6, textAlign: 'center', marginBottom: 4 },
  paragrafo: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 25, color: colors.td },
  saudacao: { fontFamily: fonts.bodyBold },
  assinatura: { fontFamily: fonts.quote, fontSize: 18, lineHeight: 26, color: colors.lav5 },
  nota: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center' },
}));
