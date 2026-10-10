// "Seu dia na Atravessia" — cartão com a sequência diária sugerida e o cartão
// compacto de "próximo passo". Tudo aqui é opcional: nada bloqueia o uso do
// app, nenhum modal é aberto e um "Agora não" é lembrado até o fim do dia.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow, criarEstilos } from '../theme';
import { useApp } from '../hooks/AppContext';
import {
  montarDiarioDoDia, proximoDepoisDe, foiDispensadoHoje, dispensarHoje, desfazerDispensaHoje,
} from '../utils/diario';

// Recarrega a dispensa ao montar e sempre que a tela volta ao foco (a usuária
// pode ter tocado em "Agora não" em outra tela no mesmo dia).
function useDispensaDoDia(escopo, navigation, hoje) {
  const [dispensado, setDispensado] = useState(null); // null = ainda lendo
  const recarregar = useCallback(() => {
    let vivo = true;
    foiDispensadoHoje(escopo, hoje).then(v => { if (vivo) setDispensado(v); });
    return () => { vivo = false; };
  }, [escopo, hoje]);

  useEffect(() => {
    const cancelar = recarregar();
    const unsub = navigation?.addListener?.('focus', recarregar);
    return () => {
      cancelar();
      if (typeof unsub === 'function') unsub();
    };
  }, [recarregar, navigation]);

  return [dispensado, setDispensado];
}

const irPara = (navigation, passo) => {
  if (!navigation || !passo) return;
  // Passos bloqueados também navegam: a própria tela explica o plano com calma.
  navigation.navigate(passo.rota);
};

// ── Linha de um passo ────────────────────────────────────────────────────────
function PassoItem({ passo, destaque, onPress, largura }) {
  const { feito, bloqueado, opcional } = passo;
  let marcador;
  if (feito) {
    marcador = (
      <View style={[st.marca, st.marcaFeita]}>
        <Ionicons name="checkmark" size={15} color="white" />
      </View>
    );
  } else if (bloqueado) {
    marcador = (
      <View style={[st.marca, st.marcaBloq]}>
        <Ionicons name="lock-closed" size={12} color={colors.tl} />
      </View>
    );
  } else {
    marcador = (
      <View style={[st.marca, opcional ? st.marcaOpcional : st.marcaPendente, destaque && st.marcaDestaque]}>
        <Ionicons name={passo.icone} size={14} color={destaque ? 'white' : colors.lav5} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[st.passo, largura && { width: largura }, destaque && st.passoDestaque, bloqueado && st.passoBloq]}
      accessibilityRole="button"
      accessibilityLabel={`${passo.titulo}${feito ? ', feito hoje' : ''}${bloqueado ? ', disponível no Plano Acolher' : ''}`}
    >
      {marcador}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[st.passoTit, feito && st.passoTitFeito, bloqueado && { color: colors.tl }]}
          numberOfLines={1}
        >
          {passo.titulo}
        </Text>
        <Text style={[st.passoDesc, bloqueado && { color: colors.tl }]} numberOfLines={1}>
          {bloqueado ? 'Disponível no Plano Acolher' : feito ? 'Feito hoje' : passo.descricao}
        </Text>
      </View>
      {opcional && !bloqueado ? <Text style={st.tagOpcional}>opcional</Text> : null}
      <Ionicons name="chevron-forward" size={14} color={bloqueado ? colors.border : colors.lav3} />
    </TouchableOpacity>
  );
}

