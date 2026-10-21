# Atravessia Artes — como ligar o gerador de artes por IA

O gerador já está pronto no painel web (menu **Criação → Atravessia Artes**) e no
painel do app (mesmo menu). Falta só conectar um serviço de IA com uma chave de API.
Enquanto isso, a tela mostra "Gerador ainda não conectado" e a galeria e o
compositor continuam funcionando.

## Como funciona

- Callable `gerarArte` (functions/index.js, seção **ATRAVESSIA ARTES**): só admin.
  Recebe `{ prompt, formato, estilo, usarPaletaMarca, quantidade (1–4), provedor? }`,
  junta o "prompt de marca" da Atravessia + estilo + formato, chama o provedor,
  salva cada imagem em `artes/{id}.png` no Storage e um documento na coleção `artes`.
- Callable `statusGeradorArtes`: diz ao painel se há chave e se o gerador está ligado.
- Callable `excluirArte`: apaga o arquivo e o documento.
- Configuração em `configuracoes/artes`: `{ provedor: 'openai' | 'gemini', ativo,
  modeloOpenai: 'gpt-image-1' | 'dall-e-3', qualidade: 'low' | 'medium' | 'high' }`.
  Editada no painel, botão **Configuração** no topo da tela.

## 1. Criar a chave

**DALL·E (OpenAI)** — https://platform.openai.com/api-keys → *Create new secret key*.
A conta precisa de créditos (Billing). Para usar `gpt-image-1`, a organização pode
precisar passar pela verificação (*Settings → Organization → Verify*).

**Nano Banana (Google Gemini 2.5 Flash Image)** — https://aistudio.google.com/apikey →
*Create API key*. A geração de imagens exige faturamento ativo no projeto do Google Cloud
ligado à chave.

## 2. Guardar a chave no Firebase (Secret Manager)

Na raiz do repositório, com o Firebase CLI logado no projeto `o-amor-que-fica`:

```bash
firebase functions:secrets:set OPENAI_API_KEY
# ou
firebase functions:secrets:set GEMINI_API_KEY
```

Cole a chave quando for pedida. Nunca coloque a chave no código, no painel ou no Git.

## 3. Trocar `process.env` por `defineSecret` na function

Hoje as chaves são lidas de `process.env` porque declarar um secret que ainda não
existe faz o deploy falhar. Depois do passo 2, em `functions/index.js`, seção
ATRAVESSIA ARTES:

```js
// antes
const CHAVES_ARTES = {
  openai: () => process.env.OPENAI_API_KEY || '',
  gemini: () => process.env.GEMINI_API_KEY || '',
};
const OPCOES_ARTES = { timeoutSeconds: 300, memory: '1GiB' };

// depois (exemplo com as duas chaves; declare só a que você criou)
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const CHAVES_ARTES = {
  openai: () => OPENAI_API_KEY.value(),
  gemini: () => GEMINI_API_KEY.value(),
};
const OPCOES_ARTES = { timeoutSeconds: 300, memory: '1GiB', secrets: [OPENAI_API_KEY, GEMINI_API_KEY] };
```

E dê ao `statusGeradorArtes` acesso aos mesmos secrets, para o painel saber que a chave
existe: troque `exports.statusGeradorArtes = onCall(async (request) => {` por
`exports.statusGeradorArtes = onCall({ secrets: [OPENAI_API_KEY, GEMINI_API_KEY] }, async (request) => {`.

(`defineSecret` já está importado no topo do arquivo.) Ao entrar na `main`, o GitHub
Actions publica as functions e a chave passa a valer.

## 4. Escolher o provedor no painel

Painel web → **Atravessia Artes** → **Configuração**: escolha **DALL·E** ou
**Nano Banana**, confira se o selo mostra "Chave configurada", deixe **Gerador ligado**
e clique em **Salvar configuração**. No app, o mesmo fica em "Configuração do gerador".
Para a OpenAI, dá para escolher o modelo e a qualidade (a qualidade muda o custo).

## Custos aproximados por imagem (referência; confira as páginas de preço)

| Provedor / modelo | Quadrado (post) | Vertical/horizontal |
|---|---|---|
| OpenAI `gpt-image-1` — rascunho (low) | ~US$ 0,011 | ~US$ 0,016 |
| OpenAI `gpt-image-1` — equilibrada (medium) | ~US$ 0,042 | ~US$ 0,063 |
| OpenAI `gpt-image-1` — alta (high) | ~US$ 0,167 | ~US$ 0,25 |
| OpenAI `dall-e-3` — standard / HD | ~US$ 0,04 / 0,08 | ~US$ 0,08 / 0,12 |
| Google `gemini-2.5-flash-image` | ~US$ 0,039 | ~US$ 0,039 |

"Quantidade 4" custa 4 imagens. O Storage cobra à parte (centavos por GB por mês).

## Formatos

| Formato | gpt-image-1 | dall-e-3 | Nano Banana |
|---|---|---|---|
| Post | 1024×1024 | 1024×1024 | 1:1 |
| Story | 1024×1536 | 1024×1792 | 9:16 |
| Banner | 1536×1024 | 1792×1024 | 21:9 |
| Paisagem | 1536×1024 | 1792×1024 | 16:9 |

## Compositor (painel web)

O botão de pincel no cartão da arte abre o compositor: título, frase, posição, cor,
logotipo e nome Atravessia, desenhados num canvas. **Baixar PNG** salva no computador;
**Salvar na galeria** envia a arte final para `artes/` (regras: só admin, imagem até
15 MB). Ele também aceita uma imagem do computador ("Compor com imagem própria") e
funciona mesmo sem o gerador conectado. Para exportar uma imagem do Storage, o
bucket precisa da configuração de CORS do `cors.json` (`gsutil cors set cors.json gs://o-amor-que-fica.firebasestorage.app`).
