import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { Logo } from './Icons';
import { urlDeImagem } from './parceriaUtils';
import {
  STATUS_LEAD, TODOS_STATUS, brl, dataTexto, linkWhatsapp, numero, regraTexto,
} from './imoveisUtils';

// Portal da imobiliária — imobiliaria.html?t=<token> (sem login). O token,
// gerado no servidor, identifica a imobiliária e fica guardado neste
// navegador; assim, ao escanear o QR Code da cliente
// (imobiliaria.html?c=<código>&v=<verificador>), o código já é validado.
// Só aparecem nome e telefone de quem autorizou o compartilhamento (LGPD).
// Funções: portalImobiliaria e atualizarLeadImobiliaria (functions/index.js).

const CHAVE_TOKEN = 'atravessia-imobiliaria-token';
const TRANSICOES = {
  novo: ['em_contato', 'visita', 'proposta', 'fechado', 'perdido'],
  em_contato: ['visita', 'proposta', 'fechado', 'perdido'],
  visita: ['em_contato', 'proposta', 'fechado', 'perdido'],
  proposta: ['em_contato', 'visita', 'fechado', 'perdido'],
  perdido: ['em_contato'],
};
const ROTULO_ACAO = {
  em_contato: 'Em contato', visita: 'Visita marcada/feita', proposta: 'Proposta em andamento',
  fechado: 'Negócio fechado', perdido: 'Não seguiu (encerrar)',
};

function lerToken() {
  const p = new URLSearchParams(window.location.search);
  const t = p.get('t');
  try {
    if (t) localStorage.setItem(CHAVE_TOKEN, t);
    return t || localStorage.getItem(CHAVE_TOKEN) || '';
  } catch { return t || ''; }
}

function Etiqueta({ status }) {
  const i = STATUS_LEAD[status] || STATUS_LEAD.novo;
  return <span className={`imv-etq imv-tom-${i.tom}`}>{i.curto}</span>;
}

function previsaoRepasse(regra, interesse, valor) {
  const r = interesse === 'alugar' ? regra?.aluguel : regra?.venda;
  if (!r || !Number(r.valor)) return null;
  return r.tipo === 'percentual' ? valor * Number(r.valor) / 100 : Number(r.valor);
}

