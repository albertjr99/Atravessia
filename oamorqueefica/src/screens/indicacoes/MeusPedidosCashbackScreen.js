import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useAuth } from '../../hooks/AuthContext';
import { useApp } from '../../hooks/AppContext';
import { urlDeImagem } from '../../utils/imagemUrl';
import { brlCentavos } from '../../utils/afiliados';

// "Meus pedidos de cashback": acompanha os pedidos enviados pelos Achados da
// Atravessia (Em análise / Aprovado — R$ X creditado / Recusado — motivo).
// Mesmos tons de acento do painel (claro / escuro).
const corStatus = (status) => {
  const e = colors.escuro;
  return ({
    pendente: { icone: 'time-outline', fundo: e ? 'rgba(229,198,139,0.14)' : '#F7EBD3', texto: e ? '#EED6A6' : '#765619' },
    aprovado: { icone: 'checkmark-circle', fundo: e ? 'rgba(159,208,176,0.14)' : '#E1EEE5', texto: e ? '#B7DEC4' : '#3D6A4E' },
    recusado: { icone: 'close-circle', fundo: e ? 'rgba(242,162,188,0.14)' : '#F9E1E9', texto: e ? '#F6BDD0' : '#9C4463' },
  })[status] || null;
};
const dataTexto = (ts) => (ts?.toDate ? ts.toDate().toLocaleDateString('pt-BR') : '');

export default function MeusPedidosCashbackScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const { cashbackVisivel } = useApp();
  const uid = firebaseUser?.uid;
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(query(collection(db, 'pedidosCashbackAfiliado'), where('usuarioId', '==', uid)), (snap) => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0)));
      setCarregando(false);
    }, () => setCarregando(false));
  }, [uid]);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Meus pedidos</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Acompanhe aqui os pedidos de cashback das compras feitas pelos Achados da Atravessia.</Text>

        {!cashbackVisivel && (
          <View style={s.aviso}><Text style={s.avisoTxt}>O cashback está pausado no momento. Seus pedidos continuam guardados.</Text></View>
        )}

        {carregando ? <ActivityIndicator color={colors.lav4} style={{ marginTop: spacing.lg }} /> : pedidos.length === 0 ? (
          <View style={s.vazio}>
            <View style={s.vazioIcone}><Ionicons name="receipt-outline" size={28} color={colors.lilasIcone} /></View>
            <Text style={s.vazioTit}>Nenhum pedido ainda</Text>
            <Text style={s.vazioTxt}>Quando comprar um achado com cashback, toque em “Já comprei — pedir meu cashback” no cartão do produto.</Text>
          </View>
        ) : pedidos.map(p => {
          const st = corStatus(p.status) || corStatus('pendente');
          const img = urlDeImagem(p.itemImagemUrl);
          return (
            <View key={p.id} style={s.card}>
              <View style={s.linha}>
                <View style={s.thumb}>
                  {img ? <Image source={{ uri: img }} style={s.thumbImg} resizeMode="contain" /> : <Ionicons name="gift-outline" size={22} color={colors.lilasIcone} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.titulo} numberOfLines={2}>{p.itemTitulo}</Text>
                  <Text style={s.sub}>{p.plataforma} · pedido {p.numeroPedido} · {dataTexto(p.criadoEm)}</Text>
                  <Text style={s.sub}>Valor informado: {brlCentavos(p.valorCentavos)}</Text>
                </View>
              </View>
              <View style={[s.status, { backgroundColor: st.fundo }]}>
                <Ionicons name={st.icone} size={18} color={st.texto} />
                <Text style={[s.statusTxt, { color: st.texto }]}>
                  {p.status === 'aprovado' ? `Aprovado — ${brlCentavos(p.cashbackCentavos)} creditado`
                    : p.status === 'recusado' ? 'Recusado'
                      : `Em análise — previsão de ${brlCentavos(p.cashbackPrevistoCentavos)}`}
                </Text>
              </View>
              {p.status === 'recusado' && !!p.motivo && <Text style={s.motivo}>Motivo: {p.motivo}</Text>}
              {p.status === 'aprovado' && (
                <TouchableOpacity onPress={() => navigation.navigate('Cashback')} hitSlop={8}>
                  <Text style={s.link}>Ver meu saldo de cashback</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: spacing.lg, paddingBottom: 8 },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 28, color: colors.titulo },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, width: '100%', maxWidth: 720, alignSelf: 'center' },
  intro: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.texto2, textAlign: 'center' },
  aviso: { backgroundColor: colors.vidroTenue, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.bordaLuz },
  avisoTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, textAlign: 'center' },
  vazio: { alignItems: 'center', gap: 8, padding: spacing.xl },
  vazioIcone: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  vazioTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo },
  vazioTxt: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.texto2, textAlign: 'center' },
  card: {
    backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz, padding: 14, gap: 10,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2,
  },
  linha: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 58, height: 58, borderRadius: 16, backgroundColor: colors.escuro ? colors.vidroTenue : '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: 52, height: 52 },
  titulo: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.texto2, marginTop: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  statusTxt: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13.5 },
  motivo: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.texto2 },
  link: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.lilasTexto },
}));
