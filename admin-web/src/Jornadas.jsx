import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot,
  serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { IconAlert, IconClose, IconCompass, IconEdit, IconTrash } from './Icons';
import { ordenarPor } from './emocoes';

// Porte de oamorqueefica/src/screens/admin/AdminJornadasScreen.js
// Coleção `jornadas`: titulo, descricao, icone (nome Ionicons usado pelo app),
// plano (0..3), ordem (número), ativa (boolean), criadoEm / atualizadoEm.

const PLANOS = [
  { id: 0, label: 'Grátis (Perceber)' },
  { id: 1, label: 'Acolher' },
  { id: 2, label: 'Compreender' },
  { id: 3, label: 'Evoluir' },
];

const PLANO_CORES = { 0: '#7A9E7E', 1: '#8B7AC0', 2: '#7B5EA7', 3: '#C0843F' };

// Os nomes são os do Ionicons (renderizados no app). No painel web mostramos
// um símbolo equivalente só para identificação visual.
const ICONES = [
  { id: 'heart-outline',    simbolo: '♡', nome: 'Coração' },
  { id: 'leaf-outline',     simbolo: '❦', nome: 'Folha' },
  { id: 'sunny-outline',    simbolo: '☼', nome: 'Sol' },
  { id: 'moon-outline',     simbolo: '☾', nome: 'Lua' },
  { id: 'compass-outline',  simbolo: '✧', nome: 'Bússola' },
  { id: 'book-outline',     simbolo: '▤', nome: 'Livro' },
  { id: 'flame-outline',    simbolo: '♨', nome: 'Chama' },
  { id: 'walk-outline',     simbolo: '➶', nome: 'Caminhada' },
  { id: 'shield-outline',   simbolo: '⛉', nome: 'Escudo' },
  { id: 'sparkles-outline', simbolo: '✦', nome: 'Brilhos' },
  { id: 'flower-outline',   simbolo: '✿', nome: 'Flor' },
  { id: 'infinite-outline', simbolo: '∞', nome: 'Infinito' },
];

const iconeInfo = (id) => ICONES.find(i => i.id === id) || ICONES[4];

const novo = () => ({
  titulo: '', descricao: '', icone: 'compass-outline', plano: 1, ordem: 0, ativa: true,
});

