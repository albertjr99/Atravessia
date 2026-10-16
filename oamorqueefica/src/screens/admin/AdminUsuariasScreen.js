import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, corPlano, Degrade } from './adminEstilo';
import AdminLayout from './AdminLayout';

const PLANO_NOME = { 0: 'Perceber', 1: 'Acolher', 2: 'Compreender', 3: 'Evoluir' };
const PLANO_TEXTO = { perceber: 0, acolher: 1, compreender: 2, evoluir: 3 };

// O painel web grava o plano como texto ('acolher') e o app como número (0..3);
// os dois formatos convivem no Firestore. Aqui tudo vira número.
function planoDe(u) {
  const p = u?.plano;
  if (typeof p === 'number') return p;
  const n = Number(p);
  if (p !== '' && p != null && Number.isFinite(n)) return n;
  return PLANO_TEXTO[String(p || '').toLowerCase()] ?? 0;
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
        <Text style={styles.sobre}>Pessoas</Text>
        <Text style={styles.pageTitle}>Usuárias</Text>
        <Text style={styles.pageSub}>Gerencie planos e acessos das usuárias cadastradas.</Text>

        {!!erro && (
          <View style={styles.erroBox}>
            <Ionicons name="alert-circle-outline" size={18} color={acento('rosa').texto} />
            <Text style={styles.erroTxt}>{erro}</Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statN}>{usuarias.length}</Text>
            <Text style={styles.statL}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statN, { color: corPlano(0).texto }]}>{totalGratis}</Text>
            <Text style={styles.statL}>Perceber</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statN, { color: corPlano(1).texto }]}>{totalPago}</Text>
            <Text style={styles.statL}>Acolher</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statN, { color: acento('dourado').texto }]}>{totalEmpresa}</Text>
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
        <View style={[styles.chipRow, { marginBottom: spacing.md, flexWrap: 'wrap' }]}>
          {[{ id: 'todos', label: 'Todos' }, ...[0, 1, 2, 3].map(n => ({ id: String(n), label: planosDocs[n]?.nome || PLANO_NOME[n] })), { id: 'empresa', label: 'Empresa' }].map(f => (
            <TouchableOpacity key={f.id} style={[styles.chip, filtroPlano === f.id && styles.chipSel]} onPress={() => setFiltroPlano(f.id)}>
              <Text style={[styles.chipText, filtroPlano === f.id && styles.chipTextSel]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {lista.length > 0 && <View style={styles.lista}>
        {lista.map((u, i) => {
          const plano = planoDe(u);
          const cor = corPlano(plano);
          return (
            <View key={u.id} style={[styles.item, i > 0 && styles.itemDiv]}>
              <View style={[styles.avatar, { backgroundColor: cor.fundo }]}>
                <Text style={[styles.avatarLetter, { color: cor.texto }]}>
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
                    <Ionicons name="business-outline" size={13} color={acento('dourado').tinta} />
                    <Text style={styles.empresaText}>
                      {u.empresa ? `Empresa: ${u.empresa}` : 'Via empresa/parceria'}
                    </Text>
                  </View>
                )}
                {u.acessoTotal && (
                  <View style={[styles.empresaTag, { marginTop: 2 }]}>
                    <Ionicons name="shield-checkmark-outline" size={13} color={acento('lilas').tinta} />
                    <Text style={[styles.empresaText, { color: acento('lilas').texto }]}>Acesso Total</Text>
                  </View>
                )}
                {(() => { const d = cortesiaDiasRestantes(u); return d ? (
                  <View style={[styles.empresaTag, { marginTop: 2 }]}>
                    <Ionicons name="gift-outline" size={13} color={acento('pessego').tinta} />
                    <Text style={[styles.empresaText, { color: acento('pessego').texto }]}>Cortesia: {d}</Text>
                  </View>
                ) : null; })()}
              </View>
              <TouchableOpacity style={[styles.planoBadge, { backgroundColor: cor.fundo }]} onPress={() => handleAlterarPlano(u)}>
                <View style={[styles.planoPonto, { backgroundColor: cor.tinta }]} />
                <Text style={[styles.planoBadgeText, { color: cor.texto }]}>{planosDocs[plano]?.nome || PLANO_NOME[plano] || 'Perceber'}</Text>
                <Ionicons name="chevron-down" size={14} color={cor.texto} />
              </TouchableOpacity>
            </View>
          );
        })}
        </View>}

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
                    <Ionicons name={sel ? 'radio-button-on' : 'radio-button-off'} size={20} color={corPlano(n).tinta} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planoOpcaoText}>{d.nome || PLANO_NOME[n]}</Text>
                      {!!d.descricao && <Text style={styles.planoOpcaoDesc} numberOfLines={2}>{d.descricao}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={[styles.planoOpcao, planoModal.usuaria?.acessoTotal && styles.planoOpcaoSel]} onPress={toggleAcessoTotal}>
                <Ionicons name={planoModal.usuaria?.acessoTotal ? 'shield-checkmark' : 'shield-checkmark-outline'} size={20} color={acento('lilas').tinta} />
                <Text style={styles.planoOpcaoText}>
                  {planoModal.usuaria?.acessoTotal ? 'Acesso Total — remover' : 'Acesso Total (admin)'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.planoOpcao} onPress={abrirCortesia}>
                <Ionicons name="gift-outline" size={20} color={acento('pessego').tinta} />
                <Text style={[styles.planoOpcaoText, { color: acento('pessego').texto }]}>Cortesia temporária...</Text>
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
              <Degrade />
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

const styles = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  statBox: { ...est.vidro(20), flex: 1, alignItems: 'center', paddingVertical: 14 },
  statN: { fontFamily: 'Figtree_800ExtraBold', fontSize: 24, color: colors.titulo },
  statL: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2, marginTop: 2 },
  searchRow: { ...est.campo(), flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.td, paddingVertical: 12 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipText: est.chipTxt(),
  chipTextSel: est.chipTxtSel(),
  lista: { ...est.vidro(26), paddingVertical: 2 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 13, paddingHorizontal: 16 },
  itemDiv: est.divisoria(),
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  avatarLetter: { fontFamily: fonts.serif, fontSize: 21 },
  nome: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo },
  nomeCompleto: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2 },
  email: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 1 },
  detalhe: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tl, marginTop: 1 },
  empresaTag: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  empresaText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: acento('dourado').texto },
  planoBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11, marginTop: 2 },
  planoPonto: { width: 7, height: 7, borderRadius: 4 },
  planoBadgeText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  erroBox: { ...est.aviso('rosa'), alignItems: 'center', marginBottom: spacing.md },
  erroTxt: est.avisoTxt('rosa'),
  emptyText: { ...est.legenda(), textAlign: 'center', marginTop: spacing.xl },
  modalOverlay: { ...est.veu(), alignItems: 'center', justifyContent: 'center', padding: 24 },
  cortesiaBox: { ...est.modal(), padding: spacing.lg, width: '100%', maxWidth: 400 },
  cortesiaTitulo: { ...est.modalTitulo(), marginBottom: 2 },
  cortesiaSub: est.legenda(),
  planoOpcoesCol: { marginTop: 16, gap: 2 },
  planoOpcao: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 16 },
  planoOpcaoSel: { backgroundColor: colors.lav1 },
  planoOpcaoText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.td },
  planoOpcaoDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2, lineHeight: 18 },
  diasInput: { ...est.campo(), marginBottom: 14 },
  concederBtn: { ...est.botao(), marginBottom: 8 },
  concederBtnText: est.botaoTxt(),
  revogarBtn: { ...est.botaoSec(), borderColor: acento('rosa').fundo },
  revogarBtnText: { ...est.botaoSecTxt(), color: colors.roseTexto },
}), { escalar: false });
