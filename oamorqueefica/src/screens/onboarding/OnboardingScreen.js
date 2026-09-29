import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Image,
  useWindowDimensions, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { LavandaBg, ScriptTitle } from '../../components';
import { useAuth } from '../../hooks/AuthContext';

const PASSOS = [
  {
    imagem: require('../../../assets/images/il_coracao_ramos.png'),
    titulo: 'Como você está hoje?',
    texto: 'Todos os dias você pode registrar o que está sentindo em um check-in rápido. '
      + 'Não existe resposta certa: este é um espaço seu, sem julgamentos.',
  },
  {
    imagem: require('../../../assets/images/audios_mulher.png'),
    titulo: 'Acolhimento para cada emoção',
    texto: 'De acordo com o que você sente, o app sugere áudios e conteúdos de acolhimento. '
      + 'Os que tocarem você ficam guardados nos favoritos, com um toque no coração.',
  },
  {
    imagem: require('../../../assets/images/il_rede_apoio.png'),
    titulo: 'Você não caminha só',
    texto: 'Com o tempo, você pode reunir pessoas de confiança, lembrar datas importantes e '
      + 'aproveitar descontos das parcerias do Cuide-se. Alguns recursos fazem parte dos '
      + 'planos — você escolhe o seu ritmo.',
  },
];

// Apresentação do primeiro acesso: aparece uma única vez, para contas novas
// (o cadastro grava onboardingPendente: true no perfil).
export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { perfil, atualizarPerfil } = useAuth();
  const [passo, setPasso] = useState(0);
  const rolagem = useRef(null);

  const nome = perfil?.apelido || perfil?.nome?.split(' ')[0] || '';
  const ultimo = passo === PASSOS.length - 1;
  const alturaImagem = Math.min(height * 0.36, 320);

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
    atualizarPerfil({ onboardingPendente: false }).catch(() => {});
    navigation.reset({
      index: destino === 'CheckIn' ? 1 : 0,
      routes: destino === 'CheckIn' ? [{ name: 'MainTabs' }, { name: 'CheckIn' }] : [{ name: 'MainTabs' }],
    });
  };

  return (
    <View style={s.raiz}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LavandaBg />

      <View style={[s.topo, { paddingTop: insets.top + 8 }]}>
        <Text style={s.contador}>{passo + 1} de {PASSOS.length}</Text>
        {!ultimo ? (
          <TouchableOpacity onPress={() => concluir('MainTabs')} hitSlop={12}>
            <Text style={s.pular}>Pular</Text>
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
            {i === 0 && !!nome && <Text style={s.boasVindas}>Boas-vindas, {nome}</Text>}
            <ScriptTitle size={28} style={s.titulo}>{p.titulo}</ScriptTitle>
            <Text style={s.texto}>{p.texto}</Text>
          </ScrollView>
        ))}
      </ScrollView>

      <View style={[s.rodape, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={s.pontos}>
          {PASSOS.map((_, i) => (
            <View key={i} style={[s.ponto, i === passo && s.pontoAtivo]} />
          ))}
        </View>

        {ultimo ? (
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

const s = StyleSheet.create({
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
  titulo: { textAlign: 'center', marginBottom: spacing.md },
  texto: {
    fontFamily: fonts.body, fontSize: 15, color: colors.tm,
    textAlign: 'center', lineHeight: 23, maxWidth: 420,
  },

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
});
