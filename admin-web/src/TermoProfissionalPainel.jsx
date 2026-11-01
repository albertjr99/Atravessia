import React, { useEffect, useMemo, useState } from 'react';
import { db, functions } from './firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import Recolhivel from './Recolhivel';
import TextoTermo, { Trechos } from './TextoTermo';
import {
  TERMO_VERSAO, CAMPOS_TERMO, rascunhoInicialTermo, aplicarCamposTermo,
  camposFaltandoTermo, proximaVersaoTermo, linhasParaResumo,
} from './termoProfissional';

// Termo de parceria do profissional — editor do painel (Cursos → Profissionais).
// Fonte única: configuracoes/termoProfissional (+ histórico em versoes/{versao}).
// Rascunho e publicação passam pela função publicarTermoProfissional; publicar
// sobe a versão e faz todos os profissionais aceitarem de novo no portal.
// Mesma tela no app: oamorqueefica/src/screens/admin/TermoProfissionalAdmin.js.

const ms = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : 0);
const dataHora = (t) => (t ? new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const CAMPOS_VAZIOS = Object.fromEntries(CAMPOS_TERMO.map(c => [c.k, '']));

// Documento publicado (ou null) + versão vigente, em tempo real.
export function useTermoProfissional() {
  const [estado, setEstado] = useState({ carregado: false, doc: null });
  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'termoProfissional'),
    (sn) => setEstado({ carregado: true, doc: sn.exists() ? sn.data() : null }),
    () => setEstado({ carregado: true, doc: null })), []);
  return { ...estado, versao: estado.doc?.versao ? String(estado.doc.versao) : TERMO_VERSAO };
}

// De onde o editor parte: rascunho salvo > versão publicada > texto 1.0 com marcadores.
function pontoDePartida(d) {
  if (d?.rascunho?.texto) return { ...d.rascunho, origem: `Rascunho salvo em ${dataHora(ms(d.rascunho.salvoEm))} (ainda não publicado)` };
  if (d?.texto) return { texto: d.texto, resumo: d.resumo, campos: d.campos, origem: `Texto da versão ${d.versao} publicada` };
  return { ...rascunhoInicialTermo(), origem: 'Rascunho inicial: texto da versão 1.0 com os [colchetes] trocados pelos campos abaixo' };
}

