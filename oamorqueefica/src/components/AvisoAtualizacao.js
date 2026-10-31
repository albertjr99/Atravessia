import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Linking, AppState, Platform, StyleSheet, ActivityIndicator, ScrollView,
  DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { colors, criarEstilos } from '../theme';

const PACOTE = 'com.atravessia';
const LOJA_APP = `market://details?id=${PACOTE}`;
const LOJA_WEB = `https://play.google.com/store/apps/details?id=${PACOTE}`;
const CHAVE_ADIADO = 'avisoAtualizacao.adiadoEm';
const CHAVE_CONFIG = 'avisoAtualizacao.config';
const ESPERA_ADIADO_MS = 24 * 60 * 60 * 1000;
// Só evita checar duas vezes seguidas (abertura + volta ao app no mesmo
// instante). Com atualização pendente conhecida, não há intervalo nenhum.
const INTERVALO_MINIMO_MS = 30 * 1000;
const EVENTO_ABRIR = 'atravessia:abrirAvisoAtualizacao';
const ESPERA_VINHETA_MS = 2800;
export const NOVIDADES_PADRAO = 'Melhorias de estabilidade e novos cuidados para acompanhar a sua travessia.';

// Só no Android de verdade (a loja é a Play Store); nada no web nem no Expo Go/dev.
const ATIVO = Platform.OS === 'android' && !__DEV__;

// O módulo nativo só existe nos builds que já o incluem: carrega com cuidado
// para não quebrar se faltar.
let modulo;
function inAppUpdates() {
  if (modulo !== undefined) return modulo;
  try { modulo = require('expo-in-app-updates'); } catch { modulo = null; }
  return modulo;
}

// "1.19.12" < "1.20" → -1. Partes ausentes valem 0.
export function compararVersoes(a, b) {
  const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

const inteiro = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Versão realmente instalada no aparelho. Constants.expoConfig.version vem do
// app.json embutido no pacote JS e pode não refletir o binário; o nome e o
// versionCode nativos (expo-application) são a fonte certa.
export function versaoInstalada() {
  let app = null;
  try { app = require('expo-application'); } catch { app = null; }
  const nome = app?.nativeApplicationVersion || Constants.expoConfig?.version || '';
  const codigo = inteiro(app?.nativeBuildVersion)
    ?? inteiro(Constants.platform?.android?.versionCode)
    ?? inteiro(Constants.expoConfig?.android?.versionCode);
  return { nome: String(nome), codigo };
}

// Compara a versão instalada com o documento configuracoes/versaoApp.
// Vale o nome da versão (1.20.1) e/ou o versionCode (50), o que estiver preenchido.
export function avaliarVersao(instalada, cfg = {}) {
  const { nome, codigo } = instalada || {};
  const abaixo = (versao, code) => {
    const porNome = !!nome && !!versao && compararVersoes(nome, versao) < 0;
    const porCodigo = codigo != null && inteiro(code) != null && codigo < inteiro(code);
    return porNome || porCodigo;
  };
  const abaixoMinima = abaixo(cfg.versaoMinima, cfg.versionCodeMinimo);
  const abaixoRecente = abaixoMinima || abaixo(cfg.versaoRecente, cfg.versionCodeRecente);
  return { abaixoMinima, abaixoRecente, obrigatoria: abaixoMinima || (cfg.obrigatoria === true && abaixoRecente) };
}

function soCampos(d = {}) {
  return {
    versaoMinima: d.versaoMinima || '',
    versaoRecente: d.versaoRecente || '',
    versionCodeMinimo: inteiro(d.versionCodeMinimo),
    versionCodeRecente: inteiro(d.versionCodeRecente),
    obrigatoria: d.obrigatoria === true,
    novidades: d.novidades || '',
  };
}

async function abrirLoja() {
  try { await Linking.openURL(LOJA_APP); return; } catch {}
  try { await Linking.openURL(LOJA_WEB); } catch {}
}

// Outros convites (ex.: PermissaoNotificacoes) saem da frente enquanto o
// aviso de atualização estiver aberto.
let visivelAgora = false;
const ouvintes = new Set();
function marcarVisivel(v) {
  if (visivelAgora === v) return;
  visivelAgora = v;
  ouvintes.forEach(f => { try { f(v); } catch {} });
}
export const avisoAtualizacaoVisivel = () => visivelAgora;
export function aoMudarAvisoAtualizacao(f) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}
// Usado ao tocar numa notificação de versão: confere já, mesmo após "Agora não".
export function abrirAvisoAtualizacao() {
  DeviceEventEmitter.emit(EVENTO_ABRIR);
}

