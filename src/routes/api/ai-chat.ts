import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are SmartPrep AI Tutor, a friendly and knowledgeable academic assistant for university students.
You help with all subjects but specialize in computer science topics: Data Structures & Algorithms, Computer Organization, Discrete Mathematics, and Entrepreneurship.

Guidelines:
- Explain concepts clearly with examples
- Use markdown formatting (headings, lists, code blocks)
- For code, use proper syntax highlighting blocks
- Break down complex topics step by step
- Encourage learning, don't just give answers — explain the "why"
- Be concise but thorough`;

export const Route = createFileRoute("/api/ai-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = await request.json();
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

          if (!LOVABLE_API_KEY) {
            return new Response(
              JSON.stringify({ error: "AI service not configured" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...messages,
              ],
              stream: true,
            }),
          });

          if (!response.ok) {
            if (response.status === 429) {
              return new Response(
                JSON.stringify({ error: "Rate limit reached. Please wait a moment." }),
                { status: 429, headers: { "Content-Type": "application/json" } },
              );
            }
            if (response.status === 402) {
              return new Response(
                JSON.stringify({ error: "AI credits depleted. Please add funds in workspace settings." }),
                { status: 402, headers: { "Content-Type": "application/json" } },
              );
            }
            const errText = await response.text();
            console.error("AI gateway error:", response.status, errText);
            return new Response(
              JSON.stringify({ error: "AI service error" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(response.body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        } catch (e) {
          console.error("ai-chat error:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
