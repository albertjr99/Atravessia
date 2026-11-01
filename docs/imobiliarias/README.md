# Lar e recomeço: imobiliárias e arquitetos parceiros

Parceria **Atravessia + imobiliária + arquiteto**. A imobiliária aparece no app. A pessoa interessada gera um código (e um QR Code) e negocia direto com a imobiliária. Quando o negócio fecha e o pagamento é confirmado, a imobiliária repassa à Atravessia o valor combinado. Com o repasse recebido, a Atravessia paga um arquiteto parceiro, que dá à usuária uma **consultoria online** (cerca de 2 h sobre organização, decoração e aproveitamento do imóvel).

**A Atravessia não antecipa custo.** O arquiteto só é agendado depois que o repasse da imobiliária entra.

## Onde fica cada coisa

| Quem | Onde |
|---|---|
| Usuária (app) | *Experimente a vida → Benefícios e Parcerias → card “Lar e recomeço”* → vitrine de imobiliárias → página da imobiliária (imóveis com filtros) → “Tenho interesse — quero indicação” → código + QR + WhatsApp → “Minhas indicações” (ícone de chave no topo da vitrine) |
| Imobiliária (web, sem login) | `https://o-amor-que-fica.web.app/imobiliaria.html?t=<token>` |
| Administradoras | Painel web e painel do app: **Parcerias → Imobiliárias** (abas Leads, Imobiliárias, Imóveis, Arquitetos e Financeiro) |

Escolhemos o nome **“Lar e recomeço”** e o lugar dentro de *Experimente a vida* (Parcerias) porque mudar de casa costuma acompanhar um recomeço. Assim o assunto aparece de forma discreta, sem tirar o foco da Home.

## Fluxo e etapas do lead

```
novo → em_contato → visita → proposta → fechado → pago → consultoria_agendada → concluido
                                 (perdido pode acontecer antes de "fechado")
```

| Etapa | Quem marca | O que acontece |
|---|---|---|
| novo | usuária (app) | Lead criado com código `ATR-IMV-XXXX`, QR Code e consentimento LGPD. As administradoras recebem push. |
| em_contato / visita / proposta | imobiliária (portal) ou admin | A usuária recebe push e vê a linha do tempo. |
| fechado | imobiliária (portal) | Informa o valor do negócio (venda ou aluguel mensal). O portal calcula o repasse pelo acordo. Admins recebem push. |
| (repasse enviado) | imobiliária (portal) | Marca “Informar repasse enviado” (comprovante opcional). Admins recebem push. |
| pago | **admin** | “Confirmar recebimento do repasse”: o valor recebido fica **congelado**. A usuária é avisada de que a consultoria foi liberada. |
| consultoria_agendada | admin | Escolhe o arquiteto, a data e hora (Brasília) e o link da chamada. O custo do arquiteto fica congelado. A usuária recebe push com a data, e a data e o link aparecem no app. |
| concluido | admin | “Consultoria concluída”. Depois, “Registrar pagamento ao arquiteto”. |
| perdido | imobiliária ou admin | A usuária recebe uma mensagem acolhedora e pode fazer nova indicação. |

## Passo a passo para as administradoras

1. **Cadastre o arquiteto parceiro** (aba Arquitetos): nome, foto, CAU, especialidades e, na parte privada, o **valor por consultoria** e os dados de pagamento.
2. **Cadastre a imobiliária** (aba Imobiliárias → “Nova imobiliária”):
   - **Vitrine:** nome, logo, capa, descrição, CRECI, cidades e bairros, tipos (venda, aluguel, lançamentos), destaques, site, WhatsApp público, Instagram e um resumo das regras do benefício.
   - **Acordo (privado):** responsável, telefone e e-mail internos, **repasse por venda** e **por aluguel** (valor fixo ou %), prazo do repasse, dados para a imobiliária pagar a Atravessia, link do contrato no Drive e vigência.
