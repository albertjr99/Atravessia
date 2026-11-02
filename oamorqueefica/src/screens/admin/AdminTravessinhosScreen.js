import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Switch, Image, ActivityIndicator, Platform, Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { ref as sRef, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { uploadToStorage } from '../../utils/storageUpload';
import { confirmar } from '../../utils/confirm';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, BotaoAdmin, AcoesItem, useFormRecolhivel } from './adminEstilo';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';
import Recolhivel from '../../components/Recolhivel';
import SeletorOpcoes from '../../components/SeletorOpcoes';
import {
  TIPOS_MATERIAL, OPCOES_PERSONAGEM, extrairYoutubeId, capaMaterial, ordenarMateriais,
} from '../../components/Travessinho';

// Os Travessinhos (conteúdo infantil): vídeos (YouTube, inclusive não listado,
// ou arquivo), PDFs, histórias em quadrinhos (várias imagens em sequência) e
// áudios. Coleção travessinhosMateriais; arquivos no Storage em travessinhos/.
const COLECAO = 'travessinhosMateriais';
const MB = 1024 * 1024;
const LIMITES = { imagem: 15 * MB, pdf: 50 * MB, audio: 100 * MB, video: 500 * MB };

const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

const formVazio = () => ({
  tipo: 'video', titulo: '', descricao: '', capaUrl: '', capaPath: '',
  videoOrigem: 'youtube', youtube: '', arquivoUrl: '', arquivoPath: '', arquivoTipo: '',
  paginas: [], faixaEtaria: '', personagem: 'todos', ordem: '', destaque: false, publicado: false, data: hoje(),
});

const nomeSeguro = (nome, padrao) => String(nome || '').trim().replace(/\s+/g, '_').replace(/[^\w.\-]/g, '') || padrao;

function avisar(msg) {
  if (Platform.OS === 'web') window.alert(msg); else Alert.alert('', msg);
}

async function apagarArquivo(path) {
  if (!path) return;
  try { await deleteObject(sRef(storage, path)); } catch {}
}

function escolherArquivosWeb(accept, multiplo) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = !!multiplo;
    input.onchange = () => resolve(Array.from(input.files || []));
    input.click();
  });
}

// Escolhe e envia um ou mais arquivos para travessinhos/. `classe` é
// 'imagem' | 'pdf' | 'audio' | 'video'. Devolve [{ url, path, mime }].
async function enviarArquivos(classe, multiplo = false) {
  const accept = { imagem: 'image/*', pdf: 'application/pdf', audio: 'audio/*', video: 'video/*' }[classe];
  const confere = (mime, tam, nome) => {
    const ok = classe === 'pdf' ? mime === 'application/pdf' : mime.startsWith(`${classe === 'imagem' ? 'image' : classe}/`);
    if (!ok) throw new Error(`"${nome}" não é do tipo esperado.`);
    if (tam && tam > LIMITES[classe]) throw new Error(`"${nome}" passa de ${Math.round(LIMITES[classe] / MB)} MB.`);
  };
  const saida = [];
  if (Platform.OS === 'web') {
    const arquivos = await escolherArquivosWeb(accept, multiplo);
    for (const f of arquivos) {
      const mime = f.type || (classe === 'pdf' ? 'application/pdf' : '');
      confere(mime, f.size, f.name);
      const path = `travessinhos/${Date.now()}_${nomeSeguro(f.name, 'arquivo')}`;
      const r = sRef(storage, path);
      await uploadBytes(r, f, { contentType: mime });
      saida.push({ url: await getDownloadURL(r), path, mime });
    }
    return saida;
  }
  const res = await DocumentPicker.getDocumentAsync({ type: accept, copyToCacheDirectory: true, multiple: !!multiplo });
  if (res.canceled || !res.assets?.length) return saida;
  for (const a of res.assets) {
    const mime = a.mimeType || (classe === 'pdf' ? 'application/pdf' : classe === 'imagem' ? 'image/jpeg' : classe === 'audio' ? 'audio/mpeg' : 'video/mp4');
    confere(mime, a.size, a.name);
    const path = `travessinhos/${Date.now()}_${nomeSeguro(a.name, 'arquivo')}`;
    saida.push({ url: await uploadToStorage(a.uri, path, mime), path, mime });
  }
  return saida;
}

const caminhosDe = (m) => [m?.capaPath, m?.arquivoPath, ...((m?.paginas || []).map(p => p.path))].filter(Boolean);

