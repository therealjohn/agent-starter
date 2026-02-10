import { describe, it, expect } from "vitest";
import {
  isAssistant,
  isResult,
  extractText,
  extractToolCalls,
  getContentBlocks,
  getMessageId,
  getUsage,
  getSessionId,
} from "../messages.js";

const makeAssistantMsg = (content: Array<Record<string, unknown>>, overrides: Record<string, unknown> = {}) => ({
  type: "assistant",
  message: {
    id: "msg-123",
    content,
    usage: { input_tokens: 10, output_tokens: 5 },
    ...overrides,
  },
  sessionId: "session-abc",
});

describe("isAssistant", () => {
  it("returns true for assistant messages", () => {
    expect(isAssistant({ type: "assistant" })).toBe(true);
  });
  it("returns false for other types", () => {
    expect(isAssistant({ type: "result" })).toBe(false);
    expect(isAssistant({ type: "system" })).toBe(false);
  });
});

describe("isResult", () => {
  it("returns true for result messages", () => {
    expect(isResult({ type: "result" })).toBe(true);
  });
  it("returns false for other types", () => {
    expect(isResult({ type: "assistant" })).toBe(false);
  });
});

describe("extractText", () => {
  it("extracts text from content blocks", () => {
    const msg = makeAssistantMsg([
      { type: "text", text: "Hello " },
      { type: "text", text: "world" },
    ]);
    expect(extractText(msg)).toBe("Hello world");
  });

  it("ignores non-text blocks", () => {
    const msg = makeAssistantMsg([
      { type: "text", text: "Hello" },
      { type: "tool_use", name: "Bash", id: "t1", input: {} },
    ]);
    expect(extractText(msg)).toBe("Hello");
  });

  it("returns empty string for no content", () => {
    expect(extractText({ type: "assistant" })).toBe("");
    expect(extractText({ type: "assistant", message: {} })).toBe("");
  });
});

describe("extractToolCalls", () => {
  it("extracts tool calls", () => {
    const msg = makeAssistantMsg([
      { type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } },
      { type: "text", text: "Hello" },
      { type: "tool_use", id: "t2", name: "Read", input: { file_path: "test.ts" } },
    ]);

    const tools = extractToolCalls(msg);
    expect(tools).toHaveLength(2);
    expect(tools[0]).toEqual({ id: "t1", name: "Bash", input: { command: "ls" } });
    expect(tools[1]).toEqual({ id: "t2", name: "Read", input: { file_path: "test.ts" } });
  });

  it("returns empty array when no tool calls", () => {
    const msg = makeAssistantMsg([{ type: "text", text: "Hello" }]);
    expect(extractToolCalls(msg)).toEqual([]);
  });
});

describe("getContentBlocks", () => {
  it("returns content blocks array", () => {
    const blocks = [{ type: "text", text: "Hello" }];
    const msg = makeAssistantMsg(blocks);
    expect(getContentBlocks(msg)).toEqual(blocks);
  });

  it("returns empty array for missing content", () => {
    expect(getContentBlocks({ type: "assistant" })).toEqual([]);
  });
});

describe("getMessageId", () => {
  it("returns message id", () => {
    const msg = makeAssistantMsg([]);
    expect(getMessageId(msg)).toBe("msg-123");
  });

  it("returns undefined for missing id", () => {
    expect(getMessageId({ type: "assistant" })).toBeUndefined();
  });
});

describe("getUsage", () => {
  it("returns usage data", () => {
    const msg = makeAssistantMsg([]);
    expect(getUsage(msg)).toEqual({ input_tokens: 10, output_tokens: 5 });
  });
});

describe("getSessionId", () => {
  it("returns session id", () => {
    const msg = makeAssistantMsg([]);
    expect(getSessionId(msg)).toBe("session-abc");
  });

  it("returns undefined when missing", () => {
    expect(getSessionId({ type: "assistant" })).toBeUndefined();
  });
});
