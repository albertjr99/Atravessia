import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { db, functions } from './firebase';
import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { IconAlert, IconChart, IconStar, IconUsers, IconSpark } from './Icons';
import { EMOCOES, emocaoPorId, nDiasAtras, formatDataBR } from './emocoes';
import { UFS, formatarCidade } from './parceriaUtils';
import { iconeVitoria } from './iconesVitoria';
import { calcularMetricasFunil, planoNumero } from './metricasFunil';
import Recolhivel from './Recolhivel';
import SeletorOpcoes from './SeletorOpcoes';

// Porte de oamorqueefica/src/screens/admin/AdminRelatoriosScreen.js
// Abas: Geral · Funil · Emoções · Usuárias · Empresas. Mesmos cálculos do app.

const PLANO_LABELS = ['Perceber', 'Acolher', 'Compreender', 'Evoluir'];
// Cores pelos tokens (--plano-*, acentos e paleta de emoções).
const PLANO_CORES = ['var(--plano-perceber)', 'var(--plano-acolher)', 'var(--plano-compreender)', 'var(--plano-evoluir)'];
const PLANO_CHAVES = ['perceber', 'acolher', 'compreender', 'evoluir'];
const PLANO_FUNDO = PLANO_CHAVES.map(k => `var(--plano-${k}-fundo)`);
const PLANO_TEXTO = PLANO_CHAVES.map(k => `var(--plano-${k}-texto)`);
const COR = {
  lav5: 'var(--cor-texto-marca)', lav4: 'var(--cor-primaria)', lav3: 'var(--lilas-300)',
  sage: 'var(--emo-empaz-dado)', sageFg: 'var(--acento-salvia-texto)', gold: 'var(--acento-dourado-tinta)',
  peach2: 'var(--acento-pessego-tinta)', rose: 'var(--emo-culpado-dado)', roseFg: 'var(--acento-pessego-texto)',
};

function MiniBar({ value, max, color, height = 8 }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div className="aln-minibar" style={{ height, borderRadius: height / 2 }}>
      <div style={{ width: `${pct}%`, background: color || COR.lav4, borderRadius: height / 2 }} />
    </div>
  );
}

// ─── Aba: Visão geral ─────────────────────────────────────────────
function VisaoGeral({ usuarios, todosCheckins, totalVitorias }) {
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
          { Icon: IconStar, value: totalVitorias ?? '—', label: 'Vitórias', color: COR.gold },
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
const FUNIL_CORES = [COR.lav3, COR.lav4, 'var(--plano-compreender)', COR.sage];

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

      <ResumoVitorias />
    </>
  );
}

