import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StatusBar, Keyboard, Platform, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { emocoes } from '../../data';
import { confirmar } from '../../utils/confirm';
import { vibrarLeve } from '../../utils/vibrar';
import {
  responder, mensagemInicial, RESPOSTAS_RAPIDAS, AVISO_IA, EXERCICIOS,
} from '../../ia/conversa';

// Conversa com a AtravessIA. A inteligência é própria (roda no aparelho, sem
// custo por uso) e a conversa fica guardada só neste celular.
const chave = (uid) => `@atravessia/ia/conversa/${uid || 'local'}`;
const MAX_MENSAGENS = 80;
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export default function ConversaIAScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { usuario, checkins } = useApp();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const nome = usuario?.apelido || (usuario?.nome !== 'Você' ? usuario?.nome : '');

  const checkinHoje = checkins.find(c => c.data === hoje());
  const emocaoHoje = checkinHoje?.emocao;
  const rotuloEmocaoHoje = emocoes.find(e => e.id === emocaoHoje)?.label;

  const [mensagens, setMensagens] = useState(null);
  const [texto, setTexto] = useState('');
  const [usados, setUsados] = useState([]);
  const [ultimaEmocao, setUltimaEmocao] = useState(emocaoHoje || null);
  const [jaDisseQuem, setJaDisseQuem] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [alturaTeclado, setAlturaTeclado] = useState(0);
  const rolagem = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(chave(uid))
      .then(bruto => {
        const salvas = bruto ? JSON.parse(bruto) : [];
        if (Array.isArray(salvas) && salvas.length) setMensagens(salvas);
        else setMensagens([{ id: 'ini', de: 'ia', ...mensagemInicial({ nome, emocaoHoje, rotuloEmocaoHoje }) }]);
      })
      .catch(() => setMensagens([{ id: 'ini', de: 'ia', ...mensagemInicial({ nome, emocaoHoje, rotuloEmocaoHoje }) }]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    if (!mensagens) return;
    AsyncStorage.setItem(chave(uid), JSON.stringify(mensagens.slice(-MAX_MENSAGENS))).catch(() => {});
    setTimeout(() => rolagem.current?.scrollToEnd({ animated: true }), 80);
  }, [mensagens, uid]);

  // Teclado no Android (tela de ponta a ponta): espaço extra embaixo.
  useEffect(() => {
    const ev1 = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const ev2 = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(ev1, (e) => {
      setAlturaTeclado(e?.endCoordinates?.height || 0);
      setTimeout(() => rolagem.current?.scrollToEnd({ animated: true }), 60);
    });
    const b = Keyboard.addListener(ev2, () => setAlturaTeclado(0));
    return () => { a.remove(); b.remove(); };
  }, []);

  const enviar = (conteudo) => {
    const msg = String(conteudo ?? texto).trim();
    if (!msg || digitando) return;
    vibrarLeve();
    setTexto('');
    const minha = { id: `u${Date.now()}`, de: 'eu', texto: msg };
    setMensagens(m => [...(m || []), minha]);
    setDigitando(true);
    // Tempo de "escrevendo..." proporcional ao tamanho da resposta, como numa
    // conversa de verdade. Em situação de risco, responde logo.
    const r = responder(msg, { nome, usados, ultimaEmocao, jaDisseQuem });
    const pausa = r.risco ? 700 : Math.min(3200, Math.max(1300, 700 + r.texto.length * 14));
    setTimeout(() => {
      setUsados(r.usados);
      if (r.jaDisseQuem) setJaDisseQuem(true);
      if (r.emocao) setUltimaEmocao(r.emocao);
      setMensagens(m => [...(m || []), { id: `i${Date.now()}`, de: 'ia', texto: r.texto, sugestoes: r.sugestoes, risco: r.risco }]);
      setDigitando(false);
    }, pausa);
  };

  const tocarSugestao = (s) => {
    vibrarLeve();
    if (s.link) { Linking.openURL(s.link).catch(() => {}); return; }
    if (s.interno && EXERCICIOS[s.interno]) {
      setMensagens(m => [...(m || []), { id: `x${Date.now()}`, de: 'ia', texto: EXERCICIOS[s.interno] }]);
      return;
    }
    if (s.tela) navigation.navigate(s.tela);
  };

  const apagar = () => confirmar(
    'Apagar conversa',
    'Esta conversa será apagada e não poderá ser recuperada. Deseja continuar?',
    () => {
      AsyncStorage.removeItem(chave(uid)).catch(() => {});
      setUsados([]);
      setMensagens([{ id: `ini${Date.now()}`, de: 'ia', ...mensagemInicial({ nome, emocaoHoje, rotuloEmocaoHoje }) }]);
    },
    'Apagar',
  );

  const soInicio = useMemo(() => (mensagens || []).filter(m => m.de === 'eu').length === 0, [mensagens]);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconeBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <View style={s.topCentro}>
          <View style={s.avatar}><Ionicons name="sparkles" size={15} color="white" /></View>
          <View>
            <Text style={s.topTitulo}>AtravessIA</Text>
            <Text style={s.topSub}>{digitando ? 'escrevendo...' : 'acolhimento'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={apagar} style={s.iconeBtn} accessibilityLabel="Apagar conversa">
          <Ionicons name="trash-outline" size={20} color={colors.tm} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={rolagem}
        style={{ flex: 1 }}
        contentContainerStyle={s.lista}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.aviso}>
          <Ionicons name="information-circle-outline" size={15} color={colors.lav5} />
          <Text style={s.avisoTxt}>{AVISO_IA} Em situação de risco, ligue para o CVV: 188.</Text>
        </View>

        {(mensagens || []).map(m => (
          <View key={m.id} style={[s.linha, m.de === 'eu' ? s.linhaEu : s.linhaIa]}>
            <View style={[s.balao, m.de === 'eu' ? s.balaoEu : s.balaoIa, m.risco && s.balaoRisco]}>
              <Text style={[s.balaoTxt, m.de === 'eu' && s.balaoTxtEu]} selectable>{m.texto}</Text>
            </View>
            {m.de === 'ia' && !!m.sugestoes?.length && (
              <View style={s.sugestoes}>
                {m.sugestoes.map(sg => (
                  <TouchableOpacity key={sg.id} style={[s.sugestao, sg.link && s.sugestaoUrgente]} onPress={() => tocarSugestao(sg)} activeOpacity={0.85}>
                    <Ionicons name={sg.icone} size={15} color={sg.link ? 'white' : colors.lav5} />
                    <Text style={[s.sugestaoTxt, sg.link && { color: 'white' }]}>{sg.rotulo}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}

        {digitando && (
          <View style={[s.linha, s.linhaIa]}>
            <View style={[s.balao, s.balaoIa, s.digitando]}>
              <View style={s.ponto} /><View style={s.ponto} /><View style={s.ponto} />
            </View>
          </View>
        )}

        {soInicio && (
          <View style={s.rapidas}>
            {RESPOSTAS_RAPIDAS.map(r => (
              <TouchableOpacity key={r} style={s.rapida} onPress={() => enviar(r)} activeOpacity={0.85}>
                <Text style={s.rapidaTxt}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[s.barra, { paddingBottom: Math.max(insets.bottom, 10) + (Platform.OS === 'android' ? alturaTeclado : 0) }]}>
        <TextInput
          style={s.entrada}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escreva como você está..."
          placeholderTextColor={colors.tl}
          multiline
          maxLength={800}
        />
        <TouchableOpacity
          style={[s.enviar, (!texto.trim() || digitando) && { opacity: 0.5 }]}
          onPress={() => enviar()}
          disabled={!texto.trim() || digitando}
          accessibilityLabel="Enviar"
        >
          <Ionicons name="arrow-up" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  iconeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topCentro: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.botaoForte, alignItems: 'center', justifyContent: 'center' },
  topTitulo: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td },
  topSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tm },
  lista: { padding: spacing.md, paddingBottom: spacing.lg, gap: 10, width: '100%', maxWidth: 720, alignSelf: 'center' },
  aviso: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.lav1,
    borderRadius: radius.md, padding: 10, marginBottom: 4,
  },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.tm, lineHeight: 17 },
  linha: { maxWidth: '88%', gap: 6 },
  linhaEu: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  linhaIa: { alignSelf: 'flex-start' },
  balao: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  balaoIa: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 6 },
  balaoEu: { backgroundColor: colors.botaoForte, borderTopRightRadius: 6 },
  balaoRisco: { borderColor: colors.roseTexto, borderWidth: 1.5 },
  balaoTxt: { fontFamily: fonts.body, fontSize: 14.5, color: colors.td, lineHeight: 21 },
  balaoTxtEu: { color: 'white' },
  sugestoes: { gap: 6 },
  sugestao: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: colors.lav1, borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 14,
  },
  sugestaoUrgente: { backgroundColor: colors.roseTexto },
  sugestaoTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav6 },
  digitando: { flexDirection: 'row', gap: 5, paddingVertical: 14 },
  ponto: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lav3 },
  rapidas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  rapida: {
    borderWidth: 1, borderColor: colors.lav3, borderRadius: radius.full,
    paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.card,
  },
  rapidaTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.lav6 },
  barra: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: spacing.md, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card,
  },
  entrada: {
    flex: 1, minHeight: 44, maxHeight: 130, borderRadius: 22, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
    fontFamily: fonts.body, fontSize: 14.5, color: colors.td,
  },
  enviar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.botaoForte,
    alignItems: 'center', justifyContent: 'center',
  },
}));
