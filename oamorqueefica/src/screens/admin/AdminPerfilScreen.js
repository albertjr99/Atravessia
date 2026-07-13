import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Image, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ref as sRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { colors, fonts, spacing, radius } from '../../theme';
import { Card, Button } from '../../components';
import { useAuth } from '../../hooks/AuthContext';
import { storage } from '../../services/firebase';
import AdminLayout from './AdminLayout';

export default function AdminPerfilScreen({ navigation }) {
  const { perfil, atualizarPerfil } = useAuth();
  const [nome, setNome] = useState(perfil?.nome || '');
  const [photoURL, setPhotoURL] = useState(perfil?.photoURL || '');
  const [salvando, setSalvando] = useState(false);
  const [uploadando, setUploadando] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  const handleFotoUpload = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Upload', 'O upload de foto está disponível apenas no portal web.\nNo celular, cole o link da imagem no campo abaixo.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadando(true);
      setUploadPct(0);
      try {
        const nomeArq = `perfil_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const fileRef = sRef(storage, `perfis/${nomeArq}`);
        const task = uploadBytesResumable(fileRef, file);
        task.on(
          'state_changed',
          (snap) => setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          () => { Alert.alert('Erro', 'Falha no upload. Tente novamente.'); setUploadando(false); },
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            setPhotoURL(url);
            setUploadando(false);
            Alert.alert('Foto carregada!', 'Clique em "Salvar" para aplicar a foto.');
          }
        );
      } catch {
        Alert.alert('Erro', 'Não foi possível iniciar o upload.');
        setUploadando(false);
      }
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => document.body.removeChild(input), 5000);
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
        <Text style={s.pageTitle}>Meu Perfil</Text>
        <Text style={s.pageSub}>Atualize sua foto e nome exibidos no painel.</Text>

        {/* Avatar */}
        <Card style={s.avatarCard}>
          <TouchableOpacity
            style={s.avatarWrap}
            onPress={handleFotoUpload}
            disabled={uploadando}
            activeOpacity={0.8}
          >
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarLetter}>{inicialAtual}</Text>
              </View>
            )}
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
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${uploadPct}%` }]} />
              </View>
              <Text style={s.uploadLabel}>Fazendo upload... {uploadPct}%</Text>
            </View>
          )}

          <Text style={s.avatarHint}>Toque para fazer upload de uma foto</Text>
          <Text style={[s.avatarHint, { color: colors.tl, fontSize: 10, marginTop: 2 }]}>
            (apenas no portal web)
          </Text>
        </Card>

        {/* Link da foto */}
        <Card style={{ marginBottom: spacing.md }}>
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
        </Card>

        {/* Nome */}
        <Card style={{ marginBottom: spacing.md }}>
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
        </Card>

        <Button
          title={salvando ? 'Salvando...' : 'Salvar perfil'}
          onPress={handleSalvar}
          style={{ marginBottom: spacing.lg }}
        />
      </ScrollView>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg },

  avatarCard: { alignItems: 'center', gap: 8, marginBottom: spacing.md, paddingVertical: spacing.lg },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.lav3 },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.lav4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.lav3,
  },
  avatarLetter: { fontFamily: fonts.bodyBold, fontSize: 40, color: 'white' },
  avatarEdit: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.lav5,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'white',
  },
  avatarHint: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, textAlign: 'center' },
  progressTrack: { height: 5, backgroundColor: colors.lav1, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.lav4, borderRadius: radius.full },
  uploadLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, textAlign: 'center', marginTop: 4 },

  formLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 6, marginTop: spacing.sm },
  required: { color: colors.rose },
  optional: { color: colors.tl, fontSize: 11 },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  emailBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.lav1, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.lav2,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  emailText: { fontFamily: fonts.body, fontSize: 13, color: colors.tm },
  hint: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 4 },
});
