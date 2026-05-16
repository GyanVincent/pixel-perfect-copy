import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAIConfig, AIConfigError } from "@/lib/ai-provider.server";

const SYSTEM = `You generate high-quality, original multiple-choice practice questions for university courses.
Each question must have exactly 4 distinct plausible options, exactly one correct answer (index 0-3),
a concise explanation that teaches the underlying concept, and be tagged with a sub-topic.
Vary wording, framing, scenarios, and numeric values heavily so questions feel fresh.`;

async function hashText(s: string): Promise<string> {
  const data = new TextEncoder().encode(s.toLowerCase().replace(/\s+/g, " ").trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getUser(request: Request) {
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

export const Route = createFileRoute("/api/ai-practice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const subjectId: string = body.subjectId;
          const count: number = Math.max(1, Math.min(20, Number(body.count) || 10));
          const difficulty: string = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
          if (!subjectId) {
            return new Response(JSON.stringify({ error: "subjectId required" }), { status: 400 });
          }

          const user = await getUser(request);
          if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
          }

          // Load subject + topics + previously seen question texts.
          const [{ data: subject }, { data: topics }, { data: seen }] = await Promise.all([
            supabaseAdmin.from("subjects").select("name, code, description").eq("id", subjectId).maybeSingle(),
            supabaseAdmin.from("topics").select("name").eq("subject_id", subjectId).order("order_index"),
            supabaseAdmin
              .from("user_question_history")
              .select("question_id, generated_questions(question_text)")
              .eq("user_id", user.id)
              .eq("subject_id", subjectId)
              .order("seen_at", { ascending: false })
              .limit(200),
          ]);

          if (!subject) {
            return new Response(JSON.stringify({ error: "Unknown subject" }), { status: 404 });
          }

          const seenTexts: string[] = (seen || [])
            .map((r: any) => r.generated_questions?.question_text)
            .filter(Boolean)
            .slice(0, 40);
          const topicList = (topics || []).map((t) => t.name);

          let aiConfig;
          try {
            aiConfig = getAIConfig();
          } catch (e) {
            if (e instanceof AIConfigError) {
              return new Response(JSON.stringify({ error: e.message }), { status: e.status });
            }
            throw e;
          }

          const userPrompt =
            `Subject: ${subject.code ? subject.code + " — " : ""}${subject.name}\n` +
            (subject.description ? `Course blurb: ${subject.description}\n` : "") +
            (topicList.length ? `Topics in scope:\n- ${topicList.join("\n- ")}\n` : "") +
            `\nGenerate ${count} ORIGINAL ${difficulty} multiple-choice questions. Spread them across different topics.\n` +
            `Randomize phrasing, scenarios, and numeric details — do not reuse stock textbook examples.\n` +
            (seenTexts.length
              ? `\nThe student has ALREADY seen these questions — do NOT repeat, paraphrase, or closely mirror any of them:\n- ${seenTexts.join("\n- ")}\n`
              : "");

          const upstream = await fetch(aiConfig.chatUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${aiConfig.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: aiConfig.textModel,
              messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: userPrompt },
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
                            topic: { type: "string" },
                            question: { type: "string" },
                            options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                            correct_index: { type: "integer", minimum: 0, maximum: 3 },
                            explanation: { type: "string" },
                          },
                          required: ["topic", "question", "options", "correct_index", "explanation"],
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
            const t = await upstream.text();
            console.error("ai-practice gateway error", upstream.status, t);
            if (upstream.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached." }), { status: 429 });
            if (upstream.status === 402) return new Response(JSON.stringify({ error: "AI credits depleted." }), { status: 402 });
            return new Response(JSON.stringify({ error: "AI service error" }), { status: 500 });
          }

          const data = await upstream.json();
          const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          if (!args) {
            return new Response(JSON.stringify({ error: "No questions returned" }), { status: 500 });
          }
          const parsed = JSON.parse(args);
          const rawQs: Array<{
            topic: string; question: string; options: string[]; correct_index: number; explanation: string;
          }> = parsed.questions || [];

          // Persist into pool (dedup by content_hash) and return rows with IDs.
          const seenHashSet = new Set<string>();
          const inserted: Array<{
            id: string; question_text: string; options: string[]; correct_answer: number;
            explanation: string; difficulty: string; topic: string;
          }> = [];

          for (const q of rawQs) {
            const hash = await hashText(q.question);
            if (seenHashSet.has(hash)) continue;
            seenHashSet.add(hash);

            // Upsert into pool.
            const { data: existing } = await supabaseAdmin
              .from("generated_questions")
              .select("id, question_text, options, correct_answer, explanation, difficulty, topic")
              .eq("subject_id", subjectId)
              .eq("content_hash", hash)
              .maybeSingle();

            let row = existing;
            if (!row) {
              const { data: created, error } = await supabaseAdmin
                .from("generated_questions")
                .insert({
                  subject_id: subjectId,
                  topic: q.topic,
                  difficulty,
                  question_text: q.question,
                  options: q.options,
                  correct_answer: q.correct_index,
                  explanation: q.explanation,
                  content_hash: hash,
                  created_by: user.id,
                })
                .select("id, question_text, options, correct_answer, explanation, difficulty, topic")
                .single();
              if (error) {
                console.error("insert generated_questions failed", error);
                continue;
              }
              row = created;
            }
            if (row) {
              inserted.push({
                id: row.id,
                question_text: row.question_text,
                options: row.options as string[],
                correct_answer: row.correct_answer,
                explanation: row.explanation || "",
                difficulty: row.difficulty,
                topic: row.topic || q.topic,
              });
            }
          }

          return Response.json({ questions: inserted });
        } catch (e) {
          console.error("ai-practice error", e);
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500 });
        }
      },
    },
  },
});
