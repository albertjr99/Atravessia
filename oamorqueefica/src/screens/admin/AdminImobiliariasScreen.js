import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator, Platform,
  Share, Image, KeyboardAvoidingView, Switch, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, BotaoAdmin, AcoesItem, Pilula, useFormRecolhivel } from './adminEstilo';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';
import Recolhivel from '../../components/Recolhivel';
import { confirmar } from '../../utils/confirm';
import { abrirLink } from '../../utils/abrirLink';
import { uploadToStorage } from '../../utils/storageUpload';
import { urlDeImagem } from '../../utils/imagemUrl';
import {
  STATUS_LEAD, FASES_LEAD, TIPOS_IMOBILIARIA, TIPOS_IMOVEL, rotuloTipoImovel, precoTexto,
  brlCentavos, dataHoraTexto, dataTexto, listaDeTexto, linkWhatsapp,
} from '../../utils/imoveis';

// Painel "Imobiliárias" (grupo Parcerias): leads (funil), cadastro de
// imobiliárias com dados privados, imóveis, arquitetos e resumo financeiro.
// Mudanças de etapa dos leads passam pelas Cloud Functions (seção
// IMOBILIÁRIAS de functions/index.js); os cadastros são gravados direto.

const SECOES = [
  { id: 'leads', rotulo: 'Leads' },
  { id: 'imobiliarias', rotulo: 'Imobiliárias' },
  { id: 'imoveis', rotulo: 'Imóveis' },
  { id: 'arquitetos', rotulo: 'Arquitetos' },
  { id: 'financeiro', rotulo: 'Financeiro' },
];
const chama = (nome, dados) => httpsCallable(functions, nome)(dados).then(r => r.data);
const ordenar = (lista) => [...lista].sort((a, b) => (Number(a.ordem) || 999) - (Number(b.ordem) || 999) || String(a.nome || a.titulo).localeCompare(String(b.nome || b.titulo)));
const num = (v) => { const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const tsMs = (ts) => ts?.toMillis?.() ?? 0;

async function copiarOuCompartilhar(texto) {
  if (Platform.OS === 'web' && navigator?.clipboard) {
    await navigator.clipboard.writeText(texto);
    Alert.alert('', 'Link copiado!');
    return;
  }
  await Share.share({ message: texto });
}

// Escolhe imagens e envia para o Storage em imoveis/<pasta>/. Devolve as URLs.
async function enviarImagens(pasta, multiplas) {
  if (Platform.OS === 'web') {
    const arquivos = await new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.multiple = !!multiplas;
      input.onchange = () => resolve([...(input.files || [])]);
      input.click();
    });
    const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
    const urls = [];
    for (const f of arquivos) {
      const r = ref(storage, `imoveis/${pasta}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      await uploadBytes(r, f, { contentType: f.type || 'image/jpeg' });
      urls.push(await getDownloadURL(r));
    }
    return urls;
  }
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') { Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações.'); return []; }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: !!multiplas });
  if (res.canceled) return [];
  const urls = [];
  for (const a of res.assets) {
    urls.push(await uploadToStorage(a.uri, `imoveis/${pasta}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`, 'image/jpeg'));
  }
  return urls;
}

function Campo({ rotulo, valor, onMudar, dica, ...props }) {
  return (
    <View>
      <Text style={st.rotulo}>{rotulo}</Text>
      <TextInput style={[st.campo, props.multiline && { minHeight: 90, textAlignVertical: 'top' }]} value={String(valor ?? '')}
        onChangeText={onMudar} placeholderTextColor={colors.tl} {...props} />
      {!!dica && <Text style={st.dica}>{dica}</Text>}
    </View>
  );
}

function Chips({ opcoes, valor, onMudar, multiplo }) {
  const sel = (id) => (multiplo ? (valor || []).includes(id) : valor === id);
  const tocar = (id) => {
    if (!multiplo) return onMudar(id);
    const atual = valor || [];
    onMudar(atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id]);
  };
  return (
    <View style={st.chips}>
      {opcoes.map(o => (
        <TouchableOpacity key={o.id} style={[st.chip, sel(o.id) && st.chipSel]} onPress={() => tocar(o.id)} activeOpacity={0.8}>
          <Text style={[st.chipTxt, sel(o.id) && st.chipTxtSel]}>{o.rotulo}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Lista suspensa simples (abre um modal com as opções).
function Suspensa({ valor, opcoes, onMudar, placeholder = 'Escolher' }) {
  const [aberta, setAberta] = useState(false);
  const atual = opcoes.find(o => o.id === valor);
  return (
    <>
      <TouchableOpacity style={st.suspensa} onPress={() => setAberta(true)} activeOpacity={0.8}>
        <Text style={st.suspensaTxt} numberOfLines={1}>{atual?.rotulo || placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.tl} />
      </TouchableOpacity>
      <Modal visible={aberta} transparent animationType="fade" onRequestClose={() => setAberta(false)}>
        <TouchableOpacity style={[st.veu, { justifyContent: 'center', padding: 20 }]} activeOpacity={1} onPress={() => setAberta(false)}>
          <Pressable style={[st.modal, { maxHeight: 480 }]} onPress={() => {}}>
            <ScrollView>
              {opcoes.map(o => (
                <TouchableOpacity key={o.id} style={st.opcao} onPress={() => { onMudar(o.id); setAberta(false); }}>
                  <Text style={[st.opcaoTxt, o.id === valor && { fontFamily: fonts.bodyBold, color: colors.lilasTexto }]}>{o.rotulo}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function Etiqueta({ status }) {
  const info = STATUS_LEAD[status] || STATUS_LEAD.novo;
  const a = acento(info.tom === 'neutro' ? 'neutro' : info.tom);
  return <View style={[st.etq, { backgroundColor: a.fundo }]}><Text style={[st.etqTxt, { color: a.texto }]}>{info.curto}</Text></View>;
}

// ============================ LEADS =========================================
function SecaoLeads({ leads, privLeads, imobiliarias, arquitetos, arqPriv }) {
  const [status, setStatus] = useState('todos');
  const [imob, setImob] = useState('todas');
  const [busca, setBusca] = useState('');
  const [acao, setAcao] = useState(null); // { tipo, lead }
  const [f, setF] = useState({});
  const [enviando, setEnviando] = useState(false);

  const contagem = useMemo(() => leads.reduce((c, l) => ({ ...c, [l.status]: (c[l.status] || 0) + 1 }), {}), [leads]);
  const termo = busca.trim().toUpperCase();
  const lista = leads.filter(l => (status === 'todos' || l.status === status)
    && (imob === 'todas' || l.imobiliariaId === imob)
    && (!termo || String(l.codigo).includes(termo) || String(l.nome || '').toUpperCase().includes(termo)));

  const abrir = (tipo, lead) => {
    const p = privLeads[lead.id] || {};
    const c = lead.consultoria || {};
    const d = c.data?.toDate ? c.data.toDate() : null;
    setF({
      valor: tipo === 'repasse' ? ((p.repassePrevistoCentavos || 0) / 100).toFixed(2).replace('.', ',')
        : tipo === 'pagarArq' ? ((p.custoArquitetoCentavos || 0) / 100).toFixed(2).replace('.', ',') : '',
      arquitetoId: lead.arquitetoId || '',
      data: d ? d.toLocaleDateString('pt-BR') : '',
      hora: d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
      duracao: String(c.duracaoHoras || 2), link: c.link || '', observacao: c.observacao || '', comprovante: '',
    });
    setAcao({ tipo, lead });
  };
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const executar = async () => {
    const { tipo, lead } = acao;
    setEnviando(true);
    try {
      if (tipo === 'repasse') await chama('confirmarRepasseImobiliaria', { leadId: lead.id, valorRecebido: f.valor });
      if (tipo === 'agendar') {
        const m = String(f.data).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        const h = String(f.hora).match(/^(\d{1,2}):(\d{2})$/);
        if (!m || !h) throw new Error('Use a data no formato DD/MM/AAAA e a hora como 14:30.');
        if (!f.arquitetoId) throw new Error('Escolha o arquiteto.');
        await chama('agendarConsultoria', {
          leadId: lead.id, arquitetoId: f.arquitetoId, dataHora: `${m[3]}-${m[2]}-${m[1]}T${h[1].padStart(2, '0')}:${h[2]}`,
          link: f.link.trim(), duracaoHoras: num(f.duracao) || 2, observacao: f.observacao,
        });
      }
      if (tipo === 'pagarArq') await chama('atualizarLeadAdmin', { leadId: lead.id, acao: 'pagarArquiteto', valor: f.valor, comprovanteUrl: f.comprovante.trim() });
      setAcao(null);
      Alert.alert('', 'Pronto! A usuária é avisada quando a etapa muda.');
    } catch (e) {
      Alert.alert('Não foi possível concluir', e?.message || 'Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const simples = (lead, acaoAdmin, extra = {}, msg) => confirmar(msg || 'Confirmar', 'Deseja continuar?', async () => {
    try { await chama('atualizarLeadAdmin', { leadId: lead.id, acao: acaoAdmin, ...extra }); } catch (e) { Alert.alert('Não foi possível', e?.message || 'Tente novamente.'); }
  });

  const opcoesStatus = [{ id: 'todos', rotulo: `Todos (${leads.length})` }, ...[...FASES_LEAD, 'perdido'].map(s => ({ id: s, rotulo: `${STATUS_LEAD[s].curto} (${contagem[s] || 0})` }))];
  const opcoesImob = [{ id: 'todas', rotulo: 'Todas as imobiliárias' }, ...imobiliarias.map(i => ({ id: i.id, rotulo: i.nome }))];

  return (
    <View>
      <View style={st.funil}>
        {[...FASES_LEAD, 'perdido'].map(s => (
          <TouchableOpacity key={s} style={[st.funilItem, status === s && st.funilSel]} onPress={() => setStatus(status === s ? 'todos' : s)}>
            <Text style={st.funilN}>{contagem[s] || 0}</Text>
            <Text style={st.funilL} numberOfLines={2}>{STATUS_LEAD[s].curto}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={st.rotulo}>Etapa</Text>
      <Suspensa valor={status} opcoes={opcoesStatus} onMudar={setStatus} />
      <Text style={st.rotulo}>Imobiliária</Text>
      <Suspensa valor={imob} opcoes={opcoesImob} onMudar={setImob} />
      <Campo rotulo="Buscar por código ou nome" valor={busca} onMudar={setBusca} placeholder="ATR-IMV-…" autoCapitalize="characters" />

      {lista.length === 0 ? <Text style={[st.dica, { marginTop: 16 }]}>Nenhuma indicação com esses filtros.</Text> : lista.map(l => {
        const p = privLeads[l.id] || {};
        const arqPago = !!p.arquitetoPagoEm;
        return (
          <View key={l.id} style={st.card}>
            <View style={st.linha}>
              <Text style={st.codigo}>{l.codigo}</Text>
              <Etiqueta status={l.status} />
            </View>
            <Text style={st.titulo}>{l.nome} · {l.telefone}</Text>
            <Text style={st.legenda}>{l.imobiliariaNome}{l.imovelTitulo ? ` · ${l.imovelTitulo}` : ''}</Text>
            <Text style={st.legenda}>{l.interesse === 'alugar' ? 'Alugar' : 'Comprar'}{l.faixaPreco ? ` · ${l.faixaPreco}` : ''}{l.prazo ? ` · ${l.prazo}` : ''}</Text>
            {!!l.bairros && <Text style={st.legenda}>Bairros: {l.bairros}</Text>}
            {!!l.observacoes && <Text style={st.legenda}>“{l.observacoes}”</Text>}
            <Text style={st.dica}>Enviada em {dataHoraTexto(l.criadoEm)}{l.validadoEm ? ` · código validado em ${dataTexto(l.validadoEm)}` : ''}</Text>
            {(p.valorNegocioCentavos != null || p.repasseCentavos != null) && (
              <View style={st.fin}>
                {p.valorNegocioCentavos != null && <Text style={st.finTxt}>Negócio: {brlCentavos(p.valorNegocioCentavos)}</Text>}
                {p.repassePrevistoCentavos != null && <Text style={st.finTxt}>Repasse previsto: {brlCentavos(p.repassePrevistoCentavos)}</Text>}
                {!!p.repasseEnviado?.em && <Text style={[st.finTxt, { color: acento('dourado').texto }]}>Imobiliária informou o envio em {dataTexto(p.repasseEnviado.em)}{p.repasseEnviado.comprovanteUrl ? ' (com comprovante)' : ''}</Text>}
                {p.repasseCentavos != null && <Text style={[st.finTxt, { color: acento('salvia').texto }]}>Recebido: {brlCentavos(p.repasseCentavos)} em {dataTexto(p.pagoEm)}</Text>}
                {p.custoArquitetoCentavos != null && <Text style={st.finTxt}>Arquiteto: {brlCentavos(p.custoArquitetoCentavos)} {arqPago ? '· pago' : '· a pagar'}</Text>}
              </View>
            )}
            {l.consultoria?.status === 'agendada' && (
              <Text style={[st.legenda, { color: acento('salvia').texto }]}>Consultoria com {l.arquitetoNome}: {dataHoraTexto(l.consultoria.data)}</Text>
            )}
            <View style={st.acoes}>
              {!!l.telefone && <BotaoAdmin variant="secondary" icone="logo-whatsapp" title="WhatsApp" onPress={() => abrirLink(linkWhatsapp(l.telefone, `Olá, ${l.nome}! Aqui é da Atravessia, sobre sua indicação ${l.codigo}.`))} />}
              {l.status === 'fechado' && <BotaoAdmin icone="cash-outline" title="Confirmar recebimento" onPress={() => abrir('repasse', l)} />}
              {['pago', 'consultoria_agendada'].includes(l.status) && <BotaoAdmin icone="calendar-outline" title={l.status === 'pago' ? 'Agendar consultoria' : 'Reagendar'} onPress={() => abrir('agendar', l)} />}
              {l.status === 'consultoria_agendada' && <BotaoAdmin variant="secondary" icone="checkmark-done-outline" title="Consultoria concluída" onPress={() => simples(l, 'concluirConsultoria', {}, 'Marcar consultoria como concluída')} />}
              {['consultoria_agendada', 'concluido'].includes(l.status) && !arqPago && <BotaoAdmin variant="secondary" icone="wallet-outline" title="Pagar arquiteto" onPress={() => abrir('pagarArq', l)} />}
              {['novo', 'em_contato', 'visita', 'proposta', 'perdido'].includes(l.status) && (
                <View style={{ minWidth: 180, flexGrow: 1 }}>
                  <Suspensa valor={l.status} placeholder="Mudar etapa"
                    opcoes={['novo', 'em_contato', 'visita', 'proposta', 'perdido'].map(s => ({ id: s, rotulo: `Etapa: ${STATUS_LEAD[s].curto}` }))}
                    onMudar={(s) => s !== l.status && simples(l, 'status', { status: s }, `Mudar para “${STATUS_LEAD[s].curto}”`)} />
                </View>
              )}
            </View>
          </View>
        );
      })}

      <Modal visible={!!acao} transparent animationType="fade" onRequestClose={() => !enviando && setAcao(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[st.veu, { justifyContent: 'center', padding: 20 }]}>
          {acao && (
            <ScrollView contentContainerStyle={st.modal} keyboardShouldPersistTaps="handled">
              <Text style={st.modalTit}>
                {acao.tipo === 'repasse' ? 'Confirmar recebimento do repasse' : acao.tipo === 'agendar' ? 'Agendar consultoria' : 'Pagamento ao arquiteto'}
              </Text>
              <Text style={st.legenda}>{acao.lead.codigo} · {acao.lead.nome}</Text>
              {acao.tipo === 'repasse' && (
                <Campo rotulo="Valor recebido da imobiliária (R$)" valor={f.valor} onMudar={(v) => set('valor', v)} keyboardType="decimal-pad"
                  dica="Já vem com o valor previsto pelo acordo. Ao confirmar, o valor fica congelado e a usuária é avisada de que a consultoria foi liberada." />
              )}
              {acao.tipo === 'agendar' && (
                <>
                  <Text style={st.rotulo}>Arquiteto</Text>
                  {arquitetos.filter(a => a.ativo !== false).length === 0
                    ? <Text style={st.dica}>Cadastre um arquiteto na aba Arquitetos.</Text>
                    : <Chips valor={f.arquitetoId} onMudar={(v) => set('arquitetoId', v)}
                        opcoes={arquitetos.filter(a => a.ativo !== false).map(a => ({ id: a.id, rotulo: `${a.nome}${arqPriv[a.id]?.valorConsultoria ? ` · R$ ${arqPriv[a.id].valorConsultoria}` : ''}` }))} />}
                  <Campo rotulo="Data (DD/MM/AAAA)" valor={f.data} onMudar={(v) => set('data', v)} placeholder="15/12/2026" />
                  <Campo rotulo="Hora (horário de Brasília)" valor={f.hora} onMudar={(v) => set('hora', v)} placeholder="14:30" />
                  <Campo rotulo="Duração (horas)" valor={f.duracao} onMudar={(v) => set('duracao', v)} keyboardType="decimal-pad" />
                  <Campo rotulo="Link da chamada" valor={f.link} onMudar={(v) => set('link', v)} placeholder="https://meet.google.com/…" autoCapitalize="none" />
                  <Campo rotulo="Recado para a usuária (opcional)" valor={f.observacao} onMudar={(v) => set('observacao', v)} multiline />
                </>
              )}
              {acao.tipo === 'pagarArq' && (
                <>
                  <Campo rotulo="Valor pago ao arquiteto (R$)" valor={f.valor} onMudar={(v) => set('valor', v)} keyboardType="decimal-pad" />
                  <Campo rotulo="Link do comprovante (opcional)" valor={f.comprovante} onMudar={(v) => set('comprovante', v)} autoCapitalize="none" />
                </>
              )}
              <View style={[st.acoes, { marginTop: 18 }]}>
                <BotaoAdmin variant="secondary" title="Cancelar" onPress={() => setAcao(null)} disabled={enviando} />
                <BotaoAdmin title="Confirmar" onPress={executar} carregando={enviando} disabled={enviando} />
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ============================ IMOBILIÁRIAS ==================================
const IMOB_VAZIA = {
  nome: '', logoUrl: '', capaUrl: '', descricao: '', creci: '', cidades: '', bairros: '', tipos: ['venda', 'aluguel'],
  site: '', whatsapp: '', instagram: '', destaques: '', ativo: true, ordem: '', regrasBeneficio: '',
  responsavel: '', telefoneInterno: '', emailInterno: '',
  repasseVendaTipo: 'fixo', repasseVendaValor: '', repasseAluguelTipo: 'fixo', repasseAluguelValor: '',
  prazoRepasseDias: '30', contratoUrl: '', vigenciaInicio: '', vigenciaFim: '', dadosPagamentoAtravessia: '', observacoes: '',
};

function SecaoImobiliarias({ imobiliarias, imobPriv, rolagem }) {
  const form = useFormRecolhivel(rolagem);
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState(IMOB_VAZIA);
  const [salvando, setSalvando] = useState(false);
  const [subindo, setSubindo] = useState('');
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const editar = (i) => {
    const p = imobPriv[i.id] || {};
    setEditId(i.id);
    setF({
      ...IMOB_VAZIA, ...i, ...p,
      cidades: (i.cidades || []).join(', '), bairros: (i.bairros || []).join(', '), destaques: (i.destaques || []).join('\n'),
      ordem: i.ordem != null ? String(i.ordem) : '', repasseVendaValor: p.repasseVendaValor != null ? String(p.repasseVendaValor) : '',
      repasseAluguelValor: p.repasseAluguelValor != null ? String(p.repasseAluguelValor) : '',
      prazoRepasseDias: p.prazoRepasseDias != null ? String(p.prazoRepasseDias) : '30',
    });
    form.abrirERolar();
  };
  const limpar = () => { setEditId(null); setF(IMOB_VAZIA); form.setAberto(false); };

  const subir = async (campo) => {
    setSubindo(campo);
    try { const [url] = await enviarImagens('imobiliarias', false); if (url) set(campo, url); } catch (e) { Alert.alert('Erro no envio', e?.message || 'Tente novamente.'); } finally { setSubindo(''); }
  };

  const salvar = async () => {
    if (!f.nome.trim()) { Alert.alert('', 'Informe o nome da imobiliária.'); return; }
    setSalvando(true);
    try {
      const id = editId || doc(collection(db, 'imobiliarias')).id;
      await setDoc(doc(db, 'imobiliarias', id), {
        nome: f.nome.trim(), logoUrl: f.logoUrl.trim(), capaUrl: f.capaUrl.trim(), descricao: f.descricao.trim(), creci: f.creci.trim(),
        cidades: listaDeTexto(f.cidades), bairros: listaDeTexto(f.bairros), tipos: f.tipos || [],
        site: f.site.trim(), whatsapp: f.whatsapp.replace(/\D/g, ''), instagram: f.instagram.trim(),
        destaques: listaDeTexto(f.destaques.replace(/\n/g, ',')).slice(0, 6), ativo: f.ativo !== false,
        ordem: f.ordem === '' ? null : num(f.ordem), regrasBeneficio: f.regrasBeneficio.trim(),
        atualizadoEm: serverTimestamp(), ...(editId ? {} : { criadoEm: serverTimestamp() }),
      }, { merge: true });
      await setDoc(doc(db, 'imobiliariasPrivado', id), {
        responsavel: f.responsavel.trim(), telefoneInterno: f.telefoneInterno.trim(), emailInterno: f.emailInterno.trim(),
        repasseVendaTipo: f.repasseVendaTipo, repasseVendaValor: num(f.repasseVendaValor),
        repasseAluguelTipo: f.repasseAluguelTipo, repasseAluguelValor: num(f.repasseAluguelValor),
        prazoRepasseDias: num(f.prazoRepasseDias) || null, contratoUrl: f.contratoUrl.trim(),
        vigenciaInicio: f.vigenciaInicio.trim(), vigenciaFim: f.vigenciaFim.trim(),
        dadosPagamentoAtravessia: f.dadosPagamentoAtravessia.trim(), observacoes: f.observacoes.trim(),
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      Alert.alert('', editId ? 'Imobiliária atualizada.' : 'Imobiliária cadastrada. Gere o link do portal no cartão dela.');
      limpar();
    } catch (e) {
      Alert.alert('Não foi possível salvar', e?.message || 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const portal = async (i, acaoPortal) => {
    try {
      const r = await chama('gerenciarPortalImobiliaria', { imobiliariaId: i.id, acao: acaoPortal });
      if (r?.linkPortal) copiarOuCompartilhar(r.linkPortal);
      else Alert.alert('', 'Link revogado. O link antigo deixa de funcionar.');
    } catch (e) { Alert.alert('Não foi possível', e?.message || 'Tente novamente.'); }
  };
  const linkAtual = (i) => {
    const t = imobPriv[i.id]?.tokenPortal;
    return t ? `https://o-amor-que-fica.web.app/imobiliaria.html?t=${t}` : '';
  };

  const regra = (tipo, valor) => (!num(valor) ? '—' : tipo === 'percentual' ? `${valor}%` : `R$ ${valor}`);

  return (
    <View>
      <View onLayout={form.onLayout}>
        <Recolhivel titulo={editId ? `Editar: ${f.nome || 'imobiliária'}` : 'Nova imobiliária'} subtitulo="Dados públicos (vitrine) e privados (acordo)"
          icone="business-outline" aberto={form.aberto} onAlternar={form.setAberto}>
          <Text style={st.grupo}>Vitrine (as usuárias veem)</Text>
          <Campo rotulo="Nome *" valor={f.nome} onMudar={(v) => set('nome', v)} />
          <Campo rotulo="CRECI" valor={f.creci} onMudar={(v) => set('creci', v)} />
          <Campo rotulo="Descrição" valor={f.descricao} onMudar={(v) => set('descricao', v)} multiline />
          <View style={st.linhaImg}>
            {['logoUrl', 'capaUrl'].map(k => (
              <View key={k} style={{ flex: 1 }}>
                <Text style={st.rotulo}>{k === 'logoUrl' ? 'Logo' : 'Capa'}</Text>
                {!!f[k] && <Image source={{ uri: urlDeImagem(f[k]) }} style={k === 'logoUrl' ? st.miniLogo : st.miniCapa} />}
                <BotaoAdmin variant="secondary" icone="cloud-upload-outline" title={subindo === k ? 'Enviando…' : 'Enviar imagem'} onPress={() => subir(k)} disabled={!!subindo} />
                <TextInput style={[st.campo, { marginTop: 6 }]} value={f[k]} onChangeText={(v) => set(k, v)} placeholder="ou cole o link" placeholderTextColor={colors.tl} autoCapitalize="none" />
              </View>
            ))}
          </View>
          <Text style={st.rotulo}>Atua com</Text>
          <Chips multiplo valor={f.tipos} onMudar={(v) => set('tipos', v)} opcoes={TIPOS_IMOBILIARIA} />
          <Campo rotulo="Cidades (separe por vírgula)" valor={f.cidades} onMudar={(v) => set('cidades', v)} />
          <Campo rotulo="Bairros de atuação (opcional)" valor={f.bairros} onMudar={(v) => set('bairros', v)} />
          <Campo rotulo="Destaques (um por linha, até 6)" valor={f.destaques} onMudar={(v) => set('destaques', v)} multiline placeholder={'Atendimento sem pressa\nDocumentação acompanhada'} />
          <Campo rotulo="Site" valor={f.site} onMudar={(v) => set('site', v)} autoCapitalize="none" />
          <Campo rotulo="WhatsApp público (com DDD)" valor={f.whatsapp} onMudar={(v) => set('whatsapp', v)} keyboardType="phone-pad" dica="Usado no botão “Falar no WhatsApp com o código”." />
          <Campo rotulo="Instagram" valor={f.instagram} onMudar={(v) => set('instagram', v)} autoCapitalize="none" placeholder="@imobiliaria" />
          <Campo rotulo="Regras do benefício (resumo para a usuária)" valor={f.regrasBeneficio} onMudar={(v) => set('regrasBeneficio', v)} multiline
            dica="Vazio: aparece o texto padrão da consultoria com arquiteto parceiro." />
          <Campo rotulo="Ordem na vitrine" valor={f.ordem} onMudar={(v) => set('ordem', v)} keyboardType="number-pad" />
          <View style={[st.linha, { marginTop: 12 }]}>
            <Text style={st.rotulo}>Ativa no app</Text>
            <Switch value={f.ativo !== false} onValueChange={(v) => set('ativo', v)} />
          </View>

          <Text style={st.grupo}>Acordo (só administradoras)</Text>
          <Campo rotulo="Responsável" valor={f.responsavel} onMudar={(v) => set('responsavel', v)} />
          <Campo rotulo="Telefone interno" valor={f.telefoneInterno} onMudar={(v) => set('telefoneInterno', v)} keyboardType="phone-pad" />
          <Campo rotulo="E-mail interno" valor={f.emailInterno} onMudar={(v) => set('emailInterno', v)} autoCapitalize="none" keyboardType="email-address" />
          <Text style={st.rotulo}>Repasse por venda</Text>
          <Chips valor={f.repasseVendaTipo} onMudar={(v) => set('repasseVendaTipo', v)} opcoes={[{ id: 'fixo', rotulo: 'Valor fixo (R$)' }, { id: 'percentual', rotulo: '% do valor da venda' }]} />
          <TextInput style={[st.campo, { marginTop: 8 }]} value={f.repasseVendaValor} onChangeText={(v) => set('repasseVendaValor', v)} keyboardType="decimal-pad" placeholder={f.repasseVendaTipo === 'percentual' ? 'Ex.: 0,5' : 'Ex.: 1500'} placeholderTextColor={colors.tl} />
          <Text style={st.rotulo}>Repasse por aluguel</Text>
          <Chips valor={f.repasseAluguelTipo} onMudar={(v) => set('repasseAluguelTipo', v)} opcoes={[{ id: 'fixo', rotulo: 'Valor fixo (R$)' }, { id: 'percentual', rotulo: '% do 1º aluguel' }]} />
          <TextInput style={[st.campo, { marginTop: 8 }]} value={f.repasseAluguelValor} onChangeText={(v) => set('repasseAluguelValor', v)} keyboardType="decimal-pad" placeholder={f.repasseAluguelTipo === 'percentual' ? 'Ex.: 30' : 'Ex.: 400'} placeholderTextColor={colors.tl} />
          <Campo rotulo="Prazo do repasse (dias após o pagamento)" valor={f.prazoRepasseDias} onMudar={(v) => set('prazoRepasseDias', v)} keyboardType="number-pad" />
          <Campo rotulo="Dados para a imobiliária pagar a Atravessia (PIX/conta)" valor={f.dadosPagamentoAtravessia} onMudar={(v) => set('dadosPagamentoAtravessia', v)} multiline dica="Aparece no portal da imobiliária." />
          <Campo rotulo="Contrato (link do Drive)" valor={f.contratoUrl} onMudar={(v) => set('contratoUrl', v)} autoCapitalize="none" />
          <Campo rotulo="Vigência: início (AAAA-MM-DD)" valor={f.vigenciaInicio} onMudar={(v) => set('vigenciaInicio', v)} />
          <Campo rotulo="Vigência: fim (AAAA-MM-DD)" valor={f.vigenciaFim} onMudar={(v) => set('vigenciaFim', v)} />
          <Campo rotulo="Observações internas" valor={f.observacoes} onMudar={(v) => set('observacoes', v)} multiline />
          <View style={[st.acoes, { marginTop: 16 }]}>
            {editId && <BotaoAdmin variant="secondary" title="Cancelar edição" onPress={limpar} />}
            <BotaoAdmin title={editId ? 'Salvar alterações' : 'Cadastrar imobiliária'} onPress={salvar} carregando={salvando} disabled={salvando} />
          </View>
        </Recolhivel>
      </View>

      {imobiliarias.length === 0 && <Text style={st.dica}>Nenhuma imobiliária cadastrada ainda.</Text>}
      {imobiliarias.map(i => {
        const p = imobPriv[i.id] || {};
        return (
          <View key={i.id} style={[st.card, i.ativo === false && { opacity: 0.7 }]}>
            <View style={st.linha}>
              {i.logoUrl ? <Image source={{ uri: urlDeImagem(i.logoUrl) }} style={st.logoLista} resizeMode="contain" /> : <Pilula icone="business-outline" />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.titulo}>{i.nome}{i.ativo === false ? ' (oculta)' : ''}</Text>
                <Text style={st.legenda}>{(i.cidades || []).join(', ') || 'Sem cidade'}{i.creci ? ` · CRECI ${i.creci}` : ''}</Text>
              </View>
            </View>
            <Text style={st.legenda}>Repasse: venda {regra(p.repasseVendaTipo, p.repasseVendaValor)} · aluguel {regra(p.repasseAluguelTipo, p.repasseAluguelValor)}{p.prazoRepasseDias ? ` · em até ${p.prazoRepasseDias} dias` : ''}</Text>
            {!!p.responsavel && <Text style={st.legenda}>Responsável: {p.responsavel}{p.telefoneInterno ? ` · ${p.telefoneInterno}` : ''}</Text>}
            {!!p.vigenciaFim && <Text style={st.legenda}>Vigência até {String(p.vigenciaFim).split('-').reverse().join('/')}</Text>}
            <View style={[st.acoes, { marginTop: 10 }]}>
              {linkAtual(i)
                ? <BotaoAdmin variant="secondary" icone="link-outline" title="Copiar link do portal" onPress={() => copiarOuCompartilhar(linkAtual(i))} />
                : <BotaoAdmin variant="secondary" icone="link-outline" title="Gerar link do portal" onPress={() => portal(i, 'novoLink')} />}
              {!!linkAtual(i) && <BotaoAdmin variant="secondary" icone="refresh-outline" title="Novo link" onPress={() => confirmar('Gerar novo link', 'O link atual deixa de funcionar. Continuar?', () => portal(i, 'novoLink'))} />}
              {!!linkAtual(i) && <BotaoAdmin variant="secondary" icone="close-circle-outline" title="Revogar" onPress={() => confirmar('Revogar link', 'A imobiliária perde o acesso ao portal até você gerar outro link.', () => portal(i, 'revogar'))} />}
              {!!p.contratoUrl && <BotaoAdmin variant="secondary" icone="document-text-outline" title="Contrato" onPress={() => abrirLink(p.contratoUrl)} />}
            </View>
            <AcoesItem onEditar={() => editar(i)} rotuloApagar="Apagar"
              extra={<BotaoAdmin variant="secondary" title={i.ativo === false ? 'Mostrar no app' : 'Ocultar do app'} onPress={() => setDoc(doc(db, 'imobiliarias', i.id), { ativo: i.ativo === false }, { merge: true })} />}
              onApagar={() => confirmar('Apagar imobiliária', `Apagar "${i.nome}"? As indicações já feitas continuam guardadas.`, async () => {
                await deleteDoc(doc(db, 'imobiliarias', i.id));
                await deleteDoc(doc(db, 'imobiliariasPrivado', i.id)).catch(() => {});
              }, 'Apagar')} />
          </View>
        );
      })}
    </View>
  );
}

// ============================ IMÓVEIS =======================================
const IMOVEL_VAZIO = {
  imobiliariaId: '', titulo: '', tipo: 'apartamento', finalidade: 'venda', preco: '', condominio: '', bairro: '', cidade: '',
  quartos: '', banheiros: '', vagas: '', areaM2: '', fotos: [], descricao: '', linkAnuncio: '', ativo: true, ordem: '',
};

function SecaoImoveis({ imoveis, imobiliarias, rolagem }) {
  const form = useFormRecolhivel(rolagem);
  const [filtro, setFiltro] = useState('todas');
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState(IMOVEL_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const [urlFoto, setUrlFoto] = useState('');
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const nomeImob = (id) => imobiliarias.find(i => i.id === id)?.nome || '—';

  const editar = (i) => {
    setEditId(i.id);
    setF({ ...IMOVEL_VAZIO, ...i, ...Object.fromEntries(['preco', 'condominio', 'quartos', 'banheiros', 'vagas', 'areaM2', 'ordem'].map(k => [k, i[k] != null ? String(i[k]) : ''])), fotos: i.fotos || [] });
    form.abrirERolar();
  };
  const limpar = () => { setEditId(null); setF(IMOVEL_VAZIO); form.setAberto(false); };

  const subirFotos = async () => {
    setSubindo(true);
    try { const urls = await enviarImagens('fotos', true); set('fotos', [...(f.fotos || []), ...urls].slice(0, 20)); } catch (e) { Alert.alert('Erro no envio', e?.message || 'Tente novamente.'); } finally { setSubindo(false); }
  };

  const salvar = async () => {
    if (!f.imobiliariaId) { Alert.alert('', 'Escolha a imobiliária.'); return; }
    if (!f.titulo.trim()) { Alert.alert('', 'Dê um título ao imóvel.'); return; }
    setSalvando(true);
    try {
      const id = editId || doc(collection(db, 'imoveis')).id;
      await setDoc(doc(db, 'imoveis', id), {
        imobiliariaId: f.imobiliariaId, titulo: f.titulo.trim(), tipo: f.tipo, finalidade: f.finalidade,
        preco: num(f.preco), condominio: num(f.condominio), bairro: f.bairro.trim(), cidade: f.cidade.trim(),
        quartos: num(f.quartos), banheiros: num(f.banheiros), vagas: num(f.vagas), areaM2: num(f.areaM2),
        fotos: f.fotos || [], descricao: f.descricao.trim(), linkAnuncio: f.linkAnuncio.trim(), ativo: f.ativo !== false,
        ordem: f.ordem === '' ? null : num(f.ordem), atualizadoEm: serverTimestamp(), ...(editId ? {} : { criadoEm: serverTimestamp() }),
      }, { merge: true });
      Alert.alert('', 'Imóvel salvo.');
      limpar();
    } catch (e) { Alert.alert('Não foi possível salvar', e?.message || 'Tente novamente.'); } finally { setSalvando(false); }
  };

  const lista = imoveis.filter(i => filtro === 'todas' || i.imobiliariaId === filtro);
  const opcoesImob = imobiliarias.map(i => ({ id: i.id, rotulo: i.nome }));

  return (
    <View>
      <View onLayout={form.onLayout}>
        <Recolhivel titulo={editId ? `Editar: ${f.titulo || 'imóvel'}` : 'Novo imóvel'} subtitulo="Vitrine de imóveis de cada imobiliária" icone="home-outline" aberto={form.aberto} onAlternar={form.setAberto}>
          <Text style={st.rotulo}>Imobiliária *</Text>
          <Suspensa valor={f.imobiliariaId} opcoes={opcoesImob} onMudar={(v) => set('imobiliariaId', v)} placeholder="Escolher imobiliária" />
          <Campo rotulo="Título *" valor={f.titulo} onMudar={(v) => set('titulo', v)} placeholder="Apartamento iluminado perto do parque" />
          <Text style={st.rotulo}>Finalidade</Text>
          <Chips valor={f.finalidade} onMudar={(v) => set('finalidade', v)} opcoes={[{ id: 'venda', rotulo: 'Venda' }, { id: 'aluguel', rotulo: 'Aluguel' }]} />
          <Text style={st.rotulo}>Tipo</Text>
          <Chips valor={f.tipo} onMudar={(v) => set('tipo', v)} opcoes={TIPOS_IMOVEL} />
          <Campo rotulo={f.finalidade === 'aluguel' ? 'Aluguel mensal (R$)' : 'Preço (R$)'} valor={f.preco} onMudar={(v) => set('preco', v)} keyboardType="decimal-pad" />
          <Campo rotulo="Condomínio (R$/mês, opcional)" valor={f.condominio} onMudar={(v) => set('condominio', v)} keyboardType="decimal-pad" />
          <Campo rotulo="Bairro" valor={f.bairro} onMudar={(v) => set('bairro', v)} />
          <Campo rotulo="Cidade" valor={f.cidade} onMudar={(v) => set('cidade', v)} />
          <View style={st.grade4}>
            {[['quartos', 'Quartos'], ['banheiros', 'Banheiros'], ['vagas', 'Vagas'], ['areaM2', 'Área m²']].map(([k, r]) => (
              <View key={k} style={{ flexBasis: '45%', flexGrow: 1 }}><Campo rotulo={r} valor={f[k]} onMudar={(v) => set(k, v)} keyboardType="decimal-pad" /></View>
            ))}
          </View>
          <Text style={st.rotulo}>Fotos ({(f.fotos || []).length})</Text>
          <View style={st.fotos}>
            {(f.fotos || []).map((u, i) => (
              <View key={u}>
                <Image source={{ uri: urlDeImagem(u) }} style={st.foto} />
                <TouchableOpacity style={st.fotoX} onPress={() => set('fotos', f.fotos.filter((_, j) => j !== i))} accessibilityLabel="Remover foto">
                  <Ionicons name="close" size={14} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <BotaoAdmin variant="secondary" icone="images-outline" title={subindo ? 'Enviando…' : 'Enviar fotos'} onPress={subirFotos} disabled={subindo} style={{ marginTop: 8 }} />
          <View style={[st.linha, { marginTop: 8 }]}>
            <TextInput style={[st.campo, { flex: 1 }]} value={urlFoto} onChangeText={setUrlFoto} placeholder="ou cole o link de uma foto" placeholderTextColor={colors.tl} autoCapitalize="none" />
            <BotaoAdmin variant="secondary" title="Adicionar" onPress={() => { if (urlFoto.trim()) { set('fotos', [...(f.fotos || []), urlFoto.trim()]); setUrlFoto(''); } }} />
          </View>
          <Campo rotulo="Descrição" valor={f.descricao} onMudar={(v) => set('descricao', v)} multiline />
          <Campo rotulo="Link do anúncio original" valor={f.linkAnuncio} onMudar={(v) => set('linkAnuncio', v)} autoCapitalize="none" />
          <Campo rotulo="Ordem" valor={f.ordem} onMudar={(v) => set('ordem', v)} keyboardType="number-pad" />
          <View style={[st.linha, { marginTop: 12 }]}>
            <Text style={st.rotulo}>Ativo na vitrine</Text>
            <Switch value={f.ativo !== false} onValueChange={(v) => set('ativo', v)} />
          </View>
          <View style={[st.acoes, { marginTop: 16 }]}>
            {editId && <BotaoAdmin variant="secondary" title="Cancelar edição" onPress={limpar} />}
            <BotaoAdmin title={editId ? 'Salvar alterações' : 'Cadastrar imóvel'} onPress={salvar} carregando={salvando} disabled={salvando} />
          </View>
        </Recolhivel>
      </View>

      <Text style={st.rotulo}>Filtrar por imobiliária</Text>
      <Suspensa valor={filtro} opcoes={[{ id: 'todas', rotulo: 'Todas' }, ...opcoesImob]} onMudar={setFiltro} />
      {lista.length === 0 && <Text style={[st.dica, { marginTop: 12 }]}>Nenhum imóvel cadastrado.</Text>}
      {lista.map(i => (
        <View key={i.id} style={[st.card, i.ativo === false && { opacity: 0.7 }]}>
          <View style={st.linha}>
            {(i.fotos || [])[0] ? <Image source={{ uri: urlDeImagem(i.fotos[0]) }} style={st.fotoLista} /> : <Pilula icone="home-outline" />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.titulo} numberOfLines={2}>{i.titulo}{i.ativo === false ? ' (oculto)' : ''}</Text>
              <Text style={st.legenda}>{precoTexto(i.preco, i.finalidade)} · {rotuloTipoImovel(i.tipo)} · {[i.bairro, i.cidade].filter(Boolean).join(', ')}</Text>
              <Text style={st.dica}>{nomeImob(i.imobiliariaId)} · {(i.fotos || []).length} fotos</Text>
            </View>
          </View>
          <AcoesItem onEditar={() => editar(i)} onApagar={() => confirmar('Apagar imóvel', `Apagar "${i.titulo}"?`, () => deleteDoc(doc(db, 'imoveis', i.id)), 'Apagar')} />
        </View>
      ))}
    </View>
  );
}

// ============================ ARQUITETOS ====================================
const ARQ_VAZIO = { nome: '', fotoUrl: '', bio: '', cau: '', especialidades: '', ativo: true, valorConsultoria: '', telefone: '', email: '', dadosPagamento: '' };

function SecaoArquitetos({ arquitetos, arqPriv, rolagem }) {
  const form = useFormRecolhivel(rolagem);
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState(ARQ_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const editar = (a) => {
    const p = arqPriv[a.id] || {};
    setEditId(a.id);
    setF({ ...ARQ_VAZIO, ...a, ...p, especialidades: (a.especialidades || []).join(', '), valorConsultoria: p.valorConsultoria != null ? String(p.valorConsultoria) : '' });
    form.abrirERolar();
  };
  const limpar = () => { setEditId(null); setF(ARQ_VAZIO); form.setAberto(false); };
  const salvar = async () => {
    if (!f.nome.trim()) { Alert.alert('', 'Informe o nome.'); return; }
    setSalvando(true);
    try {
      const id = editId || doc(collection(db, 'arquitetos')).id;
      await setDoc(doc(db, 'arquitetos', id), {
        nome: f.nome.trim(), fotoUrl: f.fotoUrl.trim(), bio: f.bio.trim(), cau: f.cau.trim(),
        especialidades: listaDeTexto(f.especialidades), ativo: f.ativo !== false, atualizadoEm: serverTimestamp(),
      }, { merge: true });
      await setDoc(doc(db, 'arquitetosPrivado', id), {
        valorConsultoria: num(f.valorConsultoria), telefone: f.telefone.trim(), email: f.email.trim(),
        dadosPagamento: f.dadosPagamento.trim(), atualizadoEm: serverTimestamp(),
      }, { merge: true });
      Alert.alert('', 'Arquiteto salvo.');
      limpar();
    } catch (e) { Alert.alert('Não foi possível salvar', e?.message || 'Tente novamente.'); } finally { setSalvando(false); }
  };

  return (
    <View>
      <View onLayout={form.onLayout}>
        <Recolhivel titulo={editId ? `Editar: ${f.nome}` : 'Novo arquiteto parceiro'} subtitulo="Quem faz a consultoria online" icone="color-palette-outline" aberto={form.aberto} onAlternar={form.setAberto}>
          <Campo rotulo="Nome *" valor={f.nome} onMudar={(v) => set('nome', v)} />
          <Campo rotulo="Registro CAU" valor={f.cau} onMudar={(v) => set('cau', v)} />
          <Text style={st.rotulo}>Foto</Text>
          {!!f.fotoUrl && <Image source={{ uri: urlDeImagem(f.fotoUrl) }} style={st.miniLogo} />}
          <BotaoAdmin variant="secondary" icone="cloud-upload-outline" title="Enviar foto" onPress={async () => { try { const [u] = await enviarImagens('arquitetos', false); if (u) set('fotoUrl', u); } catch (e) { Alert.alert('Erro', e?.message); } }} />
          <Campo rotulo="Bio" valor={f.bio} onMudar={(v) => set('bio', v)} multiline />
          <Campo rotulo="Especialidades (separe por vírgula)" valor={f.especialidades} onMudar={(v) => set('especialidades', v)} placeholder="Organização, decoração afetiva, pequenos espaços" />
          <Text style={st.grupo}>Privado</Text>
          <Campo rotulo="Valor por consultoria (R$)" valor={f.valorConsultoria} onMudar={(v) => set('valorConsultoria', v)} keyboardType="decimal-pad" dica="Fica congelado em cada lead quando a consultoria é agendada." />
          <Campo rotulo="Telefone" valor={f.telefone} onMudar={(v) => set('telefone', v)} keyboardType="phone-pad" />
          <Campo rotulo="E-mail" valor={f.email} onMudar={(v) => set('email', v)} autoCapitalize="none" />
          <Campo rotulo="Dados de pagamento (PIX/conta)" valor={f.dadosPagamento} onMudar={(v) => set('dadosPagamento', v)} multiline />
          <View style={[st.linha, { marginTop: 12 }]}>
            <Text style={st.rotulo}>Ativo</Text>
            <Switch value={f.ativo !== false} onValueChange={(v) => set('ativo', v)} />
          </View>
          <View style={[st.acoes, { marginTop: 16 }]}>
            {editId && <BotaoAdmin variant="secondary" title="Cancelar edição" onPress={limpar} />}
            <BotaoAdmin title={editId ? 'Salvar alterações' : 'Cadastrar arquiteto'} onPress={salvar} carregando={salvando} disabled={salvando} />
          </View>
        </Recolhivel>
      </View>
      {arquitetos.length === 0 && <Text style={st.dica}>Nenhum arquiteto cadastrado.</Text>}
      {arquitetos.map(a => (
        <View key={a.id} style={[st.card, a.ativo === false && { opacity: 0.7 }]}>
          <View style={st.linha}>
            {a.fotoUrl ? <Image source={{ uri: urlDeImagem(a.fotoUrl) }} style={st.logoLista} /> : <Pilula icone="person-outline" />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.titulo}>{a.nome}{a.ativo === false ? ' (inativo)' : ''}</Text>
              <Text style={st.legenda}>{a.cau ? `CAU ${a.cau} · ` : ''}{arqPriv[a.id]?.valorConsultoria ? `R$ ${arqPriv[a.id].valorConsultoria} por consultoria` : 'Sem valor definido'}</Text>
              {(a.especialidades || []).length > 0 && <Text style={st.dica}>{a.especialidades.join(' · ')}</Text>}
            </View>
          </View>
          <AcoesItem onEditar={() => editar(a)} onApagar={() => confirmar('Apagar arquiteto', `Apagar "${a.nome}"?`, async () => {
            await deleteDoc(doc(db, 'arquitetos', a.id)); await deleteDoc(doc(db, 'arquitetosPrivado', a.id)).catch(() => {});
          }, 'Apagar')} />
        </View>
      ))}
    </View>
  );
}

// ============================ FINANCEIRO ====================================
export function resumoFinanceiro(leads, privLeads) {
  const r = { recebido: 0, aReceber: 0, arqPago: 0, arqAPagar: 0, porImob: {} };
  leads.forEach(l => {
    const p = privLeads[l.id] || {};
    const pi = r.porImob[l.imobiliariaId] || (r.porImob[l.imobiliariaId] = { nome: l.imobiliariaNome, leads: 0, fechados: 0, recebido: 0, aReceber: 0 });
    pi.leads += 1;
    if (['fechado', 'pago', 'consultoria_agendada', 'concluido'].includes(l.status)) pi.fechados += 1;
    if (p.repasseCentavos != null) { r.recebido += p.repasseCentavos; pi.recebido += p.repasseCentavos; }
    if (l.status === 'fechado') { r.aReceber += p.repassePrevistoCentavos || 0; pi.aReceber += p.repassePrevistoCentavos || 0; }
    if (p.arquitetoPagoEm) r.arqPago += p.arquitetoPagoCentavos ?? p.custoArquitetoCentavos ?? 0;
    else if (p.custoArquitetoCentavos != null) r.arqAPagar += p.custoArquitetoCentavos;
  });
  r.margem = r.recebido - r.arqPago - r.arqAPagar;
  return r;
}

function SecaoFinanceiro({ leads, privLeads }) {
  const r = resumoFinanceiro(leads, privLeads);
  const pagosSemArq = leads.filter(l => l.status === 'pago').length;
  const caixa = (rotulo, valor, tom) => (
    <View style={st.stat}><Text style={[st.statN, tom && { color: acento(tom).texto }]} numberOfLines={1} adjustsFontSizeToFit>{brlCentavos(valor)}</Text><Text style={st.statL}>{rotulo}</Text></View>
  );
  return (
    <View>
      <View style={st.stats}>
        {caixa('Recebido das imobiliárias', r.recebido, 'salvia')}
        {caixa('A receber (negócios fechados)', r.aReceber, 'dourado')}
        {caixa('Pago a arquitetos', r.arqPago)}
        {caixa('A pagar a arquitetos', r.arqAPagar, 'pessego')}
        {caixa('Margem (recebido − arquitetos)', r.margem, 'lilas')}
      </View>
      {pagosSemArq > 0 && (
        <View style={[st.aviso, { marginTop: 12 }]}>
          <Ionicons name="calendar-outline" size={18} color={acento('dourado').texto} />
          <Text style={st.avisoTxt}>{pagosSemArq === 1 ? '1 consultoria liberada' : `${pagosSemArq} consultorias liberadas`} ainda sem data. O custo do arquiteto entra no cálculo quando a consultoria é agendada.</Text>
        </View>
      )}
      <Text style={[st.grupo, { marginTop: 18 }]}>Por imobiliária</Text>
      {Object.entries(r.porImob).map(([id, x]) => (
        <View key={id} style={st.card}>
          <Text style={st.titulo}>{x.nome}</Text>
          <Text style={st.legenda}>{x.leads} indicações · {x.fechados} negócios fechados</Text>
          <Text style={st.legenda}>Recebido {brlCentavos(x.recebido)} · a receber {brlCentavos(x.aReceber)}</Text>
        </View>
      ))}
    </View>
  );
}

// ============================ TELA ==========================================
export default function AdminImobiliariasScreen({ navigation }) {
  const rolagem = useRef(null);
  const [secao, setSecao] = useState('leads');
  const [imobiliarias, setImobiliarias] = useState([]);
  const [imobPriv, setImobPriv] = useState({});
  const [imoveis, setImoveis] = useState([]);
  const [arquitetos, setArquitetos] = useState([]);
  const [arqPriv, setArqPriv] = useState({});
  const [leads, setLeads] = useState([]);
  const [privLeads, setPrivLeads] = useState({});
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const mapa = (snap) => Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
    const lista = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const subs = [
      onSnapshot(collection(db, 'imobiliarias'), s => setImobiliarias(ordenar(lista(s))), () => {}),
      onSnapshot(collection(db, 'imobiliariasPrivado'), s => setImobPriv(mapa(s)), () => {}),
      onSnapshot(collection(db, 'imoveis'), s => setImoveis(ordenar(lista(s))), () => {}),
      onSnapshot(collection(db, 'arquitetos'), s => setArquitetos(ordenar(lista(s))), () => {}),
      onSnapshot(collection(db, 'arquitetosPrivado'), s => setArqPriv(mapa(s)), () => {}),
      onSnapshot(collection(db, 'indicacoesImoveis'), s => { setLeads(lista(s).sort((a, b) => tsMs(b.criadoEm) - tsMs(a.criadoEm))); setCarregando(false); }, () => setCarregando(false)),
      onSnapshot(collection(db, 'indicacoesImoveisPrivado'), s => setPrivLeads(mapa(s)), () => {}),
    ];
    return () => subs.forEach(u => u());
  }, []);

  const pendentes = leads.filter(l => l.status === 'fechado' || l.status === 'pago').length;

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminImobiliarias">
      <AdminSubTabs grupo="parcerias" atual="AdminImobiliarias" />
      <ScrollView ref={rolagem} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={st.scroll}>
        <Text style={st.sobre}>Parcerias · Lar e recomeço</Text>
        <Text style={st.pageTitle}>Imobiliárias</Text>
        <Text style={st.pageSub}>
          A usuária indica interesse, a imobiliária negocia e, quando o negócio fecha e o repasse chega, a Atravessia agenda a consultoria com arquiteto parceiro.
        </Text>
        {pendentes > 0 && (
          <View style={[st.aviso, { marginTop: 12 }]}>
            <Ionicons name="alert-circle-outline" size={18} color={acento('dourado').texto} />
            <Text style={st.avisoTxt}>{pendentes} {pendentes === 1 ? 'indicação precisa' : 'indicações precisam'} da sua ação (confirmar repasse ou agendar consultoria).</Text>
          </View>
        )}
        <View style={{ marginTop: 14 }}><Chips valor={secao} onMudar={setSecao} opcoes={SECOES} /></View>
        <View style={{ marginTop: 14 }}>
          {carregando ? <ActivityIndicator color={colors.lav4} /> : (
            <>
              {secao === 'leads' && <SecaoLeads leads={leads} privLeads={privLeads} imobiliarias={imobiliarias} arquitetos={arquitetos} arqPriv={arqPriv} />}
              {secao === 'imobiliarias' && <SecaoImobiliarias imobiliarias={imobiliarias} imobPriv={imobPriv} rolagem={rolagem} />}
              {secao === 'imoveis' && <SecaoImoveis imoveis={imoveis} imobiliarias={imobiliarias} rolagem={rolagem} />}
              {secao === 'arquitetos' && <SecaoArquitetos arquitetos={arquitetos} arqPriv={arqPriv} rolagem={rolagem} />}
              {secao === 'financeiro' && <SecaoFinanceiro leads={leads} privLeads={privLeads} />}
            </>
          )}
        </View>
      </ScrollView>
    </AdminLayout>
  );
}

const st = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 80 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: est.subtitulo(),
  rotulo: est.rotulo(),
  campo: est.campo(),
  dica: est.dica(),
  grupo: { ...est.secao(), fontSize: 16, marginTop: 18 },
  legenda: { ...est.legenda(), marginTop: 2 },
  titulo: est.cartaoTitulo(),
  card: { ...est.vidro(22), padding: 16, marginTop: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between' },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipTxt: est.chipTxt(),
  chipTxtSel: est.chipTxtSel(),
  suspensa: { ...est.campo(), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  suspensaTxt: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.td },
  veu: est.veu(),
  modal: { ...est.modal(), padding: 20, maxWidth: 520, width: '100%', alignSelf: 'center' },
  modalTit: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.titulo, marginBottom: 4 },
  opcao: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.bordaSuave },
  opcaoTxt: { fontFamily: fonts.body, fontSize: 15, color: colors.td },
  etq: est.etiqueta(),
  etqTxt: est.etiquetaTxt(),
  codigo: { fontFamily: fonts.bodyBold, fontSize: 15, letterSpacing: 1, color: colors.lilasTexto },
  fin: { ...est.tenue(14), padding: 10, marginTop: 8, gap: 2 },
  finTxt: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.td },
  funil: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  funilItem: { ...est.vidro(16), paddingVertical: 10, paddingHorizontal: 12, minWidth: 92, flexGrow: 1, flexBasis: '22%' },
  funilSel: { borderColor: colors.lav3, backgroundColor: colors.lav1 },
  funilN: { fontFamily: 'Figtree_800ExtraBold', fontSize: 20, color: colors.titulo },
  funilL: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.texto2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { ...est.vidro(18), padding: 14, flexGrow: 1, flexBasis: '45%' },
  statN: { fontFamily: 'Figtree_800ExtraBold', fontSize: 20, color: colors.titulo },
  statL: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2, marginTop: 2 },
  aviso: est.aviso('dourado'),
  avisoTxt: est.avisoTxt('dourado'),
  linhaImg: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  miniLogo: { width: 72, height: 72, borderRadius: 16, marginBottom: 8, backgroundColor: '#FFF' },
  miniCapa: { width: '100%', height: 72, borderRadius: 12, marginBottom: 8 },
  logoLista: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#FFF' },
  fotoLista: { width: 64, height: 52, borderRadius: 12 },
  grade4: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foto: { width: 84, height: 64, borderRadius: 10 },
  fotoX: { position: 'absolute', top: 3, right: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(42,36,51,0.7)', alignItems: 'center', justifyContent: 'center' },
}), { escalar: false });
