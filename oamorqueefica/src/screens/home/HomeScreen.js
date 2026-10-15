import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Image, Dimensions, Modal, Pressable, Alert, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { emocoes } from '../../data';
import { ScriptTitle, LavandaBg } from '../../components';
import { LogoRespira, Vidro, Profundo } from '../../components/Efeitos';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { confirmar } from '../../utils/confirm';
import { urlDeImagem } from '../../utils/imagemUrl';
import { situacaoCupom } from '../../utils/cupons';
import { hojeStrBR } from '../../utils/date';
import { carregarPreferencia, agendarLembretes } from '../../utils/lembreteCheckin';
import DiarioDoDia from '../../components/DiarioDoDia';
import { escolherEnviarFoto } from '../../utils/fotoPerfil';
import { brl } from '../cashback/CashbackScreen';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { IA_CONVERSA, IA_DIARIO_CARTA } from '../../config/recursos';

const headerLavender = require('../../../assets/images/header-lavender.jpg');
const logo = require('../../../assets/images/travessia_logo.png');

const ilCoracao = require('../../../assets/images/il_coracao_ramos.png');
const { width: SCREEN_W } = Dimensions.get('window');

// Barra inferior: os mesmos cinco atalhos, com a AtravessIA no meio.
const NAV_ESQUERDA = [
  { name: 'Início', icon: 'home', active: true },
  { name: 'Conteúdos', icon: 'headset', screen: 'Audios' },
  { name: 'Vitórias', icon: 'star', screen: 'PequenasVitorias' },
];
const NAV_DIREITA = [
  { name: 'Relatórios', icon: 'bar-chart', screen: 'Relatorios' },
  { name: 'Planos', icon: 'diamond', screen: 'Planos' },
];
const temIA = IA_DIARIO_CARTA || IA_CONVERSA;
const atalhosIA = [
  IA_CONVERSA && { icone: 'chatbubbles-outline', rotulo: 'Conversar', tela: 'ConversaIA' },
  IA_DIARIO_CARTA && { icone: 'create-outline', rotulo: 'Diário guiado', tela: 'DiarioGuiado' },
  IA_DIARIO_CARTA && { icone: 'mail-open-outline', rotulo: 'Carta do mês', tela: 'CartaMes' },
].filter(Boolean);

