# Stripe: o que falta configurar

Este arquivo reúne o que ainda precisa ser feito fora do código para o checkout da Stripe funcionar em produção.

## Valores a substituir

Nenhum. As duas sessões de checkout já usam valores reais, e o código não tem nenhum valor de exemplo para trocar.

**Arquivo com as sessões:** [functions/index.js](functions/index.js)

| Campo | Valor atual | Observação |
|-------|-------------|------------|
| mode | `subscription` (planos) e `payment` (relatório por período) | Já corresponde a cada produto. |
| success_url | `request.data.successUrl` ou `${SITE_URL}/checkout-sucesso.html` | Página real. |
| cancel_url | `request.data.cancelUrl` ou `${SITE_URL}/checkout-cancelado.html` | Página real. |
| line_items | `price_data` montado com o preço configurado no painel (mensal, anual ou período) | Não usa Price IDs da Stripe, porque os preços são editados pelas administradoras no painel do app. |

## Parâmetros configurados

Estas opções vieram do Checkout Studio e ficam em `opcoesCheckoutStudio()`, em [functions/index.js](functions/index.js).

| Parâmetro | Valor |
|-----------|-------|
| ui_mode | `hosted` (o SDK instalado, `stripe@17`, é anterior à 21.0.0) |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| allow_promotion_codes | `true` (fica de fora quando há cupom de cashback, porque a Stripe não aceita os dois juntos) |
| payment_method_collection | `always` (só na assinatura) |
| submit_type | `auto` |
| consent_collection | `{ terms_of_service: 'required' }` |
| saved_payment_method_options | `{ payment_method_save: 'enabled' }` |
| integration_identifier | `hosted_web_0001` |
| origin_context | `web` |

Proteção: se a Stripe recusar uma dessas opções, a sessão é criada sem ela e o pagamento abre normalmente. Isso pode acontecer, por exemplo, porque os termos de serviço ainda não foram publicados ou porque a versão da API é antiga. Nesse caso, um aviso fica no log da function.

## Configuração (passo a passo)

### 1. Chave secreta de produção

A chave `sk_live_...` foi colada numa conversa. Por segurança, gere uma nova e desative a antiga:

1. No painel da Stripe, abra Desenvolvedores → Chaves de API e clique em **Rotacionar chave** na chave secreta.
2. No GitHub, abra o repositório e vá em **Settings → Secrets and variables → Actions → New repository secret**.
3. Crie o secret `STRIPE_SECRET_KEY` com a chave nova.

No próximo deploy, a action envia a chave para o Firebase sozinha, no passo "Sincronizar chaves da Stripe".

### 2. Webhook de produção

O segredo do webhook do modo de teste não funciona em produção.

1. Na Stripe, já no modo de produção, abra Desenvolvedores → Webhooks → **Adicionar destino**.
2. Use a URL da function `stripeWebhook`, que é a mesma do webhook de teste.
3. Selecione os eventos: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` e `customer.subscription.deleted`.
4. Copie o segredo de assinatura (`whsec_...`) e crie o secret `STRIPE_WEBHOOK_SECRET` no GitHub.

### 3. Termos de serviço

O checkout pede que a pessoa aceite os termos. Para isso, publique a URL dos termos em Configurações → **Dados públicos** da Stripe. Sem essa URL, o checkout abre sem a caixa de aceite.

### 4. Aparência do checkout

Configure em Configurações → **Marca** da Stripe, no modo de produção:

- logotipo e ícone da Atravessia;
- cor da marca `#EEE7FC`;
- cor de destaque `#45358A`;
- cantos arredondados;
- nome público "Atravessia".

### 5. Publicar

Faça o merge na `main`. A action "Deploy Firebase" sincroniza as chaves e publica as functions.

## Como funciona

1. O app chama `criarSessaoCheckout` (planos) ou `criarCheckoutPeriodoUnlocked` (relatório por período).
2. A function cria a sessão na Stripe e devolve a URL.
3. O app abre a página de pagamento da Stripe.
4. A Stripe avisa o `stripeWebhook`, que libera o plano ou o crédito do relatório.

## Testes

- No modo de teste, use o cartão `4242 4242 4242 4242`, com qualquer data futura e qualquer CVC.
- No modo de produção, só cartões reais funcionam. Um cartão real usado com chave de teste é sempre recusado.

## Links

- https://support.stripe.com
- https://docs.stripe.com/mcp
