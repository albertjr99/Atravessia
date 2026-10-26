# Cursos Atravessia

Cursos em vídeo, com aulas em vídeos **não listados** do YouTube (do canal da Atravessia ou de profissionais parceiros). As administradoras criam os cursos. A usuária vê a vitrine no app, compra pela Stripe e assiste às aulas no app ou no computador (`/curso.html`). Cada profissional acompanha as vendas por um portal com link próprio (`/profissional.html?t=…`).

## Como funciona

```
Admin cria o curso (painel)  →  cursos/{id}  (ativo = publicado)
Usuária toca em "Comprar curso — R$ X"  →  função criarCheckoutCurso  →  página da Stripe
Stripe confirma  →  stripeWebhook (checkout.session.completed, metadata.tipo = 'curso')
      →  matriculas/{stripeSessionId}       (valores congelados, só o servidor grava)
      →  usuarios/{uid}/cursos/{cursoId}    (acesso liberado; o app atualiza sozinho)
      →  push de boas-vindas
Reembolso total na Stripe  →  charge.refunded  →  matrícula "reembolsada" e acesso removido
Admin registra o repasse  →  função fecharRepasse  →  repasses/{id} e matrículas marcadas
Profissional abre o link  →  função portalProfissional  →  extrato agregado e anônimo
```

### Coleções

| Coleção | Quem grava | Quem lê | Conteúdo |
|---|---|---|---|
| `cursos/{id}` | admin | quem está logada | titulo, subtitulo, descricao, capaUrl, programa[{titulo, descricao}], aulas[{id, youtubeId, titulo, duracao, thumb, ordem, gratis}], preco (reais), ativo, destaque, profissionalId, criadoEm |
| `profissionais/{id}` | função `salvarProfissional` (admin) | quem está logada | nome, bio, fotoUrl, repasseTipo ('percentual'\|'fixo'), repasseValor, repasseBase ('bruto'\|'liquido'), ativo |
| `profissionaisPrivado/{id}` | só servidor | admin | email, tokenPortal (gerado no servidor) |
| `matriculas/{stripeSessionId}` | só servidor (webhook) | admin e a própria usuária | uid, cursoId, profissionalId, valorPagoCentavos, taxaStripeCentavos, repasseCentavos, repasseRegra, stripeSessionId, stripePaymentIntent, criadaEm, status ('ativa'\|'reembolsada'), repasseId |
| `usuarios/{uid}/cursos/{cursoId}` | servidor cria; a usuária só altera `progresso`, `ultimaAulaId`, `progressoEm` | a usuária e admin | cursoId, matriculaId, liberadoEm, progresso { aulaId: true } |
| `repasses/{id}` | só servidor (`fecharRepasse`) | admin (e o profissional, pelo portal) | profissionalId, periodo, matriculaIds, ajusteMatriculaIds, vendas/descontos/totalCentavos, pagoEm, comprovanteUrl |

Storage: `cursos/capas/…` e `cursos/profissionais/…` (só admin envia; leitura pública, porque a capa também aparece na página de pagamento da Stripe).

### Funções (functions/index.js, seção CURSOS)

- `criarCheckoutCurso` — sessão de pagamento avulso (mode `payment`), sem código promocional nem cashback, para o valor pago ser sempre o preço do curso.
- `stripeWebhook` — ramo `tipo === 'curso'` em `checkout.session.completed`, mais `checkout.session.async_payment_succeeded` (ex.: boleto) e `charge.refunded`. É idempotente: o id da matrícula é o id da sessão da Stripe.
- `importarVideosYoutube` (admin) — links de vídeos, playlist ou canal → título, miniatura e (com chave) duração.
- `salvarProfissional` (admin) — grava o perfil público e gera o token do portal no servidor.
- `portalProfissional` (sem login, por token) — extrato com totais por curso, vendas (data, valor, taxa, repasse, situação e código de verificação = últimos 8 caracteres do pagamento na Stripe) e repasses. Sem nome nem e-mail das alunas.
- `fecharRepasse` (admin) — junta as vendas ativas ainda não repassadas do período, desconta reembolsos de vendas já repassadas e registra o repasse.

**No painel da Stripe**, acrescente ao endpoint do webhook os eventos `checkout.session.async_payment_succeeded` e `charge.refunded` (o `checkout.session.completed` já está lá).

## Onde fica cada coisa

