import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Pede permissão, obtém o token de push do Expo e salva em usuarios/{uid}.pushToken
// para que as Cloud Functions agendadas possam enviar notificações mesmo com o app fechado.
export async function registrarPushToken(uid) {
  if (!uid || !Device.isDevice) return null;
  try {
    const { status: existente } = await Notifications.getPermissionsAsync();
    let status = existente;
    if (status !== 'granted') {
      const resp = await Notifications.requestPermissionsAsync();
      status = resp.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId;
    const tokenOpts = projectId ? { projectId } : {};
    const { data: token } = await Notifications.getExpoPushTokenAsync(tokenOpts);
    await updateDoc(doc(db, 'usuarios', uid), { pushToken: token });
    return token;
  } catch {
    return null;
  }
}
