interface MockPaymentInput {
  amount: number;
  currency: string;
}

interface PaymentResult {
  success: boolean;
  providerRef: string;
}

let paymentRefCounter = 0;
type MockPaymentProcessor = (input: MockPaymentInput) => Promise<PaymentResult>;

function nextProviderRef() {
  paymentRefCounter += 1;
  return `mock_${Date.now()}_${paymentRefCounter}`;
}

async function defaultMockPayment(input: MockPaymentInput): Promise<PaymentResult> {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { success: false, providerRef: '' };
  }

  return {
    success: true,
    providerRef: nextProviderRef(),
  };
}

let processor: MockPaymentProcessor = defaultMockPayment;

export async function processMockPayment(input: MockPaymentInput): Promise<PaymentResult> {
  return processor(input);
}

/**
 * Allows isolated backend tests to simulate a provider failure without adding
 * a production-facing request parameter or environment switch.
 */
export function setMockPaymentProcessorForTests(nextProcessor?: MockPaymentProcessor) {
  processor = nextProcessor ?? defaultMockPayment;
}
