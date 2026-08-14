import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';

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
  const [stats, setStats] = useState({ users: 0, checkins: 0, frases: 0, conteudos: 0, audios: 0, vitorias: 0 });
  const [recentUsers, setRecentUsers] = useState([]);
  const [planDist, setPlanDist] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersSnap, checkinsSnap, frasesSnap, conteudosSnap, audiosSnap, vitoriasSnap] = await Promise.all([
          getDocs(collection(db, 'usuarios')),
          getDocs(collection(db, 'checkins')),
          getDocs(collection(db, 'frases')),
          getDocs(collection(db, 'conteudos')),
          getDocs(collection(db, 'audiosAcolhimento')),
          getDocs(collection(db, 'vitoriasOpcoes')),
        ]);
        setStats({
          users: usersSnap.size,
          checkins: checkinsSnap.size,
          frases: frasesSnap.size,
          conteudos: conteudosSnap.size,
          audios: audiosSnap.size,
          vitorias: vitoriasSnap.size,
        });

        const dist = {};
        usersSnap.docs.forEach(d => {
          const p = d.data().plano || 'perceber';
          dist[p] = (dist[p] || 0) + 1;
        });
        setPlanDist(dist);

        const sorted = usersSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.criadoEm?.toMillis?.() || 0;
            const tb = b.criadoEm?.toMillis?.() || 0;
            return tb - ta;
          })
          .slice(0, 8);
        setRecentUsers(sorted);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  return (
    <div className="screen-content">
      <div className="screen-header">
        <h1 className="screen-title">🏠 Dashboard</h1>
        <p className="screen-sub">Visão geral do Atravessia — dados em tempo real.</p>
      </div>

      <div className="stats-grid">
        {[
          { icon: '👥', value: stats.users, label: 'Usuárias' },
          { icon: '✅', value: stats.checkins, label: 'Check-ins' },
          { icon: '💬', value: stats.frases, label: 'Frases' },
          { icon: '📚', value: stats.conteudos, label: 'Conteúdos' },
          { icon: '🎵', value: stats.audios, label: 'Áudios' },
          { icon: '⭐', value: stats.vitorias, label: 'Vitórias' },
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
          {recentUsers.length === 0 ? (
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
                        : <span className={`badge badge-${u.plano || 'perceber'}`}>{PLAN_LABEL[u.plano] || u.plano || 'Perceber'}</span>
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
            {Object.entries(planDist).length === 0 ? (
              <p style={{ color: 'var(--text-light)', fontSize: 13 }}>Nenhum dado.</p>
            ) : (
              Object.entries(planDist).map(([plano, count]) => {
                const pct = stats.users > 0 ? Math.round((count / stats.users) * 100) : 0;
                return (
                  <div key={plano}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{PLAN_LABEL[plano] || plano}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 3, transition: 'width 0.6s ease' }} />
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
