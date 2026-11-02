import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Alert, Switch, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Asset } from 'expo-asset';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, criarEstilos } from '../../theme';
import { est, BotaoAdmin, AcoesItem, acento } from './adminEstilo';
import Recolhivel from '../../components/Recolhivel';
import TextoComLinks from '../../components/TextoComLinks';
import { QuemFazConteudo } from '../../components/QuemFaz';
import { uploadToStorage } from '../../utils/storageUpload';
import { confirmar } from '../../utils/confirm';
import { EQUIPE_PADRAO, FOTOS_LOCAIS, FAQ_SUGERIDAS, normalizarEquipe } from '../institucional/equipeFaqPadrao';

const LIMITE = 8 * 1024 * 1024;
const aviso = (msg, titulo = 'Atenção') => Alert.alert(titulo, msg);

function mover(lista, i, passo) {
  const j = i + passo;
  if (j < 0 || j >= lista.length) return lista;
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}

async function escolherFoto() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Permita o acesso à galeria para escolher uma imagem.');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const mime = a.mimeType || 'image/jpeg';
  if (!mime.startsWith('image/')) throw new Error('Escolha uma imagem.');
  if (a.fileSize && a.fileSize > LIMITE) throw new Error('A imagem tem mais de 8 MB. Escolha uma menor.');
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const url = await uploadToStorage(a.uri, `equipe/${Date.now()}.${ext}`, mime);
  return { url, proporcao: a.width && a.height ? a.width / a.height : 4 / 3 };
}

