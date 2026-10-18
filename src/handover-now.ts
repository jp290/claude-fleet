// WHAT HAPPENS TO THIS SESSION NEXT, AND WHEN (Neuaufbau K16, auftraege/uebergabe-b-englisch.md). Owner 16.10. 18:2x: the noon
// draft „[Zitat entfernt]“, but „[Zitat entfernt]“
// . Every line answers one of two questions — what happens to this
// session next, and when; or what can I change about it — and everything else is a tooltip. Principle (12:2x): Fleet nudges
// the session to lead its own succession; a new session by force only makes sense with a cold cache, by hand.
// Runde C (auftraege/uebergabe-c-zwei-arten.md, owner 16.10. 19:3x/21:1x): „[Zitat entfernt]“, not „[Zitat entfernt]“; Fleet nudges once and then
// relies on the session; into a cold session it types nothing, the block offers „[Zitat entfernt]“ instead.
// Pure: read off the succession facts the server acts on (server.ts#tickMigrate with server/succession.ts#thresholdStep,
// #actDecision, #cacheCooling, the hint budget, #warmDecision), so bun test reads the same words the column paints. A
// point in time Fleet does not know is not guessed.
import type { BriefSuccession } from "./board";

export type Choice = NonNullable<BriefSuccession["atThreshold"]>;
// why no threshold can fire here (server.ts#successionThresholdOff)
export const OFF_WHY: Record<NonNullable<BriefSuccession["thresholdOff"]>, string> = {
  fleet: "not switched on in this Fleet",
  rail: "set to 0 for this kind of session",
  harness: "only for Claude sessions",
  steward: "the planning session is never asked",
  waiting: "it is waiting for you",
  unpinned: "no conversation to measure yet",
  session: "turned off for this session",
};
// a gate the owner cannot open from here: the fleet's master switch, another agent, the steward — and the two that pass
// on their own (it waits for the owner, no conversation pinned yet)
export const lockedGate = (sc: BriefSuccession): boolean =>
  !!sc.thresholdOff && sc.thresholdOff !== "rail" && sc.thresholdOff !== "session";

// what Fleet does at the cap (server/succession.ts#fleetChoiceOf: since 18.10. only the nudge for every kind, a new session
// only where it is chosen); „hint“ with the asking off leaves Fleet nothing to do at all
export const choiceOf = (sc: BriefSuccession): Choice => sc.atThreshold ?? sc.fleetChoice ?? "hint";
export const handoverDoesNothing = (sc: BriefSuccession): boolean => sc.thresholdPct !== null && !sc.nudgeOn && choiceOf(sc) === "hint";

// THE ONE SETTING: Fleet nudges (with the fleet's own act at the cap), or the handover is off for this session
export type Plan = "nudge" | "off";
export const PLAN_WORDS: Record<Plan, string> = { nudge: "Nudge", off: "Off" };
export const planOf = (sc: BriefSuccession): Plan =>
  sc.thresholdPct === null || sc.sessionPct === 0 || handoverDoesNothing(sc) ? "off" : "nudge";
export type PlanWrite = { thresholdPct?: number | null; nudge?: boolean; atThreshold?: Choice | null };
// ONE write per click (PATCH …/handover takes the fields together). „Nudge“ is the fleet's own: the nudge on and the act at
// the cap the fleet's, and a session switched off follows the fleet's threshold again
export const planWrite = (sc: BriefSuccession, p: Plan): PlanWrite => p === "off" ? { thresholdPct: 0 }
  : { ...(sc.sessionPct === 0 ? { thresholdPct: null } : {}), nudge: true, atThreshold: null };

// the cache at `now` on the server's clock: the brief says warm or cold when it was read, the minutes run on
export type CacheNow = { state: NonNullable<BriefSuccession["cache"]>["state"]; min: number | null };
export function cacheNow(c: NonNullable<BriefSuccession["cache"]>, now: number): CacheNow {
  if ((c.state !== "warm" && c.state !== "kalt") || c.coldAt === null) return { state: c.state, min: null };
  const left = c.coldAt - now;
  // to the nearest minute, at least one while warm: the client's clock runs up to a second behind the server's
  return left > 0 ? { state: "warm", min: Math.max(1, Math.round(left / 60_000)) } : { state: "kalt", min: Math.floor(-left / 60_000) };
}
// server/succession.ts#COOLING_LEAD_MS: without a warm turn Fleet acts this long before the cache goes cold
const COOLING_LEAD_MS = 10 * 60_000;
// server/succession.ts#CAP_GAP_PCT, for an older server that sends no cap
export const CAP_GAP_PCT = 5;
export const kTokens = (n: number): string => `${Math.round(n / 1000)}k`;
// a time of today as 14:05, an older one with its day
export function clockText(at: number, now: number): string {
  const d = new Date(at), n = new Date(now);
  const hm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === n.toDateString() ? hm : `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })} ${hm}`;
}
const pctText = (p: number): string => `${Math.round(p)} %`;

