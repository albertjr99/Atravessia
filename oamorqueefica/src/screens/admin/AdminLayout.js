import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Image,
  ScrollView, Dimensions, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/AuthContext';
import { confirmar } from '../../utils/confirm';
import { colors, fonts, spacing, radius } from '../../theme';
import { LavandaBg } from '../../components';
import AdminPreviewPanel from './AdminPreviewPanel';

const logo = require('../../../assets/images/travessia_logo.png');
const { width: SCREEN_W } = Dimensions.get('window');
const SIDEBAR_W = 230;
const isWide = Platform.OS === 'web' || SCREEN_W >= 700;

// Agrupado por finalidade: 14 itens soltos poluíam a barra e não deixavam
// claro onde encontrar cada tarefa.
const NAV_GRUPOS = [
  {
    titulo: null,
    itens: [
      { icon: 'grid', iconOff: 'grid-outline', label: 'Dashboard', screen: 'AdminHome' },
    ],
  },
  {
    titulo: 'Conteúdo do app',
    itens: [
      { icon: 'headset', iconOff: 'headset-outline', label: 'Conteúdos', screen: 'AdminConteudos' },
      {
        icon: 'library', iconOff: 'library-outline',
        label: 'Biblioteca', sub: 'Áudios de check-in · Frases',
        screen: 'AdminAudios', irmas: ['AdminFrases'],
      },
      {
        icon: 'compass', iconOff: 'compass-outline',
        label: 'Jornada', sub: 'Travessia · Jornadas · Vitórias',
        screen: 'AdminTravessia', irmas: ['AdminJornadas', 'AdminVitorias'],
      },
      { icon: 'gift', iconOff: 'gift-outline', label: 'Parcerias', screen: 'AdminParcerias' },
    ],
  },
  {
    titulo: 'Pessoas',
    itens: [
      { icon: 'people', iconOff: 'people-outline', label: 'Usuárias', screen: 'AdminUsuarias' },
      {
        icon: 'megaphone', iconOff: 'megaphone-outline',
        label: 'Comunicação', sub: 'Notificações · Mensagens',
        screen: 'AdminNotificacoes', irmas: ['AdminMensagens'],
      },
      { icon: 'bar-chart', iconOff: 'bar-chart-outline', label: 'Relatórios', screen: 'AdminRelatorios' },
    ],
  },
  {
    titulo: 'Configuração',
    itens: [
      { icon: 'pricetag', iconOff: 'pricetag-outline', label: 'Preços e planos', screen: 'AdminPrecos' },
      { icon: 'person-circle', iconOff: 'person-circle-outline', label: 'Meu Perfil', screen: 'AdminPerfil' },
    ],
  },
];

