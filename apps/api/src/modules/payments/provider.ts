import { env, paymentMode } from "../../config/env";
import { SimulatedPaymentProvider } from "./simulated.provider";
import { StripePaymentProvider } from "./stripe.provider";
import type { PaymentProvider } from "./types";
import { PaymentConfigError } from "./types";

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const mode = paymentMode();
  if (mode === "stripe") {
    cached = new StripePaymentProvider();
    return cached;
  }
  if (env.NODE_ENV === "production" && !env.PAYMENT_ALLOW_SIMULATED) {
    throw new PaymentConfigError("Simulated payments are disabled in production");
  }
  cached = new SimulatedPaymentProvider();
  return cached;
}

/** Test helper */
export function resetPaymentProviderCache() {
  cached = null;
}
