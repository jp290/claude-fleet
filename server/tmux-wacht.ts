// THE TMUX SERVER THAT HOLDS FLEET'S PANES, and the one gate a new tmux session passes (queue 8ef80095).
//
// What happened twice (26.10. 23:53, 1.11. 21:58): the tmux server behind the socket `claudefleet` stopped answering for a moment
// under swap, Fleet's tmux clients piled up behind it, and once 128 connections waited (its listen backlog) the next connect got
// ECONNREFUSED. The 2 s heal read that as "slot absent" and ran `new-session`, and a tmux client that is allowed to start a server
// unlinks the socket path on ECONNREFUSED or ENOENT and starts a fresh server there (tmux client.c#client_connect). The old server
// kept every pane alive, now without a path; the new one got a second copy of every seat, resumed from the same conversation.
// Measured on this Mac on 1.11.: the live tmux server started 21:58:10 from `tmux -u -L claudefleet new-session -d -P -F …` (ensureSlot),
// its first session s6, two seconds before the watchdog's first respawn; and with a stopped tmux server plus 128 queued connections
// one plain `new-session` replaced the socket and left the old server running.
//
// The rule here: while the tmux server Fleet recorded may be alive, no new-session may start a server. It runs with `-N`, which
// tmux honours by failing instead of unlinking, or it does not run at all.
// - A recorded pid counts as gone only when the kernel says so (ESRCH) or `ps` positively shows another process. A pid that exists
//   but cannot be confirmed (`ps` too slow under the same swap that stalls tmux) is UNKNOWN, and unknown refuses with a line; it is
//   never "no server" (slot 7's S1: a slow `ps` used to open the gate without -N).
// - When that server lost its path (deleted, or another server answers there), Fleet sends it SIGUSR1, the signal tmux documents
//   for exactly this ("If the socket is accidentally removed, the SIGUSR1 signal may be sent to the tmux server process to recreate
//   it"): it unlinks whatever sits at the path and listens there again, so every pane is reachable again. Re-attach rather than
//   refuse because the old server holds the truth (the live panes, the owner's seats); a refusal would leave every seat unreachable
//   until a human acts, and a new server is exactly the copy this exists to prevent.
// - A server that only answers slowly keeps its socket: no signal, Fleet opens nothing until it answers (S2: a signal there dropped
//   the clients waiting in its queue and the line said "lost"). A path that exists but refuses every connect for 30 s is signalled.
// - Before taking a path back, Fleet lists what the other server holds and names it in the line (S3); nothing is claimed unseen.
// - When Fleet itself runs in that other server (the watchdog started srv there, W1), it still gives the path back, then ends its
//   own pid (only while it holds fleet.pid) so srv starts again beside the seats. No line ever advises ending the server that holds
//   the seats.
// - Unless the answering server is the one with Fleet's own seats (N5: the record names another live server X). Seats are known by
//   identity: a pane whose line carries Fleet's self export with the CURRENT credential of one of its slots; X, without a path,
//   shows them in its children's command lines. Panes and age decide only when neither holds a seat. Then nothing is signalled
//   or ended. When the process table or the panes cannot be read, nothing is decided: Fleet waits (R6b).
// - A record that is missing or wrong names no second server, so nothing above would compare (L2/L4; the file does not exist yet on
//   the first boot after this landed). Once after the state is loaded Fleet looks whether its current seats lie under another server
//   of this socket name. That server gets the path when it holds more of them than the one answering. On a tie the path stays: a
//   healed copy of a seat carries the same credential, and no record speaks for the other server. Either way a line says what lies where.
// - A recorded pid of another user (EPERM; after a restart of the Mac it may be a root process) is judged by `ps` like any other:
//   another user's process is never Fleet's tmux server (U1). Every line that waits names its reason and the record's file.
import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { dirname, basename } from "node:path";

export interface TmuxHost { pid: number; start: number | null; socket: string }
export type TmuxLage =
  | { state: "ok"; pid: number }
  | { state: "none" }
  | { state: "lost"; host: TmuxHost; answering: number | null; reattached: boolean; line: string };