export default function Jornadas({ showToast }) {
  const [jornadas, setJornadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState(null); // null = fechado; objeto = editando
  const [salvando, setSalvando] = useState(false);

  // Sem orderBy('ordem'): ele esconderia jornadas sem o campo. Ordena no cliente.
  useEffect(() => {
    return onSnapshot(collection(db, 'jornadas'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setJornadas(ordenarPor(docs, 'ordem', 'asc'));
      setErro('');
      setLoading(false);
    }, (e) => {
      setErro(e?.message || 'Erro desconhecido.');
      setLoading(false);
    });
  }, []);

  const abrirNova = () => setForm({ ...novo(), ordem: jornadas.length });
  const cancelar = () => { if (!salvando) setForm(null); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const salvar = async () => {
    if (!form.titulo.trim()) { showToast('Informe um título para a jornada.', 'error'); return; }
    setSalvando(true);
    try {
      const dados = {
        titulo: form.titulo.trim(),
        descricao: (form.descricao || '').trim(),
        icone: form.icone,
        plano: form.plano,
        ordem: Number(form.ordem) || 0,
        ativa: form.ativa,
      };
      if (form.id) {
        await updateDoc(doc(db, 'jornadas', form.id), { ...dados, atualizadoEm: serverTimestamp() });
        showToast('Jornada atualizada!');
      } else {
        await addDoc(collection(db, 'jornadas'), { ...dados, criadoEm: serverTimestamp() });
        showToast('Jornada criada!');
      }
      setForm(null);
    } catch (e) {
      showToast('Não foi possível salvar a jornada: ' + (e?.message || ''), 'error');
    }
    setSalvando(false);
  };

  const remover = async (j) => {
    if (!window.confirm(`Remover a jornada "${j.titulo}"? Tem certeza?`)) return;
    try {
      await deleteDoc(doc(db, 'jornadas', j.id));
      showToast('Jornada removida.');
    } catch (e) {
      showToast('Erro ao remover: ' + (e?.message || ''), 'error');
    }
  };

  const toggleAtiva = async (j) => {
    try {
      await updateDoc(doc(db, 'jornadas', j.id), { ativa: !j.ativa });
    } catch (e) {
      showToast('Erro ao alterar a jornada: ' + (e?.message || ''), 'error');
    }
  };

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Jornadas</h1>
          <p className="screen-sub">Crie programas e trilhas de conteúdo, definindo plano de acesso e ordem de exibição.</p>
        </div>
        <button className="btn-primary" onClick={abrirNova}>+ Nova jornada</button>
      </div>

      {erro && (
        <div className="aln-erro">
          <IconAlert size={16} />
          <span>Não foi possível carregar as jornadas: {erro}</span>
        </div>
      )}

      <div className="section-label">Jornadas ({jornadas.length})</div>

      {jornadas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconCompass size={34} /></div>
          <p>Nenhuma jornada criada ainda.</p>
        </div>
      ) : (
        <div className="list-grid">
          {jornadas.map(j => {
            const planoObj = PLANOS.find(p => p.id === j.plano);
            const cor = PLANO_CORES[j.plano] ?? '#8B7AC0';
            const ic = iconeInfo(j.icone);
            return (
              <div key={j.id} className={`list-card ${j.ativa ? '' : 'inactive'}`}>
                <div className="aln-icone-circulo" style={{ background: cor + '22', color: cor }} title={ic.nome}>
                  {ic.simbolo}
                </div>
                <div className="list-card-body">
                  <div className="list-card-title">{j.titulo}</div>
                  {j.descricao && <div className="list-card-desc">{j.descricao}</div>}
                  <div className="list-card-badges">
                    {planoObj && <span className="badge" style={{ background: cor + '22', color: cor }}>{planoObj.label}</span>}
                    <span className={`badge ${j.ativa ? 'badge-perceber' : 'badge-inactive'}`}>{j.ativa ? 'Ativa' : 'Inativa'}</span>
                    <span className="badge badge-inactive">Ordem: {j.ordem ?? 0}</span>
                  </div>
                </div>
                <div className="list-card-actions" style={{ alignItems: 'center' }}>
                  <label className="toggle" title={j.ativa ? 'Desativar' : 'Ativar'}>
                    <input type="checkbox" checked={!!j.ativa} onChange={() => toggleAtiva(j)} />
                    <span className="toggle-slider" />
                  </label>
                  <button className="icon-btn" onClick={() => setForm({ ...novo(), ...j })} title="Editar"><IconEdit size={16} /></button>
                  <button className="icon-btn icon-btn-delete" onClick={() => remover(j)} title="Remover"><IconTrash size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={cancelar}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{form.id ? 'Editar jornada' : 'Nova jornada'}</h2>
              <button className="modal-close" onClick={cancelar}><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Título *</label>
                <input type="text" value={form.titulo} onChange={e => setF('titulo', e.target.value)} placeholder="Ex: Cuidando de mim" autoFocus />
              </div>

              <div className="field-group">
                <label>Descrição</label>
                <textarea value={form.descricao} onChange={e => setF('descricao', e.target.value)} placeholder="Descreva o objetivo desta jornada..." rows={3} />
              </div>

              <div className="field-group">
                <label>Ícone</label>
                <div className="aln-icone-grid">
                  {ICONES.map(ic => (
                    <button
                      key={ic.id}
                      type="button"
                      className={`aln-icone-btn ${form.icone === ic.id ? 'ativo' : ''}`}
                      onClick={() => setF('icone', ic.id)}
                      title={ic.nome}
                    >
                      {ic.simbolo}
                    </button>
                  ))}
                </div>
                <span className="field-hint">No app aparece o ícone "{iconeInfo(form.icone).nome}".</span>
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label>Plano mínimo de acesso</label>
                  <div className="chip-row" style={{ marginBottom: 0 }}>
                    {PLANOS.map(p => (
                      <button key={p.id} className={`chip ${form.plano === p.id ? 'chip-active' : ''}`} onClick={() => setF('plano', p.id)}>{p.label}</button>
                    ))}
                  </div>
                </div>
                <div className="field-group">
                  <label>Ordem (número)</label>
                  <input type="number" value={form.ordem} onChange={e => setF('ordem', e.target.value)} placeholder="0" />
                </div>
              </div>

              <div className="toggle-row">
                <label className="toggle">
                  <input type="checkbox" checked={!!form.ativa} onChange={e => setF('ativa', e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <span style={{ fontSize: 13, color: 'var(--text-dark)' }}>Ativa (visível para usuárias)</span>
              </div>

              <div className="modal-footer">
                <button className="btn-ghost" onClick={cancelar} disabled={salvando}>Cancelar</button>
                <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
