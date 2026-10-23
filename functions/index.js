const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

const TIMEZONE = 'America/Sao_Paulo';

// Endereço público do site (Firebase Hosting). Vem do ID do projeto no Firebase,
// que não pode ser renomeado; para trocar por um endereço com o nome Atravessia
// (novo site no Hosting ou domínio próprio), basta mudar esta constante.
const SITE_URL = 'https://o-amor-que-fica.web.app';
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // não enviar mais de 1 notificação automática a cada 6h

// Envia uma notificação push via Expo Push API para um conjunto de tokens.
// A Expo aceita no máximo 100 mensagens por pedido: com mais usuárias, o envio
// inteiro era recusado. Agora vai em lotes, e a mensagem padrão usa o canal
// "default" com prioridade alta, para aparecer com a tela bloqueada.
async function enviarPush(mensagens) {
  const validas = mensagens.filter(m => typeof m.to === 'string' && /^Expo(nent)?PushToken\[/.test(m.to))
    .map(m => ({ sound: 'default', priority: 'high', channelId: 'avisos', ...m }));
  for (let i = 0; i < validas.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(validas.slice(i, i + 100)),
    }).then(r => r.json()).then(r => {
      const erros = (r?.data || []).filter(d => d.status === 'error');
      if (erros.length) console.warn('[Push] falhas:', JSON.stringify(erros.slice(0, 5)));
    }).catch(e => console.warn('[Push] envio falhou:', e?.message));
  }
}

// Aplica a regra "no máximo 1 notificação automática a cada 6h por usuária".
// Retorna true (e já marca o envio) se for permitido enviar agora.
async function podeEnviarAgora(userRef, agora) {
  const snap = await userRef.get();
  const ultimo = snap.data()?.ultimaNotificacaoAutomaticaEm?.toMillis?.() || 0;
  if (agora - ultimo < COOLDOWN_MS) return false;
  await userRef.update({ ultimaNotificacaoAutomaticaEm: admin.firestore.Timestamp.fromMillis(agora) });
  return true;
}

function diasEntre(dataAnteriorMs, agoraMs) {
  return Math.floor((agoraMs - dataAnteriorMs) / 86400000);
}

// Calcula a próxima ocorrência anual de uma data sensível (ignora o ano cadastrado),
// espelhando a mesma lógica usada no app (src/hooks/AppContext.js).
function proximaOcorrencia(dataStr, hoje) {
  const original = new Date(dataStr);
  let candidata = new Date(hoje.getFullYear(), original.getMonth(), original.getDate());
  candidata.setHours(0, 0, 0, 0);
  if (candidata < hoje) candidata.setFullYear(candidata.getFullYear() + 1);
  return candidata;
}

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Preços de referência em centavos (BRL) — usados apenas se o Firestore não
// tiver um valor válido cadastrado (ver obterPrecoPlanoCentavos/obterPrecoPeriodoCentavos
// abaixo). Antes estes valores eram usados SEMPRE, ignorando qualquer edição
// feita pela administração no app ou no painel web: mudar o preço na tela
// "Preços e Planos" ou no card do plano nunca alterava o valor realmente
// cobrado no checkout do Stripe.
const PLANOS = {
  1: { nome: 'Atravessia — Plano Acolher', valor: 2490 },
  2: { nome: 'Atravessia — Plano Compreender', valor: 4990 },
  3: { nome: 'Atravessia — Plano Evoluir', valor: 8990 },
};

// Preço por relatório de período (único para todos os planos)
const PERIODO_PRECO = { valor: 590, label: 'R$ 5,90' };

// Busca o preço atual do plano no Firestore. Prioriza `planos/{id}.preco`
// (reais — é o documento editado tanto pelo painel web quanto pelo card do
// plano no app) e, na ausência dele, `configuracoes/precos.plano{id}`
// (centavos — editado pela tela "Preços e Planos"). Cai no valor fixo acima
// somente se nenhum dos dois existir ou for inválido.
async function obterPrecoPlanoCentavos(planoId) {
  try {
    const planoSnap = await db.collection('planos').doc(String(planoId)).get();
    const preco = planoSnap.data()?.preco;
    if (typeof preco === 'number' && preco > 0) return Math.round(preco * 100);
  } catch { /* segue para o próximo fallback */ }

  try {
    const precosSnap = await db.collection('configuracoes').doc('precos').get();
    const centavos = precosSnap.data()?.[`plano${planoId}`];
    if (typeof centavos === 'number' && centavos > 0) return centavos;
  } catch { /* segue para o valor fixo */ }

  return PLANOS[planoId]?.valor ?? null;
}

// Preço do plano ANUAL (cobrado uma vez por ano). Prioriza `planos/{id}.precoAnual`
// (reais) e `configuracoes/precos.plano{id}Anual` (centavos); sem nenhum dos
// dois, vale 10 mensalidades (dois meses de presente).
async function obterPrecoAnualCentavos(planoId) {
  try {
    const planoSnap = await db.collection('planos').doc(String(planoId)).get();
    const preco = planoSnap.data()?.precoAnual;
    if (typeof preco === 'number' && preco > 0) return Math.round(preco * 100);
  } catch { /* segue para o próximo fallback */ }
  try {
    const precosSnap = await db.collection('configuracoes').doc('precos').get();
    const centavos = precosSnap.data()?.[`plano${planoId}Anual`];
    if (typeof centavos === 'number' && centavos > 0) return centavos;
  } catch { /* segue para o cálculo padrão */ }
  const mensal = await obterPrecoPlanoCentavos(planoId);
  return mensal ? mensal * 10 : null;
}

async function obterPrecoPeriodoCentavos() {
  try {
    const precosSnap = await db.collection('configuracoes').doc('precos').get();
    const centavos = precosSnap.data()?.periodo;
    if (typeof centavos === 'number' && centavos > 0) return centavos;
  } catch { /* segue para o valor fixo */ }
  return PERIODO_PRECO.valor;
}

// As functions de checkout rodavam com a configuração mínima (256 MiB, ~1/6 de
// vCPU): tanto o "acordar" depois de um tempo parado quanto cada chamada ao
// Stripe ficavam lentos, e a usuária esperava vários segundos para o
// pagamento abrir. Com 1 vCPU elas respondem bem mais rápido; o custo só corre
// enquanto a função está de fato executando.
const OPCOES_CHECKOUT = { secrets: [STRIPE_SECRET_KEY], memory: '512MiB', cpu: 1 };

let stripeCliente = null;
function stripeDe() {
  if (!stripeCliente) stripeCliente = Stripe(STRIPE_SECRET_KEY.value());
  return stripeCliente;
}

// O app grava o plano como número (0..3) e o painel web como texto ('acolher').
const PLANO_TEXTO = { perceber: 0, acolher: 1, compreender: 2, evoluir: 3 };
function planoNumero(userData) {
  const p = userData?.plano;
  if (typeof p === 'number') return p;
  const n = Number(p);
  if (p !== '' && p != null && Number.isFinite(n)) return n;
  return PLANO_TEXTO[String(p || '').toLowerCase()] ?? 0;
}

function temAcessoPago(userData) {
  if (userData?.acessoTotal === true) return true;
  const exp = userData?.cortesia?.expiracao?.toMillis?.();
  if (userData?.cortesia?.ativo === true && exp && exp > Date.now()) return true;
  return planoNumero(userData) >= 1;
}

const reaisTexto = (centavos) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// O cliente salvo pode ter sido criado no modo de teste da Stripe: depois da
// troca para a chave de produção ele "não existe" e a sessão falhava com erro
// interno. Nesse caso (ou se o cliente foi apagado), cria um novo.
async function getOrCreateCustomer(stripe, uid, userData) {
  if (userData.stripeCustomerId) {
    try {
      const existente = await stripe.customers.retrieve(userData.stripeCustomerId);
      if (!existente.deleted) return existente.id;
    } catch (e) {
      if (e?.code !== 'resource_missing') throw e;
    }
    console.warn('[Stripe] cliente salvo não existe neste modo; criando outro', uid);
  }
  const customer = await stripe.customers.create({
    email: userData.email,
    metadata: { uid },
  });
  await db.collection('usuarios').doc(uid).update({ stripeCustomerId: customer.id });
  return customer.id;
}

// Erros da Stripe viravam "internal" e o app só dizia que o serviço não
// respondeu. Agora o motivo fica no log e a pessoa recebe uma mensagem útil.
const comErroPagamento = (fn) => async (request) => {
  try { return await fn(request); } catch (e) { throw erroPagamento(e); }
};
function erroPagamento(e) {
  if (e instanceof HttpsError) return e;
  console.error('[Stripe] falha ao criar o pagamento:', e?.type, e?.code, e?.param, e?.message);
  if (e?.type === 'StripeAuthenticationError' || e?.type === 'StripePermissionError') {
    return new HttpsError('failed-precondition', 'O pagamento está temporariamente indisponível. Nossa equipe já foi avisada; tente mais tarde.');
  }
  if (e?.type === 'StripeInvalidRequestError') {
    return new HttpsError('failed-precondition', `Não foi possível preparar o pagamento (${e.code || 'configuração'}). Tente de novo em instantes.`);
  }
  return new HttpsError('unavailable', 'O serviço de pagamento não respondeu agora. Tente de novo em alguns instantes.');
}

