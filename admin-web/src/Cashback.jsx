import React, { useEffect, useMemo, useState } from 'react';
import { db, functions } from './firebase';
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

// Cashback no painel web (porte de AdminCashbackScreen.js): regras do
// programa, números gerais, crédito manual e estorno. Créditos e usos são
// gravados apenas pelas Cloud Functions.
const brl = (c) => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataCurta = (ms) => (ms ? new Date(ms).toLocaleDateString('pt-BR') : '');
const numero = (v) => Number(String(v).replace(',', '.'));

function resumoCashback(movimentos, agora = Date.now()) {
  const r = { distribuido: 0, usado: 0, vencido: 0, aberto: 0, pessoas: new Set() };
  movimentos.forEach(m => {
    if (m.tipo === 'credito') {
      r.distribuido += m.valorCentavos || 0;
      r.pessoas.add(m.usuarioId);
      if (m.estornado) return;
      if ((m.expiraEm?.toMillis?.() || 0) <= agora) r.vencido += m.saldoCentavos || 0;
      else r.aberto += m.saldoCentavos || 0;
    } else if (m.tipo === 'uso') r.usado += m.valorCentavos || 0;
  });
  return { ...r, pessoas: r.pessoas.size };
}

export default function Cashback({ showToast }) {
  const [cfg, setCfg] = useState({ ativo: true, percentual: '1', validadeMeses: '6', limitePercentual: '100' });
  const [salvandoCfg, setSalvandoCfg] = useState(false);
  const [movimentos, setMovimentos] = useState([]);
  const [usuarias, setUsuarias] = useState({});
  const [conceder, setConceder] = useState({ email: '', valor: '', motivo: '' });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'cashback'), (snap) => {
    const c = snap.data() || {};
    setCfg({
      ativo: c.ativo !== false,
      percentual: String(c.percentual ?? 1).replace('.', ','),
      validadeMeses: String(c.validadeMeses ?? 6),
      limitePercentual: String(c.limitePercentual ?? 100),
    });
  }, () => {}), []);
  useEffect(() => onSnapshot(collection(db, 'cashback'), (snap) => {
    setMovimentos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => {}), []);
  useEffect(() => onSnapshot(collection(db, 'usuarios'), (snap) => {
    const m = {};
    snap.docs.forEach(d => { const u = d.data(); m[d.id] = u.nome || u.email || 'Usuária'; });
    setUsuarias(m);
  }, () => {}), []);

  const resumo = useMemo(() => resumoCashback(movimentos), [movimentos]);
  const recentes = useMemo(() => [...movimentos]
    .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0))
    .slice(0, 60), [movimentos]);

  const salvarCfg = async () => {
    const percentual = numero(cfg.percentual);
    const validadeMeses = Math.round(numero(cfg.validadeMeses));
    const limitePercentual = numero(cfg.limitePercentual);
    if (!(percentual >= 0 && percentual <= 50)) { showToast('O percentual deve ficar entre 0 e 50.', 'error'); return; }
    if (!(validadeMeses >= 1 && validadeMeses <= 24)) { showToast('A validade deve ficar entre 1 e 24 meses.', 'error'); return; }
    if (!(limitePercentual >= 1 && limitePercentual <= 100)) { showToast('O desconto máximo deve ficar entre 1% e 100%.', 'error'); return; }
    setSalvandoCfg(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'cashback'), { ativo: cfg.ativo, percentual, validadeMeses, limitePercentual, atualizadoEm: serverTimestamp() }, { merge: true });
      showToast('Regras do cashback salvas.');
    } catch (e) {
      showToast(`Erro ao salvar: ${e.message || ''}`, 'error');
    } finally {
      setSalvandoCfg(false);
    }
  };

  const concederCredito = async () => {
    const valor = numero(conceder.valor);
    if (!conceder.email.trim()) { showToast('Informe o e-mail da usuária.', 'error'); return; }
    if (!(valor >= 1)) { showToast('Informe um valor a partir de R$ 1,00.', 'error'); return; }
    setEnviando(true);
    try {
      const r = await httpsCallable(functions, 'concederCashbackAdmin')({ email: conceder.email.trim(), valor, motivo: conceder.motivo.trim() });
      showToast(`${brl(Math.round(valor * 100))} concedidos para ${r.data?.nome || conceder.email}.`);
      setConceder({ email: '', valor: '', motivo: '' });
    } catch (e) {
      showToast(e.message || 'Não foi possível conceder.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const estornar = async (m) => {
    if (!window.confirm(`Zerar o saldo restante (${brl(m.saldoCentavos)}) deste crédito?`)) return;
    try {
      await httpsCallable(functions, 'estornarCashbackAdmin')({ creditoId: m.id });
      showToast('Crédito estornado.');
    } catch (e) { showToast(e.message || 'Não foi possível estornar.', 'error'); }
  };

  const agora = Date.now();
  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Cashback</h1>
          <p className="screen-sub">Quem usa um cupom de parceria ganha uma parte do valor de volta, para usar como desconto no plano ou no relatório.</p>
        </div>
      </div>

      <div className="stats-row-mini">
        <div className="stat-mini"><div className="stat-mini-value" style={{ fontSize: 20 }}>{brl(resumo.distribuido)}</div><div className="stat-mini-label">Distribuído</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ fontSize: 20, color: 'var(--sage)' }}>{brl(resumo.usado)}</div><div className="stat-mini-label">Usado em compras</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ fontSize: 20, color: 'var(--text-dark)' }}>{brl(resumo.aberto)}</div><div className="stat-mini-label">Em aberto</div></div>
        <div className="stat-mini"><div className="stat-mini-value" style={{ fontSize: 20, color: 'var(--text-light)' }}>{brl(resumo.vencido)}</div><div className="stat-mini-label">Vencido</div></div>
      </div>
      <p className="field-hint" style={{ marginTop: -6, marginBottom: 18 }}>{resumo.pessoas} pessoa{resumo.pessoas === 1 ? '' : 's'} já receberam cashback.</p>

      <div className="cb-colunas">
        <div className="card">
          <h3 className="card-title">Regras do programa</h3>
          <div className="toggle-row">
            <label className="toggle">
              <input type="checkbox" checked={cfg.ativo} onChange={e => setCfg(c => ({ ...c, ativo: e.target.checked }))} />
              <span className="toggle-slider" />
            </label>
            <span style={{ fontSize: 13, color: 'var(--text-dark)' }}>Programa ativo <span className="field-hint" style={{ display: 'inline' }}>(pausado, ninguém ganha nem usa créditos)</span></span>
          </div>
          <div className="cb-linha">
            <div className="field-group"><label>Cashback (%)</label><input value={cfg.percentual} onChange={e => setCfg(c => ({ ...c, percentual: e.target.value }))} inputMode="decimal" /></div>
            <div className="field-group"><label>Validade (meses)</label><input value={cfg.validadeMeses} onChange={e => setCfg(c => ({ ...c, validadeMeses: e.target.value }))} inputMode="numeric" /></div>
            <div className="field-group"><label>Desconto máx. (%)</label><input value={cfg.limitePercentual} onChange={e => setCfg(c => ({ ...c, limitePercentual: e.target.value }))} inputMode="numeric" /></div>
          </div>
          <p className="field-hint">"Desconto máx." é quanto do preço o cashback pode cobrir. Sempre fica ao menos R$ 1,00 a pagar.</p>
          <button className="btn-primary" onClick={salvarCfg} disabled={salvandoCfg} style={{ marginTop: 10 }}>{salvandoCfg ? 'Salvando...' : 'Salvar regras'}</button>
        </div>

        <div className="card">
          <h3 className="card-title">Conceder crédito</h3>
          <p className="field-hint" style={{ marginTop: 0 }}>Para cortesias ou ajustes. A pessoa recebe uma notificação no app.</p>
          <div className="field-group"><label>E-mail da usuária</label><input type="email" value={conceder.email} onChange={e => setConceder(c => ({ ...c, email: e.target.value }))} placeholder="nome@email.com" /></div>
          <div className="cb-linha">
            <div className="field-group"><label>Valor (R$)</label><input value={conceder.valor} onChange={e => setConceder(c => ({ ...c, valor: e.target.value }))} inputMode="decimal" placeholder="10,00" /></div>
            <div className="field-group" style={{ flex: 2 }}><label>Motivo (aparece no extrato)</label><input value={conceder.motivo} onChange={e => setConceder(c => ({ ...c, motivo: e.target.value }))} placeholder="Presente da Atravessia" /></div>
          </div>
          <button className="btn-primary" onClick={concederCredito} disabled={enviando}>{enviando ? 'Concedendo...' : 'Conceder crédito'}</button>
        </div>
      </div>

      <h3 className="card-title" style={{ marginTop: 22 }}>Movimentos recentes</h3>
      {recentes.length === 0 ? (
        <p className="field-hint">Nenhum movimento ainda.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {recentes.map(m => {
            const credito = m.tipo === 'credito';
            const vencido = credito && (m.expiraEm?.toMillis?.() || 0) <= agora;
            const podeEstornar = credito && !m.estornado && !vencido && (m.saldoCentavos || 0) > 0;
            const status = !credito ? (m.tipo === 'uso' ? 'Usado' : 'Estorno')
              : m.estornado ? 'Estornado' : vencido ? 'Vencido' : `Saldo ${brl(m.saldoCentavos)} · até ${dataCurta(m.expiraEm?.toMillis?.())}`;
            return (
              <div key={m.id} className="cb-mov">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{usuarias[m.usuarioId] || 'Usuária'}</strong>
                  <span>{m.descricao ? `${m.descricao} · ` : ''}{dataCurta(m.criadoEm?.toMillis?.())} · {status}</span>
                </div>
                <div className="cb-mov-valor" style={{ color: credito ? 'var(--sage-dark, #3F5440)' : 'var(--text-mid)' }}>{credito ? '+' : '−'} {brl(m.valorCentavos)}</div>
                {podeEstornar ? <button className="btn-ghost" onClick={() => estornar(m)}>Estornar</button> : <span style={{ width: 84 }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
