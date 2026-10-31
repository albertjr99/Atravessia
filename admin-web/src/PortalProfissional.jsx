import React, { useCallback, useEffect, useState } from 'react';
import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { Topo, Extrato } from './cursosVisual';
import { TERMO_VERSAO, TERMO_DATA, TERMO_RESUMO, TERMO_SECOES } from './termoProfissional';

// Portal do profissional — profissional.html?t=<token>. Sem login: o token
// (gerado no servidor) identifica o profissional. A função portalProfissional
// devolve só dados agregados e anônimos (sem nome nem e-mail das alunas).
// No primeiro acesso (ou quando o termo muda), mostra o Termo de Parceria e
// só exibe o extrato depois do aceite, registrado por aceitarTermoProfissional.

function TermoAceite({ nome, versaoAceita, token, onAceito }) {
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const aceitar = async () => {
    setEnviando(true); setErro('');
    try {
      await httpsCallable(functions, 'aceitarTermoProfissional')({ token, versao: TERMO_VERSAO, aceito: true });
      onAceito();
    } catch (e) {
      setErro(e?.message || 'Não foi possível registrar o aceite agora. Tente de novo em instantes.');
      setEnviando(false);
    }
  };
  return (
    <div className="cz-pagina cz-termo">
      <section className="cz-hero cz-hero-portal">
        <span className="cz-sobre">Portal do profissional</span>
        <h1>{nome ? `Boas-vindas, ${nome}` : 'Boas-vindas'}</h1>
        <p>{versaoAceita
          ? `O termo de parceria foi atualizado (você tinha aceitado a versão ${versaoAceita}). Leia a nova versão para voltar ao seu extrato.`
          : 'Antes de ver o seu extrato, leia com calma o termo da nossa parceria. Ele explica como cuidamos dos seus dados e dos dados das alunas.'}</p>
      </section>

      <section className="cz-cartao cz-termo-resumo">
        <h2>Em poucas palavras</h2>
        <ul>{TERMO_RESUMO.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </section>

      <section className="cz-cartao">
        <h2>Termo completo <small className="cz-termo-versao">versão {TERMO_VERSAO} · {TERMO_DATA}</small></h2>
        <div className="cz-termo-texto" tabIndex={0} aria-label="Texto completo do termo">
          {TERMO_SECOES.map(s => (
            <div key={s.titulo}>
              <h3>{s.titulo}</h3>
              {s.paragrafos.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ))}
        </div>
        <label className="cz-termo-check">
          <input type="checkbox" checked={marcado} onChange={e => setMarcado(e.target.checked)} />
          <span>Li e aceito o Termo de Parceria, Consentimento e Tratamento de Dados (versão {TERMO_VERSAO}).</span>
        </label>
        {erro && <p className="cz-erro">{erro}</p>}
        <button type="button" className="cz-btn" disabled={!marcado || enviando} onClick={aceitar}>
          {enviando ? 'Registrando…' : 'Aceitar e ver meu extrato'}
        </button>
        <p className="cz-rodape-nota" style={{ textAlign: 'left', margin: '14px 0 0' }}>
          Guardamos a data do aceite, a versão e um registro resumido do acesso (parte do IP e o tipo de navegador), só para comprovar o aceite.
        </p>
      </section>
    </div>
  );
}

export default function PortalProfissional() {
  const token = new URLSearchParams(window.location.search).get('t') || '';
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => {
    if (!token) { setErro('Link incompleto. Abra o link exatamente como a equipe Atravessia enviou.'); return; }
    setDados(null);
    httpsCallable(functions, 'portalProfissional')({ token })
      .then(({ data }) => setDados(data))
      .catch((e) => setErro(e?.message || 'Não foi possível carregar o extrato agora. Tente de novo em instantes.'));
  }, [token]);
  useEffect(() => { carregar(); }, [carregar]);

  let conteudo;
  if (erro) conteudo = <div className="cz-login"><div className="cz-cartao"><p className="cz-erro" style={{ margin: 0 }}>{erro}</p></div></div>;
  else if (!dados) conteudo = <div className="cz-centro"><div className="cz-spinner" /></div>;
  else if (dados.precisaAceite) {
    conteudo = <TermoAceite nome={dados.profissional?.nome} versaoAceita={dados.termo?.versaoAceita} token={token} onAceito={carregar} />;
  } else conteudo = <Extrato dados={dados} />;

  return (
    <div className="cz-app">
      <Topo subtitulo="Profissionais" />
      {conteudo}
    </div>
  );
}
