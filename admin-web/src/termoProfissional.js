// Termo de Parceria, Consentimento e Tratamento de Dados do profissional
// parceiro dos Cursos Atravessia.
//
// ATENÇÃO: este arquivo NÃO é mais a fonte do termo. O texto vigente fica no
// Firestore (configuracoes/termoProfissional) e é editado e publicado pelo
// painel: Cursos → Profissionais → "Termo do profissional" (web e app). O
// portal recebe o texto pronto da função portalProfissional.
// Aqui ficam só:
//   - o texto da versão 1.0 (TERMO_SECOES/TERMO_RESUMO), usado como RASCUNHO
//     INICIAL no painel (convertido para marcadores {{razaoSocial}} etc.) e
//     como reserva no portal enquanto nenhuma versão tiver sido publicada;
//   - utilitários puros (sem JSX) do editor: campos, marcadores, versão e o
//     leitor de markdown simples (## títulos, parágrafos e listas "- ").
// Há uma cópia idêntica em oamorqueefica/src/config/termoProfissional.js —
// altere as duas juntas. Não é preciso mudar versão em nenhum arquivo.

export const TERMO_VERSAO = '1.0';
export const TERMO_DATA = '31 de outubro de 2026';

export const TERMO_RESUMO = [
  'Seu nome, mini bio e foto aparecem no app e na página do curso. Seu e-mail e os dados para repasse ficam só com a equipe.',
  'Cada venda guarda o seu repasse, calculado na hora pela regra combinada, e você acompanha tudo neste portal.',
  'Você não recebe nome, e-mail nem nenhum dado pessoal das alunas, e se compromete a não tentar identificá-las.',
  'Você garante que tem os direitos dos vídeos e do material das aulas e responde pelo conteúdo que fornece.',
  'Reembolsos (inclusive os 7 dias de arrependimento do CDC) saem do repasse; se a venda já tinha sido repassada, o valor é descontado no repasse seguinte.',
  'Você pode pedir acesso, correção ou exclusão dos seus dados quando quiser, pelo canal do encarregado de dados.',
];

