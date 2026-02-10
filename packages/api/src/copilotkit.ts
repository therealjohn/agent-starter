/**
 * CopilotKit Runtime integration.
 *
 * Sets up a CopilotRuntime with an HttpAgent that delegates to the
 * existing AG-UI endpoint. This allows CopilotKit's frontend components
 * (CopilotChat, CopilotSidebar, etc.) to communicate with our Claude
 * Agent SDK backend through the standard CopilotKit protocol.
 */
import {
  CopilotRuntime,
  EmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";

const API_PORT = Number(process.env.API_PORT) || 3000;

// HttpAgent that delegates to the existing AG-UI endpoint on this server
const agent = new HttpAgent({
  url: `http://localhost:${API_PORT}/ag-ui`,
  agentId: "agent-starter",
  description: "AI coding assistant powered by Claude Agent SDK",
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime = new CopilotRuntime({
  agents: { "agent-starter": agent } as any,
});

const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
  runtime,
  serviceAdapter: new EmptyAdapter(),
  endpoint: "/copilotkit",
});

export { handleRequest as copilotKitHandler };
