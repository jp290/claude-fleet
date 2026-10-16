// THE CONSTELLATION WINDOW (Neuaufbau K16 E2b). Owner 15.10.: „[Zitat entfernt]“
// . The head row's
// button opens one window with every running session in the tree src/konstellation-model.ts builds.
// Nothing here writes; switching from the window is E3.
//
// TWO STEPS (owner 16.10.: „[Zitat entfernt]“
// ; „[Zitat entfernt]“):
//   · the tree shows the build only: per session one line with its name, its kind (never cut), its state and slot,
//     on the line to its parent — so 8–10 sessions read at one glance; a branch is a detail and stays off the line;
//   · under the pointer (or on keyboard focus) a small card names model, effort, context, handover and branch;
//   · a click opens the session's properties under its line, read like K15's Autonomie (owner 16.10.): Autonomie,
//     Rechte, Einstellungen, Claude Code, Aufbau, each row with who decides it; „[Zitat entfernt]“ shows it in the pane;
//   · on a touch screen there is no hover: the first tap shows the small card, the second the properties;
//   · „Detailgrad: Aufbau · Alles“ (the K15 pattern, kept by the browser): „Alles“ writes the card's values as a
//     second, quiet line under every session, so the build stays in view; the full properties only come on a click.
//
// WHERE EACH VALUE COMES FROM — the readers the board already has, so the window says what the column says:
//   · Modell, Effort: the 2 s poll (`model`, `paneModel`, `effort`) under src/running.ts's precedence; a pane on
//     screen adds what its own session file shows, as the composer does.
//   · Kontext, Linie: the poll's `ctx` and `succession`; a null `ctx` is „nicht messbar“, never 0. What happens at the
//     threshold, cache and compaction belong to the handover's own flow in the session's info card (Gesamtkonzept §4).
//   · Übergabe: the threshold in force (src/handover.ts#handoverAt) needs the session's brief,
//     which is not on the poll: GET /api/slots/:id/brief. The briefs, /api/branches and /api/programs are read once
//     per opening (and a session that starts while the window is open once more); the last answer stays until the new one.
//   · Rechte: what the session reads from its binding, in src/rights.ts's words, and its execution: „Fleet-Standard“
//     as the rights block says it, a Codex slot its sandbox. The permission mode is what Claude Code last wrote into
//     the transcript (`permissionMode` on the poll), in words; absent it is „nicht gemeldet“.
//   · Autonomie and Claude Code: the plan of her role (GET /api/founding-plan, as K15's window reads it), see planOf.
//   · Maschine: the instance's name on the poll; other Fleets only as FLEET_INSTANCES links them. Isolation: none, gray.
import { api, el, fleet, instanceLinks, instanceName, panes, serverNow, showSlot, slotState, STATE_WORD, type SlotInfo } from "./client";
import { constellation, type KGroupKey, type KNode } from "./konstellation-model";
import { handoverAt } from "./handover";
import { loadPrograms, programsList, programsRead } from "./queue";
import { modelLabel } from "./modelname";
import { runningEffort, runningModel } from "./running";
import { openShell, type Shell } from "./shell";
import type { BriefSuccession } from "./board";
import type { BranchesView } from "./protocol";
import { DU, WER_WORT, werBeiClaudeCode, type Wer } from "./k15-wer";
import { autonomieAus, leseFassung, type AutoArt, type Autonomie } from "./k15-entwurf-modell";

let shell: Shell | null = null;
let painted = "";
// which opening of the window a read belongs to: a read of an earlier opening is shown until this one answers
let opening = 0;
let branches: BranchesView | null = null;
let branchesOpening = 0;
type BriefRead = { openedAt: number | undefined; opening: number; state: "loading" | "ok" | "fail"; sc: BriefSuccession | null };
const briefs = new Map<number, BriefRead>();

type Detail = "aufbau" | "alles";
const DETAIL_KEY = "fleet.konstellation.detail";
let detail: Detail = "aufbau";
// the sessions whose properties a click opened, by occupation
const flipped = new Set<string>();
// the tags whose reason a tap wrote under their row, by occupation and row
const why = new Set<string>();
// the occupation whose small card stands, and whether a touch put it there (a second tap opens the properties)
let peek: { key: string; touch: boolean } | null = null;

const GROUP_WORD: Record<KGroupKey, string> = {
  orchester: "Orchester", lanes: "Lanes ohne Zuordnung", branches: "Branches", sessions: "Sessions",
};
const KIND_WORD: Record<KNode["kind"], string> = {
  orchestrator: "Orchestratorin", "program-main": "Program-MAIN", lane: "Lane", bau: "Bau-Session", session: "Session",
};

const keyOf = (s: SlotInfo) => `${s.id}:${s.openedAt ?? ""}`;
const isOpen = (s: SlotInfo) => flipped.has(keyOf(s));

