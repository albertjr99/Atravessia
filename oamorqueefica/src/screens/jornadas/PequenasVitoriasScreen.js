import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Image, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ilustracao = require('../../../assets/images/il_broto.png');
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { ScriptTitle, QuoteText, Card, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { hojeStrBR, formatDataBR } from '../../utils/date';

export default function PequenasVitoriasScreen({ navigation }) {
  const { vitorias, adicionarVitoria, temAcesso } = useApp();
  const [textoCustom, setTextoCustom] = useState('');
  const [mostraInputCustom, setMostraInputCustom] = useState(false);
  const [opcoesFirestore, setOpcoesFirestore] = useState([]);

  useEffect(() => {
    // Sem orderBy: o Firestore descarta documentos que não tenham o campo
    // ordenado, fazendo opções válidas sumirem da tela.
    const unsub = onSnapshot(collection(db, 'vitoriasOpcoes'), (snap) => {
      setOpcoesFirestore(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(v => v.ativo !== false)
          .sort((a, b) => (a.criadoEm?.toMillis?.() ?? 0) - (b.criadoEm?.toMillis?.() ?? 0))
      );
    }, () => {});
    return unsub;
  }, []);

  if (!temAcesso(1)) {
    return (
      <SafeAreaView style={styles.safe}>
        <LavandaBg />
        <View style={styles.lockWrap}>
          <Ionicons name="lock-closed-outline" size={36} color={colors.lav4} />
          <Text style={styles.lockTitle}>Disponível no Plano Acolher</Text>
          <Text style={styles.lockSub}>Registre suas conquistas cotidianas e acompanhe sua reconstrução.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Planos')} style={styles.lockBtn}>
            <Text style={styles.lockBtnText}>Ver planos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const registradosHoje = vitorias.filter(v => v.data?.slice(0, 10) === hojeStrBR()).map(v => v.label);

  const handleAdicionarCustom = () => {
    const label = textoCustom.trim();
    if (!label) return;
    if (!registradosHoje.includes(label)) {
      adicionarVitoria({ label });
    }
    setTextoCustom('');
    setMostraInputCustom(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Pequenas Vitórias</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ScriptTitle size={22}>Cada passo importa</ScriptTitle>
            <QuoteText style={{ marginTop: 8 }}>
              "As grandes reconstruções começam em passos quase invisíveis."
            </QuoteText>
          </View>
          <Image source={ilustracao} style={styles.headerIlustracao} resizeMode="contain" />
        </View>

        <View style={styles.grid}>
          {opcoesFirestore.map(v => {
            const jaRegistrada = registradosHoje.includes(v.label);
            return (
              <TouchableOpacity
                key={v.id}
                style={[styles.chip, jaRegistrada && styles.chipFeito]}
                onPress={() => !jaRegistrada && adicionarVitoria({ label: v.label })}
                activeOpacity={0.85}
              >
                <Ionicons name={jaRegistrada ? 'checkmark-circle' : 'add-circle-outline'} size={16} color={jaRegistrada ? colors.sageFg : colors.lav5} />
                <Text style={[styles.chipText, jaRegistrada && { color: colors.sageFg, fontFamily: fonts.bodyBold }]}>{v.label}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Custom victory */}
          {mostraInputCustom ? (
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                placeholder="Minha conquista..."
                placeholderTextColor={colors.tl}
                value={textoCustom}
                onChangeText={setTextoCustom}
                autoFocus
                onSubmitEditing={handleAdicionarCustom}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={handleAdicionarCustom} style={styles.customBtnOk}>
                <Ionicons name="checkmark" size={16} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setMostraInputCustom(false); setTextoCustom(''); }}
                style={styles.customBtnCancel}
              >
                <Ionicons name="close" size={16} color={colors.tl} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.chip, styles.chipCustom]}
              onPress={() => setMostraInputCustom(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.lav5} />
              <Text style={[styles.chipText, { color: colors.lav5 }]}>Personalizar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suas conquistas registradas</Text>
          {vitorias.length === 0 ? (
            <Text style={styles.emptyText}>Suas pequenas vitórias aparecerão aqui.</Text>
          ) : (
            <Card style={{ gap: 8 }}>
              {[...vitorias].reverse().map(v => (
                <View key={v.id} style={styles.vitoriaRow}>
                  <Ionicons name="star" size={14} color={colors.gold} />
                  <Text style={styles.vitoriaText}>{v.label}</Text>
                  <Text style={styles.vitoriaData}>{formatDataBR(v.data)}</Text>
                </View>
              ))}
            </Card>
          )}
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
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center' },
  headerIlustracao: { width: 80, height: 80, marginLeft: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.card, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  chipFeito: { backgroundColor: colors.sage + '30', borderColor: colors.sage },
  chipCustom: { borderStyle: 'dashed', borderColor: colors.lav3, backgroundColor: colors.lav1 },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.td },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexBasis: '100%' },
  customInput: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.lav3,
    paddingVertical: 8, paddingHorizontal: 14,
    fontFamily: fonts.body, fontSize: 12, color: colors.td,
  },
  customBtnOk: {
    backgroundColor: colors.lav4, borderRadius: radius.full,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  customBtnCancel: {
    backgroundColor: colors.bg, borderRadius: radius.full,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  section: { paddingHorizontal: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', paddingVertical: spacing.lg },
  vitoriaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vitoriaText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  vitoriaData: { fontFamily: fonts.body, fontSize: 10, color: colors.tl },
  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  lockTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td, marginTop: 8 },
  lockSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, textAlign: 'center' },
  lockBtn: { marginTop: spacing.md, backgroundColor: colors.lav4, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  lockBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
});