// ─── Quem faz a Atravessia ────────────────────────────────────────────────
// Documento configuracoes/equipe. Enquanto não existe, o editor começa com o
// conteúdo padrão (o mesmo que o app mostra) como rascunho.
export function EquipeEditor() {
  const [rascunho, setRascunho] = useState(null);
  const [publicado, setPublicado] = useState(false);
  const [ocupado, setOcupado] = useState('');
  const [previa, setPrevia] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'equipe'), (snap) => {
    setPublicado(snap.exists());
    setRascunho(r => r || (snap.exists()
      ? { ...EQUIPE_PADRAO, ...snap.data(), fotos: snap.data().fotos || [], integrantes: [...(snap.data().integrantes || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)) }
      : JSON.parse(JSON.stringify(EQUIPE_PADRAO))));
  }, () => setRascunho(r => r || JSON.parse(JSON.stringify(EQUIPE_PADRAO)))), []);

  if (!rascunho) return <ActivityIndicator color={colors.lilasTexto} style={{ marginVertical: 20 }} />;

  const set = (k, v) => setRascunho(r => ({ ...r, [k]: v }));
  const setFoto = (i, k, v) => set('fotos', rascunho.fotos.map((f, n) => (n === i ? { ...f, [k]: v } : f)));
  const setPessoa = (i, k, v) => set('integrantes', rascunho.integrantes.map((p, n) => (n === i ? { ...p, [k]: v } : p)));

  const adicionarFoto = async () => {
    setOcupado('foto');
    try {
      const r = await escolherFoto();
      if (r) set('fotos', [...rascunho.fotos, { url: r.url, legenda: '', proporcao: r.proporcao }]);
    } catch (e) { aviso(e?.message || 'Não foi possível enviar a foto.'); }
    setOcupado('');
  };

  const fotoIntegrante = async (i) => {
    setOcupado(`p${i}`);
    try {
      const r = await escolherFoto();
      if (r) setPessoa(i, 'fotoUrl', r.url);
    } catch (e) { aviso(e?.message || 'Não foi possível enviar a foto.'); }
    setOcupado('');
  };

  // Envia as fotos que já vêm no app para o Storage e troca no rascunho.
  const usarFotosAtuais = async () => {
    setOcupado('atuais');
    try {
      const novas = [];
      for (const f of EQUIPE_PADRAO.fotos) {
        const asset = Asset.fromModule(FOTOS_LOCAIS[f.local]);
        await asset.downloadAsync();
        const url = await uploadToStorage(asset.localUri || asset.uri, `equipe/${f.local}-${Date.now()}.jpg`, 'image/jpeg');
        novas.push({ url, legenda: f.legenda, proporcao: f.proporcao });
      }
      set('fotos', [...novas, ...rascunho.fotos.filter(f => f.url)]);
      aviso('Fotos enviadas. Publique para valer no app.', 'Pronto');
    } catch (e) { aviso(e?.message || 'Não foi possível enviar as fotos.'); }
    setOcupado('');
  };

  const publicar = async () => {
    const integrantes = rascunho.integrantes
      .map((p, n) => ({
        id: p.id || `p${Date.now()}${n}`, nome: (p.nome || '').trim(), papel: (p.papel || '').trim(),
        texto: (p.texto || '').trim(), fotoUrl: p.fotoUrl || '', icone: p.icone || 'heart-outline', ordem: n,
      }))
      .filter(p => p.nome || p.texto);
    const fotos = rascunho.fotos.map(f => ({
      url: f.url || '', legenda: (f.legenda || '').trim(), proporcao: Number(f.proporcao) || 4 / 3,
      ...(f.url ? {} : { local: f.local || '' }),
    })).filter(f => f.url || FOTOS_LOCAIS[f.local]);
    setOcupado('publicar');
    try {
      await setDoc(doc(db, 'configuracoes', 'equipe'), {
        titulo: (rascunho.titulo || '').trim() || EQUIPE_PADRAO.titulo,
        ativo: rascunho.ativo !== false, fotos, integrantes, atualizadoEm: serverTimestamp(),
      });
      setRascunho(r => ({ ...r, fotos, integrantes }));
      aviso('A seção foi publicada no Sobre o app.', 'Publicado');
    } catch (e) { aviso(e?.message || 'Não foi possível publicar.', 'Erro'); }
    setOcupado('');
  };

  const temLocais = rascunho.fotos.some(f => !f.url);

  return (
    <View>
      {!publicado && (
        <View style={s.aviso}><Ionicons name="information-circle-outline" size={18} color={acento('lilas').tinta} />
          <Text style={s.avisoTxt}>Ainda não publicado: o app mostra o conteúdo padrão abaixo. Edite e publique quando quiser.</Text></View>
      )}
      <View style={s.linha}>
        <Text style={[s.label, { flex: 1, marginTop: 0 }]}>Mostrar a seção no app</Text>
        <Switch value={rascunho.ativo !== false} onValueChange={v => set('ativo', v)} />
      </View>
      <Text style={s.label}>Título</Text>
      <TextInput style={s.input} value={rascunho.titulo} onChangeText={t => set('titulo', t)} placeholder={EQUIPE_PADRAO.titulo} placeholderTextColor={colors.tl} />

      <Text style={s.sub}>Fotos ({rascunho.fotos.length})</Text>
      {rascunho.fotos.map((f, i) => (
        <View key={`${i}-${f.url || f.local}`} style={s.item}>
          <View style={s.linha}>
            <Image source={f.url ? { uri: f.url } : FOTOS_LOCAIS[f.local]} style={s.miniFoto} />
            <View style={{ flex: 1 }}>
              <TextInput style={s.input} value={f.legenda} onChangeText={t => setFoto(i, 'legenda', t)} placeholder="Legenda (quem aparece)" placeholderTextColor={colors.tl} />
              {!f.url && <Text style={s.dica}>Foto que já vem no app</Text>}
            </View>
          </View>
          <Ordem onSubir={i > 0 ? () => set('fotos', mover(rascunho.fotos, i, -1)) : null}
            onDescer={i < rascunho.fotos.length - 1 ? () => set('fotos', mover(rascunho.fotos, i, 1)) : null}
            onRemover={() => confirmar('Remover foto?', 'Ela sai da seção quando você publicar.', () => set('fotos', rascunho.fotos.filter((_, n) => n !== i)), 'Remover')} />
        </View>
      ))}
      <View style={s.botoes}>
        <BotaoAdmin variant="secondary" icone="image-outline" title={ocupado === 'foto' ? 'Enviando…' : 'Adicionar foto'} onPress={adicionarFoto} disabled={!!ocupado} />
        {temLocais && <BotaoAdmin variant="secondary" icone="cloud-upload-outline" title={ocupado === 'atuais' ? 'Enviando…' : 'Usar fotos atuais'} onPress={usarFotosAtuais} disabled={!!ocupado} />}
      </View>
      <Text style={s.dica}>Só imagens, até 8 MB.</Text>

      <Text style={s.sub}>Integrantes ({rascunho.integrantes.length})</Text>
      {rascunho.integrantes.map((p, i) => (
        <View key={p.id || i} style={s.item}>
          <View style={s.linha}>
            <TouchableOpacity onPress={() => fotoIntegrante(i)} disabled={!!ocupado} accessibilityRole="button" accessibilityLabel="Trocar foto do integrante">
              {p.fotoUrl ? <Image source={{ uri: p.fotoUrl }} style={s.avatar} />
                : <View style={[s.avatar, s.avatarVazio]}>{ocupado === `p${i}` ? <ActivityIndicator size="small" color={colors.lilasTexto} /> : <Ionicons name="camera-outline" size={18} color={colors.lilasTexto} />}</View>}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <TextInput style={s.input} value={p.nome} onChangeText={t => setPessoa(i, 'nome', t)} placeholder="Nome" placeholderTextColor={colors.tl} />
            </View>
          </View>
          <TextInput style={[s.input, { marginTop: 8 }]} value={p.papel} onChangeText={t => setPessoa(i, 'papel', t)} placeholder="Papel (ex.: Fundadora e psicóloga)" placeholderTextColor={colors.tl} />
          <TextInput style={[s.input, s.multi, { marginTop: 8 }]} value={p.texto} onChangeText={t => setPessoa(i, 'texto', t)} multiline textAlignVertical="top" placeholder="Uma frase sobre o que a pessoa faz" placeholderTextColor={colors.tl} />
          {!!p.fotoUrl && <TouchableOpacity onPress={() => setPessoa(i, 'fotoUrl', '')}><Text style={s.link}>Tirar foto (volta o ícone)</Text></TouchableOpacity>}
          <Ordem onSubir={i > 0 ? () => set('integrantes', mover(rascunho.integrantes, i, -1)) : null}
            onDescer={i < rascunho.integrantes.length - 1 ? () => set('integrantes', mover(rascunho.integrantes, i, 1)) : null}
            onRemover={() => confirmar('Remover integrante?', `${p.nome || 'Este integrante'} sai da seção quando você publicar.`, () => set('integrantes', rascunho.integrantes.filter((_, n) => n !== i)), 'Remover')} />
        </View>
      ))}
      <BotaoAdmin variant="secondary" icone="person-add-outline" title="Adicionar integrante"
        onPress={() => set('integrantes', [...rascunho.integrantes, { id: `p${Date.now()}`, nome: '', papel: '', texto: '', fotoUrl: '', icone: 'heart-outline' }])} />

      <Recolhivel titulo="Prévia" subtitulo="Como fica no Sobre o app" icone="eye-outline" aberto={previa} onAlternar={setPrevia} estilo={{ marginTop: 16 }}>
        {previa && <QuemFazConteudo dados={normalizarEquipe(rascunho)} previa />}
      </Recolhivel>
      <BotaoAdmin title={ocupado === 'publicar' ? 'Publicando…' : 'Publicar no app'} icone="checkmark" onPress={publicar} disabled={!!ocupado} />
    </View>
  );
}

