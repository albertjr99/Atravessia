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
      } else if (session.metadata?.tipo === 'curso') {
        // Cursos Atravessia: matrícula + acesso (ver seção CURSOS no fim do arquivo).
        await processarCompraCurso(stripe, session);
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
    // Cursos: pagamento confirmado depois (ex.: boleto) e reembolso.
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      if (session.metadata?.tipo === 'curso') await processarCompraCurso(stripe, session);
      break;
    }
    case 'charge.refunded': {
      await processarReembolsoCurso(event.data.object);
      break;
    }
  }

  res.json({ received: true });
});

// ---- Notificações automáticas agendadas (tabela de notificações da documentação) ----

const MENSAGENS_INATIVIDADE = {
  3: 'Sentimos sua falta por aqui. Como você está hoje?',
  7: 'Já faz alguns dias que você não passa por aqui. Se desejar, estamos prontos para caminhar com você.',
  14: 'Você não precisa passar por tudo sem companhia. Quando quiser, estaremos aqui.',
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

    mensagensPush.push({ to: dados.pushToken, title: 'Atravessia', body: 'Você não precisa atravessar tudo sem companhia. Considere se aproximar de alguém da sua rede de apoio.', data: { screen: 'RedeApoio', tipo: 'rede_apoio' } });
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
    // `screen` opcional no documento (ex.: comunicação automática → 'Cursos'/'Parcerias').
    const screen = typeof n.screen === 'string' && /^[A-Za-z]{2,40}$/.test(n.screen) ? n.screen : 'Notificacoes';
    mensagens.push({ to: u.pushToken, title: 'Atravessia', body: n.texto, data: { screen, ...(n.cursoId ? { cursoId: String(n.cursoId) } : {}) } });
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

    mensagensPush.push({ to: dados.pushToken, title: 'Atravessia', body: 'Sua jornada está esperando por você. Quando sentir que é o momento, continue de onde parou.', data: { screen: 'Jornadas', tipo: 'jornada' } });
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
    mensagensPush.push({ to: dados.pushToken, title: 'Atravessia', body: 'Seu Memorial está esperando por novas lembranças. Que tal adicionar algo hoje?', data: { screen: 'GuardarMemoria', tipo: 'memorial' } });
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

// ═══════════════════════════════════════════════════════════════════════════
// AFILIADOS — cashback de compras feitas pelos links de afiliado
//
// A vitrine continua na coleção `indicacoes` (ids e dados antigos preservados).
// Campos novos de cada item (públicos, lidos pelo app):
//   plataforma: 'amazon'|'mercadolivre'|'shopee'|'magalu'|'outra', plataformaNome,
//   textoBotao, imagemUrl, imagemCaminho (se enviada para afiliados/ no Storage),
//   cashbackAtivo, cashbackTipo: 'fixo'|'percentual', cashbackFixoCentavos, cashbackPercentual
// A comissão do app fica em `afiliadosPrivado/{itemId}` (só admin lê):
//   { comissaoPercentual, precoReferenciaCentavos }
//
// As lojas não informam quem comprou, então o fluxo é por comprovante:
//  1. Clique no link → registrarCliqueAfiliado soma o clique e cria/atualiza o
//     rastreio `rastreiosAfiliados/{uid}_{itemId}` (prova de que veio do app).
//  2. A usuária envia pedido, valor e print → enviarPedidoCashbackAfiliado cria
//     `pedidosCashbackAfiliado/{itemId}_{hash do nº do pedido}` (id fixo = um
//     pedido por número por item, para todas as usuárias) com status 'pendente'.
//  3. A administradora aprova ou recusa → analisarPedidoCashbackAfiliado. Ao
//     aprovar, o crédito sai pelo mesmo creditarCashback da carteira.
// Só estas funções (Admin SDK) gravam rastreios e pedidos; as regras negam a
// escrita pelo app, então a usuária não altera o status depois de enviar.
// ═══════════════════════════════════════════════════════════════════════════

const AFILIADOS_LIMITES = {
  valorMinCentavos: 100,        // compra mínima: R$ 1,00
  valorMaxCentavos: 300000,     // compra máxima aceita: R$ 3.000,00
  cashbackMaxCentavos: 10000,   // cashback máximo por pedido: R$ 100,00
  percentualMax: 50,            // ninguém devolve mais que 50% em créditos
  pendentesMax: 5,              // pedidos em análise ao mesmo tempo, por usuária
  diasAposClique: 60,           // pedido precisa vir até 60 dias após o último clique
};
const COL_PEDIDOS_AFILIADO = 'pedidosCashbackAfiliado';
const COL_RASTREIOS_AFILIADO = 'rastreiosAfiliados';
const NOMES_PLATAFORMA_AFILIADO = {
  amazon: 'Amazon', mercadolivre: 'Mercado Livre', shopee: 'Shopee', magalu: 'Magalu',
};

function nomePlataformaAfiliado(item) {
  if (item?.plataforma === 'outra') return String(item.plataformaNome || '').trim() || 'loja';
  return NOMES_PLATAFORMA_AFILIADO[item?.plataforma] || 'Amazon';
}

// Nº do pedido sem espaços, traços e pontos, em maiúsculas: "123-456 7" e
// "1234567" contam como o mesmo pedido.
function normalizarNumeroPedido(numero) {
  return String(numero || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);
}

// Regra de cashback do item (o que vale para a usuária). null = sem cashback.
function regraCashbackAfiliado(item) {
  if (!item || item.cashbackAtivo !== true) return null;
  if (item.cashbackTipo === 'percentual') {
    const p = Number(item.cashbackPercentual);
    if (!Number.isFinite(p) || p <= 0) return null;
    return { tipo: 'percentual', percentual: Math.min(p, AFILIADOS_LIMITES.percentualMax) };
  }
  const fixo = Math.round(Number(item.cashbackFixoCentavos));
  if (!Number.isFinite(fixo) || fixo <= 0) return null;
  return { tipo: 'fixo', fixoCentavos: Math.min(fixo, AFILIADOS_LIMITES.cashbackMaxCentavos) };
}

function calcularCashbackAfiliado(regra, valorCentavos) {
  if (!regra || !(valorCentavos > 0)) return 0;
  const bruto = regra.tipo === 'percentual'
    ? Math.floor(valorCentavos * (regra.percentual / 100))
    : regra.fixoCentavos;
  return Math.max(0, Math.min(bruto, valorCentavos, AFILIADOS_LIMITES.cashbackMaxCentavos));
}

// configuracoes/cashback: o cashback de afiliados só existe com o cashback
// ligado E visível para a usuária.
async function cashbackAfiliadosLiberado() {
  const snap = await db.collection('configuracoes').doc('cashback').get().catch(() => null);
  const c = snap?.data() || {};
  return c.ativo !== false && c.exibirUsuario !== false;
}

async function pushParaUsuaria(uid, body, screen) {
  try {
    const u = (await db.collection('usuarios').doc(uid).get()).data();
    if (u?.pushToken) await enviarPush([{ to: u.pushToken, title: 'Atravessia', body, data: { screen } }]);
  } catch (e) {
    console.warn('[afiliados] push não enviado:', e?.message);
  }
}

// 1) Clique no link de afiliado: soma o clique do item e guarda o rastreio.
exports.registrarCliqueAfiliado = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) return { ok: false };
  const itemId = String(request.data?.id || '');
  if (!itemId || itemId.includes('/')) return { ok: false };
  const itemRef = db.collection('indicacoes').doc(itemId);
  const item = await itemRef.get();
  if (!item.exists) return { ok: false };
  const agora = admin.firestore.FieldValue.serverTimestamp();
  await itemRef.update({ cliques: admin.firestore.FieldValue.increment(1) });
  const rastreioRef = db.collection(COL_RASTREIOS_AFILIADO).doc(`${uid}_${itemId}`);
  const existente = await rastreioRef.get();
  await rastreioRef.set({
    usuarioId: uid, itemId, itemTitulo: item.data().titulo || '',
    ultimoCliqueEm: agora, cliques: admin.firestore.FieldValue.increment(1),
    ...(existente.exists ? {} : { primeiroCliqueEm: agora, status: 'clicado' }),
  }, { merge: true });
  return { ok: true };
});

// 2) A usuária pede o cashback de uma compra.
exports.enviarPedidoCashbackAfiliado = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta para pedir o cashback.');
  if (!(await cashbackAfiliadosLiberado())) {
    throw new HttpsError('failed-precondition', 'O cashback está pausado no momento. Tente novamente mais tarde.');
  }

  const itemId = String(request.data?.itemId || '');
  if (!itemId || itemId.includes('/')) throw new HttpsError('invalid-argument', 'Item não informado.');
  const itemSnap = await db.collection('indicacoes').doc(itemId).get();
  const item = itemSnap.data();
  if (!itemSnap.exists || item.ativo === false) throw new HttpsError('not-found', 'Este item não está mais disponível.');
  const regra = regraCashbackAfiliado(item);
  if (!regra) throw new HttpsError('failed-precondition', 'Este item não oferece cashback.');

  const numeroPedido = String(request.data?.numeroPedido || '').trim().slice(0, 60);
  const numeroNorm = normalizarNumeroPedido(numeroPedido);
  if (numeroNorm.length < 4) throw new HttpsError('invalid-argument', 'Confira o número do pedido (como aparece no app ou no e-mail da loja).');

  const valorCentavos = centavos(request.data?.valor);
  if (!valorCentavos || valorCentavos < AFILIADOS_LIMITES.valorMinCentavos) {
    throw new HttpsError('invalid-argument', 'Informe o valor pago por este item.');
  }
  if (valorCentavos > AFILIADOS_LIMITES.valorMaxCentavos) {
    throw new HttpsError('invalid-argument', `O valor passa do limite de ${reaisTexto(AFILIADOS_LIMITES.valorMaxCentavos)} por pedido. Fale com a gente pelo app.`);
  }

  // Comprovante: precisa estar na pasta da própria usuária e existir no Storage.
  const caminho = String(request.data?.comprovanteCaminho || '');
  if (!caminho.startsWith(`comprovantesAfiliados/${uid}/`) || caminho.includes('..')) {
    throw new HttpsError('invalid-argument', 'Envie a foto do comprovante.');
  }
  const [existeArquivo] = await admin.storage().bucket().file(caminho).exists();
  if (!existeArquivo) throw new HttpsError('invalid-argument', 'Não encontramos a foto do comprovante. Envie de novo, por favor.');
  const urlRecebida = String(request.data?.comprovanteUrl || '');
  const comprovanteUrl = urlRecebida.startsWith('https://firebasestorage.googleapis.com/')
    && urlRecebida.includes(encodeURIComponent(caminho)) ? urlRecebida : null;

  // Precisa ter aberto o link pelo app (rastreio) há no máximo N dias.
  const rastreioRef = db.collection(COL_RASTREIOS_AFILIADO).doc(`${uid}_${itemId}`);
  const rastreio = (await rastreioRef.get()).data();
  const ultimoClique = rastreio?.ultimoCliqueEm?.toMillis?.() || 0;
  if (!ultimoClique) {
    throw new HttpsError('failed-precondition', 'Para ganhar o cashback, a compra precisa começar pelo botão da loja aqui no app.');
  }
  if (Date.now() - ultimoClique > AFILIADOS_LIMITES.diasAposClique * 86400000) {
    throw new HttpsError('failed-precondition', `O pedido precisa ser enviado em até ${AFILIADOS_LIMITES.diasAposClique} dias depois de abrir o link pelo app.`);
  }

  const meus = await db.collection(COL_PEDIDOS_AFILIADO).where('usuarioId', '==', uid).get();
  if (meus.docs.filter(d => d.data().status === 'pendente').length >= AFILIADOS_LIMITES.pendentesMax) {
    throw new HttpsError('resource-exhausted', 'Você já tem pedidos em análise. Assim que forem analisados, você pode enviar outros.');
  }

  const perfil = (await db.collection('usuarios').doc(uid).get()).data() || {};
  const hash = crypto.createHash('sha256').update(numeroNorm).digest('hex').slice(0, 24);
  const pedidoId = `${itemId}_${hash}`;
  const pedidoRef = db.collection(COL_PEDIDOS_AFILIADO).doc(pedidoId);
  const cashbackPrevisto = calcularCashbackAfiliado(regra, valorCentavos);

  await db.runTransaction(async (tx) => {
    const ja = await tx.get(pedidoRef);
    if (ja.exists) {
      throw new HttpsError('already-exists', ja.data().usuarioId === uid
        ? 'Você já enviou este número de pedido para este item. Acompanhe em "Meus pedidos de cashback".'
        : 'Este número de pedido já foi usado para este item. Se achar que é um engano, fale com a gente.');
    }
    tx.set(pedidoRef, {
      usuarioId: uid,
      usuarioNome: perfil.nome || '',
      usuarioEmail: perfil.email || request.auth.token?.email || '',
      itemId, itemTitulo: item.titulo || '', itemImagemUrl: item.imagemUrl || '',
      plataforma: nomePlataformaAfiliado(item),
      numeroPedido, numeroPedidoNorm: numeroNorm,
      valorCentavos, regraCashback: regra, cashbackPrevistoCentavos: cashbackPrevisto,
      comprovanteCaminho: caminho, comprovanteUrl,
      rastreioId: rastreioRef.id,
      status: 'pendente',
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(rastreioRef, { status: 'pedido_enviado', pedidoId }, { merge: true });
  });

  return { ok: true, pedidoId, cashbackPrevisto: reais(cashbackPrevisto) };
});

// 3) A administradora aprova (credita) ou recusa (com motivo).
// data: { pedidoId, decisao: 'aprovar'|'recusar', motivo?, valor? (reais, para corrigir o valor da compra) }
exports.analisarPedidoCashbackAfiliado = onCall(async (request) => {
  const adminUid = await exigirAdmin(request);
  const pedidoId = String(request.data?.pedidoId || '');
  const decisao = request.data?.decisao;
  if (!pedidoId || pedidoId.includes('/')) throw new HttpsError('invalid-argument', 'Pedido não informado.');
  if (!['aprovar', 'recusar'].includes(decisao)) throw new HttpsError('invalid-argument', 'Escolha aprovar ou recusar.');
  const ref = db.collection(COL_PEDIDOS_AFILIADO).doc(pedidoId);
  const agora = admin.firestore.FieldValue.serverTimestamp();

  if (decisao === 'recusar') {
    const motivo = String(request.data?.motivo || '').trim().slice(0, 300);
    if (motivo.length < 3) throw new HttpsError('invalid-argument', 'Escreva o motivo da recusa (a usuária vai ler).');
    const pedido = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');
      if (snap.data().status !== 'pendente') throw new HttpsError('failed-precondition', 'Este pedido já foi analisado.');
      tx.update(ref, { status: 'recusado', motivo, analisadoEm: agora, analisadoPor: adminUid });
      return snap.data();
    });
    // A coleção de notificações é lida por todas: o motivo fica só no pedido
    // (que só a dona lê) e no push, que vai apenas para o aparelho dela.
    await db.collection('notificacoesEditoriais').add({
      usuarioId: pedido.usuarioId, tipo: 'cashback_afiliado',
      texto: 'Seu pedido de cashback foi analisado. Toque para ver os detalhes.',
      ativa: true, criadoEm: agora,
    });
    await pushParaUsuaria(pedido.usuarioId, `Não conseguimos aprovar o cashback de "${pedido.itemTitulo}": ${motivo}`, 'MeusPedidosCashback');
    await registrarAuditoriaBeneficio('cashback_afiliado_recusado', 'pedidoCashbackAfiliado', pedidoId, { adminUid, motivo });
    return { ok: true, status: 'recusado' };
  }

  if (!(await cashbackAfiliadosLiberado())) {
    throw new HttpsError('failed-precondition', 'O cashback está desligado ou oculto em Configurações do cashback. Ligue para aprovar.');
  }
  const cfg = await configCashback();
  const ajuste = request.data?.valor != null && request.data?.valor !== '' ? centavos(request.data.valor) : null;
  if (ajuste != null && (!ajuste || ajuste > AFILIADOS_LIMITES.valorMaxCentavos)) {
    throw new HttpsError('invalid-argument', 'Valor corrigido inválido.');
  }

  // Marca como aprovado primeiro (evita aprovação dupla); se o crédito falhar,
  // volta para pendente.
  const pedido = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');
    const p = snap.data();
    if (p.status !== 'pendente') throw new HttpsError('failed-precondition', 'Este pedido já foi analisado.');
    const valor = ajuste || p.valorCentavos;
    const cb = calcularCashbackAfiliado(p.regraCashback, valor);
    if (!(cb > 0)) throw new HttpsError('failed-precondition', 'O cashback calculado ficou zerado. Confira o valor.');
    tx.update(ref, {
      status: 'aprovado', valorAprovadoCentavos: valor, cashbackCentavos: cb,
      analisadoEm: agora, analisadoPor: adminUid,
    });
    return { ...p, cashbackCentavos: cb, valorAprovadoCentavos: valor };
  });

  try {
    await creditarCashback(pedido.usuarioId, pedido.cashbackCentavos, {
      origem: 'afiliado',
      descricao: `Cashback de compra com afiliado: ${pedido.itemTitulo}`.slice(0, 140),
      referencia: `afiliado:${pedidoId}`,
      idDoc: `afiliado_${pedidoId}`,
    }, cfg);
  } catch (e) {
    console.error('[afiliados] falha ao creditar', pedidoId, e);
    await ref.update({ status: 'pendente', erroCredito: String(e?.message || e).slice(0, 200) }).catch(() => {});
    throw new HttpsError('internal', 'Não foi possível creditar agora. O pedido continua em análise; tente de novo.');
  }
  await ref.update({ creditoId: `afiliado_${pedidoId}`, erroCredito: admin.firestore.FieldValue.delete() }).catch(() => {});
  await pushParaUsuaria(pedido.usuarioId, `Seu cashback de ${reaisTexto(pedido.cashbackCentavos)} chegou! Use no seu plano ou relatório.`, 'Cashback');
  await registrarAuditoriaBeneficio('cashback_afiliado_aprovado', 'pedidoCashbackAfiliado', pedidoId, {
    adminUid, usuarioId: pedido.usuarioId, cashbackCentavos: pedido.cashbackCentavos, valorCentavos: pedido.valorAprovadoCentavos,
  });
  return { ok: true, status: 'aprovado', cashback: reais(pedido.cashbackCentavos) };
});

