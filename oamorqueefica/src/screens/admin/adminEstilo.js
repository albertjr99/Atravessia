import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, criarEstilos } from '../../theme';

// Linguagem visual "Luz de Vidro" do painel no app: cartões de vidro sobre a
// aurora, títulos em Cormorant itálico, ícones em pílulas coloridas, abas em
// trilho de vidro e botões com degradê e degrau. Só aparência: nenhuma tela
// muda de dados, textos ou ações por causa deste arquivo.
//
// As funções de `est` devolvem estilos prontos e devem ser chamadas DENTRO de
// `criarEstilos(() => ({ ... }))`, para acompanhar o tema (claro/noturno).

export const F_NUM = 'Figtree_800ExtraBold';

// Acentos dos tokens d2 (fundo da pílula · tinta do ícone · texto forte).
const ACENTOS = {
  claro: {
    lilas: { fundo: '#ECE6FA', tinta: '#7A65CB', texto: '#524197' },
    pessego: { fundo: '#FCE7DC', tinta: '#D98A69', texto: '#94492F' },
    salvia: { fundo: '#E1EEE5', tinta: '#6E9B7E', texto: '#3D6A4E' },
    dourado: { fundo: '#F7EBD3', tinta: '#C9A15A', texto: '#765619' },
    nevoa: { fundo: '#E3EAF7', tinta: '#6F8CC2', texto: '#3F5A86' },
    rosa: { fundo: '#F9E1E9', tinta: '#C76F8E', texto: '#9C4463' },
    neutro: { fundo: 'rgba(42,36,51,0.06)', tinta: '#6F6880', texto: '#534C60' },
  },
  escuro: {
    lilas: { fundo: 'rgba(169,150,240,0.16)', tinta: '#BCAAF8', texto: '#CFC2FF' },
    pessego: { fundo: 'rgba(242,183,158,0.14)', tinta: '#F2B79E', texto: '#F6C8B4' },
    salvia: { fundo: 'rgba(159,208,176,0.14)', tinta: '#9FD0B0', texto: '#B7DEC4' },
    dourado: { fundo: 'rgba(229,198,139,0.14)', tinta: '#E5C68B', texto: '#EED6A6' },
    nevoa: { fundo: 'rgba(169,193,236,0.14)', tinta: '#A9C1EC', texto: '#C3D4F2' },
    rosa: { fundo: 'rgba(242,162,188,0.14)', tinta: '#F2A2BC', texto: '#F6BDD0' },
    neutro: { fundo: 'rgba(255,255,255,0.07)', tinta: '#ABA2BE', texto: '#CDC5DC' },
  },
};

export function acento(nome) {
  const tabela = colors.escuro ? ACENTOS.escuro : ACENTOS.claro;
  return tabela[nome] || tabela.lilas;
}

// Planos: mesma cor em todas as telas (Perceber sálvia, Acolher lilás,
// Compreender névoa, Evoluir pêssego, Acesso Total dourado).
const ACENTO_DO_PLANO = { 0: 'salvia', 1: 'lilas', 2: 'nevoa', 3: 'pessego', total: 'dourado' };
export const corPlano = (p) => acento(ACENTO_DO_PLANO[p] || 'lilas');

// Cor de dado (barras e gráficos) por plano.
const DADO_PLANO = { 0: '#6E9B7E', 1: '#8B7AC0', 2: '#6F8CC2', 3: '#D98A69', total: '#C9A15A' };
export const dadoPlano = (p) => (colors.escuro ? corPlano(p).tinta : (DADO_PLANO[p] || DADO_PLANO[1]));

const sombra = (forte) => ({
  shadowColor: colors.sombra,
  shadowOffset: { width: 0, height: forte ? 16 : 10 },
  shadowOpacity: colors.escuro ? (forte ? 0.5 : 0.3) : (forte ? 0.18 : 0.11),
  shadowRadius: forte ? 30 : 20,
  elevation: 2,
});

