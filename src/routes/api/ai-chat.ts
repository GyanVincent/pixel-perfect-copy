import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAIConfig, AIConfigError } from "@/lib/ai-provider.server";

const BASE_SYSTEM_PROMPT = `You are SmartPrep AI Tutor — a warm, sharp, Socratic university tutor.

Pedagogy:
- Lead with intuition, then formalism. Use small concrete examples before notation.
- For multi-step problems, explicitly walk through the steps and explain *why* each step is taken, not just what.
- When the student is wrong, identify the misconception first, then correct it.
- Prefer asking one focused follow-up question over a wall of text when the student seems lost.

Formatting:
- Always use Markdown. Use headings (##, ###), bullet points, and numbered steps.
- Wrap code in fenced blocks with the correct language tag (\`\`\`python, \`\`\`ts, \`\`\`cpp, etc.).
- Use inline code for identifiers, keywords, and small expressions.
- For math, use plain text with backticks (e.g. \`O(n log n)\`); avoid LaTeX.
- Keep paragraphs short. Be thorough but never bloated.

Honesty:
- If you are not confident, say so and explain how to verify.
- Never invent citations, function names, or course material.`;

async function loadSubjectContext(subjectId: string | null | undefined): Promise<string> {
  if (!subjectId) return "";
  try {
    const { data: subject } = await supabaseAdmin
      .from("subjects")
      .select("name, code, description")
      .eq("id", subjectId)
      .maybeSingle();
    if (!subject) return "";
    const { data: topics } = await supabaseAdmin
      .from("topics")
      .select("name")
      .eq("subject_id", subjectId)
      .order("order_index");
    const topicList = (topics || []).map((t) => `- ${t.name}`).join("\n");
    return `\n\nThe student is currently studying **${subject.code} — ${subject.name}**.${
      subject.description ? `\nCourse blurb: ${subject.description}` : ""
    }${topicList ? `\nKnown topics in this course:\n${topicList}` : ""}\nWhen relevant, ground your answers in this course's scope and terminology.`;
  } catch (e) {
    console.error("[ai-chat] subject context error", e);
    return "";
  }
}

async function getUserFromRequest(request: Request) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/ai-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const messages: Array<{ role: "user" | "assistant"; content: string }> = body.messages || [];
          const subjectId: string | null = body.subjectId || null;
          const conversationId: string | null = body.conversationId || null;

          let aiConfig;
          try {
            aiConfig = getAIConfig();
          } catch (e) {
            if (e instanceof AIConfigError) {
              return new Response(JSON.stringify({ error: e.message }), {
                status: e.status, headers: { "Content-Type": "application/json" },
              });
            }
            throw e;
          }

          // Identify the user (for persistence). Validate the bearer token.
          const user = await getUserFromRequest(request);

          const subjectContext = await loadSubjectContext(subjectId);
          const systemPrompt = BASE_SYSTEM_PROMPT + subjectContext;

          // Persist the latest user message (if we have a conversation + auth).
          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          let convId = conversationId;
          if (user && lastUser) {
            if (!convId) {
              const title = lastUser.content.slice(0, 60);
              const { data: created } = await supabaseAdmin
                .from("tutor_conversations")
                .insert({ user_id: user.id, subject_id: subjectId, title })
                .select("id")
                .single();
              convId = created?.id || null;
            } else {
              await supabaseAdmin
                .from("tutor_conversations")
                .update({ subject_id: subjectId, updated_at: new Date().toISOString() })
                .eq("id", convId)
                .eq("user_id", user.id);
            }
            if (convId) {
              await supabaseAdmin.from("tutor_messages").insert({
                conversation_id: convId,
                user_id: user.id,
                role: "user",
                content: lastUser.content,
              });
            }
          }

          const upstream = await fetch(aiConfig.chatUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${aiConfig.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: aiConfig.textModel,
              messages: [{ role: "system", content: systemPrompt }, ...messages],
              stream: true,
            }),
          });

          if (!upstream.ok) {
            if (upstream.status === 429) {
              return new Response(JSON.stringify({ error: "Rate limit reached. Please wait a moment." }), {
                status: 429, headers: { "Content-Type": "application/json" },
              });
            }
            if (upstream.status === 402) {
              return new Response(JSON.stringify({ error: "AI credits depleted. Add funds in workspace settings." }), {
                status: 402, headers: { "Content-Type": "application/json" },
              });
            }
            const errText = await upstream.text();
            console.error("AI gateway error:", upstream.status, errText);
            return new Response(JSON.stringify({ error: "AI service error" }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }

          // Note: the assistant message is persisted by the client via
          // /api/ai-save-message after the stream finishes. Background tasks
          // are unreliable on edge runtimes (Cloudflare Workers) and were
          // dropping the assistant message especially on mobile/flaky connections.

          return new Response(upstream.body, {
            headers: {
              "Content-Type": "text/event-stream",
              "X-Conversation-Id": convId || "",
            },
          });
        } catch (e) {
          console.error("ai-chat error:", e);
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
