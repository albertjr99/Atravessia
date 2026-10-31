import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, Switch, TouchableOpacity } from 'react-native';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, BotaoAdmin } from './adminEstilo';
import AdminLayout from './AdminLayout';
import { CartaoAvisoAtualizacao, versaoInstalada, avaliarVersao } from '../../components/AvisoAtualizacao';

const VERSAO_RE = /^\d+(\.\d+){0,3}$/;
const CODIGO_RE = /^\d{1,9}$/;

// Controle do aviso de atualização do app. Documento: configuracoes/versaoApp.
// O app compara a versão instalada (nome e versionCode) com este documento ao
// abrir e ao voltar para a frente: abaixo da mais recente → convite com
// "Atualizar" e "Agora não" (volta em 24 h); abaixo da mínima ou com
// "obrigatória" → aviso que bloqueia o app até atualizar.
export default function AdminVersaoAppScreen({ navigation }) {
  const [form, setForm] = useState({
    versaoMinima: '', versaoRecente: '', versionCodeMinimo: '', versionCodeRecente: '', obrigatoria: false, novidades: '',
  });
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState('opcional');
  const aqui = versaoInstalada();

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'versaoApp'), (snap) => {
    if (carregado) return;
    const d = snap.data() || {};
    setForm({
      versaoMinima: d.versaoMinima || '',
      versaoRecente: d.versaoRecente || '',
      versionCodeMinimo: d.versionCodeMinimo ? String(d.versionCodeMinimo) : '',
      versionCodeRecente: d.versionCodeRecente ? String(d.versionCodeRecente) : '',
      obrigatoria: d.obrigatoria === true,
      novidades: d.novidades || '',
    });
    if (d.obrigatoria === true) setPrevia('obrigatoria');
    setCarregado(true);
  }, () => setCarregado(true)), [carregado]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const salvar = async () => {
    const versaoMinima = form.versaoMinima.trim();
    const versaoRecente = form.versaoRecente.trim();
    const codMin = form.versionCodeMinimo.trim();
    const codRec = form.versionCodeRecente.trim();
    if ((versaoMinima && !VERSAO_RE.test(versaoMinima)) || (versaoRecente && !VERSAO_RE.test(versaoRecente))) {
      Alert.alert('Atenção', 'Use o formato de versão com números e pontos, por exemplo 1.20.1.');
      return;
    }
    if ((codMin && !CODIGO_RE.test(codMin)) || (codRec && !CODIGO_RE.test(codRec))) {
      Alert.alert('Atenção', 'O versionCode é só um número inteiro, por exemplo 50.');
      return;
    }
    if (form.obrigatoria && !versaoRecente && !codRec) {
      Alert.alert('Atenção', 'Para tornar obrigatória, preencha a versão mais recente (ou o versionCode dela).');
      return;
    }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'versaoApp'), {
        versaoMinima,
        versaoRecente,
        versionCodeMinimo: codMin ? Number(codMin) : null,
        versionCodeRecente: codRec ? Number(codRec) : null,
        obrigatoria: !!form.obrigatoria,
        novidades: form.novidades.trim(),
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      Alert.alert('', 'Aviso de versão publicado. Ele aparece quando o app for aberto.');
    } catch (e) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  // Como este aparelho seria tratado com o que está no formulário.
  const situacao = avaliarVersao(aqui, {
    ...form, versionCodeMinimo: form.versionCodeMinimo.trim(), versionCodeRecente: form.versionCodeRecente.trim(),
  });
  const textoAqui = !aqui.nome && aqui.codigo == null ? ''
    : `Neste aparelho: ${aqui.nome || '—'}${aqui.codigo != null ? ` (versionCode ${aqui.codigo})` : ''} — `
      + (situacao.obrigatoria ? 'veria o aviso obrigatório.' : situacao.abaixoRecente ? 'veria o convite opcional.' : 'já está atualizado.');

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminVersaoApp">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
        <Text style={s.sobre}>Configuração</Text>
        <Text style={s.pageTitle}>Versão do app</Text>
        <Text style={s.pageSub}>
          Avise quem ainda não atualizou. O aviso aparece na tela assim que a pessoa abre o app (ou volta para ele) —
          não é preciso enviar notificação.
        </Text>

        <View style={s.card}>
          <Text style={s.secao}>Como usar</Text>
          {[
            'Publique a versão nova na Play Store e espere ela ficar disponível.',
            'Em "Versão mais recente", coloque a versão publicada (ex.: 1.20.2) e, se quiser, o versionCode (ex.: 51).',
            'Opcional (padrão): convite com "Atualizar" e "Agora não". Quem escolher "Agora não" segue na versão antiga e o convite volta em 24 h.',
            'Obrigatória: ligue a chave abaixo ou preencha a versão mínima. Quem estiver abaixo só volta a usar o app depois de atualizar.',
            'Escreva as novidades, confira a prévia e toque em Salvar e publicar.',
          ].map((t, i) => (
            <Text key={i} style={s.passo}><Text style={s.passoNum}>{i + 1}. </Text>{t}</Text>
          ))}
          <Text style={s.dica}>O aviso existe no app a partir da versão 1.20.0 (versionCode 49). Versões anteriores só recebem o aviso da própria Play Store.</Text>
        </View>

        <View style={s.card}>
          <Text style={s.secao}>Versões</Text>
          <View style={s.par}>
            <View style={{ flex: 2 }}>
              <Text style={s.label}>Versão mais recente na loja</Text>
              <TextInput style={s.input} value={form.versaoRecente} onChangeText={t => set('versaoRecente', t)}
                autoCapitalize="none" keyboardType="numbers-and-punctuation" placeholder="Ex.: 1.20.2" placeholderTextColor={colors.tl} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>versionCode</Text>
              <TextInput style={s.input} value={form.versionCodeRecente} onChangeText={t => set('versionCodeRecente', t)}
                keyboardType="number-pad" placeholder="Ex.: 51" placeholderTextColor={colors.tl} />
            </View>
          </View>
          <Text style={s.dica}>Quem tiver uma versão anterior recebe o convite.</Text>

          <View style={[s.par, { marginTop: 8 }]}>
            <View style={{ flex: 2 }}>
              <Text style={s.label}>Versão mínima (opcional)</Text>
              <TextInput style={s.input} value={form.versaoMinima} onChangeText={t => set('versaoMinima', t)}
                autoCapitalize="none" keyboardType="numbers-and-punctuation" placeholder="Ex.: 1.19.0" placeholderTextColor={colors.tl} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>versionCode</Text>
              <TextInput style={s.input} value={form.versionCodeMinimo} onChangeText={t => set('versionCodeMinimo', t)}
                keyboardType="number-pad" placeholder="Ex.: 45" placeholderTextColor={colors.tl} />
            </View>
          </View>
          <Text style={s.dica}>Abaixo desta versão, a atualização é obrigatória (o aviso não tem "Agora não").</Text>

          <View style={s.linha}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.label}>Tornar a versão mais recente obrigatória</Text>
              <Text style={s.dica}>Use só para correções importantes: todas as pessoas precisarão atualizar para continuar.</Text>
            </View>
            <Switch value={form.obrigatoria} onValueChange={v => { set('obrigatoria', v); setPrevia(v ? 'obrigatoria' : 'opcional'); }}
              trackColor={{ true: colors.lav4 }} accessibilityLabel="Atualização obrigatória" />
          </View>
          {!!textoAqui && <Text style={s.dica}>{textoAqui}</Text>}
        </View>

        <View style={s.card}>
          <Text style={s.secao}>O que há de novo</Text>
          <Text style={s.label}>Novidades (aparece no aviso)</Text>
          <TextInput style={[s.input, s.multi]} value={form.novidades} onChangeText={t => set('novidades', t)}
            multiline textAlignVertical="top" placeholder="Ex.: Check-in mais rápido, novos áudios e correções." placeholderTextColor={colors.tl} />
        </View>

        <View style={s.card}>
          <Text style={s.secao}>Prévia</Text>
          <View style={s.abas}>
            {[['opcional', 'Opcional'], ['obrigatoria', 'Obrigatória']].map(([id, nome]) => (
              <TouchableOpacity key={id} style={[s.chip, previa === id && s.chipSel]} onPress={() => setPrevia(id)}
                accessibilityRole="button" accessibilityState={{ selected: previa === id }}>
                <Text style={[s.chipTxt, previa === id && s.chipTxtSel]}>{nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.previaFundo} pointerEvents="none">
            <CartaoAvisoAtualizacao obrigatoria={previa === 'obrigatoria'} novidades={form.novidades} />
          </View>
          <Text style={s.dica}>
            {previa === 'obrigatoria'
              ? 'Bloqueia o app: o voltar do Android não fecha. "Atualizar" leva à Play Store.'
              : '"Agora não" fecha o aviso; ele volta depois de 24 h.'}
          </Text>
        </View>

        <BotaoAdmin title={salvando ? 'Salvando…' : 'Salvar e publicar'} icone="checkmark" onPress={salvar} disabled={salvando || !carregado} />
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: { ...est.subtitulo(), marginBottom: spacing.lg },
  card: { ...est.vidro(26), padding: 18, marginBottom: spacing.md },
  secao: { ...est.secao(), marginBottom: 10 },
  label: { ...est.rotulo(), marginTop: 6 },
  input: est.campo(),
  multi: { minHeight: 120, maxHeight: 280, paddingTop: 12 },
  dica: { fontFamily: fonts.body, fontSize: 12.5, color: colors.texto2, marginTop: 6 },
  linha: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  par: { flexDirection: 'row', gap: 10 },
  passo: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.td, marginBottom: 6 },
  passoNum: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },
  abas: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: est.chip(),
  chipSel: est.chipSel(),
  chipTxt: est.chipTxt(),
  chipTxtSel: est.chipTxtSel(),
  previaFundo: { backgroundColor: colors.sobreposicao, borderRadius: 24, padding: 14, alignItems: 'center' },
}));
