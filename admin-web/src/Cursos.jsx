import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db, functions, storage } from './firebase';
import { collection, doc, onSnapshot, updateDoc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import Recolhivel from './Recolhivel';
import AcoesItem from './AcoesItem';
import TermoProfissionalPainel, { useTermoProfissional } from './TermoProfissionalPainel';
import { IconPlus, IconUp, IconDown, IconTrash, IconCopy, IconRefresh, IconUpload, IconPlay, IconUsers, IconChart } from './Icons';
import './cursos.css';

// Cursos Atravessia — painel web (mesma tela do app: AdminCursosScreen.js).
// Três abas: Cursos, Profissionais e Vendas e repasses. As vendas
// (matriculas) só o servidor grava; aqui é leitura e registro de repasse.

const SITE_URL = 'https://o-amor-que-fica.web.app';
const brlC = (c) => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.'));
const ms = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : 0);
const dataBR = (t) => (t ? new Date(t).toLocaleDateString('pt-BR') : '—');
const novoIdAula = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const thumb = (a) => a.thumb || `https://i.ytimg.com/vi/${a.youtubeId}/hqdefault.jpg`;
const CURSO_VAZIO = { titulo: '', subtitulo: '', descricao: '', capaUrl: '', preco: '', profissionalId: '', ativo: false, destaque: false, protegerAulas: true, programa: [], aulas: [] };
const PROF_VAZIO = { nome: '', bio: '', fotoUrl: '', email: '', repasseTipo: 'percentual', repasseValor: '50', repasseBase: 'bruto', ativo: true };
// A versão vigente do termo vem do Firestore (configuracoes/termoProfissional),
// editada em TermoProfissionalPainel; não há constante para manter em sincronia.

// A regra de repasse fica em profissionaisPrivado; perfis antigos ainda a
// tinham no documento público.
const comRegra = (prof, priv) => ({
  ...prof,
  repasseTipo: priv?.repasseTipo ?? prof?.repasseTipo,
  repasseValor: priv?.repasseValor ?? prof?.repasseValor,
  repasseBase: priv?.repasseBase ?? prof?.repasseBase,
});

function statusTermo(priv, versaoVigente) {
  const em = ms(priv?.termoAceitoEm);
  if (!em) return { ok: false, texto: 'Termo ainda não aceito no portal' };
  if (priv.termoPedirNovo) return { ok: false, texto: `Novo aceite pedido (aceitou a versão ${priv.termoVersao || '?'} em ${dataBR(em)})` };
  if (priv.termoVersao !== versaoVigente) return { ok: false, texto: `Aceitou a versão ${priv.termoVersao || '?'}; falta aceitar a ${versaoVigente}` };
  return { ok: true, texto: `Termo aceito em ${dataBR(em)} · versão ${priv.termoVersao}` };
}

// Documento público (aulas pagas sem vídeo quando protegido) + cursosConteudo
// com todos os vídeos, no mesmo lote.
async function gravarCurso(editId, dados, aulas) {
  const ref = editId ? doc(db, 'cursos', editId) : doc(collection(db, 'cursos'));
  const publicas = aulas.map(a => ((!dados.protegerAulas || a.gratis) ? a : { id: a.id, titulo: a.titulo, duracao: a.duracao, ordem: a.ordem, gratis: false }));
  const lote = writeBatch(db);
  lote.set(ref, { ...dados, aulas: publicas, atualizadoEm: serverTimestamp(), ...(editId ? {} : { criadoEm: serverTimestamp(), arquivado: false }) }, { merge: true });
  lote.set(doc(db, 'cursosConteudo', ref.id), {
    aulas: Object.fromEntries(aulas.map(a => [a.id, { youtubeId: a.youtubeId, thumb: a.thumb }])),
    atualizadoEm: serverTimestamp(),
  });
  await lote.commit();
  return ref.id;
}
const portal = (profissionalId, acao) => httpsCallable(functions, 'gerenciarPortalProfissional')({ profissionalId, acao });

export function textoRepasse(p) {
  if (!p) return '—';
  if (p.repasseTipo === 'fixo') return `${brlC(Math.round((Number(p.repasseValor) || 0) * 100))} por venda`;
  return `${Number(p.repasseValor) || 0}% ${p.repasseBase === 'liquido' ? 'do valor líquido (após a taxa da Stripe)' : 'do valor pago'}`;
}

function useColecao(nome, ordenar) {
  const [lista, setLista] = useState([]);
  useEffect(() => onSnapshot(collection(db, nome), (sn) => {
    const l = sn.docs.map(d => ({ id: d.id, ...d.data() }));
    setLista(ordenar ? l.sort(ordenar) : l);
  }, () => setLista([])), [nome]); // eslint-disable-line react-hooks/exhaustive-deps
  return lista;
}

async function enviarImagem(arquivo, pasta) {
  if (!arquivo?.type?.startsWith('image/')) throw new Error('Escolha uma imagem (JPG ou PNG).');
  if (arquivo.size > 10 * 1024 * 1024) throw new Error('A imagem passa de 10 MB.');
  const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase();
  const r = sRef(storage, `cursos/${pasta}/${Date.now()}.${ext}`);
  await uploadBytes(r, arquivo, { contentType: arquivo.type });
  return getDownloadURL(r);
}

function Toggle({ checked, onChange, children }) {
  return (
    <div className="toggle-row">
      <label className="toggle"><input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} /><span className="toggle-slider" /></label>
      <span style={{ fontSize: 13.5, color: 'var(--text-dark)' }}>{children}</span>
    </div>
  );
}

