# Atendimentos online no Atravessia — plano de implementação

**Para:** Carla (fundadora, administradora e psicóloga) e Larissa
**Objetivo:** a Carla atende pelo Atravessia, individualmente ou em grupo, com vídeo e áudio no celular (app) e na web. Ela gera um **link pessoal** para cada cliente. Quem aceita o convite **vira usuária do Atravessia** com poucos toques e ganha um benefício no app.

> **Situação (01/11/2026):** o MVP está implementado e funciona em **modo de teste** (Jitsi público). Para atender de verdade, falta a conta do Daily e os itens da seção 8.

---

## 1. Resumo da recomendação

| | |
|---|---|
| **Provedor de vídeo** | **Daily.co** (salas criadas por API, privadas, com horário para abrir e expirar, token por pessoa, sala de espera, sem gravação, funciona no navegador e dentro do app). |
| **Plano B** | Whereby Embedded (sala de espera nativa e visual pronto) ou JaaS/8x8 (Jitsi com JWT). O código já tem um **adaptador de provedor**: trocar é escrever um bloco novo, sem mexer nas telas. |
| **Benefício** | **Cortesia de acompanhamento:** acesso ao app por **60 dias após cada sessão**, renovado automaticamente a cada nova sessão. Quem já assina não é alterada. Configurável no painel. |
| **Conversão** | O próprio link de convite cria a conta (nome, e-mail já preenchido, senha) e registra o aceite do termo. Depois da sessão, a página leva ao app (Google Play ou versão web). |
| **Custo estimado** | Para o volume inicial (ex.: 40 sessões individuais + 4 grupos por mês), fica dentro da cota gratuita do Daily (10 mil minutos-participante por mês). Ver seção 3. |

---

## 2. Opções de tecnologia de vídeo

Critérios: salas criadas por API, links que expiram, token por participante, sala de espera, **sem gravação**, criptografia em trânsito, funciona no navegador sem instalar nada e **dentro de WebView** no app, custo, esforço de implementação.

| Provedor | Prós | Contras | Custo aproximado* |
|---|---|---|---|
| **Daily.co** ✅ | API simples (sala + token em 2 chamadas); interface pronta ("Prebuilt") em iframe/WebView; salas privadas com `nbf`/`exp`; *knocking* (sala de espera); gravação desligada por padrão; escolha de câmera/microfone/fone na tela de entrada; DPA disponível; servidores em São Paulo (propriedade `geo`). | Empresa nos EUA (transferência internacional — exige cláusulas no contrato); interface em português, mas com a marca Daily discreta. | Grátis até 10 mil min-participante/mês; depois ~US$ 0,004/min-participante. |
| **Whereby Embedded** | Visual mais "acolhedor" e personalizável; sala de espera (*knock*) nativa e muito clara; salas por API com data de fim; funciona bem em WebView. | Sem token por participante no mesmo nível do Daily (usa `roomKey` para anfitriã e link de visitante); planos pagos desde o início. | Plano a partir de ~US$ 7–10/mês + uso por minuto. |
| **Jitsi público (meet.jit.si)** | Grátis, sem conta; serve para **testar** agora. | Sem contrato nem DPA; qualquer pessoa com o nome da sala entra; desde 2023 exige login de moderadora (Google/GitHub) e corta chamadas **embutidas em iframe após 5 min** — por isso, na web, o modo de teste abre a sala em nova aba. **Não usar com clientes reais.** | Grátis. |
| **JaaS (Jitsi as a Service, 8x8)** | Jitsi com JWT por participante, sala de espera, opção de E2EE; interface conhecida. | Cobrança por usuária ativa/mês; configuração do JWT (chave RSA) mais trabalhosa. | Grátis até 25 usuárias ativas/mês; depois ~US$ 0,99 por usuária ativa (faixas). |
| **100ms** | Salas e tokens por API, "Prebuilt" com link, papéis (anfitriã/participante). | Painel e documentação mais voltados a desenvolvedores; menos maduro para WebView. | ~10 mil min grátis/mês; depois ~US$ 0,004/min. |
| **Agora** | Muito robusto, ótimo em redes ruins. | Não tem interface pronta: precisaria construir toda a tela de chamada (web e app nativo) — semanas de trabalho. | ~10 mil min grátis/mês; depois ~US$ 0,99–3,99 por mil min. |
| **LiveKit (Cloud ou próprio servidor)** | Código aberto, tokens por participante nativos, pode rodar em servidor próprio no Brasil (máximo controle de dados). | Interface precisa ser montada (há exemplo "Meet"); servidor próprio exige manutenção. | Cloud com cota gratuita e depois cobrança por minuto; servidor próprio ~US$ 20–60/mês + manutenção. |

