import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { firebaseConfig } from './firebaseConfig';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = Platform.OS === 'web'
  ? getAuth(app)
  : (() => {
      try {
        return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
      } catch (e) {
        return getAuth(app);
      }
    })();

export const db = getFirestore(app);
export default app;
