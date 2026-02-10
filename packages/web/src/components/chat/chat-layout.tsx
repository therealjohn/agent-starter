import { useState, useCallback } from "react";
import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { UsageBadge } from "./usage-badge";
import { SessionSidebar } from "./session-sidebar";
import { useChat } from "@/hooks/use-chat";
import { useSessions } from "@/hooks/use-sessions";

export function ChatLayout() {
  const { sessions, isLoading: sessionsLoading, refreshSessions, refreshWithTitlePoll, loadSessionEvents } = useSessions();

  const handleSessionUpdate = useCallback(() => {
    refreshWithTitlePoll();
  }, [refreshWithTitlePoll]);

  const { messages, isStreaming, error, sessionId, usage, sendMessage, clearMessages, loadSession } = useChat({
    onSessionUpdate: handleSessionUpdate,
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSelectSession = useCallback(async (id: string) => {
    const result = await loadSessionEvents(id);
    if (result) {
      loadSession(result.sessionId, result.messages);
    }
  }, [loadSessionEvents, loadSession]);

  const handleNewSession = useCallback(() => {
    clearMessages();
    refreshSessions();
  }, [clearMessages, refreshSessions]);

  return (
    <div className="flex h-screen bg-white relative">
      {/* Sidebar */}
      <SessionSidebar
        sessions={sessions}
        activeSessionId={sessionId}
        isLoading={sessionsLoading}
        onSelectSession={handleSelectSession}
        onRefresh={refreshSessions}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-neutral-600" />
            <h1 className="text-sm font-semibold text-neutral-900">Agent Starter</h1>
          </div>
          <div className="flex items-center gap-2">
            {usage && <UsageBadge usage={usage} />}
            <Button variant="ghost" size="sm" onClick={handleNewSession}>
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
    </div>
  );
}
