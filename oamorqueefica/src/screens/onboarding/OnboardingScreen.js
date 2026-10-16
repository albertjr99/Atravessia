import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Image,
  useWindowDimensions, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg, ScriptTitle } from '../../components';
import { Profundo } from '../../components/Efeitos';
import { useAuth } from '../../hooks/AuthContext';

const PASSOS = [
  {
    imagem: require('../../../assets/images/il_coracao_ramos.png'),
    icone: 'heart-outline',
    titulo: 'Como você está hoje?',
    texto: 'Todos os dias você pode registrar o que está sentindo em um check-in rápido. '
      + 'Não existe resposta certa: este é um espaço seu, sem julgamentos.',
  },
  {
    imagem: require('../../../assets/images/audios_mulher.png'),
    icone: 'headset-outline',
    titulo: 'Acolhimento para cada emoção',
    texto: 'De acordo com o que você sente, o app sugere áudios e conteúdos de acolhimento. '
      + 'Os que tocarem você ficam guardados nos favoritos, com um toque no coração.',
  },
  {
    imagem: require('../../../assets/images/il_broto.png'),
    icone: 'star-outline',
    titulo: 'Pequenas vitórias',
    texto: 'Levantar da cama, tomar um café com calma, sair para caminhar: tudo isso conta. '
      + 'Aqui você guarda as conquistas do dia a dia, do tamanho que elas tiverem.',
    notaPlanos: true,
  },
  {
    imagem: require('../../../assets/images/il_caminho_jornada.png'),
    icone: 'bar-chart-outline',
    titulo: 'Olhar para o caminho',
    texto: 'Nos relatórios, seus check-ins viram um retrato de como você tem se sentido ao longo '
      + 'dos dias. Sem cobranças: é só um jeito carinhoso de perceber o próprio caminho.',
    notaPlanos: true,
  },
  {
    imagem: require('../../../assets/images/il_rede_apoio.png'),
    icone: 'gift-outline',
    titulo: 'Cuide-se',
    texto: 'Nas parcerias do Cuide-se você encontra benefícios pensados para o seu bem-estar. '
      + 'Os cupons que você gerar ficam em "Meus cupons", no ícone de ingresso no topo da tela inicial.',
  },
  {
    imagem: require('../../../assets/images/il_onda_coracao.png'),
    icone: 'notifications-outline',
    titulo: 'Um lembrete gentil',
    texto: 'Você pode escolher um horário para lembrarmos do seu check-in, e o sino guarda as '
      + 'mensagens que preparamos para você. Tudo isso fica no menu do topo da tela inicial.',
    acao: { rotulo: 'Escolher o horário do lembrete', destino: 'Lembrete' },
  },
];

const NOTA_PLANOS = 'Alguns recursos fazem parte dos planos. Você escolhe o seu ritmo.';

// As ilustrações são aquarelas num cartão de papel arredondado sobre fundo
// branco (sem transparência). Ampliamos um pouco e recortamos nas bordas do
// próprio cartão, para ele "flutuar" sobre a aurora sem o quadrado branco.
function Ilustracao({ source, tamanho }) {
  const raio = Math.round(tamanho * 0.12);
  const extra = tamanho * 0.08;
  return (
    <View style={[s.ilMoldura, { width: tamanho, height: tamanho, borderRadius: raio }]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: raio, overflow: 'hidden' }]}>
        <Image
          source={source}
          resizeMode="cover"
          style={{
            position: 'absolute', left: -extra, top: -extra,
            width: tamanho + extra * 2, height: tamanho + extra * 2,
            opacity: colors.escuro ? 0.9 : 1,
          }}
        />
      </View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.ilBorda, { borderRadius: raio }]} />
    </View>
  );
}

// Botão principal: degradê lilás com "degrau" que afunda ao toque.
function BotaoLilas({ onPress, children, rotulo }) {
  return (
    <Profundo
      externo={s.btnExterno}
      estilo={s.btnFace}
      base={colors.botaoBase}
      sombra={s.btnHalo}
      onPress={onPress}
      accessibilityLabel={rotulo}
    >
      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.btnGrad} />
      {children}
    </Profundo>
  );
}

