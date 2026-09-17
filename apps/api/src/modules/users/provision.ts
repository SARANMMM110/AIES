import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@aes/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";
import { toPublicUser } from "../../utils/response";
import { grantDirectProductAccess } from "../access/grant-access";
import { sendNotification } from "../email/notifications";
import { writeAuditLog } from "../audit/audit";
import { APPROVED_PRODUCT_SLUGS } from "../../constants/product-scope";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

export const provisionCustomerSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  password: passwordSchema,
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  productIds: z.array(z.string().min(1)).min(1, "Select at least one agency"),
  inquiryId: z.string().min(1).optional().nullable(),
  notifyCustomer: z.boolean().optional().default(true),
});

export type ProvisionCustomerInput = z.infer<typeof provisionCustomerSchema>;

function prismaCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  return "code" in err ? String((err as { code?: string }).code ?? "") || null : null;
}

export async function provisionCustomer(
  input: ProvisionCustomerInput,
  actor?: { id?: string; email?: string }
) {
  const email = input.email;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "A user with this email already exists", "EMAIL_TAKEN");
  }

  const uniqueProductIds = [...new Set(input.productIds)];
  const products = await prisma.product.findMany({
    where: {
      id: { in: uniqueProductIds },
      slug: { in: [...APPROVED_PRODUCT_SLUGS] },
      status: { not: "ARCHIVED" },
    },
    select: { id: true, name: true, slug: true },
  });
  if (!products.length || products.length !== uniqueProductIds.length) {
    throw new AppError(400, "One or more selected agencies are invalid", "INVALID_PRODUCTS");
  }

  if (input.inquiryId) {
    try {
      const inquiry = await prisma.salesInquiry.findUnique({ where: { id: input.inquiryId } });
      if (!inquiry) throw new AppError(404, "Inquiry not found", "NOT_FOUND");
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Missing sales_inquiries table / schema drift — continue without linking inquiry.
      console.error("[provision] inquiry lookup failed", err);
    }
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  // Avoid interactive $transaction — Supabase pooler often fails it with opaque 500s.
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: "USER",
        isActive: true,
      },
    });
  } catch (err) {
    const code = prismaCode(err);
    if (code === "P2002") {
      throw new AppError(409, "A user with this email already exists", "EMAIL_TAKEN");
    }
    console.error("[provision] user.create failed", err);
    throw new AppError(
      500,
      err instanceof Error ? err.message : "Could not create user",
      "PROVISION_USER_FAILED"
    );
  }

  try {
    for (const product of products) {
      await grantDirectProductAccess(prisma, {
        userId: user.id,
        productId: product.id,
        source: "ADMIN_GRANT",
      });
    }
  } catch (err) {
    console.error("[provision] access grant failed", err);
    // Keep the user — admin can grant access from Users → Manage. Surface a clear error.
    throw new AppError(
      500,
      err instanceof Error
        ? `Account created but agency access failed: ${err.message}`
        : "Account created but agency access failed",
      "PROVISION_ACCESS_FAILED",
      { userId: user.id, email }
    );
  }

  if (input.inquiryId) {
    try {
      await prisma.salesInquiry.update({
        where: { id: input.inquiryId },
        data: { status: "CONTACTED" },
      });
    } catch (err) {
      console.error("[provision] inquiry status update failed", err);
    }
  }

  await writeAuditLog({
    actorId: actor?.id,
    actorEmail: actor?.email,
    action: "user.provisioned",
    entityType: "User",
    entityId: user.id,
    metadata: {
      email,
      productIds: products.map((p) => p.id),
      inquiryId: input.inquiryId || null,
    },
  });

  if (input.notifyCustomer !== false) {
    await sendNotification({
      type: "welcome",
      to: email,
      data: {
        firstName: input.firstName,
        email,
        password: input.password,
        loginUrl: `${env.APP_URL}/login`,
        agencies: products.map((p) => p.name).join(", "),
      },
    });
  }

  return {
    user: toPublicUser(user),
    agencies: products.map((p) => ({ id: p.id, name: p.name, slug: p.slug })),
    inquiryId: input.inquiryId || null,
  };
}
