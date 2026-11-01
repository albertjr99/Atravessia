import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from './firebase';
import Recolhivel from './Recolhivel';
import { IconCopy, IconEyeOff as IconLock, IconPlus, IconTrash, IconVideo, IconWhatsapp, IconRefresh, IconDoc, IconCheck } from './Icons';
import './atendimentos.css';

// Atendimentos online (psicologia): agenda, convites por pessoa, sala de vídeo
// e anotações privadas. Plano: docs/atendimentos/PLANO.md.
// Dados: atendimentos/{id} (agenda), atendimentosPrivado/{id} (pessoas,
// convites e anotações — só a profissional lê) e configuracoes/atendimentos.
const chamar = (nome, dados) => httpsCallable(functions, nome)(dados).then(r => r.data);
const LIBERA_PROF_MIN = 30;
const TOLERANCIA_MIN = 30;

const ms = (t) => t?.toMillis?.() || 0;
const dataHora = (v) => new Date(v).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const reais = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const paraInputData = (v) => {
  const d = new Date(v - new Date(v).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};
export const linkDoConvite = (token) => `${window.location.origin}/atendimento.html?c=${token}`;
export function textoWhatsApp(p, a, link) {
  const primeiro = String(p.nome || '').split(' ')[0];
  return `Olá, ${primeiro}! Este é o link do seu atendimento online com ${a.profissionalNome || 'a sua psicóloga'}, `
    + `${dataHora(ms(a.inicio))}:\n${link}\n\nPelo link você cria seu acesso ao Atravessia (é rápido), testa a câmera e o microfone `
    + `e entra na sala no horário. O link é pessoal: por favor, não compartilhe. 💜`;
}

const STATUS_PESSOA = {
  convidado: ['Convite enviado', 'badge-inactive'],
  aceito: ['Aceitou', 'badge-perceber'],
  removido: ['Removida(o)', 'badge-inactive'],
};

export default function Atendimentos({ showToast }) {
  const uid = auth.currentUser?.uid;
  const [lista, setLista] = useState(null);
  const [privados, setPrivados] = useState({});
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    if (!uid) return undefined;
    const u1 = onSnapshot(query(collection(db, 'atendimentos'), where('profissionalUid', '==', uid)),
      s => setLista(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setLista([]));
    const u2 = onSnapshot(query(collection(db, 'atendimentosPrivado'), where('profissionalUid', '==', uid)),
      s => setPrivados(Object.fromEntries(s.docs.map(d => [d.id, d.data()]))), () => {});
    const u3 = onSnapshot(doc(db, 'configuracoes', 'atendimentos'), s => setConfig(s.data() || {}), () => setConfig({}));
    const t = setInterval(() => setAgora(Date.now()), 30000);
    return () => { u1(); u2(); u3(); clearInterval(t); };
  }, [uid]);

  const carregarStatus = () => chamar('statusAtendimentos', {}).then(setStatus).catch(() => setStatus(null));
  useEffect(() => { carregarStatus(); }, []);

  const { proximos, passados } = useMemo(() => {
    const todos = [...(lista || [])].sort((a, b) => ms(a.inicio) - ms(b.inicio));
    const ehPassado = (a) => a.status === 'concluido' || a.status === 'cancelado' || ms(a.fim) + TOLERANCIA_MIN * 60000 < agora;
    return { proximos: todos.filter(a => !ehPassado(a)), passados: todos.filter(ehPassado).reverse() };
  }, [lista, agora]);

  return (
    <div className="screen-content at-adm" style={{ maxWidth: 980 }}>
      <div className="screen-header">
        <h1 className="screen-title">Atendimentos</h1>
        <p className="screen-sub">
          Atendimento psicológico online, individual ou em grupo. Crie a sessão, envie o link pessoal de cada pessoa e entre na sala como anfitriã.
          Quem aceita o convite vira usuária do Atravessia, com cortesia enquanto estiver em acompanhamento.
        </p>
      </div>

      {status && (
        status.modoTeste ? (
          <div className="at-adm-aviso at-adm-aviso-teste">
            <strong>Modo de teste (Jitsi público).</strong> As salas são abertas em meet.jit.si, com nome aleatório, sem token por pessoa e sem
            sala de espera automática. Use só para experimentar. Para atender de verdade, configure a chave do Daily (veja docs/atendimentos/PLANO.md).
          </div>
        ) : (
          <div className="at-adm-aviso at-adm-aviso-ok">
            <strong>Daily conectado.</strong> Salas privadas, com horário de abertura e expiração, token por pessoa, sala de espera e sem gravação.
          </div>
        )
      )}

      <Recolhivel titulo="Novo atendimento" subtitulo="Individual ou em grupo, com link para cada pessoa" icone={<IconPlus size={18} />}>
        <FormNovo showToast={showToast} />
      </Recolhivel>

      <h2 className="at-adm-secao">Próximos</h2>
      {lista === null ? <p className="field-hint">Carregando…</p>
        : proximos.length === 0 ? <div className="card at-adm-vazio">Nenhum atendimento agendado. Crie um em “Novo atendimento”.</div>
          : proximos.map(a => <CartaoAtendimento key={a.id} a={a} priv={privados[a.id]} agora={agora} showToast={showToast} />)}

      {passados.length > 0 && (
        <Recolhivel titulo={`Passados e cancelados (${passados.length})`} subtitulo="Histórico e anotações" icone={<IconDoc size={18} />}>
          {passados.map(a => <CartaoAtendimento key={a.id} a={a} priv={privados[a.id]} agora={agora} showToast={showToast} passado />)}
        </Recolhivel>
      )}

      <Recolhivel titulo="Configurações" subtitulo="Serviço de vídeo, benefício e CRP" icone={<IconVideo size={18} />}>
        {config && <Configuracoes inicial={config} status={status} onSalvo={carregarStatus} showToast={showToast} />}
      </Recolhivel>

      <Recolhivel titulo="Sigilo e boas práticas (CFP)" icone={<IconLock size={18} />}>
        <ul className="at-adm-lista">
          <li>Mantenha o cadastro no e-Psi ativo e o CRP preenchido em Configurações (aparece no convite).</li>
          <li>Cada link é pessoal e de uso único: depois que a pessoa aceita, ele só funciona na conta dela.</li>
          <li>As anotações privadas ficam visíveis só para você (nem as outras administradoras leem). Registre o essencial; o prontuário completo pode seguir no seu sistema de costume.</li>
          <li>Não grave sessões. Gravação só com consentimento expresso e por escrito de todas as pessoas.</li>
          <li>No grupo, as participantes não veem nomes nem e-mails umas das outras fora da sala.</li>
        </ul>
      </Recolhivel>
    </div>
  );
}

