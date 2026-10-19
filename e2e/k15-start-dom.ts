// STARTING FROM THE WINDOW „NEUE SESSION“ IN A REAL BROWSER (Neuaufbau K15 Runde 5, src/k15-start.ts, src/start-tuer.ts).
// Owner 17.10.: „[Zitat entfernt]“ — the new window replaces the old start window
// (src/founding.ts until Runde 5), „[Zitat entfernt]“, and „[Zitat entfernt]“
// . This rig REPLACES e2e/slots.ts#runFoundingFocusDom's start claims: where that probe read which route
// with which body the old window sent per role, this one reads the same behaviour off the new window.
// The real client bundle (src/client.ts) and the window's own bundle (src/k15-entwurf.ts → /k15.js, with public/k15.css)
// behind a fixture origin answered over CDP Fetch (as e2e/konstellation.ts): /api/sessions names one running session in
// slot 1 (an Orchestratorin in slot 2 where a case asks), /api/founding-plan answers per role with a hash that moves with
// the query and the fixture's HEAD (as the old rig's fixturePlanFor, src/founding.ts#validAnswer holds it strictly),
// /api/harnesses, /api/programs, /api/branches, /api/dirinfo, /api/dirs, /api/machine-settings, /api/worktrees and the
// window's store (src/k15-speicher.ts#SPEICHER_ROUTE) answer as the server writes them, and every POST is recorded with
// its body. Every case loads the page fresh, so no case reads what another left behind; clicks and taps are real input
// over CDP. Claims 1–14 are read at 1200 × 900 (K15's narrow mode: one column at a time), claim 1b at 390 × 844. Since the view
// „Eine Session“ (src/sitzung.ts, Entwurf Runde 4) a free place opens that view; the cases of the build (K15) reach it over
// „Mit anderen Sessions arbeiten“, and claims 15–18 and 20–22 read the view itself (19 its tabs on the phone). Every
// claim has a MUTANT in K15_START_MUTANTS that swaps one needle in a source file and must turn that claim red; a needle
// that left the source throws, so a mutant that could not apply fails as itself.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export interface K15StartDomResult { width: number; height: number; claims: Record<string, boolean>; facts: Record<string, unknown> }
export interface K15StartMutant {
  name: string; claim: string;
  file: "src/k15-start.ts" | "src/start-tuer.ts" | "src/k15-zustand.ts" | "src/client.ts" | "src/board.ts" | "src/k15-entwurf.ts" | "src/k15-repo.ts"
    | "src/sitzung.ts" | "src/sitzung-modell.ts" | "src/sitzung-links.ts";
  needle: string; with: string; width?: 1200 | 390;
}

export const K15_START_CLAIM = {
  open: "a click on a free place of the left bar opens the window „Neue Session“ in its view „Eine Session“ (#shell-found.k15.k15sitz, its head „Neue Session in …“, its button „Session starten“), and no element of the old start window (.fdgo, .fdkind) stands anywhere",
  openPhone: "on the phone „Neue Session“ in the Sessions sheet opens the same window in its view „Eine Session“, and no element of the old start window stands anywhere",
  lane: "a lane from free place N sends exactly one POST /api/slots/N/open-worktree with { repo, branch: \"\", harness, model, effort, plan: { hash, role: \"lane\" } }: the triple is the role's standard from the plan (rollen[].standard), the hash that of the plan the window read with it, no bausteine without a switch",
  wahl: "model and effort changed at the chosen session (its choice in column 3) stand in the plan the window reads and in the start's body, and the start carries the hash of that read",
  quick: "⎇+ under a session sends POST /api/lanes with parent { slot, openedAt } and without slot; a position that is not a lane is blocked there, its sentence names ⎇+, and nothing is sent",
  plus: "the + of a repo sends POST /api/lanes without slot and without parent",
  orch: "the Orchestratorin starts with POST /api/slots/<free>/open { cwd, label: \"Orchestrator\", harness, model, effort, plan: { hash, role: \"orchestratorin\" } }; with one running (a row with role orchestrator) the button is blocked, the sentence says „läuft schon auf Slot N“, and „Zu ihr“ closes the window, shows her slot and sends nothing",
  ordner: "a session „Nur Ordner“ starts over /open without a plan while the plan says start.startbar:false, and the sentence names what that door gives anyway; with startbar:true it starts with its plan and without that sentence",
  main: "a MAIN lists the active Programs, free first, a living MAIN not choosable; its start is POST /api/programs/<id>/bootstrap-main { cwd, harness, model, effort } without plan; existing:true stands as a sentence naming the living MAIN's slot, 409 and 503 with the server's words verbatim, nothing starts, the Programs are read again; Programs that cannot be read block with a sentence",
  branch: "a Branch-Session (Konstellation „Eine Session“) is blocked without a name; Neu sends POST /api/branches { repo, name, points }, then POST /api/branches/open { repo, branch, goal }; a 409 with existing says so and offers „Zu …“, which opens that branch",
  stale: "a 409 with staleHash starts nothing, the sentence says „Der Plan hat sich … bewegt“, and the next start carries the hash of the plan of now",
  unreadable: "a plan that cannot be read (500, network, malformed) blocks the start with a sentence that says so, in „Eine Session“ and in the build, and nothing is sent",
  datei: "Lane 2 of the default constellation (its own file review-regeln.md) is blocked, the sentence names the file, and nothing is sent",
  eine: "in a constellation of several sessions the button names the one that starts („Lane 1 starten“) and the sentence says only she starts",
  zu: "after a successful start the window closes and the started slot is the one shown",
  spalten: "„Eine Session“ stands in three columns side by side, left to right: Aufsetzen, the Übersicht with the five questions as chapters, the text with the same five chapters in the same order",
  sprung: "a click on a part in the Übersicht brings its block into the text column: before, the block stood below the column's view; after, it stands inside it",
  schalter: "a switch in the Übersicht changes what the start gets: the plan is read again with it, the part's block appears in the text, the token sums of the Übersicht, the text and the foot grow by the part's tokens, and the start carries the switch (plan.bausteine) beside the default rights",
  frage: "every part stands under the question its plan row names: its row in that chapter of the Übersicht, its block in that chapter of the text",
  reiter: "on the phone „Eine Session“ has three tabs Aufsetzen · Übersicht · Agent.md, and each tab shows its own column and none of the other two",
  kapitel: "the Übersicht opens folded (owner 19.10. 09:5x „[Zitat entfernt]“): the five questions, each with its tokens, a bar and „N im Start“, and no part visible; a click on a question shows its parts, a second click folds them again",
  nv: "a part that is not available here stands folded under one line „N weitere(r) hier nicht verfügbar“; that line shows the N parts, and a click on one of them names „Warum nicht“",
  rechte: "„Was darf er?“ goes with the start (A, owner 19.10. 08:5x): with Claude Code the start's body carries rechte { stufe, an, aus } — „Bauen“ by default, a level chosen under „ändern“ and an exception under „+ Ausnahme“ as chosen, and the sentence says what he may do; with another agent the section says it is Claude Code's and the body carries none",
} as const;
// the claims read on the phone; every other one at 1200
const PHONE: ReadonlySet<string> = new Set([K15_START_CLAIM.openPhone, K15_START_CLAIM.reiter]);

