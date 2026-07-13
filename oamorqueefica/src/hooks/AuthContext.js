import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { ADMIN_EMAIL } from '../services/firebaseConfig';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let unsubPerfil = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (unsubPerfil) { unsubPerfil(); unsubPerfil = null; }
      if (user) {
        // onSnapshot (em vez de getDoc único) garante que o plano seja atualizado
        // em tempo real assim que a Cloud Function confirmar o pagamento no Stripe.
        unsubPerfil = onSnapshot(doc(db, 'usuarios', user.uid), (snap) => {
          setPerfil(snap.exists() ? snap.data() : null);
          setCarregando(false);
        }, () => setCarregando(false));
      } else {
        setPerfil(null);
        setCarregando(false);
      }
    });
    return () => { unsubAuth(); if (unsubPerfil) unsubPerfil(); };
  }, []);

  const cadastrar = async ({ email, senha, nome, apelido, telefone, cidade, linkEmpresa }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    const role = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user';
    const perfilNovo = {
      nome, apelido: apelido || '', telefone: telefone || '', cidade: cidade || '',
      email, linkEmpresa: linkEmpresa ?? null,
      plano: 0,
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