function SidebarContent({ navigate, currentScreen, perfil, sair }) {
  return (
    <View style={sty.sidebarInner}>
      {/* Branding */}
      <View style={sty.brand}>
        <Image source={logo} style={sty.brandLogo} resizeMode="contain" />
        <Text style={sty.brandName}>Atravessia</Text>
        <View style={sty.adminBadge}>
          <Text style={sty.adminBadgeText}>ADMIN</Text>
        </View>
      </View>

      {/* Profile card */}
      <TouchableOpacity style={sty.profileCard} onPress={() => navigate('AdminPerfil')} activeOpacity={0.85}>
        {perfil?.photoURL ? (
          <Image source={{ uri: perfil.photoURL }} style={sty.avatarImg} />
        ) : (
          <View style={sty.avatarPlaceholder}>
            <Text style={sty.avatarLetter}>{(perfil?.nome || 'A')[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={sty.profileName} numberOfLines={1}>{perfil?.nome?.split(' ')[0] || 'Admin'}</Text>
          <Text style={sty.profileSub}>Administradora</Text>
        </View>
        <Ionicons name="create-outline" size={14} color={colors.tl} />
      </TouchableOpacity>

      <View style={sty.divider} />

      {/* Nav items */}
      <ScrollView style={sty.navScroll} showsVerticalScrollIndicator={false}>
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
                >
                  <View style={[sty.navBar, active && sty.navBarActive]} />
                  <Ionicons
                    name={active ? item.icon : item.iconOff}
                    size={17}
                    color={active ? colors.lav5 : colors.tm}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[sty.navLabel, active && sty.navLabelActive]}>{item.label}</Text>
                    {item.sub && <Text style={sty.navSub} numberOfLines={1}>{item.sub}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Logout */}
      <TouchableOpacity
        style={sty.logoutBtn}
        onPress={() => confirmar('Encerrar sessão', 'Deseja sair do painel administrativo?', sair, 'Sair')}
      >
        <Ionicons name="log-out-outline" size={16} color={colors.peach2} />
        <Text style={sty.logoutText}>Encerrar sessão</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminLayout({ children, currentScreen }) {
  const { perfil, sair } = useAuth();
  const navigation = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navigateTo = (screen) => {
    setDrawerOpen(false);
    navigation.navigate(screen);
  };

  return (
    <SafeAreaView style={sty.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.card} />
      {isWide ? (
        <View style={sty.rootWide}>
          <View style={sty.sidebar}>
            <SidebarContent
              navigate={navigateTo}
              currentScreen={currentScreen}
              perfil={perfil}
              sair={sair}
            />
          </View>
          <View style={sty.main}><LavandaBg />{children}</View>
          {Platform.OS === 'web' && (
            <AdminPreviewPanel currentScreen={currentScreen} />
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={sty.mobileHeader}>
            <TouchableOpacity onPress={() => setDrawerOpen(true)} style={sty.hamburger}>
              <Ionicons name="menu" size={22} color={colors.td} />
            </TouchableOpacity>
            <Image source={logo} style={sty.mobileLogo} resizeMode="contain" />
            <View style={{ width: 38 }} />
          </View>
          <View style={sty.main}><LavandaBg />{children}</View>
          {drawerOpen && (
            <View style={sty.drawerContainer}>
              <View style={sty.drawer}>
                <SidebarContent
                  navigate={navigateTo}
                  currentScreen={currentScreen}
                  perfil={perfil}
                  sair={sair}
                />
              </View>
              <TouchableOpacity
                style={sty.drawerOverlay}
                onPress={() => setDrawerOpen(false)}
                activeOpacity={1}
              />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const sty = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // Wide layout
  rootWide: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: SIDEBAR_W,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  sidebarInner: { flex: 1, paddingBottom: spacing.lg },
  main: { flex: 1, backgroundColor: colors.bg, position: 'relative' },

  // Branding
  brand: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandLogo: { width: 52, height: 52, marginBottom: 8, borderRadius: 14 },
  brandName: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 20, color: colors.lav6, letterSpacing: 0.5,
  },
  adminBadge: {
    backgroundColor: colors.lav1, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 3, marginTop: 6,
    borderWidth: 1, borderColor: colors.lav3,
  },
  adminBadgeText: {
    fontFamily: fonts.bodyBold, fontSize: 9,
    color: colors.lav5, letterSpacing: 1.5,
  },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: spacing.md,
    backgroundColor: colors.lav1,
    borderRadius: radius.lg, padding: 12,
    borderWidth: 1, borderColor: colors.lav2,
  },
  avatarImg: { width: 38, height: 38, borderRadius: 19 },
  avatarPlaceholder: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.lav4,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontFamily: fonts.bodyBold, fontSize: 18, color: 'white' },
  profileName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  profileSub: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 1 },

  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md, marginBottom: spacing.sm },

  // Navigation
  navScroll: { flex: 1, paddingHorizontal: 8 },
  navGrupo: { marginTop: spacing.md },
  navGrupoTitulo: {
    fontFamily: fonts.bodyBold, fontSize: 9.5, color: colors.tl,
    letterSpacing: 1, textTransform: 'uppercase',
    paddingHorizontal: 12, marginBottom: 6,
  },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: radius.md, marginBottom: 2,
    position: 'relative',
  },
  navItemActive: { backgroundColor: colors.lav1 },
  navBar: {
    position: 'absolute', left: 0, top: 8, bottom: 8,
    width: 3, borderRadius: 2, backgroundColor: 'transparent',
  },
  navBarActive: { backgroundColor: colors.lav4 },
  navLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.tm },
  navSub: { fontFamily: fonts.body, fontSize: 9.5, color: colors.tl, marginTop: 1 },
  navLabelActive: { fontFamily: fonts.bodyBold, color: colors.lav5 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: spacing.md, marginTop: 4,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.peach2 + '55',
  },
  logoutText: { fontFamily: fonts.body, fontSize: 13, color: colors.peach2 },

  // Mobile
  mobileHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  hamburger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  mobileLogo: { width: 36, height: 36, borderRadius: 10 },
  drawerContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 100, flexDirection: 'row',
  },
  drawer: { width: SIDEBAR_W, backgroundColor: colors.card },
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
});
