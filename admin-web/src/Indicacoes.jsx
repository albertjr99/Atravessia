import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ehDataISO, situacaoAchado } from './vigenciaUtils';
import { db, storage } from './firebase';
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { IconCamera, IconClose, IconEdit, IconEye, IconEyeOff, IconGift, IconLink, IconTrash } from './Icons';
import { urlDeImagem } from './parceriaUtils';
import Recolhivel from './Recolhivel';
import {
  PLATAFORMAS_AFILIADO, LIMITES_AFILIADO, nomePlataforma, textoBotaoAfiliado, seloCashback, regraCashback,
  calcularCashback, reaisParaCentavos, centavosParaTexto, brlCentavos, numOuNull,
} from './afiliadosUtils';

// Afiliados (antes "Indicações Amazon"), porte de AdminIndicacoesScreen.js.
// Coleção `indicacoes` mantida; a comissão do app fica em afiliadosPrivado/{id}
// (só admin lê). No app, a usuária vê esta vitrine como "Achados da Atravessia".
// Mesmas categorias de src/screens/indicacoes/IndicacoesScreen.js no app.
export const CATEGORIAS_INDICACAO = [
  { id: 'livros', rotulo: 'Livros' },
  { id: 'diario', rotulo: 'Diário e escrita' },
  { id: 'bemestar', rotulo: 'Bem-estar' },
  { id: 'casa', rotulo: 'Casa e conforto' },
  { id: 'presentes', rotulo: 'Para presentear' },
  { id: 'outros', rotulo: 'Outros' },
];
const VAZIO = {
  titulo: '', descricao: '', imagemUrl: '', imagemCaminho: '', link: '', categoria: 'livros', ordem: '', ativo: true,
  plataforma: 'amazon', plataformaNome: '', textoBotao: '',
  cashbackAtivo: false, cashbackTipo: 'fixo', cashbackFixo: '', cashbackPercentual: '',
  comissaoPercentual: '', precoReferencia: '',
  publicarDe: '', publicarAte: '',
};
const soNumero = (v) => v.replace(/[^\d,.]/g, '');

// Filtro rápido por situação de publicação (datas opcionais + visível/oculto).
const SITUACOES = [
  { id: 'todas', rotulo: 'Todas as situações' },
  { id: 'no_ar', rotulo: 'No ar' },
  { id: 'agendado', rotulo: 'Agendados' },
  { id: 'encerrado', rotulo: 'Encerrados' },
  { id: 'oculto', rotulo: 'Ocultos' },
];
const naSituacao = (item, sit) => {
  if (sit === 'todas') return true;
  if (sit === 'oculto') return item.ativo === false;
  if (sit === 'no_ar') return item.ativo !== false && situacaoAchado(item).id === 'no_ar';
  return situacaoAchado(item).id === sit;
};
const CLASSE_SITUACAO = { agendado: 'vig-futura', no_ar: 'vig-ok', encerrado: 'vig-vencida' };

