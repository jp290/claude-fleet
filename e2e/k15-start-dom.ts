// STARTING FROM THE START WINDOW IN A REAL BROWSER (owner 24.10., src/start-fenster.ts; the build: Neuaufbau K15 Runde 5, src/k15-start.ts,
// src/start-tuer.ts). Owner 24.10.: a free slot opens the new start window — the repos and their agents, then the session with a banner
// that says whether it starts as „[Zitat entfernt]“, and on the right the start brief: „[Zitat entfernt]“
// , file by file with − and + lines against `claude` by hand. Since the Soll (25.10., owner's yes 26.10.) every
// place answers one question: no banner while a start is as usual, Connectors a choice of the MCP servers, Plan first a choice of its own,
// Fleet's stones tiles with a sentence and a switch, the start brief in four moments. The old build window is gone (owner 26.10.):
// every entry opens the start window.
// The real client bundle (src/client.ts) and the window's own bundle (src/k15-entwurf.ts → /k15.js, with public/k15.css and
// public/sitzung.css) behind a fixture origin answered over CDP Fetch (as e2e/konstellation.ts): /api/sessions names one running session in
// slot 1 (an Orchestratorin in slot 2 where a case asks), /api/founding-plan answers per role with a hash that moves with the query and
// the fixture's HEAD (as the old rig's fixturePlanFor, src/founding.ts#validAnswer holds it strictly) and, for the start window, a Fassung
// with a fassungsHash that moves with every field of the query (server/fassung.ts: the owner's rule files, the repo's AGENTS.md, the
// rights sentence, the guides), /api/agenten lists the repo's agent, the Orchestratorin and one saved agent, and /api/harnesses,
// /api/programs, /api/branches, /api/dirinfo, /api/dirs, /api/machine-settings, /api/worktrees and the window's store
// (src/k15-speicher.ts#SPEICHER_ROUTE) answer as the server writes them; every POST and PUT is recorded with its body. Every case loads
// the page fresh, so no case reads what another left behind; clicks and taps are real input over CDP. The claims are read at 1200 × 900
// (an iPad's width: the start brief opens over the session), openPhone at 390 × 844. Every
// claim has a MUTANT in K15_START_MUTANTS that swaps one needle in a source file and must turn that claim red; a needle that left the
// source throws, so a mutant that could not apply fails as itself.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { rechteZeilen } from "../server/tuer-rechte";
import { rechteSatz } from "../server/rechte";
import type { Rechte } from "../session-rechte";

export interface K15StartDomResult { width: number; height: number; claims: Record<string, boolean>; facts: Record<string, unknown> }
class K15VerdictIn extends Error {
  constructor(readonly results: K15StartDomResult[]) { super("k15 start DOM: the mutant's claim has its verdict"); }
}
export interface K15StartMutant {
  name: string; claim: string;
  file: "src/k15-start.ts" | "src/start-tuer.ts" | "src/k15-zustand.ts" | "src/k15-repo.ts" | "src/client.ts" | "src/board.ts" | "src/k15-entwurf.ts"
    | "src/start-fenster.ts" | "src/start-wahl.ts" | "src/start-brief.ts" | "src/dom-morph.ts" | "public/sitzung.css";
  needle: string; with: string; width?: 1200 | 390;
}

export const K15_START_CLAIM = {
  open: "a click on a free place of the left bar opens the start window (#shell-found.k15sitz) titled „New session“: the repos on the left with the place's repo chosen, its agents beside them with the repo's own agent first, and no element of the old start window (.fdgo, .fdkind), of the build (.k15go) or its button („Lanes, MAIN and constellations ›“, .sfaufbau) stands anywhere",
  openPhone: "on the phone „Neue Session“ in the Sessions sheet opens the same start window; a tap on the repo's agent shows the session with Start, its zones „Your Claude Code“ and „Fleet on top“ and the start brief below it, nothing wider than the screen, and Start opens the session on the free place",
  banner: "the repo's agent with nothing changed shows no banner, and the start brief says it starts as claude here by hand, without filter or legend; Succession stands on at the Fassung's mark (40 %) with nothing to switch; Rules „Only this repo's“ brings the amber banner „1 change from your normal Claude Code“ with the chip „− Your rules left out“ and the brief's filter and legend; „Back to normal“ takes the banner away again and leaves nothing in the start brief marked",
  brief: "with Rules „Only this repo's“ the start brief marks your ~/.claude/CLAUDE.md once as left out (−) and shows none of its lines while closed; a click on its head shows its text as Markdown, its hand-wrapped lines flowing into one paragraph, and „Show its 40 lines“ shows all 40 as − lines (owner 25.10.: one mark at a whole file, no torn lines); and the repo's own AGENTS.md and your ~/AGENTS.md unchanged; the Rule files tile lists your ~/.claude/CLAUDE.md as left out and ~/AGENTS.md as still read at the start",
  ohneCheck: "in a repo without a merge check, the stone Branch & land says on hover that you bring its commits back yourself and promises no land of its own; switched on it says it lands only when you say so, unchecked, and its block says it lands in one commit and without a check, because the repo has no ci/merge-check.ts",
  pfeil: "on a wide screen (1600 px) a click on Rule files opens it with one sentence of what it is, and one line runs from each of its files to that file's part in the start brief, ending there; closed, the lines go; at 1200 px, where the start brief opens over the session, the open block has no line and a link „Show it in the start brief ›“ instead",
  vorschau: "the start brief reads two previews from GET /api/founding-plan (role nur-ordner, anlass=neu): normal without any choice, and this choice with its fields under the door's names (Rules only → weglassen { claudeMd, rules }) and nothing else",
  harness: "under Who it is the Harness block offers Claude Code as the standard and every other harness GET /api/harnesses says starts here (Codex); choosing Codex makes the zone's title Codex, takes away the blocks only Claude Code reads (Rule files, Skills & tools, Connectors, Asks you, Plan first, Hooks), offers exactly Codex's models and effort levels, reads the preview with harness=codex and, once chosen, the model and effort, names „~ Harness: Codex“ in the banner, and Start sends harness \"codex\" with that model and effort and none of Claude Code's settings",
  start: "Start sends exactly one POST /api/slots/<free>/open: with Rules only { cwd, fassung, weglassen: { claudeMd, rules } }, with nothing changed { cwd, fassung } — fassung the fassungsHash of the preview that read this choice, and plan { hash, role: \"nur-ordner\" } beside it only when that plan says start.startbar",
  packs: "under Fleet on top, „What it knows“ shows „Context packs“ with each pack of the library as a stone with a switch (Who it is for, Testing a build) and „Concepts“ with the concept (System concept), all off in your own setup; Who it is for switched on asks the preview for exactly that pack (bibliothek=who-it-is-for), the start brief adds it with every request as a + part of its own, no group around it, that reads, opened, as its Markdown („Who it is for“ as heading), the banner names „+ Context pack: Who it is for“, and Start sends bibliothek [\"who-it-is-for\"]; switched off again, nothing differs from normal",
  rechte: "the stone Rights under Fleet on top, switched on, sets „Builds“; „Looks only“ chosen in its block goes into the preview and the start as rechte { stufe: \"lesen\", an: [], aus: [] }, and the start brief shows its rights sentence as a + part with every request, read as text when opened",
  agent: "a saved agent unchanged reads its preview with agent=<id> and starts with { cwd, fassung, agent } and none of its fields; changed in the window it says „not saved yet“ and reads and starts with its fields spelled out and no agent; „Save as agent…“ on the repo's agent posts /api/agenten { name, wahlen } with the choice and the name as typed, also when the model changed while it was typed; „Delete…“, asked once more, sends DELETE /api/agenten/<id> and goes back to the agents",
  agentLabel: "a saved agent unchanged starts with label: its name, so its slot carries its name",
  agentRolle: "the Orchestratorin opens as your own copy, and that copy starts with { cwd, fassung, agent } and no label of its own: the door gives it the role's label and refuses any other (server/agenten.ts#agentAnDerTuer)",
  druck: "a press is not lost when answers come while the button is held down: on the repo's agent in the start window the answer that comes during the press waits, nothing is drawn anew under the pointer until the release, and the release opens its session",
  ruhig: "a change of Rules and the preview that follows it change only what changed (owner 24.10.: no flicker): the window, its columns, the repo rows, the zones and every tile but Rule files stay the same elements, and nothing changes in the repo column, in another tile or anywhere else; the changes stand in the banner that comes, the Rule files tile and its block, the head with Start, and the start brief, where a block that reads the same afterwards is the same element; nothing that stays is moved (a move inserts it again, and it fades in); a second click on the Rule files tile closes its block, and switching Rights on leaves the other stones the same elements",
  laden: "while the preview of a new choice is read, Start is blocked with „Reading what this session gets …“ and a press sends nothing, and the start brief says „Comparing …“ instead of „Nothing differs“ while the banner already names the change; once read, the brief shows the change and Start carries the fassungsHash of that read",
  aufgabe: "the stone First task switched on, with a goal typed in two goes, the window redrawn between them, starts with exactly { cwd, fassung, goal } at /api/slots/<free>/open and the goal whole",
  branchStart: "the stone Branch & land switched on blocks Start until it has a name; with a name typed in two goes, Rights and a first task Start sends POST /api/branches { repo, name, points: [] }, then POST /api/branches/open { repo, branch, goal, rechte } and no /open",
  ohneGit: "in a folder without git, and in a repo the branch doors don't take (dirinfo branches:false, no session works there yet), neither Branch & land nor Own notebook stands under Fleet on top, nor is a branch offered in the Workplace block, while the other stones are",
  connectors: "Connectors shows the MCP servers Fleet measured at a session's start as a choice, each ticked with where it comes from (Gmail · claude.ai, playwright · plugin), and its block says that /mcp turns a server on or off later in the session; unticking Gmail reads the preview with weglassen { mcp: [\"claude_ai_Gmail\"] }, the tile says „1 of 2 servers“, the banner names „− Connectors: 1 left out“, and Start sends weglassen { mcp: [\"claude_ai_Gmail\"] }",
  plan: "Plan first is a choice of its own beside Asks you (owner 25.10. 19:50): On reads the preview and starts with permissionMode \"plan\", the banner names „+ Plan first“, and Asks you offers its five choices with „No limits“ last and never as what is chosen, without „Only plans“",
  quick: "⎇+ under a session opens the start window (orchestrator 26.10.: a session on a branch of its own, no lane): on the repo's agent Branch & land is on and blocks Start until it has a name; named, the sentence under Start says it starts from that session's branch, and Start sends POST /api/branches { repo, name, points: [], base: <that branch> }, then POST /api/branches/open, and never /api/lanes",
  plus: "the + of a repo opens the start window with that repo chosen; its own agent unchanged starts in the checkout with exactly { cwd, fassung } at /api/slots/<first free>/open, and never /api/lanes",
  unreadable: "a plan that cannot be read (500, network, malformed) blocks the start in the start window with a sentence that says so („The preview is not readable: …“), and nothing is sent",
  ordnerOhneGit: "„Another folder…“ takes a folder without git: Add on its row and Add <folder> in it each pin it (POST /api/pins), and the window then lists it as the chosen place with its badge „no git“, its agents beside it",
  ordnerPfad: "in the folder picker a path typed with ~ and a trailing slash and sent with Enter pins and chooses that folder (POST /api/pins with the folder as the server names it), and the Add beside the field does the same; a path that is no folder says „That is not a folder.“ under the field, pins nothing and leaves the picker open; with a keyboard at hand the cursor is in the field when the picker opens, and a click on a row of the tree does not pull it back",
  ordnerPfadLesen: "the picker's path line reads from the left: the first character of /fixture/notizen stands left of its last, whole and in order, the picker's own reading as well as the one after a step down the tree",
  ordnerPfadPhone: "on the phone the picker has the same field: no cursor jumps into it on opening (no keyboard comes up), a path typed and pressed with Add pins and chooses the folder, and nothing is wider than the screen",
  ordnerCursor: "the cursor stays in the picker's path field: after a refusal (Enter, or the Add beside it), and through a redraw of the window that comes while the person types (an answer of GET /api/dirinfo); what is typed next lands in the field, Enter sends the text that stands there, and Escape, Back and an Add on the tree still do what they did",
  ordnerCursorPhone: "on the phone the cursor stays in the path field once the person has put it there: through a redraw while they type, and after a refusal from the Add beside it; what they type next lands, and Add sends it",
  ordnerRelativ: "a relative path typed into the picker's field means the folder the line above the field shows, as the tree below it: a name in the home folder, a name read from a folder stepped into, `.` and `..`, `$HOME/…` and a space written as `\\ ` are pinned as that folder and never read from the folder Fleet itself runs in",
  ordnerSatz: "a folder Fleet may not read says „Fleet cannot read that folder.“ in plain words, typed or opened in the tree, and neither the system's message (EACCES) nor a path with the machine's account name stands anywhere in the window",
  ordnerFrueh: "no key is lost around the first listing of the picker: with the listing still being read, the cursor is in the field, what is typed lands there, and Enter pins the folder typed even when the listing arrives before the folder's own answer",
  ordnerSicht: "the folder picker is never squashed: with 5, 8 and 20 folders in the list, at a window 720 and at one 900 px high, the path field is whole in view the moment the picker opens, the tree below it has its full height, and a refusal typed with Enter stands whole in view under the field",
  ordnerSpaet: "an answer that comes late cannot reach a picker that was closed and opened again: a path sent, the picker closed with Escape and opened anew, the old folder is not pinned and the new picker keeps what the person types, and an old refusal does not show under it",
  ordnerGewaehlt: "the folder the person chooses in the picker is in view in the list when the picker closes: with 8 and with 20 folders in the list, at a window 720 and at one 900 px high, a path typed and sent with Enter and the Add of a row in the tree each leave the chosen row whole in view, not above the list's fold",
  ordnerGewaehltPhone: "on the phone (390 px wide, 600 px high) the folder the person chooses in the picker, typed and sent with Add or by the Add of a row in the tree, with 8 and with 20 folders in the list, stands whole in view when the picker closes",
  leereFlotte: "on a board with no open seat the pane offers „Start your agent“, on top of the terminal where a press reaches it, and a press opens the start window; with a seat open the pane does not",
  zu: "after a successful start from the start window the window closes and the started slot is the one shown",
  bereit: "the Start of a row in the menu starts at once, without opening the agent's page: plain Claude Code with { cwd, fassung } and no label, a saved agent with { cwd, fassung, agent, label: its name }, the Orchestratorin and a copy of her with { cwd, fassung, agent } and no label, as the door that refuses any other label takes them; the window closes and the started slot is the one shown",
  rolleGehalten: "the Start of a row whose role a live seat holds, refused by the door with 409, leaves the window open and shows the door's sentence in its red; the page's Start the same, under Start",
  modusOhneWahl: "with no choice the tile Asks you names the mode the preview names (auto, Before commands, No limits, each „… · your setting“), and an imported agent that would inherit bypass names the mode it really starts in, not as your setting",
  modusImBranch: "with Branch & land on, the tile Asks you names the mode the branch gives, not the checkout's: a checkout in plan, a branch without the file: „On its own · your setting“, also with Manual chosen; the branch stone off again, the checkout's",
  fremdGeaendert: "an imported agent changed in the window (Memory Off) stays one: its preview and its Start name it in ausAgent and no agent id, the tile and the open Asks-you block say „On its own“ and nowhere „your setting“, and No limits chosen by hand still goes",
  fremdGesichert: "an imported agent saved with a change (Memory Off, Save changes): the tile says at once what it now does, „No limits · your setting“, and the next press of Start starts it, with no refusal in between",
  heroSatz: "under the name the repo's agent in its own setup says „Nothing from Fleet unless you switch it on.“ and a saved agent says „Your Claude Code with what Fleet adds on top.“",
  regelnKachel: "the tile Rule files tells the folder's truth: rule files are counted and listed, none says „None“ with no list and no row in the start brief, and a folder whose only rule file has paths: says „1 file“, „read with a matching file“, with its row under „When it fits“",
} as const;
// the claims read on the phone; every other one at 1200
const PHONE: ReadonlySet<string> = new Set([K15_START_CLAIM.openPhone, K15_START_CLAIM.ordnerPfadPhone, K15_START_CLAIM.ordnerCursorPhone, K15_START_CLAIM.ordnerGewaehltPhone]);

