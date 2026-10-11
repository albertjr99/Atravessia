import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, Image, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, criarEstilos } from '../../theme';
import { emocoes, audios as audiosEstaticos } from '../../data';
import { LavandaBg } from '../../components';
import BarraAbas, { ALTURA_BARRA } from '../../components/BarraAbas';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { situacaoCupom } from '../../utils/cupons';
import { hojeStrBR } from '../../utils/date';
import { carregarPreferencia, agendarLembretes } from '../../utils/lembreteCheckin';
import { montarDiarioDoDia } from '../../utils/diario';
import { carregarHistoricoSugestoes, escolherSugestao, camadasPorEmocao } from '../../utils/sugestoes';
import { urlDeImagem } from '../../utils/imagemUrl';
import { vibrarLeve } from '../../utils/vibrar';
import { brl } from '../cashback/CashbackScreen';

const lavanda = require('../../../assets/images/lavanda_left.png');
const ilAudio = require('../../../assets/images/il_audio_respiracao.png');
const ilJornada = require('../../../assets/images/il_caminho_jornada.png');
const ilLeitura = require('../../../assets/images/il_coracao_ramos.png');

// Emoções que aparecem direto no Início; as demais ficam em "Outras" (check-in).
const EMOCOES_INICIO = ['saudade', 'triste', 'sozinho', 'ansioso', 'tranquilo', 'grato', 'esperancoso'];
const ROTULO_CURTO = { saudade: 'Saudade', esperancoso: 'Esperança', sozinho: 'Sozinho' };
const TZ = 'America/Sao_Paulo';