// Aviso de atualização do app. Fonte principal: o documento
// configuracoes/versaoApp, que as administradoras editam no painel (vale assim
// que a versão é publicada). Reforço: a atualização no app do Google Play
// (Play Core), que só "enxerga" a versão nova quando a Play Store do aparelho
// já a conhece — por isso sozinha não aparecia logo na abertura.
export default function AvisoAtualizacao({ uid }) {
  const [aviso, setAviso] = useState(null); // { obrigatoria, novidades, play }
  const [baixando, setBaixando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const ultimaChecagem = useRef(0);
  const checando = useRef(false);
  const pendente = useRef(false);
  const obrigatoriaPendente = useRef(false);
  const usouCache = useRef(false);

  const aplicar = useCallback(async (cfg, play, ignorarAdiamento) => {
    const instalada = versaoInstalada();
    const av = avaliarVersao(instalada, cfg);
    const codigoLoja = inteiro(play?.storeVersion);
    const playDisponivel = !!play?.updateAvailable
      && (codigoLoja == null || instalada.codigo == null || codigoLoja > instalada.codigo);
    const obrigatoria = av.obrigatoria || (playDisponivel && play?.serverUpdateType === 'IMMEDIATE');
    obrigatoriaPendente.current = obrigatoria;
    pendente.current = obrigatoria || av.abaixoRecente || playDisponivel;

    if (!pendente.current) { setAviso(null); return; }
    if (!obrigatoria && !ignorarAdiamento) {
      const adiado = Number(await AsyncStorage.getItem(CHAVE_ADIADO).catch(() => 0)) || 0;
      if (Date.now() - adiado < ESPERA_ADIADO_MS) { setAviso(null); return; }
    }
    setAviso({
      obrigatoria,
      novidades: String(cfg.novidades || '').trim() || NOVIDADES_PADRAO,
      play: playDisponivel ? play : null,
    });
  }, []);

  const conferir = useCallback(async ({ ignorarIntervalo = false, ignorarAdiamento = false } = {}) => {
    if (!ATIVO || checando.current) return;
    const agora = Date.now();
    if (!ignorarIntervalo && !pendente.current && agora - ultimaChecagem.current < INTERVALO_MINIMO_MS) return;
    checando.current = true;
    ultimaChecagem.current = agora;
    try {
      // 0) Na abertura, o último documento conhecido já decide (sem esperar a
      //    internet): quem não atualizou vê o aviso de imediato.
      let guardado = null;
      try { guardado = JSON.parse(await AsyncStorage.getItem(CHAVE_CONFIG)); } catch {}
      if (!usouCache.current && guardado) {
        usouCache.current = true;
        await aplicar(guardado, null, ignorarAdiamento);
      }

      // 1) Controle das administradoras (Firestore). A leitura deste documento
      //    é pública nas regras: funciona também antes do login.
      let cfg = null;
      try {
        const snap = await getDoc(doc(db, 'configuracoes', 'versaoApp'));
        cfg = soCampos(snap.data());
        AsyncStorage.setItem(CHAVE_CONFIG, JSON.stringify(cfg)).catch(() => {});
      } catch {
        cfg = guardado || {};
      }

      // 2) Google Play (Play Core).
      let play = null;
      const mod = inAppUpdates();
      if (mod) {
        try { play = await mod.checkForUpdate(); } catch { play = null; }
      }
      if (play?.updateInProgress) setBaixando(true);

      await aplicar(cfg, play, ignorarAdiamento);
    } catch {
      // Sem internet ou sem Play Store: tenta de novo na próxima vez.
      ultimaChecagem.current = 0;
    } finally {
      checando.current = false;
    }
  }, [aplicar]);

  // Na abertura e sempre que o app volta para a frente.
  useEffect(() => {
    if (!ATIVO) return undefined;
    const t = setTimeout(() => conferir({ ignorarIntervalo: true }), 400);
    const sub = AppState.addEventListener('change', (e) => { if (e === 'active') conferir(); });
    const abrir = DeviceEventEmitter.addListener(EVENTO_ABRIR, () => conferir({ ignorarIntervalo: true, ignorarAdiamento: true }));
    return () => { clearTimeout(t); sub.remove(); abrir.remove(); };
  }, [conferir]);

  // Depois do login a leitura do Firestore pode passar a funcionar (regras
  // antigas exigiam login): confere de novo.
  useEffect(() => {
    if (ATIVO && uid) conferir({ ignorarIntervalo: true });
  }, [uid, conferir]);

  // Eventos da atualização flexível: quando termina de baixar, o próprio
  // Google Play reinicia o app com a versão nova.
  useEffect(() => {
    const mod = ATIVO ? inAppUpdates() : null;
    if (!mod?.addUpdateListener) return undefined;
    const tirar = [];
    try {
      tirar.push(mod.addUpdateListener('updateDownloaded', () => setBaixando(false)));
      tirar.push(mod.addUpdateListener('updateCancelled', () => {
        setBaixando(false);
        setIniciando(false);
        if (obrigatoriaPendente.current) conferir({ ignorarIntervalo: true });
      }));
    } catch {}
    return () => tirar.forEach(f => { try { f(); } catch {} });
  }, [conferir]);

  // A checagem começa logo, mas o aviso só entra depois da vinheta de abertura
  // (SplashAnimado, ~2,8 s), para não aparecer por cima dela.
  const [liberado, setLiberado] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLiberado(true), ESPERA_VINHETA_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    marcarVisivel(!!aviso && liberado);
    return () => marcarVisivel(false);
  }, [aviso, liberado]);

  const atualizar = async () => {
    if (!aviso || iniciando) return;
    const { play, obrigatoria } = aviso;
    const mod = inAppUpdates();
    setIniciando(true);
    try {
      if (mod && play) {
        // Obrigatória: atualização imediata do Google Play (tela cheia).
        // Opcional: download em segundo plano, se o Google Play permitir.
        const imediata = obrigatoria ? !!play.immediateAllowed : !play.flexibleAllowed && !!play.immediateAllowed;
        if (imediata || play.flexibleAllowed) {
          const iniciou = await mod.startUpdate(imediata);
          if (iniciou) {
            if (!imediata) { setBaixando(true); setAviso(null); }
            return;
          }
        }
      }
      await abrirLoja();
    } catch {
      await abrirLoja();
    } finally {
      setIniciando(false);
    }
  };

  const agoraNao = () => {
    if (aviso?.obrigatoria) return; // obrigatória: sem saída (nem pelo voltar do Android)
    AsyncStorage.setItem(CHAVE_ADIADO, String(Date.now())).catch(() => {});
    setAviso(null);
  };

  if (!ATIVO || !liberado) return null;

  if (!aviso) {
    if (!baixando) return null;
    return (
      <View style={s.faixa} pointerEvents="none" accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color="#fff" />
        <Text style={s.faixaTxt}>Baixando a nova versão… você pode seguir usando o app.</Text>
      </View>
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={agoraNao}
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
    >
      <View style={s.fundo}>
        <CartaoAvisoAtualizacao
          obrigatoria={aviso.obrigatoria}
          novidades={aviso.novidades}
          iniciando={iniciando}
          onAtualizar={atualizar}
          onAgoraNao={agoraNao}
        />
      </View>
    </Modal>
  );
}

