import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { Play, CheckCircle, XCircle, ArrowRight, RotateCcw, Trophy, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/practice")({
  validateSearch: (search: Record<string, unknown>) => ({
    subjectId: (search.subjectId as string) || undefined,
    groupId: (search.groupId as string) || undefined,
  }),
  component: PracticePage,
});

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  difficulty: string;
  topic?: string;
}

type Difficulty = "easy" | "medium" | "hard";

interface Subject {
  id: string;
  name: string;
}

type PracticeState = "setup" | "active" | "review" | "results";

function PracticePage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const { subjectId, groupId } = Route.useSearch();

  const [state, setState] = useState<PracticeState>("setup");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState(subjectId || "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Array<{ questionId: string; selected: number; correct: boolean; note?: string }>>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    supabase.from("subjects").select("id, name").order("name").then(({ data }) => {
      setSubjects(data || []);
      if (subjectId && !selectedSubject) setSelectedSubject(subjectId);
    });
  }, [subjectId, selectedSubject]);

  // Auto-dismiss the "session started" banner after 4s
  useEffect(() => {
    if (!sessionStartedAt) return;
    const t = setTimeout(() => setSessionStartedAt(null), 4000);
    return () => clearTimeout(t);
  }, [sessionStartedAt]);

  const startSession = useCallback(async () => {
    if (!user || !selectedSubject) return;

    setQuestions([]);
    setAnswers([]);
    setSelectedAnswer(null);
    setCurrentIndex(0);
    setSessionId(null);
    setUserNotes({});
    setGenError(null);
    setGenerating(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const resp = await fetch("/api/ai-practice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ subjectId: selectedSubject, count: questionCount, difficulty }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setGenError(err.error || "Failed to generate questions");
        setGenerating(false);
        return;
      }
      const { questions: qs } = (await resp.json()) as { questions: Question[] };
      if (!qs || qs.length === 0) {
        setGenError("No questions generated. Please try again.");
        setGenerating(false);
        return;
      }
      setQuestions(qs);
      setSessionStartedAt(Date.now());

      const { data: session } = await supabase
        .from("practice_sessions")
        .insert({
          user_id: user.id,
          subject_id: selectedSubject,
          group_id: groupId || null,
          total_questions: qs.length,
        })
        .select("id")
        .single();

      if (session) setSessionId(session.id);
      setState("active");
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Failed to start session");
    } finally {
      setGenerating(false);
    }
  }, [user, selectedSubject, questionCount, difficulty, groupId]);

  const submitAnswer = useCallback(async () => {
    if (selectedAnswer === null || !user) return;
    const q = questions[currentIndex];
    const isCorrect = selectedAnswer === q.correct_answer;

    const note = userNotes[q.id]?.trim() || undefined;
    const newAnswer = { questionId: q.id, selected: selectedAnswer, correct: isCorrect, note };
    setAnswers((prev) => [...prev, newAnswer]);

    // Record into history so this question is never re-served to this user.
    await supabase.from("user_question_history").upsert(
      { user_id: user.id, question_id: q.id, subject_id: selectedSubject || null },
      { onConflict: "user_id,question_id" },
    );

    if (sessionId) {
      await supabase.from("practice_answers").insert({
        session_id: sessionId,
        question_id: q.id,
        user_id: user.id,
        selected_answer: selectedAnswer,
        is_correct: isCorrect,
      });
    }

    setState("review");
  }, [selectedAnswer, user, questions, currentIndex, sessionId, userNotes, selectedSubject]);

  const nextQuestion = useCallback(async () => {
    if (currentIndex + 1 >= questions.length) {
      const correctCount = answers.filter((a) => a.correct).length + (selectedAnswer === questions[currentIndex]?.correct_answer ? 0 : 0);
      const totalCorrect = answers.filter((a) => a.correct).length;

      if (sessionId && user) {
        await supabase
          .from("practice_sessions")
          .update({ correct_answers: totalCorrect, completed: true, completed_at: new Date().toISOString() })
          .eq("id", sessionId);

        await supabase
          .from("profiles")
          .update({ total_questions_answered: (await supabase.from("profiles").select("total_questions_answered").eq("user_id", user.id).single()).data?.total_questions_answered! + questions.length })
          .eq("user_id", user.id);
      }

      setState("results");
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setState("active");
    }
  }, [currentIndex, questions, answers, sessionId, user, selectedAnswer]);

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const currentQuestion = questions[currentIndex];
  const correctCount = answers.filter((a) => a.correct).length;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          {state === "setup" && (
            <motion.div key="setup" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <h1 className="font-display text-3xl font-bold mb-2">Practice Session</h1>
              <p className="text-muted-foreground mb-8">Choose a subject and start answering questions</p>

              <div className="stat-card space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent"
                  >
                    <option value="">Select a subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Number of Questions</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 20].map((n) => (
                      <button
                        key={n}
                        onClick={() => setQuestionCount(n)}
                        className={`rounded-xl px-2 py-2 text-sm font-medium transition-all ${
                          questionCount === n
                            ? "gradient-primary text-primary-foreground"
                            : "border border-border hover:bg-muted"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Difficulty</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`rounded-xl px-2 py-2 text-sm font-medium capitalize transition-all ${
                          difficulty === d
                            ? "gradient-primary text-primary-foreground"
                            : "border border-border hover:bg-muted"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {genError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
                    {genError}
                  </div>
                )}

                <button
                  onClick={startSession}
                  disabled={!selectedSubject || generating}
                  className="w-full flex items-center justify-center gap-2 rounded-xl gradient-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Generating fresh questions...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Start Practice
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {(state === "active" || state === "review") && currentQuestion && (
            <motion.div key={`q-${currentIndex}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {sessionStartedAt && Date.now() - sessionStartedAt < 4000 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-medium text-success"
                >
                  <Sparkles className="h-4 w-4" />
                  New practice session started — good luck!
                </motion.div>
              )}
              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <span>Question {currentIndex + 1} of {questions.length}</span>
                  <span className="capitalize text-xs bg-muted px-2.5 py-1 rounded-full">{currentQuestion.difficulty}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-primary rounded-full transition-all duration-500"
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="stat-card">
                <h2 className="font-display text-xl font-semibold mb-6 leading-relaxed">
                  {currentQuestion.question_text}
                </h2>

                <div className="space-y-3">
                  {(currentQuestion.options as string[]).map((option, i) => {
                    const isSelected = selectedAnswer === i;
                    const isCorrect = i === currentQuestion.correct_answer;
                    const showResult = state === "review";

                    let optionStyle = "border border-border hover:border-accent/50 hover:bg-accent/5";
                    if (showResult && isCorrect) optionStyle = "border-2 border-success bg-success/5";
                    else if (showResult && isSelected && !isCorrect) optionStyle = "border-2 border-destructive bg-destructive/5";
                    else if (isSelected) optionStyle = "border-2 border-accent bg-accent/5";

                    return (
                      <button
                        key={i}
                        onClick={() => state === "active" && setSelectedAnswer(i)}
                        disabled={state === "review"}
                        className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-left transition-all ${optionStyle}`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted font-medium text-xs">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1">{option}</span>
                        {showResult && isCorrect && <CheckCircle className="h-5 w-5 text-success shrink-0" />}
                        {showResult && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5">
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Your notes / written answer (optional)
                  </label>
                  <textarea
                    value={userNotes[currentQuestion.id] || ""}
                    onChange={(e) =>
                      setUserNotes((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))
                    }
                    disabled={state === "review"}
                    placeholder="Write your reasoning, working, or full-text answer here..."
                    rows={3}
                    className="w-full resize-y rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-70"
                  />
                </div>

                {state === "review" && currentQuestion.explanation && (
                  <div className="mt-5 rounded-xl bg-info/5 border border-info/20 px-4 py-3 text-sm text-foreground">
                    <strong className="text-info">Explanation:</strong> {currentQuestion.explanation}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  {state === "review" && (
                    <button
                      onClick={() => {
                        const opts = (currentQuestion.options as string[])
                          .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
                          .join("\n");
                        const correctLetter = String.fromCharCode(65 + currentQuestion.correct_answer);
                        const pickedLetter = selectedAnswer !== null ? String.fromCharCode(65 + selectedAnswer) : "—";
                        const prefill = `I'm practicing and got this question wrong. Please explain it clearly, point out where my reasoning likely went wrong, and walk through how to arrive at the correct answer.\n\nQuestion: ${currentQuestion.question_text}\n\nOptions:\n${opts}\n\nCorrect answer: ${correctLetter}\nMy answer: ${pickedLetter}`;
                        navigate({
                          to: "/tutor",
                          search: { prefill, subjectId: selectedSubject || undefined, conversationId: undefined },
                        });
                      }}
                      className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/10"
                    >
                      <Sparkles className="h-4 w-4" />
                      Explain with AI Tutor
                    </button>
                  )}
                  {state === "active" ? (
                    <button
                      onClick={submitAnswer}
                      disabled={selectedAnswer === null}
                      className="flex items-center gap-2 rounded-xl gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
                    >
                      Submit Answer
                    </button>
                  ) : (
                    <button
                      onClick={nextQuestion}
                      className="flex items-center gap-2 rounded-xl gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
                    >
                      {currentIndex + 1 >= questions.length ? "See Results" : "Next Question"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {state === "results" && (
            <motion.div key="results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <div className="stat-card py-12">
                <Trophy className="h-16 w-16 mx-auto mb-4 text-warning" />
                <h1 className="font-display text-3xl font-bold mb-2">Session Complete!</h1>
                <p className="text-muted-foreground mb-6">
                  You scored {correctCount} out of {questions.length} ({Math.round((correctCount / questions.length) * 100)}%)
                </p>

                <div className="flex items-center justify-center gap-8 mb-8">
                  <div className="text-center">
                    <p className="font-display text-2xl font-bold text-success">{correctCount}</p>
                    <p className="text-xs text-muted-foreground">Correct</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-2xl font-bold text-destructive">{questions.length - correctCount}</p>
                    <p className="text-xs text-muted-foreground">Incorrect</p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setAnswers([]);
                      setSessionId(null);
                      startSession();
                    }}
                    disabled={generating}
                    className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-all disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {generating ? "Generating..." : "Try Again (Fresh Questions)"}
                  </button>
                  <button
                    onClick={() => navigate({ to: "/dashboard" })}
                    className="flex items-center gap-2 rounded-xl gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
