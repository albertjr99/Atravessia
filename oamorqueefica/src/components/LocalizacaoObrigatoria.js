import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing, criarEstilos } from '../theme';
import { useAuth } from '../hooks/AuthContext';
import CamposLocalizacao, { validarLocalizacao } from './CamposLocalizacao';

// Pedido obrigatório de estado e cidade para quem já usava o app antes de
// esses campos existirem. Aparece depois do login e da apresentação inicial,
// não tem botão de pular e some sozinho assim que o perfil é salvo.
export default function LocalizacaoObrigatoria() {
  const { perfil, atualizarPerfil } = useAuth();
  const insets = useSafeAreaInsets();
  const [estado, setEstado] = useState(/^[A-Z]{2}$/.test(String(perfil?.estado || '')) ? perfil.estado : '');
  // Cadastros antigos guardavam "Cidade — UF" num campo só: aproveita a parte da cidade.
  const [cidade, setCidade] = useState(String(perfil?.cidade || '').split(/\s[-—–]\s|[—–/,]/)[0].trim());
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const v = validarLocalizacao({ estado, cidade });
    if (!v.ok) { setErro(v.erro); return; }
    setErro('');
    setSalvando(true);
    try {
      await atualizarPerfil({ estado: v.estado, cidade: v.cidade });
    } catch (e) {
      setErro('Não foi possível salvar agora. Verifique a conexão e tente de novo.');
      setSalvando(false);
    }
  };

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => {}}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
        >
          <View style={s.icone}><Ionicons name="location-outline" size={30} color={colors.lilasTexto} /></View>
          <Text style={s.titulo}>De onde você é?</Text>
          <Text style={s.texto}>
            Para trazer parcerias e achados perto de você, precisamos saber seu estado e sua cidade.
            Essa informação fica no seu perfil e você pode alterá-la quando quiser.
          </Text>

          <View style={s.cartao}>
            <CamposLocalizacao
              estado={estado}
              cidade={cidade}
              onChangeEstado={(v) => { setEstado(v); setErro(''); }}
              onChangeCidade={(v) => { setCidade(v); setErro(''); }}
              estiloRotulo={s.rotulo}
              estiloInput={s.input}
            />
            {!!erro && <Text style={s.erro}>{erro}</Text>}

            <TouchableOpacity style={[s.botao, salvando && { opacity: 0.7 }]} onPress={salvar} disabled={salvando} accessibilityRole="button">
              {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.botaoTxt}>Salvar e continuar</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = criarEstilos(() => ({
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, alignItems: 'center' },
  icone: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  titulo: { fontFamily: fonts.serif, fontSize: 28, color: colors.titulo, textAlign: 'center' },
  texto: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.texto2, textAlign: 'center', marginTop: spacing.sm, maxWidth: 420 },
  cartao: {
    width: '100%', maxWidth: 440, marginTop: spacing.lg, padding: 22,
    backgroundColor: colors.cardSolido, borderRadius: 26, borderWidth: 1, borderColor: colors.bordaSuave,
  },
  rotulo: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2, marginBottom: 6, marginTop: 14 },
  input: {
    minHeight: 52, backgroundColor: colors.bg, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 14, color: colors.titulo,
  },
  erro: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.roseTexto, marginTop: 12, textAlign: 'center' },
  botao: { marginTop: spacing.lg, minHeight: 52, borderRadius: 999, backgroundColor: colors.botao, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#FFFFFF' },
}), { escalar: false });
