import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Alert, Modal, ScrollView, Switch,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, corPlano, dadoPlano, BotaoAdmin, F_NUM } from './adminEstilo';
import {
  lerReais, paraCampo, formatarReais, anualEfetivo, economiaPct, validarPreco,
  status, STATUS_ROTULO,
} from './precosUtil';

const PLANOS_PADRAO = [
  {
    id: 0, nome: 'Perceber', subtitulo: 'Gratuito', preco: 0, precoLabel: 'Grátis',
    descricao: 'O primeiro passo é perceber como você está.',
    mensagem: '',
    recursos: [
      'Cadastro básico', 'Frase do dia', 'Reflexão do dia',
      'Check-in emocional diário', 'Histórico emocional (últimos 7 dias)',
      'Relatório emocional mensal simples',
    ],
    destaque: false, emBreve: false,
  },
  {
    id: 1, nome: 'Acolher', subtitulo: 'Mensal', preco: 24.9, precoLabel: 'R$ 24,90/mês',
    descricao: 'Aqui, suas emoções encontram acolhimento.',
    mensagem: '',
    recursos: [
      'Tudo do Gratuito', 'Pequenas Vitórias', 'Áudios de acolhimento',
      'Biblioteca de conteúdos', 'Feedback emocional diário',
    ],
    destaque: true, emBreve: false,
  },
  {
    id: 2, nome: 'Compreender', subtitulo: 'Em breve', preco: 0, precoLabel: 'Em breve',
    descricao: 'Compreenda seus padrões emocionais com mais profundidade.',
    mensagem: '',
    recursos: ['Datas sensíveis', 'Jornadas guiadas', 'Relatório semanal'],
    destaque: false, emBreve: true,
  },
  {
    id: 3, nome: 'Evoluir', subtitulo: 'Em breve', preco: 0, precoLabel: 'Em breve',
    descricao: 'Evolua com ferramentas de acompanhamento completo.',
    mensagem: '',
    recursos: ['Rede de apoio', 'Memorial', 'Relatório mensal e anual'],
    destaque: false, emBreve: true,
  },
];

const ACENTO_STATUS = { gratuito: 'salvia', ativo: 'salvia', emBreve: 'neutro' };

function formDe(plano) {
  return {
    nome: plano?.nome || '',
    descricao: plano?.descricao || '',
    mensagem: plano?.mensagem || '',
    recursos: (plano?.recursos || []).length ? [...plano.recursos] : [''],
    destaque: plano?.destaque === true,
    emBreve: plano?.emBreve === true,
    preco: paraCampo(plano?.preco),
    precoAnual: paraCampo(plano?.precoAnual),
  };
}

// Preços como a usuária vê em Planos.
function PrecosDoCard({ plano }) {
  if (plano.id === 0) {
    return <View style={s.precoBloco}><Text style={s.valor}>Grátis</Text></View>;
  }
  const mensal = Number(plano.preco) || 0;
  if (!(mensal > 0)) {
    return (
      <View style={est.aviso('dourado')}>
        <Ionicons name="alert-circle-outline" size={17} color={acento('dourado').tinta} />
        <Text style={est.avisoTxt('dourado')}>Sem preço definido</Text>
      </View>
    );
  }
  const anual = anualEfetivo(mensal, Number(plano.precoAnual) || 0);
  const eco = economiaPct(mensal, anual);
  return (
    <View style={{ gap: 8 }}>
      <View style={s.precoBloco}>
        <Text style={s.precoRot}>MENSAL</Text>
        <Text style={s.valor}>{formatarReais(mensal)}<Text style={s.per}> /mês</Text></Text>
      </View>
      <View style={s.precoBloco}>
        <Text style={s.precoRot}>ANUAL</Text>
        <Text style={s.valor}>{formatarReais(anual)}<Text style={s.per}> /ano</Text></Text>
        <View style={s.notaLinha}>
          <Text style={s.nota}>≈ {formatarReais(anual / 12)}/mês</Text>
          {eco > 0 && (
            <View style={s.economia}><Text style={s.economiaTxt}>economia de {eco}%</Text></View>
          )}
        </View>
        {!(plano.precoAnual > 0) && <Text style={s.nota}>automático: 10 mensalidades</Text>}
      </View>
    </View>
  );
}

