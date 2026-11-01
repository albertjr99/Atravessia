import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StatusBar, Keyboard, Platform, Linking, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import Recolhivel from '../../components/Recolhivel';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { DicaTravessinho, VazioTravessinho } from '../../components/Travessinho';
import { LinearGradient } from 'expo-linear-gradient';
import { Profundo } from '../../components/Efeitos';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { emocoes } from '../../data';
import { confirmar } from '../../utils/confirm';
import { vibrarSucesso } from '../../utils/vibrar';
import { perguntaDoDia, outrasPerguntas, devolutiva } from '../../ia/diario';

const hojeISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
// Limite de cada página do diário (contador discreto abaixo da caixa).
const LIMITE_TEXTO = 1000;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataBonita = (iso) => {
  const [a, m, d] = String(iso || '').split('-').map(Number);
  return a ? `${d} de ${MESES[m - 1]} de ${a}` : '';
};

// Botão principal: degradê lilás com "degrau" que afunda ao toque.
function BotaoLilas({ onPress, children, rotulo, externo, desativado }) {
  return (
    <Profundo
      externo={[externo, desativado && { opacity: 0.6 }]}
      estilo={s.btnFace}
      base={colors.botaoBase}
      sombra={s.btnHalo}
      onPress={desativado ? undefined : onPress}
      accessibilityLabel={rotulo}
    >
      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.btnGrad} />
      {children}
    </Profundo>
  );
}

