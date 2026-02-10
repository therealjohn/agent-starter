import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { ToolCallCard } from "./tool-call-card";
import { TodoProgress } from "./todo-progress";
import type { ChatMessage } from "@/types";

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">
        Send a message to start a conversation
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto py-4">
        {messages.map((msg) => {
          const hasContent = msg.content.trim().length > 0 || msg.isStreaming;
          const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0;
          const hasTodos = msg.todos && msg.todos.total > 0;

          return (
            <div key={msg.id}>
              {hasContent && <MessageBubble message={msg} />}

              {hasToolCalls && (
                <div className="px-4 pl-15">
                  {msg.toolCalls!.map((tc) => (
                    <ToolCallCard key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}

              {hasTodos && (
                <div className="px-4 pl-15">
                  <TodoProgress progress={msg.todos!} />
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
