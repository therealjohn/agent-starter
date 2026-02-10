import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SessionManager, SessionContext, FileUpload, IngestedFile } from "../types.js";

const exec = promisify(execFile);

/**
 * Docker session strategy — spins up one Docker container per SDK session.
 * The container persists across multiple queries within the same session
 * (conversation). It is only destroyed when explicitly requested or when
 * the session ends.
 *
 * Flow:
 * 1. First query → prepare() creates a new container, returns envId
 * 2. SDK returns sessionId → mapSession(sessionId, envId) links them
 * 3. Follow-up queries with resumeSessionId → prepare(sessionId) finds
 *    the existing container and reuses it
 */
export class DockerSessionManager implements SessionManager {
  private readonly image: string;
  private readonly containers = new Map<string, { containerId: string; port: number }>();
  /** Maps SDK sessionId → envId (container key) */
  private readonly sessionToEnv = new Map<string, string>();

  constructor(image?: string) {
    this.image = image ?? process.env.DOCKER_IMAGE ?? "agent-starter-api";
  }

  async prepare(sessionId?: string): Promise<SessionContext & { envId: string }> {
    // If resuming, look up the existing container
    const existingEnvId = sessionId ? this.sessionToEnv.get(sessionId) : undefined;
    if (existingEnvId && this.containers.has(existingEnvId)) {
      return { cwd: "/workspace", envId: existingEnvId };
    }

    const envId = crypto.randomUUID();

    // Start a new container for this environment
    const { stdout: containerId } = await exec("docker", [
      "run",
      "-d",
      "--rm",
      "--name", `agent-session-${envId}`,
      "--label", `agent-session=${envId}`,
      "-w", "/workspace",
      "-e", `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY ?? ""}`,
      "-P",
      this.image,
    ]);

    const trimmedId = containerId.trim();

    // Get the mapped port
    const { stdout: portInfo } = await exec("docker", [
      "port", trimmedId, "3000",
    ]);
    const port = parseInt(portInfo.trim().split(":").pop() ?? "3000", 10);

    this.containers.set(envId, { containerId: trimmedId, port });

    return { cwd: "/workspace", envId };
  }

  mapSession(sdkSessionId: string, envId: string): void {
    this.sessionToEnv.set(sdkSessionId, envId);
  }

  async destroy(sessionId: string): Promise<void> {
    const envId = this.sessionToEnv.get(sessionId) ?? sessionId;
    const container = this.containers.get(envId);
    if (!container) return;

    try {
      await exec("docker", ["stop", container.containerId]);
    } catch {
      // Container may have already been removed (--rm flag)
    }
    this.containers.delete(envId);
    this.sessionToEnv.delete(sessionId);
  }

  /** Get the host port for a session's container */
  getPort(sessionId: string): number | undefined {
    const envId = this.sessionToEnv.get(sessionId) ?? sessionId;
    return this.containers.get(envId)?.port;
  }

  getEnvId(sessionId: string): string | undefined {
    return this.sessionToEnv.get(sessionId);
  }

  async ingestFiles(_envId: string, _files: FileUpload[]): Promise<IngestedFile[]> {
    throw new Error("File upload is not yet implemented for the docker session strategy");
  }
}