interface WachtConfig {
  sock: string;
  env: Record<string, string>;
  /** where the recorded host survives a restart of this process; null keeps it in memory only */
  file: string | null;
  /** the one line the owner reads; server.ts hands it to logError, whose board line shows the last one */
  melde: (line: string) => void;
  /** this process runs in the wrong tmux server and gave the path back: restart it so it runs beside the seats. Returns whether it will. */
  neustart: (() => boolean) | null;
  /** the session Fleet's own server runs in (watchdog.sh starts it); it is no seat */
  srvSession: string;
  /** Fleet's own seats with their CURRENT self credential, read in memory only (server.ts hands them over). null = not configured:
   * a seat is then known by its line's shape alone. The function returns null while Fleet does not know them yet (before its
   * state is loaded): then nothing is decided by seats, Fleet waits. */
  sitze: (() => { slot: number; token: string }[] | null) | null;
  answerTimeoutMs: number;
  reattachWaitMs: number;
  /** how long a path may refuse every connect before its server is asked to recreate it */
  refusedSignalMs: number;
}
function ms(raw: string | undefined, fallback: number): number {
  const n = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(n) && n >= 100 ? n : fallback;
}
const cfg: WachtConfig = {
  sock: "claudefleet", env: {}, file: null, melde: (line) => console.log(line), neustart: null, srvSession: "srv", sitze: null,
  answerTimeoutMs: ms(process.env.FLEET_TMUX_ANSWER_MS, 3_000), reattachWaitMs: ms(process.env.FLEET_TMUX_REATTACH_MS, 2_000),
  refusedSignalMs: ms(process.env.FLEET_TMUX_REFUSED_SIGNAL_MS, 30_000),
};
export function configureTmuxWacht(next: Partial<WachtConfig>): void { Object.assign(cfg, next); }

let host: TmuxHost | null = null;
let fileRead = false;
let lost: { pid: number; since: number; line: string } | null = null;
let refusedSince: number | null = null;
let lastSignal = new Map<number, number>();
let inflight: Promise<TmuxLage> | null = null;
let lastLine = "";
let besideAsked = 0;
let ownSeen: TmuxHost | null = null;

/** set while Fleet's tmux server may be alive but is not reachable: the heal opens nothing */
export function tmuxVerloren(): { pid: number; since: number; line: string } | null { return lost; }

const expectedSocket = (): string => {
  const dir = `${process.env.TMUX_TMPDIR || "/tmp"}/tmux-${process.getuid?.() ?? 0}`;
  try { return `${realpathSync(dir)}/${cfg.sock}`; } catch { return `${dir}/${cfg.sock}`; }
};
const samePath = (a: string, b: string): boolean => {
  const canon = (p: string): string => { try { return `${realpathSync(dirname(p))}/${basename(p)}`; } catch { return p; } };
  return canon(a) === canon(b);
};

