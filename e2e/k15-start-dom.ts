// STARTING FROM THE START WINDOW IN A REAL BROWSER (owner 24.10., src/start-fenster.ts; the build: Neuaufbau K15 Runde 5, src/k15-start.ts,
// src/start-tuer.ts). Owner 24.10.: a free slot opens the new start window — the repos and their agents, then the session with a banner
// that says whether it starts as „[Zitat entfernt]“, and on the right the start brief: „[Zitat entfernt]“
// , file by file with − and + lines against `claude` by hand. Since the Soll (25.10., owner's yes 26.10.) every
// place answers one question: no banner while a start is as usual, Connectors a choice of the MCP servers, Plan first a choice of its own,
// Fleet's stones tiles with a sentence and a switch, the start brief in four moments. The build of the old window leaves before the
// release (owner 26.10.): its button „[Zitat entfernt]“ went, and with it the claims that reached the build from a free
// place; ⎇+ and a repo's + still open it until Slot 2 takes it out.
// The real client bundle (src/client.ts) and the window's own bundle (src/k15-entwurf.ts → /k15.js, with public/k15.css and
// public/sitzung.css) behind a fixture origin answered over CDP Fetch (as e2e/konstellation.ts): /api/sessions names one running session in
// slot 1 (an Orchestratorin in slot 2 where a case asks), /api/founding-plan answers per role with a hash that moves with the query and
// the fixture's HEAD (as the old rig's fixturePlanFor, src/founding.ts#validAnswer holds it strictly) and, for the start window, a Fassung
// with a fassungsHash that moves with every field of the query (server/fassung.ts: the owner's rule files, the repo's AGENTS.md, the
// rights sentence, the guides), /api/agenten lists the repo's agent, the Orchestratorin and one saved agent, and /api/harnesses,
// /api/programs, /api/branches, /api/dirinfo, /api/dirs, /api/machine-settings, /api/worktrees and the window's store
// (src/k15-speicher.ts#SPEICHER_ROUTE) answer as the server writes them; every POST and PUT is recorded with its body. Every case loads
// the page fresh, so no case reads what another left behind; clicks and taps are real input over CDP. The claims are read at 1200 × 900
// (an iPad's width: the start brief opens over the session, K15's build shows one column at a time), openPhone at 390 × 844. Every
// claim has a MUTANT in K15_START_MUTANTS that swaps one needle in a source file and must turn that claim red; a needle that left the
// source throws, so a mutant that could not apply fails as itself.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export interface K15StartDomResult { width: number; height: number; claims: Record<string, boolean>; facts: Record<string, unknown> }
class K15VerdictIn extends Error {
  constructor(readonly results: K15StartDomResult[]) { super("k15 start DOM: the mutant's claim has its verdict"); }
}
export interface K15StartMutant {
  name: string; claim: string;
  file: "src/k15-start.ts" | "src/start-tuer.ts" | "src/k15-zustand.ts" | "src/client.ts" | "src/board.ts" | "src/k15-entwurf.ts"
    | "src/start-fenster.ts" | "src/start-wahl.ts" | "src/start-brief.ts" | "src/dom-morph.ts";
  needle: string; with: string; width?: 1200 | 390;
}

export const K15_START_CLAIM = {
  open: "a click on a free place of the left bar opens the start window (#shell-found.k15sitz) titled „New session“: the repos on the left with the place's repo chosen, its agents beside them with the repo's own agent first, and no element of the old start window (.fdgo, .fdkind), of the build (.k15go) or its button („Lanes, MAIN and constellations ›“, .sfaufbau) stands anywhere",
  openPhone: "on the phone „Neue Session“ in the Sessions sheet opens the same start window; a tap on the repo's agent shows the session with Start, its zones „Your Claude Code“ and „Fleet on top“ and the start brief below it, nothing wider than the screen, and Start opens the session on the free place",
  banner: "the repo's agent with nothing changed shows no banner, and the start brief says it starts as claude here by hand, without filter or legend; Succession stands on at the Fassung's mark (40 %) with nothing to switch; Rules „Only this repo's“ brings the amber banner „1 change from your normal Claude Code“ with the chip „− Your rules left out“ and the brief's filter and legend; „Back to normal“ takes the banner away again and leaves nothing in the start brief marked",
  brief: "with Rules „Only this repo's“ the start brief marks your ~/.claude/CLAUDE.md once as left out (−) and shows none of its lines while closed; a click on its head shows its text as Markdown, its hand-wrapped lines flowing into one paragraph, and „Show its 40 lines“ shows all 40 as − lines (owner 25.10.: one mark at a whole file, no torn lines); and the repo's own AGENTS.md and your ~/AGENTS.md unchanged; the Rule files tile lists your ~/.claude/CLAUDE.md as left out and ~/AGENTS.md as still read at the start",
  ohneCheck: "in a repo without a merge check, the stone Branch & land says you bring its commits back yourself and promises no land of its own; switched on it says it lands only when you say so, unchecked, and its block says it lands in one commit and without a check, because the repo has no ci/merge-check.ts",
  pfeil: "on a wide screen (1600 px) a click on Rule files opens it with one sentence of what it is, and one line runs from each of its files to that file's part in the start brief, ending there; closed, the lines go; at 1200 px, where the start brief opens over the session, the open block has no line and a link „Show it in the start brief ›“ instead",
  vorschau: "the start brief reads two previews from GET /api/founding-plan (role nur-ordner, anlass=neu): normal without any choice, and this choice with its fields under the door's names (Rules only → weglassen { claudeMd, rules }) and nothing else",
  start: "Start sends exactly one POST /api/slots/<free>/open: with Rules only { cwd, fassung, weglassen: { claudeMd, rules } }, with nothing changed { cwd, fassung } — fassung the fassungsHash of the preview that read this choice, and plan { hash, role: \"nur-ordner\" } beside it only when that plan says start.startbar",
  packs: "under Fleet on top, „What it knows“ shows „Context packs“ with each pack of the library as a stone with a switch (Who it is for, Testing a build) and „Concepts“ with the concept (System concept), all off in your own setup; Who it is for switched on asks the preview for exactly that pack (bibliothek=who-it-is-for), the start brief adds it with every request as a + part of its own, no group around it, that reads, opened, as its Markdown („Who it is for“ as heading), the banner names „+ Context pack: Who it is for“, and Start sends bibliothek [\"who-it-is-for\"]; switched off again, nothing differs from normal",
  rechte: "the stone Rights under Fleet on top, switched on, sets „Builds“; „Looks only“ chosen in its block goes into the preview and the start as rechte { stufe: \"lesen\", an: [], aus: [] }, and the start brief shows its rights sentence as a + part with every request, read as text when opened",
  agent: "a saved agent unchanged reads its preview with agent=<id> and starts with { cwd, fassung, agent } and none of its fields; changed in the window it says „not saved yet“ and reads and starts with its fields spelled out and no agent; „Save as agent…“ on the repo's agent posts /api/agenten { name, wahlen } with the choice and the name as typed, also when the model changed while it was typed; „Delete…“, asked once more, sends DELETE /api/agenten/<id> and goes back to the agents; the Orchestratorin starts with { cwd, plan: { hash, role: \"orchestratorin\" }, agent: \"orchestratorin\" } and no fassung",
  druck: "a press is not lost when answers come while the button is held down: on the repo's agent in the start window the answer that comes during the press waits, nothing is drawn anew under the pointer until the release, and the release opens its session",
  ruhig: "a change of Rules and the preview that follows it change only what changed (owner 24.10.: no flicker): the window, its columns, the repo rows, the zones and every tile but Rule files stay the same elements, and nothing changes in the repo column, in another tile or anywhere else; the changes stand in the banner that comes, the Rule files tile and its block, the head with Start, and the start brief, where a block that reads the same afterwards is the same element; nothing that stays is moved (a move inserts it again, and it fades in); a second click on the Rule files tile closes its block, and switching Rights on leaves the other stones the same elements",
  laden: "while the preview of a new choice is read, Start is blocked with „Reading what this session gets …“ and a press sends nothing, and the start brief says „Comparing …“ instead of „Nothing differs“ while the banner already names the change; once read, the brief shows the change and Start carries the fassungsHash of that read",
  aufgabe: "the stone First task switched on, with a goal typed in two goes, the window redrawn between them, starts with exactly { cwd, fassung, goal } at /api/slots/<free>/open and the goal whole",
  branchStart: "the stone Branch & land switched on blocks Start until it has a name; with a name typed in two goes, Rights and a first task Start sends POST /api/branches { repo, name, points: [] }, then POST /api/branches/open { repo, branch, goal, rechte } and no /open",
  ohneGit: "in a folder without git, and in a repo the branch doors don't take (dirinfo branches:false, no session works there yet), neither Branch & land nor Own notebook stands under Fleet on top, nor is a branch offered in the Workplace block, while the other stones are",
  connectors: "Connectors shows the MCP servers Fleet measured at a session's start as a choice, each ticked with where it comes from (Gmail · claude.ai, playwright · plugin), and its block says that /mcp turns a server on or off later in the session; unticking Gmail reads the preview with weglassen { mcp: [\"claude_ai_Gmail\"] }, the tile says „1 of 2 servers“, the banner names „− Connectors: 1 left out“, and Start sends weglassen { mcp: [\"claude_ai_Gmail\"] }",
  plan: "Plan first is a choice of its own beside Asks you (owner 25.10. 19:50): On reads the preview and starts with permissionMode \"plan\", the banner names „+ Plan first“, and Asks you offers four choices without „Only plans“",
  quick: "⎇+ under a session opens the start window, not the build (orchestrator 26.10.: a session on a branch of its own, no lane): on the repo's agent Branch & land is on and blocks Start until it has a name; named, the sentence under Start says it starts from that session's branch, and Start sends POST /api/branches { repo, name, points: [], base: <that branch> }, then POST /api/branches/open, and never /api/lanes",
  plus: "the + of a repo opens the start window, not the build, with that repo chosen; its own agent unchanged starts in the checkout with exactly { cwd, fassung } at /api/slots/<first free>/open, and never /api/lanes",
  unreadable: "a plan that cannot be read (500, network, malformed) blocks the start in the start window with a sentence that says so („The preview is not readable: …“), and nothing is sent",
  zu: "after a successful start from the start window the window closes and the started slot is the one shown",
} as const;
// the claims read on the phone; every other one at 1200
const PHONE: ReadonlySet<string> = new Set([K15_START_CLAIM.openPhone]);

