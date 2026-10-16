// Funções da AtravessIA que as administradoras ligam/desligam no painel e o
// plano mínimo de cada uma. Documento: configuracoes/recursosIA.
// Sem nada salvo no painel, valem os padrões abaixo (os mesmos de antes).
import { IA_CONVERSA, IA_DIARIO_CARTA, IA_PLANO_ANO } from './recursos';

export const RECURSOS_IA = [
  { chave: 'diarioGuiado', tela: 'DiarioGuiado', rotulo: 'Diário guiado', icone: 'create-outline', descricao: 'Perguntas gentis para escrever sobre o dia.' },
  { chave: 'cartaMes', tela: 'CartaMes', rotulo: 'Carta do mês', icone: 'mail-open-outline', descricao: 'Uma carta afetuosa com o caminho do mês.' },
  { chave: 'planoAno', tela: 'PlanoAno', rotulo: 'Plano do ano', icone: 'compass-outline', descricao: 'Plano de ação para o ano que começa, a partir do histórico.' },
  { chave: 'conversa', tela: 'ConversaIA', rotulo: 'Conversar', icone: 'chatbubbles-outline', descricao: 'Conversa de acolhimento com a AtravessIA.' },
];

export const PADRAO_RECURSOS_IA = {
  diarioGuiado: { ativo: IA_DIARIO_CARTA, planoMinimo: 1 },
  cartaMes: { ativo: IA_DIARIO_CARTA, planoMinimo: 1 },
  planoAno: { ativo: IA_PLANO_ANO, planoMinimo: 1 },
  conversa: { ativo: IA_CONVERSA, planoMinimo: 1 },
};

export function normalizarRecursosIA(salvo) {
  const r = {};
  Object.keys(PADRAO_RECURSOS_IA).forEach(k => {
    const s = salvo?.[k] || {};
    const p = PADRAO_RECURSOS_IA[k];
    const plano = Number.isInteger(s.planoMinimo) && s.planoMinimo >= 0 && s.planoMinimo <= 3 ? s.planoMinimo : p.planoMinimo;
    r[k] = { ativo: typeof s.ativo === 'boolean' ? s.ativo : p.ativo, planoMinimo: plano };
  });
  return r;
}

export const NOME_PLANO = ['Perceber (gratuito)', 'Acolher', 'Compreender', 'Evoluir'];