export function openKonstellation(): void {
  shell?.close();
  shell = openShell({ id: "konstellation", title: "Konstellation",
    onClose: () => { shell = null; painted = ""; peek = null; flipped.clear(); why.clear(); } });
  shell.root.classList.add("solo");
  try { detail = localStorage.getItem(DETAIL_KEY) === "alles" ? "alles" : "aufbau"; } catch { detail = "aufbau"; }
  // a tap beside the lines takes the small card away
  shell.detail.addEventListener("click", (e) => {
    if (peek && !(e.target instanceof Element && e.target.closest(".krow, .kpeek"))) { peek = null; placePeek(); }
  });
  opening += 1;
  void loadPrograms(true);
  paint();
}

// the poll's hook: a no-op while the window is closed
export function renderKonstellation(): void {
  if (shell?.isOpen()) paint();
}

function setDetail(d: Detail): void {
  detail = d;
  flipped.clear();
  why.clear();
  peek = null;
  try { localStorage.setItem(DETAIL_KEY, d); } catch { /* without storage the choice lasts until the window closes */ }
  paint();
}

function paint(): void {
  if (!shell) return;
  readBranches();
  const tree = constellation(fleet, branches, programsList);
  for (const s of fleet) if (s.cwd) readBrief(s);
  shell.setSubtitle(tree.count === 1 ? "1 Session läuft" : `${tree.count} Sessions laufen`);
  const box = el("div", "kbaum");
  box.dataset.detail = detail;
  if (!tree.count) box.appendChild(el("div", "shellhint", "Gerade läuft keine Session."));
  else box.appendChild(detailBar());
  for (const g of tree.groups) {
    const sec = el("section", "kgrp");
    sec.dataset.group = g.key;
    sec.append(el("h3", "kgrph", GROUP_WORD[g.key]), ...g.nodes.map((n) => nodeEl(n, null)));
    box.appendChild(sec);
  }
  // the poll repaints every 2 s: an unchanged tree keeps its DOM, so a hover or a focus is not lost
  const key = [...box.querySelectorAll<HTMLElement>(".kgrp, .kn, .kprops")].map((e) => e.dataset.group ?? e.dataset.slot ?? "p").join(",")
    + "\n" + detail + "\n" + box.textContent;
  if (key !== painted) {
    painted = key;
    const active = document.activeElement instanceof HTMLElement && shell.detail.contains(document.activeElement) ? document.activeElement : null;
    const focus = active?.closest<HTMLElement>(".kn")?.dataset.key ?? null, tag = active?.dataset.why ?? null;
    const scroll = shell.detail.scrollTop;
    shell.detail.replaceChildren(box);
    shell.detail.scrollTop = scroll;
    // a tapped tag keeps the focus it had, a line its own
    const back = tag ? [...box.querySelectorAll<HTMLElement>(".kwer")].find((t) => t.dataset.why === tag)
      : focus ? box.querySelector<HTMLElement>(`.kn[data-key="${focus}"] > .kline > .krow`) : null;
    back?.focus({ preventScroll: true });
  }
  placePeek();
}

// DER DETAILGRAD: Aufbau (one line per session) or Alles (every session's properties open)
function detailBar(): HTMLElement {
  const bar = el("div", "kdetail");
  const seg = el("div", "kseg");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Detailgrad");
  for (const [id, word] of [["aufbau", "Aufbau"], ["alles", "Alles"]] as const) {
    const b = el("button", detail === id ? "on" : "", word) as HTMLButtonElement;
    b.type = "button";
    b.dataset.detail = id;
    b.setAttribute("aria-pressed", String(detail === id));
    b.onclick = () => { if (detail !== id) setDetail(id); };
    seg.append(b);
  }
  bar.append(el("span", "kdk", "Detailgrad"), seg);
  return bar;
}