\* Valores de referência de 2025–2026, em dólar, sem impostos; conferir no site de cada provedor antes de contratar.

**Por que Daily:** é o que atende todos os critérios com o menor esforço e já está implementado no MVP. Se no futuro o controle total dos dados no Brasil for prioridade, LiveKit em servidor próprio é o caminho (mais trabalho, mesmo adaptador).

---

## 3. Estimativa de uso (Daily)

| Cenário mensal | Cálculo | Minutos-participante |
|---|---|---|
| 40 sessões individuais de 50 min | 40 × 50 × 2 pessoas | 4.000 |
| 4 grupos de 90 min com 8 pessoas + Carla | 4 × 90 × 9 | 3.240 |
| **Total** | | **7.240** → dentro da cota gratuita |

Com o dobro desse volume, o excedente custaria cerca de US$ 18/mês.

---

## 4. Requisitos éticos e legais (CFP e LGPD)

> Este capítulo é orientação técnica, não parecer jurídico. A Carla deve confirmar o texto vigente das resoluções no site do CFP (o atendimento mediado por tecnologia foi regulado pela **Resolução CFP nº 11/2018**, com mudanças posteriores — inclusive a Resolução CFP nº 4/2020 e a norma de 2024 sobre serviços mediados por TDICs).

### 4.1 Psicologia (CFP)
- **Cadastro no e-Psi** (https://e-psi.cfp.org.br) ativo antes de atender online. O número do **CRP** aparece no convite (Painel › Atendimentos › Configurações).
- **Sigilo** (Código de Ética, Resolução CFP nº 10/2005): salas privadas por atendimento, links pessoais e de uso único, nada de conteúdo da sessão nos servidores do Atravessia.
- **Gravação proibida** sem consentimento expresso, prévio e por escrito de todas as pessoas: as salas são criadas **sem gravação** (Daily: `enable_recording` ausente; Jitsi: gravação e transmissão desligadas no link). O termo deixa isso explícito para as clientes.
- **TCLE / contrato:** modelo em `docs/atendimentos/tcle-modelo.md`. O aceite é obrigatório no link e fica registrado (data, hora, versão, IP resumido e tipo de aparelho) em `consentimentosAtendimento`.
- **Registro documental (prontuário)** — Resolução CFP nº 1/2009 (e alterações): guarda por no mínimo 5 anos, acesso restrito à psicóloga.
- **Crianças e adolescentes:** consentimento de responsável legal (prever no contrato da Carla).
- **Urgência e emergência:** o termo informa que o atendimento online não é serviço de emergência e indica CVV 188 e SAMU 192.
- **Grupo:** o termo inclui o compromisso de sigilo entre participantes; no sistema, uma participante **não vê** nome nem e-mail das outras fora da sala.

### 4.2 Onde fica o prontuário e quem acessa
- **Anotações privadas** por atendimento em `atendimentosPrivado/{id}` (Firestore): a regra permite leitura **somente à psicóloga do atendimento** — nem a outra administradora, nem as clientes.
- Atenção: pessoas com acesso ao **console do Firebase/Google Cloud** (donas do projeto) conseguem ver qualquer dado. Recomendações:
  1. MVP: usar as anotações como **prontuário mínimo** (evolução, combinados) e manter o prontuário completo no sistema que a Carla já usa, se houver;
  2. restringir quem tem papel de Proprietário/Editor no projeto Firebase;
  3. Fase 3: **criptografia no navegador** das anotações com uma senha só da Carla (ninguém mais consegue ler, nem pelo console).

### 4.3 LGPD
- Dados de saúde são **dados sensíveis**. Base legal: tutela da saúde por profissional da área (art. 11, II, "f") + consentimento informado no TCLE.
- **Minimização:** a agenda (`atendimentos`) não tem e-mails nem links; os dados das pessoas ficam em `atendimentosPrivado`; a sala do provedor fica em `atendimentosSala` (só servidor).
- **Transferência internacional:** Daily (EUA) e Firebase (Google). Assinar o DPA do Daily e registrar na política de privacidade; usar cláusulas-padrão (Resolução ANPD nº 19/2024).
- Atualizar a **política de privacidade** e indicar o **encarregado(a)** de dados.
- Direitos de acesso, correção e exclusão respeitando a guarda obrigatória do prontuário.

---

## 5. Plano de conversão (cliente → usuária do Atravessia)

1. **Convite:** a Carla cria o atendimento e envia o link pessoal pelo WhatsApp (botão pronto, com texto acolhedor) ou copia o link.
2. **Página do convite** (`/atendimento.html?c=…`): mostra com quem, data, hora e duração. A pessoa:
   - **cria o acesso** (nome, e-mail já preenchido, senha) **ou entra** se já tem conta;
   - lê o **resumo do termo** (com o texto completo a um toque) e aceita;
   - o convite é **vinculado à conta** (uso único: depois disso, só abre nessa conta).
3. **Benefício imediato:** *Cortesia de acompanhamento* — acesso ao app até **60 dias depois da sessão**, renovado a cada sessão (`cortesia.origem = 'atendimento'`). Se ela já assina, nada muda. Usa o mesmo mecanismo de cortesia que o painel já tem (o app libera o acesso enquanto a cortesia estiver no prazo).
   - Observação: a cortesia do projeto libera **todo** o app (não só o Acolher). Se as donas preferirem limitar ao Acolher, a Fase 2 inclui `cortesia.plano` e um ajuste em `temAcesso` no app.
4. **Teste de câmera e microfone** na própria página (escolha de câmera, microfone e saída de som, com indicador de nível).
5. **Entrar na sala:** o botão libera **10 minutos antes**. Na web, a sala abre dentro da página (Daily) ou em nova aba (modo de teste).
6. **Depois da sessão:** tela "Continue cuidando de você no app Atravessia" com Google Play e versão web (`/app/`), lembrando que é o mesmo e-mail e senha.
7. **No app:** a conta já tem o perfil completo (com a apresentação inicial) e o atendimento aparece em **Perfil › Meus atendimentos**, com o botão *Entrar na sala*. Lembretes por push **1 hora** e **10 minutos** antes.

Fase 2: **link mágico** (entrar só pelo e-mail, sem senha — Firebase "Email link sign-in", precisa ser ligado no console) e convite por e-mail automático.

---

## 6. O que foi implementado (MVP)

### Dados
| Coleção | Conteúdo | Quem lê | Quem grava |
|---|---|---|---|
| `configuracoes/atendimentos` | `provedor` (`daily`/`jitsi`), `ativo`, `beneficioDias`, `salaDeEspera`, `crp`, `nomeProfissional` | usuárias logadas | administradoras |
| `atendimentos/{id}` | `tipo`, `titulo`, `profissionalUid`, `profissionalNome`, `crp`, `inicio`, `fim`, `duracaoMin`, `status` (`agendado`/`cancelado`/`concluido`), `participantesUids`, `totalParticipantes`, `valorCentavos`, `pago`, `provedor`, marcas de lembrete | a profissional e as participantes | só servidor |
| `atendimentosPrivado/{id}` | `participantes [{id, nome, email, convite, status, uid, aceitoEm, ultimaEntradaEm}]`, `anotacoes` | **só a profissional** | servidor; ela só altera `anotacoes` |
| `atendimentosSala/{id}` | `provedor`, `roomName`, `salaUrl` | ninguém (servidor) | servidor |
| `convitesAtendimento/{token}` | convite por pessoa, uso único, expira 1 dia após o fim | ninguém (servidor) | servidor |
| `consentimentosAtendimento` | registro do aceite do TCLE | administradoras | servidor |

> Diferença em relação ao pedido original: `participantes` (com e-mails e links) ficou em `atendimentosPrivado`, e não em `atendimentos`, para que, num grupo, uma participante não consiga ler os dados das outras.

### Cloud Functions (seção "ATENDIMENTOS" no fim de `functions/index.js`)
- `statusAtendimentos` (admin) — provedor em uso e se está em modo de teste.
- `criarAtendimento` / `atualizarAtendimento` (admin) — cria sala no provedor, convites por pessoa; altera horário (atualiza a sala e avisa por push), título, valor, pessoas, cancela (exclui a sala) ou conclui.
- `gerarConviteAtendimento` (admin) — novo link (o anterior deixa de valer).
- `obterConviteAtendimento` (público, por token, com limite de tentativas por IP) — dados mínimos da sessão.
- `aceitarConviteAtendimento` (autenticada) — cria o perfil (se for conta nova), vincula o convite, registra o TCLE e concede a cortesia.
- `entrarNaSala` (autenticada) — confere participação e horário (participante: 10 min antes; profissional: 30 min antes; até 30 min após o fim) e devolve o link do provedor (Daily: token por pessoa; anfitriã com token de dona). Renova a cortesia.
- `lembretesAtendimento` (a cada 5 min) — push 1 h e 10 min antes para participantes e profissional.

### Telas
- **Painel web** › Pessoas › **Atendimentos** (`admin-web/src/Atendimentos.jsx`) e **app** › painel › Atendimentos (`AdminAtendimentosScreen.js`): próximos e passados, novo atendimento (individual/grupo), links por pessoa (copiar, WhatsApp, novo link, remover), entrar na sala como anfitriã, editar, cancelar, concluir, **anotações privadas** com aviso de sigilo, configurações. Formulários em recolhíveis.
- **Página do convite** `admin-web/atendimento.html` (`AtendimentoConvite.jsx`).
- **App da usuária:** `MeusAtendimentosScreen` (atalho no Perfil) e `SalaAtendimentoScreen` (WebView com câmera e microfone; na versão web do app abre em nova aba).
- `app.json`: permissões Android `CAMERA`, `MODIFY_AUDIO_SETTINGS` (RECORD_AUDIO já existia) e textos iOS de câmera e microfone. O plugin `expo-audio` estava com `microphonePermission: false`, o que **apagaria** a permissão de microfone no iOS — agora tem o texto.

---

## 7. Fases

| Fase | Entregas | Depende de |
|---|---|---|
| **1 · MVP (pronto, modo de teste)** | Tudo da seção 6, com Jitsi público. | Deploy (functions, regras, hosting) e um novo build do app. |
| **2 · Produção** | Chave do Daily como *secret*; TCLE revisado; CRP e nome profissional preenchidos; política de privacidade; teste ponta a ponta em Android, iPhone (Safari e app) e computador. Opcional: `geo: 'sa-east-1'` nas salas do Daily. | Donas (seção 8). |
| **3 · Completo** | Pagamento da sessão pelo Stripe (reaproveitando `getOrCreateCustomer`/`comErroPagamento`, marcando `pago`); sessões recorrentes; link mágico; convite e lembrete por e-mail; arquivo `.ics` para agenda; cortesia só do Acolher (`cortesia.plano`); anotações criptografadas no navegador; presença e relatório de sessões; vários profissionais. | Decisões de produto e preços. |

---

## 8. O que depende das donas

1. **Daily.co:** criar a conta (e-mail da empresa), aceitar o DPA, gerar a **API key** e cadastrar no Firebase:
   ```
   firebase functions:secrets:set DAILY_API_KEY
   ```
   Depois, em `functions/index.js` (seção ATENDIMENTOS), trocar `chaveDaily` para `defineSecret('DAILY_API_KEY')` e acrescentar `secrets: [DAILY_API_KEY]` em `OPCOES_ATEND` (o passo a passo está no comentário do código).
2. **CFP:** confirmar o cadastro da Carla no e-Psi e preencher CRP e nome profissional em Atendimentos › Configurações.
3. **Termo:** revisar `docs/atendimentos/tcle-modelo.md` (de preferência com advogada) e, se mudar, subir a versão nos três lugares indicados no arquivo.
4. **Política de privacidade:** incluir atendimentos online, provedores (Daily, Google/Firebase) e encarregado(a) de dados.
5. **Decidir o benefício:** dias de cortesia (padrão 60) e se libera o app inteiro ou só o Acolher.
6. **Deploy:** `firebase deploy --only firestore:rules,functions,hosting` (hosting depois do build do painel) e **novo build do app** (EAS) — a sala embutida usa `react-native-webview` e as novas permissões nativas, que só chegam com versão nova na loja.
7. **Acesso ao console:** revisar quem tem papel de Proprietário/Editor no Firebase (sigilo do prontuário).

---

## 9. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Usar o modo de teste com clientes reais | Avisos fixos no painel, no convite e na sala. Configurar o Daily antes do primeiro atendimento. |
| Jitsi público: moderadora precisa entrar com Google/GitHub; embutido cai em 5 min | Na web o teste abre em nova aba; no app, preferir que a Carla entre pelo computador durante os testes. |
| Link encaminhado a outra pessoa | Convite de uso único (vinculado à primeira conta), expira 1 dia após o fim, "Novo link" invalida o anterior; com Daily, sala de espera para a Carla admitir. |
| Câmera/microfone no WebView (Android antigo, iOS < 14.3) | Permissões pedidas antes de abrir; se falhar, a pessoa pode entrar pelo navegador com o mesmo link. |
| Acesso ao prontuário pelo console do Firebase | Restringir IAM; Fase 3 com criptografia no navegador. |
| Custos acima da cota | Volume estimado bem abaixo; acompanhar o painel do Daily. |
| Mudança das normas do CFP | Revisar o termo e este plano a cada atualização do CFP. |
| Instabilidade de internet | Sala continua aberta 30 min após o fim; termo prevê remarcação. |
