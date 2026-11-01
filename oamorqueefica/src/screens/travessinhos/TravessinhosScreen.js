import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StatusBar, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import Travessinho, { PERSONAGENS, IMAGEM_GRUPO } from '../../components/Travessinho';
import { useVideoApresentacao, BotaoApresentacao, ModalVideoApresentacao } from '../../components/VideoApresentacao';

// O que cada um faz no app, com o atalho para a tela correspondente.
const ONDE = {
  nanda: [
    { icone: 'heart-outline', rotulo: 'Check-in do dia', tela: 'CheckIn' },
    { icone: 'book-outline', rotulo: 'Diário guiado', tela: 'DiarioGuiado' },
    { icone: 'headset-outline', rotulo: 'Áudios de acolhimento', tela: 'Audios' },
    { icone: 'mail-outline', rotulo: 'Carta do mês', tela: 'CartaMes' },
  ],
  brian: [
    { icone: 'bar-chart-outline', rotulo: 'Relatórios e PDF', tela: 'Relatorios' },
    { icone: 'school-outline', rotulo: 'Cursos', tela: 'Cursos' },
    { icone: 'notifications-outline', rotulo: 'Notificações', tela: 'Notificacoes' },
    { icone: 'time-outline', rotulo: 'Lembrete do check-in', tela: 'Lembrete' },
  ],
  maju: [
    { icone: 'gift-outline', rotulo: 'Parcerias e cupons', tela: 'Parcerias' },
    { icone: 'wallet-outline', rotulo: 'Cashback', tela: 'Cashback' },
    { icone: 'diamond-outline', rotulo: 'Planos', tela: 'Planos' },
  ],
};

const FALAS = {
  nanda: 'Oi! Eu sou a Nanda. Estou aqui para lembrar que cada sentimento tem lugar. Vamos cuidar de você com calma?',
  brian: 'E aí! Eu sou o Brian. Se alguma coisa no app parecer confusa, pode contar comigo para explicar.',
  maju: 'Oi, oi! Eu sou a Maju. Adoro achar benefícios que deixam o dia a dia mais leve.',
};

export default function TravessinhosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const largura = Math.min(width - 32, 560);
  const { video } = useVideoApresentacao('travessinhos');
  const [verVideo, setVerVideo] = useState(false);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView contentContainerStyle={[s.conteudo, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={s.topo}>
          <TouchableOpacity style={s.voltar} onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
            <Ionicons name="chevron-back" size={22} color={colors.lilasTexto} />
          </TouchableOpacity>
          <Text style={s.tituloTela}>Os Travessinhos</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={[s.grupoMoldura, { width: largura, height: largura }]}>
          <Image source={IMAGEM_GRUPO} style={{ width: largura, height: largura }} resizeMode="cover"
            accessibilityLabel="Ilustração dos Travessinhos: Nanda, Brian e Maju acenando numa ponte de madeira" />
        </View>

        <View style={s.cartao}>
          <Text style={s.intro}>
            Oi! Somos os Travessinhos. A gente aparece de vez em quando pelo app para dar dicas,
            comemorar suas conquistas e fazer companhia na sua travessia.
          </Text>
          <Text style={s.inspiracao}>
            Somos inspirados nas pessoas que fazem a Atravessia: a Carla, o Albert e a Larissa. 💛💙💚
          </Text>
          {!!video && <BotaoApresentacao onPress={() => setVerVideo(true)} style={{ marginTop: 12 }} />}
        </View>

        {Object.entries(PERSONAGENS).map(([chave, p]) => (
          <View key={chave} style={[s.cartao, { borderTopColor: p.cor, borderTopWidth: 4 }]}>
            <View style={s.linha}>
              <View style={[s.corpoFundo, { backgroundColor: colors.escuro ? 'rgba(255,255,255,0.06)' : p.fundo }]}>
                <Image source={p.corpo} style={s.corpo} resizeMode="contain" accessibilityLabel={`${p.nome} de corpo inteiro`} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.nome, { color: colors.escuro ? p.cor : p.corForte }]}>{p.nome}</Text>
                <Text style={s.papel}>{p.papel}</Text>
                <Text style={s.descricao}>{p.descricao}</Text>
                <Text style={s.inspiradoEm}>{p.inspiracaoTexto}</Text>
              </View>
            </View>
            <Travessinho quem={chave} variante="mini" fala={FALAS[chave]} style={{ marginTop: 12 }} />
            <View style={s.atalhos}>
              {ONDE[chave].map(it => (
                <TouchableOpacity key={it.tela} style={[s.atalho, { borderColor: p.cor }]} onPress={() => navigation.navigate(it.tela)} activeOpacity={0.8}>
                  <Ionicons name={it.icone} size={14} color={colors.escuro ? p.cor : p.corForte} />
                  <Text style={s.atalhoTxt}>{it.rotulo}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={s.nota}>
          Prefere sem os Travessinhos? É só tocar no “x” das dicas: a gente entende e não aparece de novo naquela tela.
        </Text>
      </ScrollView>
      <ModalVideoApresentacao visivel={verVideo} onFechar={() => setVerVideo(false)} video={video} tituloPadrao="Conheça os Travessinhos" />
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  conteudo: { paddingHorizontal: 16, alignItems: 'center' },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, alignSelf: 'stretch' },
  voltar: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  tituloTela: { fontFamily: fonts.serif, fontSize: 26, color: colors.titulo },
  grupoMoldura: {
    borderRadius: 26, overflow: 'hidden', marginBottom: 14, borderWidth: 3, borderColor: colors.white,
  },
  cartao: {
    alignSelf: 'stretch',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz, borderRadius: 24,
    padding: 16, marginBottom: 14,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 3,
  },
  intro: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.td },
  inspiracao: { fontFamily: fonts.bodySemi, fontSize: 13.5, lineHeight: 20, color: colors.lilasTexto, marginTop: 10 },
  linha: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  corpoFundo: { width: 104, height: 150, borderRadius: 18, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  corpo: { width: 100, height: 142 },
  nome: { fontFamily: fonts.bodyBold, fontSize: 22 },
  papel: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.tl, marginBottom: 6 },
  descricao: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.tm },
  inspiradoEm: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.tl, marginTop: 6, fontStyle: 'italic' },
  atalhos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  atalho: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12,
    borderRadius: radius.full, borderWidth: 1, backgroundColor: colors.vidroTenue,
  },
  atalhoTxt: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.td },
  nota: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.tl, textAlign: 'center', maxWidth: 420, marginTop: 4 },
}));
