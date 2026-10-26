import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';

const ilVazio = require('../../../assets/images/il_folha_vento.png');
import { useApp } from '../../hooks/AppContext';

const ICONES = {
  inatividade: 'time-outline',
  data_sensivel: 'calendar-outline',
  conteudo: 'headset-outline',
  feedback: 'analytics-outline',
  relatorio: 'document-text-outline',
  vitoria: 'star-outline',
  incentivo: 'heart-outline',
  live: 'videocam-outline',
  confirmar_resgate: 'gift-outline',
};

const DESTINO = {
  inatividade: 'CheckIn',
  conteudo: 'CheckIn',
  data_sensivel: 'DatasSensiveis',
  feedback: 'Relatorios',
  relatorio: 'Relatorios',
  vitoria: 'Inicio',
  incentivo: 'CheckIn',
  live: 'Audios',
  // Tipos publicados pelo painel administrativo do app (AdminNotificacoesScreen)
  // que ainda não tinham destino — o toque não fazia nada.
  novidade: 'Audios',
  lembrete: 'CheckIn',
  // Gerado pela Cloud Function confirmarAtendimento quando um parceiro
  // registra o uso de um benefício — leva direto para a tela de confirmação.
  confirmar_resgate: 'ConfirmarResgate',
  // Gerado pelas Cloud Functions do cashback (crédito recebido / a vencer).
  cashback: 'Cashback',
  // Resposta a um pedido de cashback de afiliados (recusa com motivo).
  cashback_afiliado: 'MeusPedidosCashback',
};

export default function NotificacoesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { notificacoes, marcarLida } = useApp();
  const naoLidas = notificacoes.filter(n => !n.lida).length;

  const handlePress = (n) => {
    marcarLida(n.id);
    const dest = DESTINO[n.tipo];
    if (!dest) return;
    if (n.tipo === 'confirmar_resgate') {
      navigation.navigate(dest, { resgateId: n.resgateId });
    } else {
      navigation.navigate(dest);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.titulo} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.topTitle}>Notificações</Text>
          {naoLidas > 0 && (
            <Text style={styles.topSub}>
              {naoLidas === 1 ? '1 não lida' : `${naoLidas} não lidas`}
            </Text>
          )}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.lista}>
        {notificacoes.length === 0 ? (
          <View style={styles.empty}>
            <Moldura source={ilVazio} tamanho={120} />
            <Text style={styles.emptyText}>Nenhuma notificação por aqui ainda.</Text>
          </View>
        ) : (
          notificacoes.map(n => (
            <TouchableOpacity
              key={n.id}
              style={[styles.item, !n.lida && styles.itemNaoLido]}
              onPress={() => handlePress(n)}
              activeOpacity={0.85}
            >
              {!n.lida && <View style={styles.acento} />}
              <View style={[styles.itemIcon, !n.lida && styles.itemIconNaoLido]}>
                <Ionicons
                  name={ICONES[n.tipo] || 'notifications-outline'}
                  size={19}
                  color={n.lida ? colors.lilasIcone : '#fff'}
                />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                {!n.lida && (
                  <View style={styles.novaTag}>
                    <Text style={styles.novaTagTxt}>NOVA</Text>
                  </View>
                )}
                <Text style={[styles.itemTexto, !n.lida && styles.itemTextoNaoLido]}>{n.texto}</Text>
                {DESTINO[n.tipo] && (
                  <Text style={styles.itemAcao}>Toque para acessar</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.lilasTexto} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


// Cartão de vidro: véu translúcido, borda de luz e sombra ameixa suave.
const vidro = () => ({
  backgroundColor: colors.card,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: colors.bordaLuz,
  shadowColor: colors.sombra,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: colors.escuro ? 0.28 : 0.11,
  shadowRadius: 20,
  elevation: 2,
});

// Ilustração da marca numa moldura arredondada (sem tintColor).
function Moldura({ source, tamanho = 120 }) {
  const extra = Math.round(tamanho * 0.1);
  return (
    <View style={{
      width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.26), overflow: 'hidden',
      borderWidth: 1, borderColor: colors.bordaLuz, backgroundColor: colors.cardSolido, flexShrink: 0,
    }}>
      <Image source={source} style={{ width: tamanho + extra * 2, height: tamanho + extra * 2, margin: -extra }} resizeMode="cover" />
    </View>
  );
}

const styles = criarEstilos(() => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 4 }, shadowOpacity: colors.escuro ? 0.25 : 0.08, shadowRadius: 10, elevation: 2,
  },
  topTitle: { textAlign: 'center', fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.titulo },
  lista: { paddingHorizontal: spacing.lg, paddingTop: 8, gap: 10, paddingBottom: spacing.xxl },
  item: { ...vidro(), flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, overflow: 'hidden' },
  itemNaoLido: { backgroundColor: colors.escuro ? colors.card : 'rgba(255,255,255,0.86)', paddingLeft: 18 },
  acento: {
    position: 'absolute', left: 0, top: 12, bottom: 12,
    width: 4, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: colors.botao,
  },
  itemIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: colors.lav1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  itemIconNaoLido: { backgroundColor: colors.botao },
  novaTag: {
    alignSelf: 'flex-start', backgroundColor: '#C9435C',
    borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2,
  },
  novaTagTxt: { fontFamily: fonts.bodyBold, fontSize: 9, color: '#fff', letterSpacing: 0.8 },
  itemTexto: { fontFamily: fonts.body, fontSize: 14, color: colors.titulo, lineHeight: 20 },
  itemTextoNaoLido: { fontFamily: fonts.bodyBold },
  itemAcao: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.lilasTexto },
  topSub: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.lilasTexto, marginTop: 1 },
  empty: { ...vidro(), alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 14, marginTop: 8 },
  emptyText: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, color: colors.titulo, textAlign: 'center' },
}));
