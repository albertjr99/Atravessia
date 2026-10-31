import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, Platform, Image, Switch, KeyboardAvoidingView, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, setDoc,
} from 'firebase/firestore';
import { abrirLink } from '../../utils/abrirLink';
import {
  seloVigencia, mascaraDataBR, brParaISO, isoParaBR, linkWhatsApp, linkLigar,
  normalizarLinkContrato, ehLinkDrive,
} from '../../utils/vigencia';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, acento, BotaoAdmin, AcoesItem, useFormRecolhivel } from './adminEstilo';
import Recolhivel from '../../components/Recolhivel';
import * as ImagePicker from 'expo-image-picker';
import { confirmar } from '../../utils/confirm';
import { uploadToStorage } from '../../utils/storageUpload';
import { normalizarUrl } from '../../utils/abrirLink';
import { UFS, nomeDoEstado, formatarCidade, rotuloLocal } from '../../utils/localizacao';
import { urlDeImagem, idDoDrive } from '../../utils/imagemUrl';
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

// Cores do selo de vigência: laranja (≤ 60 dias), vermelho (vencida).
const TOM_SELO = { ok: 'salvia', futura: 'lilas', alerta: 'pessego', vencida: 'rosa' };

export default function AdminParceriasScreen({ navigation, route }) {
  const [parcerias, setParcerias] = useState([]);
  // Internos (parceriasPrivado/{id}): vigência, contato e contrato.
  const [privados, setPrivados] = useState({});
  const [privadosProntos, setPrivadosProntos] = useState(false);
  const [inicioParceria, setInicioParceria] = useState('');
  const [fimParceria, setFimParceria] = useState('');
  const [contatoNome, setContatoNome] = useState('');
  const [contatoTelefone, setContatoTelefone] = useState('');
  const [contratoUrl, setContratoUrl] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [link, setLink] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  const [categoriaSel, setCategoriaSel] = useState([]);
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [atendimentoOnline, setAtendimentoOnline] = useState(false);
  const [escolhendoEstado, setEscolhendoEstado] = useState(false);
  const [alturaDescricao, setAlturaDescricao] = useState(120);
  // Parceria em edição (null = cadastro novo).
  const [editId, setEditId] = useState(null);
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
  // Cashback desta parceria (só cupom): liga/desliga, percentual próprio e condições.
  const [cashbackAtivo, setCashbackAtivo] = useState(true);
  const [cashbackPercentual, setCashbackPercentual] = useState('');
  const [cashbackCondicoes, setCashbackCondicoes] = useState('');

  // A usuária recebe o desconto cadastrado; a comissão é cobrada à parte do parceiro.
  const descontoClienteCalculado = Math.max(0, parseFloat(percentualBeneficio) || 0);

  // Exemplo em reais para a prévia: sempre sobre um serviço de R$ 100,00.
  const exemploComissao = parseFloat(percentualComissao) || 0;
  const exemploPaga = Math.max(0, 100 - descontoClienteCalculado);
  const brl = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  const [erroLista, setErroLista] = useState('');
  const rolagem = useRef(null);
  // Formulário fechado por padrão; abre em "Nova parceria" ou ao editar.
  const form = useFormRecolhivel(rolagem);

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

  useEffect(() => onSnapshot(collection(db, 'parceriasPrivado'), (snap) => {
    const m = {};
    snap.docs.forEach(d => { m[d.id] = d.data(); });
    setPrivados(m);
    setPrivadosProntos(true);
  }, () => setPrivadosProntos(true)), []);

  // Atalho do Dashboard ("Contratos a vencer"): abre direto a edição.
  const editarId = route?.params?.editarId;
  useEffect(() => {
    if (!editarId || !privadosProntos) return;
    const p = parcerias.find(x => x.id === editarId);
    if (!p) return;
    editar(p);
    navigation.setParams?.({ editarId: undefined });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editarId, privadosProntos, parcerias]);

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

  const limparFormulario = () => {
    setEditId(null);
    setTitulo(''); setDescricao(''); setLink(''); setImagemUrl(''); setCategoriaSel([]);
    setEstado(''); setCidade(''); setAtendimentoOnline(false);
    setTipoBeneficio('link'); setPercentualBeneficio('10'); setPercentualComissao('3');
    setValidadeDiasVoucher('30');
    setCashbackAtivo(true); setCashbackPercentual(''); setCashbackCondicoes('');
    setInicioParceria(''); setFimParceria(''); setContatoNome(''); setContatoTelefone(''); setContratoUrl('');
  };

  const editar = (p) => {
    setEditId(p.id);
    setTitulo(p.titulo || '');
    setDescricao(p.descricao || '');
    setLink(p.link || p.url || '');
    setImagemUrl(p.imagemUrl || '');
    setCategoriaSel(p.categorias || []);
    setEstado(p.estado || '');
    setCidade(p.cidade || '');
    setAtendimentoOnline(p.atendimentoOnline === true);
    setTipoBeneficio(p.tipoBeneficio === 'cupom' ? 'cupom' : 'link');
    setPercentualBeneficio(p.percentualBeneficio != null ? String(p.percentualBeneficio) : '10');
    setPercentualComissao(p.percentualComissao != null ? String(p.percentualComissao) : '3');
    setValidadeDiasVoucher(p.validadeDiasVoucher != null ? String(p.validadeDiasVoucher) : '30');
    setCashbackAtivo(p.cashback?.ativo !== false);
    setCashbackPercentual(p.cashback?.percentual != null ? String(p.cashback.percentual).replace('.', ',') : '');
    setCashbackCondicoes(p.cashback?.condicoes || '');
    const priv = privados[p.id] || {};
    setInicioParceria(isoParaBR(priv.inicioParceria));
    setFimParceria(isoParaBR(priv.fimParceria));
    setContatoNome(priv.contatoNome || '');
    setContatoTelefone(priv.contatoTelefone || '');
    setContratoUrl(priv.contratoUrl || '');
    form.abrirERolar();
  };

  const handlePublicar = async () => {
    if (!titulo.trim()) {
      Alert.alert('Atenção', 'Preencha pelo menos o título.');
      return;
    }
    if (cidade.trim() && !estado) {
      Alert.alert('Atenção', 'Escolha o estado da cidade informada.');
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
    // Vigência, contato e contrato: internos, em parceriasPrivado/{id}.
    const inicioISO = brParaISO(inicioParceria);
    const fimISO = brParaISO(fimParceria);
    if (inicioISO === null || fimISO === null) {
      Alert.alert('Atenção', 'Confira as datas da parceria (dd/mm/aaaa).');
      return;
    }
    if (inicioISO && fimISO && fimISO < inicioISO) {
      Alert.alert('Atenção', 'O fim da parceria não pode ser antes do início.');
      return;
    }
    const contratoFinal = normalizarLinkContrato(contratoUrl);
    if (contratoFinal === null) {
      Alert.alert('Atenção', 'O link do contrato não parece um endereço válido. Cole o link de compartilhamento do Google Drive.');
      return;
    }
    const privado = {
      titulo: titulo.trim(),
      inicioParceria: inicioISO, fimParceria: fimISO,
      contatoNome: contatoNome.trim(), contatoTelefone: contatoTelefone.trim(),
      contratoUrl: contratoFinal,
      atualizadoEm: serverTimestamp(),
    };
    setEnviando(true);
    try {
      const dados = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        link: linkFinal,
        // Link de compartilhamento do Google Drive vira o endereço da imagem.
        imagemUrl: urlDeImagem(imagemUrl),
        categorias: categoriaSel,
        estado,
        cidade: formatarCidade(cidade),
        atendimentoOnline,
        tipoBeneficio,
      };
      if (tipoBeneficio === 'cupom') {
        dados.percentualBeneficio = parseFloat(percentualBeneficio) || 0;
        dados.percentualComissao = parseFloat(percentualComissao) || 0;
        dados.percentualDescontoCliente = descontoClienteCalculado;
        dados.baseCalculoComissao = 'valor_original';
        dados.validadeDiasVoucher = parseInt(validadeDiasVoucher, 10) || 30;
        const pctCb = parseFloat(String(cashbackPercentual).replace(',', '.'));
        dados.cashback = {
          ativo: cashbackAtivo !== false,
          percentual: Number.isFinite(pctCb) ? Math.max(0, Math.min(50, pctCb)) : null,
          condicoes: cashbackCondicoes.trim(),
        };
        // Ao editar, mantém o token do painel do parceiro.
        if (!editId || !parcerias.find(p => p.id === editId)?.tokenPainel) dados.tokenPainel = gerarTokenPainel();
      }
      let id = editId;
      if (editId) {
        await updateDoc(doc(db, 'parcerias', editId), dados);
      } else {
        id = (await addDoc(collection(db, 'parcerias'), { ...dados, ativo: true, cliques: 0, criadoEm: serverTimestamp() })).id;
      }
      await setDoc(doc(db, 'parceriasPrivado', id), privado, { merge: true });
      Alert.alert('', editId ? 'Parceria atualizada!' : 'Parceria publicada com sucesso!');
      limparFormulario();
      form.setAberto(false);
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
        .then(() => deleteDoc(doc(db, 'parceriasPrivado', id)).catch(() => {}))
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
        ref={rolagem}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        <Text style={s.sobre}>Parcerias</Text>
        <Text style={s.pageTitle}>Parcerias</Text>
        <Text style={s.pageSub}>
          Crie banners de parceria e benefícios exclusivos que aparecem para todas as usuárias no app, direto do plano gratuito.
        </Text>

        {/* ── Resumo ── */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <View style={[s.statIcone, { backgroundColor: acento('lilas').fundo }]}><Ionicons name="people-outline" size={18} color={acento('lilas').tinta} /></View>
            <Text style={[s.statNum, { color: acento('lilas').texto }]}>{parcerias.length}</Text>
            <Text style={s.statLbl}>total</Text>
          </View>
          <View style={s.statBox}>
            <View style={[s.statIcone, { backgroundColor: acento('salvia').fundo }]}><Ionicons name="checkmark-circle-outline" size={18} color={acento('salvia').tinta} /></View>
            <Text style={[s.statNum, { color: acento('salvia').texto }]}>{ativas}</Text>
            <Text style={s.statLbl}>ativas</Text>
          </View>
          <View style={s.statBox}>
            <View style={[s.statIcone, { backgroundColor: acento('dourado').fundo }]}><Ionicons name="stats-chart-outline" size={18} color={acento('dourado').tinta} /></View>
            <Text style={[s.statNum, { color: acento('dourado').texto }]}>{totalCliques}</Text>
            <Text style={s.statLbl}>cliques totais</Text>
          </View>
        </View>

        {/* ── Formulário ── */}
        <View onLayout={form.onLayout}>
        <Recolhivel
          titulo={editId ? 'Editar parceria' : 'Nova parceria / benefício'}
          subtitulo={editId ? (titulo || 'Parceria sem título') : 'Toque para cadastrar uma nova parceria'}
          icone={editId ? 'create-outline' : 'add-circle-outline'}
          aberto={form.aberto}
          onAlternar={form.setAberto}
          estilo={{ marginBottom: spacing.xl }}
        >
          {editId && (
            <View style={s.formTopo}>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => { limparFormulario(); form.setAberto(false); }} style={s.cancelarEdicao}>
                <Text style={s.cancelarEdicaoTxt}>Cancelar edição</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.formLabel}>Título <Text style={s.required}>*</Text></Text>
          <TextInput
            style={s.input}
            placeholder="Ex: 10% de desconto na Farmácia X"
            placeholderTextColor={colors.tl}
            value={titulo}
            onChangeText={setTitulo}
          />

          <Text style={s.formLabel}>Descrição <Text style={s.optional}>(opcional)</Text></Text>
          {/* Cresce com o texto: quem digita vê tudo, como a usuária vê no app. */}
          <TextInput
            style={[s.input, { height: alturaDescricao, textAlignVertical: 'top', lineHeight: 20 }]}
            placeholder="Descreva o benefício ou como utilizá-lo..."
            placeholderTextColor={colors.tl}
            multiline
            scrollEnabled={false}
            value={descricao}
            onChangeText={setDescricao}
            // Cresce com o texto (com teto). Na web a medida inclui a própria
            // altura do campo e o ajuste entraria em loop, então lá fica fixo.
            onContentSizeChange={e => {
              if (Platform.OS === 'web') return;
              const h = Math.min(420, Math.max(120, Math.ceil(e.nativeEvent.contentSize.height) + 24));
              setAlturaDescricao(a => (Math.abs(a - h) > 4 ? h : a));
            }}
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
            <Ionicons name={uploadando ? 'hourglass-outline' : 'image-outline'} size={26} color={colors.lilasIcone} />
            <Text style={s.uploadLabel}>
              {uploadando ? 'Fazendo upload...' : 'Clique para enviar imagem do banner'}
            </Text>
            <Text style={s.uploadHint}>PNG, JPG — Tamanho sugerido: 800×400 px</Text>
          </TouchableOpacity>
          <Text style={s.orText}>— ou cole um link de imagem (também do Google Drive) —</Text>
          <TextInput
            style={s.input}
            placeholder="https://... ou link do Google Drive"
            placeholderTextColor={colors.tl}
            autoCapitalize="none"
            value={imagemUrl}
            onChangeText={setImagemUrl}
          />
          {idDoDrive(imagemUrl) ? (
            <Text style={s.hint}>Link do Google Drive reconhecido. O arquivo precisa estar compartilhado como "Qualquer pessoa com o link".</Text>
          ) : null}
          {imagemUrl ? (
            <Image source={{ uri: urlDeImagem(imagemUrl) }} style={s.previewImg} resizeMode="contain" />
          ) : null}

          <Text style={s.formLabel}>Onde atende</Text>
          <Text style={s.hint}>Usado no filtro de localização do app. Deixe em branco se o atendimento for só on-line.</Text>
          <View style={s.linha2}>
            <View style={{ flex: 1 }}>
              <Text style={s.miniLabel}>Estado</Text>
              <TouchableOpacity style={[s.input, s.seletor]} onPress={() => setEscolhendoEstado(true)}>
                <Text style={[s.seletorTxt, !estado && { color: colors.tl }]} numberOfLines={1}>
                  {estado ? `${nomeDoEstado(estado)} (${estado})` : 'Escolher'}
                </Text>
                <Ionicons name="chevron-down" size={15} color={colors.tm} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.miniLabel}>Cidade</Text>
              <TextInput
                style={s.input}
                placeholder="Ex.: Vitória"
                placeholderTextColor={colors.tl}
                value={cidade}
                onChangeText={setCidade}
              />
            </View>
          </View>
          <View style={s.onlineLinha}>
            <Switch
              value={atendimentoOnline}
              onValueChange={setAtendimentoOnline}
              trackColor={{ false: colors.border, true: colors.lav3 }}
              thumbColor={atendimentoOnline ? colors.lav4 : colors.tl}
            />
            <Text style={s.onlineTxt}>Oferece atendimento on-line</Text>
          </View>

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
              <Ionicons name="link-outline" size={18} color={tipoBeneficio === 'link' ? colors.lilasTexto : colors.texto2} />
              <View style={{ flex: 1 }}>
                <Text style={[s.tipoOpcTit, tipoBeneficio === 'link' && s.tipoOpcTitSel]}>Link simples</Text>
                <Text style={s.tipoOpcDesc}>Desconto direto — sem comissão nem rastreamento financeiro.</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tipoOpc, tipoBeneficio === 'cupom' && s.tipoOpcSel]}
              onPress={() => setTipoBeneficio('cupom')}
            >
              <Ionicons name="pricetag-outline" size={18} color={tipoBeneficio === 'cupom' ? colors.lilasTexto : colors.texto2} />
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
                  <Text style={s.formLabel}>Desconto para a usuária (%)</Text>
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
                <Ionicons name="information-circle-outline" size={17} color={acento('lilas').texto} />
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

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
                <Text style={[s.formLabel, { flex: 1, marginTop: 0 }]}>Esta parceria dá cashback</Text>
                <Switch value={cashbackAtivo} onValueChange={setCashbackAtivo} trackColor={{ true: colors.lav4 }} />
              </View>
              {cashbackAtivo && (
                <>
                  <Text style={s.formLabel}>Cashback desta parceria (%)</Text>
                  <TextInput style={s.input} keyboardType="decimal-pad" value={cashbackPercentual} onChangeText={setCashbackPercentual}
                    placeholder="Vazio = percentual geral do Cashback" placeholderTextColor={colors.tl} />
                  <Text style={s.formLabel}>Condições (aparece para a usuária)</Text>
                  <TextInput style={s.input} value={cashbackCondicoes} onChangeText={setCashbackCondicoes}
                    placeholder="Ex.: válido em serviços acima de R$ 100" placeholderTextColor={colors.tl} />
                </>
              )}
            </View>
          )}

          <Recolhivel
            titulo="Contrato, vigência e contato"
            subtitulo={seloVigencia({ inicioParceria: brParaISO(inicioParceria), fimParceria: brParaISO(fimParceria) })?.texto
              || 'Uso interno: as usuárias não veem estes dados'}
            icone="document-text-outline"
            inicialAberto={!!(fimParceria || contatoNome || contratoUrl)}
            estilo={{ marginTop: spacing.md }}
          >
            <View style={s.infoBase}>
              <Ionicons name="lock-closed-outline" size={16} color={acento('lilas').texto} />
              <Text style={s.infoBaseTxt}>Uso interno: só as administradoras veem. Quando faltarem 60, 30 e 7 dias para o fim (e no dia), o painel avisa.</Text>
            </View>
            <View style={s.linha2}>
              <View style={{ flex: 1 }}>
                <Text style={s.miniLabel}>Início da parceria</Text>
                <TextInput style={s.input} value={inicioParceria} onChangeText={v => setInicioParceria(mascaraDataBR(v))}
                  keyboardType="number-pad" maxLength={10} placeholder="dd/mm/aaaa" placeholderTextColor={colors.tl} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.miniLabel}>Fim (vencimento do contrato)</Text>
                <TextInput style={s.input} value={fimParceria} onChangeText={v => setFimParceria(mascaraDataBR(v))}
                  keyboardType="number-pad" maxLength={10} placeholder="dd/mm/aaaa" placeholderTextColor={colors.tl} />
              </View>
            </View>
            {(brParaISO(inicioParceria) === null || brParaISO(fimParceria) === null) && (
              <Text style={[s.hint, { color: acento('dourado').texto }]}>Complete a data no formato dd/mm/aaaa.</Text>
            )}
            <Text style={s.formLabel}>Nome do contato</Text>
            <TextInput style={s.input} value={contatoNome} onChangeText={setContatoNome}
              placeholder="Quem responde pela parceria" placeholderTextColor={colors.tl} />
            <Text style={s.formLabel}>Telefone/WhatsApp do contato</Text>
            <TextInput style={s.input} value={contatoTelefone} onChangeText={setContatoTelefone}
              keyboardType="phone-pad" placeholder="(27) 99999-9999" placeholderTextColor={colors.tl} />
            {!!contatoTelefone.trim() && !linkWhatsApp(contatoTelefone) && (
              <Text style={[s.hint, { color: acento('dourado').texto }]}>Confira o número: use DDD + telefone.</Text>
            )}
            <Text style={s.formLabel}>Link do contrato (Google Drive)</Text>
            <TextInput style={s.input} value={contratoUrl} onChangeText={setContratoUrl}
              autoCapitalize="none" keyboardType="url" placeholder="https://drive.google.com/..." placeholderTextColor={colors.tl} />
            {!!contratoUrl.trim() && normalizarLinkContrato(contratoUrl) === null && (
              <Text style={[s.hint, { color: acento('rosa').texto }]}>Este link não parece um endereço válido.</Text>
            )}
            {!!normalizarLinkContrato(contratoUrl) && !ehLinkDrive(contratoUrl) && (
              <Text style={[s.hint, { color: acento('dourado').texto }]}>Não parece um link do Google Drive, mas será salvo assim mesmo.</Text>
            )}
            {!!normalizarLinkContrato(contratoUrl) && (
              <TouchableOpacity style={[s.acaoInterna, { marginTop: 8 }]} onPress={() => abrirLink(normalizarLinkContrato(contratoUrl))}>
                <Ionicons name="document-text-outline" size={15} color={colors.lilasTexto} />
                <Text style={s.acaoInternaTxt}>Abrir contrato</Text>
              </TouchableOpacity>
            )}
          </Recolhivel>

          <BotaoAdmin
            title={enviando ? 'Salvando...' : editId ? 'Salvar alterações' : 'Publicar parceria no app'}
            onPress={handlePublicar}
            style={{ marginTop: spacing.lg }}
          />
        </Recolhivel>
        </View>

        {/* ── Lista ── */}
        <Text style={s.sectionTitle}>
          Publicadas ({parcerias.length}) · {ativas} ativas
        </Text>

        {!!erroLista && (
          <View style={s.erroBox}>
            <Ionicons name="alert-circle-outline" size={18} color={acento('rosa').texto} />
            <Text style={s.erroTxt}>Não foi possível carregar as parcerias: {erroLista}</Text>
          </View>
        )}

        {parcerias.length === 0 && !erroLista && (
          <Text style={s.emptyText}>Nenhuma parceria publicada ainda.</Text>
        )}

        {parcerias.length > 0 && <View style={s.lista}>
        {parcerias.map((p, i) => (
          <View key={p.id} style={[s.itemBloco, i > 0 && s.itemDiv]}>
          <View style={s.item}>
            {p.imagemUrl ? (
              <Image source={{ uri: urlDeImagem(p.imagemUrl) }} style={s.itemThumb} resizeMode="cover" />
            ) : (
              <View style={[s.itemThumb, s.itemThumbPlaceholder]}>
                <Ionicons name="image-outline" size={20} color={colors.tl} />
              </View>
            )}
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <Text style={s.itemTitulo} numberOfLines={1}>{p.titulo}</Text>
              {!!seloVigencia(privados[p.id]) && (() => {
                const selo = seloVigencia(privados[p.id]);
                const a = acento(TOM_SELO[selo.tom]);
                return (
                  <View style={[s.seloVig, { backgroundColor: a.fundo }]}>
                    <Ionicons name={selo.tom === 'vencida' ? 'alert-circle' : 'calendar-outline'} size={12} color={a.tinta} />
                    <Text style={[s.seloVigTxt, { color: a.texto }]}>{selo.texto}</Text>
                  </View>
                );
              })()}
              <ContatoContrato priv={privados[p.id]} />
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {(p.categorias || []).slice(0, 2).map(cat => (
                  <Text key={cat} style={s.itemTag}>{rotuloCategoria(cat)}</Text>
                ))}
                {p.tipoBeneficio === 'cupom' ? (
                  <View style={s.cupomTag}>
                    <Ionicons name="pricetag" size={12} color={acento('dourado').tinta} />
                    <Text style={s.cupomTagTxt}>Cupom · {p.percentualComissao || 0}% comissão</Text>
                  </View>
                ) : (
                  <View style={s.cliquesTag}>
                    <Ionicons name="stats-chart-outline" size={12} color={acento('salvia').tinta} />
                    <Text style={s.cliquesTagTxt}>{p.cliques || 0} cliques</Text>
                  </View>
                )}
              </View>
              {!!rotuloLocal(p) && <Text style={s.itemLocal}>{rotuloLocal(p)}</Text>}
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
            </View>
          </View>
            <AcoesItem onEditar={() => editar(p)} onApagar={() => handleRemover(p.id)} rotuloApagar="Apagar parceria" />
          </View>
        ))}
        </View>}
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={escolhendoEstado} transparent animationType="fade" onRequestClose={() => setEscolhendoEstado(false)}>
        <Pressable style={s.modalFundo} onPress={() => setEscolhendoEstado(false)}>
          <Pressable style={s.modalCaixa} onPress={() => {}}>
            <Text style={s.cardTitle}>Estado</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }}>
              <TouchableOpacity style={s.ufItem} onPress={() => { setEstado(''); setEscolhendoEstado(false); }}>
                <Text style={[s.ufTxt, { color: colors.tl }]}>Sem estado (só on-line)</Text>
              </TouchableOpacity>
              {UFS.map(e => (
                <TouchableOpacity key={e.uf} style={s.ufItem} onPress={() => { setEstado(e.uf); setEscolhendoEstado(false); }}>
                  <Text style={[s.ufTxt, estado === e.uf && { color: colors.lilasTexto, fontFamily: fonts.bodyBold }]}>{e.nome} ({e.uf})</Text>
                  {estado === e.uf && <Ionicons name="checkmark" size={18} color={colors.lilasTexto} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminLayout>
  );
}

// Contato e contrato da parceria (internos), na lista do painel: tocar no
// número liga; WhatsApp abre wa.me; contrato abre o link do Drive.
function ContatoContrato({ priv }) {
  if (!priv || (!priv.contatoNome && !priv.contatoTelefone && !priv.contratoUrl)) return null;
  const wa = linkWhatsApp(priv.contatoTelefone);
  const tel = linkLigar(priv.contatoTelefone);
  return (
    <View style={{ gap: 6 }}>
      {!!(priv.contatoNome || priv.contatoTelefone) && (
        <Text style={s.itemLocal}>
          Contato: <Text style={{ fontFamily: fonts.bodyBold }}>{priv.contatoNome || '—'}</Text>
          {priv.contatoTelefone ? ` · ${priv.contatoTelefone}` : ''}
        </Text>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {!!tel && (
          <TouchableOpacity style={s.acaoInterna} onPress={() => abrirLink(tel)} accessibilityLabel="Ligar para o contato">
            <Ionicons name="call-outline" size={14} color={colors.lilasTexto} />
            <Text style={s.acaoInternaTxt}>Ligar</Text>
          </TouchableOpacity>
        )}
        {!!wa && (
          <TouchableOpacity style={s.acaoInterna} onPress={() => abrirLink(wa)} accessibilityLabel="Abrir WhatsApp do contato">
            <Ionicons name="logo-whatsapp" size={14} color={colors.lilasTexto} />
            <Text style={s.acaoInternaTxt}>WhatsApp</Text>
          </TouchableOpacity>
        )}
        {!!priv.contratoUrl && (
          <TouchableOpacity style={s.acaoInterna} onPress={() => abrirLink(priv.contratoUrl)} accessibilityLabel="Abrir contrato">
            <Ionicons name="document-text-outline" size={14} color={colors.lilasTexto} />
            <Text style={s.acaoInternaTxt}>Abrir contrato</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = criarEstilos(() => ({
  seloVig: { ...est.etiqueta() },
  seloVigTxt: est.etiquetaTxt(),
  acaoInterna: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    minHeight: 34, paddingHorizontal: 11, borderRadius: 999,
    borderWidth: 1, borderColor: colors.lav3, backgroundColor: colors.lav1,
  },
  acaoInternaTxt: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.lilasTexto },
  formTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cancelarEdicao: { ...est.botaoSec(), minHeight: 36, paddingHorizontal: 14 },
  cancelarEdicaoTxt: { ...est.botaoSecTxt(), fontSize: 13 },
  miniLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2, marginBottom: 6, marginTop: 8 },
  seletor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  seletorTxt: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.td },
  onlineLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  onlineTxt: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.td },
  itemLocal: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2 },
  modalFundo: { ...est.veu(), alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCaixa: { ...est.modal(), width: '100%', maxWidth: 440, padding: spacing.lg },
  ufItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.bordaSuave },
  ufTxt: { fontFamily: fonts.body, fontSize: 15, color: colors.td },
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  statBox: { ...est.vidro(22), flex: 1, alignItems: 'center', gap: 4, padding: 14 },
  statIcone: est.pilula(38),
  statNum: { fontFamily: 'Figtree_800ExtraBold', fontSize: 24 },
  statLbl: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2, textAlign: 'center' },

  form: { ...est.vidro(26), padding: 18, marginBottom: spacing.xl },
  cardTitle: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, color: colors.titulo, marginBottom: spacing.sm },
  formLabel: est.rotulo(),
  required: est.obrigatorio(),
  optional: { color: colors.tl, fontSize: 12.5, fontFamily: fonts.body },
  input: est.campo(),
  hint: est.dica(),
  uploadArea: {
    borderWidth: 1.5, borderColor: colors.lav3, borderStyle: 'dashed',
    borderRadius: 20, padding: spacing.lg,
    alignItems: 'center', gap: 6, backgroundColor: colors.lav1,
    marginVertical: spacing.sm,
  },
  uploadLabel: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.lilasTexto, textAlign: 'center' },
  uploadHint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.texto2 },
  progressTrack: { height: 6, backgroundColor: colors.lav1, borderRadius: 999, overflow: 'hidden', marginVertical: 4 },
  progressFill: { height: '100%', backgroundColor: colors.lav4, borderRadius: 999 },
  orText: { ...est.dica(), textAlign: 'center', marginVertical: 8 },
  previewImg: { width: '100%', height: 140, borderRadius: 16, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipText: est.chipTxt(),
  chipTextSel: est.chipTxtSel(),

  tipoRow: { gap: 8, marginBottom: 4 },
  tipoOpc: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: 18,
    padding: 14, backgroundColor: colors.cardSolido,
  },
  tipoOpcSel: { borderColor: colors.lav3, backgroundColor: colors.lav1 },
  tipoOpcTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td, marginBottom: 2 },
  tipoOpcTitSel: { color: colors.lav6 },
  tipoOpcDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, lineHeight: 18 },

  comissaoBox: { ...est.tenue(18), padding: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm, gap: 4 },
  linha2: { flexDirection: 'row', gap: spacing.sm },
  calculoTxt: { fontFamily: fonts.body, fontSize: 13.5, color: colors.lav6, marginTop: 6, marginBottom: 8, lineHeight: 20 },
  calculoForte: { fontFamily: fonts.bodyBold },
  infoBase: { ...est.aviso('lilas'), backgroundColor: colors.cardSolido, padding: 12, marginBottom: 4 },
  infoBaseTxt: { ...est.avisoTxt('lilas'), fontSize: 13 },
  erroBox: { ...est.aviso('rosa'), alignItems: 'center', marginBottom: spacing.md },
  erroTxt: est.avisoTxt('rosa'),

  sectionTitle: { ...est.secao(), marginBottom: 10 },
  emptyText: { ...est.legenda(), marginBottom: spacing.md },
  lista: { ...est.vidro(26), paddingVertical: 2 },
  itemBloco: { paddingVertical: 14, paddingHorizontal: 14 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemDiv: est.divisoria(),
  itemThumb: { width: 60, height: 60, borderRadius: 16, flexShrink: 0 },
  itemThumbPlaceholder: { backgroundColor: acento('pessego').fundo, alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.titulo },
  itemTag: {
    fontFamily: fonts.bodySemi, fontSize: 12, color: acento('lilas').texto,
    backgroundColor: acento('lilas').fundo, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
  cliquesTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: acento('salvia').fundo, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
  },
  cliquesTagTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: acento('salvia').texto },
  cupomTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: acento('dourado').fundo, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
  },
  cupomTagTxt: { fontFamily: fonts.bodyBold, fontSize: 12, color: acento('dourado').texto },
  itemLink: { fontFamily: fonts.body, fontSize: 12.5, color: colors.lilasTexto },
  verComissoesLink: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lilasTexto, marginTop: 2 },
  itemActions: { alignItems: 'center', gap: 2 },
  switchLbl: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2 },
}), { escalar: false });
