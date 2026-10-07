// bun codex-quota.ts [--json] — quota snapshot and unseen reset announcements.
import { mkdir, rename, stat, unlink, open } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { SubscriptionSnapshot, SubscriptionRefresh, SubscriptionWindow } from "./src/protocol";

const FEED = "https://codex-resets.com/api/v1/resets";
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const string = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function quotaPosition(rateLimits: unknown, now: number) {
  const p = object(rateLimits) ? rateLimits.primary : null;
  if (!object(p) || !finite(p.used_percent) || p.used_percent < 0 || p.used_percent > 100
    || !finite(p.window_minutes) || p.window_minutes <= 0 || !finite(p.resets_at) || p.resets_at <= 0 || !finite(now)) {
    throw new Error("rollout: invalid rate_limits.primary");
  }
  // Assumption: primary is the requested quota window; now is milliseconds, resets_at seconds.
  const elapsed_percent = Math.max(0, Math.min(100, 100 * (1 - (p.resets_at * 1000 - now) / (p.window_minutes * 60_000))));
  const delta = p.used_percent - elapsed_percent;
  return { used_percent: p.used_percent, elapsed_percent, position: delta < -10 ? "unter" : delta > 10 ? "ueber" : "innerhalb",
    window_minutes: p.window_minutes, resets_at: p.resets_at };
}

type Announcement = { id: string; reset_type: string; announced_at: string; text: string; source: { type: string; url: string } };

export function newResetEntries(feed: unknown, seen: ReadonlySet<string>): Announcement[] {
  if (!object(feed) || !Array.isArray(feed.data)) throw new Error("feed: missing data array");
  const entries = feed.data.map((entry: unknown): Announcement => {
    if (!object(entry) || !string(entry.id) || !string(entry.reset_type) || !string(entry.announced_at)
      || !Number.isFinite(Date.parse(entry.announced_at)) || typeof entry.text !== "string"
      || !object(entry.source) || !string(entry.source.type) || !string(entry.source.url)) {
      throw new Error("feed: invalid announcement");
    }
    return { id: entry.id, reset_type: entry.reset_type, announced_at: entry.announced_at, text: entry.text,
      source: { type: entry.source.type, url: entry.source.url } };
  });
  return entries.filter((entry, i) => !seen.has(entry.id) && entries.findIndex(other => other.id === entry.id) === i);
}

export const SUBSCRIPTION_STALE_MS = 15 * 60_000;
export const PROVIDER_UNSUPPORTED = "installed schema proves account/rateLimits/read, but no account-bound reader or authorized account connection is evidenced";
const selection = { kind: "recent-file-tails", maxFiles: 16, maxBytesPerFile: 262144, historyComplete: false } as const;

function unknownSnapshot(reason: string, fetchedAt: number | null, status: "unknown" | "error" = "unknown"): SubscriptionSnapshot {
  return { status, primary: null, secondary: null, source: { kind: "local-rollout", measuredAt: null,
    fetchedAt, ageMs: null, staleAfterMs: SUBSCRIPTION_STALE_MS, reason, selection, limitId: null,
    accountBound: false, provenance: null } };
}

function windowFrom(value: unknown): SubscriptionWindow | null {
  if (value == null) return null;
  if (!object(value) || !finite(value.used_percent) || value.used_percent < 0 || value.used_percent > 100
    || !finite(value.window_minutes) || value.window_minutes <= 0
    || !Number.isSafeInteger(value.resets_at) || !finite(value.resets_at) || value.resets_at <= 0
    || value.resets_at >= 100_000_000_000) throw new Error("invalid-window");
  return { used_percent: value.used_percent, window_minutes: value.window_minutes, resets_at: value.resets_at };
}

