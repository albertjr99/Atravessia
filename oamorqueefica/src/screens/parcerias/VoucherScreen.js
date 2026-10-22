import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Share, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Profundo } from '../../components/Efeitos';
import { colors, fonts, spacing, radius, shadow, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { situacaoCupom, linkDoCupom } from '../../utils/cupons';

const STATUS_INFO = {
  GERADO: { label: 'Disponível', tom: 'lilas', icon: 'ellipse-outline' },
  APRESENTADO: { label: 'Apresentado', tom: 'lilas', icon: 'time-outline' },
  VALIDADO: { label: 'Validado pelo parceiro', tom: 'dourado', icon: 'shield-checkmark-outline' },
  CONCLUIDO: { label: 'Atendimento registrado — confirme na tela de notificações', tom: 'dourado', icon: 'hourglass-outline' },
  CONFIRMADO_USUARIO: { label: 'Confirmado — obrigada!', tom: 'salvia', icon: 'checkmark-circle-outline' },
  ELEGIVEL_LIQUIDACAO: { label: 'Confirmado — obrigada!', tom: 'salvia', icon: 'checkmark-circle-outline' },
  AGUARDANDO_PAGAMENTO: { label: 'Confirmado — obrigada!', tom: 'salvia', icon: 'checkmark-circle-outline' },
  LIQUIDADO: { label: 'Confirmado — obrigada!', tom: 'salvia', icon: 'checkmark-circle-outline' },
  CONTESTADO: { label: 'Você marcou que não aconteceu', tom: 'rosa', icon: 'close-circle-outline' },
  CANCELADO: { label: 'Cancelado', tom: 'neutro', icon: 'ban-outline' },
  EXPIRADO: { label: 'Expirado', tom: 'neutro', icon: 'time-outline' },
};

// Cores do estado (fundo do acento + tinta forte), lidas na hora de desenhar.
function tomDe(tom) {
  switch (tom) {
    case 'salvia': return { fundo: colors.sageFundo, tinta: colors.sageFg };
    case 'dourado': return { fundo: colors.douradoFundo, tinta: colors.douradoTitulo };
    case 'rosa': return { fundo: colors.roseFundo, tinta: colors.roseTexto };
    case 'lilas': return { fundo: colors.lav1, tinta: colors.lilasTexto };
    default: return { fundo: colors.muted, tinta: colors.texto2 };
  }
}

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
  const tom = tomDe(info.tom);
  const podeApresentar = !expirado && ['GERADO', 'APRESENTADO', 'VALIDADO'].includes(status);
  const desconto = Number(voucher?.percentualBeneficio) || Number(percentualDescontoCliente ?? voucher?.percentualDescontoCliente) || 0;

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
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Seu benefício</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.parceriaNome}>{parceriaNome || voucher?.parceriaNome}</Text>
        {desconto > 0 && (
          <Text style={s.descontoTxt}>{desconto}% de desconto para você</Text>
        )}

        <View style={[s.statusChip, { backgroundColor: tom.fundo }]}>
          <Ionicons name={info.icon} size={15} color={tom.tinta} />
          <Text style={[s.statusTxt, { color: tom.tinta }]}>{info.label}</Text>
        </View>

        <View style={s.qrCard}>
          {!podeApresentar ? (
            <View style={s.qrFallback}>
              <Ionicons name={info.icon} size={56} color="#8B7AC0" />
            </View>
          ) : Platform.OS !== 'web' && linkValidacao ? (
            <QRCode value={linkValidacao} size={190} color={colors.td} backgroundColor="white" />
          ) : (
            <View style={s.qrFallback}>
              <Ionicons name="qr-code-outline" size={64} color="#8B7AC0" />
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
          <BotaoLilas
            externo={s.botaoLargo}
            onPress={() => navigation.navigate('ConfirmarResgate', { resgateId: voucher.resgateId })}
            rotulo="Confirmar o atendimento"
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="white" />
            <Text style={s.btnTxt}>Confirmar o atendimento</Text>
          </BotaoLilas>
        )}

        {podeGerarNovo && (
          <BotaoLilas externo={s.botaoLargo} onPress={gerarNovo} desativado={gerandoNovo} rotulo="Gerar um novo cupom">
            {gerandoNovo
              ? <ActivityIndicator size="small" color="white" />
              : <Ionicons name="add-circle-outline" size={18} color="white" />}
            <Text style={s.btnTxt}>
              {gerandoNovo ? 'Gerando...' : 'Gerar um novo cupom'}
            </Text>
          </BotaoLilas>
        )}

        {podeApresentar && (
          <TouchableOpacity style={s.shareBtn} onPress={compartilhar} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={18} color={colors.lilasIcone} />
            <Text style={s.shareBtnTxt}>Compartilhar link do benefício</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.meusBtn} onPress={() => navigation.navigate('MeusCupons')} activeOpacity={0.7}>
          <Ionicons name="ticket-outline" size={16} color={colors.lilasIcone} />
          <Text style={s.meusBtnTxt}>Ver todos os meus cupons</Text>
        </TouchableOpacity>

        <View style={s.avisoBox}>
          <View style={s.avisoIcone}><Ionicons name="notifications-outline" size={18} color={colors.lilasIcone} /></View>
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
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, alignItems: 'center' },
  botaoLargo: { width: '100%', marginTop: spacing.lg },
  confirmarBtn: {},
  parceriaNome: {
    fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.titulo,
    textAlign: 'center', marginTop: spacing.md,
  },
  descontoTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.sageFg, textAlign: 'center', marginTop: 4 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7, marginTop: 12, marginBottom: spacing.lg,
  },
  statusTxt: { fontFamily: fonts.bodyBold, fontSize: 12, flexShrink: 1, textAlign: 'center' },

  // O cartão do QR Code é sempre branco (leitura pelo parceiro): textos escuros fixos.
  qrCard: {
    backgroundColor: '#FFFFFF', borderRadius: 28,
    borderWidth: 1, borderColor: colors.bordaLuz,
    paddingVertical: spacing.xl, paddingHorizontal: spacing.lg,
    alignItems: 'center', gap: 10, width: '100%',
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 14 },
    shadowOpacity: colors.escuro ? 0.45 : 0.14, shadowRadius: 26, elevation: 3,
  },
  qrFallback: {
    width: 190, height: 190, borderRadius: 22,
    backgroundColor: '#F1EDF8', alignItems: 'center', justifyContent: 'center',
  },
  codigo: { fontFamily: fonts.bodyBold, fontSize: 24, letterSpacing: 3, color: '#2A2433', marginTop: 8 },
  instrucao: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: '#534C60', textAlign: 'center' },

  validade: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2, marginTop: spacing.md },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
    marginTop: spacing.md, minHeight: 50, paddingHorizontal: 18,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro,
  },
  shareBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  meusBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, minHeight: 44 },
  meusBtnTxt: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.lilasTexto, textDecorationLine: 'underline' },

  avisoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz,
    padding: 14, marginTop: spacing.md, width: '100%',
  },
  avisoIcone: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.texto2, lineHeight: 19 },
}));
