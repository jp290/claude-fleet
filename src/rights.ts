// THE RIGHTS OF A SESSION — what it may read, said in three separate statements (owner 2026-10-02:
// „[Zitat entfernt]“; material: docs/design/datenrechte-skizze.html and
// its mapping docs/design/datenrechte-notiz.md, elements E1–E39).
//
//   1. EIGENE ARBEIT — what the session reads from its binding: a lane its order and that order's
//      wave, a bound Program-MAIN its Program, everything else nothing. No switch: it follows from
//      the work (server.ts#memoryScopeFor).
//   2. PROJEKTSICHTEN — the one thing the owner assigns: known projects × the views work and
//      observations, over GET/PATCH /api/slots/:id/memory-grant (server.ts#patchMemoryGrant).
//   3. DEINE SICHT — the repo sheet, the owner's own wide view, which is never assignable.
//
// THE SERVER'S ANSWER IS THE ONLY THING PAINTED. Nothing here ever draws a right the server did not
// return: a draft is a draft until PATCH answers {ok, grant}, and then that grant is drawn, not the
// draft. Every write names the occupant and the revision it was read against (expectedOpenedAt,
// expectedRevision); a slot that was re-occupied in between sends nothing, and an answer that was
// asked for another occupant is thrown away (the start receipt's proof.stale pattern).
//
// UNKNOWN IS NEVER "KEINE". A read that failed says "Unbekannt … nicht gemessen", a project key the
// server no longer names says "unbekanntes Projekt", and a Program list that could not be read
// leaves the session's own work "unbekannt".
//
// What the server does not carry stays named as missing, never filled in: the predecessor's scope
// at a handoff (only "gleich oder enger" is true), an owner preview of the session's answer, the
// source/version/coverage per project, and why a project is known (notiz §3).
//
// The board (src/board.ts#renderBoard) and the founding window (src/founding.ts) only hang these
// in; the block keeps its state per slot and occupant here.
import { api, el, fleet, type SlotInfo, type TaskInfo } from "./client";
import type { ProgramDigest, ProgramInfo } from "./queue";

// THE BOARD'S READS, handed in by src/board.ts (wireRights) instead of imported: the founding window
// bundles this module against its client boundary alone (e2e/slots.ts#runFoundingFocusDom), and
// src/queue.ts is no part of that boundary. The app always wires them (src/board.ts loads with the
// client); unwired — only that probe's bundle — there is no Program list and no task list.
export interface RightsBoard {
  tasks(): TaskInfo[];
  programs(): ProgramInfo[];
  programsPoll(): ProgramDigest[];
  programsRead(): "unread" | "ok" | "fail";
  loadPrograms(): Promise<void>;
  openSheet(repo: string): void;
}
let board: RightsBoard = {
  tasks: () => [], programs: () => [], programsPoll: () => [], programsRead: () => "unread",
  loadPrograms: async () => {}, openSheet: () => {},
};
export function wireRights(b: RightsBoard) { board = b; }

type GrantView = "work" | "observations";
interface Occupant { slot: number; openedAt: number }
interface Grant {
  v: 1; grantId: string; revision: number; issuedBy: "owner-principal" | "succession"; issuedAt: number;
  lineageId: string | null; occupant: Occupant; projectKeys: string[]; views: GrantView[];
  revokedAt: number | null; transferredFrom: Occupant | null;
}
interface GrantRead {
  slot: number; openedAt: number | null; grant: Grant | null; inForce: boolean;
  known: { projectKey: string; repo: string }[];
}

// the two views a grant may name (server/types.ts#MEMORY_GRANT_VIEWS), in owner words
const VIEWS: { id: GrantView; name: string; say: string }[] = [
  { id: "work", name: "Arbeitsstand", say: "Aufträge je Status, angehaltene, Programs, Lanes, letzter Check, Lands — Zahlen, keine Texte." },
  { id: "observations", name: "Beobachtung", say: "Jüngste Momentaufnahme der Lanes: wie viele leben, welche zuletzt etwas ausgaben." },
];
const viewName = (v: string): string => VIEWS.find((x) => x.id === v)?.name ?? v;

// --- reading the wire: a client type is an assertion about a foreign surface, so it is checked ----

const isOcc = (o: unknown): o is Occupant => !!o && typeof o === "object"
  && Number.isSafeInteger((o as Occupant).slot) && typeof (o as Occupant).openedAt === "number";
function asGrant(g: unknown): Grant | null | undefined {
  if (g === null) return null;
  if (!g || typeof g !== "object") return undefined;
  const x = g as Grant;
  return x.v === 1 && typeof x.grantId === "string" && Number.isSafeInteger(x.revision)
    && (x.issuedBy === "owner-principal" || x.issuedBy === "succession") && typeof x.issuedAt === "number"
    && isOcc(x.occupant) && Array.isArray(x.projectKeys) && x.projectKeys.every((k) => typeof k === "string")
    && Array.isArray(x.views) && x.views.every((v) => v === "work" || v === "observations")
    && (x.revokedAt === null || typeof x.revokedAt === "number")
    && (x.transferredFrom === null || isOcc(x.transferredFrom)) ? x : undefined;
}
function asRead(j: unknown): GrantRead | null {
  if (!j || typeof j !== "object") return null;
  const r = j as { slot?: unknown; openedAt?: unknown; grant?: unknown; inForce?: unknown; knownProjects?: unknown };
  const grant = asGrant(r.grant);
  if (grant === undefined || typeof r.inForce !== "boolean" || !Array.isArray(r.knownProjects)
    || !(r.openedAt === null || typeof r.openedAt === "number") || typeof r.slot !== "number") return null;
  const known = r.knownProjects.filter((p): p is { projectKey: string; repo: string } =>
    !!p && typeof p.projectKey === "string" && typeof p.repo === "string");
  return { slot: r.slot, openedAt: r.openedAt, grant, inForce: r.inForce, known };
}

