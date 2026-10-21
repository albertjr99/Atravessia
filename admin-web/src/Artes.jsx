import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db, functions, storage } from './firebase';
import {
  collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteObject, getDownloadURL, ref as refStorage, uploadBytes } from 'firebase/storage';
import {
  IconSpark, IconDownload, IconCopy, IconRefresh, IconHeart, IconHeartFill, IconTrash,
  IconBrush, IconClose, IconAlert, IconCheck, IconImage, IconPalette, IconUpload,
} from './Icons';
import {
  FORMATOS_ARTE, ESTILOS_ARTE, IDEIAS_ARTE, PROVEDORES_ARTE,
  rotuloFormato, rotuloEstilo, rotuloProvedor, mensagemErroArte,
} from './artes';
import './artes.css';

// Atravessia Artes — gerador de artes por IA para as administradoras.
// A geração roda na Cloud Function `gerarArte` (functions/index.js), que guarda
// cada imagem em artes/ no Storage e um documento na coleção `artes`. A chave
// da API fica só no servidor; aqui se escolhe o provedor e se liga/desliga
// (configuracoes/artes). Sem chave, a tela continua útil: galeria e compositor.

const quando = (ts) => {
  const d = ts?.toDate ? ts.toDate() : (typeof ts === 'number' ? new Date(ts) : null);
  return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
};

// Baixa a imagem como arquivo (o atributo download não vale entre domínios,
// por isso passa por um blob). Se o navegador bloquear, abre em nova aba.
async function baixarUrl(url, nome) {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    baixarBlob(blob, nome);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}
function baixarBlob(blob, nome) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

function Proporcao({ p }) {
  const [w, h] = p;
  const alto = 34;
  const largura = Math.min(64, Math.round((alto * w) / h));
  const altura = Math.round((largura * h) / w);
  return <span className="art-prop" style={{ width: largura, height: altura }} aria-hidden="true" />;
}

// ─── Configuração (provedor e liga/desliga) ────────────────────────────────
function Configuracao({ status, showToast }) {
  const [cfg, setCfg] = useState({ provedor: 'openai', ativo: true, modeloOpenai: 'gpt-image-1', qualidade: 'medium' });
  const [salvando, setSalvando] = useState(false);
  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'artes'), (snap) => {
    const d = snap.data() || {};
    setCfg(prev => ({ ...prev, ...d, ativo: d.ativo !== false }));
  }, () => {}), []);

  const salvar = async () => {
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'artes'), {
        provedor: cfg.provedor === 'gemini' ? 'gemini' : 'openai',
        ativo: !!cfg.ativo,
        modeloOpenai: cfg.modeloOpenai === 'dall-e-3' ? 'dall-e-3' : 'gpt-image-1',
        qualidade: ['low', 'medium', 'high'].includes(cfg.qualidade) ? cfg.qualidade : 'medium',
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      showToast('Configuração do gerador salva.');
    } catch (e) {
      showToast('Não foi possível salvar: ' + (e?.message || ''), 'error');
    }
    setSalvando(false);
  };

  return (
    <div className="card art-config">
      <h3 className="card-title"><IconPalette size={18} /> Configuração do gerador</h3>
      <p className="field-hint" style={{ marginTop: -8, marginBottom: 14 }}>
        Escolha qual serviço de IA cria as artes. A chave da API fica guardada no servidor, nunca aqui no painel.
      </p>
      <div className="art-provedores">
        {PROVEDORES_ARTE.map(p => {
          const conectado = status?.conectados?.[p.id];
          return (
            <button
              key={p.id} type="button"
              className={`art-provedor ${cfg.provedor === p.id ? 'sel' : ''}`}
              onClick={() => setCfg(c => ({ ...c, provedor: p.id }))}
              aria-pressed={cfg.provedor === p.id}
            >
              <span className="art-provedor-nome">{p.rotulo}</span>
              <span className="art-provedor-det">{p.detalhe}</span>
              <span className={`art-selo ${conectado ? 'ok' : ''}`}>
                {conectado ? 'Chave configurada' : 'Sem chave ainda'}
              </span>
            </button>
          );
        })}
      </div>
      {cfg.provedor === 'openai' && (
        <div className="field-row" style={{ marginTop: 14 }}>
          <div className="field-group" style={{ margin: 0 }}>
            <label>Modelo</label>
            <select value={cfg.modeloOpenai} onChange={e => setCfg(c => ({ ...c, modeloOpenai: e.target.value }))}>
              <option value="gpt-image-1">gpt-image-1 (recomendado)</option>
              <option value="dall-e-3">dall-e-3</option>
            </select>
          </div>
          <div className="field-group" style={{ margin: 0 }}>
            <label>Qualidade</label>
            <select value={cfg.qualidade} onChange={e => setCfg(c => ({ ...c, qualidade: e.target.value }))}>
              <option value="low">Rascunho (mais barata)</option>
              <option value="medium">Equilibrada</option>
              <option value="high">Alta (mais cara)</option>
            </select>
          </div>
        </div>
      )}
      <div className="art-config-rodape">
        <label className="toggle-row" style={{ margin: 0 }}>
          <span className="toggle">
            <input type="checkbox" checked={!!cfg.ativo} onChange={e => setCfg(c => ({ ...c, ativo: e.target.checked }))} />
            <span className="toggle-slider" />
          </span>
          <span style={{ fontWeight: 650 }}>{cfg.ativo ? 'Gerador ligado' : 'Gerador desligado'}</span>
        </label>
        <button className="btn-primary" onClick={salvar} disabled={salvando}>
          <IconCheck size={16} /> {salvando ? 'Salvando…' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  );
}

