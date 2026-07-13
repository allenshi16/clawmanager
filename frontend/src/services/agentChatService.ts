// Agent chat service — connects to OpenClaw instance via WebSocket
// Unlike the old chatService.ts which called AI Gateway directly,
// this routes chat through the OpenClaw agent (with skills, browser, memory)

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface ChatConfig {
  ws_path: string;
  access_token: string;
  gateway_password: string;
}

async function getChatConfig(instanceId: number): Promise<ChatConfig> {
  const resp = await fetch(`${API_BASE}/instances/${instanceId}/chat-config`, {
    headers: getAuthHeaders(),
  });
  if (!resp.ok) throw new Error("Failed to get chat config");
  return resp.json().then((d) => d.data);
}

function generateId(): string {
  return crypto.randomUUID();
}

export async function* chatCompletionsStream(
  instanceId: number,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const config = await getChatConfig(instanceId);

  const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${config.ws_path}?token=${config.access_token}`;

  const ws = new WebSocket(wsUrl);
  let connected = false;
  let done = false;
  let buffer: StreamChunk[] = [];
  let error: string | null = null;
  let resolveWait: (() => void) | null = null;

  const signalWait = () => {
    if (resolveWait) {
      const fn = resolveWait;
      resolveWait = null;
      fn();
    }
  };

  const waitForMessage = (): Promise<void> =>
    new Promise((resolve) => {
      resolveWait = resolve;
    });

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.event === "connect.challenge") {
        ws.send(
          JSON.stringify({
            type: "req",
            id: generateId(),
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "clawmanager-chat",
                mode: "webchat",
                version: "1.0",
                platform: "web",
              },
              caps: [],
              auth: { password: config.gateway_password },
              role: "operator",
              scopes: ["operator.write", "operator.read", "operator.execute"],
            },
          }),
        );
        return;
      }

      if (msg.type === "res") {
        if (!connected && msg.ok) {
          connected = true;
          const userMessage = messages[messages.length - 1]?.content || "";
          ws.send(
            JSON.stringify({
              type: "req",
              id: generateId(),
              method: "chat.send",
              params: {
                sessionKey: `chat-${generateId()}`,
                idempotencyKey: generateId(),
                message: userMessage,
              },
            }),
          );
        } else if (!msg.ok) {
          error = JSON.stringify(msg.error || {});
          done = true;
          signalWait();
        }
        return;
      }

      if (msg.type === "event" && msg.event === "agent") {
        const data = msg.payload?.data || {};
        if (data.phase === "error") {
          error = data.error || "Agent error";
          done = true;
          signalWait();
        } else if (data.delta) {
          buffer.push({ content: data.delta, done: false });
          signalWait();
        }
        if (data.phase === "end" || data.phase === "complete") {
          done = true;
          signalWait();
        }
      }

      if (msg.type === "event" && msg.event === "chat") {
        if (msg.payload?.state === "error") {
          error = msg.payload?.errorMessage || "Chat error";
          done = true;
          signalWait();
        } else if (msg.payload?.state === "complete") {
          done = true;
          signalWait();
        }
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = () => {
    done = true;
    signalWait();
  };

  ws.onerror = () => {
    error = "WebSocket connection failed";
    done = true;
    signalWait();
  };

  // Wait for connection or error
  while (!connected && !done && !error) {
    await waitForMessage();
  }

  if (error) {
    ws.close();
    throw new Error(error);
  }

  // Stream responses
  while (!done && !signal?.aborted) {
    await waitForMessage();
    while (buffer.length > 0) {
      yield buffer.shift()!;
    }
  }

  // Drain remaining buffer
  while (buffer.length > 0) {
    yield buffer.shift()!;
  }

  if (error) {
    ws.close();
    throw new Error(error);
  }

  ws.close();
  yield { content: "", done: true };
}
