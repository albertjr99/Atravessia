import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, Degrade } from './adminEstilo';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';
import SeletorOpcoes from '../../components/SeletorOpcoes';
import {
  STATUS_PEDIDO, brlCentavos, calcularCashback, reaisParaCentavos, centavosParaTexto,
} from '../../utils/afiliados';

// Pedidos de cashback de afiliados: a usuária comprou pelo link do app e
// enviou nº do pedido, valor e print. Aqui as administradoras conferem e
// aprovam (o crédito sai pela Cloud Function analisarPedidoCashbackAfiliado,
// na mesma carteira do cashback) ou recusam com um motivo que ela vai ler.
const FILTROS = [
  { id: 'pendente', rotulo: 'Em análise' },
  { id: 'aprovado', rotulo: 'Aprovados' },
  { id: 'recusado', rotulo: 'Recusados' },
  { id: 'todos', rotulo: 'Todos' },
];
const MOTIVOS_RAPIDOS = [
  'O comprovante não está legível.',
  'O número do pedido não confere com o comprovante.',
  'O produto do comprovante é diferente do item.',
  'A compra foi cancelada ou devolvida.',
];
const dataTexto = (ts) => (ts?.toDate ? ts.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function Comprovante({ pedido, onAbrir }) {
  const [url, setUrl] = useState(pedido.comprovanteUrl || null);
  useEffect(() => {
    if (url || !pedido.comprovanteCaminho) return;
    const { ref: sRef, getDownloadURL } = require('firebase/storage');
    getDownloadURL(sRef(storage, pedido.comprovanteCaminho)).then(setUrl).catch(() => {});
  }, [pedido.comprovanteCaminho, url]);
  return (
    <TouchableOpacity style={st.comprovante} onPress={() => url && onAbrir(url)} disabled={!url} accessibilityLabel="Ver comprovante">
      {url ? <Image source={{ uri: url }} style={st.comprovanteImg} resizeMode="cover" /> : <Ionicons name="document-outline" size={24} color={colors.tl} />}
    </TouchableOpacity>
  );
}

export default function AdminPedidosCashbackScreen({ navigation }) {
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('pendente');
  const [acao, setAcao] = useState(null); // { tipo: 'aprovar'|'recusar', pedido }
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [imagem, setImagem] = useState(null);

  useEffect(() => onSnapshot(collection(db, 'pedidosCashbackAfiliado'), (snap) => {
    setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0)));
    setCarregando(false);
  }, () => setCarregando(false)), []);

  const contagem = useMemo(() => pedidos.reduce((c, p) => ({ ...c, [p.status]: (c[p.status] || 0) + 1 }), {}), [pedidos]);
  const lista = filtro === 'todos' ? pedidos : pedidos.filter(p => p.status === filtro);
  const creditado = pedidos.filter(p => p.status === 'aprovado').reduce((s, p) => s + (p.cashbackCentavos || 0), 0);

  const abrirAcao = (tipo, pedido) => {
    setValor(centavosParaTexto(pedido.valorCentavos));
    setMotivo('');
    setAcao({ tipo, pedido });
  };
  const fechar = () => { if (!enviando) setAcao(null); };

  const confirmar = async () => {
    const { tipo, pedido } = acao;
    const payload = { pedidoId: pedido.id, decisao: tipo };
    if (tipo === 'recusar') {
      if (motivo.trim().length < 3) { Alert.alert('Atenção', 'Escreva o motivo da recusa. A usuária vai ler.'); return; }
      payload.motivo = motivo.trim();
    } else {
      const c = reaisParaCentavos(valor);
      if (!c) { Alert.alert('Atenção', 'Confira o valor da compra.'); return; }
      if (c !== pedido.valorCentavos) payload.valor = c / 100;
    }
    setEnviando(true);
    try {
      const { data } = await httpsCallable(functions, 'analisarPedidoCashbackAfiliado')(payload);
      setAcao(null);
      Alert.alert(tipo === 'aprovar' ? 'Cashback aprovado' : 'Pedido recusado',
        tipo === 'aprovar' ? `${brlCentavos(Math.round((data?.cashback || 0) * 100))} creditado para ${pedido.usuarioNome || 'a usuária'}. Ela foi avisada.` : 'A usuária foi avisada com o motivo.');
    } catch (e) {
      Alert.alert('Não foi possível concluir', e?.message || 'Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const previstoAjustado = acao?.tipo === 'aprovar' ? calcularCashback(acao.pedido.regraCashback, reaisParaCentavos(valor) || 0) : 0;

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminPedidosCashback">
      <AdminSubTabs grupo="parcerias" atual="AdminPedidosCashback" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={st.scroll}>
        <Text style={st.sobre}>Parcerias · Afiliados</Text>
        <Text style={st.pageTitle}>Pedidos de cashback</Text>
        <Text style={st.pageSub}>
          As lojas não contam quem comprou. Por isso a usuária envia o número do pedido, o valor e um print. Confira se o print mostra o mesmo produto, número e valor antes de aprovar.
        </Text>

        <View style={st.statsRow}>
          <View style={st.statBox}><Text style={[st.statN, { color: acento('dourado').texto }]}>{contagem.pendente || 0}</Text><Text style={st.statL}>Em análise</Text></View>
          <View style={st.statBox}><Text style={[st.statN, { color: acento('salvia').texto }]}>{contagem.aprovado || 0}</Text><Text style={st.statL}>Aprovados</Text></View>
          <View style={st.statBox}><Text style={st.statN} numberOfLines={1} adjustsFontSizeToFit>{brlCentavos(creditado)}</Text><Text style={st.statL}>Creditado</Text></View>
        </View>

        <SeletorOpcoes
          titulo="Situação do pedido"
          estilo={st.chipRow}
          opcoes={FILTROS.map(f => ({ id: f.id, label: `${f.rotulo}${f.id !== 'todos' && contagem[f.id] ? ` (${contagem[f.id]})` : ''}` }))}
          valor={filtro}
          onChange={setFiltro}
        />

        {carregando && <ActivityIndicator color={colors.lav4} style={{ marginTop: spacing.lg }} />}
        {!carregando && lista.length === 0 && (
          <View style={st.vazio}>
            <Ionicons name="receipt-outline" size={28} color={colors.lilasIcone} />
            <Text style={st.vazioTxt}>{filtro === 'pendente' ? 'Nenhum pedido esperando análise. Tudo em dia!' : 'Nenhum pedido aqui ainda.'}</Text>
          </View>
        )}

        {lista.map(p => {
          const status = STATUS_PEDIDO[p.status] || STATUS_PEDIDO.pendente;
          return (
            <View key={p.id} style={st.card}>
              <View style={st.cardTopo}>
                <Comprovante pedido={p} onAbrir={setImagem} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={[st.selo, { backgroundColor: acento(status.cor).fundo }]}>
                    <Ionicons name={status.icone} size={13} color={acento(status.cor).texto} />
                    <Text style={[st.seloTxt, { color: acento(status.cor).texto }]}>{status.rotulo}</Text>
                  </View>
                  <Text style={st.cardTit} numberOfLines={2}>{p.itemTitulo || 'Item'}</Text>
                  <Text style={st.cardSub}>{p.plataforma} · {dataTexto(p.criadoEm)}</Text>
                </View>
              </View>
              <View style={st.detalhes}>
                <Text style={st.det}><Text style={st.detRot}>Usuária: </Text>{p.usuarioNome || '—'}{p.usuarioEmail ? ` (${p.usuarioEmail})` : ''}</Text>
                <Text style={st.det} selectable><Text style={st.detRot}>Nº do pedido: </Text>{p.numeroPedido}</Text>
                <Text style={st.det}><Text style={st.detRot}>Valor informado: </Text>{brlCentavos(p.valorCentavos)}</Text>
                {p.status === 'aprovado'
                  ? <Text style={[st.det, { color: colors.sageFg }]}><Text style={st.detRot}>Creditado: </Text>{brlCentavos(p.cashbackCentavos)}{p.valorAprovadoCentavos && p.valorAprovadoCentavos !== p.valorCentavos ? ` (valor corrigido para ${brlCentavos(p.valorAprovadoCentavos)})` : ''}</Text>
                  : <Text style={st.det}><Text style={st.detRot}>Cashback previsto: </Text>{brlCentavos(p.cashbackPrevistoCentavos)}</Text>}
                {p.status === 'recusado' && !!p.motivo && <Text style={[st.det, { color: colors.roseTexto }]}><Text style={st.detRot}>Motivo: </Text>{p.motivo}</Text>}
                {!!p.erroCredito && <Text style={[st.det, { color: colors.roseTexto }]}>Última tentativa de crédito falhou: {p.erroCredito}</Text>}
              </View>
              {p.status === 'pendente' && (
                <View style={st.botoes}>
                  <TouchableOpacity style={[st.btn, st.btnRecusar]} onPress={() => abrirAcao('recusar', p)}>
                    <Ionicons name="close" size={16} color={colors.roseTexto} />
                    <Text style={[st.btnTxt, { color: colors.roseTexto }]}>Recusar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.btn, st.btnAprovar]} onPress={() => abrirAcao('aprovar', p)}>
                    <Ionicons name="checkmark" size={16} color="white" />
                    <Text style={[st.btnTxt, { color: 'white' }]}>Aprovar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!acao} animationType="slide" transparent onRequestClose={fechar}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={st.overlay}>
            <View style={st.modalCard}>
              <View style={st.modalHeader}>
                <Text style={st.modalTitle}>{acao?.tipo === 'aprovar' ? 'Aprovar cashback' : 'Recusar pedido'}</Text>
                <TouchableOpacity onPress={fechar} accessibilityLabel="Fechar" style={st.fechar}><Ionicons name="close" size={20} color={colors.td} /></TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={st.cardSub}>{acao?.pedido.itemTitulo} · pedido {acao?.pedido.numeroPedido}</Text>
                {acao?.tipo === 'aprovar' ? (
                  <>
                    <Text style={st.label}>Valor da compra (R$)</Text>
                    <TextInput style={st.input} value={valor} onChangeText={v => setValor(v.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" />
                    <Text style={st.ajuda}>Corrija se o print mostrar um valor diferente do informado.</Text>
                    <View style={st.resumo}>
                      <Text style={st.resumoTxt}>Crédito para a usuária</Text>
                      <Text style={st.resumoValor}>{brlCentavos(previstoAjustado)}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={st.label}>Motivo (a usuária vai ler)</Text>
                    <View style={st.chipWrap}>
                      {MOTIVOS_RAPIDOS.map(m => (
                        <TouchableOpacity key={m} style={[st.chip, motivo === m && st.chipSel]} onPress={() => setMotivo(m)}>
                          <Text style={[st.chipText, motivo === m && st.chipTextSel]}>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput style={[st.input, st.multi]} value={motivo} onChangeText={setMotivo} multiline maxLength={300} placeholder="Explique com carinho o que aconteceu" placeholderTextColor={colors.tl} />
                  </>
                )}
                <TouchableOpacity style={[st.saveBtn, enviando && { opacity: 0.6 }]} onPress={confirmar} disabled={enviando}>
                  <Degrade />
                  {enviando ? <ActivityIndicator size="small" color="white" /> : <Text style={st.saveBtnTxt}>{acao?.tipo === 'aprovar' ? 'Aprovar e creditar' : 'Recusar e avisar'}</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!imagem} transparent animationType="fade" onRequestClose={() => setImagem(null)}>
        <TouchableOpacity style={st.imagemFundo} activeOpacity={1} onPress={() => setImagem(null)}>
          {!!imagem && <Image source={{ uri: imagem }} style={st.imagemCheia} resizeMode="contain" />}
          <TouchableOpacity style={st.abrirFora} onPress={() => Linking.openURL(imagem).catch(() => {})}>
            <Ionicons name="open-outline" size={16} color="white" />
            <Text style={st.abrirForaTxt}>Abrir em tamanho original</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </AdminLayout>
  );
}

const st = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  statBox: { ...est.vidro(20), flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6 },
  statN: { fontFamily: 'Figtree_800ExtraBold', fontSize: 22, color: acento('lilas').texto },
  statL: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2, marginTop: 2 },
  chipRow: { gap: 8, marginBottom: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipText: est.chipTxt(),
  chipTextSel: est.chipTxtSel(),
  vazio: { ...est.vidro(22), alignItems: 'center', gap: 8, padding: spacing.xl },
  vazioTxt: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center' },
  card: { ...est.vidro(22), padding: 14, marginBottom: 12 },
  cardTopo: { flexDirection: 'row', gap: 12 },
  comprovante: { width: 76, height: 96, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.vidroTenue, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.bordaLuz },
  comprovanteImg: { width: '100%', height: '100%' },
  selo: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 4 },
  seloTxt: { fontFamily: fonts.bodyBold, fontSize: 12 },
  cardTit: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo },
  cardSub: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2 },
  detalhes: { marginTop: 10, gap: 3 },
  det: { fontFamily: fonts.body, fontSize: 13.5, color: colors.td, lineHeight: 19 },
  detRot: { fontFamily: fonts.bodyBold },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 14 },
  btnRecusar: { borderWidth: 1, borderColor: colors.roseTexto, backgroundColor: 'transparent' },
  btnAprovar: { backgroundColor: colors.sageFg },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 14 },
  overlay: { ...est.veu(), justifyContent: 'flex-end' },
  modalCard: { ...est.folha(), padding: spacing.lg, paddingBottom: 40, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  modalTitle: est.modalTitulo(),
  fechar: est.fechar(),
  label: est.rotulo(),
  input: est.campo(),
  multi: { textAlignVertical: 'top', minHeight: 84 },
  ajuda: est.dica(),
  resumo: { marginTop: spacing.md, padding: 14, borderRadius: 16, backgroundColor: colors.vidroTenue, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resumoTxt: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.texto2 },
  resumoValor: { fontFamily: 'Figtree_800ExtraBold', fontSize: 20, color: colors.sageFg },
  saveBtn: { ...est.botao(), marginTop: spacing.lg },
  saveBtnTxt: est.botaoTxt(),
  imagemFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  imagemCheia: { width: '100%', height: '80%' },
  abrirFora: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, padding: 10 },
  abrirForaTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: 'white' },
}), { escalar: false });
