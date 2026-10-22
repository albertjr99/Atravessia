import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, Alert, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import AdminLayout, { LARGURA_LATERAL } from './AdminLayout';
import AdminPlanosCards from './AdminPlanosCards';
import AdminAssinaturaCard from './AdminAssinaturaCard';
import { est, acento, BotaoAdmin, Pilula, F_NUM } from './adminEstilo';
import { lerReais, paraCampo, formatarReais, validarPreco } from './precosUtil';

// "Preços e planos" — único lugar para editar preços (igual ao painel web,
// admin-web/src/PrecosPlanos.jsx):
//   • cards dos planos, cada um com o editor de nome, recursos e preços
//     (planos/{id}.preco e .precoAnual — o que o app mostra e o checkout cobra);
//   • relatório por período (configuracoes/precos.periodo, centavos);
//   • formas de pagamento (configuracoes/assinatura).
const PERIODO_PADRAO = 590;

function CardPeriodo({ estilo }) {
  const [atual, setAtual] = useState(PERIODO_PADRAO / 100);
  const [valor, setValor] = useState('');
  const [editado, setEditado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'precos'), (snap) => {
    const c = snap.data()?.periodo;
    const reais = (typeof c === 'number' && c > 0 ? c : PERIODO_PADRAO) / 100;
    setAtual(reais);
    if (!editado) setValor(paraCampo(reais));
    setCarregando(false);
  }, () => setCarregando(false)), [editado]);

  const novo = lerReais(valor);
  const erro = validarPreco(novo);
  const mudou = novo !== null && novo !== atual;

  const salvar = async () => {
    setTentou(true);
    if (erro) { Alert.alert('Confira o valor', erro); return; }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'precos'), {
        periodo: Math.round(novo * 100),
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      setEditado(false);
      setTentou(false);
      Alert.alert('Valor salvo', `O relatório por período agora custa ${formatarReais(novo)}.`);
    } catch (e) {
      Alert.alert('Não foi possível salvar', e?.message || 'Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <View style={[s.card, estilo]}>
      <Text style={s.cardTitulo}>Relatório por período</Text>
      <Text style={s.cardSub}>Valor de cada relatório personalizado que a usuária compra avulso.</Text>
      <View style={s.atualLinha}>
        <Pilula icone="calendar-outline" nome="lilas" tam={44} />
        <View style={{ flex: 1 }}>
          <Text style={s.precoRot}>HOJE A USUÁRIA PAGA</Text>
          {carregando
            ? <ActivityIndicator color={colors.lav4} style={{ alignSelf: 'flex-start' }} />
            : <Text style={s.valor}>{formatarReais(atual)}<Text style={s.per}> /relatório</Text></Text>}
        </View>
      </View>
      <Text style={s.label}>Novo valor</Text>
      <View style={[s.moeda, tentou && !!erro && s.moedaErro]}>
        <Text style={s.cifrao}>R$</Text>
        <TextInput
          style={s.moedaInput} value={valor} editable={!carregando}
          onChangeText={t => { setValor(t); setEditado(true); }}
          keyboardType="decimal-pad" placeholder="5,90" placeholderTextColor={colors.tl}
          accessibilityLabel="Novo valor do relatório por período, em reais"
        />
      </View>
      <Text style={[s.dica, tentou && !!erro && s.dicaErro]}>{tentou && erro ? erro : 'Mínimo de R$ 0,50.'}</Text>
      <BotaoAdmin
        title={salvando ? 'Salvando...' : 'Salvar valor'} icone="checkmark"
        onPress={salvar} disabled={salvando || carregando || !mudou} carregando={salvando}
        style={{ marginTop: spacing.lg }}
      />
    </View>
  );
}

export default function AdminPrecosScreen() {
  const { width } = useWindowDimensions();
  const [larguraMedida, setLarguraMedida] = useState(null);
  const temSidebar = width >= 700;
  const larguraConteudo = (larguraMedida ?? (width - (temSidebar ? LARGURA_LATERAL : 0))) - spacing.lg * 2;
  // Celular: 1 coluna · tablet: 2 · tela larga: 4 cards lado a lado.
  const colunasPlanos = larguraConteudo >= 1040 ? 4 : larguraConteudo >= 520 ? 2 : 1;
  const duasColunas = larguraConteudo >= 640;

  return (
    <AdminLayout currentScreen="AdminPrecos">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
        onLayout={e => setLarguraMedida(e.nativeEvent.layout.width)}
      >
        <Text style={s.sobre}>Configuração</Text>
        <Text style={s.title}>Preços e planos</Text>
        <View style={[est.aviso('lilas'), { marginTop: spacing.sm, marginBottom: spacing.lg }]}>
          <Ionicons name="pricetag-outline" size={18} color={acento('lilas').tinta} />
          <Text style={est.avisoTxt('lilas')}>
            O valor que você salva aqui é o que a usuária vê no app e o que é cobrado no pagamento.
            Quem já assina continua com o valor da época da assinatura.
          </Text>
        </View>

        <Text style={s.secao}>Planos</Text>
        <Text style={s.secaoSub}>Cada card mostra o plano do jeito que aparece no app.</Text>
        <AdminPlanosCards colunas={colunasPlanos} />

        <View style={[s.linhaSecoes, duasColunas && s.linhaSecoesLarga]}>
          <CardPeriodo estilo={duasColunas ? s.metade : null} />
          <AdminAssinaturaCard estilo={duasColunas ? s.metade : null} />
        </View>
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  title: est.titulo(),
  secao: { ...est.secao(), marginTop: spacing.sm },
  secaoSub: { ...est.legenda(), marginTop: 2 },

  linhaSecoes: { marginTop: spacing.xl, gap: spacing.md },
  linhaSecoesLarga: { flexDirection: 'row', alignItems: 'flex-start' },
  metade: { flex: 1, minWidth: 0 },

  card: { ...est.vidro(24), padding: 18 },
  cardTitulo: est.cartaoTitulo(),
  cardSub: { ...est.legenda(), marginTop: 2, marginBottom: spacing.md },
  atualLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, ...est.tenue(16), padding: 12 },
  precoRot: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1, color: colors.tl, marginBottom: 2 },
  valor: { fontFamily: F_NUM, fontSize: 24, letterSpacing: -0.4, color: colors.titulo },
  per: { fontFamily: fonts.bodySemi, fontSize: 13, letterSpacing: 0, color: colors.texto2 },

  label: est.rotulo(),
  moeda: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.cardSolido, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, minHeight: 52,
  },
  moedaErro: { borderColor: colors.roseTexto, borderWidth: 1.5 },
  cifrao: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.texto2 },
  moedaInput: { flex: 1, fontFamily: F_NUM, fontSize: 19, color: colors.td, paddingVertical: 10 },
  dica: est.dica(),
  dicaErro: { color: colors.roseTexto, fontFamily: fonts.bodySemi },
}), { escalar: false });