3. No cartão da imobiliária, toque em **“Gerar link do portal”**. O link é copiado (no app, abre o compartilhamento). Envie esse link **só** para a pessoa responsável na imobiliária. Se ele vazar, use **“Novo link”** (o antigo para de funcionar) ou **“Revogar”**.
4. (Opcional) Cadastre **imóveis** (aba Imóveis) com fotos, preço, quartos, banheiros, vagas, área e link do anúncio original.
5. Acompanhe a aba **Leads**: use o funil, o filtro por imobiliária e a busca por código. Quando aparecer “Fechado”:
   - confira se o dinheiro entrou na conta da Atravessia;
   - toque em **“Confirmar recebimento do repasse”**. O valor já vem preenchido pelo acordo; ajuste se o valor recebido for outro.
6. Com o lead em “Repasse recebido”, toque em **“Agendar consultoria”**: escolha o arquiteto, a data e hora e cole o link da chamada (Meet, Zoom etc.).
7. Depois da consultoria: **“Consultoria concluída”** e **“Registrar pagamento ao arquiteto”**.
8. A aba **Financeiro** mostra o que foi recebido das imobiliárias, o que falta receber, o que foi pago e o que falta pagar aos arquitetos e a **margem** (recebido − arquitetos). Mostra também o resumo por imobiliária.

## Portal da imobiliária (`imobiliaria.html`)

- Abre sem login, pelo token do link. O token fica salvo no navegador. Assim, quando a imobiliária escaneia com a câmera o **QR Code** da cliente (`imobiliaria.html?c=<código>&v=<verificador>`), o código é **validado sozinho**. Também dá para digitar o código.
- Mostra os leads da imobiliária com nome e telefone **apenas de quem consentiu**, mais interesse, faixa de preço, bairros, prazo e observações.
- A imobiliária pode mudar a etapa (em contato, visita, proposta, fechado com valor, encerrar), ver o valor a repassar e **informar o repasse enviado**. A confirmação final (“pago”) é sempre da Atravessia.
- Proteção: limite de chamadas por IP (90 a cada 10 min) e bloqueio temporário após 8 links inválidos em 30 min (mesmo mecanismo do portal do profissional).

## Dados (Firestore)

| Coleção | Quem lê | Quem grava |
|---|---|---|
| `imobiliarias/{id}` | usuárias logadas | admin |
| `imobiliariasPrivado/{id}` (acordo, contrato, `tokenPortal`) | admin | admin (o token só pelo servidor) |
| `imoveis/{id}` | usuárias logadas | admin |
| `arquitetos/{id}` | usuárias logadas | admin |
| `arquitetosPrivado/{id}` (valor por consultoria, contato, pagamento) | admin | admin |
| `indicacoesImoveis/{id}` (lead: código, status, histórico, consultoria) | a própria usuária e admin | só servidor |
| `indicacoesImoveisPrivado/{id}` (valor do negócio, repasse previsto/recebido, custo e pagamento do arquiteto) | admin | só servidor |

Os valores financeiros ficam em `indicacoesImoveisPrivado` porque a usuária pode ler o próprio lead. Assim ela não vê os termos comerciais entre a Atravessia e a imobiliária.

Imagens: Storage `imoveis/` (envio só admin, até 10 MB, só imagem).

Cloud Functions (seção **IMOBILIÁRIAS** no final de `functions/index.js`): `criarIndicacaoImovel`, `portalImobiliaria`, `atualizarLeadImobiliaria`, `gerenciarPortalImobiliaria`, `confirmarRepasseImobiliaria`, `agendarConsultoria` e `atualizarLeadAdmin` (concluir consultoria, cancelar consultoria, pagar arquiteto e corrigir etapa).

**Para publicar:** `firebase deploy --only functions,firestore:rules,storage` e o build e deploy do painel web (que agora inclui `imobiliaria.html`). O app precisa de uma nova versão para mostrar as telas novas.

## Modelo de acordo com a imobiliária (pontos-chave)

> Modelo de referência, não é parecer jurídico. Revise com a assessoria antes de assinar.

