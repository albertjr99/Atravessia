import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, Platform, Share, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { Profundo } from '../../components/Efeitos';
import { abrirLink } from '../../utils/abrirLink';
import {
  STATUS_LEAD, FASES_LEAD, indiceFase, TEXTO_BENEFICIO, dataHoraTexto, dataTexto,
  linkWhatsapp, mensagemWhatsapp,
} from '../../utils/imoveis';
import { TopoImoveis, tomDe } from './comum';

// Linha do tempo da indicação: fases concluídas em sálvia, a atual em lilás.
export function LinhaDoTempo({ lead }) {
  const perdido = lead.status === 'perdido';
  const atual = perdido ? -1 : indiceFase(lead.status);
  const quando = {};
  (lead.historico || []).forEach(h => { if (h?.status && !quando[h.status]) quando[h.status] = h.em; });
  return (
    <View style={s.tl}>
      {FASES_LEAD.map((f, i) => {
        const feito = !perdido && i < atual;
        const agora = !perdido && i === atual;
        const info = STATUS_LEAD[f];
        return (
          <View key={f} style={s.tlLinha}>
            <View style={s.tlTrilho}>
              <View style={[s.tlPonto, feito && s.tlFeito, agora && s.tlAgora]}>
                {feito ? <Ionicons name="checkmark" size={13} color="white" /> : agora ? <Ionicons name={info.icone} size={13} color="white" /> : null}
              </View>
              {i < FASES_LEAD.length - 1 && <View style={[s.tlBarra, feito && s.tlBarraFeita]} />}
            </View>
            <View style={{ flex: 1, paddingBottom: 14 }}>
              <Text style={[s.tlTxt, (feito || agora) && s.tlTxtForte]}>{info.rotulo}</Text>
              {!!quando[f] && (feito || agora) && <Text style={s.tlData}>{dataTexto(quando[f])}</Text>}
            </View>
          </View>
        );
      })}
      {perdido && (
        <View style={s.perdido}>
          <Ionicons name="leaf-outline" size={18} color={colors.texto2} />
          <Text style={s.perdidoTxt}>
            Esta negociação foi encerrada. Tudo bem: cada casa tem seu tempo. Quando quiser, faça uma nova indicação.
          </Text>
        </View>
      )}
    </View>
  );
}

