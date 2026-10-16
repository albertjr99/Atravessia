import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import {
  situacaoCupom, descontoDoCupom, dataCurta, linkDoCupom,
} from '../../utils/cupons';

const SITUACAO = {
  ativo: { rotulo: 'Pronto para usar', tom: 'salvia', icone: 'ticket-outline' },
  aguardando: { rotulo: 'Confirme o atendimento', tom: 'dourado', icone: 'hourglass-outline' },
  usado: { rotulo: 'Usado', tom: 'lilas', icone: 'checkmark-circle-outline' },
  expirado: { rotulo: 'Expirado', tom: 'neutro', icone: 'time-outline' },
};

// Cores de cada estado (fundo do acento + tinta forte), lidas na hora de
// desenhar para acompanhar o tema claro/noturno.
function tomDe(tom) {
  switch (tom) {
    case 'salvia': return { fundo: colors.sageFundo, tinta: colors.sageFg };
    case 'dourado': return { fundo: colors.douradoFundo, tinta: colors.douradoTitulo };
    case 'lilas': return { fundo: colors.lav1, tinta: colors.lilasTexto };
    default: return { fundo: colors.muted, tinta: colors.texto2 };
  }
}

function linhaDeData(v, situacao) {
  if (situacao === 'ativo') return v.expiraEm ? `Válido até ${dataCurta(v.expiraEm)}` : '';
  if (situacao === 'aguardando') return v.concluidoEm ? `Atendimento em ${dataCurta(v.concluidoEm)}` : 'Atendimento registrado pelo parceiro';
  if (situacao === 'usado') {
    if (v.status === 'CONTESTADO') return 'Você informou que o atendimento não aconteceu';
    const quando = v.confirmadoEm || v.concluidoEm;
    return quando ? `Usado em ${dataCurta(quando)}` : 'Usado';
  }
  return v.expiraEm ? `Expirou em ${dataCurta(v.expiraEm)}` : 'Expirado';
}