function Ordem({ onSubir, onDescer, onRemover }) {
  return (
    <View style={s.ordem}>
      <TouchableOpacity style={[s.ordemBtn, !onSubir && s.off]} onPress={onSubir || undefined} disabled={!onSubir} accessibilityLabel="Subir">
        <Ionicons name="arrow-up" size={16} color={colors.lilasTexto} />
      </TouchableOpacity>
      <TouchableOpacity style={[s.ordemBtn, !onDescer && s.off]} onPress={onDescer || undefined} disabled={!onDescer} accessibilityLabel="Descer">
        <Ionicons name="arrow-down" size={16} color={colors.lilasTexto} />
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={s.remover} onPress={onRemover} accessibilityLabel="Remover">
        <Ionicons name="trash-outline" size={15} color={colors.roseTexto} />
        <Text style={s.removerTxt}>Remover</Text>
      </TouchableOpacity>
    </View>
  );
}

// Atalhos para ver as telas como a usuária vê (Sobre o app e o FAQ).
export function VerNoApp({ navigation }) {
  return (
    <View style={[s.botoes, { marginBottom: 12 }]}>
      <BotaoAdmin variant="secondary" icone="information-circle-outline" title="Ver Sobre o app" onPress={() => navigation.navigate('Sobre')} />
      <BotaoAdmin variant="secondary" icone="help-circle-outline" title="Ver perguntas no app" onPress={() => navigation.navigate('PerguntasFrequentes')} />
    </View>
  );
}

// ─── Perguntas frequentes ─────────────────────────────────────────────────
// Coleção faq: { pergunta, resposta, categoria, ordem, publicado }.
const VAZIO = { pergunta: '', resposta: '', categoria: '', publicado: true };

