import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, addDoc, getDocs, serverTimestamp, onSnapshot,
  orderBy, query, doc, updateDoc,
} from 'firebase/firestore';

const TIPOS = [
  { id: 'incentivo', label: '💜 Incentivo', desc: 'Mensagem motivacional' },
  { id: 'conteudo', label: '📚 Conteúdo', desc: 'Novo conteúdo disponível' },
  { id: 'vitoria', label: '⭐ Vitória', desc: 'Registro de vitória do dia' },
  { id: 'live', label: '🎙️ Live / Áudio', desc: 'Aviso de áudio novo' },
  { id: 'inatividade', label: '⏰ Inatividade', desc: 'Usuária sem acesso há dias' },
  { id: 'data_sensivel', label: '📅 Data sensível', desc: 'Datas emocionalmente difíceis' },
  { id: 'feedback', label: '📊 Feedback', desc: 'Pedido de relatório emocional' },
];

export default function Notificacoes({ showToast }) {
  const [form, setForm] = useState({ tipo: 'incentivo', texto: '', destino: 'todas' });
  const [enviando, setEnviando] = useState(false);
  const [enviadas, setEnviadas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = query(collection(db, 'notificacoesEditoriais'), orderBy('enviadoEm', 'desc'));
    const unsub1 = onSnapshot(ref, snap => {
      setEnviadas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    getDocs(collection(db, 'usuarios')).then(snap => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return unsub1;
  }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const enviar = async () => {
    if (!form.texto.trim()) { showToast('Digite o texto da notificação.', 'error'); return; }
    setEnviando(true);
    try {
      if (form.destino === 'todas') {
        const lote = usuarios.map(u =>
          addDoc(collection(db, 'notificacoesEditoriais'), {
            usuarioId: u.id,
            tipo: form.tipo,
            texto: form.texto.trim(),
            ativa: true,
            lida: false,
            enviadoEm: serverTimestamp(),
            criadoEm: serverTimestamp(),
          })
        );
        await Promise.all(lote);
        showToast(`Notificação enviada para ${usuarios.length} usuária(s)!`);
      } else {
        await addDoc(collection(db, 'notificacoesEditoriais'), {
          usuarioId: form.destino,
          tipo: form.tipo,
          texto: form.texto.trim(),
          ativa: true,
          lida: false,
          enviadoEm: serverTimestamp(),
          criadoEm: serverTimestamp(),
        });
        showToast('Notificação enviada!');
      }
      setForm(prev => ({ ...prev, texto: '' }));
    } catch (e) {
      showToast('Erro ao enviar: ' + (e.message || ''), 'error');
    }
    setEnviando(false);
  };

  function timeAgo(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min}min atrás`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
  }

  return (
    <div className="screen-content">
      <div className="screen-header">
        <h1 className="screen-title">🔔 Notificações</h1>
        <p className="screen-sub">Envie notificações personalizadas para as usuárias do app.</p>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h2 className="card-title">✍️ Nova notificação</h2>

        <div className="field-group">
          <label>Tipo</label>
          <div className="chip-row" style={{ flexWrap: 'wrap' }}>
            {TIPOS.map(t => (
              <button key={t.id} className={`chip ${form.tipo === t.id ? 'chip-active' : ''}`} onClick={() => set('tipo', t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <span className="field-hint">{TIPOS.find(t => t.id === form.tipo)?.desc}</span>
        </div>

        <div className="field-group">
          <label>Mensagem</label>
          <textarea
            value={form.texto}
            onChange={e => set('texto', e.target.value)}
            placeholder="Digite a mensagem que aparecerá para a usuária..."
            rows={3}
          />
        </div>

        <div className="field-group">
          <label>Destinatário(s)</label>
          <select value={form.destino} onChange={e => set('destino', e.target.value)}>
            <option value="todas">Todas as usuárias ({usuarios.length})</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.nome || u.email}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={enviar} disabled={enviando || !form.texto.trim()}>
            {enviando ? '⏳ Enviando...' : '📤 Enviar notificação'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">📋 Histórico</h2>
        {loading ? (
          <p style={{ color: 'var(--text-light)', fontSize: 13 }}>Carregando...</p>
        ) : enviadas.length === 0 ? (
          <p style={{ color: 'var(--text-light)', fontSize: 13 }}>Nenhuma notificação enviada ainda.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Mensagem</th>
                <th>Enviada</th>
                <th>Lida</th>
              </tr>
            </thead>
            <tbody>
              {enviadas.slice(0, 50).map(n => (
                <tr key={n.id}>
                  <td><span className="badge">{TIPOS.find(t => t.id === n.tipo)?.label || n.tipo}</span></td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.texto}</td>
                  <td style={{ color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{timeAgo(n.enviadoEm)}</td>
                  <td>{n.lida ? '✅' : '⏳'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
