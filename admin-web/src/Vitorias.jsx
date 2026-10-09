import React, { useState, useEffect } from 'react';
import { ordenarPor } from './ordenar';
import { db } from './firebase';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch,
} from 'firebase/firestore';
import { IconEdit, IconEye, IconEyeOff, IconSpark, IconTrash } from './Icons';
import { ICONES_VITORIA, iconeVitoria } from './iconesVitoria';

const VITORIAS_PADRAO = [
  'Saí de casa', 'Consegui dormir', 'Encontrei amigos',
  'Fiz algo prazeroso', 'Me alimentei bem', 'Busquei minha rede de apoio',
  'Concluí uma jornada', 'Ouvi música', 'Me hidratei bem',
  'Pratiquei respiração',
];

// Ícone desenhado com máscara para seguir a cor do painel (o SVG é preto).
function IconeVitoria({ id, size = 20, cor = 'var(--primary)' }) {
  const { url, nome } = iconeVitoria(id);
  return (
    <span
      role="img"
      aria-label={nome}
      style={{
        display: 'inline-block', width: size, height: size, flexShrink: 0, backgroundColor: cor,
        WebkitMask: `url(${url}) center / contain no-repeat`, mask: `url(${url}) center / contain no-repeat`,
      }}
    />
  );
}

// Grade de ícones para escolher; os mesmos aparecem para a usuária no app.
function SeletorIcone({ valor, onChange }) {
  const atual = iconeVitoria(valor).id;
  return (
    <div className="aln-icones">
      {ICONES_VITORIA.map(ic => (
        <button
          key={ic.id}
          type="button"
          title={ic.nome}
          className={`aln-icone-btn ${atual === ic.id ? 'sel' : ''}`}
          onClick={() => onChange(ic.id)}
        >
          <IconeVitoria id={ic.id} size={20} cor={atual === ic.id ? 'var(--primary)' : 'var(--text-mid)'} />
        </button>
      ))}
    </div>
  );
}

export default function Vitorias({ showToast }) {
  const [opcoes, setOpcoes] = useState([]);
  const [novoLabel, setNovoLabel] = useState('');
  const [novoIcone, setNovoIcone] = useState('star');
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editIcone, setEditIcone] = useState('star');
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'vitoriasOpcoes'), snap => {
      setOpcoes(ordenarPor(snap.docs.map(d => ({ id: d.id, ...d.data() })), 'criadoEm', 'asc'));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const handleAdicionar = async () => {
    const label = novoLabel.trim();
    if (!label) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, 'vitoriasOpcoes'), {
        label, icone: novoIcone, ativo: true, criadoEm: serverTimestamp(),
      });
      setNovoLabel('');
      setNovoIcone('star');
      showToast('Vitória adicionada!');
    } catch { showToast('Erro ao adicionar.', 'error'); }
    setSalvando(false);
  };

  const startEdit = (item) => {
    setEditId(item.id);
    setEditLabel(item.label || '');
    setEditIcone(iconeVitoria(item.icone).id);
  };

  const saveEdit = async () => {
    if (!editLabel.trim()) return;
    try {
      await updateDoc(doc(db, 'vitoriasOpcoes', editId), { label: editLabel.trim(), icone: editIcone });
      setEditId(null);
      showToast('Atualizado!');
    } catch (e) { showToast(`Erro ao salvar: ${e?.message || 'tente novamente.'}`, 'error'); }
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
        batch.set(ref, { label, icone: 'star', ativo: true, criadoEm: serverTimestamp() });
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
          <h1 className="screen-title">Vitórias</h1>
          <p className="screen-sub">Opções de vitórias do dia disponíveis para as usuárias registrarem.</p>
        </div>
        <button className="btn-secondary" onClick={importarPadrao} disabled={importando} style={{ marginRight: 8 }}>
          {importando ? 'Importando...' : ' Importar padrão'}
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
          <button className="btn-primary" onClick={handleAdicionar} disabled={salvando || !novoLabel.trim()}>
            {salvando ? 'Adicionando...' : '+ Adicionar'}
          </button>
        </div>
        <div className="field-group" style={{ marginTop: 14, marginBottom: 0 }}>
          <label>Ícone</label>
          <SeletorIcone valor={novoIcone} onChange={setNovoIcone} />
          <span className="field-hint">Aparece ao lado da vitória no aplicativo.</span>
        </div>
      </div>

      {opcoes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconSpark size={34} /></div>
          <p>Nenhuma vitória cadastrada. Adicione acima ou importe o conjunto padrão.</p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 12 }}>{opcoes.length} vitória(s) cadastrada(s)</p>
          {opcoes.map(item => (
            <div key={item.id} className={`vitoria-item ${item.ativo === false ? 'inactive' : ''}`}>
              {editId === item.id ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--primary-mid)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                  />
                  <button className="btn-primary" style={{ padding: '7px 14px', fontSize: 12 }} onClick={saveEdit}> Salvar</button>
                  <button className="btn-ghost" style={{ padding: '7px 14px', fontSize: 12 }} onClick={cancelEdit}>Cancelar</button>
                  </div>
                  <SeletorIcone valor={editIcone} onChange={setEditIcone} />
                </div>
              ) : (
                <>
                  <div className="vitoria-label">
                    <IconeVitoria id={item.icone} size={18} />
                    <span>{item.label}</span>
                    {item.ativo === false && <span className="badge badge-inactive" style={{ marginLeft: 8 }}>Inativo</span>}
                  </div>
                  <div className="vitoria-actions">
                    <button className="icon-btn" onClick={() => toggleAtivo(item)} title={item.ativo === false ? 'Ativar' : 'Desativar'}>
                      {item.ativo === false ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </button>
                    <button className="icon-btn" onClick={() => startEdit(item)} title="Editar"><IconEdit size={16} /></button>
                    <button className="icon-btn icon-btn-delete" onClick={() => handleExcluir(item)} title="Excluir"><IconTrash size={16} /></button>
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
