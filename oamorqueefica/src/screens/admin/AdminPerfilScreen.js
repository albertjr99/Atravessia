import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Image, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { uploadToStorage } from '../../utils/storageUpload';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, BotaoAdmin } from './adminEstilo';
import { useAuth } from '../../hooks/AuthContext';
import { storage } from '../../services/firebase';
import AdminLayout from './AdminLayout';

export default function AdminPerfilScreen({ navigation }) {
  const { perfil, atualizarPerfil } = useAuth();
  const [nome, setNome] = useState(perfil?.nome || '');
  const [photoURL, setPhotoURL] = useState(perfil?.photoURL || '');
  const [salvando, setSalvando] = useState(false);
  const [uploadando, setUploadando] = useState(false);

  const handleFotoUpload = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadando(true);
        try {
          const nomeArq = `perfil_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
          const fileRef = sRef(storage, `perfis/${nomeArq}`);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          setPhotoURL(url);
          Alert.alert('Foto carregada!', 'Clique em "Salvar" para aplicar a foto.');
        } catch (err) {
          Alert.alert('Erro no upload', err?.code || err?.message || 'Tente novamente.');
        } finally {
          setUploadando(false);
        }
      };
      document.body.appendChild(input);
      input.click();
      setTimeout(() => { if (document.body.contains(input)) document.body.removeChild(input); }, 5000);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações do app.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      setUploadando(true);
      try {
        const nomeArq = `perfil_${Date.now()}.jpg`;
        const url = await uploadToStorage(uri, `perfis/${nomeArq}`, 'image/jpeg');
        setPhotoURL(url);
        Alert.alert('Foto carregada!', 'Clique em "Salvar" para aplicar a foto.');
      } catch (err) {
        Alert.alert('Erro no upload', err?.code || err?.message || 'Tente novamente.');
      } finally {
        setUploadando(false);
      }
    }
  };

  const handleSalvar = async () => {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'O nome não pode ficar em branco.');
      return;
    }
    setSalvando(true);
    try {
      await atualizarPerfil({ nome: nome.trim(), photoURL: photoURL.trim() || null });
      Alert.alert('Salvo!', 'Perfil atualizado com sucesso.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o perfil.');
    } finally {
      setSalvando(false);
    }
  };

  const inicialAtual = (perfil?.nome || 'A')[0].toUpperCase();

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminPerfil">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        <Text style={s.sobre}>Configuração</Text>
        <Text style={s.pageTitle}>Meu Perfil</Text>
        <Text style={s.pageSub}>Atualize sua foto e nome exibidos no painel.</Text>

        {/* Avatar */}
        <View style={s.avatarCard}>
          <TouchableOpacity
            style={s.avatarWrap}
            onPress={handleFotoUpload}
            disabled={uploadando}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#B9A6F0', '#F3B9A5', '#A9D3B9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarAnel}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={s.avatarImg} />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Text style={s.avatarLetter}>{inicialAtual}</Text>
                </View>
              )}
            </LinearGradient>
            <View style={s.avatarEdit}>
              <Ionicons
                name={uploadando ? 'hourglass-outline' : 'camera-outline'}
                size={14}
                color="white"
              />
            </View>
          </TouchableOpacity>

          {uploadando && (
            <View style={{ width: '100%', marginTop: spacing.sm }}>
              <Text style={s.uploadLabel}>Fazendo upload...</Text>
            </View>
          )}

          <Text style={s.avatarHint}>Toque para fazer upload de uma foto</Text>
        </View>

        {/* Link da foto */}
        <View style={s.card}>
          <Text style={s.formLabel}>Ou cole o link da foto <Text style={s.optional}>(opcional)</Text></Text>
          <TextInput
            style={s.input}
            placeholder="https://..."
            placeholderTextColor={colors.tl}
            autoCapitalize="none"
            value={photoURL}
            onChangeText={setPhotoURL}
          />
          <Text style={s.hint}>Google Drive, Gravatar, Firebase Storage, etc.</Text>
        </View>

        {/* Nome */}
        <View style={s.card}>
          <Text style={s.formLabel}>Nome de exibição <Text style={s.required}>*</Text></Text>
          <TextInput
            style={s.input}
            placeholder="Seu nome"
            placeholderTextColor={colors.tl}
            value={nome}
            onChangeText={setNome}
          />

          <Text style={[s.formLabel, { marginTop: spacing.md }]}>E-mail</Text>
          <View style={s.emailBox}>
            <Ionicons name="lock-closed-outline" size={13} color={colors.tl} />
            <Text style={s.emailText}>{perfil?.email || '—'}</Text>
          </View>
          <Text style={s.hint}>O e-mail não pode ser alterado aqui.</Text>
        </View>

        <BotaoAdmin
          title={salvando ? 'Salvando...' : 'Salvar perfil'}
          onPress={handleSalvar}
          style={{ marginBottom: spacing.lg }}
        />
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },
  card: { ...est.vidro(26), padding: 18, paddingTop: 6, marginBottom: spacing.md },

  avatarCard: { ...est.vidro(26), alignItems: 'center', gap: 10, marginBottom: spacing.md, paddingVertical: 24 },
  avatarWrap: { position: 'relative' },
  avatarAnel: { width: 104, height: 104, borderRadius: 52, padding: 4, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.cardSolido,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontFamily: fonts.serif, fontSize: 48, color: colors.lav6 },
  avatarEdit: {
    position: 'absolute', bottom: 4, right: 4,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.botaoForte,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.cardSolido,
  },
  avatarHint: { ...est.legenda(), textAlign: 'center' },
  uploadLabel: { ...est.dica(), textAlign: 'center' },

  formLabel: est.rotulo(),
  required: est.obrigatorio(),
  optional: { color: colors.tl, fontSize: 12.5, fontFamily: fonts.body },
  input: est.campo(),
  emailBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    ...est.tenue(14), minHeight: 48,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  emailText: { fontFamily: fonts.body, fontSize: 15, color: colors.texto2 },
  hint: est.dica(),
}), { escalar: false });
