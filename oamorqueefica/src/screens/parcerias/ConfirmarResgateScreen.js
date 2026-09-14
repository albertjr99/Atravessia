import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';

const centavosParaTexto = (c) => `R$ ${(Number(c || 0) / 100).toFixed(2).replace('.', ',')}`;

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
          ? 'Obrigada por confirmar! Isso ajuda o Travessia a manter as parcerias funcionando bem.'
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
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Confirmar benefício</Text>
        <View style={{ width: 36 }} />
      </View>

      {!resgate ? (
        <View style={s.loading}>
          <ActivityIndicator color={colors.lav4} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.iconCircle}>
            <Ionicons name="gift-outline" size={30} color={colors.lav5} />
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
              <Text style={[s.valor, { color: colors.sage }]}>
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
                color={resgate.status === 'CONTESTADO' ? colors.peach2 : colors.sage}
              />
              <Text style={s.jaRespondidoTxt}>
                {resgate.status === 'CONTESTADO'
                  ? 'Você já informou que este atendimento não aconteceu.'
                  : 'Você já confirmou este atendimento.'}
              </Text>
            </View>
          ) : (
            <View style={s.botoes}>
              <TouchableOpacity
                style={[s.btn, s.btnSim]}
                onPress={() => responder(true)}
                disabled={enviando}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark" size={18} color="white" />
                <Text style={s.btnSimTxt}>Sim, aconteceu</Text>
              </TouchableOpacity>
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
            Sua confirmação ajuda o Travessia a manter parcerias justas com quem
            oferece cuidado para você.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, alignItems: 'center' },

  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.lav2,
  },
  titulo: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.td, textAlign: 'center', marginBottom: 6 },
  pergunta: {
    fontFamily: fonts.body, fontSize: 13, color: colors.tm,
    textAlign: 'center', lineHeight: 19, marginBottom: spacing.lg, maxWidth: 300,
  },

  card: {
    width: '100%', backgroundColor: colors.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
    marginBottom: spacing.lg, ...shadow.soft,
  },
  linha: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  valor: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  labelForte: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  valorForte: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.lav5 },

  botoes: { width: '100%', gap: 10 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: radius.full, paddingVertical: 14,
  },
  btnSim: { backgroundColor: colors.sage },
  btnSimTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: 'white' },
  btnNao: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  btnNaoTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.tm },

  jaRespondido: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  jaRespondidoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, lineHeight: 18 },

  rodape: {
    fontFamily: fonts.body, fontSize: 11, color: colors.tl,
    textAlign: 'center', marginTop: spacing.lg, lineHeight: 16, maxWidth: 280,
  },
});
