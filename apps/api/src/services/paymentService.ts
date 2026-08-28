interface MockPaymentInput {
  amount: number;
  currency: string;
}

interface PaymentResult {
  success: boolean;
  providerRef: string;
}

let paymentRefCounter = 0;

function nextProviderRef() {
  paymentRefCounter += 1;
  return `mock_${Date.now()}_${paymentRefCounter}`;
}

export async function processMockPayment(input: MockPaymentInput): Promise<PaymentResult> {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { success: false, providerRef: '' };
  }

  return {
    success: true,
    providerRef: nextProviderRef(),
  };
}
