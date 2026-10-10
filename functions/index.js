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

async function getOrCreateCustomer(stripe, uid, userData) {
  if (userData.stripeCustomerId) return userData.stripeCustomerId;
  const customer = await stripe.customers.create({
    email: userData.email,
    metadata: { uid },
  });
  await db.collection('usuarios').doc(uid).update({ stripeCustomerId: customer.id });
  return customer.id;
}

exports.criarSessaoCheckout = onCall(OPCOES_CHECKOUT, async (request) => {
  // Chamada de aquecimento feita pelo app ao abrir a tela de planos: tira a
  // function do estado "parado" antes de a usuária tocar em assinar.
  if (request.data?.aquecer) return { ok: true };

  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para assinar um plano.');

  const planoId = Number(request.data?.planoId);
  const plano = PLANOS[planoId];
  if (!plano) throw new HttpsError('invalid-argument', 'Plano inválido.');

  const userRef = db.collection('usuarios').doc(uid);
  const [valorAtual, userSnap] = await Promise.all([obterPrecoPlanoCentavos(planoId), userRef.get()]);
  if (!valorAtual) throw new HttpsError('failed-precondition', 'Preço do plano não configurado.');
  const userData = userSnap.data() || {};

  if (planoNumero(userData) === planoId && userData.stripeSubscriptionId) {
    throw new HttpsError('already-exists', 'Você já está neste plano.');
  }

  const stripe = stripeDe();

  const customerId = await getOrCreateCustomer(stripe, uid, userData);
  // Cashback: desconto na primeira mensalidade, se ela escolheu usar.
  const cashback = request.data?.usarCashback ? await descontoCashback(stripe, uid, valorAtual) : null;

  const session = await stripe.checkout.sessions.create({
    ...(cashback ? { discounts: [{ coupon: cashback.cupomId }] } : {}),
    mode: 'subscription',
    customer: customerId,
    locale: 'pt-BR',
    submit_type: 'subscribe',
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: { name: plano.nome },
        unit_amount: valorAtual,
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    success_url: request.data?.successUrl || `${SITE_URL}/checkout-sucesso.html`,
    cancel_url: request.data?.cancelUrl || `${SITE_URL}/checkout-cancelado.html`,
    metadata: { uid, planoId: String(planoId), cashbackCentavos: String(cashback?.desconto || 0) },
    subscription_data: { metadata: { uid, planoId: String(planoId) } },
    custom_text: {
      submit: { message: 'Você poderá cancelar quando quiser, direto no app.' },
    },
  });

  return { url: session.url };
});

exports.criarCheckoutPeriodoUnlocked = onCall(OPCOES_CHECKOUT, async (request) => {
  if (request.data?.aquecer) return { ok: true };

  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para continuar.');

  const userRef = db.collection('usuarios').doc(uid);
  const [userSnap, valorAtual] = await Promise.all([userRef.get(), obterPrecoPeriodoCentavos()]);
  const userData = userSnap.data() || {};

  // Antes comparava `plano < 1` direto: com o plano gravado como texto pelo
  // painel web a checagem falhava, e quem tinha acesso total ou cortesia era
  // barrado.
  if (!temAcessoPago(userData)) {
    throw new HttpsError('failed-precondition', 'Assine um plano primeiro para gerar relatórios por período.');
  }

  const stripe = stripeDe();
  const customerId = await getOrCreateCustomer(stripe, uid, userData);
  const cashback = request.data?.usarCashback ? await descontoCashback(stripe, uid, valorAtual) : null;

  const session = await stripe.checkout.sessions.create({
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
    },
  });

  return { url: session.url };
});

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
exports.gerarVoucherBeneficio = onCall(async (request) => {
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
  const descontoCliente = parceria.percentualDescontoCliente != null
    ? Number(parceria.percentualDescontoCliente)
    : Math.max(0, beneficio - comissao);
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
});

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
    percentualDescontoCliente: resultado.percentualDescontoCliente,
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
    // O benefício total que o parceiro concede se divide em duas partes: o
    // desconto da cliente e a comissão da Atravessia. A cliente paga o valor
    // original menos APENAS o desconto dela (serviço de R$ 100 com 10% = 7% + 3%:
    // a cliente paga R$ 93 e o parceiro repassa R$ 3, ficando com R$ 90).
    const descontoTotal = Math.round(valorOriginalCentavos * (v.percentualBeneficio / 100));
    const descontoCliente = Math.round(valorOriginalCentavos * (v.percentualDescontoCliente / 100));
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
      const valor = Math.floor((dadosResgate.valorOriginalCentavos || 0) * (cfg.percentual / 100));
      if (cfg.ativo && valor >= 1) {
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
