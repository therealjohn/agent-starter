import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChat } from "./use-chat";

// Helper to create a readable stream from SSE events
function createSSEStream(events: Array<{ event: string; data: string }>) {
  const text = events.map((e) => `event: ${e.event}\ndata: ${e.data}\n\n`).join("");
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useChat", () => {
  it("initializes with empty state", () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.sessionId).toBeNull();
  });

  it("sends a message and processes stream events", async () => {
    const events = [
      { event: "session", data: JSON.stringify({ type: "session", sessionId: "s-1" }) },
      { event: "text_delta", data: JSON.stringify({ type: "text_delta", text: "Hello" }) },
      { event: "text_delta", data: JSON.stringify({ type: "text_delta", text: " world" }) },
      {
        event: "done",
        data: JSON.stringify({
          type: "done",
          result: {
            text: "Hello world",
            sessionId: "s-1",
            stopReason: "end_turn",
            usage: { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
            todos: { todos: [], total: 0, completed: 0, inProgress: 0, pending: 0 },
            toolCalls: [],
          },
        }),
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(createSSEStream(events), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[0].content).toBe("Hi");
    expect(result.current.messages[1].role).toBe("assistant");
    expect(result.current.messages[1].content).toBe("Hello world");
    expect(result.current.messages[1].isStreaming).toBe(false);
    expect(result.current.sessionId).toBe("s-1");
  });

  it("handles error responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Bad request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.error).toBe("Bad request");
  });

  it("clears messages", async () => {
    const events = [
      { event: "text_delta", data: JSON.stringify({ type: "text_delta", text: "Hi" }) },
      {
        event: "done",
        data: JSON.stringify({
          type: "done",
          result: {
            text: "Hi",
            stopReason: "end_turn",
            usage: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
            todos: { todos: [], total: 0, completed: 0, inProgress: 0, pending: 0 },
            toolCalls: [],
          },
        }),
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(createSSEStream(events), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.sessionId).toBeNull();
  });
});
