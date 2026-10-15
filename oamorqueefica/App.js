import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import AppNavigator from './src/navigation/AppNavigator';
import SplashAnimado from './src/components/SplashAnimado';
import { AppProvider } from './src/hooks/AppContext';
import { AuthProvider } from './src/hooks/AuthContext';
import { TemaProvider, useTema } from './src/hooks/TemaContext';
import { colors } from './src/theme';
import { FONTES } from './src/theme/fontes';

// Segura o splash nativo até a vinheta animada estar montada, senão pisca um
// fundo vazio entre os dois.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONTES);
  const [vinhetaTerminou, setVinhetaTerminou] = useState(false);

  const fontesProntas = fontsLoaded || fontError;

  useEffect(() => {
    if (fontesProntas) SplashScreen.hideAsync().catch(() => {});
  }, [fontesProntas]);

  return (
    <SafeAreaProvider>
      <TemaProvider>
        <Raiz>
        {fontesProntas && (
          <AuthProvider>
            <AppProvider>
              <AppNavigator />
            </AppProvider>
          </AuthProvider>
        )}
        {!vinhetaTerminou && (
          <SplashAnimado pronto={fontesProntas} onFim={() => setVinhetaTerminou(true)} />
        )}
        </Raiz>
      </TemaProvider>
    </SafeAreaProvider>
  );
}

// Fundo da raiz no tema atual (claro ou noturno).
function Raiz({ children }) {
  useTema();
  return <View style={{ flex: 1, backgroundColor: colors.bg }}>{children}</View>;
}
