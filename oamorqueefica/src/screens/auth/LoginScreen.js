import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, TextInput, Alert, Image, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { Button, Disclaimer, LavandaBg } from '../../components';
import { useAuth } from '../../hooks/AuthContext';

const headerImg = require('../../../assets/images/header-lavender.jpg');
const logo = require('../../../assets/images/travessia_logo.png');

const BIOMETRIC_EMAIL_KEY = 'biometric_email';
const BIOMETRIC_PASS_KEY = 'biometric_pass';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

// Descobre quais biometrias o aparelho (celular ou tablet) oferece, para o botão
// dizer "rosto", "digital" ou os dois. No Android, alguns aparelhos têm
// desbloqueio facial só para a tela de bloqueio (sem a segurança exigida para
// apps); nesses, o sistema oferece apenas a digital — isso é do aparelho.
function descreverBiometria(tipos = []) {
  const AuthenticationType = LocalAuthentication.AuthenticationType || {};
  const face = tipos.includes(AuthenticationType.FACIAL_RECOGNITION);
  const digital = tipos.includes(AuthenticationType.FINGERPRINT);
  const iris = tipos.includes(AuthenticationType.IRIS);
  if (face && !digital) {
    return Platform.OS === 'ios'
      ? { rotulo: 'Entrar com Face ID', nome: 'Face ID', icone: 'scan-outline' }
      : { rotulo: 'Entrar com reconhecimento facial', nome: 'reconhecimento facial', icone: 'scan-outline' };
  }
  if (digital && !face && !iris) {
    return Platform.OS === 'ios'
      ? { rotulo: 'Entrar com Touch ID', nome: 'Touch ID', icone: 'finger-print-outline' }
      : { rotulo: 'Entrar com digital', nome: 'digital', icone: 'finger-print-outline' };
  }
  if (face || iris) {
    return { rotulo: 'Entrar com rosto ou digital', nome: 'rosto ou digital', icone: 'scan-outline' };
  }
  return { rotulo: 'Entrar com biometria', nome: 'biometria', icone: 'finger-print-outline' };
}

// Muitos tablets (e alguns celulares) têm reconhecimento facial só por câmera,
// que o Android classifica como "conveniência" e NÃO libera para nenhum app —
// apenas para desbloquear a tela. Nesses aparelhos o app oferece entrar com o
// bloqueio do próprio aparelho (PIN, padrão ou senha), que é o que o sistema
// permite. Onde o rosto ou a digital estão liberados, continuam sendo usados.
const BLOQUEIO_APARELHO = {
  rotulo: 'Entrar com o bloqueio do aparelho',
  nome: 'o bloqueio do aparelho (PIN, padrão ou senha)',
  icone: 'lock-closed-outline',
  bloqueio: true,
};

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
  const insets = useSafeAreaInsets();
  const { entrar, recuperarSenha } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [biometricDisponivel, setBiometricDisponivel] = useState(false);
  const [biometricAtivado, setBiometricAtivado] = useState(false);
  const [biometria, setBiometria] = useState(descreverBiometria());

  useEffect(() => {
    (async () => {
      try {
        const compativel = await LocalAuthentication.hasHardwareAsync();
        const cadastrado = await LocalAuthentication.isEnrolledAsync();
        const ativado = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        const tipos = await LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => []);
        // 0 = sem bloqueio, 1 = só PIN/padrão/senha, 2+ = biometria liberada para apps.
        const nivel = await LocalAuthentication.getEnrolledLevelAsync().catch(() => 0);
        const biometriaLiberada = compativel && cadastrado;
        const disponivel = biometriaLiberada || nivel >= 1;
        setBiometria(biometriaLiberada ? descreverBiometria(tipos) : BLOQUEIO_APARELHO);
        setBiometricDisponivel(disponivel);
        setBiometricAtivado(ativado === 'true');
        if (disponivel && ativado === 'true') {
          const emailSalvo = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
          if (emailSalvo) setEmail(emailSalvo);
        }
      } catch (e) {
        console.warn('[Login] biometria indisponível:', e?.message);
      }
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
          'Entrar mais rápido?',
          `Deseja usar ${biometria.nome} para entrar nas próximas vezes?`,
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
        promptMessage: biometria.bloqueio ? 'Use o bloqueio do aparelho para entrar' : 'Confirme sua identidade',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar senha',
        // Se a biometria não estiver liberada, o sistema pede o PIN/padrão/senha.
        disableDeviceFallback: false,
        // 'weak' aceita também o reconhecimento facial dos aparelhos Android
        // (classe 2), além da digital. No iPhone/iPad, vale o Face ID ou Touch ID.
        biometricsSecurityLevel: 'weak',
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
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
      >
        <View style={[styles.heroWrap, { height: 240 + insets.top }]}>
          <Image source={headerImg} style={[styles.heroImg, { height: 240 + insets.top }]} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={[styles.heroContent, { paddingTop: insets.top }]}>
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
              <Ionicons name={biometria.icone} size={22} color={colors.lav5} />
              <Text style={styles.biometricText}>{biometria.rotulo}</Text>
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

const styles = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  heroWrap: { position: 'relative', height: 240 },
  heroImg: { width: '100%', height: 240 },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(58,48,74,0.52)' },
  heroContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  logo: { width: 72, height: 72, marginBottom: 8, borderRadius: 18 },
  appName: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 38, color: '#FFFFFF', letterSpacing: 1, textShadowColor: 'rgba(30,20,50,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  tagline: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,240,255,0.95)', marginTop: 4, letterSpacing: 0.4 },
  card: { marginHorizontal: spacing.lg, marginTop: -28, backgroundColor: colors.card, borderRadius: 24, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, shadowColor: '#6b5b7a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 6 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.td, marginBottom: spacing.md, textAlign: 'center' },
  erroInline: { fontFamily: fonts.body, fontSize: 12, color: colors.roseFg, backgroundColor: colors.erroFundo, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm, textAlign: 'center' },
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
}));
