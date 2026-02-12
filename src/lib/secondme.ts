const API_BASE_URL = process.env.SECONDME_API_BASE_URL!;

export async function getUserShades(accessToken: string) {
  const res = await fetch(`${API_BASE_URL}/api/secondme/user/shades`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Failed to get shades: ${JSON.stringify(data)}`);
  return data.data.shades;
}

export async function getUserSoftMemory(accessToken: string) {
  const res = await fetch(`${API_BASE_URL}/api/secondme/user/softmemory`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Failed to get soft memory: ${JSON.stringify(data)}`);
  return data.data.list;
}

export async function chatWithSecondMe(
  accessToken: string,
  message: string,
  sessionId?: string
): Promise<{ text: string; sessionId: string }> {
  const body: Record<string, string> = { message };
  if (sessionId) body.sessionId = sessionId;

  const res = await fetch(`${API_BASE_URL}/api/secondme/chat/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let text = "";
  let resultSessionId = sessionId || "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("event: session")) continue;
      if (line.startsWith("data: [DONE]")) continue;
      if (line.startsWith("data: ")) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.sessionId) {
            resultSessionId = json.sessionId;
          } else if (json.choices?.[0]?.delta?.content) {
            text += json.choices[0].delta.content;
          }
        } catch {
          // skip invalid JSON
        }
      }
    }
  }

  return { text, sessionId: resultSessionId };
}

export async function actWithSecondMe(
  accessToken: string,
  message: string,
  actionControl: string,
  sessionId?: string
): Promise<{ result: Record<string, unknown>; sessionId: string }> {
  const body: Record<string, string> = { message, actionControl };
  if (sessionId) body.sessionId = sessionId;

  const res = await fetch(`${API_BASE_URL}/api/secondme/act/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let content = "";
  let resultSessionId = sessionId || "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("event: session")) continue;
      if (line.startsWith("data: [DONE]")) continue;
      if (line.startsWith("data: ")) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.sessionId) {
            resultSessionId = json.sessionId;
          } else if (json.choices?.[0]?.delta?.content) {
            content += json.choices[0].delta.content;
          }
        } catch {
          // skip invalid JSON
        }
      }
    }
  }

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(content);
  } catch {
    result = { choice: "cooperate", reason: content };
  }

  return { result, sessionId: resultSessionId };
}
