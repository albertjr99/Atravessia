import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, Pressable, Animated, Easing, AccessibilityInfo, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/AuthContext';
import { colors, fonts, radius, spacing, criarEstilos } from '../theme';

// Os Travessinhos: Nanda, Brian e Maju, versões em desenho das pessoas que
// fazem a Atravessia (Carla, Albert e Larissa). As imagens são recortes da
// arte oficial (assets/images/travessinhos/original.jpg), sem redesenho.
//
// Uso:
//   <Travessinho quem="nanda" fala="..." variante="balão|cartão|mini"
//     acao={{ rotulo, onPress }} onFechar={...} />
//   <DicaTravessinho chave="checkin" quem="nanda" fala="..." />   (1ª visitas, dispensável)
//   <VazioTravessinho quem="brian" titulo="..." fala="..." />      (lista vazia)
//   const { comemorar, elemento } = useComemoracaoTravessinho();   (parabéns rápido)
//
// As administradoras ligam/desligam todas as aparições em
// configuracoes/travessinhos { ativo: true|false }.

export const PERSONAGENS = {
  nanda: {
    nome: 'Nanda',
    inspiracao: 'Carla',
    papel: 'Acolhimento e emoções',
    descricao: 'A Nanda é a parte acolhedora da turma. Ela acompanha seu check-in, o diário, os áudios e a carta do mês, sempre lembrando que cada sentimento tem lugar aqui.',
    inspiracaoTexto: 'Inspirada na Carla, fundadora e psicóloga da Atravessia.',
    avatar: require('../../assets/images/travessinhos/nanda.png'),
    corpo: require('../../assets/images/travessinhos/nanda-corpo.png'),
    cor: '#E0A800',
    corForte: '#8A6400',
    fundo: '#FFF6D6',
    icone: 'heart',
  },
  brian: {
    nome: 'Brian',
    inspiracao: 'Albert',
    papel: 'Como o app funciona',
    descricao: 'O Brian adora explicar as coisas de um jeito leve: notificações, relatórios em PDF, cursos, atualizações e todos os cantinhos do app.',
    inspiracaoTexto: 'Inspirado no Albert, que desenvolve o app.',
    avatar: require('../../assets/images/travessinhos/brian.png'),
    corpo: require('../../assets/images/travessinhos/brian-corpo.png'),
    cor: '#2F6FD0',
    corForte: '#1D4C99',
    fundo: '#E3EDFC',
    icone: 'bulb',
  },
  maju: {
    nome: 'Maju',
    inspiracao: 'Larissa',
    papel: 'Benefícios e vida prática',
    descricao: 'A Maju conhece os benefícios: parcerias, cupons, cashback, achados, planos e imobiliárias. Ela ajuda a aproveitar o que a Atravessia oferece no dia a dia.',
    inspiracaoTexto: 'Inspirada na Larissa, sócia da Atravessia.',
    avatar: require('../../assets/images/travessinhos/maju.png'),
    corpo: require('../../assets/images/travessinhos/maju-corpo.png'),
    cor: '#3E9B4F',
    corForte: '#2A6B36',
    fundo: '#E3F3E2',
    icone: 'gift',
  },
};

export const IMAGEM_GRUPO = require('../../assets/images/travessinhos/grupo.jpg');

const personagem = (quem) => PERSONAGENS[quem] || PERSONAGENS.nanda;

// ── Liga/desliga pelo painel (uma única escuta para o app inteiro) ───────────
let ativoGlobal = true;
let cancelarEscuta = null;
const ouvintes = new Set();

function escutarConfig() {
  if (cancelarEscuta) return;
  cancelarEscuta = onSnapshot(doc(db, 'configuracoes', 'travessinhos'), (snap) => {
    ativoGlobal = !snap.exists() || snap.data()?.ativo !== false;
    ouvintes.forEach(f => f(ativoGlobal));
  }, () => {
    // Sem permissão (ex.: antes do login): tenta de novo na próxima montagem.
    cancelarEscuta = null;
  });
}

export function useTravessinhosAtivos() {
  const [ativo, setAtivo] = useState(ativoGlobal);
  useEffect(() => {
    ouvintes.add(setAtivo);
    escutarConfig();
    setAtivo(ativoGlobal);
    return () => {
      ouvintes.delete(setAtivo);
      if (!ouvintes.size && cancelarEscuta) { cancelarEscuta(); cancelarEscuta = null; }
    };
  }, []);
  return ativo;
}