export function FaqEditor() {
  const [itens, setItens] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [editId, setEditId] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(collection(db, 'faq'),
    (snap) => setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999))),
    () => setItens([])), []);

  const proximaOrdem = useMemo(() => (itens || []).reduce((m, q) => Math.max(m, Number(q.ordem) || 0), -1) + 1, [itens]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const limpar = () => { setForm(VAZIO); setEditId(null); setAberto(false); };

  const salvar = async () => {
    const pergunta = form.pergunta.trim();
    const resposta = form.resposta.trim();
    if (!pergunta || !resposta) { aviso('Preencha a pergunta e a resposta.'); return; }
    setSalvando(true);
    try {
      const dados = { pergunta, resposta, categoria: form.categoria.trim(), publicado: !!form.publicado, atualizadoEm: serverTimestamp() };
      if (editId) await updateDoc(doc(db, 'faq', editId), dados);
      else await addDoc(collection(db, 'faq'), { ...dados, ordem: proximaOrdem, criadoEm: serverTimestamp() });
      limpar();
    } catch (e) { aviso(e?.message || 'Não foi possível salvar.', 'Erro'); }
    setSalvando(false);
  };

  const editar = (q) => {
    setForm({ pergunta: q.pergunta || '', resposta: q.resposta || '', categoria: q.categoria || '', publicado: q.publicado !== false });
    setEditId(q.id);
    setAberto(true);
  };

  const apagar = (q) => confirmar('Apagar pergunta?', `"${q.pergunta}" será apagada de vez.`, async () => {
    try { await deleteDoc(doc(db, 'faq', q.id)); if (editId === q.id) limpar(); } catch (e) { aviso(e?.message || 'Não foi possível apagar.', 'Erro'); }
  }, 'Apagar');

  const alternarPublicado = async (q) => {
    try { await updateDoc(doc(db, 'faq', q.id), { publicado: q.publicado === false, atualizadoEm: serverTimestamp() }); } catch (e) { aviso(e?.message || 'Não foi possível alterar.', 'Erro'); }
  };

  // Regrava a ordem de toda a lista (0, 1, 2…) depois de trocar dois itens.
  const reordenar = async (i, passo) => {
    const nova = mover(itens, i, passo);
    if (nova === itens) return;
    try {
      const b = writeBatch(db);
      nova.forEach((q, n) => { if (q.ordem !== n) b.update(doc(db, 'faq', q.id), { ordem: n }); });
      await b.commit();
    } catch (e) { aviso(e?.message || 'Não foi possível reordenar.', 'Erro'); }
  };

  const sugeridas = async () => {
    const existentes = new Set((itens || []).map(q => (q.pergunta || '').trim().toLowerCase()));
    const novas = FAQ_SUGERIDAS.filter(q => !existentes.has(q.pergunta.toLowerCase()));
    if (!novas.length) { aviso('As perguntas sugeridas já estão na lista.'); return; }
    try {
      const b = writeBatch(db);
      novas.forEach((q, n) => b.set(doc(collection(db, 'faq')), { ...q, publicado: false, ordem: proximaOrdem + n, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() }));
      await b.commit();
      aviso(`${novas.length} pergunta(s) adicionada(s) como rascunho. Revise e publique.`, 'Pronto');
    } catch (e) { aviso(e?.message || 'Não foi possível adicionar.', 'Erro'); }
  };

  return (
    <View>
      <Recolhivel titulo={editId ? 'Editar pergunta' : 'Nova pergunta'} icone={editId ? 'create-outline' : 'add'} aberto={aberto}
        onAlternar={(v) => { if (!v && editId) limpar(); else setAberto(v); }} estilo={s.form}>
        <Text style={s.label}>Pergunta</Text>
        <TextInput style={s.input} value={form.pergunta} onChangeText={t => set('pergunta', t)} placeholder="Ex.: Como funciona o check-in?" placeholderTextColor={colors.tl} />
        <Text style={s.label}>Resposta</Text>
        <TextInput style={[s.input, s.multi]} value={form.resposta} onChangeText={t => set('resposta', t)} multiline textAlignVertical="top" placeholder="Quebras de linha são mantidas. Links com https:// viram tocáveis." placeholderTextColor={colors.tl} />
        <Text style={s.label}>Categoria (opcional)</Text>
        <TextInput style={s.input} value={form.categoria} onChangeText={t => set('categoria', t)} placeholder="Ex.: Planos" placeholderTextColor={colors.tl} />
        <View style={[s.linha, { marginTop: 12 }]}>
          <Text style={[s.label, { flex: 1, marginTop: 0 }]}>Publicada (aparece no app)</Text>
          <Switch value={!!form.publicado} onValueChange={v => set('publicado', v)} />
        </View>
        <View style={s.botoes}>
          <BotaoAdmin title={salvando ? 'Salvando…' : (editId ? 'Salvar alterações' : 'Adicionar pergunta')} icone="checkmark" onPress={salvar} disabled={salvando} />
          {editId && <BotaoAdmin variant="secondary" title="Cancelar" onPress={limpar} />}
        </View>
      </Recolhivel>

      <BotaoAdmin variant="secondary" icone="sparkles-outline" title="Adicionar perguntas sugeridas" onPress={sugeridas} disabled={!itens} style={{ marginBottom: 12 }} />

      {itens === null ? <ActivityIndicator color={colors.lilasTexto} /> : itens.length === 0 ? (
        <Text style={s.dica}>Nenhuma pergunta ainda. No app, a tela mostra um aviso simples.</Text>
      ) : itens.map((q, i) => (
        <View key={q.id} style={s.item}>
          <View style={s.linha}>
            <Text style={[s.pergunta, { flex: 1 }]}>{q.pergunta}</Text>
            <View style={[s.etiqueta, { backgroundColor: acento(q.publicado === false ? 'neutro' : 'salvia').fundo }]}>
              <Text style={[s.etiquetaTxt, { color: acento(q.publicado === false ? 'neutro' : 'salvia').texto }]}>{q.publicado === false ? 'Rascunho' : 'Publicada'}</Text>
            </View>
          </View>
          {!!q.categoria && <Text style={s.dica}>{q.categoria}</Text>}
          <TextoComLinks style={s.resposta} numberOfLines={3}>{q.resposta}</TextoComLinks>
          <View style={s.ordem}>
            <TouchableOpacity style={[s.ordemBtn, i === 0 && s.off]} disabled={i === 0} onPress={() => reordenar(i, -1)} accessibilityLabel="Subir"><Ionicons name="arrow-up" size={16} color={colors.lilasTexto} /></TouchableOpacity>
            <TouchableOpacity style={[s.ordemBtn, i === itens.length - 1 && s.off]} disabled={i === itens.length - 1} onPress={() => reordenar(i, 1)} accessibilityLabel="Descer"><Ionicons name="arrow-down" size={16} color={colors.lilasTexto} /></TouchableOpacity>
          </View>
          <AcoesItem onEditar={() => editar(q)} onApagar={() => apagar(q)}
            extra={(
              <TouchableOpacity style={s.pub} onPress={() => alternarPublicado(q)} accessibilityRole="button">
                <Ionicons name={q.publicado === false ? 'eye-outline' : 'eye-off-outline'} size={16} color={colors.lilasTexto} />
                <Text style={s.pubTxt}>{q.publicado === false ? 'Publicar' : 'Despublicar'}</Text>
              </TouchableOpacity>
            )} />
        </View>
      ))}
    </View>
  );
}

const s = criarEstilos(() => ({
  label: { ...est.rotulo(), marginTop: 10 },
  sub: { ...est.cartaoTitulo(), marginTop: 18, marginBottom: 8 },
  input: est.campo(),
  multi: { minHeight: 90, maxHeight: 260, paddingTop: 12 },
  dica: est.dica(),
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  item: { ...est.tenue(16), padding: 12, marginBottom: 10 },
  miniFoto: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.lav1 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.lav1 },
  avatarVazio: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lav3, borderStyle: 'dashed' },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  ordem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  ordemBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lav1 },
  off: { opacity: 0.35 },
  remover: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 10 },
  removerTxt: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.roseTexto },
  link: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.lilasTexto, marginTop: 8 },
  aviso: { ...est.aviso('lilas'), marginBottom: 12 },
  avisoTxt: est.avisoTxt('lilas'),
  form: { marginBottom: 12 },
  pergunta: est.cartaoTitulo(),
  resposta: { ...est.corpo(), fontSize: 14, marginTop: 4 },
  etiqueta: est.etiqueta(),
  etiquetaTxt: est.etiquetaTxt(),
  pub: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12 },
  pubTxt: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.lilasTexto },
}));
