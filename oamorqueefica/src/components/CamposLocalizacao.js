import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, criarEstilos } from '../theme';
import { UFS, nomeDoEstado, formatarCidade } from '../utils/localizacao';

// Estado (UF) + cidade do perfil. Usado no cadastro, no Perfil e no pedido
// obrigatório de localização (LocalizacaoObrigatoria). Os dados vão para
// usuarios/{uid}.estado (sigla) e usuarios/{uid}.cidade e alimentam só os
// totais por estado/cidade dos relatórios (prospecção de parcerias).

// Valida e normaliza. Devolve { ok, erro, estado, cidade }.
export function validarLocalizacao({ estado, cidade }) {
  const uf = String(estado || '').trim().toUpperCase();
  const c = formatarCidade(cidade);
  if (!UFS.some(e => e.uf === uf)) return { ok: false, erro: 'Escolha o seu estado.' };
  if (c.length < 2) return { ok: false, erro: 'Informe a sua cidade.' };
  if (c.length > 60 || !/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s'’.-]*$/.test(c)) {
    return { ok: false, erro: 'Escreva só o nome da cidade, sem números ou símbolos.' };
  }
  return { ok: true, estado: uf, cidade: c };
}

// Rótulo e campo seguem o estilo de quem usa (estilos do formulário da tela).
export default function CamposLocalizacao({
  estado, cidade, onChangeEstado, onChangeCidade,
  estiloRotulo, estiloInput, obrigatorio = true, marcaObrigatorio,
}) {
  const [aberto, setAberto] = useState(false);
  const marca = obrigatorio ? (marcaObrigatorio || <Text style={{ color: colors.roseTexto }}> *</Text>) : null;

  return (
    <View>
      <Text style={estiloRotulo}>Estado{marca}</Text>
      <TouchableOpacity
        style={[estiloInput, s.seletor]}
        onPress={() => setAberto(true)}
        accessibilityRole="button"
        accessibilityLabel={estado ? `Estado: ${nomeDoEstado(estado)}. Tocar para trocar` : 'Escolher estado'}
      >
        <Text style={[s.seletorTxt, !estado && { color: colors.tl }]}>
          {estado ? `${nomeDoEstado(estado)} (${estado})` : 'Escolha o seu estado'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.tl} />
      </TouchableOpacity>

      <Text style={estiloRotulo}>Cidade{marca}</Text>
      <TextInput
        style={estiloInput}
        placeholder="Ex.: Campinas"
        placeholderTextColor={colors.tl}
        value={cidade}
        onChangeText={onChangeCidade}
        onBlur={() => cidade && onChangeCidade(formatarCidade(cidade))}
        autoCapitalize="words"
        autoComplete="off"
        textContentType="addressCity"
        maxLength={60}
      />

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <View style={s.veu}>
          <View style={s.caixa}>
            <View style={s.topo}>
              <Text style={s.titulo}>Escolha o seu estado</Text>
              <TouchableOpacity onPress={() => setAberto(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Fechar">
                <Ionicons name="close" size={22} color={colors.texto2} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={UFS}
              keyExtractor={e => e.uf}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const sel = item.uf === estado;
                return (
                  <TouchableOpacity
                    style={[s.item, sel && s.itemSel]}
                    onPress={() => { onChangeEstado(item.uf); setAberto(false); }}
                  >
                    <Text style={[s.itemTxt, sel && s.itemTxtSel]}>{item.nome}</Text>
                    <Text style={s.itemUf}>{item.uf}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = criarEstilos(() => ({
  seletor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seletorTxt: { fontFamily: fonts.body, fontSize: 14, color: colors.titulo, flex: 1 },
  veu: { flex: 1, backgroundColor: 'rgba(30,24,44,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  caixa: {
    width: '100%', maxWidth: 420, maxHeight: '80%', backgroundColor: colors.cardSolido,
    borderRadius: 24, paddingVertical: spacing.md, overflow: 'hidden',
  },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  titulo: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.titulo },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: spacing.lg, minHeight: 46 },
  itemSel: { backgroundColor: colors.lav1 },
  itemTxt: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.td },
  itemTxtSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
  itemUf: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.tl },
}), { escalar: false });
