import { createFileRoute } from "@tanstack/react-router";

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
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(JSON.stringify({ error: "AI service not configured" }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }
          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [
                {
                  role: "user",
                  content: `Educational diagram for a CS / engineering student. Clean, labeled, high-contrast, suitable for study notes. Topic: ${prompt}`,
                },
              ],
              modalities: ["image", "text"],
            }),
          });
          if (!upstream.ok) {
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
          const data = await upstream.json();
          const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
          if (!imageUrl) {
            return new Response(JSON.stringify({ error: "No image returned" }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }
          return Response.json({ imageUrl });
        } catch (e) {
          console.error("ai-image error", e);
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
