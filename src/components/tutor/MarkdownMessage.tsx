import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  content: string;
}

export function MarkdownMessage({ content }: Props) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2 prose-pre:my-2 prose-pre:bg-transparent prose-pre:p-0 prose-code:text-accent prose-code:before:content-none prose-code:after:content-none prose-li:my-0.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { className, children, ...rest } = props as {
              className?: string;
              children?: React.ReactNode;
              inline?: boolean;
            };
            const inline = (props as { inline?: boolean }).inline;
            const match = /language-(\w+)/.exec(className || "");
            if (!inline && match) {
              return (
                <CodeBlock language={match[1]} value={String(children).replace(/\n$/, "")} />
              );
            }
            return (
              <code className={`rounded bg-muted px-1 py-0.5 text-[0.85em] ${className || ""}`} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="not-prose group relative my-3 overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between bg-muted/60 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium hover:bg-background"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        PreTag="div"
        customStyle={{ margin: 0, padding: "0.85rem 1rem", background: "hsl(var(--background))", fontSize: "0.8rem" }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}
