import { createFileRoute } from "@tanstack/react-router";
import { getAIConfig, AIConfigError } from "@/lib/ai-provider.server";

export const Route = createFileRoute("/api/ai-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt } = await request.json();
          if (!prompt || typeof prompt !== "string" || prompt.length > 1000) {
            return new Response(JSON.stringify({ error: "Invalid prompt" }), {
              status: 400, headers: { "Content-Type": "application/json" },
            });
          }

          let cfg;
          try {
            cfg = getAIConfig();
          } catch (e) {
            if (e instanceof AIConfigError) {
              return new Response(JSON.stringify({ error: e.message }), {
                status: e.status, headers: { "Content-Type": "application/json" },
              });
            }
            throw e;
          }

          const enhanced = `Educational diagram for a CS / engineering student. Clean, labeled, high-contrast, suitable for study notes. Topic: ${prompt}`;

          // ---- OpenAI: /v1/images/generations returns base64 ----
          if (cfg.provider === "openai") {
            const base = cfg.chatUrl.replace(/\/chat\/completions$/, "");
            const upstream = await fetch(`${base}/images/generations`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${cfg.apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: cfg.imageModel,
                prompt: enhanced,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json",
              }),
            });
            if (!upstream.ok) return upstreamError(upstream);
            const data = await upstream.json();
            const b64 = data.data?.[0]?.b64_json;
            const url = data.data?.[0]?.url;
            const imageUrl = b64 ? `data:image/png;base64,${b64}` : url;
            if (!imageUrl) {
              return new Response(JSON.stringify({ error: "No image returned" }), {
                status: 500, headers: { "Content-Type": "application/json" },
              });
            }
            return Response.json({ imageUrl });
          }

          // ---- Gemini / Lovable: chat endpoint with image modality ----
          const upstream = await fetch(cfg.chatUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cfg.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: cfg.imageModel,
              messages: [{ role: "user", content: enhanced }],
              modalities: ["image", "text"],
            }),
          });
          if (!upstream.ok) return upstreamError(upstream);
          const data = await upstream.json();
          const imageUrl =
            data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
          if (!imageUrl) {
            return new Response(JSON.stringify({ error: "No image returned" }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }
          return Response.json({ imageUrl });
        } catch (e) {
          console.error("ai-image error", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});

async function upstreamError(upstream: Response) {
  if (upstream.status === 429) {
    return new Response(JSON.stringify({ error: "Rate limit reached." }), {
      status: 429, headers: { "Content-Type": "application/json" },
    });
  }
  if (upstream.status === 402) {
    return new Response(JSON.stringify({ error: "AI credits depleted." }), {
      status: 402, headers: { "Content-Type": "application/json" },
    });
  }
  const t = await upstream.text();
  console.error("ai-image gateway error", upstream.status, t);
  return new Response(JSON.stringify({ error: "AI service error" }), {
    status: 500, headers: { "Content-Type": "application/json" },
  });
}
