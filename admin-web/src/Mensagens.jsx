import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { IconAlert } from './Icons';
import { EMOCOES } from './emocoes';

// Porte de oamorqueefica/src/screens/admin/AdminMensagensRelatorioScreen.js
// Documento `configuracoes/mensagensRelatorio`: { [idEmocao]: 'mensagem' }.
// Vazio = o app usa o texto padrão (mesma regra de RelatoriosScreen.js).
function mensagemPadrao(emo) {
  if (emo.positiva) {
    return `${emo.label} esteve presente em você este mês. Guarde esse sentimento com carinho e continue se cuidando.`;
  }
  const nomeEmo = emo.nomeRelatorio || emo.label.toLowerCase();
  return `Atravessando ${nomeEmo} — esse foi seu mês. Cada sentimento que você nomeia é um passo de cuidado. Você não precisa atravessar isso sozinho.`;
}

export default function Mensagens({ showToast }) {
  const [mensagens, setMensagens] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    getDoc(doc(db, 'configuracoes', 'mensagensRelatorio'))
      .then(snap => { if (ativo && snap.exists()) setMensagens(snap.data()); })
      .catch(e => { if (ativo) setErro(e?.message || 'Erro desconhecido.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const set = (id, text) => setMensagens(prev => ({ ...prev, [id]: text }));

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'mensagensRelatorio'), mensagens, { merge: true });
      showToast('Mensagens atualizadas com sucesso.');
    } catch (e) {
      showToast('Não foi possível salvar as mensagens: ' + (e?.message || ''), 'error');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div>;

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">Mensagens dos Relatórios</h1>
          <p className="screen-sub">
            Personalize a mensagem exibida nos relatórios mensais para cada emoção predominante.
            Deixe vazio para usar o texto padrão do app.
          </p>
        </div>
        <button className="btn-primary" onClick={handleSalvar} disabled={salvando || !!erro}>
          {salvando ? 'Salvando...' : 'Salvar mensagens'}
        </button>
      </div>

      {erro && (
        <div className="aln-erro">
          <IconAlert size={16} />
          <span>Não foi possível carregar as mensagens atuais: {erro}. Para não sobrescrever nada, o salvamento fica bloqueado — recarregue a página.</span>
        </div>
      )}

      <div className="aln-msg-grid">
        {EMOCOES.map(emo => (
          <div key={emo.id} className="card aln-msg-card">
            <div className="aln-msg-header">
              <span className="aln-dot" style={{ background: emo.color }} />
              <span className="aln-msg-label">{emo.label}</span>
              <span className={`badge ${emo.positiva ? 'badge-perceber' : 'badge-compreender'}`}>
                {emo.positiva ? 'positiva' : 'negativa'}
              </span>
            </div>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <textarea
                value={mensagens[emo.id] || ''}
                onChange={e => set(emo.id, e.target.value)}
                placeholder="Mensagem personalizada (deixe vazio para usar o padrão)"
                rows={3}
              />
              <span className="field-hint">Padrão: “{mensagemPadrao(emo)}”</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={handleSalvar} disabled={salvando || !!erro}>
          {salvando ? 'Salvando...' : 'Salvar mensagens'}
        </button>
      </div>
    </div>
  );
}
