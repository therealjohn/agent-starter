import type { SessionManager, SessionContext } from "../types.js";

/**
 * Azure Dynamic Sessions strategy — delegates code execution to
 * Azure Container Apps Custom Container Sessions via REST API.
 *
 * The API container orchestrates the agent; code execution runs
 * in Hyper-V-isolated session containers managed by Azure.
 *
 * Azure Dynamic Sessions use a free-form identifier to address sessions.
 * The same identifier always routes to the same container, so we use the
 * envId as the Azure session identifier. The SDK sessionId is mapped to
 * the envId so that resuming a conversation hits the same Azure session.
 */
export class AzureSessionManager implements SessionManager {
  private readonly poolEndpoint: string;
  private readonly audience: string;
  private getToken: (() => Promise<string>) | undefined;
  /** Maps SDK sessionId → envId (Azure session identifier) */
  private readonly sessionToEnv = new Map<string, string>();

  constructor(poolEndpoint?: string, audience?: string) {
    this.poolEndpoint =
      poolEndpoint ??
      process.env.AZURE_SESSION_POOL_ENDPOINT ??
      "";
    this.audience =
      audience ??
      process.env.SESSION_POOL_AUDIENCE ??
      "https://dynamicsessions.io/.default";

    if (!this.poolEndpoint) {
      throw new Error(
        "AZURE_SESSION_POOL_ENDPOINT is required for the azure session strategy"
      );
    }
  }

  private async ensureToken(): Promise<string> {
    if (!this.getToken) {
      // @ts-expect-error — @azure/identity is an optional peer dependency
      const { DefaultAzureCredential } = await import("@azure/identity");
      const credential = new DefaultAzureCredential();
      this.getToken = async () => {
        const token = await credential.getToken(this.audience);
        return token.token;
      };
    }
    return this.getToken();
  }

  async prepare(sessionId?: string): Promise<SessionContext & { envId: string }> {
    // If resuming, look up the existing Azure session identifier
    const existingEnvId = sessionId ? this.sessionToEnv.get(sessionId) : undefined;
    const envId = existingEnvId ?? crypto.randomUUID();

    // Azure allocates the session container on first request to this identifier.
    // Subsequent requests with the same identifier reuse the same container.
    return { cwd: "/workspace", envId };
  }

  mapSession(sdkSessionId: string, envId: string): void {
    this.sessionToEnv.set(sdkSessionId, envId);
  }

  async destroy(_sessionId: string): Promise<void> {
    // Azure Dynamic Sessions are automatically cleaned up after the
    // cooldown period. No explicit destroy needed.
    this.sessionToEnv.delete(_sessionId);
  }

  /**
   * Execute code in the Azure Dynamic Session.
   * Sends a request to the session pool's execute endpoint.
   */
  async execute(
    sessionId: string,
    options: {
      code?: string;
      shellCommand?: string;
      language?: string;
      timeoutInSeconds?: number;
    }
  ): Promise<{
    status: string;
    stdout: string;
    stderr: string;
    returnCode: number;
  }> {
    const envId = this.sessionToEnv.get(sessionId) ?? sessionId;
    const token = await this.ensureToken();

    const url = `${this.poolEndpoint}/executions?api-version=2024-10-02-preview&identifier=${encodeURIComponent(envId)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        properties: {
          code: options.code,
          shellCommand: options.shellCommand,
          language: options.language ?? "bash",
          timeoutInSeconds: options.timeoutInSeconds ?? 30,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Azure Dynamic Session execution failed (${response.status}): ${errorText}`
      );
    }

    const result = (await response.json()) as {
      properties: {
        status: string;
        stdout: string;
        stderr: string;
        returnCode: number;
      };
    };

    return result.properties;
  }
}
