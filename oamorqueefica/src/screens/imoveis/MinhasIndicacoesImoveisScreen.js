import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/AuthContext';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { STATUS_LEAD, FASES_LEAD, indiceFase, TEXTO_BENEFICIO, dataTexto, dataHoraTexto } from '../../utils/imoveis';
import { TopoImoveis, tomDe } from './comum';

// "Minhas indicações" de imóveis: cada indicação com o status e o avanço.
export default function MinhasIndicacoesImoveisScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [leads, setLeads] = useState(null);

  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(query(collection(db, 'indicacoesImoveis'), where('uid', '==', uid)), (snap) => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0)));
    }, () => setLeads([]));
  }, [uid]);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <TopoImoveis titulo="Minhas indicações" onVoltar={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={s.beneficio}>
          <Ionicons name="gift-outline" size={18} color={colors.sageFg} />
          <Text style={s.beneficioTxt}>{TEXTO_BENEFICIO}</Text>
        </View>

        {leads === null ? (
          <ActivityIndicator color={colors.lav4} style={{ marginTop: 30 }} />
        ) : leads.length === 0 ? (
          <View style={s.vazio}>
            <View style={s.vazioIcone}><Ionicons name="key-outline" size={30} color={colors.lilasIcone} /></View>
            <Text style={s.vazioTit}>Nenhuma indicação ainda</Text>
            <Text style={s.vazioSub}>Quando você demonstrar interesse em uma imobiliária parceira, acompanhe tudo por aqui.</Text>
            <TouchableOpacity style={s.vazioBtn} onPress={() => navigation.navigate('LarRecomeco')}>
              <Text style={s.vazioBtnTxt}>Ver imobiliárias parceiras</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lilasTexto} />
            </TouchableOpacity>
          </View>
        ) : leads.map(l => {
          const info = STATUS_LEAD[l.status] || STATUS_LEAD.novo;
          const tom = tomDe(info.tom);
          const idx = indiceFase(l.status);
          const progresso = l.status === 'perdido' ? 0 : Math.max(0, idx) / (FASES_LEAD.length - 1);
          return (
            <TouchableOpacity key={l.id} style={[s.card, l.status === 'perdido' && { opacity: 0.75 }]} activeOpacity={0.88}
              onPress={() => navigation.navigate('IndicacaoImovel', { leadId: l.id })}>
              <View style={[s.icone, { backgroundColor: tom.fundo }]}><Ionicons name={info.icone} size={20} color={tom.tinta} /></View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={s.nome} numberOfLines={1}>{l.imobiliariaNome}</Text>
                <Text style={s.det} numberOfLines={1}>{l.imovelTitulo || (l.interesse === 'alugar' ? 'Quero alugar' : 'Quero comprar')} · {l.codigo}</Text>
                <View style={[s.chip, { backgroundColor: tom.fundo }]}><Text style={[s.chipTxt, { color: tom.tinta }]}>{info.rotulo}</Text></View>
                {l.status !== 'perdido' && (
                  <View style={s.barra}><View style={[s.barraCheia, { width: `${Math.round(progresso * 100)}%` }]} /></View>
                )}
                {l.consultoria?.status === 'agendada'
                  ? <Text style={[s.det, { color: colors.sageFg }]}>Consultoria: {dataHoraTexto(l.consultoria.data)}</Text>
                  : <Text style={s.data}>Enviada em {dataTexto(l.criadoEm)}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.tl} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  beneficio: { flexDirection: 'row', gap: 10, backgroundColor: colors.sageFundo, borderRadius: 18, padding: 14, marginTop: spacing.sm, marginBottom: spacing.md },
  beneficioTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.sageFg },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 22,
    borderWidth: 1, borderColor: colors.bordaLuz, padding: 14, marginBottom: 12,
  },
  icone: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  nome: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo },
  det: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2 },
  chip: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  chipTxt: { fontFamily: fonts.bodyBold, fontSize: 11.5 },
  barra: { height: 6, borderRadius: 3, backgroundColor: colors.lav1, overflow: 'hidden', marginTop: 6 },
  barraCheia: { height: 6, borderRadius: 3, backgroundColor: colors.lav4 },
  data: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tl, marginTop: 2 },
  vazio: { alignItems: 'center', gap: 10, paddingTop: 40 },
  vazioIcone: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  vazioTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo },
  vazioSub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', lineHeight: 21, maxWidth: 320 },
  vazioBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 22, borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro, marginTop: 6 },
  vazioBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
}));
