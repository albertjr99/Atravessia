import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { IconCheck } from './Icons';

// Liga/desliga cada função da AtravessIA no app e escolhe a partir de qual
// plano ela fica liberada. Documento: configuracoes/recursosIA (o mesmo que o
// app lê em oamorqueefica/src/config/recursosIA.js).
const RECURSOS = [
  { chave: 'diarioGuiado', rotulo: 'Diário guiado', descricao: 'Perguntas gentis para escrever sobre o dia.', padrao: { ativo: true, planoMinimo: 1 } },
  { chave: 'cartaMes', rotulo: 'Carta do mês', descricao: 'Uma carta afetuosa com o caminho do mês.', padrao: { ativo: true, planoMinimo: 1 } },
  { chave: 'planoAno', rotulo: 'Plano do ano', descricao: 'Plano de ação para o ano que começa, a partir do histórico.', padrao: { ativo: true, planoMinimo: 1 } },
  { chave: 'conversa', rotulo: 'Conversar', descricao: 'Conversa de acolhimento com a AtravessIA.', padrao: { ativo: false, planoMinimo: 1 } },
];
const PLANOS = ['Perceber (gratuito)', 'Acolher', 'Compreender', 'Evoluir'];

export default function RecursosIA({ showToast }) {
  const [cfg, setCfg] = useState(() => Object.fromEntries(RECURSOS.map(r => [r.chave, r.padrao])));
  const [salvando, setSalvando] = useState(false);
  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'recursosIA'), (snap) => {
    const d = snap.data() || {};
    setCfg(Object.fromEntries(RECURSOS.map(r => [r.chave, { ...r.padrao, ...(d[r.chave] || {}) }])));
  }, () => {}), []);

  const set = (chave, campo, v) => setCfg(prev => ({ ...prev, [chave]: { ...prev[chave], [campo]: v } }));
  const salvar = async () => {
    setSalvando(true);
    try {
      const dados = Object.fromEntries(RECURSOS.map(r => [r.chave, { ativo: !!cfg[r.chave].ativo, planoMinimo: Number(cfg[r.chave].planoMinimo) || 0 }]));
      await setDoc(doc(db, 'configuracoes', 'recursosIA'), { ...dados, atualizadoEm: serverTimestamp() }, { merge: true });
      showToast('Funções da AtravessIA atualizadas no app.');
    } catch (e) {
      showToast('Não foi possível salvar: ' + (e?.message || ''), 'error');
    }
    setSalvando(false);
  };

  return (
    <div className="screen-content" style={{ maxWidth: 860 }}>
      <div className="screen-header">
        <h1 className="screen-title">Funções da AtravessIA</h1>
        <p className="screen-sub">Escolha quais funções aparecem no app e a partir de qual plano cada uma fica liberada. Quem não tem o plano vê a função com cadeado e o convite para conhecer os planos.</p>
      </div>
      {RECURSOS.map(r => (
        <div key={r.chave} className="card" style={{ marginBottom: 14, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h3 className="card-title" style={{ marginBottom: 4 }}>{r.rotulo}</h3>
            <p className="field-hint" style={{ margin: 0 }}>{r.descricao}</p>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
            <input type="checkbox" checked={!!cfg[r.chave].ativo} onChange={e => set(r.chave, 'ativo', e.target.checked)} />
            {cfg[r.chave].ativo ? 'Ligada' : 'Desligada'}
          </label>
          <div className="field-group" style={{ margin: 0, minWidth: 220 }}>
            <label>Liberada a partir do plano</label>
            <select value={cfg[r.chave].planoMinimo} onChange={e => set(r.chave, 'planoMinimo', Number(e.target.value))} disabled={!cfg[r.chave].ativo}>
              {PLANOS.map((p, i) => <option key={p} value={i}>{p}</option>)}
            </select>
          </div>
        </div>
      ))}
      <button className="btn-primary" onClick={salvar} disabled={salvando}><IconCheck size={16} /> {salvando ? 'Salvando…' : 'Salvar e publicar'}</button>
      <ChaveTravessinhos showToast={showToast} />
    </div>
  );
}

// Os Travessinhos (Nanda, Brian e Maju): liga/desliga todas as aparições no
// app (dicas, listas vazias, comemorações e apresentação). Salva na hora em
// configuracoes/travessinhos { ativo } — o app lê em src/components/Travessinho.js.
function ChaveTravessinhos({ showToast }) {
  const [ativo, setAtivo] = useState(true);
  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'travessinhos'),
    (snap) => setAtivo(!snap.exists() || snap.data()?.ativo !== false), () => {}), []);
  const alternar = async (v) => {
    setAtivo(v);
    try {
      await setDoc(doc(db, 'configuracoes', 'travessinhos'), { ativo: v, atualizadoEm: serverTimestamp() }, { merge: true });
      showToast(v ? 'Os Travessinhos voltaram a aparecer no app.' : 'Os Travessinhos foram desligados no app.');
    } catch (e) {
      setAtivo(!v);
      showToast('Não foi possível salvar: ' + (e?.message || ''), 'error');
    }
  };
  return (
    <div className="card" style={{ marginTop: 28, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <h3 className="card-title" style={{ marginBottom: 4 }}>Os Travessinhos</h3>
        <p className="field-hint" style={{ margin: 0 }}>
          Nanda, Brian e Maju aparecem no app com dicas nas primeiras visitas, nas listas vazias, nas comemorações e na apresentação inicial.
        </p>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
        <input type="checkbox" checked={ativo} onChange={e => alternar(e.target.checked)} />
        {ativo ? 'Ligados' : 'Desligados'}
      </label>
    </div>
  );
}
