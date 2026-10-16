import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Share } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { montarPlanoAno } from '../../ia/planoAno';

// AtravessIA — plano de ação para o ano que começa, a partir do histórico.
export default function PlanoAnoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { checkins, vitorias, datasSensiveis, usuario, temAcesso, podeUsarIA } = useApp();
  // Recurso ligado no painel, a partir do plano escolhido lá: sem acesso, vai para Planos.
  const semAcesso = !podeUsarIA('planoAno');
  useEffect(() => { if (semAcesso) navigation.replace('Planos'); }, [semAcesso, navigation]);
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [diario, setDiario] = useState([]);
  const [experiencias, setExperiencias] = useState([]);

  useEffect(() => {
    if (!uid) return undefined;
    const a = onSnapshot(collection(db, 'usuarios', uid, 'diario'), (snap) => setDiario(snap.docs.map(d => d.data())), () => {});
    const b = onSnapshot(collection(db, 'usuarios', uid, 'experiencias'), (snap) => setExperiencias(snap.docs.map(d => d.data())), () => {});
    return () => { a(); b(); };
  }, [uid]);

  const nome = usuario?.apelido || (usuario?.nome !== 'Você' ? usuario?.nome : '');
  const plano = useMemo(
    () => montarPlanoAno({ nome, checkins, vitorias, diario, experiencias, datasSensiveis }),
    [nome, checkins, vitorias, diario, experiencias, datasSensiveis],
  );

  const compartilhar = () => {
    const linhas = [plano.titulo, '', ...plano.compromissos.map(c => `• ${c.titulo}: ${c.texto}`), '', plano.fechamento];
    Share.share({ message: linhas.join('\n') }).catch(() => {});
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView contentContainerStyle={[s.conteudo, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={s.topo}>
          <TouchableOpacity style={s.iconeBtn} onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
            <Ionicons name="chevron-back" size={22} color={colors.lilasTexto} />
          </TouchableOpacity>
          <Text style={s.tituloTela}>Plano do ano</Text>
          <TouchableOpacity style={s.iconeBtn} onPress={compartilhar} disabled={plano.vazio} accessibilityLabel="Compartilhar plano">
            <Ionicons name="share-outline" size={20} color={plano.vazio ? colors.tl : colors.lilasTexto} />
          </TouchableOpacity>
        </View>

        <View style={s.heroi}>
          <LinearGradient colors={colors.escuro ? ['#7E69D6', '#B4716A'] : ['#B9A6F0', '#F3B9A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroiIcone}>
            <Ionicons name="compass-outline" size={24} color="#fff" />
          </LinearGradient>
          <Text style={s.heroiTit}>{plano.titulo}</Text>
          <Text style={s.heroiSub}>Montado pela AtravessIA a partir do que você viveu nos últimos 12 meses.</Text>
        </View>

        {plano.vazio ? (
          <View style={s.cartao}><Text style={s.texto}>{plano.fechamento}</Text></View>
        ) : (
          <>
            <Text style={s.secao}>O que o seu ano mostrou</Text>
            <View style={s.cartao}>
              {plano.resumo.map((r, i) => (
                <View key={i} style={s.resumoLinha}>
                  <View style={s.ponto} />
                  <Text style={s.texto}>{r}</Text>
                </View>
              ))}
            </View>

            <Text style={s.secao}>Seus compromissos gentis</Text>
            {plano.compromissos.map(c => (
              <View key={c.titulo} style={[s.cartao, s.compromisso]}>
                <View style={s.pilula}><Ionicons name={c.icone} size={19} color={colors.lav5} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.area}>{c.area}</Text>
                  <Text style={s.compTit}>{c.titulo}</Text>
                  <Text style={s.texto}>{c.texto}</Text>
                </View>
              </View>
            ))}

            <Text style={s.secao}>Ritmo ao longo do ano</Text>
            <View style={s.cartao}>
              {plano.estacoes.map((e, i) => (
                <View key={e.periodo} style={[s.estacao, i > 0 && s.estacaoBorda]}>
                  <Text style={s.periodo}>{e.periodo}</Text>
                  <Text style={s.foco}>{e.foco}</Text>
                  <Text style={s.textoMenor}>{e.texto}</Text>
                </View>
              ))}
            </View>

            <Text style={s.fechamento}>{plano.fechamento}</Text>
            <Text style={s.assinatura}>Com carinho, AtravessIA</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  conteudo: { paddingHorizontal: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  iconeBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  tituloTela: { fontFamily: 'Titulo', fontSize: 30, color: colors.titulo },
  heroi: { alignItems: 'center', paddingVertical: 10, marginBottom: 8 },
  heroiIcone: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  heroiTit: { fontFamily: 'Titulo', fontSize: 34, color: colors.titulo, textAlign: 'center' },
  heroiSub: { fontFamily: 'Figtree_400Regular', fontSize: 14.5, color: colors.texto2, textAlign: 'center', marginTop: 4, lineHeight: 20, paddingHorizontal: 12 },
  secao: { fontFamily: 'Figtree_700Bold', fontSize: 18, color: colors.titulo, marginTop: 14, marginBottom: 10, marginLeft: 4 },
  cartao: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz, borderRadius: 24, padding: 16, marginBottom: 10,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 2,
  },
  resumoLinha: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 4 },
  ponto: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lav4, marginTop: 8 },
  texto: { flex: 1, fontFamily: 'Figtree_400Regular', fontSize: 15, lineHeight: 22, color: colors.titulo },
  textoMenor: { fontFamily: 'Figtree_400Regular', fontSize: 13.5, lineHeight: 19, color: colors.texto2, marginTop: 2 },
  compromisso: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pilula: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lav1 },
  area: { fontFamily: 'Figtree_700Bold', fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.lilasTexto },
  compTit: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: colors.titulo, marginTop: 2, marginBottom: 4 },
  estacao: { paddingVertical: 10 },
  estacaoBorda: { borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  periodo: { fontFamily: 'Figtree_700Bold', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.lilasTexto },
  foco: { fontFamily: 'Titulo', fontSize: 21, color: colors.titulo, marginTop: 2 },
  fechamento: { fontFamily: 'TituloLeve', fontSize: 20, lineHeight: 28, color: colors.titulo, marginTop: 14, textAlign: 'center', paddingHorizontal: 8 },
  assinatura: { fontFamily: 'Figtree_600SemiBold', fontSize: 13.5, color: colors.lilasTexto, textAlign: 'center', marginTop: 10 },
}));
