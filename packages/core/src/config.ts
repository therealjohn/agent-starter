import type { AgentQueryConfig } from "./types.js";

const DEFAULT_MODEL = "sonnet" as const;
const DEFAULT_MAX_TURNS = 100;
const DEFAULT_ALLOWED_TOOLS = [
  "Task",
  "Bash",
  "Glob",
  "Grep",
  "LS",
  "Read",
  "Edit",
  "MultiEdit",
  "Write",
  "WebFetch",
  "TodoWrite",
  "WebSearch",
  "NotebookEdit",
  "BashOutput",
  "KillBash",
];

/** Load and validate the API key from environment */
export function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required. Set it in your .env file or environment."
    );
  }
  return key;
}

/** Resolve a query config with defaults applied */
export function resolveConfig(
  config: AgentQueryConfig
): Required<
  Pick<AgentQueryConfig, "prompt" | "model" | "maxTurns" | "allowedTools">
> &
  AgentQueryConfig {
  return {
    ...config,
    model: config.model ?? (process.env.AGENT_MODEL as AgentQueryConfig["model"]) ?? DEFAULT_MODEL,
    maxTurns: config.maxTurns ?? (Number(process.env.AGENT_MAX_TURNS) || DEFAULT_MAX_TURNS),
    allowedTools: config.allowedTools ?? DEFAULT_ALLOWED_TOOLS,
    settingSources: config.settingSources,
  };
}
