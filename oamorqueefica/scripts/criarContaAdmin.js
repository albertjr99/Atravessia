// Script de uso único: cria a conta da administradora no Firebase Auth + Firestore
// e dispara um e-mail de redefinição de senha para que ela mesma defina a senha.
// Execução: node scripts/criarContaAdmin.js
//
// Pré-requisito: preencher src/services/firebaseConfig.js com as chaves reais do projeto.
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } = require('firebase/auth');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');
const crypto = require('crypto');
const { firebaseConfig, ADMIN_EMAIL } = require('../src/services/firebaseConfig');

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const senhaTemporaria = crypto.randomBytes(18).toString('base64');

  console.log(`Criando conta administradora para ${ADMIN_EMAIL}...`);
  const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, senhaTemporaria);

  await setDoc(doc(db, 'usuarios', cred.user.uid), {
    nome: 'Carla Zambi',
    email: ADMIN_EMAIL,
    role: 'admin',
    plano: 3,
    criadoEm: serverTimestamp(),
  });

  await sendPasswordResetEmail(auth, ADMIN_EMAIL);
  await signOut(auth);

  console.log('Conta criada com sucesso.');
  console.log(`Um e-mail de redefinição de senha foi enviado para ${ADMIN_EMAIL}.`);
  console.log('A senha temporária gerada não foi exibida nem armazenada — a Carla deve usar o link do e-mail para definir a senha dela.');
}

main().catch((e) => {
  console.error('Erro ao criar conta administradora:', e.message);
  process.exit(1);
});
