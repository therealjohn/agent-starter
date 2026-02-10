/** Session isolation strategy */
export type SessionStrategy = "local" | "docker" | "azure";

/** Result of preparing an execution environment */
export interface SessionContext {
  /** Working directory for the agent's tools (Bash, Write, Edit, etc.) */
  cwd: string;
}

/**
 * Manages execution environments for agent sessions.
 *
 * Terminology:
 * - "SDK session" = conversation state managed by the Claude Agent SDK,
 *   identified by a sessionId returned from query(). Handles message
 *   history, context, and resume/fork.
 * - "Execution environment" = the isolated working directory or container
 *   where the agent's tools (Bash, Write, Edit) operate. This is what
 *   the SessionManager controls.
 *
 * The mapping works like this:
 * 1. First query: client has no sessionId yet. Call prepare() with no args
 *    to create a new environment. It returns a cwd and an internal
 *    environment ID.
 * 2. The SDK returns a sessionId in its response.
 * 3. Call mapSession(sdkSessionId, envId) to associate the SDK session
 *    with the environment.
 * 4. Follow-up queries: client sends resumeSessionId (the SDK sessionId).
 *    Call prepare(resumeSessionId) which looks up and reuses the existing
 *    environment — same folder, same container.
 */
export interface SessionManager {
  /** Prepare an execution environment. Reuses existing if sessionId is known. */
  prepare(sessionId?: string): Promise<SessionContext & { envId: string }>;
  /** Associate an SDK sessionId with an existing environment */
  mapSession(sdkSessionId: string, envId: string): void;
  /** Destroy an environment and clean up its resources */
  destroy(sessionId: string): Promise<void>;
  /** Look up the environment ID for a given SDK sessionId */
  getEnvId(sessionId: string): string | undefined;
  /** Ingest files into the session's working directory. Returns resolved file metadata. */
  ingestFiles(envId: string, files: FileUpload[]): Promise<IngestedFile[]>;
}

/** A file to be ingested into a session's working directory */
export interface FileUpload {
  /** Original filename (will be sanitized) */
  name: string;
  /** File content as a Buffer */
  content: Buffer;
}

/** Result of ingesting a file into a session */
export interface IngestedFile {
  /** Sanitized filename */
  name: string;
  /** Absolute path to the file in the session's working directory */
  path: string;
  /** File size in bytes */
  size: number;
}

/** Setting source for loading filesystem-based settings and skills */
export type SettingSource = "user" | "project" | "local";

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
  /**
   * Control which filesystem settings to load.
   * Include `'project'` to load skills from `.claude/skills/` in the cwd.
   * When omitted, no filesystem settings are loaded (SDK isolation mode).
   */
  settingSources?: SettingSource[];
}

/** Subagent configuration — mirrors the SDK's AgentDefinition type */
export interface SubagentConfig {
  /** Natural language description of when to use this agent */
  description: string;
  /** The agent's system prompt / instructions (required by the SDK) */
  prompt: string;
  /** Array of allowed tool names. If omitted, inherits all tools from parent */
  tools?: string[];
  /** Array of tool names to explicitly disallow for this agent */
  disallowedTools?: string[];
  /** Model to use for this agent. If omitted or 'inherit', uses the main model */
  model?: "sonnet" | "opus" | "haiku" | "inherit";
  /** Maximum number of agentic turns before stopping */
  maxTurns?: number;
  /** Skill names to preload into this subagent's context */
  skills?: string[];
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
