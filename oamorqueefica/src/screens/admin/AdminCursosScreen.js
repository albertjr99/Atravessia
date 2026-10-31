import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, Switch, Platform, Share, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { httpsCallable } from 'firebase/functions';
import {
  collection, doc, onSnapshot, updateDoc, getDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db, functions } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { uploadToStorage } from '../../utils/storageUpload';
import { confirmar } from '../../utils/confirm';
import { SITE_URL } from '../../utils/cupons';
import Recolhivel from '../../components/Recolhivel';
import AdminLayout from './AdminLayout';
import { est, acento, Degrade, AcoesItem, useFormRecolhivel, F_NUM } from './adminEstilo';

// Cursos Atravessia — painel no app (mesma tela do painel web: admin-web/src/Cursos.jsx).
// Abas: Cursos (criar/editar, importar aulas do YouTube), Profissionais (repasse
// e link do portal) e Vendas e repasses (totais e registro do repasse).
// As vendas (matriculas) só são criadas pelo servidor; aqui é só leitura.

const brl = (centavos) => (Number(centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.'));
const dataBR = (t) => (t ? new Date(t).toLocaleDateString('pt-BR') : '—');
const ms = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : 0);
const novoIdAula = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const thumb = (a) => a.thumb || `https://i.ytimg.com/vi/${a.youtubeId}/hqdefault.jpg`;

const CURSO_VAZIO = {
  titulo: '', subtitulo: '', descricao: '', capaUrl: '', preco: '', profissionalId: '',
  ativo: false, destaque: false, protegerAulas: true, programa: [], aulas: [],
};
const PROF_VAZIO = { nome: '', bio: '', fotoUrl: '', email: '', repasseTipo: 'percentual', repasseValor: '50', repasseBase: 'bruto', ativo: true };
// Mesma versão de functions/index.js (TERMO_PROFISSIONAL_VERSAO).
const TERMO_VERSAO = '1.0';

// Regra de repasse: agora fica em profissionaisPrivado; perfis antigos ainda
// tinham os campos no documento público.
const comRegra = (prof, priv) => ({
  ...prof,
  repasseTipo: priv?.repasseTipo ?? prof?.repasseTipo,
  repasseValor: priv?.repasseValor ?? prof?.repasseValor,
  repasseBase: priv?.repasseBase ?? prof?.repasseBase,
});

// Situação do aceite do termo de parceria, para o cartão do profissional.
export function statusTermo(priv) {
  const em = ms(priv?.termoAceitoEm);
  if (!em) return { ok: false, texto: 'Termo ainda não aceito no portal' };
  if (priv.termoPedirNovo) return { ok: false, texto: `Novo aceite pedido (aceitou a versão ${priv.termoVersao || '?'} em ${dataBR(em)})` };
  if (priv.termoVersao !== TERMO_VERSAO) return { ok: false, texto: `Aceitou a versão ${priv.termoVersao || '?'}; falta aceitar a ${TERMO_VERSAO}` };
  return { ok: true, texto: `Termo aceito em ${dataBR(em)} · versão ${priv.termoVersao}` };
}

// Grava o curso: documento público (aulas pagas sem vídeo quando protegido)
// e cursosConteudo/{id} com todos os vídeos, no mesmo lote.
export async function gravarCurso(editId, dados, aulas) {
  const ref = editId ? doc(db, 'cursos', editId) : doc(collection(db, 'cursos'));
  const publicas = aulas.map(a => ((!dados.protegerAulas || a.gratis) ? a : { id: a.id, titulo: a.titulo, duracao: a.duracao, ordem: a.ordem, gratis: false }));
  const lote = writeBatch(db);
  lote.set(ref, { ...dados, aulas: publicas, atualizadoEm: serverTimestamp(), ...(editId ? {} : { criadoEm: serverTimestamp(), arquivado: false }) }, { merge: true });
  lote.set(doc(db, 'cursosConteudo', ref.id), {
    aulas: Object.fromEntries(aulas.map(a => [a.id, { youtubeId: a.youtubeId, thumb: a.thumb }])),
    atualizadoEm: serverTimestamp(),
  });
  await lote.commit();
  return ref.id;
}

export function textoRepasse(p) {
  if (!p) return '—';
  if (p.repasseTipo === 'fixo') return `${brl(Math.round((Number(p.repasseValor) || 0) * 100))} por venda`;
  return `${Number(p.repasseValor) || 0}% ${p.repasseBase === 'liquido' ? 'do valor líquido (após a taxa da Stripe)' : 'do valor pago'}`;
}

// Períodos do filtro de vendas.
function periodo(chave) {
  const agora = new Date();
  const inicioMes = (d) => new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  if (chave === 'mes') return { inicio: inicioMes(agora), fim: Date.now() };
  if (chave === 'mesPassado') {
    const ini = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    return { inicio: ini.getTime(), fim: inicioMes(agora) - 1 };
  }
  if (chave === '90') return { inicio: Date.now() - 90 * 86400000, fim: Date.now() };
  return { inicio: 0, fim: Date.now() };
}
const PERIODOS = [['mes', 'Este mês'], ['mesPassado', 'Mês passado'], ['90', 'Últimos 90 dias'], ['tudo', 'Tudo']];

async function escolherImagem(pasta) {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Permita o acesso à galeria para escolher uma imagem.');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const mime = a.mimeType || 'image/jpeg';
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  return uploadToStorage(a.uri, `cursos/${pasta}/${Date.now()}.${ext}`, mime);
}

// Comprovante de repasse: imagem ou PDF, numa pasta que só a equipe lê.
async function escolherComprovante(profId) {
  const r = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const mime = a.mimeType || (a.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  if (!(mime.startsWith('image/') || mime === 'application/pdf')) throw new Error('Escolha uma imagem ou um PDF.');
  if (a.size && a.size > 10 * 1024 * 1024) throw new Error('O arquivo passa de 10 MB.');
  const ext = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  return uploadToStorage(a.uri, `repassesComprovantes/${profId}/${Date.now()}.${ext}`, mime);
}

const portal = (profissionalId, acao) => httpsCallable(functions, 'gerenciarPortalProfissional')({ profissionalId, acao });

async function copiarOuCompartilhar(texto) {
  if (Platform.OS === 'web' && navigator?.clipboard) {
    await navigator.clipboard.writeText(texto);
    Alert.alert('', 'Link copiado!');
    return;
  }
  await Share.share({ message: texto });
}

function Chips({ opcoes, valor, onChange }) {
  return (
    <View style={s.chips}>
      {opcoes.map(([v, rot]) => (
        <TouchableOpacity key={v} style={[s.chip, valor === v && s.chipSel]} onPress={() => onChange(v)} activeOpacity={0.8}>
          <Text style={[s.chipTxt, valor === v && s.chipTxtSel]}>{rot}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Interruptor({ rotulo, valor, onChange, dica }) {
  return (
    <View style={s.interruptor}>
      <View style={{ flex: 1 }}>
        <Text style={s.interruptorTxt}>{rotulo}</Text>
        {!!dica && <Text style={s.dica}>{dica}</Text>}
      </View>
      <Switch value={!!valor} onValueChange={onChange} trackColor={{ true: colors.lav4, false: colors.border }} thumbColor="white" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Aba 1: Cursos
// ---------------------------------------------------------------------------
function AbaCursos({ cursos, profissionais, matriculas, rolagem }) {
  const form = useFormRecolhivel(rolagem);
  const [editId, setEditId] = useState(null);
  const [c, setC] = useState(CURSO_VAZIO);
  const [links, setLinks] = useState('');
  const [importando, setImportando] = useState(false);
  const [avisos, setAvisos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [enviandoCapa, setEnviandoCapa] = useState(false);
  const campo = (k) => (v) => setC(x => ({ ...x, [k]: v }));

  const vendasPorCurso = useMemo(() => {
    const m = {};
    matriculas.forEach(v => { if (v.status === 'ativa') m[v.cursoId] = (m[v.cursoId] || 0) + 1; });
    return m;
  }, [matriculas]);

  const limpar = () => { setEditId(null); setC(CURSO_VAZIO); setLinks(''); setAvisos([]); };
  // Ao editar, os vídeos das aulas pagas vêm de cursosConteudo/{id}.
  const editar = async (curso) => {
    let conteudo = {};
    try { conteudo = (await getDoc(doc(db, 'cursosConteudo', curso.id))).data()?.aulas || {}; } catch { /* curso antigo */ }
    const aulas = [...(curso.aulas || [])]
      .map(a => ({ ...a, id: a.id || novoIdAula(), youtubeId: a.youtubeId || conteudo[a.id]?.youtubeId || '', thumb: a.thumb || conteudo[a.id]?.thumb || '' }))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    setEditId(curso.id);
    setC({ ...CURSO_VAZIO, ...curso, protegerAulas: curso.protegerAulas !== false, preco: curso.preco != null ? String(curso.preco).replace('.', ',') : '', programa: curso.programa || [], aulas });
    setAvisos([]);
    form.abrirERolar();
  };

  const importar = async () => {
    if (!links.trim()) { Alert.alert('', 'Cole links de vídeos, de uma playlist ou do canal.'); return; }
    setImportando(true);
    try {
      const { data } = await httpsCallable(functions, 'importarVideosYoutube')({ texto: links });
      const existentes = new Set(c.aulas.map(a => a.youtubeId));
      const novas = (data?.videos || []).filter(v => !existentes.has(v.youtubeId)).map(v => ({
        id: novoIdAula(), youtubeId: v.youtubeId, titulo: v.titulo, duracao: v.duracao || '', thumb: v.thumb, gratis: false,
      }));
      setC(x => ({ ...x, aulas: [...x.aulas, ...novas] }));
      setAvisos(data?.avisos || []);
      setLinks('');
      if (!novas.length) Alert.alert('', 'Nenhum vídeo novo encontrado.');
    } catch (e) {
      Alert.alert('Não foi possível importar', e?.message || 'Tente novamente.');
    } finally { setImportando(false); }
  };

  const mudarAula = (i, campos) => setC(x => ({ ...x, aulas: x.aulas.map((a, j) => (j === i ? { ...a, ...campos } : a)) }));
  const moverAula = (i, d) => setC(x => {
    const l = [...x.aulas]; const j = i + d;
    if (j < 0 || j >= l.length) return x;
    [l[i], l[j]] = [l[j], l[i]];
    return { ...x, aulas: l };
  });
  const tirarAula = (i) => setC(x => ({ ...x, aulas: x.aulas.filter((_, j) => j !== i) }));
  const mudarModulo = (i, campos) => setC(x => ({ ...x, programa: x.programa.map((p, j) => (j === i ? { ...p, ...campos } : p)) }));

  const trocarCapa = async () => {
    setEnviandoCapa(true);
    try { const url = await escolherImagem('capas'); if (url) setC(x => ({ ...x, capaUrl: url })); }
    catch (e) { Alert.alert('Erro no envio', e?.message || 'Tente novamente.'); }
    finally { setEnviandoCapa(false); }
  };

  const salvar = async () => {
    const titulo = c.titulo.trim();
    const preco = numero(c.preco);
    if (!titulo) { Alert.alert('', 'Dê um título ao curso.'); return; }
    if (!(preco >= 1) || preco > 10000) { Alert.alert('', 'Informe o preço (entre R$ 1,00 e R$ 10.000,00).'); return; }
    if (c.ativo && !c.aulas.length) { Alert.alert('', 'Para publicar, inclua ao menos uma aula.'); return; }
    const semVideo = c.aulas.findIndex(a => !/^[A-Za-z0-9_-]{11}$/.test(a.youtubeId || ''));
    if (semVideo >= 0) { Alert.alert('', `A aula ${semVideo + 1} está sem vídeo do YouTube. Tire-a e importe de novo.`); return; }
    const prof = profissionais.find(p => p.id === c.profissionalId);
    if (c.ativo && prof?.ativo === false) { Alert.alert('', `${prof.nome} está desativado(a): reative no cartão do profissional ou escolha outra pessoa para publicar.`); return; }
    setSalvando(true);
    const aulas = c.aulas.map((a, i) => ({ id: a.id || novoIdAula(), youtubeId: a.youtubeId, titulo: (a.titulo || '').trim().slice(0, 200), duracao: (a.duracao || '').trim().slice(0, 12), thumb: thumb(a), ordem: i + 1, gratis: !!a.gratis }));
    // Sem capa: miniatura da primeira aula grátis (a de uma aula paga revelaria o vídeo).
    const capaPadrao = c.protegerAulas ? (aulas.find(a => a.gratis)?.thumb || '') : (aulas[0]?.thumb || '');
    const dados = {
      titulo: titulo.slice(0, 160), subtitulo: c.subtitulo.trim().slice(0, 300), descricao: c.descricao.trim().slice(0, 6000),
      capaUrl: c.capaUrl.trim() || capaPadrao,
      preco: Math.round(preco * 100) / 100, profissionalId: c.profissionalId || null,
      ativo: !!c.ativo, destaque: !!c.destaque, protegerAulas: c.protegerAulas !== false,
      programa: c.programa.filter(p => p.titulo?.trim() || p.descricao?.trim()).map(p => ({ titulo: (p.titulo || '').trim().slice(0, 200), descricao: (p.descricao || '').trim().slice(0, 2000) })),
    };
    try {
      await gravarCurso(editId, dados, aulas);
      Alert.alert('', dados.ativo ? 'Curso publicado no app!' : 'Curso salvo como rascunho.');
      limpar(); form.setAberto(false);
    } catch (e) { Alert.alert('Erro ao salvar', e?.message || ''); }
    finally { setSalvando(false); }
  };

  const atualizar = (curso, campos) => updateDoc(doc(db, 'cursos', curso.id), { ...campos, atualizadoEm: serverTimestamp() })
    .catch(e => Alert.alert('Erro', e?.message || ''));

  // Com vendas, o curso é arquivado (sai da vitrine e quem comprou continua
  // assistindo). Sem vendas, é excluído de vez. As vendas nunca são apagadas.
  const apagar = (curso) => {
    const n = matriculas.filter(m => m.cursoId === curso.id && m.status === 'ativa').length;
    if (n > 0) {
      confirmar('Arquivar curso', `${n} pessoa(s) compraram "${curso.titulo}". Ele sai da vitrine e do painel principal, mas quem comprou continua assistindo. As vendas e os repasses ficam guardados.`,
        () => atualizar(curso, { arquivado: true, ativo: false, destaque: false }), 'Arquivar');
      return;
    }
    confirmar('Excluir curso', `Excluir "${curso.titulo}" de vez? Não há vendas ativas. Esta ação não pode ser desfeita.`, async () => {
      try {
        const lote = writeBatch(db);
        lote.delete(doc(db, 'cursos', curso.id));
        lote.delete(doc(db, 'cursosConteudo', curso.id));
        await lote.commit();
      } catch (e) { Alert.alert('Erro', e?.message || ''); }
    }, 'Excluir');
  };
  const [verArquivados, setVerArquivados] = useState(false);
  const visiveis = cursos.filter(x => !x.arquivado);
  const arquivados = cursos.filter(x => x.arquivado);

  return (
    <View>
      <View onLayout={form.onLayout}>
        <Recolhivel
          titulo={editId ? `Editando: ${c.titulo || 'curso'}` : 'Novo curso'}
          subtitulo={editId ? 'Altere e salve' : 'Toque para criar um curso'}
          icone="add-circle-outline" aberto={form.aberto} onAlternar={form.setAberto}
        >
          <Text style={s.rotulo}>Título</Text>
          <TextInput style={s.campo} value={c.titulo} onChangeText={campo('titulo')} placeholder="Yoga para acalmar a mente" placeholderTextColor={colors.tl} />
          <Text style={s.rotulo}>Subtítulo</Text>
          <TextInput style={s.campo} value={c.subtitulo} onChangeText={campo('subtitulo')} placeholder="Uma frase que convida" placeholderTextColor={colors.tl} />
          <Text style={s.rotulo}>Descrição</Text>
          <TextInput style={[s.campo, s.area]} multiline value={c.descricao} onChangeText={campo('descricao')} placeholder="Para quem é, o que a pessoa vai viver no curso..." placeholderTextColor={colors.tl} />

          <Text style={s.rotulo}>Capa (16:9)</Text>
          {!!c.capaUrl && <Image source={{ uri: c.capaUrl }} style={s.capa} />}
          <View style={s.linha}>
            <TouchableOpacity style={s.btnSec} onPress={trocarCapa} disabled={enviandoCapa}>
              {enviandoCapa ? <ActivityIndicator size="small" color={colors.lilasTexto} /> : <Ionicons name="image-outline" size={16} color={colors.lilasTexto} />}
              <Text style={s.btnSecTxt}>{c.capaUrl ? 'Trocar imagem' : 'Enviar imagem'}</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={[s.campo, { marginTop: 8 }]} value={c.capaUrl} onChangeText={campo('capaUrl')} autoCapitalize="none" placeholder="ou cole o link de uma imagem" placeholderTextColor={colors.tl} />
          <Text style={s.dica}>Sem capa, o app usa a miniatura da primeira aula grátis.</Text>

          <Text style={s.rotulo}>Preço (R$)</Text>
          <TextInput style={s.campo} value={c.preco} onChangeText={campo('preco')} keyboardType="decimal-pad" placeholder="97,00" placeholderTextColor={colors.tl} />

          <Text style={s.rotulo}>Profissional</Text>
          <Chips opcoes={[['', 'Atravessia (sem repasse)'], ...profissionais.map(p => [p.id, p.ativo === false ? `${p.nome} (inativo)` : p.nome])]} valor={c.profissionalId || ''} onChange={campo('profissionalId')} />

          <Interruptor rotulo="Publicado no app" valor={c.ativo} onChange={campo('ativo')} dica="Desligado, fica como rascunho." />
          <Interruptor rotulo="Em destaque na vitrine" valor={c.destaque} onChange={campo('destaque')} />
          <Interruptor rotulo="Proteger os vídeos das aulas pagas" valor={c.protegerAulas} onChange={campo('protegerAulas')}
            dica="Ligado, só quem comprou recebe o link das aulas pagas. Desligue só se alguém que comprou ainda usa o app 1.20 e não consegue assistir." />

          <Text style={[s.rotulo, s.secaoForm]}>Conteúdo programático</Text>
          {c.programa.map((p, i) => (
            <View key={i} style={s.modulo}>
              <TextInput style={s.campo} value={p.titulo} onChangeText={(v) => mudarModulo(i, { titulo: v })} placeholder={`Módulo ${i + 1}`} placeholderTextColor={colors.tl} />
              <TextInput style={[s.campo, s.area, { marginTop: 6 }]} multiline value={p.descricao} onChangeText={(v) => mudarModulo(i, { descricao: v })} placeholder="O que se aprende neste módulo" placeholderTextColor={colors.tl} />
              <TouchableOpacity onPress={() => setC(x => ({ ...x, programa: x.programa.filter((_, j) => j !== i) }))} style={s.tirar}>
                <Ionicons name="trash-outline" size={14} color={colors.roseTexto} /><Text style={s.tirarTxt}>Tirar módulo</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={[s.btnSec, { alignSelf: 'flex-start' }]} onPress={() => setC(x => ({ ...x, programa: [...x.programa, { titulo: '', descricao: '' }] }))}>
            <Ionicons name="add" size={16} color={colors.lilasTexto} /><Text style={s.btnSecTxt}>Adicionar módulo</Text>
          </TouchableOpacity>

          <Text style={[s.rotulo, s.secaoForm]}>Aulas ({c.aulas.length})</Text>
          <View style={s.importar}>
            <Text style={s.importarTit}>Importar do YouTube</Text>
            <Text style={s.dica}>Cole links de vídeos não listados (um por linha), de uma playlist ou do canal (@nome).</Text>
            <TextInput style={[s.campo, s.area, { marginTop: 8 }]} multiline value={links} onChangeText={setLinks} autoCapitalize="none"
              placeholder={'https://youtu.be/...\nhttps://www.youtube.com/@canal'} placeholderTextColor={colors.tl} />
            <TouchableOpacity style={[s.btn, { marginTop: 10, alignSelf: 'flex-start' }]} onPress={importar} disabled={importando}>
              <Degrade />
              {importando ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="logo-youtube" size={16} color="white" />}
              <Text style={s.btnTxt}>{importando ? 'Buscando...' : 'Importar do YouTube'}</Text>
            </TouchableOpacity>
            {avisos.map((a, i) => <Text key={i} style={s.aviso}>• {a}</Text>)}
          </View>

          {c.aulas.map((a, i) => (
            <View key={a.id || a.youtubeId} style={s.aulaLinha}>
              <Image source={{ uri: thumb(a) }} style={s.aulaThumb} />
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <TextInput style={[s.campo, s.campoP]} value={a.titulo} onChangeText={(v) => mudarAula(i, { titulo: v })} placeholder="Título da aula" placeholderTextColor={colors.tl} />
                <View style={s.linha}>
                  <TextInput style={[s.campo, s.campoP, { width: 90 }]} value={a.duracao} onChangeText={(v) => mudarAula(i, { duracao: v })} placeholder="12:30" placeholderTextColor={colors.tl} />
                  <TouchableOpacity style={[s.chip, a.gratis && s.chipSel]} onPress={() => mudarAula(i, { gratis: !a.gratis })}>
                    <Ionicons name={a.gratis ? 'lock-open' : 'lock-closed-outline'} size={13} color={a.gratis ? colors.lilasTexto : colors.texto2} />
                    <Text style={[s.chipTxt, a.gratis && s.chipTxtSel]}>{a.gratis ? 'Grátis' : 'Paga'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconeBtn} onPress={() => moverAula(i, -1)}><Ionicons name="arrow-up" size={16} color={colors.lilasTexto} /></TouchableOpacity>
                  <TouchableOpacity style={s.iconeBtn} onPress={() => moverAula(i, 1)}><Ionicons name="arrow-down" size={16} color={colors.lilasTexto} /></TouchableOpacity>
                  <TouchableOpacity style={s.iconeBtn} onPress={() => tirarAula(i)}><Ionicons name="trash-outline" size={16} color={colors.roseTexto} /></TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          <View style={[s.linha, { marginTop: 16 }]}>
            <TouchableOpacity style={s.btn} onPress={salvar} disabled={salvando}>
              <Degrade />
              {salvando ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="checkmark" size={17} color="white" />}
              <Text style={s.btnTxt}>{editId ? 'Salvar curso' : 'Criar curso'}</Text>
            </TouchableOpacity>
            {(editId || c.titulo) && <TouchableOpacity style={s.btnSec} onPress={() => { limpar(); form.setAberto(false); }}><Text style={s.btnSecTxt}>Cancelar</Text></TouchableOpacity>}
          </View>
        </Recolhivel>
      </View>

      {visiveis.length === 0 && <Text style={s.vazio}>Nenhum curso ainda. Crie o primeiro acima.</Text>}
      {arquivados.length > 0 && (
        <TouchableOpacity style={[s.btnMini, { alignSelf: 'flex-start', marginBottom: 12 }]} onPress={() => setVerArquivados(v => !v)}>
          <Ionicons name={verArquivados ? 'eye-off-outline' : 'archive-outline'} size={15} color={colors.lilasTexto} />
          <Text style={s.btnSecTxt}>{verArquivados ? 'Esconder arquivados' : `Ver arquivados (${arquivados.length})`}</Text>
        </TouchableOpacity>
      )}
      {(verArquivados ? [...visiveis, ...arquivados] : visiveis).map(curso => {
        const prof = profissionais.find(p => p.id === curso.profissionalId);
        const aulaComThumb = (curso.aulas || []).find(a => a.thumb || a.youtubeId);
        const capa = curso.capaUrl || (aulaComThumb ? thumb(aulaComThumb) : null);
        return (
          <View key={curso.id} style={s.card}>
            <View style={s.cardTopo}>
              {capa ? <Image source={{ uri: capa }} style={s.cardCapa} /> : <View style={[s.cardCapa, { backgroundColor: colors.lav2 }]} />}
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={s.cardTit} numberOfLines={2}>{curso.titulo}</Text>
                <Text style={s.legenda}>{brl(Math.round((curso.preco || 0) * 100))} · {(curso.aulas || []).length} aulas · {vendasPorCurso[curso.id] || 0} vendas</Text>
                <Text style={s.legenda} numberOfLines={1}>{prof ? `Com ${prof.nome}` : 'Atravessia'}</Text>
                <View style={s.linha}>
                  <Text style={[s.tag, curso.ativo ? s.tagOk : s.tagNeutra]}>{curso.arquivado ? 'Arquivado' : curso.ativo ? 'Publicado' : 'Rascunho'}</Text>
                  {curso.destaque && <Text style={[s.tag, s.tagDestaque]}>Destaque</Text>}
                  {curso.protegerAulas === false && <Text style={[s.tag, s.tagNeutra]}>Vídeos sem proteção</Text>}
                  {prof?.ativo === false && <Text style={[s.tag, s.tagNeutra]}>Profissional inativo: venda pausada</Text>}
                </View>
              </View>
            </View>
            {curso.arquivado ? (
              <AcoesItem extra={(
                <TouchableOpacity style={s.btnMini} onPress={() => atualizar(curso, { arquivado: false })}>
                  <Ionicons name="arrow-undo-outline" size={15} color={colors.lilasTexto} /><Text style={s.btnSecTxt}>Restaurar (como rascunho)</Text>
                </TouchableOpacity>
              )} />
            ) : (
              <AcoesItem onEditar={() => editar(curso)} onApagar={() => apagar(curso)} rotuloApagar={vendasPorCurso[curso.id] ? 'Arquivar' : 'Excluir'}
                extra={(
                  <>
                    <TouchableOpacity style={s.btnMini} onPress={() => atualizar(curso, { ativo: !curso.ativo })}>
                      <Ionicons name={curso.ativo ? 'eye-off-outline' : 'eye-outline'} size={15} color={colors.lilasTexto} />
                      <Text style={s.btnSecTxt}>{curso.ativo ? 'Ocultar' : 'Publicar'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.btnMini} onPress={() => atualizar(curso, { destaque: !curso.destaque })}
                      accessibilityLabel={curso.destaque ? 'Tirar do destaque' : 'Destacar na vitrine'}>
                      <Ionicons name={curso.destaque ? 'star' : 'star-outline'} size={15} color={colors.lilasTexto} />
                    </TouchableOpacity>
                  </>
                )} />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Aba 2: Profissionais
// ---------------------------------------------------------------------------
function AbaProfissionais({ profissionais, privados, rolagem }) {
  const form = useFormRecolhivel(rolagem);
  const [editId, setEditId] = useState(null);
  const [p, setP] = useState(PROF_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const campo = (k) => (v) => setP(x => ({ ...x, [k]: v }));

  const editar = (prof) => {
    const x = comRegra(prof, privados[prof.id]);
    setEditId(prof.id);
    setP({ ...PROF_VAZIO, ...x, email: privados[prof.id]?.email || '', repasseValor: String(x.repasseValor ?? '').replace('.', ',') });
    form.abrirERolar();
  };
  const limpar = () => { setEditId(null); setP(PROF_VAZIO); };

  const salvar = async (extra = {}) => {
    setSalvando(true);
    try {
      const { data } = await httpsCallable(functions, 'salvarProfissional')({
        id: editId || undefined, nome: p.nome, bio: p.bio, fotoUrl: p.fotoUrl, email: p.email,
        repasseTipo: p.repasseTipo, repasseValor: numero(p.repasseValor), repasseBase: p.repasseBase, ativo: p.ativo, ...extra,
      });
      Alert.alert('Profissional salvo', 'O link do portal já está disponível no cartão.');
      limpar(); form.setAberto(false);
      return data;
    } catch (e) { Alert.alert('Não foi possível salvar', e?.message || ''); return null; }
    finally { setSalvando(false); }
  };

  const link = (id) => (privados[id]?.tokenPortal ? `${SITE_URL}/profissional.html?t=${privados[id].tokenPortal}` : null);
  const acaoPortal = (prof, acao, titulo, msg, rotulo, sucesso) => confirmar(titulo, msg, async () => {
    try {
      const { data } = await portal(prof.id, acao);
      if (data?.linkPortal) copiarOuCompartilhar(data.linkPortal);
      else if (sucesso) Alert.alert('', sucesso);
    } catch (e) { Alert.alert('Erro', e?.message || ''); }
  }, rotulo);
  const novoLink = (prof) => acaoPortal(prof, 'novoLink', 'Gerar novo link', 'O link atual do portal deixa de funcionar. Envie o novo ao profissional.', 'Gerar');
  const revogar = (prof) => acaoPortal(prof, 'revogar', 'Revogar link do portal', 'O link atual deixa de funcionar e nenhum outro é criado. Para voltar a dar acesso, gere um novo link.', 'Revogar', 'Link revogado.');
  const pedirAceite = (prof) => acaoPortal(prof, 'pedirNovoAceite', 'Pedir novo aceite do termo', 'No próximo acesso ao portal, o profissional lê e aceita o termo de novo antes de ver o extrato.', 'Pedir', 'Pronto: o portal vai pedir o aceite.');
  const alternarAtivo = (prof) => (prof.ativo === false
    ? acaoPortal(prof, 'ativar', 'Reativar profissional', 'Os cursos desta pessoa voltam a poder ser vendidos.', 'Reativar', 'Profissional reativado.')
    : acaoPortal(prof, 'desativar', 'Desativar profissional', 'Os cursos desta pessoa param de ser vendidos (quem já comprou continua assistindo). O portal e o extrato continuam funcionando.', 'Desativar', 'Profissional desativado.'));

  const trocarFoto = async () => {
    setEnviandoFoto(true);
    try { const url = await escolherImagem('profissionais'); if (url) setP(x => ({ ...x, fotoUrl: url })); }
    catch (e) { Alert.alert('Erro no envio', e?.message || ''); }
    finally { setEnviandoFoto(false); }
  };

  return (
    <View>
      <View onLayout={form.onLayout}>
        <Recolhivel titulo={editId ? `Editando: ${p.nome}` : 'Novo profissional'} subtitulo="Dados, repasse combinado e portal de prestação de contas"
          icone="person-add-outline" aberto={form.aberto} onAlternar={form.setAberto}>
          <Text style={s.rotulo}>Nome (aparece no app)</Text>
          <TextInput style={s.campo} value={p.nome} onChangeText={campo('nome')} placeholderTextColor={colors.tl} placeholder="Nome ou nome do canal" />
          <Text style={s.rotulo}>Mini bio</Text>
          <TextInput style={[s.campo, s.area]} multiline value={p.bio} onChangeText={campo('bio')} placeholderTextColor={colors.tl} placeholder="Formação, experiência, jeito de cuidar..." />
          <Text style={s.rotulo}>Foto</Text>
          <View style={s.linha}>
            {!!p.fotoUrl && <Image source={{ uri: p.fotoUrl }} style={s.fotoP} />}
            <TouchableOpacity style={s.btnSec} onPress={trocarFoto} disabled={enviandoFoto}>
              {enviandoFoto ? <ActivityIndicator size="small" color={colors.lilasTexto} /> : <Ionicons name="camera-outline" size={16} color={colors.lilasTexto} />}
              <Text style={s.btnSecTxt}>{p.fotoUrl ? 'Trocar foto' : 'Enviar foto'}</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={[s.campo, { marginTop: 8 }]} value={p.fotoUrl} onChangeText={campo('fotoUrl')} autoCapitalize="none" placeholder="ou cole o link da foto" placeholderTextColor={colors.tl} />
          <Text style={s.rotulo}>E-mail (só a equipe vê)</Text>
          <TextInput style={s.campo} value={p.email} onChangeText={campo('email')} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.tl} placeholder="nome@email.com" />

          <Text style={[s.rotulo, s.secaoForm]}>Repasse combinado</Text>
          <Chips opcoes={[['percentual', 'Percentual'], ['fixo', 'Valor fixo por venda']]} valor={p.repasseTipo} onChange={campo('repasseTipo')} />
          <Text style={s.rotulo}>{p.repasseTipo === 'fixo' ? 'Valor por venda (R$)' : 'Percentual (%)'}</Text>
          <TextInput style={s.campo} value={p.repasseValor} onChangeText={campo('repasseValor')} keyboardType="decimal-pad" placeholderTextColor={colors.tl} />
          {p.repasseTipo === 'percentual' && (
            <>
              <Text style={s.rotulo}>Calcular sobre</Text>
              <Chips opcoes={[['bruto', 'Valor pago'], ['liquido', 'Valor após a taxa da Stripe']]} valor={p.repasseBase} onChange={campo('repasseBase')} />
            </>
          )}
          <Text style={s.dica}>A regra vale para as próximas vendas: cada venda guarda o repasse calculado na hora, e ele não muda depois.</Text>
          <Interruptor rotulo="Ativo" valor={p.ativo} onChange={campo('ativo')} />
          <View style={[s.linha, { marginTop: 14 }]}>
            <TouchableOpacity style={s.btn} onPress={() => salvar()} disabled={salvando}>
              <Degrade />
              {salvando ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="checkmark" size={17} color="white" />}
              <Text style={s.btnTxt}>Salvar profissional</Text>
            </TouchableOpacity>
            {editId && <TouchableOpacity style={s.btnSec} onPress={() => { limpar(); form.setAberto(false); }}><Text style={s.btnSecTxt}>Cancelar</Text></TouchableOpacity>}
          </View>
        </Recolhivel>
      </View>

      {profissionais.length === 0 && <Text style={s.vazio}>Nenhum profissional cadastrado.</Text>}
      {profissionais.map(prof => {
        const priv = privados[prof.id] || {};
        const termo = statusTermo(priv);
        return (
          <View key={prof.id} style={s.card}>
            <View style={s.cardTopo}>
              {prof.fotoUrl ? <Image source={{ uri: prof.fotoUrl }} style={s.fotoP} /> : <View style={[s.fotoP, s.fotoInicial]}><Text style={s.fotoInicialTxt}>{(prof.nome || '?')[0]}</Text></View>}
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={s.cardTit}>{prof.nome}</Text>
                <Text style={s.legenda}>Repasse: {textoRepasse(comRegra(prof, priv))}</Text>
                {!!priv.email && <Text style={s.legenda}>{priv.email}</Text>}
                <View style={s.linha}>
                  <Text style={[s.tag, termo.ok ? s.tagOk : s.tagDestaque]}>{termo.texto}</Text>
                  {!priv.tokenPortal && <Text style={[s.tag, s.tagNeutra]}>Sem link ativo</Text>}
                  {prof.ativo === false && <Text style={[s.tag, s.tagNeutra]}>Inativo</Text>}
                </View>
              </View>
            </View>
            <AcoesItem onEditar={() => editar(prof)}
              extra={(
                <>
                  {link(prof.id) ? (
                    <TouchableOpacity style={s.btnMini} onPress={() => copiarOuCompartilhar(link(prof.id))}>
                      <Ionicons name="link-outline" size={15} color={colors.lilasTexto} /><Text style={s.btnSecTxt}>Copiar link</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={s.btnMini} onPress={() => novoLink(prof)} accessibilityLabel="Gerar novo link">
                    <Ionicons name="refresh" size={15} color={colors.lilasTexto} /><Text style={s.btnSecTxt}>Novo link</Text>
                  </TouchableOpacity>
                </>
              )} />
            <View style={[s.linha, { marginTop: 8 }]}>
              {!!priv.tokenPortal && (
                <TouchableOpacity style={s.btnMini} onPress={() => revogar(prof)}>
                  <Ionicons name="close-circle-outline" size={15} color={colors.roseTexto} /><Text style={[s.btnSecTxt, { color: colors.roseTexto }]}>Revogar link</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.btnMini} onPress={() => pedirAceite(prof)}>
                <Ionicons name="document-text-outline" size={15} color={colors.lilasTexto} /><Text style={s.btnSecTxt}>Pedir novo aceite</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnMini} onPress={() => alternarAtivo(prof)}>
                <Ionicons name={prof.ativo === false ? 'play-circle-outline' : 'pause-circle-outline'} size={15} color={colors.lilasTexto} />
                <Text style={s.btnSecTxt}>{prof.ativo === false ? 'Reativar' : 'Desativar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Aba 3: Vendas e repasses
// ---------------------------------------------------------------------------
function AbaVendas({ cursos, profissionais, matriculas, repasses }) {
  const [per, setPer] = useState('mes');
  const [profFiltro, setProfFiltro] = useState('');
  const [registrando, setRegistrando] = useState(null);
  const { inicio, fim } = periodo(per);
  const nomeCurso = (id) => cursos.find(c => c.id === id)?.titulo || 'Curso';
  const nomeProf = (id) => profissionais.find(p => p.id === id)?.nome || 'Atravessia';

  const doPeriodo = matriculas.filter(m => {
    const t = ms(m.criadaEm);
    return t >= inicio && t <= fim && (!profFiltro || m.profissionalId === profFiltro);
  });
  const ativas = doPeriodo.filter(m => m.status === 'ativa');
  const soma = (l, k) => l.reduce((a, m) => a + (Number(m[k]) || 0), 0);
  const bruto = soma(ativas, 'valorPagoCentavos');
  const taxas = soma(ativas, 'taxaStripeCentavos');
  const repasse = soma(ativas, 'repasseCentavos');

  const porProf = {};
  ativas.forEach(m => {
    const k = m.profissionalId || '';
    const x = porProf[k] || (porProf[k] = { id: k, vendas: 0, bruto: 0, repasse: 0, aRepassar: 0 });
    x.vendas++; x.bruto += m.valorPagoCentavos || 0; x.repasse += m.repasseCentavos || 0;
    if (!m.repasseId) x.aRepassar += m.repasseCentavos || 0;
  });
  const porCurso = {};
  ativas.forEach(m => {
    const x = porCurso[m.cursoId] || (porCurso[m.cursoId] = { id: m.cursoId, vendas: 0, bruto: 0, repasse: 0 });
    x.vendas++; x.bruto += m.valorPagoCentavos || 0; x.repasse += m.repasseCentavos || 0;
  });

  // Formulário do repasse: data do pagamento, comprovante (arquivo ou link) e observação.
  const [form, setForm] = useState(null); // { profId, pagoEm: 'dd/mm/aaaa', comprovanteUrl, observacao }
  const [enviandoComp, setEnviandoComp] = useState(false);
  const abrirRepasse = (profId) => setForm({ profId, pagoEm: new Date().toLocaleDateString('pt-BR'), comprovanteUrl: '', observacao: '' });
  const anexar = async () => {
    setEnviandoComp(true);
    try { const url = await escolherComprovante(form.profId); if (url) setForm(f => ({ ...f, comprovanteUrl: url })); }
    catch (e) { Alert.alert('Erro no envio', e?.message || ''); }
    finally { setEnviandoComp(false); }
  };
  const registrar = () => {
    const m = String(form.pagoEm).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const pagoEm = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12).getTime() : NaN;
    if (!Number.isFinite(pagoEm)) { Alert.alert('', 'Informe a data do pagamento como dd/mm/aaaa.'); return; }
    const profId = form.profId;
    confirmar('Registrar repasse',
      `Marca como repassadas as vendas de ${nomeProf(profId)} no período (${dataBR(inicio || null)} a ${dataBR(fim)}). Reembolsos de vendas já repassadas entram como desconto.`,
      async () => {
        setRegistrando(profId);
        try {
          const { data } = await httpsCallable(functions, 'fecharRepasse')({
            profissionalId: profId, inicio, fim, pagoEm, comprovanteUrl: form.comprovanteUrl.trim(), observacao: form.observacao.trim(),
          });
          setForm(null);
          Alert.alert('Repasse registrado', `${data.vendas} venda(s) · total ${brl(data.totalCentavos)}. O profissional já vê no portal.`);
        } catch (e) { Alert.alert('Não foi possível registrar', e?.message || ''); }
        finally { setRegistrando(null); }
      }, 'Registrar');
  };

  return (
    <View>
      <Chips opcoes={PERIODOS} valor={per} onChange={setPer} />
      <View style={{ height: 8 }} />
      <Chips opcoes={[['', 'Todos'], ...profissionais.map(p => [p.id, p.nome])]} valor={profFiltro} onChange={setProfFiltro} />

      <View style={s.numeros}>
        {[['Vendas', String(ativas.length)], ['Valor pago', brl(bruto)], ['Taxas Stripe', brl(taxas)], ['Repasses', brl(repasse)], ['Fica com a Atravessia', brl(bruto - taxas - repasse)]].map(([r, v]) => (
          <View key={r} style={s.numero}><Text style={s.numeroValor}>{v}</Text><Text style={s.legenda}>{r}</Text></View>
        ))}
      </View>
      {doPeriodo.length - ativas.length > 0 && <Text style={s.dica}>{doPeriodo.length - ativas.length} venda(s) reembolsada(s) no período, fora dos totais.</Text>}

      <Text style={s.secao}>Por profissional</Text>
      {Object.values(porProf).length === 0 && <Text style={s.vazio}>Nenhuma venda no período.</Text>}
      {Object.values(porProf).map(x => (
        <View key={x.id || 'casa'} style={s.card}>
          <Text style={s.cardTit}>{nomeProf(x.id)}</Text>
          <Text style={s.legenda}>{x.vendas} venda(s) · {brl(x.bruto)} pagos · repasse {brl(x.repasse)}</Text>
          {!!x.id && (
            <View style={[s.linha, { marginTop: 8 }]}>
              <Text style={[s.cardTit, { flex: 1, minWidth: 160, color: x.aRepassar ? colors.lilasTexto : colors.texto2 }]}>A repassar: {brl(x.aRepassar)}</Text>
              {form?.profId !== x.id && (
                <TouchableOpacity style={s.btn} onPress={() => abrirRepasse(x.id)}>
                  <Degrade />
                  <Ionicons name="cash-outline" size={16} color="white" />
                  <Text style={s.btnTxt}>Registrar repasse</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {form?.profId === x.id && (
            <View style={[s.modulo, { marginTop: 10 }]}>
              <Text style={s.rotulo}>Data do pagamento</Text>
              <TextInput style={s.campo} value={form.pagoEm} onChangeText={(v) => setForm(f => ({ ...f, pagoEm: v }))} placeholder="dd/mm/aaaa" placeholderTextColor={colors.tl} keyboardType="numbers-and-punctuation" />
              <Text style={s.rotulo}>Comprovante da transferência</Text>
              <View style={s.linha}>
                <TouchableOpacity style={s.btnSec} onPress={anexar} disabled={enviandoComp}>
                  {enviandoComp ? <ActivityIndicator size="small" color={colors.lilasTexto} /> : <Ionicons name="attach-outline" size={16} color={colors.lilasTexto} />}
                  <Text style={s.btnSecTxt}>{form.comprovanteUrl ? 'Trocar arquivo' : 'Anexar imagem ou PDF'}</Text>
                </TouchableOpacity>
                {!!form.comprovanteUrl && <Ionicons name="checkmark-circle" size={20} color={acento('salvia').texto} />}
              </View>
              <TextInput style={[s.campo, { marginTop: 8 }]} value={form.comprovanteUrl} onChangeText={(v) => setForm(f => ({ ...f, comprovanteUrl: v }))} autoCapitalize="none" placeholder="ou cole o link do comprovante (https://...)" placeholderTextColor={colors.tl} />
              <Text style={s.dica}>O profissional vê o comprovante no portal. Prefira um comprovante sem dados bancários completos.</Text>
              <Text style={s.rotulo}>Observação (opcional)</Text>
              <TextInput style={s.campo} value={form.observacao} onChangeText={(v) => setForm(f => ({ ...f, observacao: v.slice(0, 500) }))} placeholder="Ex.: PIX enviado" placeholderTextColor={colors.tl} />
              <View style={[s.linha, { marginTop: 12 }]}>
                <TouchableOpacity style={s.btn} onPress={registrar} disabled={registrando === x.id}>
                  <Degrade />
                  {registrando === x.id ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="checkmark" size={16} color="white" />}
                  <Text style={s.btnTxt}>Confirmar repasse</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSec} onPress={() => setForm(null)}><Text style={s.btnSecTxt}>Cancelar</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ))}

      <Text style={s.secao}>Por curso</Text>
      {Object.values(porCurso).map(x => (
        <View key={x.id} style={s.linhaTabela}>
          <Text style={[s.corpo, { flex: 1 }]} numberOfLines={1}>{nomeCurso(x.id)}</Text>
          <Text style={s.legenda}>{x.vendas} · {brl(x.bruto)}</Text>
        </View>
      ))}

      <Text style={s.secao}>Vendas do período</Text>
      {doPeriodo.slice(0, 80).map(m => (
        <View key={m.id} style={s.linhaTabela}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.corpo} numberOfLines={1}>{nomeCurso(m.cursoId)}</Text>
            <Text style={s.legenda}>{dataBR(ms(m.criadaEm))} · código {String(m.stripePaymentIntent || '').slice(-8).toUpperCase()}{m.repasseId ? ' · repassada' : ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.corpo, m.status === 'reembolsada' && { textDecorationLine: 'line-through', color: colors.tl }]}>{brl(m.valorPagoCentavos)}</Text>
            <Text style={s.legenda}>{m.status === 'reembolsada' ? 'Reembolsada' : `repasse ${brl(m.repasseCentavos)}`}</Text>
          </View>
        </View>
      ))}

      <Text style={s.secao}>Repasses registrados</Text>
      {repasses.length === 0 && <Text style={s.vazio}>Nenhum repasse ainda.</Text>}
      {repasses.map(r => (
        <View key={r.id} style={s.linhaTabela}>
          <View style={{ flex: 1 }}>
            <Text style={s.corpo}>{nomeProf(r.profissionalId)}</Text>
            <Text style={s.legenda}>{r.periodo?.rotulo} · pago em {dataBR(ms(r.pagoEm))} · {(r.matriculaIds || []).length} venda(s){r.observacao ? ` · ${r.observacao}` : ''}</Text>
            {!!r.comprovanteUrl && (
              <TouchableOpacity onPress={() => Linking.openURL(r.comprovanteUrl)} style={{ minHeight: 32, justifyContent: 'center' }}>
                <Text style={[s.legenda, { color: colors.lilasTexto, fontFamily: fonts.bodyBold }]}>Ver comprovante</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={s.cardTit}>{brl(r.totalCentavos)}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Demonstração: curso de Yoga com 5 aulas, profissional de teste e vendas
// fictícias; o curso fica liberado para a administradora assistir.
function DemoCursos() {
  const [rodando, setRodando] = useState(false);
  const [links, setLinks] = useState(null);
  const executar = async (remover) => {
    setRodando(true);
    try {
      const { data } = await httpsCallable(functions, 'criarDemonstracaoCursos')({ remover });
      setLinks(remover ? null : data);
      Alert.alert('', remover ? 'Demonstração removida.' : 'Demonstração pronta! O curso já aparece em Cursos, no app.');
    } catch (e) { Alert.alert('Não foi possível', e?.message || 'Tente novamente.'); }
    setRodando(false);
  };
  return (
    <Recolhivel titulo="Demonstração dos Cursos" subtitulo="Curso de Yoga com 5 aulas, profissional de teste e vendas fictícias" icone="sparkles-outline">
      <Text style={s.sub}>Publica o curso "Yoga para acalmar a mente" (canal @yogaparavoce), cadastra um profissional de teste com 6 vendas fictícias para o portal e libera o curso para a sua conta. Pode tocar de novo para atualizar; nada é duplicado.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
        <TouchableOpacity style={[s.aba, s.abaSel, { paddingHorizontal: 18 }]} disabled={rodando} onPress={() => executar(false)}>
          <Text style={[s.abaTxt, s.abaTxtSel]}>{rodando ? 'Preparando…' : 'Criar ou atualizar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.aba, { paddingHorizontal: 18 }]} disabled={rodando}
          onPress={() => Alert.alert('Remover demonstração', 'Remover o curso, o profissional e as vendas de demonstração?', [
            { text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => executar(true) }])}>
          <Text style={s.abaTxt}>Remover</Text>
        </TouchableOpacity>
      </View>
      {links && (
        <TouchableOpacity style={{ marginTop: 12 }} onPress={() => copiarOuCompartilhar(links.linkPortal)}>
          <Text style={[s.sub, { fontWeight: '700' }]}>Copiar ou compartilhar o link do portal do profissional</Text>
        </TouchableOpacity>
      )}
    </Recolhivel>
  );
}

export default function AdminCursosScreen({ navigation }) {
  const rolagem = useRef(null);
  const [aba, setAba] = useState('cursos');
  const [cursos, setCursos] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [privados, setPrivados] = useState({});
  const [matriculas, setMatriculas] = useState([]);
  const [repasses, setRepasses] = useState([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const falha = (e) => setErro(e?.message || 'Não foi possível carregar.');
    const u = [
      onSnapshot(collection(db, 'cursos'), sn => setCursos(sn.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.criadoEm) - ms(a.criadoEm))), falha),
      onSnapshot(collection(db, 'profissionais'), sn => setProfissionais(sn.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nome).localeCompare(String(b.nome)))), falha),
      onSnapshot(collection(db, 'profissionaisPrivado'), sn => { const m = {}; sn.forEach(d => { m[d.id] = d.data(); }); setPrivados(m); }, () => {}),
      onSnapshot(collection(db, 'matriculas'), sn => setMatriculas(sn.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.criadaEm) - ms(a.criadaEm))), () => {}),
      onSnapshot(collection(db, 'repasses'), sn => setRepasses(sn.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.criadoEm) - ms(a.criadoEm))), () => {}),
    ];
    return () => u.forEach(f => f());
  }, []);

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminCursos">
      <ScrollView ref={rolagem} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={s.sobre}>Conteúdo do app</Text>
        <Text style={s.title}>Cursos</Text>
        <Text style={s.sub}>Cursos em vídeo (YouTube não listado) vendidos no app. Cada venda guarda o repasse do profissional, calculado na hora e sem possibilidade de edição.</Text>
        {!!erro && <Text style={s.erro}>{erro}</Text>}
        <DemoCursos />
        <View style={s.trilho}>
          {[['cursos', 'Cursos'], ['profissionais', 'Profissionais'], ['vendas', 'Vendas e repasses']].map(([k, r]) => (
            <TouchableOpacity key={k} style={[s.aba, aba === k && s.abaSel]} onPress={() => setAba(k)}>
              <Text style={[s.abaTxt, aba === k && s.abaTxtSel]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {aba === 'cursos' && <AbaCursos cursos={cursos} profissionais={profissionais} matriculas={matriculas} rolagem={rolagem} />}
        {aba === 'profissionais' && <AbaProfissionais profissionais={profissionais} privados={privados} rolagem={rolagem} />}
        {aba === 'vendas' && <AbaVendas cursos={cursos} profissionais={profissionais} matriculas={matriculas} repasses={repasses} />}
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 64 },
  sobre: est.sobretitulo(),
  title: est.titulo(),
  sub: { ...est.subtitulo(), marginBottom: spacing.md },
  erro: { ...est.aviso('rosa'), ...est.avisoTxt('rosa'), marginBottom: spacing.md },
  trilho: { ...est.trilho(), marginBottom: spacing.lg, flexWrap: 'wrap' },
  aba: est.aba(),
  abaSel: est.abaSel(),
  abaTxt: est.abaTxt(),
  abaTxtSel: est.abaTxtSel(),
  rotulo: est.rotulo(),
  secaoForm: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo, marginTop: 22 },
  campo: est.campo(),
  campoP: { minHeight: 40, paddingVertical: 8, fontSize: 14 },
  area: { minHeight: 90, textAlignVertical: 'top' },
  dica: est.dica(),
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipTxt: est.chipTxt(),
  chipTxtSel: est.chipTxtSel(),
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  interruptorTxt: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.td },
  capa: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, marginBottom: 8, backgroundColor: colors.lav1 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  btn: { ...est.botao(), minHeight: 46, paddingHorizontal: 18 },
  btnTxt: est.botaoTxt(),
  btnSec: { ...est.botaoSec(), minHeight: 44, paddingHorizontal: 16 },
  btnSecTxt: est.botaoSecTxt(),
  btnMini: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.lav2 },
  iconeBtn: { ...est.botaoIcone(), width: 36, height: 36 },
  modulo: { ...est.tenue(16), padding: 12, marginBottom: 8 },
  tirar: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 6, minHeight: 32 },
  tirarTxt: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.roseTexto },
  importar: { ...est.tenue(18), padding: 14, marginBottom: 10 },
  importarTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  aviso: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: acento('dourado').texto, marginTop: 6 },
  aulaLinha: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  aulaThumb: { width: 96, aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: colors.lav1 },
  vazio: { ...est.legenda(), textAlign: 'center', paddingVertical: spacing.lg },
  card: { ...est.vidro(22), padding: 14, marginBottom: 12 },
  cardTopo: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardCapa: { width: 120, aspectRatio: 16 / 9, borderRadius: 12 },
  cardTit: est.cartaoTitulo(),
  legenda: est.legenda(),
  corpo: est.corpo(),
  tag: { ...est.etiquetaTxt(), paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', alignSelf: 'flex-start', marginTop: 4 },
  tagOk: { color: acento('salvia').texto, backgroundColor: acento('salvia').fundo },
  tagNeutra: { color: acento('neutro').texto, backgroundColor: acento('neutro').fundo },
  tagDestaque: { color: acento('dourado').texto, backgroundColor: acento('dourado').fundo },
  fotoP: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.lav2 },
  fotoInicial: { alignItems: 'center', justifyContent: 'center' },
  fotoInicialTxt: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.lav6 },
  secao: { ...est.secao(), marginTop: 22, marginBottom: 10 },
  numeros: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 6 },
  numero: { ...est.vidro(18), paddingVertical: 12, paddingHorizontal: 14, minWidth: 140, flexGrow: 1 },
  numeroValor: { fontFamily: F_NUM, fontSize: 19, color: colors.titulo },
  linhaTabela: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.bordaSuave },
}), { escalar: false });