export function ageSubscription(snapshot: SubscriptionSnapshot, now: number): SubscriptionSnapshot {
  const measuredAt = snapshot.source.measuredAt;
  if (measuredAt === null) return snapshot;
  if (!finite(now) || measuredAt > now) return unknownSnapshot("event-time-ahead-of-server", snapshot.source.fetchedAt);
  const ageMs = now - measuredAt;
  if (snapshot.primary === null && snapshot.secondary === null)
    return { ...snapshot, status: "unknown", source: { ...snapshot.source, ageMs, reason: "missing-windows" } };
  const stale = ageMs > SUBSCRIPTION_STALE_MS;
  return { ...snapshot, status: stale ? "stale" : "measured", source: { ...snapshot.source, ageMs,
    reason: stale ? "event-older-than-15-minutes" : null } };
}

export function parseQuotaRollout(text: string, fetchedAt: number): SubscriptionSnapshot {
  const lines = text.split("\n");
  let latest: SubscriptionSnapshot | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    let row: unknown;
    try { row = JSON.parse(lines[i]); } catch {
      if (i === lines.length - 1 && !text.endsWith("\n")) continue;
      return unknownSnapshot("invalid-json-line", fetchedAt, "error");
    }
    const payload = object(row) && object(row.payload) ? row.payload : row;
    if (!object(payload) || payload.rate_limits == null) continue;
    const limits = payload.rate_limits;
    if (object(limits) && limits.limit_id !== undefined && limits.limit_id !== "codex") continue;
    if (!object(limits)) return unknownSnapshot("invalid-rate-limits", fetchedAt, "error");
    const timestamp = object(row) ? row.timestamp : null;
    const measuredAt = typeof timestamp === "string" && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(timestamp) ? Date.parse(timestamp) : NaN;
    if (!finite(measuredAt)) return unknownSnapshot("missing-or-invalid-event-time", fetchedAt);
    if (measuredAt > fetchedAt) return unknownSnapshot("event-time-ahead-of-server", fetchedAt);
    let primary: SubscriptionWindow | null, secondary: SubscriptionWindow | null;
    try { primary = windowFrom(limits.primary); secondary = windowFrom(limits.secondary); }
    catch { return unknownSnapshot("invalid-window", fetchedAt, "error"); }
    const limitId = limits.limit_id === "codex" ? "codex" : null;
    const provenance = createHash("sha256").update(JSON.stringify({ measuredAt, primary, secondary, limitId })).digest("hex");
    const snapshot: SubscriptionSnapshot = { status: "measured", primary, secondary,
      source: { kind: "local-rollout", measuredAt, fetchedAt, ageMs: null, staleAfterMs: SUBSCRIPTION_STALE_MS,
        reason: null, selection, limitId, accountBound: false, provenance } };
    if (!latest || measuredAt >= latest.source.measuredAt!) latest = snapshot;
  }
  return latest ? ageSubscription(latest, fetchedAt) : unknownSnapshot("no-codex-rate-limits", fetchedAt);
}

export async function readIdentityBound<T>(identity: () => Promise<string>, read: () => Promise<T>): Promise<T> {
  const before = await identity();
  const result = await read();
  if (before !== await identity()) throw new Error("source-identity-changed");
  return result;
}

async function readQuotaTail(path: string): Promise<string> {
  const file = await open(path, "r");
  try {
    const size = (await file.stat()).size;
    const start = Math.max(0, size - selection.maxBytesPerFile);
    const bytes = Buffer.alloc(Math.min(size, selection.maxBytesPerFile));
    const { bytesRead } = await file.read(bytes, 0, bytes.length, start);
    const text = bytes.subarray(0, bytesRead).toString("utf8");
    if (start === 0) return text;
    const previous = Buffer.alloc(1);
    const { bytesRead: previousRead } = await file.read(previous, 0, 1, start - 1);
    if (previousRead === 1 && previous[0] === 0x0a) return text;
    return text.slice(text.indexOf("\n") < 0 ? text.length : text.indexOf("\n") + 1);
  } finally { await file.close(); }
}