// Cada seção: { titulo, paragrafos: [] }.
export const TERMO_SECOES = [
  {
    titulo: '1. Quem somos e do que trata este termo',
    paragrafos: [
      'Este termo regula a parceria entre [RAZÃO SOCIAL], inscrita no CNPJ [CNPJ], com sede em [ENDEREÇO], responsável pelo aplicativo Atravessia (“Atravessia”), e você, profissional que conduz um ou mais cursos em vídeo vendidos no Atravessia (“Profissional”).',
      'Ele também explica, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, “LGPD”), quais dados seus tratamos, para quê, com quem compartilhamos e quais são os seus direitos.',
      'Ao marcar “Li e aceito” no portal, você concorda com estas condições. Guardamos a data, a versão aceita e um registro resumido do acesso (parte do endereço IP e o tipo de navegador), apenas como comprovação do aceite.',
    ],
  },
  {
    titulo: '2. Dados que tratamos sobre você',
    paragrafos: [
      'Dados de identificação e perfil público: nome ou nome profissional, mini bio e foto.',
      'Dados de contato: e-mail.',
      'Dados para pagamento do repasse, quando você os informar: dados bancários ou chave PIX, nome do titular e CPF ou CNPJ.',
      'Dados da parceria: regra de repasse combinada, vendas dos seus cursos (sem dados das alunas), repasses e comprovantes de transferência.',
      'Registro do aceite deste termo: data, versão, parte do endereço IP e tipo de navegador e sistema.',
    ],
  },
  {
    titulo: '3. Para que usamos e com qual base legal',
    paragrafos: [
      'Exibir seu nome, mini bio e foto no aplicativo, na área web dos cursos e na página de pagamento: execução do contrato de parceria (art. 7º, V, da LGPD) e o seu consentimento para o uso do seu nome e da sua imagem (art. 7º, I), que você pode revogar a qualquer momento.',
      'Calcular, registrar e pagar o repasse e prestar contas pelo portal: execução do contrato (art. 7º, V).',
      'Guardar registros financeiros e fiscais pelo prazo exigido em lei: cumprimento de obrigação legal (art. 7º, II).',
      'Comprovar o aceite deste termo e nos defender em eventual disputa: exercício regular de direitos (art. 7º, VI).',
      'Não usamos seus dados para publicidade de terceiros e não os vendemos.',
    ],
  },
  {
    titulo: '4. Com quem os dados são compartilhados',
    paragrafos: [
      'Stripe (processamento dos pagamentos das alunas e dos dados das vendas); Google/Firebase (hospedagem do aplicativo, do banco de dados, dos arquivos e das funções do sistema); YouTube/Google (hospedagem e exibição dos vídeos das aulas); e a instituição financeira usada para fazer o repasse.',
      'Alguns desses fornecedores podem armazenar dados fora do Brasil, com as garantias previstas na LGPD (art. 33). Também podemos compartilhar dados quando a lei ou uma autoridade exigir.',
    ],
  },
  {
    titulo: '5. Por quanto tempo guardamos',
    paragrafos: [
      'Perfil público (nome, bio e foto): enquanto o curso estiver disponível e por mais [PRAZO, ex.: 90 dias] depois do fim da parceria, ou até você revogar o consentimento — nesse caso, removemos seu nome e foto das páginas públicas, mas quem já comprou continua com acesso às aulas pelo prazo combinado.',
      'Registros de vendas, repasses e comprovantes: pelo prazo exigido pela legislação fiscal e contábil (em geral, 5 anos) [CONFIRMAR COM A CONTABILIDADE].',
      'Registro do aceite deste termo: enquanto durar a parceria e pelo prazo de prescrição das obrigações dela.',
    ],
  },
  {
    titulo: '6. Seus direitos como titular (art. 18 da LGPD)',
    paragrafos: [
      'Você pode, a qualquer momento: confirmar se tratamos seus dados e acessá-los; corrigir dados incompletos ou desatualizados; pedir anonimização, bloqueio ou eliminação de dados desnecessários; pedir a portabilidade; saber com quem compartilhamos; revogar o consentimento (o que não afeta o que foi feito antes); e pedir revisão de decisões automatizadas.',
      'Canal do encarregado de dados (DPO): [NOME DO ENCARREGADO], pelo e-mail [E-MAIL DO ENCARREGADO]. Respondemos em até 15 dias. Você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).',
    ],
  },
  {
    titulo: '7. Conteúdo, direitos autorais e imagem',
    paragrafos: [
      'Você declara ser autor(a) dos vídeos e materiais das aulas, ou ter autorização de quem detém os direitos (inclusive de músicas, imagens e pessoas que aparecem), e se responsabiliza por eventuais reclamações de terceiros sobre esse conteúdo.',
      'Você concede ao Atravessia uma licença não exclusiva para exibir as aulas às alunas que compraram o curso, pelo período da parceria e, para quem já comprou, pelo prazo de acesso informado na compra ([ex.: acesso sem prazo enquanto o aplicativo existir]).',
      'Os vídeos ficam no YouTube como “não listados”, com incorporação permitida. Vídeo não listado não é vídeo protegido: o Atravessia limita o acesso ao link no aplicativo, mas não consegue impedir que alguém que comprou copie e compartilhe o link.',
      'O conteúdo deve ser acolhedor e respeitoso, não pode prometer cura nem substituir acompanhamento de saúde, e deve respeitar as normas do seu conselho profissional, se houver. O Atravessia pode ocultar um curso que descumpra estas regras, avisando você.',
    ],
  },
  {
    titulo: '8. Confidencialidade e privacidade das alunas',
    paragrafos: [
      'Você não recebe nome, e-mail, telefone, histórico nem qualquer dado pessoal das alunas. O portal mostra apenas números agregados e um código de verificação de cada pagamento.',
      'Você se compromete a não tentar identificar as alunas, a não pedir esses dados à equipe e a manter em sigilo as informações financeiras e operacionais do Atravessia a que tiver acesso.',
      'O link do portal é pessoal: não o compartilhe. Se suspeitar que outra pessoa teve acesso, avise a equipe para gerar um novo link.',
    ],
  },
  {
    titulo: '9. Repasse, reembolsos e prestação de contas',
    paragrafos: [
      'O repasse segue a regra combinada (percentual sobre o valor pago, percentual sobre o valor após a taxa da Stripe, ou valor fixo por venda). Ele é calculado no momento de cada venda, com a regra vigente naquele instante, e não muda depois. Mudanças de regra valem só para vendas futuras.',
      'Os repasses são feitos por transferência, [PERIODICIDADE, ex.: mensalmente, até o dia 10 do mês seguinte], e ficam registrados no portal com o período, o valor e, quando houver, o comprovante.',
      'Se uma venda for reembolsada — inclusive pelo direito de arrependimento de 7 dias do Código de Defesa do Consumidor ou por contestação no cartão —, ela sai do repasse. Se já tinha sido repassada, o valor é descontado no repasse seguinte.',
      'Cada venda tem um código de verificação que corresponde ao pagamento registrado na Stripe. Se tiver dúvida sobre algum valor, informe o código à equipe, que confere com você.',
      'Você é responsável pelos tributos sobre os valores que recebe, e deve emitir nota fiscal ou recibo quando a lei exigir.',
    ],
  },
  {
    titulo: '10. Vigência e encerramento',
    paragrafos: [
      'A parceria vale por prazo indeterminado e pode ser encerrada por qualquer das partes, com aviso de [PRAZO, ex.: 30 dias]. Os repasses de vendas já feitas continuam devidos, descontados os reembolsos.',
      'Quem já comprou um curso mantém o acesso pelo prazo informado na compra, mesmo após o fim da parceria, salvo acordo diferente por escrito.',
    ],
  },
  {
    titulo: '11. Alterações deste termo',
    paragrafos: [
      'Este termo pode ser atualizado. Quando isso acontecer, o portal mostra a nova versão e pede um novo aceite antes de exibir o extrato.',
    ],
  },
  {
    titulo: '12. Foro',
    paragrafos: [
      'Este termo segue as leis brasileiras. Fica eleito o foro da comarca de [CIDADE/UF], salvo regra legal diferente.',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Editor do termo (painel) e leitura no portal — funções puras, sem JSX.
// O texto publicado é markdown simples: "## Título", parágrafos separados por
// linha em branco, itens de lista começando com "- " e **negrito**.
// Os dados da empresa entram por marcadores {{campo}}, preenchidos pelo
// formulário do painel (e aplicados no servidor antes de chegar ao portal).
// ═══════════════════════════════════════════════════════════════════════════

// Campos da empresa (os antigos [colchetes] do termo).
export const CAMPOS_TERMO = [
  { k: 'razaoSocial', rotulo: 'Razão social', exemplo: 'Nome da empresa Ltda.' },
  { k: 'cnpj', rotulo: 'CNPJ', exemplo: '00.000.000/0001-00' },
  { k: 'endereco', rotulo: 'Endereço da sede', exemplo: 'Rua, número, bairro, cidade/UF, CEP' },
  { k: 'cidadeUf', rotulo: 'Cidade/UF do foro', exemplo: 'São Paulo/SP' },
  { k: 'encarregadoNome', rotulo: 'Encarregado de dados (DPO): nome', exemplo: 'Nome completo' },
  { k: 'encarregadoEmail', rotulo: 'Encarregado de dados (DPO): e-mail', exemplo: 'privacidade@exemplo.com' },
  { k: 'periodicidadeRepasse', rotulo: 'Periodicidade do repasse', exemplo: 'mensalmente, até o dia 10 do mês seguinte' },
  { k: 'prazoGuarda1', rotulo: 'Guarda do perfil público após o fim da parceria', exemplo: '90 dias' },
  { k: 'prazoGuarda2', rotulo: 'Guarda dos registros de vendas e repasses (confirme com a contabilidade)', exemplo: 'em geral, 5 anos' },
  { k: 'prazoAcessoAlunas', rotulo: 'Prazo de acesso de quem já comprou', exemplo: 'acesso sem prazo enquanto o aplicativo existir' },
  { k: 'prazoAvisoEncerramento', rotulo: 'Aviso prévio para encerrar a parceria', exemplo: '30 dias' },
];

// [colchetes] da versão 1.0 → marcadores {{campo}}.
const MARCADORES_INICIAIS = [
  ['[RAZÃO SOCIAL]', '{{razaoSocial}}'],
  ['[CNPJ]', '{{cnpj}}'],
  ['[ENDEREÇO]', '{{endereco}}'],
  ['[PRAZO, ex.: 90 dias]', '{{prazoGuarda1}}'],
  ['(em geral, 5 anos) [CONFIRMAR COM A CONTABILIDADE]', '({{prazoGuarda2}})'],
  ['[NOME DO ENCARREGADO]', '{{encarregadoNome}}'],
  ['[E-MAIL DO ENCARREGADO]', '{{encarregadoEmail}}'],
  ['([ex.: acesso sem prazo enquanto o aplicativo existir])', '({{prazoAcessoAlunas}})'],
  ['[PERIODICIDADE, ex.: mensalmente, até o dia 10 do mês seguinte]', '{{periodicidadeRepasse}}'],
  ['[PRAZO, ex.: 30 dias]', '{{prazoAvisoEncerramento}}'],
  ['[CIDADE/UF]', '{{cidadeUf}}'],
];
const paraMarcadores = (t) => MARCADORES_INICIAIS.reduce((s, [de, para]) => s.split(de).join(para), t);
const secoesParaMarkdown = (secoes) => secoes.map(s => `## ${s.titulo}\n\n${s.paragrafos.join('\n\n')}`).join('\n\n');

// Texto da versão 1.0 como estava no código (com [colchetes]): reserva do
// portal enquanto nenhuma versão tiver sido publicada pelo painel.
export const TERMO_LEGADO_MARKDOWN = secoesParaMarkdown(TERMO_SECOES);

// Rascunho inicial do editor quando configuracoes/termoProfissional não existe.
export function rascunhoInicialTermo() {
  return {
    texto: paraMarcadores(TERMO_LEGADO_MARKDOWN),
    resumo: TERMO_RESUMO.map(paraMarcadores),
    campos: Object.fromEntries(CAMPOS_TERMO.map(c => [c.k, ''])),
  };
}

const RE_CAMPO = /\{\{\s*([A-Za-z][A-Za-z0-9_]{0,39})\s*\}\}/g;
const rotuloCampo = (k) => CAMPOS_TERMO.find(c => c.k === k)?.rotulo || k;

// Troca {{campo}} pelo valor; campo vazio aparece como [Rótulo] na prévia.
export function aplicarCamposTermo(texto, campos) {
  return String(texto || '').replace(RE_CAMPO, (_, k) => String(campos?.[k] ?? '').trim() || `[${rotuloCampo(k)}]`);
}

// Marcadores usados no texto/resumo que ainda estão sem valor.
export function camposFaltandoTermo(texto, resumo, campos) {
  const usados = new Set();
  [texto, ...(resumo || [])].forEach(t => { for (const m of String(t || '').matchAll(RE_CAMPO)) usados.add(m[1]); });
  return [...usados].filter(k => !String(campos?.[k] ?? '').trim()).map(k => ({ k, rotulo: rotuloCampo(k) }));
}

// 1.0 → 1.1 → … → 1.10 (mesma regra de publicarTermoProfissional no servidor).
export function proximaVersaoTermo(atual) {
  const m = /^(\d+)\.(\d+)$/.exec(String(atual || ''));
  return m ? `${m[1]}.${Number(m[2]) + 1}` : '1.1';
}

export const linhasParaResumo = (t) => String(t || '').split('\n').map(l => l.replace(/^[-*•]\s+/, '').trim()).filter(Boolean);

// Markdown simples → blocos { tipo: 'titulo' | 'paragrafo', texto } ou
// { tipo: 'lista', itens }. Nada de HTML: quem desenha usa só texto.
export function blocosTermo(texto) {
  const blocos = [];
  let par = [];
  let lista = null;
  const fecharPar = () => { if (par.length) { blocos.push({ tipo: 'paragrafo', texto: par.join(' ') }); par = []; } };
  const fecharLista = () => { if (lista) { blocos.push({ tipo: 'lista', itens: lista }); lista = null; } };
  for (const bruta of String(texto || '').replace(/\r\n?/g, '\n').split('\n')) {
    const l = bruta.trim();
    if (!l) { fecharPar(); fecharLista(); continue; }
    const titulo = /^#{1,6}\s+(.*)$/.exec(l);
    if (titulo) { fecharPar(); fecharLista(); blocos.push({ tipo: 'titulo', texto: titulo[1].trim() }); continue; }
    const item = /^[-*•]\s+(.*)$/.exec(l);
    if (item) { fecharPar(); (lista || (lista = [])).push(item[1]); continue; }
    if (lista && /^\s/.test(bruta)) { lista[lista.length - 1] += ` ${l}`; continue; }
    fecharLista();
    par.push(l);
  }
  fecharPar(); fecharLista();
  return blocos;
}

// "**negrito**" → [{ texto, negrito }].
export const trechosTermo = (texto) => String(texto || '').split(/\*\*(.+?)\*\*/g)
  .map((t, i) => ({ texto: t, negrito: i % 2 === 1 })).filter(p => p.texto);
