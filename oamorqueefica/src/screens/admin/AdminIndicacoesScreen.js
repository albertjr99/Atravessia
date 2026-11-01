import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, TextInput,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, getDoc, setDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import Recolhivel from '../../components/Recolhivel';
import SeletorOpcoes from '../../components/SeletorOpcoes';
import {
  PLATAFORMAS_AFILIADO, nomePlataforma, textoBotaoAfiliado, seloCashback, regraCashback, calcularCashback,
  reaisParaCentavos, centavosParaTexto, brlCentavos, escolherEnviarImagem, LIMITES_AFILIADO,
} from '../../utils/afiliados';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, Degrade } from './adminEstilo';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';
import { urlDeImagem } from '../../utils/imagemUrl';
import { normalizarUrl } from '../../utils/abrirLink';
import { CATEGORIAS_INDICACAO } from '../indicacoes/IndicacoesScreen';
import { situacaoAchado, mascaraDataBR, brParaISO, isoParaBR } from '../../utils/vigencia';

// Filtro rápido por situação de publicação (datas opcionais + visível/oculto).
const SITUACOES = [
  { id: 'todas', rotulo: 'Todas as situações' },
  { id: 'no_ar', rotulo: 'No ar' },
  { id: 'agendado', rotulo: 'Agendados' },
  { id: 'encerrado', rotulo: 'Encerrados' },
  { id: 'oculto', rotulo: 'Ocultos' },
];
const naSituacao = (item, sit) => {
  if (sit === 'todas') return true;
  if (sit === 'oculto') return item.ativo === false;
  if (sit === 'no_ar') return item.ativo !== false && situacaoAchado(item).id === 'no_ar';
  return situacaoAchado(item).id === sit;
};
const ACENTO_SITUACAO = { agendado: 'lilas', no_ar: 'salvia', encerrado: 'rosa' };