function normalizarLink(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

export default function Indicacoes({ showToast, irPara, parametros }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [situacao, setSituacao] = useState('todas');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => onSnapshot(collection(db, 'indicacoes'), (snap) => {
    setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }, () => setLoading(false)), []);
  useEffect(() => onSnapshot(collection(db, 'pedidosCashbackAfiliado'), (snap) => {
    setPendentes(snap.docs.filter(d => d.data().status === 'pendente').length);
  }, () => {}), []);

  const ordenados = useMemo(() => [...itens].sort((a, b) =>
    (Number(a.ordem) || 999) - (Number(b.ordem) || 999) || String(a.titulo || '').localeCompare(String(b.titulo || ''))), [itens]);
  const lista = (filtro === 'todas' ? ordenados : ordenados.filter(i => (i.categoria || 'outros') === filtro))
    .filter(i => naSituacao(i, situacao));
  const totalCliques = itens.reduce((s, i) => s + (i.cliques || 0), 0);
  const ativos = itens.filter(i => i.ativo !== false).length;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const abrirNovo = () => { setForm(VAZIO); setModal({ mode: 'add' }); };
  const abrirEditar = async (item) => {
    setForm({
      ...VAZIO,
      titulo: item.titulo || '', descricao: item.descricao || '', imagemUrl: item.imagemUrl || '',
      imagemCaminho: item.imagemCaminho || '',
      link: item.link || '', categoria: item.categoria || 'outros',
      ordem: item.ordem != null ? String(item.ordem) : '', ativo: item.ativo !== false,
      plataforma: item.plataforma || 'amazon', plataformaNome: item.plataformaNome || '', textoBotao: item.textoBotao || '',
      cashbackAtivo: item.cashbackAtivo === true, cashbackTipo: item.cashbackTipo === 'percentual' ? 'percentual' : 'fixo',
      cashbackFixo: centavosParaTexto(item.cashbackFixoCentavos),
      cashbackPercentual: item.cashbackPercentual != null ? String(item.cashbackPercentual).replace('.', ',') : '',
      publicarDe: ehDataISO(item.publicarDe) ? item.publicarDe : '',
      publicarAte: ehDataISO(item.publicarAte) ? item.publicarAte : '',
    });
    setModal({ mode: 'edit', item });
    try {
      const priv = (await getDoc(doc(db, 'afiliadosPrivado', item.id))).data() || {};
      setForm(p => ({
        ...p,
        comissaoPercentual: priv.comissaoPercentual != null ? String(priv.comissaoPercentual).replace('.', ',') : '',
        precoReferencia: centavosParaTexto(priv.precoReferenciaCentavos),
      }));
    } catch { /* sem dados internos ainda */ }
  };
  const fechar = () => { setModal(null); setForm(VAZIO); };

  // Atalho do Dashboard ("Achados que encerram"): abre direto a edição.
  const editarPedido = useRef(null);
  useEffect(() => {
    const id = parametros?.editarId;
    if (!id || loading || editarPedido.current === id) return;
    const item = itens.find(i => i.id === id);
    if (item) { editarPedido.current = id; abrirEditar(item); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametros, loading, itens]);

  const salvar = async () => {
    if (!form.titulo.trim()) { showToast('Informe o nome do produto.', 'error'); return; }
    if ((form.publicarDe && !ehDataISO(form.publicarDe)) || (form.publicarAte && !ehDataISO(form.publicarAte))) {
      showToast('Confira as datas de publicação.', 'error'); return;
    }
    if (form.publicarDe && form.publicarAte && form.publicarAte < form.publicarDe) {
      showToast('“Publicar até” não pode ser antes de “Publicar a partir de”.', 'error'); return;
    }
    const link = normalizarLink(form.link);
    if (!link) { showToast('Cole o link de afiliado da loja.', 'error'); return; }
    if (form.plataforma === 'outra' && !form.plataformaNome.trim()) { showToast('Escreva o nome da loja.', 'error'); return; }
    const fixo = reaisParaCentavos(form.cashbackFixo);
    const percentual = numOuNull(form.cashbackPercentual);
    if (form.cashbackAtivo) {
      if (form.cashbackTipo === 'fixo' && !(fixo > 0)) { showToast('Informe o valor do cashback em reais.', 'error'); return; }
      if (form.cashbackTipo === 'percentual' && !(percentual > 0)) { showToast('Informe o percentual do cashback.', 'error'); return; }
      if (form.cashbackTipo === 'percentual' && percentual > LIMITES_AFILIADO.percentualMax) { showToast(`O cashback pode ser de até ${LIMITES_AFILIADO.percentualMax}%.`, 'error'); return; }
      if (form.cashbackTipo === 'fixo' && fixo > LIMITES_AFILIADO.cashbackMaxCentavos) { showToast(`O cashback pode ser de até ${brlCentavos(LIMITES_AFILIADO.cashbackMaxCentavos)}.`, 'error'); return; }
    }
    setSalvando(true);
    const dados = {
      titulo: form.titulo.trim(), descricao: form.descricao.trim(), imagemUrl: form.imagemUrl.trim(),
      imagemCaminho: form.imagemUrl.trim() && form.imagemCaminho ? form.imagemCaminho : null,
      link, categoria: form.categoria, ordem: Number(form.ordem) || null, ativo: form.ativo,
      plataforma: form.plataforma, plataformaNome: form.plataforma === 'outra' ? form.plataformaNome.trim() : '',
      textoBotao: form.textoBotao.trim(),
      cashbackAtivo: !!form.cashbackAtivo, cashbackTipo: form.cashbackTipo,
      cashbackFixoCentavos: fixo || null, cashbackPercentual: percentual,
      // Período no ar ('AAAA-MM-DD', opcionais): fora dele a usuária não vê o item.
      publicarDe: form.publicarDe || null, publicarAte: form.publicarAte || null,
    };
    const privado = {
      comissaoPercentual: numOuNull(form.comissaoPercentual),
      precoReferenciaCentavos: reaisParaCentavos(form.precoReferencia) || null,
      atualizadoEm: serverTimestamp(),
    };
    try {
      let id = modal.item?.id;
      if (modal.mode === 'add') id = (await addDoc(collection(db, 'indicacoes'), { ...dados, cliques: 0, criadoEm: serverTimestamp() })).id;
      else await updateDoc(doc(db, 'indicacoes', id), dados);
      await setDoc(doc(db, 'afiliadosPrivado', id), privado, { merge: true });
      showToast(modal.mode === 'add' ? 'Item de afiliado adicionado.' : 'Item de afiliado atualizado.');
      fechar();
    } catch (e) {
      showToast(`Erro ao salvar: ${e.message || ''}`, 'error');
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (item) => {
    await updateDoc(doc(db, 'indicacoes', item.id), { ativo: item.ativo === false });
    showToast(item.ativo === false ? 'Item visível no app.' : 'Item ocultado.');
  };
  const excluir = async (item) => {
    if (!window.confirm(`Excluir "${item.titulo}"? Esta ação não pode ser desfeita.`)) return;
    await deleteDoc(doc(db, 'indicacoes', item.id));
    deleteDoc(doc(db, 'afiliadosPrivado', item.id)).catch(() => {});
    if (item.imagemCaminho) deleteObject(sRef(storage, item.imagemCaminho)).catch(() => {});
    showToast('Item excluído.');
  };

  const enviarFoto = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Escolha um arquivo de imagem.', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('A foto precisa ter até 10 MB.', 'error'); return; }
    setEnviandoFoto(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const caminho = `afiliados/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const r = sRef(storage, caminho);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      setForm(p => ({ ...p, imagemUrl: url, imagemCaminho: caminho }));
      showToast('Foto enviada.');
    } catch (e) {
      showToast(`Não foi possível enviar a foto: ${e.code || e.message || ''}`, 'error');
    } finally {
      setEnviandoFoto(false);
    }
  };

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  const previa = urlDeImagem(form.imagemUrl);
  const plat = PLATAFORMAS_AFILIADO.find(p => p.id === form.plataforma) || PLATAFORMAS_AFILIADO[0];
  const linkConfere = !form.link || !plat.padrao || plat.padrao.test(form.link);
  const regraForm = { cashbackAtivo: true, cashbackTipo: form.cashbackTipo, cashbackFixoCentavos: reaisParaCentavos(form.cashbackFixo), cashbackPercentual: numOuNull(form.cashbackPercentual) };
  const seloForm = form.cashbackAtivo ? seloCashback(regraForm) : null;
  const simPreco = reaisParaCentavos(form.precoReferencia) || 0;
  const simComissao = simPreco && numOuNull(form.comissaoPercentual) ? Math.floor(simPreco * numOuNull(form.comissaoPercentual) / 100) : 0;
  const simCashback = simPreco && form.cashbackAtivo ? calcularCashback(regraCashback(regraForm), simPreco) : 0;
  const botaoPadrao = textoBotaoAfiliado({ plataforma: form.plataforma, plataformaNome: form.plataformaNome });

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Afiliados</h1>
          <p className="screen-sub">Vitrine de produtos com link de afiliado (Amazon, Mercado Livre, Shopee, Magalu e outras). No app, a usuária vê esta vitrine como “Achados da Atravessia”.</p>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>+ Novo item de afiliado</button>
      </div>

      <button type="button" className={`af-pedidos-aviso ${pendentes ? 'af-pedidos-alerta' : ''}`} onClick={() => irPara?.('pedidosCashback')}>
        <span className="af-pedidos-textos">
          <strong>Pedidos de cashback</strong>
          <span>{pendentes ? `${pendentes} aguardando análise` : 'Nenhum pedido aguardando análise'}</span>
        </span>
        <span aria-hidden="true">→</span>
      </button>

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
      <div className="filter-row" style={{ flexWrap: 'wrap' }} aria-label="Filtrar por situação">
        {SITUACOES.map(s => {
          const n = s.id === 'todas' ? null : itens.filter(i => naSituacao(i, s.id)).length;
          return (
            <button key={s.id} className={`chip ${situacao === s.id ? 'chip-active' : ''}`} onClick={() => setSituacao(s.id)}>
              {s.rotulo}{n ? ` (${n})` : ''}
            </button>
          );
        })}
      </div>

      {itens.length > 0 && lista.length === 0 && (
        <div className="empty-state"><p>Nenhum item neste filtro.</p></div>
      )}

      {itens.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon"><IconGift size={34} /></div>
          <p>Nenhum item ainda.<br />Entre no programa de afiliados da loja (Amazon Associados, Mercado Livre, Shopee, Magalu…), gere o link de afiliado do produto e cadastre aqui com uma foto.</p>
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
                <span className="ind-sub">{nomePlataforma(item)} · {item.cliques || 0} clique{(item.cliques || 0) === 1 ? '' : 's'}{item.ordem ? ` · ordem ${item.ordem}` : ''}</span>
                {seloCashback(item) && <span className="af-selo">{seloCashback(item)}</span>}
                {situacaoAchado(item).texto && (
                  <span className={`vig-selo ind-situacao ${CLASSE_SITUACAO[situacaoAchado(item).id]}`}>{situacaoAchado(item).texto}</span>
                )}
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
              <h2>{modal.mode === 'add' ? 'Novo item de afiliado' : 'Editar item de afiliado'}</h2>
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
                <label>Loja</label>
                <div className="filter-row" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
                  {PLATAFORMAS_AFILIADO.map(p => (
                    <button key={p.id} type="button" className={`chip ${form.plataforma === p.id ? 'chip-active' : ''}`} onClick={() => set('plataforma', p.id)}>{p.nome}</button>
                  ))}
                </div>
                {form.plataforma === 'outra' && (
                  <input type="text" style={{ marginTop: 8 }} value={form.plataformaNome} onChange={e => set('plataformaNome', e.target.value)} placeholder="Nome da loja (ex.: Amazon Kindle, Americanas)" />
                )}
              </div>
              <div className="field-group">
                <label>Link de afiliado <span style={{ color: 'var(--rose)' }}>*</span></label>
                <input type="url" value={form.link} onChange={e => set('link', e.target.value)} placeholder={plat.exemplo} />
                {!linkConfere && <span className="field-hint" style={{ color: 'var(--cor-aviso)' }}>Este link não parece ser da {plat.nome}. Confira se é o link de afiliado.</span>}
              </div>
              <div className="field-group">
                <label>Texto do botão</label>
                <input type="text" value={form.textoBotao} onChange={e => set('textoBotao', e.target.value)} placeholder={botaoPadrao} maxLength={40} />
                <span className="field-hint">Deixe em branco para usar “{botaoPadrao}”.</span>
              </div>
              <div className="field-group">
                <label>Foto do produto</label>
                <label className={`af-upload ${enviandoFoto ? 'af-upload-ocupado' : ''}`}>
                  <input type="file" accept="image/*" hidden disabled={enviandoFoto} onChange={e => { enviarFoto(e.target.files?.[0]); e.target.value = ''; }} />
                  <IconCamera size={18} />
                  <span>{enviandoFoto ? 'Enviando…' : form.imagemCaminho ? 'Trocar foto' : 'Enviar foto do computador'}</span>
                </label>
                <span className="field-hint">Ou cole o link de uma imagem (link direto ou Google Drive):</span>
                <input type="url" value={form.imagemUrl} onChange={e => setForm(p => ({ ...p, imagemUrl: e.target.value, imagemCaminho: '' }))} placeholder="https://..." />
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
              <div className="field-row">
                <div className="field-group">
                  <label>Publicar a partir de <span className="aln-opcional">(opcional)</span></label>
                  <input type="date" value={form.publicarDe} onChange={e => set('publicarDe', e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Publicar até <span className="aln-opcional">(opcional)</span></label>
                  <input type="date" value={form.publicarAte} min={form.publicarDe || undefined} onChange={e => set('publicarAte', e.target.value)} />
                </div>
              </div>
              <span className="field-hint" style={{ display: 'block', marginTop: -6, marginBottom: 12 }}>
                Fora deste período o item não aparece no app. Em branco = sem limite.
                {situacaoAchado(form).texto ? ` Situação: ${situacaoAchado(form).texto}.` : ''}
              </span>
              <Recolhivel
                titulo="Cashback e comissão"
                subtitulo={form.cashbackAtivo ? 'Este item dá cashback' : 'Sem cashback para a usuária'}
                inicialAberto={form.cashbackAtivo}
                className="af-recolhivel"
              >
                <p className="af-nota">A comissão do app é só para vocês: a usuária vê apenas o cashback dela.</p>
                <div className="af-duas">
                  <div className="field-group">
                    <label>Comissão do app na loja (%)</label>
                    <input type="text" inputMode="decimal" value={form.comissaoPercentual} onChange={e => set('comissaoPercentual', soNumero(e.target.value))} placeholder="Ex.: 10" />
                  </div>
                  <div className="field-group">
                    <label>Preço de referência (R$)</label>
                    <input type="text" inputMode="decimal" value={form.precoReferencia} onChange={e => set('precoReferencia', soNumero(e.target.value))} placeholder="Ex.: 22,00" />
                  </div>
                </div>
                <div className="toggle-row">
                  <label className="toggle">
                    <input type="checkbox" checked={form.cashbackAtivo} onChange={e => set('cashbackAtivo', e.target.checked)} />
                    <span className="toggle-slider" />
                  </label>
                  <span style={{ fontSize: 13, color: 'var(--text-dark)' }}>Dar cashback à usuária</span>
                </div>
                {form.cashbackAtivo && (
                  <div className="field-group">
                    <div className="filter-row" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
                      <button type="button" className={`chip ${form.cashbackTipo === 'fixo' ? 'chip-active' : ''}`} onClick={() => set('cashbackTipo', 'fixo')}>Valor fixo (R$)</button>
                      <button type="button" className={`chip ${form.cashbackTipo === 'percentual' ? 'chip-active' : ''}`} onClick={() => set('cashbackTipo', 'percentual')}>% do valor da compra</button>
                    </div>
                    {form.cashbackTipo === 'fixo'
                      ? <input type="text" inputMode="decimal" value={form.cashbackFixo} onChange={e => set('cashbackFixo', soNumero(e.target.value))} placeholder="Ex.: 0,20" />
                      : <input type="text" inputMode="decimal" value={form.cashbackPercentual} onChange={e => set('cashbackPercentual', soNumero(e.target.value))} placeholder="Ex.: 1 (= 1% do valor pago)" />}
                    {seloForm && <span className="field-hint">No app aparece: “{seloForm}”.</span>}
                  </div>
                )}
                {!!simPreco && (simComissao > 0 || simCashback > 0) && (
                  <div className="af-simulacao">
                    <strong>Simulação numa compra de {brlCentavos(simPreco)}</strong>
                    {simComissao > 0 && <span>Comissão estimada do app: {brlCentavos(simComissao)}</span>}
                    {simCashback > 0 && <span>Cashback para a usuária: {brlCentavos(simCashback)}</span>}
                    {simComissao > 0 && simCashback > simComissao && <span className="af-alerta">O cashback está maior que a comissão: o app pagaria a diferença.</span>}
                  </div>
                )}
              </Recolhivel>
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
