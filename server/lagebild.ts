// DIE ÜBERSICHT FÜR AGENTEN (C1; Owner 1.11. ~02:45: „[Zitat entfernt]“). GET /api/self/overview
// sagt einem Sitz ohne den Schlüssel des Owners, was um ihn läuft: je Sitz Name, Harness, Modell, Effort, Zustand und seit wann, wer ihn
// öffnete (nach der Linie, server/opener.ts#istOeffnerin), worauf er wartet (eine Rückfrage, die Vertrauensfrage, ungelesene Post, eine
// Übergabe), Kontextfüllung und ob sein Cache warm ist; für einen Sitz, dessen Öffnerin der Aufrufer ist, dazu wie lange er still ist,
// der Kopf seines Branches und dessen letzter Merge-Check. Jedes Feld nennt seine Quelle (`sources`), und was Fleet nicht weiß, steht als
// null mit seinem Grund unter `unknown` — nie geraten.
//
// KEIN ZWEITES BOARD: die Sitze der eigenen Linie sind die von GET /api/self/constellation (server/konstellation-sicht.ts#konstellationSicht),
// und jede Tatsache dazu ist eine, die Fleet für das Board oder seine Ticks schon hält (server.ts#lageFaktenVon liest sie); diese Datei
// fügt sie nur zusammen.
//
// DIE REICHWEITE (Auftrag C1, Punkt 2): ein Sitz sieht seine Linie — die Öffnerin, die Sitze, die er öffnete, deren Geschwister —, die
// Orchestratorin jeden Sitz, dieselbe Regel wie die Rückfrage (server.ts#rueckfrageRecht: die Öffnerin oder die Orchestratorin). Die
// Einzelheiten des Öffners (still seit, Branch, Merge-Check) bekommt, wer das Recht des Öffners an der Rückfrage hat: die Öffnerin für
// ihre Kinder, die Orchestratorin für jeden Sitz außer den eigenen des Owners.
//
// DIE DATENGRENZE (server/datengrenze.ts, Tür 16): die Übersicht trägt keinen Text einer Nachricht, eines Panes, eines Transkripts, eines
// Packs oder einer Übergabe — nur Fleets eigene Felder, Zahlen und die Namen, die die Konstellationstür demselben Aufrufer schon gibt.
// Die Rückfrage steht nur als „da, seit“, nie mit ihrem Wortlaut. Die eigenen Sitze des Owners außerhalb der Linie zeigt sie streng
// (OWNER_SITZ_FELDER) — wie viel mehr, ist sein Wort.
import { istOeffnerin, type Opener } from "./opener";
import type { Sicht, SichtSitz } from "./konstellation-sicht";
import { checkAusLedger } from "./branches";

export const LAGEBILD_SCHEMA = "fleet.overview/v1";

// ---- DIE EIGENEN SITZE DES OWNERS: die eine Stelle, an der seine Entscheidung steht ----------------------------------------------------
/** Ein Sitz des Owners: geöffnet ohne Session als Öffnerin (vom Board) und in keiner Rolle von Fleet — keine Lane, keine Program-MAIN, nicht
 *  der Steward, nicht die Orchestratorin (Entscheid der Orchestratorin, Runde 2, C1-4: die sieht sie ganz). */
export const istOwnerSitz = (f: { openedBy: Opener | null; lane: boolean; fleetRolle: FleetRolle | null }): boolean =>
  f.openedBy === null && !f.lane && f.fleetRolle === null;
/** WAS DIE ÜBERSICHT VON EINEM SITZ DES OWNERS AUSSERHALB DER LINIE DES AUFRUFERS ZEIGT. Die Positionen seiner eigenen gespeicherten
 *  Konstellation zählen zur Linie (Entscheid der Orchestratorin, Runde 2, C1-1: die Konstellationstür zeigt sie ihm schon, und in einem Lauf
 *  ist jede Position vom Owner geöffnet — eine Leiterin sieht ihr Team ganz); diese Liste gilt für jeden anderen Sitz des Owners. Die strenge Lesart (Auftrag C1, Punkt 3): Platz,
 *  Zustand und „ein Sitz des Owners“, sonst nichts. Die Frage an den Owner, ob es mehr sein soll (dazu sein Name, oder Name und der Titel
 *  seines Zwecks), ändert nur diese Liste: "name" gibt den Namen frei, "purpose" den Titel des Zwecks. */
