import React, { useState, useEffect, useMemo } from 'react';
import { db, functions } from './firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { IconClose, IconSpark, IconTag } from './Icons';

const centavosTxt = (c) => `R$ ${(Number(c || 0) / 100).toFixed(2).replace('.', ',')}`;

const STATUS_LABEL = {
  CONCLUIDO: 'Aguardando confirmação',
  CONFIRMADO_USUARIO: 'Confirmado',
  CONTESTADO: 'Contestado',
  ELEGIVEL_LIQUIDACAO: 'Elegível p/ fechamento',
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  LIQUIDADO: 'Pago',
};
const STATUS_COR = {
  CONCLUIDO: '#C6A46E',
  CONFIRMADO_USUARIO: 'var(--primary)',
  CONTESTADO: 'var(--danger)',
  ELEGIVEL_LIQUIDACAO: 'var(--primary-600)',
  AGUARDANDO_PAGAMENTO: '#C6A46E',
  LIQUIDADO: 'var(--sage)',
};

function formatarData(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR');
}

// Reconciliação do módulo de cupons: só entra nos totais o que a usuária
// confirmou de fato — gerar um voucher, ou o parceiro concluir sem a usuária
// confirmar, nunca vira "receita" aqui. O cálculo em si nunca acontece nesta
// tela — ela só lê o que as Cloud Functions já calcularam e grava ações
// (fechar período, registrar pagamento) através delas, nunca escrevendo
// valores financeiros diretamente no Firestore.
export default function Beneficios({ showToast }) {
  const [parcerias, setParcerias] = useState([]);
  const [parceriaSel, setParceriaSel] = useState('todas');
  const [resgates, setResgates] = useState([]);
  const [fechamentos, setFechamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [modalPagamento, setModalPagamento] = useState(null);
  const [formPagamento, setFormPagamento] = useState({ metodo: '', referencia: '', observacao: '' });

  useEffect(() => {
    return onSnapshot(collection(db, 'parcerias'), snap => {
      setParcerias(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.tipoBeneficio === 'cupom'));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  useEffect(() => {
    let ref = collection(db, 'resgates');
    if (parceriaSel !== 'todas') ref = query(ref, where('parceriaId', '==', parceriaSel));
    return onSnapshot(ref, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));
      setResgates(docs);
    }, () => {});
  }, [parceriaSel]);

  useEffect(() => {
    let ref = collection(db, 'fechamentos');
    if (parceriaSel !== 'todas') ref = query(ref, where('parceriaId', '==', parceriaSel));
    return onSnapshot(ref, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.geradoEm?.toMillis?.() ?? 0) - (a.geradoEm?.toMillis?.() ?? 0));
      setFechamentos(docs);
    }, () => {});
  }, [parceriaSel]);

  const totais = useMemo(() => {
    const soma = (statuses) => resgates.filter(r => statuses.includes(r.status)).reduce((a, r) => a + (r.valorComissaoCentavos || 0), 0);
    return {
      pendente: soma(['CONCLUIDO', 'CONFIRMADO_USUARIO']),
      elegivel: soma(['ELEGIVEL_LIQUIDACAO']),
      aguardando: soma(['AGUARDANDO_PAGAMENTO']),
      recebido: soma(['LIQUIDADO']),
    };
  }, [resgates]);

  const temElegiveis = resgates.some(r => r.status === 'ELEGIVEL_LIQUIDACAO');
  const nomeParceriaSel = parcerias.find(p => p.id === parceriaSel)?.titulo;

  const fecharPeriodo = async () => {
    if (parceriaSel === 'todas') { showToast('Selecione uma parceria específica.', 'error'); return; }
    setProcessando(true);
    try {
      const fn = httpsCallable(functions, 'fecharPeriodoParceria');
      const { data } = await fn({ parceriaId: parceriaSel });
      showToast(`Período fechado: ${data.totalResgates} utilização(ões), comissão de R$ ${Number(data.comissao || 0).toFixed(2).replace('.', ',')}.`);
    } catch (e) {
      showToast(e?.message || 'Não foi possível fechar o período.', 'error');
    } finally {
      setProcessando(false);
    }
  };

  const registrarPagamento = async () => {
    if (!modalPagamento) return;
    setProcessando(true);
    try {
      const fn = httpsCallable(functions, 'registrarPagamentoFechamento');
      await fn({
        fechamentoId: modalPagamento.id,
        metodoPagamento: formPagamento.metodo,
        referencia: formPagamento.referencia,
        observacao: formPagamento.observacao,
      });
      setModalPagamento(null);
      setFormPagamento({ metodo: '', referencia: '', observacao: '' });
      showToast('Pagamento registrado!');
    } catch (e) {
      showToast(e?.message || 'Não foi possível registrar o pagamento.', 'error');
    } finally {
      setProcessando(false);
    }
  };

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  return (
    <div className="screen-content">
      <div className="screen-header">
        <h1 className="screen-title">Cupons e Comissões</h1>
        <p className="screen-sub">
          Só entra nos totais o que a usuária confirmou de fato — gerar um cupom nunca é contabilizado como receita.
        </p>
      </div>

      <div className="filter-row" style={{ flexWrap: 'wrap' }}>
        <button className={`chip ${parceriaSel === 'todas' ? 'chip-active' : ''}`} onClick={() => setParceriaSel('todas')}>
          Todas as parcerias
        </button>
        {parcerias.map(p => (
          <button key={p.id} className={`chip ${parceriaSel === p.id ? 'chip-active' : ''}`} onClick={() => setParceriaSel(p.id)}>
            {p.titulo}
          </button>
        ))}
      </div>

      {parcerias.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconSpark size={34} /></div>
          <p>Nenhuma parceria do tipo "cupom com comissão" cadastrada ainda.<br />Configure isso na tela de Parcerias.</p>
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: 18 }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(198,164,110,.16)', color: '#8A6A33' }}><IconTag size={16} /></div>
              <div className="stat-value">{centavosTxt(totais.pendente)}</div>
              <div className="stat-label">Aguardando confirmação</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><IconTag size={16} /></div>
              <div className="stat-value">{centavosTxt(totais.elegivel)}</div>
              <div className="stat-label">Elegível p/ fechamento</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(198,164,110,.16)', color: '#8A6A33' }}><IconTag size={16} /></div>
              <div className="stat-value">{centavosTxt(totais.aguardando)}</div>
              <div className="stat-label">Aguardando pagamento</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(122,158,126,.16)', color: 'var(--sage)' }}><IconTag size={16} /></div>
              <div className="stat-value">{centavosTxt(totais.recebido)}</div>
              <div className="stat-label">Já recebido</div>
            </div>
          </div>

          {parceriaSel !== 'todas' && (
            <div style={{ marginBottom: 20 }}>
              <button className="btn-primary" onClick={fecharPeriodo} disabled={!temElegiveis || processando}>
                {processando ? 'Processando...' : `Fechar período de ${nomeParceriaSel} (gerar cobrança)`}
              </button>
              {!temElegiveis && (
                <span className="field-hint" style={{ marginLeft: 10 }}>
                  Nenhuma utilização elegível para fechamento ainda.
                </span>
              )}
            </div>
          )}

          {fechamentos.filter(f => f.status === 'ABERTO').length > 0 && (
            <div className="card" style={{ marginBottom: 22 }}>
              <h2 className="card-title">Fechamentos aguardando pagamento</h2>
              {fechamentos.filter(f => f.status === 'ABERTO').map(f => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{f.totalResgates} utilização(ões)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#8A6A33' }}>{centavosTxt(f.valorComissaoTotalCentavos)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)' }}>Gerado em {formatarData(f.geradoEm)}</div>
                  </div>
                  <button className="btn-secondary" onClick={() => setModalPagamento(f)}>Registrar pagamento</button>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h2 className="card-title">Utilizações recentes</h2>
            {resgates.length === 0 ? (
              <p style={{ color: 'var(--text-light)', fontSize: 13 }}>Nenhuma utilização registrada ainda.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Parceria</th>
                      <th>Valor original</th>
                      <th>Valor final</th>
                      <th>Comissão</th>
                      <th>Status</th>
                      <th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resgates.slice(0, 100).map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700 }}>{r.codigoPublico}</td>
                        <td>{r.parceriaNome}</td>
                        <td>{centavosTxt(r.valorOriginalCentavos)}</td>
                        <td>{centavosTxt(r.valorFinalCentavos)}</td>
                        <td style={{ fontWeight: 700, color: '#8A6A33' }}>{centavosTxt(r.valorComissaoCentavos)}</td>
                        <td>
                          <span className="badge" style={{
                            background: `${STATUS_COR[r.status]}22`, color: STATUS_COR[r.status],
                          }}>
                            {STATUS_LABEL[r.status] || r.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{formatarData(r.criadoEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {modalPagamento && (
        <div className="modal-overlay" onClick={() => setModalPagamento(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar pagamento</h2>
              <button className="modal-close" onClick={() => setModalPagamento(null)}><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 16 }}>
                {modalPagamento.totalResgates} utilização(ões) · <strong>{centavosTxt(modalPagamento.valorComissaoTotalCentavos)}</strong>
              </p>
              <div className="field-group">
                <label>Método de pagamento</label>
                <input type="text" value={formPagamento.metodo}
                  onChange={e => setFormPagamento(f => ({ ...f, metodo: e.target.value }))}
                  placeholder="Pix, transferência..." />
              </div>
              <div className="field-group">
                <label>Referência / comprovante</label>
                <input type="text" value={formPagamento.referencia}
                  onChange={e => setFormPagamento(f => ({ ...f, referencia: e.target.value }))}
                  placeholder="Código da transação, etc." />
              </div>
              <div className="field-group">
                <label>Observação</label>
                <textarea value={formPagamento.observacao}
                  onChange={e => setFormPagamento(f => ({ ...f, observacao: e.target.value }))}
                  rows={2} placeholder="Opcional" />
              </div>
              <div className="modal-footer">
                <button className="btn-ghost" onClick={() => setModalPagamento(null)}>Cancelar</button>
                <button className="btn-primary" onClick={registrarPagamento} disabled={processando}>
                  {processando ? 'Salvando...' : 'Confirmar pagamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
