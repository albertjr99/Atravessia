import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { IconCheck } from './Icons';

// Gestão das formas de assinatura (mensal e anual). Documento
// configuracoes/assinatura: { mensalAtivo, anualAtivo, seloAnual, textoAnual }.
// Os preços anuais de cada plano ficam em planos/{id}.precoAnual (reais) e são
// espelhados em configuracoes/precos.plano{id}Anual (centavos), que o checkout lê.
const PLANOS = [
  { id: 1, nome: 'Plano Acolher' },
  { id: 2, nome: 'Plano Compreender' },
  { id: 3, nome: 'Plano Evoluir' },
];
const PADRAO = { mensalAtivo: true, anualAtivo: true, seloAnual: '2 meses de presente', textoAnual: '' };
const reais = (v) => (v ? String(v).replace('.', ',') : '');
const numero = (t) => { const n = parseFloat(String(t || '').replace(/[^0-9,.]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

export default function Assinatura({ showToast }) {
  const [cfg, setCfg] = useState(PADRAO);
  const [planos, setPlanos] = useState({});
  const [anuais, setAnuais] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'assinatura'), (snap) => setCfg({ ...PADRAO, ...(snap.data() || {}) }), () => {}), []);
  useEffect(() => {
    const unsubs = PLANOS.map(p => onSnapshot(doc(db, 'planos', String(p.id)), (snap) => {
      const d = snap.data() || {};
      setPlanos(prev => ({ ...prev, [p.id]: d }));
      setAnuais(prev => (prev[p.id] !== undefined ? prev : { ...prev, [p.id]: reais(d.precoAnual) }));
    }, () => {}));
    return () => unsubs.forEach(u => u());
  }, []);

  const set = (k, v) => setCfg(prev => ({ ...prev, [k]: v }));

  const salvar = async () => {
    if (!cfg.mensalAtivo && !cfg.anualAtivo) { showToast('Deixe pelo menos uma forma de assinatura ligada.', 'error'); return; }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'assinatura'), {
        mensalAtivo: !!cfg.mensalAtivo, anualAtivo: !!cfg.anualAtivo,
        seloAnual: (cfg.seloAnual || '').trim(), textoAnual: (cfg.textoAnual || '').trim(),
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      const espelho = {};
      for (const p of PLANOS) {
        const v = numero(anuais[p.id]);
        await setDoc(doc(db, 'planos', String(p.id)), { precoAnual: v }, { merge: true });
        espelho[`plano${p.id}Anual`] = v > 0 ? Math.round(v * 100) : 0;
      }
      await setDoc(doc(db, 'configuracoes', 'precos'), espelho, { merge: true });
      showToast('Assinaturas atualizadas no app.');
    } catch (e) {
      showToast('Não foi possível salvar: ' + (e?.message || ''), 'error');
    }
    setSalvando(false);
  };

  return (
    <div className="screen-content" style={{ maxWidth: 900 }}>
      <div className="screen-header">
        <h2 className="screen-title" style={{ fontSize: 26 }}>Assinatura mensal e anual</h2>
        <p className="screen-sub">Escolha quais formas de pagamento aparecem em Planos e o preço anual de cada plano.</p>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Formas de assinatura</h3>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '8px 0' }}>
          <input type="checkbox" checked={!!cfg.mensalAtivo} onChange={e => set('mensalAtivo', e.target.checked)} /> Oferecer assinatura <b>mensal</b>
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '8px 0' }}>
          <input type="checkbox" checked={!!cfg.anualAtivo} onChange={e => set('anualAtivo', e.target.checked)} /> Oferecer assinatura <b>anual</b>
        </label>
        <div className="field-row">
          <div className="field-group">
            <label>Selo da opção anual</label>
            <input type="text" value={cfg.seloAnual} onChange={e => set('seloAnual', e.target.value)} placeholder="Ex.: 2 meses de presente" />
          </div>
          <div className="field-group">
            <label>Texto curto sobre o anual (opcional)</label>
            <input type="text" value={cfg.textoAnual} onChange={e => set('textoAnual', e.target.value)} placeholder="Ex.: pague uma vez e tenha o ano todo de cuidado" />
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Preço anual por plano</h3>
        <p className="field-hint" style={{ marginBottom: 10 }}>Campo vazio = 10 mensalidades. O preço mensal é editado no card de cada plano, acima.</p>
        {PLANOS.map(p => (
          <div key={p.id} className="field-row" style={{ alignItems: 'end' }}>
            <div className="field-group">
              <label>{p.nome} · mensal atual</label>
              <input type="text" value={planos[p.id]?.preco ? `R$ ${reais(Number(planos[p.id].preco).toFixed(2))}` : '—'} disabled />
            </div>
            <div className="field-group">
              <label>{p.nome} · anual (R$)</label>
              <input type="text" value={anuais[p.id] ?? ''} onChange={e => setAnuais(prev => ({ ...prev, [p.id]: e.target.value }))}
                placeholder={planos[p.id]?.preco ? `Vazio = ${reais((planos[p.id].preco * 10).toFixed(2))}` : 'Ex.: 249,00'} />
            </div>
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={salvar} disabled={salvando}>
        <IconCheck size={16} /> {salvando ? 'Salvando…' : 'Salvar assinaturas'}
      </button>
    </div>
  );
}
