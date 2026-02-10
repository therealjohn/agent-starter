import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentQueryConfig, QueryResult, StreamEvent, StopReason } from "./types.js";
import { resolveConfig } from "./config.js";
import { createUsageTracker } from "./usage.js";
import { extractTodos, getTodoProgress, emptyProgress } from "./todos.js";
import {
  isAssistant,
  isResult,
  extractText,
  extractToolCalls,
  getContentBlocks,
  getMessageId,
  getUsage,
  getSessionId,
} from "./messages.js";

/**
 * Run a single agent query and return the complete result.
 * Use this for fire-and-forget queries where you don't need streaming.
 */
export async function runQuery(config: AgentQueryConfig): Promise<QueryResult> {
  const resolved = resolveConfig(config);
  const tracker = createUsageTracker();

  let fullText = "";
  let sessionId: string | undefined;
  let stopReason: StopReason = null;
  let latestTodos = emptyProgress();
  const allToolCalls: QueryResult["toolCalls"] = [];

  const q = query({
    prompt: resolved.prompt,
    options: {
      maxTurns: resolved.maxTurns,
      model: resolved.model,
      allowedTools: resolved.allowedTools,
      ...(resolved.cwd && { cwd: resolved.cwd }),
      ...(resolved.systemPrompt && { systemPrompt: resolved.systemPrompt }),
      ...(resolved.resumeSessionId && { resume: resolved.resumeSessionId }),
      ...(resolved.forkSession && { forkSession: resolved.forkSession }),
      ...(resolved.agents && { agents: resolved.agents }),
      ...(resolved.maxBudgetUsd && { maxBudgetUsd: resolved.maxBudgetUsd }),
    },
  });

  for await (const message of q) {
    const sid = getSessionId(message);
    if (sid) sessionId = sid;

    if (isAssistant(message)) {
      fullText += extractText(message);

      const msgId = getMessageId(message);
      if (msgId) {
        tracker.track(msgId, getUsage(message));
      }

      const blocks = getContentBlocks(message);
      const tools = extractToolCalls(message);
      allToolCalls.push(...tools);

      const todos = extractTodos(blocks);
      if (todos) {
        latestTodos = getTodoProgress(todos);
      }
    }

    if (isResult(message)) {
      const result = message as Record<string, unknown>;
      stopReason = result.stop_reason as StopReason ?? null;

      const resultUsage = result.usage as Record<string, number> | undefined;
      if (resultUsage) {
        tracker.setTotals(resultUsage);
      }
    }
  }

  return {
    text: fullText,
    sessionId,
    stopReason,
    usage: tracker.getStats(),
    todos: latestTodos,
    toolCalls: allToolCalls,
  };
}

/**
 * Stream an agent query, yielding typed events as they arrive.
 * Use this for real-time UIs that need incremental updates.
 */
export async function* streamQuery(
  config: AgentQueryConfig
): AsyncGenerator<StreamEvent> {
  const resolved = resolveConfig(config);
  const tracker = createUsageTracker();

  let fullText = "";
  let sessionId: string | undefined;
  let stopReason: StopReason = null;
  let latestTodos = emptyProgress();
  const allToolCalls: QueryResult["toolCalls"] = [];

  const q = query({
    prompt: resolved.prompt,
    options: {
      maxTurns: resolved.maxTurns,
      model: resolved.model,
      allowedTools: resolved.allowedTools,
      includePartialMessages: true,
      ...(resolved.cwd && { cwd: resolved.cwd }),
      ...(resolved.systemPrompt && { systemPrompt: resolved.systemPrompt }),
      ...(resolved.resumeSessionId && { resume: resolved.resumeSessionId }),
      ...(resolved.forkSession && { forkSession: resolved.forkSession }),
      ...(resolved.agents && { agents: resolved.agents }),
      ...(resolved.maxBudgetUsd && { maxBudgetUsd: resolved.maxBudgetUsd }),
    },
  });

  for await (const message of q) {
    const sid = getSessionId(message);
    if (sid && sid !== sessionId) {
      sessionId = sid;
      yield { type: "session", sessionId };
    }

    // Handle real-time streaming deltas from the SDK
    if (message.type === "stream_event") {
      const event = (message as Record<string, unknown>).event as Record<string, unknown> | undefined;
      if (event?.type === "content_block_delta") {
        const delta = event.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          fullText += delta.text;
          yield { type: "text_delta", text: delta.text };
        }
      }
      continue;
    }

    if (isAssistant(message)) {
      // Text already streamed via stream_event deltas above; skip re-emitting it.
      const msgId = getMessageId(message);
      if (msgId) {
        tracker.track(msgId, getUsage(message));
        yield { type: "usage", usage: tracker.getStats() };
      }

      const blocks = getContentBlocks(message);
      const tools = extractToolCalls(message);
      for (const toolCall of tools) {
        allToolCalls.push(toolCall);
        yield { type: "tool_call", toolCall };
      }

      const todos = extractTodos(blocks);
      if (todos) {
        latestTodos = getTodoProgress(todos);
        yield { type: "todo_update", todos: latestTodos };
      }
    }

    if (isResult(message)) {
      const result = message as Record<string, unknown>;
      stopReason = result.stop_reason as StopReason ?? null;

      // The result message carries authoritative total usage for the entire query
      const resultUsage = result.usage as Record<string, number> | undefined;
      if (resultUsage) {
        tracker.setTotals(resultUsage);
        yield { type: "usage", usage: tracker.getStats() };
      }
    }
  }

  yield {
    type: "done",
    result: {
      text: fullText,
      sessionId,
      stopReason,
      usage: tracker.getStats(),
      todos: latestTodos,
      toolCalls: allToolCalls,
    },
  };
}
