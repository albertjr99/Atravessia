import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Image, Dimensions, Modal, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { emocoes } from '../../data';
import { ScriptTitle, LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { confirmar } from '../../utils/confirm';
import { urlDeImagem } from '../../utils/imagemUrl';
import { situacaoCupom } from '../../utils/cupons';
import { hojeStrBR } from '../../utils/date';
import { carregarPreferencia, agendarLembretes } from '../../utils/lembreteCheckin';
import DiarioDoDia from '../../components/DiarioDoDia';
import { escolherEnviarFoto } from '../../utils/fotoPerfil';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

const headerLavender = require('../../../assets/images/header-lavender.jpg');
const logo = require('../../../assets/images/travessia_logo.png');

const ilCoracao = require('../../../assets/images/il_coracao_ramos.png');
const { width: SCREEN_W } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    usuario, notificacoes, checkins, parcerias, fraseDoDia, meusVouchers,
  } = useApp();
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

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ===== HEADER COM AQUARELA ===== */}
        <View style={[s.headerWrap, { height: 210 + insets.top }]}>
          <Image source={headerLavender} style={[s.headerImg, { height: 210 + insets.top }]} resizeMode="cover" />
          {/* No noturno, um véu escurece a aquarela do topo */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.headerVeu }]} pointerEvents="none" />
          {/* Gradiente fade para o fundo */}
          <View style={s.headerFade} />
          {/* Sino notificação */}
          <TouchableOpacity style={[s.bellBtn, { top: 16 + insets.top }]} onPress={() => navigation.navigate('Notificacoes')}>
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
            <Ionicons name="menu-outline" size={20} color={colors.lilasIcone} />
          </TouchableOpacity>
          {/* Logo + nome do app */}
          <View style={s.headerBottom}>
            <Image source={logo} style={s.headerLogo} resizeMode="contain" />
            <Text style={s.appTitle}>Atravessia</Text>
          </View>
        </View>

        <View style={s.body}>

          {/* Saudação */}
          <View style={s.greetSect}>
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
            <View style={{ flex: 1 }}>
              <Text style={s.greetName}>{saudacao()}, {usuario.apelido || usuario.nome}</Text>
              <Text style={s.greetSub}>Que hoje você se permita sentir, acolher e seguir.</Text>
            </View>
          </View>

          {/* Aviso de notificações não lidas */}
          {naoLidas > 0 && (
            <TouchableOpacity
              style={s.notifBanner}
              onPress={() => navigation.navigate('Notificacoes')}
              activeOpacity={0.88}
            >
              <View style={s.notifBannerIcon}>
                <Ionicons name="notifications" size={19} color="#fff" />
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

          {/* ===== SEU DIA (sequência sugerida, opcional) ===== */}
          <DiarioDoDia navigation={navigation} />

          {/* ===== FRASE DO DIA ===== */}
          {fraseDoDia && (
            <View style={s.fraseCard}>
              <View style={s.fraseTagRow}>
                <Ionicons name="sunny-outline" size={13} color={colors.lilasIcone} />
                <Text style={s.fraseTag}>Frase do dia</Text>
                <Image source={ilCoracao} style={s.fraseIl} resizeMode="contain" />
              </View>
              <Text style={s.fraseTxt}>"{fraseDoDia.texto}"</Text>
              {fraseDoDia.autor ? <Text style={s.fraseAutor}>— {fraseDoDia.autor}</Text> : null}
            </View>
          )}

          {/* ===== CHECK-IN ===== */}
          <View style={s.sect}>
            <Text style={s.sectTitle}>Como estou me sentindo hoje?</Text>
            <View style={s.emoGrid}>
              {emocoes.filter(e => e.positiva).map(e => (
                <TouchableOpacity key={e.id} style={s.emoCard} onPress={() => navigation.navigate('CheckIn')} activeOpacity={0.8}>
                  <View style={[s.emoCircle, { backgroundColor: e.bg }]}>
                    <Ionicons name={`${e.icon}-outline`} size={18} color={e.color} />
                  </View>
                  <Text style={s.emoLbl} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{e.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.checkinBtn} onPress={() => navigation.navigate('CheckIn')} activeOpacity={0.85}>
              <Text style={s.checkinTxt}>Fazer check-in emocional</Text>
              <Ionicons name="chevron-forward" size={18} color="white" />
            </TouchableOpacity>
          </View>

          {/* ===== REFLEXÃO ===== */}
          <View style={s.sect}>
            <View style={s.sectHeaderRow}>
              <View style={s.sectTitleRow}>
                <Ionicons name="moon-outline" size={14} color={colors.lilasIcone} />
                <Text style={s.sectTitle}>Reflexão do dia</Text>
              </View>
              <TouchableOpacity><Text style={s.sectLink}>Ver todas</Text></TouchableOpacity>
            </View>
            <View style={s.reflexaoCard}>
              <Text style={s.reflexaoTxt}>{fraseDoDia?.reflexao || 'Cada dia traz uma nova chance de cuidar de si. Permita-se sentir, acolher e seguir.'}</Text>
            </View>
          </View>

          {/* ===== ACESSO RÁPIDO ===== */}
          <View style={s.sect}>
            <Text style={s.sectTitle}>Acesso rápido</Text>
            <View style={s.perfilGrid}>
              <TouchableOpacity style={s.perfilCard} onPress={() => navigation.navigate('Audios')} activeOpacity={0.85}>
                <Ionicons name="headset-outline" size={20} color={colors.lav4} />
                <Text style={s.perfilLbl}>Conteúdos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.perfilCard} onPress={() => navigation.navigate('PequenasVitorias')} activeOpacity={0.85}>
                <Ionicons name="star-outline" size={20} color={colors.lav4} />
                <Text style={s.perfilLbl}>Pequenas Vitórias</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.perfilCard} onPress={() => navigation.navigate('Relatorios')} activeOpacity={0.85}>
                <Ionicons name="bar-chart-outline" size={20} color={colors.lav4} />
                <Text style={s.perfilLbl}>Relatórios</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.vidaBtn} onPress={() => navigation.navigate('Parcerias')} activeOpacity={0.88}>
              <View style={s.vidaBtnInner}>
                <View style={s.vidaIconCircle}>
                  <Ionicons name="gift-outline" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.vidaBtnTxt}>Experimente a vida</Text>
                  <Text style={s.vidaBtnSub}>Parcerias e benefícios exclusivos</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.75)" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[s.vidaBtn, { marginTop: 10 }]} onPress={() => navigation.navigate('Jornadas')} activeOpacity={0.88}>
              <View style={s.vidaBtnInner}>
                <View style={s.vidaIconCircle}>
                  <Ionicons name="people-outline" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.vidaBtnTxt}>Continue a travessia</Text>
                  <Text style={s.vidaBtnSub}>Eu caminho junto com você</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.75)" />
              </View>
            </TouchableOpacity>

            {temProdutos && (
              <TouchableOpacity style={s.produtosBtn} onPress={() => navigation.navigate('Produtos')} activeOpacity={0.88}>
                <View style={s.produtosIcone}>
                  <Ionicons name="bag-handle-outline" size={21} color="#8A6A33" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.produtosTit}>Produtos Atravessia</Text>
                  <Text style={s.produtosSub}>Canecas, cadernos e mais com a nossa marca</Text>
                </View>
                <View style={s.produtosPlay}>
                  <Ionicons name="play" size={12} color="white" style={{ marginLeft: 2 }} />
                </View>
              </TouchableOpacity>
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

      {/* ===== BOTTOM NAV ===== */}
      <View style={[s.bnav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {[
          { name: 'Início', icon: 'home', active: true },
          { name: 'Conteúdos', icon: 'headset', screen: 'Audios' },
          { name: 'Vitórias', icon: 'star', screen: 'PequenasVitorias' },
          { name: 'Relatórios', icon: 'bar-chart', screen: 'Relatorios' },
          { name: 'Planos', icon: 'diamond', screen: 'Planos' },
        ].map(item => (
          <TouchableOpacity key={item.name} style={s.navItem}
            onPress={() => item.screen && navigation.navigate(item.screen)}>
            <Ionicons
              name={item.active ? item.icon : `${item.icon}-outline`}
              size={20}
              color={item.active ? colors.lav4 : colors.texto2}
            />
            <Text style={[s.navLbl, item.active && s.navLblActive]}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: 80 },

  // Header
  headerWrap: { position: 'relative', height: 210 },
  headerImg: { width: '100%', height: 210 },
  headerFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'transparent',
    // CSS gradient simulation
    opacity: 1,
  },
  bellBtn: {
    position: 'absolute', right: 16, top: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.vidro,
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute', right: 3, top: 3,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#C4566B',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.card,
  },
  bellBadgeTxt: {
    fontFamily: 'Lato_700Bold', fontSize: 10, color: '#fff', lineHeight: 13,
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
    fontFamily: 'Lato_700Bold', fontSize: 13.5, color: colors.td,
  },
  notifBannerSub: {
    fontFamily: 'Lato_400Regular', fontSize: 11.5, color: colors.tm, marginTop: 2,
  },
  cupomBtn: {
    position: 'absolute', right: 68, top: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.vidro,
    alignItems: 'center', justifyContent: 'center',
  },
  cupomBadge: { backgroundColor: '#7A9E7E' },
  menuBtn: {
    position: 'absolute', left: 16, top: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.vidro,
    alignItems: 'center', justifyContent: 'center',
  },
  menuFundo: { flex: 1, backgroundColor: colors.sobreposicao, paddingHorizontal: 16, alignItems: 'flex-start' },
  menuCaixa: {
    width: '100%', maxWidth: 340, backgroundColor: colors.card, borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 6,
    shadowColor: '#2E2740', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10 },
  menuItemBorda: { borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  menuIcone: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.lav1,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconeSair: { backgroundColor: colors.roseFundo },
  menuRotulo: { fontFamily: 'Lato_700Bold', fontSize: 14, color: colors.titulo },
  menuSub: { fontFamily: 'Lato_400Regular', fontSize: 11.5, color: colors.texto2, marginTop: 1 },
  headerLogo: { width: 44, height: 44, marginBottom: 2, borderRadius: 10 },
  headerBottom: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    alignItems: 'center',
  },
  appTitle: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 28, color: colors.titulo, marginTop: 4,
    letterSpacing: 0.5,
  },

  body: { paddingHorizontal: 20 },

  // Saudação
  greetSect: { marginTop: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: colors.lav1,
    borderWidth: 2, borderColor: colors.lav2, alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 54, height: 54, borderRadius: 27 },
  avatarInicial: { fontFamily: 'PlayfairDisplay_400Regular', fontSize: 24, color: colors.lav5 },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.lav4, borderWidth: 2, borderColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  greetName: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 24, color: colors.titulo,
  },
  greetSub: {
    fontFamily: 'Lato_400Regular',
    fontSize: 14, color: colors.texto2, marginTop: 4,
  },
  greetIl: { width: 80, height: 80, marginLeft: 8 },

  // Frase
  fraseCard: {
    backgroundColor: colors.card,
    borderRadius: 24, padding: 24, paddingTop: 20,
    borderWidth: 1, borderColor: colors.bordaSuave,
    marginBottom: 24,
    // shadow-card
    shadowColor: '#6b5b7a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  fraseTagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginBottom: 12,
  },
  fraseIl: { width: 32, height: 32, marginLeft: 'auto' },
  fraseTag: {
    fontFamily: 'Lato_700Bold', fontSize: 12,
    color: colors.lilasIcone, letterSpacing: 1, textTransform: 'uppercase',
  },
  fraseTxt: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 26, fontStyle: 'italic',
    color: colors.titulo, lineHeight: 36, textAlign: 'center',
  },
  fraseAutor: {
    fontFamily: 'Lato_400Regular', fontSize: 12,
    color: colors.texto2, textAlign: 'center', marginTop: 8,
  },

  // Section
  sect: { marginBottom: 24 },
  sectTitle: { fontFamily: 'Lato_700Bold', fontSize: 16, color: colors.titulo, marginBottom: 12 },
  sectHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectLink: { fontFamily: 'Lato_400Regular', fontSize: 13, color: colors.lilasIcone },

  // Emoções
  emoGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  emoCard: {
    flex: 1, alignItems: 'center', gap: 6,
    backgroundColor: colors.card, borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 4,
    borderWidth: 1, borderColor: colors.bordaSuave,
  },
  emoCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  emoLbl: { fontFamily: 'Lato_400Regular', fontSize: 10, color: colors.titulo, textAlign: 'center' },

  // Perfil e cuidados
  perfilGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  perfilCard: {
    flexBasis: '47%', flexGrow: 1, alignItems: 'center', gap: 6,
    backgroundColor: colors.card, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 8,
    borderWidth: 1, borderColor: colors.bordaSuave,
  },
  perfilLbl: { fontFamily: 'Lato_700Bold', fontSize: 12, color: colors.titulo, textAlign: 'center' },

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
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  vidaBtnTxt: { fontFamily: 'Lato_700Bold', fontSize: 15, color: '#fff' },
  vidaBtnSub: { fontFamily: 'Lato_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // Produtos Atravessia
  produtosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10,
    paddingVertical: 16, paddingHorizontal: 18, borderRadius: 18,
    backgroundColor: colors.douradoFundo, borderWidth: 1, borderColor: colors.douradoBorda,
  },
  produtosIcone: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.douradoIcone,
    alignItems: 'center', justifyContent: 'center',
  },
  produtosTit: { fontFamily: 'Lato_700Bold', fontSize: 15, color: colors.douradoTitulo },
  produtosSub: { fontFamily: 'Lato_400Regular', fontSize: 11.5, color: colors.douradoTexto, marginTop: 2 },
  produtosPlay: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#C9A35F',
    alignItems: 'center', justifyContent: 'center',
  },

  // Check-in btn
  checkinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.botao, borderRadius: 999,
    paddingVertical: 16,
    // shadow-soft
    shadowColor: colors.lilasIcone,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 6,
  },
  checkinTxt: { fontFamily: 'Lato_700Bold', fontSize: 15, color: 'white' },

  // Reflexão
  reflexaoCard: {
    backgroundColor: colors.lavVeu,
    borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: colors.bordaSuave,
  },
  reflexaoTxt: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 15, fontStyle: 'italic',
    color: colors.lilasTexto, lineHeight: 24, textAlign: 'justify',
  },

  disclaimer: {
    fontFamily: 'Lato_400Regular', fontSize: 12,
    color: colors.texto2, textAlign: 'center',
    lineHeight: 18, marginBottom: 20,
  },

  // Parcerias
  parceriaCard: {
    width: 148, backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.bordaSuave, overflow: 'hidden',
  },
  parceriaImg: { width: 148, height: 88 },
  parceriaImgPlaceholder: {
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center',
  },
  parceriaInfo: { padding: 8 },
  parceriaTit: {
    fontFamily: 'Lato_700Bold', fontSize: 11, color: colors.titulo, lineHeight: 16,
  },
  parceriaCat: { fontFamily: 'Lato_400Regular', fontSize: 9, color: colors.lilasIcone, marginTop: 3 },
  parceriaVerTodas: { width: 60, alignItems: 'center', justifyContent: 'center', gap: 4 },
  parceriaVerTodasTxt: {
    fontFamily: 'Lato_400Regular', fontSize: 10, color: colors.lilasIcone, textAlign: 'center',
  },

  // Nav
  bnav: {
    backgroundColor: colors.vidroForte,
    borderTopWidth: 1, borderTopColor: colors.bordaSuave,
    paddingBottom: 10,
    paddingTop: 8,
    flexDirection: 'row', justifyContent: 'space-around',
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  navItem: { alignItems: 'center', gap: 3, flex: 1 },
  navLbl: { fontFamily: 'Lato_400Regular', fontSize: 10, color: colors.texto2 },
  navLblActive: { fontFamily: 'Lato_700Bold', color: colors.lilasIcone },
}));