export const OWNER_SITZ_FELDER: readonly ("slot" | "relation" | "state" | "name" | "purpose")[] = ["slot", "relation", "state"];

// ---- WAS FLEET VON EINEM LEBENDEN SITZ HÄLT (server.ts#lageFaktenVon) -----------------------------------------------------------------
/** Die Rolle von Fleet, in der ein Sitz steht (server.ts#positionRole, der Steward an seinem Label); null = keine. */
export type FleetRolle = "program-main" | "lane" | "orchestrator" | "steward";
export interface LageFakten {
  slot: number; openedAt: number; cwd: string; linie: string | null; openedBy: Opener | null; lane: boolean; fleetRolle: FleetRolle | null;
  name: string; role: { id: string; name: string } | null; purpose: string | null;
  harness: string | null; model: string | null; effort: string | null;
  sleepingAt: number | null; retiringAt: number | null;
  /** Slot.lastOutput: 0 = die Ausgabe dieses Panes wurde nie beobachtet */
  lastOutput: number;
  /** was der Warte-Tick (server.ts#tickWarteHinweis) auf diesem Pane las; claude: liest der Tick dieses Pane überhaupt */
  warte: { claude: boolean; look: number | null; frageSeit: number | null; vertrauenAt: number | null };
  /** ungelesene Post an seine Adressen (null = er hat keine Adresse); `missing`: warum die Zahl Post verfehlen kann */
  mail: { count: number; oldestAt: number | null; missing: string[] } | null;
  /** Fleets Übergabe-Hinweis an dieses Gespräch (hintLedger); null = keiner seit dem Start des Servers; "no-session" = kein Gespräch bekannt */
  hint: { nudges: number; lastAt: number; gaveUp: boolean } | null | "no-session";
  /** contextReading: der Anteil in Prozent; null = nicht messbar */
  ctxPct: number | null;
  /** deliveryCacheState: at = der neueste Modellaufruf im Transkript, warm = vor der Kante */
  cache: { at: number | null; warm: boolean };
  /** agentInfo, die Probe des Git-Ticks: lebt hinter dem Pane ein Agent; null = der Tick hat diesen Platz noch nicht geprüft */
  agent: string | null;
}
/** Der Branch eines Sitzes aus dem, was der Git-Tick schon hält (server.ts#lageZweig: Name und Kopf aus `git status` des Ticks), und der letzte
 *  Merge-Check aus dem Ledger; `why` nennt den Grund für einen Kopf oder Check, den Fleet nicht weiß. Oder der Grund, warum es keinen Branch gibt. */
export type ZweigFakt = { branch: string; head: string | null; check: { state: string; at: number | null } | null; why: Record<string, string> }
  | { unknown: string };

/** DER BRANCH AUS DEM, WAS DER GIT-TICK HÄLT (server.ts#lageZweig sammelt es, ohne git). Kopf und Check nur, solange der Tick frisch ist —
 *  ist sein letzter Lauf älter als zwei Takte, sind beide null mit seinem Alter (C1-10; wie die Betriebsansicht alte git-Fakten „stale“ nennt,
 *  zwei Takte, weil der Tick seine Zeit erst am Ende stempelt). Der Check nach derselben Regel wie die Branch-Sicht des Boards
 *  (branches.ts#checkAusLedger: running, Tip ODER Basis bewegt = stale); wo Fleet die Basis ohne git nicht nennt, null mit dem Grund (C1-8). Rein. */
