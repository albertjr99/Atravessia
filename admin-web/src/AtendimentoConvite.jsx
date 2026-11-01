import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile, signOut,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';
import { Topo } from './cursosVisual';
import { TCLE_VERSAO, TCLE_RESUMO, TCLE_TEXTO } from './tcleAtendimento';

// Página do convite do atendimento online: atendimento.html?c=<token>.
// 1) mostra a sessão; 2) cria a conta Atravessia (ou entra) e aceita o termo;
// 3) teste de câmera e microfone; 4) "Entrar na sala" (libera 10 min antes);
// 5) depois da sessão, convite para continuar no app.
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.atravessia';
const APP_WEB = '/app/';

const chamar = (nome, dados) => httpsCallable(functions, nome)(dados).then(r => r.data);
const tokenDaUrl = () => new URLSearchParams(window.location.search).get('c') || '';

const dataHora = (ms) => new Date(ms).toLocaleString('pt-BR', {
  weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
});
const dataCurta = (ms) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

function mensagemErro(e) {
  const c = e?.code || '';
  if (c === 'auth/email-already-in-use') return 'Este e-mail já tem conta no Atravessia. Toque em "Já tenho conta" e entre com a sua senha.';
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found') return 'E-mail ou senha não conferem. Se esqueceu a senha, use "Esqueci minha senha".';
  if (c === 'auth/weak-password') return 'Escolha uma senha com pelo menos 6 caracteres.';
  if (c === 'auth/invalid-email') return 'Confira o e-mail digitado.';
  if (c === 'auth/too-many-requests') return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
  if (c === 'auth/network-request-failed') return 'Sem conexão com a internet. Confira e tente de novo.';
  return e?.message?.replace(/^Firebase:\s*/, '') || 'Algo não deu certo. Tente de novo.';
}

