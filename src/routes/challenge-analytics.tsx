import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  Trophy,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

export const Route = createFileRoute("/challenge-analytics")({
  component: ChallengeAnalyticsPage,
});

interface Attempt {
  id: string;
  score: number;
  total: number;
  time_spent_seconds: number;
  completed_at: string;
  challenge_date: string;
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

function ChallengeAnalyticsPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase
        .from("daily_challenge_attempts")
        .select("id, score, total, time_spent_seconds, completed_at, challenge_date")
        .eq("user_id", user!.id)
        .eq("completed", true)
        .order("challenge_date", { ascending: true });

      setAttempts((data || []) as Attempt[]);
      setLoading(false);
    }
    load();
  }, [user]);

  if (isLoading || loading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <BarChart3 className="h-6 w-6 animate-pulse" />
        </div>
      </AppLayout>
    );
  }

  const totalAttempts = attempts.length;
  const totalQuestions = attempts.reduce((s, a) => s + a.total, 0);
  const totalCorrect = attempts.reduce((s, a) => s + a.score, 0);
  const avgAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const avgTime = totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.time_spent_seconds, 0) / totalAttempts) : 0;

  const sortedDesc = [...attempts].sort((a, b) =>
    new Date(b.challenge_date).getTime() - new Date(a.challenge_date).getTime()
  );

  // Score trend (last 14)
  const trendData = sortedDesc
    .slice(0, 14)
    .reverse()
    .map((a) => ({
      date: new Date(a.challenge_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      accuracy: a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
      score: a.score,
      total: a.total,
    }));

  // Completion time trend
  const timeData = sortedDesc
    .slice(0, 14)
    .reverse()
    .map((a) => ({
      date: new Date(a.challenge_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      time: Math.round(a.time_spent_seconds / 60 * 10) / 10,
    }));

  // Weekly aggregate
  const weekMap = new Map<string, { correct: number; total: number; count: number; time: number }>();
  attempts.forEach((a) => {
    const d = new Date(a.challenge_date);
    const key = `${d.getFullYear()}-W${String(Math.ceil((d.getDate() + 6 - d.getDay()) / 7)).padStart(2, "0")}`;
    const cur = weekMap.get(key) || { correct: 0, total: 0, count: 0, time: 0 };
    cur.correct += a.score;
    cur.total += a.total;
    cur.count += 1;
    cur.time += a.time_spent_seconds;
    weekMap.set(key, cur);
  });
  const weeklyData = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, d]) => ({
      week,
      accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
      avgTime: d.count > 0 ? Math.round(d.time / d.count / 60 * 10) / 10 : 0,
    }));

  // Streak calc
  const dates = sortedDesc.map((a) => a.challenge_date);
  let streak = 0;
  let prev: Date | null = null;
  for (const dStr of dates) {
    const d = new Date(dStr);
    if (prev) {
      const diff = Math.round((prev.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) streak++;
      else break;
    } else {
      streak = 1;
    }
    prev = d;
  }

  // Best / worst
  const accuracies = attempts.map((a) => (a.total > 0 ? a.score / a.total : 0));
  const bestIdx = accuracies.length ? accuracies.indexOf(Math.max(...accuracies)) : -1;
  const worstIdx = accuracies.length ? accuracies.indexOf(Math.min(...accuracies)) : -1;

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Daily Challenge Analytics</h1>
          <p className="mt-1 text-muted-foreground">Track your daily challenge performance over time</p>
        </div>

        {totalAttempts === 0 ? (
          <div className="stat-card text-center py-16 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">No daily challenges completed yet</p>
            <p className="mt-2 text-sm">Complete your first daily challenge to see analytics here</p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              {[
                { label: "Challenges Completed", value: totalAttempts, icon: Calendar },
                { label: "Avg Accuracy", value: `${avgAccuracy}%`, icon: Target },
                { label: "Avg Time", value: formatSeconds(avgTime), icon: Clock },
                { label: "Current Streak", value: `${streak} day${streak === 1 ? "" : "s"}`, icon: Zap },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <s.icon className="h-4.5 w-4.5 text-accent mb-2" />
                  <p className="font-display text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2 mb-8">
              {/* Accuracy trend */}
              <div className="stat-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold">Accuracy Trend</h3>
                  {bestIdx >= 0 && (
                    <span className="text-xs text-success font-medium">
                      Best: {Math.round(accuracies[bestIdx] * 100)}%
                    </span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid oklch(0.92 0.01 250)", fontSize: 13 }}
                      formatter={(value: number) => [`${value}%`, "Accuracy"]}
                    />
                    <Area type="monotone" dataKey="accuracy" stroke="oklch(0.65 0.18 200)" fill="url(#accGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Completion time trend */}
              <div className="stat-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold">Time per Challenge</h3>
                  <span className="text-xs text-muted-foreground">minutes</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={timeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid oklch(0.92 0.01 250)", fontSize: 13 }}
                      formatter={(value: number) => [`${value} min`, "Time"]}
                    />
                    <Line type="monotone" dataKey="time" stroke="oklch(0.75 0.18 85)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Weekly accuracy bar chart */}
            {weeklyData.length > 1 && (
              <div className="stat-card mb-8">
                <h3 className="font-display font-semibold mb-4">Weekly Performance</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid oklch(0.92 0.01 250)", fontSize: 13 }}
                      formatter={(value: number, name: string) =>
                        name === "accuracy" ? [`${value}%`, "Accuracy"] : [`${value} min`, "Avg Time"]
                      }
                    />
                    <Bar dataKey="accuracy" fill="oklch(0.65 0.18 200)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="avgTime" fill="oklch(0.75 0.18 85)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Recent attempts table */}
            <div className="stat-card">
              <h3 className="font-display font-semibold mb-4">Recent Attempts</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Score</th>
                      <th className="pb-2 font-medium">Accuracy</th>
                      <th className="pb-2 font-medium">Time</th>
                      <th className="pb-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedDesc.slice(0, 10).map((a, idx) => {
                      const acc = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
                      const isBest = idx === 0 && bestIdx >= 0 && accuracies[bestIdx] === a.score / a.total;
                      const isWorst = idx === 0 && worstIdx >= 0 && accuracies[worstIdx] === a.score / a.total;
                      return (
                        <tr key={a.id}>
                          <td className="py-3">
                            {new Date(a.challenge_date).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="py-3 font-medium">
                            {a.score} / {a.total}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-accent"
                                  style={{ width: `${acc}%` }}
                                />
                              </div>
                              <span className="text-xs">{acc}%</span>
                            </div>
                          </td>
                          <td className="py-3 text-muted-foreground">{formatSeconds(a.time_spent_seconds)}</td>
                          <td className="py-3">
                            {acc === 100 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                                <Trophy className="h-3 w-3" /> Perfect
                              </span>
                            ) : acc >= 80 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                                <TrendingUp className="h-3 w-3" /> Good
                              </span>
                            ) : acc >= 50 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                                <TrendingUp className="h-3 w-3" /> Okay
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                                <TrendingDown className="h-3 w-3" /> Needs work
                              </span>
                            )}
                            {isBest && <span className="ml-2 text-[10px] text-accent font-semibold">BEST</span>}
                            {isWorst && <span className="ml-2 text-[10px] text-muted-foreground">WORST</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
