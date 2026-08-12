import { getAuth } from 'firebase/auth';

const BUCKET = 'o-amor-que-fica.firebasestorage.app';

// Uploads a local URI (file://, content://) to Firebase Storage via REST API.
// Avoids Firebase web SDK blob issues in React Native.
export async function uploadToStorage(uri, storagePath, mimeType = 'image/jpeg') {
  const auth = getAuth();
  const token = await auth.currentUser.getIdToken();
  const encodedPath = encodeURIComponent(storagePath);
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodedPath}`;

  const blob = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Erro ao ler o arquivo'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri);
    xhr.send();
  });

  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Resposta inválida do servidor')); }
      } else {
        reject(new Error(`Falha no upload (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Erro de rede no upload'));
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Firebase ${token}`);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.send(blob);
  });

  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media&token=${result.downloadTokens}`;
}
