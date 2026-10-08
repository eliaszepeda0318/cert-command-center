import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export type CheckoutResponse =
  | { status: 'ok'; url: string } | { status: 'sold_out' } | { status: 'sales_closed' }
  | { status: 'already_active'; reason: 'admin' | 'comped' | 'too_much_banked' };

/** Asks the server to start a Stripe Checkout. The server re-checks auth, salesOpen and seat capacity; this never grants access. */
export async function startCheckout(): Promise<CheckoutResponse> {
  const res = await httpsCallable<void, CheckoutResponse>(functions, 'createCheckoutSession')();
  return res.data;
}
