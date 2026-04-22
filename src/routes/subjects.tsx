import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, Monitor, Film, Code, Briefcase } from "lucide-react";

export const Route = createFileRoute("/subjects")({
  component: SubjectsPage,
});

const iconMap: Record<string, typeof BookOpen> = {
  Monitor,
  Film,
  Code,
  Briefcase,
  BookOpen,
};

interface Subject {
  id: string;
  name: string;
  code: string;
  description: string | null;
  color: string;
  icon: string;
  level: string;
  semester: number;
  topics: Array<{ id: string; name: string }>;
}

type SemesterKey = `${string}-${number}`;

function SubjectsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeKey, setActiveKey] = useState<SemesterKey>("L200-2");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("subjects")
        .select("id, name, code, description, color, icon, level, semester, topics(id, name)")
        .order("level")
        .order("semester")
        .order("name");
      setSubjects((data || []) as Subject[]);
    }
    load();
  }, []);

  const semesterTabs = useMemo(() => {
    const groups = new Map<SemesterKey, { level: string; semester: number; count: number }>();
    for (const s of subjects) {
      const key = `${s.level}-${s.semester}` as SemesterKey;
      const existing = groups.get(key);
      if (existing) existing.count++;
      else groups.set(key, { level: s.level, semester: s.semester, count: 1 });
    }
    return Array.from(groups.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => (a.level === b.level ? a.semester - b.semester : a.level.localeCompare(b.level)));
  }, [subjects]);

  const filtered = useMemo(
    () => subjects.filter((s) => `${s.level}-${s.semester}` === activeKey),
    [subjects, activeKey]
  );

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold">Subjects</h1>
          <p className="mt-1 text-muted-foreground">Browse your courses by level and semester</p>
        </div>

        {semesterTabs.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {semesterTabs.map((tab) => {
              const isActive = tab.key === activeKey;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveKey(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {tab.level} · Semester {tab.semester}
                  <span className="ml-2 text-xs opacity-70">({tab.count})</span>
                </button>
              );
            })}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="stat-card text-center py-12 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No subjects available in this semester yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {filtered.map((subject) => {
              const Icon = iconMap[subject.icon] || BookOpen;
              return (
                <div key={subject.id} className="stat-card">
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${subject.color}20`, color: subject.color }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg font-semibold">{subject.name}</h3>
                      <p className="text-xs text-muted-foreground">{subject.code}</p>
                      {subject.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{subject.description}</p>
                      )}
                    </div>
                  </div>

                  {subject.topics.length > 0 && (
                    <div className="space-y-1 mb-4">
                      {subject.topics.slice(0, 4).map((topic) => (
                        <div key={topic.id} className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-accent/40" />
                          {topic.name}
                        </div>
                      ))}
                      {subject.topics.length > 4 && (
                        <p className="text-xs text-muted-foreground px-1">+{subject.topics.length - 4} more topics</p>
                      )}
                    </div>
                  )}

                  <Link
                    to="/practice"
                    search={{ subjectId: subject.id, groupId: undefined }}
                    className="flex items-center gap-2 text-sm font-medium text-accent hover:underline"
                  >
                    Practice this subject
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