// --- the state of one slot's occupant ------------------------------------------------------------

interface Draft {
  keys: Set<string>; views: Set<GrantView>;
  forOpenedAt: number; forRevision: number;       // the occupant and the revision this choice is for
  base: { keys: string[]; views: GrantView[] };   // what was in force when it was opened, for the delta
}
type Mount = "board" | "proof";
interface Pane {
  slot: number;
  uid: number; ver: number;                       // which state object, and how often it changed — the paint key
  forOpenedAt: number | null;                     // the occupant this state belongs to
  read: "idle" | "loading" | "ok" | "fail"; failWhy: string;
  data: GrantRead | null; readAt: number; seq: number;
  draft: Draft | null; confirm: boolean; busy: boolean;
  msg: { tone: "ok" | "bad"; text: string } | null;
  hosts: Map<Mount, HTMLElement>;
  subs: Map<Mount, () => void>;
}
const panes = new Map<number, Pane>();
// a read older than this is read again on the next paint — the board repaints every few seconds,
// the grant moves only when someone assigns, so this is a floor, not a poll
const REREAD_MS = 15_000;

const hm = (ms: number): string => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const rowOf = (slot: number): SlotInfo | undefined => fleet.find((r) => r.id === slot);
const occupantOf = (slot: number): number | null => {
  const r = rowOf(slot);
  return r?.cwd && typeof r.openedAt === "number" ? r.openedAt : null;
};
const repoName = (repo: string): string => repo.replace(/\/+$/, "").split("/").pop() || repo;
const tilde = (p: string): string => p.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");
// a project's path in ONE line under its name: home as ~, and a middle too long for the width gives
// way as … while the last segment stays — the attachment chip's cut (src/client.ts, .attstart/.attend)
// done in CSS, so the width decides. The full path stands only in the option's tooltip.
function pathLine(repo: string): HTMLElement {
  const t = tilde(repo.replace(/\/+$/, "")), cut = t.lastIndexOf("/");
  const line = el("span", "rgoptd rgmono rgpath");
  line.append(el("span", "rgpaths", cut > 0 ? t.slice(0, cut) : ""), el("span", "rgpathe", cut > 0 ? t.slice(cut) : t));
  return line;
}

let uids = 0;
function fresh(slot: number, openedAt: number | null, keep?: Pane): Pane {
  return { slot, uid: ++uids, ver: 0, forOpenedAt: openedAt, read: "idle", failWhy: "", data: null, readAt: 0, seq: (keep?.seq ?? 0) + 1,
    draft: null, confirm: false, busy: false, msg: null, hosts: keep?.hosts ?? new Map(), subs: keep?.subs ?? new Map() };
}

// the pane for the slot's CURRENT occupant. A slot that was re-occupied starts over: its old read,
// draft and answers belong to the session that left, and an open choice says that it did not go out.
function paneFor(slot: number): Pane {
  const now = occupantOf(slot);
  const p = panes.get(slot);
  if (!p) { const n = fresh(slot, now); panes.set(slot, n); return n; }
  if (p.forOpenedAt !== now) return reoccupied(p, now, false, null);
  return p;
}

function reoccupied(p: Pane, now: number | null, sent: boolean, refusal: string | null): Pane {
  const was = p.draft?.forOpenedAt ?? p.forOpenedAt;
  const hadChoice = !!p.draft || p.confirm || sent;
  const n = fresh(p.slot, now, p);
  if (hadChoice && was !== null) {
    const since = now === null ? `ist nicht mehr belegt` : `ist seit ${hm(now)} neu belegt`;
    n.msg = { tone: "bad", text: `Slot ${p.slot} ${since}. Deine Auswahl galt der Session von ${hm(was)} und `
      + (!sent ? "ging nicht raus. Zugewiesen ist nichts."
        : refusal ? "wurde abgelehnt. Zugewiesen ist nichts."
        : "kam bei ihr an — die Session, die jetzt dort sitzt, hält davon nichts.") };
  }
  panes.set(p.slot, n);
  return n;
}

function changed(p: Pane) {
  p.ver++;
  for (const f of [...p.subs.values()]) f();
}

// a re-occupation is noticed even while a choice is open and the board holds still for it (the
// focus guard in renderBoard): the sidebar is rebuilt on every poll, exactly the signal the start
// receipt watches (src/founding.ts#captureProof)
let watching = false;
function watchOccupants() {
  if (watching) return;
  const slots = document.getElementById("slots");
  if (!slots) return;
  watching = true;
  new MutationObserver(() => {
    for (const p of panes.values()) {
      // a write in flight is judged by apply/revoke once its answer is in — it did go out
      if (p.forOpenedAt === occupantOf(p.slot) || p.busy) continue;
      if (!p.draft && !p.confirm && !p.subs.size) continue;
      const n = reoccupied(p, occupantOf(p.slot), false, null);
      changed(n);
      // the session now sitting there is read at once, not on the column's next tick
      if (n.forOpenedAt !== null && !isLaneRow(rowOf(n.slot))) void readGrant(n);
    }
  }).observe(slots, { childList: true, subtree: true });
}

