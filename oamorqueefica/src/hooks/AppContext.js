import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [usuario, setUsuario] = useState({
    nome: 'Ana',
    plano: 1,
    cadastrado: false,
  });

  const [checkins, setCheckins] = useState([
    { data: '2025-05-12', emocao: 'triste', intensidade: 3 },
    { data: '2025-05-13', emocao: 'ansioso', intensidade: 2 },
    { data: '2025-05-14', emocao: 'saudoso', intensidade: 4 },
    { data: '2025-05-15', emocao: 'esperancoso', intensidade: 2 },
    { data: '2025-05-16', emocao: 'triste', intensidade: 3 },
    { data: '2025-05-17', emocao: 'esperancoso', intensidade: 3 },
  ]);

  const [memorias, setMemorias] = useState([
    { id: 1, titulo: 'Nossa última primavera', tipo: 'texto', conteudo: 'Uma lembrança especial...', data: '2025-05-20' },
    { id: 2, titulo: 'O jardim que você amava', tipo: 'texto', conteudo: 'Cada flor me lembra de você...', data: '2025-05-22' },
  ]);

  const [vitorias, setVitorias] = useState([]);

  const [notificacoes] = useState([
    { id: 1, tipo: 'incentivo', texto: 'Você está se cuidando. Isso importa muito.', lida: false },
    { id: 2, tipo: 'live', texto: 'Nova live gratuita amanhã às 19h. Confirme presença!', lida: false },
    { id: 3, tipo: 'evolucao', texto: 'Percebemos mais registros de esperança esta semana.', lida: true },
  ]);

  const adicionarCheckin = (emocao, intensidade) => {
    const hoje = new Date().toISOString().split('T')[0];
    setCheckins(prev => [...prev, { data: hoje, emocao, intensidade }]);
  };

  const adicionarMemoria = (memoria) => {
    setMemorias(prev => [...prev, { ...memoria, id: Date.now() }]);
  };

  const adicionarVitoria = (vitoria) => {
    setVitorias(prev => [...prev, { ...vitoria, id: Date.now(), data: new Date().toISOString() }]);
  };

  const temAcesso = (planoNecessario) => usuario.plano >= planoNecessario;

  return (
    <AppContext.Provider value={{
      usuario, setUsuario,
      checkins, adicionarCheckin,
      memorias, adicionarMemoria,
      vitorias, adicionarVitoria,
      notificacoes,
      temAcesso,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
