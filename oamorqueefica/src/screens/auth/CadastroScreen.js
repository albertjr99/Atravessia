import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, TextInput, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { Button, Disclaimer, LavandaBg } from '../../components';
import { useAuth } from '../../hooks/AuthContext';

const logo = require('../../../assets/images/travessia_logo.png');
const headerImg = require('../../../assets/images/header-lavender.jpg');

function mensagemErro(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'Este e-mail já está cadastrado. Tente entrar.';
    case 'auth/invalid-email': return 'E-mail inválido.';
    case 'auth/weak-password': return 'A senha precisa ter pelo menos 6 caracteres.';
    default: return 'Não foi possível concluir o cadastro. Tente novamente.';
  }
}

export default function CadastroScreen({ navigation }) {
  const { cadastrar } = useAuth();
  const [form, setForm] = useState({
    nome: '', apelido: '', email: '', telefone: '', cidade: '', senha: '',
    linkEmpresa: null,
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
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#4a4453" />
      <LavandaBg />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>

        <View style={styles.heroWrap}>
          <Image source={headerImg} style={styles.heroImg} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.appName}>Atravessia</Text>
            <Text style={styles.tagline}>Crie sua conta gratuita</Text>
          </View>
        </View>

        <View style={styles.card}>

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
              style={[styles.input, { flex: 1 }]} placeholder="Mínimo 6 caracteres"
              placeholderTextColor={colors.tl} secureTextEntry={!showSenha}
              value={form.senha} onChangeText={v => set('senha', v)}
            />
            <TouchableOpacity onPress={() => setShowSenha(p => !p)} style={styles.eyeBtn}>
              <Ionicons name={showSenha ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.tl} />
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
              >
                <View style={[styles.radio, form.linkEmpresa === v && styles.radioOn]} />
                <Text style={[styles.radioText, form.linkEmpresa === v && { color: colors.lav6, fontFamily: fonts.bodyBold }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Aceite ── */}
          <TouchableOpacity style={styles.checkRow} onPress={() => setAceitouTermos(p => !p)}>
            <View style={[styles.checkbox, aceitouTermos && styles.checkboxOn]}>
              {aceitouTermos && <Ionicons name="checkmark" size={12} color="white" />}
            </View>
            <Text style={styles.checkText}>
              Aceito os <Text style={styles.checkLink}>termos de uso</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkRow} onPress={() => setAceitouPriv(p => !p)}>
            <View style={[styles.checkbox, aceitouPriv && styles.checkboxOn]}>
              {aceitouPriv && <Ionicons name="checkmark" size={12} color="white" />}
            </View>
            <Text style={styles.checkText}>
              Aceito a <Text style={styles.checkLink}>política de privacidade</Text>
            </Text>
          </TouchableOpacity>

          <Button
            title={enviando ? 'Criando conta...' : 'Criar minha conta'}
            onPress={handleCadastrar}
            disabled={enviando}
            style={{ marginTop: spacing.lg }}
          />

          <View style={{ marginTop: spacing.md }}><Disclaimer /></View>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: spacing.md, alignItems: 'center' }}
          >
            <Text style={styles.checkText}>
              Já tem conta? <Text style={styles.checkLink}>Entrar</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  heroWrap: { position: 'relative', height: 220 },
  heroImg: { width: '100%', height: 220 },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(58,48,74,0.52)' },
  heroContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  logo: { width: 64, height: 64, marginBottom: 8, borderRadius: 16 },
  appName: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 34, color: '#FFFFFF', letterSpacing: 1, textShadowColor: 'rgba(30,20,50,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  tagline: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,240,255,0.95)', marginTop: 4, letterSpacing: 0.4 },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: -24,
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
  fieldLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 4, marginTop: spacing.sm },
  required: { color: colors.rose },
  optional: { color: colors.tl, fontSize: 11 },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 8 },
  radioGroup: { flexDirection: 'row', gap: 10, marginBottom: spacing.sm },
  radioRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: spacing.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  radioRowSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  radio: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.tl },
  radioOn: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  radioText: { fontFamily: fonts.body, fontSize: 13, color: colors.td },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm },
  checkbox: {
    width: 18, height: 18, borderRadius: 5,
    borderWidth: 1.5, borderColor: colors.lav3,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  checkText: { fontFamily: fonts.body, fontSize: 12, color: colors.td, flex: 1 },
  checkLink: { color: colors.lav5, textDecorationLine: 'underline' },
});
