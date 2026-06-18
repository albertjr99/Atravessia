import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import * as WebBrowser from 'expo-web-browser';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { planos } from '../../data';
import { ScriptTitle, Button } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { functions } from '../../services/firebase';

export default function PlanosScreen({ navigation }) {
  const { usuario } = useApp();
  const [sel, setSel] = useState(usuario.plano);
  const [carregando, setCarregando] = useState(false);

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

  const precosCores = ['#A8B8A0', colors.lav4, colors.lav5, colors.peach2];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ScriptTitle size={24}>Planos</ScriptTitle>
          <Text style={styles.sub}>Escolha o que faz mais sentido para você agora</Text>
        </View>

        {planos.map((p, idx) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.planCard, sel === p.id && styles.planCardSel, p.destaque && styles.planCardDestaque]}
            onPress={() => setSel(p.id)}
            activeOpacity={0.85}
          >
            {p.destaque && (
              <View style={styles.destaqueTag}>
                <Text style={styles.destaqueText}>Mais popular</Text>
              </View>
            )}
            <View style={styles.planHeader}>
              <View>
                <View style={styles.planNomeRow}>
                  <Text style={styles.planNome}>{p.nome}</Text>
                  {p.subtitulo && <Text style={styles.planSubtitulo}>· {p.subtitulo}</Text>}
                </View>
                <Text style={styles.planDesc}>{p.descricao}</Text>
              </View>
              <View style={styles.planPrecoBox}>
                <Text style={[styles.planPreco, { color: precosCores[idx] }]}>
                  {p.preco === 0 ? 'Grátis' : `R$ ${p.preco.toFixed(2).replace('.', ',')}`}
                </Text>
                {p.preco > 0 && <Text style={styles.planPrecoPer}>/mês</Text>}
              </View>
            </View>
            <View style={styles.recursosList}>
              {p.recursos.map((r, i) => (
                <View key={i} style={styles.recursoRow}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={precosCores[idx]} />
                  <Text style={styles.recursoText}>{r}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.radioIndicator, sel === p.id && { borderColor: precosCores[idx] }]}>
              {sel === p.id && <View style={[styles.radioInner, { backgroundColor: precosCores[idx] }]} />}
            </View>
          </TouchableOpacity>
        ))}

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
              title={carregando ? 'Abrindo checkout...' : `Assinar ${planos[sel].nome} — R$ ${planos[sel].preco.toFixed(2).replace('.', ',')}/mês`}
              onPress={() => assinarPlano(sel)}
              disabled={carregando || sel === usuario.plano}
            />
          )}
          <Text style={styles.cancelInfo}>Pagamento processado de forma segura pelo Stripe. Cancele quando quiser.</Text>
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
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
  recursosList: { gap: 6, marginBottom: spacing.md },
  recursoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  recursoText: { fontFamily: fonts.body, fontSize: 12, color: colors.td, flex: 1 },
  radioIndicator: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.tl, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  btns: { paddingHorizontal: spacing.lg, gap: 12, marginTop: spacing.sm },
  cancelInfo: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, textAlign: 'center' },
});
