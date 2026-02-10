import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";
import {
  runQuery,
  streamQuery,
  type AgentQueryConfig,
  type StreamEvent,
} from "@agent-starter/core";

export const app = new Hono();

app.use("/*", cors());

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
    const result = await runQuery(body);
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

  return streamSSE(c, async (stream) => {
    try {
      for await (const event of streamQuery(body)) {
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
