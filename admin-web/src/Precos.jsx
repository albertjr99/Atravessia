import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { IconAlert } from './Icons';

// Porte da parte de preços de oamorqueefica/src/screens/admin/AdminPrecosScreen.js
// Documento `configuracoes/precos` (centavos): plano1, plano2, plano3, periodo,
// ativarEm (opcional), atualizadoEm. Espelha o valor em planos/{id}.preco e
// .precoLabel, que é o que o card do plano e o checkout leem.

const PLANOS_INFO = [
  { id: 1, nome: 'Plano Acolher', cor: '#D4A89A', campo: 'plano1' },
  { id: 2, nome: 'Plano Compreender', cor: '#8B7AC0', campo: 'plano2' },
  { id: 3, nome: 'Plano Evoluir', cor: '#7A9E7E', campo: 'plano3' },
];

const DEFAULT_PRECOS = { plano1: 2490, plano2: 4990, plano3: 8990, periodo: 590 };
const NOMES = { plano1: 'Plano Acolher', plano2: 'Plano Compreender', plano3: 'Plano Evoluir', periodo: 'Relatório por período' };

function centavosParaReais(centavos) {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

function reaisParaCentavos(str) {
  const limpo = str.replace(/[^0-9,]/g, '').replace(',', '.');
  const valor = parseFloat(limpo);
  if (isNaN(valor)) return null;
  return Math.round(valor * 100);
}

function formatarInput(str) {
  const nums = str.replace(/\D/g, '');
  if (!nums) return '';
  const cents = parseInt(nums, 10);
  return (cents / 100).toFixed(2).replace('.', ',');
}

function inputsDe(data) {
  const d = data || {};
  return {
    plano1: centavosParaReais(d.plano1 ?? DEFAULT_PRECOS.plano1),
    plano2: centavosParaReais(d.plano2 ?? DEFAULT_PRECOS.plano2),
    plano3: centavosParaReais(d.plano3 ?? DEFAULT_PRECOS.plano3),
    periodo: centavosParaReais(d.periodo ?? DEFAULT_PRECOS.periodo),
  };
}

export default function Precos({ showToast }) {
  const [inputs, setInputs] = useState({});
  const [ativarEm, setAtivarEm] = useState(''); // YYYY-MM-DD do <input type="date">
  const [agendadoAtual, setAgendadoAtual] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, 'configuracoes', 'precos'), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setInputs(inputsDe(data));
      setAgendadoAtual(data?.ativarEm?.toDate?.() || null);
      setErro('');
      setCarregando(false);
    }, (e) => {
      setErro(e?.message || 'Erro desconhecido.');
      setCarregando(false);
    });
  }, []);

  const handleSalvar = async () => {
    const novo = {};
    for (const campo of ['plano1', 'plano2', 'plano3', 'periodo']) {
      const inputVal = (inputs[campo] || '').trim();
      if (!inputVal) continue; // campo em branco → não altera
      const val = reaisParaCentavos(inputVal);
      if (val === null || val <= 0) {
        showToast(`Valor inválido: verifique o preço de "${NOMES[campo]}".`, 'error');
        return;
      }
      novo[campo] = val;
    }

    if (Object.keys(novo).length === 0) {
      showToast('Preencha ao menos um preço para salvar.', 'error');
      return;
    }

    let ativarEmDate = null;
    if (ativarEm) {
      const [ano, mes, dia] = ativarEm.split('-').map(Number);
      const d = new Date(ano, mes - 1, dia);
      if (isNaN(d.getTime())) { showToast('Data inválida.', 'error'); return; }
      ativarEmDate = d;
    }

    setSalvando(true);
    try {
      const payload = { ...novo, atualizadoEm: serverTimestamp() };
      if (ativarEmDate) payload.ativarEm = ativarEmDate;

      await setDoc(doc(db, 'configuracoes', 'precos'), payload, { merge: true });

      for (const [campo, centavos] of Object.entries(novo)) {
        const info = PLANOS_INFO.find(p => p.campo === campo);
        if (!info) continue;
        const reais = centavos / 100;
        await setDoc(doc(db, 'planos', String(info.id)), {
          id: info.id,
          preco: reais,
          precoLabel: `R$ ${reais.toFixed(2).replace('.', ',')}/mês`,
        }, { merge: true });
      }

      showToast(ativarEmDate
        ? `Preços salvos. Serão ativados em ${ativarEmDate.toLocaleDateString('pt-BR')}.`
        : 'Preços salvos e atualizados imediatamente.');
      setAtivarEm('');
    } catch (e) {
      showToast('Não foi possível salvar os preços: ' + (e?.message || ''), 'error');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <div className="loading-state" style={{ minHeight: 200 }}><div className="spinner" />Carregando preços...</div>;

  return (
    <div className="screen-content aln-precos">
      <div className="screen-header-row">
        <div>
          <h2 className="aln-subtitulo">Preços de cobrança</h2>
          <p className="screen-sub">
            Valores dos planos e do relatório por período. São armazenados em centavos e usados pelas funções do Stripe.
          </p>
        </div>
      </div>

      {erro && (
        <div className="aln-erro">
          <IconAlert size={16} />
          <span>Não foi possível carregar os preços atuais: {erro}</span>
        </div>
      )}

      <div className="aln-rel-grid">
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 4 }}>Planos de assinatura (mensais)</h3>
          <span className="field-hint" style={{ marginBottom: 10 }}>Deixe em branco os campos que não deseja alterar.</span>
          {PLANOS_INFO.map(p => (
            <div key={p.id} className="aln-preco-row">
              <span className="aln-dot" style={{ background: p.cor }} />
              <span className="aln-preco-nome">{p.nome}</span>
              <div className="aln-preco-input">
                <span>R$</span>
                <input
                  inputMode="numeric"
                  value={inputs[p.campo] || ''}
                  onChange={e => setInputs(prev => ({ ...prev, [p.campo]: formatarInput(e.target.value) }))}
                  placeholder="0,00"
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 4 }}>Relatório por período (por crédito)</h3>
            <span className="field-hint" style={{ marginBottom: 10 }}>Deixe em branco para não alterar.</span>
            <div className="aln-preco-row">
              <span className="aln-preco-nome">Relatório personalizado</span>
              <div className="aln-preco-input">
                <span>R$</span>
                <input
                  inputMode="numeric"
                  value={inputs.periodo || ''}
                  onChange={e => setInputs(prev => ({ ...prev, periodo: formatarInput(e.target.value) }))}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 4 }}>Ativação agendada (opcional)</h3>
            <p className="screen-sub" style={{ fontSize: 12, marginBottom: 10 }}>
              Defina uma data futura para os novos preços entrarem em vigor. Deixe em branco para ativar imediatamente.
            </p>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <input type="date" value={ativarEm} onChange={e => setAtivarEm(e.target.value)} />
              {agendadoAtual && (
                <span className="field-hint">Última data agendada: {agendadoAtual.toLocaleDateString('pt-BR')}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar preços'}
        </button>
      </div>

      <p className="field-hint" style={{ textAlign: 'center', marginTop: 14 }}>
        Atenção: alterar os preços aqui não reconfigura automaticamente os produtos no Stripe. Os valores são usados pelas Cloud Functions para criar novos checkouts.
      </p>
    </div>
  );
}