function nodeEl(n: KNode, parent: KNode | null): HTMLElement {
  const s = n.slot;
  const wrap = el("div", "kn");
  wrap.dataset.slot = String(s.id);
  wrap.dataset.kind = n.kind;
  wrap.dataset.key = keyOf(s);
  const line = el("div", "kline");
  const row = el("button", "krow") as HTMLButtonElement;
  row.type = "button";
  const open = isOpen(s);
  row.setAttribute("aria-expanded", String(open));
  const state = slotState(s, serverNow, panes.some((p) => p.slot === s.id));
  const act = el("span", `act ${state}`);
  act.title = STATE_WORD[state];
  const name = nameOf(n), role = KIND_WORD[n.kind];
  // a name that already says the role („Orchestratorin“) does not say it twice
  // the state sign stands at the right edge, as in the left bar: at the left a flat „schläft“ would read as a branch of the tree
  row.append(el("span", "kname", name), ...(role === name ? [] : [el("span", "krole", role)]), act, el("span", "kslot", `Slot ${s.id}`));
  row.setAttribute("aria-label", `${name}${role === name ? "" : `, ${role}`}, Slot ${s.id}, ${STATE_WORD[state]}`);
  // with „Alles“ the card's values already stand under the line: no card
  row.onpointerenter = (e) => { if (e.pointerType === "mouse" && !isOpen(s) && detail === "aufbau") showPeek(s, false); };
  row.onpointerleave = (e) => { if (e.pointerType === "mouse" && peek?.key === keyOf(s) && !peek.touch) hidePeek(); };
  row.onfocus = () => { if (row.matches(":focus-visible") && !isOpen(s) && detail === "aufbau") showPeek(s, false); };
  row.onblur = () => { if (peek?.key === keyOf(s) && !peek.touch) hidePeek(); };
  row.onclick = (e) => {
    // without hover the first tap is the small card, the second the properties
    const touch = (e as PointerEvent).pointerType === "touch" || (e as PointerEvent).pointerType === "pen";
    if (touch && !isOpen(s) && detail === "aufbau" && peek?.key !== keyOf(s)) { showPeek(s, true); return; }
    if (flipped.has(keyOf(s))) flipped.delete(keyOf(s)); else flipped.add(keyOf(s));
    peek = null;
    paint();
  };
  line.appendChild(row);
  if (detail === "alles") line.appendChild(werteEl(n));
  wrap.appendChild(line);
  if (open) wrap.appendChild(propsEl(n, parent));
  if (n.children.length) {
    const kids = el("div", "kkids");
    kids.append(...n.children.map((c) => nodeEl(c, n)));
    wrap.appendChild(kids);
  }
  return wrap;
}

// THE SMALL CARD: the four values one looks for first, beside the line it belongs to
function showPeek(s: SlotInfo, touch: boolean): void {
  peek = { key: keyOf(s), touch };
  placePeek();
}
function hidePeek(): void {
  peek = null;
  placePeek();
}
function placePeek(): void {
  if (!shell) return;
  shell.detail.querySelectorAll(".kpeek").forEach((p) => p.remove());
  if (!peek) return;
  const s = fleet.find((x) => x.cwd && keyOf(x) === peek!.key);
  const line = shell.detail.querySelector<HTMLElement>(`.kn[data-key="${peek.key}"] > .kline`);
  if (!s || !line) { peek = null; return; }
  const card = el("div", "kpeek");
  card.setAttribute("role", "tooltip");
  const n = nodeOf(s);
  card.append(...(n ? cardValues(n) : []), el("span", "kpeekh", peek.touch ? "Noch einmal tippen: alle Eigenschaften" : "Klick: alle Eigenschaften"));
  line.appendChild(card);
  // the card opens below its line, above it where the window ends first
  const room = shell.detail.getBoundingClientRect().bottom - line.getBoundingClientRect().bottom;
  card.classList.toggle("up", room < card.offsetHeight + 8 && line.getBoundingClientRect().top - shell.detail.getBoundingClientRect().top > room);
}

// THE CARD'S VALUES: the four one looks for first, and the branch the line leaves out
function cardValues(n: KNode): HTMLElement[] {
  const s = n.slot;
  const branch = s.worktree?.branch ?? n.branch?.branch ?? s.git?.branch;
  return [val("modell", "Modell", modelOf(s)), val("effort", "Effort", effortOf(s)), val("kontext", "Kontext", contextOf(s)),
    val("uebergabe", "Succession", handoverOf(s)), ...(branch ? [val("branch", "Branch", branch)] : [])];
}
// „Alles“: the same values as one quiet line under the session's line
function werteEl(n: KNode): HTMLElement {
  const w = el("div", "kwerte");
  w.append(...cardValues(n));
  return w;
}
function nodeOf(s: SlotInfo): KNode | null {
  const find = (ns: KNode[]): KNode | null => {
    for (const n of ns) { if (n.slot === s) return n; const c = find(n.children); if (c) return c; }
    return null;
  };
  return find(constellation(fleet, branches, programsList).groups.flatMap((g) => g.nodes));
}