// Tour do app.
// - Primeiro acesso: aparece uma única vez, para contas novas (o cadastro grava
//   onboardingPendente: true no perfil). Ao terminar, grava false e recomeça a
//   pilha na tela inicial (ou no primeiro check-in).
// - Revisita (`{ revisita: true }`, aberto pelo menu da tela inicial): não grava
//   nada no perfil; ao terminar ou pular, apenas volta para onde estava.
export default function OnboardingScreen({ navigation, route }) {
  const revisita = route?.params?.revisita === true;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { perfil, atualizarPerfil } = useAuth();
  const [passo, setPasso] = useState(0);
  const rolagem = useRef(null);

  const nome = perfil?.apelido || perfil?.nome?.split(' ')[0] || '';
  const ultimo = passo === PASSOS.length - 1;
  const tamanhoImagem = Math.round(Math.min(height * 0.3, 260, width - 96));

  const irPara = (i) => {
    setPasso(i);
    rolagem.current?.scrollTo({ x: i * width, animated: true });
  };

  // No Android, o botão voltar recua um passo em vez de fechar o app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (passo > 0) { irPara(passo - 1); return true; }
      return false;
    });
    return () => sub.remove();
  }, [passo, width]);

  const concluir = (destino) => {
    if (revisita) {
      if (destino && destino !== 'MainTabs') navigation.replace(destino);
      else navigation.goBack();
      return;
    }
    atualizarPerfil({ onboardingPendente: false }).catch(() => {});
    const irDireto = destino && destino !== 'MainTabs';
    navigation.reset({
      index: irDireto ? 1 : 0,
      routes: irDireto ? [{ name: 'MainTabs' }, { name: destino }] : [{ name: 'MainTabs' }],
    });
  };

  return (
    <View style={s.raiz}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />

      <View style={[s.topo, { paddingTop: insets.top + 8 }]}>
        <View style={s.contadorChip}>
          <Text style={s.contador}>{passo + 1} de {PASSOS.length}</Text>
        </View>
        {!ultimo ? (
          <TouchableOpacity onPress={() => concluir('MainTabs')} hitSlop={8} style={s.pularBtn} activeOpacity={0.8}>
            <Text style={s.pular}>{revisita ? 'Fechar' : 'Pular'}</Text>
          </TouchableOpacity>
        ) : <View style={{ height: 40 }} />}
      </View>

      <ScrollView
        ref={rolagem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setPasso(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {PASSOS.map((p, i) => (
          <ScrollView
            key={i}
            style={{ width }}
            contentContainerStyle={s.passo}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.imagem}>
              <Ilustracao source={p.imagem} tamanho={tamanhoImagem} />
            </View>
            {i === 0 && !revisita && !!nome && <Text style={s.boasVindas}>Boas-vindas, {nome}</Text>}
            {i === 0 && revisita && <Text style={s.boasVindas}>Tour do app</Text>}
            <View style={s.tituloLinha}>
              <View style={s.tituloIcone}>
                <Ionicons name={p.icone} size={20} color={colors.lilasIcone} />
              </View>
            </View>
            <ScriptTitle size={32} style={s.titulo}>{p.titulo}</ScriptTitle>
            <Text style={s.texto}>{p.texto}</Text>
            {(p.notaPlanos || i === PASSOS.length - 1) && (
              <View style={s.notaPlanos}>
                <Ionicons name="diamond-outline" size={14} color={colors.lilasIcone} />
                <Text style={s.notaPlanosTxt}>{NOTA_PLANOS}</Text>
              </View>
            )}
            {p.acao && (
              <TouchableOpacity style={s.acao} onPress={() => concluir(p.acao.destino)} activeOpacity={0.8}>
                <Ionicons name="time-outline" size={18} color={colors.lilasIcone} />
                <Text style={s.acaoTxt}>{p.acao.rotulo}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        ))}
      </ScrollView>

      <View style={[s.rodape, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={s.pontos}>
          {PASSOS.map((_, i) => (
            <View key={i} style={[s.ponto, i === passo && s.pontoAtivo]} />
          ))}
        </View>

        {ultimo && revisita ? (
          <BotaoLilas onPress={() => concluir()} rotulo="Concluir o tour">
            <Text style={s.btnPrincipalTxt}>Concluir o tour</Text>
            <Ionicons name="checkmark" size={18} color="white" />
          </BotaoLilas>
        ) : ultimo ? (
          <>
            <BotaoLilas onPress={() => concluir('CheckIn')} rotulo="Fazer meu primeiro check-in">
              <Text style={s.btnPrincipalTxt}>Fazer meu primeiro check-in</Text>
              <Ionicons name="heart-outline" size={18} color="white" />
            </BotaoLilas>
            <TouchableOpacity style={s.btnSecundario} onPress={() => concluir('MainTabs')} activeOpacity={0.7}>
              <Text style={s.btnSecundarioTxt}>Explorar o app primeiro</Text>
            </TouchableOpacity>
          </>
        ) : (
          <BotaoLilas onPress={() => irPara(passo + 1)} rotulo="Continuar">
            <Text style={s.btnPrincipalTxt}>Continuar</Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </BotaoLilas>
        )}
      </View>
    </View>
  );
}

const s = criarEstilos(() => ({
  raiz: { flex: 1, backgroundColor: colors.bg },
  topo: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
  },
  contadorChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  contador: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.texto2, letterSpacing: 0.3 },
  pularBtn: {
    minHeight: 40, paddingHorizontal: 16, borderRadius: radius.full, justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  pular: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.lilasTexto },

  passo: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  imagem: { alignItems: 'center', marginBottom: spacing.xl },
  ilMoldura: {
    backgroundColor: colors.cardSolido,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 14 }, shadowOpacity: colors.escuro ? 0.45 : 0.16, shadowRadius: 26, elevation: 4,
  },
  ilBorda: { borderWidth: 1, borderColor: colors.bordaLuz },
  boasVindas: {
    fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lilasTexto,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
  },
  tituloLinha: { alignItems: 'center', marginBottom: 10 },
  tituloIcone: {
    width: 44, height: 44, borderRadius: 15, backgroundColor: colors.lav1,
    alignItems: 'center', justifyContent: 'center',
  },
  titulo: { textAlign: 'center', marginBottom: spacing.md, color: colors.titulo, lineHeight: 38 },
  texto: {
    fontFamily: fonts.body, fontSize: 16, color: colors.texto2,
    textAlign: 'center', lineHeight: 25, maxWidth: 460,
  },

  notaPlanos: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing.lg,
    backgroundColor: colors.lav1, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 14,
  },
  notaPlanosTxt: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.lilasTexto, flexShrink: 1 },
  acao: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg,
    minHeight: 48, paddingHorizontal: 20, borderRadius: radius.full,
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.lav2,
  },
  acaoTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },

  rodape: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, alignItems: 'center' },
  pontos: { flexDirection: 'row', gap: 7, marginBottom: spacing.lg },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lav2 },
  pontoAtivo: { width: 24, backgroundColor: colors.botao },
  btnExterno: { width: '100%', maxWidth: 420 },
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, paddingHorizontal: 22, overflow: 'hidden' },
  btnGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 5 },
  btnPrincipalTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: 'white' },
  btnSecundario: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, marginTop: 6 },
  btnSecundarioTxt: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.lilasTexto, textDecorationLine: 'underline' },
}));
