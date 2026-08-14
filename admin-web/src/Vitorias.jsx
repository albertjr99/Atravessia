import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc, writeBatch,
} from 'firebase/firestore';

const VITORIAS_PADRAO = [
  'Saí de casa', 'Consegui dormir', 'Encontrei amigos',
  'Fiz algo prazeroso', 'Me alimentei bem', 'Busquei minha rede de apoio',
  'Concluí uma jornada', 'Ouvi música', 'Me hidratei bem',
  'Pratiquei respiração',
];

const EMOJIS = ['⭐', '🌟', '✨', '💪', '🏆', '🎉', '🌱', '💜', '🌸', '🌈', '🔥', '🕊️', '🌙', '☀️', '🤝'];

export default function Vitorias({ showToast }) {
  const [opcoes, setOpcoes] = useState([]);
  const [novoLabel, setNovoLabel] = useState('');
  const [novoEmoji, setNovoEmoji] = useState('⭐');
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editEmoji, setEditEmoji] = useState('⭐');
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    const ref = query(collection(db, 'vitoriasOpcoes'), orderBy('criadoEm', 'asc'));
    return onSnapshot(ref, snap => {
      setOpcoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const handleAdicionar = async () => {
    const label = novoLabel.trim();
    if (!label) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, 'vitoriasOpcoes'), {
        label, emoji: novoEmoji || '⭐', ativo: true, criadoEm: serverTimestamp(),
      });
      setNovoLabel('');
      setNovoEmoji('⭐');
      showToast('Vitória adicionada!');
    } catch { showToast('Erro ao adicionar.', 'error'); }
    setSalvando(false);
  };

  const startEdit = (item) => {
    setEditId(item.id);
    setEditLabel(item.label || '');
    setEditEmoji(item.emoji || '⭐');
  };

  const saveEdit = async () => {
    if (!editLabel.trim()) return;
    await updateDoc(doc(db, 'vitoriasOpcoes', editId), { label: editLabel.trim(), emoji: editEmoji });
    setEditId(null);
    showToast('Atualizado!');
  };

  const cancelEdit = () => setEditId(null);

  const handleExcluir = async (item) => {
    if (!window.confirm(`Excluir "${item.label}"?`)) return;
    await deleteDoc(doc(db, 'vitoriasOpcoes', item.id));
    showToast('Excluído.');
  };

  const toggleAtivo = (item) => {
    updateDoc(doc(db, 'vitoriasOpcoes', item.id), { ativo: item.ativo === false });
  };

  const importarPadrao = async () => {
    if (!window.confirm(`Importar ${VITORIAS_PADRAO.length} vitórias padrão? Serão adicionadas às existentes.`)) return;
    setImportando(true);
    try {
      const batch = writeBatch(db);
      VITORIAS_PADRAO.forEach(label => {
        const ref = doc(collection(db, 'vitoriasOpcoes'));
        batch.set(ref, { label, emoji: '⭐', ativo: true, criadoEm: serverTimestamp() });
      });
      await batch.commit();
      showToast(`${VITORIAS_PADRAO.length} vitórias importadas!`);
    } catch { showToast('Erro na importação.', 'error'); }
    setImportando(false);
  };

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">⭐ Vitórias</h1>
          <p className="screen-sub">Opções de vitórias do dia disponíveis para as usuárias registrarem.</p>
        </div>
        <button className="btn-secondary" onClick={importarPadrao} disabled={importando} style={{ marginRight: 8 }}>
          {importando ? '⏳ Importando...' : '📥 Importar padrão'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 className="card-title">Adicionar nova vitória</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Texto da vitória</label>
            <input
              type="text"
              value={novoLabel}
              onChange={e => setNovoLabel(e.target.value)}
              placeholder="Ex: Mediti por 10 minutos"
              onKeyDown={e => e.key === 'Enter' && handleAdicionar()}
            />
          </div>
          <div className="field-group" style={{ marginBottom: 0, width: 120 }}>
            <label>Emoji</label>
            <select value={novoEmoji} onChange={e => setNovoEmoji(e.target.value)} style={{ fontSize: 18 }}>
              {EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={handleAdicionar} disabled={salvando || !novoLabel.trim()}>
            {salvando ? '⏳' : '+ Adicionar'}
          </button>
        </div>
      </div>

      {opcoes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⭐</div>
          <p>Nenhuma vitória cadastrada. Adicione acima ou importe o conjunto padrão.</p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 12 }}>{opcoes.length} vitória(s) cadastrada(s)</p>
          {opcoes.map(item => (
            <div key={item.id} className={`vitoria-item ${item.ativo === false ? 'inactive' : ''}`}>
              {editId === item.id ? (
                <>
                  <select value={editEmoji} onChange={e => setEditEmoji(e.target.value)} style={{ fontSize: 20, border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px' }}>
                    {EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
                  </select>
                  <input
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--primary-mid)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                  />
                  <button className="btn-primary" style={{ padding: '7px 14px', fontSize: 12 }} onClick={saveEdit}>✓ Salvar</button>
                  <button className="btn-ghost" style={{ padding: '7px 14px', fontSize: 12 }} onClick={cancelEdit}>Cancelar</button>
                </>
              ) : (
                <>
                  <div className="vitoria-label">
                    <span className="vitoria-emoji">{item.emoji || '⭐'}</span>
                    <span>{item.label}</span>
                    {item.ativo === false && <span className="badge badge-inactive" style={{ marginLeft: 8 }}>Inativo</span>}
                  </div>
                  <div className="vitoria-actions">
                    <button className="icon-btn" onClick={() => toggleAtivo(item)} title={item.ativo === false ? 'Ativar' : 'Desativar'}>
                      {item.ativo === false ? '👁️' : '🔕'}
                    </button>
                    <button className="icon-btn" onClick={() => startEdit(item)} title="Editar">✏️</button>
                    <button className="icon-btn icon-btn-delete" onClick={() => handleExcluir(item)} title="Excluir">🗑️</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