// THE PROPERTIES of one session, read like K15's Autonomie (owner 16.10.: „[Zitat entfernt]“
// ): what she decides
// herself (her role card's three lists, src/k15-entwurf-modell.ts#autonomieAus), her rights, her settings, what Claude Code
// brings (k15-wer.ts#werBeiClaudeCode) and where she hangs. Every row says who decides it in K15's words: „änderbar“,
// „Fleet-Standard“, „Claude-Code-Standard“; a standard says whether and where it can be set today under the pointer and, on a tap, under its row.
// A section whose rows all share one reason carries the tag once, at its title.
function propsEl(n: KNode, parent: KNode | null): HTMLElement {
  const s = n.slot;
  const box = el("div", "kprops");
  box.dataset.slot = String(s.id);
  const claude = !s.harness || s.harness === "claude";
  const plan = planOf(s, n.kind);
  const repo = s.repo ?? s.worktree?.repo ?? null;
  box.append(
    autonomieEl(n, plan, startCardOf(s)),
    section(s, "rechte", "Rechte", null, [
      row(s, "befehle", "Befehle", commandsOf(s), s.permissions ? CODEX_WER : BEFEHLE_WER),
      ...(claude ? [row(s, "modus", "Permission-Mode", modeOf(s), MODE_WER)] : []),
    ]),
    section(s, "einstellungen", "Einstellungen", null, [
      row(s, "agent", "Agent", claude ? "Claude Code" : s.harness!, AGENT_WER),
      row(s, "modell", "Modell", modelOf(s), DU),
      row(s, "effort", "Effort", effortOf(s), DU),
      row(s, "uebergabe", "Succession", handoverOf(s), DU),
      row(s, "maschine", "Maschine", instanceName ?? "diese", MASCHINE_WER, otherMachines()),
      row(s, "isolation", "Isolation", "keine", ISOLATION_WER, [el("span", "kmehr", "Sandbox/VM möglich, nicht aktiv")]),
    ]),
    ...(claude ? [claudeCodeEl(n, plan)] : []),
    section(s, "aufbau", "Aufbau", AUFBAU_WER, [
      row(s, "art", "Art", KIND_WORD[n.kind], null),
      row(s, "haengt", "Hängt an", parentOf(n, parent), null),
      ...(n.program || s.programId || n.kind === "program-main" ? [row(s, "program", "Program", programOf(n), null)] : []),
      ...(s.taskTitle || s.taskId ? [row(s, "auftrag", "Auftrag", s.taskTitle ? `„${s.taskTitle}“` : s.taskId!.slice(0, 8), null)] : []),
      row(s, "branch", "Branch", s.worktree?.branch ?? s.git?.branch ?? n.branch?.branch ?? "nicht gemeldet", null),
      row(s, "ordner", "Ordner", `${folder(s.cwd ?? "")}${s.worktree ? " · eigener Worktree" : s.workplace?.mainCheckout ? " · Haupt-Checkout" : ""}`,
        null, [], [place(s.cwd ?? ""), repo && repo !== s.cwd ? `Repo ${place(repo)}` : ""].filter(Boolean).join("\n")),
    ]),
  );
  const go = el("button", "kgo", "Session zeigen") as HTMLButtonElement;
  go.type = "button";
  go.onclick = () => { if (showSlot(s.id)) shell?.close(); };
  box.appendChild(go);
  return box;
}

// WHO DECIDES, per row. A standard says first whether and where it can be set today („noch nicht einstellbar“, not „steht fest“), then
// why, and where it follows from; „änderbar“ says where.
const fest = (grund: string, herleitung: string): Wer => ({ art: "fleet", grund, herleitung });
const DU_WO = "Einstellen in der Info-Karte dieser Session: „Session zeigen“.";
const BEFEHLE_WER = fest("Noch nicht einstellbar: Befehle und Dateien laufen nach Fleets Vertrag.", "src/rights.ts, Ausführung „Fleet-Standard“");
const CODEX_WER = fest("Noch nicht einstellbar: Sandbox und Freigabe setzt Fleet beim Start der Codex-Session.", "Slot-Einstellung permissions");
const MODE_WER = fest("Noch nicht je Session einstellbar: Fleet startet jede Claude-Session im Auto Mode.", "server/session-start.ts#PERMISSION_MODE (Owner 16.10.)");
const AGENT_WER = fest("Einstellbar beim Öffnen einer neuen Session; diese behält ihren Agenten.", "beim Öffnen gewählt");
const MASCHINE_WER = fest("Noch nicht einstellbar: Heute läuft jede Session auf der Maschine ihrer Fleet.",
  "/api/sessions → instance.name; FLEET_INSTANCES sind Links, keine Verbindung (server.ts)");
const ISOLATION_WER = fest("Noch nicht einstellbar: Container und VM schneiden den Rückweg zu Fleet ab; Claude Codes Sandbox ginge, ist aber nicht eingeschaltet.",
  "docs/neuaufbau/befunde/19-isolation.md");
const AUFBAU_WER = fest("Einstellbar beim Öffnen einer neuen Session; diese behält Rolle, Ordner und Branch.", "Rolle, Ordner und Branch kommen vom Öffnen");
const OHNE_KARTE_WER = fest("Noch nicht einstellbar: Eine freie Session bekommt keine Rollenkarte, nur Lane, MAIN und Orchestratorin.", "server.ts#plannedFileRows");
const karteWer = (n: KNode, quelle: string): Wer => fest(`Noch nicht einstellbar: Fleet gibt jeder ${KIND_WORD[n.kind]} diese Rollenkarte mit; eine eigene Fassung aus „Neue Session“ geht beim Start noch nicht mit.`,
  `${quelle} (Gründungsplan, Teil „role“)`);
const START_WER = (quelle: string): Wer => fest("Noch nicht einstellbar: Diese Rollenkarte hat Fleet ihr beim Start in die Session-Datei geschrieben; eine andere gälte erst für eine neue Session.", quelle);

