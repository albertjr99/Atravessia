import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Modal, StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { Profundo } from '../../components/Efeitos';
import { abrirLink } from '../../utils/abrirLink';
import {
  TIPOS_IMOBILIARIA, FAIXAS_FILTRO, TEXTO_BENEFICIO, precoTexto, rotuloTipoImovel,
} from '../../utils/imoveis';
import { TopoImoveis, ChipsQuebra, Suspensa, ImagemOuIcone, Etiqueta } from './comum';

const FINALIDADES = [
  { id: 'todos', rotulo: 'Comprar ou alugar' },
  { id: 'venda', rotulo: 'Comprar' },
  { id: 'aluguel', rotulo: 'Alugar' },
];
const QUARTOS = [
  { id: 0, rotulo: 'Qualquer' }, { id: 1, rotulo: '1+' }, { id: 2, rotulo: '2+' }, { id: 3, rotulo: '3+' }, { id: 4, rotulo: '4+' },
];

function BotaoPrincipal({ onPress, icone, children, externo }) {
  return (
    <Profundo externo={externo} estilo={s.btnFace} base={colors.botaoBase} sombra={s.btnHalo} onPress={onPress} accessibilityLabel={String(children)}>
      <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} />
      <Ionicons name={icone} size={18} color="white" />
      <Text style={s.btnTxt}>{children}</Text>
    </Profundo>
  );
}

