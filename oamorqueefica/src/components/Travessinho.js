import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { colors, criarEstilos } from '../theme';
import { Profundo } from './Efeitos';

// Os Travessinhos: Nanda, Brian e Maju, a área de conteúdo infantil do app
// (vídeos, PDFs, histórias em quadrinhos e áudios para os pequenos). As
// carinhas aparecem SÓ no card do Início e na própria área (TravessinhosScreen).
//
// Coleção travessinhosMateriais/{id}:
//   tipo: 'video' | 'pdf' | 'quadrinho' | 'audio'
//   titulo, descricao, capaUrl, capaPath
//   youtubeId (vídeo do YouTube, inclusive não listado) ou arquivoUrl/arquivoPath
//   (vídeo, PDF ou áudio enviado ao Storage em travessinhos/)
//   paginas: [{ url, path }] (quadrinhos, em ordem)
//   faixaEtaria, personagem ('nanda'|'brian'|'maju'|'todos'), ordem, destaque,
//   publicado, data ('AAAA-MM-DD'), criadoEm, atualizadoEm

export const PERSONAGENS = {
  nanda: { nome: 'Nanda', avatar: require('../../assets/images/travessinhos/nanda.png'), cor: '#E0A800', fundo: '#FFF6D6' },
  brian: { nome: 'Brian', avatar: require('../../assets/images/travessinhos/brian.png'), cor: '#2F6FD0', fundo: '#E3EDFC' },
  maju: { nome: 'Maju', avatar: require('../../assets/images/travessinhos/maju.png'), cor: '#3E9B4F', fundo: '#E3F3E2' },
};

export const IMAGEM_GRUPO = require('../../assets/images/travessinhos/grupo.jpg');

export const TIPOS_MATERIAL = {
  video: { rotulo: 'Vídeo', icone: 'play-circle-outline' },
  pdf: { rotulo: 'PDF', icone: 'document-text-outline' },
  quadrinho: { rotulo: 'Quadrinhos', icone: 'images-outline' },
  audio: { rotulo: 'Áudio', icone: 'headset-outline' },
};

export const OPCOES_PERSONAGEM = [
  { id: 'todos', label: 'Todos' },
  { id: 'nanda', label: 'Nanda' },
  { id: 'brian', label: 'Brian' },
  { id: 'maju', label: 'Maju' },
];

// Aceita youtu.be, watch?v=, shorts/, embed/, live/ e o próprio id (11 caracteres).
export function extrairYoutubeId(texto) {
  const t = String(texto || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  const m = t.match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live|v)\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

export function capaMaterial(m) {
  if (m?.capaUrl) return m.capaUrl;
  if (m?.youtubeId) return `https://i.ytimg.com/vi/${m.youtubeId}/hqdefault.jpg`;
  if (m?.tipo === 'quadrinho' && m.paginas?.[0]?.url) return m.paginas[0].url;
  return null;
}

const msData = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : v?.seconds ? v.seconds * 1000 : 0);

// Destaques primeiro, depois a ordem definida no painel e, por fim, os mais novos.
export function ordenarMateriais(lista) {
  return [...lista].sort((a, b) =>
    (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0)
    || (Number(a.ordem) || 0) - (Number(b.ordem) || 0)
    || String(b.data || '').localeCompare(String(a.data || ''))
    || msData(b.criadoEm) - msData(a.criadoEm));
}

// Materiais publicados (a regra só libera os publicados para a usuária).
// undefined = carregando.
export function useMateriaisTravessinhos() {
  const [lista, setLista] = useState(undefined);
  useEffect(() => onSnapshot(
    query(collection(db, 'travessinhosMateriais'), where('publicado', '==', true)),
    (snap) => setLista(ordenarMateriais(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    (e) => { console.warn('[Travessinhos]', e?.message); setLista([]); },
  ), []);
  return lista;
}

// As três carinhas lado a lado, levemente sobrepostas.
export function CarinhasTravessinhos({ tamanho = 44, style }) {
  return (
    <View style={[s.carinhas, style]}>
      {Object.entries(PERSONAGENS).map(([chave, p], i) => (
        <View key={chave} style={[s.carinha, {
          width: tamanho, height: tamanho, borderRadius: tamanho / 2, marginLeft: i ? -tamanho * 0.22 : 0,
          backgroundColor: p.fundo, borderColor: colors.escuro ? 'rgba(255,255,255,0.35)' : '#FFFFFF', zIndex: 3 - i,
        }]}>
          <Image source={p.avatar} style={{ width: tamanho - 4, height: tamanho - 4, borderRadius: (tamanho - 4) / 2 }}
            accessibilityLabel={p.nome} />
        </View>
      ))}
    </View>
  );
}

// Card do Início, no estilo dos cards-joia. Só aparece com material publicado.
export function CartaoTravessinhosHome({ navigation }) {
  const lista = useMateriaisTravessinhos();
  if (!lista?.length) return null;
  return (
    <View style={s.linha}>
      <Profundo
        externo={{ flex: 1 }}
        estilo={s.tile}
        raio={18}
        altura={4}
        base={colors.joiaDourado[2]}
        sombra={s.sombra}
        onPress={() => navigation.navigate('Travessinhos')}
        accessibilityLabel="Os Travessinhos: histórias, vídeos e quadrinhos para as crianças"
      >
        <LinearGradient colors={[colors.joiaDourado[0], colors.joiaDourado[1]]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.gradiente} />
        <CarinhasTravessinhos tamanho={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.tit}>Os Travessinhos</Text>
          <Text style={s.sub}>Histórias, vídeos e quadrinhos para os pequenos</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.joiaDouradoTexto} />
      </Profundo>
    </View>
  );
}

const s = criarEstilos(() => ({
  carinhas: { flexDirection: 'row', alignItems: 'center' },
  carinha: { borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  linha: { flexDirection: 'row', marginTop: 10 },
  tile: {
    flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 96, padding: 16, borderRadius: 26, overflow: 'hidden',
    backgroundColor: colors.joiaDourado[1],
    borderWidth: 1, borderColor: colors.escuro ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.7)',
  },
  sombra: {
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16, shadowRadius: 18, elevation: 4,
  },
  gradiente: { ...StyleSheet.absoluteFillObject, borderRadius: 24 },
  tit: { fontFamily: 'Figtree_800ExtraBold', fontSize: 17.5, color: colors.joiaDouradoTexto },
  sub: { fontFamily: 'Figtree_400Regular', fontSize: 12.5, color: colors.texto2, marginTop: 3, lineHeight: 17 },
}));
