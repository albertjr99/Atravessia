const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();

const TIMEZONE = 'America/Sao_Paulo';
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // não enviar mais de 1 notificação automática a cada 6h

// Envia uma notificação push via Expo Push API para um conjunto de tokens.
async function enviarPush(mensagens) {
  if (mensagens.length === 0) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(mensagens),
  }).catch(() => {});
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

// Preços em centavos (BRL), espelhando src/data/index.js -> planos
const PLANOS = {
  1: { nome: 'O Amor que Fica — Plano 1 (Acolher)', valor: 2990 },
  2: { nome: 'O Amor que Fica — Plano 2 (Compreender)', valor: 4990 },
  3: { nome: 'O Amor que Fica — Plano 3 (Evoluir)', valor: 8990 },
};

async function getOrCreateCustomer(stripe, uid, userData) {
  if (userData.stripeCustomerId) return userData.stripeCustomerId;
  const customer = await stripe.customers.create({
    email: userData.email,
    metadata: { uid },
  });
  await db.collection('usuarios').doc(uid).update({ stripeCustomerId: customer.id });
  return customer.id;
}

exports.criarSessaoCheckout = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para assinar um plano.');

  const planoId = Number(request.data?.planoId);
  const plano = PLANOS[planoId];
  if (!plano) throw new HttpsError('invalid-argument', 'Plano inválido.');

  const stripe = Stripe(STRIPE_SECRET_KEY.value());
  const userRef = db.collection('usuarios').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};

  const customerId = await getOrCreateCustomer(stripe, uid, userData);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    locale: 'pt-BR',
    submit_type: 'subscribe',
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: { name: plano.nome },
        unit_amount: plano.valor,
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    success_url: request.data?.successUrl || 'https://oamorquefica.app/checkout-sucesso',
    cancel_url: request.data?.cancelUrl || 'https://oamorquefica.app/checkout-cancelado',
    metadata: { uid, planoId: String(planoId) },
    subscription_data: { metadata: { uid, planoId: String(planoId) } },
    custom_text: {
      submit: { message: 'Você poderá cancelar quando quiser, direto no app.' },
    },
  });

  return { url: session.url };
});

exports.cancelarAssinatura = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
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
      await definirPlano(session.metadata?.uid, Number(session.metadata?.planoId), {
        stripeSubscriptionId: session.subscription,
        stripeCustomerId: session.customer,
      });
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
    mensagensPush.push({ to: dados.pushToken, title: 'O Amor que Fica', body: MENSAGENS_INATIVIDADE[nivel] });
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

    mensagensPush.push({ to: dados.pushToken, title: 'O Amor que Fica', body: texto });
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

    mensagensPush.push({ to: dados.pushToken, title: 'O Amor que Fica', body: 'Sua retrospectiva emocional da semana está pronta.' });
  }

  await enviarPush(mensagensPush);
});

// Ao registrar um novo check-in, libera a próxima escalada de aviso de inatividade
// (sem isso, quem voltou a usar o app uma vez nunca mais receberia o aviso de 7/14 dias).
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

    mensagensPush.push({ to: dados.pushToken, title: 'O Amor que Fica', body: 'Sua jornada está esperando por você. Quando se sentir pronta, continue de onde parou.' });
  }

  await enviarPush(mensagensPush);
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

    mensagensPush.push({ to: dados.pushToken, title: 'O Amor que Fica', body: 'Seu relatório emocional do mês está pronto.' });
  }

  await enviarPush(mensagensPush);
});
