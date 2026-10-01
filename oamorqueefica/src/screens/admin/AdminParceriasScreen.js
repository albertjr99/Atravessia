import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  Alert, Platform, Image, Switch, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, radius } from '../../theme';
import { Card, Button } from '../../components';
import * as ImagePicker from 'expo-image-picker';
import { confirmar } from '../../utils/confirm';
import { uploadToStorage } from '../../utils/storageUpload';
import { normalizarUrl } from '../../utils/abrirLink';
import AdminLayout from './AdminLayout';
import AdminSubTabs from './AdminSubTabs';

// Mesmas categorias exibidas ao usuário na tela de Parcerias.
const CATEGORIAS = [
  { id: 'saude',           label: 'Da saúde física' },
  { id: 'voce',            label: 'De você e do ambiente em que vive' },
  { id: 'trabalho',        label: 'Do trabalho e estudos' },
  { id: 'relacionamentos', label: 'Dos relacionamentos' },
  { id: 'outros',          label: 'Outros' },
];
const rotuloCategoria = (id) => CATEGORIAS.find(c => c.id === id)?.label || id;

// Gera um token de leitura simples para o extrato do parceiro — não precisa
// ser criptograficamente forte (não protege dinheiro, só um resumo de
// leitura), mas precisa ser difícil de adivinhar por acaso.
function gerarTokenPainel() {
  return Array.from({ length: 3 }, () => Math.random().toString(36).slice(2, 10)).join('');
}

