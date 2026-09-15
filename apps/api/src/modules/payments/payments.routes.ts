import { Router } from "express";
import { z } from "zod";
import { authenticate, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { ok } from "../../utils/response";
import { env } from "../../config/env";
import { rateLimit } from "../../middleware/rateLimit";
import { startCheckout, refreshPurchasePaymentStatus } from "./checkout.service";
import { AppError } from "../../utils/errors";

export const paymentsRouter = Router();

paymentsRouter.get("/config", (_req, res) => {
  res.json(
    ok({
      provider: env.PAYMENT_PROVIDER,
      publishableKey:
        env.PAYMENT_PROVIDER === "stripe" ? env.STRIPE_PUBLISHABLE_KEY || null : null,
      simulated: env.PAYMENT_PROVIDER === "simulated",
    })
  );
});

paymentsRouter.post(
  "/checkout",
  authenticate,
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_PURCHASE_MAX,
    name: "checkout",
  }),
  validate(
    z.object({
      items: z
        .array(
          z.object({
            type: z.enum(["product", "bundle"]),
            slug: z.string().min(1).max(120),
          })
        )
        .min(1)
        .max(20),
    })
  ),
  async (req: AuthRequest, res, next) => {
    try {
      const body = req.body as {
        items: Array<{ type: "product" | "bundle"; slug: string }>;
      };
      const result = await startCheckout({
        userId: req.user!.id,
        userEmail: req.user!.email,
        items: body.items,
        actorEmail: req.user!.email,
      });
      res.status(201).json(ok(result));
    } catch (err) {
      next(err);
    }
  }
);

paymentsRouter.get(
  "/purchases/:purchaseId/status",
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const result = await refreshPurchasePaymentStatus(
        req.params.purchaseId,
        req.user!.id,
        req.user!.role
      );
      res.json(ok(result));
    } catch (err) {
      next(err);
    }
  }
);

/** Reject non-webhook POSTs pretending to confirm payment via client */
paymentsRouter.post("/confirm-client", authenticate, (_req, res, next) => {
  next(
    new AppError(
      400,
      "Client-side payment confirmation is not accepted. Wait for provider verification.",
      "CLIENT_CONFIRM_FORBIDDEN"
    )
  );
});
