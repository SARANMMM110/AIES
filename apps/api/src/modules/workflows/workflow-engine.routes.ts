import { Router } from "express";
import { z } from "zod";
import { prisma } from "@aes/database";
import { authenticate, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError, assertFound } from "../../utils/errors";
import { ok } from "../../utils/response";
import { userHasProductAccess } from "../access/access.routes";
import { assertAiAvailable } from "../ai/provider";
import { rateLimit } from "../../middleware/rateLimit";
import { env } from "../../config/env";

/**
 * Reusable Stage 3B workflow execution helpers.
 * Builds provider-ready instructions from agency + client + workflow + inputs.
 * Does not call external AI providers (architecture-ready for later).
 */
export const workflowEngineRouter = Router();

workflowEngineRouter.use(authenticate);

async function assertWorkflowAccess(userId: string, role: string, productId: string) {
  const allowed = await userHasProductAccess(userId, productId, role);
  if (!allowed) {
    throw new AppError(403, "No access to this product", "PRODUCT_ACCESS_DENIED");
  }
}

function fillTemplate(
  template: string,
  values: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = values[key];
    return v && String(v).trim() ? String(v) : "(not provided)";
  });
}

const prepareSchema = z.object({
  workflowId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  inputs: z.record(z.unknown()).default({}),
});

