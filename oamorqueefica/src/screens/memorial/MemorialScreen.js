import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, TextInput, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { ScriptTitle, QuoteText, Button, Card, LavandaBg } from '../../components';
import { hojeStrBR, formatDataBR } from '../../utils/date';
import { useApp } from '../../hooks/AppContext';

const ilustracao = require('../../../assets/images/memorial_coracao.png');

export default function MemorialScreen({ navigation }) {
  const { memorias, adicionarMemoria } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [novaMemoria, setNovaMemoria] = useState({ titulo: '', conteudo: '' });

  const handleSalvar = () => {
    if (!novaMemoria.titulo || !novaMemoria.conteudo) return;
    adicionarMemoria({
      titulo: novaMemoria.titulo,
      conteudo: novaMemoria.conteudo,
      tipo: 'texto',
      data: hojeStrBR(),
    });
    setNovaMemoria({ titulo: '', conteudo: '' });
    setModalVisible(false);
  };

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
            <ScriptTitle size={24}>Caixa de Memórias</ScriptTitle>
            <Text style={styles.sub}>Um espaço sagrado só seu</Text>
          </View>
          <Image source={ilustracao} style={styles.headerIlustracao} resizeMode="contain" />
        </View>

        {/* Intro */}
        <Card style={styles.introCard}>
          <QuoteText style={{ fontSize: 13, lineHeight: 20 }}>
            "Guardar uma memória não é viver no passado. É honrar o que foi real e continua sendo parte de quem você é."
          </QuoteText>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={16} color="white" />
            <Text style={styles.addBtnText}>Adicionar memória</Text>
          </TouchableOpacity>
        </Card>

        {/* Memórias */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suas memórias</Text>
          {memorias.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={36} color={colors.lav3} />
              <Text style={styles.emptyText}>Suas memórias aparecerão aqui.</Text>
              <Text style={styles.emptySubText}>Toque em "Adicionar memória" para começar.</Text>
            </View>
          ) : (
            memorias.map(m => (
              <Card key={m.id} style={styles.memoriaCard}>
                <View style={styles.memoriaHeader}>
                  <View style={styles.memoriaIcon}>
                    <Ionicons name="heart-outline" size={16} color={colors.lav4} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memoriaTitulo}>{m.titulo}</Text>
                    <Text style={styles.memoriaData}>{formatDataBR(m.data)}</Text>
                  </View>
                </View>
                <Text style={styles.memoriaConteudo}>{m.conteudo}</Text>
              </Card>
            ))
          )}
        </View>

        {/* Carta */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Escreva uma carta</Text>
          <Card style={styles.cartaCard}>
            <Text style={styles.cartaIntro}>Expressar sentimentos por escrito é uma forma poderosa de elaboração. Escreva para quem partiu, para si mesma, ou para o futuro.</Text>
            <TouchableOpacity style={styles.cartaBtn} onPress={() => navigation.navigate('Cartas')}>
              <Text style={styles.cartaBtnText}>Ir para Cartas</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.lav5} />
            </TouchableOpacity>
          </Card>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova memória</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.td} />
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder="Título da memória"
              placeholderTextColor={colors.tl}
              style={styles.input}
              value={novaMemoria.titulo}
              onChangeText={t => setNovaMemoria(p => ({ ...p, titulo: t }))}
            />
            <TextInput
              placeholder="Escreva aqui sua memória..."
              placeholderTextColor={colors.tl}
              style={[styles.input, styles.inputMulti]}
              multiline
              value={novaMemoria.conteudo}
              onChangeText={t => setNovaMemoria(p => ({ ...p, conteudo: t }))}
            />
            <Button title="Salvar memória" onPress={handleSalvar} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },
  headerIlustracao: { width: 64, height: 64 },
  introCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.rosa || '#D8B4B6', borderRadius: radius.full, paddingVertical: 10, marginTop: spacing.md },
  addBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: 8 },
  emptyText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.tm },
  emptySubText: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, textAlign: 'center' },
  memoriaCard: { marginBottom: spacing.sm, padding: spacing.md },
  memoriaHeader: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: spacing.sm },
  memoriaIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  memoriaTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  memoriaData: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 1 },
  memoriaConteudo: { fontFamily: fonts.quote, fontSize: 12, fontStyle: 'italic', color: colors.tm, lineHeight: 18 },
  cartaCard: { padding: spacing.md },
  cartaIntro: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, lineHeight: 18, marginBottom: spacing.md },
  cartaBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cartaBtnText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(74,63,85,0.35)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  inputMulti: { height: 100, textAlignVertical: 'top' },
});
