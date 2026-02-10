import type { ToolCall } from "./types.js";

// SDK message shape (we use `any` to avoid coupling to SDK internals)
type SDKMessage = Record<string, unknown>;

/** Check if a message is an assistant message */
export function isAssistant(message: SDKMessage): boolean {
  return message.type === "assistant";
}

/** Check if a message is a result message */
export function isResult(message: SDKMessage): boolean {
  return message.type === "result";
}

/** Extract all text content from an assistant message's content blocks */
export function extractText(message: SDKMessage): string {
  const msg = message.message as { content?: Array<Record<string, unknown>> } | undefined;
  if (!msg?.content) return "";

  return msg.content
    .filter((block) => block.type === "text")
    .map((block) => block.text as string)
    .join("");
}

/** Extract tool calls from an assistant message's content blocks */
export function extractToolCalls(message: SDKMessage): ToolCall[] {
  const msg = message.message as { content?: Array<Record<string, unknown>> } | undefined;
  if (!msg?.content) return [];

  return msg.content
    .filter((block) => block.type === "tool_use")
    .map((block) => ({
      id: block.id as string,
      name: block.name as string,
      input: (block.input as Record<string, unknown>) ?? {},
    }));
}

/** Get content blocks array from an SDK message */
export function getContentBlocks(
  message: SDKMessage
): Array<Record<string, unknown>> {
  const msg = message.message as { content?: Array<Record<string, unknown>> } | undefined;
  return msg?.content ?? [];
}

/** Get the message ID from an SDK assistant message */
export function getMessageId(message: SDKMessage): string | undefined {
  const msg = message.message as { id?: string } | undefined;
  return msg?.id;
}

/** Get usage data from an SDK assistant message */
export function getUsage(
  message: SDKMessage
): Record<string, number> | undefined {
  const msg = message.message as { usage?: Record<string, number> } | undefined;
  return msg?.usage;
}

/** Get the session ID from any SDK message */
export function getSessionId(message: SDKMessage): string | undefined {
  return message.sessionId as string | undefined;
}
