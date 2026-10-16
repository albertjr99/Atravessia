import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';
import { est, acento, Degrade } from './adminEstilo';
import { ICONES_VITORIA, iconeDaVitoria } from '../../data/iconesVitoria';

function SeletorIcone({ valor, onChange }) {
  const atual = iconeDaVitoria({ icone: valor }, true);
  return (
    <View style={s.icones}>
      {ICONES_VITORIA.map(ic => {
        const sel = atual === ic.id;
        return (
          <TouchableOpacity
            key={ic.id}
            style={[s.iconeBtn, sel && s.iconeBtnSel]}
            onPress={() => onChange(ic.id)}
            accessibilityLabel={ic.nome}
          >
            <Ionicons name={`${ic.id}-outline`} size={19} color={sel ? colors.lilasTexto : colors.texto2} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const VITORIAS_PADRAO = [
  'Saí de casa',
  'Consegui dormir',
  'Encontrei amigos',
  'Fiz algo prazeroso',
  'Me alimentei bem',
  'Busquei minha rede de apoio',
  'Concluí uma jornada',
  'Ouvi música',
  'Me hidratei bem',
  'Pratiquei respiração',
];

export default function AdminVitoriasScreen() {
  const [opcoes, setOpcoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novoLabel, setNovoLabel] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [novoIcone, setNovoIcone] = useState('star');
  const [trocandoIcone, setTrocandoIcone] = useState(null); // opção cujo ícone está sendo trocado

  useEffect(() => {
    // Sem orderBy: opções sem `criadoEm` sumiriam da lista. Ordena aqui.
    const unsub = onSnapshot(collection(db, 'vitoriasOpcoes'), (snap) => {
      setOpcoes(snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.criadoEm?.toMillis?.() ?? 0) - (b.criadoEm?.toMillis?.() ?? 0)));
      setCarregando(false);
    }, (e) => {
      setCarregando(false);
      Alert.alert('Erro', `Não foi possível carregar as vitórias.${e?.message ? `\n${e.message}` : ''}`);
    });
    return unsub;
  }, []);

  const salvarIcone = async (icone) => {
    const item = trocandoIcone;
    setTrocandoIcone(null);
    if (!item) return;
    try {
      await updateDoc(doc(db, 'vitoriasOpcoes', item.id), { icone });
    } catch {
      Alert.alert('Erro', 'Não foi possível trocar o ícone.');
    }
  };

  const handleAdicionar = async () => {
    const label = novoLabel.trim();
    if (!label) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, 'vitoriasOpcoes'), {
        label,
        icone: novoIcone,
        ativo: true,
        criadoEm: serverTimestamp(),
      });
      setNovoLabel('');
      setNovoIcone('star');
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar a vitória.');
    } finally {
      setSalvando(false);
    }
  };

  const handleToggle = async (item) => {
    try {
      await updateDoc(doc(db, 'vitoriasOpcoes', item.id), { ativo: !item.ativo });
    } catch {
      Alert.alert('Erro', 'Não foi possível alterar o status.');
    }
  };

  const handleRestaurarPadrao = () => {
    const existentes = opcoes.map(o => o.label);
    const faltando = VITORIAS_PADRAO.filter(l => !existentes.includes(l));
    if (faltando.length === 0) {
      Alert.alert('Tudo certo', 'Todas as opções padrão já estão cadastradas.');
      return;
    }
    Alert.alert(
      'Restaurar padrão',
      `Adicionar ${faltando.length} opção(ões) padrão que estão faltando?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Adicionar',
          onPress: async () => {
            setSalvando(true);
            try {
              for (const label of faltando) {
                await addDoc(collection(db, 'vitoriasOpcoes'), { label, icone: 'star', ativo: true, criadoEm: serverTimestamp() });
              }
              Alert.alert('Pronto', `${faltando.length} opção(ões) adicionada(s).`);
            } catch {
              Alert.alert('Erro', 'Não foi possível restaurar as opções padrão.');
            } finally {
              setSalvando(false);
            }
          },
        },
      ]
    );
  };

  const handleExcluir = (item) => {
    Alert.alert(
      'Excluir vitória',
      `Remover "${item.label}" da lista?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'vitoriasOpcoes', item.id));
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir.');
            }
          },
        },
      ]
    );
  };

  return (
    <AdminLayout currentScreen="AdminVitorias">
      <AdminSubTabs grupo="jornada" atual="AdminVitorias" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.sobre}>Jornada</Text>
        <Text style={s.title}>Pequenas Vitórias</Text>
        <Text style={s.sub}>Gerencie as opções disponíveis para as usuárias registrarem suas conquistas.</Text>

        {/* Adicionar nova */}
        <View style={s.addCard}>
          <Text style={s.addTitle}>Adicionar nova vitória</Text>
          <View style={s.addRow}>
            <TextInput
              style={s.addInput}
              placeholder="Ex: Saí de casa hoje"
              placeholderTextColor={colors.tl}
              value={novoLabel}
              onChangeText={setNovoLabel}
              onSubmitEditing={handleAdicionar}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[s.addBtn, (!novoLabel.trim() || salvando) && { opacity: 0.5 }]}
              onPress={handleAdicionar}
              disabled={!novoLabel.trim() || salvando}
            >
              <Degrade raio={14} />
              {salvando
                ? <ActivityIndicator size="small" color="white" />
                : <Ionicons name="add" size={20} color="white" />}
            </TouchableOpacity>
          </View>
          <Text style={s.iconeLabel}>Ícone</Text>
          <SeletorIcone valor={novoIcone} onChange={setNovoIcone} />
        </View>

        {/* Lista */}
        <View style={s.listCard}>
          <Text style={s.listTitle}>Opções cadastradas ({opcoes.length})</Text>
          {carregando ? (
            <ActivityIndicator color={colors.lav4} style={{ marginTop: 20 }} />
          ) : opcoes.length === 0 ? (
            <Text style={s.empty}>Nenhuma vitória cadastrada ainda.</Text>
          ) : (
            opcoes.map((item, i) => (
              <View key={item.id} style={[s.itemRow, i > 0 && s.itemDiv]}>
                <TouchableOpacity
                  style={[s.toggleBtn, item.ativo && s.toggleBtnOn]}
                  onPress={() => handleToggle(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={item.ativo ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={item.ativo ? acento('salvia').tinta : colors.tl}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={s.itemIcone} onPress={() => setTrocandoIcone(item)} accessibilityLabel="Trocar ícone">
                  <Ionicons name={iconeDaVitoria(item)} size={18} color={acento('dourado').tinta} />
                </TouchableOpacity>
                <Text style={[s.itemLabel, !item.ativo && s.itemLabelOff]}>{item.label}</Text>
                <TouchableOpacity onPress={() => handleExcluir(item)} style={s.delBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.roseTexto} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={s.padrao} onPress={handleRestaurarPadrao} disabled={salvando}>
          <Ionicons name="refresh-outline" size={16} color={colors.lilasTexto} />
          <Text style={s.padraoTxt}>Restaurar opções padrão</Text>
        </TouchableOpacity>

        <Modal visible={!!trocandoIcone} transparent animationType="fade" onRequestClose={() => setTrocandoIcone(null)}>
          <Pressable style={s.modalFundo} onPress={() => setTrocandoIcone(null)}>
            <Pressable style={s.modalCaixa} onPress={() => {}}>
              <Text style={s.addTitle}>Ícone de “{trocandoIcone?.label}”</Text>
              <SeletorIcone valor={trocandoIcone?.icone} onChange={salvarIcone} />
            </Pressable>
          </Pressable>
        </Modal>

        <Text style={s.hint}>
          Toque no ícone de uma vitória para trocá-lo. Vitórias desativadas não aparecem para as usuárias, mas os registros anteriores são mantidos.
        </Text>
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  icones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  iconeBtn: {
    width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.cardSolido, alignItems: 'center', justifyContent: 'center',
  },
  iconeBtnSel: { backgroundColor: colors.lav1, borderColor: colors.lav3 },
  iconeLabel: est.rotulo(),
  itemIcone: { ...est.pilula(38), backgroundColor: acento('dourado').fundo, marginRight: 4 },
  modalFundo: { ...est.veu(), alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCaixa: { ...est.modal(), width: '100%', maxWidth: 440, padding: spacing.lg },
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  title: est.titulo(),
  sub: { ...est.subtitulo(), marginBottom: spacing.lg },

  addCard: { ...est.vidro(26), padding: 18, marginBottom: spacing.md },
  addTitle: { ...est.cartaoTitulo(), marginBottom: 10 },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: { ...est.campo(), flex: 1 },
  addBtn: { ...est.botao(), width: 50, minHeight: 50, paddingHorizontal: 0, borderRadius: 14 },

  listCard: { ...est.vidro(26), paddingVertical: 12, paddingHorizontal: 16 },
  listTitle: { ...est.cartaoTitulo(), marginBottom: 4 },
  empty: { ...est.legenda(), textAlign: 'center', paddingVertical: spacing.lg },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  itemDiv: est.divisoria(),
  toggleBtn: { padding: 2 },
  toggleBtnOn: {},
  itemLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.td },
  itemLabelOff: { color: colors.tl, textDecorationLine: 'line-through' },
  delBtn: { padding: 6 },

  padrao: { ...est.botaoSec(), marginTop: spacing.md, alignSelf: 'center' },
  padraoTxt: est.botaoSecTxt(),
  hint: { ...est.dica(), marginTop: spacing.md, textAlign: 'center' },
}), { escalar: false });
