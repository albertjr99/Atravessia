import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from './firebase';
import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { IconAlert, IconChart, IconClose, IconStar, IconUsers, IconSpark } from './Icons';
import { EMOCOES, emocaoPorId, nDiasAtras, formatDataBR } from './emocoes';
import { calcularMetricasFunil, planoNumero } from './metricasFunil';

// Porte de oamorqueefica/src/screens/admin/AdminRelatoriosScreen.js
// Abas: Geral · Funil · Emoções · Usuárias · Empresas. Mesmos cálculos do app.

const PLANO_LABELS = ['Perceber', 'Acolher', 'Compreender', 'Evoluir'];
const PLANO_CORES = ['#7A9E7E', '#8B7AC0', '#7B5EA7', '#C0843F'];
const COR = { lav5: '#7B6BAF', lav4: '#8B7AC0', lav3: '#B8ABD9', sage: '#7A9E7E', sageFg: '#3F5440', gold: '#D4B483', peach2: '#D4A89A', rose: '#D4A89A', roseFg: '#6b4a42' };

function MiniBar({ value, max, color, height = 8 }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div className="aln-minibar" style={{ height, borderRadius: height / 2 }}>
      <div style={{ width: `${pct}%`, background: color || COR.lav4, borderRadius: height / 2 }} />
    </div>
  );
}

