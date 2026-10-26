import React, { useEffect, useState } from 'react';
import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { Topo, Extrato } from './cursosVisual';

// Portal do profissional — profissional.html?t=<token>. Sem login: o token
// (gerado no servidor) identifica o profissional. A função portalProfissional
// devolve só dados agregados e anônimos (sem nome nem e-mail das alunas).
export default function PortalProfissional() {
  const token = new URLSearchParams(window.location.search).get('t') || '';
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!token) { setErro('Link incompleto. Abra o link exatamente como a equipe Atravessia enviou.'); return; }
    httpsCallable(functions, 'portalProfissional')({ token })
      .then(({ data }) => setDados(data))
      .catch((e) => setErro(e?.message || 'Não foi possível carregar o extrato agora. Tente de novo em instantes.'));
  }, [token]);

  return (
    <div className="cz-app">
      <Topo subtitulo="Profissionais" />
      {erro ? (
        <div className="cz-login"><div className="cz-cartao"><p className="cz-erro" style={{ margin: 0 }}>{erro}</p></div></div>
      ) : !dados ? (
        <div className="cz-centro"><div className="cz-spinner" /></div>
      ) : <Extrato dados={dados} />}
    </div>
  );
}
