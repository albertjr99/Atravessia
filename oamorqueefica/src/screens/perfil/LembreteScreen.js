import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Switch, Image,
  Linking, AppState, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { hojeStrBR } from '../../utils/date';
import {
  agendarLembretes, carregarPreferencia, salvarPreferenciaLocal, pedirPermissao,
  statusPermissao, calcularDatasLembrete, formatarHorario, normalizarPreferencia, testarLembrete, abrirAjusteAlarmes, abrirAjusteBateria,
} from '../../utils/lembreteCheckin';

const ilustracao = require('../../../assets/images/il_onda_coracao.png');

// Ilustração em aquarela (cartão de papel sobre fundo branco, sem transparência):
// ampliada e recortada nas bordas do próprio cartão, para flutuar sobre a aurora.
function Ilustracao({ source, tamanho, style }) {
  const raio = Math.round(tamanho * 0.12);
  const extra = tamanho * 0.08;
  return (
    <View style={[{
      width: tamanho, height: tamanho, borderRadius: raio, backgroundColor: colors.cardSolido,
      shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.4 : 0.14, shadowRadius: 20, elevation: 3,
    }, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: raio, overflow: 'hidden' }]}>
        <Image
          source={source}
          resizeMode="cover"
          style={{ position: 'absolute', left: -extra, top: -extra, width: tamanho + extra * 2, height: tamanho + extra * 2, opacity: colors.escuro ? 0.9 : 1 }}
        />
      </View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: raio, borderWidth: 1, borderColor: colors.bordaLuz }]} />
    </View>
  );
}

const SUGESTOES = [
  { hora: 8, minuto: 0, rotulo: 'Manhã' },
  { hora: 12, minuto: 0, rotulo: 'Almoço' },
  { hora: 20, minuto: 0, rotulo: 'Noite' },
  { hora: 21, minuto: 30, rotulo: 'Antes de dormir' },
];
const PASSO_MIN = 15;

