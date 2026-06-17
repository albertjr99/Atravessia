import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { ScriptTitle, Card, Button, QuoteText } from '../../components';

const formatos = [
  { id: 'online', titulo: 'Individual — online ao vivo', sub: 'Sessão 1:1 por videochamada', popular: true },
  { id: 'grupo', titulo: 'Grupo — online semanal', sub: 'Encontros ao vivo em grupo' },
  { id: 'gravada', titulo: 'Individual — gravada', sub: 'Acesse no seu horário' },
  { id: 'hibrida', titulo: 'Híbrida — online + presencial', sub: 'Flexibilidade total' },
];

const motivacoes = [
  { id: 'apoio', texto: 'Sinto que preciso de apoio' },
  { id: 'curiosidade', texto: 'Estou curioso(a) sobre terapia' },
  { id: 'info', texto: 'Só quero mais informações' },
];

export default function SessaoScreen({ navigation }) {
  const [formatoSel, setFormatoSel] = useState('online');
  const [motivacaoSel, setMotiSel] = useState('apoio');

  const handleAgendar = () => {
    Alert.alert(
      'Solicitação enviada!',
      'Você receberá um contato em breve. Sem compromisso — você decide se avança.',
      [{ text: 'Perfeito', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: spacing.sm }}>
            <Ionicons name="arrow-back" size={22} color={colors.td} />
          </TouchableOpacity>
          <Text style={styles.headerTag}>Terapia Travessia</Text>
          <ScriptTitle size={24}>Agende sua sessão</ScriptTitle>
          <Text style={styles.headerSub}>Um próximo passo, no seu tempo</Text>
        </View>

        {/* Citação */}
        <Card style={styles.quoteCard}>
          <QuoteText style={{ fontSize: 13 }}>
            "Ao usar o aplicativo, você criou um espaço de cuidado. O próximo passo pode ser um apoio ainda mais personalizado."
          </QuoteText>
        </Card>

        {/* Formatos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Escolha o formato</Text>
          {formatos.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[styles.formatoCard, formatoSel === f.id && styles.formatoCardSel]}
              onPress={() => setFormatoSel(f.id)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.formatoTop}>
                  <Text style={[styles.formatoTitulo, formatoSel === f.id && { color: colors.lav6 }]}>{f.titulo}</Text>
                  {f.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>Popular</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.formatoSub}>{f.sub}</Text>
              </View>
              <View style={[styles.radio, formatoSel === f.id && styles.radioOn]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Motivação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Como você está se sentindo?</Text>
          {motivacoes.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.motiCard, motivacaoSel === m.id && styles.motiCardSel]}
              onPress={() => setMotiSel(m.id)}
            >
              <View style={[styles.radio, motivacaoSel === m.id && styles.radioOn]} />
              <Text style={[styles.motiText, motivacaoSel === m.id && { color: colors.lav6, fontFamily: fonts.bodyBold }]}>{m.texto}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.section}>
          <Button title="Quero dar esse passo" onPress={handleAgendar} variant="peach" />
          <Text style={styles.semComp}>Sem compromisso. Você decide se avança.</Text>
          <Text style={styles.disclaimer}>Este aplicativo não substitui acompanhamento médico ou psicológico profissional.</Text>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  headerTag: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  headerSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 3 },
  quoteCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: '#FDF5F5', borderColor: '#EDD0D0' },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: spacing.sm },
  formatoCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: 8,
  },
  formatoCardSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  formatoTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  formatoTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  formatoSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tm },
  popularBadge: { backgroundColor: colors.lav1, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: colors.lav3 },
  popularText: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.lav6 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.tl },
  radioOn: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  motiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm, marginBottom: 6,
  },
  motiCardSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  motiText: { fontFamily: fonts.body, fontSize: 13, color: colors.td },
  semComp: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, textAlign: 'center', marginTop: spacing.sm },
  disclaimer: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, textAlign: 'center', marginTop: 4, lineHeight: 14 },
});
