import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { AppError } from "../../utils/errors";

/**
 * Legacy purchase-intent endpoints.
 * Payment checkout is disabled — sales pages collect inquiries instead.
 */
export const purchaseRouter = Router();

purchaseRouter.use(authenticate);

purchaseRouter.post("/intent", (_req, _res, next) => {
  next(
    new AppError(
      410,
      "Payment checkout is disabled. Use the sales inquiry form — the team will follow up by email.",
      "PAYMENT_DISABLED"
    )
  );
});
