import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, criarEstilos } from '../theme';

// Seletor sem rolagem lateral: decide sozinho como mostrar as opções.
//  · até `limite` opções (padrão 4) → pílulas que quebram linha;
//  · mais que isso → botão com a opção atual + seta, que abre uma lista.
// Props:
//   opcoes   [{ id, label, icone? }]   (icone = nome do Ionicons)
//   valor    id selecionado
//   onChange (id) => void
//   titulo   título da lista e rótulo de acessibilidade
//   mostrarTitulo  mostra o título acima (padrão: não)
//   limite   máximo de opções em pílulas (padrão 4)
//   estilo   estilo extra do contêiner
export default function SeletorOpcoes({
  opcoes = [], valor, onChange, titulo = 'Escolher', mostrarTitulo = false, limite = 4, estilo,
}) {
  const [aberto, setAberto] = useState(false);
  if (!opcoes.length) return null;
  const atual = opcoes.find(o => o.id === valor) || opcoes[0];
  const escolher = (id) => { setAberto(false); if (id !== valor) onChange?.(id); };

  const cabecalho = mostrarTitulo ? <Text style={s.titulo}>{titulo}</Text> : null;

  if (opcoes.length <= limite) {
    return (
      <View style={estilo}>
        {cabecalho}
        <View style={s.chips} accessibilityRole="tablist" accessibilityLabel={titulo}>
          {opcoes.map(o => {
            const sel = o.id === atual.id;
            return (
              <TouchableOpacity
                key={String(o.id)}
                style={[s.chip, sel && s.chipSel]}
                onPress={() => escolher(o.id)}
                activeOpacity={0.75}
                accessibilityRole="tab"
                accessibilityState={{ selected: sel }}
              >
                {!!o.icone && <Ionicons name={o.icone} size={15} color={sel ? colors.lilasTexto : colors.texto2} />}
                <Text style={[s.chipTxt, sel && s.chipTxtSel]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={estilo}>
      {cabecalho}
      <TouchableOpacity
        style={s.botao}
        onPress={() => setAberto(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${titulo}: ${atual.label}. Toque para ver as opções`}
      >
        {!!atual.icone && <Ionicons name={atual.icone} size={17} color={colors.lilasTexto} />}
        <Text style={s.botaoTxt} numberOfLines={2}>{atual.label}</Text>
        <Text style={s.botaoQtd}>{opcoes.length} opções</Text>
        <Ionicons name="chevron-down" size={18} color={colors.lilasTexto} />
      </TouchableOpacity>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <Pressable style={s.fundo} onPress={() => setAberto(false)} accessibilityLabel="Fechar lista">
          <Pressable style={s.caixa} onPress={() => {}}>
            <View style={s.caixaTopo}>
              <Text style={s.caixaTitulo}>{titulo}</Text>
              <TouchableOpacity onPress={() => setAberto(false)} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.texto2} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.lista} keyboardShouldPersistTaps="handled">
              {opcoes.map(o => {
                const sel = o.id === atual.id;
                return (
                  <TouchableOpacity
                    key={String(o.id)}
                    style={[s.item, sel && s.itemSel]}
                    onPress={() => escolher(o.id)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                  >
                    {!!o.icone && <Ionicons name={o.icone} size={18} color={sel ? colors.lilasTexto : colors.texto2} />}
                    <Text style={[s.itemTxt, sel && s.itemTxtSel]}>{o.label}</Text>
                    {sel && <Ionicons name="checkmark" size={18} color={colors.lilasTexto} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = criarEstilos(() => ({
  titulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.texto2, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.escuro ? colors.vidroTenue : colors.vidro,
  },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav3 },
  chipTxt: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.texto2 },
  chipTxtSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },

  botao: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, alignSelf: 'stretch',
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1,
    borderColor: colors.lav3, backgroundColor: colors.escuro ? colors.vidroTenue : colors.cardSolido,
  },
  botaoTxt: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.lilasTexto },
  botaoQtd: { fontFamily: fonts.body, fontSize: 12, color: colors.texto2 },

  fundo: { flex: 1, backgroundColor: 'rgba(20,14,30,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  caixa: {
    width: '100%', maxWidth: 440, maxHeight: '80%', backgroundColor: colors.cardSolido,
    borderRadius: 22, paddingVertical: 12, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  caixaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 },
  caixaTitulo: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 17, color: colors.titulo },
  lista: { paddingHorizontal: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, borderRadius: 14 },
  itemSel: { backgroundColor: colors.lav1 },
  itemTxt: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.td },
  itemTxtSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
}), { escalar: false });
