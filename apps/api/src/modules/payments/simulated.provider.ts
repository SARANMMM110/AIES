import { randomUUID } from "crypto";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  VerifiedPayment,
} from "./types";

/**
 * Development / smoke-test provider.
 * Marks checkout as already paid — never use in production without PAYMENT_ALLOW_SIMULATED.
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = "simulated";

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const sessionId = `sim_sess_${input.purchaseId}_${randomUUID().slice(0, 8)}`;
    return {
      provider: this.name,
      sessionId,
      checkoutUrl: null,
      alreadyPaid: true,
    };
  }

  async verifyWebhook(): Promise<VerifiedPayment> {
    return {
      provider: this.name,
      eventId: `sim_evt_${randomUUID()}`,
      eventType: "simulated.noop",
      status: "ignored",
      rawSummary: { note: "Simulated provider does not process webhooks" },
    };
  }
}
