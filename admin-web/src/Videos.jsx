import React, { useEffect, useRef, useState } from 'react';
import { db, storage } from './firebase';
import { doc, onSnapshot, setDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { IconPlay, IconTrash } from './Icons';

// Vídeos de apresentação exibidos no app (porte de
// oamorqueefica/src/screens/admin/AdminVideosScreen.js). Ficam em
// configuracoes/videos → { jornadas: {...}, parcerias: {...} }. Na primeira vez
// que a usuária abre a tela correspondente o vídeo toca sozinho; depois fica
// no botão "Assistir à apresentação". Trocar o vídeo aqui não exige novo app.
const VIDEOS = [
  {
    chave: 'jornadas',
    nome: 'Continue a travessia',
    tituloPadrao: 'Conheça o Continue a travessia',
    desc: 'Aparece na tela "Continue a travessia".',
  },
  {
    chave: 'parcerias',
    nome: 'Experimente a vida',
    tituloPadrao: 'Conheça o Experimente a vida',
    desc: 'Aparece na tela "Experimente a vida" (Benefícios e Parcerias).',
  },
];

const MAX_MB = 500;

function CartaoVideo({ info, dados, showToast }) {
  const [titulo, setTitulo] = useState(dados?.titulo || info.tituloPadrao);
  const [progresso, setProgresso] = useState(null);
  const tarefa = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { setTitulo(dados?.titulo || info.tituloPadrao); }, [dados?.titulo, info.tituloPadrao]);

  const salvar = (campos) => setDoc(doc(db, 'configuracoes', 'videos'), {
    [info.chave]: { ...(dados || {}), ...campos, atualizadoEm: serverTimestamp() },
  }, { merge: true });

  const enviar = (arquivo) => {
    if (!arquivo) return;
    if (!arquivo.type.startsWith('video/')) { showToast('Escolha um arquivo de vídeo (MP4, MOV...).', 'error'); return; }
    if (arquivo.size > MAX_MB * 1024 * 1024) { showToast(`O vídeo passa de ${MAX_MB} MB. Exporte em resolução menor (720p ou 1080p).`, 'error'); return; }
    const ext = (arquivo.name.split('.').pop() || 'mp4').toLowerCase();
    const caminho = `videos/${info.chave}_${Date.now()}.${ext}`;
    const t = uploadBytesResumable(sRef(storage, caminho), arquivo, { contentType: arquivo.type });
    tarefa.current = t;
    setProgresso(0);
    t.on('state_changed',
      (snap) => setProgresso(snap.bytesTransferred / snap.totalBytes),
      (e) => {
        setProgresso(null);
        if (e?.code !== 'storage/canceled') showToast(`Falha no envio: ${e?.message || 'tente de novo.'}`, 'error');
      },
      async () => {
        try {
          const url = await getDownloadURL(t.snapshot.ref);
          const anterior = dados?.storagePath;
          await salvar({ url, storagePath: caminho, titulo: titulo.trim() || info.tituloPadrao, ativo: true });
          if (anterior && anterior !== caminho) deleteObject(sRef(storage, anterior)).catch(() => {});
          showToast('Vídeo publicado no app!');
        } catch (e) {
          showToast(`Erro ao salvar: ${e?.message || 'tente de novo.'}`, 'error');
        } finally {
          setProgresso(null);
        }
      });
  };

  const remover = async () => {
    if (!window.confirm(`Remover o vídeo de "${info.nome}"? Ele deixa de aparecer no app.`)) return;
    try {
      await setDoc(doc(db, 'configuracoes', 'videos'), { [info.chave]: deleteField() }, { merge: true });
      if (dados?.storagePath) deleteObject(sRef(storage, dados.storagePath)).catch(() => {});
      showToast('Vídeo removido.');
    } catch (e) { showToast(`Erro ao remover: ${e?.message || ''}`, 'error'); }
  };

  const salvarTitulo = async () => {
    if (!dados?.url) return;
    try { await salvar({ titulo: titulo.trim() || info.tituloPadrao }); showToast('Título atualizado.'); }
    catch (e) { showToast(`Erro ao salvar: ${e?.message || ''}`, 'error'); }
  };

  const alternarAtivo = async () => {
    try { await salvar({ ativo: dados?.ativo === false }); }
    catch (e) { showToast(`Erro ao salvar: ${e?.message || ''}`, 'error'); }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ color: 'var(--primary)' }}><IconPlay size={18} /></span>
        <h3 className="card-title" style={{ margin: 0, flex: 1 }}>{info.nome}</h3>
        {dados?.url && (
          <span className={`badge ${dados.ativo === false ? 'badge-inactive' : 'badge-total'}`}>
            {dados.ativo === false ? 'Oculto' : 'No app'}
          </span>
        )}
      </div>
      <p className="field-hint" style={{ marginBottom: 12 }}>{info.desc}</p>

      {dados?.url ? (
        <video src={dados.url} controls preload="metadata"
          style={{ width: '100%', maxHeight: 360, borderRadius: 10, background: '#17141f', marginBottom: 12 }} />
      ) : (
        <div className="empty-state" style={{ padding: 20, marginBottom: 12 }}>
          <p>Nenhum vídeo enviado ainda.</p>
        </div>
      )}

      <div className="field-group">
        <label>Título exibido no app</label>
        <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} onBlur={salvarTitulo} />
      </div>

      {progresso != null ? (
        <div>
          <div className="aln-progresso"><div style={{ width: `${Math.round(progresso * 100)}%` }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-mid)', marginTop: 6 }}>
            <span>Enviando... {Math.round(progresso * 100)}%</span>
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => tarefa.current?.cancel()}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => inputRef.current?.click()}>
            {dados?.url ? 'Trocar vídeo' : 'Enviar vídeo'}
          </button>
          {dados?.url && (
            <>
              <button className="btn-ghost" onClick={alternarAtivo}>{dados.ativo === false ? 'Mostrar no app' : 'Ocultar do app'}</button>
              <button className="icon-btn icon-btn-delete" onClick={remover} title="Remover vídeo"><IconTrash size={16} /></button>
            </>
          )}
          <input ref={inputRef} type="file" accept="video/*" style={{ display: 'none' }}
            onChange={e => { enviar(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      )}
    </div>
  );
}

export default function Videos({ showToast }) {
  const [config, setConfig] = useState({});
  const [erro, setErro] = useState('');

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'videos'), (snap) => {
    setConfig(snap.exists() ? snap.data() : {});
    setErro('');
  }, (e) => setErro(e?.message || 'Não foi possível carregar os vídeos.')), []);

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Vídeos de apresentação</h1>
          <p className="screen-sub">
            Na primeira vez que a usuária abre a tela, o vídeo toca sozinho. Depois, fica disponível no botão
            “Assistir à apresentação”. Formato recomendado: MP4, até {MAX_MB} MB (720p ou 1080p).
          </p>
        </div>
      </div>
      {erro && <div className="aln-erro"><span>Não foi possível carregar os vídeos: {erro}</span></div>}
      {VIDEOS.map(v => <CartaoVideo key={v.chave} info={v} dados={config[v.chave]} showToast={showToast} />)}
    </div>
  );
}
