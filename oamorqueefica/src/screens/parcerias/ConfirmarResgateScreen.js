import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { LinearGradient } from 'expo-linear-gradient';
import { Profundo } from '../../components/Efeitos';
import { useApp } from '../../hooks/AppContext';

const centavosParaTexto = (c) => `R$ ${(Number(c || 0) / 100).toFixed(2).replace('.', ',')}`;

// Botão principal: degradê lilás com "degrau" que afunda ao toque.
function BotaoLilas({ onPress, children, rotulo, externo, desativado }) {
  return (
    <Profundo
      externo={[externo, desativado && { opacity: 0.6 }]}
      estilo={s.btnFace}
      base={colors.botaoBase}
      sombra={s.btnHalo}
      onPress={desativado ? undefined : onPress}
      accessibilityLabel={rotulo}
    >
      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.btnGrad} />
      {children}
    </Profundo>
  );
}

// Pede à usuária a confirmação de que o atendimento realmente aconteceu —
// é essa resposta (e só ela) que torna a comissão elegível para cobrança do
// parceiro. Enquanto ela não responde, o valor fica "aguardando confirmação",
// nunca contabilizado como receita.
export default function ConfirmarResgateScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { resgateId } = route.params || {};
  const { meusResgates, responderConfirmacaoResgate } = useApp();
  const [enviando, setEnviando] = useState(false);

  const resgate = meusResgates.find(r => r.id === resgateId);

  const responder = async (confirmar) => {
    if (!resgate) return;
    setEnviando(true);
    try {
      await responderConfirmacaoResgate(resgate.id, confirmar);
      Alert.alert(
        '',
        confirmar
          ? 'Obrigada por confirmar! Isso ajuda a Atravessia a manter as parcerias funcionando bem.'
          : 'Registramos que esse atendimento não aconteceu. Vamos verificar com o parceiro.',
      );
      navigation.goBack();
    } catch (e) {
      Alert.alert('', e?.message || 'Não foi possível registrar sua resposta. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Confirmar benefício</Text>
        <View style={{ width: 44 }} />
      </View>

      {!resgate ? (
        <View style={s.loading}>
          <ActivityIndicator color={colors.lav4} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.iconCircle}>
            <Ionicons name="gift-outline" size={30} color={colors.lilasIcone} />
          </View>

          <Text style={s.titulo}>{resgate.parceriaNome || 'Parceria'}</Text>
          <Text style={s.pergunta}>
            Um parceiro registrou que este atendimento aconteceu. Você confirma?
          </Text>

          <View style={s.card}>
            <View style={s.linha}>
              <Text style={s.label}>Código</Text>
              <Text style={s.valor}>{resgate.codigoPublico}</Text>
            </View>
            <View style={s.linha}>
              <Text style={s.label}>Valor do serviço</Text>
              <Text style={s.valor}>{centavosParaTexto(resgate.valorOriginalCentavos)}</Text>
            </View>
            <View style={s.linha}>
              <Text style={s.label}>Seu desconto</Text>
              <Text style={[s.valor, { color: colors.sageFg }]}>
                -{centavosParaTexto(resgate.valorDescontoClienteCentavos)}
              </Text>
            </View>
            <View style={[s.linha, { borderBottomWidth: 0 }]}>
              <Text style={s.labelForte}>Você pagou</Text>
              <Text style={s.valorForte}>{centavosParaTexto(resgate.valorFinalCentavos)}</Text>
            </View>
          </View>

          {resgate.status !== 'CONCLUIDO' ? (
            <View style={s.jaRespondido}>
              <Ionicons
                name={resgate.status === 'CONTESTADO' ? 'close-circle-outline' : 'checkmark-circle-outline'}
                size={18}
                color={resgate.status === 'CONTESTADO' ? colors.roseTexto : colors.sageFg}
              />
              <Text style={s.jaRespondidoTxt}>
                {resgate.status === 'CONTESTADO'
                  ? 'Você já informou que este atendimento não aconteceu.'
                  : 'Você já confirmou este atendimento.'}
              </Text>
            </View>
          ) : (
            <View style={s.botoes}>
              <BotaoLilas onPress={() => responder(true)} desativado={enviando} rotulo="Sim, aconteceu">
                <Ionicons name="checkmark" size={19} color="white" />
                <Text style={s.btnTxt}>Sim, aconteceu</Text>
              </BotaoLilas>
              <TouchableOpacity
                style={[s.btn, s.btnNao]}
                onPress={() => responder(false)}
                disabled={enviando}
                activeOpacity={0.85}
              >
                <Text style={s.btnNaoTxt}>Não aconteceu</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.rodape}>
            Sua confirmação ajuda a Atravessia a manter parcerias justas com quem
            oferece cuidado para você.
          </Text>
        </ScrollView>
      )}
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
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 22, overflow: 'hidden' },
  btnGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 5 },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: 'white' },
  btnVidro: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingHorizontal: 20,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro,
  },
  btnVidroTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, alignItems: 'center' },

  iconCircle: {
    width: 68, height: 68, borderRadius: 24,
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.md, marginBottom: spacing.md,
  },
  titulo: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.titulo, textAlign: 'center', marginBottom: 6 },
  pergunta: {
    fontFamily: fonts.body, fontSize: 15, color: colors.texto2,
    textAlign: 'center', lineHeight: 23, marginBottom: spacing.lg, maxWidth: 340,
  },

  card: {
    width: '100%', backgroundColor: colors.card, borderRadius: 24,
    borderWidth: 1, borderColor: colors.bordaLuz, paddingHorizontal: spacing.lg, paddingVertical: 6,
    marginBottom: spacing.lg,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  linha: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.bordaSuave,
  },
  label: { fontFamily: fonts.body, fontSize: 13.5, color: colors.texto2 },
  valor: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  labelForte: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  valorForte: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.lilasTexto },

  botoes: { width: '100%', gap: 12 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: radius.full, minHeight: 50,
  },
  btnNao: { borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro },
  btnNaoTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },

  jaRespondido: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: 22, padding: spacing.md,
    borderWidth: 1, borderColor: colors.bordaLuz,
  },
  jaRespondidoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.texto2, lineHeight: 20 },

  rodape: {
    fontFamily: fonts.body, fontSize: 11.5, color: colors.tl,
    textAlign: 'center', marginTop: spacing.lg, lineHeight: 17, maxWidth: 300,
  },
}));
