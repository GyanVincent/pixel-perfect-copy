import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

function getAuthedClient(request: Request) {
  return createServerClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          const cookie = request.headers.get("cookie") || "";
          return cookie.split(";").map((c) => {
            const [name, ...rest] = c.trim().split("=");
            return { name, value: rest.join("=") };
          }).filter((c) => c.name);
        },
        setAll() { /* no-op */ },
      },
      global: {
        headers: {
          Authorization: request.headers.get("Authorization") || "",
        },
      },
    },
  );
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

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(JSON.stringify({ error: "AI service not configured" }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }

          // Identify the user (for persistence). Use the user's JWT.
          const authClient = getAuthedClient(request);
          const { data: { user } } = await authClient.auth.getUser();

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

          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
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

          // Tee the upstream stream: forward to client, accumulate to persist final assistant content.
          const [forwardStream, captureStream] = upstream.body!.tee();

          // Background task: parse capture stream and persist final assistant message.
          (async () => {
            try {
              const reader = captureStream.getReader();
              const decoder = new TextDecoder();
              let textBuf = "";
              let assistant = "";
              let streamDone = false;
              while (!streamDone) {
                const { done, value } = await reader.read();
                if (done) break;
                textBuf += decoder.decode(value, { stream: true });
                let nl: number;
                while ((nl = textBuf.indexOf("\n")) !== -1) {
                  let line = textBuf.slice(0, nl);
                  textBuf = textBuf.slice(nl + 1);
                  if (line.endsWith("\r")) line = line.slice(0, -1);
                  if (!line.startsWith("data: ")) continue;
                  const json = line.slice(6).trim();
                  if (json === "[DONE]") { streamDone = true; break; }
                  try {
                    const parsed = JSON.parse(json);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) assistant += delta;
                  } catch {
                    textBuf = line + "\n" + textBuf;
                    break;
                  }
                }
              }
              if (user && convId && assistant.trim()) {
                await supabaseAdmin.from("tutor_messages").insert({
                  conversation_id: convId,
                  user_id: user.id,
                  role: "assistant",
                  content: assistant,
                });
                await supabaseAdmin
                  .from("tutor_conversations")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", convId)
                  .eq("user_id", user.id);
              }
            } catch (e) {
              console.error("[ai-chat] capture error", e);
            }
          })();

          return new Response(forwardStream, {
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
