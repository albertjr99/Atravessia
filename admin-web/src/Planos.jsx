import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, doc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';

const PLANOS_PADRAO = [
  {
    id: 0, nome: 'Perceber', subtitulo: 'Gratuito', preco: 0, precoLabel: 'Grátis',
    descricao: 'O primeiro passo é perceber como você está.',
    recursos: [
      'Cadastro básico', 'Frase do dia (365 frases)', 'Reflexão do dia',
      'Check-in emocional diário', 'Histórico emocional (últimos 7 dias)',
      'Relatório emocional mensal simples', 'Notificações de cuidado',
    ],
    destaque: false, emBreve: false,
  },
  {
    id: 1, nome: 'Acolher', subtitulo: 'R$ 24,90/mês', preco: 24.90, precoLabel: 'R$ 24,90/mês',
    descricao: 'Aqui, suas emoções encontram acolhimento.',
    recursos: [
      'Tudo do Gratuito', 'Pequenas Vitórias — registre seus avanços',
      'Áudios noturnos (1 por dia)', 'Biblioteca de áudios de acolhimento',
      'Feedback emocional diário personalizado',
    ],
    destaque: true, emBreve: false,
  },
  {
    id: 2, nome: 'Compreender', subtitulo: 'Em breve', preco: 0, precoLabel: 'Em breve',
    descricao: 'Compreenda seus padrões emocionais com mais profundidade.',
    recursos: [
      'Datas sensíveis (até 3 datas)', 'Jornadas terapêuticas guiadas',
      'Técnicas de respiração e pausas guiadas', 'Áudios informativos psicoeducativos',
      'Relatório emocional semanal',
    ],
    destaque: false, emBreve: true,
  },
  {
    id: 3, nome: 'Evoluir', subtitulo: 'Em breve', preco: 0, precoLabel: 'Em breve',
    descricao: 'Evolua com ferramentas de acompanhamento completo.',
    recursos: [
      'Rede de apoio (até 3 pessoas)', 'Memorial — fotos e homenagens',
      'Lives exclusivas', 'Relatório emocional mensal e anual',
    ],
    destaque: false, emBreve: true,
  },
];

function formVazio(plano) {
  return {
    nome: plano?.nome || '',
    subtitulo: plano?.subtitulo || '',
    preco: plano?.preco?.toString() || '0',
    precoLabel: plano?.precoLabel || '',
    descricao: plano?.descricao || '',
    recursos: (plano?.recursos || []).join('\n'),
    destaque: plano?.destaque || false,
    emBreve: plano?.emBreve || false,
  };
}

