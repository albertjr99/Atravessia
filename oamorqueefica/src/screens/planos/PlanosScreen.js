import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { planos } from '../../data';
import { ScriptTitle, Button } from '../../components';
import { useApp } from '../../hooks/AppContext';

export default function PlanosScreen({ navigation }) {
  const { usuario, setUsuario } = useApp();
  const [sel, setSel] = useState(usuario.plano);

  const precosCores = ['#A8B8A0', colors.lav4, colors.lav5, colors.peach2];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
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
                <Text style={styles.planNome}>{p.nome}</Text>
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
            <Button title="Continuar no plano gratuito" onPress={() => navigation.goBack()} variant="ghost" />
          ) : (
            <Button
              title={`Assinar ${planos[sel].nome} — R$ ${planos[sel].preco.toFixed(2).replace('.', ',')}/mês`}
              onPress={() => {
                setUsuario(prev => ({ ...prev, plano: sel }));
                navigation.goBack();
              }}
            />
          )}
          <Text style={styles.cancelInfo}>Cancele quando quiser. Sem multa.</Text>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
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
  planNome: { fontFamily: fonts.script, fontSize: 18, color: colors.lav6 },
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
