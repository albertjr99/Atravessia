import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';

// Chamado ao abrir uma tela com compra. Tira a Cloud Function do estado
// "parado" (a primeira chamada depois de um tempo sem uso demora alguns
// segundos) e, no Android, deixa o navegador pré-carregado para a página do
// Stripe abrir mais rápido.
export function aquecerPagamento(nomeFuncao) {
  httpsCallable(functions, nomeFuncao)({ aquecer: true }).catch(() => {});
  if (Platform.OS === 'android') WebBrowser.warmUpAsync().catch(() => {});
}

// Abre a página de pagamento do Stripe. O navegador interno falhava em alguns
// aparelhos — sem navegador compatível com abas personalizadas, ou com uma aba
// anterior ainda aberta —, e o pagamento simplesmente não abria. Nesses casos
// fecha o que estiver aberto e, se ainda assim falhar, abre no navegador padrão.
export async function abrirPagamento(url) {
  try {
    if (Platform.OS === 'ios') WebBrowser.dismissBrowser();
    await WebBrowser.openBrowserAsync(url, {
      showTitle: true,
      enableBarCollapsing: true,
      dismissButtonStyle: 'close',
    });
  } catch {
    await Linking.openURL(url);
  }
}

export function mensagemErroPagamento(e) {
  const codigo = String(e?.code || '').replace('functions/', '');
  switch (codigo) {
    case 'already-exists':
    case 'failed-precondition':
    case 'invalid-argument':
      return e.message;
    case 'unauthenticated':
      return 'Sua sessão expirou. Entre novamente e tente de novo.';
    case 'unavailable':
    case 'deadline-exceeded':
    case 'internal':
    case 'not-found':
      return 'O serviço de pagamento não respondeu agora. Verifique sua internet e tente de novo em alguns instantes.';
    default:
      return e?.message || 'Tente novamente em alguns instantes.';
  }
}
