import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, TextInput, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { Button, Disclaimer, LavandaBg } from '../../components';
import { useAuth } from '../../hooks/AuthContext';

const headerImg = require('../../../assets/images/header-lavender.jpg');
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
      <StatusBar barStyle="light-content" backgroundColor="#4a4453" />
      <LavandaBg />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        {/* ── Banner com aquarela ── */}
        <View style={styles.heroWrap}>
          <Image source={headerImg} style={styles.heroImg} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.appName}>Atravessia</Text>
            <Text style={styles.tagline}>Um espaço para você atravessar o luto</Text>
          </View>
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

  heroWrap: { position: 'relative', height: 230 },
  heroImg: { width: '100%', height: 230 },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
    backgroundColor: 'rgba(250,247,243,0.55)',
  },
  heroContent: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', paddingBottom: 8,
  },
  logo: { width: 72, height: 72, marginBottom: 8, borderRadius: 18 },
  appName: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 36,
    color: '#FFFDF9',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(74,68,83,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,253,249,0.9)',
    marginTop: 4,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(74,68,83,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  card: {
    marginHorizontal: spacing.lg,
    marginTop: -28,
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#6b5b7a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
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
