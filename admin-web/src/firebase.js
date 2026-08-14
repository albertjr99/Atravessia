import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBSXzFC2u_Jv-5f-U4r9oopek-22G6d8dA',
  authDomain: 'o-amor-que-fica.firebaseapp.com',
  projectId: 'o-amor-que-fica',
  storageBucket: 'o-amor-que-fica.firebasestorage.app',
  messagingSenderId: '383096379126',
  appId: '1:383096379126:web:8ca848c8b25bbd29027ed7',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const ADMIN_EMAIL = 'carla.zambi.psi@gmail.com';
