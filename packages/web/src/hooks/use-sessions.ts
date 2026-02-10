import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "@/types";

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

interface UseSessionsReturn {
  sessions: SessionInfo[];
  isLoading: boolean;
  refreshSessions: () => Promise<void>;
  refreshWithTitlePoll: () => Promise<void>;
  loadSessionEvents: (id: string) => Promise<{ messages: ChatMessage[]; sessionId: string } | null>;
}

/** Convert server events back into ChatMessage[] for display */
function eventsToMessages(events: SessionEventData[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let counter = 0;

  for (const event of events) {
    if (event.type === "user.message") {
      messages.push({
        id: `user-${counter++}`,
        role: "user",
        content: (event.data.content as string) ?? "",
      });
    } else if (event.type === "assistant.message") {
      messages.push({
        id: `assistant-${counter++}`,
        role: "assistant",
        content: (event.data.content as string) ?? "",
      });
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
    // Title generation is async — re-fetch after a short delay to pick it up
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(() => refreshSessions(), 5000);
  }, [refreshSessions]);

  const loadSessionEvents = useCallback(
    async (id: string): Promise<{ messages: ChatMessage[]; sessionId: string } | null> => {
      try {
        const res = await fetch(`${API_BASE}/sessions/${id}/events`);
        if (!res.ok) return null;
        const data = await res.json();
        const messages = eventsToMessages(data.events ?? []);
        return { messages, sessionId: id };
      } catch {
        return null;
      }
    },
    []
  );

  // Load sessions on mount
  useEffect(() => {
    refreshSessions();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [refreshSessions]);

  return { sessions, isLoading, refreshSessions, refreshWithTitlePoll, loadSessionEvents };
}
