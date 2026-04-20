import { createFileRoute } from "@tanstack/react-router";

const SYSTEM = `You generate high-quality multiple-choice practice questions for university CS / STEM courses.
Each question must have exactly 4 options, exactly one correct answer, and a concise explanation that teaches the underlying concept.`;

export const Route = createFileRoute("/api/ai-mcq")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { topic, count, difficulty } = await request.json();
          if (!topic || typeof topic !== "string" || topic.length > 500) {
            return new Response(JSON.stringify({ error: "Invalid topic" }), {
              status: 400, headers: { "Content-Type": "application/json" },
            });
          }
          const n = Math.max(1, Math.min(5, Number(count) || 3));
          const diff = ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium";

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
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: `Generate ${n} ${diff} multiple-choice questions about: ${topic}` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "return_questions",
                  description: "Return the generated questions",
                  parameters: {
                    type: "object",
                    properties: {
                      questions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            question: { type: "string" },
                            options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                            correct_index: { type: "integer", minimum: 0, maximum: 3 },
                            explanation: { type: "string" },
                          },
                          required: ["question", "options", "correct_index", "explanation"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["questions"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "return_questions" } },
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
            console.error("ai-mcq gateway error", upstream.status, t);
            return new Response(JSON.stringify({ error: "AI service error" }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }
          const data = await upstream.json();
          const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          if (!args) {
            return new Response(JSON.stringify({ error: "No questions returned" }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }
          const parsed = JSON.parse(args);
          return Response.json(parsed);
        } catch (e) {
          console.error("ai-mcq error", e);
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