const C = K15_START_CLAIM;
export const K15_START_MUTANTS: readonly K15StartMutant[] = [
  { name: "a free place opens nothing", claim: C.open, file: "src/client.ts",
    needle: "row.onclick = () => openK15Entwurf({ slot: s.id });", with: "row.onclick = () => undefined;" },
  { name: "a free place opens the build instead of the start window", claim: C.open, file: "src/k15-entwurf.ts",
    needle: `ansicht: eingang || h?.[1] === "sitzung" ? "sitzung" : "aufbau"`, with: `ansicht: "aufbau"` },
  { name: "the repo's own agent is not listed", claim: C.open, file: "src/start-fenster.ts",
    needle: "if (repoAg) liste.append(karteVon(repoAg));", with: "" },
  { name: "„Neue Session“ in the Sessions sheet opens nothing", claim: C.openPhone, file: "src/client.ts", width: 390,
    needle: `"Neue Session", () => { if (free) openK15Entwurf({ slot: free.id }); });`, with: `"Neue Session", () => undefined);` },
  { name: "a change never turns the banner amber", claim: C.banner, file: "src/start-fenster.ts",
    needle: "if (!D.length) return null;", with: "return null;" },
  { name: "„Back to normal“ keeps the choice", claim: C.banner, file: "src/start-fenster.ts",
    needle: "if (istRepo(z.agent)) { z.wahl = normal(); z.offen = null;", with: "if (istRepo(z.agent)) { z.offen = null;" },
  { name: "Succession is offered though the place hands over at its mark", claim: C.banner, file: "src/start-fenster.ts",
    needle: "const mark = uebergabeHinweis(abschnitt(fn ?? fj, \"arbeitet\", \"schwelle\"));", with: "const mark = null;" },
  { name: "a start as usual shows a banner", claim: C.banner, file: "src/start-fenster.ts",
    needle: "if (!D.length) return null;", with: "if (!D.length) return b;" },
  { name: "„Back to normal“ leaves the start brief marked", claim: C.banner, file: "src/start-fenster.ts",
    needle: "z.offen = null; z.heiss = null; render(); }", with: "z.offen = null; aendere(s, D.map((d) => d.id)); }" },
  { name: "the Rule files tile reads a file left out as read", claim: C.brief, file: "src/start-fenster.ts",
    needle: "wann: !an ? \"left out\"", with: "wann: false ? \"left out\"" },
  { name: "a pack's switch sends the library whole", claim: C.packs, file: "src/start-wahl.ts",
    needle: "...(liste !== null ? { bibliothek: liste }", with: "...(liste !== null ? { bibliothek: true }" },
  { name: "a pack switched on is not counted against the place", claim: C.packs, file: "src/start-wahl.ts",
    needle: "if (!ort.standard.includes(id)) D.push(", with: "if (ort.standard.includes(id)) D.push(" },
  { name: "the lines of an open tile point nowhere", claim: C.pfeil, file: "src/start-fenster.ts",
    needle: "const t = hb.querySelector<HTMLElement>(`.sfbk[data-ob=\"${CSS.escape(r.dataset.ziel!)}\"]`), rr", with: "const t = null as HTMLElement | null, rr" },
  { name: "a file's line ends at another part", claim: C.pfeil, file: "src/start-fenster.ts",
    needle: "z.dataset.ziel = r.key;", with: "z.dataset.ziel = \"line\";" },
  { name: "a file in the start brief keeps its hand-wrapped lines and tears in the narrow column", claim: C.brief, file: "src/start-fenster.ts",
    needle: "mdInto(body, fliessend(text));", with: "mdInto(body, text);" },
  { name: "a file wholly left out shows its lines while closed again", claim: C.brief, file: "src/start-fenster.ts",
    needle: "if (ganz && b.diff && !(offen && z.roh.has(b.key))) {", with: "if (false) {" },
  { name: "Branch & land promises a land without a merge check", claim: C.ohneCheck, file: "src/start-fenster.ts",
    needle: "const landetNicht = (i: DirInfoResp | null): boolean => i?.mergeCheck === false;", with: "const landetNicht = (i: DirInfoResp | null): boolean => false;" },
  { name: "„Delete“ deletes nothing", claim: C.agent, file: "src/start-fenster.ts",
    needle: "knopf(\"sfsec warn\", [`Delete „${z.name}“`], () => void loesche(s))", with: "knopf(\"sfsec warn\", [`Delete „${z.name}“`], () => undefined)" },
  { name: "a file left out shows no − lines", claim: C.brief, file: "src/start-brief.ts",
    needle: "if (neu === null) return fertig(zeilen(alt).map((t): Zeile => ({ z: \"−\", t })), \"−\");", with: "if (neu === null) return fertig(null, null);" },
  { name: "the preview ignores the choice", claim: C.vorschau, file: "src/start-fenster.ts",
    needle: "const q = new URLSearchParams(alsAgent(z) ? { agent: z.agent!.id } : vorschau(z.wahl)).toString();",
    with: "const q = new URLSearchParams(alsAgent(z) ? { agent: z.agent!.id } : {}).toString();" },
  { name: "the start drops the choice", claim: C.start, file: "src/start-fenster.ts",
    needle: "const wahl = ganz ? {} : felder;", with: "const wahl = ganz ? {} : {};" },
  { name: "the start carries no fassungsHash", claim: C.start, file: "src/start-fenster.ts",
    needle: "...(a.fassungsHash && !rolle ? { fassung: a.fassungsHash } : {})", with: "...({})" },
  { name: "rights go neither into the preview nor the start", claim: C.rechte, file: "src/start-wahl.ts",
    needle: "...(w.rechte ? { rechte: { stufe: w.rechte, an: [], aus: [] } } : {})", with: "...({})" },
  { name: "a saved agent never starts by its id", claim: C.agent, file: "src/start-fenster.ts",
    needle: "const alsAgent = (z: FensterStand): boolean => !!z.agent && z.agent.id !== \"repo\" && (z.fremd.length > 0 || gleich(z.wahl, z.basis));",
    with: "const alsAgent = (z: FensterStand): boolean => !!z.agent && z.fremd.length > 0;" },
  { name: "a changed agent does not say it is not saved", claim: C.agent, file: "src/start-fenster.ts",
    needle: "if (offen) l.append(el(\"b\", \"\", `${her ? \" · \" : \"\"}not saved yet`));", with: "" },
  // a press has two guards: the redraw waits for the release, and a redraw keeps its elements (the morph, claim ruhig); either alone keeps
  // the click, so the press claim watches the wait itself
  { name: "an answer during a press is drawn under the pointer", claim: C.druck, file: "src/k15-entwurf.ts",
    needle: "if (gedrueckt) { aufgeschoben = true; return; }", with: "" },
  { name: "a redraw draws the whole window anew", claim: C.ruhig, file: "src/start-fenster.ts",
    needle: "const stage = alt instanceof HTMLElement && alt.classList.contains(\"sf\") ? (morph(alt, neu), alt) : (d.replaceChildren(neu), neu);",
    with: "const stage = (d.replaceChildren(neu), neu);" },
  { name: "the morph replaces every child", claim: C.ruhig, file: "src/dom-morph.ts",
    needle: "let treffer: ChildNode | null = da && gleich(da, n) ? da : null;", with: "let treffer: ChildNode | null = null;" },
  { name: "the morph matches an unkeyed child by its tag alone", claim: C.ruhig, file: "src/dom-morph.ts",
    needle: "(n.getAttribute(\"class\") ?? \"\").trim().split(", with: "(\"\").trim().split(" },
  { name: "the morph moves what follows instead of dropping what went", claim: C.ruhig, file: "src/dom-morph.ts",
    needle: "while (da && !gleich(da, n) && ", with: "while (false && da && !gleich(da, n) && " },
  { name: "the morph keeps the handlers of the first drawing", claim: C.ruhig, file: "src/dom-morph.ts",
    needle: "for (const h of HANDLER) if (a[h] !== n[h]) a[h] = n[h];", with: "" },
  { name: "the task field reads the element it was drawn into", claim: C.aufgabe, file: "src/start-fenster.ts",
    needle: "ta.oninput = (e) => { w.aufgabe = (e.currentTarget as HTMLTextAreaElement).value; render(); };", with: "ta.oninput = () => { w.aufgabe = ta.value; render(); };" },
  { name: "the branch name reads the element it was drawn into", claim: C.branchStart, file: "src/start-fenster.ts",
    needle: "nm.oninput = (e) => { w.branch = (e.currentTarget as HTMLInputElement).value; render(); };", with: "nm.oninput = () => { w.branch = nm.value; render(); };" },
  { name: "Save reads the name field it was drawn into", claim: C.agent, file: "src/start-fenster.ts",
    needle: "acts.append(nm, knopf(\"sfsec\", [\"Save\"], () => void speichere(s, name())));", with: "acts.append(nm, knopf(\"sfsec\", [\"Save\"], () => void speichere(s, nm.value)));" },
  { name: "a redraw puts the proposed name back", claim: C.agent, file: "src/start-fenster.ts",
    needle: "nm.value = z.nameEntwurf ?? (", with: "nm.value = (" },
  { name: "Start goes while the preview of the new choice loads", claim: C.laden, file: "src/start-fenster.ts",
    needle: "if (!a || laedt) return \"Reading what this session gets …\";", with: "if (!a) return \"Reading what this session gets …\";" },
  { name: "the start brief keeps the old comparison while it loads", claim: C.laden, file: "src/start-fenster.ts",
    needle: "if (p.laedt) { const x = el(\"div\", \"sfleer\", \"Comparing …\");", with: "if (false) { const x = el(\"div\", \"sfleer\", \"Comparing …\");" },
  { name: "the first task never goes to the door", claim: C.aufgabe, file: "src/start-fenster.ts",
    needle: "wahl: { ...wahl, ...(ziel ? { goal: ziel } : {}) }", with: "wahl: { ...wahl }" },
  { name: "Branch & land starts in the checkout", claim: C.branchStart, file: "src/start-fenster.ts",
    needle: "const r: Antwort = w.branch !== null", with: "const r: Antwort = false" },
  { name: "Branch & land is offered without git", claim: C.ohneGit, file: "src/start-fenster.ts",
    needle: "    && (branchGeht(i) || (id !== \"branch\" && id !== \"notebook\"));", with: ";" },
  { name: "Branch & land is offered where the branch door refuses the repo", claim: C.ohneGit, file: "src/start-fenster.ts",
    needle: "const branchGeht = (i: DirInfoResp | null): boolean => i?.git === true && i.branches !== false;",
    with: "const branchGeht = (i: DirInfoResp | null): boolean => i?.git === true;" },
  { name: "the Workplace block offers a branch without git", claim: C.ohneGit, file: "src/start-fenster.ts",
    needle: "if (frei && branchGeht(i)) d.append(opts(", with: "if (frei) d.append(opts(" },
  { name: "an unticked server stays in the start", claim: C.connectors, file: "src/start-wahl.ts",
    needle: "if (w.mcpAus.length) o.mcp = [...w.mcpAus];", with: "" },
  { name: "Connectors shows no choice of the servers", claim: C.connectors, file: "src/start-fenster.ts",
    needle: "const sv = server(z.letzte?.n ?? z.letzte?.a), weg =", with: "const sv = [] as Server[], weg =" },
  { name: "Plan first never reaches the door", claim: C.plan, file: "src/start-wahl.ts",
    needle: "const modus = w.planFirst ? \"plan\" : w.permissionMode;", with: "const modus = w.permissionMode;" },
  { name: "⎇+ opens the build again", claim: C.quick, file: "src/k15-entwurf.ts",
    needle: `ansicht: eingang || h?.[1] === "sitzung" ? "sitzung" : "aufbau"`, with: `ansicht: (eingang && "slot" in eingang) || h?.[1] === "sitzung" ? "sitzung" : "aufbau"` },
  { name: "⎇+ starts in the checkout instead of on a branch of its own", claim: C.quick, file: "src/start-fenster.ts",
    needle: "if (abzweig(s) && !fremd.length && wahl.branch === null) wahl.branch = \"\";", with: "" },
  { name: "⎇+ branches from the repo's main instead of the session's branch", claim: C.quick, file: "src/start-fenster.ts",
    needle: "...(abzweig(s)?.branch ? { base: abzweig(s)!.branch! } : {})", with: "" },
  { name: "the + of a repo opens nothing", claim: C.plus, file: "src/board.ts",
    needle: "add.onclick = (e) => { e.stopPropagation(); openK15Entwurf({ repo: R.repo }); };", with: "add.onclick = (e) => { e.stopPropagation(); };" },
  { name: "an unreadable preview reads as loading in the start window", claim: C.unreadable, file: "src/start-fenster.ts",
    needle: "if (fehler) return `The preview is not readable: ${fehler}`;", with: "if (fehler) return \"Reading what this session gets …\";" },
  { name: "the start window stays open after a start", claim: C.zu, file: "src/start-fenster.ts",
    needle: "    s.shell.close();\n    zeigeSlot(r.slot);", with: "    zeigeSlot(r.slot);" },
];

const REPO = "/fixture/claude-fleet";
const HOME = "/fixture/home";
// the free place every case from the left bar clicks; slot 1 runs, slot 2 is the first free one (or the Orchestratorin's)
const FREE = 4;
const STD: Record<string, { harness: string; modell: string; effort: string } | null> = {
  lane: { harness: "claude", modell: "claude-opus-5-5", effort: "high" },
  main: { harness: "claude", modell: "claude-opus-5-5[1m]", effort: "xhigh" },
  orchestratorin: { harness: "claude", modell: "claude-opus-5-5[1m]", effort: "high" },
  "nur-ordner": null,
};
const ROLE_WORD: Record<string, string> = { lane: "Lane", main: "MAIN", orchestratorin: "Orchestratorin", "nur-ordner": "Nur Ordner" };
type Rd = Record<string, "an" | "aus">;
const ALL = (v: "an" | "aus", ordner: "an" | "aus"): Rd => ({ lane: v, main: v, orchestratorin: v, "nur-ordner": ordner });
// a small register of its own: what each role gets, the two rows a free session's /open door gives without a plan, each row's
// question (`frage`, session-fragen.ts)
const ROWS: { id: string; wort: string; funktion: string[]; noetig: boolean; rd: Rd; bytes: number; frage: string; fest?: string }[] = [
  { id: "spawn-profile", wort: "Agent · Modell · Effort", funktion: ["orientierung"], noetig: true, rd: ALL("an", "aus"), bytes: 0, frage: "umstaende" },
  { id: "role-card", wort: "Rolle", funktion: ["vertrag"], noetig: true, rd: { lane: "an", main: "an", orchestratorin: "aus", "nur-ordner": "aus" }, bytes: 100, frage: "howto" },
  { id: "self-credential", wort: "Rückweg", funktion: ["rueckweg"], noetig: true, rd: ALL("an", "aus"), bytes: 0, frage: "umstaende" },
  { id: "context-anchors", wort: "Lesehinweise", funktion: ["orientierung"], noetig: false, rd: ALL("an", "aus"), bytes: 76, frage: "hintergrund" },
  { id: "native-agents", wort: "Lädt nativ", funktion: ["vertrag"], noetig: false, rd: ALL("an", "an"), bytes: 1000, frage: "hintergrund", fest: "Der Agent lädt den Ordner selbst." },
  { id: "bibliothek", wort: "Bibliothek", funktion: ["orientierung"], noetig: false, rd: ALL("an", "aus"), bytes: 2400, frage: "howto" },
];
// FLEET'S LIBRARY as the plan's row names it (server/sitz-wissen.ts#seatKatalog): a pack in the start, one as a skill, a concept
const PACK_KATALOG = [
  { id: "who-it-is-for", titel: "Who it is for", useWhen: "Read this when you choose, brief or build work that someone will use.", bytes: 2400, weg: "start", konzept: false },
  { id: "testinstanz-abnahme", titel: "Testing a build", useWhen: "When you build or accept something visible.", bytes: 3100, weg: "skill", konzept: false },
  { id: "system-concept", titel: "System concept", useWhen: "When you need to know what Fleet is and where it goes.", bytes: 9000, weg: "skill", konzept: true },
];
// the files Claude Code loads by itself in the fixture repo (native-agents' details): three of yours, two of the folder
const NATIV = [[`${HOME}/.claude/CLAUDE.md`, 3000], [`${HOME}/.claude/rules/typescript.md`, 2000], [`${HOME}/AGENTS.md`, 2500],
  [`${REPO}/AGENTS.md`, 4000], [`${REPO}/docs/CLAUDE.md`, 1000]] as const;
const fileText = (pfad: string): string => Array.from({ length: 40 }, (_, i) => `${pfad} · Zeile ${i + 1}`).join("\n");
// what the /open door gives a free session although its plan says „aus“ (server.ts#planDoorVerdict), in the window's words
const ORDNER_TROTZDEM = "Agent · Modell · Effort, Rückweg";
// The dragged „Nur Ordner“ is a SAVED constellation, so its one position starts as its seat: the body names it as
// `sitz: "<constellation>/o1"` (d94c78206, src/k15-zustand.ts#sitzKommt: „Jede solche Position startet als ihr Sitz, auch
// ohne Block“), and the foot says which run the start goes into (4f7acbefc, src/k15-lauf.ts#laufSatz).
const LAUF_NEU = "Startet einen neuen Lauf auf der gespeicherten Fassung.";
const alsSitz = (body: unknown): boolean => /^[^/]+\/o1$/.test(String((body as { sitz?: unknown } | null)?.sitz ?? ""));
const ohneSitz = (body: unknown): unknown => { const { sitz: _sitz, ...rest } = (body ?? {}) as Record<string, unknown>; return rest; };
const hash = (s: string): string => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, "0").repeat(8);
};
// the keys a plan read carries (k15-zustand.ts#planUrl); the hash moves with them and with the fixture's HEAD
const planKey = (q: URLSearchParams, head: string): string =>
  JSON.stringify([q.get("role"), q.get("repo"), q.get("harness"), q.get("model"), q.get("effort"), q.get("bausteine"), head]);
