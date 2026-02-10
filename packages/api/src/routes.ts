import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";
import {
  runQuery,
  streamQuery,
  createSessionManager,
  SessionStore,
  generateSessionTitle,
  type AgentQueryConfig,
  type StreamEvent,
  type FileUpload,
  type SessionEvent,
} from "@agent-starter/core";
import { streamQueryAsAgUi } from "./ag-ui-stream.js";
import { copilotKitHandler } from "./copilotkit.js";

export const app = new Hono();

app.use("/*", cors());

/**
 * CopilotKit runtime endpoint.
 * Accepts standard CopilotKit requests and delegates to the AG-UI agent.
 * Used by CopilotKit frontend components (CopilotChat, CopilotSidebar, etc.).
 */
app.all("/copilotkit", async (c) => {
  return copilotKitHandler(c.req.raw);
});

// Singleton session manager — lives for the lifetime of the API process.
// Tracks the mapping between SDK session IDs (conversation state) and
// execution environments (folders / containers / Azure sessions).
const sessionManager = createSessionManager();
const sessionStore = new SessionStore();

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

/** List all sessions with metadata */
app.get("/sessions", async (c) => {
  try {
    const sessions = await sessionStore.listSessions();
    return c.json({ sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

/** Get events for a specific session */
app.get("/sessions/:id/events", async (c) => {
  const id = c.req.param("id");
  try {
    const meta = await sessionStore.getSession(id);
    if (!meta) return c.json({ error: "Session not found" }, 404);
    const events = await sessionStore.getEvents(id);
    return c.json({ session: meta, events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

/** Single-turn query — returns complete result as JSON */
app.post("/query", async (c) => {
  const body = await c.req.json<AgentQueryConfig>();
  if (!body.prompt) {
    return c.json({ error: "prompt is required" }, 400);
  }

  try {
    // Prepare execution environment. If resumeSessionId is provided,
    // reuses the existing environment for that SDK session.
    const env = body.cwd
      ? { cwd: body.cwd, envId: "__explicit__" }
      : await sessionManager.prepare(body.resumeSessionId);

    const result = await runQuery({ ...body, cwd: env.cwd });

    // After first query, the SDK returns a sessionId. Map it to this
    // environment so future queries with resumeSessionId find the same
    // folder / container / Azure session.
    if (result.sessionId && env.envId !== "__explicit__") {
      sessionManager.mapSession(result.sessionId, env.envId);
    }

    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

const ALLOWED_EXTENSIONS = new Set([".txt", ".csv"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Validate and convert File objects to FileUpload structs */
async function validateFiles(fileObjects: File[]): Promise<{ uploads?: FileUpload[]; error?: string }> {
  const uploads: FileUpload[] = [];
  for (const file of fileObjects) {
    const ext = file.name.includes(".") ? `.${file.name.split(".").pop()!.toLowerCase()}` : "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return { error: `File type '${ext}' is not allowed. Supported: .txt, .csv` };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { error: `File '${file.name}' exceeds 10 MB limit` };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    uploads.push({ name: file.name, content: buffer });
  }
  return { uploads };
}

/** Parse request body as either JSON or multipart (with optional file attachments) */
async function parseStreamRequest(c: { req: { header: (name: string) => string | undefined; json: <T>() => Promise<T>; parseBody: (options?: { all: boolean }) => Promise<Record<string, string | File | (string | File)[]>> } }): Promise<{ config?: AgentQueryConfig; files?: File[]; error?: string }> {
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody({ all: true });
    const prompt = typeof body["prompt"] === "string" ? body["prompt"] : undefined;
    if (!prompt) return { error: "prompt is required" };
    const config: AgentQueryConfig = { prompt };
    if (typeof body["resumeSessionId"] === "string") config.resumeSessionId = body["resumeSessionId"];
    if (typeof body["model"] === "string") config.model = body["model"] as AgentQueryConfig["model"];

    const raw = body["files"] ?? body["files[]"];
    const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const fileObjects = entries.filter((f): f is File => f instanceof File);
    return { config, files: fileObjects.length > 0 ? fileObjects : undefined };
  }

  const config = await c.req.json<AgentQueryConfig>();
  if (!config.prompt) return { error: "prompt is required" };
  return { config };
}

/** Streaming query — returns SSE stream of typed events. Accepts JSON or multipart with file attachments. */
app.post("/stream", async (c) => {
  const { config: body, files, error: parseError } = await parseStreamRequest(c);
  if (parseError || !body) {
    return c.json({ error: parseError ?? "Invalid request" }, 400);
  }

  const env = body.cwd
    ? { cwd: body.cwd, envId: "__explicit__" }
    : await sessionManager.prepare(body.resumeSessionId);

  // Ingest attached files into the session directory
  let fileContext = "";
  if (files && files.length > 0 && env.envId !== "__explicit__") {
    const { uploads, error: fileError } = await validateFiles(files);
    if (fileError) return c.json({ error: fileError }, 400);
    const ingested = await sessionManager.ingestFiles(env.envId, uploads!);
    const names = ingested.map((f) => f.name).join(", ");
    fileContext = `\n\nThe following files have been uploaded to your working directory: ${names}`;
  }

  const queryConfig = { ...body, cwd: env.cwd, prompt: body.prompt + fileContext };
  const isResume = !!body.resumeSessionId;

  return streamSSE(c, async (stream) => {
    let currentSessionId: string | undefined = body.resumeSessionId;
    let sessionCreated = isResume;
    let fullText = "";
    const userPrompt = body.prompt;

    // Record user message event
    const recordUserMessage = async (sid: string) => {
      await sessionStore.appendEvent(sid, {
        type: "user.message",
        data: { content: userPrompt },
        timestamp: new Date().toISOString(),
      });
    };

    try {
      for await (const event of streamQuery(queryConfig)) {
        // When the SDK emits a session ID, map it to this environment
        if (event.type === "session" && env.envId !== "__explicit__") {
          sessionManager.mapSession(event.sessionId, env.envId);
          currentSessionId = event.sessionId;

          if (!sessionCreated) {
            await sessionStore.create(event.sessionId);
            sessionCreated = true;
          }
          await recordUserMessage(event.sessionId);
        }

        // Accumulate text for title generation
        if (event.type === "text_delta") {
          fullText += event.text;
        }

        // Record tool calls
        if (event.type === "tool_call" && currentSessionId) {
          sessionStore.appendEvent(currentSessionId, {
            type: "tool.call",
            data: { toolCall: event.toolCall },
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        }

        // Record completion and trigger title generation
        if (event.type === "done") {
          // The done event may carry the sessionId if it wasn't emitted earlier
          if (!currentSessionId && event.result.sessionId && env.envId !== "__explicit__") {
            currentSessionId = event.result.sessionId;
            sessionManager.mapSession(event.result.sessionId, env.envId);
            if (!sessionCreated) {
              await sessionStore.create(event.result.sessionId);
              sessionCreated = true;
            }
            await recordUserMessage(event.result.sessionId);
          }

          if (currentSessionId) {
            sessionStore.appendEvent(currentSessionId, {
              type: "assistant.message",
              data: { content: fullText },
              timestamp: new Date().toISOString(),
            }).catch(() => {});

            sessionStore.appendEvent(currentSessionId, {
              type: "session.done",
              data: { stopReason: event.result.stopReason },
              timestamp: new Date().toISOString(),
            }).catch(() => {});

            // Fire-and-forget title generation on first exchange (no existing title)
            const sid = currentSessionId;
            sessionStore.getSession(sid).then((meta) => {
              if (meta && !meta.title) {
                generateSessionTitle(userPrompt, fullText)
                  .then((title) => sessionStore.updateTitle(sid, title))
                  .catch(() => {});
              }
            }).catch(() => {});
          }
        }

        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const errorEvent: StreamEvent = { type: "error", error: message };
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify(errorEvent),
      });
    }
  });
});

/** Upload files into a session's working directory */
app.post("/sessions/:id/files", async (c) => {
  const sessionId = c.req.param("id");
  const envId = sessionManager.getEnvId(sessionId);
  if (!envId) {
    return c.json({ error: "Session not found" }, 404);
  }

  try {
    const body = await c.req.parseBody({ all: true });
    const raw = body["files"] ?? body["files[]"];
    const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const fileObjects = entries.filter((f): f is File => f instanceof File);

    if (fileObjects.length === 0) {
      return c.json({ error: "No files provided" }, 400);
    }

    const { uploads, error: fileError } = await validateFiles(fileObjects);
    if (fileError) return c.json({ error: fileError }, 400);

    const ingested = await sessionManager.ingestFiles(envId, uploads!);
    return c.json({ files: ingested });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

/** Destroy an execution environment and clean up its resources */
app.delete("/sessions/:id", async (c) => {
  const id = c.req.param("id");
  try {
    await sessionManager.destroy(id);
    return c.json({ status: "destroyed", sessionId: id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

/** Parse AG-UI request body (JSON RunAgentInput or multipart with files) */
async function parseAgUiRequest(c: { req: { header: (name: string) => string | undefined; json: <T>() => Promise<T>; parseBody: (options?: { all: boolean }) => Promise<Record<string, string | File | (string | File)[]>> } }): Promise<{ threadId?: string; runId?: string; prompt?: string; resumeSessionId?: string; files?: File[]; error?: string }> {
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody({ all: true });
    const prompt = typeof body["prompt"] === "string" ? body["prompt"] : undefined;
    if (!prompt) return { error: "prompt is required in multipart" };
    const threadId = typeof body["threadId"] === "string" ? body["threadId"] : `thread-${Date.now()}`;
    const runId = typeof body["runId"] === "string" ? body["runId"] : `run-${Date.now()}`;
    const resumeSessionId = typeof body["resumeSessionId"] === "string" ? body["resumeSessionId"] : undefined;
    const raw = body["files"] ?? body["files[]"];
    const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const fileObjects = entries.filter((f): f is File => f instanceof File);
    return { threadId, runId, prompt, resumeSessionId, files: fileObjects.length > 0 ? fileObjects : undefined };
  }

  // JSON body — AG-UI RunAgentInput format
  const body = await c.req.json<Record<string, unknown>>();
  const threadId = (body.threadId as string) ?? `thread-${Date.now()}`;
  const runId = (body.runId as string) ?? `run-${Date.now()}`;

  // Extract prompt from messages array (last user message) or forwardedProps
  const messages = body.messages as Array<{ role: string; content: string }> | undefined;
  const lastUserMsg = messages?.filter((m) => m.role === "user").pop();
  const prompt = lastUserMsg?.content;
  if (!prompt) return { error: "No user message found in messages array" };

  // resumeSessionId can come from forwardedProps or from threadId if it looks like an SDK session
  const forwarded = body.forwardedProps as Record<string, unknown> | undefined;
  const resumeSessionId = (forwarded?.resumeSessionId as string) ?? undefined;

  return { threadId, runId, prompt, resumeSessionId };
}

/**
 * AG-UI protocol endpoint.
 * Accepts RunAgentInput (or multipart), responds with AG-UI SSE event stream.
 * Compatible with any AG-UI client (HttpAgent, CopilotKit, etc.).
 */
app.post("/ag-ui", async (c) => {
  const { threadId, runId, prompt, resumeSessionId, files, error: parseError } = await parseAgUiRequest(c);
  if (parseError || !prompt || !threadId || !runId) {
    return c.json({ error: parseError ?? "Invalid request" }, 400);
  }

  const env = await sessionManager.prepare(resumeSessionId);

  // Ingest attached files into the session directory
  let fileContext = "";
  if (files && files.length > 0) {
    const { uploads, error: fileError } = await validateFiles(files);
    if (fileError) return c.json({ error: fileError }, 400);
    const ingested = await sessionManager.ingestFiles(env.envId, uploads!);
    const names = ingested.map((f) => f.name).join(", ");
    fileContext = `\n\nThe following files have been uploaded to your working directory: ${names}`;
  }

  const queryConfig: AgentQueryConfig = {
    prompt: prompt + fileContext,
    cwd: env.cwd,
    ...(resumeSessionId && { resumeSessionId }),
  };

  const isResume = !!resumeSessionId;

  return streamSSE(c, async (stream) => {
    let currentSessionId: string | undefined = resumeSessionId;
    let sessionCreated = isResume;
    let fullText = "";
    const userPrompt = prompt;

    const recordUserMessage = async (sid: string) => {
      await sessionStore.appendEvent(sid, {
        type: "user.message",
        data: { content: userPrompt },
        timestamp: new Date().toISOString(),
      });
    };

    try {
      for await (const sseEvent of streamQueryAsAgUi(queryConfig, threadId, runId)) {
        // Parse the event data for session tracking
        const eventData = JSON.parse(sseEvent.data);

        // Track session from CUSTOM session events
        if (eventData.type === "CUSTOM" && eventData.name === "session") {
          const sid = eventData.value?.sessionId;
          if (sid) {
            sessionManager.mapSession(sid, env.envId);
            currentSessionId = sid;
            if (!sessionCreated) {
              await sessionStore.create(sid);
              sessionCreated = true;
            }
            await recordUserMessage(sid);
          }
        }

        // Accumulate text for title generation
        if (eventData.type === "TEXT_MESSAGE_CONTENT") {
          fullText += eventData.delta ?? "";
        }

        // Track tool calls
        if (eventData.type === "TOOL_CALL_START" && currentSessionId) {
          sessionStore.appendEvent(currentSessionId, {
            type: "tool.call",
            data: { toolCall: { id: eventData.toolCallId, name: eventData.toolCallName, input: {} } },
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        }

        // Handle completion
        if (eventData.type === "CUSTOM" && eventData.name === "done_result") {
          const result = eventData.value;
          if (!currentSessionId && result?.sessionId) {
            currentSessionId = result.sessionId;
            sessionManager.mapSession(result.sessionId, env.envId);
            if (!sessionCreated) {
              await sessionStore.create(result.sessionId);
              sessionCreated = true;
            }
            await recordUserMessage(result.sessionId);
          }

          if (currentSessionId) {
            sessionStore.appendEvent(currentSessionId, {
              type: "assistant.message",
              data: { content: fullText },
              timestamp: new Date().toISOString(),
            }).catch(() => {});

            sessionStore.appendEvent(currentSessionId, {
              type: "session.done",
              data: { stopReason: result?.stopReason },
              timestamp: new Date().toISOString(),
            }).catch(() => {});

            // Fire-and-forget title generation
            const sid = currentSessionId;
            sessionStore.getSession(sid).then((meta) => {
              if (meta && !meta.title) {
                generateSessionTitle(userPrompt, fullText)
                  .then((title) => sessionStore.updateTitle(sid, title))
                  .catch(() => {});
              }
            }).catch(() => {});
          }
        }

        await stream.writeSSE({
          event: sseEvent.event,
          data: sseEvent.data,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await stream.writeSSE({
        event: "RUN_ERROR",
        data: JSON.stringify({ type: "RUN_ERROR", message, timestamp: Date.now() }),
      });
    }
  });
});
