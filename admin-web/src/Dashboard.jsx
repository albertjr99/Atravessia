import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, collectionGroup, onSnapshot } from 'firebase/firestore';
import {
  IconUsers, IconDiamond, IconHeart, IconBell, IconChat, IconDoc,
  IconMusic, IconGift, IconStar, IconCompass, IconPie, IconAlert, IconTime,
} from './Icons';
import { hojeISO, seloVigencia, diasEntreISO, situacaoAchado, isoParaBR, DIAS_ALERTA_ACHADO } from './vigenciaUtils';

// Alertas do painel: contratos de parceria que vencem em até 60 dias (ou já
// venceram) e achados que saem do ar nos próximos 7 dias. Só itens ativos.
function useAlertasParcerias() {
  const [parcerias, setParcerias] = useState([]);
  const [privados, setPrivados] = useState({});
  const [achados, setAchados] = useState([]);
  useEffect(() => {
    const u = [
      onSnapshot(collection(db, 'parcerias'), s => setParcerias(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
      onSnapshot(collection(db, 'parceriasPrivado'), s => {
        const m = {}; s.docs.forEach(d => { m[d.id] = d.data(); }); setPrivados(m);
      }, () => {}),
      onSnapshot(collection(db, 'indicacoes'), s => setAchados(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
    ];
    return () => u.forEach(f => f());
  }, []);
  const hoje = hojeISO();
  const contratos = parcerias
    .filter(p => p.ativo !== false)
    .map(p => ({ ...p, selo: seloVigencia(privados[p.id], hoje) }))
    .filter(p => p.selo && (p.selo.tom === 'alerta' || p.selo.tom === 'vencida'))
    .sort((a, b) => a.selo.dias - b.selo.dias);
  const achadosEncerrando = achados
    .filter(i => i.ativo !== false && situacaoAchado(i, hoje).id === 'no_ar' && i.publicarAte)
    .map(i => ({ ...i, dias: diasEntreISO(hoje, i.publicarAte) }))
    .filter(i => i.dias != null && i.dias <= DIAS_ALERTA_ACHADO)
    .sort((a, b) => a.dias - b.dias);
  return { contratos, achadosEncerrando };
}

// Mesma conta de "hoje" usada pelo app ao gravar o check-in (AppContext.hojeStr):
// data local de São Paulo no formato YYYY-MM-DD.
const hojeStr = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d atrás`;
  return d.toLocaleDateString('pt-BR');
}

const PLAN_LABEL = { perceber: 'Perceber', acolher: 'Acolher', compreender: 'Compreender', evoluir: 'Evoluir' };

// Cores dos planos (tokens --plano-*): as mesmas em todas as telas.
const COR_PLANO = {
  perceber: 'var(--plano-perceber)',
  acolher: 'var(--plano-acolher)',
  compreender: 'var(--plano-compreender)',
  evoluir: 'var(--plano-evoluir)',
  total: 'var(--plano-acesso-total)',
};
const CORES_EXTRA = ['var(--lilas-300)', 'var(--nevoa-300)', 'var(--rosa-300)', 'var(--salvia-300)', 'var(--pessego-300)'];

// Iniciais para o avatar da tabela (só exibição).
function iniciais(nome, email) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return String(email || '?').charAt(0).toUpperCase();
}

// Rosca em SVG (r = 42 → circunferência 263,9). Cada fatia desconta o
// arredondamento das pontas para sobrar um respiro entre elas.
const CIRC = 2 * Math.PI * 42;
function Rosca({ fatias, total }) {
  let acumulado = 0;
  const unica = fatias.filter(f => f.count > 0).length === 1;
  return (
    <div className="dash-rosca">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--cor-primaria-veu)" strokeWidth="11" />
        {total > 0 && fatias.map(f => {
          const frac = f.count / total;
          const tam = unica ? CIRC : Math.max(frac * CIRC - 15, 0.01);
          const desloc = unica ? 0 : -(acumulado * CIRC + 7.5);
          acumulado += frac;
          return (
            <circle
              key={f.chave} cx="50" cy="50" r="42" fill="none"
              stroke={f.cor} strokeWidth="11" strokeLinecap={unica ? 'butt' : 'round'}
              strokeDasharray={`${tam} ${CIRC - tam}`} strokeDashoffset={desloc}
            />
          );
        })}
      </svg>
      <div className="dash-rosca-meio">
        <div className="dash-num">{total}</div>
        <small>Usuárias</small>
      </div>
    </div>
  );
}

// "Bom dia, Carla" — saudação pelo horário de Brasília e primeiro nome.
function saudacaoAdmin(nome) {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false })) % 24;
  const periodo = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiro = String(nome || '').trim().split(/\s+/)[0];
  return primeiro ? `${periodo}, ${primeiro}` : periodo;
}

export default function Dashboard({ perfil, irPara }) {
  const { contratos, achadosEncerrando } = useAlertasParcerias();
  const [usuarios, setUsuarios] = useState([]);
  const [counts, setCounts] = useState({
    frases: 0, conteudos: 0, audios: 0, parcerias: 0,
    vitorias: 0, travessia: 0, notificacoes: 0,
  });
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [falhas, setFalhas] = useState([]);

  useEffect(() => {
    const unsubs = [];
    let loaded = 0;
    const totalSubs = 9;
    const markLoaded = () => { loaded++; if (loaded >= totalSubs) setLoading(false); };

    // Usuárias — query without orderBy to avoid index/field dependency; sort client-side
    unsubs.push(onSnapshot(
      collection(db, 'usuarios'),
      snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
          const ta = a.criadoEm?.toMillis?.() ?? 0;
          const tb = b.criadoEm?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setUsuarios(docs);
        setError(null);
        markLoaded();
      },
      () => {
        setError('Sem permissão para listar usuárias. Verifique se seu perfil tem role: "admin" no Firestore.');
        markLoaded();
      }
    ));

    // Check-ins de todas as usuárias. Sem orderBy: uma consulta de collectionGroup
    // com orderBy exige índice próprio e falharia inteira, zerando o painel.
    unsubs.push(onSnapshot(
      collectionGroup(db, 'checkins'),
      snap => {
        setCheckins(snap.docs.map(d => ({ id: d.id, uid: d.ref.path.split('/')[1], ...d.data() })));
        markLoaded();
      },
      () => { setFalhas(f => [...new Set([...f, 'checkins'])]); markLoaded(); }
    ));

    // Content counts
    const collections = [
      ['frases', 'frases'],
      ['conteudos', 'conteudos'],
      ['audios', 'audiosAcolhimento'],
      ['parcerias', 'parcerias'],
      ['vitorias', 'vitoriasOpcoes'],
      ['travessia', 'travessiaItens'],
      ['notificacoes', 'notificacoesEditoriais'],
    ];
    for (const [key, col] of collections) {
      unsubs.push(onSnapshot(
        collection(db, col),
        snap => { setCounts(c => ({ ...c, [key]: snap.size })); markLoaded(); },
        () => { setFalhas(f => [...new Set([...f, col])]); markLoaded(); }
      ));
    }

    return () => unsubs.forEach(u => u());
  }, []);

  // Contas administrativas não são "usuárias do app" — separá-las evita o número inflado.
  const usuariasReais = usuarios.filter(u => u.role !== 'admin');

  const planDist = {};
  usuariasReais.forEach(u => {
    const p = u.acessoTotal ? 'total' : (u.plano || 'perceber');
    planDist[p] = (planDist[p] || 0) + 1;
  });

  const recentUsers = usuariasReais.slice(0, 8);
  const checkinsHoje = checkins.filter(c => c.data === hojeStr()).length;

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...
      </div>
    );
  }

  const pessoas = [
    { Icon: IconUsers, value: usuariasReais.length, label: 'Usuárias' },
    { Icon: IconDiamond, value: usuariasReais.filter(u => u.acessoTotal || (u.plano && u.plano !== 'perceber')).length, label: 'Com plano pago' },
    { Icon: IconHeart, value: checkinsHoje, label: 'Check-ins hoje' },
    { Icon: IconBell, value: counts.notificacoes, label: 'Notificações' },
  ];

  const conteudo = [
    { Icon: IconChat, value: counts.frases, label: 'Frases' },
    { Icon: IconDoc, value: counts.conteudos, label: 'Conteúdos' },
    { Icon: IconMusic, value: counts.audios, label: 'Áudios' },
    { Icon: IconGift, value: counts.parcerias, label: 'Parcerias' },
    { Icon: IconStar, value: counts.vitorias, label: 'Opções Vitórias' },
    { Icon: IconCompass, value: counts.travessia, label: 'Itens Travessia' },
  ];

  let extra = 0;
  const fatias = Object.entries(planDist).map(([plano, count]) => ({
    chave: plano,
    count,
    pct: usuariasReais.length > 0 ? Math.round((count / usuariasReais.length) * 100) : 0,
    label: plano === 'total' ? 'Acesso Total' : (PLAN_LABEL[plano] || plano),
    cor: COR_PLANO[plano] || CORES_EXTRA[extra++ % CORES_EXTRA.length],
  }));

  return (
    <div className="screen-content dash">
      <div className="screen-header dash-saudacao">
        <h1 className="screen-title">{saudacaoAdmin(perfil?.apelido || perfil?.nome)}</h1>
        <p className="screen-sub">Bem-vinda ao painel. Visão geral do Atravessia, atualizada em tempo real.</p>
      </div>

      {error && (
        <div className="dash-aviso">
          {error}
        </div>
      )}

      {falhas.length > 0 && (
        <div className="dash-aviso">Não foi possível ler: <strong>{falhas.join(', ')}</strong>. Estes números podem estar incompletos.
        </div>
      )}

      {(contratos.length > 0 || achadosEncerrando.length > 0) && (
        <div className="dash-alertas">
          {contratos.length > 0 && (
            <section className="card">
              <h2 className="card-title"><IconAlert size={20} />Contratos a vencer</h2>
              {contratos.map(p => (
                <button key={p.id} type="button" className="dash-alerta-item"
                  onClick={() => irPara?.('parcerias', { editarId: p.id })}>
                  <span className="dash-alerta-nome">{p.titulo || 'Parceria sem título'}</span>
                  <span className={`vig-selo vig-${p.selo.tom}`}>{p.selo.tom === 'vencida' ? 'Vencida' : p.selo.texto}</span>
                  <span className="dash-alerta-editar">Editar →</span>
                </button>
              ))}
            </section>
          )}
          {achadosEncerrando.length > 0 && (
            <section className="card">
              <h2 className="card-title"><IconTime size={20} />Achados que saem do ar</h2>
              {achadosEncerrando.map(i => (
                <button key={i.id} type="button" className="dash-alerta-item"
                  onClick={() => irPara?.('indicacoes', { editarId: i.id })}>
                  <span className="dash-alerta-nome">{i.titulo || 'Item sem título'}</span>
                  <span className="vig-selo vig-alerta">
                    {i.dias === 0 ? 'Último dia hoje' : `Até ${isoParaBR(i.publicarAte)} · ${i.dias} dia${i.dias === 1 ? '' : 's'}`}
                  </span>
                  <span className="dash-alerta-editar">Editar →</span>
                </button>
              ))}
            </section>
          )}
        </div>
      )}

      <div className="sobretitulo dash-rotulo">Pessoas
      </div>
      <div className="dash-pessoas">
        {pessoas.map(({ Icon, value, label }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon"><Icon size={20} /></div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="sobretitulo dash-rotulo">Conteúdo publicado
      </div>
      <div className="dash-faixa">
        {conteudo.map(({ Icon, value, label }) => (
          <div key={label} className="dash-faixa-item">
            <span className="pilula xs salvia"><Icon size={17} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="dash-num">{value}</div>
              <div className="dash-lab">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-baixo">
        <section className="card">
          <h2 className="card-title"><IconUsers size={20} />Usuárias recentes</h2>
          {error ? (
            <p className="dash-vazio">Não foi possível carregar. Verifique as permissões do admin no Firestore.
            </p>
          ) : recentUsers.length === 0 ? (
            <p className="dash-vazio">Nenhuma usuária cadastrada ainda.</p>
          ) : (
            <table className="data-table dash-tabela">
              <thead>
                <tr>
                  <th>Nome · E-mail</th>
                  <th>Plano</th>
                  <th>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <span className="dash-pessoa">
                        <span className="dash-ini" aria-hidden="true">{iniciais(u.nome, u.email)}</span>
                        <span>
                          <span className="dash-nome">{u.nome || '—'}</span>
                          <span className="dash-email">{u.email || '—'}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      {u.acessoTotal
                        ? <span className="badge badge-total">Acesso Total</span>
                        : <span className={`badge badge-${u.plano || 'perceber'}`}>
                            {PLAN_LABEL[u.plano] || u.plano || 'Perceber'}
                          </span>
                      }
                    </td>
                    <td className="dash-data">{timeAgo(u.criadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2 className="card-title"><IconPie size={20} />Distribuição de planos</h2>
          {fatias.length === 0 ? (
            <p className="dash-vazio">Nenhum dado.</p>
          ) : (
            <div className="dash-rosca-bloco">
              <Rosca fatias={fatias} total={usuariasReais.length} />
              <div className="dash-legenda">
                {fatias.map(f => (
                  <div key={f.chave} className="dash-leg">
                    <i style={{ background: f.cor }} />
                    <span className="dash-leg-nome">{f.label}</span>
                    <span className="dash-leg-val">{f.count} ({f.pct}%)</span>
                    <div className="dash-leg-barra"><b style={{ width: `${f.pct}%`, background: f.cor }} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
