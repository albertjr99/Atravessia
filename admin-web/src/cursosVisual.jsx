import React, { useEffect, useRef, useState } from 'react';

// Logotipo (ginkgo), servido de /public.
function Logo({ size = 40 }) {
  return <img className="cz-logo" src="/travessia_logo.png" alt="Logotipo Atravessia" width={size} height={size} />;
}

// Cursos Atravessia — peças visuais da área web da aluna (curso.html) e do
// portal do profissional (profissional.html). Este arquivo não fala com o
// Firebase: recebe os dados prontos (ver CursoAluna.jsx e PortalProfissional.jsx),
// o que também permite gerar prévias com dados de exemplo.

export const brl = (reais) => Number(reais || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brlC = (centavos) => brl((Number(centavos) || 0) / 100);
export const dataBR = (ms) => (ms ? new Date(ms).toLocaleDateString('pt-BR') : '—');
export const thumbAula = (a) => a?.thumb || (a?.youtubeId ? `https://i.ytimg.com/vi/${a.youtubeId}/hqdefault.jpg` : '');
// Aulas pagas de cursos protegidos vêm sem youtubeId (ele fica em
// cursosConteudo/{id}, que só quem comprou lê): a lista usa o id da aula.
export const aulasOrdenadas = (c) => [...(c?.aulas || [])]
  .filter(a => a && (a.id || a.youtubeId))
  .map(a => (a.id ? a : { ...a, id: a.youtubeId }))
  .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
export const capaCurso = (c) => c?.capaUrl || thumbAula(aulasOrdenadas(c).find(a => thumbAula(a)));
export const URL_TERMOS = 'https://o-amor-que-fica.web.app/termos.html';
export function mesclarConteudo(curso, conteudo) {
  if (!curso || !conteudo?.aulas) return curso;
  return {
    ...curso,
    aulas: (curso.aulas || []).map(a => {
      const extra = conteudo.aulas[a.id];
      return extra?.youtubeId ? { ...a, youtubeId: a.youtubeId || extra.youtubeId, thumb: a.thumb || extra.thumb } : a;
    }),
  };
}
export function progressoCurso(curso, acesso) {
  const aulas = aulasOrdenadas(curso);
  return aulas.length ? aulas.filter(a => acesso?.progresso?.[a.id]).length / aulas.length : 0;
}

// ---- Ícones (traço fino, combinando com o painel) --------------------------
const I = {
  play: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>,
  cadeado: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  ok: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z" /></svg>,
  seta: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  voltar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>,
  escudo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>,
};

export function Topo({ subtitulo = 'Cursos', usuario, onSair, onInicio }) {
  return (
    <header className="cz-topo">
      <button type="button" className="cz-marca" onClick={onInicio} aria-label="Início">
        <Logo size={38} />
        <span className="cz-marca-nome">Atravessia</span>
        <span className="cz-marca-sub">{subtitulo}</span>
      </button>
      {usuario && (
        <div className="cz-usuario">
          <span className="cz-usuario-nome">{usuario}</span>
          {onSair && <button type="button" className="cz-link" onClick={onSair}>Sair</button>}
        </div>
      )}
    </header>
  );
}

export function Barra({ valor = 0 }) {
  return <div className="cz-barra" role="progressbar" aria-valuenow={Math.round(valor * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.round(valor * 100)}%` }} /></div>;
}

export function Thumb({ src, play = true, grande = false, bloqueado = false, children }) {
  return (
    <div className={`cz-thumb ${grande ? 'cz-thumb-grande' : ''}`}>
      {src ? <img src={src} alt="" loading="lazy" /> : <div className="cz-thumb-vazia" />}
      <div className="cz-thumb-veu" />
      {play && <span className={`cz-play ${bloqueado ? 'cz-play-bloq' : ''}`}>{bloqueado ? I.cadeado : I.play}</span>}
      {children}
    </div>
  );
}

export function CardCurso({ curso, prof, acesso, onAbrir }) {
  const total = aulasOrdenadas(curso).length;
  const prog = progressoCurso(curso, acesso);
  return (
    <button type="button" className="cz-card" onClick={onAbrir}>
      <Thumb src={capaCurso(curso)}>
        <span className="cz-selo">{total} {total === 1 ? 'aula' : 'aulas'}</span>
        {acesso && <span className="cz-selo cz-selo-meu">Seu curso</span>}
      </Thumb>
      <span className="cz-card-corpo">
        <span className="cz-card-tit">{curso.titulo}</span>
        {prof?.nome && <span className="cz-card-prof">com {prof.nome}</span>}
        {acesso ? (
          <span className="cz-card-prog"><Barra valor={prog} /><small>{prog >= 1 ? 'Concluído 💜' : prog > 0 ? `${Math.round(prog * 100)}% concluído` : 'Comece quando quiser'}</small></span>
        ) : <span className="cz-card-preco">{brl(curso.preco)}</span>}
      </span>
    </button>
  );
}

export function Vitrine({ cursos, meus = {}, profs = {}, onAbrir, nome }) {
  const meusCursos = cursos.filter(c => meus[c.id]);
  const outros = cursos.filter(c => !meus[c.id]);
  return (
    <div className="cz-pagina">
      <section className="cz-hero">
        <span className="cz-sobre">Cursos</span>
        <h1 className="cz-hero-marca">Atravessia</h1>
        <p>{nome ? `Que bom ter você aqui, ${nome}. ` : ''}Aulas em vídeo com profissionais que cuidam com carinho. Assista no seu ritmo, quantas vezes quiser.</p>
      </section>
      {meusCursos.length > 0 && (
        <>
          <h2 className="cz-secao">Meus cursos</h2>
          <div className="cz-grade">{meusCursos.map(c => <CardCurso key={c.id} curso={c} prof={profs[c.profissionalId]} acesso={meus[c.id]} onAbrir={() => onAbrir(c)} />)}</div>
        </>
      )}
      {outros.length > 0 && (
        <>
          <h2 className="cz-secao">{meusCursos.length ? 'Descubra mais cursos' : 'Cursos disponíveis'}</h2>
          <div className="cz-grade">{outros.map(c => <CardCurso key={c.id} curso={c} prof={profs[c.profissionalId]} onAbrir={() => onAbrir(c)} />)}</div>
        </>
      )}
      {cursos.length === 0 && <p className="cz-vazio">Os primeiros cursos estão sendo preparados com carinho. Volte em breve!</p>}
    </div>
  );
}

// Página do curso (para quem ainda não comprou, ou como visão geral).
export function PaginaCurso({ curso, prof, acesso, onAula, onComprar, comprando, onVoltar, aviso }) {
  const aulas = aulasOrdenadas(curso);
  const prog = progressoCurso(curso, acesso);
  const proxima = aulas.find(a => !acesso?.progresso?.[a.id]) || aulas[0];
  const amostra = aulas.find(a => a.gratis);
  return (
    <div className="cz-pagina">
      {onVoltar && <button type="button" className="cz-voltar" onClick={onVoltar}>{I.voltar} Todos os cursos</button>}
      <section className="cz-curso-heroi">
        <button type="button" className="cz-curso-capa" onClick={() => (acesso ? onAula(proxima) : amostra && onAula(amostra))} aria-label="Assistir">
          <Thumb src={capaCurso(curso)} grande play={!!(acesso || amostra)} />
        </button>
        <div className="cz-curso-info">
          <span className="cz-sobre">Curso</span>
          <h1>{curso.titulo}</h1>
          {curso.subtitulo && <p className="cz-curso-sub">{curso.subtitulo}</p>}
          <div className="cz-metas"><span>{aulas.length} aulas</span><span>Acesso sem prazo</span><span>App e computador</span></div>
          {prof && (
            <div className="cz-prof">
              {prof.fotoUrl ? <img src={prof.fotoUrl} alt="" /> : <span className="cz-prof-ini">{(prof.nome || 'A')[0]}</span>}
              <div><small>Com</small><strong>{prof.nome}</strong></div>
            </div>
          )}
          {acesso ? (
            <div className="cz-acao">
              <Barra valor={prog} />
              <small>{Math.round(prog * 100)}% concluído</small>
              <button type="button" className="cz-btn" onClick={() => onAula(proxima)}>{prog > 0 ? 'Continuar de onde parei' : 'Começar o curso'} {I.seta}</button>
            </div>
          ) : (
            <div className="cz-acao">
              <button type="button" className="cz-btn" onClick={onComprar} disabled={comprando}>{comprando ? 'Abrindo pagamento…' : `Comprar curso — ${brl(curso.preco)}`}</button>
              <small>Pagamento seguro pela Stripe. O acesso é liberado assim que o pagamento é confirmado.</small>
              <p className="cz-nota-privacidade">
                <span aria-hidden="true">{I.escudo}</span>
                <span>
                  Registramos as aulas que você conclui só para mostrar o seu avanço. Quem conduz o curso não recebe seu nome, e-mail
                  nem outros dados pessoais. Ao comprar, você concorda com os <a href={URL_TERMOS} target="_blank" rel="noreferrer">Termos de Uso</a>.
                </span>
              </p>
              {aviso && <p className="cz-aviso">{aviso}</p>}
            </div>
          )}
        </div>
      </section>

      <div className="cz-duas">
        <div className="cz-col">
          {curso.descricao && <section className="cz-cartao"><h2>Sobre o curso</h2><p className="cz-texto">{curso.descricao}</p></section>}
          {prof?.bio && <section className="cz-cartao cz-cartao-joia"><h2>Quem conduz</h2><p className="cz-texto">{prof.bio}</p></section>}
          {(curso.programa || []).length > 0 && (
            <section className="cz-cartao">
              <h2>Conteúdo programático</h2>
              {curso.programa.map((p, i) => (
                <details key={i} className="cz-modulo">
                  <summary><span>{p.titulo || `Módulo ${i + 1}`}</span><i aria-hidden="true" /></summary>
                  <p className="cz-texto">{p.descricao}</p>
                </details>
              ))}
            </section>
          )}
        </div>
        <section className="cz-cartao cz-aulas">
          <h2>Aulas</h2>
          <ListaAulas aulas={aulas} acesso={acesso} onAula={onAula} />
        </section>
      </div>
    </div>
  );
}

export function ListaAulas({ aulas, acesso, atualId, onAula }) {
  return (
    <ol className="cz-lista">
      {aulas.map((a, i) => {
        const aberta = !!acesso || a.gratis;
        const feita = !!acesso?.progresso?.[a.id];
        return (
          <li key={a.id}>
            <button type="button" className={`cz-item ${a.id === atualId ? 'cz-item-atual' : ''}`} onClick={() => onAula(a)}>
              <span className="cz-item-thumb">{thumbAula(a) ? <img src={thumbAula(a)} alt="" loading="lazy" /> : <span className="cz-thumb-vazia" />}{(!aberta || a.id === atualId) && <span className="cz-item-veu">{aberta ? I.play : I.cadeado}</span>}</span>
              <span className="cz-item-txt">
                <small>Aula {i + 1}{a.duracao ? ` · ${a.duracao}` : ''}{a.gratis && !acesso ? ' · grátis' : ''}</small>
                <span>{a.titulo}</span>
              </span>
              {feita && <span className="cz-item-ok">{I.ok}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// Player do YouTube (youtube-nocookie, sem vídeos relacionados de outros
// canais). Mostra a capa até o clique, e avisa quando o vídeo termina.
let apiYoutube = null;
function carregarApiYoutube() {
  if (apiYoutube) return apiYoutube;
  apiYoutube = new Promise((resolve) => {
    if (window.YT?.Player) { resolve(window.YT); return; }
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { anterior?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return apiYoutube;
}

export function PlayerYoutube({ videoId, poster, onTerminou, iniciar = false }) {
  const [tocando, setTocando] = useState(iniciar);
  const alvo = useRef(null);
  const terminou = useRef(onTerminou);
  terminou.current = onTerminou;
  useEffect(() => { setTocando(iniciar); }, [videoId, iniciar]);
  useEffect(() => {
    if (!tocando || !alvo.current) return undefined;
    let player = null;
    let vivo = true;
    carregarApiYoutube().then((YT) => {
      if (!vivo || !alvo.current) return;
      player = new YT.Player(alvo.current, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, hl: 'pt-BR', cc_lang_pref: 'pt' },
        events: { onStateChange: (e) => { if (e.data === 0) terminou.current?.(); } },
      });
    });
    return () => { vivo = false; try { player?.destroy(); } catch { /* já removido */ } };
  }, [tocando, videoId]);
  return (
    <div className="cz-player">
      {tocando ? <div ref={alvo} className="cz-player-frame" /> : (
        <button type="button" className="cz-player-capa" onClick={() => setTocando(true)} aria-label="Assistir à aula">
          <Thumb src={poster} grande />
        </button>
      )}
    </div>
  );
}

export function TelaAula({ curso, aula, acesso, onAula, onConcluir, onVoltar, iniciar, carregandoVideo = false }) {
  const aulas = aulasOrdenadas(curso);
  const idx = aulas.findIndex(a => a.id === aula.id);
  const proxima = aulas[idx + 1];
  const feita = !!acesso?.progresso?.[aula.id];
  const prog = progressoCurso(curso, acesso);
  return (
    <div className="cz-pagina cz-pagina-aula">
      <button type="button" className="cz-voltar" onClick={onVoltar}>{I.voltar} {curso.titulo}</button>
      <div className="cz-aula">
        <div className="cz-aula-principal">
          {aula.youtubeId ? (
            <PlayerYoutube videoId={aula.youtubeId} poster={thumbAula(aula)} iniciar={iniciar} onTerminou={() => acesso && onConcluir(aula, true)} />
          ) : (
            <div className="cz-player cz-player-msg">
              {carregandoVideo ? <div className="cz-spinner" /> : <p>Não conseguimos carregar esta aula agora. Confira sua conexão e recarregue a página.</p>}
            </div>
          )}
          <section className="cz-cartao cz-aula-info">
            <small className="cz-sobre">Aula {idx + 1} de {aulas.length}{aula.duracao ? ` · ${aula.duracao}` : ''}</small>
            <h1>{aula.titulo}</h1>
            <div className="cz-aula-acoes">
              {acesso ? (
                <button type="button" className={`cz-btn-sec ${feita ? 'cz-btn-feita' : ''}`} onClick={() => onConcluir(aula, !feita)}>
                  {I.ok} {feita ? 'Concluída' : 'Marcar como concluída'}
                </button>
              ) : aula.gratis && <span className="cz-selo-gratis">Aula grátis de amostra</span>}
              {proxima && <button type="button" className="cz-btn" onClick={() => onAula(proxima)}>Próxima aula {I.seta}</button>}
            </div>
          </section>
        </div>
        <aside className="cz-cartao cz-aula-lado">
          <h2>Aulas do curso</h2>
          {acesso && <div className="cz-acao"><Barra valor={prog} /><small>{Math.round(prog * 100)}% concluído</small></div>}
          <ListaAulas aulas={aulas} acesso={acesso} atualId={aula.id} onAula={onAula} />
        </aside>
      </div>
    </div>
  );
}

// ---- Portal do profissional ---------------------------------------------------
const STATUS = { ativa: 'Paga', reembolsada: 'Reembolsada' };
const regraTxt = (r) => (!r ? '—' : r.tipo === 'fixo' ? `${brl(r.valor)} por venda` : `${r.valor}% ${r.base === 'liquido' ? 'do valor após a taxa da Stripe' : 'do valor pago'}`);

export function Extrato({ dados }) {
  const { profissional: p, resumo: r } = dados;
  return (
    <div className="cz-pagina">
      <section className="cz-hero cz-hero-portal">
        <span className="cz-sobre">Portal do profissional</span>
        <h1>Olá, {p.nome}</h1>
        <p>Acompanhe aqui as vendas dos seus cursos e os repasses. Repasse combinado: <strong>{regraTxt({ tipo: p.repasseTipo, valor: p.repasseValor, base: p.repasseBase })}</strong>.</p>
      </section>

      <div className="cz-confianca">
        <span className="cz-confianca-icone">{I.escudo}</span>
        <p>Cada venda tem um código de verificação do pagamento na Stripe. Os valores são calculados no momento da venda e não podem ser alterados.</p>
      </div>

      <div className="cz-numeros">
        <div><strong>{r.vendas}</strong><small>vendas</small></div>
        <div><strong>{brlC(r.brutoCentavos)}</strong><small>valor pago pelas alunas</small></div>
        <div className="cz-num-destaque"><strong>{brlC(r.repasseCentavos)}</strong><small>seu repasse total</small></div>
        <div><strong>{brlC(r.recebidoCentavos)}</strong><small>já repassado</small></div>
        <div><strong>{brlC(Math.max(0, r.aReceberCentavos))}</strong><small>a receber</small></div>
      </div>

      <h2 className="cz-secao">Por curso</h2>
      <div className="cz-cartao cz-tabela-wrap">
        <table className="cz-tabela">
          <thead><tr><th>Curso</th><th>Vendas</th><th>Reembolsos</th><th>Valor pago</th><th>Repasse</th></tr></thead>
          <tbody>
            {dados.porCurso.length === 0 && <tr><td colSpan={5} className="cz-vazio">Ainda não há vendas.</td></tr>}
            {dados.porCurso.map(c => (
              <tr key={c.cursoId}><td>{c.curso}</td><td>{c.ativas}</td><td>{c.reembolsadas}</td><td>{brlC(c.brutoCentavos)}</td><td><strong>{brlC(c.repasseCentavos)}</strong></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="cz-secao">Vendas</h2>
      <div className="cz-cartao cz-tabela-wrap">
        <table className="cz-tabela">
          <thead><tr><th>Data</th><th>Curso</th><th>Valor</th><th>Taxa Stripe</th><th>Repasse</th><th>Situação</th><th>Código</th></tr></thead>
          <tbody>
            {dados.vendas.length === 0 && <tr><td colSpan={7} className="cz-vazio">Ainda não há vendas.</td></tr>}
            {dados.vendas.map((v, i) => (
              <tr key={i} className={v.status === 'reembolsada' ? 'cz-riscada' : ''}>
                <td>{dataBR(v.data)}</td><td>{v.curso}</td><td>{brlC(v.valorCentavos)}</td>
                <td>{v.taxaStripeCentavos == null ? '—' : brlC(v.taxaStripeCentavos)}</td>
                <td><strong>{brlC(v.repasseCentavos)}</strong>{v.regra?.taxaIndisponivel && <small className="cz-obs" title="A taxa da Stripe não estava disponível na hora da venda; o repasse foi calculado sobre o valor pago."> sobre o valor pago*</small>}</td>
                <td><span className={`cz-status cz-status-${v.status}`}>{STATUS[v.status] || v.status}{v.repassada ? ' · repassada' : ''}</span></td>
                <td><code>{v.codigo || '—'}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="cz-secao">Repasses recebidos</h2>
      <div className="cz-cartao cz-tabela-wrap">
        <table className="cz-tabela">
          <thead><tr><th>Período</th><th>Vendas</th><th>Pago em</th><th>Valor</th><th>Comprovante</th></tr></thead>
          <tbody>
            {dados.repasses.length === 0 && <tr><td colSpan={5} className="cz-vazio">Nenhum repasse registrado ainda.</td></tr>}
            {dados.repasses.map((r2, i) => (
              <tr key={i}><td>{r2.periodo}</td><td>{r2.vendas}</td><td>{dataBR(r2.pagoEm)}</td><td><strong>{brlC(r2.totalCentavos)}</strong></td>
                <td>{r2.comprovanteUrl ? <a href={r2.comprovanteUrl} target="_blank" rel="noreferrer">Ver</a> : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cz-rodape-nota">Os nomes e e-mails das alunas não aparecem aqui, por privacidade. Para conferir uma venda, informe o código à equipe Atravessia: ele corresponde ao pagamento registrado na Stripe. Extrato gerado em {new Date(dados.geradoEm || Date.now()).toLocaleString('pt-BR')}.</p>
      {dados.termo?.aceitoEm && (
        <p className="cz-rodape-nota" style={{ marginTop: 8 }}>
          Termo de parceria aceito em {dataBR(dados.termo.aceitoEm)} (versão {dados.termo.versao}). Este link é pessoal: não o compartilhe.
        </p>
      )}
    </div>
  );
}