function Chips({ opcoes, valor, onChange }) {
  return (
    <div className="filter-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {opcoes.map(([v, r]) => <button key={v} type="button" className={`chip ${valor === v ? 'chip-active' : ''}`} onClick={() => onChange(v)}>{r}</button>)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Aba Cursos
// ═══════════════════════════════════════════════════════════════════════════
// Demonstração: publica o curso de Yoga com 5 vídeos do @yogaparavoce, um
// profissional de teste com vendas fictícias e libera o curso para quem clicou.
function DemoCursos({ showToast }) {
  const [rodando, setRodando] = useState(false);
  const [links, setLinks] = useState(null);
  const executar = async (remover) => {
    if (remover && !window.confirm('Remover o curso, o profissional e as vendas de demonstração?')) return;
    setRodando(true);
    try {
      const { data } = await httpsCallable(functions, 'criarDemonstracaoCursos')({ remover });
      setLinks(remover ? null : data);
      showToast(remover ? 'Demonstração removida.' : 'Demonstração pronta! O curso já aparece no app.');
    } catch (e) { showToast(e?.message || 'Não foi possível criar a demonstração.', 'error'); }
    setRodando(false);
  };
  return (
    <Recolhivel titulo="Demonstração dos Cursos" subtitulo="Curso de Yoga com 5 aulas, profissional de teste e vendas fictícias para apresentar as ferramentas">
      <p className="screen-sub" style={{ marginTop: 0 }}>
        Publica o curso "Yoga para acalmar a mente" (vídeos do canal @yogaparavoce), cadastra o profissional "Yoga para Você (demonstração)"
        com 6 vendas fictícias para o portal e libera o curso para a sua conta assistir no app e na web. Pode clicar de novo para atualizar; nada é duplicado.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn-primary" disabled={rodando} onClick={() => executar(false)}>{rodando ? 'Preparando…' : 'Criar ou atualizar demonstração'}</button>
        <button className="btn-ghost" disabled={rodando} onClick={() => executar(true)}>Remover demonstração</button>
      </div>
      {links && (
        <div className="field-hint" style={{ marginTop: 12, lineHeight: 1.7 }}>
          Área da aluna: <a href={links.linkAluna} target="_blank" rel="noreferrer">{links.linkAluna}</a><br />
          Portal do profissional: <a href={links.linkPortal} target="_blank" rel="noreferrer">abrir</a>{' · '}
          <button type="button" className="btn-ghost" style={{ padding: '2px 10px' }} onClick={() => { navigator.clipboard?.writeText(links.linkPortal); showToast('Link do portal copiado!'); }}>copiar link</button>
        </div>
      )}
    </Recolhivel>
  );
}

export default function Cursos({ showToast }) {
  const cursos = useColecao('cursos', (a, b) => ms(b.criadoEm) - ms(a.criadoEm));
  const profissionais = useColecao('profissionais', (a, b) => String(a.nome).localeCompare(String(b.nome)));
  const privadosLista = useColecao('profissionaisPrivado');
  const privados = useMemo(() => Object.fromEntries(privadosLista.map(p => [p.id, p])), [privadosLista]);
  const matriculas = useColecao('matriculas');
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState(null);
  const [c, setC] = useState(CURSO_VAZIO);
  const [links, setLinks] = useState('');
  const [importando, setImportando] = useState(false);
  const [avisos, setAvisos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [enviandoCapa, setEnviandoCapa] = useState(false);
  const formRef = useRef(null);
  const jsonRef = useRef(null);
  const campo = (k) => (e) => setC(x => ({ ...x, [k]: e?.target ? e.target.value : e }));

  const vendas = useMemo(() => {
    const m = {}; matriculas.forEach(v => { if (v.status === 'ativa') m[v.cursoId] = (m[v.cursoId] || 0) + 1; }); return m;
  }, [matriculas]);

  const limpar = () => { setEditId(null); setC(CURSO_VAZIO); setLinks(''); setAvisos([]); };
  // Ao editar, os vídeos das aulas pagas vêm de cursosConteudo/{id}.
  const editar = async (curso) => {
    let conteudo = {};
    try { conteudo = (await getDoc(doc(db, 'cursosConteudo', curso.id))).data()?.aulas || {}; } catch { /* curso antigo */ }
    const aulas = [...(curso.aulas || [])]
      .map(a => ({ ...a, id: a.id || novoIdAula(), youtubeId: a.youtubeId || conteudo[a.id]?.youtubeId || '', thumb: a.thumb || conteudo[a.id]?.thumb || '' }))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    setEditId(curso.id);
    setC({ ...CURSO_VAZIO, ...curso, protegerAulas: curso.protegerAulas !== false, preco: curso.preco != null ? String(curso.preco).replace('.', ',') : '', programa: curso.programa || [], aulas });
    setAvisos([]); setAberto(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const importar = async () => {
    if (!links.trim()) { showToast('Cole links de vídeos, de uma playlist ou do canal.', 'error'); return; }
    setImportando(true);
    try {
      const { data } = await httpsCallable(functions, 'importarVideosYoutube')({ texto: links });
      const existentes = new Set(c.aulas.map(a => a.youtubeId));
      const novas = (data?.videos || []).filter(v => !existentes.has(v.youtubeId)).map(v => ({ id: novoIdAula(), youtubeId: v.youtubeId, titulo: v.titulo, duracao: v.duracao || '', thumb: v.thumb, gratis: false }));
      setC(x => ({ ...x, aulas: [...x.aulas, ...novas] }));
      setAvisos(data?.avisos || []);
      setLinks('');
      showToast(novas.length ? `${novas.length} aula(s) importada(s). Revise e salve.` : 'Nenhum vídeo novo encontrado.', novas.length ? 'success' : 'error');
    } catch (e) { showToast(e?.message || 'Não foi possível importar.', 'error'); }
    finally { setImportando(false); }
  };

  // Importa um curso de um arquivo JSON (ex.: docs/cursos/exemplo-yoga.json).
  // Cria o profissional (se ainda não existir com o mesmo nome) e o curso como rascunho.
  const importarJson = async (arquivo) => {
    if (!arquivo) return;
    try {
      const j = JSON.parse(await arquivo.text());
      const base = j.curso || j;
      let profissionalId = '';
      if (j.profissional?.nome) {
        const existente = profissionais.find(p => p.nome?.trim().toLowerCase() === j.profissional.nome.trim().toLowerCase());
        profissionalId = existente?.id || (await httpsCallable(functions, 'salvarProfissional')(j.profissional)).data.id;
      }
      setEditId(null);
      setC({
        ...CURSO_VAZIO, ...base, ativo: false, profissionalId,
        preco: base.preco != null ? String(base.preco).replace('.', ',') : '',
        programa: base.programa || [],
        aulas: (base.aulas || []).map(a => ({ ...a, id: a.id || novoIdAula() })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
      });
      setAberto(true);
      showToast('Curso carregado no formulário. Revise e clique em "Criar curso".');
    } catch (e) { showToast(`Arquivo inválido: ${e?.message || ''}`, 'error'); }
    finally { if (jsonRef.current) jsonRef.current.value = ''; }
  };

  const mudarAula = (i, campos) => setC(x => ({ ...x, aulas: x.aulas.map((a, j) => (j === i ? { ...a, ...campos } : a)) }));
  const moverAula = (i, d) => setC(x => { const l = [...x.aulas]; const j = i + d; if (j < 0 || j >= l.length) return x; [l[i], l[j]] = [l[j], l[i]]; return { ...x, aulas: l }; });
  const mudarModulo = (i, campos) => setC(x => ({ ...x, programa: x.programa.map((p, j) => (j === i ? { ...p, ...campos } : p)) }));

  const trocarCapa = async (arquivo) => {
    if (!arquivo) return;
    setEnviandoCapa(true);
    try { const url = await enviarImagem(arquivo, 'capas'); setC(x => ({ ...x, capaUrl: url })); }
    catch (e) { showToast(e?.message || 'Falha no envio.', 'error'); }
    finally { setEnviandoCapa(false); }
  };

  const salvar = async () => {
    const titulo = c.titulo.trim();
    const preco = numero(c.preco);
    if (!titulo) { showToast('Dê um título ao curso.', 'error'); return; }
    if (!(preco >= 1) || preco > 10000) { showToast('Informe o preço (entre R$ 1,00 e R$ 10.000,00).', 'error'); return; }
    if (c.ativo && !c.aulas.length) { showToast('Para publicar, inclua ao menos uma aula.', 'error'); return; }
    const semVideo = c.aulas.findIndex(a => !/^[A-Za-z0-9_-]{11}$/.test(a.youtubeId || ''));
    if (semVideo >= 0) { showToast(`A aula ${semVideo + 1} está sem vídeo do YouTube. Tire-a e importe de novo.`, 'error'); return; }
    const prof = profissionais.find(p => p.id === c.profissionalId);
    if (c.ativo && prof?.ativo === false) { showToast(`${prof.nome} está desativado(a): reative o profissional ou escolha outra pessoa para publicar.`, 'error'); return; }
    setSalvando(true);
    const aulas = c.aulas.map((a, i) => ({ id: a.id || novoIdAula(), youtubeId: a.youtubeId, titulo: (a.titulo || '').trim().slice(0, 200), duracao: (a.duracao || '').trim().slice(0, 12), thumb: thumb(a), ordem: i + 1, gratis: !!a.gratis }));
    // Sem capa: miniatura da primeira aula grátis (a de uma aula paga revelaria o vídeo).
    const capaPadrao = c.protegerAulas ? (aulas.find(a => a.gratis)?.thumb || '') : (aulas[0]?.thumb || '');
    const dados = {
      titulo: titulo.slice(0, 160), subtitulo: c.subtitulo.trim().slice(0, 300), descricao: c.descricao.trim().slice(0, 6000),
      capaUrl: c.capaUrl.trim() || capaPadrao,
      preco: Math.round(preco * 100) / 100, profissionalId: c.profissionalId || null, ativo: !!c.ativo, destaque: !!c.destaque,
      protegerAulas: c.protegerAulas !== false,
      programa: c.programa.filter(p => p.titulo?.trim() || p.descricao?.trim()).map(p => ({ titulo: (p.titulo || '').trim().slice(0, 200), descricao: (p.descricao || '').trim().slice(0, 2000) })),
    };
    try {
      await gravarCurso(editId, dados, aulas);
      showToast(dados.ativo ? 'Curso publicado no app!' : 'Curso salvo como rascunho.');
      limpar(); setAberto(false);
    } catch (e) { showToast(`Erro ao salvar: ${e?.message || ''}`, 'error'); }
    finally { setSalvando(false); }
  };

  const atualizar = (curso, campos) => updateDoc(doc(db, 'cursos', curso.id), { ...campos, atualizadoEm: serverTimestamp() })
    .catch(e => showToast(e?.message || 'Não foi possível atualizar.', 'error'));

  // Com vendas, o curso é arquivado (sai da vitrine e quem comprou continua
  // assistindo). Sem vendas, é excluído de vez. As vendas nunca são apagadas.
  const apagar = async (curso) => {
    const n = vendas[curso.id] || 0;
    if (n > 0) {
      if (!window.confirm(`${n} pessoa(s) compraram "${curso.titulo}".\n\nO curso será ARQUIVADO: sai da vitrine e do painel principal, mas quem comprou continua assistindo. As vendas e os repasses ficam guardados.`)) return;
      await atualizar(curso, { arquivado: true, ativo: false, destaque: false });
      showToast('Curso arquivado.');
      return;
    }
    if (!window.confirm(`Excluir "${curso.titulo}" de vez? Não há vendas ativas. Esta ação não pode ser desfeita.`)) return;
    try {
      const lote = writeBatch(db);
      lote.delete(doc(db, 'cursos', curso.id));
      lote.delete(doc(db, 'cursosConteudo', curso.id));
      await lote.commit();
      showToast('Curso excluído.');
    } catch (e) { showToast(e?.message || '', 'error'); }
  };
  const [verArquivados, setVerArquivados] = useState(false);
  const visiveis = cursos.filter(x => !x.arquivado);
  const arquivados = cursos.filter(x => x.arquivado);

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Cursos</h1>
          <p className="screen-sub">Cursos em vídeo (YouTube não listado) vendidos no app e na área web <a href={`${SITE_URL}/curso.html`} target="_blank" rel="noreferrer">curso.html</a>. Cada venda guarda o repasse do profissional, calculado na hora.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input ref={jsonRef} type="file" accept="application/json,.json" hidden onChange={e => importarJson(e.target.files?.[0])} />
          <button className="btn-secondary" onClick={() => jsonRef.current?.click()}><IconUpload size={15} /> Importar curso (JSON)</button>
        </div>
      </div>

      <DemoCursos showToast={showToast} />

      <div ref={formRef}>
        <Recolhivel titulo={editId ? `Editando: ${c.titulo || 'curso'}` : (c.titulo ? `Novo: ${c.titulo}` : 'Novo curso')} subtitulo="Título, capa, preço, profissional, programa e aulas"
          icone={<IconPlus size={18} />} aberto={aberto} onAlternar={setAberto}>
          <div className="field-group"><label>Título</label><input value={c.titulo} onChange={campo('titulo')} placeholder="Yoga para acalmar a mente" /></div>
          <div className="field-group"><label>Subtítulo</label><input value={c.subtitulo} onChange={campo('subtitulo')} placeholder="Uma frase que convida" /></div>
          <div className="field-group"><label>Descrição</label><textarea rows={5} value={c.descricao} onChange={campo('descricao')} placeholder="Para quem é, o que a pessoa vai viver no curso..." /></div>

          <div className="field-group">
            <label>Capa (16:9)</label>
            {c.capaUrl && <img className="cz-adm-capa" src={c.capaUrl} alt="" />}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                <IconUpload size={15} /> {enviandoCapa ? 'Enviando…' : c.capaUrl ? 'Trocar imagem' : 'Enviar imagem'}
                <input type="file" accept="image/*" hidden onChange={e => trocarCapa(e.target.files?.[0])} />
              </label>
              <input style={{ flex: 1, minWidth: 220 }} value={c.capaUrl} onChange={campo('capaUrl')} placeholder="ou cole o link de uma imagem" />
            </div>
            <p className="field-hint">Sem capa, usamos a miniatura da primeira aula grátis.</p>
          </div>

          <div className="field-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="field-group" style={{ maxWidth: 180 }}><label>Preço (R$)</label><input value={c.preco} onChange={campo('preco')} inputMode="decimal" placeholder="97,00" /></div>
            <div className="field-group" style={{ flex: 1, minWidth: 220 }}>
              <label>Profissional</label>
              <select value={c.profissionalId || ''} onChange={campo('profissionalId')}>
                <option value="">Atravessia (sem repasse)</option>
                {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}{p.ativo === false ? ' (inativo)' : ''} — {textoRepasse(comRegra(p, privados[p.id]))}</option>)}
              </select>
            </div>
          </div>
          <Toggle checked={c.ativo} onChange={campo('ativo')}>Publicado no app <span className="field-hint" style={{ display: 'inline' }}>(desligado, fica como rascunho)</span></Toggle>
          <Toggle checked={c.destaque} onChange={campo('destaque')}>Em destaque na vitrine</Toggle>
          <Toggle checked={c.protegerAulas} onChange={campo('protegerAulas')}>Proteger os vídeos das aulas pagas</Toggle>
          <p className="field-hint" style={{ marginTop: -4 }}>Ligado, só quem comprou recebe o link das aulas pagas. Desligue só se alguém que comprou ainda usa o app 1.20 e não consegue assistir.</p>

          <h3 className="card-title" style={{ marginTop: 22 }}>Conteúdo programático</h3>
          {c.programa.map((p, i) => (
            <div key={i} className="card" style={{ padding: 12, marginBottom: 8 }}>
              <div className="field-group"><input value={p.titulo} onChange={e => mudarModulo(i, { titulo: e.target.value })} placeholder={`Módulo ${i + 1}`} /></div>
              <div className="field-group"><textarea rows={2} value={p.descricao} onChange={e => mudarModulo(i, { descricao: e.target.value })} placeholder="O que se aprende neste módulo" /></div>
              <button type="button" className="btn-ghost" onClick={() => setC(x => ({ ...x, programa: x.programa.filter((_, j) => j !== i) }))}><IconTrash size={14} /> Tirar módulo</button>
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={() => setC(x => ({ ...x, programa: [...x.programa, { titulo: '', descricao: '' }] }))}><IconPlus size={15} /> Adicionar módulo</button>

          <h3 className="card-title" style={{ marginTop: 22 }}>Aulas ({c.aulas.length})</h3>
          <div className="card" style={{ padding: 14, marginBottom: 10, background: 'var(--lilas-50)' }}>
            <strong style={{ fontSize: 14.5 }}>Importar do YouTube</strong>
            <p className="field-hint" style={{ marginTop: 4 }}>Cole links de vídeos não listados (um por linha), de uma playlist ou do canal (@nome ou /channel/UC…). Do canal vêm só os vídeos públicos mais recentes.</p>
            <textarea rows={4} style={{ width: '100%' }} value={links} onChange={e => setLinks(e.target.value)} placeholder={'https://youtu.be/...\nhttps://www.youtube.com/@yogaparavoce'} />
            <button type="button" className="btn-primary" style={{ marginTop: 8 }} onClick={importar} disabled={importando}><IconPlay size={15} /> {importando ? 'Buscando…' : 'Importar do YouTube'}</button>
            {avisos.map((a, i) => <p key={i} className="field-hint" style={{ color: 'var(--acento-dourado-texto)' }}>• {a}</p>)}
          </div>
          {c.aulas.map((a, i) => (
            <div key={a.id || a.youtubeId} className="cz-adm-aula">
              <img src={thumb(a)} alt="" />
              <div className="cz-adm-aula-campos">
                <input value={a.titulo} onChange={e => mudarAula(i, { titulo: e.target.value })} placeholder="Título da aula" />
                <div className="cz-adm-aula-linha">
                  <input style={{ width: 90 }} value={a.duracao || ''} onChange={e => mudarAula(i, { duracao: e.target.value })} placeholder="12:30" title="Duração" />
                  <button type="button" className={`chip ${a.gratis ? 'chip-active' : ''}`} onClick={() => mudarAula(i, { gratis: !a.gratis })}>{a.gratis ? 'Grátis (amostra)' : 'Paga'}</button>
                  <a className="btn-ghost" href={`https://youtu.be/${a.youtubeId}`} target="_blank" rel="noreferrer">Ver no YouTube</a>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="icon-btn" onClick={() => moverAula(i, -1)} aria-label="Subir"><IconUp size={15} /></button>
                  <button type="button" className="icon-btn" onClick={() => moverAula(i, 1)} aria-label="Descer"><IconDown size={15} /></button>
                  <button type="button" className="icon-btn icon-btn-delete" onClick={() => setC(x => ({ ...x, aulas: x.aulas.filter((_, j) => j !== i) }))} aria-label="Tirar aula"><IconTrash size={15} /></button>
                </div>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : editId ? 'Salvar curso' : 'Criar curso'}</button>
            {(editId || c.titulo) && <button className="btn-secondary" onClick={() => { limpar(); setAberto(false); }}>Cancelar</button>}
          </div>
        </Recolhivel>
      </div>

      {visiveis.length === 0 && <div className="empty-state"><p>Nenhum curso ainda. Crie o primeiro acima ou importe o exemplo (docs/cursos/exemplo-yoga.json).</p></div>}
      {arquivados.length > 0 && (
        <button type="button" className="btn-ghost" style={{ marginBottom: 10 }} onClick={() => setVerArquivados(v => !v)}>
          {verArquivados ? 'Esconder arquivados' : `Ver arquivados (${arquivados.length})`}
        </button>
      )}
      <div className="list-grid" style={{ display: 'grid', gap: 12 }}>
        {(verArquivados ? [...visiveis, ...arquivados] : visiveis).map(curso => {
          const prof = profissionais.find(p => p.id === curso.profissionalId);
          const aulaComThumb = (curso.aulas || []).find(a => a.thumb || a.youtubeId);
          const capa = curso.capaUrl || (aulaComThumb ? thumb(aulaComThumb) : null);
          return (
            <div key={curso.id} className="card">
              <div className="cz-adm-curso">
                {capa ? <img src={capa} alt="" /> : <div className="cz-adm-sem-capa" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 className="card-title" style={{ margin: '0 0 4px' }}>{curso.titulo}</h3>
                  <p className="field-hint" style={{ margin: 0 }}>{brlC(Math.round((curso.preco || 0) * 100))} · {(curso.aulas || []).length} aulas · {vendas[curso.id] || 0} vendas · {prof ? `com ${prof.nome}` : 'Atravessia'}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <span className={`badge ${curso.ativo ? 'badge-perceber' : 'badge-inactive'}`}>{curso.arquivado ? 'Arquivado' : curso.ativo ? 'Publicado' : 'Rascunho'}</span>
                    {curso.destaque && <span className="badge badge-total">Destaque</span>}
                    {curso.protegerAulas === false && <span className="badge badge-inactive">Vídeos sem proteção</span>}
                    {prof?.ativo === false && <span className="badge badge-inactive">Profissional inativo: venda pausada</span>}
                  </div>
                </div>
              </div>
              {curso.arquivado ? (
                <AcoesItem>
                  <button type="button" className="btn-ghost" onClick={() => atualizar(curso, { arquivado: false })}>Restaurar (como rascunho)</button>
                </AcoesItem>
              ) : (
                <AcoesItem onEditar={() => editar(curso)} onApagar={() => apagar(curso)} rotuloApagar={vendas[curso.id] ? 'Arquivar' : 'Excluir'}>
                  <button type="button" className="btn-ghost" onClick={() => atualizar(curso, { ativo: !curso.ativo })}>{curso.ativo ? 'Ocultar' : 'Publicar'}</button>
                  <button type="button" className="btn-ghost" onClick={() => atualizar(curso, { destaque: !curso.destaque })}>{curso.destaque ? 'Tirar destaque' : 'Destacar'}</button>
                  <a className="btn-ghost" href={`${SITE_URL}/curso.html?curso=${curso.id}`} target="_blank" rel="noreferrer">Ver na web</a>
                </AcoesItem>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Aba Profissionais
// ═══════════════════════════════════════════════════════════════════════════
export function ProfissionaisCursos({ showToast }) {
  const profissionais = useColecao('profissionais', (a, b) => String(a.nome).localeCompare(String(b.nome)));
  const privadosLista = useColecao('profissionaisPrivado');
  const privados = useMemo(() => Object.fromEntries(privadosLista.map(p => [p.id, p])), [privadosLista]);
  const termoProf = useTermoProfissional();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState(null);
  const [p, setP] = useState(PROF_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const campo = (k) => (e) => setP(x => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const link = (id) => (privados[id]?.tokenPortal ? `${SITE_URL}/profissional.html?t=${privados[id].tokenPortal}` : null);

  const copiar = async (texto) => {
    try { await navigator.clipboard.writeText(texto); showToast('Link do portal copiado!'); }
    catch { window.prompt('Copie o link do portal:', texto); }
  };
  const editar = (prof) => {
    const x = comRegra(prof, privados[prof.id]);
    setEditId(prof.id);
    setP({ ...PROF_VAZIO, ...x, email: privados[prof.id]?.email || '', repasseValor: String(x.repasseValor ?? '').replace('.', ',') });
    setAberto(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const limpar = () => { setEditId(null); setP(PROF_VAZIO); };
  const dadosEnvio = (x, extra = {}) => ({
    id: x.id || undefined, nome: x.nome, bio: x.bio || '', fotoUrl: x.fotoUrl || '', email: x.email || '',
    repasseTipo: x.repasseTipo, repasseValor: numero(x.repasseValor), repasseBase: x.repasseBase, ativo: x.ativo !== false, ...extra,
  });

  const salvar = async () => {
    setSalvando(true);
    try {
      await httpsCallable(functions, 'salvarProfissional')(dadosEnvio({ ...p, id: editId }));
      showToast('Profissional salvo. O link do portal está no cartão.');
      limpar(); setAberto(false);
    } catch (e) { showToast(e?.message || 'Não foi possível salvar.', 'error'); }
    finally { setSalvando(false); }
  };
  const acaoPortal = async (prof, acao, pergunta, sucesso) => {
    if (!window.confirm(pergunta)) return;
    try {
      const { data } = await portal(prof.id, acao);
      if (data?.linkPortal) copiar(data.linkPortal);
      else if (sucesso) showToast(sucesso);
    } catch (e) { showToast(e?.message || 'Não foi possível concluir.', 'error'); }
  };
  const novoLink = (prof) => acaoPortal(prof, 'novoLink', 'Gerar um novo link? O link atual do portal deixa de funcionar. O novo é copiado para você enviar ao profissional.');
  const revogar = (prof) => acaoPortal(prof, 'revogar', 'Revogar o link do portal? Ele deixa de funcionar e nenhum outro é criado. Para devolver o acesso, gere um novo link.', 'Link revogado.');
  const pedirAceite = (prof) => acaoPortal(prof, 'pedirNovoAceite', 'Pedir novo aceite do termo? No próximo acesso, o profissional lê e aceita o termo de novo antes de ver o extrato.', 'Pronto: o portal vai pedir o aceite.');
  const alternarAtivo = (prof) => (prof.ativo === false
    ? acaoPortal(prof, 'ativar', 'Reativar este profissional? Os cursos dele(a) voltam a poder ser vendidos.', 'Profissional reativado.')
    : acaoPortal(prof, 'desativar', 'Desativar este profissional? Os cursos dele(a) param de ser vendidos (quem já comprou continua assistindo). O portal e o extrato continuam funcionando.', 'Profissional desativado.'));
  const foto = async (arquivo) => {
    if (!arquivo) return;
    try { const url = await enviarImagem(arquivo, 'profissionais'); setP(x => ({ ...x, fotoUrl: url })); }
    catch (e) { showToast(e?.message || 'Falha no envio.', 'error'); }
  };

  return (
    <div className="screen-content">
      <div className="screen-header-row"><div>
        <h1 className="screen-title">Profissionais</h1>
        <p className="screen-sub">Quem conduz os cursos, o repasse combinado e o link do portal de prestação de contas (sem login, com extrato transparente).</p>
      </div></div>

      <Recolhivel titulo={editId ? `Editando: ${p.nome}` : 'Novo profissional'} subtitulo="Dados, repasse e portal" icone={<IconUsers size={18} />} aberto={aberto} onAlternar={setAberto}>
        <div className="field-group"><label>Nome (aparece no app)</label><input value={p.nome} onChange={campo('nome')} placeholder="Nome ou nome do canal" /></div>
        <div className="field-group"><label>Mini bio</label><textarea rows={3} value={p.bio} onChange={campo('bio')} /></div>
        <div className="field-group">
          <label>Foto</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {p.fotoUrl && <img className="cz-adm-foto" src={p.fotoUrl} alt="" />}
            <label className="btn-secondary" style={{ cursor: 'pointer' }}><IconUpload size={15} /> Enviar foto<input type="file" accept="image/*" hidden onChange={e => foto(e.target.files?.[0])} /></label>
            <input style={{ flex: 1, minWidth: 220 }} value={p.fotoUrl} onChange={campo('fotoUrl')} placeholder="ou cole o link da foto" />
          </div>
        </div>
        <div className="field-group"><label>E-mail (só a equipe vê)</label><input type="email" value={p.email} onChange={campo('email')} /></div>
        <h3 className="card-title" style={{ marginTop: 18 }}>Repasse combinado</h3>
        <Chips opcoes={[['percentual', 'Percentual'], ['fixo', 'Valor fixo por venda']]} valor={p.repasseTipo} onChange={campo('repasseTipo')} />
        <div className="field-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <div className="field-group" style={{ maxWidth: 200 }}><label>{p.repasseTipo === 'fixo' ? 'Valor por venda (R$)' : 'Percentual (%)'}</label><input value={p.repasseValor} onChange={campo('repasseValor')} inputMode="decimal" /></div>
          {p.repasseTipo === 'percentual' && (
            <div className="field-group" style={{ flex: 1, minWidth: 220 }}>
              <label>Calcular sobre</label>
              <select value={p.repasseBase} onChange={campo('repasseBase')}><option value="bruto">Valor pago pela aluna</option><option value="liquido">Valor após a taxa da Stripe</option></select>
            </div>
          )}
        </div>
        <p className="field-hint">A regra vale para as próximas vendas: cada venda guarda o repasse calculado na hora e ele não muda depois.</p>
        <Toggle checked={p.ativo} onChange={campo('ativo')}>Ativo</Toggle>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar profissional'}</button>
          {editId && <button className="btn-secondary" onClick={() => { limpar(); setAberto(false); }}>Cancelar</button>}
        </div>
      </Recolhivel>

      <TermoProfissionalPainel showToast={showToast} termo={termoProf} profissionais={profissionais} privados={privados} />

      {profissionais.length === 0 && <div className="empty-state"><p>Nenhum profissional cadastrado.</p></div>}
      <div style={{ display: 'grid', gap: 12 }}>
        {profissionais.map(prof => {
          const priv = privados[prof.id] || {};
          const termo = statusTermo(priv, termoProf.versao);
          return (
            <div key={prof.id} className="card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {prof.fotoUrl ? <img className="cz-adm-foto" src={prof.fotoUrl} alt="" /> : <span className="cz-adm-foto">{(prof.nome || '?')[0]}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 className="card-title" style={{ margin: 0 }}>{prof.nome} {prof.ativo === false && <span className="badge badge-inactive">Inativo</span>}</h3>
                  <p className="field-hint" style={{ margin: '2px 0 0' }}>Repasse: {textoRepasse(comRegra(prof, priv))}{priv.email ? ` · ${priv.email}` : ''}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <span className={`badge ${termo.ok ? 'badge-perceber' : 'badge-total'}`}>{termo.texto}</span>
                    {!priv.tokenPortal && <span className="badge badge-inactive">Sem link ativo</span>}
                  </div>
                </div>
              </div>
              <AcoesItem onEditar={() => editar(prof)}>
                {link(prof.id) && <button type="button" className="btn-ghost" onClick={() => copiar(link(prof.id))}><IconCopy size={14} /> Copiar link do portal</button>}
                <button type="button" className="btn-ghost" onClick={() => novoLink(prof)} title="Gerar novo link"><IconRefresh size={14} /> Novo link</button>
                {priv.tokenPortal && <button type="button" className="btn-ghost" onClick={() => revogar(prof)}>Revogar link</button>}
                <button type="button" className="btn-ghost" onClick={() => pedirAceite(prof)}>Pedir novo aceite</button>
                <button type="button" className="btn-ghost" onClick={() => alternarAtivo(prof)}>{prof.ativo === false ? 'Reativar' : 'Desativar'}</button>
              </AcoesItem>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Aba Vendas e repasses
// ═══════════════════════════════════════════════════════════════════════════
const hojeISO = () => new Date().toISOString().slice(0, 10);
const inicioMesISO = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

export function VendasCursos({ showToast }) {
  const cursos = useColecao('cursos');
  const profissionais = useColecao('profissionais');
  const matriculas = useColecao('matriculas', (a, b) => ms(b.criadaEm) - ms(a.criadaEm));
  const repasses = useColecao('repasses', (a, b) => ms(b.criadoEm) - ms(a.criadoEm));
  const [de, setDe] = useState(inicioMesISO());
  const [ate, setAte] = useState(hojeISO());
  const [profFiltro, setProfFiltro] = useState('');
  const [registrando, setRegistrando] = useState(null);
  const inicio = de ? new Date(`${de}T00:00:00`).getTime() : 0;
  const fim = ate ? new Date(`${ate}T23:59:59.999`).getTime() : Date.now();
  const nomeCurso = (id) => cursos.find(c => c.id === id)?.titulo || 'Curso';
  const nomeProf = (id) => profissionais.find(p => p.id === id)?.nome || 'Atravessia';

  const doPeriodo = matriculas.filter(m => { const t = ms(m.criadaEm); return t >= inicio && t <= fim && (!profFiltro || m.profissionalId === profFiltro); });
  const ativas = doPeriodo.filter(m => m.status === 'ativa');
  const soma = (l, k) => l.reduce((a, m) => a + (Number(m[k]) || 0), 0);
  const bruto = soma(ativas, 'valorPagoCentavos');
  const taxas = soma(ativas, 'taxaStripeCentavos');
  const repasse = soma(ativas, 'repasseCentavos');

  const agrupar = (chave) => {
    const g = {};
    ativas.forEach(m => {
      const k = m[chave] || '';
      const x = g[k] || (g[k] = { id: k, vendas: 0, bruto: 0, taxas: 0, repasse: 0, aRepassar: 0 });
      x.vendas++; x.bruto += m.valorPagoCentavos || 0; x.taxas += m.taxaStripeCentavos || 0; x.repasse += m.repasseCentavos || 0;
      if (!m.repasseId) x.aRepassar += m.repasseCentavos || 0;
    });
    return Object.values(g).sort((a, b) => b.bruto - a.bruto);
  };
  const porProf = agrupar('profissionalId');
  const porCurso = agrupar('cursoId');

  // Formulário do repasse: data do pagamento, comprovante (arquivo ou link) e observação.
  const [form, setForm] = useState(null); // { profId, pagoEm: 'aaaa-mm-dd', comprovanteUrl, observacao }
  const [enviandoComp, setEnviandoComp] = useState(false);
  const anexar = async (arquivo) => {
    if (!arquivo) return;
    if (!(arquivo.type?.startsWith('image/') || arquivo.type === 'application/pdf')) { showToast('Escolha uma imagem ou um PDF.', 'error'); return; }
    if (arquivo.size > 10 * 1024 * 1024) { showToast('O arquivo passa de 10 MB.', 'error'); return; }
    setEnviandoComp(true);
    try {
      const ext = arquivo.type === 'application/pdf' ? 'pdf' : ((arquivo.name.split('.').pop() || 'jpg').toLowerCase());
      const r = sRef(storage, `repassesComprovantes/${form.profId}/${Date.now()}.${ext}`);
      await uploadBytes(r, arquivo, { contentType: arquivo.type });
      const url = await getDownloadURL(r);
      setForm(f => ({ ...f, comprovanteUrl: url }));
    } catch (e) { showToast(e?.message || 'Falha no envio.', 'error'); }
    finally { setEnviandoComp(false); }
  };
  const registrar = async () => {
    const profId = form.profId;
    const pagoEm = form.pagoEm ? new Date(`${form.pagoEm}T12:00:00`).getTime() : Date.now();
    if (!window.confirm(`Registrar o repasse de ${nomeProf(profId)}?\n\nMarca como repassadas as vendas de ${dataBR(inicio)} a ${dataBR(fim)} ainda não repassadas. Reembolsos de vendas já repassadas entram como desconto.`)) return;
    setRegistrando(profId);
    try {
      const { data } = await httpsCallable(functions, 'fecharRepasse')({
        profissionalId: profId, inicio, fim, pagoEm, comprovanteUrl: form.comprovanteUrl.trim(), observacao: form.observacao.trim(),
      });
      setForm(null);
      showToast(`Repasse registrado: ${data.vendas} venda(s), ${brlC(data.totalCentavos)}. O profissional já vê no portal.`);
    } catch (e) { showToast(e?.message || 'Não foi possível registrar.', 'error'); }
    finally { setRegistrando(null); }
  };

  return (
    <div className="screen-content">
      <div className="screen-header-row"><div>
        <h1 className="screen-title">Vendas e repasses</h1>
        <p className="screen-sub">Valores vindos da Stripe e congelados no momento da venda. Reembolsos saem dos totais; se a venda já tinha sido repassada, o valor é descontado no repasse seguinte.</p>
      </div></div>

      <div className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="field-group" style={{ margin: 0 }}><label>De</label><input type="date" value={de} onChange={e => setDe(e.target.value)} /></div>
        <div className="field-group" style={{ margin: 0 }}><label>Até</label><input type="date" value={ate} onChange={e => setAte(e.target.value)} /></div>
        <div className="field-group" style={{ margin: 0, minWidth: 220 }}>
          <label>Profissional</label>
          <select value={profFiltro} onChange={e => setProfFiltro(e.target.value)}><option value="">Todos</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
        </div>
        <button className="btn-ghost" onClick={() => { setDe(''); setAte(hojeISO()); }}>Todo o período</button>
      </div>

      <div className="stats-row-mini">
        <div className="stat-mini"><div className="stat-mini-value" style={{ fontSize: 20 }}>{ativas.length}</div><div className="stat-mini-label">Vendas</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ fontSize: 20 }}>{brlC(bruto)}</div><div className="stat-mini-label">Valor pago</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ fontSize: 20 }}>{brlC(taxas)}</div><div className="stat-mini-label">Taxas Stripe</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ fontSize: 20 }}>{brlC(repasse)}</div><div className="stat-mini-label">Repasses</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ fontSize: 20 }}>{brlC(bruto - taxas - repasse)}</div><div className="stat-mini-label">Fica com a Atravessia</div></div>
      </div>
      {doPeriodo.length > ativas.length && <p className="field-hint">{doPeriodo.length - ativas.length} venda(s) reembolsada(s) no período, fora dos totais.</p>}

      <h3 className="card-title" style={{ marginTop: 20 }}><IconChart size={16} /> Por profissional</h3>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Profissional</th><th>Vendas</th><th>Valor pago</th><th>Repasse</th><th>A repassar</th><th /></tr></thead>
          <tbody>
            {porProf.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 18 }}>Nenhuma venda no período.</td></tr>}
            {porProf.map(x => (
              <tr key={x.id || 'casa'}>
                <td>{nomeProf(x.id)}</td><td>{x.vendas}</td><td>{brlC(x.bruto)}</td><td>{brlC(x.repasse)}</td><td><strong>{brlC(x.aRepassar)}</strong></td>
                <td>{x.id && <button className="btn-primary" disabled={!!form} onClick={() => setForm({ profId: x.id, pagoEm: hojeISO(), comprovanteUrl: '', observacao: '' })}>Registrar repasse</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="card" style={{ marginTop: 14 }}>
          <h3 className="card-title" style={{ marginTop: 0 }}>Registrar repasse — {nomeProf(form.profId)}</h3>
          <p className="field-hint" style={{ marginTop: 0 }}>Vendas de {dataBR(inicio)} a {dataBR(fim)} ainda não repassadas. O profissional vê o registro e o comprovante no portal.</p>
          <div className="field-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field-group" style={{ maxWidth: 200 }}><label>Data do pagamento</label><input type="date" value={form.pagoEm} max={hojeISO()} onChange={e => setForm(f => ({ ...f, pagoEm: e.target.value }))} /></div>
            <div className="field-group" style={{ flex: 1, minWidth: 220 }}>
              <label>Comprovante da transferência</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                  <IconUpload size={15} /> {enviandoComp ? 'Enviando…' : form.comprovanteUrl ? 'Trocar arquivo' : 'Anexar imagem ou PDF'}
                  <input type="file" accept="image/*,application/pdf" hidden onChange={e => anexar(e.target.files?.[0])} />
                </label>
                <input style={{ flex: 1, minWidth: 200 }} value={form.comprovanteUrl} onChange={e => setForm(f => ({ ...f, comprovanteUrl: e.target.value }))} placeholder="ou cole o link (https://...)" />
              </div>
            </div>
          </div>
          <p className="field-hint">Prefira um comprovante sem dados bancários completos: ele fica visível para o profissional.</p>
          <div className="field-group"><label>Observação (opcional)</label><input value={form.observacao} maxLength={500} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex.: PIX enviado" /></div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-primary" disabled={!!registrando || enviandoComp} onClick={registrar}>{registrando ? 'Registrando…' : 'Confirmar repasse'}</button>
            <button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <h3 className="card-title" style={{ marginTop: 20 }}>Por curso</h3>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Curso</th><th>Vendas</th><th>Valor pago</th><th>Taxas</th><th>Repasse</th></tr></thead>
          <tbody>{porCurso.map(x => <tr key={x.id}><td>{nomeCurso(x.id)}</td><td>{x.vendas}</td><td>{brlC(x.bruto)}</td><td>{brlC(x.taxas)}</td><td>{brlC(x.repasse)}</td></tr>)}</tbody>
        </table>
      </div>

      <h3 className="card-title" style={{ marginTop: 20 }}>Vendas do período</h3>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Data</th><th>Curso</th><th>Profissional</th><th>Valor</th><th>Taxa</th><th>Repasse</th><th>Situação</th><th>Código Stripe</th></tr></thead>
          <tbody>
            {doPeriodo.slice(0, 300).map(m => (
              <tr key={m.id} style={m.status === 'reembolsada' ? { opacity: 0.6 } : undefined}>
                <td>{dataBR(ms(m.criadaEm))}</td><td>{nomeCurso(m.cursoId)}</td><td>{nomeProf(m.profissionalId)}</td>
                <td>{brlC(m.valorPagoCentavos)}</td><td>{m.taxaStripeCentavos == null ? '—' : brlC(m.taxaStripeCentavos)}</td><td>{brlC(m.repasseCentavos)}</td>
                <td>{m.status === 'reembolsada' ? 'Reembolsada' : m.repasseId ? 'Repassada' : 'A repassar'}</td>
                <td><code title={m.stripePaymentIntent}>{String(m.stripePaymentIntent || '').slice(-8).toUpperCase()}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="card-title" style={{ marginTop: 20 }}>Repasses registrados</h3>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Profissional</th><th>Período</th><th>Vendas</th><th>Descontos</th><th>Total</th><th>Pago em</th><th>Comprovante</th></tr></thead>
          <tbody>
            {repasses.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 18 }}>Nenhum repasse ainda.</td></tr>}
            {repasses.map(r => (
              <tr key={r.id}><td>{nomeProf(r.profissionalId)}</td><td>{r.periodo?.rotulo}</td><td>{(r.matriculaIds || []).length}</td><td>{brlC(r.descontosCentavos)}</td>
                <td><strong>{brlC(r.totalCentavos)}</strong></td><td>{dataBR(ms(r.pagoEm))}</td><td>{r.comprovanteUrl ? <a href={r.comprovanteUrl} target="_blank" rel="noreferrer">Ver</a> : '—'}{r.observacao ? <span className="field-hint" style={{ display: 'block' }}>{r.observacao}</span> : null}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