/** Ist der letzte Lauf des Git-Ticks frisch genug, um Kopf und Check als gültig zu zeigen: höchstens zwei Takte alt. Rein. */
export const tickFrisch = (gitAt: number | null, tickMs: number, now: number): boolean => gitAt !== null && now - gitAt <= 2 * tickMs;
export function lageZweigAus(e: { branch: string; head: string | null; gitAt: number | null; tickMs: number; now: number; repo: string | null;
  mergeCheck: boolean; laeuft: boolean; base: string | null; imBuch: boolean; rows: readonly unknown[] }): ZweigFakt {
  const why: Record<string, string> = {};
  if (!tickFrisch(e.gitAt, e.tickMs, e.now)) {
    why["branch.head"] = why["branch.check"] = e.gitAt === null
      ? "the git tick's last run failed, or it has not run since the server's start: Fleet holds no current head"
      : `the git tick last ran ${Math.round((e.now - e.gitAt) / 1000)} s ago (more than two ticks of ${Math.round(e.tickMs / 1000)} s), so its head may be old`;
    return { branch: e.branch, head: null, check: null, why };
  }
  if (!e.head) {
    why["branch.head"] = "the git tick named no head commit (a branch without a commit yet)";
    why["branch.check"] = "no head to compare a merge check with";
    return { branch: e.branch, head: null, check: null, why };
  }
  if (!e.repo) why["branch.check"] = "the git tick named no repository for this seat";
  else if (!e.mergeCheck) why["branch.check"] = "the repository has no merge check (no ci/merge-check.ts, no confirmed check command)";
  else if (!e.imBuch || e.base === null) {
    // was das Ledger für diesen Tip sagt, nur als Satz: ohne die Basis ist es kein Urteil, das die Übersicht als Feld zeigt
    const tipAllein = checkAusLedger(e.rows, e.branch, e.head, e.base ?? lastBase(e.rows, e.branch), e.laeuft);
    const sagt = tipAllein.state === "none" ? "the ledger has no row for this branch" : `the newest ledger row says ${tipAllein.state} for this tip`;
    why["branch.check"] = !e.imBuch
      ? `the base was not compared: ${e.branch} has no record in Fleet's branch book, so Fleet names no base for it without git (${sagt})`
      : `the base was not compared: Fleet could not name the repository's integration branch (no repoBases entry, and its primary checkout is on no branch) (${sagt})`;
  } else {
    const v = checkAusLedger(e.rows, e.branch, e.head, e.base, e.laeuft);
    return { branch: e.branch, head: e.head, check: { state: v.state, at: v.at }, why };
  }
  return { branch: e.branch, head: e.head, check: null, why };
}
const lastBase = (rows: readonly unknown[], branch: string): string | null => {
  const last = rows.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && (x as Record<string, unknown>).branch === branch).at(-1);
  return typeof last?.base === "string" ? last.base : null;
};

/** Die Zeitkonstanten des Warte-Ticks, damit die reine Funktion dieselbe Frische misst wie rueckfrageView. */
export interface TickTakt { warteTickMs: number; ruhigMs: number }

export type Relation = "self" | "opener" | "child" | "sibling" | "position" | "fleet" | "owner-seat";
export type Wartet =
  | { kind: "permission"; since: number }
  | { kind: "trust"; seenAt: number }
  | { kind: "mail"; count: number; oldestAt: number | null }
  | { kind: "handover"; step: "succession-under-way"; since: number }
  | { kind: "handover"; step: "hinted"; nudges: number; lastAt: number; gaveUp: boolean };
export interface LageZeile {
  slot: number | null; relation: Relation;
  name?: string; role?: { id: string; name: string } | null; purpose?: string | null;
  harness?: string | null; model?: string | null; effort?: string | null;
  state: "live" | "asleep" | "handing-over" | "ended" | "not-started";
  since?: number | null;
  openedBy?: { slot: number; live: boolean } | null;
  waits?: Wartet[];
  ctxPct?: number | null; cacheWarm?: boolean | null; agent?: string | null;
  idleMs?: number | null; branch?: { name: string; head: string | null; check: { state: string; at: number | null } | null } | null;
  unknown?: Record<string, string>;
}
export interface Lagebild {
  schema: typeof LAGEBILD_SCHEMA; at: number;
  me: { slot: number; scope: "line" | "fleet"; scopeRule: string; seat: LageZeile | null };
  sources: Record<string, string>;
  ownerSeats: { shows: readonly string[]; decision: string };
  seats: LageZeile[];
}

