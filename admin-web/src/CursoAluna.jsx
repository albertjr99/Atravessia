import React, { useEffect, useMemo, useState } from 'react';
import { auth, db, functions } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, updateDoc, where, serverTimestamp, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Topo, Vitrine, PaginaCurso, TelaAula, aulasOrdenadas, mesclarConteudo } from './cursosVisual';

// Área web da aluna — curso.html. Login com a mesma conta do app (e-mail e
// senha). Mostra "Meus cursos", a vitrine e o player das aulas. O acesso vem
// de usuarios/{uid}/cursos/{cursoId}, gravado só pelo servidor depois do
// pagamento; o progresso é o mesmo do app.
// Endereço: /curso.html  ·  /curso.html?curso=ID  ·  /curso.html?curso=ID&aula=ID

function lerUrl() {
  const p = new URLSearchParams(window.location.search);
  return { cursoId: p.get('curso') || null, aulaId: p.get('aula') || null, pago: p.get('pago') === '1' };
}
function irUrl({ cursoId, aulaId }) {
  const p = new URLSearchParams();
  if (cursoId) p.set('curso', cursoId);
  if (aulaId) p.set('aula', aulaId);
  const q = p.toString();
  window.history.pushState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
  window.dispatchEvent(new Event('popstate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [carregando, setCarregando] = useState(false);
  const entrar = async (e) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try { await signInWithEmailAndPassword(auth, email.trim(), senha); }
    catch { setErro('E-mail ou senha não conferem. Use os mesmos dados do aplicativo Atravessia.'); }
    finally { setCarregando(false); }
  };
  const recuperar = async () => {
    if (!email.trim()) { setErro('Digite seu e-mail para receber o link de nova senha.'); return; }
    try { await sendPasswordResetEmail(auth, email.trim()); setMsg('Enviamos um link para criar uma nova senha. Confira seu e-mail.'); setErro(''); }
    catch { setErro('Não foi possível enviar o e-mail agora. Confira o endereço.'); }
  };
  return (
    <div className="cz-login">
      <form className="cz-cartao" onSubmit={entrar}>
        <span className="cz-sobre" style={{ display: 'block', textAlign: 'center' }}>Cursos</span>
        <h1>Atravessia</h1>
        <p>Entre com a mesma conta do aplicativo para assistir aos seus cursos no computador.</p>
        {erro && <p className="cz-erro">{erro}</p>}
        {msg && <p className="cz-aviso">{msg}</p>}
        <label className="cz-campo">E-mail<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label className="cz-campo">Senha<input type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required /></label>
        <button className="cz-btn" style={{ width: '100%' }} disabled={carregando}>{carregando ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="cz-link" style={{ display: 'block', margin: '12px auto 0' }} onClick={recuperar}>Esqueci minha senha</button>
      </form>
    </div>
  );
}

export default function CursoAluna() {
  const [usuario, setUsuario] = useState(undefined);
  const [nome, setNome] = useState('');
  const [rota, setRota] = useState(lerUrl);
  const [cursos, setCursos] = useState(null);
  const [extras, setExtras] = useState({}); // cursos comprados que saíram da vitrine
  const [meus, setMeus] = useState({});
  const [profs, setProfs] = useState({});
  const [comprando, setComprando] = useState(false);
  const [aviso, setAviso] = useState(rota.pago ? 'Pagamento recebido! Assim que a Stripe confirmar, o curso é liberado aqui sozinho. 💜' : '');
  const [iniciar, setIniciar] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUsuario(u || null);
    if (u) getDoc(doc(db, 'usuarios', u.uid)).then(s => setNome(String(s.data()?.apelido || s.data()?.nome || '').split(' ')[0])).catch(() => {});
  }), []);
  useEffect(() => {
    const f = () => setRota(lerUrl());
    window.addEventListener('popstate', f);
    return () => window.removeEventListener('popstate', f);
  }, []);

  useEffect(() => {
    if (!usuario) return undefined;
    const u = [
      onSnapshot(query(collection(db, 'cursos'), where('ativo', '==', true)), (sn) => {
        const l = sn.docs.map(d => ({ id: d.id, ...d.data() }));
        l.sort((a, b) => (b.destaque === true) - (a.destaque === true) || (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
        setCursos(l);
      }, () => setCursos([])),
      onSnapshot(collection(db, 'usuarios', usuario.uid, 'cursos'), (sn) => {
        const m = {}; sn.forEach(d => { m[d.id] = d.data(); }); setMeus(m);
      }, () => setMeus({})),
      onSnapshot(collection(db, 'profissionais'), (sn) => {
        const m = {}; sn.forEach(d => { m[d.id] = { id: d.id, ...d.data() }; }); setProfs(m);
      }, () => {}),
    ];
    return () => u.forEach(f => f());
  }, [usuario]);

  // Curso comprado que não está mais publicado: busca direto (a aluna mantém o acesso).
  useEffect(() => {
    if (!cursos) return;
    Object.keys(meus).filter(id => !cursos.some(c => c.id === id) && !extras[id]).forEach(id => {
      getDoc(doc(db, 'cursos', id)).then(s => s.exists() && setExtras(x => ({ ...x, [id]: { id, ...s.data() } }))).catch(() => {});
    });
  }, [cursos, meus, extras]);

  useEffect(() => { if (rota.cursoId && meus[rota.cursoId]) setAviso(''); }, [meus, rota.cursoId]);

  const todos = useMemo(() => [...(cursos || []), ...Object.values(extras)], [cursos, extras]);
  const cursoBase = todos.find(c => c.id === rota.cursoId);
  const acesso = cursoBase ? meus[cursoBase.id] || null : null;

  // Vídeos das aulas pagas: cursosConteudo/{id}, que só quem comprou consegue ler.
  const [conteudo, setConteudo] = useState({ id: null, dados: undefined });
  const temAcesso = !!acesso;
  useEffect(() => {
    if (!cursoBase?.id || !temAcesso) { setConteudo({ id: null, dados: null }); return undefined; }
    setConteudo({ id: cursoBase.id, dados: undefined });
    return onSnapshot(doc(db, 'cursosConteudo', cursoBase.id),
      (s) => setConteudo({ id: cursoBase.id, dados: s.exists() ? s.data() : null }),
      () => setConteudo({ id: cursoBase.id, dados: null }));
  }, [cursoBase?.id, temAcesso]);
  const curso = useMemo(() => mesclarConteudo(cursoBase, conteudo.id === cursoBase?.id ? conteudo.dados : null), [cursoBase, conteudo]);
  const carregandoVideo = temAcesso && conteudo.dados === undefined;
  const aula = curso && rota.aulaId ? aulasOrdenadas(curso).find(a => a.id === rota.aulaId) : null;

  const abrirAula = (a) => {
    if (!a) return;
    if (!(acesso || a.gratis)) { irUrl({ cursoId: curso.id }); return; }
    setIniciar(!!rota.aulaId); // ao trocar de aula, já toca
    irUrl({ cursoId: curso.id, aulaId: a.id });
  };

  const concluir = async (a, valor) => {
    if (!acesso) return;
    try {
      await updateDoc(doc(db, 'usuarios', usuario.uid, 'cursos', curso.id), {
        [`progresso.${a.id}`]: valor, ultimaAulaId: a.id, progressoEm: serverTimestamp(),
      });
    } catch (e) { console.warn('[Cursos] progresso', e); }
  };

  const comprar = async () => {
    setComprando(true);
    try {
      const base = `${window.location.origin}${window.location.pathname}?curso=${curso.id}`;
      const { data } = await httpsCallable(functions, 'criarCheckoutCurso')({ cursoId: curso.id, successUrl: `${base}&pago=1`, cancelUrl: base });
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      setAviso(e?.message || 'Não foi possível abrir o pagamento agora. Tente de novo em instantes.');
      setComprando(false);
    }
  };

  let tela;
  if (usuario === undefined || (usuario && cursos === null)) tela = <div className="cz-centro"><div className="cz-spinner" /></div>;
  else if (!usuario) tela = <Entrar />;
  else if (curso && aula) {
    tela = <TelaAula curso={curso} aula={aula} acesso={acesso} onAula={abrirAula} onConcluir={concluir} iniciar={iniciar} carregandoVideo={carregandoVideo} onVoltar={() => irUrl({ cursoId: curso.id })} />;
  } else if (curso) {
    tela = <PaginaCurso curso={curso} prof={profs[curso.profissionalId]} acesso={acesso} onAula={abrirAula} onComprar={comprar} comprando={comprando} aviso={aviso} onVoltar={() => irUrl({})} />;
  } else {
    tela = <Vitrine cursos={todos} meus={meus} profs={profs} nome={nome} onAbrir={(c) => irUrl({ cursoId: c.id })} />;
  }

  return (
    <div className="cz-app">
      <Topo usuario={usuario ? (nome || usuario.email) : null} onSair={() => signOut(auth)} onInicio={() => irUrl({})} />
      {tela}
    </div>
  );
}
