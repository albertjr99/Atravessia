import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { uploadToStorage } from '../../utils/storageUpload';
import { db, storage } from '../../services/firebase';
import { colors, fonts, spacing, radius } from '../../theme';
import { Card, Button } from '../../components';
import * as DocumentPicker from 'expo-document-picker';
import { confirmar } from '../../utils/confirm';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';

const TIPOS = [
  { id: 'audio',     label: 'Áudio',     icon: 'headset-outline' },
  { id: 'video',     label: 'Vídeo',     icon: 'videocam-outline' },
  { id: 'documento', label: 'Documento', icon: 'document-text-outline' },
  { id: 'link',      label: 'Link',      icon: 'link-outline' },
];

const GRUPOS = [
  { id: 'acolhimento',  label: 'Acolhimento' },
  { id: 'noturno',      label: 'Noturno' },
  { id: 'complementar', label: 'Complementar' },
];

const PLANOS = [
  { id: 0, label: 'Perceber (grátis)' },
  { id: 1, label: 'Acolher' },
  { id: 2, label: 'Compreender' },
  { id: 3, label: 'Evoluir' },
];

const EMOCOES_CHECKIN = [
  { id: 'triste', label: 'Triste' },
  { id: 'saudade', label: 'Saudade' },
  { id: 'sozinho', label: 'Sozinho' },
  { id: 'medo', label: 'Medo' },
  { id: 'culpado', label: 'Culpado' },
  { id: 'ansioso', label: 'Ansioso' },
  { id: 'raiva', label: 'Raiva' },
  { id: 'desanimado', label: 'Desanimado' },
  { id: 'grato', label: 'Grato' },
  { id: 'tranquilo', label: 'Em paz' },
  { id: 'esperancoso', label: 'Esperançoso' },
  { id: 'alegre', label: 'Alegre' },
  { id: 'amoroso', label: 'Amoroso' },
];

const PLANO_CORES = {
  0: colors.sage,
  1: colors.lav4,
  2: '#7B5EA7',
  3: '#C0843F',
};

function tipoFromMime(mime = '') {
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'documento';
}

function tituloFromFilename(name = '') {
  return name.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ').trim();
}

function novoItem(overrides = {}) {
  return {
    _id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    titulo: '',
    descricao: '',
    tipo: 'audio',
    grupo: 'acolhimento',
    plano: 1,
    tags: '',
    emocoes: [],
    url: '',
    localFile: null,
    localUri: null,
    localName: '',
    status: 'pendente',
    ...overrides,
  };
}

