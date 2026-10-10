import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, collectionGroup, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius } from '../../theme';
import AdminLayout from './AdminLayout';
import { gerarRascunhos, lerDados, TIPOS_CONTEUDO, TEMAS_CONTEUDO } from '../../ia/iaAdmin';
import { calcularMetricasFunil, planoNumero } from '../../utils/metricasFunil';

// AtravessIA no painel: assistente de conteúdo e leitura dos dados.
// Inteligência própria do app (sem custo por uso).
const NIVEL = {
  atencao: { icone: 'alert-circle-outline', cor: colors.roseFg, fundo: '#FBEFEA' },
  sugestao: { icone: 'bulb-outline', cor: colors.goldFg, fundo: '#FBF4E8' },
  info: { icone: 'information-circle-outline', cor: colors.lav5, fundo: colors.lav1 },
};

function Assistente() {
  const [tipo, setTipo] = useState('frase');
  const [tema, setTema] = useState('geral');
  const [rascunhos, setRascunhos] = useState(() => gerarRascunhos('frase', 'geral'));
  const [salvos, setSalvos] = useState({});

  const gerar = (t = tipo, tm = tema) => { setRascunhos(gerarRascunhos(t, tm)); setSalvos({}); };

  const salvarFrase = async (r, i) => {
    try {
      await addDoc(collection(db, 'frases'), {
        texto: r.texto, autor: 'Atravessia', reflexao: r.reflexao || '', ativa: true, criadoEm: serverTimestamp(),
      });
      setSalvos(s => ({ ...s, [i]: true }));
    } catch (e) {
      Alert.alert('Erro', `Não foi possível salvar.${e?.message ? `\n${e.message}` : ''}`);
    }
  };

  const copiar = (r) => {
    const texto = [r.titulo, r.texto, r.reflexao].filter(Boolean).join('\n\n');
    Share.share({ message: texto }).catch(() => {});
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={s.label}>Tipo</Text>
      <View style={s.chips}>
        {TIPOS_CONTEUDO.map(t => (
          <TouchableOpacity key={t.id} style={[s.chip, tipo === t.id && s.chipSel]} onPress={() => { setTipo(t.id); gerar(t.id, tema); }}>
            <Text style={[s.chipTxt, tipo === t.id && s.chipTxtSel]}>{t.rotulo}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.label}>Tema</Text>
      <View style={s.chips}>
        {TEMAS_CONTEUDO.map(t => (
          <TouchableOpacity key={t.id} style={[s.chip, tema === t.id && s.chipSel]} onPress={() => { setTema(t.id); gerar(tipo, t.id); }}>
            <Text style={[s.chipTxt, tema === t.id && s.chipTxtSel]}>{t.rotulo}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {rascunhos.map((r, i) => (
        <View key={`${i}-${r.texto}`} style={s.rascunho}>
          {!!r.titulo && <Text style={s.rascunhoTit}>{r.titulo}</Text>}
          <Text style={s.rascunhoTxt} selectable>{r.texto}</Text>
          {!!r.reflexao && <Text style={s.rascunhoRef} selectable>Reflexão: {r.reflexao}</Text>}
          <View style={s.acoes}>
            <TouchableOpacity style={s.acaoSec} onPress={() => copiar(r)}>
              <Ionicons name="copy-outline" size={14} color={colors.lav5} />
              <Text style={s.acaoSecTxt}>Copiar / enviar</Text>
            </TouchableOpacity>
            {tipo === 'frase' && (
              <TouchableOpacity style={[s.acao, salvos[i] && { opacity: 0.6 }]} onPress={() => salvarFrase(r, i)} disabled={salvos[i]}>
                <Ionicons name={salvos[i] ? 'checkmark' : 'add'} size={14} color="white" />
                <Text style={s.acaoTxt}>{salvos[i] ? 'Salva em Frases' : 'Salvar como frase do dia'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      <TouchableOpacity style={s.gerarOutras} onPress={() => gerar()}>
        <Ionicons name="refresh" size={16} color={colors.lav5} />
        <Text style={s.gerarOutrasTxt}>Gerar outras opções</Text>
      </TouchableOpacity>
      <Text style={s.nota}>Os textos são rascunhos para você revisar e ajustar antes de publicar.</Text>
    </View>
  );
}

function Leitura() {
  const [insights, setInsights] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setInsights(null);
    try {
      const [us, ck, ct, au] = await Promise.all([
        getDocs(collection(db, 'usuarios')),
        getDocs(collectionGroup(db, 'checkins')),
        getDocs(collection(db, 'conteudos')),
        getDocs(collection(db, 'audiosAcolhimento')),
      ]);
      const usuarios = us.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role !== 'admin').map(u => ({ ...u, plano: planoNumero(u.plano) }));
      const checkins = ck.docs.map(d => ({ uid: d.ref.path.split('/')[1], ...d.data() }));
      const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      const metricas = calcularMetricasFunil({ usuarios, checkins, periodo: '30', hoje });
      setInsights(lerDados({
        checkins, metricas, hoje,
        conteudos: ct.docs.map(d => d.data()),
        audios: au.docs.map(d => d.data()),
      }));
      setErro('');
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar os dados.');
      setInsights([]);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (insights === null) return <ActivityIndicator color={colors.lav4} style={{ marginTop: 40 }} />;
  return (
    <View style={{ gap: spacing.sm }}>
      {!!erro && <Text style={s.erro}>Não foi possível ler os dados: {erro}</Text>}
      {insights.map((i, k) => {
        const n = NIVEL[i.nivel] || NIVEL.info;
        return (
          <View key={k} style={[s.insight, { backgroundColor: n.fundo }]}>
            <Ionicons name={n.icone} size={20} color={n.cor} />
            <View style={{ flex: 1 }}>
              <Text style={[s.insightTit, { color: n.cor }]}>{i.titulo}</Text>
              <Text style={s.insightTxt}>{i.texto}</Text>
            </View>
          </View>
        );
      })}
      <TouchableOpacity style={s.gerarOutras} onPress={carregar}>
        <Ionicons name="refresh" size={16} color={colors.lav5} />
        <Text style={s.gerarOutrasTxt}>Atualizar leitura</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminAtravessIAScreen() {
  const [aba, setAba] = useState('dados');
  return (
    <AdminLayout currentScreen="AdminAtravessIA">
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.cabecalho}>
          <View style={s.iaIcone}><Ionicons name="sparkles" size={18} color="white" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>AtravessIA</Text>
            <Text style={s.sub}>Inteligência própria do app: lê os dados em linguagem simples e ajuda a criar conteúdos.</Text>
          </View>
        </View>
        <View style={s.abas}>
          {[{ id: 'dados', rotulo: 'Leitura dos dados', icone: 'analytics-outline' }, { id: 'conteudo', rotulo: 'Assistente de conteúdo', icone: 'create-outline' }].map(a => (
            <TouchableOpacity key={a.id} style={[s.aba, aba === a.id && s.abaSel]} onPress={() => setAba(a.id)}>
              <Ionicons name={a.icone} size={15} color={aba === a.id ? colors.lav5 : colors.tl} />
              <Text style={[s.abaTxt, aba === a.id && s.abaTxtSel]}>{a.rotulo}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {aba === 'dados' ? <Leitura /> : <Assistente />}
      </ScrollView>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 48, gap: spacing.md },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iaIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lav5, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, lineHeight: 19 },
  abas: { flexDirection: 'row', gap: 6, backgroundColor: colors.card, borderRadius: radius.lg, padding: 4, borderWidth: 1, borderColor: colors.border },
  aba: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md },
  abaSel: { backgroundColor: colors.lav1 },
  abaTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.tl },
  abaTxtSel: { fontFamily: fonts.bodyBold, color: colors.lav5 },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.tm, textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  chipSel: { backgroundColor: colors.lav5, borderColor: colors.lav5 },
  chipTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.td },
  chipTxtSel: { fontFamily: fonts.bodyBold, color: 'white' },
  rascunho: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 8 },
  rascunhoTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.lav6 },
  rascunhoTxt: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.td },
  rascunhoRef: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.tm },
  acoes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.lav5, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 14 },
  acaoTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: 'white' },
  acaoSec: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.lav1, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 14 },
  acaoSecTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.lav5 },
  gerarOutras: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.lav3 },
  gerarOutrasTxt: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.lav5 },
  nota: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center' },
  insight: { flexDirection: 'row', gap: 12, borderRadius: radius.lg, padding: spacing.md, alignItems: 'flex-start' },
  insightTit: { fontFamily: fonts.bodyBold, fontSize: 14 },
  insightTxt: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.td, marginTop: 2 },
  erro: { fontFamily: fonts.body, fontSize: 12.5, color: colors.roseFg },
});
