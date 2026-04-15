import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Target, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

interface SessionData {
  id: string;
  total_questions: number;
  correct_answers: number;
  completed_at: string | null;
  subjects: { name: string } | null;
}

function AnalyticsPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase
        .from("practice_sessions")
        .select("id, total_questions, correct_answers, completed_at, subjects(name)")
        .eq("user_id", user!.id)
        .eq("completed", true)
        .order("completed_at", { ascending: false })
        .limit(20);

      const sessionsData = (data || []) as SessionData[];
      setSessions(sessionsData);

      const answered = sessionsData.reduce((sum, s) => sum + s.total_questions, 0);
      const correct = sessionsData.reduce((sum, s) => sum + s.correct_answers, 0);
      setTotalAnswered(answered);
      setTotalCorrect(correct);
    }
    load();
  }, [user]);

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  // Performance over time chart data
  const chartData = sessions
    .filter((s) => s.completed_at)
    .slice(0, 10)
    .reverse()
    .map((s, i) => ({
      session: `#${i + 1}`,
      score: s.total_questions > 0 ? Math.round((s.correct_answers / s.total_questions) * 100) : 0,
    }));

  // Subject breakdown
  const subjectMap = new Map<string, { correct: number; total: number }>();
  sessions.forEach((s) => {
    const name = s.subjects?.name || "Mixed";
    const existing = subjectMap.get(name) || { correct: 0, total: 0 };
    subjectMap.set(name, { correct: existing.correct + s.correct_answers, total: existing.total + s.total_questions });
  });
  const pieData = Array.from(subjectMap.entries()).map(([name, d]) => ({
    name,
    value: d.total,
    accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
  }));

  const COLORS = ["oklch(0.65 0.18 200)", "oklch(0.7 0.15 160)", "oklch(0.75 0.18 85)", "oklch(0.6 0.2 300)"];

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-muted-foreground">Track your performance and improvement</p>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          {[
            { label: "Total Sessions", value: sessions.length, icon: Calendar },
            { label: "Questions Answered", value: totalAnswered, icon: Target },
            { label: "Correct Answers", value: totalCorrect, icon: TrendingUp },
            { label: "Overall Accuracy", value: `${accuracy}%`, icon: BarChart3 },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <s.icon className="h-4.5 w-4.5 text-accent mb-2" />
              <p className="font-display text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {sessions.length === 0 ? (
          <div className="stat-card text-center py-12 text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Complete some practice sessions to see your analytics</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Performance Over Time */}
            <div className="stat-card">
              <h3 className="font-display font-semibold mb-4">Performance Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" />
                  <XAxis dataKey="session" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid oklch(0.92 0.01 250)", fontSize: 13 }}
                    formatter={(value: number) => [`${value}%`, "Score"]}
                  />
                  <Bar dataKey="score" fill="oklch(0.65 0.18 200)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Subject Breakdown */}
            <div className="stat-card">
              <h3 className="font-display font-semibold mb-4">Subject Breakdown</h3>
              {pieData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid oklch(0.92 0.01 250)", fontSize: 13 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2.5">
                    {pieData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-sm">
                        <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="ml-auto font-medium">{d.accuracy}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
