import { describe, it, expect, vi } from "vitest";
import { EventType } from "@ag-ui/core";
import { streamQueryAsAgUi } from "../ag-ui-stream.js";

// Mock the core module
vi.mock("@agent-starter/core", () => ({
  streamQuery: vi.fn(),
}));

import { streamQuery } from "@agent-starter/core";
const mockStreamQuery = vi.mocked(streamQuery);

/** Collect all events from the async generator */
async function collectEvents(gen: AsyncGenerator<{ event: string; data: string }>) {
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  for await (const e of gen) {
    events.push({ event: e.event, data: JSON.parse(e.data) });
  }
  return events;
}

describe("streamQueryAsAgUi", () => {
  const config = { prompt: "Hello" };
  const threadId = "thread-1";
  const runId = "run-1";

  it("emits RUN_STARTED and RUN_FINISHED lifecycle events", async () => {
    mockStreamQuery.mockImplementation(async function* () {
      yield { type: "done" as const, result: { text: "", sessionId: undefined, stopReason: null, usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }, todos: { todos: [], total: 0, completed: 0, inProgress: 0, pending: 0 }, toolCalls: [] } };
    });

    const events = await collectEvents(streamQueryAsAgUi(config, threadId, runId));

    expect(events[0].event).toBe(EventType.RUN_STARTED);
    expect(events[0].data.threadId).toBe(threadId);
    expect(events[0].data.runId).toBe(runId);

    const last = events[events.length - 1];
    expect(last.event).toBe(EventType.RUN_FINISHED);
    expect(last.data.threadId).toBe(threadId);
  });

  it("maps text_delta to TEXT_MESSAGE_START + TEXT_MESSAGE_CONTENT + TEXT_MESSAGE_END", async () => {
    mockStreamQuery.mockImplementation(async function* () {
      yield { type: "text_delta" as const, text: "Hello " };
      yield { type: "text_delta" as const, text: "world" };
      yield { type: "done" as const, result: { text: "Hello world", sessionId: undefined, stopReason: null, usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }, todos: { todos: [], total: 0, completed: 0, inProgress: 0, pending: 0 }, toolCalls: [] } };
    });

    const events = await collectEvents(streamQueryAsAgUi(config, threadId, runId));

    // After RUN_STARTED: TEXT_MESSAGE_START, TEXT_MESSAGE_CONTENT x2, ...done_result..., TEXT_MESSAGE_END, RUN_FINISHED
    const textEvents = events.filter((e) => e.event.startsWith("TEXT_MESSAGE"));
    expect(textEvents[0].event).toBe(EventType.TEXT_MESSAGE_START);
    expect(textEvents[0].data.role).toBe("assistant");
    expect(textEvents[1].event).toBe(EventType.TEXT_MESSAGE_CONTENT);
    expect(textEvents[1].data.delta).toBe("Hello ");
    expect(textEvents[2].event).toBe(EventType.TEXT_MESSAGE_CONTENT);
    expect(textEvents[2].data.delta).toBe("world");
    expect(textEvents[3].event).toBe(EventType.TEXT_MESSAGE_END);
  });

  it("maps tool_call to TOOL_CALL_START + TOOL_CALL_ARGS + TOOL_CALL_END", async () => {
    mockStreamQuery.mockImplementation(async function* () {
      yield { type: "tool_call" as const, toolCall: { id: "tc-1", name: "read_file", input: { path: "/tmp/foo" } } };
      yield { type: "done" as const, result: { text: "", sessionId: undefined, stopReason: null, usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }, todos: { todos: [], total: 0, completed: 0, inProgress: 0, pending: 0 }, toolCalls: [] } };
    });

    const events = await collectEvents(streamQueryAsAgUi(config, threadId, runId));

    const toolEvents = events.filter((e) => e.event.startsWith("TOOL_CALL"));
    expect(toolEvents).toHaveLength(3);
    expect(toolEvents[0].event).toBe(EventType.TOOL_CALL_START);
    expect(toolEvents[0].data.toolCallId).toBe("tc-1");
    expect(toolEvents[0].data.toolCallName).toBe("read_file");
    expect(toolEvents[1].event).toBe(EventType.TOOL_CALL_ARGS);
    expect(toolEvents[1].data.delta).toBe('{"path":"/tmp/foo"}');
    expect(toolEvents[2].event).toBe(EventType.TOOL_CALL_END);
  });

  it("maps session, usage, and todo_update to CUSTOM events", async () => {
    const todosData = { todos: [{ content: "Fix bug", status: "pending" as const }], total: 1, completed: 0, inProgress: 0, pending: 1 };
    const usageData = { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };

    mockStreamQuery.mockImplementation(async function* () {
      yield { type: "session" as const, sessionId: "sess-42" };
      yield { type: "usage" as const, usage: usageData };
      yield { type: "todo_update" as const, todos: todosData };
      yield { type: "done" as const, result: { text: "", sessionId: "sess-42", stopReason: null, usage: usageData, todos: todosData, toolCalls: [] } };
    });

    const events = await collectEvents(streamQueryAsAgUi(config, threadId, runId));

    const customEvents = events.filter((e) => e.event === EventType.CUSTOM);
    const sessionEvt = customEvents.find((e) => e.data.name === "session");
    expect(sessionEvt).toBeDefined();
    expect((sessionEvt!.data.value as Record<string, unknown>).sessionId).toBe("sess-42");

    const usageEvt = customEvents.find((e) => e.data.name === "usage");
    expect(usageEvt).toBeDefined();

    const todoEvt = customEvents.find((e) => e.data.name === "todo_update");
    expect(todoEvt).toBeDefined();
  });

  it("maps error events to RUN_ERROR", async () => {
    mockStreamQuery.mockImplementation(async function* () {
      yield { type: "error" as const, error: "Something went wrong" };
    });

    const events = await collectEvents(streamQueryAsAgUi(config, threadId, runId));

    const errorEvt = events.find((e) => e.event === EventType.RUN_ERROR);
    expect(errorEvt).toBeDefined();
    expect(errorEvt!.data.message).toBe("Something went wrong");
  });

  it("closes text message before tool calls and starts new segment after", async () => {
    mockStreamQuery.mockImplementation(async function* () {
      yield { type: "text_delta" as const, text: "Let me check" };
      yield { type: "tool_call" as const, toolCall: { id: "tc-1", name: "bash", input: { command: "ls" } } };
      yield { type: "text_delta" as const, text: "Here are the files" };
      yield { type: "done" as const, result: { text: "Let me checkHere are the files", sessionId: undefined, stopReason: null, usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }, todos: { todos: [], total: 0, completed: 0, inProgress: 0, pending: 0 }, toolCalls: [] } };
    });

    const events = await collectEvents(streamQueryAsAgUi(config, threadId, runId));

    const textStarts = events.filter((e) => e.event === EventType.TEXT_MESSAGE_START);
    const textEnds = events.filter((e) => e.event === EventType.TEXT_MESSAGE_END);

    // Two text message lifecycles (before and after tool call)
    expect(textStarts).toHaveLength(2);
    expect(textEnds).toHaveLength(2);

    // Different message IDs for the two segments
    expect(textStarts[0].data.messageId).not.toBe(textStarts[1].data.messageId);
  });
});
