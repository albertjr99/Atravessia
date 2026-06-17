import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

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
import PlanosScreen from '../screens/planos/PlanosScreen';
import SessaoScreen from '../screens/sessao/SessaoScreen';
import NotificacoesScreen from '../screens/notificacoes/NotificacoesScreen';
import DatasSensiveisScreen from '../screens/perfil/DatasSensiveisScreen';
import RedeApoioScreen from '../screens/perfil/RedeApoioScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Cadastro" component={CadastroScreen} />
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
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
