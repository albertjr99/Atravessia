import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ilustracao = require('../../../assets/images/il_caminho_jornada.png');
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import * as WebBrowser from 'expo-web-browser';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { planos as planosPadrao } from '../../data';
import { ScriptTitle, Button, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { db, functions } from '../../services/firebase';

export default function PlanosScreen({ navigation }) {
  const { usuario } = useApp();
  const [sel, setSel] = useState(usuario.plano);
  const [carregando, setCarregando] = useState(false);
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
    try {
      const criarSessaoCheckout = httpsCallable(functions, 'criarSessaoCheckout');
      const { data } = await criarSessaoCheckout({ planoId });
      await WebBrowser.openBrowserAsync(data.url);
      // O plano é atualizado automaticamente quando o pagamento é confirmado
      // (webhook do Stripe grava em usuarios/{uid}.plano e o app escuta em tempo real).
      navigation.goBack();
    } catch (e) {
      Alert.alert('Não foi possível abrir o checkout', e.message || 'Tente novamente em alguns instantes.');
    } finally {
      setCarregando(false);
    }
  };

  const cancelarAssinatura = async () => {
    setCarregando(true);
    try {
      const cancelarFn = httpsCallable(functions, 'cancelarAssinatura');
      await cancelarFn();
      navigation.goBack();
    } catch (e) {
      Alert.alert('Não foi possível cancelar', e.message || 'Tente novamente em alguns instantes.');
    } finally {
      setCarregando(false);
    }
  };

  const planosAtivos = planosList.filter(p => !p.emBreve);
  const planosEmBreve = planosList.filter(p => p.emBreve);
  const coresAtivos = [colors.sage, colors.lav4];
  const selectedPlan = planosList.find(p => p.id === sel);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={styles.topBar}>
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
          {sel === 0 ? (
            <Button
              title={usuario.plano > 0 ? 'Cancelar assinatura e voltar ao gratuito' : 'Continuar no plano gratuito'}
              onPress={usuario.plano > 0 ? cancelarAssinatura : () => navigation.goBack()}
              variant="ghost"
              disabled={carregando}
            />
          ) : (
            <Button
              title={carregando ? 'Abrindo checkout...' : `Assinar ${selectedPlan?.nome || ''} — ${selectedPlan?.precoLabel || ''}`}
              onPress={() => assinarPlano(sel)}
              disabled={carregando || sel === usuario.plano}
            />
          )}
          <Text style={styles.cancelInfo}>Pagamento seguro pelo Stripe. Cancele quando quiser.</Text>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
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
  btns: { paddingHorizontal: spacing.lg, gap: 12, marginTop: spacing.sm },
  cancelInfo: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, textAlign: 'center' },
  emBreveSection: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  emBreveTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: 4 },
  emBreveDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginBottom: spacing.md },
  emBreveRow: { flexDirection: 'row', gap: 10 },
  emBreveCard: { flex: 1, alignItems: 'center', gap: 6, padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, opacity: 0.7 },
  emBreveNome: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.tl },
  emBreveSub: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, textAlign: 'center' },
});