// ═══════════════════════════════════════════════════════════════════════════
// CURSOS
// Cursos em vídeo (YouTube não listado) vendidos pelo Stripe, com prestação
// de contas para o profissional parceiro. Valores sempre em centavos.
//   cursos/{id}                  { titulo, subtitulo, descricao, capaUrl, programa[], aulas[],
//                                  preco (reais), ativo, destaque, arquivado, protegerAulas,
//                                  profissionalId, criadoEm }
//                                  Com protegerAulas, as aulas PAGAS ficam aqui sem youtubeId/thumb.
//   cursosConteudo/{id}          { aulas: { aulaId: { youtubeId, thumb } } }  (só quem comprou e admin lêem)
//   profissionais/{id}           { nome, bio, fotoUrl, ativo }     (perfil público, sem valores)
//   profissionaisPrivado/{id}    { email, tokenPortal, repasseTipo, repasseValor, repasseBase,
//                                  termoAceitoEm, termoVersao, termoIp, termoUserAgent, termoPedirNovo }
//                                  (só admin lê; só servidor grava) + subcoleção aceites/{id}
//   limitesPortal/{hash}         contador de chamadas do portal por IP (só servidor)
//   matriculas/{stripeSessionId} { uid, cursoId, profissionalId, valorPagoCentavos, taxaStripeCentavos,
//                                  repasseCentavos, repasseRegra, stripeSessionId, stripePaymentIntent,
//                                  criadaEm, status: 'ativa'|'reembolsada', repasseId? }
//   usuarios/{uid}/cursos/{cursoId} { cursoId, matriculaId, liberadoEm, progresso{aulaId:true} }
//   repasses/{id}                { profissionalId, periodo, matriculaIds, ajusteMatriculaIds,
//                                  totalCentavos, pagoEm, comprovanteUrl? }
// O valor do repasse é calculado no momento da venda, com a regra vigente
// naquele instante, e fica congelado na matrícula (que só o servidor grava).
// ═══════════════════════════════════════════════════════════════════════════

const PORTAL_PROFISSIONAL_URL = `${SITE_URL}/profissional.html`;
// Endereços aceitos como retorno do pagamento feito pela área web do curso
// (comparados pela origem inteira, para não aceitar "…web.app.outro.com").
const ORIGENS_RETORNO_CURSO = [SITE_URL, 'https://o-amor-que-fica.firebaseapp.com'];
// Termo de parceria do profissional: o texto vigente fica em
// configuracoes/termoProfissional e é publicado pelo painel
// (publicarTermoProfissional). Esta constante é só a versão "de fábrica"
// (texto de admin-web/src/termoProfissional.js), usada enquanto nenhuma
// versão tiver sido publicada. Não é preciso mudá-la.
const TERMO_PROFISSIONAL_VERSAO = '1.0';
const ID_SEGURO = /^[A-Za-z0-9_-]{1,128}$/;
// 32+ caracteres: aceita também os links já enviados (24 bytes = 32 caracteres).
const TOKEN_PORTAL = /^[A-Za-z0-9_-]{32,128}$/;

// Token do portal: 32 bytes aleatórios (43 caracteres), gerado só no servidor.
function gerarTokenPortal() {
  return crypto.randomBytes(32).toString('base64url');
}

function idValido(valor, mensagem) {
  const s = String(valor ?? '');
  if (!ID_SEGURO.test(s)) throw new HttpsError('invalid-argument', mensagem);
  return s;
}
// Link https opcional (capa, foto, comprovante). Vazio vira ''.
function urlHttpsOpcional(valor, rotulo, max = 2000) {
  const s = String(valor ?? '').trim();
  if (!s) return '';
  if (s.length > max || !/^https:\/\/\S+$/i.test(s)) throw new HttpsError('invalid-argument', `${rotulo}: use um link que comece com https://`);
  return s;
}
function urlRetornoCurso(url) {
  if (typeof url !== 'string' || url.length > 2000) return null;
  try {
    const u = new URL(url);
    const ok = ORIGENS_RETORNO_CURSO.includes(u.origin) || (u.protocol === 'http:' && u.hostname === 'localhost');
    return ok ? u.toString() : null;
  } catch { return null; }
}

// Regra de repasse: fica em profissionaisPrivado (as usuárias não leem). Os
// perfis antigos ainda tinham os campos no documento público; vale como reserva.
function regraRepasseDe(pub, priv) {
  const v = (k) => (priv && priv[k] != null ? priv[k] : pub?.[k]);
  return { repasseTipo: v('repasseTipo'), repasseValor: v('repasseValor'), repasseBase: v('repasseBase') };
}

// Aulas pagas sem youtubeId nem miniatura (que também contém o id) no
// documento público; o conteúdo completo vai para cursosConteudo/{id}.
function aulasPublicasCurso(aulas, proteger) {
  return aulas.map(a => ((!proteger || a.gratis) ? a : { id: a.id, titulo: a.titulo, duracao: a.duracao || '', ordem: a.ordem, gratis: false }));
}
function conteudoDasAulas(aulas) {
  return { aulas: Object.fromEntries(aulas.map(a => [a.id, { youtubeId: a.youtubeId, thumb: a.thumb || `https://i.ytimg.com/vi/${a.youtubeId}/hqdefault.jpg` }])) };
}

// ---- Proteção do portal: limite simples de chamadas por IP -----------------
const hashCurto = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 40);
function origemChamada(request) {
  const h = request.rawRequest?.headers || {};
  const ip = String(h['x-forwarded-for'] || request.rawRequest?.ip || '').split(',')[0].trim();
  return { ip: ip.slice(0, 64), ua: String(h['user-agent'] || '').slice(0, 300) };
}
// IP sem o final (a.b.c.0 / 3 primeiros blocos do IPv6) e navegador + sistema.
function resumirIp(ip) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/, '.0');
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}::`;
  return '';
}
function resumirUserAgent(ua) {
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Outro navegador';
  const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'outro sistema';
  return `${nav} · ${so}`;
}
// Janela fixa: até `max` chamadas a cada `janelaMs`. Devolve true se passou do
// limite. Com incrementar=false só consulta. Os documentos têm `expiraEm` para
// uma política de TTL do Firestore (opcional) apagar os antigos.
async function passouDoLimite(chave, { max, janelaMs, incrementar = true }) {
  const ref = db.collection('limitesPortal').doc(hashCurto(chave));
  const agora = Date.now();
  return db.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    if (!d || agora - (d.inicio || 0) > janelaMs) {
      if (incrementar) tx.set(ref, { inicio: agora, total: 1, expiraEm: admin.firestore.Timestamp.fromMillis(agora + janelaMs) });
      return false;
    }
    if (d.total >= max) return true;
    if (incrementar) tx.update(ref, { total: admin.firestore.FieldValue.increment(1) });
    return false;
  });
}
const MSG_MUITAS_TENTATIVAS = 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
// Identifica o profissional pelo token do link, com limite de chamadas por IP
// (60 a cada 10 min) e de links inválidos (8 a cada 30 min).
async function profissionalPorToken(request) {
  const { ip, ua } = origemChamada(request);
  const chave = ip || 'sem-ip';
  const LIM_FALHA = { max: 8, janelaMs: 30 * 60 * 1000 };
  if (await passouDoLimite(`portal:${chave}`, { max: 60, janelaMs: 10 * 60 * 1000 })) throw new HttpsError('resource-exhausted', MSG_MUITAS_TENTATIVAS);
  if (await passouDoLimite(`falha:${chave}`, { ...LIM_FALHA, incrementar: false })) throw new HttpsError('resource-exhausted', MSG_MUITAS_TENTATIVAS);
  const falhar = async (codigo, msg) => {
    await passouDoLimite(`falha:${chave}`, LIM_FALHA);
    throw new HttpsError(codigo, msg);
  };
  const token = String(request.data?.token || '');
  if (!TOKEN_PORTAL.test(token)) await falhar('invalid-argument', 'Link inválido. Abra o link exatamente como a equipe Atravessia enviou.');
  const snap = await db.collection('profissionaisPrivado').where('tokenPortal', '==', token).limit(1).get();
  if (snap.empty) await falhar('not-found', 'Este link não é mais válido. Peça um novo à equipe Atravessia.');
  return { id: snap.docs[0].id, ref: snap.docs[0].ref, priv: snap.docs[0].data(), ip, ua };
}

// Regra do repasse do profissional, aplicada a uma venda.
//  - percentual: repasseValor % sobre o valor pago (base 'bruto') ou sobre o
//    valor pago menos a taxa da Stripe (base 'liquido', se a taxa for conhecida);
//  - fixo: repasseValor reais por venda (nunca mais que o valor pago).
function calcularRepasseCentavos(valorPagoCentavos, taxaCentavos, prof) {
  const tipo = prof?.repasseTipo === 'fixo' ? 'fixo' : 'percentual';
  const valor = Number(prof?.repasseValor) || 0;
  const baseDesejada = prof?.repasseBase === 'liquido' ? 'liquido' : 'bruto';
  const base = baseDesejada === 'liquido' && Number.isFinite(taxaCentavos) ? 'liquido' : 'bruto';
  const baseCentavos = Math.max(0, valorPagoCentavos - (base === 'liquido' ? taxaCentavos : 0));
  let repasse = tipo === 'fixo'
    ? Math.round(valor * 100)
    : Math.round(baseCentavos * Math.min(Math.max(valor, 0), 100) / 100);
  repasse = Math.max(0, Math.min(repasse, valorPagoCentavos));
  // Se a regra pedia o líquido e a taxa não veio da Stripe, a venda fica
  // registrada como calculada sobre o bruto, e isso aparece na própria regra.
  const regra = { tipo, valor, base, baseCentavos, ...(tipo === 'percentual' && base !== baseDesejada ? { baseSolicitada: baseDesejada, taxaIndisponivel: true } : {}) };
  return { repasseCentavos: repasse, regra };
}

// ---- Checkout do curso ------------------------------------------------------
exports.criarCheckoutCurso = onCall(OPCOES_CHECKOUT, comErroPagamento(async (request) => {
  if (request.data?.aquecer) return { ok: true };

  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para comprar o curso.');
  const cursoId = idValido(request.data?.cursoId, 'Curso não informado.');

  const userRef = db.collection('usuarios').doc(uid);
  const [cursoSnap, userSnap, acessoSnap] = await Promise.all([
    db.collection('cursos').doc(cursoId).get(),
    userRef.get(),
    userRef.collection('cursos').doc(cursoId).get(),
  ]);
  const curso = cursoSnap.data();
  if (!curso || curso.ativo !== true || curso.arquivado === true) throw new HttpsError('failed-precondition', 'Este curso não está disponível no momento.');
  if (acessoSnap.exists) throw new HttpsError('already-exists', 'Você já tem este curso. Ele está em "Meus cursos".');
  const valorCentavos = centavos(curso.preco);
  if (!valorCentavos || valorCentavos < 100) throw new HttpsError('failed-precondition', 'O preço deste curso ainda não foi definido.');
  // Profissional desativado no painel: o curso para de ser vendido.
  if (curso.profissionalId) {
    const prof = (await db.collection('profissionais').doc(String(curso.profissionalId)).get()).data();
    if (!prof || prof.ativo === false) throw new HttpsError('failed-precondition', 'Este curso está temporariamente indisponível para compra.');
  }

  const retorno = urlRetornoCurso;
  const stripe = stripeDe();
  const customerId = await getOrCreateCustomer(stripe, uid, userSnap.data() || {});

  // Sem códigos promocionais nem cashback: o valor pago é sempre o preço do
  // curso, para o repasse do profissional não depender de descontos da casa.
  const opcoes = opcoesCheckoutStudio({ assinatura: false, comDesconto: false });
  delete opcoes.allow_promotion_codes;
  const metadata = { uid, tipo: 'curso', cursoId };
  const capa = /^https:\/\//.test(curso.capaUrl || '') ? [curso.capaUrl] : undefined;

  const session = await criarSessaoCheckout(stripe, {
    ...opcoes,
    mode: 'payment',
    customer: customerId,
    locale: 'pt-BR',
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: {
          name: `Curso: ${String(curso.titulo || 'Atravessia').slice(0, 200)}`,
          ...(curso.subtitulo ? { description: String(curso.subtitulo).slice(0, 300) } : {}),
          ...(capa ? { images: capa } : {}),
        },
        unit_amount: valorCentavos,
      },
      quantity: 1,
    }],
    success_url: retorno(request.data?.successUrl) || `${SITE_URL}/checkout-sucesso.html`,
    cancel_url: retorno(request.data?.cancelUrl) || `${SITE_URL}/checkout-cancelado.html`,
    metadata,
    payment_intent_data: { metadata, description: `Curso Atravessia: ${String(curso.titulo || '').slice(0, 200)}` },
    custom_text: {
      submit: { message: 'Acesso vitalício às aulas, no app e no computador.' },
      terms_of_service_acceptance: { message: TEXTO_ACEITE_TERMOS },
    },
  });
  return { url: session.url };
}));

// ---- Webhook: compra concluída -> matrícula ---------------------------------
// Idempotente: o id da matrícula é o id da sessão do Stripe; se o evento
// chegar duas vezes, a segunda não faz nada.
async function processarCompraCurso(stripe, session) {
  const { uid, cursoId } = session.metadata || {};
  if (!uid || !cursoId) { console.error('[Cursos] sessão sem uid/cursoId', session.id); return; }
  if (session.payment_status && session.payment_status !== 'paid') {
    console.log('[Cursos] pagamento ainda não confirmado', session.id, session.payment_status);
    return;
  }
  const matriculaRef = db.collection('matriculas').doc(session.id);
  if ((await matriculaRef.get()).exists) return;

  const cursoSnap = await db.collection('cursos').doc(cursoId).get();
  const curso = cursoSnap.data() || {};
  const profissionalId = curso.profissionalId || null;
  const [profSnap, profPrivSnap] = profissionalId
    ? await Promise.all([db.collection('profissionais').doc(profissionalId).get(), db.collection('profissionaisPrivado').doc(profissionalId).get()])
    : [null, null];
  const prof = profSnap?.exists ? regraRepasseDe(profSnap.data(), profPrivSnap?.data()) : null;

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null;
  let taxaStripeCentavos = null;
  let chargeId = null;
  const lerTaxa = (bt) => { if (bt && typeof bt === 'object' && Number.isFinite(bt.fee)) taxaStripeCentavos = bt.fee; };
  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge.balance_transaction'] });
      chargeId = pi.latest_charge?.id || null;
      lerTaxa(pi.latest_charge?.balance_transaction);
      // A transação de saldo às vezes ainda não existe no primeiro evento: tenta mais uma vez.
      if (taxaStripeCentavos == null && chargeId) {
        await new Promise(r => setTimeout(r, 1500));
        lerTaxa((await stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] })).balance_transaction);
      }
    } catch (e) {
      console.warn('[Cursos] não foi possível ler a taxa da Stripe', session.id, e?.message);
    }
  }
  const valorPagoCentavos = Number(session.amount_total) || 0;
  const { repasseCentavos, regra } = prof
    ? calcularRepasseCentavos(valorPagoCentavos, taxaStripeCentavos, prof)
    : { repasseCentavos: 0, regra: null };

  const criada = await db.runTransaction(async (tx) => {
    const atual = await tx.get(matriculaRef);
    if (atual.exists) return false;
    const agora = admin.firestore.FieldValue.serverTimestamp();
    tx.set(matriculaRef, {
      uid, cursoId, profissionalId,
      cursoTitulo: curso.titulo || '',
      valorPagoCentavos, taxaStripeCentavos, repasseCentavos, repasseRegra: regra,
      moeda: session.currency || 'brl',
      stripeSessionId: session.id, stripePaymentIntent: paymentIntentId, stripeChargeId: chargeId,
      criadaEm: agora, status: 'ativa', repasseId: null,
    });
    tx.set(db.collection('usuarios').doc(uid).collection('cursos').doc(cursoId), {
      cursoId, matriculaId: session.id, liberadoEm: agora,
    }, { merge: true });
    return true;
  });
  if (!criada) return;

  const userSnap = await db.collection('usuarios').doc(uid).get();
  const token = userSnap.data()?.pushToken;
  if (token) {
    await enviarPush([{
      to: token,
      title: 'Seu curso já está liberado 💜',
      body: `Boas-vindas a "${curso.titulo || 'seu novo curso'}". As aulas estão esperando por você, no seu ritmo.`,
      data: { screen: 'Cursos', cursoId },
    }]);
  }
}

// ---- Webhook: reembolso -> matrícula reembolsada e acesso removido ----------
async function processarReembolsoCurso(charge) {
  if (!charge?.refunded) return; // reembolso parcial: mantém o acesso
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  const snap = await db.collection('matriculas').where('stripePaymentIntent', '==', pi).get();
  for (const d of snap.docs) {
    // Idempotente (evento repetido não faz nada) e só remove o acesso que veio
    // DESTA compra: se a pessoa comprou de novo depois, o acesso novo fica.
    await db.runTransaction(async (tx) => {
      const atual = await tx.get(d.ref);
      const m = atual.data() || {};
      if (m.status === 'reembolsada' || !m.uid || !m.cursoId) return;
      const acessoRef = db.collection('usuarios').doc(m.uid).collection('cursos').doc(m.cursoId);
      const acesso = await tx.get(acessoRef);
      tx.update(d.ref, { status: 'reembolsada', reembolsadaEm: admin.firestore.FieldValue.serverTimestamp() });
      if (acesso.exists && (!acesso.data().matriculaId || acesso.data().matriculaId === d.id)) tx.delete(acessoRef);
    });
  }
}

// ---- Importar vídeos do YouTube (admin) -------------------------------------
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const yt = {
  thumb: (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  async texto(url, ms = 12000) {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(ms),
      headers: { 'accept-language': 'pt-BR,pt;q=0.9', 'user-agent': 'Mozilla/5.0 (compatible; AtravessiaBot/1.0)' },
    });
    if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
    return r.text();
  },
};

// Classifica cada linha colada: vídeo, playlist ou canal.
function interpretarLinkYoutube(bruto) {
  const s = String(bruto || '').trim();
  if (!s) return null;
  if (YT_ID.test(s)) return { tipo: 'video', id: s };
  if (/^UC[A-Za-z0-9_-]{22}$/.test(s)) return { tipo: 'canal', channelId: s };
  if (/^@[\w.-]+$/.test(s)) return { tipo: 'canal', url: `https://www.youtube.com/${s}` };
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return { tipo: 'invalido', entrada: s }; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.split('/')[1];
    return YT_ID.test(id) ? { tipo: 'video', id } : { tipo: 'invalido', entrada: s };
  }
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(host)) return { tipo: 'invalido', entrada: s };
  const v = u.searchParams.get('v');
  if (v && YT_ID.test(v)) return { tipo: 'video', id: v };
  const partes = u.pathname.split('/').filter(Boolean);
  if (['embed', 'shorts', 'live', 'v'].includes(partes[0]) && YT_ID.test(partes[1] || '')) return { tipo: 'video', id: partes[1] };
  const lista = u.searchParams.get('list');
  if (lista) return { tipo: 'playlist', id: lista };
  if (partes[0] === 'channel' && /^UC[A-Za-z0-9_-]{22}$/.test(partes[1] || '')) return { tipo: 'canal', channelId: partes[1] };
  if (partes[0]?.startsWith('@') || ['c', 'user'].includes(partes[0])) {
    const caminho = partes[0].startsWith('@') ? partes[0] : `${partes[0]}/${partes[1] || ''}`;
    return { tipo: 'canal', url: `https://www.youtube.com/${caminho}` };
  }
  return { tipo: 'invalido', entrada: s };
}