exports.criarSessaoCheckout = onCall(OPCOES_CHECKOUT, comErroPagamento(async (request) => {
  // Chamada de aquecimento feita pelo app ao abrir a tela de planos: tira a
  // function do estado "parado" antes de a usuária tocar em assinar.
  if (request.data?.aquecer) return { ok: true };

  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para assinar um plano.');

  const planoId = Number(request.data?.planoId);
  const plano = PLANOS[planoId];
  if (!plano) throw new HttpsError('invalid-argument', 'Plano inválido.');
  // Assinatura mensal (padrão) ou anual.
  const anual = request.data?.periodo === 'anual';
  // As administradoras escolhem quais formas ficam disponíveis (configuracoes/assinatura).
  const cfgAssinatura = (await db.collection('configuracoes').doc('assinatura').get()).data() || {};
  if (anual && cfgAssinatura.anualAtivo === false) throw new HttpsError('failed-precondition', 'A assinatura anual não está disponível no momento.');
  if (!anual && cfgAssinatura.mensalAtivo === false) throw new HttpsError('failed-precondition', 'A assinatura mensal não está disponível no momento.');

  const userRef = db.collection('usuarios').doc(uid);
  const [valorAtual, userSnap] = await Promise.all([
    anual ? obterPrecoAnualCentavos(planoId) : obterPrecoPlanoCentavos(planoId),
    userRef.get(),
  ]);
  if (!valorAtual) throw new HttpsError('failed-precondition', 'Preço do plano não configurado.');
  const userData = userSnap.data() || {};

  if (planoNumero(userData) === planoId && userData.stripeSubscriptionId) {
    throw new HttpsError('already-exists', 'Você já está neste plano.');
  }

  const stripe = stripeDe();

  const customerId = await getOrCreateCustomer(stripe, uid, userData);
  // Cashback: desconto na primeira mensalidade, se ela escolheu usar.
  const cashback = request.data?.usarCashback ? await descontoCashback(stripe, uid, valorAtual) : null;

  const session = await criarSessaoCheckout(stripe, {
    ...opcoesCheckoutStudio({ assinatura: true, comDesconto: !!cashback }),
    ...(cashback ? { discounts: [{ coupon: cashback.cupomId }] } : {}),
    mode: 'subscription',
    customer: customerId,
    locale: 'pt-BR',
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: { name: anual ? `${plano.nome} (anual)` : plano.nome },
        unit_amount: valorAtual,
        recurring: { interval: anual ? 'year' : 'month' },
      },
      quantity: 1,
    }],
    success_url: request.data?.successUrl || `${SITE_URL}/checkout-sucesso.html`,
    cancel_url: request.data?.cancelUrl || `${SITE_URL}/checkout-cancelado.html`,
    metadata: { uid, planoId: String(planoId), periodo: anual ? 'anual' : 'mensal', cashbackCentavos: String(cashback?.desconto || 0) },
    subscription_data: { metadata: { uid, planoId: String(planoId), periodo: anual ? 'anual' : 'mensal' } },
    custom_text: {
      submit: { message: 'Você poderá cancelar quando quiser, direto no app.' },
      terms_of_service_acceptance: { message: TEXTO_ACEITE_TERMOS },
    },
  });

  return { url: session.url };
}));

// Opções do Checkout definidas no Checkout Studio da Stripe. Algumas dependem
// de configuração da conta (termos de serviço publicados) ou de uma versão
// mais nova da API; se a Stripe recusar uma delas, ela é retirada e a sessão é
// criada mesmo assim, para o pagamento nunca deixar de abrir.
const TEXTO_ACEITE_TERMOS = `Li e aceito os [Termos de Uso e de Assinatura](${SITE_URL}/termos.html) do Atravessia.`;
const OPCOES_STUDIO_OPCIONAIS = [
  'consent_collection', 'saved_payment_method_options', 'integration_identifier',
  'origin_context', 'allow_promotion_codes', 'phone_number_collection', 'automatic_tax',
];
function opcoesCheckoutStudio({ assinatura, comDesconto }) {
  return {
    ui_mode: 'hosted',
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    // A Stripe não aceita cupom de cashback e campo de código promocional juntos.
    ...(comDesconto ? {} : { allow_promotion_codes: true }),
    ...(assinatura ? { payment_method_collection: 'always' } : {}),
    submit_type: 'auto',
    consent_collection: { terms_of_service: 'required' },
    saved_payment_method_options: { payment_method_save: 'enabled' },
    integration_identifier: 'hosted_web_0001',
    origin_context: 'web',
  };
}
async function criarSessaoCheckout(stripe, params) {
  const p = { ...params };
  for (let tentativa = 0; tentativa <= OPCOES_STUDIO_OPCIONAIS.length; tentativa++) {
    try {
      return await stripe.checkout.sessions.create(p);
    } catch (e) {
      const campo = String(e?.param || '').split('[')[0];
      if (e?.type !== 'StripeInvalidRequestError' || !OPCOES_STUDIO_OPCIONAIS.includes(campo) || !(campo in p)) throw e;
      console.warn(`[Checkout] Stripe recusou "${campo}"; criando a sessão sem ele.`, e.message);
      delete p[campo];
      // O texto do aceite dos termos só existe junto com a coleta de consentimento.
      if (campo === 'consent_collection' && p.custom_text?.terms_of_service_acceptance) {
        const { terms_of_service_acceptance: _, ...resto } = p.custom_text;
        p.custom_text = resto;
      }
    }
  }
  return stripe.checkout.sessions.create(p);
}

exports.criarCheckoutPeriodoUnlocked = onCall(OPCOES_CHECKOUT, comErroPagamento(async (request) => {
  if (request.data?.aquecer) return { ok: true };

  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para continuar.');

  const userRef = db.collection('usuarios').doc(uid);
  const [userSnap, valorAtual] = await Promise.all([userRef.get(), obterPrecoPeriodoCentavos()]);
  const userData = userSnap.data() || {};

  // O relatório por período é uma compra avulsa, disponível também no plano gratuito.

  const stripe = stripeDe();
  const customerId = await getOrCreateCustomer(stripe, uid, userData);
  const cashback = request.data?.usarCashback ? await descontoCashback(stripe, uid, valorAtual) : null;

  const session = await criarSessaoCheckout(stripe, {
    ...opcoesCheckoutStudio({ assinatura: false, comDesconto: !!cashback }),
    ...(cashback ? { discounts: [{ coupon: cashback.cupomId }] } : {}),
    mode: 'payment',
    customer: customerId,
    locale: 'pt-BR',
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: { name: 'Relatório por Período — Atravessia (1 relatório)' },
        unit_amount: valorAtual,
      },
      quantity: 1,
    }],
    success_url: request.data?.successUrl || `${SITE_URL}/checkout-sucesso.html`,
    cancel_url: request.data?.cancelUrl || `${SITE_URL}/checkout-cancelado.html`,
    metadata: { uid, tipo: 'periodo_credito', cashbackCentavos: String(cashback?.desconto || 0) },
    custom_text: {
      submit: { message: `${reaisTexto(valorAtual)} por relatório — use quando quiser.` },
      terms_of_service_acceptance: { message: TEXTO_ACEITE_TERMOS },
    },
  });

  return { url: session.url };
}));

exports.cancelarAssinatura = onCall(OPCOES_CHECKOUT, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login.');

  const userRef = db.collection('usuarios').doc(uid);
  const userSnap = await userRef.get();
  const subscriptionId = userSnap.data()?.stripeSubscriptionId;

  if (!subscriptionId) {
    await userRef.update({ plano: 0 });
    return { ok: true };
  }

  const stripe = Stripe(STRIPE_SECRET_KEY.value());
  await stripe.subscriptions.cancel(subscriptionId);
  return { ok: true };
});

async function definirPlano(uid, planoId, extra = {}) {
  if (!uid) return;
  await db.collection('usuarios').doc(uid).set({ plano: planoId, ...extra }, { merge: true });
}

exports.stripeWebhook = onRequest({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  const stripe = Stripe(STRIPE_SECRET_KEY.value());
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET.value());
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const usado = Number(session.metadata?.cashbackCentavos || 0);
      if (usado > 0 && session.metadata?.uid) {
        try {
          await debitarCashback(session.metadata.uid, usado, {
            descricao: session.metadata?.tipo === 'periodo_credito' ? 'Desconto no relatório personalizado' : 'Desconto na mensalidade do plano',
            referencia: session.id,
          });
        } catch (e) {
          console.error('[cashback] falha ao debitar', session.id, e);
        }
      }
      if (session.metadata?.tipo === 'periodo_credito') {
        const uid = session.metadata?.uid;
        if (uid) {
          await db.collection('usuarios').doc(uid).set(
            { periodoCreditos: admin.firestore.FieldValue.increment(1) },
            { merge: true }
          );
        }
      } else {
        await definirPlano(session.metadata?.uid, Number(session.metadata?.planoId), {
          stripeSubscriptionId: session.subscription,
          stripeCustomerId: session.customer,
          periodoAssinatura: session.metadata?.periodo === 'anual' ? 'anual' : 'mensal',
        });
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const uid = sub.metadata?.uid;
      if (sub.status === 'active' || sub.status === 'trialing') {
        await definirPlano(uid, Number(sub.metadata?.planoId));
      } else if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
        await definirPlano(uid, 0);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await definirPlano(sub.metadata?.uid, 0);
      break;
    }
  }

  res.json({ received: true });
});

// ---- Notificações automáticas agendadas (tabela de notificações da documentação) ----

const MENSAGENS_INATIVIDADE = {
  3: 'Sentimos sua falta por aqui. Como você está hoje?',
  7: 'Já faz alguns dias que você não passa por aqui. Se desejar, estamos prontos para caminhar com você.',
  14: 'Você não precisa passar por tudo sozinho. Quando quiser, estaremos aqui.',
};

// Roda 1x por dia às 10h (horário de Brasília) e avisa usuárias inativas há 3, 7 ou 14 dias.
exports.notificarInatividade = onSchedule({ schedule: '0 10 * * *', timeZone: TIMEZONE }, async () => {
  const agora = Date.now();
  const usuariosSnap = await db.collection('usuarios').get();
  const mensagensPush = [];

  for (const userDoc of usuariosSnap.docs) {
    const dados = userDoc.data();
    if (!dados.pushToken) continue;

    const checkinsSnap = await userDoc.ref.collection('checkins').orderBy('criadoEm', 'desc').limit(1).get();
    if (checkinsSnap.empty) continue;
    const ultimoCheckinMs = checkinsSnap.docs[0].data().criadoEm?.toMillis?.() || 0;
    const dias = diasEntre(ultimoCheckinMs, agora);

    let nivel = null;
    if (dias >= 14) nivel = 14;
    else if (dias >= 7) nivel = 7;
    else if (dias >= 3) nivel = 3;
    if (!nivel) continue;

    if (dados.ultimoNivelInatividadeNotificado === nivel) continue; // já avisamos nesse mesmo nível
    if (!(await podeEnviarAgora(userDoc.ref, agora))) continue;

    await userDoc.ref.update({ ultimoNivelInatividadeNotificado: nivel });
    mensagensPush.push({ to: dados.pushToken, title: 'Atravessia', body: MENSAGENS_INATIVIDADE[nivel], data: { screen: 'CheckIn' } });
  }

  await enviarPush(mensagensPush);
});