export default function LembreteScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { checkins } = useApp();
  const { firebaseUser, perfil, atualizarPerfil } = useAuth();
  const uid = firebaseUser?.uid;
  const jaFezHoje = checkins.some(c => c.data === hojeStrBR());
  const naWeb = Platform.OS === 'web';

  const [pref, setPref] = useState(null);
  const [permissao, setPermissao] = useState('undetermined');
  const [salvo, setSalvo] = useState(false);
  const ultimoSalvo = useRef(null);
  const pendente = useRef(null);

  // Carrega a preferência salva e o estado da permissão.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [p, st] = await Promise.all([
        carregarPreferencia(uid, perfil?.lembreteCheckin),
        statusPermissao(),
      ]);
      if (!vivo) return;
      ultimoSalvo.current = JSON.stringify(p);
      setPref(p);
      setPermissao(st);
    })();
    return () => { vivo = false; };
  }, [uid]);

  // Quando ela volta das configurações do aparelho, confere a permissão de novo.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') statusPermissao().then(setPermissao);
    });
    return () => sub.remove();
  }, []);

  const persistir = useCallback(async (p) => {
    const json = JSON.stringify(p);
    if (json === ultimoSalvo.current) return;
    ultimoSalvo.current = json;
    await salvarPreferenciaLocal(uid, p);
    atualizarPerfil({ lembreteCheckin: p }).catch(() => {});
    await agendarLembretes(p, jaFezHoje).catch(() => {});
    setSalvo(true);
  }, [uid, atualizarPerfil, jaFezHoje]);

  // Salva e reagenda pouco depois da última mudança (evita uma gravação a cada
  // toque no +/−). Ao sair da tela, o que estiver pendente é gravado na hora.
  useEffect(() => {
    if (!pref) return undefined;
    pendente.current = pref;
    setSalvo(false);
    const t = setTimeout(() => { pendente.current = null; persistir(pref); }, 600);
    return () => clearTimeout(t);
  }, [pref, persistir]);

  useEffect(() => () => { if (pendente.current) persistir(pendente.current); }, [persistir]);

  const alternar = async (ligar) => {
    if (!ligar) { setPref(p => ({ ...p, ativo: false })); return; }
    const st = await pedirPermissao();
    setPermissao(st);
    if (st === 'granted') setPref(p => ({ ...p, ativo: true }));
  };

  const ajustar = (delta) => setPref((p) => {
    const total = p.hora * 60 + p.minuto;
    const arred = Math.round(total / PASSO_MIN) * PASSO_MIN;
    const novo = (((arred === total ? total + delta : arred) % 1440) + 1440) % 1440;
    return { ...p, hora: Math.floor(novo / 60), minuto: novo % 60 };
  });

  const escolher = (hora, minuto) => setPref(p => normalizarPreferencia({ ...p, hora, minuto }));

  const proximo = useMemo(() => {
    if (!pref?.ativo) return null;
    const [d] = calcularDatasLembrete(pref, jaFezHoje);
    if (!d) return null;
    const hoje = new Date();
    return d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth() ? 'hoje' : 'amanhã';
  }, [pref, jaFezHoje]);

  const negada = permissao === 'denied';
  const [teste, setTeste] = useState('');

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Lembrete diário</Text>
        <View style={{ width: 44 }} />
      </View>

      {!pref ? (
        <View style={s.carregando}><ActivityIndicator color={colors.lav4} /></View>
      ) : (
        <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          <Ilustracao source={ilustracao} tamanho={124} style={s.ilustracao} />
          <Text style={s.intro}>
            Um lembrete gentil, uma vez por dia, para você tirar um minutinho e registrar como está.
            Se você já tiver feito o check-in, o lembrete daquele dia não aparece.
          </Text>

          {naWeb && (
            <View style={s.aviso}>
              <Ionicons name="phone-portrait-outline" size={18} color={colors.lilasIcone} />
              <Text style={s.avisoTxt}>Os lembretes funcionam no aplicativo instalado no celular.</Text>
            </View>
          )}

          {/* Liga / desliga */}
          <View style={s.cartao}>
            <View style={s.linha}>
              <View style={s.iconeCirculo}>
                <Ionicons name={pref.ativo ? 'notifications-outline' : 'notifications-off-outline'} size={20} color={colors.lilasIcone} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.linhaTit}>Lembrar do check-in</Text>
                <Text style={s.linhaSub}>{pref.ativo ? 'Ligado' : 'Desligado'}</Text>
              </View>
              <Switch
                value={pref.ativo}
                onValueChange={alternar}
                disabled={naWeb}
                trackColor={{ false: colors.lav2, true: colors.botao }}
                thumbColor={colors.cardSolido}
                ios_backgroundColor={colors.lav2}
              />
            </View>
          </View>

          {negada && (
            <View style={[s.aviso, s.avisoNegada]}>
              <Ionicons name="alert-circle-outline" size={19} color={colors.roseFg} />
              <View style={{ flex: 1 }}>
                <Text style={s.avisoTit}>As notificações estão desativadas</Text>
                <Text style={s.avisoTxt}>
                  Para receber o lembrete, permita as notificações da Atravessia nas configurações do aparelho.
                </Text>
                <TouchableOpacity style={s.avisoBtn} onPress={() => Linking.openSettings().catch(() => {})} activeOpacity={0.85}>
                  <Ionicons name="settings-outline" size={15} color="white" />
                  <Text style={s.avisoBtnTxt}>Abrir configurações</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Horário */}
          <View style={[s.cartao, !pref.ativo && s.cartaoApagado]} pointerEvents={pref.ativo ? 'auto' : 'none'}>
            <Text style={s.secTit}>Horário</Text>
            <View style={s.relogio}>
              <TouchableOpacity style={s.passoBtn} onPress={() => ajustar(-PASSO_MIN)} accessibilityLabel="15 minutos mais cedo">
                <Ionicons name="remove" size={22} color={colors.lilasIcone} />
              </TouchableOpacity>
              <Text style={s.horario}>{formatarHorario(pref.hora, pref.minuto)}</Text>
              <TouchableOpacity style={s.passoBtn} onPress={() => ajustar(PASSO_MIN)} accessibilityLabel="15 minutos mais tarde">
                <Ionicons name="add" size={22} color={colors.lilasIcone} />
              </TouchableOpacity>
            </View>
            <Text style={s.dica}>Ajuste de 15 em 15 minutos, ou escolha uma sugestão:</Text>
            <View style={s.chips}>
              {SUGESTOES.map(op => {
                const ativo = pref.hora === op.hora && pref.minuto === op.minuto;
                return (
                  <TouchableOpacity
                    key={op.rotulo}
                    style={[s.chip, ativo && s.chipAtivo]}
                    onPress={() => escolher(op.hora, op.minuto)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.chipHora, ativo && s.chipTxtAtivo]}>{formatarHorario(op.hora, op.minuto)}</Text>
                    <Text style={[s.chipRot, ativo && s.chipTxtAtivo]}>{op.rotulo}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Prévia */}
          <View style={s.previa}>
            <View style={s.previaIcone}><Ionicons name={pref.ativo ? 'time-outline' : 'moon-outline'} size={19} color={colors.lilasIcone} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.previaTxt}>
                {pref.ativo
                  ? `Vamos te lembrar todos os dias às ${formatarHorario(pref.hora, pref.minuto)}.`
                  : 'O lembrete está desligado. Você pode ligá-lo quando quiser.'}
              </Text>
              {pref.ativo && proximo && (
                <Text style={s.previaSub}>
                  {jaFezHoje && proximo === 'amanhã'
                    ? 'Você já fez seu check-in hoje, então o próximo lembrete chega amanhã.'
                    : `Próximo lembrete: ${proximo} às ${formatarHorario(pref.hora, pref.minuto)}.`}
                </Text>
              )}
              {salvo && <Text style={s.salvo}>Preferência salva</Text>}
            </View>
          </View>

          {/* Garantir que o aviso chegue na hora (celular e tablet) */}
          {pref.ativo && !naWeb && (
            <View style={s.cartao}>
              <Text style={s.secTit}>Para o lembrete chegar na hora certa</Text>
              <TouchableOpacity style={s.ajusteBtn} onPress={async () => {
                const ok = await testarLembrete();
                setTeste(ok ? 'Em 10 segundos chega um aviso de teste. Pode sair do app para ver.' : 'Não foi possível enviar o teste. Confira se as notificações estão permitidas.');
              }} activeOpacity={0.85}>
                <Ionicons name="paper-plane-outline" size={18} color={colors.lilasIcone} />
                <Text style={s.ajusteTxt}>Enviar um lembrete de teste</Text>
              </TouchableOpacity>
              {!!teste && <Text style={s.dica}>{teste}</Text>}
              {Platform.OS === 'android' && (
                <>
                  <Text style={s.dica}>
                    Alguns celulares e tablets Android atrasam avisos para economizar bateria. Se o lembrete não chegar no horário, permita os dois itens abaixo:
                  </Text>
                  <TouchableOpacity style={s.ajusteBtn} onPress={abrirAjusteAlarmes} activeOpacity={0.85}>
                    <Ionicons name="alarm-outline" size={18} color={colors.lilasIcone} />
                    <Text style={s.ajusteTxt}>Permitir “Alarmes e lembretes”</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.ajusteBtn} onPress={abrirAjusteBateria} activeOpacity={0.85}>
                    <Ionicons name="battery-charging-outline" size={18} color={colors.lilasIcone} />
                    <Text style={s.ajusteTxt}>Tirar a Atravessia da economia de bateria</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 1,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 28, color: colors.titulo },
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conteudo: { paddingHorizontal: spacing.lg },

  ilustracao: { alignSelf: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
  intro: { fontFamily: fonts.body, fontSize: 15, color: colors.texto2, lineHeight: 23, textAlign: 'center', marginBottom: spacing.lg },

  cartao: {
    backgroundColor: colors.card, borderRadius: 24, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.bordaLuz, marginBottom: spacing.md,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  cartaoApagado: { opacity: 0.5 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconeCirculo: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  linhaTit: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo },
  linhaSub: { fontFamily: fonts.body, fontSize: 12, color: colors.texto2, marginTop: 2 },

  secTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, marginBottom: spacing.sm },
  relogio: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginVertical: spacing.sm },
  passoBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.lav1,
    alignItems: 'center', justifyContent: 'center',
  },
  horario: { fontFamily: fonts.bodyBold, fontSize: 42, letterSpacing: 1, color: colors.lav6, minWidth: 130, textAlign: 'center' },
  dica: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.texto2, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.md },
  // Sugestões de horário num trilho de vidro (a escolhida em branco sólido)
  chips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4,
    backgroundColor: colors.vidro, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  chip: {
    flexGrow: 1, flexBasis: '45%', alignItems: 'center', justifyContent: 'center', minHeight: 56, borderRadius: 18,
  },
  chipAtivo: {
    backgroundColor: colors.escuro ? colors.lav2 : colors.cardSolido,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2,
  },
  chipHora: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo },
  chipRot: { fontFamily: fonts.body, fontSize: 11, color: colors.texto2, marginTop: 1 },
  chipTxtAtivo: { color: colors.lilasTexto },

  previa: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.md,
    backgroundColor: colors.lavVeu, borderRadius: 24, padding: spacing.lg, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  previaIcone: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  previaTxt: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.lilasTexto, lineHeight: 22 },
  previaSub: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 4, lineHeight: 19 },
  salvo: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.sageFg, marginTop: 6 },

  aviso: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: colors.card, borderRadius: 20, padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.bordaLuz,
  },
  avisoNegada: { backgroundColor: colors.erroFundo, borderColor: colors.roseFundo },
  avisoTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.roseTexto, marginBottom: 2 },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.texto2, lineHeight: 19 },
  avisoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: colors.botaoForte, borderRadius: radius.full, minHeight: 40, paddingHorizontal: 16, marginTop: spacing.sm,
  },
  avisoBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: 'white' },
  ajusteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 14, marginTop: 10,
    borderRadius: 16, backgroundColor: colors.lavVeu,
  },
  ajusteTxt: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
}));
