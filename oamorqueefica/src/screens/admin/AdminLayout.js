import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Platform, Image,
  ScrollView, StatusBar, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/AuthContext';
import { useTema, MODOS_TEMA } from '../../hooks/TemaContext';
import { confirmar } from '../../utils/confirm';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { Vidro } from '../../components/Efeitos';
import AdminPreviewPanel from './AdminPreviewPanel';
import { IA_PAINEL } from '../../config/recursos';
import { est } from './adminEstilo';

const logo = require('../../../assets/images/travessia_logo.png');
// Barra lateral flutuante (tablet) e gaveta (celular), em vidro.
// A largura é lida a cada render (useWindowDimensions): antes era fixada na
// abertura do app, e no tablet (girar a tela, tela dividida, Android 16, que
// ignora a trava de orientação em telas grandes) o painel ficava com a barra
// lateral numa janela estreita, ou com a gaveta numa larga, diferente das
// telas internas, que já usam a largura atual.
// Tablet: a barra cresce com a tela (280 até 900 px de largura, 300 acima),
// para rótulos como "Funções da AtravessIA" caberem sem passar da margem.
const SIDEBAR_W = 300;
const larguraSidebar = (larguraTela) => (larguraTela >= 900 ? 300 : 280);
const SIDEBAR_MARGEM = 10;
const { OS: SISTEMA } = Platform;
// Largura ocupada pela barra lateral (com a margem), para telas que calculam colunas.
// (Valor máximo: as telas usam como estimativa quando ainda não mediram o conteúdo.)
export const LARGURA_LATERAL = SIDEBAR_W + SIDEBAR_MARGEM;

// Agrupado por finalidade: 14 itens soltos poluíam a barra e não deixavam
// claro onde encontrar cada tarefa.
const NAV_GRUPOS = [
  {
    titulo: null,
    itens: [
      { icon: 'grid', iconOff: 'grid-outline', label: 'Dashboard', screen: 'AdminHome' },
      ...(IA_PAINEL ? [{ icon: 'sparkles', iconOff: 'sparkles-outline', label: 'AtravessIA', sub: 'Leitura dos dados · Assistente de conteúdo', screen: 'AdminAtravessIA' }] : []),
    ],
  },
  {
    titulo: 'Conteúdo do app',
    itens: [
      {
        icon: 'library', iconOff: 'library-outline',
        label: 'Biblioteca', sub: 'Áudios de check-in · Frases · Outros conteúdos',
        screen: 'AdminAudios', irmas: ['AdminFrases', 'AdminOutrosConteudos', 'AdminVideos', 'AdminProdutos'],
      },
      {
        icon: 'compass', iconOff: 'compass-outline',
        label: 'Jornada', sub: 'Travessia · Jornadas · Vitórias',
        screen: 'AdminTravessia', irmas: ['AdminJornadas', 'AdminVitorias'],
      },
      { icon: 'play-circle', iconOff: 'play-circle-outline', label: 'Cursos', sub: 'Cursos · Profissionais · Vendas', screen: 'AdminCursos' },
      {
        icon: 'gift', iconOff: 'gift-outline',
        label: 'Parcerias', sub: 'Cupons · Cashback · Afiliados · Imobiliárias',
        screen: 'AdminParcerias', irmas: ['AdminBeneficios', 'AdminCashback', 'AdminIndicacoes', 'AdminPedidosCashback', 'AdminImobiliarias'],
      },
    ],
  },
  {
    titulo: 'Pessoas',
    itens: [
      { icon: 'people', iconOff: 'people-outline', label: 'Usuárias', screen: 'AdminUsuarias' },
      { icon: 'videocam', iconOff: 'videocam-outline', label: 'Atendimentos', sub: 'Sessões online · Convites · Sala', screen: 'AdminAtendimentos' },
      {
        icon: 'megaphone', iconOff: 'megaphone-outline',
        label: 'Comunicação', sub: 'Notificações · Mensagens',
        screen: 'AdminNotificacoes', irmas: ['AdminMensagens'],
      },
      { icon: 'bar-chart', iconOff: 'bar-chart-outline', label: 'Relatórios', screen: 'AdminRelatorios' },
    ],
  },
  {
    titulo: 'Criação',
    itens: [
      { icon: 'color-palette', iconOff: 'color-palette-outline', label: 'Atravessia Artes', sub: 'Gerador de artes por IA', screen: 'AdminArtes' },
    ],
  },
  {
    titulo: 'Configuração',
    itens: [
      { icon: 'pricetag', iconOff: 'pricetag-outline', label: 'Preços e planos', screen: 'AdminPrecos' },
      { icon: 'sparkles', iconOff: 'sparkles-outline', label: 'Funções da AtravessIA', screen: 'AdminRecursosIA' },
      { icon: 'document-text', iconOff: 'document-text-outline', label: 'Sobre e parcerias', screen: 'AdminInstitucional' },
      { icon: 'cloud-download', iconOff: 'cloud-download-outline', label: 'Versão do app', screen: 'AdminVersaoApp' },
      { icon: 'person-circle', iconOff: 'person-circle-outline', label: 'Meu Perfil', screen: 'AdminPerfil' },
    ],
  },
];

