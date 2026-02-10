import { readFile, writeFile, mkdir, readdir, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/** Metadata stored in workspace.yaml for each session */
export interface SessionMetadata {
  id: string;
  title: string;
  status: "active" | "completed";
  createdAt: string;
  updatedAt: string;
}

/** A single event recorded in events.jsonl */
export interface SessionEvent {
  type: "user.message" | "assistant.message" | "tool.call" | "session.done";
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Persists session metadata (workspace.yaml) and conversation events (events.jsonl)
 * in per-session directories, mirroring the Copilot CLI session-state pattern.
 */
export class SessionStore {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = resolve(
      baseDir ?? process.env.SESSION_BASE_DIR ?? "./sessions"
    );
  }

  /** Create a new session directory with initial workspace.yaml */
  async create(id: string): Promise<SessionMetadata> {
    const dir = this.sessionDir(id);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const now = new Date().toISOString();
    const meta: SessionMetadata = {
      id,
      title: "",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await this.writeWorkspace(id, meta);
    return meta;
  }

  /** Update the title for a session */
  async updateTitle(id: string, title: string): Promise<void> {
    const meta = await this.getSession(id);
    if (!meta) return;
    meta.title = title;
    meta.updatedAt = new Date().toISOString();
    await this.writeWorkspace(id, meta);
  }

  /** Update the status for a session */
  async updateStatus(
    id: string,
    status: SessionMetadata["status"]
  ): Promise<void> {
    const meta = await this.getSession(id);
    if (!meta) return;
    meta.status = status;
    meta.updatedAt = new Date().toISOString();
    await this.writeWorkspace(id, meta);
  }

  /** Append an event to the session's events.jsonl */
  async appendEvent(id: string, event: SessionEvent): Promise<void> {
    const dir = this.sessionDir(id);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const line = JSON.stringify(event) + "\n";
    await appendFile(join(dir, "events.jsonl"), line, "utf-8");

    // Touch updatedAt in workspace
    const meta = await this.getSession(id);
    if (meta) {
      meta.updatedAt = new Date().toISOString();
      await this.writeWorkspace(id, meta);
    }
  }

  /** List all sessions, sorted by updatedAt descending */
  async listSessions(): Promise<SessionMetadata[]> {
    if (!existsSync(this.baseDir)) return [];

    const entries = await readdir(this.baseDir, { withFileTypes: true });
    const sessions: SessionMetadata[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const meta = await this.getSession(entry.name);
      if (meta) sessions.push(meta);
    }

    return sessions.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /** Read workspace.yaml for a session */
  async getSession(id: string): Promise<SessionMetadata | null> {
    const file = join(this.sessionDir(id), "workspace.yaml");
    if (!existsSync(file)) return null;

    const raw = await readFile(file, "utf-8");
    return parseWorkspace(raw);
  }

  /** Read all events from events.jsonl */
  async getEvents(id: string): Promise<SessionEvent[]> {
    const file = join(this.sessionDir(id), "events.jsonl");
    if (!existsSync(file)) return [];

    const raw = await readFile(file, "utf-8");
    return raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as SessionEvent);
  }

  private sessionDir(id: string): string {
    return join(this.baseDir, id);
  }

  private async writeWorkspace(
    id: string,
    meta: SessionMetadata
  ): Promise<void> {
    const yaml = serializeWorkspace(meta);
    await writeFile(join(this.sessionDir(id), "workspace.yaml"), yaml, "utf-8");
  }
}

/** Serialize SessionMetadata to a simple YAML format */
function serializeWorkspace(meta: SessionMetadata): string {
  return [
    `id: ${meta.id}`,
    `title: ${meta.title}`,
    `status: ${meta.status}`,
    `created_at: ${meta.createdAt}`,
    `updated_at: ${meta.updatedAt}`,
    "",
  ].join("\n");
}

/** Parse workspace.yaml into SessionMetadata */
function parseWorkspace(raw: string): SessionMetadata | null {
  const lines = raw.split("\n");
  const map = new Map<string, string>();
  for (const line of lines) {
    const idx = line.indexOf(": ");
    if (idx === -1) continue;
    map.set(line.slice(0, idx).trim(), line.slice(idx + 2).trim());
  }

  const id = map.get("id");
  if (!id) return null;

  return {
    id,
    title: map.get("title") ?? "",
    status: (map.get("status") as SessionMetadata["status"]) ?? "active",
    createdAt: map.get("created_at") ?? new Date().toISOString(),
    updatedAt: map.get("updated_at") ?? new Date().toISOString(),
  };
}
