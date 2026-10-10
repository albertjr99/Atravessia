import React, { useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { IconClose, IconEdit, IconEye, IconEyeOff, IconGift, IconLink, IconTrash } from './Icons';
import { urlDeImagem } from './parceriaUtils';

// Indicações Atravessia (afiliados Amazon), porte de AdminIndicacoesScreen.js.
// Mesmas categorias de src/screens/indicacoes/IndicacoesScreen.js no app.
export const CATEGORIAS_INDICACAO = [
  { id: 'livros', rotulo: 'Livros' },
  { id: 'diario', rotulo: 'Diário e escrita' },
  { id: 'bemestar', rotulo: 'Bem-estar' },
  { id: 'casa', rotulo: 'Casa e conforto' },
  { id: 'presentes', rotulo: 'Para presentear' },
  { id: 'outros', rotulo: 'Outros' },
];
const VAZIO = { titulo: '', descricao: '', imagemUrl: '', link: '', categoria: 'livros', ordem: '', ativo: true };

function normalizarLink(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

export default function Indicacoes({ showToast }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(collection(db, 'indicacoes'), (snap) => {
    setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }, () => setLoading(false)), []);

  const ordenados = useMemo(() => [...itens].sort((a, b) =>
    (Number(a.ordem) || 999) - (Number(b.ordem) || 999) || String(a.titulo || '').localeCompare(String(b.titulo || ''))), [itens]);
  const lista = filtro === 'todas' ? ordenados : ordenados.filter(i => (i.categoria || 'outros') === filtro);
  const totalCliques = itens.reduce((s, i) => s + (i.cliques || 0), 0);
  const ativos = itens.filter(i => i.ativo !== false).length;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const abrirNovo = () => { setForm(VAZIO); setModal({ mode: 'add' }); };
  const abrirEditar = (item) => {
    setForm({
      titulo: item.titulo || '', descricao: item.descricao || '', imagemUrl: item.imagemUrl || '',
      link: item.link || '', categoria: item.categoria || 'outros',
      ordem: item.ordem != null ? String(item.ordem) : '', ativo: item.ativo !== false,
    });
    setModal({ mode: 'edit', item });
  };
  const fechar = () => { setModal(null); setForm(VAZIO); };

  const salvar = async () => {
    if (!form.titulo.trim()) { showToast('Informe o nome do produto.', 'error'); return; }
    const link = normalizarLink(form.link);
    if (!link) { showToast('Cole o link de afiliada da Amazon.', 'error'); return; }
    setSalvando(true);
    const dados = {
      titulo: form.titulo.trim(), descricao: form.descricao.trim(), imagemUrl: form.imagemUrl.trim(),
      link, categoria: form.categoria, ordem: Number(form.ordem) || null, ativo: form.ativo,
    };
    try {
      if (modal.mode === 'add') await addDoc(collection(db, 'indicacoes'), { ...dados, cliques: 0, criadoEm: serverTimestamp() });
      else await updateDoc(doc(db, 'indicacoes', modal.item.id), dados);
      showToast(modal.mode === 'add' ? 'Indicação adicionada.' : 'Indicação atualizada.');
      fechar();
    } catch (e) {
      showToast(`Erro ao salvar: ${e.message || ''}`, 'error');
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (item) => {
    await updateDoc(doc(db, 'indicacoes', item.id), { ativo: item.ativo === false });
    showToast(item.ativo === false ? 'Indicação visível no app.' : 'Indicação ocultada.');
  };
  const excluir = async (item) => {
    if (!window.confirm(`Excluir "${item.titulo}"? Esta ação não pode ser desfeita.`)) return;
    await deleteDoc(doc(db, 'indicacoes', item.id));
    showToast('Indicação excluída.');
  };

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  const previa = urlDeImagem(form.imagemUrl);
  const linkAmazon = !form.link || /amzn\.|amazon\./i.test(form.link);

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Indicações Atravessia</h1>
          <p className="screen-sub">Vitrine de produtos com link de afiliada da Amazon. A comissão chega pela conta de Associados.</p>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>+ Nova indicação</button>
      </div>

      <div className="stats-row-mini">
        <div className="stat-mini"><div className="stat-mini-value">{itens.length}</div><div className="stat-mini-label">Produtos</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ color: 'var(--sage)' }}>{ativos}</div><div className="stat-mini-label">Visíveis</div></div>
        <div className="stat-mini"><div className="stat-mini-value">{totalCliques}</div><div className="stat-mini-label">Cliques</div></div>
      </div>

      <div className="filter-row" style={{ flexWrap: 'wrap' }}>
        {[{ id: 'todas', rotulo: 'Todas' }, ...CATEGORIAS_INDICACAO].map(c => (
          <button key={c.id} className={`chip ${filtro === c.id ? 'chip-active' : ''}`} onClick={() => setFiltro(c.id)}>{c.rotulo}</button>
        ))}
      </div>

      {itens.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon"><IconGift size={34} /></div>
          <p>Nenhuma indicação ainda.<br />Entre no Amazon Associados, gere o link de afiliada do produto (barra SiteStripe) e cadastre aqui com uma foto.</p>
        </div>
      )}

      <div className="ind-grade">
        {lista.map(item => {
          const img = urlDeImagem(item.imagemUrl);
          const inativo = item.ativo === false;
          return (
            <div key={item.id} className={`ind-card ${inativo ? 'inactive' : ''}`}>
              <div className="ind-img">{img ? <img src={img} alt="" /> : <IconGift size={28} />}</div>
              <div className="ind-corpo">
                <span className="ind-cat">{CATEGORIAS_INDICACAO.find(c => c.id === item.categoria)?.rotulo || 'Outros'}{inativo ? ' · oculta' : ''}</span>
                <strong>{item.titulo}</strong>
                <span className="ind-sub">{item.cliques || 0} clique{(item.cliques || 0) === 1 ? '' : 's'}{item.ordem ? ` · ordem ${item.ordem}` : ''}</span>
              </div>
              <div className="ind-acoes">
                <a className="icon-btn" href={item.link} target="_blank" rel="noreferrer" title="Abrir link"><IconLink size={16} /></a>
                <button className="icon-btn" onClick={() => abrirEditar(item)} title="Editar"><IconEdit size={16} /></button>
                <button className="icon-btn" onClick={() => alternar(item)} title={inativo ? 'Mostrar no app' : 'Ocultar do app'}>
                  {inativo ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
                <button className="icon-btn icon-btn-delete" onClick={() => excluir(item)} title="Excluir"><IconTrash size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={fechar}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal.mode === 'add' ? 'Nova indicação' : 'Editar indicação'}</h2>
              <button className="modal-close" onClick={fechar}><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Nome do produto <span style={{ color: 'var(--rose)' }}>*</span></label>
                <input type="text" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex.: O ano do pensamento mágico" autoFocus />
              </div>
              <div className="field-group">
                <label>Por que indicamos</label>
                <textarea rows={3} value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Uma frase curta e acolhedora" />
              </div>
              <div className="field-group">
                <label>Link de afiliada (Amazon) <span style={{ color: 'var(--rose)' }}>*</span></label>
                <input type="url" value={form.link} onChange={e => set('link', e.target.value)} placeholder="https://amzn.to/..." />
                {!linkAmazon && <span className="field-hint" style={{ color: '#7A5A22' }}>Este link não parece ser da Amazon. Confira se é o link de afiliada.</span>}
              </div>
              <div className="field-group">
                <label>Imagem (link direto ou Google Drive)</label>
                <input type="url" value={form.imagemUrl} onChange={e => set('imagemUrl', e.target.value)} placeholder="https://..." />
                {previa && <img src={previa} alt="Prévia" className="ind-previa" />}
              </div>
              <div className="field-group">
                <label>Categoria</label>
                <div className="filter-row" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
                  {CATEGORIAS_INDICACAO.map(c => (
                    <button key={c.id} type="button" className={`chip ${form.categoria === c.id ? 'chip-active' : ''}`} onClick={() => set('categoria', c.id)}>{c.rotulo}</button>
                  ))}
                </div>
              </div>
              <div className="field-group">
                <label>Ordem na vitrine (opcional)</label>
                <input type="number" min="1" value={form.ordem} onChange={e => set('ordem', e.target.value)} placeholder="1 aparece primeiro" />
              </div>
              <div className="toggle-row">
                <label className="toggle">
                  <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <span style={{ fontSize: 13, color: 'var(--text-dark)' }}>Visível no app</span>
              </div>
              <div className="modal-footer">
                <button className="btn-ghost" onClick={fechar} disabled={salvando}>Cancelar</button>
                <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
