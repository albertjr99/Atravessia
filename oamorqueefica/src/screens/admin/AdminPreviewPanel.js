import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, radius, criarEstilos } from '../../theme';

const PHONE_W = 238;
const PHONE_H = PHONE_W * 2.02;

// ── Preview widgets ──────────────────────────────────────────────────────────

function TravessiaPreview() {
  const [itens, setItens] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'travessiaItens'), orderBy('ordem', 'asc')),
      snap => setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.ativo !== false)),
      () => {}
    );
    return unsub;
  }, []);

  return (
    <View style={pw.section}>
      <View style={pw.sectionHeader}>
        <Ionicons name="compass-outline" size={12} color="#7A65CB" />
        <Text style={pw.sectionTitle}>Continue a Travessia</Text>
      </View>
      {itens.length === 0
        ? <Text style={pw.empty}>Nenhum item ativo ainda</Text>
        : itens.map(item => (
          <View key={item.id} style={pw.row}>
            <View style={pw.rowIcon}>
              <Ionicons name={item.icone || 'link-outline'} size={11} color="#7A65CB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={pw.rowTitle} numberOfLines={1}>{item.titulo}</Text>
              {item.descricao ? <Text style={pw.rowSub} numberOfLines={1}>{item.descricao}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={9} color="#8B7AC0" />
          </View>
        ))
      }
    </View>
  );
}

function FrasesPreview() {
  const [frase, setFrase] = useState(null);
  const [reflexao, setReflexao] = useState(null);
  useEffect(() => {
    const unsubF = onSnapshot(
      query(collection(db, 'frases'), orderBy('criadoEm', 'desc'), limit(1)),
      snap => { if (!snap.empty) setFrase(snap.docs[0].data()); },
      () => {}
    );
    const unsubR = onSnapshot(
      query(collection(db, 'reflexoes'), orderBy('criadoEm', 'desc'), limit(1)),
      snap => { if (!snap.empty) setReflexao(snap.docs[0].data()); },
      () => {}
    );
    return () => { unsubF(); unsubR(); };
  }, []);

  return (
    <View>
      <View style={pw.homeHeader}>
        <Text style={pw.homeGreet}>Olá, Carla ✨</Text>
        <Text style={pw.homeSubGreet}>Como você está hoje?</Text>
      </View>
      {frase && (
        <View style={pw.fraseCard}>
          <Text style={pw.fraseLabel}>FRASE DO DIA</Text>
          <Text style={pw.fraseTexto}>"{frase.texto}"</Text>
          {frase.autor ? <Text style={pw.fraseAutor}>— {frase.autor}</Text> : null}
        </View>
      )}
      {reflexao && (
        <View style={[pw.fraseCard, { marginTop: 6 }]}>
          <Text style={pw.fraseLabel}>REFLEXÃO</Text>
          <Text style={pw.reflexaoTexto} numberOfLines={4}>{reflexao.texto}</Text>
        </View>
      )}
      {!frase && !reflexao && <Text style={[pw.empty, { padding: 10 }]}>Nenhuma frase ou reflexão cadastrada</Text>}
    </View>
  );
}

const TIPO_ICON = {
  audio: 'headset-outline',
  video: 'videocam-outline',
  documento: 'document-text-outline',
  link: 'link-outline',
};

