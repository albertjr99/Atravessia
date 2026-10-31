// Relatórios em PDF (expo-print) no visual "Luz de Vidro" do app:
// fundo porcelana com aurora suave (lilás, pêssego e sálvia), cartões brancos
// arredondados com sombra ameixa, Figtree na interface e Cormorant Garamond
// itálico nos títulos afetivos. Gráficos em SVG inline (funcionam no expo-print).
//
// Cada gerador devolve um documento HTML completo em A4: capa (logo, nome,
// título, período e saudação) + seções numeradas + rodapé com o aviso de que o
// app não substitui acompanhamento profissional e a data de geração.
import { emocoes } from '../data';
import { LOGO_RELATORIO } from './logoRelatorio';

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// ── Paleta (modo claro do app) ───────────────────────────────────────────────
const C = {
  bg: '#F6F1EE',
  titulo: '#2A2433',
  texto: '#534C60',
  leve: '#6F6880',
  lilas: '#7A65CB',
  lilasTexto: '#524197',
  lav1: '#ECE6FA',
  lav2: '#DCD2F5',
  auroraLilas: '#C5B2F3',
  auroraPessego: '#F8CDB8',
  auroraSalvia: '#C3DDCC',
  pessego: '#D98A69',
  pessegoTexto: '#94492F',
  pessegoFundo: '#FCE7DC',
  salvia: '#6E9B7E',
  salviaTexto: '#3D6A4E',
  salviaFundo: '#E3F1E8',
  dourado: '#C9A15A',
  douradoTexto: '#765619',
  douradoFundo: '#F7EBD3',
  rosaTexto: '#A84868',
  rosaFundo: '#F9E1E9',
};

// Paleta de dados d2, usada quando a emoção não tem cor própria.
const CORES_DADO = ['#A595DC', '#E39A72', '#6E9B7E', '#C9A15A', '#7F9BCB', '#D682A0', '#8EA3C8', '#B98A7A', '#8FA89A', '#C27C78', '#9A90AE', '#C7A07E'];
const CORES_TRIM = ['#A595DC', '#E39A72', '#6E9B7E', '#C9A15A'];
const TINTAS_TRIM = ['#524197', '#A8582E', '#3F7A5E', '#765619'];
const CORES_VITORIA = ['#6A55BE', '#A8582E', '#3F7A5E', '#9A6B1F', '#4C6C9E', '#A84868'];

const LOCAIS = [
  { id: 'saude', label: 'Saúde física' },
  { id: 'eu', label: 'Eu comigo' },
  { id: 'trabalho', label: 'Trabalho' },
  { id: 'relacionamentos', label: 'Relacionamentos' },
];

