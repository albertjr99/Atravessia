import React from 'react';
import { View, Text, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, criarEstilos } from '../../theme';
import { useApp } from '../../hooks/AppContext';
import { brl } from './CashbackScreen';

// Opção "Usar meu cashback" antes de abrir o pagamento. Só aparece quando há
// saldo. O desconto final (respeitando os limites) é calculado pelo servidor
// e aparece já aplicado na página do Stripe.
export default function UsarCashback({ ativo, onChange }) {
  const { cashback } = useApp();
  if (!(cashback?.saldoCentavos > 0)) return null;
  return (
    <TouchableOpacity style={[s.caixa, ativo && s.caixaAtiva]} onPress={() => onChange(!ativo)} activeOpacity={0.85}
      accessibilityRole="switch" accessibilityState={{ checked: ativo }}>
      <View style={s.icone}><Ionicons name="wallet-outline" size={19} color={colors.sageFg} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.tit}>Usar meu cashback</Text>
        <Text style={s.sub}>Saldo de {brl(cashback.saldoCentavos)}. O desconto aparece na página de pagamento.</Text>
      </View>
      <Switch value={ativo} onValueChange={onChange} trackColor={{ true: colors.sage, false: colors.border }} thumbColor="white" />
    </TouchableOpacity>
  );
}

const s = criarEstilos(() => ({
  caixa: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 12,
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border,
  },
  caixaAtiva: { borderColor: colors.sage, backgroundColor: colors.sageFundo },
  icone: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sageFundo, alignItems: 'center', justifyContent: 'center' },
  tit: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.td },
  sub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.tm, marginTop: 1 },
}));
