import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, StatusBar, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { Profundo } from '../../components/Efeitos';
import { useApp } from '../../hooks/AppContext';
import { useAuth } from '../../hooks/AuthContext';
import { confirmar } from '../../utils/confirm';
import { escolherEnviarFoto } from '../../utils/fotoPerfil';
import { planos } from '../../data';
import { pareceNome, nomeDeExibicao } from '../../utils/nome';
import { brl } from '../cashback/CashbackScreen';
import { useMeusPedidosAfiliado } from '../../utils/afiliados';
import { pedirPermissao } from '../../utils/lembreteCheckin';
import { normalizarPrefFrase } from '../../utils/fraseNotificacao';

// Cor de cada plano (a mesma das outras telas).
const COR_PLANO = {
  0: ['sageFundo', 'sageFg'],
  1: ['lav1', 'lilasTexto'],
  2: ['lav1', 'lilasTexto'],
  3: ['douradoFundo', 'douradoTitulo'],
};

// Perfil: dados da pessoa, plano atual e atalhos de configuração.
export default function PerfilScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { usuario, cashback, cashbackVisivel } = useApp();
  const { perfil, firebaseUser, atualizarPerfil, sair } = useAuth();
  // Cashback (cupons de parceria e Achados/afiliados). Mesmo se o painel
  // esconder o programa, quem já tem saldo, extrato ou pedidos continua vendo.
  const { pedidos: pedidosAfiliado, pendentes: pendentesAfiliado } = useMeusPedidosAfiliado(firebaseUser?.uid);
  const mostrarCashback = cashbackVisivel || cashback?.saldoCentavos > 0
    || cashback?.movimentos?.length > 0 || pedidosAfiliado.length > 0;
  const [dados, setDados] = useState({
    nome: perfil?.nome || '',
    apelido: perfil?.apelido || '',
    telefone: perfil?.telefone || '',
    cidade: perfil?.cidade || '',
  });
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const prefFrase = normalizarPrefFrase(perfil?.fraseNotificacao);
  const alternarFrase = async (ativo) => {
    if (ativo && (await pedirPermissao()) !== 'granted') {
      Alert.alert('Notificações desligadas', 'Para receber a Frase do dia, permita as notificações do Atravessia nas configurações do celular.');
      return;
    }
    atualizarPerfil({ fraseNotificacao: { ...prefFrase, ativo } }).catch(() => {});
  };
  const alterado = ['nome', 'apelido', 'telefone', 'cidade'].some(k => (perfil?.[k] || '') !== dados[k]);

  const plano = planos.find(p => p.id === usuario.plano) || planos[0];
  const nomePlano = usuario.acessoTotal ? 'Acesso Total' : `Plano ${plano.nome}`;
  const [fundoPlano, textoPlano] = usuario.acessoTotal ? ['douradoFundo', 'douradoTitulo'] : (COR_PLANO[plano.id] || COR_PLANO[0]);
  const inicial = (dados.apelido || dados.nome || 'A').trim().charAt(0).toUpperCase();

  const salvar = async () => {
    if (!dados.nome.trim()) { Alert.alert('Seu nome', 'Conte como você se chama para salvar.'); return; }
    if (dados.apelido.trim() && !pareceNome(dados.apelido)) { Alert.alert('Como prefere ser chamado(a)', 'Escreva um nome ou apelido (só letras), ou deixe em branco.'); return; }
    setSalvando(true);
    try {
      await atualizarPerfil({
        nome: dados.nome.trim(), apelido: dados.apelido.trim(),
        telefone: dados.telefone.trim(), cidade: dados.cidade.trim(),
      });
      Alert.alert('Pronto', 'Seus dados foram atualizados.');
    } catch (e) {
      Alert.alert('Não foi possível salvar', e?.message || 'Tente novamente em instantes.');
    } finally {
      setSalvando(false);
    }
  };

  const trocarFoto = async () => {
    setEnviandoFoto(true);
    try {
      const url = await escolherEnviarFoto(firebaseUser?.uid);
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

  const grupos = [
    {
      titulo: 'Meu cuidado',
      itens: [
        { icone: 'time-outline', rotulo: 'Lembrete diário', sub: 'Escolha o horário do lembrete do check-in', tela: 'Lembrete', cor: ['lav1', 'lav5'] },
        { icone: 'heart-outline', rotulo: 'Favoritos', sub: 'O que você guardou com carinho', tela: 'Favoritos', cor: ['roseFundo', 'roseTexto'] },
      ],
    },
    {
      titulo: 'Benefícios',
      itens: [
        { icone: 'ticket-outline', rotulo: 'Meus cupons', sub: 'Cupons das parcerias que você gerou', tela: 'MeusCupons', cor: ['douradoFundo', 'douradoTitulo'] },
      ],
    },
    {
      titulo: 'App',
      itens: [
        { icone: 'contrast-outline', rotulo: 'Aparência', sub: 'Tema claro, noturno ou automático e vibração', tela: 'Aparencia', cor: ['lav1', 'lav5'] },
        { icone: 'map-outline', rotulo: 'Tour do app', sub: 'Rever a apresentação do Atravessia', tela: 'Onboarding', params: { revisita: true }, cor: ['lav1', 'lav5'] },
        { icone: 'information-circle-outline', rotulo: 'Sobre o app', sub: 'O que é o Atravessia', tela: 'Sobre', cor: ['lav1', 'lav5'] },
        { icone: 'hand-left-outline', rotulo: 'Seja nosso parceiro', sub: 'Saiba como', tela: 'SejaParceiro', cor: ['douradoFundo', 'douradoTitulo'] },
      ],
    },
  ];

  const campo = (chave, rotulo, extra = {}) => (
    <View style={s.campo}>
      <Text style={s.campoRotulo}>{rotulo}</Text>
      <TextInput
        style={s.input}
        value={dados[chave]}
        onChangeText={(t) => setDados(d => ({ ...d, [chave]: t }))}
        placeholderTextColor={colors.tl}
        {...extra}
      />
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <ScrollView contentContainerStyle={[s.conteudo, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.topo}>
          <TouchableOpacity style={s.voltar} onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
            <Ionicons name="chevron-back" size={22} color={colors.lilasTexto} />
          </TouchableOpacity>
          <Text style={s.tituloTela}>Perfil</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Quem é você */}
        <View style={[s.cartao, s.identidade]}>
          <LinearGradient colors={['#B9A6F0', '#F3B9A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarAnel}>
            <TouchableOpacity style={s.avatar} onPress={tocarFoto} disabled={enviandoFoto} activeOpacity={0.85} accessibilityLabel="Foto do perfil">
              {perfil?.photoURL
                ? <Image source={{ uri: perfil.photoURL }} style={s.avatarImg} />
                : <Text style={s.avatarInicial}>{inicial}</Text>}
              <View style={s.avatarBadge}>
                {enviandoFoto ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="camera" size={12} color="white" />}
              </View>
            </TouchableOpacity>
          </LinearGradient>
          <Text style={s.nome}>{nomeDeExibicao(perfil || {})}</Text>
          {!!firebaseUser?.email && <Text style={s.email}>{firebaseUser.email}</Text>}
        </View>

        {/* Plano atual */}
        <View style={s.cartao}>
          <Text style={s.sobretitulo}>Seu plano</Text>
          <View style={s.planoLinha}>
            <View style={[s.chipPlano, { backgroundColor: colors[fundoPlano] }]}>
              <Ionicons name="diamond-outline" size={15} color={colors[textoPlano]} />
              <Text style={[s.chipPlanoTxt, { color: colors[textoPlano] }]}>{nomePlano}</Text>
            </View>
          </View>
          <Text style={s.planoDesc}>{usuario.acessoTotal ? 'Você tem acesso a todos os recursos do app.' : plano.descricao}</Text>
          <TouchableOpacity style={s.secundario} onPress={() => navigation.navigate('Planos')} activeOpacity={0.85}>
            <Text style={s.secundarioTxt}>{usuario.plano >= 3 || usuario.acessoTotal ? 'Ver planos' : 'Ver planos e assinar'}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.lilasTexto} />
          </TouchableOpacity>
        </View>

        {/* Meu cashback: saldo + extrato e pedidos dos Achados (afiliados) */}
        {mostrarCashback && (
          <View style={s.cartao}>
            <Text style={s.sobretitulo}>Meu cashback</Text>
            <TouchableOpacity
              style={s.cbLinha}
              onPress={() => navigation.navigate('Cashback')}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Meu cashback: saldo de ${brl(cashback?.saldoCentavos)}. Ver extrato`}
            >
              <View style={[s.pilula, { backgroundColor: colors.sageFundo }]}>
                <Ionicons name="wallet-outline" size={18} color={colors.sageFg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemSub}>Saldo disponível</Text>
                <Text style={s.cbValor}>{brl(cashback?.saldoCentavos)}</Text>
              </View>
              <Text style={s.cbLink}>Ver extrato</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lilasTexto} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.cbLinha, s.itemBorda]}
              onPress={() => navigation.navigate('MeusPedidosCashback')}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Meus pedidos de cashback dos afiliados${pendentesAfiliado > 0 ? `, ${pendentesAfiliado} em análise` : ''}`}
            >
              <View style={[s.pilula, { backgroundColor: colors.lav1 }]}>
                <Ionicons name="receipt-outline" size={18} color={colors.lav5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemRotulo}>Meus pedidos de cashback (afiliados)</Text>
                <Text style={s.itemSub}>
                  {pendentesAfiliado > 0
                    ? `${pendentesAfiliado} ${pendentesAfiliado === 1 ? 'pedido em análise' : 'pedidos em análise'}`
                    : pedidosAfiliado.length > 0 ? 'Nenhum pedido em análise agora' : 'Compras pelos Achados da Atravessia'}
                </Text>
              </View>
              {pendentesAfiliado > 0 && (
                <View style={s.cbBadge}><Text style={s.cbBadgeTxt}>{pendentesAfiliado}</Text></View>
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.tl} />
            </TouchableOpacity>
          </View>
        )}

        {/* Frase do dia no celular */}
        <View style={[s.cartao, s.linhaSwitch]}>
          <View style={[s.pilula, { backgroundColor: colors.douradoFundo }]}>
            <Ionicons name="sunny-outline" size={18} color={colors.douradoTitulo} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.itemRotulo}>Frase do dia no celular</Text>
            <Text style={s.itemSub}>Uma notificação com a frase todas as manhãs, às 8h</Text>
          </View>
          <Switch
            value={prefFrase.ativo}
            onValueChange={alternarFrase}
            trackColor={{ false: colors.lav2, true: colors.lav4 }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Frase do dia no celular"
          />
        </View>

        {/* Meus dados */}
        <View style={s.cartao}>
          <Text style={s.sobretitulo}>Meus dados</Text>
          {campo('nome', 'Nome', { autoCapitalize: 'words', placeholder: 'Seu nome', autoComplete: 'name', textContentType: 'name' })}
          {campo('apelido', 'Como prefere ser chamado(a)', { autoCapitalize: 'words', placeholder: 'Apelido (opcional)', autoComplete: 'off', importantForAutofill: 'no', textContentType: 'nickname' })}
          {campo('telefone', 'Telefone', { keyboardType: 'phone-pad', placeholder: '(00) 00000-0000' })}
          {campo('cidade', 'Cidade', { autoCapitalize: 'words', placeholder: 'Sua cidade' })}
          {alterado && (
            <Profundo estilo={s.botao} base={colors.botaoBase} sombra={s.botaoSombra} onPress={salvando ? undefined : salvar} accessibilityLabel="Salvar dados">
              <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.botaoGradiente} />
              {salvando ? <ActivityIndicator color="white" /> : <Text style={s.botaoTxt}>Salvar dados</Text>}
            </Profundo>
          )}
        </View>

        {grupos.map(g => (
          <View key={g.titulo}>
            <Text style={s.grupoTit}>{g.titulo}</Text>
            <View style={[s.cartao, s.lista]}>
              {g.itens.filter(Boolean).map((it, i) => (
                <TouchableOpacity
                  key={it.rotulo}
                  style={[s.item, i > 0 && s.itemBorda]}
                  onPress={() => navigation.navigate(it.tela, it.params)}
                  activeOpacity={0.75}
                >
                  <View style={[s.pilula, { backgroundColor: colors[it.cor[0]] }]}>
                    <Ionicons name={it.icone} size={18} color={colors[it.cor[1]]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemRotulo}>{it.rotulo}</Text>
                    <Text style={s.itemSub}>{it.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.tl} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={s.sair}
          onPress={() => confirmar('Sair da conta', 'Deseja encerrar a sessão e trocar de conta?', sair, 'Sair')}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.roseTexto} />
          <Text style={s.sairTxt}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const vidro = () => ({
  backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bordaLuz, borderRadius: 26,
  shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 3,
});

const s = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  conteudo: { paddingHorizontal: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  voltar: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  tituloTela: { fontFamily: 'Titulo', fontSize: 32, color: colors.titulo },
  cartao: { ...vidro(), padding: 18, marginBottom: 14 },
  identidade: { alignItems: 'center', paddingVertical: 22 },
  avatarAnel: { width: 92, height: 92, borderRadius: 46, padding: 3, marginBottom: 10 },
  avatar: { flex: 1, borderRadius: 43, backgroundColor: colors.cardSolido, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 86, height: 86, borderRadius: 43 },
  avatarInicial: { fontFamily: 'Titulo', fontSize: 40, color: colors.lav6 },
  avatarBadge: {
    position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.lav5, borderWidth: 2, borderColor: colors.cardSolido, alignItems: 'center', justifyContent: 'center',
  },
  nome: { fontFamily: 'Titulo', fontSize: 28, color: colors.titulo },
  email: { fontFamily: 'Figtree_400Regular', fontSize: 14, color: colors.texto2, marginTop: 2 },
  sobretitulo: {
    fontFamily: 'Figtree_700Bold', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase',
    color: colors.lilasTexto, marginBottom: 12,
  },
  planoLinha: { flexDirection: 'row' },
  chipPlano: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
  chipPlanoTxt: { fontFamily: 'Figtree_700Bold', fontSize: 15 },
  planoDesc: { fontFamily: 'Figtree_400Regular', fontSize: 14.5, color: colors.texto2, marginTop: 10, lineHeight: 20 },
  secundario: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14,
    paddingVertical: 12, borderRadius: 999, backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.lav2,
  },
  secundarioTxt: { fontFamily: 'Figtree_700Bold', fontSize: 15, color: colors.lilasTexto },
  campo: { marginBottom: 12 },
  campoRotulo: { fontFamily: 'Figtree_600SemiBold', fontSize: 13.5, color: colors.titulo, marginBottom: 6 },
  input: {
    minHeight: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.cardSolido,
    borderWidth: 1, borderColor: colors.border, fontFamily: 'Figtree_400Regular', fontSize: 15.5, color: colors.titulo,
  },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.botao },
  botaoGradiente: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  botaoSombra: { shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 5, marginTop: 6 },
  botaoTxt: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: 'white' },
  grupoTit: { fontFamily: 'Figtree_700Bold', fontSize: 18, color: colors.titulo, marginTop: 8, marginBottom: 10, marginLeft: 4 },
  lista: { paddingVertical: 4, paddingHorizontal: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8 },
  itemBorda: { borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  pilula: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemRotulo: { fontFamily: 'Figtree_700Bold', fontSize: 15, color: colors.titulo },
  itemSub: { fontFamily: 'Figtree_400Regular', fontSize: 12.5, color: colors.texto2, marginTop: 1 },
  sair: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6,
    paddingVertical: 14, borderRadius: 999, backgroundColor: colors.roseFundo,
  },
  sairTxt: { fontFamily: 'Figtree_700Bold', fontSize: 15, color: colors.roseTexto },
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  cbLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  cbValor: { fontFamily: 'Figtree_700Bold', fontSize: 22, color: colors.titulo, marginTop: 1 },
  cbLink: { fontFamily: 'Figtree_700Bold', fontSize: 13.5, color: colors.lilasTexto },
  cbBadge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: colors.douradoFundo, alignItems: 'center', justifyContent: 'center' },
  cbBadgeTxt: { fontFamily: 'Figtree_700Bold', fontSize: 12.5, color: colors.douradoTitulo },
}));