// ── Cartão principal ─────────────────────────────────────────────────────────
export default function DiarioDoDia({ navigation, variante = 'cartao' }) {
  const app = useApp() || {};
  const diario = useMemo(
    () => montarDiarioDoDia(app),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.checkins, app.vitorias, app.liberadoHoje, app.temAcesso, app.jornadasComProgresso],
  );
  const [recolhido, setRecolhido] = useDispensaDoDia('cartao', navigation, diario.hoje);
  const [larguraCartao, setLarguraCartao] = useState(0);

  const compacto = variante === 'compacto' || recolhido === true;
  const progresso = diario.total > 0 ? diario.feitos / diario.total : 0;
  const duasColunas = larguraCartao >= 560;
  const larguraPasso = duasColunas ? (larguraCartao - spacing.lg * 2 - spacing.sm) / 2 : undefined;

  const recolher = () => { setRecolhido(true); dispensarHoje('cartao', diario.hoje); };
  const expandir = () => { setRecolhido(false); desfazerDispensaHoje('cartao', diario.hoje); };

  if (compacto) {
    return (
      <TouchableOpacity
        style={[st.card, st.cardCompacto]}
        onPress={variante === 'compacto' ? () => irPara(navigation, diario.proximo || diario.passos[0]) : expandir}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <View style={st.iconeTopo}>
          <Ionicons name="book-outline" size={16} color={colors.lav5} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.titulo} numberOfLines={1}>Seu dia na Atravessia</Text>
          <Text style={st.compactoSub} numberOfLines={1}>
            {diario.completo
              ? 'Você cuidou de si hoje'
              : diario.proximo ? `Próximo, se quiser: ${diario.proximo.titulo}` : 'Siga no seu ritmo'}
          </Text>
        </View>
        {diario.total > 0 && (
          <View style={st.pill}>
            <Text style={st.pillTxt}>{diario.feitos} de {diario.total}</Text>
          </View>
        )}
        <Ionicons name={variante === 'compacto' ? 'chevron-forward' : 'chevron-down'} size={16} color={colors.lav4} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={st.card} onLayout={e => setLarguraCartao(e.nativeEvent.layout.width)}>
      <View style={st.topo}>
        <View style={st.iconeTopo}>
          <Ionicons name="book-outline" size={16} color={colors.lav5} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.titulo}>Seu dia na Atravessia</Text>
          <Text style={st.subtitulo}>
            {diario.completo ? 'Você cuidou de si hoje.' : 'Um caminho possível para hoje'}
          </Text>
        </View>
        {diario.total > 0 && (
          <View style={st.pill}>
            <Text style={st.pillTxt}>{diario.feitos} de {diario.total}</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={recolher}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Recolher por hoje"
          style={{ marginLeft: 4 }}
        >
          <Ionicons name="chevron-up" size={18} color={colors.tl} />
        </TouchableOpacity>
      </View>

      {diario.total > 0 && (
        <View style={st.barra}>
          <View style={[st.barraFill, { width: `${Math.round(progresso * 100)}%` }]} />
        </View>
      )}

      <View style={[st.lista, duasColunas && st.listaGrid]}>
        {diario.passos.map(p => (
          <PassoItem
            key={p.id}
            passo={p}
            destaque={diario.proximo?.id === p.id}
            largura={larguraPasso}
            onPress={() => irPara(navigation, p)}
          />
        ))}
      </View>

      {diario.proximo ? (
        <TouchableOpacity style={st.btn} onPress={() => irPara(navigation, diario.proximo)} activeOpacity={0.85}>
          <Text style={st.btnTxt}>Seguir para: {diario.proximo.titulo}</Text>
          <Ionicons name="arrow-forward" size={14} color="white" />
        </TouchableOpacity>
      ) : diario.completo ? (
        <TouchableOpacity
          style={st.btnSec}
          onPress={() => navigation?.navigate?.('Relatorios')}
          activeOpacity={0.85}
        >
          <Ionicons name="analytics-outline" size={14} color={colors.lav5} />
          <Text style={st.btnSecTxt}>Olhar para o caminho</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={st.rodape}>Tudo aqui é opcional — siga no seu ritmo</Text>
    </View>
  );
}

// ── Cartão compacto "próximo passo" (após concluir um passo) ─────────────────
export function ProximoPasso({ navigation, depoisDe, style }) {
  const app = useApp() || {};
  const diario = useMemo(
    () => montarDiarioDoDia(app),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.checkins, app.vitorias, app.liberadoHoje, app.temAcesso, app.jornadasComProgresso],
  );
  const [dispensado, setDispensado] = useDispensaDoDia('proximo', navigation, diario.hoje);
  const [recusouAgora, setRecusouAgora] = useState(false);

  const passo = proximoDepoisDe(diario, depoisDe);

  if (recusouAgora) {
    return (
      <View style={[st.pp, st.ppRecusa, style]}>
        <Ionicons name="heart-outline" size={14} color={colors.lav4} />
        <Text style={st.ppRecusaTxt}>Tudo bem. Quando quiser, é só voltar.</Text>
      </View>
    );
  }

  // Enquanto lê a dispensa (null) não mostra nada, para não "piscar".
  if (dispensado !== false || !passo) return null;

  const agoraNao = () => {
    setRecusouAgora(true);
    setDispensado(true);
    dispensarHoje('proximo', diario.hoje);
  };

  return (
    <View style={[st.pp, style]}>
      <View style={st.ppTopo}>
        <View style={st.ppIcone}>
          <Ionicons name={passo.icone} size={16} color={colors.lav5} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.ppCaption}>Seu dia na Atravessia · se quiser</Text>
          <Text style={st.ppPergunta}>{passo.pergunta}</Text>
        </View>
      </View>
      <View style={st.ppBotoes}>
        <TouchableOpacity style={st.ppBtn} onPress={() => irPara(navigation, passo)} activeOpacity={0.85}>
          <Text style={st.ppBtnTxt}>{passo.acao}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.ppBtnGhost} onPress={agoraNao} activeOpacity={0.85}>
          <Text style={st.ppBtnGhostTxt}>Agora não</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = criarEstilos(() => ({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardCompacto: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: spacing.md,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconeTopo: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center',
  },
  titulo: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lav6 },
  subtitulo: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tm, marginTop: 1 },
  compactoSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 1 },
  pill: {
    backgroundColor: colors.lav1, borderRadius: radius.full,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  pillTxt: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lav5 },
  barra: {
    height: 5, borderRadius: 3, backgroundColor: colors.lav1,
    marginTop: spacing.md, overflow: 'hidden',
  },
  barraFill: { height: '100%', borderRadius: 3, backgroundColor: colors.sage },

  lista: { marginTop: spacing.md, gap: 6 },
  listaGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: 6 },
  passo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  passoDestaque: { backgroundColor: colors.lav1 },
  passoBloq: { opacity: 0.75 },
  marca: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  marcaFeita: { backgroundColor: colors.sage },
  marcaPendente: { borderWidth: 1.5, borderColor: colors.lav3, backgroundColor: colors.card },
  marcaOpcional: { borderWidth: 1.5, borderColor: colors.lav2, borderStyle: 'dashed', backgroundColor: colors.card },
  marcaDestaque: { backgroundColor: colors.lav4, borderColor: colors.lav4, borderStyle: 'solid' },
  marcaBloq: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  passoTit: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  passoTitFeito: { color: colors.sageFg },
  passoDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 1 },
  tagOpcional: {
    fontFamily: fonts.body, fontSize: 9.5, color: colors.tl,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.lav4, borderRadius: radius.full,
    paddingVertical: 11, paddingHorizontal: spacing.lg, marginTop: spacing.md,
  },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
  btnSec: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.lav1, borderRadius: radius.full,
    paddingVertical: 10, paddingHorizontal: spacing.lg, marginTop: spacing.md,
  },
  btnSecTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav5 },
  rodape: {
    fontFamily: fonts.quote, fontSize: 13, color: colors.tm,
    textAlign: 'center', marginTop: spacing.md,
  },

  // Próximo passo
  pp: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lav2,
    padding: spacing.md,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  ppTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ppIcone: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center',
  },
  ppCaption: {
    fontFamily: fonts.bodyBold, fontSize: 9.5, color: colors.lav4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  ppPergunta: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.td, marginTop: 2, lineHeight: 19 },
  ppBotoes: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  ppBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.lav4, borderRadius: radius.full, paddingVertical: 9,
  },
  ppBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: 'white' },
  ppBtnGhost: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderRadius: radius.full, paddingVertical: 9,
    borderWidth: 1, borderColor: colors.border,
  },
  ppBtnGhostTxt: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm },
  ppRecusa: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'transparent', borderColor: 'transparent',
    shadowOpacity: 0, elevation: 0, paddingVertical: spacing.sm,
  },
  ppRecusaTxt: { fontFamily: fonts.quote, fontSize: 14, color: colors.tm },
}));
