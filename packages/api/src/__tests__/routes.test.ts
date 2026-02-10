import { describe, it, expect, vi } from "vitest";
import { app } from "../routes.js";

// Mock the core module so tests don't need the SDK binary
vi.mock("@agent-starter/core", () => ({
  runQuery: vi.fn().mockResolvedValue({
    text: "Hello from the agent",
    sessionId: "session-123",
    stopReason: "end_turn",
    usage: { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    todos: { todos: [], total: 0, completed: 0, inProgress: 0, pending: 0 },
    toolCalls: [],
  }),
  streamQuery: vi.fn().mockImplementation(async function* () {
    yield { type: "session", sessionId: "session-123" };
    yield { type: "text_delta", text: "Hello" };
    yield {
      type: "done",
      result: {
        text: "Hello",
        sessionId: "session-123",
        stopReason: "end_turn",
        usage: { inputTokens: 50, outputTokens: 25, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
        todos: { todos: [], total: 0, completed: 0, inProgress: 0, pending: 0 },
        toolCalls: [],
      },
    };
  }),
}));

describe("API routes", () => {
  describe("GET /health", () => {
    it("returns ok status", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeDefined();
    });
  });

  describe("POST /query", () => {
    it("returns agent result for valid prompt", async () => {
      const res = await app.request("/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Hello" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.text).toBe("Hello from the agent");
      expect(body.sessionId).toBe("session-123");
      expect(body.stopReason).toBe("end_turn");
      expect(body.usage.inputTokens).toBe(100);
    });

    it("returns 400 when prompt is missing", async () => {
      const res = await app.request("/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("prompt is required");
    });
  });

  describe("POST /stream", () => {
    it("returns SSE stream for valid prompt", async () => {
      const res = await app.request("/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Hello" }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      const text = await res.text();
      expect(text).toContain("event: session");
      expect(text).toContain("event: text_delta");
      expect(text).toContain("event: done");
    });

    it("returns 400 when prompt is missing", async () => {
      const res = await app.request("/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });
});