async function resolverChannelId(urlCanal) {
  const html = await yt.texto(urlCanal);
  const m = html.match(/channel_id=(UC[A-Za-z0-9_-]{22})/)
    || html.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/)
    || html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/)
    || html.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/);
  return m ? m[1] : null;
}

const decodificarXml = (t) => String(t || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// Feed RSS público (últimos ~15 vídeos públicos do canal ou da playlist).
async function videosDoFeed(param) {
  const xml = await yt.texto(`https://www.youtube.com/feeds/videos.xml?${param}`);
  const autorCanal = decodificarXml((xml.match(/<author>\s*<name>([^<]*)<\/name>/) || [])[1]);
  return xml.split('<entry>').slice(1).map(e => {
    const id = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const titulo = decodificarXml((e.match(/<title>([^<]*)<\/title>/) || [])[1]);
    const autor = decodificarXml((e.match(/<name>([^<]*)<\/name>/) || [])[1]) || autorCanal;
    return id ? { youtubeId: id, titulo, autor, thumb: yt.thumb(id), duracao: '' } : null;
  }).filter(Boolean);
}

// oEmbed público: funciona para vídeos públicos e não listados, sem chave.
async function videoPorOembed(id) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
  const d = await r.json();
  return { youtubeId: id, titulo: d.title || '', autor: d.author_name || '', thumb: yt.thumb(id), duracao: '' };
}

// "PT1H2M3S" -> "1:02:03"
function duracaoIso(iso) {
  const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const [h, mi, s] = [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)];
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(mi)}:${p(s)}` : `${mi}:${p(s)}`;
}

// YouTube Data API v3 (opcional, com process.env.YOUTUBE_API_KEY).
async function ytApi(caminho, params) {
  const q = new URLSearchParams({ ...params, key: process.env.YOUTUBE_API_KEY });
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${caminho}?${q}`, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`YouTube API ${r.status}`);
  return r.json();
}
async function idsDaPlaylistApi(playlistId, max) {
  const ids = [];
  let pageToken;
  do {
    const d = await ytApi('playlistItems', { part: 'contentDetails', playlistId, maxResults: '50', ...(pageToken ? { pageToken } : {}) });
    (d.items || []).forEach(i => i.contentDetails?.videoId && ids.push(i.contentDetails.videoId));
    pageToken = d.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids.slice(0, max);
}
async function detalhesApi(ids) {
  const mapa = {};
  for (let i = 0; i < ids.length; i += 50) {
    const d = await ytApi('videos', { part: 'snippet,contentDetails', id: ids.slice(i, i + 50).join(',') });
    (d.items || []).forEach(v => {
      mapa[v.id] = {
        youtubeId: v.id, titulo: v.snippet?.title || '', autor: v.snippet?.channelTitle || '',
        thumb: v.snippet?.thumbnails?.high?.url || yt.thumb(v.id), duracao: duracaoIso(v.contentDetails?.duration),
      };
    });
  }
  return mapa;
}

exports.importarVideosYoutube = onCall({ timeoutSeconds: 120, memory: '256MiB' }, async (request) => {
  await exigirAdmin(request);
  const MAX = 60;
  if (String(request.data?.texto || '').length > 20000) throw new HttpsError('invalid-argument', 'Texto longo demais: cole até 80 links por vez.');
  const entradas = (Array.isArray(request.data?.links) ? request.data.links : String(request.data?.texto || '').split(/[\s,;]+/))
    .map(s => String(s).trim().slice(0, 500)).filter(Boolean).slice(0, 80);
  if (!entradas.length) throw new HttpsError('invalid-argument', 'Cole ao menos um link de vídeo, playlist ou canal do YouTube.');

  const comApi = !!process.env.YOUTUBE_API_KEY;
  const avisos = [];
  const ordem = [];           // ids na ordem em que apareceram
  const conhecidos = {};      // metadados já obtidos (feed/API)
  const add = (v) => { if (v && !ordem.includes(v.youtubeId) && ordem.length < MAX) { ordem.push(v.youtubeId); if (v.titulo) conhecidos[v.youtubeId] = v; } };

  for (const entrada of entradas) {
    const item = interpretarLinkYoutube(entrada);
    try {
      if (!item || item.tipo === 'invalido') { avisos.push(`Não reconheci "${entrada}" como link do YouTube.`); continue; }
      if (item.tipo === 'video') { add({ youtubeId: item.id }); continue; }
      if (item.tipo === 'playlist') {
        if (comApi) (await idsDaPlaylistApi(item.id, MAX)).forEach(id => add({ youtubeId: id }));
        else (await videosDoFeed(`playlist_id=${encodeURIComponent(item.id)}`)).forEach(add);
        continue;
      }
      const channelId = item.channelId || await resolverChannelId(item.url);
      if (!channelId) { avisos.push(`Não encontrei o canal "${entrada}".`); continue; }
      if (comApi) (await idsDaPlaylistApi(`UU${channelId.slice(2)}`, MAX)).forEach(id => add({ youtubeId: id }));
      else {
        (await videosDoFeed(`channel_id=${channelId}`)).forEach(add);
        avisos.push('Do canal vêm só os vídeos públicos mais recentes. Vídeos não listados precisam ser colados um a um (ou numa playlist).');
      }
    } catch (e) {
      console.warn('[Cursos] importação', entrada, e?.message);
      avisos.push(`Não foi possível ler "${entrada}" agora (${e?.message || 'erro'}).`);
    }
  }

  let detalhes = {};
  if (comApi && ordem.length) {
    try { detalhes = await detalhesApi(ordem); } catch (e) { avisos.push('A YouTube Data API não respondeu; usei os dados públicos.'); }
  }
  const videos = [];
  for (const id of ordem) {
    let v = detalhes[id] || conhecidos[id];
    if (!v) {
      try { v = await videoPorOembed(id); } catch (e) {
        avisos.push(e?.status === 401 || e?.status === 403
          ? `O vídeo ${id} é privado ou não permite incorporação: deixe-o como "não listado" e com incorporação ativada.`
          : `Não encontrei o vídeo ${id}.`);
        continue;
      }
    }
    videos.push(v);
  }
  return { videos, avisos: [...new Set(avisos)], fonte: comApi ? 'api' : 'publica' };
});

// ---- Profissionais (admin) --------------------------------------------------
// O token do portal é gerado aqui (nunca no navegador) e guardado em
// profissionaisPrivado/{id}, junto com o e-mail — fora da leitura das usuárias.
exports.salvarProfissional = onCall(async (request) => {
  const adminUid = await exigirAdmin(request);
  const d = request.data || {};
  const nome = String(d.nome || '').trim().slice(0, 120);
  if (!nome) throw new HttpsError('invalid-argument', 'Informe o nome do profissional.');
  const repasseTipo = d.repasseTipo === 'fixo' ? 'fixo' : 'percentual';
  const repasseValor = Number(String(d.repasseValor ?? '').replace(',', '.'));
  if (!Number.isFinite(repasseValor) || repasseValor < 0 || (repasseTipo === 'percentual' && repasseValor > 100) || repasseValor > 100000) {
    throw new HttpsError('invalid-argument', repasseTipo === 'percentual' ? 'O repasse deve ficar entre 0% e 100%.' : 'Informe um valor de repasse válido.');
  }
  const email = String(d.email || '').trim().toLowerCase().slice(0, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Confira o e-mail do profissional.');
  const fotoUrl = urlHttpsOpcional(d.fotoUrl, 'Foto');
  const id = d.id ? idValido(d.id, 'Profissional inválido.') : db.collection('profissionais').doc().id;
  const ref = db.collection('profissionais').doc(id);
  const privRef = db.collection('profissionaisPrivado').doc(id);
  const [snap, priv] = await Promise.all([ref.get(), privRef.get()]);
  const agora = admin.firestore.FieldValue.serverTimestamp();
  const apagar = admin.firestore.FieldValue.delete();
  // Perfil público: só o que aparece no app. A regra de repasse sai daqui.
  await ref.set({
    nome,
    bio: String(d.bio || '').trim().slice(0, 2000),
    fotoUrl,
    ativo: d.ativo !== false,
    repasseTipo: apagar, repasseValor: apagar, repasseBase: apagar,
    atualizadoEm: agora,
    ...(snap.exists ? {} : { criadoEm: agora }),
  }, { merge: true });
  // Token: criado só no cadastro (ou por "Novo link"); um link revogado
  // continua revogado ao salvar o perfil.
  const tokenAtual = priv.data()?.tokenPortal || null;
  const tokenPortal = d.novoToken === true || !priv.exists ? gerarTokenPortal() : tokenAtual;
  await privRef.set({
    email, tokenPortal,
    repasseTipo, repasseValor, repasseBase: d.repasseBase === 'liquido' ? 'liquido' : 'bruto',
    atualizadoEm: agora, atualizadoPor: adminUid,
    ...(tokenPortal !== tokenAtual ? { tokenGeradoEm: agora, tokenRevogadoEm: null } : {}),
  }, { merge: true });
  return { id, linkPortal: tokenPortal ? `${PORTAL_PROFISSIONAL_URL}?t=${tokenPortal}` : null };
});

// ---- Portal: novo link, revogar link, pedir novo aceite, ativar/desativar (admin)
exports.gerenciarPortalProfissional = onCall(async (request) => {
  const adminUid = await exigirAdmin(request);
  const id = idValido(request.data?.profissionalId, 'Escolha o profissional.');
  const acao = String(request.data?.acao || '');
  const ref = db.collection('profissionais').doc(id);
  const privRef = db.collection('profissionaisPrivado').doc(id);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Profissional não encontrado.');
  const agora = admin.firestore.FieldValue.serverTimestamp();
  const marca = { atualizadoEm: agora, atualizadoPor: adminUid };
  if (acao === 'novoLink') {
    const tokenPortal = gerarTokenPortal();
    await privRef.set({ tokenPortal, tokenGeradoEm: agora, tokenRevogadoEm: null, ...marca }, { merge: true });
    return { ok: true, linkPortal: `${PORTAL_PROFISSIONAL_URL}?t=${tokenPortal}` };
  }
  if (acao === 'revogar') {
    await privRef.set({ tokenPortal: null, tokenRevogadoEm: agora, ...marca }, { merge: true });
    return { ok: true };
  }
  if (acao === 'pedirNovoAceite') {
    await privRef.set({ termoPedirNovo: true, termoPedidoEm: agora, ...marca }, { merge: true });
    return { ok: true };
  }
  if (acao === 'ativar' || acao === 'desativar') {
    await ref.set({ ativo: acao === 'ativar', atualizadoEm: agora }, { merge: true });
    return { ok: true };
  }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});

// ---- Termo de parceria editável pelo painel ---------------------------------
//   configuracoes/termoProfissional { versao, texto (markdown com {{campos}}), resumo[],
//                                     campos{}, publicadoEm, publicadoPor, rascunho? }
//   configuracoes/termoProfissional/versoes/{versao} { versao, texto, textoFinal, resumo,
//                                     resumoFinal, campos, publicadoEm, publicadoPor }  (congelado)
// O portal recebe o texto final (campos aplicados) por portalProfissional.
const refTermoProfissional = () => db.collection('configuracoes').doc('termoProfissional');
const CAMPO_TERMO = /\{\{\s*([A-Za-z][A-Za-z0-9_]{0,39})\s*\}\}/g;
const aplicarCamposTermo = (texto, campos) => String(texto || '')
  .replace(CAMPO_TERMO, (_, k) => String(campos?.[k] ?? '').trim() || `[${k}]`);
const proximaVersaoTermo = (atual) => {
  const m = /^(\d+)\.(\d+)$/.exec(String(atual || ''));
  return m ? `${m[1]}.${Number(m[2]) + 1}` : '1.1';
};

// Versão publicada (ou a "de fábrica", com texto null: o portal usa o texto embutido).
async function termoProfissionalPublicado() {
  const d = (await refTermoProfissional().get()).data();
  if (!d?.versao || !d?.texto) return { versao: TERMO_PROFISSIONAL_VERSAO, texto: null, resumo: null, publicadoEm: null };
  const campos = d.campos || {};
  return {
    versao: String(d.versao),
    texto: aplicarCamposTermo(d.texto, campos),
    resumo: (Array.isArray(d.resumo) ? d.resumo : []).map(r => aplicarCamposTermo(r, campos)),
    publicadoEm: d.publicadoEm?.toMillis?.() || null,
  };
}

// ---- Publicar nova versão do termo (admin) ----------------------------------
// Sobe a versão (1.0 → 1.1 …), congela o texto em versoes/{versao} e, como a
// versão muda, todos os profissionais aceitam de novo no próximo acesso.
// Com somenteRascunho, só guarda o rascunho (sem mudar a versão).
exports.publicarTermoProfissional = onCall(async (request) => {
  const adminUid = await exigirAdmin(request);
  const d = request.data || {};
  const texto = String(d.texto || '').replace(/\r\n?/g, '\n').trim();
  if (texto.length < 200) throw new HttpsError('invalid-argument', 'O texto do termo está vazio ou curto demais.');
  if (texto.length > 80000) throw new HttpsError('invalid-argument', 'O texto do termo passou de 80 mil caracteres.');
  if (/<\s*\/?\s*[a-z!]/i.test(texto)) throw new HttpsError('invalid-argument', 'O termo não aceita HTML. Use ## para títulos, linha em branco entre parágrafos e "- " para listas.');
  const resumo = (Array.isArray(d.resumo) ? d.resumo : []).map(r => String(r ?? '').trim()).filter(Boolean);
  if (resumo.length > 15 || resumo.some(r => r.length > 600)) throw new HttpsError('invalid-argument', 'O resumo aceita até 15 itens de até 600 caracteres.');
  const campos = {};
  for (const [k, v] of Object.entries(d.campos && typeof d.campos === 'object' ? d.campos : {}).slice(0, 40)) {
    if (/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k)) campos[k] = String(v ?? '').trim().slice(0, 400);
  }
  const ref = refTermoProfissional();
  const agora = admin.firestore.FieldValue.serverTimestamp();

  if (d.somenteRascunho === true) {
    await ref.set({ rascunho: { texto, resumo, campos, salvoEm: agora, salvoPor: adminUid } }, { merge: true });
    return { ok: true, rascunho: true };
  }

  const faltando = new Set();
  [texto, ...resumo].forEach(t => { for (const m of t.matchAll(CAMPO_TERMO)) if (!campos[m[1]]) faltando.add(m[1]); });
  if (faltando.size) throw new HttpsError('failed-precondition', `Preencha antes de publicar: ${[...faltando].join(', ')}.`);

  const versao = await db.runTransaction(async (tx) => {
    const atual = (await tx.get(ref)).data() || {};
    const versaoAtual = atual.versao ? String(atual.versao) : TERMO_PROFISSIONAL_VERSAO;
    // Evita publicar por cima de quem publicou enquanto você editava.
    if (d.versaoBase != null && String(d.versaoBase) !== versaoAtual) {
      throw new HttpsError('aborted', `Outra pessoa publicou a versão ${versaoAtual} enquanto você editava. Recarregue e confira antes de publicar.`);
    }
    const nova = proximaVersaoTermo(versaoAtual);
    const verRef = ref.collection('versoes').doc(nova);
    if ((await tx.get(verRef)).exists) throw new HttpsError('already-exists', `A versão ${nova} já existe no histórico.`);
    const registro = { versao: nova, texto, resumo, campos, publicadoEm: agora, publicadoPor: adminUid };
    tx.set(ref, registro); // sem merge: descarta o rascunho
    tx.set(verRef, {
      ...registro,
      textoFinal: aplicarCamposTermo(texto, campos),
      resumoFinal: resumo.map(r => aplicarCamposTermo(r, campos)),
      versaoAnterior: versaoAtual,
    });
    return nova;
  });
  return { ok: true, versao };
});

// ---- Portal: aceite do termo de parceria (sem login, por token) -------------
const precisaAceiteTermo = (priv, versao) => !priv?.termoAceitoEm || priv.termoVersao !== versao || priv.termoPedirNovo === true;

exports.aceitarTermoProfissional = onCall(async (request) => {
  const { ref, ip, ua } = await profissionalPorToken(request);
  if (request.data?.aceito !== true) throw new HttpsError('invalid-argument', 'Marque "Li e aceito" para continuar.');
  const { versao: versaoVigente } = await termoProfissionalPublicado();
  if (String(request.data?.versao || '') !== versaoVigente) {
    throw new HttpsError('failed-precondition', 'O termo foi atualizado. Recarregue a página para ler a versão nova.');
  }
  const agora = admin.firestore.FieldValue.serverTimestamp();
  const registro = { termoVersao: versaoVigente, termoIp: resumirIp(ip), termoUserAgent: resumirUserAgent(ua) };
  const lote = db.batch();
  lote.set(ref, { ...registro, termoAceitoEm: agora, termoPedirNovo: false }, { merge: true });
  // Histórico de aceites (prova de cada versão aceita).
  lote.set(ref.collection('aceites').doc(), { versao: registro.termoVersao, ip: registro.termoIp, userAgent: registro.termoUserAgent, aceitoEm: agora });
  await lote.commit();
  return { ok: true, versao: versaoVigente };
});

// ---- Portal do profissional (sem login, por token) ---------------------------
// Só dados agregados e anônimos: nenhuma informação das alunas sai daqui.
// Sem o aceite da versão atual do termo, devolve só o pedido de aceite.
exports.portalProfissional = onCall(async (request) => {
  const { id: profissionalId, priv } = await profissionalPorToken(request);
  const termoVigente = await termoProfissionalPublicado();
  if (precisaAceiteTermo(priv, termoVigente.versao)) {
    const p = (await db.collection('profissionais').doc(profissionalId).get()).data() || {};
    return {
      precisaAceite: true,
      // texto null = nenhuma versão publicada ainda: o portal usa o texto embutido (1.0).
      termo: { ...termoVigente, versaoAceita: priv.termoVersao || null },
      profissional: { nome: p.nome || '' },
    };
  }

  const [profSnap, matSnap, repSnap, cursosSnap] = await Promise.all([
    db.collection('profissionais').doc(profissionalId).get(),
    db.collection('matriculas').where('profissionalId', '==', profissionalId).get(),
    db.collection('repasses').where('profissionalId', '==', profissionalId).get(),
    db.collection('cursos').where('profissionalId', '==', profissionalId).get(),
  ]);
  const prof = { ...(profSnap.data() || {}), ...regraRepasseDe(profSnap.data(), priv) };
  const titulos = {};
  cursosSnap.forEach(c => { titulos[c.id] = c.data().titulo || 'Curso'; });
  const ms = (t) => t?.toMillis?.() || null;

  const vendas = matSnap.docs.map(d => {
    const m = d.data();
    return {
      data: ms(m.criadaEm),
      cursoId: m.cursoId,
      curso: titulos[m.cursoId] || m.cursoTitulo || 'Curso',
      valorCentavos: m.valorPagoCentavos || 0,
      taxaStripeCentavos: Number.isFinite(m.taxaStripeCentavos) ? m.taxaStripeCentavos : null,
      repasseCentavos: m.repasseCentavos || 0,
      regra: m.repasseRegra ? { tipo: m.repasseRegra.tipo, valor: m.repasseRegra.valor, base: m.repasseRegra.base, taxaIndisponivel: !!m.repasseRegra.taxaIndisponivel } : null,
      status: m.status,
      repassada: !!m.repasseId,
      ajustePendente: m.status === 'reembolsada' && !!m.repasseId && !m.ajusteRepasseId,
      codigo: String(m.stripePaymentIntent || '').slice(-8).toUpperCase(),
    };
  }).sort((a, b) => (b.data || 0) - (a.data || 0));

  const porCurso = {};
  for (const v of vendas) {
    const c = porCurso[v.cursoId] || (porCurso[v.cursoId] = { cursoId: v.cursoId, curso: v.curso, ativas: 0, reembolsadas: 0, brutoCentavos: 0, repasseCentavos: 0 });
    if (v.status === 'reembolsada') { c.reembolsadas++; continue; }
    c.ativas++;
    c.brutoCentavos += v.valorCentavos;
    c.repasseCentavos += v.repasseCentavos;
  }
  const repasses = repSnap.docs.map(d => {
    const r = d.data();
    return { periodo: r.periodo?.rotulo || '', totalCentavos: r.totalCentavos || 0, vendas: (r.matriculaIds || []).length, pagoEm: ms(r.pagoEm), comprovanteUrl: r.comprovanteUrl || null };
  }).sort((a, b) => (b.pagoEm || 0) - (a.pagoEm || 0));

  const ativas = vendas.filter(v => v.status !== 'reembolsada');
  const soma = (l, k) => l.reduce((a, v) => a + (v[k] || 0), 0);
  return {
    profissional: { nome: prof.nome || '', fotoUrl: prof.fotoUrl || '', repasseTipo: prof.repasseTipo || 'percentual', repasseValor: prof.repasseValor ?? 0, repasseBase: prof.repasseBase || 'bruto' },
    resumo: {
      vendas: ativas.length,
      reembolsadas: vendas.length - ativas.length,
      brutoCentavos: soma(ativas, 'valorCentavos'),
      repasseCentavos: soma(ativas, 'repasseCentavos'),
      recebidoCentavos: soma(repasses, 'totalCentavos'),
      // Vendas ainda não repassadas, menos reembolsos de vendas já repassadas
      // que serão descontados no próximo repasse.
      aReceberCentavos: soma(ativas.filter(v => !v.repassada), 'repasseCentavos')
        - soma(vendas.filter(v => v.ajustePendente), 'repasseCentavos'),
    },
    porCurso: Object.values(porCurso),
    vendas: vendas.slice(0, 500),
    repasses,
    termo: { versao: priv.termoVersao || null, aceitoEm: priv.termoAceitoEm?.toMillis?.() || null },
    geradoEm: Date.now(),
  };
});

// ---- Registrar repasse (admin) ----------------------------------------------
// Junta as vendas ativas ainda não repassadas do período e marca cada uma com
// o id do repasse. Reembolsos de vendas que JÁ tinham sido repassadas entram
// como desconto no repasse seguinte (ajusteMatriculaIds).
exports.fecharRepasse = onCall(async (request) => {
  const adminUid = await exigirAdmin(request);
  const profissionalId = idValido(request.data?.profissionalId, 'Escolha o profissional.');
  const agoraMs = Date.now();
  const inicio = Math.max(0, Number(request.data?.inicio) || 0);
  const fim = Math.min(Number(request.data?.fim) || agoraMs, agoraMs + 86400000);
  if (inicio > fim) throw new HttpsError('invalid-argument', 'A data inicial está depois da final.');
  const comprovanteUrl = urlHttpsOpcional(request.data?.comprovanteUrl, 'Comprovante') || null;
  const observacao = String(request.data?.observacao || '').trim().slice(0, 500) || null;
  const pagoEmMs = Number(request.data?.pagoEm) || agoraMs;
  if (pagoEmMs < Date.UTC(2024, 0, 1) || pagoEmMs > agoraMs + 86400000) throw new HttpsError('invalid-argument', 'Confira a data do pagamento.');
  if (!(await db.collection('profissionais').doc(profissionalId).get()).exists) throw new HttpsError('not-found', 'Profissional não encontrado.');
  const fmt = (t) => new Date(t).toLocaleDateString('pt-BR', { timeZone: TIMEZONE });
  const rotulo = `${inicio ? fmt(inicio) : 'início'} a ${fmt(fim)}`;

  const repasseRef = db.collection('repasses').doc();
  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(db.collection('matriculas').where('profissionalId', '==', profissionalId));
    const vendas = [];
    const ajustes = [];
    snap.forEach(d => {
      const m = d.data();
      const t = m.criadaEm?.toMillis?.() || 0;
      if (m.status === 'ativa' && !m.repasseId && t >= inicio && t <= fim) vendas.push(d);
      if (m.status === 'reembolsada' && m.repasseId && !m.ajusteRepasseId) ajustes.push(d);
    });
    if (!vendas.length && !ajustes.length) throw new HttpsError('failed-precondition', 'Não há vendas a repassar neste período.');
    const bruto = vendas.reduce((a, d) => a + (d.data().repasseCentavos || 0), 0);
    const desconto = ajustes.reduce((a, d) => a + (d.data().repasseCentavos || 0), 0);
    const total = bruto - desconto;
    const agora = admin.firestore.FieldValue.serverTimestamp();
    tx.set(repasseRef, {
      profissionalId,
      periodo: { inicio: inicio ? admin.firestore.Timestamp.fromMillis(inicio) : null, fim: admin.firestore.Timestamp.fromMillis(fim), rotulo },
      matriculaIds: vendas.map(d => d.id),
      ajusteMatriculaIds: ajustes.map(d => d.id),
      vendasCentavos: bruto, descontosCentavos: desconto, totalCentavos: total,
      pagoEm: admin.firestore.Timestamp.fromMillis(pagoEmMs),
      comprovanteUrl, observacao,
      criadoPor: adminUid, criadoEm: agora,
    });
    vendas.forEach(d => tx.update(d.ref, { repasseId: repasseRef.id, repassadaEm: agora }));
    ajustes.forEach(d => tx.update(d.ref, { ajusteRepasseId: repasseRef.id }));
    return { vendas: vendas.length, ajustes: ajustes.length, totalCentavos: total };
  });
  return { id: repasseRef.id, ...resultado };
});

