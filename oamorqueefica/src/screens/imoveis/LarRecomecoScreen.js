import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/AuthContext';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { TIPOS_IMOBILIARIA, TEXTO_BENEFICIO } from '../../utils/imoveis';
import { TopoImoveis, ChipsQuebra, Suspensa, ImagemOuIcone, Etiqueta } from './comum';

// "Lar e recomeço": vitrine das imobiliárias parceiras. Mudar de casa costuma
// acompanhar um recomeço; aqui a usuária encontra imobiliárias de confiança e,
// quando o negócio fecha, ganha uma consultoria online com arquiteto parceiro.
export default function LarRecomecoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [imobiliarias, setImobiliarias] = useState(null);
  const [abertas, setAbertas] = useState(0);
  const [tipo, setTipo] = useState('todos');
  const [cidade, setCidade] = useState('todas');

  useEffect(() => onSnapshot(collection(db, 'imobiliarias'), (snap) => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(i => i.ativo !== false)
      .sort((a, b) => (Number(a.ordem) || 999) - (Number(b.ordem) || 999) || String(a.nome).localeCompare(String(b.nome)));
    setImobiliarias(lista);
  }, () => setImobiliarias([])), []);

  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(query(collection(db, 'indicacoesImoveis'), where('uid', '==', uid)), (snap) => {
      setAbertas(snap.docs.filter(d => !['concluido', 'perdido'].includes(d.data().status)).length);
    }, () => {});
  }, [uid]);

  const cidades = useMemo(() => {
    const set = new Set();
    (imobiliarias || []).forEach(i => (i.cidades || []).forEach(c => set.add(String(c).trim())));
    return [{ id: 'todas', rotulo: 'Todas as cidades' }, ...[...set].sort().map(c => ({ id: c, rotulo: c }))];
  }, [imobiliarias]);

  const exibidas = (imobiliarias || []).filter(i =>
    (tipo === 'todos' || (i.tipos || []).includes(tipo))
    && (cidade === 'todas' || (i.cidades || []).map(String).includes(cidade)));

  const colunas = width >= 1000 ? 3 : width >= 680 ? 2 : 1;

  const cartao = (i) => (
    <TouchableOpacity key={i.id} style={s.card} activeOpacity={0.88} onPress={() => navigation.navigate('Imobiliaria', { imobiliariaId: i.id })}>
      <View>
        <ImagemOuIcone url={i.capaUrl} estilo={s.capa} icone="business-outline" tam={40} />
        <View style={s.logoWrap}>
          <ImagemOuIcone url={i.logoUrl} estilo={s.logo} icone="home-outline" tam={22} resizeMode="contain" />
        </View>
      </View>
      <View style={s.cardCorpo}>
        <Text style={s.nome} numberOfLines={2}>{i.nome}</Text>
        {!!i.creci && <Text style={s.creci}>CRECI {i.creci}</Text>}
        {(i.cidades || []).length > 0 && (
          <View style={s.linhaIcone}>
            <Ionicons name="location-outline" size={14} color={colors.tl} />
            <Text style={s.local} numberOfLines={1}>{i.cidades.join(' · ')}</Text>
          </View>
        )}
        <View style={s.tags}>
          {(i.tipos || []).map(t => (
            <Etiqueta key={t} texto={TIPOS_IMOBILIARIA.find(x => x.id === t)?.rotulo || t} tom={t === 'lancamento' ? 'dourado' : 'lilas'} />
          ))}
        </View>
        {(i.destaques || []).slice(0, 3).map(d => (
          <View key={d} style={s.linhaIcone}>
            <Ionicons name="sparkles-outline" size={13} color={colors.sageFg} />
            <Text style={s.destaque} numberOfLines={1}>{d}</Text>
          </View>
        ))}
        <View style={s.verLinha}>
          <Text style={s.ver}>Ver imóveis e benefício</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.lilasTexto} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <TopoImoveis
        titulo="Lar e recomeço"
        onVoltar={() => navigation.goBack()}
        direita={(
          <TouchableOpacity style={s.iconeBtn} onPress={() => navigation.navigate('MinhasIndicacoesImoveis')} accessibilityLabel="Minhas indicações">
            <Ionicons name="key-outline" size={20} color={colors.lilasIcone} />
            {abertas > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{abertas}</Text></View>}
          </TouchableOpacity>
        )}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={s.hero}>
          <View style={s.heroIcone}><Ionicons name="home-outline" size={26} color={colors.lilasIcone} /></View>
          <Text style={s.heroTit}>Um novo lar para um novo capítulo</Text>
          <Text style={s.heroSub}>
            Às vezes recomeçar passa por mudar de casa. Aqui você encontra imobiliárias parceiras que
            atendem com cuidado, no seu tempo.
          </Text>
          <View style={s.beneficio}>
            <Ionicons name="color-palette-outline" size={18} color={colors.sageFg} />
            <Text style={s.beneficioTxt}>{TEXTO_BENEFICIO}</Text>
          </View>
        </View>

        {abertas > 0 && (
          <TouchableOpacity style={s.minhas} onPress={() => navigation.navigate('MinhasIndicacoesImoveis')} activeOpacity={0.85}>
            <Ionicons name="key-outline" size={18} color={colors.lilasTexto} />
            <Text style={s.minhasTxt}>{abertas === 1 ? 'Você tem 1 indicação em andamento' : `Você tem ${abertas} indicações em andamento`}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.lilasTexto} />
          </TouchableOpacity>
        )}

        <ChipsQuebra rotulo="O que você procura" valor={tipo} onMudar={setTipo}
          opcoes={[{ id: 'todos', rotulo: 'Tudo' }, ...TIPOS_IMOBILIARIA]} />
        {cidades.length > 2 && (
          <Suspensa rotulo="Cidade" valor={cidade} opcoes={cidades} onMudar={setCidade} />
        )}

        {imobiliarias === null ? (
          <ActivityIndicator color={colors.lav4} style={{ marginTop: 40 }} />
        ) : exibidas.length === 0 ? (
          <View style={s.vazio}>
            <Ionicons name="hourglass-outline" size={30} color={colors.lilasIcone} />
            <Text style={s.vazioTit}>{imobiliarias.length === 0 ? 'Em breve' : 'Nada com esses filtros'}</Text>
            <Text style={s.vazioSub}>
              {imobiliarias.length === 0
                ? 'Estamos escolhendo com carinho as primeiras imobiliárias parceiras.'
                : 'Tente outra cidade ou outro tipo de busca.'}
            </Text>
          </View>
        ) : (
          <View style={[s.grade, colunas > 1 && { marginHorizontal: -6 }]}>
            {exibidas.map(i => (
              <View key={i.id} style={{ width: `${100 / colunas}%`, padding: colunas > 1 ? 6 : 0 }}>{cartao(i)}</View>
            ))}
          </View>
        )}

        <Text style={s.nota}>
          A negociação é feita direto com a imobiliária. A Atravessia não cobra nada de você por isso.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  iconeBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.lav5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: 'white' },
  hero: {
    backgroundColor: colors.card, borderRadius: 26, borderWidth: 1, borderColor: colors.bordaLuz,
    padding: spacing.lg, marginTop: spacing.sm, alignItems: 'center',
  },
  heroIcone: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  heroTit: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, color: colors.titulo, textAlign: 'center' },
  heroSub: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.texto2, textAlign: 'center', marginTop: 6 },
  beneficio: { flexDirection: 'row', gap: 10, backgroundColor: colors.sageFundo, borderRadius: 16, padding: 12, marginTop: 14, alignItems: 'flex-start' },
  beneficioTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.sageFg },
  minhas: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md, padding: 14,
    borderRadius: 18, backgroundColor: colors.lav1,
  },
  minhasTxt: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.lilasTexto },
  grade: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  card: {
    backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.bordaLuz, overflow: 'hidden',
    marginBottom: 14, shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  capa: { width: '100%', height: 140 },
  logoWrap: {
    position: 'absolute', left: 16, bottom: -26, width: 60, height: 60, borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#FFFFFF',
  },
  logo: { width: '100%', height: '100%' },
  cardCorpo: { padding: 16, paddingTop: 34, gap: 6 },
  nome: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo },
  creci: { fontFamily: fonts.body, fontSize: 12, color: colors.tl },
  linhaIcone: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  local: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.texto2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  destaque: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.texto2 },
  verLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  ver: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  vazio: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  vazioTit: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.titulo },
  vazioSub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', maxWidth: 320, lineHeight: 20 },
  nota: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tl, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },
}));