export default function AtendimentoConvite() {
  const token = useMemo(tokenDaUrl, []);
  const [user, setUser] = useState(undefined);
  const [info, setInfo] = useState(null);
  const [erro, setErro] = useState('');
  const [etapa, setEtapa] = useState('sessao'); // sessao | chamada | fim
  const [chamada, setChamada] = useState(null);
  const [beneficio, setBeneficio] = useState(null);
  const [termoMarcado, setTermoMarcado] = useState(false);
  const aceitandoRef = useRef(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const carregar = useCallback(async () => {
    if (!token) { setErro('Link incompleto. Abra o link exatamente como você recebeu.'); return; }
    try {
      const d = await chamar('obterConviteAtendimento', { token });
      d.offset = d.agora - Date.now();
      setInfo(d);
      setErro('');
    } catch (e) { setErro(e?.message || 'Não foi possível abrir o convite.'); }
  }, [token]);

  useEffect(() => { if (user !== undefined) carregar(); }, [user, carregar]);

  const aceitar = useCallback(async (nome) => {
    if (aceitandoRef.current) return;
    aceitandoRef.current = true;
    try {
      const r = await chamar('aceitarConviteAtendimento', { token, aceiteTcle: true, tcleVersao: TCLE_VERSAO, nome });
      setBeneficio(r.beneficio || null);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Não foi possível aceitar o convite.');
    } finally { aceitandoRef.current = false; }
  }, [token, carregar]);

  // Conta recém-criada (ou entrada) com o termo já marcado: aceita direto.
  useEffect(() => {
    if (user && info && !info.aceito && !info.usadoPorOutraConta && termoMarcado) aceitar(user.displayName || '');
  }, [user, info, termoMarcado, aceitar]);

  let conteudo;
  if (erro && !info) {
    conteudo = <div className="cz-login"><div className="cz-cartao"><p className="cz-erro" style={{ margin: 0 }}>{erro}</p></div></div>;
  } else if (!info || user === undefined) {
    conteudo = <div className="cz-centro"><div className="cz-spinner" /></div>;
  } else {
    const a = info.atendimento;
    const agora = Date.now() + (info.offset || 0);
    const terminou = agora > a.fim + 30 * 60000;
    conteudo = (
      <div className="at-pagina">
        {a.modoTeste && (
          <div className="at-aviso at-aviso-teste" role="note">
            <strong>Modo de teste.</strong> Esta sala usa um serviço público de vídeo (Jitsi), sem as proteções da versão final.
            Use apenas para experimentar, sem conversas de atendimento real.
          </div>
        )}
        <CartaoSessao a={a} convidada={info.convidada} />
        {erro && <p className="cz-erro">{erro}</p>}

        {a.status === 'cancelado' ? (
          <div className="cz-cartao"><p className="at-texto">Este atendimento foi cancelado. Se tiver dúvidas, fale com a sua psicóloga.</p></div>
        ) : etapa === 'fim' || (terminou && info.vinculadoAVoce) ? (
          <PosSessao beneficio={beneficio} />
        ) : !user ? (
          <FormConta info={info} termoMarcado={termoMarcado} setTermoMarcado={setTermoMarcado} />
        ) : info.usadoPorOutraConta ? (
          <div className="cz-cartao">
            <p className="at-texto">Este convite já foi aceito por outra conta. Entre com a conta usada antes, ou peça um novo link à sua psicóloga.</p>
            <p className="at-texto at-sutil">Você está conectada(o) como {user.email}.</p>
            <button type="button" className="cz-btn-sec" onClick={() => signOut(auth)}>Entrar com outra conta</button>
          </div>
        ) : !info.vinculadoAVoce ? (
          info.expirado ? (
            <div className="cz-cartao"><p className="at-texto">Este convite expirou. Peça um novo link à sua psicóloga.</p></div>
          ) : (
            <AceiteTermo email={user.email} onAceitar={() => aceitar(user.displayName || '')} onSair={() => signOut(auth)} />
          )
        ) : etapa === 'chamada' && chamada ? (
          <Chamada chamada={chamada} onSair={() => setEtapa('fim')} />
        ) : (
          <SalaPronta info={info} onEntrar={(c) => { setChamada(c); setEtapa('chamada'); }} beneficio={beneficio} />
        )}
      </div>
    );
  }

  return (
    <div className="cz-app at-app">
      <Topo subtitulo="Atendimento online" usuario={user?.email} onSair={user ? () => signOut(auth) : undefined} />
      {conteudo}
    </div>
  );
}

function CartaoSessao({ a, convidada }) {
  return (
    <section className="cz-cartao at-sessao">
      <span className="at-sobre">{a.tipo === 'grupo' ? 'Atendimento em grupo' : 'Atendimento individual'} · online</span>
      <h1 className="at-titulo">{a.titulo}</h1>
      {convidada?.nome && <p className="at-texto">Olá, <strong>{convidada.nome.split(' ')[0]}</strong>. Que bom ter você aqui.</p>}
      <ul className="at-dados">
        <li><span>Com</span><strong>{a.profissionalNome}{a.crp ? ` · CRP ${a.crp}` : ''}</strong></li>
        <li><span>Quando</span><strong>{dataHora(a.inicio)}</strong></li>
        <li><span>Duração</span><strong>{a.duracaoMin} minutos</strong></li>
      </ul>
    </section>
  );
}

function ResumoTermo({ aberto, setAberto }) {
  return (
    <div className="at-termo">
      <ul className="at-termo-resumo">{TCLE_RESUMO.map((t, i) => <li key={i}>{t}</li>)}</ul>
      <button type="button" className="cz-link" onClick={() => setAberto(v => !v)} aria-expanded={aberto}>
        {aberto ? 'Esconder o termo completo' : 'Ler o termo completo'}
      </button>
      {aberto && (
        <div className="at-termo-completo">
          {TCLE_TEXTO.map(([t, p]) => <div key={t}><h3>{t}</h3><p>{p}</p></div>)}
          <p className="at-sutil">Versão {TCLE_VERSAO}</p>
        </div>
      )}
    </div>
  );
}

function FormConta({ info, termoMarcado, setTermoMarcado }) {
  const [modo, setModo] = useState('criar');
  const [nome, setNome] = useState(info.convidada?.nome || '');
  const [email, setEmail] = useState(info.convidada?.email || '');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [termoAberto, setTermoAberto] = useState(false);

  const enviar = async (ev) => {
    ev.preventDefault();
    setErro(''); setAviso('');
    if (!termoMarcado) { setErro('Para continuar, leia e aceite o termo do atendimento online.'); return; }
    setEnviando(true);
    try {
      if (modo === 'criar') {
        if (!nome.trim()) throw { message: 'Conte como você gostaria de ser chamada(o).' };
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
        await updateProfile(cred.user, { displayName: nome.trim() }).catch(() => {});
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), senha);
      }
    } catch (e) { setErro(mensagemErro(e)); }
    setEnviando(false);
  };

  const esqueci = async () => {
    setErro(''); setAviso('');
    if (!email.trim()) { setErro('Digite seu e-mail para receber o link de nova senha.'); return; }
    try { await sendPasswordResetEmail(auth, email.trim()); setAviso('Enviamos um link para criar uma nova senha. Confira também o spam.'); } catch (e) { setErro(mensagemErro(e)); }
  };

  return (
    <section className="cz-cartao">
      <h2>{modo === 'criar' ? 'Crie seu acesso ao Atravessia' : 'Entre na sua conta Atravessia'}</h2>
      <p className="at-texto at-sutil">
        É com ela que você entra na sala e acompanha seus atendimentos. É rápido e você ganha acesso de cortesia ao app enquanto estiver em acompanhamento.
      </p>
      <div className="at-segmento" role="tablist">
        <button type="button" role="tab" aria-selected={modo === 'criar'} className={modo === 'criar' ? 'sel' : ''} onClick={() => setModo('criar')}>Sou nova(o) aqui</button>
        <button type="button" role="tab" aria-selected={modo === 'entrar'} className={modo === 'entrar' ? 'sel' : ''} onClick={() => setModo('entrar')}>Já tenho conta</button>
      </div>
      <form onSubmit={enviar}>
        {modo === 'criar' && (
          <label className="cz-campo">Como gostaria de ser chamada(o)
            <input value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" required />
          </label>
        )}
        <label className="cz-campo">E-mail
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="cz-campo">{modo === 'criar' ? 'Crie uma senha (mínimo 6 caracteres)' : 'Senha'}
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} minLength={6}
            autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} required />
        </label>
        <ResumoTermo aberto={termoAberto} setAberto={setTermoAberto} />
        <label className="at-check">
          <input type="checkbox" checked={termoMarcado} onChange={e => setTermoMarcado(e.target.checked)} />
          <span>Li e aceito o Termo de Consentimento do atendimento psicológico online e os <a href="/termos.html" target="_blank" rel="noreferrer">Termos de Uso</a> do Atravessia.</span>
        </label>
        {erro && <p className="cz-erro">{erro}</p>}
        {aviso && <p className="at-ok">{aviso}</p>}
        <button type="submit" className="cz-btn at-largo" disabled={enviando}>
          {enviando ? 'Um instante…' : modo === 'criar' ? 'Criar acesso e aceitar o convite' : 'Entrar e aceitar o convite'}
        </button>
        {modo === 'entrar' && <button type="button" className="cz-link at-esqueci" onClick={esqueci}>Esqueci minha senha</button>}
      </form>
    </section>
  );
}

