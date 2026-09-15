import { env } from "../../config/env";
import { logInfo } from "../../lib/logger";

export type NotificationType =
  | "purchase_confirmation"
  | "payment_failure"
  | "access_granted"
  | "welcome"
  | "password_reset"
  | "admin_purchase_alert"
  | "reseller_purchase_confirmation"
  | "reseller_new_sale"
  | "sales_inquiry"
  | "reseller_inquiry";

export type NotificationPayload = {
  type: NotificationType;
  to: string;
  data: Record<string, unknown>;
};

export interface EmailProvider {
  readonly name: string;
  send(input: { to: string; subject: string; text: string; html?: string }): Promise<void>;
}

class NoneEmailProvider implements EmailProvider {
  readonly name = "none";
  async send(): Promise<void> {
    // Intentionally no-op — never fake delivery
  }
}

class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(input: { to: string; subject: string; text: string }): Promise<void> {
    logInfo("email.console", { to: input.to, subject: input.subject });
    console.log(`\n--- EMAIL (${input.to}) ---\n${input.subject}\n${input.text}\n---\n`);
  }
}

function getEmailProvider(): EmailProvider {
  if (env.EMAIL_PROVIDER === "console") return new ConsoleEmailProvider();
  return new NoneEmailProvider();
}

function render(type: NotificationType, data: Record<string, unknown>) {
  switch (type) {
    case "purchase_confirmation":
      return {
        subject: `Purchase confirmed — ${String(data.purchaseCode || "")}`,
        text: `Your purchase ${data.purchaseCode} for ${data.currency} ${((Number(data.totalAmount) || 0) / 100).toFixed(2)} is confirmed.`,
      };
    case "payment_failure":
      return {
        subject: "Payment unsuccessful",
        text: `We could not complete payment for ${data.purchaseCode || "your order"}. Access was not granted.`,
      };
    case "access_granted":
      return {
        subject: "Access granted — AI Enterprise Studio",
        text: `Access is ready for purchase ${data.purchaseCode}. Products unlocked: ${data.productCount ?? ""}.`,
      };
    case "welcome":
      return {
        subject: "Your AI Enterprise Studio account is ready",
        text: [
          `Welcome${data.firstName ? `, ${data.firstName}` : ""}.`,
          "",
          "An administrator created your account and unlocked agency access.",
          `Email / username: ${data.email || "—"}`,
          data.password ? `Temporary password: ${data.password}` : "",
          data.agencies ? `Agencies: ${data.agencies}` : "",
          "",
          `Sign in: ${data.loginUrl || "your AI Enterprise Studio login page"}`,
          "After signing in, open Products to use your agencies.",
          "You can change your password anytime from Account settings.",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    case "password_reset":
      return {
        subject: "Password reset",
        text: "A password reset was requested. If you did not request this, ignore this message.",
      };
    case "admin_purchase_alert":
      return {
        subject: `New purchase ${data.purchaseCode || ""}`,
        text: `Purchase ${data.purchaseCode} total ${data.currency} ${((Number(data.totalAmount) || 0) / 100).toFixed(2)}.`,
      };
    case "reseller_purchase_confirmation":
      return {
        subject: `Access confirmed — ${String(data.offerTitle || "your purchase")}`,
        text: `Sale ${data.saleCode} is paid. Amount ${data.currency} ${((Number(data.amountCents) || 0) / 100).toFixed(2)}. Use access is ready in your workspace.`,
      };
    case "reseller_new_sale":
      return {
        subject: `New reseller sale ${data.saleCode || ""}`,
        text: `${data.offerTitle} sold. Amount ${data.currency} ${((Number(data.amountCents) || 0) / 100).toFixed(2)}.`,
      };
    case "sales_inquiry":
      return {
        subject: `New AES inquiry — ${String(data.interest || "Sales page")}`,
        text: [
          `Interest: ${data.interest || "—"}`,
          `Name: ${data.firstName || ""} ${data.lastName || ""}`.trim(),
          `Email: ${data.email || "—"}`,
          `Phone: ${data.phone || "—"}`,
          `Company: ${data.company || "—"}`,
          `Message: ${data.message || "—"}`,
          "",
          "Stored in Admin → Inquiries.",
        ].join("\n"),
      };
    case "reseller_inquiry":
      return {
        subject: `New customer inquiry — ${String(data.interest || "Your sales page")}`,
        text: [
          `Page: ${data.interest || "—"}`,
          `Name: ${data.firstName || ""} ${data.lastName || ""}`.trim(),
          `Email: ${data.email || "—"}`,
          `Phone: ${data.phone || "—"}`,
          `Company: ${data.company || "—"}`,
          `Message: ${data.message || "—"}`,
          "",
          "Stored in your Reseller → Customers tab.",
        ].join("\n"),
      };
    default:
      return { subject: "AI Enterprise Studio", text: "Notification" };
  }
}

/** Send notification via configured provider. Never throws to callers. */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  try {
    const provider = getEmailProvider();
    const { subject, text } = render(payload.type, payload.data);
    const body = `${text}\n\n— ${env.APP_NAME}\nFrom: ${env.EMAIL_FROM}`;
    if (provider.name === "none") {
      // Inquiry alerts must not disappear silently when mail is disabled.
      if (payload.type === "sales_inquiry" || payload.type === "reseller_inquiry") {
        logInfo("email.inquiry_fallback", { to: payload.to, subject });
        console.log(`\n--- INQUIRY EMAIL (${payload.to}) ---\n${subject}\n${body}\n---\n`);
      }
      return;
    }
    await provider.send({ to: payload.to, subject, text: body });
  } catch (err) {
    logInfo("email.send_failed", {
      type: payload.type,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
