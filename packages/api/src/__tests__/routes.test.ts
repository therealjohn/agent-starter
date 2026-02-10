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
  createSessionManager: vi.fn().mockReturnValue({
    prepare: vi.fn().mockResolvedValue({ cwd: "/tmp/test-session", envId: "test-env-123" }),
    mapSession: vi.fn(),
    destroy: vi.fn().mockResolvedValue(undefined),
  }),
  SessionStore: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({ id: "session-123", title: "", status: "active", createdAt: "", updatedAt: "" }),
    updateTitle: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    appendEvent: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn().mockResolvedValue({ id: "session-123", title: "", status: "active", createdAt: "", updatedAt: "" }),
    getEvents: vi.fn().mockResolvedValue([]),
  })),
  generateSessionTitle: vi.fn().mockResolvedValue("Test Session Title"),
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

  describe("POST /ag-ui", () => {
    it("returns AG-UI SSE stream for valid RunAgentInput", async () => {
      const res = await app.request("/ag-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: "thread-1",
          runId: "run-1",
          messages: [{ id: "msg-1", role: "user", content: "Hello" }],
          tools: [],
          context: [],
          state: {},
          forwardedProps: {},
        }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      const text = await res.text();
      expect(text).toContain("event: RUN_STARTED");
      expect(text).toContain("event: TEXT_MESSAGE_CONTENT");
      expect(text).toContain("event: RUN_FINISHED");
    });

    it("returns 400 when no user message is present", async () => {
      const res = await app.request("/ag-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: "thread-1",
          runId: "run-1",
          messages: [],
          tools: [],
          context: [],
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("No user message");
    });
  });
});