// ─── Aba: Usuárias ────────────────────────────────────────────────
// Só totais por estado e cidade, para orientar a prospecção de parcerias.
// A consulta de emoções, check-ins e vitórias por pessoa foi retirada do
// painel de propósito: esses dados ficam só no banco.
function AbaUsuarios({ usuarios }) {
  const [uf, setUf] = useState('');
  const [buscaCidade, setBuscaCidade] = useState('');

  const comUf = usuarios.filter(u => /^[A-Z]{2}$/.test(String(u.estado || '')));
  const semLocal = usuarios.length - comUf.length;

  const porEstado = useMemo(() => {
    const m = {};
    comUf.forEach(u => { m[u.estado] = (m[u.estado] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [comUf]);
  const maxEstado = porEstado[0]?.[1] || 1;

  const porCidade = useMemo(() => {
    const m = {};
    comUf.filter(u => !uf || u.estado === uf).forEach(u => {
      const nome = formatarCidade(u.cidade) || '(cidade não informada)';
      const chave = `${nome} / ${u.estado}`;
      m[chave] = (m[chave] || 0) + 1;
    });
    const b = buscaCidade.trim().toLowerCase();
    return Object.entries(m)
      .filter(([c]) => !b || c.toLowerCase().includes(b))
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'pt-BR'));
  }, [comUf, uf, buscaCidade]);
  const maxCidade = porCidade[0]?.[1] || 1;
  const totalFiltro = uf ? comUf.filter(u => u.estado === uf).length : comUf.length;

  return (
    <>
      <div className="aln-usu-topo">
        <select value={uf} onChange={e => setUf(e.target.value)} aria-label="Estado" style={{ width: 'auto', minWidth: 190 }}>
          <option value="">Todos os estados</option>
          {UFS.map(e => <option key={e.uf} value={e.uf}>{e.nome} ({e.uf})</option>)}
        </select>
        <input
          className="aln-busca"
          type="search"
          placeholder="Filtrar cidade..."
          value={buscaCidade}
          onChange={e => setBuscaCidade(e.target.value)}
        />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="aln-eng-row">
          <div className="aln-eng-item"><div className="aln-eng-val">{totalFiltro}</div><div className="aln-eng-lbl">{uf ? `em ${uf}` : 'com estado informado'}</div></div>
          <div className="aln-eng-item"><div className="aln-eng-val">{porEstado.length}</div><div className="aln-eng-lbl">estados</div></div>
          <div className="aln-eng-item"><div className="aln-eng-val">{semLocal}</div><div className="aln-eng-lbl">sem localização</div></div>
        </div>
      </div>

      <div className="aln-rel-grid">
        <div className="card">
          <h3 className="card-title">Usuárias por estado</h3>
          {porEstado.length === 0 ? <p className="aln-vazio">Nenhuma usuária com estado informado ainda.</p> : porEstado.map(([sigla, qtd]) => (
            <div
              key={sigla}
              className="aln-bar-row"
              style={{ cursor: 'pointer', fontWeight: uf === sigla ? 700 : undefined }}
              onClick={() => setUf(uf === sigla ? '' : sigla)}
              title={UFS.find(e => e.uf === sigla)?.nome || sigla}
            >
              <span className="aln-bar-nome" style={{ width: 130 }}>{UFS.find(e => e.uf === sigla)?.nome || sigla}</span>
              <MiniBar value={qtd} max={maxEstado} color={uf === sigla ? COR.lav5 : COR.lav4} />
              <span className="aln-bar-count">{qtd}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="card-title">Usuárias por cidade{uf ? ` · ${uf}` : ''}</h3>
          {porCidade.length === 0 ? <p className="aln-vazio">Nenhuma cidade encontrada.</p> : porCidade.slice(0, 60).map(([cidade, qtd]) => (
            <div key={cidade} className="aln-bar-row">
              <span className="aln-bar-nome" style={{ width: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cidade}>{cidade}</span>
              <MiniBar value={qtd} max={maxCidade} color={COR.sage} />
              <span className="aln-bar-count">{qtd}</span>
            </div>
          ))}
          {porCidade.length > 60 && <p className="aln-vazio">Mostrando as 60 cidades com mais usuárias.</p>}
        </div>
      </div>
    </>
  );
}

// ─── Pequenas vitórias (agregado e anônimo, calculado no servidor) ─────
function IconeVitoriaMini({ id, size = 16 }) {
  if (id === 'create') return <IconStar size={size} style={{ color: COR.gold }} />;
  const { url, nome } = iconeVitoria(id);
  return (
    <span role="img" aria-label={nome} style={{
      display: 'inline-block', width: size, height: size, flexShrink: 0, backgroundColor: COR.gold,
      WebkitMask: `url(${url}) center / contain no-repeat`, mask: `url(${url}) center / contain no-repeat`,
    }} />
  );
}

const nomeIcone = (id) => (id === 'create' ? 'Escritas pelas usuárias' : iconeVitoria(id).nome);
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (m) => `${MESES[Number(m.slice(5, 7)) - 1] || m.slice(5, 7)}/${m.slice(2, 4)}`;

function ResumoVitorias() {
  const [periodo, setPeriodo] = useState('30');
  const [uf, setUf] = useState('');
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    httpsCallable(functions, 'relatorioVitoriasAdmin', { timeout: 120000 })({ periodo, estado: uf })
      .then(r => { if (vivo) { setDados(r.data); setErro(''); } })
      .catch(e => { if (vivo) setErro(e?.message || 'Não foi possível carregar as vitórias.'); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [periodo, uf]);

  const maxRank = dados?.ranking?.[0]?.qtd || 1;
  const maxIcone = dados?.porIcone?.[0]?.qtd || 1;
  const maxMes = Math.max(...(dados?.porMes || []).map(m => m.qtd), 1);
  const maxPalavra = dados?.palavras?.[0]?.qtd || 1;

  return (
    <>
      <h2 className="card-title" style={{ fontSize: 20, margin: '28px 0 6px' }}>Pequenas vitórias</h2>
      <p className="aln-funil-intro">
        Resumo anônimo do que as usuárias celebraram — para inspirar conteúdos e escolher parcerias e achados.
        Frases e palavras escritas pelas próprias usuárias só aparecem quando vieram de 2 ou mais pessoas.
      </p>
      <div className="filter-row" style={{ alignItems: 'center' }}>
        {[{ v: '30', l: '30 dias' }, { v: '90', l: '90 dias' }, { v: '365', l: '12 meses' }, { v: 'all', l: 'Tudo' }].map(p => (
          <button key={p.v} className={`chip ${periodo === p.v ? 'chip-active' : ''}`} onClick={() => setPeriodo(p.v)}>{p.l}</button>
        ))}
        <select value={uf} onChange={e => setUf(e.target.value)} aria-label="Estado" style={{ width: 'auto', minWidth: 170 }}>
          <option value="">Todos os estados</option>
          {UFS.map(e => <option key={e.uf} value={e.uf}>{e.nome} ({e.uf})</option>)}
        </select>
        {carregando && <span className="aln-ordem-lbl">Carregando...</span>}
      </div>

      {erro && <div className="aln-erro"><IconAlert size={16} /><span>{erro}</span></div>}

      {dados && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="aln-eng-row">
              <div className="aln-eng-item"><div className="aln-eng-val">{dados.total}</div><div className="aln-eng-lbl">vitórias no período</div></div>
              <div className="aln-eng-item"><div className="aln-eng-val">{dados.pessoas}</div><div className="aln-eng-lbl">pessoas registraram</div></div>
              <div className="aln-eng-item"><div className="aln-eng-val">{dados.outrasPersonalizadas}</div><div className="aln-eng-lbl">escritas únicas (ocultas)</div></div>
            </div>
          </div>

          <div className="aln-rel-grid">
            <div className="card">
              <h3 className="card-title">Vitórias mais registradas</h3>
              {dados.ranking.length === 0 ? <p className="aln-vazio">Nenhuma vitória nesse período.</p> : dados.ranking.map((r, i) => (
                <div key={r.label} style={{ marginBottom: 10 }}>
                  <div className="aln-emo-header">
                    <span className="aln-medalha">{i + 1}º</span>
                    <IconeVitoriaMini id={r.icone} />
                    <span className="aln-emo-label">{r.label}{r.tipo === 'personalizada' ? ' · escrita' : ''}</span>
                    <span className="aln-emo-qtd">{r.qtd}× · {r.pessoas} pessoa{r.pessoas !== 1 ? 's' : ''}</span>
                  </div>
                  <MiniBar value={r.qtd} max={maxRank} color={COR.gold} />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
              <div className="card">
                <h3 className="card-title">Por categoria (ícone)</h3>
                {dados.porIcone.length === 0 ? <p className="aln-vazio">Sem dados.</p> : dados.porIcone.map(c => (
                  <div key={c.icone} className="aln-bar-row">
                    <IconeVitoriaMini id={c.icone} />
                    <span className="aln-bar-nome" style={{ width: 150 }}>{nomeIcone(c.icone)}</span>
                    <MiniBar value={c.qtd} max={maxIcone} color={COR.peach2} />
                    <span className="aln-bar-count">{c.qtd}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <h3 className="card-title">Temas mais frequentes nos textos</h3>
                {dados.palavras.length === 0 ? <p className="aln-vazio">Ainda não há palavras repetidas por 2 ou mais pessoas.</p> : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'baseline' }}>
                    {dados.palavras.map(p => (
                      <span key={p.palavra} title={`${p.qtd}×`} style={{
                        fontSize: 12 + Math.round((p.qtd / maxPalavra) * 14),
                        fontWeight: p.qtd / maxPalavra > 0.5 ? 700 : 500,
                        color: p.qtd / maxPalavra > 0.5 ? COR.lav5 : 'var(--text-mid)',
                      }}>{p.palavra}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 className="card-title">Evolução por mês</h3>
            {dados.porMes.length === 0 ? <p className="aln-vazio">Sem dados.</p> : (
              <div className="aln-colunas" style={{ height: 110 + 34 }}>
                {dados.porMes.map(m => {
                  const h = m.qtd > 0 ? Math.max(Math.round((m.qtd / maxMes) * 110), 4) : 2;
                  return (
                    <div key={m.mes} className="aln-coluna" title={`${rotuloMes(m.mes)}: ${m.qtd} vitória(s)`}>
                      {m.qtd > 0 && <span className="aln-coluna-val">{m.qtd}</span>}
                      <div className="aln-coluna-barra" style={{ height: h, background: COR.gold }} />
                      <span className="aln-coluna-lbl">{rotuloMes(m.mes)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!uf && dados.porEstado.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 className="card-title">Vitórias por estado</h3>
              {dados.porEstado.map(e => (
                <div key={e.uf} className="aln-bar-row" style={{ cursor: e.uf !== '—' ? 'pointer' : undefined }} onClick={() => e.uf !== '—' && setUf(e.uf)}>
                  <span className="aln-bar-nome" style={{ width: 150 }}>{e.uf === '—' ? 'Sem estado' : (UFS.find(x => x.uf === e.uf)?.nome || e.uf)}</span>
                  <MiniBar value={e.qtd} max={dados.porEstado[0].qtd} color={COR.lav4} />
                  <span className="aln-bar-count">{e.qtd}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
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
          // A lista de pessoas de cada empresa fica recolhida; o cabeçalho mostra o total.
          <Recolhivel
            key={nome}
            titulo={nome}
            className="aln-rel-recolhivel"
            direita={<span className="badge badge-total">{users.length} usuária{users.length !== 1 ? 's' : ''}</span>}
          >
            {users.map(u => (
              <div key={u.id} className="aln-hist-row">
                <span className="aln-dot" style={{ background: PLANO_CORES[u.plano || 0] }} />
                <span className="aln-hist-label">{u.nome || u.email}</span>
                <span className="aln-hist-data">{PLANO_LABELS[u.plano || 0]}</span>
              </div>
            ))}
          </Recolhivel>
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
  const [totalVitorias, setTotalVitorias] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const usersSnap = await getDocs(collection(db, 'usuarios'));
      // O plano pode estar como número (app) ou texto (painel web).
      // Administradoras e contas inativas não entram nos números.
      const users = usersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role !== 'admin' && u.status !== 'inativa')
        .map(u => ({ ...u, plano: planoNumero(u.plano) }));
      const ativas = new Set(users.map(u => u.id));

      // Sem orderBy: collectionGroup com orderBy exige índice próprio e falha
      // inteira quando ele não existe. Ordena em memória. Os check-ins só
      // alimentam números agregados (nada é mostrado por pessoa).
      const checkinsSnap = await getDocs(collectionGroup(db, 'checkins'));
      const checkins = checkinsSnap.docs
        .map(d => ({ id: d.id, uid: d.ref.path.split('/')[1], ...d.data() }))
        .filter(c => ativas.has(c.uid))
        .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));

      setUsuarios(users);
      setTodosCheckins(checkins);
      setErro('');

      // Vitórias: só o total, calculado no servidor (os textos não saem do banco).
      httpsCallable(functions, 'relatorioVitoriasAdmin', { timeout: 120000 })({ periodo: 'all' })
        .then(r => setTotalVitorias(r.data?.total ?? null))
        .catch(() => setTotalVitorias(null));
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
      <SeletorOpcoes variante="abas" titulo="Relatório" opcoes={ABAS} valor={aba} onChange={setAba} />

      <div className="screen-content">
        <div className="screen-header-row">
          <div>
            <h1 className="screen-title">{aba === 'geral' ? 'Visão Geral' : aba === 'usuarios' ? `Usuárias (${usuarios.length})` : ABAS.find(a => a.id === aba).label}</h1>
            <p className="screen-sub">Números agregados e anônimos das usuárias ativas (administradoras e contas inativas não entram na conta).</p>
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

        {aba === 'geral' && <VisaoGeral usuarios={usuarios} todosCheckins={todosCheckins} totalVitorias={totalVitorias} />}
        {aba === 'funil' && <AbaFunil usuarios={usuarios} todosCheckins={todosCheckins} />}
        {aba === 'emocoes' && <AbaEmocoes todosCheckins={todosCheckins} />}
        {aba === 'usuarios' && <AbaUsuarios usuarios={usuarios} />}
        {aba === 'empresas' && <AbaEmpresas usuarios={usuarios} />}
      </div>
    </>
  );
}