// Diário guiado: uma pergunta por dia, escolhida pela emoção do check-in.
// As entradas ficam em usuarios/{uid}/diario e só a própria pessoa lê.
// Uma página por dia: a de hoje usa o id 'AAAA-MM-DD' (registros antigos,
// com id automático, continuam valendo: se já houver um de hoje, ele é
// atualizado em vez de criar outro).
export default function DiarioGuiadoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { checkins, temAcesso, podeUsarIA } = useApp();
  // Recurso ligado no painel, a partir do plano escolhido lá: sem acesso, vai para Planos.
  const semAcesso = !podeUsarIA('diarioGuiado');
  useEffect(() => { if (semAcesso) navigation.replace('Planos'); }, [semAcesso, navigation]);
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
  const [editando, setEditando] = useState(false);
  const rolagem = useRef(null);

  // Página de hoje: prefere o doc com id do dia; senão, a mais recente com data de hoje (legado).
  const entradaHoje = useMemo(() => {
    if (!entradas) return null;
    return entradas.find(e => e.id === hoje) || entradas.find(e => e.data === hoje) || null;
  }, [entradas, hoje]);
  const anteriores = useMemo(
    () => (entradas || []).filter(e => e.id !== entradaHoje?.id),
    [entradas, entradaHoje],
  );

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
  const perguntaSorteada = indice < 0 ? perguntaDoDia(emocaoHoje, hoje) : lista[indice % lista.length];
  // Ao editar a página de hoje, a pergunta continua a mesma que foi respondida.
  const pergunta = (editando && entradaHoje?.pergunta) || perguntaSorteada;

  const editarHoje = () => {
    setTexto(entradaHoje?.texto || '');
    setRetorno(null);
    setEditando(true);
  };
  const cancelarEdicao = () => { setEditando(false); setTexto(''); Keyboard.dismiss(); };

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
      if (entradaHoje) {
        // Já existe a página de hoje (nova ou antiga): atualiza a mesma.
        await updateDoc(doc(db, 'usuarios', uid, 'diario', entradaHoje.id), {
          pergunta, texto: t, emocao: entradaHoje.emocao ?? emocaoHoje, atualizadoEm: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'usuarios', uid, 'diario', hoje), {
          data: hoje, emocao: emocaoHoje, pergunta, texto: t, criadoEm: serverTimestamp(),
        }, { merge: true });
      }
      vibrarSucesso();
      setRetorno(devolutiva(t));
      setEditando(false);
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
    () => {
      if (item.id === entradaHoje?.id) { setEditando(false); setTexto(''); }
      deleteDoc(doc(db, 'usuarios', uid, 'diario', item.id)).catch(e => console.warn('[Diário] apagar:', e?.message));
    },
    'Apagar',
  );

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Diário guiado</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        ref={rolagem}
        contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl + alturaTeclado }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.coluna}>
          <DicaTravessinho
            chave="diario"
            quem="nanda"
            fala="Aqui não precisa escrever bonito. Uma frase já vale: o diário é um lugar seguro para colocar para fora o que pesa e o que alegra."
          />
          {retorno && (
            <View style={[s.retorno, retorno.risco && s.retornoRisco]}>
              <View style={s.retornoTopo}>
                <View style={s.avatar}><Ionicons name="sparkles" size={14} color={colors.lilasIcone} /></View>
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

          {entradas === null ? (
            <ActivityIndicator color={colors.lav4} style={{ marginTop: spacing.lg }} />
          ) : entradaHoje && !editando ? (
            // Já há página hoje: mostra para ler, com opção de editar.
            <View style={s.cartao}>
              <View style={s.paginaTopo}>
                <Text style={[s.rotulo, { flex: 1 }]}>Sua página de hoje · {dataBonita(hoje)}</Text>
                <TouchableOpacity onPress={() => apagar(entradaHoje)} hitSlop={10} accessibilityLabel="Apagar a página de hoje">
                  <Ionicons name="trash-outline" size={16} color={colors.tl} />
                </TouchableOpacity>
              </View>
              {!!entradaHoje.pergunta && <Text style={s.paginaPergunta}>{entradaHoje.pergunta}</Text>}
              <Text style={s.paginaTexto} selectable>{entradaHoje.texto}</Text>
              <TouchableOpacity onPress={editarHoje} style={s.btnVidro} accessibilityLabel="Editar a página de hoje">
                <Ionicons name="create-outline" size={18} color={colors.lilasTexto} />
                <Text style={s.btnVidroTxt}>Editar a página de hoje</Text>
              </TouchableOpacity>
              <Text style={s.privado}>
                Uma página por dia. Amanhã chega uma nova pergunta para você.
              </Text>
            </View>
          ) : (
            <View style={s.cartao}>
              <Text style={s.rotulo}>
                {editando ? 'Editando a página de hoje'
                  : rotuloEmocao ? `Para hoje · você marcou "${rotuloEmocao.toLowerCase()}"` : 'Pergunta de hoje'}
              </Text>
              <Text style={s.pergunta}>{pergunta}</Text>
              {!editando && (
                <TouchableOpacity onPress={outra} style={s.outra} hitSlop={8}>
                  <Ionicons name="shuffle" size={16} color={colors.lilasIcone} />
                  <Text style={s.outraTxt}>Outra pergunta</Text>
                </TouchableOpacity>
              )}
              <View>
                <TextInput
                  style={s.entrada}
                  value={texto}
                  onChangeText={setTexto}
                  placeholder="Escreva no seu ritmo. Só você vê."
                  placeholderTextColor={colors.tl}
                  multiline
                  scrollEnabled
                  textAlignVertical="top"
                  maxLength={LIMITE_TEXTO}
                />
                <Text style={s.contador} accessibilityLabel={`${texto.length} de ${LIMITE_TEXTO} caracteres`}>
                  {texto.length}/{LIMITE_TEXTO}
                </Text>
              </View>
              <BotaoLilas onPress={salvar} desativado={!texto.trim() || salvando} rotulo={editando ? 'Salvar alterações' : 'Guardar no diário'}>
                {salvando ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="bookmark-outline" size={18} color="white" />}
                <Text style={s.btnTxt}>{salvando ? 'Guardando...' : editando ? 'Salvar alterações' : 'Guardar no diário'}</Text>
              </BotaoLilas>
              {editando && (
                <TouchableOpacity onPress={cancelarEdicao} style={s.outra} hitSlop={8}>
                  <Text style={s.outraTxt}>Cancelar edição</Text>
                </TouchableOpacity>
              )}
              <Text style={s.privado}>
                <Ionicons name="lock-closed-outline" size={12} color={colors.tl} /> Suas páginas são privadas.
              </Text>
            </View>
          )}

          <Text style={s.secTit}>Páginas anteriores</Text>
          {entradas === null ? null : anteriores.length === 0 ? (
            <VazioTravessinho quem="nanda" fala="As páginas dos outros dias aparecem aqui, guardadinhas e só para você." style={{ paddingVertical: spacing.md }} />
          ) : anteriores.map(item => (
            <Recolhivel
              key={item.id}
              titulo={dataBonita(item.data) || 'Página do diário'}
              subtitulo={item.pergunta}
              icone="book-outline"
              estilo={{ marginBottom: 0 }}
              direita={(
                <TouchableOpacity onPress={() => apagar(item)} hitSlop={10} accessibilityLabel="Apagar página">
                  <Ionicons name="trash-outline" size={16} color={colors.tl} />
                </TouchableOpacity>
              )}
            >
              <Text style={s.paginaTexto} selectable>{item.texto}</Text>
            </Recolhivel>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 1,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 28, color: colors.titulo },
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 22, overflow: 'hidden' },
  btnGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.45 : 0.32, shadowRadius: 16, elevation: 5 },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 16, color: 'white' },
  btnVidro: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingHorizontal: 20,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro,
  },
  btnVidroTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  coluna: { width: '100%', gap: spacing.md },
  retorno: { backgroundColor: colors.lavVeu, borderRadius: 24, padding: spacing.lg, gap: 10, borderWidth: 1, borderColor: colors.bordaLuz },
  retornoRisco: { borderWidth: 1.5, borderColor: colors.roseTexto },
  retornoTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  retornoTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  retornoTxt: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25, color: colors.titulo },
  cvv: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: colors.roseTexto, borderRadius: radius.full, minHeight: 44, paddingHorizontal: 16,
  },
  cvvTxt: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.escuro ? colors.bg : 'white' },
  cartao: {
    backgroundColor: colors.card, borderRadius: 26, borderWidth: 1, borderColor: colors.bordaLuz,
    padding: spacing.lg, gap: 12,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  rotulo: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.lilasTexto, letterSpacing: 1, textTransform: 'uppercase' },
  pergunta: { fontFamily: fonts.serif, fontSize: 25, lineHeight: 33, color: colors.titulo },
  outra: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36 },
  outraTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lilasTexto },
  entrada: {
    minHeight: 170, maxHeight: 280, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.cardSolido, padding: 16, fontFamily: fonts.body, fontSize: 16, lineHeight: 25, color: colors.titulo,
  },
  contador: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, textAlign: 'right', marginTop: 4, marginRight: 4 },
  privado: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tl, textAlign: 'center' },
  secTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, marginTop: spacing.sm, marginLeft: 4 },
  vazio: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', paddingVertical: spacing.lg },
  pagina: {
    backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz,
    padding: spacing.lg, gap: 8,
  },
  paginaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paginaData: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.lilasTexto },
  paginaPergunta: { fontFamily: fonts.quote, fontSize: 19, lineHeight: 26, color: colors.texto2 },
  paginaTexto: { fontFamily: fonts.body, fontSize: 16, lineHeight: 26, color: colors.titulo },
}));