async function readGrant(p: Pane): Promise<void> {
  const asked = p.forOpenedAt;
  if (asked === null) return;
  const seq = ++p.seq;
  if (p.read !== "ok") p.read = "loading";
  let res: Response | null = null;
  try { res = await api(`/api/slots/${p.slot}/memory-grant`); } catch { res = null; }
  const body: unknown = res ? await res.json().catch(() => null) : null;
  // AN OLD ANSWER NEVER PAINTS INTO A RE-OCCUPIED SLOT: it is for the occupant it was asked for, and
  // only while that occupant still sits there and no newer read went out
  const cur = panes.get(p.slot);
  if (cur !== p || seq !== p.seq || occupantOf(p.slot) !== asked) return;
  const read = res?.ok ? asRead(body) : null;
  if (read && read.openedAt !== asked) return; // the server already sees someone else — the poll will follow
  if (!read) {
    p.read = "fail";
    p.failWhy = !res ? "keine Antwort" : res.ok ? "Antwort nicht lesbar" : `Antwort ${res.status}`;
  } else {
    // a re-read that says what is already on screen changes nothing on screen: a rebuilt button
    // between a press and its release is a click the browser never fires
    const same = p.read === "ok" && JSON.stringify(p.data) === JSON.stringify(read);
    p.read = "ok"; p.data = read; p.readAt = Date.now();
    if (same) return;
  }
  changed(p);
}

function ensureRead(p: Pane) {
  if (p.forOpenedAt === null || p.draft || p.busy || p.confirm || p.read === "loading") return;
  if (p.read === "ok" && Date.now() - p.readAt < REREAD_MS) return;
  if (p.read === "fail") return; // a failed read is read again by its own button, not by the timer
  void readGrant(p);
}

// --- what is painted --------------------------------------------------------------------------------

function sub(text: string, faint = false): HTMLElement { return el("span", `rgsub${faint ? " faint" : ""}`, text); }
function say(tone: "ok" | "bad" | "unk", text: string): HTMLElement { return el("div", `rgsay ${tone}`, text); }
function btn(cls: string, text: string, rk: string, on: () => void, title?: string): HTMLButtonElement {
  const b = el("button", `wordbtn rgbtn${cls ? ` ${cls}` : ""}`, text) as HTMLButtonElement;
  b.type = "button";
  b.dataset.rk = rk;
  b.onclick = on;
  if (title) b.title = title;
  return b;
}

const isLaneRow = (r: SlotInfo | undefined): boolean => !!r?.worktree;
function boundProgram(r: SlotInfo): { title: string; id: string } | null {
  const p = board.programs().find((x) => x.status === "active" && x.main && x.main.slot === r.id && x.main.openedAt === r.openedAt);
  return p ? { title: p.title, id: p.id } : null;
}
const knownName = (d: GrantRead, key: string): string | null => {
  const p = d.known.find((x) => x.projectKey === key);
  return p ? repoName(p.repo) : null;
};
const liveGrant = (d: GrantRead | null): Grant | null => d?.grant && d.grant.revokedAt === null ? d.grant : null;

// THE PROJEKTSICHTEN VALUE — the read grant and its one door. Painted into a host that belongs to
// one mount (the board, or the start receipt) so both can show the same occupant at once.
function paintGrant(p: Pane, mount: Mount): HTMLElement {
  let host = p.hosts.get(mount);
  if (!host) { host = el("div", "rggrant"); p.hosts.set(mount, host); }
  // REBUILT ONLY WHEN SOMETHING CHANGED. The board repaints its column every few seconds; a block
  // rebuilt on each of those ticks swallows the click whose press and release straddle one (the
  // browser fires no click when the pressed button is gone at the release). The key is this
  // state's identity and change count, plus the few slot facts the block reads off the poll.
  const row = rowOf(p.slot);
  const key = [p.uid, p.ver, row?.openedAt ?? "", row?.label ?? "", row?.worktree ? 1 : 0, row ? boundProgram(row)?.id ?? "" : ""].join("|");
  if (host.dataset.key === key && host.childElementCount) return host;
  host.dataset.key = key;
  // a repaint rebuilds the buttons; the one that held the focus hands it to its successor
  const had = document.activeElement instanceof HTMLElement && host.contains(document.activeElement)
    ? document.activeElement.dataset.rk ?? null : null;
  host.replaceChildren(...grantNodes(p));
  if (had) {
    const h = host;
    queueMicrotask(() => (h.querySelector(`[data-rk="${CSS.escape(had)}"]`) as HTMLElement | null)?.focus({ preventScroll: true }));
  }
  return host;
}