// ---- Novo atendimento --------------------------------------------------------
function FormNovo({ showToast }) {
  const vazio = { nome: '', email: '' };
  const [tipo, setTipo] = useState('individual');
  const [titulo, setTitulo] = useState('');
  const [inicio, setInicio] = useState('');
  const [duracao, setDuracao] = useState('50');
  const [valor, setValor] = useState('');
  const [pago, setPago] = useState(false);
  const [pessoas, setPessoas] = useState([{ ...vazio }]);
  const [salvando, setSalvando] = useState(false);
  const [criados, setCriados] = useState(null);

  const setPessoa = (i, k, v) => setPessoas(p => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const trocarTipo = (t) => { setTipo(t); if (t === 'individual') setPessoas(p => [p[0] || { ...vazio }]); };

  const criar = async () => {
    if (!inicio) { showToast('Escolha a data e o horário.', 'error'); return; }
    const lista = pessoas.filter(p => p.nome.trim());
    if (!lista.length) { showToast('Adicione o nome de pelo menos uma pessoa.', 'error'); return; }
    setSalvando(true);
    try {
      const r = await chamar('criarAtendimento', {
        tipo, titulo, inicio: new Date(inicio).getTime(), duracaoMin: Number(duracao),
        participantes: lista, valor: valor ? Number(String(valor).replace(',', '.')) : null, pago,
      });
      setCriados(r.convites);
      setTitulo(''); setInicio(''); setValor(''); setPago(false); setPessoas([{ ...vazio }]);
      showToast(r.modoTeste ? 'Atendimento criado (modo de teste). Envie os links abaixo.' : 'Atendimento criado. Envie os links abaixo.');
    } catch (e) { showToast(e?.message || 'Não foi possível criar.', 'error'); }
    setSalvando(false);
  };

  return (
    <div>
      <div className="at-adm-segmento" role="tablist">
        {[['individual', 'Individual'], ['grupo', 'Em grupo']].map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={tipo === id} className={tipo === id ? 'sel' : ''} onClick={() => trocarTipo(id)}>{nome}</button>
        ))}
      </div>
      <div className="field-group">
        <label>Título (aparece para a pessoa)</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={tipo === 'grupo' ? 'Ex.: Grupo de apoio ao luto' : 'Ex.: Sessão de acompanhamento'} maxLength={120} />
        <span className="field-hint">Evite colocar o nome da pessoa no título.</span>
      </div>
      <div className="at-adm-linha">
        <div className="field-group" style={{ flex: '2 1 220px' }}>
          <label>Data e horário</label>
          <input type="datetime-local" value={inicio} onChange={e => setInicio(e.target.value)} />
        </div>
        <div className="field-group" style={{ flex: '1 1 120px' }}>
          <label>Duração</label>
          <select value={duracao} onChange={e => setDuracao(e.target.value)}>
            {[30, 45, 50, 60, 90, 120].map(m => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>
      </div>
      <div className="at-adm-linha">
        <div className="field-group" style={{ flex: '1 1 160px' }}>
          <label>Valor (opcional, R$)</label>
          <input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="Ex.: 180" />
        </div>
        <label className="at-adm-check" style={{ flex: '1 1 160px' }}>
          <input type="checkbox" checked={pago} onChange={e => setPago(e.target.checked)} /> Já está pago
        </label>
      </div>

      <label className="at-adm-rotulo">{tipo === 'grupo' ? 'Participantes' : 'Pessoa atendida'}</label>
      {pessoas.map((p, i) => (
        <div key={i} className="at-adm-linha at-adm-pessoa">
          <input value={p.nome} onChange={e => setPessoa(i, 'nome', e.target.value)} placeholder="Nome" aria-label="Nome" />
          <input type="email" value={p.email} onChange={e => setPessoa(i, 'email', e.target.value)} placeholder="E-mail (opcional)" aria-label="E-mail" />
          {pessoas.length > 1 && (
            <button type="button" className="btn-ghost" onClick={() => setPessoas(ps => ps.filter((_, j) => j !== i))} aria-label="Remover pessoa"><IconTrash size={16} /></button>
          )}
        </div>
      ))}
      {tipo === 'grupo' && pessoas.length < 12 && (
        <button type="button" className="btn-secondary" onClick={() => setPessoas(ps => [...ps, { ...vazio }])}><IconPlus size={16} /> Adicionar pessoa</button>
      )}
      <p className="field-hint" style={{ marginTop: 10 }}>Com o e-mail, o cadastro no link já vem preenchido. Cada pessoa recebe um link próprio.</p>
      <button type="button" className="btn-primary" onClick={criar} disabled={salvando}><IconCheck size={16} /> {salvando ? 'Criando…' : 'Criar atendimento'}</button>

      {criados && (
        <div className="at-adm-criados">
          <strong>Links de convite</strong>
          {criados.map(c => (
            <div key={c.participanteId} className="at-adm-link">
              <span>{c.nome}</span>
              <code>{c.link}</code>
              <button type="button" className="btn-secondary" onClick={() => copiar(c.link, showToast)}><IconCopy size={15} /> Copiar</button>
            </div>
          ))}
          <span className="field-hint">Os links também ficam no cartão do atendimento, com o botão do WhatsApp.</span>
        </div>
      )}
    </div>
  );
}

async function copiar(texto, showToast) {
  try { await navigator.clipboard.writeText(texto); showToast('Link copiado.'); } catch { window.prompt('Copie o link:', texto); }
}

// ---- Cartão de um atendimento -----------------------------------------------
function CartaoAtendimento({ a, priv, agora, showToast, passado }) {
  const [ocupado, setOcupado] = useState('');
  const pessoas = (priv?.participantes || []).filter(p => p.status !== 'removido');
  const inicio = ms(a.inicio);
  const fim = ms(a.fim);
  const salaAberta = a.status === 'agendado' && agora >= inicio - LIBERA_PROF_MIN * 60000 && agora <= fim + TOLERANCIA_MIN * 60000;

  const acao = async (nome, dados, ok) => {
    setOcupado(nome);
    try { const r = await chamar(nome, dados); if (ok) showToast(ok); return r; } catch (e) { showToast(e?.message || 'Não foi possível concluir.', 'error'); }
    finally { setOcupado(''); }
    return null;
  };
  const entrar = async () => {
    const r = await acao('entrarNaSala', { atendimentoId: a.id });
    if (r?.url) window.open(r.url, '_blank', 'noopener');
  };
  const mudarStatus = (st, pergunta, ok) => { if (window.confirm(pergunta)) acao('atualizarAtendimento', { id: a.id, status: st }, ok); };
  const novoLink = async (p) => {
    if (!window.confirm(`Gerar um novo link para ${p.nome}? O link anterior deixa de funcionar.`)) return;
    const r = await acao('gerarConviteAtendimento', { id: a.id, participanteId: p.id }, 'Novo link gerado.');
    if (r?.link) copiar(r.link, showToast);
  };

  return (
    <div className={`card at-adm-cartao ${a.status === 'cancelado' ? 'at-adm-cancelado' : ''}`}>
      <div className="at-adm-topo">
        <div style={{ minWidth: 0 }}>
          <div className="at-adm-quando">{dataHora(inicio)} · {a.duracaoMin} min</div>
          <h3 className="at-adm-titulo">{a.titulo}</h3>
          <div className="at-adm-etiquetas">
            <span className="badge badge-acolher">{a.tipo === 'grupo' ? `Grupo · ${a.totalParticipantes || pessoas.length}` : 'Individual'}</span>
            {a.status === 'cancelado' && <span className="badge badge-inactive">Cancelado</span>}
            {a.status === 'concluido' && <span className="badge badge-perceber">Concluído</span>}
            {a.provedor !== 'daily' && <span className="badge badge-cortesia">Teste (Jitsi)</span>}
            {a.valorCentavos != null && <span className={`badge ${a.pago ? 'badge-perceber' : 'badge-cortesia'}`}>{reais(a.valorCentavos)} · {a.pago ? 'pago' : 'a receber'}</span>}
          </div>
        </div>
        {!passado && a.status === 'agendado' && (
          <button type="button" className="btn-primary" onClick={entrar} disabled={!salaAberta || !!ocupado}
            title={salaAberta ? 'Abrir a sala como anfitriã' : `A sala abre ${LIBERA_PROF_MIN} min antes`}>
            <IconVideo size={16} /> {ocupado === 'entrarNaSala' ? 'Abrindo…' : 'Entrar na sala'}
          </button>
        )}
      </div>

      <div className="at-adm-pessoas">
        {pessoas.length === 0 && <p className="field-hint">Nenhuma pessoa neste atendimento.</p>}
        {pessoas.map(p => {
          const [rot, cls] = STATUS_PESSOA[p.status] || STATUS_PESSOA.convidado;
          const link = p.convite ? linkDoConvite(p.convite) : '';
          return (
            <div key={p.id} className="at-adm-pessoa-linha">
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                <strong>{p.nome}</strong> <span className={`badge ${cls}`}>{rot}</span>
                {p.email && <div className="field-hint">{p.email}</div>}
              </div>
              {!passado && a.status === 'agendado' && link && (
                <div className="at-adm-acoes">
                  <button type="button" className="btn-secondary" onClick={() => copiar(link, showToast)}><IconCopy size={15} /> Copiar link</button>
                  <a className="btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(textoWhatsApp(p, a, link))}`} target="_blank" rel="noopener noreferrer"><IconWhatsapp size={15} /> WhatsApp</a>
                  <button type="button" className="btn-ghost" onClick={() => novoLink(p)} disabled={!!ocupado} title="Gerar novo link"><IconRefresh size={15} /></button>
                  <button type="button" className="btn-ghost" disabled={!!ocupado} title="Remover do atendimento"
                    onClick={() => window.confirm(`Remover ${p.nome} deste atendimento? O link dela(e) deixa de funcionar.`) && acao('atualizarAtendimento', { id: a.id, remover: [p.id] }, 'Pessoa removida.')}>
                    <IconTrash size={15} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!passado && a.status === 'agendado' && (
        <>
          {(a.tipo === 'grupo' || pessoas.length === 0) && (
            <Recolhivel titulo="Adicionar pessoa" className="at-adm-sub">
              <AdicionarPessoa id={a.id} acao={acao} />
            </Recolhivel>
          )}
          <Recolhivel titulo="Editar horário, título e valor" className="at-adm-sub">
            <EditarAtendimento a={a} acao={acao} />
          </Recolhivel>
        </>
      )}

      <Recolhivel titulo="Anotações privadas" subtitulo="Só você vê · sigilo profissional" icone={<IconLock size={16} />} className="at-adm-sub">
        <Anotacoes id={a.id} priv={priv} showToast={showToast} />
      </Recolhivel>

      {!passado && a.status === 'agendado' && (
        <div className="at-adm-rodape">
          {agora > inicio && <button type="button" className="btn-secondary" disabled={!!ocupado} onClick={() => mudarStatus('concluido', 'Marcar este atendimento como concluído?', 'Atendimento concluído.')}>Marcar como concluído</button>}
          <button type="button" className="btn-danger" disabled={!!ocupado} onClick={() => mudarStatus('cancelado', 'Cancelar este atendimento? Quem já aceitou recebe um aviso e os links deixam de abrir a sala.', 'Atendimento cancelado.')}>Cancelar atendimento</button>
        </div>
      )}
    </div>
  );
}

function AdicionarPessoa({ id, acao }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  return (
    <div className="at-adm-linha at-adm-pessoa">
      <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" aria-label="Nome" />
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail (opcional)" aria-label="E-mail" />
      <button type="button" className="btn-primary" disabled={!nome.trim()}
        onClick={async () => { const r = await acao('atualizarAtendimento', { id, adicionar: [{ nome, email }] }, 'Pessoa adicionada. Copie o link dela no cartão.'); if (r) { setNome(''); setEmail(''); } }}>
        <IconPlus size={15} /> Adicionar
      </button>
    </div>
  );
}

function EditarAtendimento({ a, acao }) {
  const [titulo, setTitulo] = useState(a.titulo || '');
  const [inicio, setInicio] = useState(paraInputData(ms(a.inicio)));
  const [duracao, setDuracao] = useState(String(a.duracaoMin || 50));
  const [valor, setValor] = useState(a.valorCentavos != null ? String(a.valorCentavos / 100) : '');
  const [pago, setPago] = useState(!!a.pago);
  const salvar = () => {
    const novoInicio = new Date(inicio).getTime();
    const mudouHorario = novoInicio !== ms(a.inicio) || Number(duracao) !== a.duracaoMin;
    acao('atualizarAtendimento', {
      id: a.id, titulo, pago, valor: valor ? Number(String(valor).replace(',', '.')) : null,
      ...(mudouHorario ? { inicio: novoInicio, duracaoMin: Number(duracao) } : {}),
    }, mudouHorario ? 'Atendimento atualizado. Quem já aceitou recebe o novo horário.' : 'Atendimento atualizado.');
  };
  return (
    <div>
      <div className="field-group"><label>Título</label><input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={120} /></div>
      <div className="at-adm-linha">
        <div className="field-group" style={{ flex: '2 1 220px' }}><label>Data e horário</label><input type="datetime-local" value={inicio} onChange={e => setInicio(e.target.value)} /></div>
        <div className="field-group" style={{ flex: '1 1 120px' }}><label>Duração (min)</label><input inputMode="numeric" value={duracao} onChange={e => setDuracao(e.target.value)} /></div>
      </div>
      <div className="at-adm-linha">
        <div className="field-group" style={{ flex: '1 1 160px' }}><label>Valor (R$)</label><input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} /></div>
        <label className="at-adm-check" style={{ flex: '1 1 160px' }}><input type="checkbox" checked={pago} onChange={e => setPago(e.target.checked)} /> Pago</label>
      </div>
      <button type="button" className="btn-primary" onClick={salvar}><IconCheck size={15} /> Salvar</button>
    </div>
  );
}

function Anotacoes({ id, priv, showToast }) {
  const [texto, setTexto] = useState(priv?.anotacoes || '');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setTexto(priv?.anotacoes || ''); }, [priv?.anotacoes]);
  const salvar = async () => {
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'atendimentosPrivado', id), { anotacoes: texto, anotacoesAtualizadasEm: serverTimestamp() });
      showToast('Anotações salvas.');
    } catch (e) { showToast('Não foi possível salvar: ' + (e?.message || ''), 'error'); }
    setSalvando(false);
  };
  return (
    <div>
      <p className="at-adm-sigilo">
        Protegidas por sigilo profissional: só você, a psicóloga deste atendimento, consegue ler. Nem outras administradoras nem as pessoas atendidas têm acesso.
        Registre o necessário (Resolução CFP nº 01/2009); evite dados que não ajudem no cuidado.
      </p>
      <textarea rows={6} value={texto} onChange={e => setTexto(e.target.value)} maxLength={50000} style={{ width: '100%', resize: 'vertical' }}
        placeholder="Evolução, combinados, temas para a próxima sessão…" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}><IconCheck size={15} /> {salvando ? 'Salvando…' : 'Salvar anotações'}</button>
        {priv?.anotacoesAtualizadasEm && <span className="field-hint">Última alteração: {dataHora(ms(priv.anotacoesAtualizadasEm))}</span>}
      </div>
    </div>
  );
}

