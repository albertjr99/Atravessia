import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db, functions } from '../../services/firebase';
import { colors, fonts, criarEstilos } from '../../theme';
import { confirmar } from '../../utils/confirm';
import Recolhivel from '../../components/Recolhivel';
import { est, acento, Degrade } from './adminEstilo';
import {
  TERMO_VERSAO, CAMPOS_TERMO, rascunhoInicialTermo, aplicarCamposTermo, camposFaltandoTermo,
  proximaVersaoTermo, linhasParaResumo, blocosTermo, trechosTermo,
} from '../../config/termoProfissional';

// Termo de parceria do profissional — editor no app (Cursos → Profissionais).
// Mesma tela do painel web: admin-web/src/TermoProfissionalPainel.jsx.
// Fonte única: configuracoes/termoProfissional (+ histórico em versoes/{versao}).
// Rascunho e publicação passam pela função publicarTermoProfissional; publicar
// sobe a versão e faz todos os profissionais aceitarem de novo no portal.

const ms = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : 0);
const dataHora = (t) => (t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const CAMPOS_VAZIOS = Object.fromEntries(CAMPOS_TERMO.map(c => [c.k, '']));

// Documento publicado (ou null) + versão vigente, em tempo real.
export function useTermoProfissional() {
  const [estado, setEstado] = useState({ carregado: false, doc: null });
  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'termoProfissional'),
    (sn) => setEstado({ carregado: true, doc: sn.exists() ? sn.data() : null }),
    () => setEstado({ carregado: true, doc: null })), []);
  return { ...estado, versao: estado.doc?.versao ? String(estado.doc.versao) : TERMO_VERSAO };
}

function pontoDePartida(d) {
  if (d?.rascunho?.texto) return { ...d.rascunho, origem: `Rascunho salvo em ${dataHora(ms(d.rascunho.salvoEm))} (ainda não publicado)` };
  if (d?.texto) return { texto: d.texto, resumo: d.resumo, campos: d.campos, origem: `Texto da versão ${d.versao} publicada` };
  return { ...rascunhoInicialTermo(), origem: 'Rascunho inicial: texto da versão 1.0 com os [colchetes] trocados pelos campos abaixo' };
}

// Markdown simples (## títulos, parágrafos, listas "- ", **negrito**) só com <Text>.
function Trechos({ texto, style }) {
  return (
    <Text style={style}>
      {trechosTermo(texto).map((p, i) => (p.negrito ? <Text key={i} style={{ fontFamily: fonts.bodyBold }}>{p.texto}</Text> : p.texto))}
    </Text>
  );
}
function TextoTermo({ texto }) {
  return blocosTermo(texto).map((b, i) => {
    if (b.tipo === 'titulo') return <Trechos key={i} texto={b.texto} style={s.prevTitulo} />;
    if (b.tipo === 'lista') return <View key={i}>{b.itens.map((t, j) => <Trechos key={j} texto={`•  ${t}`} style={s.prevPar} />)}</View>;
    return <Trechos key={i} texto={b.texto} style={s.prevPar} />;
  });
}