// ── Utilidades ───────────────────────────────────────────────────────────────
const emoPorId = (id) => emocoes.find(e => e.id === id);
const corDado = (e, i = 0) => e?.dado || e?.color || CORES_DADO[i % CORES_DADO.length];

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function agoraBrasilia() {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function nomePessoa(usuario) {
  const n = String(usuario?.apelido || usuario?.nome || '').trim();
  return n ? n.split(/\s+/)[0] : '';
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// ── Ícones (traço simples, viewBox 24) ───────────────────────────────────────
const ICONES = {
  estrela: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/>',
  coracao: '<path d="M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.6 3.9 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.2 0 5.4 3.1 4.3 6.4-1.6 4.8-9.2 9.4-9.2 9.4z"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  lampada: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  brilho: '<path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z"/><path d="M19 3v4M17 5h4"/>',
  folha: '<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19c3-4 6-7 10-9"/>',
  documento: '<path d="M7 3h7l5 5v11.5A1.5 1.5 0 0 1 17.5 21h-10A1.5 1.5 0 0 1 6 19.5v-15A1.5 1.5 0 0 1 7.5 3z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  escudo: '<path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z"/>',
};

function icone(nome, cor, tam = 18, preenchido = false) {
  const corpo = ICONES[nome] || ICONES.coracao;
  const fill = preenchido ? cor : 'none';
  return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="${fill}" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${corpo}</svg>`;
}

// ── Gráficos (SVG inline) ────────────────────────────────────────────────────
// Rosca com pequenas fendas entre as fatias e o total ao centro.
function roscaSVG(dados, { tamanho = 160, espessura = 26, total, rotulo, trilho = C.lav1, corNum = C.titulo } = {}) {
  // O número do centro é sempre de check-ins (um por dia), com o mesmo rótulo da tela.
  if (!rotulo) rotulo = (total ?? dados.reduce((s, d) => s + d.value, 0)) === 1 ? 'check-in' : 'check-ins';
  const r = (tamanho - espessura) / 2;
  const cx = tamanho / 2;
  const circ = 2 * Math.PI * r;
  const tot = dados.reduce((s, d) => s + d.value, 0);
  const fenda = dados.length > 1 ? Math.min(2.5, circ * 0.006) : 0;
  let acum = 0;
  const fatias = tot > 0 ? dados.map(seg => {
    const comp = (seg.value / tot) * circ;
    const ini = (acum / tot) * circ;
    acum += seg.value;
    const vis = Math.max(comp - fenda, 0.6);
    return `<circle cx="${cx}" cy="${cx}" r="${r.toFixed(2)}" fill="none" stroke="${seg.color}" stroke-width="${espessura}"
      stroke-dasharray="${vis.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="${(-ini).toFixed(2)}"
      transform="rotate(-90 ${cx} ${cx})"/>`;
  }).join('') : '';
  const fsNum = Math.round(tamanho * 0.2);
  const fsRot = Math.max(9, Math.round(tamanho * 0.068));
  return `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 ${tamanho} ${tamanho}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cx}" r="${r.toFixed(2)}" fill="none" stroke="${trilho}" stroke-width="${espessura}"/>
    ${fatias}
    <text x="${cx}" y="${cx + fsNum * 0.3}" text-anchor="middle" font-family="Figtree, 'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="${fsNum}" fill="${corNum}">${total ?? tot}</text>
    <text x="${cx}" y="${cx + fsNum * 0.3 + fsRot + 4}" text-anchor="middle" font-family="Figtree, 'Helvetica Neue', Arial, sans-serif" font-weight="500" font-size="${fsRot}" fill="${C.leve}">${esc(rotulo)}</text>
  </svg>`;
}

// Legenda da rosca: bolinha na cor `dado`, nome, barra fina e porcentagem.
function legendaHTML(sorted, donut, total) {
  return sorted.map(([id, v], i) => {
    const e = emoPorId(id);
    const pct = total > 0 ? Math.round((v / total) * 100) : 0;
    const cor = donut[i]?.color || corDado(e, i);
    return `<div class="leg">
      <span class="leg-ponto" style="background:${cor}"></span>
      <span class="leg-nome">${esc(e?.label || id)}</span>
      <span class="leg-trilho"><span style="width:${Math.max(pct, 2)}%;background:${cor}"></span></span>
      <span class="leg-pct" style="color:${e?.color || C.titulo}">${pct}%</span>
      <span class="leg-n">${v}</span>
    </div>`;
  }).join('');
}

// ── Peças de layout ──────────────────────────────────────────────────────────
const FONTES = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&family=Figtree:wght@300..900&display=swap" rel="stylesheet">`;

const CSS = `
  /* Margem zero para a aurora cobrir a folha inteira; o respiro de topo e base
     de cada página vem do thead/tfoot da tabela .folhas (repetidos a cada página). */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  /* Só o html leva o fundo: assim a aurora (z-index -1) fica visível atrás do conteúdo. */
  html { background: ${C.bg}; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Figtree, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: ${C.texto}; font-size: 12px; line-height: 1.5; }
  .serif { font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; font-style: italic; }

  /* Aurora que se repete atrás de cada página (position: fixed na impressão). */
  .aurora { position: fixed; top: 0; left: 0; width: 210mm; height: 297mm; z-index: -1; }
  .capa-aurora { position: absolute !important; top: 0; left: 0; width: 100%; height: 100%; }

  /* ── Capa ── */
  .capa { position: relative; height: 296.5mm; overflow: hidden; page-break-after: always; break-after: page;
    padding: 14mm 18mm 12mm; display: flex; flex-direction: column; align-items: center; text-align: center; background: ${C.bg}; }
  .capa.unica { page-break-after: auto; break-after: auto; height: 296mm; }
  .capa > * { position: relative; }
  .capa-vazio { margin-top: 40px; width: 100%; padding: 40px 28px; background: rgba(255,255,255,0.72); border: 1px solid rgba(255,255,255,0.95);
    border-radius: 32px; box-shadow: 0 18px 44px rgba(58,40,110,0.12); }
  .capa-vazio .t { font-size: 17px; font-weight: 700; color: ${C.titulo}; margin-top: 12px; }
  .capa-vazio .d { font-size: 13px; color: ${C.texto}; margin-top: 4px; }
  .capa-logo { width: 92px; height: 92px; border-radius: 24px; box-shadow: 0 18px 40px rgba(58,40,110,0.28), 0 0 0 6px rgba(255,255,255,0.55); }
  .capa-marca { font-size: 50px; line-height: 1; color: ${C.titulo}; margin-top: 18px; font-weight: 500; }
  .capa-assin { font-size: 10px; letter-spacing: 3.2px; text-transform: uppercase; color: ${C.leve}; font-weight: 600; margin-top: 8px; }
  .capa-kicker { margin-top: 26px; display: inline-block; padding: 7px 18px; border-radius: 999px; background: rgba(255,255,255,0.78);
    border: 1px solid rgba(255,255,255,0.95); box-shadow: 0 6px 18px rgba(58,40,110,0.10);
    font-size: 11px; font-weight: 800; letter-spacing: 3px; color: ${C.lilasTexto}; }
  .capa-titulo { font-size: 64px; line-height: 1.02; color: ${C.titulo}; margin-top: 16px; font-weight: 500; }
  .capa-periodo { margin-top: 12px; font-size: 22px; font-weight: 800; color: ${C.lilasTexto}; letter-spacing: 0.4px; }
  .capa-saud { margin-top: 10px; font-size: 24px; color: ${C.texto}; }
  .capa-hero { margin-top: 28px; display: flex; align-items: center; justify-content: center; gap: 26px;
    background: rgba(255,255,255,0.72); border: 1px solid rgba(255,255,255,0.95); border-radius: 32px; padding: 22px 28px;
    box-shadow: 0 18px 44px rgba(58,40,110,0.12); width: 100%; text-align: left; }
  .capa-hero .lado { flex: 1; min-width: 0; }
  .capa-hero .rot { font-size: 10px; font-weight: 800; letter-spacing: 2.4px; text-transform: uppercase; color: ${C.leve}; }
  .capa-hero .domn { font-size: 46px; line-height: 1.05; margin-top: 4px; font-weight: 600; }
  .capa-hero .desc { font-size: 12.5px; color: ${C.texto}; margin-top: 6px; line-height: 1.55; }
  .capa-nums { display: flex; gap: 12px; margin-top: 16px; width: 100%; }
  .capa-num { flex: 1; background: rgba(255,255,255,0.72); border: 1px solid rgba(255,255,255,0.95); border-radius: 24px; padding: 16px 10px 14px;
    box-shadow: 0 12px 30px rgba(58,40,110,0.10); }
  .capa-num .n { font-size: 44px; line-height: 1; font-weight: 800; }
  .capa-num .l { font-size: 11px; color: ${C.texto}; margin-top: 6px; font-weight: 500; }
  .capa-num .ic { width: 34px; height: 34px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; }
  .capa-esp { flex: 1; }
  .capa-frase { margin-top: 22px; font-size: 30px; color: ${C.lilasTexto}; }
  .capa-aviso { margin-top: 10px; font-size: 9.5px; color: ${C.leve}; line-height: 1.5; }

  /* ── Conteúdo ── */
  .folhas { width: 100%; border-collapse: collapse; border-spacing: 0; }
  .folhas td { padding: 0 15mm; vertical-align: top; }
  .esp-topo { height: 13mm; }
  .esp-base { height: 12mm; }
  .topo { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid rgba(82,65,151,0.14); }
  .topo .m { display: flex; align-items: center; gap: 10px; }
  .topo img { width: 30px; height: 30px; border-radius: 9px; }
  .topo .nm { font-size: 22px; color: ${C.titulo}; line-height: 1; }
  .topo .rt { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: ${C.lilasTexto}; text-align: right; }
  .topo .rt span { display: block; font-weight: 500; letter-spacing: 0.3px; text-transform: none; color: ${C.leve}; font-size: 10.5px; margin-top: 2px; }

  .card { background: #FFFFFF; border: 1px solid rgba(255,255,255,0.9); border-radius: 24px; padding: 20px 22px;
    box-shadow: 0 10px 28px rgba(58,40,110,0.09); margin-bottom: 14px; page-break-inside: avoid; break-inside: avoid; }
  .card.veu { background: linear-gradient(135deg, #F3EEFC 0%, #FFFFFF 55%, #FDF1EA 100%); }
  .sec { display: flex; align-items: center; gap: 11px; margin-bottom: 4px; }
  .sec .num { width: 30px; height: 30px; border-radius: 10px; background: ${C.lav1}; color: ${C.lilasTexto}; font-weight: 800; font-size: 13px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sec h2 { font-size: 18px; font-weight: 700; color: ${C.titulo}; line-height: 1.25; }
  .sub { font-size: 11.5px; color: ${C.leve}; margin: 2px 0 0 41px; }
  .grade2 { display: flex; gap: 14px; }
  .grade2 > .card { flex: 1; min-width: 0; }

  .rosca-linha { display: flex; align-items: center; gap: 26px; margin-top: 14px; }
  .rosca-linha .legs { flex: 1; min-width: 0; }
  .leg { display: flex; align-items: center; gap: 9px; padding: 4px 0; }
  .leg-ponto { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
  .leg-nome { width: 112px; font-size: 12.5px; font-weight: 600; color: ${C.titulo}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .leg-trilho { flex: 1; height: 7px; border-radius: 4px; background: ${C.lav1}; overflow: hidden; }
  .leg-trilho span { display: block; height: 100%; border-radius: 4px; }
  .leg-pct { width: 40px; text-align: right; font-size: 13px; font-weight: 800; }
  .leg-n { width: 30px; text-align: right; font-size: 10.5px; color: ${C.leve}; }
  .nota { margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(42,36,51,0.08); font-size: 12px; color: ${C.texto}; }
  .nota b { color: ${C.lilasTexto}; font-weight: 800; }

  .areas { display: flex; gap: 10px; margin-top: 14px; }
  .area { flex: 1; min-width: 0; background: #FBF9FE; border-radius: 18px; padding: 14px 10px 12px; text-align: center; }
  .area .t { font-size: 12px; font-weight: 700; color: ${C.titulo}; margin-bottom: 8px; }
  .area .vazio { font-size: 10.5px; color: ${C.leve}; margin-top: 6px; }
  .area .li { display: flex; align-items: center; gap: 5px; font-size: 10.5px; color: ${C.texto}; margin-top: 4px; text-align: left; }
  .area .li i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: block; }
  .area .li span { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .area .li b { font-weight: 700; color: ${C.titulo}; }

  .vits { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
  .vit { width: calc(50% - 5px); display: flex; align-items: center; gap: 11px; background: #FBF9FE; border-radius: 18px; padding: 11px 12px; }
  .vit .ic { width: 38px; height: 38px; border-radius: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .vit .lb { font-size: 12px; font-weight: 700; color: ${C.titulo}; line-height: 1.3; }
  .vit .ds { font-size: 11px; font-weight: 700; margin-top: 2px; }

  .cal-cab, .cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
  .cal-cab { margin-top: 14px; margin-bottom: 6px; }
  .cal-cab div { text-align: center; font-size: 10.5px; font-weight: 800; color: ${C.lilasTexto}; }
  .cal div { height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: ${C.leve}; }
  .cal .on { font-weight: 800; }
  .cal .vz { background: transparent; }
  .cal .sem { background: #F7F4FA; }
  .cal-leg { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(42,36,51,0.08); }
  .cal-leg span { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: ${C.titulo}; }
  .cal-leg i { width: 10px; height: 10px; border-radius: 50%; display: block; }

  .dom { display: flex; align-items: center; gap: 16px; margin-top: 14px; padding: 16px; border-radius: 20px; }
  .dom .circ { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(255,255,255,0.7); }
  .dom .nome { font-size: 34px; line-height: 1.05; font-weight: 600; }
  .dom .d { font-size: 12px; color: ${C.texto}; margin-top: 3px; }

  .nums { display: flex; gap: 12px; margin-top: 14px; }
  .numbox { flex: 1; border-radius: 18px; padding: 16px 10px; text-align: center; }
  .numbox .n { font-size: 40px; line-height: 1; font-weight: 800; }
  .numbox .l { font-size: 11px; color: ${C.texto}; margin-top: 6px; font-weight: 500; }

  .trim { display: flex; align-items: flex-end; gap: 16px; height: 190px; margin-top: 18px; padding: 0 6px; border-bottom: 1px solid rgba(42,36,51,0.10); }
  .trim .col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
  .trim .pct { font-size: 18px; font-weight: 800; margin-bottom: 6px; }
  .trim .bar { width: 64%; border-radius: 14px 14px 4px 4px; min-height: 6px; }
  .trim-rot { display: flex; gap: 16px; padding: 8px 6px 0; }
  .trim-rot div { flex: 1; text-align: center; font-size: 11.5px; font-weight: 700; color: ${C.titulo}; }

  .msg { position: relative; overflow: hidden; }
  .msg .aspas { position: absolute; top: -18px; right: 22px; font-size: 120px; line-height: 1; color: ${C.lav2}; }
  .msg p { position: relative; font-size: 23px; line-height: 1.35; color: ${C.lilasTexto}; }
  .msg .ass { position: relative; display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-top: 12px; font-size: 11px; font-weight: 700; color: ${C.lilasTexto}; }

  .grupo-ins { margin: 4px 0 14px; }
  .ins-cab { page-break-inside: avoid; break-inside: avoid; padding-top: 6px; }
  .ins-cab .sec { margin-left: 4px; }
  .ins { display: flex; gap: 12px; align-items: flex-start; padding: 15px 18px; border-radius: 20px; margin-top: 10px;
    border: 1px solid rgba(255,255,255,0.9); box-shadow: 0 8px 22px rgba(58,40,110,0.07); page-break-inside: avoid; break-inside: avoid; }
  .ins .ic { width: 34px; height: 34px; border-radius: 12px; background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ins .t { font-size: 12.5px; font-weight: 800; margin-bottom: 2px; }
  .ins .t { font-size: 13px; }
  .ins .x { font-size: 12px; color: ${C.texto}; line-height: 1.55; }

  .vazio-card { text-align: center; padding: 40px 24px; }
  .vazio-card p { font-size: 13px; color: ${C.texto}; margin-top: 8px; }

  .rodape { margin-top: 18px; display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-radius: 22px;
    background: rgba(255,255,255,0.72); border: 1px solid rgba(255,255,255,0.95); page-break-inside: avoid; break-inside: avoid; }
  .rodape img { width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; }
  .rodape .a { font-size: 11px; font-weight: 700; color: ${C.titulo}; line-height: 1.45; }
  .rodape .g { font-size: 10px; color: ${C.leve}; margin-top: 3px; }
  .rodape .f { margin-left: auto; font-size: 20px; color: ${C.lilasTexto}; white-space: nowrap; padding-left: 10px; }
`;

// Aurora em SVG (gradientes radiais viram sombreamento nativo no PDF, sem
// emendas). Cada mancha: [cor, opacidade no centro, cx, cy, raio] numa folha 794×1123.
function auroraSVG(classe, prefixo, manchas) {
  const defs = manchas.map(([cor, op], i) => `<radialGradient id="${prefixo}${i}">
    <stop offset="0" stop-color="${cor}" stop-opacity="${op}"/>
    <stop offset="0.55" stop-color="${cor}" stop-opacity="${(op * 0.45).toFixed(2)}"/>
    <stop offset="1" stop-color="${cor}" stop-opacity="0"/></radialGradient>`).join('');
  const circs = manchas.map(([, , cx, cy, r], i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${prefixo}${i})"/>`).join('');
  return `<svg class="${classe}" viewBox="0 0 794 1123" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${circs}</svg>`;
}

const AVISO = 'Este aplicativo não substitui acompanhamento médico ou psicológico profissional.';

function documento({ titulo, capa, corpo }) {
  // Sem corpo (mês sem check-ins), o relatório é só a capa, em uma página.
  const folhas = corpo ? `<table class="folhas">
<thead><tr><td><div class="esp-topo"></div></td></tr></thead>
<tfoot><tr><td><div class="esp-base"></div></td></tr></tfoot>
<tbody><tr><td>
${corpo}
</td></tr></tbody>
</table>` : '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
${FONTES}
<style>${CSS}</style>
</head>
<body>
${auroraSVG('aurora', 'au', [
  [C.auroraLilas, 0.62, 90, 60, 330],
  [C.auroraPessego, 0.5, 790, 520, 300],
  [C.auroraSalvia, 0.55, 260, 1130, 340],
])}
${corpo ? capa : capa.replace('class="capa"', 'class="capa unica"')}
${folhas}
</body>
</html>`;
}

function capaHTML({ kicker, titulo, periodo, nome, destaque, numeros, frase, agora }) {
  const saud = nome ? `Para ${esc(nome)}, com carinho.` : 'Para você, com carinho.';
  return `<section class="capa">
    ${auroraSVG('capa-aurora', 'ca', [
      [C.auroraLilas, 0.95, 70, 40, 420],
      [C.auroraPessego, 0.9, 820, 380, 360],
      [C.auroraSalvia, 0.9, 170, 1150, 440],
      [C.auroraLilas, 0.75, 790, 1080, 300],
    ])}
    <img class="capa-logo" src="${LOGO_RELATORIO}" alt="Atravessia" />
    <div class="capa-marca serif">Atravessia</div>
    <div class="capa-assin">Relatório emocional pessoal</div>
    <div class="capa-kicker">${esc(kicker)}</div>
    <h1 class="capa-titulo serif">${titulo}</h1>
    <div class="capa-periodo">${esc(periodo)}</div>
    <div class="capa-saud serif">${saud}</div>
    ${destaque || ''}
    ${numeros && numeros.length ? `<div class="capa-nums">${numeros.map(n => `
      <div class="capa-num">
        <div class="ic" style="background:${n.fundo}">${icone(n.icone, n.tinta, 18)}</div>
        <div class="n" style="color:${n.cor}">${n.valor}</div>
        <div class="l">${esc(n.rotulo)}</div>
      </div>`).join('')}</div>` : ''}
    <div class="capa-esp"></div>
    <div class="capa-frase serif">${esc(frase)}</div>
    <div class="capa-aviso">${AVISO}<br>Gerado em ${esc(agora)} (horário de Brasília)</div>
  </section>`;
}

// Destaque da capa: rosca real das emoções + a emoção predominante.
function destaqueCapaHTML({ donut, total, dominante, texto }) {
  if (!total) return '';
  const e = emoPorId(dominante);
  const cor = e?.color || C.lilasTexto;
  return `<div class="capa-hero">
    ${roscaSVG(donut, { tamanho: 190, espessura: 32, total })}
    <div class="lado">
      <div class="rot">Emoção predominante</div>
      <div class="domn serif" style="color:${cor}">${esc(e?.label || dominante || '—')}</div>
      <div class="desc">${texto}</div>
    </div>
  </div>`;
}

function topoHTML(rotulo, periodo) {
  return `<div class="topo">
    <div class="m"><img src="${LOGO_RELATORIO}" alt="" /><span class="nm serif">Atravessia</span></div>
    <div class="rt">${esc(rotulo)}<span>${esc(periodo)}</span></div>
  </div>`;
}

function secao(num, titulo, sub) {
  return `<div class="sec"><span class="num">${num}</span><h2>${titulo}</h2></div>${sub ? `<p class="sub">${sub}</p>` : ''}`;
}

function rodapeHTML(agora, frase) {
  return `<div class="rodape">
    <img src="${LOGO_RELATORIO}" alt="" />
    <div>
      <div class="a">${AVISO}</div>
      <div class="g">Gerado em ${esc(agora)} (horário de Brasília) • Atravessia</div>
    </div>
    <div class="f serif">${esc(frase)}</div>
  </div>`;
}

// ── Blocos de conteúdo ───────────────────────────────────────────────────────
function cartaoEmocoes(num, titulo, d, nota) {
  return `<div class="card">
    ${secao(num, titulo)}
    <div class="rosca-linha">
      ${roscaSVG(d.donut, { tamanho: 176, espessura: 30, total: d.total })}
      <div class="legs">${legendaHTML(d.sorted, d.donut, d.total)}</div>
    </div>
    ${nota ? `<div class="nota">${nota}</div>` : ''}
  </div>`;
}

function cartaoAreas(num, areaData, nota) {
  if (!Array.isArray(areaData) || !areaData.length) return '';
  const blocos = LOCAIS.map(loc => {
    const a = areaData.find(x => x.id === loc.id) || { total: 0, sorted: [], donut: [] };
    const top = (a.sorted || []).slice(0, 3).map(([id, v], i) => {
      const e = emoPorId(id);
      const pct = a.total ? Math.round((v / a.total) * 100) : 0;
      return `<div class="li"><i style="background:${a.donut?.[i]?.color || corDado(e, i)}"></i><span>${esc(e?.label || id)}</span><b>${pct}%</b></div>`;
    }).join('');
    return `<div class="area">
      <div class="t">${esc(a.label || loc.label)}</div>
      ${roscaSVG(a.donut || [], { tamanho: 92, espessura: 15, total: a.total })}
      ${a.total ? top : '<div class="vazio">Sem registros</div>'}
    </div>`;
  }).join('');
  return `<div class="card">
    ${secao(num, 'Suas emoções nas áreas da vida')}
    <div class="areas">${blocos}</div>
    ${nota ? `<div class="nota">${nota}</div>` : ''}
  </div>`;
}

// Agrupa as vitórias por rótulo e conta em quantos dias distintos cada uma
// ocorreu (as 6 mais frequentes), como na tela.
function agruparVitorias(lista, max = 6) {
  const mapa = new Map();
  (lista || []).forEach(v => {
    const label = String(v?.label || '').trim();
    if (!label) return;
    if (!mapa.has(label)) mapa.set(label, new Set());
    mapa.get(label).add(v.data || v.id);
  });
  return [...mapa.entries()]
    .map(([label, dias]) => ({ label, dias: dias.size }))
    .sort((a, b) => b.dias - a.dias || a.label.localeCompare(b.label))
    .slice(0, max);
}

function cartaoVitorias(num, vitorias, sufixo) {
  const itens = agruparVitorias(vitorias);
  if (!itens.length) return '';
  const titulo = itens.length === 1 ? 'A maior vitória' : `As ${itens.length} maiores vitórias`;
  const n = vitorias.length;
  return `<div class="card">
    ${secao(num, titulo)}
    <div class="vits">${itens.map((v, i) => {
      const cor = CORES_VITORIA[i % CORES_VITORIA.length];
      return `<div class="vit">
        <div class="ic" style="background:${cor}1A">${icone('estrela', cor, 18)}</div>
        <div><div class="lb">${esc(v.label)}</div><div class="ds" style="color:${cor}">${plural(v.dias, 'dia', 'dias')}</div></div>
      </div>`;
    }).join('')}</div>
    <div class="nota">${n} conquista${n === 1 ? '' : 's'} registrada${n === 1 ? '' : 's'} ${sufixo}</div>
  </div>`;
}

function cartaoPredominante(num, dominante, frase) {
  const e = emoPorId(dominante);
  if (!e && !dominante) return '';
  const cor = e?.color || C.lilasTexto;
  return `<div class="card">
    ${secao(num, 'Emoção predominante')}
    <div class="dom" style="background:${e?.bg || C.lav1}">
      <div class="circ">${icone('coracao', cor, 30, false)}</div>
      <div>
        <div class="nome serif" style="color:${cor}">${esc(e?.label || dominante)}</div>
        <div class="d">${frase}</div>
      </div>
    </div>
  </div>`;
}

function cartaoMensagem(num, texto) {
  return `<div class="card veu msg">
    <span class="aspas serif">“</span>
    ${num ? `<div class="sec" style="margin-bottom:10px"><span class="num">${num}</span><h2>Mensagem para você</h2></div>` : ''}
    <p class="serif">${esc(texto)}</p>
    <div class="ass">${icone('folha', C.lilasTexto, 14)} Atravessia</div>
  </div>`;
}

function calendarioHTML(year, month, porData) {
  const primeiro = new Date(year, month, 1).getDay();
  const diasMes = new Date(year, month + 1, 0).getDate();
  const hoje = new Date();
  const cab = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => `<div>${d}</div>`).join('');
  const vazios = Array(primeiro).fill('<div class="vz"></div>').join('');
  const dias = Array.from({ length: diasMes }, (_, i) => {
    const d = i + 1;
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const e = porData?.[key];
    const futuro = new Date(year, month, d) > hoje;
    const ehHoje = d === hoje.getDate() && month === hoje.getMonth() && year === hoje.getFullYear();
    const borda = ehHoje ? `box-shadow: inset 0 0 0 2px ${C.lilas};` : '';
    if (e) return `<div class="on" style="background:${corDado(e)}4D;color:${e.color || C.titulo};${borda}">${d}</div>`;
    return `<div class="sem" style="${futuro ? 'opacity:0.4;' : ''}${borda}">${d}</div>`;
  }).join('');
  return `<div class="cal-cab">${cab}</div><div class="cal">${vazios}${dias}</div>`;
}

const INS_ESTILO = {
  positivo: { fundo: C.salviaFundo, tinta: C.salviaTexto, icone: 'estrela' },
  neutro: { fundo: C.lav1, tinta: C.lilasTexto, icone: 'brilho' },
  atencao: { fundo: C.pessegoFundo, tinta: C.pessegoTexto, icone: 'escudo' },
  dica: { fundo: C.douradoFundo, tinta: C.douradoTexto, icone: 'lampada' },
  acolhimento: { fundo: C.rosaFundo, tinta: C.rosaTexto, icone: 'coracao' },
};
const INS_ICONE_EMOJI = { '⭐': 'estrela', '🏆': 'estrela', '📅': 'calendario', '💡': 'lampada', '💜': 'coracao', '🤍': 'coracao', '🎨': 'brilho', '✨': 'brilho' };

function cartaoInsights(num, insights) {
  if (!insights || !insights.length) return '';
  // Cada leitura é um cartão próprio: o grupo pode seguir para a página
  // seguinte sem cortar nenhum cartão ao meio.
  const cartoes = insights.map(ins => {
    const st = INS_ESTILO[ins.tipo] || INS_ESTILO.neutro;
    const ic = INS_ICONE_EMOJI[ins.icone] || st.icone;
    return `<div class="ins" style="background:${st.fundo}">
      <div class="ic">${icone(ic, st.tinta, 18)}</div>
      <div><div class="t" style="color:${st.tinta}">${esc(ins.titulo)}</div><div class="x">${esc(ins.texto)}</div></div>
    </div>`;
  });
  return `<div class="grupo-ins">
    <div class="ins-cab">${secao(num, 'Interpretações e insights', 'Leituras gentis a partir dos seus próprios registros')}${cartoes[0]}</div>
    ${cartoes.slice(1).join('')}
  </div>`;
}

// Numerador de seções (só conta as que de fato aparecem).
function contador() {
  let n = 0;
  return () => ++n;
}

// Nota das áreas da vida (tela e PDF): só entram check-ins com área escolhida.
export function resumoAreasTexto(areaData, total) {
  if (!total) return '';
  const soma = (areaData || []).reduce((s, a) => s + (a.total || 0), 0);
  if (soma >= total) return 'Cada check-in conta uma vez, na área da vida escolhida naquele dia.';
  if (soma === 0) return 'Os check-ins deste período foram feitos sem escolher uma área da vida.';
  return `${soma} de ${total} check-ins tiveram uma área da vida escolhida; os outros foram feitos sem escolher área.`;
}

// ── Insights (mesmas regras de antes, com linguagem neutra) ──────────────────
function gerarInsightsMensais(mesal, diasPassados) {
  if (mesal.total === 0) return [];
  const insights = [];
  const pctDias = diasPassados > 0 ? Math.round((mesal.com / diasPassados) * 100) : 0;
  const emoObj = emoPorId(mesal.dominante);

  if (pctDias >= 80) {
    insights.push({ tipo: 'positivo', icone: '⭐', titulo: 'Constância admirável', texto: `Você fez check-in em ${mesal.com} de ${diasPassados} dias deste mês (${pctDias}%). Esse compromisso com o autoconhecimento é um gesto genuíno de cuidado com você.` });
  } else if (pctDias >= 50) {
    insights.push({ tipo: 'neutro', icone: '📅', titulo: 'Boa frequência de registros', texto: `Você fez check-in em ${mesal.com} de ${diasPassados} dias passados (${pctDias}%). Tente incluir o check-in nos dias sem registro para uma análise ainda mais completa.` });
  } else if (mesal.com > 0) {
    insights.push({ tipo: 'dica', icone: '💡', titulo: 'Continue registrando', texto: `Você fez check-in em ${plural(mesal.com, 'dia', 'dias')} este mês. Cada check-in, mesmo nos dias difíceis, é uma forma de cuidado próprio. Tente tornar esse hábito parte da rotina.` });
  }

  if (emoObj) {
    if (emoObj.positiva) {
      insights.push({ tipo: 'positivo', icone: '💜', titulo: `${emoObj.label} em destaque`, texto: `${emoObj.label} foi a emoção mais presente este mês. Identificar e acolher sentimentos positivos é parte essencial da jornada de cura.` });
    } else {
      const nomeEmo = emoObj.nomeRelatorio || emoObj.label.toLowerCase();
      insights.push({ tipo: 'acolhimento', icone: '🤍', titulo: `Atravessando ${nomeEmo}`, texto: `${emoObj.label} foi sua emoção mais frequente este mês. Sentir isso é natural no processo de luto — nomear o que você sente é o primeiro passo para atravessá-lo.` });
    }
  }

  if (mesal.sorted.length >= 5) {
    insights.push({ tipo: 'neutro', icone: '🎨', titulo: 'Alta consciência emocional', texto: `Você identificou ${mesal.sorted.length} emoções diferentes este mês. Essa riqueza de percepção mostra um olhar cada vez mais atento para o que você sente.` });
  }
  return insights;
}

function gerarInsightsAnuais(anual) {
  if (anual.total === 0) return [];
  const insights = [];
  const emoObj = emoPorId(anual.sorted[0]?.[0]);

  if (anual.consistencia >= 70) {
    insights.push({ tipo: 'positivo', icone: '🏆', titulo: 'Constância ao longo do ano', texto: `Você fez check-in em ${anual.uniqueDays} dias — ${anual.consistencia}% de constância anual. Esse compromisso ao longo de meses inteiros é extraordinário.` });
  } else if (anual.consistencia >= 40) {
    insights.push({ tipo: 'neutro', icone: '📅', titulo: 'Presença ao longo do ano', texto: `Você fez check-in em ${anual.uniqueDays} dias no ano (${anual.consistencia}% de constância). Cada período registrado conta uma parte importante da sua jornada.` });
  } else {
    insights.push({ tipo: 'dica', icone: '💡', titulo: 'Construa o hábito em doses', texto: `Você fez check-in em ${plural(anual.total, 'dia', 'dias')} este ano. No próximo período, tente pelo menos uma vez por semana — pequenos hábitos constantes constroem uma memória emocional muito valiosa.` });
  }

  if (emoObj) {
    if (emoObj.positiva) {
      insights.push({ tipo: 'positivo', icone: '💜', titulo: `${emoObj.label} marcou seu ano`, texto: `${emoObj.label} foi a emoção mais registrada no ano. Que ela continue sendo parte da sua jornada de cura.` });
    } else {
      const nomeEmo = emoObj.nomeRelatorio || emoObj.label.toLowerCase();
      insights.push({ tipo: 'acolhimento', icone: '🤍', titulo: `Um ano atravessando ${nomeEmo}`, texto: `${emoObj.label} foi sua emoção mais frequente do ano. Atravessar um ano inteiro com essa emoção presente exige uma coragem enorme — e você chegou até aqui.` });
    }
  }

  if (anual.total >= 100) {
    insights.push({ tipo: 'positivo', icone: '✨', titulo: `${anual.total} registros: um mapa emocional rico`, texto: 'Mais de 100 check-ins neste ano! Seus dados formam um mapa detalhado de como você se sentiu ao longo dos meses — isso é autoconhecimento em ação.' });
  }
  return insights;
}

function gerarInsightsPeriodo(rangeData, diasPeriodo) {
  if (!rangeData || rangeData.total === 0) return [];
  const insights = [];
  const emoObj = emoPorId(rangeData.dominante);
  const pctDias = diasPeriodo > 0 ? Math.round((rangeData.uniqueDays / diasPeriodo) * 100) : 0;

  if (pctDias >= 70) {
    insights.push({ tipo: 'positivo', icone: '⭐', titulo: 'Alta frequência no período', texto: `Você registrou ${rangeData.uniqueDays} de ${diasPeriodo} dias do período (${pctDias}%). Essa frequência fornece uma análise consistente da sua jornada emocional.` });
  } else {
    insights.push({ tipo: 'neutro', icone: '📅', titulo: 'Seus registros no período', texto: `Você fez check-in em ${plural(rangeData.uniqueDays, 'dia', 'dias')} dentro do período selecionado. Cada registro contribui para a sua análise emocional.` });
  }

  if (emoObj) {
    if (emoObj.positiva) {
      insights.push({ tipo: 'positivo', icone: '💜', titulo: `${emoObj.label} predominou`, texto: `${emoObj.label} foi a emoção mais registrada neste período. Identificar sentimentos positivos é parte fundamental da jornada de cura.` });
    } else {
      const nomeEmo = emoObj.nomeRelatorio || emoObj.label.toLowerCase();
      insights.push({ tipo: 'acolhimento', icone: '🤍', titulo: `Atravessando ${nomeEmo}`, texto: `${emoObj.label} foi a emoção mais frequente no período. Nomear e acolher esse sentimento é um ato de coragem e de autoconhecimento.` });
    }
  }
  return insights;
}

// Mensagem padrão do mês (a tela pode enviar a mensagem configurada pela administração).
export function mensagemMensalPadrao(dominante) {
  const e = emoPorId(dominante);
  if (!e) return 'Continue fazendo seus registros. Cada check-in é um passo de autoconhecimento.';
  if (e.positiva) return `${e.label} esteve presente em você este mês. Guarde esse sentimento com carinho.`;
  const nomeEmo = e.nomeRelatorio || e.label.toLowerCase();
  return `Atravessando ${nomeEmo} — esse foi seu mês. Cada sentimento que você nomeia é um passo de cuidado. Você não precisa fazer essa travessia sem companhia.`;
}

const MSG_ANUAL = 'Você atravessou altos e baixos, dias leves e dias desafiadores. Cada emoção registrada mostra sua coragem de olhar para dentro. Que o próximo ano seja cheio de leveza, autoconhecimento e cuidado com você.';
const MSG_PERIODO = 'Cada emoção registrada neste período é uma janela de autoconhecimento. Você teve coragem de olhar para dentro e nomear o que sentia. Continue se cuidando.';

// ── Relatório mensal ─────────────────────────────────────────────────────────
export function gerarRelatorioMensalHTML({ mesal, usuario, month, year, vitorias = [], mensagem }) {
  const agora = agoraBrasilia();
  const periodo = `${MESES[month]} de ${year}`;
  const nome = nomePessoa(usuario);
  const diasPassados = mesal.com + mesal.semRegistro;
  const mesParcial = diasPassados < new Date(year, month + 1, 0).getDate();
  const e = emoPorId(mesal.dominante);
  const n = contador();

  let capa = capaHTML({
    kicker: 'RELATÓRIO MENSAL',
    titulo: 'Seu mês em emoções',
    periodo,
    nome,
    destaque: destaqueCapaHTML({
      donut: mesal.donut, total: mesal.total, dominante: mesal.dominante,
      texto: e ? `foi a emoção mais presente neste mês, entre ${plural(mesal.sorted.length, 'emoção registrada', 'emoções registradas')}.` : '',
    }),
    numeros: mesal.total ? [
      { valor: mesal.total, rotulo: mesal.total === 1 ? 'dia com check-in' : 'dias com check-in', icone: 'coracao', cor: C.lilasTexto, fundo: C.lav1, tinta: C.lilas },
      { valor: diasPassados, rotulo: mesParcial ? 'dias do mês até hoje' : 'dias no mês', icone: 'calendario', cor: C.pessegoTexto, fundo: C.pessegoFundo, tinta: C.pessego },
      { valor: `${diasPassados > 0 ? Math.round((mesal.total / diasPassados) * 100) : 0}%`, rotulo: 'de constância', icone: 'estrela', cor: C.douradoTexto, fundo: C.douradoFundo, tinta: C.dourado },
    ] : [],
    frase: 'Perceber é o início.',
    agora,
  });

  let corpo = '';
  if (mesal.total === 0) {
    capa = capa.replace('<div class="capa-esp"></div>', `<div class="capa-vazio">
        ${icone('coracao', C.lilas, 36)}
        <div class="t">Ainda não há check-ins este mês.</div>
        <div class="d">Faça seu primeiro check-in para ver seu relatório.</div>
      </div><div class="capa-esp"></div>`);
  } else {
    const legCal = mesal.sorted.map(([id], i) => {
      const em = emoPorId(id);
      return `<span><i style="background:${mesal.donut[i]?.color || corDado(em, i)}"></i>${esc(em?.label || id)}</span>`;
    }).join('');
    corpo = `${topoHTML('Relatório mensal', periodo)}
      ${cartaoEmocoes(n(), 'Seu mês em emoções', mesal,
        `Você fez check-in em <b>${mesal.total}</b> de <b>${diasPassados}</b> dias deste mês${mesParcial ? ' até hoje' : ''}.`)}
      ${cartaoAreas(n(), mesal.areaData, esc(resumoAreasTexto(mesal.areaData, mesal.total)))}
      ${cartaoVitorias(n(), vitorias, 'este mês')}
      <div class="card">
        ${secao(n(), 'Calendário emocional', 'Cada cor representa a emoção predominante do dia')}
        ${calendarioHTML(year, month, mesal.byDate)}
        <div class="cal-leg">${legCal}</div>
      </div>
      <div class="grade2">
        ${cartaoPredominante(n(), mesal.dominante, 'foi a emoção mais presente neste mês.')}
        <div class="card">
          ${secao(n(), 'Seus registros')}
          <div class="nums">
            <div class="numbox" style="background:${C.lav1}"><div class="n" style="color:${C.lilasTexto}">${mesal.total}</div><div class="l">dias com check-in</div></div>
            <div class="numbox" style="background:${C.pessegoFundo}"><div class="n" style="color:${C.pessegoTexto}">${mesal.semRegistro}</div><div class="l">dias sem check-in</div></div>
          </div>
        </div>
      </div>
      ${cartaoMensagem(n(), mensagem || mensagemMensalPadrao(mesal.dominante))}
      ${cartaoInsights(n(), gerarInsightsMensais(mesal, diasPassados))}
      ${rodapeHTML(agora, 'Perceber é o início.')}`;
  }
  return documento({ titulo: `Atravessia — Relatório mensal — ${periodo}`, capa, corpo });
}

// ── Relatório anual ──────────────────────────────────────────────────────────
export function gerarRelatorioAnualHTML({ anual, usuario, year, vitorias = [] }) {
  const agora = agoraBrasilia();
  const periodo = `Ano de ${year}`;
  const nome = nomePessoa(usuario);
  const dominante = anual.sorted[0]?.[0];
  const e = emoPorId(dominante);
  const n = contador();

  const capa = capaHTML({
    kicker: 'RELATÓRIO ANUAL',
    titulo: 'Sua jornada<br>emocional do ano',
    periodo,
    nome,
    destaque: destaqueCapaHTML({
      donut: anual.donut, total: anual.total, dominante,
      texto: e ? 'foi a emoção mais registrada ao longo do ano.' : '',
    }),
    numeros: [
      { valor: anual.uniqueDays, rotulo: anual.uniqueDays === 1 ? 'dia com check-in' : 'dias com check-in', icone: 'coracao', cor: C.lilasTexto, fundo: C.lav1, tinta: C.lilas },
      ...(anual.totalDias > 0 ? [{ valor: anual.totalDias, rotulo: 'dias do ano até hoje', icone: 'calendario', cor: C.pessegoTexto, fundo: C.pessegoFundo, tinta: C.pessego }] : []),
      { valor: `${anual.consistencia}%`, rotulo: 'de constância no ano', icone: 'estrela', cor: C.douradoTexto, fundo: C.douradoFundo, tinta: C.dourado },
    ],
    frase: 'Siga se cuidando. Você vale!',
    agora,
  });

  const trimRot = ['1º trimestre', '2º trimestre', '3º trimestre', '4º trimestre'];
  const maxPct = Math.max(...anual.trimPct, 1);
  const trimestres = (num) => `<div class="card">
    ${secao(num, 'Distribuição por trimestre', 'Parte dos check-ins do ano feita em cada trimestre')}
    <div class="trim">${anual.trimPct.map((p, i) => `
      <div class="col"><div class="pct" style="color:${TINTAS_TRIM[i]}">${p}%</div>
      <div class="bar" style="height:${Math.round((p / maxPct) * 140)}px;background:linear-gradient(180deg, ${CORES_TRIM[i]} 0%, ${CORES_TRIM[i]}B3 100%)"></div></div>`).join('')}
    </div>
    <div class="trim-rot">${trimRot.map(t => `<div>${t}</div>`).join('')}</div>
  </div>`;
  const corpo = `${topoHTML('Relatório anual', String(year))}
    ${anual.total ? cartaoEmocoes(n(), 'Emoções do ano', anual, 'O check-in é um por dia: cada dia com check-in conta uma vez. A constância é a parte dos dias do ano em que você fez check-in.') :`<div class="card">${secao(n(), 'Emoções do ano')}<div class="nota">Ainda não há check-ins registrados neste ano.</div></div>`}
    ${cartaoAreas(n(), anual.areaData, esc(resumoAreasTexto(anual.areaData, anual.total)))}
    ${trimestres(n())}
    ${cartaoVitorias(n(), vitorias, 'este ano')}
    ${cartaoMensagem(n(), MSG_ANUAL)}
    ${cartaoInsights(n(), gerarInsightsAnuais(anual))}
    ${rodapeHTML(agora, 'Você vale!')}`;
  return documento({ titulo: `Atravessia — Relatório anual — ${year}`, capa, corpo });
}

// ── Relatório por período ────────────────────────────────────────────────────
export function gerarRelatorioPersonalizadoHTML({ rangeData, rangeInicio, rangeFim, usuario, vitorias = [] }) {
  if (!rangeData) return '';
  const agora = agoraBrasilia();
  const [diI, meI, anoI] = (rangeInicio || '').split('/').map(Number);
  const [diF, meF, anoF] = (rangeFim || '').split('/').map(Number);
  const dStart = new Date(anoI, meI - 1, diI);
  const dEnd = new Date(anoF, meF - 1, diF);
  const diasPeriodo = (!isNaN(dStart) && !isNaN(dEnd)) ? Math.round((dEnd - dStart) / 86400000) + 1 : 0;
  const periodo = `${rangeInicio} a ${rangeFim}`;
  const nome = nomePessoa(usuario);
  const e = emoPorId(rangeData.dominante);
  const n = contador();

  const capa = capaHTML({
    kicker: 'RELATÓRIO POR PERÍODO',
    titulo: 'Seu período<br>em emoções',
    periodo,
    nome,
    destaque: destaqueCapaHTML({
      donut: rangeData.donut, total: rangeData.total, dominante: rangeData.dominante,
      texto: e ? 'foi a emoção mais presente no período.' : '',
    }),
    numeros: [
      { valor: rangeData.uniqueDays, rotulo: rangeData.uniqueDays === 1 ? 'dia com check-in' : 'dias com check-in', icone: 'coracao', cor: C.lilasTexto, fundo: C.lav1, tinta: C.lilas },
      ...(diasPeriodo > 0 ? [{ valor: diasPeriodo, rotulo: diasPeriodo === 1 ? 'dia no período' : 'dias no período', icone: 'estrela', cor: C.douradoTexto, fundo: C.douradoFundo, tinta: C.dourado }] : []),
    ],
    frase: 'Perceber é o início.',
    agora,
  });

  const corpo = `${topoHTML('Relatório por período', periodo)}
    ${cartaoEmocoes(n(), 'Emoções no período', rangeData)}
    ${cartaoAreas(n(), rangeData.areaData, esc(resumoAreasTexto(rangeData.areaData, rangeData.total)))}
    ${cartaoPredominante(n(), rangeData.dominante, 'foi a emoção mais presente no período.')}
    ${cartaoVitorias(n(), vitorias, 'no período')}
    ${cartaoMensagem(n(), MSG_PERIODO)}
    ${cartaoInsights(n(), gerarInsightsPeriodo(rangeData, diasPeriodo))}
    ${rodapeHTML(agora, 'Perceber é o início.')}`;
  return documento({ titulo: `Atravessia — Relatório por período — ${periodo}`, capa, corpo });
}
