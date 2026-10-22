import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, doc, onSnapshot, serverTimestamp, setDoc, writeBatch,
} from 'firebase/firestore';
import { IconClose, IconSpark, IconCheck, IconEdit, IconPlus, IconTrash, IconAlert } from './Icons';
import {
  lerReais, paraCampo, formatarReais, anualEfetivo, economiaPct, validarPreco,
  status, STATUS_ROTULO,
} from './precosUtil';

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
    id: 1, nome: 'Acolher', subtitulo: 'Mensal', preco: 24.90, precoLabel: 'R$ 24,90/mês',
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

const COR_PLANO = ['perceber', 'acolher', 'compreender', 'evoluir'];
const corDe = (id) => COR_PLANO[id] || 'acolher';

function formDe(plano) {
  return {
    nome: plano?.nome || '',
    descricao: plano?.descricao || '',
    mensagem: plano?.mensagem || '',
    recursos: (plano?.recursos || []).length ? [...plano.recursos] : [''],
    destaque: plano?.destaque === true,
    emBreve: plano?.emBreve === true,
    preco: paraCampo(plano?.preco),
    precoAnual: paraCampo(plano?.precoAnual),
  };
}

// Mostra os preços como a usuária vê no app.
function PrecosDoCard({ plano }) {
  if (plano.id === 0) {
    return <div className="pp-precos"><div className="pp-preco-bloco"><strong className="pp-valor">Grátis</strong></div></div>;
  }
  const mensal = Number(plano.preco) || 0;
  if (!(mensal > 0)) {
    return (
      <div className="pp-precos">
        <div className="pp-sem-preco"><IconAlert size={14} /> Sem preço definido</div>
      </div>
    );
  }
  const anual = anualEfetivo(mensal, Number(plano.precoAnual) || 0);
  const eco = economiaPct(mensal, anual);
  return (
    <div className="pp-precos">
      <div className="pp-preco-bloco">
        <span className="pp-preco-rot">Mensal</span>
        <span><strong className="pp-valor">{formatarReais(mensal)}</strong><span className="pp-per">/mês</span></span>
      </div>
      <div className="pp-preco-bloco">
        <span className="pp-preco-rot">Anual</span>
        <span><strong className="pp-valor">{formatarReais(anual)}</strong><span className="pp-per">/ano</span></span>
        <span className="pp-preco-nota">
          ≈ {formatarReais(anual / 12)}/mês
          {eco > 0 && <span className="pp-economia">economia de {eco}%</span>}
        </span>
        {!(plano.precoAnual > 0) && <span className="pp-preco-nota">automático: 10 mensalidades</span>}
      </div>
    </div>
  );
}