export default function TermoProfissionalPainel({ showToast, termo, profissionais, privados }) {
  const { carregado, doc: termoDoc, versao } = termo;
  const [form, setForm] = useState(null);
  const [alterado, setAlterado] = useState(false);
  const [previa, setPrevia] = useState(false);
  const [ocupado, setOcupado] = useState('');
  const [versoes, setVersoes] = useState([]);
  const [verVersao, setVerVersao] = useState(null);

  const carregarForm = (d) => {
    const o = pontoDePartida(d);
    setForm({ texto: o.texto || '', resumoTxt: (o.resumo || []).join('\n'), campos: { ...CAMPOS_VAZIOS, ...(o.campos || {}) }, origem: o.origem });
    setAlterado(false);
  };
  // Sem alterações locais, acompanha o Firestore (inclusive publicações de outra pessoa).
  useEffect(() => { if (carregado && (!form || !alterado)) carregarForm(termoDoc); }, [carregado, termoDoc, alterado]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onSnapshot(collection(db, 'configuracoes', 'termoProfissional', 'versoes'),
    (sn) => setVersoes(sn.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.publicadoEm) - ms(a.publicadoEm))),
    () => setVersoes([])), []);

  const mudar = (k) => (e) => { const v = e.target.value; setForm(f => ({ ...f, [k]: v })); setAlterado(true); };
  const mudarCampo = (k) => (e) => { const v = e.target.value; setForm(f => ({ ...f, campos: { ...f.campos, [k]: v } })); setAlterado(true); };

  const resumo = useMemo(() => linhasParaResumo(form?.resumoTxt), [form?.resumoTxt]);
  const faltando = useMemo(() => (form ? camposFaltandoTermo(form.texto, resumo, form.campos) : []), [form, resumo]);
  const aceites = useMemo(() => profissionais.map(p => {
    const priv = privados[p.id] || {};
    const em = ms(priv.termoAceitoEm);
    return { id: p.id, nome: p.nome || '—', versao: priv.termoVersao || null, em, emDia: !!em && priv.termoVersao === versao && !priv.termoPedirNovo, pedirNovo: !!priv.termoPedirNovo };
  }), [profissionais, privados, versao]);

  if (!form) return null;
  const novaVersao = proximaVersaoTermo(versao);
  const enviar = (extra) => httpsCallable(functions, 'publicarTermoProfissional')({ texto: form.texto, resumo, campos: form.campos, ...extra });

  const salvarRascunho = async () => {
    setOcupado('rascunho');
    try { await enviar({ somenteRascunho: true }); setAlterado(false); showToast('Rascunho salvo. Os profissionais continuam vendo a versão publicada.'); }
    catch (e) { showToast(e?.message || 'Não foi possível salvar o rascunho.', 'error'); }
    setOcupado('');
  };
  const publicar = async () => {
    if (faltando.length) { showToast(`Preencha antes de publicar: ${faltando.map(f => f.rotulo).join(', ')}.`, 'error'); return; }
    if (!window.confirm(`Publicar a versão ${novaVersao} do termo?\n\nTodos os profissionais precisarão aceitar de novo: no próximo acesso ao portal, o extrato só aparece depois do novo aceite.`)) return;
    setOcupado('publicar');
    try {
      const { data } = await enviar({ versaoBase: versao });
      setAlterado(false); setPrevia(false);
      showToast(`Versão ${data?.versao || novaVersao} publicada. O portal vai pedir o novo aceite.`);
    } catch (e) { showToast(e?.message || 'Não foi possível publicar.', 'error'); }
    setOcupado('');
  };
  const descartar = () => { if (window.confirm('Descartar as alterações feitas aqui?')) carregarForm(termoDoc); };
  const recomecar = () => {
    if (!window.confirm('Trocar o texto do editor pelo texto original da versão 1.0 (os campos preenchidos são mantidos)?')) return;
    const r = rascunhoInicialTermo();
    setForm(f => ({ ...f, texto: r.texto, resumoTxt: r.resumo.join('\n'), origem: 'Texto original da versão 1.0 (não salvo)' }));
    setAlterado(true);
  };

  const emDia = aceites.filter(a => a.emDia).length;
  const subtitulo = termoDoc?.texto
    ? `Versão ${versao} publicada em ${dataHora(ms(termoDoc.publicadoEm))} · ${emDia} de ${aceites.length} profissionais aceitaram`
    : `Versão ${versao} (texto original, ainda não publicado pelo painel) · ${emDia} de ${aceites.length} aceitaram`;

  return (
    <Recolhivel titulo="Termo do profissional" subtitulo={subtitulo}>
      <p className="field-hint" style={{ marginTop: 0 }}>
        Termo de Parceria, Consentimento e Tratamento de Dados que o profissional aceita no portal. {form.origem}.
        {alterado && <strong> Há alterações não salvas.</strong>}
      </p>

      <h3 className="card-title" style={{ marginTop: 14 }}>Dados da empresa</h3>
      <p className="field-hint" style={{ marginTop: 0 }}>Preenchem o texto nos marcadores <code>{'{{razaoSocial}}'}</code>, <code>{'{{cnpj}}'}</code> etc.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0 14px' }}>
        {CAMPOS_TERMO.map(c => (
          <div key={c.k} className="field-group">
            <label>{c.rotulo} <code style={{ fontWeight: 400, opacity: 0.7 }}>{`{{${c.k}}}`}</code></label>
            <input value={form.campos[c.k] || ''} onChange={mudarCampo(c.k)} placeholder={`ex.: ${c.exemplo}`} maxLength={400} />
          </div>
        ))}
      </div>
      {faltando.length > 0 && <p className="field-hint" style={{ color: 'var(--rose-700, #b4234d)' }}>Faltam para publicar: {faltando.map(f => f.rotulo).join(', ')}.</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" className={`chip ${!previa ? 'chip-active' : ''}`} onClick={() => setPrevia(false)}>Editar texto</button>
        <button type="button" className={`chip ${previa ? 'chip-active' : ''}`} onClick={() => setPrevia(true)}>Pré-visualizar como o profissional vê</button>
      </div>

      {!previa ? (
        <>
          <div className="field-group" style={{ marginTop: 12 }}>
            <label>Resumo "Em poucas palavras" (um item por linha)</label>
            <textarea rows={7} value={form.resumoTxt} onChange={mudar('resumoTxt')} />
          </div>
          <div className="field-group">
            <label>Texto completo</label>
            <textarea rows={26} value={form.texto} onChange={mudar('texto')} spellCheck
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.55 }} />
            <p className="field-hint">
              Formato simples: <code>## Título</code> em linha própria, uma linha em branco entre parágrafos, <code>- item</code> para listas e <code>**negrito**</code>. HTML não é aceito.
            </p>
          </div>
        </>
      ) : (
        <div className="card cz-termo" style={{ marginTop: 12, maxWidth: 'none' }}>
          <p className="field-hint" style={{ marginTop: 0 }}>Prévia da versão {novaVersao} (campos vazios aparecem entre colchetes).</p>
          {resumo.length > 0 && (<><h3 className="card-title">Em poucas palavras</h3><ul>{resumo.map((r, i) => <li key={i}><Trechos texto={aplicarCamposTermo(r, form.campos)} /></li>)}</ul></>)}
          <div className="cz-termo-texto" style={{ maxHeight: 520 }}><TextoTermo texto={aplicarCamposTermo(form.texto, form.campos)} /></div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={publicar} disabled={!!ocupado}>{ocupado === 'publicar' ? 'Publicando…' : `Publicar nova versão (${versao} → ${novaVersao})`}</button>
        <button className="btn-secondary" onClick={salvarRascunho} disabled={!!ocupado || !alterado}>{ocupado === 'rascunho' ? 'Salvando…' : 'Salvar rascunho'}</button>
        {alterado && <button className="btn-ghost" onClick={descartar} disabled={!!ocupado}>Descartar alterações</button>}
        <button className="btn-ghost" onClick={recomecar} disabled={!!ocupado}>Recomeçar do texto 1.0</button>
      </div>
      <p className="field-hint">Publicar grava o texto congelado no histórico e todos os profissionais precisarão aceitar de novo no próximo acesso ao portal.</p>

      <h3 className="card-title" style={{ marginTop: 22 }}>Quem já aceitou</h3>
      {aceites.length === 0 ? <p className="field-hint">Nenhum profissional cadastrado.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: 13.5 }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Profissional</th><th style={{ textAlign: 'left' }}>Versão aceita</th><th style={{ textAlign: 'left' }}>Aceito em</th><th style={{ textAlign: 'left' }}>Situação</th></tr></thead>
            <tbody>
              {aceites.map(a => (
                <tr key={a.id}>
                  <td>{a.nome}</td>
                  <td>{a.versao || '—'}</td>
                  <td>{a.em ? dataHora(a.em) : '—'}</td>
                  <td><span className={`badge ${a.emDia ? 'badge-perceber' : 'badge-total'}`}>{a.emDia ? 'Em dia' : a.pedirNovo ? 'Novo aceite pedido' : a.em ? `Falta aceitar a ${versao}` : 'Ainda não aceitou'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="card-title" style={{ marginTop: 22 }}>Versões publicadas</h3>
      {versoes.length === 0 ? <p className="field-hint">Nenhuma versão publicada pelo painel ainda (vale o texto original 1.0).</p> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {versoes.map(v => (
            <div key={v.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>Versão {v.versao}</strong>
                <span className="field-hint" style={{ margin: 0 }}>publicada em {dataHora(ms(v.publicadoEm))}</span>
                {v.versao === versao && <span className="badge badge-perceber">Vigente</span>}
                <button type="button" className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setVerVersao(verVersao === v.id ? null : v.id)}>{verVersao === v.id ? 'Fechar' : 'Ver texto'}</button>
              </div>
              {verVersao === v.id && (
                <div className="cz-termo-texto" style={{ maxHeight: 420, marginTop: 10 }}>
                  {(v.resumoFinal || []).length > 0 && <ul>{v.resumoFinal.map((r, i) => <li key={i}><Trechos texto={r} /></li>)}</ul>}
                  <TextoTermo texto={v.textoFinal} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Recolhivel>
  );
}