export async function readLocalQuota(root = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "sessions"), clock = Date.now): Promise<SubscriptionSnapshot> {
  try {
    await stat(root);
    const paths = await Array.fromAsync(new Bun.Glob("*/*/*/*.jsonl").scan({ cwd: root, absolute: true }));
    const files = await Promise.all(paths.map(async path => ({ path, mtime: (await stat(path)).mtimeMs })));
    files.sort((a, b) => b.mtime - a.mtime || b.path.localeCompare(a.path));
    let latest: SubscriptionSnapshot | null = null;
    for (const { path } of files.slice(0, selection.maxFiles)) {
      const identity = async () => { const s = await stat(path); return `${s.dev}:${s.ino}:${s.birthtimeMs}`; };
      const text = await readIdentityBound(identity, () => readQuotaTail(path));
      const snapshot = parseQuotaRollout(text, clock());
      if (snapshot.status === "error" || (snapshot.status === "unknown" && snapshot.source.reason !== "no-codex-rate-limits")) return snapshot;
      if (snapshot.source.measuredAt !== null && (!latest || snapshot.source.measuredAt >= latest.source.measuredAt!)) latest = snapshot;
    }
    const fetchedAt = clock();
    return latest ? ageSubscription({ ...latest, source: { ...latest.source, fetchedAt } }, fetchedAt)
      : unknownSnapshot("no-codex-rate-limits-in-observed-tails", fetchedAt);
  } catch (error) {
    const reason = error instanceof Error && error.message === "source-identity-changed" ? error.message
      : object(error) && error.code === "ENOENT" ? "missing-source" : "unreadable-source";
    return unknownSnapshot(reason, clock(), reason === "missing-source" ? "unknown" : "error");
  }
}

export function createSubscriptionReader(read = () => readLocalQuota(), clock = Date.now, timeoutMs = 5000) {
  let snapshot = unknownSnapshot("not-observed", null);
  let observed = false;
  let active: Promise<void> | null = null;
  let initialAcquisition = false;
  let localRequest: SubscriptionRefresh | null = null;
  let refresh: SubscriptionRefresh = { target: null, status: "not-requested", startedAt: null, finishedAt: null, reason: null };
  const acquire = (explicit: boolean): Promise<void> => {
    if (explicit) {
      localRequest = { target: "local", status: "refreshing", startedAt: clock(), finishedAt: null, reason: null };
      refresh = localRequest;
    }
    if (active) return active;
    initialAcquisition = !explicit;
    active = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        snapshot = await Promise.race([Promise.resolve().then(read), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("read-timeout")), timeoutMs);
        })]);
        if (localRequest && refresh === localRequest) refresh = { ...localRequest, status: snapshot.status === "error" || snapshot.status === "unknown" ? "error" : "ok",
          finishedAt: clock(), reason: snapshot.source.reason };
      } catch (error) {
        const timeout = error instanceof Error && error.message === "read-timeout";
        snapshot = unknownSnapshot(timeout ? "read-timeout" : "read-failed", clock(), "error");
        if (localRequest && refresh === localRequest) refresh = { ...localRequest, status: timeout ? "timeout" : "error", finishedAt: clock(), reason: snapshot.source.reason };
      } finally { clearTimeout(timer); observed = true; active = null; initialAcquisition = false; localRequest = null; }
    })();
    return active;
  };
  const view = () => ({ ...ageSubscription(snapshot, clock()), refresh: { ...refresh },
    provider: { status: "unsupported" as const, reason: PROVIDER_UNSUPPORTED } });
  return {
    busy: () => active !== null,
    get: async () => { if (!observed && (!active || initialAcquisition)) await acquire(false); return view(); },
    refresh: async (target: "local" | "provider") => {
      if (target === "local") await acquire(true);
      else refresh = { target, status: "unsupported", startedAt: clock(), finishedAt: clock(), reason: PROVIDER_UNSUPPORTED };
      return view();
    },
  };
}