// ---- DIE QUELLEN: je Feld, woher Fleet es liest -----------------------------------------------------------------------------------------
const zeit = (at: number | null, now: number): string => at === null ? "not yet run since the server's start" : `last run ${new Date(at).toISOString()}, ${Math.max(0, Math.round((now - at) / 1000))} s before this answer`;
export function lagebildQuellen(bootAt: number, gitAt: number | null = null, now = Date.now()): Record<string, string> {
  return {
    seats: "your line as GET /api/self/constellation draws it (server/konstellation-sicht.ts): the seat that opened you, the seats you opened, their siblings and the seats holding a position of your own saved constellation, whoever opened them; the Orchestratorin every live seat (fleet.json slots); me.seat is your own row",
    "name/role/purpose/harness/model/effort": "the seat record in fleet.json (Slot: label, rolleStein, agentMd.titel, harness, model, effort), as GET /api/self/constellation",
    state: "the seat record: live (Slot.cwd), asleep (Slot.sleeping), handing-over (Slot.successionRetirement: a succession handed over, its successor not yet in place); ended from the start history (start-historie.jsonl), not-started from the saved constellation",
    since: "live: Slot.openedAt; asleep: Slot.sleeping.at; handing-over: Slot.successionRetirement.at",
    openedBy: "Slot.openedBy, matched by the line (server/opener.ts#istOeffnerin): live = a live seat carries that line now",
    "waits.permission": "the waiting tick (server.ts#tickWarteHinweis, every 5 s) on a Claude Code pane quiet for 5 s, the same reading as the board's question (rueckfrageView); only the time it began, never its words",
    "waits.trust": "the same tick's look at Claude Code's trust question (vertrauenView)",
    "waits.mail": "the mailbox ledger (messages in fleet.json): unread rows addressed to the seat's addresses (messageAddressesFor), counted, never their text",
    "waits.handover": `Slot.successionRetirement, and Fleet's handover hint to this conversation (the threshold tick's hint ledger, in memory since the server's start at ${new Date(bootAt).toISOString()})`,
    ctxPct: "the tail of the seat's transcript Fleet reads for the board (server.ts#contextReading), as the board's ctx and the program view's ctx",
    cacheWarm: "the newest model call in that transcript tail and its tier's lifetime (server.ts#deliveryCacheState), as the program view's cacheWarm",
    idleMs: "Slot.lastOutput, the pane-output tick; only for a seat whose opener's right you hold",
    branch: `the git tick (server.ts#tickGit, every 10 s; ${zeit(gitAt, now)}): the branch checked out in the seat's folder and its head, read for this occupant; head and check only while the tick is fresh (its last run at most two ticks old); check = the board's rule (server/branches.ts#checkAusLedger, as GET /api/branches): running while a check runs for this tip, else the newest row for the branch in the repo's merge-check ledger (merge-checks.jsonl, read at most once per tick), stale when it checked another tip or another base — the base as the board's chargeBase: the last land's tip, else the branch's own base, else the repository's integration branch (repoBases, else the branch of its primary checkout, read at most once per tick); null with the reason for a branch outside Fleet's branch book or where no integration branch can be named; only for your own seat and a seat whose opener's right you hold`,
    agent: "the git tick's probe whether an agent runs behind the pane (agentInfo: alive, no-agent, no-pane, unprobed), as the board's agent",
  };
}

const UNBEKANNT = {
  endedLive: "ended: Fleet holds no live facts for a seat that is gone",
  endedSince: "the start history records when a seat opened, not when it ended",
  notStarted: "not started: no seat holds this position",
  warteHarness: "the waiting tick reads only Claude Code panes",
  warteSchlaf: "asleep: the waiting tick does not read a sleeping pane",
  warteAlt: "no look by the waiting tick in the last three ticks (it reads a pane once it has been quiet for 5 s)",
  mailOhne: "the seat has no mailbox address",
  hintOhne: "no conversation id known for this seat, so Fleet's hint ledger cannot name its hint",
  agent: "the git tick has not probed this slot yet",
  ctx: "Fleet cannot measure it: no transcript read for this seat (no session id yet, a harness without a context reader, or a model whose window Fleet cannot name)",
  cache: "no model call read in the seat's transcript tail",
  idle: "the pane's output was never observed",
} as const;

/** WAS DER WARTE-TICK GESEHEN HAT, für einen Sitz und jetzt. Frisch ist ein Blick auf diese Belegung, der nicht älter ist als drei Ticks
 *  (rueckfrageView); sonst weiß Fleet es nicht. Rein. */
export function warteLesung(f: LageFakten, now: number, takt: TickTakt): { waits: Wartet[]; unknown: string | null } {
  if (!f.warte.claude) return { waits: [], unknown: UNBEKANNT.warteHarness };
  if (f.sleepingAt !== null) return { waits: [], unknown: UNBEKANNT.warteSchlaf };
  const frisch = (at: number | null): at is number => at !== null && at >= f.openedAt && now - at <= 3 * takt.warteTickMs;
  if (!frisch(f.warte.look)) return { waits: [], unknown: UNBEKANNT.warteAlt };
  const waits: Wartet[] = [];
  if (f.warte.frageSeit !== null) waits.push({ kind: "permission", since: f.warte.frageSeit });
  if (frisch(f.warte.vertrauenAt)) waits.push({ kind: "trust", seenAt: f.warte.vertrauenAt });
  return { waits, unknown: null };
}

