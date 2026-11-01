import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, Switch, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/AuthContext';
import { colors, fonts, spacing, criarEstilos } from '../../theme';
import { est, BotaoAdmin } from './adminEstilo';
import AdminLayout from './AdminLayout';
import Recolhivel from '../../components/Recolhivel';
import {
  chamar, ms, dataHora, reais, separar, salaAberta, linkConvite, textoWhatsApp,
  compartilharLink, abrirWhatsApp, dataDoFormulario, formularioDaData, LIBERA_PROF_MIN,
} from '../../utils/atendimentos';

// Atendimentos online (psicologia) — mesma área do painel web (Atendimentos.jsx).
// Agenda, convite por pessoa (compartilhar/WhatsApp), entrar na sala como
// anfitriã e anotações privadas (atendimentosPrivado: só a profissional lê).
const confirmar = (titulo, msg, onOk) => {
  if (Platform.OS === 'web') { if (window.confirm(`${titulo}\n\n${msg}`)) onOk(); return; }
  Alert.alert(titulo, msg, [{ text: 'Voltar', style: 'cancel' }, { text: 'Confirmar', style: 'destructive', onPress: onOk }]);
};
const avisar = (msg) => (Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Atendimentos', msg));

export default function AdminAtendimentosScreen({ navigation }) {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [lista, setLista] = useState(null);
  const [privados, setPrivados] = useState({});
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    if (!uid) return undefined;
    const u1 = onSnapshot(query(collection(db, 'atendimentos'), where('profissionalUid', '==', uid)),
      s => setLista(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setLista([]));
    const u2 = onSnapshot(query(collection(db, 'atendimentosPrivado'), where('profissionalUid', '==', uid)),
      s => setPrivados(Object.fromEntries(s.docs.map(d => [d.id, d.data()]))), () => {});
    const u3 = onSnapshot(doc(db, 'configuracoes', 'atendimentos'), s => setConfig(s.data() || {}), () => setConfig({}));
    const t = setInterval(() => setAgora(Date.now()), 30000);
    return () => { u1(); u2(); u3(); clearInterval(t); };
  }, [uid]);
  const carregarStatus = () => chamar('statusAtendimentos', {}).then(setStatus).catch(() => setStatus(null));
  useEffect(() => { carregarStatus(); }, []);

  const { proximos, passados } = useMemo(() => separar(lista || [], agora), [lista, agora]);

  return (
    <AdminLayout navigation={navigation} currentScreen="AdminAtendimentos">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
        <Text style={s.sobre}>Pessoas</Text>
        <Text style={s.pageTitle}>Atendimentos</Text>
        <Text style={s.pageSub}>
          Atendimento psicológico online, individual ou em grupo. Crie a sessão, envie o link pessoal de cada pessoa e entre na sala como anfitriã.
        </Text>

        {status && (
          <View style={[est.aviso(status.modoTeste ? 'dourado' : 'salvia'), { marginTop: spacing.md }]}>
            <Ionicons name={status.modoTeste ? 'flask-outline' : 'shield-checkmark-outline'} size={18} color={colors.td} />
            <Text style={est.avisoTxt(status.modoTeste ? 'dourado' : 'salvia')}>
              {status.modoTeste
                ? 'Modo de teste (Jitsi público): salas com nome aleatório, sem token por pessoa. Use só para experimentar; para atender de verdade, configure a chave do Daily.'
                : 'Daily conectado: salas privadas com expiração, token por pessoa, sala de espera e sem gravação.'}
            </Text>
          </View>
        )}

        <View style={{ height: spacing.md }} />
        <Recolhivel titulo="Novo atendimento" subtitulo="Individual ou em grupo, com link para cada pessoa" icone="add-circle-outline">
          <FormNovo />
        </Recolhivel>

        <Text style={s.secao}>Próximos</Text>
        {lista === null ? <Text style={s.dica}>Carregando…</Text>
          : proximos.length === 0 ? <Text style={s.dica}>Nenhum atendimento agendado.</Text>
            : proximos.map(a => <Cartao key={a.id} a={a} priv={privados[a.id]} agora={agora} navigation={navigation} />)}

        {passados.length > 0 && (
          <Recolhivel titulo={`Passados e cancelados (${passados.length})`} icone="time-outline" estilo={{ marginTop: spacing.md }}>
            {passados.map(a => <Cartao key={a.id} a={a} priv={privados[a.id]} agora={agora} navigation={navigation} passado />)}
          </Recolhivel>
        )}

        <Recolhivel titulo="Configurações" subtitulo="Serviço de vídeo, benefício e CRP" icone="settings-outline" estilo={{ marginTop: spacing.md }}>
          {config && <Configuracoes inicial={config} status={status} onSalvo={carregarStatus} />}
        </Recolhivel>
      </ScrollView>
    </AdminLayout>
  );
}