// Respeita o "reduzir movimento" do aparelho.
function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(v => { if (vivo) setReduzido(!!v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', v => setReduzido(!!v));
    return () => { vivo = false; sub?.remove?.(); };
  }, []);
  return reduzido;
}

// Entrada com leve pulo + "respirar" contínuo do avatar.
function useAnimacao({ respirar = true } = {}) {
  const reduzido = useMovimentoReduzido();
  const entrada = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  const fase = useRef(new Animated.Value(0)).current;
  const pulo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduzido) { entrada.setValue(1); return undefined; }
    const a = Animated.spring(entrada, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [reduzido, entrada]);

  useEffect(() => {
    if (reduzido || !respirar) { fase.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(fase, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(fase, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduzido, respirar, fase]);

  const pular = useCallback(() => {
    if (reduzido) return;
    pulo.setValue(0);
    Animated.sequence([
      Animated.timing(pulo, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(pulo, { toValue: 0, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
  }, [reduzido, pulo]);

  const caixa = {
    opacity: entrada.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [
      { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
      { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
    ],
  };
  const avatar = {
    transform: [
      { translateY: Animated.add(
        fase.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }),
        pulo.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }),
      ) },
      { scale: fase.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
    ],
  };
  return { caixa, avatar, pular };
}

function Etiqueta({ p, pequena }) {
  return (
    <View style={[s.etiqueta, pequena && s.etiquetaPequena, { borderColor: p.cor }]}>
      <Text style={[s.etiquetaTxt, pequena && s.etiquetaTxtPequena]}>{p.nome}</Text>
    </View>
  );
}

export function AvatarTravessinho({ quem, tamanho = 56, style, animado = true, comNome = false }) {
  const p = personagem(quem);
  const { avatar, pular } = useAnimacao({ respirar: animado });
  return (
    <Pressable onPress={pular} accessibilityRole="image" accessibilityLabel={`${p.nome}, dos Travessinhos`} style={[{ alignItems: 'center' }, style]}>
      <Animated.View style={[s.avatarSombra, { width: tamanho, height: tamanho, borderRadius: tamanho / 2 }, animado && avatar]}>
        <Image source={p.avatar} style={{ width: tamanho, height: tamanho }} resizeMode="contain" />
      </Animated.View>
      {comNome && <Etiqueta p={p} pequena={tamanho < 64} />}
    </Pressable>
  );
}

function BotaoAcao({ acao, p }) {
  if (!acao?.rotulo) return null;
  return (
    <TouchableOpacity onPress={acao.onPress} style={[s.acao, { backgroundColor: p.cor }]} activeOpacity={0.85} accessibilityRole="button">
      <Text style={s.acaoTxt}>{acao.rotulo}</Text>
      <Ionicons name="arrow-forward" size={14} color="white" />
    </TouchableOpacity>
  );
}

function BotaoFechar({ onFechar, nome }) {
  if (!onFechar) return null;
  return (
    <TouchableOpacity onPress={onFechar} style={s.fechar} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Dispensar a dica de ${nome}`}>
      <Ionicons name="close" size={16} color={colors.tl} />
    </TouchableOpacity>
  );
}

export default function Travessinho({ quem = 'nanda', fala, variante = 'balão', acao, onFechar, titulo, style }) {
  const p = personagem(quem);
  const { caixa, avatar, pular } = useAnimacao();
  const v = variante === 'balao' ? 'balão' : variante === 'cartao' ? 'cartão' : variante;

  if (v === 'mini') {
    return (
      <Animated.View style={[s.mini, caixa, style]}>
        <Pressable onPress={pular}>
          <Animated.View style={avatar}>
            <Image source={p.avatar} style={s.miniAvatar} resizeMode="contain" />
          </Animated.View>
        </Pressable>
        <Text style={s.miniTxt}>
          <Text style={[s.miniNome, { color: colors.escuro ? p.cor : p.corForte }]}>{p.nome}: </Text>
          {fala}
        </Text>
        <BotaoFechar onFechar={onFechar} nome={p.nome} />
      </Animated.View>
    );
  }

  if (v === 'cartão') {
    return (
      <Animated.View style={[s.cartao, { borderLeftColor: p.cor }, caixa, style]} accessibilityRole="summary">
        <Pressable onPress={pular} style={{ alignItems: 'center' }} accessibilityLabel={`${p.nome}, dos Travessinhos`}>
          <Animated.View style={avatar}>
            <Image source={p.avatar} style={s.cartaoAvatar} resizeMode="contain" />
          </Animated.View>
          <Etiqueta p={p} pequena />
        </Pressable>
        <View style={{ flex: 1 }}>
          {!!titulo && <Text style={s.cartaoTitulo}>{titulo}</Text>}
          <Text style={s.cartaoTxt}>{fala}</Text>
          <BotaoAcao acao={acao} p={p} />
        </View>
        <BotaoFechar onFechar={onFechar} nome={p.nome} />
      </Animated.View>
    );
  }

  // Balão de fala.
  return (
    <Animated.View style={[s.balaoLinha, caixa, style]}>
      <Pressable onPress={pular} style={{ alignItems: 'center' }} accessibilityLabel={`${p.nome}, dos Travessinhos`}>
        <Animated.View style={avatar}>
          <Image source={p.avatar} style={s.balaoAvatar} resizeMode="contain" />
        </Animated.View>
        <Etiqueta p={p} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={[s.balao, { borderColor: p.cor }]}>
          <View style={[s.balaoRabo, { borderRightColor: p.cor }]} />
          <View style={s.balaoRaboDentro} />
          {!!titulo && <Text style={s.cartaoTitulo}>{titulo}</Text>}
          <Text style={s.balaoTxt}>{fala}</Text>
          <BotaoAcao acao={acao} p={p} />
        </View>
      </View>
      <BotaoFechar onFechar={onFechar} nome={p.nome} />
    </Animated.View>
  );
}

// ── Dicas contextuais: aparecem nas primeiras visitas e podem ser dispensadas ──
const chaveDica = (uid, chave) => `@atravessia/travessinhos/${uid || 'local'}/${chave}`;

export function useDicaTravessinho(chave, { visitas = 3 } = {}) {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const ativo = useTravessinhosAtivos();
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    let vivo = true;
    const k = chaveDica(uid, chave);
    AsyncStorage.getItem(k).then((bruto) => {
      let d = {};
      try { d = bruto ? JSON.parse(bruto) : {}; } catch { d = {}; }
      const n = (d.n || 0) + 1;
      const pode = !d.dispensada && n <= visitas;
      if (vivo) setMostrar(pode);
      if (pode) AsyncStorage.setItem(k, JSON.stringify({ ...d, n })).catch(() => {});
    }).catch(() => { if (vivo) setMostrar(false); });
    return () => { vivo = false; };
  }, [uid, chave, visitas]);

  const dispensar = useCallback(() => {
    setMostrar(false);
    AsyncStorage.setItem(chaveDica(uid, chave), JSON.stringify({ dispensada: true, n: 99 })).catch(() => {});
  }, [uid, chave]);

  return { mostrar: ativo && mostrar, dispensar };
}

export function DicaTravessinho({ chave, quem, fala, titulo, acao, visitas, variante = 'cartão', style }) {
  const { mostrar, dispensar } = useDicaTravessinho(chave, { visitas });
  if (!mostrar) return null;
  return (
    <Travessinho
      quem={quem}
      fala={fala}
      titulo={titulo}
      variante={variante}
      style={[{ marginBottom: spacing.md }, style]}
      acao={acao ? { ...acao, onPress: () => { dispensar(); acao.onPress?.(); } } : undefined}
      onFechar={dispensar}
    />
  );
}

// ── Estado vazio: o personagem certo com uma frase gentil ────────────────────
export function VazioTravessinho({ quem = 'nanda', titulo, fala, acao, style }) {
  const ativo = useTravessinhosAtivos();
  const p = personagem(quem);
  const { caixa } = useAnimacao({ respirar: false });
  return (
    <Animated.View style={[s.vazio, caixa, style]}>
      {ativo && <AvatarTravessinho quem={quem} tamanho={92} comNome />}
      {!!titulo && <Text style={s.vazioTitulo}>{titulo}</Text>}
      {!!fala && <Text style={s.vazioTxt}>{fala}</Text>}
      <BotaoAcao acao={acao} p={p} />
    </Animated.View>
  );
}

// ── Comemoração rápida (check-in, pequena vitória, aula concluída) ───────────
export function useComemoracaoTravessinho({ duracao = 2800 } = {}) {
  const ativo = useTravessinhosAtivos();
  const [festa, setFesta] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const comemorar = useCallback((quem, fala) => {
    if (!ativo) return;
    clearTimeout(timer.current);
    setFesta({ quem, fala, id: Date.now() });
    timer.current = setTimeout(() => setFesta(null), duracao);
  }, [ativo, duracao]);
  const elemento = festa ? (
    <ComemoracaoTravessinho key={festa.id} quem={festa.quem} fala={festa.fala} onFechar={() => setFesta(null)} />
  ) : null;
  return { comemorar, elemento };
}

export function ComemoracaoTravessinho({ quem, fala, onFechar }) {
  const p = personagem(quem);
  const { caixa, avatar, pular } = useAnimacao();
  useEffect(() => { const t = setTimeout(pular, 250); return () => clearTimeout(t); }, [pular]);
  return (
    <View pointerEvents="box-none" style={s.festaCamada}>
      <Animated.View style={[s.festa, { borderColor: p.cor }, caixa]} accessibilityLiveRegion="polite">
        <Animated.View style={avatar}>
          <Image source={p.avatar} style={s.festaAvatar} resizeMode="contain" />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={[s.festaNome, { color: colors.escuro ? p.cor : p.corForte }]}>{p.nome} 🎉</Text>
          <Text style={s.festaTxt}>{fala}</Text>
        </View>
        <BotaoFechar onFechar={onFechar} nome={p.nome} />
      </Animated.View>
    </View>
  );
}

const s = criarEstilos(() => ({
  avatarSombra: {
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: colors.escuro ? 0.4 : 0.16, shadowRadius: 8, elevation: 3,
  },
  etiqueta: {
    marginTop: -8, paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.full,
    backgroundColor: '#FFF4D6', borderWidth: 1.5,
  },
  etiquetaPequena: { marginTop: -6, paddingHorizontal: 7, paddingVertical: 1 },
  etiquetaTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#2A2433' },
  etiquetaTxtPequena: { fontSize: 10.5 },

  acao: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginTop: 10, minHeight: 36, paddingHorizontal: 14, borderRadius: radius.full,
  },
  acaoTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
  fechar: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidroTenue,
  },

  cartao: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: colors.card, borderRadius: radius.xl, padding: 12,
    borderWidth: 1, borderColor: colors.bordaLuz, borderLeftWidth: 4,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 6 }, shadowOpacity: colors.escuro ? 0.3 : 0.08, shadowRadius: 14, elevation: 2,
  },
  cartaoAvatar: { width: 54, height: 54 },
  cartaoTitulo: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: 2 },
  cartaoTxt: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.tm },

  balaoLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  balaoAvatar: { width: 72, height: 72 },
  balao: {
    backgroundColor: colors.cardSolido, borderRadius: 18, borderWidth: 1.5,
    paddingVertical: 12, paddingHorizontal: 14, marginTop: 6,
  },
  balaoRabo: {
    position: 'absolute', left: -10, top: 18, width: 0, height: 0,
    borderTopWidth: 8, borderBottomWidth: 8, borderRightWidth: 10,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
  },
  balaoRaboDentro: {
    position: 'absolute', left: -7, top: 19.5, width: 0, height: 0,
    borderTopWidth: 6.5, borderBottomWidth: 6.5, borderRightWidth: 8,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: colors.cardSolido,
  },
  balaoTxt: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.td },

  mini: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.vidro, borderRadius: radius.full, borderWidth: 1, borderColor: colors.bordaLuz,
    paddingVertical: 4, paddingLeft: 4, paddingRight: 10,
  },
  miniAvatar: { width: 34, height: 34 },
  miniTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.tm },
  miniNome: { fontFamily: fonts.bodyBold },

  vazio: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: 6 },
  vazioTitulo: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td, textAlign: 'center', marginTop: 10 },
  vazioTxt: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.tm, textAlign: 'center', maxWidth: 340 },

  festaCamada: {
    ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center',
    paddingBottom: 110, paddingHorizontal: spacing.lg, zIndex: 60, elevation: 60,
  },
  festa: {
    flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth: 440,
    backgroundColor: colors.cardSolido, borderRadius: 22, borderWidth: 2, padding: 10,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.45 : 0.2, shadowRadius: 20, elevation: 8,
  },
  festaAvatar: { width: 58, height: 58 },
  festaNome: { fontFamily: fonts.bodyBold, fontSize: 13 },
  festaTxt: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.td },
}));
