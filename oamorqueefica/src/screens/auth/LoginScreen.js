import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, TextInput, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { colors, fonts, spacing, radius } from '../../theme';
import { Button, Disclaimer, LavandaBg } from '../../components';
import { useAuth } from '../../hooks/AuthContext';

const headerImg = require('../../../assets/images/header-lavender.jpg');
const logo = require('../../../assets/images/travessia_logo.png');

const BIOMETRIC_EMAIL_KEY = 'biometric_email';
const BIOMETRIC_PASS_KEY = 'biometric_pass';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

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
  const [biometricDisponivel, setBiometricDisponivel] = useState(false);
  const [biometricAtivado, setBiometricAtivado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const compativel = await LocalAuthentication.hasHardwareAsync();
        const cadastrado = await LocalAuthentication.isEnrolledAsync();
        const ativado = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        setBiometricDisponivel(compativel && cadastrado);
        setBiometricAtivado(ativado === 'true');
        if (compativel && cadastrado && ativado === 'true') {
          const emailSalvo = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
          if (emailSalvo) setEmail(emailSalvo);
        }
      } catch {}
    })();
  }, []);

  const handleEntrar = async () => {
    setErro('');
    if (!email || !senha) { Alert.alert('Atenção', 'Informe e-mail e senha.'); return; }
    setCarregando(true);
    try {
      await entrar(email.trim(), senha);
      if (biometricDisponivel && !biometricAtivado) {
        Alert.alert(
          'Ativar biometria?',
          'Deseja usar digital ou face ID para entrar mais rápido nas próximas vezes?',
          [
            { text: 'Não agora', style: 'cancel' },
            {
              text: 'Ativar',
              onPress: async () => {
                await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email.trim());
                await SecureStore.setItemAsync(BIOMETRIC_PASS_KEY, senha);
                await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
                setBiometricAtivado(true);
              },
            },
          ]
        );
      }
    } catch (e) {
      const msg = mensagemErro(e.code);
      setErro(msg);
      Alert.alert('Erro ao entrar', msg);
    } finally {
      setCarregando(false);
    }
  };

  const handleBiometria = async () => {
    try {
      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirme sua identidade',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar senha',
      });
      if (!resultado.success) return;
      const emailSalvo = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
      const senhaSalva = await SecureStore.getItemAsync(BIOMETRIC_PASS_KEY);
      if (!emailSalvo || !senhaSalva) {
        Alert.alert('Erro', 'Faça login com e-mail e senha primeiro para ativar a biometria.');
        return;
      }
      setCarregando(true);
      try {
        await entrar(emailSalvo, senhaSalva);
      } catch (e) {
        Alert.alert('Erro ao entrar', mensagemErro(e.code));
      } finally {
        setCarregando(false);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível usar biometria.');
    }
  };

  const handleEsqueciSenha = async () => {
    if (!email) { Alert.alert('Atenção', 'Informe seu e-mail acima.'); return; }
    try {
      await recuperarSenha(email.trim());
      Alert.alert('Pronto', 'Enviamos um e-mail com instruções para redefinir sua senha.');
    } catch (e) {
      Alert.alert('Erro', mensagemErro(e.code));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.heroWrap}>
          <Image source={headerImg} style={styles.heroImg} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.appName}>Atravessia</Text>
            <Text style={styles.tagline}>Que você se permita sentir, acolher e seguir.</Text>
          </View>
        </View>

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

          {biometricDisponivel && biometricAtivado && (
            <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometria} activeOpacity={0.8}>
              <Ionicons name="finger-print-outline" size={22} color={colors.lav5} />
              <Text style={styles.biometricText}>Entrar com biometria</Text>
            </TouchableOpacity>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Cadastro')}>
            <Text style={styles.secondaryBtnText}>Criar conta gratuita</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}><Disclaimer /></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  heroWrap: { position: 'relative', height: 240 },
  heroImg: { width: '100%', height: 240 },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(58,48,74,0.52)' },
  heroContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  logo: { width: 72, height: 72, marginBottom: 8, borderRadius: 18 },
  appName: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 38, color: '#FFFFFF', letterSpacing: 1, textShadowColor: 'rgba(30,20,50,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  tagline: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,240,255,0.95)', marginTop: 4, letterSpacing: 0.4 },
  card: { marginHorizontal: spacing.lg, marginTop: -28, backgroundColor: colors.card, borderRadius: 24, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, shadowColor: '#6b5b7a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 6 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.td, marginBottom: spacing.md, textAlign: 'center' },
  erroInline: { fontFamily: fonts.body, fontSize: 12, color: colors.roseFg, backgroundColor: '#FFF0EE', borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm, textAlign: 'center' },
  fieldLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 6, marginTop: spacing.sm },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm },
  inputIcon: { marginRight: 6 },
  input: { flex: 1, paddingVertical: 13, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  eyeBtn: { padding: 8 },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 8, marginBottom: 4 },
  forgotText: { fontFamily: fonts.body, fontSize: 12, color: colors.lav5, textDecorationLine: 'underline' },
  btn: { marginTop: spacing.md },
  biometricBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.md, paddingVertical: 12, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.lav3, backgroundColor: colors.lav1 },
  biometricText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lav5 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },
  secondaryBtn: { borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.lav3, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.lav1 },
  secondaryBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lav6 },
  footer: { marginTop: spacing.xl, paddingHorizontal: spacing.lg, alignItems: 'center' },
});