function AceiteTermo({ email, onAceitar, onSair }) {
  const [marcado, setMarcado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  return (
    <section className="cz-cartao">
      <h2>Antes de começar</h2>
      <p className="at-texto at-sutil">Você está conectada(o) como {email}. <button type="button" className="cz-link" onClick={onSair}>Não é você?</button></p>
      <ResumoTermo aberto={aberto} setAberto={setAberto} />
      <label className="at-check">
        <input type="checkbox" checked={marcado} onChange={e => setMarcado(e.target.checked)} />
        <span>Li e aceito o Termo de Consentimento do atendimento psicológico online.</span>
      </label>
      <button type="button" className="cz-btn at-largo" disabled={!marcado || enviando}
        onClick={async () => { setEnviando(true); await onAceitar(); setEnviando(false); }}>
        {enviando ? 'Um instante…' : 'Aceitar o convite'}
      </button>
    </section>
  );
}

function useRelogio(offset = 0) {
  const [agora, setAgora] = useState(Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset]);
  return agora;
}
function falta(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} dia${d > 1 ? 's' : ''} e ${h} h`;
  if (h > 0) return `${h} h e ${m} min`;
  return `${m} min e ${s % 60} s`;
}

function SalaPronta({ info, onEntrar, beneficio }) {
  const a = info.atendimento;
  const agora = useRelogio(info.offset);
  const liberaEm = a.inicio - info.liberaAntesMin * 60000;
  const liberado = agora >= liberaEm;
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState('');
  const pararTesteRef = useRef(null);

  const entrar = async () => {
    setErro(''); setEntrando(true);
    try {
      const c = await chamar('entrarNaSala', { atendimentoId: info.atendimentoId });
      pararTesteRef.current?.(); // libera a câmera para a chamada
      if (!c.embutir) window.open(c.url, '_blank', 'noopener');
      onEntrar(c);
    } catch (e) { setErro(e?.message || 'Não foi possível abrir a sala.'); }
    setEntrando(false);
  };

  return (
    <>
      <section className="cz-cartao at-ok-cartao">
        <p className="at-texto" style={{ margin: 0 }}>
          <strong>Tudo certo, seu convite está ligado à sua conta.</strong>{' '}
          {beneficio?.tipo === 'cortesia' && beneficio.ate
            ? `Seu acesso de cortesia ao app Atravessia vale até ${dataCurta(beneficio.ate)} e é renovado a cada sessão.`
            : 'Você também encontra este atendimento no app Atravessia, em Perfil › Meus atendimentos.'}
        </p>
      </section>
      <TesteDispositivos registrarParar={(fn) => { pararTesteRef.current = fn; }} />
      <section className="cz-cartao at-entrar">
        {liberado ? (
          <p className="at-texto">A sala está aberta. Se houver sala de espera, aguarde: a psicóloga vai admitir sua entrada.</p>
        ) : (
          <p className="at-texto">A sala abre {info.liberaAntesMin} minutos antes do horário. Faltam <strong>{falta(liberaEm - agora)}</strong>.</p>
        )}
        {erro && <p className="cz-erro">{erro}</p>}
        <button type="button" className="cz-btn at-largo" disabled={!liberado || entrando} onClick={entrar}>
          {entrando ? 'Abrindo a sala…' : 'Entrar na sala'}
        </button>
        <p className="at-sutil at-dica">Dica: use fones de ouvido e fique em um lugar reservado. A sessão não é gravada.</p>
      </section>
    </>
  );
}

function Chamada({ chamada, onSair }) {
  if (!chamada.embutir) {
    return (
      <section className="cz-cartao at-entrar">
        <h2>A sala abriu em uma nova aba</h2>
        <p className="at-texto">
          Se ela não abriu, toque no botão abaixo. No celular, permita o acesso à câmera e ao microfone quando o navegador pedir.
        </p>
        <a className="cz-btn at-largo" href={chamada.url} target="_blank" rel="noopener noreferrer">Abrir a sala</a>
        <button type="button" className="cz-btn-sec at-largo" onClick={onSair}>Terminei a sessão</button>
      </section>
    );
  }
  return (
    <section className="at-chamada">
      <iframe
        title="Sala do atendimento"
        src={chamada.url}
        allow="camera; microphone; fullscreen; speaker-selection; display-capture; autoplay; clipboard-write"
        referrerPolicy="no-referrer"
      />
      <div className="at-chamada-rodape">
        <span className="at-sutil">Para trocar câmera, microfone ou fone, use o menu de configurações dentro da sala.</span>
        <button type="button" className="cz-btn-sec" onClick={onSair}>Sair da sala</button>
      </div>
    </section>
  );
}

function PosSessao({ beneficio }) {
  return (
    <section className="cz-cartao at-fim">
      <h2>Continue cuidando de você no app Atravessia</h2>
      <p className="at-texto">
        Obrigada por estar aqui. Entre uma sessão e outra, o Atravessia acompanha você com check-ins, áudios, diário e conteúdos de acolhimento.
        {beneficio?.tipo === 'cortesia' && beneficio.ate ? ` Seu acesso de cortesia vale até ${dataCurta(beneficio.ate)}.` : ' Enquanto você estiver em acompanhamento, o acesso é cortesia.'}
      </p>
      <p className="at-texto at-sutil">Entre com o mesmo e-mail e senha que você usou aqui.</p>
      <div className="at-botoes">
        <a className="cz-btn" href={PLAY_STORE} target="_blank" rel="noopener noreferrer">Baixar na Google Play</a>
        <a className="cz-btn-sec" href={APP_WEB}>Usar no navegador (iPhone e computador)</a>
      </div>
      <p className="at-sutil at-dica">No iPhone, abra no Safari e toque em Compartilhar › Adicionar à Tela de Início.</p>
    </section>
  );
}

// ---- Teste de câmera, microfone e fone --------------------------------------
function TesteDispositivos({ registrarParar }) {
  const [ativo, setAtivo] = useState(false);
  const [erro, setErro] = useState('');
  const [dispositivos, setDispositivos] = useState({ videoinput: [], audioinput: [], audiooutput: [] });
  const [cam, setCam] = useState('');
  const [mic, setMic] = useState('');
  const [saida, setSaida] = useState('');
  const [nivel, setNivel] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(0);
  const suportaSaida = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

  const parar = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setNivel(0);
    setAtivo(false);
  }, []);

  useEffect(() => { registrarParar(parar); return parar; }, [parar, registrarParar]);

  const listar = async () => {
    const todos = await navigator.mediaDevices.enumerateDevices();
    const g = { videoinput: [], audioinput: [], audiooutput: [] };
    todos.forEach(d => g[d.kind]?.push(d));
    setDispositivos(g);
  };

  const iniciar = async (camId = cam, micId = mic) => {
    setErro('');
    if (!navigator.mediaDevices?.getUserMedia) { setErro('Este navegador não permite usar câmera e microfone. Tente o Chrome, o Safari ou o Edge atualizados.'); return; }
    parar();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: camId ? { deviceId: { exact: camId } } : true,
        audio: micId ? { deviceId: { exact: micId }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCam(stream.getVideoTracks()[0]?.getSettings().deviceId || camId);
      setMic(stream.getAudioTracks()[0]?.getSettings().deviceId || micId);
      await listar();
      // Indicador de nível do microfone.
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const analisador = ctx.createAnalyser();
      analisador.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analisador);
      const dados = new Uint8Array(analisador.fftSize);
      const medir = () => {
        analisador.getByteTimeDomainData(dados);
        let soma = 0;
        for (let i = 0; i < dados.length; i++) { const v = (dados[i] - 128) / 128; soma += v * v; }
        setNivel(Math.min(1, Math.sqrt(soma / dados.length) * 4));
        rafRef.current = requestAnimationFrame(medir);
      };
      medir();
      setAtivo(true);
    } catch (e) {
      const n = e?.name;
      setErro(n === 'NotAllowedError'
        ? 'O acesso à câmera ou ao microfone foi bloqueado. Toque no cadeado ao lado do endereço do site e permita câmera e microfone.'
        : n === 'NotFoundError' ? 'Não encontramos câmera ou microfone neste aparelho.'
          : n === 'NotReadableError' ? 'A câmera ou o microfone está em uso por outro programa. Feche-o e tente de novo.'
            : 'Não foi possível acessar a câmera e o microfone.');
    }
  };

  const tocarSom = async () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    ganho.gain.value = 0.15;
    osc.frequency.value = 528;
    const destino = ctx.createMediaStreamDestination();
    osc.connect(ganho).connect(destino);
    const audio = new Audio();
    audio.srcObject = destino.stream;
    if (saida && audio.setSinkId) await audio.setSinkId(saida).catch(() => {});
    osc.start();
    await audio.play().catch(() => {});
    setTimeout(() => { osc.stop(); audio.pause(); ctx.close().catch(() => {}); }, 900);
  };

  const rotulo = (d, i, tipo) => d.label || `${tipo} ${i + 1}`;

  return (
    <section className="cz-cartao at-teste">
      <h2>Teste sua câmera e seu microfone</h2>
      <div className="at-teste-grade">
        <div className="at-video">
          <video ref={videoRef} autoPlay playsInline muted />
          {!ativo && <span className="at-video-vazio">A imagem aparece aqui</span>}
        </div>
        <div className="at-teste-campos">
          {!ativo ? (
            <button type="button" className="cz-btn at-largo" onClick={() => iniciar()}>Testar câmera e microfone</button>
          ) : (
            <>
              <label className="cz-campo">Câmera
                <select value={cam} onChange={e => { setCam(e.target.value); iniciar(e.target.value, mic); }}>
                  {dispositivos.videoinput.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{rotulo(d, i, 'Câmera')}</option>)}
                </select>
              </label>
              <label className="cz-campo">Microfone
                <select value={mic} onChange={e => { setMic(e.target.value); iniciar(cam, e.target.value); }}>
                  {dispositivos.audioinput.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{rotulo(d, i, 'Microfone')}</option>)}
                </select>
              </label>
              <div className="at-nivel" aria-label="Nível do microfone">
                <span style={{ width: `${Math.round(nivel * 100)}%` }} />
              </div>
              <p className="at-sutil at-dica">Fale algo: a barra deve se mover.</p>
              {suportaSaida && dispositivos.audiooutput.length > 0 && (
                <label className="cz-campo">Saída de som (fone ou alto-falante)
                  <select value={saida} onChange={e => setSaida(e.target.value)}>
                    <option value="">Padrão do aparelho</option>
                    {dispositivos.audiooutput.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{rotulo(d, i, 'Saída')}</option>)}
                  </select>
                </label>
              )}
              <div className="at-botoes">
                <button type="button" className="cz-btn-sec" onClick={tocarSom}>Tocar som de teste</button>
                <button type="button" className="cz-btn-sec" onClick={parar}>Parar teste</button>
              </div>
            </>
          )}
          {erro && <p className="cz-erro">{erro}</p>}
        </div>
      </div>
    </section>
  );
}