const C = K15_START_CLAIM;
export const K15_START_MUTANTS: readonly K15StartMutant[] = [
  { name: "a free place opens nothing", claim: C.open, file: "src/client.ts",
    needle: "row.onclick = () => openK15Entwurf({ slot: s.id });", with: "row.onclick = () => undefined;" },
  { name: "the repo's own agent is not listed", claim: C.open, file: "src/start-fenster.ts",
    needle: "if (repoAg) out.push({ key: \"repo\",", with: "if (false) out.push({ key: \"repo\"," },
  { name: "„Neue Session“ in the Sessions sheet opens nothing", claim: C.openPhone, file: "src/client.ts", width: 390,
    needle: `"New session", () => { if (free) openK15Entwurf({ slot: free.id }); });`, with: `"New session", () => undefined);` },
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
    needle: "const q = new URLSearchParams(alsAgent(z) ? { agent: z.agent!.id, ...ab } : { ...vorschau(z.wahl), ...herkunft(z), ...ab }).toString();",
    with: "const q = new URLSearchParams(alsAgent(z) ? { agent: z.agent!.id, ...ab } : { ...herkunft(z), ...ab }).toString();" },
  { name: "the start drops the chosen harness", claim: C.harness, file: "src/start-wahl.ts",
    needle: "return { ...(h ? { harness: h } : {}), ...(w.model", with: "return { ...(false ? { harness: h } : {}), ...(w.model" },
  { name: "the start drops the choice", claim: C.start, file: "src/start-fenster.ts",
    needle: "const wahl = ganz ? {} : { ...felder, ...herkunft(z) };", with: "const wahl = ganz ? {} : herkunft(z);" },
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
    needle: "    && (branchGeht(i) || (id !== \"branch\" && id !== \"notebook\")) && (claude", with: "    && (claude" },
  { name: "Branch & land is offered where the branch door refuses the repo", claim: C.ohneGit, file: "src/start-fenster.ts",
    needle: "const branchGeht = (i: DirInfoResp | null): boolean => i?.git === true && i.branches !== false;",
    with: "const branchGeht = (i: DirInfoResp | null): boolean => i?.git === true;" },
  { name: "a folder without git cannot be added from its own listing", claim: C.ordnerOhneGit, file: "src/k15-repo.ts",
    needle: "hier.disabled = schon.has(liste.path);", with: "hier.disabled = schon.has(liste.path) || !liste.git;" },
  { name: "a folder without git has no Add on its row", claim: C.ordnerOhneGit, file: "src/k15-repo.ts",
    needle: "    if (!schon.has(pfad)) {", with: "    if (git && !schon.has(pfad)) {" },
  { name: "a typed path pins nothing", claim: C.ordnerPfad, file: "src/k15-repo.ts",
    needle: "  await pinne(s, j.path, true);", with: "  return;" },
  { name: "a path that is no folder is pinned anyway", claim: C.ordnerPfad, file: "src/k15-repo.ts",
    needle: 'if (!res.ok || typeof j?.path !== "string") return sagt(', with: 'if (res.ok && typeof j?.path !== "string") return sagt(' },
  { name: "Enter in the path field does nothing", claim: C.ordnerPfad, file: "src/k15-repo.ts",
    needle: 'void nimmPfad(s, ((e.currentTarget as HTMLFormElement).querySelector(".k15ordni") as HTMLInputElement).value);', with: "" },
  { name: "the Add beside the path field is dead", claim: C.ordnerPfad, file: "src/k15-repo.ts",
    needle: 'go.type = "submit";', with: 'go.type = "button";' },
  { name: "the cursor never goes into the path field", claim: C.ordnerPfad, file: "src/k15-repo.ts",
    needle: "if (!s.repoMenu || !o || o.fokus) return;", with: "return;" },
  { name: "a click in the tree pulls the cursor back into the path field", claim: C.ordnerPfad, file: "src/k15-zustand.ts",
    needle: "seq, ...(s.ordner?.fokus ? { fokus: true } : {}) };", with: "seq };" },
  { name: "the path line runs right to left", claim: C.ordnerPfadLesen, file: "src/k15-repo.ts",
    needle: 'pfadTeil.append(el("bdi", "", ', with: 'pfadTeil.append(el("span", "", ' },
  { name: "a keyboard comes up on the phone", claim: C.ordnerPfadPhone, file: "src/k15-repo.ts", width: 390,
    needle: 'if (matchMedia("(hover: hover) and (pointer: fine)").matches)', with: "if (true)" },
  { name: "the phone's path pins nothing", claim: C.ordnerPfadPhone, file: "src/k15-repo.ts", width: 390,
    needle: "  await pinne(s, j.path, true);", with: "  return;" },
  { name: "the draw removes the folder menu before it morphs", claim: C.ordnerCursor, file: "src/k15-entwurf.ts",
    needle: "  // the folder menu is not removed here: it is part of the window's drawing and the morph keeps its path field, with the cursor in it",
    with: '  s.shell.root.querySelector(".k15repomenu")?.remove();' },
  { name: "the phone's draw removes the folder menu before it morphs", claim: C.ordnerCursorPhone, file: "src/k15-entwurf.ts", width: 390,
    needle: "  // the folder menu is not removed here: it is part of the window's drawing and the morph keeps its path field, with the cursor in it",
    with: '  s.shell.root.querySelector(".k15repomenu")?.remove();' },
  { name: "a refusal leaves the cursor where the press put it", claim: C.ordnerCursor, file: "src/k15-repo.ts",
    needle: "if (f && document.activeElement !== f) {", with: "if (false) {" },
  { name: "a refusal leaves the cursor where the press put it, on the phone", claim: C.ordnerCursorPhone, file: "src/k15-repo.ts", width: 390,
    needle: "if (f && document.activeElement !== f) {", with: "if (false) {" },
  { name: "the field's input handler reads the element it was drawn into", claim: C.ordnerCursor, file: "src/k15-repo.ts",
    needle: "const f = e.currentTarget as HTMLInputElement, a = s.ordner;", with: "const f = inp, a = s.ordner;" },
  { name: "the form sends the element it was drawn into", claim: C.ordnerCursor, file: "src/k15-repo.ts",
    needle: 'void nimmPfad(s, ((e.currentTarget as HTMLFormElement).querySelector(".k15ordni") as HTMLInputElement).value);', with: "void nimmPfad(s, inp.value);" },
  { name: "Back does not close the folder picker", claim: C.ordnerCursor, file: "src/k15-repo.ts",
    needle: 'zu.onclick = () => { s.ordner = null; render(); };', with: "zu.onclick = () => undefined;" },
  { name: "a relative path is read from the folder Fleet runs in", claim: C.ordnerRelativ, file: "src/k15-repo.ts",
    needle: 'return `${von.replace(/\\/+$/, "")}/${p}`;', with: "return p;" },
  { name: "$HOME is not read as the home", claim: C.ordnerRelativ, file: "src/k15-repo.ts",
    needle: '.replace(/^\\$\\{?HOME\\}?(?=\\/|$)/, "~")', with: "" },
  { name: "a backslash before a space stays in the path", claim: C.ordnerRelativ, file: "src/k15-repo.ts",
    needle: '.replace(/\\\\ /g, " ");', with: ";" },
  { name: "a typed path is read from the home, not from the folder shown", claim: C.ordnerRelativ, file: "src/k15-repo.ts",
    needle: "o.liste?.path ?? o.pfad", with: '"~"' },
  { name: "an unreadable folder typed shows the system's message", claim: C.ordnerSatz, file: "src/k15-repo.ts",
    needle: "return sagt(ordnerSatz(res.status, j?.error));", with: 'return sagt(j?.error ?? "");' },
  { name: "an unreadable folder in the tree shows the system's message", claim: C.ordnerSatz, file: "src/k15-zustand.ts",
    needle: "fehler: ordnerSatz(res?.status, j?.error) };", with: 'fehler: j?.error ?? "" };' },
  { name: "Enter while the first listing is read is dropped when it arrives", claim: C.ordnerFrueh, file: "src/k15-repo.ts",
    needle: "(S === s && s.ordner?.seq === seq ? s.ordner : null);", with: "(S === s && s.ordner === o ? s.ordner : null);" },
  { name: "the cursor waits for the first listing", claim: C.ordnerFrueh, file: "src/k15-repo.ts",
    needle: "if (!s.repoMenu || !o || o.fokus) return;", with: "if (!s.repoMenu || !o || !o.liste || o.fokus) return;" },
  { name: "the picker's menu shrinks in the list again", claim: C.ordnerSicht, file: "public/sitzung.css",
    needle: "box-shadow: none; flex: none; animation: none; }", with: "box-shadow: none; animation: none; }" },
  { name: "the picker's menu comes in with its entry movement again", claim: C.ordnerSicht, file: "public/sitzung.css",
    needle: "flex: none; animation: none; }", with: "flex: none; }" },
  { name: "the field is not brought into view", claim: C.ordnerSicht, file: "src/k15-repo.ts",
    needle: '.querySelector(".k15ordnfw")?.scrollIntoView({ block: "nearest" });', with: ".querySelector(\".k15ordnfw\");" },
  { name: "a refusal is not brought into view", claim: C.ordnerSicht, file: "src/k15-repo.ts",
    needle: "    render();\n    feldZeigen(s);\n", with: "    render();\n" },
  { name: "a reopened picker counts from the closed one's seq", claim: C.ordnerSpaet, file: "src/k15-zustand.ts",
    needle: "const seq = ++ordnerFolge;", with: "const seq = (s.ordner?.seq ?? 0) + 1;" },
  { name: "a chosen folder's row is not brought into view", claim: C.ordnerGewaehlt, file: "src/start-fenster.ts",
    needle: '.querySelector(".sfrepo.sel")?.scrollIntoView({ block: "nearest" }); }', with: '.querySelector(".sfrepo.sel"); }' },
  { name: "a chosen folder's row is not brought into view, on the phone", claim: C.ordnerGewaehltPhone, file: "src/start-fenster.ts", width: 390,
    needle: '.querySelector(".sfrepo.sel")?.scrollIntoView({ block: "nearest" }); }', with: '.querySelector(".sfrepo.sel"); }' },
  { name: "the empty board offers nothing", claim: C.leereFlotte, file: "src/client.ts",
    needle: `document.body.classList.toggle("noseats", fleet.length > 0 && !fleet.some(isActive));`, with: `document.body.classList.toggle("noseats", false);` },
  { name: "the Workplace block offers a branch without git", claim: C.ohneGit, file: "src/start-fenster.ts",
    needle: "if (frei && branchGeht(i)) d.append(opts(", with: "if (frei) d.append(opts(" },
  { name: "an unticked server stays in the start", claim: C.connectors, file: "src/start-wahl.ts",
    needle: "if (w.mcpAus.length) o.mcp = [...w.mcpAus];", with: "" },
  { name: "Connectors shows no choice of the servers", claim: C.connectors, file: "src/start-fenster.ts",
    needle: "const sv = server(z.letzte?.n ?? z.letzte?.a), weg =", with: "const sv = [] as Server[], weg =" },
  { name: "Plan first never reaches the door", claim: C.plan, file: "src/start-wahl.ts",
    needle: "const modus = w.planFirst ? \"plan\" : w.permissionMode;", with: "const modus = w.permissionMode;" },
  { name: "⎇+ starts in the checkout instead of on a branch of its own", claim: C.quick, file: "src/start-fenster.ts",
    needle: "if (abzweig(s) && !fremd.length && wahl.branch === null) wahl.branch = \"\";", with: "" },
  { name: "⎇+ branches from the repo's main instead of the session's branch", claim: C.quick, file: "src/start-fenster.ts",
    needle: "...(abzweig(s)?.branch ? { base: abzweig(s)!.branch! } : {})", with: "" },
  { name: "the + of a repo opens nothing", claim: C.plus, file: "src/board.ts",
    needle: "add.onclick = (e) => { e.stopPropagation(); openK15Entwurf({ repo: R.repo }); };", with: "add.onclick = (e) => { e.stopPropagation(); };" },
  { name: "an unreadable preview reads as loading in the start window", claim: C.unreadable, file: "src/start-fenster.ts",
    needle: "if (fehler) return `The preview is not readable: ${fehler}`;", with: "if (fehler) return \"Reading what this session gets …\";" },
  { name: "the start window stays open after a start", claim: C.zu, file: "src/start-fenster.ts",
    needle: "    s.shell.close();\n    zeigeSlot(r.slot);\n    if (r.hinweis) meldung(`The session", with: "    zeigeSlot(r.slot);\n    if (r.hinweis) meldung(`The session" },
  { name: "the menu stays open after the Start of a row", claim: C.bereit, file: "src/start-fenster.ts",
    needle: "    s.shell.close();\n    zeigeSlot(r.slot);\n    if (r.hinweis) meldung(r.hinweis);", with: "    zeigeSlot(r.slot);\n    if (r.hinweis) meldung(r.hinweis);" },
  { name: "the Start of a row calls plain Claude Code by a name", claim: C.bereit, file: "src/start-fenster.ts",
    needle: "...(b.key === \"repo\" || agent?.wahlen.rolle !== undefined ? {} : { label: b.name })", with: "...(agent?.wahlen.rolle !== undefined ? {} : { label: b.name })" },
  { name: "the Start of a row names a copy of a role and the door refuses it", claim: C.bereit, file: "src/start-fenster.ts",
    needle: "...(b.key === \"repo\" || agent?.wahlen.rolle !== undefined ? {} : { label: b.name })", with: "...(b.key === \"repo\" ? {} : { label: b.name })" },
  { name: "a refused Start of a row closes the window and says nothing", claim: C.rolleGehalten, file: "src/start-fenster.ts",
    needle: "  z.fehler = r.fehler;\n  if (r.bewegt) s.plaene.clear();\n  render();\n}\n// IMPORT: a setup someone shared", with: "  s.shell.close();\n  if (r.bewegt) s.plaene.clear();\n  render();\n}\n// IMPORT: a setup someone shared" },
  { name: "the tile says Before changes whatever the mode", claim: C.modusOhneWahl, file: "src/start-fenster.ts",
    needle: "const hier = ohneWahl(stattBypass ? wp : wpn), gilt", with: "const hier = ohneWahl(\"manual\"), gilt" },
  { name: "an imported agent's tile says your setting's bypass though it starts in another mode", claim: C.modusOhneWahl, file: "src/start-fenster.ts",
    needle: "const hier = ohneWahl(stattBypass ? wp : wpn), gilt", with: "const hier = ohneWahl(wpn), gilt" },
  { name: "the tile on a branch start reads the checkout's mode", claim: C.modusImBranch, file: "src/start-fenster.ts",
    needle: "(z.wahl.branch !== null ? z.letzte?.a.modusImBranch : undefined) ?? wirkModus(f)", with: "wirkModus(f)" },
  { name: "every agent says Nothing from Fleet", claim: C.heroSatz, file: "src/start-fenster.ts",
    needle: "wozu ?? (istRepo(a) && eigenesSetup(fassungVon(z.letzte?.a)) ? ", with: "wozu ?? (true ? " },
  { name: "the repo's agent no longer says Nothing from Fleet", claim: C.heroSatz, file: "src/start-fenster.ts",
    needle: "wozu ?? (istRepo(a) && eigenesSetup(fassungVon(z.letzte?.a)) ? ", with: "wozu ?? (false ? " },
  { name: "the hero sentence does not name the chosen harness", claim: C.harness, file: "src/start-fenster.ts",
    needle: "`${agentWort(z.wahl.harness)} with what Fleet adds on top.`", with: "\"Your Claude Code with what Fleet adds on top.\"" },
  { name: "the Start of a row loses every saved agent's name", claim: C.bereit, file: "src/start-fenster.ts",
    needle: '...(b.key === "repo" || agent?.wahlen.rolle !== undefined ? {} : { label: b.name })', with: '...(b.key === "repo" || agent ? {} : { label: b.name })' },
  { name: "a refused Start on the page closes the window", claim: C.rolleGehalten, file: "src/start-fenster.ts",
    needle: "  z.busy = false;\n  if (r.ok) {\n    s.shell.close();\n    zeigeSlot(r.slot);\n    if (r.hinweis) meldung(`The session", with: "  z.busy = false;\n  if (true) {\n    s.shell.close();\n    zeigeSlot(r.ok ? r.slot : 1);\n    if (r.ok && r.hinweis) meldung(`The session" },
  { name: "a refused Start on the page shows no sentence under Start", claim: C.rolleGehalten, file: "src/start-fenster.ts",
    needle: "nein = z.fehler ?? halt;", with: "nein = halt;" },
  { name: "the window keeps the preview from before a save", claim: C.fremdGesichert, file: "src/start-fenster.ts",
    needle: "  s.plaene.clear();\n  Object.assign(z, { agent: a,", with: "  Object.assign(z, { agent: a," },
  { name: "a seat-saved agent changed in the window loses where it came from", claim: C.fremdGeaendert, file: "src/start-fenster.ts",
    needle: "(z.agent.importiert || typeof z.agent.vonSitz === \"number\")", with: "z.agent.importiert" },
  { name: "a changed imported agent's Start and preview lose where it came from", claim: C.fremdGeaendert, file: "src/start-fenster.ts",
    needle: "z.agent && !alsAgent(z) && (z.agent.importiert || typeof z.agent.vonSitz === \"number\") ? { ausAgent: z.agent.id } : {};", with: "({});" },
  { name: "the open Asks-you block says your setting's No limits for a changed imported agent", claim: C.fremdGeaendert, file: "src/start-fenster.ts",
    needle: 'statt = w.permissionMode === null && wn === "bypassPermissions" && wj !== null && wj !== wn', with: "statt = false" },
  { name: "the tile says 1 file with no rule file", claim: C.regelnKachel, file: "src/start-fenster.ts",
    needle: "wert: fest(liest ? mehrzahl(liest, \"file\") : \"None\")", with: "wert: fest(mehrzahl(Math.max(liest, 1), \"file\"))" },
  { name: "the placeholder for no rules reads as a file named rules", claim: C.regelnKachel, file: "src/start-brief.ts",
    needle: "if (!a?.text || (a.bytes === 0 && !a.dateien?.length)) return a?.nachgeladen ?? [];", with: "if (!a?.text) return [];" },
  { name: "a rule file with paths: reads as no rule file", claim: C.regelnKachel, file: "src/start-brief.ts",
    needle: "if (!a?.text || (a.bytes === 0 && !a.dateien?.length)) return a?.nachgeladen ?? [];", with: "if (!a?.text || (a.bytes === 0 && !a.dateien?.length)) return [];" },
  { name: "the copy of a role names its slot and the door refuses it", claim: C.agentRolle, file: "src/start-fenster.ts",
    needle: "...(ganz && !rolle && z.agent?.wahlen.rolle === undefined ? { label: z.name } : {})", with: "...(ganz && !rolle ? { label: z.name } : {})" },
  { name: "the Orchestratorin opens herself instead of your copy", claim: C.agentRolle, file: "src/start-fenster.ts",
    needle: "if (a.id === \"repo\" || a.aenderbar) oeffne(s, a); else await kopiere(s, a);", with: "oeffne(s, a);" },
  { name: "a saved agent started from its page loses its name", claim: C.agentLabel, file: "src/start-fenster.ts",
    needle: "...(ganz && !rolle && z.agent?.wahlen.rolle === undefined ? { label: z.name } : {})", with: "...({})" },
  { name: "a saved agent started from its page carries its fields beside its id", claim: C.agent, file: "src/start-fenster.ts",
    needle: "const wahl = ganz ? {} : { ...felder, ...herkunft(z) };", with: "const wahl = { ...felder, ...herkunft(z) };" },
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
  { id: "repo", name: "Repo agent", wahlen: {}, agentMd: null, art: "eingebaut", aenderbar: false, quelle: "Fleet", hash: hash("repo") },
  { id: "orchestratorin", name: "Orchestratorin", wahlen: { rolle: "orchestratorin" }, agentMd: null, art: "eingebaut", aenderbar: false, quelle: "Fleet", hash: hash("orchestratorin") },
  { id: "pruefer", name: "Prüfer", wahlen: { model: "claude-sonnet-5-5", permissionMode: "plan" }, agentMd: null, art: "eigen", aenderbar: true,
    quelle: "~/.fleet/agenten/pruefer.json", hash: hash("pruefer") },
];
// a copy of the role (POST /api/agenten/orchestratorin/kopie) and an agent imported from a file, each listed where a case asks for it
const KOPIE = { id: "copy-of-orchestrator", name: "copy of Orchestrator", wahlen: { rolle: "orchestratorin" }, agentMd: null, art: "eigen", aenderbar: true,
  quelle: "~/.fleet/agenten/copy-of-orchestrator.json", hash: hash("copy-of-orchestrator"), kopieVon: { id: "orchestratorin", name: "Orchestrator", hash: hash("orchestratorin") } };
