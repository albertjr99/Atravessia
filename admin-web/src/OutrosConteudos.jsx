import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from './firebase';
import {
  collection, addDoc, deleteDoc, deleteField, doc, onSnapshot,
  serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  IconAlert, IconAudio, IconCamera, IconClose, IconDoc, IconEdit, IconEye,
  IconEyeOff, IconLink, IconPlay, IconSpark, IconTrash,
} from './Icons';
import { EMOCOES, PLANOS_NIVEIS, emocaoPorId, ordenarPor } from './emocoes';

// "Outros conteúdos" — coleção `conteudos`. Apenas imagem, link e texto:
// áudios têm seção própria (Áudios Check-in). O campo `grupo` não existe mais.
const TIPOS = [
  { id: 'imagem', label: 'Imagem', Icon: IconCamera },
  { id: 'link',   label: 'Link',   Icon: IconLink },
  { id: 'texto',  label: 'Texto',  Icon: IconDoc },
];

// Tipos de itens antigos que continuam listados (só desativar/excluir).
const TIPOS_ANTIGOS = {
  audio:     { label: 'Áudio',     Icon: IconAudio },
  video:     { label: 'Vídeo',     Icon: IconPlay },
  documento: { label: 'Documento', Icon: IconDoc },
};

const TIPOS_VALIDOS = TIPOS.map(t => t.id);
const MAX_IMAGEM_MB = 10;

const FORM_INIT = {
  titulo: '', descricao: '', tipo: 'imagem',
  url: '', imgUrl: '', storagePath: '', texto: '',
  plano: 0, emocoes: [], ativo: true,
};

