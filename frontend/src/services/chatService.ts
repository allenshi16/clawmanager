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
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export async function* chatCompletionsStream(
  instanceId: number,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const response = await fetch(`${API_BASE}/gateway/llm/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      model: "default",
      messages,
      stream: true,
      instance_id: instanceId,
    }),
    signal,
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      errorMsg = body.error || body.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") {
        if (trimmed === "data: [DONE]") {
          yield { content: "", done: true };
        }
        continue;
      }

      if (trimmed.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield { content: delta, done: false };
          }
          if (parsed.choices?.[0]?.finish_reason === "stop") {
            yield { content: "", done: true };
          }
        } catch {}
      }
    }
  }

  yield { content: "", done: true };
}