export default function IndicacaoImovelScreen({ route, navigation }) {
  const { leadId, novo } = route.params || {};
  const insets = useSafeAreaInsets();
  const [lead, setLead] = useState(undefined);
  const [imob, setImob] = useState(null);

  useEffect(() => {
    if (!leadId) return undefined;
    return onSnapshot(doc(db, 'indicacoesImoveis', leadId), (snap) => setLead(snap.exists() ? { id: snap.id, ...snap.data() } : null), () => setLead(null));
  }, [leadId]);
  useEffect(() => {
    if (!lead?.imobiliariaId) return undefined;
    return onSnapshot(doc(db, 'imobiliarias', lead.imobiliariaId), (snap) => setImob(snap.exists() ? snap.data() : null), () => {});
  }, [lead?.imobiliariaId]);

  if (lead === undefined) return <View style={[s.safe, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.lav4} /></View>;

  const info = STATUS_LEAD[lead?.status] || STATUS_LEAD.novo;
  const tom = tomDe(info.tom);
  const emAberto = lead && ['novo', 'em_contato', 'visita', 'proposta'].includes(lead.status);
  const whats = imob?.whatsapp ? linkWhatsapp(imob.whatsapp, mensagemWhatsapp(lead || {})) : '';
  const consult = lead?.consultoria;

  const compartilhar = () => Share.share({
    message: `Meu código de indicação Atravessia para ${lead.imobiliariaNome}: ${lead.codigo}${lead.linkValidacao ? `\n${lead.linkValidacao}` : ''}`,
  }).catch(() => {});

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <TopoImoveis titulo="Sua indicação" onVoltar={() => navigation.goBack()} />
      {!lead ? (
        <Text style={[s.sub, { textAlign: 'center', marginTop: 40 }]}>Não encontramos esta indicação.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, alignItems: 'stretch' }}>
          {novo && (
            <View style={s.sucesso}>
              <Ionicons name="heart-outline" size={18} color={colors.sageFg} />
              <Text style={s.sucessoTxt}>Indicação enviada! A imobiliária já pode ver seu interesse.</Text>
            </View>
          )}
          <Text style={s.nome}>{lead.imobiliariaNome}</Text>
          {!!lead.imovelTitulo && <Text style={[s.sub, { textAlign: 'center' }]}>{lead.imovelTitulo}</Text>}
          <View style={[s.statusChip, { backgroundColor: tom.fundo }]}>
            <Ionicons name={info.icone} size={15} color={tom.tinta} />
            <Text style={[s.statusTxt, { color: tom.tinta }]}>{info.rotulo}</Text>
          </View>

          {emAberto && (
            <View style={s.qrCard}>
              {Platform.OS !== 'web' && lead.linkValidacao
                ? <QRCode value={lead.linkValidacao} size={180} color="#2A2433" backgroundColor="white" />
                : <View style={s.qrFallback}><Ionicons name="qr-code-outline" size={60} color="#8B7AC0" /></View>}
              <Text style={s.codigo}>{lead.codigo}</Text>
              <Text style={s.instrucao}>Mostre este código ou o QR Code à imobiliária. É assim que ela sabe que você veio pela Atravessia.</Text>
            </View>
          )}

          {emAberto && !!whats && (
            <Profundo externo={{ marginTop: spacing.md }} estilo={s.btnFace} base={colors.botaoBase} sombra={s.btnHalo} onPress={() => abrirLink(whats)} accessibilityLabel="Falar com a imobiliária no WhatsApp">
              <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} />
              <Ionicons name="logo-whatsapp" size={19} color="white" />
              <Text style={s.btnTxt}>Falar no WhatsApp com o código</Text>
            </Profundo>
          )}
          {emAberto && (
            <TouchableOpacity style={s.secBtn} onPress={compartilhar} activeOpacity={0.85}>
              <Ionicons name="share-outline" size={17} color={colors.lilasTexto} />
              <Text style={s.secBtnTxt}>Compartilhar código</Text>
            </TouchableOpacity>
          )}

          {consult?.status === 'agendada' && (
            <View style={s.consult}>
              <View style={s.consultIcone}><Ionicons name="calendar-outline" size={20} color={colors.sageFg} /></View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.consultTit}>Sua consultoria com arquiteto parceiro</Text>
                <Text style={s.consultTxt}>{dataHoraTexto(consult.data)}{consult.duracaoHoras ? ` · cerca de ${consult.duracaoHoras} h` : ''}</Text>
                {!!lead.arquitetoNome && <Text style={s.consultTxt}>Com {lead.arquitetoNome}</Text>}
                {!!consult.link && (
                  <TouchableOpacity style={s.consultBtn} onPress={() => abrirLink(consult.link)}>
                    <Ionicons name="videocam-outline" size={16} color="white" />
                    <Text style={s.consultBtnTxt}>Entrar na chamada</Text>
                  </TouchableOpacity>
                )}
                {!!consult.observacao && <Text style={s.consultTxt}>{consult.observacao}</Text>}
              </View>
            </View>
          )}

          <View style={s.card}>
            <Text style={s.cardTit}>Acompanhe</Text>
            <LinhaDoTempo lead={lead} />
          </View>

          <View style={s.beneficio}>
            <Ionicons name="gift-outline" size={18} color={colors.sageFg} />
            <Text style={s.beneficioTxt}>{TEXTO_BENEFICIO}</Text>
          </View>

          <TouchableOpacity style={s.link} onPress={() => navigation.navigate('MinhasIndicacoesImoveis')}>
            <Text style={s.linkTxt}>Ver todas as minhas indicações</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  sub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.texto2 },
  sucesso: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.sageFundo, borderRadius: 16, padding: 12, marginTop: spacing.sm },
  sucessoTxt: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.sageFg },
  nome: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 32, color: colors.titulo, textAlign: 'center', marginTop: spacing.md },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7, marginTop: 10, marginBottom: spacing.md },
  statusTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  qrCard: {
    backgroundColor: '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: colors.bordaLuz,
    paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, alignItems: 'center', gap: 10,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 14 }, shadowOpacity: colors.escuro ? 0.45 : 0.14, shadowRadius: 26, elevation: 3,
  },
  qrFallback: { width: 180, height: 180, borderRadius: 22, backgroundColor: '#F1EDF8', alignItems: 'center', justifyContent: 'center' },
  codigo: { fontFamily: fonts.bodyBold, fontSize: 24, letterSpacing: 2.5, color: '#2A2433', marginTop: 6 },
  instrucao: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: '#534C60', textAlign: 'center' },
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 22, overflow: 'hidden' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: 'white' },
  secBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, marginTop: spacing.md, borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro },
  secBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  consult: { flexDirection: 'row', gap: 12, backgroundColor: colors.sageFundo, borderRadius: 22, padding: 16, marginTop: spacing.md },
  consultIcone: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  consultTit: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.sageFg },
  consultTxt: { fontFamily: fonts.body, fontSize: 13.5, color: colors.sageFg, lineHeight: 19 },
  consultBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 42, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: colors.sageFg, marginTop: 6 },
  consultBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.escuro ? '#1E2E25' : 'white' },
  card: { backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz, padding: 16, marginTop: spacing.md },
  cardTit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo, marginBottom: 12 },
  tl: {},
  tlLinha: { flexDirection: 'row', gap: 12 },
  tlTrilho: { alignItems: 'center', width: 24 },
  tlPonto: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.lav2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  tlFeito: { backgroundColor: colors.sage, borderColor: colors.sage },
  tlAgora: { backgroundColor: colors.lav5, borderColor: colors.lav5 },
  tlBarra: { flex: 1, width: 2, backgroundColor: colors.lav2, marginVertical: 2 },
  tlBarraFeita: { backgroundColor: colors.sage },
  tlTxt: { fontFamily: fonts.body, fontSize: 14, color: colors.tl, marginTop: 2 },
  tlTxtForte: { fontFamily: fonts.bodySemi, color: colors.td },
  tlData: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, marginTop: 2 },
  perdido: { flexDirection: 'row', gap: 10, backgroundColor: colors.muted, borderRadius: 14, padding: 12, marginTop: 4 },
  perdidoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.texto2 },
  beneficio: { flexDirection: 'row', gap: 10, backgroundColor: colors.lav1, borderRadius: 18, padding: 14, marginTop: spacing.md },
  beneficioTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.lilasTexto },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: spacing.sm },
  linkTxt: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.lilasTexto, textDecorationLine: 'underline' },
}));
