import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";

export const Route = createFileRoute("/tutor")({
  component: TutorPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "Explain Big O notation with examples",
  "What's the difference between a stack and a queue?",
  "How does binary search work?",
  "Explain the Pumping Lemma simply",
];

function TutorPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || streaming) return;
    setError(null);
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const resp = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        setError(err.error || "Failed to get response");
        setStreaming(false);
        return;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setStreaming(false);
    }
  };

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)] max-w-4xl mx-auto">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">AI Tutor</h1>
            <p className="text-xs text-muted-foreground">Ask any question — free & unlimited</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto stat-card !p-4 mb-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Sparkles className="h-12 w-12 text-accent mb-4" />
              <h2 className="font-display text-xl font-semibold mb-2">How can I help you study today?</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Ask me anything about your subjects, get explanations, work through problems together.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left rounded-xl border border-border px-4 py-3 text-sm hover:border-accent/50 hover:bg-accent/5 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}
            >
              {m.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm ${
                  m.role === "user"
                    ? "gradient-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-pre:my-2 prose-pre:bg-background prose-code:text-accent">
                    <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
              {m.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <User className="h-4 w-4" />
                </div>
              )}
            </motion.div>
          ))}

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-end gap-2"
        >
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
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-accent disabled:opacity-50 max-h-32"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl gradient-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
          >
            {streaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
