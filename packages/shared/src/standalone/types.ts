export type StandaloneWorkflowInput = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
};

export type StandaloneWorkflow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  purpose: string | null;
  serviceResourceId: string | null;
  serviceName: string;
  displayOrder: number;
  inputs: StandaloneWorkflowInput[];
  aiInstructionTemplate: string;
  outputDefinition: unknown;
  reviewRequirements: unknown;
  nextAction: string | null;
};

export type StandaloneService = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
};

export type StandaloneResource = {
  id: string;
  type: string;
  title: string;
  slug: string;
  description: string | null;
  content: unknown;
};

export type StandaloneWiki = {
  title: string;
  description: string | null;
  content: unknown;
};

export type ProductExportManifest = {
  version: 1;
  exportedAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    shortDescription: string | null;
    tagline: string | null;
    icon: string | null;
    category: string;
    accent: string;
    serviceCount: number;
    workflowCount: number;
  };
  services: StandaloneService[];
  workflows: StandaloneWorkflow[];
  resources: StandaloneResource[];
  wiki: StandaloneWiki | null;
  aiPlatforms: string[];
};