function grantNodes(p: Pane): HTMLElement[] {
  const out: HTMLElement[] = [];
  const row = rowOf(p.slot);
  if (p.forOpenedAt === null || !row) {
    out.push(el("span", "rgmute", "Keine Session in diesem Slot."));
    if (p.msg) out.push(say(p.msg.tone, p.msg.text));
    return out;
  }
  // E16: a lane never holds a project view — said before any click, and no door is offered
  if (isLaneRow(row)) {
    out.push(el("span", "rgmute", "Nicht für Lanes"),
      sub("Eine Lane liest nur ihren Auftrag. Projektsichten weist du einer Session zu, die keine Lane ist."));
    return out;
  }
  if (p.read === "idle" || (p.read === "loading" && !p.data)) {
    out.push(el("span", "rgmute", "wird gelesen …"));
    if (p.msg) out.push(say(p.msg.tone, p.msg.text));
    return out;
  }
  // E31: not measured is its own state — never "keine"
  if (p.read === "fail" && !p.data) {
    out.push(el("span", "rgval", "Unbekannt"),
      say("unk", `Die Rechte dieser Session sind gerade nicht lesbar (${p.failWhy}). Das heißt nicht „keine“ — es heißt: nicht gemessen.`));
    const a = el("div", "rgacts");
    a.append(btn("", "Neu lesen", "reread", () => { p.read = "loading"; changed(p); void readGrant(p); },
      "Die Rechte dieser Session noch einmal beim Server abfragen."));
    out.push(a);
    return out;
  }
  const d = p.data!;
  const g = liveGrant(d);
  const main = !!boundProgram(row);
  if (g) {
    const line = el("span", "rgval");
    g.projectKeys.forEach((k, i) => {
      if (i) line.append(el("span", "rgfaint", " · "));
      const n = knownName(d, k);
      if (n) line.append(el("span", "rgink", n));
      else { line.append(document.createTextNode("unbekanntes Projekt "), el("span", "rgmono", `${k.slice(0, 8)}…`)); }
    });
    out.push(line, sub(`${g.views.map(viewName).join(" + ")} · nur lesen`));
    const who = g.issuedBy === "succession" && g.transferredFrom
      ? `beim Handoff übernommen von der Session davor (Slot ${g.transferredFrom.slot}, geöffnet ${hm(g.transferredFrom.openedAt)})`
      : g.issuedBy === "succession" ? "beim Handoff übernommen" : `von dir, ${hm(g.issuedAt)}`;
    out.push(sub(`${who} · Fassung ${g.revision}`, true));
    // E11 is missing on the server: the grant names where it came from, not what was before it —
    // the scope-growth refusal makes "gleich oder enger" true, and nothing more is claimed
    if (g.issuedBy === "succession") {
      const n = sub("Gleich oder enger als vorher, nie weiter.");
      n.title = "Was die Session davor genau hatte, trägt der Server nicht — nur dass ein Handoff nie erweitert (intern: memory grant transferredFrom, scope-growth).";
      out.push(n);
    }
    if (!d.inForce) out.push(say("unk", "Eingetragen, aber nicht in Kraft — sie gehört nicht zu dieser Session (andere Belegung oder Linie)."));
    const gone = g.projectKeys.filter((k) => !knownName(d, k));
    if (gone.length) out.push(say("unk",
      `${gone.length === 1 ? "Ein Projekt nennt" : `${gone.length} Projekte nennt`} der Server heute nicht mehr — kein offener Auftrag, keine Lane. Die Session liest dafür „unbekannt“, nie „leer“ oder 0.`));
  } else {
    out.push(el("span", "rgmute", "Keine"),
      sub(d.grant ? `Zuletzt widerrufen um ${hm(d.grant.revokedAt!)} · Fassung ${d.grant.revision}` : "Nie zugewiesen."));
  }
  if (p.read === "fail") out.push(say("unk", `Neu lesen gescheitert (${p.failWhy}) — oben steht der letzte gelesene Stand von ${hm(p.readAt)}.`));
  // E14/E15: what happens at a handoff, per rail
  if (!p.draft) out.push(sub(main
    ? "Beim Handoff verfällt sie — die nächste MAIN liest ihr Program, keine Projektsicht."
    : "Beim Handoff geht sie an die nächste Session ihrer Linie, gleich oder enger, nie weiter. Neu belegt oder beendet: verfällt.", true));
  if (p.msg) out.push(say(p.msg.tone, p.msg.text));
  if (p.draft) { out.push(editor(p, row)); return out; }
  const a = el("div", "rgacts");
  if (p.confirm) {
    a.append(el("span", "rghint", "Widerrufen? Sie liest danach keine Projektsicht mehr."),
      btn("quiet", "Abbrechen", "revoke-cancel", () => { p.confirm = false; changed(p); }, "Nichts wird geschickt."),
      btn("danger", p.busy ? "Widerruft …" : "Widerrufen", "revoke-go", () => void revoke(p)));
    (a.lastChild as HTMLButtonElement).disabled = p.busy;
  } else {
    a.append(btn("", g ? "Ändern …" : "Zuweisen …", "open", () => openEditor(p),
      "Projekte und Sichten wählen — es wirkt erst, wenn du in der Auswahl „Zuweisen“ drückst."));
    if (g) a.append(btn("quiet danger", "Widerrufen", "revoke", () => { p.confirm = true; p.msg = null; changed(p); },
      "Diese Projektsicht zurücknehmen — du bestätigst es gleich noch einmal."));
  }
  out.push(a);
  return out;
}

