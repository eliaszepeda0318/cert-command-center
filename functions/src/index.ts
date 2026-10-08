import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import Stripe from 'stripe';
import { APP_BASE_URL, APP_MARKER, ENFORCE_APP_CHECK, REGION, SCALING, STRIPE_PRICE_ID, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from './config';
import { applyPayment, attachSession, markRefunded, releaseReservation, reserveCheckout, SESSION_TTL_S } from './core';
import { firestoreStore } from './store';

initializeApp();
setGlobalOptions({ region: REGION, minInstances: SCALING.minInstances, maxInstances: SCALING.maxInstances, memory: SCALING.memory, timeoutSeconds: SCALING.timeoutSeconds });

const store = () => firestoreStore(getFirestore(), Timestamp);
const stripeClient = () => new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2025-10-29.clover', maxNetworkRetries: 1 });

export type CheckoutResponse =
  | { status: 'ok'; url: string }
  | { status: 'sold_out' } | { status: 'sales_closed' }
  | { status: 'already_active'; reason: 'admin' | 'comped' | 'too_much_banked' };

/**
 * Starts a Stripe Checkout for the signed-in user. Every gate is enforced here on the server: auth, App Check (when enforced),
 * salesOpen, seat capacity (atomic reservation), and "already has access". Returns a state (sold_out, ...) rather than an
 * error so the UI can show the right message. NEVER grants access: only the webhook does.
 */
export const createCheckoutSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request): Promise<CheckoutResponse> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  // App Check: tokens are verified automatically and exposed as request.app. Enforcement is OFF until you flip ENFORCE_APP_CHECK
  // after confirming real production traffic carries valid tokens (docs/paid-access.md).
  if (!request.app) {
    if (ENFORCE_APP_CHECK.value()) throw new HttpsError('failed-precondition', 'App Check token required.');
    logger.warn('createCheckoutSession without a valid App Check token (not enforced)', { uid: request.auth.uid });
  }
  const uid = request.auth.uid;
  const email = typeof request.auth.token.email === 'string' ? request.auth.token.email : null;
  const now = Date.now();
  const s = store();

  const r = await reserveCheckout(s, { uid, email, now });
  if (r.kind === 'sales_closed') return { status: 'sales_closed' };
  if (r.kind === 'sold_out') return { status: 'sold_out' };
  if (r.kind === 'already_active') return { status: 'already_active', reason: r.reason };

  const stripe = stripeClient();
  try {
    if (r.existingSessionId) { // double click / second tab: hand back the still-open session instead of opening another
      const open = await stripe.checkout.sessions.retrieve(r.existingSessionId);
      if (open.status === 'open' && open.url) return { status: 'ok', url: open.url };
    }
    const base = APP_BASE_URL.value().replace(/\/+$/, '');
    const nowS = Math.floor(now / 1000);
    // New buyers: unique per reservation. Renewals: stable within a 5-minute bucket so retries do not open duplicates.
    const bucketS = Math.floor(nowS / 300) * 300;
    const idem = r.reservation ? `cs_new_${uid}_${r.reservation.createdAt}` : `cs_renew_${uid}_${bucketS}`;
    const create = (customerId: string | null) => stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: STRIPE_PRICE_ID.value(), quantity: 1 }],
      client_reference_id: uid,
      metadata: { app: APP_MARKER, uid, mode: r.mode },
      payment_intent_data: { metadata: { app: APP_MARKER, uid } },
      ...(customerId ? { customer: customerId } : { customer_creation: 'always' as const, ...(email ? { customer_email: email } : {}) }),
      success_url: `${base}/settings?checkout=success`,
      cancel_url: `${base}/settings?checkout=cancelled`,
      expires_at: r.reservation ? nowS + SESSION_TTL_S : bucketS + 3600,
    }, { idempotencyKey: customerId ? idem : `${idem}_nocust` });
    let session: Stripe.Checkout.Session;
    try { session = await create(r.stripeCustomerId); }
    catch (e) {
      // A stored customer id from the other Stripe mode (test vs live) or a deleted customer: start fresh instead of failing.
      if (r.stripeCustomerId && (e as { code?: string }).code === 'resource_missing') session = await create(null);
      else throw e;
    }
    if (!session.url) throw new Error('Stripe returned no checkout URL');
    if (r.reservation) await attachSession(s, uid, session.id);
    return { status: 'ok', url: session.url };
  } catch (e) {
    logger.error('createCheckoutSession failed', { uid, error: (e as Error).message });
    if (r.reservation) await releaseReservation(s, uid).catch(() => undefined); // give the seat back immediately
    throw new HttpsError('internal', 'Could not start checkout. Please try again.');
  }
});

/**
 * Stripe -> us. Signature-verified. The ONLY code path that grants or extends paid access. Idempotent per Checkout Session,
 * so Stripe's retries and duplicate event types can never add a second year.
 */
export const stripeWebhook = onRequest({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('POST only'); return; }
  const stripe = stripeClient();
  let event: Stripe.Event;
  try {
    const sig = req.header('stripe-signature');
    if (!sig) throw new Error('missing stripe-signature');
    event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value());
  } catch (e) {
    logger.warn('stripeWebhook: signature verification failed', { error: (e as Error).message });
    res.status(400).send('Invalid signature'); return;
  }
  try {
    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') { res.status(200).send('ignored'); return; }
    const session = event.data.object as Stripe.Checkout.Session;
    const uid = session.client_reference_id ?? session.metadata?.uid;
    if (session.metadata?.app !== APP_MARKER || session.mode !== 'payment' || !uid) { res.status(200).send('not ours'); return; }
    if (session.payment_status !== 'paid') { res.status(200).send('not paid yet'); return; } // async methods send a later succeeded event
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
    const s = store();
    const result = await applyPayment(s, {
      sessionId: session.id, uid, paymentIntentId, customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
      paidAt: event.created * 1000, email: session.customer_details?.email ?? session.customer_email ?? null, now: Date.now(),
    });
    logger.info('stripeWebhook processed', { eventId: event.id, sessionId: session.id, uid, result: result.kind });
    if ((result.kind === 'refund_needed' || (result.kind === 'duplicate' && result.refundPending)) && paymentIntentId) {
      // Paid with no seat available (hard cap): nothing was granted, so give the money back. Retried on duplicate delivery.
      const refund = await stripe.refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey: `refund_${session.id}` });
      await markRefunded(s, session.id, refund.id);
      logger.warn('stripeWebhook refunded a payment (no seat available)', { sessionId: session.id, uid, refundId: refund.id });
    }
    res.status(200).send('ok');
  } catch (e) {
    logger.error('stripeWebhook handler error', { eventId: event.id, error: (e as Error).message });
    res.status(500).send('retry'); // transient: Stripe will redeliver, and idempotency makes that safe
  }
});
