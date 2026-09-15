import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().default("AI Enterprise Studio"),
  API_PORT: z.coerce.number().default(4000),
  API_URL: z.string().default("http://localhost:4000"),
  APP_URL: z.string().default("http://localhost:3000"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  /** simulated | stripe */
  PAYMENT_PROVIDER: z.enum(["simulated", "stripe"]).default("simulated"),
  /** Allow simulated checkout in production (default false) */
  PAYMENT_ALLOW_SIMULATED: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  PAYMENT_CURRENCY: z.string().default("usd"),

  /** none | console | smtp (smtp reserved) */
  EMAIL_PROVIDER: z.enum(["none", "console"]).default("console"),
  EMAIL_FROM: z.string().default("noreply@aienterprisestudio.com"),
  /** AES sales inquiry notifications (non-rebranded pages) */
  AES_INQUIRY_NOTIFY_EMAIL: z.string().email().default("m3emp110@gmail.com"),

  /** none | openai */
  AI_PROVIDER: z.enum(["none", "openai"]).default("none"),
  AI_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  AI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  AI_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(24000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(2048),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  AI_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(20),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_PURCHASE_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_AI_MAX: z.coerce.number().int().positive().default(20),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    console.error("Invalid environment configuration:", details);
    throw new Error("Invalid environment configuration. Check .env against .env.example.");
  }
  const data = parsed.data;

  if (data.NODE_ENV === "production") {
    if (data.PAYMENT_PROVIDER === "simulated" && !data.PAYMENT_ALLOW_SIMULATED) {
      throw new Error(
        "PAYMENT_PROVIDER=simulated is not allowed in production unless PAYMENT_ALLOW_SIMULATED=true"
      );
    }
    if (data.PAYMENT_PROVIDER === "stripe") {
      if (!data.STRIPE_SECRET_KEY || !data.STRIPE_WEBHOOK_SECRET) {
        throw new Error("Stripe requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in production");
      }
    }
    if (data.JWT_SECRET.includes("change-me")) {
      throw new Error("JWT_SECRET must be changed for production");
    }
  }

  return data;
}

export const env = loadEnv();

export function paymentMode(): "simulated" | "stripe" {
  return env.PAYMENT_PROVIDER;
}

export function aiEnabled(): boolean {
  return env.AI_PROVIDER !== "none" && Boolean(env.AI_API_KEY);
}
