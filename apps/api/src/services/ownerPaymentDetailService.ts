import * as repository from '../repositories/ownerPaymentDetailRepository';

type PaymentDetailsInput = {
  bankName: unknown;
  accountTitle?: unknown;
  accountNumber?: unknown;
  iban?: unknown;
};

function requiredText(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`INVALID_${field}`);
  const trimmed = value.trim();
  if (trimmed.length > 200) throw new Error(`INVALID_${field}`);
  return trimmed;
}

function optionalText(value: unknown, field: string) {
  if (value === undefined) return undefined;
  const text = requiredText(value, field);
  if (text.includes('*')) throw new Error(`INVALID_${field}`);
  return text;
}

function maskSensitive(value: string | null) {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

function toSafeResponse(details: Awaited<ReturnType<typeof repository.findActiveForInstructor>>) {
  if (!details) return null;
  return {
    ...details,
    accountNumber: maskSensitive(details.accountNumber),
    iban: maskSensitive(details.iban),
  };
}

function normalizeInput(input: PaymentDetailsInput, requireSensitiveFields: boolean) {
  const accountNumber = optionalText(input.accountNumber, 'ACCOUNT_NUMBER');
  const iban = optionalText(input.iban, 'IBAN');
  if (requireSensitiveFields && !accountNumber) {
    throw new Error('INVALID_PAYMENT_DETAILS');
  }
  return {
    bankName: requiredText(input.bankName, 'BANK_NAME'),
    ...(input.accountTitle !== undefined ? { accountTitle: requiredText(input.accountTitle, 'ACCOUNT_TITLE') } : {}),
    ...(accountNumber ? { accountNumber } : {}),
    ...(iban ? { iban } : {}),
  };
}

export async function getPaymentDetails(organizationId: string, instructorUserId: string) {
  return toSafeResponse(await repository.findActiveForInstructor(organizationId, instructorUserId));
}

export async function savePaymentDetails(
  organizationId: string,
  instructorUserId: string,
  input: PaymentDetailsInput,
) {
  const existing = await repository.findActiveForInstructor(organizationId, instructorUserId);
  const data = normalizeInput(input, !existing);
  const saved = existing
    ? await repository.updateExisting(existing.id, data)
    : await repository.saveForInstructor(organizationId, instructorUserId, {
        bankName: data.bankName,
        accountTitle: data.accountTitle,
        accountNumber: data.accountNumber!,
        iban: data.iban!,
      });
  return toSafeResponse(saved);
}

export async function getOrganizationPaymentDetails(organizationId: string) {
  return toSafeResponse(await repository.findActiveForOrganization(organizationId));
}

export async function saveOrganizationPaymentDetails(
  organizationId: string,
  input: Pick<PaymentDetailsInput, 'bankName' | 'accountNumber'>,
) {
  const bankName = requiredText(input.bankName, 'BANK_NAME');
  const accountNumber = requiredText(input.accountNumber, 'ACCOUNT_NUMBER');
  const existing = await repository.findActiveForOrganization(organizationId);
  const saved = existing
    ? await repository.updateExisting(existing.id, { bankName, accountNumber })
    : await repository.saveForOrganization(organizationId, { bankName, accountNumber });
  return toSafeResponse(saved);
}
