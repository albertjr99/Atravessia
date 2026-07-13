import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, TextInput, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../../theme';
import { tiposPerda, temposPerda, perguntasTipoLuto, escalaTipoLuto } from '../../data';
import { ScriptTitle, Button, Disclaimer } from '../../components';
import { useAuth } from '../../hooks/AuthContext';

const decoracaoFlores = require('../../../assets/images/decoracao_flores.png');

const STEPS = ['dados', 'perda', 'luto', 'conclusao'];

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
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', estado: '', perda: null, tempo: null });
  const [showSenha, setShowSenha] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [aceitouPriv, setAceitouPriv] = useState(false);
  const [respostasLuto, setRespostasLuto] = useState({});
  const [enviando, setEnviando] = useState(false);

  const handleAvancarDados = () => {
    if (!form.nome.trim() || !form.email.trim() || form.senha.length < 6) {
      Alert.alert('Atenção', 'Preencha nome, e-mail e uma senha com pelo menos 6 caracteres.');
      return;
    }
    if (!aceitouTermos || !aceitouPriv) {
      Alert.alert('Atenção', 'É necessário aceitar os termos de uso e a política de privacidade.');
      return;
    }
    setStep(1);
  };

  const handleConcluir = async () => {
    setEnviando(true);
    try {
      await cadastrar({
        email: form.email.trim(),
        senha: form.senha,
        nome: form.nome.trim(),
        estado: form.estado.trim(),
        perda: form.perda,
        tempo: form.tempo,
        tipoLuto: respostasLuto,
      });
      navigation.replace('MainTabs');
    } catch (e) {
      Alert.alert('Erro ao cadastrar', mensagemErro(e.code));
    } finally {
      setEnviando(false);
    }
  };

  const handleAvancarLuto = () => {
    if (Object.keys(respostasLuto).length < perguntasTipoLuto.length) {
      Alert.alert('Atenção', 'Responda todas as perguntas para continuar.');
      return;
    }
    setStep(3);
  };

  const StepIndicator = () => (
    <View style={styles.stepRow}>
      {STEPS.map((_, i) => (
        <View key={i} style={[styles.stepDot, i <= step && styles.stepDotAtivo, i < step && styles.stepDotFeito]} />
      ))}
      <Text style={styles.stepLabel}>Passo {step + 1} de {STEPS.length}</Text>
    </View>
  );

  if (step === 0) return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <ScriptTitle size={28}>Atravessia</ScriptTitle>
          <Text style={styles.headerSub}>Crie sua conta gratuita</Text>
        </View>
        <View style={styles.section}>
          <StepIndicator />
          <Text style={styles.stepTitle}>Seus dados</Text>

          <Text style={styles.fieldLabel}>Nome completo</Text>
          <TextInput style={styles.input} placeholder="Seu nome" placeholderTextColor={colors.tl} value={form.nome} onChangeText={v => setForm(p => ({ ...p, nome: v }))} />

          <Text style={styles.fieldLabel}>E-mail</Text>
          <TextInput style={styles.input} placeholder="seu@email.com" placeholderTextColor={colors.tl} keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={v => setForm(p => ({ ...p, email: v }))} />

          <Text style={styles.fieldLabel}>Senha</Text>
          <View style={styles.inputRow}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Mínimo 6 caracteres" placeholderTextColor={colors.tl} secureTextEntry={!showSenha} value={form.senha} onChangeText={v => setForm(p => ({ ...p, senha: v }))} />
            <TouchableOpacity onPress={() => setShowSenha(p => !p)} style={styles.eyeBtn}>
              <Ionicons name={showSenha ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.tl} />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Estado / País</Text>
          <TextInput style={styles.input} placeholder="Ex: São Paulo — Brasil" placeholderTextColor={colors.tl} value={form.estado} onChangeText={v => setForm(p => ({ ...p, estado: v }))} />

          <TouchableOpacity style={styles.checkRow} onPress={() => setAceitouTermos(p => !p)}>
            <View style={[styles.checkbox, aceitouTermos && styles.checkboxOn]}>
              {aceitouTermos && <Ionicons name="checkmark" size={12} color="white" />}
            </View>
            <Text style={styles.checkText}>Aceito os <Text style={styles.checkLink}>termos de uso</Text></Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkRow} onPress={() => setAceitouPriv(p => !p)}>
            <View style={[styles.checkbox, aceitouPriv && styles.checkboxOn]}>
              {aceitouPriv && <Ionicons name="checkmark" size={12} color="white" />}
            </View>
            <Text style={styles.checkText}>Aceito a <Text style={styles.checkLink}>política de privacidade</Text></Text>
          </TouchableOpacity>

          <Button title="Continuar" onPress={handleAvancarDados} style={{ marginTop: spacing.lg }} />
          <View style={{ marginTop: spacing.md }}><Disclaimer /></View>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: spacing.md, alignItems: 'center' }}>
            <Text style={styles.checkText}>Já tem conta? <Text style={styles.checkLink}>Entrar</Text></Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );

  if (step === 1) return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ScriptTitle size={24}>Sobre você</ScriptTitle>
          <Text style={styles.headerSub}>Para personalizar seu acolhimento</Text>
        </View>
        <View style={styles.section}>
          <StepIndicator />
          <Text style={styles.pergunta}>"Sobre quem você sente mais saudade hoje?"</Text>
          <Text style={styles.perguntaSub}>Marque até 2 opções</Text>
          <View style={styles.grid2}>
            {tiposPerda.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.optCard, form.perda === p && styles.optCardSel]}
                onPress={() => setForm(prev => ({ ...prev, perda: p }))}
              >
                <Text style={[styles.optText, form.perda === p && { color: colors.lav6, fontFamily: fonts.bodyBold }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.pergunta, { marginTop: spacing.lg }]}>Há quanto tempo ocorreu a perda?</Text>
          {temposPerda.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.radioRow, form.tempo === t && styles.radioRowSel]}
              onPress={() => setForm(prev => ({ ...prev, tempo: t }))}
            >
              <View style={[styles.radio, form.tempo === t && styles.radioOn]} />
              <Text style={[styles.radioText, form.tempo === t && { color: colors.lav6, fontFamily: fonts.bodyBold }]}>{t}</Text>
            </TouchableOpacity>
          ))}

          <Button title="Continuar" onPress={() => setStep(2)} style={{ marginTop: spacing.lg }} />
        </View>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );

  if (step === 2) return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ScriptTitle size={24}>Seu tipo de luto</ScriptTitle>
          <Text style={styles.headerSub}>Responda com sinceridade — não existe resposta certa</Text>
        </View>
        <View style={styles.section}>
          <StepIndicator />
          {perguntasTipoLuto.map((pergunta, i) => (
            <View key={i} style={styles.lutoQ}>
              <Text style={styles.lutoQTexto}>{i + 1}. {pergunta}</Text>
              <View style={styles.escalaRow}>
                {escalaTipoLuto.map((opt, idx) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.escalaOpt, respostasLuto[i] === idx && styles.escalaOptSel]}
                    onPress={() => setRespostasLuto(prev => ({ ...prev, [i]: idx }))}
                  >
                    <Text style={[styles.escalaOptText, respostasLuto[i] === idx && { color: colors.lav6, fontFamily: fonts.bodyBold }]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          <Button title="Continuar" onPress={handleAvancarLuto} style={{ marginTop: spacing.lg }} />
        </View>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.conclusao}>
        <Image source={decoracaoFlores} style={styles.conclusaoImg} resizeMode="contain" />
        <Text style={styles.conclusaoTitulo}>Bem-vinda, {form.nome.split(' ')[0] || 'você'}!</Text>
        <Text style={styles.conclusaoSub}>Este é um espaço seguro para continuar amando quem partiu e continuar vivendo.</Text>
        <Button title={enviando ? 'Criando conta...' : 'Começar minha jornada'} onPress={handleConcluir} style={{ marginTop: spacing.xl, width: '100%' }} />
        <View style={{ marginTop: spacing.lg }}><Disclaimer /></View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md, alignItems: 'center' },
  headerSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginTop: 4 },
  section: { paddingHorizontal: spacing.lg },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.lg },
  stepDot: { width: 24, height: 5, borderRadius: 3, backgroundColor: colors.lav1 },
  stepDotAtivo: { backgroundColor: colors.lav4 },
  stepDotFeito: { backgroundColor: colors.sage },
  stepLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginLeft: 4 },
  stepTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td, marginBottom: spacing.md },
  fieldLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 4, marginTop: spacing.sm },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: colors.lav3, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  checkText: { fontFamily: fonts.body, fontSize: 12, color: colors.td, flex: 1 },
  checkLink: { color: colors.lav5, textDecorationLine: 'underline' },
  pergunta: { fontFamily: fonts.script, fontSize: 15, color: colors.td, marginBottom: 4 },
  perguntaSub: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, marginBottom: spacing.md },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: 12 },
  optCardSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  optText: { fontFamily: fonts.body, fontSize: 13, color: colors.td },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 6 },
  radioRowSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  radio: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.tl },
  radioOn: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  radioText: { fontFamily: fonts.body, fontSize: 13, color: colors.td },
  lutoQ: { marginBottom: spacing.lg },
  lutoQTexto: { fontFamily: fonts.body, fontSize: 13, color: colors.td, marginBottom: 8, lineHeight: 18 },
  escalaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  escalaOpt: { backgroundColor: colors.card, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, paddingHorizontal: 10 },
  escalaOptSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  escalaOptText: { fontFamily: fonts.body, fontSize: 11, color: colors.td },
  conclusao: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  conclusaoImg: { width: 180, height: 180 },
  conclusaoTitulo: { fontFamily: fonts.script, fontSize: 26, color: colors.lav6, marginTop: spacing.md, marginBottom: spacing.sm },
  conclusaoSub: { fontFamily: fonts.quote, fontSize: 14, fontStyle: 'italic', color: colors.tm, textAlign: 'center', lineHeight: 22 },
});
