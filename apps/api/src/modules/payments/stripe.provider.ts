import Stripe from "stripe";
import { env } from "../../config/env";
import { PaymentConfigError, type CreateCheckoutInput, type CreateCheckoutResult, type PaymentProvider, type VerifiedPayment } from "./types";

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";
  private stripe: Stripe;

  constructor() {
    if (!env.STRIPE_SECRET_KEY) {
      throw new PaymentConfigError("STRIPE_SECRET_KEY is required for Stripe payments");
    }
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: input.customerEmail,
      client_reference_id: input.purchaseId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: input.lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: line.amountCents,
          product_data: {
            name: line.name,
            metadata: {
              productSlug: line.productSlug || "",
              bundleSlug: line.bundleSlug || "",
            },
          },
        },
      })),
      metadata: {
        purchaseId: input.metadata?.kind === "reseller_sale" ? "" : input.purchaseId,
        purchaseCode: input.purchaseCode,
        ...(input.metadata || {}),
      },
      payment_intent_data: {
        metadata: {
          purchaseId: input.metadata?.kind === "reseller_sale" ? "" : input.purchaseId,
          purchaseCode: input.purchaseCode,
          kind: input.metadata?.kind || "purchase",
          resellerSaleId: input.metadata?.resellerSaleId || "",
        },
      },
    });

    if (!session.url) {
      throw new PaymentConfigError("Stripe Checkout Session missing URL");
    }

    return {
      provider: this.name,
      sessionId: session.id,
      checkoutUrl: session.url,
      alreadyPaid: false,
    };
  }

  async verifyWebhook(input: {
    rawBody: Buffer;
    signatureHeader: string | undefined;
  }): Promise<VerifiedPayment> {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new PaymentConfigError("STRIPE_WEBHOOK_SECRET is required");
    }
    if (!input.signatureHeader) {
      throw new PaymentConfigError("Missing Stripe-Signature header");
    }

    const event = this.stripe.webhooks.constructEvent(
      input.rawBody,
      input.signatureHeader,
      env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const paid =
        session.payment_status === "paid" ||
        session.status === "complete";
      return {
        provider: this.name,
        eventId: event.id,
        eventType: event.type,
        sessionId: session.id,
        paymentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        purchaseId:
          session.metadata?.kind === "reseller_sale"
            ? null
            : session.metadata?.purchaseId || session.client_reference_id || null,
        resellerSaleId:
          session.metadata?.resellerSaleId ||
          (session.metadata?.kind === "reseller_sale" ? session.client_reference_id : null),
        amountCents: session.amount_total,
        currency: session.currency,
        status: paid ? "paid" : "failed",
        rawSummary: {
          type: event.type,
          payment_status: session.payment_status,
          amount_total: session.amount_total,
          currency: session.currency,
        },
      };
    }

    if (
      event.type === "checkout.session.expired" ||
      event.type === "payment_intent.payment_failed"
    ) {
      const obj = event.data.object as {
        id?: string;
        metadata?: { purchaseId?: string; resellerSaleId?: string; kind?: string };
      };
      return {
        provider: this.name,
        eventId: event.id,
        eventType: event.type,
        sessionId: event.type.startsWith("checkout") ? obj.id : null,
        purchaseId: obj.metadata?.kind === "reseller_sale" ? null : obj.metadata?.purchaseId || null,
        resellerSaleId: obj.metadata?.resellerSaleId || null,
        status: event.type.includes("expired") ? "cancelled" : "failed",
        rawSummary: { type: event.type },
      };
    }

    return {
      provider: this.name,
      eventId: event.id,
      eventType: event.type,
      status: "ignored",
      rawSummary: { type: event.type },
    };
  }
}
