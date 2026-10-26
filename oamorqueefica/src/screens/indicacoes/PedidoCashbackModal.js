import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, ScrollView, Image, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import {
  regraCashback, calcularCashback, reaisParaCentavos, brlCentavos, nomePlataforma, escolherEnviarImagem,
} from '../../utils/afiliados';

// "Já comprei — pedir meu cashback": a usuária informa o nº do pedido, o valor
// pago e envia um print do comprovante. O pedido é registrado pela Cloud
// Function enviarPedidoCashbackAfiliado e analisado pela equipe.
export default function PedidoCashbackModal({ item, uid, onFechar, onEnviado }) {
  const [numero, setNumero] = useState('');
  const [valor, setValor] = useState('');
  const [foto, setFoto] = useState(null); // { url, caminho }
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { setNumero(''); setValor(''); setFoto(null); }, [item?.id]);

  const regra = regraCashback(item);
  const valorCentavos = reaisParaCentavos(valor) || 0;
  const previsto = calcularCashback(regra, valorCentavos);
  const loja = nomePlataforma(item);

  const escolherFoto = async () => {
    setEnviandoFoto(true);
    try {
      const r = await escolherEnviarImagem(`comprovantesAfiliados/${uid}`, { maxMB: 8, qualidade: 0.7 });
      if (r) setFoto(r);
    } catch (e) {
      Alert.alert('Não foi possível enviar a foto', e?.message || 'Tente novamente.');
    } finally {
      setEnviandoFoto(false);
    }
  };

  const enviar = async () => {
    if (numero.trim().length < 4) { Alert.alert('Falta pouco', 'Informe o número do pedido, como aparece no app ou no e-mail da loja.'); return; }
    if (!(valorCentavos >= 100)) { Alert.alert('Falta pouco', 'Informe o valor que você pagou por este item.'); return; }
    if (!foto) { Alert.alert('Falta pouco', 'Envie uma foto ou print do comprovante da compra.'); return; }
    setEnviando(true);
    try {
      await httpsCallable(functions, 'enviarPedidoCashbackAfiliado')({
        itemId: item.id, numeroPedido: numero.trim(), valor: valorCentavos / 100,
        comprovanteCaminho: foto.caminho, comprovanteUrl: foto.url,
      });
      onEnviado?.();
    } catch (e) {
      Alert.alert('Não foi possível enviar', e?.message || 'Tente novamente em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={!!item} animationType="slide" transparent onRequestClose={onFechar}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.veu}>
          <View style={s.folha}>
            <View style={s.cabecalho}>
              <Text style={s.titulo}>Pedir meu cashback</Text>
              <TouchableOpacity onPress={onFechar} style={s.fechar} accessibilityLabel="Fechar">
                <Ionicons name="close" size={20} color={colors.titulo} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.item} numberOfLines={2}>{item?.titulo}</Text>
              <Text style={s.explica}>
                Conte pra gente sobre a sua compra na {loja}. A equipe confere e, quando aprovar, o crédito entra no seu cashback para usar no app.
              </Text>

              <Text style={s.rotulo}>Número do pedido</Text>
              <TextInput style={s.campo} value={numero} onChangeText={setNumero} autoCapitalize="characters" placeholder="Ex.: 701-1234567-1234567" placeholderTextColor={colors.tl} maxLength={60} />
              <Text style={s.dica}>Aparece em “Meus pedidos” na loja ou no e-mail de confirmação.</Text>

              <Text style={s.rotulo}>Valor pago por este item (R$)</Text>
              <TextInput style={s.campo} value={valor} onChangeText={v => setValor(v.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" placeholder="Ex.: 22,90" placeholderTextColor={colors.tl} />

              <Text style={s.rotulo}>Foto ou print do comprovante</Text>
              <TouchableOpacity style={[s.foto, enviandoFoto && { opacity: 0.6 }]} onPress={escolherFoto} disabled={enviandoFoto} accessibilityLabel="Escolher foto do comprovante">
                {foto
                  ? <Image source={{ uri: foto.url }} style={s.fotoImg} resizeMode="cover" />
                  : enviandoFoto
                    ? <ActivityIndicator color={colors.lilasIcone} />
                    : (
                      <>
                        <Ionicons name="camera-outline" size={26} color={colors.lilasIcone} />
                        <Text style={s.fotoTxt}>Escolher imagem</Text>
                      </>
                    )}
              </TouchableOpacity>
              {!!foto && <TouchableOpacity onPress={escolherFoto} hitSlop={8}><Text style={s.trocar}>Trocar imagem</Text></TouchableOpacity>}
              <Text style={s.dica}>Mostre o produto, o número do pedido e o valor. Só você e a equipe da Atravessia veem esta imagem.</Text>

              {previsto > 0 && (
                <View style={s.previsto}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.sageFg} />
                  <Text style={s.previstoTxt}>Depois da análise, você recebe <Text style={s.previstoValor}>{brlCentavos(previsto)}</Text> em créditos.</Text>
                </View>
              )}

              <TouchableOpacity style={[s.botao, enviando && { opacity: 0.6 }]} onPress={enviar} disabled={enviando} accessibilityRole="button">
                <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} />
                {enviando ? <ActivityIndicator color="white" /> : <Text style={s.botaoTxt}>Enviar para análise</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = criarEstilos(() => ({
  veu: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30,20,50,0.45)' },
  folha: {
    backgroundColor: colors.cardSolido || colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.lg, paddingBottom: 36, maxHeight: '92%', width: '100%', maxWidth: 640, alignSelf: 'center',
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  titulo: { fontFamily: fonts.serif, fontSize: 26, color: colors.titulo },
  fechar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.vidroTenue },
  item: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.lilasTexto },
  explica: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.texto2, marginTop: 6 },
  rotulo: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.titulo, marginTop: spacing.md, marginBottom: 6 },
  campo: {
    minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.bordaLuz, backgroundColor: colors.vidro,
    paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 15, color: colors.titulo,
  },
  dica: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.texto2, marginTop: 6 },
  foto: {
    height: 150, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lav4,
    backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden',
  },
  fotoImg: { width: '100%', height: '100%' },
  fotoTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  trocar: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lilasTexto, marginTop: 6 },
  previsto: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md, padding: 14,
    borderRadius: 16, backgroundColor: colors.vidroTenue, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  previstoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.texto2 },
  previstoValor: { fontFamily: fonts.bodyBold, color: colors.sageFg },
  botao: {
    marginTop: spacing.lg, minHeight: 50, borderRadius: radius.full, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: 'white' },
}));
