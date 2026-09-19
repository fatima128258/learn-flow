import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_NOT_CONFIGURED');
  if (!secretKey.startsWith('sk_test_')) throw new Error('STRIPE_TEST_MODE_REQUIRED');
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

function appUrl() {
  const value = process.env.APP_URL?.trim();
  if (!value) throw new Error('APP_URL_NOT_CONFIGURED');
  return value.replace(/\/+$/, '');
}

export async function createCheckoutSession(data: {
  orderId: string;
  paymentId: string;
  userId: string;
  organizationId: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  currency: string;
}) {
  return getStripeClient().checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: data.currency.toLowerCase(),
        product_data: { name: data.courseTitle },
        unit_amount: Math.round(data.amount * 100),
      },
      quantity: 1,
    }],
    metadata: {
      orderId: data.orderId,
      paymentId: data.paymentId,
      userId: data.userId,
      organizationId: data.organizationId,
      courseId: data.courseId,
    },
    success_url: `${appUrl()}/checkout/${data.courseId}?stripe_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/checkout/${data.courseId}?stripe_cancelled=1`,
  }, {
    idempotencyKey: `learnflow_checkout_${data.orderId}`,
  });
}

export async function retrieveCheckoutSession(sessionId: string) {
  return getStripeClient().checkout.sessions.retrieve(sessionId);
}
