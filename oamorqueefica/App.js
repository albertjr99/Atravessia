import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Lato_300Light, Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import { PlayfairDisplay_400Regular, PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display';
import { CormorantGaramond_400Regular_Italic } from '@expo-google-fonts/cormorant-garamond';
import { DancingScript_600SemiBold } from '@expo-google-fonts/dancing-script';
import AppNavigator from './src/navigation/AppNavigator';
import { AppProvider } from './src/hooks/AppContext';
import { AuthProvider } from './src/hooks/AuthContext';
import { colors } from './src/theme';

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

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF7F4' }}>
        <ActivityIndicator color="#B8A6C9" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppProvider>
          <AppNavigator />
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