function CampoMoeda({ rotulo, valor, onChange, per, placeholder, erro, dica, acessivel }) {
  return (
    <View style={{ flex: 1, minWidth: 200 }}>
      <Text style={s.label}>{rotulo}</Text>
      <View style={[s.moeda, !!erro && s.moedaErro]}>
        <Text style={s.cifrao}>R$</Text>
        <TextInput
          style={s.moedaInput} value={valor} onChangeText={onChange}
          keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor={colors.tl}
          accessibilityLabel={acessivel}
        />
        <Text style={s.moedaPer}>{per}</Text>
      </View>
      <Text style={[s.hint, !!erro && s.hintErro]}>{erro || dica}</Text>
    </View>
  );
}

// `colunas` vem da tela (celular 1, tablet 2, tela larga 4).
export default function AdminPlanosCards({ colunas = 1 }) {
  const [planos, setPlanos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [larguraGrade, setLarguraGrade] = useState(0);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formDe(null));
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    // Sem orderBy: documentos sem o campo ordenado seriam descartados.
    return onSnapshot(collection(db, 'planos'), snap => {
      setPlanos(snap.docs
        .map(d => ({ ...d.data(), id: d.data().id ?? Number(d.id) }))
        .filter(p => Number.isFinite(p.id))
        .sort((a, b) => a.id - b.id));
      setCarregando(false);
    }, () => setCarregando(false));
  }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setRecurso = (i, v) => setForm(prev => ({ ...prev, recursos: prev.recursos.map((r, j) => (j === i ? v : r)) }));
  const addRecurso = () => setForm(prev => ({ ...prev, recursos: [...prev.recursos, ''] }));
  const delRecurso = (i) => setForm(prev => ({ ...prev, recursos: prev.recursos.filter((_, j) => j !== i) }));

  const abrir = (p) => { setForm(formDe(p)); setTentou(false); setEditando(p); };
  const fechar = () => { if (!salvando) setEditando(null); };

  const temPreco = !!editando && editando.id !== 0;
  const mensal = lerReais(form.preco);
  const anual = lerReais(form.precoAnual);
  const erroNome = form.nome.trim() ? '' : 'Dê um nome ao plano.';
  const erroMensal = temPreco ? validarPreco(mensal, { obrigatorio: !form.emBreve }) : '';
  const erroAnual = temPreco ? validarPreco(anual, { obrigatorio: false }) : '';
  const anualFinal = anualEfetivo(mensal || 0, anual || 0);
  const eco = economiaPct(mensal, anualFinal);
  const anualCaro = temPreco && mensal > 0 && anual > 0 && anual > mensal * 12;
  const sugestao = mensal > 0 ? Math.round(mensal * 10 * 100) / 100 : 0;
  const mostra = (msg) => (tentou ? msg : '');

  const salvar = async () => {
    setTentou(true);
    if (erroNome || erroMensal || erroAnual) {
      Alert.alert('Confira os campos', erroNome || erroMensal || erroAnual);
      return;
    }
    setSalvando(true);
    try {
      const id = editando.id;
      const dados = {
        id,
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        mensagem: form.mensagem.trim(),
        recursos: form.recursos.map(r => r.trim()).filter(Boolean),
        destaque: form.destaque,
        emBreve: id === 0 ? false : form.emBreve,
        atualizadoEm: serverTimestamp(),
      };
      const lote = writeBatch(db);
      if (id === 0) {
        Object.assign(dados, { preco: 0, precoLabel: 'Grátis' });
      } else {
        const p = mensal || 0;
        const a = anual || 0; // 0 = automático (10 mensalidades)
        Object.assign(dados, {
          preco: p,
          precoAnual: a,
          precoLabel: p > 0 ? `${formatarReais(p)}/mês` : 'Em breve',
        });
        // Espelho em centavos, só por compatibilidade com leituras antigas.
        lote.set(doc(db, 'configuracoes', 'precos'), {
          [`plano${id}`]: Math.round(p * 100),
          [`plano${id}Anual`]: Math.round(a * 100),
          atualizadoEm: serverTimestamp(),
        }, { merge: true });
      }
      // set + merge funciona mesmo se o documento ainda não existir.
      lote.set(doc(db, 'planos', String(id)), dados, { merge: true });
      await lote.commit();
      setEditando(null);
      Alert.alert('Plano salvo', `${dados.nome} já aparece assim no app.`);
    } catch (e) {
      Alert.alert('Não foi possível salvar', e?.message || 'Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const criarPadrao = async () => {
    try {
      for (const p of PLANOS_PADRAO) {
        await setDoc(doc(db, 'planos', String(p.id)), { ...p, criadoEm: serverTimestamp() }, { merge: true });
      }
      Alert.alert('Pronto', 'Planos padrão criados. Agora você pode editar cada um.');
    } catch (e) {
      Alert.alert('Erro', e?.message || 'Não foi possível criar os planos.');
    }
  };

  if (carregando) {
    return <View style={s.carregando}><ActivityIndicator color={colors.lav4} /></View>;
  }

  const GAP = spacing.md;
  const larguraCard = colunas > 1 && larguraGrade > 0
    ? Math.floor((larguraGrade - GAP * (colunas - 1)) / colunas)
    : '100%';

  return (
    <View>
      {planos.length === 0 ? (
        <TouchableOpacity style={s.criarBtn} onPress={criarPadrao} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={18} color={colors.lilasTexto} />
          <Text style={s.criarTxt}>Criar os 4 planos padrão para começar</Text>
        </TouchableOpacity>
      ) : (
        <View style={[s.grade, { gap: GAP }]} onLayout={e => setLarguraGrade(e.nativeEvent.layout.width)}>
          {planos.map(p => {
            const st = status(p);
            const a = acento(ACENTO_STATUS[st]);
            return (
              <View key={p.id} style={[s.card, { width: larguraCard, borderTopColor: dadoPlano(p.id) }, p.destaque && s.cardDestaque]}>
                {p.destaque && (
                  <View style={s.selo}><Text style={s.seloTxt}>RECOMENDADO</Text></View>
                )}
                <View style={s.cardTopo}>
                  <Text style={[s.nome, { color: corPlano(p.id).texto }]} numberOfLines={1}>{p.nome}</Text>
                  <View style={[s.etiqueta, { backgroundColor: a.fundo }]}>
                    <Text style={[s.etiquetaTxt, { color: a.texto }]}>{STATUS_ROTULO[st]}</Text>
                  </View>
                </View>
                <PrecosDoCard plano={p} />
                {!!p.descricao && <Text style={s.desc} numberOfLines={3}>{p.descricao}</Text>}
                <Text style={s.meta}>
                  {(p.recursos || []).length} recurso(s) incluído(s){p.mensagem ? ' · com mensagem' : ''}
                </Text>
                <View style={{ flex: 1 }} />
                <BotaoAdmin
                  variant="secondary" icone="create-outline" title="Editar plano"
                  onPress={() => abrir(p)} style={{ marginTop: spacing.md }}
                />
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={!!editando} animationType="slide" transparent onRequestClose={fechar}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Editar plano {editando?.nome}</Text>
                <TouchableOpacity
                  onPress={fechar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.fechar}
                  accessibilityRole="button" accessibilityLabel="Fechar"
                >
                  <Ionicons name="close" size={20} color={colors.td} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                {temPreco && (
                  <View style={s.blocoPreco}>
                    <Text style={s.blocoTitulo}>Preço</Text>
                    <View style={s.linhaCampos}>
                      <CampoMoeda
                        rotulo={form.emBreve ? 'Mensal (opcional enquanto estiver “Em breve”)' : 'Mensal *'}
                        valor={form.preco} onChange={t => set('preco', t)} per="/mês" placeholder="24,90"
                        erro={mostra(erroMensal)} dica="Cobrado todo mês. Mínimo de R$ 0,50."
                        acessivel="Preço mensal em reais"
                      />
                      <View style={{ flex: 1, minWidth: 200 }}>
                        <CampoMoeda
                          rotulo="Anual (opcional)"
                          valor={form.precoAnual} onChange={t => set('precoAnual', t)} per="/ano"
                          placeholder={sugestao ? paraCampo(sugestao) : '249,00'}
                          erro={mostra(erroAnual)}
                          dica={anual ? 'Cobrado uma vez por ano.' : sugestao ? `Vazio = 10 mensalidades (${formatarReais(sugestao)}).` : 'Vazio = 10 mensalidades.'}
                          acessivel="Preço anual em reais"
                        />
                        {sugestao > 0 && anual !== sugestao && (
                          <TouchableOpacity
                            style={s.sugestao} onPress={() => set('precoAnual', paraCampo(sugestao))}
                            accessibilityRole="button"
                          >
                            <Text style={s.sugestaoTxt}>Usar 10 mensalidades: {formatarReais(sugestao)}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    {mensal > 0 && !erroAnual && (
                      <View style={[est.aviso(anualCaro ? 'dourado' : 'salvia'), { marginTop: spacing.md }]}>
                        <Ionicons
                          name={anualCaro ? 'alert-circle-outline' : 'information-circle-outline'} size={18}
                          color={acento(anualCaro ? 'dourado' : 'salvia').tinta}
                        />
                        <Text style={est.avisoTxt(anualCaro ? 'dourado' : 'salvia')}>
                          {anualCaro
                            ? `O anual está mais caro que 12 mensalidades (${formatarReais(mensal * 12)}). Confira se é isso mesmo.`
                            : `No anual, a usuária paga ${formatarReais(anualFinal)} (≈ ${formatarReais(anualFinal / 12)}/mês)${eco > 0 ? ` e economiza ${eco}%` : ''}.`}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <Text style={s.label}>Nome do plano *</Text>
                <TextInput
                  style={[s.input, !!mostra(erroNome) && s.inputErro]} value={form.nome}
                  onChangeText={t => set('nome', t)} placeholder="Ex.: Acolher" placeholderTextColor={colors.tl}
                />
                {!!mostra(erroNome) && <Text style={[s.hint, s.hintErro]}>{erroNome}</Text>}

                <Text style={s.label}>Descrição curta</Text>
                <TextInput
                  style={[s.input, s.inputMulti]} value={form.descricao}
                  onChangeText={t => set('descricao', t)} multiline
                  placeholder="Uma frase sobre o plano..." placeholderTextColor={colors.tl}
                />

                <Text style={s.label}>Mensagem de destaque (opcional)</Text>
                <TextInput
                  style={[s.input, s.inputMulti]} value={form.mensagem}
                  onChangeText={t => set('mensagem', t)} multiline
                  placeholder="Aparece numa caixa em destaque no card." placeholderTextColor={colors.tl}
                />
                <Text style={s.hint}>Em branco, a caixa não aparece.</Text>

                <Text style={s.label}>O que está incluído</Text>
                {form.recursos.map((r, i) => (
                  <View key={i} style={s.recursoLinha}>
                    <Ionicons name="checkmark-circle" size={18} color={acento('salvia').tinta} />
                    <TextInput
                      style={[s.input, { flex: 1 }]} value={r} onChangeText={t => setRecurso(i, t)}
                      placeholder="Ex.: Áudios de acolhimento" placeholderTextColor={colors.tl}
                      accessibilityLabel={`Recurso ${i + 1}`}
                    />
                    <TouchableOpacity
                      onPress={() => delRecurso(i)} style={s.recursoDel}
                      accessibilityRole="button" accessibilityLabel={`Remover recurso ${i + 1}`}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.tl} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={s.addRecurso} onPress={addRecurso} accessibilityRole="button">
                  <Ionicons name="add" size={18} color={colors.lilasTexto} />
                  <Text style={s.addRecursoTxt}>Adicionar recurso</Text>
                </TouchableOpacity>

                <View style={s.switchRow}>
                  <Text style={s.switchLbl}>Mostrar selo “Recomendado”</Text>
                  <Switch value={form.destaque} onValueChange={v => set('destaque', v)} trackColor={{ true: colors.lav4 }} />
                </View>
                {editando?.id !== 0 && (
                  <View style={s.switchRow}>
                    <Text style={s.switchLbl}>Em breve (aparece, mas ainda não dá para assinar)</Text>
                    <Switch value={form.emBreve} onValueChange={v => set('emBreve', v)} trackColor={{ true: colors.lav4 }} />
                  </View>
                )}

                <View style={s.modalBtns}>
                  <BotaoAdmin variant="secondary" title="Cancelar" onPress={fechar} disabled={salvando} style={{ flex: 1 }} />
                  <BotaoAdmin
                    title={salvando ? 'Salvando...' : 'Salvar plano'} icone="checkmark"
                    onPress={salvar} disabled={salvando} carregando={salvando} style={{ flex: 1 }}
                  />
                </View>
                <View style={{ height: 220 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = criarEstilos(() => ({
  carregando: { paddingVertical: 32, alignItems: 'center' },
  criarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 18,
    borderWidth: 1.5, borderColor: colors.lav3, borderStyle: 'dashed',
    backgroundColor: colors.lav1,
  },
  criarTxt: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.lilasTexto },

  grade: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', paddingTop: 12 },
  card: { ...est.vidro(24), padding: 18, paddingTop: 20, borderTopWidth: 4, marginBottom: 4 },
  cardDestaque: { borderColor: colors.lav3, borderTopWidth: 4 },
  selo: {
    position: 'absolute', top: -11, left: 16, zIndex: 2,
    backgroundColor: colors.botaoForte, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  seloTxt: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 1, color: '#FFFFFF' },
  cardTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  nome: { ...est.secao(), flexShrink: 1 },
  etiqueta: est.etiqueta(),
  etiquetaTxt: est.etiquetaTxt(),

  precoBloco: { ...est.tenue(16), paddingVertical: 10, paddingHorizontal: 12 },
  precoRot: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1, color: colors.tl, marginBottom: 2 },
  valor: { fontFamily: F_NUM, fontSize: 24, letterSpacing: -0.4, color: colors.titulo },
  per: { fontFamily: fonts.bodySemi, fontSize: 13, letterSpacing: 0, color: colors.texto2 },
  notaLinha: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  nota: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.texto2 },
  economia: { backgroundColor: acento('salvia').fundo, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  economiaTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: acento('salvia').texto },

  desc: { ...est.legenda(), marginTop: spacing.md },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.tl, marginTop: 6 },

  modalOverlay: { ...est.veu(), justifyContent: 'flex-end' },
  modalCard: { ...est.folha(), padding: spacing.lg, maxHeight: '92%', width: '100%', maxWidth: 720, alignSelf: 'center' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    marginBottom: spacing.sm,
  },
  modalTitle: { ...est.modalTitulo(), flex: 1 },
  fechar: est.fechar(),

  blocoPreco: { ...est.tenue(18), padding: 14, marginTop: 4 },
  blocoTitulo: est.cartaoTitulo(),
  linhaCampos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md },
  moeda: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.cardSolido, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, minHeight: 52,
  },
  moedaErro: { borderColor: colors.roseTexto, borderWidth: 1.5 },
  cifrao: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.texto2 },
  moedaInput: { flex: 1, fontFamily: F_NUM, fontSize: 19, color: colors.td, paddingVertical: 10 },
  moedaPer: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.tl },
  sugestao: {
    alignSelf: 'flex-start', marginTop: 8, minHeight: 36, justifyContent: 'center',
    backgroundColor: acento('lilas').fundo, borderRadius: 999, paddingHorizontal: 12,
  },
  sugestaoTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: acento('lilas').texto },

  label: est.rotulo(),
  input: est.campo(),
  inputErro: { borderColor: colors.roseTexto, borderWidth: 1.5 },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  hint: est.dica(),
  hintErro: { color: colors.roseTexto, fontFamily: fonts.bodySemi },

  recursoLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  recursoDel: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addRecurso: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    minHeight: 44, paddingHorizontal: 12,
  },
  addRecursoTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    marginTop: spacing.md,
  },
  switchLbl: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.td, flex: 1 },

  modalBtns: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
}), { escalar: false });
