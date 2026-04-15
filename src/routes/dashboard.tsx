import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { BookOpen, Target, TrendingUp, Clock, ArrowRight, Flame } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

interface DashboardData {
  profile: { full_name: string; streak_days: number; total_questions_answered: number } | null;
  recentSessions: Array<{
    id: string;
    total_questions: number;
    correct_answers: number;
    completed_at: string | null;
    subjects: { name: string } | null;
  }>;
  subjectCount: number;
  todayQuestions: number;
}

function DashboardPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>({ profile: null, recentSessions: [], subjectCount: 0, todayQuestions: 0 });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [profileRes, sessionsRes, subjectsRes] = await Promise.all([
        supabase.from("profiles").select("full_name, streak_days, total_questions_answered").eq("user_id", user!.id).single(),
        supabase.from("practice_sessions").select("id, total_questions, correct_answers, completed_at, subjects(name)").eq("user_id", user!.id).order("started_at", { ascending: false }).limit(5),
        supabase.from("subjects").select("id", { count: "exact" }),
      ]);

      const today = new Date().toISOString().split("T")[0];
      const todayRes = await supabase
        .from("practice_answers")
        .select("id", { count: "exact" })
        .eq("user_id", user!.id)
        .gte("answered_at", today);

      setData({
        profile: profileRes.data,
        recentSessions: (sessionsRes.data || []) as DashboardData["recentSessions"],
        subjectCount: subjectsRes.count || 0,
        todayQuestions: todayRes.count || 0,
      });
    }
    load();
  }, [user]);

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const stats = [
    { label: "Questions Answered", value: data.profile?.total_questions_answered || 0, icon: Target, color: "text-accent" },
    { label: "Today's Progress", value: data.todayQuestions, icon: Clock, color: "text-chart-2" },
    { label: "Day Streak", value: data.profile?.streak_days || 0, icon: Flame, color: "text-chart-5" },
    { label: "Subjects", value: data.subjectCount, icon: BookOpen, color: "text-chart-4" },
  ];

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">
            Welcome back, {data.profile?.full_name || "Student"} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">Here's your study overview</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <span className="font-display text-2xl font-bold">{s.value}</span>
              </div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          <Link
            to="/practice"
            className="stat-card flex items-center gap-4 group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shrink-0">
              <Target className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold">Start Practice Session</h3>
              <p className="text-sm text-muted-foreground">Pick a subject and start answering questions</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
          </Link>
          <Link
            to="/subjects"
            className="stat-card flex items-center gap-4 group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-chart-3/10 shrink-0">
              <BookOpen className="h-6 w-6 text-chart-3" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold">Browse Subjects</h3>
              <p className="text-sm text-muted-foreground">Explore topics and question banks</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
          </Link>
        </div>

        {/* Recent Sessions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold">Recent Sessions</h2>
            <Link to="/analytics" className="text-sm text-accent hover:underline flex items-center gap-1">
              View all <TrendingUp className="h-3.5 w-3.5" />
            </Link>
          </div>
          {data.recentSessions.length === 0 ? (
            <div className="stat-card text-center py-10 text-muted-foreground">
              <p>No practice sessions yet. Start your first one!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentSessions.map((s) => (
                <div key={s.id} className="stat-card flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{s.subjects?.name || "Mixed"}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.completed_at ? new Date(s.completed_at).toLocaleDateString() : "In progress"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-semibold text-sm">
                      {s.correct_answers}/{s.total_questions}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.total_questions > 0 ? Math.round((s.correct_answers / s.total_questions) * 100) : 0}% correct
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
