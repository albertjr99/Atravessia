import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { db, storage } from './firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { IconClose, IconEdit, IconEye, IconEyeOff, IconLink, IconSpark, IconTag, IconTrash, IconGift, IconUpload } from './Icons';
import { UFS, formatarCidade, rotuloLocal, urlDeImagem, idDoDrive } from './parceriaUtils';

// Caixa de texto que cresce com o conteúdo: quem digita vê o texto inteiro,
// como a usuária vê no app (antes ficava preso em 3 linhas).
function TextoAutoAjustavel({ value, onChange, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight + 2, 120)}px`;
  }, [value]);
  return <textarea ref={ref} value={value} onChange={onChange} style={{ resize: 'vertical', overflow: 'hidden', lineHeight: 1.55 }} {...props} />;
}

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
    borderRadius: 16, border: `1.5px solid ${ativo ? 'var(--primary)' : 'var(--border-strong)'}`,
    background: ativo ? 'var(--primary-lav)' : 'var(--surface)',
    color: 'var(--text-dark)', fontFamily: 'inherit',
  };
}

function novoForm() {
  return {
    titulo: '', descricao: '', link: '', imagemUrl: '', categorias: [], ativo: true,
    estado: '', cidade: '', atendimentoOnline: false,
    tipoBeneficio: 'link',
    percentualBeneficio: '10',
    percentualComissao: '3',
    validadeDiasVoucher: '30',
    cashbackAtivo: true, cashbackPercentual: '', cashbackCondicoes: '',
  };
}

export default function Parcerias({ showToast, irPara }) {
  const [parcerias, setParcerias] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(novoForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [erroLista, setErroLista] = useState('');
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const arquivoRef = useRef(null);

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
      estado: item.estado || '',
      cidade: item.cidade || '',
      atendimentoOnline: item.atendimentoOnline === true,
      tipoBeneficio: item.tipoBeneficio === 'cupom' ? 'cupom' : 'link',
      percentualBeneficio: item.percentualBeneficio != null ? String(item.percentualBeneficio) : '10',
      percentualComissao: item.percentualComissao != null ? String(item.percentualComissao) : '3',
      validadeDiasVoucher: item.validadeDiasVoucher != null ? String(item.validadeDiasVoucher) : '30',
      cashbackAtivo: item.cashback?.ativo !== false,
      cashbackPercentual: item.cashback?.percentual != null ? String(item.cashback.percentual).replace('.', ',') : '',
      cashbackCondicoes: item.cashback?.condicoes || '',
    });
    setEditId(item.id);
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditId(null); setForm(novoForm()); };

  // A usuária recebe o desconto cadastrado; a comissão é cobrada à parte do parceiro.
  const descontoClienteCalculado = Math.max(0, parseFloat(form.percentualBeneficio) || 0);

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
    if (form.cidade.trim() && !form.estado) {
      showToast('Escolha o estado da cidade informada.', 'error');
      return;
    }
    setSaving(true);
    try {
      const { percentualBeneficio, percentualComissao, validadeDiasVoucher, cashbackAtivo, cashbackPercentual, cashbackCondicoes, ...resto } = form;
      const pctCashback = parseFloat(String(cashbackPercentual).replace(',', '.'));
      const data = {
        ...resto,
        link: linkFinal,
        // Link do Google Drive vira o endereço direto da imagem.
        imagemUrl: urlDeImagem(form.imagemUrl),
        estado: form.estado || '',
        cidade: formatarCidade(form.cidade),
        atendimentoOnline: form.atendimentoOnline === true,
      };
      if (form.tipoBeneficio === 'cupom') {
        // Sempre sobre o valor original — a opção "valor final" foi retirada.
        data.baseCalculoComissao = 'valor_original';
        data.percentualBeneficio = parseFloat(percentualBeneficio) || 0;
        data.percentualComissao = parseFloat(percentualComissao) || 0;
        data.percentualDescontoCliente = descontoClienteCalculado;
        data.validadeDiasVoucher = parseInt(validadeDiasVoucher, 10) || 30;
        // Cashback desta parceria: liga/desliga, percentual próprio (vazio = o geral) e condições.
        data.cashback = {
          ativo: cashbackAtivo !== false,
          percentual: Number.isFinite(pctCashback) ? Math.max(0, Math.min(50, pctCashback)) : null,
          condicoes: (cashbackCondicoes || '').trim(),
        };
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

  // Envio do banner direto do computador (mesma pasta do app: parcerias/).
  const enviarImagem = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Escolha um arquivo de imagem (PNG ou JPG).', 'error'); return; }
    setEnviandoImagem(true);
    try {
      const nomeArq = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const arq = storageRef(storage, `parcerias/${nomeArq}`);
      await uploadBytes(arq, file);
      set('imagemUrl', await getDownloadURL(arq));
      showToast('Imagem carregada!');
    } catch (e) {
      showToast(`Não foi possível enviar a imagem: ${e?.message || 'tente novamente.'}`, 'error');
    } finally {
      setEnviandoImagem(false);
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };

  const ativas = parcerias.filter(p => p.ativo !== false).length;
  const totalCliques = parcerias.reduce((t, p) => t + (p.cliques || 0), 0);

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

      <div className="stats-row-mini">
        <div className="stat-mini"><div className="stat-mini-value" style={{ fontSize: 20 }}>{parcerias.length}</div><div className="stat-mini-label">Total</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ fontSize: 20, color: 'var(--sage)' }}>{ativas}</div><div className="stat-mini-label">Ativas</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ fontSize: 20, color: 'var(--text-dark)' }}>{totalCliques}</div><div className="stat-mini-label">Cliques totais</div></div>
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
              opacity: item.ativo === false ? 0.6 : 1,
            }}>
              {item.imagemUrl ? (
                <img src={urlDeImagem(item.imagemUrl)} alt={item.titulo}
                  style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', flexShrink: 0, boxShadow: 'var(--sombra-1)' }} />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: 16, flexShrink: 0,
                  background: 'var(--acento-lilas-fundo)', color: 'var(--acento-lilas-tinta)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><IconGift size={28} /></div>
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
                {rotuloLocal(item) && (
                  <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 4 }}>{rotuloLocal(item)}</div>
                )}
                {item.link && (
                  <a href={normalizarUrl(item.link) || item.link}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: 'var(--primary-600)', wordBreak: 'break-all' }}>
                    {item.link}
                  </a>
                )}
                {(item.categorias || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    {item.categorias.map(c => (
                      <span key={c} style={{
                        fontSize: 11, fontWeight: 650, padding: '3px 9px', borderRadius: 999,
                        background: 'var(--acento-lilas-fundo)', color: 'var(--acento-lilas-texto)',
                      }}>
                        {CATEGORIAS.find(cat => cat.id === c)?.label || c}
                      </span>
                    ))}
                    {item.tipoBeneficio === 'cupom' && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                        background: 'var(--acento-dourado-fundo)', color: 'var(--acento-dourado-texto)',
                      }}>
                        <IconTag size={10} /> Cupom · {item.percentualComissao || 0}% comissão
                      </span>
                    )}
                    {item.tipoBeneficio !== 'cupom' && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                        background: 'var(--acento-salvia-fundo)', color: 'var(--acento-salvia-texto)',
                      }}>
                        {item.cliques || 0} cliques
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
                {item.tipoBeneficio === 'cupom' && irPara && (
                  <button
                    onClick={() => irPara('beneficios', { parceriaId: item.id })}
                    style={{
                      display: 'block', marginTop: 6, background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, color: 'var(--primary-600)', padding: 0,
                    }}
                  >
                    Ver cupons e comissões →
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
                <TextoAutoAjustavel value={form.descricao}
                  onChange={e => set('descricao', e.target.value)}
                  placeholder="Descreva o benefício oferecido..." />
                <span className="field-hint">O texto aparece inteiro para a usuária, com as quebras de linha que você fizer.</span>
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
                  <label>Banner / imagem da parceria</label>
                  <input ref={arquivoRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
                    onChange={e => enviarImagem(e.target.files?.[0])} />
                  <button type="button" className="btn-ghost" disabled={enviandoImagem}
                    onClick={() => arquivoRef.current?.click()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 8 }}>
                    <IconUpload size={16} /> {enviandoImagem ? 'Enviando imagem…' : 'Enviar imagem do computador'}
                  </button>
                  <span className="field-hint" style={{ marginBottom: 6 }}>PNG ou JPG · tamanho sugerido 800×400 px. Ou cole um link abaixo:</span>
                  <input type="url" value={form.imagemUrl}
                    onChange={e => set('imagemUrl', e.target.value)}
                    placeholder="https://... ou link do Google Drive" />
                  <span className="field-hint">
                    {idDoDrive(form.imagemUrl)
                      ? 'Link do Google Drive reconhecido. O arquivo precisa estar compartilhado como "Qualquer pessoa com o link".'
                      : 'Aceita link direto da imagem ou link de compartilhamento do Google Drive.'}
                  </span>
                </div>
              </div>

              {form.imagemUrl && (
                <div style={{ marginBottom: 12 }}>
                  <img src={urlDeImagem(form.imagemUrl)} alt="Prévia da imagem"
                    style={{ height: 80, maxWidth: 220, borderRadius: 12, objectFit: 'contain', background: '#fff', border: '1px solid var(--border)' }}
                    onError={e => { e.currentTarget.style.opacity = 0.25; }} />
                </div>
              )}

              <div className="field-group">
                <label>Onde atende</label>
                <span className="field-hint">Usado no filtro de localização do aplicativo. Deixe estado e cidade em branco se o atendimento for só on-line.</span>
                <div className="field-row" style={{ marginTop: 8 }}>
                  <div className="field-group" style={{ marginBottom: 8 }}>
                    <label>Estado</label>
                    <select value={form.estado} onChange={e => set('estado', e.target.value)}>
                      <option value="">— Sem estado —</option>
                      {UFS.map(e => <option key={e.uf} value={e.uf}>{e.nome} ({e.uf})</option>)}
                    </select>
                  </div>
                  <div className="field-group" style={{ marginBottom: 8 }}>
                    <label>Cidade</label>
                    <input type="text" value={form.cidade}
                      onChange={e => set('cidade', e.target.value)}
                      placeholder="Ex.: Vitória" />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.atendimentoOnline}
                    onChange={e => set('atendimentoOnline', e.target.checked)}
                    style={{ width: 16, height: 16 }} />
                  Oferece atendimento on-line
                </label>
              </div>

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
                  background: 'var(--primary-lav)', borderRadius: 16,
                  padding: 14, marginBottom: 16,
                }}>
                  <div className="field-row">
                    <div className="field-group" style={{ marginBottom: 8 }}>
                      <label>Desconto para a usuária (%)</label>
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
                  <p style={{ fontSize: 12.5, color: 'var(--acento-lilas-texto)', margin: '0 0 12px' }}>
                    Desconto que chega à usuária: <strong>{descontoClienteCalculado.toFixed(1)}%</strong>
                    {'  ·  '}Comissão da Atravessia: <strong>{form.percentualComissao || 0}% do valor original</strong>
                  </p>

                  <p style={{
                    fontSize: 12.5, color: 'var(--acento-lilas-texto)', lineHeight: 1.55, margin: '0 0 12px',
                    background: 'var(--surface)', border: '1px solid var(--primary-200)',
                    borderRadius: 12, padding: '9px 12px',
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

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--cor-borda)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                      <input type="checkbox" checked={form.cashbackAtivo} onChange={e => set('cashbackAtivo', e.target.checked)} style={{ width: 16, height: 16 }} />
                      Esta parceria dá cashback
                    </label>
                    {form.cashbackAtivo && (
                      <div className="field-row" style={{ marginTop: 10 }}>
                        <div className="field-group">
                          <label>Cashback desta parceria (%)</label>
                          <input value={form.cashbackPercentual} onChange={e => set('cashbackPercentual', e.target.value)} inputMode="decimal" placeholder="Vazio = percentual geral do Cashback" />
                        </div>
                        <div className="field-group">
                          <label>Condições (aparece para a usuária)</label>
                          <input value={form.cashbackCondicoes} onChange={e => set('cashbackCondicoes', e.target.value)} placeholder="Ex.: válido em serviços acima de R$ 100" />
                        </div>
                      </div>
                    )}
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
