import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Image, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { colors, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import BarraAbas, { ALTURA_BARRA } from '../../components/BarraAbas';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { useTema, MODOS_TEMA } from '../../hooks/TemaContext';
import { confirmar } from '../../utils/confirm';
import { situacaoCupom } from '../../utils/cupons';
import { escolherEnviarFoto } from '../../utils/fotoPerfil';
import { carregarPreferencia } from '../../utils/lembreteCheckin';
import { brl } from '../cashback/CashbackScreen';

const ilPlanos = require('../../../assets/images/il_mulher_flores.png');
const PLANO_LABEL = { 0: 'Perceber', 1: 'Acolher', 2: 'Compreender', 3: 'Evoluir' };
const dataCurta = (ms) => (ms ? new Date(ms).toLocaleDateString('pt-BR') : '');

// Perfil: foto, plano, carteira (cashback e cupons) e ajustes. Substitui o
// antigo menu ☰ da tela inicial.
export default function PerfilScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { usuario, cashback, meusVouchers } = useApp();
  const { sair, firebaseUser, perfil, atualizarPerfil } = useAuth();
  const { modo } = useTema();
  const uid = firebaseUser?.uid;
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [lembrete, setLembrete] = useState(null);

  useFocusEffect(useCallback(() => {
    let vivo = true;
    if (uid) carregarPreferencia(uid, perfil?.lembreteCheckin).then(p => { if (vivo) setLembrete(p); }).catch(() => {});
    return () => { vivo = false; };
  }, [uid, perfil?.lembreteCheckin]));

  const cuponsProntos = (meusVouchers || []).filter(v => situacaoCupom(v) === 'ativo').length;
  const cuponsAguardando = (meusVouchers || []).filter(v => situacaoCupom(v) === 'aguardando').length;
  const nome = perfil?.nome || usuario.nome || '';
  const inicial = (usuario.apelido || nome || 'A').trim().charAt(0).toUpperCase();
  const plano = usuario.acessoTotal ? 'Acesso total' : `Plano ${PLANO_LABEL[usuario.plano] || 'Perceber'}`;
  const rotuloTema = MODOS_TEMA.find(m => m.id === modo)?.rotulo || 'Claro';
  const rotuloLembrete = lembrete?.ativo
    ? `${String(lembrete.hora).padStart(2, '0')}:${String(lembrete.minuto).padStart(2, '0')}`
    : 'Desligado';

  const trocarFoto = async () => {
    setEnviandoFoto(true);
    try {
      const url = await escolherEnviarFoto(uid);
      if (url) await atualizarPerfil({ photoURL: url });
    } catch (e) {
      Alert.alert('Não foi possível enviar a foto', e?.message || 'Tente novamente em instantes.');
    } finally {
      setEnviandoFoto(false);
    }
  };
  const tocarFoto = () => {
    if (!perfil?.photoURL) { trocarFoto(); return; }
    Alert.alert('Sua foto', 'O que você quer fazer?', [
      { text: 'Trocar foto', onPress: trocarFoto },
      { text: 'Remover foto', style: 'destructive', onPress: () => atualizarPerfil({ photoURL: null }).catch(() => {}) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };
  const handleSair = () => confirmar('Sair da conta', 'Deseja encerrar a sessão e trocar de conta?', sair, 'Sair');

  const grupos = [
    {
      titulo: 'Cuidados',
      itens: [
        { icone: 'notifications-outline', rotulo: 'Lembrete diário', valor: rotuloLembrete, rota: 'Lembrete' },
        { icone: 'calendar-outline', rotulo: 'Datas sensíveis', rota: 'DatasSensiveis' },
        { icone: 'people-outline', rotulo: 'Rede de apoio', rota: 'RedeApoio' },
        { icone: 'heart-outline', rotulo: 'Favoritos', rota: 'Favoritos' },
      ],
    },
    {
      titulo: 'Aplicativo',
      itens: [
        { icone: 'contrast-outline', rotulo: 'Aparência', valor: rotuloTema, rota: 'Aparencia' },
        { icone: 'map-outline', rotulo: 'Tour do app', acao: () => navigation.navigate('Onboarding', { revisita: true }) },
        { icone: 'log-out-outline', rotulo: 'Sair da conta', acao: handleSair, sair: true },
      ],
    },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 28, paddingBottom: ALTURA_BARRA + Math.max(insets.bottom, 8) + 28 }}
      >
        <View style={s.coluna}>
          <View style={s.cab}>
            <TouchableOpacity style={s.avatar} onPress={tocarFoto} disabled={enviandoFoto} activeOpacity={0.85}
              accessibilityLabel={perfil?.photoURL ? 'Sua foto. Toque para trocar' : 'Adicionar foto do perfil'}>
              {perfil?.photoURL
                ? <Image source={{ uri: perfil.photoURL }} style={s.avatarImg} />
                : <Text style={s.avatarInicial}>{inicial}</Text>}
              <View style={s.camera}>
                {enviandoFoto ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="camera" size={13} color="#FFFFFF" />}
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text style={s.nome} numberOfLines={2}>{nome || 'Você'}</Text>
              <Text style={s.plano}>{plano}</Text>
            </View>
          </View>

          {/* Carteira */}
          <View style={s.carteira}>
            <View style={s.carteiraTopo}>
              <View style={s.carteiraIcone}><Ionicons name="wallet-outline" size={21} color={colors.sageFg} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.carteiraRotulo}>Minha carteira</Text>
                <Text style={s.carteiraValor}>{brl(cashback?.saldoCentavos || 0)}</Text>
              </View>
              <TouchableOpacity style={s.carteiraBtn} onPress={() => navigation.navigate('Cashback')} activeOpacity={0.85}>
                <Text style={s.carteiraBtnTxt}>{cashback?.saldoCentavos > 0 ? 'Ver e usar' : 'Como ganhar'}</Text>
              </TouchableOpacity>
            </View>
            {cashback?.aVencerCentavos > 0 && (
              <View style={s.carteiraLinha}>
                <Ionicons name="time-outline" size={14} color={colors.sageFg} />
                <Text style={s.carteiraTxt}>{brl(cashback.aVencerCentavos)} vencem nos próximos 30 dias</Text>
              </View>
            )}
            {!cashback?.aVencerCentavos && cashback?.proximoVencimento ? (
              <Text style={s.carteiraTxt}>Próximo vencimento: {dataCurta(cashback.proximoVencimento)}</Text>
            ) : null}
            <TouchableOpacity style={s.cupons} onPress={() => navigation.navigate('MeusCupons')} activeOpacity={0.85}>
              <Ionicons name="ticket-outline" size={18} color={colors.lav5} />
              <Text style={s.cuponsTxt}>Meus cupons</Text>
              {(cuponsProntos > 0 || cuponsAguardando > 0) && (
                <Text style={s.cuponsSelo}>
                  {cuponsAguardando > 0 ? `${cuponsAguardando} para confirmar` : `${cuponsProntos} ${cuponsProntos === 1 ? 'pronto' : 'prontos'} para usar`}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.tl} />
            </TouchableOpacity>
          </View>

          {/* Planos */}
          <TouchableOpacity style={s.planos} onPress={() => navigation.navigate('Planos')} activeOpacity={0.88}>
            <Image source={ilPlanos} style={s.planosImg} />
            <View style={{ flex: 1 }}>
              <Text style={s.planosTit}>Planos</Text>
              <Text style={s.planosSub}>{usuario.acessoTotal ? 'Você tem acesso a tudo' : 'Veja o que cada plano acrescenta'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.lav5} />
          </TouchableOpacity>

          {grupos.map(g => (
            <View key={g.titulo}>
              <Text style={s.grupoTit}>{g.titulo}</Text>
              <View style={s.grupo}>
                {g.itens.map((item, i) => (
                  <TouchableOpacity
                    key={item.rotulo}
                    style={[s.item, i > 0 && s.itemBorda]}
                    onPress={item.acao || (() => navigation.navigate(item.rota))}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={item.icone} size={20} color={item.sair ? colors.roseTexto : colors.lav5} />
                    <Text style={[s.itemTxt, item.sair && { color: colors.roseTexto }]}>{item.rotulo}</Text>
                    {!!item.valor && <Text style={s.itemValor}>{item.valor}</Text>}
                    {!item.sair && <Ionicons name="chevron-forward" size={16} color={colors.tl} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <Text style={s.rodape}>
            Atravessia {Constants.expoConfig?.version ? `· versão ${Constants.expoConfig.version}` : ''}{'\n'}
            Acolhimento que não substitui atendimento médico ou psicológico.
          </Text>
        </View>
      </ScrollView>
      <BarraAbas navigation={navigation} ativo="perfil" />
    </SafeAreaView>
  );
}

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  coluna: { width: '100%', paddingHorizontal: 16 },
  cab: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.lav1,
    borderWidth: 3, borderColor: colors.lav2, alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 74, height: 74, borderRadius: 37 },
  avatarInicial: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 36, color: colors.lav5 },
  camera: {
    position: 'absolute', right: -3, bottom: -3, width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.botaoForte, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  nome: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 30, lineHeight: 34, color: colors.titulo },
  plano: {
    alignSelf: 'flex-start', fontFamily: 'Lato_700Bold', fontSize: 12.5, color: colors.lav5,
    backgroundColor: colors.lav1, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, overflow: 'hidden',
  },
  carteira: { marginTop: 22, padding: 18, borderRadius: 24, backgroundColor: colors.sageFundo, gap: 12 },
  carteiraTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  carteiraIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  carteiraRotulo: { fontFamily: 'Lato_700Bold', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.sageFg },
  carteiraValor: { fontFamily: 'Lato_700Bold', fontSize: 24, color: colors.sageFg },
  carteiraBtn: { minHeight: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: colors.escuro ? '#3F5E45' : '#3F5440', justifyContent: 'center' },
  carteiraBtnTxt: { fontFamily: 'Lato_700Bold', fontSize: 13, color: '#FFFFFF' },
  carteiraLinha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carteiraTxt: { fontFamily: 'Lato_400Regular', fontSize: 13, color: colors.sageFg },
  cupons: { minHeight: 50, borderRadius: 16, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  cuponsTxt: { flex: 1, fontFamily: 'Lato_400Regular', fontSize: 14.5, color: colors.titulo },
  cuponsSelo: { fontFamily: 'Lato_700Bold', fontSize: 12, color: colors.sageFg },
  planos: {
    marginTop: 14, padding: 16, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.escuro ? '#2A2439' : '#EFEAF7',
  },
  planosImg: { width: 54, height: 54, borderRadius: 14 },
  planosTit: { fontFamily: 'Lato_700Bold', fontSize: 15.5, color: colors.titulo },
  planosSub: { fontFamily: 'Lato_400Regular', fontSize: 13, color: colors.texto2, marginTop: 1 },
  grupoTit: { fontFamily: 'Lato_700Bold', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.texto2, marginTop: 24, marginBottom: 8, paddingHorizontal: 6 },
  grupo: { borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaSuave, overflow: 'hidden' },
  item: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  itemBorda: { borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  itemTxt: { flex: 1, fontFamily: 'Lato_400Regular', fontSize: 15, color: colors.titulo },
  itemValor: { fontFamily: 'Lato_400Regular', fontSize: 13, color: colors.texto2 },
  rodape: { fontFamily: 'Lato_400Regular', fontSize: 12, lineHeight: 18, color: colors.tl, textAlign: 'center', marginTop: 24 },
}), { escalar: false });
