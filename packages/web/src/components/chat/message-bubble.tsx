import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";
import { Bot, User, FileText } from "lucide-react";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex gap-3 px-4 py-3", isUser && "flex-row-reverse")}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          "flex-1 rounded-lg px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-neutral-900 text-white"
            : "bg-neutral-50 border border-neutral-200 text-neutral-900"
        )}
      >
        {isUser ? (
          <>
            <p>{message.content}</p>
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {message.attachments.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
                  >
                    <FileText className="h-3 w-3" />
                    {name}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="prose prose-sm prose-neutral max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full border-collapse text-sm">{children}</table>
                    </div>
                  );
                },
                thead({ children }) {
                  return <thead className="bg-neutral-100">{children}</thead>;
                },
                th({ children }) {
                  return (
                    <th className="border border-neutral-300 px-3 py-1.5 text-left font-semibold">
                      {children}
                    </th>
                  );
                },
                td({ children }) {
                  return (
                    <td className="border border-neutral-300 px-3 py-1.5">{children}</td>
                  );
                },
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const inline = !match;
                  return !inline ? (
                    <SyntaxHighlighter
                      style={oneLight}
                      language={match[1]}
                      PreTag="div"
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={cn("bg-neutral-100 rounded px-1 py-0.5", className)} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {message.isStreaming && (
          <span className="inline-block w-2 h-4 bg-neutral-400 animate-pulse ml-1" aria-label="Streaming" />
        )}
      </div>
    </div>
  );
}
