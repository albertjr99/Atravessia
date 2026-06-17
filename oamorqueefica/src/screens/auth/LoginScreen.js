import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { ScriptTitle, Button, Disclaimer } from '../../components';
import { useAuth } from '../../hooks/AuthContext';

function mensagemErro(code) {
  switch (code) {
    case 'auth/invalid-email': return 'E-mail inválido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'E-mail ou senha incorretos.';
    case 'auth/too-many-requests': return 'Muitas tentativas. Tente novamente em alguns minutos.';
    default: return 'Não foi possível entrar. Verifique seus dados e tente novamente.';
  }
}

export default function LoginScreen({ navigation }) {
  const { entrar, recuperarSenha } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleEntrar = async () => {
    if (!email || !senha) {
      Alert.alert('Atenção', 'Informe e-mail e senha.');
      return;
    }
    setCarregando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (e) {
      Alert.alert('Erro ao entrar', mensagemErro(e.code));
    } finally {
      setCarregando(false);
    }
  };

  const handleEsqueciSenha = async () => {
    if (!email) {
      Alert.alert('Atenção', 'Informe seu e-mail para receber o link de redefinição.');
      return;
    }
    try {
      await recuperarSenha(email.trim());
      Alert.alert('Pronto', 'Enviamos um e-mail com instruções para redefinir sua senha.');
    } catch (e) {
      Alert.alert('Erro', mensagemErro(e.code));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <ScriptTitle size={28}>o amor que fica</ScriptTitle>
          <Text style={styles.headerSub}>Entre na sua conta</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor={colors.tl}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.fieldLabel}>Senha</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Sua senha"
              placeholderTextColor={colors.tl}
              secureTextEntry={!showSenha}
              value={senha}
              onChangeText={setSenha}
            />
            <TouchableOpacity onPress={() => setShowSenha(p => !p)} style={styles.eyeBtn}>
              <Ionicons name={showSenha ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.tl} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleEsqueciSenha} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
            <Text style={styles.linkText}>Esqueci minha senha</Text>
          </TouchableOpacity>

          <Button title={carregando ? 'Entrando...' : 'Entrar'} onPress={handleEntrar} style={{ marginTop: spacing.lg }} />

          <TouchableOpacity onPress={() => navigation.navigate('Cadastro')} style={{ marginTop: spacing.md, alignItems: 'center' }}>
            <Text style={styles.checkText}>Ainda não tem conta? <Text style={styles.linkText}>Cadastre-se</Text></Text>
          </TouchableOpacity>

          <View style={{ marginTop: spacing.lg }}><Disclaimer /></View>
        </View>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md, alignItems: 'center' },
  headerSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginTop: 4 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  fieldLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 4, marginTop: spacing.sm },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 8 },
  checkText: { fontFamily: fonts.body, fontSize: 12, color: colors.td },
  linkText: { color: colors.lav5, textDecorationLine: 'underline', fontFamily: fonts.bodyBold },
});