// O cartão do aviso, também usado como prévia no painel do app.
export function CartaoAvisoAtualizacao({ obrigatoria, novidades, iniciando, onAtualizar, onAgoraNao }) {
  return (
    <View style={s.caixa}>
      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.icone}>
        <Ionicons name={obrigatoria ? 'arrow-up-circle-outline' : 'sparkles-outline'} size={30} color="#fff" />
      </LinearGradient>
      <Text style={s.titulo}>Uma nova versão do Atravessia chegou</Text>
      <Text style={s.texto}>
        {obrigatoria
          ? 'Para continuar usando o app com tudo funcionando bem, é preciso atualizar. Leva só um instante.'
          : 'Preparamos melhorias com carinho para a sua travessia. Atualize quando puder.'}
      </Text>
      <View style={s.novidades}>
        <Text style={s.novidadesTit}>O que há de novo</Text>
        <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
          <Text style={s.novidadesTxt}>{String(novidades || '').trim() || NOVIDADES_PADRAO}</Text>
        </ScrollView>
      </View>
      <TouchableOpacity style={s.botao} onPress={onAtualizar} activeOpacity={0.85} disabled={!!iniciando}
        accessibilityRole="button" accessibilityLabel="Atualizar">
        <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} />
        {iniciando ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTxt}>Atualizar</Text>}
      </TouchableOpacity>
      {obrigatoria ? (
        <Text style={s.rodape}>Esta atualização é necessária para continuar.</Text>
      ) : (
        <TouchableOpacity onPress={onAgoraNao} style={s.depois} accessibilityRole="button" accessibilityLabel="Agora não">
          <Text style={s.depoisTxt}>Agora não</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = criarEstilos(() => ({
  fundo: { flex: 1, backgroundColor: colors.sobreposicao, alignItems: 'center', justifyContent: 'center', padding: 20 },
  caixa: {
    width: '100%', maxWidth: 440, alignItems: 'center', backgroundColor: colors.cardSolido, borderRadius: 28,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 14, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  icone: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  titulo: { fontFamily: 'Titulo', fontSize: 25, color: colors.titulo, textAlign: 'center' },
  texto: { fontFamily: 'Figtree_400Regular', fontSize: 15.5, lineHeight: 22, color: colors.texto2, textAlign: 'center', marginTop: 8 },
  novidades: {
    alignSelf: 'stretch', marginTop: 16, padding: 14, borderRadius: 18,
    backgroundColor: colors.escuro ? 'rgba(143,123,224,0.14)' : 'rgba(139,122,192,0.10)',
  },
  novidadesTit: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: colors.lilasTexto, marginBottom: 4, letterSpacing: 0.3 },
  novidadesTxt: { fontFamily: 'Figtree_400Regular', fontSize: 14.5, lineHeight: 21, color: colors.texto2 },
  botao: { alignSelf: 'stretch', marginTop: 20, paddingVertical: 15, minHeight: 52, borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  botaoTxt: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: '#fff' },
  depois: { paddingVertical: 12, paddingHorizontal: 20 },
  depoisTxt: { fontFamily: 'Figtree_700Bold', fontSize: 15, color: colors.texto2 },
  rodape: { fontFamily: 'Figtree_400Regular', fontSize: 12.5, color: colors.texto2, textAlign: 'center', paddingVertical: 12 },
  faixa: {
    position: 'absolute', left: 16, right: 16, bottom: 96,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 18, backgroundColor: colors.botaoForte,
  },
  faixaTxt: { flex: 1, fontFamily: 'Figtree_600SemiBold', fontSize: 14, color: '#fff' },
}));