// Roda 1x por dia às 9h e avisa sobre datas sensíveis cadastradas (no dia e 3 dias antes).
exports.notificarDatasSensiveis = onSchedule({ schedule: '0 9 * * *', timeZone: TIMEZONE }, async () => {
  const agora = Date.now();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const usuariosSnap = await db.collection('usuarios').get();
  const mensagensPush = [];

  for (const userDoc of usuariosSnap.docs) {
    const dados = userDoc.data();
    if (!dados.pushToken) continue;

    const datasSnap = await userDoc.ref.collection('datasSensiveis').get();
    let texto = null;
    for (const d of datasSnap.docs) {
      const dataEvento = proximaOcorrencia(d.data().data, hoje);
      const diff = Math.round((dataEvento - hoje) / 86400000);
      if (diff === 0) { texto = 'Hoje é uma data significativa. Permita-se sentir o que vier, sem cobranças.'; break; }
      if (diff > 0 && diff <= 3) { texto = 'Uma data importante está se aproximando. Talvez seja um bom momento para cuidar de você com carinho.'; }
    }
    if (!texto) continue;
    if (!(await podeEnviarAgora(userDoc.ref, agora))) continue;

    mensagensPush.push({ to: dados.pushToken, title: 'Atravessia', body: texto, data: { screen: 'DatasSensiveis' } });
  }

  await enviarPush(mensagensPush);
});

// Roda todo domingo às 18h — feedback semanal (Plano 2+).
exports.notificarFeedbackSemanal = onSchedule({ schedule: '0 18 * * 0', timeZone: TIMEZONE }, async () => {
  const agora = Date.now();
  const usuariosSnap = await db.collection('usuarios').where('plano', '>=', 2).get();
  const mensagensPush = [];

  for (const userDoc of usuariosSnap.docs) {
    const dados = userDoc.data();
    if (!dados.pushToken) continue;
    const checkinsSnap = await userDoc.ref.collection('checkins').get();
    if (checkinsSnap.empty) continue;
    if (!(await podeEnviarAgora(userDoc.ref, agora))) continue;

    mensagensPush.push({ to: dados.pushToken, title: 'Atravessia', body: 'Sua retrospectiva emocional da semana está pronta.', data: { screen: 'Relatorios' } });
  }

  await enviarPush(mensagensPush);
});

// Emoções não-positivas, espelhando src/data/index.js -> emocoes (positiva: false)
const EMOCOES_NEGATIVAS = new Set(['triste', 'saudade', 'sozinho', 'medo', 'culpado', 'ansioso', 'raiva', 'desanimado', 'confuso']);

// Roda no dia 1 de cada mês às 19h30 — sugere a rede de apoio (Plano 3) quando a
// análise mensal mostra um período predominantemente difícil (>=60% de check-ins negativos).
exports.notificarRedeApoioSugerida = onSchedule({ schedule: '30 19 1 * *', timeZone: TIMEZONE }, async () => {
  const agora = Date.now();
  const usuariosSnap = await db.collection('usuarios').where('plano', '>=', 3).get();
  const mensagensPush = [];

  for (const userDoc of usuariosSnap.docs) {
    const dados = userDoc.data();
    if (!dados.pushToken) continue;

    const checkinsSnap = await userDoc.ref.collection('checkins')
      .where('criadoEm', '>=', admin.firestore.Timestamp.fromMillis(agora - 30 * 86400000))
      .get();
    if (checkinsSnap.empty) continue;

    const negativas = checkinsSnap.docs.filter(d => EMOCOES_NEGATIVAS.has(d.data().emocao)).length;
    if (negativas / checkinsSnap.size < 0.6) continue;
    if (!(await podeEnviarAgora(userDoc.ref, agora))) continue;

    mensagensPush.push({ to: dados.pushToken, title: 'Atravessia', body: 'Você não precisa atravessar tudo sozinho. Considere se aproximar de alguém da sua rede de apoio.', data: { screen: 'RedeApoio' } });
  }

  await enviarPush(mensagensPush);
});

// Roda 1x por dia às 20h — avisa usuária que está com a mesma emoção difícil há 15 dias seguidos.
exports.notificarEmocaoPersistente = onSchedule({ schedule: '0 20 * * *', timeZone: TIMEZONE }, async () => {
  const agora = Date.now();
  const quinzeDiasAtras = admin.firestore.Timestamp.fromMillis(agora - 15 * 86400000);
  const usuariosSnap = await db.collection('usuarios').get();
  const mensagensPush = [];

  for (const userDoc of usuariosSnap.docs) {
    const dados = userDoc.data();
    if (!dados.pushToken) continue;

    const checkinsSnap = await userDoc.ref.collection('checkins')
      .where('criadoEm', '>=', quinzeDiasAtras)
      .orderBy('criadoEm', 'desc')
      .get();
    if (checkinsSnap.empty) continue;

    // Agrupa por data (YYYY-MM-DD), ficando com o mais recente de cada dia
    const porData = {};
    for (const d of checkinsSnap.docs) {
      const dado = d.data();
      if (!porData[dado.data]) porData[dado.data] = dado.emocao;
    }

    const datas = Object.keys(porData).sort().reverse(); // mais recente primeiro
    if (datas.length < 15) continue;

    const emocaoRef = porData[datas[0]];
    if (!EMOCOES_NEGATIVAS.has(emocaoRef)) continue;

    const todasIguais = datas.slice(0, 15).every(d => porData[d] === emocaoRef);
    if (!todasIguais) continue;
    if (!(await podeEnviarAgora(userDoc.ref, agora))) continue;

    mensagensPush.push({
      to: dados.pushToken,
      title: 'Atravessia',
      body: 'Você está há duas semanas assim. Se cuide. Você é importante. 💜',
      data: { screen: 'CheckIn' },
    });
  }

  await enviarPush(mensagensPush);
});

// Ao registrar um novo check-in, libera a próxima escalada de aviso de inatividade
// (sem isso, quem voltou a usar o app uma vez nunca mais receberia o aviso de 7/14 dias).
// Comunicações publicadas pelas administradoras (painel do app ou web) também
// chegam como notificação no aparelho, respeitando o público escolhido.
exports.pushComunicacaoAdmin = onDocumentCreated('notificacoesEditoriais/{id}', async (event) => {
  const n = event.data?.data();
  if (!n || n.origem !== 'admin' || n.ativa === false || !n.texto) return;
  const alvo = n.alvo || 'todos';
  const usuarios = n.usuarioId
    ? [await db.collection('usuarios').doc(n.usuarioId).get()].filter(d => d.exists)
    : (await db.collection('usuarios').where('pushToken', '!=', null).get()).docs;
  const mensagens = [];
  for (const d of usuarios) {
    const u = d.data();
    if (!u.pushToken) continue;
    const plano = Number(u.plano) || 0;
    const total = u.acessoTotal === true;
    if (alvo === 'plano1' && !(total || plano >= 1)) continue;
    if (alvo === 'gratis' && (total || plano >= 1)) continue;
    if (alvo === 'plano2' && !(total || plano === 2)) continue;
    if (alvo === 'plano3' && !(total || plano === 3)) continue;
    mensagens.push({ to: u.pushToken, title: 'Atravessia', body: n.texto, data: { screen: 'Notificacoes' } });
  }
  await enviarPush(mensagens);
});

exports.resetarInatividadeAoCheckin = onDocumentCreated('usuarios/{uid}/checkins/{checkinId}', async (event) => {
  await db.collection('usuarios').doc(event.params.uid).update({ ultimoNivelInatividadeNotificado: null });
});

// Total de atividades por jornada, espelhando src/data/index.js -> jornadas
const TOTAL_ATIVIDADES_JORNADA = { 1: 7, 2: 21, 3: 21 };

// Roda 1x por dia às 18h e avisa quem começou uma jornada mas parou de avançar
// (sem concluir nenhuma etapa nova) há 3 ou mais dias.
exports.notificarJornadaParada = onSchedule({ schedule: '0 18 * * *', timeZone: TIMEZONE }, async () => {
  const agora = Date.now();
  const usuariosSnap = await db.collection('usuarios').get();
  const mensagensPush = [];

  for (const userDoc of usuariosSnap.docs) {
    const dados = userDoc.data();
    if (!dados.pushToken) continue;

    const progressoSnap = await userDoc.ref.collection('jornadaProgresso').get();
    let parada = false;
    for (const p of progressoSnap.docs) {
      const total = TOTAL_ATIVIDADES_JORNADA[p.id];
      const concluidas = p.data().concluidas || [];
      if (!total || concluidas.length >= total) continue;
      const atualizadoMs = p.data().atualizadoEm?.toMillis?.() || 0;
      if (diasEntre(atualizadoMs, agora) >= 3) { parada = true; break; }
    }
    if (!parada) continue;
    if (!(await podeEnviarAgora(userDoc.ref, agora))) continue;

    mensagensPush.push({ to: dados.pushToken, title: 'Atravessia', body: 'Sua jornada está esperando por você. Quando se sentir pronta, continue de onde parou.', data: { screen: 'Inicio' } });
  }

  await enviarPush(mensagensPush);
});

