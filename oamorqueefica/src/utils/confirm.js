import { Alert, Platform } from 'react-native';

export function confirmar(titulo, mensagem, onConfirmar, textoConfirmar = 'Confirmar') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensagem}`)) onConfirmar();
    return;
  }
  Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    { text: textoConfirmar, style: 'destructive', onPress: onConfirmar },
  ]);
}
