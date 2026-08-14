import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  orderBy, query, serverTimestamp, writeBatch,
} from 'firebase/firestore';

const VAZIO = { texto: '', autor: '', reflexao: '' };

export default function Frases({ showToast }) {
  const [frases, setFrases] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = query(collection(db, 'frases'), orderBy('criadoEm', 'asc'));
    return onSnapshot(ref, snap => {
      setFrases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const lista = useMemo(() => {
    return frases.filter(f => {
      const matchBusca = !busca || [f.texto, f.autor, f.reflexao]
        .some(v => v?.toLowerCase().includes(busca.toLowerCase()));
      const matchFiltro = filtro === 'todas' ? true
        : filtro === 'ativas' ? f.ativa !== false : f.ativa === false;
      return matchBusca && matchFiltro;
    });
  }, [frases, busca, filtro]);

  const totalAtivas = frases.filter(f => f.ativa !== false).length;

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const abrirAdicionar = () => { setForm(VAZIO); setModal({ mode: 'add' }); };
  const abrirEditar = (item) => {
    setForm({ texto: item.texto || '', autor: item.autor || '', reflexao: item.reflexao || '' });
    setModal({ mode: 'edit', item });
  };
  const fecharModal = () => { setModal(null); setForm(VAZIO); };

  const handleSalvar = async () => {
    if (!form.texto.trim()) { showToast('O texto da frase é obrigatório.', 'error'); return; }
    if (!form.reflexao.trim()) { showToast('A reflexão é obrigatória.', 'error'); return; }
    setSalvando(true);
    try {
      if (modal.mode === 'add') {
        await addDoc(collection(db, 'frases'), {
          texto: form.texto.trim(),
          autor: form.autor.trim() || 'Autor desconhecido',
          reflexao: form.reflexao.trim(),
          ativa: true,
          criadoEm: serverTimestamp(),
        });
        showToast('Frase adicionada!');
      } else {
        await updateDoc(doc(db, 'frases', modal.item.id), {
          texto: form.texto.trim(),
          autor: form.autor.trim() || 'Autor desconhecido',
          reflexao: form.reflexao.trim(),
        });
        showToast('Frase atualizada!');
      }
      fecharModal();
    } catch (e) {
      showToast('Erro ao salvar: ' + (e.message || ''), 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleToggle = (item) => {
    const novoEstado = item.ativa === false;
    updateDoc(doc(db, 'frases', item.id), { ativa: novoEstado });
    showToast(novoEstado ? 'Frase ativada.' : 'Frase desativada.');
  };

  const handleExcluir = async (item) => {
    if (!window.confirm('Excluir esta frase? Esta ação não pode ser desfeita.')) return;
    await deleteDoc(doc(db, 'frases', item.id));
    showToast('Frase excluída.');
  };

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">💬 Frases e Reflexões</h1>
          <p className="screen-sub">Gerencie as frases do dia e reflexões exibidas às usuárias.</p>
        </div>
        <button className="btn-primary" onClick={abrirAdicionar}>+ Nova frase</button>
      </div>

      <div className="stats-row-mini">
        <div className="stat-mini"><div className="stat-mini-value">{frases.length}</div><div className="stat-mini-label">Total</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ color: 'var(--sage)' }}>{totalAtivas}</div><div className="stat-mini-label">Ativas</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ color: 'var(--text-light)' }}>{frases.length - totalAtivas}</div><div className="stat-mini-label">Inativas</div></div>
      </div>

      <div className="search-bar">
        <span>🔍</span>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por frase, autor ou reflexão..."
        />
        {busca && <button onClick={() => setBusca('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>}
      </div>

      <div className="filter-row">
        {[{ id: 'todas', label: 'Todas' }, { id: 'ativas', label: 'Ativas' }, { id: 'inativas', label: 'Inativas' }].map(f => (
          <button key={f.id} className={`chip ${filtro === f.id ? 'chip-active' : ''}`} onClick={() => setFiltro(f.id)}>{f.label}</button>
        ))}
      </div>

      {frases.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <p>Nenhuma frase cadastrada ainda.<br />Comece adicionando a primeira frase.</p>
        </div>
      )}

      {lista.map((item, i) => (
        <div key={item.id} className={`frase-card ${item.ativa === false ? 'inactive' : ''}`}>
          <div className="frase-card-body">
            <div className="frase-num">#{i + 1} {item.ativa === false && <span className="badge badge-inactive" style={{ marginLeft: 6, fontSize: 10 }}>inativa</span>}</div>
            <div className="frase-text">"{item.texto}"</div>
            {item.autor && <div className="frase-autor">— {item.autor}</div>}
            {item.reflexao && <div className="frase-reflexao">📖 {item.reflexao}</div>}
          </div>
          <div className="frase-actions">
            <button className="icon-btn" onClick={() => abrirEditar(item)} title="Editar">✏️</button>
            <button className="icon-btn" onClick={() => handleToggle(item)} title={item.ativa === false ? 'Ativar' : 'Desativar'}>
              {item.ativa === false ? '👁️' : '🔕'}
            </button>
            <button className="icon-btn icon-btn-delete" onClick={() => handleExcluir(item)} title="Excluir">🗑️</button>
          </div>
        </div>
      ))}

      {lista.length === 0 && frases.length > 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <p>Nenhuma frase encontrada para esta busca.</p>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal.mode === 'add' ? '✨ Nova frase' : '✏️ Editar frase'}</h2>
              <button className="modal-close" onClick={fecharModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Frase <span style={{ color: 'var(--rose)' }}>*</span></label>
                <textarea
                  value={form.texto}
                  onChange={e => set('texto', e.target.value)}
                  placeholder="Texto da frase..."
                  rows={3}
                  autoFocus
                />
              </div>
              <div className="field-group">
                <label>Autor</label>
                <input type="text" value={form.autor} onChange={e => set('autor', e.target.value)} placeholder="Nome do autor ou fonte" />
              </div>
              <div className="field-group">
                <label>Reflexão <span style={{ color: 'var(--rose)' }}>*</span></label>
                <textarea
                  value={form.reflexao}
                  onChange={e => set('reflexao', e.target.value)}
                  placeholder="Texto da reflexão do dia para a usuária..."
                  rows={4}
                  style={{ minHeight: 100 }}
                />
              </div>
              <div className="modal-footer">
                <button className="btn-ghost" onClick={fecharModal}>Cancelar</button>
                <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
                  {salvando ? '⏳ Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