// ONE LINE: when (or what it is about), what happens then in one sentence, a short grey note under it (`why`), where the
// fill stands against it (`status`) and the explanation for hover and ⓘ (`tip`)
export type StepId = "nudge" | "act" | "off" | "cache";
export interface Step { id: StepId; when: string; what: string; tip: string; why?: string; grey?: boolean; status?: string }

export interface FlowFacts { now: number; lane: boolean;
  // when this occupant last wrote its standing handover (the sessions row), undefined = none
  handoverAt?: number }

// the one nudge that reached this conversation: „nudged 14:02 (41 %)“
export function nudgedText(sc: BriefSuccession, now: number): string | null {
  if (!sc.nudges) return null;
  return `nudged${sc.nudgedAt ? ` ${clockText(sc.nudgedAt, now)}` : ""}${sc.nudgedPct != null ? ` (${pctText(sc.nudgedPct)})` : ""}`;
}

export function flowSteps(sc: BriefSuccession, f: FlowFacts): Step[] {
  const steps: Step[] = [];
  const cache = sc.cache ? cacheNow(sc.cache, f.now) : null;
  const kc = sc.keepCache;
  const keptWarm = !!kc && kc.on && !kc.exempt;
  const fill = sc.fill?.pct ?? null;
  const base = sc.thresholdPct;

  if (base === null || planOf(sc) === "off") {
    const gate = sc.thresholdOff;
    steps.push(lockedGate(sc)
      ? { id: "off", when: "Off", what: "Fleet runs no succession here.", why: OFF_WHY[gate!], grey: true,
        tip: "No nudge and no new session from Fleet. You can still nudge the session yourself." }
      : { id: "off", when: "Off", what: "Fleet won't nudge or step in.", why: gate === "rail" && sc.sessionPct !== 0 ? OFF_WHY.rail : undefined,
        tip: "No nudge, no new session and no compacting by Fleet." });
  } else {
    const cap = sc.capPct ?? base + CAP_GAP_PCT;
    const choice = choiceOf(sc);
    const running = sc.act && sc.act.outcome === "läuft" ? sc.act : null;
    const nudged = nudgedText(sc, f.now);
    const left = fill === null ? null : base - fill;
    const cold = cache?.state === "kalt";
    // below the cap a fresh standing handover holds the nudge back (server.ts#tickMigrate, standingHandoverFresh); a cold
    // cache holds it back for good (server/succession.ts#HintLedger.due)
    const written = f.handoverAt !== undefined ? `handover written ${clockText(f.handoverAt, f.now)}` : null;
    steps.push({ id: "nudge", when: pctText(base),
      what: sc.nudgeOn ? "Fleet nudges the session once to succeed." : "Fleet doesn't nudge: turned off for this session.", grey: !sc.nudgeOn,
      status: nudged ?? (fill !== null && fill >= base && fill < cap && written ? written
        : left !== null && left <= 0 && cold && sc.nudgeOn ? "not into a cold cache"
        : left === null ? undefined : left > 0 ? `${Math.ceil(left)} % to go` : "due"),
      tip: "Fleet types one message into the session, once: write the handover and start the successor itself. "
        + "It picks its own moment, and Fleet doesn't nudge again. Never into a cold cache: that would read the whole context again."
        + (f.lane ? " A lane succeeds with its own report; Fleet starts no new session." : "")
        + (written ? ` The session wrote its handover at ${clockText(f.handoverAt!, f.now)}; a successor starts from it.` : "")
        + (left !== null && left > 0 && sc.fill ? ` About ${kTokens(left / 100 * sc.fill.windowTokens)} tokens to go.` : "") });

    if (running) {
      steps.push({ id: "act", when: "now", what: running.act === "succeed" ? "Fleet is starting a new session." : "Fleet is compacting the session.",
        status: `since ${clockText(running.at, f.now)}`, tip: "Fleet acts only while the session is idle." });
    } else if (choice !== "hint") {
      // due (server/succession.ts#thresholdStep + #actDecision): the cap, or above the base a cache about to go cold that nothing
      // keeps warm; a cold cache under the cap is the owner's offer (actDecision „[Zitat entfernt]“), never Fleet's own act
      const coolAt = sc.cache && sc.cache.coldAt !== null && !keptWarm
        ? sc.cache.coldAt - Math.min(COOLING_LEAD_MS, (sc.cache.ttlSec * 1000) / 5) : null;
      const due = fill !== null && fill >= base && (fill >= cap || (coolAt !== null && cache?.state === "warm" && f.now >= coolAt));
      const what = choice === "succeed" ? "Fleet starts a new session if it hasn't succeeded yet."
        : "Fleet compacts the session if it hasn't succeeded yet.";
      // the 5-point window (owner 17:5x: „[Zitat entfernt]“): up to the cap only while the cache is warm
      const window = due ? undefined
        : cold ? "The cache is cold: start a new session from a summary below, or Fleet does it at the cap."
        : coolAt !== null && cache?.state === "warm" ? `Up to ${pctText(cap)} only until ${clockText(coolAt, f.now)}, before the cache goes cold.`
        : keptWarm ? `Fleet keeps the cache warm, so the session has until ${pctText(cap)}.`
        : undefined;
      steps.push({ id: "act", when: due ? "now" : pctText(cap), what, why: window, status: due ? "due" : undefined,
        tip: `Only once the session is idle, never in the middle of a turn${sc.nudgeOn ? ", and after the nudge while the cache is warm" : ""}.` });
    }
  }

  // THE CACHE, one line: how long it stays warm, whether Fleet keeps it warm (its next turn, or why it stopped), and
  // whether Claude Code compacts on its own (befunde/18 §5.1: off where Fleet hands over)
  if (cache) {
    const parts: string[] = [];
    const tips: string[] = [];
    parts.push(cache.state === "warm" && sc.cache?.coldAt != null ? `Warm until ${clockText(sc.cache.coldAt, f.now)}`
      : cache.state === "kalt" && sc.cache?.coldAt != null ? `Cold since ${clockText(sc.cache.coldAt, f.now)}`
      : cache.state === "kompaktiert" ? "Fresh after compacting" : "Not read yet");
    tips.push(cache.state === "kalt" ? "Cold: the next turn reads the whole context again." : "While warm, the next turn is cheap.");
    if (keptWarm) {
      parts.push(kc.reason === "warm-cap" ? `Fleet stopped keeping it warm after ${kc.warmMax ?? kc.warmTurns} turns`
        : kc.reason === "hour-cap" ? `Fleet keeps it warm, ${kc.hourCap} turns this hour used`
        : kc.dueAt != null && kc.dueAt > f.now ? `Fleet keeps it warm, next turn ${clockText(kc.dueAt, f.now)}`
        : "Fleet keeps it warm");
      tips.push(`Fleet types a short turn after ${kc.idleMin} min idle, at most ${kc.hourCap} an hour.`);
    } else if (kc && !kc.exempt) parts.push("not kept warm");
    const own = sc.compaction && sc.compaction.trigger !== "manual" ? sc.compaction : null;
    if (sc.autoCompact === false) {
      parts.push("auto-compact off");
      tips.push("Claude Code's own auto-compact is off since the start; Fleet's succession keeps the context small.");
    } else if (sc.autoCompact === true) {
      parts.push("Claude Code compacts it when idle");
      tips.push("Claude Code compacts on its own from about 200k tokens, shortly before the cache goes cold.");
    } else if (own) parts.push(`Claude Code compacted it at ${clockText(own.at, f.now)}`);
    steps.push({ id: "cache", when: "Cache", what: `${parts.join(" · ")}.`, tip: tips.join(" ") });
  }
  return steps;
}