const FREMD = { id: "fremd", name: "Fremd", wahlen: { effort: "low" }, agentMd: null, art: "eigen", aenderbar: true, importiert: true, abgeleitetVon: hash("datei"),
  quelle: "~/.fleet/agenten/fremd.json", hash: hash("fremd") };
// the rule files Claude Code reads in the fixture repo, an own setup as the owner's example-app: your ~/.claude/CLAUDE.md and one of
// your rules, your ~/AGENTS.md (a folder above; weglassen doesn't touch it), then the repo's AGENTS.md (liest.projektregeln: one text
// with „--- i/n NAME ---“ markers, the paths in `dateien`)
const REGELN: { pfad: string; eigentum?: string }[] = [{ pfad: `${HOME}/.claude/CLAUDE.md`, eigentum: "owner" },
  { pfad: `${HOME}/.claude/rules/typescript.md`, eigentum: "owner" }, { pfad: `${HOME}/AGENTS.md` }, { pfad: `${REPO}/AGENTS.md` }];
const STUFE_WORT: Record<string, string> = { lesen: "Nur lesen", bauen: "Bauen", landen: "Landen", deployen: "Deployen" };
// the Fassung the preview door returns with anlass=neu for this query (server/fassung.ts): what the choice leaves out of your ~/.claude,
// the rights sentence, the guides; a saved agent's choices count as if set (server/agenten.ts), a role reads its card and is no own setup
const fassungOf = (q: URLSearchParams, o0: { modus: string | null; imBranch?: string | null; regeln: "voll" | "keine" | "nurPfad"; gesichert?: boolean }): { teile: { id: string; abschnitte: Record<string, unknown>[] }[] } => {
  const o = { ...o0, modus: q.has("ab") && o0.imBranch ? o0.imBranch : o0.modus };
  const ag: Record<string, unknown> = AGENTEN.find((x) => x.id === q.get("agent"))?.wahlen ?? {};
  const w: Record<string, string> = { ...Object.fromEntries(Object.entries(ag).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])), ...Object.fromEntries(q) };
  const role = w.role ?? "nur-ordner";
  const weg = JSON.parse(w.weglassen ?? "{}") as { claudeMd?: boolean; rules?: boolean };
  const regeln = REGELN.filter((r) => !(weg.claudeMd && r.pfad.endsWith("/.claude/CLAUDE.md")) && !(weg.rules && r.pfad.includes("/.claude/rules/")));
  // die gewählte Rechte-Stufe, wie die Tür sie liest (server/rechte.ts#rechteAus): sie gehört in den „darf“-Abschnitt wie am echten Start
  const rechte = w.rechte ? (JSON.parse(w.rechte) as Rechte) : null;
  const stufe = rechte?.stufe ?? null;
  const gewaehlt = ["model", "effort", "permissionMode", "tools", "notizbuch", "rechte", "bibliothek", "schwelle"].filter((k) => w[k] !== undefined);
  // the library: whole (true), none (false) or exactly these packs, as the preview's query or a saved agent's list carries it
  const bib = w.bibliothek, packsAn: string[] = bib === undefined || bib === "false" ? [] : bib === "true" ? PACK_KATALOG.map((x) => x.id)
    : bib.startsWith("[") ? JSON.parse(bib) as string[] : bib.split(",");
  const a = (id: string, text: string, mehr: Record<string, unknown> = {}) => ({ id, quelle: null, bytes: new TextEncoder().encode(text).length, text, ...mehr });
  return { teile: [
    { id: "wer", abschnitte: [a("modell", w.model ?? "kein Modell gewählt"), a("effort", w.effort ?? "kein Effort gewählt")] },
    { id: "liest", abschnitte: [a("systemzusatz", ""),
      ...(role === "orchestratorin" ? [a("rolle", "ROLLE Orchestratorin: plant die Arbeit, öffnet die Branches, bringt die Ergebnisse zurück.")] : []),
      // no file at the start: the server's placeholder, with a rule file that has paths: beside it where one lies (server.ts#fassungProjektregelnAus)
      o.regeln !== "voll" ? { ...a("projektregeln", "(keine Projektregeln geladen)"), bytes: 0,
        ...(o.regeln === "nurPfad" ? { nachgeladen: [{ pfad: `${REPO}/.claude/rules/x.md`, text: "---\npaths: [\"**/*.ts\"]\n---\n# Nur TypeScript\n" }] } : {}) }
      : a("projektregeln", regeln.map((r, i) => `--- ${i + 1}/${regeln.length} ${r.pfad.split("/").pop()} ---\n${fileText(r.pfad)}`).join("\n"),
        { dateien: regeln.map((r) => ({ pfad: r.pfad, bytes: fileText(r.pfad).length, ...(r.eigentum ? { eigentum: r.eigentum } : {}) })) }),
      ...(packsAn.includes("who-it-is-for") ? [a("wissen", "--- who-it-is-for (docs/packs/who-it-is-for.md · # Who it is for) ---\n# Who it is for\n\nRead this when …")] : []),
      ...packsAn.filter((id) => id !== "who-it-is-for").map((id) => a("wissen", `- ${id}: ${PACK_KATALOG.find((x) => x.id === id)?.useWhen ?? "…"}`)),
      ...(w.notizbuch === "aus" ? [] : [a("gedaechtnis", "- [Fixture](fixture.md) — a note", { quelle: `${HOME}/.claude/projects/-fixture-claude-fleet/memory`,
        dateien: [{ pfad: `${HOME}/.claude/projects/-fixture-claude-fleet/memory/MEMORY.md`, bytes: 32 }] })])] },
    { id: "darf", abschnitte: [...(role === "nur-ordner" && (w.harness ?? "claude") === "claude" ? [a("eigenes-setup", "Eigenes Setup: so wie von Hand.")] : []),
      // dieselben Zeilen wie server/tuer-rechte.ts#rechteZeilen, mit den Rechten DIESER Wahl wie am echten Start (server.ts#fassungFuerSlot
      // gibt s.rechte hinein): Rechte mit Bedeutung, die Stufe, dann der Zaun. Ohne sie trüge die Wahl denselben Satz wie „normal“,
      // und der Startbrief zeigte keinen Rechte-Block (src/start-brief.ts:182f) — main war am 28.10. genau daran rot.
      a("darf", rechteZeilen(rechte, [role === "orchestratorin" ? "orchestrator" : role === "main" ? "program-main" : role === "lane" ? "lane" : "generic"], "claude").join("\n")),
      // the mode this start gets (server.ts#modusDerOeffnung): the choice, else what the settings say; an agent from a file inherits no bypass
      ...(w.permissionMode ? [a("modus", w.permissionMode)] : o.modus ? [a("modus", (q.get("agent") === "fremd" && !o.gesichert || q.get("ausAgent") === "fremd") && o.modus === "bypassPermissions" ? "auto" : o.modus)] : []),
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
  // GET /api/dirs waits, for each path named here, until the case lets that path go (`dirsGehalten`); a folder in the home that Fleet may not read
  dirsHalt: string[]; gesperrt: boolean;
  // the fixture repo is a git checkout; false: a plain folder. branches: the branch doors take it (a workplace repo)
  git: boolean; branches: boolean;
  // no session is open at all (a board fresh from the install); the folders the picker pinned
  leer: boolean; pins: string[];
  // the branch /api/dirinfo names for the fixture repo's checkout, where slot 1 works
  zweig: string;
  // the mode a start with no choice gets (darf/modus); the folder's rule files; the menu also lists a copy of the Orchestratorin and an agent from a file
  modus: string | null; regeln: "voll" | "keine" | "nurPfad"; kopie: boolean; fremd: boolean;
  // the mode a start on its own branch gets with no choice, read from the branch, not the checkout (server.ts#modusImBranch)
  imBranch: string | null;
  // the agent from a file was saved by a seat, not imported; its owner saved a change on it, so its mark is gone (server/agenten.ts)
  vonSitz: boolean; gesichert: boolean;
  occupied: Map<number, Record<string, unknown>>;
}
const fx0 = (): Fx => ({ head: "fixture-head", plan: "ok", ordnerStartbar: false, orch: false, move: false, programs: "ok", bootstrap: "ok",
  branchExists: false, board: false, dirinfoHalt: false, planHalt: false, dirsHalt: [], gesperrt: false, git: true, branches: true, leer: false, pins: [], zweig: "main", modus: null, imBranch: null, regeln: "voll", kopie: false, fremd: false, vonSitz: false, gesichert: false, occupied: new Map() });

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
  const indexHtml = readFileSync(resolve(sourceRoot, "public/index.html"), "utf8");
  const k15Css = readFileSync(resolve(sourceRoot, "public/k15.css"), "utf8");
  let sitzungCss = readFileSync(resolve(sourceRoot, "public/sitzung.css"), "utf8");
  // a mutant of the stylesheet swaps its needle here; the bundles take theirs in the plugin above
  if (mutant?.file === "public/sitzung.css" && sitzungCss.includes(mutant.needle)) { applied = true; sitzungCss = sitzungCss.replace(mutant.needle, mutant.with); }
  if (!applied) { rmSync(scratch, { recursive: true, force: true }); throw new Error(`k15 start mutant: needle not in ${mutant?.file}: ${mutant?.needle.slice(0, 80)}`); }
  // the constellation a case drags in: one session „Nur Ordner“ (the only way the window makes one is a drop or an import)
  const ordnerJson = resolve(scratch, "nur-ordner.fleet.json");
  writeFileSync(ordnerJson, JSON.stringify({ format: 1, fleet: "konstellation", name: "Nur Ordner", version: 1, satz: "eine Session ohne Rolle", autor: "Fleet",
    positionen: [{ id: "o1", name: "Ordner-Session", profil: "ordner@1" }] }));

  let fx = fx0();
  const posts: { url: string; body: unknown }[] = [];
  const planReads: Record<string, string>[] = [];
  const deletes: string[] = [];
  const haltend: (() => void)[] = [];
  const dirsGehalten: { pfad: string; los: () => void }[] = [];
  let programReads = 0, inflight = 0;
  const now = Date.now();
  const slots = (): Record<string, unknown>[] => Array.from({ length: 16 }, (_, i) => {
    const id = i + 1;
    const taken = fx.occupied.get(id);
    if (taken) return { id, lastOutput: 0, ...taken };
    if (fx.leer) return { id, cwd: null, label: null, lastOutput: 0 };
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
      ...(q.has("ab") && fx.imBranch ? { modusImBranch: fx.imBranch } : {}),
      fassung: fassungOf(q, fx), fassungsHash: fassungKey(Object.fromEntries(q), fx.head), claudeCode: CC_FIXTURE,
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
      // a role's door writes its label, refuses any other and refuses a role a live seat holds (server/agenten.ts#agentAnDerTuer, server.ts#openSeatInFolder)
      const rolle = [...AGENTEN, ...(fx.kopie ? [KOPIE] : [])].find((x) => x.id === body.agent)?.wahlen.rolle;
      if (rolle && body.label !== undefined && body.label !== "Orchestrator")
        return { status: 409, body: { error: `agent „${String(body.agent)}“ is the role ${String(rolle)}; its label is „Orchestrator“` } };
      if (rolle && fx.orch) return { status: 409, body: { error: "The role Orchestrator is held by the seat in slot 2; end that seat first." } };
      if (rolle) body = { ...body, label: "Orchestrator" };
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
    if (id === "fremd") fx.gesichert = true;
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
        if (p === "/api/pins" && typeof body.path === "string") {
          fx.pins = body.on === false ? fx.pins.filter((x) => x !== body.path) : [body.path, ...fx.pins.filter((x) => x !== body.path)];
          return json(requestId, { ok: true, pins: fx.pins });
        }
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
      if (p === "/api/agenten") return json(requestId, { agenten: [...AGENTEN.map((x) => x.id === "pruefer" ? { ...x, zuletzt: now - 3_600_000 } : x), ...(fx.kopie ? [KOPIE] : []), ...(fx.fremd ? [fx.vonSitz ? { ...FREMD, importiert: undefined, vonSitz: 3 } : FREMD] : [])] });
      if (p === "/api/machine-settings") return json(requestId, { settings: [{ name: "FLEET_MIGRATE_PCT", value: 40 }, { name: "FLEET_LANE_MIGRATE_PCT", value: 37 },
        { name: "FLEET_MODEL", value: "claude-opus-5-5[1m]" }] });
      if (p === "/api/k15/eigenes") return json(requestId, { eigenes: { fassungen: [], packs: [], profile: [] } });
      if (p === "/api/dirs") {
        // the folder the picker stands in: the home holds one folder, notizen, which has no git; every pinned folder is in the answer
        // the server's reading of a path (server.ts#listDirs): ~ is the home, a trailing slash does not count, `.` and `..` are resolved, and a path
        // that is not absolute is read from the folder Fleet itself runs in; what is no folder is refused as listDirs refuses it
        const roh = u.searchParams.get("path") ?? "~";
        if (fx.dirsHalt.includes(roh)) return new Promise<void>((ok) => { dirsGehalten.push({ pfad: roh, los: () => { fx.dirsHalt = fx.dirsHalt.filter((x) => x !== roh); void serve(requestId, request).finally(() => ok()); } }); });
        const at = resolve("/fleet-clone", roh.trim() === "" ? "/fixture" : roh === "~" || roh.startsWith("~/") ? "/fixture" + roh.slice(1) : roh);
        if (at.includes("datei") || at.includes("nirgends")) return json(requestId, { error: `not a directory: ${at}` }, 400);
        if (at.endsWith("/gesperrt")) return json(requestId, { error: `EACCES: permission denied, scandir '/Users/fixture-account${at.slice("/fixture".length)}'` }, 400);
        const home = at === "/fixture";
        return json(requestId, { path: at, parent: home ? null : resolve(at, ".."), dirs: home ? ["notizen", ...(fx.gesperrt ? ["gesperrt"] : [])] : [], repos: [], git: false, pins: fx.pins });
      }
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
        for (const g of dirsGehalten.splice(0)) g.los();
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
        // the board shows slot 1
        await evaluate(`(() => { localStorage.clear(); localStorage.setItem('fleet.view', JSON.stringify({ layout: 1, panes: [1], focused: 0 }));
          localStorage.setItem('fleet.board', ${JSON.stringify(fx.board ? "1" : "0")}); })()`);
        await navigate("http://fleet.fixture/");
        if (fx.leer) {
          // a board fresh from the install: nothing open, nothing stored, the pane has no session
          await evaluate(`localStorage.clear()`);
          await navigate("http://fleet.fixture/");
          if (!await wait(`!!document.querySelector('#slots .slot.empty[data-slot="1"]') && document.body.classList.contains('noseats')`, 15000))
            throw new Error("the empty board never showed its free places: " + await evaluate<string>("document.body.innerText.slice(0, 300)"));
          await idle();
          return;
        }
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
        // the menu shows the first few ready agents; the rest follow „Show … more“
        await evaluate(`(() => { if (!${WIN}?.querySelector('.sfag[data-agent="${id}"]')) ${WIN}?.querySelector('.sfmehr')?.click(); })()`);
        await idle();
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

      // the picker takes a path (3.11.): typed, with ~ and a trailing slash, Enter or the Add beside the field; a refusal in one sentence under it
      const FELD = `${WIN}?.querySelector('.k15ordni')`;
      const oeffne = async () => { await click(`${WIN}?.querySelector('.sfanders')`); await wait(`!!${WIN}?.querySelector('.k15ordnz')`, 5000); };
      const enter = async () => {
        for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, ...(type === "keyDown" ? { text: "\r" } : {}) });
        await settle(150);
      };
      const gewaehltIst = (repo: string) => wait(`${WIN}?.querySelector('.sfrepo.sel')?.dataset.repo === '${repo}'`, 5000);
      // „In view“ is read from the element's own box against the viewport and every ancestor that clips
      const SICHT = (expr: string) => `(() => { const e = ${expr}; if (!e) return { da: false, ganz: false };
        const r = e.getBoundingClientRect(); let ganz = r.height > 0 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5;
        for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) {
          const o = getComputedStyle(a); if (o.overflowY === 'visible' && o.overflowX === 'visible') continue;
          const b = a.getBoundingClientRect(); if (r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5) ganz = false; }
        return { da: true, ganz, oben: Math.round(r.top), unten: Math.round(r.bottom) }; })()`;
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
            return { go: sieht(go) && !!r && r.left >= 0 && r.right <= innerWidth, zonen: sieht(${WIN}?.querySelector('.sfzone')) && sieht(${WIN}?.querySelector('.sfzone .sftiles.fl')),
              brief: sieht(hood) && !!hood.querySelector('.sfbk'), unter: !!sheet && !!hood && hood.getBoundingClientRect().top >= sheet.getBoundingClientRect().bottom - 1,
              repos: sieht(${WIN}?.querySelector('.sfrepos')), breit: Math.max(sf?.scrollWidth ?? 0, document.documentElement.scrollWidth), schirm: innerWidth,
              old: document.querySelectorAll('.fdgo, .fdkind').length }; })()`);
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
        await caseOf("ordner-pfad-phone", async () => {
          await fresh({ git: false });
          await tap("document.querySelector('#mpill')");
          await tap("document.querySelector('#mslot')");
          await wait("!!document.querySelector('#msheet .mshnew')", 3000);
          await settle(250);
          await tap("document.querySelector('#msheet .mshnew')");
          await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag')`, 10000);
          await idle();
          await tap(`${WIN}?.querySelector('.sfanders')`);
          await wait(`!!${WIN}?.querySelector('.k15ordnz')`, 5000);
          const fokus = await evaluate<boolean>(`document.activeElement === ${FELD}`);
          const da = await evaluate<boolean>(`!!${FELD} && ${FELD}.getBoundingClientRect().width > 100`);
          await tap(FELD);
          await send("Input.insertText", { text: "~/notizen/" }); await settle(80);
          await tap(`${WIN}?.querySelector('.k15ordng')`);
          await gewaehltIst("/fixture/notizen");
          const pins = posts.filter((x) => x.url === "/api/pins").map((x) => x.body);
          const breit = await evaluate<{ breit: number; schirm: number }>(`({ breit: document.documentElement.scrollWidth, schirm: innerWidth })`);
          facts.ordnerPfadPhone = { fokus, da, pins, ...breit };
          verdicts[C.ordnerPfadPhone] = !fokus && da && canon(pins) === canon([{ path: "/fixture/notizen", on: true }]) && breit.breit <= breit.schirm;
        });
        // the cursor the person put into the field stays there: through a redraw that comes while they type, and after a refusal from Add
        await caseOf("ordner-cursor-phone", async () => {
          await fresh({ git: false, dirinfoHalt: true });
          await tap("document.querySelector('#mpill')");
          await tap("document.querySelector('#mslot')");
          await wait("!!document.querySelector('#msheet .mshnew')", 3000);
          await settle(250);
          await tap("document.querySelector('#msheet .mshnew')");
          await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag')`, 10000);
          await tap(`${WIN}?.querySelector('.sfanders')`);
          await wait(`!!${WIN}?.querySelector('.k15ordnz')`, 5000);
          const da = () => evaluate<boolean>(`document.activeElement === ${FELD}`);
          const wert = () => evaluate<string>(`${FELD}?.value ?? ''`);
          const vorGezeichnet = await evaluate<string>(`${WIN}?.querySelector('.sfrepo.sel')?.textContent ?? ''`);
          await tap(FELD);
          await send("Input.insertText", { text: "~/nirg" }); await settle(80);
          const gehalten = haltend.length;
          for (const go of haltend.splice(0)) go();
          await wait(`(${WIN}?.querySelector('.sfrepo.sel')?.textContent ?? '') !== ${JSON.stringify(vorGezeichnet)}`, 4000);
          const nachRedraw = { fokus: await da(), wert: await wert() };
          await send("Input.insertText", { text: "ends" }); await settle(80);
          const getippt = await wert();
          // a refusal from Add: the cursor is in the field, and the next characters land there
          await tap(`${WIN}?.querySelector('.k15ordng')`);
          await wait(`!!${WIN}?.querySelector('.k15ordnm')`, 4000);
          const nachAbsage = { fokus: await da(), satz: await evaluate<string>(`${WIN}?.querySelector('.k15ordnm')?.textContent ?? ''`) };
          await evaluate(`${FELD}.select()`);
          await send("Input.insertText", { text: "~/notizen/" }); await settle(80);
          await tap(`${WIN}?.querySelector('.k15ordng')`);
          await gewaehltIst("/fixture/notizen");
          const pins = posts.filter((x) => x.url === "/api/pins").map((x) => x.body);
          facts.ordnerCursorPhone = { gehalten, vorGezeichnet, nachRedraw, getippt, nachAbsage, pins };
          verdicts[C.ordnerCursorPhone] = gehalten > 0 && nachRedraw.fokus && nachRedraw.wert === "~/nirg" && getippt === "~/nirgends"
            && nachAbsage.fokus && nachAbsage.satz === "That is not a folder." && canon(pins) === canon([{ path: "/fixture/notizen", on: true }]);
        });
        // THE CHOSEN FOLDER'S ROW IS IN VIEW (check of 3.11.: the row goes to the top of a list that stays scrolled where the picker was)
        await caseOf("ordner-gewaehlt-phone", async () => {
          const faelle: Record<string, unknown> = {};
          let alle = true;
          for (const n of [8, 20]) for (const weg of ["tippen", "add"] as const) {
            await fresh({ git: false, pins: Array.from({ length: n }, (_, i) => `/fixture/ordner-${String(i + 1).padStart(2, "0")}`) });
            await send("Emulation.setDeviceMetricsOverride", { width, height: 600, deviceScaleFactor: 1, mobile: true });
            await tap("document.querySelector('#mpill')");
            await tap("document.querySelector('#mslot')");
            await wait("!!document.querySelector('#msheet .mshnew')", 3000);
            await settle(250);
            await tap("document.querySelector('#msheet .mshnew')");
            await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag')`, 10000);
            await idle();
            // the folded list says „Change folder…“ first and „Another folder…“ after it
            if (await evaluate<boolean>(`/^Change/.test(${WIN}?.querySelector('.sfanders')?.textContent ?? '')`)) await tap(`${WIN}?.querySelector('.sfanders')`);
            await settle(150);
            await tap(`${WIN}?.querySelector('.sfanders')`);
            await wait(`!!${WIN}?.querySelector('.k15ordnz')`, 5000);
            if (weg === "tippen") { await tap(FELD); await send("Input.insertText", { text: "~/notizen/" }); await settle(80); await tap(`${WIN}?.querySelector('.k15ordng')`); }
            else await tap(`${WIN}?.querySelector('.k15ordnz .k15ordnadd')`);
            await gewaehltIst("/fixture/notizen");
            await settle(250); await idle();
            const zeile = await evaluate<{ da: boolean; ganz: boolean; oben?: number; unten?: number }>(SICHT(`${WIN}?.querySelector('.sfrepo.sel')`));
            const gut = zeile.da && zeile.ganz;
            faelle[`${n}-${weg}`] = { zeile, gut };
            alle &&= gut;
            if (artifacts) await shot(`k15-start-${width}-ordner-gewaehlt-${n}-${weg}`).catch(() => undefined);
          }
          facts.ordnerGewaehltPhone = faelle;
          verdicts[C.ordnerGewaehltPhone] = alle;
        });
        results.push({ width, height, claims, facts });
        continue;
      }

      // THE PATH FIELD HOLDS THE CURSOR (check of 3.11.: after a refusal and after any redraw of the window the keys went nowhere). A late answer of
      // GET /api/dirinfo is held until the case has typed part of a path, then let go: the redraw happens in every run.
      const escape = async () => {
        for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await settle(150);
      };
      await caseOf("ordner-cursor", async () => {
        await fresh({ git: false, dirinfoHalt: true });
        await click(`document.querySelector('#slots .slot.empty[data-slot="${FREE}"]')`);
        await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag')`, 10000);
        await click(`${WIN}?.querySelector('.sfanders')`);
        await wait(`!!${WIN}?.querySelector('.k15ordnz')`, 5000);
        const da = () => evaluate<boolean>(`document.activeElement === ${FELD}`);
        const wert = () => evaluate<string>(`${FELD}?.value ?? ''`);
        const satz = () => evaluate<string>(`${WIN}?.querySelector('.k15ordnm')?.textContent ?? ''`);
        const vorGezeichnet = await evaluate<string>(`${WIN}?.querySelector('.sfrepo.sel')?.textContent ?? ''`);
        await send("Input.insertText", { text: "~/not" }); await settle(80);
        const gehalten = haltend.length;
        for (const go of haltend.splice(0)) go();
        const gezeichnet = await wait(`(${WIN}?.querySelector('.sfrepo.sel')?.textContent ?? '') !== ${JSON.stringify(vorGezeichnet)}`, 4000);
        const nachRedraw = { fokus: await da(), wert: await wert() };
        await send("Input.insertText", { text: "izen/x" }); await settle(80);
        const getippt = await wert();
        // a path that is no folder: the cursor stays; the next characters land; a second Enter sends what stands there
        await evaluate(`${FELD}.select()`);
        await send("Input.insertText", { text: "/fixture/nirgends" }); await settle(80);
        await enter();
        await wait(`!!${WIN}?.querySelector('.k15ordnm')`, 4000);
        const nachEnter = { fokus: await da(), satz: await satz() };
        await send("Input.insertText", { text: "X" }); await settle(80);
        const nachX = { wert: await wert(), satzWeg: (await satz()) === "" };
        await enter();
        await wait(`!!${WIN}?.querySelector('.k15ordnm')`, 4000);
        const zweiteAbsage = { fokus: await da(), satz: await satz(), wert: await wert() };
        // …and the same from the Add beside the field
        await evaluate(`${FELD}.select()`);
        await send("Input.insertText", { text: "/fixture/datei.txt" }); await settle(80);
        await click(`${WIN}?.querySelector('.k15ordng')`);
        await wait(`!!${WIN}?.querySelector('.k15ordnm')`, 4000);
        const nachAdd = { fokus: await da(), satz: await satz() };
        await send("Input.insertText", { text: "!" }); await settle(80);
        const nachAddGetippt = await wert();
        // a corrected path goes with Enter
        await evaluate(`${FELD}.select()`);
        await send("Input.insertText", { text: "~/notizen/" }); await settle(80);
        await enter();
        await gewaehltIst("/fixture/notizen");
        // Add on the folder being read and Back: the menu is as it was
        await oeffne();
        await click(`${WIN}?.querySelector('.k15ordnhier')`);
        await gewaehltIst("/fixture");
        await oeffne();
        await click(`${WIN}?.querySelector('.k15ordner .k15link')`);
        const zurueck = await wait(`!${WIN}?.querySelector('.k15ordner') && !!${WIN}?.querySelector('.k15repomenu .k15repo')`, 4000);
        // Escape closes the menu first, then the window
        await oeffne();
        await escape();
        const menueZu = await wait(`!${WIN}?.querySelector('.k15repomenu')`, 3000) && await open();
        await escape();
        const fensterZu = await wait(`!${WIN}`, 3000);
        const pins = posts.filter((x) => x.url === "/api/pins").map((x) => x.body);
        facts.ordnerCursor = { gehalten, gezeichnet, vorGezeichnet, nachRedraw, getippt, nachEnter, nachX, zweiteAbsage, nachAdd, nachAddGetippt, zurueck, menueZu, fensterZu, pins };
        verdicts[C.ordnerCursor] = gehalten > 0 && gezeichnet && nachRedraw.fokus && nachRedraw.wert === "~/not" && getippt === "~/notizen/x"
          && nachEnter.fokus && nachEnter.satz === "That is not a folder." && nachX.wert === "/fixture/nirgendsX" && nachX.satzWeg
          && zweiteAbsage.fokus && zweiteAbsage.satz === "That is not a folder." && zweiteAbsage.wert === "/fixture/nirgendsX"
          && nachAdd.fokus && nachAdd.satz === "That is not a folder." && nachAddGetippt === "/fixture/datei.txt!"
          && zurueck && menueZu && fensterZu
          && canon(pins) === canon([{ path: "/fixture/notizen", on: true }, { path: "/fixture", on: true }]);
      });

      // A RELATIVE PATH means the folder the line above the field shows (check of 3.11.: it was read from the folder Fleet runs in)
      await caseOf("ordner-relativ", async () => {
        await fresh({ git: false });
        await fenster();
        const gesetzt = async (text: string, wohin: string) => {
          await oeffne();
          if (wohin === "unten") { await click(`${WIN}?.querySelector('.k15ordnb')`); await wait(`${WIN}?.querySelector('.k15ordnp')?.textContent === '/fixture/notizen'`, 5000); }
          await type(FELD, text);
          await enter();
          await wait(`!${WIN}?.querySelector('.k15ordner')`, 4000);
        };
        await gesetzt("notizen", "home");           // a name in the folder shown
        await gesetzt("..", "unten");               // one up from the folder stepped into
        await gesetzt(".", "unten");                // the folder shown itself
        await gesetzt("$HOME/notizen/", "home");    // as a terminal writes it
        await gesetzt("~/mein\\ agent", "home");    // a space written for a shell
        const pins = posts.filter((x) => x.url === "/api/pins").map((x) => (x.body as { path: string }).path);
        facts.ordnerRelativ = { pins };
        verdicts[C.ordnerRelativ] = canon(pins) === canon(["/fixture/notizen", "/fixture", "/fixture/notizen", "/fixture/notizen", "/fixture/mein agent"]);
      });

      // A FOLDER FLEET MAY NOT READ says so in plain words (check of 3.11.: the system message with a path that names the machine's account)
      await caseOf("ordner-satz", async () => {
        await fresh({ git: false, gesperrt: true });
        await fenster();
        await oeffne();
        await type(FELD, "~/gesperrt");
        await enter();
        await wait(`!!${WIN}?.querySelector('.k15ordnm')`, 4000);
        const getippt = await evaluate<string>(`${WIN}?.querySelector('.k15ordnm')?.textContent ?? ''`);
        // …and the same folder opened in the tree
        await click(`${WIN}?.querySelector('.k15ordnz:last-child .k15ordnb')`);
        await wait(`!!${WIN}?.querySelector('.k15ordner > .k15leer')`, 4000);
        const baum = await evaluate<string>(`${WIN}?.querySelector('.k15ordner > .k15leer')?.textContent ?? ''`);
        const fenstertext = await evaluate<string>(`${WIN}?.innerText ?? ''`);
        const pins = posts.filter((x) => x.url === "/api/pins").length;
        facts.ordnerSatz = { getippt, baum, pins };
        verdicts[C.ordnerSatz] = getippt === "Fleet cannot read that folder." && baum === getippt && pins === 0 && !/EACCES|permission|fixture-account|\/Users\//i.test(fenstertext);
      });

      // NO KEY IS LOST AROUND THE FIRST LISTING (check of 3.11.): the listing of ~ and the typed folder's own answer are both held; the cursor is
      // in the field, the text lands, Enter is pressed, then the listing arrives first and the folder's answer after it
      await caseOf("ordner-frueh", async () => {
        await fresh({ git: false });
        await fenster();
        fx.dirsHalt = ["~", "~/notizen/"];   // after the window's own read of the pinned folders
        await click(`${WIN}?.querySelector('.sfanders')`);
        await wait(`!!${FELD}`, 3000);
        const fokus = await evaluate<boolean>(`document.activeElement === ${FELD}`);
        const ohneListe = await evaluate<boolean>(`!${WIN}?.querySelector('.k15ordnz')`);
        await send("Input.insertText", { text: "~/notizen/" }); await settle(80);
        const wert = await evaluate<string>(`${FELD}?.value ?? ''`);
        await enter();
        for (const bis = Date.now() + 3000; dirsGehalten.length < 2 && Date.now() < bis;) await Bun.sleep(20);
        const gehalten = dirsGehalten.map((g) => g.pfad);
        const los = (pfad: string) => dirsGehalten.find((g) => g.pfad === pfad)?.los();
        los("~");
        const listeDa = await wait(`!!${WIN}?.querySelector('.k15ordnz')`, 4000);
        const nachListe = { fokus: await evaluate<boolean>(`document.activeElement === ${FELD}`), wert: await evaluate<string>(`${FELD}?.value ?? ''`) };
        los("~/notizen/");
        await gewaehltIst("/fixture/notizen");
        const pins = posts.filter((x) => x.url === "/api/pins").map((x) => x.body);
        facts.ordnerFrueh = { fokus, ohneListe, wert, gehalten, listeDa, nachListe, pins };
        verdicts[C.ordnerFrueh] = fokus && ohneListe && wert === "~/notizen/" && canon(gehalten) === canon(["~", "~/notizen/"]) && listeDa
          && nachListe.fokus && nachListe.wert === "~/notizen/" && canon(pins) === canon([{ path: "/fixture/notizen", on: true }]);
      });

      // THE PICKER IS NEVER SQUASHED (check of 3.11.: with five folders in the list at a laptop-height window the field was cut off and a refusal stood
      // outside the visible list). Nothing here presses the field or the sentence: a press scrolls its target into view and would hide the fault.
      // „In view“ is read from the element's own box against the viewport and every ancestor that clips.
      await caseOf("ordner-sicht", async () => {
        const faelle: Record<string, unknown> = {};
        let alle = true;
        for (const hoehe of [720, 900]) for (const n of [5, 8, 20]) {
          const name = `${hoehe}-${n}`;
          await fresh({ git: false, pins: Array.from({ length: n }, (_, i) => `/fixture/ordner-${String(i + 1).padStart(2, "0")}`) });
          await send("Emulation.setDeviceMetricsOverride", { width, height: hoehe, deviceScaleFactor: 1, mobile: false });
          await fenster();
          await oeffne();
          await settle(150);
          const feld = await evaluate<{ da: boolean; ganz: boolean; oben?: number; unten?: number }>(SICHT(`${WIN}?.querySelector('.k15ordnfw')`));
          const baum = await evaluate<{ hoch: number; inhalt: number }>(`(() => { const b = ${WIN}?.querySelector('.k15ordner'); return b ? { hoch: b.clientHeight, inhalt: b.scrollHeight } : { hoch: 0, inhalt: 1 }; })()`);
          await send("Input.insertText", { text: "~/nirgends" }); await settle(80);
          await enter();
          await wait(`!!${WIN}?.querySelector('.k15ordnm')`, 4000);
          await settle(150);
          const satz = await evaluate<{ da: boolean; ganz: boolean; oben?: number; unten?: number }>(SICHT(`${WIN}?.querySelector('.k15ordnm')`));
          const feldNach = await evaluate<{ da: boolean; ganz: boolean }>(SICHT(`${WIN}?.querySelector('.k15ordni')`));
          const gut = feld.da && feld.ganz && baum.hoch >= baum.inhalt - 1 && satz.da && satz.ganz && feldNach.ganz;
          faelle[name] = { feld, baum, satz, feldNach, gut };
          alle &&= gut;
          if (artifacts) await shot(`k15-start-${width}-ordner-sicht-${name}`).catch(() => undefined);
        }
        facts.ordnerSicht = faelle;
        verdicts[C.ordnerSicht] = alle;
      });

      // THE CHOSEN FOLDER'S ROW IS IN VIEW (check of 3.11.: the row goes to the top of a list that stays scrolled where the picker was, and only the
      // toast names the folder). Typed with Enter, and by the Add of a row in the tree, which the press scrolls into the middle of the list first.
      await caseOf("ordner-gewaehlt", async () => {
        const faelle: Record<string, unknown> = {};
        let alle = true;
        for (const hoehe of [720, 900]) for (const n of [8, 20]) for (const weg of ["tippen", "add"] as const) {
          await fresh({ git: false, pins: Array.from({ length: n }, (_, i) => `/fixture/ordner-${String(i + 1).padStart(2, "0")}`) });
          await send("Emulation.setDeviceMetricsOverride", { width, height: hoehe, deviceScaleFactor: 1, mobile: false });
          await fenster();
          await oeffne();
          await settle(150);
          if (weg === "tippen") { await send("Input.insertText", { text: "~/notizen/" }); await settle(80); await enter(); }
          else await click(`${WIN}?.querySelector('.k15ordnz .k15ordnadd')`);
          await gewaehltIst("/fixture/notizen");
          await settle(250); await idle();
          const zeile = await evaluate<{ da: boolean; ganz: boolean; oben?: number; unten?: number }>(SICHT(`${WIN}?.querySelector('.sfrepo.sel')`));
          const gut = zeile.da && zeile.ganz;
          faelle[`${hoehe}-${n}-${weg}`] = { zeile, gut };
          alle &&= gut;
          if (artifacts) await shot(`k15-start-${width}-ordner-gewaehlt-${hoehe}-${n}-${weg}`).catch(() => undefined);
        }
        facts.ordnerGewaehlt = faelle;
        verdicts[C.ordnerGewaehlt] = alle;
      });

      // A LATE ANSWER CANNOT REACH A REOPENED PICKER (check of 3.11.): the answer for the typed path is held, the picker closed with Escape and
      // opened again; only then the answer is let go. Both runs of the held answer happen in every run.
      await caseOf("ordner-spaet", async () => {
        const lauf = async (alt: string, neu: string) => {
          await fresh({ git: false });
          await fenster();
          fx.dirsHalt = [alt];
          await oeffne();
          await type(FELD, alt);
          await enter();
          for (const bis = Date.now() + 3000; !dirsGehalten.some((g) => g.pfad === alt) && Date.now() < bis;) await Bun.sleep(20);
          const gehalten = dirsGehalten.some((g) => g.pfad === alt);
          await escape();   // the menu first: the picker is gone, the window stays
          const zu = await wait(`!${WIN}?.querySelector('.k15ordner')`, 3000);
          await oeffne();
          await type(FELD, neu);
          dirsGehalten.find((g) => g.pfad === alt)?.los();
          await settle(300); await idle(); await settle(100);
          return { gehalten, zu,
            pins: posts.filter((x) => x.url === "/api/pins").length,
            offen: await evaluate<boolean>(`!!${WIN}?.querySelector('.k15ordner')`),
            wert: await evaluate<string>(`${FELD}?.value ?? ''`),
            satz: await evaluate<string>(`${WIN}?.querySelector('.k15ordnm')?.textContent ?? ''`) };
        };
        const gut = await lauf("~/notizen/", "~/anderes");     // the old path is a folder: it must not be pinned
        const abgesagt = await lauf("~/nirgends", "~/anderes");   // the old path is no folder: its refusal must not show
        facts.ordnerSpaet = { gut, abgesagt };
        verdicts[C.ordnerSpaet] = [gut, abgesagt].every((l) => l.gehalten && l.zu && l.pins === 0 && l.offen && l.wert === "~/anderes" && l.satz === "");
      });

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
        await evaluate(`${WIN}?.querySelector('.sfmehr')?.click()`);
        await idle();
        const seen = await evaluate<{ sitz: boolean; titel: string | null; repo: string | null; agenten: string[]; old: number }>(`({
          sitz: !!document.querySelector('#shell-found.k15sitz .sf.s1'), titel: ${WIN}?.querySelector('.shellhead h2')?.textContent ?? null,
          repo: ${WIN}?.querySelector('.sfrepo.sel')?.dataset.repo ?? null, agenten: [...(${WIN}?.querySelectorAll('.sfag') ?? [])].map((b) => b.dataset.agent),
          old: document.querySelectorAll('.fdgo, .fdkind').length })`);
        facts.open = { ok, ...seen };
        verdicts[C.open] = ok && seen.sitz && seen.titel === "New session" && seen.repo === REPO && seen.agenten[0] === "repo"
          && seen.agenten.includes("pruefer") && seen.old === 0;
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

      // THE HARNESS ITSELF (owner 26.10.): under Who it is, the Harness block carries Claude Code as the standard and every other
      // harness GET /api/harnesses says starts here; choosing Codex brings Codex's models and effort, and the start carries exactly it
      await caseOf("harness", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        const zone = () => evaluate<{ titel: string; who: string[]; claudeNur: string[]; har: string[] }>(`(() => {
          const w = ${WIN}, teil = [...(w?.querySelectorAll('.sfzone .sfpart') ?? [])].find((p) => p.querySelector('.sfplabel')?.textContent === 'Who');
          return { titel: w?.querySelector('select[data-k="harness"]')?.selectedOptions[0]?.textContent ?? '',
            who: [...(teil?.querySelectorAll('.sftile') ?? [])].map((t) => t.dataset.b),
            claudeNur: ['rules', 'skills', 'connectors', 'permissions', 'plan', 'hooks', 'rights', 'notebook', 'succession'].filter((id) => !!w?.querySelector('.sftile[data-b="' + id + '"]')),
            har: [...(w?.querySelector('select[data-k="harness"]')?.options ?? [])].map((o) => o.value + '=' + o.textContent) }; })()`);
        const banner = () => evaluate<{ dev: boolean; chips: string[] }>(`(() => { const b = ${WIN}?.querySelector('.sfbanner');
          return { dev: !!b?.classList.contains('dev'), chips: [...(b?.querySelectorAll('.sfdchip') ?? [])].map((c) => c.textContent) }; })()`);
        const vorher = await zone();
        // the pill the window draws is a real select: set it and let it change, as a hand does
        await evaluate(`(() => { const x = ${WIN}?.querySelector('select[data-k="harness"]'); x.value = 'codex'; x.dispatchEvent(new Event('change')); })()`);
        await idle();
        const nachher = await zone(), erst = await banner();
        const heroCodex = await evaluate<string>(`${WIN}?.querySelector('.sfhero .sfpurpose')?.textContent ?? ''`);
        // its models and effort levels are the catalogue's for Codex, and the choice goes into the preview with the harness
        await block("model");
        const modelle = await evaluate<string[]>(`[...(${WIN}?.querySelectorAll('.sftile[data-b="model"] select[data-k="model"] option') ?? [])].map((o) => o.value)`);
        const stufen = await evaluate<string[]>(`[...(${WIN}?.querySelectorAll('.sfdrawer .sfseg [data-effort]') ?? [])].map((b) => b.dataset.effort)`);
        await option("model:gpt-5.5");
        await click(`${WIN}?.querySelector('.sfdrawer .sfseg [data-effort="high"]')`);
        await idle();
        const gelesen = vorschauen().filter((q) => q.harness === "codex");
        const mit = (q: Record<string, string>) => JSON.stringify(q) === JSON.stringify({ harness: "codex", model: "gpt-5.5", effort: "high" });
        const h = fassungDerVorschau(mit);
        const s = await sfStart();
        const pruef = { a: vorher.titel === "Claude Code", b: JSON.stringify(vorher.who) === JSON.stringify(["harness", "model"]),
          c: vorher.claudeNur.length === 9, d: JSON.stringify(vorher.har) === JSON.stringify(["=Claude Code", "codex=Codex"]),
          e: nachher.titel === "Codex", f: JSON.stringify(nachher.who) === JSON.stringify(["harness", "model"]), g: nachher.claudeNur.length === 0,
          h: JSON.stringify(nachher.har) === JSON.stringify(["=Claude Code", "codex=Codex"]), i: erst.dev,
          j: JSON.stringify(erst.chips) === JSON.stringify(["~Harness: Codex"]), k: JSON.stringify(modelle) === JSON.stringify(["", "gpt-5.5"]),
          l: JSON.stringify(stufen) === JSON.stringify(["", "low", "medium", "high"]), m: gelesen.some((q) => JSON.stringify(q) === JSON.stringify({ harness: "codex" })),
          n: gelesen.some(mit), o: h !== null, p: s.length === 1, q: s[0]?.url === `/api/slots/${FREE}/open`,
          r: s[0] ? canon(s[0].body) === canon({ cwd: REPO, fassung: h, harness: "codex", model: "gpt-5.5", effort: "high" }) : false,
          s: heroCodex === "Codex with what Fleet adds on top." };
        facts.harness = { pruef, heroCodex, vorher, nachher, erst, modelle, stufen, gelesen, posts: s, expect: h, body: s[0]?.body };
        verdicts[C.harness] = Object.values(pruef).every(Boolean);
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
        // DER SATZ DER GEWÄHLTEN STUFE STEHT IM AUFGEKLAPPTEN BLOCK (main rot am 28.10., „[Zitat entfernt]“): der Startbrief zeigt den
        // Rechte-Block nur, wenn der „[Zitat entfernt]“-Satz sich von dem ohne Wahl unterscheidet (src/start-brief.ts), und dieser Satz kommt aus
        // server/tuer-rechte.ts#rechteZeilen. Eine Fassung, die die Stufe nicht nennt, trägt denselben Satz wie ohne Wahl, kein Block
        // erscheint, und „Looks only“ wäre im Brief unsichtbar. Darum muss der Block den Satz von „lesen“ selbst tragen.
        const stufeSatz = rechteSatz({ stufe: "lesen", an: [], aus: [] });
        facts.rechte = { stufe, gelesen, satz, stufeSatz, posts: s, expect: h };
        verdicts[C.rechte] = stufe === "Builds" && gelesen.bauen && gelesen.lesen && satz?.zeichen === "+"
          && satz.text.startsWith("FLEET SERVER RIGHTS (checked at Fleet's doors):") && satz.text.includes("seat.open — open a seat")
          && satz.text.includes(stufeSatz)
          && h !== null && s.length === 1 && canon(s[0]!.body) === canon({ cwd: REPO, fassung: h, rechte: { stufe: "lesen", an: [], aus: [] } });
      });

      // EACH CONTEXT PACK A STONE (owner 25.10.: „[Zitat entfernt]“): rows under Fleet on top, a switch each; one
      // switched on goes into the preview, the start brief, the banner and the start as exactly that pack
      await caseOf("packs", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        // each kind under „What it knows“ with the stones that follow its name
        const reihen = () => evaluate<{ reihe: string; packs: { id: string; an: string | null }[] }[]>(`[...(${WIN}?.querySelectorAll('.sfzone .sfpart') ?? [])]
          .filter((p) => p.querySelector('.sfplabel')?.textContent === 'Reads').flatMap((p) => [...p.querySelectorAll('.sfart')].map((a) => ({
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

      // PLAN FIRST, a choice of its own beside Asks you (owner 25.10. 19:50): Asks you offers five with No limits last, none of them chosen (owner 1.11.), Plan first goes as the plan mode
      await caseOf("plan", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        const fragt = await evaluate<string[]>(`[...(${WIN}?.querySelector('select[data-k="permissions"]')?.options ?? [])].map((o) => o.value)`);
        const gewaehlt = await evaluate<string | null>(`${WIN}?.querySelector('select[data-k="permissions"]')?.value ?? null`);
        await evaluate(`(() => { const x = ${WIN}?.querySelector('select[data-k="plan"]'); x.value = 'an'; x.dispatchEvent(new Event('change')); })()`);
        await idle();
        const b = await banner();
        const PLAN = (q: Record<string, string>) => Object.keys(q).join() === "permissionMode" && q.permissionMode === "plan";
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const gelesen = vorschauen().some(PLAN), h = fassungDerVorschau(PLAN);
        const s = await sfStart();
        facts.plan = { fragt, gewaehlt, banner: b.chips, gelesen, posts: s, expect: h };
        verdicts[C.plan] = canon(fragt) === canon(["", "manual", "acceptEdits", "auto", "dontAsk", "bypassPermissions"]) && gewaehlt === "" && canon(b.chips) === canon(["plan:+Plan first"])
          && gelesen && h !== null && s.length === 1 && canon(s[0]!.body) === canon({ cwd: REPO, fassung: h, permissionMode: "plan" });
      });

      // the stone Branch & land in a repo without a merge check: its commits on their own branch, no land promised
      await caseOf("ohne-check", async () => {
        await fresh();
        await fenster();
        await mitAgent("repo");
        const knopf = await evaluate<string>(`${WIN}?.querySelector('.sftile[data-b="branch"]')?.title ?? ''`);
        await dazu("branch");
        const satz = await evaluate<string>(`${WIN}?.querySelector('.sftile[data-b="branch"]')?.title ?? ''`);
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
          const adds = await evaluate<string[]>(`[...(${WIN}?.querySelectorAll('.sfzone .sftile.stein[data-b]') ?? [])].map((b) => b.dataset.b ?? '')`);
          await block("workplace");
          const platz = await evaluate<{ drawer: boolean; branch: boolean }>(`({ drawer: !!${WIN}?.querySelector('.sfdrawer'),
            branch: !!${WIN}?.querySelector('.sfopt[data-set="workplace:branch"]') })`);
          return { adds, ...platz, ok: adds.includes("rights") && adds.includes("task") && !adds.includes("branch") && !adds.includes("notebook") && platz.drawer && !platz.branch };
        };
        const ordner = await blick({ git: false }), fremd = await blick({ branches: false });
        facts.ohneGit = { ordner, fremd };
        verdicts[C.ohneGit] = ordner.ok && fremd.ok;
      });

      // „Another folder…“ takes a folder without git: the row's own Add and Add <folder> in the listing, each one pins and chooses it
      await caseOf("ordner-ohne-git", async () => {
        await fresh({ git: false });
        await fenster();
        const picker = async () => { await click(`${WIN}?.querySelector('.sfanders')`); await wait(`!!${WIN}?.querySelector('.k15ordnz')`, 5000); };
        await picker();
        const zeileHat = await evaluate<boolean>(`!!${WIN}?.querySelector('.k15ordnz .k15ordnadd')`);
        await click(`${WIN}?.querySelector('.k15ordnz .k15ordnadd')`);
        await wait(`${WIN}?.querySelector('.sfrepo.sel')?.dataset.repo === '/fixture/notizen'`, 5000);
        const gewaehlt = await evaluate<{ repo: string | null; abzeichen: string | null }>(`({ repo: ${WIN}?.querySelector('.sfrepo.sel')?.dataset.repo ?? null,
          abzeichen: ${WIN}?.querySelector('.sfrepo.sel .sfbd')?.textContent ?? null })`);
        await picker();
        const hierOffen = await evaluate<boolean>(`!!${WIN}?.querySelector('.k15ordnhier') && !${WIN}.querySelector('.k15ordnhier').disabled`);
        await click(`${WIN}?.querySelector('.k15ordnhier')`);
        await wait(`${WIN}?.querySelector('.sfrepo.sel')?.dataset.repo === '/fixture'`, 5000);
        const pins = posts.filter((x) => x.url === "/api/pins").map((x) => x.body);
        facts.ordnerOhneGit = { zeileHat, gewaehlt, hierOffen, pins };
        verdicts[C.ordnerOhneGit] = zeileHat && hierOffen && gewaehlt.repo === "/fixture/notizen" && gewaehlt.abzeichen === "no git"
          && canon(pins) === canon([{ path: "/fixture/notizen", on: true }, { path: "/fixture", on: true }]);
      });

      await caseOf("ordner-pfad", async () => {
        await fresh({ git: false });
        await fenster();
        await oeffne();
        await idle();
        const fokusOffen = await evaluate<boolean>(`document.activeElement === ${FELD}`);
        facts.ordnerPfadMedium = await evaluate<string>(`matchMedia('(hover: hover) and (pointer: fine)').matches + ' ' + (document.activeElement?.className ?? '') + ' ' + document.hasFocus()`);
        // a step down the tree keeps the cursor where the person put it
        await evaluate(`${FELD}.blur()`);
        await click(`${WIN}?.querySelector('.k15ordnb')`);
        await wait(`${WIN}?.querySelector('.k15ordnp')?.textContent === '/fixture/notizen'`, 5000);
        const fokusNachBaum = await evaluate<boolean>(`document.activeElement === ${FELD}`);
        // …and the path line is read in its order
        const zeile = await evaluate<{ text: string; links: boolean }>(`(() => { const t = ${WIN}.querySelector('.k15ordnp bdi') ?? ${WIN}.querySelector('.k15ordnp'); const n = t.firstChild; const r = document.createRange();
          r.setStart(n, 0); r.setEnd(n, 1); const a = r.getBoundingClientRect(); r.setStart(n, n.length - 1); r.setEnd(n, n.length); const b = r.getBoundingClientRect();
          return { text: t.textContent, links: a.left < b.left }; })()`);
        facts.ordnerPfadLesen = zeile;
        verdicts[C.ordnerPfadLesen] = zeile.text === "/fixture/notizen" && zeile.links;
        // a path that is no folder: one sentence, nothing pinned, the picker stays
        await type(FELD, "/fixture/datei.txt");
        await enter();
        await wait(`!!${WIN}?.querySelector('.k15ordnm')`, 5000);
        const nein = await evaluate<{ satz: string | null; offen: boolean; wert: string }>(`({ satz: ${WIN}?.querySelector('.k15ordnm')?.textContent ?? null, offen: !!${WIN}?.querySelector('.k15ordner'), wert: ${FELD}?.value ?? '' })`);
        const pinsNein = posts.filter((x) => x.url === "/api/pins").length;
        // typed with ~ and a trailing slash, sent with Enter
        await evaluate(`(() => { const f = ${FELD}; f.focus(); f.select(); })()`);
        await send("Input.insertText", { text: "~/notizen/" }); await settle(80);
        const satzWeg = await evaluate<boolean>(`!${WIN}?.querySelector('.k15ordnm')`);
        await enter();
        await gewaehltIst("/fixture/notizen");
        // and the Add beside the field does the same
        await oeffne();
        await type(FELD, "/fixture");
        await click(`${WIN}?.querySelector('.k15ordng')`);
        await gewaehltIst("/fixture");
        const pins = posts.filter((x) => x.url === "/api/pins").map((x) => x.body);
        facts.ordnerPfad = { fokusOffen, fokusNachBaum, nein, pinsNein, satzWeg, pins };
        verdicts[C.ordnerPfad] = fokusOffen && !fokusNachBaum && nein.satz === "That is not a folder." && nein.offen && nein.wert === "/fixture/datei.txt" && pinsNein === 0 && satzWeg
          && canon(pins) === canon([{ path: "/fixture/notizen", on: true }, { path: "/fixture", on: true }]);
      });
      // a board fresh from the install: the pane offers one thing, on top of the terminal; with a seat open it does not
      await caseOf("leere-flotte", async () => {
        const knopf = `(() => { const b = document.querySelector('.panehint .hintgo'); if (!b) return { da: false, oben: false };
          const r = b.getBoundingClientRect(); const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { da: r.width > 0 && r.height > 0, oben: at === b || b.contains(at) }; })()`;
        await fresh({ leer: true });
        const leer = await evaluate<{ da: boolean; oben: boolean }>(knopf);
        await click(`document.querySelector('.panehint .hintgo')`);
        const fensterAuf = await wait(`!!${WIN}`, 8000);
        await fresh();
        const belegt = await evaluate<{ da: boolean; oben: boolean }>(knopf);
        facts.leereFlotte = { leer, fensterAuf, belegt };
        verdicts[C.leereFlotte] = leer.da && leer.oben && fensterAuf && !belegt.da;
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
        const { label, ...ohneLabel } = (s[0]?.body ?? {}) as Record<string, unknown>;
        agentChecks.push(h !== null && s.length === 1 && canon(ohneLabel) === canon({ cwd: REPO, fassung: h, agent: "pruefer" }));
        verdicts[C.agentLabel] = s.length === 1 && label === "Prüfer";
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
        verdicts[C.agent] = agentChecks.length === 4 && agentChecks.every(Boolean);
      });
      await caseOf("agent-orchestratorin", async () => {
        await fresh();
        await fenster();
        await mitAgent("orchestratorin");
        const b = await banner();
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const s = await sfStart();
        const kopie = fassungDerVorschau((q) => q.agent === "copy-of-orchestratorin");
        facts.agentOrch = { banner: b, posts: s, expect: kopie };
        verdicts[C.agentRolle] = b.art === "fleet" && kopie !== null && s.length === 1 && s[0]!.url === `/api/slots/${FREE}/open`
          && canon(s[0]!.body) === canon({ cwd: REPO, fassung: kopie, agent: "copy-of-orchestratorin" });
      });

      // THE START OF A ROW: the first thing a newcomer presses starts at once, past the agent's page
      await caseOf("bereit", async () => {
        const start = async (id: string, set: Partial<Fx> = {}) => {
          await fresh(set);
          await click(`document.querySelector('#slots .slot.empty[data-slot="${FREE}"]')`);
          if (!await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag')`, 10000)) throw new Error("the start window did not open");
          await idle();
          await evaluate(`(() => { if (!${WIN}?.querySelector('.sfag[data-agent="${id}"]')) ${WIN}?.querySelector('.sfmehr')?.click(); })()`);
          await idle();
          await click(`${WIN}?.querySelector('.sfag[data-agent="${id}"] .sfstart')`);
          await wait(`!${WIN}`, 6000);
          await idle();
          return { posts: starts(), open: await open(), shown: await shown(), started };
        };
        const plain = await start("repo");
        const hPlain = fassungDerVorschau((q) => Object.keys(q).length === 0);
        const orch = await start("orchestratorin");
        const hOrch = fassungDerVorschau((q) => q.agent === "orchestratorin");
        const kopie = await start(KOPIE.id, { kopie: true });
        const hKopie = fassungDerVorschau((q) => q.agent === KOPIE.id);
        const gespeichert = await start("pruefer");
        const hGespeichert = fassungDerVorschau((q) => q.agent === "pruefer");
        facts.bereit = { plain, hPlain, orch, hOrch, kopie, hKopie, gespeichert, hGespeichert };
        const zu = (r: typeof plain) => r.started !== null && !r.open && r.shown === String(r.started);
        verdicts[C.bereit] = hPlain !== null && hOrch !== null && hKopie !== null && zu(plain) && zu(orch) && zu(kopie)
          && canon(plain.posts.map((x) => x.body)) === canon([{ cwd: REPO, fassung: hPlain }])
          && canon(orch.posts.map((x) => x.body)) === canon([{ cwd: REPO, fassung: hOrch, agent: "orchestratorin" }])
          && canon(kopie.posts.map((x) => x.body)) === canon([{ cwd: REPO, fassung: hKopie, agent: KOPIE.id }])
          && hGespeichert !== null && zu(gespeichert) && canon(gespeichert.posts.map((x) => x.body)) === canon([{ cwd: REPO, fassung: hGespeichert, agent: "pruefer", label: AGENTEN.find((x) => x.id === "pruefer")!.name }]);
      });
      // ...and refused: a live seat holds the role, the door says so in one sentence, and the window shows it where it shows every refusal
      await caseOf("rolle-gehalten", async () => {
        await fresh({ orch: true, kopie: true });
        await fenster();
        await evaluate(`(() => { if (!${WIN}?.querySelector('.sfag[data-agent="${KOPIE.id}"]')) ${WIN}?.querySelector('.sfmehr')?.click(); })()`);
        await idle();
        await click(`${WIN}?.querySelector('.sfag[data-agent="${KOPIE.id}"] .sfstart')`);
        await wait(`!!${WIN}?.querySelector('.sffehler')`, 6000);
        await idle();
        const satz = await evaluate<string>(`${WIN}?.querySelector('.sffehler')?.textContent ?? ''`);
        facts.rolleGehalten = { satz, posts: starts() };
        const reihe = await open() && satz === "The role Orchestrator is held by the seat in slot 2; end that seat first." && started === null;
        // ...and the page's own Start: the window stays, and the sentence stands under Start
        await fresh({ orch: true, kopie: true });
        await fenster();
        await mitAgent(KOPIE.id);
        await click(SFGO);
        await wait(`(${WIN}?.querySelector('.sfhint')?.textContent ?? '').startsWith('The role')`, 6000);
        await idle();
        const unten = await evaluate<{ satz: string; warn: boolean }>(`(() => { const h = ${WIN}?.querySelector('.sfhint'); return { satz: h?.textContent ?? '', warn: !!h?.classList.contains('warn') }; })()`);
        facts.rolleGehaltenSeite = unten;
        verdicts[C.rolleGehalten] = reihe && await open() && unten.warn && unten.satz === "The role Orchestrator is held by the seat in slot 2; end that seat first." && started === null;
      });
      // what the page says about the mode and about what Fleet gives
      await caseOf("modus-ohne-wahl", async () => {
        const liest = async (id: string, set: Partial<Fx>) => {
          await fresh(set);
          await fenster();
          await mitAgent(id);
          return evaluate<{ erste: string | null; gewaehlt: string | null }>(`(() => { const x = ${WIN}?.querySelector('select[data-k="permissions"]');
            return { erste: x?.options[0]?.textContent ?? null, gewaehlt: x?.value ?? null }; })()`);
        };
        const [auto, befehle, grenzenlos] = [await liest("repo", { modus: "auto" }), await liest("repo", { modus: "acceptEdits" }), await liest("repo", { modus: "bypassPermissions" })];
        const eingefuehrt = await liest("fremd", { modus: "bypassPermissions", fremd: true });
        facts.modusOhneWahl = { auto, befehle, grenzenlos, eingefuehrt };
        verdicts[C.modusOhneWahl] = auto.erste === "On its own · your setting" && befehle.erste === "Before commands · your setting" && grenzenlos.erste === "No limits · your setting"
          && eingefuehrt.erste === "On its own" && [auto, befehle, grenzenlos, eingefuehrt].every((x) => x.gewaehlt === "");
      });
      await caseOf("modus-im-branch", async () => {
        await fresh({ modus: "plan", imBranch: "auto" });
        await fenster();
        await mitAgent("repo");
        const erste = () => evaluate<string | null>(`${WIN}?.querySelector('select[data-k="permissions"]')?.options[0]?.textContent ?? null`);
        const ausgecheckt = await erste();
        await dazu("branch");
        const imBranch = await erste();
        await evaluate(`(() => { const x = ${WIN}?.querySelector('select[data-k="permissions"]'); x.value = 'manual'; x.dispatchEvent(new Event('change')); })()`);
        await idle();
        const mitWahl = await erste();
        await evaluate(`(() => { const x = ${WIN}?.querySelector('select[data-k="permissions"]'); x.value = ''; x.dispatchEvent(new Event('change')); })()`);
        await idle();
        await click(`${WIN}?.querySelector('.sftile[data-b="branch"] .sfsw')`); await idle();
        const wieder = await erste();
        facts.modusImBranch = { ausgecheckt, imBranch, mitWahl, wieder };
        verdicts[C.modusImBranch] = ausgecheckt === "Only plans · your setting" && imBranch === "On its own · your setting" && mitWahl === imBranch && wieder === ausgecheckt;
      });
      await caseOf("fremd-geaendert", async () => {
        await fresh({ modus: "bypassPermissions", fremd: true });
        await fenster();
        await mitAgent("fremd");
        await evaluate(`(() => { const x = ${WIN}?.querySelector('select[data-k="memory"]'); x.value = 'aus'; x.dispatchEvent(new Event('change')); })()`);
        await idle();
        const hHerkunft = fassungDerVorschau((q) => q.ausAgent === "fremd" && q.notizbuch === "aus");
        const kachel = await evaluate<{ erste: string | null; gewaehlt: string | null }>(`(() => { const x = ${WIN}?.querySelector('select[data-k="permissions"]');
          return { erste: x?.options[0]?.textContent ?? null, gewaehlt: x?.value ?? null }; })()`);
        await evaluate(`${WIN}?.querySelector('.sftile[data-b="permissions"]')?.click()`);
        await wait(`!!${WIN}?.querySelector('.sfdrawer')`, 4000);
        const block = await evaluate<string>(`${WIN}?.querySelector('.sfdrawer')?.textContent ?? ''`);
        await evaluate(`${WIN}?.querySelector('.sftile[data-b="permissions"]')?.click()`);
        await idle();
        await click(SFGO);
        await wait(`!${WIN}`, 6000);
        await idle();
        const posts = starts();
        // ...and by hand: No limits still goes, and it still says where the agent came from
        await fresh({ modus: "bypassPermissions", fremd: true });
        await fenster();
        await mitAgent("fremd");
        await evaluate(`(() => { const x = ${WIN}?.querySelector('select[data-k="permissions"]'); x.value = 'bypassPermissions'; x.dispatchEvent(new Event('change')); })()`);
        await idle();
        await click(SFGO);
        await wait(`!${WIN}`, 6000);
        await idle();
        const hand = starts();
        // ...and one a seat saved stays one too
        await fresh({ modus: "bypassPermissions", fremd: true, vonSitz: true });
        await fenster();
        await mitAgent("fremd");
        await evaluate(`(() => { const x = ${WIN}?.querySelector('select[data-k="memory"]'); x.value = 'aus'; x.dispatchEvent(new Event('change')); })()`);
        await idle();
        await click(SFGO);
        await wait(`!${WIN}`, 6000);
        await idle();
        const vomSitz = starts();
        facts.fremdGeaendert = { hHerkunft, kachel, posts, hand, vomSitz };
        const b = posts[0]?.body as Record<string, unknown> | undefined, h = hand[0]?.body as Record<string, unknown> | undefined;
        verdicts[C.fremdGeaendert] = hHerkunft !== null && kachel.erste === "On its own" && block.includes("On its own") && !block.includes("your setting")
          && b?.ausAgent === "fremd" && b?.agent === undefined && b?.fassung === hHerkunft && b?.notizbuch === "aus"
          && h?.ausAgent === "fremd" && h?.permissionMode === "bypassPermissions" && h?.agent === undefined
          && (vomSitz[0]?.body as Record<string, unknown> | undefined)?.ausAgent === "fremd";
      });
      await caseOf("fremd-gesichert", async () => {
        await fresh({ modus: "bypassPermissions", fremd: true });
        await fenster();
        await mitAgent("fremd");
        await evaluate(`(() => { const x = ${WIN}?.querySelector('select[data-k="memory"]'); x.value = 'aus'; x.dispatchEvent(new Event('change')); })()`);
        await idle();
        const knopf = (wort: string) => `[...(${WIN}?.querySelectorAll('.sfacts .sfsec') ?? [])].find((b) => b.textContent === ${JSON.stringify(wort)})`;
        await click(knopf("Save changes")); await idle();
        await click(knopf("Save")); await idle();
        const erste = await evaluate<string | null>(`${WIN}?.querySelector('select[data-k="permissions"]')?.options[0]?.textContent ?? null`);
        const hGesichert = fassungDerVorschau((q) => q.agent === "fremd");
        await click(SFGO);
        await wait(`!${WIN}`, 6000);
        await idle();
        const nach = starts();
        facts.fremdGesichert = { erste, hGesichert, nach };
        const b = nach[0]?.body as Record<string, unknown> | undefined;
        verdicts[C.fremdGesichert] = erste === "No limits · your setting" && nach.length === 1 && b?.agent === "fremd" && b?.fassung === hGesichert;
      });
      await caseOf("hero-satz", async () => {
        const hero = async (id: string) => {
          await fresh();
          await fenster();
          await mitAgent(id);
          return evaluate<string>(`${WIN}?.querySelector('.sfhero .sfpurpose')?.textContent ?? ''`);
        };
        const repo = await hero("repo"), gespeichert = await hero("pruefer");
        facts.heroSatz = { repo, gespeichert };
        verdicts[C.heroSatz] = repo === "Nothing from Fleet unless you switch it on." && gespeichert === "Your Claude Code with what Fleet adds on top.";
      });
      await caseOf("regeln-kachel", async () => {
        const liest = async (regeln: Fx["regeln"]) => {
          await fresh({ regeln });
          await fenster();
          await mitAgent("repo");
          await briefAuf();
          return evaluate<{ wert: string; zeilen: string[]; brief: string[] }>(`(() => { const t = ${WIN}?.querySelector('.sftile[data-b="rules"]');
            return { wert: t?.querySelector('.sftv')?.textContent ?? '', zeilen: [...(t?.querySelectorAll('.sffiles > div') ?? [])].map((z) => z.textContent),
              brief: [...(${WIN}?.querySelectorAll('.sfhb .sfbsec') ?? [])].flatMap((k) => [...k.querySelectorAll('.sfbk')].map((b) => k.dataset.key + '|' + b.textContent)).filter((x) => /rules|x\\.md|AGENTS/.test(x)) }; })()`);
        };
        const voll = await liest("voll"), keine = await liest("keine"), nurPfad = await liest("nurPfad");
        facts.regelnKachel = { voll, keine, nurPfad };
        verdicts[C.regelnKachel] = voll.wert === "4 files" && voll.zeilen.length === 4 && voll.brief.length >= 2
          && keine.wert === "None" && keine.zeilen.length === 0 && keine.brief.length === 0
          && nurPfad.wert === "1 file" && nurPfad.zeilen.length === 1 && nurPfad.zeilen[0]!.includes("read with a matching file")
          && nurPfad.brief.length === 1 && nurPfad.brief[0]!.startsWith("When it fits") && nurPfad.brief[0]!.includes("x.md");
      });

      // 4 · ⎇+ under the session in slot 1: the start window, a session on a branch of its own from slot 1's branch, never a lane
      await caseOf("quick", async () => {
        await fresh({ zweig: "bau/uhr-alt" });
        await click(`document.querySelector('#slots .slot[data-slot="1"] .quicklane')`);
        if (!await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag')`, 10000)) throw new Error("⎇+ opened no window");
        await idle();
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
        facts.quick = { ohne, sentOhne, mit, posts: s };
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
        if (!await wait(`!!${WIN}?.querySelector('.sf .sfag.repoag')`, 10000)) throw new Error("the repo's + opened no window");
        await idle();
        const repo = await evaluate<string | null>(`${WIN}?.querySelector('.sfrepo.sel')?.dataset.repo ?? null`);
        await mitAgent("repo");
        await wait(`${SFGO} && !${SFGO}.disabled`, 6000);
        const h = fassungDerVorschau((q) => Object.keys(q).length === 0);
        const s = await sfStart();
        // the first place without a session: slot 1 works, and the fixture's others are free
        facts.plus = { repo, expect: h, posts: s };
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