function Campo({ rotulo, ...props }) {
  return (
    <View style={{ flex: 1, minWidth: 120 }}>
      {!!rotulo && <Text style={s.label}>{rotulo}</Text>}
      <TextInput style={s.input} placeholderTextColor={colors.tl} {...props} />
    </View>
  );
}

function FormNovo() {
  const vazio = { nome: '', email: '' };
  const [tipo, setTipo] = useState('individual');
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [duracao, setDuracao] = useState('50');
  const [valor, setValor] = useState('');
  const [pessoas, setPessoas] = useState([{ ...vazio }]);
  const [salvando, setSalvando] = useState(false);
  const [criados, setCriados] = useState(null);
  const setPessoa = (i, k, v) => setPessoas(p => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const criar = async () => {
    const inicio = dataDoFormulario(data, hora);
    if (!inicio) { avisar('Preencha a data (DD/MM/AAAA) e o horário (HH:MM).'); return; }
    const lista = pessoas.filter(p => p.nome.trim());
    if (!lista.length) { avisar('Adicione o nome de pelo menos uma pessoa.'); return; }
    setSalvando(true);
    try {
      const r = await chamar('criarAtendimento', {
        tipo, titulo, inicio, duracaoMin: Number(duracao) || 50, participantes: lista,
        valor: valor ? Number(String(valor).replace(',', '.')) : null,
      });
      setCriados(r.convites);
      setTitulo(''); setData(''); setHora(''); setValor(''); setPessoas([{ ...vazio }]);
    } catch (e) { avisar(e?.message || 'Não foi possível criar.'); }
    setSalvando(false);
  };

  return (
    <View>
      <View style={est.trilho()}>
        {[['individual', 'Individual'], ['grupo', 'Em grupo']].map(([id, nome]) => (
          <TouchableOpacity key={id} style={[est.aba(), tipo === id && est.abaSel()]}
            onPress={() => { setTipo(id); if (id === 'individual') setPessoas(p => [p[0] || { ...vazio }]); }}>
            <Text style={[est.abaTxt(), tipo === id && est.abaTxtSel()]}>{nome}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Campo rotulo="Título (aparece para a pessoa)" value={titulo} onChangeText={setTitulo} placeholder="Ex.: Sessão de acompanhamento" maxLength={120} />
      <Text style={s.dica}>Evite colocar o nome da pessoa no título.</Text>
      <View style={s.par}>
        <Campo rotulo="Data" value={data} onChangeText={setData} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" />
        <Campo rotulo="Horário" value={hora} onChangeText={setHora} placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
      </View>
      <View style={s.par}>
        <Campo rotulo="Duração (min)" value={duracao} onChangeText={setDuracao} keyboardType="number-pad" />
        <Campo rotulo="Valor (opcional, R$)" value={valor} onChangeText={setValor} keyboardType="decimal-pad" />
      </View>
      <Text style={s.label}>{tipo === 'grupo' ? 'Participantes' : 'Pessoa atendida'}</Text>
      {pessoas.map((p, i) => (
        <View key={i} style={s.pessoaForm}>
          <TextInput style={s.input} value={p.nome} onChangeText={t => setPessoa(i, 'nome', t)} placeholder="Nome" placeholderTextColor={colors.tl} />
          <TextInput style={[s.input, { marginTop: 6 }]} value={p.email} onChangeText={t => setPessoa(i, 'email', t)} placeholder="E-mail (opcional)"
            placeholderTextColor={colors.tl} autoCapitalize="none" keyboardType="email-address" />
          {pessoas.length > 1 && (
            <TouchableOpacity onPress={() => setPessoas(ps => ps.filter((_, j) => j !== i))} style={s.linkAcao}>
              <Ionicons name="trash-outline" size={15} color={colors.roseTexto} /><Text style={[s.linkTxt, { color: colors.roseTexto }]}>Remover</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      {tipo === 'grupo' && pessoas.length < 12 && (
        <TouchableOpacity onPress={() => setPessoas(ps => [...ps, { ...vazio }])} style={s.linkAcao}>
          <Ionicons name="add" size={16} color={colors.lilasTexto} /><Text style={s.linkTxt}>Adicionar pessoa</Text>
        </TouchableOpacity>
      )}
      <BotaoAdmin title={salvando ? 'Criando…' : 'Criar atendimento'} onPress={criar} disabled={salvando} style={{ marginTop: spacing.md }} />
      {criados && (
        <View style={[est.tenue(), { padding: 12, marginTop: spacing.md }]}>
          <Text style={s.cardTitulo}>Links de convite</Text>
          {criados.map(c => (
            <View key={c.participanteId} style={{ marginTop: 8 }}>
              <Text style={s.corpo}>{c.nome}</Text>
              <Text style={s.dica} selectable>{c.link}</Text>
              <TouchableOpacity onPress={() => compartilharLink(c.link)} style={s.linkAcao}>
                <Ionicons name="share-outline" size={15} color={colors.lilasTexto} /><Text style={s.linkTxt}>Compartilhar link</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Cartao({ a, priv, agora, navigation, passado }) {
  const [ocupado, setOcupado] = useState(false);
  const pessoas = (priv?.participantes || []).filter(p => p.status !== 'removido');
  const aberta = salaAberta(a, agora, true);
  const ativo = !passado && a.status === 'agendado';

  const acao = async (nome, dados, ok) => {
    setOcupado(true);
    try { const r = await chamar(nome, dados); if (ok) avisar(ok); return r; } catch (e) { avisar(e?.message || 'Não foi possível concluir.'); return null; } finally { setOcupado(false); }
  };

  return (
    <View style={s.card}>
      <Text style={s.quando}>{dataHora(ms(a.inicio))} · {a.duracaoMin} min</Text>
      <Text style={s.cardTitulo}>{a.titulo}</Text>
      <Text style={s.dica}>
        {a.tipo === 'grupo' ? `Grupo · ${pessoas.length} pessoa(s)` : 'Individual'}
        {a.status === 'cancelado' ? ' · Cancelado' : a.status === 'concluido' ? ' · Concluído' : ''}
        {a.provedor !== 'daily' ? ' · Teste (Jitsi)' : ''}
        {a.valorCentavos != null ? ` · ${reais(a.valorCentavos)} ${a.pago ? '(pago)' : '(a receber)'}` : ''}
      </Text>

      {ativo && (
        <BotaoAdmin title={aberta ? 'Entrar na sala' : `Sala abre ${LIBERA_PROF_MIN} min antes`} icone="videocam" disabled={!aberta}
          onPress={() => navigation.navigate('SalaAtendimento', { atendimentoId: a.id })} style={{ marginTop: 12 }} />
      )}

      {pessoas.map(p => {
        const link = p.convite ? linkConvite(p.convite) : '';
        return (
          <View key={p.id} style={s.pessoa}>
            <Text style={s.corpo}>{p.nome} <Text style={s.dica}>· {p.status === 'aceito' ? 'aceitou' : 'convite enviado'}</Text></Text>
            {!!p.email && <Text style={s.dica}>{p.email}</Text>}
            {ativo && !!link && (
              <View style={s.acoes}>
                <TouchableOpacity style={s.linkAcao} onPress={() => compartilharLink(link)}>
                  <Ionicons name="share-outline" size={15} color={colors.lilasTexto} /><Text style={s.linkTxt}>Link</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.linkAcao} onPress={() => abrirWhatsApp(textoWhatsApp(p, a, link))}>
                  <Ionicons name="logo-whatsapp" size={15} color={colors.lilasTexto} /><Text style={s.linkTxt}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.linkAcao} disabled={ocupado}
                  onPress={() => confirmar('Novo link', `O link anterior de ${p.nome} deixa de funcionar.`, async () => {
                    const r = await acao('gerarConviteAtendimento', { id: a.id, participanteId: p.id });
                    if (r?.link) compartilharLink(r.link);
                  })}>
                  <Ionicons name="refresh" size={15} color={colors.lilasTexto} /><Text style={s.linkTxt}>Novo link</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.linkAcao} disabled={ocupado}
                  onPress={() => confirmar('Remover pessoa', `Remover ${p.nome} deste atendimento?`, () => acao('atualizarAtendimento', { id: a.id, remover: [p.id] }, 'Pessoa removida.'))}>
                  <Ionicons name="trash-outline" size={15} color={colors.roseTexto} /><Text style={[s.linkTxt, { color: colors.roseTexto }]}>Remover</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {ativo && (a.tipo === 'grupo' || pessoas.length === 0) && (
        <Recolhivel titulo="Adicionar pessoa" estilo={s.sub}><AdicionarPessoa id={a.id} acao={acao} /></Recolhivel>
      )}
      {ativo && <Recolhivel titulo="Editar horário e valor" estilo={s.sub}><Editar a={a} acao={acao} /></Recolhivel>}
      <Recolhivel titulo="Anotações privadas" subtitulo="Só você vê · sigilo profissional" icone="lock-closed-outline" estilo={s.sub}>
        <Anotacoes id={a.id} priv={priv} />
      </Recolhivel>

      {ativo && (
        <View style={s.acoes}>
          {agora > ms(a.inicio) && (
            <TouchableOpacity style={s.linkAcao} disabled={ocupado}
              onPress={() => confirmar('Concluir', 'Marcar este atendimento como concluído?', () => acao('atualizarAtendimento', { id: a.id, status: 'concluido' }))}>
              <Ionicons name="checkmark-done" size={15} color={colors.lilasTexto} /><Text style={s.linkTxt}>Concluir</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.linkAcao} disabled={ocupado}
            onPress={() => confirmar('Cancelar atendimento', 'Quem já aceitou recebe um aviso e os links deixam de abrir a sala.', () => acao('atualizarAtendimento', { id: a.id, status: 'cancelado' }, 'Atendimento cancelado.'))}>
            <Ionicons name="close-circle-outline" size={15} color={colors.roseTexto} /><Text style={[s.linkTxt, { color: colors.roseTexto }]}>Cancelar atendimento</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function AdicionarPessoa({ id, acao }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  return (
    <View>
      <Campo rotulo="Nome" value={nome} onChangeText={setNome} />
      <Campo rotulo="E-mail (opcional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <BotaoAdmin title="Adicionar" disabled={!nome.trim()} style={{ marginTop: 12 }}
        onPress={async () => { const r = await acao('atualizarAtendimento', { id, adicionar: [{ nome, email }] }, 'Pessoa adicionada. Compartilhe o link dela no cartão.'); if (r) { setNome(''); setEmail(''); } }} />
    </View>
  );
}

function Editar({ a, acao }) {
  const f = formularioDaData(ms(a.inicio));
  const [titulo, setTitulo] = useState(a.titulo || '');
  const [data, setData] = useState(f.data);
  const [hora, setHora] = useState(f.hora);
  const [duracao, setDuracao] = useState(String(a.duracaoMin || 50));
  const [valor, setValor] = useState(a.valorCentavos != null ? String(a.valorCentavos / 100) : '');
  const [pago, setPago] = useState(!!a.pago);
  const salvar = () => {
    const inicio = dataDoFormulario(data, hora);
    if (!inicio) { avisar('Preencha a data (DD/MM/AAAA) e o horário (HH:MM).'); return; }
    const mudou = inicio !== ms(a.inicio) || Number(duracao) !== a.duracaoMin;
    acao('atualizarAtendimento', {
      id: a.id, titulo, pago, valor: valor ? Number(String(valor).replace(',', '.')) : null,
      ...(mudou ? { inicio, duracaoMin: Number(duracao) } : {}),
    }, 'Atendimento atualizado.');
  };
  return (
    <View>
      <Campo rotulo="Título" value={titulo} onChangeText={setTitulo} />
      <View style={s.par}>
        <Campo rotulo="Data" value={data} onChangeText={setData} keyboardType="numbers-and-punctuation" />
        <Campo rotulo="Horário" value={hora} onChangeText={setHora} keyboardType="numbers-and-punctuation" />
      </View>
      <View style={s.par}>
        <Campo rotulo="Duração (min)" value={duracao} onChangeText={setDuracao} keyboardType="number-pad" />
        <Campo rotulo="Valor (R$)" value={valor} onChangeText={setValor} keyboardType="decimal-pad" />
      </View>
      <View style={s.linhaSwitch}><Text style={s.corpo}>Pago</Text><Switch value={pago} onValueChange={setPago} /></View>
      <BotaoAdmin title="Salvar" onPress={salvar} style={{ marginTop: 8 }} />
    </View>
  );
}

function Anotacoes({ id, priv }) {
  const [texto, setTexto] = useState(priv?.anotacoes || '');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setTexto(priv?.anotacoes || ''); }, [priv?.anotacoes]);
  const salvar = async () => {
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'atendimentosPrivado', id), { anotacoes: texto, anotacoesAtualizadasEm: serverTimestamp() });
      avisar('Anotações salvas.');
    } catch (e) { avisar('Não foi possível salvar: ' + (e?.message || '')); }
    setSalvando(false);
  };
  return (
    <View>
      <View style={est.aviso('lilas')}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.lilasTexto} />
        <Text style={est.avisoTxt('lilas')}>Sigilo profissional: só você, a psicóloga deste atendimento, lê estas anotações. Nem outras administradoras nem as pessoas atendidas têm acesso.</Text>
      </View>
      <TextInput style={[s.input, { minHeight: 140, textAlignVertical: 'top', marginTop: 10 }]} multiline value={texto} onChangeText={setTexto}
        maxLength={50000} placeholder="Evolução, combinados, temas para a próxima sessão…" placeholderTextColor={colors.tl} />
      <BotaoAdmin title={salvando ? 'Salvando…' : 'Salvar anotações'} onPress={salvar} disabled={salvando} style={{ marginTop: 10 }} />
    </View>
  );
}

function Configuracoes({ inicial, status, onSalvo }) {
  const [provedor, setProvedor] = useState(inicial.provedor === 'jitsi' ? 'jitsi' : 'daily');
  const [ativo, setAtivo] = useState(inicial.ativo !== false);
  const [salaDeEspera, setSalaDeEspera] = useState(inicial.salaDeEspera !== false);
  const [dias, setDias] = useState(String(inicial.beneficioDias ?? 60));
  const [crp, setCrp] = useState(inicial.crp || '');
  const [nomeProfissional, setNomeProfissional] = useState(inicial.nomeProfissional || '');
  const salvar = async () => {
    const n = Number(dias);
    if (!Number.isFinite(n) || n < 0 || n > 365) { avisar('O benefício vai de 0 a 365 dias.'); return; }
    try {
      await setDoc(doc(db, 'configuracoes', 'atendimentos'), {
        provedor, ativo, salaDeEspera, beneficioDias: Math.round(n), crp: crp.trim(), nomeProfissional: nomeProfissional.trim(), atualizadoEm: serverTimestamp(),
      }, { merge: true });
      avisar('Configurações salvas.');
      onSalvo?.();
    } catch (e) { avisar('Não foi possível salvar: ' + (e?.message || '')); }
  };
  return (
    <View>
      <Text style={s.label}>Serviço de vídeo</Text>
      <View style={est.trilho()}>
        {[['daily', 'Daily (produção)'], ['jitsi', 'Jitsi (teste)']].map(([id, nome]) => (
          <TouchableOpacity key={id} style={[est.aba(), provedor === id && est.abaSel()]} onPress={() => setProvedor(id)}>
            <Text style={[est.abaTxt(), provedor === id && est.abaTxtSel()]}>{nome}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {status && provedor === 'daily' && !status.temChaveDaily && (
        <Text style={s.dica}>A chave do Daily ainda não está no servidor: as salas seguem no Jitsi (modo de teste).</Text>
      )}
      <View style={s.linhaSwitch}><Text style={[s.corpo, { flex: 1 }]}>Atendimentos ligados</Text><Switch value={ativo} onValueChange={setAtivo} /></View>
      <View style={s.linhaSwitch}><Text style={[s.corpo, { flex: 1 }]}>Sala de espera (você admite a entrada)</Text><Switch value={salaDeEspera} onValueChange={setSalaDeEspera} /></View>
      <Campo rotulo="Cortesia no app (dias após cada sessão; 0 desliga)" value={dias} onChangeText={setDias} keyboardType="number-pad" />
      <Campo rotulo="CRP" value={crp} onChangeText={setCrp} placeholder="06/000000" />
      <Campo rotulo="Nome profissional (aparece no convite)" value={nomeProfissional} onChangeText={setNomeProfissional} />
      <BotaoAdmin title="Salvar configurações" onPress={salvar} style={{ marginTop: spacing.md }} />
    </View>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  sobre: est.sobretitulo(),
  pageTitle: est.titulo(),
  pageSub: est.subtitulo(),
  secao: { ...est.secao(), marginTop: spacing.lg, marginBottom: 10 },
  label: est.rotulo(),
  input: est.campo(),
  dica: est.dica(),
  corpo: est.corpo(),
  cardTitulo: { ...est.cartaoTitulo(), marginTop: 2 },
  par: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  card: { ...est.vidro(22), padding: 16, marginBottom: 12 },
  quando: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.lilasTexto },
  pessoa: { ...est.tenue(14), padding: 12, marginTop: 10 },
  pessoaForm: { ...est.tenue(14), padding: 10, marginBottom: 8 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  linkAcao: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.lav1 },
  linkTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lilasTexto },
  sub: { marginTop: 10, marginBottom: 0, shadowOpacity: 0, elevation: 0 },
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
}));