- **App da usuária:** linha “Cursos Atravessia” na tela inicial (logo acima de “Espaço para Parcerias”, só aparece com algum curso publicado) e item “Cursos” no menu. Telas: `CursosScreen` (vitrine), `CursoScreen` (página do curso), `AulaScreen` (player).
- **Web da aluna:** `https://o-amor-que-fica.web.app/curso.html` — mesma conta do app.
- **Painel:** Conteúdo do app → **Cursos** (abas Cursos, Profissionais, Vendas e repasses), no app e na web.
- **Portal do profissional:** link copiado no cartão do profissional (“Copiar link do portal do profissional”).

## Como cadastrar

1. **Profissional:** Cursos → Profissionais → Novo profissional. Preencha nome, mini bio, foto e o repasse combinado (percentual sobre o valor pago ou sobre o valor após a taxa da Stripe, ou valor fixo por venda). Salve e copie o link do portal para enviar ao profissional. “Novo link” invalida o anterior.
2. **Curso:** Cursos → Novo curso. Título, subtítulo, descrição, capa (16:9; sem capa vale a miniatura da 1ª aula), preço e profissional. Em “Importar do YouTube”, cole os links das aulas e clique em importar; depois ajuste títulos, ordem (setas), duração e marque 1 ou 2 aulas como **grátis** (amostra aberta para todas). Monte o conteúdo programático. Deixe “Publicado” desligado até revisar.
3. **Exemplo pronto:** no painel web, “Importar curso (JSON)” e escolha `docs/cursos/exemplo-yoga.json` (5 aulas do canal Yoga para Você). Ele cria o profissional e carrega o curso no formulário como rascunho.

## Como obter os vídeos não listados

1. No YouTube Studio do canal, envie o vídeo e em **Visibilidade** escolha **Não listado**.
2. Em **Mais opções → Licença e distribuição**, deixe **Permitir incorporação** ligado (sem isso o vídeo não toca no app).
3. Copie o link (`https://youtu.be/…`) e cole na importação. Vários links, um por linha. Uma playlist não listada com todas as aulas também funciona.
4. O link do canal (`@nome` ou `/channel/UC…`) traz só os **vídeos públicos mais recentes** (cerca de 15). Os não listados não aparecem na listagem do canal: use os links diretos ou uma playlist.

## Chave opcional `YOUTUBE_API_KEY`

Sem chave, a importação usa dados públicos (oEmbed para cada vídeo e o feed RSS do canal ou da playlist). Funciona com vídeos não listados, mas **não traz a duração** e lista no máximo uns 15 vídeos do canal. Com a chave da YouTube Data API v3, a importação lê playlists e canais inteiros (até 60 vídeos por vez) e preenche as durações.

Para ativar: crie uma chave no Google Cloud (APIs e serviços → YouTube Data API v3 → Credenciais) e coloque-a como variável de ambiente das functions (`functions/.env` com `YOUTUBE_API_KEY=...`, ou como secret, acrescentando `secrets: ['YOUTUBE_API_KEY']` nas opções de `importarVideosYoutube`).

## Riscos e evolução

- **Vídeo não listado não é vídeo protegido.** Quem tiver o link (inclusive uma aluna que compartilhe) consegue assistir no YouTube. O player esconde vídeos relacionados de outros canais, mas não impede a cópia do link. Para cursos de maior valor, a evolução recomendada é **Vimeo** (privacidade por domínio) ou **Bunny Stream** (URLs assinadas com validade e restrição de domínio). Nesse caso, o campo `youtubeId` passa a ser um id do provedor e o player muda; o resto (compra, matrícula, progresso e repasse) continua igual.
- **Repasse automático com Stripe Connect.** Hoje a Atravessia recebe tudo e repassa por transferência, registrando no painel. Com o Stripe Connect (contas Express para os profissionais e `transfer_data`/`application_fee_amount` no checkout), a própria Stripe divide cada venda e paga o profissional direto. A Stripe vira a fonte neutra dos valores, sem depender de ninguém da equipe.
- **Proteção contra má-fé que já existe:** as matrículas só podem ser criadas pelo servidor a partir de um evento assinado pela Stripe. O valor pago vem da Stripe. O repasse é calculado com a regra vigente na hora e guardado com essa regra (`repasseRegra`). As regras do Firestore impedem qualquer edição pelo app ou pelo painel. Cada venda mostra um código que pode ser conferido no painel da Stripe (busca pelo id do pagamento `pi_…`).
- **Preço do repasse sobre descontos:** cursos não aceitam código promocional nem cashback, para o repasse não ser reduzido por promoções da casa. Se isso mudar, defina antes se o repasse vale sobre o preço cheio ou sobre o valor pago.
