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
      <View style={s.icone}><Ionicons name="wallet-outline" size={20} color={colors.sageFg} /></View>
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
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 12,
    backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  caixaAtiva: { borderColor: colors.sage, backgroundColor: colors.sageFundo },
  icone: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.sageFundo, alignItems: 'center', justifyContent: 'center' },
  tit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  sub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.texto2, marginTop: 2 },
}));
