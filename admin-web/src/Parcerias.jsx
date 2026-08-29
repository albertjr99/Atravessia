import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  serverTimestamp, updateDoc,
} from 'firebase/firestore';

const CATEGORIAS = [
  { id: 'saúde física', label: '🏃 Saúde física' },
  { id: 'bem-estar', label: '🧘 Bem-estar' },
  { id: 'ambiente', label: '🏠 Ambiente' },
  { id: 'espiritualidade', label: '✨ Espiritualidade' },
  { id: 'trabalho', label: '💼 Trabalho' },
  { id: 'estudos', label: '📖 Estudos' },
  { id: 'relacionamentos', label: '💞 Relacionamentos' },
  { id: 'família', label: '👨‍👩‍👧 Família' },
  { id: 'outros', label: '🔖 Outros' },
];

function novoForm() {
  return { titulo: '', descricao: '', link: '', imagemUrl: '', categorias: [], ativo: true };
}

export default function Parcerias({ showToast }) {
  const [parcerias, setParcerias] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(novoForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');

  useEffect(() => {
    return onSnapshot(collection(db, 'parcerias'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));
      setParcerias(docs);
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleCat = (id) => {
    setForm(prev => ({
      ...prev,
      categorias: prev.categorias.includes(id)
        ? prev.categorias.filter(c => c !== id)
        : [...prev.categorias, id],
    }));
  };

  const openNew = () => { setForm(novoForm()); setEditId(null); setShowModal(true); };
  const openEdit = (item) => {
    setForm({
      titulo: item.titulo || '',
      descricao: item.descricao || '',
      link: item.link || '',
      imagemUrl: item.imagemUrl || '',
      categorias: item.categorias || [],
      ativo: item.ativo !== false,
    });
    setEditId(item.id);
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditId(null); setForm(novoForm()); };

  const salvar = async () => {
    if (!form.titulo.trim()) { showToast('Informe o título.', 'error'); return; }
    if (form.categorias.length === 0) { showToast('Selecione ao menos uma categoria.', 'error'); return; }
    setSaving(true);
    try {
      const data = { ...form };
      if (editId) {
        await updateDoc(doc(db, 'parcerias', editId), data);
        showToast('Parceria atualizada!');
      } else {
        await addDoc(collection(db, 'parcerias'), { ...data, criadoEm: serverTimestamp() });
        showToast('Parceria adicionada!');
      }
      closeModal();
    } catch { showToast('Erro ao salvar.', 'error'); }
    setSaving(false);
  };

  const excluir = async (item) => {
    if (!window.confirm(`Excluir "${item.titulo}"?`)) return;
    try {
      await deleteDoc(doc(db, 'parcerias', item.id));
      showToast('Parceria excluída.');
    } catch { showToast('Erro ao excluir.', 'error'); }
  };

  const toggleAtivo = (item) => {
    updateDoc(doc(db, 'parcerias', item.id), { ativo: item.ativo === false });
  };

  const lista = filtro === 'todas'
    ? parcerias
    : parcerias.filter(p => (p.categorias || []).includes(filtro));

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">🤝 Parcerias e Benefícios</h1>
          <p className="screen-sub">Gerenciar parcerias e descontos exclusivos exibidos no aplicativo.</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Nova parceria</button>
      </div>

      <div className="filter-row" style={{ flexWrap: 'wrap' }}>
        <button className={`chip ${filtro === 'todas' ? 'chip-active' : ''}`} onClick={() => setFiltro('todas')}>
          Todas ({parcerias.length})
        </button>
        {CATEGORIAS.map(c => {
          const count = parcerias.filter(p => (p.categorias || []).includes(c.id)).length;
          return (
            <button key={c.id} className={`chip ${filtro === c.id ? 'chip-active' : ''}`} onClick={() => setFiltro(c.id)}>
              {c.label} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {lista.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🤝</div>
          <p>Nenhuma parceria{filtro !== 'todas' ? ` na categoria selecionada` : ''} ainda.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lista.map(item => (
            <div key={item.id} className="card" style={{
              display: 'flex', gap: 16, alignItems: 'flex-start',
              opacity: item.ativo === false ? 0.55 : 1,
              borderLeft: item.ativo === false ? '3px solid var(--border)' : '3px solid var(--primary)',
            }}>
              {item.imagemUrl ? (
                <img src={item.imagemUrl} alt={item.titulo}
                  style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: 10, flexShrink: 0,
                  background: 'var(--lav-light, #F0EDFB)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28,
                }}>🤝</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-dark)', marginBottom: 4 }}>
                  {item.titulo}
                  {item.ativo === false && <span className="badge badge-inactive" style={{ marginLeft: 8 }}>Inativo</span>}
                </div>
                {item.descricao && (
                  <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 6, lineHeight: 1.5 }}>
                    {item.descricao}
                  </div>
                )}
                {item.link && (
                  <a href={item.link.startsWith('http') ? item.link : `https://${item.link}`}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: 'var(--primary)', wordBreak: 'break-all' }}>
                    🔗 {item.link}
                  </a>
                )}
                {(item.categorias || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    {item.categorias.map(c => (
                      <span key={c} style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 999,
                        background: '#EDE9FB', color: '#5B3D9E',
                      }}>
                        {CATEGORIAS.find(cat => cat.id === c)?.label || c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="icon-btn" onClick={() => toggleAtivo(item)}
                  title={item.ativo === false ? 'Ativar' : 'Desativar'}>
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
              <h2>{editId ? '✏️ Editar parceria' : '🤝 Nova parceria'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Título *</label>
                <input type="text" value={form.titulo}
                  onChange={e => set('titulo', e.target.value)}
                  placeholder="Nome da empresa / parceria" autoFocus />
              </div>

              <div className="field-group">
                <label>Descrição</label>
                <textarea value={form.descricao}
                  onChange={e => set('descricao', e.target.value)}
                  placeholder="Descreva o benefício oferecido..." rows={3} />
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label>Link / URL</label>
                  <input type="url" value={form.link}
                    onChange={e => set('link', e.target.value)}
                    placeholder="https://..." />
                </div>
                <div className="field-group">
                  <label>URL da imagem (capa)</label>
                  <input type="url" value={form.imagemUrl}
                    onChange={e => set('imagemUrl', e.target.value)}
                    placeholder="https://..." />
                </div>
              </div>

              {form.imagemUrl && (
                <div style={{ marginBottom: 12 }}>
                  <img src={form.imagemUrl} alt="preview"
                    style={{ height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                </div>
              )}

              <div className="field-group">
                <label>Categorias *</label>
                <span className="field-hint">Usadas para filtrar no aplicativo.</span>
                <div className="tag-group" style={{ marginTop: 8 }}>
                  {CATEGORIAS.map(c => (
                    <button key={c.id}
                      className={`tag ${form.categorias.includes(c.id) ? 'active' : ''}`}
                      onClick={() => toggleCat(c.id)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.ativo}
                    onChange={e => set('ativo', e.target.checked)}
                    style={{ width: 16, height: 16 }} />
                  Parceria ativa (visível no aplicativo)
                </label>
              </div>

              <div className="modal-footer">
                <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
                <button className="btn-primary" onClick={salvar} disabled={saving}>
                  {saving ? '⏳ Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
