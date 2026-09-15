export type CheckoutLine = {
  name: string;
  amountCents: number;
  quantity: number;
  productSlug?: string;
  bundleSlug?: string;
};

export type CreateCheckoutInput = {
  purchaseId: string;
  purchaseCode: string;
  currency: string;
  amountCents: number;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  lines: CheckoutLine[];
  metadata?: Record<string, string>;
};

export type CreateCheckoutResult = {
  provider: string;
  sessionId: string;
  checkoutUrl: string | null;
  /** When true, payment is already confirmed (simulated / zero-total) */
  alreadyPaid?: boolean;
};

export type VerifiedPayment = {
  provider: string;
  eventId: string;
  eventType: string;
  sessionId?: string | null;
  paymentId?: string | null;
  purchaseId?: string | null;
  resellerSaleId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  status: "paid" | "failed" | "cancelled" | "ignored";
  rawSummary: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  /**
   * Verify webhook signature and normalize event.
   * rawBody required for signature providers.
   */
  verifyWebhook(input: {
    rawBody: Buffer;
    signatureHeader: string | undefined;
  }): Promise<VerifiedPayment>;
}

export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}
