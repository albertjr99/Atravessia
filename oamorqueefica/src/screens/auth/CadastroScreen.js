import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, TextInput, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs, LinearGradient as SvgGradiente, RadialGradient, Stop, Mask, Rect, Ellipse, Image as SvgImage,
} from 'react-native-svg';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { Disclaimer, LavandaBg } from '../../components';
import { LogoRespira, Profundo } from '../../components/Efeitos';
import { useAuth } from '../../hooks/AuthContext';

const logo = require('../../../assets/images/travessia_logo.png');
const headerImg = require('../../../assets/images/header-lavender.jpg');

// Topo "Luz de Vidro" (igual ao da entrada): a aquarela se dissolve na aurora.
function TopoAquarela({ altura, children }) {
  return (
    <View style={{ height: altura }}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradiente id="cadastroFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgGradiente>
          <Mask id="cadastroMascara" x="0" y="0" width="100%" height="100%">
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#cadastroFade)" />
          </Mask>
          <RadialGradient id="cadastroLuz" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
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
          mask="url(#cadastroMascara)"
        />
        <Ellipse cx="50%" cy="60%" rx="46%" ry="36%" fill="url(#cadastroLuz)" />
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

function mensagemErro(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'Este e-mail já está cadastrado. Tente entrar.';
    case 'auth/invalid-email': return 'E-mail inválido.';
    case 'auth/weak-password': return 'A senha precisa ter pelo menos 6 caracteres.';
    default: return 'Não foi possível concluir o cadastro. Tente novamente.';
  }
}

export default function CadastroScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tablet = width >= 700;
  const { cadastrar } = useAuth();
  const [form, setForm] = useState({
    nome: '', apelido: '', email: '', telefone: '', cidade: '', senha: '',
    linkEmpresa: null, empresa: '',
  });
  const [showSenha, setShowSenha] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [aceitouPriv, setAceitouPriv] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCadastrar = async () => {
    setErro('');
    if (!form.nome.trim()) {
      Alert.alert('Atenção', 'Informe seu nome completo.');
      return;
    }
    if (!form.email.trim()) {
      Alert.alert('Atenção', 'Informe seu e-mail.');
      return;
    }
    if (form.senha.length < 6) {
      Alert.alert('Atenção', 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (form.linkEmpresa === true && !form.empresa.trim()) {
      Alert.alert('Atenção', 'Informe o nome da empresa ou organização.');
      return;
    }
    if (!aceitouTermos || !aceitouPriv) {
      Alert.alert('Atenção', 'É necessário aceitar os termos de uso e a política de privacidade.');
      return;
    }
    setEnviando(true);
    try {
      await cadastrar({
        email: form.email.trim(),
        senha: form.senha,
        nome: form.nome.trim(),
        apelido: form.apelido.trim(),
        telefone: form.telefone.trim(),
        cidade: form.cidade.trim(),
        linkEmpresa: form.linkEmpresa,
        empresa: form.linkEmpresa === true ? form.empresa.trim() : '',
      });
      // onAuthStateChanged handles navigation automatically after account creation
    } catch (e) {
      const msg = mensagemErro(e.code);
      setErro(msg);
      Alert.alert('Erro ao cadastrar', msg);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}>

        <TopoAquarela altura={(tablet ? 300 : 250) + insets.top}>
          <View style={[styles.heroContent, { paddingTop: insets.top }]}>
            <LogoRespira source={logo} style={styles.logo} />
            <Text style={styles.appName}>Atravessia</Text>
            <Text style={styles.tagline}>Crie sua conta gratuita</Text>
          </View>
        </TopoAquarela>

        <View style={[styles.card, tablet && styles.cardTablet]}>

          {erro ? <Text style={styles.erroInline}>{erro}</Text> : null}

          {/* ── Campos obrigatórios ── */}
          <Text style={styles.fieldLabel}>Nome completo <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input} placeholder="Seu nome"
            placeholderTextColor={colors.tl} value={form.nome}
            onChangeText={v => set('nome', v)}
          />

          <Text style={styles.fieldLabel}>Como quer ser chamado(a)? <Text style={styles.optional}>(opcional)</Text></Text>
          <TextInput
            style={styles.input} placeholder="Apelido ou nome preferido"
            placeholderTextColor={colors.tl} value={form.apelido}
            onChangeText={v => set('apelido', v)}
          />

          <Text style={styles.fieldLabel}>E-mail <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input} placeholder="seu@email.com"
            placeholderTextColor={colors.tl} keyboardType="email-address"
            autoCapitalize="none" value={form.email}
            onChangeText={v => set('email', v)}
          />

          <Text style={styles.fieldLabel}>Telefone <Text style={styles.optional}>(opcional)</Text></Text>
          <TextInput
            style={styles.input} placeholder="(00) 00000-0000"
            placeholderTextColor={colors.tl} keyboardType="phone-pad"
            value={form.telefone} onChangeText={v => set('telefone', v)}
          />

          <Text style={styles.fieldLabel}>Cidade / Estado <Text style={styles.optional}>(opcional)</Text></Text>
          <TextInput
            style={styles.input} placeholder="Ex: São Paulo — SP"
            placeholderTextColor={colors.tl} value={form.cidade}
            onChangeText={v => set('cidade', v)}
          />

          <Text style={styles.fieldLabel}>Senha <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputNaLinha]} placeholder="Mínimo 6 caracteres"
              placeholderTextColor={colors.tl} secureTextEntry={!showSenha}
              value={form.senha} onChangeText={v => set('senha', v)}
            />
            <TouchableOpacity onPress={() => setShowSenha(p => !p)} style={styles.eyeBtn}>
              <Ionicons name={showSenha ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.tl} />
            </TouchableOpacity>
          </View>

          {/* ── Veio por link de empresa? ── */}
          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
            Você chegou ao Atravessia por um link de empresa ou parceria?
          </Text>
          <View style={styles.radioGroup}>
            {[{ v: true, label: 'Sim' }, { v: false, label: 'Não' }].map(({ v, label }) => (
              <TouchableOpacity
                key={label}
                style={[styles.radioRow, form.linkEmpresa === v && styles.radioRowSel]}
                onPress={() => set('linkEmpresa', v)}
                accessibilityRole="radio"
                accessibilityState={{ selected: form.linkEmpresa === v }}
              >
                <View style={[styles.radio, form.linkEmpresa === v && styles.radioOn]} />
                <Text style={[styles.radioText, form.linkEmpresa === v && styles.radioTextSel]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Nome da empresa (obrigatório quando linkEmpresa = true) ── */}
          {form.linkEmpresa === true && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 4 }]}>
                Nome da empresa ou organização <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Empresa ABC Ltda"
                placeholderTextColor={colors.tl}
                value={form.empresa}
                onChangeText={v => set('empresa', v)}
              />
            </>
          )}

          {/* ── Aceite ── */}
          <TouchableOpacity style={styles.checkRow} onPress={() => setAceitouTermos(p => !p)}>
            <View style={[styles.checkbox, aceitouTermos && styles.checkboxOn]}>
              {aceitouTermos && <Ionicons name="checkmark" size={15} color="white" />}
            </View>
            <Text style={styles.checkText}>
              Aceito os <Text style={styles.checkLink}>termos de uso</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkRow} onPress={() => setAceitouPriv(p => !p)}>
            <View style={[styles.checkbox, aceitouPriv && styles.checkboxOn]}>
              {aceitouPriv && <Ionicons name="checkmark" size={15} color="white" />}
            </View>
            <Text style={styles.checkText}>
              Aceito a <Text style={styles.checkLink}>política de privacidade</Text>
            </Text>
          </TouchableOpacity>

          <BotaoLilas
            titulo={enviando ? 'Criando conta...' : 'Criar minha conta'}
            onPress={handleCadastrar}
            desativado={enviando}
            externo={{ marginTop: spacing.lg }}
          />

          <View style={{ marginTop: spacing.md }}><Disclaimer /></View>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.jaTemConta}
          >
            <Text style={[styles.checkText, styles.jaTemContaTxt]}>
              Já tem conta? <Text style={styles.checkLink}>Entrar</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  heroContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 16, paddingHorizontal: spacing.lg },
  logo: { width: 66, height: 66, borderRadius: 18 },
  appName: { fontFamily: fonts.serif, fontSize: 42, lineHeight: 50, color: colors.lav6, letterSpacing: 0.4, marginTop: 10 },
  tagline: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.texto2, marginTop: 2, textAlign: 'center' },

  // Formulário num cartão de vidro forte
  card: {
    marginHorizontal: spacing.lg, marginTop: -24, padding: 22,
    backgroundColor: colors.vidroForte, borderRadius: 28, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 14 }, shadowOpacity: colors.escuro ? 0.4 : 0.14, shadowRadius: 28, elevation: 3,
  },
  cardTablet: { marginHorizontal: 48, padding: 32 },
  erroInline: {
    fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.roseTexto, backgroundColor: colors.erroFundo,
    borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, textAlign: 'center',
  },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2, marginBottom: 6, marginTop: 14 },
  required: { color: colors.roseTexto },
  optional: { fontFamily: fonts.body, color: colors.tl, fontSize: 11 },
  input: {
    minHeight: 52, backgroundColor: colors.cardSolido, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: fonts.body, fontSize: 14, color: colors.titulo,
  },
  // Senha: o campo e o "olho" ficam dentro da mesma caixa
  inputRow: {
    flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingRight: 4,
    backgroundColor: colors.cardSolido, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  inputNaLinha: { flex: 1, backgroundColor: 'transparent', borderWidth: 0 },
  eyeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  // Sim / Não em trilho de vidro
  radioGroup: {
    flexDirection: 'row', gap: 4, padding: 4, marginBottom: spacing.sm,
    backgroundColor: colors.lavVeu, borderRadius: radius.full, borderWidth: 1, borderColor: colors.bordaSuave,
  },
  radioRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 42, borderRadius: radius.full,
  },
  radioRowSel: {
    backgroundColor: colors.escuro ? colors.lav2 : colors.cardSolido,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2,
  },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.tl },
  radioOn: { backgroundColor: colors.botao, borderColor: colors.botao },
  radioText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.texto2 },
  radioTextSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, minHeight: 32 },
  checkbox: {
    width: 24, height: 24, borderRadius: 8,
    borderWidth: 1.5, borderColor: colors.lav3, backgroundColor: colors.cardSolido,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.botao, borderColor: colors.botao },
  checkText: { fontFamily: fonts.body, fontSize: 13, color: colors.titulo, flex: 1 },
  checkLink: { fontFamily: fonts.bodySemi, color: colors.lilasTexto, textDecorationLine: 'underline' },
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 22, overflow: 'hidden' },
  btnGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 5 },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#FFFFFF', letterSpacing: 0.2 },
  jaTemConta: { marginTop: spacing.md, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  jaTemContaTxt: { flex: 0, textAlign: 'center' },
}));