export const est = {
  sombra: () => sombra(false),
  sombraForte: () => sombra(true),
  // Cartão de vidro (fundo translúcido + borda de luz + sombra ameixa).
  vidro: (raio = 24) => ({
    backgroundColor: colors.card, borderRadius: raio,
    borderWidth: 1, borderColor: colors.bordaLuz, ...sombra(false),
  }),
  // Bloco tênue dentro de um cartão de vidro (sem borda dentro de borda).
  tenue: (raio = 16) => ({ backgroundColor: colors.escuro ? colors.vidroTenue : colors.lavVeu, borderRadius: raio }),
  divisoria: () => ({ borderTopWidth: 1, borderTopColor: colors.bordaSuave }),

  // Cabeçalho de página
  sobretitulo: () => ({
    fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase',
    color: colors.lilasTexto, marginBottom: 4,
  }),
  titulo: () => ({ fontFamily: fonts.serif, fontSize: 32, lineHeight: 38, color: colors.titulo }),
  subtitulo: () => ({ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.texto2, marginTop: 2 }),
  secao: () => ({ fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 24, color: colors.titulo }),
  cartaoTitulo: () => ({ fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21, color: colors.titulo }),
  corpo: () => ({ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.td }),
  legenda: () => ({ fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.texto2 }),
  numero: (tam = 26) => ({ fontFamily: F_NUM, fontSize: tam, letterSpacing: -0.5, color: colors.titulo }),

  // Formulários
  rotulo: () => ({ fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.texto2, marginTop: 14, marginBottom: 6 }),
  campo: () => ({
    backgroundColor: colors.cardSolido, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    minHeight: 48, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: fonts.body, fontSize: 15, color: colors.td,
  }),
  dica: () => ({ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.tl, marginTop: 6 }),
  obrigatorio: () => ({ color: colors.roseTexto }),

  // Chips de filtro/seleção
  chip: () => ({
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.escuro ? colors.vidroTenue : colors.vidro,
    borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 8, paddingHorizontal: 14, minHeight: 38,
  }),
  chipSel: () => ({ backgroundColor: colors.lav1, borderColor: colors.lav3 }),
  chipTxt: () => ({ fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.texto2 }),
  chipTxtSel: () => ({ fontFamily: fonts.bodyBold, color: colors.lilasTexto }),

  // Etiqueta pequena (plano, estado)
  etiqueta: () => ({
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
  }),
  etiquetaTxt: () => ({ fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16 }),

  // Abas / segmentado
  trilho: () => ({
    flexDirection: 'row', alignSelf: 'flex-start', gap: 2, padding: 4,
    backgroundColor: colors.escuro ? colors.vidroTenue : colors.vidro,
    borderRadius: 999, borderWidth: 1, borderColor: colors.bordaLuz,
  }),
  aba: () => ({
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 38, paddingHorizontal: 16, borderRadius: 999,
  }),
  abaSel: () => ({
    backgroundColor: colors.escuro ? 'rgba(255,255,255,0.10)' : colors.cardSolido,
    shadowColor: colors.sombra, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: colors.escuro ? 0.3 : 0.1, shadowRadius: 8, elevation: 1,
  }),
  abaTxt: () => ({ fontFamily: fonts.bodySemi, fontSize: 14, color: colors.texto2 }),
  abaTxtSel: () => ({ fontFamily: fonts.bodyBold, color: colors.lilasTexto }),

  // Botões
  botao: () => ({
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 50, paddingHorizontal: 22, borderRadius: 999,
    backgroundColor: colors.botaoForte, borderBottomWidth: 4, borderBottomColor: colors.botaoBase,
    shadowColor: '#5B48A8', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: colors.escuro ? 0.4 : 0.3, shadowRadius: 16, elevation: 3,
  }),
  botaoTxt: () => ({ fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF', textAlign: 'center' }),
  botaoSec: () => ({
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 48, paddingHorizontal: 20, borderRadius: 999,
    backgroundColor: colors.escuro ? colors.vidroTenue : colors.vidro, borderWidth: 1, borderColor: colors.lav2,
  }),
  botaoSecTxt: () => ({ fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.lilasTexto, textAlign: 'center' }),
  botaoIcone: () => ({
    width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.vidroTenue,
  }),

  // Pílula de ícone (quadrado arredondado)
  pilula: (tam = 42) => ({ width: tam, height: tam, borderRadius: tam >= 40 ? 14 : 11, alignItems: 'center', justifyContent: 'center' }),

  // Avisos dentro da tela (fundo do acento, sem borda)
  aviso: (nome = 'lilas') => ({
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: acento(nome).fundo, borderRadius: 16, padding: 14,
  }),
  avisoTxt: (nome = 'lilas') => ({ flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: acento(nome).texto }),

  // Modais: véu + cartão sólido
  veu: () => ({ flex: 1, backgroundColor: colors.sobreposicao }),
  modal: () => ({
    backgroundColor: colors.cardSolido, borderRadius: 28, borderWidth: 1, borderColor: colors.bordaLuz,
    ...sombra(true),
  }),
  folha: () => ({
    backgroundColor: colors.cardSolido, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderBottomWidth: 0, borderColor: colors.bordaLuz, ...sombra(true),
  }),
  modalTitulo: () => ({ fontFamily: fonts.serif, fontSize: 26, lineHeight: 32, color: colors.titulo }),
  fechar: () => ({
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.escuro ? colors.vidroTenue : colors.lavVeu,
  }),
};

// Degradê do botão principal (vai como primeiro filho de um botão com est.botao()).
export function Degrade({ raio = 999 }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[colors.botao, colors.botaoForte]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius: raio }]}
    />
  );
}

