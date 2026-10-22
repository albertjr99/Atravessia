import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { IconAlert, IconChart } from './Icons';
import { lerReais, paraCampo, formatarReais, validarPreco } from './precosUtil';

// Relatório por período: configuracoes/precos.periodo (centavos). É o que a
// tela Relatórios do app mostra e o que a Cloud Function cobra.
const PADRAO_CENTAVOS = 590;

export default function Precos({ showToast }) {
  const [atual, setAtual] = useState(PADRAO_CENTAVOS / 100);
  const [valor, setValor] = useState('');
  const [editado, setEditado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'precos'), (snap) => {
    const c = snap.data()?.periodo;
    const reais = (typeof c === 'number' && c > 0 ? c : PADRAO_CENTAVOS) / 100;
    setAtual(reais);
    setValor(prev => (editado ? prev : paraCampo(reais)));
    setErroCarga('');
    setCarregando(false);
  }, (e) => {
    setErroCarga(e?.message || 'Erro desconhecido.');
    setCarregando(false);
  }), [editado]);

  const novo = lerReais(valor);
  const erro = validarPreco(novo);
  const mudou = novo !== null && novo !== atual;

  const salvar = async () => {
    setTentou(true);
    if (erro) { showToast(erro, 'error'); return; }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'precos'), {
        periodo: Math.round(novo * 100),
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      setEditado(false);
      setTentou(false);
      showToast(`Relatório por período agora custa ${formatarReais(novo)}.`);
    } catch (e) {
      showToast('Não foi possível salvar: ' + (e?.message || 'tente de novo.'), 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="pp-secao" aria-labelledby="pp-periodo-titulo">
      <h2 id="pp-periodo-titulo" className="aln-subtitulo">Relatório por período</h2>
      <p className="screen-sub" style={{ marginBottom: 14 }}>
        Valor de cada relatório personalizado que a usuária compra avulso.
      </p>

      {erroCarga && (
        <div className="aln-erro">
          <IconAlert size={16} />
          <span>Não foi possível carregar o valor atual: {erroCarga}</span>
        </div>
      )}

      <div className="card pp-avulso">
        <div className="pp-avulso-info">
          <span className="pp-avulso-icone"><IconChart size={20} /></span>
          <div>
            <span className="pp-preco-rot">Hoje a usuária paga</span>
            <div>
              {carregando
                ? <span className="pp-per">Carregando...</span>
                : <><strong className="pp-valor">{formatarReais(atual)}</strong><span className="pp-per">/relatório</span></>}
            </div>
          </div>
        </div>
        <div className="pp-avulso-form">
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label htmlFor="pp-periodo">Novo valor</label>
            <div className={`pp-moeda ${tentou && erro ? 'pp-moeda-erro' : ''}`}>
              <span>R$</span>
              <input id="pp-periodo" inputMode="decimal" autoComplete="off" value={valor} disabled={carregando}
                onChange={e => { setValor(e.target.value); setEditado(true); }} placeholder="5,90"
                aria-invalid={!!(tentou && erro)} aria-describedby="pp-periodo-dica" />
            </div>
            <span id="pp-periodo-dica" className={tentou && erro ? 'field-hint pp-erro' : 'field-hint'}>
              {tentou && erro ? erro : 'Mínimo de R$ 0,50.'}
            </span>
          </div>
          <button className="btn-primary" onClick={salvar} disabled={salvando || carregando || !mudou}>
            {salvando ? 'Salvando...' : 'Salvar valor'}
          </button>
        </div>
      </div>
    </section>
  );
}
