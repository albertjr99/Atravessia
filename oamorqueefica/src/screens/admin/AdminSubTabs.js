import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, criarEstilos } from '../../theme';
import { est } from './adminEstilo';

// Sub-abas dentro de uma mesma seção do painel. Permite reunir telas irmãs
// (ex.: Conteúdos / Áudios Check-in / Frases) sob um único item da barra
// lateral, sem duplicar o conteúdo de cada tela.
export const GRUPOS_SUBTABS = {
  // "Outros conteúdos" (imagem, link e texto) é a sub-aba que substituiu a
  // antiga aba Conteúdos; áudios ficam em "Áudios Check-in".
  biblioteca: [
    { label: 'Áudios Check-in', screen: 'AdminAudios' },
    { label: 'Frases', screen: 'AdminFrases' },
    { label: 'Outros conteúdos', screen: 'AdminOutrosConteudos' },
    { label: 'Apresentações', screen: 'AdminVideos' },
    { label: 'Produtos Atravessia', screen: 'AdminProdutos' },
  ],
  jornada: [
    { label: 'Travessia', screen: 'AdminTravessia' },
    { label: 'Jornadas', screen: 'AdminJornadas' },
    { label: 'Vitórias', screen: 'AdminVitorias' },
  ],
  comunicacao: [
    { label: 'Notificações', screen: 'AdminNotificacoes' },
    { label: 'Mensagens', screen: 'AdminMensagens' },
  ],
  parcerias: [
    { label: 'Parcerias', screen: 'AdminParcerias' },
    { label: 'Cupons e Comissões', screen: 'AdminBeneficios' },
    { label: 'Cashback', screen: 'AdminCashback' },
    { label: 'Afiliados', screen: 'AdminIndicacoes' },
    { label: 'Pedidos de cashback', screen: 'AdminPedidosCashback' },
  ],
};

// Abas em pílulas num trilho de vidro; a aba ativa fica em branco sólido.
export default function AdminSubTabs({ grupo, atual }) {
  const navigation = useNavigation();
  const abas = GRUPOS_SUBTABS[grupo] || [];
  if (abas.length === 0) return null;

  return (
    <View style={s.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        <View style={s.trilho} accessibilityRole="tablist">
          {abas.map(aba => {
            const ativa = aba.screen === atual;
            return (
              <TouchableOpacity
                key={aba.screen}
                style={[s.tab, ativa && s.tabAtiva]}
                onPress={() => !ativa && navigation.navigate(aba.screen)}
                activeOpacity={0.75}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativa }}
              >
                <Text style={[s.txt, ativa && s.txtAtivo]}>{aba.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = criarEstilos(() => ({
  wrap: { paddingTop: 10, paddingBottom: 4 },
  row: { paddingHorizontal: spacing.lg },
  trilho: {
    ...est.trilho(),
    backgroundColor: colors.escuro ? colors.card : colors.vidro,
    ...est.sombra(),
    shadowOpacity: colors.escuro ? 0.25 : 0.07,
  },
  tab: est.aba(),
  tabAtiva: est.abaSel(),
  txt: est.abaTxt(),
  txtAtivo: est.abaTxtSel(),
}), { escalar: false });
