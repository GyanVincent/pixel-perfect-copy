// Portable AI provider selector. Works with OpenAI, Google Gemini
// (via its OpenAI-compatible endpoint), or the Lovable AI Gateway.
//
// Pick a provider by setting ONE of these environment variables:
//   - OPENAI_API_KEY   -> OpenAI (https://api.openai.com)
//   - GEMINI_API_KEY   -> Google Gemini OpenAI-compat endpoint
//   - LOVABLE_API_KEY  -> Lovable AI Gateway (default while running on Lovable)
//
// Optional overrides:
//   - AI_TEXT_MODEL    -> override chat/MCQ model id
//   - AI_IMAGE_MODEL   -> override image model id
//   - AI_BASE_URL      -> override OpenAI-compatible base URL (advanced)

export type AIProvider = "openai" | "gemini" | "lovable";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  chatUrl: string;       // OpenAI-compatible /v1/chat/completions URL
  textModel: string;
  imageModel: string;
}

export class AIConfigError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function getAIConfig(): AIConfig {
  const openai = process.env.OPENAI_API_KEY;
  const gemini = process.env.GEMINI_API_KEY;
  const lovable = process.env.LOVABLE_API_KEY;
  const baseOverride = process.env.AI_BASE_URL;
  const textOverride = process.env.AI_TEXT_MODEL;
  const imageOverride = process.env.AI_IMAGE_MODEL;

  if (openai) {
    const base = baseOverride || "https://api.openai.com/v1";
    return {
      provider: "openai",
      apiKey: openai,
      chatUrl: `${base}/chat/completions`,
      textModel: textOverride || "gpt-4o-mini",
      imageModel: imageOverride || "gpt-image-1",
    };
  }
  if (gemini) {
    // Gemini exposes an OpenAI-compatible endpoint.
    const base = baseOverride || "https://generativelanguage.googleapis.com/v1beta/openai";
    return {
      provider: "gemini",
      apiKey: gemini,
      chatUrl: `${base}/chat/completions`,
      textModel: textOverride || "gemini-2.5-flash",
      imageModel: imageOverride || "gemini-2.5-flash-image",
    };
  }
  if (lovable) {
    const base = baseOverride || "https://ai.gateway.lovable.dev/v1";
    return {
      provider: "lovable",
      apiKey: lovable,
      chatUrl: `${base}/chat/completions`,
      textModel: textOverride || "google/gemini-3-flash-preview",
      imageModel: imageOverride || "google/gemini-2.5-flash-image",
    };
  }
  throw new AIConfigError(
    "No AI provider configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or LOVABLE_API_KEY in your environment.",
    500,
  );
}

export function aiErrorResponse(e: unknown): Response {
  if (e instanceof AIConfigError) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  console.error("AI error:", e);
  return new Response(
    JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  );
}
