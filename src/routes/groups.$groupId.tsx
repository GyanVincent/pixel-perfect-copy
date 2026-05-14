import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Users, MessageSquare, BookMarked, Trophy, Send, Hash, Copy, Check, ArrowLeft, ExternalLink, Trash2, Play, Plus, Search, Paperclip, FileText, FileImage, FileAudio, FileVideo, File as FileIcon, Download, Loader2 } from "lucide-react";
import { markGroupRead } from "@/hooks/use-unread-groups";

export const Route = createFileRoute("/groups/$groupId")({
  component: GroupDetailPage,
});

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  owner_id: string;
  subject_id: string | null;
  subjects: { id: string; name: string; code: string } | null;
}

interface Profile {
  name: string;
  avatar: string | null;
}

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name?: string;
  author_avatar?: string | null;
}

interface Member {
  user_id: string;
  role: string;
  joined_at: string;
  full_name?: string;
  avatar_url?: string | null;
}

interface Resource {
  id: string;
  user_id: string;
  title: string;
  url: string | null;
  notes: string | null;
  created_at: string;
  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  author_name?: string;
}

interface LeaderRow {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_questions: number;
  correct: number;
  accuracy: number;
}

type Tab = "chat" | "resources" | "leaderboard" | "members";

function GroupDetailPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const { groupId } = Route.useParams();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("chat");
  const [newMessage, setNewMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [resNotes, setResNotes] = useState("");
  const [resFile, setResFile] = useState<File | null>(null);
  const [uploadingRes, setUploadingRes] = useState(false);
  const [showResForm, setShowResForm] = useState(false);
  const [resSearch, setResSearch] = useState("");
  const resFileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  // Load group data
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data: g, error: gErr } = await supabase
          .from("study_groups")
          .select("id, name, description, invite_code, owner_id, subject_id, subjects(id, name, code)")
          .eq("id", groupId)
          .maybeSingle();

        if (cancelled) return;
        if (gErr) console.error("[group] load group error", gErr);
        if (!g) {
          setGroup(null);
          setLoading(false);
          return;
        }
        setGroup(g as GroupInfo);

        const [mems, msgs, res] = await Promise.all([
          supabase.from("study_group_members").select("user_id, role, joined_at").eq("group_id", groupId),
          supabase.from("study_group_messages").select("id, user_id, content, created_at").eq("group_id", groupId).order("created_at", { ascending: true }).limit(200),
          supabase.from("study_group_resources").select("id, user_id, title, url, notes, created_at, file_path, file_name, file_type, file_size").eq("group_id", groupId).order("created_at", { ascending: false }),
        ]);

        if (cancelled) return;
        if (mems.error) console.error("[group] members error", mems.error);
        if (msgs.error) console.error("[group] messages error", msgs.error);
        if (res.error) console.error("[group] resources error", res.error);

        const userIds = Array.from(new Set([
          ...(mems.data || []).map((m) => m.user_id),
          ...(msgs.data || []).map((m) => m.user_id),
          ...(res.data || []).map((r) => r.user_id),
        ]));

        const profileMap = new Map<string, Profile>();
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url")
            .in("user_id", userIds);
          (profs || []).forEach((p) =>
            profileMap.set(p.user_id, {
              name: (p.full_name && p.full_name.trim()) || "Member",
              avatar: p.avatar_url || null,
            })
          );
        }
        const nameOf = (uid: string) => profileMap.get(uid)?.name || "Member";
        const avatarOf = (uid: string) => profileMap.get(uid)?.avatar || null;

        if (cancelled) return;
        setMembers((mems.data || []).map((m) => ({ ...m, full_name: nameOf(m.user_id), avatar_url: avatarOf(m.user_id) })));
        setMessages((msgs.data || []).map((m) => ({ ...m, author_name: nameOf(m.user_id), author_avatar: avatarOf(m.user_id) })));
        setResources((res.data || []).map((r) => ({ ...r, author_name: nameOf(r.user_id) })));
      } catch (err) {
        console.error("[group] unexpected load error", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [groupId, user?.id]);

  // Realtime subscriptions
  useEffect(() => {
    if (!groupId || !user) return;
    const channel = supabase
      .channel(`group-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "study_group_messages", filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const m = payload.new as Message;
          const { data: prof } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", m.user_id).maybeSingle();
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, { ...m, author_name: prof?.full_name || "Member", author_avatar: prof?.avatar_url || null }]);
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "study_group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => setMessages((prev) => prev.filter((m) => m.id !== (payload.old as { id: string }).id)))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "study_group_resources", filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const r = payload.new as Resource;
          const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", r.user_id).maybeSingle();
          setResources((prev) => prev.some((x) => x.id === r.id) ? prev : [{ ...r, author_name: prof?.full_name || "Member" }, ...prev]);
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "study_group_resources", filter: `group_id=eq.${groupId}` },
        (payload) => setResources((prev) => prev.filter((r) => r.id !== (payload.old as { id: string }).id)))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "study_group_members", filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const m = payload.new as Member;
          const { data: prof } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", m.user_id).maybeSingle();
          setMembers((prev) => prev.some((x) => x.user_id === m.user_id) ? prev : [...prev, { ...m, full_name: prof?.full_name || "Member", avatar_url: prof?.avatar_url || null }]);
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, user?.id]);

  // Leaderboard
  useEffect(() => {
    if (tab !== "leaderboard" || members.length === 0) return;
    const load = async () => {
      const userIds = members.map((m) => m.user_id);
      const { data: sessions } = await supabase
        .from("practice_sessions")
        .select("user_id, total_questions, correct_answers, completed")
        .in("user_id", userIds)
        .eq("completed", true);

      const stats = new Map<string, { total: number; correct: number }>();
      (sessions || []).forEach((s) => {
        const cur = stats.get(s.user_id) || { total: 0, correct: 0 };
        cur.total += s.total_questions;
        cur.correct += s.correct_answers;
        stats.set(s.user_id, cur);
      });

      const rows: LeaderRow[] = members.map((m) => {
        const s = stats.get(m.user_id) || { total: 0, correct: 0 };
        return {
          user_id: m.user_id,
          full_name: m.full_name || "Member",
          avatar_url: m.avatar_url || null,
          total_questions: s.total,
          correct: s.correct,
          accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
        };
      }).sort((a, b) => b.correct - a.correct || b.accuracy - a.accuracy);
      setLeaderboard(rows);
    };
    load();
  }, [tab, members]);

  // Auto-scroll chat + mark as read
  useEffect(() => {
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      markGroupRead(groupId);
    }
  }, [messages, tab, groupId]);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;
    const content = newMessage.trim();
    setNewMessage("");
    await supabase.from("study_group_messages").insert({
      group_id: groupId,
      user_id: user.id,
      content,
    });
  };

  const deleteMessage = async (id: string) => {
    await supabase.from("study_group_messages").delete().eq("id", id);
  };

  const addResource = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !resTitle.trim()) return;
    setUploadingRes(true);
    try {
      let file_path: string | null = null;
      let file_name: string | null = null;
      let file_type: string | null = null;
      let file_size: number | null = null;
      if (resFile) {
        if (resFile.size > 50 * 1024 * 1024) {
          alert("File must be under 50MB");
          setUploadingRes(false);
          return;
        }
        const safe = resFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${groupId}/${user.id}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("group-files")
          .upload(path, resFile, { cacheControl: "3600", upsert: false });
        if (upErr) {
          console.error("[group] file upload error", upErr);
          alert("Could not upload file.");
          setUploadingRes(false);
          return;
        }
        file_path = path;
        file_name = resFile.name;
        file_type = resFile.type || null;
        file_size = resFile.size;
      }
      await supabase.from("study_group_resources").insert({
        group_id: groupId,
        user_id: user.id,
        title: resTitle.trim(),
        url: resUrl.trim() || null,
        notes: resNotes.trim() || null,
        file_path,
        file_name,
        file_type,
        file_size,
      });
      setResTitle("");
      setResUrl("");
      setResNotes("");
      setResFile(null);
      if (resFileRef.current) resFileRef.current.value = "";
      setShowResForm(false);
    } finally {
      setUploadingRes(false);
    }
  };

  const deleteResource = async (r: Resource) => {
    if (r.file_path) {
      await supabase.storage.from("group-files").remove([r.file_path]);
    }
    await supabase.from("study_group_resources").delete().eq("id", r.id);
  };

  const downloadFile = async (r: Resource) => {
    if (!r.file_path) return;
    const { data, error } = await supabase.storage
      .from("group-files")
      .createSignedUrl(r.file_path, 60, { download: r.file_name || true });
    if (error || !data?.signedUrl) {
      console.error("[group] signed url error", error);
      alert("Could not download file.");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.rel = "noopener noreferrer";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const fileKindIcon = (type: string | null | undefined) => {
    const t = (type || "").toLowerCase();
    if (t.startsWith("image/")) return FileImage;
    if (t.startsWith("audio/")) return FileAudio;
    if (t.startsWith("video/")) return FileVideo;
    if (t.includes("pdf") || t.includes("word") || t.includes("text") || t.includes("sheet") || t.includes("presentation")) return FileText;
    return FileIcon;
  };

  const formatBytes = (n: number | null | undefined) => {
    if (!n) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  const removeMember = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from this group?`)) return;
    const { error } = await supabase
      .from("study_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", memberId);
    if (error) {
      console.error("[group] remove member error", error);
      alert("Could not remove member.");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.user_id !== memberId));
  };

  const transferOwnership = async (newOwnerId: string, name: string) => {
    if (!group || !user || newOwnerId === user.id) return;
    if (!confirm(`Transfer ownership to ${name}? You will become a regular member.`)) return;

    const { error: pErr } = await supabase
      .from("study_group_members")
      .update({ role: "owner" })
      .eq("group_id", groupId)
      .eq("user_id", newOwnerId);
    if (pErr) {
      console.error("[group] promote role error", pErr);
      alert("Could not transfer ownership.");
      return;
    }

    const { error: dErr } = await supabase
      .from("study_group_members")
      .update({ role: "member" })
      .eq("group_id", groupId)
      .eq("user_id", user.id);
    if (dErr) {
      console.error("[group] demote role error", dErr);
      await supabase
        .from("study_group_members")
        .update({ role: "member" })
        .eq("group_id", groupId)
        .eq("user_id", newOwnerId);
      alert("Could not transfer ownership.");
      return;
    }

    const { error: gErr } = await supabase
      .from("study_groups")
      .update({ owner_id: newOwnerId })
      .eq("id", groupId)
      .eq("owner_id", user.id);
    if (gErr) {
      console.error("[group] transfer owner_id error", gErr);
      await supabase
        .from("study_group_members")
        .update({ role: "member" })
        .eq("group_id", groupId)
        .eq("user_id", newOwnerId);
      await supabase
        .from("study_group_members")
        .update({ role: "owner" })
        .eq("group_id", groupId)
        .eq("user_id", user.id);
      alert("Could not transfer ownership.");
      return;
    }

    setGroup({ ...group, owner_id: newOwnerId });
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === newOwnerId
          ? { ...m, role: "owner" }
          : m.user_id === user.id
            ? { ...m, role: "member" }
            : m
      )
    );
  };

  const copyInviteCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startGroupPractice = () => {
    if (!group?.subject_id) return;
    navigate({ to: "/practice", search: { subjectId: group.subject_id, groupId } });
  };

  if (isLoading || !isAuthenticated || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading group...</div>
      </AppLayout>
    );
  }

  if (!group) {
    return (
      <AppLayout>
        <div className="max-w-3xl text-center py-12">
          <p className="text-muted-foreground mb-4">Group not found or you don't have access.</p>
          <Link to="/groups" className="text-accent hover:underline">Back to groups</Link>
        </div>
      </AppLayout>
    );
  }

  const isOwner = user?.id === group.owner_id;
  const isMember = members.some((m) => m.user_id === user?.id);

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <Link to="/groups" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          All groups
        </Link>

        <div className="stat-card mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-display text-2xl font-bold">{group.name}</h1>
                {isOwner && <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">Owner</span>}
              </div>
              {group.subjects && (
                <p className="text-sm text-muted-foreground">{group.subjects.code} · {group.subjects.name}</p>
              )}
              {group.description && <p className="text-sm text-muted-foreground mt-2">{group.description}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={copyInviteCode}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-mono hover:bg-muted transition-all"
              >
                <Hash className="h-4 w-4 text-accent" />
                {group.invite_code}
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
              {group.subject_id && isMember && (
                <button
                  onClick={startGroupPractice}
                  className="flex items-center gap-2 rounded-xl gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-all"
                >
                  <Play className="h-4 w-4" />
                  Group practice
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
          {([
            { key: "chat", label: "Chat", icon: MessageSquare },
            { key: "resources", label: "Resources", icon: BookMarked },
            { key: "leaderboard", label: "Leaderboard", icon: Trophy },
            { key: "members", label: `Members (${members.length})`, icon: Users },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex shrink-0 items-center gap-2 px-3 md:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === key ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === "chat" && (
          <div className="stat-card flex flex-col h-[calc(100vh-22rem)] min-h-[360px] md:h-[60vh] md:min-h-[400px] p-3 md:p-5 overflow-hidden">
            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-1 min-w-0 min-h-0">
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No messages yet. Say hi 👋</p>
              ) : (
                messages.map((m) => {
                  const isMe = m.user_id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex w-full min-w-0 gap-2 md:gap-3 ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      {!isMe && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-semibold overflow-hidden">
                          {m.author_avatar ? (
                            <img src={m.author_avatar} alt={m.author_name || "Member"} className="h-full w-full object-cover" />
                          ) : (
                            (m.author_name || "M").charAt(0).toUpperCase()
                          )}
                        </div>
                      )}
                      <div className={`max-w-[75%] min-w-0 flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        <div className="flex items-center gap-2 mb-0.5 text-xs text-muted-foreground min-w-0">
                          <span className="truncate max-w-[120px]">{isMe ? "You" : m.author_name}</span>
                          <span>·</span>
                          <span className="shrink-0">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className={`group rounded-2xl px-3 py-2 md:px-4 text-sm max-w-full min-w-0 ${isMe ? "gradient-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.content}</p>
                        </div>
                        {(isMe || isOwner) && (
                          <button onClick={() => deleteMessage(m.id)} className="text-xs text-muted-foreground hover:text-destructive mt-0.5">
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="mt-3 md:mt-4 flex gap-2">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                maxLength={4000}
                className="flex-1 min-w-0 rounded-xl border border-input bg-background px-3 md:px-4 py-2.5 text-base md:text-sm outline-none focus:border-accent"
              />
              <button type="submit" disabled={!newMessage.trim()} aria-label="Send message" className="shrink-0 rounded-xl gradient-primary px-4 py-2.5 text-primary-foreground disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {tab === "resources" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowResForm(!showResForm)}
                className="flex items-center gap-2 rounded-xl gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Add resource
              </button>
            </div>

            {showResForm && (
              <form onSubmit={addResource} className="stat-card space-y-3">
                <input
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  placeholder="Title"
                  required
                  maxLength={200}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent"
                />
                <input
                  value={resUrl}
                  onChange={(e) => setResUrl(e.target.value)}
                  placeholder="URL (optional)"
                  maxLength={2000}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent"
                />
                <textarea
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  maxLength={4000}
                  rows={3}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowResForm(false)} className="rounded-xl px-4 py-2 text-sm hover:bg-muted">Cancel</button>
                  <button type="submit" className="rounded-xl gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
                </div>
              </form>
            )}

            {resources.length === 0 ? (
              <div className="stat-card text-center py-12 text-muted-foreground">
                <BookMarked className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No resources shared yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {resources.map((r) => (
                  <div key={r.id} className="stat-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold mb-1">{r.title}</h3>
                        <p className="text-xs text-muted-foreground mb-2">
                          Shared by {r.user_id === user?.id ? "you" : r.author_name} · {new Date(r.created_at).toLocaleDateString()}
                        </p>
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline mb-2">
                            <ExternalLink className="h-3.5 w-3.5" />
                            {r.url}
                          </a>
                        )}
                        {r.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.notes}</p>}
                      </div>
                      {(r.user_id === user?.id || isOwner) && (
                        <button onClick={() => deleteResource(r.id)} className="text-muted-foreground hover:text-destructive p-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "leaderboard" && (
          <div className="stat-card">
            {leaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No practice sessions yet.</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((row, idx) => {
                  const isMe = row.user_id === user?.id;
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                  return (
                    <div key={row.user_id} className={`flex items-center gap-4 rounded-xl px-4 py-3 ${isMe ? "bg-accent/5 border border-accent/20" : "bg-muted/30"}`}>
                      <div className="flex h-8 w-8 items-center justify-center font-semibold text-sm">
                        {medal || `#${idx + 1}`}
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent text-sm font-semibold overflow-hidden">
                        {row.avatar_url ? (
                          <img src={row.avatar_url} alt={row.full_name} className="h-full w-full object-cover" />
                        ) : (
                          row.full_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{isMe ? `${row.full_name} (you)` : row.full_name}</p>
                        <p className="text-xs text-muted-foreground">{row.total_questions} questions answered</p>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-bold">{row.correct}</p>
                        <p className="text-xs text-muted-foreground">{row.accuracy}% accuracy</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "members" && (
          <div className="stat-card">
            <div className="space-y-2">
              {members.map((m) => {
                const isMe = m.user_id === user?.id;
                const isMemberOwner = m.user_id === group.owner_id;
                const canManage = isOwner && !isMemberOwner;
                return (
                  <div key={m.user_id} className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted/30">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent text-sm font-semibold overflow-hidden">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt={m.full_name || "Member"} className="h-full w-full object-cover" />
                      ) : (
                        (m.full_name || "M").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <p className="font-medium truncate">{m.full_name}{isMe && " (you)"}</p>
                      <p className="text-xs text-muted-foreground">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                    </div>
                    {isMemberOwner && (
                      <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">Owner</span>
                    )}
                    {canManage && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => transferOwnership(m.user_id, m.full_name || "this member")}
                          className="text-xs rounded-lg border border-border px-2.5 py-1 hover:bg-muted"
                        >
                          Make owner
                        </button>
                        <button
                          onClick={() => removeMember(m.user_id, m.full_name || "this member")}
                          className="text-xs rounded-lg border border-destructive/30 text-destructive px-2.5 py-1 hover:bg-destructive/10"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
