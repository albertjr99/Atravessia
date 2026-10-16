import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db, storage } from './firebase';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  serverTimestamp, updateDoc, writeBatch,
} from 'firebase/firestore';
import { ref as sRef, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  IconAlert, IconCamera, IconClose, IconDoc, IconDown, IconEdit, IconEye, IconEyeOff,
  IconLink, IconPlay, IconSpark, IconTrash, IconUp, IconVideo,
} from './Icons';
import { VIDEOS, CartaoVideo } from './Videos';
import { ordenarPor } from './ordenar';

// "Produtos Atravessia" na Biblioteca do painel. Reúne:
//  1. o vídeo de produtos (configuracoes/videos → produtos), o mesmo cartão da
//     aba Apresentações — editar aqui ou lá dá no mesmo;
//  2. o espaço de divulgação: itens livres da coleção `produtosItens`, exibidos
//     abaixo do vídeo na tela "Produtos Atravessia" do app, na ordem definida aqui.
// Mesmo modelo de dados de oamorqueefica/src/screens/admin/AdminProdutosScreen.js.
const COLECAO = 'produtosItens';
const MAX_IMAGEM_MB = 10;
const MAX_VIDEO_MB = 500;

const TIPOS = [
  { id: 'texto',  label: 'Texto',  Icon: IconDoc,    dica: 'Um recado, uma novidade ou a história de um produto.' },
  { id: 'imagem', label: 'Imagem', Icon: IconCamera, dica: 'Foto de produto, coleção ou campanha.' },
  { id: 'link',   label: 'Link',   Icon: IconLink,   dica: 'Leva para a loja, WhatsApp, Instagram ou qualquer página.' },
  { id: 'video',  label: 'Vídeo',  Icon: IconPlay,   dica: 'Vídeo enviado aqui ou endereço de um vídeo.' },
];
const tipoInfo = (id) => TIPOS.find(t => t.id === id) || TIPOS[0];

const FORM_INIT = {
  tipo: 'texto', titulo: '', descricao: '',
  imagemUrl: '', imagemPath: '',
  link: '', botaoTexto: '',
  videoUrl: '', videoPath: '',
  ativo: true,
};

function normalizarUrl(u) {
  const limpo = (u || '').trim();
  if (!limpo) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(limpo) ? limpo : `https://${limpo}`;
}

const nomeSeguro = (nome, padrao) =>
  (String(nome || '').trim().replace(/\s+/g, '_').replace(/[^\w.\-]/g, '') || padrao);

const ordenarItens = (docs) => ordenarPor(ordenarPor(docs, 'criadoEm', 'asc'), 'ordem', 'asc');