export default function AdminTravessinhosScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const largo = width >= 760;
  const rolagem = useRef(null);
  const f = useFormRecolhivel(rolagem);

  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroPub, setFiltroPub] = useState('todos');

  const [form, setForm] = useState(formVazio);
  const [editando, setEditando] = useState(null);
  const [enviados, setEnviados] = useState([]);
  const [enviando, setEnviando] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  useEffect(() => onSnapshot(collection(db, COLECAO),
    (snap) => { setItens(ordenarMateriais(snap.docs.map(d => ({ id: d.id, ...d.data() })))); setErro(''); },
    (e) => { setItens([]); setErro(e?.code === 'permission-denied' ? 'Sem permissão para ler os materiais.' : (e?.message || 'Erro ao carregar.')); }), []);

  const set = (campo, v) => setForm(p => ({ ...p, [campo]: v }));

  const filtrados = useMemo(() => (itens || []).filter(m =>
    (filtroTipo === 'todos' || m.tipo === filtroTipo)
    && (filtroPub === 'todos' || (filtroPub === 'publicados' ? m.publicado === true : m.publicado !== true))), [itens, filtroTipo, filtroPub]);

  const enviar = async (classe, rotulo, aoEnviar, multiplo) => {
    setErroForm('');
    setEnviando(rotulo);
    try {
      const arqs = await enviarArquivos(classe, multiplo);
      if (arqs.length) { setEnviados(p => [...p, ...arqs.map(a => a.path)]); aoEnviar(arqs); }
    } catch (e) {
      setErroForm(e?.message || 'Não foi possível enviar o arquivo.');
    } finally { setEnviando(''); }
  };

  const limparForm = () => { setForm(formVazio()); setEditando(null); setEnviados([]); setErroForm(''); };

  const cancelar = async () => {
    const descartar = enviados;
    limparForm();
    f.setAberto(false);
    await Promise.all(descartar.map(apagarArquivo));
  };

  const editar = (m) => {
    setEditando(m);
    setEnviados([]);
    setErroForm('');
    setForm({
      ...formVazio(),
      tipo: m.tipo || 'video', titulo: m.titulo || '', descricao: m.descricao || '',
      capaUrl: m.capaUrl || '', capaPath: m.capaPath || '',
      videoOrigem: m.tipo === 'video' && !m.youtubeId && m.arquivoUrl ? 'arquivo' : 'youtube',
      youtube: m.youtubeId ? `https://youtu.be/${m.youtubeId}` : '',
      arquivoUrl: m.arquivoUrl || '', arquivoPath: m.arquivoPath || '', arquivoTipo: m.arquivoTipo || '',
      paginas: Array.isArray(m.paginas) ? m.paginas : [], faixaEtaria: m.faixaEtaria || '',
      personagem: m.personagem || 'todos', ordem: m.ordem != null ? String(m.ordem) : '',
      destaque: !!m.destaque, publicado: m.publicado === true, data: m.data || hoje(),
    });
    f.abrirERolar();
  };

  const salvar = async () => {
    const titulo = form.titulo.trim();
    if (!titulo) { setErroForm('Informe o título.'); return; }
    const tipo = form.tipo;
    const youtubeId = tipo === 'video' && form.videoOrigem === 'youtube' ? extrairYoutubeId(form.youtube) : '';
    if (tipo === 'video' && form.videoOrigem === 'youtube' && !youtubeId) { setErroForm('Cole um link válido do YouTube (vale vídeo não listado).'); return; }
    const usaArquivo = tipo === 'pdf' || tipo === 'audio' || (tipo === 'video' && form.videoOrigem === 'arquivo');
    if (usaArquivo && !form.arquivoUrl) { setErroForm('Envie o arquivo antes de salvar.'); return; }
    if (tipo === 'quadrinho' && !form.paginas.length) { setErroForm('Envie ao menos uma página do quadrinho.'); return; }
    if (form.data && !/^\d{4}-\d{2}-\d{2}$/.test(form.data)) { setErroForm('Data no formato AAAA-MM-DD.'); return; }

    const dados = {
      tipo, titulo: titulo.slice(0, 160), descricao: form.descricao.trim().slice(0, 500),
      capaUrl: form.capaUrl, capaPath: form.capaPath,
      youtubeId,
      arquivoUrl: usaArquivo ? form.arquivoUrl : '', arquivoPath: usaArquivo ? form.arquivoPath : '', arquivoTipo: usaArquivo ? form.arquivoTipo : '',
      paginas: tipo === 'quadrinho' ? form.paginas.map(p => ({ url: p.url, path: p.path || '' })) : [],
      faixaEtaria: form.faixaEtaria.trim().slice(0, 40), personagem: form.personagem,
      ordem: Number(form.ordem) || 0, destaque: !!form.destaque, publicado: !!form.publicado, data: form.data || hoje(),
    };
    setSalvando(true);
    setErroForm('');
    try {
      if (editando) await updateDoc(doc(db, COLECAO, editando.id), { ...dados, atualizadoEm: serverTimestamp() });
      else await addDoc(collection(db, COLECAO), { ...dados, criadoEm: serverTimestamp() });
      const usados = new Set(caminhosDe(dados));
      const sobras = [...enviados, ...caminhosDe(editando)].filter(p => !usados.has(p));
      limparForm();
      f.setAberto(false);
      await Promise.all(sobras.map(apagarArquivo));
    } catch (e) {
      setErroForm(`Não foi possível salvar: ${e?.code || e?.message || 'tente novamente.'}`);
    } finally { setSalvando(false); }
  };

  const alternarPublicado = async (m) => {
    try { await updateDoc(doc(db, COLECAO, m.id), { publicado: m.publicado !== true, atualizadoEm: serverTimestamp() }); }
    catch (e) { avisar(`Não foi possível alterar: ${e?.message || ''}`); }
  };

  const apagar = (m) => confirmar('Apagar material', `Apagar "${m.titulo || 'sem título'}"? Os arquivos enviados também serão apagados.`, async () => {
    try {
      await deleteDoc(doc(db, COLECAO, m.id));
      await Promise.all(caminhosDe(m).map(apagarArquivo));
      if (editando?.id === m.id) limparForm();
    } catch (e) { avisar(`Não foi possível apagar: ${e?.message || ''}`); }
  }, 'Apagar');

  const moverPagina = (i, d) => setForm(p => {
    const pg = [...p.paginas];
    const j = i + d;
    if (j < 0 || j >= pg.length) return p;
    [pg[i], pg[j]] = [pg[j], pg[i]];
    return { ...p, paginas: pg };
  });
  const tirarPagina = (i) => setForm(p => ({ ...p, paginas: p.paginas.filter((_, k) => k !== i) }));

  const ytId = form.tipo === 'video' && form.videoOrigem === 'youtube' ? extrairYoutubeId(form.youtube) : '';
  const capaPrevia = form.capaUrl || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : '') || (form.tipo === 'quadrinho' ? form.paginas[0]?.url : '');
  const classeArquivo = form.tipo === 'pdf' ? 'pdf' : form.tipo === 'audio' ? 'audio' : 'video';

  const BotaoEnvio = ({ classe, rotulo, icone, aoEnviar, multiplo }) => (
    <TouchableOpacity style={[s.upload, !!enviando && { opacity: 0.6 }]} disabled={!!enviando}
      onPress={() => enviar(classe, rotulo, aoEnviar, multiplo)} activeOpacity={0.8}>
      {enviando === rotulo ? <ActivityIndicator size="small" color={colors.lilasTexto} /> : <Ionicons name={icone} size={18} color={colors.lilasTexto} />}
      <Text style={s.uploadTxt}>{enviando === rotulo ? 'Enviando…' : rotulo}</Text>
    </TouchableOpacity>
  );

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminTravessinhos">
      <AdminSubTabs grupo="biblioteca" atual="AdminTravessinhos" />
      <ScrollView ref={rolagem} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.sobre}>Biblioteca</Text>
        <Text style={s.pageTitle}>Os Travessinhos</Text>
        <Text style={s.pageSub}>
          Conteúdo infantil com a Nanda, o Brian e a Maju: vídeos, PDFs, histórias em quadrinhos e áudios.
          O card aparece no Início do app assim que houver um material publicado.
        </Text>

        <View onLayout={f.onLayout}>
          <Recolhivel
            titulo={editando ? `Editar: ${editando.titulo || 'material'}` : 'Novo material'}
            subtitulo={editando ? 'Altere e salve, ou cancele para descartar' : 'Toque para cadastrar'}
            icone={editando ? 'create-outline' : 'add-circle-outline'}
            aberto={f.aberto}
            onAlternar={f.setAberto}
          >
            <Text style={s.label}>Tipo</Text>
            <SeletorOpcoes limite={10} titulo="Tipo" valor={form.tipo} onChange={v => set('tipo', v)}
              opcoes={Object.entries(TIPOS_MATERIAL).map(([id, t]) => ({ id, label: t.rotulo, icone: t.icone }))} />

            <Text style={s.label}>Título *</Text>
            <TextInput style={s.input} value={form.titulo} onChangeText={v => set('titulo', v)} placeholder="Ex.: A ponte da saudade" placeholderTextColor={colors.tl} />
            <Text style={s.label}>Descrição curta</Text>
            <TextInput style={[s.input, { minHeight: 64 }]} value={form.descricao} onChangeText={v => set('descricao', v)} multiline textAlignVertical="top"
              placeholder="Uma ou duas frases para quem cuida da criança" placeholderTextColor={colors.tl} />

            {form.tipo === 'video' && (
              <>
                <Text style={s.label}>Origem do vídeo</Text>
                <SeletorOpcoes limite={10} titulo="Origem do vídeo" valor={form.videoOrigem} onChange={v => set('videoOrigem', v)}
                  opcoes={[{ id: 'youtube', label: 'Link do YouTube', icone: 'logo-youtube' }, { id: 'arquivo', label: 'Arquivo de vídeo', icone: 'cloud-upload-outline' }]} />
                {form.videoOrigem === 'youtube' ? (
                  <>
                    <TextInput style={[s.input, { marginTop: 8 }]} value={form.youtube} onChangeText={v => set('youtube', v)} autoCapitalize="none" autoCorrect={false}
                      placeholder="https://youtu.be/... (pode ser não listado)" placeholderTextColor={colors.tl} />
                    {!!form.youtube && !ytId && <Text style={s.dicaErro}>Link não reconhecido.</Text>}
                  </>
                ) : null}
              </>
            )}

            {(form.tipo === 'pdf' || form.tipo === 'audio' || (form.tipo === 'video' && form.videoOrigem === 'arquivo')) && (
              <View style={{ marginTop: 10, gap: 6 }}>
                {!!form.arquivoUrl && (
                  <View style={s.arquivoOk}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.sageFg} />
                    <Text style={s.arquivoOkTxt} numberOfLines={1}>{(form.arquivoPath || '').split('/').pop() || 'Arquivo enviado'}</Text>
                  </View>
                )}
                <BotaoEnvio classe={classeArquivo} icone="cloud-upload-outline"
                  rotulo={form.arquivoUrl ? 'Trocar arquivo' : classeArquivo === 'pdf' ? 'Enviar PDF *' : classeArquivo === 'audio' ? 'Enviar áudio *' : 'Enviar vídeo *'}
                  aoEnviar={([a]) => setForm(p => ({ ...p, arquivoUrl: a.url, arquivoPath: a.path, arquivoTipo: a.mime }))} />
                <Text style={s.dica}>Até {Math.round(LIMITES[classeArquivo] / MB)} MB.</Text>
              </View>
            )}

            {form.tipo === 'quadrinho' && (
              <View style={{ marginTop: 10, gap: 8 }}>
                <Text style={s.label}>Páginas (na ordem de leitura) *</Text>
                {form.paginas.map((p, i) => (
                  <View key={`${i}-${p.url}`} style={s.pagina}>
                    <Image source={{ uri: p.url }} style={s.paginaImg} />
                    <Text style={s.paginaTxt}>Página {i + 1}</Text>
                    <TouchableOpacity onPress={() => moverPagina(i, -1)} disabled={i === 0} style={[s.mini, i === 0 && { opacity: 0.3 }]} accessibilityLabel="Subir página">
                      <Ionicons name="arrow-up" size={16} color={colors.lilasTexto} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moverPagina(i, 1)} disabled={i === form.paginas.length - 1} style={[s.mini, i === form.paginas.length - 1 && { opacity: 0.3 }]} accessibilityLabel="Descer página">
                      <Ionicons name="arrow-down" size={16} color={colors.lilasTexto} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => tirarPagina(i)} style={s.mini} accessibilityLabel="Remover página">
                      <Ionicons name="close" size={16} color={colors.roseTexto} />
                    </TouchableOpacity>
                  </View>
                ))}
                <BotaoEnvio classe="imagem" multiplo icone="images-outline" rotulo="Adicionar páginas"
                  aoEnviar={(arqs) => setForm(p => ({ ...p, paginas: [...p.paginas, ...arqs.map(a => ({ url: a.url, path: a.path }))] }))} />
                <Text style={s.dica}>Pode escolher várias imagens de uma vez (até 15 MB cada). Use as setas para reordenar.</Text>
              </View>
            )}

            <Text style={s.label}>Capa</Text>
            <View style={s.capaLinha}>
              {capaPrevia ? <Image source={{ uri: capaPrevia }} style={s.capa} /> : <View style={[s.capa, s.capaVazia]}><Ionicons name="image-outline" size={22} color={colors.tl} /></View>}
              <View style={{ flex: 1, gap: 6 }}>
                <BotaoEnvio classe="imagem" icone="image-outline" rotulo={form.capaUrl ? 'Trocar capa' : 'Enviar capa'}
                  aoEnviar={([a]) => setForm(p => ({ ...p, capaUrl: a.url, capaPath: a.path }))} />
                {!!form.capaUrl && (
                  <TouchableOpacity onPress={() => setForm(p => ({ ...p, capaUrl: '', capaPath: '' }))}>
                    <Text style={s.link}>Usar capa automática</Text>
                  </TouchableOpacity>
                )}
                <Text style={s.dica}>Sem capa: usa a miniatura do YouTube ou a 1ª página do quadrinho.</Text>
              </View>
            </View>

            <Text style={s.label}>Personagem em destaque</Text>
            <SeletorOpcoes limite={10} titulo="Personagem" valor={form.personagem} onChange={v => set('personagem', v)} opcoes={OPCOES_PERSONAGEM} />

            <View style={[s.linha, { flexWrap: 'wrap' }]}>
              <View style={{ flex: 1, minWidth: 160 }}>
                <Text style={s.label}>Faixa etária (opcional)</Text>
                <TextInput style={s.input} value={form.faixaEtaria} onChangeText={v => set('faixaEtaria', v)} placeholder="Ex.: 4 a 8 anos" placeholderTextColor={colors.tl} />
              </View>
              <View style={{ width: 110 }}>
                <Text style={s.label}>Ordem</Text>
                <TextInput style={s.input} value={form.ordem} onChangeText={v => set('ordem', v.replace(/[^\d-]/g, ''))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.tl} />
              </View>
              <View style={{ width: 150 }}>
                <Text style={s.label}>Data</Text>
                <TextInput style={s.input} value={form.data} onChangeText={v => set('data', v)} placeholder="AAAA-MM-DD" placeholderTextColor={colors.tl} />
              </View>
            </View>

            <View style={s.chave}>
              <Text style={s.chaveTxt}>Destaque (aparece primeiro)</Text>
              <Switch value={form.destaque} onValueChange={v => set('destaque', v)} trackColor={{ true: colors.lav4 }} />
            </View>
            <View style={s.chave}>
              <Text style={s.chaveTxt}>Publicado no app</Text>
              <Switch value={form.publicado} onValueChange={v => set('publicado', v)} trackColor={{ true: colors.lav4 }} />
            </View>

            {!!erroForm && <Text style={s.erro}>{erroForm}</Text>}
            <View style={[s.linha, { marginTop: spacing.md }]}>
              <BotaoAdmin title="Cancelar" variant="secondary" onPress={cancelar} disabled={salvando} style={{ flex: 1 }} />
              <BotaoAdmin title={salvando ? 'Salvando…' : 'Salvar'} icone="checkmark" onPress={salvar} disabled={salvando || !!enviando} style={{ flex: 1 }} />
            </View>
          </Recolhivel>
        </View>

        <Text style={s.label}>Tipo</Text>
        <SeletorOpcoes limite={10} titulo="Filtrar por tipo" valor={filtroTipo} onChange={setFiltroTipo}
          opcoes={[{ id: 'todos', label: 'Todos' }, ...Object.entries(TIPOS_MATERIAL).map(([id, t]) => ({ id, label: t.rotulo, icone: t.icone }))]} />
        <Text style={s.label}>Situação</Text>
        <SeletorOpcoes limite={10} titulo="Filtrar por situação" valor={filtroPub} onChange={setFiltroPub}
          opcoes={[{ id: 'todos', label: 'Todos' }, { id: 'publicados', label: 'Publicados' }, { id: 'rascunhos', label: 'Não publicados' }]} />

        {!!erro && <Text style={[s.erro, { marginTop: spacing.md }]}>{erro}</Text>}
        {itens === null ? <ActivityIndicator color={colors.lav4} style={{ marginTop: 24 }} />
          : filtrados.length === 0 ? <Text style={[s.dica, { marginTop: spacing.md }]}>Nenhum material {itens.length ? 'com esses filtros' : 'cadastrado ainda'}.</Text>
            : (
              <View style={[s.lista, largo && s.listaLarga]}>
                {filtrados.map(m => {
                  const t = TIPOS_MATERIAL[m.tipo] || TIPOS_MATERIAL.video;
                  const capa = capaMaterial(m);
                  return (
                    <View key={m.id} style={[s.item, largo && { width: '49%' }, m.publicado !== true && { opacity: 0.75 }]}>
                      <View style={s.linha}>
                        {capa ? <Image source={{ uri: capa }} style={s.thumb} /> : <View style={[s.thumb, s.capaVazia]}><Ionicons name={t.icone} size={22} color={colors.lilasIcone} /></View>}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.itemTit} numberOfLines={2}>{m.titulo || 'Sem título'}</Text>
                          {!!m.descricao && <Text style={s.itemDesc} numberOfLines={2}>{m.descricao}</Text>}
                          <View style={s.etiquetas}>
                            <Text style={s.etq}>{t.rotulo}{m.tipo === 'quadrinho' ? ` · ${(m.paginas || []).length} pág.` : ''}</Text>
                            <Text style={[s.etq, m.publicado === true ? s.etqPub : s.etqRasc]}>{m.publicado === true ? 'Publicado' : 'Não publicado'}</Text>
                            {!!m.destaque && <Text style={s.etq}>Destaque</Text>}
                            {!!m.faixaEtaria && <Text style={s.etq}>{m.faixaEtaria}</Text>}
                            {m.personagem && m.personagem !== 'todos' && <Text style={s.etq}>{OPCOES_PERSONAGEM.find(o => o.id === m.personagem)?.label}</Text>}
                          </View>
                        </View>
                      </View>
                      <AcoesItem
                        onEditar={() => editar(m)}
                        onApagar={() => apagar(m)}
                        extra={(
                          <TouchableOpacity style={s.pubBtn} onPress={() => alternarPublicado(m)} activeOpacity={0.8}>
                            <Ionicons name={m.publicado === true ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.lilasTexto} />
                            <Text style={s.pubBtnTxt}>{m.publicado === true ? 'Despublicar' : 'Publicar'}</Text>
                          </TouchableOpacity>
                        )}
                      />
                    </View>
                  );
                })}
              </View>
            )}
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },
  label: est.rotulo(),
  dica: est.dica(),
  dicaErro: { ...est.dica(), color: colors.roseTexto },
  input: est.campo(),
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  upload: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, paddingHorizontal: 14,
    borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lav3, backgroundColor: colors.lav1,
  },
  uploadTxt: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.lilasTexto },
  arquivoOk: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arquivoOkTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.texto2 },
  pagina: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, borderRadius: 14, backgroundColor: colors.vidroTenue },
  paginaImg: { width: 44, height: 56, borderRadius: 8, backgroundColor: colors.lav1 },
  paginaTxt: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.td },
  mini: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardSolido },
  capaLinha: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  capa: { width: 96, height: 96, borderRadius: 16, backgroundColor: colors.lav1 },
  capaVazia: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lav1 },
  link: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.lilasTexto, textDecorationLine: 'underline' },
  chave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 },
  chaveTxt: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.td },
  erro: { ...est.aviso('rosa'), ...est.avisoTxt('rosa'), marginTop: 10, flex: 0 },
  lista: { marginTop: spacing.md, gap: 12 },
  listaLarga: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  item: { ...est.vidro(22), padding: 14 },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: colors.lav1 },
  itemTit: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo },
  itemDesc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.texto2, marginTop: 2 },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  etq: {
    fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.texto2, backgroundColor: acento('neutro').fundo,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
  etqPub: { color: acento('salvia').texto, backgroundColor: acento('salvia').fundo },
  etqRasc: { color: acento('dourado').texto, backgroundColor: acento('dourado').fundo },
  pubBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12 },
  pubBtnTxt: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.lilasTexto },
}), { escalar: false });
