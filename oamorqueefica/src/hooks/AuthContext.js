import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { ADMIN_EMAIL } from '../services/firebaseConfig';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const ref = doc(db, 'usuarios', user.uid);
        const snap = await getDoc(ref);
        setPerfil(snap.exists() ? snap.data() : null);
      } else {
        setPerfil(null);
      }
      setCarregando(false);
    });
    return unsub;
  }, []);

  const cadastrar = async ({ email, senha, nome, estado, perda, tempo, tipoLuto }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    const role = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user';
    const perfilNovo = {
      nome, email, estado, perda, tempo, tipoLuto,
      plano: 1,
      role,
      criadoEm: serverTimestamp(),
    };
    await setDoc(doc(db, 'usuarios', cred.user.uid), perfilNovo);
    setPerfil(perfilNovo);
    return cred.user;
  };

  const entrar = (email, senha) => signInWithEmailAndPassword(auth, email, senha);

  const sair = () => firebaseSignOut(auth);

  const recuperarSenha = (email) => sendPasswordResetEmail(auth, email);

  const atualizarPerfil = async (dados) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'usuarios', firebaseUser.uid), dados);
    setPerfil(prev => ({ ...prev, ...dados }));
  };

  const isAdmin = perfil?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      firebaseUser, perfil, carregando, isAdmin,
      cadastrar, entrar, sair, recuperarSenha, atualizarPerfil,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