const C = K15_START_CLAIM;
export const K15_START_MUTANTS: readonly K15StartMutant[] = [
  { name: "a free place opens nothing", claim: C.open, file: "src/client.ts",
    needle: "row.onclick = () => openK15Entwurf({ slot: s.id });", with: "row.onclick = () => undefined;" },
  { name: "the window's head does not say „Neue Session“", claim: C.open, file: "src/k15-repo.ts",
    needle: `h2.replaceChildren(el("span", "k15woi", "Neue Session in"), b);`, with: `h2.replaceChildren(el("span", "k15woi", "Start in"), b);` },
  { name: "the window loses its K15 face", claim: C.open, file: "src/k15-entwurf.ts",
    needle: `shell.root.classList.add("k15");`, with: `void shell.root;` },
  { name: "„Neue Session“ in the Sessions sheet opens nothing", claim: C.openPhone, file: "src/client.ts", width: 390,
    needle: `"Neue Session", () => { if (free) openK15Entwurf({ slot: free.id }); });`, with: `"Neue Session", () => undefined);` },
  { name: "a lane from a free place goes to /api/lanes", claim: C.lane, file: "src/start-tuer.ts",
    needle: "const url = a.slot !== undefined ? `/api/slots/${a.slot}/open-worktree` : \"/api/lanes\";", with: "const url = \"/api/lanes\";" },
  { name: "the role's standard is not sent", claim: C.lane, file: "src/k15-zustand.ts",
    needle: "const mit = (w: Wahl) => w.wert !== \"\" && (w.gesetzt || w.rolle === true);", with: "const mit = (w: Wahl) => w.wert !== \"\" && w.gesetzt;" },
  { name: "a model or effort set at the session is ignored", claim: C.wahl, file: "src/k15-zustand.ts",
    needle: "...(gesetzt(qa, passt) ? { position:", with: "...(false ? { position:" },
  { name: "⎇+ loses its parent", claim: C.quick, file: "src/start-tuer.ts",
    needle: "{ repo: a.repo, ...(a.parent ? { parent: a.parent } : {}), branch: \"\",", with: "{ repo: a.repo, branch: \"\"," },
  { name: "⎇+ lets a MAIN start", claim: C.quick, file: "src/k15-start.ts",
    needle: "if (plus?.parent && t !== \"lane\") return", with: "if (false) return" },
  { name: "the + of a repo opens nothing", claim: C.plus, file: "src/board.ts",
    needle: "add.onclick = (e) => { e.stopPropagation(); openK15Entwurf({ repo: R.repo }); };", with: "add.onclick = (e) => { e.stopPropagation(); };" },
  { name: "the Orchestratorin starts without her label", claim: C.orch, file: "src/k15-start.ts",
    needle: "...(p.rolle === \"orchestratorin\" ? { label: ORCH_LABEL } : {})", with: "...({})" },
  { name: "a second Orchestratorin is not blocked", claim: C.orch, file: "src/k15-start.ts",
    needle: "if (p.rolle === \"orchestratorin\" && orchLaeuft()) return", with: "if (false) return" },
  { name: "„Zu ihr“ does not show her slot", claim: C.orch, file: "src/k15-start.ts",
    needle: "zu.onclick = () => { s.shell.close(); zeigeSlot(o.id); };", with: "zu.onclick = () => { s.shell.close(); };" },
  { name: "Nur Ordner waits for a plan its door cannot start", claim: C.ordner, file: "src/k15-start.ts",
    needle: "const ohnePlan = (p: Profil, a: Answer): boolean => tuerVon(p) === \"open\" && p.rolle === \"nur-ordner\" && !a.start.startbar;",
    with: "const ohnePlan = (p: Profil, a: Answer): boolean => false && tuerVon(p) === \"open\" && p.rolle === \"nur-ordner\" && !a.start.startbar;" },
  { name: "the Programs are not sorted free first", claim: C.main, file: "src/start-tuer.ts",
    needle: "zeilen.sort((a, b) => rang[a.zustand] - rang[b.zustand] || a.titel.localeCompare(b.titel));", with: "void rang;" },
  { name: "after a MAIN's answer the Programs are not read again", claim: C.main, file: "src/k15-start.ts",
    needle: "if (a.tuer === \"main\") void ladePrograms(s);", with: "" },
  { name: "a Branch-Session starts without a name", claim: C.branch, file: "src/k15-start.ts",
    needle: "if (!b.name.trim()) return \"Gib dem Branch einen Namen für das Board.\";", with: "" },
  { name: "a 409 with existing is not recognised", claim: C.branch, file: "src/start-tuer.ts",
    needle: "if (r.status === 409 && ex && typeof ex.branch === \"string\" && typeof ex.name === \"string\")", with: "if (false)" },
  { name: "a moved plan is not read again", claim: C.stale, file: "src/k15-start.ts",
    needle: "if (r.bewegt) s.plaene.clear();", with: "" },
  { name: "an unreadable plan reads as loading", claim: C.unreadable, file: "src/k15-start.ts",
    needle: "if (typeof l.plan === \"object\" && \"fehler\" in l.plan) return `Der Plan für diesen Start ist nicht lesbar: ${l.plan.fehler}`;", with: "" },
  { name: "a session's own file is not counted", claim: C.datei, file: "src/k15-start.ts",
    needle: "if (q.datei) out.push(`die Datei ${q.datei.titel}`);", with: "" },
  { name: "the button does not name the session", claim: C.eine, file: "src/k15-start.ts",
    needle: "go.textContent = s.start.busy ? \"Startet …\" : z ? `${z.q.name} starten` : \"Starten\";", with: "go.textContent = s.start.busy ? \"Startet …\" : \"Starten\";" },
  { name: "the sentence does not say only one starts", claim: C.eine, file: "src/k15-start.ts",
    needle: "if (n > 1) return `Startet nur ${q.name}", with: "if (n > 1) return null; if (n > 1) return `Startet nur ${q.name}" },
  { name: "the window stays open after a start", claim: C.zu, file: "src/k15-start.ts",
    needle: "    s.shell.close();\n    zeigeSlot(r.slot);", with: "    zeigeSlot(r.slot);" },
  { name: "an unreadable plan reads as loading in „Eine Session“", claim: C.unreadable, file: "src/sitzung.ts",
    needle: "return fehler ? `Der Plan für diesen Start ist nicht lesbar: ${fehler}` :", with: "return fehler ? \"Der Plan für diesen Start wird gelesen …\" :" },
  { name: "the Übersicht is missing", claim: C.spalten, file: "src/sitzung.ts",
    needle: "grid.append(reiter, links, mitte, rechts);", with: "grid.append(reiter, links, rechts);" },
  { name: "a part in the Übersicht shows nothing in the text", claim: C.sprung, file: "src/sitzung.ts",
    needle: "    if (zu !== \"nv\" && !schmal()) imText();\n  };", with: "  };" },
  { name: "a switch in the Übersicht switches nothing", claim: C.schalter, file: "src/sitzung.ts",
    needle: "s.sitz.schalter = { ...s.sitz.schalter, [id]: an ? \"aus\" : \"an\" };", with: "void id; void an;" },
  { name: "the start drops the switches", claim: C.schalter, file: "src/sitzung.ts",
    needle: "role: \"nur-ordner\", ...(sw ? { bausteine: sw } : {}) }", with: "role: \"nur-ordner\" }" },
  { name: "the window files every part under one question", claim: C.frage, file: "src/sitzung-modell.ts",
    needle: "SessionFrage => \"frage\" in v && istFrage(v.frage) ? v.frage : sonst;", with: "SessionFrage => sonst;" },
  { name: "a tab shows no column of its own", claim: C.reiter, file: "src/sitzung.ts", width: 390,
    needle: "grid.dataset.reiter = z.reiter;", with: "grid.dataset.reiter = \"aufsetzen\";" },
  { name: "the Übersicht opens unfolded", claim: C.kapitel, file: "src/sitzung.ts",
    needle: "const auf = z.kapOffen.has(f.id);", with: "const auf = true;" },
  { name: "a part not available here stands among the others", claim: C.nv, file: "src/sitzung.ts",
    needle: "t.stand !== \"aus\" ? \"drin\" : t.schalter ? \"aus\" : \"nv\";", with: "t.stand !== \"aus\" ? \"drin\" : \"aus\";" },
  { name: "the start drops the rights", claim: C.rechte, file: "src/sitzung.ts",
    needle: "const rechte = ag === \"claude\" ? { rechte: z.rechte } : {};", with: "const rechte = {};" },
  { name: "the rights go to every agent", claim: C.rechte, file: "src/sitzung.ts",
    needle: "ag === \"claude\" ? { rechte: z.rechte } : {}", with: "{ rechte: z.rechte }" },
  { name: "a level is not taken", claim: C.rechte, file: "src/sitzung-links.ts",
    needle: "() => { z.rechte = { stufe: st.id, an: [], aus: [] }; z.rechteWahl = \"zu\"; render(); }", with: "() => { z.rechteWahl = \"zu\"; render(); }" },
];

