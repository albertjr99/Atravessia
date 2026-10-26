import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, BotaoAdmin } from './adminEstilo';
import AdminLayout from './AdminLayout';
import Recolhivel from '../../components/Recolhivel';
import { RECURSOS_IA, NOME_PLANO, normalizarRecursosIA } from '../../config/recursosIA';

// Liga/desliga cada função da AtravessIA e escolhe o plano mínimo de cada uma.
export default function AdminRecursosIAScreen({ navigation }) {
  const [cfg, setCfg] = useState(() => normalizarRecursosIA(null));
  const [salvando, setSalvando] = useState(false);
  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'recursosIA'),
    (snap) => setCfg(normalizarRecursosIA(snap.exists() ? snap.data() : null)), () => {}), []);

  const set = (chave, campo, v) => setCfg(p => ({ ...p, [chave]: { ...p[chave], [campo]: v } }));
  const salvar = async () => {
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'recursosIA'), { ...cfg, atualizadoEm: serverTimestamp() }, { merge: true });
      Alert.alert('', 'Funções da AtravessIA atualizadas no app.');
    } catch (e) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar.');
    } finally { setSalvando(false); }
  };

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminRecursosIA">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.sobre}>Configuração</Text>
        <Text style={s.pageTitle}>Funções da AtravessIA</Text>
        <Text style={s.pageSub}>Escolha quais funções aparecem no app e a partir de qual plano cada uma fica liberada.</Text>
        {RECURSOS_IA.map(r => (
          // Cada função num cartão recolhível: o liga/desliga fica sempre à vista
          // no cabeçalho; a descrição e o plano abrem ao tocar.
          <Recolhivel
            key={r.chave}
            titulo={r.rotulo}
            subtitulo={cfg[r.chave].ativo ? `Ligada · a partir do ${NOME_PLANO[cfg[r.chave].planoMinimo] || NOME_PLANO[0]}` : 'Desligada'}
            direita={<Switch value={!!cfg[r.chave].ativo} onValueChange={v => set(r.chave, 'ativo', v)} trackColor={{ true: colors.lav4 }} />}
          >
            <Text style={s.desc}>{r.descricao}</Text>
            <Text style={s.label}>Liberada a partir do plano</Text>
            <View style={s.planos}>
              {NOME_PLANO.map((p, i) => {
                const sel = cfg[r.chave].planoMinimo === i;
                return (
                  <TouchableOpacity key={p} style={[s.chip, sel && s.chipSel, !cfg[r.chave].ativo && { opacity: 0.5 }]}
                    disabled={!cfg[r.chave].ativo} onPress={() => set(r.chave, 'planoMinimo', i)}>
                    <Text style={[s.chipTxt, sel && s.chipTxtSel]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Recolhivel>
        ))}
        <BotaoAdmin title={salvando ? 'Salvando…' : 'Salvar e publicar'} icone="checkmark" onPress={salvar} disabled={salvando} />
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },
  card: { ...est.vidro(24), padding: 16, marginBottom: spacing.md },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titulo: est.secao(),
  desc: { fontFamily: fonts.body, fontSize: 13.5, color: colors.texto2, marginTop: 2 },
  label: est.rotulo(),
  planos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.cardSolido },
  chipSel: { backgroundColor: colors.botaoForte, borderColor: colors.botaoForte },
  chipTxt: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2 },
  chipTxtSel: { color: '#FFFFFF' },
}));