// ---- Configurações -----------------------------------------------------------
function Configuracoes({ inicial, status, onSalvo, showToast }) {
  const [f, setF] = useState({
    provedor: inicial.provedor === 'jitsi' ? 'jitsi' : 'daily',
    ativo: inicial.ativo !== false,
    salaDeEspera: inicial.salaDeEspera !== false,
    beneficioDias: String(inicial.beneficioDias ?? 60),
    crp: inicial.crp || '',
    nomeProfissional: inicial.nomeProfissional || '',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const salvar = async () => {
    const dias = Number(f.beneficioDias);
    if (!Number.isFinite(dias) || dias < 0 || dias > 365) { showToast('O benefício vai de 0 a 365 dias.', 'error'); return; }
    try {
      await setDoc(doc(db, 'configuracoes', 'atendimentos'), {
        provedor: f.provedor, ativo: f.ativo, salaDeEspera: f.salaDeEspera, beneficioDias: Math.round(dias),
        crp: f.crp.trim(), nomeProfissional: f.nomeProfissional.trim(), atualizadoEm: serverTimestamp(),
      }, { merge: true });
      showToast('Configurações salvas.');
      onSalvo?.();
    } catch (e) { showToast('Não foi possível salvar: ' + (e?.message || ''), 'error'); }
  };
  return (
    <div>
      <div className="field-group">
        <label>Serviço de vídeo</label>
        <select value={f.provedor} onChange={e => set('provedor', e.target.value)}>
          <option value="daily">Daily.co (recomendado; precisa da chave no servidor)</option>
          <option value="jitsi">Jitsi público (somente teste)</option>
        </select>
        {status && f.provedor === 'daily' && !status.temChaveDaily && (
          <span className="field-hint">A chave do Daily ainda não está no servidor: enquanto isso, as salas são criadas no Jitsi (modo de teste).</span>
        )}
      </div>
      <label className="at-adm-check"><input type="checkbox" checked={f.ativo} onChange={e => set('ativo', e.target.checked)} /> Atendimentos ligados (permite criar novos)</label>
      <label className="at-adm-check"><input type="checkbox" checked={f.salaDeEspera} onChange={e => set('salaDeEspera', e.target.checked)} /> Sala de espera: no Daily, a pessoa “bate na porta” e você admite a entrada</label>
      <div className="at-adm-linha">
        <div className="field-group" style={{ flex: '1 1 200px' }}>
          <label>Cortesia no app (dias após cada sessão)</label>
          <input inputMode="numeric" value={f.beneficioDias} onChange={e => set('beneficioDias', e.target.value)} />
          <span className="field-hint">Renovada a cada sessão. 0 desliga. Quem já assina não é alterada(o).</span>
        </div>
        <div className="field-group" style={{ flex: '1 1 160px' }}>
          <label>CRP</label>
          <input value={f.crp} onChange={e => set('crp', e.target.value)} placeholder="06/000000" />
        </div>
      </div>
      <div className="field-group">
        <label>Nome profissional (aparece no convite)</label>
        <input value={f.nomeProfissional} onChange={e => set('nomeProfissional', e.target.value)} placeholder="Ex.: Carla Zambi · Psicóloga" />
      </div>
      <button type="button" className="btn-primary" onClick={salvar}><IconCheck size={15} /> Salvar configurações</button>
    </div>
  );
}
