import { env, aiEnabled } from "../../config/env";
import { AppError } from "../../utils/errors";

export type AiGenerateInput = {
  system?: string;
  prompt: string;
  maxTokens?: number;
};

export type AiGenerateResult = {
  text: string;
  model: string;
  provider: string;
  usage?: { promptTokens?: number; completionTokens?: number };
};

export interface AiProvider {
  readonly name: string;
  generate(input: AiGenerateInput): Promise<AiGenerateResult>;
}

class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai";

  async generate(input: AiGenerateInput): Promise<AiGenerateResult> {
    if (!env.AI_API_KEY) {
      throw new AppError(503, "AI provider is not configured", "AI_NOT_CONFIGURED");
    }
    const prompt = input.prompt.slice(0, env.AI_MAX_INPUT_CHARS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
    try {
      const res = await fetch(`${env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: env.AI_MODEL,
          max_tokens: input.maxTokens ?? env.AI_MAX_OUTPUT_TOKENS,
          messages: [
            ...(input.system ? [{ role: "system", content: input.system }] : []),
            { role: "user", content: prompt },
          ],
        }),
      });

      if (res.status === 401 || res.status === 403) {
        throw new AppError(502, "AI provider rejected the API key", "AI_AUTH_FAILED");
      }
      if (res.status === 429) {
        throw new AppError(429, "AI provider rate limit reached", "AI_RATE_LIMIT");
      }
      if (!res.ok) {
        throw new AppError(502, "AI provider request failed", "AI_PROVIDER_ERROR");
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = json.choices?.[0]?.message?.content?.trim() || "";
      if (!text) {
        throw new AppError(502, "AI provider returned an empty response", "AI_EMPTY_RESPONSE");
      }
      return {
        text,
        model: json.model || env.AI_MODEL,
        provider: this.name,
        usage: {
          promptTokens: json.usage?.prompt_tokens,
          completionTokens: json.usage?.completion_tokens,
        },
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      if ((err as { name?: string })?.name === "AbortError") {
        throw new AppError(504, "AI provider timed out", "AI_TIMEOUT");
      }
      throw new AppError(502, "AI provider unavailable", "AI_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }
  }
}

export function getAiProvider(): AiProvider | null {
  if (!aiEnabled()) return null;
  if (env.AI_PROVIDER === "openai") return new OpenAiCompatibleProvider();
  return null;
}

export function assertAiAvailable(): AiProvider {
  const p = getAiProvider();
  if (!p) {
    throw new AppError(
      503,
      "AI provider is not configured. Use manual mode or set AI_PROVIDER and AI_API_KEY.",
      "AI_NOT_CONFIGURED"
    );
  }
  return p;
}