function ItemNav({ item, navigation }) {
  return (
    <TouchableOpacity
      style={s.navItem}
      onPress={() => item.screen && navigation.navigate(item.screen)}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityState={{ selected: !!item.active }}
    >
      <View style={[s.navIcone, item.active && s.navIconeAtivo]}>
        <Ionicons name={item.active ? item.icon : `${item.icon}-outline`} size={20} color={item.active ? colors.lilasTexto : colors.texto2} />
      </View>
      <Text style={[s.navLbl, item.active && s.navLblActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{item.name}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    usuario, notificacoes, checkins, parcerias, fraseDoDia, meusVouchers, cashback, indicacoes, temAcesso,
  } = useApp();
  // A AtravessIA (diário guiado e carta do mês) é do Plano Acolher em diante.
  const iaLiberada = temAcesso(1);
  const abrirIA = (tela) => {
    if (iaLiberada) { navigation.navigate(tela); return; }
    Alert.alert('Disponível no Plano Acolher', 'O diário guiado e a carta do mês fazem parte dos planos pagos, a partir do Plano Acolher. Deseja conhecer os planos?', [
      { text: 'Agora não', style: 'cancel' },
      { text: 'Ver planos', onPress: () => navigation.navigate('Planos') },
    ]);
  };
  const { width: larguraTela } = useWindowDimensions();
  const tablet = larguraTela >= 600;
  // Com avisos, o cartão de vidro sobe e fica por cima da aquarela; o topo cresce um pouco para caber.
  const temAvisos = cashback?.saldoCentavos > 0 || notificacoes.some(n => !n.lida);
  const alturaTopo = (tablet ? 230 : 172) + (temAvisos ? 28 : 0);
  const [reflexaoAberta, setReflexaoAberta] = useState(false);
  const [iaAberta, setIaAberta] = useState(false);
  const { sair, firebaseUser, perfil, atualizarPerfil } = useAuth();
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  // "Produtos Atravessia" só aparece depois que o painel publicar o vídeo ou o link.
  const [temProdutos, setTemProdutos] = useState(false);
  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'videos'), (snap) => {
    const p = snap.exists() ? snap.data()?.produtos : null;
    setTemProdutos(!!p && p.ativo !== false && !!(p.url || p.link));
  }, (e) => console.warn('[Home] produtos:', e?.message)), []);
  const naoLidas = notificacoes.filter(n => !n.lida).length;
  const primeiraNaoLida = notificacoes.find(n => !n.lida);
  // Cupons que ainda pedem algo dela: prontos para usar ou aguardando confirmação.
  const cuponsPendentes = (meusVouchers || []).filter(v => {
    const sit = situacaoCupom(v);
    return sit === 'ativo' || sit === 'aguardando';
  }).length;

  const uid = firebaseUser?.uid;
  const jaFezCheckinHoje = checkins.some(c => c.data === hojeStrBR());

  // Lembrete diário: os avisos são agendados para os próximos dias e refeitos
  // sempre que a tela inicial volta ao foco ou um check-in é registrado — assim
  // o lembrete de hoje some quando o check-in já foi feito.
  const reagendarLembretes = useCallback(() => {
    if (!uid) return;
    carregarPreferencia(uid, perfil?.lembreteCheckin)
      .then(pref => (pref.ativo ? agendarLembretes(pref, jaFezCheckinHoje) : null))
      .catch(e => console.warn('[Lembrete] reagendar:', e?.message));
  }, [uid, perfil?.lembreteCheckin, jaFezCheckinHoje]);
  useFocusEffect(reagendarLembretes);
  // A tela inicial fica montada por baixo das outras: quando o check-in de hoje
  // chega (mesmo com ela seguindo para outra tela), o lembrete de hoje é retirado.
  useEffect(() => {
    if (jaFezCheckinHoje) reagendarLembretes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jaFezCheckinHoje]);

  const handleSair = () => {
    confirmar('Sair da conta', 'Deseja encerrar a sessão e trocar de conta?', sair, 'Sair');
  };

  const irDoMenu = (acao) => {
    setMenuAberto(false);
    acao();
  };
  // Foto do perfil: escolher, trocar ou remover.
  const trocarFoto = async () => {
    setEnviandoFoto(true);
    try {
      const url = await escolherEnviarFoto(uid);
      if (url) await atualizarPerfil({ photoURL: url });
    } catch (e) {
      Alert.alert('Não foi possível enviar a foto', e?.message || 'Tente novamente em instantes.');
    } finally {
      setEnviandoFoto(false);
    }
  };
  const tocarFoto = () => {
    if (!perfil?.photoURL) { trocarFoto(); return; }
    Alert.alert('Sua foto', 'O que você quer fazer?', [
      { text: 'Trocar foto', onPress: trocarFoto },
      { text: 'Remover foto', style: 'destructive', onPress: () => atualizarPerfil({ photoURL: null }).catch(() => {}) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };
  const inicial = (usuario.apelido || usuario.nome || 'A').trim().charAt(0).toUpperCase();

  const itensMenu = [
    ...(IA_CONVERSA ? [{ icone: 'sparkles-outline', rotulo: 'AtravessIA', sub: 'Conversa, diário guiado e carta do mês', acao: () => navigation.navigate('AtravessIA') }] : []),
    { icone: 'wallet-outline', rotulo: 'Meu cashback', sub: cashback?.saldoCentavos > 0 ? `Saldo de ${brl(cashback.saldoCentavos)}` : 'Créditos dos cupons de parceria', acao: () => navigation.navigate('Cashback') },
    { icone: 'image-outline', rotulo: 'Foto do perfil', sub: perfil?.photoURL ? 'Trocar ou remover sua foto' : 'Personalize sua área com uma foto', acao: tocarFoto },
    { icone: 'contrast-outline', rotulo: 'Aparência', sub: 'Tema claro, noturno ou automático e vibração', acao: () => navigation.navigate('Aparencia') },
    { icone: 'time-outline', rotulo: 'Lembrete diário', sub: 'Escolha o horário do lembrete do check-in', acao: () => navigation.navigate('Lembrete') },
    { icone: 'map-outline', rotulo: 'Tour do app', sub: 'Rever a apresentação do Atravessia', acao: () => navigation.navigate('Onboarding', { revisita: true }) },
    { icone: 'ticket-outline', rotulo: 'Meus cupons', sub: 'Cupons das parcerias que você gerou', acao: () => navigation.navigate('MeusCupons') },
    { icone: 'heart-outline', rotulo: 'Favoritos', sub: 'O que você guardou com carinho', acao: () => navigation.navigate('Favoritos') },
    { icone: 'log-out-outline', rotulo: 'Sair da conta', acao: handleSair, sair: true },
  ];

  // Na tela inicial o cartão só leva ao Experimente a vida: lá o cupom ou o
  // link são acionados pelo botão de cada parceria (antes qualquer toque aqui
  // abria o link, até de parcerias de cupom).
  const handleAbrirParceria = () => navigation.navigate('Parcerias');
  const saudacao = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };
  const weekHistory = checkins.slice(-6);
  // Pílula da AtravessIA e anel do avatar: degradê lilás → pêssego.
  const gradienteIA = colors.escuro ? ['#7E69D6', '#B4716A'] : ['#B9A6F0', '#F3B9A5'];

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ===== HEADER COM AQUARELA ===== */}
        <View style={[s.headerWrap, { height: alturaTopo + insets.top }]}>
          <Image source={headerLavender} style={[s.headerImg, { height: alturaTopo + insets.top }]} resizeMode="cover" />
          {/* No noturno, um véu escurece a aquarela do topo */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.headerVeu }]} pointerEvents="none" />
          {/* Gradiente fade para o fundo */}
          <LinearGradient colors={[colors.escuro ? 'rgba(17,14,24,0)' : 'rgba(246,241,238,0)', colors.bg]} style={s.headerFade} pointerEvents="none" />
          {/* Sino notificação */}
          <TouchableOpacity style={[s.bellBtn, { top: 16 + insets.top }]} onPress={() => navigation.navigate('Notificacoes')}>
            <Vidro style={s.vidroBtn} />
            <Ionicons name={naoLidas > 0 ? 'notifications' : 'notifications-outline'} size={18} color={colors.lilasIcone} />
            {naoLidas > 0 && (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeTxt}>{naoLidas > 9 ? '9+' : naoLidas}</Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Meus cupons, ao lado do sino */}
          <TouchableOpacity
            style={[s.cupomBtn, { top: 16 + insets.top }]}
            onPress={() => navigation.navigate('MeusCupons')}
            accessibilityLabel="Meus cupons"
          >
            <Vidro style={s.vidroBtn} />
            <Ionicons name={cuponsPendentes > 0 ? 'ticket' : 'ticket-outline'} size={18} color={colors.lilasIcone} />
            {cuponsPendentes > 0 && (
              <View style={[s.bellBadge, s.cupomBadge]}>
                <Text style={s.bellBadgeTxt}>{cuponsPendentes > 9 ? '9+' : cuponsPendentes}</Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Menu: lembrete, tour, favoritos, sair */}
          <TouchableOpacity
            style={[s.menuBtn, { top: 16 + insets.top }]}
            onPress={() => setMenuAberto(true)}
            accessibilityLabel="Menu"
          >
            <Vidro style={s.vidroBtn} />
            <Ionicons name="menu-outline" size={20} color={colors.lilasIcone} />
          </TouchableOpacity>
          {/* Logo + nome do app */}
          <View style={[s.headerBottom, temAvisos && s.headerBottomAvisos]}>
            <LogoRespira source={logo} style={[s.headerLogo, tablet && s.headerLogoTablet]} />
            <Text style={[s.appTitle, tablet && s.appTitleTablet]}>Atravessia</Text>
          </View>
        </View>

        <View style={s.body}>

          {/* ===== AVISOS: cashback e mensagens num cartão de vidro sobre a aquarela ===== */}
          {temAvisos && (
            <Vidro style={s.avisos} intensidade={50}>
              {cashback?.saldoCentavos > 0 && (
                <TouchableOpacity style={[s.cashbackAviso, s.avisoNoVidro]} onPress={() => navigation.navigate('Cashback')} activeOpacity={0.85}>
                  <Ionicons name="wallet-outline" size={17} color={colors.sageFg} />
                  <Text style={s.cashbackTxt}>Você tem <Text style={s.cashbackValor}>{brl(cashback.saldoCentavos)}</Text> de cashback</Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.sageFg} />
                </TouchableOpacity>
              )}
              {naoLidas > 0 && (
                <TouchableOpacity
                  style={[s.notifLinha, cashback?.saldoCentavos > 0 && s.notifLinhaBorda]}
                  onPress={() => navigation.navigate('Notificacoes')}
                  activeOpacity={0.88}
                >
                  <View style={s.notifBannerIcon}>
                    <Ionicons name="notifications" size={17} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.notifBannerTit}>
                      {naoLidas === 1 ? 'Você tem 1 mensagem nova' : `Você tem ${naoLidas} mensagens novas`}
                    </Text>
                    <Text style={s.notifBannerSub} numberOfLines={1}>
                      {primeiraNaoLida?.texto || 'Toque para ver'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.lav5} />
                </TouchableOpacity>
              )}
            </Vidro>
          )}

          {/* Saudação */}
          <View style={s.greetSect}>
            <LinearGradient colors={['#B9A6F0', '#F3B9A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarAnel}>
            <TouchableOpacity
              style={s.avatar}
              onPress={tocarFoto}
              disabled={enviandoFoto}
              activeOpacity={0.85}
              accessibilityLabel={perfil?.photoURL ? 'Sua foto. Toque para trocar' : 'Adicionar foto do perfil'}
            >
              {perfil?.photoURL ? (
                <Image source={{ uri: perfil.photoURL }} style={s.avatarImg} />
              ) : (
                <Text style={s.avatarInicial}>{inicial}</Text>
              )}
              <View style={s.avatarBadge}>
                {enviandoFoto
                  ? <ActivityIndicator size="small" color="white" />
                  : <Ionicons name="camera" size={11} color="white" />}
              </View>
            </TouchableOpacity>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={s.greetName}>{saudacao()}, {usuario.apelido || usuario.nome}</Text>
              <Text style={s.greetSub}>Que hoje você se permita sentir, acolher e seguir.</Text>
            </View>
          </View>

          {/* ===== CHECK-IN (primeiro convite do dia) ===== */}
          <View style={s.checkinCard}>
            <Text style={s.checkinTit}>Como estou me sentindo hoje?</Text>
            <View style={s.emoGrid}>
              {emocoes.filter(e => e.positiva).map(e => (
                <TouchableOpacity key={e.id} style={s.emoCard} onPress={() => navigation.navigate('CheckIn', { emocao: e.id })} activeOpacity={0.8}>
                  <View style={[s.emoCircle, { backgroundColor: colors.escuro ? 'rgba(255,255,255,0.08)' : e.bg, borderColor: colors.escuro ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)' }]}>
                    <Ionicons name={`${e.icon}-outline`} size={22} color={colors.escuro ? e.dado || e.color : e.color} />
                  </View>
                  <Text style={s.emoLbl} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{e.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Botão com profundidade: afunda ao toque */}
            <Profundo
              estilo={s.checkinBtn}
              base={colors.botaoBase}
              sombra={s.checkinSombra}
              onPress={() => navigation.navigate('CheckIn')}
              accessibilityLabel="Fazer check-in emocional"
            >
              <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.btnGradiente} />
              <Text style={s.checkinTxt}>Fazer check-in emocional</Text>
              <Ionicons name="chevron-forward" size={18} color="white" />
            </Profundo>
          </View>

          {/* ===== SEU DIA (começa recolhido; um toque abre) ===== */}
          <View style={s.seuDia}>
            <DiarioDoDia navigation={navigation} recolhidoPadrao />
          </View>

          {/* ===== FRASE DO DIA + REFLEXÃO DO DIA ===== */}
          <View style={s.fraseCard}>
            {fraseDoDia && (
              <>
                <View style={s.fraseTagRow}>
                  <Ionicons name="sunny-outline" size={13} color={colors.lilasIcone} />
                  <Text style={s.fraseTag}>Frase do dia</Text>
                  <Image source={ilCoracao} style={s.fraseIl} resizeMode="contain" />
                </View>
                <Text style={s.fraseTxt}>"{fraseDoDia.texto}"</Text>
                {fraseDoDia.autor ? <Text style={s.fraseAutor}>— {fraseDoDia.autor}</Text> : null}
                <View style={s.fraseDivisor} />
              </>
            )}
            {/* Reflexão começa recolhida; a seta abre e fecha. */}
            <TouchableOpacity
              style={s.reflexaoCab}
              onPress={() => setReflexaoAberta(a => !a)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ expanded: reflexaoAberta }}
              accessibilityLabel={reflexaoAberta ? 'Recolher a reflexão do dia' : 'Abrir a reflexão do dia'}
            >
              <View style={s.sectTitleRow}>
                <Ionicons name="moon-outline" size={13} color={colors.lilasIcone} />
                <Text style={s.fraseTag}>Reflexão do dia</Text>
              </View>
              <Ionicons name={reflexaoAberta ? 'chevron-up' : 'chevron-down'} size={20} color={colors.lilasIcone} />
            </TouchableOpacity>
            {reflexaoAberta && (
              <Text style={s.reflexaoTxt}>{fraseDoDia?.reflexao || 'Cada dia traz uma nova chance de cuidar de si. Permita-se sentir, acolher e seguir.'}</Text>
            )}
          </View>

          {/* ===== ATRAVESSIA (por ora: diário guiado e carta do mês) ===== */}
          {(IA_DIARIO_CARTA || IA_CONVERSA) && (
            <View style={s.sect}>
              <View style={s.iaCard}>
                <TouchableOpacity
                  style={s.iaTopo}
                  onPress={() => abrirIA('AtravessIA')}
                  disabled={!IA_CONVERSA}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={gradienteIA} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iaAvatar}>
                    <Ionicons name="sparkles" size={20} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={s.iaTit}>AtravessIA</Text>
                    <Text style={s.iaSub}>
                      {!iaLiberada
                        ? 'Disponível a partir do Plano Acolher'
                        : IA_CONVERSA ? 'Converse, escreva no diário guiado ou leia sua carta do mês' : 'Escreva no diário guiado ou leia sua carta do mês'}
                    </Text>
                  </View>
                  {IA_CONVERSA && <Ionicons name="chevron-forward" size={18} color={colors.tl} />}
                </TouchableOpacity>
                <View style={s.iaAtalhos}>
                  {atalhosIA.map(a => (
                    <TouchableOpacity key={a.tela} style={[s.iaAtalho, !iaLiberada && s.iaAtalhoBloq]} onPress={() => abrirIA(a.tela)} activeOpacity={0.8}>
                      <View style={[s.pilula, { backgroundColor: a.tela === 'CartaMes' ? colors.roseFundo : colors.lav1 }]}>
                        <Ionicons name={iaLiberada ? a.icone : 'lock-closed-outline'} size={17} color={!iaLiberada ? colors.tl : a.tela === 'CartaMes' ? colors.roseTexto : colors.lav5} />
                      </View>
                      <Text style={s.iaAtalhoTxt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{a.rotulo}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ===== ACESSO RÁPIDO (os mesmos atalhos, numa grade) ===== */}
          <View style={s.sect}>
            <Text style={s.sectTitle}>Acesso rápido</Text>
            <View style={s.perfilGrid}>
              <TouchableOpacity style={s.perfilCard} onPress={() => navigation.navigate('Audios')} activeOpacity={0.85}>
                <View style={[s.pilula, { backgroundColor: colors.sageFundo }]}>
                  <Ionicons name="headset-outline" size={19} color={colors.sageFg} />
                </View>
                <Text style={s.perfilLbl}>Conteúdos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.perfilCard} onPress={() => navigation.navigate('PequenasVitorias')} activeOpacity={0.85}>
                <View style={[s.pilula, { backgroundColor: colors.douradoFundo }]}>
                  <Ionicons name="star-outline" size={19} color={colors.douradoTitulo} />
                </View>
                <Text style={s.perfilLbl}>Pequenas Vitórias</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.perfilCard} onPress={() => navigation.navigate('Relatorios')} activeOpacity={0.85}>
                <View style={[s.pilula, { backgroundColor: colors.lav1 }]}>
                  <Ionicons name="bar-chart-outline" size={19} color={colors.lav5} />
                </View>
                <Text style={s.perfilLbl}>Relatórios</Text>
              </TouchableOpacity>
            </View>

            <View style={s.dupla}>
              <Profundo
                externo={s.vidaExterno}
                estilo={s.vidaTile}
                raio={18}
                altura={4}
                base={colors.joiaPessego[2]}
                sombra={s.vidaSombra}
                onPress={() => navigation.navigate('Parcerias')}
                accessibilityLabel="Experimente a vida"
              >
                <LinearGradient colors={[colors.joiaPessego[0], colors.joiaPessego[1]]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.vidaGradiente} />
                <View style={s.vidaIconCircle}>
                  <Ionicons name="gift-outline" size={20} color={colors.joiaPessegoTexto} />
                </View>
                <View>
                  <Text style={[s.vidaBtnTxt, { color: colors.joiaPessegoTexto }]}>Experimente a vida</Text>
                  <Text style={s.vidaBtnSub}>Parcerias e benefícios exclusivos</Text>
                </View>
              </Profundo>
              <Profundo
                externo={s.vidaExterno}
                estilo={s.vidaTile}
                raio={18}
                altura={4}
                base={colors.joiaLilas[2]}
                sombra={s.vidaSombra}
                onPress={() => navigation.navigate('Jornadas')}
                accessibilityLabel="Continue a travessia"
              >
                <LinearGradient colors={[colors.joiaLilas[0], colors.joiaLilas[1]]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.vidaGradiente} />
                <View style={s.vidaIconCircle}>
                  <Ionicons name="people-outline" size={20} color={colors.joiaLilasTexto} />
                </View>
                <View>
                  <Text style={[s.vidaBtnTxt, { color: colors.joiaLilasTexto }]}>Continue a travessia</Text>
                  <Text style={s.vidaBtnSub}>Eu caminho junto com você</Text>
                </View>
              </Profundo>
            </View>

            {(indicacoes?.length > 0 || temProdutos) && (
              <View style={s.dupla}>
                {indicacoes?.length > 0 && (
                  <TouchableOpacity style={s.indicacoesTile} onPress={() => navigation.navigate('Indicacoes')} activeOpacity={0.88}>
                    <View style={s.indicacoesIcone}>
                      <Ionicons name="book-outline" size={20} color={colors.lav5} />
                    </View>
                    <View>
                      <Text style={s.indicacoesTit}>Indicações Atravessia</Text>
                      <Text style={s.indicacoesSub}>Livros e cuidados escolhidos com carinho</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {temProdutos && (
                  <TouchableOpacity style={s.produtosTile} onPress={() => navigation.navigate('Produtos')} activeOpacity={0.88}>
                    <LinearGradient colors={[colors.joiaDourado[0], colors.joiaDourado[1]]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.vidaGradiente} />
                    <View style={s.tileTopo}>
                      <View style={s.produtosIcone}>
                        <Ionicons name="bag-handle-outline" size={20} color="#8A6A33" />
                      </View>
                      <View style={s.produtosPlay}>
                        <Ionicons name="play" size={12} color="white" style={{ marginLeft: 2 }} />
                      </View>
                    </View>
                    <View>
                      <Text style={s.produtosTit}>Produtos Atravessia</Text>
                      <Text style={s.produtosSub}>Canecas, cadernos e mais com a nossa marca</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* ===== PARCERIAS ===== */}
          {parcerias.length > 0 && (
            <View style={s.sect}>
              <View style={s.sectHeaderRow}>
                <View style={s.sectTitleRow}>
                  <Ionicons name="gift-outline" size={14} color={colors.lilasIcone} />
                  <Text style={s.sectTitle}>Espaço para Parcerias</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Parcerias')}>
                  <Text style={s.sectLink}>Ver todas</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 10, paddingRight: spacing.lg }}>
                  {parcerias.slice(0, 5).map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={s.parceriaCard}
                      onPress={() => handleAbrirParceria(p)}
                      activeOpacity={0.85}
                    >
                      {p.imagemUrl ? (
                        <Image source={{ uri: urlDeImagem(p.imagemUrl) }} style={s.parceriaImg} resizeMode="cover" />
                      ) : (
                        <View style={[s.parceriaImg, s.parceriaImgPlaceholder]}>
                          <Ionicons name="gift-outline" size={22} color={colors.lav4} />
                        </View>
                      )}
                      <View style={s.parceriaInfo}>
                        <Text style={s.parceriaTit} numberOfLines={2}>{p.titulo}</Text>
                        {(p.categorias || []).length > 0 && (
                          <Text style={s.parceriaCat}>{p.categorias[0]}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={s.parceriaVerTodas}
                    onPress={() => navigation.navigate('Parcerias')}
                  >
                    <Ionicons name="arrow-forward-circle-outline" size={28} color={colors.lav4} />
                    <Text style={s.parceriaVerTodasTxt}>Ver{'\n'}todas</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          )}

          {/* Disclaimer */}
          <Text style={s.disclaimer}>
            Este aplicativo oferece acolhimento e não substitui atendimento médico ou psicológico.
          </Text>
        </View>

      </ScrollView>

      {/* ===== MENU ===== */}
      <Modal visible={menuAberto} transparent animationType="fade" onRequestClose={() => setMenuAberto(false)}>
        <Pressable style={s.menuFundo} onPress={() => setMenuAberto(false)}>
          <Pressable style={[s.menuCaixa, { marginTop: insets.top + 64 }]} onPress={() => {}}>
            {itensMenu.map((item, i) => (
              <TouchableOpacity
                key={item.rotulo}
                style={[s.menuItem, i > 0 && s.menuItemBorda]}
                onPress={() => irDoMenu(item.acao)}
                activeOpacity={0.7}
              >
                <View style={[s.menuIcone, item.sair && s.menuIconeSair]}>
                  <Ionicons name={item.icone} size={18} color={item.sair ? colors.roseTexto : colors.lav5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.menuRotulo, item.sair && { color: colors.roseTexto }]}>{item.rotulo}</Text>
                  {!!item.sub && <Text style={s.menuSub}>{item.sub}</Text>}
                </View>
                {!item.sair && <Ionicons name="chevron-forward" size={16} color={colors.tl} />}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== ATRAVESSIA: escolha rápida pelo botão central do rodapé ===== */}
      <Modal visible={iaAberta} transparent animationType="fade" onRequestClose={() => setIaAberta(false)}>
        <Pressable style={s.iaFolhaFundo} onPress={() => setIaAberta(false)}>
          <Pressable style={[s.iaFolha, { marginBottom: Math.max(insets.bottom, 12) + 92 }]} onPress={() => {}}>
            <View style={s.iaFolhaTopo}>
              <LinearGradient colors={gradienteIA} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iaAvatar}>
                <Ionicons name="sparkles" size={20} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={s.iaTit}>AtravessIA</Text>
                <Text style={s.iaSub}>{IA_CONVERSA ? 'Converse, escreva no diário guiado ou leia sua carta do mês' : 'Escreva no diário guiado ou leia sua carta do mês'}</Text>
              </View>
            </View>
            {atalhosIA.map(a => (
              <TouchableOpacity key={a.tela} style={s.iaFolhaItem} onPress={() => { setIaAberta(false); abrirIA(a.tela); }} activeOpacity={0.8}>
                <View style={[s.pilula, { backgroundColor: a.tela === 'CartaMes' ? colors.roseFundo : colors.lav1 }]}>
                  <Ionicons name={a.icone} size={17} color={a.tela === 'CartaMes' ? colors.roseTexto : colors.lav5} />
                </View>
                <Text style={s.iaFolhaRotulo}>{a.rotulo}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.tl} />
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== BARRA INFERIOR: cápsula de vidro com a AtravessIA em destaque no meio ===== */}
      <View style={[s.bnavWrap, { paddingBottom: Math.max(insets.bottom, 8) }]} pointerEvents="box-none">
        <Vidro style={s.bnav} intensidade={45}>
          <View style={s.bnavLado}>
            {NAV_ESQUERDA.map(item => <ItemNav key={item.name} item={item} navigation={navigation} />)}
          </View>
          {temIA && <View style={s.bnavCentroVaga} />}
          <View style={s.bnavLado}>
            {NAV_DIREITA.map(item => <ItemNav key={item.name} item={item} navigation={navigation} />)}
          </View>
        </Vidro>
        {temIA && (
          <View style={[s.iaBotaoLinha, { bottom: Math.max(insets.bottom, 8) + 14 }]} pointerEvents="box-none">
          <TouchableOpacity
            style={s.iaBotao}
            onPress={() => (iaLiberada ? setIaAberta(true) : abrirIA('DiarioGuiado'))}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="AtravessIA"
          >
            <LinearGradient colors={[colors.botao, colors.botaoForte]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iaBotaoCirculo}>
              <Ionicons name="sparkles" size={24} color="#fff" />
            </LinearGradient>
            <Text style={s.iaBotaoTxt}>AtravessIA</Text>
          </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: 130 },

  // Header
  headerWrap: { position: 'relative', height: 150 },
  headerImg: { width: '100%', height: 150 },
  headerFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 },
  bellBtn: {
    position: 'absolute', right: 16, top: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute', right: 1, top: 1,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#C9435C',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  bellBadgeTxt: {
    fontFamily: 'Figtree_700Bold', fontSize: 10, color: '#fff', lineHeight: 13,
  },

  notifBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.lav1, borderRadius: 16,
    borderWidth: 1, borderColor: colors.lav2,
    paddingVertical: 13, paddingHorizontal: 14,
    marginBottom: 18,
    shadowColor: '#6b5b7a', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 3,
  },
  notifBannerIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.lav4,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifBannerTit: {
    fontFamily: 'Figtree_700Bold', fontSize: 13.5, color: colors.td,
  },
  notifBannerSub: {
    fontFamily: 'Figtree_400Regular', fontSize: 11.5, color: colors.tm, marginTop: 2,
  },
  cupomBtn: {
    position: 'absolute', right: 68, top: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  cupomBadge: { backgroundColor: '#3E7A55' },
  menuBtn: {
    position: 'absolute', left: 16, top: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  menuFundo: { flex: 1, backgroundColor: colors.sobreposicao, paddingHorizontal: 16, alignItems: 'flex-start' },
  menuCaixa: {
    width: '100%', maxWidth: 340, backgroundColor: colors.cardSolido, borderRadius: 26,
    paddingVertical: 6, paddingHorizontal: 6, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.22, shadowRadius: 28, elevation: 10,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10 },
  menuItemBorda: { borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  menuIcone: {
    width: 38, height: 38, borderRadius: 13, backgroundColor: colors.lav1,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconeSair: { backgroundColor: colors.roseFundo },
  menuRotulo: { fontFamily: 'Figtree_700Bold', fontSize: 14.5, color: colors.titulo },
  menuSub: { fontFamily: 'Figtree_400Regular', fontSize: 11.5, color: colors.texto2, marginTop: 1 },
  headerLogo: { width: 56, height: 56, borderRadius: 16 },
  headerLogoTablet: { width: 76, height: 76, borderRadius: 18 },
  appTitleTablet: { fontSize: 50 },
  headerBottom: {
    position: 'absolute', bottom: 12, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  appTitle: {
    fontFamily: 'CormorantGaramond_600SemiBold_Italic',
    fontSize: 38, color: colors.escuro ? colors.titulo : '#45358A',
    letterSpacing: 0.3,
  },

  body: { paddingHorizontal: 16 },

  // Saudação
  greetSect: { marginTop: 22, marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: colors.cardSolido,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 54, height: 54, borderRadius: 27 },
  avatarInicial: { fontFamily: 'CormorantGaramond_600SemiBold_Italic', fontSize: 30, color: colors.lav6 },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.lav4, borderWidth: 2, borderColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  greetName: {
    fontFamily: 'CormorantGaramond_600SemiBold_Italic',
    fontSize: 31, lineHeight: 36, color: colors.titulo,
  },
  greetSub: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 14.5, color: colors.texto2, marginTop: 2, lineHeight: 20,
  },
  greetIl: { width: 80, height: 80, marginLeft: 8 },

  // Frase
  fraseCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 3,
    borderRadius: 28, padding: 22, paddingTop: 18,
    marginBottom: 16,
  },
  fraseTagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginBottom: 12,
  },
  fraseIl: { width: 36, height: 36, marginLeft: 'auto', borderRadius: 12 },
  fraseTag: {
    fontFamily: 'Figtree_700Bold', fontSize: 12,
    color: colors.lilasTexto, letterSpacing: 1.2, textTransform: 'uppercase',
  },
  fraseTxt: {
    fontFamily: 'CormorantGaramond_500Medium_Italic',
    fontSize: 25, color: colors.titulo, lineHeight: 33, textAlign: 'center',
  },
  fraseAutor: {
    fontFamily: 'Figtree_400Regular', fontSize: 12,
    color: colors.texto2, textAlign: 'center', marginTop: 8,
  },

  // Section
  sect: { marginBottom: 22 },
  sectTitle: { fontFamily: 'Figtree_700Bold', fontSize: 19, color: colors.titulo, marginBottom: 12 },
  sectHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectLink: { fontFamily: 'Figtree_700Bold', fontSize: 13.5, color: colors.lilasTexto },

  // Emoções
  emoGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, marginTop: 14, marginBottom: 16 },
  emoCard: { flex: 1, alignItems: 'center', gap: 7 },
  emoCircle: {
    width: 54, height: 54, borderRadius: 27, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2,
  },
  emoLbl: { fontFamily: 'Figtree_600SemiBold', fontSize: 11, color: colors.texto2, textAlign: 'center' },

  // Perfil e cuidados
  perfilGrid: { flexDirection: 'row', gap: 10 },
  perfilCard: {
    flex: 1, gap: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 3,
    borderRadius: 22, paddingVertical: 14, paddingHorizontal: 12,
  },
  perfilLbl: { fontFamily: 'Figtree_700Bold', fontSize: 13.5, color: colors.titulo },

  // Experimente a vida
  vidaBtn: {
    marginTop: 10,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#5C3FA0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  vidaBtnInner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 18, paddingHorizontal: 18,
    backgroundColor: '#7B5EA7',
  },
  vidaIconCircle: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: colors.escuro ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  vidaBtnTxt: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: colors.titulo },
  vidaBtnSub: { fontFamily: 'Figtree_400Regular', fontSize: 12.5, color: colors.texto2, marginTop: 3, lineHeight: 17 },

  // AtravessIA
  seuDia: { marginBottom: 16 },
  iaCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 3,
    borderRadius: 26, padding: 16,
  },
  iaTopo: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 14 },
  iaAvatar: {
    width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  iaTit: { fontFamily: 'Figtree_700Bold', fontSize: 17, color: colors.titulo },
  iaSub: { fontFamily: 'Figtree_400Regular', fontSize: 13, color: colors.texto2, marginTop: 2, lineHeight: 18 },
  iaAtalhos: { flexDirection: 'row', gap: 10 },
  iaAtalho: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 18, backgroundColor: colors.vidroTenue, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  iaAtalhoTxt: { flexShrink: 1, fontFamily: 'Figtree_700Bold', fontSize: 13.5, color: colors.titulo },

  // Cashback e Indicações
  cashbackAviso: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
    backgroundColor: colors.sageFundo, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14,
  },
  cashbackTxt: { flex: 1, fontFamily: 'Figtree_500Medium', fontSize: 14, color: colors.sageFg },
  cashbackValor: { fontFamily: 'Figtree_700Bold' },
  indicacoesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10,
    paddingVertical: 16, paddingHorizontal: 18, borderRadius: 18,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaSuave,
  },
  indicacoesIcone: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  indicacoesTit: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: colors.lav6 },
  indicacoesSub: { fontFamily: 'Figtree_400Regular', fontSize: 12.5, color: colors.texto2, marginTop: 3, lineHeight: 17 },

  // Produtos Atravessia
  produtosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10,
    paddingVertical: 16, paddingHorizontal: 18, borderRadius: 18,
    backgroundColor: colors.douradoFundo, borderWidth: 1, borderColor: colors.douradoBorda,
  },
  produtosIcone: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: colors.escuro ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  produtosTit: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: colors.joiaDouradoTexto },
  produtosSub: { fontFamily: 'Figtree_400Regular', fontSize: 12.5, color: colors.texto2, marginTop: 3, lineHeight: 17 },
  produtosPlay: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.escuro ? '#9A7A3E' : '#7E5A22',
    alignItems: 'center', justifyContent: 'center',
  },

  // Check-in btn
  checkinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.botao, borderRadius: 999, overflow: 'hidden',
    paddingVertical: 16,
  },
  checkinSombra: {
    shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 6,
  },
  checkinTxt: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: 'white' },

  // Reflexão
  reflexaoCard: {
    backgroundColor: colors.lavVeu,
    borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: colors.bordaSuave,
  },
  reflexaoTxt: {
    fontFamily: 'CormorantGaramond_500Medium_Italic',
    fontSize: 18, color: colors.lilasTexto, lineHeight: 26, marginTop: 4,
  },

  disclaimer: {
    fontFamily: 'Figtree_400Regular', fontSize: 12.5,
    color: colors.texto2, textAlign: 'center',
    lineHeight: 18, marginBottom: 20, paddingHorizontal: 12,
  },

  // Parcerias
  parceriaCard: {
    width: 156, borderRadius: 22, overflow: 'hidden',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  parceriaImg: { width: 156, height: 92 },
  parceriaImgPlaceholder: {
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center',
  },
  parceriaInfo: { padding: 10 },
  parceriaTit: { fontFamily: 'Figtree_700Bold', fontSize: 12.5, color: colors.titulo, lineHeight: 17 },
  parceriaCat: { fontFamily: 'Figtree_600SemiBold', fontSize: 11, color: colors.lilasTexto, marginTop: 3 },
  parceriaVerTodas: { width: 60, alignItems: 'center', justifyContent: 'center', gap: 4 },
  parceriaVerTodasTxt: {
    fontFamily: 'Figtree_400Regular', fontSize: 10, color: colors.lilasIcone, textAlign: 'center',
  },

  // Nav
  bnav: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 30, paddingVertical: 8, paddingHorizontal: 2,
    borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.18, shadowRadius: 26, elevation: 8,
  },
  navItem: { alignItems: 'center', gap: 2, flexGrow: 1, flexBasis: 'auto', paddingHorizontal: 2, minHeight: 50, justifyContent: 'center' },
  navLbl: { fontFamily: 'Figtree_500Medium', fontSize: 10, color: colors.texto2 },
  navLblActive: { fontFamily: 'Figtree_700Bold', color: colors.lilasTexto },

  // Proposta B: avisos juntos, check-in em destaque, atalhos em grade
  avisos: {
    marginTop: -30, marginBottom: 4, borderRadius: 22, overflow: 'hidden', zIndex: 2,
    borderWidth: 1, borderColor: colors.bordaLuz,
  },
  notifLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  notifLinhaBorda: { borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  checkinCard: {
    marginBottom: 14, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 16, borderRadius: 28,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 3,
  },
  reflexaoCab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  iaAtalhoBloq: { opacity: 0.75 },
  fraseDivisor: { height: 1, backgroundColor: colors.bordaSuave, marginVertical: 16 },
  dupla: { flexDirection: 'row', gap: 10, marginTop: 12 },
  vidaTile: {
    flex: 1, minHeight: 128, padding: 14, borderRadius: 24, gap: 12, justifyContent: 'space-between',
    backgroundColor: colors.joiaLilas[1], overflow: 'hidden',
    borderWidth: 1, borderColor: colors.escuro ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.7)',
  },
  indicacoesTile: {
    flex: 1, minHeight: 124, padding: 14, borderRadius: 24, gap: 12, justifyContent: 'space-between',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 3,
  },
  produtosTile: {
    flex: 1, minHeight: 124, padding: 14, borderRadius: 24, gap: 12, justifyContent: 'space-between',
    backgroundColor: colors.joiaDourado[1], overflow: 'hidden',
    borderWidth: 1, borderColor: colors.escuro ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.7)',
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  vidaExterno: { flex: 1 },
  vidaSombra: {
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16, shadowRadius: 18, elevation: 4,
  },
  vidaGradiente: { ...StyleSheet.absoluteFillObject, borderRadius: 24 },
  // Vidro fosco: botões do topo e o cartão de avisos sobre a aquarela
  vidroBtn: { ...StyleSheet.absoluteFillObject, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz },
  headerBottomAvisos: { bottom: 40 },
  avisoNoVidro: { backgroundColor: 'transparent', marginBottom: 0, borderRadius: 0 },
  tileTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Luz de Vidro: pílulas de ícone, anel do avatar, rodapé com a AtravessIA no meio
  pilula: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarAnel: { width: 64, height: 64, borderRadius: 32, padding: 3 },
  checkinTit: {
    fontFamily: 'CormorantGaramond_600SemiBold_Italic', fontSize: 25, lineHeight: 30,
    color: colors.titulo, textAlign: 'center',
  },
  btnGradiente: { ...StyleSheet.absoluteFillObject, borderRadius: 999 },
  bnavWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 8 },
  bnavLado: { flex: 1, flexDirection: 'row' },
  bnavCentroVaga: { width: 66 },
  navIcone: { width: 42, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  navIconeAtivo: { backgroundColor: colors.lav1 },
  iaBotaoLinha: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  iaBotao: { alignItems: 'center', width: 84 },
  iaBotaoCirculo: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.escuro ? '#1C1726' : '#FFFFFF',
    shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 9,
  },
  iaBotaoTxt: { fontFamily: 'Figtree_700Bold', fontSize: 10.5, color: colors.lilasTexto, marginTop: 3 },
  iaFolhaFundo: { flex: 1, backgroundColor: colors.sobreposicao, justifyContent: 'flex-end', paddingHorizontal: 16 },
  iaFolha: {
    backgroundColor: colors.cardSolido, borderRadius: 28, padding: 16, gap: 8,
    borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.25, shadowRadius: 28, elevation: 12,
  },
  iaFolhaTopo: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 8 },
  iaFolhaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 18, backgroundColor: colors.lavVeu,
  },
  iaFolhaRotulo: { flex: 1, fontFamily: 'Figtree_700Bold', fontSize: 15, color: colors.titulo },
}));
