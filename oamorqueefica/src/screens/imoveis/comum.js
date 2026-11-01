import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import { urlDeImagem } from '../../utils/imagemUrl';

// Peças comuns das telas "Lar e recomeço" (vitrine de imobiliárias, imóveis,
// indicação e acompanhamento).

export function tomDe(tom) {
  switch (tom) {
    case 'salvia': return { fundo: colors.sageFundo, tinta: colors.sageFg };
    case 'dourado': return { fundo: colors.douradoFundo, tinta: colors.douradoTitulo };
    case 'pessego': return { fundo: colors.roseFundo, tinta: colors.roseFg };
    case 'nevoa': return { fundo: colors.escuro ? 'rgba(169,193,236,0.14)' : '#E3EAF7', tinta: colors.escuro ? '#C3D4F2' : '#3F5A86' };
    case 'lilas': return { fundo: colors.lav1, tinta: colors.lilasTexto };
    default: return { fundo: colors.muted, tinta: colors.texto2 };
  }
}

export function TopoImoveis({ titulo, onVoltar, direita }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[c.topBar, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={onVoltar} style={c.backBtn} accessibilityLabel="Voltar">
        <Ionicons name="chevron-back" size={22} color={colors.lav6} />
      </TouchableOpacity>
      <Text style={c.topTitle} numberOfLines={1}>{titulo}</Text>
      {direita || <View style={{ width: 44 }} />}
    </View>
  );
}

// Chips que quebram linha (nada de rolar para o lado).
export function ChipsQuebra({ opcoes, valor, onMudar, rotulo }) {
  return (
    <View style={{ marginTop: 6 }}>
      {!!rotulo && <Text style={c.rotulo}>{rotulo}</Text>}
      <View style={c.chipsWrap}>
        {opcoes.map(o => {
          const sel = o.id === valor;
          return (
            <TouchableOpacity
              key={o.id}
              style={[c.chip, sel && c.chipSel]}
              onPress={() => onMudar(o.id)}
              activeOpacity={0.75}
              accessibilityState={{ selected: sel }}
            >
              <Text style={[c.chipTxt, sel && c.chipTxtSel]}>{o.rotulo}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Lista suspensa: botão que abre uma folha com as opções.
export function Suspensa({ rotulo, valor, opcoes, onMudar, icone = 'location-outline', placeholder = 'Escolher' }) {
  const [aberta, setAberta] = useState(false);
  const atual = opcoes.find(o => o.id === valor);
  return (
    <View style={{ marginTop: 6 }}>
      {!!rotulo && <Text style={c.rotulo}>{rotulo}</Text>}
      <TouchableOpacity style={c.suspensa} onPress={() => setAberta(true)} activeOpacity={0.8} accessibilityRole="button">
        <Ionicons name={icone} size={17} color={colors.lilasIcone} />
        <Text style={c.suspensaTxt} numberOfLines={1}>{atual?.rotulo || placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.tl} />
      </TouchableOpacity>
      <Modal visible={aberta} transparent animationType="fade" onRequestClose={() => setAberta(false)}>
        <Pressable style={c.modalFundo} onPress={() => setAberta(false)}>
          <Pressable style={c.modalCaixa} onPress={() => {}}>
            <Text style={c.modalTit}>{rotulo || 'Escolha'}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {opcoes.map(o => (
                <TouchableOpacity key={o.id} style={c.opcao} onPress={() => { onMudar(o.id); setAberta(false); }}>
                  <Text style={[c.opcaoTxt, o.id === valor && c.opcaoSel]}>{o.rotulo}</Text>
                  {o.id === valor && <Ionicons name="checkmark" size={18} color={colors.lilasTexto} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function ImagemOuIcone({ url, estilo, icone = 'home-outline', tam = 28, resizeMode = 'cover' }) {
  const [erro, setErro] = useState(false);
  const src = urlDeImagem(url);
  if (src && !erro) return <Image source={{ uri: src }} style={estilo} resizeMode={resizeMode} onError={() => setErro(true)} />;
  return (
    <View style={[estilo, c.semImagem]}>
      <Ionicons name={icone} size={tam} color={colors.lilasIcone} />
    </View>
  );
}

export function Etiqueta({ texto, tom = 'lilas', icone }) {
  const t = tomDe(tom);
  return (
    <View style={[c.etiqueta, { backgroundColor: t.fundo }]}>
      {!!icone && <Ionicons name={icone} size={13} color={t.tinta} />}
      <Text style={[c.etiquetaTxt, { color: t.tinta }]}>{texto}</Text>
    </View>
  );
}

export const c = criarEstilos(() => ({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidro, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 24, color: colors.titulo },
  rotulo: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2, marginBottom: 8, marginTop: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.vidro, paddingHorizontal: 14, paddingVertical: 8, minHeight: 38, justifyContent: 'center',
  },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav3 },
  chipTxt: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.texto2 },
  chipTxtSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
  suspensa: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 14,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.vidro,
  },
  suspensaTxt: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.td },
  modalFundo: { flex: 1, backgroundColor: colors.sobreposicao || 'rgba(42,36,51,0.4)', justifyContent: 'center', padding: spacing.lg },
  modalCaixa: { backgroundColor: colors.cardSolido || colors.card, borderRadius: 24, padding: spacing.lg, maxWidth: 480, width: '100%', alignSelf: 'center' },
  modalTit: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.titulo, marginBottom: 10 },
  opcao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.bordaSuave || colors.border },
  opcaoTxt: { fontFamily: fonts.body, fontSize: 15, color: colors.td, flex: 1 },
  opcaoSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
  semImagem: { backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  etiqueta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  etiquetaTxt: { fontFamily: fonts.bodyBold, fontSize: 11.5 },
}));
