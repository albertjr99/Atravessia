// AtravessIA — plano de ação para o ano que começa. Lê o histórico dos últimos
// 12 meses (check-ins, vitórias, diário, memórias do Experimente a vida e datas
// sensíveis) e propõe poucos compromissos gentis, com um ritmo por estação.
// Tudo calculado no aparelho; nada é enviado para fora.
import { emocoes as LISTA_EMOCOES } from '../data';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const diaDe = (d) => (typeof d === 'string' ? d.slice(0, 10) : '');
const POSITIVA = Object.fromEntries(LISTA_EMOCOES.map(e => [e.id, !!e.positiva]));
const NOME = Object.fromEntries(LISTA_EMOCOES.map(e => [e.id, (e.nomeRelatorio || e.label.toLowerCase()).replace(/^(a|o) /, '')]));

// Compromissos possíveis, ligados ao que apareceu no histórico.
const POR_EMOCAO = {
  sozinho: { area: 'Vínculos', icone: 'people-outline', titulo: 'Um encontro por mês', texto: 'Marque, uma vez por mês, um café, uma ligação longa ou uma caminhada com alguém da sua rede de apoio.' },
  saudade: { area: 'Memória', icone: 'heart-outline', titulo: 'Um ritual para a saudade', texto: 'Reserve um momento no mês para lembrar com carinho: uma foto, uma receita, uma música. A saudade também pode ser cuidada.' },
  triste: { area: 'Acolhimento', icone: 'headset-outline', titulo: 'Pausas de acolhimento', texto: 'Nos dias mais pesados, ouça um áudio de acolhimento antes de dormir. Pequenas pausas sustentam o caminho.' },
  ansioso: { area: 'Corpo', icone: 'leaf-outline', titulo: 'Respirar três vezes por semana', texto: 'Escolha três dias da semana para alguns minutos de respiração guiada. O corpo aprende a desacelerar com a repetição.' },
  medo: { area: 'Coragem', icone: 'shield-checkmark-outline', titulo: 'Um passo pequeno por mês', texto: 'Escolha algo que hoje parece difícil e divida em passos bem pequenos. Um por mês já é avanço.' },
  culpado: { area: 'Autocompaixão', icone: 'flower-outline', titulo: 'Escrever com gentileza', texto: 'Quando a culpa aparecer, escreva no diário o que você fez com amor. Lembrar disso também é verdade.' },
  raiva: { area: 'Corpo', icone: 'walk-outline', titulo: 'Movimento para aliviar', texto: 'Caminhadas, dança ou alongamento ajudam a dar vazão ao que pesa. Experimente duas vezes por semana.' },
  desanimado: { area: 'Descanso', icone: 'moon-outline', titulo: 'Proteger o descanso', texto: 'Combine com você um horário para desacelerar à noite. Descansar também é parte do cuidado.' },
};

/**
 * @param {object} p { nome, checkins, vitorias, diario, experiencias, datasSensiveis, hoje? }
 * @returns {{ anoAlvo, titulo, vazio, resumo: string[], compromissos: object[], estacoes: object[], fechamento: string }}
 */
