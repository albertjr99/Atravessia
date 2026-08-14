import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';

import HomeScreen from '../screens/home/HomeScreen';
import AudiosScreen from '../screens/audios/AudiosScreen';
import AudioPlayerScreen from '../screens/audios/AudioPlayerScreen';
import PequenasVitoriasScreen from '../screens/jornadas/PequenasVitoriasScreen';
import RelatoriosScreen from '../screens/relatorios/RelatoriosScreen';
import CheckInScreen from '../screens/checkin/CheckInScreen';
import CadastroScreen from '../screens/auth/CadastroScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import PlanosScreen from '../screens/planos/PlanosScreen';
import NotificacoesScreen from '../screens/notificacoes/NotificacoesScreen';
import DatasSensiveisScreen from '../screens/perfil/DatasSensiveisScreen';
import RedeApoioScreen from '../screens/perfil/RedeApoioScreen';

import AdminHomeScreen from '../screens/admin/AdminHomeScreen';
import AdminConteudosScreen from '../screens/admin/AdminConteudosScreen';
import AdminNotificacoesScreen from '../screens/admin/AdminNotificacoesScreen';
import AdminUsuariasScreen from '../screens/admin/AdminUsuariasScreen';
import AdminRelatoriosScreen from '../screens/admin/AdminRelatoriosScreen';
import AdminPerfilScreen from '../screens/admin/AdminPerfilScreen';
import AdminParceriasScreen from '../screens/admin/AdminParceriasScreen';
import AdminVitoriasScreen from '../screens/admin/AdminVitoriasScreen';
import AdminPrecosScreen from '../screens/admin/AdminPrecosScreen';
import AdminJornadasScreen from '../screens/admin/AdminJornadasScreen';
import AdminMensagensRelatorioScreen from '../screens/admin/AdminMensagensRelatorioScreen';
import AdminFrasesScreen from '../screens/admin/AdminFrasesScreen';
import AdminAudiosScreen from '../screens/admin/AdminAudiosScreen';
import AdminTravessiaScreen from '../screens/admin/AdminTravessiaScreen';
import ParceriasScreen from '../screens/parcerias/ParceriasScreen';
import FavoritosScreen from '../screens/favoritos/FavoritosScreen';
import JornadasScreen from '../screens/jornadas/JornadasScreen';

import { useAuth } from '../hooks/AuthContext';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Cadastro" component={CadastroScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={HomeScreen} />
      <Stack.Screen name="Inicio" component={HomeScreen} />
      <Stack.Screen name="Audios" component={AudiosScreen} />
      <Stack.Screen name="AudioPlayer" component={AudioPlayerScreen} />
      <Stack.Screen name="PequenasVitorias" component={PequenasVitoriasScreen} />
      <Stack.Screen name="Relatorios" component={RelatoriosScreen} />
      <Stack.Screen name="CheckIn" component={CheckInScreen} />
      <Stack.Screen name="Planos" component={PlanosScreen} />
      <Stack.Screen name="Notificacoes" component={NotificacoesScreen} />
      <Stack.Screen name="DatasSensiveis" component={DatasSensiveisScreen} />
      <Stack.Screen name="RedeApoio" component={RedeApoioScreen} />
      <Stack.Screen name="Parcerias" component={ParceriasScreen} />
      <Stack.Screen name="Favoritos" component={FavoritosScreen} />
      <Stack.Screen name="Jornadas" component={JornadasScreen} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
      <Stack.Screen name="AdminConteudos" component={AdminConteudosScreen} />
      <Stack.Screen name="AdminNotificacoes" component={AdminNotificacoesScreen} />
      <Stack.Screen name="AdminUsuarias" component={AdminUsuariasScreen} />
      <Stack.Screen name="AdminRelatorios" component={AdminRelatoriosScreen} />
      <Stack.Screen name="AdminPerfil" component={AdminPerfilScreen} />
      <Stack.Screen name="AdminParcerias" component={AdminParceriasScreen} />
      <Stack.Screen name="AdminVitorias" component={AdminVitoriasScreen} />
      <Stack.Screen name="AdminPrecos" component={AdminPrecosScreen} />
      <Stack.Screen name="AdminJornadas" component={AdminJornadasScreen} />
      <Stack.Screen name="AdminMensagens" component={AdminMensagensRelatorioScreen} />
      <Stack.Screen name="AdminFrases" component={AdminFrasesScreen} />
      <Stack.Screen name="AdminAudios" component={AdminAudiosScreen} />
      <Stack.Screen name="AdminTravessia" component={AdminTravessiaScreen} />
    </Stack.Navigator>
  );
}

const SCREEN_MAP = {
  CheckIn: 'CheckIn',
  DatasSensiveis: 'DatasSensiveis',
  RedeApoio: 'RedeApoio',
  Relatorios: 'Relatorios',
  Inicio: 'MainTabs',
};

export default function AppNavigator() {
  const { firebaseUser, isAdmin, carregando } = useAuth();
  const navigationRef = useRef(null);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen;
      if (!screen || !navigationRef.current) return;
      const target = SCREEN_MAP[screen] || screen;
      try {
        navigationRef.current.navigate(target);
      } catch {}
    });
    return () => sub.remove();
  }, []);

  let content;
  if (carregando) {
    content = (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.lav4} size="large" />
      </View>
    );
  } else if (!firebaseUser) {
    content = <AuthStack />;
  } else if (isAdmin) {
    content = <AdminStack />;
  } else {
    content = <MainStack />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <NavigationContainer ref={navigationRef}>
        {content}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
