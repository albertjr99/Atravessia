import { Alert, Linking, Platform } from 'react-native';

// Normaliza o que a admin digitou no painel para uma URL realmente navegável.
// Aceita: "https://x.com", "www.x.com", "x.com/promo", "wa.me/5511...",
// "+55 11 99999-9999" (vira wa.me) e esquemas diretos (mailto:, tel:, whatsapp:).
export function normalizarUrl(bruto) {
  const raw = String(bruto ?? '')
    .trim()
    .replace(/^[<"'\s]+/, '')
    .replace(/[>"'\s]+$/, '');
  if (!raw) return null;

  // Já tem um esquema válido — usa como está.
  if (/^(https?|mailto|tel|whatsapp|sms):/i.test(raw)) return raw;

  // Parece um domínio (tem ponto e nenhum espaço) — assume https.
  if (/^[^\s]+\.[a-z]{2,}(\/|$|\?|#)/i.test(raw)) return `https://${raw}`;

  // Só dígitos/telefone — trata como WhatsApp.
  const digitos = raw.replace(/\D/g, '');
  if (digitos.length >= 10 && digitos.length <= 15) return `https://wa.me/${digitos}`;

  return null;
}

// Abre um link de forma confiável em web e nativo.
// Em web usa clique em <a target="_blank">, que — ao contrário de window.open com
// windowFeatures — não é tratado como popup e portanto não é bloqueado.
export async function abrirLink(bruto, { onErro } = {}) {
  const url = normalizarUrl(bruto);

  if (!url) {
    const msg = 'Este item ainda não tem um link válido cadastrado.';
    onErro ? onErro(msg) : Alert.alert('', msg);
    return false;
  }

  if (Platform.OS === 'web') {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch {
      window.open(url, '_blank');
      return true;
    }
  }

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    const msg = `Não foi possível abrir:\n${url}`;
    onErro ? onErro(msg) : Alert.alert('', msg);
    return false;
  }
}
