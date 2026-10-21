// File permissions, kill semantics, and the srv restart: what must survive it (state, history,
// prompt log, shares, schedules, a lane's selfToken) and the audit log with its rotation.
// Sets up the deploy-gap repo and the env line the steward section is measured against.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BASE, IP, PORT, ROOT, SOCK, TOKEN, BoundAgentError, UntilTimeout, check, get, plogRead, post, readText, restartSrv, stopSrv, tmuxOut, until, waitForBoundAgent, wsUrl } from "./harness";
import type { AgentBinding, BoundAgentObservation, BoundAgentWait } from "./harness";
import type { Ctx } from "./ctx";
import { MERGE_IDLE_MS, landedAsOne, settleForMerge } from "./lane-helpers";

const statOrNull = (path: string): ReturnType<typeof statSync> | null => {
  try { return statSync(path); } catch { return null; }
};

interface CodexRecoveryView {
  state: "pending" | "bound" | "ambiguous" | "lost";
  sessionId: string | null;
  disconnectSeenAt: number | null;
}

interface CodexCandidatesView {
  state: CodexRecoveryView["state"];
  sessionId: string | null;
  sessionsRoot: boolean;
  candidates: { id: string; timestamp: number }[];
  boundElsewhere: { id: string; timestamp: number; slot: number }[];
  total: number | null;
  truncated: boolean;
}

const codexRow = async (slot: number): Promise<{ codexRecovery?: CodexRecoveryView } | undefined> => {
  const body = (await (await get("/api/sessions")).json()) as
    { slots: { id: number; codexRecovery?: CodexRecoveryView }[] };
  return body.slots.find((s) => s.id === slot);
};

const waitCodex = async (slot: number, accept: (r: CodexRecoveryView) => boolean,
  timeoutMs = 12_000): Promise<CodexRecoveryView | null> => {
  const until = Date.now() + timeoutMs;
  do {
    const r = (await codexRow(slot))?.codexRecovery;
    if (r && accept(r)) return r;
    await Bun.sleep(100);
  } while (Date.now() < until);
  return (await codexRow(slot))?.codexRecovery ?? null;
};

