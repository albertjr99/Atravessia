import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aplicarPaleta, tema } from '../theme';
import { definirVibracaoAtiva } from '../utils/vibrar';

// Aparência do app: tema claro, noturno (lilás profundo) ou automático pelo
// horário (noturno das 19h às 6h), e a vibração suave nas confirmações.
// A escolha fica guardada no aparelho.
const CHAVE = '@atravessia/aparencia';
const INICIO_NOITE = 19;
const FIM_NOITE = 6;

export const MODOS_TEMA = [
  { id: 'claro', rotulo: 'Claro', icone: 'sunny-outline', desc: 'Fundo creme, como sempre foi.' },
  { id: 'escuro', rotulo: 'Noturno', icone: 'moon-outline', desc: 'Lilás profundo, mais confortável no escuro.' },
  { id: 'auto', rotulo: 'Automático', icone: 'time-outline', desc: `Noturno das ${INICIO_NOITE}h às ${FIM_NOITE}h; claro durante o dia.` },
];

const ehNoite = (d = new Date()) => {
  const h = d.getHours();
  return h >= INICIO_NOITE || h < FIM_NOITE;
};

const TemaContext = createContext(null);

export function TemaProvider({ children }) {
  const [modo, setModoEstado] = useState('claro');
  const [vibracao, setVibracaoEstado] = useState(true);
  const [noite, setNoite] = useState(ehNoite());
  const [modoAdmin, setModoAdmin] = useState(false);
  const [versao, setVersao] = useState(tema.versao);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE)
      .then(bruto => {
        const salvo = bruto ? JSON.parse(bruto) : null;
        if (salvo?.modo && MODOS_TEMA.some(m => m.id === salvo.modo)) setModoEstado(salvo.modo);
        if (typeof salvo?.vibracao === 'boolean') setVibracaoEstado(salvo.vibracao);
      })
      .catch(e => console.warn('[Tema] não foi possível ler a preferência:', e?.message));
  }, []);

  // No automático, confere o horário a cada minuto e quando o app volta à frente.
  useEffect(() => {
    if (modo !== 'auto') return undefined;
    const conferir = () => setNoite(ehNoite());
    conferir();
    const t = setInterval(conferir, 60 * 1000);
    const sub = AppState.addEventListener('change', (e) => { if (e === 'active') conferir(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [modo]);

  // O painel das administradoras fica sempre claro (as telas dele não foram
  // desenhadas para o noturno).
  const efetivo = modoAdmin ? 'claro' : modo === 'auto' ? (noite ? 'escuro' : 'claro') : modo;

  useEffect(() => {
    if (aplicarPaleta(efetivo)) setVersao(tema.versao);
  }, [efetivo]);

  useEffect(() => { definirVibracaoAtiva(vibracao); }, [vibracao]);

  const salvar = useCallback((novo) => {
    AsyncStorage.setItem(CHAVE, JSON.stringify(novo))
      .catch(e => console.warn('[Tema] não foi possível salvar:', e?.message));
  }, []);

  const setModo = useCallback((m) => {
    setModoEstado(m);
    setNoite(ehNoite());
    salvar({ modo: m, vibracao });
  }, [salvar, vibracao]);

  const setVibracao = useCallback((v) => {
    setVibracaoEstado(v);
    salvar({ modo, vibracao: v });
  }, [salvar, modo]);

  const valor = useMemo(() => ({
    modo, setModo, vibracao, setVibracao, efetivo, versao, escuro: efetivo === 'escuro', setModoAdmin,
  }), [modo, setModo, vibracao, setVibracao, efetivo, versao]);

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export const useTema = () => useContext(TemaContext) || {
  modo: 'claro', efetivo: 'claro', versao: 0, escuro: false, vibracao: true,
  setModo: () => {}, setVibracao: () => {}, setModoAdmin: () => {},
};
