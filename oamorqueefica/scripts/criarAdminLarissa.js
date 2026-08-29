// Cria o acesso administrativo de Larissa Janiques.
//
// Execução (a partir de oamorqueefica/):  node scripts/criarAdminLarissa.js
//
// A conta é criada com uma senha temporária aleatória que NÃO é exibida nem
// gravada em lugar nenhum: em seguida o Firebase envia um e-mail para que ela
// mesma defina a senha. Nenhuma senha trafega por este arquivo ou pelo git.
//
// Se a conta já existir, o script apenas garante o papel de administradora no
// Firestore e reenvia o link de definição de senha.
const { initializeApp } = require('firebase/app');
const {
  getAuth, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut,
} = require('firebase/auth');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');
const crypto = require('crypto');
const { firebaseConfig } = require('../src/services/firebaseConfig');

const EMAIL = 'larissapjaniques@gmail.com';
const NOME = 'Larissa Janiques';

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  let uid = null;

  try {
    const senhaTemporaria = crypto.randomBytes(24).toString('base64');
    const cred = await createUserWithEmailAndPassword(auth, EMAIL, senhaTemporaria);
    uid = cred.user.uid;
    console.log('Conta criada no Firebase Authentication.');
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      console.log('A conta já existe no Authentication — seguindo para o perfil.');
    } else {
      throw e;
    }
  }

  if (uid) {
    await setDoc(doc(db, 'usuarios', uid), {
      nome: NOME,
      email: EMAIL,
      role: 'admin',
      plano: 3,
      acessoTotal: true,
      criadoEm: serverTimestamp(),
    }, { merge: true });
    console.log('Perfil de administradora gravado no Firestore.');
    await signOut(auth);
  } else {
    console.log(
      'Como a conta já existia, o documento em usuarios/{uid} não pôde ser criado por\n' +
      'este script. Não há problema: o e-mail já consta na lista de administradoras\n' +
      '(firestore.rules e firebaseConfig), então o acesso ao painel já está liberado.'
    );
  }

  await sendPasswordResetEmail(auth, EMAIL);
  console.log(`\nLink de definição de senha enviado para ${EMAIL}.`);
  console.log('Ela deve abrir o e-mail e escolher a própria senha para entrar no painel.');
}

main().catch((e) => {
  console.error('Erro:', e.message);
  process.exit(1);
});
