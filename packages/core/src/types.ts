/** Configuration for an agent query */
export interface AgentQueryConfig {
  /** The prompt to send to the agent */
  prompt: string;
  /** Model to use: sonnet, opus, haiku */
  model?: "sonnet" | "opus" | "haiku";
  /** Maximum conversation turns */
  maxTurns?: number;
  /** Session ID to resume a previous conversation */
  resumeSessionId?: string;
  /** Fork from an existing session instead of continuing it */
  forkSession?: boolean;
  /** Working directory for the agent */
  cwd?: string;
  /** Tools the agent is allowed to use */
  allowedTools?: string[];
  /** Subagent definitions */
  agents?: Record<string, SubagentConfig>;
  /** System prompt override */
  systemPrompt?: string;
  /** Max budget in USD */
  maxBudgetUsd?: number;
}

/** Subagent configuration */
export interface SubagentConfig {
  name: string;
  description: string;
  /** The prompt/instructions for this subagent */
  prompt: string;
  allowedTools?: string[];
  systemPrompt?: string;
  maxTurns?: number;
}

/** Token usage stats for a single message or aggregated */
export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

/** A single todo item extracted from TodoWrite tool calls */
export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

/** Aggregated todo progress */
export interface TodoProgress {
  todos: TodoItem[];
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

/** A normalized tool call extracted from SDK messages */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Possible stop reasons from the SDK */
export type StopReason =
  | "end_turn"
  | "max_tokens"
  | "refusal"
  | "tool_use"
  | "stop_sequence"
  | null;

/** Result of a completed (non-streaming) query */
export interface QueryResult {
  text: string;
  sessionId?: string;
  stopReason: StopReason;
  usage: UsageStats;
  todos: TodoProgress;
  toolCalls: ToolCall[];
}

/** Events emitted during streaming */
export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "todo_update"; todos: TodoProgress }
  | { type: "usage"; usage: UsageStats }
  | { type: "session"; sessionId: string }
  | { type: "done"; result: QueryResult }
  | { type: "error"; error: string };
