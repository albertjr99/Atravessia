// Recursos que podem ser ligados ou desligados sem apagar código.
//
// AtravessIA, por decisão da equipe, volta em partes:
// - IA_DIARIO_CARTA: diário guiado e carta do mês (funcionam no aparelho, sem custo).
// - IA_CONVERSA: conversa de acolhimento — fica para quando houver o serviço
//   de IA contratado e ligado.
// - IA_PAINEL: leitura dos dados e assistente de conteúdo no painel (desligado;
//   o mesmo interruptor existe em admin-web/src/recursos.js).
// O código de tudo continua em src/ia, src/screens/atravessia e AdminAtravessIAScreen.
export const IA_DIARIO_CARTA = true;
export const IA_CONVERSA = false;
export const IA_PAINEL = false;