// ─── Compositor: texto + logotipo sobre a arte (canvas) ────────────────────
const CORES_TEXTO = [
  { id: '#FFFFFF', rotulo: 'Branco' },
  { id: '#2A2433', rotulo: 'Tinta' },
  { id: '#45358A', rotulo: 'Lilás profundo' },
  { id: '#94492F', rotulo: 'Pêssego profundo' },
  { id: '#3D6A4E', rotulo: 'Sálvia profunda' },
];
const POSICOES = [{ id: 'topo', rotulo: 'Topo' }, { id: 'centro', rotulo: 'Centro' }, { id: 'base', rotulo: 'Base' }];
const CANTOS = [
  { id: 'se', rotulo: 'Sup. esq.' }, { id: 'sd', rotulo: 'Sup. dir.' },
  { id: 'ie', rotulo: 'Inf. esq.' }, { id: 'id', rotulo: 'Inf. dir.' },
];

function carregarImagem(src, cruzada = true) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cruzada) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function quebrarLinhas(ctx, texto, largura) {
  const linhas = [];
  String(texto || '').split('\n').forEach(par => {
    let atual = '';
    par.split(/\s+/).filter(Boolean).forEach(p => {
      const teste = atual ? `${atual} ${p}` : p;
      if (ctx.measureText(teste).width > largura && atual) { linhas.push(atual); atual = p; } else atual = teste;
    });
    if (atual) linhas.push(atual);
  });
  return linhas;
}

function rectArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function Compositor({ arte, onFechar, showToast, perfil }) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [logo, setLogo] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [o, setO] = useState({
    titulo: '', frase: '', posicao: 'centro', cor: '#FFFFFF', fonteTitulo: 'marca', escala: 1,
    faixa: true, comLogo: true, comNome: true, canto: 'id', tamLogo: 1,
  });
  const set = (k, v) => setO(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        await Promise.all([
          document.fonts?.load('italic 600 48px "Cormorant Garamond"'),
          document.fonts?.load('700 48px "Figtree"'),
          document.fonts?.load('500 48px "Figtree"'),
        ]).catch(() => {});
        const [i, l] = await Promise.all([
          carregarImagem(arte.url, !arte.local),
          carregarImagem('/travessia_logo.png', false).catch(() => null),
        ]);
        if (vivo) { setImg(i); setLogo(l); }
      } catch {
        if (vivo) setErro('Não foi possível abrir a imagem no compositor.');
      }
    })();
    return () => { vivo = false; };
  }, [arte.url, arte.local]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !img) return;
    const W = img.naturalWidth, H = img.naturalHeight;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    const base = Math.min(W, H);
    const claro = o.cor === '#FFFFFF';

    // Texto
    const tamTit = base * 0.085 * o.escala;
    const tamFrase = base * 0.045 * o.escala;
    const fonteTit = o.fonteTitulo === 'marca'
      ? `italic 600 ${tamTit}px "Cormorant Garamond", Georgia, serif`
      : `700 ${tamTit}px "Figtree", system-ui, sans-serif`;
    const fonteFrase = `500 ${tamFrase}px "Figtree", system-ui, sans-serif`;
    const larguraMax = W * 0.8;
    ctx.font = fonteTit;
    const linTit = quebrarLinhas(ctx, o.titulo, larguraMax);
    ctx.font = fonteFrase;
    const linFrase = quebrarLinhas(ctx, o.frase, larguraMax);
    const altTit = linTit.length * tamTit * 1.12;
    const vao = linTit.length && linFrase.length ? tamFrase * 0.8 : 0;
    const altFrase = linFrase.length * tamFrase * 1.4;
    const bloco = altTit + vao + altFrase;
    if (bloco > 0) {
      const margem = H * 0.09;
      let y = o.posicao === 'topo' ? margem : o.posicao === 'base' ? H - margem - bloco : (H - bloco) / 2;
      if (o.faixa) {
        ctx.font = fonteTit;
        const larguras = linTit.map(l => ctx.measureText(l).width);
        ctx.font = fonteFrase;
        linFrase.forEach(l => larguras.push(ctx.measureText(l).width));
        const pad = base * 0.045;
        const lw = Math.max(...larguras) + pad * 2;
        ctx.fillStyle = claro ? 'rgba(42,36,51,0.30)' : 'rgba(255,252,250,0.72)';
        rectArredondado(ctx, (W - lw) / 2, y - pad, lw, bloco + pad * 2, base * 0.035);
        ctx.fill();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = o.cor;
      ctx.shadowColor = claro ? 'rgba(42,36,51,0.35)' : 'transparent';
      ctx.shadowBlur = claro ? base * 0.012 : 0;
      ctx.font = fonteTit;
      linTit.forEach(l => { ctx.fillText(l, W / 2, y); y += tamTit * 1.12; });
      y += vao;
      ctx.font = fonteFrase;
      linFrase.forEach(l => { ctx.fillText(l, W / 2, y + tamFrase * 0.15); y += tamFrase * 1.4; });
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    }

    // Logotipo (+ nome Atravessia)
    if (o.comLogo && logo) {
      const lado = base * 0.11 * o.tamLogo;
      const m = base * 0.045;
      const tamNome = lado * 0.55;
      ctx.font = `italic 600 ${tamNome}px "Cormorant Garamond", Georgia, serif`;
      const largNome = o.comNome ? ctx.measureText('Atravessia').width + lado * 0.25 : 0;
      const total = lado + largNome;
      const direita = o.canto === 'sd' || o.canto === 'id';
      const embaixo = o.canto === 'ie' || o.canto === 'id';
      const x0 = direita ? W - m - total : m;
      const y0 = embaixo ? H - m - lado : m;
      ctx.drawImage(logo, x0, y0, lado, lado);
      if (o.comNome) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = o.cor;
        ctx.shadowColor = claro ? 'rgba(42,36,51,0.35)' : 'transparent';
        ctx.shadowBlur = claro ? base * 0.01 : 0;
        ctx.fillText('Atravessia', x0 + lado * 1.25, y0 + lado / 2);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      }
    }
  }, [img, logo, o]);

  const gerarBlob = () => new Promise((resolve, reject) => {
    try {
      canvasRef.current.toBlob(b => (b ? resolve(b) : reject(new Error('vazio'))), 'image/png');
    } catch (e) { reject(e); }
  });

  const baixar = async () => {
    try {
      const blob = await gerarBlob();
      baixarBlob(blob, `atravessia-arte-${arte.id || 'composta'}.png`);
    } catch {
      showToast('O navegador não liberou a imagem para exportar. Confira a configuração de CORS do Storage (cors.json).', 'error');
    }
  };

  const salvarNaGaleria = async () => {
    setSalvando(true);
    try {
      const blob = await gerarBlob();
      const ref = doc(collection(db, 'artes'));
      const caminho = `artes/${ref.id}.png`;
      const sref = refStorage(storage, caminho);
      await uploadBytes(sref, blob, { contentType: 'image/png' });
      const url = await getDownloadURL(sref);
      await setDoc(ref, {
        prompt: [o.titulo, o.frase].filter(Boolean).join(' — ') || arte.prompt || 'Arte composta',
        promptFinal: arte.promptFinal || null,
        formato: arte.formato || null, estilo: arte.estilo || null,
        provedor: 'compositor', origemId: arte.id || null,
        url, caminho, criadoPor: perfil?.uid || null, criadoEm: serverTimestamp(), favorita: false,
      });
      showToast('Arte final salva na galeria.');
      onFechar();
    } catch (e) {
      showToast('Não foi possível salvar na galeria: ' + (e?.message || ''), 'error');
    }
    setSalvando(false);
  };

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-card art-comp-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Compositor</h2>
          <button className="modal-close" onClick={onFechar} aria-label="Fechar"><IconClose size={18} /></button>
        </div>
        <div className="modal-body art-comp">
          <div className="art-comp-tela">
            {erro ? <p className="field-hint">{erro}</p>
              : !img ? <div className="loading-state" style={{ minHeight: 240 }}><div className="spinner" /></div>
                : <canvas ref={canvasRef} className="art-comp-canvas" />}
          </div>
          <div className="art-comp-controles">
            <div className="field-group">
              <label>Título</label>
              <input value={o.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex.: Frase do dia" maxLength={80} />
            </div>
            <div className="field-group">
              <label>Frase</label>
              <textarea rows={3} value={o.frase} onChange={e => set('frase', e.target.value)} placeholder="Ex.: A saudade é o amor que ficou sem endereço." maxLength={280} />
            </div>
            <div className="field-group">
              <label>Posição do texto</label>
              <div className="art-seg">
                {POSICOES.map(p => (
                  <button key={p.id} type="button" className={o.posicao === p.id ? 'sel' : ''} onClick={() => set('posicao', p.id)}>{p.rotulo}</button>
                ))}
              </div>
            </div>
            <div className="field-group">
              <label>Cor do texto</label>
              <div className="art-cores">
                {CORES_TEXTO.map(c => (
                  <button
                    key={c.id} type="button" title={c.rotulo} aria-label={c.rotulo}
                    className={`art-cor ${o.cor === c.id ? 'sel' : ''}`} style={{ background: c.id }}
                    onClick={() => set('cor', c.id)}
                  />
                ))}
              </div>
            </div>
            <div className="field-row">
              <div className="field-group">
                <label>Fonte do título</label>
                <select value={o.fonteTitulo} onChange={e => set('fonteTitulo', e.target.value)}>
                  <option value="marca">Da marca (Cormorant)</option>
                  <option value="ui">Moderna (Figtree)</option>
                </select>
              </div>
              <div className="field-group">
                <label>Tamanho do texto</label>
                <input type="range" min="0.6" max="1.6" step="0.05" value={o.escala} onChange={e => set('escala', Number(e.target.value))} />
              </div>
            </div>
            <label className="art-check"><input type="checkbox" checked={o.faixa} onChange={e => set('faixa', e.target.checked)} /> Fundo suave atrás do texto</label>
            <label className="art-check"><input type="checkbox" checked={o.comLogo} onChange={e => set('comLogo', e.target.checked)} /> Logotipo da Atravessia</label>
            {o.comLogo && (
              <>
                <label className="art-check"><input type="checkbox" checked={o.comNome} onChange={e => set('comNome', e.target.checked)} /> Com o nome “Atravessia”</label>
                <div className="field-group" style={{ marginTop: 10 }}>
                  <label>Canto do logotipo</label>
                  <div className="art-seg">
                    {CANTOS.map(c => (
                      <button key={c.id} type="button" className={o.canto === c.id ? 'sel' : ''} onClick={() => set('canto', c.id)}>{c.rotulo}</button>
                    ))}
                  </div>
                </div>
                <div className="field-group">
                  <label>Tamanho do logotipo</label>
                  <input type="range" min="0.6" max="2" step="0.05" value={o.tamLogo} onChange={e => set('tamLogo', Number(e.target.value))} />
                </div>
              </>
            )}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={salvarNaGaleria} disabled={!img || salvando}>
                <IconUpload size={16} /> {salvando ? 'Salvando…' : 'Salvar na galeria'}
              </button>
              <button className="btn-primary" onClick={baixar} disabled={!img}>
                <IconDownload size={16} /> Baixar PNG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cartão de arte (resultado e galeria) ──────────────────────────────────
function CartaoArte({ arte, onCompor, onReusar, onExcluir, onFavoritar, showToast }) {
  const copiar = async () => {
    try { await navigator.clipboard.writeText(arte.prompt || ''); showToast('Descrição copiada.'); } catch { showToast('Não foi possível copiar.', 'error'); }
  };
  return (
    <div className="art-cartao">
      <a className="art-cartao-img" href={arte.url} target="_blank" rel="noopener noreferrer" title="Abrir em tamanho real">
        <img src={arte.url} alt={arte.prompt || 'Arte gerada'} loading="lazy" />
        {arte.favorita && <span className="art-fav-selo"><IconHeartFill size={14} /></span>}
      </a>
      <div className="art-cartao-corpo">
        <p className="art-cartao-prompt" title={arte.prompt}>{arte.prompt}</p>
        <div className="art-cartao-meta">
          {arte.formato && <span className="art-etq">{rotuloFormato(arte.formato)}</span>}
          {arte.estilo && <span className="art-etq">{rotuloEstilo(arte.estilo)}</span>}
          {arte.provedor && <span className="art-etq art-etq-neutra">{rotuloProvedor(arte.provedor)}</span>}
          <span className="art-data">{quando(arte.criadoEm)}</span>
        </div>
        <div className="art-cartao-acoes">
          <button className="icon-btn" title="Baixar" aria-label="Baixar" onClick={() => baixarUrl(arte.url, `atravessia-arte-${arte.id}.png`)}><IconDownload size={18} /></button>
          <button className="icon-btn" title="Compor com texto e logotipo" aria-label="Compor" onClick={() => onCompor(arte)}><IconBrush size={18} /></button>
          <button className="icon-btn" title="Copiar descrição" aria-label="Copiar descrição" onClick={copiar}><IconCopy size={18} /></button>
          {arte.provedor !== 'compositor' && (
            <button className="icon-btn" title="Reusar descrição e opções" aria-label="Reusar" onClick={() => onReusar(arte)}><IconRefresh size={18} /></button>
          )}
          {onFavoritar && (
            <button className={`icon-btn ${arte.favorita ? 'art-fav-on' : ''}`} title={arte.favorita ? 'Tirar dos favoritos' : 'Favoritar'} aria-label="Favoritar" onClick={() => onFavoritar(arte)}>
              {arte.favorita ? <IconHeartFill size={18} /> : <IconHeart size={18} />}
            </button>
          )}
          {onExcluir && (
            <button className="icon-btn icon-btn-delete" title="Excluir" aria-label="Excluir" onClick={() => onExcluir(arte)}><IconTrash size={18} /></button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tela ──────────────────────────────────────────────────────────────────
export default function Artes({ showToast, perfil }) {
  const topoRef = useRef(null);
  const arquivoRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [verConfig, setVerConfig] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [formato, setFormato] = useState('post');
  const [estilo, setEstilo] = useState('aquarela');
  const [quantidade, setQuantidade] = useState(2);
  const [usarPaleta, setUsarPaleta] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState([]);

  const [galeria, setGaleria] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [compondo, setCompondo] = useState(null);

  const carregarStatus = async () => {
    try {
      const r = await httpsCallable(functions, 'statusGeradorArtes')();
      setStatus(r.data);
    } catch (e) {
      setStatus({ pronto: false, naoPublicado: String(e?.code || '').includes('not-found') || String(e?.code || '').includes('internal'), conectados: {} });
    }
  };
  useEffect(() => { carregarStatus(); }, []);

  useEffect(() => onSnapshot(
    query(collection(db, 'artes'), orderBy('criadoEm', 'desc'), limit(150)),
    snap => setGaleria(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    () => setGaleria([]),
  ), []);

  const visiveis = useMemo(
    () => (galeria || []).filter(a => (filtro === 'favoritas' ? a.favorita : filtro === 'compostas' ? a.provedor === 'compositor' : true)),
    [galeria, filtro],
  );

  const naoConectado = status && !status.pronto;
  const desligado = status && status.ativo === false;

  const gerar = async () => {
    if (prompt.trim().length < 3) { showToast('Descreva a arte que você quer criar.', 'error'); return; }
    setGerando(true); setErro(null); setResultado([]);
    try {
      const r = await httpsCallable(functions, 'gerarArte', { timeout: 300000 })({
        prompt: prompt.trim(), formato, estilo, usarPaletaMarca: usarPaleta, quantidade,
      });
      setResultado(r.data?.artes || []);
      showToast(r.data?.artes?.length > 1 ? 'Suas artes estão prontas.' : 'Sua arte está pronta.');
    } catch (e) {
      const m = mensagemErroArte(e);
      setErro(m);
      if (m.naoConectado) setStatus(s => ({ ...(s || {}), pronto: false }));
    }
    setGerando(false);
  };

  const usarIdeia = (i) => { setPrompt(i.prompt); setFormato(i.formato); setEstilo(i.estilo); };

  const reusar = (a) => {
    setPrompt(a.prompt || '');
    if (a.formato) setFormato(a.formato);
    if (a.estilo) setEstilo(a.estilo);
    if (typeof a.usarPaletaMarca === 'boolean') setUsarPaleta(a.usarPaletaMarca);
    topoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const favoritar = async (a) => {
    try { await updateDoc(doc(db, 'artes', a.id), { favorita: !a.favorita }); } catch (e) { showToast('Não foi possível atualizar: ' + (e?.message || ''), 'error'); }
  };

  const excluir = async (a) => {
    if (!window.confirm('Excluir esta arte?\n\nEla sai da galeria e o arquivo é apagado. Não dá para desfazer.')) return;
    try {
      await httpsCallable(functions, 'excluirArte')({ id: a.id });
    } catch {
      // Function ainda não publicada: as regras permitem a exclusão direta.
      try {
        if (a.caminho) await deleteObject(refStorage(storage, a.caminho)).catch(() => {});
        await deleteDoc(doc(db, 'artes', a.id));
      } catch (e) {
        showToast('Não foi possível excluir: ' + (e?.message || ''), 'error');
        return;
      }
    }
    setResultado(r => r.filter(x => x.id !== a.id));
    showToast('Arte excluída.');
  };

  const abrirArquivoProprio = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setCompondo({ id: 'propria', url: URL.createObjectURL(f), local: true, prompt: f.name });
  };

  return (
    <div className="screen-content art">
      <div className="screen-header-row" ref={topoRef}>
        <div>
          <h1 className="screen-title">Atravessia Artes</h1>
          <p className="screen-sub">Descreva a arte, escolha o formato e o estilo, e a IA cria imagens no jeito da Atravessia: delicadas, acolhedoras e sem texto. Depois, finalize no compositor com frase e logotipo.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={() => arquivoRef.current?.click()}><IconImage size={16} /> Compor com imagem própria</button>
          <button className="btn-ghost" onClick={() => setVerConfig(v => !v)}><IconPalette size={16} /> {verConfig ? 'Fechar configuração' : 'Configuração'}</button>
          <input ref={arquivoRef} type="file" accept="image/*" hidden onChange={abrirArquivoProprio} />
        </div>
      </div>

      {naoConectado && (
        <div className="art-aviso">
          <span className="art-aviso-icone"><IconAlert size={20} /></span>
          <div>
            <strong>{desligado ? 'Gerador desligado' : 'Gerador ainda não conectado'}</strong>
            <p>
              {desligado
                ? 'O gerador está desligado na configuração. Ligue-o para voltar a criar artes.'
                : status.naoPublicado
                  ? 'O gerador ainda não foi publicado no servidor. Assim que a atualização for publicada e a chave da API configurada, ele passa a funcionar.'
                  : 'Assim que a chave da API for configurada, ele passa a funcionar. Enquanto isso, a galeria e o compositor seguem disponíveis.'}
            </p>
          </div>
        </div>
      )}

      {verConfig && <Configuracao status={status} showToast={(m, t) => { showToast(m, t); carregarStatus(); }} />}

      {/* Criar */}
      <div className="card art-criar">
        <div className="field-group">
          <label htmlFor="art-prompt">Descreva a arte</label>
          <textarea
            id="art-prompt" className="art-prompt" rows={4} maxLength={1200}
            value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="Ex.: Uma folha de ginkgo flutuando sobre um fundo de aquarela lavanda, com bastante espaço livre para uma frase."
          />
          <span className="field-hint">Não é preciso pedir “sem texto” nem falar das cores da marca: isso já vai junto, automaticamente.</span>
        </div>
        <div className="art-ideias">
          <span className="art-ideias-rot"><IconSpark size={15} /> Ideias</span>
          {IDEIAS_ARTE.map(i => (
            <button key={i.rotulo} type="button" className="chip" onClick={() => usarIdeia(i)}>{i.rotulo}</button>
          ))}
        </div>

        <div className="art-secao-rot">Formato</div>
        <div className="art-formatos">
          {FORMATOS_ARTE.map(f => (
            <button key={f.id} type="button" className={`art-formato ${formato === f.id ? 'sel' : ''}`} onClick={() => setFormato(f.id)} aria-pressed={formato === f.id}>
              <span className="art-prop-caixa"><Proporcao p={f.proporcao} /></span>
              <span className="art-formato-nome">{f.rotulo}</span>
              <span className="art-formato-det">{f.detalhe}</span>
            </button>
          ))}
        </div>

        <div className="art-secao-rot">Estilo</div>
        <div className="art-estilos">
          {ESTILOS_ARTE.map(e => (
            <button key={e.id} type="button" className={`art-estilo ${estilo === e.id ? 'sel' : ''}`} onClick={() => setEstilo(e.id)} aria-pressed={estilo === e.id}>
              <span className="art-estilo-amostra" style={{ background: `linear-gradient(135deg, ${e.cores[0]}, ${e.cores[1]} 55%, ${e.cores[2]})` }} />
              <span className="art-estilo-nome">{e.rotulo}</span>
              <span className="art-estilo-desc">{e.descricao}</span>
            </button>
          ))}
        </div>

        <div className="art-linha-final">
          <div>
            <div className="art-secao-rot" style={{ marginTop: 0 }}>Quantidade</div>
            <div className="art-seg">
              {[1, 2, 3, 4].map(n => (
                <button key={n} type="button" className={quantidade === n ? 'sel' : ''} onClick={() => setQuantidade(n)}>{n}</button>
              ))}
            </div>
          </div>
          <label className="toggle-row" style={{ margin: 0 }}>
            <span className="toggle">
              <input type="checkbox" checked={usarPaleta} onChange={e => setUsarPaleta(e.target.checked)} />
              <span className="toggle-slider" />
            </span>
            <span>
              <span style={{ fontWeight: 650, display: 'block' }}>Usar a paleta da marca</span>
              <span className="field-hint" style={{ marginTop: 0 }}>Lavanda, pêssego e sálvia em aquarela suave</span>
            </span>
          </label>
          <button className="btn-primary art-gerar" onClick={gerar} disabled={gerando || prompt.trim().length < 3}>
            {gerando ? <><span className="art-spin" /> Criando…</> : <><IconSpark size={17} /> Gerar {quantidade > 1 ? `${quantidade} artes` : 'arte'}</>}
          </button>
        </div>
      </div>

      {gerando && (
        <div className="art-grade">
          {Array.from({ length: quantidade }).map((_, i) => (
            <div key={i} className="art-esqueleto" style={{ aspectRatio: FORMATOS_ARTE.find(f => f.id === formato).proporcao.join(' / ') }}>
              <span>Criando com cuidado…<br />pode levar até um minuto</span>
            </div>
          ))}
        </div>
      )}

      {erro && !gerando && (
        <div className={erro.naoConectado ? 'art-aviso' : 'alert-box'} style={{ marginTop: 16 }}>
          {erro.naoConectado && <span className="art-aviso-icone"><IconAlert size={20} /></span>}
          {!erro.naoConectado && <IconAlert size={16} />}
          <div>
            {erro.naoConectado && <strong>Gerador ainda não conectado</strong>}
            <p style={{ margin: 0 }}>{erro.texto}</p>
          </div>
        </div>
      )}

      {resultado.length > 0 && !gerando && (
        <>
          <h2 className="art-titulo-secao">Acabou de nascer</h2>
          <div className="art-grade">
            {resultado.map(a => (
              <CartaoArte key={a.id} arte={a} onCompor={setCompondo} onReusar={reusar} onExcluir={excluir} showToast={showToast} />
            ))}
          </div>
        </>
      )}

      {/* Galeria */}
      <div className="art-galeria-topo">
        <h2 className="art-titulo-secao" style={{ margin: 0 }}>Galeria</h2>
        <div className="chip-row" style={{ margin: 0 }}>
          {[{ id: 'todas', r: 'Todas' }, { id: 'favoritas', r: 'Favoritas' }, { id: 'compostas', r: 'Finalizadas no compositor' }].map(f => (
            <button key={f.id} className={`chip ${filtro === f.id ? 'chip-active' : ''}`} onClick={() => setFiltro(f.id)}>{f.r}</button>
          ))}
        </div>
      </div>
      {galeria === null ? (
        <div className="loading-state" style={{ minHeight: 200 }}><div className="spinner" /></div>
      ) : visiveis.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconImage size={28} /></div>
          <p>{filtro === 'todas' ? 'As artes criadas aparecem aqui, guardadas para baixar e reusar quando quiser.' : 'Nenhuma arte neste filtro por enquanto.'}</p>
        </div>
      ) : (
        <div className="art-grade">
          {visiveis.map(a => (
            <CartaoArte key={a.id} arte={a} onCompor={setCompondo} onReusar={reusar} onExcluir={excluir} onFavoritar={favoritar} showToast={showToast} />
          ))}
        </div>
      )}

      {compondo && (
        <Compositor
          arte={compondo} perfil={perfil} showToast={showToast}
          onFechar={() => { if (compondo.local) URL.revokeObjectURL(compondo.url); setCompondo(null); }}
        />
      )}
    </div>
  );
}