export default function TermoProfissionalAdmin({ termo, profissionais, privados }) {
  const { carregado, doc: termoDoc, versao } = termo;
  const [form, setForm] = useState(null);
  const [alterado, setAlterado] = useState(false);
  const [previa, setPrevia] = useState(false);
  const [ocupado, setOcupado] = useState('');
  const [versoes, setVersoes] = useState([]);
  const [verVersao, setVerVersao] = useState(null);

  const carregarForm = (d) => {
    const o = pontoDePartida(d);
    setForm({ texto: o.texto || '', resumoTxt: (o.resumo || []).join('\n'), campos: { ...CAMPOS_VAZIOS, ...(o.campos || {}) }, origem: o.origem });
    setAlterado(false);
  };
  useEffect(() => { if (carregado && (!form || !alterado)) carregarForm(termoDoc); }, [carregado, termoDoc, alterado]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onSnapshot(collection(db, 'configuracoes', 'termoProfissional', 'versoes'),
    (sn) => setVersoes(sn.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.publicadoEm) - ms(a.publicadoEm))),
    () => setVersoes([])), []);

  const mudar = (k) => (v) => { setForm(f => ({ ...f, [k]: v })); setAlterado(true); };
  const mudarCampo = (k) => (v) => { setForm(f => ({ ...f, campos: { ...f.campos, [k]: v } })); setAlterado(true); };
  const resumo = useMemo(() => linhasParaResumo(form?.resumoTxt), [form?.resumoTxt]);
  const faltando = useMemo(() => (form ? camposFaltandoTermo(form.texto, resumo, form.campos) : []), [form, resumo]);
  const aceites = useMemo(() => profissionais.map(p => {
    const priv = privados[p.id] || {};
    const em = ms(priv.termoAceitoEm);
    return { id: p.id, nome: p.nome || '—', versao: priv.termoVersao || null, em, emDia: !!em && priv.termoVersao === versao && !priv.termoPedirNovo, pedirNovo: !!priv.termoPedirNovo };
  }), [profissionais, privados, versao]);

  if (!form) return null;
  const novaVersao = proximaVersaoTermo(versao);
  const enviar = (extra) => httpsCallable(functions, 'publicarTermoProfissional')({ texto: form.texto, resumo, campos: form.campos, ...extra });

  const salvarRascunho = async () => {
    setOcupado('rascunho');
    try { await enviar({ somenteRascunho: true }); setAlterado(false); Alert.alert('Rascunho salvo', 'Os profissionais continuam vendo a versão publicada.'); }
    catch (e) { Alert.alert('Não foi possível salvar', e?.message || ''); }
    setOcupado('');
  };
  const publicar = () => {
    if (faltando.length) { Alert.alert('Faltam dados da empresa', `Preencha antes de publicar: ${faltando.map(f => f.rotulo).join(', ')}.`); return; }
    confirmar(`Publicar a versão ${novaVersao}?`, 'Todos os profissionais precisarão aceitar de novo: no próximo acesso ao portal, o extrato só aparece depois do novo aceite.', async () => {
      setOcupado('publicar');
      try {
        const { data } = await enviar({ versaoBase: versao });
        setAlterado(false); setPrevia(false);
        Alert.alert('Termo publicado', `Versão ${data?.versao || novaVersao} publicada. O portal vai pedir o novo aceite.`);
      } catch (e) { Alert.alert('Não foi possível publicar', e?.message || ''); }
      setOcupado('');
    }, 'Publicar');
  };
  const descartar = () => confirmar('Descartar alterações', 'Voltar ao texto salvo e perder o que foi editado aqui?', () => carregarForm(termoDoc), 'Descartar');
  const recomecar = () => confirmar('Recomeçar do texto 1.0', 'Trocar o texto do editor pelo original da versão 1.0? Os campos preenchidos são mantidos.', () => {
    const r = rascunhoInicialTermo();
    setForm(f => ({ ...f, texto: r.texto, resumoTxt: r.resumo.join('\n'), origem: 'Texto original da versão 1.0 (não salvo)' }));
    setAlterado(true);
  }, 'Recomeçar');

  const emDia = aceites.filter(a => a.emDia).length;
  const subtitulo = termoDoc?.texto
    ? `Versão ${versao} publicada em ${dataHora(ms(termoDoc.publicadoEm))} · ${emDia} de ${aceites.length} aceitaram`
    : `Versão ${versao} (texto original) · ${emDia} de ${aceites.length} aceitaram`;

  return (
    <View style={{ marginBottom: 12 }}>
      <Recolhivel titulo="Termo do profissional" subtitulo={subtitulo} icone="document-text-outline">
        <Text style={s.dica}>{form.origem}.{alterado ? ' Há alterações não salvas.' : ''}</Text>

        <Text style={s.secaoForm}>Dados da empresa</Text>
        <Text style={s.dica}>Preenchem o texto nos marcadores {'{{razaoSocial}}'}, {'{{cnpj}}'} etc.</Text>
        {CAMPOS_TERMO.map(c => (
          <View key={c.k}>
            <Text style={s.rotulo}>{c.rotulo}</Text>
            <TextInput style={s.campo} value={form.campos[c.k] || ''} onChangeText={mudarCampo(c.k)} maxLength={400}
              placeholder={`ex.: ${c.exemplo}`} placeholderTextColor={colors.tl} autoCapitalize={c.k === 'encarregadoEmail' ? 'none' : 'sentences'} />
          </View>
        ))}
        {faltando.length > 0 && <Text style={s.aviso}>Faltam para publicar: {faltando.map(f => f.rotulo).join(', ')}.</Text>}

        <View style={[s.linha, { marginTop: 16 }]}>
          {[[false, 'Editar texto'], [true, 'Pré-visualizar']].map(([v, r]) => (
            <TouchableOpacity key={r} style={[s.chip, previa === v && s.chipSel]} onPress={() => setPrevia(v)}>
              <Text style={[s.chipTxt, previa === v && s.chipTxtSel]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!previa ? (
          <>
            <Text style={s.rotulo}>Resumo "Em poucas palavras" (um item por linha)</Text>
            <TextInput style={[s.campo, s.area]} multiline value={form.resumoTxt} onChangeText={mudar('resumoTxt')} />
            <Text style={s.rotulo}>Texto completo</Text>
            <TextInput style={[s.campo, s.areaGrande]} multiline scrollEnabled value={form.texto} onChangeText={mudar('texto')} />
            <Text style={s.dica}>Formato simples: "## Título" em linha própria, linha em branco entre parágrafos, "- item" para listas e **negrito**. HTML não é aceito.</Text>
          </>
        ) : (
          <View style={s.previa}>
            <Text style={s.dica}>Prévia da versão {novaVersao} (campos vazios aparecem entre colchetes).</Text>
            {resumo.length > 0 && <Text style={s.prevTitulo}>Em poucas palavras</Text>}
            {resumo.map((r, i) => <Trechos key={i} texto={`•  ${aplicarCamposTermo(r, form.campos)}`} style={s.prevPar} />)}
            <TextoTermo texto={aplicarCamposTermo(form.texto, form.campos)} />
          </View>
        )}

        <View style={[s.linha, { marginTop: 14 }]}>
          <TouchableOpacity style={s.btn} onPress={publicar} disabled={!!ocupado}>
            <Degrade />
            {ocupado === 'publicar' ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="cloud-upload-outline" size={17} color="white" />}
            <Text style={s.btnTxt}>Publicar nova versão ({versao} → {novaVersao})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnSec, (!alterado || !!ocupado) && { opacity: 0.5 }]} onPress={salvarRascunho} disabled={!alterado || !!ocupado}>
            {ocupado === 'rascunho' && <ActivityIndicator size="small" color={colors.lilasTexto} />}
            <Text style={s.btnSecTxt}>Salvar rascunho</Text>
          </TouchableOpacity>
        </View>
        <View style={[s.linha, { marginTop: 8 }]}>
          {alterado && <TouchableOpacity style={s.btnMini} onPress={descartar} disabled={!!ocupado}><Text style={s.btnSecTxt}>Descartar alterações</Text></TouchableOpacity>}
          <TouchableOpacity style={s.btnMini} onPress={recomecar} disabled={!!ocupado}><Text style={s.btnSecTxt}>Recomeçar do texto 1.0</Text></TouchableOpacity>
        </View>
        <Text style={s.dica}>Publicar grava o texto congelado no histórico e todos os profissionais precisarão aceitar de novo no próximo acesso ao portal.</Text>

        <Text style={s.secaoForm}>Quem já aceitou</Text>
        {aceites.length === 0 && <Text style={s.dica}>Nenhum profissional cadastrado.</Text>}
        {aceites.map(a => (
          <View key={a.id} style={s.linhaTabela}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.nome}>{a.nome}</Text>
              <Text style={s.legenda}>{a.versao ? `Versão ${a.versao} · ${dataHora(a.em)}` : 'Nenhum aceite registrado'}</Text>
            </View>
            <Text style={[s.tag, a.emDia ? s.tagOk : s.tagDestaque]}>{a.emDia ? 'Em dia' : a.pedirNovo ? 'Novo aceite pedido' : a.em ? `Falta a ${versao}` : 'Não aceitou'}</Text>
          </View>
        ))}

        <Text style={s.secaoForm}>Versões publicadas</Text>
        {versoes.length === 0 && <Text style={s.dica}>Nenhuma versão publicada pelo painel ainda (vale o texto original 1.0).</Text>}
        {versoes.map(v => (
          <View key={v.id} style={s.versao}>
            <TouchableOpacity style={s.linha} onPress={() => setVerVersao(verVersao === v.id ? null : v.id)}>
              <Text style={[s.nome, { flex: 1 }]}>Versão {v.versao}{v.versao === versao ? ' · vigente' : ''}</Text>
              <Text style={s.legenda}>{dataHora(ms(v.publicadoEm))}</Text>
              <Ionicons name={verVersao === v.id ? 'chevron-up' : 'chevron-down'} size={16} color={colors.lilasTexto} />
            </TouchableOpacity>
            {verVersao === v.id && (
              <View style={{ marginTop: 8 }}>
                {(v.resumoFinal || []).map((r, i) => <Trechos key={i} texto={`•  ${r}`} style={s.prevPar} />)}
                <TextoTermo texto={v.textoFinal} />
              </View>
            )}
          </View>
        ))}
      </Recolhivel>
    </View>
  );
}

