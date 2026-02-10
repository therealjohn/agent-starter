import { useState, useCallback, useRef } from "react";
import type { ChatMessage, StreamEvent, UsageStats, TodoProgress, ToolCall } from "@/types";

const API_BASE = "/api";

interface UseChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sessionId: string | null;
  usage: UsageStats | null;
  todos: TodoProgress | null;
  sendMessage: (prompt: string) => Promise<void>;
  clearMessages: () => void;
}

/** Tracks which assistant message segment is currently being built */
interface SegmentState {
  /** ID of the current assistant message segment receiving text */
  currentId: string;
  /** Counter for generating unique segment IDs */
  counter: number;
  /** Whether the current segment has received tool calls (next text needs a new segment) */
  hasToolCalls: boolean;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [todos, setTodos] = useState<TodoProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const segmentRef = useRef<SegmentState | null>(null);

  const sendMessage = useCallback(async (prompt: string) => {
    if (isStreaming) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
    };

    const baseId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: baseId,
      role: "assistant",
      content: "",
      isStreaming: true,
      toolCalls: [],
    };

    segmentRef.current = { currentId: baseId, counter: 0, hasToolCalls: false };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setError(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API_BASE}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          prompt,
          ...(sessionId && { resumeSessionId: sessionId }),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            try {
              const event: StreamEvent = JSON.parse(data);
              handleStreamEvent(event, baseId);
            } catch {
              // skip unparseable lines
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      // Mark all assistant segments as done streaming
      const seg = segmentRef.current;
      if (seg) {
        setMessages((prev) =>
          prev.map((m) =>
            m.role === "assistant" && m.isStreaming
              ? { ...m, isStreaming: false }
              : m
          )
        );
      }
      setIsStreaming(false);
      abortRef.current = null;
      segmentRef.current = null;
    }
  }, [isStreaming, sessionId]);

  const handleStreamEvent = useCallback((event: StreamEvent, baseId: string) => {
    switch (event.type) {
      case "text_delta": {
        const seg = segmentRef.current;
        if (!seg) break;

        if (seg.hasToolCalls) {
          // Text after tool calls → create a new assistant message segment
          seg.counter++;
          const newId = `${baseId}-${seg.counter}`;
          seg.currentId = newId;
          seg.hasToolCalls = false;

          const newMsg: ChatMessage = {
            id: newId,
            role: "assistant",
            content: event.text,
            isStreaming: true,
            toolCalls: [],
          };
          setMessages((prev) => [...prev, newMsg]);
        } else {
          // Append text to current segment
          setMessages((prev) =>
            prev.map((m) =>
              m.id === seg.currentId
                ? { ...m, content: m.content + event.text }
                : m
            )
          );
        }
        break;
      }

      case "tool_call": {
        const seg = segmentRef.current;
        if (!seg) break;
        seg.hasToolCalls = true;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === seg.currentId
              ? { ...m, toolCalls: [...(m.toolCalls ?? []), event.toolCall] }
              : m
          )
        );
        break;
      }

      case "todo_update": {
        setTodos(event.todos);
        const seg = segmentRef.current;
        if (!seg) break;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === seg.currentId ? { ...m, todos: event.todos } : m
          )
        );
        break;
      }

      case "usage": {
        setUsage(event.usage);
        const seg = segmentRef.current;
        if (!seg) break;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === seg.currentId ? { ...m, usage: event.usage } : m
          )
        );
        break;
      }

      case "session":
        setSessionId(event.sessionId);
        break;

      case "done":
        setUsage(event.result.usage);
        if (event.result.todos.total > 0) {
          setTodos(event.result.todos);
        }
        break;

      case "error":
        setError(event.error);
        break;
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setUsage(null);
    setTodos(null);
    setError(null);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sessionId,
    usage,
    todos,
    sendMessage,
    clearMessages,
  };
}
