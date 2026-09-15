export type ProductResource = {
  id: string;
  type: string;
  title: string;
  slug: string;
  description: string | null;
  content: Record<string, unknown> | null;
};

export type WorkflowInputField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
};

export type WorkflowDef = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  purpose: string | null;
  serviceResourceId: string | null;
  displayOrder: number;
  inputs?: WorkflowInputField[] | unknown;
  outputDefinition?: { deliverableType?: string; sections?: string[] } | null;
  reviewRequirements?: { checklist?: string[] } | null;
  nextAction?: string | null;
  aiInstructionTemplate?: string | null;
};

export type ProductWorkspace = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  tagline: string | null;
  status: string;
  icon: string | null;
  priceCents?: number | null;
  currency?: string;
  services: ProductResource[];
  resourceLibrary?: ProductResource[];
  resources?: ProductResource[];
  workflows?: WorkflowDef[];
  workflowCatalog?: { targetCount?: number; definedCount?: number; note?: string };
  configuration?: Record<string, unknown> | null;
  serviceCount: number;
  workflowCount: number;
};

export type SetupConfig = {
  aiPlatform: string | null;
  agencyName: string | null;
  country: string | null;
  targetNiche: string | null;
  geographicServiceArea: string | null;
  experienceLevel: string | null;
  preferredDeliveryModel: string | null;
  weeklyTimeAvailability: string | null;
  monthlyIncomeOrClientTarget: string | null;
  selectedServiceIds: string[];
};

export type ClientRow = {
  id: string;
  name: string;
  email?: string | null;
  industry: string | null;
  location: string | null;
  goals: string | null;
  mainProblems?: string | null;
  businessType?: string | null;
  website?: string | null;
  notes?: string | null;
};

export type ResultRow = {
  id: string;
  title: string | null;
  workflowKey: string;
  createdAt: string;
  updatedAt?: string;
  content: {
    finalOutput?: string;
    reviewStatus?: string;
    instruction?: string;
  };
  metadata?: { productId?: string } | null;
};

export function productAccent(configuration: Record<string, unknown> | null | undefined): string {
  const accent = configuration?.accent;
  return typeof accent === "string" && accent.startsWith("#") ? accent : "#2A6B55";
}

export function productCategory(configuration: Record<string, unknown> | null | undefined, tagline: string | null): string {
  const cat = configuration?.category;
  return typeof cat === "string" && cat ? cat : tagline || "Agency Operating System";
}