// ============================================================================
// CURSOS — DEMONSTRAÇÃO
// ============================================================================
// Um toque no painel publica (ou atualiza) o curso de demonstração "Yoga para
// acalmar a mente" com 5 vídeos do canal @yogaparavoce, um profissional de
// teste com vendas fictícias (para mostrar o portal) e libera o curso para a
// própria administradora assistir. Tudo marcado com `demo: true` e com ids
// fixos, para não duplicar e para poder remover depois.
const DEMO_CURSO_ID = 'demo-yoga-acalmar-mente';
const DEMO_PROF_ID = 'demo-yoga-para-voce';
const DEMO_AULAS = [
  ['UBnFUY9CwCo', 'Yoga e Outubro Rosa: Autocuidado Como Propósito Maior', true],
  ['vf0Vqb-TKpA', 'Meditação Guiada para Acalmar a Mente | Desacelere em Dias Intensos', false],
  ['babdn-oFs0U', 'O Que o Yoga Realmente Faz com a Sua Mente?', false],
  ['NEbLrV7VyrY', 'Eleições: como agir com serenidade?', false],
  ['I_TJX1dBTl4', 'Como Não Cair em Fake News? Uma Lição do Yoga de 2.000 Anos', false],
];

exports.criarDemonstracaoCursos = onCall(async (request) => {
  const adminUid = await exigirAdmin(request).then(() => request.auth.uid);
  const remover = request.data?.remover === true;
  const agora = admin.firestore.FieldValue.serverTimestamp();
  const lote = db.batch();
  const demosVendas = await db.collection('matriculas').where('demo', '==', true).get();

  if (remover) {
    demosVendas.docs.forEach(d => lote.delete(d.ref));
    lote.delete(db.collection('cursos').doc(DEMO_CURSO_ID));
    lote.delete(db.collection('cursosConteudo').doc(DEMO_CURSO_ID));
    lote.delete(db.collection('profissionais').doc(DEMO_PROF_ID));
    lote.delete(db.collection('profissionaisPrivado').doc(DEMO_PROF_ID));
    lote.delete(db.collection('usuarios').doc(adminUid).collection('cursos').doc(DEMO_CURSO_ID));
    await lote.commit();
    return { ok: true, removido: true };
  }

  lote.set(db.collection('profissionais').doc(DEMO_PROF_ID), {
    nome: 'Yoga para Você (demonstração)',
    bio: 'Canal de yoga e meditação com práticas simples para o dia a dia, para desacelerar a mente e cuidar do corpo com gentileza.',
    fotoUrl: 'https://i.ytimg.com/vi/UBnFUY9CwCo/hqdefault.jpg',
    repasseTipo: admin.firestore.FieldValue.delete(), repasseValor: admin.firestore.FieldValue.delete(), repasseBase: admin.firestore.FieldValue.delete(),
    ativo: true, demo: true, atualizadoEm: agora, criadoEm: agora,
  }, { merge: true });
  const privRef = db.collection('profissionaisPrivado').doc(DEMO_PROF_ID);
  const priv = await privRef.get();
  const tokenPortal = priv.data()?.tokenPortal || gerarTokenPortal();
  lote.set(privRef, {
    email: '', tokenPortal, demo: true, atualizadoEm: agora,
    repasseTipo: 'percentual', repasseValor: 50, repasseBase: 'bruto',
  }, { merge: true });

  // Aulas pagas protegidas: o youtubeId delas fica só em cursosConteudo.
  const aulasDemo = DEMO_AULAS.map(([youtubeId, titulo, gratis], i) => ({
    id: `a${i + 1}`, youtubeId, titulo, duracao: '', ordem: i + 1, gratis,
    thumb: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
  }));
  lote.set(db.collection('cursosConteudo').doc(DEMO_CURSO_ID), { ...conteudoDasAulas(aulasDemo), demo: true, atualizadoEm: agora });

  lote.set(db.collection('cursos').doc(DEMO_CURSO_ID), {
    titulo: 'Yoga para acalmar a mente',
    subtitulo: 'Cinco encontros curtos para respirar, desacelerar e olhar para dentro com carinho.',
    descricao: 'Um curso para quem sente a mente acelerada e quer encontrar, no próprio ritmo, um pouco mais de calma. Em cinco aulas, você conhece o que o yoga faz pela mente, pratica uma meditação guiada para dias intensos e aprende, com a sabedoria de mais de 2.000 anos do yoga, a atravessar momentos de ruído com mais presença. Não é preciso experiência: basta um cantinho tranquilo e alguns minutos para você.',
    capaUrl: 'https://i.ytimg.com/vi/UBnFUY9CwCo/hqdefault.jpg',
    preco: 97,
    ativo: true, destaque: true, demo: true, arquivado: false, protegerAulas: true,
    profissionalId: DEMO_PROF_ID,
    programa: [
      { titulo: 'Módulo 1 · Autocuidado como propósito', descricao: 'Por que cuidar de si não é egoísmo: o yoga como prática de presença e de cuidado.' },
      { titulo: 'Módulo 2 · Meditação para dias intensos', descricao: 'Uma meditação guiada para acalmar a mente e desacelerar quando tudo parece urgente.' },
      { titulo: 'Módulo 3 · O que o yoga faz com a mente', descricao: 'Atenção, respiração e emoções: o que acontece por dentro quando praticamos.' },
      { titulo: 'Módulo 4 · Serenidade em tempos de ruído', descricao: 'Como agir com calma em períodos de tensão e não se perder em notícias falsas.' },
    ],
    aulas: aulasPublicasCurso(aulasDemo, true),
    atualizadoEm: agora, criadoEm: agora,
  }, { merge: true });

  // Acesso da administradora, para demonstrar o player e o progresso.
  lote.set(db.collection('usuarios').doc(adminUid).collection('cursos').doc(DEMO_CURSO_ID), {
    cursoId: DEMO_CURSO_ID, matriculaId: 'demo', liberadoEm: agora, demo: true,
  }, { merge: true });

  // Vendas fictícias para o portal do profissional (só se ainda não existirem).
  if (demosVendas.empty) {
    const dias = [2, 5, 9, 14, 21, 26];
    dias.forEach((d, i) => {
      const valorPagoCentavos = 9700;
      const taxaStripeCentavos = 438;
      const { repasseCentavos, regra } = calcularRepasseCentavos(valorPagoCentavos, taxaStripeCentavos,
        { repasseTipo: 'percentual', repasseValor: 50, repasseBase: 'bruto' });
      const id = `demo_${String(i + 1).padStart(2, '0')}`;
      lote.set(db.collection('matriculas').doc(id), {
        uid: `demo-aluna-${i + 1}`, cursoId: DEMO_CURSO_ID, profissionalId: DEMO_PROF_ID,
        cursoTitulo: 'Yoga para acalmar a mente',
        valorPagoCentavos, taxaStripeCentavos, repasseCentavos, repasseRegra: regra, moeda: 'brl',
        stripeSessionId: `cs_demo_${id}`, stripePaymentIntent: `pi_demo_${crypto.randomBytes(6).toString('hex')}`, stripeChargeId: null,
        criadaEm: admin.firestore.Timestamp.fromMillis(Date.now() - d * 86400000),
        status: i === 3 ? 'reembolsada' : 'ativa', repasseId: null, demo: true,
      });
    });
  }

  await lote.commit();
  return {
    ok: true, cursoId: DEMO_CURSO_ID, profissionalId: DEMO_PROF_ID,
    linkPortal: `${PORTAL_PROFISSIONAL_URL}?t=${tokenPortal}`,
    linkAluna: `${SITE_URL}/curso.html`,
  };
});

