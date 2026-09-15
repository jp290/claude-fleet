// bun codex-quota.ts [--json] — quota snapshot and unseen reset announcements.
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

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

async function readQuota() {
  const root = join(homedir(), ".codex", "sessions");
  const files = await Promise.all((await Array.fromAsync(new Bun.Glob("*/*/*/*.jsonl").scan({ cwd: root, absolute: true })))
    .map(async path => ({ path, mtime: (await stat(path)).mtimeMs })));
  files.sort((a, b) => b.mtime - a.mtime || b.path.localeCompare(a.path));
  for (const file of files) {
    const lines = (await Bun.file(file.path).text()).split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].trim()) continue;
      // A live writer may leave one unfinished final line; only that line may be ignored.
      let row: unknown;
      try { row = JSON.parse(lines[i]); } catch {
        if (i === lines.length - 1) continue;
        throw new Error("rollout: invalid JSON line");
      }
      const payload = object(row) && object(row.payload) ? row.payload : row;
      if (!object(payload) || payload.rate_limits == null) continue;
      const limits: unknown = payload.rate_limits;
      if (object(limits) && limits.limit_id !== undefined && limits.limit_id !== "codex") continue;
      return quotaPosition(limits, Date.now());
    }
  }
  throw new Error("rollout: no codex rate_limits found");
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
