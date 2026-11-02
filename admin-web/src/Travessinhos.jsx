import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { ref as sRef, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import Recolhivel from './Recolhivel';
import AcoesItem from './AcoesItem';
import { IconPlus, IconEdit, IconEye, IconEyeOff, IconUp, IconDown, IconClose, IconUpload, IconCheck, IconSpark } from './Icons';

// Os Travessinhos (conteúdo infantil) — o mesmo modelo do app
// (oamorqueefica/src/components/Travessinho.js e AdminTravessinhosScreen.js).
// Coleção travessinhosMateriais; arquivos no Storage em travessinhos/.
const COLECAO = 'travessinhosMateriais';
const MB = 1024 * 1024;
const LIMITES = { imagem: 15 * MB, pdf: 50 * MB, audio: 100 * MB, video: 500 * MB };
const ACEITA = { imagem: 'image/*', pdf: 'application/pdf', audio: 'audio/*', video: 'video/*' };

const TIPOS = [
  { id: 'video', label: 'Vídeo' },
  { id: 'pdf', label: 'PDF' },
  { id: 'quadrinho', label: 'Quadrinhos' },
  { id: 'audio', label: 'Áudio' },
];
const PERSONAGENS = [
  { id: 'todos', label: 'Todos' },
  { id: 'nanda', label: 'Nanda' },
  { id: 'brian', label: 'Brian' },
  { id: 'maju', label: 'Maju' },
];

const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const formVazio = () => ({
  tipo: 'video', titulo: '', descricao: '', capaUrl: '', capaPath: '',
  videoOrigem: 'youtube', youtube: '', arquivoUrl: '', arquivoPath: '', arquivoTipo: '',
  paginas: [], faixaEtaria: '', personagem: 'todos', ordem: '', destaque: false, publicado: false, data: hoje(),
});

export function extrairYoutubeId(texto) {
  const t = String(texto || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  const m = t.match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live|v)\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
const capaDe = (m) => m?.capaUrl || (m?.youtubeId ? `https://i.ytimg.com/vi/${m.youtubeId}/hqdefault.jpg` : '') || (m?.tipo === 'quadrinho' ? m.paginas?.[0]?.url || '' : '');
const caminhosDe = (m) => [m?.capaPath, m?.arquivoPath, ...((m?.paginas || []).map(p => p.path))].filter(Boolean);
const nomeSeguro = (nome) => String(nome || '').trim().replace(/\s+/g, '_').replace(/[^\w.\-]/g, '') || 'arquivo';
const msData = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : v?.seconds ? v.seconds * 1000 : 0);
const ordenar = (lista) => [...lista].sort((a, b) =>
  (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0)
  || (Number(a.ordem) || 0) - (Number(b.ordem) || 0)
  || String(b.data || '').localeCompare(String(a.data || ''))
  || msData(b.criadoEm) - msData(a.criadoEm));

async function apagarArquivo(path) {
  if (!path) return;
  try { await deleteObject(sRef(storage, path)); } catch { /* já não existe */ }
}

async function enviar(classe, arquivos) {
  const saida = [];
  for (const f of arquivos) {
    const mime = f.type || (classe === 'pdf' ? 'application/pdf' : '');
    const ok = classe === 'pdf' ? mime === 'application/pdf' : mime.startsWith(`${classe === 'imagem' ? 'image' : classe}/`);
    if (!ok) throw new Error(`"${f.name}" não é do tipo esperado.`);
    if (f.size > LIMITES[classe]) throw new Error(`"${f.name}" passa de ${Math.round(LIMITES[classe] / MB)} MB.`);
    const path = `travessinhos/${Date.now()}_${nomeSeguro(f.name)}`;
    const r = sRef(storage, path);
    await uploadBytes(r, f, { contentType: mime });
    saida.push({ url: await getDownloadURL(r), path, mime });
  }
  return saida;
}

function Chips({ opcoes, valor, onChange }) {
  return (
    <div className="chip-row" style={{ marginBottom: 0 }}>
      {opcoes.map(o => (
        <button key={o.id} type="button" className={`chip ${valor === o.id ? 'chip-active' : ''}`} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export default function Travessinhos({ showToast }) {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroPub, setFiltroPub] = useState('todos');
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(formVazio);
  const [editando, setEditando] = useState(null);
  const [enviados, setEnviados] = useState([]);
  const [enviando, setEnviando] = useState('');
  const [salvando, setSalvando] = useState(false);
  const formRef = useRef(null);

  useEffect(() => onSnapshot(collection(db, COLECAO),
    (snap) => { setItens(ordenar(snap.docs.map(d => ({ id: d.id, ...d.data() })))); setErro(''); },
    (e) => { setItens([]); setErro(e?.message || 'Erro ao carregar.'); }), []);

  const set = (campo, v) => setForm(p => ({ ...p, [campo]: v }));

  const lista = useMemo(() => (itens || []).filter(m =>
    (filtroTipo === 'todos' || m.tipo === filtroTipo)
    && (filtroPub === 'todos' || (filtroPub === 'publicados' ? m.publicado === true : m.publicado !== true))), [itens, filtroTipo, filtroPub]);

  const subir = async (classe, rotulo, files, aoEnviar) => {
    const arquivos = Array.from(files || []);
    if (!arquivos.length) return;
    setEnviando(rotulo);
    try {
      const arqs = await enviar(classe, arquivos);
      setEnviados(p => [...p, ...arqs.map(a => a.path)]);
      aoEnviar(arqs);
    } catch (e) {
      showToast(e?.message || 'Não foi possível enviar o arquivo.', 'error');
    } finally { setEnviando(''); }
  };

  const limpar = () => { setForm(formVazio()); setEditando(null); setEnviados([]); };
  const cancelar = async () => {
    const descartar = enviados;
    limpar();
    setAberto(false);
    await Promise.all(descartar.map(apagarArquivo));
  };

  const editar = (m) => {
    setEditando(m);
    setEnviados([]);
    setForm({
      ...formVazio(),
      tipo: m.tipo || 'video', titulo: m.titulo || '', descricao: m.descricao || '',
      capaUrl: m.capaUrl || '', capaPath: m.capaPath || '',
      videoOrigem: m.tipo === 'video' && !m.youtubeId && m.arquivoUrl ? 'arquivo' : 'youtube',
      youtube: m.youtubeId ? `https://youtu.be/${m.youtubeId}` : '',
      arquivoUrl: m.arquivoUrl || '', arquivoPath: m.arquivoPath || '', arquivoTipo: m.arquivoTipo || '',
      paginas: Array.isArray(m.paginas) ? m.paginas : [], faixaEtaria: m.faixaEtaria || '',
      personagem: m.personagem || 'todos', ordem: m.ordem != null ? String(m.ordem) : '',
      destaque: !!m.destaque, publicado: m.publicado === true, data: m.data || hoje(),
    });
    setAberto(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const salvar = async () => {
    const titulo = form.titulo.trim();
    if (!titulo) { showToast('Informe o título.', 'error'); return; }
    const tipo = form.tipo;
    const youtubeId = tipo === 'video' && form.videoOrigem === 'youtube' ? extrairYoutubeId(form.youtube) : '';
    if (tipo === 'video' && form.videoOrigem === 'youtube' && !youtubeId) { showToast('Cole um link válido do YouTube (vale vídeo não listado).', 'error'); return; }
    const usaArquivo = tipo === 'pdf' || tipo === 'audio' || (tipo === 'video' && form.videoOrigem === 'arquivo');
    if (usaArquivo && !form.arquivoUrl) { showToast('Envie o arquivo antes de salvar.', 'error'); return; }
    if (tipo === 'quadrinho' && !form.paginas.length) { showToast('Envie ao menos uma página do quadrinho.', 'error'); return; }

    const dados = {
      tipo, titulo: titulo.slice(0, 160), descricao: form.descricao.trim().slice(0, 500),
      capaUrl: form.capaUrl, capaPath: form.capaPath, youtubeId,
      arquivoUrl: usaArquivo ? form.arquivoUrl : '', arquivoPath: usaArquivo ? form.arquivoPath : '', arquivoTipo: usaArquivo ? form.arquivoTipo : '',
      paginas: tipo === 'quadrinho' ? form.paginas.map(p => ({ url: p.url, path: p.path || '' })) : [],
      faixaEtaria: form.faixaEtaria.trim().slice(0, 40), personagem: form.personagem,
      ordem: Number(form.ordem) || 0, destaque: !!form.destaque, publicado: !!form.publicado, data: form.data || hoje(),
    };
    setSalvando(true);
    try {
      if (editando) await updateDoc(doc(db, COLECAO, editando.id), { ...dados, atualizadoEm: serverTimestamp() });
      else await addDoc(collection(db, COLECAO), { ...dados, criadoEm: serverTimestamp() });
      const usados = new Set(caminhosDe(dados));
      const sobras = [...enviados, ...caminhosDe(editando)].filter(p => !usados.has(p));
      showToast(editando ? 'Material atualizado.' : 'Material cadastrado.');
      limpar();
      setAberto(false);
      await Promise.all(sobras.map(apagarArquivo));
    } catch (e) {
      showToast('Não foi possível salvar: ' + (e?.message || ''), 'error');
    } finally { setSalvando(false); }
  };

  const alternarPublicado = async (m) => {
    try {
      await updateDoc(doc(db, COLECAO, m.id), { publicado: m.publicado !== true, atualizadoEm: serverTimestamp() });
      showToast(m.publicado === true ? 'Material despublicado.' : 'Material publicado no app.');
    } catch (e) { showToast('Não foi possível alterar: ' + (e?.message || ''), 'error'); }
  };

  const apagar = async (m) => {
    if (!window.confirm(`Apagar "${m.titulo || 'sem título'}"? Os arquivos enviados também serão apagados.`)) return;
    try {
      await deleteDoc(doc(db, COLECAO, m.id));
      await Promise.all(caminhosDe(m).map(apagarArquivo));
      if (editando?.id === m.id) limpar();
      showToast('Material apagado.');
    } catch (e) { showToast('Não foi possível apagar: ' + (e?.message || ''), 'error'); }
  };

  const moverPagina = (i, d) => setForm(p => {
    const pg = [...p.paginas];
    const j = i + d;
    if (j < 0 || j >= pg.length) return p;
    [pg[i], pg[j]] = [pg[j], pg[i]];
    return { ...p, paginas: pg };
  });

  const ytId = form.tipo === 'video' && form.videoOrigem === 'youtube' ? extrairYoutubeId(form.youtube) : '';
  const capaPrevia = form.capaUrl || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : '') || (form.tipo === 'quadrinho' ? form.paginas[0]?.url : '');
  const usaArquivo = form.tipo === 'pdf' || form.tipo === 'audio' || (form.tipo === 'video' && form.videoOrigem === 'arquivo');
  const classeArquivo = form.tipo === 'pdf' ? 'pdf' : form.tipo === 'audio' ? 'audio' : 'video';

  const AreaEnvio = ({ classe, rotulo, sub, multiplo, aoEnviar }) => (
    <label className="file-upload-area" style={enviando ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
      <input type="file" accept={ACEITA[classe]} multiple={!!multiplo}
        onChange={e => { const fs = e.target.files; subir(classe, rotulo, fs, aoEnviar); e.target.value = ''; }} />
      <div className="file-upload-icon"><IconUpload size={22} /></div>
      <div className="file-upload-text">{enviando === rotulo ? 'Enviando…' : rotulo}</div>
      {sub && <div className="file-upload-sub">{sub}</div>}
    </label>
  );

  return (
    <div className="screen-content">
      <div className="screen-header">
        <h1 className="screen-title">Os Travessinhos</h1>
        <p className="screen-sub">
          Conteúdo infantil com a Nanda, o Brian e a Maju: vídeos, PDFs, histórias em quadrinhos e áudios.
          O card aparece no Início do app assim que houver um material publicado.
        </p>
      </div>

      <div ref={formRef}>
        <Recolhivel
          titulo={editando ? `Editar: ${editando.titulo || 'material'}` : 'Novo material'}
          subtitulo={editando ? 'Altere e salve, ou cancele para descartar' : 'Clique para cadastrar'}
          icone={editando ? <IconEdit size={16} /> : <IconPlus size={16} />}
          aberto={aberto}
          onAlternar={setAberto}
        >
          <div className="field-group">
            <label>Tipo</label>
            <Chips opcoes={TIPOS} valor={form.tipo} onChange={v => set('tipo', v)} />
          </div>
          <div className="field-group">
            <label>Título *</label>
            <input type="text" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex.: A ponte da saudade" />
          </div>
          <div className="field-group">
            <label>Descrição curta</label>
            <textarea rows={2} value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Uma ou duas frases para quem cuida da criança" />
          </div>

          {form.tipo === 'video' && (
            <div className="field-group">
              <label>Origem do vídeo</label>
              <Chips opcoes={[{ id: 'youtube', label: 'Link do YouTube' }, { id: 'arquivo', label: 'Arquivo de vídeo' }]} valor={form.videoOrigem} onChange={v => set('videoOrigem', v)} />
              {form.videoOrigem === 'youtube' && (
                <>
                  <input type="url" style={{ marginTop: 8 }} value={form.youtube} onChange={e => set('youtube', e.target.value)} placeholder="https://youtu.be/... (pode ser não listado)" />
                  {form.youtube && !ytId && <span className="field-hint" style={{ color: 'var(--cor-erro)' }}>Link não reconhecido.</span>}
                </>
              )}
            </div>
          )}

          {usaArquivo && (
            <div className="field-group">
              <label>Arquivo *</label>
              {form.arquivoUrl && (
                <p className="field-hint" style={{ marginTop: 0 }}>
                  <IconCheck size={14} /> <a href={form.arquivoUrl} target="_blank" rel="noreferrer">{(form.arquivoPath || '').split('/').pop() || 'Arquivo enviado'}</a>
                </p>
              )}
              <AreaEnvio classe={classeArquivo}
                rotulo={form.arquivoUrl ? 'Trocar arquivo' : classeArquivo === 'pdf' ? 'Enviar PDF' : classeArquivo === 'audio' ? 'Enviar áudio' : 'Enviar vídeo'}
                sub={`Até ${Math.round(LIMITES[classeArquivo] / MB)} MB`}
                aoEnviar={([a]) => setForm(p => ({ ...p, arquivoUrl: a.url, arquivoPath: a.path, arquivoTipo: a.mime }))} />
            </div>
          )}

          {form.tipo === 'quadrinho' && (
            <div className="field-group">
              <label>Páginas (na ordem de leitura) *</label>
              <div className="trv-paginas">
                {form.paginas.map((p, i) => (
                  <div key={`${i}-${p.url}`} className="trv-pagina">
                    <img src={p.url} alt={`Página ${i + 1}`} loading="lazy" />
                    <span className="trv-pagina-num">Página {i + 1}</span>
                    <span className="trv-pagina-acoes">
                      <button type="button" className="icon-btn" disabled={i === 0} onClick={() => moverPagina(i, -1)} title="Subir"><IconUp size={15} /></button>
                      <button type="button" className="icon-btn" disabled={i === form.paginas.length - 1} onClick={() => moverPagina(i, 1)} title="Descer"><IconDown size={15} /></button>
                      <button type="button" className="icon-btn icon-btn-delete" onClick={() => setForm(f => ({ ...f, paginas: f.paginas.filter((_, k) => k !== i) }))} title="Remover"><IconClose size={15} /></button>
                    </span>
                  </div>
                ))}
              </div>
              <AreaEnvio classe="imagem" multiplo rotulo="Adicionar páginas" sub="Pode escolher várias imagens de uma vez · até 15 MB cada"
                aoEnviar={(arqs) => setForm(p => ({ ...p, paginas: [...p.paginas, ...arqs.map(a => ({ url: a.url, path: a.path }))] }))} />
            </div>
          )}

          <div className="field-group">
            <label>Capa</label>
            <div className="trv-capa-linha">
              {capaPrevia ? <img className="trv-capa" src={capaPrevia} alt="Capa" /> : <div className="trv-capa trv-capa-vazia"><IconSpark size={20} /></div>}
              <div style={{ flex: 1, minWidth: 200 }}>
                <AreaEnvio classe="imagem" rotulo={form.capaUrl ? 'Trocar capa' : 'Enviar capa'} sub="Sem capa: usa a miniatura do YouTube ou a 1ª página do quadrinho"
                  aoEnviar={([a]) => setForm(p => ({ ...p, capaUrl: a.url, capaPath: a.path }))} />
                {form.capaUrl && <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setForm(p => ({ ...p, capaUrl: '', capaPath: '' }))}>Usar capa automática</button>}
              </div>
            </div>
          </div>

          <div className="field-group">
            <label>Personagem em destaque</label>
            <Chips opcoes={PERSONAGENS} valor={form.personagem} onChange={v => set('personagem', v)} />
          </div>

          <div className="trv-campos">
            <div className="field-group">
              <label>Faixa etária (opcional)</label>
              <input type="text" value={form.faixaEtaria} onChange={e => set('faixaEtaria', e.target.value)} placeholder="Ex.: 4 a 8 anos" />
            </div>
            <div className="field-group">
              <label>Ordem</label>
              <input type="number" value={form.ordem} onChange={e => set('ordem', e.target.value)} placeholder="0" />
            </div>
            <div className="field-group">
              <label>Data</label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} />
            </div>
          </div>

          <div className="field-group" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
              <input type="checkbox" checked={form.destaque} onChange={e => set('destaque', e.target.checked)} /> Destaque (aparece primeiro)
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
              <input type="checkbox" checked={form.publicado} onChange={e => set('publicado', e.target.checked)} /> Publicado no app
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" onClick={cancelar} disabled={salvando}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando || !!enviando}>
              <IconCheck size={16} /> {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </Recolhivel>
      </div>

      <div className="filter-row" style={{ marginTop: 18, marginBottom: 8 }}>
        {[{ id: 'todos', label: 'Todos os tipos' }, ...TIPOS].map(t => (
          <button key={t.id} type="button" className={`chip ${filtroTipo === t.id ? 'chip-active' : ''}`} onClick={() => setFiltroTipo(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="filter-row">
        {[{ id: 'todos', label: 'Todos' }, { id: 'publicados', label: 'Publicados' }, { id: 'rascunhos', label: 'Não publicados' }].map(t => (
          <button key={t.id} type="button" className={`chip ${filtroPub === t.id ? 'chip-active' : ''}`} onClick={() => setFiltroPub(t.id)}>{t.label}</button>
        ))}
      </div>

      {erro && <p className="field-hint" style={{ color: 'var(--cor-erro)' }}>Não foi possível carregar: {erro}</p>}
      {itens === null ? (
        <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>
      ) : lista.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconSpark size={34} /></div>
          <p>{itens.length === 0 ? 'Nenhum material cadastrado ainda.' : 'Nenhum material com esses filtros.'}</p>
        </div>
      ) : (
        <div className="list-grid">
          {lista.map(m => {
            const capa = capaDe(m);
            const tipo = TIPOS.find(t => t.id === m.tipo)?.label || m.tipo;
            return (
              <div key={m.id} className={`list-card ${m.publicado !== true ? 'inactive' : ''}`}>
                {capa ? <img className="trv-thumb" src={capa} alt="" loading="lazy" /> : <div className="list-card-icon"><IconSpark size={17} /></div>}
                <div className="list-card-body">
                  <div className="list-card-title">{m.titulo || '(sem título)'}</div>
                  {m.descricao && <div className="list-card-desc">{m.descricao}</div>}
                  <div className="list-card-badges">
                    <span className="badge">{tipo}{m.tipo === 'quadrinho' ? ` · ${(m.paginas || []).length} pág.` : ''}</span>
                    <span className={`badge ${m.publicado === true ? '' : 'badge-inactive'}`}>{m.publicado === true ? 'Publicado' : 'Não publicado'}</span>
                    {m.destaque && <span className="badge">Destaque</span>}
                    {m.faixaEtaria && <span className="badge">{m.faixaEtaria}</span>}
                    {m.personagem && m.personagem !== 'todos' && <span className="badge">{PERSONAGENS.find(p => p.id === m.personagem)?.label}</span>}
                    {m.data && <span className="badge">{m.data.split('-').reverse().join('/')}</span>}
                  </div>
                  <AcoesItem onEditar={() => editar(m)} onApagar={() => apagar(m)}>
                    <button type="button" className="btn-secondary" onClick={() => alternarPublicado(m)}>
                      {m.publicado === true ? <><IconEyeOff size={15} /> Despublicar</> : <><IconEye size={15} /> Publicar</>}
                    </button>
                  </AcoesItem>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
