# Paid access ($10 / 365 days, hard seat limit)

Status: **code complete and tested locally; nothing deployed, no payments enabled.** Everything below the "Manual steps" heading is yours to run, in order.

## How it works

```
Browser ──callable──▶ createCheckoutSession ──▶ Stripe Checkout (test mode first)
                         │  1 signed in?  2 salesOpen?  3 seat free?  4 not already covered?
                         │  (one Firestore transaction; takes a 31-min seat HOLD for new buyers)
Stripe ──signed webhook─▶ stripeWebhook ──▶ entitlements/{uid}  (+ currentPaidUsers++ for a NEW buyer only)
Browser ◀─onSnapshot──── entitlements/{uid}, appConfig/access   (read-only for clients)
```

* **Only the webhook grants or extends access.** The client can read its own entitlement and the seat config; Firestore rules deny every client write to them.
* **Hard cap.** A new buyer needs `currentPaidUsers + live holds < maxPaidUsers`; the hold is written in the same transaction, so simultaneous buyers cannot all be admitted. If a payment ever arrives with no seat (hold lost *and* cap reached) the webhook grants nothing and refunds it automatically.
* **Idempotent.** Each Stripe Checkout Session is recorded in `stripePayments/{sessionId}` in the same transaction as the grant, so retries, duplicate deliveries, or both event types for one session cannot add a second year.
* **Dates.** New or expired: payment time + 365 days. Early renewal: existing future expiry + 365 days. A renewal never changes the seat count. You can't bank more than one extra year (checkout is refused when more than 365 days remain).
* **Seats.** One paid account = one seat. Expiry does **not** free it. You free seats yourself (`release`). Comped users and admins hold no seat.
* **Kill switch.** `salesOpen=false` blocks *every* checkout, renewals included. To stop *new* buyers but still let existing customers renew, set `maxPaidUsers` equal to `currentPaidUsers` instead.
* **Owner can't lock out.** Your account gets `status: admin` (no expiry). The webhook, `comp`, `release` and checkout all refuse to touch an admin entitlement. Access is decided by the server-written entitlement document, never a frontend email check.
* **Anonymous / unpaid visitors** load only the static sign-in card, then (after sign-in) two tiny documents: their own entitlement and `appConfig/access`. The curriculum, progress, notes and blueprint code and data are never requested; the whole app is a separate lazy chunk, and the rules deny curriculum reads without access.
* **Expired users** keep their saved data (nothing is ever deleted) and can still read it, but cannot write and cannot load the curriculum until they renew.

### Data

| Document | Written by | Client access |
|---|---|---|
| `appConfig/access` `{salesOpen, maxPaidUsers, currentPaidUsers, foundingPriceCents: 1000}` | admin script + functions | read (signed in), never write |
| `entitlements/{uid}` `{status: active/expired/comped/admin, accessStartedAt, accessExpiresAt, stripeCustomerId, lastCheckoutSessionId, lastPaymentIntentId, updatedAt, seatHeld, email}` | webhook + admin script | read own only, never write |
| `seatReservations/{uid}` | createCheckoutSession | none |
| `stripePayments/{sessionId}` | webhook | none |

`status` is not flipped automatically when a date passes; access is always judged by `accessExpiresAt` against the current time (rules use `request.time`). `expired` is set explicitly by `release`. `seatHeld` is the extra field that tracks who occupies a seat.

## Owner admin process (no dashboard yet)

All commands use your Google credentials through the Admin SDK. Same setup as the seed script:

```bash
gcloud auth application-default login          # once
export FIREBASE_PROJECT_ID=cert-command-center-eli
npm run functions:install                        # once (installs functions/ deps; the admin script imports shared code from there)

npm run access -- status                        # config, every entitlement, seat counters (warns if they disagree)
npm run access -- init --max 25                 # first time only. Sales start CLOSED. Never overwrites a live config
npm run access -- set-max 40                    # change the cap
npm run access -- open                          # open sales
npm run access -- close                         # close sales (kill switch)
npm run access -- grant-admin you@example.com   # permanent access for the owner
npm run access -- comp friend@example.com --days 90   # free access, no seat used
npm run access -- release friend@example.com    # end access + free the seat
npm run access -- set-max 40 --dry-run          # any command with --dry-run only prints current state
```

Never edit `currentPaidUsers` by hand in the console; the commands keep it consistent with the entitlements. `status` shows `counter` vs `held-by-entitlements`; they must match.

## Cost controls and scaling

