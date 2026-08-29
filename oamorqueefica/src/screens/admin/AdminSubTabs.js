import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, spacing, radius } from '../../theme';

// Sub-abas dentro de uma mesma seção do painel. Permite reunir telas irmãs
// (ex.: Conteúdos / Áudios Check-in / Frases) sob um único item da barra
// lateral, sem duplicar o conteúdo de cada tela.
export const GRUPOS_SUBTABS = {
  conteudos: [
    { label: 'Conteúdos', screen: 'AdminConteudos' },
    { label: 'Áudios Check-in', screen: 'AdminAudios' },
    { label: 'Frases', screen: 'AdminFrases' },
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
};

export default function AdminSubTabs({ grupo, atual }) {
  const navigation = useNavigation();
  const abas = GRUPOS_SUBTABS[grupo] || [];
  if (abas.length === 0) return null;

  return (
    <View style={s.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {abas.map(aba => {
          const ativa = aba.screen === atual;
          return (
            <TouchableOpacity
              key={aba.screen}
              style={[s.tab, ativa && s.tabAtiva]}
              onPress={() => !ativa && navigation.navigate(aba.screen)}
              activeOpacity={0.75}
            >
              <Text style={[s.txt, ativa && s.txtAtivo]}>{aba.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  row: { paddingHorizontal: spacing.lg, gap: 6, paddingVertical: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: 'transparent',
  },
  tabAtiva: { backgroundColor: colors.lav1, borderColor: colors.lav3 },
  txt: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tm },
  txtAtivo: { fontFamily: fonts.bodyBold, color: colors.lav5 },
});
