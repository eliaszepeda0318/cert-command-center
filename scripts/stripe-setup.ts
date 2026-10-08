/**
 * Creates (or finds) the Stripe Product "Cert Command Center — 1 Year Access" and its one-time $10 USD Price, then prints the
 * Price ID to put in functions/.env.<project>. Safe to re-run: it looks them up by lookup_key / metadata first.
 *
 *   STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup
 *
 * Uses TEST mode only: a live key (sk_live_...) is refused unless you also pass --live (do that only at launch, deliberately).
 * The key is read from your shell for this one command; it is never written to disk or committed.
 */
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY ?? '';
if (!key) { console.error('Set STRIPE_SECRET_KEY to your Stripe TEST secret key (sk_test_...).'); process.exit(1); }
if (key.startsWith('sk_live_') && !process.argv.includes('--live')) { console.error('Refusing a LIVE key. Test mode first. (Pass --live only at launch.)'); process.exit(1); }
if (!/^(sk|rk)_(test|live)_/.test(key)) { console.error('That does not look like a Stripe secret key.'); process.exit(1); }

const NAME = 'Cert Command Center — 1 Year Access';
const LOOKUP = 'cert_command_center_1yr_usd';
const stripe = new Stripe(key, { apiVersion: '2025-10-29.clover' });

async function main() {
  const mode = key.includes('_live_') ? 'LIVE' : 'test';
  let price = (await stripe.prices.list({ lookup_keys: [LOOKUP], active: true, expand: ['data.product'], limit: 1 })).data[0];
  if (price) {
    console.log(`Found existing ${mode} price ${price.id} (${(price.unit_amount ?? 0) / 100} ${price.currency.toUpperCase()}).`);
    if (price.unit_amount !== 1000 || price.currency !== 'usd' || price.recurring) throw new Error('Existing price is not a one-time $10 USD price. Fix it in the Stripe dashboard.');
  } else {
    const found = (await stripe.products.search({ query: `metadata['app']:'cert-command-center' AND active:'true'`, limit: 1 })).data[0];
    const product = found ?? await stripe.products.create({ name: NAME, description: '365 days of access to Cert Command Center. One-time payment, no subscription.', metadata: { app: 'cert-command-center' } });
    price = await stripe.prices.create({ product: product.id, unit_amount: 1000, currency: 'usd', lookup_key: LOOKUP, nickname: '1 year access (one-time)' });
    console.log(`Created ${mode} product ${product.id} and price ${price.id}.`);
  }
  console.log(`\nPut this in functions/.env.<your-project-id>:\n  STRIPE_PRICE_ID=${price.id}`);
}
main().catch((e) => { console.error((e as Error).message); process.exit(1); });
