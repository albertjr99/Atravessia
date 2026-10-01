import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import {
  collection, onSnapshot, doc, updateDoc, Timestamp,
} from 'firebase/firestore';
import { IconClose, IconSpark } from './Icons';

const PLANO_LABEL = { perceber: 'Perceber', acolher: 'Acolher', compreender: 'Compreender', evoluir: 'Evoluir' };

// Ordem = número do plano (planos/0..3 no Firestore).
const PLANO_IDS = ['perceber', 'acolher', 'compreender', 'evoluir'];

// O app grava o plano como número (0..3) e este painel como texto ('acolher').
// Os dois formatos convivem no Firestore; aqui tudo vira o id em texto.
function planoDe(u) {
  const p = u?.plano;
  if (typeof p === 'number') return PLANO_IDS[p] || 'perceber';
  return PLANO_IDS.includes(p) ? p : 'perceber';
}

// Nome e descrição vêm de planos/{0..3} — os mesmos documentos editados em
// "Preços e planos". Nesta aba NÃO se mostra preço nenhum (precoLabel e
// subtitulo são ignorados de propósito).
function opcoesDePlano(planosDocs) {
  return PLANO_IDS.map((id, i) => {
    const d = planosDocs[String(i)] || {};
    return {
      id,
      label: d.nome || PLANO_LABEL[id],
      desc: d.descricao || '',
    };
  });
}

function CortesiaForm({ usuaria, onSalvar, onCancelar }) {
  const [dias, setDias] = useState('30');
  const [salvando, setSalvando] = useState(false);
  const [erroCortesia, setErroCortesia] = useState('');

  const aplicar = async () => {
    const d = parseInt(dias, 10);
    if (!d || d < 1) return;
    setSalvando(true);
    setErroCortesia('');
    const expiracao = Timestamp.fromDate(new Date(Date.now() + d * 86400000));
    // NÃO gravar acessoTotal: true aqui — o app concede acesso enquanto
    // acessoTotal OU a cortesia (dentro do prazo) forem verdadeiros. Como
    // acessoTotal nunca é desligado sozinho, marcá-lo junto com a cortesia
    // tornava o acesso permanente e o prazo de expiração nunca fazia efeito.
    try {
      await updateDoc(doc(db, 'usuarios', usuaria.id), {
        cortesia: { ativo: true, expiracao },
        acessoTotal: false,
      });
    } catch (e) {
      setErroCortesia(`Não foi possível aplicar a cortesia: ${e?.message || 'tente novamente.'}`);
      setSalvando(false);
      return;
    }
    setSalvando(false);
    onSalvar();
  };

  return (
    <div className="cortesia-box">
      <div className="cortesia-title">Cortesia temporária</div>
      <p style={{ fontSize: 13, color: '#8A5B00', marginBottom: 12 }}>Concede acesso total temporário a <strong>{usuaria.nome || usuaria.email}</strong> por um número de dias.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
          <label>Duração (dias)</label>
          <input type="number" value={dias} onChange={e => setDias(e.target.value)} min={1} max={365} />
        </div>
        <button className="btn-primary" style={{ background: '#D4A500', marginBottom: 0 }} onClick={aplicar} disabled={salvando}>
          {salvando ? 'Aplicando...' : ' Aplicar'}
        </button>
        <button className="btn-ghost" onClick={onCancelar}>Cancelar</button>
      </div>
      {erroCortesia && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '10px 0 0' }}>{erroCortesia}</p>}
    </div>
  );
}

