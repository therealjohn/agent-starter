import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, basename, extname } from "node:path";
import type { SessionManager, SessionContext, FileUpload, IngestedFile } from "../types.js";

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

  getEnvId(sessionId: string): string | undefined {
    return this.sessionToEnv.get(sessionId);
  }

  async ingestFiles(envId: string, files: FileUpload[]): Promise<IngestedFile[]> {
    const sessionDir = join(this.baseDir, envId);
    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true });
    }

    const results: IngestedFile[] = [];
    for (const file of files) {
      const safeName = sanitizeFilename(file.name);
      const filePath = join(sessionDir, safeName);
      await writeFile(filePath, file.content);
      results.push({ name: safeName, path: filePath, size: file.content.byteLength });
    }
    return results;
  }
}

/** Strip path separators and limit length, preserving extension */
function sanitizeFilename(name: string): string {
  const ext = extname(name);
  let base = basename(name, ext).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  if (!base) base = "file";
  return base + ext;
}
