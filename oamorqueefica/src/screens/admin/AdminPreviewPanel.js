import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, radius } from '../../theme';

const PHONE_W = 238;
const PHONE_H = PHONE_W * 1.95;

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
        <Ionicons name="compass-outline" size={12} color={colors.lav5} />
        <Text style={pw.sectionTitle}>Continue a Travessia</Text>
      </View>
      {itens.length === 0
        ? <Text style={pw.empty}>Nenhum item ativo ainda</Text>
        : itens.map(item => (
          <View key={item.id} style={pw.row}>
            <View style={pw.rowIcon}>
              <Ionicons name={item.icone || 'link-outline'} size={11} color={colors.lav5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={pw.rowTitle} numberOfLines={1}>{item.titulo}</Text>
              {item.descricao ? <Text style={pw.rowSub} numberOfLines={1}>{item.descricao}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={9} color={colors.lav4} />
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

function ConteudosPreview() {
  const [itens, setItens] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'conteudos'), orderBy('criadoEm', 'desc'), limit(6)),
      snap => setItens(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return unsub;
  }, []);

  return (
    <View style={pw.section}>
      <View style={pw.sectionHeader}>
        <Ionicons name="headset-outline" size={12} color={colors.lav5} />
        <Text style={pw.sectionTitle}>Conteúdos</Text>
      </View>
      {itens.length === 0 && <Text style={pw.empty}>Nenhum conteúdo ainda</Text>}
      {itens.map(item => (
        <View key={item.id} style={pw.row}>
          <View style={pw.rowIcon}>
            <Ionicons name={TIPO_ICON[item.tipo] || 'document-outline'} size={11} color={colors.lav5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={pw.rowTitle} numberOfLines={2}>{item.titulo}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

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
        <Ionicons name="musical-notes-outline" size={12} color={colors.lav5} />
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
        <Ionicons name="star-outline" size={12} color={colors.lav5} />
        <Text style={pw.sectionTitle}>Pequenas Vitórias</Text>
      </View>
      {vitorias.length === 0 && <Text style={pw.empty}>Nenhuma vitória cadastrada</Text>}
      {vitorias.map(v => (
        <View key={v.id} style={pw.row}>
          <Ionicons name="star" size={10} color="#D4A857" />
          <Text style={pw.rowTitle} numberOfLines={1}>{v.titulo || v.texto}</Text>
        </View>
      ))}
    </View>
  );
}

function DefaultPreview() {
  return (
    <View style={pw.defaultWrap}>
      <Ionicons name="eye-outline" size={26} color={colors.lav3} />
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
  if (screen === 'AdminConteudos') return <ConteudosPreview />;
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

function PhoneFrame({ currentScreen, children }) {
  const activeTab = currentScreen === 'AdminConteudos' || currentScreen === 'AdminAudios' ? 2
    : currentScreen === 'AdminTravessia' ? 1 : 0;

  return (
    <View style={ph.phone}>
      {/* Notch */}
      <View style={ph.notch} />
      {/* Status bar */}
      <View style={ph.statusBar}>
        <Text style={ph.statusTime}>9:41</Text>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          <Ionicons name="cellular" size={8} color="#555" />
          <Ionicons name="wifi" size={8} color="#555" />
          <Ionicons name="battery-full" size={8} color="#555" />
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
            <Ionicons
              name={i === activeTab ? tab.icon : `${tab.icon}-outline`}
              size={14}
              color={i === activeTab ? colors.lav5 : '#bbb'}
            />
            <Text style={[ph.navLabel, i === activeTab && { color: colors.lav5 }]}>{tab.label}</Text>
          </View>
        ))}
      </View>
      {/* Home indicator */}
      <View style={ph.homeIndicator} />
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

const s = StyleSheet.create({
  panel: {
    width: 292,
    backgroundColor: '#EDE8F5',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  headerLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.lav5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.tl,
    textAlign: 'center',
    marginTop: 12,
  },
});

const ph = StyleSheet.create({
  phone: {
    width: PHONE_W,
    height: PHONE_H,
    backgroundColor: '#fff',
    borderRadius: 30,
    borderWidth: 7,
    borderColor: '#1E1830',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  notch: {
    width: 60,
    height: 6,
    backgroundColor: '#1E1830',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 1,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: '#FAF7F4',
  },
  statusTime: {
    fontFamily: fonts.bodyBold,
    fontSize: 7,
    color: '#333',
  },
  appBar: {
    paddingVertical: 7,
    backgroundColor: '#FAF7F4',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  appBarTitle: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 13,
    color: colors.lav6,
  },
  screen: {
    flex: 1,
    backgroundColor: '#FAF7F4',
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#fff',
    paddingVertical: 4,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  navLabel: {
    fontFamily: fonts.body,
    fontSize: 6,
    color: '#bbb',
  },
  homeIndicator: {
    height: 3,
    width: 56,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 4,
  },
});

const pw = StyleSheet.create({
  section: { padding: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.td,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  homeHeader: {
    padding: 10,
    paddingBottom: 4,
    backgroundColor: '#FAF7F4',
  },
  homeGreet: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.td,
  },
  homeSubGreet: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.tm,
    marginTop: 1,
  },
  fraseCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 9,
    marginHorizontal: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fraseLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 7,
    color: colors.lav5,
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  fraseTexto: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 9,
    color: colors.td,
    lineHeight: 14,
  },
  fraseAutor: {
    fontFamily: fonts.body,
    fontSize: 7,
    color: colors.tl,
    marginTop: 4,
  },
  reflexaoTexto: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.td,
    lineHeight: 13,
    textAlign: 'justify',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.lav1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.td,
  },
  rowSub: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: colors.tm,
    marginTop: 1,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  audioPlay: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.lav4,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.tl,
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
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.td,
    marginTop: 4,
  },
  defaultSub: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.tl,
    textAlign: 'center',
    lineHeight: 18,
  },
});
