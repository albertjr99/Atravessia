import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

// Formas de pagamento oferecidas em Planos. Documento configuracoes/assinatura:
// { mensalAtivo, anualAtivo, seloAnual, textoAnual }. Os preços ficam no editor
// de cada plano (planos/{id}.preco e .precoAnual).
const PADRAO = { mensalAtivo: true, anualAtivo: true, seloAnual: '2 meses de presente', textoAnual: '' };

export default function Assinatura({ showToast }) {
  const [cfg, setCfg] = useState(PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [editado, setEditado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'assinatura'), (snap) => {
    if (!editado) setCfg({ ...PADRAO, ...(snap.data() || {}) });
    setCarregando(false);
  }, () => setCarregando(false)), [editado]);

  const set = (k, v) => { setEditado(true); setCfg(prev => ({ ...prev, [k]: v })); };

  const salvar = async () => {
    if (!cfg.mensalAtivo && !cfg.anualAtivo) { showToast('Deixe pelo menos uma forma de pagamento ligada.', 'error'); return; }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'assinatura'), {
        mensalAtivo: !!cfg.mensalAtivo, anualAtivo: !!cfg.anualAtivo,
        seloAnual: (cfg.seloAnual || '').trim(), textoAnual: (cfg.textoAnual || '').trim(),
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      setEditado(false);
      showToast('Formas de pagamento salvas.');
    } catch (e) {
      showToast('Não foi possível salvar: ' + (e?.message || 'tente de novo.'), 'error');
    } finally {
      setSalvando(false);
    }
  };

  const interruptor = (campo, titulo, sub) => (
    <label key={campo} className="toggle-row pp-forma">
      <span className="toggle">
        <input type="checkbox" checked={!!cfg[campo]} onChange={e => set(campo, e.target.checked)} disabled={carregando} />
        <span className="toggle-slider" />
      </span>
      <span><b>{titulo}</b><span className="field-hint" style={{ marginTop: 2 }}>{sub}</span></span>
    </label>
  );

  return (
    <section className="pp-secao" aria-labelledby="pp-formas-titulo">
      <h2 id="pp-formas-titulo" className="aln-subtitulo">Formas de pagamento</h2>
      <p className="screen-sub" style={{ marginBottom: 14 }}>Escolha como a usuária pode assinar os planos pagos.</p>
      <div className="card">
        <div className="pp-formas">
          {interruptor('mensalAtivo', 'Assinatura mensal', 'Cobrança todo mês.')}
          {interruptor('anualAtivo', 'Assinatura anual', 'Pagamento uma vez por ano.')}
        </div>
        <div className="field-row" style={{ marginTop: 6 }}>
          <div className="field-group">
            <label htmlFor="pp-selo">Selo da opção anual</label>
            <input id="pp-selo" type="text" value={cfg.seloAnual} onChange={e => set('seloAnual', e.target.value)}
              placeholder="Ex.: 2 meses de presente" disabled={!cfg.anualAtivo} />
          </div>
          <div className="field-group">
            <label htmlFor="pp-texto-anual">Frase sobre o anual <span className="aln-opcional">(opcional)</span></label>
            <input id="pp-texto-anual" type="text" value={cfg.textoAnual} onChange={e => set('textoAnual', e.target.value)}
              placeholder="Ex.: pague uma vez e tenha o ano todo de cuidado" disabled={!cfg.anualAtivo} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={salvar} disabled={salvando || carregando || !editado}>
            {salvando ? 'Salvando...' : 'Salvar formas de pagamento'}
          </button>
        </div>
      </div>
    </section>
  );
}
