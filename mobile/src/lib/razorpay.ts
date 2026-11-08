/**
 * Razorpay Standard Checkout (react-native-razorpay, PAY-1). The SDK is a native module:
 * it works in the EAS development / production build, NOT in Expo Go. It is loaded lazily
 * so the rest of the app still runs in Expo Go; there, paying shows a clear message.
 * UPI is listed first (most Indian buyers pay by UPI).
 */

export interface CheckoutOptions {
  keyId: string;
  orderId: string;
  amountPaise: number;
  name: string;
  description: string;
  prefill?: { name?: string; contact?: string };
  themeColor: string;
}

export interface CheckoutSuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/** Why Checkout did not return a payment. */
export class CheckoutError extends Error {
  /** "cancelled" (user closed it), "unavailable" (no native module), "failed" */
  kind: 'cancelled' | 'unavailable' | 'failed';

  constructor(kind: CheckoutError['kind'], message: string) {
    super(message);
    this.name = 'CheckoutError';
    this.kind = kind;
  }
}

type RazorpayModule = {
  open: (options: Record<string, unknown>) => Promise<CheckoutSuccess>;
};

let cached: RazorpayModule | null | undefined;

/** @returns The SDK, or null when this build has no Razorpay native module (Expo Go). */
function loadSdk(): RazorpayModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-razorpay').default as RazorpayModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** @returns true when payments can run in this build */
export function isCheckoutAvailable(): boolean {
  return loadSdk() !== null;
}

/**
 * Open Razorpay Checkout for a server-created order.
 * @param options - Order and display details (amount is the server's, never typed by the user)
 * @returns Payment id, order id and signature to verify on the server
 * @throws {CheckoutError} cancelled / unavailable / failed
 */
export async function openCheckout(options: CheckoutOptions): Promise<CheckoutSuccess> {
  const sdk = loadSdk();
  if (!sdk) throw new CheckoutError('unavailable', 'Razorpay is not available in this build');
  try {
    return await sdk.open({
      key: options.keyId,
      order_id: options.orderId,
      amount: options.amountPaise,
      currency: 'INR',
      name: options.name,
      description: options.description,
      prefill: options.prefill ?? {},
      theme: { color: options.themeColor },
      // UPI first, then cards and net banking (PAY-1)
      config: {
        display: {
          sequence: ['block.upi', 'block.card', 'block.netbanking'],
          preferences: { show_default_blocks: true },
          blocks: {
            upi: { name: 'UPI', instruments: [{ method: 'upi' }] },
            card: { name: 'Cards', instruments: [{ method: 'card' }] },
            netbanking: { name: 'Net banking', instruments: [{ method: 'netbanking' }] },
          },
        },
      },
    });
  } catch (error) {
    const data = error as { code?: number; description?: string };
    // Razorpay: code 0 = closed by the user (Android); description "Payment cancelled" on iOS
    const cancelled = data?.code === 0 || /cancel/i.test(String(data?.description ?? ''));
    throw new CheckoutError(
      cancelled ? 'cancelled' : 'failed',
      String(data?.description ?? 'Payment failed'),
    );
  }
}
