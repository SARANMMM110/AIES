/** Premium sales-page service labels matching the AI Advantage reference HTML. */

export const SERVICE_ICONS = ["⌘", "▦", "✣", "⌘", "✂", "▣", "▥", "◫", "◈", "↗"] as const;

export const AI_ADVANTAGE_SERVICE_BREAKS: Record<string, [string, string]> = {
  "AI Readiness and Opportunity Audit": ["AI Readiness and", "Opportunity Audit"],
  "Process and Task Mapping": ["Process and", "Task Mapping"],
  "AI Use-Case Prioritization and Roadmap": ["AI Use-Case Prioritization", "and Roadmap"],
  "Prompt Systems and Workflow SOPs": ["Prompt Systems and", "Workflow SOPs"],
  "Marketing and Content Workflow Enablement": ["Marketing and Content", "Workflow Enablement"],
  "Customer Communication Workflow Enablement": ["Customer Communication", "Workflow Enablement"],
  "Administration and Operations Workflow Enablement": [
    "Administration and Operations",
    "Workflow Enablement",
  ],
  "Knowledge Base and Staff Enablement": ["Knowledge Base and", "Staff Enablement"],
  "AI Governance, Risk and Quality Controls": ["AI Governance, Risk", "and Quality Controls"],
  "AI Reporting and Optimization": ["AI Reporting and", "Optimization"],
};

export const AI_ADVANTAGE_SERVICE_DESC: Record<string, string> = {
  "AI Readiness and Opportunity Audit":
    "Assess where AI can create practical value across the business.",
  "Process and Task Mapping":
    "Map repeatable work, handoffs, bottlenecks and improvement opportunities.",
  "AI Use-Case Prioritization and Roadmap":
    "Rank opportunities and turn them into a practical implementation roadmap.",
  "Prompt Systems and Workflow SOPs":
    "Create repeatable prompt systems, SOPs and quality checkpoints.",
  "Marketing and Content Workflow Enablement":
    "Build structured AI workflows for planning, creation and content operations.",
  "Customer Communication Workflow Enablement":
    "Improve customer-facing communication with consistent guided workflows.",
  "Administration and Operations Workflow Enablement":
    "Reduce repetitive operational work with documented AI-assisted processes.",
  "Knowledge Base and Staff Enablement":
    "Turn business knowledge into usable guidance, resources and staff workflows.",
  "AI Governance, Risk and Quality Controls":
    "Define responsible-use boundaries, review gates and quality controls.",
  "AI Reporting and Optimization":
    "Measure workflow performance, identify gaps and improve the system over time.",
};

export function serviceDescription(title: string): string {
  return (
    AI_ADVANTAGE_SERVICE_DESC[title] ||
    "Structured delivery service inside this agency for guided workflow execution."
  );
}