// Roda 1x por dia às 18h e avisa quem tem memórias registradas no Memorial
// mas não adiciona nada de novo há 30 dias ou mais.
exports.notificarMemorialSemAtualizacao = onSchedule({ schedule: '0 18 * * *', timeZone: TIMEZONE }, async () => {
  const agora = Date.now();
  const usuariosSnap = await db.collection('usuarios').get();
  const mensagensPush = [];

  for (const userDoc of usuariosSnap.docs) {
    const dados = userDoc.data();
    if (!dados.pushToken) continue;

    if (dados.memorialAvisoEnviado) continue; // já avisamos; só reavisa após nova memória (ver resetarMemorialAvisoAoCriar)
    const memoriasSnap = await userDoc.ref.collection('memorias').orderBy('criadoEm', 'desc').limit(1).get();
    if (memoriasSnap.empty) continue;
    const ultimaMs = memoriasSnap.docs[0].data().criadoEm?.toMillis?.() || 0;
    if (diasEntre(ultimaMs, agora) < 30) continue;
    if (!(await podeEnviarAgora(userDoc.ref, agora))) continue;

    await userDoc.ref.update({ memorialAvisoEnviado: true });
    mensagensPush.push({ to: dados.pushToken, title: 'Atravessia', body: 'Seu Memorial está esperando por novas lembranças. Que tal adicionar algo hoje?', data: { screen: 'Inicio' } });
  }

  await enviarPush(mensagensPush);
});

// Ao registrar uma nova memória, libera novamente o aviso de "Memorial sem atualização"
// para o próximo período de 30 dias de inatividade no Memorial.
exports.resetarMemorialAvisoAoCriar = onDocumentCreated('usuarios/{uid}/memorias/{memoriaId}', async (event) => {
  await db.collection('usuarios').doc(event.params.uid).update({ memorialAvisoEnviado: false });
});

// Roda no dia 1 de cada mês às 19h — relatório mensal (Plano 3).
exports.notificarRelatorioMensal = onSchedule({ schedule: '0 19 1 * *', timeZone: TIMEZONE }, async () => {
  const agora = Date.now();
  const usuariosSnap = await db.collection('usuarios').where('plano', '>=', 3).get();
  const mensagensPush = [];

  for (const userDoc of usuariosSnap.docs) {
    const dados = userDoc.data();
    if (!dados.pushToken) continue;
    if (!(await podeEnviarAgora(userDoc.ref, agora))) continue;

    mensagensPush.push({ to: dados.pushToken, title: 'Atravessia', body: 'Seu relatório emocional do mês está pronto.', data: { screen: 'Relatorios' } });
  }

  await enviarPush(mensagensPush);
});

// ============================================================================
// MÓDULO DE BENEFÍCIOS / CUPONS COM COMISSÃO ("Cuide-se")
// ============================================================================
//
// Nem toda parceria gera comissão: `parcerias/{id}.tipoBeneficio` distingue
//   - 'link'  → o comportamento de sempre (leitura livre, sem rastreamento
//               financeiro, o clique só é contado por estatística).
//   - 'cupom' → benefício com repasse de comissão para o Travessia. Passa
//               pelo fluxo completo abaixo: voucher → validação pelo parceiro
//               → confirmação da usuária → elegibilidade → fechamento →
//               pagamento. Cada etapa é um evento distinto — gerar o cupom
//               NUNCA é contabilizado como comissão; só a confirmação da
//               usuária, depois da janela de contestação, torna o valor
//               "a receber" de fato.
//
// Regra de ouro de segurança: todo cálculo financeiro roda aqui (Admin SDK),
// nunca no cliente. As coleções vouchers/resgates/fechamentos/auditoriaBeneficios
// têm `allow write: if false` no firestore.rules — só estas Cloud Functions
// conseguem gravar nelas.

const ADMIN_EMAILS_BENEFICIOS = ['carla.zambi.psi@gmail.com', 'larissapjaniques@gmail.com'];
const JANELA_CONTESTACAO_HORAS = 24;
// Domínio padrão do Firebase Hosting para o projeto — sempre existe, mesmo
// sem domínio próprio configurado.
const PARTNER_PORTAL_BASE_URL = SITE_URL;

async function exigirAdmin(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login como administradora.');
  const email = (request.auth.token?.email || '').toLowerCase();
  if (ADMIN_EMAILS_BENEFICIOS.includes(email)) return uid;
  const snap = await db.collection('usuarios').doc(uid).get();
  if (snap.data()?.role === 'admin') return uid;
  throw new HttpsError('permission-denied', 'Apenas administradoras podem fazer isso.');
}