function openEditor(p: Pane) {
  const d = p.data;
  if (!d || d.openedAt === null) return;
  const g = liveGrant(d);
  p.draft = { keys: new Set(g?.projectKeys ?? []), views: new Set(g?.views ?? ["work"]),
    forOpenedAt: d.openedAt, forRevision: d.grant?.revision ?? 0,
    base: g ? { keys: [...g.projectKeys], views: [...g.views] } : { keys: [], views: [] } };
  p.msg = null; p.confirm = false;
  changed(p);
}

function option(on: boolean, cls: string, rk: string, label: HTMLElement[], title: string, flip: () => void): HTMLButtonElement {
  const o = el("button", `rgopt${cls}`) as HTMLButtonElement;
  o.type = "button";
  o.dataset.rk = rk;
  o.setAttribute("role", "checkbox");
  o.setAttribute("aria-checked", String(on));
  o.title = title;
  o.append(el("span", "rgbox"), ...label);
  o.onclick = flip;
  return o;
}

function editor(p: Pane, row: SlotInfo): HTMLElement {
  const d = p.data!, dr = p.draft!;
  const ed = el("div", "rged");
  const flip = <T>(set: Set<T>, v: T) => () => { if (set.has(v)) set.delete(v); else set.add(v); p.msg = null; changed(p); };
  // E17/E18: the projects this server can name now
  const eh = el("div", "rgeh", "Projekte");
  eh.append(el("span", "rgehn", `${d.known.length} bekannt`));
  ed.append(eh);
  for (const k of d.known) {
    const on = dr.keys.has(k.projectKey), was = dr.base.keys.includes(k.projectKey);
    const label = el("span", "rgoptl");
    label.append(el("span", `rgoptn rgoptn1${on ? " on" : ""}`, repoName(k.repo)), pathLine(k.repo));
    ed.append(option(on, `${on && !was ? " add" : ""}${!on && was ? " drop" : ""}`, `p:${k.projectKey}`, [label],
      `${k.repo} (intern: projectKey ${k.projectKey})`, flip(dr.keys, k.projectKey)));
  }
  // a key of the standing grant the server no longer names stays visible — and can only be dropped
  for (const k of dr.base.keys.filter((x) => !knownName(d, x))) {
    const on = dr.keys.has(k);
    const label = el("span", "rgoptl");
    label.append(el("span", `rgoptn${on ? " on" : ""}`, "unbekanntes Projekt"), el("span", "rgoptd", `${k.slice(0, 8)}… · heute nicht bekannt — abwählen geht, neu wählen nicht`));
    ed.append(option(on, on ? "" : " drop", `p:${k}`, [label], `intern: projectKey ${k}`, flip(dr.keys, k)));
  }
  ed.append(el("div", "rghint", "Projekte sind Repos mit offenem Auftrag oder offener Lane. Ein Ordner, in dem nur eine Session läuft, ist keins."));
  const vh = el("div", "rgeh", "Was sie je Projekt lesen darf");
  ed.append(vh);
  for (const v of VIEWS) {
    const on = dr.views.has(v.id), was = dr.base.views.includes(v.id);
    const label = el("span", "rgoptl");
    label.append(el("span", `rgoptn${on ? " on" : ""}`, v.name), el("span", "rgoptd", v.say));
    ed.append(option(on, `${on && !was && dr.base.views.length ? " add" : ""}${!on && was ? " drop" : ""}`, `v:${v.id}`, [label],
      `intern: view ${v.id}`, flip(dr.views, v.id)));
  }
  ed.append(el("div", "rghint", "Gilt für jedes gewählte Projekt. Nur lesen — nicht schreiben, starten, landen."));
  // E20/E21: said as the contract, because the owner's read carries neither the source facts per
  // project nor a preview of the session's own answer (notiz §3)
  ed.append(el("div", "rghint", "Quelle: Server-Zustand, Land- und Check-Protokoll, Lane-Momentaufnahmen. Jede Antwort an die Session nennt Fassung, Abdeckung und was unbekannt blieb."),
    el("div", "rghint", "Die Antwort, die sie damit bekäme, kannst du hier noch nicht ansehen."));
  const nameOf = (k: string) => knownName(d, k) ?? `${k.slice(0, 8)}…`;
  const plus = [...[...dr.keys].filter((k) => !dr.base.keys.includes(k)).map(nameOf),
    ...[...dr.views].filter((v) => !dr.base.views.includes(v)).map(viewName)];
  const minus = [...dr.base.keys.filter((k) => !dr.keys.has(k)).map(nameOf),
    ...dr.base.views.filter((v) => !dr.views.has(v)).map(viewName)];
  if (plus.length || minus.length) {
    const dl = el("div", "rgdelta");
    for (const x of plus) dl.append(el("span", "p", `+ ${x}`));
    for (const x of minus) dl.append(el("span", "m", `− ${x}`));
    ed.append(dl);
  }
  const unknownOn = [...dr.keys].some((k) => !knownName(d, k));
  const empty = !dr.keys.size || !dr.views.size;
  const same = !plus.length && !minus.length;
  const name = row.label ?? repoName(row.cwd ?? "");
  const foot = el("div", "rgfoot");
  foot.append(el("span", "rgfor",
    empty ? (dr.base.keys.length ? "Leer zuweisen geht nicht — widerrufen heißt es dann." : "Wähle mindestens ein Projekt und eine Sicht.")
      : unknownOn ? "Ein unbekanntes Projekt kann nicht neu zugewiesen werden — wähle es ab."
      : `Für ${name} in Slot ${p.slot}, geöffnet ${hm(dr.forOpenedAt)}.`),
    btn("quiet", "Abbrechen", "cancel", () => { p.draft = null; p.msg = null; changed(p); }, "Schließt die Auswahl. Es wird nichts geschickt."));
  const go = btn("primary", p.busy ? "Wird zugewiesen …" : "Zuweisen", "apply", () => void apply(p),
    "Diese Auswahl an den Server schicken — gezeigt wird danach, was er gespeichert hat.");
  go.disabled = p.busy || empty || same || unknownOn;
  foot.append(go);
  ed.append(foot);
  return ed;
}