async function run(cmd: string[], timeoutMs: number): Promise<{ code: number | null; out: string }> {
  const p = Bun.spawn(cmd, { env: cfg.env, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const out = new Response(p.stdout).text().catch(() => "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settled = await Promise.race([p.exited,
    new Promise<"timeout">((r) => { timer = setTimeout(() => r("timeout"), timeoutMs); })]);
  if (timer) clearTimeout(timer);
  if (settled === "timeout") {
    try { p.kill(9); } catch { /* gone */ }
    return { code: null, out: "" };
  }
  return { code: settled, out: (await out).trim() };
}

type Antwort = { kind: "ok"; host: TmuxHost } | { kind: "slow" } | { kind: "none" };
/** which tmux server answers on the socket now: `-N` so asking never starts one. `slow` = something listens but did not answer in time */
async function answer(): Promise<Antwort> {
  const r = await run(["tmux", "-u", "-N", "-L", cfg.sock, "display-message", "-p", "#{pid}\t#{socket_path}\t#{start_time}"],
    cfg.answerTimeoutMs);
  if (r.code === null) return { kind: "slow" };
  if (r.code !== 0) return { kind: "none" };
  const [pid, socket, start] = r.out.split("\n")[0].split("\t");
  const n = Number(pid);
  return Number.isSafeInteger(n) && n > 0 ? { kind: "ok", host: { pid: n, socket: socket ?? "", start: Number(start) || null } } : { kind: "none" };
}
// "[[dd-]hh:]mm:ss" as ps prints etime, in seconds
const etimeSeconds = (raw: string): number | null => {
  const m = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(raw.trim());
  return m ? Number(m[1] ?? 0) * 86_400 + Number(m[2] ?? 0) * 3_600 + Number(m[3]) * 60 + Number(m[4]) : null;
};

type HostState = { st: "alive" | "dead" } | { st: "unknown"; why: string };
const PS_MS = 3_000;
const psSlow = `ps did not answer within ${PS_MS / 1000} s`;
/** the recorded server: `alive` = same pid, a tmux process of this user and this socket name, started when it was recorded (when
 * known); `dead` = the kernel has no such pid, or `ps` shows it is another process (another user's, another program, another socket,
 * another start); `unknown` = the pid exists and `ps` did not tell, with the reason. A pid of another user (EPERM, as after a restart
 * of the Mac, when the recorded pid belongs to a root process: slot 7's U1) is asked about like any other, never unknown by itself.
 * Only `alive` is ever signalled. The command line is read to compare, never printed: a tmux server carries its first client's
 * argv, and Fleet's carries a pane's exported self credentials. */
async function hostState(h: TmuxHost): Promise<HostState> {
  try { process.kill(h.pid, 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ESRCH") return { st: "dead" }; }
  const r = await run(["ps", "-p", String(h.pid), "-o", "etime=", "-o", "uid=", "-o", "comm="], PS_MS);
  if (r.code === null) return { st: "unknown", why: psSlow };
  if (r.code !== 0 || !r.out) {
    // ps found nothing: gone if the kernel agrees now, else unknown
    try { process.kill(h.pid, 0); return { st: "unknown", why: "ps does not list it although the kernel has it" }; } catch { return { st: "dead" }; }
  }
  const [etime, uid, ...comm] = r.out.split(/\s+/);
  const me = process.getuid?.();
  if (me !== undefined && Number(uid) !== me) return { st: "dead" }; // Fleet's tmux server runs as this user
  // on Linux a tmux server renames itself (tmux compat/setproctitle.c, prctl PR_SET_NAME): `ps` shows `tmux: server`, its args stay
  const name = basename(comm.join(" "));
  if (name !== "tmux" && name !== "tmux: server") return { st: "dead" };
  const a = await run(["ps", "-p", String(h.pid), "-o", "args="], PS_MS);
  if (a.code === null) return { st: "unknown", why: psSlow };
  const sockRe = new RegExp(`(^|\\s)-L\\s*${cfg.sock.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
  if (a.code !== 0 || !sockRe.test(a.out)) return { st: "dead" };
  const secs = etimeSeconds(etime);
  if (h.start !== null && secs !== null && Math.abs(Date.now() / 1000 - secs - h.start) > 5) return { st: "dead" };
  return { st: "alive" };
}
/** FLEET'S OWN SEATS, by identity (rounds 3 and 4): a seat is a pane whose process line carries Fleet's self export,
 * `export FLEET_SELF_TOKEN='<token>'; export FLEET_SELF_SLOT='<n>'` (server.ts#ensureSlot's selfExport, in every seat's line), and
 * where Fleet hands over its slots, that token is the CURRENT credential of slot <n>. A session name (`s1`) or the bare text
 * `FLEET_SELF_SLOT=` is no identity, and neither is the line of an orphaned Fleet server whose credentials are stale (round 4's R4).
 * A server without a path still shows its panes: every pane's process is a child of its tmux server. The table is read in memory
 * and never printed or kept: those lines carry the panes' self credentials. */
const SEAT_LINE = /FLEET_SELF_TOKEN='([^'\s]+)';\s*export FLEET_SELF_SLOT='(\d+)'/;
interface Tabelle {
  /** a server's panes, and how many of Fleet's seats they hold: slots, not panes (R4e: a credential copied into two panes is one seat) */
  kinder: (pid: number) => { panes: number; seats: number };
  /** the slot this pane is a seat of, or null */
  sitz: (pid: number) => string | null;
  /** the parents of seat lines other than this pid, most seats first */
  halter: (ausser: number | null) => number[];
  vorfahr: (pid: number) => boolean;
}
async function prozesse(): Promise<Tabelle | null | "unbekannt"> {
  const current = cfg.sitze ? cfg.sitze() : null;
  if (cfg.sitze && current === null) return "unbekannt";
  const own = current ? new Set(current.map((x) => `${x.slot}\t${x.token}`)) : null;
  const r = await run(["ps", "-A", "-o", "pid=", "-o", "ppid=", "-o", "args="], PS_MS);
  if (r.code !== 0) return null;
  const eltern = new Map<number, number>();
  const marked = new Map<number, string>();
  for (const l of r.out.split("\n")) {
    const m = /^\s*(\d+)\s+(\d+)\s?(.*)$/.exec(l);
    if (!m) continue;
    eltern.set(Number(m[1]), Number(m[2]));
    const seat = SEAT_LINE.exec(m[3]);
    if (seat && (!own || own.has(`${seat[2]}\t${seat[1]}`))) marked.set(Number(m[1]), seat[2]);
  }
  const kinder = (pid: number): { panes: number; seats: number } => {
    let panes = 0;
    const slotsHier = new Set<string>();
    for (const [c, pp] of eltern) if (pp === pid) { panes++; const slot = marked.get(c); if (slot !== undefined) slotsHier.add(slot); }
    return { panes, seats: slotsHier.size };
  };
  return {
    kinder,
    sitz: (pid) => marked.get(pid) ?? null,
    halter: (ausser) => [...new Set([...marked.keys()].map((c) => eltern.get(c) ?? 0))].filter((pp) => pp > 1 && pp !== ausser)
      .sort((a, b) => kinder(b).seats - kinder(a).seats),
    vorfahr: (pid) => { for (let p = process.pid, i = 0; p > 1 && i < 64; i++) { p = eltern.get(p) ?? 0; if (p === pid) return true; } return false; },
  };
}
/** the panes of whatever server answers on the path now (session name, pane process), read before that path is taken from it */
async function panesAtPath(): Promise<{ session: string; pid: number }[] | null> {
  const r = await run(["tmux", "-u", "-N", "-L", cfg.sock, "list-panes", "-a", "-F", "#{session_name}\t#{pane_pid}"], cfg.answerTimeoutMs);
  return r.code === 0 ? r.out.split("\n").filter(Boolean).map((l) => { const [session, pid] = l.split("\t"); return { session, pid: Number(pid) || 0 }; }) : null;
}
/** said only of the pid the record names: a server found by its seats (L2/L4) or by this process's own $TMUX is not in it */
const recordedIn = (pid: number): string => cfg.file && readFile()?.pid === pid ? ` (recorded in ${cfg.file})` : "";

function readFile(): TmuxHost | null {
  if (!cfg.file) return null;
  try {
    const [pid, start, socket] = readFileSync(cfg.file, "utf8").trim().split("\t");
    const n = Number(pid);
    return Number.isSafeInteger(n) && n > 0 && socket ? { pid: n, start: Number(start) || null, socket } : null;
  } catch { return null; }
}
function note(h: TmuxHost): void {
  if (host && host.pid === h.pid && host.start === h.start) return;
  host = h;
  if (!cfg.file) return;
  try {
    const tmp = `${cfg.file}.tmp`;
    writeFileSync(tmp, `${h.pid}\t${h.start ?? ""}\t${h.socket}\n`, { mode: 0o600 });
    renameSync(tmp, cfg.file);
  } catch { /* the memory copy still guards this process */ }
}
/** this process's own tmux server, when it runs inside a pane on the same socket path (srv does) */
function ownHost(): TmuxHost | null {
  const [path, pid] = (process.env.TMUX ?? "").split(",");
  const n = Number(pid);
  return path && Number.isSafeInteger(n) && n > 0 && samePath(path, expectedSocket()) ? { pid: n, start: null, socket: path } : null;
}
function known(): TmuxHost | null {
  if (!host && !fileRead) { fileRead = true; host = readFile(); }
  return host ?? ownHost();
}

const fmt = (sec: number | null): string => sec ? new Date(sec * 1000).toISOString().slice(0, 19).replace("T", " ") : "unknown";
const iso = (msAt: number): string => new Date(msAt).toISOString().slice(0, 19).replace("T", " ");
async function startOf(h: TmuxHost): Promise<number | null> {
  if (h.start) return h.start;
  const r = await run(["ps", "-p", String(h.pid), "-o", "etime="], PS_MS);
  const s = etimeSeconds(r.out);
  return s === null ? null : Math.round(Date.now() / 1000 - s);
}
function say(line: string): void {
  if (line === lastLine) return;
  lastLine = line;
  cfg.melde(line);
}

/** Fleet opens nothing and says why. Never a signal, never advice to end the server that holds the seats. */
function wait(h: TmuxHost, answering: number | null, line: string): TmuxLage {
  const since = lost?.pid === h.pid ? lost.since : Date.now();
  lost = { pid: h.pid, since, line };
  say(line);
  return { state: "lost", host: h, answering, reattached: false, line };
}

/** N5 and W1, by identity: another live server X is recorded while the server A answers on the path. The path goes to the one that
 * holds Fleet's own seats: A keeps it when it holds more of them than X (X counted by its children's command lines, it has no path);
 * X gets it back when it holds at least as many and at least one. Only when neither holds one of Fleet's seats do panes and age
 * decide (round 2): A keeps the path when Fleet runs in A, A holds a pane besides srv, no fewer than X, and is the older (the server
 * that took the path later is the intruder; within one second the lower pid). Returns the line when A keeps the path, null when X
 * gets it back. Nothing that ps or tmux could not tell keeps the path from X. */
type Wahl = { keep: string } | { back: true } | { wait: string };
async function seatsHere(h: TmuxHost, answering: TmuxHost, gleichstandBleibt = false): Promise<Wahl> {
  const tab = await prozesse();
  const panes = await panesAtPath();
  // what cannot be read waits, as an unconfirmed host does (S1; round 4's R6b: a slow `ps -A` used to hand the path to the record)
  if (tab === "unbekannt" || !tab || !panes) {
    const why = tab === "unbekannt" ? "Fleet does not know its own seats yet" : !tab ? `ps -A did not answer within ${PS_MS / 1000} s`
      : `tmux server pid ${answering.pid} did not list its panes within ${cfg.answerTimeoutMs} ms`;
    return { wait: `tmux server pid ${answering.pid} answers on ${expectedSocket()}, and pid ${h.pid}${recordedIn(h.pid)} is a live tmux server of`
      + ` this socket name too; which one holds Fleet's seats could not be told (${why}), so Fleet signals nothing, ends nothing and opens`
      + " no pane until it can tell" };
  }
  const here = panes.filter((p) => p.session !== cfg.srvSession);
  const hereSeats = here.filter((p) => tab.sitz(p.pid) !== null);
  const hereSlots = new Set(hereSeats.map((p) => tab.sitz(p.pid))).size;
  const there = tab.kinder(h.pid);
  const names = (list: { session: string }[]): string => {
    const n = [...new Set(list.map((p) => p.session))];
    return n.length ? `: ${n.slice(0, 8).join(", ")}${n.length > 8 ? ", …" : ""}` : "";
  };
  const keep = `. Fleet keeps the path where the seats are, ends nothing, and records pid ${answering.pid}`;
  if (hereSlots > there.seats || (gleichstandBleibt && hereSlots > 0 && hereSlots === there.seats))
    return { keep: `tmux socket ${expectedSocket()}: tmux server pid ${answering.pid} answers there and holds ${hereSlots} of Fleet's seats`
      + `${names(hereSeats)}; pid ${h.pid}${recordedIn(h.pid)} is a tmux server of this socket name without a path, holding ${there.seats} of`
      + ` them in ${there.panes} pane(s)${keep}` };
  const back = { back: true } as const;
  if (there.seats > 0) return back;
  const own = ownHost();
  if (!own || own.pid !== answering.pid) return back;
  if (here.length === 0 || here.length < there.panes) return back;
  const xStart = await startOf(h);
  if (answering.start === null || xStart === null) return back;
  if (answering.start > xStart || (answering.start === xStart && answering.pid > h.pid)) return back;
  return { keep: `tmux socket ${expectedSocket()}: neither tmux server holds one of Fleet's seats; Fleet runs in pid ${answering.pid}, which`
    + ` answers there, is the older and holds ${here.length} pane(s) besides ${cfg.srvSession}${names(here)}; pid ${h.pid}${recordedIn(h.pid)} has no`
    + ` path and holds ${there.panes} pane(s)${keep}` };
}

async function takeBack(h: TmuxHost, answering: number | null): Promise<TmuxLage> {
  const since = lost?.pid === h.pid ? lost.since : Date.now();
  const start = await startOf(h);
  const path = expectedSocket();
  const panes = answering ? await panesAtPath() : null;
  const other = panes ? [...new Set(panes.map((p) => p.session))] : null;
  const own = ownHost();
  const fleetInOther = !!(own && answering && own.pid === answering && own.pid !== h.pid);
  const holder = `Fleet's tmux server pid ${h.pid} (running since ${fmt(start)})`;
  const last = lastSignal.get(h.pid) ?? 0;
  if (Date.now() - last >= 5_000) {
    lastSignal.set(h.pid, Date.now());
    try { process.kill(h.pid, "SIGUSR1"); } catch { /* it died in between: the next check finds no host */ }
    for (const until = Date.now() + cfg.reattachWaitMs; ;) {
      const a = await answer();
      if (a.kind === "ok" && a.host.pid === h.pid) {
        lost = null;
        refusedSince = null;
        lastSignal.delete(h.pid); // the episode is over: the next loss signals at once
        note({ ...h, start, socket: a.host.socket || h.socket });
        const what = answering
          ? `tmux server pid ${answering} had taken the path${other ? ` holding ${other.length} session(s)${other.length ? `: ${other.slice(0, 8).join(", ")}${other.length > 8 ? ", …" : ""}` : ""}` : ""}`
          : `the path was gone since ${iso(since)}`;
        if (fleetInOther) besideAsked = own!.pid; // the restart is asked for here, once
        const after = !answering ? ""
          : fleetInOther
            ? (cfg.neustart?.() ? `; Fleet's own server ran in pid ${answering} and restarts now so that it runs beside the seats`
              : `; Fleet's own server still runs in pid ${answering} without a path: restart srv so that it runs beside the seats`)
            : `; pid ${answering} runs on without a path`;
        const line = `tmux socket ${path}: ${what}; ${holder} holds every seat and took the path back on SIGUSR1${after}`;
        say(line);
        return { state: "lost", host: h, answering, reattached: true, line };
      }
      if (Date.now() >= until) break;
      await Bun.sleep(100);
    }
  }
  return wait(h, answering, `tmux socket ${path} is lost since ${iso(since)}${answering ? ` (tmux server pid ${answering} answers there)` : ""}: ${holder}`
    + " still holds every seat and has not taken its path back yet; Fleet asked it to and opens no second copy of any seat until it answers");
}

/** W1 after a late take-back: the seats' server answers, but this process still runs in another live server of this socket name
 * (it took the path back after the wait, so the take-back's own restart never ran). srv belongs beside the seats: restart once. */
async function besideTheSeats(seats: TmuxHost): Promise<void> {
  const own = ownHost();
  if (!own || own.pid === seats.pid || besideAsked === own.pid) return;
  // $TMUX names a server only by pid. It is this process's own server when it answered on the path with that pid (its start time
  // is then known and checked), or when it is an ancestor of this process; a stale $TMUX whose pid a tmux client took over is
  // neither (round 3's B2), and a dead one is not alive (N2).
  const tab = ownSeen?.pid === own.pid ? null : await prozesse();
  const confirmed = ownSeen?.pid === own.pid ? (await hostState(ownSeen)).st === "alive"
    : !!tab && tab !== "unbekannt" && tab.vorfahr(own.pid) && (await hostState(own)).st === "alive";
  if (!confirmed) return;
  besideAsked = own.pid;
  say(`tmux socket ${expectedSocket()}: Fleet's tmux server pid ${seats.pid} answers there and holds the seats; Fleet's own server`
    + ` runs in pid ${own.pid} without a path${cfg.neustart?.() ? " and restarts now so that it runs beside the seats" : ": restart srv so that it runs beside the seats"}`);
}

/** L2/L4: the record names no second server (missing or wrong), so nothing above compared. Once after the state is loaded: do current
 * seat lines lie under another live server of this socket name than the one answering (`answering` null: nobody answers)? Then the
 * rule above decides, and a tie stays where the path is. Returns the state to report, or null when the path stays. What cannot be read
 * waits and asks again at the next check. */
let sitzeVerglichen = false;
async function sitzeAnderswo(answering: TmuxHost | null): Promise<TmuxLage | null> {
  if (sitzeVerglichen || !cfg.sitze) return null;
  const aktuell = cfg.sitze();
  if (aktuell === null) return null;
  const path = expectedSocket();
  const nobody: TmuxHost = { pid: 0, start: null, socket: path };
  const wer = answering ? `tmux server pid ${answering.pid} answers on ${path}` : `nothing answers on ${path}`;
  const offen = (why: string): TmuxLage => wait(answering ?? nobody, answering?.pid ?? null, `${wer}; whether Fleet's seats lie under another tmux`
    + ` server could not be told (${why}), so Fleet signals nothing, ends nothing and opens no pane until it can tell`);
  const tab = aktuell.length ? await prozesse() : "leer";
  if (tab === "leer") { sitzeVerglichen = true; return null; }
  if (!tab || tab === "unbekannt") return offen(`ps -A did not answer within ${PS_MS / 1000} s`);
  for (const pid of tab.halter(answering?.pid ?? null)) {
    const x: TmuxHost = { pid, start: null, socket: path };
    const st = await hostState(x);
    if (st.st === "dead") continue; // no tmux server of this socket name: another instance's, or a child of a pane
    if (st.st === "unknown") return offen(st.why);
    if (!answering) {
      const lage = await takeBack(x, null);
      sitzeVerglichen = lage.state === "lost" && lage.reattached;
      return lage;
    }
    const wahl = await seatsHere(x, answering, true);
    if ("wait" in wahl) return wait(x, answering.pid, wahl.wait);
    if ("back" in wahl) {
      const lage = await takeBack(x, answering.pid);
      sitzeVerglichen = lage.state === "lost" && lage.reattached;
      return lage;
    }
    say(wahl.keep);
    sitzeVerglichen = true;
    return null;
  }
  sitzeVerglichen = true;
  return null;
}

async function pruefeEinmal(): Promise<TmuxLage> {
  const a = await answer();
  const h = known();
  const path = expectedSocket();
  const own = ownHost();
  if (a.kind === "ok" && own && own.pid === a.host.pid) ownSeen = a.host;
  if (a.kind === "ok") {
    if (h && h.pid !== a.host.pid) {
      const st = await hostState(h);
      if (st.st === "alive") {
        const wahl = await seatsHere(h, a.host);
        if ("wait" in wahl) return wait(h, a.host.pid, wahl.wait);
        if ("back" in wahl) return await takeBack(h, a.host.pid);
        say(wahl.keep);
      }
      if (st.st === "unknown")
        return wait(h, a.host.pid, `tmux server pid ${a.host.pid} answers on ${path}, but pid ${h.pid}, recorded as holding Fleet's seats${recordedIn(h.pid)},`
          + ` still exists and could not be confirmed (${st.why}); Fleet opens no pane until it can tell`);
    }
    const anderswo = await sitzeAnderswo(a.host);
    if (anderswo) return anderswo;
    note(a.host);
    lost = null;
    refusedSince = null;
    await besideTheSeats(a.host);
    return { state: "ok", pid: a.host.pid };
  }
  if (a.kind === "none" && !existsSync(path)) refusedSince = null;
  else if (a.kind === "none") refusedSince ??= Date.now();
  if (!h) {
    // something listens without answering, and Fleet does not know what: never start a server beside it
    if (a.kind === "slow")
      return wait({ pid: 0, start: null, socket: path }, null, `a tmux server on ${path} does not answer within ${cfg.answerTimeoutMs} ms`
        + " and Fleet has no record of it; Fleet opens no pane until it answers");
    const anderswo = await sitzeAnderswo(null);
    if (anderswo) return anderswo;
    lost = null;
    return { state: "none" };
  }
  const st = await hostState(h);
  if (st.st === "dead") {
    if (a.kind === "slow")
      return wait(h, null, `a tmux server on ${path} does not answer within ${cfg.answerTimeoutMs} ms; Fleet opens no pane until it answers`);
    host = null;
    const anderswo = await sitzeAnderswo(null);
    if (anderswo) return anderswo;
    lost = null;
    refusedSince = null;
    return { state: "none" };
  }
  const holder = `Fleet's tmux server pid ${h.pid} (running since ${fmt(await startOf(h))})`;
  if (st.st === "unknown")
    return wait(h, null, `${holder}${recordedIn(h.pid)} still exists but could not be confirmed (${st.why}) and ${path} does not answer;`
      + " Fleet opens no pane until it can tell");
  if (a.kind === "slow")
    return wait(h, null, `${holder} does not answer on ${path} within ${cfg.answerTimeoutMs} ms; it keeps its socket and every seat,`
      + " and Fleet opens no pane until it answers again");
  if (existsSync(path)) {
    // the path is there and refuses: a full queue (the server is stalled) or a stale file. A stalled server needs time, not a signal.
    if (Date.now() - (refusedSince ?? Date.now()) < cfg.refusedSignalMs)
      return wait(h, null, `${holder} does not accept connections on ${path} (a full queue or a stale file); Fleet opens no pane and`
        + ` waits, and asks it to recreate its socket if this lasts ${Math.round(cfg.refusedSignalMs / 1000)} s`);
  }
  return await takeBack(h, null);
}
/** one check at a time: many slots healing at once share it, so the old server gets one signal, not twenty */
export function pruefeTmux(): Promise<TmuxLage> {
  inflight ??= pruefeEinmal().finally(() => { inflight = null; });
  return inflight;
}

/** before a new-session: the flags it runs with, or the line why it must not run */
export async function vorNeuerSitzung(): Promise<{ flags: string[]; startsServer: boolean } | { refuse: string }> {
  const lage = await pruefeTmux();
  if (lage.state === "lost" && !lage.reattached) return { refuse: lage.line };
  if (lage.state === "none") return { flags: [], startsServer: true };
  return { flags: ["-N"], startsServer: false };
}
/** after a new-session that was allowed to start the server: record which one it started */
export async function nachNeuerSitzung(): Promise<void> { await pruefeTmux(); }

// the periodic look, so a lost path is found even when no slot needs a pane (the watchdog's srv is then what notices it)
let lastTakt = 0;
export function tmuxWachtTakt(everyMs = 10_000): void {
  if (Date.now() - lastTakt < everyMs) return;
  lastTakt = Date.now();
  void pruefeTmux().catch(() => { /* the next beat asks again */ });
}

/** for tests: forget what this process recorded */
export function tmuxWachtZuruecksetzen(): void {
  host = null; fileRead = false; lost = null; sitzeVerglichen = false; besideAsked = 0; ownSeen = null; refusedSince = null; lastSignal = new Map(); inflight = null; lastTakt = 0; lastLine = "";
}
