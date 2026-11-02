import React, { useEffect, useMemo, useState } from 'react';
import { db, storage } from './firebase';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Recolhivel from './Recolhivel';
import AcoesItem from './AcoesItem';
import {
  IconCheck, IconPlus, IconUp, IconDown, IconTrash, IconImage, IconUpload, IconEye, IconEyeOff, IconSpark, IconCamera, IconPerson,
} from './Icons';
import { EQUIPE_PADRAO, FOTOS_LOCAIS, FAQ_SUGERIDAS, normalizarEquipe } from './equipeFaqPadrao';

// "Quem faz a Atravessia" (configuracoes/equipe) e Perguntas frequentes
// (coleção faq), na tela "Sobre e parcerias". Mesmo comportamento da tela
// do app (oamorqueefica/src/screens/admin/AdminEquipeFaq.js).

const LIMITE = 8 * 1024 * 1024;
const copia = (o) => JSON.parse(JSON.stringify(o));

function mover(lista, i, passo) {
  const j = i + passo;
  if (j < 0 || j >= lista.length) return lista;
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}

function proporcaoDe(blobOuUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = typeof blobOuUrl === 'string' ? blobOuUrl : URL.createObjectURL(blobOuUrl);
    img.onload = () => { resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 4 / 3); if (typeof blobOuUrl !== 'string') URL.revokeObjectURL(url); };
    img.onerror = () => resolve(4 / 3);
    img.src = url;
  });
}

