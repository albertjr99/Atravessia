import React, { useState, useEffect } from 'react';
import { ordenarPor } from './ordenar';
import { db } from './firebase';
import {
  collection, addDoc, getDocs, serverTimestamp, onSnapshot, doc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { IconTrash } from './Icons';
import Recolhivel from './Recolhivel';

const TIPOS = [
  { id: 'incentivo', label: 'Incentivo', desc: 'Mensagem motivacional' },
  { id: 'conteudo', label: 'Conteúdo', desc: 'Novo conteúdo disponível' },
  { id: 'vitoria', label: 'Vitória', desc: 'Registro de vitória do dia' },
  { id: 'live', label: 'Live / Áudio', desc: 'Aviso de áudio novo' },
  { id: 'inatividade', label: 'Inatividade', desc: 'Usuária sem acesso há dias' },
  { id: 'data_sensivel', label: 'Data sensível', desc: 'Datas emocionalmente difíceis' },
  { id: 'feedback', label: 'Feedback', desc: 'Pedido de relatório emocional' },
];

const ALVOS = [
  { id: 'todos', label: 'Todas as usuárias' },
  { id: 'plano1', label: 'Somente Acolher (pago)' },
  { id: 'gratis', label: 'Somente Perceber (grátis)' },
  { id: 'plano2', label: 'Somente Compreender (futuro)' },
  { id: 'plano3', label: 'Somente Evoluir (futuro)' },
];

// Envios antigos gravavam uma cópia por usuária: na lista, as cópias da mesma
// mensagem (mesmo tipo e texto, no mesmo minuto) viram um item só.
function agruparCopias(docs) {
  const grupos = new Map();
  docs.forEach(n => {
    const ts = n.enviadoEm || n.criadoEm;
    const ms = ts?.toMillis?.() ?? 0;
    const chave = n.usuarioId ? `${n.tipo}|${n.texto}|${Math.floor(ms / 60000)}` : `doc|${n.id}`;
    const g = grupos.get(chave);
    if (g) g.ids.push(n.id); else grupos.set(chave, { ...n, ids: [n.id] });
  });
  return [...grupos.values()];
}

export default function Notificacoes({ showToast }) {
  const [form, setForm] = useState({ tipo: 'incentivo', texto: '', destino: 'todos' });
  const [enviando, setEnviando] = useState(false);
  const [enviadas, setEnviadas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // O painel do app e as Cloud Functions gravam só `criadoEm`; ordenar por
    // `enviadoEm` no Firestore escondia todas essas notificações daqui.
    const unsub1 = onSnapshot(collection(db, 'notificacoesEditoriais'), snap => {
      setEnviadas(agruparCopias(ordenarPor(snap.docs.map(d => ({ id: d.id, ...d.data() })), ['enviadoEm', 'criadoEm'], 'desc')));
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
      // Uma notificação só por envio: o público vai em `alvo` (como no painel do
      // app) e só o envio para uma pessoa específica leva `usuarioId`. Antes,
      // "todas" gravava uma cópia por usuária, e a lista do painel se repetia.
      const publico = ALVOS.some(a => a.id === form.destino);
      await addDoc(collection(db, 'notificacoesEditoriais'), {
        ...(publico ? { alvo: form.destino } : { alvo: 'todos', usuarioId: form.destino }),
        tipo: form.tipo,
        texto: form.texto.trim(),
        ativa: true,
        origem: 'admin',
        enviadoEm: serverTimestamp(),
        criadoEm: serverTimestamp(),
      });
      showToast('Notificação enviada!');
      setForm(prev => ({ ...prev, texto: '' }));
    } catch (e) {
      showToast('Erro ao enviar: ' + (e.message || ''), 'error');
    }
    setEnviando(false);
  };

  const remover = async (n) => {
    if (!window.confirm('Remover esta notificação?')) return;
    try {
      await Promise.all(n.ids.map(id => deleteDoc(doc(db, 'notificacoesEditoriais', id))));
      showToast('Notificação removida.');
    } catch (e) { showToast('Erro ao remover: ' + (e.message || ''), 'error'); }
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
        <h1 className="screen-title">Notificações</h1>
        <p className="screen-sub">Envie notificações personalizadas para as usuárias do app.</p>
      </div>

      <Recolhivel titulo="Nova notificação" subtitulo="Clique para escrever e enviar uma notificação" className="recolhivel-espaco">

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
            {ALVOS.map(a => <option key={a.id} value={a.id}>{a.id === 'todos' ? `${a.label} (${usuarios.length})` : a.label}</option>)}
            <optgroup label="Uma usuária específica">
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nome || u.email}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={enviar} disabled={enviando || !form.texto.trim()}>
            {enviando ? 'Enviando...' : 'Enviar notificação'}
          </button>
        </div>
      </Recolhivel>

      <div className="card">
        <h2 className="card-title"> Histórico</h2>
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
                <th>Para</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enviadas.slice(0, 50).map(n => (
                <tr key={n.id}>
                  <td><span className="badge">{TIPOS.find(t => t.id === n.tipo)?.label || n.tipo}</span></td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.texto}</td>
                  <td style={{ color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{timeAgo(n.enviadoEm || n.criadoEm)}</td>
                  <td style={{ color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                    {n.ids.length > 1 ? `${n.ids.length} usuárias` : n.usuarioId ? (usuarios.find(u => u.id === n.usuarioId)?.nome || '1 usuária') : (ALVOS.find(a => a.id === (n.alvo || 'todos'))?.label || n.alvo)}
                  </td>
                  <td><button className="icon-btn icon-btn-delete" title="Remover" onClick={() => remover(n)}><IconTrash size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
