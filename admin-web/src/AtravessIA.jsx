import React, { useCallback, useEffect, useState } from 'react';
import { db } from './firebase';
import { addDoc, collection, collectionGroup, getDocs, serverTimestamp } from 'firebase/firestore';
import { IconAlert, IconSpark } from './Icons';
import { gerarRascunhos, lerDados, TIPOS_CONTEUDO, TEMAS_CONTEUDO } from './iaAdmin';
import { calcularMetricasFunil, planoNumero } from './metricasFunil';

// AtravessIA no painel web (porte de AdminAtravessIAScreen.js): leitura dos
// dados em linguagem simples e assistente de conteúdo. Inteligência própria
// do app, sem custo por uso.
const NIVEL = {
  atencao: { cor: '#8C4A3F', fundo: 'rgba(212,168,154,.18)', rotulo: 'Atenção' },
  sugestao: { cor: '#7A5A22', fundo: 'rgba(212,180,131,.2)', rotulo: 'Sugestão' },
  info: { cor: 'var(--primary-600, #5C4F8A)', fundo: 'var(--primary-lav, #EDE9F5)', rotulo: 'Informação' },
};

function Leitura() {
  const [insights, setInsights] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setInsights(null);
    try {
      const [us, ck, ct, au] = await Promise.all([
        getDocs(collection(db, 'usuarios')),
        getDocs(collectionGroup(db, 'checkins')),
        getDocs(collection(db, 'conteudos')),
        getDocs(collection(db, 'audiosAcolhimento')),
      ]);
      const usuarios = us.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role !== 'admin').map(u => ({ ...u, plano: planoNumero(u.plano) }));
      const checkins = ck.docs.map(d => ({ uid: d.ref.path.split('/')[1], ...d.data() }));
      const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      const metricas = calcularMetricasFunil({ usuarios, checkins, periodo: '30', hoje });
      setInsights(lerDados({ checkins, metricas, hoje, conteudos: ct.docs.map(d => d.data()), audios: au.docs.map(d => d.data()) }));
      setErro('');
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar os dados.');
      setInsights([]);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (insights === null) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Lendo os dados...</div>;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {erro && <div className="aln-erro"><IconAlert size={16} /><span>Não foi possível ler os dados: {erro}</span></div>}
      {insights.map((i, k) => {
        const n = NIVEL[i.nivel] || NIVEL.info;
        return (
          <div key={k} className="ia-insight" style={{ background: n.fundo }}>
            <span className="ia-nivel" style={{ color: n.cor }}>{n.rotulo}</span>
            <strong style={{ color: n.cor }}>{i.titulo}</strong>
            <p>{i.texto}</p>
          </div>
        );
      })}
      <button className="btn-ghost" onClick={carregar} style={{ justifySelf: 'start' }}>Atualizar leitura</button>
    </div>
  );
}

function Assistente({ showToast }) {
  const [tipo, setTipo] = useState('frase');
  const [tema, setTema] = useState('geral');
  const [rascunhos, setRascunhos] = useState(() => gerarRascunhos('frase', 'geral'));
  const [salvos, setSalvos] = useState({});

  const gerar = (t = tipo, tm = tema) => { setRascunhos(gerarRascunhos(t, tm)); setSalvos({}); };

  const copiar = async (r) => {
    const texto = [r.titulo, r.texto, r.reflexao && `Reflexão: ${r.reflexao}`].filter(Boolean).join('\n\n');
    try { await navigator.clipboard.writeText(texto); showToast('Texto copiado.'); }
    catch { showToast('Não foi possível copiar automaticamente. Selecione o texto e copie.', 'error'); }
  };

  const salvarFrase = async (r, i) => {
    try {
      await addDoc(collection(db, 'frases'), { texto: r.texto, autor: 'Atravessia', reflexao: r.reflexao || '', ativa: true, criadoEm: serverTimestamp() });
      setSalvos(s => ({ ...s, [i]: true }));
      showToast('Frase salva em Frases do dia.');
    } catch (e) { showToast(`Erro ao salvar: ${e?.message || ''}`, 'error'); }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <p className="section-label">Tipo</p>
        <div className="filter-row" style={{ flexWrap: 'wrap' }}>
          {TIPOS_CONTEUDO.map(t => (
            <button key={t.id} className={`chip ${tipo === t.id ? 'chip-active' : ''}`} onClick={() => { setTipo(t.id); gerar(t.id, tema); }}>{t.rotulo}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="section-label">Tema</p>
        <div className="filter-row" style={{ flexWrap: 'wrap' }}>
          {TEMAS_CONTEUDO.map(t => (
            <button key={t.id} className={`chip ${tema === t.id ? 'chip-active' : ''}`} onClick={() => { setTema(t.id); gerar(tipo, t.id); }}>{t.rotulo}</button>
          ))}
        </div>
      </div>
      {rascunhos.map((r, i) => (
        <div key={`${i}-${r.texto}`} className="card" style={{ display: 'grid', gap: 8 }}>
          {r.titulo && <strong style={{ color: 'var(--primary-600, #5C4F8A)' }}>{r.titulo}</strong>}
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{r.texto}</p>
          {r.reflexao && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-mid)' }}>Reflexão: {r.reflexao}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => copiar(r)}>Copiar</button>
            {tipo === 'frase' && (
              <button className="btn-primary" onClick={() => salvarFrase(r, i)} disabled={salvos[i]}>
                {salvos[i] ? 'Salva em Frases' : 'Salvar como frase do dia'}
              </button>
            )}
          </div>
        </div>
      ))}
      <button className="btn-ghost" onClick={() => gerar()} style={{ justifySelf: 'start' }}>Gerar outras opções</button>
      <p className="field-hint">Os textos são rascunhos para você revisar e ajustar antes de publicar.</p>
    </div>
  );
}

export default function AtravessIA({ showToast }) {
  const [aba, setAba] = useState('dados');
  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="ia-icone"><IconSpark size={20} /></span>
          <div>
            <h1 className="screen-title">AtravessIA</h1>
            <p className="screen-sub">Lê os dados em linguagem simples e ajuda a criar conteúdos.</p>
          </div>
        </div>
      </div>
      <div className="subtabs" style={{ marginBottom: 16 }}>
        <button className={`subtab ${aba === 'dados' ? 'active' : ''}`} onClick={() => setAba('dados')}>Leitura dos dados</button>
        <button className={`subtab ${aba === 'conteudo' ? 'active' : ''}`} onClick={() => setAba('conteudo')}>Assistente de conteúdo</button>
      </div>
      {aba === 'dados' ? <Leitura /> : <Assistente showToast={showToast} />}
    </div>
  );
}
