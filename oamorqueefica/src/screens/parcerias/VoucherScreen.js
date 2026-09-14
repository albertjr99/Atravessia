import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';

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
  const { tokenSeguro, codigoPublico, linkValidacao, parceriaNome } = route.params || {};
  const { meusVouchers } = useApp();

  const voucher = meusVouchers.find(v => v.id === tokenSeguro || v.tokenSeguro === tokenSeguro);
  const status = voucher?.status || 'GERADO';
  const info = STATUS_INFO[status] || STATUS_INFO.GERADO;

  const compartilhar = () => {
    Share.share({
      message: `Meu benefício no Atravessia — ${parceriaNome || voucher?.parceriaNome || ''}\nCódigo: ${codigoPublico}\nApresente este link ao parceiro: ${linkValidacao}`,
    }).catch(() => {});
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Seu benefício</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.parceriaNome}>{parceriaNome || voucher?.parceriaNome}</Text>

        <View style={[s.statusChip, { borderColor: info.cor }]}>
          <Ionicons name={info.icon} size={13} color={info.cor} />
          <Text style={[s.statusTxt, { color: info.cor }]}>{info.label}</Text>
        </View>

        <View style={s.qrCard}>
          {Platform.OS !== 'web' && linkValidacao ? (
            <QRCode value={linkValidacao} size={190} color={colors.td} backgroundColor="white" />
          ) : (
            <View style={s.qrFallback}>
              <Ionicons name="qr-code-outline" size={64} color={colors.lav3} />
            </View>
          )}
          <Text style={s.codigo}>{codigoPublico}</Text>
          <Text style={s.instrucao}>Apresente este código ou o QR Code ao parceiro</Text>
        </View>

        {!!voucher?.expiraEm && (
          <Text style={s.validade}>Válido até {formatarData(voucher.expiraEm)}</Text>
        )}

        <TouchableOpacity style={s.shareBtn} onPress={compartilhar} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={16} color={colors.lav5} />
          <Text style={s.shareBtnTxt}>Compartilhar link do benefício</Text>
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
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
});