// Botão do painel: mesmas props do Button de components (title, onPress,
// variant, style, textStyle, disabled), com o visual novo.
export function BotaoAdmin({ title, onPress, variant = 'primary', style, textStyle, disabled, icone, carregando }) {
  const prim = variant === 'primary';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      style={[prim ? eb.prim : eb.sec, disabled && { opacity: 0.5 }, style]}
    >
      {prim && <Degrade />}
      {carregando
        ? <ActivityIndicator size="small" color={prim ? '#FFFFFF' : colors.lilasTexto} />
        : icone ? <Ionicons name={icone} size={17} color={prim ? '#FFFFFF' : colors.lilasTexto} /> : null}
      <Text style={[prim ? eb.primTxt : eb.secTxt, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

// Pílula de ícone pronta.
export function Pilula({ icone, nome = 'lilas', tam = 42, tamIcone }) {
  const a = acento(nome);
  return (
    <View style={[{ width: tam, height: tam, borderRadius: tam >= 40 ? 14 : 11, alignItems: 'center', justifyContent: 'center', backgroundColor: a.fundo }]}>
      <Ionicons name={icone} size={tamIcone || Math.round(tam * 0.5)} color={a.tinta} />
    </View>
  );
}

// Rodapé de ações de um item de lista: "Editar" (botão com rótulo) à
// esquerda e "Apagar" menor, em vermelho, afastado à direita, separados por
// uma linha. Áreas de toque ≥ 44px. A confirmação ao apagar fica com a tela.
// `extra` entra entre os dois (ex.: duplicar, ver detalhes).
export function AcoesItem({ onEditar, onApagar, rotuloEditar = 'Editar', rotuloApagar = 'Apagar', extra, estilo }) {
  return (
    <View style={[eb.acoes, estilo]}>
      {!!onEditar && (
        <TouchableOpacity onPress={onEditar} style={eb.editar} activeOpacity={0.8}
          accessibilityRole="button" accessibilityLabel={rotuloEditar}>
          <Ionicons name="create-outline" size={17} color={colors.lilasTexto} />
          <Text style={eb.editarTxt}>{rotuloEditar}</Text>
        </TouchableOpacity>
      )}
      {extra}
      <View style={{ flex: 1, minWidth: 16 }} />
      {!!onApagar && (
        <TouchableOpacity onPress={onApagar} style={eb.apagar} activeOpacity={0.7}
          accessibilityRole="button" accessibilityLabel={rotuloApagar}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
          <Ionicons name="trash-outline" size={15} color={colors.roseTexto} />
          <Text style={eb.apagarTxt}>{rotuloApagar}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Formulário de "novo item" num Recolhivel: fechado por padrão; ao editar,
// abre e rola até ele. Uso: const f = useFormRecolhivel(refDoScrollView);
// <View onLayout={f.onLayout}><Recolhivel aberto={f.aberto} onAlternar={f.setAberto} ...>
// e, no editar, f.abrirERolar().
export function useFormRecolhivel(rolagem, inicialAberto = false) {
  const [aberto, setAberto] = React.useState(inicialAberto);
  const posY = React.useRef(0);
  const onLayout = React.useCallback((e) => { posY.current = e.nativeEvent.layout.y; }, []);
  const abrirERolar = React.useCallback(() => {
    setAberto(true);
    // Espera o conteúdo abrir para rolar até o topo do formulário.
    setTimeout(() => rolagem?.current?.scrollTo?.({ y: Math.max(0, posY.current - 12), animated: true }), 120);
  }, [rolagem]);
  return { aberto, setAberto, onLayout, abrirERolar };
}

const eb = criarEstilos(() => ({
  prim: est.botao(),
  primTxt: est.botaoTxt(),
  sec: est.botaoSec(),
  secTxt: est.botaoSecTxt(),
  acoes: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.bordaSuave,
  },
  editar: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 999,
    backgroundColor: colors.lav1, borderWidth: 1, borderColor: colors.lav2,
  },
  editarTxt: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.lilasTexto },
  apagar: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 10 },
  apagarTxt: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.roseTexto },
}), { escalar: false });