// a section: its title, and the one tag when all its rows share it
function section(s: SlotInfo, key: string, title: string, wer: Wer | null, rows: HTMLElement[], note?: HTMLElement): HTMLElement {
  const x = el("section", "kps");
  x.dataset.sec = key;
  const head = el("div", "kpsk");
  head.append(el("h4", "kpsh", title), ...(wer ? [werTag(s, `sec:${key}`, wer)] : []), ...(note ? [note] : []));
  x.append(head, ...(wer && why.has(`${keyOf(s)}:sec:${key}`) ? [el("div", "kgrund", grundOf(wer))] : []), ...rows);
  return x;
}
// one row: word, value, who decides; `more` stands quiet under the value (what could be, links)
function row(s: SlotInfo, key: string, word: string, text: string, wer: Wer | null, more: HTMLElement[] = [], hover?: string): HTMLElement {
  const v = el("div", "kv");
  v.dataset.k = key;
  if (hover) v.title = hover;
  v.append(el("span", "kk", word), el("span", "kx", text));
  if (wer) v.append(werTag(s, key, wer));
  if (more.length) { const m = el("span", "kmore"); m.append(...more); v.append(m); }
  if (wer && why.has(`${keyOf(s)}:${key}`)) v.append(el("span", "kgrund", grundOf(wer)));
  return v;
}
// K15's tag (src/k15-teile.ts#werTag) with its words and classes: k15-teile.ts brings the K15 window's state along, so the
// board draws its own. A tap (or a click) writes the reason under the row, for a screen without a pointer.
function werTag(s: SlotInfo, key: string, w: Wer): HTMLButtonElement {
  const t = el("button", `kwer ${w.art}`, WER_WORT[w.art]) as HTMLButtonElement;
  t.type = "button";
  const id = `${keyOf(s)}:${key}`;
  t.dataset.why = id;
  t.title = w.art === "du" ? DU_WO : `${w.grund}\n${w.herleitung}`;
  t.setAttribute("aria-expanded", String(why.has(id)));
  t.onclick = () => { if (why.has(id)) why.delete(id); else why.add(id); paint(); };
  return t;
}
const grundOf = (w: Wer): string => w.art === "du" ? DU_WO : w.grund;

// other Fleets FLEET_INSTANCES names, as the head row's switcher links them: nothing appended to the url
function otherMachines(): HTMLElement[] {
  const others = instanceLinks.filter((l) => { try { return new URL(l.url).origin !== location.origin; } catch { return false; } });
  const out: HTMLElement[] = [el("span", "kmehr", "andere Maschinen möglich, nicht verbunden")];
  for (const l of others) {
    const a = document.createElement("a");
    a.className = "klink";
    a.href = l.url;
    a.textContent = l.name;
    a.title = `Die Fleet „${l.name}“ öffnen; ihre Sessions laufen dort, nicht hier.`;
    out.push(a);
  }
  return out;
}

// DIE AUTONOMIE: the role card's three lists, as K15 shows them (src/k15-autonomie.ts), read only — a running session has
// the card Fleet gave her at the start
const AUTO_ART: readonly { art: AutoArt; wort: string }[] = [{ art: "selbst", wort: "Entscheidet selbst" }, { art: "fragt", wort: "Fragt zuerst" }, { art: "nie", wort: "Nie" }];
// wen sie fragt, aus DEIN EMPFAENGER der Karte, im Akkusativ (as k15-autonomie.ts#wenAkk)
const wenAkk = (wen: string): string => wen.replace(/^der /, "den ").replace(/^deine /, "ihre ");
function autonomieEl(n: KNode, plan: PlanRead | null, start: StartRead | null): HTMLElement {
  const s = n.slot;
  if (!PLAN_ROLE[n.kind])
    return section(s, "autonomie", "Autonomie", OHNE_KARTE_WER, [el("div", "kleer", "Keine Rollenkarte · sie arbeitet nach der AGENTS.md ihres Ordners")]);
  if (start?.state === "loading") return section(s, "autonomie", "Autonomie", null, [el("div", "kleer", "wird gelesen")]);
  const fromStart = start?.state === "ok" ? start.au : null;
  if (!fromStart && (!plan || plan.state !== "ok"))
    return section(s, "autonomie", "Autonomie", null, [el("div", "kleer", plan?.state === "loading" ? "wird gelesen" : "nicht lesbar")]);
  const au = fromStart ?? plan!.au;
  if (!au) return section(s, "autonomie", "Autonomie", null, [el("div", "kleer", "Die Rollenkarte nennt keine Autonomie.")]);
  // which card this is: hers from the start, or today's where hers is not readable — and whether today's differs from hers
  const today = plan?.state === "ok" ? plan.au : null;
  const note = !fromStart ? el("span", "kmehr kfass", "Fassung von heute")
    : today && today.karte !== fromStart.karte ? el("span", "kmehr kfass", "heute gibt Fleet eine andere") : undefined;
  if (note) note.title = !fromStart
    ? (n.kind === "lane" ? "Ihre Session-Datei trägt keine Rolle. Gezeigt ist die Rollenkarte, die Fleet einer Lane heute mitgibt."
      : "Sie bekam die Rollenkarte im Start-Prompt, und den zeigt keine Route. Gezeigt ist die Karte, die Fleet heute mitgibt.")
    : "Fleet gibt einer neuen Lane heute eine andere Fassung dieser Karte. Für diese Session gilt die gezeigte.";
  return section(s, "autonomie", "Autonomie", fromStart ? START_WER(au.quelle) : karteWer(n, au.quelle), AUTO_ART.map(({ art, wort }) => {
    const punkte = au.punkte.filter((p) => p.art === art);
    const g = el("div", `kag ${art}`);
    g.dataset.art = art;
    const h = el("div", "kagh");
    const satz = art === "selbst" ? "ohne Rückfrage" : art === "fragt" ? (au.wen ? `fragt ${wenAkk(au.wen)}` : "") : "gilt für jede Rolle gleich";
    h.append(el("span", "kagn", wort), el("span", "kagz", String(punkte.length)), ...(satz ? [el("span", "kags", satz)] : []));
    const ul = el("ul", "kagl");
    for (const p of punkte) {
      const li = el("li", "kagp", leseFassung(p.text));
      if (leseFassung(p.text) !== p.text) li.title = `Wortlaut der Karte: ${p.text}`;
      ul.append(li);
    }
    g.append(h, ul);
    return g;
  }), note);
}

