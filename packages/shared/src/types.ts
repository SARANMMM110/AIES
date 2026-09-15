import type {
  AccessSource,
  AccessStatus,
  BundleStatus,
  ProductResourceType,
  ProductStatus,
  ProjectStatus,
  UserRole,
  WorkflowProgressStatus,
} from "./constants";

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: string;
}

export interface AuthResponse {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface ApiErrorBody {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccessBody<T> | ApiErrorBody;

/** Card-ready product summary used by the central dashboard. */
export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  tagline: string | null;
  status: ProductStatus;
  priceCents: number | null;
  currency: string;
  thumbnailUrl: string | null;
  icon: string | null;
  serviceCount?: number;
  workflowCount?: number;
  resourceCount?: number;
}

export interface ProductResourceSummary {
  id: string;
  type: ProductResourceType;
  title: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isPublished: boolean;
}

export interface WorkflowDefinitionSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface BundleSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: BundleStatus;
  priceCents: number | null;
  currency: string;
}

export interface ProductAccessSummary {
  id: string;
  productId: string;
  userId: string;
  source: AccessSource;
  status: AccessStatus;
  bundleId: string | null;
}

export interface ClientSummary {
  id: string;
  name: string;
  email: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  clientId: string;
  productId: string | null;
}

export interface WorkflowProgressSummary {
  id: string;
  workflowKey: string;
  status: WorkflowProgressStatus;
  projectId: string;
  progressPercent: number;
}
