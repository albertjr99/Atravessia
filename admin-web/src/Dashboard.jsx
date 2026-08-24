import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

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

export default function Dashboard() {
  const [usuarios, setUsuarios] = useState([]);
  const [counts, setCounts] = useState({ frases: 0, conteudos: 0, audios: 0, parcerias: 0, vitorias: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubs = [];
    let loaded = 0;
    const totalSubs = 6;
    const markLoaded = () => { loaded++; if (loaded >= totalSubs) setLoading(false); };

    // Usuárias — main subscription
    unsubs.push(onSnapshot(
      query(collection(db, 'usuarios'), orderBy('criadoEm', 'desc')),
      snap => {
        setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setError(null);
        markLoaded();
      },
      err => {
        setError('Sem permissão para listar usuárias. Verifique se seu perfil tem role: "admin" no Firestore.');
        markLoaded();
      }
    ));

    // Content counts
    const collections = [
      ['frases', 'frases'],
      ['conteudos', 'conteudos'],
      ['audios', 'audiosAcolhimento'],
      ['parcerias', 'parcerias'],
      ['vitorias', 'vitoriasOpcoes'],
    ];
    for (const [key, col] of collections) {
      unsubs.push(onSnapshot(
        collection(db, col),
        snap => { setCounts(c => ({ ...c, [key]: snap.size })); markLoaded(); },
        () => markLoaded()
      ));
    }

    return () => unsubs.forEach(u => u());
  }, []);

  const planDist = {};
  usuarios.forEach(u => {
    const p = u.acessoTotal ? 'total' : (u.plano || 'perceber');
    planDist[p] = (planDist[p] || 0) + 1;
  });

  const recentUsers = usuarios.slice(0, 8);

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" style={{ margin: '0 auto 10px' }} />
        Carregando...
      </div>
    );
  }

  return (
    <div className="screen-content">
      <div className="screen-header">
        <h1 className="screen-title">🏠 Dashboard</h1>
        <p className="screen-sub">Visão geral do Atravessia — atualizado em tempo real.</p>
      </div>

      {error && (
        <div style={{
          background: '#FFF3CD', border: '1px solid #FFECB3',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          fontSize: 13, color: '#8A5B00',
        }}>
          ⚠️ {error}
        </div>
      )}

      <div className="stats-grid">
        {[
          { icon: '👥', value: usuarios.length, label: 'Usuárias' },
          { icon: '💬', value: counts.frases, label: 'Frases' },
          { icon: '📚', value: counts.conteudos, label: 'Conteúdos' },
          { icon: '🎵', value: counts.audios, label: 'Áudios' },
          { icon: '🤝', value: counts.parcerias, label: 'Parcerias' },
          { icon: '⭐', value: counts.vitorias, label: 'Opções Vitórias' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20 }}>
        <div className="card">
          <h2 className="card-title">Usuárias recentes</h2>
          {error ? (
            <p style={{ color: 'var(--text-light)', fontSize: 13 }}>
              Não foi possível carregar. Verifique as permissões do admin no Firestore.
            </p>
          ) : recentUsers.length === 0 ? (
            <p style={{ color: 'var(--text-light)', fontSize: 13 }}>Nenhuma usuária cadastrada ainda.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Plano</th>
                  <th>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.nome || '—'}</td>
                    <td style={{ color: 'var(--text-mid)' }}>{u.email || '—'}</td>
                    <td>
                      {u.acessoTotal
                        ? <span className="badge badge-total">Acesso Total</span>
                        : <span className={`badge badge-${u.plano || 'perceber'}`}>
                            {PLAN_LABEL[u.plano] || u.plano || 'Perceber'}
                          </span>
                      }
                    </td>
                    <td style={{ color: 'var(--text-light)' }}>{timeAgo(u.criadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">Distribuição de planos</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.keys(planDist).length === 0 ? (
              <p style={{ color: 'var(--text-light)', fontSize: 13 }}>Nenhum dado.</p>
            ) : (
              Object.entries(planDist).map(([plano, count]) => {
                const pct = usuarios.length > 0 ? Math.round((count / usuarios.length) * 100) : 0;
                const label = plano === 'total' ? '🔓 Acesso Total' : (PLAN_LABEL[plano] || plano);
                return (
                  <div key={plano}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: 'var(--primary)', borderRadius: 3,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
