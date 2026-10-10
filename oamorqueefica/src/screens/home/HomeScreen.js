import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Image, Modal, Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { emocoes } from '../../data';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { confirmar } from '../../utils/confirm';
import { urlDeImagem } from '../../utils/imagemUrl';
import { situacaoCupom } from '../../utils/cupons';
import { hojeStrBR } from '../../utils/date';
import { carregarPreferencia, agendarLembretes } from '../../utils/lembreteCheckin';
import DiarioDoDia from '../../components/DiarioDoDia';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

const headerLavender = require('../../../assets/images/header-lavender.jpg');
const logo = require('../../../assets/images/travessia_logo.png');

const ilCoracao = require('../../../assets/images/il_coracao_ramos.png');

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    usuario, notificacoes, checkins, parcerias, fraseDoDia, meusVouchers,
  } = useApp();
  const { sair, firebaseUser, perfil } = useAuth();
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
  const checkinHoje = checkins.find(c => c.data === hojeStrBR());
  const emocaoHoje = emocoes.find(e => e.id === checkinHoje?.emocao);
  const jaFezCheckinHoje = !!checkinHoje;

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
  const itensMenu = [
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
  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ===== HEADER COM AQUARELA ===== */}
        <View style={[s.headerWrap, { height: 154 + insets.top }]}>
          <Image source={headerLavender} style={[s.headerImg, { height: 154 + insets.top }]} resizeMode="cover" />
          {/* Gradiente fade para o fundo */}
          <View style={s.headerFade} />
          {/* Sino notificação */}
          <TouchableOpacity style={[s.bellBtn, { top: 16 + insets.top }]} onPress={() => navigation.navigate('Notificacoes')}>
            <Ionicons name={naoLidas > 0 ? 'notifications' : 'notifications-outline'} size={18} color="#9b86bd" />
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
            <Ionicons name={cuponsPendentes > 0 ? 'ticket' : 'ticket-outline'} size={18} color="#9b86bd" />
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
            <Ionicons name="menu-outline" size={20} color="#9b86bd" />
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
            <Text style={s.greetDate}>{new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            <Text style={s.greetName}>{saudacao()}, {usuario.apelido || usuario.nome}</Text>
            <Text style={s.greetSub}>Que hoje você se permita sentir, acolher e seguir.</Text>
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

          {/* ===== CHECK-IN EMOCIONAL ===== */}
          <View style={s.checkinCard}>
            <View style={s.checkinCardTop}>
              <View style={[s.checkinIcon, jaFezCheckinHoje && s.checkinIconDone]}>
                <Ionicons
                  name={jaFezCheckinHoje ? 'checkmark' : 'heart-outline'}
                  size={21}
                  color={jaFezCheckinHoje ? colors.sageFg : colors.lav5}
                />
              </View>
              <View style={s.checkinCopy}>
                <Text style={s.checkinEyebrow}>{jaFezCheckinHoje ? 'CUIDADO DE HOJE' : 'UM MOMENTO PARA VOCÊ'}</Text>
                <Text style={s.checkinTitle}>{jaFezCheckinHoje ? 'Você se escutou hoje' : 'Como você está se sentindo?'}</Text>
                <Text style={s.checkinSub}>
                  {jaFezCheckinHoje
                    ? `Seu registro de hoje: ${emocaoHoje?.label?.toLowerCase() || 'feito com carinho'}.`
                    : 'Não existe resposta certa. Você pode começar pelo que sente agora.'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.checkinBtn, jaFezCheckinHoje && s.checkinBtnDone]}
              onPress={() => navigation.navigate(jaFezCheckinHoje ? 'Relatorios' : 'CheckIn')}
              activeOpacity={0.86}
              accessibilityRole="button"
              accessibilityLabel={jaFezCheckinHoje ? 'Acompanhar meu caminho' : 'Fazer check-in emocional'}
            >
              <Text style={s.checkinTxt}>{jaFezCheckinHoje ? 'Acompanhar meu caminho' : 'Fazer check-in emocional'}</Text>
              <Ionicons name="arrow-forward" size={17} color="white" />
            </TouchableOpacity>
          </View>

          {/* ===== SEU DIA (sequência sugerida, opcional) ===== */}
          <DiarioDoDia navigation={navigation} />

          {/* ===== FRASE DO DIA ===== */}
          {fraseDoDia && (
            <View style={s.fraseCard}>
              <View style={s.fraseTagRow}>
                <Ionicons name="sunny-outline" size={13} color="#9b86bd" />
                <Text style={s.fraseTag}>Frase do dia</Text>
                <Image source={ilCoracao} style={s.fraseIl} resizeMode="contain" />
              </View>
              <Text style={s.fraseTxt}>"{fraseDoDia.texto}"</Text>
              {fraseDoDia.autor ? <Text style={s.fraseAutor}>— {fraseDoDia.autor}</Text> : null}
            </View>
          )}

          {/* ===== REFLEXÃO ===== */}
          <View style={s.sect}>
            <View style={s.sectHeaderRow}>
              <View style={s.sectTitleRow}>
                <Ionicons name="moon-outline" size={14} color="#9b86bd" />
                <Text style={s.sectTitle}>Uma pausa para hoje</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Audios')}><Text style={s.sectLink}>Mais conteúdos</Text></TouchableOpacity>
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
                <Ionicons name="headset-outline" size={20} color="#8B7AC0" />
                <Text style={s.perfilLbl}>Conteúdos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.perfilCard} onPress={() => navigation.navigate('PequenasVitorias')} activeOpacity={0.85}>
                <Ionicons name="star-outline" size={20} color="#8B7AC0" />
                <Text style={s.perfilLbl}>Vitórias</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.perfilCard} onPress={() => navigation.navigate('Relatorios')} activeOpacity={0.85}>
                <Ionicons name="bar-chart-outline" size={20} color="#8B7AC0" />
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
                  <Ionicons name="gift-outline" size={14} color="#9b86bd" />
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
                  <Ionicons name={item.icone} size={18} color={item.sair ? '#A0525E' : colors.lav5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.menuRotulo, item.sair && { color: '#A0525E' }]}>{item.rotulo}</Text>
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
              color={item.active ? '#8B7AC0' : '#8c8597'}
            />
            <Text style={[s.navLbl, item.active && s.navLblActive]}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAF8F5' },
  scrollContent: { paddingBottom: 108 },

  // Header
  headerWrap: { position: 'relative', height: 154, overflow: 'hidden' },
  headerImg: { width: '100%', height: 154 },
  headerFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
    backgroundColor: 'rgba(250,248,245,0.32)',
  },
  bellBtn: {
    position: 'absolute', right: 16, top: 16,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)',
  },
  bellBadge: {
    position: 'absolute', right: 3, top: 3,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#C4566B',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FFFDF9',
  },
  bellBadgeTxt: {
    fontFamily: 'Lato_700Bold', fontSize: 10, color: '#fff', lineHeight: 13,
  },

  notifBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#EDE9F5', borderRadius: 16,
    borderWidth: 1, borderColor: '#C8BCE2',
    paddingVertical: 13, paddingHorizontal: 14,
    marginBottom: 18,
    shadowColor: '#6b5b7a', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 3,
  },
  notifBannerIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#8B7AC0',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifBannerTit: {
    fontFamily: 'Lato_700Bold', fontSize: 13.5, color: '#4A4B4A',
  },
  notifBannerSub: {
    fontFamily: 'Lato_400Regular', fontSize: 11.5, color: '#76737A', marginTop: 2,
  },
  cupomBtn: {
    position: 'absolute', right: 64, top: 16,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)',
  },
  cupomBadge: { backgroundColor: '#7A9E7E' },
  menuBtn: {
    position: 'absolute', left: 16, top: 16,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)',
  },
  menuFundo: { flex: 1, backgroundColor: 'rgba(46,39,64,0.28)', paddingHorizontal: 16, alignItems: 'flex-start' },
  menuCaixa: {
    width: '100%', maxWidth: 340, backgroundColor: '#FFFDF9', borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 6,
    shadowColor: '#2E2740', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10 },
  menuItemBorda: { borderTopWidth: 1, borderTopColor: 'rgba(230,221,210,0.7)' },
  menuIcone: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.lav1,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconeSair: { backgroundColor: '#F7E8EA' },
  menuRotulo: { fontFamily: 'Lato_700Bold', fontSize: 14, color: '#4a4453' },
  menuSub: { fontFamily: 'Lato_400Regular', fontSize: 11.5, color: '#8c8597', marginTop: 1 },
  headerLogo: { width: 34, height: 34, borderRadius: 9 },
  headerBottom: {
    position: 'absolute', bottom: 12, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.83)',
  },
  appTitle: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 25, color: '#453D50', letterSpacing: 0.3,
  },

  body: { paddingHorizontal: 20 },

  // Saudação
  greetSect: { marginTop: 17, marginBottom: 18 },
  greetDate: {
    fontFamily: 'Lato_700Bold', fontSize: 11, color: '#827B8A',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5,
  },
  greetName: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 25, color: '#393442', lineHeight: 34,
  },
  greetSub: {
    fontFamily: 'Lato_400Regular',
    fontSize: 14, color: '#756F7D', marginTop: 4, lineHeight: 20,
  },
  greetIl: { width: 80, height: 80, marginLeft: 8 },

  // Cartão de check-in — ação principal da tela
  checkinCard: {
    padding: 18, marginBottom: 18, borderRadius: 22,
    backgroundColor: '#F0ECF5', borderWidth: 1, borderColor: '#E2DBEB',
  },
  checkinCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkinIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#E1D9ED',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkinIconDone: { backgroundColor: '#E1EADF' },
  checkinCopy: { flex: 1, minWidth: 0 },
  checkinEyebrow: {
    fontFamily: 'Lato_700Bold', fontSize: 10, color: '#75648A',
    letterSpacing: 0.9, marginBottom: 4,
  },
  checkinTitle: { fontFamily: 'Lato_700Bold', fontSize: 17, color: '#393442', lineHeight: 22 },
  checkinSub: { fontFamily: 'Lato_400Regular', fontSize: 13, color: '#6F6878', lineHeight: 19, marginTop: 4 },

  // Frase
  fraseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22, padding: 20, paddingTop: 18,
    borderWidth: 1, borderColor: '#ECE7E2',
    marginBottom: 22,
    shadowColor: '#51465E', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.055, shadowRadius: 12, elevation: 2,
  },
  fraseTagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginBottom: 12,
  },
  fraseIl: { width: 32, height: 32, marginLeft: 'auto' },
  fraseTag: {
    fontFamily: 'Lato_700Bold', fontSize: 11,
    color: '#75648A', letterSpacing: 0.9, textTransform: 'uppercase',
  },
  fraseTxt: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 24, fontStyle: 'italic',
    color: '#393442', lineHeight: 33, textAlign: 'left',
  },
  fraseAutor: {
    fontFamily: 'Lato_400Regular', fontSize: 12,
    color: '#827B8A', textAlign: 'left', marginTop: 9,
  },

  // Section
  sect: { marginBottom: 22 },
  sectTitle: { fontFamily: 'Lato_700Bold', fontSize: 16, color: '#393442', marginBottom: 12 },
  sectHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectLink: { fontFamily: 'Lato_700Bold', fontSize: 12, color: '#75648A' },

  // Emoções
  // Perfil e cuidados
  perfilGrid: { flexDirection: 'row', flexWrap: 'nowrap', gap: 9 },
  perfilCard: {
    flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 17,
    paddingVertical: 15, paddingHorizontal: 5,
    borderWidth: 1, borderColor: '#ECE7E2',
  },
  perfilLbl: { fontFamily: 'Lato_700Bold', fontSize: 11.5, color: '#514A5B', textAlign: 'center' },

  // Experimente a vida
  vidaBtn: {
    marginTop: 10,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#6D5C83',
    shadowColor: '#51465E', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 3,
  },
  vidaBtnInner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 15, paddingHorizontal: 16,
    backgroundColor: '#75648A',
  },
  vidaIconCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  vidaBtnTxt: { fontFamily: 'Lato_700Bold', fontSize: 14, color: '#fff' },
  vidaBtnSub: { fontFamily: 'Lato_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 3 },

  // Produtos Atravessia
  produtosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10,
    paddingVertical: 16, paddingHorizontal: 18, borderRadius: 18,
    backgroundColor: '#FBF4E8', borderWidth: 1, borderColor: '#EBD9B8',
  },
  produtosIcone: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3E4C6',
    alignItems: 'center', justifyContent: 'center',
  },
  produtosTit: { fontFamily: 'Lato_700Bold', fontSize: 15, color: '#6B5326' },
  produtosSub: { fontFamily: 'Lato_400Regular', fontSize: 11.5, color: '#8A7550', marginTop: 2 },
  produtosPlay: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#C9A35F',
    alignItems: 'center', justifyContent: 'center',
  },

  // Check-in btn
  checkinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: '#75648A', borderRadius: 14,
    paddingVertical: 13, marginTop: 15,
  },
  checkinBtnDone: { backgroundColor: '#71866F' },
  checkinTxt: { fontFamily: 'Lato_700Bold', fontSize: 14, color: 'white' },

  // Reflexão
  reflexaoCard: {
    backgroundColor: '#F1EDF5',
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#E5DEEC',
  },
  reflexaoTxt: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 15, fontStyle: 'italic',
    color: '#5E536B', lineHeight: 23, textAlign: 'left',
  },

  disclaimer: {
    fontFamily: 'Lato_400Regular', fontSize: 11.5,
    color: '#827B8A', textAlign: 'center',
    lineHeight: 17, marginBottom: 18,
  },

  // Parcerias
  parceriaCard: {
    width: 156, backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#ECE7E2', overflow: 'hidden',
  },
  parceriaImg: { width: 156, height: 94 },
  parceriaImgPlaceholder: {
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center',
  },
  parceriaInfo: { padding: 8 },
  parceriaTit: {
    fontFamily: 'Lato_700Bold', fontSize: 12, color: '#514A5B', lineHeight: 17,
  },
  parceriaCat: { fontFamily: 'Lato_400Regular', fontSize: 10, color: '#75648A', marginTop: 4 },
  parceriaVerTodas: { width: 60, alignItems: 'center', justifyContent: 'center', gap: 4 },
  parceriaVerTodasTxt: {
    fontFamily: 'Lato_400Regular', fontSize: 10, color: '#9b86bd', textAlign: 'center',
  },

  // Nav
  bnav: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopWidth: 1, borderTopColor: '#ECE7E2',
    paddingBottom: 10, paddingTop: 10,
    flexDirection: 'row', justifyContent: 'space-around',
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#393442', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.045, shadowRadius: 8, elevation: 8,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', gap: 4, flex: 1, minHeight: 44 },
  navLbl: { fontFamily: 'Lato_400Regular', fontSize: 10.5, color: '#827B8A' },
  navLblActive: { fontFamily: 'Lato_700Bold', color: '#75648A' },
});