/** EINE ZEILE FÜR EINEN LEBENDEN SITZ. `naeher`: der Aufrufer hält das Recht des Öffners (still seit, Branch). Rein. */
export function lebendeZeile(f: LageFakten, relation: Relation, e: { alle: readonly LageFakten[]; naeher: boolean; zweig: ZweigFakt | undefined;
  now: number; takt: TickTakt }): LageZeile {
  const unknown: Record<string, string> = {};
  const state = f.retiringAt !== null ? "handing-over" : f.sleepingAt !== null ? "asleep" : "live";
  const since = state === "handing-over" ? f.retiringAt : state === "asleep" ? f.sleepingAt : f.openedAt;
  const oeffnerin = f.openedBy ? e.alle.find((x) => x.slot !== f.slot && istOeffnerin({ slot: x.slot, cwd: x.cwd, linie: x.linie }, f.openedBy)) : undefined;
  const openedBy = f.openedBy ? { slot: oeffnerin?.slot ?? f.openedBy.slot, live: !!oeffnerin } : null;

  const w = warteLesung(f, e.now, e.takt);
  const waits = [...w.waits];
  if (w.unknown) unknown["waits.permission"] = unknown["waits.trust"] = w.unknown;
  if (f.mail === null) unknown["waits.mail"] = UNBEKANNT.mailOhne;
  else {
    if (f.mail.count > 0) waits.push({ kind: "mail", count: f.mail.count, oldestAt: f.mail.oldestAt });
    if (f.mail.missing.length) unknown["waits.mail"] = `the count may miss mail: ${f.mail.missing.join(" ")}`;
  }
  if (f.retiringAt !== null) waits.push({ kind: "handover", step: "succession-under-way", since: f.retiringAt });
  if (f.hint === "no-session") unknown["waits.handover"] = UNBEKANNT.hintOhne;
  else if (f.hint && f.hint.nudges > 0 && f.retiringAt === null)
    waits.push({ kind: "handover", step: "hinted", nudges: f.hint.nudges, lastAt: f.hint.lastAt, gaveUp: f.hint.gaveUp });

  if (f.ctxPct === null) unknown.ctxPct = UNBEKANNT.ctx;
  if (f.cache.at === null) unknown.cacheWarm = UNBEKANNT.cache;
  if (f.agent === null) unknown.agent = UNBEKANNT.agent;
  const zeile: LageZeile = { slot: f.slot, relation, name: f.name, role: f.role ? { ...f.role } : null, purpose: f.purpose,
    harness: f.harness, model: f.model, effort: f.effort, state, since, openedBy, waits,
    ctxPct: f.ctxPct, cacheWarm: f.cache.at === null ? null : f.cache.warm, agent: f.agent };
  if (e.naeher) {
    zeile.idleMs = f.lastOutput > 0 ? Math.max(0, e.now - f.lastOutput) : null;
    if (zeile.idleMs === null) unknown.idleMs = UNBEKANNT.idle;
    const z = e.zweig;
    zeile.branch = z && "branch" in z ? { name: z.branch, head: z.head, check: z.check } : null;
    if (!z) unknown.branch = "not read";
    else if ("unknown" in z) unknown.branch = z.unknown;
    else Object.assign(unknown, z.why);
  }
  zeile.unknown = unknown;
  return zeile;
}

/** Ein Sitz des Owners außerhalb der Linie: nur, was OWNER_SITZ_FELDER freigibt. Rein. */
export function ownerZeile(f: LageFakten): LageZeile {
  const z: LageZeile = { slot: f.slot, relation: "owner-seat", state: f.retiringAt !== null ? "handing-over" : f.sleepingAt !== null ? "asleep" : "live" };
  if (OWNER_SITZ_FELDER.includes("name")) z.name = f.name;
  if (OWNER_SITZ_FELDER.includes("purpose")) z.purpose = f.purpose;
  return z;
}