function centavos(valorReais) {
  const n = Number(valorReais);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
const reais = (c) => Math.round(c) / 100;

async function registrarAuditoriaBeneficio(tipo, entidade, entidadeId, dados = {}) {
  await db.collection('auditoriaBeneficios').add({
    tipo, entidade, entidadeId,
    ...dados,
    dataHora: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function gerarCodigoPublico() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1 (evita confusão visual)
  let s = '';
  for (let i = 0; i < 6; i++) s += alfabeto[crypto.randomInt(alfabeto.length)];
  return `TRV-${s}`;
}

// ---- 1) Usuária gera o voucher ---------------------------------------------
// Qualquer falha inesperada vinha para o app como "INTERNAL". Agora o motivo
// fica no log da function e a pessoa recebe uma mensagem clara.
exports.gerarVoucherBeneficio = onCall({ memory: '256MiB', timeoutSeconds: 60 }, async (request) => {
  try {
    return await gerarVoucher(request);
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[Cupom] falha ao gerar', request.data?.parceriaId, e?.code, e?.message, e?.stack);
    throw new HttpsError('unavailable', 'Não foi possível gerar o cupom agora. Tente de novo em instantes.');
  }
});

async function gerarVoucher(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para gerar um cupom.');

  const parceriaId = String(request.data?.parceriaId || '');
  if (!parceriaId) throw new HttpsError('invalid-argument', 'Parceria inválida.');

  const parceriaRef = db.collection('parcerias').doc(parceriaId);
  const parceriaSnap = await parceriaRef.get();
  if (!parceriaSnap.exists) throw new HttpsError('not-found', 'Parceria não encontrada.');
  const parceria = parceriaSnap.data();

  if (parceria.ativo === false) throw new HttpsError('failed-precondition', 'Esta parceria não está mais ativa.');
  if (parceria.tipoBeneficio !== 'cupom') throw new HttpsError('failed-precondition', 'Esta parceria não usa cupom — acesse pelo link do benefício.');

  const beneficio = Number(parceria.percentualBeneficio) || 0;
  const comissao = Number(parceria.percentualComissao) || 0;
  // O desconto da usuária é o percentual cadastrado na parceria. A comissão da
  // Atravessia é separada: o parceiro repassa, e ela não sai do desconto da usuária.
  const descontoCliente = beneficio;
  if (beneficio <= 0) throw new HttpsError('failed-precondition', 'Este benefício ainda não tem um percentual configurado.');

  const validadeDias = Number(parceria.validadeDiasVoucher) > 0 ? Number(parceria.validadeDiasVoucher) : 30;
  // Sem limite de cupons por pessoa: a usuária gera quantos precisar. Cada cupom
  // continua sendo de uso único e com validade própria.
  const tokenSeguro = crypto.randomBytes(24).toString('base64url');
  const codigoPublico = gerarCodigoPublico();
  const agora = admin.firestore.Timestamp.now();
  const expiraEm = admin.firestore.Timestamp.fromMillis(agora.toMillis() + validadeDias * 86400000);

  await db.collection('vouchers').doc(tokenSeguro).set({
    codigoPublico,
    tokenSeguro,
    usuarioId: uid,
    parceriaId,
    parceriaNome: parceria.titulo || '',
    status: 'GERADO',
    percentualBeneficio: beneficio,
    percentualComissao: comissao,
    percentualDescontoCliente: descontoCliente,
    // A comissão é sempre sobre o valor original do serviço (decisão da
    // administração); a opção "valor final" foi retirada do painel.
    baseCalculoComissao: 'valor_original',
    geradoEm: agora,
    expiraEm,
  });

  await registrarAuditoriaBeneficio('VOUCHER_CREATED', 'voucher', tokenSeguro, {
    usuarioId: uid, perfil: 'usuaria', parceriaId,
  });

  // Só o desconto da própria usuária volta ao app — a comissão da Atravessia é
  // assunto entre a Atravessia e o parceiro.
  return {
    tokenSeguro,
    codigoPublico,
    expiraEm: expiraEm.toMillis(),
    percentualDescontoCliente: descontoCliente,
    linkValidacao: `${PARTNER_PORTAL_BASE_URL}/parceiro.html?t=${tokenSeguro}`,
  };
}

// ---- 2) Parceiro valida o voucher (sem login — o token é a credencial) -----
// Chamada pública (parceiro.html não autentica no Firebase); a segurança vem
// do token ser um segredo de 24 bytes só conhecido por quem vê o QR/link.
exports.validarVoucher = onCall(async (request) => {
  const tokenSeguro = String(request.data?.tokenSeguro || '');
  if (!tokenSeguro) throw new HttpsError('invalid-argument', 'Cupom não informado.');

  const voucherRef = db.collection('vouchers').doc(tokenSeguro);

  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(voucherRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Cupom não encontrado.');
    const v = snap.data();

    if (v.expiraEm && v.expiraEm.toMillis() < Date.now() && ['GERADO', 'APRESENTADO'].includes(v.status)) {
      tx.update(voucherRef, { status: 'EXPIRADO' });
      throw new HttpsError('failed-precondition', 'Este cupom expirou.');
    }
    if (v.status === 'VALIDADO') {
      // Reapresentar o mesmo cupom (ex.: recarregou a página) não é erro.
    } else if (!['GERADO', 'APRESENTADO'].includes(v.status)) {
      const mensagens = {
        CONCLUIDO: 'Este cupom já foi utilizado.',
        CONFIRMADO_USUARIO: 'Este cupom já foi utilizado.',
        CONTESTADO: 'Este cupom já foi utilizado.',
        CANCELADO: 'Este cupom foi cancelado.',
        EXPIRADO: 'Este cupom expirou.',
      };
      throw new HttpsError('failed-precondition', mensagens[v.status] || 'Este cupom não está disponível.');
    } else {
      tx.update(voucherRef, { status: 'VALIDADO', validadoEm: admin.firestore.FieldValue.serverTimestamp() });
    }
    return v;
  });

  await registrarAuditoriaBeneficio('VOUCHER_VALIDATED', 'voucher', tokenSeguro, { perfil: 'parceiro' });

  // Só o essencial para o parceiro decidir e informar o valor — nenhum dado
  // pessoal da usuária é exposto.
  return {
    ok: true,
    parceriaNome: resultado.parceriaNome,
    percentualBeneficio: resultado.percentualBeneficio,
    percentualComissao: resultado.percentualComissao,
    // Cupons antigos guardavam "benefício − comissão"; vale sempre o benefício cadastrado.
    percentualDescontoCliente: Number(resultado.percentualBeneficio) || Number(resultado.percentualDescontoCliente) || 0,
    baseCalculoComissao: resultado.baseCalculoComissao,
    codigoPublico: resultado.codigoPublico,
  };
});

// ---- 3) Parceiro informa o valor e confirma o atendimento ------------------
exports.confirmarAtendimento = onCall(async (request) => {
  const tokenSeguro = String(request.data?.tokenSeguro || '');
  const valorOriginalCentavos = centavos(request.data?.valorOriginal);
  if (!tokenSeguro) throw new HttpsError('invalid-argument', 'Cupom não informado.');
  if (valorOriginalCentavos == null || valorOriginalCentavos <= 0) {
    throw new HttpsError('invalid-argument', 'Informe o valor do serviço.');
  }

  const voucherRef = db.collection('vouchers').doc(tokenSeguro);
  const resgateRef = db.collection('resgates').doc();

  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(voucherRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Cupom não encontrado.');
    const v = snap.data();
    if (v.status !== 'VALIDADO') {
      throw new HttpsError('failed-precondition', 'Valide o cupom antes de confirmar o atendimento.');
    }

    // Cálculo inteiro em centavos — nunca ponto flutuante para dinheiro.
    // A cliente recebe o desconto cadastrado na parceria e, à parte, o parceiro
    // repassa a comissão da Atravessia sobre o valor original (serviço de R$ 100
    // com 10% de desconto e 5% de comissão: a cliente paga R$ 90 e o parceiro
    // repassa R$ 5). Cupons antigos guardavam "benefício − comissão" como desconto.
    const pctCliente = Number(v.percentualBeneficio) || Number(v.percentualDescontoCliente) || 0;
    const descontoTotal = Math.round(valorOriginalCentavos * (pctCliente / 100));
    const descontoCliente = descontoTotal;
    const valorFinalCentavos = valorOriginalCentavos - descontoCliente;
    const comissaoCentavos = Math.round(valorOriginalCentavos * (v.percentualComissao / 100));

    const agora = admin.firestore.FieldValue.serverTimestamp();

    tx.set(resgateRef, {
      voucherId: tokenSeguro,
      codigoPublico: v.codigoPublico,
      parceriaId: v.parceriaId,
      parceriaNome: v.parceriaNome,
      usuarioId: v.usuarioId,
      valorOriginalCentavos,
      valorDescontoCentavos: descontoTotal,
      valorDescontoClienteCentavos: descontoCliente,
      valorComissaoCentavos: comissaoCentavos,
      valorFinalCentavos,
      baseCalculoComissao: 'valor_original',
      status: 'CONCLUIDO',
      fechamentoId: null,
      criadoEm: agora,
      concluidoEm: agora,
    });
    // O cupom se encerra aqui: expira no ato e não pode ser apresentado de
    // novo — para um novo atendimento, a usuária gera outro cupom.
    tx.update(voucherRef, { status: 'CONCLUIDO', resgateId: resgateRef.id, concluidoEm: agora, expiraEm: agora });

    return { usuarioId: v.usuarioId, descontoTotal, descontoCliente, comissaoCentavos, valorFinalCentavos };
  });

  await registrarAuditoriaBeneficio('REDEMPTION_COMPLETED', 'resgate', resgateRef.id, {
    perfil: 'parceiro', voucherId: tokenSeguro,
    valorNovo: { valorOriginalCentavos, comissaoCentavos: resultado.comissaoCentavos },
  });

  // Avisa a usuária pelo canal editorial já existente no app — pede a
  // confirmação de que o atendimento realmente aconteceu.
  await db.collection('notificacoesEditoriais').add({
    usuarioId: resultado.usuarioId,
    tipo: 'confirmar_resgate',
    texto: 'Um parceiro registrou o uso do seu benefício. Toque para confirmar se o atendimento aconteceu.',
    resgateId: resgateRef.id,
    ativa: true,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    valorOriginal: reais(valorOriginalCentavos),
    valorDesconto: reais(resultado.descontoCliente),
    valorFinal: reais(resultado.valorFinalCentavos),
    comissao: reais(resultado.comissaoCentavos),
  };
});

// ---- 4) Usuária confirma ou contesta ---------------------------------------
exports.responderConfirmacaoResgate = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login.');

  const resgateId = String(request.data?.resgateId || '');
  const confirmar = request.data?.confirmar === true;
  if (!resgateId) throw new HttpsError('invalid-argument', 'Resgate inválido.');

  const resgateRef = db.collection('resgates').doc(resgateId);
  let dadosResgate = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(resgateRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Registro não encontrado.');
    const r = snap.data();
    if (r.usuarioId !== uid) throw new HttpsError('permission-denied', 'Este registro não pertence a você.');
    if (r.status !== 'CONCLUIDO') throw new HttpsError('failed-precondition', 'Este registro já foi respondido.');
    dadosResgate = r;

    const agora = admin.firestore.FieldValue.serverTimestamp();
    if (confirmar) {
      tx.update(resgateRef, { status: 'CONFIRMADO_USUARIO', confirmadoEm: agora });
      tx.update(db.collection('vouchers').doc(r.voucherId), { status: 'CONFIRMADO_USUARIO', confirmadoEm: agora });
    } else {
      tx.update(resgateRef, { status: 'CONTESTADO', contestadoEm: agora });
      tx.update(db.collection('vouchers').doc(r.voucherId), { status: 'CONTESTADO', contestadoEm: agora });
    }
  });

  await registrarAuditoriaBeneficio(confirmar ? 'USER_CONFIRMED' : 'USER_CONTESTED', 'resgate', resgateId, {
    usuarioId: uid, perfil: 'usuaria',
  });

  // Cashback: atendimento confirmado gera crédito sobre o valor original.
  let cashbackCentavos = 0;
  if (confirmar && dadosResgate) {
    try {
      const cfg = await configCashback();
      // Cada parceria pode ter o cashback desligado ou um percentual próprio.
      let cbParceria = null;
      if (dadosResgate.parceriaId) {
        try { cbParceria = (await db.collection('parcerias').doc(String(dadosResgate.parceriaId)).get()).data()?.cashback || null; } catch { /* usa o geral */ }
      }
      const pct = Number.isFinite(Number(cbParceria?.percentual)) && cbParceria?.percentual !== null
        ? Math.max(0, Math.min(50, Number(cbParceria.percentual))) : cfg.percentual;
      const valor = Math.floor((dadosResgate.valorOriginalCentavos || 0) * (pct / 100));
      if (cfg.ativo && cbParceria?.ativo !== false && valor >= 1) {
        const criado = await creditarCashback(uid, valor, {
          origem: 'cupom',
          descricao: `Cupom ${dadosResgate.parceriaNome || 'de parceria'}`,
          referencia: resgateId,
          idDoc: `cupom_${resgateId}`,
        }, cfg);
        if (criado) cashbackCentavos = valor;
      }
    } catch (e) {
      console.error('[cashback] não foi possível creditar', resgateId, e);
    }
  }

  return { ok: true, cashback: reais(cashbackCentavos) };
});

// ---- 5) Job periódico: expira vouchers vencidos e libera resgates para
//         liquidação depois da janela de contestação -----------------------
exports.processarBeneficiosPendentes = onSchedule({ schedule: 'every 60 minutes', timeZone: TIMEZONE }, async () => {
  const agora = Date.now();

  const vencidosSnap = await db.collection('vouchers')
    .where('status', 'in', ['GERADO', 'APRESENTADO', 'VALIDADO'])
    .where('expiraEm', '<', admin.firestore.Timestamp.fromMillis(agora))
    .get();
  for (const doc of vencidosSnap.docs) {
    await doc.ref.update({ status: 'EXPIRADO' });
  }

  const limiteJanela = admin.firestore.Timestamp.fromMillis(agora - JANELA_CONTESTACAO_HORAS * 3600000);
  const elegiveisSnap = await db.collection('resgates')
    .where('status', '==', 'CONFIRMADO_USUARIO')
    .where('confirmadoEm', '<', limiteJanela)
    .get();
  for (const doc of elegiveisSnap.docs) {
    await doc.ref.update({ status: 'ELEGIVEL_LIQUIDACAO' });
  }
});

