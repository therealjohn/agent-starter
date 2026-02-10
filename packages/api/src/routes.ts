import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";
import {
  runQuery,
  streamQuery,
  createSessionManager,
  type AgentQueryConfig,
  type StreamEvent,
} from "@agent-starter/core";

export const app = new Hono();

app.use("/*", cors());

// Singleton session manager — lives for the lifetime of the API process.
// Tracks the mapping between SDK session IDs (conversation state) and
// execution environments (folders / containers / Azure sessions).
const sessionManager = createSessionManager();

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
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

/** Streaming query — returns SSE stream of typed events */
app.post("/stream", async (c) => {
  const body = await c.req.json<AgentQueryConfig>();
  if (!body.prompt) {
    return c.json({ error: "prompt is required" }, 400);
  }

  const env = body.cwd
    ? { cwd: body.cwd, envId: "__explicit__" }
    : await sessionManager.prepare(body.resumeSessionId);

  return streamSSE(c, async (stream) => {
    try {
      for await (const event of streamQuery({ ...body, cwd: env.cwd })) {
        // When the SDK emits a session ID, map it to this environment
        if (event.type === "session" && env.envId !== "__explicit__") {
          sessionManager.mapSession(event.sessionId, env.envId);
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
