import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Card } from '../../components';
import AdminLayout from './AdminLayout';

const PLANO_NOME = { 0: 'Perceber', 1: 'Acolher', 2: 'Compreender', 3: 'Evoluir' };
const PLANO_COR = { 0: colors.sage, 1: colors.lav5, 2: '#7B5EA7', 3: '#C0843F' };
const PLANO_TEXTO = { perceber: 0, acolher: 1, compreender: 2, evoluir: 3 };

// O painel web grava o plano como texto ('acolher') e o app como número (0..3);
// os dois formatos convivem no Firestore. Aqui tudo vira número.
function planoDe(u) {
  const p = u?.plano;
  if (typeof p === 'number') return p;
  return PLANO_TEXTO[p] ?? 0;
}

export default function AdminUsuariasScreen({ navigation }) {
  const [usuarias, setUsuarias] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroPlano, setFiltroPlano] = useState('todos');
  const [planoModal, setPlanoModal] = useState({ vis: false, usuaria: null });
  const [cortesiaModal, setCortesiaModal] = useState({ vis: false, usuaria: null, dias: '30' });
  // Nome e descrição de cada plano vêm de planos/{0..3} — os mesmos documentos
  // editados em "Preços e planos". Nesta aba NÃO se mostra preço nenhum
  // (precoLabel/subtitulo são ignorados de propósito).
  const [planosDocs, setPlanosDocs] = useState({});
  const [erro, setErro] = useState('');

  useEffect(() => onSnapshot(collection(db, 'planos'), (snap) => {
    const m = {};
    snap.docs.forEach(d => { m[d.id] = d.data(); });
    setPlanosDocs(m);
  }, (e) => setErro(`Não foi possível carregar os nomes dos planos: ${e?.message || 'erro desconhecido'}`)), []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), (snap) => {
      const todos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role !== 'admin')
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setUsuarias(todos);
    }, (e) => setErro(`Não foi possível carregar as usuárias: ${e?.message || 'erro desconhecido'}`));
    return unsub;
  }, []);

  const avisarErro = (e) => Alert.alert('Erro', `Não foi possível salvar a alteração.${e?.message ? `\n${e.message}` : ''}`);

  const handleAlterarPlano = (usuaria) => {
    setPlanoModal({ vis: true, usuaria });
  };

  const fecharPlanoModal = () => setPlanoModal({ vis: false, usuaria: null });

  // Trocar o plano, conceder/remover acesso total ou dar uma cortesia são
  // ações mutuamente exclusivas — cada uma limpa as demais. Sem isso, uma
  // cortesia concedida antes ficava "esquecida" no documento e continuava
  // valendo mesmo depois de o plano ser alterado explicitamente.
  const setPlano = (plano) => {
    updateDoc(doc(db, 'usuarios', planoModal.usuaria.id), { plano, acessoTotal: false, cortesia: null }).catch(avisarErro);
    fecharPlanoModal();
  };

  const toggleAcessoTotal = () => {
    const u = planoModal.usuaria;
    updateDoc(doc(db, 'usuarios', u.id), { acessoTotal: !(u.acessoTotal === true), cortesia: null }).catch(avisarErro);
    fecharPlanoModal();
  };

  const abrirCortesia = () => {
    const u = planoModal.usuaria;
    fecharPlanoModal();
    setCortesiaModal({ vis: true, usuaria: u, dias: '30' });
  };

  const concederCortesia = async () => {
    const { usuaria, dias } = cortesiaModal;
    const numDias = parseInt(dias, 10) || 30;
    const expiracao = Timestamp.fromDate(new Date(Date.now() + numDias * 86400000));
    // acessoTotal: false explícito — se a usuária já tivesse acesso total
    // concedido antes, ele tornaria o prazo da cortesia inútil (acesso
    // permanente independente da data de expiração).
    try {
      await updateDoc(doc(db, 'usuarios', usuaria.id), { cortesia: { ativo: true, expiracao }, acessoTotal: false });
    } catch (e) { avisarErro(e); return; }
    setCortesiaModal({ vis: false, usuaria: null, dias: '30' });
  };

  const revogarCortesia = async () => {
    try {
      await updateDoc(doc(db, 'usuarios', cortesiaModal.usuaria.id), { cortesia: { ativo: false } });
    } catch (e) { avisarErro(e); return; }
    setCortesiaModal({ vis: false, usuaria: null, dias: '30' });
  };

  const cortesiaDiasRestantes = (u) => {
    if (!u.cortesia?.ativo) return null;
    if (!u.cortesia.expiracao) return '∞';
    try {
      const exp = u.cortesia.expiracao.toDate ? u.cortesia.expiracao.toDate() : new Date(u.cortesia.expiracao);
      const dias = Math.ceil((exp - new Date()) / 86400000);
      return dias > 0 ? `${dias}d` : null;
    } catch { return null; }
  };

  const lista = usuarias.filter(u => {
    const matchBusca = !busca || [u.nome, u.apelido, u.email, u.cidade].some(
      v => v?.toLowerCase().includes(busca.toLowerCase())
    );
    if (filtroPlano === 'empresa') return matchBusca && u.linkEmpresa === true;
    const matchPlano = filtroPlano === 'todos' || String(planoDe(u)) === filtroPlano;
    return matchBusca && matchPlano;
  });

  const totalGratis = usuarias.filter(u => planoDe(u) === 0).length;
  const totalPago = usuarias.filter(u => planoDe(u) > 0).length;
  const totalEmpresa = usuarias.filter(u => u.linkEmpresa === true).length;

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminUsuarias">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Usuárias</Text>
        <Text style={styles.pageSub}>Gerencie planos e acessos das usuárias cadastradas.</Text>

        {!!erro && (
          <View style={styles.erroBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.roseFg} />
            <Text style={styles.erroTxt}>{erro}</Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statN}>{usuarias.length}</Text>
            <Text style={styles.statL}>Total</Text>
          </View>
          <View style={[styles.statBox, { borderColor: colors.sage }]}>
            <Text style={[styles.statN, { color: colors.sage }]}>{totalGratis}</Text>
            <Text style={styles.statL}>Perceber</Text>
          </View>
          <View style={[styles.statBox, { borderColor: colors.lav4 }]}>
            <Text style={[styles.statN, { color: colors.lav4 }]}>{totalPago}</Text>
            <Text style={styles.statL}>Acolher</Text>
          </View>
          <View style={[styles.statBox, { borderColor: colors.gold }]}>
            <Text style={[styles.statN, { color: colors.gold }]}>{totalEmpresa}</Text>
            <Text style={styles.statL}>Empresa</Text>
          </View>
        </View>

        {/* Busca */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={colors.tl} />
          <TextInput
            style={styles.searchInput} placeholder="Buscar por nome, e-mail ou cidade..."
            placeholderTextColor={colors.tl} value={busca} onChangeText={setBusca}
          />
          {busca ? (
            <TouchableOpacity onPress={() => setBusca('')}>
              <Ionicons name="close-circle" size={16} color={colors.tl} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filtro por plano */}
        <View style={[styles.chipRow, { marginBottom: spacing.md }]}>
          {[{ id: 'todos', label: 'Todos' }, ...[0, 1, 2, 3].map(n => ({ id: String(n), label: planosDocs[n]?.nome || PLANO_NOME[n] })), { id: 'empresa', label: 'Empresa' }].map(f => (
            <TouchableOpacity key={f.id} style={[styles.chip, filtroPlano === f.id && styles.chipSel]} onPress={() => setFiltroPlano(f.id)}>
              <Text style={[styles.chipText, filtroPlano === f.id && styles.chipTextSel]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {lista.map(u => {
          const plano = planoDe(u);
          const cor = PLANO_COR[plano] || colors.tl;
          return (
            <Card key={u.id} style={styles.item}>
              <View style={[styles.avatar, { backgroundColor: cor + '22' }]}>
                <Text style={[styles.avatarLetter, { color: cor }]}>
                  {(u.apelido || u.nome || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{u.apelido || u.nome}</Text>
                {u.apelido && u.nome !== u.apelido && (
                  <Text style={styles.nomeCompleto}>{u.nome}</Text>
                )}
                <Text style={styles.email}>{u.email}</Text>
                {(u.cidade || u.telefone) ? (
                  <Text style={styles.detalhe}>{[u.cidade, u.telefone].filter(Boolean).join(' · ')}</Text>
                ) : null}
                {u.linkEmpresa && (
                  <View style={styles.empresaTag}>
                    <Ionicons name="business-outline" size={10} color={colors.gold} />
                    <Text style={styles.empresaText}>
                      {u.empresa ? `Empresa: ${u.empresa}` : 'Via empresa/parceria'}
                    </Text>
                  </View>
                )}
                {u.acessoTotal && (
                  <View style={[styles.empresaTag, { marginTop: 2 }]}>
                    <Ionicons name="shield-checkmark-outline" size={10} color={colors.lav5} />
                    <Text style={[styles.empresaText, { color: colors.lav5 }]}>Acesso Total</Text>
                  </View>
                )}
                {(() => { const d = cortesiaDiasRestantes(u); return d ? (
                  <View style={[styles.empresaTag, { marginTop: 2 }]}>
                    <Ionicons name="gift-outline" size={10} color={colors.peach2} />
                    <Text style={[styles.empresaText, { color: colors.peach2 }]}>Cortesia: {d}</Text>
                  </View>
                ) : null; })()}
              </View>
              <TouchableOpacity style={[styles.planoBadge, { backgroundColor: cor + '22', borderColor: cor }]} onPress={() => handleAlterarPlano(u)}>
                <Text style={[styles.planoBadgeText, { color: cor }]}>{planosDocs[plano]?.nome || PLANO_NOME[plano] || 'Perceber'}</Text>
                <Ionicons name="chevron-down" size={11} color={cor} />
              </TouchableOpacity>
            </Card>
          );
        })}

        {lista.length === 0 && (
          <Text style={styles.emptyText}>
            {busca || filtroPlano !== 'todos' ? 'Nenhuma usuária encontrada.' : 'Nenhuma usuária cadastrada ainda.'}
          </Text>
        )}
      </ScrollView>

      <Modal visible={planoModal.vis} transparent animationType="fade" onRequestClose={fecharPlanoModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.cortesiaBox}>
            <Text style={styles.cortesiaTitulo}>Gerenciar acesso</Text>
            <Text style={styles.cortesiaSub}>
              {planoModal.usuaria?.apelido || planoModal.usuaria?.nome}
            </Text>
            <View style={styles.planoOpcoesCol}>
              {[0, 1, 2, 3].map(n => {
                const d = planosDocs[n] || {};
                const sel = planoDe(planoModal.usuaria) === n && !planoModal.usuaria?.acessoTotal;
                return (
                  <TouchableOpacity key={n} style={[styles.planoOpcao, sel && styles.planoOpcaoSel]} onPress={() => setPlano(n)}>
                    <Ionicons name={sel ? 'radio-button-on' : 'radio-button-off'} size={16} color={PLANO_COR[n]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planoOpcaoText}>{d.nome || PLANO_NOME[n]}</Text>
                      {!!d.descricao && <Text style={styles.planoOpcaoDesc} numberOfLines={2}>{d.descricao}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={[styles.planoOpcao, planoModal.usuaria?.acessoTotal && styles.planoOpcaoSel]} onPress={toggleAcessoTotal}>
                <Ionicons name={planoModal.usuaria?.acessoTotal ? 'shield-checkmark' : 'shield-checkmark-outline'} size={16} color={colors.lav5} />
                <Text style={styles.planoOpcaoText}>
                  {planoModal.usuaria?.acessoTotal ? 'Acesso Total — remover' : 'Acesso Total (admin)'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.planoOpcao} onPress={abrirCortesia}>
                <Ionicons name="gift-outline" size={16} color={colors.peach2} />
                <Text style={[styles.planoOpcaoText, { color: colors.peach2 }]}>Cortesia temporária...</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={{ marginTop: 12, paddingVertical: 8, alignItems: 'center' }} onPress={fecharPlanoModal}>
              <Text style={[styles.statL, { textAlign: 'center', fontSize: 13 }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={cortesiaModal.vis} transparent animationType="fade" onRequestClose={() => setCortesiaModal({ vis: false, usuaria: null, dias: '30' })}>
        <View style={styles.modalOverlay}>
          <View style={styles.cortesiaBox}>
            <Text style={styles.cortesiaTitulo}>Cortesia temporária</Text>
            <Text style={styles.cortesiaSub}>
              Acesso completo para {cortesiaModal.usuaria?.apelido || cortesiaModal.usuaria?.nome}
            </Text>
            <Text style={[styles.statL, { marginTop: 16, marginBottom: 4 }]}>Duração (dias):</Text>
            <TextInput
              style={styles.diasInput}
              value={cortesiaModal.dias}
              onChangeText={v => setCortesiaModal(p => ({ ...p, dias: v }))}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor={colors.tl}
            />
            <TouchableOpacity style={styles.concederBtn} onPress={concederCortesia}>
              <Text style={styles.concederBtnText}>Conceder acesso</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.revogarBtn} onPress={revogarCortesia}>
              <Text style={styles.revogarBtnText}>Revogar cortesia</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 8 }} onPress={() => setCortesiaModal({ vis: false, usuaria: null, dias: '30' })}>
              <Text style={[styles.statL, { textAlign: 'center' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  statN: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.lav5 },
  statL: { fontFamily: fonts.body, fontSize: 10, color: colors.tm, marginTop: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 10, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: colors.bg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 5, paddingHorizontal: 12 },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8, ...shadow.soft },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  avatarLetter: { fontFamily: fonts.bodyBold, fontSize: 16 },
  nome: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  nomeCompleto: { fontFamily: fonts.body, fontSize: 11, color: colors.tm },
  email: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 1 },
  detalhe: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 1 },
  empresaTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  empresaText: { fontFamily: fonts.body, fontSize: 10, color: colors.gold },
  planoBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.full, borderWidth: 1.5, paddingVertical: 5, paddingHorizontal: 9, marginTop: 2 },
  planoBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  erroBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF0EE', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  erroTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.roseFg },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', marginTop: spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  cortesiaBox: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, width: '100%', maxWidth: 360 },
  cortesiaTitulo: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td, marginBottom: 4 },
  cortesiaSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm },
  planoOpcoesCol: { marginTop: 16, gap: 4 },
  planoOpcao: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: radius.md },
  planoOpcaoSel: { backgroundColor: colors.lav1 },
  planoOpcaoText: { fontFamily: fonts.body, fontSize: 14, color: colors.td },
  planoOpcaoDesc: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tm, marginTop: 2, lineHeight: 16 },
  diasInput: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 15, color: colors.td, marginBottom: 14 },
  concederBtn: { backgroundColor: colors.lav4, borderRadius: radius.full, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  concederBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#fff' },
  revogarBtn: { borderRadius: radius.full, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.peach2 },
  revogarBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.peach2 },
});