// Lista os cupons que a usuária já gerou. Antes, ao sair da tela do cupom, não
// havia como voltar a ele — só gerando outro.
export default function MeusCuponsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { meusVouchers } = useApp();
  const [verAntigos, setVerAntigos] = useState(false);

  const grupos = useMemo(() => {
    const g = { ativo: [], aguardando: [], antigos: [] };
    (meusVouchers || []).forEach(v => {
      const sit = situacaoCupom(v);
      const item = { ...v, situacao: sit };
      if (sit === 'ativo') g.ativo.push(item);
      else if (sit === 'aguardando') g.aguardando.push(item);
      else g.antigos.push(item);
    });
    return g;
  }, [meusVouchers]);

  const abrir = (v) => {
    if (v.situacao === 'aguardando' && v.resgateId) {
      navigation.navigate('ConfirmarResgate', { resgateId: v.resgateId });
      return;
    }
    navigation.navigate('Voucher', {
      tokenSeguro: v.id,
      codigoPublico: v.codigoPublico,
      parceriaNome: v.parceriaNome,
      percentualDescontoCliente: descontoDoCupom(v),
      linkValidacao: linkDoCupom(v.id),
    });
  };

  const renderCupom = (v) => {
    const info = SITUACAO[v.situacao];
    const tom = tomDe(info.tom);
    const desconto = descontoDoCupom(v);
    const apagado = v.situacao === 'usado' || v.situacao === 'expirado';
    return (
      <TouchableOpacity key={v.id} style={[s.card, apagado && s.cardApagado]} onPress={() => abrir(v)} activeOpacity={0.85}>
        <View style={[s.iconeWrap, { backgroundColor: tom.fundo }]}>
          <Ionicons name={info.icone} size={21} color={tom.tinta} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.parceria} numberOfLines={1}>{v.parceriaNome || 'Parceria'}</Text>
          <Text style={s.detalhe} numberOfLines={1}>
            {desconto > 0 ? `${desconto}% de desconto · ` : ''}<Text style={s.codigo}>{v.codigoPublico}</Text>
          </Text>
          <View style={s.estadoLinha}>
            <View style={[s.situacaoChip, { backgroundColor: tom.fundo }]}>
              <Text style={[s.situacao, { color: tom.tinta }]}>{info.rotulo}</Text>
            </View>
          </View>
          <Text style={[s.data, v.situacao === 'aguardando' && { color: colors.douradoTitulo }]} numberOfLines={2}>
            {linhaDeData(v, v.situacao)}
          </Text>
        </View>
        <View style={s.direita}>
          <Ionicons name="chevron-forward" size={18} color={colors.tl} />
        </View>
      </TouchableOpacity>
    );
  };

  const total = (meusVouchers || []).length;

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Meus cupons</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: spacing.xxl + insets.bottom }]}
      >
        {total === 0 ? (
          <View style={s.vazio}>
            <View style={s.vazioIcone}><Ionicons name="ticket-outline" size={32} color={colors.lilasIcone} /></View>
            <Text style={s.vazioTit}>Nenhum cupom por aqui ainda</Text>
            <Text style={s.vazioSub}>
              Quando você gerar um cupom em uma parceria do Cuide-se, ele fica guardado aqui
              para usar quando quiser.
            </Text>
            <TouchableOpacity style={s.vazioBtn} onPress={() => navigation.navigate('Parcerias')} activeOpacity={0.85}>
              <Text style={s.vazioBtnTxt}>Ver parcerias</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.lilasTexto} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {grupos.aguardando.length > 0 && (
              <View style={s.secao}>
                <Text style={s.secaoTit}>Falta você confirmar</Text>
                <Text style={s.secaoSub}>
                  O parceiro registrou o atendimento. Conte pra gente se ele realmente aconteceu.
                </Text>
                {grupos.aguardando.map(renderCupom)}
              </View>
            )}

            <View style={s.secao}>
              <Text style={s.secaoTit}>Prontos para usar</Text>
              {grupos.ativo.length === 0 ? (
                <Text style={s.secaoSub}>
                  Nenhum cupom ativo agora. Você pode gerar um novo sempre que precisar, na
                  parceria que quiser.
                </Text>
              ) : (
                <>
                  <Text style={s.secaoSub}>Toque para mostrar o QR Code ao parceiro. Cada cupom vale para um atendimento.</Text>
                  {grupos.ativo.map(renderCupom)}
                </>
              )}
            </View>

            {grupos.antigos.length > 0 && (
              <View style={s.secao}>
                <TouchableOpacity style={s.antigosBtn} onPress={() => setVerAntigos(v => !v)} activeOpacity={0.8}>
                  <Text style={s.secaoTit}>Usados e expirados ({grupos.antigos.length})</Text>
                  <Ionicons name={verAntigos ? 'chevron-up' : 'chevron-down'} size={20} color={colors.lilasTexto} />
                </TouchableOpacity>
                {verAntigos && grupos.antigos.map(renderCupom)}
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  scroll: { paddingHorizontal: spacing.lg },

  secao: { marginTop: spacing.lg },
  secaoTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo },
  secaoSub: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, lineHeight: 19, marginTop: 4, marginBottom: 12 },
  antigosBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: 6 },

  // Cartão de vidro do cupom
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.card, borderRadius: 22,
    borderWidth: 1, borderColor: colors.bordaLuz,
    padding: 14, marginBottom: 12,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  cardApagado: { opacity: 0.72 },
  iconeWrap: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  parceria: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.titulo },
  detalhe: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 2 },
  codigo: { fontFamily: fonts.bodySemi, letterSpacing: 0.6 },
  estadoLinha: { flexDirection: 'row', marginTop: 8 },
  situacaoChip: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  situacao: { fontFamily: fonts.bodyBold, fontSize: 11 },
  data: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tl, marginTop: 6 },
  direita: { alignItems: 'flex-end', justifyContent: 'center' },

  vazio: { alignItems: 'center', paddingTop: 70, gap: 10, paddingHorizontal: spacing.md },
  vazioIcone: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  vazioTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, textAlign: 'center' },
  vazioSub: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center', lineHeight: 21, maxWidth: 320 },
  vazioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    minHeight: 48, paddingHorizontal: 22, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.lav2, backgroundColor: colors.vidro,
  },
  vazioBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
}));
