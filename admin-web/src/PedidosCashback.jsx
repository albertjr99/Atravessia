import React, { useEffect, useMemo, useState } from 'react';
import { db, functions, storage } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref as sRef, getDownloadURL } from 'firebase/storage';
import { IconCheck, IconClose, IconDoc } from './Icons';
import { urlDeImagem } from './parceriaUtils';
import { STATUS_PEDIDO, brlCentavos, calcularCashback, reaisParaCentavos, centavosParaTexto } from './afiliadosUtils';

// Pedidos de cashback de afiliados (porte de AdminPedidosCashbackScreen.js).
// A usuária envia nº do pedido, valor e print; aqui a equipe aprova (o crédito
// sai pela Cloud Function analisarPedidoCashbackAfiliado, na mesma carteira do
// cashback) ou recusa com um motivo que ela vai ler.
const FILTROS = [
  { id: 'pendente', rotulo: 'Em análise' },
  { id: 'aprovado', rotulo: 'Aprovados' },
  { id: 'recusado', rotulo: 'Recusados' },
  { id: 'todos', rotulo: 'Todos' },
];
const MOTIVOS_RAPIDOS = [
  'O comprovante não está legível.',
  'O número do pedido não confere com o comprovante.',
  'O produto do comprovante é diferente do item.',
  'A compra foi cancelada ou devolvida.',
];
const dataTexto = (ts) => (ts?.toDate ? ts.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function Comprovante({ pedido }) {
  const [url, setUrl] = useState(pedido.comprovanteUrl || null);
  useEffect(() => {
    if (url || !pedido.comprovanteCaminho) return;
    getDownloadURL(sRef(storage, pedido.comprovanteCaminho)).then(setUrl).catch(() => {});
  }, [pedido.comprovanteCaminho, url]);
  if (!url) return <div className="af-comprovante af-comprovante-vazio"><IconDoc size={24} /></div>;
  return (
    <a className="af-comprovante" href={url} target="_blank" rel="noreferrer" title="Abrir comprovante em tamanho original">
      <img src={url} alt="Comprovante da compra" />
    </a>
  );
}

export default function PedidosCashback({ showToast }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('pendente');
  const [acao, setAcao] = useState(null); // { tipo, pedido }
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => onSnapshot(collection(db, 'pedidosCashbackAfiliado'), (snap) => {
    setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0)));
    setLoading(false);
  }, () => setLoading(false)), []);

  const contagem = useMemo(() => pedidos.reduce((c, p) => ({ ...c, [p.status]: (c[p.status] || 0) + 1 }), {}), [pedidos]);
  const lista = filtro === 'todos' ? pedidos : pedidos.filter(p => p.status === filtro);
  const creditado = pedidos.filter(p => p.status === 'aprovado').reduce((s, p) => s + (p.cashbackCentavos || 0), 0);

  const abrir = (tipo, pedido) => { setValor(centavosParaTexto(pedido.valorCentavos)); setMotivo(''); setAcao({ tipo, pedido }); };
  const fechar = () => { if (!enviando) setAcao(null); };

  const confirmar = async () => {
    const { tipo, pedido } = acao;
    const payload = { pedidoId: pedido.id, decisao: tipo };
    if (tipo === 'recusar') {
      if (motivo.trim().length < 3) { showToast('Escreva o motivo da recusa. A usuária vai ler.', 'error'); return; }
      payload.motivo = motivo.trim();
    } else {
      const c = reaisParaCentavos(valor);
      if (!c) { showToast('Confira o valor da compra.', 'error'); return; }
      if (c !== pedido.valorCentavos) payload.valor = c / 100;
    }
    setEnviando(true);
    try {
      const { data } = await httpsCallable(functions, 'analisarPedidoCashbackAfiliado')(payload);
      setAcao(null);
      showToast(tipo === 'aprovar'
        ? `${brlCentavos(Math.round((data?.cashback || 0) * 100))} creditado para ${pedido.usuarioNome || 'a usuária'}. Ela foi avisada.`
        : 'Pedido recusado. A usuária foi avisada com o motivo.');
    } catch (e) {
      showToast(e?.message || 'Não foi possível concluir. Tente novamente.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  const previsto = acao?.tipo === 'aprovar' ? calcularCashback(acao.pedido.regraCashback, reaisParaCentavos(valor) || 0) : 0;

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Pedidos de cashback</h1>
          <p className="screen-sub">
            As lojas não contam quem comprou. Por isso a usuária envia o número do pedido, o valor e um print.
            Confira se o print mostra o mesmo produto, número e valor antes de aprovar.
          </p>
        </div>
      </div>

      <div className="stats-row-mini">
        <div className="stat-mini"><div className="stat-mini-value" style={{ color: 'var(--cor-aviso)' }}>{contagem.pendente || 0}</div><div className="stat-mini-label">Em análise</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ color: 'var(--cor-sucesso)' }}>{contagem.aprovado || 0}</div><div className="stat-mini-label">Aprovados</div></div>
        <div className="stat-mini"><div className="stat-mini-value">{brlCentavos(creditado)}</div><div className="stat-mini-label">Creditado</div></div>
      </div>

      <div className="filter-row" style={{ flexWrap: 'wrap' }}>
        {FILTROS.map(f => (
          <button key={f.id} className={`chip ${filtro === f.id ? 'chip-active' : ''}`} onClick={() => setFiltro(f.id)}>
            {f.rotulo}{f.id !== 'todos' && contagem[f.id] ? ` (${contagem[f.id]})` : ''}
          </button>
        ))}
      </div>

      {lista.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon"><IconDoc size={34} /></div>
          <p>{filtro === 'pendente' ? 'Nenhum pedido esperando análise. Tudo em dia!' : 'Nenhum pedido aqui ainda.'}</p>
        </div>
      )}

      <div className="af-pedidos">
        {lista.map(p => {
          const status = STATUS_PEDIDO[p.status] || STATUS_PEDIDO.pendente;
          const img = urlDeImagem(p.itemImagemUrl);
          return (
            <article key={p.id} className="card af-pedido">
              <Comprovante pedido={p} />
              <div className="af-pedido-corpo">
                <div className="af-pedido-topo">
                  <span className={`af-status ${status.classe}`}>{status.rotulo}</span>
                  <span className="af-data">{dataTexto(p.criadoEm)}</span>
                </div>
                <div className="af-item">
                  {img && <img src={img} alt="" />}
                  <div>
                    <strong>{p.itemTitulo || 'Item'}</strong>
                    <span>{p.plataforma}</span>
                  </div>
                </div>
                <dl className="af-dados">
                  <dt>Usuária</dt><dd>{p.usuarioNome || '—'}{p.usuarioEmail ? ` · ${p.usuarioEmail}` : ''}</dd>
                  <dt>Nº do pedido</dt><dd className="af-mono">{p.numeroPedido}</dd>
                  <dt>Valor informado</dt><dd>{brlCentavos(p.valorCentavos)}</dd>
                  {p.status === 'aprovado' ? (
                    <><dt>Creditado</dt><dd className="af-ok">{brlCentavos(p.cashbackCentavos)}{p.valorAprovadoCentavos && p.valorAprovadoCentavos !== p.valorCentavos ? ` (valor corrigido para ${brlCentavos(p.valorAprovadoCentavos)})` : ''}</dd></>
                  ) : (
                    <><dt>Cashback previsto</dt><dd>{brlCentavos(p.cashbackPrevistoCentavos)}</dd></>
                  )}
                  {p.status === 'recusado' && p.motivo && <><dt>Motivo</dt><dd className="af-erro">{p.motivo}</dd></>}
                </dl>
                {p.erroCredito && <p className="af-erro">Última tentativa de crédito falhou: {p.erroCredito}</p>}
                {p.status === 'pendente' && (
                  <div className="af-botoes">
                    <button className="btn-ghost" onClick={() => abrir('recusar', p)}><IconClose size={15} /> Recusar</button>
                    <button className="btn-primary" onClick={() => abrir('aprovar', p)}><IconCheck size={15} /> Aprovar</button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {acao && (
        <div className="modal-overlay" onClick={fechar}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{acao.tipo === 'aprovar' ? 'Aprovar cashback' : 'Recusar pedido'}</h2>
              <button className="modal-close" onClick={fechar}><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              <p className="field-hint" style={{ marginTop: 0 }}>{acao.pedido.itemTitulo} · pedido {acao.pedido.numeroPedido}</p>
              {acao.tipo === 'aprovar' ? (
                <>
                  <div className="field-group">
                    <label>Valor da compra (R$)</label>
                    <input type="text" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value.replace(/[^\d,.]/g, ''))} autoFocus />
                    <span className="field-hint">Corrija se o print mostrar um valor diferente do informado.</span>
                  </div>
                  <div className="af-resumo"><span>Crédito para a usuária</span><strong>{brlCentavos(previsto)}</strong></div>
                </>
              ) : (
                <div className="field-group">
                  <label>Motivo (a usuária vai ler)</label>
                  <div className="filter-row" style={{ flexWrap: 'wrap' }}>
                    {MOTIVOS_RAPIDOS.map(m => (
                      <button key={m} type="button" className={`chip ${motivo === m ? 'chip-active' : ''}`} onClick={() => setMotivo(m)}>{m}</button>
                    ))}
                  </div>
                  <textarea rows={3} maxLength={300} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Explique com carinho o que aconteceu" />
                </div>
              )}
              <div className="modal-footer">
                <button className="btn-ghost" onClick={fechar} disabled={enviando}>Cancelar</button>
                <button className={acao.tipo === 'aprovar' ? 'btn-primary' : 'btn-danger'} onClick={confirmar} disabled={enviando}>
                  {enviando ? 'Enviando...' : acao.tipo === 'aprovar' ? 'Aprovar e creditar' : 'Recusar e avisar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
