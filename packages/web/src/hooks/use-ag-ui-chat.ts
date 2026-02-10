import { useState, useCallback, useRef, useEffect } from "react";
import { EventType } from "@ag-ui/core";
import type { ChatMessage, UsageStats, TodoProgress, ToolCall } from "@/types";

const API_BASE = "/api";

interface UseAgUiChatOptions {
  onSessionUpdate?: () => void;
}

interface UseAgUiChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sessionId: string | null;
  usage: UsageStats | null;
  todos: TodoProgress | null;
  sendMessage: (prompt: string, files?: File[]) => Promise<void>;
  clearMessages: () => void;
  loadSession: (sessionId: string, messages: ChatMessage[]) => void;
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

/** Tracks in-progress tool call arg accumulation */
interface PendingToolCall {
  id: string;
  name: string;
  argsJson: string;
}

/**
 * React hook that consumes the AG-UI protocol endpoint.
 * Drop-in replacement for useChat — same public API, backed by AG-UI events.
 */
export function useAgUiChat(options?: UseAgUiChatOptions): UseAgUiChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [todos, setTodos] = useState<TodoProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const segmentRef = useRef<SegmentState | null>(null);
  const pendingToolRef = useRef<PendingToolCall | null>(null);
  const onSessionUpdateRef = useRef(options?.onSessionUpdate);
  useEffect(() => { onSessionUpdateRef.current = options?.onSessionUpdate; });

  const sendMessage = useCallback(async (prompt: string, files?: File[]) => {
    if (isStreaming) return;

    const attachments = files?.map((f) => f.name);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      ...(attachments && attachments.length > 0 && { attachments }),
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
    pendingToolRef.current = null;

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setError(null);

    abortRef.current = new AbortController();

    try {
      const threadId = sessionId ?? `thread-${Date.now()}`;
      const runId = `run-${Date.now()}`;

      let fetchBody: BodyInit;
      const headers: Record<string, string> = { Accept: "text/event-stream" };

      if (files && files.length > 0) {
        const formData = new FormData();
        formData.append("prompt", prompt);
        formData.append("threadId", threadId);
        formData.append("runId", runId);
        if (sessionId) formData.append("resumeSessionId", sessionId);
        for (const file of files) formData.append("files", file);
        fetchBody = formData;
      } else {
        headers["Content-Type"] = "application/json";
        fetchBody = JSON.stringify({
          threadId,
          runId,
          messages: [{ id: `umsg-${Date.now()}`, role: "user", content: prompt }],
          tools: [],
          context: [],
          state: {},
          forwardedProps: {},
          ...(sessionId && { forwardedProps: { resumeSessionId: sessionId } }),
        });
      }

      const res = await fetch(`${API_BASE}/ag-ui`, {
        method: "POST",
        headers,
        body: fetchBody,
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
              const event = JSON.parse(data);
              handleAgUiEvent(event, baseId);
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
      pendingToolRef.current = null;
      onSessionUpdateRef.current?.();
    }
  }, [isStreaming, sessionId]);

  const handleAgUiEvent = useCallback((event: Record<string, unknown>, baseId: string) => {
    const type = event.type as string;

    switch (type) {
      case EventType.TEXT_MESSAGE_CONTENT: {
        const seg = segmentRef.current;
        if (!seg) break;
        const delta = event.delta as string;

        if (seg.hasToolCalls) {
          // Text after tool calls → create a new assistant message segment
          const prevId = seg.currentId;
          seg.counter++;
          const newId = `${baseId}-${seg.counter}`;
          seg.currentId = newId;
          seg.hasToolCalls = false;

          const newMsg: ChatMessage = {
            id: newId,
            role: "assistant",
            content: delta,
            isStreaming: true,
            toolCalls: [],
          };
          setMessages((prev) => [
            ...prev.map((m) =>
              m.id === prevId ? { ...m, isStreaming: false } : m
            ),
            newMsg,
          ]);
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === seg.currentId
                ? { ...m, content: m.content + delta }
                : m
            )
          );
        }
        break;
      }

      case EventType.TOOL_CALL_START: {
        pendingToolRef.current = {
          id: event.toolCallId as string,
          name: event.toolCallName as string,
          argsJson: "",
        };
        break;
      }

      case EventType.TOOL_CALL_ARGS: {
        const pending = pendingToolRef.current;
        if (pending && pending.id === event.toolCallId) {
          pending.argsJson += event.delta as string;
        }
        break;
      }

      case EventType.TOOL_CALL_END: {
        const pending = pendingToolRef.current;
        const seg = segmentRef.current;
        if (!pending || !seg) break;

        let input: Record<string, unknown> = {};
        try { input = JSON.parse(pending.argsJson); } catch { /* keep empty */ }

        const toolCall: ToolCall = {
          id: pending.id,
          name: pending.name,
          input,
        };

        seg.hasToolCalls = true;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === seg.currentId
              ? { ...m, toolCalls: [...(m.toolCalls ?? []), toolCall] }
              : m
          )
        );
        pendingToolRef.current = null;
        break;
      }

      case EventType.CUSTOM: {
        const name = event.name as string;
        const value = event.value as Record<string, unknown>;

        if (name === "session") {
          setSessionId(value.sessionId as string);
        } else if (name === "usage") {
          const usageData = value as unknown as UsageStats;
          setUsage(usageData);
          const seg = segmentRef.current;
          if (seg) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === seg.currentId ? { ...m, usage: usageData } : m
              )
            );
          }
        } else if (name === "todo_update") {
          const todosData = value as unknown as TodoProgress;
          setTodos(todosData);
          const seg = segmentRef.current;
          if (seg) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === seg.currentId ? { ...m, todos: todosData } : m
              )
            );
          }
        } else if (name === "done_result") {
          const result = value as unknown as { usage: UsageStats; todos: TodoProgress };
          setUsage(result.usage);
          if (result.todos && result.todos.total > 0) {
            setTodos(result.todos);
          }
        }
        break;
      }

      case EventType.RUN_ERROR: {
        setError(event.message as string);
        break;
      }

      // RUN_STARTED, TEXT_MESSAGE_START, TEXT_MESSAGE_END, RUN_FINISHED
      // are handled implicitly by our streaming state management
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setUsage(null);
    setTodos(null);
    setError(null);
  }, []);

  const loadSession = useCallback((sid: string, msgs: ChatMessage[]) => {
    setMessages(msgs);
    setSessionId(sid);
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
    loadSession,
  };
}
