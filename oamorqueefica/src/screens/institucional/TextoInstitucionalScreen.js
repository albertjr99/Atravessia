import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { Profundo } from '../../components/Efeitos';
import Recolhivel from '../../components/Recolhivel';
import { abrirLink } from '../../utils/abrirLink';
import { SOBRE_PADRAO, PARCEIRO_PADRAO } from './textosPadrao';

const logo = require('../../../assets/images/travessia_logo.png');

// Textos longos podem ser divididos em seções pelo painel: cada linha que
// começa com "## " vira o título de um cartão recolhível (fechado por padrão).
// O que vem antes do primeiro "## " fica sempre à vista. Sem "## ", nada muda.
function dividirSecoes(texto) {
  const linhas = String(texto || '').split('\n');
  const intro = [];
  const secoes = [];
  linhas.forEach((linha) => {
    const m = linha.match(/^\s*##\s+(.+)$/);
    if (m) secoes.push({ titulo: m[1].trim(), corpo: [] });
    else if (secoes.length) secoes[secoes.length - 1].corpo.push(linha);
    else intro.push(linha);
  });
  return {
    intro: intro.join('\n').trim(),
    secoes: secoes.map(sc => ({ titulo: sc.titulo, corpo: sc.corpo.join('\n').trim() })),
  };
}

// Tela de texto editado pela administração: "Sobre o app" ou "Seja nosso parceiro".
// `tipo` vem da rota ('sobre' | 'parceiro').
function TextoInstitucional({ navigation, tipo }) {
  const insets = useSafeAreaInsets();
  const [cfg, setCfg] = useState(null);
  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'institucional'),
    (snap) => setCfg(snap.exists() ? snap.data() : {}),
    () => setCfg({})), []);

  const parceiro = tipo === 'parceiro';
  const titulo = parceiro ? 'Seja nosso parceiro' : 'Sobre o app';
  const texto = (parceiro ? cfg?.parceiroTexto : cfg?.sobreTexto) || (parceiro ? PARCEIRO_PADRAO : SOBRE_PADRAO);
  const link = parceiro ? (cfg?.parceiroLink || '').trim() : '';
  const { intro, secoes } = dividirSecoes(texto);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView contentContainerStyle={[s.conteudo, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}>
        <View style={s.topo}>
          <TouchableOpacity style={s.voltar} onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
            <Ionicons name="chevron-back" size={22} color={colors.lilasTexto} />
          </TouchableOpacity>
          <Text style={s.tituloTela} numberOfLines={1}>{titulo}</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={s.cartao}>
          <View style={s.marca}>
            <Image source={logo} style={s.logo} />
            <Text style={s.marcaNome}>Atravessia</Text>
          </View>
          {!!intro && <Text style={s.texto}>{intro}</Text>}
          {secoes.length > 0 && (
            <View style={[s.secoes, !intro && { marginTop: 0 }]}>
              {secoes.map((sc, i) => (
                <Recolhivel key={`${i}-${sc.titulo}`} titulo={sc.titulo} estilo={s.secao}>
                  <Text style={s.texto}>{sc.corpo}</Text>
                </Recolhivel>
              ))}
            </View>
          )}
          {parceiro && !!link && (
            <Profundo estilo={s.botao} base={colors.botaoBase} sombra={s.botaoSombra} onPress={() => abrirLink(link)} accessibilityLabel="Quero ser parceiro">
              <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.botaoGradiente} />
              <Ionicons name="document-text-outline" size={18} color="white" />
              <Text style={s.botaoTxt}>Quero ser parceiro</Text>
            </Profundo>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function SobreScreen(props) { return <TextoInstitucional {...props} tipo="sobre" />; }
export function SejaParceiroScreen(props) { return <TextoInstitucional {...props} tipo="parceiro" />; }

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  conteudo: { paddingHorizontal: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8 },
  voltar: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  tituloTela: { flex: 1, textAlign: 'center', fontFamily: 'Titulo', fontSize: 30, color: colors.titulo },
  cartao: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz, borderRadius: 28, padding: 22,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 3,
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  logo: { width: 44, height: 44, borderRadius: 13 },
  marcaNome: { fontFamily: 'Marca', fontSize: 30, color: colors.escuro ? colors.titulo : '#45358A' },
  texto: { fontFamily: 'Figtree_400Regular', fontSize: 16, lineHeight: 25, color: colors.titulo },
  secoes: { marginTop: 16 },
  // Seções dentro do cartão: sem sombra própria, só a borda suave.
  secao: { backgroundColor: colors.vidroTenue, shadowOpacity: 0, elevation: 0, marginBottom: 10 },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.botao },
  botaoGradiente: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  botaoSombra: { shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 5, marginTop: 20 },
  botaoTxt: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: 'white' },
}));