1. **Objeto:** divulgação da imobiliária no app Atravessia (programa Lar e recomeço) e indicação de clientes interessadas em comprar ou alugar.
2. **Identificação da indicação:** vale a indicação identificada pelo **código ATR-IMV-XXXX** (ou QR Code) apresentado pela cliente ou registrado no portal. A imobiliária se compromete a registrar no portal as etapas e o fechamento dos negócios vindos de indicações.
3. **Valor por negócio fechado:**
   - venda: R$ ___ por negócio **ou** ___% do valor da venda;
   - aluguel: R$ ___ por contrato **ou** ___% do primeiro aluguel.
4. **Fato gerador e prazo do repasse:** negócio fechado **e pagamento da cliente confirmado**. Repasse em até ___ dias, por PIX ou transferência para a conta indicada pela Atravessia, informando o código da indicação. Marcar “repasse enviado” no portal (com comprovante, se possível).
5. **Validade da indicação:** ___ meses a partir do registro do interesse (sugestão: 6 a 12 meses), inclusive se a cliente fechar outro imóvel da mesma imobiliária.
6. **Sem custo para a cliente:** o repasse sai da remuneração da imobiliária e **não** pode ser acrescentado ao preço ou às taxas cobradas da cliente.
7. **LGPD:** a imobiliária recebe nome, telefone e preferências **só de quem autorizou**. Usa esses dados apenas para atender aquele interesse, não compartilha com terceiros nem usa para outras campanhas sem novo consentimento, e atende pedidos de exclusão. Cada parte é controladora dos dados que trata. Incidentes devem ser comunicados em até 48 h.
8. **Portal e link de acesso:** pessoal e intransferível. A imobiliária avisa a Atravessia se o link vazar, para que seja trocado.
9. **Conduta e marca:** atendimento respeitoso e acolhedor (muitas usuárias passam por luto ou grandes mudanças). Uso da marca Atravessia só nos materiais aprovados.
10. **Vigência e rescisão:** ___ meses, renovável. Pode ser encerrado por qualquer parte com aviso de 30 dias, mantendo os repasses das indicações já registradas.
11. **Auditoria simples:** a Atravessia pode pedir confirmação dos negócios fechados vindos de indicações.

## Modelo de acordo com o arquiteto parceiro (pontos-chave)

1. **Serviço:** consultoria online de cerca de ___ h (sugestão: 2 h) sobre organização, decoração e aproveitamento do imóvel, com um resumo por escrito ao final (opcional).
2. **Agendamento:** feito pela Atravessia depois do repasse da imobiliária. O arquiteto confirma a disponibilidade e envia ou usa o link da chamada.
3. **Valor e pagamento:** R$ ___ por consultoria realizada, pago em até ___ dias após a consultoria (a Atravessia registra o pagamento no painel). Sem valores cobrados da usuária.
4. **Faltas e remarcação:** uma remarcação sem custo. Em caso de falta da usuária sem aviso, ___.
5. **LGPD e sigilo:** o arquiteto recebe apenas o necessário (nome, contato e o que a usuária quiser contar sobre o imóvel). Não grava a chamada sem autorização e não usa os dados para outras finalidades.
6. **Postura:** escuta acolhedora e sem julgamentos. Não oferece outros serviços pagos durante a consultoria sem que a usuária peça.
7. **Registro profissional:** CAU ativo. A responsabilidade técnica pelas orientações é do arquiteto.
8. **Vigência:** por prazo indeterminado, com aviso de 30 dias para encerrar.

## O que as donas precisam fazer

- Publicar functions, regras e painel web, e lançar a nova versão do app (ver “Para publicar”).
- Fechar os acordos (modelos acima) e cadastrar as imobiliárias, os arquitetos e os valores.
- Gerar e enviar o link do portal para cada imobiliária. Orientar a imobiliária a abrir o link uma vez no celular que vai usar para escanear os QR Codes.
- Conferir o texto de consentimento e a seção “8-A. Indicações de imóveis” de `termos.html` com a assessoria jurídica.
