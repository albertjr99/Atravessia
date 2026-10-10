import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Image, Alert, ActivityIndicator,
  Modal, Pressable, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { abrirLink } from '../../utils/abrirLink';
import { situacaoCupom } from '../../utils/cupons';
import { nomeDoEstado, chaveCidade, rotuloLocal } from '../../utils/localizacao';
import { urlDeImagem } from '../../utils/imagemUrl';
import {
  useVideoApresentacao, BotaoApresentacao, ModalVideoApresentacao, VIDEOS,
} from '../../components/VideoApresentacao';

// Estas são as categorias oficiais — o painel administrativo grava exatamente
// estes ids. A lista `match` existe apenas para reconhecer parcerias cadastradas
// antes da padronização, cujas categorias eram texto livre.
const FILTROS = [
  { id: 'todos',           label: 'Todos',                              match: null },
  { id: 'saude',           label: 'Da saúde física',                    match: ['saúde', 'saude', 'fisio', 'nutri', 'farmácia', 'farmacia', 'clínica', 'clinica'] },
  { id: 'voce',            label: 'De você e do ambiente em que vive',  match: ['você', 'voce', 'bem-estar', 'bem estar', 'ambiente', 'casa', 'moradia', 'espiritualidade', 'meditação', 'terapia'] },
  { id: 'trabalho',        label: 'Do trabalho e estudos',              match: ['trabalho', 'estudos', 'educação', 'educacao', 'carreira', 'curso'] },
  { id: 'relacionamentos', label: 'Dos relacionamentos',                match: ['relacionamento', 'família', 'familia', 'social'] },
  { id: 'outros',          label: 'Outros',                             match: ['outros', 'produto'] },
];

const rotuloCategoria = (c) => FILTROS.find(f => f.id === c)?.label || c;

// A usuária vê só o desconto que ela recebe. O percentual total da parceria
// inclui a comissão da Atravessia, que é assunto entre a Atravessia e o parceiro.
function descontoDaUsuaria(p) {
  if (p.percentualDescontoCliente != null) return Number(p.percentualDescontoCliente) || 0;
  return Math.max(0, (Number(p.percentualBeneficio) || 0) - (Number(p.percentualComissao) || 0));
}

function casaArea(p, filtroId) {
  if (filtroId === 'todos') return true;
  const cats = (p.categorias || []).map(c => String(c).toLowerCase());
  const filtro = FILTROS.find(f => f.id === filtroId);
  if (!filtro) return true;
  // Casamento direto pelo id (padrão atual)…
  if (cats.includes(filtro.id)) return true;
  // …e por palavra-chave, para cadastros anteriores à padronização.
  return (filtro.match || []).some(m => cats.some(c => c.includes(m)));
}

// Onde: 'todos' | 'online' | { estado, cidade } (cidade = chave sem acento, ou '').
function casaLocal(p, onde) {
  if (onde === 'todos') return true;
  if (onde === 'online') return p.atendimentoOnline === true;
  // Num estado/cidade também entram as parcerias com atendimento on-line,
  // que atendem de qualquer lugar.
  if (p.atendimentoOnline === true) return true;
  if (p.estado !== onde.estado) return false;
  return !onde.cidade || chaveCidade(p.cidade) === onde.cidade;
}

// Descrições longas mostram duas linhas e "ver mais" (o texto inteiro aparece
// no próprio cartão, sem sair da tela).
const DESCRICAO_LONGA = 90;

