// Ícones disponíveis para as opções de Pequenas Vitórias (nomes do Ionicons,
// sem o sufixo "-outline"). A mesma lista existe em
// admin-web/src/iconesVitoria.js — altere as duas juntas.
export const ICONES_VITORIA = [
  { id: 'star', nome: 'Estrela' },
  { id: 'heart', nome: 'Coração' },
  { id: 'sunny', nome: 'Sol' },
  { id: 'moon', nome: 'Lua' },
  { id: 'bed', nome: 'Descanso' },
  { id: 'walk', nome: 'Caminhada' },
  { id: 'bicycle', nome: 'Bicicleta' },
  { id: 'fitness', nome: 'Exercício' },
  { id: 'water', nome: 'Água' },
  { id: 'nutrition', nome: 'Alimentação' },
  { id: 'restaurant', nome: 'Refeição' },
  { id: 'cafe', nome: 'Café' },
  { id: 'home', nome: 'Casa' },
  { id: 'leaf', nome: 'Natureza' },
  { id: 'flower', nome: 'Flor' },
  { id: 'rose', nome: 'Rosa' },
  { id: 'people', nome: 'Pessoas' },
  { id: 'chatbubbles', nome: 'Conversa' },
  { id: 'call', nome: 'Ligação' },
  { id: 'hand-left', nome: 'Ajuda' },
  { id: 'musical-notes', nome: 'Música' },
  { id: 'book', nome: 'Leitura' },
  { id: 'brush', nome: 'Arte' },
  { id: 'school', nome: 'Estudos' },
  { id: 'briefcase', nome: 'Trabalho' },
  { id: 'paw', nome: 'Animal' },
  { id: 'medkit', nome: 'Saúde' },
  { id: 'happy', nome: 'Alegria' },
  { id: 'flame', nome: 'Força' },
  { id: 'trophy', nome: 'Conquista' },
  { id: 'gift', nome: 'Presente' },
  { id: 'balloon', nome: 'Celebração' },
];

const IDS = new Set(ICONES_VITORIA.map(i => i.id));

// Nome do Ionicons para uma opção: aceita o id ("walk") ou o nome completo
// ("walk-outline"); qualquer outro valor (ex.: emoji antigo) cai na estrela.
export function iconeDaVitoria(opcao, preenchido = false) {
  const bruto = String(opcao?.icone || '').replace(/-outline$/, '');
  const id = IDS.has(bruto) ? bruto : 'star';
  return preenchido ? id : `${id}-outline`;
}
