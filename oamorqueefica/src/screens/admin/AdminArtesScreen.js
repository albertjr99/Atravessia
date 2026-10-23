import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image, Switch, Share, Linking, Alert,
  ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteObject, ref as refStorage } from 'firebase/storage';
import { db, functions, storage } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import AdminLayout from './AdminLayout';
import { est, acento, Degrade, BotaoAdmin } from './adminEstilo';
import { confirmar } from '../../utils/confirm';
import {
  FORMATOS_ARTE, ESTILOS_ARTE, IDEIAS_ARTE, PROVEDORES_ARTE,
  rotuloFormato, rotuloEstilo, rotuloProvedor, mensagemErroArte,
} from '../../config/artes';

// Atravessia Artes no painel do app: descrever, escolher formato e estilo,
// gerar (Cloud Function `gerarArte`) e cuidar da galeria (coleção `artes`).
// O compositor (texto + logotipo) fica no painel web. Para baixar e
// compartilhar, o app abre o link da imagem (Linking) ou envia o link pelo
// compartilhamento do sistema — expo-file-system não está no package.json.

const proporcaoDe = (formato) => {
  const p = FORMATOS_ARTE.find(f => f.id === formato)?.proporcao || [1, 1];
  return p[0] / p[1];
};

function abrirImagem(url) {
  if (Platform.OS === 'web') { window.open(url, '_blank', 'noopener'); return; }
  Linking.openURL(url).catch(() => Alert.alert('', 'Não foi possível abrir a imagem.'));
}

function compartilhar(arte) {
  Share.share(
    Platform.OS === 'ios'
      ? { url: arte.url, message: arte.prompt || '' }
      : { message: arte.url, title: 'Arte da Atravessia' },
  ).catch(() => {});
}

