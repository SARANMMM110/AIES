/** Shared role identifiers used across API and web. */
export const UserRole = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Product lifecycle status — admin creates → publishes. */
export const ProductStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

/** How a user gained access to a product. */
export const AccessSource = {
  DIRECT: "DIRECT",
  BUNDLE: "BUNDLE",
  ADMIN_GRANT: "ADMIN_GRANT",
} as const;

export type AccessSource = (typeof AccessSource)[keyof typeof AccessSource];

export const AccessStatus = {
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
  EXPIRED: "EXPIRED",
} as const;

export type AccessStatus = (typeof AccessStatus)[keyof typeof AccessStatus];

export const BundleStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;

export type BundleStatus = (typeof BundleStatus)[keyof typeof BundleStatus];

export const ProjectStatus = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const WorkflowProgressStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type WorkflowProgressStatus =
  (typeof WorkflowProgressStatus)[keyof typeof WorkflowProgressStatus];

/** Resource kinds a product can attach (services, workflows, guides, sales, etc.). */
export const ProductResourceType = {
  SERVICE: "SERVICE",
  WORKFLOW: "WORKFLOW",
  OPERATOR_GUIDE: "OPERATOR_GUIDE",
  SALES_PAGE: "SALES_PAGE",
  SALES_COPY: "SALES_COPY",
  POSITIONING: "POSITIONING",
  BUSINESS_STRATEGY: "BUSINESS_STRATEGY",
  OTHER: "OTHER",
} as const;

export type ProductResourceType =
  (typeof ProductResourceType)[keyof typeof ProductResourceType];

/** Complete Suite bundle slug — single suite for all 10 agencies. */
export const COMPLETE_SUITE_SLUG = "ai-enterprise-studio-complete-suite" as const;

export const PurchaseStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type PurchaseStatus = (typeof PurchaseStatus)[keyof typeof PurchaseStatus];

export const PurchaseType = {
  PRODUCT: "PRODUCT",
  MULTI_PRODUCT: "MULTI_PRODUCT",
  BUNDLE: "BUNDLE",
} as const;

export type PurchaseType = (typeof PurchaseType)[keyof typeof PurchaseType];

export const PurchaseItemType = {
  PRODUCT: "PRODUCT",
  BUNDLE: "BUNDLE",
} as const;

export type PurchaseItemType = (typeof PurchaseItemType)[keyof typeof PurchaseItemType];

export const API_ROUTES = {
  HEALTH: "/api/health",
  AUTH: {
    REGISTER: "/api/auth/register",
    LOGIN: "/api/auth/login",
    LOGOUT: "/api/auth/logout",
    ME: "/api/auth/me",
  },
  USERS: "/api/users",
  PRODUCTS: "/api/products",
  PRODUCTS_AVAILABLE: "/api/products/available",
  DASHBOARD: "/api/dashboard",
  BUNDLES: "/api/bundles",
  ACCESS: "/api/access",
  PURCHASES: "/api/purchases",
  PURCHASE_INTENT: "/api/purchase/intent",
  CATALOG: "/api/catalog",
  CLIENTS: "/api/clients",
  PROJECTS: "/api/projects",
  WORKFLOWS: "/api/workflows",
  RESULTS: "/api/results",
  SHARED: "/api/shared",
  ADMIN: "/api/admin",
} as const;