function Caracteristicas({ i, compacto }) {
  const itens = [
    i.areaM2 ? { ic: 'resize-outline', t: `${i.areaM2} m²` } : null,
    i.quartos ? { ic: 'bed-outline', t: `${i.quartos} ${Number(i.quartos) === 1 ? 'quarto' : 'quartos'}` } : null,
    i.banheiros ? { ic: 'water-outline', t: `${i.banheiros} ${Number(i.banheiros) === 1 ? 'banheiro' : 'banheiros'}` } : null,
    i.vagas ? { ic: 'car-outline', t: `${i.vagas} ${Number(i.vagas) === 1 ? 'vaga' : 'vagas'}` } : null,
  ].filter(Boolean);
  if (!itens.length) return null;
  return (
    <View style={s.caracs}>
      {itens.map(x => (
        <View key={x.t} style={s.carac}>
          <Ionicons name={x.ic} size={compacto ? 13 : 15} color={colors.tl} />
          <Text style={[s.caracTxt, compacto && { fontSize: 12 }]}>{x.t}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ImobiliariaScreen({ route, navigation }) {
  const { imobiliariaId } = route.params || {};
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [imob, setImob] = useState(undefined);
  const [imoveis, setImoveis] = useState(null);
  const [finalidade, setFinalidade] = useState('todos');
  const [cidade, setCidade] = useState('todas');
  const [quartos, setQuartos] = useState(0);
  const [faixa, setFaixa] = useState('todos');
  const [aberto, setAberto] = useState(null);

  useEffect(() => {
    if (!imobiliariaId) return undefined;
    return onSnapshot(doc(db, 'imobiliarias', imobiliariaId), (snap) => setImob(snap.exists() ? { id: snap.id, ...snap.data() } : null), () => setImob(null));
  }, [imobiliariaId]);

  useEffect(() => {
    if (!imobiliariaId) return undefined;
    return onSnapshot(query(collection(db, 'imoveis'), where('imobiliariaId', '==', imobiliariaId)), (snap) => {
      setImoveis(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.ativo !== false)
        .sort((a, b) => (Number(a.ordem) || 999) - (Number(b.ordem) || 999)));
    }, () => setImoveis([]));
  }, [imobiliariaId]);

  const cidades = useMemo(() => {
    const set = new Set((imoveis || []).map(i => String(i.cidade || '').trim()).filter(Boolean));
    return [{ id: 'todas', rotulo: 'Todas as cidades' }, ...[...set].sort().map(c => ({ id: c, rotulo: c }))];
  }, [imoveis]);

  const faixaSel = finalidade !== 'todos' ? FAIXAS_FILTRO[finalidade].find(f => f.id === faixa) : null;
  const exibidos = (imoveis || []).filter(i => {
    if (finalidade !== 'todos' && i.finalidade !== finalidade) return false;
    if (cidade !== 'todas' && String(i.cidade || '').trim() !== cidade) return false;
    if (quartos && Number(i.quartos || 0) < quartos) return false;
    if (faixaSel && faixaSel.id !== 'todos') {
      const p = Number(i.preco) || 0;
      if (faixaSel.min && p < faixaSel.min) return false;
      if (faixaSel.max && p > faixaSel.max) return false;
    }
    return true;
  });

  const colunas = width >= 900 ? 3 : width >= 520 ? 2 : 1;
  const interesse = (imovel) => navigation.navigate('InteresseImovel', {
    imobiliariaId,
    imobiliariaNome: imob?.nome,
    imovelId: imovel?.id || null,
    imovelTitulo: imovel?.titulo || '',
    finalidade: imovel?.finalidade || null,
  });

  if (imob === undefined) {
    return <View style={[s.safe, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.lav4} /></View>;
  }

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <TopoImoveis titulo={imob?.nome || 'Imobiliária'} onVoltar={() => navigation.goBack()} />
      {!imob ? (
        <Text style={[s.sub, { textAlign: 'center', marginTop: 40 }]}>Esta imobiliária não está mais disponível.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}>
          <View style={s.capaCard}>
            <ImagemOuIcone url={imob.capaUrl} estilo={s.capa} icone="business-outline" tam={42} />
            <View style={s.cabCorpo}>
              <View style={s.logoWrap}><ImagemOuIcone url={imob.logoUrl} estilo={s.logo} icone="home-outline" tam={22} resizeMode="contain" /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.nome}>{imob.nome}</Text>
                {!!imob.creci && <Text style={s.creci}>CRECI {imob.creci}</Text>}
              </View>
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
              <View style={s.tags}>
                {(imob.tipos || []).map(t => <Etiqueta key={t} texto={TIPOS_IMOBILIARIA.find(x => x.id === t)?.rotulo || t} tom={t === 'lancamento' ? 'dourado' : 'lilas'} />)}
              </View>
              {!!imob.descricao && <Text style={s.desc}>{imob.descricao}</Text>}
              {((imob.cidades || []).length > 0 || (imob.bairros || []).length > 0) && (
                <View style={s.linhaIcone}>
                  <Ionicons name="location-outline" size={15} color={colors.tl} />
                  <Text style={s.sub}>
                    {[(imob.cidades || []).join(', '), (imob.bairros || []).length ? `Bairros: ${imob.bairros.join(', ')}` : ''].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              )}
              {(imob.destaques || []).map(d => (
                <View key={d} style={s.linhaIcone}>
                  <Ionicons name="checkmark-circle-outline" size={15} color={colors.sageFg} />
                  <Text style={s.sub}>{d}</Text>
                </View>
              ))}
              <View style={s.contatos}>
                {!!imob.site && (
                  <TouchableOpacity style={s.contato} onPress={() => abrirLink(imob.site)}><Ionicons name="globe-outline" size={16} color={colors.lilasTexto} /><Text style={s.contatoTxt}>Site</Text></TouchableOpacity>
                )}
                {!!imob.instagram && (
                  <TouchableOpacity style={s.contato} onPress={() => abrirLink(/^https?:/.test(imob.instagram) ? imob.instagram : `https://instagram.com/${String(imob.instagram).replace(/^@/, '')}`)}>
                    <Ionicons name="logo-instagram" size={16} color={colors.lilasTexto} /><Text style={s.contatoTxt}>Instagram</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <View style={s.beneficio}>
            <View style={s.beneficioIcone}><Ionicons name="gift-outline" size={20} color={colors.sageFg} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.beneficioTit}>Seu benefício</Text>
              <Text style={s.beneficioTxt}>{imob.regrasBeneficio || TEXTO_BENEFICIO}</Text>
            </View>
          </View>

          <BotaoPrincipal icone="key-outline" externo={{ marginTop: spacing.md }} onPress={() => interesse(null)}>
            Tenho interesse — quero indicação
          </BotaoPrincipal>

          <Text style={s.secao}>Imóveis em destaque</Text>
          {(imoveis || []).length > 0 && (
            <View style={s.filtros}>
              <ChipsQuebra rotulo="Finalidade" valor={finalidade} opcoes={FINALIDADES} onMudar={(v) => { setFinalidade(v); setFaixa('todos'); }} />
              {cidades.length > 2 && <Suspensa rotulo="Cidade" valor={cidade} opcoes={cidades} onMudar={setCidade} />}
              <ChipsQuebra rotulo="Quartos" valor={quartos} opcoes={QUARTOS} onMudar={setQuartos} />
              {finalidade !== 'todos' && (
                <ChipsQuebra rotulo={finalidade === 'aluguel' ? 'Aluguel por mês (R$)' : 'Valor (R$)'} valor={faixa} opcoes={FAIXAS_FILTRO[finalidade]} onMudar={setFaixa} />
              )}
            </View>
          )}

          {imoveis === null ? (
            <ActivityIndicator color={colors.lav4} style={{ marginTop: 20 }} />
          ) : imoveis.length === 0 ? (
            <Text style={[s.sub, { marginTop: 6 }]}>
              Esta imobiliária ainda não publicou imóveis aqui. Toque em “Tenho interesse” e conte o que você procura: ela entra em contato.
            </Text>
          ) : exibidos.length === 0 ? (
            <Text style={[s.sub, { marginTop: 6 }]}>Nenhum imóvel com esses filtros. Tente ampliar a busca.</Text>
          ) : (
            <View style={[s.grade, { marginHorizontal: -6 }]}>
              {exibidos.map(i => (
                <View key={i.id} style={{ width: `${100 / colunas}%`, padding: 6 }}>
                  <TouchableOpacity style={s.imovel} activeOpacity={0.88} onPress={() => setAberto(i)}>
                    <ImagemOuIcone url={(i.fotos || [])[0]} estilo={s.foto} icone="image-outline" />
                    <View style={s.finalidadeTag}>
                      <Text style={s.finalidadeTxt}>{i.finalidade === 'aluguel' ? 'Aluguel' : 'Venda'}</Text>
                    </View>
                    <View style={{ padding: 12, gap: 4 }}>
                      <Text style={s.preco}>{precoTexto(i.preco, i.finalidade)}</Text>
                      <Text style={s.imovelTit} numberOfLines={2}>{i.titulo}</Text>
                      <Text style={s.sub} numberOfLines={1}>{rotuloTipoImovel(i.tipo)} · {[i.bairro, i.cidade].filter(Boolean).join(', ')}</Text>
                      <Caracteristicas i={i} compacto />
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={!!aberto} animationType="slide" onRequestClose={() => setAberto(null)}>
        {aberto && (
          <View style={[s.safe, { paddingTop: insets.top }]}>
            <LavandaBg />
            <TopoImoveis titulo={rotuloTipoImovel(aberto.tipo)} onVoltar={() => setAberto(null)} />
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
              {(aberto.fotos || []).length > 0 ? (
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator>
                  {aberto.fotos.map(f => <ImagemOuIcone key={f} url={f} estilo={{ width, height: Math.min(320, width * 0.7) }} />)}
                </ScrollView>
              ) : <ImagemOuIcone url="" estilo={{ width, height: 180 }} icone="image-outline" />}
              {(aberto.fotos || []).length > 1 && <Text style={[s.sub, { textAlign: 'center', marginTop: 6 }]}>{aberto.fotos.length} fotos · deslize para ver</Text>}
              <View style={{ paddingHorizontal: spacing.lg, gap: 8, marginTop: spacing.md }}>
                <Text style={s.precoGrande}>{precoTexto(aberto.preco, aberto.finalidade)}</Text>
                {!!aberto.condominio && <Text style={s.sub}>Condomínio: {precoTexto(aberto.condominio, 'aluguel')}</Text>}
                <Text style={s.nome}>{aberto.titulo}</Text>
                <Text style={s.sub}>{[aberto.bairro, aberto.cidade].filter(Boolean).join(', ')}</Text>
                <Caracteristicas i={aberto} />
                {!!aberto.descricao && <Text style={s.desc}>{aberto.descricao}</Text>}
                <BotaoPrincipal icone="key-outline" externo={{ marginTop: spacing.md }} onPress={() => { const im = aberto; setAberto(null); interesse(im); }}>
                  Tenho interesse neste imóvel
                </BotaoPrincipal>
                {!!aberto.linkAnuncio && (
                  <TouchableOpacity style={s.secBtn} onPress={() => abrirLink(aberto.linkAnuncio)}>
                    <Ionicons name="open-outline" size={17} color={colors.lilasTexto} />
                    <Text style={s.secBtnTxt}>Ver anúncio completo</Text>
                  </TouchableOpacity>
                )}
                <Text style={s.nota}>Valores e disponibilidade são informados pela imobiliária e podem mudar.</Text>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  capaCard: { backgroundColor: colors.card, borderRadius: 26, borderWidth: 1, borderColor: colors.bordaLuz, overflow: 'hidden', marginTop: spacing.sm },
  capa: { width: '100%', height: 160 },
  cabCorpo: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 16, marginTop: -28, marginBottom: 10 },
  logoWrap: { width: 64, height: 64, borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#FFFFFF' },
  logo: { width: '100%', height: '100%' },
  nome: { fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 26, color: colors.titulo },
  creci: { fontFamily: fonts.body, fontSize: 12, color: colors.tl },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  desc: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, color: colors.td },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.texto2, flexShrink: 1 },
  linhaIcone: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  contatos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  contato: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: colors.lav1 },
  contatoTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lilasTexto },
  beneficio: { flexDirection: 'row', gap: 12, backgroundColor: colors.sageFundo, borderRadius: 20, padding: 14, marginTop: spacing.md },
  beneficioIcone: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  beneficioTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.sageFg },
  beneficioTxt: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.sageFg, marginTop: 2 },
  btnFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 22, overflow: 'hidden' },
  btnHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  btnTxt: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: 'white', textAlign: 'center' },
  secBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: radius.full, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro },
  secBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  secao: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, marginTop: spacing.xl, marginBottom: 4 },
  filtros: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.bordaLuz, padding: 14, marginBottom: 6 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  imovel: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.bordaLuz, overflow: 'hidden' },
  foto: { width: '100%', height: 150 },
  finalidadeTag: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(42,36,51,0.72)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  finalidadeTxt: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: 'white' },
  preco: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.lav6 },
  precoGrande: { fontFamily: fonts.bodyBold, fontSize: 24, color: colors.lav6 },
  imovelTit: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.titulo },
  caracs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  carac: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  caracTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2 },
  nota: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', marginTop: 8 },
}));
