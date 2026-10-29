// A small recorded pi session file (deepseek), cut down to the rows the cache reading walks: the
// session header, a model change, a user turn and two assistant turns carrying the provider's own
// usage counters. The rows are the REAL shape of pi's JSONL (measured 2026-10-29 on this host); the
// counters and timestamps are the ones that session wrote, so the fixture stays a fact and not a
// paraphrase. The newest assistant turn has a cacheRead share near 1.0.
export const PI_SESSION_DEEPSEEK: string[] = [
  JSON.stringify({ type: "session", version: 3, id: "11111111-2222-4333-8444-555555555555",
    timestamp: "2026-10-29T09:03:47.806Z", cwd: "/repo" }),
  JSON.stringify({ type: "model_change", id: "5d7c7b21", parentId: null,
    timestamp: "2026-10-29T09:03:47.843Z", provider: "deepseek", modelId: "deepseek-flash" }),
  JSON.stringify({ type: "message", id: "2e18c454", parentId: "5d7c7b21",
    timestamp: "2026-10-29T09:03:52.035Z", message: { role: "user", content: "go" } }),
  JSON.stringify({ type: "message", id: "55ab8c57", parentId: "2e18c454",
    timestamp: "2026-10-29T09:04:26.635Z", message: { role: "assistant", content: [{ type: "text", text: "on it" }],
      api: "openai-completions", provider: "deepseek", model: "deepseek-flash",
      usage: { input: 4072, output: 258, cacheRead: 52608, cacheWrite: 0, reasoning: 55, totalTokens: 56938 } } }),
  JSON.stringify({ type: "message", id: "f1254d47", parentId: "55ab8c57",
    timestamp: "2026-10-29T09:04:49.135Z", message: { role: "assistant", content: [{ type: "text", text: "done" }],
      api: "openai-completions", provider: "deepseek", model: "deepseek-flash",
      usage: { input: 1224, output: 157, cacheRead: 57600, cacheWrite: 0, reasoning: 0, totalTokens: 58981 } } }),
];

// The same file with the newest assistant turn's usage changed — the two cases the reading has to tell
// apart: a call that hit the cache and one that did not.
export function piSessionWithLastUsage(usage: Record<string, number>, provider = "deepseek"): string[] {
  return PI_SESSION_DEEPSEEK.map((line, i) => {
    if (i !== PI_SESSION_DEEPSEEK.length - 1) return line;
    const row = JSON.parse(line) as { message: Record<string, unknown> };
    return JSON.stringify({ ...row, message: { ...row.message, provider, usage } });
  });
}
