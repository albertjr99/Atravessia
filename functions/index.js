const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();

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
