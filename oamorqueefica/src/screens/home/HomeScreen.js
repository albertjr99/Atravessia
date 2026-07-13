import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Platform, Image, Dimensions, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { frases, reflexoes, emocoes } from '../../data';
import { ScriptTitle } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { confirmar } from '../../utils/confirm';

const headerLavender = require('../../../assets/images/header-lavender.jpg');
const logo = require('../../../assets/images/travessia_logo.png');
const ilMulher = require('../../../assets/images/il_mulher_flores.png');
const ilCoracao = require('../../../assets/images/il_coracao_ramos.png');
const { width: SCREEN_W } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { usuario, notificacoes, checkins } = useApp();
  const { sair } = useAuth();
  const [fraseIdx] = useState(0);
  const naoLidas = notificacoes.filter(n => !n.lida).length;

  const handleSair = () => {
    confirmar('Sair da conta', 'Deseja encerrar a sessão e trocar de conta?', sair, 'Sair');
  };
  const saudacao = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };
  const weekHistory = checkins.slice(-6);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F4EE" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ===== HEADER COM AQUARELA ===== */}
        <View style={s.headerWrap}>
          <Image source={headerLavender} style={s.headerImg} resizeMode="cover" />
          {/* Gradiente fade para o fundo */}
          <View style={s.headerFade} />
          {/* Sino notificação */}
          <TouchableOpacity style={s.bellBtn} onPress={() => navigation.navigate('Notificacoes')}>
            <Ionicons name="notifications-outline" size={18} color="#9b86bd" />
            {naoLidas > 0 && <View style={s.bellBadge} />}
          </TouchableOpacity>
          {/* Sair / trocar conta */}
          <TouchableOpacity style={s.logoutBtn} onPress={handleSair}>
            <Ionicons name="log-out-outline" size={18} color="#9b86bd" />
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.greetName}>{saudacao()}, {usuario.nome} <Text style={{ color: '#9b86bd' }}>💜</Text></Text>
                <Text style={s.greetSub}>Que hoje você se permita sentir, acolher e seguir.</Text>
              </View>
              <Image source={ilMulher} style={s.greetIl} resizeMode="contain" />
            </View>
          </View>

          {/* ===== FRASE DO DIA ===== */}
          <View style={s.fraseCard}>
            <View style={s.fraseTagRow}>
              <Ionicons name="sunny-outline" size={13} color="#9b86bd" />
              <Text style={s.fraseTag}>Frase do dia</Text>
              <Image source={ilCoracao} style={s.fraseIl} resizeMode="contain" />
            </View>
            <Text style={s.fraseTxt}>"{frases[fraseIdx].texto}"</Text>
            {frases[fraseIdx].autor ? <Text style={s.fraseAutor}>— {frases[fraseIdx].autor}</Text> : null}
          </View>

          {/* ===== CHECK-IN ===== */}
          <View style={s.sect}>
            <Text style={s.sectTitle}>Como estou me sentindo hoje?</Text>
            <View style={s.emoGrid}>
              {emocoes.filter(e => e.positiva).map(e => (
                <TouchableOpacity key={e.id} style={s.emoCard} onPress={() => navigation.navigate('CheckIn')} activeOpacity={0.8}>
                  <View style={[s.emoCircle, { backgroundColor: e.bg }]}>
                    <Ionicons name={`${e.icon}-outline`} size={18} color={e.color} />
                  </View>
                  <Text style={s.emoLbl}>{e.label}</Text>
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
                <Ionicons name="moon-outline" size={14} color="#9b86bd" />
                <Text style={s.sectTitle}>Reflexão do dia</Text>
              </View>
              <TouchableOpacity><Text style={s.sectLink}>Ver todas</Text></TouchableOpacity>
            </View>
            <View style={s.reflexaoCard}>
              <Text style={s.reflexaoTxt}>{reflexoes[0].texto}</Text>
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
                <Text style={s.perfilLbl}>Pequenas Vitórias</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.perfilCard} onPress={() => navigation.navigate('Relatorios')} activeOpacity={0.85}>
                <Ionicons name="bar-chart-outline" size={20} color="#8B7AC0" />
                <Text style={s.perfilLbl}>Relatórios</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Disclaimer */}
          <Text style={s.disclaimer}>
            Este aplicativo oferece acolhimento e não substitui atendimento médico ou psicológico.
          </Text>
        </View>

      </ScrollView>

      {/* ===== BOTTOM NAV ===== */}
      <View style={s.bnav}>
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
  safe: { flex: 1, backgroundColor: '#F8F4EE' },
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
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,253,249,0.8)',
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute', right: 10, top: 10,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#D8B4B6',
  },
  logoutBtn: {
    position: 'absolute', right: 64, top: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,253,249,0.8)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerLogo: { width: 44, height: 44, marginBottom: 2, borderRadius: 10 },
  headerBottom: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    alignItems: 'center',
  },
  appTitle: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 28, color: '#4a4453', marginTop: 4,
    letterSpacing: 0.5,
  },

  body: { paddingHorizontal: 20 },

  // Saudação
  greetSect: { marginTop: 20, marginBottom: 20 },
  greetName: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 24, color: '#4a4453',
  },
  greetSub: {
    fontFamily: 'Lato_400Regular',
    fontSize: 14, color: '#8c8597', marginTop: 4,
  },
  greetIl: { width: 80, height: 80, marginLeft: 8 },

  // Frase
  fraseCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 24, padding: 24, paddingTop: 20,
    borderWidth: 1, borderColor: 'rgba(230,221,210,0.7)',
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
    color: '#9b86bd', letterSpacing: 1, textTransform: 'uppercase',
  },
  fraseTxt: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 22, fontStyle: 'italic',
    color: '#4a4453', lineHeight: 32, textAlign: 'center',
  },
  fraseAutor: {
    fontFamily: 'Lato_400Regular', fontSize: 12,
    color: '#8c8597', textAlign: 'center', marginTop: 8,
  },

  // Section
  sect: { marginBottom: 24 },
  sectTitle: { fontFamily: 'Lato_700Bold', fontSize: 16, color: '#4a4453', marginBottom: 12 },
  sectHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectLink: { fontFamily: 'Lato_400Regular', fontSize: 13, color: '#9b86bd' },

  // Emoções
  emoGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  emoCard: {
    flex: 1, alignItems: 'center', gap: 6,
    backgroundColor: '#FFFDF9', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 4,
    borderWidth: 1, borderColor: 'rgba(230,221,210,0.7)',
  },
  emoCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  emoLbl: { fontFamily: 'Lato_400Regular', fontSize: 10, color: '#4a4453', textAlign: 'center' },

  // Perfil e cuidados
  perfilGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  perfilCard: {
    flexBasis: '47%', flexGrow: 1, alignItems: 'center', gap: 6,
    backgroundColor: '#FFFDF9', borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 8,
    borderWidth: 1, borderColor: 'rgba(230,221,210,0.7)',
  },
  perfilLbl: { fontFamily: 'Lato_700Bold', fontSize: 12, color: '#4a4453', textAlign: 'center' },

  // Check-in btn
  checkinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#9b86bd', borderRadius: 999,
    paddingVertical: 16,
    // shadow-soft
    shadowColor: '#9b86bd',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 6,
  },
  checkinTxt: { fontFamily: 'Lato_700Bold', fontSize: 15, color: 'white' },

  // Reflexão
  reflexaoCard: {
    backgroundColor: 'rgba(235,227,243,0.5)',
    borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: 'rgba(230,221,210,0.7)',
  },
  reflexaoTxt: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 18, fontStyle: 'italic',
    color: '#6b5b88', lineHeight: 28,
  },

  disclaimer: {
    fontFamily: 'Lato_400Regular', fontSize: 12,
    color: '#8c8597', textAlign: 'center',
    lineHeight: 18, marginBottom: 20,
  },

  // Nav
  bnav: {
    backgroundColor: 'rgba(255,253,249,0.95)',
    borderTopWidth: 1, borderTopColor: 'rgba(230,221,210,0.7)',
    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
    paddingTop: 8,
    flexDirection: 'row', justifyContent: 'space-around',
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  navItem: { alignItems: 'center', gap: 3, flex: 1 },
  navLbl: { fontFamily: 'Lato_400Regular', fontSize: 10, color: '#8c8597' },
  navLblActive: { fontFamily: 'Lato_700Bold', color: '#9b86bd' },
});
