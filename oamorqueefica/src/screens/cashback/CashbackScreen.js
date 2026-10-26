import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
import Recolhivel from '../../components/Recolhivel';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../hooks/AppContext';

// Meu cashback: saldo, créditos que vencem logo, como funciona e extrato.
// Os valores são gravados só pelo servidor (Cloud Functions).
export const brl = (centavos) => (Number(centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataCurta = (ms) => (ms ? new Date(ms).toLocaleDateString('pt-BR') : '');

const TIPO = {
  credito: { icone: 'add-circle-outline', sinal: '+' },
  uso: { icone: 'remove-circle-outline', sinal: '−' },
  estorno: { icone: 'close-circle-outline', sinal: '−' },
};

export default function CashbackScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { cashback } = useApp();
  const [cfg, setCfg] = useState({ percentual: 1, validadeMeses: 6, ativo: true });

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'cashback'), (snap) => {
    const c = snap.data() || {};
    setCfg({
      percentual: Number(c.percentual ?? 1),
      validadeMeses: Number(c.validadeMeses ?? 6),
      ativo: c.ativo !== false,
    });
  }, (e) => console.warn('[Cashback] config:', e?.message)), []);

  const agora = Date.now();
  const statusDe = (m) => {
    if (m.tipo !== 'credito') return null;
    if (m.estornado) return 'Estornado';
    const exp = m.expiraEm?.toMillis?.() || 0;
    if (exp <= agora) return (m.saldoCentavos || 0) > 0 ? 'Vencido' : 'Usado';
    if ((m.saldoCentavos || 0) === 0) return 'Usado';
    if ((m.saldoCentavos || 0) < (m.valorCentavos || 0)) return `Restam ${brl(m.saldoCentavos)} · vale até ${dataCurta(exp)}`;
    return `Vale até ${dataCurta(exp)}`;
  };

  const percentualTxt = String(cfg.percentual).replace('.', ',');

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      <StatusBar barStyle={colors.statusBar} translucent backgroundColor="transparent" />
      <LavandaBg />
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={22} color={colors.lav6} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Meu cashback</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <View style={s.coluna}>
          <View style={s.saldo}>
            {/* Cartão do saldo em degradê lilás, com brilho de vidro no topo */}
            <LinearGradient colors={[colors.botao, colors.botaoForte]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }} style={s.saldoGrad} />
            <View style={s.saldoIcone}><Ionicons name="wallet-outline" size={22} color="white" /></View>
            <Text style={s.saldoRotulo}>Saldo disponível</Text>
            <Text style={s.saldoValor}>{brl(cashback.saldoCentavos)}</Text>
            {cashback.aVencerCentavos > 0 ? (
              <View style={s.alerta}>
                <Ionicons name="time-outline" size={14} color="white" />
                <Text style={s.alertaTxt}>{brl(cashback.aVencerCentavos)} vencem nos próximos 30 dias</Text>
              </View>
            ) : cashback.proximoVencimento ? (
              <Text style={s.saldoSub}>Próximo vencimento: {dataCurta(cashback.proximoVencimento)}</Text>
            ) : (
              <Text style={s.saldoSub}>Use cupons de parceria para começar a juntar.</Text>
            )}
            {cashback.saldoCentavos > 0 && (
              <TouchableOpacity style={s.usar} onPress={() => navigation.navigate('Planos')} activeOpacity={0.85}>
                <Text style={s.usarTxt}>Usar no meu plano</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.botaoForte} />
              </TouchableOpacity>
            )}
          </View>

          {/* Explicação secundária: recolhida; abre sozinha só para quem ainda não tem movimentações. */}
          <Recolhivel
            titulo="Como funciona"
            subtitulo={`${percentualTxt}% de volta nos atendimentos de parceria`}
            icone="help-circle-outline"
            inicialAberto={cashback.movimentos.length === 0}
            estilo={{ marginBottom: 0 }}
            estiloConteudo={{ paddingBottom: 4 }}
          >
            {[
              { icone: 'ticket-outline', titulo: 'Use um cupom de parceria', texto: 'Gere o cupom em Experimente a vida e apresente no atendimento.' },
              { icone: 'checkmark-circle-outline', titulo: 'Confirme o atendimento', texto: `Ao confirmar, você ganha ${percentualTxt}% do valor do serviço em cashback.` },
              { icone: 'wallet-outline', titulo: 'Use como desconto', texto: `O saldo vira desconto no seu plano ou no relatório personalizado. Cada crédito vale por ${cfg.validadeMeses} meses.` },
            ].map((p, i) => (
              <View key={p.titulo} style={[s.passo, i > 0 && s.passoBorda]}>
                <View style={s.passoIcone}><Ionicons name={p.icone} size={20} color={colors.lilasIcone} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.passoTit}>{p.titulo}</Text>
                  <Text style={s.passoTxt}>{p.texto}</Text>
                </View>
              </View>
            ))}
          </Recolhivel>
          {!cfg.ativo && <Text style={s.pausado}>O programa de cashback está pausado no momento. Seu saldo continua valendo até a data de cada crédito.</Text>}

          <Text style={s.secTit}>Extrato</Text>
          {cashback.movimentos.length === 0 ? (
            <View style={s.vazio}>
              <View style={s.passoIcone}><Ionicons name="wallet-outline" size={22} color={colors.lilasIcone} /></View>
              <Text style={s.vazioTxt}>Seus créditos e descontos aparecem aqui.</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Parcerias')}>
                <Text style={s.link}>Ver parcerias com cupom</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.cartao}>
              {cashback.movimentos.map((m, i) => {
                const tp = TIPO[m.tipo] || TIPO.credito;
                const positivo = m.tipo === 'credito';
                const status = statusDe(m);
                return (
                  <View key={m.id} style={[s.mov, i > 0 && s.passoBorda]}>
                    <View style={[s.movIcone, positivo && s.movIconePositivo]}>
                      <Ionicons name={tp.icone} size={20} color={positivo ? colors.sageFg : colors.texto2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.movTit}>{m.descricao || (positivo ? 'Crédito' : 'Desconto')}</Text>
                      <Text style={s.movSub}>{dataCurta(m.criadoEm?.toMillis?.())}{status ? ` · ${status}` : ''}</Text>
                    </View>
                    <Text style={[s.movValor, positivo ? s.movPositivo : null]}>{tp.sinal} {brl(m.valorCentavos)}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <Text style={s.nota}>O cashback não pode ser trocado por dinheiro. Créditos vencidos deixam de valer.</Text>
        </View>
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
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  coluna: { width: '100%', gap: spacing.md },
  saldo: {
    borderRadius: 28, padding: spacing.xl, alignItems: 'center', gap: 6, overflow: 'hidden',
    backgroundColor: colors.botaoForte,
    shadowColor: colors.botaoForte, shadowOffset: { width: 0, height: 14 }, shadowOpacity: colors.escuro ? 0.45 : 0.3, shadowRadius: 24, elevation: 4,
  },
  saldoGrad: { ...StyleSheet.absoluteFillObject, borderRadius: 28, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)' },
  saldoIcone: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  saldoRotulo: { fontFamily: fonts.bodyBold, fontSize: 11, color: 'rgba(255,255,255,0.88)', letterSpacing: 1, textTransform: 'uppercase' },
  saldoValor: { fontFamily: fonts.bodyBold, fontSize: 40, lineHeight: 48, color: 'white', letterSpacing: -0.5 },
  saldoSub: { fontFamily: fonts.body, fontSize: 13.5, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  alerta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: 13 },
  alertaTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: 'white' },
  usar: {
    flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'white', borderRadius: radius.full,
    minHeight: 46, paddingHorizontal: 20, marginTop: 10,
  },
  usarTxt: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.botaoForte },
  secTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, marginTop: spacing.sm, marginLeft: 4 },
  cartao: {
    backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.bordaLuz, paddingHorizontal: spacing.md,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 10 }, shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 20, elevation: 2,
  },
  passo: { flexDirection: 'row', gap: 14, paddingVertical: 14, alignItems: 'flex-start' },
  passoBorda: { borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  passoIcone: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  passoTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  passoTxt: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.texto2, marginTop: 2 },
  pausado: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.douradoTitulo, textAlign: 'center' },
  vazio: {
    alignItems: 'center', gap: 8, padding: spacing.lg, backgroundColor: colors.card, borderRadius: 24,
    borderWidth: 1, borderColor: colors.bordaLuz,
  },
  vazioTxt: { fontFamily: fonts.body, fontSize: 14, color: colors.texto2, textAlign: 'center' },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto, paddingVertical: 8 },
  mov: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  movIcone: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  movIconePositivo: { backgroundColor: colors.sageFundo },
  movTit: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.titulo },
  movSub: { fontFamily: fonts.body, fontSize: 12, color: colors.texto2, marginTop: 2 },
  movValor: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.texto2 },
  movPositivo: { color: colors.sageFg },
  nota: { fontFamily: fonts.body, fontSize: 11.5, color: colors.tl, textAlign: 'center', lineHeight: 17 },
}));
