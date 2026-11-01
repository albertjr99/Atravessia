import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import Recolhivel from '../../components/Recolhivel';
import { useAuth } from '../../hooks/AuthContext';
import {
  useMeusAtendimentos, separar, salaAberta, dataHora, ms, LIBERA_MIN,
} from '../../utils/atendimentos';

// Atendimentos online da usuária (convites aceitos pelo link). Entrar na sala
// abre a SalaAtendimento (WebView; na versão web, nova aba).
export default function MeusAtendimentosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const lista = useMeusAtendimentos(firebaseUser?.uid);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30000); return () => clearInterval(t); }, []);
  const { proximos, passados } = useMemo(() => separar(lista || [], agora), [lista, agora]);

  const cartao = (a, passado) => {
    const aberta = salaAberta(a, agora);
    return (
      <View key={a.id} style={[s.card, passado && s.cardPassado]}>
        <View style={s.cardTopo}>
          <View style={s.icone}><Ionicons name={a.tipo === 'grupo' ? 'people-outline' : 'videocam-outline'} size={21} color={colors.lilasTexto} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.quando}>{dataHora(ms(a.inicio))} · {a.duracaoMin} min</Text>
            <Text style={s.titulo}>{a.titulo}</Text>
            <Text style={s.com}>Com {a.profissionalNome}{a.crp ? ` · CRP ${a.crp}` : ''}</Text>
            {a.status === 'cancelado' && <Text style={s.cancelado}>Cancelado</Text>}
          </View>
        </View>
        {!passado && a.status === 'agendado' && (
          <>
            <TouchableOpacity
              style={[s.botao, !aberta && s.botaoOff]} disabled={!aberta} activeOpacity={0.85}
              onPress={() => navigation.navigate('SalaAtendimento', { atendimentoId: a.id })}
              accessibilityRole="button" accessibilityLabel="Entrar na sala"
            >
              <Ionicons name="videocam" size={18} color="#FFFFFF" />
              <Text style={s.botaoTxt}>Entrar na sala</Text>
            </TouchableOpacity>
            {!aberta && <Text style={s.dica}>A sala abre {LIBERA_MIN} minutos antes do horário.</Text>}
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Meus atendimentos</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: spacing.xxl + insets.bottom }]}>
        {lista === null ? <ActivityIndicator color={colors.lav4} style={{ marginTop: 40 }} />
          : proximos.length === 0 && passados.length === 0 ? (
            <View style={s.vazio}>
              <Ionicons name="videocam-outline" size={34} color={colors.lilasTexto} />
              <Text style={s.vazioTit}>Nenhum atendimento por aqui</Text>
              <Text style={s.vazioSub}>Quando sua psicóloga enviar um convite e você aceitar pelo link, o atendimento aparece nesta tela.</Text>
            </View>
          ) : (
            <>
              <View style={s.aviso}>
                <Ionicons name="headset-outline" size={18} color={colors.lilasTexto} />
                <Text style={s.avisoTxt}>Na hora da sessão, procure um lugar reservado e use fones de ouvido. A sessão não é gravada.</Text>
              </View>
              {proximos.length > 0 && <Text style={s.secao}>Próximos</Text>}
              {proximos.map(a => cartao(a, false))}
              {passados.length > 0 && (
                <Recolhivel titulo={`Anteriores (${passados.length})`} icone="time-outline" estilo={{ marginTop: spacing.md }}>
                  {passados.map(a => cartao(a, true))}
                </Recolhivel>
              )}
            </>
          )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Atalho no Perfil: só aparece para quem tem algum atendimento.
export function CartaoMeusAtendimentos({ navigation, estilo }) {
  const { firebaseUser } = useAuth();
  const lista = useMeusAtendimentos(firebaseUser?.uid);
  if (!lista?.length) return null;
  const { proximos } = separar(lista);
  const prox = proximos.find(a => a.status === 'agendado');
  return (
    <TouchableOpacity style={[s.atalho, estilo]} onPress={() => navigation.navigate('MeusAtendimentos')} activeOpacity={0.8}
      accessibilityRole="button" accessibilityLabel="Meus atendimentos">
      <View style={s.icone}><Ionicons name="videocam-outline" size={20} color={colors.lilasTexto} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.titulo}>Meus atendimentos</Text>
        <Text style={s.com}>{prox ? `Próximo: ${dataHora(ms(prox.inicio))}` : 'Histórico das suas sessões online'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.tl} />
    </TouchableOpacity>
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
  scroll: { paddingHorizontal: spacing.lg },
  secao: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, marginTop: spacing.md, marginBottom: 10 },
  aviso: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.lav1, borderRadius: 16, padding: 14, marginTop: 8 },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.lilasTexto },
  card: {
    backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz, padding: 16, marginBottom: 12,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  cardPassado: { opacity: 0.8, shadowOpacity: 0, elevation: 0 },
  cardTopo: { flexDirection: 'row', gap: 12 },
  icone: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lav1 },
  quando: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.lilasTexto },
  titulo: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo, marginTop: 2 },
  com: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2 },
  cancelado: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.roseTexto, marginTop: 6 },
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: radius.full, marginTop: 14,
    backgroundColor: colors.botaoForte, borderBottomWidth: 4, borderBottomColor: colors.botaoBase,
  },
  botaoOff: { opacity: 0.5 },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' },
  dica: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tl, textAlign: 'center', marginTop: 8 },
  vazio: { alignItems: 'center', paddingTop: 70, gap: 10, paddingHorizontal: spacing.md },
  vazioTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, textAlign: 'center' },
  vazioSub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', lineHeight: 21, maxWidth: 320 },
  atalho: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 22,
    borderWidth: 1, borderColor: colors.bordaLuz, padding: 14, marginBottom: 12,
  },
}));