* `functions/src/config.ts` → `SCALING`: `minInstances: 0`, `maxInstances: 2`, 256 MiB, 30 s timeout, applied to both functions. Nothing raises them automatically.
* **To change later:** edit `maxInstances` (e.g. 3 or 5), run `npm run deploy:functions`. Confirm in Google Cloud console → Cloud Run → each function → "Maximum instances".
* Budgets **alert, they do not stop spending.** The real caps are `maxInstances` plus the seat cap (which bounds how many people can call the functions in practice).
* Region is `us-central1` (`REGION` in config; keep `VITE_FUNCTIONS_REGION` in sync).

## App Check

The client attaches a reCAPTCHA v3 App Check token to function calls when `VITE_APPCHECK_SITE_KEY` is set. The server logs a warning for calls without a valid token and **does not reject them** until you set `ENFORCE_APP_CHECK=true` in `functions/.env.<project>` and redeploy. Do that only after you've seen valid tokens in production (steps below). Firestore/Auth App Check enforcement stays off.

---

# Manual steps (in this order)

## 0. Safe rollout order for the existing app (don't skip: avoids locking yourself out)

The new Firestore rules require an entitlement. **Create yours before deploying the rules.** None of this needs Blaze.

```bash
npm ci && npm run functions:install
npm run verify                                   # typecheck, tests, seed dry run, build
export FIREBASE_PROJECT_ID=cert-command-center-eli
npm run access -- init --max 25                  # sales closed
npm run access -- grant-admin eliaszepeda@nr8r.com
npm run access -- status                         # confirm you appear as admin / ACCESS
npm run deploy:rules                             # now the rules are safe to deploy
npm run deploy                                   # hosting (build + deploy)
```

Open the site: you should land straight in the app (as admin). Open Settings → "Plan & access" shows Owner / Never. A second Google account should see the paywall (sales closed → "currently sold out").

(If you haven't yet pushed/reseeded/deployed the free-YouTube curriculum migration, do `git push origin main` and `npm run seed` first; they're independent.)

## 1. Firebase Blaze setup: **required from here on**

Blaze is first needed at **step 4** (setting secrets / the first `firebase deploy --only functions`): 2nd-gen Functions, Secret Manager, Cloud Build, Artifact Registry and Cloud Run all require it. Steps 0, 2 and 3 are free. When you're ready:

Firebase console → ⚙ Project settings → Usage and billing → **Modify plan → Blaze**, attach a billing account.

## 2. Cost controls (do immediately after enabling Blaze, before deploying functions)

