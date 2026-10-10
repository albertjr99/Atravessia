import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadToStorage } from './storageUpload';

// Foto do perfil da usuária: escolhe na galeria (recorte quadrado), envia para
// perfis/{uid}/ no Storage (a regra só permite a própria pasta, até 5 MB) e
// devolve o endereço. Retorna null se ela desistir.
export async function escolherEnviarFoto(uid) {
  if (!uid) return null;
  const caminho = `perfis/${uid}/foto_${Date.now()}.jpg`;

  if (Platform.OS === 'web') {
    const file = await new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => resolve(e.target.files?.[0] || null);
      input.click();
    });
    if (!file) return null;
    if (file.size > 5 * 1024 * 1024) throw new Error('A foto precisa ter até 5 MB.');
    const { ref: sRef, uploadBytes, getDownloadURL } = require('firebase/storage');
    const { storage } = require('../services/firebase');
    const r = sRef(storage, caminho);
    await uploadBytes(r, file, { contentType: file.type || 'image/jpeg' });
    return getDownloadURL(r);
  }

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permissão necessária', 'Para escolher uma foto, permita o acesso à galeria nas configurações do aparelho.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.55, // foto leve: carrega rápido e fica bem abaixo do limite
  });
  if (res.canceled) return null;
  return uploadToStorage(res.assets[0].uri, caminho, 'image/jpeg');
}