// THE TEXTS TYPED INTO THE SESSION (German, like Fleet's own nudge in server/succession.ts#hintText). „Later“ answers a nudge
// already given (owner Z50: „[Zitat entfernt]“); the
// cap above it is where Fleet acts itself.
export function laterText(pct: number, act: Choice, lane: boolean): string {
  const then = act === "succeed" ? ` Bei ${pct + CAP_GAP_PCT} % öffnet Fleet sonst selbst eine neue Session.`
    : act === "compact" ? ` Bei ${pct + CAP_GAP_PCT} % fasst Fleet sonst deinen Verlauf zusammen.` : "";
  return `Noch nicht weitergeben: Arbeite bitte weiter, bis dein Kontext bei ${pct} % steht, und gib dann selbst weiter${lane ? " (mit deinem Bericht)" : ""}.${then}`;
}
// „Succeed now“: the session leads its own succession (owner 16.10. 12:2x); the doors are named so it finds them
export function nowText(lane: boolean): string {
  return lane
    ? "Bitte gib jetzt weiter: Bring den laufenden Schritt zu Ende, committe, schreib deinen Übergabebericht (fleet-report mit status handoff) und gib dann selbst an eine frische Session weiter (POST /api/self/succeed)."
    : "Bitte gib jetzt weiter: Schreib deine Übergabe (POST /api/self/handover) und starte dann selbst deine Nachfolge (POST /api/self/succeed).";
}