function ItemCard({ item, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(true);

  const statusIcon = {
    pendente:   { name: 'ellipse-outline', color: colors.tl },
    carregando: { name: 'hourglass-outline', color: colors.lav4 },
    publicado:  { name: 'checkmark-circle', color: colors.sageFg },
    erro:       { name: 'alert-circle', color: colors.roseFg },
  }[item.status] || { name: 'ellipse-outline', color: colors.tl };

  return (
    <View style={s.itemCard}>
      <TouchableOpacity style={s.itemCardHeader} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <Ionicons name={statusIcon.name} size={16} color={statusIcon.color} />
        <Text style={s.itemCardTitle} numberOfLines={1}>
          {item.titulo || item.localName || 'Novo item'}
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.tl} />
        <TouchableOpacity onPress={onRemove} style={s.itemRemoveBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color={colors.peach2} />
        </TouchableOpacity>
      </TouchableOpacity>

      {expanded && (
        <View style={s.itemBody}>
          <Text style={s.formLabel}>Título</Text>
          <TextInput
            style={s.input}
            placeholder={item.localName || 'Título do conteúdo'}
            placeholderTextColor={colors.tl}
            value={item.titulo}
            onChangeText={v => onUpdate('titulo', v)}
          />

          <Text style={s.formLabel}>Descrição <Text style={s.optional}>(opcional)</Text></Text>
          <TextInput
            style={[s.input, { minHeight: 50, textAlignVertical: 'top' }]}
            placeholder="Breve descrição..."
            placeholderTextColor={colors.tl}
            multiline
            value={item.descricao}
            onChangeText={v => onUpdate('descricao', v)}
          />

          <Text style={s.formLabel}>Tipo</Text>
          <View style={s.chipRow}>
            {TIPOS.map(t => (
              <TouchableOpacity key={t.id} style={[s.chip, item.tipo === t.id && s.chipSel]} onPress={() => onUpdate('tipo', t.id)}>
                <Ionicons name={t.icon} size={12} color={item.tipo === t.id ? colors.lav6 : colors.tm} />
                <Text style={[s.chipText, item.tipo === t.id && s.chipTextSel]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.formLabel}>Grupo / categoria</Text>
          <View style={s.chipRow}>
            {GRUPOS.map(g => (
              <TouchableOpacity key={g.id} style={[s.chip, item.grupo === g.id && s.chipSel]} onPress={() => onUpdate('grupo', g.id)}>
                <Text style={[s.chipText, item.grupo === g.id && s.chipTextSel]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.formLabel}>Plano mínimo</Text>
          <View style={s.chipRow}>
            {PLANOS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[s.chip, item.plano === p.id && { backgroundColor: PLANO_CORES[p.id] + '22', borderColor: PLANO_CORES[p.id] }]}
                onPress={() => onUpdate('plano', p.id)}
              >
                <Text style={[s.chipText, item.plano === p.id && { color: PLANO_CORES[p.id], fontFamily: fonts.bodyBold }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.formLabel}>Aparece no check-in para <Text style={s.optional}>(selecione as emoções)</Text></Text>
          <View style={s.chipRow}>
            {EMOCOES_CHECKIN.map(e => {
              const sel = (item.emocoes || []).includes(e.id);
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[s.chip, sel && s.chipSel]}
                  onPress={() => onUpdate('emocoes', sel ? item.emocoes.filter(id => id !== e.id) : [...(item.emocoes || []), e.id])}
                >
                  <Text style={[s.chipText, sel && s.chipTextSel]}>{e.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.formLabel}>Tags <Text style={s.optional}>(separadas por vírgula)</Text></Text>
          <TextInput
            style={s.input}
            placeholder="Ex: luto, ansiedade, meditação"
            placeholderTextColor={colors.tl}
            value={item.tags}
            onChangeText={v => onUpdate('tags', v)}
          />

          {item.localName ? (
            <View style={s.fileChip}>
              <Ionicons name="document-attach-outline" size={14} color={colors.lav5} />
              <Text style={s.fileChipText} numberOfLines={1}>{item.localName}</Text>
            </View>
          ) : (
            <>
              <Text style={s.formLabel}>URL do conteúdo <Text style={s.required}>*</Text></Text>
              <TextInput
                style={s.input}
                placeholder="https://..."
                placeholderTextColor={colors.tl}
                autoCapitalize="none"
                value={item.url}
                onChangeText={v => onUpdate('url', v)}
              />
            </>
          )}

          {item.status === 'erro' && (
            <Text style={s.itemErro}>Falha no upload. Verifique o arquivo e tente novamente.</Text>
          )}
        </View>
      )}
    </View>
  );
}

export default function AdminConteudosScreen({ navigation }) {
  const [conteudos, setConteudos] = useState([]);
  const [fila, setFila] = useState([]);
  const [publicandoTudo, setPublicandoTudo] = useState(false);
  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [filtroPlano, setFiltroPlano] = useState('todos');

  useEffect(() => {
    const ref = query(collection(db, 'conteudos'), orderBy('criadoEm', 'desc'));
    const unsub = onSnapshot(ref, snap => setConteudos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const atualizarItem = (id, field, value) => {
    setFila(prev => prev.map(item => item._id === id ? { ...item, [field]: value } : item));
  };

  const adicionarArquivos = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'audio/*,video/*,application/pdf,image/*';
      input.onchange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const novos = files.map(file => novoItem({
          titulo: tituloFromFilename(file.name),
          localFile: file,
          localName: file.name,
          tipo: tipoFromMime(file.type),
        }));
        setFila(prev => [...prev, ...novos]);
      };
      document.body.appendChild(input);
      input.click();
      setTimeout(() => { if (document.body.contains(input)) document.body.removeChild(input); }, 5000);
    } else {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*', 'application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      const assets = result.assets || [];
      const novos = assets.map(asset => novoItem({
        titulo: tituloFromFilename(asset.name || ''),
        localUri: asset.uri,
        localName: asset.name || 'arquivo',
        tipo: tipoFromMime(asset.mimeType || ''),
      }));
      setFila(prev => [...prev, ...novos]);
    }
  };

  const adicionarLink = () => {
    setFila(prev => [...prev, novoItem({ tipo: 'link', grupo: 'acolhimento', plano: 1 })]);
  };

  const publicarTudo = async () => {
    const pendentes = fila.filter(i => i.status !== 'publicado');
    if (!pendentes.length) return;

    setPublicandoTudo(true);
    let erros = 0;

    for (const item of pendentes) {
      setFila(prev => prev.map(i => i._id === item._id ? { ...i, status: 'carregando' } : i));
      try {
        let urlFinal = item.url.trim();

        if (item.localFile) {
          // Web: File object
          const nomeArq = `${Date.now()}_${item.localFile.name.replace(/\s+/g, '_')}`;
          const fileRef = sRef(storage, `conteudos/${nomeArq}`);
          await uploadBytes(fileRef, item.localFile);
          urlFinal = await getDownloadURL(fileRef);
        } else if (item.localUri) {
          const nomeArq = `${Date.now()}_${item.localName.replace(/\s+/g, '_')}`;
          urlFinal = await uploadToStorage(item.localUri, `conteudos/${nomeArq}`, item.mimeType || 'application/octet-stream');
        }

        if (!urlFinal) {
          setFila(prev => prev.map(i => i._id === item._id ? { ...i, status: 'erro' } : i));
          erros++;
          continue;
        }

        const tagsArray = item.tags.split(',').map(t => t.trim()).filter(Boolean);

        await addDoc(collection(db, 'conteudos'), {
          titulo: (item.titulo || item.localName || 'Sem título').trim(),
          descricao: item.descricao.trim(),
          url: urlFinal,
          tipo: item.tipo,
          grupo: item.grupo,
          plano: item.plano,
          tags: tagsArray,
          emocoes: item.emocoes || [],
          criadoEm: serverTimestamp(),
        });

        setFila(prev => prev.map(i => i._id === item._id ? { ...i, status: 'publicado', url: urlFinal } : i));
      } catch (err) {
        setFila(prev => prev.map(i => i._id === item._id ? { ...i, status: 'erro' } : i));
        erros++;
      }
    }

    setPublicandoTudo(false);

    if (erros === 0) {
      Alert.alert('Publicado!', `${pendentes.length} item(s) publicado(s) com sucesso.`);
      setTimeout(() => setFila(prev => prev.filter(i => i.status !== 'publicado')), 1200);
    } else {
      Alert.alert('Concluído com erros', `${erros} item(s) falharam. Verifique e tente de novo.`);
    }
  };

  const handleRemover = (id) => {
    confirmar('Remover conteúdo', 'Tem certeza que deseja remover?', () => deleteDoc(doc(db, 'conteudos', id)), 'Remover');
  };

  const prontos = fila.filter(i => i.status !== 'publicado').length;

  const listaFiltrada = conteudos.filter(c => {
    if (filtroGrupo !== 'todos' && c.grupo !== filtroGrupo) return false;
    if (filtroPlano !== 'todos' && c.plano !== Number(filtroPlano)) return false;
    return true;
  });

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminConteudos">
      <AdminSubTabs grupo="conteudos" atual="AdminConteudos" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        <Text style={s.pageTitle}>Conteúdos</Text>
        <Text style={s.pageSub}>Adicione vários arquivos de uma vez, organize por tema e plano, e publique em massa.</Text>

        {/* ── Fila de publicação ── */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={s.cardTitle}>Fila de publicação {fila.length > 0 && `(${fila.length})`}</Text>

          <View style={s.filaActions}>
            <TouchableOpacity style={s.filaBtn} onPress={adicionarArquivos}>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.lav5} />
              <Text style={s.filaBtnTxt}>Adicionar arquivos</Text>
              <Text style={s.filaBtnHint}>Vários ao mesmo tempo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.filaBtn, { borderColor: colors.border }]} onPress={adicionarLink}>
              <Ionicons name="link-outline" size={18} color={colors.tm} />
              <Text style={[s.filaBtnTxt, { color: colors.td }]}>Adicionar link</Text>
              <Text style={s.filaBtnHint}>Cole uma URL</Text>
            </TouchableOpacity>
          </View>

          {fila.length === 0 ? (
            <Text style={s.filaEmpty}>
              Adicione arquivos ou links acima. Você pode despejar tudo de uma vez e organizar antes de publicar.
            </Text>
          ) : (
            fila.map(item => (
              <ItemCard
                key={item._id}
                item={item}
                onUpdate={(field, value) => atualizarItem(item._id, field, value)}
                onRemove={() => setFila(prev => prev.filter(i => i._id !== item._id))}
              />
            ))
          )}

          {fila.length > 0 && (
            <Button
              title={publicandoTudo ? 'Publicando...' : `Publicar tudo (${prontos} pendente${prontos !== 1 ? 's' : ''})`}
              onPress={publicarTudo}
              disabled={publicandoTudo || prontos === 0}
              style={{ marginTop: spacing.md }}
            />
          )}
        </Card>

        {/* ── Lista publicados ── */}
        <View style={s.listHeader}>
          <Text style={s.sectionTitle}>Publicados ({conteudos.length})</Text>

          <Text style={[s.formLabel, { marginTop: 6 }]}>Grupo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[{ id: 'todos', label: 'Todos' }, ...GRUPOS].map(g => (
                <TouchableOpacity key={g.id} style={[s.filterChip, filtroGrupo === g.id && s.filterChipSel]} onPress={() => setFiltroGrupo(g.id)}>
                  <Text style={[s.filterText, filtroGrupo === g.id && s.filterTextSel]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={[s.formLabel, { marginTop: 6 }]}>Plano</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[{ id: 'todos', label: 'Todos' }, ...PLANOS.map(p => ({ id: String(p.id), label: p.label }))].map(p => (
                <TouchableOpacity key={p.id} style={[s.filterChip, filtroPlano === p.id && s.filterChipSel]} onPress={() => setFiltroPlano(p.id)}>
                  <Text style={[s.filterText, filtroPlano === p.id && s.filterTextSel]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {listaFiltrada.length === 0 && (
          <Text style={s.emptyText}>Nenhum conteúdo nesta categoria ainda.</Text>
        )}

        {listaFiltrada.map(c => {
          const tipoObj = TIPOS.find(t => t.id === c.tipo);
          const grupoObj = GRUPOS.find(g => g.id === c.grupo);
          const planoObj = PLANOS.find(p => p.id === c.plano);
          const corPlano = PLANO_CORES[c.plano] ?? colors.lav4;
          return (
            <Card key={c.id} style={s.item}>
              <View style={s.itemIcon}>
                <Ionicons name={tipoObj?.icon || 'document-outline'} size={16} color={colors.lav5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitulo}>{c.titulo}</Text>
                <View style={{ flexDirection: 'row', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                  {grupoObj && <Text style={s.itemTag}>{grupoObj.label}</Text>}
                  {planoObj && (
                    <Text style={[s.itemTag, { backgroundColor: corPlano + '22', color: corPlano }]}>
                      {planoObj.label}
                    </Text>
                  )}
                  {(c.emocoes || []).map(eid => {
                    const eObj = EMOCOES_CHECKIN.find(e => e.id === eid);
                    return eObj ? (
                      <Text key={eid} style={[s.itemTag, { backgroundColor: '#E8E0F0', color: '#8060A0' }]}>
                        {eObj.label}
                      </Text>
                    ) : null;
                  })}
                  {(c.tags || []).map(tag => (
                    <Text key={tag} style={[s.itemTag, { backgroundColor: colors.peach + '33', color: colors.peach2 }]}>
                      {tag}
                    </Text>
                  ))}
                </View>
                {c.descricao ? <Text style={s.itemDesc} numberOfLines={1}>{c.descricao}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => handleRemover(c.id)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={17} color={colors.peach2} />
              </TouchableOpacity>
            </Card>
          );
        })}
      </ScrollView>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: spacing.sm },
  formLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 6, marginTop: spacing.sm },
  required: { color: colors.rose },
  optional: { color: colors.tl, fontSize: 11 },

  filaActions: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  filaBtn: {
    flex: 1, alignItems: 'center', gap: 4, padding: spacing.md,
    borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lav3,
    backgroundColor: colors.lav1,
  },
  filaBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav5, textAlign: 'center' },
  filaBtnHint: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, textAlign: 'center' },
  filaEmpty: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', paddingVertical: spacing.md },

  itemCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    marginBottom: 8, overflow: 'hidden', backgroundColor: colors.bg,
  },
  itemCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: spacing.md, backgroundColor: colors.card,
  },
  itemCardTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  itemRemoveBtn: { padding: 4 },
  itemBody: { padding: spacing.md, gap: 0 },
  itemErro: { fontFamily: fonts.body, fontSize: 11, color: colors.roseFg, marginTop: 6 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.bg, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  chipText: { fontFamily: fonts.body, fontSize: 11, color: colors.tm },
  chipTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  fileChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.lav1, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.lav3,
    paddingHorizontal: spacing.sm, paddingVertical: 8, marginTop: spacing.sm,
  },
  fileChipText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.lav6 },

  listHeader: { marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: 8 },
  filterChip: {
    backgroundColor: colors.bg, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 4, paddingHorizontal: 10,
  },
  filterChipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  filterText: { fontFamily: fonts.body, fontSize: 11, color: colors.tm },
  filterTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, marginBottom: spacing.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  itemIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  itemTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  itemTag: { fontFamily: fonts.body, fontSize: 10, color: colors.tm, backgroundColor: colors.lav1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  itemDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginTop: 2 },
});