// ============================================================================
// ADMINISTRAÇÃO DE PARCERIAS
// ============================================================================
// 1) Vigência dos contratos: os dados internos de cada parceria (início/fim,
//    contato e link do contrato) ficam em parceriasPrivado/{id}, que só as
//    administradoras leem. Todo dia a função alertarVigenciaParcerias avisa as
//    administradoras por push quando faltam 60, 30 e 7 dias para o fim e no
//    dia (ou depois, se já venceu sem aviso). Cada marco é enviado uma vez por
//    data de fim (alertasVigencia.fim/enviados): ao renovar o contrato (nova
//    data de fim) os avisos recomeçam. A parceria NÃO é desativada sozinha.
// 2) Comunicação automática: um curso novo publicado (ativo === true, sem
//    demo) ou uma parceria nova ativa vira um aviso "novidade" para todas as
//    usuárias em notificacoesEditoriais (origem 'admin' → pushComunicacaoAdmin
//    envia o push, abrindo a tela de `screen`). Uma vez por item, controlado
//    em comunicacoesAutomaticas/{tipo_id} (não grava no próprio documento,
//    para não disparar o gatilho de novo). Liga/desliga em
//    configuracoes/comunicacaoAutomatica { cursos, parcerias } (padrão: ligado).
const { onDocumentWritten } = require('firebase-functions/v2/firestore');

const MARCOS_VIGENCIA = [60, 30, 7, 0];
// Itens criados antes desta data já existiam quando a comunicação automática
// entrou no ar: reativá-los não é novidade (evita anunciar coisa antiga).
const INICIO_COMUNICACAO_AUTOMATICA_MS = Date.parse('2026-11-01T00:00:00-03:00');