// ---- 6) Admin fecha um período de uma parceria (settlement) ----------------
exports.fecharPeriodoParceria = onCall(async (request) => {
  const adminUid = await exigirAdmin(request);
  const parceriaId = String(request.data?.parceriaId || '');
  if (!parceriaId) throw new HttpsError('invalid-argument', 'Parceria inválida.');

  let query = db.collection('resgates')
    .where('parceriaId', '==', parceriaId)
    .where('status', '==', 'ELEGIVEL_LIQUIDACAO');

  const periodoInicioMs = request.data?.periodoInicio ? Date.parse(request.data.periodoInicio) : null;
  const periodoFimMs = request.data?.periodoFim ? Date.parse(request.data.periodoFim) : null;

  const snap = await query.get();
  const itens = snap.docs.filter(d => {
    const t = d.data().concluidoEm?.toMillis?.() ?? 0;
    if (periodoInicioMs != null && t < periodoInicioMs) return false;
    if (periodoFimMs != null && t > periodoFimMs) return false;
    return true;
  });

  if (itens.length === 0) throw new HttpsError('failed-precondition', 'Não há utilizações elegíveis para fechar neste período.');

  const totais = itens.reduce((acc, d) => {
    const r = d.data();
    acc.original += r.valorOriginalCentavos || 0;
    acc.desconto += r.valorDescontoCentavos || 0;
    acc.comissao += r.valorComissaoCentavos || 0;
    return acc;
  }, { original: 0, desconto: 0, comissao: 0 });

  const fechamentoRef = db.collection('fechamentos').doc();
  const agora = admin.firestore.FieldValue.serverTimestamp();

  const batch = db.batch();
  batch.set(fechamentoRef, {
    parceriaId,
    periodoInicio: periodoInicioMs ? admin.firestore.Timestamp.fromMillis(periodoInicioMs) : null,
    periodoFim: periodoFimMs ? admin.firestore.Timestamp.fromMillis(periodoFimMs) : null,
    totalResgates: itens.length,
    valorOriginalTotalCentavos: totais.original,
    valorDescontoTotalCentavos: totais.desconto,
    valorComissaoTotalCentavos: totais.comissao,
    status: 'ABERTO',
    geradoEm: agora,
    geradoPor: adminUid,
  });
  for (const d of itens) {
    batch.update(d.ref, { status: 'AGUARDANDO_PAGAMENTO', fechamentoId: fechamentoRef.id });
  }
  await batch.commit();

  await registrarAuditoriaBeneficio('SETTLEMENT_CREATED', 'fechamento', fechamentoRef.id, {
    usuarioId: adminUid, perfil: 'admin', parceriaId,
    valorNovo: { totalResgates: itens.length, comissaoCentavos: totais.comissao },
  });

  return { fechamentoId: fechamentoRef.id, totalResgates: itens.length, comissao: reais(totais.comissao) };
});

// ---- 7) Admin registra que o parceiro pagou o fechamento -------------------
exports.registrarPagamentoFechamento = onCall(async (request) => {
  const adminUid = await exigirAdmin(request);
  const fechamentoId = String(request.data?.fechamentoId || '');
  if (!fechamentoId) throw new HttpsError('invalid-argument', 'Fechamento inválido.');

  const fechamentoRef = db.collection('fechamentos').doc(fechamentoId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(fechamentoRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Fechamento não encontrado.');
    if (snap.data().status === 'PAGO') throw new HttpsError('failed-precondition', 'Este fechamento já está marcado como pago.');

    const agora = admin.firestore.FieldValue.serverTimestamp();
    tx.update(fechamentoRef, {
      status: 'PAGO',
      pagoEm: agora,
      metodoPagamento: request.data?.metodoPagamento || '',
      referenciaPagamento: request.data?.referencia || '',
      observacaoPagamento: request.data?.observacao || '',
      registradoPor: adminUid,
    });

    const resgatesSnap = await tx.get(db.collection('resgates').where('fechamentoId', '==', fechamentoId));
    resgatesSnap.forEach(d => tx.update(d.ref, { status: 'LIQUIDADO', liquidadoEm: agora }));
  });

  await registrarAuditoriaBeneficio('SETTLEMENT_PAID', 'fechamento', fechamentoId, { usuarioId: adminUid, perfil: 'admin' });
  return { ok: true };
});