// WAS CLAUDE CODE MITBRINGT, from the plan of the same role (claudeCode.zeilen): the system prompt Claude Code writes itself,
// what Fleet's start line sets (tools, lists, MCP). The tools are the ones her last spawn put on her line where the server
// recorded it (`spawn` on the poll): a MAIN bound at her spawn gets the MAIN's list, one founded in the window starts
// without one (server.ts#ensureSlot). Without that record a MAIN's tools are not known.
const CC_WERT: Readonly<Record<string, string>> = { systemprompt: "eingebaut" };
function claudeCodeEl(n: KNode, plan: PlanRead | null): HTMLElement {
  const s = n.slot;
  if (!plan || plan.state !== "ok") return section(s, "claude-code", "Claude Code", null, [el("div", "kleer", plan?.state === "loading" ? "wird gelesen" : "nicht lesbar")]);
  if (!plan.zeilen?.length) return section(s, "claude-code", "Claude Code", null, [el("div", "kleer", "nicht gemeldet")]);
  return section(s, "claude-code", "Claude Code", null, plan.zeilen.map((z) => {
    if (z.id !== "werkzeuge") return row(s, `cc-${z.id}`, z.wort, CC_WERT[z.id] ?? z.wert, werBeiClaudeCode(z), [], z.satz);
    if (s.spawn) {
      const tools = s.spawn.tools;
      return row(s, "cc-werkzeuge", z.wort, tools === null ? "alle eingebauten" : `${tools} Werkzeuge`,
        werBeiClaudeCode({ weg: tools === null ? "kein --tools" : "--tools", satz: z.satz, quelle: "server.ts#SESSION_TOOLS, ihr letzter Start" }), [], z.satz);
    }
    if (n.kind === "program-main") return row(s, "cc-werkzeuge", z.wort, "je nach Start",
      fest("Noch nicht je Session einstellbar: Fleet hat ihren letzten Start nicht festgehalten; gegründet startet sie mit allen eingebauten, gebunden mit der Liste der MAIN.",
        "server.ts#ensureSlot, spawn"), [], z.satz);
    return row(s, "cc-werkzeuge", z.wort, z.wert, werBeiClaudeCode(z), [], z.satz);
  }));
}

function programOf(n: KNode): string {
  const s = n.slot;
  if (n.program) return `„${n.program.title}“${n.kind === "program-main" ? ", sie führt es" : ""}`;
  if (s.programId) return programsRead === "fail" ? "nicht lesbar" : `${s.programId.slice(0, 8)}, keine laufende MAIN`;
  return programsRead === "ok" ? "keins, das läuft" : programsRead === "fail" ? "nicht lesbar" : "wird gelesen";
}

function val(key: string, word: string, text: string): HTMLElement {
  const v = el("span", "kv");
  v.dataset.k = key;
  v.append(el("span", "kk", word), el("span", "kx", text));
  return v;
}

const folder = (p: string) => p.replace(/\/+$/, "").split("/").pop() || p;
// the full path for the hover: the home as ~, and macOS's /private/tmp as the /tmp it also is
const place = (p: string) => p.replace(/^\/Users\/[^/]+(?=\/|$)/, "~").replace(/^\/private\/tmp(?=\/|$)/, "/tmp");
const NB = "\u00a0";

