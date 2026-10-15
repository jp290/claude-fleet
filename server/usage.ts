// DAS CLAUDE-KONTINGENT (Neuaufbau K16 E1, docs/neuaufbau/befunde/18-einstellungen.md §2). Owner 15.10.: „[Zitat entfernt]“
//  Bis hier kannte Fleet nur das Codex-Kontingent (codex-quota.ts); für Claude stand
// „no measured subscription sensor“.
//
// Die Quelle ist Claude Codes eigenes rate_limit_event aus `claude -p --output-format stream-json`, gemessen 15.10. auf
// 2.1.300: five_hour 0.12 / seven_day 0.06 mit resetsAt, dieselben Werte wie die Statuszeile (rate_limits, ganze
// Prozent) zur selben Minute. Ein Lesen kostet einen Haiku-Prompt; in der schlanken Form unten ~3,5k Eingabe-Tokens
// statt ~30k mit Werkzeugen, MCP und Settings. Darum liest der Leser nur auf Anfrage und höchstens alle `maxAgeMs`,
// nie im Takt. Die Statuszeile wäre ohne Prompt, braucht aber eine Änderung am Spawn jeder Session (Owner-Frage).
//
// Kein Speicher: Der Stand lebt im Prozess, ein Neustart liest beim ersten Abruf neu.
import { tmpdir } from "node:os";
import type { ClaudeQuota, ClaudeQuotaWindow } from "../src/protocol";

export const CLAUDE_QUOTA_MAX_AGE_MS = 10 * 60_000;
const READ_TIMEOUT_MS = 30_000;
// kein Werkzeug, kein MCP-Server, keine Settings-Datei, kein Transkript: nur der eine Turn, der das Ereignis bringt
export const CLAUDE_QUOTA_ARGS = ["-p", "--output-format", "stream-json", "--verbose", "--model", "claude-haiku-5-5",
  "--tools", "", "--strict-mcp-config", "--setting-sources", "", "--no-session-persistence", "Antworte nur mit: ok"] as const;

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
function windowOf(v: unknown): ClaudeQuotaWindow | null {
  if (!object(v) || typeof v.utilization !== "number" || !Number.isFinite(v.utilization) || v.utilization < 0
    || !Number.isSafeInteger(v.resetsAt) || (v.resetsAt as number) <= 0) return null;
  return { utilization: v.utilization, resetsAt: v.resetsAt as number };
}

export interface QuotaReading { fiveHour: ClaudeQuotaWindow; sevenDay: ClaudeQuotaWindow; limitStatus: string | null; overageStatus: string | null }
// das letzte vollständige rate_limit_event des Stroms; ein zerrissenes oder unvollständiges zählt nicht
export function parseRateLimitEvent(stream: string): QuotaReading | null {
  let found: QuotaReading | null = null;
  for (const line of stream.split("\n")) {
    if (!line.includes("rate_limit_event")) continue;
    let d: unknown;
    try { d = JSON.parse(line); } catch { continue; }
    if (!object(d) || d.type !== "rate_limit_event" || !object(d.rate_limit_info)) continue;
    const info = d.rate_limit_info;
    const w = object(info.unifiedWindows) ? info.unifiedWindows : {};
    const fiveHour = windowOf(w.five_hour), sevenDay = windowOf(w.seven_day);
    if (!fiveHour || !sevenDay) continue;
    found = { fiveHour, sevenDay, limitStatus: typeof info.status === "string" ? info.status : null,
      overageStatus: typeof info.overageStatus === "string" ? info.overageStatus : null };
  }
  return found;
}

export async function runClaudeQuotaProbe(binary: string, timeoutMs = READ_TIMEOUT_MS): Promise<string> {
  const p = Bun.spawn([binary, ...CLAUDE_QUOTA_ARGS], { cwd: tmpdir(), stdin: "ignore", stdout: "pipe", stderr: "ignore" });
  const killer = setTimeout(() => p.kill(), timeoutMs);
  try {
    const out = await new Response(p.stdout).text();
    await p.exited;
    return out;
  } finally { clearTimeout(killer); }
}

// `binary` null = diese Fleet startet kein claude (FLEET_CMD ist etwas anderes, etwa `true` in der Suite): Dann gibt es
// kein Claude-Konto zu messen, und der Leser startet nichts.
export function createClaudeQuotaReader(binary: string | null, run: (binary: string) => Promise<string> = runClaudeQuotaProbe,
  clock: () => number = Date.now, maxAgeMs = CLAUDE_QUOTA_MAX_AGE_MS) {
  let reading: QuotaReading | null = null;
  let measuredAt: number | null = null;
  let triedAt: number | null = null; // der letzte Versuch, auch ein fehlgeschlagener: auch er wartet maxAgeMs
  let failure: string | null = binary ? "not-observed" : "fleet-cmd-not-claude";
  let active: Promise<void> | null = null;
  const read = async (bin: string): Promise<void> => {
    try {
      const next = parseRateLimitEvent(await run(bin));
      if (next) { reading = next; measuredAt = clock(); failure = null; } else failure = "no-rate-limit-event";
    } catch (e) {
      failure = `read-failed: ${String(e instanceof Error ? e.message : e).slice(0, 160)}`;
    }
  };
  const view = (): ClaudeQuota => {
    const now = clock();
    return { status: reading ? "measured" : binary && failure !== "not-observed" ? "error" : "unknown",
      fiveHour: reading?.fiveHour ?? null, sevenDay: reading?.sevenDay ?? null,
      limitStatus: reading?.limitStatus ?? null, overageStatus: reading?.overageStatus ?? null,
      measuredAt, ageMs: measuredAt === null ? null : now - measuredAt, maxAgeMs, reason: failure };
  };
  return {
    // liest neu, wenn der letzte Versuch älter als maxAgeMs ist; gleichzeitige Abrufe teilen sich ein Lesen
    get: async (): Promise<ClaudeQuota> => {
      if (binary && !active && (triedAt === null || clock() - triedAt >= maxAgeMs)) {
        triedAt = clock();
        active = read(binary).finally(() => { active = null; });
      }
      if (active) await active;
      return view();
    },
  };
}
