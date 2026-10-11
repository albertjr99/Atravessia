// Recursos que podem ser ligados ou desligados sem apagar código.
//
// AtravessIA (conversa, diário guiado, carta do mês e o painel de leitura dos
// dados): desligada por decisão da equipe, para ser lançada mais adiante.
// Com `false`, nenhuma entrada aparece para usuárias nem administradoras; o
// código continua em src/ia, src/screens/atravessia e AdminAtravessIAScreen.
// Para ligar de novo: troque para `true` aqui e em admin-web/src/recursos.js.
export const IA_ATIVA = false;
