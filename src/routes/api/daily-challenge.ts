import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAIConfig, AIConfigError } from "@/lib/ai-provider.server";

const CHALLENGE_SIZE = 5;
const DIFFICULTY = "medium";

const SYSTEM = `You generate high-quality, original multiple-choice questions for a daily university study challenge.
Each question must have exactly 4 distinct plausible options, exactly one correct answer (index 0-3),
and a concise explanation that teaches the underlying concept.`;

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

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function generateChallenge(date: string) {
  // Pick a deterministic-ish subject for the day (rotates daily).
  const { data: subjects } = await supabaseAdmin.from("subjects").select("id, name, code, description");
  if (!subjects || subjects.length === 0) throw new Error("No subjects available");
  const dayIdx = Math.abs([...date].reduce((a, c) => a + c.charCodeAt(0), 0)) % subjects.length;
  const subject = subjects[dayIdx];

  const { data: topics } = await supabaseAdmin
    .from("topics").select("name").eq("subject_id", subject.id).order("order_index");
  const topicList = (topics || []).map((t) => t.name);

  const aiConfig = getAIConfig();
  const userPrompt =
    `Subject: ${subject.code ? subject.code + " — " : ""}${subject.name}\n` +
    (subject.description ? `Course blurb: ${subject.description}\n` : "") +
    (topicList.length ? `Topics in scope:\n- ${topicList.join("\n- ")}\n` : "") +
    `\nGenerate ${CHALLENGE_SIZE} ORIGINAL ${DIFFICULTY} multiple-choice questions for today's daily challenge (${date}).\n` +
    `Spread them across different topics. Randomize phrasing, scenarios, and numeric details.\n`;

  const upstream = await fetch(aiConfig.chatUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${aiConfig.apiKey}`, "Content-Type": "application/json" },
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
    console.error("daily-challenge ai error", upstream.status, t);
    throw new Error("AI service error");
  }
  const data = await upstream.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("No questions returned");
  const parsed = JSON.parse(args);
  const rawQs: Array<{
    topic: string; question: string; options: string[]; correct_index: number; explanation: string;
  }> = parsed.questions || [];

  const questionIds: string[] = [];
  for (const q of rawQs) {
    const hash = await hashText(q.question);
    const { data: existing } = await supabaseAdmin
      .from("generated_questions")
      .select("id")
      .eq("subject_id", subject.id)
      .eq("content_hash", hash)
      .maybeSingle();
    if (existing) { questionIds.push(existing.id); continue; }
    const { data: created, error } = await supabaseAdmin
      .from("generated_questions")
      .insert({
        subject_id: subject.id,
        topic: q.topic,
        difficulty: DIFFICULTY,
        question_text: q.question,
        options: q.options,
        correct_answer: q.correct_index,
        explanation: q.explanation,
        content_hash: hash,
      })
      .select("id")
      .single();
    if (!error && created) questionIds.push(created.id);
  }
  if (questionIds.length === 0) throw new Error("Failed to persist challenge questions");

  const { data: challenge, error: cErr } = await supabaseAdmin
    .from("daily_challenges")
    .insert({ challenge_date: date, question_ids: questionIds, difficulty: DIFFICULTY })
    .select("id, challenge_date, question_ids, difficulty")
    .single();
  if (cErr) throw cErr;
  return challenge;
}

async function loadQuestions(ids: string[]) {
  const { data } = await supabaseAdmin
    .from("generated_questions")
    .select("id, question_text, options, correct_answer, explanation, difficulty, topic, subject_id")
    .in("id", ids);
  // preserve order
  const byId = new Map((data || []).map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export const Route = createFileRoute("/api/daily-challenge")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getUser(request);
          if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

          const date = todayUTC();
          let { data: challenge } = await supabaseAdmin
            .from("daily_challenges")
            .select("id, challenge_date, question_ids, difficulty")
            .eq("challenge_date", date)
            .maybeSingle();

          if (!challenge) {
            try {
              challenge = await generateChallenge(date);
            } catch (e) {
              if (e instanceof AIConfigError) {
                return new Response(JSON.stringify({ error: e.message }), { status: e.status });
              }
              // Race: another request may have just created it.
              const { data: retry } = await supabaseAdmin
                .from("daily_challenges").select("id, challenge_date, question_ids, difficulty")
                .eq("challenge_date", date).maybeSingle();
              if (retry) challenge = retry; else throw e;
            }
          }

          const questions = await loadQuestions(challenge!.question_ids as string[]);

          const { data: attempt } = await supabaseAdmin
            .from("daily_challenge_attempts")
            .select("id, score, total, answers, completed, completed_at, time_spent_seconds")
            .eq("user_id", user.id)
            .eq("challenge_id", challenge!.id)
            .maybeSingle();

          return Response.json({
            challenge: {
              id: challenge!.id,
              date: challenge!.challenge_date,
              difficulty: challenge!.difficulty,
              questions: questions.map((q: any) => ({
                id: q.id,
                question_text: q.question_text,
                options: q.options,
                topic: q.topic,
                // correct_answer + explanation only returned after submit
              })),
            },
            attempt,
          });
        } catch (e) {
          console.error("daily-challenge GET error", e);
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await getUser(request);
          if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
          const body = await request.json();
          const challengeId: string = body.challengeId;
          const answers: Array<{ questionId: string; selected: number }> = body.answers || [];
          const timeSpent: number = Math.max(0, Number(body.timeSpentSeconds) || 0);
          if (!challengeId) return new Response(JSON.stringify({ error: "challengeId required" }), { status: 400 });

          const { data: challenge } = await supabaseAdmin
            .from("daily_challenges").select("id, challenge_date, question_ids")
            .eq("id", challengeId).maybeSingle();
          if (!challenge) return new Response(JSON.stringify({ error: "Challenge not found" }), { status: 404 });

          const questions = await loadQuestions(challenge.question_ids as string[]);
          const correctMap = new Map(questions.map((q: any) => [q.id, q.correct_answer]));
          const explMap = new Map(questions.map((q: any) => [q.id, q.explanation]));

          let score = 0;
          const graded = answers.map((a) => {
            const correctIndex = correctMap.get(a.questionId);
            const isCorrect = correctIndex === a.selected;
            if (isCorrect) score += 1;
            return { questionId: a.questionId, selected: a.selected, correct: isCorrect, correctIndex, explanation: explMap.get(a.questionId) };
          });

          const { data: saved, error } = await supabaseAdmin
            .from("daily_challenge_attempts")
            .upsert({
              user_id: user.id,
              challenge_id: challenge.id,
              challenge_date: challenge.challenge_date,
              score,
              total: questions.length,
              answers: graded,
              time_spent_seconds: timeSpent,
              completed: true,
              completed_at: new Date().toISOString(),
            }, { onConflict: "user_id,challenge_id" })
            .select("id, score, total, answers, completed_at")
            .single();
          if (error) throw error;

          return Response.json({ attempt: saved, graded, score, total: questions.length });
        } catch (e) {
          console.error("daily-challenge POST error", e);
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500 });
        }
      },
    },
  },
});