1. Google Cloud console → Billing → **Budgets & alerts** → create a budget (e.g. $5/month) with alerts at 50 %, 90 %, 100 %. Add your email. (Alerts only; they don't cut off services.)
2. Confirm `SCALING` in `functions/src/config.ts` is `minInstances: 0`, `maxInstances: 2` (the committed default).
3. On first deploy, if the CLI offers to set an Artifact Registry cleanup policy for container images, accept it (prevents slowly growing storage).
4. After deploy: Cloud Run → each function → check "Maximum instances = 2, Minimum = 0".

## 3. Stripe account and product (test mode)

1. Create/sign in to a Stripe account and stay in **test mode** (sandbox). Do not activate live payments yet.
2. Developers → API keys → copy the **test secret key** (`sk_test_...`).
3. Create the product and $10 price (idempotent, refuses live keys):
   ```bash
   STRIPE_SECRET_KEY=sk_test_xxx npm run stripe:setup
   ```
   It creates "Cert Command Center — 1 Year Access" with a one-time $10.00 USD price and prints `STRIPE_PRICE_ID=price_...`.
4. Create `functions/.env.cert-command-center-eli` from `functions/.env.example`; fill `STRIPE_PRICE_ID`, `APP_BASE_URL=https://cert-command-center-eli.web.app` (your real hosting URL), keep `ENFORCE_APP_CHECK=false`. This file is gitignored (these values are not secret, but are project-specific).

## 4. Secrets (Blaze needed)

Secrets go to Google Secret Manager. They never enter Vite env vars, git, or `functions/.env`.

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY        # paste sk_test_...
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET    # paste a placeholder like whsec_placeholder for now
```

## 5. Test-mode deployment

```bash
npm run deploy:functions        # builds functions/, deploys createCheckoutSession + stripeWebhook
```
Note the `stripeWebhook` URL printed at the end (also `firebase functions:list`).

Then in Stripe (test mode) → Developers → Webhooks → **Add endpoint**: paste that URL; events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Reveal the **signing secret** (`whsec_...`) and set the real value, then redeploy so the function picks it up:

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET    # paste the real whsec_...
npm run deploy:functions
```

Optional App Check (do now, enforce later): Firebase console → App Check → register the web app with **reCAPTCHA v3**, copy the site key to `VITE_APPCHECK_SITE_KEY` in your local `.env`, then `npm run deploy` (hosting). Keep enforcement off.

Open sales for testing: `npm run access -- set-max 3` (small on purpose) then `npm run access -- open`.

## 6. Test checkout (use a second Google account, plus a third)

Stripe test card `4242 4242 4242 4242`, any future date, any CVC/ZIP. Check each item; `npm run access -- status` after each step shows the truth.

| # | Test | Expected |
|---|---|---|
| 1 | Sign in with account B (unpaid) | Paywall, no curriculum, no app |
| 2 | Pay as B | Returns to Settings; unlocks in seconds; expires in 365 days; `counter=1` |
| 3 | Stripe dashboard → Webhooks → that event → **Resend** (twice) | Expiry and count unchanged |
| 4 | Pay as account C | `counter=2` |
| 5 | B: Settings → Renew, pay | Expiry = old expiry + 365 days; `counter` still 2 |
| 6 | `access -- set-max 2`, then sign in with account D | "Founding access is currently sold out."; no new Checkout Session appears in Stripe |
| 7 | `access -- set-max 3`, D reloads | Purchase button appears and works |
| 8 | Firebase console → `entitlements/<test user>` → set `accessExpiresAt` to a past date | That user is sent to the paywall; their writes are rejected |
| 9 | `access -- comp <email> --days 30`; `grant-admin` | Both get access; neither uses a seat |
| 10 | Your own account | Still full access throughout |

Also run the emulator suites on your Mac (Java 11+): `npm run test:rules` and `npm run test:access:emu`.

## 7. Webhook verification

* Stripe → Developers → Webhooks → your endpoint → recent deliveries all **200**.
* A request with a wrong signature gets **400**: `curl -i -X POST <webhook-url> -d '{}'` should return `400 Invalid signature`.
* Firebase console → Functions → Logs: look for `stripeWebhook processed ... result: granted_new / renewed / duplicate`.
* App Check: Logs for `createCheckoutSession` should show **no** "without a valid App Check token" warnings from real browsers. Only then set `ENFORCE_APP_CHECK=true` in `functions/.env.<project>` and `npm run deploy:functions`. If legitimate purchases fail afterward, set it back to `false` and redeploy.

## 8. Live-mode launch (only after all of the above passes in test mode)

1. Release every test user so test seats are returned, then confirm `counter=0` apart from your own:
   `npm run access -- release <email>` for each; `npm run access -- status`.
2. Activate your Stripe account (business details, bank). Switch to live mode.
3. `STRIPE_SECRET_KEY=sk_live_xxx npm run stripe:setup -- --live` → copy the live `price_...` into `functions/.env.<project>` (`STRIPE_PRICE_ID`).
4. `firebase functions:secrets:set STRIPE_SECRET_KEY` (live key). Create a **live** webhook endpoint with the same URL and events, and set `STRIPE_WEBHOOK_SECRET` to its live signing secret.
5. `npm run deploy:functions`.
6. Set the real cap: `npm run access -- set-max <your number>`, then `npm run access -- open`.
7. Do one real $10 purchase yourself with a second account, confirm access, then refund it in Stripe and `release` that account.

## Troubleshooting

* **Locked out after deploying rules:** you skipped step 0. Fix with `npm run access -- grant-admin <you>` (Admin SDK bypasses rules), no redeploy needed.
* **`status` warns counter ≠ held:** don't hand-edit. Tell me; the fix is a one-off Admin-SDK correction.
* **Paid but no access:** Stripe → webhook deliveries (failing = wrong `STRIPE_WEBHOOK_SECRET` or not redeployed after setting it); Functions logs; `status`.
* **Stuck "Confirming payment…":** the webhook hasn't landed; check deliveries above. It unlocks the moment the entitlement is written.
* **Change price later:** create a new Stripe price, update `STRIPE_PRICE_ID` and `foundingPriceCents` in `appConfig/access` (display only), redeploy functions.

## What is and isn't verified

Automated here: seat-cap race (10 simultaneous buyers, 3 seats), idempotent webhook, renewal math, sold-out and re-open, comp/admin/release, refund-on-no-seat (`npm run test:access`, in-memory store with optimistic concurrency like Firestore). Written but **not yet run** (need the Firebase emulator / Java, which this build environment can't download): the Firestore rules tests (`npm run test:rules`) and the same access suite against the real Firestore adapter (`npm run test:access:emu`). Also not run: anything against real Stripe or deployed Functions.
