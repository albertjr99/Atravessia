import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Image,
  useWindowDimensions, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg, ScriptTitle } from '../../components';
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
  const alturaImagem = Math.min(height * 0.32, 290);

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
        <Text style={s.contador}>{passo + 1} de {PASSOS.length}</Text>
        {!ultimo ? (
          <TouchableOpacity onPress={() => concluir('MainTabs')} hitSlop={12}>
            <Text style={s.pular}>{revisita ? 'Fechar' : 'Pular'}</Text>
          </TouchableOpacity>
        ) : <View />}
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
            <Image source={p.imagem} style={[s.imagem, { height: alturaImagem }]} resizeMode="contain" />
            {i === 0 && !revisita && !!nome && <Text style={s.boasVindas}>Boas-vindas, {nome}</Text>}
            {i === 0 && revisita && <Text style={s.boasVindas}>Tour do app</Text>}
            <View style={s.tituloLinha}>
              <View style={s.tituloIcone}>
                <Ionicons name={p.icone} size={16} color={colors.lav5} />
              </View>
            </View>
            <ScriptTitle size={28} style={s.titulo}>{p.titulo}</ScriptTitle>
            <Text style={s.texto}>{p.texto}</Text>
            {(p.notaPlanos || i === PASSOS.length - 1) && (
              <View style={s.notaPlanos}>
                <Ionicons name="diamond-outline" size={12} color={colors.lav5} />
                <Text style={s.notaPlanosTxt}>{NOTA_PLANOS}</Text>
              </View>
            )}
            {p.acao && (
              <TouchableOpacity style={s.acao} onPress={() => concluir(p.acao.destino)} activeOpacity={0.8}>
                <Ionicons name="time-outline" size={15} color={colors.lav5} />
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
          <TouchableOpacity style={s.btnPrincipal} onPress={() => concluir()} activeOpacity={0.85}>
            <Text style={s.btnPrincipalTxt}>Concluir o tour</Text>
            <Ionicons name="checkmark" size={17} color="white" />
          </TouchableOpacity>
        ) : ultimo ? (
          <>
            <TouchableOpacity style={s.btnPrincipal} onPress={() => concluir('CheckIn')} activeOpacity={0.85}>
              <Text style={s.btnPrincipalTxt}>Fazer meu primeiro check-in</Text>
              <Ionicons name="heart-outline" size={17} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSecundario} onPress={() => concluir('MainTabs')} activeOpacity={0.7}>
              <Text style={s.btnSecundarioTxt}>Explorar o app primeiro</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={s.btnPrincipal} onPress={() => irPara(passo + 1)} activeOpacity={0.85}>
            <Text style={s.btnPrincipalTxt}>Continuar</Text>
            <Ionicons name="arrow-forward" size={17} color="white" />
          </TouchableOpacity>
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
  contador: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, letterSpacing: 0.4 },
  pular: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.lav5 },

  passo: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  imagem: { width: '100%', marginBottom: spacing.lg },
  boasVindas: {
    fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.lav5,
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
  },
  tituloLinha: { alignItems: 'center', marginBottom: 6 },
  tituloIcone: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.lav1,
    alignItems: 'center', justifyContent: 'center',
  },
  titulo: { textAlign: 'center', marginBottom: spacing.md },
  texto: {
    fontFamily: fonts.body, fontSize: 15, color: colors.tm,
    textAlign: 'center', lineHeight: 23, maxWidth: 420,
  },

  notaPlanos: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md,
    backgroundColor: colors.lav1, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12,
  },
  notaPlanosTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.lav6 },
  acao: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.lav3, borderRadius: radius.full,
    paddingVertical: 9, paddingHorizontal: 16,
  },
  acaoTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav5 },

  rodape: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, alignItems: 'center' },
  pontos: { flexDirection: 'row', gap: 7, marginBottom: spacing.lg },
  ponto: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lav2 },
  pontoAtivo: { width: 22, backgroundColor: colors.lav5 },
  btnPrincipal: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', maxWidth: 420, paddingVertical: 15, borderRadius: radius.full,
    backgroundColor: colors.lav5,
  },
  btnPrincipalTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: 'white' },
  btnSecundario: { paddingVertical: 12, marginTop: 4 },
  btnSecundarioTxt: { fontFamily: fonts.body, fontSize: 13.5, color: colors.lav5, textDecorationLine: 'underline' },
}));
