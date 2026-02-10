import { useState, useCallback, useEffect, useRef } from "react";

const API_BASE = "/api";

export interface SessionInfo {
  id: string;
  title: string;
  status: "active" | "completed";
  createdAt: string;
  updatedAt: string;
}

interface SessionEventData {
  type: "user.message" | "assistant.message" | "tool.call" | "session.done";
  data: Record<string, unknown>;
  timestamp: string;
}

/** Message shape compatible with CopilotKit's display */
export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
}

interface UseSessionsReturn {
  sessions: SessionInfo[];
  isLoading: boolean;
  refreshSessions: () => Promise<void>;
  refreshWithTitlePoll: () => Promise<void>;
  loadSessionMessages: (id: string) => Promise<SessionMessage[] | null>;
}

/** Convert server events into simple message pairs */
function eventsToMessages(events: SessionEventData[]): SessionMessage[] {
  const messages: SessionMessage[] = [];
  for (const event of events) {
    if (event.type === "user.message") {
      messages.push({ role: "user", content: (event.data.content as string) ?? "" });
    } else if (event.type === "assistant.message") {
      messages.push({ role: "assistant", content: (event.data.content as string) ?? "" });
    }
  }
  return messages;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      // silently ignore fetch errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Refresh now and schedule a delayed re-fetch for title updates */
  const refreshWithTitlePoll = useCallback(async () => {
    await refreshSessions();
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(() => refreshSessions(), 5000);
  }, [refreshSessions]);

  const loadSessionMessages = useCallback(
    async (id: string): Promise<SessionMessage[] | null> => {
      try {
        const res = await fetch(`${API_BASE}/sessions/${id}/events`);
        if (!res.ok) return null;
        const data = await res.json();
        return eventsToMessages(data.events ?? []);
      } catch {
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    refreshSessions();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [refreshSessions]);

  return { sessions, isLoading, refreshSessions, refreshWithTitlePoll, loadSessionMessages };
}
