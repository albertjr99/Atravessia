import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Lato_300Light, Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import { PlayfairDisplay_400Regular, PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display';
import { CormorantGaramond_400Regular_Italic } from '@expo-google-fonts/cormorant-garamond';
import { DancingScript_600SemiBold } from '@expo-google-fonts/dancing-script';
import AppNavigator from './src/navigation/AppNavigator';
import SplashAnimado from './src/components/SplashAnimado';
import { AppProvider } from './src/hooks/AppContext';
import { AuthProvider } from './src/hooks/AuthContext';

// Segura o splash nativo até a vinheta animada estar montada, senão pisca um
// fundo vazio entre os dois.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Lato_300Light,
    Lato_400Regular,
    Lato_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    CormorantGaramond_400Regular_Italic,
    DancingScript_600SemiBold,
  });
  const [vinhetaTerminou, setVinhetaTerminou] = useState(false);

  const fontesProntas = fontsLoaded || fontError;

  useEffect(() => {
    if (fontesProntas) SplashScreen.hideAsync().catch(() => {});
  }, [fontesProntas]);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#FAF7F3' }}>
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
      </View>
    </SafeAreaProvider>
  );
}