// Anel suave do avatar (lilás → pêssego → sálvia).
const ANEL = ['#B9A6F0', '#F3B9A5', '#A9D3B9'];

function SidebarContent({ navigate, currentScreen, perfil, sair, largo = false }) {
  // Desde que o app desenha sob as barras do sistema, o rodapé da barra lateral
  // (com "Encerrar sessão") ficava escondido atrás da barra de navegação do
  // Android. Agora a barra e a gaveta flutuam com margem acima dessa barra
  // (insets.bottom em AdminLayout), então o rodapé fica sempre visível.
  const { setVerComoUsuaria } = useAuth();
  const { modoPainel, setModoPainel } = useTema();
  return (
    <View style={sty.sidebarInner}>
      {/* Marca: logotipo, nome e selo */}
      <View style={sty.brand}>
        <Image source={logo} style={sty.brandLogo} resizeMode="contain" />
        <Text style={sty.brandName} numberOfLines={1}>Atravessia</Text>
        <View style={sty.adminBadge}>
          <Text style={sty.adminBadgeText}>ADMIN</Text>
        </View>
      </View>

      {/* Perfil */}
      <TouchableOpacity style={sty.profileCard} onPress={() => navigate('AdminPerfil')} activeOpacity={0.85}>
        <LinearGradient colors={ANEL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sty.avatarAnel}>
          {perfil?.photoURL ? (
            <Image source={{ uri: perfil.photoURL }} style={sty.avatarImg} />
          ) : (
            <View style={sty.avatarPlaceholder}>
              <Text style={sty.avatarLetter}>{(perfil?.nome || 'A')[0].toUpperCase()}</Text>
            </View>
          )}
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={sty.profileName} numberOfLines={1}>{perfil?.nome?.split(' ')[0] || 'Admin'}</Text>
          <Text style={sty.profileSub}>Administradora</Text>
        </View>
        <Ionicons name="create-outline" size={17} color={colors.tl} />
      </TouchableOpacity>

      {/* Itens */}
      <ScrollView style={sty.navScroll} contentContainerStyle={sty.navConteudo} showsVerticalScrollIndicator={false}>
        {NAV_GRUPOS.map((grupo, gi) => (
          <View key={grupo.titulo || `g${gi}`} style={gi > 0 && sty.navGrupo}>
            {grupo.titulo && <Text style={sty.navGrupoTitulo}>{grupo.titulo}</Text>}
            {grupo.itens.map(item => {
              // O item continua destacado quando a tela aberta é uma das
              // sub-abas agrupadas sob ele.
              const active = item.screen === currentScreen
                || (item.irmas || []).includes(currentScreen);
              return (
                <TouchableOpacity
                  key={item.screen}
                  style={[sty.navItem, active && sty.navItemActive]}
                  onPress={() => navigate(item.screen)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[sty.navBar, active && sty.navBarActive]} />
                  {active ? (
                    <LinearGradient colors={[colors.botao, colors.botaoForte]} style={[sty.navIcone, sty.navIconeAtivo]}>
                      <Ionicons name={item.iconOff} size={18} color="#FFFFFF" />
                    </LinearGradient>
                  ) : (
                    <View style={sty.navIcone}>
                      <Ionicons name={item.iconOff} size={19} color={colors.lilasIcone} />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {/* Tablet: até 2 linhas, fonte um pouco menor e teto para o zoom do sistema. */}
                    <Text
                      style={[sty.navLabel, largo && sty.navLabelLargo, active && sty.navLabelActive]}
                      numberOfLines={largo ? 2 : undefined}
                      maxFontSizeMultiplier={largo ? 1.3 : undefined}
                    >
                      {item.label}
                    </Text>
                    {item.sub && <Text style={[sty.navSub, largo && sty.navSubLargo]} maxFontSizeMultiplier={largo ? 1.3 : undefined}>{item.sub}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={sty.rodape}>
        {/* Tema do painel: claro, noturno ou automático pelo horário. */}
        <View style={sty.temaRow} accessibilityRole="radiogroup" accessibilityLabel="Tema do painel">
          {MODOS_TEMA.map(m => {
            const sel = modoPainel === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[sty.temaBtn, sel && sty.temaBtnSel]}
                onPress={() => setModoPainel(m.id)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={`Tema ${m.rotulo}`}
              >
                <Ionicons name={m.icone} size={16} color={sel ? colors.lilasTexto : colors.texto2} />
                <Text style={[sty.temaTxt, sel && sty.temaTxtSel]}>{m.id === 'auto' ? 'Auto' : m.rotulo}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Abre o app como uma usuária comum, sem sair da conta; o botão
            flutuante "Voltar ao painel" traz de volta. */}
        <TouchableOpacity style={sty.verUsuariaBtn} onPress={() => setVerComoUsuaria(true)} activeOpacity={0.8}>
          <Ionicons name="phone-portrait-outline" size={18} color={colors.lav6} />
          <Text style={sty.verUsuariaTxt}>Ver como usuária</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity
          style={sty.logoutBtn}
          onPress={() => confirmar('Encerrar sessão', 'Deseja sair do painel administrativo?', sair, 'Sair')}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.roseTexto} />
          <Text style={sty.logoutText}>Encerrar sessão</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AdminLayout({ children, currentScreen }) {
  const insets = useSafeAreaInsets();
  const { perfil, sair } = useAuth();
  const navigation = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { width: larguraTela } = useWindowDimensions();
  const isWide = SISTEMA === 'web' || larguraTela >= 700;
  const larguraGaveta = Math.min(320, larguraTela - 48);

  const navigateTo = (screen) => {
    setDrawerOpen(false);
    navigation.navigate(screen);
  };

  return (
    <SafeAreaView style={sty.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.escuro ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      {/* Aurora atrás de tudo: a barra lateral e o cabeçalho são de vidro. */}
      <LavandaBg />
      {isWide ? (
        <View style={sty.rootWide}>
          <View style={[sty.sidebar, { width: larguraSidebar(larguraTela), marginTop: insets.top + SIDEBAR_MARGEM, marginBottom: insets.bottom + SIDEBAR_MARGEM }]}>
            <SidebarContent
              navigate={navigateTo}
              currentScreen={currentScreen}
              perfil={perfil}
              sair={sair}
              largo
            />
          </View>
          <View style={[sty.main, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>{children}</View>
          {Platform.OS === 'web' && (
            <AdminPreviewPanel currentScreen={currentScreen} />
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Cabeçalho em cápsula de vidro: menu · logotipo · Atravessia · ADMIN */}
          <View style={[sty.mobileTopo, { paddingTop: insets.top + 8 }]}>
            <View style={sty.capsula}>
              <TouchableOpacity
                onPress={() => setDrawerOpen(true)}
                style={sty.hamburger}
                accessibilityRole="button"
                accessibilityLabel="Abrir menu"
              >
                <Ionicons name="menu-outline" size={24} color={colors.lav6} />
              </TouchableOpacity>
              <View style={sty.capsulaCentro}>
                <Image source={logo} style={sty.mobileLogo} resizeMode="contain" />
                <Text style={sty.capsulaNome} numberOfLines={1}>Atravessia</Text>
                <View style={sty.selo}><Text style={sty.seloTxt}>ADMIN</Text></View>
              </View>
              <View style={{ width: 46 }} />
            </View>
          </View>
          <View style={[sty.main, { paddingBottom: insets.bottom }]}>{children}</View>
          {drawerOpen && (
            <View style={sty.drawerContainer}>
              <TouchableOpacity
                style={sty.drawerOverlay}
                onPress={() => setDrawerOpen(false)}
                activeOpacity={1}
                accessibilityLabel="Fechar menu"
              />
              <Vidro style={[sty.drawer, { top: insets.top + 8, bottom: insets.bottom + 8, width: larguraGaveta }]} intensidade={50}>
                <View pointerEvents="none" style={sty.drawerVeu} />
                <SidebarContent
                  navigate={navigateTo}
                  currentScreen={currentScreen}
                  perfil={perfil}
                  sair={sair}
                />
              </Vidro>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const sty = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },

  // Tablet: barra lateral flutuante de vidro
  rootWide: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: SIDEBAR_W,
    marginLeft: SIDEBAR_MARGEM,
    ...est.vidro(28),
    backgroundColor: colors.escuro ? colors.card : colors.vidro,
  },
  sidebarInner: { flex: 1, paddingTop: 12, paddingHorizontal: 10, paddingBottom: 10 },
  main: { flex: 1, position: 'relative' },

  // Marca
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 4, paddingBottom: 10 },
  brandLogo: { width: 42, height: 42, borderRadius: 13 },
  brandName: {
    fontFamily: 'Marca',
    fontSize: 26, lineHeight: 30, color: colors.lav6, flexShrink: 1,
  },
  adminBadge: {
    marginTop: 2,
    backgroundColor: colors.lav1, borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.lav2,
  },
  adminBadgeText: {
    fontFamily: 'Figtree_800ExtraBold', fontSize: 10.5,
    color: colors.lilasTexto, letterSpacing: 1.6,
  },

  // Perfil
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    marginHorizontal: 2, marginBottom: 6,
    backgroundColor: colors.escuro ? colors.vidroTenue : colors.vidroForte,
    borderRadius: 18, paddingVertical: 7, paddingHorizontal: 12,
    borderWidth: 1, borderColor: colors.bordaLuz,
  },
  avatarAnel: { width: 40, height: 40, borderRadius: 20, padding: 2, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.cardSolido,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontFamily: fonts.serif, fontSize: 21, color: colors.lav6 },
  profileName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td },
  profileSub: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.tl, marginTop: 1 },

  // Navegação
  navScroll: { flex: 1 },
  navConteudo: { paddingHorizontal: 2, paddingTop: 4, paddingBottom: 6 },
  navGrupo: { marginTop: 4 },
  navGrupoTitulo: {
    fontFamily: fonts.bodyBold, fontSize: 12, color: colors.tl,
    letterSpacing: 1.3, textTransform: 'uppercase',
    paddingHorizontal: 12, paddingTop: 9, paddingBottom: 3,
  },
  navItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    paddingVertical: 3, paddingHorizontal: 8,
    borderRadius: 16, marginBottom: 1,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: colors.escuro ? 'rgba(255,255,255,0.08)' : colors.vidroForte,
    borderWidth: 1, borderColor: colors.bordaLuz,
    paddingVertical: 2, paddingHorizontal: 7,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 12, elevation: 1,
  },
  navBar: {
    position: 'absolute', left: -1, top: 12, bottom: 12,
    width: 3, borderRadius: 2, backgroundColor: 'transparent',
  },
  navBarActive: { backgroundColor: colors.botao },
  navIcone: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  navIconeAtivo: {
    shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 2,
  },
  navLabel: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20, color: colors.td, paddingTop: 6 },
  navSub: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: colors.tl, marginTop: 1, paddingBottom: 3 },
  navLabelActive: { fontFamily: fonts.bodyBold, color: colors.lav6 },
  navLabelLargo: { fontSize: 14, lineHeight: 19, flexShrink: 1 },
  navSubLargo: { fontSize: 11.5, lineHeight: 15, flexShrink: 1 },

  // Rodapé fixo
  rodape: { gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  temaRow: {
    flexDirection: 'row', gap: 2, padding: 4,
    backgroundColor: colors.escuro ? colors.vidroTenue : colors.lav1, borderRadius: 999,
  },
  temaBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 34, borderRadius: 999 },
  temaBtnSel: {
    backgroundColor: colors.escuro ? 'rgba(255,255,255,0.12)' : colors.cardSolido,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 3 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 6, elevation: 1,
  },
  temaTxt: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2 },
  temaTxtSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
  verUsuariaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: 999, backgroundColor: colors.lav1,
    borderWidth: 1, borderColor: colors.lav2,
  },
  verUsuariaTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.lav6 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 36, borderRadius: 999,
  },
  logoutText: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.roseTexto },

  // Celular: cabeçalho em cápsula de vidro
  mobileTopo: { paddingHorizontal: spacing.lg, paddingBottom: 6 },
  capsula: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 62, paddingHorizontal: 8, borderRadius: 24,
    ...est.vidro(24),
    backgroundColor: colors.escuro ? colors.card : colors.vidroForte,
  },
  hamburger: {
    width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidroTenue, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  capsulaCentro: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minWidth: 0 },
  mobileLogo: { width: 38, height: 38, borderRadius: 11 },
  capsulaNome: { fontFamily: 'Marca', fontSize: 25, lineHeight: 30, color: colors.lav6, flexShrink: 1 },
  selo: {
    backgroundColor: colors.lav1, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.lav2,
  },
  seloTxt: { fontFamily: 'Figtree_800ExtraBold', fontSize: 10.5, color: colors.lilasTexto, letterSpacing: 1.5 },

  // Gaveta
  drawerContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 100,
  },
  drawerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.sobreposicao },
  drawer: {
    position: 'absolute', left: 8, width: 320,
    borderRadius: 28, borderWidth: 1, borderColor: colors.bordaLuz,
    ...est.sombraForte(),
  },
  drawerVeu: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.escuro ? colors.vidro : colors.vidroForte,
  },
}), { escalar: false });