function normalizarUrl(u) {
  const limpo = (u || '').trim();
  if (!limpo) return '';
  return /^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`;
}

const ehAntigo = (item) => !TIPOS_VALIDOS.includes(item.tipo);

export default function OutrosConteudos({ showToast }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erroLista, setErroLista] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(FORM_INIT);
  const [editId, setEditId] = useState(null);
  const [pathOriginal, setPathOriginal] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [previa, setPrevia] = useState('');
  const [saving, setSaving] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Sem orderBy: ele exclui documentos sem o campo e um erro mata o listener.
  useEffect(() => {
    return onSnapshot(collection(db, 'conteudos'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
      setItens(ordenarPor(docs, 'criadoEm', 'desc'));
      setErroLista('');
      setLoading(false);
    }, (e) => {
      setErroLista(e?.message || 'Erro desconhecido.');
      setLoading(false);
    });
  }, []);

  // Libera a URL temporária da prévia local.
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa); }, [previa]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleEmocao = (id) => {
    setForm(prev => ({
      ...prev,
      emocoes: prev.emocoes.includes(id) ? prev.emocoes.filter(e => e !== id) : [...prev.emocoes, id],
    }));
  };

  const limparArquivo = () => { setArquivo(null); setPrevia(''); };

  const openNew = () => {
    setForm(FORM_INIT); setEditId(null); setPathOriginal(''); limparArquivo(); setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({
      titulo: item.titulo || '',
      descricao: item.descricao || '',
      tipo: TIPOS_VALIDOS.includes(item.tipo) ? item.tipo : 'link',
      // A URL da imagem fica separada da do link para não virar "link" ao trocar o tipo.
      url: item.tipo === 'imagem' ? '' : (item.url || ''),
      imgUrl: item.tipo === 'imagem' ? (item.url || '') : '',
      storagePath: item.storagePath || '',
      texto: item.texto || '',
      plano: typeof item.plano === 'number' ? item.plano : 0,
      emocoes: Array.isArray(item.emocoes) ? item.emocoes : [],
      ativo: item.ativo !== false,
    });
    setEditId(item.id);
    setPathOriginal(item.storagePath || '');
    limparArquivo();
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false); setEditId(null); setForm(FORM_INIT); setPathOriginal(''); limparArquivo();
  };

  const escolherArquivo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Escolha um arquivo de imagem (JPG, PNG, WEBP…).', 'error'); return; }
    if (file.size > MAX_IMAGEM_MB * 1024 * 1024) { showToast(`A imagem deve ter no máximo ${MAX_IMAGEM_MB} MB.`, 'error'); return; }
    setArquivo(file);
    setPrevia(URL.createObjectURL(file));
  };

  const apagarArquivoStorage = async (path) => {
    if (!path) return;
    try {
      await deleteObject(sRef(storage, path));
    } catch (e) {
      // Arquivo já inexistente não é problema; outros erros ficam visíveis.
      if (e?.code !== 'storage/object-not-found') {
        showToast('O item foi salvo, mas a imagem antiga não pôde ser apagada do armazenamento: ' + (e?.message || ''), 'error');
      }
    }
  };

  const salvar = async () => {
    const titulo = form.titulo.trim();
    if (!titulo) { showToast('Informe o título.', 'error'); return; }
    if (!TIPOS_VALIDOS.includes(form.tipo)) { showToast('Escolha o tipo: imagem, link ou texto.', 'error'); return; }

    const url = normalizarUrl(form.url);
    if (form.tipo === 'imagem' && !arquivo && !form.imgUrl) { showToast('Escolha a imagem a ser enviada.', 'error'); return; }
    if (form.tipo === 'link' && !url) { showToast('Informe o endereço (URL) do link.', 'error'); return; }
    if (form.tipo === 'texto' && !form.texto.trim()) { showToast('Escreva o texto do conteúdo.', 'error'); return; }

    setSaving(true);
    let novoPath = '';
    try {
      const dados = {
        titulo,
        descricao: form.descricao.trim(),
        tipo: form.tipo,
        plano: Number(form.plano) || 0,
        // Mantém a ordem canônica das emoções e descarta ids desconhecidos.
        emocoes: EMOCOES.map(e => e.id).filter(id => form.emocoes.includes(id)),
        ativo: !!form.ativo,
      };

      if (form.tipo === 'imagem') {
        let urlImg = form.imgUrl;
        let pathImg = form.storagePath;
        if (arquivo) {
          novoPath = `conteudos/${Date.now()}_${arquivo.name.replace(/\s+/g, '_')}`;
          const r = sRef(storage, novoPath);
          await uploadBytes(r, arquivo, { contentType: arquivo.type });
          urlImg = await getDownloadURL(r);
          pathImg = novoPath;
        }
        dados.url = urlImg;
        dados.storagePath = pathImg;
      } else if (form.tipo === 'link') {
        dados.url = url;
      } else {
        dados.texto = form.texto.trim();
      }

      if (editId) {
        // Remove campos que não pertencem ao tipo atual (e o antigo `grupo`).
        const limpar = { grupo: deleteField() };
        if (form.tipo !== 'imagem') limpar.storagePath = deleteField();
        if (form.tipo === 'texto') limpar.url = deleteField();
        if (form.tipo !== 'texto') limpar.texto = deleteField();
        await updateDoc(doc(db, 'conteudos', editId), { ...limpar, ...dados, atualizadoEm: serverTimestamp() });
        // Imagem substituída ou tipo trocado: apaga o arquivo anterior.
        if (pathOriginal && pathOriginal !== dados.storagePath) await apagarArquivoStorage(pathOriginal);
        showToast('Conteúdo atualizado!');
      } else {
        await addDoc(collection(db, 'conteudos'), { ...dados, criadoEm: serverTimestamp() });
        showToast('Conteúdo adicionado!');
      }
      setSaving(false);
      setShowModal(false); setEditId(null); setForm(FORM_INIT); setPathOriginal(''); limparArquivo();
    } catch (e) {
      // Se a imagem subiu mas o documento falhou, não deixa arquivo órfão.
      if (novoPath) {
        try { await deleteObject(sRef(storage, novoPath)); } catch (e2) { console.warn('Falha ao limpar upload órfão:', e2); }
      }
      showToast('Erro ao salvar: ' + (e?.message || 'tente novamente.'), 'error');
      setSaving(false);
    }
  };

  const excluir = async (item) => {
    if (!window.confirm(`Excluir "${item.titulo || 'sem título'}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteDoc(doc(db, 'conteudos', item.id));
      if (item.storagePath) await apagarArquivoStorage(item.storagePath);
      showToast('Conteúdo excluído.');
    } catch (e) {
      showToast('Erro ao excluir: ' + (e?.message || ''), 'error');
    }
  };

  const toggleAtivo = async (item) => {
    try {
      await updateDoc(doc(db, 'conteudos', item.id), { ativo: item.ativo === false, atualizadoEm: serverTimestamp() });
    } catch (e) {
      showToast('Erro ao alterar a visibilidade: ' + (e?.message || ''), 'error');
    }
  };

  const contagem = useMemo(() => {
    const c = { todos: itens.length, antigos: 0, ativos: 0, inativos: 0 };
    TIPOS.forEach(t => { c[t.id] = 0; });
    itens.forEach(i => {
      if (ehAntigo(i)) c.antigos += 1; else c[i.tipo] += 1;
      if (i.ativo === false) c.inativos += 1; else c.ativos += 1;
    });
    return c;
  }, [itens]);

  const lista = itens.filter(i => {
    if (filtroTipo === 'antigos' && !ehAntigo(i)) return false;
    if (filtroTipo !== 'todos' && filtroTipo !== 'antigos' && i.tipo !== filtroTipo) return false;
    if (filtroStatus === 'ativos' && i.ativo === false) return false;
    if (filtroStatus === 'inativos' && i.ativo !== false) return false;
    return true;
  });

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  const previaImagem = form.tipo === 'imagem' ? (previa || form.imgUrl) : '';

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Outros conteúdos</h1>
          <p className="screen-sub">Imagens, links e textos de apoio para as usuárias.</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Novo conteúdo</button>
      </div>

      <div className="aln-ajuda">
        <IconSpark size={16} />
        <div>
          Estes conteúdos aparecem para a usuária como <strong>sugestões no check-in</strong>, conforme a emoção
          que ela escolher, e podem ser guardados na <strong>área de favoritos</strong>. Marque as emoções em que
          cada conteúdo deve ser sugerido e o plano mínimo para acessá-lo. Áudios ficam na aba <strong>Áudios Check-in</strong>.
        </div>
      </div>

      {erroLista && (
        <div className="aln-erro">
          <IconAlert size={16} />
          <span>Não foi possível carregar os conteúdos: {erroLista}</span>
        </div>
      )}

      <div className="aln-filtros">
        <div className="filter-row" style={{ marginBottom: 0 }}>
          <button className={`chip ${filtroTipo === 'todos' ? 'chip-active' : ''}`} onClick={() => setFiltroTipo('todos')}>Todos ({contagem.todos})</button>
          {TIPOS.map(t => (
            <button key={t.id} className={`chip ${filtroTipo === t.id ? 'chip-active' : ''}`} onClick={() => setFiltroTipo(t.id)}>
              {t.label} ({contagem[t.id]})
            </button>
          ))}
          {contagem.antigos > 0 && (
            <button className={`chip ${filtroTipo === 'antigos' ? 'chip-active' : ''}`} onClick={() => setFiltroTipo('antigos')}>
              Formato antigo ({contagem.antigos})
            </button>
          )}
        </div>
        <div className="filter-row" style={{ marginBottom: 0 }}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'ativos', label: `Ativos (${contagem.ativos})` },
            { id: 'inativos', label: `Inativos (${contagem.inativos})` },
          ].map(s => (
            <button key={s.id} className={`chip ${filtroStatus === s.id ? 'chip-active' : ''}`} onClick={() => setFiltroStatus(s.id)}>{s.label}</button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconSpark size={34} /></div>
          <p>{itens.length === 0 ? 'Nenhum conteúdo cadastrado ainda.' : 'Nenhum conteúdo com esses filtros.'}</p>
        </div>
      ) : (
        <div className="list-grid">
          {lista.map(item => {
            const antigo = ehAntigo(item);
            const tipoInfo = antigo
              ? (TIPOS_ANTIGOS[item.tipo] || { label: item.tipo || 'Sem tipo', Icon: IconDoc })
              : TIPOS.find(t => t.id === item.tipo);
            const TipoIcon = tipoInfo.Icon;
            const plano = PLANOS_NIVEIS.find(p => p.id === item.plano);
            const emos = (item.emocoes || []).map(id => emocaoPorId(id)?.label || id);
            return (
              <div key={item.id} className={`list-card ${item.ativo === false ? 'inactive' : ''}`}>
                {item.tipo === 'imagem' && item.url
                  ? <img className="aln-thumb" src={item.url} alt={item.titulo || 'Imagem'} loading="lazy" />
                  : <div className="list-card-icon"><TipoIcon size={17} /></div>}
                <div className="list-card-body">
                  <div className="list-card-title">{item.titulo || '(sem título)'}</div>
                  {item.descricao && <div className="list-card-desc">{item.descricao}</div>}
                  {item.tipo === 'texto' && item.texto && <div className="aln-texto-previa">{item.texto}</div>}
                  {(item.tipo === 'link' || antigo) && item.url && (
                    <a className="list-card-url" href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
                  )}
                  {antigo && (
                    <div className="aln-antigo-aviso">
                      Formato antigo ({tipoInfo.label.toLowerCase()}). Áudios agora ficam em Áudios Check-in.
                      Este item pode ser desativado ou excluído, mas não editado.
                    </div>
                  )}
                  <div className="list-card-badges">
                    <span className="badge">{tipoInfo.label}</span>
                    {antigo && <span className="badge aln-badge-antigo">Formato antigo</span>}
                    <span className="badge">{plano?.label || `Plano ${item.plano ?? 0}`}</span>
                    {item.ativo === false && <span className="badge badge-inactive">Inativo</span>}
                    {emos.length > 0 && (
                      <span className="badge aln-badge-emocao" title={emos.join(', ')}>
                        {emos.length <= 3 ? emos.join(' · ') : `${emos.length} emoções`}
                      </span>
                    )}
                    {emos.length === 0 && !antigo && <span className="badge badge-inactive">Sem emoção (só favoritos)</span>}
                  </div>
                </div>
                <div className="list-card-actions">
                  <button className="icon-btn" onClick={() => toggleAtivo(item)} title={item.ativo === false ? 'Ativar' : 'Desativar'}>
                    {item.ativo === false ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                  {!antigo && (
                    <button className="icon-btn" onClick={() => openEdit(item)} title="Editar"><IconEdit size={16} /></button>
                  )}
                  <button className="icon-btn icon-btn-delete" onClick={() => excluir(item)} title="Excluir"><IconTrash size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Editar conteúdo' : 'Novo conteúdo'}</h2>
              <button className="modal-close" onClick={closeModal}><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Tipo</label>
                <div className="chip-row" style={{ marginBottom: 0 }}>
                  {TIPOS.map(t => (
                    <button key={t.id} className={`chip ${form.tipo === t.id ? 'chip-active' : ''}`} onClick={() => set('tipo', t.id)}>{t.label}</button>
                  ))}
                </div>
              </div>

              <div className="field-group">
                <label>Título *</label>
                <input type="text" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Nome do conteúdo" autoFocus />
              </div>

              <div className="field-group">
                <label>Descrição <span className="aln-opcional">(opcional, resumo curto)</span></label>
                <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Uma ou duas frases sobre o conteúdo..." rows={2} />
              </div>

              {form.tipo === 'imagem' && (
                <div className="field-group">
                  <label>Imagem *</label>
                  {previaImagem && (
                    <div className="aln-img-previa">
                      <img src={previaImagem} alt="Prévia da imagem" />
                    </div>
                  )}
                  <label className="file-upload-area">
                    <input type="file" accept="image/*" onChange={escolherArquivo} />
                    <div className="file-upload-icon"><IconCamera size={22} /></div>
                    <div className="file-upload-text">
                      {arquivo ? arquivo.name : previaImagem ? 'Trocar imagem' : 'Escolher imagem'}
                    </div>
                    <div className="file-upload-sub">JPG, PNG ou WEBP · até {MAX_IMAGEM_MB} MB · enviada ao salvar</div>
                  </label>
                </div>
              )}

              {form.tipo === 'link' && (
                <div className="field-group">
                  <label>Endereço do link *</label>
                  <input type="url" value={form.url} onChange={e => set('url', e.target.value)} onBlur={e => set('url', normalizarUrl(e.target.value))} placeholder="https://..." />
                  <span className="field-hint">Se faltar, o "https://" é acrescentado automaticamente.</span>
                </div>
              )}

              {form.tipo === 'texto' && (
                <div className="field-group">
                  <label>Texto *</label>
                  <textarea value={form.texto} onChange={e => set('texto', e.target.value)} placeholder="Escreva aqui o conteúdo completo..." rows={9} />
                  <span className="field-hint">Quebras de linha são mantidas no app.</span>
                </div>
              )}

              <div className="field-group">
                <label>Plano mínimo de acesso</label>
                <div className="chip-row" style={{ marginBottom: 0 }}>
                  {PLANOS_NIVEIS.map(p => (
                    <button key={p.id} className={`chip ${form.plano === p.id ? 'chip-active' : ''}`} onClick={() => set('plano', p.id)}>{p.label}</button>
                  ))}
                </div>
              </div>

              <div className="field-group">
                <label>Sugerir no check-in quando a usuária sentir</label>
                <div className="tag-group">
                  {EMOCOES.map(e => (
                    <button key={e.id} className={`tag ${form.emocoes.includes(e.id) ? 'active' : ''}`} onClick={() => toggleEmocao(e.id)}>
                      {e.label}
                    </button>
                  ))}
                </div>
                <span className="field-hint">Sem nenhuma emoção marcada, o conteúdo não é sugerido no check-in.</span>
              </div>

              <div className="toggle-row">
                <label className="toggle">
                  <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <span style={{ fontSize: 13, color: 'var(--text-dark)' }}>Visível no app</span>
              </div>

              <div className="modal-footer">
                <button className="btn-ghost" onClick={closeModal} disabled={saving}>Cancelar</button>
                <button className="btn-primary" onClick={salvar} disabled={saving}>
                  {saving ? (arquivo ? 'Enviando imagem...' : 'Salvando...') : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