async function enviarImagem(arquivo, nome) {
  if (!arquivo.type?.startsWith('image/')) throw new Error('Escolha uma imagem.');
  if (arquivo.size > LIMITE) throw new Error('A imagem tem mais de 8 MB. Escolha uma menor.');
  const ext = (arquivo.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const r = sRef(storage, `equipe/${nome || Date.now()}.${ext}`);
  await uploadBytes(r, arquivo, { contentType: arquivo.type });
  return { url: await getDownloadURL(r), proporcao: await proporcaoDe(arquivo) };
}

const fonteFoto = (f) => f?.url || FOTOS_LOCAIS[f?.local] || '';

function BotoesOrdem({ onSubir, onDescer, onRemover, rotulo }) {
  return (
    <div className="eqf-ordem">
      <button type="button" className="btn-ghost eqf-icone" onClick={onSubir} disabled={!onSubir} aria-label={`Subir ${rotulo}`}><IconUp size={15} /></button>
      <button type="button" className="btn-ghost eqf-icone" onClick={onDescer} disabled={!onDescer} aria-label={`Descer ${rotulo}`}><IconDown size={15} /></button>
      <span style={{ flex: 1 }} />
      {onRemover && <button type="button" className="acoes-item-apagar" onClick={onRemover}><IconTrash size={14} /> Remover</button>}
    </div>
  );
}

// Prévia aproximada da seção como aparece no app.
function PreviaEquipe({ dados }) {
  const [i, setI] = useState(0);
  const fotos = dados.fotos;
  const total = fotos.length;
  const atual = total ? Math.min(i, total - 1) : 0;
  const foto = fotos[atual];
  return (
    <div className="eqf-previa">
      <h3 className="eqf-previa-titulo">{dados.titulo}</h3>
      {foto && (
        <>
          <div className={`eqf-previa-foto ${foto.proporcao < 1 ? 'retrato' : ''}`} style={{ aspectRatio: String(foto.proporcao || 4 / 3) }}>
            <img src={fonteFoto(foto)} alt={foto.legenda || 'Foto da equipe'} />
            {total > 1 && (
              <>
                <button type="button" className="eqf-seta esq" onClick={() => setI((atual - 1 + total) % total)} aria-label="Foto anterior">‹</button>
                <button type="button" className="eqf-seta dir" onClick={() => setI((atual + 1) % total)} aria-label="Próxima foto">›</button>
              </>
            )}
          </div>
          {foto.legenda && <p className="eqf-previa-legenda">{foto.legenda}</p>}
        </>
      )}
      {dados.integrantes.map((p, n) => (
        <div key={p.id || n} className="eqf-previa-pessoa">
          {p.fotoUrl ? <img src={p.fotoUrl} alt="" className="eqf-avatar" /> : <span className="eqf-avatar eqf-avatar-vazio"><IconPerson size={16} /></span>}
          <div>
            <strong>{p.nome}</strong>
            {p.papel && <span className="eqf-previa-papel">{p.papel}</span>}
            {p.texto && <p>{p.texto}</p>}
          </div>
        </div>
      ))}
      {!dados.ativo && <p className="field-hint">A seção está oculta: não aparece no app.</p>}
    </div>
  );
}

// ─── Quem faz a Atravessia ────────────────────────────────────────────────
export function EquipeEditor({ showToast }) {
  const [rascunho, setRascunho] = useState(null);
  const [publicado, setPublicado] = useState(false);
  const [ocupado, setOcupado] = useState('');

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'equipe'), (snap) => {
    setPublicado(snap.exists());
    setRascunho(r => {
      if (r) return r;
      if (!snap.exists()) return copia(EQUIPE_PADRAO);
      const d = snap.data();
      return {
        ...copia(EQUIPE_PADRAO), ...d,
        fotos: d.fotos || [],
        integrantes: [...(d.integrantes || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
      };
    });
  }, () => setRascunho(r => r || copia(EQUIPE_PADRAO))), []);

  const previa = useMemo(() => (rascunho ? normalizarEquipe(rascunho) : null), [rascunho]);
  if (!rascunho) return <p className="field-hint">Carregando…</p>;

  const set = (k, v) => setRascunho(r => ({ ...r, [k]: v }));
  const setFoto = (i, k, v) => setRascunho(r => ({ ...r, fotos: r.fotos.map((f, n) => (n === i ? { ...f, [k]: v } : f)) }));
  const setPessoa = (i, k, v) => setRascunho(r => ({ ...r, integrantes: r.integrantes.map((p, n) => (n === i ? { ...p, [k]: v } : p)) }));

  const adicionarFoto = async (e) => {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    setOcupado('foto');
    try {
      const r = await enviarImagem(arq);
      setRascunho(x => ({ ...x, fotos: [...x.fotos, { url: r.url, legenda: '', proporcao: r.proporcao }] }));
    } catch (err) { showToast(err?.message || 'Não foi possível enviar a foto.', 'error'); }
    setOcupado('');
  };

  const fotoIntegrante = async (i, e) => {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    setOcupado(`p${i}`);
    try {
      const r = await enviarImagem(arq);
      setPessoa(i, 'fotoUrl', r.url);
    } catch (err) { showToast(err?.message || 'Não foi possível enviar a foto.', 'error'); }
    setOcupado('');
  };

  // Envia ao Storage as fotos que já vêm no app (cópias em public/equipe/).
  const usarFotosAtuais = async () => {
    setOcupado('atuais');
    try {
      const novas = [];
      for (const f of EQUIPE_PADRAO.fotos) {
        const resp = await fetch(FOTOS_LOCAIS[f.local]);
        if (!resp.ok) throw new Error('Não encontrei a foto padrão.');
        const blob = await resp.blob();
        const arq = new File([blob], `${f.local}.jpg`, { type: blob.type || 'image/jpeg' });
        const r = await enviarImagem(arq, `${f.local}-${Date.now()}`);
        novas.push({ url: r.url, legenda: f.legenda, proporcao: r.proporcao });
      }
      setRascunho(x => ({ ...x, fotos: [...novas, ...x.fotos.filter(f => f.url)] }));
      showToast('Fotos enviadas. Publique para valer no app.');
    } catch (err) { showToast(err?.message || 'Não foi possível enviar as fotos.', 'error'); }
    setOcupado('');
  };

  const publicar = async () => {
    const integrantes = rascunho.integrantes
      .map((p, n) => ({
        id: p.id || `p${Date.now()}${n}`, nome: (p.nome || '').trim(), papel: (p.papel || '').trim(),
        texto: (p.texto || '').trim(), fotoUrl: p.fotoUrl || '', icone: p.icone || 'heart-outline', ordem: n,
      }))
      .filter(p => p.nome || p.texto);
    const fotos = rascunho.fotos.map(f => ({
      url: f.url || '', legenda: (f.legenda || '').trim(), proporcao: Number(f.proporcao) || 4 / 3,
      ...(f.url ? {} : { local: f.local || '' }),
    })).filter(f => f.url || FOTOS_LOCAIS[f.local]);
    setOcupado('publicar');
    try {
      await setDoc(doc(db, 'configuracoes', 'equipe'), {
        titulo: (rascunho.titulo || '').trim() || EQUIPE_PADRAO.titulo,
        ativo: rascunho.ativo !== false, fotos, integrantes, atualizadoEm: serverTimestamp(),
      });
      setRascunho(r => ({ ...r, fotos, integrantes }));
      setPublicado(true);
      showToast('"Quem faz a Atravessia" publicado no app.');
    } catch (err) { showToast('Não foi possível publicar: ' + (err?.message || ''), 'error'); }
    setOcupado('');
  };

  const temLocais = rascunho.fotos.some(f => !f.url);

  return (
    <div className="eqf">
      {!publicado && (
        <p className="eqf-aviso">Ainda não publicado: o app mostra o conteúdo padrão, que já está abaixo como rascunho. Edite e publique quando quiser.</p>
      )}
      <label className="toggle-row">
        <span className="toggle">
          <input type="checkbox" checked={rascunho.ativo !== false} onChange={e => set('ativo', e.target.checked)} />
          <span className="toggle-slider" />
        </span>
        Mostrar a seção no app
      </label>
      <div className="field-group">
        <label>Título</label>
        <input value={rascunho.titulo} onChange={e => set('titulo', e.target.value)} placeholder={EQUIPE_PADRAO.titulo} />
      </div>

      <h3 className="eqf-sub">Fotos ({rascunho.fotos.length})</h3>
      {rascunho.fotos.map((f, i) => (
        <div key={`${i}-${f.url || f.local}`} className="eqf-item">
          <div className="eqf-linha">
            <img src={fonteFoto(f)} alt="" className="eqf-mini" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <input value={f.legenda || ''} onChange={e => setFoto(i, 'legenda', e.target.value)} placeholder="Legenda (quem aparece)" aria-label="Legenda da foto" />
              {!f.url && <span className="field-hint">Foto que já vem no app</span>}
            </div>
          </div>
          <BotoesOrdem rotulo="foto"
            onSubir={i > 0 ? () => set('fotos', mover(rascunho.fotos, i, -1)) : null}
            onDescer={i < rascunho.fotos.length - 1 ? () => set('fotos', mover(rascunho.fotos, i, 1)) : null}
            onRemover={() => { if (window.confirm('Remover esta foto? Ela sai da seção quando você publicar.')) set('fotos', rascunho.fotos.filter((_, n) => n !== i)); }} />
        </div>
      ))}
      <div className="eqf-botoes">
        <label className={`btn-secondary ${ocupado ? 'eqf-off' : ''}`}>
          <IconImage size={15} /> {ocupado === 'foto' ? 'Enviando…' : 'Adicionar foto'}
          <input type="file" accept="image/*" hidden disabled={!!ocupado} onChange={adicionarFoto} />
        </label>
        {temLocais && (
          <button type="button" className="btn-secondary" onClick={usarFotosAtuais} disabled={!!ocupado}>
            <IconUpload size={15} /> {ocupado === 'atuais' ? 'Enviando…' : 'Usar fotos atuais'}
          </button>
        )}
      </div>
      <span className="field-hint">Só imagens, até 8 MB. "Usar fotos atuais" envia as fotos que já vêm no app para o armazenamento, para você poder reordenar ou trocar.</span>

      <h3 className="eqf-sub">Integrantes ({rascunho.integrantes.length})</h3>
      {rascunho.integrantes.map((p, i) => (
        <div key={p.id || i} className="eqf-item">
          <div className="eqf-linha">
            <label className="eqf-avatar-btn" title="Trocar foto">
              {p.fotoUrl ? <img src={p.fotoUrl} alt="" className="eqf-avatar" />
                : <span className="eqf-avatar eqf-avatar-vazio">{ocupado === `p${i}` ? '…' : <IconCamera size={16} />}</span>}
              <input type="file" accept="image/*" hidden disabled={!!ocupado} onChange={e => fotoIntegrante(i, e)} />
            </label>
            <div className="eqf-campos">
              <input value={p.nome || ''} onChange={e => setPessoa(i, 'nome', e.target.value)} placeholder="Nome" aria-label="Nome" />
              <input value={p.papel || ''} onChange={e => setPessoa(i, 'papel', e.target.value)} placeholder="Papel (ex.: Fundadora e psicóloga)" aria-label="Papel" />
            </div>
          </div>
          <textarea rows={2} value={p.texto || ''} onChange={e => setPessoa(i, 'texto', e.target.value)} placeholder="Uma frase sobre o que a pessoa faz" aria-label="Texto" style={{ resize: 'vertical', marginTop: 8 }} />
          {p.fotoUrl && <button type="button" className="eqf-link" onClick={() => setPessoa(i, 'fotoUrl', '')}>Tirar foto (volta o ícone)</button>}
          <BotoesOrdem rotulo="integrante"
            onSubir={i > 0 ? () => set('integrantes', mover(rascunho.integrantes, i, -1)) : null}
            onDescer={i < rascunho.integrantes.length - 1 ? () => set('integrantes', mover(rascunho.integrantes, i, 1)) : null}
            onRemover={() => { if (window.confirm(`Remover ${p.nome || 'este integrante'}? Sai da seção quando você publicar.`)) set('integrantes', rascunho.integrantes.filter((_, n) => n !== i)); }} />
        </div>
      ))}
      <button type="button" className="btn-secondary"
        onClick={() => set('integrantes', [...rascunho.integrantes, { id: `p${Date.now()}`, nome: '', papel: '', texto: '', fotoUrl: '', icone: 'heart-outline' }])}>
        <IconPlus size={15} /> Adicionar integrante
      </button>

      <Recolhivel titulo="Prévia" subtitulo="Como fica no Sobre o app" icone={<IconEye size={16} />} className="eqf-recolhivel">
        <PreviaEquipe dados={previa} />
      </Recolhivel>

      <button type="button" className="btn-primary" onClick={publicar} disabled={!!ocupado}>
        <IconCheck size={16} /> {ocupado === 'publicar' ? 'Publicando…' : 'Publicar no app'}
      </button>
    </div>
  );
}