export default function ProdutosAtravessia({ showToast }) {
  const [config, setConfig] = useState({});
  const [erroVideo, setErroVideo] = useState('');
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(FORM_INIT);
  const [editando, setEditando] = useState(null);
  const [imagemArq, setImagemArq] = useState(null);
  const [imagemPrevia, setImagemPrevia] = useState('');
  const [videoArq, setVideoArq] = useState(null);
  const [saving, setSaving] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const tarefa = useRef(null);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'videos'), (snap) => {
    setConfig(snap.exists() ? snap.data() : {});
    setErroVideo('');
  }, (e) => setErroVideo(e?.message || 'Não foi possível carregar o vídeo.')), []);

  // Sem orderBy: ele exclui documentos sem o campo e um erro mata o listener.
  useEffect(() => onSnapshot(collection(db, COLECAO), (snap) => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    setItens(ordenarItens(docs));
    setErroLista('');
    setCarregando(false);
  }, (e) => {
    setErroLista(e?.message || 'Erro desconhecido.');
    setCarregando(false);
  }), []);

  useEffect(() => () => { if (imagemPrevia) URL.revokeObjectURL(imagemPrevia); }, [imagemPrevia]);

  const infoVideo = VIDEOS.find(v => v.chave === 'produtos');
  const ativos = useMemo(() => itens.filter(i => i.ativo !== false).length, [itens]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const limparArquivos = () => { setImagemArq(null); setImagemPrevia(''); setVideoArq(null); };

  const openNew = (tipo = 'texto') => {
    setForm({ ...FORM_INIT, tipo }); setEditando(null); limparArquivos(); setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({
      tipo: TIPOS.some(t => t.id === item.tipo) ? item.tipo : 'texto',
      titulo: item.titulo || '',
      descricao: item.descricao || '',
      imagemUrl: item.imagemUrl || '',
      imagemPath: item.imagemPath || '',
      link: item.link || '',
      botaoTexto: item.botaoTexto || '',
      videoUrl: item.videoUrl || '',
      videoPath: item.videoPath || '',
      ativo: item.ativo !== false,
    });
    setEditando(item);
    limparArquivos();
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false); setEditando(null); setForm(FORM_INIT); limparArquivos();
  };

  const escolherImagem = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Escolha um arquivo de imagem (JPG, PNG, WEBP...).', 'error'); return; }
    if (file.size > MAX_IMAGEM_MB * 1024 * 1024) { showToast(`A imagem deve ter no máximo ${MAX_IMAGEM_MB} MB.`, 'error'); return; }
    setImagemArq(file);
    setImagemPrevia(URL.createObjectURL(file));
  };

  const removerImagem = () => {
    setImagemArq(null); setImagemPrevia('');
    setForm(prev => ({ ...prev, imagemUrl: '', imagemPath: '' }));
  };

  const escolherVideo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) { showToast('Escolha um arquivo de vídeo (MP4, MOV...).', 'error'); return; }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) { showToast(`O vídeo passa de ${MAX_VIDEO_MB} MB. Exporte em resolução menor (720p ou 1080p).`, 'error'); return; }
    setVideoArq(file);
  };

  const removerVideo = () => {
    setVideoArq(null);
    setForm(prev => ({ ...prev, videoUrl: '', videoPath: '' }));
  };

  const apagarArquivo = async (path) => {
    if (!path) return;
    try { await deleteObject(sRef(storage, path)); }
    catch (e) { if (e?.code !== 'storage/object-not-found') console.warn('Arquivo não apagado:', e?.message); }
  };

  const enviarVideo = (file) => new Promise((resolve, reject) => {
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const caminho = `produtos/video_${Date.now()}.${ext}`;
    const t = uploadBytesResumable(sRef(storage, caminho), file, { contentType: file.type });
    tarefa.current = t;
    setProgresso(0);
    t.on('state_changed',
      (snap) => setProgresso(snap.bytesTransferred / snap.totalBytes),
      (e) => { setProgresso(null); reject(e); },
      async () => {
        try { resolve({ url: await getDownloadURL(t.snapshot.ref), path: caminho }); }
        catch (e) { reject(e); }
        finally { setProgresso(null); }
      });
  });

  const salvar = async () => {
    const tipo = form.tipo;
    const titulo = form.titulo.trim();
    const descricao = form.descricao.trim();
    const link = normalizarUrl(form.link);
    const temImagem = !!(imagemArq || form.imagemUrl);
    const temVideo = !!(videoArq || form.videoUrl.trim());

    if (tipo === 'texto' && !titulo && !descricao) { showToast('Escreva um título ou uma descrição.', 'error'); return; }
    if (tipo === 'imagem' && !temImagem) { showToast('Escolha a imagem a ser enviada.', 'error'); return; }
    if (tipo === 'link' && !link) { showToast('Informe o endereço do link.', 'error'); return; }
    if (tipo === 'video' && !temVideo) { showToast('Envie um vídeo ou cole o endereço dele.', 'error'); return; }

    setSaving(true);
    const enviados = [];
    try {
      let imagemUrl = form.imagemUrl;
      let imagemPath = form.imagemPath;
      if (tipo !== 'video' && imagemArq) {
        imagemPath = `produtos/${Date.now()}_${nomeSeguro(imagemArq.name, 'imagem.jpg')}`;
        const r = sRef(storage, imagemPath);
        await uploadBytes(r, imagemArq, { contentType: imagemArq.type });
        enviados.push(imagemPath);
        imagemUrl = await getDownloadURL(r);
      }
      let videoUrl = normalizarUrl(form.videoUrl);
      let videoPath = form.videoPath;
      if (tipo === 'video' && videoArq) {
        const novo = await enviarVideo(videoArq);
        enviados.push(novo.path);
        videoUrl = novo.url; videoPath = novo.path;
      }
      // Um endereço colado à mão não é arquivo nosso: some o caminho antigo.
      if (tipo === 'video' && !videoArq && videoUrl !== form.videoUrl) videoPath = '';

      const dados = {
        tipo, titulo, descricao,
        link,
        botaoTexto: form.botaoTexto.trim(),
        imagemUrl: tipo === 'video' ? '' : (imagemUrl || ''),
        imagemPath: tipo === 'video' ? '' : (imagemPath || ''),
        videoUrl: tipo === 'video' ? videoUrl : '',
        videoPath: tipo === 'video' ? (videoPath || '') : '',
        ativo: !!form.ativo,
      };

      if (editando) {
        await updateDoc(doc(db, COLECAO, editando.id), { ...dados, atualizadoEm: serverTimestamp() });
        if (editando.imagemPath && editando.imagemPath !== dados.imagemPath) await apagarArquivo(editando.imagemPath);
        if (editando.videoPath && editando.videoPath !== dados.videoPath) await apagarArquivo(editando.videoPath);
        showToast('Item atualizado!');
      } else {
        const maior = itens.reduce((m, i) => (typeof i.ordem === 'number' && i.ordem > m ? i.ordem : m), -1);
        await addDoc(collection(db, COLECAO), { ...dados, ordem: maior + 1, criadoEm: serverTimestamp() });
        showToast('Item adicionado!');
      }
      setSaving(false);
      setShowModal(false); setEditando(null); setForm(FORM_INIT); limparArquivos();
    } catch (e) {
      // Upload feito mas documento não salvo: não deixa arquivo órfão.
      await Promise.all(enviados.map(apagarArquivo));
      if (e?.code !== 'storage/canceled') showToast('Erro ao salvar: ' + (e?.message || 'tente novamente.'), 'error');
      setSaving(false);
    }
  };

  const excluir = async (item) => {
    if (!window.confirm(`Excluir "${item.titulo || 'item sem título'}"? Ele deixa de aparecer no app.`)) return;
    try {
      await deleteDoc(doc(db, COLECAO, item.id));
      await apagarArquivo(item.imagemPath);
      await apagarArquivo(item.videoPath);
      showToast('Item excluído.');
    } catch (e) { showToast('Erro ao excluir: ' + (e?.message || ''), 'error'); }
  };

  const toggleAtivo = async (item) => {
    try { await updateDoc(doc(db, COLECAO, item.id), { ativo: item.ativo === false, atualizadoEm: serverTimestamp() }); }
    catch (e) { showToast('Erro ao alterar a visibilidade: ' + (e?.message || ''), 'error'); }
  };

  // Troca de lugar com o vizinho e regrava a ordem de todos (0, 1, 2...),
  // o que também corrige itens antigos sem `ordem` ou com valores repetidos.
  const mover = async (idx, dir) => {
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= itens.length) return;
    const lista = [...itens];
    [lista[idx], lista[alvo]] = [lista[alvo], lista[idx]];
    try {
      const batch = writeBatch(db);
      lista.forEach((it, i) => { if (it.ordem !== i) batch.update(doc(db, COLECAO, it.id), { ordem: i }); });
      await batch.commit();
    } catch (e) { showToast('Erro ao reordenar: ' + (e?.message || ''), 'error'); }
  };

  const previaImagem = imagemPrevia || form.imagemUrl;
  const mostraImagem = form.tipo !== 'video';
  const tipoAtual = tipoInfo(form.tipo);

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Produtos Atravessia</h1>
          <p className="screen-sub">
            Tudo o que aparece na tela “Produtos Atravessia” do app: o vídeo no topo e, logo abaixo,
            os itens de divulgação na ordem definida aqui.
          </p>
        </div>
        <button className="btn-primary" onClick={() => openNew()}>+ Novo item</button>
      </div>

      <div className="aln-ajuda">
        <IconSpark size={16} />
        <div>
          O atalho <strong>Produtos Atravessia</strong> aparece na tela inicial assim que houver vídeo, link de compra
          ou pelo menos um item ativo. O vídeo também pode ser editado na aba <strong>Apresentações</strong>.
        </div>
      </div>

      {erroVideo && <div className="aln-erro"><IconAlert size={16} /><span>Não foi possível carregar o vídeo: {erroVideo}</span></div>}
      {infoVideo && <CartaoVideo info={infoVideo} dados={config.produtos} showToast={showToast} />}

      <div className="screen-header-row" style={{ marginTop: 8 }}>
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>Espaço de divulgação</h2>
          <p className="field-hint" style={{ margin: '4px 0 0' }}>
            {itens.length === 0
              ? 'Textos, imagens, links e vídeos para apresentar os produtos.'
              : `${itens.length} ${itens.length === 1 ? 'item' : 'itens'} · ${ativos} no app`}
          </p>
        </div>
      </div>

      <div className="filter-row">
        {TIPOS.map(t => (
          <button key={t.id} className="chip" onClick={() => openNew(t.id)} title={t.dica}>
            <t.Icon size={14} /> + {t.label}
          </button>
        ))}
      </div>

      {erroLista && <div className="aln-erro"><IconAlert size={16} /><span>Não foi possível carregar os itens: {erroLista}</span></div>}

      {carregando ? (
        <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>
      ) : itens.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconSpark size={34} /></div>
          <p>Nenhum item ainda. Comece com um texto, uma foto ou o link da loja.</p>
        </div>
      ) : (
        <div className="list-grid">
          {itens.map((item, idx) => {
            const info = tipoInfo(item.tipo);
            return (
              <div key={item.id} className={`list-card ${item.ativo === false ? 'inactive' : ''}`}>
                {item.imagemUrl
                  ? <img className="aln-thumb" src={item.imagemUrl} alt={item.titulo || 'Imagem'} loading="lazy" />
                  : <div className="list-card-icon"><info.Icon size={17} /></div>}
                <div className="list-card-body">
                  <div className="list-card-title">{item.titulo || '(sem título)'}</div>
                  {item.descricao && <div className="list-card-desc">{item.descricao}</div>}
                  {item.link && <a className="list-card-url" href={item.link} target="_blank" rel="noreferrer">{item.link}</a>}
                  {item.tipo === 'video' && item.videoUrl && (
                    <a className="list-card-url" href={item.videoUrl} target="_blank" rel="noreferrer">
                      {item.videoPath ? 'Vídeo enviado' : item.videoUrl}
                    </a>
                  )}
                  <div className="list-card-badges">
                    <span className="badge">{info.label}</span>
                    {item.link && <span className="badge">Botão: {item.botaoTexto || 'Saiba mais'}</span>}
                    {item.ativo === false && <span className="badge badge-inactive">Inativo</span>}
                  </div>
                </div>
                <div className="list-card-actions">
                  <button className="icon-btn" onClick={() => mover(idx, -1)} disabled={idx === 0} title="Subir"><IconUp size={16} /></button>
                  <button className="icon-btn" onClick={() => mover(idx, 1)} disabled={idx === itens.length - 1} title="Descer"><IconDown size={16} /></button>
                  <button className="icon-btn" onClick={() => toggleAtivo(item)} title={item.ativo === false ? 'Ativar' : 'Desativar'}>
                    {item.ativo === false ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                  <button className="icon-btn" onClick={() => openEdit(item)} title="Editar"><IconEdit size={16} /></button>
                  <button className="icon-btn icon-btn-delete" onClick={() => excluir(item)} title="Excluir"><IconTrash size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editando ? 'Editar item' : 'Novo item'}</h2>
              <button className="modal-close" onClick={closeModal}><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Tipo</label>
                <div className="chip-row" style={{ marginBottom: 0 }}>
                  {TIPOS.map(t => (
                    <button key={t.id} className={`chip ${form.tipo === t.id ? 'chip-active' : ''}`} onClick={() => set('tipo', t.id)}>{t.label}</button>
                  ))}
                </div>
                <span className="field-hint">{tipoAtual.dica}</span>
              </div>

              <div className="field-group">
                <label>Título {form.tipo === 'texto' ? '' : <span className="aln-opcional">(opcional)</span>}</label>
                <input type="text" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex.: Caneca Atravessia" autoFocus />
              </div>

              <div className="field-group">
                <label>Descrição <span className="aln-opcional">(opcional)</span></label>
                <textarea rows={form.tipo === 'texto' ? 7 : 4} value={form.descricao} onChange={e => set('descricao', e.target.value)}
                  placeholder="Conte sobre o produto, o material, o carinho por trás dele..." />
                <span className="field-hint">Quebras de linha são mantidas no app; endereços (https://...) viram links.</span>
              </div>

              {mostraImagem && (
                <div className="field-group">
                  <label>Imagem {form.tipo === 'imagem' ? '*' : <span className="aln-opcional">(opcional)</span>}</label>
                  {previaImagem && (
                    <div className="aln-img-previa"><img src={previaImagem} alt="Prévia da imagem" /></div>
                  )}
                  <label className="file-upload-area">
                    <input type="file" accept="image/*" onChange={escolherImagem} />
                    <div className="file-upload-icon"><IconCamera size={22} /></div>
                    <div className="file-upload-text">{imagemArq ? imagemArq.name : previaImagem ? 'Trocar imagem' : 'Escolher imagem'}</div>
                    <div className="file-upload-sub">JPG, PNG ou WEBP · até {MAX_IMAGEM_MB} MB · enviada ao salvar</div>
                  </label>
                  {previaImagem && (
                    <button className="btn-ghost" style={{ marginTop: 8 }} onClick={removerImagem}>Remover imagem</button>
                  )}
                </div>
              )}

              {form.tipo === 'video' && (
                <div className="field-group">
                  <label>Vídeo *</label>
                  {(videoArq || form.videoPath) ? (
                    <div className="aln-ajuda" style={{ marginBottom: 8 }}>
                      <IconVideo size={16} />
                      <div>{videoArq ? `Arquivo escolhido: ${videoArq.name} (enviado ao salvar)` : 'Vídeo enviado pelo painel.'}</div>
                    </div>
                  ) : null}
                  {!videoArq && form.videoUrl && (
                    <video src={form.videoUrl} controls preload="metadata"
                      style={{ width: '100%', maxHeight: 280, borderRadius: 16, background: '#17141f', marginBottom: 8 }} />
                  )}
                  <label className="file-upload-area">
                    <input type="file" accept="video/*" onChange={escolherVideo} />
                    <div className="file-upload-icon"><IconVideo size={22} /></div>
                    <div className="file-upload-text">{videoArq || form.videoUrl ? 'Trocar vídeo' : 'Enviar vídeo'}</div>
                    <div className="file-upload-sub">MP4 · até {MAX_VIDEO_MB} MB (720p ou 1080p)</div>
                  </label>
                  {!videoArq && (
                    <>
                      <label style={{ marginTop: 12 }}>ou endereço do vídeo</label>
                      <input type="url" value={form.videoPath ? '' : form.videoUrl}
                        onChange={e => setForm(prev => ({ ...prev, videoUrl: e.target.value, videoPath: '' }))}
                        placeholder="https://.../video.mp4" />
                      <span className="field-hint">
                        Arquivos de vídeo (MP4) tocam dentro do app. Links do YouTube ou Instagram abrem fora do app, pelo botão.
                      </span>
                    </>
                  )}
                  {(videoArq || form.videoUrl) && (
                    <button className="btn-ghost" style={{ marginTop: 8 }} onClick={removerVideo}>Remover vídeo</button>
                  )}
                </div>
              )}

              <div style={{ background: 'var(--primary-lav)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
                <div className="field-row">
                  <div className="field-group">
                    <label>Link {form.tipo === 'link' ? '*' : <span className="aln-opcional">(opcional)</span>}</label>
                    <input type="url" value={form.link} onChange={e => set('link', e.target.value)} onBlur={e => set('link', normalizarUrl(e.target.value))}
                      placeholder="Loja, WhatsApp, Instagram (https://...)" />
                  </div>
                  <div className="field-group">
                    <label>Texto do botão</label>
                    <input type="text" value={form.botaoTexto} onChange={e => set('botaoTexto', e.target.value)} placeholder="Saiba mais" />
                  </div>
                </div>
                <span className="field-hint">Com link, o item ganha um botão que abre o endereço. Sem texto, o botão diz “Saiba mais”.</span>
              </div>

              <div className="toggle-row">
                <label className="toggle">
                  <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <span style={{ fontSize: 13, color: 'var(--text-dark)' }}>Visível no app</span>
              </div>

              {progresso != null && (
                <div style={{ marginTop: 12 }}>
                  <div className="aln-progresso"><div style={{ width: `${Math.round(progresso * 100)}%` }} /></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-mid)', marginTop: 6 }}>
                    <span>Enviando vídeo... {Math.round(progresso * 100)}%</span>
                    <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => tarefa.current?.cancel()}>Cancelar envio</button>
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button className="btn-ghost" onClick={closeModal} disabled={saving}>Cancelar</button>
                <button className="btn-primary" onClick={salvar} disabled={saving}>
                  {saving ? (progresso != null ? 'Enviando vídeo...' : 'Salvando...') : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

