import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { Profundo } from '../../components/Efeitos';
import { SITE_URL } from '../../utils/cupons';

// Cursos Atravessia — peças comuns às telas da usuária (vitrine, curso e aula).
// Dados: cursos/{id}, profissionais/{id} e o acesso em usuarios/{uid}/cursos/{cursoId}
// (criado só pelo servidor, depois do pagamento). Ver docs/cursos/README.md.

// Área web da aluna (mesma conta do app).
export const URL_CURSOS_WEB = `${SITE_URL}/curso.html`;

export const brl = (reais) => Number(reais || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function aulasOrdenadas(curso) {
  return [...(curso?.aulas || [])]
    .filter(a => a && a.youtubeId)
    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
}

export const thumbAula = (a) => a?.thumb || (a?.youtubeId ? `https://i.ytimg.com/vi/${a.youtubeId}/hqdefault.jpg` : null);
export const capaCurso = (c) => c?.capaUrl || thumbAula(aulasOrdenadas(c)[0]);

// Percentual concluído (0..1) a partir do mapa progresso { aulaId: true }.
export function progressoCurso(curso, acesso) {
  const aulas = aulasOrdenadas(curso);
  if (!aulas.length) return 0;
  const feitas = aulas.filter(a => acesso?.progresso?.[a.id]).length;
  return feitas / aulas.length;
}

const ms = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : 0);

// Cursos publicados (ativo), destaque primeiro, depois os mais novos.
export function useCursos() {
  const [cursos, setCursos] = useState(undefined);
  useEffect(() => onSnapshot(query(collection(db, 'cursos'), where('ativo', '==', true)), (snap) => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => (b.destaque === true) - (a.destaque === true) || ms(b.criadoEm) - ms(a.criadoEm));
    setCursos(lista);
  }, (e) => { console.warn('[Cursos] vitrine:', e?.message); setCursos([]); }), []);
  return cursos;
}

export function useCurso(cursoId) {
  const [curso, setCurso] = useState(undefined);
  useEffect(() => {
    if (!cursoId) { setCurso(null); return undefined; }
    return onSnapshot(doc(db, 'cursos', cursoId), (snap) => setCurso(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (e) => { console.warn('[Cursos] curso:', e?.message); setCurso(null); });
  }, [cursoId]);
  return curso;
}

export function useProfissional(id) {
  const [prof, setProf] = useState(null);
  useEffect(() => {
    if (!id) { setProf(null); return undefined; }
    return onSnapshot(doc(db, 'profissionais', id), (snap) => setProf(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setProf(null));
  }, [id]);
  return prof;
}

// Mapa { cursoId: acesso } dos cursos que a usuária comprou.
export function useMeusCursos(uid) {
  const [mapa, setMapa] = useState({});
  useEffect(() => {
    if (!uid) { setMapa({}); return undefined; }
    return onSnapshot(collection(db, 'usuarios', uid, 'cursos'), (snap) => {
      const m = {};
      snap.forEach(d => { m[d.id] = { id: d.id, ...d.data() }; });
      setMapa(m);
    }, () => setMapa({}));
  }, [uid]);
  return mapa;
}

// undefined = carregando · null = sem acesso · objeto = acesso liberado.
export function useAcessoCurso(uid, cursoId) {
  const [acesso, setAcesso] = useState(undefined);
  useEffect(() => {
    if (!uid || !cursoId) { setAcesso(null); return undefined; }
    return onSnapshot(doc(db, 'usuarios', uid, 'cursos', cursoId), (snap) => setAcesso(snap.exists() ? snap.data() : null),
      () => setAcesso(null));
  }, [uid, cursoId]);
  return acesso;
}

// ---- Componentes -------------------------------------------------------------

export function TopoCursos({ titulo, onVoltar, insetTop = 0, direita }) {
  return (
    <View style={[c.topBar, { paddingTop: insetTop + 8 }]}>
      <TouchableOpacity onPress={onVoltar} style={c.backBtn} accessibilityLabel="Voltar">
        <Ionicons name="chevron-back" size={22} color={colors.lav6} />
      </TouchableOpacity>
      <Text style={c.topTitle} numberOfLines={1}>{titulo}</Text>
      {direita || <View style={{ width: 44 }} />}
    </View>
  );
}

// Botão principal: degradê lilás com "degrau" que afunda ao toque.
export function BotaoCurso({ onPress, children, rotulo, externo, desativado }) {
  return (
    <Profundo
      externo={[externo, desativado && { opacity: 0.6 }]}
      estilo={c.btnFace}
      base={colors.botaoBase}
      sombra={c.btnHalo}
      onPress={desativado ? undefined : onPress}
      accessibilityLabel={rotulo}
    >
      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={c.btnGrad} />
      {children}
    </Profundo>
  );
}

// Capa 16:9 com véu escuro embaixo e, opcionalmente, o botão de play no centro.
export function Capa({ uri, raio = 22, play = false, tamPlay = 54, children, estilo }) {
  return (
    <View style={[c.capa, { borderRadius: raio }, estilo]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : (
        <LinearGradient colors={[colors.lav3, colors.lav5]} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient colors={['rgba(28,23,38,0)', 'rgba(28,23,38,0.72)']} start={{ x: 0, y: 0.35 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      {play && (
        <View style={c.playCentro} pointerEvents="none">
          <View style={[c.play, { width: tamPlay, height: tamPlay, borderRadius: tamPlay / 2 }]}>
            <Ionicons name="play" size={tamPlay * 0.42} color="#45358A" style={{ marginLeft: 3 }} />
          </View>
        </View>
      )}
      {children}
    </View>
  );
}

export function BarraProgresso({ valor = 0, altura = 6, estilo }) {
  return (
    <View style={[c.barra, { height: altura, borderRadius: altura / 2 }, estilo]}>
      <LinearGradient
        colors={[colors.lav4, colors.botaoForte]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ width: `${Math.round(Math.max(0, Math.min(1, valor)) * 100)}%`, height: '100%', borderRadius: altura / 2 }}
      />
    </View>
  );
}

const c = criarEstilos(() => ({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 1,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 24, color: colors.titulo },
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, paddingHorizontal: 22, overflow: 'hidden' },
  btnGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 5 },
  capa: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', backgroundColor: colors.lav2 },
  playCentro: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  play: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  barra: { width: '100%', backgroundColor: colors.escuro ? 'rgba(255,255,255,0.10)' : colors.lav1, overflow: 'hidden' },
}));