workflowEngineRouter.post(
  "/prepare",
  validate(prepareSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const body = req.body as z.infer<typeof prepareSchema>;
      const workflow = await prisma.workflowDefinition.findUnique({
        where: { id: body.workflowId },
        include: {
          product: true,
          serviceResource: true,
        },
      });
      assertFound(workflow, "Workflow not found");
      await assertWorkflowAccess(req.user!.id, req.user!.role, workflow.productId);

      if (!workflow.isActive) {
        throw new AppError(400, "Workflow is inactive", "WORKFLOW_INACTIVE");
      }

      if (!workflow.serviceResourceId || !workflow.serviceResource) {
        throw new AppError(
          400,
          "Workflow has no valid service mapping (Product → Service → Workflow). Fix the catalog mapping — do not use Agency Building fallback.",
          "WORKFLOW_SERVICE_UNMAPPED"
        );
      }

      if (workflow.productId !== workflow.product.id) {
        throw new AppError(400, "Workflow product mapping invalid", "WORKFLOW_PRODUCT_INVALID");
      }

      const agencyConfig = await prisma.userProductConfig.findUnique({
        where: {
          userId_productId: {
            userId: req.user!.id,
            productId: workflow.productId,
          },
        },
      });

      let client = null as Awaited<ReturnType<typeof prisma.client.findUnique>> | null;
      let project = null as Awaited<ReturnType<typeof prisma.project.findUnique>> | null;

      if (body.projectId) {
        project = await prisma.project.findUnique({ where: { id: body.projectId } });
        assertFound(project, "Project not found");
        if (req.user!.role !== "ADMIN" && project.ownerId !== req.user!.id) {
          throw new AppError(403, "Forbidden", "FORBIDDEN");
        }
        client = await prisma.client.findUnique({ where: { id: project.clientId } });
      } else if (body.clientId) {
        client = await prisma.client.findUnique({ where: { id: body.clientId } });
        assertFound(client, "Client not found");
        if (req.user!.role !== "ADMIN" && client.ownerId !== req.user!.id) {
          throw new AppError(403, "Forbidden", "FORBIDDEN");
        }
      }

      const inputMap = body.inputs as Record<string, unknown>;
      const clientContextFromProfile = client
        ? [
            `Business: ${client.name}`,
            client.company ? `Company: ${client.company}` : null,
            client.businessType ? `Type: ${client.businessType}` : null,
            client.industry ? `Industry: ${client.industry}` : null,
            client.location ? `Location: ${client.location}` : null,
            client.serviceArea ? `Service area: ${client.serviceArea}` : null,
            client.website ? `Website: ${client.website}` : null,
            client.targetCustomers ? `Target customers: ${client.targetCustomers}` : null,
            client.currentProcess ? `Current process: ${client.currentProcess}` : null,
            client.existingTools ? `Tools: ${client.existingTools}` : null,
            client.marketingChannels ? `Channels: ${client.marketingChannels}` : null,
            client.mainProblems ? `Problems: ${client.mainProblems}` : null,
            client.goals ? `Goals: ${client.goals}` : null,
            client.notes ? `Notes: ${client.notes}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : "";

      const values: Record<string, string> = {
        agency_name:
          agencyConfig?.agencyName || workflow.product.name,
        target_niche: agencyConfig?.targetNiche || "",
        country: agencyConfig?.country || "",
        geographic_service_area: agencyConfig?.geographicServiceArea || "",
        ai_platform: agencyConfig?.aiPlatform || "Custom / Other",
        preferred_delivery_model: agencyConfig?.preferredDeliveryModel || "",
        client_context:
          String(inputMap.client_context ?? "") || clientContextFromProfile,
        service_focus:
          String(inputMap.service_focus ?? "") ||
          workflow.serviceResource?.title ||
          "",
        goals: String(inputMap.goals ?? ""),
        constraints: String(inputMap.constraints ?? ""),
        additional_notes: String(inputMap.additional_notes ?? ""),
        results_to_date: String(inputMap.results_to_date ?? ""),
        priority_opportunity: String(inputMap.priority_opportunity ?? ""),
        existing_tools: String(inputMap.existing_tools ?? ""),
        current_ai_usage: String(inputMap.current_ai_usage ?? ""),
        approved_system_summary: String(inputMap.approved_system_summary ?? ""),
        operator_roles: String(inputMap.operator_roles ?? ""),
        go_live_window: String(inputMap.go_live_window ?? ""),
        process_scope: String(inputMap.process_scope ?? ""),
        known_friction: String(inputMap.known_friction ?? ""),
        systems_of_record: String(inputMap.systems_of_record ?? ""),
        process_selected_for_design: String(inputMap.process_selected_for_design ?? ""),
        current_step_sequence: String(inputMap.current_step_sequence ?? ""),
        target_handoff_rules: String(inputMap.target_handoff_rules ?? ""),
        approved_process_design: String(inputMap.approved_process_design ?? ""),
        rollout_owners_by_step: String(inputMap.rollout_owners_by_step ?? ""),
        pilot_cutover_window: String(inputMap.pilot_cutover_window ?? ""),
        candidate_use_cases: String(inputMap.candidate_use_cases ?? ""),
        prioritization_criteria: String(inputMap.prioritization_criteria ?? ""),
        stakeholder_capacity: String(inputMap.stakeholder_capacity ?? ""),
        shortlisted_use_cases: String(inputMap.shortlisted_use_cases ?? ""),
        scoring_model: String(inputMap.scoring_model ?? ""),
        roadmap_horizon: String(inputMap.roadmap_horizon ?? ""),
        approved_roadmap_design: String(inputMap.approved_roadmap_design ?? ""),
        wave_owners: String(inputMap.wave_owners ?? ""),
        first_wave_window: String(inputMap.first_wave_window ?? ""),
        prompt_sop_scope: String(inputMap.prompt_sop_scope ?? ""),
        existing_prompts_sops: String(inputMap.existing_prompts_sops ?? ""),
        quality_risk_gaps: String(inputMap.quality_risk_gaps ?? ""),
        priority_prompt_workflows: String(inputMap.priority_prompt_workflows ?? ""),
        prompt_library_structure: String(inputMap.prompt_library_structure ?? ""),
        human_approval_gates: String(inputMap.human_approval_gates ?? ""),
        approved_prompt_system_design: String(inputMap.approved_prompt_system_design ?? ""),
        implementation_owners: String(inputMap.implementation_owners ?? ""),
        rollout_and_testing_window: String(inputMap.rollout_and_testing_window ?? ""),
      };

      // Allow any extra input keys to substitute in template
      for (const [k, v] of Object.entries(inputMap)) {
        if (typeof v === "string" || typeof v === "number") {
          values[k] = String(v);
        }
      }

      const line = (label: string, val: string | null | undefined, fallback: string) =>
        `${label}: ${val && String(val).trim() ? String(val).trim() : fallback}`;

      const agencyName =
        agencyConfig?.agencyName?.trim() || workflow.product.name || "this agency";
      const agencyBlock = [
        line("Operating market", agencyConfig?.country, "not specified"),
        line("Target niche", agencyConfig?.targetNiche, "local service businesses"),
        line("Service area", agencyConfig?.geographicServiceArea, "not specified"),
        line("Experience level", agencyConfig?.experienceLevel, "beginner"),
        line("Delivery model", agencyConfig?.preferredDeliveryModel, "audit plus implementation"),
        line("Weekly time available", agencyConfig?.weeklyTimeAvailability, "limited"),
        line(
          "Income or client target",
          agencyConfig?.monthlyIncomeOrClientTarget,
          "not specified"
        ),
        line("Preferred AI platform", agencyConfig?.aiPlatform, "not specified"),
      ].join("\n");

      const clientBlock = values.client_context?.trim()
        ? values.client_context.trim()
        : "No specific client yet - keep the output reusable for a typical business in the target niche.";

      const template =
        workflow.aiInstructionTemplate ||
        `Produce a professional deliverable for ${workflow.name}.\n\nPurpose: ${workflow.purpose}\n\nClient:\n{{client_context}}\n\nGoals:\n{{goals}}\n\nConstraints:\n{{constraints}}`;

      const taskBody = fillTemplate(template, values).trim();

      let instruction = [
        `ROLE\nYou are an experienced AI-enablement consultant working inside ${agencyName}. You produce practical, professional deliverables for small local businesses. You avoid hype, keep language plain, and flag anything that needs human verification before client use.`,
        `AGENCY CONTEXT\n${agencyBlock}`,
        `CLIENT CONTEXT\n${clientBlock}`,
        `TASK\n${taskBody}`,
        `OUTPUT FORMAT\nReturn only the deliverable. Do not add a preamble or closing note.`,
      ].join("\n\n");

      const review = workflow.reviewRequirements as { checklist?: string[] } | null;
      if (review?.checklist?.length) {
        instruction += `\n\nHUMAN REVIEW REQUIREMENTS (operator must confirm before client use)\n${review.checklist
          .map((c, i) => `${i + 1}. ${c}`)
          .join("\n")}`;
      }

      // Agency profile basics must be entered before the prompt is ready
      const agencyMissing: string[] = [];
      if (!(agencyConfig?.country || "").trim()) agencyMissing.push("Operating market / country");
      if (!(agencyConfig?.targetNiche || "").trim()) agencyMissing.push("Target niche");

      // Validate required inputs
      const fields = Array.isArray(workflow.inputs)
        ? (workflow.inputs as Array<{ key: string; required?: boolean; label?: string }>)
        : [];
      const missing = [
        ...agencyMissing,
        ...fields
          .filter((f) => f.required)
          .filter((f) => {
            if (f.key === "client_context" && values.client_context) return false;
            if (f.key === "service_focus" && values.service_focus) return false;
            const raw = inputMap[f.key];
            return raw == null || String(raw).trim() === "";
          })
          .map((f) => f.label || f.key),
      ];

      res.json(
        ok({
          instruction,
          missingRequired: missing,
          ready: missing.length === 0,
          context: {
            workflow: {
              id: workflow.id,
              key: workflow.key,
              name: workflow.name,
              purpose: workflow.purpose,
              nextAction: workflow.nextAction,
              outputDefinition: workflow.outputDefinition,
              reviewRequirements: workflow.reviewRequirements,
              steps: workflow.steps,
            },
            product: {
              id: workflow.product.id,
              name: workflow.product.name,
              slug: workflow.product.slug,
            },
            service: workflow.serviceResource
              ? {
                  id: workflow.serviceResource.id,
                  title: workflow.serviceResource.title,
                  slug: workflow.serviceResource.slug,
                }
              : null,
            agencyConfig,
            client,
            project,
            aiPlatform: agencyConfig?.aiPlatform || "Custom / Other",
            executionMode: "instruction_export",
            note: "No provider API call is made. Copy this instruction into your selected AI platform, then paste the output back for human review and save.",
          },
        })
      );
    } catch (err) {
      next(err);
    }
  }
);

const generateSchema = prepareSchema.extend({
  instruction: z.string().min(1).optional(),
});

/**
 * Optional connected AI generation. Manual / external path remains default.
 * Output is always draft — human review required before save.
 */
workflowEngineRouter.post(
  "/generate",
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_AI_MAX,
    name: "workflow-ai",
  }),
  validate(generateSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const body = req.body as z.infer<typeof generateSchema>;
      const provider = assertAiAvailable();

      // Reuse prepare logic by internal call pattern: load workflow + build instruction
      const prepareRes = await (async () => {
        const workflow = await prisma.workflowDefinition.findUnique({
          where: { id: body.workflowId },
          include: { product: true, serviceResource: true },
        });
        assertFound(workflow, "Workflow not found");
        await assertWorkflowAccess(req.user!.id, req.user!.role, workflow.productId);
        if (!workflow.isActive) {
          throw new AppError(400, "Workflow is inactive", "WORKFLOW_INACTIVE");
        }
        if (!workflow.serviceResourceId || !workflow.serviceResource) {
          throw new AppError(400, "Workflow has no valid service mapping", "WORKFLOW_SERVICE_UNMAPPED");
        }

        let instruction = body.instruction?.trim() || "";
        if (!instruction) {
          throw new AppError(
            400,
            "Prepare an instruction first (POST /prepare), then generate.",
            "INSTRUCTION_REQUIRED"
          );
        }

        const result = await provider.generate({
          system:
            "You are an agency operations assistant. Produce a useful draft deliverable from the instruction. Mark uncertainty. Do not invent client facts. Do not claim guaranteed results.",
          prompt: instruction.slice(0, env.AI_MAX_INPUT_CHARS),
        });

        return {
          workflow,
          output: result.text,
          model: result.model,
          provider: result.provider,
        };
      })();

      res.json(
        ok({
          output: prepareRes.output,
          model: prepareRes.model,
          provider: prepareRes.provider,
          reviewRequired: true,
          notice: "AI-generated output — review before use.",
          executionMode: "provider_generate",
        })
      );
    } catch (err) {
      next(err);
    }
  }
);

const saveResultSchema = z.object({
  workflowId: z.string().min(1),
  projectId: z.string().min(1),
  instruction: z.string().min(1),
  output: z.string().min(1),
  editedOutput: z.string().optional(),
  reviewStatus: z.enum(["APPROVED", "NEEDS_EDIT", "REJECTED"]).default("APPROVED"),
  reviewNotes: z.string().max(5000).optional(),
  title: z.string().max(300).optional(),
  inputs: z.record(z.unknown()).optional(),
  progressId: z.string().optional(),
});

workflowEngineRouter.post(
  "/save-result",
  validate(saveResultSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const body = req.body as z.infer<typeof saveResultSchema>;
      const workflow = await prisma.workflowDefinition.findUnique({
        where: { id: body.workflowId },
      });
      assertFound(workflow, "Workflow not found");
      await assertWorkflowAccess(req.user!.id, req.user!.role, workflow.productId);

      if (!workflow.serviceResourceId) {
        throw new AppError(
          400,
          "Workflow has no valid service mapping. Cannot save — fix Product → Service → Workflow.",
          "WORKFLOW_SERVICE_UNMAPPED"
        );
      }

      const project = await prisma.project.findUnique({ where: { id: body.projectId } });
      assertFound(project, "Project not found");
      if (req.user!.role !== "ADMIN" && project.ownerId !== req.user!.id) {
        throw new AppError(403, "Forbidden", "FORBIDDEN");
      }

      const finalOutput = body.editedOutput?.trim() || body.output;

      const result = await prisma.workflowResult.create({
        data: {
          projectId: body.projectId,
          ownerId: req.user!.id,
          workflowKey: workflow.key,
          title: body.title || `${workflow.name} — result`,
          content: {
            instruction: body.instruction,
            output: body.output,
            editedOutput: body.editedOutput ?? null,
            finalOutput,
            reviewStatus: body.reviewStatus,
            reviewNotes: body.reviewNotes ?? null,
            inputs: (body.inputs ?? {}) as object,
            workflowId: workflow.id,
            savedAt: new Date().toISOString(),
          },
          metadata: {
            productId: workflow.productId,
            serviceResourceId: workflow.serviceResourceId,
            reviewStatus: body.reviewStatus,
          },
        },
      });

      let progress = null;
      if (body.progressId) {
        progress = await prisma.workflowProgress.update({
          where: { id: body.progressId },
          data: {
            status: body.reviewStatus === "REJECTED" ? "FAILED" : "COMPLETED",
            progressPercent: 100,
            completedAt: new Date(),
            state: {
              resultId: result.id,
              reviewStatus: body.reviewStatus,
            },
          },
        });
      } else {
        progress = await prisma.workflowProgress.create({
          data: {
            projectId: body.projectId,
            workflowId: workflow.id,
            workflowKey: workflow.key,
            status: body.reviewStatus === "REJECTED" ? "FAILED" : "COMPLETED",
            progressPercent: 100,
            startedAt: new Date(),
            completedAt: new Date(),
            state: { resultId: result.id, reviewStatus: body.reviewStatus },
          },
        });
      }

      res.status(201).json(
        ok({
          result,
          progress,
          nextAction: workflow.nextAction,
        })
      );
    } catch (err) {
      next(err);
    }
  }
);