const REPO = "/fixture/claude-fleet";
// the five questions in their order (owner 18.10., session-fragen.ts): both sides of „[Zitat entfernt]“ are chaptered by them
const FRAGEN = ["auftrag", "umstaende", "hintergrund", "howto", "konzepte"];
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
// question (`frage`, session-fragen.ts), and one row a free session may switch — only here: the real register switches nothing in
// „Nur Ordner“ (luecken.md S1), so this row is what claim 17 reads the window's switch on
const ROWS: { id: string; wort: string; funktion: string[]; noetig: boolean; rd: Rd; bytes: number; frage: string; fest?: string; ordner?: true }[] = [
  { id: "spawn-profile", wort: "Agent · Modell · Effort", funktion: ["orientierung"], noetig: true, rd: ALL("an", "aus"), bytes: 0, frage: "umstaende" },
  { id: "role-card", wort: "Rolle", funktion: ["vertrag"], noetig: true, rd: { lane: "an", main: "an", orchestratorin: "aus", "nur-ordner": "aus" }, bytes: 100, frage: "howto" },
  { id: "self-credential", wort: "Rückweg", funktion: ["rueckweg"], noetig: true, rd: ALL("an", "aus"), bytes: 0, frage: "umstaende" },
  { id: "context-anchors", wort: "Lesehinweise", funktion: ["orientierung"], noetig: false, rd: ALL("an", "aus"), bytes: 76, frage: "hintergrund" },
  { id: "native-agents", wort: "Lädt nativ", funktion: ["vertrag"], noetig: false, rd: ALL("an", "an"), bytes: 1000, frage: "hintergrund", fest: "Der Agent lädt den Ordner selbst." },
  { id: "lesehilfe", wort: "Lesehilfe", funktion: ["orientierung"], noetig: false, rd: ALL("aus", "aus"), bytes: 840, frage: "konzepte", ordner: true },
];
// the files Claude Code loads by itself in the fixture repo (native-agents' details): three of yours, two of the folder, each long
// enough that the text column has to scroll to the folder's
const NATIV = [["/fixture/home/.claude/CLAUDE.md", 3000], ["/fixture/home/.claude/rules/typescript.md", 2000], ["/fixture/home/AGENTS.md", 2500],
  [`${REPO}/AGENTS.md`, 4000], [`${REPO}/docs/CLAUDE.md`, 1000]] as const;
const fileText = (pfad: string): string => Array.from({ length: 40 }, (_, i) => `${pfad} · Zeile ${i + 1}`).join("\n");
// what the /open door gives a free session although its plan says „aus“ (server.ts#planDoorVerdict), in the window's words
const ORDNER_TROTZDEM = "Agent · Modell · Effort, Rückweg";
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