function PlanoModal({ usuaria, onClose, showToast, planosDocs }) {
  const opcoes = opcoesDePlano(planosDocs);
  const [showCortesia, setShowCortesia] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasAcessoTotal = usuaria.acessoTotal === true;
  const cortesiaAtiva = usuaria.cortesia?.ativo === true && usuaria.cortesia?.expiracao?.toDate?.() > new Date();

  const falhou = (e) => showToast(`Não foi possível salvar: ${e?.message || 'tente novamente.'}`, 'error');

  const setPlano = async (plano) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuaria.id), { plano, acessoTotal: false, cortesia: null });
    } catch (e) { falhou(e); setSaving(false); return; }
    showToast(`Plano alterado para ${opcoes.find(o => o.id === plano)?.label || PLANO_LABEL[plano] || plano}.`);
    setSaving(false);
    onClose();
  };

  const toggleAcessoTotal = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuaria.id), { acessoTotal: !hasAcessoTotal, cortesia: null });
    } catch (e) { falhou(e); setSaving(false); return; }
    showToast(hasAcessoTotal ? 'Acesso total removido.' : 'Acesso total concedido!');
    setSaving(false);
    onClose();
  };

  const removerCortesia = async () => {
    try {
      await updateDoc(doc(db, 'usuarios', usuaria.id), { cortesia: null, acessoTotal: false });
    } catch (e) { falhou(e); return; }
    showToast('Cortesia removida.');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2> Gerenciar acesso — {usuaria.nome?.split(' ')[0] || usuaria.email}</h2>
          <button className="modal-close" onClick={onClose}><IconClose size={17} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 14, padding: 12, background: 'var(--primary-lav)', borderRadius: 10, fontSize: 13 }}>
            <strong>Plano atual:</strong>{' '}
            {hasAcessoTotal ? <span className="badge badge-total" style={{ marginLeft: 4 }}>Acesso Total</span>
              : cortesiaAtiva ? <span className="badge badge-cortesia" style={{ marginLeft: 4 }}>Cortesia até {usuaria.cortesia.expiracao.toDate().toLocaleDateString('pt-BR')}</span>
              : <span className={`badge badge-${planoDe(usuaria)}`} style={{ marginLeft: 4 }}>{PLANO_LABEL[planoDe(usuaria)]}</span>
            }
          </div>

          <p className="section-label">Alterar plano</p>
          <div className="plan-options">
            {opcoes.map(p => (
              <button
                key={p.id}
                className={`plan-option ${planoDe(usuaria) === p.id && !hasAcessoTotal && !cortesiaAtiva ? 'selected' : ''}`}
                onClick={() => setPlano(p.id)}
                disabled={saving}
              >
                <div>
                  <div className="plan-option-label">{p.label}</div>
                  {p.desc && <div className="plan-option-desc">{p.desc}</div>}
                </div>
              </button>
            ))}
          </div>

          <div className="divider" />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className={hasAcessoTotal ? 'btn-danger' : 'btn-secondary'}
              onClick={toggleAcessoTotal}
              disabled={saving}
              style={{ flex: 1 }}
            >
              {hasAcessoTotal ? ' Remover acesso total' : 'Conceder acesso total'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowCortesia(v => !v)}
              style={{ flex: 1 }}
            >
              {cortesiaAtiva ? 'Renovar cortesia' : 'Cortesia temporária'}
            </button>
            {cortesiaAtiva && (
              <button className="btn-danger" onClick={removerCortesia}> Remover cortesia</button>
            )}
          </div>

          {showCortesia && (
            <CortesiaForm
              usuaria={usuaria}
              onSalvar={() => { showToast('Cortesia aplicada!'); setShowCortesia(false); onClose(); }}
              onCancelar={() => setShowCortesia(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Usuarias({ showToast }) {
  const [usuarios, setUsuarios] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroPlano, setFiltroPlano] = useState('todos');
  const [modalUsuaria, setModalUsuaria] = useState(null);
  const [loading, setLoading] = useState(true);

  const [planosDocs, setPlanosDocs] = useState({});
  const [erro, setErro] = useState('');

  useEffect(() => {
    // Sem orderBy('criadoEm'): o Firestore descartava da lista toda usuária sem
    // esse campo (contas antigas ou criadas fora do cadastro). Ordena aqui.
    return onSnapshot(collection(db, 'usuarios'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));
      setUsuarios(docs);
      setErro('');
      setLoading(false);
    }, (e) => { setErro(e?.message || 'Não foi possível carregar as usuárias.'); setLoading(false); });
  }, []);

  const [erroPlanos, setErroPlanos] = useState('');
  useEffect(() => onSnapshot(collection(db, 'planos'), snap => {
    const m = {};
    snap.docs.forEach(d => { m[d.id] = d.data(); });
    setPlanosDocs(m);
    setErroPlanos('');
  }, (e) => setErroPlanos(e?.message || 'erro desconhecido')), []);

  const lista = useMemo(() => {
    return usuarios.filter(u => {
      const matchBusca = !busca || [u.nome, u.email].some(v => v?.toLowerCase().includes(busca.toLowerCase()));
      if (!matchBusca) return false;
      if (filtroPlano === 'todos') return true;
      if (filtroPlano === 'total') return u.acessoTotal === true;
      if (filtroPlano === 'cortesia') return u.cortesia?.ativo === true;
      return planoDe(u) === filtroPlano;
    });
  }, [usuarios, busca, filtroPlano]);

  function getBadge(u) {
    if (u.acessoTotal) return <span className="badge badge-total">Acesso Total</span>;
    const cortesiaAtiva = u.cortesia?.ativo === true && u.cortesia?.expiracao?.toDate?.() > new Date();
    if (cortesiaAtiva) return <span className="badge badge-cortesia">Cortesia</span>;
    const plano = planoDe(u);
    return <span className={`badge badge-${plano}`}>{PLANO_LABEL[plano]}</span>;
  }

  function timeAgo(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'hoje';
    if (days === 1) return 'ontem';
    return `${days}d atrás`;
  }

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;
  if (erro) return <div className="empty-state"><p>Não foi possível carregar as usuárias: {erro}</p></div>;

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Usuárias</h1>
          <p className="screen-sub">Gerencie planos e acessos das {usuarios.length} usuária(s) cadastradas.</p>
        </div>
      </div>

      {erroPlanos && (
        <p style={{ fontSize: 12, color: 'var(--danger)', margin: '0 0 12px' }}>
          Não foi possível carregar os nomes dos planos ({erroPlanos}); usando os nomes padrão.
        </p>
      )}

      <div className="search-bar">
        <span></span>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail..." />
        {busca && <button onClick={() => setBusca('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}></button>}
      </div>

      <div className="filter-row">
        {[
          { id: 'todos', label: `Todas (${usuarios.length})` },
          { id: 'perceber', label: 'Perceber' },
          { id: 'acolher', label: 'Acolher' },
          { id: 'compreender', label: 'Compreender' },
          { id: 'evoluir', label: 'Evoluir' },
          { id: 'total', label: 'Acesso Total' },
          { id: 'cortesia', label: 'Cortesia' },
        ].map(f => (
          <button key={f.id} className={`chip ${filtroPlano === f.id ? 'chip-active' : ''}`} onClick={() => setFiltroPlano(f.id)}>{f.label}</button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconSpark size={34} /></div>
          <p>Nenhuma usuária encontrada.</p>
        </div>
      ) : (
        <div>
          {lista.map(u => (
            <div key={u.id} className="user-card" onClick={() => setModalUsuaria(u)}>
              <div className="user-avatar">
                {u.photoURL
                  ? <img src={u.photoURL} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />
                  : (u.nome || u.email || 'U')[0].toUpperCase()
                }
              </div>
              <div className="user-info">
                <div className="user-name">{u.nome || '(sem nome)'}</div>
                <div className="user-email">{u.email}</div>
                <div className="user-meta">
                  {getBadge(u)}
                  {u.criadoEm && <span style={{ fontSize: 11, color: 'var(--text-light)' }}>{timeAgo(u.criadoEm)}</span>}
                </div>
              </div>
              <div style={{ color: 'var(--text-light)', fontSize: 18 }}>›</div>
            </div>
          ))}
        </div>
      )}

      {modalUsuaria && (
        <PlanoModal
          usuaria={modalUsuaria}
          onClose={() => setModalUsuaria(null)}
          showToast={showToast}
          planosDocs={planosDocs}
        />
      )}
    </div>
  );
}
