import type { SessionManager, SessionStrategy } from "../types.js";
import { LocalSessionManager } from "./local-strategy.js";
import { DockerSessionManager } from "./docker-strategy.js";
import { AzureSessionManager } from "./azure-strategy.js";

export { LocalSessionManager } from "./local-strategy.js";
export { DockerSessionManager } from "./docker-strategy.js";
export { AzureSessionManager } from "./azure-strategy.js";

let _instance: SessionManager | undefined;
let _instanceStrategy: SessionStrategy | undefined;

/**
 * Get (or create) the singleton session manager for the given strategy.
 * The manager is a singleton so it can track active sessions across
 * multiple queries — e.g., reusing a Docker container when resuming a session.
 */
export function createSessionManager(
  strategy?: SessionStrategy
): SessionManager {
  const resolved =
    strategy ??
    (process.env.SESSION_STRATEGY as SessionStrategy | undefined) ??
    "local";

  // Return existing singleton if strategy hasn't changed
  if (_instance && _instanceStrategy === resolved) {
    return _instance;
  }

  switch (resolved) {
    case "local":
      _instance = new LocalSessionManager();
      break;
    case "docker":
      _instance = new DockerSessionManager();
      break;
    case "azure":
      _instance = new AzureSessionManager();
      break;
    default:
      throw new Error(`Unknown session strategy: ${resolved}`);
  }

  _instanceStrategy = resolved;
  return _instance;
}
