import React, { useEffect, useState } from 'react';
import { pareceNome, primeiroNome } from '../../utils/nome';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, collectionGroup, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import AdminLayout from './AdminLayout';
import { useAuth } from '../../hooks/AuthContext';
import { est, acento, F_NUM, Pilula } from './adminEstilo';

// "Bom dia, Larissa" — saudação pelo horário de Brasília e primeiro nome.
function saudacaoAdmin(nome) {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false })) % 24;
  const periodo = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiro = String(nome || '').trim().split(/\s+/)[0];
  return primeiro ? `${periodo}, ${primeiro}` : periodo;
}

const hojeStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

const normalizarPlano = (p) => {
  if (typeof p === 'number') return p;
  return ({ perceber: 0, acolher: 1, compreender: 2, evoluir: 3 })[String(p || '').toLowerCase()] ?? 0;
};

export default function AdminHomeScreen({ navigation }) {
  const { perfil } = useAuth();
  const { width } = useWindowDimensions();
  const largo = width >= 700;
  const [stats, setStats] = useState({ usuarias: 0, checkinsHoje: 0, porPlano: {} });
  const [conteudo, setConteudo] = useState({ conteudos: 0, audios: 0, parcerias: 0 });
  const [carregando, setCarregando] = useState(true);
  const [erroCheckins, setErroCheckins] = useState(false);

  useEffect(() => {
    const unsubs = [];

    // Cada assinatura é independente: antes, uma única consulta que falhava
    // (a de check-ins) impedia o setStats e zerava TODOS os indicadores.
    unsubs.push(onSnapshot(collection(db, 'usuarios'), snap => {
      const reais = snap.docs.map(d => d.data()).filter(u => u.role !== 'admin');
      const porPlano = {};
      reais.forEach(u => {
        const p = u.acessoTotal ? 3 : normalizarPlano(u.plano);
        porPlano[p] = (porPlano[p] || 0) + 1;
      });
      setStats(s => ({ ...s, usuarias: reais.length, porPlano }));
      setCarregando(false);
    }, () => setCarregando(false)));

    unsubs.push(onSnapshot(collectionGroup(db, 'checkins'), snap => {
      const hoje = hojeStr();
      let n = 0;
      snap.forEach(d => { if (d.data().data === hoje) n++; });
      setStats(s => ({ ...s, checkinsHoje: n }));
      setErroCheckins(false);
    }, () => setErroCheckins(true)));

    const cols = [['conteudos', 'conteudos'], ['audios', 'audiosAcolhimento'], ['parcerias', 'parcerias']];
    for (const [chave, col] of cols) {
      unsubs.push(onSnapshot(collection(db, col),
        snap => setConteudo(c => ({ ...c, [chave]: snap.size })),
        () => {}
      ));
    }

    return () => unsubs.forEach(u => u());
  }, []);

  const mostrar = (v) => (carregando ? '—' : v);

  // Os mesmos 7 números de antes: um cartão-herói (usuárias + recorte por
  // plano) e quatro números compactos.
  const recorte = [
    { icon: 'leaf-outline', acento: 'salvia', value: stats.porPlano[0] || 0, label: 'Perceber (grátis)' },
    { icon: 'diamond-outline', acento: 'lilas', value: stats.porPlano[1] || 0, label: 'Acolher (pago)' },
  ];
  const tiles = [
    { icon: 'heart-outline', acento: 'rosa', value: erroCheckins ? '—' : stats.checkinsHoje, label: 'check-ins hoje' },
    { icon: 'albums-outline', acento: 'lilas', value: conteudo.conteudos, label: 'conteúdos publicados' },
    { icon: 'musical-notes-outline', acento: 'nevoa', value: conteudo.audios, label: 'áudios de check-in' },
    { icon: 'gift-outline', acento: 'pessego', value: conteudo.parcerias, label: 'parcerias ativas' },
  ];

  const atalhos = [
    { icon: 'musical-notes-outline', label: 'Áudios Check-in', sub: 'Áudios de acolhimento por emoção', screen: 'AdminAudios', acento: 'nevoa' },
    { icon: 'megaphone-outline', label: 'Notificações', sub: 'Publique avisos para as usuárias', screen: 'AdminNotificacoes', acento: 'pessego' },
    { icon: 'people-outline', label: 'Usuárias', sub: 'Gerencie planos e acessos', screen: 'AdminUsuarias', acento: 'salvia' },
    { icon: 'bar-chart-outline', label: 'Relatórios', sub: 'Dados de engajamento', screen: 'AdminRelatorios', acento: 'dourado' },
    { icon: 'gift-outline', label: 'Parcerias', sub: 'Gerencie banners e benefícios exclusivos', screen: 'AdminParcerias', acento: 'pessego' },
  ];

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminHome">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, largo && s.scrollLargo]}>

        <View style={s.pageHeader}>
          <Text style={s.sobretitulo}>Dashboard</Text>
          <Text style={[s.pageTitle, largo && s.pageTitleLargo]}>{saudacaoAdmin(pareceNome(perfil?.apelido) ? perfil.apelido : primeiroNome(perfil?.nome))}</Text>
          <Text style={s.pageSub}>Bem-vinda ao painel Atravessia</Text>
        </View>

        {erroCheckins && (
          <View style={s.avisoBox}>
            <Ionicons name="alert-circle-outline" size={18} color={acento('dourado').texto} />
            <Text style={s.avisoTxt}>
              Não foi possível ler os check-ins. Publique as regras do Firestore
              (firebase deploy --only firestore:rules) para liberar esse indicador.
            </Text>
          </View>
        )}

        {/* Herói: usuárias cadastradas + recorte por plano */}
        <View style={[s.heroi, largo && s.heroiLargo]}>
          <View style={[s.heroiEsq, largo && s.heroiEsqLargo]}>
            <Pilula icone="people-outline" nome="lilas" tam={46} tamIcone={22} />
            <View style={largo ? { flex: 1 } : null}>
              <Text style={s.heroiNum}>{mostrar(stats.usuarias)}</Text>
              <Text style={s.heroiRot}>usuárias cadastradas</Text>
            </View>
          </View>
          <View style={largo ? s.recorteLargo : s.recorte}>
            {recorte.map(t => (
              <View key={t.label} style={[s.mini, largo ? s.miniLargo : s.miniFlex]}>
                <Pilula icone={t.icon} nome={t.acento} tam={34} tamIcone={17} />
                <View style={{ flexShrink: 1 }}>
                  <Text style={s.miniNum}>{mostrar(t.value)}</Text>
                  <Text style={s.miniRot}>{t.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Números compactos */}
        <View style={s.bento}>
          {tiles.map(t => (
            <View key={t.label} style={[s.tile, largo && s.tileLargo]}>
              <View style={s.tileLinha}>
                <Pilula icone={t.icon} nome={t.acento} tam={42} tamIcone={20} />
                <Text style={s.tileNum} numberOfLines={1} adjustsFontSizeToFit>{mostrar(t.value)}</Text>
              </View>
              <Text style={s.tileRot} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{t.label}</Text>
            </View>
          ))}
        </View>

        {/* Gestão do sistema: lista agrupada num só vidro */}
        <Text style={s.sectionTitle}>Gestão do sistema</Text>
        <View style={s.lista}>
          {atalhos.map((item, i) => (
            <TouchableOpacity
              key={item.screen}
              style={[s.atalho, i > 0 && s.atalhoDiv]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Pilula icone={item.icon} nome={item.acento} tam={42} tamIcone={20} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.atalhoLabel}>{item.label}</Text>
                <Text style={s.atalhoSub}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.tl} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 48 },
  scrollLargo: { paddingHorizontal: 28, paddingTop: 26 },
  pageHeader: { marginBottom: 18, paddingHorizontal: 4 },
  sobretitulo: { ...est.sobretitulo(), fontFamily: 'Figtree_800ExtraBold', letterSpacing: 1.8 },
  pageTitle: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 42, color: colors.titulo, marginTop: 2 },
  pageTitleLargo: { fontSize: 40, lineHeight: 46 },
  pageSub: { ...est.subtitulo(), fontSize: 15.5 },
  avisoBox: { ...est.aviso('dourado'), marginBottom: spacing.md },
  avisoTxt: est.avisoTxt('dourado'),

  // Herói
  heroi: {
    ...est.vidro(28),
    ...est.sombraForte(),
    flexDirection: 'row', gap: 12, padding: 16,
  },
  heroiLargo: { padding: 20, alignItems: 'center', gap: 16 },
  heroiEsq: { flex: 1, minWidth: 0, justifyContent: 'space-between', gap: 18, paddingLeft: 2 },
  heroiEsqLargo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 16 },
  heroiNum: { fontFamily: F_NUM, fontSize: 56, lineHeight: 60, letterSpacing: -1.8, color: colors.titulo },
  heroiRot: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20, color: colors.texto2, marginTop: 2 },
  recorte: { width: 172, gap: 8 },
  recorteLargo: { flexDirection: 'row', gap: 12 },
  miniFlex: { flex: 1 },
  mini: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 11, borderRadius: 18,
    backgroundColor: colors.vidroTenue, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  miniLargo: { width: 210, paddingVertical: 14, paddingHorizontal: 14 },
  miniNum: { fontFamily: F_NUM, fontSize: 21, lineHeight: 25, color: colors.titulo },
  miniRot: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 17, color: colors.texto2 },

  // Números compactos
  bento: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  tile: {
    ...est.vidro(22),
    flexBasis: '46%', flexGrow: 1, gap: 12,
    paddingTop: 14, paddingBottom: 16, paddingHorizontal: 14,
  },
  tileLargo: { flexBasis: '22%' },
  tileLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tileNum: { flexShrink: 1, fontFamily: F_NUM, fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: colors.titulo, textAlign: 'right' },
  tileRot: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.texto2 },

  // Gestão do sistema
  sectionTitle: { ...est.secao(), marginTop: 26, marginBottom: 10, paddingHorizontal: 4 },
  lista: { ...est.vidro(28), backgroundColor: colors.escuro ? colors.card : colors.vidroForte, paddingVertical: 4 },
  atalho: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 16 },
  atalhoDiv: est.divisoria(),
  atalhoLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo },
  atalhoSub: { fontFamily: fonts.bodyMedium, fontSize: 13.5, lineHeight: 18, color: colors.texto2, marginTop: 2 },
}), { escalar: false });