async function readQuota() {
  const snapshot = await readLocalQuota();
  if (!snapshot.primary) throw new Error("rollout: no codex rate_limits found");
  if (snapshot.status === "stale") throw new Error("rollout: stale codex rate_limits (event-older-than-15-minutes)");
  return quotaPosition({ primary: snapshot.primary }, Date.now());
}

async function readFeed() {
  const signal = AbortSignal.timeout(10_000);
  const entries: Announcement[] = [];
  const cursors = new Set<string>();
  let cursor = "";
  do {
    const url = new URL(FEED);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`feed: HTTP ${response.status}`);
    const page: unknown = await response.json();
    entries.push(...newResetEntries(page, new Set()));
    const pagination = object(page) ? page.pagination : undefined;
    if (pagination === undefined) break;
    if (!object(pagination) || typeof pagination.has_more !== "boolean") throw new Error("feed: invalid pagination");
    if (!pagination.has_more) break;
    if (!string(pagination.next_cursor) || cursors.has(pagination.next_cursor)) throw new Error("feed: invalid next_cursor");
    cursor = pagination.next_cursor;
    cursors.add(cursor);
  } while (cursor);
  return { data: entries };
}

async function main() {
  const errors: string[] = [];
  const capture = async <T>(source: string, action: () => Promise<T>): Promise<T | null> => {
    try { return await action(); } catch (error) {
      // Do not expose home paths or rollout contents in error messages.
      const message = error instanceof Error && /^(rollout|feed|cache): /.test(error.message) ? error.message : `${source}: unreadable source`;
      errors.push(message);
      return null;
    }
  };
  const cacheDir = join(homedir(), ".cache", "claude-fleet");
  const cachePath = join(cacheDir, "codex-resets-seen.json");
  const [quota, feed, seen] = await Promise.all([
    capture("rollout", readQuota), capture("feed", readFeed), capture("cache", async () => {
      let saved: unknown;
      try { saved = await Bun.file(cachePath).json(); } catch (error) {
        // Assumption: first run announces all entries; only ENOENT means an empty history.
        if (object(error) && error.code === "ENOENT") return new Set<string>();
        throw error;
      }
      if (!Array.isArray(saved) || !saved.every(string)) throw new Error("cache: invalid seen array");
      return new Set<string>(saved);
    }),
  ]);
  const announcements = feed && seen ? newResetEntries(feed, seen) : null;
  if (errors.length === 0 && announcements && seen) {
    await capture("cache", async () => {
      await mkdir(cacheDir, { recursive: true });
      // Atomic replacement avoids a truncated cache; concurrent callers may both announce an entry.
      const temporary = `${cachePath}.${crypto.randomUUID()}.tmp`;
      try {
        await Bun.write(temporary, JSON.stringify([...new Set([...seen, ...announcements.map(entry => entry.id)])]));
        await rename(temporary, cachePath);
      } finally {
        await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; });
      }
      return true;
    });
  }
  const exit_code = errors.length ? 2 : announcements?.length ? 1 : 0;
  const result = { quota, announcements, errors, exit_code };
  const lines = [quota ? `Kontingent: used_percent=${quota.used_percent} elapsed_percent=${quota.elapsed_percent.toFixed(2)} Lage=${quota.position}` : "Kontingent: unknown",
    announcements ? `Resets: ${announcements.length} neu${announcements.length ? " · " + announcements.map(e => `${e.id} ${e.reset_type} ${e.announced_at}`.replace(/\s+/g, " ")).join("; ") : ""}` : "Resets: unknown"];
  if (errors.length) lines.push(`Fehler: ${errors.join("; ")}`);
  await Bun.write(Bun.stdout, (process.argv.includes("--json") ? JSON.stringify(result) : lines.join("\n")) + "\n");
  process.exitCode = exit_code;
}

if (import.meta.main) await main();
