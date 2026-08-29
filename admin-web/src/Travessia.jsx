import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { IconClose, IconEdit, IconEye, IconEyeOff, IconLink, IconSpark, IconTrash } from './Icons';

const TIPOS = [
  { id: 'link', label: 'Link externo' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'video', label: 'Vídeo (YouTube)' },
  { id: 'audio', label: 'Áudio / Podcast' },
];

const FORM_INIT = { titulo: '', descricao: '', tipo: 'link', url: '', ativo: true };

export default function Travessia({ showToast }) {
  const [itens, setItens] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(FORM_INIT);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ref = query(collection(db, 'travessiaItens'), orderBy('ordem', 'asc'));
    return onSnapshot(ref, snap => setItens(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
  }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const openNew = () => { setForm(FORM_INIT); setEditId(null); setShowModal(true); };
  const openEdit = (item) => {
    setForm({ titulo: item.titulo || '', descricao: item.descricao || '', tipo: item.tipo || 'link', url: item.url || '', ativo: item.ativo !== false });
    setEditId(item.id);
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditId(null); setForm(FORM_INIT); };

  const salvar = async () => {
    if (!form.titulo.trim()) { showToast('Informe o título.', 'error'); return; }
    if (!form.url.trim()) { showToast('Informe a URL.', 'error'); return; }
    setSaving(true);
    try {
      if (editId) {
        await updateDoc(doc(db, 'travessiaItens', editId), form);
      } else {
        await addDoc(collection(db, 'travessiaItens'), { ...form, ordem: itens.length, criadoEm: serverTimestamp() });
      }
      showToast(editId ? 'Item atualizado!' : 'Item adicionado!');
      closeModal();
    } catch (e) {
      const msg = e?.code === 'permission-denied'
        ? 'Sem permissão. As regras do Firestore precisam ser implantadas (firebase deploy --only firestore:rules).'
        : 'Erro ao salvar: ' + (e?.message || '');
      showToast(msg, 'error');
    }
    setSaving(false);
  };

  const excluir = async (item) => {
    if (!window.confirm(`Excluir "${item.titulo}"?`)) return;
    try {
      await deleteDoc(doc(db, 'travessiaItens', item.id));
      showToast('Excluído.');
    } catch { showToast('Erro ao excluir.', 'error'); }
  };

  const toggleAtivo = (item) => {
    updateDoc(doc(db, 'travessiaItens', item.id), { ativo: item.ativo === false });
  };

  const mover = (item, dir) => {
    const idx = itens.findIndex(i => i.id === item.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= itens.length) return;
    const swap = itens[swapIdx];
    updateDoc(doc(db, 'travessiaItens', item.id), { ordem: swapIdx });
    updateDoc(doc(db, 'travessiaItens', swap.id), { ordem: idx });
  };

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Continue a Travessia</h1>
          <p className="screen-sub">Links, vídeos e conteúdos exibidos na seção de travessia do app.</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Novo item</button>
      </div>

      {itens.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconSpark size={34} /></div>
          <p>Nenhum item ainda.<br />Adicione terapia, livros, vídeos ou links.</p>
        </div>
      ) : (
        <div className="list-grid">
          {itens.map((item, idx) => (
            <div key={item.id} className={`list-card ${item.ativo === false ? 'inactive' : ''}`}>
              <div className="list-card-icon"><IconLink size={17} /></div>
              <div className="list-card-body">
                <div className="list-card-title">{item.titulo}</div>
                {item.descricao && <div className="list-card-desc">{item.descricao}</div>}
                <div className="list-card-url">{item.url}</div>
                <div className="list-card-badges">
                  <span className="badge">{TIPOS.find(t => t.id === item.tipo)?.label || item.tipo}</span>
                  {item.ativo === false && <span className="badge badge-inactive">Inativo</span>}
                </div>
              </div>
              <div className="list-card-actions">
                <button className="icon-btn" onClick={() => mover(item, -1)} disabled={idx === 0} title="Subir"></button>
                <button className="icon-btn" onClick={() => mover(item, 1)} disabled={idx === itens.length - 1} title="Descer"></button>
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
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Editar item' : 'Novo item da Travessia'}</h2>
              <button className="modal-close" onClick={closeModal}><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Título *</label>
                <input type="text" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex: Terapia Integrativa" autoFocus />
              </div>
              <div className="field-group">
                <label>Descrição / subtítulo</label>
                <input type="text" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Ex: Agende pelo WhatsApp" />
              </div>
              <div className="field-group">
                <label>URL / Link *</label>
                <input type="url" value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://..." />
                <span className="field-hint">WhatsApp: https://wa.me/5511999999999?text=Olá</span>
              </div>
              <div className="field-group">
                <label>Tipo</label>
                <div className="chip-row">
                  {TIPOS.map(t => (
                    <button key={t.id} className={`chip ${form.tipo === t.id ? 'chip-active' : ''}`} onClick={() => set('tipo', t.id)}>
                      {t.label}
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
                <button className="btn-primary" onClick={salvar} disabled={saving}>
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
