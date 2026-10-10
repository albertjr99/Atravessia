import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { LavandaBg } from '../../components';
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
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconeBtn} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={24} color={colors.td} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Meu cashback</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <View style={s.coluna}>
          <View style={s.saldo}>
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
                <Ionicons name="arrow-forward" size={15} color="#5C4F8A" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={s.secTit}>Como funciona</Text>
          <View style={s.cartao}>
            {[
              { icone: 'ticket-outline', titulo: 'Use um cupom de parceria', texto: 'Gere o cupom em Experimente a vida e apresente no atendimento.' },
              { icone: 'checkmark-circle-outline', titulo: 'Confirme o atendimento', texto: `Ao confirmar, você ganha ${percentualTxt}% do valor do serviço em cashback.` },
              { icone: 'wallet-outline', titulo: 'Use como desconto', texto: `O saldo vira desconto no seu plano ou no relatório personalizado. Cada crédito vale por ${cfg.validadeMeses} meses.` },
            ].map((p, i) => (
              <View key={p.titulo} style={[s.passo, i > 0 && s.passoBorda]}>
                <View style={s.passoIcone}><Ionicons name={p.icone} size={19} color={colors.lav5} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.passoTit}>{p.titulo}</Text>
                  <Text style={s.passoTxt}>{p.texto}</Text>
                </View>
              </View>
            ))}
          </View>
          {!cfg.ativo && <Text style={s.pausado}>O programa de cashback está pausado no momento. Seu saldo continua valendo até a data de cada crédito.</Text>}

          <Text style={s.secTit}>Extrato</Text>
          {cashback.movimentos.length === 0 ? (
            <View style={s.vazio}>
              <Ionicons name="wallet-outline" size={26} color={colors.lav4} />
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
                    <Ionicons name={tp.icone} size={20} color={positivo ? colors.sage : colors.tm} />
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingBottom: 6 },
  iconeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.td },
  conteudo: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  coluna: { width: '100%', maxWidth: 620, alignSelf: 'center', gap: spacing.md },
  saldo: { backgroundColor: colors.botaoForte, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', gap: 6 },
  saldoRotulo: { fontFamily: fonts.bodyBold, fontSize: 12, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.8, textTransform: 'uppercase' },
  saldoValor: { fontFamily: fonts.serif, fontSize: 40, color: 'white' },
  saldoSub: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.88)', textAlign: 'center' },
  alerta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12 },
  alertaTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: 'white' },
  usar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'white', borderRadius: radius.full, paddingVertical: 10, paddingHorizontal: 18, marginTop: 8 },
  usarTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#5C4F8A' },
  secTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginTop: spacing.sm },
  cartao: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  passo: { flexDirection: 'row', gap: 12, paddingVertical: 14, alignItems: 'flex-start' },
  passoBorda: { borderTopWidth: 1, borderTopColor: colors.border },
  passoIcone: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  passoTit: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.td },
  passoTxt: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.tm, marginTop: 2 },
  pausado: { fontFamily: fonts.body, fontSize: 12.5, color: colors.goldFg, textAlign: 'center' },
  vazio: { alignItems: 'center', gap: 8, padding: spacing.lg, backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  vazioTxt: { fontFamily: fonts.body, fontSize: 13.5, color: colors.tm, textAlign: 'center' },
  link: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.lav5 },
  mov: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  movTit: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td },
  movSub: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginTop: 2 },
  movValor: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.tm },
  movPositivo: { color: colors.sageFg },
  nota: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center' },
}));
