import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Trophy, CheckCircle, XCircle, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/daily-challenge")({
  component: DailyChallengePage,
});

interface ChallengeQuestion {
  id: string;
  question_text: string;
  options: string[];
  topic?: string;
}
interface ChallengeData {
  id: string;
  date: string;
  difficulty: string;
  questions: ChallengeQuestion[];
}
interface ExistingAttempt {
  id: string;
  score: number;
  total: number;
  answers: Array<{ questionId: string; selected: number; correct: boolean; correctIndex?: number; explanation?: string }>;
  completed: boolean;
  completed_at: string | null;
}

async function authFetch(url: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function DailyChallengePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [existing, setExisting] = useState<ExistingAttempt | null>(null);

  const [state, setState] = useState<"intro" | "active" | "results">("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<{ questionId: string; selected: number }>>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [graded, setGraded] = useState<ExistingAttempt["answers"] | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/daily-challenge");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setChallenge(json.challenge);
      if (json.attempt?.completed) {
        setExisting(json.attempt);
        setGraded(json.attempt.answers);
        setState("results");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  const start = () => {
    setState("active");
    setCurrentIndex(0);
    setAnswers([]);
    setSelected(null);
    setStartedAt(Date.now());
  };

  const next = () => {
    if (!challenge || selected === null) return;
    const q = challenge.questions[currentIndex];
    const newAnswers = [...answers, { questionId: q.id, selected }];
    setAnswers(newAnswers);
    setSelected(null);
    if (currentIndex + 1 < challenge.questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      void submit(newAnswers);
    }
  };

  const submit = async (finalAnswers: Array<{ questionId: string; selected: number }>) => {
    if (!challenge) return;
    setSubmitting(true);
    try {
      const time = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
      const res = await authFetch("/api/daily-challenge", {
        method: "POST",
        body: JSON.stringify({ challengeId: challenge.id, answers: finalAnswers, timeSpentSeconds: time }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit");
      setGraded(json.graded);
      setExisting({
        id: json.attempt.id,
        score: json.score,
        total: json.total,
        answers: json.graded,
        completed: true,
        completed_at: json.attempt.completed_at,
      });
      setState("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || loading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl gradient-primary">
            <Calendar className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Daily Challenge</h1>
            <p className="text-sm text-muted-foreground">
              {challenge ? new Date(challenge.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Loading"}
              {challenge && ` · ${challenge.questions.length} questions · ${challenge.difficulty}`}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {state === "intro" && challenge && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 text-accent">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Today's set</span>
            </div>
            <h2 className="mt-2 font-display text-xl font-semibold">Ready to tackle today's questions?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Everyone gets the same {challenge.questions.length} questions today. You can attempt the challenge once — your result is tracked separately from your regular practice history.
            </p>
            <button
              onClick={start}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Start Challenge <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {state === "active" && challenge && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>Question {currentIndex + 1} of {challenge.questions.length}</span>
                {challenge.questions[currentIndex].topic && (
                  <span className="rounded-full bg-muted px-2 py-0.5">{challenge.questions[currentIndex].topic}</span>
                )}
              </div>
              <h3 className="font-display text-lg font-semibold leading-snug">
                {challenge.questions[currentIndex].question_text}
              </h3>
              <div className="mt-5 space-y-2">
                {challenge.questions[currentIndex].options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setSelected(i)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                      selected === i
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border bg-background hover:border-accent/50"
                    }`}
                  >
                    <span className="mr-2 font-semibold">{String.fromCharCode(65 + i)}.</span>{opt}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={next}
                  disabled={selected === null || submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : currentIndex + 1 === challenge.questions.length ? "Submit" : "Next"}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {state === "results" && challenge && existing && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
              <Trophy className="mx-auto h-10 w-10 text-accent" />
              <div className="mt-2 font-display text-3xl font-bold">
                {existing.score} / {existing.total}
              </div>
              <p className="text-sm text-muted-foreground">
                {existing.score === existing.total ? "Perfect score! Come back tomorrow for a new set." : "Nice work — come back tomorrow for a fresh challenge."}
              </p>
            </div>
            <div className="space-y-3">
              {challenge.questions.map((q, idx) => {
                const ans = (graded || existing.answers).find((a) => a.questionId === q.id);
                const correctIdx = ans?.correctIndex;
                return (
                  <div key={q.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="mb-2 flex items-start gap-2 text-sm">
                      {ans?.correct ? (
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      )}
                      <span className="font-medium">Q{idx + 1}. {q.question_text}</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm">
                      {q.options.map((opt, i) => {
                        const isUser = ans?.selected === i;
                        const isCorrect = correctIdx === i;
                        return (
                          <li
                            key={i}
                            className={`rounded-md px-2 py-1 ${
                              isCorrect
                                ? "bg-emerald-500/10 text-emerald-600"
                                : isUser
                                ? "bg-destructive/10 text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            <span className="mr-1 font-semibold">{String.fromCharCode(65 + i)}.</span>{opt}
                          </li>
                        );
                      })}
                    </ul>
                    {ans?.explanation && (
                      <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                        {ans.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