function Configuracao({ status, aoSalvar }) {
  const [cfg, setCfg] = useState({ provedor: 'openai', ativo: true });
  const [salvando, setSalvando] = useState(false);
  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'artes'), (snap) => {
    const d = snap.data() || {};
    setCfg(prev => ({ ...prev, ...d, ativo: d.ativo !== false }));
  }, () => {}), []);

  const salvar = async () => {
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'artes'), {
        provedor: cfg.provedor === 'gemini' ? 'gemini' : 'openai',
        ativo: !!cfg.ativo,
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      aoSalvar?.();
      Alert.alert('', 'Configuração do gerador salva.');
    } catch (e) {
      Alert.alert('Erro', `Não foi possível salvar.${e?.message ? `\n${e.message}` : ''}`);
    }
    setSalvando(false);
  };

  return (
    <View style={s.cartao}>
      <Text style={s.cartaoTit}>Configuração do gerador</Text>
      <Text style={s.dica}>Escolha qual serviço de IA cria as artes. A chave da API fica guardada no servidor, nunca no app.</Text>
      <View style={{ gap: 8, marginTop: 10 }}>
        {PROVEDORES_ARTE.map(p => {
          const sel = cfg.provedor === p.id;
          const ok = status?.conectados?.[p.id];
          return (
            <TouchableOpacity key={p.id} style={[s.opcao, sel && s.opcaoSel]} onPress={() => setCfg(c => ({ ...c, provedor: p.id }))} activeOpacity={0.85}>
              <Ionicons name={sel ? 'radio-button-on' : 'radio-button-off'} size={20} color={sel ? colors.lilasTexto : colors.tl} />
              <View style={{ flex: 1 }}>
                <Text style={s.opcaoNome}>{p.rotulo}</Text>
                <Text style={s.opcaoDet}>{p.detalhe}</Text>
              </View>
              <View style={[s.selo, { backgroundColor: acento(ok ? 'salvia' : 'dourado').fundo }]}>
                <Text style={[s.seloTxt, { color: acento(ok ? 'salvia' : 'dourado').texto }]}>{ok ? 'Chave configurada' : 'Sem chave ainda'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.linhaSwitch}>
        <Text style={s.switchTxt}>{cfg.ativo ? 'Gerador ligado' : 'Gerador desligado'}</Text>
        <Switch value={!!cfg.ativo} onValueChange={v => setCfg(c => ({ ...c, ativo: v }))} trackColor={{ true: colors.lav4 }} />
      </View>
      <BotaoAdmin title={salvando ? 'Salvando…' : 'Salvar configuração'} icone="checkmark" onPress={salvar} disabled={salvando} />
    </View>
  );
}

function CartaoArte({ arte, onReusar, onFavoritar, onExcluir }) {
  return (
    <View style={s.arte}>
      <TouchableOpacity onPress={() => abrirImagem(arte.url)} activeOpacity={0.9}>
        <Image source={{ uri: arte.url }} style={[s.arteImg, { aspectRatio: proporcaoDe(arte.formato) }]} resizeMode="cover" />
        {arte.favorita && (
          <View style={s.favSelo}><Ionicons name="heart" size={13} color={acento('rosa').tinta} /></View>
        )}
      </TouchableOpacity>
      <View style={s.arteCorpo}>
        <Text style={s.artePrompt} numberOfLines={2}>{arte.prompt}</Text>
        <Text style={s.arteMeta} numberOfLines={1}>
          {[rotuloFormato(arte.formato), arte.estilo && rotuloEstilo(arte.estilo), rotuloProvedor(arte.provedor)].filter(Boolean).join(' · ')}
        </Text>
        <View style={s.arteAcoes}>
          <TouchableOpacity style={s.acao} onPress={() => abrirImagem(arte.url)} accessibilityLabel="Abrir e baixar">
            <Ionicons name="download-outline" size={18} color={colors.lilasTexto} />
          </TouchableOpacity>
          <TouchableOpacity style={s.acao} onPress={() => compartilhar(arte)} accessibilityLabel="Compartilhar">
            <Ionicons name="share-social-outline" size={18} color={colors.lilasTexto} />
          </TouchableOpacity>
          {arte.provedor !== 'compositor' && (
            <TouchableOpacity style={s.acao} onPress={() => onReusar(arte)} accessibilityLabel="Reusar descrição">
              <Ionicons name="refresh-outline" size={18} color={colors.lilasTexto} />
            </TouchableOpacity>
          )}
          {onFavoritar && (
            <TouchableOpacity style={s.acao} onPress={() => onFavoritar(arte)} accessibilityLabel="Favoritar">
              <Ionicons name={arte.favorita ? 'heart' : 'heart-outline'} size={18} color={arte.favorita ? acento('rosa').tinta : colors.lilasTexto} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.acao} onPress={() => onExcluir(arte)} accessibilityLabel="Excluir">
            <Ionicons name="trash-outline" size={18} color={colors.roseTexto} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function AdminArtesScreen() {
  const scrollRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [verConfig, setVerConfig] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [formato, setFormato] = useState('post');
  const [estilo, setEstilo] = useState('aquarela');
  const [quantidade, setQuantidade] = useState(1);
  const [usarPaleta, setUsarPaleta] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState([]);
  const [galeria, setGaleria] = useState(null);
  const [soFavoritas, setSoFavoritas] = useState(false);

  const carregarStatus = async () => {
    try {
      const r = await httpsCallable(functions, 'statusGeradorArtes')();
      setStatus(r.data);
    } catch {
      setStatus({ pronto: false, conectados: {} });
    }
  };
  useEffect(() => { carregarStatus(); }, []);

  useEffect(() => onSnapshot(
    query(collection(db, 'artes'), orderBy('criadoEm', 'desc'), limit(80)),
    snap => setGaleria(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    () => setGaleria([]),
  ), []);

  const visiveis = useMemo(() => (galeria || []).filter(a => !soFavoritas || a.favorita), [galeria, soFavoritas]);
  const naoConectado = status && !status.pronto;

  const gerar = async () => {
    if (prompt.trim().length < 3) { Alert.alert('', 'Descreva a arte que você quer criar.'); return; }
    setGerando(true); setErro(null); setResultado([]);
    try {
      const r = await httpsCallable(functions, 'gerarArte', { timeout: 300000 })({
        prompt: prompt.trim(), formato, estilo, usarPaletaMarca: usarPaleta, quantidade,
      });
      setResultado(r.data?.artes || []);
    } catch (e) {
      const m = mensagemErroArte(e);
      setErro(m);
      if (m.naoConectado) setStatus(st => ({ ...(st || {}), pronto: false }));
    }
    setGerando(false);
  };

  const reusar = (a) => {
    setPrompt(a.prompt || '');
    if (a.formato) setFormato(a.formato);
    if (a.estilo) setEstilo(a.estilo);
    if (typeof a.usarPaletaMarca === 'boolean') setUsarPaleta(a.usarPaletaMarca);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const favoritar = (a) => {
    updateDoc(doc(db, 'artes', a.id), { favorita: !a.favorita })
      .catch(e => Alert.alert('Erro', e?.message || 'Não foi possível atualizar.'));
  };

  const excluir = (a) => confirmar('Excluir arte', 'Ela sai da galeria e o arquivo é apagado. Não dá para desfazer.', async () => {
    try {
      await httpsCallable(functions, 'excluirArte')({ id: a.id });
    } catch {
      try {
        if (a.caminho) await deleteObject(refStorage(storage, a.caminho)).catch(() => {});
        await deleteDoc(doc(db, 'artes', a.id));
      } catch (e) {
        Alert.alert('Erro', e?.message || 'Não foi possível excluir.');
        return;
      }
    }
    setResultado(r => r.filter(x => x.id !== a.id));
  }, 'Excluir');

  return (
    <AdminLayout currentScreen="AdminArtes">
      <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.cabecalho}>
          <View style={s.iaIcone}><Degrade raio={14} /><Ionicons name="color-palette-outline" size={21} color="white" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.sobre}>Criação</Text>
            <Text style={s.title}>Atravessia Artes</Text>
            <Text style={s.sub}>Descreva a arte e a IA cria imagens no jeito da Atravessia: delicadas, acolhedoras e sem texto.</Text>
          </View>
        </View>

        {naoConectado && (
          <View style={est.aviso('lilas')}>
            <Ionicons name="information-circle-outline" size={20} color={acento('lilas').tinta} />
            <Text style={est.avisoTxt('lilas')}>
              <Text style={{ fontFamily: fonts.bodyBold }}>{status.ativo === false ? 'Gerador desligado. ' : 'Gerador ainda não conectado. '}</Text>
              {status.ativo === false
                ? 'Ligue-o na configuração para voltar a criar artes.'
                : 'Assim que a chave da API for configurada, ele passa a funcionar. A galeria continua disponível.'}
            </Text>
          </View>
        )}

        <TouchableOpacity style={s.linkConfig} onPress={() => setVerConfig(v => !v)}>
          <Ionicons name="options-outline" size={16} color={colors.lilasTexto} />
          <Text style={s.linkConfigTxt}>{verConfig ? 'Fechar configuração' : 'Configuração do gerador'}</Text>
        </TouchableOpacity>
        {verConfig && <Configuracao status={status} aoSalvar={carregarStatus} />}

        {/* Criar */}
        <View style={s.cartao}>
          <Text style={s.rotulo}>Descreva a arte</Text>
          <TextInput
            style={s.campo} multiline maxLength={1200} value={prompt} onChangeText={setPrompt}
            placeholder="Ex.: Uma folha de ginkgo sobre um fundo de aquarela lavanda, com espaço livre para uma frase."
            placeholderTextColor={colors.tl} textAlignVertical="top"
          />
          <Text style={s.dica}>As cores da marca e o “sem texto na imagem” já vão junto, automaticamente.</Text>

          <Text style={s.rotulo}>Ideias</Text>
          <View style={s.chips}>
            {IDEIAS_ARTE.map(i => (
              <TouchableOpacity key={i.rotulo} style={s.chip} onPress={() => { setPrompt(i.prompt); setFormato(i.formato); setEstilo(i.estilo); }}>
                <Text style={s.chipTxt}>{i.rotulo}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.rotulo}>Formato</Text>
          <View style={s.formatos}>
            {FORMATOS_ARTE.map(f => {
              const sel = formato === f.id;
              const r = f.proporcao[0] / f.proporcao[1];
              const w = Math.min(46, Math.round(30 * r));
              return (
                <TouchableOpacity key={f.id} style={[s.formato, sel && s.opcaoSel]} onPress={() => setFormato(f.id)} activeOpacity={0.85}>
                  <View style={s.propCaixa}><View style={[s.prop, { width: w, height: Math.round(w / r) }]} /></View>
                  <Text style={s.opcaoNome}>{f.rotulo}</Text>
                  <Text style={s.opcaoDet} numberOfLines={1}>{f.detalhe}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.rotulo}>Estilo</Text>
          <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
            {ESTILOS_ARTE.map(e => {
              const sel = estilo === e.id;
              return (
                <TouchableOpacity key={e.id} style={[s.estilo, sel && s.opcaoSel]} onPress={() => setEstilo(e.id)} activeOpacity={0.85}>
                  <View style={s.amostra}>
                    {e.cores.map(c => <View key={c} style={{ flex: 1, backgroundColor: c }} />)}
                  </View>
                  <Text style={s.opcaoNome}>{e.rotulo}</Text>
                  <Text style={s.opcaoDet} numberOfLines={3}>{e.descricao}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={s.rotulo}>Quantidade</Text>
          <View style={s.trilho}>
            {[1, 2, 3, 4].map(n => (
              <TouchableOpacity key={n} style={[s.aba, quantidade === n && s.abaSel]} onPress={() => setQuantidade(n)}>
                <Text style={[s.abaTxt, quantidade === n && s.abaTxtSel]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.linhaSwitch}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTxt}>Usar a paleta da marca</Text>
              <Text style={s.dica}>Lavanda, pêssego e sálvia em aquarela suave</Text>
            </View>
            <Switch value={usarPaleta} onValueChange={setUsarPaleta} trackColor={{ true: colors.lav4 }} />
          </View>

          <BotaoAdmin
            title={gerando ? 'Criando com cuidado…' : `Gerar ${quantidade > 1 ? `${quantidade} artes` : 'arte'}`}
            icone="sparkles" carregando={gerando} onPress={gerar}
            disabled={gerando || prompt.trim().length < 3}
          />
          {gerando && <Text style={[s.dica, { textAlign: 'center' }]}>Pode levar até um minuto.</Text>}
        </View>

        {!!erro && !gerando && (
          <View style={est.aviso(erro.naoConectado ? 'lilas' : 'rosa')}>
            <Ionicons name="alert-circle-outline" size={20} color={acento(erro.naoConectado ? 'lilas' : 'rosa').tinta} />
            <Text style={est.avisoTxt(erro.naoConectado ? 'lilas' : 'rosa')}>{erro.texto}</Text>
          </View>
        )}

        {resultado.length > 0 && (
          <>
            <Text style={s.secao}>Acabou de nascer</Text>
            <View style={s.grade}>
              {resultado.map(a => <CartaoArte key={a.id} arte={a} onReusar={reusar} onExcluir={excluir} />)}
            </View>
          </>
        )}

        {/* Galeria */}
        <View style={s.galeriaTopo}>
          <Text style={s.secao}>Galeria</Text>
          <TouchableOpacity style={[s.chip, soFavoritas && s.chipSel]} onPress={() => setSoFavoritas(v => !v)}>
            <Ionicons name={soFavoritas ? 'heart' : 'heart-outline'} size={15} color={soFavoritas ? colors.lilasTexto : colors.texto2} />
            <Text style={[s.chipTxt, soFavoritas && s.chipTxtSel]}>Favoritas</Text>
          </TouchableOpacity>
        </View>
        {galeria === null ? (
          <ActivityIndicator color={colors.lav4} style={{ marginTop: 20 }} />
        ) : visiveis.length === 0 ? (
          <View style={[est.aviso('neutro'), { justifyContent: 'center' }]}>
            <Text style={[est.avisoTxt('neutro'), { textAlign: 'center' }]}>
              {soFavoritas ? 'Nenhuma arte favorita por enquanto.' : 'As artes criadas aparecem aqui, guardadas para baixar e reusar quando quiser.'}
            </Text>
          </View>
        ) : (
          <View style={s.grade}>
            {visiveis.map(a => <CartaoArte key={a.id} arte={a} onReusar={reusar} onFavoritar={favoritar} onExcluir={excluir} />)}
          </View>
        )}
        <Text style={[s.dica, { textAlign: 'center' }]}>Para colocar frase e logotipo sobre a arte, use o compositor no painel web.</Text>
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48, gap: spacing.md },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iaIcone: { ...est.pilula(48), backgroundColor: colors.botaoForte },
  sobre: { ...est.sobretitulo(), marginBottom: 0 },
  title: est.titulo(),
  sub: est.subtitulo(),
  secao: { ...est.secao(), marginTop: 6 },
  cartao: { ...est.vidro(24), padding: 18, gap: 4 },
  cartaoTit: est.cartaoTitulo(),
  rotulo: est.rotulo(),
  campo: { ...est.campo(), minHeight: 110 },
  dica: est.dica(),
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipTxt: est.chipTxt(),
  chipTxtSel: est.chipTxtSel(),
  linkConfig: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  linkConfigTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  opcao: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.escuro ? colors.vidroTenue : colors.vidro,
  },
  opcaoSel: { borderColor: colors.lav4, backgroundColor: colors.lav1 },
  opcaoNome: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.titulo },
  opcaoDet: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.texto2 },
  selo: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  seloTxt: { fontFamily: fonts.bodyBold, fontSize: 11 },
  formatos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formato: {
    flexGrow: 1, flexBasis: '46%', padding: 10, borderRadius: 16, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.escuro ? colors.vidroTenue : colors.vidro,
  },
  propCaixa: { height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  prop: { borderRadius: 5, backgroundColor: colors.lav2, borderWidth: 1.5, borderColor: colors.lav4 },
  estilo: {
    width: 156, padding: 10, borderRadius: 16, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.escuro ? colors.vidroTenue : colors.vidro,
  },
  amostra: { flexDirection: 'row', height: 38, borderRadius: 10, overflow: 'hidden', marginBottom: 8 },
  trilho: est.trilho(),
  aba: { ...est.aba(), minWidth: 48 },
  abaSel: est.abaSel(),
  abaTxt: est.abaTxt(),
  abaTxtSel: est.abaTxtSel(),
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  switchTxt: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.td },
  galeriaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  arte: { ...est.vidro(20), flexGrow: 1, flexBasis: '45%', maxWidth: '100%', overflow: 'hidden' },
  arteImg: { width: '100%', backgroundColor: colors.lavVeu },
  favSelo: {
    position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardSolido,
  },
  arteCorpo: { padding: 10, gap: 4 },
  artePrompt: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.td },
  arteMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tl },
  arteAcoes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, ...est.divisoria(), paddingTop: 6 },
  acao: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
}), { escalar: false });
