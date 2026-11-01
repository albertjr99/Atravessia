import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { useAuth } from '../../hooks/AuthContext';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { Profundo } from '../../components/Efeitos';
import {
  FAIXAS_PRECO, PRAZOS, TEXTO_CONSENTIMENTO_IMOVEIS, VERSAO_CONSENTIMENTO_IMOVEIS,
} from '../../utils/imoveis';
import { TopoImoveis, ChipsQuebra } from './comum';

// Formulário curto de interesse. Só com o consentimento marcado a indicação
// é enviada (o nome e o telefone vão para a imobiliária).
export default function InteresseImovelScreen({ route, navigation }) {
  const { imobiliariaId, imobiliariaNome, imovelId, imovelTitulo, finalidade } = route.params || {};
  const insets = useSafeAreaInsets();
  const { perfil } = useAuth();
  const [interesse, setInteresse] = useState(finalidade === 'aluguel' ? 'alugar' : 'comprar');
  const [faixa, setFaixa] = useState('');
  const [bairros, setBairros] = useState('');
  const [prazo, setPrazo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [nome, setNome] = useState(String(perfil?.nome || ''));
  const [telefone, setTelefone] = useState(String(perfil?.telefone || ''));
  const [consentiu, setConsentiu] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const telDigitos = telefone.replace(/\D/g, '');
  const pronto = consentiu && nome.trim().length >= 2 && telDigitos.length >= 10 && !enviando;

  const enviar = async () => {
    if (!consentiu) { Alert.alert('', 'Para enviar, marque a autorização de compartilhamento com a imobiliária.'); return; }
    if (nome.trim().length < 2 || telDigitos.length < 10) { Alert.alert('', 'Confira seu nome e um telefone com DDD.'); return; }
    setEnviando(true);
    try {
      const { data } = await httpsCallable(functions, 'criarIndicacaoImovel', { timeout: 30000 })({
        imobiliariaId, imovelId: imovelId || null, interesse, faixaPreco: faixa, bairros: bairros.trim(),
        prazo, observacoes: observacoes.trim(), nome: nome.trim(), telefone: telDigitos,
        consentimento: true, versaoConsentimento: VERSAO_CONSENTIMENTO_IMOVEIS,
      });
      navigation.replace('IndicacaoImovel', { leadId: data.id, novo: !data.existente });
    } catch (e) {
      const indisponivel = e?.code === 'functions/not-found';
      Alert.alert('', indisponivel ? 'Este recurso ainda não está disponível. Tente mais tarde.' : (e?.message || 'Não foi possível enviar agora. Tente de novo.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <TopoImoveis titulo="Quero indicação" onVoltar={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}>
          <View style={s.cab}>
            <Text style={s.titulo}>{imobiliariaNome || 'Imobiliária parceira'}</Text>
            {!!imovelTitulo && <Text style={s.sub}>Imóvel: {imovelTitulo}</Text>}
            <Text style={s.sub}>Leva menos de um minuto. Depois você recebe um código e um QR Code para apresentar à imobiliária.</Text>
          </View>

          <View style={s.card}>
            <ChipsQuebra rotulo="Você quer" valor={interesse} onMudar={(v) => { setInteresse(v); setFaixa(''); }}
              opcoes={[{ id: 'comprar', rotulo: 'Comprar' }, { id: 'alugar', rotulo: 'Alugar' }]} />
            <ChipsQuebra rotulo={interesse === 'alugar' ? 'Quanto pretende pagar por mês' : 'Faixa de preço'} valor={faixa} onMudar={setFaixa}
              opcoes={FAIXAS_PRECO[interesse].map(f => ({ id: f, rotulo: f }))} />
            <Text style={s.rotulo}>Bairros de preferência <Text style={s.opcional}>(opcional)</Text></Text>
            <TextInput style={s.campo} value={bairros} onChangeText={setBairros} placeholder="Ex.: Centro, Jardim América" placeholderTextColor={colors.tl} maxLength={200} />
            <ChipsQuebra rotulo="Para quando" valor={prazo} onMudar={setPrazo} opcoes={PRAZOS.map(p => ({ id: p, rotulo: p }))} />
            <Text style={s.rotulo}>Algo importante para você? <Text style={s.opcional}>(opcional)</Text></Text>
            <TextInput style={[s.campo, { minHeight: 84, textAlignVertical: 'top' }]} value={observacoes} onChangeText={setObservacoes} multiline
              placeholder="Ex.: aceita pet, perto da escola, térreo…" placeholderTextColor={colors.tl} maxLength={600} />
          </View>

          <View style={s.card}>
            <Text style={s.cardTit}>Como a imobiliária fala com você</Text>
            <Text style={s.rotulo}>Seu nome</Text>
            <TextInput style={s.campo} value={nome} onChangeText={setNome} placeholder="O nome que você prefere usar" placeholderTextColor={colors.tl} maxLength={120} />
            <Text style={s.rotulo}>Telefone / WhatsApp com DDD</Text>
            <TextInput style={s.campo} value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" placeholder="(11) 99999-9999" placeholderTextColor={colors.tl} maxLength={20} />
          </View>

          <TouchableOpacity style={[s.consent, consentiu && s.consentSel]} onPress={() => setConsentiu(v => !v)} activeOpacity={0.85}
            accessibilityRole="checkbox" accessibilityState={{ checked: consentiu }}>
            <Ionicons name={consentiu ? 'checkbox' : 'square-outline'} size={24} color={consentiu ? colors.lilasIcone : colors.tl} />
            <Text style={s.consentTxt}>{TEXTO_CONSENTIMENTO_IMOVEIS}</Text>
          </TouchableOpacity>

          <Profundo
            externo={[{ marginTop: spacing.lg }, !pronto && { opacity: 0.55 }]}
            estilo={s.btnFace} base={colors.botaoBase} sombra={s.btnHalo}
            onPress={enviando ? undefined : enviar}
            accessibilityLabel="Enviar indicação"
          >
            <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} />
            {enviando ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="paper-plane-outline" size={18} color="white" />}
            <Text style={s.btnTxt}>{enviando ? 'Enviando…' : 'Enviar e gerar meu código'}</Text>
          </Profundo>
          <Text style={s.nota}>A negociação é direta com a imobiliária. A Atravessia não cobra nada de você.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  cab: { marginTop: spacing.sm, marginBottom: spacing.md, gap: 4 },
  titulo: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.titulo },
  sub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.texto2 },
  card: { backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz, padding: 16, marginBottom: spacing.md },
  cardTit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo },
  rotulo: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2, marginTop: 14, marginBottom: 8 },
  opcional: { fontFamily: fonts.body, color: colors.tl },
  campo: {
    backgroundColor: colors.cardSolido, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 15, color: colors.td,
  },
  consent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.vidro },
  consentSel: { borderColor: colors.lav3, backgroundColor: colors.lav1 },
  consentTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.td },
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 22, overflow: 'hidden' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: 'white' },
  nota: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', marginTop: spacing.md },
}));