// ─── Aba: Visão geral ─────────────────────────────────────────────
function VisaoGeral({ usuarios, todosCheckins, todasVitorias }) {
  const hoje = nDiasAtras(0);
  const semanaAtras = nDiasAtras(7);
  const mesAtras = nDiasAtras(30);

  const checkSemana = todosCheckins.filter(c => c.data >= semanaAtras).length;
  const checkMes = todosCheckins.filter(c => c.data >= mesAtras).length;
  const ativasHoje = new Set(todosCheckins.filter(c => c.data === hoje).map(c => c.uid)).size;
  const ativasSemana = new Set(todosCheckins.filter(c => c.data >= semanaAtras).map(c => c.uid)).size;

  const porPlano = [0, 1, 2, 3].map(p => ({
    label: PLANO_LABELS[p],
    count: usuarios.filter(u => (u.plano || 0) === p).length,
  }));
  const maxPlano = Math.max(...porPlano.map(p => p.count), 1);

  const ultimos14 = Array.from({ length: 14 }, (_, i) => {
    const data = nDiasAtras(13 - i);
    return { data, label: data.slice(8), value: todosCheckins.filter(c => c.data === data).length };
  });
  const maxDia = Math.max(...ultimos14.map(d => d.value), 1);
  const CHART_H = 110;

  return (
    <>
      <div className="stats-grid">
        {[
          { Icon: IconUsers, value: usuarios.length, label: 'Usuárias', color: COR.lav5 },
          { Icon: IconChart, value: todosCheckins.length, label: 'Check-ins', color: COR.sageFg },
          { Icon: IconStar, value: todasVitorias.length, label: 'Vitórias', color: COR.gold },
          { Icon: IconSpark, value: ativasHoje, label: 'Ativas hoje', color: COR.peach2 },
        ].map(({ Icon, value, label, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ color }}><Icon size={17} /></div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="aln-rel-grid">
        <div className="card">
          <h3 className="card-title">Engajamento</h3>
          <div className="aln-eng-row">
            {[
              { val: checkSemana, lbl: 'check-ins · 7 dias' },
              { val: checkMes, lbl: 'check-ins · 30 dias' },
              { val: ativasSemana, lbl: 'ativas · 7 dias' },
            ].map(e => (
              <div key={e.lbl} className="aln-eng-item">
                <div className="aln-eng-val">{e.val}</div>
                <div className="aln-eng-lbl">{e.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Distribuição por plano</h3>
          {porPlano.map((p, i) => (
            <div key={p.label} className="aln-bar-row">
              <span className="aln-dot" style={{ background: PLANO_CORES[i] }} />
              <span className="aln-bar-nome">{p.label}</span>
              <MiniBar value={p.count} max={maxPlano} color={PLANO_CORES[i]} />
              <span className="aln-bar-count">{p.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="card-title">Atividade — últimos 14 dias</h3>
        <div className="aln-colunas" style={{ height: CHART_H + 34 }}>
          {ultimos14.map(d => {
            const barH = d.value > 0 ? Math.max(Math.round((d.value / maxDia) * CHART_H), 4) : 2;
            return (
              <div key={d.data} className="aln-coluna" title={`${formatDataBR(d.data)}: ${d.value} check-in(s)`}>
                {d.value > 0 && <span className="aln-coluna-val">{d.value}</span>}
                <div className="aln-coluna-barra" style={{ height: barH, background: d.value > 0 ? COR.lav4 : 'var(--border)' }} />
                <span className="aln-coluna-lbl">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Aba: Funil e retenção ────────────────────────────────────────
const FUNIL_CORES = [COR.lav3, COR.lav4, '#7B5EA7', COR.sage];

function Indicador({ valor, rotulo, detalhe, cor }) {
  return (
    <div className="aln-ind">
      <div className="aln-ind-val" style={cor ? { color: cor } : undefined}>{valor}</div>
      <div className="aln-ind-lbl">{rotulo}</div>
      {detalhe && <div className="aln-ind-det">{detalhe}</div>}
    </div>
  );
}

function AbaFunil({ usuarios, todosCheckins }) {
  const [periodo, setPeriodo] = useState('30');
  const m = useMemo(
    () => calcularMetricasFunil({ usuarios, checkins: todosCheckins, periodo }),
    [usuarios, todosCheckins, periodo],
  );
  const total = m.etapas[0].qtd;
  const txt = (v) => (v == null ? '—' : `${v}%`);
  const plural = (n, um, varios) => (n === 1 ? um : varios);

  return (
    <>
      <div className="filter-row">
        {[{ v: '30', l: 'Cadastros · 30 dias' }, { v: '90', l: '90 dias' }, { v: 'all', l: 'Tudo' }].map(p => (
          <button key={p.v} className={`chip ${periodo === p.v ? 'chip-active' : ''}`} onClick={() => setPeriodo(p.v)}>{p.l}</button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Funil</h3>
        <p className="aln-funil-intro">
          O caminho de quem se cadastrou no período: se fez o primeiro check-in, se voltou e se assinou um plano.
        </p>
        {total === 0 ? (
          <p className="aln-vazio">Nenhum cadastro neste período.</p>
        ) : m.etapas.map((e, i) => {
          const destaque = m.maiorQueda?.id === e.id;
          return (
            <div key={e.id} className="aln-funil-etapa">
              {i > 0 && (
                <div className={`aln-funil-passagem ${destaque ? 'destaque' : ''}`}>
                  ↓ {txt(e.pctAnterior)} seguiram{e.perda > 0 ? ` · ${e.perda} ficaram pelo caminho` : ''}
                </div>
              )}
              <div className="aln-funil-linha">
                <div className="aln-funil-nome">
                  <strong>{e.titulo}</strong>
                  <span>{e.descricao}</span>
                </div>
                <span className="aln-funil-qtd">{e.qtd}</span>
                <span className="aln-funil-pct">{txt(e.pctTotal)}</span>
              </div>
              <div className="aln-funil-trilho">
                <div style={{ width: `${Math.max(e.pctTotal || 0, e.qtd > 0 ? 2 : 0)}%`, background: FUNIL_CORES[i] }} />
              </div>
            </div>
          );
        })}
        {m.maiorQueda && (
          <div className="aln-erro" style={{ marginTop: 14, marginBottom: 0 }}>
            <IconAlert size={16} />
            <span>Maior perda: de “{m.maiorQueda.de}” para “{m.maiorQueda.para}” — só {m.maiorQueda.pctAnterior}% seguiram.</span>
          </div>
        )}
      </div>

      <div className="aln-rel-grid">
        <div className="card">
          <h3 className="card-title">Retenção</h3>
          <div className="aln-ind-row">
            <Indicador
              valor={txt(m.retencaoD7.pct)}
              rotulo="Retenção D7"
              detalhe={`${m.retencaoD7.retidas} de ${m.retencaoD7.elegiveis} voltaram 7+ dias após o cadastro`}
              cor={COR.lav5}
            />
            <Indicador
              valor={txt(m.retencaoD30.pct)}
              rotulo="Retenção D30"
              detalhe={`${m.retencaoD30.retidas} de ${m.retencaoD30.elegiveis} voltaram 30+ dias após o cadastro`}
              cor={COR.lav5}
            />
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Atividade e conversão</h3>
          <div className="aln-ind-row">
            <Indicador valor={m.ativas7} rotulo="Ativas · 7 dias" detalhe="check-in na última semana" />
            <Indicador valor={m.ativas30} rotulo="Ativas · 30 dias" detalhe="check-in no último mês" />
          </div>
          <div className="aln-ind-row" style={{ marginTop: 8 }}>
            <Indicador
              valor={String(m.mediaCheckinsAtiva30).replace('.', ',')}
              rotulo="Check-ins por ativa"
              detalhe="média dos últimos 30 dias"
            />
            <Indicador
              valor={txt(m.conversaoPago)}
              rotulo="Grátis → pago"
              detalhe={m.conversaoPagoEntreQueVoltaram != null
                ? `${m.conversaoPagoEntreQueVoltaram}% entre as que voltaram`
                : 'dos cadastros do período'}
              cor={COR.sageFg}
            />
          </div>
        </div>
      </div>

      <p className="aln-funil-nota">
        {m.totalPagantes} {plural(m.totalPagantes, 'usuária', 'usuárias')} em plano pago hoje.
        {m.semCusto > 0 ? ` ${m.semCusto} com acesso total ou cortesia ficam fora do funil, para não distorcer a conversão.` : ''}
        {m.semDataCadastro > 0 ? ` ${m.semDataCadastro} ${plural(m.semDataCadastro, 'conta antiga sem data de cadastro só aparece', 'contas antigas sem data de cadastro só aparecem')} em “Tudo”.` : ''}
      </p>
    </>
  );
}

// ─── Aba: Emoções ─────────────────────────────────────────────────
function AbaEmocoes({ todosCheckins }) {
  const [periodo, setPeriodo] = useState('30');

  const limiar = periodo === 'all' ? null : nDiasAtras(Number(periodo));
  const filtrados = limiar ? todosCheckins.filter(c => c.data >= limiar) : todosCheckins;

  const porEmocao = {};
  filtrados.forEach(c => { porEmocao[c.emocao] = (porEmocao[c.emocao] || 0) + 1; });
  const ordenados = Object.entries(porEmocao).sort((a, b) => b[1] - a[1]);
  const maxQtd = ordenados[0]?.[1] || 1;
  const total = filtrados.length;

  const positivas = filtrados.filter(c => EMOCOES.find(e => e.id === c.emocao)?.positiva).length;
  const negativas = total - positivas;

  return (
    <>
      <div className="filter-row">
        {[{ v: '7', l: '7 dias' }, { v: '30', l: '30 dias' }, { v: 'all', l: 'Tudo' }].map(p => (
          <button key={p.v} className={`chip ${periodo === p.v ? 'chip-active' : ''}`} onClick={() => setPeriodo(p.v)}>{p.l}</button>
        ))}
      </div>

      {total > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="card-title">Positivas vs. negativas</h3>
          <div className="aln-pvn">
            <div className="aln-pvn-item">
              <div className="aln-pvn-val" style={{ color: COR.sageFg }}>{positivas}</div>
              <div className="aln-eng-lbl">Positivas</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="aln-bar-row" style={{ marginBottom: 0 }}>
                <MiniBar value={positivas} max={total} color={COR.sage} />
                <span className="aln-bar-count" style={{ color: COR.sageFg, width: 40 }}>{Math.round((positivas / total) * 100)}%</span>
              </div>
              <div className="aln-bar-row" style={{ marginBottom: 0 }}>
                <MiniBar value={negativas} max={total} color={COR.rose} />
                <span className="aln-bar-count" style={{ color: COR.roseFg, width: 40 }}>{Math.round((negativas / total) * 100)}%</span>
              </div>
            </div>
            <div className="aln-pvn-item">
              <div className="aln-pvn-val" style={{ color: COR.roseFg }}>{negativas}</div>
              <div className="aln-eng-lbl">Negativas</div>
            </div>
          </div>
        </div>
      )}

      <div className="aln-rel-grid">
        <div className="card">
          <h3 className="card-title">Frequência ({total} check-ins)</h3>
          {ordenados.length === 0 ? (
            <p className="aln-vazio">Nenhum dado nesse período.</p>
          ) : (
            ordenados.map(([id, qtd]) => {
              const emo = emocaoPorId(id);
              const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
              return (
                <div key={id} style={{ marginBottom: 12 }}>
                  <div className="aln-emo-header">
                    <span className="aln-dot" style={{ background: emo?.color || COR.lav3 }} />
                    <span className="aln-emo-label">{emo?.label || id}</span>
                    <span className="aln-emo-qtd">{qtd} · {pct}%</span>
                  </div>
                  <MiniBar value={qtd} max={maxQtd} color={emo?.color} />
                </div>
              );
            })
          )}
        </div>

        {ordenados.length >= 3 && (
          <div className="card" style={{ alignSelf: 'start' }}>
            <h3 className="card-title">Destaques do período</h3>
            {ordenados.slice(0, 3).map(([id, qtd], i) => {
              const emo = emocaoPorId(id);
              return (
                <div key={id} className="aln-hist-row">
                  <span className="aln-medalha">{i + 1}º</span>
                  <span className="aln-dot" style={{ background: emo?.color || COR.lav3 }} />
                  <span className="aln-hist-label">{emo?.label || id}</span>
                  <span className="aln-emo-qtd">{qtd}×</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Aba: Usuárias ────────────────────────────────────────────────
function AbaUsuarios({ usuarios, todosCheckins, todasVitorias }) {
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState(null);
  const [ordemPor, setOrdemPor] = useState('nome'); // 'nome' | 'plano' | 'atividade'

  function getUltimoCheckin(uid) {
    const lista = todosCheckins.filter(c => c.uid === uid);
    if (!lista.length) return null;
    return lista.reduce((a, b) => (a.data >= b.data ? a : b)).data;
  }

  function diasInativos(uid) {
    const ult = getUltimoCheckin(uid);
    if (!ult) return 9999;
    return Math.floor((new Date() - new Date(ult + 'T12:00:00')) / 86400000);
  }

  const usuariosOrdenados = [...usuarios].sort((a, b) => {
    if (ordemPor === 'plano') return (b.plano || 0) - (a.plano || 0);
    if (ordemPor === 'atividade') return diasInativos(a.id) - diasInativos(b.id);
    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
  });

  const usuariosFiltrados = usuariosOrdenados.filter(u => {
    if (!busca) return true;
    const b = busca.toLowerCase();
    return (u.nome || '').toLowerCase().includes(b) || (u.email || '').toLowerCase().includes(b);
  });

  const userCheckins = sel
    ? todosCheckins.filter(c => c.uid === sel.id).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
    : [];
  const userVitorias = sel
    ? todasVitorias.filter(v => v.uid === sel.id).sort((a, b) => (b.data || '').localeCompare(a.data || ''))
    : [];

  const membroDesde = (u) => {
    const d = u.criadoEm?.toDate?.();
    return d ? formatDataBR(d.toISOString().slice(0, 10)) : '';
  };

  return (
    <>
      <div className="aln-usu-topo">
        <input
          className="aln-busca"
          type="search"
          placeholder="Buscar por nome ou e-mail..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <div className="filter-row" style={{ marginBottom: 0, alignItems: 'center' }}>
          <span className="aln-ordem-lbl">Ordenar:</span>
          {[{ v: 'nome', l: 'Nome' }, { v: 'plano', l: 'Plano' }, { v: 'atividade', l: 'Mais ativas' }].map(o => (
            <button key={o.v} className={`chip ${ordemPor === o.v ? 'chip-active' : ''}`} onClick={() => setOrdemPor(o.v)}>{o.l}</button>
          ))}
        </div>
      </div>

      <div className={`aln-usu-layout ${sel ? 'com-detalhe' : ''}`}>
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          {usuariosFiltrados.length === 0 ? (
            <p className="aln-vazio">Nenhuma usuária encontrada.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuária</th>
                  <th>Plano</th>
                  <th style={{ textAlign: 'right' }}>Check-ins</th>
                  <th style={{ textAlign: 'right' }}>Inativa há</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map(u => {
                  const plano = u.plano || 0;
                  const nCheck = todosCheckins.filter(c => c.uid === u.id).length;
                  const dias = diasInativos(u.id);
                  const isSelected = sel?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      className={`aln-linha-clicavel ${isSelected ? 'aln-linha-sel' : ''}`}
                      onClick={() => setSel(isSelected ? null : u)}
                    >
                      <td>
                        <div className="aln-usu-cel">
                          <span className="aln-plano-barra" style={{ background: PLANO_CORES[plano] }} />
                          <div style={{ minWidth: 0 }}>
                            <div className="aln-usu-nome">{u.nome || u.email}</div>
                            <div className="aln-usu-email">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: PLANO_CORES[plano] + '20', color: PLANO_CORES[plano] }}>{PLANO_LABELS[plano]}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{nCheck}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-mid)' }}>{dias < 9999 ? `${dias}d` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {sel && (
          <div className="card aln-detalhe">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div className="aln-detalhe-nome">{sel.nome || '—'}</div>
                <div className="aln-usu-email">{sel.email}</div>
                {!!sel.cidade && <div className="aln-detalhe-meta">{sel.cidade}</div>}
              </div>
              <button className="icon-btn" onClick={() => setSel(null)} title="Fechar"><IconClose size={16} /></button>
            </div>

            <div className="aln-detalhe-stats">
              {[
                { val: PLANO_LABELS[sel.plano || 0], lbl: 'Plano', color: PLANO_CORES[sel.plano || 0] },
                { val: userCheckins.length, lbl: 'Check-ins', color: COR.lav5 },
                { val: userVitorias.length, lbl: 'Vitórias', color: COR.gold },
                { val: diasInativos(sel.id) < 9999 ? `${diasInativos(sel.id)}d` : '—', lbl: 'Inativo', color: COR.peach2 },
              ].map(it => (
                <div key={it.lbl} className="aln-detalhe-box">
                  <div className="aln-detalhe-val" style={{ color: it.color }}>{it.val}</div>
                  <div className="aln-eng-lbl">{it.lbl}</div>
                </div>
              ))}
            </div>

            {sel.criadoEm && membroDesde(sel) && (
              <div className="aln-detalhe-meta">Membro desde: {membroDesde(sel)}</div>
            )}

            {userCheckins.length > 0 && (
              <>
                <div className="section-label" style={{ marginTop: 14 }}>Últimos check-ins</div>
                {userCheckins.slice(0, 5).map(c => {
                  const emo = emocaoPorId(c.emocao);
                  return (
                    <div key={c.id} className="aln-hist-row">
                      <span className="aln-dot" style={{ background: emo?.color || COR.lav3 }} />
                      <span className="aln-hist-label">{emo?.label || c.emocao}</span>
                      <span className="aln-hist-data">{formatDataBR(c.data)}</span>
                    </div>
                  );
                })}
              </>
            )}

            {userVitorias.length > 0 && (
              <>
                <div className="section-label" style={{ marginTop: 14 }}>Últimas vitórias</div>
                {userVitorias.slice(0, 3).map(v => (
                  <div key={v.id} className="aln-hist-row">
                    <IconStar size={12} style={{ color: COR.gold }} />
                    <span className="aln-hist-label">{v.label}</span>
                    <span className="aln-hist-data">{formatDataBR(v.data)}</span>
                  </div>
                ))}
              </>
            )}

            {userCheckins.length === 0 && userVitorias.length === 0 && (
              <p className="aln-vazio">Nenhuma atividade registrada ainda.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Aba: Empresas ────────────────────────────────────────────────
function AbaEmpresas({ usuarios }) {
  const usuariosEmpresa = usuarios.filter(u => u.linkEmpresa === true);

  const porEmpresa = {};
  usuariosEmpresa.forEach(u => {
    const nome = u.empresa || '(empresa não identificada)';
    if (!porEmpresa[nome]) porEmpresa[nome] = [];
    porEmpresa[nome].push(u);
  });
  const empresas = Object.entries(porEmpresa).sort((a, b) => b[1].length - a[1].length);

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Usuárias via empresa</h3>
        <div className="aln-eng-row">
          <div className="aln-eng-item">
            <div className="aln-eng-val">{usuariosEmpresa.length}</div>
            <div className="aln-eng-lbl">total via empresa</div>
          </div>
          <div className="aln-eng-item">
            <div className="aln-eng-val">{empresas.length}</div>
            <div className="aln-eng-lbl">empresas diferentes</div>
          </div>
          <div className="aln-eng-item">
            <div className="aln-eng-val">{usuarios.length > 0 ? Math.round((usuariosEmpresa.length / usuarios.length) * 100) : 0}%</div>
            <div className="aln-eng-lbl">do total de usuárias</div>
          </div>
        </div>
      </div>

      {empresas.length === 0 && (
        <div className="empty-state"><p>Nenhuma usuária cadastrada via link de empresa ainda.</p></div>
      )}

      <div className="aln-rel-grid">
        {empresas.map(([nome, users]) => (
          <div key={nome} className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <h3 className="card-title" style={{ margin: 0 }}>{nome}</h3>
              <span className="badge badge-total">{users.length} usuária{users.length !== 1 ? 's' : ''}</span>
            </div>
            {users.map(u => (
              <div key={u.id} className="aln-hist-row">
                <span className="aln-dot" style={{ background: PLANO_CORES[u.plano || 0] }} />
                <span className="aln-hist-label">{u.nome || u.email}</span>
                <span className="aln-hist-data">{PLANO_LABELS[u.plano || 0]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Principal ────────────────────────────────────────────────────
const ABAS = [
  { id: 'geral', label: 'Geral' },
  { id: 'funil', label: 'Funil e retenção' },
  { id: 'emocoes', label: 'Emoções' },
  { id: 'usuarios', label: 'Usuárias' },
  { id: 'empresas', label: 'Empresas' },
];

export default function Relatorios() {
  const [aba, setAba] = useState('geral');
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [todosCheckins, setTodosCheckins] = useState([]);
  const [todasVitorias, setTodasVitorias] = useState([]);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const usersSnap = await getDocs(collection(db, 'usuarios'));
      // O plano pode estar como número (app) ou texto (painel web).
      const users = usersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role !== 'admin')
        .map(u => ({ ...u, plano: planoNumero(u.plano) }));

      // Sem orderBy: collectionGroup com orderBy exige índice próprio e falha
      // inteira quando ele não existe. Ordena em memória.
      const checkinsSnap = await getDocs(collectionGroup(db, 'checkins'));
      const checkins = checkinsSnap.docs
        .map(d => ({ id: d.id, uid: d.ref.path.split('/')[1], ...d.data() }))
        .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));

      const vitoriasSnap = await getDocs(collectionGroup(db, 'vitorias'));
      const vitorias = vitoriasSnap.docs
        .map(d => ({ id: d.id, uid: d.ref.path.split('/')[1], ...d.data() }));

      setUsuarios(users);
      setTodosCheckins(checkins);
      setTodasVitorias(vitorias);
      setErro('');
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar os dados.');
    }
    setCarregando(false);
    setAtualizando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (carregando) {
    return <div className="loading-state"><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando dados...</div>;
  }

  return (
    <>
      <div className="subtabs">
        {ABAS.map(t => (
          <button key={t.id} className={`subtab ${aba === t.id ? 'active' : ''}`} onClick={() => setAba(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="screen-content">
        <div className="screen-header-row">
          <div>
            <h1 className="screen-title">{aba === 'geral' ? 'Visão Geral' : aba === 'usuarios' ? `Usuárias (${usuarios.length})` : ABAS.find(a => a.id === aba).label}</h1>
            <p className="screen-sub">Dados de check-ins e vitórias de todas as usuárias (administradoras não entram na conta).</p>
          </div>
          <button className="btn-ghost" onClick={carregar} disabled={atualizando}>
            {atualizando ? 'Atualizando...' : 'Atualizar dados'}
          </button>
        </div>

        {erro && (
          <div className="aln-erro">
            <IconAlert size={16} />
            <span>Não foi possível carregar os dados: {erro}</span>
          </div>
        )}

        {aba === 'geral' && <VisaoGeral usuarios={usuarios} todosCheckins={todosCheckins} todasVitorias={todasVitorias} />}
        {aba === 'funil' && <AbaFunil usuarios={usuarios} todosCheckins={todosCheckins} />}
        {aba === 'emocoes' && <AbaEmocoes todosCheckins={todosCheckins} />}
        {aba === 'usuarios' && <AbaUsuarios usuarios={usuarios} todosCheckins={todosCheckins} todasVitorias={todasVitorias} />}
        {aba === 'empresas' && <AbaEmpresas usuarios={usuarios} />}
      </div>
    </>
  );
}
