import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, collectionGroup, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { emocoes } from '../../data';
import { colors, fonts, spacing, radius } from '../../theme';
import AdminLayout from './AdminLayout';
import { formatDataBR } from '../../utils/date';

function nDiasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

const PLANO_LABELS = ['Perceber', 'Acolher', 'Compreender', 'Evoluir'];
const PLANO_CORES = [colors.sage, colors.lav4, '#7B5EA7', '#C0843F'];
const CHART_H = 70;

function MiniBar({ value, max, color, height = 8 }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <View style={{ flex: 1, height, backgroundColor: colors.border, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color || colors.lav4, borderRadius: height / 2 }} />
    </View>
  );
}

// ─── Tab: Visão Geral ─────────────────────────────────────────────
function VisaoGeral({ usuarios, todosCheckins, todasVitorias }) {
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
      <Text style={s.pageTitle}>Visão Geral</Text>

      <View style={s.statsRow}>
        {[
          { icon: 'people', value: usuarios.length, label: 'Usuárias', color: colors.lav5 },
          { icon: 'calendar-sharp', value: todosCheckins.length, label: 'Check-ins', color: colors.sageFg },
          { icon: 'star', value: todasVitorias.length, label: 'Vitórias', color: colors.gold },
          { icon: 'flash', value: ativasHoje, label: 'Ativas hoje', color: colors.peach2 },
        ].map(stat => (
          <View key={stat.label} style={s.statCard}>
            <Ionicons name={stat.icon} size={18} color={stat.color} />
            <Text style={[s.statVal, { color: stat.color }]}>{stat.value}</Text>
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
            <View style={[s.planDot, { backgroundColor: PLANO_CORES[i] }]} />
            <Text style={s.planNome}>{p.label}</Text>
            <MiniBar value={p.count} max={maxPlano} color={PLANO_CORES[i]} />
            <Text style={s.planCount}>{p.count}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Atividade — últimos 14 dias</Text>
        <View style={{ flexDirection: 'row', height: CHART_H + 24, alignItems: 'flex-end', gap: 3, paddingTop: 8 }}>
          {ultimos14.map((d, i) => {
            const barH = d.value > 0 ? Math.max(Math.round((d.value / maxDia) * CHART_H), 4) : 2;
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                {d.value > 0 && <Text style={{ fontSize: 7, color: colors.tl, marginBottom: 2 }}>{d.value}</Text>}
                <View style={{
                  width: '100%', height: barH,
                  backgroundColor: d.value > 0 ? colors.lav4 : colors.border,
                  borderRadius: 2,
                }} />
                <Text style={{ fontSize: 7, color: colors.tl, marginTop: 3 }}>{d.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
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
              <Text style={[s.pvnVal, { color: colors.sageFg }]}>{positivas}</Text>
              <Text style={s.pvnLbl}>Positivas</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MiniBar value={positivas} max={total} color={colors.sage} />
                <Text style={[s.pvnPct, { color: colors.sageFg }]}>{Math.round((positivas / total) * 100)}%</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MiniBar value={negativas} max={total} color={colors.rose} />
                <Text style={[s.pvnPct, { color: colors.roseFg }]}>{Math.round((negativas / total) * 100)}%</Text>
              </View>
            </View>
            <View style={s.pvnItem}>
              <Text style={[s.pvnVal, { color: colors.roseFg }]}>{negativas}</Text>
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
                  <View style={[s.emoDot, { backgroundColor: emo?.color || colors.lav3 }]} />
                  <Text style={s.emoLabel}>{emo?.label || id}</Text>
                  <Text style={s.emoQtd}>{qtd} · {pct}%</Text>
                </View>
                <MiniBar value={qtd} max={maxQtd} color={emo?.color} />
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
                <View style={[s.emoDot, { backgroundColor: emo?.color || colors.lav3 }]} />
                <Text style={s.topLabel}>{emo?.label || id}</Text>
                <Text style={s.topQtd}>{qtd}×</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Tab: Usuárias ────────────────────────────────────────────────
function AbaUsuarios({ usuarios, todosCheckins, todasVitorias }) {
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState(null);
  const [ordemPor, setOrdemPor] = useState('nome'); // 'nome' | 'plano' | 'atividade'

  function getUltimoCheckin(uid) {
    const lista = todosCheckins.filter(c => c.uid === uid);
    if (!lista.length) return null;
    return lista.reduce((a, b) => (a.data >= b.data ? a : b)).data;
  }

  function diasInativos(uid) {
    const ult = getUltimoCheckin(uid);
    if (!ult) return 9999;
    return Math.floor((new Date() - new Date(ult + 'T12:00:00')) / 86400000);
  }

  const usuariosOrdenados = [...usuarios].sort((a, b) => {
    if (ordemPor === 'plano') return (b.plano || 0) - (a.plano || 0);
    if (ordemPor === 'atividade') return diasInativos(a.id) - diasInativos(b.id);
    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
  });

  const usuariosFiltrados = usuariosOrdenados.filter(u => {
    if (!busca) return true;
    const b = busca.toLowerCase();
    return (u.nome || '').toLowerCase().includes(b) || (u.email || '').toLowerCase().includes(b);
  });

  const userCheckins = sel
    ? todosCheckins.filter(c => c.uid === sel.id).sort((a, b) => b.data.localeCompare(a.data))
    : [];
  const userVitorias = sel
    ? todasVitorias.filter(v => v.uid === sel.id).sort((a, b) => (b.data || '').localeCompare(a.data || ''))
    : [];

  return (
    <View>
      <Text style={s.pageTitle}>Usuárias ({usuarios.length})</Text>

      <View style={s.searchBox}>
        <Ionicons name="search" size={15} color={colors.tl} />
        <TextInput
          style={s.searchInput}
          placeholder="Nome ou e-mail..."
          placeholderTextColor={colors.tl}
          value={busca}
          onChangeText={setBusca}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {!!busca && (
          <TouchableOpacity onPress={() => setBusca('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={colors.tl} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.ordemRow}>
        <Text style={s.ordemLbl}>Ordenar:</Text>
        {[{ v: 'nome', l: 'Nome' }, { v: 'plano', l: 'Plano' }, { v: 'atividade', l: 'Mais ativas' }].map(o => (
          <TouchableOpacity key={o.v} style={[s.ordemBtn, ordemPor === o.v && s.ordemBtnSel]} onPress={() => setOrdemPor(o.v)}>
            <Text style={[s.ordemTxt, ordemPor === o.v && s.ordemTxtSel]}>{o.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Detail panel */}
      {sel && (
        <View style={[s.card, { borderColor: colors.lav3, borderWidth: 1.5, marginBottom: spacing.md }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.detailNome}>{sel.nome || '—'}</Text>
              <Text style={s.detailEmail}>{sel.email}</Text>
              {!!sel.cidade && <Text style={s.detailMeta}>📍 {sel.cidade}</Text>}
            </View>
            <TouchableOpacity onPress={() => setSel(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={colors.tl} />
            </TouchableOpacity>
          </View>

          <View style={s.detailStatsRow}>
            {[
              { val: PLANO_LABELS[sel.plano || 0], lbl: 'Plano', color: PLANO_CORES[sel.plano || 0] },
              { val: userCheckins.length, lbl: 'Check-ins', color: colors.lav5 },
              { val: userVitorias.length, lbl: 'Vitórias', color: colors.gold },
              { val: diasInativos(sel.id) < 9999 ? `${diasInativos(sel.id)}d` : '—', lbl: 'Inativo', color: colors.peach2 },
            ].map((it, i) => (
              <View key={i} style={s.detailStatBox}>
                <Text style={[s.detailStatVal, { color: it.color }]}>{it.val}</Text>
                <Text style={s.detailStatLbl}>{it.lbl}</Text>
              </View>
            ))}
          </View>

          {sel.criadoEm && (
            <Text style={s.detailMeta}>
              Membro desde: {formatDataBR(sel.criadoEm?.toDate?.()?.toISOString().slice(0, 10) || '')}
            </Text>
          )}

          {userCheckins.length > 0 && (
            <>
              <Text style={[s.cardTitle, { marginTop: 12 }]}>Últimos check-ins</Text>
              {userCheckins.slice(0, 5).map((c, i) => {
                const emo = emocoes.find(e => e.id === c.emocao);
                return (
                  <View key={i} style={s.histRow}>
                    <View style={[s.emoDot, { backgroundColor: emo?.color || colors.lav3 }]} />
                    <Text style={s.histLabel}>{emo?.label || c.emocao}</Text>
                    <Text style={s.histData}>{formatDataBR(c.data)}</Text>
                  </View>
                );
              })}
            </>
          )}

          {userVitorias.length > 0 && (
            <>
              <Text style={[s.cardTitle, { marginTop: 12 }]}>Últimas vitórias</Text>
              {userVitorias.slice(0, 3).map((v, i) => (
                <View key={i} style={s.histRow}>
                  <Ionicons name="star" size={12} color={colors.gold} />
                  <Text style={s.histLabel}>{v.label}</Text>
                  <Text style={s.histData}>{formatDataBR(v.data)}</Text>
                </View>
              ))}
            </>
          )}

          {userCheckins.length === 0 && userVitorias.length === 0 && (
            <Text style={s.emptyTxt}>Nenhuma atividade registrada ainda.</Text>
          )}
        </View>
      )}

      {usuariosFiltrados.length === 0 && (
        <Text style={s.emptyTxt}>Nenhuma usuária encontrada.</Text>
      )}

      {usuariosFiltrados.map(u => {
        const plano = u.plano || 0;
        const nCheck = todosCheckins.filter(c => c.uid === u.id).length;
        const dias = diasInativos(u.id);
        const isSelected = sel?.id === u.id;
        const ultCheck = getUltimoCheckin(u.id);
        return (
          <TouchableOpacity
            key={u.id}
            style={[s.userRow, isSelected && s.userRowSel]}
            onPress={() => setSel(isSelected ? null : u)}
            activeOpacity={0.75}
          >
            <View style={[s.userPlanoBar, { backgroundColor: PLANO_CORES[plano] }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.userName} numberOfLines={1}>{u.nome || u.email}</Text>
              <Text style={s.userEmail} numberOfLines={1}>{u.email}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <View style={[s.planoBadge, { backgroundColor: PLANO_CORES[plano] + '20' }]}>
                <Text style={[s.planoBadgeTxt, { color: PLANO_CORES[plano] }]}>{PLANO_LABELS[plano]}</Text>
              </View>
              <Text style={s.userMeta}>
                {nCheck} check-in{nCheck !== 1 ? 's' : ''}
                {dias < 9999 ? ` · ${dias}d` : ''}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
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
        <View key={nome} style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={s.cardTitle}>{nome}</Text>
            <View style={{ backgroundColor: colors.gold + '22', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.gold }}>{users.length} usuária{users.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          {users.map((u, i) => (
            <View key={u.id} style={[s.histRow, i === users.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[s.emoDot, { backgroundColor: PLANO_CORES[u.plano || 0] }]} />
              <Text style={[s.histLabel, { flex: 1 }]}>{u.nome || u.email}</Text>
              <Text style={s.histData}>{PLANO_LABELS[u.plano || 0]}</Text>
            </View>
          ))}
        </View>
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
  const [todasVitorias, setTodasVitorias] = useState([]);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const usersSnap = await getDocs(collection(db, 'usuarios'));
      const users = usersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role !== 'admin');

      let checkins = [];
      try {
        const snap = await getDocs(
          query(collectionGroup(db, 'checkins'), orderBy('criadoEm', 'asc'))
        );
        checkins = snap.docs.map(d => ({
          id: d.id,
          uid: d.ref.path.split('/')[1],
          ...d.data(),
        }));
      } catch {}

      let vitorias = [];
      try {
        const snap = await getDocs(collectionGroup(db, 'vitorias'));
        vitorias = snap.docs.map(d => ({
          id: d.id,
          uid: d.ref.path.split('/')[1],
          ...d.data(),
        }));
      } catch {}

      setUsuarios(users);
      setTodosCheckins(checkins);
      setTodasVitorias(vitorias);
    } catch {}
    setCarregando(false);
    setAtualizando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (carregando) {
    return (
      <AdminLayout currentScreen="AdminRelatorios">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.lav4} size="large" />
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.tl }}>Carregando dados...</Text>
        </View>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentScreen="AdminRelatorios">
      <View style={s.tabBar}>
        {[
          { id: 'geral', label: 'Geral', icon: 'stats-chart' },
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
            <Ionicons name={tab.icon} size={14} color={aba === tab.id ? colors.lav5 : colors.tl} />
            <Text style={[s.tabTxt, aba === tab.id && s.tabTxtSel]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={carregar} tintColor={colors.lav4} />}
        contentContainerStyle={s.scroll}
      >
        {aba === 'geral' && (
          <VisaoGeral
            usuarios={usuarios}
            todosCheckins={todosCheckins}
            todasVitorias={todasVitorias}
          />
        )}
        {aba === 'emocoes' && <AbaEmocoes todosCheckins={todosCheckins} />}
        {aba === 'usuarios' && (
          <AbaUsuarios
            usuarios={usuarios}
            todosCheckins={todosCheckins}
            todasVitorias={todasVitorias}
          />
        )}
        {aba === 'empresas' && <AbaEmpresas usuarios={usuarios} />}
        <View style={{ height: 40 }} />
      </ScrollView>
    </AdminLayout>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.td, marginBottom: spacing.md },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: radius.md,
  },
  tabBtnSel: { backgroundColor: colors.lav1 },
  tabTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tl },
  tabTxtSel: { fontFamily: fonts.bodyBold, color: colors.lav5 },

  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
  },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td, marginBottom: spacing.sm },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: 10, alignItems: 'center', gap: 4,
  },
  statVal: { fontFamily: fonts.bodyBold, fontSize: 20 },
  statLbl: { fontFamily: fonts.body, fontSize: 9, color: colors.tm, textAlign: 'center' },

  engRow: { flexDirection: 'row', alignItems: 'center' },
  engItem: { flex: 1, alignItems: 'center', gap: 2 },
  engVal: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.td },
  engLbl: { fontFamily: fonts.body, fontSize: 10, color: colors.tl, textAlign: 'center' },
  engDiv: { width: 1, height: 36, backgroundColor: colors.border },

  planRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  planDot: { width: 10, height: 10, borderRadius: 5 },
  planNome: { fontFamily: fonts.body, fontSize: 12, color: colors.td, width: 80 },
  planCount: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.td, width: 20, textAlign: 'right' },

  periodRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  periodBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  periodBtnSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  periodTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tl },
  periodTxtSel: { fontFamily: fonts.bodyBold, color: colors.lav5 },

  emoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  emoDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  emoLabel: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  emoQtd: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.tm },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  topMedal: { fontSize: 16, width: 24 },
  topLabel: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td },
  topQtd: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.tm },

  pvnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pvnItem: { alignItems: 'center', gap: 2 },
  pvnVal: { fontFamily: fonts.bodyBold, fontSize: 20 },
  pvnLbl: { fontFamily: fonts.body, fontSize: 10, color: colors.tl },
  pvnPct: { fontFamily: fonts.bodyBold, fontSize: 10, width: 30, textAlign: 'right' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.td },

  ordemRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  ordemLbl: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },
  ordemBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  ordemBtnSel: { backgroundColor: colors.lav1, borderColor: colors.lav4 },
  ordemTxt: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },
  ordemTxtSel: { fontFamily: fonts.bodyBold, color: colors.lav5 },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: 8, overflow: 'hidden',
  },
  userRowSel: { borderColor: colors.lav4, backgroundColor: colors.lav1 },
  userPlanoBar: { width: 4, height: 40, borderRadius: 2, flexShrink: 0 },
  userName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.td },
  userEmail: { fontFamily: fonts.body, fontSize: 11, color: colors.tl },
  userMeta: { fontFamily: fonts.body, fontSize: 10, color: colors.tl },
  planoBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  planoBadgeTxt: { fontFamily: fonts.bodyBold, fontSize: 10 },

  detailNome: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.td },
  detailEmail: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, marginTop: 2 },
  detailMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.tm, marginTop: 4 },

  detailStatsRow: { flexDirection: 'row', gap: 6, marginVertical: spacing.sm },
  detailStatBox: {
    flex: 1, backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 8, alignItems: 'center', gap: 2,
  },
  detailStatVal: { fontFamily: fonts.bodyBold, fontSize: 14 },
  detailStatLbl: { fontFamily: fonts.body, fontSize: 9, color: colors.tl, textAlign: 'center' },

  histRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  histLabel: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.td },
  histData: { fontFamily: fonts.body, fontSize: 10, color: colors.tl },

  emptyTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.tl, textAlign: 'center', paddingVertical: spacing.md },
});
