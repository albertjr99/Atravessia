import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Image, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import BarraAbas, { ALTURA_BARRA } from '../../components/BarraAbas';
import { useApp } from '../../hooks/AppContext';
import { planoNumero } from '../../utils/metricasFunil';
import { rotuloLocal } from '../../utils/localizacao';
import { urlDeImagem } from '../../utils/imagemUrl';
import { descontoDoCupom } from '../../utils/cupons';

const ilJornada = require('../../../assets/images/il_caminho_jornada.png');
const ilCarta = require('../../../assets/images/il_coracao_ramos.png');
const ilTerapia = require('../../../assets/images/il_mulher_flores.png');

const PLANO_LABEL = { 0: 'Perceber', 1: 'Acolher', 2: 'Compreender', 3: 'Evoluir' };
const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Explorar: tudo o que o app oferece — Continue a travessia, Experimente a
// vida, conteúdos, Produtos e Indicações — com busca.
export default function ExplorarScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    jornadasAdmin, travessiaItens, parcerias, conteudos, audiosAcolhimento, indicacoes, temAcesso,
  } = useApp();
  const [busca, setBusca] = useState('');
  const [temProdutos, setTemProdutos] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'videos'), (snap) => {
    const p = snap.exists() ? snap.data()?.produtos : null;
    setTemProdutos(!!p && p.ativo !== false && !!(p.url || p.link));
  }, (e) => console.warn('[Explorar] produtos:', e?.message)), []);

  const travessia = useMemo(() => {
    const imgs = [ilJornada, ilCarta, ilTerapia];
    const jornadas = (jornadasAdmin || []).map((j, i) => {
      const plano = planoNumero(j.plano);
      return { id: `j-${j.id}`, titulo: j.titulo, img: imgs[i % imgs.length], bloqueio: temAcesso(plano) ? null : PLANO_LABEL[plano] };
    });
    const itens = (travessiaItens || []).map((t, i) => ({
      id: `t-${t.id}`, titulo: t.titulo, img: urlDeImagem(t.imagemUrl) ? { uri: urlDeImagem(t.imagemUrl) } : imgs[(i + 2) % imgs.length], bloqueio: null,
    }));
    return [...jornadas, ...itens].slice(0, 8);
  }, [jornadasAdmin, travessiaItens, temAcesso]);

  const resultados = useMemo(() => {
    const q = normalizar(busca.trim());
    if (q.length < 2) return null;
    const casa = (...t) => t.some(x => normalizar(x).includes(q));
    const r = [];
    (jornadasAdmin || []).forEach(j => casa(j.titulo, j.descricao) && r.push({ id: `j${j.id}`, tipo: 'Jornada', titulo: j.titulo, icone: 'footsteps-outline', abrir: () => navigation.navigate('Jornadas') }));
    (travessiaItens || []).forEach(t => casa(t.titulo, t.descricao) && r.push({ id: `t${t.id}`, tipo: 'Continue a travessia', titulo: t.titulo, icone: 'compass-outline', abrir: () => navigation.navigate('Jornadas') }));
    (parcerias || []).forEach(p => casa(p.titulo, p.descricao, p.cidade) && r.push({ id: `p${p.id}`, tipo: 'Parceria', titulo: p.titulo, icone: 'gift-outline', abrir: () => navigation.navigate('Parcerias') }));
    (conteudos || []).filter(c => c.ativo !== false).forEach(c => casa(c.titulo, c.descricao) && r.push({ id: `c${c.id}`, tipo: 'Conteúdo', titulo: c.titulo, icone: 'book-outline', abrir: () => navigation.navigate('Conteudo', { conteudo: c }) }));
    (audiosAcolhimento || []).filter(a => a.ativo !== false).forEach(a => casa(a.titulo, a.descricao) && r.push({ id: `a${a.id}`, tipo: 'Áudio', titulo: a.titulo, icone: 'headset-outline', abrir: () => navigation.navigate('Audios') }));
    (indicacoes || []).forEach(i => casa(i.titulo, i.descricao) && r.push({ id: `i${i.id}`, tipo: 'Indicação', titulo: i.titulo, icone: 'library-outline', abrir: () => navigation.navigate('Indicacoes') }));
    return r.slice(0, 30);
  }, [busca, jornadasAdmin, travessiaItens, parcerias, conteudos, audiosAcolhimento, indicacoes, navigation]);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: ALTURA_BARRA + Math.max(insets.bottom, 8) + 28 }}
      >
        <View style={s.coluna}>
          <Text style={s.titulo}>Explorar</Text>
          <View style={s.busca}>
            <Ionicons name="search-outline" size={18} color={colors.tl} />
            <TextInput
              style={s.buscaInput}
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar jornadas, áudios, parcerias..."
              placeholderTextColor={colors.tl}
              returnKeyType="search"
              accessibilityLabel="Buscar"
            />
            {!!busca && (
              <TouchableOpacity onPress={() => setBusca('')} accessibilityLabel="Limpar busca" style={s.limpar}>
                <Ionicons name="close-circle" size={18} color={colors.tl} />
              </TouchableOpacity>
            )}
          </View>

          {resultados ? (
            <View style={[s.cartao, s.lista]}>
              {resultados.length === 0 ? (
                <Text style={s.vazio}>Nada encontrado para “{busca.trim()}”.</Text>
              ) : resultados.map((r, i) => (
                <TouchableOpacity key={r.id} style={[s.linha, i > 0 && s.linhaBorda]} onPress={r.abrir} activeOpacity={0.7}>
                  <View style={s.linhaIcone}><Ionicons name={r.icone} size={18} color={colors.lav5} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.linhaTit} numberOfLines={1}>{r.titulo}</Text>
                    <Text style={s.linhaSub}>{r.tipo}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.tl} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <>
              {/* Continue a travessia */}
              <View style={s.secaoCab}>
                <Text style={s.secaoTit}>Continue a travessia</Text>
                <TouchableOpacity style={s.apresentacao} onPress={() => navigation.navigate('Jornadas')}>
                  <View style={s.apresentacaoPlay}><Ionicons name="play" size={10} color="#FFFFFF" style={{ marginLeft: 1 }} /></View>
                  <Text style={s.link}>Ver tudo</Text>
                </TouchableOpacity>
              </View>
              {travessia.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.carrosselCaixa} contentContainerStyle={s.carrossel}>
                  {travessia.map(t => (
                    <TouchableOpacity key={t.id} style={s.card} onPress={() => navigation.navigate('Jornadas')} activeOpacity={0.88}>
                      <View style={s.cardImgCaixa}><Image source={t.img} style={s.cardImg} resizeMode="contain" /></View>
                      <View style={s.cardCorpo}>
                        <Text style={s.cardTit} numberOfLines={2}>{t.titulo}</Text>
                        {t.bloqueio ? (
                          <View style={s.bloqueio}>
                            <Ionicons name="lock-closed-outline" size={12} color={colors.texto2} />
                            <Text style={s.cardSub}>Plano {t.bloqueio}</Text>
                          </View>
                        ) : <Text style={[s.cardSub, { color: colors.sageFg }]}>Disponível para você</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <TouchableOpacity style={[s.cartao, s.atalho]} onPress={() => navigation.navigate('Jornadas')}>
                  <Text style={s.linhaTit}>Jornadas, terapias e caminhos para seguir</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.tl} />
                </TouchableOpacity>
              )}

              {/* Experimente a vida */}
              <View style={s.secaoCab}>
                <Text style={s.secaoTit}>Experimente a vida</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Parcerias')} style={s.linkCaixa}>
                  <Text style={s.link}>Ver todas</Text>
                </TouchableOpacity>
              </View>
              <View style={[s.cartao, s.lista]}>
                {(parcerias || []).slice(0, 3).map((p, i) => {
                  const desconto = p.tipoBeneficio === 'cupom' ? descontoDoCupom(p) : 0;
                  return (
                    <TouchableOpacity key={p.id} style={[s.linha, i > 0 && s.linhaBorda]} onPress={() => navigation.navigate('Parcerias')} activeOpacity={0.7}>
                      {urlDeImagem(p.imagemUrl)
                        ? <Image source={{ uri: urlDeImagem(p.imagemUrl) }} style={s.parceiroImg} />
                        : <View style={[s.parceiroImg, s.parceiroPh]}><Ionicons name="gift-outline" size={20} color={colors.lav5} /></View>}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.linhaTit} numberOfLines={1}>{p.titulo}</Text>
                        {!!rotuloLocal(p) && <Text style={s.linhaSub} numberOfLines={1}>{rotuloLocal(p)}</Text>}
                      </View>
                      {desconto > 0 && <Text style={s.selo}>{desconto}% off</Text>}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={[s.linha, (parcerias || []).length > 0 && s.linhaBorda]} onPress={() => navigation.navigate('Parcerias')} activeOpacity={0.7}>
                  <View style={s.linhaIcone}><Ionicons name="options-outline" size={18} color={colors.lav5} /></View>
                  <Text style={[s.linhaTit, { flex: 1 }]}>Filtrar por área e por região</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.tl} />
                </TouchableOpacity>
              </View>

              {/* Conteúdos */}
              <Text style={[s.secaoTit, s.secaoSolta]}>Conteúdos</Text>
              <View style={s.grade}>
                {[
                  { r: 'Áudios e leituras', icone: 'headset-outline', rota: 'Audios' },
                  { r: 'Favoritos', icone: 'heart-outline', rota: 'Favoritos' },
                  { r: 'Meus cupons', icone: 'ticket-outline', rota: 'MeusCupons' },
                ].map(t => (
                  <TouchableOpacity key={t.rota} style={s.gradeItem} onPress={() => navigation.navigate(t.rota)} activeOpacity={0.85}>
                    <Ionicons name={t.icone} size={22} color={colors.lav5} />
                    <Text style={s.gradeTxt} numberOfLines={2}>{t.r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Produtos e Indicações */}
              {(temProdutos || (indicacoes || []).length > 0) && (
                <View style={s.dupla}>
                  {temProdutos && (
                    <TouchableOpacity style={[s.tile, s.tileProdutos]} onPress={() => navigation.navigate('Produtos')} activeOpacity={0.88}>
                      <View style={[s.tileIcone, { backgroundColor: colors.douradoIcone }]}><Ionicons name="bag-handle-outline" size={21} color={colors.goldFg} /></View>
                      <Text style={[s.tileTit, { color: colors.goldFg }]}>Produtos Atravessia</Text>
                      <Text style={s.tileTxt}>Canecas, cadernos e mais, com vídeo.</Text>
                    </TouchableOpacity>
                  )}
                  {(indicacoes || []).length > 0 && (
                    <TouchableOpacity style={[s.tile, s.tileIndicacoes]} onPress={() => navigation.navigate('Indicacoes')} activeOpacity={0.88}>
                      <View style={[s.tileIcone, { backgroundColor: colors.lav2 }]}><Ionicons name="library-outline" size={21} color={colors.lav5} /></View>
                      <Text style={s.tileTit}>Indicações</Text>
                      <Text style={s.tileTxt}>Livros e cuidados escolhidos com carinho.</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
      <BarraAbas navigation={navigation} ativo="explorar" />
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  coluna: { width: '100%', paddingHorizontal: 16 },
  titulo: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 36, lineHeight: 40, color: colors.titulo, paddingHorizontal: 4 },
  busca: {
    marginTop: 14, height: 50, borderRadius: 25, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaSuave,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6,
  },
  buscaInput: { flex: 1, fontFamily: 'Lato_400Regular', fontSize: 14.5, color: colors.titulo, paddingVertical: 8 },
  limpar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  secaoCab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 10, paddingHorizontal: 4 },
  secaoTit: { fontFamily: 'Lato_700Bold', fontSize: 17, color: colors.titulo },
  secaoSolta: { marginTop: 26, marginBottom: 10, paddingHorizontal: 4 },
  link: { fontFamily: 'Lato_700Bold', fontSize: 13.5, color: colors.lav5 },
  linkCaixa: { minHeight: 36, justifyContent: 'center' },
  apresentacao: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  apresentacaoPlay: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.botaoForte, alignItems: 'center', justifyContent: 'center' },
  carrosselCaixa: { marginHorizontal: -16 },
  carrossel: { gap: 12, paddingHorizontal: 16 },
  card: { width: 196, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaSuave, overflow: 'hidden' },
  cardImgCaixa: { height: 110, backgroundColor: colors.sageFundo, alignItems: 'center', justifyContent: 'center' },
  cardImg: { width: 140, height: 100 },
  cardCorpo: { padding: 12, gap: 4 },
  cardTit: { fontFamily: 'Lato_700Bold', fontSize: 14.5, lineHeight: 19, color: colors.titulo },
  cardSub: { fontFamily: 'Lato_400Regular', fontSize: 12.5, color: colors.texto2 },
  bloqueio: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cartao: { borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaSuave },
  atalho: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
  lista: { overflow: 'hidden', marginTop: 14 },
  linha: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  linhaBorda: { borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  linhaIcone: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  linhaTit: { fontFamily: 'Lato_700Bold', fontSize: 14.5, color: colors.titulo },
  linhaSub: { fontFamily: 'Lato_400Regular', fontSize: 12.5, color: colors.texto2, marginTop: 1 },
  vazio: { fontFamily: 'Lato_400Regular', fontSize: 14, color: colors.texto2, padding: 18, textAlign: 'center' },
  parceiroImg: { width: 46, height: 46, borderRadius: 14 },
  parceiroPh: { backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  selo: {
    fontFamily: 'Lato_700Bold', fontSize: 12, color: colors.goldFg, backgroundColor: colors.douradoFundo,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden',
  },
  grade: { flexDirection: 'row', gap: 10 },
  gradeItem: {
    flex: 1, minHeight: 86, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaSuave,
    alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6,
  },
  gradeTxt: { fontFamily: 'Lato_700Bold', fontSize: 13, color: colors.titulo, textAlign: 'center' },
  dupla: { flexDirection: 'row', gap: 10, marginTop: 14 },
  tile: { flex: 1, padding: 16, borderRadius: 22, borderWidth: 1, gap: 8 },
  tileProdutos: { backgroundColor: colors.douradoFundo, borderColor: colors.douradoBorda },
  tileIndicacoes: { backgroundColor: colors.lav1, borderColor: colors.lav2 },
  tileIcone: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tileTit: { fontFamily: 'Lato_700Bold', fontSize: 15, color: colors.titulo },
  tileTxt: { fontFamily: 'Lato_400Regular', fontSize: 12.5, lineHeight: 17, color: colors.texto2 },
}), { escalar: false });
