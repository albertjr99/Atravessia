// Termo do atendimento psicológico online (TCLE). Texto completo e versão de
// referência: docs/atendimentos/tcle-modelo.md. Ao mudar o texto, suba a
// versão AQUI, em TCLE_ATENDIMENTO_VERSAO (functions/index.js) e no modelo.
export const TCLE_VERSAO = '1.0';

// Resumo mostrado na página do convite, antes do aceite.
export const TCLE_RESUMO = [
  'O atendimento é feito por psicóloga com registro no CRP e cadastro no e-Psi (CFP), por vídeo e áudio em tempo real.',
  'A sala é privada, criada só para este atendimento, com criptografia em trânsito. Pode haver sala de espera.',
  'As sessões não são gravadas. Ninguém pode gravar áudio, vídeo ou tela sem o consentimento expresso e por escrito de todas as pessoas.',
  'No atendimento em grupo, você se compromete a manter em sigilo o que for dito e quem participa.',
  'A psicóloga guarda o registro das sessões (prontuário) com acesso restrito a ela, pelo prazo legal.',
  'Seus dados são tratados conforme a LGPD só para o atendimento, lembretes e obrigações legais.',
  'Não é um serviço de emergência: em crise, ligue 188 (CVV) ou 192 (SAMU).',
];

// Texto completo (seções), igual ao docs/atendimentos/tcle-modelo.md.
export const TCLE_TEXTO = [
  ['Quem atende', 'O atendimento é realizado por psicóloga inscrita no Conselho Regional de Psicologia, com cadastro ativo no e-Psi do Conselho Federal de Psicologia (Resolução CFP nº 11/2018 e atualizações). O Atravessia é a plataforma usada para agendar, convidar e fazer a chamada de vídeo e não tem acesso ao conteúdo das sessões.'],
  ['Como funciona', 'As sessões acontecem por vídeo e áudio, em tempo real, pelo navegador ou pelo app Atravessia, no horário combinado. A sala abre 10 minutos antes; pode haver sala de espera. No atendimento em grupo, cada participante se compromete a manter em sigilo o que for dito e a identidade das demais pessoas. Duração, frequência, valor e pagamento são combinados com a psicóloga.'],
  ['Sigilo e privacidade', 'A psicóloga segue o Código de Ética Profissional do Psicólogo. As chamadas são criptografadas em trânsito, em salas privadas que deixam de existir após o horário. As sessões não são gravadas: nenhuma gravação de áudio, vídeo ou tela é permitida, por nenhuma das partes, sem consentimento expresso, prévio e por escrito de todas as pessoas presentes. Recomendamos um lugar reservado, fones de ouvido e uma conexão de confiança.'],
  ['Registro documental', 'A psicóloga mantém o registro documental obrigatório das sessões (prontuário), com acesso restrito a ela, pelo prazo mínimo de 5 anos. Você pode pedir acesso às informações que lhe dizem respeito.'],
  ['Seus dados (LGPD)', 'São tratados nome, e-mail, dados da conta Atravessia, data e horário dos atendimentos, presença e o registro deste aceite (data, hora, versão do termo e resumo do dispositivo), para realizar o atendimento, enviar lembretes e cumprir obrigações legais. Dados de saúde são tratados para a tutela da saúde por profissional da área (LGPD, art. 11, II, f). Você pode pedir acesso, correção ou exclusão, respeitados os prazos legais do prontuário.'],
  ['Limites do atendimento online', 'Pode haver interrupções técnicas; se a chamada cair e não voltar, a sessão é remarcada conforme o combinado. Não é serviço de emergência: em crise ou risco, ligue 188 (CVV, 24 h, gratuito), 192 (SAMU) ou procure o pronto-socorro. Para crianças e adolescentes, é necessário o consentimento de um responsável legal.'],
  ['Benefício no app', 'Quem está em acompanhamento recebe acesso de cortesia ao app Atravessia enquanto o acompanhamento estiver em andamento. O uso do app é opcional e não substitui o atendimento psicológico.'],
  ['Consentimento', 'Declaro que li e compreendi este termo, pude esclarecer minhas dúvidas e concordo, de forma livre e esclarecida, com o atendimento psicológico online nas condições descritas. Sei que posso retirar este consentimento a qualquer momento.'],
];