// `tail` defaults to empty, which is byte-for-byte the file every discovery/recovery fixture below
// has always staged: identity lives in the first line alone. Only the context-reader fixture passes
// lines, because that reader is the only thing on this fleet that looks past line one.
const rolloutPath = (root: string, id: string, cwd: string, threadSource: "user" | "subagent",
  timestamp = Date.now(), tail: string[] = []): string => {
  const d = new Date();
  const dir = `${root}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  mkdirSync(dir, { recursive: true });
  const path = `${dir}/rollout-${Date.now()}-${id}.jsonl`;
  writeFileSync(path, [JSON.stringify({ type: "session_meta", payload: {
    id, cwd, timestamp: new Date(timestamp).toISOString(), thread_source: threadSource, originator: "codex-tui",
  } }), ...tail].join("\n") + "\n");
  return path;
};

// One Codex `token_count` event, in the shape measured on a live rollout 2026-08-21: both the
// counter and the window sit under payload.info, and `window: null` stages the real-world record
// that carries a usable counter and no denominator.
const codexTokenCount = (total: number, window: number | null): string => JSON.stringify({
  ordinal: 1, timestamp: "2026-08-21T00:00:00.000Z", type: "event_msg",
  payload: {
    type: "token_count",
    info: {
      total_token_usage: { input_tokens: total, cached_input_tokens: 0, cache_write_input_tokens: 0,
        output_tokens: 0, reasoning_output_tokens: 0, total_tokens: total },
      last_token_usage: { input_tokens: total, cached_input_tokens: 0, cache_write_input_tokens: 0,
        output_tokens: 0, reasoning_output_tokens: 0, total_tokens: total },
      ...(window === null ? {} : { model_context_window: window }),
    },
    rate_limits: null,
  },
});

/**
 * The session uuid the context-size fixture plants on slot 2 — a FRESH one per suite run.
 *
 * It is its own function so the property can be probed instead of trusted: the transcript this
 * uuid names lives at projDir(slot 2's cwd), and that cwd is $HOME on a helper. A constant here
 * therefore makes the fixture ONE machine-global file that every concurrent run shares, and
 * whichever run reaches its cleanup first deletes the other's (measured 2026-09-09 on the
 * workhorse: two runs 14 s apart, the winner green, the loser reading transcriptFact = null).
 * `e2e/steward-core.ts` asserts two calls differ — a constant put back here fails THERE, by name.
 */
export const newPlantedSid = (): string => crypto.randomUUID();

export async function boundRestartReadiness(): Promise<void> {
  const binding = { slot: 16, openedAt: 123456, pane: "%123" };
  const view = (agent: BoundAgentObservation["agent"], openedAt = binding.openedAt): unknown =>
    ({ slots: [{ id: binding.slot, openedAt, agent }] });
  const pane = async (): Promise<{ out: string; code: number }> => ({ out: binding.pane, code: 0 });
  const budget = Math.max(1000, Number(process.env.FLEET_GIT_TICK_MS ?? 10_000) | 0);
  const reject = async (name: string, reason: BoundAgentError["reason"] | "timeout", opts: BoundAgentWait): Promise<void> => {
    let actual = "resolved";
    let correct = false;
    try { await waitForBoundAgent(opts); } catch (error) {
      correct = reason === "timeout"
        ? error instanceof UntilTimeout && error.what === `bound agent readiness slot ${binding.slot}`
        : error instanceof BoundAgentError && error.reason === reason;
      actual = error instanceof UntilTimeout ? `${error.what}; ${error.last}`
        : error instanceof BoundAgentError ? `${error.reason}; ${error.actual}` : "unexpected error";
    }
    check(`bound agent readiness: ${name}`, correct, actual);
  };
  let reads = 0;
  const seen: (BoundAgentObservation["agent"])[] = [];
  const observed = await waitForBoundAgent({ binding, timeoutMs: 1000, stepMs: 10,
    readSessions: async () => { reads++; return view(reads <= 2 ? null : reads <= 4 ? "unprobed" : "alive"); },
    readPane: pane, readCurrent: () => binding, observe: (actual) => seen.push(actual.agent) });
  check("bound agent readiness: HTTP-shaped null and unknown never complete before observed alive",
    reads === 6 && seen.join(",") === ",unprobed,alive" && observed.agent === "alive",
    JSON.stringify({ reads, seen, agent: observed.agent }));
  const base = { binding, timeoutMs: 1000, stepMs: 10, readPane: pane, readCurrent: () => binding };
  await reject("no-agent rejects without waiting for a cache tick", "no-agent",
    { ...base, readSessions: async () => view("no-agent") });
  await reject("a different openedAt rejects the foreign occupant", "occupant-changed",
    { ...base, readSessions: async () => view("alive", binding.openedAt + 1) });
  await reject("a missing slot rejects the absent occupant", "occupant-changed",
    { ...base, readSessions: async () => ({ slots: [] }) });
  let currentOpenedAt = binding.openedAt;
  await reject("occupant replacement during the tmux await rejects", "occupant-changed", { ...base,
    readSessions: async () => view("alive", currentOpenedAt),
    readCurrent: () => ({ ...binding, openedAt: currentOpenedAt }),
    readPane: async () => { await Promise.resolve(); currentOpenedAt++; return pane(); } });
  let currentPane = binding.pane;
  await reject("pane recycle during the sessions await rejects", "pane-changed", { ...base,
    readSessions: async () => { await Promise.resolve(); currentPane = "%124"; return view("alive"); },
    readCurrent: () => ({ ...binding, pane: currentPane }),
    readPane: async () => ({ out: currentPane, code: 0 }) });
  let paneReads = 0;
  await reject("pane change on the second bracket rejects", "pane-changed", { ...base,
    readSessions: async () => view("alive"),
    readPane: async () => ({ out: ++paneReads === 1 ? binding.pane : "%124", code: 0 }) });
  currentOpenedAt = binding.openedAt;
  paneReads = 0;
  await reject("occupant replacement in the final tmux await rejects", "occupant-changed", { ...base,
    readSessions: async () => view("alive", currentOpenedAt),
    readCurrent: () => ({ ...binding, openedAt: currentOpenedAt }),
    readPane: async () => { await Promise.resolve(); if (++paneReads === 2) currentOpenedAt++; return pane(); } });
  await reject("null expires under its own named timeout", "timeout",
    { ...base, timeoutMs: 20, readSessions: async () => view(null) });
  await reject("a failed external reader is a sanitized probe-read failure", "probe-read",
    { ...base, readSessions: async () => { throw new Error("private reader data"); } });
  await reject("a missing binding is its own probe-start failure", "probe-start",
    { ...base, binding: { ...binding, pane: "" }, readSessions: async () => view("alive") });

  let own: AgentBinding | null = null;
  let openedSlot: number | null = null;
  let started = false;
  const probeBin = `${ROOT}/bound-readiness-bin`;
  const probeLatch = `${probeBin}/held`;
  const probeReached = `${probeBin}/reached`;
  let controlledRestart = false;
  const external = async (): Promise<{ status: number; slots: { id: number; cwd: string | null; openedAt: number;
    agent: BoundAgentObservation["agent"] }[] }> => {
    const response = await get("/api/sessions");
    const body = await response.json() as { slots: { id: number; cwd: string | null; openedAt: number;
      agent: BoundAgentObservation["agent"] }[] };
    return { status: response.status, slots: body.slots };
  };
  try {
    if (!existsSync(`${ROOT}/pi`)) throw new BoundAgentError("probe-start", "local compiled pi absent");
    const empty = (await external()).slots.filter((s) => !s.cwd).at(-1);
    if (!empty) throw new BoundAgentError("probe-start", "no isolated empty slot");
    const open = await post(`/api/slots/${empty.id}/open`, { cwd: ROOT, harness: "pi-zai" });
    if (!open.ok) throw new BoundAgentError("probe-start", `slot=${empty.id}; http=${open.status}`);
    openedSlot = empty.id;
    const opened = (await external()).slots.find((s) => s.id === empty.id);
    if (opened?.cwd !== ROOT || !Number.isFinite(opened.openedAt) || opened.openedAt <= 0)
      throw new BoundAgentError("probe-start", `slot=${empty.id}; occupant=unbound`);
    own = { slot: empty.id, openedAt: opened.openedAt, pane: "" };
    const bound = await until(async () => {
      const row = (await external()).slots.find((s) => s.id === empty.id);
      if (row?.openedAt !== own?.openedAt)
        throw new BoundAgentError("occupant-changed", `slot=${empty.id}; openedAt=${row?.openedAt ?? null}`);
      const exact = await tmuxOut("display-message", "-p", "-t", `=s${empty.id}:`, "#{pane_id}");
      const again = (await external()).slots.find((s) => s.id === empty.id);
      return row?.cwd === ROOT && row.agent === "alive" && again?.openedAt === row.openedAt
        && exact.code === 0 && /^%\d+$/.test(exact.out.trim())
        ? { slot: empty.id, openedAt: row.openedAt, pane: exact.out.trim() } : null;
    }, { timeoutMs: budget * 3 + 1500, what: "bound agent readiness probe-start" });
    own = bound;
    started = true;
    const realTmux = Bun.which("tmux");
    if (!realTmux) throw new BoundAgentError("probe-start", "tmux executable absent");
    mkdirSync(probeBin, { recursive: true });
    rmSync(probeReached, { force: true });
    writeFileSync(probeLatch, "held");
    // The boot tick runs immediately, regardless of FLEET_GIT_TICK_MS. Hold only this
    // occupant's agent probe through the existing server-only PATH fixture seam.
    writeFileSync(`${probeBin}/tmux`, `#!/usr/bin/env bun
const args = process.argv.slice(2);
const target = ${JSON.stringify(["-u", "-L", SOCK, "display-message", "-p", "-t", `=s${bound.slot}:`, "#{pane_pid}"])};
const latch = ${JSON.stringify(probeLatch)};
if (args.length === target.length && args.every((arg, i) => arg === target[i])
    && await Bun.file(latch).exists()) {
  await Bun.write(${JSON.stringify(probeReached)}, ${JSON.stringify(JSON.stringify(bound))});
  const deadline = Date.now() + 45_000;
  while (await Bun.file(latch).exists()) {
    if (Date.now() >= deadline) process.exit(1);
    await Bun.sleep(10);
  }
}
const child = Bun.spawn([${JSON.stringify(realTmux)}, ...args], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
process.exit(await child.exited);
`, { mode: 0o755 });
    const states: { http: number; openedAt: number | null; agent: BoundAgentObservation["agent"] | undefined }[] = [];
    controlledRestart = true;
    await restartSrv({ PATH: `${probeBin}:${process.env.PATH ?? ""}` }, {
      binding: bound, timeoutMs: budget * 3 + 1500, stepMs: Math.min(100, budget),
      readSessions: async () => {
        if (states.length === 0) await until(() => existsSync(probeReached), {
          timeoutMs: budget * 3 + 1500, what: "bound agent readiness SETUP: boot agent probe held" });
        const actual = await external();
        const row = actual.slots.find((s) => s.id === bound.slot);
        states.push({ http: actual.status, openedAt: row?.openedAt ?? null, agent: row?.agent });
        if (states.length === 1) {
          const held = existsSync(probeLatch) && readFileSync(probeReached, "utf8") === JSON.stringify(bound);
          const measured = held && actual.status === 200 && row?.agent === null && row.openedAt === bound.openedAt;
          check("bound agent readiness SETUP: held boot probe exposes HTTP 200/null for the bound occupant",
            measured, JSON.stringify({ held, first: states[0] }));
          rmSync(probeLatch, { force: true });
          if (!measured) throw new BoundAgentError("probe-read", "SETUP: HTTP 200/null unmeasured");
        }
        return actual;
      } });
    const after = await external();
    const row = after.slots.find((s) => s.id === bound.slot);
    const exact = await tmuxOut("display-message", "-p", "-t", `=s${bound.slot}:`, "#{pane_id}");
    const final = (await external()).slots.find((s) => s.id === bound.slot);
    const first = states[0];
    check("bound agent readiness: real restart separates HTTP 200/null from the same occupant alive",
      first?.http === 200 && first.agent === null && first.openedAt === bound.openedAt
        && states.some((s) => s.agent === "alive") && states.every((s) => s.http === 200 && s.openedAt === bound.openedAt)
        && row?.agent === "alive" && final?.agent === "alive" && final.openedAt === bound.openedAt
        && exact.code === 0 && exact.out.trim() === bound.pane,
      JSON.stringify({ bound, first, last: states.at(-1), reads: states.length,
        outer: { http: after.status, openedAt: final?.openedAt ?? null, agent: final?.agent ?? null,
          pane: /^%\d+$/.test(exact.out.trim()) ? exact.out.trim() : null, paneCode: exact.code } }));
  } catch (error) {
    check(`bound agent readiness: ${started ? "real restart observation" : "probe-start"}`, false,
      error instanceof UntilTimeout ? `${error.what}; ${error.last}`
        : error instanceof BoundAgentError ? `${error.reason}; ${error.actual}` : "external probe failed");
  } finally {
    rmSync(probeLatch, { force: true });
    if (controlledRestart) await restartSrv();
    rmSync(probeBin, { recursive: true, force: true });
    if (openedSlot !== null) {
      const row = (await external()).slots.find((s) => s.id === openedSlot);
      const same = row?.cwd === ROOT && own !== null && row.openedAt === own.openedAt;
      const cleanup = same ? await post(`/api/slots/${openedSlot}/kill`, {}) : null;
      const restored = (await external()).slots.find((s) => s.id === openedSlot)?.cwd === null;
      check("bound agent readiness: finally removes only its isolated fixture occupant",
        same && cleanup?.ok === true && restored,
        `slot=${openedSlot}; same=${same}; http=${cleanup?.status ?? null}; empty=${restored}`);
    }
  }
}

export async function run(ctx: Ctx): Promise<void> {
  await boundRestartReadiness();
  let persistedCodex: { anchor: number; disconnectSeenAt: number; id: string } | null = null;
  // --- file permissions ---
  const statePath = `${ROOT}/fleet.json`;
  const liveSlot1 = ((await (await get("/api/sessions")).json()) as
    { slots: { id: number; cwd: string | null; openedAt: number }[] }).slots.find((s) => s.id === 1);
  const durableSlot1 = (JSON.parse(readFileSync(statePath, "utf8")) as
    { slots?: Record<string, { cwd?: unknown; openedAt?: unknown; selfToken?: unknown }> }).slots?.["1"];
  const durableSelfToken = typeof durableSlot1?.selfToken === "string"
    && /^[0-9a-f]{32}$/.test(durableSlot1.selfToken) ? durableSlot1.selfToken : null;
  const currentIdentity = !!liveSlot1 && typeof liveSlot1.cwd === "string"
    && typeof durableSlot1?.cwd === "string" && durableSlot1.cwd === liveSlot1.cwd
    && typeof durableSlot1.openedAt === "number" && durableSlot1.openedAt === liveSlot1.openedAt
    && Number.isFinite(liveSlot1.openedAt) && liveSlot1.openedAt > 0 && durableSelfToken !== null;
  check("precondition: slot 1 live and durable occupant identities agree", currentIdentity,
    JSON.stringify({
      live: liveSlot1 ? { cwd: liveSlot1.cwd, openedAt: liveSlot1.openedAt } : null,
      durable: durableSlot1 ? {
        cwd: durableSlot1.cwd, openedAt: durableSlot1.openedAt,
        selfTokenValid: durableSelfToken !== null,
      } : null,
    }));
  const streamName = currentIdentity && liveSlot1 && durableSelfToken
    ? `s1-${liveSlot1.openedAt}-${createHash("sha256").update(durableSelfToken).digest("hex").slice(0, 16)}.raw`
    : "";
  const slot1Streams = readdirSync(`${ROOT}/streams`).filter((name) => /^s1-\d+-[0-9a-f]{16}\.raw$/.test(name));
  const streamPath = streamName ? `${ROOT}/streams/${streamName}` : "";
  check("precondition: slot 1 has exactly its current occupant stream file",
    !!streamName && slot1Streams.length === 1 && slot1Streams[0] === streamName && existsSync(streamPath),
    JSON.stringify({ expected: streamName, found: slot1Streams }));
  const legacyStreamPath = `${ROOT}/streams/s1.raw`;
  check("precondition: reusable legacy slot 1 stream is absent", !existsSync(legacyStreamPath), legacyStreamPath);
  const streamStat = streamPath ? statOrNull(streamPath) : null;
  if (streamStat) {
    const streamMode = Number(streamStat.mode) & 0o777;
    check("stream file is 600", streamMode === 0o600, streamMode.toString(8));
  }
  const stateStat = statOrNull(statePath);
  check("precondition: fleet state file exists", stateStat !== null, statePath);
  if (stateStat) {
    const stateMode = Number(stateStat.mode) & 0o777;
    check("fleet.json is 600", stateMode === 0o600, stateMode.toString(8));
  }
  const histPath = `${ROOT}/streams/s2.history.json`;
  const histStat = statOrNull(histPath);
  check("precondition: slot 2 has a history file", histStat !== null, histPath);
  if (histStat) {
    const histMode = Number(histStat.mode) & 0o777;
    check("history file is 600", histMode === 0o600, histMode.toString(8));
  }

  // --- legacy lane (forked BEFORE worktree.baseSha existed): set it up HERE, while slot 1 is still
  // occupied, so it can never take the slot the restart section asserts is empty. The field is
  // stripped from the persisted state below, between the srv kill and the restart, so the restored
  // server sees exactly a pre-field lane — which must keep recording off the base NAME, never guess. ---
  const legacyRepo = process.env.FLEET_E2E_REPO ?? "";
  let legacyLane: { slot: number; cwd: string; branch: string } | null = null;
  if (legacyRepo) {
    const lg = (await (await post("/api/lanes", { repo: legacyRepo })).json()) as { slot?: number; cwd?: string; branch?: string };
    if (lg.slot && lg.cwd && lg.branch) {
      await Bun.write(`${lg.cwd}/legacy.txt`, "work in a lane that predates baseSha\n");
      spawnSync("git", ["-C", lg.cwd, "add", "legacy.txt"]);
      spawnSync("git", ["-C", lg.cwd, "commit", "-qm", "legacy lane work"]);
      legacyLane = { slot: lg.slot, cwd: lg.cwd, branch: lg.branch };
    }
  }

  // --- clone lane (form:"clone"): opened HERE, next to the legacy lane, so its record rides the
  // same srv restart below. The boot restore rebuilds s.worktree as a whitelist and carried
  // `letter` (since 6a6d46fd) but never `form` — every restarted clone lane silently came back a
  // worktree lane, and removeWorktreeSafe (kill/land) then ran its `git worktree remove` branch
  // against a plain directory. ---
  let cloneLane: { slot: number; cwd: string; branch: string } | null = null;
  if (legacyRepo) {
    const cl = (await (await post("/api/lanes", { repo: legacyRepo, form: "clone" })).json()) as
      { slot?: number; cwd?: string; branch?: string; form?: string };
    check("precondition: the clone-lane fixture opened as a clone", cl.form === "clone" && !!cl.slot && !!cl.cwd && !!cl.branch,
      JSON.stringify(cl));
    if (cl.slot && cl.cwd && cl.branch) cloneLane = { slot: cl.slot, cwd: cl.cwd, branch: cl.branch };
  }

  // --- kill semantics ---
  const k1 = await post("/api/slots/1/kill", {});
  check("kill slot 1 accepted", k1.ok);
  await Bun.sleep(4000);
  const s1dead = await tmuxOut("has-session", "-t", "s1");
  check("killed slot stays dead after 4s", s1dead.code !== 0);
  check("killed slot's share died with it", (await fetch(BASE + `/s/${ctx.shIntId}/info`, { headers: { cookie: ctx.shICookie } })).status === 404);

  await tmuxOut("kill-session", "-t", "s2");
  await Bun.sleep(4500);
  const s2back = await tmuxOut("has-session", "-t", "s2");
  check("externally-killed slot self-heals", s2back.code === 0);

  // --- Codex conversation recovery -----------------------------------------------------------
  // Every rollout below is synthetic and lives under the suite's FLEET_CODEX_SESSIONS_DIR. Restart
  // once through the harness's established explicit-PATH seam so THIS server inherits the inert
  // wrapper binary. Keeping it in codex-bin avoids extending the earlier fake-Pi fixture, while a
  // later ordinary restart automatically restores the normal path for unrelated worker checks.
  const codexBin = `${ROOT}/codex-bin`;
  const codexPath = `${codexBin}:${process.env.PATH ?? ""}`;
  check("codex recovery has its controlled binary before the scoped server restart",
    existsSync(`${codexBin}/codex`), codexBin);
  await restartSrv({ PATH: codexPath });
  const codexRoot = process.env.FLEET_CODEX_SESSIONS_DIR ?? "";
  // /open stores resolve(expandCwd(...)); the fixture must name that byte-exact string. TMPDIR in
  // the wrapper intentionally carries a doubled slash, which is the counterexample this resolve
  // prevents from weakening the product's exact-cwd rule into path equivalence.
  const codexCwdRaw = process.env.FLEET_E2E_REPO ?? "";
  const codexCwd = codexCwdRaw ? resolve(codexCwdRaw) : "";
  check("codex recovery fixture has a scratch sessions root and exact cwd", !!codexRoot && !!codexCwd,
    `${codexRoot} / ${codexCwd}`);
  const resetCodexRoot = () => { rmSync(codexRoot, { recursive: true, force: true }); mkdirSync(codexRoot, { recursive: true }); };
  // The Codex context budget (server.ts#contextOf): one pair, and the exact three overrides it must
  // put on a spawn line (server.ts#CODEX_HARNESS). Spelled here, never derived from the server.
  const CTX_PROFILE = { window: 700_000, compactAt: 600_000 };
  const CTX_FLAGS = "-c model_context_window=700000 -c model_auto_compact_token_limit=600000 -c model_auto_compact_token_limit_scope='total'";
  // The fresh Codex start form with no explicit selection: the explicit full-access default profile
  // (server.ts#CODEX_HARNESS), never the bypass flag. Resume forms put `resume '<id>'` after `codex`.
  const CODEX_DEFAULT_FLAGS = "--no-daemon --sandbox danger-full-access --ask-for-approval never";
  const CODEX_FRESH = `codex ${CODEX_DEFAULT_FLAGS}`;
  const SUB = "10000000-0000-4000-8000-000000000001";
  const FOREIGN = "10000000-0000-4000-8000-000000000002";
  const AMB_A = "10000000-0000-4000-8000-000000000003";
  const AMB_B = "10000000-0000-4000-8000-000000000004";
  const LOST = "10000000-0000-4000-8000-000000000005";
  const OLD_A = "10000000-0000-4000-8000-000000000006";
  const OLD_B = "10000000-0000-4000-8000-000000000007";
  const GONE = "10000000-0000-4000-8000-000000000008";
  const CTX_OK = "10000000-0000-4000-8000-000000000009";
  const CTX_NOWIN = "10000000-0000-4000-8000-00000000000a";
  const BAD_UUID = "not-a-codex-uuid";
  const candidateView = async (slot: number): Promise<CodexCandidatesView> =>
    (await (await get(`/api/slots/${slot}/codex-candidates`)).json()) as CodexCandidatesView;

  resetCodexRoot();
  rolloutPath(codexRoot, SUB, codexCwd, "subagent");
  rolloutPath(codexRoot, FOREIGN, `${codexCwd}-foreign`, "user");
  rolloutPath(codexRoot, BAD_UUID, codexCwd, "user");
  const c0 = await post("/api/slots/15/open", { cwd: codexCwd, harness: "codex" });
  check("codex recovery opens on the controlled stand-in", c0.ok, String(c0.status));
  const zero = await waitCodex(15, (r) => r.state === "pending");
  check("codex discovery binds zero candidates neither from subagents nor a foreign cwd",
    zero?.state === "pending" && zero.sessionId === null, JSON.stringify(zero));
  const zeroView = await candidateView(15);
  check("attended Codex discovery reports a readable root with zero eligible candidates",
    zeroView.sessionsRoot && zeroView.total === 0 && zeroView.candidates.length === 0,
    JSON.stringify(zeroView));
  check("attended discovery filters subagents, foreign cwd and malformed UUIDs through first-line metadata",
    !zeroView.candidates.some((c) => [SUB, FOREIGN, BAD_UUID].includes(c.id))
      && zeroView.boundElsewhere.length === 0,
    JSON.stringify(zeroView));

  const oldAt = Date.now() - 7 * 24 * 60 * 60 * 1000;
  rolloutPath(codexRoot, OLD_A, codexCwd, "user", oldAt);
  const oneView = await candidateView(15);
  check("attended discovery includes one rollout older than the current pane window",
    oneView.total === 1 && oneView.candidates[0]?.id === OLD_A
      && (await codexRow(15))?.codexRecovery?.state === "pending",
    JSON.stringify(oneView));
  rolloutPath(codexRoot, OLD_B, codexCwd, "user", oldAt + 60 * 60 * 1000);
  const manyView = await candidateView(15);
  check("attended discovery reports multiple candidates in stable timestamp-descending order",
    manyView.total === 2 && !manyView.truncated
      && manyView.candidates.map((c) => c.id).join(",") === `${OLD_B},${OLD_A}`,
    JSON.stringify(manyView));

  const cp = await post("/api/slots/16/open", {
    cwd: codexCwd, harness: "codex", model: "gpt-5-codex", effort: "high", context: CTX_PROFILE,
  });
  check("attended-bind persistence fixture opens with model and effort", cp.ok, String(cp.status));
  const ownerPending = await waitCodex(16, (r) => r.state === "pending");
  await Bun.sleep(200);
  const liveBefore = await tmuxOut("display-message", "-p", "-t", "s16", "#{pane_pid}|#{pane_start_command}");
  const captureBefore = await tmuxOut("capture-pane", "-p", "-t", "s16");
  const freshCtxCmd = liveBefore.out.replaceAll("\\", "");
  check("a FRESH Codex spawn with context {700000, 600000} carries all three -c context overrides and no experiment switch",
    liveBefore.code === 0 && freshCtxCmd.includes(CODEX_FRESH) && !freshCtxCmd.includes("bypass")
      && !freshCtxCmd.includes("codex resume") && freshCtxCmd.includes(CTX_FLAGS)
      && !freshCtxCmd.includes("context_management"), freshCtxCmd.slice(-360));
  const ownerBind = await post("/api/slots/16/codex-bind", { sessionId: OLD_A });
  const ownerBindBody = (await ownerBind.json()) as { ok?: boolean; existing?: boolean; sessionId?: string };
  const exactBound = await waitCodex(16, (r) => r.state === "bound");
  const liveAfter = await tmuxOut("display-message", "-p", "-t", "s16", "#{pane_pid}|#{pane_start_command}");
  const captureAfter = await tmuxOut("capture-pane", "-p", "-t", "s16");
  check("owner bind selects exactly the requested old UUID and the poll row carries it",
    ownerPending?.sessionId === null && ownerBind.ok && ownerBindBody.ok === true
      && ownerBindBody.existing === false && ownerBindBody.sessionId === OLD_A
      && exactBound?.sessionId === OLD_A,
    `${JSON.stringify(ownerBindBody)} / ${JSON.stringify(exactBound)}`);
  check("binding a live Codex slot only persists — pane pid, start command and capture stay byte-identical",
    liveBefore.code === 0 && liveAfter.code === 0 && liveAfter.out === liveBefore.out
      && captureBefore.code === 0 && captureAfter.code === 0 && captureAfter.out === captureBefore.out,
    `${liveBefore.out.trim()} / ${liveAfter.out.trim()} / capture=${captureBefore.out === captureAfter.out}`);

  const ownerAuditBefore = (await (await get("/api/audit?limit=1000")).json()) as
    { events?: { event?: string; slot?: number }[] };
  const ownerBindCount = ownerAuditBefore.events?.filter((e) => e.event === "codex_owner_bind" && e.slot === 16).length ?? 0;
  const idem = await post("/api/slots/16/codex-bind", { sessionId: OLD_A });
  const idemBody = (await idem.json()) as { ok?: boolean; existing?: boolean };
  const idemState = (await codexRow(16))?.codexRecovery ?? null;
  const ownerAuditAfter = (await (await get("/api/audit?limit=1000")).json()) as
    { events?: { event?: string; slot?: number }[] };
  check("a second identical owner bind is idempotent and writes no second audit mutation",
    idem.ok && idemBody.ok === true && idemBody.existing === true
      && idemState?.state === "bound" && idemState.sessionId === OLD_A
      && (ownerAuditAfter.events?.filter((e) => e.event === "codex_owner_bind" && e.slot === 16).length ?? 0)
        === ownerBindCount,
    JSON.stringify(idemBody));

  const beforeRefusals = (await codexRow(16))?.codexRecovery ?? null;
  const conflict = await post("/api/slots/16/codex-bind", { sessionId: OLD_B });
  const conflictBody = (await conflict.json()) as { error?: string };
  const gonePath = rolloutPath(codexRoot, GONE, codexCwd, "user", oldAt + 2 * 60 * 60 * 1000);
  rmSync(gonePath, { force: true });
  const vanished = await post("/api/slots/16/codex-bind", { sessionId: GONE });
  const vanishedBody = (await vanished.json()) as { error?: string };
  const afterRefusals = (await codexRow(16))?.codexRecovery ?? null;
  check("a different-id conflict and a vanished rollout both return 409 without changing the bind",
    conflict.status === 409 && vanished.status === 409
      && conflictBody.error === `slot already bound to ${OLD_A}` && vanishedBody.error === "rollout not found"
      && afterRefusals?.state === beforeRefusals?.state
      && afterRefusals?.sessionId === beforeRefusals?.sessionId,
    `${JSON.stringify(conflictBody)} / ${JSON.stringify(vanishedBody)} / ${JSON.stringify(afterRefusals)}`);

  const elsewhere = await candidateView(15);
  check("an id pinned to another active slot is separated as boundElsewhere, never selectable",
    elsewhere.candidates.some((c) => c.id === OLD_B) && !elsewhere.candidates.some((c) => c.id === OLD_A)
      && elsewhere.boundElsewhere.some((c) => c.id === OLD_A && c.slot === 16),
    JSON.stringify(elsewhere));
  const nonCodex = await post("/api/slots/2/codex-bind", { sessionId: OLD_B });
  const inactiveCandidates = await get("/api/slots/1/codex-candidates");
  const unknownCandidates = await get("/api/slots/99/codex-candidates");
  const noOwnerCandidates = await fetch(BASE + "/api/slots/15/codex-candidates");
  check("Codex owner routes refuse a non-Codex slot, inactive slot, unknown slot and missing owner auth",
    nonCodex.status === 409 && inactiveCandidates.status === 409 && unknownCandidates.status === 404
      && noOwnerCandidates.status === 401,
    `${nonCodex.status}/${inactiveCandidates.status}/${unknownCandidates.status}/${noOwnerCandidates.status}`);

  const ambAPath = rolloutPath(codexRoot, AMB_A, codexCwd, "user");
  const ambBPath = rolloutPath(codexRoot, AMB_B, codexCwd, "user");
  const ambiguous = await waitCodex(15, (r) => r.state === "ambiguous");
  check("two exact Codex rollouts are terminally ambiguous — newest never wins",
    ambiguous?.state === "ambiguous" && ambiguous.sessionId === null, JSON.stringify(ambiguous));
  await tmuxOut("kill-session", "-t", "s15");
  let ambiguousHealCmd = "";
  const ambiguousHealUntil = Date.now() + 7000;
  do {
    ambiguousHealCmd = (await tmuxOut("display-message", "-p", "-t", "s15", "#{pane_start_command}"))
      .out.replaceAll("\\", "");
    if (ambiguousHealCmd.includes(CODEX_FRESH)) break;
    await Bun.sleep(100);
  } while (Date.now() < ambiguousHealUntil);
  const ambiguousAfterHeal = (await codexRow(15))?.codexRecovery ?? null;
  check("an automatic heal neither resumes an ambiguous id nor erases the owner-visible refusal",
    !ambiguousHealCmd.includes("codex resume") && ambiguousAfterHeal?.state === "ambiguous"
      && ambiguousAfterHeal.sessionId === null,
    `${ambiguousHealCmd.slice(-180)} / ${JSON.stringify(ambiguousAfterHeal)}`);

  const resolveAmbiguous = await post("/api/slots/15/codex-bind", { sessionId: AMB_A });
  const resolvedAmbiguous = await waitCodex(15, (r) => r.state === "bound");
  check("an explicit exact bind resolves ambiguous to bound without recycling the live slot",
    resolveAmbiguous.ok && resolvedAmbiguous?.sessionId === AMB_A,
    JSON.stringify(resolvedAmbiguous));
  const healAuditBefore = (await (await get("/api/audit?limit=1000")).json()) as
    { events?: { event?: string; slot?: number }[] };
  const healsBefore = healAuditBefore.events?.filter((e) => e.event === "self_heal_recreate" && e.slot === 15).length ?? 0;
  await tmuxOut("kill-session", "-t", "s15");
  let attendedHealCmd = "";
  const attendedHealUntil = Date.now() + 7000;
  do {
    attendedHealCmd = (await tmuxOut("display-message", "-p", "-t", "s15", "#{pane_start_command}"))
      .out.replaceAll("\\", "");
    if (attendedHealCmd.includes("codex resume")) break;
    await Bun.sleep(100);
  } while (Date.now() < attendedHealUntil);
  await Bun.sleep(2500);
  const healAuditAfter = (await (await get("/api/audit?limit=1000")).json()) as
    { events?: { event?: string; slot?: number }[] };
  const healsAfter = healAuditAfter.events?.filter((e) => e.event === "self_heal_recreate" && e.slot === 15).length ?? 0;
  check("a dead explicitly-bound slot heals through exactly one exact-id Codex resume",
    attendedHealCmd.includes(`codex resume '${AMB_A}'`) && healsAfter === healsBefore + 1,
    `${attendedHealCmd.slice(-220)} / heals ${healsBefore}->${healsAfter}`);

  rmSync(ambAPath, { force: true });
  rmSync(ambBPath, { force: true });
  const attendedRecycle = await post("/api/slots/15/open", { cwd: codexCwd, harness: "codex" });
  const afterAttendedRecycle = await waitCodex(15, (r) => r.state === "pending");
  const attendedRecycleCmd = (await tmuxOut("display-message", "-p", "-t", "s15", "#{pane_start_command}"))
    .out.replaceAll("\\", "");
  check("deliberate slot recycling never inherits an attended bind",
    attendedRecycle.ok && afterAttendedRecycle?.sessionId === null && !attendedRecycleCmd.includes("codex resume"),
    `${JSON.stringify(afterAttendedRecycle)} / ${attendedRecycleCmd.slice(-180)}`);

  const lostPath = rolloutPath(codexRoot, LOST, codexCwd, "user");
  const cu = await post("/api/slots/15/open", { cwd: codexCwd, harness: "codex" });
  check("codex unique fixture recycles the attended pane", cu.ok, String(cu.status));
  const bound = await waitCodex(15, (r) => r.state === "bound");
  check("one exact user rollout binds its UUID lazily", bound?.state === "bound" && bound.sessionId === LOST,
    JSON.stringify(bound));
  const boundState = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
    { slots?: Record<string, { codexPaneSpawnedAt?: number; sessionId?: string }> }).slots?.["15"];
  const boundAnchor = boundState?.codexPaneSpawnedAt ?? 0;
  check("the Codex pane-spawn anchor and discovered pin persist together",
    boundAnchor > 0 && boundState?.sessionId === LOST, JSON.stringify(boundState));

  rmSync(lostPath, { force: true });
  await tmuxOut("kill-session", "-t", "s15");
  const lost = await waitCodex(15, (r) => r.state === "lost", 7000);
  const lostCmd = (await tmuxOut("display-message", "-p", "-t", "s15", "#{pane_start_command}"))
    .out.replaceAll("\\", "");
  check("a bound id whose rollout vanished is visible as lost", lost?.state === "lost" && lost.sessionId === LOST,
    JSON.stringify(lost));
  check("a missing exact rollout never reaches codex resume and only boots the unchanged fresh form",
    !lostCmd.includes("codex resume") && lostCmd.includes(CODEX_FRESH) && !lostCmd.includes("bypass"),
    lostCmd.slice(-220));

  const cr = await post("/api/slots/15/open", { cwd: codexCwd, harness: "codex" });
  check("a deliberate recycle after loss opens a fresh Codex pane", cr.ok, String(cr.status));
  const recycled = await waitCodex(15, (r) => r.state === "pending");
  const recycledState = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
    { slots?: Record<string, { codexPaneSpawnedAt?: number; sessionId?: string | null }> }).slots?.["15"];
  check("slot recycling drops the foreign pin and replaces its pane anchor",
    recycled?.state === "pending" && recycled.sessionId === null
      && (recycledState?.codexPaneSpawnedAt ?? 0) > boundAnchor && recycledState?.sessionId === null,
    `${JSON.stringify(recycled)} / ${JSON.stringify(recycledState)}`);
  await post("/api/slots/15/kill", {});
  const closedState = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
    { slots?: Record<string, unknown> }).slots?.["15"];
  check("closing a Codex slot persists neither pin nor recovery anchor", closedState === undefined,
    JSON.stringify(closedState));

  const ae = (await (await get("/api/audit?limit=1000")).json()) as
    { events?: { event?: string; slot?: number; detail?: string }[] };
  check("Codex unique binding and ambiguity each leave an audit fact",
    !!ae.events?.some((e) => e.event === "codex_bind" && e.slot === 15)
      && !!ae.events?.some((e) => e.event === "codex_bind_ambiguous" && e.slot === 15
        && e.detail === "candidates=2"),
    JSON.stringify(ae.events?.filter((e) => e.slot === 15).map((e) => e.event)));

  // --- the Codex CONTEXT reader (the ctx fact, not the recovery state) -----------------------
  // Codex is the one harness whose usage record names its own window, so this section proves the
  // three things that can only be wrong here. The slot is opened with NO model on purpose: for a
  // model-denominator reader contextWindowFor(null) is null and the whole fact would be absent, so
  // any non-null answer below can only have come out of the file. The staged window 197 531 is a
  // number no model table on this server names, which closes the same door a second way.
  type CtxFill = { usedTokens: number; windowTokens: number; pct: number } | null;
  const codexCtx = async (slot: number): Promise<CtxFill> => {
    const body = (await (await get("/api/sessions")).json()) as { slots: { id: number; ctx: CtxFill }[] };
    return body.slots.find((x) => x.id === slot)?.ctx ?? null;
  };
  const ctxSlotModel = async (slot: number): Promise<string | null> => {
    const body = (await (await get("/api/sessions")).json()) as { slots: { id: number; model: string | null }[] };
    return body.slots.find((x) => x.id === slot)?.model ?? null;
  };
  // An OLDER complete record sits under the newest one in both fixtures, and it is the whole point:
  // in the first it must lose (its 999 999/400 000 pair may not be paired with anything), in the
  // second it must not be fallen back to when the newest record has no window.
  const ctxOkPath = rolloutPath(codexRoot, CTX_OK, codexCwd, "user", Date.now(), [
    codexTokenCount(999_999, 400_000),
    codexTokenCount(115_267, 197_531),
    JSON.stringify({ type: "event_msg", payload: { type: "agent_message", message: "after the counters" } }),
  ]);
  const ctxOkStaged = readFileSync(ctxOkPath, "utf8").split("\n");
  // The fixture's own precondition, checked as ITSELF: a staged file that does not carry the pair
  // would make every row below read as "the reader is broken" while nothing had been measured.
  check("codex ctx fixture: the staged rollout carries an older pair, a newest pair and a trailing non-usage line",
    ctxOkStaged.length === 5 && ctxOkStaged[1].includes('"model_context_window":400000')
      && ctxOkStaged[2].includes('"total_tokens":115267') && ctxOkStaged[2].includes('"model_context_window":197531')
      && !ctxOkStaged[3].includes("token_count"),
    `${ctxOkStaged.length} lines`);
  const ctxOpen = await post("/api/slots/15/open", { cwd: codexCwd, harness: "codex" });
  const ctxBound = await waitCodex(15, (r) => r.state === "bound");
  const ctxModel = await ctxSlotModel(15);
  // The second precondition, and the one a predecessor paid for: a Codex sessionId is revalidated
  // against CODEX_UUID_RE on the load path, and a discarded pin leaves the fixture silently inert
  // and every ctx row below green-but-blind. Prove the pin arrived before judging what it reads.
  check("codex ctx fixture: the slot carries the pinned UUID and no model before ctx is judged",
    ctxOpen.ok && ctxBound?.state === "bound" && ctxBound.sessionId === CTX_OK && ctxModel === null,
    `${String(ctxOpen.status)} / ${JSON.stringify(ctxBound)} / model=${String(ctxModel)}`);
  let ctxMeasured: CtxFill = null;
  for (let i = 0; i < 20 && ctxMeasured === null; i++) {
    ctxMeasured = await codexCtx(15);
    if (ctxMeasured === null) await Bun.sleep(100);
  }
  check("Codex context reads counter and window off the SAME token_count record, never across two",
    ctxMeasured?.usedTokens === 115_267 && ctxMeasured.windowTokens === 197_531 && ctxMeasured.pct === 58.4,
    JSON.stringify(ctxMeasured));

  rmSync(ctxOkPath, { force: true });
  let ctxAfterVanish: CtxFill = ctxMeasured;
  for (let i = 0; i < 20 && ctxAfterVanish !== null; i++) {
    ctxAfterVanish = await codexCtx(15);
    if (ctxAfterVanish !== null) await Bun.sleep(100);
  }
  check("a pinned Codex session with no rollout on disk is ctx-absent, never a stale last reading",
    ctxAfterVanish === null, JSON.stringify(ctxAfterVanish));

  const ctxNoWinPath = rolloutPath(codexRoot, CTX_NOWIN, codexCwd, "user", Date.now(), [
    codexTokenCount(115_267, 197_531),
    codexTokenCount(120_000, null),
  ]);
  const ctxNoWinStaged = readFileSync(ctxNoWinPath, "utf8").split("\n");
  check("codex ctx fixture: the window-less rollout has a usable counter and no denominator on its newest record",
    ctxNoWinStaged.length === 4 && ctxNoWinStaged[1].includes('"model_context_window":197531')
      && ctxNoWinStaged[2].includes('"total_tokens":120000') && !ctxNoWinStaged[2].includes("model_context_window"),
    `${ctxNoWinStaged.length} lines`);
  const ctxNoWinOpen = await post("/api/slots/15/open", { cwd: codexCwd, harness: "codex" });
  const ctxNoWinBound = await waitCodex(15, (r) => r.state === "bound");
  check("codex ctx fixture: the window-less slot carries its own pinned UUID before absence is judged",
    ctxNoWinOpen.ok && ctxNoWinBound?.state === "bound" && ctxNoWinBound.sessionId === CTX_NOWIN,
    `${String(ctxNoWinOpen.status)} / ${JSON.stringify(ctxNoWinBound)}`);
  // Read ONCE, not until-null: `ctx` is computed on the request, and a wait-for-absence loop would
  // pass on any absence at all — including one that means the fixture never took.
  const ctxNoWin = await codexCtx(15);
  check("a newest Codex record without a window is absence — no walk back to an older pair, no guessed default",
    ctxNoWin === null, JSON.stringify(ctxNoWin));
  // ...and the discriminator that makes that absence mean what it says: put a window back on the
  // newest record of THE SAME file and the same slot answers. Without this row, "null" could just
  // as well be a file the reader never opened.
  writeFileSync(ctxNoWinPath, `${ctxNoWinStaged[0]}\n${codexTokenCount(115_267, 197_531)}\n${codexTokenCount(120_000, 197_531)}\n`);
  let ctxRestored: CtxFill = null;
  for (let i = 0; i < 20 && ctxRestored === null; i++) {
    ctxRestored = await codexCtx(15);
    if (ctxRestored === null) await Bun.sleep(100);
  }
  check("the same file and slot answer as soon as the newest record names a window — the absence above was the missing denominator",
    ctxRestored?.usedTokens === 120_000 && ctxRestored.windowTokens === 197_531 && ctxRestored.pct === 60.7,
    JSON.stringify(ctxRestored));
  rmSync(ctxNoWinPath, { force: true });
  await post("/api/slots/15/kill", {});

  let disconnectPane = "";
  const paneUntil = Date.now() + 3000;
  do {
    disconnectPane = (await tmuxOut("capture-pane", "-p", "-t", "s16")).out;
    if (disconnectPane.includes("stream disconnected before completion")) break;
    await Bun.sleep(100);
  } while (Date.now() < paneUntil);
  check("Codex disconnect fixture renders the exact marker before the product sensor is judged",
    disconnectPane.includes("stream disconnected before completion"), disconnectPane.slice(-180));
  // tickGit is a 10s interval and deliberately skips a round while its prior pass is busy. Three
  // intervals plus slack prove a successful observation under suite load rather than assuming the
  // first timer callback was free to run.
  const disconnected = await waitCodex(16, (r) => r.disconnectSeenAt !== null, 35_000);
  check("rendered Codex connection loss becomes typed advisory state without restarting the live pane",
    disconnected?.state === "bound" && disconnected.disconnectSeenAt !== null, JSON.stringify(disconnected));
  await tmuxOut("kill-session", "-t", "s16");
  let resumeCmd = "";
  const resumeUntil = Date.now() + 7000;
  do {
    resumeCmd = (await tmuxOut("display-message", "-p", "-t", "s16", "#{pane_start_command}"))
      .out.replaceAll("\\", "");
    if (resumeCmd.includes("codex resume")) break;
    await Bun.sleep(100);
  } while (Date.now() < resumeUntil);
  const resumed = (await codexRow(16))?.codexRecovery ?? null;
  check("a dead bound Codex pane resumes the exact UUID through ensureSlot's only spawn seam",
    resumeCmd.includes(`codex resume '${OLD_A}' ${CODEX_DEFAULT_FLAGS} `) && !resumeCmd.includes("bypass")
      && resumeCmd.includes("--model 'gpt-5-codex'")
      && resumeCmd.includes("-c model_reasoning_effort='high'"), resumeCmd.slice(-260));
  // a PLAIN (non-lane) Codex slot keeps its ambient MCPs on the resume line too — the text-lane override
  // (server.ts#CODEX_TEXT_LANE_MCP) is a lane property and must never reach a MAIN's respawn
  check("a resumed plain Codex slot carries no text-lane playwright override",
    resumeCmd.includes("codex resume") && !resumeCmd.includes("mcp_servers.playwright"), resumeCmd.slice(-260));
  check("the RESUME line of the same Codex slot carries the same three -c context overrides",
    resumeCmd.includes(`codex resume '${OLD_A}'`) && resumeCmd.includes(CTX_FLAGS)
      && !resumeCmd.includes("context_management"), resumeCmd.slice(-360));
  check("resume preserves the owner-selected pin and disconnect advisory", resumed?.sessionId === OLD_A
    && resumed.disconnectSeenAt === disconnected?.disconnectSeenAt, JSON.stringify(resumed));
  const persistedRow = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { slots?: Record<string, {
    codexPaneSpawnedAt?: number; codexDisconnectSeenAt?: number; sessionId?: string }> }).slots?.["16"];
  if (persistedRow?.codexPaneSpawnedAt && persistedRow.codexDisconnectSeenAt && persistedRow.sessionId === OLD_A)
    persistedCodex = { anchor: persistedRow.codexPaneSpawnedAt,
      disconnectSeenAt: persistedRow.codexDisconnectSeenAt, id: OLD_A };
  check("attended Codex bind, anchor and advisory are ready for server-restart persistence",
    persistedCodex !== null, JSON.stringify(persistedRow));

  // --- the Codex context budget on slot 15: ONE slot opened with the same choice without and then
  // with the field, so "absent = today's spawn line" is a byte comparison and not a substring hope.
  // The slot stays open with its budget into the restart below, where (e) breaks it on disk.
  const paneStartCmd = async (slot: number, marker: string): Promise<string> => {
    let cmd = "";
    const until = Date.now() + 7000;
    do {
      const r = await tmuxOut("display-message", "-p", "-t", `s${slot}`, "#{pane_start_command}");
      cmd = r.code === 0 ? r.out.replaceAll("\\", "").trim() : "";
      if (cmd.includes(marker)) break;
      await Bun.sleep(100);
    } while (Date.now() < until);
    return cmd;
  };
  type CtxSlotRow = { id: number; cwd: string | null; openedAt: number; harness?: string; context?: unknown };
  const ctxSlotRow = async (slot: number): Promise<CtxSlotRow | undefined> =>
    ((await (await get("/api/sessions")).json()) as { slots: CtxSlotRow[] }).slots.find((s) => s.id === slot);
  const storedContext = async (slot: number, want: string): Promise<string> => {
    let seen = "";
    for (let i = 0; i < 60; i++) {
      seen = JSON.stringify((JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
        { slots?: Record<string, { context?: unknown }> }).slots?.[String(slot)]?.context ?? null);
      if (seen === want) break;
      await Bun.sleep(50);
    }
    return seen;
  };
  const maskSelfToken = (cmd: string): string => cmd.replace(/FLEET_SELF_TOKEN='[^']*'/g, "FLEET_SELF_TOKEN=…");
  const plainCtxOpen = await post("/api/slots/15/open", { cwd: codexCwd, harness: "codex", model: "gpt-5-codex", effort: "high" });
  const plainCtxCmd = await paneStartCmd(15, CODEX_FRESH);
  const plainCtxRow = await ctxSlotRow(15);
  const plainCtxStored = await storedContext(15, "null");
  const budgetOpen = await post("/api/slots/15/open",
    { cwd: codexCwd, harness: "codex", model: "gpt-5-codex", effort: "high", context: CTX_PROFILE });
  const budgetCmd = await paneStartCmd(15, CTX_FLAGS);
  check("context fixture: slot 15 opened without and then with a budget, both panes on the fresh Codex line",
    plainCtxOpen.ok && budgetOpen.ok && plainCtxCmd.includes(CODEX_FRESH) && budgetCmd.includes(CODEX_FRESH)
      && !plainCtxCmd.includes("bypass") && !budgetCmd.includes("bypass"),
    `${plainCtxOpen.status}/${budgetOpen.status} / ${plainCtxCmd.slice(-120)} / ${budgetCmd.slice(-120)}`);
  check("a Codex slot without context names no context override, shows no context and stores none",
    plainCtxCmd.length > 0 && !plainCtxCmd.includes("model_context_window") && !plainCtxCmd.includes("model_auto_compact")
      && plainCtxRow !== undefined && !("context" in plainCtxRow) && plainCtxStored === "null",
    `${plainCtxCmd.slice(-240)} / ${JSON.stringify(plainCtxRow)} / stored=${plainCtxStored}`);
  check("with and without context the Codex spawn line is byte-identical except for the three overrides",
    budgetCmd.includes(` ${CTX_FLAGS}`) && maskSelfToken(budgetCmd).replace(` ${CTX_FLAGS}`, "") === maskSelfToken(plainCtxCmd),
    `with=${maskSelfToken(budgetCmd).slice(-300)} / without=${maskSelfToken(plainCtxCmd).slice(-300)}`);
  const budgetRow = await ctxSlotRow(15);
  const budgetStored = await storedContext(15, JSON.stringify(CTX_PROFILE));
  check("GET /api/sessions shows the slot's context budget and fleet.json persists the same pair",
    budgetRow?.harness === "codex" && JSON.stringify(budgetRow.context) === JSON.stringify(CTX_PROFILE)
      && budgetStored === JSON.stringify(CTX_PROFILE),
    `${JSON.stringify(budgetRow)} / stored=${budgetStored}`);
  // every refusal goes to the OCCUPIED slot 15, so "nothing stored" is checkable: the occupant, its
  // budget, its persisted pair and its pane must all be the ones the accepted open above produced
  const ctxRefusals: [string, unknown][] = [
    ["the default claude harness", { cwd: codexCwd, context: CTX_PROFILE }],
    ["an explicit claude harness", { cwd: codexCwd, harness: "claude", context: CTX_PROFILE }],
    ["window 900000, above the catalog maximum", { cwd: codexCwd, harness: "codex", context: { window: 900_000, compactAt: 600_000 } }],
    ["compactAt equal to window", { cwd: codexCwd, harness: "codex", context: { window: 700_000, compactAt: 700_000 } }],
    ["compactAt above window", { cwd: codexCwd, harness: "codex", context: { window: 700_000, compactAt: 800_000 } }],
    ["compactAt 0", { cwd: codexCwd, harness: "codex", context: { window: 700_000, compactAt: 0 } }],
    ["window 0", { cwd: codexCwd, harness: "codex", context: { window: 0, compactAt: 0 } }],
    ["a string window", { cwd: codexCwd, harness: "codex", context: { window: "700000", compactAt: 600_000 } }],
    ["a fractional compactAt", { cwd: codexCwd, harness: "codex", context: { window: 700_000, compactAt: 600_000.5 } }],
    ["an extra key", { cwd: codexCwd, harness: "codex", context: { window: 700_000, compactAt: 600_000, scope: "body_after_prefix" } }],
    ["a bare number", { cwd: codexCwd, harness: "codex", context: 700_000 }],
  ];
  for (const [why, body] of ctxRefusals) {
    const r = await post("/api/slots/15/open", body);
    const err = ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "";
    check(`a context budget with ${why} is refused with 400 at open`, r.status === 400 && /context/.test(err), `${r.status} ${err}`);
  }
  const afterRefusalRow = await ctxSlotRow(15);
  const afterRefusalStored = await storedContext(15, JSON.stringify(CTX_PROFILE));
  const afterRefusalCmd = await paneStartCmd(15, CTX_FLAGS);
  check("a refused context open stores nothing — same occupant, same budget, same persisted pair, same pane",
    afterRefusalRow?.openedAt === budgetRow?.openedAt && afterRefusalRow?.harness === "codex"
      && JSON.stringify(afterRefusalRow?.context) === JSON.stringify(CTX_PROFILE)
      && afterRefusalStored === JSON.stringify(CTX_PROFILE) && afterRefusalCmd === budgetCmd,
    `${JSON.stringify(afterRefusalRow)} / stored=${afterRefusalStored}`);
  // Task.spawn: the queue row carries the same field through the same validator
  const ctxTaskText = `context budget row ${process.pid} (restart.ts)`;
  const ctxTask = await post("/api/tasks", { text: ctxTaskText, kind: "notiz", queue: false, harness: "codex", context: CTX_PROFILE });
  const ctxTaskBody = (await ctxTask.json().catch(() => ({}))) as { task?: { id?: string; spawn?: { harness?: string; context?: unknown } } };
  const ctxTaskBad = await post("/api/tasks", { text: `${ctxTaskText} claude`, kind: "notiz", queue: false, context: CTX_PROFILE });
  const ctxTaskRows = ((await (await get("/api/tasks")).json()) as { tasks: { text?: string }[] }).tasks
    .filter((t) => t.text === `${ctxTaskText} claude`).length;
  check("Task.spawn persists a Codex context budget, and a claude row naming one is refused at filing with no row",
    ctxTask.ok && ctxTaskBody.task?.spawn?.harness === "codex"
      && JSON.stringify(ctxTaskBody.task.spawn.context) === JSON.stringify(CTX_PROFILE)
      && ctxTaskBad.status === 400 && ctxTaskRows === 0,
    `${ctxTask.status} ${JSON.stringify(ctxTaskBody.task?.spawn)} / bad=${ctxTaskBad.status} rows=${ctxTaskRows}`);
  if (ctxTaskBody.task?.id) await post(`/api/tasks/${ctxTaskBody.task.id}/delete`, {});

  // --- deploy-gap fact (P-4) setup, consumed in the steward + digest sections below.
  // The dir this suite runs from is a throwaway COPY of the repo (e2e-isolated.sh) and not a git
  // repo at all, so the server is pointed at a dedicated throwaway repo via FLEET_REPO_DIR. It
  // must be its OWN repo, not FLEET_E2E_REPO: the checks commit into it, and the lane/merge tests
  // own the content of that one. Created here because it has to exist BEFORE the server that
  // stamps its boot HEAD — the env rides both restarts below.
  const GAP_REPO = `${process.env.TMPDIR ?? "/tmp"}/fleet-e2e-gaprepo-${process.pid}`;
  const gapGit = (...a: string[]) => Bun.spawnSync(["git", "-C", GAP_REPO, ...a]);
  rmSync(GAP_REPO, { recursive: true, force: true });
  Bun.spawnSync(["mkdir", "-p", GAP_REPO]);
  gapGit("init", "-q", "-b", "main"); // the default branch is a platform accident, not ours
  gapGit("config", "user.email", "t@t");
  gapGit("config", "user.name", "t");
  // The throwaway repo needs an IMPORT GRAPH, not just file names: since 2026-09-07 the deploy-gap
  // reads each path's role off the measured checkout's own graph (server/deploy-classify.ts), so
  // package.json names the bundle entries and server.ts imports the one src/ file it owns. Both
  // targets are committed later by the steward-core checks; a specifier that resolves to nothing
  // yet simply carries no edge, and gains one the moment the file appears.
  // ASSEMBLED, never spelled: e2e-stage.sh scans this file for relative specifiers and would try to
  // resolve them against e2e/, where neither exists — a fatal refusal to boot, and it would be right.
  const gapImport = (spec: string): string => `import ${JSON.stringify(spec)};`;
  writeFileSync(`${GAP_REPO}/package.json`, JSON.stringify({
    scripts: {
      build: "bun build src/client.ts --outfile public/app.js && bun build src/helper.ts --outfile public/helper.js",
    },
  }));
  writeFileSync(`${GAP_REPO}/server.ts`,
    `${gapImport("./src/protocol")}\n// the build the server boots from\n`);
  gapGit("add", "-A");
  gapGit("commit", "-qm", "init");
  const gapEnv = `FLEET_REPO_DIR='${GAP_REPO}' `;
  // …and into THIS process's env as well, which is not redundant: harness.restartSrv() rebuilds the
  // server's env line from process.env, so a module that restarts srv after this one would silently
  // drop a server-ONLY variable and every deploy-gap/bundle-staleness fact below it would go null
  // while still looking like a real failure. Measured exactly that way (12 reds in steward-core,
  // 2026-08-03, when another module started restarting srv further down the run). Planting it here
  // makes process.env the single source restartSrv already reads, for every future caller.
  process.env.FLEET_REPO_DIR = GAP_REPO;

  // --- per-repo worker override: the owner's whole ask was a SETTING, not an env flip, so its
  // load-bearing property is that it outlives an srv restart (the deploy ritual runs ~10×/day and
  // would otherwise silently move a repo's diffs back to the fleet-wide default). Planted on the
  // SECOND repo on purpose — the commit tests in e2e/lanes-basic.ts own the first one's entry, and
  // two modules writing the same key would make whichever ran second the only real assertion.
  const workerRepo = process.env.FLEET_E2E_REPO2 ?? "";
  // the second repo's sibling stand-in, created by e2e-isolated.sh next to it. Set only when
  // REPO2 is, which is the same condition as the guard below.
  const workerCmd = `${workerRepo.replace(/\/[^/]+$/, "")}/fakecommit2`;
  let workerCanon = "";
  if (workerRepo) {
    const wr = (await (await post("/api/repo-worker", { repo: workerRepo, worker: "commitMsg", cmd: workerCmd })).json()) as
      { ok?: boolean; repo?: string };
    workerCanon = wr.repo ?? "";
    check("repo-worker override planted before the restart", wr.ok === true && !!workerCanon, JSON.stringify(wr));
  }

  // A named harness is persisted as its id, then resolved back through HARNESSES after boot. Keep
  // a real pi-zai slot alive across the server restart and force one later pane heal: the first
  // proves loadState retained the id, the second proves harnessOf did not fall back to Claude.
  const PI_ZAI_PERSIST_SLOT = 14;
  await post(`/api/slots/${PI_ZAI_PERSIST_SLOT}/kill`, {});
  // Stale the shared scratch catalogue first, so the check below can only pass if THIS slot's
  // spawn rewrote it — a leftover two-entry file from an earlier probe must not answer for it.
  try { writeFileSync(`${process.env.FLEET_PI_ZAI_AGENT_DIR}/models.json`, "{}\n"); } catch { /* dir absent — the spawn creates it */ }
  const piZaiPersistOpen = await post(`/api/slots/${PI_ZAI_PERSIST_SLOT}/open`,
    { cwd: codexCwd, harness: "pi-zai", effort: "low" });
  let piZaiPersistState: { harness?: string; sessionId?: string } | undefined;
  for (let i = 0; i < 60; i++) {
    piZaiPersistState = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { harness?: string; sessionId?: string }> }).slots?.[String(PI_ZAI_PERSIST_SLOT)];
    if (piZaiPersistState?.harness === "pi-zai" && /^[0-9a-f-]{36}$/.test(piZaiPersistState.sessionId ?? "")) break;
    await Bun.sleep(50);
  }
  check("pi-zai restart fixture persists its harness id and pinned Pi session before srv restart",
    piZaiPersistOpen.ok && piZaiPersistState?.harness === "pi-zai"
      && /^[0-9a-f-]{36}$/.test(piZaiPersistState.sessionId ?? ""),
    `${piZaiPersistOpen.status} / ${JSON.stringify(piZaiPersistState)}`);
  // The fixture opened WITHOUT a model pin, so its pane line is the adapter's default tier — the
  // one behaviour the second model must not disturb. Captured before the restart below, because
  // the restart's heal check asserts the same line from the respawned pane.
  const piZaiDefaultCmd = piZaiPersistOpen.ok
    ? (await tmuxOut("display-message", "-p", "-t", `s${PI_ZAI_PERSIST_SLOT}`, "#{pane_start_command}")).out.replaceAll("\\", "")
    : "";
  let piZaiCatalogIds: string[] = [];
  for (let i = 0; i < 80; i++) { // ceiling ~8 s — the write lands within one pane boot, which a
    // loaded box (the 2026-09-15 helper preview) can stretch past the 2 s this poll used to allow
    try {
      piZaiCatalogIds = (JSON.parse(readFileSync(`${process.env.FLEET_PI_ZAI_AGENT_DIR}/models.json`, "utf8")) as
        { providers?: { zai?: { models?: { id: string }[] } } }).providers?.zai?.models?.map((m) => m.id) ?? [];
      if (piZaiCatalogIds.length === 2) break;
    } catch { /* not rewritten yet — the poll is the wait */ }
    await Bun.sleep(100);
  }
  check("pi-zai without a model pin spawns the default tier --model 'glm-5.3' while the catalogue it writes carries both models",
    piZaiDefaultCmd.includes("pi --provider zai --model 'glm-5.3'")
      // the negative is FLAG-scoped, not line-scoped: the spawn line embeds the whole catalogue
      // (printf ... > models.json), so "glm-5.3-flash" legitimately appears in it on every spawn —
      // only the --model flag's own quoted value says which tier this pane runs
      && !piZaiDefaultCmd.includes("--model 'glm-5.3-flash'")
      && piZaiCatalogIds.length === 2 && piZaiCatalogIds[0] === "glm-5.3" && piZaiCatalogIds[1] === "glm-5.3-flash",
    `${piZaiDefaultCmd.slice(-200)} / ${JSON.stringify(piZaiCatalogIds)}`);

  // --- restart persistence ---
  const srvKill = Bun.spawn(["tmux", "-L", SOCK, "kill-session", "-t", "srv"]);
  await srvKill.exited;
  await Bun.sleep(500);
  // server down → the state file is quiescent: strip baseSha from the legacy lane's persisted
  // worktree record, so the restarted server restores it in its pre-field shape
  if (legacyLane) {
    const stFile = `${ROOT}/fleet.json`;
    let st: { slots?: Record<string, { worktree?: { baseSha?: string } | null }> } | null = null;
    let stError = "";
    try { st = JSON.parse(readFileSync(stFile, "utf8")) as
      { slots?: Record<string, { worktree?: { baseSha?: string } | null }> }; }
    catch (e) { stError = e instanceof Error ? e.message : String(e); }
    check("precondition: fleet state is readable before legacy-lane mutation", st !== null, stError);
    const wtRec = st?.slots?.[String(legacyLane.slot)]?.worktree;
    if (wtRec) delete wtRec.baseSha;
    if (st) writeFileSync(stFile, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
  // server down → the state file is quiescent: pin BOTH written shapes before the boot. The clone
  // lane's record carries form:"clone" (the writer's only written value); the legacy lane — a
  // worktree lane written by today's writer — carries NO form key, the byte-identical pre-field
  // shape the write-site comment demands. Without this pre-boot half, a restore that INVENTED a
  // form for worktree lanes could not be told apart from one that carries the field faithfully.
  if (cloneLane && legacyLane) {
    const stFile = `${ROOT}/fleet.json`;
    let st: { slots?: Record<string, { worktree?: { form?: string } | null }> } | null = null;
    let stError = "";
    try { st = JSON.parse(readFileSync(stFile, "utf8")) as
      { slots?: Record<string, { worktree?: { form?: string } | null }> }; }
    catch (e) { stError = e instanceof Error ? e.message : String(e); }
    const clRec = st?.slots?.[String(cloneLane.slot)]?.worktree;
    const lgRec = st?.slots?.[String(legacyLane.slot)]?.worktree;
    check("precondition: the clone lane's state record carries form:\"clone\" as written",
      !!clRec && clRec.form === "clone", `${stError} ${JSON.stringify(clRec)}`);
    check("precondition: the worktree lane's state record carries NO form key (byte-identical shape)",
      !!lgRec && !("form" in lgRec), `${stError} ${JSON.stringify(lgRec)}`);
  }
  // server down → break slot 15's persisted context budget (window above the ceiling). The loader must
  // bring the slot back with the field absent, never drop the slot or keep the out-of-bounds pair.
  {
    const stFile = `${ROOT}/fleet.json`;
    let st: { slots?: Record<string, { harness?: string; context?: unknown }> } | null = null;
    let stError = "";
    try { st = JSON.parse(readFileSync(stFile, "utf8")) as { slots?: Record<string, { harness?: string; context?: unknown }> }; }
    catch (e) { stError = e instanceof Error ? e.message : String(e); }
    const rec = st?.slots?.["15"];
    const had = JSON.stringify(rec?.context ?? null);
    if (rec) rec.context = { window: 900_000, compactAt: 600_000 };
    if (st) writeFileSync(stFile, JSON.stringify(st, null, 2), { mode: 0o600 });
    check("precondition: slot 15 persisted its Codex context budget and it is broken on disk before the restart",
      rec?.harness === "codex" && had === JSON.stringify(CTX_PROFILE), `${stError} ${JSON.stringify(rec)} had=${had}`);
  }
  // --- context-size proxy setup (consumed in the steward section below): the fact is PINNED-slot
  // only, and this suite runs with FLEET_CMD=true, so no slot ever gets a session uuid pinned at
  // pane creation (server.ts: only a claude BASE_CMD pins one). The one legitimate way in is the
  // same door the server itself uses on a deploy — restore from the state file — so a uuid is
  // planted for the surviving slot 2 while the server is down, and the transcript that uuid names
  // is written after the restart (its cwd is only known from the API).
  // PER RUN, never a constant — see newPlantedSid above for what a constant here cost.
  const PLANTED_SID = newPlantedSid();
  const PLANTED_MODEL = "claude-haiku-4-5"; // a 200k window, unlike the fleet default (bare claude-sonnet-5 is 1M since 2026-09-19)
  {
    const stFile = `${ROOT}/fleet.json`;
    type PlantSlot = { cwd?: string; sessionId?: string; model?: string; openedAt?: number; handover?: unknown };
    let st: { slots?: Record<string, PlantSlot> } | null = null;
    let stError = "";
    try { st = JSON.parse(readFileSync(stFile, "utf8")) as { slots?: Record<string, PlantSlot> }; }
    catch (e) { stError = e instanceof Error ? e.message : String(e); }
    check("precondition: fleet state is readable before context fixture mutation", st !== null, stError);
    const rec = st?.slots?.["2"];
    if (rec) rec.sessionId = PLANTED_SID;
    // ...and a model that is NOT the fleet default, for the context-FILL checks that share this
    // fixture. The default is a [1m] variant, so a sensor that hardcoded a 1M denominator would
    // pass against it by accident; pinning the 200k twin here is what makes the live pct assertion
    // able to fail. Restored from the state file like every other slot field (server.ts, SLOT_MODEL_RE).
    if (rec) rec.model = PLANTED_MODEL;
    // K9 S3b-2: steward-core plants 150 349 of this 200k window (75 %) — over the cap, where the fleet's value
    // is now a new session. Slot 2 chose „nur Hinweis“, or Fleet hands it over under the api-error checks
    // that read its transcript (core run 1014094103: five reds, the slot at session 2).
    if (rec) rec.handover = { thresholdPct: null, nudge: true, keepCache: null, keepCacheIdleMin: 50, atThreshold: "hint",
      setAt: Date.now(), occupant: { slot: 2, openedAt: rec.openedAt } };
    if (st) writeFileSync(stFile, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
  // inherit FLEET_CMD rather than hardcoding one — restarting with a baked-in
  // `--dangerously-skip-permissions` would silently leave the server in unattended
  // mode after the test run, an escalation the README promises is explicit opt-in
  // FLEET_DISPATCH_REPO + the fake-agent cmds must ride across too, or every post-restart test
  // meets a server whose dispatcher is permanently unavailable and whose merge/summary/commit
  // agents are the real `claude` instead of the suite's stand-ins.
  // FLEET_VERIFY_CMD is DELIBERATELY excluded here (do not add it): the post-restart server
  // must run with NO verify command so the V1 "no cmd → verify field absent, clean path lands
  // as today" case below is exercised against a genuinely unconfigured server (§3). The
  // configured-server verify cases run before this restart.
  // FLEET_VERIFY_CMD_REPOS, by contrast, IS carried — and only because the global is not. That
  // pairing is the third resolution state and the only server on which it exists: a per-repo map
  // is configured, and a repo named in NEITHER it nor the (absent) global has no gate at all.
  // "kein Eintrag" must stay `verify` ABSENT — unconfigured, never a silent green (P-7c).
  const cmdEnv = ["FLEET_DISK_MIN_FREE_GIB", "FLEET_DISK_WRITER_GIB", "FLEET_CMD", "FLEET_ALLOWED_HOSTS", "FLEET_SHARE_HOSTS", "FLEET_AUDIT_ROTATE_BYTES",
    "FLEET_DISPATCH_REPO", "FLEET_VERIFY_CMD_REPOS", "FLEET_CODEX_SESSIONS_DIR",
    "FLEET_PI_ZAI_AGENT_DIR", "FLEET_PI_ZAI_KEY_FILE",
    // without it the restarted server builds no pi-zai fence and the heal below starts no pi
    "FLEET_PI_ZAI_DENY_ROOTS",
    // set only off darwin (e2e-isolated.sh): dropped, the restarted server would refuse every pi-zai start there
    "FLEET_PI_ZAI_SANDBOX_EXEC",
    // without these the post-restart server reverts to the 60s idle gate / 15s tick and no
    // auto-③ can be observed inside the suite's budget
    "FLEET_AUTO_REVIEW_MS", "FLEET_AUTO_REVIEW_IDLE_MS",
    // same reason, for the two scheduler ticks: dropping them here would silently restore the
    // 5s/8s production intervals for everything that runs after this restart (steward-outcomes
    // polls for a dispatch), while the harness kept sizing its windows from the wrapper's value.
    // This list is hand-kept — harness.restartSrv() forwards every FLEET_* and this one does not
    // — so a new server knob has to be added in both places.
    "FLEET_AUTOS_TICK_MS", "FLEET_DISPATCH_TICK_MS",
    // and the land/commit idle gate: e2e/lane-helpers.ts#settleForMerge waits the wrapper's value,
    // so a server restarted here without it would gate at the 3 s production default and refuse
    // every land the helper already calls settled
    "FLEET_MERGE_IDLE_MS",
    // and the three other server wait windows the wrapper shortens (SRV_ENV in e2e-isolated.sh):
    // dropped here, the post-restart server reverts to the production 10 s tick and 4 s / 3 s boot
    // windows while every harness helper keeps sizing its windows from the wrapper's value — the
    // same two-numbers-for-one-gate failure the line above describes, and on the git tick it would
    // silently put the ~190 s this cut removes back into everything that runs after this restart.
    "FLEET_GIT_TICK_MS", "FLEET_FOUNDING_BOOT_GRACE_MS", "FLEET_SEND_BOOT_WAIT_MS",
    // without this the post-restart server reverts to the prod journal cap (6) and the honest
    // filter-then-count cap 429s the later anchor fixtures — the leaky slice-window cap used to
    // let exactly those extra POSTs through, which is how this gap stayed invisible until the fix
    "FLEET_STEWARD_JOURNAL_PER_HOUR",
    // and the steward send idle gate: steward-core.ts#settleForSteward waits the wrapper's 800 ms,
    // so a server restarted here without it gates typed sends at the 60 s default and answers
    // "target slot not idle" to a settled lane. Invisible in the full suite only because
    // verify-queue/deploy-facts/errors call harness.restartSrv() in between and restore it;
    // `--shard 1/4` (core alone) failed five steward checks on it, twice, 2026-09-13/14.
    "FLEET_STEWARD_MIN_IDLE_MS",
    "FLEET_SUMMARY_CMD", "FLEET_ENHANCE_CMD", "FLEET_MERGE_CMD", "FLEET_COMMIT_CMD", "FLEET_DIGEST_CMD",
    "FLEET_REVIEW_CMD"]
    .filter((k) => process.env[k])
    .map((k) => `${k}='${process.env[k]!.replaceAll("'", "'\\''")}' `)
    .join("");
  // restart the server from wherever THIS suite lives (the isolated copy during
  // e2e-isolated.sh runs, the repo itself when run against the live instance),
  // carrying the port/socket so the restarted server is the same instance we tested
  const srvStart = Bun.spawn(["tmux", "-L", SOCK, "new-session", "-d", "-s", "srv",
    `cd '${ROOT}' && FLEET_HOST=${IP} FLEET_PORT=${PORT} FLEET_SOCK=${SOCK} ${cmdEnv}${gapEnv}exec bun server.ts >> server.log 2>&1`]);
  await srvStart.exited;
  await Bun.sleep(3000);
  const api = (await (await get("/api/sessions")).json()) as
    { now: number; slots: { id: number; cwd: string | null; label: string | null; lastOutput: number;
      harness?: string; codexRecovery?: CodexRecoveryView; context?: unknown }[] };
  check("after restart: slot 2 still active", typeof api.slots[1].cwd === "string", String(api.slots[1].cwd));
  check("after restart: slot 1 still empty", api.slots[0].cwd === null);
  check("after restart: label persisted", api.slots[1].label === "research-agent");
  const piZaiAfterRestart = api.slots.find((s) => s.id === PI_ZAI_PERSIST_SLOT);
  check("after restart: a saved pi-zai slot still resolves as pi-zai, never the default adapter",
    piZaiAfterRestart?.harness === "pi-zai", JSON.stringify(piZaiAfterRestart));
  await tmuxOut("kill-session", "-t", `s${PI_ZAI_PERSIST_SLOT}`);
  let piZaiHealCmd = "";
  const piZaiHealUntil = Date.now() + 7000;
  do {
    piZaiHealCmd = (await tmuxOut("display-message", "-p", "-t", `s${PI_ZAI_PERSIST_SLOT}`,
      "#{pane_start_command}")).out.replaceAll("\\", "");
    if (piZaiHealCmd.includes("pi --provider zai --model 'glm-5.3'")) break;
    await Bun.sleep(100);
  } while (Date.now() < piZaiHealUntil);
  check("after restart: harnessOf heals the saved slot through pi-zai with its exact pinned provider/model",
    piZaiHealCmd.includes("pi --provider zai --model 'glm-5.3'")
      && /--session-id [0-9a-f-]{36}\b/.test(piZaiHealCmd) && piZaiHealCmd.includes("--thinking low"),
    piZaiHealCmd.slice(-280));
  await post(`/api/slots/${PI_ZAI_PERSIST_SLOT}/kill`, {});
  // The slot is free again, so the OPEN door answers the model question on this very fixture: a
  // third model is refused before anything is spawned, and the sentence names both allowed ids.
  const piZaiBadOpen = await post(`/api/slots/${PI_ZAI_PERSIST_SLOT}/open`,
    { cwd: codexCwd, harness: "pi-zai", model: "glm-9" });
  const piZaiBadOpenText = await piZaiBadOpen.text();
  check("pi-zai refuses a third model at open: 400 naming exactly glm-5.3 and glm-5.3-flash",
    piZaiBadOpen.status === 400 && piZaiBadOpenText.includes("glm-5.3") && piZaiBadOpenText.includes("glm-5.3-flash"),
    `${piZaiBadOpen.status} ${piZaiBadOpenText}`);
  const ctxRow16After = api.slots.find((s) => s.id === 16);
  check("after restart: a Codex slot's context budget loads as persisted",
    ctxRow16After?.harness === "codex" && JSON.stringify(ctxRow16After.context) === JSON.stringify(CTX_PROFILE),
    JSON.stringify(ctxRow16After));
  const ctxRow15After = api.slots.find((s) => s.id === 15);
  check("after restart: a broken persisted context budget loads as absent and the slot stays",
    typeof ctxRow15After?.cwd === "string" && ctxRow15After.harness === "codex" && !("context" in ctxRow15After),
    JSON.stringify(ctxRow15After));
  await post("/api/slots/15/kill", {});
  const codexAfterRestart = api.slots.find((s) => s.id === 16)?.codexRecovery;
  const codexStateAfterRestart = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
    { slots?: Record<string, { codexPaneSpawnedAt?: number }> }).slots?.["16"];
  check("after restart: a live Codex pane keeps its exact bind, anchor and disconnect advisory without a second spawn",
    !!persistedCodex && codexAfterRestart?.state === "bound"
      && codexAfterRestart.sessionId === persistedCodex.id
      && codexAfterRestart.disconnectSeenAt === persistedCodex.disconnectSeenAt
      && codexStateAfterRestart?.codexPaneSpawnedAt === persistedCodex.anchor,
    `${JSON.stringify(codexAfterRestart)} / ${JSON.stringify(codexStateAfterRestart)}`);
  await post("/api/slots/16/kill", {});
  if (workerCanon) {
    const wrAfter = (await (await get("/api/repo-workers")).json()) as { workers?: Record<string, Record<string, string>> };
    check("after restart: the per-repo worker override survived (it is a stored setting, not an env flip)",
      wrAfter.workers?.[workerCanon]?.commitMsg === workerCmd, JSON.stringify(wrAfter.workers));
    await post("/api/repo-worker", { repo: workerRepo, worker: "commitMsg", cmd: "" });
  }
  // A restored pane must not read as idle since the epoch. `offset` is seeded so pre-restart bytes
  // are not replayed, which means nothing sets `lastOutput` until the pane's NEXT byte — and a pane
  // blocked on a long tool call may emit none for minutes. Two consumers act on that number
  // (canDeliver's busy gate; the idle clause of done-looking), so leaving it 0 disarms both on
  // every deploy. Asserting the gap is SMALL is what fails if the boot stamp is ever removed: the
  // unfixed reading is ~1.79e12 ms, not a near-miss.
  const idleAfterBoot = api.now - api.slots[1].lastOutput;
  check("after restart: a restored pane is idle-since-boot, never idle-since-the-epoch",
    api.slots[1].lastOutput > 0 && idleAfterBoot >= 0 && idleAfterBoot < 60_000,
    `now-lastOutput=${idleAfterBoot}ms lastOutput=${api.slots[1].lastOutput}`);
  // the planted uuid rode the restore, so slot 2 is now a PINNED slot: give it a transcript of a
  // KNOWN byte size, which the context-size-proxy checks in the steward section read back.
  const PLANTED_TR_BYTES = 4097;
  const PLANTED_TR = api.slots[1].cwd
    ? `${process.env.HOME}/.claude/projects/${api.slots[1].cwd.replace(/[^a-zA-Z0-9]/g, "-")}/${PLANTED_SID}.jsonl`
    : null;
  if (PLANTED_TR) await Bun.write(PLANTED_TR, "x".repeat(PLANTED_TR_BYTES - 1) + "\n");
  // guards fix A: the lane's selfToken must survive the restart. The lane pane still holds
  // the token baked at spawn; the restarted server must restore the SAME token from state,
  // so a /api/self/autos call authed with the pre-restart token still succeeds.
  if (ctx.restartSelfTok) {
    const restRes = await fetch(BASE + "/api/self/autos", {
      method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": ctx.restartSelfTok },
      body: JSON.stringify({ text: "post-restart self check-in", inSec: 3600 }),
    });
    const restJ = (await restRes.json()) as { ok?: boolean; auto?: { id: string; slot: number } };
    check("after restart: lane selfToken still authorizes /api/self/autos (persisted, not rotated)",
      restRes.ok && restJ.auto?.slot === ctx.restartSelfSlot, `${restRes.status} ${JSON.stringify(restJ)}`);
    if (restJ.auto) await post(`/api/autos/${restJ.auto.id}/delete`, {});
    await post(`/api/slots/${ctx.restartSelfSlot}/kill`, {}); // tear the persistence lane down
  }

  // --- form on the SAME boot (both fixtures opened before the restart, records pinned while the
  // server was down): the restore must carry `form` exactly as it carries `letter` — only as
  // written. BOTH directions ride this ONE boot: the clone lane comes back a clone lane, and the
  // worktree lane still carries NO form key. Taking the field back out of the restore turns
  // exactly this check red (the clone half dies; the worktree half alone cannot prove carriage). ---
  if (cloneLane && legacyLane) {
    const sessF = (await (await get("/api/sessions")).json()) as
      { slots: { id: number; worktree?: { form?: string } | null }[] };
    const wtC = sessF.slots.find((x) => x.id === cloneLane.slot)?.worktree;
    const wtW = sessF.slots.find((x) => x.id === legacyLane.slot)?.worktree;
    check("after restart: form is carried exactly as written — the clone lane is still a clone lane, the worktree lane still has no form key",
      !!wtC && wtC.form === "clone" && !!wtW && !("form" in wtW),
      `clone=${JSON.stringify(wtC)} worktree=${JSON.stringify(wtW)}`);
    // teardown before the legacy block below kills its own lane: with the fix the kill removes the
    // clone itself (removeWorktreeSafe's clone branch, form restored); the rmSync + branch delete
    // are the belt for a red run, where the lane is kept and the dir and its mirrored branch stay.
    await post(`/api/slots/${cloneLane.slot}/kill`, {});
    if (existsSync(cloneLane.cwd)) rmSync(cloneLane.cwd, { recursive: true, force: true });
    spawnSync("git", ["branch", "-qD", cloneLane.branch], { cwd: legacyRepo });
  }

  // --- the pre-baseSha lane (set up before the kill-semantics section, field stripped from state
  // above): its outcome record must still be assembled off the base NAME — the optional field is a
  // preference, never a requirement, and an old lane must not silently record nothing. ---
  if (legacyLane) {
    const sessL = (await (await get("/api/sessions")).json()) as
      { slots: { id: number; worktree?: { base?: string; baseSha?: string } | null }[] };
    const wtL = sessL.slots.find((x) => x.id === legacyLane!.slot)?.worktree;
    check("legacy lane: restored WITHOUT baseSha (pre-field lane shape)",
      !!wtL && wtL.baseSha === undefined && typeof wtL.base === "string", JSON.stringify(wtL));
    await post(`/api/slots/${legacyLane.slot}/kill`, {});
    const recL = ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
      { outcomes: { branch: string | null; disposition: string; commitCount: number; base: string | null; filesTouched: string[] }[] })
      .outcomes.find((o) => o.branch === legacyLane!.branch);
    check("legacy lane with NO baseSha still records off the base name (unchanged fallback)",
      recL?.disposition === "killed-dirty" && recL?.commitCount === 1
      && typeof recL?.base === "string" && (recL?.filesTouched ?? []).includes("legacy.txt"), JSON.stringify(recL));
  }

  // --- V1 case C: an UNCONFIGURED server (no FLEET_VERIFY_CMD — deliberately dropped from
  // cmdEnv above). The verify field must be ABSENT from the verdict ("unverified", never
  // silently green — design note §3), and today's clean-path behavior is otherwise unchanged.
  // A CONFLICT lane keeps its verdict readable (a clean land tears the slot down), so we can
  // assert the field's absence directly; that resolved path is exactly where verify WOULD run
  // were a command configured. ---
  {
    const REPO_C = process.env.FLEET_E2E_REPO ?? "";
    if (REPO_C) {
      const modeFile = `${REPO_C.replace(/\/[^/]+$/, "")}/mergemode`;
      await Bun.write(modeFile, "do"); // fakemerge (carried across the restart) really resolves
      const lc = (await (await post("/api/lanes", { repo: REPO_C })).json()) as { slot: number; cwd: string };
      await Bun.write(`${lc.cwd}/code.txt`, "root\nnoverify-lane\n");
      spawnSync("git", ["-C", lc.cwd, "commit", "-aqm", "noverify lane work"]);
      await Bun.write(`${REPO_C}/code.txt`, "root\nnoverify-main\n"); // same line → conflict → agent
      spawnSync("git", ["-C", REPO_C, "commit", "-aqm", "noverify main work"]);
      // settle: wait until the lane pane has been idle ≥ MERGE_IDLE_MS (3s) so the land gate lets
      // the merge start (mirrors the in-block settleForMerge, which is out of scope here)
      for (let i = 0; i < 80; i++) {
        const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
        const sl = sx.slots.find((x) => x.id === lc.slot);
        if (sl && sx.now - sl.lastOutput >= 3000) break;
        await Bun.sleep(150);
      }
      await post(`/api/slots/${lc.slot}/merge`, {});
      let lastC: { status?: string; verify?: unknown } | null = null;
      for (let i = 0; i < 100; i++) {
        const j = (await (await get(`/api/slots/${lc.slot}/merge`)).json()) as
          { running?: boolean; last: { status?: string; verify?: unknown } | null };
        if (!j.running) { lastC = j.last; break; }
        await Bun.sleep(100);
      }
      check("V1: with NO FLEET_VERIFY_CMD the resolved verdict omits the verify field (unverified, not silently green)",
        lastC?.status === "resolved" && lastC !== null && !("verify" in lastC), JSON.stringify(lastC));
      await post(`/api/slots/${lc.slot}/kill`, {});

      // P-7c, the THIRD resolution state — the one no other server in this suite can hold. This
      // server carries the per-repo MAP (forwarded above) but no global default, and testrepo3 is
      // named in neither. That is "kein Eintrag", and it must land in the SAME state as an
      // entirely unconfigured deployment: field absent, not `null`, and above all not green.
      // The distinction being defended: `verify: null` is a gate that ran and returned no verdict
      // (skipped / timed out / waited out) and never auto-lands; an ABSENT field is the owner's
      // deployment-wide „[Zitat entfernt]“ and lands as it always has. Collapsing the two in either
      // direction is a silent policy change — which is why this asserts the KEY's absence and not
      // a falsy value.
      const REPO3_C = process.env.FLEET_E2E_REPO3 ?? "";
      // its own precondition: with no fixture repo nothing below was measured, and that must fail
      // as itself rather than as "per-repo fallback is broken"
      check("V1 setup: the no-entry fixture repo exists (precondition for the absent-verify check)",
        !!REPO3_C && existsSync(REPO3_C), REPO3_C || "(FLEET_E2E_REPO3 unset)");
      if (REPO3_C && existsSync(REPO3_C)) {
        const l3 = (await (await post("/api/lanes", { repo: REPO3_C })).json()) as { slot: number; cwd: string };
        // conflict on the SAME file+line, so the verdict is `resolved` and READABLE — a clean
        // rebase with no verify configured auto-lands and tears the slot down with the answer
        await Bun.write(`${l3.cwd}/code.txt`, "root\nno-entry-lane\n");
        spawnSync("git", ["-C", l3.cwd, "commit", "-aqm", "no-entry lane work"]);
        await Bun.write(`${REPO3_C}/code.txt`, "root\nno-entry-main\n");
        spawnSync("git", ["-C", REPO3_C, "commit", "-aqm", "no-entry main work"]);
        for (let i = 0; i < 80; i++) {
          const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
          const sl = sx.slots.find((x) => x.id === l3.slot);
          if (sl && sx.now - sl.lastOutput >= 3000) break;
          await Bun.sleep(150);
        }
        await post(`/api/slots/${l3.slot}/merge`, {});
        let last3: { status?: string; verify?: unknown } | null = null;
        for (let i = 0; i < 100; i++) {
          const j = (await (await get(`/api/slots/${l3.slot}/merge`)).json()) as
            { running?: boolean; last: { status?: string; verify?: unknown } | null };
          if (!j.running) { last3 = j.last; break; }
          await Bun.sleep(100);
        }
        check("P-7c: a repo in NEITHER the per-repo map nor the global omits the verify field entirely (absent, not null)",
          last3?.status === "resolved" && last3 !== null && !("verify" in last3), JSON.stringify(last3));
        await post(`/api/slots/${l3.slot}/kill`, {});
      }

      // The OTHER half of case C, and the counterweight to the tri-state skip gate: "no verify
      // command configured" must keep BOTH halves of its existing shape — no verify field, and a
      // clean rebase still auto-lands unattended. That is the owner's deployment-wide decision and
      // the skip fix deliberately does not touch it (server.ts, grep VERIFY_SKIP_EXIT); only a
      // CONFIGURED command that declines to run loses the auto-land. The ledger row must still say
      // `verified: null` — an unverified land is recorded as unverified, never as green.
      const lu = (await (await post("/api/lanes", { repo: REPO_C })).json()) as { slot: number; cwd: string; branch: string };
      await Bun.write(`${lu.cwd}/noverify-clean.txt`, "clean lane work, no verify command anywhere\n");
      spawnSync("git", ["-C", lu.cwd, "add", "noverify-clean.txt"]);
      // RETRY, and assert: the server polls every lane worktree's git state on a timer (lane
      // signals, auto-③), and a poll holding `index.lock` makes a one-shot `git commit` fail —
      // observed here, leaving a lane with nothing to land and turning the land check into a
      // false red about the server. A committed lane is this check's PRECONDITION, so it is
      // waited for and asserted rather than assumed.
      let committedU = false;
      for (let i = 0; i < 20 && !committedU; i++) {
        committedU = spawnSync("git", ["-C", lu.cwd, "commit", "-qm", "noverify clean lane work"]).status === 0;
        if (!committedU) await Bun.sleep(150);
      }
      check("V1 setup: the unconfigured-verify lane committed its work (precondition for the land below)",
        committedU, spawnSync("git", ["-C", lu.cwd, "status", "--porcelain"]).stdout.toString().trim());
      await Bun.write(`${REPO_C}/noverify-main.txt`, "main side\n"); // different file → clean rebase, no agent
      spawnSync("git", ["-C", REPO_C, "add", "noverify-main.txt"]);
      spawnSync("git", ["-C", REPO_C, "commit", "-qm", "noverify main work"]);
      for (let i = 0; i < 80; i++) {
        const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
        const sl = sx.slots.find((x) => x.id === lu.slot);
        if (sl && sx.now - sl.lastOutput >= 3000) break;
        await Bun.sleep(150);
      }
      await post(`/api/slots/${lu.slot}/merge`, {});
      let landedU = false;
      for (let i = 0; i < 200; i++) {
        const r = await get(`/api/slots/${lu.slot}/merge`);
        if (r.status === 400) { landedU = true; break; } // slot torn down = the lane landed
        if (!((await r.json()) as { running?: boolean }).running) break;
        await Bun.sleep(100);
      }
      const uOne = landedAsOne(REPO_C, "main"); // 261011: one commit, the lane's under lane-history
      check("V1: with NO FLEET_VERIFY_CMD a clean rebase still auto-lands (unconfigured ≠ skipped)",
        landedU && uOne.ok && uOne.subjects.includes("noverify clean lane work"),
        JSON.stringify(uOne));
      const ouAll = ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
        { outcomes: { branch: string | null; disposition: string; verified: boolean | null }[] }).outcomes;
      const ou = ouAll.find((o) => o.branch === lu.branch);
      check("V1: the unconfigured-verify auto-land records verified:null (no verify ran — never green)",
        ou?.disposition === "landed" && ou.verified === null, JSON.stringify(ou));
      // a land tears the slot down; if anything above went sideways it did NOT, and a lane left
      // sitting in a slot breaks later sections that expect that slot free. Unconditional cleanup:
      // this check must fail alone, never take the sections after it down with it.
      if (!landedU) await post(`/api/slots/${lu.slot}/kill`, {});

      await Bun.write(modeFile, "blocked"); // restore the default merge mode
    }
  }

  const rec2 = (await (await get("/api/dirs?path=~")).json()) as { recents: string[] };
  check("after restart: recents persisted", rec2.recents.length >= 2, JSON.stringify(rec2.recents));
  const h2b = (await (await get("/api/slots/2/history")).json()) as { history: { text: string }[] };
  check("after restart: history persisted", h2b.history.some((h) => h.text === "compose-box-to-slot-two"), `${h2b.history.length} entries`);
  const plogAfter = await plogRead();
  // WEAKENED 2026-08-08, deliberately and visibly: this used to also require an entry with
  // source "share", which only the guest send route could produce. That route was removed with
  // the interactive share mode, so the second half is no longer producible — not broken. The
  // "share" source itself survives in the type: old logs still carry those lines.
  check("after restart + slot kills: prompt log intact",
    plogAfter.some((e) => e.text === "compose-box-to-slot-two"), `${plogAfter.length} entries`);
  const shPAuth = await post(`/s/${ctx.shPersistId}/auth`, { password: "persistpass1" });
  check("after restart: share persisted and answers", shPAuth.ok);
  // the size a guest builds its grid from must be TMUX TRUTH, not the fresh process's
  // 200×50 default — the restart is exactly the moment the in-memory cache dies while
  // the pane keeps the size the last client set (regression: every deploy desynced /info)
  {
    // resize the pane BEHIND the server's back (raw tmux, not /resize) — the server cache
    // still holds the old size, so only a live tmux read can answer correctly
    await tmuxOut("resize-window", "-t", "s2", "-x", "77", "-y", "31");
    const shPCookie = (shPAuth.headers.get("set-cookie") ?? "").split(";")[0];
    const inf = (await (await fetch(BASE + `/s/${ctx.shPersistId}/info`, { headers: { cookie: shPCookie } })).json()) as
      { cols: number; rows: number };
    const truth = (await tmuxOut("display-message", "-p", "-t", "s2", "#{window_width} #{window_height}")).out.trim();
    check("share info reports the pane's true size, not the server cache",
      `${inf.cols} ${inf.rows}` === truth && truth === "77 31", `info ${inf.cols}x${inf.rows} vs tmux ${truth}`);
  }
  const sess3 = (await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean; perpetual?: boolean }[] };
  check("after restart: schedule persisted", sess3.autos.some((a) => a.id === ctx.aPersistId && a.enabled));
  check("after restart: perpetual auto persisted with its flag intact",
    sess3.autos.some((a) => a.id === ctx.aPerpPersistId && a.enabled && a.perpetual === true),
    JSON.stringify(sess3.autos.find((a) => a.id === ctx.aPerpPersistId)));
  // the seed is a plain capture of the pane, so this asks for content, not a byte count: a
  // recycled slot's fresh shell is a prompt and little else (81 bytes, measured), which is a
  // correct seed of an empty pane and says nothing about whether the socket streams.
  await tmuxOut("send-keys", "-t", "s2", "printf 'post-restart-replay-%s\\n' 1 2 3 4 5", "Enter");
  for (let i = 0; i < 60; i++) {
    if ((await tmuxOut("capture-pane", "-t", "s2", "-p")).out.includes("post-restart-replay-5")) break;
    await Bun.sleep(100);
  }
  const replay2 = await new Promise<{ n: number; text: string }>((resolve) => {
    let n = 0, text = "";
    const ws = new WebSocket(wsUrl(2));
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => {
      n += (e.data as ArrayBuffer).byteLength;
      text += new TextDecoder().decode(e.data as ArrayBuffer);
    };
    ws.onopen = () => setTimeout(() => { ws.close(); resolve({ n, text }); }, 2000);
    ws.onerror = () => resolve({ n: -1, text });
  });
  check("after restart: WS replay for slot 2 non-empty", replay2.n > 100, `${replay2.n} bytes`);
  check("after restart: WS replay carries the pane's content", replay2.text.includes("post-restart-replay-3"), `${replay2.n} bytes`);
  const ws404 = await get("/ws/1");
  check("WS route rejects inactive slot", ws404.status === 404);

  // --- audit log: security-relevant event trail, own file/write-chain, owner-gated read ---
  const auditPath = `${ROOT}/audit.jsonl`;
  const auditRead = async (): Promise<{ ts: number; event: string; slot?: number; detail?: string }[]> =>
    (await Bun.file(auditPath).text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  check("audit endpoint requires owner token", (await fetch(BASE + "/api/audit")).status === 401);
  const auditRes = await get("/api/audit?limit=1000");
  const auditJ = (await auditRes.json()) as { events: { event: string; slot?: number }[]; total: number };
  check("audit endpoint returns events", auditRes.ok && Array.isArray(auditJ.events) && auditJ.events.length > 0,
    `${auditJ.events.length}/${auditJ.total}`);
  const auditAll = await auditRead();
  check("audit records slot_open", auditAll.some((e) => e.event === "slot_open" && e.slot === 2), `${auditAll.length} events`);
  check("audit records slot_kill", auditAll.some((e) => e.event === "slot_kill" && e.slot === 1));
  check("audit records share_create", auditAll.some((e) => e.event === "share_create"));
  check("audit records share_revoke", auditAll.some((e) => e.event === "share_revoke"));
  // share_mode_change is GONE with the interactive mode (2026-08-08). The negative control
  // replaces it: the event must never appear again, because nothing can emit it.
  check("no share_mode_change is ever recorded — the interactive mode it reported does not exist",
    !auditAll.some((e) => e.event === "share_mode_change"));
  check("audit records guest auth failure", auditAll.some((e) => e.event === "share_auth_fail"));
  check("audit records guest auth success", auditAll.some((e) => e.event === "share_auth_ok"));
  check("audit records owner auth failure", auditAll.some((e) => e.event === "owner_auth_fail"));
  check("audit records guest ws connect", auditAll.some((e) => e.event === "guest_ws_connect"));
  const readText = async (p: string): Promise<string> => {
    try {
      return await Bun.file(p).text();
    } catch {
      return "";
    }
  };
  const auditRaw = (await readText(auditPath)) + (await readText(`${auditPath}.1`));
  check("audit log never contains the guessed guest password", !auditRaw.includes("totally-wrong"));
  check("audit log never contains a share secret", !auditRaw.includes("viewpass123") && !auditRaw.includes("interpass123"));
  check("audit log never contains the owner token", !auditRaw.includes(TOKEN));
  const auditStat = statOrNull(auditPath);
  check("precondition: audit log exists before permission and rotation checks", auditStat !== null, auditPath);
  if (auditStat) {
    const auditMode = Number(auditStat.mode) & 0o777;
    check("audit log file is 600", auditMode === 0o600, auditMode.toString(8));
  }

  // --- rotation: restart with the threshold pinned to the CURRENT file size, so the very
  // next audit event is guaranteed to push it over and trigger exactly one rotation —
  // deterministic regardless of how many bytes the rest of the suite happened to produce
  const auditSizeBeforeRotate = auditStat?.size ?? 0;
  check("audit log has content to rotate", auditSizeBeforeRotate > 0, `${auditSizeBeforeRotate} bytes`);
  const rotKill = Bun.spawn(["tmux", "-L", SOCK, "kill-session", "-t", "srv"]);
  await rotKill.exited;
  await Bun.sleep(500);
  // --- single-instance lock, half 1: a STALE pidfile must not wedge the restart. This is the
  // failure mode that would be worse than the one the lock fixes — every deploy restarts srv with
  // `tmux kill-session` and the watchdog respawns blind, so a lock that survives its owner's death
  // takes the fleet down permanently. Plant a pid that is definitely dead (a process we ran and
  // reaped) and let the ordinary restart below be the test: if it wedges, every rotation check
  // that follows fails too.
  const deadProc = Bun.spawn(["true"]);
  await deadProc.exited;
  const deadPid = deadProc.pid;
  const pidPath = `${ROOT}/fleet.pid`;
  writeFileSync(pidPath, `${deadPid}\n`);
  const rotStart = Bun.spawn(["tmux", "-L", SOCK, "new-session", "-d", "-s", "srv",
    `cd '${ROOT}' && FLEET_HOST=${IP} FLEET_PORT=${PORT} FLEET_SOCK=${SOCK} ${cmdEnv}${gapEnv}FLEET_AUDIT_ROTATE_BYTES=${auditSizeBeforeRotate} exec bun server.ts >> server.log 2>&1`]);
  await rotStart.exited;
  await Bun.sleep(3000);
  // one cheap, deterministic audit event: a failed owner-token request (no state mutated)
  await fetch(BASE + "/api/sessions", { headers: { authorization: "Bearer wrong-for-rotation-test" } });
  await Bun.sleep(300); // let the fire-and-forget audit write chain flush
  const auditRotStat = statOrNull(`${auditPath}.1`);
  const auditRotExists = auditRotStat?.isFile() === true;
  check("audit log rotates to .1 once the size threshold is crossed", auditRotExists);
  if (auditRotStat?.isFile()) {
    const rotSize = auditRotStat.size;
    check("rotated .1 preserves the pre-rotation history", rotSize >= auditSizeBeforeRotate, `${rotSize} vs ${auditSizeBeforeRotate}`);
    const freshStat = statOrNull(auditPath);
    check("precondition: live audit log remains readable after rotation", freshStat !== null, auditPath);
    if (freshStat) {
      const freshSize = freshStat.size;
      check("post-rotation audit.jsonl starts fresh, smaller than what rotated out", freshSize < auditSizeBeforeRotate, `${freshSize} vs ${auditSizeBeforeRotate}`);
    }
  }

  // --- rotation VISIBILITY: what the routes still show once .1 exists. Rotation is single-
  // generation and silent — no error, no log line — so a reader that opens only the live file
  // reports a near-empty ledger that looks young rather than truncated. audit.jsonl genuinely
  // rotated three lines above, so this is measured against the real mechanism, not a fixture:
  // every event the suite produced before now lives in .1 and must still come back.
  const postRot = (await (await get("/api/audit?limit=1000")).json()) as
    { events: { event?: string }[]; total: number };
  check("audit route still shows pre-rotation events after the log rotated to .1",
    postRot.events.some((e) => e.event === "slot_open"),
    `${postRot.events.length} events / total ${postRot.total} after rotation`);
  check("audit route's total spans both generations after rotation",
    postRot.total >= auditAll.length, `${postRot.total} vs ${auditAll.length} pre-rotation lines`);

  // The other two trails rotate through the SAME appendEvent and are read by the same kind of
  // route, but driving each one over 5 MB inside the suite would cost minutes — so plant the .1
  // generation directly and assert the route reads it. Old timestamps keep the planted rows at the
  // BOTTOM of every newest-first response, so no later check that takes "the most recent row" can
  // pick one up; the files are removed again immediately after.
  const planted: { file: string; route: string; key: string; marker: string; row: Record<string, unknown> }[] = [
    { file: `${ROOT}/lane-outcomes.jsonl`, route: "/api/lane-outcomes", key: "outcomes", marker: "rotation-probe-outcome",
      row: { ts: 1000, slot: 9, branch: "rotation-probe-outcome", disposition: "landed" } },
    { file: `${ROOT}/post-land-audits.jsonl`, route: "/api/post-land-audits", key: "audits", marker: "rotation-probe-audit",
      row: { at: 1000, repo: "rotation-probe-audit", result: "green" } },
  ];
  for (const p of planted) writeFileSync(`${p.file}.1`, `${JSON.stringify(p.row)}\n`);
  for (const p of planted) {
    const body = (await (await get(`${p.route}?limit=1000`)).json()) as Record<string, unknown>;
    const rows = (body[p.key] ?? []) as Record<string, unknown>[];
    check(`${p.route} reads the rotated-out .1 generation`,
      rows.some((r) => JSON.stringify(r).includes(p.marker)),
      `${rows.length} rows, total ${String(body.total)}`);
  }
  for (const p of planted) rmSync(`${p.file}.1`, { force: true });

  // --- single-instance lock, half 2 (the plant is above, before the restart) ---
  // absent/unreadable reads answer 0 rather than throwing: a check module that throws takes the
  // whole run's results down with it, and "the file isn't there" is a FAIL to report, not a crash
  const readPid = (): number => { try { return Number.parseInt(readFileSync(pidPath, "utf8").trim(), 10) || 0; } catch { return 0; } };
  const modeOf = (p: string): number => { try { return statSync(p).mode & 0o777; } catch { return -1; } };
  const pidNow = readPid();
  check("stale pidfile did not block the restart — the live server took it over",
    pidNow > 0 && pidNow !== deadPid, `pidfile ${pidNow}, planted dead pid ${deadPid}`);
  check("pidfile is 600", modeOf(pidPath) === 0o600, modeOf(pidPath).toString(8));

  // A second server over the SAME directory must refuse: STATE_FILE follows import.meta.dir, so a
  // different FLEET_PORT/FLEET_SOCK isolates nothing and both would write this fleet.json. Given a
  // distinct port AND socket here precisely so nothing but the directory lock can be what stops it.
  // the token, not the bytes: the LIVE server may legitimately save state at any moment here, so
  // a byte comparison would be a race. What the refusal has to protect is that this file stays
  // parseable and keeps its credentials — an unparseable one makes the next boot mint a new owner
  // token and kill every bookmark, share link and lane token at once.
  const tokenOf = (): string | null => { try {
    const t = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { token?: unknown }).token;
    return typeof t === "string" ? t : null;
  } catch { return null; } };
  const tokenBefore = tokenOf();
  const second = Bun.spawn(["bun", "server.ts"], {
    cwd: ROOT, stdout: "pipe", stderr: "pipe",
    env: { ...process.env, FLEET_HOST: IP, FLEET_PORT: String(PORT + 1), FLEET_SOCK: `${SOCK}x2`,
      FLEET_CMD: "true", FLEET_AUTO_REVIEW_MS: "0" },
  });
  // BOUNDED wait, and the bound is not paranoia: an unguarded server does not fail here, it SUCCEEDS
  // and runs forever, so `await second.exited` would hang the whole suite rather than fail a check.
  // (Measured against HEAD while proving this section red: the second instance came up, adopted this
  // fleet.json and began opening slot sessions on its own socket.) The lock refuses within its 5s
  // grace, so 25s is slack, not a race — and killing a survivor is what keeps the failure a FAIL.
  const secondCode = await Promise.race([second.exited, Bun.sleep(25_000).then(() => null)]);
  if (secondCode === null) {
    second.kill("SIGKILL");
    await second.exited;
    // it got past the lock, so it also started its own tmux server and began adopting slots —
    // reap that too, or a failing run leaks a live server with real sessions in it
    Bun.spawnSync(["tmux", "-L", `${SOCK}x2`, "kill-server"]);
  }
  const secondOut = await new Response(second.stdout).text() + await new Response(second.stderr).text();
  check("a second server against the same directory refuses to start",
    secondCode !== null && secondCode !== 0, secondCode === null ? "still running after 25s — killed" : `exit ${secondCode}`);
  check("the refusal names the running server, not a port clash",
    /REFUSING TO START/.test(secondOut) && secondOut.includes(String(pidNow)), secondOut.slice(0, 300));
  check("the refused second server left fleet.json parseable with the same owner token",
    tokenBefore !== null && tokenOf() === tokenBefore);
  check("the refused second server left the pidfile pointing at the live server", readPid() === pidNow);

  // --- the state file's own durability: .bak is the LAST GOOD state, written at rename time.
  // Boot used to make it instead, by copying the file it had just failed to parse — which
  // preserved the damage and destroyed the only readable copy at the moment it was needed.
  const bak = `${ROOT}/fleet.json.bak`;
  check("fleet.json.bak exists and parses — it is the last GOOD state, not a copy of a broken one",
    ((): boolean => { try { return typeof (JSON.parse(readFileSync(bak, "utf8")) as { token?: string }).token === "string"; }
      catch { return false; } })());
  check("fleet.json.bak is 600", modeOf(bak) === 0o600, modeOf(bak).toString(8));
  check("no fixed-name fleet.json.tmp is left behind (unique temp names, cleaned on rename)",
    !existsSync(`${ROOT}/fleet.json.tmp`)
    && readdirSync(ROOT).filter((f) => f.startsWith("fleet.json.") && f.endsWith(".tmp")).length === 0,
    readdirSync(ROOT).filter((f) => f.startsWith("fleet.json.")).join(","));

  // --- a self-Auto goes to the SLOT that scheduled it, never to a role. Measured 2026-10-02: Slot 9
  // (Orchestratorin) scheduled 0b781fcc and got "failed: no current role occupant — nothing typed",
  // because deliveryAddress turned her slot into {kind:"orchestrator"} and a lane labelled
  // "…orchestratorinnen-karte…" was the second candidate. Only reachable WITH a bundle window (the
  // wrapper's FLEET_DELIVERY_BUNDLE_SEC=0 sends immediately, bypassing the role resolution), so
  // this section restarts with one. Half 2 changes the occupant on disk while the server is down —
  // the only way an Auto row outlives its occupant, since open/kill delete every Auto of the slot.
  {
    await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2" });
    type AutoRow = { id: string; slot: number; enabled: boolean; lastResult: string | null; slotOpenedAt?: number };
    type SessionsView = { slots: { id: number; cwd: string | null; openedAt: number }[]; autos: AutoRow[] };
    const sessions = async (): Promise<SessionsView> => (await (await get("/api/sessions")).json()) as SessionsView;
    const vacant = (await sessions()).slots.filter((s) => !s.cwd).map((s) => s.id);
    const [roleA, roleB] = vacant;
    check("precondition: two vacant slots for the two Orchestratorin labels", !!roleA && !!roleB, JSON.stringify(vacant));
    if (roleA && roleB) {
      // labelled by rename, not at open: an Orchestratorin label at open also pastes the role card
      // (deliverOrchestratorSpawnCard), which this section does not test
      const openA = await post(`/api/slots/${roleA}/open`, { cwd: ROOT });
      const openB = await post(`/api/slots/${roleB}/open`, { cwd: ROOT });
      const nameA = await post(`/api/slots/${roleA}/rename`, { label: "🎛 Orchestratorin · e2e auto" });
      const nameB = await post(`/api/slots/${roleB}/rename`, { label: "Orchestrator zwei · e2e auto" });
      check("precondition: two non-lane slots carry an Orchestratorin label (role address resolves to nobody)",
        openA.ok && openB.ok && nameA.ok && nameB.ok,
        `${openA.status} ${openB.status} ${nameA.status} ${nameB.status}`);
      const selfToken = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
        { slots?: Record<string, { selfToken?: string }> }).slots?.[String(roleA)]?.selfToken ?? "";
      const selfAuto = async (text: string, inSec: number): Promise<AutoRow | null> => {
        const r = await fetch(BASE + "/api/self/autos", { method: "POST",
          headers: { "content-type": "application/json", "x-fleet-self-token": selfToken },
          body: JSON.stringify({ text, inSec, idleSec: 0 }) });
        return r.ok ? ((await r.json()) as { auto: AutoRow }).auto : null;
      };
      const openedA = (await sessions()).slots.find((s) => s.id === roleA)?.openedAt ?? 0;
      const sentMarker = `self-auto-own-slot-${Date.now()}`;
      const sent = await selfAuto(sentMarker, 1);
      check("a self-Auto is stamped with the occupant that scheduled it",
        !!sent && sent.slot === roleA && sent.slotOpenedAt === openedA && openedA > 0,
        `${JSON.stringify(sent)} openedAt=${openedA}`);
      // before the fix this row ended "failed: no current role occupant" after the 30 s absent grace
      const fired = sent ? await until(async () => (await sessions()).autos.find((a) =>
        a.id === sent.id && a.lastResult !== null) ?? null,
      { timeoutMs: 15_000, what: "own-slot self-Auto settles" }).catch(() => null) : null;
      const sentLog = (await plogRead()).filter((p) => p.text === sentMarker);
      check("with two Orchestratorin labels a self-Auto is sent into its own slot",
        fired?.lastResult === "sent" && sentLog.length === 1 && sentLog[0]?.slot === roleA,
        `${JSON.stringify(fired)} log=${JSON.stringify(sentLog.map((p) => p.slot))}`);

      const staleMarker = `self-auto-stale-occupant-${Date.now()}`;
      const stale = await selfAuto(staleMarker, 3600);
      check("precondition: the far-future self-Auto for the occupant change exists", !!stale, "");
      await stopSrv();
      const stFile = `${ROOT}/fleet.json`;
      const st = JSON.parse(readFileSync(stFile, "utf8")) as { autos?: (AutoRow & { nextAt: number })[] };
      const row = st.autos?.find((a) => a.id === stale?.id);
      // the row of a FORMER occupant: same slot id, another openedAt; due now
      if (row) { row.slotOpenedAt = openedA - 1; row.nextAt = Date.now() - 1000; }
      writeFileSync(stFile, JSON.stringify(st, null, 2), { mode: 0o600 });
      await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2" });
      const dropped = stale ? await until(async () => (await sessions()).autos.find((a) =>
        a.id === stale.id && a.lastResult !== null) ?? null,
      { timeoutMs: 10_000, what: "stale-occupant self-Auto settles" }).catch(() => null) : null;
      await Bun.sleep(2_500); // one bundle window: nothing may have been queued for a later paste
      const staleLog = (await plogRead()).filter((p) => p.text === staleMarker);
      const staleCap = await tmuxOut("capture-pane", "-t", `s${roleA}`, "-p", "-J");
      check("a self-Auto of a former occupant is discarded with its reason, nothing typed",
        !!row && dropped?.enabled === false
          && dropped.lastResult?.startsWith("skipped — slot occupant changed") === true
          && staleLog.length === 0 && !staleCap.out.includes(staleMarker),
        `${JSON.stringify(dropped)} log=${staleLog.length}`);

      // --- the ROLE address resolves over non-lane slots only. Measured 2026-10-02 (Report e67d865d):
      // a lane in Slot 22 labelled "⎇ task orchestratorinnen-karte-4dbe" matched the label, so
      // deliveryRecipient({kind:"orchestrator"}) saw two candidates and a bundle for the real
      // Orchestratorin (an inbox-nudge among it) fell after 30 s with "no current role occupant".
      // Measured on the message rail, which resolves through deliveryRecipient, and on its nudge,
      // which rides a {kind:"orchestrator"} bundle (FLEET_DELIVERY_BUNDLE_SEC > 0).
      await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2", FLEET_INBOX_NUDGE_MS: "1000", FLEET_BACKLOG_NUDGE_IDLE_MS: "0" });
      const selfMessages = (method: "GET" | "POST", body?: unknown): Promise<Response> =>
        fetch(BASE + "/api/self/messages", { method,
          headers: { "content-type": "application/json", "x-fleet-self-token": selfToken },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const twoView = await selfMessages("GET");
      const twoErr = ((await twoView.json()) as { error?: string }).error ?? "";
      check("two non-lane Orchestratorin slots: the role holds nobody, and the refusal names why",
        twoView.status === 409 && twoErr.includes("unique live Orchestrator"), `${twoView.status} ${twoErr}`);

      const laneRepo = process.env.FLEET_E2E_REPO ?? "";
      await post(`/api/slots/${roleB}/kill`, {});
      const ln = laneRepo ? (await (await post("/api/lanes", { repo: laneRepo })).json()) as
        { slot?: number; cwd?: string; branch?: string } : {};
      const lnName = ln.slot ? await post(`/api/slots/${ln.slot}/rename`,
        { label: "⎇ task orchestratorinnen-karte-e2e" }) : null;
      const lnRow = ln.slot ? ((await (await get("/api/sessions")).json()) as
        { slots: { id: number; label?: string | null; worktree?: unknown }[] }).slots.find((x) => x.id === ln.slot) : undefined;
      check("precondition: one Orchestratorin plus a LANE whose label carries the word orchestrator",
        !!ln.slot && lnName?.ok === true && !!lnRow?.worktree && /orchestratorinnen-karte/.test(lnRow?.label ?? ""),
        `${JSON.stringify(ln)} rename=${lnName?.status} row=${JSON.stringify(lnRow)}`);
      if (ln.slot && ln.cwd) {
        // The view includes outbound rows; receipts also accept escalated inbound messages
        // whose original address differs from this role. Let the receipt door distinguish them.
        const roleBundleEnv = { FLEET_DELIVERY_BUNDLE_SEC: "2", FLEET_BACKLOG_NUDGE_IDLE_MS: "0" };
        await restartSrv({ ...roleBundleEnv, FLEET_INBOX_NUDGE_MS: "0" });
        type MessageView = { unread?: number; entries?: { id: string; readBy: unknown }[] };
        const messageView = async (): Promise<MessageView> => (await (await selfMessages("GET")).json()) as MessageView;
        const olderMessage = await selfMessages("POST", { to: { kind: "role", role: "orchestrator" },
          payload: { kind: "text", text: "older role bundle fixture message" },
          idempotencyKey: `role-bundle-older-${Date.now()}` });
        const olderBody = (await olderMessage.json()) as { message?: { id?: string } };
        const oldInbox = await messageView();
        check("precondition: role bundle has its own older unread message to acknowledge",
          olderMessage.ok && !!olderBody.message?.id && (oldInbox.unread ?? 0) > 0
            && oldInbox.entries?.some((m) => m.id === olderBody.message?.id && m.readBy === null) === true,
          JSON.stringify({ status: olderMessage.status, id: olderBody.message?.id, unread: oldInbox.unread }));
        const outboundIds = new Set<string>();
        const readFailures: { id: string; status: number; error?: string }[] = [];
        let acknowledged = true;
        for (const m of oldInbox.entries ?? []) if (m.readBy === null) {
          const read = await fetch(BASE + `/api/self/messages/${m.id}/read`, { method: "POST",
            headers: { "content-type": "application/json", "x-fleet-self-token": selfToken }, body: "{}" });
          const body = (await read.json()) as { error?: string };
          const outbound = read.status === 409
            && body.error === "this message was sent by this principal — a receipt is the addressee's";
          if (outbound) outboundIds.add(m.id);
          else if (!read.ok) readFailures.push({ id: m.id, status: read.status, error: body.error });
          acknowledged = (read.ok || outbound) && acknowledged;
        }
        const unreadIds = (view: MessageView): string[] => (view.entries ?? [])
          .filter((m) => m.readBy === null && !outboundIds.has(m.id)).map((m) => m.id);
        const emptyInbox = await messageView();
        const empty = acknowledged && emptyInbox.unread === 0 && unreadIds(emptyInbox).length === 0;
        check("precondition: role bundle clears older unread messages while its nudge timer is disabled",
          empty, JSON.stringify({ acknowledged, unread: emptyInbox.unread ?? null, readFailures,
            outboundIds: [...outboundIds], ids: unreadIds(emptyInbox) }));
        const auditFrom = (await Bun.file(`${ROOT}/audit.jsonl`).text()).length;
        type Row = { event: string; slot?: number; detail?: string; path?: string; paths?: string; count?: number };
        const auditSince = async (): Promise<Row[]> =>
          (await Bun.file(`${ROOT}/audit.jsonl`).text()).slice(auditFrom).trim().split("\n").filter(Boolean)
            .map((l) => JSON.parse(l) as Row);
        // a nudge is TYPED into `slot` in one of two shapes, both a real paste with its send row:
        // alone (the send row keeps path inbox-nudge), or merged with a "sofort" send that met a
        // waiting bundle (flushDeliveryBundle(key, immediate): one paste, send row path "bundle",
        // the nudge named in delivery_bundle_sent.paths). Since Mangel 141 a message to the role
        // "orchestrator" is direct (tickMessageNudge), so the Orchestratorin gets only the first
        // shape; the lane's negative below still counts both. A sent row with no send row before
        // it on the same slot counts as nothing.
        const nudgeTyped = (rows: Row[], slot: number): boolean => rows.some((r, i) => {
          if (r.event === "send" && r.slot === slot && r.path === "inbox-nudge") return true;
          if (r.event !== "delivery_bundle_sent" || r.slot !== slot
            || !(r.paths ?? "").split(",").includes("inbox-nudge") || (r.count ?? 0) < 2) return false;
          const typed = rows.slice(0, i).reverse().find((x) => x.event === "send" && x.slot === slot);
          return typed?.path === "bundle";
        });
        const oneView = await selfMessages("GET");
        const oneBody = (await oneView.json()) as { addresses?: { kind: string; role?: string }[]; error?: string };
        const sentMsg = await selfMessages("POST", { to: { kind: "role", role: "orchestrator" },
          payload: { kind: "text", text: "role address beside an orchestrator-named lane" },
          idempotencyKey: `lane-label-${Date.now()}` });
        const sentBody = (await sentMsg.json()) as { message?: { id?: string }; holder?: { slot?: number } | null;
          escalatedTo?: string | null; error?: string };
        check("with an orchestrator-named lane beside her, the Orchestratorin holds the role address",
          oneView.ok && oneBody.addresses?.some((a) => a.kind === "role" && a.role === "orchestrator") === true
            && sentMsg.ok && sentBody.holder?.slot === roleA && sentBody.escalatedTo === null,
          `view=${oneView.status} ${JSON.stringify(oneBody.addresses ?? oneBody.error)} send=${sentMsg.status} ${JSON.stringify(sentBody)}`);
        const messageId = sentBody.message?.id ?? null;
        const soleUnread = (view: MessageView): boolean => messageId !== null && view.unread === 1
          && unreadIds(view).join(",") === messageId;
        const stagedInbox = await messageView();
        check("precondition: the new role message is the sole unread ID before nudges resume",
          empty && soleUnread(stagedInbox), JSON.stringify({ messageId, unread: stagedInbox.unread ?? null,
            ids: unreadIds(stagedInbox) }));
        check("role bundle predicate: an extra unread ID rejects the sole-ID precondition even with unread=1",
          soleUnread(stagedInbox) && !soleUnread({ ...stagedInbox, entries: [...stagedInbox.entries ?? [],
            { id: "fixture-extra-unread", readBy: null }] }),
          JSON.stringify({ messageId, unread: stagedInbox.unread, ids: unreadIds(stagedInbox) }));
        check("role bundle predicate: unread=2 rejects the sole-ID precondition even with one unread ID",
          soleUnread(stagedInbox) && !soleUnread({ ...stagedInbox, unread: 2 }),
          JSON.stringify({ messageId, unread: stagedInbox.unread, ids: unreadIds(stagedInbox) }));
        const nudgeText = "[fleet message] 1 ungelesene adressierte Nachricht fuer diese Session — "
          + "GET /api/self/messages?unread=1&read=1 quittiert beim Lesen, sonst GET /api/self/messages, dann POST /api/self/messages/<id>/read.";
        // The pane is the zsh stand-in, and zsh draws the em dash by the PANE's locale: "—" under UTF-8,
        // "�<0080><0094>" under C — a Claude lane's suite on the Mac runs with LANG unset, so the exact
        // string never matched there (red since 0969d46b, green only from UTF-8 shells). Every ASCII
        // byte stays exact; only the dash's rendering is free, and it never holds a space.
        const reEsc = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const dash = nudgeText.indexOf(" — ");
        const nudgeSeen = new RegExp(`${reEsc(nudgeText.slice(0, dash))} \\S{1,24} ${reEsc(nudgeText.slice(dash + 3))}`, "g");
        const paneNudges = async (slot: number): Promise<{ code: number; count: number }> => {
          const pane = await tmuxOut("capture-pane", "-p", "-J", "-S", "-", "-t", `=s${slot}:`);
          return { code: pane.code, count: pane.out.match(nudgeSeen)?.length ?? 0 };
        };
        const roleBefore = await paneNudges(roleA);
        const laneBefore = await paneNudges(ln.slot);
        await restartSrv({ ...roleBundleEnv, FLEET_INBOX_NUDGE_MS: "1000" });
        // before the role fix: delivery_bundle_dropped "orchestrator no current role occupant" after 30 s;
        // since Mangel 141 the nudge goes direct — typed alone, no "orchestrator" bundle on the way
        const typedAlone = (rows: Row[]): boolean =>
          rows.some((r) => r.event === "send" && r.slot === roleA && r.path === "inbox-nudge");
        const nudged = await until(async () => {
          const pane = await paneNudges(roleA);
          return typedAlone(await auditSince()) && pane.code === 0 && pane.count > roleBefore.count || null;
        },
        { timeoutMs: 20_000, what: "the role-addressed inbox-nudge reaches the Orchestratorin" }).catch(() => null);
        const rows = await auditSince();
        const deliveredInbox = await messageView();
        const laneAfter = await paneNudges(ln.slot);
        check("the role-addressed nudge is typed directly into the Orchestratorin, never into the lane, nothing bundled or dropped",
          empty && soleUnread(stagedInbox) && soleUnread(deliveredInbox) && roleBefore.code === 0
            && laneBefore.code === 0 && laneAfter.code === 0 && laneAfter.count === laneBefore.count
            && !!nudged && typedAlone(rows)
            && !rows.some((r) => r.event === "delivery_bundle_queued" && r.detail?.startsWith("orchestrator ") === true)
            && !rows.some((r) => r.event === "delivery_bundle_dropped" && r.detail?.startsWith("orchestrator ") === true)
            && !nudgeTyped(rows, ln.slot)
            && !rows.some((r) => r.event.startsWith("delivery_bundle") && r.slot === ln.slot
              && r.detail?.startsWith("orchestrator ") === true),
          JSON.stringify({ messageId, soleUnread: soleUnread(deliveredInbox), roleBefore, laneBefore, laneAfter,
            rows: rows.filter((r) => r.event.startsWith("delivery_bundle") || r.path === "inbox-nudge"
            || (r.event === "send" && r.path === "bundle"))
            .map((r) => [r.event, r.slot, r.detail, r.paths ?? r.path]) }));
        await post(`/api/slots/${ln.slot}/kill`, {});
        if (existsSync(ln.cwd)) rmSync(ln.cwd, { recursive: true, force: true });
        spawnSync("git", ["worktree", "prune"], { cwd: laneRepo });
        if (ln.branch) spawnSync("git", ["branch", "-qD", ln.branch], { cwd: laneRepo });
      }

      // --- a hint typed inside a MERGED paste is delivered, across a restart too, and an immediate
      // flush leaves no bundle behind (rest of 669a45ad, Report 300035b7). flushDeliveryBundle(key,
      // immediate) types the waiting bundle and the "sofort" send as one paste whose send row has
      // path "bundle"; that row carried no reportId, so tickOrphanReports' restart seed missed the
      // hint and sent it again. And the immediate branch returned before the delete, so the emptied
      // bundle pulled every later "sofort" send to the key through a bundle of none
      // (delivery_bundle_sent "orchestrator count=0"). Fixture: a Program whose live MAIN holds two
      // planted undecided reports; a message nudge waits under "orchestrator" (600 s window), then
      // the MAIN is killed — the first report's hint meets the bundle, the second comes a tick later.
      // The waiting nudge comes from the MAIN's message to a second, only proposed Program: it escalates
      // to the Orchestratorin (escalateMessage) and is not direct, so it is still bundled — a message
      // to the role "orchestrator" goes direct since Mangel 141, and the Orchestratorin's own message to
      // a Program since bau/ohne-owner-token Schnitt 4; neither waits any more.
      {
        type ARow = { ts?: number; event: string; slot?: number; detail?: string; path?: string; paths?: string;
          reportId?: string; bytes?: number };
        // both generations and by time, never a byte offset: a rotation inside the window moves rows to .1
        const auditAfter = (since: number): ARow[] => ["audit.jsonl.1", "audit.jsonl"].flatMap((f) =>
          existsSync(`${ROOT}/${f}`) ? readFileSync(`${ROOT}/${f}`, "utf8").split("\n").filter(Boolean)
            .map((l) => { try { return JSON.parse(l) as ARow; } catch { return null; } })
            .filter((r): r is ARow => r !== null) : []).filter((r) => (r.ts ?? 0) >= since);
        const orphanTyped = (rows: ARow[], id: string): ARow[] => rows.filter((r) => r.event === "send"
          && r.reportId === id && (r.bytes ?? 0) > 0 && (r.path === "report-orphan" || r.path === "bundle"));
        const mainSlot = (await sessions()).slots.find((s) => !s.cwd && s.id !== roleA)?.id;
        const mainOpen = mainSlot ? await post(`/api/slots/${mainSlot}/open`, { cwd: ROOT }) : null;
        const made = await post("/api/programs", { title: "merged orphan hint", intent: "e2e fixture",
          successCriterion: "a merged hint is delivered once", nonGoals: ["none"], decisions: ["none"],
          evidence: ["e2e/restart.ts"], openQuestions: ["none"] });
        const programId = made.ok ? ((await made.json()) as { program?: { id?: string } }).program?.id ?? "" : "";
        const confirmed = programId ? await post(`/api/programs/${programId}/confirm`, {}) : null;
        const activated = programId ? await post(`/api/programs/${programId}/activate`, {}) : null;
        const proposed = await post("/api/programs", { title: "escalated nudge", intent: "e2e fixture",
          successCriterion: "a message to it reaches the Orchestratorin", nonGoals: ["none"], decisions: ["none"],
          evidence: ["e2e/restart.ts"], openQuestions: ["none"] });
        const proposedId = proposed.ok ? ((await proposed.json()) as { program?: { id?: string } }).program?.id ?? "" : "";
        // the probe above leaves roleA's role message unread; after the restart its nudge would wait
        // in the bundle, the POST below would then queue none, and the merged flush would drop it
        // ("messages for slot N changed before paste") — the hint typed alone, no merge to measure
        const inbox = (await (await selfMessages("GET")).json()) as { entries?: { id: string; readBy: unknown }[] };
        for (const m of inbox.entries ?? []) if (m.readBy === null)
          await fetch(BASE + `/api/self/messages/${m.id}/read`, { method: "POST",
            headers: { "content-type": "application/json", "x-fleet-self-token": selfToken }, body: "{}" });
        const unreadLeft = ((await (await selfMessages("GET")).json()) as { unread?: number }).unread;
        await stopSrv();
        type PlantState = { slots?: Record<string, { openedAt?: number; selfToken?: string }>;
          programs?: { id: string; main?: unknown }[]; fleetReports?: { id?: string }[] };
        const plant = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as PlantState;
        const mainOpenedAt = mainSlot ? plant.slots?.[String(mainSlot)]?.openedAt ?? 0 : 0;
        const mainSelfToken = mainSlot ? plant.slots?.[String(mainSlot)]?.selfToken ?? "" : "";
        const programRow = plant.programs?.find((p) => p.id === programId);
        const reportIds = [0, 1].map(() => createHash("sha256").update(`${Date.now()}-${Math.random()}`)
          .digest("hex").slice(0, 24));
        if (programRow && mainSlot && mainOpenedAt > 0) {
          programRow.main = { slot: mainSlot, openedAt: mainOpenedAt, sessionId: null, boundAt: Date.now() };
          // at the FRONT: tickOrphanReports takes the first eligible row, so no earlier module's
          // leftover report can take the first hint's place in the merged paste
          plant.fleetReports = [...reportIds.map((id, i) => ({ id, reportedAt: Date.now() - 1000 + i,
            status: "complete", text: `merged orphan fixture ${i}`,
            worker: { slot: mainSlot, openedAt: mainOpenedAt, sessionId: null, cwd: ROOT, branch: "fleet/e2e-merged-orphan" },
            provenance: { taskId: null, originId: null, programId, instance: null },
            receiver: null, basis: "program", eventId: null })), ...(plant.fleetReports ?? [])];
        }
        writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(plant, null, 2), { mode: 0o600 });
        const bundleEnv = { FLEET_DELIVERY_BUNDLE_SEC: "600", FLEET_INBOX_NUDGE_MS: "1000", FLEET_BACKLOG_NUDGE_IDLE_MS: "0" };
        await restartSrv(bundleEnv);
        const t0 = Date.now();
        check("precondition: a Program with a live MAIN holds two planted undecided reports, the Orchestratorin is unique",
          !!mainOpen?.ok && made.ok && !!confirmed?.ok && !!activated?.ok && !!programRow && mainOpenedAt > 0
            && proposedId !== "" && unreadLeft === 0 && mainSelfToken !== "" && (await selfMessages("GET")).ok,
          `main=${mainSlot} open=${mainOpen?.status} program=${made.status}/${confirmed?.status}/${activated?.status} proposed=${proposed.status} openedAt=${mainOpenedAt} unread=${unreadLeft}`);
        // earlier modules' leftover orphans (full shard) are typed one per tick right after the restart;
        // the nudge must wait in the bundle only once they are done
        let typedCount = -1;
        for (let i = 0; i < 30; i++) {
          const n = auditAfter(t0).filter((r) => r.event === "send" && (r.path === "report-orphan" || r.path === "bundle")).length;
          if (n === typedCount) break;
          typedCount = n;
          await Bun.sleep(1_250);
        }
        const tPost = Date.now();
        const queuedMsg = await fetch(BASE + "/api/self/messages", { method: "POST",
          headers: { "content-type": "application/json", "x-fleet-self-token": mainSelfToken },
          body: JSON.stringify({ to: { kind: "program", id: proposedId },
            payload: { kind: "text", text: "a nudge that waits for the merged orphan hint" },
            idempotencyKey: `merged-orphan-${Date.now()}` }) });
        const queuedBody = queuedMsg.ok ? (await queuedMsg.json()) as { holder?: { slot?: number } | null;
          escalatedTo?: string | null } : {};
        // the nudge WAITS: its queued row has no orchestrator bundle row after it
        const queued = await until(async () => {
          const rows = auditAfter(tPost);
          const at = rows.findLastIndex((r) => r.event === "delivery_bundle_queued" && r.path === "inbox-nudge"
            && r.detail?.startsWith("orchestrator ") === true);
          return at >= 0 && !rows.slice(at + 1).some((r) => r.event !== "delivery_bundle_queued"
            && r.event.startsWith("delivery_bundle") && r.detail?.startsWith("orchestrator ") === true) || null;
        }, { timeoutMs: 15_000, what: "the role-message nudge waits in the orchestrator bundle" }).catch(() => null);
        const tKill = Date.now();
        if (mainSlot) await post(`/api/slots/${mainSlot}/kill`, {});
        const bothTyped = await until(async () => {
          const rows = auditAfter(tKill);
          return reportIds.every((id) => orphanTyped(rows, id).length > 0) || null;
        }, { timeoutMs: 15_000, what: "both orphan hints are typed into the Orchestratorin" }).catch(() => null);
        await Bun.sleep(1_000); // four ticks: a second paste of either hint would land here
        const before = auditAfter(tKill);
        const merged = before.filter((r) => r.event === "send" && r.slot === roleA && r.path === "bundle"
          && typeof r.reportId === "string" && reportIds.includes(r.reportId) && (r.bytes ?? 0) > 0);
        const mergedSent = before.find((r) => r.event === "delivery_bundle_sent" && r.slot === roleA
          && (r.paths ?? "").split(",").includes("inbox-nudge") && (r.paths ?? "").split(",").includes("report-orphan"));
        const evidence = JSON.stringify(before.filter((r) => r.event.startsWith("delivery_bundle")
          || (r.event === "send" && r.slot === roleA)).map((r) => [r.event, r.slot, r.detail, r.paths ?? r.path, r.reportId]));
        check("an orphan hint that meets the waiting bundle is typed in ONE paste whose send row carries its reportId",
          queuedMsg.ok && queuedBody.escalatedTo === "orchestrator" && queuedBody.holder?.slot === roleA
            && !!queued && !!bothTyped && merged.length === 1 && !!mergedSent
            && reportIds.every((id) => orphanTyped(before, id).length === 1),
          `${JSON.stringify({ status: queuedMsg.status, ...queuedBody })} ${evidence}`);
        check("after an immediate flush no emptied bundle stays behind: the next hint is typed alone, no delivery_bundle_sent count=0",
          !!bothTyped && !before.some((r) => r.event === "delivery_bundle_sent" && r.detail === "orchestrator count=0")
            && reportIds.some((id) => orphanTyped(before, id).some((r) => r.path === "report-orphan" && r.slot === roleA)),
          evidence);
        await restartSrv(bundleEnv);
        const tBoot = Date.now();
        await Bun.sleep(3_000); // twelve orphan ticks after the seed
        const after = auditAfter(tBoot);
        const sessionsAfter = (await (await get("/api/sessions")).json()) as { reportsAwaitingOwner?: number };
        check("after a restart the seed counts the merged paste as delivered: neither hint is typed again",
          !!bothTyped && reportIds.every((id) => orphanTyped(after, id).length === 0)
            && (sessionsAfter.reportsAwaitingOwner ?? 0) >= 2,
          JSON.stringify(after.filter((r) => r.event === "send" && r.slot === roleA).map((r) => [r.path, r.reportId])));
        await stopSrv();
        const clean = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as PlantState;
        clean.fleetReports = (clean.fleetReports ?? []).filter((r) => !reportIds.includes(r.id ?? ""));
        clean.programs = (clean.programs ?? []).filter((p) => p.id !== programId && p.id !== proposedId);
        writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(clean, null, 2), { mode: 0o600 });
        await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2" });
      }
      await post(`/api/slots/${roleA}/kill`, {});
    }
    await restartSrv();
  }

  ctx.cmdEnv = cmdEnv;
  ctx.gapEnv = gapEnv;
  ctx.gapRepo = GAP_REPO;
  ctx.auditPath = auditPath;
  ctx.plantedTranscript = PLANTED_TR;
  ctx.plantedTranscriptBytes = PLANTED_TR_BYTES;
  ctx.plantedModel = PLANTED_MODEL;
}
