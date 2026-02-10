import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { UsageBadge } from "./usage-badge";
import { useChat } from "@/hooks/use-chat";

export function ChatLayout() {
  const { messages, isStreaming, error, sessionId, usage, sendMessage, clearMessages } = useChat();

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-neutral-600" />
          <h1 className="text-sm font-semibold text-neutral-900">Agent Starter</h1>
          {sessionId && (
            <span className="text-xs text-neutral-400 font-mono">
              {sessionId.slice(0, 8)}…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {usage && <UsageBadge usage={usage} />}
          <Button variant="ghost" size="sm" onClick={clearMessages}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
      </header>

      {/* Messages */}
      <MessageList messages={messages} />

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
