// Conteúdo padrão de "Quem faz a Atravessia" e perguntas sugeridas do FAQ.
// Cópia de oamorqueefica/src/screens/institucional/equipeFaqPadrao.js —
// mantenha os dois iguais. As fotos padrão ficam em public/equipe/ (as mesmas
// de oamorqueefica/assets/images/equipe/), usadas na prévia e no botão
// "Usar fotos atuais".
export const FOTOS_LOCAIS = {
  'quem-faz-1': '/equipe/quem-faz-1.jpg',
  'quem-faz-2': '/equipe/quem-faz-2.jpg',
};

export const EQUIPE_PADRAO = {
  titulo: 'Quem faz a Atravessia',
  ativo: true,
  fotos: [
    { url: '', local: 'quem-faz-1', legenda: 'Carla, Albert e Larissa', proporcao: 4 / 3 },
    { url: '', local: 'quem-faz-2', legenda: 'Albert, Larissa e Carla', proporcao: 3 / 4 },
  ],
  integrantes: [
    { id: 'carla', nome: 'Carla', papel: 'Fundadora e psicóloga', texto: 'Criou a Atravessia para que ninguém precise atravessar o luto sem companhia.', fotoUrl: '', icone: 'heart-outline', ordem: 0 },
    { id: 'albert', nome: 'Albert', papel: 'Desenvolvimento e tecnologia', texto: 'Cuida para que o app seja leve, seguro e esteja sempre por perto quando você precisar.', fotoUrl: '', icone: 'code-slash-outline', ordem: 1 },
    { id: 'larissa', nome: 'Larissa', papel: 'Sócia e administração', texto: 'Organiza os bastidores com carinho para a Atravessia seguir de pé e crescendo.', fotoUrl: '', icone: 'briefcase-outline', ordem: 2 },
  ],
};

// Junta o documento publicado com o padrão: sem documento (ou sem nenhum
// conteúdo), vale o padrão.
export function normalizarEquipe(d) {
  if (!d) return EQUIPE_PADRAO;
  const fotos = (Array.isArray(d.fotos) ? d.fotos : [])
    .filter(f => f && (f.url || FOTOS_LOCAIS[f.local]));
  const integrantes = (Array.isArray(d.integrantes) ? d.integrantes : [])
    .filter(p => p && (p.nome || p.texto))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  return {
    titulo: (d.titulo || '').trim() || EQUIPE_PADRAO.titulo,
    ativo: d.ativo !== false,
    fotos,
    integrantes,
  };
}

export const FAQ_SUGERIDAS = [
  {
    pergunta: 'O que é a Atravessia?',
    categoria: 'Sobre o app',
    resposta: 'A Atravessia é um espaço de acolhimento para quem está atravessando o luto. Aqui você registra como se sente a cada dia, recebe áudios e conteúdos de cuidado, celebra pequenas vitórias e acompanha o próprio caminho, no seu tempo.\n\nO app não substitui acompanhamento médico ou psicológico profissional, mas caminha junto com você. Se estiver em sofrimento intenso, procure o CVV (188, gratuito, 24 horas), o SAMU (192) ou o serviço de saúde mais próximo.',
  },
  {
    pergunta: 'Como funciona o check-in emocional?',
    categoria: 'Check-in',
    resposta: 'Uma vez por dia, você conta como está se sentindo escolhendo uma emoção e, se quiser, onde esse sentimento esteve mais presente (saúde, você consigo, trabalho e estudos, relacionamentos).\n\nDepois de registrar, o app sugere um conteúdo de cuidado que combina com o seu momento. Seus check-ins ficam no histórico e ajudam a montar os seus relatórios.',
  },
  {
    pergunta: 'Meus dados são sigilosos?',
    categoria: 'Privacidade',
    resposta: 'Sim. Seus registros emocionais são pessoais e tratados com cuidado e sigilo, conforme a Lei Geral de Proteção de Dados (LGPD). Usamos seus dados apenas para oferecer o serviço (relatórios, respostas da AtravessIA, lembretes e compras) e não vendemos seus dados.\n\nVocê pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento. Os termos completos estão em https://o-amor-que-fica.web.app/termos.html',
  },
  {
    pergunta: 'Como cancelo a minha assinatura?',
    categoria: 'Planos',
    resposta: 'Você pode cancelar quando quiser, direto no app: abra Planos e toque em "Cancelar assinatura e voltar ao gratuito".\n\nO cancelamento interrompe as próximas cobranças. Se você desistir da primeira contratação em até 7 dias do pagamento, pode pedir o valor de volta pelos canais de contato.',
  },
  {
    pergunta: 'Como funciona o cashback?',
    categoria: 'Benefícios',
    resposta: 'Você ganha cashback ao usar um cupom de parceria (gerado em Experimente a vida) e confirmar o atendimento, ou ao comprar pelos Achados da Atravessia e enviar o pedido para análise.\n\nO saldo vira desconto no seu plano ou no relatório personalizado. Cada crédito tem validade (informada em Meu cashback) e o cashback não pode ser trocado por dinheiro.',
  },
  {
    pergunta: 'Como falo com a equipe da Atravessia?',
    categoria: 'Contato',
    resposta: 'Dúvidas, pedidos de cancelamento, reembolso ou sobre seus dados podem ser enviados pelos canais de contato do app e da página da Atravessia na Google Play. Também é possível escrever para carla.zambi.psi@gmail.com.\n\nRespondemos com carinho assim que possível.',
  },
];
