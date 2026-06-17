import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';

import HomeScreen from '../screens/home/HomeScreen';
import AudiosScreen from '../screens/audios/AudiosScreen';
import AudioPlayerScreen from '../screens/audios/AudioPlayerScreen';
import JornadasScreen from '../screens/jornadas/JornadasScreen';
import JornadaDetalheScreen from '../screens/jornadas/JornadaDetalheScreen';
import PequenasVitoriasScreen from '../screens/jornadas/PequenasVitoriasScreen';
import MemorialScreen from '../screens/memorial/MemorialScreen';
import CartasScreen from '../screens/cartas/CartasScreen';
import RelatoriosScreen from '../screens/relatorios/RelatoriosScreen';
import CheckInScreen from '../screens/checkin/CheckInScreen';
import CadastroScreen from '../screens/auth/CadastroScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import PlanosScreen from '../screens/planos/PlanosScreen';
import SessaoScreen from '../screens/sessao/SessaoScreen';
import NotificacoesScreen from '../screens/notificacoes/NotificacoesScreen';
import DatasSensiveisScreen from '../screens/perfil/DatasSensiveisScreen';
import RedeApoioScreen from '../screens/perfil/RedeApoioScreen';

import AdminHomeScreen from '../screens/admin/AdminHomeScreen';
import AdminConteudosScreen from '../screens/admin/AdminConteudosScreen';
import AdminNotificacoesScreen from '../screens/admin/AdminNotificacoesScreen';
import AdminUsuariasScreen from '../screens/admin/AdminUsuariasScreen';
import AdminRelatoriosScreen from '../screens/admin/AdminRelatoriosScreen';

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
      <Stack.Screen name="Jornadas" component={JornadasScreen} />
      <Stack.Screen name="JornadaDetalhe" component={JornadaDetalheScreen} />
      <Stack.Screen name="PequenasVitorias" component={PequenasVitoriasScreen} />
      <Stack.Screen name="Memorial" component={MemorialScreen} />
      <Stack.Screen name="Cartas" component={CartasScreen} />
      <Stack.Screen name="Relatorios" component={RelatoriosScreen} />
      <Stack.Screen name="CheckIn" component={CheckInScreen} />
      <Stack.Screen name="Planos" component={PlanosScreen} />
      <Stack.Screen name="Sessao" component={SessaoScreen} />
      <Stack.Screen name="Notificacoes" component={NotificacoesScreen} />
      <Stack.Screen name="DatasSensiveis" component={DatasSensiveisScreen} />
      <Stack.Screen name="RedeApoio" component={RedeApoioScreen} />
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
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { firebaseUser, isAdmin, carregando } = useAuth();

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
      <NavigationContainer>
        {content}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
