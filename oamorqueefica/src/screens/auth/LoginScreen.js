import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, TextInput, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { Button, Disclaimer } from '../../components';
import { useAuth } from '../../hooks/AuthContext';

const logo = require('../../../assets/images/travessia_logo.png');

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
  const [erro, setErro] = useState('');

  const handleEntrar = async () => {
    setErro('');
    if (!email || !senha) {
      Alert.alert('Atenção', 'Informe e-mail e senha.');
      return;
    }
    setCarregando(true);
    try {
      await entrar(email.trim(), senha);
      // onAuthStateChanged handles navigation automatically
    } catch (e) {
      const msg = mensagemErro(e.code);
      setErro(msg);
      Alert.alert('Erro ao entrar', msg);
    } finally {
      setCarregando(false);
    }
  };

  const handleEsqueciSenha = async () => {
    if (!email) {
      Alert.alert('Atenção', 'Informe seu e-mail acima para receber o link de redefinição.');
      return;
    }
    try {
      await recuperarSenha(email.trim());
      Alert.alert('Pronto', 'Enviamos um e-mail com as instruções para redefinir sua senha.');
    } catch (e) {
      Alert.alert('Erro', mensagemErro(e.code));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        {/* ── Header com logo ── */}
        <View style={styles.heroSection}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.appName}>Atravessia</Text>
          <Text style={styles.tagline}>App de perdas e luto</Text>
        </View>

        {/* ── Card de login ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entrar na conta</Text>

          {erro ? <Text style={styles.erroInline}>{erro}</Text> : null}

          <Text style={styles.fieldLabel}>E-mail</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={16} color={colors.tl} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor={colors.tl}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text style={styles.fieldLabel}>Senha</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.tl} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Sua senha"
              placeholderTextColor={colors.tl}
              secureTextEntry={!showSenha}
              value={senha}
              onChangeText={setSenha}
            />
            <TouchableOpacity onPress={() => setShowSenha(p => !p)} style={styles.eyeBtn}>
              <Ionicons name={showSenha ? 'eye-outline' : 'eye-off-outline'} size={17} color={colors.tl} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleEsqueciSenha} style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Esqueci minha senha</Text>
          </TouchableOpacity>

          <Button
            title={carregando ? 'Entrando...' : 'Entrar'}
            onPress={handleEntrar}
            disabled={carregando}
            style={styles.btn}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Cadastro')}>
            <Text style={styles.secondaryBtnText}>Criar conta gratuita</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Disclaimer />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingBottom: 32 },

  heroSection: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 32,
  },
  logo: { width: 90, height: 90, marginBottom: 12 },
  appName: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 34,
    color: colors.lav6,
    letterSpacing: 0.5,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.tm,
    marginTop: 4,
    letterSpacing: 0.3,
  },

  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#6b5b7a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: colors.td,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  erroInline: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.roseFg,
    backgroundColor: '#FFF0EE',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.tm,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  inputIcon: { marginRight: 6 },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.td,
  },
  eyeBtn: { padding: 8 },

  forgotBtn: { alignSelf: 'flex-end', marginTop: 8, marginBottom: 4 },
  forgotText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.lav5,
    textDecorationLine: 'underline',
  },

  btn: { marginTop: spacing.md },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },

  secondaryBtn: {
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.lav3,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.lav1,
  },
  secondaryBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.lav6,
  },

  footer: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
});
