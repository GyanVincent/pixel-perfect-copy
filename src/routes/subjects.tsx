import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
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
  topics: Array<{ id: string; name: string }>;
}

function SubjectsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("subjects")
        .select("id, name, code, description, color, icon, topics(id, name)")
        .order("name");
      setSubjects((data || []) as Subject[]);
    }
    load();
  }, []);

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Subjects</h1>
          <p className="mt-1 text-muted-foreground">Browse your L200 second semester courses</p>
        </div>

        {subjects.length === 0 ? (
          <div className="stat-card text-center py-12 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No subjects available yet. They'll appear once seed data is loaded.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {subjects.map((subject) => {
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
                    search={{ subjectId: subject.id }}
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
