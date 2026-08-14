import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';

const TIPOS = [
  { id: 'audio', label: '🎧 Áudio', icon: '🎧' },
  { id: 'video', label: '▶️ Vídeo', icon: '▶️' },
  { id: 'documento', label: '📄 Documento', icon: '📄' },
  { id: 'link', label: '🔗 Link', icon: '🔗' },
];

const GRUPOS = [
  { id: 'acolhimento', label: '💜 Acolhimento' },
  { id: 'noturno', label: '🌙 Noturno' },
  { id: 'complementar', label: '✨ Complementar' },
];

const PLANOS = [
  { id: 0, label: 'Perceber (grátis)' },
  { id: 1, label: 'Acolher' },
  { id: 2, label: 'Compreender' },
  { id: 3, label: 'Evoluir' },
];

const EMOCOES = [
  { id: 'triste', label: 'Triste' }, { id: 'saudade', label: 'Saudade' },
  { id: 'sozinho', label: 'Sozinho' }, { id: 'medo', label: 'Medo' },
  { id: 'culpado', label: 'Culpado' }, { id: 'ansioso', label: 'Ansioso' },
  { id: 'raiva', label: 'Raiva' }, { id: 'desanimado', label: 'Desanimado' },
  { id: 'grato', label: 'Grato' }, { id: 'tranquilo', label: 'Em paz' },
  { id: 'esperancoso', label: 'Esperançoso' }, { id: 'alegre', label: 'Alegre' },
];

const FORM_INIT = { titulo: '', descricao: '', tipo: 'audio', grupo: 'acolhimento', url: '', plano: 0, emocoes: [], ativo: true };

export default function Conteudos({ showToast }) {
  const [itens, setItens] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(FORM_INIT);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = query(collection(db, 'conteudos'), orderBy('criadoEm', 'desc'));
    return onSnapshot(ref, snap => {
      setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  const openNew = () => { setForm(FORM_INIT); setEditId(null); setShowModal(true); };
  const openEdit = (item) => {
    setForm({
      titulo: item.titulo || '', descricao: item.descricao || '',
      tipo: item.tipo || 'audio', grupo: item.grupo || 'acolhimento',
      url: item.url || '', plano: item.plano ?? 0,
      emocoes: item.emocoes || [], ativo: item.ativo !== false,
    });
    setEditId(item.id);
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditId(null); setForm(FORM_INIT); };

  const salvar = async () => {
    if (!form.titulo.trim()) { showToast('Informe o título.', 'error'); return; }
    if (!form.url.trim()) { showToast('Informe a URL ou link.', 'error'); return; }
    setSaving(true);
    try {
      const data = { ...form };
      if (editId) {
        await updateDoc(doc(db, 'conteudos', editId), data);
        showToast('Conteúdo atualizado!');
      } else {
        await addDoc(collection(db, 'conteudos'), { ...data, criadoEm: serverTimestamp() });
        showToast('Conteúdo adicionado!');
      }
      closeModal();
    } catch { showToast('Erro ao salvar.', 'error'); }
    setSaving(false);
  };

  const excluir = async (item) => {
    if (!window.confirm(`Excluir "${item.titulo}"?`)) return;
    await deleteDoc(doc(db, 'conteudos', item.id));
    showToast('Excluído.');
  };

  const toggleAtivo = (item) => {
    updateDoc(doc(db, 'conteudos', item.id), { ativo: item.ativo === false });
  };

  const lista = filtroGrupo === 'todos' ? itens : itens.filter(i => i.grupo === filtroGrupo);

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">📚 Conteúdos</h1>
          <p className="screen-sub">Áudios, vídeos e documentos disponíveis no app.</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Novo conteúdo</button>
      </div>

      <div className="filter-row">
        <button className={`chip ${filtroGrupo === 'todos' ? 'chip-active' : ''}`} onClick={() => setFiltroGrupo('todos')}>Todos ({itens.length})</button>
        {GRUPOS.map(g => (
          <button key={g.id} className={`chip ${filtroGrupo === g.id ? 'chip-active' : ''}`} onClick={() => setFiltroGrupo(g.id)}>
            {g.label} ({itens.filter(i => i.grupo === g.id).length})
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <p>Nenhum conteúdo encontrado.</p>
        </div>
      ) : (
        <div className="list-grid">
          {lista.map(item => (
            <div key={item.id} className={`list-card ${item.ativo === false ? 'inactive' : ''}`}>
              <div className="list-card-icon">{TIPOS.find(t => t.id === item.tipo)?.icon || '📄'}</div>
              <div className="list-card-body">
                <div className="list-card-title">{item.titulo}</div>
                {item.descricao && <div className="list-card-desc">{item.descricao}</div>}
                <div className="list-card-url">{item.url}</div>
                <div className="list-card-badges">
                  <span className="badge">{TIPOS.find(t => t.id === item.tipo)?.label.split(' ').slice(1).join(' ') || item.tipo}</span>
                  <span className="badge">{GRUPOS.find(g => g.id === item.grupo)?.label.split(' ').slice(1).join(' ') || item.grupo}</span>
                  <span className="badge">{PLANOS.find(p => p.id === item.plano)?.label || `Plano ${item.plano}`}</span>
                  {item.ativo === false && <span className="badge badge-inactive">Inativo</span>}
                  {item.emocoes?.length > 0 && <span className="badge" style={{ background: '#FFF0D8', color: '#8A5B00' }}>{item.emocoes.length} emoção(ões)</span>}
                </div>
              </div>
              <div className="list-card-actions">
                <button className="icon-btn" onClick={() => toggleAtivo(item)} title={item.ativo === false ? 'Ativar' : 'Desativar'}>
                  {item.ativo === false ? '👁️' : '🔕'}
                </button>
                <button className="icon-btn" onClick={() => openEdit(item)} title="Editar">✏️</button>
                <button className="icon-btn icon-btn-delete" onClick={() => excluir(item)} title="Excluir">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? '✏️ Editar conteúdo' : '✨ Novo conteúdo'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field-row">
                <div className="field-group">
                  <label>Título *</label>
                  <input type="text" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Nome do conteúdo" autoFocus />
                </div>
                <div className="field-group">
                  <label>URL / Link *</label>
                  <input type="url" value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://..." />
                </div>
              </div>

              <div className="field-group">
                <label>Descrição</label>
                <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Breve descrição do conteúdo..." rows={2} />
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label>Tipo</label>
                  <div className="chip-row">
                    {TIPOS.map(t => (
                      <button key={t.id} className={`chip ${form.tipo === t.id ? 'chip-active' : ''}`} onClick={() => set('tipo', t.id)}>{t.label}</button>
                    ))}
                  </div>
                </div>
                <div className="field-group">
                  <label>Grupo</label>
                  <div className="chip-row">
                    {GRUPOS.map(g => (
                      <button key={g.id} className={`chip ${form.grupo === g.id ? 'chip-active' : ''}`} onClick={() => set('grupo', g.id)}>{g.label}</button>
                    ))}
                  </div>
                </div>
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
                <label>Emoções relacionadas</label>
                <div className="tag-group">
                  {EMOCOES.map(e => (
                    <button key={e.id} className={`tag ${form.emocoes.includes(e.id) ? 'active' : ''}`} onClick={() => toggleEmocao(e.id)}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="toggle-row">
                <label className="toggle">
                  <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <span style={{ fontSize: 13, color: 'var(--text-dark)' }}>Visível no app</span>
              </div>

              <div className="modal-footer">
                <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
                <button className="btn-primary" onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