// ─── Perguntas frequentes ─────────────────────────────────────────────────
const VAZIO = { pergunta: '', resposta: '', categoria: '', publicado: true };

function RespostaComLinks({ texto }) {
  const partes = String(texto || '').split(/((?:https?:\/\/|www\.)[^\s<>"']+)/gi);
  return (
    <p className="eqf-resposta">
      {partes.map((p, i) => (i % 2
        ? <a key={i} href={p.startsWith('http') ? p : `https://${p}`} target="_blank" rel="noreferrer">{p}</a>
        : p))}
    </p>
  );
}

export function FaqEditor({ showToast }) {
  const [itens, setItens] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [editId, setEditId] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(collection(db, 'faq'),
    (snap) => setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999))),
    () => setItens([])), []);

  const proximaOrdem = useMemo(() => (itens || []).reduce((m, q) => Math.max(m, Number(q.ordem) || 0), -1) + 1, [itens]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const limpar = () => { setForm(VAZIO); setEditId(null); setAberto(false); };

  const salvar = async () => {
    const pergunta = form.pergunta.trim();
    const resposta = form.resposta.trim();
    if (!pergunta || !resposta) { showToast('Preencha a pergunta e a resposta.', 'error'); return; }
    setSalvando(true);
    try {
      const dados = { pergunta, resposta, categoria: form.categoria.trim(), publicado: !!form.publicado, atualizadoEm: serverTimestamp() };
      if (editId) await updateDoc(doc(db, 'faq', editId), dados);
      else await addDoc(collection(db, 'faq'), { ...dados, ordem: proximaOrdem, criadoEm: serverTimestamp() });
      showToast(editId ? 'Pergunta atualizada.' : 'Pergunta adicionada.');
      limpar();
    } catch (e) { showToast('Não foi possível salvar: ' + (e?.message || ''), 'error'); }
    setSalvando(false);
  };

  const editar = (q) => {
    setForm({ pergunta: q.pergunta || '', resposta: q.resposta || '', categoria: q.categoria || '', publicado: q.publicado !== false });
    setEditId(q.id);
    setAberto(true);
    setTimeout(() => document.getElementById('faq-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const apagar = async (q) => {
    if (!window.confirm(`Apagar a pergunta "${q.pergunta}"? Não dá para desfazer.`)) return;
    try { await deleteDoc(doc(db, 'faq', q.id)); if (editId === q.id) limpar(); showToast('Pergunta apagada.'); }
    catch (e) { showToast('Não foi possível apagar: ' + (e?.message || ''), 'error'); }
  };

  const alternarPublicado = async (q) => {
    try { await updateDoc(doc(db, 'faq', q.id), { publicado: q.publicado === false, atualizadoEm: serverTimestamp() }); }
    catch (e) { showToast('Não foi possível alterar: ' + (e?.message || ''), 'error'); }
  };

  const reordenar = async (i, passo) => {
    const nova = mover(itens, i, passo);
    if (nova === itens) return;
    try {
      const b = writeBatch(db);
      nova.forEach((q, n) => { if (q.ordem !== n) b.update(doc(db, 'faq', q.id), { ordem: n }); });
      await b.commit();
    } catch (e) { showToast('Não foi possível reordenar: ' + (e?.message || ''), 'error'); }
  };

  const sugeridas = async () => {
    const existentes = new Set((itens || []).map(q => (q.pergunta || '').trim().toLowerCase()));
    const novas = FAQ_SUGERIDAS.filter(q => !existentes.has(q.pergunta.toLowerCase()));
    if (!novas.length) { showToast('As perguntas sugeridas já estão na lista.'); return; }
    try {
      const b = writeBatch(db);
      novas.forEach((q, n) => b.set(doc(collection(db, 'faq')), { ...q, publicado: false, ordem: proximaOrdem + n, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() }));
      await b.commit();
      showToast(`${novas.length} pergunta(s) adicionada(s) como rascunho. Revise e publique.`);
    } catch (e) { showToast('Não foi possível adicionar: ' + (e?.message || ''), 'error'); }
  };

  return (
    <div className="eqf">
      <div id="faq-form">
        <Recolhivel titulo={editId ? 'Editar pergunta' : 'Nova pergunta'} icone={<IconPlus size={16} />}
          aberto={aberto} onAlternar={(v) => { if (!v && editId) limpar(); else setAberto(v); }} className="eqf-recolhivel">
          <div className="field-group">
            <label>Pergunta</label>
            <input value={form.pergunta} onChange={e => set('pergunta', e.target.value)} placeholder="Ex.: Como funciona o check-in?" />
          </div>
          <div className="field-group">
            <label>Resposta</label>
            <textarea rows={6} value={form.resposta} onChange={e => set('resposta', e.target.value)} style={{ resize: 'vertical' }}
              placeholder="Escreva a resposta. Quebras de linha são mantidas." />
            <span className="field-hint">Links que começam com https:// viram clicáveis no app.</span>
          </div>
          <div className="field-group">
            <label>Categoria (opcional)</label>
            <input value={form.categoria} onChange={e => set('categoria', e.target.value)} placeholder="Ex.: Planos" />
          </div>
          <label className="toggle-row">
            <span className="toggle">
              <input type="checkbox" checked={!!form.publicado} onChange={e => set('publicado', e.target.checked)} />
              <span className="toggle-slider" />
            </span>
            Publicada (aparece no app)
          </label>
          <div className="eqf-botoes">
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              <IconCheck size={16} /> {salvando ? 'Salvando…' : (editId ? 'Salvar alterações' : 'Adicionar pergunta')}
            </button>
            {editId && <button type="button" className="btn-ghost" onClick={limpar}>Cancelar</button>}
          </div>
        </Recolhivel>
      </div>

      <button type="button" className="btn-secondary" onClick={sugeridas} disabled={!itens} style={{ marginBottom: 14 }}>
        <IconSpark size={15} /> Adicionar perguntas sugeridas
      </button>

      {itens === null ? <p className="field-hint">Carregando…</p> : itens.length === 0 ? (
        <p className="field-hint">Nenhuma pergunta ainda. No app, a tela mostra um aviso simples.</p>
      ) : itens.map((q, i) => (
        <div key={q.id} className="eqf-item">
          <div className="eqf-linha" style={{ alignItems: 'flex-start' }}>
            <strong style={{ flex: 1 }}>{q.pergunta}</strong>
            <span className={`badge ${q.publicado === false ? 'badge-inactive' : ''}`}>{q.publicado === false ? 'Rascunho' : 'Publicada'}</span>
          </div>
          {q.categoria && <span className="field-hint">{q.categoria}</span>}
          <RespostaComLinks texto={q.resposta} />
          <div className="eqf-ordem">
            <button type="button" className="btn-ghost eqf-icone" disabled={i === 0} onClick={() => reordenar(i, -1)} aria-label="Subir pergunta"><IconUp size={15} /></button>
            <button type="button" className="btn-ghost eqf-icone" disabled={i === itens.length - 1} onClick={() => reordenar(i, 1)} aria-label="Descer pergunta"><IconDown size={15} /></button>
          </div>
          <AcoesItem onEditar={() => editar(q)} onApagar={() => apagar(q)}>
            <button type="button" className="btn-ghost" onClick={() => alternarPublicado(q)}>
              {q.publicado === false ? <><IconEye size={15} /> Publicar</> : <><IconEyeOff size={15} /> Despublicar</>}
            </button>
          </AcoesItem>
        </div>
      ))}
    </div>
  );
}
