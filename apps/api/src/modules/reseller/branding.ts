import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@aes/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";
import { readPolicySnapshot } from "./entitlements";

const ASSET_ROOT = path.resolve(process.cwd(), "data", "reseller-assets");
const MAX_LOGO = 800_000;
const MAX_FAVICON = 200_000;
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/ico": "ico",
};

export type BrandInput = {
  brandName?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  footerText?: string | null;
};

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function hex(value: unknown) {
  const color = clean(value, 16);
  if (!color) return null;
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    throw new AppError(400, "Colors must be hex values", "INVALID_BRAND");
  }
  return color;
}

export function serializeBranding(row: {
  brandName: string | null;
  logoPath: string | null;
  faviconPath: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  supportEmail: string | null;
  website: string | null;
  supportPhone: string | null;
  footerText: string | null;
  updatedAt: Date;
} | null) {
  if (!row) {
    return {
      brandName: null,
      logoUrl: null,
      faviconUrl: null,
      primaryColor: null,
      secondaryColor: null,
      supportEmail: null,
      website: null,
      supportPhone: null,
      footerText: null,
      updatedAt: null,
    };
  }
  return {
    brandName: row.brandName,
    logoUrl: row.logoPath ? `${env.API_URL}${row.logoPath}` : null,
    faviconUrl: row.faviconPath ? `${env.API_URL}${row.faviconPath}` : null,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    supportEmail: row.supportEmail,
    website: row.website,
    supportPhone: row.supportPhone,
    footerText: row.footerText,
    updatedAt: row.updatedAt,
  };
}

export async function loadBranding(userId: string) {
  return prisma.resellerBranding.findUnique({ where: { userId } });
}

export async function saveBranding(userId: string, input: BrandInput) {
  const supportEmail = clean(input.supportEmail, 120);
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    throw new AppError(400, "Support email is invalid", "INVALID_BRAND");
  }
  const data = {
    brandName: clean(input.brandName, 80),
    primaryColor: hex(input.primaryColor),
    secondaryColor: hex(input.secondaryColor),
    supportEmail,
    website: null,
    supportPhone: clean(input.supportPhone, 40),
    footerText: clean(input.footerText, 180),
  };
  return prisma.resellerBranding.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export async function storeBrandAsset(userId: string, kind: "logo" | "favicon", dataUrl: string) {
  const match =
    /^data:(image\/[a-z0-9.+-]+)(?:;charset=[^;,]+)?;base64,([a-z0-9+/=\s]+)$/i.exec(
      String(dataUrl || "").trim()
    );
  if (!match) throw new AppError(400, "Upload a PNG, JPEG, WebP, or ICO file", "INVALID_UPLOAD");
  const mime = match[1].toLowerCase();
  const ext = TYPES[mime];
  if (!ext) throw new AppError(400, "Upload a PNG, JPEG, WebP, or ICO file", "INVALID_UPLOAD");
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  const limit = kind === "logo" ? MAX_LOGO : MAX_FAVICON;
  if (!bytes.length || bytes.length > limit) {
    throw new AppError(400, `${kind === "logo" ? "Logo" : "Favicon"} is too large`, "INVALID_UPLOAD");
  }
  const filename = `${kind}-${randomBytes(8).toString("hex")}.${ext}`;
  const dir = path.join(ASSET_ROOT, userId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);
  const publicPath = `/api/reseller/public/brand-assets/${userId}/${filename}`;
  await prisma.resellerBranding.upsert({
    where: { userId },
    create: { userId, ...(kind === "logo" ? { logoPath: publicPath } : { faviconPath: publicPath }) },
    update: kind === "logo" ? { logoPath: publicPath } : { faviconPath: publicPath },
  });
  return publicPath;
}

export async function readOwnedAsset(userId: string, filename: string) {
  if (!/^(logo|favicon)-[a-f0-9]{16}\.(png|jpg|webp|ico)$/.test(filename)) {
    throw new AppError(404, "Asset not found", "NOT_FOUND");
  }
  const branding = await prisma.resellerBranding.findUnique({ where: { userId } });
  const publicPath = `/api/reseller/public/brand-assets/${userId}/${filename}`;
  const allowed = [branding?.logoPath, branding?.faviconPath].filter(Boolean);
  const file = path.join(ASSET_ROOT, userId, filename);
  const rooted = path.join(ASSET_ROOT, userId);
  if (!file.startsWith(rooted)) throw new AppError(404, "Asset not found", "NOT_FOUND");

  // Prefer DB ownership, but still serve a matching file in this user's asset folder
  // so a freshly uploaded preview is not blank if paths briefly drift.
  if (!allowed.includes(publicPath)) {
    try {
      const { access } = await import("fs/promises");
      await access(file);
    } catch {
      throw new AppError(404, "Asset not found", "NOT_FOUND");
    }
  }
  return file;
}

/**
 * White-label is not implied by resale rights.
 * Live policy wins so a revoked branding permission stops public presentation.
 */
export async function whiteLabelAllowed(entitlement: {
  policySnapshot: unknown;
}) {
  const snapshot = readPolicySnapshot(entitlement.policySnapshot);
  return snapshot?.allowBranding === true;
}

export async function publicBrandFor(userId: string, allowed: boolean) {
  if (!allowed) return null;
  const row = await loadBranding(userId);
  if (!row) return null;
  return serializeBranding(row);
}
