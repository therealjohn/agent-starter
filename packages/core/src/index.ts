// Types
export type {
  AgentQueryConfig,
  SubagentConfig,
  SettingSource,
  UsageStats,
  TodoItem,
  TodoProgress,
  ToolCall,
  StopReason,
  QueryResult,
  StreamEvent,
  SessionStrategy,
  SessionContext,
  SessionManager,
  FileUpload,
  IngestedFile,
} from "./types.js";

// Core query functions
export { runQuery, streamQuery } from "./run-query.js";

// Config
export { getApiKey, resolveConfig } from "./config.js";

// Session management
export {
  createSessionManager,
  LocalSessionManager,
  DockerSessionManager,
  AzureSessionManager,
} from "./sessions/index.js";

// Utilities
export { createUsageTracker } from "./usage.js";
export { extractTodos, getTodoProgress, emptyProgress } from "./todos.js";
export {
  isAssistant,
  isResult,
  extractText,
  extractToolCalls,
  getContentBlocks,
  getMessageId,
  getUsage,
  getSessionId,
} from "./messages.js";
export {
  isComplete,
  isMaxTokens,
  isRefusal,
  isToolUse,
  isStopSequence,
  stopReasonLabel,
} from "./stop-reasons.js";
