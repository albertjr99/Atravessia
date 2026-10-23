import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Image, Alert, ActivityIndicator,
  Modal, Pressable, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { Profundo } from '../../components/Efeitos';
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
  return Number(p.percentualBeneficio) || Number(p.percentualDescontoCliente) || 0;
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
  // Cashback desta parceria (definido no painel); some se o cashback estiver escondido.
  const { cashbackVisivel, cfgCashback } = useApp();
  const temCashback = ehCupom && cashbackVisivel && p.cashback?.ativo !== false;
  const pctCashback = p.cashback?.percentual != null ? Number(p.cashback.percentual) : cfgCashback?.percentual;

  // O cartão em si não é tocável: só o botão gera o cupom ou abre o link.
  return (
    <View style={[s.card, compacto && s.cardGrade]}>
      <View style={s.cardLinha}>
        {imagem && !erroImg ? (
          <Image source={{ uri: imagem }} style={s.logo} resizeMode="contain" onError={() => setErroImg(true)} />
        ) : (
          <View style={[s.logo, s.logoVazio]}>
            <Ionicons name="gift-outline" size={24} color={colors.lilasIcone} />
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
                <Ionicons name={p.atendimentoOnline && !p.estado ? 'globe-outline' : 'location-outline'} size={13} color={colors.tl} />
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

      {/* Só informa que há cashback (e as condições); nenhum percentual aparece para a usuária. */}
      {temCashback && pctCashback > 0 && (
        <View style={s.cashbackLinha}>
          <Ionicons name="wallet-outline" size={14} color={colors.sageFg} />
          <Text style={s.cashbackTxt}>
            {'Esta parceria dá cashback'}
            {p.cashback?.condicoes ? <Text style={s.cashbackCond}>{` · ${p.cashback.condicoes}`}</Text> : null}
          </Text>
        </View>
      )}

      <View style={s.cardRodape}>
        {/* O percentual do cupom é informação interna da Atravessia: não aparece no cartão. */}
        <View />
        {temAcao ? (
          // Botão com degradê e "degrau" que afunda ao toque
          <Profundo
            externo={carregando && { opacity: 0.7 }}
            estilo={s.botao}
            base={colors.botaoBase}
            sombra={s.botaoHalo}
            altura={4}
            onPress={carregando ? undefined : onAcao}
            accessibilityLabel={ehCupom ? 'Gerar cupom' : 'Acessar'}
          >
            <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.botaoGrad} />
            {carregando
              ? <ActivityIndicator size="small" color="white" />
              : <Ionicons name={ehCupom ? 'ticket-outline' : 'open-outline'} size={16} color="white" />}
            <Text style={s.botaoTxt}>{carregando ? 'Gerando...' : ehCupom ? 'Gerar cupom' : 'Acessar'}</Text>
          </Profundo>
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
        const indisponivel = e?.code === 'functions/not-found';
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

      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Benefícios e Parcerias</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MeusCupons')} style={s.backBtn} accessibilityLabel="Meus cupons">
          <Ionicons name="ticket-outline" size={20} color={colors.lilasIcone} />
          {cuponsEmAberto > 0 && (
            <View style={s.badge}><Text style={s.badgeTxt}>{cuponsEmAberto}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        {cuponsEmAberto > 0 && (
          <TouchableOpacity style={s.meusCupons} onPress={() => navigation.navigate('MeusCupons')} activeOpacity={0.85}>
            <View style={s.meusCuponsIcone}>
              <Ionicons name="ticket-outline" size={19} color={colors.sageFg} />
            </View>
            <Text style={s.meusCuponsTxt}>
              {cuponsEmAberto === 1 ? 'Você tem 1 cupom em aberto' : `Você tem ${cuponsEmAberto} cupons em aberto`}
            </Text>
            <Text style={s.meusCuponsLink}>Ver</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.lilasTexto} />
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
        <View style={s.trilho}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtrosRow}>
            {FILTROS.map(f => (
              <TouchableOpacity
                key={f.id}
                style={[s.filtroChip, filtroAtivo === f.id && s.filtroChipAtivo]}
                onPress={() => setFiltroAtivo(f.id)}
                activeOpacity={0.75}
                accessibilityState={{ selected: filtroAtivo === f.id }}
              >
                <Text style={[s.filtroChipTxt, filtroAtivo === f.id && s.filtroChipTxtAtivo]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Filtro: onde */}
        {filtrosLocalAtivos && (
          <>
            <Text style={s.filtroRotulo}>Onde</Text>
            <View style={s.trilho}>
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
                  <Ionicons name="globe-outline" size={15} color={onde === 'online' ? colors.lilasTexto : colors.tl} />
                  <Text style={[s.filtroChipTxt, onde === 'online' && s.filtroChipTxtAtivo]}>Atendimento on-line</Text>
                </TouchableOpacity>
              )}
              {estadosComParceria.length > 0 && (
                <TouchableOpacity
                  style={[s.filtroChip, s.filtroChipIcone, estadoSel && s.filtroChipAtivo]}
                  onPress={() => setEscolhendo('estado')}
                >
                  <Ionicons name="location-outline" size={15} color={estadoSel ? colors.lilasTexto : colors.tl} />
                  <Text style={[s.filtroChipTxt, estadoSel && s.filtroChipTxtAtivo]}>
                    {estadoSel ? nomeDoEstado(estadoSel) : 'Estado'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={estadoSel ? colors.lilasTexto : colors.tl} />
                </TouchableOpacity>
              )}
              {estadoSel && cidadesDoEstado.length > 0 && (
                <TouchableOpacity
                  style={[s.filtroChip, s.filtroChipIcone, !!cidadeSel && s.filtroChipAtivo]}
                  onPress={() => setEscolhendo('cidade')}
                >
                  <Text style={[s.filtroChipTxt, !!cidadeSel && s.filtroChipTxtAtivo]}>{cidadeSel || 'Cidade'}</Text>
                  <Ionicons name="chevron-down" size={14} color={cidadeSel ? colors.lilasTexto : colors.tl} />
                </TouchableOpacity>
              )}
            </ScrollView>
            </View>
            {estadoSel && temOnline && (
              <Text style={s.notaFiltro}>Também aparecem as parcerias com atendimento on-line.</Text>
            )}
          </>
        )}

        {/* Lista de parcerias */}
        {parcerias.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIcone}><Ionicons name="hourglass-outline" size={30} color={colors.lilasIcone} /></View>
            <Text style={s.emptyTit}>Em breve</Text>
            <Text style={s.emptySub}>
              Novas parcerias e benefícios exclusivos serão anunciados em breve. Fique de olho!
            </Text>
          </View>
        ) : parceriasExibidas.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIcone}><Ionicons name="search-outline" size={28} color={colors.lilasIcone} /></View>
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

        {/* Memória da experiência (opcional): aparece na Carta do mês */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <TouchableOpacity style={s.memoriaBtn} onPress={() => navigation.navigate('GuardarMemoria')} activeOpacity={0.85} accessibilityRole="button">
            <View style={s.memoriaIcone}><Ionicons name="sparkles-outline" size={20} color={colors.joiaPessegoTexto} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.memoriaTit}>Guardar na memória</Text>
              <Text style={s.memoriaSub}>Que sensação boa você gostaria de guardar? (opcional)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.joiaPessegoTexto} />
          </TouchableOpacity>
        </View>
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
  safe: { flex: 1, backgroundColor: colors.bg },

  // Cabeçalho: voltar e "meus cupons" em pílulas de vidro, título em Cormorant
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 1,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 26, color: colors.titulo },
  badge: {
    position: 'absolute', top: -3, right: -3, minWidth: 19, height: 19, borderRadius: 10,
    backgroundColor: colors.botaoForte, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: colors.cardSolido,
  },
  badgeTxt: { fontFamily: fonts.bodyBold, fontSize: 9.5, color: 'white' },

  meusCupons: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: spacing.lg, marginTop: spacing.sm, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 8 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 18, elevation: 2,
  },
  meusCuponsIcone: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.sageFundo, alignItems: 'center', justifyContent: 'center' },
  meusCuponsTxt: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.titulo },
  meusCuponsLink: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lilasTexto },

  hero: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 8 },
  heroTitle: { fontFamily: fonts.serif, fontSize: 30, color: colors.titulo, textAlign: 'center', lineHeight: 36 },
  heroSub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', lineHeight: 21 },

  // Filtros: chips num trilho de vidro (o ativo fica em branco sólido)
  filtroRotulo: {
    fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.lilasTexto, letterSpacing: 1, textTransform: 'uppercase',
    paddingHorizontal: spacing.lg + 4, marginTop: spacing.md, marginBottom: 8,
  },
  trilho: {
    marginHorizontal: spacing.lg, borderRadius: radius.full, overflow: 'hidden',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  filtrosRow: { padding: 4, gap: 4 },
  filtroChip: {
    minHeight: 38, justifyContent: 'center', borderRadius: radius.full, paddingHorizontal: 14,
  },
  filtroChipIcone: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filtroChipAtivo: {
    backgroundColor: colors.escuro ? colors.lav2 : colors.cardSolido,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 1,
  },
  filtroChipTxt: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2 },
  filtroChipTxtAtivo: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
  notaFiltro: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, paddingHorizontal: spacing.lg + 4, marginTop: 6 },

  emptyBox: { alignItems: 'center', padding: spacing.xxl, gap: 10 },
  emptyIcone: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', lineHeight: 21 },

  lista: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  listaTitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2, marginBottom: 10, marginLeft: 4 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },

  // Cartão de vidro da parceria
  card: {
    backgroundColor: colors.card, borderRadius: 24,
    borderWidth: 1, borderColor: colors.bordaLuz,
    padding: 16, marginBottom: 12, gap: 10,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  cardGrade: { marginBottom: 0, flex: 1 },
  cardLinha: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  logo: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FFFFFF' },
  logoVazio: { backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  cardCorpo: { flex: 1, minWidth: 0, gap: 4 },
  cardTitulo: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21, color: colors.titulo },
  metaLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2 },
  meta: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.lilasTexto, maxWidth: '100%' },
  localTag: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  localTxt: { fontFamily: fonts.body, fontSize: 11.5, color: colors.texto2, flexShrink: 1 },
  cardDesc: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, lineHeight: 20 },
  verMais: { alignSelf: 'flex-start', marginTop: 4 },
  verMaisTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.lilasTexto },
  cardRodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingTop: 12, marginTop: 2, borderTopWidth: 1, borderTopColor: colors.bordaSuave,
  },
  tagCupom: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.douradoFundo, borderRadius: radius.full, paddingHorizontal: 11, paddingVertical: 6,
  },
  tagCupomTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.douradoTitulo },
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight: 42, paddingHorizontal: 18, overflow: 'hidden',
  },
  botaoGrad: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  botaoHalo: { shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 6 }, shadowOpacity: colors.escuro ? 0.4 : 0.26, shadowRadius: 10, elevation: 3 },
  botaoTxt: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: 'white' },

  modalFundo: { flex: 1, backgroundColor: colors.sobreposicao, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCaixa: {
    width: '100%', maxWidth: 420, backgroundColor: colors.cardSolido, borderRadius: 26, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 8,
  },
  modalTit: { fontFamily: fonts.serif, fontSize: 24, color: colors.titulo, marginBottom: spacing.sm },
  opcao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 50, borderBottomWidth: 1, borderBottomColor: colors.bordaSuave,
  },
  opcaoTxt: { fontFamily: fonts.body, fontSize: 15, color: colors.titulo },
  opcaoSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
  opcaoQtd: {
    fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.lilasTexto, backgroundColor: colors.lav1,
    borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden',
  },
  memoriaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22,
    backgroundColor: colors.joiaPessego[1], borderWidth: 1, borderColor: colors.bordaLuz,
  },
  memoriaIcone: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
  memoriaTit: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: colors.joiaPessegoTexto },
  memoriaSub: { fontFamily: 'Figtree_400Regular', fontSize: 13, color: colors.texto2, marginTop: 2 },
  cashbackLinha: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10,
    paddingVertical: 7, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.sageFundo,
  },
  cashbackTxt: { flex: 1, fontFamily: 'Figtree_700Bold', fontSize: 12.5, color: colors.sageFg },
  cashbackCond: { fontFamily: 'Figtree_500Medium', color: colors.sageFg },
}));
