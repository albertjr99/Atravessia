import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Image, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const ilustracao = require('../../../assets/images/il_caminho_jornada.png');
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { planos as planosPadrao } from '../../data';
import { Button, LavandaBg } from '../../components';
import { Profundo } from '../../components/Efeitos';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { abrirPagamento, mensagemErroPagamento, aquecerPagamento } from '../../utils/pagamento';
import { db, functions } from '../../services/firebase';
import UsarCashback from '../cashback/UsarCashback';
import Recolhivel from '../../components/Recolhivel';

export default function PlanosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { usuario } = useApp();
  const { perfil } = useAuth();
  const [sel, setSel] = useState(usuario.plano);
  const [carregando, setCarregando] = useState(false);
  const [demorando, setDemorando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [usarCashback, setUsarCashback] = useState(false);
  // Assinatura mensal ou anual (o anual vale o preço anual do plano ou 10 mensalidades).
  const [periodo, setPeriodo] = useState('mensal');
  // Formas de assinatura liberadas no painel (configuracoes/assinatura).
  const [assinatura, setAssinatura] = useState({ mensalAtivo: true, anualAtivo: true, seloAnual: '2 meses de presente', textoAnual: '' });
  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'assinatura'), (snap) => {
    const d = { mensalAtivo: true, anualAtivo: true, seloAnual: '2 meses de presente', textoAnual: '', ...(snap.data() || {}) };
    setAssinatura(d);
    if (d.mensalAtivo === false) setPeriodo('anual');
    if (d.anualAtivo === false) setPeriodo('mensal');
  }, () => {}), []);
  const opcoesPeriodo = [
    assinatura.mensalAtivo !== false && ['mensal', 'Mensal', 'Cobrança todo mês'],
    assinatura.anualAtivo !== false && ['anual', 'Anual', assinatura.seloAnual || 'Pagamento uma vez por ano'],
  ].filter(Boolean);
  const anual = periodo === 'anual';
  const precoAnualDe = (p) => (p?.precoAnual > 0 ? p.precoAnual : (p?.preco || 0) * 10);
  const reais = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;

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
      const { data } = await criarSessaoCheckout({ planoId, usarCashback, periodo });
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
  const selectedPlan = planosList.find(p => p.id === sel);
  const planoAtual = planosList.find(p => p.id === usuario.plano);
  const nomeAtual = planoAtual?.nome || (usuario.plano === 0 ? 'Perceber' : 'seu plano');
  const corAtual = acessoTotal || cortesiaAtiva ? corAcessoTotal() : corDoPlano(usuario.plano);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.titulo} />
        </TouchableOpacity>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Planos</Text>
            <Text style={styles.sub}>Escolha o que faz mais sentido para você agora</Text>
          </View>
          <Moldura source={ilustracao} tamanho={80} />
        </View>

        {/* Mensal ou anual: duas opções bem visíveis */}
        {planosAtivos.some(p => p.preco > 0) && !acessoTotal && opcoesPeriodo.length > 1 && (
          <View style={styles.periodoBox}>
            <Text style={styles.periodoPergunta}>Como você prefere pagar?</Text>
            <View style={styles.periodoLinha} accessibilityRole="radiogroup">
              {opcoesPeriodo.map(([id, rot, sub]) => {
                const ativo = periodo === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.periodoOpcao, ativo && styles.periodoAtivo]}
                    onPress={() => setPeriodo(id)}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: ativo }}
                    accessibilityLabel={`${rot}: ${sub}`}
                  >
                    <View style={[styles.periodoRadio, ativo && styles.periodoRadioAtivo]}>
                      {ativo && <View style={styles.periodoRadioPonto} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.periodoTxt, ativo && styles.periodoTxtAtivo]}>{rot}</Text>
                      <Text style={[styles.periodoSub, ativo && styles.periodoSubAtivo]}>{sub}</Text>
                    </View>
                    {id === 'anual' && !ativo && <View style={styles.periodoSelo}><Text style={styles.periodoSeloTxt}>Economize</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </View>
            {!!assinatura.textoAnual && periodo === 'anual' && <Text style={styles.periodoNota}>{assinatura.textoAnual}</Text>}
          </View>
        )}

        <View style={[styles.atualBox, { backgroundColor: corAtual.fundo }]}>
          <View style={[styles.atualIcone, { backgroundColor: colors.vidroForte }]}>
            <Ionicons name={acessoTotal || cortesiaAtiva ? 'gift-outline' : 'ribbon-outline'} size={21} color={corAtual.tinta} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.atualTit, { color: corAtual.texto }]}>
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

        {planosAtivos.map((p) => {
          const cor = corDoPlano(p.id);
          const escolhido = sel === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.planCard, escolhido && { borderColor: cor.tinta, borderWidth: 2 }]}
              onPress={() => setSel(p.id)}
              activeOpacity={0.9}
              accessibilityRole="radio"
              accessibilityState={{ selected: escolhido }}
            >
              {/* Faixa do topo com a cor do plano */}
              <View style={[styles.planTopo, { backgroundColor: cor.fundo }]}>
                {p.destaque && (
                  <View style={styles.destaqueTag}>
                    <Ionicons name="sparkles-outline" size={12} color={colors.lilasTexto} />
                    <Text style={styles.destaqueText}>Recomendado para começar</Text>
                  </View>
                )}
                <View style={styles.planHeader}>
                  <View style={[styles.planIcone, { backgroundColor: colors.vidroForte }]}>
                    <Ionicons name={ICONE_PLANO[p.id] || 'leaf-outline'} size={21} color={cor.tinta} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.planNomeRow}>
                      <Text style={[styles.planNome, { color: cor.texto }]}>{p.nome}</Text>
                      {p.id === usuario.plano && !acessoTotal && (
                        <View style={[styles.seuPlanoTag, { backgroundColor: cor.tinta }]}><Text style={styles.seuPlanoTxt}>Seu plano</Text></View>
                      )}
                    </View>
                    <Text style={styles.planDesc}>{p.descricao}</Text>
                  </View>
                  <View style={styles.planPrecoBox}>
                    <Text style={[styles.planPreco, { color: cor.texto }]}>
                      {p.preco === 0 ? 'Grátis' : reais(anual ? precoAnualDe(p) : p.preco)}
                    </Text>
                    {p.preco > 0 && <Text style={styles.planPrecoPer}>{anual ? '/ano' : '/mês'}</Text>}
                    {p.preco > 0 && anual && <Text style={styles.planPrecoPer}>{`≈ ${reais(precoAnualDe(p) / 12)}/mês`}</Text>}
                  </View>
                </View>
              </View>
              <View style={styles.planCorpo}>
                {!!p.mensagem && (
                  <View style={[styles.planMensagemBox, { borderLeftColor: cor.tinta }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color={cor.tinta} />
                    <Text style={styles.planMensagemTxt}>{p.mensagem}</Text>
                  </View>
                )}
                {/* Os 3 primeiros recursos ficam à vista; o resto, recolhido, para a lista não pesar. */}
                <View style={styles.recursosList}>
                  {(p.recursos || []).slice(0, (p.recursos || []).length > RECURSOS_VISIVEIS + 1 ? RECURSOS_VISIVEIS : undefined).map((r, i) => (
                    <View key={i} style={styles.recursoRow}>
                      <Ionicons name="checkmark-circle" size={17} color={cor.tinta} />
                      <Text style={styles.recursoText}>{r}</Text>
                    </View>
                  ))}
                </View>
                {(p.recursos || []).length > RECURSOS_VISIVEIS + 1 && (
                  <Recolhivel
                    titulo={`Ver mais ${p.recursos.length - RECURSOS_VISIVEIS} recursos`}
                    estilo={styles.recursosMais}
                    estiloConteudo={{ paddingBottom: 4 }}
                  >
                    <View style={styles.recursosList}>
                      {p.recursos.slice(RECURSOS_VISIVEIS).map((r, i) => (
                        <View key={i} style={styles.recursoRow}>
                          <Ionicons name="checkmark-circle" size={17} color={cor.tinta} />
                          <Text style={styles.recursoText}>{r}</Text>
                        </View>
                      ))}
                    </View>
                  </Recolhivel>
                )}
                <View style={[styles.radioIndicator, escolhido && { borderColor: cor.tinta }]}>
                  {escolhido && <View style={[styles.radioInner, { backgroundColor: cor.tinta }]} />}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Planos em breve */}
        {planosEmBreve.length > 0 && (
          <View style={styles.emBreveSection}>
            <Text style={styles.emBreveTitulo}>Em breve</Text>
            <Text style={styles.emBreveDesc}>Novos planos com ainda mais recursos chegando em breve.</Text>
            <View style={styles.emBreveRow}>
              {planosEmBreve.map(p => {
                const cor = corDoPlano(p.id);
                return (
                  <View key={p.id} style={[styles.emBreveCard, { backgroundColor: cor.fundo }]}>
                    <View style={[styles.emBreveIcone, { backgroundColor: colors.vidroForte }]}>
                      <Ionicons name="lock-closed-outline" size={18} color={cor.tinta} />
                    </View>
                    <Text style={[styles.emBreveNome, { color: cor.texto }]}>{p.nome}</Text>
                    <Text style={styles.emBreveSub}>{p.descricao.split('.')[0]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.btns}>
          {acessoTotal ? (
            <View style={styles.infoAcao}>
              <Ionicons name="checkmark-circle" size={20} color={colors.sageFg} />
              <Text style={styles.infoAcaoTxt}>Você já tem acesso a todos os planos.</Text>
            </View>
          ) : sel === usuario.plano ? (
            <View style={styles.infoAcao}>
              <Ionicons name="checkmark-circle" size={20} color={colors.sageFg} />
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
                style={styles.btnSecundario}
              />
            ) : (
              <Button title="Voltar" onPress={() => navigation.goBack()} variant="ghost" style={styles.btnSecundario} />
            )
          ) : (
            <>
            <UsarCashback ativo={usarCashback} onChange={setUsarCashback} />
            <Profundo
              externo={[styles.btnExterno, carregando && { opacity: 0.6 }]}
              estilo={styles.btnFace}
              base={colors.botaoBase}
              sombra={styles.btnHalo}
              onPress={carregando ? undefined : () => assinarPlano(sel)}
              accessibilityLabel={`Assinar ${selectedPlan?.nome || ''}`}
            >
              <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <Ionicons name="lock-closed-outline" size={17} color="white" />
              <Text style={styles.btnTxt} numberOfLines={2}>
                {carregando
                  ? 'Abrindo pagamento...'
                  : anual
                    ? `Assinar ${selectedPlan?.nome || ''} anual — ${reais(precoAnualDe(selectedPlan))}/ano`
                    : `Assinar ${selectedPlan?.nome || ''} — ${selectedPlan?.preco > 0 ? `${reais(selectedPlan.preco)}/mês` : (selectedPlan?.precoLabel || '')}`}
              </Text>
            </Profundo>
            </>
          )}
          <Text style={styles.cancelInfo}>Pagamento seguro pelo Stripe. Cancele quando quiser.</Text>
        </View>

        <View style={{ height: spacing.xxl + insets.bottom }} />
      </ScrollView>

      <Modal visible={carregando} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.esperaFundo}>
          <View style={styles.esperaCard}>
            <ActivityIndicator color={colors.lilasIcone} size="large" />
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

// Cores de cada plano (mesmas em todas as telas e nos painéis):
// Perceber = sálvia, Acolher = lilás, Compreender = névoa, Evoluir = pêssego,
// Acesso Total = dourado. Função para acompanhar o tema claro/noturno.
// Quantos recursos do plano ficam à vista antes do "Ver mais".
const RECURSOS_VISIVEIS = 3;
const ICONE_PLANO = { 0: 'leaf-outline', 1: 'heart-outline', 2: 'compass-outline', 3: 'sunny-outline' };
function corDoPlano(id) {
  const n = colors.escuro;
  switch (id) {
    case 0: return { fundo: colors.sageFundo, tinta: n ? '#9FD0B0' : colors.sage, texto: colors.sageFg };
    case 1: return { fundo: colors.lav1, tinta: colors.lilasIcone, texto: colors.lilasTexto };
    case 2: return { fundo: n ? 'rgba(169,193,236,0.14)' : '#E3EAF7', tinta: n ? '#A9C1EC' : '#6F8CC2', texto: n ? '#C3D4F2' : '#3F5A86' };
    case 3: return { fundo: n ? 'rgba(242,183,158,0.14)' : '#FCE7DC', tinta: n ? '#F2B79E' : '#D98A69', texto: n ? '#F6C8B4' : '#94492F' };
    default: return { fundo: colors.lav1, tinta: colors.lilasIcone, texto: colors.lilasTexto };
  }
}
function corAcessoTotal() {
  const n = colors.escuro;
  return { fundo: colors.douradoFundo, tinta: n ? '#E5C68B' : '#C9A15A', texto: colors.douradoTitulo };
}

// Ilustração da marca numa moldura arredondada (sem tintColor).
function Moldura({ source, tamanho = 80 }) {
  const extra = Math.round(tamanho * 0.1);
  return (
    <View style={[styles.moldura, { width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.26) }]}>
      <Image source={source} style={{ width: tamanho + extra * 2, height: tamanho + extra * 2, margin: -extra }} resizeMode="cover" />
    </View>
  );
}

// Cartão de vidro: véu translúcido, borda de luz e sombra ameixa suave.
const vidro = () => ({
  backgroundColor: colors.card,
  borderRadius: 26,
  borderWidth: 1,
  borderColor: colors.bordaLuz,
  shadowColor: colors.sombra,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: colors.escuro ? 0.28 : 0.11,
  shadowRadius: 20,
  elevation: 2,
});

const styles = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: colors.escuro ? 0.25 : 0.08, shadowRadius: 10, elevation: 2,
  },
  scroll: { paddingHorizontal: spacing.lg },
  header: { paddingTop: spacing.sm, paddingBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 12 },
  titulo: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 42, color: colors.titulo },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.texto2, marginTop: 2, lineHeight: 21 },
  moldura: { overflow: 'hidden', flexShrink: 0, borderWidth: 1, borderColor: colors.bordaLuz, backgroundColor: colors.cardSolido },

  planCard: { ...vidro(), marginBottom: spacing.lg, overflow: 'hidden' },
  planTopo: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14 },
  destaqueTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: colors.vidroForte, borderRadius: radius.full,
    paddingHorizontal: 11, paddingVertical: 4, marginBottom: 12,
  },
  destaqueText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lilasTexto, letterSpacing: 0.2 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planIcone: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  planNomeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  planNome: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 32 },
  planDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2, lineHeight: 18 },
  planPrecoBox: { alignItems: 'flex-end', alignSelf: 'flex-start', paddingTop: 2 },
  planPreco: { fontFamily: 'Figtree_800ExtraBold', fontSize: 20 },
  planPrecoPer: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.texto2 },
  planCorpo: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 },
  planMensagemBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.lavVeu, borderRadius: radius.md,
    borderLeftWidth: 3, padding: 12, marginBottom: spacing.md,
  },
  planMensagemTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.titulo, lineHeight: 19 },
  recursosList: { gap: 9 },
  // "Ver mais recursos": recolhível sem moldura de cartão, dentro do cartão do plano.
  recursosMais: {
    backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, marginBottom: 0, marginTop: 4, marginHorizontal: -16,
    shadowOpacity: 0, elevation: 0,
  },
  recursoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  recursoText: { fontFamily: fonts.body, fontSize: 14, color: colors.titulo, flex: 1, lineHeight: 19 },
  radioIndicator: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.lav3, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  radioInner: { width: 12, height: 12, borderRadius: 6 },

  atualBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: spacing.lg, padding: 16,
    borderRadius: 24, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  atualIcone: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  atualTit: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21 },
  atualSub: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 3, lineHeight: 19 },
  seuPlanoTag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
  seuPlanoTxt: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.escuro ? '#1C1726' : 'white' },
  infoAcao: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16,
    borderRadius: 20, backgroundColor: colors.sageFundo, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  infoAcaoTxt: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.sageFg, lineHeight: 19 },
  esperaFundo: { flex: 1, backgroundColor: colors.sobreposicao, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  esperaCard: { width: '100%', maxWidth: 360, backgroundColor: colors.cardSolido, borderRadius: 26, padding: spacing.xl, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.bordaLuz },
  esperaTit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo, textAlign: 'center' },
  esperaSub: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, textAlign: 'center', lineHeight: 19 },
  btns: { gap: 12, marginTop: spacing.xs },
  // No tablet o botão ocupava a largura toda da tela; agora para em 520.
  btnExterno: { alignSelf: 'center', width: '100%', maxWidth: 520 },
  btnFace: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 54, paddingHorizontal: 22, paddingVertical: 12, overflow: 'hidden',
  },
  btnHalo: {
    shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 4,
  },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white, textAlign: 'center', flexShrink: 1 },
  btnSecundario: { backgroundColor: colors.vidro, borderColor: colors.lav2, minHeight: 50 },
  cancelInfo: { fontFamily: fonts.body, fontSize: 12, color: colors.texto2, textAlign: 'center' },
  emBreveSection: { ...vidro(), marginBottom: spacing.lg, padding: 18 },
  emBreveTitulo: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, marginBottom: 4 },
  emBreveDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginBottom: spacing.md, lineHeight: 18 },
  emBreveRow: { flexDirection: 'row', gap: 10 },
  emBreveCard: { flex: 1, alignItems: 'center', gap: 6, padding: 14, borderRadius: 20 },
  emBreveIcone: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emBreveNome: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 26 },
  emBreveSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.texto2, textAlign: 'center', lineHeight: 16 },
  periodoBox: { marginBottom: 16 },
  periodoNota: { fontFamily: 'Figtree_500Medium', fontSize: 13, color: colors.texto2, marginTop: 8, marginLeft: 2 },
  periodoPergunta: { fontFamily: 'Figtree_700Bold', fontSize: 15, color: colors.titulo, marginBottom: 8, marginLeft: 2 },
  periodoLinha: { flexDirection: 'row', gap: 10 },
  periodoOpcao: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 18,
    backgroundColor: colors.cardSolido, borderWidth: 2, borderColor: colors.lav2,
  },
  periodoAtivo: {
    backgroundColor: colors.botaoForte, borderColor: colors.botaoForte,
    shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 5,
  },
  periodoRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.lav4, alignItems: 'center', justifyContent: 'center' },
  periodoRadioAtivo: { borderColor: '#FFFFFF' },
  periodoRadioPonto: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  periodoTxt: { fontFamily: 'Figtree_800ExtraBold', fontSize: 16, color: colors.titulo },
  periodoTxtAtivo: { color: '#FFFFFF' },
  periodoSub: { fontFamily: 'Figtree_500Medium', fontSize: 12, color: colors.texto2, marginTop: 1 },
  periodoSubAtivo: { color: 'rgba(255,255,255,0.88)' },
  periodoSelo: { position: 'absolute', top: -9, right: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.sage },
  periodoSeloTxt: { fontFamily: 'Figtree_700Bold', fontSize: 10.5, color: '#FFFFFF' },
}));
