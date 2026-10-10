import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Image, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const ilustracao = require('../../../assets/images/il_caminho_jornada.png');
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, radius, shadow, criarEstilos } from '../../theme';
import { planos as planosPadrao } from '../../data';
import { ScriptTitle, Button, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { abrirPagamento, mensagemErroPagamento, aquecerPagamento } from '../../utils/pagamento';
import { db, functions } from '../../services/firebase';

export default function PlanosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { usuario } = useApp();
  const { perfil } = useAuth();
  const [sel, setSel] = useState(usuario.plano);
  const [carregando, setCarregando] = useState(false);
  const [demorando, setDemorando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  // Situação de acesso da usuária, para a tela dizer com clareza em que plano
  // ela está e não oferecer a compra do que ela já tem.
  const expCortesia = perfil?.cortesia?.expiracao?.toDate?.();
  const cortesiaAtiva = perfil?.cortesia?.ativo === true && expCortesia && expCortesia > new Date();
  const acessoTotal = usuario.acessoTotal === true;
  const temAssinatura = !!perfil?.stripeSubscriptionId && usuario.plano > 0;

  // A primeira chamada a uma Cloud Function parada leva alguns segundos para
  // "acordar". Aquecer ao abrir a tela faz o toque em "Assinar" responder rápido.
  useEffect(() => { aquecerPagamento('criarSessaoCheckout'); }, []);
  const [planosList, setPlanosList] = useState(planosPadrao);

  useEffect(() => {
    // Sem orderBy: planos gravados sem o campo `id` sumiriam da lista.
    const unsub = onSnapshot(collection(db, 'planos'), snap => {
      const docs = snap.docs
        .map(d => ({ ...d.data(), id: d.data().id ?? Number(d.id) }))
        .filter(p => Number.isFinite(p.id))
        .sort((a, b) => a.id - b.id);
      if (docs.length > 0) setPlanosList(docs);
    }, () => {});
    return unsub;
  }, []);

  const assinarPlano = async (planoId) => {
    setCarregando(true);
    setDemorando(false);
    const aviso = setTimeout(() => setDemorando(true), 8000);
    try {
      const criarSessaoCheckout = httpsCallable(functions, 'criarSessaoCheckout');
      const { data } = await criarSessaoCheckout({ planoId });
      await abrirPagamento(data.url);
      // O plano é atualizado automaticamente quando o pagamento é confirmado
      // (webhook do Stripe grava em usuarios/{uid}.plano e o app escuta em tempo real).
    } catch (e) {
      Alert.alert('Não foi possível abrir o pagamento', mensagemErroPagamento(e));
    } finally {
      clearTimeout(aviso);
      setCarregando(false);
      setDemorando(false);
    }
  };

  const confirmarCancelamento = () => {
    Alert.alert(
      'Cancelar assinatura?',
      'Você volta ao plano gratuito e perde o acesso aos recursos do plano atual.',
      [
        { text: 'Manter meu plano', style: 'cancel' },
        { text: 'Cancelar assinatura', style: 'destructive', onPress: cancelarAssinatura },
      ],
    );
  };

  const cancelarAssinatura = async () => {
    setCancelando(true);
    try {
      const cancelarFn = httpsCallable(functions, 'cancelarAssinatura');
      await cancelarFn();
      Alert.alert('Assinatura cancelada', 'Você voltou ao plano gratuito.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Não foi possível cancelar', mensagemErroPagamento(e));
    } finally {
      setCancelando(false);
    }
  };

  const planosAtivos = planosList.filter(p => !p.emBreve);
  const planosEmBreve = planosList.filter(p => p.emBreve);
  const coresAtivos = [colors.sage, colors.lav4];
  const selectedPlan = planosList.find(p => p.id === sel);
  const planoAtual = planosList.find(p => p.id === usuario.plano);
  const nomeAtual = planoAtual?.nome || (usuario.plano === 0 ? 'Perceber' : 'seu plano');

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ScriptTitle size={24}>Planos</ScriptTitle>
            <Text style={styles.sub}>Escolha o que faz mais sentido para você agora</Text>
          </View>
          <Image source={ilustracao} style={styles.headerIlustracao} resizeMode="contain" />
        </View>

        <View style={styles.atualBox}>
          <Ionicons name={acessoTotal || cortesiaAtiva ? 'gift-outline' : 'ribbon-outline'} size={20} color={colors.lav5} />
          <View style={{ flex: 1 }}>
            <Text style={styles.atualTit}>
              {acessoTotal ? 'Você tem acesso total' : cortesiaAtiva ? 'Você está com uma cortesia' : `Seu plano atual: ${nomeAtual}`}
            </Text>
            <Text style={styles.atualSub}>
              {acessoTotal
                ? 'Todos os recursos já estão liberados para você — não é preciso assinar nada.'
                : cortesiaAtiva
                  ? `Todos os recursos estão liberados até ${expCortesia.toLocaleDateString('pt-BR')}. Depois disso, você volta ao plano ${nomeAtual}.`
                  : usuario.plano === 0
                    ? 'Você está no plano gratuito. Conheça abaixo o que cada plano oferece.'
                    : 'Sua assinatura está ativa. Você pode trocar ou cancelar quando quiser.'}
            </Text>
          </View>
        </View>

        {planosAtivos.map((p, idx) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.planCard, sel === p.id && styles.planCardSel, p.destaque && styles.planCardDestaque]}
            onPress={() => setSel(p.id)}
            activeOpacity={0.85}
          >
            {p.destaque && (
              <View style={styles.destaqueTag}>
                <Text style={styles.destaqueText}>Recomendado para começar</Text>
              </View>
            )}
            <View style={styles.planHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.planNomeRow}>
                  <Text style={styles.planNome}>{p.nome}</Text>
                  {p.id === usuario.plano && !acessoTotal && (
                    <View style={styles.seuPlanoTag}><Text style={styles.seuPlanoTxt}>Seu plano</Text></View>
                  )}
                </View>
                <Text style={styles.planDesc}>{p.descricao}</Text>
              </View>
              <View style={styles.planPrecoBox}>
                <Text style={[styles.planPreco, { color: coresAtivos[idx] }]}>
                  {p.preco === 0 ? 'Grátis' : `R$ ${p.preco.toFixed(2).replace('.', ',')}`}
                </Text>
                {p.preco > 0 && <Text style={styles.planPrecoPer}>/mês</Text>}
              </View>
            </View>
            {!!p.mensagem && (
              <View style={styles.planMensagemBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.lav5} />
                <Text style={styles.planMensagemTxt}>{p.mensagem}</Text>
              </View>
            )}
            <View style={styles.recursosList}>
              {p.recursos.map((r, i) => (
                <View key={i} style={styles.recursoRow}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={coresAtivos[idx]} />
                  <Text style={styles.recursoText}>{r}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.radioIndicator, sel === p.id && { borderColor: coresAtivos[idx] }]}>
              {sel === p.id && <View style={[styles.radioInner, { backgroundColor: coresAtivos[idx] }]} />}
            </View>
          </TouchableOpacity>
        ))}

        {/* Planos em breve */}
        {planosEmBreve.length > 0 && (
          <View style={styles.emBreveSection}>
            <Text style={styles.emBreveTitulo}>Em breve</Text>
            <Text style={styles.emBreveDesc}>Novos planos com ainda mais recursos chegando em breve.</Text>
            <View style={styles.emBreveRow}>
              {planosEmBreve.map(p => (
                <View key={p.id} style={styles.emBreveCard}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.tl} />
                  <Text style={styles.emBreveNome}>{p.nome}</Text>
                  <Text style={styles.emBreveSub}>{p.descricao.split('.')[0]}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.btns}>
          {acessoTotal ? (
            <View style={styles.infoAcao}>
              <Ionicons name="checkmark-circle" size={18} color={colors.sage} />
              <Text style={styles.infoAcaoTxt}>Você já tem acesso a todos os planos.</Text>
            </View>
          ) : sel === usuario.plano ? (
            <View style={styles.infoAcao}>
              <Ionicons name="checkmark-circle" size={18} color={colors.sage} />
              <Text style={styles.infoAcaoTxt}>
                {sel === 0 ? 'Você já está no plano gratuito.' : `${nomeAtual} já é o seu plano.`} Toque em outro plano para ver as opções.
              </Text>
            </View>
          ) : sel === 0 ? (
            temAssinatura ? (
              <Button
                title={cancelando ? 'Cancelando...' : 'Cancelar assinatura e voltar ao gratuito'}
                onPress={confirmarCancelamento}
                variant="ghost"
                disabled={carregando || cancelando}
              />
            ) : (
              <Button title="Voltar" onPress={() => navigation.goBack()} variant="ghost" />
            )
          ) : (
            <Button
              title={carregando ? 'Abrindo pagamento...' : `Assinar ${selectedPlan?.nome || ''} — ${selectedPlan?.precoLabel || ''}`}
              onPress={() => assinarPlano(sel)}
              disabled={carregando}
            />
          )}
          <Text style={styles.cancelInfo}>Pagamento seguro pelo Stripe. Cancele quando quiser.</Text>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <Modal visible={carregando} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.esperaFundo}>
          <View style={styles.esperaCard}>
            <ActivityIndicator color={colors.lav4} size="large" />
            <Text style={styles.esperaTit}>Preparando seu pagamento seguro…</Text>
            <Text style={styles.esperaSub}>
              {demorando
                ? 'Está levando um pouco mais que o normal. Aguarde só mais um instante.'
                : 'Em instantes a página do Stripe vai abrir.'}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center' },
  headerIlustracao: { width: 80, height: 80, marginLeft: 8 },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },
  planCard: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.xl,
    borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.md, ...shadow.soft,
  },
  planCardSel: { borderColor: colors.lav4, backgroundColor: colors.lav1 },
  planCardDestaque: { borderColor: colors.lav3 },
  destaqueTag: {
    alignSelf: 'flex-start', backgroundColor: colors.lav1,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8,
    borderWidth: 1, borderColor: colors.lav3,
  },
  destaqueText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.lav6 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  planNomeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  planNome: { fontFamily: fonts.script, fontSize: 18, color: colors.lav6 },
  planSubtitulo: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lav4, textTransform: 'uppercase', letterSpacing: 0.5 },
  planDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 2 },
  planPrecoBox: { alignItems: 'flex-end' },
  planPreco: { fontFamily: fonts.bodyBold, fontSize: 18 },
  planPrecoPer: { fontFamily: fonts.body, fontSize: 10, color: colors.tl },
  planMensagemBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: colors.lav1, borderRadius: radius.md,
    borderLeftWidth: 3, borderLeftColor: colors.lav4,
    padding: 10, marginBottom: spacing.md,
  },
  planMensagemTxt: {
    flex: 1, fontFamily: fonts.body, fontSize: 11,
    color: colors.lav6, lineHeight: 16,
  },
  recursosList: { gap: 6, marginBottom: spacing.md },
  recursoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  recursoText: { fontFamily: fonts.body, fontSize: 12, color: colors.td, flex: 1 },
  radioIndicator: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.tl, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  atualBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.lav1, borderWidth: 1, borderColor: colors.lav2,
  },
  atualTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lav6 },
  atualSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 3, lineHeight: 17 },
  seuPlanoTag: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: colors.lav4 },
  seuPlanoTxt: { fontFamily: fonts.bodyBold, fontSize: 10, color: 'white' },
  infoAcao: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.sageFundo, borderWidth: 1, borderColor: colors.escuro ? '#35503B' : '#D5E6D8',
  },
  infoAcaoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.sageFg, lineHeight: 18 },
  esperaFundo: { flex: 1, backgroundColor: colors.sobreposicao, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  esperaCard: { width: '100%', maxWidth: 340, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', gap: 10 },
  esperaTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td, textAlign: 'center' },
  esperaSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, textAlign: 'center', lineHeight: 18 },
  btns: { paddingHorizontal: spacing.lg, gap: 12, marginTop: spacing.sm },
  cancelInfo: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, textAlign: 'center' },
  emBreveSection: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  emBreveTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: 4 },
  emBreveDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginBottom: spacing.md },
  emBreveRow: { flexDirection: 'row', gap: 10 },
  emBreveCard: { flex: 1, alignItems: 'center', gap: 6, padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, opacity: 0.7 },
  emBreveNome: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.tl },
  emBreveSub: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, textAlign: 'center' },
}));
