// Estados e cidades das parcerias (filtro "Onde" no Experimente a vida).
// Mesma lista em admin-web/src/parceriaUtils.js — altere as duas juntas.
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

export const nomeDoEstado = (uf) => UFS.find(e => e.uf === uf)?.nome || uf || '';

// Comparação de cidades sem diferenciar acento, maiúsculas e espaços extras
// ("Vitória", "vitoria " e "VITÓRIA" são a mesma cidade).
export const chaveCidade = (c) => String(c || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().replace(/\s+/g, ' ').toLowerCase();

// "são josé dos campos" → "São José dos Campos"
const MINUSCULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
export function formatarCidade(c) {
  return String(c || '').trim().replace(/\s+/g, ' ').toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

// Texto curto de onde a parceria atende, para o cartão.
export function rotuloLocal(p) {
  const partes = [];
  if (p?.cidade || p?.estado) partes.push([p.cidade, p.estado].filter(Boolean).join(' / '));
  if (p?.atendimentoOnline) partes.push('On-line');
  return partes.join(' · ');
}
