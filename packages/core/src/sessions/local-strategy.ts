import { mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SessionManager, SessionContext } from "../types.js";

/**
 * Local session strategy — creates a folder per session under a configurable base path.
 * Simplest option, ideal for local development.
 *
 * Each execution environment is a directory: {baseDir}/{envId}/
 * SDK session IDs are mapped to environment IDs so that resuming a
 * conversation reuses the same folder.
 */
export class LocalSessionManager implements SessionManager {
  private readonly baseDir: string;
  /** Maps SDK sessionId → envId (folder name) */
  private readonly sessionToEnv = new Map<string, string>();

  constructor(baseDir?: string) {
    this.baseDir = resolve(baseDir ?? process.env.SESSION_BASE_DIR ?? "./sessions");
  }

  async prepare(sessionId?: string): Promise<SessionContext & { envId: string }> {
    // If resuming, look up the existing environment
    const existingEnvId = sessionId ? this.sessionToEnv.get(sessionId) : undefined;
    const envId = existingEnvId ?? crypto.randomUUID();
    const sessionDir = join(this.baseDir, envId);

    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true });
    }

    return { cwd: sessionDir, envId };
  }

  mapSession(sdkSessionId: string, envId: string): void {
    this.sessionToEnv.set(sdkSessionId, envId);
  }

  async destroy(sessionId: string): Promise<void> {
    const envId = this.sessionToEnv.get(sessionId) ?? sessionId;
    const sessionDir = join(this.baseDir, envId);
    if (existsSync(sessionDir)) {
      await rm(sessionDir, { recursive: true, force: true });
    }
    this.sessionToEnv.delete(sessionId);
  }
}
