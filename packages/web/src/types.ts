/** Token usage stats */
export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

/** A single todo item */
export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

/** Todo progress */
export interface TodoProgress {
  todos: TodoItem[];
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

/** A tool call */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** A chat message in the UI */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  todos?: TodoProgress;
  usage?: UsageStats;
  isStreaming?: boolean;
  /** Filenames attached to this message (user messages only) */
  attachments?: string[];
}

/** Events received from SSE stream */
export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "todo_update"; todos: TodoProgress }
  | { type: "usage"; usage: UsageStats }
  | { type: "session"; sessionId: string }
  | { type: "done"; result: QueryResult }
  | { type: "error"; error: string };

/** Complete query result */
export interface QueryResult {
  text: string;
  sessionId?: string;
  stopReason: string | null;
  usage: UsageStats;
  todos: TodoProgress;
  toolCalls: ToolCall[];
}
