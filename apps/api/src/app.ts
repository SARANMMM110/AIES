import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { prisma } from "@aes/database";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { rateLimit } from "./middleware/rateLimit";
import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { productsRouter } from "./modules/products/products.routes";
import { bundlesRouter } from "./modules/bundles/bundles.routes";
import { accessRouter } from "./modules/access/access.routes";
import { clientsRouter } from "./modules/clients/clients.routes";
import { projectsRouter } from "./modules/projects/projects.routes";
import { workflowsRouter } from "./modules/workflows/workflows.routes";
import { adminRouter } from "./modules/admin/admin.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { sharedRouter } from "./modules/shared/shared.routes";
import { agencySetupRouter } from "./modules/agency/agency-setup.routes";
import { workflowEngineRouter } from "./modules/workflows/workflow-engine.routes";
import { productExportRouter } from "./modules/products/export.routes";
import { catalogRouter } from "./modules/catalog/catalog.routes";
import { purchaseRouter } from "./modules/purchase/purchase.routes";
import { purchasesRouter } from "./modules/purchase/purchases.routes";
import { wikiRouter } from "./modules/wiki/wiki.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { resellerRouter } from "./modules/reseller/reseller.routes";
import { salesInquiriesRouter } from "./modules/sales/inquiries.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { ok } from "./utils/response";
import { logError } from "./lib/logger";
import { AppError } from "./utils/errors";

const PAYMENT_DISABLED = new AppError(
  410,
  "Payment checkout is disabled. Use the sales inquiry form — the team will follow up by email.",
  "PAYMENT_DISABLED"
);

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        const allowed = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
        if (!origin || allowed.includes(origin) || allowed.includes("*")) {
          callback(null, true);
          return;
        }
        // Exported / WordPress sales pages may post inquiries from other hosts.
        callback(null, true);
      },
      credentials: true,
    })
  );

  // Stripe webhook kept for compatibility but payments are disabled.
  app.post("/api/payments/webhook", express.raw({ type: "application/json" }), (_req, res) => {
    res.status(410).json({
      success: false,
      error: { message: PAYMENT_DISABLED.message, code: PAYMENT_DISABLED.code },
    });
  });

  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.get("/api/health", async (_req, res) => {
    let database: "up" | "down" = "down";
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = "up";
    } catch (err) {
      logError("health.database_down", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    const ready = database === "up";
    res.status(ready ? 200 : 503).json(
      ok({
        status: ready ? "ok" : "degraded",
        service: env.APP_NAME,
        env: env.NODE_ENV,
        database,
        payments: "disabled",
        ai: env.AI_PROVIDER,
        timestamp: new Date().toISOString(),
      })
    );
  });

  app.use(
    "/api/auth",
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_AUTH_MAX,
      name: "auth",
    }),
    authRouter
  );

  app.use("/api/catalog", catalogRouter);
  app.use("/api/sales/inquiries", salesInquiriesRouter);
  app.use("/api/notifications", notificationsRouter);
  app.post("/api/payments/checkout", (_req, _res, next) => next(PAYMENT_DISABLED));
  app.use("/api/payments", paymentsRouter);
  app.post("/api/purchases", (_req, _res, next) => next(PAYMENT_DISABLED));
  app.use("/api/purchases", purchasesRouter);
  app.use("/api/purchase", purchaseRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/products/:idOrSlug/setup", agencySetupRouter);
  app.use("/api/products/:idOrSlug/export", productExportRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/bundles", bundlesRouter);
  app.use("/api/access", accessRouter);
  app.use("/api/clients", clientsRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/workflows/engine", workflowEngineRouter);
  app.use("/api/workflows", workflowsRouter);
  app.use("/api/shared", sharedRouter);
  app.use("/api/wiki", wikiRouter);
  app.use("/api/reseller", resellerRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Re-export for typed error usage in webhook edge cases
export { AppError };
