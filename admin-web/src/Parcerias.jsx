import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { IconClose, IconEdit, IconEye, IconEyeOff, IconLink, IconSpark, IconTag, IconTrash } from './Icons';

const CATEGORIAS = [
  { id: 'saude',           label: 'Da saúde física' },
  { id: 'voce',            label: 'De você e do ambiente em que vive' },
  { id: 'trabalho',        label: 'Do trabalho e estudos' },
  { id: 'relacionamentos', label: 'Dos relacionamentos' },
  { id: 'outros',          label: 'Outros' },
];

// Token de leitura do extrato do parceiro — não protege dinheiro (isso é a
// Cloud Function que faz), só identifica de forma difícil de adivinhar qual
// parceria consultar. Pode ser regenerado a qualquer momento reeditando.
function gerarTokenPainel() {
  return Array.from({ length: 3 }, () => Math.random().toString(36).slice(2, 10)).join('');
}

// Mesma normalização do app (oamorqueefica/src/utils/abrirLink.js):
// "www.x.com" → https://, telefone → wa.me, esquemas diretos ficam como estão.
function normalizarUrl(bruto) {
  const raw = String(bruto ?? '')
    .trim()
    .replace(/^[<"'\s]+/, '')
    .replace(/[>"'\s]+$/, '');
  if (!raw) return null;
  if (/^(https?|mailto|tel|whatsapp|sms):/i.test(raw)) return raw;
  if (/^[^\s]+\.[a-z]{2,}(\/|$|\?|#)/i.test(raw)) return `https://${raw}`;
  const digitos = raw.replace(/\D/g, '');
  if (digitos.length >= 10 && digitos.length <= 15) return `https://wa.me/${digitos}`;
  return null;
}

const brl = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;

function tipoBtnStyle(ativo) {
  return {
    flex: 1, textAlign: 'left', cursor: 'pointer', padding: '12px 14px',
    borderRadius: 10, border: `1.5px solid ${ativo ? 'var(--primary)' : 'var(--border)'}`,
    background: ativo ? 'var(--primary-lav, #EDE9F5)' : 'var(--card)',
    color: 'var(--text-dark)', fontFamily: 'inherit',
  };
}

function novoForm() {
  return {
    titulo: '', descricao: '', link: '', imagemUrl: '', categorias: [], ativo: true,
    tipoBeneficio: 'link',
    percentualBeneficio: '10',
    percentualComissao: '3',
    validadeDiasVoucher: '30',
  };
}

export default function Parcerias({ showToast }) {
  const [parcerias, setParcerias] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(novoForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [erroLista, setErroLista] = useState('');

  useEffect(() => {
    return onSnapshot(collection(db, 'parcerias'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));
      setParcerias(docs);
      setErroLista('');
      setLoading(false);
    }, (e) => { setErroLista(e?.message || 'Não foi possível carregar as parcerias.'); setLoading(false); });
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
      tipoBeneficio: item.tipoBeneficio === 'cupom' ? 'cupom' : 'link',
      percentualBeneficio: item.percentualBeneficio != null ? String(item.percentualBeneficio) : '10',
      percentualComissao: item.percentualComissao != null ? String(item.percentualComissao) : '3',
      validadeDiasVoucher: item.validadeDiasVoucher != null ? String(item.validadeDiasVoucher) : '30',
    });
    setEditId(item.id);
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditId(null); setForm(novoForm()); };

  const descontoClienteCalculado = Math.max(
    0, (parseFloat(form.percentualBeneficio) || 0) - (parseFloat(form.percentualComissao) || 0)
  );

  const salvar = async () => {
    if (!form.titulo.trim()) { showToast('Informe o título.', 'error'); return; }
    if (form.categorias.length === 0) { showToast('Selecione ao menos uma categoria.', 'error'); return; }
    if (form.tipoBeneficio === 'cupom' && (!form.percentualBeneficio || parseFloat(form.percentualBeneficio) <= 0)) {
      showToast('Informe o percentual total do benefício para o cupom.', 'error');
      return;
    }
    // Link de destino é opcional; se preenchido, precisa ser um endereço válido.
    const linkBruto = form.link.trim();
    const linkFinal = linkBruto ? normalizarUrl(linkBruto) : '';
    if (linkBruto && !linkFinal) {
      showToast('O link de destino não parece um endereço válido. Confira ou deixe em branco.', 'error');
      return;
    }
    setSaving(true);
    try {
      const { percentualBeneficio, percentualComissao, validadeDiasVoucher, ...resto } = form;
      const data = { ...resto, link: linkFinal };
      if (form.tipoBeneficio === 'cupom') {
        // Sempre sobre o valor original — a opção "valor final" foi retirada.
        data.baseCalculoComissao = 'valor_original';
        data.percentualBeneficio = parseFloat(percentualBeneficio) || 0;
        data.percentualComissao = parseFloat(percentualComissao) || 0;
        data.percentualDescontoCliente = descontoClienteCalculado;
        data.validadeDiasVoucher = parseInt(validadeDiasVoucher, 10) || 30;
        // Mantém o token existente ao editar; só gera um novo se nunca teve.
        if (!editId || !parcerias.find(p => p.id === editId)?.tokenPainel) {
          data.tokenPainel = gerarTokenPainel();
        }
      }
      if (editId) {
        await updateDoc(doc(db, 'parcerias', editId), data);
        showToast('Parceria atualizada!');
      } else {
        await addDoc(collection(db, 'parcerias'), { ...data, cliques: 0, criadoEm: serverTimestamp() });
        showToast('Parceria adicionada!');
      }
      closeModal();
    } catch (e) { showToast(`Erro ao salvar: ${e?.message || 'tente novamente.'}`, 'error'); }
    setSaving(false);
  };

  const excluir = async (item) => {
    if (!window.confirm(`Excluir "${item.titulo}"?`)) return;
    try {
      await deleteDoc(doc(db, 'parcerias', item.id));
      showToast('Parceria excluída.');
    } catch (e) { showToast(`Erro ao excluir: ${e?.message || 'tente novamente.'}`, 'error'); }
  };

  const toggleAtivo = (item) => {
    updateDoc(doc(db, 'parcerias', item.id), { ativo: item.ativo === false })
      .catch(e => showToast(`Erro ao alterar a parceria: ${e?.message || 'tente novamente.'}`, 'error'));
  };

  const lista = filtro === 'todas'
    ? parcerias
    : parcerias.filter(p => (p.categorias || []).includes(filtro));

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Parcerias e Benefícios</h1>
          <p className="screen-sub">Gerenciar parcerias e descontos exclusivos exibidos no aplicativo.</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Nova parceria</button>
      </div>

      {erroLista && (
        <div className="empty-state"><p>Não foi possível carregar as parcerias: {erroLista}</p></div>
      )}

      <div className="filter-row" style={{ flexWrap: 'wrap' }}>
        <button className={`chip ${filtro === 'todas' ? 'chip-active' : ''}`} onClick={() => setFiltro('todas')}>Todas ({parcerias.length})
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
          <div className="empty-icon"><IconSpark size={34} /></div>
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
                }}></div>
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
                  <a href={normalizarUrl(item.link) || item.link}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: 'var(--primary)', wordBreak: 'break-all' }}>
                    {item.link}
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
                    {item.tipoBeneficio === 'cupom' && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: 'rgba(198,164,110,.18)', color: '#8A6A33',
                      }}>
                        <IconTag size={10} /> Cupom · {item.percentualComissao || 0}% comissão
                      </span>
                    )}
                  </div>
                )}
                {item.tipoBeneficio === 'cupom' && item.tokenPainel && (
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/parceiro.html?painel=${item.tokenPainel}`;
                      navigator.clipboard?.writeText(url);
                      showToast('Link do painel do parceiro copiado!');
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      marginTop: 6, background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, color: 'var(--primary-600)', padding: 0,
                    }}
                  >
                    <IconLink size={11} /> Copiar link do painel do parceiro
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="icon-btn" onClick={() => toggleAtivo(item)}
                  title={item.ativo === false ? 'Ativar' : 'Desativar'}>
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
              <h2>{editId ? 'Editar parceria' : 'Nova parceria'}</h2>
              <button className="modal-close" onClick={closeModal}><IconClose size={17} /></button>
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
                  <label>Link de destino <span className="aln-opcional">(opcional)</span></label>
                  <input type="text" inputMode="url" value={form.link}
                    onChange={e => set('link', e.target.value)}
                    placeholder="https://..." />
                  <span className="field-hint">Se preenchido, a usuária é levada a este endereço ao tocar na parceria.</span>
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
                <label>Tipo de benefício</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => set('tipoBeneficio', 'link')}
                    style={tipoBtnStyle(form.tipoBeneficio === 'link')}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Link simples</div>
                    <div style={{ fontSize: 11, color: 'var(--text-mid)', marginTop: 2 }}>
                      Desconto direto — sem comissão nem rastreamento financeiro.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => set('tipoBeneficio', 'cupom')}
                    style={tipoBtnStyle(form.tipoBeneficio === 'cupom')}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Cupom com comissão</div>
                    <div style={{ fontSize: 11, color: 'var(--text-mid)', marginTop: 2 }}>
                      Gera voucher; o parceiro confirma o atendimento e a Atravessia recebe uma comissão.
                    </div>
                  </button>
                </div>
              </div>

              {form.tipoBeneficio === 'cupom' && (
                <div style={{
                  background: 'var(--primary-lav, #EDE9F5)', borderRadius: 12,
                  padding: 14, marginBottom: 16,
                }}>
                  <div className="field-row">
                    <div className="field-group" style={{ marginBottom: 8 }}>
                      <label>Benefício total (%)</label>
                      <input type="number" min="0" step="0.5"
                        value={form.percentualBeneficio}
                        onChange={e => set('percentualBeneficio', e.target.value)}
                        placeholder="10" />
                    </div>
                    <div className="field-group" style={{ marginBottom: 8 }}>
                      <label>Comissão Atravessia (%)</label>
                      <input type="number" min="0" step="0.5"
                        value={form.percentualComissao}
                        onChange={e => set('percentualComissao', e.target.value)}
                        placeholder="3" />
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#5B3D9E', margin: '0 0 12px' }}>
                    Desconto que chega à usuária: <strong>{descontoClienteCalculado.toFixed(1)}%</strong>
                    {'  ·  '}Comissão da Atravessia: <strong>{form.percentualComissao || 0}% do valor original</strong>
                  </p>

                  <p style={{
                    fontSize: 12, color: '#5B3D9E', lineHeight: 1.55, margin: '0 0 12px',
                    background: 'var(--surface)', border: '1px solid var(--primary-200)',
                    borderRadius: 8, padding: '8px 10px',
                  }}>
                    A comissão é calculada sobre o valor original do serviço (antes do desconto).
                    {' '}Ex.: num serviço de {brl(100)}, a usuária paga {brl(Math.max(0, 100 - descontoClienteCalculado))} e
                    a comissão da Atravessia é {brl(parseFloat(form.percentualComissao) || 0)}.
                  </p>

                  <div className="field-group" style={{ marginBottom: 0 }}>
                    <label>Validade de cada cupom (dias)</label>
                    <input type="number" min="1"
                      value={form.validadeDiasVoucher}
                      onChange={e => set('validadeDiasVoucher', e.target.value)}
                      placeholder="30" />
                    <span className="field-hint">A usuária pode gerar quantos cupons quiser; cada um vale para um único atendimento.</span>
                  </div>
                </div>
              )}

              <div className="field-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.ativo}
                    onChange={e => set('ativo', e.target.checked)}
                    style={{ width: 16, height: 16 }} />Parceria ativa (visível no aplicativo)
                </label>
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
