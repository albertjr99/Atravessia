import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, TextInput, Modal, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { cartasInspiradoras } from '../../data';
import { ScriptTitle, Card, Button } from '../../components';
import { useApp } from '../../hooks/AppContext';

const ilustracao = require('../../../assets/images/cartas_envelope.png');

export default function CartasScreen({ navigation }) {
  const { cartasEscritas, adicionarCarta, temAcesso } = useApp();
  const [tab, setTab] = useState('ler');
  const [modalVisible, setModalVisible] = useState(false);
  const [nova, setNova] = useState({ titulo: '', conteudo: '' });

  const podeEscrever = temAcesso(1);

  const handleSalvar = () => {
    if (!nova.titulo || !nova.conteudo) return;
    adicionarCarta(nova);
    setNova({ titulo: '', conteudo: '' });
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Cartas</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'ler' && styles.tabAtivo]} onPress={() => setTab('ler')}>
          <Text style={[styles.tabText, tab === 'ler' && styles.tabTextAtivo]}>Ler cartas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'minhas' && styles.tabAtivo]} onPress={() => setTab('minhas')}>
          <Text style={[styles.tabText, tab === 'minhas' && styles.tabTextAtivo]}>Minhas cartas</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.lista}>
        {tab === 'ler' ? (
          cartasInspiradoras.map(c => (
            <Card key={c.id} style={styles.cartaCard}>
              <Text style={styles.cartaTitulo}>{c.titulo}</Text>
              <Text style={styles.cartaConteudo}>{c.conteudo}</Text>
              <Text style={styles.cartaAutor}>— {c.autor}</Text>
            </Card>
          ))
        ) : podeEscrever ? (
          cartasEscritas.length === 0 ? (
            <View style={styles.empty}>
              <Image source={ilustracao} style={styles.emptyIlustracao} resizeMode="contain" />
              <Text style={styles.emptyText}>Suas cartas aparecerão aqui.</Text>
            </View>
          ) : (
            [...cartasEscritas].reverse().map(c => (
              <Card key={c.id} style={styles.cartaCard}>
                <Text style={styles.cartaTitulo}>{c.titulo}</Text>
                <Text style={styles.cartaConteudo}>{c.conteudo}</Text>
                <Text style={styles.cartaAutor}>{new Date(c.data).toLocaleDateString('pt-BR')}</Text>
              </Card>
            ))
          )
        ) : (
          <View style={styles.empty}>
            <Ionicons name="lock-closed-outline" size={36} color={colors.lav4} />
            <Text style={styles.emptyText}>Escrever cartas está disponível a partir do Plano 1.</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Planos')} style={styles.lockBtn}>
              <Text style={styles.lockBtnText}>Ver planos</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {tab === 'minhas' && podeEscrever && (
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Escrever carta</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.td} />
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder="Título"
              placeholderTextColor={colors.tl}
              style={styles.input}
              value={nova.titulo}
              onChangeText={t => setNova(p => ({ ...p, titulo: t }))}
            />
            <TextInput
              placeholder="Escreva sua carta..."
              placeholderTextColor={colors.tl}
              style={[styles.input, styles.inputMulti]}
              multiline
              value={nova.conteudo}
              onChangeText={t => setNova(p => ({ ...p, conteudo: t }))}
            />
            <Text style={styles.moderacao}>Todas as cartas passam por moderação antes de poderem ser compartilhadas com a comunidade.</Text>
            <Button title="Salvar carta" onPress={handleSalvar} style={{ marginTop: spacing.md }} />
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
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 8, marginBottom: spacing.sm },
  tab: { flex: 1, paddingVertical: 8, borderRadius: radius.full, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabAtivo: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  tabText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  tabTextAtivo: { color: 'white', fontFamily: fonts.bodyBold },
  lista: { paddingHorizontal: spacing.lg, gap: 10, paddingBottom: spacing.xxl },
  cartaCard: { padding: spacing.md },
  cartaTitulo: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: 6 },
  cartaConteudo: { fontFamily: fonts.quote, fontSize: 13, fontStyle: 'italic', color: colors.tm, lineHeight: 20 },
  cartaAutor: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 8, textAlign: 'right' },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: 8 },
  emptyIlustracao: { width: 72, height: 72 },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center' },
  lockBtn: { marginTop: spacing.sm, backgroundColor: colors.lav4, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  lockBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.lg,
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.lav5,
    alignItems: 'center', justifyContent: 'center', ...shadow.soft,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(74,63,85,0.35)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  inputMulti: { height: 100, textAlignVertical: 'top' },
  moderacao: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, lineHeight: 14 },
});