function AudiosPreview() {
  const [audios, setAudios] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'audiosAcolhimento'), orderBy('criadoEm', 'desc'), limit(5)),
      snap => setAudios(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return unsub;
  }, []);

  return (
    <View style={pw.section}>
      <View style={pw.sectionHeader}>
        <Ionicons name="musical-notes-outline" size={12} color="#7A65CB" />
        <Text style={pw.sectionTitle}>Áudios de Acolhimento</Text>
      </View>
      {audios.length === 0 && <Text style={pw.empty}>Nenhum áudio ainda</Text>}
      {audios.map(a => (
        <View key={a.id} style={pw.audioRow}>
          <View style={pw.audioPlay}>
            <Ionicons name="play" size={9} color="#fff" style={{ marginLeft: 1 }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={pw.rowTitle} numberOfLines={1}>{a.titulo || a.nome || '—'}</Text>
            {a.descricao ? <Text style={pw.rowSub} numberOfLines={1}>{a.descricao}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function VitoriasPreview() {
  const [vitorias, setVitorias] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'vitorias'), orderBy('criadoEm', 'desc'), limit(4)),
      snap => setVitorias(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return unsub;
  }, []);

  return (
    <View style={pw.section}>
      <View style={pw.sectionHeader}>
        <Ionicons name="star-outline" size={12} color="#7A65CB" />
        <Text style={pw.sectionTitle}>Pequenas Vitórias</Text>
      </View>
      {vitorias.length === 0 && <Text style={pw.empty}>Nenhuma vitória cadastrada</Text>}
      {vitorias.map(v => (
        <View key={v.id} style={pw.row}>
          <Ionicons name="star" size={10} color="#C9A15A" />
          <Text style={pw.rowTitle} numberOfLines={1}>{v.titulo || v.texto}</Text>
        </View>
      ))}
    </View>
  );
}

function DefaultPreview() {
  return (
    <View style={pw.defaultWrap}>
      <Ionicons name="eye-outline" size={26} color="#A595DC" />
      <Text style={pw.defaultTitle}>Prévia disponível</Text>
      <Text style={pw.defaultSub}>
        Módulos com prévia:{'\n\n'}
        ✦ Travessia{'\n'}
        ✦ Frases{'\n'}
        ✦ Conteúdos{'\n'}
        ✦ Áudios{'\n'}
        ✦ Vitórias
      </Text>
    </View>
  );
}

function PreviewContent({ screen }) {
  if (screen === 'AdminTravessia') return <TravessiaPreview />;
  if (screen === 'AdminFrases') return <FrasesPreview />;
  if (screen === 'AdminAudios') return <AudiosPreview />;
  if (screen === 'AdminVitorias') return <VitoriasPreview />;
  return <DefaultPreview />;
}

// ── Phone frame ──────────────────────────────────────────────────────────────

const NAV_TABS = [
  { icon: 'home', label: 'Início' },
  { icon: 'compass', label: 'Jornadas' },
  { icon: 'headset', label: 'Áudios' },
  { icon: 'person', label: 'Perfil' },
];

// Moldura de celular moderna (ilha no topo, cantos arredondados, barra de
// abas em cápsula). O celular da prévia é sempre claro, como o app aberto.
function PhoneFrame({ currentScreen, children }) {
  const activeTab = currentScreen === 'AdminAudios' ? 2
    : currentScreen === 'AdminTravessia' ? 1 : 0;

  return (
    <View style={ph.phone}>
      <View style={ph.tela}>
        {/* Aurora suave do app */}
        <LinearGradient
          pointerEvents="none"
          colors={['#E9E0FA', '#F6EDF0', '#F6F1EE']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Ilha */}
        <View style={ph.notch} />
        {/* Status bar */}
        <View style={ph.statusBar}>
          <Text style={ph.statusTime}>9:41</Text>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            <Ionicons name="cellular" size={8} color="#2A2433" />
            <Ionicons name="wifi" size={8} color="#2A2433" />
            <Ionicons name="battery-full" size={8} color="#2A2433" />
          </View>
        </View>
        {/* App bar */}
        <View style={ph.appBar}>
          <Text style={ph.appBarTitle}>Atravessia</Text>
        </View>
        {/* Screen content */}
        <ScrollView style={ph.screen} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {/* Bottom nav */}
        <View style={ph.bottomNav}>
          {NAV_TABS.map((tab, i) => (
            <View key={tab.label} style={ph.navTab}>
              <View style={[ph.navIcone, i === activeTab && ph.navIconeAtivo]}>
                <Ionicons
                  name={i === activeTab ? tab.icon : `${tab.icon}-outline`}
                  size={12}
                  color={i === activeTab ? '#5A46AD' : '#8C849A'}
                />
              </View>
              <Text style={[ph.navLabel, i === activeTab && ph.navLabelAtivo]}>{tab.label}</Text>
            </View>
          ))}
        </View>
        {/* Home indicator */}
        <View style={ph.homeIndicator} />
      </View>
    </View>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

export default function AdminPreviewPanel({ currentScreen }) {
  return (
    <View style={s.panel}>
      <View style={s.header}>
        <View style={s.dot} />
        <Text style={s.headerLabel}>Prévia • Tempo real</Text>
      </View>

      <PhoneFrame currentScreen={currentScreen}>
        <PreviewContent screen={currentScreen} />
      </PhoneFrame>

      <Text style={s.hint}>Edições refletem automaticamente</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

// O painel acompanha o tema (vidro flutuante); o celular da prévia continua claro.
const s = criarEstilos(() => ({
  panel: {
    width: 300,
    marginTop: 10,
    marginBottom: 10,
    marginRight: 10,
    backgroundColor: colors.escuro ? colors.card : colors.vidro,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.bordaLuz,
    shadowColor: colors.sombra,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: colors.escuro ? 0.3 : 0.11,
    shadowRadius: 20,
    elevation: 2,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    marginBottom: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3E7A55',
    borderWidth: 2,
    borderColor: 'rgba(62,122,85,0.25)',
  },
  headerLabel: {
    fontFamily: 'Figtree_800ExtraBold',
    fontSize: 12,
    color: colors.lilasTexto,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  hint: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.tl,
    textAlign: 'center',
    marginTop: 14,
  },
}), { escalar: false });

const ph = StyleSheet.create({
  phone: {
    width: PHONE_W,
    height: PHONE_H,
    borderRadius: 40,
    padding: 6,
    backgroundColor: '#1A1426',
    borderWidth: 1,
    borderColor: '#4A3F63',
    shadowColor: '#2A1D55',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 6,
  },
  tela: {
    flex: 1,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: '#F6F1EE',
  },
  notch: {
    position: 'absolute',
    top: 7,
    alignSelf: 'center',
    width: 64,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#0F0B16',
    zIndex: 2,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 9,
    height: 30,
  },
  statusTime: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    color: '#2A2433',
  },
  appBar: {
    paddingTop: 2,
    paddingBottom: 6,
    alignItems: 'center',
  },
  appBarTitle: {
    fontFamily: 'Marca',
    fontSize: 17,
    color: '#45358A',
  },
  screen: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    marginHorizontal: 8,
    marginBottom: 2,
    paddingVertical: 5,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#3A286E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  navIcone: {
    width: 28,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconeAtivo: {
    backgroundColor: '#ECE6FA',
  },
  navLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 6.5,
    color: '#8C849A',
  },
  navLabelAtivo: {
    fontFamily: fonts.bodyBold,
    color: '#5A46AD',
  },
  homeIndicator: {
    height: 4,
    width: 64,
    backgroundColor: '#2A2433',
    opacity: 0.8,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 5,
  },
});

const pw = StyleSheet.create({
  section: { padding: 9 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: '#524197',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  homeHeader: {
    padding: 10,
    paddingBottom: 4,
  },
  homeGreet: {
    fontFamily: 'Marca',
    fontSize: 15,
    color: '#2A2433',
  },
  homeSubGreet: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: '#534C60',
    marginTop: 1,
  },
  fraseCard: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 14,
    padding: 10,
    marginHorizontal: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#3A286E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  fraseLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 7,
    color: '#524197',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  fraseTexto: {
    fontFamily: 'TituloLeve',
    fontSize: 11,
    color: '#2A2433',
    lineHeight: 15,
  },
  fraseAutor: {
    fontFamily: fonts.body,
    fontSize: 7,
    color: '#6F6880',
    marginTop: 4,
  },
  reflexaoTexto: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: '#2A2433',
    lineHeight: 13,
    textAlign: 'justify',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 12,
    padding: 7,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  rowIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: '#ECE6FA',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: '#2A2433',
  },
  rowSub: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: '#534C60',
    marginTop: 1,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 12,
    padding: 7,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  audioPlay: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7A65CB',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: '#6F6880',
    fontStyle: 'italic',
  },
  defaultWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingTop: 36,
    gap: 8,
  },
  defaultTitle: {
    fontFamily: 'Titulo',
    fontSize: 16,
    color: '#2A2433',
    marginTop: 4,
  },
  defaultSub: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: '#534C60',
    textAlign: 'center',
    lineHeight: 18,
  },
});