export function montarPlanoAno({ nome, checkins = [], vitorias = [], diario = [], experiencias = [], datasSensiveis = [], hoje = new Date() }) {
  // A partir de outubro, o plano já olha para o próximo ano.
  const anoAlvo = hoje.getMonth() >= 9 ? hoje.getFullYear() + 1 : hoje.getFullYear();
  const inicio = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate()).toISOString().slice(0, 10);
  const recente = (lista) => lista.filter(x => diaDe(x.data) >= inicio);
  const ck = recente(checkins);
  const vt = recente(vitorias);
  const dr = recente(diario);
  const ex = recente(experiencias);
  const titulo = `Seu plano para ${anoAlvo}`;
  const saudacao = nome ? `${nome}, ` : '';

  if (ck.length < 5 && vt.length === 0 && dr.length === 0) {
    return {
      anoAlvo, titulo, vazio: true, resumo: [], estacoes: [],
      compromissos: [],
      fechamento: `${saudacao}ainda há poucos registros para montar um plano com a sua cara. Continue fazendo seus check-ins e registrando suas pequenas vitórias: com alguns meses de caminho, eu monto um plano para ${anoAlvo} a partir do que você viveu.`,
    };
  }

  // ---- O que o ano mostrou
  const contagem = {};
  ck.forEach(c => { contagem[c.emocao] = (contagem[c.emocao] || 0) + 1; });
  const ordem = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  const dias = new Set(ck.map(c => diaDe(c.data))).size;
  const porMes = {};
  ck.forEach(c => {
    const m = Number(diaDe(c.data).slice(5, 7)) - 1;
    if (!porMes[m]) porMes[m] = { total: 0, leves: 0 };
    porMes[m].total += 1;
    if (POSITIVA[c.emocao]) porMes[m].leves += 1;
  });
  const meses = Object.entries(porMes).filter(([, v]) => v.total >= 3).map(([m, v]) => ({ m: Number(m), prop: v.leves / v.total }));
  const maisLeve = meses.length ? meses.reduce((a, b) => (b.prop > a.prop ? b : a)) : null;
  const maisDificil = meses.length ? meses.reduce((a, b) => (b.prop < a.prop ? b : a)) : null;

  const resumo = [];
  if (dias) resumo.push(`Você esteve aqui em ${dias} ${dias === 1 ? 'dia' : 'dias'} nos últimos 12 meses, olhando para o que sentia.`);
  if (ordem[0]) resumo.push(`O sentimento mais presente foi ${NOME[ordem[0][0]] || 'um só'}${ordem[1] ? `, seguido de ${NOME[ordem[1][0]]}` : ''}.`);
  if (maisLeve && maisDificil && maisLeve.m !== maisDificil.m) {
    resumo.push(`${MESES[maisLeve.m][0].toUpperCase()}${MESES[maisLeve.m].slice(1)} foi o mês mais leve; ${MESES[maisDificil.m]} pediu mais cuidado.`);
  }
  if (vt.length) resumo.push(`Você registrou ${vt.length} ${vt.length === 1 ? 'pequena vitória' : 'pequenas vitórias'}.`);
  if (dr.length) resumo.push(`Escreveu no diário ${dr.length} ${dr.length === 1 ? 'vez' : 'vezes'}.`);
  if (ex.length) resumo.push(`E guardou ${ex.length} ${ex.length === 1 ? 'memória boa' : 'memórias boas'} ao experimentar a vida.`);

  // ---- Compromissos (no máximo 5, do mais ligado ao histórico para o mais geral)
  const compromissos = [];
  const usados = new Set();
  const add = (c) => { if (c && !usados.has(c.titulo) && compromissos.length < 5) { usados.add(c.titulo); compromissos.push(c); } };

  ordem.filter(([id]) => !POSITIVA[id]).slice(0, 2).forEach(([id]) => add(POR_EMOCAO[id]));

  const freq = {};
  vt.forEach(v => { const l = v.label || v.texto; if (l) freq[l] = (freq[l] || 0) + 1; });
  const topVitorias = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([l]) => l);
  if (topVitorias.length) {
    add({ area: 'O que já te faz bem', icone: 'star-outline', titulo: 'Continuar o que funciona', texto: `Suas vitórias mais frequentes foram ${topVitorias.map(l => `"${l}"`).join(' e ')}. Que tal transformar isso em hábito, um pouco a cada semana?` });
  }
  if (ex.length) {
    add({ area: 'Experimente a vida', icone: 'gift-outline', titulo: 'Uma experiência boa por mês', texto: 'As memórias que você guardou mostram que momentos de cuidado fazem diferença. Planeje uma experiência por mês com as parcerias.' });
  } else {
    add({ area: 'Experimente a vida', icone: 'gift-outline', titulo: 'Abrir espaço para o novo', texto: 'Escolha, a cada estação, uma experiência de bem-estar das parcerias do Experimente a vida.' });
  }
  if (dr.length < 12) {
    add({ area: 'Escrita', icone: 'create-outline', titulo: 'Diário uma vez por semana', texto: 'Escolha um dia da semana para escrever no diário guiado. Colocar em palavras ajuda a atravessar.' });
  } else {
    add({ area: 'Escrita', icone: 'create-outline', titulo: 'Manter a escrita', texto: 'A escrita já faz parte do seu caminho. Releia, a cada três meses, o que escreveu e perceba o quanto você andou.' });
  }
  add({ area: 'Constância', icone: 'calendar-outline', titulo: 'Check-in diário', texto: 'Um minuto por dia para contar como está. É ele que me ajuda a acompanhar você ao longo do ano.' });

  // Datas sensíveis do ano que começa: preparar um cuidado com antecedência.
  const datas = (datasSensiveis || []).map(d => ({ ...d, mes: Number(String(d.data || '').slice(5, 7)) - 1 })).filter(d => d.mes >= 0 && d.mes < 12);
  if (datas.length) {
    const nomes = [...new Set(datas.map(d => MESES[d.mes]))].slice(0, 3);
    add({ area: 'Datas sensíveis', icone: 'flower-outline', titulo: 'Preparar as datas importantes', texto: `Em ${nomes.join(', ')} há datas que pedem mais cuidado. Combine com você, com antecedência, um ritual de carinho para esses dias.` });
  }

  // ---- Ritmo por estação (trimestres do ano-alvo)
  const estacoes = [
    { periodo: 'Janeiro a março', foco: compromissos[0]?.titulo || 'Check-in diário', texto: 'Comece leve: escolha um compromisso e repita até virar parte da rotina.' },
    { periodo: 'Abril a junho', foco: compromissos[1]?.titulo || 'Diário uma vez por semana', texto: 'Acrescente um segundo cuidado e olhe para trás: o que já ficou mais fácil?' },
    { periodo: 'Julho a setembro', foco: compromissos[2]?.titulo || 'Uma experiência boa por mês', texto: 'Meio do ano é bom momento para uma experiência nova e para reler o diário.' },
    { periodo: 'Outubro a dezembro', foco: 'Olhar para o caminho', texto: 'Reveja suas cartas do mês e celebre o que você atravessou. Depois, eu monto o próximo plano com você.' },
  ];
  if (maisDificil) estacoes.forEach(e => { if (e.periodo.toLowerCase().includes(MESES[maisDificil.m])) e.texto += ` Este ano, ${MESES[maisDificil.m]} foi mais difícil: reforce o cuidado nessa época.`; });

  return {
    anoAlvo, titulo, vazio: false, resumo, compromissos, estacoes,
    fechamento: `${saudacao}este plano não é uma cobrança: é um mapa gentil. Mude o que quiser, no seu tempo. Estarei aqui ao longo de ${anoAlvo}.`,
  };
}
