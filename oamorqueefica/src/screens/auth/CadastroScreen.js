import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, TextInput, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { ScriptTitle, Button, Disclaimer } from '../../components';
import { useAuth } from '../../hooks/AuthContext';

const decoracaoFlores = require('../../../assets/images/decoracao_flores.png');

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
  const [concluido, setConcluido] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCadastrar = async () => {
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
      setConcluido(true);
    } catch (e) {
      Alert.alert('Erro ao cadastrar', mensagemErro(e.code));
    } finally {
      setEnviando(false);
    }
  };

  if (concluido) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.conclusao}>
        <Image source={decoracaoFlores} style={styles.conclusaoImg} resizeMode="contain" />
        <Text style={styles.conclusaoTitulo}>
          Bem-vinda, {(form.apelido || form.nome).split(' ')[0] || 'você'}!
        </Text>
        <Text style={styles.conclusaoSub}>
          Este é um espaço seguro para continuar amando quem partiu e continuar vivendo.
        </Text>
        <Button
          title="Começar minha jornada"
          onPress={() => navigation.replace('MainTabs')}
          style={{ marginTop: spacing.xl, width: '100%' }}
        />
        <View style={{ marginTop: spacing.lg }}><Disclaimer /></View>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <ScriptTitle size={28}>Atravessia</ScriptTitle>
          <Text style={styles.headerSub}>Crie sua conta gratuita</Text>
        </View>

        <View style={styles.section}>

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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md, alignItems: 'center' },
  headerSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginTop: 4 },
  section: { paddingHorizontal: spacing.lg },
  fieldLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 4, marginTop: spacing.sm },
  required: { color: colors.rose },
  optional: { color: colors.tl, fontSize: 11 },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md,
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
  conclusao: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  conclusaoImg: { width: 180, height: 180 },
  conclusaoTitulo: { fontFamily: fonts.script, fontSize: 26, color: colors.lav6, marginTop: spacing.md, marginBottom: spacing.sm },
  conclusaoSub: { fontFamily: fonts.quote, fontSize: 14, fontStyle: 'italic', color: colors.tm, textAlign: 'center', lineHeight: 22 },
});
