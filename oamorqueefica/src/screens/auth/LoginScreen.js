import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, TextInput, Alert, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs, LinearGradient as SvgGradiente, RadialGradient, Stop, Mask, Rect, Ellipse, Image as SvgImage,
} from 'react-native-svg';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { Disclaimer, LavandaBg } from '../../components';
import { LogoRespira, Profundo } from '../../components/Efeitos';
import { useAuth } from '../../hooks/AuthContext';

const headerImg = require('../../../assets/images/header-lavender.jpg');
const logo = require('../../../assets/images/travessia_logo.png');

// Topo "Luz de Vidro": a aquarela de lavanda se dissolve na aurora do fundo
// (máscara em degradê) e uma luz suave atrás do logotipo deixa o nome legível.
function TopoAquarela({ altura, children }) {
  return (
    <View style={{ height: altura }}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradiente id="loginFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgGradiente>
          <Mask id="loginMascara" x="0" y="0" width="100%" height="100%">
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#loginFade)" />
          </Mask>
          <RadialGradient id="loginLuz" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset="0" stopColor={colors.cardSolido} stopOpacity={colors.escuro ? 0.55 : 0.85} />
            <Stop offset="0.55" stopColor={colors.cardSolido} stopOpacity={colors.escuro ? 0.3 : 0.5} />
            <Stop offset="1" stopColor={colors.cardSolido} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <SvgImage
          href={headerImg}
          x="0" y="0" width="100%" height="100%"
          preserveAspectRatio="xMidYMin slice"
          opacity={colors.escuro ? 0.22 : 1}
          mask="url(#loginMascara)"
        />
        <Ellipse cx="50%" cy="60%" rx="46%" ry="36%" fill="url(#loginLuz)" />
      </Svg>
      {children}
    </View>
  );
}

// Botão principal: degradê lilás com "degrau" que afunda ao toque.
function BotaoLilas({ titulo, onPress, desativado, externo }) {
  return (
    <Profundo
      externo={[externo, desativado && { opacity: 0.65 }]}
      estilo={styles.btnFace}
      base={colors.botaoBase}
      sombra={styles.btnHalo}
      onPress={desativado ? undefined : onPress}
      accessibilityLabel={titulo}
    >
      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={styles.btnGrad} />
      <Text style={styles.btnTxt}>{titulo}</Text>
    </Profundo>
  );
}

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
  const { width } = useWindowDimensions();
  const tablet = width >= 700;
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
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
      >
        <TopoAquarela altura={(tablet ? 330 : 280) + insets.top}>
          <View style={[styles.heroContent, { paddingTop: insets.top }]}>
            <LogoRespira source={logo} style={[styles.logo, tablet && styles.logoTablet]} />
            <Text style={[styles.appName, tablet && styles.appNameTablet]}>Atravessia</Text>
            <Text style={styles.tagline}>Que você se permita sentir, acolher e seguir.</Text>
          </View>
        </TopoAquarela>

        <View style={[styles.card, tablet && styles.cardTablet]}>
          <Text style={styles.cardTitle}>Entrar na conta</Text>

          {erro ? <Text style={styles.erroInline}>{erro}</Text> : null}

          <Text style={styles.fieldLabel}>E-mail</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.lilasIcone} style={styles.inputIcon} />
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
            <Ionicons name="lock-closed-outline" size={18} color={colors.lilasIcone} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Sua senha"
              placeholderTextColor={colors.tl}
              secureTextEntry={!showSenha}
              value={senha}
              onChangeText={setSenha}
            />
            <TouchableOpacity onPress={() => setShowSenha(p => !p)} style={styles.eyeBtn}>
              <Ionicons name={showSenha ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.tl} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleEsqueciSenha} style={styles.forgotBtn} hitSlop={8}>
            <Text style={styles.forgotText}>Esqueci minha senha</Text>
          </TouchableOpacity>

          <BotaoLilas
            titulo={carregando ? 'Entrando...' : 'Entrar'}
            onPress={handleEntrar}
            desativado={carregando}
            externo={styles.btn}
          />

          {biometricDisponivel && biometricAtivado && (
            <TouchableOpacity style={[styles.secondaryBtn, styles.biometricBtn]} onPress={handleBiometria} activeOpacity={0.8}>
              <Ionicons name={biometria.icone} size={21} color={colors.lilasIcone} />
              <Text style={styles.secondaryBtnText}>{biometria.rotulo}</Text>
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
  heroContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 18, paddingHorizontal: spacing.lg },
  logo: { width: 76, height: 76, borderRadius: 20 },
  logoTablet: { width: 92, height: 92, borderRadius: 24 },
  appName: { fontFamily: 'Marca', fontSize: 46, lineHeight: 54, color: colors.lav6, letterSpacing: 0.4, marginTop: 12 },
  appNameTablet: { fontSize: 54, lineHeight: 62 },
  tagline: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.texto2, marginTop: 2, textAlign: 'center' },

  // Formulário num cartão de vidro forte que sobe sobre o fim da aquarela
  card: {
    marginHorizontal: spacing.lg, marginTop: -26, padding: 22, paddingTop: 24,
    backgroundColor: colors.vidroForte, borderRadius: 28, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 14 }, shadowOpacity: colors.escuro ? 0.4 : 0.14, shadowRadius: 28, elevation: 3,
  },
  cardTablet: { marginHorizontal: 48, padding: 32 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.titulo, marginBottom: 6, textAlign: 'center' },
  erroInline: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.roseTexto, backgroundColor: colors.erroFundo, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm, textAlign: 'center' },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2, marginBottom: 6, marginTop: 14 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingLeft: 14, paddingRight: 4,
    backgroundColor: colors.cardSolido, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 13, fontFamily: fonts.body, fontSize: 14, color: colors.titulo },
  eyeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 10, marginBottom: 4, paddingVertical: 2 },
  forgotText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.lilasTexto },
  btn: { marginTop: spacing.md },
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 22, overflow: 'hidden' },
  btnGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 5 },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#FFFFFF', letterSpacing: 0.2 },
  biometricBtn: { marginTop: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.bordaSuave },
  dividerText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tl },
  // Secundários em vidro: "Entrar com rosto ou digital" e "Criar conta gratuita"
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 52, paddingHorizontal: 18,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro,
  },
  secondaryBtnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.lilasTexto },
  footer: { marginTop: spacing.xl, paddingHorizontal: spacing.lg, alignItems: 'center' },
}));