interface Fx {
  head: string; plan: "ok" | "500" | "network" | "malformed"; ordnerStartbar: boolean; orch: boolean; move: boolean;
  programs: "ok" | "fail"; bootstrap: "ok" | "existing" | "refuse" | "pending"; branchExists: boolean; board: boolean;
  occupied: Map<number, Record<string, unknown>>;
}
const fx0 = (): Fx => ({ head: "fixture-head", plan: "ok", ordnerStartbar: false, orch: false, move: false, programs: "ok", bootstrap: "ok",
  branchExists: false, board: false, occupied: new Map() });

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
      const zu = ordner && r.id !== "native-agents" && !r.ordner;
      const zustand = sw[r.id] ?? r.rd[role] ?? "aus";
      return { id: r.id, wort: r.wort, satz: `Satz ${r.id}.`, funktion: r.funktion,
        grenze: r.noetig ? { art: "noetig", grund: `ohne ${r.wort} kein Start` } : { art: "frei" }, schicht: "fixture", zustand,
        quelle: r.id in sw ? "schalter" : "default", rollenDefault: r.rd[role] ?? "aus", harness: { gueltig: true, grund: null },
        schaltbar: r.fest ? { ja: false, grund: r.fest } : zu ? { ja: false, grund: "Nur Ordner liefert nur, was der Ordner selbst lädt." } : { ja: true },
        bytes: r.bytes, ersatzKandidaten: [], frage: r.frage,
        ...(r.id === "native-agents" ? { details: { dateien: NATIV.map(([pfad, bytes]) => ({ pfad, bytes })), nachgeladen: [] } } : {}) };
    });
    const startbar = !ordner || fx.ordnerStartbar;
    return { head: fx.head, branch: "main", harness, plannedAt: 1000, selected: [], omitted: [], role,
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
        const a = START.test(p) ? answerPost(p, body) : { status: 200, body: { ok: true } };
        return json(requestId, a.body, a.status);
      }
      if (request.method === "PUT") return json(requestId, { ok: true });
      if (p === "/" || p === "/blank") return reply(requestId, 200, p === "/" ? indexHtml : "<!doctype html><title>blank</title>", "text/html");
      if (p === "/app.js") return reply(requestId, 200, appJs, "text/javascript");
      if (p === "/k15.js") return reply(requestId, 200, k15Js, "text/javascript");
      if (p === "/k15.css") return reply(requestId, 200, k15Css, "text/css");
      if (p === "/sitzung.css") return reply(requestId, 200, sitzungCss, "text/css");
      if (p === "/api/file") return json(requestId, { text: fileText(u.searchParams.get("path") ?? "") });
      if (p === "/api/sessions") return json(requestId, { now: Date.now(), chips: [], tasks: [], slots: slots(), instance: { name: "mac" }, programs: [] });
      if (p === "/api/harnesses") return json(requestId, KATALOG);
      if (p === "/api/machine-settings") return json(requestId, { settings: [{ name: "FLEET_MIGRATE_PCT", value: 40 }, { name: "FLEET_LANE_MIGRATE_PCT", value: 37 },
        { name: "FLEET_MODEL", value: "claude-opus-5-5[1m]" }] });
      if (p === "/api/k15/eigenes") return json(requestId, { eigenes: { fassungen: [], packs: [], profile: [] } });
      if (p === "/api/dirs") return json(requestId, { path: "/fixture", parent: null, dirs: [], repos: [], git: false, pins: [] });
      if (p === "/api/dirinfo") return json(requestId, { path: u.searchParams.get("path"), exists: true, git: true, branch: "main", dirty: 0, orphans: [] });
      if (p === "/api/programs") { programReads++; return fx.programs === "fail" ? json(requestId, { error: "fixture: programs refused" }, 500) : json(requestId, PROGRAMS); }
      if (p === "/api/branches") return json(requestId, { repos: [{ repo: REPO, integration: "main", others: [], othersTotal: 0, reasons: [], branches: [] }] });
      if (p === "/api/worktrees") return fx.board ? json(requestId, workplaces()) : json(requestId, { error: "fixture: not served" }, 404);
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

    const WIN = "document.querySelector('#shell-found')";
    const GO = `${WIN}?.querySelector('.k15go')`;
    const SATZ = `(${WIN}?.querySelector('.k15stsatz')?.textContent ?? null)`;
    const konst = (name: string) => `[...document.querySelectorAll('#shell-found .k15konst')].find((b) => b.querySelector('.k15kn')?.textContent === ${JSON.stringify(name)})`;
    const card = (id: string) => `${WIN}?.querySelector('.k15card[data-id="${id}"]')`;
    const row = (k: string) => `[...document.querySelectorAll('#shell-found .k15c3 .k15z')].find((r) => r.querySelector('.k15zk')?.textContent === ${JSON.stringify(k)})?.querySelector('.k15sw')`;
    const menu = (wert: string) => `document.querySelector('#shell-found .k15menu button[data-wert="${wert}"]')`;
    // what the foot says and whether the button lets a start through
    const foot = () => evaluate<{ go: string | null; disabled: boolean | null; satz: string | null; warn: boolean }>(`({ go: ${GO}?.textContent ?? null,
      disabled: ${GO} ? ${GO}.disabled : null, satz: ${SATZ}, warn: !!${WIN}?.querySelector('.k15stsatz.warn') })`);
    const shown = () => evaluate<string | null>("document.querySelector('#comptarget')?.dataset.slot ?? null");
    const open = () => evaluate<boolean>(`!!${WIN}`);
    const starts = () => posts.filter((x) => START.test(x.url));
    const reads = (role: string, d: { harness?: string; model?: string; effort?: string }) => planReads.filter((q) => q.role === role && q.repo === REPO
      && q.harness === d.harness && q.model === d.model && q.effort === d.effort && q.bausteine === undefined);
    const hashFor = (role: string, d: { harness?: string; model?: string; effort?: string }, head = fx.head) =>
      hash(planKey(new URLSearchParams({ repo: REPO, role, ...d }), head));
    const std = (role: string) => ({ harness: STD[role]!.harness, model: STD[role]!.modell, effort: STD[role]!.effort });

    const results: K15StartDomResult[] = [];
    let targetId = "";
    for (const [width, height, phone] of ([[1200, 900, false], [390, 844, true]] as const).filter(([w]) => !only.widths || only.widths.includes(w))) {
      // every claim of this width starts red: a case that throws leaves its claim false, never absent
      const claims: Record<string, boolean> = Object.fromEntries(Object.values(C).filter((c) => PHONE.has(c) === phone).map((c) => [c, false]));
      const facts: Record<string, unknown> = {};
      // ONE CASE, A FRESH PAGE: the fixture's state, the recorded requests and the window's module state start empty
      const fresh = async (set: Partial<Fx> = {}) => {
        fx = { ...fx0(), ...set };
        posts.length = 0; planReads.length = 0; programReads = 0; started = null;
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
      // the window from the free place in its view „Eine Session“, ready: its plan read, its foot drawn
      const eineSession = async () => {
        await click(`document.querySelector('#slots .slot.empty[data-slot="${FREE}"]')`);
        if (!await wait(`!!${WIN}?.querySelector('.ksgo')`, 10000)) throw new Error("the window „Neue Session“ did not open „Eine Session“ from the free place");
        await idle();
      };
      // …and its build (K15) over „Mit anderen Sessions arbeiten“
      const zumAufbau = async () => {
        await click(`${WIN}?.querySelector('.ksrolle[data-rolle="andere"]')`);
        if (!await wait(`!!${WIN}?.querySelector('.k15go')`, 10000)) throw new Error("„Mit anderen Sessions arbeiten“ did not open the build");
        await idle();
      };
      const fromFree = async () => { await eineSession(); await zumAufbau(); };
      // K15 at this width shows one column at a time: the constellation's own row leads to its build, a card to the session
      const toSession = async (id: string) => {
        await click(`${WIN}?.querySelector('.k15konst.on')`); await idle();
        await click(card(id)); await idle();
      };
      const goReady = async () => { await idle(); return wait(`${GO} && !${GO}.disabled`, 8000); };
      // a start that goes through: the press, the window gives way, every answer read; what was sent
      const go = async () => { await click(GO); await wait(`!${WIN}`, 6000); await idle(); return starts(); };
      // a press on a blocked start: what the foot said before it
      const goBlocked = async () => { const f = await foot(); await click(GO); await idle(); return f; };
      const caseOf = async (name: string, run: () => Promise<void>) => {
        try { await run(); } catch (e) { facts[`${name}:error`] = e instanceof Error ? e.message : String(e); }
        if (artifacts) await shot(`k15-start-${width}-${name}`).catch(() => undefined);
      };

      if (phone) {
        // 1b · the Sessions sheet's „Neue Session“
        await caseOf("open-phone", async () => {
          await fresh();
          await tap("document.querySelector('#mpill')");
          await tap("document.querySelector('#mslot')");
          await wait("!!document.querySelector('#msheet .mshnew')", 3000);
          await settle(250);
          await tap("document.querySelector('#msheet .mshnew')");
          const ok = await wait(`!!document.querySelector('#shell-found.k15.k15sitz .ksgo')`, 10000);
          const seen = await evaluate<{ h2: string | null; old: number }>(`({ h2: ${WIN}?.querySelector('h2')?.textContent ?? null, old: document.querySelectorAll('.fdgo, .fdkind').length })`);
          facts.openPhone = { ok, ...seen };
          claims[C.openPhone] = ok && !!seen.h2?.startsWith("Neue Session in") && seen.old === 0;
          // 19 · the three tabs, each with its own column
          await idle();
          const sicht = () => evaluate<{ tabs: string[]; an: string | null; zu: string[] }>(`(() => { const sieht = (q) => { const e = ${WIN}?.querySelector(q);
            return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
            const tabs = [...(${WIN}?.querySelectorAll('.ksreiter button') ?? [])];
            return { tabs: tabs.map((b) => b.textContent), an: tabs.find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent ?? null,
              zu: ['.kslinks', '.ksindex', '.kstext'].filter(sieht) }; })()`);
          const tab = (wort: string) => tap(`[...document.querySelectorAll('#shell-found .ksreiter button')].find((b) => b.textContent === ${JSON.stringify(wort)})`);
          const auf = await sicht();
          await tab("Übersicht"); await idle();
          const ueb = await sicht();
          await tab("Agent.md"); await idle();
          const txt = await sicht();
          facts.reiter = { auf, ueb, txt };
          claims[C.reiter] = JSON.stringify(auf.tabs) === JSON.stringify(["Aufsetzen", "Übersicht", "Agent.md"])
            && auf.an === "Aufsetzen" && JSON.stringify(auf.zu) === JSON.stringify([".kslinks"])
            && ueb.an === "Übersicht" && JSON.stringify(ueb.zu) === JSON.stringify([".ksindex"])
            && txt.an === "Agent.md" && JSON.stringify(txt.zu) === JSON.stringify([".kstext"]);
        });
        results.push({ width, height, claims, facts });
        continue;
      }

      // 1 · a free place opens the new window; 13 · the button names the one; 2 · its lane start; 14 · the window gives way
      await caseOf("lane", async () => {
        await fresh();
        await click(`document.querySelector('#slots .slot.empty[data-slot="${FREE}"]')`);
        const ok = await wait(`!!document.querySelector('#shell-found.k15.k15sitz .ksgo')`, 10000);
        const seen = await evaluate<{ h2: string | null; old: number; go: string | null }>(`({ h2: ${WIN}?.querySelector('h2')?.textContent ?? null,
          old: document.querySelectorAll('.fdgo, .fdkind').length, go: ${WIN}?.querySelector('.ksgo')?.textContent ?? null })`);
        facts.open = { ok, ...seen };
        claims[C.open] = ok && !!seen.h2?.startsWith("Neue Session in") && seen.old === 0 && seen.go === "Session starten";
        await idle();
        await zumAufbau();
        await goReady();
        const f = await foot();
        facts.eine = f;
        claims[C.eine] = f.go === "Lane 1 starten" && f.disabled === false && !f.warn && !!f.satz?.startsWith("Startet nur Lane 1")
          && f.satz.includes("mehrere Sessions als Einheit startet Fleet noch nicht");
        const d = std("lane");
        const h = hashFor("lane", d);
        const read = reads("lane", d).length > 0;
        const s = await go();
        facts.lane = { read, posts: s, expectHash: h };
        claims[C.lane] = read && s.length === 1 && s[0]!.url === `/api/slots/${FREE}/open-worktree`
          && canon(s[0]!.body) === canon({ repo: REPO, branch: "", ...d, plan: { hash: h, role: "lane" } });
        const z = { open: await open(), shown: await shown() };
        facts.zu = { ...z, started };
        claims[C.zu] = s.length === 1 && started !== null && !z.open && z.shown === String(started);
      });

      // 3 · model and effort changed at the session
      await caseOf("wahl", async () => {
        await fresh();
        await fromFree();
        await toSession("l1");
        await click(row("Modell")); await click(menu("claude-sonnet-5-5")); await idle();
        await click(row("Effort")); await click(menu("low")); await idle();
        const d = { harness: "claude", model: "claude-sonnet-5-5", effort: "low" };
        const read = reads("lane", d).length > 0;
        const h = hashFor("lane", d);
        await goReady();
        const s = await go();
        facts.wahl = { read, posts: s, reads: planReads.slice(-4) };
        claims[C.wahl] = read && s.length === 1 && canon(s[0]!.body) === canon({ repo: REPO, branch: "", ...d, plan: { hash: h, role: "lane" } });
      });

      // 4 · ⎇+ under the session in slot 1
      await caseOf("quick", async () => {
        await fresh();
        await click(`document.querySelector('#slots .slot[data-slot="1"] .quicklane')`);
        if (!await wait(`!!${WIN}?.querySelector('.k15go')`, 10000)) throw new Error("⎇+ did not open the window");
        await idle();
        await toSession("m");
        const blocked = await goBlocked();
        const sentBlocked = starts().length;
        await click(`${WIN}?.querySelector('.k15crumbb')`); await idle();
        await click(card("l1"));
        await goReady();
        const d = std("lane");
        const h = hashFor("lane", d);
        const s = await go();
        facts.quick = { blocked, sentBlocked, posts: s };
        claims[C.quick] = blocked.disabled === true && blocked.warn && !!blocked.satz?.includes("⎇+") && sentBlocked === 0
          && s.length === 1 && s[0]!.url === "/api/lanes" && !("slot" in (s[0]!.body as object))
          && canon(s[0]!.body) === canon({ repo: REPO, parent: { slot: 1, openedAt: 1000 }, branch: "", ...d, plan: { hash: h, role: "lane" } });
      });

      // 5 · the + in a repo's head of the git structure (K16: the Ranke's Projekte are gone)
      await caseOf("plus", async () => {
        await fresh({ board: true });
        const add = `document.querySelector('#boardbody .gs[data-repo="${REPO}"] .gsh .gsadd')`;
        if (!await wait(`!!${add}`, 10000)) throw new Error("the board never showed the repo's +: " + await evaluate<string>("document.querySelector('#boardbody')?.innerText.slice(0, 300) ?? 'no board'"));
        await click(add);
        if (!await wait(`!!${WIN}?.querySelector('.k15go')`, 10000)) throw new Error("the repo's + did not open the window");
        await goReady();
        const d = std("lane");
        const h = hashFor("lane", d);
        const s = await go();
        facts.plus = { posts: s };
        claims[C.plus] = s.length === 1 && s[0]!.url === "/api/lanes" && canon(s[0]!.body) === canon({ repo: REPO, branch: "", ...d, plan: { hash: h, role: "lane" } });
      });

      // 6 · the Orchestratorin, then one already running
      let orchStart = false;
      await caseOf("orch", async () => {
        await fresh();
        await fromFree();
        await toSession("o");
        await goReady();
        const d = std("orchestratorin");
        const h = hashFor("orchestratorin", d);
        const s = await go();
        facts.orch = { posts: s };
        orchStart = s.length === 1 && s[0]!.url === `/api/slots/${FREE}/open`
          && canon(s[0]!.body) === canon({ cwd: REPO, label: "Orchestrator", ...d, plan: { hash: h, role: "orchestratorin" } });
      });
      await caseOf("orch-running", async () => {
        await fresh({ orch: true });
        await fromFree();
        await toSession("o");
        const f = await goBlocked();
        const sent = starts().length;
        await click(`[...document.querySelectorAll('#shell-found .k15start .k15ghost')].find((b) => b.textContent === 'Zu ihr auf Slot 2')`);
        await idle();
        const z = { open: await open(), shown: await shown() };
        facts.orchRunning = { foot: f, sent, ...z, posts: starts() };
        claims[C.orch] = orchStart && f.disabled === true && f.warn && f.satz === "Die Orchestratorin läuft schon auf Slot 2."
          && sent === 0 && !z.open && z.shown === "2" && starts().length === 0;
      });

      // 7 · a session „Nur Ordner“, dragged in as a constellation, while its door cannot start the plan, then once it can
      const dragIn = async () => {
        const at = await evaluate<{ x: number; y: number }>(`(() => { const r = ${WIN}.querySelector('.shelldetail').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
        const data = { items: [], files: [ordnerJson], dragOperationsMask: 1 };
        for (const t of ["dragEnter", "dragOver", "drop"]) await send("Input.dispatchDragEvent", { type: t, x: at.x, y: at.y, data });
        await idle();
        if (!await wait(`${WIN}?.querySelector('.k15konst.on .k15kn')?.textContent === 'Nur Ordner'`, 4000))
          throw new Error("the dragged constellation did not land: " + await evaluate<string>(`${WIN}?.querySelector('.k15toast')?.textContent ?? 'no sentence'`));
      };
      let ordnerOhne: { foot: unknown; posts: unknown } | null = null, ordnerOhneOk = false;
      await caseOf("ordner", async () => {
        await fresh();
        await fromFree();
        await dragIn();
        await goReady();
        const f = await foot();
        const s = await go();
        ordnerOhne = { foot: f, posts: s };
        ordnerOhneOk = f.disabled === false && !f.warn
          && f.satz === `Startet ohne Plan über die bestehende Tür; sie gibt heute trotzdem ${ORDNER_TROTZDEM} mit.`
          && s.length === 1 && s[0]!.url === `/api/slots/${FREE}/open` && canon(s[0]!.body) === canon({ cwd: REPO });
      });
      await caseOf("ordner-startbar", async () => {
        await fresh({ ordnerStartbar: true });
        await fromFree();
        await dragIn();
        await goReady();
        const f = await foot();
        const h = hashFor("nur-ordner", {});
        const s = await go();
        facts.ordner = { ohne: ordnerOhne, mit: { foot: f, posts: s } };
        claims[C.ordner] = ordnerOhneOk && f.disabled === false && !(f.satz ?? "").includes("ohne Plan")
          && s.length === 1 && s[0]!.url === `/api/slots/${FREE}/open` && canon(s[0]!.body) === canon({ cwd: REPO, plan: { hash: h, role: "nur-ordner" } });
      });

      // 8 · a MAIN: the Programs, the start, the three answers that found nothing, Programs that cannot be read
      const progs = () => evaluate<[string, boolean, string, string | null][]>(`[...document.querySelectorAll('#shell-found .k15stopt[data-program]')].map((b) =>
        [b.dataset.program, b.disabled, b.querySelector('.k15stsub')?.textContent ?? '', b.getAttribute('aria-checked')])`);
      const mainChecks: boolean[] = [];
      await caseOf("main", async () => {
        await fresh();
        await fromFree();
        await toSession("m");
        await wait("document.querySelectorAll('#shell-found .k15stopt[data-program]').length === 5", 4000);
        await idle();
        const listed = await progs();
        const inaktiv = await evaluate<boolean>(`[...document.querySelectorAll('#shell-found .k15start .k15hinweis')].some((x) => x.textContent.startsWith('1 weitere nicht aktiv'))`);
        await click(`document.querySelector('#shell-found .k15stopt[data-program="p-live"]')`);
        const still = (await progs()).find((x) => x[0] === "p-free")?.[3] === "true";
        await goReady();
        const d = std("main");
        const s = await go();
        facts.main = { listed, inaktiv, still, posts: s };
        mainChecks.push(JSON.stringify(listed) === JSON.stringify([
          ["p-free", false, "ohne MAIN", "true"], ["p-stale", false, "alte MAIN weg (Slot 5) — wird ersetzt", "false"], ["p-live", true, "MAIN läuft auf Slot 1", "false"],
          ["p-founding", true, "Belegung unbekannt", "false"], ["p-unknown", true, "Belegung unbekannt", "false"]])
          && inaktiv && still && s.length === 1 && s[0]!.url === "/api/programs/p-free/bootstrap-main"
          && canon(s[0]!.body) === canon({ cwd: REPO, ...d }) && (await shown()) === "2");
      });
      const NOTHING: Record<"existing" | "refuse" | "pending", string> = {
        existing: "Das Program hat schon eine lebende MAIN auf Slot 1. Nichts wurde gegründet.",
        refuse: "Abgelehnt (409): cannot bootstrap Program-MAIN for a complete program",
        pending: `Abgelehnt (503): Program-MAIN founding recovery is pending; retry did not open another slot {"availability":"unknown","recovery":"pending","affected":{"attemptId":"${"a".repeat(32)}","slot":4,"openedAt":4000}}`,
      };
      for (const mode of ["existing", "refuse", "pending"] as const) {
        await caseOf(`main-${mode}`, async () => {
          await fresh({ bootstrap: mode });
          await fromFree();
          await toSession("m");
          await wait("document.querySelectorAll('#shell-found .k15stopt[data-program]').length === 5", 4000);
          await goReady();
          const before = programReads;
          await click(GO);
          await wait(`!!${WIN}?.querySelector('.k15stsatz.warn')`, 6000);
          await idle();
          const f = await foot();
          const s = starts();
          facts[`main-${mode}`] = { foot: f, posts: s, programReads: [before, programReads] };
          mainChecks.push(f.satz === NOTHING[mode] && f.warn && await open() && (await shown()) === "1" && programReads === before + 1
            && s.length === 1 && s[0]!.url === "/api/programs/p-free/bootstrap-main" && fx.occupied.size === 0);
        });
      }
      await caseOf("main-unreadable", async () => {
        await fresh({ programs: "fail" });
        await fromFree();
        await toSession("m");
        const f = await goBlocked();
        const listed = await progs();
        facts["main-unreadable"] = { foot: f, listed, posts: starts() };
        mainChecks.push(f.disabled === true && f.warn && f.satz === "Die Programs sind nicht lesbar (Antwort 500). Ohne sie wird keine MAIN gegründet."
          && listed.length === 0 && starts().length === 0);
      });
      claims[C.main] = mainChecks.length === 5 && mainChecks.every(Boolean);
      facts.mainChecks = mainChecks;

      // 9 · a Branch-Session: no name, Neu, then a name another branch already carries
      const toBranch = async () => { await click(konst("Eine Session")); await idle(); await click(card("s")); await idle(); };
      const fill = async () => {
        await type(`${WIN}?.querySelector('[data-feld="start-name"]')`, "Uhr in der Statuszeile");
        await type(`${WIN}?.querySelector('[data-feld="start-ziel"]')`, "Die Uhr steht rechts.");
        await type(`${WIN}?.querySelector('[data-feld="start-punkte"]')`, "Uhr zeigen\nSekunden weglassen");
        await idle();
      };
      const branchChecks: boolean[] = [];
      await caseOf("branch", async () => {
        await fresh();
        await fromFree();
        await toBranch();
        const ohne = await goBlocked();
        const sentOhne = starts().length;
        await fill();
        const mit = await foot();
        const s = await go();
        facts.branch = { ohne, sentOhne, mit, posts: s };
        branchChecks.push(ohne.disabled === true && ohne.warn && ohne.satz === "Gib dem Branch einen Namen für das Board." && sentOhne === 0
          && mit.disabled === false && canon(s) === canon([
            { url: "/api/branches", body: { repo: REPO, name: "Uhr in der Statuszeile", points: ["Uhr zeigen", "Sekunden weglassen"] } },
            { url: "/api/branches/open", body: { repo: REPO, branch: "bau/uhr-in-der-statuszeile", goal: "Die Uhr steht rechts." } }])
          && (await shown()) === "2");
      });
      await caseOf("branch-exists", async () => {
        await fresh({ branchExists: true });
        await fromFree();
        await toBranch();
        await fill();
        await click(GO);
        await wait(`!!${WIN}?.querySelector('.k15stsatz.warn')`, 6000); await idle();
        const f = await foot();
        const zu = await evaluate<string | null>(`[...document.querySelectorAll('#shell-found .k15start .k15ghost')].find((b) => b.textContent.startsWith('Zu „'))?.textContent ?? null`);
        const sent = starts().length;
        await click(`[...document.querySelectorAll('#shell-found .k15start .k15ghost')].find((b) => b.textContent.startsWith('Zu „'))`);
        await wait(`!${WIN}`, 6000); await idle();
        const s = starts();
        facts.branchExists = { foot: f, zu, sent, posts: s };
        branchChecks.push(f.warn && f.satz === "Den Namen „Uhr in der Statuszeile“ trägt in diesem Repo schon bau/uhr-alt." && zu === "Zu „Uhr in der Statuszeile“ (bau/uhr-alt) — dort weiterarbeiten"
          && sent === 1 && s.length === 2 && canon(s[1]) === canon({ url: "/api/branches/open", body: { repo: REPO, branch: "bau/uhr-alt", goal: "Die Uhr steht rechts." } })
          && (await shown()) === "2");
      });
      claims[C.branch] = branchChecks.length === 2 && branchChecks.every(Boolean);

      // 10 · the plan moved between the preview and the start
      await caseOf("stale", async () => {
        await fresh({ move: true });
        await fromFree();
        await goReady();
        const d = std("lane");
        const before = hashFor("lane", d, "fixture-head");
        await click(GO);
        await wait(`(${SATZ} ?? '').includes('bewegt')`, 6000);
        const f = await foot();
        const between = { open: await open(), occupied: fx.occupied.size };
        await goReady();
        const after = hashFor("lane", d, "fixture-head-moved");
        const s = await go();
        facts.stale = { foot: f, between, posts: s, before, after };
        claims[C.stale] = f.warn && !!f.satz?.startsWith("Der Plan hat sich seit der Vorschau bewegt — nichts gestartet.") && between.open && between.occupied === 0
          && s.length === 2 && (s[0]!.body as { plan?: { hash?: string } }).plan?.hash === before
          && (s[1]!.body as { plan?: { hash?: string } }).plan?.hash === after && before !== after;
      });

      // 11 · a plan that cannot be read
      const unreadable: boolean[] = [];
      for (const mode of ["500", "network", "malformed"] as const) {
        await caseOf(`plan-${mode}`, async () => {
          await fresh({ plan: mode });
          await eineSession();
          const eine = await evaluate<{ satz: string | null; disabled: boolean | null }>(`({ satz: ${WIN}?.querySelector('.kssatz')?.textContent ?? null,
            disabled: ${WIN}?.querySelector('.ksgo')?.disabled ?? null })`);
          await click(`${WIN}?.querySelector('.ksgo')`); await idle();
          const sentEine = starts().length;
          await zumAufbau();
          const f = await goBlocked();
          facts[`plan-${mode}`] = { eine, sentEine, foot: f, posts: starts() };
          unreadable.push(eine.disabled === true && !!eine.satz?.startsWith("Der Plan für diesen Start ist nicht lesbar:") && sentEine === 0
            && f.disabled === true && f.warn && !!f.satz?.startsWith("Der Plan für diesen Start ist nicht lesbar:") && starts().length === 0);
        });
      }
      claims[C.unreadable] = unreadable.length === 3 && unreadable.every(Boolean);

      // 12 · Lane 2 with her own file
      await caseOf("datei", async () => {
        await fresh();
        await fromFree();
        await toSession("l2");
        const f = await goBlocked();
        facts.datei = { foot: f, posts: starts() };
        claims[C.datei] = f.disabled === true && f.warn && !!f.satz?.includes("die Datei review-regeln.md") && starts().length === 0;
      });

      // 15–18, 20–22 · THE VIEW „EINE SESSION“ ITSELF
      const kapitel = (sel: string, attr: string) => `[...(${WIN}?.querySelectorAll('${sel}') ?? [])].map((k) => k.dataset.${attr})`;
      // the Übersicht opens folded (src/sitzung.ts#index): a case that reads a part opens its question first
      const kapitelAuf = async (kap: string) => {
        await click(`${WIN}?.querySelector('.kskap[data-kap="${kap}"] .kskapk')`);
        if (!await wait(`${WIN}?.querySelector('.kskap[data-kap="${kap}"].auf')`, 4000)) throw new Error(`the question ${kap} did not open`);
        await idle();
      };
      // the text column scrolls smoothly: wait until it has held still for a few frames
      const textRuht = () => evaluate(`new Promise((ok) => { const sp = ${WIN}?.querySelector('.kstext'); let last = -1, still = 0;
        const tick = () => { const t = sp?.scrollTop ?? 0; still = t === last ? still + 1 : 0; last = t; if (still >= 6) return ok(true); requestAnimationFrame(tick); };
        tick(); setTimeout(() => ok(false), 3000); })`);
      // 15 · three columns side by side, the five questions as chapters on both sides
      await caseOf("spalten", async () => {
        await fresh();
        await eineSession();
        const v = await evaluate<{ cols: [string, number, number, boolean][]; reiter: boolean; index: string[]; text: string[] }>(`(() => {
          const ks = ${WIN}?.querySelector('.ks');
          const col = (q) => { const e = ks?.querySelector(q); const r = e?.getBoundingClientRect();
            return [q, r ? Math.round(r.left) : -1, r ? Math.round(r.width) : 0, !!e && getComputedStyle(e).display !== 'none' && !!r && r.right <= innerWidth + 1 && r.bottom > r.top]; };
          const reiter = ks?.querySelector('.ksreiter');
          return { cols: ['.kslinks', '.ksindex', '.kstext'].map(col), reiter: !!reiter && getComputedStyle(reiter).display !== 'none',
            index: ${kapitel(".ksindex .kskap", "kap")}, text: ${kapitel(".kstext .kskapitel", "kapitelT")} }; })()`);
        facts.spalten = v;
        const [l, m, r] = v.cols;
        claims[C.spalten] = v.cols.length === 3 && v.cols.every((c) => c[3] && c[2] >= 200) && l![1] < m![1] && m![1] < r![1] && !v.reiter
          && JSON.stringify(v.index) === JSON.stringify(FRAGEN) && JSON.stringify(v.text) === JSON.stringify(FRAGEN);
      });

      // 16 · a part in the Übersicht shows its block in the text: the folder's rules stand below three of your files. Opening their
      // question moves the text to the question's head; the column goes back to its top before the part is clicked
      await caseOf("sprung", async () => {
        await fresh();
        await eineSession();
        await wait(`(${WIN}?.querySelector('.ksblk[data-teil-b="regeln-ordner"]:not(.zu) pre')?.textContent ?? '').includes('Zeile 1')`, 6000);
        await kapitelAuf("hintergrund");
        await settle(200);
        await textRuht();
        await evaluate(`${WIN}?.querySelector('.kstext')?.scrollTo({ top: 0, behavior: 'instant' })`);
        await idle();
        const lage = () => evaluate<{ oben: number; hoehe: number; scroll: number } | null>(`(() => { const sp = ${WIN}?.querySelector('.kstext');
          const b = sp?.querySelector('.ksblk[data-teil-b="regeln-ordner"]:not(.zu)'); if (!sp || !b) return null;
          return { oben: Math.round(b.getBoundingClientRect().top - sp.getBoundingClientRect().top), hoehe: sp.clientHeight, scroll: Math.round(sp.scrollTop) }; })()`);
        const vor = await lage();
        await click(`${WIN}?.querySelector('.ksteil[data-teil="regeln-ordner"]')`);
        await settle(200);
        await textRuht();
        const nach = await lage();
        facts.sprung = { vor, nach };
        claims[C.sprung] = !!vor && !!nach && vor.oben >= vor.hoehe && nach.oben >= 0 && nach.oben < nach.hoehe - 40 && nach.scroll > 0;
      });

      // 17 · a switch in the Übersicht: the fixture's one row a free session may switch, with a door that starts the plan
      await caseOf("schalter", async () => {
        await fresh({ ordnerStartbar: true });
        await eineSession();
        const summen = () => evaluate<{ index: number; text: number; fuss: number; zu: boolean; wort: string }>(`(() => {
          const n = (q) => Number((${WIN}?.querySelector(q)?.textContent ?? '').replace(/[^0-9]/g, '') || -1);
          const b = ${WIN}?.querySelector('.ksblk[data-b="lesehilfe"]');
          return { index: n('.ksikopf .kszahl'), text: n('.kstkopf .kszahl'), fuss: n('.kssumme span'), zu: !b || b.classList.contains('zu'),
            wort: b?.querySelector('pre')?.textContent ?? '' }; })()`);
        await kapitelAuf("konzepte");
        const vor = await summen();
        await click(`${WIN}?.querySelector('.ksteil[data-teil="lesehilfe"] .kssw')`);
        await idle();
        await wait(`${WIN}?.querySelector('.ksblk[data-b="lesehilfe"]:not(.zu)')`, 4000);
        const nach = await summen();
        const gelesen = planReads.some((q) => q.role === "nur-ordner" && q.bausteine === "lesehilfe=an");
        await wait(`${WIN}?.querySelector('.ksgo') && !${WIN}.querySelector('.ksgo').disabled`, 6000);
        await click(`${WIN}?.querySelector('.ksgo')`);
        await wait(`!${WIN}`, 6000); await idle();
        const s = starts();
        const h = hash(planKey(new URLSearchParams({ repo: REPO, role: "nur-ordner", bausteine: "lesehilfe=an" }), fx.head));
        facts.schalter = { vor, nach, gelesen, posts: s, expectHash: h };
        // 840 bytes at the window's 2,1 bytes per token (sitzung-modell.ts#fleetJe without startSumme), each sum rounded on its own
        const mehr = (a: number, b: number) => b - a >= 399 && b - a <= 401;
        claims[C.schalter] = vor.zu && !nach.zu && nach.wort.startsWith("Lesehilfe: kommt in den Start") && gelesen
          && mehr(vor.index, nach.index) && mehr(vor.text, nach.text) && mehr(vor.fuss, nach.fuss)
          && s.length === 1 && s[0]!.url === `/api/slots/${FREE}/open`
          && canon(s[0]!.body) === canon({ cwd: REPO, plan: { hash: h, role: "nur-ordner", bausteine: "lesehilfe=an" },
            rechte: { stufe: "bauen", an: [], aus: [] } });
      });

      // 18 · every part under its question, in the Übersicht and in the text
      await caseOf("frage", async () => {
        await fresh();
        await eineSession();
        const soll: [string, string][] = [["spawn-profile", "umstaende"], ["self-credential", "umstaende"], ["context-anchors", "hintergrund"],
          ["regeln-du", "hintergrund"], ["regeln-ordner", "hintergrund"], ["role-card", "howto"], ["lesehilfe", "konzepte"]];
        const ist = await evaluate<[string, string | null, string | null][]>(`${JSON.stringify(soll.map(([id]) => id))}.map((id) => {
          const zeile = ${WIN}?.querySelector('.ksteil[data-teil="' + id + '"]')?.closest('.kskap')?.dataset.kap ?? null;
          let k = ${WIN}?.querySelector('.ksblk[data-teil-b="' + id + '"]')?.previousElementSibling ?? null;
          while (k && !k.classList.contains('kskapitel')) k = k.previousElementSibling;
          return [id, zeile, k?.dataset.kapitelT ?? null]; })`);
        facts.frage = ist;
        claims[C.frage] = ist.length === soll.length && ist.every(([id, zeile, block], i) => id === soll[i]![0] && zeile === soll[i]![1] && block === soll[i]![1]);
      });

      // 20 · the Übersicht opens folded and unfolds one question at a time
      await caseOf("kapitel", async () => {
        await fresh();
        await eineSession();
        const blick = () => evaluate<{ kap: [string, string, boolean, string, boolean][]; sichtbar: number }>(`(() => {
          const zu = (e) => !e || e.getClientRects().length === 0;
          const kap = [...(${WIN}?.querySelectorAll('.ksindex .kskap') ?? [])].map((k) => [k.dataset.kap, k.querySelector('.kstk')?.textContent ?? '',
            !!k.querySelector('.ksbalken i'), k.querySelector('.ksanz')?.textContent ?? '', k.classList.contains('auf')]);
          const sichtbar = [...(${WIN}?.querySelectorAll('.ksindex .ksteil') ?? [])].filter((t) => !zu(t)).length;
          return { kap, sichtbar }; })()`);
        const zu = await blick();
        await kapitelAuf("hintergrund");
        const auf = await blick();
        await click(`${WIN}?.querySelector('.kskap[data-kap="hintergrund"] .kskapk')`);
        await idle();
        const wieder = await blick();
        facts.kapitel = { zu, auf, wieder };
        claims[C.kapitel] = JSON.stringify(zu.kap.map((k) => k[0])) === JSON.stringify(FRAGEN) && zu.sichtbar === 0 && zu.kap.every((k) => !k[4])
          && zu.kap.some((k) => /\d/.test(k[1]) && k[2] && /^\d+ im Start$/.test(k[3]))
          && auf.sichtbar > 0 && auf.kap.filter((k) => k[4]).map((k) => k[0]).join() === "hintergrund"
          && wieder.sichtbar === 0 && wieder.kap.every((k) => !k[4]);
      });

      // 21 · what is not available here stands folded under one line, and says why
      await caseOf("nv", async () => {
        await fresh();
        await eineSession();
        const kap = await evaluate<string | null>(`[...(${WIN}?.querySelectorAll('.ksindex .kskap') ?? [])].find((k) => k.querySelector('.ksnvk'))?.dataset.kap ?? null`);
        if (!kap) throw new Error("no question has a part that is not available here");
        await kapitelAuf(kap);
        const blick = () => evaluate<{ zeile: string; n: number; sichtbar: number; detail: string }>(`(() => {
          const k = ${WIN}?.querySelector('.kskap[data-kap="${kap}"]');
          const nv = [...(k?.querySelectorAll('.ksnv .ksteil') ?? [])];
          return { zeile: k?.querySelector('.ksnvk')?.textContent ?? '', n: nv.length, sichtbar: nv.filter((t) => t.getClientRects().length > 0).length,
            detail: k?.querySelector('.ksnv .ksdetail')?.textContent ?? '' }; })()`);
        const zu = await blick();
        await click(`${WIN}?.querySelector('.kskap[data-kap="${kap}"] .ksnvk')`);
        await idle();
        const auf = await blick();
        await click(`${WIN}?.querySelector('.kskap[data-kap="${kap}"] .ksnv .ksteil')`);
        await idle();
        const detail = await blick();
        facts.nv = { kap, zu, auf, detail };
        claims[C.nv] = zu.n > 0 && zu.sichtbar === 0 && zu.zeile === `${zu.n} ${zu.n === 1 ? "weiterer" : "weitere"} hier nicht verfügbar`
          && auf.sichtbar === zu.n && detail.detail.includes("Warum nicht");
      });

      // 22 · what he may do goes with the start: the default, a level and a switch; another agent gets none
      await caseOf("rechte", async () => {
        const startMit = async (wahl: () => Promise<void>) => {
          await fresh();
          await eineSession();
          await wahl();
          await wait(`${WIN}?.querySelector('.ksgo') && !${WIN}.querySelector('.ksgo').disabled`, 6000);
          await click(`${WIN}?.querySelector('.ksgo')`);
          await wait(`!${WIN}`, 6000); await idle();
          return starts().map((x) => ({ url: x.url, rechte: (x.body as Record<string, unknown>).rechte ?? null, harness: (x.body as Record<string, unknown>).harness ?? null }));
        };
        const standard = await startMit(async () => {});
        let fremd = "";
        let satz = "";
        const gewaehlt = await startMit(async () => {
          await click(`${WIN}?.querySelector('.ksrecht [data-tu="stufe"]')`); await idle();
          await click(`${WIN}?.querySelector('.ksstufe[data-stufe="lesen"]')`); await idle();
          await click(`${WIN}?.querySelector('.ksrecht [data-tu="ausnahme"]')`); await idle();
          await click(`${WIN}?.querySelector('.kssw[data-befehl="landen"]')`); await idle();
          satz = await evaluate<string>(`${WIN}?.querySelector('.ksrsatz span')?.textContent ?? ''`);
        });
        const codex = await startMit(async () => {
          await evaluate(`(() => { const sel = ${WIN}?.querySelector('select[aria-label="Agent"]'); sel.value = 'codex'; sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
          await idle();
          fremd = await evaluate<string>(`[...(${WIN}?.querySelectorAll('.ksabschn') ?? [])].find((a) => a.querySelector('h2')?.textContent === 'Was darf er?')?.textContent ?? ''`);
        });
        facts.rechte = { standard, gewaehlt, satz, codex, fremd };
        const eins = (xs: { url: string; rechte: unknown }[], r: unknown) => xs.length === 1 && xs[0]!.url === `/api/slots/${FREE}/open` && canon(xs[0]!.rechte) === canon(r);
        claims[C.rechte] = eins(standard, { stufe: "bauen", an: [], aus: [] }) && eins(gewaehlt, { stufe: "lesen", an: ["landen"], aus: [] })
          && satz === "Stufe „Nur lesen“Er darf seine Arbeit selbst übernehmen. Dateien ändern, Fleet neu aufspielen und Arbeitskopien wegwerfen machst du."
          && eins(codex, null) && codex[0]!.harness === "codex" && fremd.includes("nur für Claude Code");
      });

      results.push({ width, height, claims, facts });
    }
    return results;
  } finally {
    socket?.close();
    browser.kill();
    await browser.exited.catch(() => undefined);
    rmSync(scratch, { recursive: true, force: true });
  }
}