const saudacao = () => {
  const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }));
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};
const dataHoje = () => {
  const t = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Tela inicial: um convite principal por vez (antes do check-in, registrar
// como está; depois, cuidar daquele sentimento), a palavra do dia, sugestões
// e o que ficou em andamento. O resto do app está nas abas.
export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const app = useApp();
  const {
    usuario, notificacoes, checkins, fraseDoDia, meusVouchers, cashback,
    conteudos, audiosAcolhimento, jornadasComProgresso, jornadasAdmin, temAcesso,
    jaLiberado, podeLiberarNovo, liberarConteudo,
  } = app;
  const { firebaseUser, perfil } = useAuth();
  const uid = firebaseUser?.uid;
  const [verReflexao, setVerReflexao] = useState(false);

  const naoLidas = notificacoes.filter(n => !n.lida).length;
  const cuponsPendentes = (meusVouchers || []).filter(v => {
    const sit = situacaoCupom(v);
    return sit === 'ativo' || sit === 'aguardando';
  }).length;
  const avisos = naoLidas + cuponsPendentes;

  const hoje = hojeStrBR();
  const checkinHoje = useMemo(
    () => [...checkins].reverse().find(c => String(c.data || '').slice(0, 10) === hoje) || null,
    [checkins, hoje],
  );
  const jaFezCheckinHoje = !!checkinHoje;
  const emocaoHoje = checkinHoje ? emocoes.find(e => e.id === checkinHoje.emocao) : null;

  // Lembrete diário: refeito sempre que o Início volta ao foco ou o check-in
  // de hoje chega — assim o lembrete de hoje some quando o check-in foi feito.
  const reagendarLembretes = useCallback(() => {
    if (!uid) return;
    carregarPreferencia(uid, perfil?.lembreteCheckin)
      .then(pref => (pref.ativo ? agendarLembretes(pref, jaFezCheckinHoje) : null))
      .catch(e => console.warn('[Lembrete] reagendar:', e?.message));
  }, [uid, perfil?.lembreteCheckin, jaFezCheckinHoje]);
  useFocusEffect(reagendarLembretes);
  useEffect(() => {
    if (jaFezCheckinHoje) reagendarLembretes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jaFezCheckinHoje]);

  // Progresso do dia (check-in, vitória, acolhimento — conforme o plano).
  const diario = useMemo(
    () => montarDiarioDoDia(app),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkins, app.vitorias, app.liberadoHoje, temAcesso, jornadasComProgresso],
  );
  const passosComCheck = diario.passos.filter(p => !p.opcional && !p.bloqueado);

  // Sugestões depois do check-in: as mesmas que o check-in mostrou hoje.
  const [historicoSug, setHistoricoSug] = useState([]);
  useFocusEffect(useCallback(() => {
    let vivo = true;
    carregarHistoricoSugestoes(uid, perfil?.sugestoesRecentes).then(h => { if (vivo) setHistoricoSug(h); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]));

  const audiosAtivos = useMemo(() => {
    const doPainel = (audiosAcolhimento || []).filter(a => a.ativo !== false);
    return doPainel.length > 0 ? doPainel : audiosEstaticos;
  }, [audiosAcolhimento]);
  const conteudosAtivos = useMemo(() => (conteudos || []).filter(c => c.ativo !== false), [conteudos]);

  const audioHoje = useMemo(() => {
    if (!emocaoHoje || emocaoHoje.positiva) return null;
    const acessiveis = audiosAtivos.filter(a => (a.plano || 0) <= 1 || temAcesso(a.plano || 0));
    return escolherSugestao(camadasPorEmocao(acessiveis, emocaoHoje.id), {
      historico: historicoSug, tipo: 'audio', emocao: emocaoHoje.id, hoje,
    });
  }, [emocaoHoje, audiosAtivos, historicoSug, hoje, temAcesso]);
  const conteudoHoje = useMemo(() => {
    if (!emocaoHoje) return null;
    return escolherSugestao(camadasPorEmocao(conteudosAtivos, emocaoHoje.id), {
      historico: historicoSug, tipo: 'conteudo', emocao: emocaoHoje.id, hoje,
    });
  }, [emocaoHoje, conteudosAtivos, historicoSug, hoje]);

  const ouvirAudio = (audio) => {
    if (!audio) return;
    if (!temAcesso(1)) {
      Alert.alert('Disponível no Plano Acolher', 'A reprodução dos áudios de acolhimento faz parte do Plano Acolher. Deseja conhecer os planos?', [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Ver planos', onPress: () => navigation.navigate('Planos') },
      ]);
      return;
    }
    if (jaLiberado(audio.id) || podeLiberarNovo('acolhimento')) {
      liberarConteudo(audio.id, 'acolhimento');
      navigation.navigate('AudioPlayer', { audio });
    } else {
      Alert.alert('', 'Você já ouviu seu áudio de acolhimento de hoje. Volte amanhã para um novo.');
    }
  };

  // Jornada em andamento, para "Continue de onde parou".
  const jornadaAndamento = useMemo(() => (jornadasComProgresso || []).find(j => {
    const total = j?.atividades?.length || 0;
    return j.atividadesConcluidas > 0 && j.atividadesConcluidas < total;
  }), [jornadasComProgresso]);

  // "Para você": um áudio, uma jornada e uma leitura.
  const paraVoce = useMemo(() => {
    const itens = [];
    const audio = audiosAtivos[0];
    if (audio) itens.push({ id: `a-${audio.id}`, tipo: 'ÁUDIO', detalhe: audio.duracao, titulo: audio.titulo, img: ilAudio, fundo: colors.douradoFundo, cor: colors.lav5, abrir: () => navigation.navigate('Audios') });
    const jornada = jornadaAndamento || (jornadasAdmin || [])[0] || (jornadasComProgresso || [])[0];
    if (jornada) itens.push({ id: `j-${jornada.id}`, tipo: 'JORNADA', titulo: jornada.titulo, img: ilJornada, fundo: colors.sageFundo, cor: colors.sageFg, abrir: () => navigation.navigate('Jornadas') });
    const leitura = conteudosAtivos[0];
    if (leitura) itens.push({ id: `c-${leitura.id}`, tipo: leitura.tipo === 'link' ? 'LINK' : 'LEITURA', titulo: leitura.titulo, img: urlDeImagem(leitura.imagemUrl) ? { uri: urlDeImagem(leitura.imagemUrl) } : ilLeitura, fundo: colors.roseFundo, cor: colors.roseTexto, abrir: () => navigation.navigate('Conteudo', { conteudo: leitura }) });
    return itens;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audiosAtivos, jornadaAndamento, jornadasAdmin, jornadasComProgresso, conteudosAtivos]);

  const temCarteira = cashback?.saldoCentavos > 0 || cuponsPendentes > 0;
  const inicial = (usuario.apelido || usuario.nome || 'A').trim().charAt(0).toUpperCase();
  const nome = usuario.apelido || (usuario.nome !== 'Você' ? usuario.nome : '');
  const proximo = diario.proximo && diario.proximo.id !== 'checkin' ? diario.proximo : null;

  const escolherEmocao = (id) => {
    vibrarLeve();
    navigation.navigate('CheckIn', { emocao: id });
  };

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: ALTURA_BARRA + Math.max(insets.bottom, 8) + 28 }}
      >
        <Image source={lavanda} style={[s.lavanda, { top: insets.top - 30, opacity: colors.escuro ? 0.18 : 0.45 }]} resizeMode="contain" />
        <View style={s.coluna}>

          {/* Saudação */}
          <View style={s.topo}>
            <TouchableOpacity
              style={s.avatar}
              onPress={() => navigation.navigate('PerfilUsuario')}
              activeOpacity={0.85}
              accessibilityLabel="Abrir seu perfil"
            >
              {perfil?.photoURL
                ? <Image source={{ uri: perfil.photoURL }} style={s.avatarImg} />
                : <Text style={s.avatarInicial}>{inicial}</Text>}
            </TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.data} numberOfLines={1}>{dataHoje()}</Text>
              <Text style={s.ola} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{saudacao()}{nome ? `, ${nome}` : ''}</Text>
            </View>
            <TouchableOpacity
              style={s.sino}
              onPress={() => navigation.navigate('Notificacoes')}
              accessibilityLabel={avisos > 0 ? `Avisos e cupons, ${avisos} novos` : 'Avisos e cupons'}
            >
              <Ionicons name={avisos > 0 ? 'notifications' : 'notifications-outline'} size={21} color={colors.titulo} />
              {avisos > 0 && (
                <View style={s.sinoSelo}><Text style={s.sinoSeloTxt}>{avisos > 9 ? '9+' : avisos}</Text></View>
              )}
            </TouchableOpacity>
          </View>

          {/* Cartão principal */}
          <View style={s.hero}>
            {passosComCheck.length > 0 && (
              <View style={s.diaLinha}>
                <Text style={s.diaRotulo}>Seu dia</Text>
                <View style={s.diaBarras}>
                  {passosComCheck.map(p => <View key={p.id} style={[s.diaBarra, p.feito && s.diaBarraFeita]} />)}
                </View>
                <Text style={s.diaRotulo}>{diario.feitos} de {diario.total}</Text>
              </View>
            )}

            {!emocaoHoje ? (
              <>
                <View style={{ gap: 4 }}>
                  <Text style={s.heroTit}>Como você está agora?</Text>
                  <Text style={s.heroSub}>Um toque já é um cuidado. Depois, sugerimos algo para este momento.</Text>
                </View>
                <View style={s.emoGrade}>
                  {EMOCOES_INICIO.map(id => emocoes.find(e => e.id === id)).filter(Boolean).map(e => (
                    <TouchableOpacity key={e.id} style={s.emoBtn} onPress={() => escolherEmocao(e.id)} activeOpacity={0.8} accessibilityLabel={e.label}>
                      <View style={[s.emoCirculo, { backgroundColor: e.bg }]}>
                        <Ionicons name={`${e.icon}-outline`} size={19} color={e.color} />
                      </View>
                      <Text style={s.emoTxt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{ROTULO_CURTO[e.id] || e.label}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[s.emoBtn, s.emoOutras]} onPress={() => navigation.navigate('CheckIn')} activeOpacity={0.8}>
                    <View style={[s.emoCirculo, { backgroundColor: colors.lav2 }]}>
                      <Ionicons name="ellipsis-horizontal" size={19} color={colors.lav5} />
                    </View>
                    <Text style={[s.emoTxt, { fontFamily: 'Lato_700Bold', color: colors.lav5 }]}>Outras</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={s.btnPrincipal} onPress={() => navigation.navigate('CheckIn')} activeOpacity={0.88}>
                  <Text style={s.btnPrincipalTxt}>Fazer check-in</Text>
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={s.hojeLinha}>
                  <View style={s.hojeIcone}>
                    <Ionicons name={`${emocaoHoje.icon}-outline`} size={24} color={emocaoHoje.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.hojeRotulo}>Seu check-in de hoje</Text>
                    <Text style={s.heroTit}>{emocaoHoje.label}</Text>
                  </View>
                  <TouchableOpacity onPress={() => navigation.navigate('CheckIn')} style={s.mudar} accessibilityLabel="Fazer outro check-in">
                    <Text style={s.link}>Mudar</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.heroSub}>
                  {emocaoHoje.positiva
                    ? 'Que bom sentir isso. Guarde este momento: ele também faz parte do caminho.'
                    : 'O que você sente faz sentido. Separamos cuidados para este momento.'}
                </Text>
                {audioHoje && (
                  <View style={s.sugestao}>
                    <Image source={ilAudio} style={s.sugestaoImg} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.tipo, { color: colors.lav5 }]}>ÁUDIO{audioHoje.duracao ? ` · ${String(audioHoje.duracao).toUpperCase()}` : ''}</Text>
                      <Text style={s.sugestaoTit} numberOfLines={2}>{audioHoje.titulo}</Text>
                    </View>
                    <TouchableOpacity style={s.play} onPress={() => ouvirAudio(audioHoje)} accessibilityLabel={`Ouvir ${audioHoje.titulo}`}>
                      <Ionicons name="play" size={17} color="#FFFFFF" style={{ marginLeft: 2 }} />
                    </TouchableOpacity>
                  </View>
                )}
                {conteudoHoje && (
                  <TouchableOpacity style={s.sugestao} onPress={() => navigation.navigate('Conteudo', { conteudo: conteudoHoje })} activeOpacity={0.85}>
                    <Image source={urlDeImagem(conteudoHoje.imagemUrl) ? { uri: urlDeImagem(conteudoHoje.imagemUrl) } : ilLeitura} style={s.sugestaoImg} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.tipo, { color: colors.roseTexto }]}>{conteudoHoje.tipo === 'link' ? 'LINK' : 'LEITURA'}</Text>
                      <Text style={s.sugestaoTit} numberOfLines={2}>{conteudoHoje.titulo}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.tl} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.verMais} onPress={() => navigation.navigate('Audios')}>
                  <Ionicons name="swap-horizontal" size={16} color={colors.lav5} />
                  <Text style={s.link}>Ver mais conteúdos</Text>
                </TouchableOpacity>
                {proximo && (
                  <View style={s.proximo}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.diaRotulo}>Próximo passo, se quiser</Text>
                      <Text style={s.proximoTit}>{proximo.titulo}</Text>
                    </View>
                    <TouchableOpacity style={s.btnContorno} onPress={() => navigation.navigate(proximo.rota)}>
                      <Ionicons name={proximo.icone} size={16} color={colors.lav5} />
                      <Text style={s.btnContornoTxt}>{proximo.acao}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Conversa no contexto do check-in */}
          {emocaoHoje && !emocaoHoje.positiva && (
            <TouchableOpacity style={s.cartao} onPress={() => navigation.navigate('ConversaIA')} activeOpacity={0.88}>
              <View style={s.iaLinha}>
                <View style={s.iaAvatar}><Ionicons name="sparkles" size={19} color={colors.lav5} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cartaoTit}>Quer conversar sobre isso?</Text>
                  <Text style={s.cartaoSub}>A AtravessIA está aqui para te ouvir.</Text>
                </View>
              </View>
              <View style={s.iaCampo}>
                <Text style={s.iaPlaceholder}>Escreva como você está...</Text>
                <View style={s.iaEnviar}><Ionicons name="arrow-up" size={16} color="#FFFFFF" /></View>
              </View>
            </TouchableOpacity>
          )}

          {/* Palavra do dia */}
          {!!fraseDoDia && (
            <View style={s.cartao}>
              <View style={s.rotuloLinha}>
                <Ionicons name="sunny-outline" size={14} color={colors.lav5} />
                <Text style={s.rotulo}>Palavra do dia</Text>
              </View>
              <Text style={s.frase}>“{fraseDoDia.texto}”</Text>
              {verReflexao && !!fraseDoDia.reflexao && <Text style={s.reflexao}>{fraseDoDia.reflexao}</Text>}
              <View style={s.fraseRodape}>
                <Text style={s.autor} numberOfLines={1}>{fraseDoDia.autor || 'Atravessia'}</Text>
                {!!fraseDoDia.reflexao && (
                  <TouchableOpacity onPress={() => setVerReflexao(v => !v)} style={s.lerReflexao}>
                    <Text style={s.link}>{verReflexao ? 'Recolher' : 'Ler a reflexão'}</Text>
                    <Ionicons name={verReflexao ? 'chevron-up' : 'chevron-forward'} size={15} color={colors.lav5} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Para você */}
          {paraVoce.length > 0 && (
            <>
              <View style={s.secaoCab}>
                <Text style={s.secaoTit}>Para você</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Explorar')} style={s.secaoLink}>
                  <Text style={s.link}>Ver tudo</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carrossel} style={s.carrosselCaixa}>
                {paraVoce.map(item => (
                  <TouchableOpacity key={item.id} style={s.mini} onPress={item.abrir} activeOpacity={0.88}>
                    <View style={[s.miniImgCaixa, { backgroundColor: item.fundo }]}>
                      <Image source={item.img} style={s.miniImg} resizeMode="contain" />
                    </View>
                    <View style={s.miniCorpo}>
                      <Text style={[s.tipo, { color: item.cor }]} numberOfLines={1}>{item.tipo}{item.detalhe ? ` · ${String(item.detalhe).toUpperCase()}` : ''}</Text>
                      <Text style={s.miniTit} numberOfLines={2}>{item.titulo}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Continue de onde parou */}
          {jornadaAndamento && (
            <TouchableOpacity style={[s.cartao, s.continuar]} onPress={() => navigation.navigate('Jornadas')} activeOpacity={0.88}>
              <View style={s.continuarIcone}><Ionicons name="footsteps-outline" size={22} color={colors.sageFg} /></View>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={[s.rotulo, { color: colors.sageFg }]}>Continue de onde parou</Text>
                <Text style={s.cartaoTit} numberOfLines={1}>{jornadaAndamento.titulo}</Text>
                <View style={s.progresso}>
                  <View style={[s.progressoCheio, { width: `${Math.round((jornadaAndamento.atividadesConcluidas / (jornadaAndamento.atividades.length || 1)) * 100)}%` }]} />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.tl} />
            </TouchableOpacity>
          )}

          {/* Carteira */}
          {temCarteira && (
            <TouchableOpacity
              style={s.carteira}
              onPress={() => navigation.navigate(cashback?.saldoCentavos > 0 ? 'Cashback' : 'MeusCupons')}
              activeOpacity={0.85}
            >
              <Ionicons name="wallet-outline" size={18} color={colors.sageFg} />
              <Text style={s.carteiraTxt} numberOfLines={1}>
                Carteira
                {cashback?.saldoCentavos > 0 ? <>: <Text style={{ fontFamily: 'Lato_700Bold' }}>{brl(cashback.saldoCentavos)}</Text> de cashback</> : ''}
                {cuponsPendentes > 0 ? ` · ${cuponsPendentes} ${cuponsPendentes === 1 ? 'cupom' : 'cupons'}` : ''}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.sageFg} />
            </TouchableOpacity>
          )}

          <Text style={s.aviso}>Este aplicativo oferece acolhimento e não substitui atendimento médico ou psicológico.</Text>
        </View>
      </ScrollView>
      <BarraAbas navigation={navigation} ativo="inicio" />
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  lavanda: { position: 'absolute', left: -26, width: 150, height: 190 },
  coluna: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16 },

  topo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingTop: 10 },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.lav1,
    borderWidth: 2, borderColor: colors.lav2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 52, height: 52 },
  avatarInicial: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 26, color: colors.lav5 },
  data: { fontFamily: 'Lato_700Bold', fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.lav5 },
  ola: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 31, lineHeight: 36, color: colors.titulo },
  sino: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.bordaSuave, alignItems: 'center', justifyContent: 'center',
  },
  sinoSelo: {
    position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4,
    backgroundColor: '#B0566A', borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  sinoSeloTxt: { fontFamily: 'Lato_700Bold', fontSize: 10, color: '#FFFFFF', lineHeight: 12 },

  hero: {
    marginTop: 20, padding: 18, paddingTop: 20, borderRadius: 28, gap: 14,
    backgroundColor: colors.escuro ? '#2A2439' : '#EFEAF7',
    borderWidth: colors.escuro ? 1 : 0, borderColor: colors.bordaSuave,
  },
  diaLinha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  diaRotulo: { fontFamily: 'Lato_700Bold', fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.escuro ? colors.lav5 : '#5B4D96' },
  diaBarras: { flex: 1, flexDirection: 'row', gap: 5 },
  diaBarra: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.escuro ? '#463D5C' : '#D8D1E6' },
  diaBarraFeita: { backgroundColor: colors.botaoForte },
  heroTit: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 29, lineHeight: 33, color: colors.titulo },
  heroSub: { fontFamily: 'Lato_400Regular', fontSize: 14.5, lineHeight: 21, color: colors.texto2 },
  emoGrade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emoBtn: {
    width: '23%', flexGrow: 1, height: 82, borderRadius: 18, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.bordaSuave, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4,
  },
  emoOutras: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: colors.lav3 },
  emoCirculo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emoTxt: { fontFamily: 'Lato_400Regular', fontSize: 12.5, color: colors.td },
  btnPrincipal: {
    height: 52, borderRadius: 26, backgroundColor: colors.botaoForte,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrincipalTxt: { fontFamily: 'Lato_700Bold', fontSize: 15.5, color: '#FFFFFF' },

  hojeLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hojeIcone: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  hojeRotulo: { fontFamily: 'Lato_400Regular', fontSize: 13, color: colors.texto2 },
  mudar: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  link: { fontFamily: 'Lato_700Bold', fontSize: 13.5, color: colors.lav5 },
  sugestao: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: colors.card },
  sugestaoImg: { width: 56, height: 56, borderRadius: 14, backgroundColor: colors.douradoFundo },
  tipo: { fontFamily: 'Lato_700Bold', fontSize: 10.5, letterSpacing: 0.8 },
  sugestaoTit: { fontFamily: 'Lato_700Bold', fontSize: 14.5, lineHeight: 19, color: colors.titulo, marginTop: 2 },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.botaoForte, alignItems: 'center', justifyContent: 'center' },
  verMais: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  proximo: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.escuro ? '#3A3248' : '#DCD3EA', paddingTop: 14 },
  proximoTit: { fontFamily: 'Lato_400Regular', fontSize: 14.5, color: colors.titulo, marginTop: 2 },
  btnContorno: {
    minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderColor: colors.lav4,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  btnContornoTxt: { fontFamily: 'Lato_700Bold', fontSize: 13.5, color: colors.lav5 },

  cartao: {
    marginTop: 16, padding: 18, borderRadius: 24, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.bordaSuave, gap: 10,
  },
  cartaoTit: { fontFamily: 'Lato_700Bold', fontSize: 15, color: colors.titulo },
  cartaoSub: { fontFamily: 'Lato_400Regular', fontSize: 13, color: colors.texto2, marginTop: 1 },
  iaLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iaAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lav1,
    borderWidth: 1, borderColor: colors.lav2, alignItems: 'center', justifyContent: 'center',
  },
  iaCampo: {
    height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.bordaSuave, backgroundColor: colors.bg,
    flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 5,
  },
  iaPlaceholder: { flex: 1, fontFamily: 'Lato_400Regular', fontSize: 14, color: colors.tl },
  iaEnviar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.botaoForte, alignItems: 'center', justifyContent: 'center' },

  rotuloLinha: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rotulo: { fontFamily: 'Lato_700Bold', fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.lav5 },
  frase: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 23, lineHeight: 30, color: colors.titulo },
  reflexao: { fontFamily: 'Lato_400Regular', fontSize: 14.5, lineHeight: 22, color: colors.texto2 },
  fraseRodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    borderTopWidth: 1, borderTopColor: colors.bordaSuave, paddingTop: 8,
  },
  autor: { flex: 1, fontFamily: 'Lato_400Regular', fontSize: 13, color: colors.texto2 },
  lerReflexao: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 36 },

  secaoCab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10, paddingHorizontal: 4 },
  secaoTit: { fontFamily: 'Lato_700Bold', fontSize: 17, color: colors.titulo },
  secaoLink: { minHeight: 36, justifyContent: 'center' },
  carrosselCaixa: { marginHorizontal: -16 },
  carrossel: { gap: 12, paddingHorizontal: 16 },
  mini: { width: 160, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaSuave, overflow: 'hidden' },
  miniImgCaixa: { height: 104, alignItems: 'center', justifyContent: 'center' },
  miniImg: { width: 120, height: 96 },
  miniCorpo: { padding: 12, paddingTop: 10, gap: 3 },
  miniTit: { fontFamily: 'Lato_700Bold', fontSize: 14, lineHeight: 18, color: colors.titulo },

  continuar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  continuarIcone: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.sageFundo, alignItems: 'center', justifyContent: 'center' },
  progresso: { height: 5, borderRadius: 3, backgroundColor: colors.sageFundo, overflow: 'hidden' },
  progressoCheio: { height: 5, borderRadius: 3, backgroundColor: colors.sage },

  carteira: {
    marginTop: 12, minHeight: 48, borderRadius: 24, backgroundColor: colors.sageFundo,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16,
  },
  carteiraTxt: { flex: 1, fontFamily: 'Lato_400Regular', fontSize: 13.5, color: colors.sageFg },
  aviso: { fontFamily: 'Lato_400Regular', fontSize: 11.5, lineHeight: 16, color: colors.tl, textAlign: 'center', marginTop: 24, paddingHorizontal: 12 },
}), { escalar: false });
