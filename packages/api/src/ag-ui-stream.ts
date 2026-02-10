/**
 * Translates streamQuery() output into AG-UI protocol SSE events.
 *
 * This is the middleware layer that bridges the Claude Agent SDK's custom
 * streaming format to the AG-UI standard, making the API compatible with
 * any AG-UI client (CopilotKit, CLI clients, etc.).
 */
import { EventType } from "@ag-ui/core";
import type { AgentQueryConfig, StreamEvent } from "@agent-starter/core";
import { streamQuery } from "@agent-starter/core";

/** AG-UI event ready for SSE encoding */
export interface AgUiSseEvent {
  event: string;
  data: string;
}

/**
 * Async generator that wraps streamQuery() and yields AG-UI-formatted SSE events.
 *
 * Event mapping:
 * - (start)       → RUN_STARTED
 * - text_delta    → TEXT_MESSAGE_START / TEXT_MESSAGE_CONTENT / TEXT_MESSAGE_END
 * - tool_call     → TOOL_CALL_START → TOOL_CALL_ARGS → TOOL_CALL_END
 * - todo_update   → CUSTOM { name: "todo_update" }
 * - usage         → CUSTOM { name: "usage" }
 * - session       → CUSTOM { name: "session" }
 * - done          → RUN_FINISHED
 * - error         → RUN_ERROR
 */
export async function* streamQueryAsAgUi(
  config: AgentQueryConfig,
  threadId: string,
  runId: string,
): AsyncGenerator<AgUiSseEvent> {
  // Emit RUN_STARTED
  yield encode({
    type: EventType.RUN_STARTED,
    threadId,
    runId,
  });

  let messageStarted = false;
  const messageId = `msg-${Date.now()}`;
  let messageSegment = 0;

  /** Close the current text message if one is open */
  function* closeTextMessage(): Generator<AgUiSseEvent> {
    if (messageStarted) {
      yield encode({
        type: EventType.TEXT_MESSAGE_END,
        messageId: currentMessageId(),
      });
      messageStarted = false;
    }
  }

  function currentMessageId(): string {
    return messageSegment === 0 ? messageId : `${messageId}-${messageSegment}`;
  }

  try {
    for await (const event of streamQuery(config)) {
      yield* handleEvent(event);
    }
  } catch (error) {
    // Close any open message before error
    yield* closeTextMessage();
    yield encode({
      type: EventType.RUN_ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return;
  }

  /** Map a single StreamEvent to one or more AG-UI events */
  function* handleEvent(event: StreamEvent): Generator<AgUiSseEvent> {
    switch (event.type) {
      case "text_delta": {
        if (!messageStarted) {
          messageStarted = true;
          yield encode({
            type: EventType.TEXT_MESSAGE_START,
            messageId: currentMessageId(),
            role: "assistant",
          });
        }
        yield encode({
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: currentMessageId(),
          delta: event.text,
        });
        break;
      }

      case "tool_call": {
        // Close text message before tool calls
        yield* closeTextMessage();

        const tc = event.toolCall;
        yield encode({
          type: EventType.TOOL_CALL_START,
          toolCallId: tc.id,
          toolCallName: tc.name,
          parentMessageId: currentMessageId(),
        });
        yield encode({
          type: EventType.TOOL_CALL_ARGS,
          toolCallId: tc.id,
          delta: JSON.stringify(tc.input),
        });
        yield encode({
          type: EventType.TOOL_CALL_END,
          toolCallId: tc.id,
        });

        // Next text_delta should start a new message segment
        messageSegment++;
        break;
      }

      case "todo_update": {
        yield encode({
          type: EventType.CUSTOM,
          name: "todo_update",
          value: event.todos,
        });
        break;
      }

      case "usage": {
        yield encode({
          type: EventType.CUSTOM,
          name: "usage",
          value: event.usage,
        });
        break;
      }

      case "session": {
        yield encode({
          type: EventType.CUSTOM,
          name: "session",
          value: { sessionId: event.sessionId },
        });
        break;
      }

      case "done": {
        // Close any open text message
        yield* closeTextMessage();

        yield encode({
          type: EventType.CUSTOM,
          name: "done_result",
          value: event.result,
        });

        yield encode({
          type: EventType.RUN_FINISHED,
          threadId,
          runId,
        });
        break;
      }

      case "error": {
        yield* closeTextMessage();
        yield encode({
          type: EventType.RUN_ERROR,
          message: event.error,
        });
        break;
      }
    }
  }
}

/** Encode an event object as an SSE-ready { event, data } pair */
function encode(event: Record<string, unknown>): AgUiSseEvent {
  const type = event.type as string;
  return {
    event: type,
    data: JSON.stringify({ ...event, timestamp: Date.now() }),
  };
}
