import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Sparkles, Loader2, User, Plus, Trash2, MessageSquare, Square,
  RefreshCw, Copy, Check, Image as ImageIcon, ListChecks, BookOpen, X,
} from "lucide-react";
import { motion } from "framer-motion";
import { MarkdownMessage } from "@/components/tutor/MarkdownMessage";
import { toast } from "sonner";

export const Route = createFileRoute("/tutor")({
  validateSearch: (search: Record<string, unknown>) => ({
    conversationId: (search.conversationId as string) || undefined,
    prefill: (search.prefill as string) || undefined,
    subjectId: (search.subjectId as string) || undefined,
  }),
  component: TutorPage,
});

type Msg = { id?: string; role: "user" | "assistant"; content: string; image_url?: string | null };
type Conversation = { id: string; title: string; updated_at: string; subject_id: string | null };
type Subject = { id: string; name: string; code: string };
type GeneratedQuestion = { question: string; options: string[]; correct_index: number; explanation: string };

const SUGGESTED = [
  "Explain Big O notation with intuition first",
  "Stack vs queue: when do I use which?",
  "Walk me through binary search step by step",
  "Generate 3 medium MCQs on recursion",
];

function TutorPage() {
  const { isAuthenticated, isLoading, session, user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(search.conversationId || null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(search.subjectId || null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [generatedQs, setGeneratedQs] = useState<GeneratedQuestion[] | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingMcq, setGeneratingMcq] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Tracks the conversation id whose messages are currently in state, so we
  // don't re-fetch (and wipe) messages when WE assign a new conversation id
  // ourselves after the first send of a brand-new chat.
  const loadedConvIdRef = useRef<string | null>(search.conversationId || null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, generatedQs]);

  // Load subjects + conversations
  useEffect(() => {
    if (!user) return;
    supabase.from("subjects").select("id, name, code").order("name").then(({ data }) => setSubjects(data || []));
    refreshConversations();
  }, [user?.id]);

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tutor_conversations")
      .select("id, title, updated_at, subject_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    setConversations(data || []);
  }, [user?.id]);

  // Load messages when a conversation is opened
  useEffect(() => {
    if (!conversationId || !user) return;
    let cancelled = false;
    (async () => {
      const { data: conv } = await supabase
        .from("tutor_conversations")
        .select("subject_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (cancelled) return;
      if (conv) setSubjectId(conv.subject_id);
      const { data } = await supabase
        .from("tutor_messages")
        .select("id, role, content, image_url")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages((data || []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        image_url: m.image_url,
      })));
    })();
    return () => { cancelled = true; };
  }, [conversationId, user?.id]);

  // Handle prefill from /practice "Explain with AI"
  useEffect(() => {
    if (search.prefill && !messages.length && !streaming) {
      setInput(search.prefill);
    }
  }, [search.prefill]);

  const newChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setGeneratedQs(null);
    setError(null);
    setShowSidebar(false);
    navigate({ to: "/tutor", search: {} });
  };

  const openConversation = (id: string) => {
    abortRef.current?.abort();
    setConversationId(id);
    setGeneratedQs(null);
    setError(null);
    setShowSidebar(false);
    navigate({ to: "/tutor", search: { conversationId: id } });
  };

  const deleteConversation = async (id: string) => {
    if (!user) return;
    await supabase.from("tutor_conversations").delete().eq("id", id).eq("user_id", user.id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (conversationId === id) newChat();
  };

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const send = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    setError(null);
    setGeneratedQs(null);
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch("/api/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          subjectId,
          conversationId,
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        setError(err.error || "Failed to get response");
        setStreaming(false);
        return;
      }

      const newConvId = resp.headers.get("X-Conversation-Id");
      if (newConvId && newConvId !== conversationId) {
        setConversationId(newConvId);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistant = "";
      let done = false;

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistant += delta;
              setMessages((prev) => prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: assistant } : m,
              ));
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
      void refreshConversations();
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        // user stopped — keep partial message
      } else {
        setError(e instanceof Error ? e.message : "Network error");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming, session, subjectId, conversationId, refreshConversations]);

  const regenerate = useCallback(async () => {
    if (streaming) return;
    // Drop the last assistant message and re-send the prior user turn.
    let trimmed = [...messages];
    if (trimmed[trimmed.length - 1]?.role === "assistant") trimmed = trimmed.slice(0, -1);
    const lastUser = [...trimmed].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages(trimmed.slice(0, trimmed.findIndex((m) => m === lastUser) + 1));
    // Slight async to allow state to flush; then send via normal path with messages excluding the trailing user (since send appends it).
    setTimeout(() => {
      const base = trimmed.slice(0, trimmed.findIndex((m) => m === lastUser));
      setMessages(base);
      void send(lastUser.content);
    }, 0);
  }, [messages, streaming, send]);

  const generateImage = async () => {
    const prompt = window.prompt("Describe the diagram you want (e.g. 'binary search tree rotations'):", "");
    if (!prompt) return;
    setGeneratingImage(true);
    try {
      const resp = await fetch("/api/ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed");
      const newMsg: Msg = { role: "assistant", content: `**Diagram:** ${prompt}`, image_url: data.imageUrl };
      setMessages((prev) => [...prev, newMsg]);
      // Persist
      if (user && conversationId) {
        await supabase.from("tutor_messages").insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: "assistant",
          content: newMsg.content,
          image_url: data.imageUrl,
        });
      } else if (user) {
        // create a conversation for this image
        const { data: conv } = await supabase
          .from("tutor_conversations")
          .insert({ user_id: user.id, subject_id: subjectId, title: `Diagram: ${prompt.slice(0, 50)}` })
          .select("id")
          .single();
        if (conv) {
          setConversationId(conv.id);
          await supabase.from("tutor_messages").insert({
            conversation_id: conv.id,
            user_id: user.id,
            role: "assistant",
            content: newMsg.content,
            image_url: data.imageUrl,
          });
          void refreshConversations();
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate diagram");
    } finally {
      setGeneratingImage(false);
    }
  };

  const generateMcq = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const subject = subjects.find((s) => s.id === subjectId);
    const topic = lastUser?.content || subject?.name || window.prompt("Topic for practice questions:", "") || "";
    if (!topic.trim()) return;
    setGeneratingMcq(true);
    try {
      const resp = await fetch("/api/ai-mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, count: 3, difficulty: "medium" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed");
      setGeneratedQs(data.questions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate questions");
    } finally {
      setGeneratingMcq(false);
    }
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const subjectName = subjects.find((s) => s.id === subjectId)?.name;

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-7rem)] md:h-[calc(100vh-3rem)] max-w-6xl mx-auto gap-4">
        {/* Sidebar */}
        <aside className={`${showSidebar ? "fixed inset-0 z-40 bg-background/95 backdrop-blur p-4 flex" : "hidden"} md:relative md:flex md:w-64 md:p-0 md:bg-transparent md:backdrop-blur-none flex-col gap-2`}>
          <div className="flex items-center justify-between md:hidden mb-2">
            <h3 className="font-semibold">Conversations</h3>
            <button onClick={() => setShowSidebar(false)} className="p-1.5 rounded-lg hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={newChat}
            className="flex items-center justify-center gap-2 rounded-xl gradient-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New chat
          </button>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 mt-1">
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-3">No conversations yet.</p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm cursor-pointer transition-colors ${
                  c.id === conversationId ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => openConversation(c.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{c.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); void deleteConversation(c.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowSidebar(true)}
              className="md:hidden p-2 rounded-lg border border-border"
              aria-label="Show conversations"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shrink-0">
              <Sparkles className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg md:text-xl font-bold truncate">AI Tutor</h1>
              <p className="text-[11px] text-muted-foreground truncate">
                {subjectName ? `Tutoring on ${subjectName}` : "Free & unlimited"}
              </p>
            </div>
            <select
              value={subjectId || ""}
              onChange={(e) => setSubjectId(e.target.value || null)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-accent max-w-[150px]"
              aria-label="Subject context"
            >
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </select>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto stat-card !p-3 md:!p-4 mb-3 space-y-4 min-h-0">
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Sparkles className="h-10 w-10 text-accent mb-3" />
                <h2 className="font-display text-lg font-semibold mb-1">How can I help you study today?</h2>
                <p className="text-xs text-muted-foreground mb-5 max-w-md">
                  Ask anything, request a diagram, or generate practice questions on a topic.
                </p>
                {subjects.length > 0 && !subjectId && (
                  <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> Tip: pick a subject above to ground answers in your course.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left rounded-xl border border-border px-3 py-2.5 text-xs hover:border-accent/50 hover:bg-accent/5 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <motion.div
                key={m.id || i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group flex gap-2 md:gap-3 ${m.role === "user" ? "justify-end" : ""}`}
              >
                {m.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg gradient-primary">
                    <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
                <div className={`min-w-0 max-w-[85%] md:max-w-[78%] flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm w-full ${
                      m.role === "user"
                        ? "gradient-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <>
                        {m.image_url && (
                          <img src={m.image_url} alt="Generated diagram" className="mb-2 rounded-lg max-w-full" />
                        )}
                        <MarkdownMessage content={m.content || (streaming && i === messages.length - 1 ? "…" : "")} />
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    )}
                  </div>
                  {m.role === "assistant" && m.content && (
                    <div className="mt-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <CopyButton content={m.content} />
                      {i === messages.length - 1 && !streaming && (
                        <button
                          onClick={regenerate}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <RefreshCw className="h-3 w-3" /> Regenerate
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </motion.div>
            ))}

            {generatedQs && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-accent">Generated practice questions</p>
                  <button onClick={() => setGeneratedQs(null)} className="p-1 rounded hover:bg-background">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {generatedQs.map((q, idx) => (
                  <McqCard key={idx} q={q} idx={idx} />
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="mb-2 flex items-center gap-1.5 flex-wrap">
            <button
              onClick={generateImage}
              disabled={generatingImage}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
            >
              {generatingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
              Diagram
            </button>
            <button
              onClick={generateMcq}
              disabled={generatingMcq}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
            >
              {generatingMcq ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListChecks className="h-3 w-3" />}
              Practice MCQs
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask anything..."
              rows={1}
              disabled={streaming}
              className="flex-1 min-w-0 resize-none rounded-xl border border-input bg-background px-4 py-3 text-base md:text-sm outline-none focus:border-accent disabled:opacity-50 max-h-32"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-foreground hover:bg-muted"
                aria-label="Stop generating"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl gradient-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="h-5 w-5" />
              </button>
            )}
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(content);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* ignore */ }
      }}
      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function McqCard({ q, idx }: { q: GeneratedQuestion; idx: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  const reveal = picked !== null;
  return (
    <div className="rounded-lg bg-background border border-border p-3">
      <p className="text-sm font-medium mb-2">{idx + 1}. {q.question}</p>
      <div className="space-y-1.5">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correct_index;
          const isPicked = picked === i;
          let cls = "border-border hover:border-accent/50";
          if (reveal && isCorrect) cls = "border-success bg-success/5";
          else if (reveal && isPicked && !isCorrect) cls = "border-destructive bg-destructive/5";
          else if (isPicked) cls = "border-accent bg-accent/5";
          return (
            <button
              key={i}
              disabled={reveal}
              onClick={() => setPicked(i)}
              className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-all ${cls}`}
            >
              <span className="font-mono text-[10px] text-muted-foreground mr-2">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          );
        })}
      </div>
      {reveal && (
        <p className="mt-2 text-[11px] text-muted-foreground"><strong className="text-info">Why:</strong> {q.explanation}</p>
      )}
    </div>
  );
}
