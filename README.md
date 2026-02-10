# Agent Starter

A production-ready monorepo for building AI agent systems with the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview). The core package handles all SDK boilerplate — streaming, sessions, cost tracking, todo tracking, stop reasons, and subagents — so you can focus on your domain logic. Thin surface packages (API server, web app) consume the core without reimplementing anything.

## Architecture

```
@agent-starter/core    ← All agent logic lives here
       ↑
       ├── @agent-starter/api   ← REST/SSE HTTP surface (Hono)
       └── @agent-starter/web   ← React chat UI (Vite + shadcn/ui)
```

The core package exports two main functions:

- **`runQuery(config)`** — runs a complete agent query and returns a typed `QueryResult` with text, usage stats, todos, tool calls, and stop reason
- **`streamQuery(config)`** — an async generator that yields typed `StreamEvent`s as the agent works (text deltas, tool calls, todo updates, usage)

Every surface package (API, web, CLI, etc.) just calls these functions and maps results to its transport. No SDK imports outside of core.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [pnpm](https://pnpm.io/) 9 or later
- An [Anthropic API key](https://console.anthropic.com/)

## Getting started

Clone the repo, install dependencies, and set your API key:

```bash
git clone <your-repo-url> agent-starter
cd agent-starter
pnpm install
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY
```

### Run the API server

```bash
pnpm dev:api
# Server starts on http://localhost:3000
```

### Run the web app

```bash
pnpm dev:web
# Opens http://localhost:5173 with API proxy to :3000
```

### Run tests

```bash
pnpm test
```

## Project structure

```
packages/
├── core/           # @agent-starter/core — agent logic + utilities
│   └── src/
│       ├── run-query.ts      # runQuery() and streamQuery()
│       ├── types.ts          # Shared TypeScript types
│       ├── config.ts         # Environment + defaults
│       ├── sessions/         # Session isolation strategies
│       │   ├── index.ts      # Strategy factory
│       │   ├── local-strategy.ts    # Folder-per-session
│       │   ├── docker-strategy.ts   # Ephemeral Docker containers
│       │   └── azure-strategy.ts    # Azure Dynamic Sessions
│       ├── usage.ts          # Token tracking (deduplicates by message ID)
│       ├── todos.ts          # TodoWrite event parsing
│       ├── stop-reasons.ts   # Stop reason classification helpers
│       ├── messages.ts       # SDK message extraction utilities
│       └── index.ts          # Barrel export
├── api/            # @agent-starter/api — REST + SSE server
│   └── src/
│       ├── routes.ts         # POST /query, POST /stream, GET /health
│       └── index.ts          # Hono server entry
└── web/            # @agent-starter/web — React chat UI
    └── src/
        ├── hooks/use-chat.ts           # SSE streaming hook
        └── components/chat/            # Chat UI components

session-container/  # Custom container for Azure Dynamic Sessions
├── Dockerfile
└── server.js       # HTTP execution server

infra/              # Azure infrastructure (Bicep)
├── main.bicep
├── resources.bicep
└── main.parameters.json

azure.yaml          # Azure Developer CLI template
scripts/            # Helper scripts for local development
```

## API endpoints

The API server exposes three endpoints:

### `GET /health`

Returns server status.

### `POST /query`

Runs a single agent query and returns the complete result as JSON.

```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What files are in the current directory?"}'
```

**Response:**

```json
{
  "text": "The current directory contains...",
  "sessionId": "abc-123",
  "stopReason": "end_turn",
  "usage": {
    "inputTokens": 1500,
    "outputTokens": 200,
    "cacheReadInputTokens": 0,
    "cacheCreationInputTokens": 0
  },
  "todos": { "todos": [], "total": 0, "completed": 0, "inProgress": 0, "pending": 0 },
  "toolCalls": [{ "id": "t1", "name": "Bash", "input": { "command": "ls" } }]
}
```

### `POST /stream`

Streams agent events as SSE. Each event has an `event` field (`text_delta`, `tool_call`, `todo_update`, `usage`, `session`, `done`, `error`) and a JSON `data` payload.

```bash
curl -X POST http://localhost:3000/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain this codebase"}'
```

### Request body

All endpoints accept `AgentQueryConfig`:

| Field | Type | Description |
|-------|------|-------------|
| `prompt` | `string` | **Required.** The prompt to send. |
| `model` | `"sonnet" \| "opus" \| "haiku"` | Model to use. Defaults to `sonnet`. |
| `maxTurns` | `number` | Maximum conversation turns. Defaults to `100`. |
| `resumeSessionId` | `string` | Session ID to resume a previous conversation. |
| `forkSession` | `boolean` | Fork from an existing session instead of continuing it. |
| `cwd` | `string` | Working directory for the agent. |
| `allowedTools` | `string[]` | Tools the agent can use. |
| `agents` | `Record<string, SubagentConfig>` | Subagent definitions. |
| `systemPrompt` | `string` | System prompt override. |
| `maxBudgetUsd` | `number` | Maximum budget in USD. |

## Customization guide

### Add a subagent

Define subagents in the `agents` field of your query config. The SDK's main agent decides when to delegate based on the `description` you provide:

```typescript
import { runQuery } from "@agent-starter/core";

const result = await runQuery({
  prompt: "Review this PR and run the tests",
  agents: {
    "code-reviewer": {
      name: "code-reviewer",
      description: "Reviews code for quality and style issues",
      allowedTools: ["Read", "Grep", "Glob"],
      systemPrompt: "You are a code review expert. Focus on bugs and style.",
    },
    "test-runner": {
      name: "test-runner",
      description: "Runs test suites and reports results",
      allowedTools: ["Bash"],
      systemPrompt: "Run the project test suite and report results.",
    },
  },
});
```

### Resume a session

Pass a `resumeSessionId` to continue a conversation:

```typescript
// First query
const result1 = await runQuery({ prompt: "What files are here?" });
const sessionId = result1.sessionId;

// Continue the conversation
const result2 = await runQuery({
  prompt: "Now explain the main entry point",
  resumeSessionId: sessionId,
});
```

### Track costs

Every `QueryResult` and streaming `usage` event includes token counts. The core package deduplicates by message ID automatically (the SDK emits the same usage for multiple content blocks in a single turn):

```typescript
import { streamQuery } from "@agent-starter/core";

for await (const event of streamQuery({ prompt: "..." })) {
  if (event.type === "usage") {
    console.log(`Tokens so far: ${event.usage.inputTokens + event.usage.outputTokens}`);
  }
  if (event.type === "done") {
    console.log("Final usage:", event.result.usage);
  }
}
```

### Handle stop reasons

Use the stop reason helpers to classify why the agent stopped:

```typescript
import { runQuery, isComplete, isRefusal, isMaxTokens, stopReasonLabel } from "@agent-starter/core";

const result = await runQuery({ prompt: "..." });

if (isComplete(result.stopReason)) {
  console.log("Agent finished normally");
} else if (isRefusal(result.stopReason)) {
  console.log("Agent refused the request");
} else if (isMaxTokens(result.stopReason)) {
  console.log("Hit token limit — consider resuming");
}

console.log(stopReasonLabel(result.stopReason)); // "Completed", "Refused", etc.
```

### Monitor todo progress

The agent creates todos automatically for complex multi-step tasks. Track them in streaming mode:

```typescript
import { streamQuery } from "@agent-starter/core";

for await (const event of streamQuery({ prompt: "Refactor the auth module" })) {
  if (event.type === "todo_update") {
    const { completed, total } = event.todos;
    console.log(`Progress: ${completed}/${total}`);
    for (const todo of event.todos.todos) {
      const icon = todo.status === "completed" ? "✅" : todo.status === "in_progress" ? "🔧" : "⬜";
      console.log(`  ${icon} ${todo.content}`);
    }
  }
}
```

### Add a new surface (for example, CLI)

Create a new package that imports from `@agent-starter/core`:

```typescript
// packages/cli/src/index.ts
import { streamQuery } from "@agent-starter/core";
import * as readline from "readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Prompt: ", async (prompt) => {
  for await (const event of streamQuery({ prompt })) {
    if (event.type === "text_delta") {
      process.stdout.write(event.text);
    }
  }
  rl.close();
});
```

## Session isolation

Each agent session needs its own working directory so file operations don't collide. The `SESSION_STRATEGY` environment variable controls how sessions are isolated. It defaults to `local`.

### Local strategy (default)

The local strategy creates a folder per session under a configurable base path. This is the simplest option and works well for local development.

```bash
# Default — sessions stored in ./sessions/{sessionId}/
SESSION_STRATEGY=local

# Optional — customize the base directory
SESSION_BASE_DIR=./my-sessions

# Optional — auto-delete session directories after each query
SESSION_CLEANUP=true
```

No additional setup is required. The directory is created automatically when a session starts.

### Docker strategy

The Docker strategy runs each session inside an ephemeral Docker container with an isolated filesystem. The main API stays as the orchestrator and proxies SDK calls into per-session containers.

```bash
SESSION_STRATEGY=docker

# Optional — specify the Docker image to use
DOCKER_IMAGE=agent-starter-api
```

Build the Docker image first:

```bash
pnpm build
docker build -f packages/api/Dockerfile -t agent-starter-api .
```

### Azure strategy

The Azure strategy delegates code execution to [Azure Container Apps Dynamic Sessions](https://learn.microsoft.com/en-us/azure/container-apps/sessions) using custom containers. The API runs in a standard Container App and sends execution requests to Hyper-V-isolated session containers via REST.

```bash
SESSION_STRATEGY=azure
AZURE_SESSION_POOL_ENDPOINT=https://<region>.dynamicsessions.io/subscriptions/...
AZURE_CLIENT_ID=<managed-identity-client-id>
```

See [Azure deployment](#azure-deployment) for full setup instructions.

## Hosting

The Claude Agent SDK spawns Claude Code as a subprocess, so each instance needs:

- **Isolation**: one container per session (Docker, Fly Machines, Modal, etc.)
- **Resources**: 1 GiB RAM, 5 GiB disk, 1 CPU minimum
- **Network**: outbound HTTPS to the Anthropic API
- **Node.js**: version 18 or later

A `Dockerfile` is included in `packages/api/`. Build and run:

```bash
# Build all packages first
pnpm build

# Build and run the Docker image
docker build -f packages/api/Dockerfile -t agent-starter-api .
docker run -e ANTHROPIC_API_KEY=your_key -p 3000:3000 agent-starter-api
```

For production deployments, spin up an ephemeral container per user session and destroy it when the session ends.

## Azure deployment

This project includes a full [Azure Developer CLI (azd)](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/) template for deploying to Azure Container Apps with Dynamic Sessions for isolated code execution.

```
                ┌─────────────────────────┐
                │    User/Client          │
                └───────────┬─────────────┘
                            │ HTTPS
                            ▼
        ┌───────────────────────────────────────┐
        │  Azure Container App                  │
        │  (agent-starter-api)                  │
        │  ┌─────────────────────────────────┐  │
        │  │ Hono API + Claude Agent SDK     │  │
        │  │ SESSION_STRATEGY=azure          │  │
        │  └─────────────────────────────────┘  │
        └───────┬──────────────────┬────────────┘
                │                  │
    Anthropic   │                  │ Managed Identity
    API Key     │                  │
                ▼                  ▼
┌──────────────────────┐  ┌─────────────────────────────┐
│  Anthropic API       │  │  Dynamic Session Pool       │
│  (Claude)            │  │  (Custom Containers)        │
└──────────────────────┘  │  ┌───────────────────────┐  │
                          │  │ Session Container     │  │
                          │  │ Node.js 22            │  │
                          │  │ Hyper-V isolated      │  │
                          │  └───────────────────────┘  │
                          └─────────────────────────────┘
                                      │ Pulls from
                                      ▼
                          ┌──────────────────────────────┐
                          │  Azure Container Registry    │
                          └──────────────────────────────┘
```

### Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- [Azure Developer CLI (azd)](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd) installed
- An Azure subscription
- An Anthropic API key

### Deploy to Azure

The deployment uses a two-step process because the Dynamic Session Pool requires the custom container image to exist in Azure Container Registry before it can be created.

1. Log in to Azure:

```bash
azd auth login
```

2. Create a new environment and set your API key:

```bash
azd env new my-agent
azd env set ANTHROPIC_API_KEY <your-anthropic-api-key>
```

3. Run the first provision (creates ACR, builds session container image):

```bash
azd provision
```

4. Deploy everything (creates session pool + deploys the API):

```bash
azd up
```

After the initial setup, subsequent deployments only need `azd up`.

### Run locally with Azure backend

You can run the API server locally while using Azure Dynamic Sessions for code execution:

```bash
# Load azd environment variables
# Windows (PowerShell):
./scripts/load-env.ps1

# Linux/macOS:
source ./scripts/load-env.sh

# Start the API server
pnpm dev:api
```

### Tear down

Remove all Azure resources:

```bash
azd down
```

### Azure resources provisioned

| Resource | Purpose |
|----------|---------|
| Container Apps Environment | Hosts the API container app |
| Container App | Runs agent-starter-api with `SESSION_STRATEGY=azure` |
| Container Registry | Stores the session executor container image |
| Dynamic Session Pool | Manages Hyper-V-isolated session containers |
| User-Assigned Managed Identity | Authenticates between services (ACR pull, session execution) |
| Log Analytics Workspace | Centralized logging and monitoring |

## Technology choices

| Choice | Why |
|--------|-----|
| **SSE** (not WebSocket) | LLM streaming is server-to-client only. SSE is simpler, has native browser support, auto-reconnects, and works through proxies. |
| **Hono** | Lightweight, fast, runs on Node.js and edge runtimes. Native SSE streaming support. |
| **React + Vite** | Fast dev server, native TypeScript, standard React tooling. |
| **shadcn/ui** | Copies components into your project — full control, no version lock-in. Radix primitives + Tailwind. |
| **Tailwind CSS v4** | Via `@tailwindcss/vite` plugin. Zero-config, JIT compilation. |
| **Vitest** | Fast, Jest-compatible, native Vite integration. |
| **react-markdown** | Renders assistant markdown responses with syntax highlighting via `react-syntax-highlighter`. |

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Your Anthropic API key. |
| `AGENT_MODEL` | No | `sonnet` | Default model (`sonnet`, `opus`, `haiku`). |
| `AGENT_MAX_TURNS` | No | `100` | Maximum conversation turns. |
| `API_PORT` | No | `3000` | Port for the API server. |
| `SESSION_STRATEGY` | No | `local` | Session isolation strategy: `local`, `docker`, or `azure`. |
| `SESSION_BASE_DIR` | No | `./sessions` | Base directory for local session folders. |
| `SESSION_CLEANUP` | No | `false` | Auto-delete local session directories after query completes. |
| `DOCKER_IMAGE` | No | `agent-starter-api` | Docker image for the docker strategy. |
| `AZURE_SESSION_POOL_ENDPOINT` | Azure only | — | Azure Dynamic Sessions pool management endpoint. |
| `AZURE_CLIENT_ID` | Azure only | — | Managed identity client ID for Azure authentication. |
| `SESSION_POOL_AUDIENCE` | No | `https://dynamicsessions.io/.default` | Token audience for session pool authentication. |

## Next steps

- Add your own subagents for domain-specific tasks
- Customize the system prompt in `config.ts` or per-query
- Add custom tools via [MCP servers](https://platform.claude.com/docs/en/agent-sdk/custom-tools)
- Set up a CI pipeline to run `pnpm test` on every push
- Review the [Claude Agent SDK documentation](https://platform.claude.com/docs/en/agent-sdk/overview) for advanced features