// Afiliados (antes "Indicações Amazon"): vitrine de produtos com link de
// afiliado de várias lojas, na coleção `indicacoes` (id mantido). Cada clique
// no app soma em `cliques` (Cloud Function registrarCliqueAfiliado). A comissão
// do app fica em `afiliadosPrivado/{id}`, que só as administradoras leem.
const VAZIO = {
  titulo: '', descricao: '', imagemUrl: '', imagemCaminho: '', link: '', categoria: 'livros', ordem: '', ativo: true,
  plataforma: 'amazon', plataformaNome: '', textoBotao: '',
  cashbackAtivo: false, cashbackTipo: 'fixo', cashbackFixo: '', cashbackPercentual: '',
  comissaoPercentual: '', precoReferencia: '',
  // Período no ar (dd/mm/aaaa no formulário; gravado como 'AAAA-MM-DD').
  publicarDe: '', publicarAte: '',
};
const numOuNull = (v) => { const n = Number(String(v || '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };

export default function AdminIndicacoesScreen({ navigation, route }) {
  const [itens, setItens] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [situacao, setSituacao] = useState('todas');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => onSnapshot(collection(db, 'indicacoes'), (snap) => {
    setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => {}), []);
  useEffect(() => onSnapshot(collection(db, 'pedidosCashbackAfiliado'), (snap) => {
    setPendentes(snap.docs.filter(d => d.data().status === 'pendente').length);
  }, () => {}), []);

  const ordenados = useMemo(() => [...itens].sort((a, b) =>
    (Number(a.ordem) || 999) - (Number(b.ordem) || 999) || String(a.titulo || '').localeCompare(String(b.titulo || ''))), [itens]);
  const lista = (filtro === 'todas' ? ordenados : ordenados.filter(i => (i.categoria || 'outros') === filtro))
    .filter(i => naSituacao(i, situacao));
  const totalCliques = itens.reduce((s, i) => s + (i.cliques || 0), 0);
  const ativos = itens.filter(i => i.ativo !== false).length;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const abrirNovo = () => { setForm(VAZIO); setModal({ mode: 'add' }); };
  const abrirEditar = async (item) => {
    const base = {
      ...VAZIO,
      titulo: item.titulo || '', descricao: item.descricao || '', imagemUrl: item.imagemUrl || '',
      imagemCaminho: item.imagemCaminho || '',
      link: item.link || '', categoria: item.categoria || 'outros',
      ordem: item.ordem != null ? String(item.ordem) : '', ativo: item.ativo !== false,
      plataforma: item.plataforma || 'amazon', plataformaNome: item.plataformaNome || '', textoBotao: item.textoBotao || '',
      cashbackAtivo: item.cashbackAtivo === true, cashbackTipo: item.cashbackTipo === 'percentual' ? 'percentual' : 'fixo',
      cashbackFixo: centavosParaTexto(item.cashbackFixoCentavos),
      cashbackPercentual: item.cashbackPercentual != null ? String(item.cashbackPercentual).replace('.', ',') : '',
      publicarDe: isoParaBR(item.publicarDe), publicarAte: isoParaBR(item.publicarAte),
    };
    setForm(base);
    setModal({ mode: 'edit', item });
    // Dados internos (comissão), lidos à parte: a usuária não tem acesso.
    try {
      const priv = (await getDoc(doc(db, 'afiliadosPrivado', item.id))).data() || {};
      setForm(p => ({
        ...p,
        comissaoPercentual: priv.comissaoPercentual != null ? String(priv.comissaoPercentual).replace('.', ',') : '',
        precoReferencia: centavosParaTexto(priv.precoReferenciaCentavos),
      }));
    } catch { /* sem dados internos ainda */ }
  };
  const fechar = () => { setModal(null); setForm(VAZIO); };

  // Atalho do Dashboard ("Achados que saem do ar"): abre direto a edição.
  const editarId = route?.params?.editarId;
  useEffect(() => {
    if (!editarId) return;
    const item = itens.find(i => i.id === editarId);
    if (!item) return;
    abrirEditar(item);
    navigation.setParams?.({ editarId: undefined });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editarId, itens]);

  const salvar = async () => {
    if (!form.titulo.trim()) { Alert.alert('Atenção', 'Informe o nome do produto.'); return; }
    const publicarDe = brParaISO(form.publicarDe);
    const publicarAte = brParaISO(form.publicarAte);
    if (publicarDe === null || publicarAte === null) { Alert.alert('Atenção', 'Confira as datas de publicação (dd/mm/aaaa).'); return; }
    if (publicarDe && publicarAte && publicarAte < publicarDe) { Alert.alert('Atenção', '“Publicar até” não pode ser antes de “Publicar a partir de”.'); return; }
    const link = normalizarUrl(form.link);
    if (!link) { Alert.alert('Atenção', 'Cole o link de afiliado da loja.'); return; }
    if (form.plataforma === 'outra' && !form.plataformaNome.trim()) { Alert.alert('Atenção', 'Escreva o nome da loja.'); return; }
    const fixo = reaisParaCentavos(form.cashbackFixo);
    const percentual = numOuNull(form.cashbackPercentual);
    if (form.cashbackAtivo) {
      if (form.cashbackTipo === 'fixo' && !(fixo > 0)) { Alert.alert('Atenção', 'Informe o valor do cashback em reais.'); return; }
      if (form.cashbackTipo === 'percentual' && !(percentual > 0)) { Alert.alert('Atenção', 'Informe o percentual do cashback.'); return; }
      if (form.cashbackTipo === 'percentual' && percentual > LIMITES_AFILIADO.percentualMax) { Alert.alert('Atenção', `O cashback pode ser de até ${LIMITES_AFILIADO.percentualMax}%.`); return; }
      if (form.cashbackTipo === 'fixo' && fixo > LIMITES_AFILIADO.cashbackMaxCentavos) { Alert.alert('Atenção', `O cashback pode ser de até ${brlCentavos(LIMITES_AFILIADO.cashbackMaxCentavos)}.`); return; }
    }
    setSalvando(true);
    const dados = {
      titulo: form.titulo.trim(), descricao: form.descricao.trim(), imagemUrl: form.imagemUrl.trim(),
      imagemCaminho: form.imagemUrl.trim() && form.imagemCaminho ? form.imagemCaminho : null,
      link, categoria: form.categoria, ordem: Number(form.ordem) || null, ativo: form.ativo,
      plataforma: form.plataforma, plataformaNome: form.plataforma === 'outra' ? form.plataformaNome.trim() : '',
      textoBotao: form.textoBotao.trim(),
      cashbackAtivo: !!form.cashbackAtivo, cashbackTipo: form.cashbackTipo,
      cashbackFixoCentavos: fixo || null, cashbackPercentual: percentual,
      // Fora deste período a usuária não vê o item (datas opcionais).
      publicarDe: publicarDe || null, publicarAte: publicarAte || null,
    };
    const privado = {
      comissaoPercentual: numOuNull(form.comissaoPercentual),
      precoReferenciaCentavos: reaisParaCentavos(form.precoReferencia) || null,
      atualizadoEm: serverTimestamp(),
    };
    try {
      let id = modal.item?.id;
      if (modal.mode === 'add') id = (await addDoc(collection(db, 'indicacoes'), { ...dados, cliques: 0, criadoEm: serverTimestamp() })).id;
      else await updateDoc(doc(db, 'indicacoes', id), dados);
      await setDoc(doc(db, 'afiliadosPrivado', id), privado, { merge: true });
      fechar();
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const alternar = (item) => updateDoc(doc(db, 'indicacoes', item.id), { ativo: item.ativo === false });
  const excluir = (item) => Alert.alert('Excluir item', `Excluir "${item.titulo}"? Esta ação não pode ser desfeita.`, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Excluir', style: 'destructive', onPress: async () => {
        await deleteDoc(doc(db, 'indicacoes', item.id));
        deleteDoc(doc(db, 'afiliadosPrivado', item.id)).catch(() => {});
        if (item.imagemCaminho) {
          const { ref: sRef, deleteObject } = require('firebase/storage');
          const { storage } = require('../../services/firebase');
          deleteObject(sRef(storage, item.imagemCaminho)).catch(() => {});
        }
      },
    },
  ]);

  const enviarFoto = async () => {
    setEnviandoFoto(true);
    try {
      const r = await escolherEnviarImagem('afiliados', { maxMB: 10, qualidade: 0.8 });
      if (r) setForm(p => ({ ...p, imagemUrl: r.url, imagemCaminho: r.caminho }));
    } catch (e) {
      Alert.alert('Erro no envio', e?.message || 'Tente novamente.');
    } finally {
      setEnviandoFoto(false);
    }
  };

  const previa = urlDeImagem(form.imagemUrl);
  const plat = PLATAFORMAS_AFILIADO.find(p => p.id === form.plataforma) || PLATAFORMAS_AFILIADO[0];
  const linkConfere = !form.link || !plat.padrao || plat.padrao.test(form.link);
  // Simulação para a administradora: comissão estimada x cashback devolvido.
  const simPreco = reaisParaCentavos(form.precoReferencia) || 0;
  const simComissao = simPreco && numOuNull(form.comissaoPercentual) ? Math.floor(simPreco * numOuNull(form.comissaoPercentual) / 100) : 0;
  const simRegra = form.cashbackAtivo ? regraCashback({
    cashbackAtivo: true, cashbackTipo: form.cashbackTipo,
    cashbackFixoCentavos: reaisParaCentavos(form.cashbackFixo), cashbackPercentual: numOuNull(form.cashbackPercentual),
  }) : null;
  const simCashback = simPreco && simRegra ? calcularCashback(simRegra, simPreco) : 0;

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminIndicacoes">
      <AdminSubTabs grupo="parcerias" atual="AdminIndicacoes" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={st.scroll}>
        <Text style={st.sobre}>Parcerias</Text>
        <Text style={st.pageTitle}>Afiliados</Text>
        <Text style={st.pageSub}>Vitrine de produtos com link de afiliado (Amazon, Mercado Livre, Shopee, Magalu e outras). No app, a usuária vê esta vitrine como “Achados da Atravessia”.</Text>

        <TouchableOpacity style={st.pedidosAviso} onPress={() => navigation.navigate('AdminPedidosCashback')} activeOpacity={0.85}>
          <Ionicons name="receipt-outline" size={20} color={acento(pendentes ? 'dourado' : 'lilas').texto} />
          <View style={{ flex: 1 }}>
            <Text style={st.pedidosTit}>Pedidos de cashback</Text>
            <Text style={st.pedidosSub}>{pendentes ? `${pendentes} aguardando análise` : 'Nenhum pedido aguardando análise'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.tl} />
        </TouchableOpacity>

        <View style={st.statsRow}>
          <View style={st.statBox}><Text style={st.statN}>{itens.length}</Text><Text style={st.statL}>Produtos</Text></View>
          <View style={st.statBox}><Text style={[st.statN, { color: acento('salvia').texto }]}>{ativos}</Text><Text style={st.statL}>Visíveis</Text></View>
          <View style={st.statBox}><Text style={st.statN}>{totalCliques}</Text><Text style={st.statL}>Cliques</Text></View>
        </View>

        <TouchableOpacity style={st.addBtn} onPress={abrirNovo}>
          <Degrade />
          <Ionicons name="add" size={18} color="white" />
          <Text style={st.addBtnTxt}>Novo item de afiliado</Text>
        </TouchableOpacity>

        <SeletorOpcoes
          titulo="Categoria"
          estilo={st.chipRow}
          opcoes={[{ id: 'todas', rotulo: 'Todas' }, ...CATEGORIAS_INDICACAO].map(c => ({ id: c.id, label: c.rotulo }))}
          valor={filtro}
          onChange={setFiltro}
        />
        <SeletorOpcoes
          titulo="Situação"
          estilo={st.chipRow}
          opcoes={SITUACOES.map(sit => {
            const n = sit.id === 'todas' ? null : itens.filter(i => naSituacao(i, sit.id)).length;
            return { id: sit.id, label: `${sit.rotulo}${n ? ` (${n})` : ''}` };
          })}
          valor={situacao}
          onChange={setSituacao}
        />

        {itens.length > 0 && lista.length === 0 && (
          <Text style={[st.itemSub, { marginBottom: spacing.md }]}>Nenhum item neste filtro.</Text>
        )}

        {itens.length === 0 && (
          <View style={st.dica}>
            <Ionicons name="information-circle-outline" size={18} color={acento('lilas').texto} />
            <Text style={st.dicaTxt}>
              Para começar: entre no programa de afiliados da loja (Amazon Associados, Mercado Livre, Shopee, Magalu…), gere o link de afiliado do produto e cadastre aqui com uma foto.
            </Text>
          </View>
        )}

        {lista.length > 0 && <View style={st.lista}>
        {lista.map((item, i) => {
          const inativo = item.ativo === false;
          const img = urlDeImagem(item.imagemUrl);
          return (
            <View key={item.id} style={[st.item, i > 0 && st.itemDiv, inativo && { opacity: 0.55 }]}>
              <View style={st.thumb}>
                {img ? <Image source={{ uri: img }} style={st.thumbImg} resizeMode="contain" /> : <Ionicons name="gift-outline" size={22} color={acento('pessego').tinta} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.itemCat}>{CATEGORIAS_INDICACAO.find(c => c.id === item.categoria)?.rotulo || 'Outros'}{inativo ? ' · oculta' : ''}</Text>
                <Text style={st.itemTit} numberOfLines={2}>{item.titulo}</Text>
                <Text style={st.itemSub}>{nomePlataforma(item)} · {item.cliques || 0} clique{(item.cliques || 0) === 1 ? '' : 's'}{item.ordem ? ` · ordem ${item.ordem}` : ''}</Text>
                {!!seloCashback(item) && <Text style={st.itemCashback}>{seloCashback(item)}</Text>}
                {!!situacaoAchado(item).texto && (() => {
                  const sit = situacaoAchado(item);
                  const a = acento(ACENTO_SITUACAO[sit.id]);
                  return (
                    <View style={[st.seloSit, { backgroundColor: a.fundo }]}>
                      <Ionicons name="calendar-outline" size={12} color={a.tinta} />
                      <Text style={[st.seloSitTxt, { color: a.texto }]}>{sit.texto}</Text>
                    </View>
                  );
                })()}
              </View>
              <View style={st.acoes}>
                <TouchableOpacity style={st.acaoBtn} onPress={() => abrirEditar(item)} accessibilityLabel="Editar">
                  <Ionicons name="pencil-outline" size={18} color={colors.lilasIcone} />
                </TouchableOpacity>
                <TouchableOpacity style={st.acaoBtn} onPress={() => alternar(item)} accessibilityLabel={inativo ? 'Mostrar' : 'Ocultar'}>
                  <Ionicons name={inativo ? 'eye-outline' : 'eye-off-outline'} size={18} color={inativo ? colors.sageFg : colors.tl} />
                </TouchableOpacity>
                <TouchableOpacity style={st.acaoBtn} onPress={() => excluir(item)} accessibilityLabel="Excluir">
                  <Ionicons name="trash-outline" size={18} color={colors.roseTexto} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        </View>}
      </ScrollView>

      <Modal visible={modal !== null} animationType="slide" transparent onRequestClose={fechar}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={st.overlay}>
            <View style={st.modalCard}>
              <View style={st.modalHeader}>
                <Text style={st.modalTitle}>{modal?.mode === 'add' ? 'Novo item de afiliado' : 'Editar item de afiliado'}</Text>
                <TouchableOpacity onPress={fechar} accessibilityLabel="Fechar" style={st.fechar}><Ionicons name="close" size={20} color={colors.td} /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={st.label}>Nome do produto *</Text>
                <TextInput style={st.input} value={form.titulo} onChangeText={v => set('titulo', v)} placeholder="Ex.: O ano do pensamento mágico" placeholderTextColor={colors.tl} />

                <Text style={st.label}>Por que indicamos</Text>
                <TextInput style={[st.input, st.multi]} value={form.descricao} onChangeText={v => set('descricao', v)} multiline placeholder="Uma frase curta e acolhedora" placeholderTextColor={colors.tl} />

                <Text style={st.label}>Loja</Text>
                <View style={st.chipWrap}>
                  {PLATAFORMAS_AFILIADO.map(p => (
                    <TouchableOpacity key={p.id} style={[st.chip, form.plataforma === p.id && st.chipSel]} onPress={() => set('plataforma', p.id)}>
                      <Text style={[st.chipText, form.plataforma === p.id && st.chipTextSel]}>{p.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {form.plataforma === 'outra' && (
                  <TextInput style={[st.input, { marginTop: 8 }]} value={form.plataformaNome} onChangeText={v => set('plataformaNome', v)} placeholder="Nome da loja (ex.: Amazon Kindle, Americanas)" placeholderTextColor={colors.tl} />
                )}

                <Text style={st.label}>Link de afiliado *</Text>
                <TextInput style={st.input} value={form.link} onChangeText={v => set('link', v)} autoCapitalize="none" keyboardType="url" placeholder={plat.exemplo} placeholderTextColor={colors.tl} />
                {!linkConfere && <Text style={st.alerta}>Este link não parece ser da {plat.nome}. Confira se é o link de afiliado.</Text>}

                <Text style={st.label}>Texto do botão</Text>
                <TextInput style={st.input} value={form.textoBotao} onChangeText={v => set('textoBotao', v)} placeholder={textoBotaoAfiliado({ plataforma: form.plataforma, plataformaNome: form.plataformaNome })} placeholderTextColor={colors.tl} />
                <Text style={st.ajuda}>Deixe em branco para usar “{textoBotaoAfiliado({ plataforma: form.plataforma, plataformaNome: form.plataformaNome })}”.</Text>

                <Text style={st.label}>Foto do produto</Text>
                <TouchableOpacity style={[st.fotoBtn, enviandoFoto && { opacity: 0.6 }]} onPress={enviarFoto} disabled={enviandoFoto}>
                  {enviandoFoto ? <ActivityIndicator size="small" color={colors.lilasTexto} /> : <Ionicons name="image-outline" size={18} color={colors.lilasTexto} />}
                  <Text style={st.fotoBtnTxt}>{enviandoFoto ? 'Enviando…' : form.imagemCaminho ? 'Trocar foto' : 'Enviar foto do aparelho'}</Text>
                </TouchableOpacity>
                <Text style={st.ajuda}>Ou cole o link de uma imagem (link direto ou Google Drive):</Text>
                <TextInput style={st.input} value={form.imagemUrl} onChangeText={v => setForm(p => ({ ...p, imagemUrl: v, imagemCaminho: '' }))} autoCapitalize="none" placeholder="https://..." placeholderTextColor={colors.tl} />
                {!!previa && <Image source={{ uri: previa }} style={st.previa} resizeMode="contain" />}

                <Text style={st.label}>Categoria</Text>
                <View style={st.chipWrap}>
                  {CATEGORIAS_INDICACAO.map(c => (
                    <TouchableOpacity key={c.id} style={[st.chip, form.categoria === c.id && st.chipSel]} onPress={() => set('categoria', c.id)}>
                      <Text style={[st.chipText, form.categoria === c.id && st.chipTextSel]}>{c.rotulo}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={st.label}>Ordem na vitrine (opcional)</Text>
                <TextInput style={st.input} value={form.ordem} onChangeText={v => set('ordem', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="1 aparece primeiro" placeholderTextColor={colors.tl} />

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.label}>Publicar a partir de</Text>
                    <TextInput style={st.input} value={form.publicarDe} onChangeText={v => set('publicarDe', mascaraDataBR(v))} keyboardType="number-pad" maxLength={10} placeholder="dd/mm/aaaa" placeholderTextColor={colors.tl} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.label}>Publicar até</Text>
                    <TextInput style={st.input} value={form.publicarAte} onChangeText={v => set('publicarAte', mascaraDataBR(v))} keyboardType="number-pad" maxLength={10} placeholder="dd/mm/aaaa" placeholderTextColor={colors.tl} />
                  </View>
                </View>
                <Text style={st.ajuda}>
                  Opcionais. Fora deste período o item não aparece no app.
                  {(() => {
                    const de = brParaISO(form.publicarDe); const ate = brParaISO(form.publicarAte);
                    if (de === null || ate === null) return ' Complete a data no formato dd/mm/aaaa.';
                    const t = situacaoAchado({ publicarDe: de, publicarAte: ate }).texto;
                    return t ? ` Situação: ${t}.` : '';
                  })()}
                </Text>

                <Recolhivel
                  titulo="Cashback e comissão"
                  subtitulo={form.cashbackAtivo ? 'Este item dá cashback' : 'Sem cashback para a usuária'}
                  icone="wallet-outline"
                  inicialAberto={form.cashbackAtivo}
                  estilo={{ marginTop: spacing.md }}
                >
                  <View style={st.dica}>
                    <Ionicons name="lock-closed-outline" size={16} color={acento('lilas').texto} />
                    <Text style={st.dicaTxt}>A comissão do app é só para vocês: a usuária vê apenas o cashback dela.</Text>
                  </View>
                  <Text style={st.label}>Comissão do app na loja (%)</Text>
                  <TextInput style={st.input} value={form.comissaoPercentual} onChangeText={v => set('comissaoPercentual', v.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" placeholder="Ex.: 10" placeholderTextColor={colors.tl} />
                  <Text style={st.label}>Preço de referência (R$, para a simulação)</Text>
                  <TextInput style={st.input} value={form.precoReferencia} onChangeText={v => set('precoReferencia', v.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" placeholder="Ex.: 22,00" placeholderTextColor={colors.tl} />

                  <View style={st.switchRow}>
                    <Text style={st.switchTxt}>Dar cashback à usuária</Text>
                    <Switch value={form.cashbackAtivo} onValueChange={v => set('cashbackAtivo', v)} trackColor={{ true: colors.lav4 }} />
                  </View>
                  {form.cashbackAtivo && (
                    <>
                      <View style={[st.chipWrap, { marginTop: 10 }]}>
                        {[{ id: 'fixo', rotulo: 'Valor fixo (R$)' }, { id: 'percentual', rotulo: '% do valor da compra' }].map(t => (
                          <TouchableOpacity key={t.id} style={[st.chip, form.cashbackTipo === t.id && st.chipSel]} onPress={() => set('cashbackTipo', t.id)}>
                            <Text style={[st.chipText, form.cashbackTipo === t.id && st.chipTextSel]}>{t.rotulo}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {form.cashbackTipo === 'fixo' ? (
                        <TextInput style={[st.input, { marginTop: 8 }]} value={form.cashbackFixo} onChangeText={v => set('cashbackFixo', v.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" placeholder="Ex.: 0,20" placeholderTextColor={colors.tl} />
                      ) : (
                        <TextInput style={[st.input, { marginTop: 8 }]} value={form.cashbackPercentual} onChangeText={v => set('cashbackPercentual', v.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" placeholder="Ex.: 1 (= 1% do valor pago)" placeholderTextColor={colors.tl} />
                      )}
                      {!!seloCashback({ cashbackAtivo: true, cashbackTipo: form.cashbackTipo, cashbackFixoCentavos: reaisParaCentavos(form.cashbackFixo), cashbackPercentual: numOuNull(form.cashbackPercentual) }) && (
                        <Text style={st.ajuda}>No app aparece: “{seloCashback({ cashbackAtivo: true, cashbackTipo: form.cashbackTipo, cashbackFixoCentavos: reaisParaCentavos(form.cashbackFixo), cashbackPercentual: numOuNull(form.cashbackPercentual) })}”.</Text>
                      )}
                    </>
                  )}
                  {!!simPreco && (simComissao > 0 || simCashback > 0) && (
                    <View style={st.simulacao}>
                      <Text style={st.simTit}>Simulação numa compra de {brlCentavos(simPreco)}</Text>
                      {simComissao > 0 && <Text style={st.simLinha}>Comissão estimada do app: {brlCentavos(simComissao)}</Text>}
                      {simCashback > 0 && <Text style={st.simLinha}>Cashback para a usuária: {brlCentavos(simCashback)}</Text>}
                      {simComissao > 0 && simCashback > simComissao && <Text style={st.alerta}>O cashback está maior que a comissão: o app pagaria a diferença.</Text>}
                    </View>
                  )}
                </Recolhivel>

                <View style={st.switchRow}>
                  <Text style={st.switchTxt}>Visível no app</Text>
                  <Switch value={form.ativo} onValueChange={v => set('ativo', v)} trackColor={{ true: colors.lav4 }} />
                </View>

                <TouchableOpacity style={[st.saveBtn, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando}>
                  <Degrade />
                  {salvando ? <ActivityIndicator size="small" color="white" /> : <Text style={st.saveBtnTxt}>Salvar</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  statBox: { ...est.vidro(20), flex: 1, alignItems: 'center', paddingVertical: 14 },
  statN: { fontFamily: 'Figtree_800ExtraBold', fontSize: 24, color: acento('lilas').texto },
  statL: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2, marginTop: 2 },
  addBtn: { ...est.botao(), marginBottom: spacing.md },
  addBtnTxt: est.botaoTxt(),
  chipRow: { gap: 8, marginBottom: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipText: est.chipTxt(),
  chipTextSel: est.chipTxtSel(),
  dica: { ...est.aviso('lilas'), marginBottom: spacing.md },
  dicaTxt: est.avisoTxt('lilas'),
  lista: { ...est.vidro(26), paddingVertical: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  itemDiv: est.divisoria(),
  thumb: { width: 58, height: 58, borderRadius: 16, backgroundColor: colors.escuro ? colors.vidroTenue : '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: 52, height: 52 },
  itemCat: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lilasTexto, letterSpacing: 0.8, textTransform: 'uppercase' },
  itemTit: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo, marginTop: 2 },
  itemSub: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2 },
  itemCashback: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.sageFg, marginTop: 2 },
  seloSit: { ...est.etiqueta(), marginTop: 5 },
  seloSitTxt: est.etiquetaTxt(),
  pedidosAviso: { ...est.vidro(20), flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: spacing.md },
  pedidosTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  pedidosSub: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2 },
  ajuda: { ...est.dica() },
  fotoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lav4, backgroundColor: colors.lav1 },
  fotoBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  simulacao: { marginTop: spacing.md, padding: 12, borderRadius: 16, backgroundColor: colors.vidroTenue, borderWidth: 1, borderColor: colors.bordaLuz, gap: 4 },
  simTit: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.titulo },
  simLinha: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2 },
  acoes: { flexDirection: 'row', gap: 4 },
  acaoBtn: { ...est.botaoIcone(), width: 38, height: 38 },
  overlay: { ...est.veu(), justifyContent: 'flex-end' },
  modalCard: { ...est.folha(), padding: spacing.lg, paddingBottom: 40, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  modalTitle: est.modalTitulo(),
  fechar: est.fechar(),
  label: est.rotulo(),
  input: est.campo(),
  multi: { textAlignVertical: 'top', minHeight: 84 },
  alerta: { ...est.dica(), color: acento('dourado').texto },
  previa: { width: '100%', height: 150, marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  switchTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td },
  saveBtn: { ...est.botao(), marginTop: spacing.lg },
  saveBtnTxt: est.botaoTxt(),
}), { escalar: false });