async function patch(slot: number, body: Record<string, unknown>): Promise<{ status: number; j: Record<string, unknown> | null }> {
  try {
    const res = await api(`/api/slots/${slot}/memory-grant`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j: unknown = await res.json().catch(() => null);
    return { status: res.status, j: j && typeof j === "object" ? j as Record<string, unknown> : null };
  } catch { return { status: 0, j: null }; }
}
const why = (r: { status: number; j: Record<string, unknown> | null }): string =>
  r.status === 0 ? "der Server antwortete nicht" : `${r.status}${typeof r.j?.error === "string" ? `: ${r.j.error}` : ""}`;

async function apply(p: Pane) {
  const dr = p.draft;
  if (!dr || p.busy) return;
  // BEFORE EVERY WRITE: does the same session still sit there? If not, nothing goes out.
  if (occupantOf(p.slot) !== dr.forOpenedAt) { changed(reoccupied(p, occupantOf(p.slot), false, null)); return; }
  p.busy = true; changed(p);
  const r = await patch(p.slot, { expectedOpenedAt: dr.forOpenedAt, expectedRevision: dr.forRevision,
    projectKeys: [...dr.keys], views: VIEWS.map((v) => v.id).filter((v) => dr.views.has(v)) });
  p.busy = false;
  if (panes.get(p.slot) !== p) return; // the observer already started this slot over
  const refusal = typeof r.j?.refusal === "string" ? r.j.refusal : null;
  if (occupantOf(p.slot) !== dr.forOpenedAt || refusal === "occupant-changed" || refusal === "not-active") {
    changed(reoccupied(p, occupantOf(p.slot), true, refusal ?? (r.status === 200 ? null : "refused")));
    return;
  }
  const grant = r.status === 200 && r.j?.ok === true ? asGrant(r.j.grant) : undefined;
  if (grant) {
    // the server's grant is what is drawn — never the draft
    p.data = { ...p.data!, grant, inForce: grant.revokedAt === null };
    p.readAt = Date.now();
    p.draft = null;
    p.msg = { tone: "ok", text: `Zugewiesen. Sie liest ab ihrer nächsten Abfrage ${grant.projectKeys.length} ${grant.projectKeys.length === 1 ? "Projekt" : "Projekte"} · Fassung ${grant.revision}.` };
  } else if (refusal === "revision-mismatch") {
    // someone else changed it in between: read the new state, keep the choice open against it
    await readGrant(p);
    if (panes.get(p.slot) !== p || !p.draft) return;
    const g = p.data?.grant ?? null;
    p.draft.forRevision = g?.revision ?? 0;
    p.draft.base = g && g.revokedAt === null ? { keys: [...g.projectKeys], views: [...g.views] } : { keys: [], views: [] };
    p.msg = { tone: "bad", text: `Nicht zugewiesen — inzwischen geändert (Fassung ${p.draft.forRevision}${g?.revokedAt ? `, widerrufen ${hm(g.revokedAt)}` : ""}). Oben der neue Stand; deine Auswahl ist noch offen.` };
  } else if (refusal === "lane-scope") {
    p.draft = null;
    p.msg = { tone: "bad", text: "Nicht zugewiesen: diese Session ist eine Lane." };
  } else if (refusal === "not-persisted") {
    p.msg = { tone: "bad", text: "Nicht zugewiesen: der Server konnte es nicht sichern. Nichts geändert — sie liest wie vorher." };
  } else if (refusal === "in-flight") {
    p.msg = { tone: "bad", text: "Nicht zugewiesen: gerade läuft eine andere Änderung oder ein Handoff dieser Session. Nichts geändert — versuch es gleich noch einmal." };
  } else if (r.status === 0) {
    p.msg = { tone: "bad", text: "Der Server antwortete nicht. Ob etwas zugewiesen wurde, ist unbekannt — gelesen wird neu." };
    void readGrant(p);
  } else {
    p.msg = { tone: "bad", text: `Nicht zugewiesen (${why(r)}).` };
  }
  changed(p);
}

async function revoke(p: Pane) {
  const g = liveGrant(p.data);
  if (!g || p.busy || p.forOpenedAt === null) return;
  if (occupantOf(p.slot) !== p.forOpenedAt) { changed(reoccupied(p, occupantOf(p.slot), false, null)); return; }
  p.busy = true; changed(p);
  const r = await patch(p.slot, { expectedOpenedAt: p.forOpenedAt, expectedRevision: g.revision, revoke: true });
  p.busy = false; p.confirm = false;
  if (panes.get(p.slot) !== p) return;
  const refusal = typeof r.j?.refusal === "string" ? r.j.refusal : null;
  if (occupantOf(p.slot) !== p.forOpenedAt || refusal === "occupant-changed" || refusal === "not-active") {
    changed(reoccupied(p, occupantOf(p.slot), true, refusal ?? (r.status === 200 ? null : "refused")));
    return;
  }
  const grant = r.status === 200 && r.j?.ok === true ? asGrant(r.j.grant) : undefined;
  if (grant) {
    p.data = { ...p.data!, grant, inForce: false };
    p.readAt = Date.now();
    p.msg = { tone: "ok", text: `Widerrufen. Sie liest keine Projektsicht mehr · Fassung ${grant.revision}.` };
  } else if (refusal === "revision-mismatch" || refusal === "nothing-to-revoke") {
    await readGrant(p);
    if (panes.get(p.slot) !== p) return;
    p.msg = { tone: "bad", text: `Nicht widerrufen — der Stand hat sich geändert (Fassung ${p.data?.grant?.revision ?? 0}). Oben steht der neue.` };
  } else if (refusal === "not-persisted") {
    p.msg = { tone: "bad", text: "Nicht widerrufen: der Server konnte es nicht sichern. Sie liest wie vorher." };
  } else {
    p.msg = { tone: "bad", text: `Nicht widerrufen (${why(r)}).` };
    if (r.status === 0) void readGrant(p);
  }
  changed(p);
}

// --- the mounts -------------------------------------------------------------------------------------

// The Projektsichten value of a slot's current occupant, for one mount. The board's mount repaints
// itself in place; another mount passes the repaint it needs (the start receipt rebuilds its table).
export function grantValue(slot: number, mount: Mount, onChange?: () => void): HTMLElement {
  watchOccupants();
  const p = paneFor(slot);
  p.subs.set(mount, onChange ?? (() => { const cur = panes.get(slot); if (cur) paintGrant(cur, mount); }));
  if (!isLaneRow(rowOf(slot))) ensureRead(p);
  return paintGrant(p, mount);
}
export function dropGrantMount(mount: Mount) {
  for (const p of panes.values()) { p.subs.delete(mount); p.hosts.delete(mount); }
}

// true while the owner is inside an open choice or a revoke question of the board's block — the
// board then holds still exactly like it does for an open note (renderBoard's textarea guard)
export function rightsHoldFocus(root: HTMLElement): boolean {
  const a = document.activeElement;
  if (!(a instanceof HTMLElement) || !root.contains(a) || !a.closest(".rggrant")) return false;
  const p = [...panes.values()].find((x) => x.hosts.get("board")?.contains(a));
  return !!p && (!!p.draft || p.confirm);
}

function kv(key: string, value: HTMLElement | string): HTMLElement {
  const r = el("div", "rgrow");
  r.append(el("span", "rgkey", key), typeof value === "string" ? el("span", "rgv", value) : value);
  return r;
}

// E2–E4: what the session reads from its binding. Unknown when the Programs could not be read —
// never "Keine" for a session that may be a MAIN.
function ownWork(row: SlotInfo): HTMLElement {
  const v = el("span", "rgv");
  const wave = board.tasks().filter((t) => t.slot === row.id && t.status === "sent" && t.id !== row.taskId);
  if (row.worktree) {
    if (row.taskId) {
      const head = el("span", "rgval");
      head.append(document.createTextNode("Ihren Auftrag "), el("span", "rgmono", row.taskId.slice(0, 8)));
      v.append(head, sub(`${row.taskTitle ? `„${row.taskTitle}“` : "Ihre Zeile"}${wave.length ? ` und ${wave.length} ${wave.length === 1 ? "weitere Zeile" : "weitere Zeilen"} ihrer Welle` : ""}: Stand, Quellen, Belege, Beobachtung.`));
    } else if (wave.length) {
      v.append(el("span", "rgval", `${wave.length} ${wave.length === 1 ? "Auftrag" : "Aufträge"} ihrer Welle`),
        sub("Stand, Quellen, Belege, Beobachtung."));
    } else {
      v.append(el("span", "rgmute", "Keinen Auftrag"), sub("Von Hand gegründet: sie liest erst etwas, wenn ein Auftrag sie startet."));
    }
  } else {
    const prog = boundProgram(row);
    if (prog) {
      const open = board.tasks().filter((t) => t.programId === prog.id && t.status !== "done" && t.status !== "archived").length;
      v.append(el("span", "rgval", `Ihr Program „${prog.title}“`),
        sub(`${open} ${open === 1 ? "offener Auftrag" : "offene Aufträge"} und ihre Lanes: Stand, Quellen, Belege, Beobachtung.`));
    } else if (board.programsRead() !== "ok" && board.programsPoll().some((x) => x.status === "active")) {
      // the 2 s poll names the active Programs but not their MAIN binding; the full rows are read
      // on demand (a no-op inside loadPrograms' own floor) and the next paint has the answer
      void board.loadPrograms();
      v.append(el("span", "rgval", "Unbekannt"),
        sub(board.programsRead() === "fail" ? "Die Programs sind gerade nicht lesbar — ob sie eines führt, ist nicht gemessen."
          : "Die Programs werden gelesen — ob sie eines führt, steht gleich hier."));
    } else {
      v.append(el("span", "rgmute", "Keine"), sub(`An keinen Auftrag, kein Program gebunden.${/\borchestrator\b/i.test(row.label ?? "") ? " Die Rolle gibt kein Leserecht." : ""}`));
    }
  }
  v.append(sub("folgt aus ihrer Arbeit · nicht zuweisbar", true));
  return v;
}

// THE BOARD'S BLOCK (E1, G6.5: after the context, before the checks): the three statements, and the
// execution contract named between 2 and 3 only so nobody takes "Rechte" for both.
export function rightsSection(row: SlotInfo): HTMLElement {
  const sec = el("div", "bsec brights");
  const h = el("h3", "", "Rechte");
  h.append(el("span", "brhint", "was sie lesen darf"));
  sec.append(h);
  sec.append(kv("Eigene Arbeit", ownWork(row)));
  const gv = el("span", "rgv");
  gv.append(grantValue(row.id, "board"));
  sec.append(kv("Projektsichten", gv));
  const ex = el("span", "rgv");
  ex.append(el("span", "rgmute", "Fleet-Standard"), sub("Befehle und Dateien — eigener Vertrag, hier nur genannt.", true));
  sec.append(kv("Ausführung", ex));
  sec.append(el("div", "rgrule"));
  // E33: the owner's own view — the repo sheet, opened where it already lives (the queue)
  const repo = row.worktree?.repo ?? row.repo ?? row.cwd ?? "";
  const mine = el("span", "rgv");
  const lk = btn("link", `Repo-Blatt ${repoName(repo)}`, "sheet", () => board.openSheet(repo),
    "Öffnet das Repo-Blatt in der Aufgabenansicht — deine eigene, breite Sicht auf dieses Repo.");
  mine.append(lk, sub("Lanes, Queue, Lands, Check, Deploy, Lane-Grenze — das siehst du, nicht die Session."));
  sec.append(kv("Deine Sicht", mine));
  return sec;
}

// --- the founding window -----------------------------------------------------------------------------

export type FoundingRightsRole = "leer" | "lane" | "orch" | "main";
// E35: the profile field's three rows, per role. The start never grants a project view
// (src/founding.ts#foundingBody carries no grant field) — the rows say so before the click.
export function foundingRights(role: FoundingRightsRole, program: string | null): HTMLElement {
  const box = el("div", "fdrights");
  const own: Record<FoundingRightsRole, string> = {
    leer: "Keine — sie ist an nichts gebunden.",
    lane: "Ihren Auftrag, sobald einer sie startet. Von Hand gegründet: keinen.",
    orch: "Keine — die Rolle bindet nichts.",
    main: program ? `Ihr Program „${program}“ und seine Aufträge.` : "Ihr Program, sobald du eines wählst.",
  };
  const proj: Record<FoundingRightsRole, string> = {
    leer: "Keine beim Start. Du weist sie danach zu, wenn du willst.",
    lane: "Nicht für Lanes.",
    orch: "Keine beim Start; die Rolle gibt keine. Du weist sie danach zu.",
    main: "Keine beim Start. Du weist sie danach zu — beim Handoff verfiele sie.",
  };
  const ex = el("span", "rgv");
  ex.append(el("span", "", "Fleet-Standard"), sub("Befehle und Dateien. Hier nicht wählbar.", true));
  const pv = el("span", "rgv");
  pv.append(el("span", "", proj[role]));
  if (role !== "lane") pv.append(sub("Zuweisen ist ein eigener Schritt im Startbeleg — oder später in der Info der Session.", true));
  box.append(kv("Ausführung", ex), kv("Eigene Arbeit", own[role]), kv("Projektsichten", pv));
  return box;
}

// E38: the start receipt's row, read FRESH after the start at the occupant the start produced. The
// requested side is always "keine": the start carries no grant field.
export function proofGrantRow(slot: number, openedAt: number, lane: boolean, onChange: () => void):
  { observed: HTMLElement; step: HTMLElement | null; warn: boolean } {
  if (lane) return { observed: el("span", "rgmute", "nicht für Lanes"), step: null, warn: false };
  const host = grantValue(slot, "proof", onChange);
  const p = panes.get(slot);
  // a pane that belongs to another occupant than the receipt's says nothing about this start
  if (!p || p.forOpenedAt !== openedAt) return { observed: el("span", "rgmute", "nicht gelesen — der Slot ist neu belegt"), step: null, warn: true };
  if (p.read !== "ok" || !p.data) {
    const observed = el("span", p.read === "fail" ? "" : "rgmute", p.read === "fail" ? "nicht lesbar" : "wird gelesen …");
    if (p.read === "fail") observed.append(el("span", "fdproofnote", `${p.failWhy} — das heißt nicht „keine“`));
    return { observed, step: p.read === "fail" ? host : null, warn: p.read === "fail" };
  }
  const g = liveGrant(p.data);
  const observed = el("span", "");
  if (g) {
    observed.append(document.createTextNode(`${g.projectKeys.map((k) => knownName(p.data!, k) ?? "unbekanntes Projekt").join(", ")} · ${g.views.map(viewName).join(" + ")}`),
      el("span", "fdproofnote", `zugewiesen ${hm(g.issuedAt)} · Fassung ${g.revision}`));
  } else {
    observed.append(document.createTextNode("keine"),
      el("span", "fdproofnote", `frisch gelesen ${hm(p.readAt)} · Fassung ${p.data.grant?.revision ?? 0}`));
  }
  return { observed, step: host, warn: false };
}