const hojeISOParcerias = () => new Date().toLocaleDateString('sv-SE', { timeZone: TIMEZONE });
const ehDataISOParcerias = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));
function diasAteISO(hoje, alvo) {
  if (!ehDataISOParcerias(hoje) || !ehDataISOParcerias(alvo)) return null;
  return Math.round((Date.parse(`${alvo}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86400000);
}
const isoParaBRParcerias = (s) => String(s).split('-').reverse().join('/');

// Tokens de push das administradoras: role 'admin' e/ou e-mail da lista fixa.
async function tokensAdministradoras() {
  const [porRole, porEmail] = await Promise.all([
    db.collection('usuarios').where('role', '==', 'admin').get(),
    db.collection('usuarios').where('email', 'in', ADMIN_EMAILS_BENEFICIOS).get(),
  ]);
  const tokens = new Set();
  [...porRole.docs, ...porEmail.docs].forEach(d => { const t = d.data().pushToken; if (t) tokens.add(t); });
  return [...tokens];
}

exports.alertarVigenciaParcerias = onSchedule({ schedule: '15 9 * * *', timeZone: TIMEZONE }, async () => {
  const hoje = hojeISOParcerias();
  const [privSnap, pubSnap] = await Promise.all([
    db.collection('parceriasPrivado').get(),
    db.collection('parcerias').get(),
  ]);
  const publicas = new Map(pubSnap.docs.map(d => [d.id, d.data()]));
  const avisos = [];
  const marcacoes = [];
  for (const d of privSnap.docs) {
    const p = d.data();
    const pub = publicas.get(d.id);
    // Parceria apagada ou já desativada pela administradora: sem alerta.
    if (!pub || pub.ativo === false) continue;
    const dias = diasAteISO(hoje, p.fimParceria);
    if (dias == null || dias > MARCOS_VIGENCIA[0]) continue;
    // Marco atual: o menor marco que já foi alcançado (vencida conta como 0).
    const marco = dias <= 0 ? 0 : Math.min(...MARCOS_VIGENCIA.filter(m => dias <= m));
    const reg = p.alertasVigencia && p.alertasVigencia.fim === p.fimParceria ? p.alertasVigencia : null;
    const enviados = Array.isArray(reg?.enviados) ? reg.enviados.map(String) : [];
    if (enviados.includes(String(marco))) continue;
    const nome = String(pub.titulo || p.titulo || 'Parceria').trim();
    const fimBR = isoParaBRParcerias(p.fimParceria);
    avisos.push(dias < 0
      ? `O contrato da parceria "${nome}" venceu em ${fimBR}. Ela segue ativa no app até alguém decidir.`
      : dias === 0
        ? `O contrato da parceria "${nome}" vence hoje (${fimBR}).`
        : `O contrato da parceria "${nome}" vence em ${dias} dia${dias === 1 ? '' : 's'} (${fimBR}).`);
    // Marca este marco e os maiores (se o fim foi cadastrado já perto, não
    // manda depois o aviso de "60 dias").
    const novos = [...new Set([...enviados, ...MARCOS_VIGENCIA.filter(m => m >= marco).map(String)])];
    marcacoes.push({ ref: d.ref, alertasVigencia: {
      fim: p.fimParceria, enviados: novos, ultimoMarco: marco,
      ultimoEm: admin.firestore.FieldValue.serverTimestamp(),
    } });
  }
  if (!avisos.length) return;

  const tokens = await tokensAdministradoras();
  if (!tokens.length) {
    // Sem aparelho cadastrado: não marca, para avisar quando houver (o
    // Dashboard do painel mostra os contratos a vencer de qualquer forma).
    console.warn('[Vigência] nenhuma administradora com pushToken; avisos pendentes:', avisos.length);
    return;
  }
  const body = avisos.length === 1
    ? avisos[0]
    : `${avisos.length} contratos de parceria pedem atenção. ${avisos.slice(0, 3).join(' ')}${avisos.length > 3 ? ' …' : ''}`;
  await enviarPush(tokens.map(to => ({
    to, title: 'Painel Atravessia · Contratos', body, data: { screen: 'AdminParcerias' },
  })));

  const lote = db.batch();
  marcacoes.forEach(m => lote.set(m.ref, { alertasVigencia: m.alertasVigencia }, { merge: true }));
  await lote.commit();
});

async function comunicacaoAutomaticaLigada(tipo) {
  const s = await db.collection('configuracoes').doc('comunicacaoAutomatica').get();
  return s.data()?.[tipo] !== false;
}

// Criado agora ou depois da entrada da comunicação automática no ar.
function ehItemNovo(antes, depois) {
  if (!antes?.exists) return true;
  const criado = depois.data()?.criadoEm?.toMillis?.();
  return !!criado && criado >= INICIO_COMUNICACAO_AUTOMATICA_MS;
}

// Grava o aviso uma única vez por item. `create` falha se o controle já
// existir (outra execução chegou antes), o que evita aviso repetido.
async function comunicarNovidadeAutomatica({ tipo, id, texto, screen, extra = {} }) {
  const controle = db.collection('comunicacoesAutomaticas').doc(`${tipo}_${id}`);
  try {
    await controle.create({ tipo, refId: id, texto, criadoEm: admin.firestore.FieldValue.serverTimestamp() });
  } catch (e) {
    if (e?.code === 6 || /already exists/i.test(e?.message || '')) return;
    throw e;
  }
  const ref = await db.collection('notificacoesEditoriais').add({
    tipo: 'novidade', alvo: 'todos', texto, ativa: true,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    origem: 'admin', automatica: true, screen, refId: id, ...extra,
  });
  await controle.update({ notificacaoId: ref.id });
}

exports.comunicarNovoCurso = onDocumentWritten('cursos/{cursoId}', async (event) => {
  const antes = event.data?.before;
  const depois = event.data?.after;
  if (!depois?.exists) return;
  const id = event.params.cursoId;
  const c = depois.data();
  // Só na passagem para publicado (antes não existia ou não estava ativo).
  if (c.ativo !== true || c.demo === true || id.startsWith('demo')) return;
  if (antes?.exists && antes.data().ativo === true) return;
  if (!ehItemNovo(antes, depois)) return;
  const titulo = String(c.titulo || '').trim();
  if (!titulo || !(await comunicacaoAutomaticaLigada('cursos'))) return;
  // cursoId: o toque (push ou sininho) abre direto o curso.
  await comunicarNovidadeAutomatica({ tipo: 'curso', id, texto: `Novo curso na Atravessia: ${titulo} 💜`, screen: 'Cursos', extra: { cursoId: id } });
});

exports.comunicarNovaParceria = onDocumentWritten('parcerias/{parceriaId}', async (event) => {
  const antes = event.data?.before;
  const depois = event.data?.after;
  if (!depois?.exists) return;
  const p = depois.data();
  // No app, parceria sem `ativo` conta como ativa.
  if (p.ativo === false) return;
  if (antes?.exists && antes.data().ativo !== false) return;
  if (!ehItemNovo(antes, depois)) return;
  const titulo = String(p.titulo || '').trim();
  if (!titulo || !(await comunicacaoAutomaticaLigada('parcerias'))) return;
  await comunicarNovidadeAutomatica({
    tipo: 'parceria', id: event.params.parceriaId,
    texto: `Nova parceria no Experimente a vida: ${titulo}`, screen: 'Parcerias',
  });
});

// ============================================================================
// ATENDIMENTOS — atendimento psicológico online (individual e em grupo)
// ============================================================================
// Plano completo: docs/atendimentos/PLANO.md. Termo (TCLE): docs/atendimentos/tcle-modelo.md
//
// Coleções:
//   atendimentos/{id}          agenda; lida pela profissional e pelas participantes
//                              (participantesUids). Sem e-mails, nomes de outras
//                              pessoas do grupo nem links de convite (sigilo).
//   atendimentosPrivado/{id}   participantes (nome, e-mail, convite, status) e
//                              anotações privadas (prontuário mínimo). Só a
//                              profissional do atendimento lê; ela só grava as anotações.
//   atendimentosSala/{id}      sala no provedor de vídeo (só servidor).
//   convitesAtendimento/{tok}  um convite por pessoa (só servidor).
//   consentimentosAtendimento  registro do aceite do TCLE (só servidor).
//
// Configuração (configuracoes/atendimentos, editada no painel):
//   { provedor: 'daily' | 'jitsi', ativo: true|false, beneficioDias: 60,
//     salaDeEspera: true, crp: '06/000000', nomeProfissional?: 'Carla ...' }
//
// CHAVE DO DAILY — lida de process.env para o deploy não falhar enquanto ela
// não existe (mesmo cuidado do Atravessia Artes). Quando a conta existir:
//   1) firebase functions:secrets:set DAILY_API_KEY
//   2) troque a linha de chaveDaily() por:
//        const DAILY_API_KEY = defineSecret('DAILY_API_KEY');
//        const chaveDaily = () => DAILY_API_KEY.value();
//   3) em OPCOES_ATEND, acrescente: secrets: [DAILY_API_KEY]
// Sem a chave (ou com provedor 'jitsi'), as salas são criadas no Jitsi público
// (meet.jit.si) com nome aleatório longo: MODO DE TESTE, sem token por pessoa.
// ============================================================================

const chaveDaily = () => process.env.DAILY_API_KEY || '';
const OPCOES_ATEND = { memory: '256MiB', timeoutSeconds: 60 };
const TCLE_ATENDIMENTO_VERSAO = '1.0';
const ATEND_LIBERA_ANTES_MIN = 10;          // participante entra 10 min antes
const ATEND_LIBERA_ANTES_PROF_MIN = 30;     // profissional entra 30 min antes
const ATEND_TOLERANCIA_FIM_MIN = 30;        // sala segue aberta 30 min após o fim
const ATEND_MAX_GRUPO = 12;
const ATEND_URL_CONVITE = `${SITE_URL}/atendimento.html`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function configAtendimentos() {
  const d = (await db.collection('configuracoes').doc('atendimentos').get()).data() || {};
  const dias = Number(d.beneficioDias);
  return {
    provedor: d.provedor === 'jitsi' ? 'jitsi' : 'daily',
    ativo: d.ativo !== false,
    beneficioDias: Number.isFinite(dias) && dias >= 0 && dias <= 365 ? Math.round(dias) : 60,
    salaDeEspera: d.salaDeEspera !== false,
    crp: String(d.crp || '').slice(0, 40),
    nomeProfissional: String(d.nomeProfissional || '').slice(0, 120),
  };
}
// Provedor que vale de fato: Daily só com a chave configurada.
function provedorEfetivo(cfg) {
  return cfg.provedor === 'daily' && chaveDaily() ? 'daily' : 'jitsi';
}

// ---- Adaptador de provedor de vídeo ----------------------------------------
async function dailyApi(caminho, metodo = 'GET', corpo) {
  const r = await fetch(`https://api.daily.co/v1${caminho}`, {
    method: metodo,
    headers: { authorization: `Bearer ${chaveDaily()}`, 'content-type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('[Atendimentos] Daily respondeu', r.status, caminho, JSON.stringify(json).slice(0, 400));
    throw new HttpsError('unavailable', 'O serviço de vídeo não respondeu agora. Tente de novo em instantes.');
  }
  return json;
}

const PROVEDORES_VIDEO = {
  // Daily.co: sala privada, com início/fim, sem gravação (enable_recording
  // ausente = desligada), sala de espera (knocking) e token por pessoa.
  daily: {
    async criarSala({ inicioMs, fimMs, maxParticipantes }) {
      const nome = `atv-${crypto.randomBytes(12).toString('hex')}`;
      const sala = await dailyApi('/rooms', 'POST', {
        name: nome,
        privacy: 'private',
        properties: {
          nbf: Math.floor((inicioMs - ATEND_LIBERA_ANTES_PROF_MIN * 60000) / 1000),
          exp: Math.floor((fimMs + ATEND_TOLERANCIA_FIM_MIN * 60000) / 1000),
          max_participants: maxParticipantes,
          enable_knocking: true,
          enable_prejoin_ui: true,
          enable_chat: true,
          enable_screenshare: true,
          eject_at_room_exp: true,
          lang: 'pt-BR',
        },
      });
      return { roomName: sala.name, salaUrl: sala.url };
    },
    async atualizarSala(sala, { inicioMs, fimMs }) {
      await dailyApi(`/rooms/${encodeURIComponent(sala.roomName)}`, 'POST', {
        properties: {
          nbf: Math.floor((inicioMs - ATEND_LIBERA_ANTES_PROF_MIN * 60000) / 1000),
          exp: Math.floor((fimMs + ATEND_TOLERANCIA_FIM_MIN * 60000) / 1000),
        },
      });
    },
    async excluirSala(sala) {
      await dailyApi(`/rooms/${encodeURIComponent(sala.roomName)}`, 'DELETE').catch(() => {});
    },
    // Anfitriã: token de dona (admite quem bate na sala de espera, remove
    // pessoas). Participante: token com nome; com sala de espera ligada vai
    // sem token e "bate na porta" até a profissional admitir.
    async urlParticipante(sala, { nome, uid, anfitria, fimMs, salaDeEspera }) {
      if (!anfitria && salaDeEspera) return sala.salaUrl;
      const { token } = await dailyApi('/meeting-tokens', 'POST', {
        properties: {
          room_name: sala.roomName,
          user_name: String(nome || 'Participante').slice(0, 60),
          user_id: String(uid).slice(0, 36),
          is_owner: !!anfitria,
          exp: Math.floor((fimMs + ATEND_TOLERANCIA_FIM_MIN * 60000) / 1000),
          eject_at_token_exp: true,
          lang: 'pt-BR',
        },
      });
      return `${sala.salaUrl}?t=${encodeURIComponent(token)}`;
    },
  },
  // Jitsi público (meet.jit.si) — MODO DE TESTE: o nome longo e aleatório é a
  // única proteção; não há token por pessoa nem expiração. A primeira pessoa
  // a entrar precisa se identificar no próprio Jitsi para virar moderadora.
  jitsi: {
    async criarSala() {
      const nome = `Atravessia-${crypto.randomBytes(16).toString('hex')}`;
      return { roomName: nome, salaUrl: `https://meet.jit.si/${nome}` };
    },
    async atualizarSala() {},
    async excluirSala() {},
    async urlParticipante(sala, { nome }) {
      const cfg = [
        'config.prejoinConfig.enabled=true',
        'config.disableDeepLinking=true',
        'config.fileRecordingsEnabled=false',
        'config.liveStreamingEnabled=false',
        'config.localRecording.disable=true',
        `config.defaultLanguage=${encodeURIComponent('"ptBR"')}`,
        `userInfo.displayName=${encodeURIComponent(JSON.stringify(String(nome || '').slice(0, 60)))}`,
      ];
      return `${sala.salaUrl}#${cfg.join('&')}`;
    },
  },
};

// ---- Utilitários -------------------------------------------------------------
const linkConvite = (token) => `${ATEND_URL_CONVITE}?c=${token}`;
const idParticipante = () => crypto.randomBytes(6).toString('hex');

function limparPessoa(p) {
  const nome = String(p?.nome || '').trim().slice(0, 80);
  const email = String(p?.email || '').trim().toLowerCase().slice(0, 120);
  if (!nome) throw new HttpsError('invalid-argument', 'Informe o nome de cada pessoa.');
  if (email && !EMAIL_RE.test(email)) throw new HttpsError('invalid-argument', `E-mail inválido: ${email}`);
  return { nome, email };
}
function horarioValido(inicio, duracaoMin) {
  const inicioMs = Number(inicio);
  const dur = Math.round(Number(duracaoMin));
  if (!Number.isFinite(inicioMs) || inicioMs < Date.now() - 6 * 3600000 || inicioMs > Date.now() + 400 * 86400000) {
    throw new HttpsError('invalid-argument', 'Escolha uma data e um horário válidos.');
  }
  if (!Number.isFinite(dur) || dur < 15 || dur > 240) throw new HttpsError('invalid-argument', 'A duração vai de 15 a 240 minutos.');
  return { inicioMs, duracaoMin: dur, fimMs: inicioMs + dur * 60000 };
}
function valorOpcional(v) {
  if (v === '' || v == null) return null;
  const c = centavos(v);
  if (c == null || c > 10000000) throw new HttpsError('invalid-argument', 'Valor inválido.');
  return c;
}

async function novoConvite(atendimentoId, participanteId, nome, email, fimMs) {
  const token = gerarTokenPortal();
  await db.collection('convitesAtendimento').doc(token).set({
    atendimentoId, participanteId, nome, email: email || '', uid: null, revogado: false,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    expiraEm: admin.firestore.Timestamp.fromMillis(fimMs + 24 * 3600000),
  });
  return token;
}

async function carregarAtendimentoDaProfissional(request, id) {
  const uid = await exigirAdmin(request);
  idValido(id, 'Atendimento inválido.');
  const ref = db.collection('atendimentos').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Atendimento não encontrado.');
  if (snap.data().profissionalUid !== uid) throw new HttpsError('permission-denied', 'Só a profissional deste atendimento pode alterá-lo.');
  return { uid, ref, a: snap.data() };
}

// Cortesia de acompanhamento: acesso completo ao app até X dias depois da
// sessão. Nunca encurta uma cortesia maior e não mexe em quem já assina.
async function concederBeneficioAtendimento(uid, fimMs, dias) {
  if (!dias) return { tipo: 'nenhum' };
  const ref = db.collection('usuarios').doc(uid);
  const u = (await ref.get()).data() || {};
  if (u.acessoTotal === true || planoNumero(u) >= 1) return { tipo: 'ja-assinante' };
  const alvo = Math.max(Date.now(), fimMs) + dias * 86400000;
  const atual = u.cortesia?.ativo === true ? (u.cortesia?.expiracao?.toMillis?.() || 0) : 0;
  if (atual >= alvo) return { tipo: 'cortesia', ate: atual };
  await ref.set({ cortesia: { ativo: true, expiracao: admin.firestore.Timestamp.fromMillis(alvo), origem: 'atendimento' } }, { merge: true });
  return { tipo: 'cortesia', ate: alvo };
}

function dadosPublicosAtendimento(a) {
  return {
    titulo: a.titulo, tipo: a.tipo, status: a.status,
    inicio: a.inicio?.toMillis?.() || 0, fim: a.fim?.toMillis?.() || 0, duracaoMin: a.duracaoMin,
    profissionalNome: a.profissionalNome || '', crp: a.crp || '',
    modoTeste: a.provedor !== 'daily',
  };
}

// ---- Admin: estado do provedor -------------------------------------------------
exports.statusAtendimentos = onCall(OPCOES_ATEND, async (request) => {
  await exigirAdmin(request);
  const cfg = await configAtendimentos();
  const efetivo = provedorEfetivo(cfg);
  return { provedorConfigurado: cfg.provedor, provedor: efetivo, modoTeste: efetivo !== 'daily', temChaveDaily: !!chaveDaily(), ativo: cfg.ativo };
});

// ---- Admin: criar atendimento ------------------------------------------------
exports.criarAtendimento = onCall(OPCOES_ATEND, async (request) => {
  const uid = await exigirAdmin(request);
  const cfg = await configAtendimentos();
  if (!cfg.ativo) throw new HttpsError('failed-precondition', 'Os atendimentos estão desligados em Atendimentos › Configurações.');
  const d = request.data || {};
  const tipo = d.tipo === 'grupo' ? 'grupo' : 'individual';
  const titulo = String(d.titulo || '').trim().slice(0, 120) || (tipo === 'grupo' ? 'Atendimento em grupo' : 'Atendimento individual');
  const { inicioMs, duracaoMin, fimMs } = horarioValido(d.inicio, d.duracaoMin);
  const pessoas = (Array.isArray(d.participantes) ? d.participantes : []).map(limparPessoa);
  if (!pessoas.length) throw new HttpsError('invalid-argument', 'Adicione pelo menos uma pessoa.');
  if (tipo === 'individual' && pessoas.length > 1) throw new HttpsError('invalid-argument', 'No atendimento individual há uma pessoa. Para mais, escolha "Em grupo".');
  if (pessoas.length > ATEND_MAX_GRUPO) throw new HttpsError('invalid-argument', `O grupo pode ter até ${ATEND_MAX_GRUPO} pessoas.`);

  const prof = (await db.collection('usuarios').doc(uid).get()).data() || {};
  const provedor = provedorEfetivo(cfg);
  const sala = await PROVEDORES_VIDEO[provedor].criarSala({ inicioMs, fimMs, maxParticipantes: Math.max(pessoas.length + 2, 3) });

  const ref = db.collection('atendimentos').doc();
  const participantes = [];
  for (const p of pessoas) {
    const id = idParticipante();
    const convite = await novoConvite(ref.id, id, p.nome, p.email, fimMs);
    participantes.push({ id, nome: p.nome, email: p.email, convite, status: 'convidado', uid: null });
  }
  const agora = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(ref, {
    tipo, titulo, status: 'agendado', provedor,
    profissionalUid: uid,
    profissionalNome: cfg.nomeProfissional || prof.nome || 'Psicóloga Atravessia',
    crp: cfg.crp,
    inicio: admin.firestore.Timestamp.fromMillis(inicioMs),
    fim: admin.firestore.Timestamp.fromMillis(fimMs),
    duracaoMin,
    participantesUids: [],
    totalParticipantes: participantes.length,
    valorCentavos: valorOpcional(d.valor),
    pago: d.pago === true,
    lembrete60Enviado: false, lembrete10Enviado: false,
    criadoEm: agora, atualizadoEm: agora,
  });
  batch.set(db.collection('atendimentosPrivado').doc(ref.id), {
    profissionalUid: uid, participantes, anotacoes: '', criadoEm: agora,
  });
  batch.set(db.collection('atendimentosSala').doc(ref.id), { provedor, ...sala, criadoEm: agora });
  await batch.commit();
  return {
    id: ref.id, provedor, modoTeste: provedor !== 'daily',
    convites: participantes.map(p => ({ participanteId: p.id, nome: p.nome, link: linkConvite(p.convite) })),
  };
});

// ---- Admin: atualizar (horário, título, pessoas, status, valor) --------------
exports.atualizarAtendimento = onCall(OPCOES_ATEND, async (request) => {
  const d = request.data || {};
  const { ref, a } = await carregarAtendimentoDaProfissional(request, d.id);
  const privRef = db.collection('atendimentosPrivado').doc(d.id);
  const priv = (await privRef.get()).data() || { participantes: [] };
  const salaSnap = await db.collection('atendimentosSala').doc(d.id).get();
  const sala = salaSnap.data();
  const prov = PROVEDORES_VIDEO[sala?.provedor] || PROVEDORES_VIDEO.jitsi;
  const upd = { atualizadoEm: admin.firestore.FieldValue.serverTimestamp() };
  let participantes = [...(priv.participantes || [])];
  let fimMs = a.fim?.toMillis?.() || Date.now();

  if (d.titulo != null) upd.titulo = String(d.titulo).trim().slice(0, 120) || a.titulo;
  if (d.valor !== undefined) upd.valorCentavos = valorOpcional(d.valor);
  if (d.pago !== undefined) upd.pago = d.pago === true;
  if (d.inicio != null || d.duracaoMin != null) {
    const h = horarioValido(d.inicio ?? a.inicio.toMillis(), d.duracaoMin ?? a.duracaoMin);
    fimMs = h.fimMs;
    Object.assign(upd, {
      inicio: admin.firestore.Timestamp.fromMillis(h.inicioMs), fim: admin.firestore.Timestamp.fromMillis(h.fimMs),
      duracaoMin: h.duracaoMin, lembrete60Enviado: false, lembrete10Enviado: false,
    });
    if (sala) await prov.atualizarSala(sala, h);
    // Convites passam a valer até 1 dia depois do novo fim.
    const exp = admin.firestore.Timestamp.fromMillis(h.fimMs + 24 * 3600000);
    await Promise.all(participantes.filter(p => p.convite).map(p => db.collection('convitesAtendimento').doc(p.convite).set({ expiraEm: exp }, { merge: true })));
  }
  if (Array.isArray(d.adicionar) && d.adicionar.length) {
    const novos = d.adicionar.map(limparPessoa);
    const ativos = participantes.filter(p => p.status !== 'removido').length;
    if (a.tipo === 'individual' && ativos + novos.length > 1) throw new HttpsError('invalid-argument', 'O atendimento individual já tem uma pessoa.');
    if (ativos + novos.length > ATEND_MAX_GRUPO) throw new HttpsError('invalid-argument', `O grupo pode ter até ${ATEND_MAX_GRUPO} pessoas.`);
    for (const p of novos) {
      const id = idParticipante();
      participantes.push({ id, nome: p.nome, email: p.email, convite: await novoConvite(d.id, id, p.nome, p.email, fimMs), status: 'convidado', uid: null });
    }
  }
  if (Array.isArray(d.remover) && d.remover.length) {
    participantes = participantes.map(p => {
      if (!d.remover.includes(p.id)) return p;
      if (p.convite) db.collection('convitesAtendimento').doc(p.convite).set({ revogado: true }, { merge: true }).catch(() => {});
      return { ...p, status: 'removido', convite: null };
    });
  }
  if (d.status && ['agendado', 'cancelado', 'concluido'].includes(d.status)) {
    upd.status = d.status;
    if (d.status === 'cancelado' && sala) await prov.excluirSala(sala);
  }
  upd.participantesUids = [...new Set(participantes.filter(p => p.status !== 'removido' && p.uid).map(p => p.uid))];
  upd.totalParticipantes = participantes.filter(p => p.status !== 'removido').length;
  await ref.update(upd);
  await privRef.set({ participantes }, { merge: true });

  // Aviso de cancelamento ou de novo horário para quem já aceitou.
  if ((upd.status === 'cancelado' && a.status !== 'cancelado') || upd.inicio) {
    const quando = (upd.inicio || a.inicio).toDate().toLocaleString('pt-BR', { timeZone: TIMEZONE, dateStyle: 'short', timeStyle: 'short' });
    const texto = upd.status === 'cancelado' ? `O atendimento de ${quando} foi cancelado. Se precisar, fale com a sua psicóloga.` : `Seu atendimento mudou para ${quando}.`;
    await avisarParticipantesAtendimento(upd.participantesUids, texto);
  }
  return { ok: true };
});

async function avisarParticipantesAtendimento(uids, texto, screen = 'MeusAtendimentos') {
  if (!uids?.length) return;
  const snaps = await Promise.all(uids.map(u => db.collection('usuarios').doc(u).get()));
  await enviarPush(snaps.map(s => s.data()?.pushToken).filter(Boolean)
    .map(to => ({ to, title: 'Atravessia · Atendimento', body: texto, data: { screen, tipo: 'atendimento' } })));
}

// ---- Admin: novo link de convite (o anterior deixa de valer) -----------------
exports.gerarConviteAtendimento = onCall(OPCOES_ATEND, async (request) => {
  const d = request.data || {};
  const { a } = await carregarAtendimentoDaProfissional(request, d.id);
  const privRef = db.collection('atendimentosPrivado').doc(d.id);
  const priv = (await privRef.get()).data() || {};
  const participantes = [...(priv.participantes || [])];
  const i = participantes.findIndex(p => p.id === d.participanteId && p.status !== 'removido');
  if (i < 0) throw new HttpsError('not-found', 'Pessoa não encontrada neste atendimento.');
  const p = participantes[i];
  if (p.convite) await db.collection('convitesAtendimento').doc(p.convite).set({ revogado: true }, { merge: true });
  const token = await novoConvite(d.id, p.id, p.nome, p.email, a.fim?.toMillis?.() || Date.now());
  // Se a pessoa já tinha aceitado, o novo link continua ligado à mesma conta.
  if (p.uid) await db.collection('convitesAtendimento').doc(token).set({ uid: p.uid }, { merge: true });
  participantes[i] = { ...p, convite: token };
  await privRef.set({ participantes }, { merge: true });
  return { link: linkConvite(token) };
});

// ---- Público: dados mínimos do convite ---------------------------------------
async function conviteValido(request, { contarFalha = true } = {}) {
  const { ip } = origemChamada(request);
  const chave = ip || 'sem-ip';
  const LIM_FALHA = { max: 10, janelaMs: 30 * 60 * 1000 };
  if (await passouDoLimite(`atend:${chave}`, { max: 60, janelaMs: 10 * 60 * 1000 })) throw new HttpsError('resource-exhausted', MSG_MUITAS_TENTATIVAS);
  if (await passouDoLimite(`atendfalha:${chave}`, { ...LIM_FALHA, incrementar: false })) throw new HttpsError('resource-exhausted', MSG_MUITAS_TENTATIVAS);
  const falhar = async (codigo, msg) => {
    if (contarFalha) await passouDoLimite(`atendfalha:${chave}`, LIM_FALHA);
    throw new HttpsError(codigo, msg);
  };
  const token = String(request.data?.token || '');
  if (!TOKEN_PORTAL.test(token)) await falhar('invalid-argument', 'Link inválido. Abra o link exatamente como você recebeu.');
  const cRef = db.collection('convitesAtendimento').doc(token);
  const c = (await cRef.get()).data();
  if (!c || c.revogado) await falhar('not-found', 'Este convite não é mais válido. Peça um novo link à sua psicóloga.');
  const aSnap = await db.collection('atendimentos').doc(c.atendimentoId).get();
  if (!aSnap.exists) await falhar('not-found', 'Este atendimento não existe mais.');
  return { token, cRef, c, aRef: aSnap.ref, a: aSnap.data() };
}

exports.obterConviteAtendimento = onCall(OPCOES_ATEND, async (request) => {
  const { c, a } = await conviteValido(request);
  const uid = request.auth?.uid || null;
  const expirado = (c.expiraEm?.toMillis?.() || 0) < Date.now();
  return {
    atendimento: dadosPublicosAtendimento(a),
    convidada: { nome: c.nome, email: c.uid ? '' : (c.email || '') },
    aceito: !!c.uid,
    vinculadoAVoce: !!uid && c.uid === uid,
    atendimentoId: !!uid && c.uid === uid ? c.atendimentoId : null,
    usadoPorOutraConta: !!c.uid && c.uid !== uid,
    expirado,
    liberaAntesMin: ATEND_LIBERA_ANTES_MIN,
    tcleVersao: TCLE_ATENDIMENTO_VERSAO,
    agora: Date.now(),
  };
});

// ---- Autenticada: aceitar o convite, vincular a conta e ganhar o benefício ----
exports.aceitarConviteAtendimento = onCall(OPCOES_ATEND, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Entre ou crie sua conta para aceitar o convite.');
  const { cRef, c, aRef, a } = await conviteValido(request);
  if (request.data?.aceiteTcle !== true || request.data?.tcleVersao !== TCLE_ATENDIMENTO_VERSAO) {
    throw new HttpsError('failed-precondition', 'Para continuar, leia e aceite o termo do atendimento online.');
  }
  if (c.uid && c.uid !== uid) throw new HttpsError('permission-denied', 'Este convite já foi aceito por outra conta. Entre com a conta usada antes ou peça um novo link.');
  if (!c.uid && (c.expiraEm?.toMillis?.() || 0) < Date.now()) throw new HttpsError('deadline-exceeded', 'Este convite expirou. Peça um novo link à sua psicóloga.');
  if (a.status === 'cancelado') throw new HttpsError('failed-precondition', 'Este atendimento foi cancelado.');

  const email = String(request.auth.token?.email || '').toLowerCase();
  const nome = String(request.data?.nome || c.nome || '').trim().slice(0, 80) || c.nome;
  // Conta nova criada pelo link: perfil igual ao do cadastro do app.
  const uRef = db.collection('usuarios').doc(uid);
  const uSnap = await uRef.get();
  if (!uSnap.exists) {
    await uRef.set({
      nome, apelido: '', telefone: '', cidade: '', email, linkEmpresa: null, empresa: '',
      plano: 0, role: ADMIN_EMAILS_BENEFICIOS.includes(email) ? 'admin' : 'user',
      onboardingPendente: true, origem: 'atendimento',
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  const privRef = db.collection('atendimentosPrivado').doc(c.atendimentoId);
  await db.runTransaction(async (tx) => {
    const priv = (await tx.get(privRef)).data() || {};
    const aAtual = (await tx.get(aRef)).data() || {};
    const participantes = (priv.participantes || []).map(p => (p.id === c.participanteId
      ? { ...p, uid, status: p.status === 'removido' ? 'removido' : 'aceito', aceitoEm: p.aceitoEm || admin.firestore.Timestamp.now(), emailConta: email, tcleVersao: TCLE_ATENDIMENTO_VERSAO }
      : p));
    tx.set(privRef, { participantes }, { merge: true });
    tx.update(aRef, { participantesUids: [...new Set([...(aAtual.participantesUids || []), uid])] });
    tx.set(cRef, { uid, aceitoEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });

  const { ip, ua } = origemChamada(request);
  await db.collection('consentimentosAtendimento').add({
    uid, atendimentoId: c.atendimentoId, participanteId: c.participanteId, tcleVersao: TCLE_ATENDIMENTO_VERSAO,
    ip: resumirIp(ip), dispositivo: resumirUserAgent(ua),
    aceitoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  const cfg = await configAtendimentos();
  const beneficio = await concederBeneficioAtendimento(uid, a.fim?.toMillis?.() || Date.now(), cfg.beneficioDias);
  return { ok: true, atendimentoId: c.atendimentoId, beneficio };
});

// ---- Autenticada: entrar na sala ---------------------------------------------
exports.entrarNaSala = onCall(OPCOES_ATEND, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta para acessar a sala.');
  const id = idValido(request.data?.atendimentoId, 'Atendimento inválido.');
  const aSnap = await db.collection('atendimentos').doc(id).get();
  if (!aSnap.exists) throw new HttpsError('not-found', 'Atendimento não encontrado.');
  const a = aSnap.data();
  const anfitria = a.profissionalUid === uid;
  if (!anfitria && !(a.participantesUids || []).includes(uid)) throw new HttpsError('permission-denied', 'Você não está neste atendimento.');
  if (a.status === 'cancelado') throw new HttpsError('failed-precondition', 'Este atendimento foi cancelado.');
  const inicioMs = a.inicio.toMillis();
  const fimMs = a.fim.toMillis();
  const antes = (anfitria ? ATEND_LIBERA_ANTES_PROF_MIN : ATEND_LIBERA_ANTES_MIN) * 60000;
  const agora = Date.now();
  if (agora < inicioMs - antes) {
    throw new HttpsError('failed-precondition', `A sala abre ${anfitria ? ATEND_LIBERA_ANTES_PROF_MIN : ATEND_LIBERA_ANTES_MIN} minutos antes do horário.`);
  }
  if (agora > fimMs + ATEND_TOLERANCIA_FIM_MIN * 60000) throw new HttpsError('failed-precondition', 'Este atendimento já terminou.');

  const sala = (await db.collection('atendimentosSala').doc(id).get()).data();
  if (!sala) throw new HttpsError('not-found', 'A sala deste atendimento não foi encontrada.');
  const cfg = await configAtendimentos();
  const priv = (await db.collection('atendimentosPrivado').doc(id).get()).data() || {};
  const eu = (priv.participantes || []).find(p => p.uid === uid);
  if (!anfitria && eu?.status === 'removido') throw new HttpsError('permission-denied', 'Você não está mais neste atendimento.');
  const nome = anfitria ? `${a.profissionalNome || 'Psicóloga'} (anfitriã)` : (eu?.nome || 'Participante');
  const prov = PROVEDORES_VIDEO[sala.provedor] || PROVEDORES_VIDEO.jitsi;
  const url = await prov.urlParticipante(sala, { nome, uid, anfitria, fimMs, salaDeEspera: cfg.salaDeEspera });

  if (!anfitria) {
    // Presença (sem conteúdo da sessão) e renovação da cortesia de acompanhamento.
    const participantes = (priv.participantes || []).map(p => (p.uid === uid ? { ...p, ultimaEntradaEm: admin.firestore.Timestamp.now() } : p));
    await db.collection('atendimentosPrivado').doc(id).set({ participantes }, { merge: true });
    await concederBeneficioAtendimento(uid, fimMs, cfg.beneficioDias).catch(e => console.warn('[Atendimentos] benefício', e?.message));
  }
  return { url, provedor: sala.provedor, modoTeste: sala.provedor !== 'daily', embutir: sala.provedor === 'daily', anfitria };
});

// ---- Lembretes: 1 h e 10 min antes -------------------------------------------
exports.lembretesAtendimento = onSchedule({ schedule: 'every 5 minutes', timeZone: TIMEZONE }, async () => {
  const agora = Date.now();
  const snap = await db.collection('atendimentos')
    .where('inicio', '>=', admin.firestore.Timestamp.fromMillis(agora - 60000))
    .where('inicio', '<=', admin.firestore.Timestamp.fromMillis(agora + 61 * 60000))
    .get();
  for (const docSnap of snap.docs) {
    const a = docSnap.data();
    if (a.status !== 'agendado') continue;
    const faltaMin = (a.inicio.toMillis() - agora) / 60000;
    let marca = null;
    let texto = '';
    if (faltaMin <= 12 && !a.lembrete10Enviado) {
      marca = { lembrete10Enviado: true, lembrete60Enviado: true };
      texto = 'Seu atendimento começa em 10 minutos. A sala já está aberta: toque para entrar.';
    } else if (faltaMin <= 61 && faltaMin > 12 && !a.lembrete60Enviado) {
      marca = { lembrete60Enviado: true };
      texto = 'Seu atendimento começa em 1 hora. Se puder, procure um lugar reservado e teste a câmera e o microfone.';
    }
    if (!marca) continue;
    await docSnap.ref.update(marca);
    await avisarParticipantesAtendimento(a.participantesUids || [], texto);
    await avisarParticipantesAtendimento([a.profissionalUid],
      `${a.titulo}: começa em ${faltaMin <= 12 ? '10 minutos' : '1 hora'}.`, 'AdminAtendimentos');
  }
});

// =============================================================================
// IMOBILIÁRIAS — "Lar e recomeço" (parceria Atravessia + imobiliária + arquiteto)
// =============================================================================
// A usuária demonstra interesse numa imobiliária parceira e recebe um código
// (ATR-IMV-XXXX) e um QR Code. A imobiliária acompanha os leads pelo portal
// imobiliaria.html?t=<token> (sem login). Quando o negócio fecha, a imobiliária
// repassa o valor combinado; a Atravessia confirma o recebimento (valor
// congelado) e agenda uma consultoria online com arquiteto parceiro.
// Coleções: imobiliarias, imobiliariasPrivado, imoveis, arquitetos,
// arquitetosPrivado, indicacoesImoveis (lead; a usuária lê o próprio) e
// indicacoesImoveisPrivado (valores do negócio e do repasse; só admin).
// Ver docs/imobiliarias/README.md.

const PORTAL_IMOBILIARIA_URL = `${SITE_URL}/imobiliaria.html`;
const STATUS_IMV = ['novo', 'em_contato', 'visita', 'proposta', 'fechado', 'pago', 'consultoria_agendada', 'concluido', 'perdido'];
const ABERTOS_IMV = ['novo', 'em_contato', 'visita', 'proposta'];
// Mudanças de status que a imobiliária pode fazer pelo portal. "pago" em
// diante é só da Atravessia. "fechado → fechado" serve para corrigir o valor
// do negócio enquanto o repasse não foi confirmado.
const TRANSICOES_IMOBILIARIA = {
  novo: ['em_contato', 'visita', 'proposta', 'fechado', 'perdido'],
  em_contato: ['visita', 'proposta', 'fechado', 'perdido'],
  visita: ['em_contato', 'proposta', 'fechado', 'perdido'],
  proposta: ['em_contato', 'visita', 'fechado', 'perdido'],
  fechado: ['fechado'],
  perdido: ['em_contato'],
};
const VERSAO_CONSENTIMENTO_IMV = '1.0';
const TEXTO_CONSENTIMENTO_IMV = 'Autorizo a Atravessia a compartilhar meu nome, meu telefone e o que escrevi aqui com esta imobiliária, '
  + 'só para que ela entre em contato sobre este interesse. A imobiliária não recebe nenhum outro dado meu '
  + '(nem check-ins, nem diário, nem plano). Posso pedir a exclusão a qualquer momento.';

const limparTextoImv = (v, max) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
// Valor em reais vindo do portal/painel: número ou texto ("1.234,56" ou "1234.56").
function centavosImv(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return centavos(v);
  let t = String(v).replace(/[^\d.,]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return centavos(t);
}
const agoraTsImv = () => admin.firestore.Timestamp.now();
const eventoImv = (status, por, extra = {}) => ({ status, em: agoraTsImv(), por, ...extra });

async function gerarCodigoImv() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const tam = tentativa < 5 ? 4 : 5;
    let s = '';
    for (let i = 0; i < tam; i++) s += alfabeto[crypto.randomInt(alfabeto.length)];
    const codigo = `ATR-IMV-${s}`;
    const existe = await db.collection('indicacoesImoveis').where('codigo', '==', codigo).limit(1).get();
    if (existe.empty) return codigo;
  }
  throw new HttpsError('unavailable', 'Não foi possível gerar o código agora. Tente de novo.');
}

// Regra combinada com a imobiliária (imobiliariasPrivado): venda e aluguel
// separados; 'percentual' sobre o valor do negócio (no aluguel, sobre o
// aluguel mensal informado) ou 'fixo' em reais por negócio.
function regraRepasseImv(priv, interesse) {
  const chave = interesse === 'alugar' ? 'Aluguel' : 'Venda';
  return {
    tipo: priv?.[`repasse${chave}Tipo`] === 'percentual' ? 'percentual' : 'fixo',
    valor: Number(priv?.[`repasse${chave}Valor`]) || 0,
  };
}
function calcularRepasseImv(priv, interesse, valorNegocioCentavos) {
  const r = regraRepasseImv(priv, interesse);
  if (r.valor <= 0) return 0;
  if (r.tipo === 'percentual') return Math.max(0, Math.round((Number(valorNegocioCentavos) || 0) * Math.min(r.valor, 100) / 100));
  return Math.round(r.valor * 100);
}

const MSG_USUARIA_IMV = {
  em_contato: (l) => `A ${l.imobiliariaNome} recebeu sua indicação e vai falar com você em breve.`,
  visita: (l) => `Visita registrada com a ${l.imobiliariaNome}. Que seja um bom encontro com o novo lar.`,
  proposta: (l) => `Sua proposta com a ${l.imobiliariaNome} está em andamento. Seguimos com você.`,
  fechado: (l) => `Negócio fechado com a ${l.imobiliariaNome}! Assim que a imobiliária confirmar o repasse, liberamos sua consultoria com arquiteto parceiro.`,
  pago: () => 'Sua consultoria online com arquiteto parceiro está liberada. Em breve combinamos a data com você.',
  consultoria_agendada: (l, x) => `Sua consultoria com arquiteto parceiro está marcada${x?.quando ? ` para ${x.quando}` : ''}. O link está no app.`,
  concluido: () => 'Consultoria concluída. Que esse novo lar acolha os seus recomeços.',
  perdido: (l) => `A negociação com a ${l.imobiliariaNome} foi encerrada. Quando quiser, você pode fazer uma nova indicação.`,
};

// Aviso no sininho (sem detalhes: o texto fica no lead, que só a dona lê) + push.
async function avisarUsuariaImv(lead, status, extra) {
  const msg = MSG_USUARIA_IMV[status];
  if (!msg || !lead?.uid) return;
  try {
    await db.collection('notificacoesEditoriais').add({
      usuarioId: lead.uid, tipo: 'imovel', screen: 'MinhasIndicacoesImoveis',
      texto: 'Sua indicação de imóvel tem novidades. Toque para acompanhar.',
      ativa: true, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { console.warn('[imoveis] aviso não gravado:', e?.message); }
  await pushParaUsuaria(lead.uid, msg(lead, extra), 'MinhasIndicacoesImoveis');
}

async function avisarAdminsImv(body) {
  try {
    const tokens = await tokensAdministradoras();
    await enviarPush(tokens.map(to => ({ to, title: 'Atravessia · Imobiliárias', body, data: { screen: 'AdminImobiliarias' } })));
  } catch (e) { console.warn('[imoveis] push admin não enviado:', e?.message); }
}

// Data "AAAA-MM-DDTHH:mm" no horário de Brasília (sem horário de verão).
function dataHoraBrasiliaImv(s) {
  const t = String(s || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) return null;
  const ms = Date.parse(`${t}:00-03:00`);
  return Number.isNaN(ms) ? null : ms;
}
const textoDataHoraImv = (ms) => new Date(ms).toLocaleString('pt-BR', { timeZone: TIMEZONE, dateStyle: 'short', timeStyle: 'short' });

// ---- 1) Usuária envia o interesse (gera código + QR) -------------------------
exports.criarIndicacaoImovel = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta para enviar o interesse.');
  const d = request.data || {};
  if (d.consentimento !== true) throw new HttpsError('invalid-argument', 'Para enviar, é preciso autorizar o compartilhamento do nome e do telefone com a imobiliária.');
  const imobiliariaId = idValido(d.imobiliariaId, 'Imobiliária inválida.');
  const interesse = d.interesse === 'alugar' ? 'alugar' : 'comprar';
  const nome = limparTextoImv(d.nome, 120);
  const telefone = String(d.telefone || '').replace(/\D/g, '').slice(0, 15);
  if (nome.length < 2) throw new HttpsError('invalid-argument', 'Informe seu nome.');
  if (telefone.length < 10) throw new HttpsError('invalid-argument', 'Informe um telefone com DDD.');

  if (await passouDoLimite(`imv-lead:${uid}`, { max: 10, janelaMs: 24 * 60 * 60 * 1000 })) {
    throw new HttpsError('resource-exhausted', 'Você já enviou muitas indicações hoje. Tente de novo amanhã.');
  }

  const imobSnap = await db.collection('imobiliarias').doc(imobiliariaId).get();
  if (!imobSnap.exists || imobSnap.data().ativo === false) throw new HttpsError('failed-precondition', 'Esta imobiliária não está disponível no momento.');
  const imob = imobSnap.data();

  let imovelId = null;
  let imovelTitulo = '';
  if (d.imovelId) {
    imovelId = idValido(d.imovelId, 'Imóvel inválido.');
    const im = await db.collection('imoveis').doc(imovelId).get();
    if (!im.exists || im.data().imobiliariaId !== imobiliariaId || im.data().ativo === false) throw new HttpsError('failed-precondition', 'Este imóvel não está mais disponível.');
    imovelTitulo = limparTextoImv(im.data().titulo, 160);
  }

  // Já existe uma indicação em aberto para o mesmo destino: devolve a mesma.
  const minhas = await db.collection('indicacoesImoveis').where('uid', '==', uid).get();
  const repetida = minhas.docs.find(x => {
    const v = x.data();
    return v.imobiliariaId === imobiliariaId && (v.imovelId || null) === imovelId && ABERTOS_IMV.includes(v.status);
  });
  if (repetida) return { id: repetida.id, codigo: repetida.data().codigo, existente: true };

  const codigo = await gerarCodigoImv();
  const tokenSeguro = crypto.randomBytes(18).toString('base64url');
  const ref = db.collection('indicacoesImoveis').doc();
  const agora = admin.firestore.FieldValue.serverTimestamp();
  const { ip, ua } = origemChamada(request);
  await ref.set({
    uid, nome, telefone,
    imobiliariaId, imobiliariaNome: limparTextoImv(imob.nome, 120),
    imovelId, imovelTitulo,
    codigo, tokenSeguro,
    linkValidacao: `${PORTAL_IMOBILIARIA_URL}?c=${encodeURIComponent(codigo)}&v=${tokenSeguro}`,
    interesse,
    faixaPreco: limparTextoImv(d.faixaPreco, 60),
    bairros: limparTextoImv(d.bairros, 200),
    prazo: limparTextoImv(d.prazo, 60),
    observacoes: limparTextoImv(d.observacoes, 600),
    consentimento: {
      aceito: true,
      versao: limparTextoImv(d.versaoConsentimento, 10) || VERSAO_CONSENTIMENTO_IMV,
      texto: TEXTO_CONSENTIMENTO_IMV,
      em: agoraTsImv(),
      ip: resumirIp(ip), navegador: resumirUserAgent(ua),
    },
    status: 'novo',
    historico: [eventoImv('novo', 'usuaria')],
    criadoEm: agora, atualizadoEm: agora,
  });
  await db.collection('indicacoesImoveisPrivado').doc(ref.id).set({ imobiliariaId, criadoEm: agora });
  await avisarAdminsImv(`Nova indicação ${codigo} para ${imob.nome || 'imobiliária'} (${interesse === 'alugar' ? 'aluguel' : 'compra'}).`);
  return { id: ref.id, codigo, existente: false };
});

// ---- Portal da imobiliária: identificação pelo token (limite por IP) ---------
async function imobiliariaPorToken(request) {
  const { ip } = origemChamada(request);
  const chave = ip || 'sem-ip';
  const LIM_FALHA = { max: 8, janelaMs: 30 * 60 * 1000 };
  if (await passouDoLimite(`imv-portal:${chave}`, { max: 90, janelaMs: 10 * 60 * 1000 })) throw new HttpsError('resource-exhausted', MSG_MUITAS_TENTATIVAS);
  if (await passouDoLimite(`imv-falha:${chave}`, { ...LIM_FALHA, incrementar: false })) throw new HttpsError('resource-exhausted', MSG_MUITAS_TENTATIVAS);
  const falhar = async (codigo, msg) => {
    await passouDoLimite(`imv-falha:${chave}`, LIM_FALHA);
    throw new HttpsError(codigo, msg);
  };
  const token = String(request.data?.token || '');
  if (!TOKEN_PORTAL.test(token)) await falhar('invalid-argument', 'Link inválido. Abra o link exatamente como a equipe Atravessia enviou.');
  const snap = await db.collection('imobiliariasPrivado').where('tokenPortal', '==', token).limit(1).get();
  if (snap.empty) await falhar('not-found', 'Este link não é mais válido. Peça um novo à equipe Atravessia.');
  const id = snap.docs[0].id;
  const pub = await db.collection('imobiliarias').doc(id).get();
  return { id, priv: snap.docs[0].data(), pub: pub.data() || {}, falhar };
}

const msImv = (ts) => (ts?.toMillis ? ts.toMillis() : null);

// Lead como a imobiliária vê: nome e telefone só de quem consentiu.
function leadParaPortal(id, l, p) {
  const consentiu = l.consentimento?.aceito === true;
  return {
    id, codigo: l.codigo, status: l.status,
    nome: consentiu ? l.nome || '' : '', telefone: consentiu ? l.telefone || '' : '', consentiu,
    interesse: l.interesse, faixaPreco: l.faixaPreco || '', bairros: l.bairros || '', prazo: l.prazo || '',
    observacoes: consentiu ? l.observacoes || '' : '', imovelTitulo: l.imovelTitulo || '',
    criadoEm: msImv(l.criadoEm), validadoEm: msImv(l.validadoEm),
    historico: (l.historico || []).filter(h => h?.status).map(h => ({ status: h.status, em: msImv(h.em), por: h.por || '' })),
    valorNegocio: p?.valorNegocioCentavos != null ? p.valorNegocioCentavos / 100 : null,
    repassePrevisto: p?.repassePrevistoCentavos != null ? p.repassePrevistoCentavos / 100 : null,
    repasseEnviadoEm: msImv(p?.repasseEnviado?.em),
    repasseConfirmado: p?.repasseCentavos != null ? p.repasseCentavos / 100 : null,
    pagoEm: msImv(p?.pagoEm),
    beneficioEntregue: l.status === 'concluido',
  };
}

exports.portalImobiliaria = onCall(async (request) => {
  const { id, priv, pub } = await imobiliariaPorToken(request);
  // Mesmo desativada no app, o portal segue aberto para concluir os leads em andamento.
  const [leadsSnap, privSnap] = await Promise.all([
    db.collection('indicacoesImoveis').where('imobiliariaId', '==', id).get(),
    db.collection('indicacoesImoveisPrivado').where('imobiliariaId', '==', id).get(),
  ]);
  const privados = new Map(privSnap.docs.map(x => [x.id, x.data()]));
  const leads = leadsSnap.docs.map(x => leadParaPortal(x.id, x.data(), privados.get(x.id)))
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

  // Validação de código / QR (opcional).
  let validacao = null;
  const codigoBruto = String(request.data?.codigo || '').trim().toUpperCase().replace(/\s+/g, '');
  if (codigoBruto) {
    const codigo = codigoBruto.startsWith('ATR-IMV-') ? codigoBruto : `ATR-IMV-${codigoBruto.replace(/^ATR-?IMV-?/, '')}`;
    const doc = leadsSnap.docs.find(x => x.data().codigo === codigo);
    if (!doc) {
      validacao = { ok: false, mensagem: 'Não encontramos este código entre as indicações da sua imobiliária. Confira as letras e os números.' };
    } else {
      const l = doc.data();
      const v = String(request.data?.v || '');
      const viaQr = !!v && v === l.tokenSeguro;
      if (!l.validadoEm) {
        await doc.ref.update({ validadoEm: agoraTsImv(), validadoViaQr: viaQr, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
      }
      validacao = { ok: true, leadId: doc.id, codigo, viaQr, jaValidado: !!l.validadoEm };
      const item = leads.find(x => x.id === doc.id);
      if (item && !item.validadoEm) item.validadoEm = Date.now();
    }
  }

  const fechadosAbertos = leads.filter(l => l.status === 'fechado');
  const resumo = {
    total: leads.length,
    emAndamento: leads.filter(l => ABERTOS_IMV.includes(l.status)).length,
    fechados: leads.filter(l => ['fechado', 'pago', 'consultoria_agendada', 'concluido'].includes(l.status)).length,
    aRepassar: fechadosAbertos.reduce((s, l) => s + (l.repassePrevisto || 0), 0),
    repassado: leads.reduce((s, l) => s + (l.repasseConfirmado || 0), 0),
  };
  return {
    imobiliaria: { nome: pub.nome || '', logoUrl: pub.logoUrl || '', creci: pub.creci || '' },
    regra: {
      venda: regraRepasseImv(priv, 'comprar'),
      aluguel: regraRepasseImv(priv, 'alugar'),
      prazoDias: Number(priv.prazoRepasseDias) || null,
      dadosPagamento: limparTextoImv(priv.dadosPagamentoAtravessia, 400),
    },
    leads, resumo, validacao,
  };
});

// ---- 2) Imobiliária atualiza o lead (status, valor, repasse enviado) ---------
exports.atualizarLeadImobiliaria = onCall(async (request) => {
  const { id: imobId, priv, falhar } = await imobiliariaPorToken(request);
  const leadId = idValido(request.data?.leadId, 'Indicação inválida.');
  const acao = String(request.data?.acao || 'status');
  const ref = db.collection('indicacoesImoveis').doc(leadId);
  const privRef = db.collection('indicacoesImoveisPrivado').doc(leadId);
  const agora = admin.firestore.FieldValue.serverTimestamp();

  if (acao === 'repasseEnviado') {
    const comprovanteUrl = urlHttpsOpcional(request.data?.comprovanteUrl, 'Comprovante');
    const observacao = limparTextoImv(request.data?.observacao, 300);
    const lead = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data().imobiliariaId !== imobId) return null;
      if (snap.data().status !== 'fechado') throw new HttpsError('failed-precondition', 'Só dá para informar o repasse de um negócio fechado e ainda não confirmado.');
      tx.set(privRef, { imobiliariaId: imobId, repasseEnviado: { em: agoraTsImv(), comprovanteUrl, observacao }, atualizadoEm: agora }, { merge: true });
      return snap.data();
    });
    if (!lead) await falhar('not-found', 'Indicação não encontrada.');
    await avisarAdminsImv(`A imobiliária ${lead.imobiliariaNome} informou o repasse da indicação ${lead.codigo}. Confira e confirme o recebimento.`);
    return { ok: true };
  }

  if (acao !== 'status') throw new HttpsError('invalid-argument', 'Ação desconhecida.');
  const novo = String(request.data?.status || '');
  if (!STATUS_IMV.includes(novo)) throw new HttpsError('invalid-argument', 'Status inválido.');
  let valorNegocioCentavos = null;
  if (novo === 'fechado') {
    valorNegocioCentavos = centavosImv(request.data?.valorNegocio);
    if (!valorNegocioCentavos || valorNegocioCentavos > 10000000000) throw new HttpsError('invalid-argument', 'Informe o valor do negócio (venda ou aluguel mensal).');
  }
  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().imobiliariaId !== imobId) return null;
    const l = snap.data();
    const permitidos = TRANSICOES_IMOBILIARIA[l.status] || [];
    if (!permitidos.includes(novo)) throw new HttpsError('failed-precondition', 'Esta mudança de etapa não é permitida agora.');
    const upd = { status: novo, atualizadoEm: agora };
    if (novo !== l.status) upd.historico = admin.firestore.FieldValue.arrayUnion(eventoImv(novo, 'imobiliaria'));
    tx.update(ref, upd);
    if (novo === 'fechado') {
      tx.set(privRef, {
        imobiliariaId: imobId, valorNegocioCentavos,
        repassePrevistoCentavos: calcularRepasseImv(priv, l.interesse, valorNegocioCentavos),
        regraAplicada: regraRepasseImv(priv, l.interesse),
        fechadoEm: agoraTsImv(), atualizadoEm: agora,
      }, { merge: true });
    }
    return { lead: l, mudou: novo !== l.status };
  });
  if (!resultado) await falhar('not-found', 'Indicação não encontrada.');
  if (resultado.mudou) {
    await avisarUsuariaImv(resultado.lead, novo);
    if (novo === 'fechado') await avisarAdminsImv(`Negócio fechado: indicação ${resultado.lead.codigo} (${resultado.lead.imobiliariaNome}). Aguarde o repasse.`);
  }
  return { ok: true };
});

// ---- 3) Admin: link do portal da imobiliária ---------------------------------
exports.gerenciarPortalImobiliaria = onCall(async (request) => {
  const adminUid = await exigirAdmin(request);
  const id = idValido(request.data?.imobiliariaId, 'Escolha a imobiliária.');
  const acao = String(request.data?.acao || '');
  if (!(await db.collection('imobiliarias').doc(id).get()).exists) throw new HttpsError('not-found', 'Imobiliária não encontrada.');
  const privRef = db.collection('imobiliariasPrivado').doc(id);
  const agora = admin.firestore.FieldValue.serverTimestamp();
  if (acao === 'novoLink') {
    const tokenPortal = gerarTokenPortal();
    await privRef.set({ tokenPortal, tokenGeradoEm: agora, tokenRevogadoEm: null, atualizadoEm: agora, atualizadoPor: adminUid }, { merge: true });
    return { ok: true, linkPortal: `${PORTAL_IMOBILIARIA_URL}?t=${tokenPortal}` };
  }
  if (acao === 'revogar') {
    await privRef.set({ tokenPortal: null, tokenRevogadoEm: agora, atualizadoEm: agora, atualizadoPor: adminUid }, { merge: true });
    return { ok: true };
  }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});

// ---- 4) Admin: confirma o recebimento do repasse (congela o valor) -----------
exports.confirmarRepasseImobiliaria = onCall(async (request) => {
  const adminUid = await exigirAdmin(request);
  const leadId = idValido(request.data?.leadId, 'Indicação inválida.');
  const ref = db.collection('indicacoesImoveis').doc(leadId);
  const privRef = db.collection('indicacoesImoveisPrivado').doc(leadId);
  const informado = centavosImv(request.data?.valorRecebido);
  const agora = admin.firestore.FieldValue.serverTimestamp();
  const lead = await db.runTransaction(async (tx) => {
    const [snap, pSnap] = await Promise.all([tx.get(ref), tx.get(privRef)]);
    if (!snap.exists) throw new HttpsError('not-found', 'Indicação não encontrada.');
    const l = snap.data();
    if (l.status !== 'fechado') throw new HttpsError('failed-precondition', 'Só dá para confirmar o repasse de um negócio fechado (e ainda não confirmado).');
    const p = pSnap.data() || {};
    let previsto = p.repassePrevistoCentavos;
    if (previsto == null) {
      const imobPriv = (await tx.get(db.collection('imobiliariasPrivado').doc(l.imobiliariaId))).data();
      previsto = calcularRepasseImv(imobPriv, l.interesse, p.valorNegocioCentavos || 0);
    }
    const repasseCentavos = informado != null ? informado : previsto;
    if (!repasseCentavos || repasseCentavos <= 0) throw new HttpsError('invalid-argument', 'Informe o valor recebido da imobiliária.');
    tx.update(ref, { status: 'pago', atualizadoEm: agora, historico: admin.firestore.FieldValue.arrayUnion(eventoImv('pago', 'admin')) });
    tx.set(privRef, {
      imobiliariaId: l.imobiliariaId, repasseCentavos, repassePrevistoCentavos: previsto,
      pagoEm: agoraTsImv(), pagoPor: adminUid, atualizadoEm: agora,
    }, { merge: true });
    return l;
  });
  await registrarAuditoriaBeneficio('IMOVEL_REPASSE_CONFIRMADO', 'indicacaoImovel', leadId, { adminUid });
  await avisarUsuariaImv(lead, 'pago');
  return { ok: true };
});

// ---- 5) Admin: atribui arquiteto e agenda a consultoria -----------------------
exports.agendarConsultoria = onCall(async (request) => {
  const adminUid = await exigirAdmin(request);
  const leadId = idValido(request.data?.leadId, 'Indicação inválida.');
  const arquitetoId = idValido(request.data?.arquitetoId, 'Escolha o arquiteto.');
  const ms = dataHoraBrasiliaImv(request.data?.dataHora);
  if (!ms) throw new HttpsError('invalid-argument', 'Informe a data e o horário da consultoria.');
  const link = urlHttpsOpcional(request.data?.link, 'Link da chamada');
  const duracaoHoras = Math.min(8, Math.max(0.5, Number(request.data?.duracaoHoras) || 2));
  const observacao = limparTextoImv(request.data?.observacao, 300);
  const [arqSnap, arqPriv] = await Promise.all([
    db.collection('arquitetos').doc(arquitetoId).get(),
    db.collection('arquitetosPrivado').doc(arquitetoId).get(),
  ]);
  if (!arqSnap.exists) throw new HttpsError('not-found', 'Arquiteto não encontrado.');
  const ref = db.collection('indicacoesImoveis').doc(leadId);
  const privRef = db.collection('indicacoesImoveisPrivado').doc(leadId);
  const agora = admin.firestore.FieldValue.serverTimestamp();
  const lead = await db.runTransaction(async (tx) => {
    const [snap, pSnap] = await Promise.all([tx.get(ref), tx.get(privRef)]);
    if (!snap.exists) throw new HttpsError('not-found', 'Indicação não encontrada.');
    const l = snap.data();
    if (!['pago', 'consultoria_agendada'].includes(l.status)) throw new HttpsError('failed-precondition', 'A consultoria só pode ser agendada depois de confirmado o repasse da imobiliária.');
    const p = pSnap.data() || {};
    tx.update(ref, {
      status: 'consultoria_agendada',
      arquitetoId, arquitetoNome: limparTextoImv(arqSnap.data().nome, 120),
      consultoria: { data: admin.firestore.Timestamp.fromMillis(ms), link, duracaoHoras, observacao, status: 'agendada' },
      atualizadoEm: agora,
      ...(l.status !== 'consultoria_agendada' ? { historico: admin.firestore.FieldValue.arrayUnion(eventoImv('consultoria_agendada', 'admin')) } : {}),
    });
    // Custo do arquiteto congelado na primeira atribuição (ou ao trocar de arquiteto, se ainda não pago).
    if (p.custoArquitetoCentavos == null || (p.arquitetoId !== arquitetoId && !p.arquitetoPagoEm)) {
      tx.set(privRef, {
        imobiliariaId: l.imobiliariaId, arquitetoId,
        custoArquitetoCentavos: Math.round((Number(arqPriv.data()?.valorConsultoria) || 0) * 100),
        atualizadoEm: agora, agendadoPor: adminUid,
      }, { merge: true });
    }
    return l;
  });
  await avisarUsuariaImv(lead, 'consultoria_agendada', { quando: textoDataHoraImv(ms) });
  return { ok: true };
});

// ---- 6) Admin: concluir consultoria, pagar arquiteto, corrigir etapa --------
exports.atualizarLeadAdmin = onCall(async (request) => {
  const adminUid = await exigirAdmin(request);
  const leadId = idValido(request.data?.leadId, 'Indicação inválida.');
  const acao = String(request.data?.acao || '');
  const ref = db.collection('indicacoesImoveis').doc(leadId);
  const privRef = db.collection('indicacoesImoveisPrivado').doc(leadId);
  const agora = admin.firestore.FieldValue.serverTimestamp();
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Indicação não encontrada.');
  const l = snap.data();

  if (acao === 'concluirConsultoria') {
    if (l.status !== 'consultoria_agendada') throw new HttpsError('failed-precondition', 'Não há consultoria agendada nesta indicação.');
    await ref.update({
      status: 'concluido', 'consultoria.status': 'concluida', atualizadoEm: agora,
      historico: admin.firestore.FieldValue.arrayUnion(eventoImv('concluido', 'admin')),
    });
    await avisarUsuariaImv(l, 'concluido');
    return { ok: true };
  }
  if (acao === 'pagarArquiteto') {
    const p = (await privRef.get()).data() || {};
    if (p.arquitetoPagoEm) throw new HttpsError('failed-precondition', 'O pagamento ao arquiteto já foi registrado.');
    if (!['consultoria_agendada', 'concluido'].includes(l.status)) throw new HttpsError('failed-precondition', 'Agende a consultoria antes de registrar o pagamento ao arquiteto.');
    const valor = centavosImv(request.data?.valor) ?? p.custoArquitetoCentavos;
    if (valor == null) throw new HttpsError('invalid-argument', 'Informe o valor pago ao arquiteto.');
    await privRef.set({
      arquitetoPagoEm: agoraTsImv(), arquitetoPagoCentavos: valor,
      arquitetoComprovanteUrl: urlHttpsOpcional(request.data?.comprovanteUrl, 'Comprovante'),
      atualizadoEm: agora, arquitetoPagoPor: adminUid,
    }, { merge: true });
    return { ok: true };
  }
  if (acao === 'status') {
    // Correções manuais. "pago" e "consultoria_agendada" têm ações próprias.
    const novo = String(request.data?.status || '');
    if (!['novo', 'em_contato', 'visita', 'proposta', 'perdido'].includes(novo)) throw new HttpsError('invalid-argument', 'Use as ações próprias para fechar, confirmar repasse ou agendar.');
    if (['pago', 'consultoria_agendada', 'concluido'].includes(l.status)) throw new HttpsError('failed-precondition', 'Depois do repasse confirmado a etapa não volta atrás.');
    if (novo === l.status) return { ok: true };
    await ref.update({ status: novo, atualizadoEm: agora, historico: admin.firestore.FieldValue.arrayUnion(eventoImv(novo, 'admin')) });
    await avisarUsuariaImv(l, novo);
    return { ok: true };
  }
  if (acao === 'cancelarConsultoria') {
    if (l.status !== 'consultoria_agendada') throw new HttpsError('failed-precondition', 'Não há consultoria agendada.');
    await ref.update({ status: 'pago', 'consultoria.status': 'cancelada', atualizadoEm: agora });
    return { ok: true };
  }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});
