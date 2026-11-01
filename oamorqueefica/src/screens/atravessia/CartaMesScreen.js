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
  const { checkins, vitorias, usuario, temAcesso, podeUsarIA } = useApp();
  // Recurso ligado no painel, a partir do plano escolhido lá: sem acesso, vai para Planos.
  const semAcesso = !podeUsarIA('cartaMes');
  useEffect(() => { if (semAcesso) navigation.replace('Planos'); }, [semAcesso, navigation]);
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const meses = useMemo(ultimosMeses, []);
  const [sel, setSel] = useState(0);
  const [diario, setDiario] = useState([]);
  const [experiencias, setExperiencias] = useState([]);

  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(collection(db, 'usuarios', uid, 'diario'),
      (snap) => setDiario(snap.docs.map(d => d.data())),
      (e) => console.warn('[Carta] diário:', e?.message));
  }, [uid]);
  // Memórias guardadas no Experimente a vida.
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(collection(db, 'usuarios', uid, 'experiencias'),
      (snap) => setExperiencias(snap.docs.map(d => d.data())),
      () => {});
  }, [uid]);

  const nome = usuario?.apelido || (usuario?.nome !== 'Você' ? usuario?.nome : '');
  const { ano, mes } = meses[sel];
  const carta = useMemo(
    () => montarCarta({ nome, ano, mes, checkins, vitorias, diario, experiencias }),
    [nome, ano, mes, checkins, vitorias, diario, experiencias],
  );

  const compartilhar = () => {
    Share.share({ message: `${carta.titulo}\n\n${carta.paragrafos.join('\n\n')}` }).catch(() => {});
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Carta do mês</Text>
        <TouchableOpacity onPress={compartilhar} style={[s.backBtn, carta.vazio && { opacity: 0.5 }]} accessibilityLabel="Compartilhar carta" disabled={carta.vazio}>
          <Ionicons name="share-outline" size={20} color={carta.vazio ? colors.tl : colors.lilasIcone} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <View style={s.coluna}>
          <View style={s.trilho}>
            <View style={s.meses}>
              {meses.map((m, i) => (
                <TouchableOpacity key={m.rotulo} style={[s.mes, i === sel && s.mesSel]} onPress={() => setSel(i)} accessibilityState={{ selected: i === sel }}>
                  <Text style={[s.mesTxt, i === sel && s.mesTxtSel]}>{m.rotulo}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

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
            <View style={s.selo}><Ionicons name="mail-open-outline" size={20} color={colors.roseTexto} /></View>
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
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 1,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 28, color: colors.titulo },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  coluna: { width: '100%', gap: spacing.md },
  // Meses num trilho de vidro (o escolhido em branco sólido)
  trilho: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz },
  meses: { padding: 4, gap: 4, flexDirection: 'row', flexWrap: 'wrap' }, // meses quebram linha, sem arrastar
  mes: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 15, borderRadius: radius.full },
  mesSel: {
    backgroundColor: colors.escuro ? colors.lav2 : colors.cardSolido,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 1,
  },
  mesTxt: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2 },
  mesTxtSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
  numeros: {
    flexDirection: 'row', backgroundColor: colors.card, borderRadius: 24, paddingVertical: spacing.md,
    borderWidth: 1, borderColor: colors.bordaLuz,
  },
  numero: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  numeroBorda: { borderLeftWidth: 1, borderLeftColor: colors.bordaSuave },
  numeroV: { fontFamily: fonts.bodyBold, fontSize: 26, color: colors.lilasTexto },
  numeroR: { fontFamily: fonts.body, fontSize: 11.5, color: colors.texto2, textAlign: 'center' },
  // A carta: papel de vidro forte, corpo em Cormorant itálico grande para leitura confortável
  papel: {
    backgroundColor: colors.vidroForte, borderRadius: 28, borderWidth: 1, borderColor: colors.bordaLuz,
    paddingVertical: spacing.xl, paddingHorizontal: spacing.xl, gap: 14,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 14 }, shadowOpacity: colors.escuro ? 0.4 : 0.14, shadowRadius: 26, elevation: 3,
  },
  selo: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.roseFundo, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  titulo: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 37, color: colors.titulo, textAlign: 'center', marginBottom: 4 },
  paragrafo: { fontFamily: fonts.serifItalic, fontSize: 21, lineHeight: 31, color: colors.titulo },
  saudacao: { fontFamily: fonts.serif },
  assinatura: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 30, color: colors.lilasTexto, textAlign: 'right' },
  nota: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', lineHeight: 18 },
}));
