import React, { useState, useEffect } from 'react';
import { db, storage } from './firebase';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { IconAudio, IconClose, IconEdit, IconEye, IconEyeOff, IconPlay, IconSpark, IconTrash } from './Icons';

const EMOCOES = [
  { id: 'triste', label: 'Triste' }, { id: 'saudade', label: 'Saudade' },
  { id: 'sozinho', label: 'Sozinho' }, { id: 'medo', label: 'Medo' },
  { id: 'ansioso', label: 'Ansioso' }, { id: 'culpado', label: 'Culpado' },
  { id: 'raiva', label: 'Raiva' }, { id: 'desanimado', label: 'Desanimado' },
  { id: 'confuso', label: 'Confuso' },
];

const PLANOS = [
  { id: 0, label: 'Grátis' }, { id: 1, label: 'Acolher' },
  { id: 2, label: 'Compreender' }, { id: 3, label: 'Evoluir' },
];

function novoForm() {
  return { titulo: '', descricao: '', duracao: '', plano: 1, emocoes: [], url: '', storagePath: '' };
}

export default function Audios({ showToast }) {
  const [audios, setAudios] = useState([]);
  const [filtroEmocao, setFiltroEmocao] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(novoForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = query(collection(db, 'audiosAcolhimento'), orderBy('criadoEm', 'desc'));
    return onSnapshot(ref, snap => {
      setAudios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleEmocao = (id) => {
    setForm(prev => ({
      ...prev,
      emocoes: prev.emocoes.includes(id) ? prev.emocoes.filter(e => e !== id) : [...prev.emocoes, id],
    }));
  };

  const openNew = () => { setForm(novoForm()); setEditId(null); setShowModal(true); };
  const openEdit = (item) => {
    setForm({
      titulo: item.titulo || '', descricao: item.descricao || '',
      duracao: item.duracao || '', plano: item.plano ?? 1,
      emocoes: item.emocoes || [], url: item.url || '',
      storagePath: item.storagePath || '',
    });
    setEditId(item.id);
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditId(null); setForm(novoForm()); setUploadProgress(null); };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) { showToast('Selecione um arquivo de áudio.', 'error'); return; }

    const filename = `audios/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
    const storageRef = sRef(storage, filename);
    const task = uploadBytesResumable(storageRef, file);

    setUploadProgress(0);
    task.on('state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(pct);
      },
      () => { showToast('Erro no upload.', 'error'); setUploadProgress(null); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setForm(prev => ({ ...prev, url, storagePath: filename }));
        setUploadProgress(null);
        showToast('Áudio enviado com sucesso!');
      }
    );
  };

  const salvar = async () => {
    if (!form.titulo.trim()) { showToast('Informe o título.', 'error'); return; }
    if (!form.url.trim()) { showToast('Faça o upload do áudio ou informe a URL.', 'error'); return; }
    if (form.emocoes.length === 0) { showToast('Selecione ao menos uma emoção.', 'error'); return; }
    setSaving(true);
    try {
      const data = { ...form };
      if (editId) {
        await updateDoc(doc(db, 'audiosAcolhimento', editId), data);
        showToast('Áudio atualizado!');
      } else {
        await addDoc(collection(db, 'audiosAcolhimento'), { ...data, ativo: true, criadoEm: serverTimestamp() });
        showToast('Áudio adicionado!');
      }
      closeModal();
    } catch { showToast('Erro ao salvar.', 'error'); }
    setSaving(false);
  };

  const excluir = async (item) => {
    if (!window.confirm(`Excluir "${item.titulo}"?`)) return;
    try {
      if (item.storagePath) {
        try { await deleteObject(sRef(storage, item.storagePath)); } catch {}
      }
      await deleteDoc(doc(db, 'audiosAcolhimento', item.id));
      showToast('Áudio excluído.');
    } catch { showToast('Erro ao excluir.', 'error'); }
  };

  const toggleAtivo = (item) => {
    updateDoc(doc(db, 'audiosAcolhimento', item.id), { ativo: item.ativo === false });
  };

  const lista = filtroEmocao === 'todos' ? audios : audios.filter(a => a.emocoes?.includes(filtroEmocao));

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Áudios de Acolhimento</h1>
          <p className="screen-sub">Áudios exibidos no check-in de acordo com a emoção da usuária.</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Novo áudio</button>
      </div>

      <div className="filter-row" style={{ flexWrap: 'wrap' }}>
        <button className={`chip ${filtroEmocao === 'todos' ? 'chip-active' : ''}`} onClick={() => setFiltroEmocao('todos')}>Todos ({audios.length})
        </button>
        {EMOCOES.map(e => {
          const count = audios.filter(a => a.emocoes?.includes(e.id)).length;
          return (
            <button key={e.id} className={`chip ${filtroEmocao === e.id ? 'chip-active' : ''}`} onClick={() => setFiltroEmocao(e.id)}>
              {e.label} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {lista.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconSpark size={34} /></div>
          <p>Nenhum áudio{filtroEmocao !== 'todos' ? ` para a emoção "${EMOCOES.find(e => e.id === filtroEmocao)?.label}"` : ''} ainda.</p>
        </div>
      ) : (
        <div className="list-grid">
          {lista.map(item => (
            <div key={item.id} className={`audio-card ${item.ativo === false ? 'inactive' : ''}`}>
              <div className="audio-card-icon"><IconAudio size={18} /></div>
              <div className="audio-card-body">
                <div className="audio-card-title">{item.titulo}</div>
                {item.descricao && <div className="audio-card-desc">{item.descricao}</div>}
                <div className="audio-card-badges">
                  <span className="badge">{PLANOS.find(p => p.id === item.plano)?.label || `Plano ${item.plano}`}</span>
                  {item.duracao && <span className="badge" style={{ background: '#F0EDEB', color: 'var(--text-mid)' }}> {item.duracao}</span>}
                  {item.ativo === false && <span className="badge badge-inactive">Inativo</span>}
                </div>
                {item.emocoes?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {item.emocoes.map(e => (
                      <span key={e} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#FFF8E0', color: '#7A5C00' }}>
                        {EMOCOES.find(em => em.id === e)?.label || e}
                      </span>
                    ))}
                  </div>
                )}
                {item.url && <div className="audio-card-url">{item.url}</div>}
              </div>
              <div className="audio-card-actions">
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    <button className="icon-btn" title="Ouvir"><IconPlay size={15} /></button>
                  </a>
                )}
                <button className="icon-btn" onClick={() => toggleAtivo(item)} title={item.ativo === false ? 'Ativar' : 'Desativar'}>
                  {item.ativo === false ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
                <button className="icon-btn" onClick={() => openEdit(item)} title="Editar"><IconEdit size={16} /></button>
                <button className="icon-btn icon-btn-delete" onClick={() => excluir(item)} title="Excluir"><IconTrash size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Editar áudio' : 'Novo áudio de acolhimento'}</h2>
              <button className="modal-close" onClick={closeModal}><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              <div className="field-row">
                <div className="field-group">
                  <label>Título *</label>
                  <input type="text" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Nome do áudio" autoFocus />
                </div>
                <div className="field-group">
                  <label>Duração</label>
                  <input type="text" value={form.duracao} onChange={e => set('duracao', e.target.value)} placeholder="Ex: 8:30" />
                </div>
              </div>

              <div className="field-group">
                <label>Descrição</label>
                <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Breve descrição do áudio..." rows={2} />
              </div>

              <div className="field-group">
                <label>Fazer upload do arquivo de áudio</label>
                <label className="file-upload-area" htmlFor="audio-file">
                  <input id="audio-file" type="file" accept="audio/*" onChange={handleFileChange} />
                  <div className="file-upload-icon"></div>
                  <div className="file-upload-text">Clique para selecionar o arquivo</div>
                  <div className="file-upload-sub">MP3, M4A, WAV (máx. 50MB)</div>
                </label>
                {uploadProgress !== null && (
                  <div>
                    <div className="upload-progress">
                      <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-mid)' }}>{uploadProgress}% enviado...</span>
                  </div>
                )}
              </div>

              <div className="field-group">
                <label>Ou URL direta (YouTube, Podcast, etc.)</label>
                <input type="url" value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://..." />
                {form.url && <span className="field-hint">URL definida: {form.url.slice(0, 60)}...</span>}
              </div>

              <div className="field-group">
                <label>Plano mínimo de acesso</label>
                <div className="chip-row">
                  {PLANOS.map(p => (
                    <button key={p.id} className={`chip ${form.plano === p.id ? 'chip-active' : ''}`} onClick={() => set('plano', p.id)}>{p.label}</button>
                  ))}
                </div>
              </div>

              <div className="field-group">
                <label>Emoções associadas *</label>
                <span className="field-hint">Quando a usuária sentir essas emoções no check-in, este áudio poderá aparecer.</span>
                <div className="tag-group" style={{ marginTop: 8 }}>
                  {EMOCOES.map(e => (
                    <button key={e.id} className={`tag ${form.emocoes.includes(e.id) ? 'active' : ''}`} onClick={() => toggleEmocao(e.id)}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
                <button className="btn-primary" onClick={salvar} disabled={saving || uploadProgress !== null}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
