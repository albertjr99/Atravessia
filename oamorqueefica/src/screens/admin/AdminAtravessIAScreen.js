import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, collectionGroup, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import AdminLayout from './AdminLayout';
import { est, acento, Degrade } from './adminEstilo';
import { gerarRascunhos, lerDados, TIPOS_CONTEUDO, TEMAS_CONTEUDO } from '../../ia/iaAdmin';
import { calcularMetricasFunil, planoNumero } from '../../utils/metricasFunil';

// AtravessIA no painel: assistente de conteúdo e leitura dos dados.
// Inteligência própria do app (sem custo por uso).
const NIVEL = {
  atencao: { icone: 'alert-circle-outline', get cor() { return acento('rosa').texto; }, get fundo() { return acento('rosa').fundo; } },
  sugestao: { icone: 'bulb-outline', get cor() { return acento('dourado').texto; }, get fundo() { return acento('dourado').fundo; } },
  info: { icone: 'information-circle-outline', get cor() { return acento('lilas').texto; }, get fundo() { return acento('lilas').fundo; } },
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
                <Degrade />
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
          <View style={s.iaIcone}><Degrade raio={14} /><Ionicons name="sparkles" size={20} color="white" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.sobre}>Painel</Text>
            <Text style={s.title}>AtravessIA</Text>
            <Text style={s.sub}>Lê os dados em linguagem simples e ajuda a criar conteúdos.</Text>
          </View>
        </View>
        <View style={s.abas}>
          {[{ id: 'dados', rotulo: 'Leitura dos dados', icone: 'analytics-outline' }, { id: 'conteudo', rotulo: 'Assistente de conteúdo', icone: 'create-outline' }].map(a => (
            <TouchableOpacity key={a.id} style={[s.aba, aba === a.id && s.abaSel]} onPress={() => setAba(a.id)}>
              <Ionicons name={a.icone} size={16} color={aba === a.id ? colors.lilasTexto : colors.texto2} />
              <Text style={[s.abaTxt, aba === a.id && s.abaTxtSel]}>{a.rotulo}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {aba === 'dados' ? <Leitura /> : <Assistente />}
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48, gap: spacing.md },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iaIcone: { ...est.pilula(48), backgroundColor: colors.botaoForte },
  sobre: { ...est.sobretitulo(), marginBottom: 0 },
  title: est.titulo(),
  sub: est.subtitulo(),
  abas: { ...est.trilho(), alignSelf: 'stretch' },
  aba: { ...est.aba(), flex: 1 },
  abaSel: est.abaSel(),
  abaTxt: est.abaTxt(),
  abaTxtSel: est.abaTxtSel(),
  label: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lilasTexto, textTransform: 'uppercase', letterSpacing: 1.1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipTxt: est.chipTxt(),
  chipTxtSel: est.chipTxtSel(),
  rascunho: { ...est.vidro(24), padding: 18, gap: 8 },
  rascunhoTit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.lav6 },
  rascunhoTxt: est.corpo(),
  rascunhoRef: { ...est.legenda(), fontSize: 14, lineHeight: 20 },
  acoes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  acao: { ...est.botao(), minHeight: 42, paddingHorizontal: 16 },
  acaoTxt: { ...est.botaoTxt(), fontSize: 13.5 },
  acaoSec: { ...est.botaoSec(), minHeight: 42, paddingHorizontal: 16 },
  acaoSecTxt: { ...est.botaoSecTxt(), fontSize: 13.5 },
  gerarOutras: est.botaoSec(),
  gerarOutrasTxt: est.botaoSecTxt(),
  nota: { ...est.dica(), textAlign: 'center' },
  insight: { flexDirection: 'row', gap: 12, borderRadius: 20, padding: 16, alignItems: 'flex-start' },
  insightTit: { fontFamily: fonts.bodyBold, fontSize: 15 },
  insightTxt: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.td, marginTop: 2 },
  erro: { ...est.avisoTxt('rosa') },
}), { escalar: false });
