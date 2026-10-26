import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Linking, AppState, Platform, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
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
const ESPERA_ADIADO_MS = 24 * 60 * 60 * 1000;
const INTERVALO_CHECAGEM_MS = 6 * 60 * 60 * 1000;
const NOVIDADES_PADRAO = 'Melhorias de estabilidade e novos cuidados para acompanhar a sua travessia.';

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

async function abrirLoja() {
  try { await Linking.openURL(LOJA_APP); return; } catch {}
  try { await Linking.openURL(LOJA_WEB); } catch {}
}

// Convite para atualizar o app quando há versão nova na Play Store. Usa a
// atualização no app do Google Play (Play Core) e, como reforço, o documento
// configuracoes/versaoApp que as administradoras editam no painel.
export default function AvisoAtualizacao({ uid }) {
  const [aviso, setAviso] = useState(null); // { obrigatoria, novidades, play }
  const [baixando, setBaixando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const ultimaChecagem = useRef(0);
  const checando = useRef(false);
  const obrigatoriaPendente = useRef(false);

  const conferir = useCallback(async () => {
    if (!ATIVO || checando.current) return;
    const agora = Date.now();
    if (!obrigatoriaPendente.current && agora - ultimaChecagem.current < INTERVALO_CHECAGEM_MS) return;
    checando.current = true;
    ultimaChecagem.current = agora;
    try {
      const instalada = Constants.expoConfig?.version || '';

      // 1) Controle das administradoras (Firestore).
      let cfg = {};
      if (uid) {
        try { cfg = (await getDoc(doc(db, 'configuracoes', 'versaoApp'))).data() || {}; } catch {}
      }
      const abaixoMinima = !!instalada && !!cfg.versaoMinima && compararVersoes(instalada, cfg.versaoMinima) < 0;
      const abaixoRecente = !!instalada && !!cfg.versaoRecente && compararVersoes(instalada, cfg.versaoRecente) < 0;

      // 2) Google Play (Play Core).
      let play = null;
      const mod = inAppUpdates();
      if (mod) {
        try { play = await mod.checkForUpdate(); } catch { play = null; }
      }
      const playDisponivel = !!play?.updateAvailable;
      if (play?.updateInProgress) setBaixando(true);

      const obrigatoria = abaixoMinima || (cfg.obrigatoria === true && abaixoRecente)
        || (playDisponivel && play?.serverUpdateType === 'IMMEDIATE');
      obrigatoriaPendente.current = obrigatoria;

      if (!obrigatoria && !abaixoRecente && !playDisponivel) { setAviso(null); return; }
      if (!obrigatoria) {
        const adiado = Number(await AsyncStorage.getItem(CHAVE_ADIADO).catch(() => 0)) || 0;
        if (agora - adiado < ESPERA_ADIADO_MS) return;
      }
      setAviso({
        obrigatoria,
        novidades: String(cfg.novidades || '').trim() || NOVIDADES_PADRAO,
        play: playDisponivel ? play : null,
      });
    } catch {
      // Sem internet ou sem Play Store: tenta de novo na próxima vez.
      ultimaChecagem.current = 0;
    } finally {
      checando.current = false;
    }
  }, [uid]);

  useEffect(() => {
    if (!ATIVO) return undefined;
    const t = setTimeout(() => conferir(), 2500);
    const sub = AppState.addEventListener('change', (e) => { if (e === 'active') conferir(); });
    return () => { clearTimeout(t); sub.remove(); };
  }, [conferir]);

  // Eventos da atualização flexível: quando termina de baixar, o próprio
  // Google Play pede para reiniciar o app.
  useEffect(() => {
    const mod = ATIVO ? inAppUpdates() : null;
    if (!mod?.addUpdateListener) return undefined;
    const tirar = [];
    try {
      tirar.push(mod.addUpdateListener('updateDownloaded', () => setBaixando(false)));
      tirar.push(mod.addUpdateListener('updateCancelled', () => {
        setBaixando(false);
        setIniciando(false);
        if (obrigatoriaPendente.current) { ultimaChecagem.current = 0; conferir(); }
      }));
    } catch {}
    return () => tirar.forEach(f => { try { f(); } catch {} });
  }, [conferir]);

  const atualizar = async () => {
    if (!aviso || iniciando) return;
    const { play, obrigatoria } = aviso;
    const mod = inAppUpdates();
    setIniciando(true);
    try {
      if (mod && play) {
        const imediata = obrigatoria ? (play.immediateAllowed || !play.flexibleAllowed) : !play.flexibleAllowed;
        if ((imediata && play.immediateAllowed) || (!imediata && play.flexibleAllowed)) {
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

  const depois = () => {
    if (aviso?.obrigatoria) return;
    AsyncStorage.setItem(CHAVE_ADIADO, String(Date.now())).catch(() => {});
    setAviso(null);
  };

  if (!ATIVO) return null;

  if (!aviso) {
    if (!baixando) return null;
    return (
      <View style={s.faixa} pointerEvents="none" accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color="#fff" />
        <Text style={s.faixaTxt}>Baixando a nova versão… pode seguir usando o app.</Text>
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={depois} statusBarTranslucent>
      <View style={s.fundo}>
        <View style={s.caixa}>
          <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.icone}>
            <Ionicons name="sparkles-outline" size={30} color="#fff" />
          </LinearGradient>
          <Text style={s.titulo}>Uma nova versão do Atravessia chegou</Text>
          <Text style={s.texto}>
            {aviso.obrigatoria
              ? 'Para continuar com tudo funcionando bem, é preciso atualizar o app. Leva só um instante.'
              : 'Preparamos melhorias com carinho para a sua travessia. Atualize quando puder.'}
          </Text>
          <View style={s.novidades}>
            <Text style={s.novidadesTit}>O que há de novo</Text>
            <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
              <Text style={s.novidadesTxt}>{aviso.novidades}</Text>
            </ScrollView>
          </View>
          <TouchableOpacity style={s.botao} onPress={atualizar} activeOpacity={0.85} disabled={iniciando}
            accessibilityRole="button" accessibilityLabel="Atualizar agora">
            <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} />
            {iniciando ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTxt}>Atualizar agora</Text>}
          </TouchableOpacity>
          {!aviso.obrigatoria && (
            <TouchableOpacity onPress={depois} style={s.depois} accessibilityRole="button" accessibilityLabel="Depois">
              <Text style={s.depoisTxt}>Depois</Text>
            </TouchableOpacity>
          )}
          {aviso.obrigatoria && <View style={{ height: 10 }} />}
        </View>
      </View>
    </Modal>
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
  faixa: {
    position: 'absolute', left: 16, right: 16, bottom: 96,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 18, backgroundColor: colors.botaoForte,
  },
  faixaTxt: { flex: 1, fontFamily: 'Figtree_600SemiBold', fontSize: 14, color: '#fff' },
}));
