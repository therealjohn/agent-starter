import { useState, useCallback, useEffect, useRef } from "react";
import { CopilotKit, useCopilotChatInternal } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { SessionSidebar } from "@/components/session-sidebar";
import { useSessions, type SessionMessage } from "@/hooks/use-sessions";

/**
 * Main application component.
 *
 * Uses CopilotKit with the self-hosted runtime endpoint (`/api/copilotkit`)
 * which delegates to the AG-UI agent backend.
 *
 * To switch UI modes, replace `CopilotChat` with:
 * - `CopilotSidebar` — docked sidebar panel
 * - `CopilotPopup` — floating popup button/chat
 * All share the same props interface (labels, instructions, etc.).
 */
export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const { sessions, isLoading, refreshSessions, refreshWithTitlePoll, loadSessionMessages } =
    useSessions();
  const [previousMessages, setPreviousMessages] = useState<SessionMessage[]>([]);

  // CopilotKit uses threadId to scope conversations. We map our backend
  // session IDs to CopilotKit thread IDs. A null activeSessionId means
  // "new conversation" — we generate a fresh threadId.
  const [threadId, setThreadId] = useState<string>(() => `thread-${Date.now()}`);

  const handleSelectSession = useCallback(
    async (id: string) => {
      setActiveSessionId(id);
      // Load the conversation history before re-keying CopilotKit so
      // the ChatArea can display previous messages on mount.
      const msgs = await loadSessionMessages(id);
      setPreviousMessages(msgs ?? []);
      setThreadId(id);
    },
    [loadSessionMessages],
  );

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setPreviousMessages([]);
    setThreadId(`thread-${Date.now()}`);
    refreshSessions();
  }, [refreshSessions]);

  return (
    <div
      className="flex h-screen"
      style={
        {
          "--copilot-kit-primary-color": "#171717",
          "--copilot-kit-contrast-color": "#ffffff",
          "--copilot-kit-background-color": "#ffffff",
          "--copilot-kit-secondary-color": "#f5f5f5",
          "--copilot-kit-secondary-contrast-color": "#171717",
          "--copilot-kit-separator-color": "#e5e5e5",
          "--copilot-kit-muted-color": "#737373",
        } as React.CSSProperties
      }
    >
      {/* Session history sidebar */}
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isLoading={isLoading}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onRefresh={refreshSessions}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
      />

      {/* Main chat area — re-keyed by threadId to reset CopilotKit state */}
      <CopilotKit
        key={threadId}
        runtimeUrl="/api/copilotkit"
        agent="agent-starter"
        threadId={threadId}
        showDevConsole={false}
      >
        <ChatArea onSessionUpdate={refreshWithTitlePoll} previousMessages={previousMessages} />
      </CopilotKit>
    </div>
  );
}

/**
 * Injects previous session messages into CopilotKit's shared agent.
 *
 * CopilotChat calls useCopilotChatInternal internally, which triggers
 * connectAgent on mount. connectAgent clears messages then reconnects.
 * We need to wait until the connect finishes (agent stops running) before
 * injecting our messages, otherwise connectAgent's setMessages([]) wipes them.
 *
 * Both this hook and CopilotChat's internal hook call useAgent with the same
 * agentId, returning the same agent singleton, so agent.setMessages() here
 * is seen by CopilotChat's message renderer.
 */
function useInjectPreviousMessages(previousMessages: SessionMessage[]) {
  const { agent } = useCopilotChatInternal();
  const injectedRef = useRef(false);

  // Reset injected flag when messages change (new session selected)
  useEffect(() => {
    injectedRef.current = false;
  }, [previousMessages]);

  useEffect(() => {
    if (injectedRef.current || previousMessages.length === 0 || !agent) return;

    // CopilotChat's connectAgent runs asynchronously after mount and
    // clears messages via agent.setMessages([]). We must wait for it
    // to finish before injecting. We poll until agent.isRunning has
    // transitioned true→false, or until a reasonable timeout elapses
    // (for cases where connect completes very quickly or is a no-op).
    let cancelled = false;
    let sawRunning = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 40; // ~2s total

    const tryInject = () => {
      if (cancelled || injectedRef.current) return;
      attempts++;
      if (agent.isRunning) {
        sawRunning = true;
        setTimeout(tryInject, 50);
      } else if (sawRunning || attempts >= MAX_ATTEMPTS) {
        // Agent finished running, or timeout reached — inject messages.
        agent.setMessages(
          previousMessages.map((m, i) => ({
            id: `prev-${i}`,
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        );
        injectedRef.current = true;
      } else {
        // Agent hasn't started running yet — wait for it.
        setTimeout(tryInject, 50);
      }
    };
    // Small initial delay to let React finish flushing effects and
    // give connectAgent a chance to start.
    setTimeout(tryInject, 50);

    return () => {
      cancelled = true;
    };
  }, [agent, previousMessages]);
}

/** Inner component that renders CopilotChat inside the CopilotKit provider */
function ChatArea({
  onSessionUpdate,
  previousMessages,
}: {
  onSessionUpdate: () => void;
  previousMessages: SessionMessage[];
}) {
  useInjectPreviousMessages(previousMessages);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <CopilotChat
        labels={{
          title: "Agent Starter",
          initial: previousMessages.length > 0 ? " " : "How can I help you today?",
          placeholder: "Type a message...",
        }}
        className="flex-1"
        onSubmitMessage={() => {
          // After a message exchange completes, refresh session list
          // to pick up new sessions and title updates
          setTimeout(onSessionUpdate, 1000);
        }}
      />
    </div>
  );
}