export default function Planos({ showToast }) {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(formVazio(null));
  const [salvando, setSalvando] = useState(false);
  const [semeando, setSemeando] = useState(false);

  useEffect(() => {
    const ref = query(collection(db, 'planos'), orderBy('id', 'asc'));
    return onSnapshot(ref, snap => {
      setPlanos(snap.docs.map(d => ({ ...d.data() })).sort((a, b) => a.id - b.id));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const abrirEditar = (plano) => {
    setForm(formVazio(plano));
    setModal(plano);
  };

  const fecharModal = () => { setModal(null); };

  const handleSalvar = async () => {
    if (!form.nome.trim()) { showToast('O nome do plano é obrigatório.', 'error'); return; }
    setSalvando(true);
    try {
      const recursos = form.recursos
        .split('\n')
        .map(r => r.trim())
        .filter(Boolean);
      const data = {
        id: modal.id,
        nome: form.nome.trim(),
        subtitulo: form.subtitulo.trim(),
        preco: parseFloat(form.preco) || 0,
        precoLabel: form.precoLabel.trim(),
        descricao: form.descricao.trim(),
        recursos,
        destaque: form.destaque,
        emBreve: form.emBreve,
      };
      await updateDoc(doc(db, 'planos', String(modal.id)), data);
      showToast(`Plano "${data.nome}" atualizado!`);
      fecharModal();
    } catch (e) {
      showToast('Erro ao salvar: ' + (e.message || ''), 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleSemear = async () => {
    if (!window.confirm('Isso vai criar os 4 planos padrão no Firestore. Continuar?')) return;
    setSemeando(true);
    try {
      for (const p of PLANOS_PADRAO) {
        await setDoc(doc(db, 'planos', String(p.id)), { ...p, criadoEm: serverTimestamp() });
      }
      showToast('Planos padrão criados com sucesso!');
    } catch (e) {
      showToast('Erro ao criar planos: ' + (e.message || ''), 'error');
    } finally {
      setSemeando(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" style={{ margin: '0 auto 10px' }} />
        Carregando...
      </div>
    );
  }

  return (
    <div className="screen-content">
      <div className="screen-header-row">
        <div>
          <h1 className="screen-title">💜 Planos</h1>
          <p className="screen-sub">
            Edite os nomes, descrições e recursos de cada plano exibidos no app.
          </p>
        </div>
        {planos.length === 0 && (
          <button className="btn-primary" onClick={handleSemear} disabled={semeando}>
            {semeando ? '⏳ Criando...' : '✨ Criar planos padrão'}
          </button>
        )}
      </div>

      {planos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💜</div>
          <p>
            Nenhum plano cadastrado no Firestore.<br />
            Clique em "Criar planos padrão" para começar.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {planos.map(p => (
            <div
              key={p.id}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 14, padding: 20, position: 'relative',
                borderTop: p.destaque ? '3px solid var(--primary)' : undefined,
              }}
            >
              {p.destaque && (
                <div style={{
                  position: 'absolute', top: -1, left: 16,
                  background: 'var(--primary)', color: 'white',
                  fontSize: 10, fontWeight: 700, padding: '2px 10px',
                  borderRadius: '0 0 8px 8px', letterSpacing: 0.5,
                }}>
                  RECOMENDADO
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-dark)' }}>{p.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 2 }}>{p.subtitulo}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{p.precoLabel}</div>
                  {p.emBreve && <span className="badge badge-inactive">Em breve</span>}
                </div>
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 10, lineHeight: 1.5 }}>
                {p.descricao}
              </p>

              <div style={{ marginBottom: 14 }}>
                {(p.recursos || []).map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3, fontSize: 11, color: 'var(--text-dark)' }}>
                    <span style={{ color: 'var(--sage)', flexShrink: 0 }}>✓</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>

              <button
                className="btn-ghost"
                style={{ width: '100%', fontSize: 13 }}
                onClick={() => abrirEditar(p)}
              >
                ✏️ Editar este plano
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Editar plano — {modal.nome}</h2>
              <button className="modal-close" onClick={fecharModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field-row">
                <div className="field-group">
                  <label>Nome do plano *</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={e => set('nome', e.target.value)}
                    placeholder="Ex: Acolher"
                    autoFocus
                  />
                </div>
                <div className="field-group">
                  <label>Subtítulo</label>
                  <input
                    type="text"
                    value={form.subtitulo}
                    onChange={e => set('subtitulo', e.target.value)}
                    placeholder="Ex: R$ 24,90/mês"
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label>Preço (número)</label>
                  <input
                    type="number"
                    value={form.preco}
                    onChange={e => set('preco', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="field-group">
                  <label>Rótulo do preço</label>
                  <input
                    type="text"
                    value={form.precoLabel}
                    onChange={e => set('precoLabel', e.target.value)}
                    placeholder="Ex: R$ 24,90/mês"
                  />
                </div>
              </div>

              <div className="field-group">
                <label>Descrição curta</label>
                <textarea
                  value={form.descricao}
                  onChange={e => set('descricao', e.target.value)}
                  placeholder="Breve descrição do plano..."
                  rows={2}
                />
              </div>

              <div className="field-group">
                <label>Recursos incluídos <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>(um por linha)</span></label>
                <textarea
                  value={form.recursos}
                  onChange={e => set('recursos', e.target.value)}
                  placeholder={'Cadastro básico\nFrase do dia\n...'}
                  rows={7}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
                <span className="field-hint">
                  {form.recursos.split('\n').filter(r => r.trim()).length} recursos configurados
                </span>
              </div>

              <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
                <div className="toggle-row" style={{ flex: 1 }}>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={form.destaque}
                      onChange={e => set('destaque', e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                  <span style={{ fontSize: 13, color: 'var(--text-dark)' }}>
                    Plano em destaque (recomendado)
                  </span>
                </div>
                <div className="toggle-row" style={{ flex: 1 }}>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={form.emBreve}
                      onChange={e => set('emBreve', e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                  <span style={{ fontSize: 13, color: 'var(--text-dark)' }}>
                    Em breve (não exibir botão)
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-ghost" onClick={fecharModal}>Cancelar</button>
                <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
                  {salvando ? '⏳ Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
