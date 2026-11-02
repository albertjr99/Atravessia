import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { emocoes } from '../../data';
import { ICONES_VITORIA, iconeDaVitoria } from '../../data/iconesVitoria';
import { nomeDoEstado, formatarCidade } from '../../utils/localizacao';
import { colors, fonts, spacing, radius, criarEstilos } from '../../theme';
import AdminLayout from './AdminLayout';
import { formatDataBR } from '../../utils/date';
import { calcularMetricasFunil, planoNumero } from '../../utils/metricasFunil';
import { est, acento, corPlano, dadoPlano } from './adminEstilo';
import Recolhivel from '../../components/Recolhivel';

function nDiasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

const PLANO_LABELS = ['Perceber', 'Acolher', 'Compreender', 'Evoluir'];
const CHART_H = 70;

function MiniBar({ value, max, color, height = 8 }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <View style={{ flex: 1, height, backgroundColor: colors.bordaSuave, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color || colors.lav4, borderRadius: height / 2 }} />
    </View>
  );
}

// ─── Tab: Visão Geral ─────────────────────────────────────────────
function VisaoGeral({ usuarios, todosCheckins, totalVitorias }) {
  const hoje = nDiasAtras(0);
  const semanaAtras = nDiasAtras(7);
  const mesAtras = nDiasAtras(30);

  const checkSemana = todosCheckins.filter(c => c.data >= semanaAtras).length;
  const checkMes = todosCheckins.filter(c => c.data >= mesAtras).length;
  const ativasHoje = new Set(todosCheckins.filter(c => c.data === hoje).map(c => c.uid)).size;
  const ativasSemana = new Set(todosCheckins.filter(c => c.data >= semanaAtras).map(c => c.uid)).size;

  const porPlano = [0, 1, 2, 3].map(p => ({
    label: PLANO_LABELS[p],
    count: usuarios.filter(u => (u.plano || 0) === p).length,
  }));
  const maxPlano = Math.max(...porPlano.map(p => p.count), 1);

  const ultimos14 = Array.from({ length: 14 }, (_, i) => {
    const data = nDiasAtras(13 - i);
    return { data, label: data.slice(8), value: todosCheckins.filter(c => c.data === data).length };
  });
  const maxDia = Math.max(...ultimos14.map(d => d.value), 1);

  return (
    <View>
      <Text style={s.sobre}>Relatórios</Text>
      <Text style={s.pageTitle}>Visão Geral</Text>

      <View style={s.statsRow}>
        {[
          { icon: 'people-outline', value: usuarios.length, label: 'Usuárias', acento: 'lilas' },
          { icon: 'calendar-outline', value: todosCheckins.length, label: 'Check-ins', acento: 'salvia' },
          { icon: 'star-outline', value: totalVitorias ?? '—', label: 'Vitórias', acento: 'dourado' },
          { icon: 'flash-outline', value: ativasHoje, label: 'Ativas hoje', acento: 'pessego' },
        ].map(stat => (
          <View key={stat.label} style={s.statCard}>
            <View style={[s.statIcone, { backgroundColor: acento(stat.acento).fundo }]}>
              <Ionicons name={stat.icon} size={19} color={acento(stat.acento).tinta} />
            </View>
            <Text style={s.statVal}>{stat.value}</Text>
            <Text style={s.statLbl}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Engajamento</Text>
        <View style={s.engRow}>
          {[
            { val: checkSemana, lbl: 'check-ins\n7 dias' },
            { val: checkMes, lbl: 'check-ins\n30 dias' },
            { val: ativasSemana, lbl: 'ativas\n7 dias' },
          ].map((e, i) => (
            <React.Fragment key={i}>
              <View style={s.engItem}>
                <Text style={s.engVal}>{e.val}</Text>
                <Text style={s.engLbl}>{e.lbl}</Text>
              </View>
              {i < 2 && <View style={s.engDiv} />}
            </React.Fragment>
          ))}
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Distribuição por plano</Text>
        {porPlano.map((p, i) => (
          <View key={i} style={s.planRow}>
            <View style={[s.planDot, { backgroundColor: dadoPlano(i) }]} />
            <Text style={s.planNome}>{p.label}</Text>
            <MiniBar value={p.count} max={maxPlano} color={dadoPlano(i)} height={10} />
            <Text style={s.planCount}>{p.count}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Atividade — últimos 14 dias</Text>
        <View style={{ flexDirection: 'row', height: CHART_H + 34, alignItems: 'flex-end', gap: 4, paddingTop: 8 }}>
          {ultimos14.map((d, i) => {
            const barH = d.value > 0 ? Math.max(Math.round((d.value / maxDia) * CHART_H), 4) : 2;
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                {d.value > 0 && <Text style={s.barraValor}>{d.value}</Text>}
                <View style={{
                  width: '100%', height: barH,
                  backgroundColor: d.value > 0 ? dadoPlano(1) : colors.bordaSuave,
                  borderRadius: 5,
                }} />
                <Text style={s.barraDia}>{d.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Tab: Funil e retenção ────────────────────────────────────────
const FUNIL_CORES = ['#C3B5EC', '#A595DC', '#8B7AC0', '#6E9B7E'];

function IndicadorCard({ valor, rotulo, detalhe, cor = colors.td }) {
  return (
    <View style={s.indCard}>
      <Text style={[s.indVal, { color: cor }]}>{valor}</Text>
      <Text style={s.indLbl}>{rotulo}</Text>
      {!!detalhe && <Text style={s.indDet}>{detalhe}</Text>}
    </View>
  );
}

function AbaFunil({ usuarios, todosCheckins }) {
  const [periodo, setPeriodo] = useState('30');
  const m = React.useMemo(
    () => calcularMetricasFunil({ usuarios, checkins: todosCheckins, periodo }),
    [usuarios, todosCheckins, periodo],
  );
  const total = m.etapas[0].qtd;
  const txt = (v) => (v == null ? '—' : `${v}%`);

  return (
    <View>
      <Text style={s.sobre}>Relatórios</Text>
      <Text style={s.pageTitle}>Funil e retenção</Text>
      <Text style={s.funilIntro}>
        Acompanha o caminho de quem se cadastrou no período: se fez o primeiro check-in, se voltou e se assinou um plano.
      </Text>

      <View style={s.periodRow}>
        {[{ v: '30', l: 'Cadastros · 30 dias' }, { v: '90', l: '90 dias' }, { v: 'all', l: 'Tudo' }].map(p => (
          <TouchableOpacity
            key={p.v}
            style={[s.periodBtn, periodo === p.v && s.periodBtnSel]}
            onPress={() => setPeriodo(p.v)}
          >
            <Text style={[s.periodTxt, periodo === p.v && s.periodTxtSel]}>{p.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Funil</Text>
        {total === 0 ? (
          <Text style={s.emptyTxt}>Nenhum cadastro neste período.</Text>
        ) : m.etapas.map((e, i) => {
          const destaque = m.maiorQueda?.id === e.id;
          return (
            <View key={e.id} style={s.funilEtapa}>
              {i > 0 && (
                <View style={s.funilPassagem}>
                  <Ionicons name="arrow-down" size={13} color={destaque ? acento('rosa').texto : colors.tl} />
                  <Text style={[s.funilPassagemTxt, destaque && s.funilPassagemDestaque]}>
                    {txt(e.pctAnterior)} seguiram{e.perda > 0 ? ` · ${e.perda} ficaram pelo caminho` : ''}
                  </Text>
                </View>
              )}
              <View style={s.funilLinha}>
                <View style={{ flex: 1 }}>
                  <Text style={s.funilTit}>{e.titulo}</Text>
                  <Text style={s.funilDesc}>{e.descricao}</Text>
                </View>
                <Text style={s.funilQtd}>{e.qtd}</Text>
                <Text style={s.funilPct}>{txt(e.pctTotal)}</Text>
              </View>
              <View style={s.funilTrilho}>
                <View style={[s.funilBarra, { width: `${Math.max(e.pctTotal || 0, e.qtd > 0 ? 3 : 0)}%`, backgroundColor: FUNIL_CORES[i] }]} />
              </View>
            </View>
          );
        })}
        {m.maiorQueda && (
          <View style={s.funilAlerta}>
            <Ionicons name="alert-circle-outline" size={17} color={acento('rosa').texto} />
            <Text style={s.funilAlertaTxt}>
              Maior perda: de "{m.maiorQueda.de}" para "{m.maiorQueda.para}" — só {m.maiorQueda.pctAnterior}% seguiram.
            </Text>
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Retenção</Text>
        <View style={s.indRow}>
          <IndicadorCard
            valor={txt(m.retencaoD7.pct)}
            rotulo="Retenção D7"
            detalhe={`${m.retencaoD7.retidas} de ${m.retencaoD7.elegiveis} voltaram 7+ dias após o cadastro`}
            cor={acento('lilas').texto}
          />
          <IndicadorCard
            valor={txt(m.retencaoD30.pct)}
            rotulo="Retenção D30"
            detalhe={`${m.retencaoD30.retidas} de ${m.retencaoD30.elegiveis} voltaram 30+ dias após o cadastro`}
            cor={acento('lilas').texto}
          />
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Atividade e conversão</Text>
        <View style={s.indRow}>
          <IndicadorCard valor={m.ativas7} rotulo="Ativas · 7 dias" detalhe="com check-in na última semana" />
          <IndicadorCard valor={m.ativas30} rotulo="Ativas · 30 dias" detalhe="com check-in no último mês" />
        </View>
        <View style={[s.indRow, { marginTop: 8 }]}>
          <IndicadorCard
            valor={String(m.mediaCheckinsAtiva30).replace('.', ',')}
            rotulo="Check-ins por ativa"
            detalhe="média dos últimos 30 dias"
          />
          <IndicadorCard
            valor={txt(m.conversaoPago)}
            rotulo="Grátis → pago"
            detalhe={m.conversaoPagoEntreQueVoltaram != null
              ? `${m.conversaoPagoEntreQueVoltaram}% entre as que voltaram`
              : 'dos cadastros do período'}
            cor={acento('salvia').texto}
          />
        </View>
      </View>

      <Text style={s.funilNota}>
        {m.totalPagantes} usuária{m.totalPagantes !== 1 ? 's' : ''} em plano pago hoje.
        {m.semCusto > 0 ? ` ${m.semCusto} com acesso total ou cortesia ficam fora do funil, para não distorcer a conversão.` : ''}
        {m.semDataCadastro > 0 ? ` ${m.semDataCadastro} conta${m.semDataCadastro !== 1 ? 's' : ''} antiga${m.semDataCadastro !== 1 ? 's' : ''} sem data de cadastro só aparece${m.semDataCadastro !== 1 ? 'm' : ''} em "Tudo".` : ''}
      </Text>
    </View>
  );
}

// ─── Tab: Emoções ─────────────────────────────────────────────────
function AbaEmocoes({ todosCheckins }) {
  const [periodo, setPeriodo] = useState('30');

  const limiar = periodo === 'all' ? null : nDiasAtras(Number(periodo));
  const filtrados = limiar ? todosCheckins.filter(c => c.data >= limiar) : todosCheckins;

  const porEmocao = {};
  filtrados.forEach(c => { porEmocao[c.emocao] = (porEmocao[c.emocao] || 0) + 1; });
  const ordenados = Object.entries(porEmocao).sort((a, b) => b[1] - a[1]);
  const maxQtd = ordenados[0]?.[1] || 1;
  const total = filtrados.length;

  const positivas = filtrados.filter(c => emocoes.find(e => e.id === c.emocao)?.positiva).length;
  const negativas = total - positivas;

  return (
    <View>
      <Text style={s.sobre}>Relatórios</Text>
      <Text style={s.pageTitle}>Emoções</Text>

      <View style={s.periodRow}>
        {[{ v: '7', l: '7 dias' }, { v: '30', l: '30 dias' }, { v: 'all', l: 'Tudo' }].map(p => (
          <TouchableOpacity
            key={p.v}
            style={[s.periodBtn, periodo === p.v && s.periodBtnSel]}
            onPress={() => setPeriodo(p.v)}
          >
            <Text style={[s.periodTxt, periodo === p.v && s.periodTxtSel]}>{p.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {total > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Positivas vs. negativas</Text>
          <View style={s.pvnRow}>
            <View style={s.pvnItem}>
              <Text style={[s.pvnVal, { color: acento('salvia').texto }]}>{positivas}</Text>
              <Text style={s.pvnLbl}>Positivas</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MiniBar value={positivas} max={total} color="#6E9B7E" height={10} />
                <Text style={[s.pvnPct, { color: acento('salvia').texto }]}>{Math.round((positivas / total) * 100)}%</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MiniBar value={negativas} max={total} color="#C27C78" height={10} />
                <Text style={[s.pvnPct, { color: acento('rosa').texto }]}>{Math.round((negativas / total) * 100)}%</Text>
              </View>
            </View>
            <View style={s.pvnItem}>
              <Text style={[s.pvnVal, { color: acento('rosa').texto }]}>{negativas}</Text>
              <Text style={s.pvnLbl}>Negativas</Text>
            </View>
          </View>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.cardTitle}>Frequência ({total} check-ins)</Text>
        {ordenados.length === 0 ? (
          <Text style={s.emptyTxt}>Nenhum dado nesse período.</Text>
        ) : (
          ordenados.map(([id, qtd]) => {
            const emo = emocoes.find(e => e.id === id);
            const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
            return (
              <View key={id} style={{ marginBottom: 10 }}>
                <View style={s.emoHeader}>
                  <View style={[s.emoDot, { backgroundColor: emo?.dado || emo?.color || colors.lav3 }]} />
                  <Text style={s.emoLabel}>{emo?.label || id}</Text>
                  <Text style={s.emoQtd}>{qtd} · {pct}%</Text>
                </View>
                <MiniBar value={qtd} max={maxQtd} color={emo?.dado || emo?.color} height={10} />
              </View>
            );
          })
        )}
      </View>

      {ordenados.length >= 3 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Destaques do período</Text>
          {ordenados.slice(0, 3).map(([id, qtd], i) => {
            const emo = emocoes.find(e => e.id === id);
            const medalhas = ['🥇', '🥈', '🥉'];
            return (
              <View key={id} style={s.topRow}>
                <Text style={s.topMedal}>{medalhas[i]}</Text>
                <View style={[s.emoDot, { backgroundColor: emo?.dado || emo?.color || colors.lav3 }]} />
                <Text style={s.topLabel}>{emo?.label || id}</Text>
                <Text style={s.topQtd}>{qtd}×</Text>
              </View>
            );
          })}
        </View>
      )}

      <ResumoVitorias />
    </View>
  );
}

// ─── Tab: Usuárias ────────────────────────────────────────────────
// Só totais por estado e cidade, para orientar a prospecção de parcerias.
// A consulta de emoções, check-ins e vitórias por pessoa foi retirada do
// painel de propósito: esses dados ficam só no banco.
function AbaUsuarios({ usuarios }) {
  const [uf, setUf] = useState('');
  const [buscaCidade, setBuscaCidade] = useState('');

  const comUf = usuarios.filter(u => /^[A-Z]{2}$/.test(String(u.estado || '')));
  const semLocal = usuarios.length - comUf.length;

  const porEstadoMap = {};
  comUf.forEach(u => { porEstadoMap[u.estado] = (porEstadoMap[u.estado] || 0) + 1; });
  const porEstado = Object.entries(porEstadoMap).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const maxEstado = porEstado[0]?.[1] || 1;

  const porCidadeMap = {};
  comUf.filter(u => !uf || u.estado === uf).forEach(u => {
    const chave = `${formatarCidade(u.cidade) || '(cidade não informada)'} / ${u.estado}`;
    porCidadeMap[chave] = (porCidadeMap[chave] || 0) + 1;
  });
  const b = buscaCidade.trim().toLowerCase();
  const porCidade = Object.entries(porCidadeMap)
    .filter(([c]) => !b || c.toLowerCase().includes(b))
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'pt-BR'));
  const maxCidade = porCidade[0]?.[1] || 1;

  return (
    <View>
      <Text style={s.sobre}>Relatórios</Text>
      <Text style={s.pageTitle}>Onde estão as usuárias</Text>
      <Text style={s.funilIntro}>Totais por estado e cidade para orientar a busca de parcerias. Toque em um estado para ver as cidades.</Text>

      <View style={s.card}>
        <View style={s.engRow}>
          <View style={s.engItem}><Text style={s.engVal}>{uf ? (porEstadoMap[uf] || 0) : comUf.length}</Text><Text style={s.engLbl}>{uf ? `em ${uf}` : 'com estado\ninformado'}</Text></View>
          <View style={s.engDiv} />
          <View style={s.engItem}><Text style={s.engVal}>{porEstado.length}</Text><Text style={s.engLbl}>estados</Text></View>
          <View style={s.engDiv} />
          <View style={s.engItem}><Text style={s.engVal}>{semLocal}</Text><Text style={s.engLbl}>sem{'\n'}localização</Text></View>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Usuárias por estado</Text>
        {porEstado.length === 0 ? <Text style={s.emptyTxt}>Nenhuma usuária com estado informado ainda.</Text> : porEstado.map(([sigla, qtd]) => (
          <TouchableOpacity key={sigla} style={s.planRow} onPress={() => setUf(uf === sigla ? '' : sigla)} activeOpacity={0.7}>
            <Text style={[s.planNome, { width: 120 }, uf === sigla && { fontFamily: fonts.bodyBold, color: colors.lilasTexto }]} numberOfLines={1}>{nomeDoEstado(sigla)}</Text>
            <MiniBar value={qtd} max={maxEstado} color={uf === sigla ? dadoPlano(3) : dadoPlano(1)} height={10} />
            <Text style={s.planCount}>{qtd}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Usuárias por cidade{uf ? ` · ${uf}` : ''}</Text>
        <View style={s.searchBox}>
          <Ionicons name="search" size={15} color={colors.tl} />
          <TextInput
            style={s.searchInput}
            placeholder="Filtrar cidade..."
            placeholderTextColor={colors.tl}
            value={buscaCidade}
            onChangeText={setBuscaCidade}
            autoCorrect={false}
          />
        </View>
        {porCidade.length === 0 ? <Text style={s.emptyTxt}>Nenhuma cidade encontrada.</Text> : porCidade.slice(0, 60).map(([cidade, qtd]) => (
          <View key={cidade} style={s.planRow}>
            <Text style={[s.planNome, { width: 140 }]} numberOfLines={1}>{cidade}</Text>
            <MiniBar value={qtd} max={maxCidade} color={acento('salvia').tinta} height={10} />
            <Text style={s.planCount}>{qtd}</Text>
          </View>
        ))}
        {porCidade.length > 60 && <Text style={s.emptyTxt}>Mostrando as 60 cidades com mais usuárias.</Text>}
      </View>
    </View>
  );
}

// ─── Pequenas vitórias (agregado e anônimo, calculado no servidor) ─────
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (m) => `${MESES[Number(m.slice(5, 7)) - 1] || m.slice(5, 7)}/${m.slice(2, 4)}`;
const iconeVit = (id) => (id === 'create' ? 'create-outline' : iconeDaVitoria({ icone: id }));
const nomeIconeVit = (id) => (id === 'create' ? 'Escritas pelas usuárias' : (ICONES_VITORIA.find(i => i.id === id)?.nome || 'Estrela'));

function ResumoVitorias() {
  const [periodo, setPeriodo] = useState('30');
  const [uf, setUf] = useState('');
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    httpsCallable(functions, 'relatorioVitoriasAdmin', { timeout: 120000 })({ periodo, estado: uf })
      .then(r => { if (vivo) { setDados(r.data); setErro(''); } })
      .catch(e => { if (vivo) setErro(e?.message || 'Não foi possível carregar as vitórias.'); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [periodo, uf]);

  const maxRank = dados?.ranking?.[0]?.qtd || 1;
  const maxIcone = dados?.porIcone?.[0]?.qtd || 1;
  const maxMes = Math.max(...(dados?.porMes || []).map(m => m.qtd), 1);
  const ufsComDados = (dados?.porEstado || []).filter(e => e.uf !== '—').map(e => e.uf);

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={s.pageTitle}>Pequenas vitórias</Text>
      <Text style={s.funilIntro}>
        Resumo anônimo do que as usuárias celebraram — para inspirar conteúdos e escolher parcerias e achados.
        Frases e palavras escritas pelas próprias usuárias só aparecem quando vieram de 2 ou mais pessoas.
      </Text>

      <View style={s.periodRow}>
        {[{ v: '30', l: '30 dias' }, { v: '90', l: '90 dias' }, { v: '365', l: '12 meses' }, { v: 'all', l: 'Tudo' }].map(p => (
          <TouchableOpacity key={p.v} style={[s.periodBtn, periodo === p.v && s.periodBtnSel]} onPress={() => setPeriodo(p.v)}>
            <Text style={[s.periodTxt, periodo === p.v && s.periodTxtSel]}>{p.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.ordemRow, { flexWrap: 'nowrap' }]}>
        {['', ...new Set([...(uf ? [uf] : []), ...ufsComDados])].map(sigla => (
          <TouchableOpacity key={sigla || 'todos'} style={[s.ordemBtn, uf === sigla && s.ordemBtnSel]} onPress={() => setUf(sigla)}>
            <Text style={[s.ordemTxt, uf === sigla && s.ordemTxtSel]}>{sigla || 'Todos os estados'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {carregando && <ActivityIndicator color={colors.lav4} style={{ marginVertical: 12 }} />}
      {!!erro && (
        <View style={s.erroBox}>
          <Ionicons name="alert-circle-outline" size={17} color={acento('rosa').texto} />
          <Text style={s.erroTxt}>{erro}</Text>
        </View>
      )}

      {dados && (
        <>
          <View style={s.card}>
            <View style={s.engRow}>
              <View style={s.engItem}><Text style={s.engVal}>{dados.total}</Text><Text style={s.engLbl}>vitórias no{'\n'}período</Text></View>
              <View style={s.engDiv} />
              <View style={s.engItem}><Text style={s.engVal}>{dados.pessoas}</Text><Text style={s.engLbl}>pessoas{'\n'}registraram</Text></View>
              <View style={s.engDiv} />
              <View style={s.engItem}><Text style={s.engVal}>{dados.outrasPersonalizadas}</Text><Text style={s.engLbl}>escritas únicas{'\n'}(ocultas)</Text></View>
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Vitórias mais registradas</Text>
            {dados.ranking.length === 0 ? <Text style={s.emptyTxt}>Nenhuma vitória nesse período.</Text> : dados.ranking.map((r, i) => (
              <View key={r.label} style={{ marginBottom: 10 }}>
                <View style={s.emoHeader}>
                  <Text style={s.topQtd}>{i + 1}º</Text>
                  <Ionicons name={iconeVit(r.icone)} size={15} color={acento('dourado').tinta} />
                  <Text style={s.emoLabel} numberOfLines={2}>{r.label}{r.tipo === 'personalizada' ? ' · escrita' : ''}</Text>
                  <Text style={s.emoQtd}>{r.qtd}× · {r.pessoas}</Text>
                </View>
                <MiniBar value={r.qtd} max={maxRank} color={acento('dourado').tinta} height={8} />
              </View>
            ))}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Por categoria (ícone)</Text>
            {dados.porIcone.length === 0 ? <Text style={s.emptyTxt}>Sem dados.</Text> : dados.porIcone.map(c => (
              <View key={c.icone} style={s.planRow}>
                <Ionicons name={iconeVit(c.icone)} size={15} color={acento('pessego').tinta} />
                <Text style={[s.planNome, { width: 120 }]} numberOfLines={1}>{nomeIconeVit(c.icone)}</Text>
                <MiniBar value={c.qtd} max={maxIcone} color={acento('pessego').tinta} height={10} />
                <Text style={s.planCount}>{c.qtd}</Text>
              </View>
            ))}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Evolução por mês</Text>
            {dados.porMes.length === 0 ? <Text style={s.emptyTxt}>Sem dados.</Text> : (
              <View style={{ flexDirection: 'row', height: CHART_H + 34, alignItems: 'flex-end', gap: 4, paddingTop: 8 }}>
                {dados.porMes.slice(-12).map(m => {
                  const h = m.qtd > 0 ? Math.max(Math.round((m.qtd / maxMes) * CHART_H), 4) : 2;
                  return (
                    <View key={m.mes} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                      {m.qtd > 0 && <Text style={s.barraValor}>{m.qtd}</Text>}
                      <View style={{ width: '100%', height: h, backgroundColor: acento('dourado').tinta, borderRadius: 5 }} />
                      <Text style={s.barraDia} numberOfLines={1}>{rotuloMes(m.mes)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Temas mais frequentes nos textos</Text>
            {dados.palavras.length === 0 ? <Text style={s.emptyTxt}>Ainda não há palavras repetidas por 2 ou mais pessoas.</Text> : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {dados.palavras.map(p => (
                  <View key={p.palavra} style={[s.ordemBtn, { minHeight: 0, paddingVertical: 4 }]}>
                    <Text style={[s.ordemTxt, { fontSize: 12 + Math.round((p.qtd / dados.palavras[0].qtd) * 5) }]}>{p.palavra} · {p.qtd}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

// ─── Tab: Empresas ────────────────────────────────────────────────
function AbaEmpresas({ usuarios }) {
  const usuariosEmpresa = usuarios.filter(u => u.linkEmpresa === true);

  const porEmpresa = {};
  usuariosEmpresa.forEach(u => {
    const nome = u.empresa || '(empresa não identificada)';
    if (!porEmpresa[nome]) porEmpresa[nome] = [];
    porEmpresa[nome].push(u);
  });
  const empresas = Object.entries(porEmpresa).sort((a, b) => b[1].length - a[1].length);

  return (
    <View>
      <Text style={s.sobre}>Relatórios</Text>
      <Text style={s.pageTitle}>Empresas</Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>Usuárias via empresa</Text>
        <View style={s.engRow}>
          <View style={s.engItem}>
            <Text style={s.engVal}>{usuariosEmpresa.length}</Text>
            <Text style={s.engLbl}>total via{'\n'}empresa</Text>
          </View>
          <View style={s.engDiv} />
          <View style={s.engItem}>
            <Text style={s.engVal}>{empresas.length}</Text>
            <Text style={s.engLbl}>empresas{'\n'}diferentes</Text>
          </View>
          <View style={s.engDiv} />
          <View style={s.engItem}>
            <Text style={s.engVal}>{usuarios.length > 0 ? Math.round((usuariosEmpresa.length / usuarios.length) * 100) : 0}%</Text>
            <Text style={s.engLbl}>do total de{'\n'}usuárias</Text>
          </View>
        </View>
      </View>

      {empresas.length === 0 && (
        <Text style={s.emptyTxt}>Nenhuma usuária cadastrada via link de empresa ainda.</Text>
      )}

      {empresas.map(([nome, users]) => (
        // Lista de pessoas de cada empresa fica recolhida; o cabeçalho mostra o total.
        <Recolhivel
          key={nome}
          titulo={nome}
          icone="business-outline"
          direita={(
            <View style={{ backgroundColor: acento('dourado').fundo, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: acento('dourado').texto }}>{users.length} usuária{users.length !== 1 ? 's' : ''}</Text>
            </View>
          )}
        >
          {users.map((u, i) => (
            <View key={u.id} style={[s.histRow, i === users.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[s.emoDot, { backgroundColor: dadoPlano(u.plano || 0) }]} />
              <Text style={[s.histLabel, { flex: 1 }]}>{u.nome || u.email}</Text>
              <Text style={s.histData}>{PLANO_LABELS[u.plano || 0]}</Text>
            </View>
          ))}
        </Recolhivel>
      ))}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────
export default function AdminRelatoriosScreen({ navigation }) {
  const [aba, setAba] = useState('geral');
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [todosCheckins, setTodosCheckins] = useState([]);
  const [totalVitorias, setTotalVitorias] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const usersSnap = await getDocs(collection(db, 'usuarios'));
      // O plano pode estar como número (app) ou texto (painel web).
      // Administradoras e contas inativas não entram nos números.
      const users = usersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role !== 'admin' && u.status !== 'inativa')
        .map(u => ({ ...u, plano: planoNumero(u.plano) }));
      const ativas = new Set(users.map(u => u.id));

      // Sem orderBy: uma consulta de collectionGroup com orderBy exige um índice
      // de escopo COLLECTION_GROUP e falha inteira quando ele não existe — era o
      // que zerava a tela toda. A ordenação é feita aqui mesmo, em memória.
      const checkinsSnap = await getDocs(collectionGroup(db, 'checkins'));
      const checkins = checkinsSnap.docs
        .map(d => ({ id: d.id, uid: d.ref.path.split('/')[1], ...d.data() }))
        .filter(c => ativas.has(c.uid))
        .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));

      setUsuarios(users);
      setTodosCheckins(checkins);
      setErro('');

      // Vitórias: só o total, calculado no servidor (os textos não saem do banco).
      httpsCallable(functions, 'relatorioVitoriasAdmin', { timeout: 120000 })({ periodo: 'all' })
        .then(r => setTotalVitorias(r.data?.total ?? null))
        .catch(() => setTotalVitorias(null));
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar os dados.');
    }
    setCarregando(false);
    setAtualizando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (carregando) {
    return (
      <AdminLayout currentScreen="AdminRelatorios">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.lav4} size="large" />
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.texto2 }}>Carregando dados...</Text>
        </View>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentScreen="AdminRelatorios">
      <View style={s.tabWrap}>
      <View style={s.tabBar}>
        {[
          { id: 'geral', label: 'Geral', icon: 'stats-chart' },
          { id: 'funil', label: 'Funil', icon: 'funnel' },
          { id: 'emocoes', label: 'Emoções', icon: 'heart' },
          { id: 'usuarios', label: 'Usuárias', icon: 'people' },
          { id: 'empresas', label: 'Empresas', icon: 'business' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[s.tabBtn, aba === tab.id && s.tabBtnSel]}
            onPress={() => setAba(tab.id)}
            activeOpacity={0.8}
          >
            <Ionicons name={`${tab.icon}-outline`} size={17} color={aba === tab.id ? colors.lilasTexto : colors.texto2} />
            <Text style={[s.tabTxt, aba === tab.id && s.tabTxtSel]} numberOfLines={1}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={carregar} tintColor={colors.lav4} />}
        contentContainerStyle={s.scroll}
      >
        {erro ? (
          <View style={s.erroBox}>
            <Ionicons name="alert-circle-outline" size={17} color={acento('rosa').texto} />
            <Text style={s.erroTxt}>Não foi possível carregar os dados: {erro}</Text>
          </View>
        ) : null}
        {aba === 'geral' && (
          <VisaoGeral
            usuarios={usuarios}
            todosCheckins={todosCheckins}
            totalVitorias={totalVitorias}
          />
        )}
        {aba === 'funil' && <AbaFunil usuarios={usuarios} todosCheckins={todosCheckins} />}
        {aba === 'emocoes' && <AbaEmocoes todosCheckins={todosCheckins} />}
        {aba === 'usuarios' && <AbaUsuarios usuarios={usuarios} />}
        {aba === 'empresas' && <AbaEmpresas usuarios={usuarios} />}
        <View style={{ height: 40 }} />
      </ScrollView>
    </AdminLayout>
  );
}

const s = criarEstilos(() => ({
  scroll: { padding: spacing.lg, paddingTop: 12, paddingBottom: 48 },
  erroBox: { ...est.aviso('rosa'), alignItems: 'center', marginBottom: spacing.md },
  erroTxt: est.avisoTxt('rosa'),
  sobre: est.sobretitulo(),
  pageTitle: { ...est.titulo(), marginBottom: spacing.md },

  funilIntro: { ...est.subtitulo(), marginTop: -8, marginBottom: spacing.md },
  funilEtapa: { marginBottom: 4 },
  funilPassagem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingLeft: 2 },
  funilPassagemTxt: { fontFamily: fonts.body, fontSize: 12.5, color: colors.tl },
  funilPassagemDestaque: { fontFamily: fonts.bodyBold, color: acento('rosa').texto },
  funilLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  funilTit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  funilDesc: { fontFamily: fonts.body, fontSize: 12.5, color: colors.texto2 },
  funilQtd: { fontFamily: 'Figtree_800ExtraBold', fontSize: 20, color: colors.titulo, minWidth: 36, textAlign: 'right' },
  funilPct: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2, minWidth: 44, textAlign: 'right' },
  funilTrilho: { height: 14, borderRadius: 7, backgroundColor: colors.bordaSuave, overflow: 'hidden' },
  funilBarra: { height: '100%', borderRadius: 7 },
  funilAlerta: { ...est.aviso('rosa'), marginTop: spacing.md, padding: 12 },
  funilAlertaTxt: { ...est.avisoTxt('rosa'), fontSize: 13 },
  funilNota: { ...est.dica(), marginBottom: spacing.md, paddingHorizontal: 4 },
  indRow: { flexDirection: 'row', gap: 10 },
  indCard: { ...est.tenue(18), flex: 1, padding: 12, alignItems: 'center', gap: 2 },
  indVal: { fontFamily: 'Figtree_800ExtraBold', fontSize: 24 },
  indLbl: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.titulo, textAlign: 'center' },
  indDet: { fontFamily: fonts.body, fontSize: 12, color: colors.texto2, textAlign: 'center', lineHeight: 16 },

  tabWrap: { paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: 4 },
  tabBar: {
    ...est.trilho(), alignSelf: 'stretch', borderRadius: 22,
    backgroundColor: colors.escuro ? colors.card : colors.vidro,
    ...est.sombra(), shadowOpacity: colors.escuro ? 0.25 : 0.07,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 7, paddingHorizontal: 2, borderRadius: 18 },
  tabBtnSel: est.abaSel(),
  tabTxt: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.texto2 },
  tabTxtSel: { fontFamily: fonts.bodyBold, color: colors.lilasTexto },

  card: { ...est.vidro(24), padding: 18, marginBottom: spacing.md },
  cardDetalhe: { borderColor: colors.lav3, ...est.sombraForte() },
  cardTitle: { ...est.cartaoTitulo(), marginBottom: 12 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  statCard: { ...est.vidro(22), flexGrow: 1, flexBasis: '22%', minWidth: 76, padding: 12, alignItems: 'center', gap: 4 },
  statIcone: est.pilula(38),
  statVal: { fontFamily: 'Figtree_800ExtraBold', fontSize: 22, color: colors.titulo },
  statLbl: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2, textAlign: 'center' },
  barraValor: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.texto2, marginBottom: 2 },
  barraDia: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.tl, marginTop: 4 },

  engRow: { flexDirection: 'row', alignItems: 'center' },
  engItem: { flex: 1, alignItems: 'center', gap: 2 },
  engVal: { fontFamily: 'Figtree_800ExtraBold', fontSize: 24, color: colors.titulo },
  engLbl: { fontFamily: fonts.body, fontSize: 12.5, color: colors.texto2, textAlign: 'center' },
  engDiv: { width: 1, height: 40, backgroundColor: colors.bordaSuave },

  planRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  planDot: { width: 10, height: 10, borderRadius: 5 },
  planNome: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.td, width: 100 },
  planCount: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.td, width: 26, textAlign: 'right' },

  periodRow: { ...est.trilho(), alignSelf: 'stretch', marginBottom: spacing.md, backgroundColor: colors.escuro ? colors.card : colors.vidro },
  periodBtn: { ...est.aba(), flex: 1, paddingHorizontal: 6 },
  periodBtnSel: est.abaSel(),
  periodTxt: { ...est.abaTxt(), fontSize: 13 },
  periodTxtSel: est.abaTxtSel(),

  emoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  emoDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  emoLabel: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.td },
  emoQtd: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.texto2 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.bordaSuave },
  topMedal: { fontSize: 17, width: 26 },
  topLabel: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.td },
  topQtd: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.texto2 },

  pvnRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pvnItem: { alignItems: 'center', gap: 2 },
  pvnVal: { fontFamily: 'Figtree_800ExtraBold', fontSize: 22 },
  pvnLbl: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2 },
  pvnPct: { fontFamily: fonts.bodyBold, fontSize: 12, width: 38, textAlign: 'right' },

  searchBox: { ...est.campo(), flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0, borderRadius: 999, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.td, paddingVertical: 12 },

  ordemRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  ordemLbl: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.texto2 },
  ordemBtn: { ...est.chip(), minHeight: 34, paddingVertical: 6 },
  ordemBtnSel: est.chipSel(),
  ordemTxt: { ...est.chipTxt(), fontSize: 13 },
  ordemTxtSel: est.chipTxtSel(),

  lista: { ...est.vidro(24), paddingVertical: 2, marginBottom: spacing.md },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  userRowDiv: est.divisoria(),
  userRowSel: { backgroundColor: colors.lav1 },
  userPlanoBar: { width: 4, height: 38, borderRadius: 2, flexShrink: 0 },
  userName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.titulo },
  userEmail: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2 },
  userMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.tl },
  planoBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  planoBadgeTxt: { fontFamily: fonts.bodyBold, fontSize: 12 },

  detailNome: { fontFamily: fonts.serif, fontSize: 24, color: colors.titulo },
  detailEmail: { fontFamily: fonts.body, fontSize: 13.5, color: colors.texto2, marginTop: 2 },
  detailMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.texto2, marginTop: 4 },

  detailStatsRow: { flexDirection: 'row', gap: 8, marginVertical: spacing.sm },
  detailStatBox: { ...est.tenue(16), flex: 1, padding: 10, alignItems: 'center', gap: 2 },
  detailStatVal: { fontFamily: fonts.bodyBold, fontSize: 15 },
  detailStatLbl: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.texto2, textAlign: 'center' },

  histRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.bordaSuave },
  histLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.td },
  histData: { fontFamily: fonts.body, fontSize: 12.5, color: colors.texto2 },

  emptyTxt: { ...est.legenda(), textAlign: 'center', paddingVertical: spacing.md },
}), { escalar: false });
