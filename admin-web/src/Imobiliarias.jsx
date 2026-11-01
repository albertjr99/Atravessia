import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from './firebase';
import Recolhivel from './Recolhivel';
import AcoesItem from './AcoesItem';
import { IconClose, IconHome, IconLink, IconPerson, IconUpload, IconWhatsapp, IconAlert, IconRefresh } from './Icons';
import { urlDeImagem } from './parceriaUtils';
import {
  STATUS_LEAD, TODOS_STATUS, TIPOS_IMOBILIARIA, TIPOS_IMOVEL, rotuloTipoImovel, precoTexto,
  brlCentavos, dataTexto, dataHoraTexto, listaDeTexto, numero, linkWhatsapp,
} from './imoveisUtils';
import './imobiliarias.css';

// "Imobiliárias" (Parcerias · Lar e recomeço): leads em funil, cadastro de
// imobiliárias (com dados privados do acordo), imóveis, arquitetos e resumo
// financeiro. As mudanças de etapa dos leads passam pelas Cloud Functions da
// seção IMOBILIÁRIAS (functions/index.js). Espelha AdminImobiliariasScreen.js (app).

const SECOES = [
  { id: 'leads', rotulo: 'Leads' },
  { id: 'imobiliarias', rotulo: 'Imobiliárias' },
  { id: 'imoveis', rotulo: 'Imóveis' },
  { id: 'arquitetos', rotulo: 'Arquitetos' },
  { id: 'financeiro', rotulo: 'Financeiro' },
];
const chama = (nome, dados) => httpsCallable(functions, nome)(dados).then(r => r.data);
const ordenar = (l) => [...l].sort((a, b) => (Number(a.ordem) || 999) - (Number(b.ordem) || 999) || String(a.nome || a.titulo).localeCompare(String(b.nome || b.titulo)));
const tsMs = (ts) => ts?.toMillis?.() ?? 0;
const linkPortal = (token) => `${window.location.origin}/imobiliaria.html?t=${token}`;