const s = criarEstilos(() => ({
  rotulo: est.rotulo(),
  secaoForm: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo, marginTop: 22 },
  campo: est.campo(),
  area: { minHeight: 130, textAlignVertical: 'top' },
  areaGrande: { minHeight: 360, maxHeight: 520, textAlignVertical: 'top', fontSize: 14, lineHeight: 20 },
  dica: est.dica(),
  aviso: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: acento('dourado').texto, marginTop: 8 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipTxt: est.chipTxt(),
  chipTxtSel: est.chipTxtSel(),
  btn: { ...est.botao(), minHeight: 46, paddingHorizontal: 18 },
  btnTxt: est.botaoTxt(),
  btnSec: { ...est.botaoSec(), minHeight: 44, paddingHorizontal: 16 },
  btnSecTxt: est.botaoSecTxt(),
  btnMini: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.lav2 },
  previa: { ...est.tenue(16), padding: 14, marginTop: 12 },
  prevTitulo: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 21, color: colors.titulo, marginTop: 14, marginBottom: 4 },
  prevPar: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.td, marginBottom: 8 },
  linhaTabela: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.bordaSuave },
  nome: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.titulo },
  legenda: est.legenda(),
  tag: { ...est.etiquetaTxt(), paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  tagOk: { color: acento('salvia').texto, backgroundColor: acento('salvia').fundo },
  tagDestaque: { color: acento('dourado').texto, backgroundColor: acento('dourado').fundo },
  versao: { ...est.tenue(14), padding: 12, marginTop: 8 },
}), { escalar: false });
