import type { StopReason } from "./types.js";

/** The agent finished normally (completed its response) */
export function isComplete(reason: StopReason): boolean {
  return reason === "end_turn";
}

/** The agent was cut off by the token limit */
export function isMaxTokens(reason: StopReason): boolean {
  return reason === "max_tokens";
}

/** The agent refused to respond */
export function isRefusal(reason: StopReason): boolean {
  return reason === "refusal";
}

/** The agent stopped to invoke a tool */
export function isToolUse(reason: StopReason): boolean {
  return reason === "tool_use";
}

/** The agent hit a configured stop sequence */
export function isStopSequence(reason: StopReason): boolean {
  return reason === "stop_sequence";
}

/** Human-readable label for a stop reason */
export function stopReasonLabel(reason: StopReason): string {
  switch (reason) {
    case "end_turn":
      return "Completed";
    case "max_tokens":
      return "Token limit reached";
    case "refusal":
      return "Refused";
    case "tool_use":
      return "Tool invocation";
    case "stop_sequence":
      return "Stop sequence";
    default:
      return "Unknown";
  }
}