async function enviarArquivos(pasta, arquivos) {
  const urls = [];
  for (const f of arquivos) {
    const r = storageRef(storage, `imoveis/${pasta}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    await uploadBytes(r, f, { contentType: f.type || 'image/jpeg' });
    urls.push(await getDownloadURL(r));
  }
  return urls;
}

function Campo({ rotulo, dica, opcional, children }) {
  return (
    <div className="field-group">
      <label>{rotulo} {opcional && <span className="aln-opcional">(opcional)</span>}</label>
      {children}
      {dica && <span className="field-hint">{dica}</span>}
    </div>
  );
}

function Chips({ opcoes, valor, onMudar, multiplo }) {
  const sel = (id) => (multiplo ? (valor || []).includes(id) : valor === id);
  const tocar = (id) => {
    if (!multiplo) return onMudar(id);
    const a = valor || [];
    onMudar(a.includes(id) ? a.filter(x => x !== id) : [...a, id]);
  };
  return (
    <div className="imv-chips">
      {opcoes.map(o => (
        <button type="button" key={o.id} className={`chip ${sel(o.id) ? 'chip-active' : ''}`} onClick={() => tocar(o.id)}>{o.rotulo}</button>
      ))}
    </div>
  );
}

const Etiqueta = ({ status }) => {
  const i = STATUS_LEAD[status] || STATUS_LEAD.novo;
  return <span className={`imv-etq imv-tom-${i.tom}`}>{i.curto}</span>;
};

function EnviarImagem({ pasta, multiplo, onEnviado, rotulo = 'Enviar imagem', showToast }) {
  const [enviando, setEnviando] = useState(false);
  return (
    <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <IconUpload size={15} /> {enviando ? 'Enviando…' : rotulo}
      <input type="file" accept="image/*" multiple={!!multiplo} hidden disabled={enviando} onChange={async (e) => {
        const arqs = [...(e.target.files || [])];
        e.target.value = '';
        if (!arqs.length) return;
        setEnviando(true);
        try { onEnviado(await enviarArquivos(pasta, arqs)); } catch (err) { showToast?.(err?.message || 'Falha no envio.', 'error'); } finally { setEnviando(false); }
      }} />
    </label>
  );
}

// ============================ LEADS =========================================
function Leads({ leads, privLeads, imobiliarias, arquitetos, arqPriv, showToast }) {
  const [status, setStatus] = useState('todos');
  const [imob, setImob] = useState('todas');
  const [busca, setBusca] = useState('');
  const [acao, setAcao] = useState(null);
  const [f, setF] = useState({});
  const [enviando, setEnviando] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const contagem = useMemo(() => leads.reduce((c, l) => ({ ...c, [l.status]: (c[l.status] || 0) + 1 }), {}), [leads]);
  const termo = busca.trim().toUpperCase();
  const lista = leads.filter(l => (status === 'todos' || l.status === status) && (imob === 'todas' || l.imobiliariaId === imob)
    && (!termo || String(l.codigo).includes(termo) || String(l.nome || '').toUpperCase().includes(termo)));

  const abrir = (tipo, lead) => {
    const p = privLeads[lead.id] || {};
    const c = lead.consultoria || {};
    const d = c.data?.toDate ? c.data.toDate() : null;
    const local = d ? new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 16) : '';
    setF({
      valor: tipo === 'repasse' ? ((p.repassePrevistoCentavos || 0) / 100).toFixed(2) : tipo === 'pagarArq' ? ((p.custoArquitetoCentavos || 0) / 100).toFixed(2) : '',
      arquitetoId: lead.arquitetoId || '', dataHora: local, duracao: String(c.duracaoHoras || 2),
      link: c.link || '', observacao: c.observacao || '', comprovante: '',
    });
    setAcao({ tipo, lead });
  };

  const executar = async () => {
    const { tipo, lead } = acao;
    setEnviando(true);
    try {
      if (tipo === 'repasse') await chama('confirmarRepasseImobiliaria', { leadId: lead.id, valorRecebido: f.valor });
      if (tipo === 'agendar') {
        if (!f.arquitetoId) throw new Error('Escolha o arquiteto.');
        if (!f.dataHora) throw new Error('Informe data e hora.');
        await chama('agendarConsultoria', { leadId: lead.id, arquitetoId: f.arquitetoId, dataHora: f.dataHora, link: f.link.trim(), duracaoHoras: numero(f.duracao) || 2, observacao: f.observacao });
      }
      if (tipo === 'pagarArq') await chama('atualizarLeadAdmin', { leadId: lead.id, acao: 'pagarArquiteto', valor: f.valor, comprovanteUrl: f.comprovante.trim() });
      setAcao(null);
      showToast('Pronto! A usuária é avisada quando a etapa muda.');
    } catch (e) {
      showToast(e?.message || 'Não foi possível concluir.', 'error');
    } finally { setEnviando(false); }
  };

  const simples = async (lead, a, extra = {}, pergunta) => {
    if (pergunta && !window.confirm(pergunta)) return;
    try { await chama('atualizarLeadAdmin', { leadId: lead.id, acao: a, ...extra }); showToast('Atualizado.'); } catch (e) { showToast(e?.message || 'Não foi possível.', 'error'); }
  };

  return (
    <>
      <div className="imv-funil">
        {TODOS_STATUS.map(s => (
          <button type="button" key={s} className={`imv-funil-item ${status === s ? 'ativo' : ''}`} onClick={() => setStatus(status === s ? 'todos' : s)}>
            <span className="imv-funil-n">{contagem[s] || 0}</span>
            <span className="imv-funil-l">{STATUS_LEAD[s].curto}</span>
          </button>
        ))}
      </div>
      <div className="imv-filtros">
        <Campo rotulo="Etapa">
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="todos">Todas ({leads.length})</option>
            {TODOS_STATUS.map(s => <option key={s} value={s}>{STATUS_LEAD[s].curto} ({contagem[s] || 0})</option>)}
          </select>
        </Campo>
        <Campo rotulo="Imobiliária">
          <select value={imob} onChange={e => setImob(e.target.value)}>
            <option value="todas">Todas</option>
            {imobiliarias.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Buscar por código ou nome">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="ATR-IMV-…" />
        </Campo>
      </div>

      {lista.length === 0 ? <div className="empty-state"><p>Nenhuma indicação com esses filtros.</p></div> : (
        <div className="imv-lista">
          {lista.map(l => {
            const p = privLeads[l.id] || {};
            const arqPago = !!p.arquitetoPagoEm;
            return (
              <article key={l.id} className="card imv-card">
                <div className="imv-card-topo"><span className="imv-codigo">{l.codigo}</span><Etiqueta status={l.status} /></div>
                <div className="imv-nome">{l.nome} · {l.telefone}</div>
                <div className="imv-leg">{l.imobiliariaNome}{l.imovelTitulo ? ` · ${l.imovelTitulo}` : ''}</div>
                <div className="imv-leg">{l.interesse === 'alugar' ? 'Alugar' : 'Comprar'}{l.faixaPreco ? ` · ${l.faixaPreco}` : ''}{l.prazo ? ` · ${l.prazo}` : ''}{l.bairros ? ` · ${l.bairros}` : ''}</div>
                {l.observacoes && <div className="imv-leg">“{l.observacoes}”</div>}
                <div className="imv-leg" style={{ fontSize: 12 }}>Enviada em {dataHoraTexto(l.criadoEm)}{l.validadoEm ? ` · código validado em ${dataTexto(l.validadoEm)}` : ''} · consentimento LGPD v{l.consentimento?.versao || '—'}</div>
                {(p.valorNegocioCentavos != null || p.custoArquitetoCentavos != null) && (
                  <div className="imv-fin">
                    {p.valorNegocioCentavos != null && <span>Negócio: <b>{brlCentavos(p.valorNegocioCentavos)}</b></span>}
                    {p.repassePrevistoCentavos != null && <span>Repasse previsto: <b>{brlCentavos(p.repassePrevistoCentavos)}</b></span>}
                    {p.repasseEnviado?.em && <span style={{ color: 'var(--acento-dourado-texto)' }}>Imobiliária informou o envio em {dataTexto(p.repasseEnviado.em)}{p.repasseEnviado.comprovanteUrl && <> · <a href={p.repasseEnviado.comprovanteUrl} target="_blank" rel="noreferrer">comprovante</a></>}{p.repasseEnviado.observacao ? ` · ${p.repasseEnviado.observacao}` : ''}</span>}
                    {p.repasseCentavos != null && <span style={{ color: 'var(--acento-salvia-texto)' }}>Recebido: <b>{brlCentavos(p.repasseCentavos)}</b> em {dataTexto(p.pagoEm)}</span>}
                    {p.custoArquitetoCentavos != null && <span>Arquiteto: {brlCentavos(p.custoArquitetoCentavos)} · {arqPago ? `pago em ${dataTexto(p.arquitetoPagoEm)}` : 'a pagar'}</span>}
                  </div>
                )}
                {l.consultoria?.status === 'agendada' && (
                  <div className="imv-leg" style={{ color: 'var(--acento-salvia-texto)' }}>
                    Consultoria com {l.arquitetoNome}: {dataHoraTexto(l.consultoria.data)}{l.consultoria.link && <> · <a href={l.consultoria.link} target="_blank" rel="noreferrer">link</a></>}
                  </div>
                )}
                <div className="imv-acoes">
                  {l.telefone && <a className="btn-secondary" href={linkWhatsapp(l.telefone, `Olá, ${l.nome}! Aqui é da Atravessia, sobre sua indicação ${l.codigo}.`)} target="_blank" rel="noreferrer"><IconWhatsapp size={14} /> WhatsApp</a>}
                  {l.status === 'fechado' && <button type="button" className="btn-primary" onClick={() => abrir('repasse', l)}>Confirmar recebimento do repasse</button>}
                  {['pago', 'consultoria_agendada'].includes(l.status) && <button type="button" className="btn-primary" onClick={() => abrir('agendar', l)}>{l.status === 'pago' ? 'Agendar consultoria' : 'Reagendar'}</button>}
                  {l.status === 'consultoria_agendada' && <button type="button" className="btn-secondary" onClick={() => simples(l, 'concluirConsultoria', {}, 'Marcar a consultoria como concluída?')}>Consultoria concluída</button>}
                  {l.status === 'consultoria_agendada' && <button type="button" className="btn-ghost" onClick={() => simples(l, 'cancelarConsultoria', {}, 'Cancelar a consultoria agendada? A indicação volta para "Repasse recebido".')}>Cancelar consultoria</button>}
                  {['consultoria_agendada', 'concluido'].includes(l.status) && !arqPago && <button type="button" className="btn-secondary" onClick={() => abrir('pagarArq', l)}>Registrar pagamento ao arquiteto</button>}
                  {['novo', 'em_contato', 'visita', 'proposta', 'perdido'].includes(l.status) && (
                    <select value="" aria-label="Mudar etapa" onChange={e => e.target.value && simples(l, 'status', { status: e.target.value }, `Mudar para "${STATUS_LEAD[e.target.value].curto}"? A usuária é avisada.`)}>
                      <option value="">Mudar etapa…</option>
                      {['novo', 'em_contato', 'visita', 'proposta', 'perdido'].filter(s => s !== l.status).map(s => <option key={s} value={s}>{STATUS_LEAD[s].curto}</option>)}
                    </select>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {acao && (
        <div className="modal-overlay" onClick={() => !enviando && setAcao(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{acao.tipo === 'repasse' ? 'Confirmar recebimento' : acao.tipo === 'agendar' ? 'Agendar consultoria' : 'Pagamento ao arquiteto'}</h2>
              <button className="modal-close" onClick={() => setAcao(null)}><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              <p className="imv-leg" style={{ marginTop: 0 }}>{acao.lead.codigo} · {acao.lead.nome} · {acao.lead.imobiliariaNome}</p>
              {acao.tipo === 'repasse' && (
                <Campo rotulo="Valor recebido da imobiliária (R$)" dica="Vem com o valor previsto pelo acordo. Ao confirmar, o valor fica congelado e a usuária é avisada de que a consultoria foi liberada.">
                  <input type="number" step="0.01" min="0" value={f.valor} onChange={e => set('valor', e.target.value)} />
                </Campo>
              )}
              {acao.tipo === 'agendar' && (
                <>
                  <Campo rotulo="Arquiteto">
                    <select value={f.arquitetoId} onChange={e => set('arquitetoId', e.target.value)}>
                      <option value="">Escolher…</option>
                      {arquitetos.filter(a => a.ativo !== false).map(a => <option key={a.id} value={a.id}>{a.nome}{arqPriv[a.id]?.valorConsultoria ? ` · R$ ${arqPriv[a.id].valorConsultoria}` : ''}</option>)}
                    </select>
                  </Campo>
                  <div className="field-row">
                    <Campo rotulo="Data e hora (Brasília)"><input type="datetime-local" value={f.dataHora} onChange={e => set('dataHora', e.target.value)} /></Campo>
                    <Campo rotulo="Duração (horas)"><input type="number" step="0.5" min="0.5" value={f.duracao} onChange={e => set('duracao', e.target.value)} /></Campo>
                  </div>
                  <Campo rotulo="Link da chamada"><input value={f.link} onChange={e => set('link', e.target.value)} placeholder="https://meet.google.com/…" /></Campo>
                  <Campo rotulo="Recado para a usuária" opcional><textarea rows={2} value={f.observacao} onChange={e => set('observacao', e.target.value)} /></Campo>
                </>
              )}
              {acao.tipo === 'pagarArq' && (
                <>
                  <Campo rotulo="Valor pago (R$)"><input type="number" step="0.01" min="0" value={f.valor} onChange={e => set('valor', e.target.value)} /></Campo>
                  <Campo rotulo="Link do comprovante" opcional><input value={f.comprovante} onChange={e => set('comprovante', e.target.value)} placeholder="https://…" /></Campo>
                </>
              )}
              <div className="modal-footer">
                <button className="btn-ghost" onClick={() => setAcao(null)} disabled={enviando}>Cancelar</button>
                <button className="btn-primary" onClick={executar} disabled={enviando}>{enviando ? 'Salvando…' : 'Confirmar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================ IMOBILIÁRIAS ==================================
const IMOB_VAZIA = {
  nome: '', logoUrl: '', capaUrl: '', descricao: '', creci: '', cidades: '', bairros: '', tipos: ['venda', 'aluguel'],
  site: '', whatsapp: '', instagram: '', destaques: '', ativo: true, ordem: '', regrasBeneficio: '',
  responsavel: '', telefoneInterno: '', emailInterno: '', repasseVendaTipo: 'fixo', repasseVendaValor: '',
  repasseAluguelTipo: 'fixo', repasseAluguelValor: '', prazoRepasseDias: '30', contratoUrl: '',
  vigenciaInicio: '', vigenciaFim: '', dadosPagamentoAtravessia: '', observacoes: '',
};

function Imobs({ imobiliarias, imobPriv, showToast }) {
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState(IMOB_VAZIA);
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const editar = (i) => {
    const p = imobPriv[i.id] || {};
    setEditId(i.id);
    setF({
      ...IMOB_VAZIA, ...i, ...p, tokenPortal: undefined,
      cidades: (i.cidades || []).join(', '), bairros: (i.bairros || []).join(', '), destaques: (i.destaques || []).join('\n'),
      ordem: i.ordem ?? '', repasseVendaValor: p.repasseVendaValor ?? '', repasseAluguelValor: p.repasseAluguelValor ?? '', prazoRepasseDias: p.prazoRepasseDias ?? '30',
    });
    setAberto(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const limpar = () => { setEditId(null); setF(IMOB_VAZIA); setAberto(false); };

  const salvar = async () => {
    if (!String(f.nome).trim()) { showToast('Informe o nome da imobiliária.', 'error'); return; }
    setSalvando(true);
    try {
      const id = editId || doc(collection(db, 'imobiliarias')).id;
      const t = (k) => String(f[k] ?? '').trim();
      await setDoc(doc(db, 'imobiliarias', id), {
        nome: t('nome'), logoUrl: t('logoUrl'), capaUrl: t('capaUrl'), descricao: t('descricao'), creci: t('creci'),
        cidades: listaDeTexto(f.cidades), bairros: listaDeTexto(f.bairros), tipos: f.tipos || [],
        site: t('site'), whatsapp: t('whatsapp').replace(/\D/g, ''), instagram: t('instagram'),
        destaques: listaDeTexto(String(f.destaques).replace(/\n/g, ',')).slice(0, 6), ativo: f.ativo !== false,
        ordem: f.ordem === '' ? null : numero(f.ordem), regrasBeneficio: t('regrasBeneficio'),
        atualizadoEm: serverTimestamp(), ...(editId ? {} : { criadoEm: serverTimestamp() }),
      }, { merge: true });
      await setDoc(doc(db, 'imobiliariasPrivado', id), {
        responsavel: t('responsavel'), telefoneInterno: t('telefoneInterno'), emailInterno: t('emailInterno'),
        repasseVendaTipo: f.repasseVendaTipo, repasseVendaValor: numero(f.repasseVendaValor),
        repasseAluguelTipo: f.repasseAluguelTipo, repasseAluguelValor: numero(f.repasseAluguelValor),
        prazoRepasseDias: numero(f.prazoRepasseDias) || null, contratoUrl: t('contratoUrl'),
        vigenciaInicio: t('vigenciaInicio'), vigenciaFim: t('vigenciaFim'),
        dadosPagamentoAtravessia: t('dadosPagamentoAtravessia'), observacoes: t('observacoes'), atualizadoEm: serverTimestamp(),
      }, { merge: true });
      showToast(editId ? 'Imobiliária atualizada.' : 'Imobiliária cadastrada. Gere o link do portal no cartão dela.');
      limpar();
    } catch (e) { showToast(e?.message || 'Não foi possível salvar.', 'error'); } finally { setSalvando(false); }
  };

  const portal = async (i, acao) => {
    try {
      const r = await chama('gerenciarPortalImobiliaria', { imobiliariaId: i.id, acao });
      if (r?.linkPortal) { await navigator.clipboard?.writeText(r.linkPortal); showToast('Novo link do portal copiado!'); } else showToast('Link revogado.');
    } catch (e) { showToast(e?.message || 'Não foi possível.', 'error'); }
  };
  const regra = (tipo, v) => (!numero(v) ? '—' : tipo === 'percentual' ? `${v}%` : `R$ ${v}`);
  const inp = (k, props = {}) => <input value={f[k] ?? ''} onChange={e => set(k, e.target.value)} {...props} />;

  return (
    <>
      <Recolhivel titulo={editId ? `Editar: ${f.nome || 'imobiliária'}` : 'Nova imobiliária'} subtitulo="Dados da vitrine e do acordo (privados)"
        icone={<IconHome size={18} />} aberto={aberto} onAlternar={setAberto}>
        <div className="imv-grupo">Vitrine (as usuárias veem)</div>
        <div className="field-row">
          <Campo rotulo="Nome *">{inp('nome')}</Campo>
          <Campo rotulo="CRECI">{inp('creci')}</Campo>
        </div>
        <Campo rotulo="Descrição"><textarea rows={3} value={f.descricao} onChange={e => set('descricao', e.target.value)} /></Campo>
        <div className="field-row">
          {['logoUrl', 'capaUrl'].map(k => (
            <Campo key={k} rotulo={k === 'logoUrl' ? 'Logo' : 'Capa'}>
              {f[k] && <img className="imv-mini" style={k === 'capaUrl' ? { width: '100%', height: 80 } : undefined} src={urlDeImagem(f[k])} alt="" />}
              <EnviarImagem pasta="imobiliarias" onEnviado={([u]) => u && set(k, u)} showToast={showToast} />
              <input style={{ marginTop: 8 }} value={f[k]} onChange={e => set(k, e.target.value)} placeholder="ou cole o link" />
            </Campo>
          ))}
        </div>
        <Campo rotulo="Atua com"><Chips multiplo valor={f.tipos} onMudar={(v) => set('tipos', v)} opcoes={TIPOS_IMOBILIARIA} /></Campo>
        <div className="field-row">
          <Campo rotulo="Cidades" dica="Separe por vírgula.">{inp('cidades')}</Campo>
          <Campo rotulo="Bairros de atuação" opcional>{inp('bairros')}</Campo>
        </div>
        <Campo rotulo="Destaques" dica="Um por linha, até 6 (ex.: Atendimento sem pressa)."><textarea rows={3} value={f.destaques} onChange={e => set('destaques', e.target.value)} /></Campo>
        <div className="field-row">
          <Campo rotulo="Site">{inp('site', { placeholder: 'https://' })}</Campo>
          <Campo rotulo="Instagram">{inp('instagram', { placeholder: '@imobiliaria' })}</Campo>
        </div>
        <div className="field-row">
          <Campo rotulo="WhatsApp público (com DDD)" dica="Usado no botão “Falar no WhatsApp com o código”.">{inp('whatsapp', { inputMode: 'tel' })}</Campo>
          <Campo rotulo="Ordem na vitrine">{inp('ordem', { type: 'number' })}</Campo>
        </div>
        <Campo rotulo="Regras do benefício (resumo para a usuária)" opcional dica="Vazio: aparece o texto padrão da consultoria com arquiteto parceiro.">
          <textarea rows={2} value={f.regrasBeneficio} onChange={e => set('regrasBeneficio', e.target.value)} />
        </Campo>
        <label className="imv-check"><input type="checkbox" checked={f.ativo !== false} onChange={e => set('ativo', e.target.checked)} /> Ativa no app</label>

        <div className="imv-grupo">Acordo (só administradoras)</div>
        <div className="field-row">
          <Campo rotulo="Responsável">{inp('responsavel')}</Campo>
          <Campo rotulo="Telefone interno">{inp('telefoneInterno', { inputMode: 'tel' })}</Campo>
        </div>
        <Campo rotulo="E-mail interno">{inp('emailInterno', { type: 'email' })}</Campo>
        <div className="field-row">
          <Campo rotulo="Repasse por venda">
            <select value={f.repasseVendaTipo} onChange={e => set('repasseVendaTipo', e.target.value)}>
              <option value="fixo">Valor fixo (R$)</option><option value="percentual">% do valor da venda</option>
            </select>
            <input style={{ marginTop: 8 }} value={f.repasseVendaValor} onChange={e => set('repasseVendaValor', e.target.value)} placeholder={f.repasseVendaTipo === 'percentual' ? 'Ex.: 0,5' : 'Ex.: 1500'} />
          </Campo>
          <Campo rotulo="Repasse por aluguel">
            <select value={f.repasseAluguelTipo} onChange={e => set('repasseAluguelTipo', e.target.value)}>
              <option value="fixo">Valor fixo (R$)</option><option value="percentual">% do 1º aluguel</option>
            </select>
            <input style={{ marginTop: 8 }} value={f.repasseAluguelValor} onChange={e => set('repasseAluguelValor', e.target.value)} placeholder={f.repasseAluguelTipo === 'percentual' ? 'Ex.: 30' : 'Ex.: 400'} />
          </Campo>
        </div>
        <div className="field-row">
          <Campo rotulo="Prazo do repasse (dias)">{inp('prazoRepasseDias', { type: 'number' })}</Campo>
          <Campo rotulo="Contrato (link do Drive)">{inp('contratoUrl')}</Campo>
        </div>
        <div className="field-row">
          <Campo rotulo="Vigência: início">{inp('vigenciaInicio', { type: 'date' })}</Campo>
          <Campo rotulo="Vigência: fim">{inp('vigenciaFim', { type: 'date' })}</Campo>
        </div>
        <Campo rotulo="Dados para a imobiliária pagar a Atravessia (PIX/conta)" dica="Aparece no portal da imobiliária.">
          <textarea rows={2} value={f.dadosPagamentoAtravessia} onChange={e => set('dadosPagamentoAtravessia', e.target.value)} />
        </Campo>
        <Campo rotulo="Observações internas" opcional><textarea rows={2} value={f.observacoes} onChange={e => set('observacoes', e.target.value)} /></Campo>
        <div className="imv-acoes">
          {editId && <button className="btn-ghost" onClick={limpar}>Cancelar edição</button>}
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : editId ? 'Salvar alterações' : 'Cadastrar imobiliária'}</button>
        </div>
      </Recolhivel>

      {imobiliarias.length === 0 ? <div className="empty-state"><p>Nenhuma imobiliária cadastrada ainda.</p></div> : (
        <div className="imv-grade">
          {imobiliarias.map(i => {
            const p = imobPriv[i.id] || {};
            return (
              <article key={i.id} className="card imv-card" style={i.ativo === false ? { opacity: 0.7 } : undefined}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {i.logoUrl ? <img className="imv-logo" src={urlDeImagem(i.logoUrl)} alt="" /> : <span className="imv-logo" style={{ display: 'grid', placeItems: 'center' }}><IconHome size={20} /></span>}
                  <div style={{ minWidth: 0 }}>
                    <div className="imv-nome" style={{ marginTop: 0 }}>{i.nome}{i.ativo === false ? ' (oculta)' : ''}</div>
                    <div className="imv-leg">{(i.cidades || []).join(', ') || 'Sem cidade'}{i.creci ? ` · CRECI ${i.creci}` : ''}</div>
                  </div>
                </div>
                <div className="imv-leg">Repasse: venda {regra(p.repasseVendaTipo, p.repasseVendaValor)} · aluguel {regra(p.repasseAluguelTipo, p.repasseAluguelValor)}{p.prazoRepasseDias ? ` · até ${p.prazoRepasseDias} dias` : ''}</div>
                {p.responsavel && <div className="imv-leg">Responsável: {p.responsavel}{p.telefoneInterno ? ` · ${p.telefoneInterno}` : ''}</div>}
                {p.vigenciaFim && <div className="imv-leg">Vigência até {String(p.vigenciaFim).split('-').reverse().join('/')}</div>}
                <div className="imv-acoes">
                  {p.tokenPortal ? (
                    <>
                      <button className="btn-secondary" onClick={() => { navigator.clipboard?.writeText(linkPortal(p.tokenPortal)); showToast('Link do portal copiado!'); }}><IconLink size={14} /> Copiar link do portal</button>
                      <button className="btn-ghost" onClick={() => window.confirm('Gerar um novo link? O atual deixa de funcionar.') && portal(i, 'novoLink')}><IconRefresh size={14} /> Novo link</button>
                      <button className="btn-ghost" onClick={() => window.confirm('Revogar o link? A imobiliária perde o acesso até você gerar outro.') && portal(i, 'revogar')}>Revogar</button>
                    </>
                  ) : <button className="btn-secondary" onClick={() => portal(i, 'novoLink')}><IconLink size={14} /> Gerar link do portal</button>}
                  {p.contratoUrl && <a className="btn-ghost" href={p.contratoUrl} target="_blank" rel="noreferrer">Contrato</a>}
                </div>
                <AcoesItem onEditar={() => editar(i)} rotuloApagar="Apagar"
                  onApagar={async () => {
                    if (!window.confirm(`Apagar "${i.nome}"? As indicações já feitas continuam guardadas.`)) return;
                    await deleteDoc(doc(db, 'imobiliarias', i.id)); await deleteDoc(doc(db, 'imobiliariasPrivado', i.id)).catch(() => {});
                    showToast('Imobiliária apagada.');
                  }}>
                  <button type="button" className="btn-ghost" onClick={() => setDoc(doc(db, 'imobiliarias', i.id), { ativo: i.ativo === false }, { merge: true })}>
                    {i.ativo === false ? 'Mostrar no app' : 'Ocultar do app'}
                  </button>
                </AcoesItem>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

// ============================ IMÓVEIS =======================================
const IMOVEL_VAZIO = {
  imobiliariaId: '', titulo: '', tipo: 'apartamento', finalidade: 'venda', preco: '', condominio: '', bairro: '', cidade: '',
  quartos: '', banheiros: '', vagas: '', areaM2: '', fotos: [], descricao: '', linkAnuncio: '', ativo: true, ordem: '',
};

function Imoveis({ imoveis, imobiliarias, showToast }) {
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState('todas');
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState(IMOVEL_VAZIO);
  const [urlFoto, setUrlFoto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const nomeImob = (id) => imobiliarias.find(i => i.id === id)?.nome || '—';

  const editar = (i) => { setEditId(i.id); setF({ ...IMOVEL_VAZIO, ...i, fotos: i.fotos || [] }); setAberto(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const limpar = () => { setEditId(null); setF(IMOVEL_VAZIO); setAberto(false); };
  const salvar = async () => {
    if (!f.imobiliariaId) { showToast('Escolha a imobiliária.', 'error'); return; }
    if (!String(f.titulo).trim()) { showToast('Dê um título ao imóvel.', 'error'); return; }
    setSalvando(true);
    try {
      const id = editId || doc(collection(db, 'imoveis')).id;
      await setDoc(doc(db, 'imoveis', id), {
        imobiliariaId: f.imobiliariaId, titulo: String(f.titulo).trim(), tipo: f.tipo, finalidade: f.finalidade,
        preco: numero(f.preco), condominio: numero(f.condominio), bairro: String(f.bairro).trim(), cidade: String(f.cidade).trim(),
        quartos: numero(f.quartos), banheiros: numero(f.banheiros), vagas: numero(f.vagas), areaM2: numero(f.areaM2),
        fotos: f.fotos || [], descricao: String(f.descricao).trim(), linkAnuncio: String(f.linkAnuncio).trim(), ativo: f.ativo !== false,
        ordem: f.ordem === '' || f.ordem == null ? null : numero(f.ordem),
        atualizadoEm: serverTimestamp(), ...(editId ? {} : { criadoEm: serverTimestamp() }),
      }, { merge: true });
      showToast('Imóvel salvo.');
      limpar();
    } catch (e) { showToast(e?.message || 'Não foi possível salvar.', 'error'); } finally { setSalvando(false); }
  };
  const inp = (k, props = {}) => <input value={f[k] ?? ''} onChange={e => set(k, e.target.value)} {...props} />;
  const lista = imoveis.filter(i => filtro === 'todas' || i.imobiliariaId === filtro);

  return (
    <>
      <Recolhivel titulo={editId ? `Editar: ${f.titulo || 'imóvel'}` : 'Novo imóvel'} subtitulo="Vitrine de imóveis de cada imobiliária" icone={<IconHome size={18} />} aberto={aberto} onAlternar={setAberto}>
        <div className="field-row">
          <Campo rotulo="Imobiliária *">
            <select value={f.imobiliariaId} onChange={e => set('imobiliariaId', e.target.value)}>
              <option value="">Escolher…</option>
              {imobiliarias.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Título *">{inp('titulo', { placeholder: 'Apartamento iluminado perto do parque' })}</Campo>
        </div>
        <div className="field-row">
          <Campo rotulo="Finalidade">
            <select value={f.finalidade} onChange={e => set('finalidade', e.target.value)}><option value="venda">Venda</option><option value="aluguel">Aluguel</option></select>
          </Campo>
          <Campo rotulo="Tipo">
            <select value={f.tipo} onChange={e => set('tipo', e.target.value)}>{TIPOS_IMOVEL.map(t => <option key={t.id} value={t.id}>{t.rotulo}</option>)}</select>
          </Campo>
        </div>
        <div className="field-row">
          <Campo rotulo={f.finalidade === 'aluguel' ? 'Aluguel mensal (R$)' : 'Preço (R$)'}>{inp('preco', { type: 'number', min: 0 })}</Campo>
          <Campo rotulo="Condomínio (R$/mês)" opcional>{inp('condominio', { type: 'number', min: 0 })}</Campo>
        </div>
        <div className="field-row">
          <Campo rotulo="Bairro">{inp('bairro')}</Campo>
          <Campo rotulo="Cidade">{inp('cidade')}</Campo>
        </div>
        <div className="field-row">
          <Campo rotulo="Quartos">{inp('quartos', { type: 'number', min: 0 })}</Campo>
          <Campo rotulo="Banheiros">{inp('banheiros', { type: 'number', min: 0 })}</Campo>
        </div>
        <div className="field-row">
          <Campo rotulo="Vagas">{inp('vagas', { type: 'number', min: 0 })}</Campo>
          <Campo rotulo="Área (m²)">{inp('areaM2', { type: 'number', min: 0 })}</Campo>
        </div>
        <Campo rotulo={`Fotos (${(f.fotos || []).length})`}>
          <div className="imv-fotos">
            {(f.fotos || []).map((u, i) => (
              <figure key={u}><img src={urlDeImagem(u)} alt="" /><button type="button" aria-label="Remover foto" onClick={() => set('fotos', f.fotos.filter((_, j) => j !== i))}>×</button></figure>
            ))}
          </div>
          <div className="imv-acoes">
            <EnviarImagem pasta="fotos" multiplo rotulo="Enviar fotos" onEnviado={(urls) => setF(p => ({ ...p, fotos: [...(p.fotos || []), ...urls].slice(0, 20) }))} showToast={showToast} />
            <input style={{ flex: '1 1 220px' }} value={urlFoto} onChange={e => setUrlFoto(e.target.value)} placeholder="ou cole o link de uma foto" />
            <button type="button" className="btn-ghost" onClick={() => { if (urlFoto.trim()) { set('fotos', [...(f.fotos || []), urlFoto.trim()]); setUrlFoto(''); } }}>Adicionar</button>
          </div>
        </Campo>
        <Campo rotulo="Descrição"><textarea rows={3} value={f.descricao} onChange={e => set('descricao', e.target.value)} /></Campo>
        <div className="field-row">
          <Campo rotulo="Link do anúncio original" opcional>{inp('linkAnuncio', { placeholder: 'https://' })}</Campo>
          <Campo rotulo="Ordem">{inp('ordem', { type: 'number' })}</Campo>
        </div>
        <label className="imv-check"><input type="checkbox" checked={f.ativo !== false} onChange={e => set('ativo', e.target.checked)} /> Ativo na vitrine</label>
        <div className="imv-acoes">
          {editId && <button className="btn-ghost" onClick={limpar}>Cancelar edição</button>}
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : editId ? 'Salvar alterações' : 'Cadastrar imóvel'}</button>
        </div>
      </Recolhivel>

      <div className="imv-filtros">
        <Campo rotulo="Filtrar por imobiliária">
          <select value={filtro} onChange={e => setFiltro(e.target.value)}>
            <option value="todas">Todas ({imoveis.length})</option>
            {imobiliarias.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </Campo>
      </div>
      {lista.length === 0 ? <div className="empty-state"><p>Nenhum imóvel cadastrado.</p></div> : (
        <div className="imv-grade">
          {lista.map(i => (
            <article key={i.id} className="card imv-card" style={i.ativo === false ? { opacity: 0.7 } : undefined}>
              {(i.fotos || [])[0] && <img className="imv-foto" src={urlDeImagem(i.fotos[0])} alt="" />}
              <div className="imv-nome">{i.titulo}{i.ativo === false ? ' (oculto)' : ''}</div>
              <div className="imv-leg"><b>{precoTexto(i.preco, i.finalidade)}</b> · {rotuloTipoImovel(i.tipo)} · {[i.bairro, i.cidade].filter(Boolean).join(', ')}</div>
              <div className="imv-leg">{[i.quartos && `${i.quartos} qto`, i.banheiros && `${i.banheiros} banh.`, i.vagas && `${i.vagas} vaga(s)`, i.areaM2 && `${i.areaM2} m²`].filter(Boolean).join(' · ')}</div>
              <div className="imv-leg" style={{ fontSize: 12 }}>{nomeImob(i.imobiliariaId)} · {(i.fotos || []).length} fotos</div>
              <AcoesItem onEditar={() => editar(i)} onApagar={async () => { if (window.confirm(`Apagar "${i.titulo}"?`)) { await deleteDoc(doc(db, 'imoveis', i.id)); showToast('Imóvel apagado.'); } }} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}

// ============================ ARQUITETOS ====================================
const ARQ_VAZIO = { nome: '', fotoUrl: '', bio: '', cau: '', especialidades: '', ativo: true, valorConsultoria: '', telefone: '', email: '', dadosPagamento: '' };

function Arquitetos({ arquitetos, arqPriv, showToast }) {
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState(ARQ_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const editar = (a) => {
    const p = arqPriv[a.id] || {};
    setEditId(a.id);
    setF({ ...ARQ_VAZIO, ...a, ...p, especialidades: (a.especialidades || []).join(', '), valorConsultoria: p.valorConsultoria ?? '' });
    setAberto(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const limpar = () => { setEditId(null); setF(ARQ_VAZIO); setAberto(false); };
  const salvar = async () => {
    if (!String(f.nome).trim()) { showToast('Informe o nome.', 'error'); return; }
    setSalvando(true);
    try {
      const id = editId || doc(collection(db, 'arquitetos')).id;
      const t = (k) => String(f[k] ?? '').trim();
      await setDoc(doc(db, 'arquitetos', id), {
        nome: t('nome'), fotoUrl: t('fotoUrl'), bio: t('bio'), cau: t('cau'), especialidades: listaDeTexto(f.especialidades),
        ativo: f.ativo !== false, atualizadoEm: serverTimestamp(),
      }, { merge: true });
      await setDoc(doc(db, 'arquitetosPrivado', id), {
        valorConsultoria: numero(f.valorConsultoria), telefone: t('telefone'), email: t('email'), dadosPagamento: t('dadosPagamento'), atualizadoEm: serverTimestamp(),
      }, { merge: true });
      showToast('Arquiteto salvo.');
      limpar();
    } catch (e) { showToast(e?.message || 'Não foi possível salvar.', 'error'); } finally { setSalvando(false); }
  };
  const inp = (k, props = {}) => <input value={f[k] ?? ''} onChange={e => set(k, e.target.value)} {...props} />;

  return (
    <>
      <Recolhivel titulo={editId ? `Editar: ${f.nome}` : 'Novo arquiteto parceiro'} subtitulo="Quem faz a consultoria online" icone={<IconPerson size={18} />} aberto={aberto} onAlternar={setAberto}>
        <div className="field-row">
          <Campo rotulo="Nome *">{inp('nome')}</Campo>
          <Campo rotulo="Registro CAU">{inp('cau')}</Campo>
        </div>
        <Campo rotulo="Foto">
          {f.fotoUrl && <img className="imv-mini" src={urlDeImagem(f.fotoUrl)} alt="" />}
          <EnviarImagem pasta="arquitetos" onEnviado={([u]) => u && set('fotoUrl', u)} rotulo="Enviar foto" showToast={showToast} />
        </Campo>
        <Campo rotulo="Bio"><textarea rows={3} value={f.bio} onChange={e => set('bio', e.target.value)} /></Campo>
        <Campo rotulo="Especialidades" dica="Separe por vírgula.">{inp('especialidades', { placeholder: 'Organização, decoração afetiva, pequenos espaços' })}</Campo>
        <div className="imv-grupo">Privado</div>
        <div className="field-row">
          <Campo rotulo="Valor por consultoria (R$)" dica="Congelado em cada lead quando a consultoria é agendada.">{inp('valorConsultoria', { type: 'number', min: 0, step: '0.01' })}</Campo>
          <Campo rotulo="Telefone">{inp('telefone', { inputMode: 'tel' })}</Campo>
        </div>
        <Campo rotulo="E-mail">{inp('email', { type: 'email' })}</Campo>
        <Campo rotulo="Dados de pagamento (PIX/conta)"><textarea rows={2} value={f.dadosPagamento} onChange={e => set('dadosPagamento', e.target.value)} /></Campo>
        <label className="imv-check"><input type="checkbox" checked={f.ativo !== false} onChange={e => set('ativo', e.target.checked)} /> Ativo</label>
        <div className="imv-acoes">
          {editId && <button className="btn-ghost" onClick={limpar}>Cancelar edição</button>}
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : editId ? 'Salvar alterações' : 'Cadastrar arquiteto'}</button>
        </div>
      </Recolhivel>
      {arquitetos.length === 0 ? <div className="empty-state"><p>Nenhum arquiteto cadastrado.</p></div> : (
        <div className="imv-grade">
          {arquitetos.map(a => (
            <article key={a.id} className="card imv-card" style={a.ativo === false ? { opacity: 0.7 } : undefined}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {a.fotoUrl ? <img className="imv-logo" style={{ objectFit: 'cover' }} src={urlDeImagem(a.fotoUrl)} alt="" /> : <span className="imv-logo" style={{ display: 'grid', placeItems: 'center' }}><IconPerson size={20} /></span>}
                <div style={{ minWidth: 0 }}>
                  <div className="imv-nome" style={{ marginTop: 0 }}>{a.nome}{a.ativo === false ? ' (inativo)' : ''}</div>
                  <div className="imv-leg">{a.cau ? `CAU ${a.cau} · ` : ''}{arqPriv[a.id]?.valorConsultoria ? `R$ ${arqPriv[a.id].valorConsultoria} por consultoria` : 'Sem valor definido'}</div>
                </div>
              </div>
              {(a.especialidades || []).length > 0 && <div className="imv-leg">{a.especialidades.join(' · ')}</div>}
              <AcoesItem onEditar={() => editar(a)} onApagar={async () => {
                if (!window.confirm(`Apagar "${a.nome}"?`)) return;
                await deleteDoc(doc(db, 'arquitetos', a.id)); await deleteDoc(doc(db, 'arquitetosPrivado', a.id)).catch(() => {});
                showToast('Arquiteto apagado.');
              }} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}

// ============================ FINANCEIRO ====================================
function Financeiro({ leads, privLeads }) {
  const r = { recebido: 0, aReceber: 0, arqPago: 0, arqAPagar: 0, porImob: {} };
  leads.forEach(l => {
    const p = privLeads[l.id] || {};
    const pi = r.porImob[l.imobiliariaId] || (r.porImob[l.imobiliariaId] = { nome: l.imobiliariaNome, leads: 0, fechados: 0, recebido: 0, aReceber: 0 });
    pi.leads += 1;
    if (['fechado', 'pago', 'consultoria_agendada', 'concluido'].includes(l.status)) pi.fechados += 1;
    if (p.repasseCentavos != null) { r.recebido += p.repasseCentavos; pi.recebido += p.repasseCentavos; }
    if (l.status === 'fechado') { r.aReceber += p.repassePrevistoCentavos || 0; pi.aReceber += p.repassePrevistoCentavos || 0; }
    if (p.arquitetoPagoEm) r.arqPago += p.arquitetoPagoCentavos ?? p.custoArquitetoCentavos ?? 0;
    else if (p.custoArquitetoCentavos != null) r.arqAPagar += p.custoArquitetoCentavos;
  });
  const margem = r.recebido - r.arqPago - r.arqAPagar;
  const semData = leads.filter(l => l.status === 'pago').length;
  return (
    <>
      <div className="imv-stats">
        <div className="card imv-stat"><b style={{ color: 'var(--acento-salvia-texto)' }}>{brlCentavos(r.recebido)}</b><span>Recebido das imobiliárias</span></div>
        <div className="card imv-stat"><b style={{ color: 'var(--acento-dourado-texto)' }}>{brlCentavos(r.aReceber)}</b><span>A receber (negócios fechados)</span></div>
        <div className="card imv-stat"><b>{brlCentavos(r.arqPago)}</b><span>Pago a arquitetos</span></div>
        <div className="card imv-stat"><b style={{ color: 'var(--acento-pessego-texto)' }}>{brlCentavos(r.arqAPagar)}</b><span>A pagar a arquitetos</span></div>
        <div className="card imv-stat"><b style={{ color: 'var(--lilas-700)' }}>{brlCentavos(margem)}</b><span>Margem (recebido − arquitetos)</span></div>
      </div>
      {semData > 0 && <div className="imv-aviso"><IconAlert size={16} /> {semData === 1 ? '1 consultoria liberada' : `${semData} consultorias liberadas`} ainda sem data. O custo do arquiteto entra no cálculo quando a consultoria é agendada.</div>}
      <div className="imv-grupo">Por imobiliária</div>
      {Object.keys(r.porImob).length === 0 ? <div className="empty-state"><p>Sem indicações ainda.</p></div> : (
        <div className="imv-grade">
          {Object.entries(r.porImob).map(([id, x]) => (
            <article key={id} className="card imv-card">
              <div className="imv-nome" style={{ marginTop: 0 }}>{x.nome}</div>
              <div className="imv-leg">{x.leads} indicações · {x.fechados} negócios fechados</div>
              <div className="imv-leg">Recebido {brlCentavos(x.recebido)} · a receber {brlCentavos(x.aReceber)}</div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

// ============================ TELA ==========================================
export default function Imobiliarias({ showToast }) {
  const [secao, setSecao] = useState('leads');
  const [imobiliarias, setImobiliarias] = useState([]);
  const [imobPriv, setImobPriv] = useState({});
  const [imoveis, setImoveis] = useState([]);
  const [arquitetos, setArquitetos] = useState([]);
  const [arqPriv, setArqPriv] = useState({});
  const [leads, setLeads] = useState([]);
  const [privLeads, setPrivLeads] = useState({});
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const mapa = (s) => Object.fromEntries(s.docs.map(d => [d.id, d.data()]));
    const lista = (s) => s.docs.map(d => ({ id: d.id, ...d.data() }));
    const subs = [
      onSnapshot(collection(db, 'imobiliarias'), s => setImobiliarias(ordenar(lista(s))), () => {}),
      onSnapshot(collection(db, 'imobiliariasPrivado'), s => setImobPriv(mapa(s)), () => {}),
      onSnapshot(collection(db, 'imoveis'), s => setImoveis(ordenar(lista(s))), () => {}),
      onSnapshot(collection(db, 'arquitetos'), s => setArquitetos(ordenar(lista(s))), () => {}),
      onSnapshot(collection(db, 'arquitetosPrivado'), s => setArqPriv(mapa(s)), () => {}),
      onSnapshot(collection(db, 'indicacoesImoveis'), s => { setLeads(lista(s).sort((a, b) => tsMs(b.criadoEm) - tsMs(a.criadoEm))); setCarregando(false); }, () => setCarregando(false)),
      onSnapshot(collection(db, 'indicacoesImoveisPrivado'), s => setPrivLeads(mapa(s)), () => {}),
    ];
    return () => subs.forEach(u => u());
  }, []);

  const pendentes = leads.filter(l => l.status === 'fechado' || l.status === 'pago').length;

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Imobiliárias · Lar e recomeço</h1>
          <p className="screen-sub">A usuária indica interesse, a imobiliária negocia e, quando o negócio fecha e o repasse chega, a Atravessia agenda a consultoria com arquiteto parceiro.</p>
        </div>
      </div>
      {pendentes > 0 && <div className="imv-aviso"><IconAlert size={16} /> {pendentes} {pendentes === 1 ? 'indicação precisa' : 'indicações precisam'} da sua ação (confirmar repasse ou agendar consultoria).</div>}
      <div className="filter-row">
        {SECOES.map(s => (
          <button key={s.id} type="button" className={`chip ${secao === s.id ? 'chip-active' : ''}`} onClick={() => setSecao(s.id)}>{s.rotulo}</button>
        ))}
      </div>
      {carregando ? <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando…</div> : (
        <>
          {secao === 'leads' && <Leads leads={leads} privLeads={privLeads} imobiliarias={imobiliarias} arquitetos={arquitetos} arqPriv={arqPriv} showToast={showToast} />}
          {secao === 'imobiliarias' && <Imobs imobiliarias={imobiliarias} imobPriv={imobPriv} showToast={showToast} />}
          {secao === 'imoveis' && <Imoveis imoveis={imoveis} imobiliarias={imobiliarias} showToast={showToast} />}
          {secao === 'arquitetos' && <Arquitetos arquitetos={arquitetos} arqPriv={arqPriv} showToast={showToast} />}
          {secao === 'financeiro' && <Financeiro leads={leads} privLeads={privLeads} />}
        </>
      )}
    </div>
  );
}