const canon = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) => x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : x);

// THE START WINDOW'S FIXTURE (src/start-fenster.ts). The agents GET /api/agenten?cwd= lists (server/agenten.ts#AgentAnsicht): the repo's
// own, the Orchestratorin as a role of Fleet's, and one saved agent of the owner's
const AGENTEN = [
  { id: "repo", name: "Agent des Repos", wahlen: {}, agentMd: null, art: "eingebaut", aenderbar: false, quelle: "Fleet", hash: hash("repo") },
  { id: "orchestratorin", name: "Orchestratorin", wahlen: { rolle: "orchestratorin" }, agentMd: null, art: "eingebaut", aenderbar: false, quelle: "Fleet", hash: hash("orchestratorin") },
  { id: "pruefer", name: "Prüfer", wahlen: { model: "claude-sonnet-5-5", permissionMode: "plan" }, agentMd: null, art: "eigen", aenderbar: true,
    quelle: "~/.fleet/agenten/pruefer.json", hash: hash("pruefer") },
];
// the rule files Claude Code reads in the fixture repo, an own setup as the owner's example-app: your ~/.claude/CLAUDE.md and one of
// your rules, your ~/AGENTS.md (a folder above; weglassen doesn't touch it), then the repo's AGENTS.md (liest.projektregeln: one text
// with „--- i/n NAME ---“ markers, the paths in `dateien`)
const REGELN: { pfad: string; eigentum?: string }[] = [{ pfad: `${HOME}/.claude/CLAUDE.md`, eigentum: "owner" },
  { pfad: `${HOME}/.claude/rules/typescript.md`, eigentum: "owner" }, { pfad: `${HOME}/AGENTS.md` }, { pfad: `${REPO}/AGENTS.md` }];
const STUFE_WORT: Record<string, string> = { lesen: "Nur lesen", bauen: "Bauen", landen: "Landen", deployen: "Deployen" };
// the level as the session reads it in its rights sentence (server/rechte.ts)
const STUFE_SATZ: Record<string, string> = { lesen: "read only", bauen: "build", landen: "land", deployen: "deploy" };
// the Fassung the preview door returns with anlass=neu for this query (server/fassung.ts): what the choice leaves out of your ~/.claude,
// the rights sentence, the guides; a saved agent's choices count as if set (server/agenten.ts), a role reads its card and is no own setup
const fassungOf = (q: URLSearchParams): { teile: { id: string; abschnitte: Record<string, unknown>[] }[] } => {
  const ag: Record<string, unknown> = AGENTEN.find((x) => x.id === q.get("agent"))?.wahlen ?? {};
  const w: Record<string, string> = { ...Object.fromEntries(Object.entries(ag).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])), ...Object.fromEntries(q) };
  const role = w.role ?? "nur-ordner";
  const weg = JSON.parse(w.weglassen ?? "{}") as { claudeMd?: boolean; rules?: boolean };
  const regeln = REGELN.filter((r) => !(weg.claudeMd && r.pfad.endsWith("/.claude/CLAUDE.md")) && !(weg.rules && r.pfad.includes("/.claude/rules/")));
  const stufe = w.rechte ? (JSON.parse(w.rechte) as { stufe: string }).stufe : null;
  const gewaehlt = ["model", "effort", "permissionMode", "tools", "notizbuch", "rechte", "bibliothek", "schwelle"].filter((k) => w[k] !== undefined);
  // the library: whole (true), none (false) or exactly these packs, as the preview's query or a saved agent's list carries it
  const bib = w.bibliothek, packsAn: string[] = bib === undefined || bib === "false" ? [] : bib === "true" ? PACK_KATALOG.map((x) => x.id)
    : bib.startsWith("[") ? JSON.parse(bib) as string[] : bib.split(",");
  const a = (id: string, text: string, mehr: Record<string, unknown> = {}) => ({ id, quelle: null, bytes: new TextEncoder().encode(text).length, text, ...mehr });
  return { teile: [
    { id: "wer", abschnitte: [a("modell", w.model ?? "kein Modell gewählt"), a("effort", w.effort ?? "kein Effort gewählt")] },
    { id: "liest", abschnitte: [a("systemzusatz", ""),
      ...(role === "orchestratorin" ? [a("rolle", "ROLLE Orchestratorin: plant die Arbeit, öffnet die Branches, bringt die Ergebnisse zurück.")] : []),
      a("projektregeln", regeln.map((r, i) => `--- ${i + 1}/${regeln.length} ${r.pfad.split("/").pop()} ---\n${fileText(r.pfad)}`).join("\n"),
        { dateien: regeln.map((r) => ({ pfad: r.pfad, bytes: fileText(r.pfad).length, ...(r.eigentum ? { eigentum: r.eigentum } : {}) })) }),
      ...(packsAn.includes("who-it-is-for") ? [a("wissen", "--- who-it-is-for (docs/packs/who-it-is-for.md · # Who it is for) ---\n# Who it is for\n\nRead this when …")] : []),
      ...packsAn.filter((id) => id !== "who-it-is-for").map((id) => a("wissen", `- ${id}: ${PACK_KATALOG.find((x) => x.id === id)?.useWhen ?? "…"}`)),
      ...(w.notizbuch === "aus" ? [] : [a("gedaechtnis", "- [Fixture](fixture.md) — a note", { quelle: `${HOME}/.claude/projects/-fixture-claude-fleet/memory`,
        dateien: [{ pfad: `${HOME}/.claude/projects/-fixture-claude-fleet/memory/MEMORY.md`, bytes: 32 }] })])] },
    { id: "darf", abschnitte: [...(role === "nur-ordner" ? [a("eigenes-setup", "Eigenes Setup: so wie von Hand.")] : []),
      a("darf", stufe ? `FLEET RIGHTS (level “${STUFE_SATZ[stufe]}”, set at start): allowed Edit, Write.` : "Keine Rechte gesetzt"),
      ...(w.permissionMode ? [a("modus", w.permissionMode)] : []),
      a("mitgegeben", gewaehlt.length ? gewaehlt.map((k) => `${k}: ${w[k]}`).join("\n") : "nichts"),
      ...(weg.claudeMd || weg.rules ? [a("weggelassen", `beim Öffnen weggelassen (weglassen): ${[weg.claudeMd ? "~/.claude/CLAUDE.md" : null, weg.rules ? "~/.claude/rules/**" : null].filter(Boolean).join(" und ")}`)] : []),
      a("hooks-eigene", `PreToolUse · Bash · ${HOME}/.claude/hooks/block-no-verify.sh`)] },
    { id: "arbeitet", abschnitte: [a("plugins", "figma@claude-plugins-official 1.2.0 · an · Skills 3 · MCP"),
      a("claude-eigenes", "Agenten 2: analyst 1224 B, reviewer 900 B\nSkills 1: tdd 800 B"),
      // Fleet's handover note at the mark, in an own setup too (succession.ts#hintText), as the real Fassung writes it
      a("schwelle", `Übergabe ab ${w.schwelle ?? 40} % · fällig ab ${Number(w.schwelle ?? 40) + 5} % · an der Schwelle: Hinweis · Hinweis an`)] },
  ] };
};
// WHAT CLAUDE CODE SHOWED at a session's start, as the server measures it (server/claude-code-anatomie.ts): here only its MCP servers, one
// from the claude.ai account and one a plugin brings, each with the key its tools carry (mcp__<key>__…)
const CC_FIXTURE = { rolle: "generic", zeilen: [],
  messung: { rolle: "generic", tokens: 20000, am: "2026-10-25", claude: "2.1.310", modell: "claude-opus-5-5", quelle: "fixture", gilt: true },
  anatomie: { quelle: null, grund: null, gruppen: [{ id: "mcp", wort: "MCP-Server", satz: "aus dem claude.ai-Konto und Plugins", teile: [
    { name: "claude.ai Gmail", schluessel: "claude_ai_Gmail", bytes: 120, stand: "abruf", weg: "claude.ai-Anbindung", satz: "kommt aus deinem claude.ai-Konto" },
    { name: "playwright", schluessel: "plugin_playwright_playwright", bytes: 140, stand: "abruf", weg: "Plugin playwright", satz: "kommt mit dem Plugin playwright" }] }] } };
// the fassungsHash of a preview read: it moves with every field of the query (the window's choice, the agent) and with the fixture's HEAD
const fassungKey = (q: Record<string, string>, head: string): string =>
  hash(JSON.stringify([Object.entries(q).filter(([k]) => k !== "anlass").sort(([x], [y]) => x.localeCompare(y)), head]));

interface Fx {
  head: string; plan: "ok" | "500" | "network" | "malformed"; ordnerStartbar: boolean; orch: boolean; move: boolean;
  programs: "ok" | "fail"; bootstrap: "ok" | "existing" | "refuse" | "pending"; branchExists: boolean; board: boolean;
  // the answers of /api/dirinfo, or of /api/founding-plan, wait until the case lets them go (`haltend`)
  dirinfoHalt: boolean; planHalt: boolean;
  // the fixture repo is a git checkout; false: a plain folder. branches: the branch doors take it (a workplace repo)
  git: boolean; branches: boolean;
  // the branch /api/dirinfo names for the fixture repo's checkout, where slot 1 works
  zweig: string;
  occupied: Map<number, Record<string, unknown>>;
}
const fx0 = (): Fx => ({ head: "fixture-head", plan: "ok", ordnerStartbar: false, orch: false, move: false, programs: "ok", bootstrap: "ok",
  branchExists: false, board: false, dirinfoHalt: false, planHalt: false, git: true, branches: true, zweig: "main", occupied: new Map() });