function CartaoLead({ lead, regra, token, onAtualizado, destacado }) {
  const [acao, setAcao] = useState('');
  const [valor, setValor] = useState('');
  const [comprovante, setComprovante] = useState('');
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const opcoes = TRANSICOES[lead.status] || [];

  const enviar = async (dados) => {
    setEnviando(true); setErro('');
    try {
      await httpsCallable(functions, 'atualizarLeadImobiliaria')({ token, leadId: lead.id, ...dados });
      setAcao(''); setValor(''); setComprovante(''); setObs('');
      onAtualizado();
    } catch (e) {
      setErro(e?.message || 'Não foi possível salvar agora. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const escolher = (s) => {
    if (!s) return;
    if (s === 'fechado') { setAcao('fechado'); return; }
    if (s === 'perdido' && !window.confirm('Encerrar esta indicação? A cliente será avisada com delicadeza.')) return;
    enviar({ acao: 'status', status: s });
  };
  const prev = previsaoRepasse(regra, lead.interesse, numero(valor));

  return (
    <article className={`card imv-card ${destacado ? 'imv-destaque' : ''}`} id={`lead-${lead.id}`}>
      <div className="imv-card-topo">
        <span className="imv-codigo">{lead.codigo}</span>
        <Etiqueta status={lead.status} />
      </div>
      {lead.consentiu ? (
        <div className="imv-nome">{lead.nome} · {lead.telefone}</div>
      ) : (
        <div className="imv-leg">Contato não compartilhado (a cliente não autorizou).</div>
      )}
      <div className="imv-leg">
        {lead.interesse === 'alugar' ? 'Quer alugar' : 'Quer comprar'}
        {lead.imovelTitulo ? ` · ${lead.imovelTitulo}` : ''}
        {lead.faixaPreco ? ` · ${lead.faixaPreco}` : ''}
        {lead.prazo ? ` · ${lead.prazo}` : ''}
      </div>
      {lead.bairros && <div className="imv-leg">Bairros: {lead.bairros}</div>}
      {lead.observacoes && <div className="imv-leg">“{lead.observacoes}”</div>}
      <div className="imv-leg" style={{ fontSize: 12 }}>
        Recebida em {dataTexto(lead.criadoEm)}{lead.validadoEm ? ` · código validado em ${dataTexto(lead.validadoEm)}` : ' · código ainda não validado'}
      </div>

      {(lead.valorNegocio != null || lead.repasseConfirmado != null) && (
        <div className="imv-fin">
          {lead.valorNegocio != null && <span>Valor do negócio: <b>{brl(lead.valorNegocio)}</b></span>}
          {lead.repassePrevisto != null && <span>Repasse à Atravessia: <b>{brl(lead.repassePrevisto)}</b></span>}
          {lead.repasseEnviadoEm && <span>Você informou o envio em {dataTexto(lead.repasseEnviadoEm)}. Aguardando confirmação da Atravessia.</span>}
          {lead.repasseConfirmado != null && <span>Repasse confirmado pela Atravessia em {dataTexto(lead.pagoEm)}. Obrigada!</span>}
          {lead.beneficioEntregue && <span>Consultoria da cliente concluída.</span>}
        </div>
      )}

      <div className="imv-acoes">
        {lead.consentiu && lead.telefone && (
          <a className="btn-secondary" href={linkWhatsapp(lead.telefone, `Olá, ${lead.nome}! Recebemos sua indicação pela Atravessia (código ${lead.codigo}).`)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        )}
        {opcoes.length > 0 && (
          <select value="" onChange={(e) => escolher(e.target.value)} disabled={enviando} aria-label="Atualizar etapa">
            <option value="">Atualizar etapa…</option>
            {opcoes.map(s => <option key={s} value={s}>{ROTULO_ACAO[s]}</option>)}
          </select>
        )}
        {lead.status === 'fechado' && !lead.repasseEnviadoEm && (
          <button type="button" className="btn-primary" onClick={() => setAcao('repasse')} disabled={enviando}>Informar repasse enviado</button>
        )}
        {lead.status === 'fechado' && (
          <button type="button" className="btn-ghost" onClick={() => { setValor(String(lead.valorNegocio || '').replace('.', ',')); setAcao('fechado'); }} disabled={enviando}>Corrigir valor</button>
        )}
      </div>

      {acao === 'fechado' && (
        <div className="imv-fin" style={{ marginTop: 12 }}>
          <div className="field-group" style={{ marginBottom: 8 }}>
            <label>{lead.interesse === 'alugar' ? 'Valor do aluguel mensal (R$)' : 'Valor da venda (R$)'}</label>
            <input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="Ex.: 450.000,00" autoFocus />
            {prev != null && numero(valor) > 0 && <span className="field-hint">Repasse à Atravessia pelo acordo: <b>{brl(prev)}</b></span>}
          </div>
          <div className="imv-acoes" style={{ marginTop: 0 }}>
            <button type="button" className="btn-ghost" onClick={() => setAcao('')}>Cancelar</button>
            <button type="button" className="btn-primary" disabled={enviando || !(numero(valor) > 0)} onClick={() => enviar({ acao: 'status', status: 'fechado', valorNegocio: valor })}>
              {enviando ? 'Salvando…' : 'Confirmar negócio fechado'}
            </button>
          </div>
        </div>
      )}
      {acao === 'repasse' && (
        <div className="imv-fin" style={{ marginTop: 12 }}>
          <div className="field-group" style={{ marginBottom: 8 }}>
            <label>Link do comprovante <span className="aln-opcional">(opcional)</span></label>
            <input value={comprovante} onChange={e => setComprovante(e.target.value)} placeholder="https://…" inputMode="url" />
          </div>
          <div className="field-group" style={{ marginBottom: 8 }}>
            <label>Observação <span className="aln-opcional">(opcional)</span></label>
            <input value={obs} onChange={e => setObs(e.target.value)} maxLength={300} />
          </div>
          <div className="imv-acoes" style={{ marginTop: 0 }}>
            <button type="button" className="btn-ghost" onClick={() => setAcao('')}>Cancelar</button>
            <button type="button" className="btn-primary" disabled={enviando} onClick={() => enviar({ acao: 'repasseEnviado', comprovanteUrl: comprovante.trim(), observacao: obs })}>
              {enviando ? 'Enviando…' : 'Avisar a Atravessia'}
            </button>
          </div>
        </div>
      )}
      {erro && <div className="imv-erro">{erro}</div>}
    </article>
  );
}

export default function PortalImobiliaria() {
  const token = useMemo(lerToken, []);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [codigo, setCodigo] = useState(params.get('c') || '');
  const [validacao, setValidacao] = useState(null);
  const [validando, setValidando] = useState(false);
  const [filtro, setFiltro] = useState('abertos');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async (extra = {}) => {
    if (!token) { setErro('Para acessar, abra o link do portal que a equipe Atravessia enviou para a sua imobiliária.'); return null; }
    try {
      const { data } = await httpsCallable(functions, 'portalImobiliaria')({ token, ...extra });
      setDados(data);
      return data;
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar agora. Tente de novo em instantes.');
      return null;
    }
  }, [token]);

  const validar = useCallback(async (c, v) => {
    if (!c.trim()) return;
    setValidando(true);
    const d = await carregar({ codigo: c.trim(), v });
    setValidacao(d?.validacao || null);
    setValidando(false);
    if (d?.validacao?.ok) {
      setFiltro('todos'); setBusca('');
      setTimeout(() => document.getElementById(`lead-${d.validacao.leadId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }
  }, [carregar]);

  useEffect(() => {
    const c = params.get('c');
    if (c && token) validar(c, params.get('v') || '');
    else carregar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const termo = busca.trim().toUpperCase();
  const leads = (dados?.leads || []).filter(l => {
    if (filtro === 'abertos' && !['novo', 'em_contato', 'visita', 'proposta', 'fechado'].includes(l.status)) return false;
    if (filtro !== 'abertos' && filtro !== 'todos' && l.status !== filtro) return false;
    return !termo || l.codigo.includes(termo) || String(l.nome || '').toUpperCase().includes(termo);
  });

  let conteudo;
  if (erro && !dados) {
    conteudo = <div className="imv-bloco"><div className="imv-erro" style={{ marginTop: 0 }}>{erro}</div></div>;
  } else if (!dados) {
    conteudo = <div className="imv-centro"><div className="spinner" /></div>;
  } else {
    const r = dados.resumo || {};
    conteudo = (
      <>
        <section className="imv-bloco">
          <h2>Validar código da cliente</h2>
          <form className="imv-validar" onSubmit={(e) => { e.preventDefault(); validar(codigo, ''); }}>
            <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="ATR-IMV-XXXX" aria-label="Código de indicação" />
            <button type="submit" className="btn-primary" disabled={validando}>{validando ? 'Validando…' : 'Validar'}</button>
          </form>
          {validacao?.ok && (
            <div className="imv-ok">
              Código {validacao.codigo} confirmado{validacao.viaQr ? ' pelo QR Code' : ''}: esta cliente veio pela Atravessia.
              {validacao.jaValidado ? ' (já tinha sido validado antes.)' : ''}
            </div>
          )}
          {validacao && !validacao.ok && <div className="imv-erro">{validacao.mensagem}</div>}
          <p className="field-hint">Dica: ao escanear o QR Code da cliente com a câmera deste aparelho, o código é validado sozinho.</p>
        </section>

        <div className="imv-stats">
          <div className="card imv-stat"><b>{r.emAndamento || 0}</b><span>Em andamento</span></div>
          <div className="card imv-stat"><b>{r.fechados || 0}</b><span>Negócios fechados</span></div>
          <div className="card imv-stat"><b>{brl(r.aRepassar)}</b><span>A repassar à Atravessia</span></div>
          <div className="card imv-stat"><b>{brl(r.repassado)}</b><span>Já repassado</span></div>
        </div>

        <section className="imv-bloco">
          <h2>Como funciona o repasse</h2>
          <p className="imv-leg" style={{ marginTop: 0 }}>
            Venda: <b>{regraTexto(dados.regra?.venda)}</b> · Aluguel: <b>{regraTexto(dados.regra?.aluguel)}</b>
            {dados.regra?.prazoDias ? ` · em até ${dados.regra.prazoDias} dias após o pagamento do negócio` : ''}.
          </p>
          {dados.regra?.dadosPagamento && <p className="imv-leg">Para repassar: {dados.regra.dadosPagamento}</p>}
          <p className="imv-leg">
            Marque “Negócio fechado” com o valor quando o pagamento da cliente estiver confirmado. Depois do repasse, toque em
            “Informar repasse enviado”. A confirmação final é feita pela Atravessia, que então presenteia a cliente com uma
            consultoria online com arquiteto parceiro.
          </p>
        </section>

        <div className="imv-filtros">
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label htmlFor="imv-filtro">Mostrar</label>
            <select id="imv-filtro" value={filtro} onChange={e => setFiltro(e.target.value)}>
              <option value="abertos">Em andamento e fechados</option>
              <option value="todos">Todas ({dados.leads.length})</option>
              {TODOS_STATUS.map(s => <option key={s} value={s}>{STATUS_LEAD[s].curto}</option>)}
            </select>
          </div>
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label htmlFor="imv-busca">Buscar</label>
            <input id="imv-busca" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Código ou nome" />
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="imv-bloco"><p className="imv-leg" style={{ margin: 0 }}>Nenhuma indicação por aqui ainda.</p></div>
        ) : (
          <div className="imv-lista" style={{ marginTop: 12 }}>
            {leads.map(l => (
              <CartaoLead key={l.id} lead={l} regra={dados.regra} token={token} onAtualizado={() => carregar()}
                destacado={validacao?.ok && validacao.leadId === l.id} />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="imv-portal">
      <div className="imv-portal-in">
        <header className="imv-topo">
          <Logo size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="imv-marca">Atravessia</span>
            <h1>{dados?.imobiliaria?.nome ? `Portal · ${dados.imobiliaria.nome}` : 'Portal da imobiliária parceira'}</h1>
            <p>Indicações do programa Lar e recomeço</p>
          </div>
          {dados?.imobiliaria?.logoUrl && <img className="imv-logo" src={urlDeImagem(dados.imobiliaria.logoUrl)} alt="" />}
        </header>
        {conteudo}
        <p className="imv-rodape">
          Os dados das clientes são compartilhados só com autorização delas e servem apenas para este atendimento.
          Não compartilhe esses dados com terceiros. Dúvidas: fale com a equipe Atravessia.
        </p>
      </div>
    </div>
  );
}
