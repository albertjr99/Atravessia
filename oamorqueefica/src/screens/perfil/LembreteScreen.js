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
  statusPermissao, calcularDatasLembrete, formatarHorario, normalizarPreferencia,
} from '../../utils/lembreteCheckin';

const ilustracao = require('../../../assets/images/il_onda_coracao.png');

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

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Lembrete diário</Text>
        <View style={{ width: 36 }} />
      </View>

      {!pref ? (
        <View style={s.carregando}><ActivityIndicator color={colors.lav4} /></View>
      ) : (
        <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          <Image source={ilustracao} style={s.ilustracao} resizeMode="contain" />
          <Text style={s.intro}>
            Um lembrete gentil, uma vez por dia, para você tirar um minutinho e registrar como está.
            Se você já tiver feito o check-in, o lembrete daquele dia não aparece.
          </Text>

          {naWeb && (
            <View style={s.aviso}>
              <Ionicons name="phone-portrait-outline" size={18} color={colors.lav5} />
              <Text style={s.avisoTxt}>Os lembretes funcionam no aplicativo instalado no celular.</Text>
            </View>
          )}

          {/* Liga / desliga */}
          <View style={s.cartao}>
            <View style={s.linha}>
              <View style={s.iconeCirculo}>
                <Ionicons name={pref.ativo ? 'notifications' : 'notifications-off-outline'} size={19} color={colors.lav5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.linhaTit}>Lembrar do check-in</Text>
                <Text style={s.linhaSub}>{pref.ativo ? 'Ligado' : 'Desligado'}</Text>
              </View>
              <Switch
                value={pref.ativo}
                onValueChange={alternar}
                disabled={naWeb}
                trackColor={{ false: colors.lav2, true: colors.lav3 }}
                thumbColor={pref.ativo ? colors.lav5 : '#f4f1f8'}
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
                <Ionicons name="remove" size={22} color={colors.lav5} />
              </TouchableOpacity>
              <Text style={s.horario}>{formatarHorario(pref.hora, pref.minuto)}</Text>
              <TouchableOpacity style={s.passoBtn} onPress={() => ajustar(PASSO_MIN)} accessibilityLabel="15 minutos mais tarde">
                <Ionicons name="add" size={22} color={colors.lav5} />
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
            <Ionicons name={pref.ativo ? 'time-outline' : 'moon-outline'} size={18} color={colors.lav6} />
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
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conteudo: { paddingHorizontal: spacing.lg },

  ilustracao: { width: 130, height: 130, alignSelf: 'center', borderRadius: 20, marginTop: spacing.sm, marginBottom: spacing.md },
  intro: { fontFamily: fonts.body, fontSize: 13.5, color: colors.tm, lineHeight: 20, textAlign: 'center', marginBottom: spacing.lg },

  cartao: {
    backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, ...shadow.card,
  },
  cartaoApagado: { opacity: 0.5 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconeCirculo: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lav1,
    alignItems: 'center', justifyContent: 'center',
  },
  linhaTit: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.td },
  linhaSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, marginTop: 2 },

  secTit: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },
  relogio: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginVertical: spacing.sm },
  passoBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lav1,
    borderWidth: 1, borderColor: colors.lav2, alignItems: 'center', justifyContent: 'center',
  },
  horario: { fontFamily: fonts.serif, fontSize: 40, color: colors.lav6, minWidth: 120, textAlign: 'center' },
  dica: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexGrow: 1, flexBasis: '45%', alignItems: 'center', paddingVertical: 10,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.bg,
  },
  chipAtivo: { backgroundColor: colors.botaoForte, borderColor: colors.botaoForte },
  chipHora: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.lav6 },
  chipRot: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 1 },
  chipTxtAtivo: { color: 'white' },

  previa: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: colors.lav1, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.xs,
  },
  previaTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lav6, lineHeight: 20 },
  previaSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, marginTop: 4, lineHeight: 18 },
  salvo: { fontFamily: fonts.body, fontSize: 11.5, color: colors.sage, marginTop: 6 },

  aviso: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: colors.lav1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
  },
  avisoNegada: { backgroundColor: colors.erroFundo, borderWidth: 1, borderColor: colors.peach },
  avisoTit: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.roseFg, marginBottom: 2 },
  avisoTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.tm, lineHeight: 18 },
  avisoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: colors.botaoForte, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 14, marginTop: spacing.sm,
  },
  avisoBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: 'white' },
}));
