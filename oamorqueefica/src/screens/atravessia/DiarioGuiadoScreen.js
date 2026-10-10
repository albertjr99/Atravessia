import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StatusBar, Keyboard, Platform, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { emocoes } from '../../data';
import { confirmar } from '../../utils/confirm';
import { vibrarSucesso } from '../../utils/vibrar';
import { perguntaDoDia, outrasPerguntas, devolutiva } from '../../ia/diario';

const hojeISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataBonita = (iso) => {
  const [a, m, d] = String(iso || '').split('-').map(Number);
  return a ? `${d} de ${MESES[m - 1]} de ${a}` : '';
};

// Diário guiado: uma pergunta por dia, escolhida pela emoção do check-in.
// As entradas ficam em usuarios/{uid}/diario e só a própria pessoa lê.
export default function DiarioGuiadoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { checkins } = useApp();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const hoje = hojeISO();
  const emocaoHoje = checkins.find(c => c.data === hoje)?.emocao || null;
  const rotuloEmocao = emocoes.find(e => e.id === emocaoHoje)?.label;

  const [entradas, setEntradas] = useState(null);
  const [indice, setIndice] = useState(-1); // -1 = pergunta do dia
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [retorno, setRetorno] = useState(null);
  const [alturaTeclado, setAlturaTeclado] = useState(0);
  const rolagem = useRef(null);

  useEffect(() => {
    if (!uid) { setEntradas([]); return undefined; }
    return onSnapshot(collection(db, 'usuarios', uid, 'diario'), (snap) => {
      setEntradas(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0)));
    }, (e) => { console.warn('[Diário] leitura:', e?.message); setEntradas([]); });
  }, [uid]);

  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setAlturaTeclado(e?.endCoordinates?.height || 0));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setAlturaTeclado(0));
    return () => { a.remove(); b.remove(); };
  }, []);

  const lista = useMemo(() => outrasPerguntas(emocaoHoje), [emocaoHoje]);
  const pergunta = indice < 0 ? perguntaDoDia(emocaoHoje, hoje) : lista[indice % lista.length];

  const outra = () => setIndice(i => {
    let n = i + 1;
    if (lista[n % lista.length] === perguntaDoDia(emocaoHoje, hoje)) n += 1;
    return n;
  });

  const salvar = async () => {
    const t = texto.trim();
    if (!t || !uid) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, 'usuarios', uid, 'diario'), {
        data: hoje, emocao: emocaoHoje, pergunta, texto: t, criadoEm: serverTimestamp(),
      });
      vibrarSucesso();
      setRetorno(devolutiva(t));
      setTexto('');
      Keyboard.dismiss();
      setTimeout(() => rolagem.current?.scrollTo({ y: 0, animated: true }), 100);
    } catch (e) {
      setRetorno({ risco: false, texto: `Não foi possível salvar agora (${e?.message || 'tente de novo'}). Seu texto continua aqui.` });
      setTexto(t);
    } finally {
      setSalvando(false);
    }
  };

  const apagar = (item) => confirmar(
    'Apagar esta página?',
    'Ela será removida do seu diário.',
    () => deleteDoc(doc(db, 'usuarios', uid, 'diario', item.id)).catch(e => console.warn('[Diário] apagar:', e?.message)),
    'Apagar',
  );

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconeBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Diário guiado</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        ref={rolagem}
        contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl + alturaTeclado }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.coluna}>
          {retorno && (
            <View style={[s.retorno, retorno.risco && s.retornoRisco]}>
              <View style={s.retornoTopo}>
                <View style={s.avatar}><Ionicons name="sparkles" size={13} color="white" /></View>
                <Text style={s.retornoTit}>AtravessIA</Text>
                <TouchableOpacity onPress={() => setRetorno(null)} hitSlop={10} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="close" size={18} color={colors.tl} />
                </TouchableOpacity>
              </View>
              <Text style={s.retornoTxt}>{retorno.texto}</Text>
              {retorno.risco && (
                <TouchableOpacity style={s.cvv} onPress={() => Linking.openURL('tel:188').catch(() => {})}>
                  <Ionicons name="call-outline" size={16} color="white" />
                  <Text style={s.cvvTxt}>Ligar para o CVV (188)</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={s.cartao}>
            <Text style={s.rotulo}>{rotuloEmocao ? `Para hoje · você marcou "${rotuloEmocao.toLowerCase()}"` : 'Pergunta de hoje'}</Text>
            <Text style={s.pergunta}>{pergunta}</Text>
            <TouchableOpacity onPress={outra} style={s.outra} hitSlop={8}>
              <Ionicons name="shuffle" size={14} color={colors.lav5} />
              <Text style={s.outraTxt}>Outra pergunta</Text>
            </TouchableOpacity>
            <TextInput
              style={s.entrada}
              value={texto}
              onChangeText={setTexto}
              placeholder="Escreva no seu ritmo. Só você vê."
              placeholderTextColor={colors.tl}
              multiline
              textAlignVertical="top"
              maxLength={4000}
            />
            <TouchableOpacity style={[s.salvar, (!texto.trim() || salvando) && { opacity: 0.55 }]} onPress={salvar} disabled={!texto.trim() || salvando}>
              {salvando ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="bookmark-outline" size={16} color="white" />}
              <Text style={s.salvarTxt}>{salvando ? 'Guardando...' : 'Guardar no diário'}</Text>
            </TouchableOpacity>
            <Text style={s.privado}>
              <Ionicons name="lock-closed-outline" size={11} color={colors.tl} /> Suas páginas são privadas.
            </Text>
          </View>

          <Text style={s.secTit}>Suas páginas</Text>
          {entradas === null ? (
            <ActivityIndicator color={colors.lav4} style={{ marginTop: spacing.lg }} />
          ) : entradas.length === 0 ? (
            <Text style={s.vazio}>Quando você guardar sua primeira página, ela aparece aqui.</Text>
          ) : entradas.map(item => (
            <View key={item.id} style={s.pagina}>
              <View style={s.paginaTopo}>
                <Text style={s.paginaData}>{dataBonita(item.data)}</Text>
                <TouchableOpacity onPress={() => apagar(item)} hitSlop={10} accessibilityLabel="Apagar página">
                  <Ionicons name="trash-outline" size={16} color={colors.tl} />
                </TouchableOpacity>
              </View>
              {!!item.pergunta && <Text style={s.paginaPergunta}>{item.pergunta}</Text>}
              <Text style={s.paginaTexto} selectable>{item.texto}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingBottom: 6 },
  iconeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  coluna: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: spacing.md },
  retorno: { backgroundColor: colors.lav1, borderRadius: radius.xl, padding: spacing.md, gap: 8 },
  retornoRisco: { borderWidth: 1.5, borderColor: colors.roseTexto },
  retornoTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.botaoForte, alignItems: 'center', justifyContent: 'center' },
  retornoTit: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav6 },
  retornoTxt: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.td },
  cvv: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: colors.roseTexto, borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 14,
  },
  cvvTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
  cartao: {
    backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: 10,
  },
  rotulo: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.lav5, letterSpacing: 0.4, textTransform: 'uppercase' },
  pergunta: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 28, color: colors.lav6 },
  outra: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  outraTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.lav5 },
  entrada: {
    minHeight: 150, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg, padding: 14, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.td,
  },
  salvar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.botaoForte, borderRadius: radius.full, paddingVertical: 13,
  },
  salvarTxt: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: 'white' },
  privado: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tl, textAlign: 'center' },
  secTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginTop: spacing.sm },
  vazio: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, textAlign: 'center', paddingVertical: spacing.lg },
  pagina: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: 6,
  },
  paginaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paginaData: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.lav5 },
  paginaPergunta: { fontFamily: fonts.quote, fontSize: 15, color: colors.tm },
  paginaTexto: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, color: colors.td },
}));
