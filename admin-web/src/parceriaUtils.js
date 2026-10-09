// Utilitários das parcerias no painel web. Mesmas regras do app
// (oamorqueefica/src/utils/localizacao.js e imagemUrl.js).

export const UFS = [
  { uf: 'AC', nome: 'Acre' }, { uf: 'AL', nome: 'Alagoas' }, { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' }, { uf: 'BA', nome: 'Bahia' }, { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' }, { uf: 'ES', nome: 'Espírito Santo' }, { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' }, { uf: 'MT', nome: 'Mato Grosso' }, { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' }, { uf: 'PA', nome: 'Pará' }, { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' }, { uf: 'PE', nome: 'Pernambuco' }, { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' }, { uf: 'RN', nome: 'Rio Grande do Norte' }, { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' }, { uf: 'RR', nome: 'Roraima' }, { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' }, { uf: 'SE', nome: 'Sergipe' }, { uf: 'TO', nome: 'Tocantins' },
];

const MINUSCULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
export function formatarCidade(c) {
  return String(c || '').trim().replace(/\s+/g, ' ').toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

export function rotuloLocal(p) {
  const partes = [];
  if (p?.cidade || p?.estado) partes.push([p.cidade, p.estado].filter(Boolean).join(' / '));
  if (p?.atendimentoOnline) partes.push('On-line');
  return partes.join(' · ');
}

// Link de compartilhamento do Google Drive → endereço direto da imagem.
export function idDoDrive(url) {
  const s = String(url || '').trim();
  if (!/drive\.google\.com|docs\.google\.com/i.test(s)) return null;
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/) || s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  return m ? m[1] : null;
}

export function urlDeImagem(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  const id = idDoDrive(s);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : s;
}