// eine Zeile der Konstellation, für die Fleet keine lebenden Tatsachen hat: beendet, oder eine Position ohne Sitz
function ohneLeben(s: SichtSitz, relation: Relation): LageZeile {
  const grund = s.state === "ended" ? UNBEKANNT.endedLive : UNBEKANNT.notStarted;
  const unknown: Record<string, string> = { openedBy: grund, waits: grund, ctxPct: grund, cacheWarm: grund };
  if (s.state === "ended") unknown.since = UNBEKANNT.endedSince;
  return { slot: s.slot, relation, name: s.name, role: s.role ? { ...s.role } : null, purpose: s.purpose, harness: s.harness, model: s.model, effort: s.effort,
    state: s.state === "live" ? "ended" : s.state, since: null, openedBy: null, waits: [], ctxPct: null, cacheWarm: null, unknown };
}

const ERSTE_RELATION: readonly Relation[] = ["opener", "child", "sibling", "position"];
const relationVon = (s: SichtSitz): Relation => ERSTE_RELATION.find((r) => s.relations.includes(r)) ?? "sibling";

/** DIE ÜBERSICHT. `sicht`: die Konstellation des Aufrufers (konstellationSicht); `alle`: die Tatsachen jedes lebenden Sitzes; `orchestratorin`:
 *  der Aufrufer ist die eine Orchestratorin (deliveryRecipient({kind:"orchestrator"}), wie rueckfrageRecht); `zweige`: der Branch je Sitz, für
 *  die Sitze, deren Öffner-Recht der Aufrufer hält (naeherFuer). Rein. */
export function lagebild(e: { ich: number; sicht: Sicht; alle: readonly LageFakten[]; orchestratorin: boolean; zweige: ReadonlyMap<number, ZweigFakt>;
  now: number; bootAt: number; gitAt?: number | null; takt: TickTakt }): Lagebild {
  const je = new Map(e.alle.map((f) => [f.slot, f]));
  const ich = je.get(e.ich);
  const seats: LageZeile[] = [];
  const gezeigt = new Set<number>([e.ich]);
  for (const s of e.sicht.seats) {
    const relation = relationVon(s);
    const f = s.slot !== null && s.state === "live" ? je.get(s.slot) : undefined;
    if (!f) { seats.push(ohneLeben(s, relation)); continue; }
    gezeigt.add(f.slot);
    seats.push(lebendeZeile(f, relation, { alle: e.alle, naeher: !!ich && naeherFuer(ich, f, e.orchestratorin), zweig: e.zweige.get(f.slot), now: e.now, takt: e.takt }));
  }
  if (e.orchestratorin)
    for (const f of [...e.alle].sort((a, b) => a.slot - b.slot)) {
      if (gezeigt.has(f.slot)) continue;
      seats.push(istOwnerSitz(f) ? ownerZeile(f)
        : lebendeZeile(f, "fleet", { alle: e.alle, naeher: true, zweig: e.zweige.get(f.slot), now: e.now, takt: e.takt }));
    }
  // die eigene Zeile: was der Sitz über seine eigenen Türen ohnehin liest, mit seinem Branch (ctl.sh status zeigt sie mit *)
  const seat = ich ? lebendeZeile(ich, "self", { alle: e.alle, naeher: true, zweig: e.zweige.get(ich.slot), now: e.now, takt: e.takt }) : null;
  const linie = "the seat that opened you, the seats you opened, their siblings, and the seats holding a position of your own saved constellation (whoever opened them)";
  return { schema: LAGEBILD_SCHEMA, at: e.now,
    me: { slot: e.ich, scope: e.orchestratorin ? "fleet" : "line",
      scopeRule: e.orchestratorin ? `you are the Orchestratorin: your line in full (${linie}), every other seat in full except the owner's own, which show as ownerSeats.shows`
        : `your line: ${linie}`, seat },
    sources: lagebildQuellen(e.bootAt, e.gitAt ?? null, e.now),
    ownerSeats: { shows: OWNER_SITZ_FELDER, decision: "server/lagebild.ts#OWNER_SITZ_FELDER (the owner's word)" },
    seats };
}

/** HÄLT DER AUFRUFER DAS RECHT DES ÖFFNERS AN DIESEM SITZ? Wie rueckfrageRecht: er ist seine Öffnerin (nach der Linie), oder er ist die
 *  Orchestratorin und der Sitz keiner des Owners. Rein. */
export function naeherFuer(ich: LageFakten, f: LageFakten, orchestratorin: boolean): boolean {
  if (f.slot === ich.slot) return false;
  if (istOeffnerin({ slot: ich.slot, cwd: ich.cwd, linie: ich.linie }, f.openedBy)) return true;
  return orchestratorin && !istOwnerSitz(f);
}