function CartaoParceria({ p, carregando, onAcao, compacto }) {
  const [aberto, setAberto] = useState(false);
  const [erroImg, setErroImg] = useState(false);
  const ehCupom = p.tipoBeneficio === 'cupom';
  const destino = p.link || p.url;
  const temAcao = ehCupom || !!destino;
  const desconto = ehCupom ? descontoDaUsuaria(p) : 0;
  const descricao = String(p.descricao || '').trim();
  const longa = descricao.length > DESCRICAO_LONGA || descricao.includes('\n');
  const local = rotuloLocal(p);
  const imagem = urlDeImagem(p.imagemUrl);

  // O cartão em si não é tocável: só o botão gera o cupom ou abre o link.
  return (
    <View style={[s.card, compacto && s.cardGrade]}>
      <View style={s.cardLinha}>
        {imagem && !erroImg ? (
          <Image source={{ uri: imagem }} style={s.logo} resizeMode="contain" onError={() => setErroImg(true)} />
        ) : (
          <View style={[s.logo, s.logoVazio]}>
            <Ionicons name="gift-outline" size={24} color={colors.lav3} />
          </View>
        )}
        <View style={s.cardCorpo}>
          <Text style={s.cardTitulo} numberOfLines={2}>{p.titulo}</Text>
          <View style={s.metaLinha}>
            {(p.categorias || []).length > 0 && (
              <Text style={s.meta} numberOfLines={1}>{rotuloCategoria(p.categorias[0])}</Text>
            )}
            {!!local && (
              <View style={s.localTag}>
                <Ionicons name={p.atendimentoOnline && !p.estado ? 'globe-outline' : 'location-outline'} size={11} color={colors.lav5} />
                <Text style={s.localTxt} numberOfLines={1}>{local}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {!!descricao && (
        <View>
          <Text style={s.cardDesc} numberOfLines={aberto || !longa ? undefined : 2}>{descricao}</Text>
          {longa && (
            <TouchableOpacity onPress={() => setAberto(a => !a)} hitSlop={8} style={s.verMais}>
              <Text style={s.verMaisTxt}>{aberto ? 'ver menos' : 'ver mais'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={s.cardRodape}>
        {desconto > 0 ? (
          <View style={s.tagCupom}>
            <Ionicons name="pricetag" size={11} color="#8A6A33" />
            <Text style={s.tagCupomTxt}>{desconto}% de desconto</Text>
          </View>
        ) : <View />}
        {temAcao ? (
          <TouchableOpacity
            style={[s.botao, carregando && { opacity: 0.7 }]}
            onPress={onAcao}
            disabled={carregando}
            activeOpacity={0.85}
          >
            {carregando
              ? <ActivityIndicator size="small" color="white" />
              : <Ionicons name={ehCupom ? 'ticket-outline' : 'open-outline'} size={14} color="white" />}
            <Text style={s.botaoTxt}>{carregando ? 'Gerando...' : ehCupom ? 'Gerar cupom' : 'Acessar'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function ParceriasScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { parcerias, registrarCliqueParceria, gerarVoucherBeneficio, meusVouchers } = useApp();
  const cuponsEmAberto = (meusVouchers || []).filter(v => ['ativo', 'aguardando'].includes(situacaoCupom(v))).length;
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const [onde, setOnde] = useState('todos');
  const [escolhendo, setEscolhendo] = useState(null); // 'estado' | 'cidade' | null
  const [gerando, setGerando] = useState(null); // id da parceria em geração

  // Vídeo de apresentação: abre sozinho na primeira visita.
  const { video, abrirAutomatico, marcarVisto } = useVideoApresentacao('parcerias');
  const [verVideo, setVerVideo] = useState(false);
  useEffect(() => {
    if (abrirAutomatico) { setVerVideo(true); marcarVisto(); }
  }, [abrirAutomatico, marcarVisto]);

  // Em tablets os cartões ficam lado a lado.
  const colunas = width >= 1000 ? 3 : width >= 680 ? 2 : 1;

  // Parcerias comuns (a maioria) apenas levam a um link/desconto direto — sem
  // rastreamento financeiro. Só as marcadas como "cupom" pelo painel administrativo
  // (as que geram comissão para o Travessia) passam pelo fluxo de voucher.
  const handleAcao = async (p) => {
    if (p.tipoBeneficio === 'cupom') {
      if (gerando) return;
      setGerando(p.id);
      try {
        const voucher = await gerarVoucherBeneficio(p.id);
        navigation.navigate('Voucher', { ...voucher, parceriaNome: p.titulo });
      } catch (e) {
        // functions/not-found = a Cloud Function não existe no projeto (ainda não
        // publicada). Sem isto a usuária via só "not found", que não diz nada.
        const indisponivel = e?.code === 'functions/not-found' || e?.code === 'functions/unavailable';
        Alert.alert(
          '',
          indisponivel
            ? 'Os cupons ainda não estão disponíveis. Tente novamente mais tarde.'
            : (e?.message || 'Não foi possível gerar o cupom agora. Tente novamente.')
        );
      } finally {
        setGerando(null);
      }
      return;
    }
    // Aceita tanto `link` (painel web) quanto `url` (cadastros antigos do app).
    registrarCliqueParceria(p.id);
    abrirLink(p.link || p.url);
  };

  // Estados e cidades que têm parcerias, para o filtro "Onde".
  const estadosComParceria = useMemo(() => {
    const m = new Map();
    parcerias.forEach(p => { if (p.estado) m.set(p.estado, (m.get(p.estado) || 0) + 1); });
    return [...m.entries()].map(([uf, qtd]) => ({ uf, nome: nomeDoEstado(uf), qtd }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [parcerias]);
  const temOnline = parcerias.some(p => p.atendimentoOnline === true);

  const estadoSel = typeof onde === 'object' ? onde.estado : null;
  const cidadesDoEstado = useMemo(() => {
    if (!estadoSel) return [];
    const m = new Map();
    parcerias.forEach(p => {
      if (p.estado !== estadoSel || !p.cidade) return;
      const k = chaveCidade(p.cidade);
      const atual = m.get(k);
      m.set(k, { chave: k, nome: atual?.nome || p.cidade, qtd: (atual?.qtd || 0) + 1 });
    });
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [parcerias, estadoSel]);
  const cidadeSel = typeof onde === 'object' && onde.cidade
    ? cidadesDoEstado.find(c => c.chave === onde.cidade)?.nome || ''
    : '';

  const parceriasExibidas = parcerias.filter(p => casaArea(p, filtroAtivo) && casaLocal(p, onde));
  const filtrosLocalAtivos = estadosComParceria.length > 0 || temOnline;

  const renderCartoes = () => {
    if (colunas === 1) {
      return parceriasExibidas.map(p => (
        <CartaoParceria key={p.id} p={p} carregando={gerando === p.id} onAcao={() => handleAcao(p)} />
      ));
    }
    return (
      <View style={s.grade}>
        {parceriasExibidas.map(p => (
          <View key={p.id} style={{ width: `${100 / colunas}%`, padding: 5 }}>
            <CartaoParceria p={p} carregando={gerando === p.id} onAcao={() => handleAcao(p)} compacto />
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />

      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Benefícios e Parcerias</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MeusCupons')} style={s.backBtn} accessibilityLabel="Meus cupons">
          <Ionicons name="ticket-outline" size={22} color={colors.lav5} />
          {cuponsEmAberto > 0 && (
            <View style={s.badge}><Text style={s.badgeTxt}>{cuponsEmAberto}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        {cuponsEmAberto > 0 && (
          <TouchableOpacity style={s.meusCupons} onPress={() => navigation.navigate('MeusCupons')} activeOpacity={0.85}>
            <Ionicons name="ticket-outline" size={18} color={colors.lav5} />
            <Text style={s.meusCuponsTxt}>
              {cuponsEmAberto === 1 ? 'Você tem 1 cupom em aberto' : `Você tem ${cuponsEmAberto} cupons em aberto`}
            </Text>
            <Text style={s.meusCuponsLink}>Ver</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.lav5} />
          </TouchableOpacity>
        )}

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroTitle}>Descontos exclusivos para cuidar de você</Text>
          <Text style={s.heroSub}>
            Você é o autor da sua história e a Atravessia caminha com você. Experimente a vida — descubra parceiros e benefícios para viver melhor o hoje.
          </Text>
          {!!video && <BotaoApresentacao onPress={() => setVerVideo(true)} style={{ alignSelf: 'center', marginTop: 4 }} />}
        </View>

        {/* Filtro: área da vida */}
        <Text style={s.filtroRotulo}>Área da vida</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtrosRow}>
          {FILTROS.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[s.filtroChip, filtroAtivo === f.id && s.filtroChipAtivo]}
              onPress={() => setFiltroAtivo(f.id)}
              activeOpacity={0.75}
            >
              <Text style={[s.filtroChipTxt, filtroAtivo === f.id && s.filtroChipTxtAtivo]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filtro: onde */}
        {filtrosLocalAtivos && (
          <>
            <Text style={s.filtroRotulo}>Onde</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtrosRow}>
              <TouchableOpacity
                style={[s.filtroChip, onde === 'todos' && s.filtroChipAtivo]}
                onPress={() => setOnde('todos')}
              >
                <Text style={[s.filtroChipTxt, onde === 'todos' && s.filtroChipTxtAtivo]}>Todos os lugares</Text>
              </TouchableOpacity>
              {temOnline && (
                <TouchableOpacity
                  style={[s.filtroChip, s.filtroChipIcone, onde === 'online' && s.filtroChipAtivo]}
                  onPress={() => setOnde('online')}
                >
                  <Ionicons name="globe-outline" size={13} color={onde === 'online' ? 'white' : colors.lav5} />
                  <Text style={[s.filtroChipTxt, onde === 'online' && s.filtroChipTxtAtivo]}>Atendimento on-line</Text>
                </TouchableOpacity>
              )}
              {estadosComParceria.length > 0 && (
                <TouchableOpacity
                  style={[s.filtroChip, s.filtroChipIcone, estadoSel && s.filtroChipAtivo]}
                  onPress={() => setEscolhendo('estado')}
                >
                  <Ionicons name="location-outline" size={13} color={estadoSel ? 'white' : colors.lav5} />
                  <Text style={[s.filtroChipTxt, estadoSel && s.filtroChipTxtAtivo]}>
                    {estadoSel ? nomeDoEstado(estadoSel) : 'Estado'}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={estadoSel ? 'white' : colors.tm} />
                </TouchableOpacity>
              )}
              {estadoSel && cidadesDoEstado.length > 0 && (
                <TouchableOpacity
                  style={[s.filtroChip, s.filtroChipIcone, !!cidadeSel && s.filtroChipAtivo]}
                  onPress={() => setEscolhendo('cidade')}
                >
                  <Text style={[s.filtroChipTxt, !!cidadeSel && s.filtroChipTxtAtivo]}>{cidadeSel || 'Cidade'}</Text>
                  <Ionicons name="chevron-down" size={12} color={cidadeSel ? 'white' : colors.tm} />
                </TouchableOpacity>
              )}
            </ScrollView>
            {estadoSel && temOnline && (
              <Text style={s.notaFiltro}>Também aparecem as parcerias com atendimento on-line.</Text>
            )}
          </>
        )}

        {/* Lista de parcerias */}
        {parcerias.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="hourglass-outline" size={40} color={colors.lav3} />
            <Text style={s.emptyTit}>Em breve</Text>
            <Text style={s.emptySub}>
              Novas parcerias e benefícios exclusivos serão anunciados em breve. Fique de olho!
            </Text>
          </View>
        ) : parceriasExibidas.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="search-outline" size={36} color={colors.lav3} />
            <Text style={s.emptyTit}>Sem parcerias aqui</Text>
            <Text style={s.emptySub}>Nenhuma parceria com esses filtros ainda. Tente outra área ou outro lugar.</Text>
          </View>
        ) : (
          <View style={s.lista}>
            <Text style={s.listaTitle}>
              {parceriasExibidas.length === 1 ? '1 parceria' : `${parceriasExibidas.length} parcerias`}
            </Text>
            {renderCartoes()}
          </View>
        )}
      </ScrollView>

      {/* Escolha de estado / cidade */}
      <Modal visible={!!escolhendo} transparent animationType="fade" onRequestClose={() => setEscolhendo(null)}>
        <Pressable style={s.modalFundo} onPress={() => setEscolhendo(null)}>
          <Pressable style={s.modalCaixa} onPress={() => {}}>
            <Text style={s.modalTit}>{escolhendo === 'cidade' ? `Cidades — ${nomeDoEstado(estadoSel)}` : 'Estado'}</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {escolhendo === 'estado' ? (
                <>
                  <TouchableOpacity style={s.opcao} onPress={() => { setOnde('todos'); setEscolhendo(null); }}>
                    <Text style={s.opcaoTxt}>Todos os lugares</Text>
                  </TouchableOpacity>
                  {estadosComParceria.map(e => (
                    <TouchableOpacity key={e.uf} style={s.opcao} onPress={() => { setOnde({ estado: e.uf, cidade: '' }); setEscolhendo(null); }}>
                      <Text style={[s.opcaoTxt, estadoSel === e.uf && s.opcaoSel]}>{e.nome}</Text>
                      <Text style={s.opcaoQtd}>{e.qtd}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              ) : (
                <>
                  <TouchableOpacity style={s.opcao} onPress={() => { setOnde({ estado: estadoSel, cidade: '' }); setEscolhendo(null); }}>
                    <Text style={[s.opcaoTxt, !cidadeSel && s.opcaoSel]}>Todas as cidades</Text>
                  </TouchableOpacity>
                  {cidadesDoEstado.map(c => (
                    <TouchableOpacity key={c.chave} style={s.opcao} onPress={() => { setOnde({ estado: estadoSel, cidade: c.chave }); setEscolhendo(null); }}>
                      <Text style={[s.opcaoTxt, cidadeSel === c.nome && s.opcaoSel]}>{c.nome}</Text>
                      <Text style={s.opcaoQtd}>{c.qtd}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ModalVideoApresentacao
        visivel={verVideo}
        onFechar={() => setVerVideo(false)}
        video={video}
        tituloPadrao={VIDEOS.parcerias.titulo}
      />
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  badge: {
    position: 'absolute', top: 2, right: 0, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.peach2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeTxt: { fontFamily: fonts.bodyBold, fontSize: 9.5, color: 'white' },
  meusCupons: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.lav1, borderWidth: 1, borderColor: colors.lav2,
  },
  meusCuponsTxt: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav6 },
  meusCuponsLink: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.lav5 },
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },

  hero: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: 6 },
  heroTitle: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.td, textAlign: 'center', lineHeight: 25 },
  heroSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, textAlign: 'center', lineHeight: 19 },

  filtroRotulo: {
    fontFamily: fonts.bodyBold, fontSize: 11, color: colors.tl, letterSpacing: 0.6, textTransform: 'uppercase',
    paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: 4,
  },
  filtrosRow: { paddingHorizontal: spacing.lg, gap: 8, paddingVertical: 4 },
  filtroChip: {
    backgroundColor: colors.card, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: colors.border,
  },
  filtroChipIcone: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  filtroChipAtivo: { backgroundColor: colors.lav4, borderColor: colors.lav4 },
  filtroChipTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.td },
  filtroChipTxtAtivo: { fontFamily: fonts.bodyBold, color: 'white' },
  notaFiltro: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tl, paddingHorizontal: spacing.lg, marginTop: 2 },

  emptyBox: { alignItems: 'center', padding: spacing.xxl, gap: 10 },
  emptyTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.td },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, textAlign: 'center', lineHeight: 20 },

  lista: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  listaTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.tm, marginBottom: spacing.sm },
  grade: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },

  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: 12, marginBottom: 10, gap: 8,
    shadowColor: '#6b5b7a', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardGrade: { marginBottom: 0, flex: 1 },
  cardLinha: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  logo: { width: 56, height: 56, borderRadius: 12, backgroundColor: 'white', borderWidth: 1, borderColor: colors.border },
  logoVazio: { backgroundColor: colors.lav1, borderColor: colors.lav2, alignItems: 'center', justifyContent: 'center' },
  cardCorpo: { flex: 1, minWidth: 0, gap: 4 },
  cardTitulo: { fontFamily: fonts.bodyBold, fontSize: 14.5, lineHeight: 19, color: colors.td },
  metaLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.lav5, maxWidth: '100%' },
  localTag: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  localTxt: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tm, flexShrink: 1 },
  cardDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, lineHeight: 19 },
  verMais: { alignSelf: 'flex-start', marginTop: 2 },
  verMaisTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.lav5 },
  cardRodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tagCupom: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.gold + '30', borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4,
  },
  tagCupomTxt: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.goldFg },
  botao: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.lav4, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 14,
  },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: 'white' },

  modalFundo: { flex: 1, backgroundColor: colors.sobreposicao, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCaixa: { width: '100%', maxWidth: 420, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg },
  modalTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td, marginBottom: spacing.sm },
  opcao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  opcaoTxt: { fontFamily: fonts.body, fontSize: 14, color: colors.td },
  opcaoSel: { fontFamily: fonts.bodyBold, color: colors.lav5 },
  opcaoQtd: { fontFamily: fonts.body, fontSize: 12, color: colors.tl },
}));
