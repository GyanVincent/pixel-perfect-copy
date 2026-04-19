import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, type FormEvent } from "react";
import { Users, Plus, KeyRound, ChevronRight, Hash } from "lucide-react";

export const Route = createFileRoute("/groups/")({
  component: GroupsPage,
});

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  subject_id: string | null;
  owner_id: string;
  member_count: number;
  subjects: { name: string; code: string } | null;
}

function GroupsPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  const loadGroups = async () => {
    if (!user) return;
    setLoading(true);
    // Get groups the user is a member of
    const { data: memberships } = await supabase
      .from("study_group_members")
      .select("group_id")
      .eq("user_id", user.id);

    const ids = (memberships || []).map((m) => m.group_id);
    if (ids.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("study_groups")
      .select("id, name, description, invite_code, subject_id, owner_id, subjects(name, code)")
      .in("id", ids)
      .order("created_at", { ascending: false });

    // Fetch member counts
    const withCounts = await Promise.all(
      (data || []).map(async (g) => {
        const { count } = await supabase
          .from("study_group_members")
          .select("id", { count: "exact", head: true })
          .eq("group_id", g.id);
        return { ...g, member_count: count || 0 } as GroupRow;
      })
    );
    setGroups(withCounts);
    setLoading(false);
  };

  useEffect(() => {
    if (user?.id) loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSubmitting(true);
    setError("");
    const { data, error: err } = await supabase
      .from("study_groups")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        owner_id: user.id,
        invite_code: "", // trigger replaces this
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (err || !data) {
      setError(err?.message || "Failed to create group");
      return;
    }
    setShowCreate(false);
    setName("");
    setDescription("");
    navigate({ to: "/groups/$groupId", params: { groupId: data.id } });
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !joinCode.trim()) return;
    setSubmitting(true);
    setError("");
    const code = joinCode.trim().toUpperCase();
    const { data: group, error: lookupErr } = await supabase
      .from("study_groups")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();

    if (lookupErr || !group) {
      setSubmitting(false);
      setError("Invalid invite code");
      return;
    }

    const { error: joinErr } = await supabase
      .from("study_group_members")
      .insert({ group_id: group.id, user_id: user.id, role: "member" });

    setSubmitting(false);
    if (joinErr && !joinErr.message.includes("duplicate")) {
      setError(joinErr.message);
      return;
    }
    setShowJoin(false);
    setJoinCode("");
    navigate({ to: "/groups/$groupId", params: { groupId: group.id } });
  };

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Study Groups</h1>
            <p className="mt-1 text-muted-foreground">Collaborate, chat, and practice with peers</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowJoin(true); setShowCreate(false); setError(""); }}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-all"
            >
              <KeyRound className="h-4 w-4" />
              Join with code
            </button>
            <button
              onClick={() => { setShowCreate(true); setShowJoin(false); setError(""); }}
              className="flex items-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-all"
            >
              <Plus className="h-4 w-4" />
              Create group
            </button>
          </div>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="stat-card mb-6 space-y-4">
            <h2 className="font-display text-lg font-semibold">New study group</h2>
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent"
                placeholder="e.g. DBMS Study Circle"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent resize-none"
                placeholder="What will you study together?"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-sm hover:bg-muted">Cancel</button>
              <button type="submit" disabled={submitting} className="rounded-xl gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {submitting ? "Creating..." : "Create group"}
              </button>
            </div>
          </form>
        )}

        {showJoin && (
          <form onSubmit={handleJoin} className="stat-card mb-6 space-y-4">
            <h2 className="font-display text-lg font-semibold">Join a group</h2>
            <div>
              <label className="block text-sm font-medium mb-1.5">Invite code</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                required
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-mono uppercase outline-none focus:border-accent"
                placeholder="e.g. ABC23XYZ"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowJoin(false)} className="rounded-xl px-4 py-2 text-sm hover:bg-muted">Cancel</button>
              <button type="submit" disabled={submitting} className="rounded-xl gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {submitting ? "Joining..." : "Join group"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="stat-card text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="mb-2">You're not in any study groups yet.</p>
            <p className="text-sm">Create one or join with an invite code to start collaborating.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((g) => (
              <Link
                key={g.id}
                to="/groups/$groupId"
                params={{ groupId: g.id }}
                className="stat-card group hover:border-accent/40 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Users className="h-5 w-5" />
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                    <Hash className="h-3 w-3" />
                    {g.invite_code}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold mb-1">{g.name}</h3>
                {g.subjects && (
                  <p className="text-xs text-muted-foreground mb-2">{g.subjects.code} · {g.subjects.name}</p>
                )}
                {g.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{g.description}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{g.member_count} {g.member_count === 1 ? "member" : "members"}</span>
                  <ChevronRight className="h-4 w-4 text-accent group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
