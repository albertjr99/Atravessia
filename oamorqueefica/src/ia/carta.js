// AtravessIA — carta do mês: um texto afetuoso montado a partir do que a
// pessoa registrou no app (check-ins, vitórias e diário). Tudo calculado no
// aparelho; nada é enviado para fora.
import { emocoes as LISTA_EMOCOES } from '../data';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const diaDe = (d) => (typeof d === 'string' ? d.slice(0, 10) : '');

// Os rótulos do check-in são adjetivos ("Triste", "Com medo"); numa frase da
// carta a emoção precisa aparecer como substantivo, com artigo.
const SUBSTANTIVO = {
  saudade: 'a saudade', triste: 'a tristeza', sozinho: 'a solidão', medo: 'o medo',
  ansioso: 'a ansiedade', culpado: 'a culpa', raiva: 'a raiva', desanimado: 'o desânimo',
  grato: 'a gratidão', tranquilo: 'a paz', esperancoso: 'a esperança', alegre: 'a alegria', amoroso: 'o amor',
};
const NOME_EMOCAO = Object.fromEntries(LISTA_EMOCOES.map(e => [e.id, SUBSTANTIVO[e.id] || (e.nomeRelatorio || e.label).toLowerCase()]));
// "a, b e c"
const listar = (itens) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`);
const POSITIVA = Object.fromEntries(LISTA_EMOCOES.map(e => [e.id, !!e.positiva]));

const LEITURA = {
  saudade: 'A saudade esteve muito presente. Ela fala de um amor que não acabou, só mudou de lugar.',
  triste: 'A tristeza apareceu bastante. Que bom que você deu espaço para ela, em vez de escondê-la.',
  sozinho: 'A solidão marcou alguns dias. Lembre-se de que pedir companhia também é um gesto de força.',
  medo: 'O medo esteve por perto. Mesmo assim, você seguiu, um dia de cada vez.',
  ansioso: 'A ansiedade pediu atenção. Pausas e respirações curtas podem ser boas aliadas no próximo mês.',
  culpado: 'A culpa visitou você. Que você possa se lembrar de tudo o que fez com amor.',
  raiva: 'A raiva apareceu, e tudo bem: ela também faz parte do luto.',
  desanimado: 'O cansaço foi frequente. Seu corpo e seu coração estão trabalhando muito; descansar também é cuidar.',
  grato: 'A gratidão apareceu com força. Ela não apaga a dor, mas ilumina o caminho.',
  tranquilo: 'A paz esteve presente. Que bom poder sentir calma no meio de tudo.',
  esperancoso: 'A esperança foi sua companheira. Ela é um recomeço silencioso.',
  alegre: 'A alegria apareceu. Sentir-se bem também é permitido.',
  amoroso: 'O amor esteve em evidência. Ele continua, mesmo quando muda de forma.',
};

/**
 * @param {object} p { nome, ano, mes (0-11), checkins, vitorias, diario, experiencias }
 *   experiencias: memórias do Experimente a vida ({ data, texto, parceria? }).
 * @returns {{ titulo, paragrafos: string[], vazio: boolean, numeros: object }}
 */
export function montarCarta({ nome, ano, mes, checkins = [], vitorias = [], diario = [], experiencias = [] }) {
  const prefixo = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const doMes = (lista) => lista.filter(x => diaDe(x.data).startsWith(prefixo));
  const ck = doMes(checkins).sort((a, b) => diaDe(a.data).localeCompare(diaDe(b.data)));
  const vt = doMes(vitorias);
  const dr = doMes(diario);
  const ex = doMes(experiencias).filter(x => (x.texto || '').trim());
  const titulo = `Sua carta de ${MESES[mes]}`;
  const saudacao = nome ? `Oi, ${nome},` : 'Oi,';

  if (ck.length === 0 && vt.length === 0 && dr.length === 0 && ex.length === 0) {
    return {
      titulo, vazio: true, numeros: { checkins: 0, vitorias: 0, diario: 0 },
      paragrafos: [
        saudacao,
        `Ainda não há registros em ${MESES[mes]}, e está tudo bem: cada pessoa tem o seu tempo.`,
        'Quando quiser, faça um check-in, registre uma pequena vitória ou escreva no diário guiado. No fim do mês, eu transformo o seu caminho em uma carta como esta.',
        'Com carinho,\nAtravessIA',
      ],
    };
  }

  const contagem = {};
  ck.forEach(c => { contagem[c.emocao] = (contagem[c.emocao] || 0) + 1; });
  const ordem = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  const [predominante] = ordem[0] || [];
  const dias = new Set(ck.map(c => diaDe(c.data))).size;

  // Primeira metade x segunda metade do mês: houve mais dias leves no fim?
  const meio = Math.ceil(ck.length / 2);
  const propLeve = (lista) => (lista.length ? lista.filter(c => POSITIVA[c.emocao]).length / lista.length : 0);
  const inicio = propLeve(ck.slice(0, meio));
  const fim = propLeve(ck.slice(meio));

  const p = [saudacao];
  p.push(dias > 0
    ? `Em ${MESES[mes]}, você esteve aqui em ${dias === 1 ? 'um dia' : `${dias} dias`} para contar como estava. Cada check-in foi um momento em que você escolheu olhar para si.`
    : `Em ${MESES[mes]}, você cuidou de si de outras formas por aqui.`);
  if (predominante && LEITURA[predominante]) p.push(LEITURA[predominante]);
  if (ordem.length >= 3) {
    const outras = ordem.slice(1, 3).map(([id]) => NOME_EMOCAO[id]).filter(Boolean);
    if (outras.length) p.push(`${outras.length === 1 ? 'Também passou por você' : 'Também passaram por você'} ${listar(outras)}. Sentimentos diferentes podem conviver no mesmo coração.`);
  }
  if (ck.length >= 6) {
    if (fim - inicio >= 0.2) p.push('Percebi mais dias leves na segunda metade do mês. Sem pressa, o caminho também mostra os seus avanços.');
    else if (inicio - fim >= 0.2) p.push('O fim do mês trouxe dias mais difíceis. Seja especialmente gentil com você nas próximas semanas.');
  }
  if (vt.length) {
    const freq = {};
    vt.forEach(v => { const l = v.label || v.texto; if (l) freq[l] = (freq[l] || 0) + 1; });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => `"${l}"`);
    const qtd = `${vt.length} ${vt.length === 1 ? 'pequena vitória' : 'pequenas vitórias'}`;
    p.push(top.length ? `Você registrou ${qtd}, como ${listar(top)}. ${vt.length === 1 ? 'Ela conta' : 'Elas contam'}, e muito.` : `Você registrou ${qtd}. ${vt.length === 1 ? 'Ela conta' : 'Elas contam'}, e muito.`);
  }
  if (dr.length) {
    p.push(`Você também escreveu no diário ${dr.length === 1 ? 'uma vez' : `${dr.length} vezes`}. Colocar o que sente em palavras é uma forma corajosa de atravessar.`);
  }
  if (ex.length) {
    // As sensações boas que ela quis guardar ao experimentar a vida, nas palavras dela.
    const trechos = ex.slice(0, 3).map(x => {
      const t = x.texto.trim().replace(/\s+/g, ' ');
      const curto = t.length > 160 ? `${t.slice(0, 157).trim()}…` : t;
      return `"${curto.replace(/[.!?…]+$/, '')}"`;
    });
    p.push(`Ao experimentar a vida, você quis guardar na memória ${trechos.length === 1 ? 'esta sensação' : 'estas sensações'}: ${listar(trechos)}. Que ${trechos.length === 1 ? 'ela continue' : 'elas continuem'} com você.`);
  }
  p.push(`Que ${MESES[(mes + 1) % 12]} tenha espaço para tudo o que você sente e para o que faz bem a você.`);
  p.push('Com carinho,\nAtravessIA');

  return { titulo, vazio: false, paragrafos: p, numeros: { checkins: ck.length, dias, vitorias: vt.length, diario: dr.length, experiencias: ex.length } };
}