// ---- 8) Extrato do parceiro (sem login — token de painel próprio) ----------
exports.consultarExtratoParceiro = onCall(async (request) => {
  const tokenPainel = String(request.data?.tokenPainel || '');
  if (!tokenPainel) throw new HttpsError('invalid-argument', 'Token inválido.');

  const parceriaSnap = await db.collection('parcerias').where('tokenPainel', '==', tokenPainel).limit(1).get();
  if (parceriaSnap.empty) throw new HttpsError('not-found', 'Painel não encontrado.');
  const parceriaDoc = parceriaSnap.docs[0];

  const resgatesSnap = await db.collection('resgates')
    .where('parceriaId', '==', parceriaDoc.id)
    .orderBy('criadoEm', 'desc')
    .limit(100)
    .get();

  const itens = resgatesSnap.docs.map(d => {
    const r = d.data();
    return {
      codigoPublico: r.codigoPublico,
      valorOriginal: reais(r.valorOriginalCentavos || 0),
      valorFinal: reais(r.valorFinalCentavos || 0),
      comissao: reais(r.valorComissaoCentavos || 0),
      status: r.status,
      data: r.criadoEm?.toMillis?.() || null,
    };
  });

  const pendente = itens.filter(i => ['CONCLUIDO', 'CONFIRMADO_USUARIO', 'ELEGIVEL_LIQUIDACAO', 'AGUARDANDO_PAGAMENTO'].includes(i.status));
  const totalPendente = pendente.reduce((acc, i) => acc + i.comissao, 0);

  return {
    parceriaNome: parceriaDoc.data().titulo || '',
    itens,
    totalComissaoPendente: totalPendente,
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// CASHBACK
// Carteira de créditos de cada usuária, em `cashback/{id}` (coleção própria,
// que só o servidor grava; a usuária apenas lê os seus). Cada crédito vale
// por um prazo (padrão 6 meses) e é consumido do mais antigo para o mais
// novo. Valores sempre em centavos.
//   credito: { usuarioId, tipo: 'credito', origem: 'cupom'|'manual', descricao,
//              valorCentavos, saldoCentavos, criadoEm, expiraEm, referencia }
//   uso:     { usuarioId, tipo: 'uso', valorCentavos, descricao, referencia, creditos }
//   estorno: { usuarioId, tipo: 'estorno', valorCentavos, descricao, referencia }
// ═══════════════════════════════════════════════════════════════════════════

const CASHBACK_PADRAO = { ativo: true, percentual: 1, validadeMeses: 6, limitePercentual: 100 };

async function configCashback() {
  try {
    const snap = await db.collection('configuracoes').doc('cashback').get();
    const c = snap.data() || {};
    return {
      ativo: c.ativo !== false,
      percentual: Number.isFinite(Number(c.percentual)) ? Math.max(0, Math.min(50, Number(c.percentual))) : CASHBACK_PADRAO.percentual,
      validadeMeses: Number.isFinite(Number(c.validadeMeses)) && Number(c.validadeMeses) > 0 ? Math.min(24, Math.round(Number(c.validadeMeses))) : CASHBACK_PADRAO.validadeMeses,
      limitePercentual: Number.isFinite(Number(c.limitePercentual)) ? Math.max(1, Math.min(100, Number(c.limitePercentual))) : CASHBACK_PADRAO.limitePercentual,
    };
  } catch {
    return { ...CASHBACK_PADRAO };
  }
}

function dataMaisMeses(meses) {
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  return admin.firestore.Timestamp.fromDate(d);
}

// Créditos com saldo e ainda válidos, do que vence primeiro para o último.
async function creditosDisponiveis(uid) {
  const snap = await db.collection('cashback').where('usuarioId', '==', uid).where('tipo', '==', 'credito').get();
  const agora = Date.now();
  return snap.docs
    .map(d => ({ ref: d.ref, id: d.id, ...d.data() }))
    .filter(c => (c.saldoCentavos || 0) > 0 && !c.estornado && (c.expiraEm?.toMillis?.() || 0) > agora)
    .sort((a, b) => a.expiraEm.toMillis() - b.expiraEm.toMillis());
}

async function saldoCashbackCentavos(uid) {
  return (await creditosDisponiveis(uid)).reduce((s, c) => s + c.saldoCentavos, 0);
}

// Cria um crédito (id fixo opcional, para não duplicar).
async function creditarCashback(uid, valorCentavos, { origem, descricao, referencia, idDoc }, cfg) {
  if (!uid || !(valorCentavos > 0)) return null;
  const ref = idDoc ? db.collection('cashback').doc(idDoc) : db.collection('cashback').doc();
  const criado = await db.runTransaction(async (tx) => {
    const existente = await tx.get(ref);
    if (existente.exists) return false;
    tx.set(ref, {
      usuarioId: uid, tipo: 'credito', origem, descricao, referencia: referencia || null,
      valorCentavos, saldoCentavos: valorCentavos,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      expiraEm: dataMaisMeses(cfg.validadeMeses),
    });
    return true;
  });
  if (criado) {
    await db.collection('notificacoesEditoriais').add({
      usuarioId: uid, tipo: 'cashback',
      // Sem valor no texto: esta coleção é lida pelo app de todas as usuárias.
      texto: 'Você ganhou cashback! Toque para ver seu saldo e usar no seu plano.',
      screen: 'Cashback', ativa: true, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return criado;
}

// Consome `valorCentavos` dos créditos (mais antigos primeiro). Idempotente
// pela referência (ex.: id da sessão do Stripe).
async function debitarCashback(uid, valorCentavos, { descricao, referencia }) {
  if (!uid || !(valorCentavos > 0) || !referencia) return 0;
  const usoRef = db.collection('cashback').doc(`uso_${referencia}`);
  const creditos = await creditosDisponiveis(uid);
  return db.runTransaction(async (tx) => {
    const ja = await tx.get(usoRef);
    if (ja.exists) return 0;
    const atuais = await Promise.all(creditos.map(c => tx.get(c.ref)));
    let falta = valorCentavos;
    const usados = [];
    atuais.forEach((snap) => {
      if (falta <= 0 || !snap.exists) return;
      const saldo = snap.data().saldoCentavos || 0;
      if (saldo <= 0) return;
      const tirar = Math.min(saldo, falta);
      tx.update(snap.ref, { saldoCentavos: saldo - tirar });
      usados.push({ id: snap.id, valorCentavos: tirar });
      falta -= tirar;
    });
    const debitado = valorCentavos - falta;
    tx.set(usoRef, {
      usuarioId: uid, tipo: 'uso', valorCentavos: debitado, descricao, referencia, creditos: usados,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    return debitado;
  });
}

// Desconto de cashback para uma cobrança: cupom de uso único no Stripe. Deixa
// sempre pelo menos R$ 1,00 a pagar (o Stripe não aceita cobranças zeradas
// em pagamentos avulsos) e respeita o limite configurado.
async function descontoCashback(stripe, uid, valorCentavos) {
  const cfg = await configCashback();
  if (!cfg.ativo) return null;
  const saldo = await saldoCashbackCentavos(uid);
  const limite = Math.floor(valorCentavos * (cfg.limitePercentual / 100));
  const desconto = Math.min(saldo, limite, valorCentavos - 100);
  if (!(desconto >= 50)) return null;
  const cupom = await stripe.coupons.create({
    amount_off: desconto, currency: 'brl', duration: 'once', max_redemptions: 1, name: 'Cashback Atravessia',
  });
  return { cupomId: cupom.id, desconto };
}

exports.concederCashbackAdmin = onCall(async (request) => {
  const adminUid = await exigirAdmin(request);
  const email = String(request.data?.email || '').trim().toLowerCase();
  const valor = centavos(request.data?.valor);
  const motivo = String(request.data?.motivo || '').trim().slice(0, 140) || 'Crédito concedido pela Atravessia';
  if (!email) throw new HttpsError('invalid-argument', 'Informe o e-mail da usuária.');
  if (!valor || valor < 100) throw new HttpsError('invalid-argument', 'Informe um valor a partir de R$ 1,00.');
  if (valor > 50000) throw new HttpsError('invalid-argument', 'Valor acima do limite de R$ 500,00 por crédito.');
  const digitado = String(request.data?.email || '').trim();
  let snap = await db.collection('usuarios').where('email', '==', email).limit(1).get();
  if (snap.empty && digitado !== email) snap = await db.collection('usuarios').where('email', '==', digitado).limit(1).get();
  if (snap.empty) throw new HttpsError('not-found', 'Nenhuma usuária encontrada com esse e-mail.');
  const uid = snap.docs[0].id;
  const cfg = await configCashback();
  await creditarCashback(uid, valor, { origem: 'manual', descricao: motivo, referencia: `admin:${adminUid}` }, cfg);
  return { ok: true, nome: snap.docs[0].data().nome || email };
});

exports.estornarCashbackAdmin = onCall(async (request) => {
  await exigirAdmin(request);
  const creditoId = String(request.data?.creditoId || '');
  const motivo = String(request.data?.motivo || '').trim().slice(0, 140) || 'Crédito estornado';
  if (!creditoId) throw new HttpsError('invalid-argument', 'Crédito não informado.');
  const ref = db.collection('cashback').doc(creditoId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().tipo !== 'credito') throw new HttpsError('not-found', 'Crédito não encontrado.');
    const c = snap.data();
    if (c.estornado) throw new HttpsError('failed-precondition', 'Este crédito já foi estornado.');
    tx.update(ref, { estornado: true, saldoCentavos: 0, estornadoEm: admin.firestore.FieldValue.serverTimestamp() });
    tx.set(db.collection('cashback').doc(), {
      usuarioId: c.usuarioId, tipo: 'estorno', valorCentavos: c.saldoCentavos || 0, descricao: motivo,
      referencia: creditoId, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

// Todo dia às 10h30: avisa quem tem crédito vencendo daqui a 30 dias.
exports.avisarCashbackAVencer = onSchedule({ schedule: '30 10 * * *', timeZone: TIMEZONE }, async () => {
  const de = admin.firestore.Timestamp.fromMillis(Date.now() + 29 * 86400000);
  const ate = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 86400000);
  const snap = await db.collection('cashback').where('expiraEm', '>=', de).where('expiraEm', '<', ate).get();
  const porUsuaria = {};
  snap.docs.forEach(d => {
    const c = d.data();
    if (c.tipo !== 'credito' || c.estornado || !(c.saldoCentavos > 0)) return;
    porUsuaria[c.usuarioId] = (porUsuaria[c.usuarioId] || 0) + c.saldoCentavos;
  });
  for (const uid of Object.keys(porUsuaria)) {
    await db.collection('notificacoesEditoriais').add({
      usuarioId: uid, tipo: 'cashback',
      texto: 'Parte do seu cashback vence em 30 dias. Toque para ver e usar no seu plano.',
      screen: 'Cashback', ativa: true, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLIQUES (parcerias e indicações)
// O app não pode escrever nesses documentos (só as administradoras), então o
// contador de cliques é atualizado aqui. Antes, a tentativa direta falhava em
// silêncio e os cliques das parcerias não eram contados.
// ═══════════════════════════════════════════════════════════════════════════
exports.registrarClique = onCall(async (request) => {
  if (!request.auth?.uid) return { ok: false };
  const tipo = request.data?.tipo === 'indicacao' ? 'indicacoes' : 'parcerias';
  const id = String(request.data?.id || '');
  if (!id || id.includes('/')) return { ok: false };
  const ref = db.collection(tipo).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false };
  await ref.update({ cliques: admin.firestore.FieldValue.increment(1) });
  return { ok: true };
});

// ═══════════════════════════════════════════════════════════════════════════
// ATRAVESSIA ARTES — gerador de artes por IA para as administradoras
//
// Fluxo: o painel (web ou app) chama `gerarArte` com a descrição, o formato e
// o estilo. Aqui o pedido ganha o "prompt de marca" da Atravessia, segue para
// o provedor escolhido (OpenAI/DALL·E ou Google/Nano Banana), cada imagem é
// salva no Storage em artes/{id}.png e registrada na coleção `artes`.
//
// Configuração (documento configuracoes/artes, editado no painel):
//   { provedor: 'openai' | 'gemini', ativo: true|false,
//     modeloOpenai?: 'gpt-image-1' | 'dall-e-3', qualidade?: 'low'|'medium'|'high' }
//
// CHAVES DE API — ainda não existem. Por isso as chaves são lidas de
// process.env (sem defineSecret): um secret declarado e inexistente faz o
// deploy inteiro falhar. Quando a chave existir (ver docs/atravessia-artes.md):
//   1) firebase functions:secrets:set OPENAI_API_KEY   (ou GEMINI_API_KEY)
//   2) troque as duas linhas de CHAVES_ARTES abaixo por:
//        const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
//        const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
//        const CHAVES_ARTES = {
//          openai: () => OPENAI_API_KEY.value(),
//          gemini: () => GEMINI_API_KEY.value(),
//        };
//      (declare só o secret que foi criado; o outro continua via process.env)
//   3) em OPCOES_ARTES, acrescente: secrets: [OPENAI_API_KEY] (e/ou GEMINI_API_KEY),
//      e passe os mesmos secrets para statusGeradorArtes:
//        exports.statusGeradorArtes = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
// ═══════════════════════════════════════════════════════════════════════════

const CHAVES_ARTES = {
  openai: () => process.env.OPENAI_API_KEY || '',
  gemini: () => process.env.GEMINI_API_KEY || '',
};

// Gerar até 4 imagens em alta qualidade pode levar mais de um minuto.
const OPCOES_ARTES = { timeoutSeconds: 300, memory: '1GiB' };

const MSG_NAO_CONECTADO = 'O gerador de artes ainda não foi conectado a um serviço de IA. '
  + 'Assim que a chave da API for configurada no servidor, ele passa a funcionar. '
  + 'Enquanto isso, a galeria continua disponível.';

// Identidade visual da Atravessia — entra em TODA arte gerada.
const PROMPT_MARCA = [
  'Arte para a Atravessia, um aplicativo brasileiro de acolhimento ao luto.',
  'Sensação: delicadeza, calma, cuidado, esperança serena e presença afetuosa.',
  'Luz suave e difusa, composição limpa e arejada, com espaço livre para respirar.',
  'Evite imagens tristes, pesadas, sombrias ou dramáticas: nada de cemitérios, caixões, velas de velório, lágrimas, pessoas chorando, cenas hospitalares ou escuridão.',
  'Não escreva nenhum texto, letra, número, logotipo ou marca d\'água na imagem.',
].join(' ');

const PROMPT_PALETA = 'Paleta da marca: lavanda e lilás suaves (#8B7AC0, #C3B5EC, #ECE6FA), '
  + 'pêssego claro (#F2B9A0, #FCE7DC), verde-sálvia (#9EC4AB, #E1EEE5) e fundo porcelana quente (#F6F1EE), '
  + 'em tons pastel, com aspecto de aquarela suave.';

// Presets de estilo (o painel mostra nome e descrição; o texto vai ao modelo).
const ESTILOS_ARTE = {
  aquarela: {
    nome: 'Aquarela lavanda',
    prompt: 'Estilo aquarela suave sobre papel texturizado, manchas delicadas de lavanda e lilás que se dissolvem nas bordas, pinceladas leves e transparentes.',
  },
  botanico: {
    nome: 'Botânico realista',
    prompt: 'Ilustração botânica realista e delicada: folhas de ginkgo, lavanda, ramos e flores do campo, detalhes finos, luz natural suave, fundo claro e limpo.',
  },
  minimalista: {
    nome: 'Minimalista suave',
    prompt: 'Composição minimalista com formas orgânicas simples, muito espaço vazio, degradês sutis e poucos elementos, elegante e silenciosa.',
  },
  fotografia: {
    nome: 'Fotografia acolhedora',
    prompt: 'Fotografia acolhedora com luz natural de fim de tarde, foco suave e profundidade de campo rasa, cenas do cotidiano que transmitem conforto (xícara de chá, janela com cortina leve, mãos segurando flores, jardim sereno).',
  },
  afetiva: {
    nome: 'Ilustração afetiva',
    prompt: 'Ilustração afetiva em traço delicado, cores pastel, personagens sem rosto detalhado e sem gênero definido, gestos de carinho e companhia, clima de colo e acolhimento.',
  },
};

// Formatos e o tamanho que cada provedor sabe gerar. Os modelos não fazem
// todas as proporções: o mais próximo de cada uma está indicado.
const FORMATOS_ARTE = {
  post: {
    nome: 'Post (quadrado)', descricao: 'imagem quadrada para feed',
    openai: '1024x1024', dalle3: '1024x1024', gemini: '1:1',
  },
  story: {
    nome: 'Story (vertical)', descricao: 'imagem vertical de tela cheia para stories e status',
    openai: '1024x1536', dalle3: '1024x1792', gemini: '9:16',
  },
  banner: {
    nome: 'Banner (faixa larga)', descricao: 'faixa horizontal larga para topo de site, e-mail ou capa',
    openai: '1536x1024', dalle3: '1792x1024', gemini: '21:9',
  },
  paisagem: {
    nome: 'Paisagem (horizontal)', descricao: 'imagem horizontal',
    openai: '1536x1024', dalle3: '1792x1024', gemini: '16:9',
  },
};

async function lerConfigArtes() {
  try {
    const snap = await db.collection('configuracoes').doc('artes').get();
    return snap.data() || {};
  } catch {
    return {};
  }
}

function montarPromptArte({ prompt, formato, estilo, usarPaletaMarca }) {
  const partes = [PROMPT_MARCA];
  if (usarPaletaMarca) partes.push(PROMPT_PALETA);
  const est = ESTILOS_ARTE[estilo];
  if (est) partes.push(est.prompt);
  partes.push(`Formato: ${FORMATOS_ARTE[formato].descricao}.`);
  partes.push(`Pedido da equipe: ${prompt}`);
  return partes.join('\n');
}

// Converte a resposta de erro do provedor numa mensagem acolhedora.
function erroDoProvedor(nomeProvedor, status, corpo) {
  console.error(`[gerarArte] ${nomeProvedor} respondeu ${status}:`, String(corpo).slice(0, 2000));
  if (status === 401 || status === 403) {
    return new HttpsError('failed-precondition', `A chave da API do ${nomeProvedor} foi recusada. Confira a chave configurada no servidor.`);
  }
  if (status === 429) {
    return new HttpsError('resource-exhausted', `O ${nomeProvedor} está com muitos pedidos ou sem créditos no momento. Tente de novo em alguns minutos.`);
  }
  if (status === 400 && /safety|policy|blocked|moderation/i.test(String(corpo))) {
    return new HttpsError('invalid-argument', 'O filtro de segurança do serviço não aceitou essa descrição. Tente descrevê-la de outro jeito.');
  }
  return new HttpsError('unavailable', `O ${nomeProvedor} não conseguiu gerar a arte agora. Tente de novo em instantes.`);
}

// ---- Adaptadores de provedor ------------------------------------------------
// Cada adaptador recebe { promptFinal, formato, quantidade, config, chave } e
// devolve [{ buffer, mimeType, tamanho }].

const PROVEDORES_ARTE = {
  // OpenAI Images API — gpt-image-1 (padrão) ou dall-e-3.
  openai: {
    nome: 'DALL·E (OpenAI)',
    async gerar({ promptFinal, formato, quantidade, config, chave }) {
      const modelo = config.modeloOpenai === 'dall-e-3' ? 'dall-e-3' : 'gpt-image-1';
      const tamanho = modelo === 'dall-e-3' ? FORMATOS_ARTE[formato].dalle3 : FORMATOS_ARTE[formato].openai;
      const pedir = async (n) => {
        const corpo = { model: modelo, prompt: promptFinal, n, size: tamanho };
        if (modelo === 'dall-e-3') {
          corpo.response_format = 'b64_json';
          corpo.quality = config.qualidade === 'high' ? 'hd' : 'standard';
        } else {
          // gpt-image-1 sempre devolve b64_json; qualidade: low | medium | high.
          corpo.quality = ['low', 'medium', 'high'].includes(config.qualidade) ? config.qualidade : 'medium';
        }
        const resp = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${chave}` },
          body: JSON.stringify(corpo),
        });
        const texto = await resp.text();
        if (!resp.ok) throw erroDoProvedor('DALL·E (OpenAI)', resp.status, texto);
        const json = JSON.parse(texto);
        return (json.data || [])
          .filter(d => d.b64_json)
          .map(d => ({ buffer: Buffer.from(d.b64_json, 'base64'), mimeType: 'image/png', tamanho, modelo }));
      };
      // dall-e-3 só aceita n = 1: faz um pedido por imagem.
      if (modelo === 'dall-e-3') {
        const lotes = await Promise.all(Array.from({ length: quantidade }, () => pedir(1)));
        return lotes.flat();
      }
      return pedir(quantidade);
    },
  },

  // Google Gemini 2.5 Flash Image ("Nano Banana") — uma imagem por pedido.
  gemini: {
    nome: 'Nano Banana (Google)',
    async gerar({ promptFinal, formato, quantidade, chave }) {
      const modelo = 'gemini-2.5-flash-image';
      const proporcao = FORMATOS_ARTE[formato].gemini;
      const pedir = async () => {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: promptFinal }] }],
              generationConfig: {
                responseModalities: ['IMAGE'],
                imageConfig: { aspectRatio: proporcao },
              },
            }),
          },
        );
        const texto = await resp.text();
        if (!resp.ok) throw erroDoProvedor('Nano Banana (Google)', resp.status, texto);
        const json = JSON.parse(texto);
        const partes = json.candidates?.[0]?.content?.parts || [];
        const img = partes.find(p => p.inlineData?.data || p.inline_data?.data);
        if (!img) {
          // Sem imagem = o modelo recusou (filtro de segurança) ou só devolveu texto.
          throw erroDoProvedor('Nano Banana (Google)', 400, `sem imagem (safety?): ${texto}`);
        }
        const dados = img.inlineData || img.inline_data;
        return {
          buffer: Buffer.from(dados.data, 'base64'),
          mimeType: dados.mimeType || dados.mime_type || 'image/png',
          tamanho: proporcao,
          modelo,
        };
      };
      return Promise.all(Array.from({ length: quantidade }, () => pedir()));
    },
  },
};

// Salva a imagem no Storage com um token de download (URL estável, que abre
// no app e no painel sem depender das regras) e devolve { url, caminho }.
async function salvarImagemArte(id, { buffer, mimeType }) {
  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
  const caminho = `artes/${id}.${ext}`;
  const bucket = admin.storage().bucket();
  const token = crypto.randomUUID();
  await bucket.file(caminho).save(buffer, {
    resumable: false,
    metadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}`;
  return { url, caminho };
}

// Diz ao painel se o gerador está pronto (sem revelar as chaves).
exports.statusGeradorArtes = onCall(async (request) => {
  await exigirAdmin(request);
  const config = await lerConfigArtes();
  const provedor = config.provedor === 'gemini' ? 'gemini' : 'openai';
  const conectados = {
    openai: !!CHAVES_ARTES.openai(),
    gemini: !!CHAVES_ARTES.gemini(),
  };
  return {
    provedor,
    ativo: config.ativo !== false,
    conectados,
    pronto: config.ativo !== false && conectados[provedor],
  };
});

exports.gerarArte = onCall(OPCOES_ARTES, async (request) => {
  const adminUid = await exigirAdmin(request);
  const dados = request.data || {};

  const prompt = String(dados.prompt || '').trim().slice(0, 1200);
  if (prompt.length < 3) throw new HttpsError('invalid-argument', 'Descreva a arte que você quer criar.');
  const formato = FORMATOS_ARTE[dados.formato] ? dados.formato : 'post';
  const estilo = ESTILOS_ARTE[dados.estilo] ? dados.estilo : 'aquarela';
  const usarPaletaMarca = dados.usarPaletaMarca !== false;
  const quantidade = Math.min(4, Math.max(1, Math.round(Number(dados.quantidade) || 1)));

  const config = await lerConfigArtes();
  if (config.ativo === false) {
    throw new HttpsError('failed-precondition', 'O gerador de artes está desligado no momento. Ele pode ser ligado na configuração da tela Atravessia Artes.');
  }
  const provedorId = ['openai', 'gemini'].includes(dados.provedor)
    ? dados.provedor
    : (config.provedor === 'gemini' ? 'gemini' : 'openai');
  const provedor = PROVEDORES_ARTE[provedorId];
  const chave = CHAVES_ARTES[provedorId]();
  if (!chave) throw new HttpsError('failed-precondition', MSG_NAO_CONECTADO);

  const promptFinal = montarPromptArte({ prompt, formato, estilo, usarPaletaMarca });

  let imagens;
  try {
    imagens = await provedor.gerar({ promptFinal, formato, quantidade, config, chave });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[gerarArte] falha inesperada:', e);
    throw new HttpsError('unavailable', 'Não foi possível gerar a arte agora. Tente de novo em instantes.');
  }
  if (!imagens?.length) throw new HttpsError('unavailable', 'O serviço não devolveu nenhuma imagem. Tente de novo.');

  const artes = [];
  for (const img of imagens) {
    const ref = db.collection('artes').doc();
    const { url, caminho } = await salvarImagemArte(ref.id, img);
    const doc = {
      prompt, promptFinal, formato, estilo, usarPaletaMarca,
      provedor: provedorId, modelo: img.modelo || null, tamanho: img.tamanho || null,
      url, caminho,
      criadoPor: adminUid,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      favorita: false,
    };
    await ref.set(doc);
    artes.push({ id: ref.id, ...doc, criadoEm: Date.now() });
  }
  return { artes };
});

// Exclui a arte: arquivo no Storage + documento.
exports.excluirArte = onCall(async (request) => {
  await exigirAdmin(request);
  const id = String(request.data?.id || '');
  if (!id || id.includes('/')) throw new HttpsError('invalid-argument', 'Arte não informada.');
  const ref = db.collection('artes').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  const caminho = snap.data().caminho;
  if (caminho && String(caminho).startsWith('artes/')) {
    await admin.storage().bucket().file(caminho).delete({ ignoreNotFound: true }).catch(() => {});
  }
  await ref.delete();
  return { ok: true };
});