export default function Planos({ showToast }) {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(formDe(null));
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [semeando, setSemeando] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'planos'), snap => {
      setPlanos(snap.docs
        .map(d => ({ ...d.data(), id: d.data().id ?? Number(d.id) }))
        .filter(p => Number.isFinite(p.id))
        .sort((a, b) => a.id - b.id));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setRecurso = (i, v) => setForm(prev => ({ ...prev, recursos: prev.recursos.map((r, j) => (j === i ? v : r)) }));
  const addRecurso = () => setForm(prev => ({ ...prev, recursos: [...prev.recursos, ''] }));
  const delRecurso = (i) => setForm(prev => ({ ...prev, recursos: prev.recursos.filter((_, j) => j !== i) }));

  const abrirEditar = (plano) => { setForm(formDe(plano)); setTentou(false); setModal(plano); };
  const fecharModal = () => { if (!salvando) setModal(null); };

  useEffect(() => {
    if (!modal) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') fecharModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Validação ao vivo dos preços.
  const temPreco = modal && modal.id !== 0;
  const mensal = lerReais(form.preco);
  const anual = lerReais(form.precoAnual);
  const erroNome = form.nome.trim() ? '' : 'Dê um nome ao plano.';
  const erroMensal = temPreco ? validarPreco(mensal, { obrigatorio: !form.emBreve }) : '';
  const erroAnual = temPreco ? validarPreco(anual, { obrigatorio: false }) : '';
  const anualFinal = anualEfetivo(mensal || 0, anual || 0);
  const eco = economiaPct(mensal, anualFinal);
  const anualCaro = temPreco && mensal > 0 && anual > 0 && anual > mensal * 12;
  const sugestao = mensal > 0 ? Math.round(mensal * 10 * 100) / 100 : 0;

  const handleSalvar = async () => {
    setTentou(true);
    if (erroNome || erroMensal || erroAnual) {
      showToast('Confira os campos destacados antes de salvar.', 'error');
      return;
    }
    setSalvando(true);
    try {
      const id = modal.id;
      const dados = {
        id,
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        mensagem: form.mensagem.trim(),
        recursos: form.recursos.map(r => r.trim()).filter(Boolean),
        destaque: form.destaque,
        emBreve: id === 0 ? false : form.emBreve,
        atualizadoEm: serverTimestamp(),
      };
      const lote = writeBatch(db);
      if (id === 0) {
        Object.assign(dados, { preco: 0, precoLabel: 'Grátis' });
      } else {
        const p = mensal || 0;
        const a = anual || 0; // 0 = automático (10 mensalidades)
        Object.assign(dados, {
          preco: p,
          precoAnual: a,
          precoLabel: p > 0 ? `${formatarReais(p)}/mês` : 'Em breve',
        });
        // Espelho em centavos, só por compatibilidade com leituras antigas.
        lote.set(doc(db, 'configuracoes', 'precos'), {
          [`plano${id}`]: Math.round(p * 100),
          [`plano${id}Anual`]: Math.round(a * 100),
          atualizadoEm: serverTimestamp(),
        }, { merge: true });
      }
      // set+merge funciona mesmo se o documento ainda não existir.
      lote.set(doc(db, 'planos', String(id)), dados, { merge: true });
      await lote.commit();
      showToast(`Plano ${dados.nome} salvo. Já aparece assim no app.`);
      setModal(null);
    } catch (e) {
      showToast('Não foi possível salvar: ' + (e?.message || 'tente de novo.'), 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleSemear = async () => {
    if (!window.confirm('Isso vai criar os 4 planos padrão. Continuar?')) return;
    setSemeando(true);
    try {
      for (const p of PLANOS_PADRAO) {
        await setDoc(doc(db, 'planos', String(p.id)), { ...p, criadoEm: serverTimestamp() });
      }
      showToast('Planos padrão criados.');
    } catch (e) {
      showToast('Erro ao criar planos: ' + (e.message || ''), 'error');
    } finally {
      setSemeando(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando planos...
      </div>
    );
  }

  const mostrarErro = (msg) => tentou && msg;

  return (
    <section className="pp-secao" aria-labelledby="pp-planos-titulo">
      <div className="screen-header-row" style={{ marginBottom: 14 }}>
        <div>
          <h2 id="pp-planos-titulo" className="aln-subtitulo">Planos</h2>
          <p className="screen-sub">Cada card mostra o plano do jeito que aparece no app.</p>
        </div>
        {planos.length === 0 && (
          <button className="btn-primary" onClick={handleSemear} disabled={semeando}>
            {semeando ? 'Criando...' : 'Criar planos padrão'}
          </button>
        )}
      </div>

      {planos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconSpark size={34} /></div>
          <p>Ainda não há planos cadastrados.<br />Use "Criar planos padrão" para começar.</p>
        </div>
      ) : (
        <div className="pp-grid">
          {planos.map(p => {
            const st = status(p);
            return (
              <article key={p.id} className={`card plano-card pp-card pp-cor-${corDe(p.id)} ${p.destaque ? 'plano-destaque' : ''}`}>
                {p.destaque && <div className="plano-selo">RECOMENDADO</div>}
                <div className="pp-card-topo">
                  <h3 className="pp-nome">{p.nome}</h3>
                  <span className={`badge pp-status-${st}`}>{STATUS_ROTULO[st]}</span>
                </div>
                <PrecosDoCard plano={p} />
                {p.descricao && <p className="pp-desc">{p.descricao}</p>}
                <p className="pp-meta">
                  <IconCheck size={13} /> {(p.recursos || []).length} recurso(s) incluído(s)
                  {p.mensagem ? ' · com mensagem de destaque' : ''}
                </p>
                <button className="btn-ghost pp-editar" onClick={() => abrirEditar(p)} aria-label={`Editar plano ${p.nome}`}>
                  <IconEdit size={15} /> Editar plano
                </button>
              </article>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal-card modal-card-lg" role="dialog" aria-modal="true" aria-labelledby="pp-editor-titulo" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="pp-editor-titulo">Editar plano {modal.nome}</h2>
              <button className="modal-close" onClick={fecharModal} aria-label="Fechar"><IconClose size={17} /></button>
            </div>
            <div className="modal-body">
              {temPreco && (
                <fieldset className="pp-editor-precos">
                  <legend>Preço</legend>
                  <div className="field-row">
                    <div className="field-group">
                      <label htmlFor="pp-mensal">Mensal {form.emBreve ? <span className="aln-opcional">(opcional enquanto estiver “Em breve”)</span> : '*'}</label>
                      <div className={`pp-moeda ${mostrarErro(erroMensal) ? 'pp-moeda-erro' : ''}`}>
                        <span>R$</span>
                        <input id="pp-mensal" inputMode="decimal" autoComplete="off" value={form.preco}
                          onChange={e => set('preco', e.target.value)} placeholder="24,90"
                          aria-invalid={!!mostrarErro(erroMensal)} aria-describedby="pp-mensal-dica" />
                        <span className="pp-moeda-per">/mês</span>
                      </div>
                      <span id="pp-mensal-dica" className={mostrarErro(erroMensal) ? 'field-hint pp-erro' : 'field-hint'}>
                        {mostrarErro(erroMensal) || 'Cobrado todo mês. Mínimo de R$ 0,50.'}
                      </span>
                    </div>
                    <div className="field-group">
                      <label htmlFor="pp-anual">Anual <span className="aln-opcional">(opcional)</span></label>
                      <div className={`pp-moeda ${mostrarErro(erroAnual) ? 'pp-moeda-erro' : ''}`}>
                        <span>R$</span>
                        <input id="pp-anual" inputMode="decimal" autoComplete="off" value={form.precoAnual}
                          onChange={e => set('precoAnual', e.target.value)}
                          placeholder={sugestao ? paraCampo(sugestao) : '249,00'}
                          aria-invalid={!!mostrarErro(erroAnual)} aria-describedby="pp-anual-dica" />
                        <span className="pp-moeda-per">/ano</span>
                      </div>
                      <span id="pp-anual-dica" className={mostrarErro(erroAnual) ? 'field-hint pp-erro' : 'field-hint'}>
                        {mostrarErro(erroAnual) || (anual
                          ? 'Cobrado uma vez por ano.'
                          : sugestao ? `Vazio = 10 mensalidades (${formatarReais(sugestao)}).` : 'Vazio = 10 mensalidades.')}
                      </span>
                      {sugestao > 0 && anual !== sugestao && (
                        <button type="button" className="pp-sugestao" onClick={() => set('precoAnual', paraCampo(sugestao))}>
                          Usar 10 mensalidades: {formatarReais(sugestao)}
                        </button>
                      )}
                    </div>
                  </div>
                  {mensal > 0 && !erroAnual && (
                    <div className={`pp-resumo ${anualCaro ? 'pp-resumo-aviso' : ''}`} role="status">
                      {anualCaro ? (
                        <><IconAlert size={15} /> O anual está mais caro que 12 mensalidades ({formatarReais(mensal * 12)}). Confira se é isso mesmo.</>
                      ) : (
                        <>No anual, a usuária paga <b>{formatarReais(anualFinal)}</b> (≈ {formatarReais(anualFinal / 12)}/mês){eco > 0 ? <> e economiza <b>{eco}%</b></> : null}.</>
                      )}
                    </div>
                  )}
                </fieldset>
              )}

              <div className="field-group">
                <label htmlFor="pp-nome">Nome do plano *</label>
                <input id="pp-nome" type="text" value={form.nome} onChange={e => set('nome', e.target.value)}
                  placeholder="Ex.: Acolher" aria-invalid={!!mostrarErro(erroNome)} />
                {mostrarErro(erroNome) && <span className="field-hint pp-erro">{erroNome}</span>}
              </div>

              <div className="field-group">
                <label htmlFor="pp-desc">Descrição curta</label>
                <textarea id="pp-desc" value={form.descricao} onChange={e => set('descricao', e.target.value)}
                  placeholder="Uma frase sobre o plano..." rows={2} />
              </div>

              <div className="field-group">
                <label htmlFor="pp-msg">Mensagem de destaque <span className="aln-opcional">(opcional)</span></label>
                <textarea id="pp-msg" value={form.mensagem} onChange={e => set('mensagem', e.target.value)}
                  placeholder="Ex.: Neste plano você tem acesso a todo o acervo de áudios de acolhimento." rows={2} />
                <span className="field-hint">Aparece numa caixa em destaque no card. Em branco, não aparece.</span>
              </div>

              <div className="field-group">
                <label id="pp-rec-rot">O que está incluído</label>
                <ul className="pp-recursos" aria-labelledby="pp-rec-rot">
                  {form.recursos.map((r, i) => (
                    <li key={i}>
                      <span className="pp-rec-check"><IconCheck size={13} /></span>
                      <input type="text" value={r} onChange={e => setRecurso(i, e.target.value)}
                        placeholder="Ex.: Áudios de acolhimento" aria-label={`Recurso ${i + 1}`} />
                      <button type="button" className="pp-rec-del" onClick={() => delRecurso(i)} aria-label={`Remover recurso ${i + 1}`}>
                        <IconTrash size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn-ghost pp-rec-add" onClick={addRecurso}>
                  <IconPlus size={15} /> Adicionar recurso
                </button>
              </div>

              <div className="pp-toggles">
                <label className="toggle-row">
                  <span className="toggle">
                    <input type="checkbox" checked={form.destaque} onChange={e => set('destaque', e.target.checked)} />
                    <span className="toggle-slider" />
                  </span>
                  <span>Mostrar selo “Recomendado”</span>
                </label>
                {modal.id !== 0 && (
                  <label className="toggle-row">
                    <span className="toggle">
                      <input type="checkbox" checked={form.emBreve} onChange={e => set('emBreve', e.target.checked)} />
                      <span className="toggle-slider" />
                    </span>
                    <span>Em breve (aparece, mas ainda não dá para assinar)</span>
                  </label>
                )}
              </div>

              <div className="modal-footer">
                <button className="btn-ghost" onClick={fecharModal} disabled={salvando}>Cancelar</button>
                <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar plano'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
