import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Share, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { colors, fonts, spacing, radius, shadow, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { situacaoCupom, linkDoCupom } from '../../utils/cupons';

const STATUS_INFO = {
  GERADO: { label: 'Disponível', cor: colors.lav5, icon: 'ellipse-outline' },
  APRESENTADO: { label: 'Apresentado', cor: colors.lav5, icon: 'time-outline' },
  VALIDADO: { label: 'Validado pelo parceiro', cor: colors.gold, icon: 'shield-checkmark-outline' },
  CONCLUIDO: { label: 'Atendimento registrado — confirme na tela de notificações', cor: colors.gold, icon: 'hourglass-outline' },
  CONFIRMADO_USUARIO: { label: 'Confirmado — obrigada!', cor: colors.sage, icon: 'checkmark-circle-outline' },
  ELEGIVEL_LIQUIDACAO: { label: 'Confirmado — obrigada!', cor: colors.sage, icon: 'checkmark-circle-outline' },
  AGUARDANDO_PAGAMENTO: { label: 'Confirmado — obrigada!', cor: colors.sage, icon: 'checkmark-circle-outline' },
  LIQUIDADO: { label: 'Confirmado — obrigada!', cor: colors.sage, icon: 'checkmark-circle-outline' },
  CONTESTADO: { label: 'Você marcou que não aconteceu', cor: colors.peach2, icon: 'close-circle-outline' },
  CANCELADO: { label: 'Cancelado', cor: colors.tl, icon: 'ban-outline' },
  EXPIRADO: { label: 'Expirado', cor: colors.tl, icon: 'time-outline' },
};

function formatarData(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR');
}

// Mostra o cupom recém-gerado: QR code, código legível e o link de validação
// (para o caso de o parceiro preferir digitar/tocar em vez de escanear).
// O status é lido em tempo real do Firestore, então some a tela some a
// necessidade de recarregar: assim que o parceiro validar ou concluir, a
// própria tela reflete a mudança.
export default function VoucherScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { tokenSeguro, codigoPublico, parceriaNome, percentualDescontoCliente } = route.params || {};
  // Aberto a partir de "Meus cupons" o link não vem pronto; é derivado do token.
  const linkValidacao = route.params?.linkValidacao || (tokenSeguro ? linkDoCupom(tokenSeguro) : '');
  const { meusVouchers, gerarVoucherBeneficio } = useApp();
  const [gerandoNovo, setGerandoNovo] = useState(false);

  const voucher = meusVouchers.find(v => v.id === tokenSeguro || v.tokenSeguro === tokenSeguro);
  // Um cupom vencido pode seguir como GERADO até o job horário marcá-lo; aqui
  // ele já aparece como expirado e o QR Code some.
  const expirado = situacaoCupom(voucher || { status: 'GERADO' }) === 'expirado';
  const status = expirado ? 'EXPIRADO' : (voucher?.status || 'GERADO');
  const info = STATUS_INFO[status] || STATUS_INFO.GERADO;
  const podeApresentar = !expirado && ['GERADO', 'APRESENTADO', 'VALIDADO'].includes(status);
  const desconto = Number(percentualDescontoCliente ?? voucher?.percentualDescontoCliente) || 0;

  // Cupom usado ou vencido não volta a valer: para um novo atendimento, ela
  // gera outro cupom da mesma parceria, aqui mesmo.
  const parceriaId = voucher?.parceriaId;
  const podeGerarNovo = !!parceriaId && !podeApresentar && status !== 'CONCLUIDO';
  const gerarNovo = async () => {
    if (gerandoNovo) return;
    setGerandoNovo(true);
    try {
      const novo = await gerarVoucherBeneficio(parceriaId);
      navigation.replace('Voucher', { ...novo, parceriaNome: parceriaNome || voucher?.parceriaNome });
    } catch (e) {
      Alert.alert('', e?.message || 'Não foi possível gerar um novo cupom agora. Tente novamente.');
    } finally {
      setGerandoNovo(false);
    }
  };

  const compartilhar = () => {
    Share.share({
      message: `Meu benefício no Atravessia — ${parceriaNome || voucher?.parceriaNome || ''}\nCódigo: ${codigoPublico}\nApresente este link ao parceiro: ${linkValidacao}`,
    }).catch(() => {});
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Seu benefício</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.parceriaNome}>{parceriaNome || voucher?.parceriaNome}</Text>
        {desconto > 0 && (
          <Text style={s.descontoTxt}>{desconto}% de desconto para você</Text>
        )}

        <View style={[s.statusChip, { borderColor: info.cor }]}>
          <Ionicons name={info.icon} size={13} color={info.cor} />
          <Text style={[s.statusTxt, { color: info.cor }]}>{info.label}</Text>
        </View>

        <View style={s.qrCard}>
          {!podeApresentar ? (
            <View style={s.qrFallback}>
              <Ionicons name={info.icon} size={56} color={colors.lav3} />
            </View>
          ) : Platform.OS !== 'web' && linkValidacao ? (
            <QRCode value={linkValidacao} size={190} color={colors.td} backgroundColor="white" />
          ) : (
            <View style={s.qrFallback}>
              <Ionicons name="qr-code-outline" size={64} color={colors.lav3} />
            </View>
          )}
          <Text style={s.codigo}>{codigoPublico}</Text>
          <Text style={s.instrucao}>
            {podeApresentar
              ? 'Apresente este código ou o QR Code ao parceiro'
              : expirado
                ? 'Este cupom venceu. Você pode gerar um novo sempre que precisar.'
                : status === 'CONCLUIDO'
                  ? 'Confirme o atendimento para concluir o uso deste cupom.'
                  : 'Este cupom já foi utilizado e não vale mais. Para um novo atendimento, gere outro cupom.'}
          </Text>
        </View>

        {podeApresentar && !!voucher?.expiraEm && (
          <Text style={s.validade}>Válido até {formatarData(voucher.expiraEm)}</Text>
        )}

        {status === 'CONCLUIDO' && !!voucher?.resgateId && (
          <TouchableOpacity
            style={[s.shareBtn, s.confirmarBtn]}
            onPress={() => navigation.navigate('ConfirmarResgate', { resgateId: voucher.resgateId })}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="white" />
            <Text style={[s.shareBtnTxt, { color: 'white' }]}>Confirmar o atendimento</Text>
          </TouchableOpacity>
        )}

        {podeGerarNovo && (
          <TouchableOpacity
            style={[s.shareBtn, s.confirmarBtn]}
            onPress={gerarNovo}
            disabled={gerandoNovo}
            activeOpacity={0.85}
          >
            {gerandoNovo
              ? <ActivityIndicator size="small" color="white" />
              : <Ionicons name="add-circle-outline" size={16} color="white" />}
            <Text style={[s.shareBtnTxt, { color: 'white' }]}>
              {gerandoNovo ? 'Gerando...' : 'Gerar um novo cupom'}
            </Text>
          </TouchableOpacity>
        )}

        {podeApresentar && (
          <TouchableOpacity style={s.shareBtn} onPress={compartilhar} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={16} color={colors.lav5} />
            <Text style={s.shareBtnTxt}>Compartilhar link do benefício</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.meusBtn} onPress={() => navigation.navigate('MeusCupons')} activeOpacity={0.7}>
          <Ionicons name="ticket-outline" size={14} color={colors.lav5} />
          <Text style={s.meusBtnTxt}>Ver todos os meus cupons</Text>
        </TouchableOpacity>

        <View style={s.avisoBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.lav5} />
          <Text style={s.avisoTxt}>
            Depois que o parceiro registrar o atendimento, você vai receber uma
            notificação para confirmar que ele realmente aconteceu.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  confirmarBtn: { backgroundColor: colors.lav5, borderColor: colors.lav5 },
  meusBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, paddingVertical: 8 },
  meusBtnTxt: { fontFamily: fonts.body, fontSize: 12.5, color: colors.lav5, textDecorationLine: 'underline' },
  descontoTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.sage, textAlign: 'center', marginTop: 4, marginBottom: 2 },
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, alignItems: 'center' },

  parceriaNome: {
    fontFamily: fonts.bodyBold, fontSize: 18, color: colors.td,
    textAlign: 'center', marginTop: spacing.sm, marginBottom: 10,
  },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: spacing.lg,
  },
  statusTxt: { fontFamily: fonts.bodyBold, fontSize: 11.5 },

  qrCard: {
    backgroundColor: 'white', borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.xl, paddingHorizontal: spacing.lg,
    alignItems: 'center', gap: 10, width: '100%',
    ...shadow.card,
  },
  qrFallback: {
    width: 190, height: 190, borderRadius: radius.md,
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center',
  },
  codigo: {
    fontFamily: fonts.bodyBold, fontSize: 22, letterSpacing: 2, color: colors.lav6, marginTop: 6,
  },
  instrucao: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, textAlign: 'center' },

  validade: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tl, marginTop: spacing.md },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: spacing.lg, paddingVertical: 11, paddingHorizontal: 18,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.lav3,
    backgroundColor: colors.lav1,
  },
  shareBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav5 },

  avisoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.lav1, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.lav2,
    padding: spacing.md, marginTop: spacing.lg, width: '100%',
  },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, color: colors.lav6, lineHeight: 17 },
}));
