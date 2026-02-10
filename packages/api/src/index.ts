import { serve } from "@hono/node-server";
import { app } from "./routes.js";

const port = Number(process.env.API_PORT) || 3000;

console.log(`Agent API server starting on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