function nameOf(n: KNode): string {
  return n.slot.label?.trim() || n.branch?.name || n.slot.taskTitle || folder(n.slot.cwd ?? "");
}

// the line the tree draws, in words; a branch session's opener is not on the wire (BranchView has no `opener`)
function parentOf(n: KNode, parent: KNode | null): string {
  if (parent) return `${nameOf(parent)} · Slot ${parent.slot.id}`;
  if (n.kind === "orchestrator") return "keiner, sie führt";
  if (n.kind === "bau") return "nicht gemeldet";
  return "keiner";
}

function modelOf(s: SlotInfo): string {
  const pane = panes.find((p) => p.slot === s.id);
  const id = runningModel(s.model, pane?.observedModel, s.paneModel);
  const name = id ? modelLabel(id) : "Standard des Agenten";
  return s.harness && s.harness !== "claude" ? `${s.harness} · ${name}` : name;
}

function effortOf(s: SlotInfo): string {
  const pane = panes.find((p) => p.slot === s.id);
  return runningEffort(s.effort, pane?.observedEffort) || "Standard";
}

function contextOf(s: SlotInfo): string {
  if (s.ctx === undefined) return "nicht gemeldet";
  if (s.ctx === null) return "nicht messbar";
  // a fresh session is not an empty one: 0.2 % reads „< 1 %“, never „0 %“
  // a number and its % never part at a line's end (NB)
  return s.ctx.pct > 0 && s.ctx.pct < 0.5 ? `< 1${NB}%` : `${Math.round(s.ctx.pct)}${NB}%`;
}

function briefOf(s: SlotInfo): BriefRead | "loading" {
  const b = briefs.get(s.id);
  return !b || b.openedAt !== s.openedAt || b.state === "loading" ? "loading" : b;
}

function handoverOf(s: SlotInfo): string {
  const line = s.succession && s.succession.session > 1 ? ` · ${s.succession.session}. Session der Linie` : "";
  const b = briefOf(s);
  if (b === "loading") return `wird gelesen${line}`;
  if (b.state === "fail") return `nicht lesbar${line}`;
  if (!b.sc) return `nicht gemeldet${line}`;
  const at = handoverAt(b.sc);
  if (!at) return `aus${line}`;
  // the cap waits while the cache is warm; into a cold cache Fleet types nothing and acts only at the cap (Runde C)
  const cold = at.cache === "kalt" ? `, der Cache ist kalt: Fleet tippt nichts${at.cap !== null ? ` und handelt erst bei ${at.cap}${NB}%` : ""}` : "";
  return `ab ${at.pct}${NB}%${cold || (at.cap !== null ? `, solange der Cache warm ist bis ${at.cap}${NB}%` : "")}${line}`;
}

// Claude Code's permission modes in words (Bauleitung 16.10.); a mode this list does not know is shown as it is
const MODE_WORD: Record<string, string> = {
  auto: "Auto Mode, ein Prüfmodell sieht Shell- und Netzaktionen", bypassPermissions: "ohne Prüfung (bypass)",
  default: "fragt vor jeder Aktion", acceptEdits: "Dateiänderungen ohne Rückfrage", plan: "Planmodus, ändert nichts",
  dontAsk: "nur Erlaubtes, fragt nie",
};
function modeOf(s: SlotInfo): string {
  return s.permissionMode ? MODE_WORD[s.permissionMode] ?? s.permissionMode : "nicht gemeldet";
}

function commandsOf(s: SlotInfo): string {
  const p = s.permissions;
  return !p ? "Fleet-Standard" : "state" in p ? "Einstellung ungültig" : `${p.sandbox}, ${p.approval}`;
}

function readBranches(): void {
  if (branchesOpening === opening) return;
  branchesOpening = opening;
  void api("/api/branches").then(async (r) => { if (r.ok) branches = (await r.json()) as BranchesView; })
    .catch(() => undefined)
    .finally(renderKonstellation);
}

function readBrief(s: SlotInfo): void {
  const old = briefs.get(s.id);
  if (old && old.openedAt === s.openedAt && old.opening === opening) return;
  // a read of an earlier opening stays on the card until this one answers
  const openedAt = s.openedAt, mine = opening;
  briefs.set(s.id, old && old.openedAt === openedAt ? { ...old, opening: mine } : { openedAt, opening: mine, state: "loading", sc: null });
  void api(`/api/slots/${s.id}/brief`).then(async (r) => {
    // a plain folder answers 400 with the non-git half, its succession included (board.ts#BriefNoGit)
    const j = (await r.json().catch(() => null)) as { succession?: BriefSuccession } | null;
    const raw = j?.succession;
    const sc = raw ? { ...raw, pctFrom: raw.pctFrom ?? "fleet", nudgeOn: raw.nudgeOn ?? true, defaultPct: raw.defaultPct ?? raw.thresholdPct ?? 0 } : null;
    briefs.set(s.id, { openedAt, opening: mine, state: sc || r.ok || (r.status === 400 && j) ? "ok" : "fail", sc });
  }).catch(() => {
    briefs.set(s.id, { openedAt, opening: mine, state: "fail", sc: null });
  }).finally(renderKonstellation);
}

