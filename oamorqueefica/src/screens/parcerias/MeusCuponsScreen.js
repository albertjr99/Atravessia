import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { LavandaBg } from '../../components';
import { useApp } from '../../hooks/AppContext';
import {
  situacaoCupom, descontoDoCupom, dataCurta, linkDoCupom,
} from '../../utils/cupons';

const SITUACAO = {
  ativo: { rotulo: 'Pronto para usar', cor: colors.sage, icone: 'ticket-outline' },
  aguardando: { rotulo: 'Confirme o atendimento', cor: colors.gold, icone: 'hourglass-outline' },
  usado: { rotulo: 'Usado', cor: colors.lav5, icone: 'checkmark-circle-outline' },
  expirado: { rotulo: 'Expirado', cor: colors.tl, icone: 'time-outline' },
};

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
    const desconto = descontoDoCupom(v);
    const apagado = v.situacao === 'usado' || v.situacao === 'expirado';
    return (
      <TouchableOpacity key={v.id} style={[s.card, apagado && s.cardApagado]} onPress={() => abrir(v)} activeOpacity={0.85}>
        <View style={[s.iconeWrap, { backgroundColor: info.cor + '1F' }]}>
          <Ionicons name={info.icone} size={20} color={info.cor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.parceria} numberOfLines={1}>{v.parceriaNome || 'Parceria'}</Text>
          <Text style={s.detalhe} numberOfLines={1}>
            {desconto > 0 ? `${desconto}% de desconto · ` : ''}{v.codigoPublico}
          </Text>
          <Text style={[s.data, v.situacao === 'aguardando' && { color: colors.goldFg }]} numberOfLines={2}>
            {linhaDeData(v, v.situacao)}
          </Text>
        </View>
        <View style={s.direita}>
          <Text style={[s.situacao, { color: info.cor }]}>{info.rotulo}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.tl} />
        </View>
      </TouchableOpacity>
    );
  };

  const total = (meusVouchers || []).length;

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Meus cupons</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: spacing.xxl + insets.bottom }]}
      >
        {total === 0 ? (
          <View style={s.vazio}>
            <Ionicons name="ticket-outline" size={48} color={colors.lav3} />
            <Text style={s.vazioTit}>Nenhum cupom por aqui ainda</Text>
            <Text style={s.vazioSub}>
              Quando você gerar um cupom em uma parceria do Cuide-se, ele fica guardado aqui
              para usar quando quiser.
            </Text>
            <TouchableOpacity style={s.vazioBtn} onPress={() => navigation.navigate('Parcerias')} activeOpacity={0.85}>
              <Text style={s.vazioBtnTxt}>Ver parcerias</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.lav5} />
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
                  <Ionicons name={verAntigos ? 'chevron-up' : 'chevron-down'} size={18} color={colors.tm} />
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  scroll: { paddingHorizontal: spacing.lg },

  secao: { marginTop: spacing.md },
  secaoTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td },
  secaoSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, lineHeight: 18, marginTop: 4, marginBottom: 10 },
  antigosBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, marginBottom: 6 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: 10,
    ...shadow.card,
  },
  cardApagado: { opacity: 0.72 },
  iconeWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  parceria: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td },
  detalhe: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },
  data: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tl, marginTop: 3 },
  direita: { alignItems: 'flex-end', gap: 4, maxWidth: 110 },
  situacao: { fontFamily: fonts.bodyBold, fontSize: 11, textAlign: 'right' },

  vazio: { alignItems: 'center', paddingTop: 70, gap: 10, paddingHorizontal: spacing.md },
  vazioTit: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.td, textAlign: 'center' },
  vazioSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  vazioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    paddingVertical: 11, paddingHorizontal: 20, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.lav3, backgroundColor: colors.lav1,
  },
  vazioBtnTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav5 },
});
