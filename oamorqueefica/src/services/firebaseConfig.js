// TODO: substitua pelos valores reais do seu projeto Firebase.
// Console: https://console.firebase.google.com -> Configurações do projeto -> Seus apps -> SDK config
// Essas chaves são públicas (identificam o projeto), não são segredos.
export const firebaseConfig = {
  apiKey: 'AIzaSyBSXzFC2u_Jv-5f-U4r9oopek-22G6d8dA',
  authDomain: 'o-amor-que-fica.firebaseapp.com',
  projectId: 'o-amor-que-fica',
  storageBucket: 'o-amor-que-fica.firebasestorage.app',
  messagingSenderId: '383096379126',
  appId: '1:383096379126:web:8ca848c8b25bbd29027ed7',
};

// E-mail da conta administradora. Usuárias com este e-mail (ou com
// role: 'admin' no documento Firestore usuarios/{uid}) acessam o painel admin.
// Administradoras autorizadas.
export const ADMIN_EMAILS = [
  'carla.zambi.psi@gmail.com',
  'larissapjaniques@gmail.com',
];

export const isAdminEmail = (email) =>
  ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());

// Mantido por compatibilidade com código antigo.
export const ADMIN_EMAIL = ADMIN_EMAILS[0];