// THE ROLE'S PLAN (GET /api/founding-plan, the one K15's window reads): the role card her role gets and what Claude Code brings
// to its start. Read once per role and repo per opening, only for a session whose properties are open; only the two parts this
// window shows are taken from the answer. A free session (no lane, no MAIN, no Orchestratorin) starts like „Nur Ordner“.
type CcRow = { id: string; wort: string; satz: string; quelle: string; weg: string; wert: string };
type PlanRead = { opening: number; state: "loading" | "ok" | "fail"; au: Autonomie | null; zeilen: CcRow[] | null };
const plans = new Map<string, PlanRead>();
const PLAN_ROLE: Partial<Record<KNode["kind"], string>> = { orchestrator: "orchestratorin", "program-main": "main", lane: "lane" };
function planOf(s: SlotInfo, kind: KNode["kind"]): PlanRead | null {
  const repo = s.worktree?.repo ?? s.repo ?? s.cwd;
  if (!repo) return null;
  const q = new URLSearchParams({ repo, role: PLAN_ROLE[kind] ?? "nur-ordner" });
  if (s.harness) q.set("harness", s.harness);
  const url = `/api/founding-plan?${q}`;
  const old = plans.get(url);
  if (old && old.opening === opening) return old;
  const mine = opening;
  // a read of an earlier opening stays until this one answers
  plans.set(url, old ? { ...old, opening: mine } : { opening: mine, state: "loading", au: null, zeilen: null });
  void api(url).then(async (r) => {
    const j: unknown = await r.json().catch(() => null);
    plans.set(url, r.ok ? { opening: mine, state: "ok", ...planParts(j) } : { opening: mine, state: "fail", au: null, zeilen: null });
  }).catch(() => {
    plans.set(url, { opening: mine, state: "fail", au: null, zeilen: null });
  }).finally(renderKonstellation);
  return plans.get(url)!;
}
const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
function planParts(j: unknown): { au: Autonomie | null; zeilen: CcRow[] | null } {
  const r = rec(j);
  const parts = rec(r?.sessionAgents)?.parts;
  const role = Array.isArray(parts) ? parts.map(rec).find((p) => p?.id === "role") : undefined;
  const au = role && typeof role.content === "string"
    ? autonomieAus(role.content, [role.path, role.anchor].filter((x): x is string => typeof x === "string" && !!x).join("#")) : null;
  const cc = rec(r?.claudeCode)?.zeilen;
  const zeilen = Array.isArray(cc) ? cc.map(rec).filter((z): z is Record<string, unknown> => !!z
    && ["id", "wort", "satz", "quelle", "weg", "wert"].every((k) => typeof z[k] === "string")) as unknown as CcRow[] : null;
  return { au, zeilen };
}

// THE CARD SHE GOT (Bauleitung 16.10.: die Karte vom Start, nicht die von heute): a lane's role card stands in her own
// worktree's session file, AGENTS.override.md, section „## Rolle“ (server.ts#foundingSessionAgents, session-agents.ts
// #renderSessionAgents), read through /api/file once per opening. A MAIN and the Orchestratorin get their card in the
// start prompt, which no route serves; for them, and for a lane without that file, the window shows today's card and says so.
type StartRead = { opening: number; state: "loading" | "ok" | "none"; au: Autonomie | null };
const startCards = new Map<string, StartRead>();
function startCardOf(s: SlotInfo): StartRead | null {
  if (!s.worktree || !s.cwd) return null;
  const key = keyOf(s);
  const old = startCards.get(key);
  if (old && old.opening === opening) return old;
  const mine = opening;
  const path = `${s.cwd.replace(/\/+$/, "")}/AGENTS.override.md`;
  startCards.set(key, old ? { ...old, opening: mine } : { opening: mine, state: "loading", au: null });
  void api(`/api/file?${new URLSearchParams({ path })}`).then(async (r) => {
    const j = rec(await r.json().catch(() => null));
    const text = r.ok && j && typeof j.text === "string" && !j.binary && !j.truncated ? j.text : null;
    const rolle = text ? /(?:^|\n)## Rolle\n\n([\s\S]*?)(?=\n\n## |\s*$)/.exec(text)?.[1] ?? null : null;
    const au = rolle ? autonomieAus(rolle, `${place(path)} · Abschnitt „Rolle“`) : null;
    startCards.set(key, { opening: mine, state: au ? "ok" : "none", au });
  }).catch(() => {
    startCards.set(key, { opening: mine, state: "none", au: null });
  }).finally(renderKonstellation);
  return startCards.get(key)!;
}