export default function AdminParceriasScreen({ navigation }) {
  const [parcerias, setParcerias] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [link, setLink] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  const [categoriaSel, setCategoriaSel] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [uploadando, setUploadando] = useState(false);

  // Nem toda parceria gera comissão — a maioria é só um link/desconto direto.
  const [tipoBeneficio, setTipoBeneficio] = useState('link');
  const [percentualBeneficio, setPercentualBeneficio] = useState('10');
  const [percentualComissao, setPercentualComissao] = useState('3');
  // A comissão é sempre calculada sobre o valor original do serviço (antes do
  // desconto). A opção "valor final" foi retirada — o backend também só aceita
  // 'valor_original'.
  const [validadeDiasVoucher, setValidadeDiasVoucher] = useState('30');

  const descontoClienteCalculado = Math.max(
    0, (parseFloat(percentualBeneficio) || 0) - (parseFloat(percentualComissao) || 0)
  );

  // Exemplo em reais para a prévia: sempre sobre um serviço de R$ 100,00.
  const exemploComissao = parseFloat(percentualComissao) || 0;
  const exemploPaga = Math.max(0, 100 - descontoClienteCalculado);
  const brl = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  const [erroLista, setErroLista] = useState('');

  useEffect(() => {
    // Sem orderBy: o Firestore descartaria parcerias sem `criadoEm` e um
    // listener com erro para de vez. Ordena aqui, no cliente.
    const unsub = onSnapshot(collection(db, 'parcerias'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));
      setParcerias(docs);
      setErroLista('');
    }, (e) => setErroLista(e?.message || 'Não foi possível carregar as parcerias.'));
    return unsub;
  }, []);

  const handleUploadImagem = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadando(true);
        try {
          const { ref: sRef, uploadBytes, getDownloadURL } = require('firebase/storage');
          const { storage } = require('../../services/firebase');
          const nomeArq = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
          const fileRef = sRef(storage, `parcerias/${nomeArq}`);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          setImagemUrl(url);
          Alert.alert('', 'Imagem carregada! O link foi preenchido automaticamente.');
        } catch (err) {
          Alert.alert('Erro no upload', err?.code || err?.message || 'Tente novamente.');
        } finally {
          setUploadando(false);
        }
      };
      document.body.appendChild(input);
      input.click();
      setTimeout(() => { if (document.body.contains(input)) document.body.removeChild(input); }, 5000);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações do app.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      setUploadando(true);
      try {
        const nomeArq = `parcerias_${Date.now()}.jpg`;
        const url = await uploadToStorage(uri, `parcerias/${nomeArq}`, 'image/jpeg');
        setImagemUrl(url);
        Alert.alert('', 'Imagem carregada! O link foi preenchido automaticamente.');
      } catch (err) {
        Alert.alert('Erro no upload', err?.code || err?.message || 'Tente novamente.');
      } finally {
        setUploadando(false);
      }
    }
  };

  const toggleCategoria = (cat) => {
    setCategoriaSel(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handlePublicar = async () => {
    if (!titulo.trim()) {
      Alert.alert('Atenção', 'Preencha pelo menos o título.');
      return;
    }
    // O link é opcional; quando preenchido, é normalizado (https://, wa.me…).
    const linkBruto = link.trim();
    const linkFinal = linkBruto ? normalizarUrl(linkBruto) : '';
    if (linkBruto && !linkFinal) {
      Alert.alert('Atenção', 'O link de destino não parece um endereço válido. Confira ou deixe o campo em branco.');
      return;
    }
    if (tipoBeneficio === 'cupom' && (!percentualBeneficio || parseFloat(percentualBeneficio) <= 0)) {
      Alert.alert('Atenção', 'Informe o percentual total do benefício para o cupom.');
      return;
    }
    setEnviando(true);
    try {
      const dados = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        link: linkFinal,
        imagemUrl: imagemUrl.trim(),
        categorias: categoriaSel,
        ativo: true,
        cliques: 0,
        tipoBeneficio,
        criadoEm: serverTimestamp(),
      };
      if (tipoBeneficio === 'cupom') {
        dados.percentualBeneficio = parseFloat(percentualBeneficio) || 0;
        dados.percentualComissao = parseFloat(percentualComissao) || 0;
        dados.percentualDescontoCliente = descontoClienteCalculado;
        dados.baseCalculoComissao = 'valor_original';
        dados.validadeDiasVoucher = parseInt(validadeDiasVoucher, 10) || 30;
        dados.tokenPainel = gerarTokenPainel();
      }
      await addDoc(collection(db, 'parcerias'), dados);
      setTitulo(''); setDescricao(''); setLink(''); setImagemUrl(''); setCategoriaSel([]);
      setTipoBeneficio('link'); setPercentualBeneficio('10'); setPercentualComissao('3');
      Alert.alert('', 'Parceria publicada com sucesso!');
    } catch (e) {
      Alert.alert('Erro', `Não foi possível publicar a parceria.${e?.message ? `\n${e.message}` : ''}`);
    } finally {
      setEnviando(false);
    }
  };

  const handleToggleAtivo = (p) => {
    updateDoc(doc(db, 'parcerias', p.id), { ativo: p.ativo === false })
      .catch((e) => Alert.alert('Erro', `Não foi possível alterar a parceria.${e?.message ? `\n${e.message}` : ''}`));
  };

  const handleRemover = (id) => {
    confirmar('Remover parceria', 'Tem certeza que deseja remover esta parceria?',
      () => deleteDoc(doc(db, 'parcerias', id))
        .catch((e) => Alert.alert('Erro', `Não foi possível remover a parceria.${e?.message ? `\n${e.message}` : ''}`)),
      'Remover');
  };

  const ativas = parcerias.filter(p => p.ativo !== false).length;
  const totalCliques = parcerias.reduce((s, p) => s + (p.cliques || 0), 0);

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminParcerias">
      <AdminSubTabs grupo="parcerias" atual="AdminParcerias" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        <Text style={s.pageTitle}>Parcerias</Text>
        <Text style={s.pageSub}>
          Crie banners de parceria e benefícios exclusivos que aparecem para todas as usuárias no app, direto do plano gratuito.
        </Text>

        {/* ── Resumo ── */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Ionicons name="people-outline" size={18} color={colors.lav4} />
            <Text style={[s.statNum, { color: colors.lav4 }]}>{parcerias.length}</Text>
            <Text style={s.statLbl}>total</Text>
          </View>
          <View style={s.statBox}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.sage} />
            <Text style={[s.statNum, { color: colors.sage }]}>{ativas}</Text>
            <Text style={s.statLbl}>ativas</Text>
          </View>
          <View style={s.statBox}>
            <Ionicons name="stats-chart-outline" size={18} color={colors.gold} />
            <Text style={[s.statNum, { color: colors.gold }]}>{totalCliques}</Text>
            <Text style={s.statLbl}>cliques totais</Text>
          </View>
        </View>

        {/* ── Formulário ── */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={s.cardTitle}>Nova parceria / benefício</Text>

          <Text style={s.formLabel}>Título <Text style={s.required}>*</Text></Text>
          <TextInput
            style={s.input}
            placeholder="Ex: 10% de desconto na Farmácia X"
            placeholderTextColor={colors.tl}
            value={titulo}
            onChangeText={setTitulo}
          />

          <Text style={s.formLabel}>Descrição <Text style={s.optional}>(opcional)</Text></Text>
          <TextInput
            style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
            placeholder="Descreva o benefício ou como utilizá-lo..."
            placeholderTextColor={colors.tl}
            multiline
            value={descricao}
            onChangeText={setDescricao}
          />

          <Text style={s.formLabel}>Link de destino <Text style={s.optional}>(opcional)</Text></Text>
          <TextInput
            style={s.input}
            placeholder="https://..."
            placeholderTextColor={colors.tl}
            autoCapitalize="none"
            value={link}
            onChangeText={setLink}
          />
          <Text style={s.hint}>Se preenchido, a usuária é levada a este endereço ao tocar na parceria.</Text>

          <Text style={s.formLabel}>Banner / imagem da parceria</Text>
          <TouchableOpacity
            style={[s.uploadArea, uploadando && { opacity: 0.6 }]}
            onPress={handleUploadImagem}
            disabled={uploadando}
          >
            <Ionicons name={uploadando ? 'hourglass-outline' : 'image-outline'} size={24} color={colors.lav4} />
            <Text style={s.uploadLabel}>
              {uploadando ? 'Fazendo upload...' : 'Clique para enviar imagem do banner'}
            </Text>
            <Text style={s.uploadHint}>PNG, JPG — Tamanho sugerido: 800×400 px</Text>
          </TouchableOpacity>
          <Text style={s.orText}>— ou cole um link de imagem —</Text>
          <TextInput
            style={s.input}
            placeholder="https://..."
            placeholderTextColor={colors.tl}
            autoCapitalize="none"
            value={imagemUrl}
            onChangeText={setImagemUrl}
          />
          {imagemUrl ? (
            <Image source={{ uri: imagemUrl }} style={s.previewImg} resizeMode="cover" />
          ) : null}

          <Text style={s.formLabel}>Categorias</Text>
          <View style={s.chipRow}>
            {CATEGORIAS.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[s.chip, categoriaSel.includes(cat.id) && s.chipSel]}
                onPress={() => toggleCategoria(cat.id)}
              >
                <Text style={[s.chipText, categoriaSel.includes(cat.id) && s.chipTextSel]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.formLabel}>Tipo de benefício</Text>
          <View style={s.tipoRow}>
            <TouchableOpacity
              style={[s.tipoOpc, tipoBeneficio === 'link' && s.tipoOpcSel]}
              onPress={() => setTipoBeneficio('link')}
            >
              <Ionicons name="link-outline" size={16} color={tipoBeneficio === 'link' ? colors.lav5 : colors.tm} />
              <View style={{ flex: 1 }}>
                <Text style={[s.tipoOpcTit, tipoBeneficio === 'link' && s.tipoOpcTitSel]}>Link simples</Text>
                <Text style={s.tipoOpcDesc}>Desconto direto — sem comissão nem rastreamento financeiro.</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tipoOpc, tipoBeneficio === 'cupom' && s.tipoOpcSel]}
              onPress={() => setTipoBeneficio('cupom')}
            >
              <Ionicons name="pricetag-outline" size={16} color={tipoBeneficio === 'cupom' ? colors.lav5 : colors.tm} />
              <View style={{ flex: 1 }}>
                <Text style={[s.tipoOpcTit, tipoBeneficio === 'cupom' && s.tipoOpcTitSel]}>Cupom com comissão</Text>
                <Text style={s.tipoOpcDesc}>Gera voucher, o parceiro confirma o atendimento e a Atravessia recebe uma comissão.</Text>
              </View>
            </TouchableOpacity>
          </View>

          {tipoBeneficio === 'cupom' && (
            <View style={s.comissaoBox}>
              <View style={s.linha2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Benefício total (%)</Text>
                  <TextInput
                    style={s.input} keyboardType="decimal-pad"
                    value={percentualBeneficio} onChangeText={setPercentualBeneficio}
                    placeholder="10" placeholderTextColor={colors.tl}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Comissão Atravessia (%)</Text>
                  <TextInput
                    style={s.input} keyboardType="decimal-pad"
                    value={percentualComissao} onChangeText={setPercentualComissao}
                    placeholder="3" placeholderTextColor={colors.tl}
                  />
                </View>
              </View>
              <Text style={s.calculoTxt}>
                Desconto que chega à usuária: <Text style={s.calculoForte}>{descontoClienteCalculado.toFixed(1)}%</Text>
                {'  '}·{'  '}Comissão da Atravessia: <Text style={s.calculoForte}>{percentualComissao || 0}% do valor original</Text>
              </Text>

              <View style={s.infoBase}>
                <Ionicons name="information-circle-outline" size={15} color={colors.lav5} />
                <Text style={s.infoBaseTxt}>
                  A comissão é calculada sobre o valor original do serviço (antes do desconto).
                  {' '}Ex.: num serviço de {brl(100)}, a usuária paga {brl(exemploPaga)} e a comissão da Atravessia é {brl(exemploComissao)}.
                </Text>
              </View>

              <Text style={s.formLabel}>Validade de cada cupom (dias)</Text>
              <TextInput
                style={s.input} keyboardType="number-pad"
                value={validadeDiasVoucher} onChangeText={setValidadeDiasVoucher}
                placeholder="30" placeholderTextColor={colors.tl}
              />
              <Text style={s.hint}>A usuária pode gerar quantos cupons quiser; cada um vale para um único atendimento.</Text>
            </View>
          )}

          <Button
            title={enviando ? 'Publicando...' : 'Publicar parceria no app'}
            onPress={handlePublicar}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* ── Lista ── */}
        <Text style={s.sectionTitle}>
          Publicadas ({parcerias.length}) · {ativas} ativas
        </Text>

        {!!erroLista && (
          <View style={s.erroBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.roseFg} />
            <Text style={s.erroTxt}>Não foi possível carregar as parcerias: {erroLista}</Text>
          </View>
        )}

        {parcerias.length === 0 && !erroLista && (
          <Text style={s.emptyText}>Nenhuma parceria publicada ainda.</Text>
        )}

        {parcerias.map(p => (
          <Card key={p.id} style={s.item}>
            {p.imagemUrl ? (
              <Image source={{ uri: p.imagemUrl }} style={s.itemThumb} resizeMode="cover" />
            ) : (
              <View style={[s.itemThumb, s.itemThumbPlaceholder]}>
                <Ionicons name="image-outline" size={20} color={colors.tl} />
              </View>
            )}
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <Text style={s.itemTitulo} numberOfLines={1}>{p.titulo}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {(p.categorias || []).slice(0, 2).map(cat => (
                  <Text key={cat} style={s.itemTag}>{rotuloCategoria(cat)}</Text>
                ))}
                {p.tipoBeneficio === 'cupom' ? (
                  <View style={s.cupomTag}>
                    <Ionicons name="pricetag" size={10} color="#8A6A33" />
                    <Text style={s.cupomTagTxt}>Cupom · {p.percentualComissao || 0}% comissão</Text>
                  </View>
                ) : (
                  <View style={s.cliquesTag}>
                    <Ionicons name="stats-chart-outline" size={10} color={colors.lav5} />
                    <Text style={s.cliquesTagTxt}>{p.cliques || 0} cliques</Text>
                  </View>
                )}
              </View>
              {p.link
                ? <Text style={s.itemLink} numberOfLines={1}>{p.link}</Text>
                : <Text style={[s.itemLink, { color: colors.tl }]}>Sem link de destino</Text>}
              {p.tipoBeneficio === 'cupom' && (
                <TouchableOpacity onPress={() => navigation.navigate('AdminBeneficios', { parceriaId: p.id })}>
                  <Text style={s.verComissoesLink}>Ver cupons e comissões →</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.itemActions}>
              <Switch
                value={p.ativo !== false}
                onValueChange={() => handleToggleAtivo(p)}
                trackColor={{ false: colors.border, true: colors.lav3 }}
                thumbColor={p.ativo !== false ? colors.lav4 : colors.tl}
              />
              <Text style={s.switchLbl}>{p.ativo !== false ? 'Ativa' : 'Oculta'}</Text>
              <TouchableOpacity onPress={() => handleRemover(p.id)} style={{ padding: 4, marginTop: 4 }}>
                <Ionicons name="trash-outline" size={17} color={colors.peach2} />
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </ScrollView>
      </KeyboardAvoidingView>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: 4 },
  pageSub: { fontFamily: fonts.body, fontSize: 13, color: colors.tm, marginBottom: spacing.lg, lineHeight: 20 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  statBox: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  statNum: { fontFamily: fonts.bodyBold, fontSize: 22 },
  statLbl: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, textAlign: 'center' },

  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, marginBottom: spacing.sm },
  formLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.tm, marginBottom: 6, marginTop: spacing.sm },
  required: { color: colors.rose },
  optional: { color: colors.tl, fontSize: 11 },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontFamily: fonts.body, fontSize: 13, color: colors.td,
  },
  hint: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, marginTop: 4 },
  uploadArea: {
    borderWidth: 1.5, borderColor: colors.lav3, borderStyle: 'dashed',
    borderRadius: radius.lg, padding: spacing.lg,
    alignItems: 'center', gap: 6, backgroundColor: colors.lav1,
    marginVertical: spacing.sm,
  },
  uploadLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lav5, textAlign: 'center' },
  uploadHint: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },
  progressTrack: { height: 6, backgroundColor: colors.lav1, borderRadius: radius.full, overflow: 'hidden', marginVertical: 4 },
  progressFill: { height: '100%', backgroundColor: colors.lav4, borderRadius: radius.full },
  orText: { fontFamily: fonts.body, fontSize: 11, color: colors.tl, textAlign: 'center', marginVertical: 8 },
  previewImg: { width: '100%', height: 130, borderRadius: radius.md, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  chip: {
    backgroundColor: colors.bg, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  chipSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.tm },
  chipTextSel: { color: colors.lav6, fontFamily: fonts.bodyBold },

  tipoRow: { gap: 8, marginBottom: 4 },
  tipoOpc: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: spacing.md, backgroundColor: colors.bg,
  },
  tipoOpcSel: { borderColor: colors.lav4, backgroundColor: colors.lav1 },
  tipoOpcTit: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: 2 },
  tipoOpcTitSel: { color: colors.lav6 },
  tipoOpcDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, lineHeight: 15 },

  comissaoBox: {
    backgroundColor: colors.lav1, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lav2,
    padding: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm, gap: 4,
  },
  linha2: { flexDirection: 'row', gap: spacing.sm },
  calculoTxt: { fontFamily: fonts.body, fontSize: 11.5, color: colors.lav6, marginBottom: 8, lineHeight: 17 },
  calculoForte: { fontFamily: fonts.bodyBold },
  infoBase: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.lav2, padding: spacing.sm, marginBottom: 4,
  },
  infoBaseTxt: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, color: colors.lav6, lineHeight: 17 },
  erroBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF0EE',
    borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md,
  },
  erroTxt: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.roseFg },

  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: 8 },
  emptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, marginBottom: spacing.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  itemThumb: { width: 56, height: 56, borderRadius: radius.md, flexShrink: 0 },
  itemThumbPlaceholder: { backgroundColor: colors.lav1, alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  itemTag: {
    fontFamily: fonts.body, fontSize: 10, color: colors.tm,
    backgroundColor: colors.lav1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full,
  },
  cliquesTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.sage + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full,
  },
  cliquesTagTxt: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.lav5 },
  cupomTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.gold + '30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full,
  },
  cupomTagTxt: { fontFamily: fonts.bodyBold, fontSize: 10, color: '#8A6A33' },
  itemLink: { fontFamily: fonts.body, fontSize: 10, color: colors.lav4 },
  verComissoesLink: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.lav5, marginTop: 2 },
  itemActions: { alignItems: 'center', gap: 2 },
  switchLbl: { fontFamily: fonts.body, fontSize: 9, color: colors.tl },
});