export async function runK15StartDom(sourceRoot: string, artifacts?: string,
  only: { widths?: readonly number[]; mutate?: K15StartMutant } = {}): Promise<K15StartDomResult[]> {
  const scratch = resolve(tmpdir(), `fleet-k15-start-dom-${process.pid}-${crypto.randomUUID()}`);
  mkdirSync(scratch, { recursive: true });
  if (artifacts) mkdirSync(artifacts, { recursive: true });
  const mutant = only.mutate;
  const mutantPath = mutant ? resolve(sourceRoot, mutant.file) : null;
  let applied = !mutant;
  const plugins = mutant && mutantPath ? [{ name: "k15-start-mutant", setup(build: Bun.PluginBuilder) {
    build.onLoad({ filter: /\.ts$/ }, ({ path }) => {
      if (path !== mutantPath) return undefined;
      const source = readFileSync(path, "utf8");
      if (source.includes(mutant.needle)) applied = true;
      return { contents: source.replace(mutant.needle, mutant.with), loader: "ts" as const };
    });
  } }] : [];
  const bundle = async (entry: string): Promise<string> => {
    const built = await Bun.build({ entrypoints: [resolve(sourceRoot, entry)], target: "browser", plugins });
    if (!built.success) throw new Error(built.logs.join("\n"));
    return built.outputs[0]!.text();
  };
  let appJs: string, k15Js: string;
  try { [appJs, k15Js] = await Promise.all([bundle("src/client.ts"), bundle("src/k15-entwurf.ts")]); } catch (e) { rmSync(scratch, { recursive: true, force: true }); throw e; }
  if (!applied) { rmSync(scratch, { recursive: true, force: true }); throw new Error(`k15 start mutant: needle not in ${mutant?.file}: ${mutant?.needle.slice(0, 80)}`); }
  const indexHtml = readFileSync(resolve(sourceRoot, "public/index.html"), "utf8");
  const k15Css = readFileSync(resolve(sourceRoot, "public/k15.css"), "utf8");
  const sitzungCss = readFileSync(resolve(sourceRoot, "public/sitzung.css"), "utf8");
  // the constellation a case drags in: one session „Nur Ordner“ (the only way the window makes one is a drop or an import)
  const ordnerJson = resolve(scratch, "nur-ordner.fleet.json");
  writeFileSync(ordnerJson, JSON.stringify({ format: 1, fleet: "konstellation", name: "Nur Ordner", version: 1, satz: "eine Session ohne Rolle", autor: "Fleet",
    positionen: [{ id: "o1", name: "Ordner-Session", profil: "ordner@1" }] }));

  let fx = fx0();
  const posts: { url: string; body: unknown }[] = [];
  const planReads: Record<string, string>[] = [];
  const deletes: string[] = [];
  const haltend: (() => void)[] = [];
  let programReads = 0, inflight = 0;
  const now = Date.now();
  const slots = (): Record<string, unknown>[] => Array.from({ length: 16 }, (_, i) => {
    const id = i + 1;
    const taken = fx.occupied.get(id);
    if (taken) return { id, lastOutput: 0, ...taken };
    if (id === 1) return { id, cwd: REPO, label: "Fleet", openedAt: 1000, lastOutput: 0, model: "claude-opus-5-5[1m]", effort: "high",
      git: { branch: "main", dirty: 0, ahead: 0, behind: 0 } };
    if (id === 2 && fx.orch) return { id, cwd: REPO, label: "Orchestrator", role: "orchestrator", openedAt: 2000, lastOutput: 0, model: "claude-opus-5-5[1m]", effort: "high" };
    return { id, cwd: null, label: null, lastOutput: 0 };
  });
  const firstFree = (): number => slots().find((x) => !x.cwd)?.id as number;
  // the slot the last start's answer named: the one the window must show
  let started: number | null = null;
  const occupy = (id: number, row: Record<string, unknown>): void => { fx.occupied.set(id, { openedAt: 5000 + id, ...row }); started = id; };

  const planOf = (q: URLSearchParams): Record<string, unknown> => {
    const role = q.get("role") ?? "lane", harness = q.get("harness") ?? "claude";
    const sw: Record<string, string> = {};
    for (const e of (q.get("bausteine") ?? "").split(",").filter(Boolean)) { const at = e.indexOf("="); sw[e.slice(0, at)] = e.slice(at + 1); }
    const ordner = role === "nur-ordner";
    const bausteine = ROWS.map((r) => {
      const zu = ordner && r.id !== "native-agents";
      const zustand = sw[r.id] ?? r.rd[role] ?? "aus";
      return { id: r.id, wort: r.wort, satz: `Satz ${r.id}.`, funktion: r.funktion,
        grenze: r.noetig ? { art: "noetig", grund: `ohne ${r.wort} kein Start` } : { art: "frei" }, schicht: "fixture", zustand,
        quelle: r.id in sw ? "schalter" : "default", rollenDefault: r.rd[role] ?? "aus", harness: { gueltig: true, grund: null },
        schaltbar: r.fest ? { ja: false, grund: r.fest } : zu ? { ja: false, grund: "Nur Ordner liefert nur, was der Ordner selbst lädt." } : { ja: true },
        bytes: r.bytes, ersatzKandidaten: [], frage: r.frage,
        ...(r.id === "native-agents" ? { details: { dateien: NATIV.map(([pfad, bytes]) => ({ pfad, bytes })), nachgeladen: [] } } : {}),
        // only a session without a role has Fleet's library (server.ts#foundingSessionPlan)
        ...(r.id === "bibliothek" && ordner ? { details: { packs: ["who-it-is-for"], katalog: PACK_KATALOG, eigene: [] } } : {}) };
    });
    const startbar = !ordner || fx.ordnerStartbar;
    return { head: fx.head, branch: "main", harness, plannedAt: 1000, selected: [], omitted: [], role,
      fassung: fassungOf(q), fassungsHash: fassungKey(Object.fromEntries(q), fx.head), claudeCode: CC_FIXTURE,
      plan: { planHash: hash(planKey(q, fx.head)), planSatz: [ROLE_WORD[role], harness, q.get("model"), q.get("effort")].filter(Boolean).join(" · "),
        rolle: role, harness, modell: q.get("model"), effort: q.get("effort"),
        ort: { art: role === "lane" ? "worktree" : "repo", pfad: q.get("repo") ?? REPO, branch: "main", head: fx.head },
        bytesVorAuftrag: { bytes: 1176, unknown: [], auftrag: [] }, bausteine },
      rollen: Object.keys(ROLE_WORD).map((id) => ({ id, wort: ROLE_WORD[id], standard: STD[id], verfuegbarkeit: "available" })),
      ...(ordner ? { sessionAgents: null } : {}),
      start: { tuer: role === "lane" ? "lane" : "open", startbar,
        refusals: startbar ? [] : ["spawn-profile ist im Plan aus, diese Tuer liefert es trotzdem (plan)", "self-credential ist im Plan aus, diese Tuer liefert es trotzdem (plan)"] } };
  };
  const PROGRAMS = { programs: [
    { id: "p-live", title: "Fixture Lebt", status: "active", main: { slot: 1, openedAt: 1000 }, health: { occupancy: "live" } },
    { id: "p-free", title: "Fixture Frei", status: "active", health: { occupancy: "unbound" } },
    { id: "p-stale", title: "Fixture Alt", status: "active", main: { slot: 5, openedAt: 50 }, health: { occupancy: "stale" } },
    { id: "p-unknown", title: "Fixture Ohne Befund", status: "active" },
    { id: "p-founding", title: "Fixture Gründet", status: "active", founding: { v: 2 }, health: { occupancy: "unbound" } },
    { id: "p-done", title: "Fixture Fertig", status: "complete", health: { occupancy: "unbound" } },
  ] };
  const KATALOG = { harnesses: [
    { id: "claude", role: "agent", default: true, supports: { model: true, effort: true }, models: ["claude-opus-5-5", "claude-opus-5-5[1m]", "claude-sonnet-5-5"],
      effortLevels: ["low", "medium", "high", "xhigh", "max"], allowsLanes: true },
    { id: "codex", role: "agent", supports: { model: true, effort: true }, models: ["gpt-5.5"], effortLevels: ["low", "medium", "high"], allowsLanes: true },
  ], modelRegistry: [], defaultModel: "claude-opus-5-5[1m]" };
  const workplaces = () => ({ repos: [{ repo: REPO, branches: [], landNotes: { truncated: false }, reasons: [],
    worktrees: [{ path: REPO, primary: true, branch: "main", head: "a".repeat(40), base: null, distance: null, dirty: 0,
      session: { slot: 1, openedAt: 1000, taskId: null }, target: { branch: "main", head: null, behind: null, landed: null, landedAs: null, basis: "land-note" },
      checks: { local: null, preview: null, gate: null, audit: null }, template: null, testinstanz: null, reasons: [] }] }],
    stands: [], measuredAt: now, cacheMs: 60_000 });

  // the start doors as server.ts answers them; each success occupies the slot the started session lives in
  const answerPost = (p: string, body: Record<string, unknown>): { status: number; body: unknown } => {
    const lane = /^\/api\/slots\/(\d+)\/open-worktree$/.exec(p);
    const open = /^\/api\/slots\/(\d+)\/open$/.exec(p);
    if ((lane || p === "/api/lanes") && fx.move && body.plan) {
      fx.move = false;
      const old = (body.plan as { hash: string }).hash;
      fx.head = "fixture-head-moved";
      return { status: 409, body: { error: "the plan moved since the preview — nothing was started", staleHash: old } };
    }
    if (lane || p === "/api/lanes") {
      const id = lane ? Number(lane[1]) : firstFree();
      occupy(id, { cwd: `${REPO}.worktrees/lane-${id}`, label: null, worktree: { repo: REPO, branch: `fleet/lane-${id}` },
        model: body.model ?? null, effort: body.effort ?? null, harness: body.harness ?? "claude" });
      return { status: 200, body: { ok: true, slot: id } };
    }
    if (open) {
      const id = Number(open[1]);
      occupy(id, { cwd: body.cwd, label: body.label ?? null, model: body.model ?? null, effort: body.effort ?? null, ...(body.label === "Orchestrator" ? { role: "orchestrator" } : {}) });
      return { status: 200, body: { ok: true, slot: id, cwd: body.cwd, label: body.label ?? null } };
    }
    const boot = /^\/api\/programs\/([^/]+)\/bootstrap-main$/.exec(p);
    if (boot) {
      if (fx.bootstrap === "existing") return { status: 200, body: { ok: true, existing: true, program: { id: decodeURIComponent(boot[1]), main: { slot: 1, openedAt: 1000 } } } };
      if (fx.bootstrap === "refuse") return { status: 409, body: { error: "cannot bootstrap Program-MAIN for a complete program" } };
      if (fx.bootstrap === "pending") return { status: 503, body: { error: "Program-MAIN founding recovery is pending; retry did not open another slot",
        availability: "unknown", recovery: "pending", affected: { attemptId: "a".repeat(32), slot: 4, openedAt: 4000 } } };
      const id = firstFree();
      occupy(id, { cwd: body.cwd, label: "Program-MAIN: Fixture Frei", role: "program-main", model: body.model ?? null, effort: body.effort ?? null });
      return { status: 200, body: { ok: true, slot: id, program: { id: decodeURIComponent(boot[1]), main: { slot: id, openedAt: 5000 + id } } } };
    }
    if (p === "/api/branches") {
      if (fx.branchExists) return { status: 409, body: { error: "this name is taken in this repo", existing: { branch: "bau/uhr-alt", name: String(body.name) } } };
      return { status: 200, body: { ok: true, repo: body.repo, branch: "bau/uhr-in-der-statuszeile", path: `${REPO}.worktrees/uhr`, created: true, name: body.name } };
    }
    if (p === "/api/branches/open") {
      const id = firstFree();
      occupy(id, { cwd: `${REPO}.worktrees/${String(body.branch).replace(/\//g, "-")}`, label: null });
      return { status: 200, body: { ok: true, slot: id, openedAt: 5000 + id, goal: body.goal ? "follows" : null } };
    }
    return { status: 200, body: { ok: true } };
  };
  const START = /^\/api\/(slots\/\d+\/open(-worktree)?|lanes|programs\/[^/]+\/bootstrap-main|branches(\/open)?)$/;
  // the agent doors as server/agenten.ts answers them: save (POST), change (PUT /:id), copy (POST /:id/kopie)
  const answerAgent = (p: string, body: Record<string, unknown>): { status: number; body: unknown } => {
    const m = /^\/api\/agenten(?:\/([^/]+))?(\/kopie)?$/.exec(p);
    if (!m || m[1] === "import") return { status: 404, body: { error: "fixture: not served" } };
    const von = m[1] ? AGENTEN.find((x) => x.id === decodeURIComponent(m[1]!)) : undefined;
    const name = typeof body.name === "string" ? body.name : m[2] ? `copy of ${von?.name ?? "agent"}` : von?.name ?? "Agent";
    const wahlen = (body.wahlen ?? von?.wahlen ?? {}) as Record<string, unknown>;
    const id = m[1] && !m[2] ? m[1] : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { status: 200, body: { agent: { id, name, wahlen, agentMd: null, art: "eigen", aenderbar: true, quelle: "fixture", hash: hash(canon(wahlen)) } } };
  };

  const executable = process.env.FLEET_E2E_BROWSER ?? Bun.which("chromium") ?? Bun.which("chromium-browser") ?? Bun.which("google-chrome") ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!Bun.file(executable).size) { rmSync(scratch, { recursive: true, force: true }); throw new Error("k15 start DOM probe needs Chromium (FLEET_E2E_BROWSER): " + executable); }
  // a mouse whatever the machine (as e2e/konstellation.ts): the desktop is measured as a desktop on every host
  const pointer = "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4";
  const browser = Bun.spawn([executable, "--headless", "--password-store=basic", "--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--remote-debugging-port=0", pointer, `--user-data-dir=${scratch}/profile`, "about:blank"], { stdout: "ignore", stderr: "pipe" });
  let socket: WebSocket | undefined;
  try {
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    let startupLog = "";
    const endpoint = await Promise.race([
      (async () => { for await (const chunk of browser.stderr) { startupLog += new TextDecoder().decode(chunk); const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(startupLog); if (m) return m[1]; } throw new Error("browser exited before CDP endpoint: " + startupLog); })(),
      new Promise<never>((_, reject) => { startupTimer = setTimeout(() => reject(new Error("browser CDP startup timeout: " + startupLog)), 45000); }),
    ]).finally(() => clearTimeout(startupTimer));
    socket = new WebSocket(String(endpoint));
    await new Promise<void>((ok, bad) => { socket!.onopen = () => ok(); socket!.onerror = () => bad(new Error("CDP connection failed")); });
    let serial = 0, sessionId: string | undefined;
    let loaded: (() => void) | null = null;
    const pending = new Map<number, { ok: (v: Record<string, unknown>) => void; bad: (e: Error) => void }>();
    const send = (method: string, params: Record<string, unknown> = {}) => new Promise<Record<string, unknown>>((ok, bad) => {
      const id = ++serial;
      const timeout = setTimeout(() => { pending.delete(id); bad(new Error("CDP timeout: " + method)); }, 30000);
      pending.set(id, { ok: (v) => { clearTimeout(timeout); ok(v); }, bad: (e) => { clearTimeout(timeout); bad(e); } });
      socket!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const reply = (requestId: string, status: number, body: string, type = "application/json") =>
      send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "content-type", value: type }],
        body: Buffer.from(body).toString("base64") }).catch(() => undefined);
    const json = (requestId: string, value: unknown, status = 200) => reply(requestId, status, JSON.stringify(value));
    const serve = (requestId: string, request: { url: string; method: string; postData?: string }): Promise<unknown> => {
      const u = new URL(request.url);
      const p = u.pathname;
      if (request.method === "POST") {
        let body: Record<string, unknown> = {};
        try { body = JSON.parse(request.postData ?? "{}") as Record<string, unknown>; } catch { /* a beacon's blob: not a start */ }
        posts.push({ url: p, body });
        const a = START.test(p) ? answerPost(p, body) : p.startsWith("/api/agenten") ? answerAgent(p, body) : { status: 200, body: { ok: true } };
        return json(requestId, a.body, a.status);
      }
      if (request.method === "PUT" && p.startsWith("/api/agenten/")) {
        const a = answerAgent(p, JSON.parse(request.postData ?? "{}") as Record<string, unknown>);
        return json(requestId, a.body, a.status);
      }
      if (request.method === "PUT") return json(requestId, { ok: true });
      if (request.method === "DELETE") { deletes.push(p); return json(requestId, { ok: true }); }
      if (p === "/" || p === "/blank") return reply(requestId, 200, p === "/" ? indexHtml : "<!doctype html><title>blank</title>", "text/html");
      if (p === "/app.js") return reply(requestId, 200, appJs, "text/javascript");
      if (p === "/k15.js") return reply(requestId, 200, k15Js, "text/javascript");
      if (p === "/k15.css") return reply(requestId, 200, k15Css, "text/css");
      if (p === "/sitzung.css") return reply(requestId, 200, sitzungCss, "text/css");
      if (p === "/api/file") return json(requestId, { text: fileText(u.searchParams.get("path") ?? "") });
      if (p === "/api/sessions") return json(requestId, { now: Date.now(), chips: [], tasks: [], slots: slots(), instance: { name: "mac" }, programs: [] });
      if (p === "/api/harnesses") return json(requestId, KATALOG);
      if (p === "/api/agenten") return json(requestId, { agenten: AGENTEN.map((x) => x.id === "pruefer" ? { ...x, zuletzt: now - 3_600_000 } : x) });
      if (p === "/api/machine-settings") return json(requestId, { settings: [{ name: "FLEET_MIGRATE_PCT", value: 40 }, { name: "FLEET_LANE_MIGRATE_PCT", value: 37 },
        { name: "FLEET_MODEL", value: "claude-opus-5-5[1m]" }] });
      if (p === "/api/k15/eigenes") return json(requestId, { eigenes: { fassungen: [], packs: [], profile: [] } });
      if (p === "/api/dirs") return json(requestId, { path: "/fixture", parent: null, dirs: [], repos: [], git: false, pins: [] });
      // the fixture repo has no ci/merge-check.ts, as none of the owner's own repos (server.ts#hasMergeCheck)
      if (p === "/api/dirinfo" && fx.dirinfoHalt) return new Promise<void>((ok) => { haltend.push(() => { fx.dirinfoHalt = false; void serve(requestId, request).finally(() => ok()); }); });
      if (p === "/api/dirinfo") return json(requestId, { path: u.searchParams.get("path"), exists: true, git: fx.git, branch: fx.git ? fx.zweig : null, dirty: 0, orphans: [], mergeCheck: false, branches: fx.git && fx.branches });
      if (p === "/api/programs") { programReads++; return fx.programs === "fail" ? json(requestId, { error: "fixture: programs refused" }, 500) : json(requestId, PROGRAMS); }
      if (p === "/api/branches") return json(requestId, { repos: [{ repo: REPO, integration: "main", others: [], othersTotal: 0, reasons: [], branches: [] }] });
      if (p === "/api/worktrees") return fx.board ? json(requestId, workplaces()) : json(requestId, { error: "fixture: not served" }, 404);
      if (p === "/api/founding-plan" && fx.planHalt) return new Promise<void>((ok) => { haltend.push(() => { fx.planHalt = false; void serve(requestId, request).finally(() => ok()); }); });
      if (p === "/api/founding-plan") {
        planReads.push(Object.fromEntries(u.searchParams));
        if (fx.plan === "network") return send("Fetch.failRequest", { requestId, errorReason: "Failed" }).catch(() => undefined);
        if (fx.plan === "500") return json(requestId, { error: "fixture: the plan refused" }, 500);
        if (fx.plan === "malformed") return json(requestId, { selected: [{ id: "broken" }], omitted: [] });
        return json(requestId, planOf(u.searchParams));
      }
      return json(requestId, { error: "fixture: not served" }, 404);
    };
    socket.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as { id?: number; error?: unknown; result?: Record<string, unknown>; method?: string; params?: Record<string, unknown> };
      if (msg.id !== undefined) {
        const waiting = pending.get(msg.id); if (!waiting) return;
        pending.delete(msg.id);
        if (msg.error) waiting.bad(new Error(JSON.stringify(msg.error))); else waiting.ok(msg.result ?? {});
        return;
      }
      if (msg.method === "Page.loadEventFired") { const fire = loaded; loaded = null; fire?.(); return; }
      if (msg.method === "Page.javascriptDialogOpening") { void send("Page.handleJavaScriptDialog", { accept: false }).catch(() => undefined); return; }
      if (msg.method !== "Fetch.requestPaused" || !msg.params) return;
      const { requestId, request } = msg.params as { requestId: string; request: { url: string; method: string; postData?: string } };
      inflight++;
      void serve(requestId, request).finally(() => { inflight--; });
    };
    const evaluate = async <T>(expression: string): Promise<T> => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error("k15 start DOM probe: evaluate failed: " + JSON.stringify(r.exceptionDetails).slice(0, 300) + " — " + expression.replace(/\s+/g, " ").slice(0, 160));
      return (r.result as { value: T }).value;
    };
    const settle = (ms = 60) => evaluate(`new Promise(r => setTimeout(r, ${ms}))`);
    const navigate = async (to: string) => {
      const done = new Promise<void>((ok) => { loaded = ok; });
      await send("Page.navigate", { url: to });
      await Promise.race([done, Bun.sleep(15000)]);
    };
    const wait = async (condition: string, ms = 8000) => evaluate<boolean>(`new Promise((ok) => { const until = Date.now() + ${ms};
      const tick = () => { let v = false; try { v = !!(${condition}); } catch {} if (v) return ok(true); if (Date.now() > until) return ok(false); setTimeout(tick, 20); }; tick(); })`);
    // no request of the page is open for 250 ms: every read the window started has its answer
    const idle = async (ms = 8000) => {
      const until = Date.now() + ms;
      let quietSince = Date.now();
      while (Date.now() < until) {
        await Bun.sleep(25);
        if (inflight > 0) quietSince = Date.now();
        else if (Date.now() - quietSince >= 250) break;
      }
      await evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
    };
    const shot = async (name: string) => {
      if (!artifacts) return;
      const png = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      writeFileSync(resolve(artifacts, `${name}.png`), Buffer.from(String(png.data), "base64"));
    };
    // THE PRESS GOES TO A POINT, taken once the target holds still under it (the window repaints on its own late answers);
    // a press whose click never reached the target is pressed again, a disabled target fires none by design
    const pointOf = (expr: string) => evaluate<{ x: number; y: number; disabled: boolean } | null>(`new Promise((ok) => {
      const until = Date.now() + 5000; let last = '';
      const step = () => {
        let e = null; try { e = (${expr}); } catch {}
        if (!e) { if (Date.now() > until) return ok(null); return requestAnimationFrame(step); }
        e.scrollIntoView({ block: 'center', inline: 'nearest' }); const r = e.getBoundingClientRect();
        const p = { x: r.x + r.width / 2, y: r.y + r.height / 2 }, at = p.x + ',' + p.y, hit = document.elementFromPoint(p.x, p.y);
        if (at === last && hit && e.contains(hit) && r.width > 0) { window.__want = e; window.__hit = false; return ok({ ...p, disabled: !!e.closest(':disabled') }); }
        if (Date.now() > until) return ok(null); last = at; requestAnimationFrame(step); };
      step(); })`);
    const press = async (expr: string, how: "mouse" | "touch") => {
      for (let attempt = 1; ; attempt++) {
        const at = await pointOf(expr);
        if (!at) throw new Error(`no click target that holds still: ${expr.slice(0, 160)}`);
        if (how === "mouse") {
          await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
          for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: at.x, y: at.y, button: "left", clickCount: 1 });
        } else {
          await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: at.x, y: at.y }] });
          await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        }
        await evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
        if (at.disabled || await evaluate<boolean>("window.__hit === true")) return;
        if (attempt === 3) throw new Error(`click never reached its target in 3 presses: ${expr.slice(0, 160)}`);
      }
    };
    const click = (expr: string) => press(expr, "mouse");
    const tap = (expr: string) => press(expr, "touch");
    const type = async (expr: string, text: string) => { await click(expr); await send("Input.insertText", { text }); await settle(80); };
    // …and go on typing at the end of what a field holds, as one more input event
    const weiter = async (expr: string, text: string) => {
      await evaluate(`(() => { const f = ${expr}; f.focus(); f.setSelectionRange(f.value.length, f.value.length); })()`);
      await send("Input.insertText", { text }); await settle(80);
    };

    const WIN = "document.querySelector('#shell-found')";
    const shown = () => evaluate<string | null>("document.querySelector('#comptarget')?.dataset.slot ?? null");
    const open = () => evaluate<boolean>(`!!${WIN}`);
    const starts = () => posts.filter((x) => START.test(x.url));
    const hashFor = (role: string, d: { harness?: string; model?: string; effort?: string }, head = fx.head) =>
      hash(planKey(new URLSearchParams({ repo: REPO, role, ...d }), head));
    // a start's body without its fassung when that is the fassungsHash of a plan the window read that passes `pred` (a start carries the
    // one of the plan it showed); null otherwise
    const ohneFassung = (body: unknown, pred: (q: Record<string, string>) => boolean): unknown => {
      const { fassung, ...rest } = (body ?? {}) as Record<string, unknown>;
      return typeof fassung === "string" && planReads.filter(pred).some((q) => fassungKey(q, fx.head) === fassung) ? rest : null;
    };
    const fuerSitz = (body: unknown) => (q: Record<string, string>) => q.role === "nur-ordner" && q.sitz === (body as { sitz?: unknown } | null)?.sitz;

    const results: K15StartDomResult[] = [];
    let targetId = "";
    for (const [width, height, phone] of ([[1200, 900, false], [390, 844, true]] as const).filter(([w]) => !only.widths || only.widths.includes(w))) {
      // every claim of this width starts red: a case that throws leaves its claim false, never absent
      const claims: Record<string, boolean> = Object.fromEntries(Object.values(C).filter((c) => PHONE.has(c) === phone).map((c) => [c, false]));
      const facts: Record<string, unknown> = {};
      // A MUTANT ENDS WITH ITS OWN VERDICT: every claim is assigned exactly once, so the walk stops after the case that
      // assigned the mutated claim (K15VerdictIn), and every case before it ran as in the whole walk. A whole walk took
      // ~74 s per mutant on the Workhorse (38 mutants, 2 797 s, hand run 1024041054-nd-main).
      const assigned = new Set<string>();
      const verdicts = new Proxy(claims, { set: (t, k, v) => { t[String(k)] = v; assigned.add(String(k)); return true; } });
      // ONE CASE, A FRESH PAGE: the fixture's state, the recorded requests and the window's module state start empty
      const fresh = async (set: Partial<Fx> = {}) => {
        // an answer a case held and never let go is answered now: left open, it would keep every later idle() waiting its full time
        for (const go of haltend.splice(0)) go();
        fx = { ...fx0(), ...set };
        posts.length = 0; planReads.length = 0; deletes.length = 0; programReads = 0; started = null;
        if (targetId) { const old = targetId; sessionId = undefined; await send("Target.closeTarget", { targetId: old }).catch(() => undefined); }
        targetId = String((await send("Target.createTarget", { url: "about:blank" })).targetId);
        sessionId = String((await send("Target.attachToTarget", { targetId, flatten: true })).sessionId);
        await send("Fetch.enable", { patterns: [{ urlPattern: "http://fleet.fixture/*" }] });
        await send("Page.enable"); await send("Runtime.enable");
        await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };
          document.addEventListener('click', (ev) => { if (window.__want && ev.target instanceof Node && window.__want.contains(ev.target)) window.__hit = true; }, true);` });
        await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: phone });
        if (phone) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
        await navigate("http://fleet.fixture/blank");
        // the K15 tour has been seen (it opens once by itself and would stand over the foot); the board shows slot 1
        await evaluate(`(() => { localStorage.clear(); localStorage.setItem('fleet.view', JSON.stringify({ layout: 1, panes: [1], focused: 0 }));
          localStorage.setItem('fleet.board', ${JSON.stringify(fx.board ? "1" : "0")}); localStorage.setItem('fleet.k15.rundgang', '1'); })()`);
        await navigate("http://fleet.fixture/");
        if (!await wait(`document.querySelector('#comptarget')?.dataset.slot === '1' && !!document.querySelector('#slots .slot[data-slot="${FREE}"]')`, 15000))
          throw new Error(`the board never showed slot 1 and free slot ${FREE}: ` + await evaluate<string>("document.body.innerText.slice(0, 300)"));
        await idle();
      };
      // the start window from the free place, its agents read (src/start-fenster.ts, step 1)
      const fenster = async () => {
        await click(`document.querySelector('#slots .slot.empty[data-slot="${FREE}"]')`);
        if (!await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag')`, 10000)) throw new Error("the start window did not open with the repo's agent from the free place");
        await idle();
      };
      // …an agent picked: step 2, both previews read
      const mitAgent = async (id: string, how: "mouse" | "touch" = "mouse") => {
        await press(`${WIN}?.querySelector('.sfag[data-agent="${id}"]')`, how);
        if (!await wait(`!!${WIN}?.querySelector('.sf.s2 .sfgo')`, 10000)) throw new Error(`the agent ${id} did not open its session`);
        await idle();
      };
      // THE START WINDOW'S HEAD: what the sentence under Start says, and whether Start lets a start through
      const SFGO = `${WIN}?.querySelector('.sfgo')`;
      const sfKopf = () => evaluate<{ go: string | null; disabled: boolean | null; hint: string | null; warn: boolean }>(`({ go: ${SFGO}?.textContent ?? null,
        disabled: ${SFGO} ? ${SFGO}.disabled : null, hint: ${WIN}?.querySelector('.sfhint')?.textContent ?? null, warn: !!${WIN}?.querySelector('.sfhint.warn') })`);
      const sfStart = async () => { await click(SFGO); await wait(`!${WIN}`, 6000); await idle(); return starts(); };
      // a block of „Your Claude Code“ or „Fleet on top“ opened by its name, then one of its options; a block Fleet adds
      const block = async (id: string) => { await click(`${WIN}?.querySelector('.sftile[data-b="${id}"] :is(.sftn, .sfsn)')`); await idle(); };
      const option = async (set: string) => { await click(`${WIN}?.querySelector('.sfopt[data-set="${set}"]')`); await idle(); };
      // a stone of Fleet on top switched on or off
      const dazu = async (id: string) => { await click(`${WIN}?.querySelector('.sftile[data-b="${id}"] .sfsw')`); await idle(); };
      // the start brief opens over the session at this width
      const briefAuf = async () => {
        if (!await evaluate<boolean>(`!!${WIN}?.querySelector('.sfhood.show')`)) await click(`${WIN}?.querySelector('.sfbriefbtn')`);
        await wait(`!!${WIN}?.querySelector('.sfhood.show')`, 3000); await idle();
      };
      const briefZu = async () => { await click(`${WIN}?.querySelector('.sfhood .sfhclose')`); await wait(`!${WIN}?.querySelector('.sfhood.show')`, 3000); await idle(); };
      const banner = () => evaluate<{ art: string; h3: string; p: string; chips: string[]; nichts: boolean; markiert: number; legende: boolean }>(`(() => { const b = ${WIN}?.querySelector('.sfbanner');
        return { art: b ? (['dev', 'fleet'].find((c) => b.classList.contains(c)) ?? 'ok') : 'none', h3: b?.querySelector('h3')?.textContent ?? '',
          p: b?.querySelector('p')?.textContent ?? '', chips: [...(b?.querySelectorAll('.sfdchip') ?? [])].map((c) => c.dataset.dev + ':' + c.textContent),
          nichts: !!${WIN}?.querySelector('.sfhb .sfnone'), markiert: ${WIN}?.querySelectorAll('.sfhb .sfbk.hl').length ?? -1,
          legende: !!${WIN}?.querySelector('.sfhh .sflegend') && !!${WIN}?.querySelector('.sfhh [data-only="1"]') }; })()`);
      // the start window's preview reads: role nur-ordner on the fixture repo, each with the fields beside repo, role and anlass
      const vorschauen = () => planReads.filter((q) => q.role === "nur-ordner" && q.repo === REPO && q.anlass === "neu")
        .map((q) => Object.fromEntries(Object.entries(q).filter(([k]) => !["repo", "role", "anlass"].includes(k))));
      // the fassungsHash of the last of them whose fields pass `pred`; null when the window never read one
      const fassungDerVorschau = (pred: (q: Record<string, string>) => boolean): string | null => {
        const q = vorschauen().filter(pred).pop();
        return q ? fassungKey({ repo: REPO, role: "nur-ordner", anlass: "neu", ...q }, fx.head) : null;
      };
      const caseOf = async (name: string, run: () => Promise<void>) => {
        try { await run(); } catch (e) { if (e instanceof K15VerdictIn) throw e; facts[`${name}:error`] = e instanceof Error ? e.message : String(e); }
        if (artifacts) await shot(`k15-start-${width}-${name}`).catch(() => undefined);
        if (only.mutate && assigned.has(only.mutate.claim)) throw new K15VerdictIn([...results, { width, height, claims, facts }]);
      };

      if (phone) {
        // the Sessions sheet's „Neue Session“: the start window, the session of the repo's agent, the start brief below it, a start
        await caseOf("open-phone", async () => {
          await fresh();
          await tap("document.querySelector('#mpill')");
          await tap("document.querySelector('#mslot')");
          await wait("!!document.querySelector('#msheet .mshnew')", 3000);
          await settle(250);
          await tap("document.querySelector('#msheet .mshnew')");
          const ok = await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag')`, 10000);
          await idle();
          if (ok) await mitAgent("repo", "touch");
          const blick = await evaluate<{ go: boolean; zonen: boolean; brief: boolean; unter: boolean; repos: boolean; breit: number; schirm: number; old: number }>(`(() => {
            const sieht = (e) => !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
            const go = ${WIN}?.querySelector('.sfgo'), sheet = ${WIN}?.querySelector('.sfsheet'), hood = ${WIN}?.querySelector('.sfhood'), sf = ${WIN}?.querySelector('.sf');
            const r = go?.getBoundingClientRect();
            return { go: sieht(go) && !!r && r.left >= 0 && r.right <= innerWidth, zonen: sieht(${WIN}?.querySelector('.sfzone.cc')) && sieht(${WIN}?.querySelector('.sfzone.fl')),
              brief: sieht(hood) && !!hood.querySelector('.sfbk'), unter: !!sheet && !!hood && hood.getBoundingClientRect().top >= sheet.getBoundingClientRect().bottom - 1,
              repos: sieht(${WIN}?.querySelector('.sfrepos')), breit: Math.max(sf?.scrollWidth ?? 0, document.documentElement.scrollWidth), schirm: innerWidth,
              old: document.querySelectorAll('.fdgo, .fdkind, .k15go').length }; })()`);
          await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
          await tap(SFGO);
          await wait(`!${WIN}`, 6000); await idle();
          const s = starts();
          const z = { open: await open(), shown: await shown() };
          facts.openPhone = { ok, blick, posts: s, ...z, started };
          verdicts[C.openPhone] = ok && blick.go && blick.zonen && blick.brief && blick.unter && !blick.repos && blick.breit <= blick.schirm && blick.old === 0
            && s.length === 1 && /^\/api\/slots\/\d+\/open$/.test(s[0]!.url) && (s[0]!.body as { cwd?: unknown }).cwd === REPO
            && started !== null && !z.open && z.shown === String(started);
        });
        results.push({ width, height, claims, facts });
        continue;
      }

      // THE START WINDOW (owner 24.10.): it opens from the free place; the repo's agent as it is, Rules „[Zitat entfernt]“ with the start
      // brief, back to normal, Rules only again, Start
      const WEG = { claudeMd: true, rules: true };
      const nurWeg = (q: Record<string, string>) => Object.keys(q).join() === "weglassen" && canon(JSON.parse(q.weglassen!)) === canon(WEG);
      const startChecks: boolean[] = [];
      await caseOf("fenster", async () => {
        await fresh();
        await click(`document.querySelector('#slots .slot.empty[data-slot="${FREE}"]')`);
        const ok = await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag')`, 10000);
        await idle();
        const seen = await evaluate<{ sitz: boolean; titel: string | null; repo: string | null; agenten: string[]; old: number; aufbau: number; knopf: number }>(`({
          sitz: !!document.querySelector('#shell-found.k15sitz .sf.s1'), titel: ${WIN}?.querySelector('.shellhead h2')?.textContent ?? null,
          repo: ${WIN}?.querySelector('.sfrepo.sel')?.dataset.repo ?? null, agenten: [...(${WIN}?.querySelectorAll('.sfag') ?? [])].map((b) => b.dataset.agent),
          old: document.querySelectorAll('.fdgo, .fdkind').length, aufbau: document.querySelectorAll('.k15go').length,
          knopf: document.querySelectorAll('.sfaufbau').length + [...document.querySelectorAll('#shell-found button')].filter((b) => b.textContent.includes('Lanes, MAIN')).length })`);
        facts.open = { ok, ...seen };
        verdicts[C.open] = ok && seen.sitz && seen.titel === "New session" && seen.repo === REPO && seen.agenten[0] === "repo"
          && seen.agenten.includes("pruefer") && seen.old === 0 && seen.aufbau === 0 && seen.knopf === 0;
        await mitAgent("repo");
        const normal = await banner();
        // Succession where the place already hands over at its mark: on, the mark its choice, nothing to switch
        const nachfolge = await evaluate<{ schalter: boolean; wert: string }>(`(() => { const t = ${WIN}?.querySelector('.sftile[data-b="succession"]');
          return { schalter: !t || !!t.querySelector('.sfsw'), wert: t?.querySelector('.sfpk')?.firstChild?.textContent ?? '' }; })()`);
        await block("rules");
        await option("rules:nein");
        const amber = await banner();
        // the start brief: your CLAUDE.md one mark while closed, its text as Markdown when open, its lines one click behind; the repo's AGENTS.md as it is
        await briefAuf();
        const MD = `${WIN}?.querySelector('.sfbk[data-ob="regel:${HOME}/.claude/CLAUDE.md"]')`;
        const datei = () => evaluate<{ chg: boolean; zeichen: string; del: string[]; plus: number; mehr: string | null; md: string[]; repo: boolean | null; home: boolean | null; liste: Record<string, string> }>(`(() => { const b = ${MD};
          const r = ${WIN}?.querySelector('.sfbk[data-ob="regel:${REPO}/AGENTS.md"]'), h = ${WIN}?.querySelector('.sfbk[data-ob="regel:${HOME}/AGENTS.md"]');
          return { chg: !!b?.classList.contains('chg'), zeichen: b?.querySelector('.sfbk-h .sfdm')?.textContent ?? '',
            del: [...(b?.querySelectorAll('.sfln.del .sft') ?? [])].map((x) => x.textContent), plus: b?.querySelectorAll('.sfln.add').length ?? -1,
            mehr: b?.querySelector('.sfmore')?.textContent ?? null, md: [...(b?.querySelectorAll('.sfmd .mdp') ?? [])].map((x) => x.textContent), repo: r ? r.classList.contains('chg') : null, home: h ? h.classList.contains('chg') : null,
            liste: Object.fromEntries([...(${WIN}?.querySelectorAll('.sftile[data-b="rules"] .sffiles [data-ziel]') ?? [])].map((r) => [r.dataset.ziel, r.textContent])) }; })()`);
        const zu = await datei();
        await click(`${MD}?.querySelector('.sfbk-h')`); await idle();
        const auf = await datei();
        await click(`${MD}?.querySelector('.sfmore')`); await idle();
        const zeilenAuf = await datei();
        const soll = fileText(`${HOME}/.claude/CLAUDE.md`).split("\n");
        facts.brief = { zu, auf, zeilenAuf };
        verdicts[C.brief] = zu.chg && zu.zeichen === "−" && zu.del.length === 0 && zu.plus === 0 && zu.mehr === null && zu.md.length === 0
          && zu.repo === false && zu.home === false && JSON.stringify(auf.md) === JSON.stringify([soll.join(" ")]) && auf.del.length === 0
          && auf.mehr === "Show its 40 lines" && JSON.stringify(zeilenAuf.del) === JSON.stringify(soll) && zeilenAuf.mehr === "Show as text"
          && !!zu.liste[`regel:${HOME}/.claude/CLAUDE.md`]?.endsWith("left out") && !!zu.liste[`regel:${HOME}/AGENTS.md`]?.endsWith("read at the start");
        await briefZu();
        await click(`${WIN}?.querySelector('.sfbanner [data-normal="1"]')`); await idle();
        const zurueck = await banner();
        facts.banner = { normal, nachfolge, amber, zurueck };
        verdicts[C.banner] = normal.art === "none" && normal.nichts && !normal.legende && !nachfolge.schalter && nachfolge.wert === "At 40 %"
          && amber.art === "dev" && amber.h3 === "1 change from your normal Claude Code" && JSON.stringify(amber.chips) === JSON.stringify(["rules:−Your rules left out"])
          && !amber.nichts && amber.legende && zurueck.art === "none" && zurueck.nichts && zurueck.markiert === 0 && !zurueck.legende;
        const gelesen = vorschauen();
        facts.vorschau = gelesen;
        verdicts[C.vorschau] = gelesen.some((q) => Object.keys(q).length === 0) && gelesen.some(nurWeg)
          && gelesen.every((q) => Object.keys(q).length === 0 || nurWeg(q));
        await block("rules");
        await option("rules:nein");
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const h = fassungDerVorschau(nurWeg);
        const s = await sfStart();
        const z = { open: await open(), shown: await shown() };
        facts.startRegeln = { posts: s, expect: h, ...z, started };
        startChecks.push(h !== null && s.length === 1 && s[0]!.url === `/api/slots/${FREE}/open` && canon(s[0]!.body) === canon({ cwd: REPO, fassung: h, weglassen: WEG }));
        facts.zu = { ...z, started };
        verdicts[C.zu] = s.length === 1 && started !== null && !z.open && z.shown === String(started);
      });
      // the repo's agent with nothing changed, its plan startable
      await caseOf("start-normal", async () => {
        await fresh({ ordnerStartbar: true });
        await fenster();
        await mitAgent("repo");
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const h = fassungDerVorschau((q) => Object.keys(q).length === 0);
        const s = await sfStart();
        facts.startNormal = { posts: s, expect: h };
        startChecks.push(h !== null && s.length === 1 && s[0]!.url === `/api/slots/${FREE}/open`
          && canon(s[0]!.body) === canon({ cwd: REPO, fassung: h, plan: { hash: hashFor("nur-ordner", {}), role: "nur-ordner" } }));
        verdicts[C.start] = startChecks.length === 2 && startChecks.every(Boolean);
      });

      // „+ Rights“ from Fleet on top: Builds, then Looks only in its block; the preview, the start brief and the start carry it
      await caseOf("rechte", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        await dazu("rights");
        const stufe = await evaluate<string>(`${WIN}?.querySelector('select[data-k="rights"]')?.selectedOptions[0]?.textContent ?? ''`);
        await block("rights");
        await option("rights:lesen");
        const mit = (st: string) => (q: Record<string, string>) => Object.keys(q).join() === "rechte" && canon(JSON.parse(q.rechte!)) === canon({ stufe: st, an: [], aus: [] });
        const gelesen = { bauen: vorschauen().some(mit("bauen")), lesen: vorschauen().some(mit("lesen")) };
        await briefAuf();
        await click(`${WIN}?.querySelector('.sfbk[data-ob="rechte"] .sfbk-h')`); await idle();
        const satz = await evaluate<{ zeichen: string; text: string } | null>(`(() => { const k = ${WIN}?.querySelector('.sfbk[data-ob="rechte"]');
          return k ? { zeichen: k.querySelector('.sfdm')?.textContent ?? '', text: k.querySelector('.sfmd')?.textContent ?? '' } : null; })()`);
        await briefZu();
        const h = fassungDerVorschau(mit("lesen"));
        const s = await sfStart();
        facts.rechte = { stufe, gelesen, satz, posts: s, expect: h };
        verdicts[C.rechte] = stufe === "Builds" && gelesen.bauen && gelesen.lesen && satz?.zeichen === "+" && satz.text.startsWith("FLEET RIGHTS (level “read only”")
          && h !== null && s.length === 1 && canon(s[0]!.body) === canon({ cwd: REPO, fassung: h, rechte: { stufe: "lesen", an: [], aus: [] } });
      });

      // EACH CONTEXT PACK A STONE (owner 25.10.: „[Zitat entfernt]“): rows under Fleet on top, a switch each; one
      // switched on goes into the preview, the start brief, the banner and the start as exactly that pack
      await caseOf("packs", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        // each kind under „What it knows“ with the stones that follow its name
        const reihen = () => evaluate<{ reihe: string; packs: { id: string; an: string | null }[] }[]>(`[...(${WIN}?.querySelectorAll('.sfzone.fl .sfpart') ?? [])]
          .filter((p) => p.querySelector('.sfplabel')?.textContent === 'What it knows').flatMap((p) => [...p.querySelectorAll('.sfart')].map((a) => ({
          reihe: a.querySelector('b')?.textContent ?? '', packs: [...(a.nextElementSibling?.querySelectorAll('.sftile[data-b^="pack:"]') ?? [])].map((t) => ({ id: t.dataset.b, an: t.querySelector('.sfsw')?.getAttribute('aria-checked') ?? null })) })))`);
        const banner = () => evaluate<{ dev: boolean; chips: string[] }>(`(() => { const b = ${WIN}?.querySelector('.sfbanner');
          return { dev: !!b?.classList.contains('dev'), chips: [...(b?.querySelectorAll('.sfdchip') ?? [])].map((c) => c.textContent) }; })()`);
        const schalte = async (id: string) => { await click(`${WIN}?.querySelector('.sftile[data-b="pack:${id}"] .sfsw')`); await idle(); };
        const vorher = await reihen();
        await schalte("who-it-is-for");
        const an = { reihen: await reihen(), banner: await banner() };
        await schalte("who-it-is-for");
        const wieder = await banner();
        await schalte("who-it-is-for");
        const nur = (q: Record<string, string>) => Object.keys(q).join() === "bibliothek" && q.bibliothek === "who-it-is-for";
        const gelesen = vorschauen().some(nur);
        await briefAuf();
        await click(`${WIN}?.querySelector('.sfbk[data-ob="pack:who-it-is-for"] .sfbk-h')`); await idle();
        const teil = await evaluate<{ zeichen: string; text: string; gruppe: boolean; moment: string } | null>(`(() => { const k = ${WIN}?.querySelector('.sfbk[data-ob="pack:who-it-is-for"]');
          return k ? { zeichen: k.querySelector('.sfdm')?.textContent ?? '', text: k.querySelector('.sfmd .mdh')?.textContent ?? '', gruppe: !!k.parentElement?.closest('.sfbk'),
            moment: k.closest('.sfbsec')?.dataset.key ?? '' } : null; })()`);
        await briefZu();
        const h = fassungDerVorschau(nur);
        const st = await sfStart();
        facts.packs = { vorher, an, wieder, gelesen, teil, posts: st, expect: h };
        const reihe = (r: typeof vorher, wort: string) => r.find((x) => x.reihe === wort)?.packs ?? [];
        verdicts[C.packs] = canon(reihe(vorher, "Context packs")) === canon([{ id: "pack:who-it-is-for", an: "false" }, { id: "pack:testinstanz-abnahme", an: "false" }])
          && canon(reihe(vorher, "Concepts")) === canon([{ id: "pack:system-concept", an: "false" }])
          && reihe(an.reihen, "Context packs")[0]?.an === "true" && an.banner.dev && canon(an.banner.chips) === canon(["+Context pack: Who it is for"])
          && !wieder.dev && wieder.chips.length === 0 && gelesen && teil?.zeichen === "+" && teil.text === "Who it is for" && !teil.gruppe && teil.moment === "With every request"
          && h !== null && st.length === 1 && canon(st[0]!.body) === canon({ cwd: REPO, fassung: h, bibliothek: ["who-it-is-for"] });
      });

      // CONNECTORS AS A CHOICE (owner 26.10., „[Zitat entfernt]“: the MCP servers at one place): the measured servers ticked, one unticked goes to
      // the preview, the banner and the start as weglassen.mcp; the block says what holds later in the session
      await caseOf("connectors", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        await click(`${WIN}?.querySelector('.sftile[data-b="connectors"] .sfopener')`); await idle();
        const liste = () => evaluate<{ server: string[]; mcp: boolean; kachel: string }>(`({
          server: [...(${WIN}?.querySelectorAll('.sfdrawer .sfcheck') ?? [])].map((b) => b.dataset.server + ':' + b.getAttribute('aria-checked') + ':' + (b.lastElementChild?.textContent ?? '')),
          mcp: (${WIN}?.querySelector('.sfdrawer .sfoffnote')?.textContent ?? '').includes('/mcp turns a server on or off'),
          kachel: ${WIN}?.querySelector('.sftile[data-b="connectors"] .sfopener')?.firstChild?.textContent ?? '' })`);
        const vorher = await liste();
        await click(`${WIN}?.querySelector('.sfcheck[data-server="claude_ai_Gmail"]')`); await idle();
        const nachher = await liste(), b = await banner();
        const MCP = (q: Record<string, string>) => Object.keys(q).join() === "weglassen" && canon(JSON.parse(q.weglassen!)) === canon({ mcp: ["claude_ai_Gmail"] });
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const gelesen = vorschauen().some(MCP), h = fassungDerVorschau(MCP);
        const s = await sfStart();
        facts.connectors = { vorher, nachher, banner: b.chips, gelesen, posts: s, expect: h };
        verdicts[C.connectors] = canon(vorher.server) === canon(["claude_ai_Gmail:true:claude.ai", "plugin_playwright_playwright:true:plugin"]) && vorher.mcp
          && vorher.kachel === "2 servers" && nachher.server[0] === "claude_ai_Gmail:false:claude.ai" && nachher.kachel === "1 of 2 servers"
          && canon(b.chips) === canon(["connectors:−Connectors: 1 left out"]) && gelesen
          && h !== null && s.length === 1 && canon(s[0]!.body) === canon({ cwd: REPO, fassung: h, weglassen: { mcp: ["claude_ai_Gmail"] } });
      });

      // PLAN FIRST, a choice of its own beside Asks you (owner 25.10. 19:50): Asks you offers four, Plan first goes as the plan mode
      await caseOf("plan", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        const fragt = await evaluate<string[]>(`[...(${WIN}?.querySelector('select[data-k="permissions"]')?.options ?? [])].map((o) => o.value)`);
        await evaluate(`(() => { const x = ${WIN}?.querySelector('select[data-k="plan"]'); x.value = 'an'; x.dispatchEvent(new Event('change')); })()`);
        await idle();
        const b = await banner();
        const PLAN = (q: Record<string, string>) => Object.keys(q).join() === "permissionMode" && q.permissionMode === "plan";
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const gelesen = vorschauen().some(PLAN), h = fassungDerVorschau(PLAN);
        const s = await sfStart();
        facts.plan = { fragt, banner: b.chips, gelesen, posts: s, expect: h };
        verdicts[C.plan] = canon(fragt) === canon(["", "manual", "acceptEdits", "auto", "dontAsk"]) && canon(b.chips) === canon(["plan:+Plan first"])
          && gelesen && h !== null && s.length === 1 && canon(s[0]!.body) === canon({ cwd: REPO, fassung: h, permissionMode: "plan" });
      });

      // the stone Branch & land in a repo without a merge check: its commits on their own branch, no land promised
      await caseOf("ohne-check", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        const knopf = await evaluate<string>(`${WIN}?.querySelector('.sftile[data-b="branch"] .sfts')?.textContent ?? ''`);
        await dazu("branch");
        const satz = await evaluate<string>(`${WIN}?.querySelector('.sftile[data-b="branch"] .sfts')?.textContent ?? ''`);
        await block("branch");
        const lade = await evaluate<string>(`${WIN}?.querySelector('.sfdrawer .sfgit')?.textContent ?? ''`);
        facts.ohneCheck = { knopf, satz, lade };
        verdicts[C.ohneCheck] = knopf.includes("you bring its commits back yourself") && !knopf.includes("brings its work back")
          && satz === "No merge check here: it lands only when you say so, unchecked."
          && lade.includes("only when you say so, in one commit and without a check: this repo has no merge check (ci/merge-check.ts)");
      });

      // THE ARROW (owner 25.10.: „[Zitat entfernt]“): wide, Rules opens with one sentence and an arrow
      // to each of its parts in the start brief — its rule files and the start line, nothing else; closed, they go; at 1200 a link instead
      await caseOf("pfeil", async () => {
        await fresh();
        await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
        await fenster();
        await mitAgent("repo");
        await block("rules");
        await wait(`(${WIN}?.querySelectorAll('svg.sfpfeil path:not(.tip)').length ?? 0) > 0`, 3000);
        const lies = () => evaluate<{ satz: string; zweite: number; link: number; enden: string[]; teile: string[] }>(`(() => {
          const w = ${WIN}, d = w?.querySelector('.sfdrawer'), hb = w?.querySelector('.sfhb')?.getBoundingClientRect();
          const bks = [...(w?.querySelectorAll('.sfhb > .sfbsec > .sfbk') ?? [])];
          // where each arrow ends: the start brief's part whose head sits there, a few pixels right of the arrow's tip
          const enden = [...(w?.querySelectorAll('svg.sfpfeil path:not(.tip)') ?? [])].map((p) => {
            const o = p.ownerSVGElement.getBoundingClientRect(), e = p.getAttribute('d').split(' ').pop().split(',').map(Number), x = e[0] + o.left, y = e[1] + o.top;
            const hit = bks.find((b) => { const r = b.getBoundingClientRect(); return x < r.left && r.left - x <= 8 && y >= r.top && y <= r.bottom; });
            return hit ? hit.dataset.ob : 'nowhere'; });
          const sicht = (b) => { const r = b.getBoundingClientRect(); return hb && r.top >= hb.top && r.top + 20 <= hb.bottom; };
          return { satz: d?.querySelector('.sfdh span')?.textContent ?? '', zweite: d ? d.querySelectorAll('.sfhow').length : -1, link: d ? d.querySelectorAll('.sftoright').length : -1,
            enden, teile: bks.filter((b) => sicht(b) && b.dataset.ob.startsWith('regel:')).map((b) => b.dataset.ob) };
        })()`);
        const auf = await lies();
        await click(`${WIN}?.querySelector('.sfdrawer .sfcl')`); await idle();
        const zu = await lies();
        await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: phone });
        await idle();
        await block("rules");
        const schmal = await lies();
        facts.pfeil = { auf, zu: zu.enden, schmal: { enden: schmal.enden, link: schmal.link } };
        const saetze = (auf.satz.match(/[.!?](\s|$)/g) ?? []).length;
        verdicts[C.pfeil] = saetze === 1 && auf.zweite === 0 && auf.link === 0 && auf.teile.length >= 2
          && auf.enden.length === auf.teile.length && auf.teile.every((t) => auf.enden.includes(t)) && auf.enden.every((e) => auf.teile.includes(e))
          && zu.enden.length === 0 && schmal.enden.length === 0 && schmal.link === 1;
      });

      // a press that answers redraw under: the dirinfo answers wait, the button goes down on the repo's agent, they arrive, it comes up
      await caseOf("druck", async () => {
        await fresh({ dirinfoHalt: true });
        await click(`document.querySelector('#slots .slot.empty[data-slot="${FREE}"]')`);
        if (!await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag')`, 10000)) throw new Error("the start window did not open with the repo's agent");
        const at = await pointOf(`${WIN}?.querySelector('.sf .sfag.repoag')`);
        if (!at) throw new Error("the repo's agent holds no still point");
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x: at.x, y: at.y, button: "left", clickCount: 1 });
        // the morph would keep the click through a redraw as well (claim ruhig), so the release alone proves no wait: the held answer's
        // folder facts must not stand in the repo column, and the pressed button must be the same element, until the release
        await evaluate(`(() => { window.__ag = ${WIN}?.querySelector('.sf .sfag.repoag'); window.__vor = ${WIN}?.querySelector('.sfrepo.sel')?.textContent ?? ''; })()`);
        const gehalten = haltend.length;
        for (const go of haltend.splice(0)) go();
        await settle(300);
        const zwischen = await evaluate<{ gezeichnet: boolean; derselbe: boolean; vor: string; nach: string }>(`({ gezeichnet: (${WIN}?.querySelector('.sfrepo.sel')?.textContent ?? '') !== window.__vor,
          derselbe: !!window.__ag && window.__ag === ${WIN}?.querySelector('.sf .sfag.repoag'), vor: window.__vor, nach: ${WIN}?.querySelector('.sfrepo.sel')?.textContent ?? '' })`);
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: at.x, y: at.y, button: "left", clickCount: 1 });
        const auf = await wait(`!!${WIN}?.querySelector('.sf.s2 .sfgo')`, 4000);
        facts.druck = { gehalten, ...zwischen, auf };
        verdicts[C.druck] = gehalten > 0 && !zwischen.gezeichnet && zwischen.derselbe && auf;
      });

      // a change of Rules, watched: what stays the same element, and where anything changed until the preview arrived
      await caseOf("ruhig", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        await block("rules");
        await evaluate(`(() => { const w = ${WIN};
          window.__marks = [...w.querySelectorAll('.sf, .sfcol, .sfrepo, .sfzone, .sfbanner, .sfhero, .sftile:not([data-b="rules"])')];
          window.__bk = [...w.querySelectorAll('.sfhb .sfbk')].map((e) => [e, e.dataset.ob, e.textContent]);
          window.__rec = []; window.__raus = [];
          window.__obs = new MutationObserver((ms) => { for (const m of ms) {
            for (const x of m.removedNodes) if (x.nodeType === 1) window.__raus.push(x);
            const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
            if ([...m.addedNodes, ...m.removedNodes].some((x) => x.nodeType === 1 && x.matches('.sfbanner'))) { window.__rec.push('banner'); continue; }
            window.__rec.push(t.closest('.sfrepos') ? 'repos' : t.closest('.sftile[data-b="rules"]') ? 'rules' : t.closest('.sftile') ? 'tile:' + t.closest('.sftile').dataset.b
              : t.closest('.sfbanner') ? 'banner' : t.closest('.sfdrawer') ? 'drawer' : t.closest('.sfhero') ? 'hero' : t.closest('.sfhood') ? 'brief'
              : t.closest('.sfzh') ? 'zone-head'
              : m.type === 'attributes' && m.attributeName === 'class' && t.matches('.sfcol') ? 'col-class' : 'other:' + (t.getAttribute('class') || t.nodeName)); } });
          window.__obs.observe(w, { subtree: true, childList: true, attributes: true, characterData: true }); })()`);
        await option("rules:nein");
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const r = await evaluate<{ wo: Record<string, number>; weg: number; marks: number; bloecke: number; gleich: number; neu: string[]; bewegt: string[] }>(`(() => {
          window.__obs.disconnect(); const wo = {};
          for (const x of window.__rec) wo[x] = (wo[x] ?? 0) + 1;
          const jetzt = new Map([...${WIN}.querySelectorAll('.sfhb .sfbk')].map((e) => [e.dataset.ob, e]));
          const gleich = window.__bk.filter(([, k, t]) => jetzt.get(k)?.textContent === t);
          return { wo, weg: window.__marks.filter((e) => !e.isConnected).length, marks: window.__marks.length, bloecke: window.__bk.length, gleich: gleich.length,
            neu: gleich.filter(([e, k]) => jetzt.get(k) !== e).map(([, k]) => k),
            bewegt: window.__raus.filter((e) => e.isConnected).map((e) => e.getAttribute('class') ?? e.nodeName) }; })()`);
        // the tile that stayed carries the handler of the last drawing: a second click closes its block
        await block("rules");
        const zu = await evaluate<boolean>(`!${WIN}?.querySelector('.sfdrawer')`);
        // a Fleet tile that comes in front of the additions leaves them where they are
        const adds = await evaluate<number>(`(window.__adds = [...${WIN}.querySelectorAll('.sftile.stein:not([data-b="rights"])')]).length`);
        await dazu("rights");
        const addsWeg = await evaluate<number>("window.__adds.filter((e) => !e.isConnected).length");
        facts.ruhig = { ...r, zu, adds, addsWeg };
        const erlaubt = new Set(["rules", "banner", "drawer", "hero", "brief", "zone-head", "col-class"]);
        verdicts[C.ruhig] = r.marks > 10 && r.weg === 0 && Object.keys(r.wo).every((k) => erlaubt.has(k)) && (r.wo.banner ?? 0) > 0 && (r.wo.brief ?? 0) > 0
          && r.gleich > 3 && r.gleich < r.bloecke && r.neu.length === 0 && r.bewegt.length === 0 && zu && adds > 2 && addsWeg === 0;
      });

      // a new choice while its preview is read: Start waits for it and the brief says it is comparing; then the change, and its hash
      await caseOf("laden", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        await block("rules");
        fx.planHalt = true;
        await click(`${WIN}?.querySelector('.sfopt[data-set="rules:nein"]')`);
        await settle(200);
        const kopf = await sfKopf();
        await click(SFGO);
        await settle(200);
        const gesendet = starts().length;
        // a start that went through while the preview loaded has its verdict here: the window is gone
        if (kopf.disabled !== true || gesendet !== 0) { facts.laden = { kopf, gesendet }; verdicts[C.laden] = false; return; }
        if (!await evaluate<boolean>(`!!${WIN}?.querySelector('.sfhood.show')`)) await click(`${WIN}?.querySelector('.sfbriefbtn')`);
        await wait(`!!${WIN}?.querySelector('.sfhood.show')`, 3000);
        const MD = `${WIN}?.querySelector('.sfbk.chg[data-ob="regel:${HOME}/.claude/CLAUDE.md"]')`;
        const rechts = () => evaluate<{ comparing: boolean; nichts: boolean; md: boolean }>(`({ comparing: [...(${WIN}?.querySelectorAll('.sfhb .sfleer') ?? [])]
          .some((x) => x.textContent === 'Comparing …'), nichts: !!${WIN}?.querySelector('.sfhb .sfnone'), md: !!${MD} })`);
        const zwischen = await rechts(), b = await banner(), gehalten = haltend.length;
        for (const go of haltend.splice(0)) go();
        await idle();
        const nach = await rechts();
        await briefZu();
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const h = fassungDerVorschau(nurWeg);
        const s = await sfStart();
        facts.laden = { kopf, gesendet, zwischen, banner: b.h3, gehalten, nach, posts: s, expect: h };
        verdicts[C.laden] = gehalten > 0 && kopf.disabled === true && kopf.hint === "Reading what this session gets …" && gesendet === 0
          && zwischen.comparing && !zwischen.nichts && b.h3 === "1 change from your normal Claude Code" && !nach.comparing && nach.md
          && h !== null && s.length === 1 && canon(s[0]!.body) === canon({ cwd: REPO, fassung: h, weglassen: WEG });
      });

      // „+ First task“: the goal goes to the door with the start
      await caseOf("aufgabe", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        await dazu("task");
        await type(`${WIN}?.querySelector('[data-feld="aufgabe"]')`, "Die Uhr ");
        await idle();
        await weiter(`${WIN}?.querySelector('[data-feld="aufgabe"]')`, "steht rechts.");
        await idle();
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const h = fassungDerVorschau((q) => Object.keys(q).length === 0);
        const s = await sfStart();
        facts.aufgabe = { posts: s, expect: h };
        verdicts[C.aufgabe] = h !== null && s.length === 1 && s[0]!.url === `/api/slots/${FREE}/open`
          && canon(s[0]!.body) === canon({ cwd: REPO, fassung: h, goal: "Die Uhr steht rechts." });
      });

      // „+ Branch & land“ from the window: no name, no start; with one, the branch door twice and never the checkout's
      await caseOf("branch-start", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        await dazu("branch");
        const ohne = await sfKopf();
        await click(SFGO);
        await settle(150);
        const sentOhne = starts().length;
        await type(`${WIN}?.querySelector('[data-feld="branch"]')`, "Uhr in der ");
        await idle();
        await weiter(`${WIN}?.querySelector('[data-feld="branch"]')`, "Statuszeile");
        await dazu("rights");
        await dazu("task");
        await type(`${WIN}?.querySelector('[data-feld="aufgabe"]')`, "Die Uhr steht rechts.");
        await idle();
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const s = await sfStart();
        facts.branchStart = { ohne, sentOhne, posts: s };
        verdicts[C.branchStart] = ohne.disabled === true && ohne.hint === "Give its branch a name for the board." && sentOhne === 0 && canon(s) === canon([
          { url: "/api/branches", body: { repo: REPO, name: "Uhr in der Statuszeile", points: [] } },
          { url: "/api/branches/open", body: { repo: REPO, branch: "bau/uhr-in-der-statuszeile", goal: "Die Uhr steht rechts.", rechte: { stufe: "bauen", an: [], aus: [] } } }]);
      });

      // a folder without git, and a git repo the branch doors refuse: no branch offered anywhere, the other additions are
      await caseOf("ohne-git", async () => {
        const blick = async (set: Partial<Fx>) => {
          await fresh(set);
          await fenster();
          await mitAgent("repo");
          const adds = await evaluate<string[]>(`[...(${WIN}?.querySelectorAll('.sfzone.fl .sftile.stein[data-b]') ?? [])].map((b) => b.dataset.b ?? '')`);
          await block("workplace");
          const platz = await evaluate<{ drawer: boolean; branch: boolean }>(`({ drawer: !!${WIN}?.querySelector('.sfdrawer'),
            branch: !!${WIN}?.querySelector('.sfopt[data-set="workplace:branch"]') })`);
          return { adds, ...platz, ok: adds.includes("rights") && adds.includes("task") && !adds.includes("branch") && !adds.includes("notebook") && platz.drawer && !platz.branch };
        };
        const ordner = await blick({ git: false }), fremd = await blick({ branches: false });
        facts.ohneGit = { ordner, fremd };
        verdicts[C.ohneGit] = ordner.ok && fremd.ok;
      });

      // a saved agent as saved, changed and deleted, „Save as agent…“, the Orchestratorin
      const agentChecks: boolean[] = [];
      await caseOf("agent-gespeichert", async () => {
        await fresh();
        await fenster();
        await mitAgent("pruefer");
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const h = fassungDerVorschau((q) => Object.keys(q).join() === "agent" && q.agent === "pruefer");
        const s = await sfStart();
        facts.agentGespeichert = { posts: s, expect: h, reads: vorschauen() };
        agentChecks.push(h !== null && s.length === 1 && canon(s[0]!.body) === canon({ cwd: REPO, fassung: h, agent: "pruefer" }));
      });
      await caseOf("agent-geaendert", async () => {
        await fresh();
        await fenster();
        await mitAgent("pruefer");
        await block("model");
        await click(`${WIN}?.querySelector('.sfdrawer [data-effort="low"]')`); await idle();
        const offen = await evaluate<string>(`${WIN}?.querySelector('.sflineage b')?.textContent ?? ''`);
        const FELDER = { model: "claude-sonnet-5-5", effort: "low", permissionMode: "plan" };
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const h = fassungDerVorschau((q) => canon(q) === canon(FELDER));
        const s = await sfStart();
        facts.agentGeaendert = { offen, posts: s, expect: h, reads: vorschauen() };
        agentChecks.push(offen === "not saved yet" && h !== null && s.length === 1 && canon(s[0]!.body) === canon({ cwd: REPO, fassung: h, ...FELDER }));
      });
      await caseOf("agent-speichern", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        await block("rules");
        await option("rules:nein");
        const knopf = (wort: string) => `[...(${WIN}?.querySelectorAll('.sfacts .sfsec') ?? [])].find((b) => b.textContent === ${JSON.stringify(wort)})`;
        await click(knopf("Save as agent…")); await idle();
        // half the name, then the model changes (a redraw), then the rest of the name
        await type(`${WIN}?.querySelector('[data-feld="name"]')`, "Nur ");
        await block("model");
        await click(`${WIN}?.querySelector('.sfdrawer [data-effort="low"]')`); await idle();
        await weiter(`${WIN}?.querySelector('[data-feld="name"]')`, "Repo-Regeln");
        await click(knopf("Save")); await idle();
        const gespeichert = posts.filter((x) => x.url === "/api/agenten");
        const name = await evaluate<string>(`${WIN}?.querySelector('.sfhero h2')?.textContent ?? ''`);
        facts.agentSpeichern = { gespeichert, name };
        agentChecks.push(gespeichert.length === 1 && canon(gespeichert[0]!.body) === canon({ name: "Nur Repo-Regeln", wahlen: { effort: "low", weglassen: WEG } })
          && name === "Nur Repo-Regeln");
      });
      await caseOf("agent-loeschen", async () => {
        await fresh();
        await fenster();
        await mitAgent("pruefer");
        const knopf = (wort: string) => `[...(${WIN}?.querySelectorAll('.sfacts .sfsec') ?? [])].find((b) => b.textContent === ${JSON.stringify(wort)})`;
        await click(knopf("Delete…")); await idle();
        const vorher = [...deletes];
        await click(knopf("Delete „Prüfer“"));
        const zurueck = await wait(`!!${WIN}?.querySelector('.sf.s1 .sfag.repoag')`, 6000);
        await idle();
        facts.agentLoeschen = { vorher, deletes: [...deletes], zurueck };
        agentChecks.push(vorher.length === 0 && JSON.stringify(deletes) === JSON.stringify(["/api/agenten/pruefer"]) && zurueck);
      });
      await caseOf("agent-orchestratorin", async () => {
        await fresh();
        await fenster();
        await mitAgent("orchestratorin");
        const b = await banner();
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const s = await sfStart();
        facts.agentOrch = { banner: b, posts: s };
        agentChecks.push(b.art === "fleet" && s.length === 1 && s[0]!.url === `/api/slots/${FREE}/open`
          && canon(s[0]!.body) === canon({ cwd: REPO, plan: { hash: hashFor("orchestratorin", {}), role: "orchestratorin" }, agent: "orchestratorin" }));
        verdicts[C.agent] = agentChecks.length === 5 && agentChecks.every(Boolean);
      });

      // 4 · ⎇+ under the session in slot 1: the start window, a session on a branch of its own from slot 1's branch, never a lane
      await caseOf("quick", async () => {
        await fresh({ zweig: "bau/uhr-alt" });
        await click(`document.querySelector('#slots .slot[data-slot="1"] .quicklane')`);
        if (!await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag') || !!${WIN}?.querySelector('.k15go')`, 10000)) throw new Error("⎇+ opened no window");
        await idle();
        const aufbau = await evaluate<boolean>(`!!${WIN}?.querySelector('.k15go')`);
        if (aufbau) { facts.quick = { aufbau }; verdicts[C.quick] = false; return; }
        await mitAgent("repo");
        const ohne = await sfKopf();
        await click(SFGO);
        await settle(150);
        const sentOhne = starts().length;
        await type(`${WIN}?.querySelector('[data-feld="branch"]')`, "Uhr in der Statuszeile");
        await idle();
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const mit = await sfKopf();
        const s = await sfStart();
        facts.quick = { aufbau, ohne, sentOhne, mit, posts: s };
        verdicts[C.quick] = ohne.disabled === true && ohne.hint === "Give its branch a name for the board." && sentOhne === 0
          && mit.hint === "On its own branch from bau/uhr-alt; Fleet opens it in a free slot." && canon(s) === canon([
            { url: "/api/branches", body: { repo: REPO, name: "Uhr in der Statuszeile", points: [], base: "bau/uhr-alt" } },
            { url: "/api/branches/open", body: { repo: REPO, branch: "bau/uhr-in-der-statuszeile" } }]);
      });

      // 5 · the + in a repo's head of the git structure (K16: the Ranke's Projekte are gone): the start window in that repo
      await caseOf("plus", async () => {
        await fresh({ board: true });
        const add = `document.querySelector('#boardbody .gs[data-repo="${REPO}"] .gsh .gsadd')`;
        if (!await wait(`!!${add}`, 10000)) throw new Error("the board never showed the repo's +: " + await evaluate<string>("document.querySelector('#boardbody')?.innerText.slice(0, 300) ?? 'no board'"));
        await click(add);
        if (!await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag') || !!${WIN}?.querySelector('.k15go')`, 10000)) throw new Error("the repo's + opened no window");
        await idle();
        const aufbau = await evaluate<boolean>(`!!${WIN}?.querySelector('.k15go')`);
        if (aufbau) { facts.plus = { aufbau }; verdicts[C.plus] = false; return; }
        const repo = await evaluate<string | null>(`${WIN}?.querySelector('.sfrepo.sel')?.dataset.repo ?? null`);
        await mitAgent("repo");
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const h = fassungDerVorschau((q) => Object.keys(q).length === 0);
        const s = await sfStart();
        // the first place without a session: slot 1 works, and the fixture's others are free
        facts.plus = { aufbau, repo, expect: h, posts: s };
        verdicts[C.plus] = repo === REPO && h !== null && s.length === 1 && s[0]!.url === "/api/slots/2/open" && canon(s[0]!.body) === canon({ cwd: REPO, fassung: h });
      });

      // 11 · a plan that cannot be read
      const unreadable: boolean[] = [];
      for (const mode of ["500", "network", "malformed"] as const) {
        await caseOf(`plan-${mode}`, async () => {
          await fresh({ plan: mode });
          await fenster();
          await mitAgent("repo");
          await wait(`(${WIN}?.querySelector('.sfhint')?.textContent ?? '').startsWith('The preview is not readable')`, 6000);
          const kopf = await sfKopf();
          const leer = await evaluate<string>(`${WIN}?.querySelector('.sfsheet .sfleer')?.textContent ?? ''`);
          await click(SFGO); await idle();
          const sentFenster = starts().length;
          facts[`plan-${mode}`] = { kopf, leer, sentFenster };
          unreadable.push(kopf.disabled === true && kopf.warn && !!kopf.hint?.startsWith("The preview is not readable:") && leer.startsWith("The preview is not readable:")
            && sentFenster === 0);
        });
      }
      verdicts[C.unreadable] = unreadable.length === 3 && unreadable.every(Boolean);

      results.push({ width, height, claims, facts });
    }
    return results;
  } catch (e) {
    if (e instanceof K15VerdictIn) return e.results;
    throw e;
  } finally {
    socket?.close();
    browser.kill();
    await browser.exited.catch(() => undefined);
    rmSync(scratch, { recursive: true, force: true });
  }
}
