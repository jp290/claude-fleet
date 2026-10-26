// THE CHOICES OF THE START WINDOW (src/start-fenster.ts), without DOM: what the user picks on top of `claude` by hand, how the
// preview door and the start door read it, and what differs from normal. Normal is the empty choice: the door sets nothing, and the
// session starts like `claude` in that folder (server/eigenes-setup.ts#EIGENES_SETUP_MINIMUM). The field names are the doors'
// (server.ts#startVonAdresse for the preview, the open and branch doors for the start).
export type Stufe = "lesen" | "bauen" | "landen" | "deployen";
export interface Wahl {
  model: string | null; effort: string | null; permissionMode: string | null;
  // PLAN FIRST (owner 25.10. 19:50: „[Zitat entfernt]“ a switch of its own beside „[Zitat entfernt]“): it starts in Claude Code's plan mode, and the
  // door reads it as permissionMode "plan"; Asks you keeps its own choice
  planFirst: boolean;
  // off = weglassen.claudeMd + rules: the owner's ~/.claude/CLAUDE.md and ~/.claude/rules stay out
  eigeneRegeln: boolean;
  // off = notizbuch "aus": Claude Code's memory of this folder stays out
  gedaechtnis: boolean;
  // off = weglassen.hooks (they go only all together)
  hooks: boolean;
  pluginsAus: string[]; agentenAus: string[];
  // THE MCP SERVERS IT MAY NOT USE (owner 26.10.: the servers at one place, Connectors as a choice), by Claude Code's key
  // (claude_ai_Gmail, plugin_playwright_playwright): weglassen.mcp denies their tools; the server itself still starts (server/weglassen.ts)
  mcpAus: string[];
  // the built-in tools it may use; null = all of them
  tools: string[] | null;
  // the first message, typed into the pane once Claude Code is ready; null = none, "" = switched on and still empty
  aufgabe: string | null;
  // bibliothek: all of Fleet's library (an agent saved before its packs came one by one); rechte: the level of its rights
  bibliothek: boolean; rechte: Stufe | null;
  // THE CONTEXT PACKS IT GETS, one by one (owner 25.10.: „[Zitat entfernt]“): null = as this place gives them
  // (Fleet's repo: its library; elsewhere none), a list = exactly these, from Fleet's library and the packs sessions wrote
  // (server/eigene-packs.ts); the door takes the list as `bibliothek` (server/sitz-wissen.ts#bibliothekDerTuer)
  packs: string[] | null;
  // a board name for its own branch (POST /api/branches, then /api/branches/open); null = it works in the checkout
  branch: string | null;
  // its own notebook, one per branch; the door takes it only with a branch of its own
  notizbuch: boolean;
  schwelle: number | null;
}
export const NORMAL: Readonly<Wahl> = Object.freeze({ model: null, effort: null, permissionMode: null, planFirst: false, eigeneRegeln: true, gedaechtnis: true,
  hooks: true, pluginsAus: [], agentenAus: [], mcpAus: [], tools: null, aufgabe: null, bibliothek: false, rechte: null, packs: null, branch: null, notizbuch: false,
  schwelle: null });
export const normal = (): Wahl => ({ ...NORMAL, pluginsAus: [], agentenAus: [], mcpAus: [] });

// what each level blocks at the start (session-rechte.ts#RECHTE_BEFEHLE): editing files, landing, deploying, throwing a working copy
// away; its shell stays free, so it can still run commands and commit
export const STUFEN: readonly { id: Stufe; wort: string; satz: string }[] = [
  { id: "lesen", wort: "Looks only", satz: "Can't edit files, land or deploy; its shell commands still run." },
  { id: "bauen", wort: "Builds", satz: "Edits files and commits; you land its work." },
  { id: "landen", wort: "May land", satz: "Edits files and may land its work itself." },
  { id: "deployen", wort: "May deploy", satz: "May also redeploy Fleet and throw working copies away." },
];
export const MODI: readonly { id: string | null; wort: string; satz: string }[] = [
  { id: null, wort: "Your setting", satz: "Asks before it acts, as your Claude Code is set." },
  { id: "manual", wort: "Before changes", satz: "Asks you before every change it makes." },
  { id: "acceptEdits", wort: "Before commands", satz: "Edits files on its own; asks before commands." },
  { id: "auto", wort: "On its own", satz: "Works on its own; a safety check stops risky steps." },
  { id: "plan", wort: "Only plans", satz: "Only plans, and changes nothing." },
  { id: "dontAsk", wort: "Never asks", satz: "Never asks; what isn't allowed is refused." },
  { id: "bypassPermissions", wort: "No limits", satz: "Never asks; only deny rules still stop it." },
];
// ASKS YOU OFFERS FOUR (owner 25.10. 19:50): when it stops to ask; planning is „[Zitat entfernt]“, and No limits stays a mode an agent may carry
export const FRAGT: readonly string[] = ["manual", "acceptEdits", "auto", "dontAsk"];

function weglassen(w: Wahl): Record<string, unknown> | null {
  const o: Record<string, unknown> = {};
  if (!w.eigeneRegeln) { o.claudeMd = true; o.rules = true; }
  if (!w.hooks) o.hooks = true;
  if (w.pluginsAus.length) o.plugins = [...w.pluginsAus];
  if (w.agentenAus.length) o.agents = [...w.agentenAus];
  if (w.mcpAus.length) o.mcp = [...w.mcpAus];
  return Object.keys(o).length ? o : null;
}
// the fields both doors share; the notebook only where a branch carries it. Packs chosen one by one go as a list (`bibliothek`,
// „only these packs“), none of them as false
function felder(w: Wahl, mitBranch: boolean): Record<string, unknown> {
  const wg = weglassen(w);
  const liste = w.packs ? (w.packs.length ? [...new Set(w.packs)] : false) : null;
  const modus = w.planFirst ? "plan" : w.permissionMode;
  return { ...(modus ? { permissionMode: modus } : {}), ...(wg ? { weglassen: wg } : {}),
    ...(w.tools ? { tools: [...w.tools] } : {}), ...(!w.gedaechtnis ? { notizbuch: "aus" } : mitBranch && w.notizbuch ? { notizbuch: "branch" } : {}),
    ...(w.rechte ? { rechte: { stufe: w.rechte, an: [], aus: [] } } : {}), ...(liste !== null ? { bibliothek: liste } : w.bibliothek ? { bibliothek: true } : {}),
    ...(w.schwelle !== null ? { schwelle: w.schwelle } : {}) };
}
// THE PREVIEW: the query fields of GET /api/founding-plan (server.ts#startVonAdresse) for this choice; a branch's notebook has no
// preview here (the door needs the branch's own worktree), so it stays out of it
export function vorschau(w: Wahl): Record<string, string> {
  const f = felder(w, false), q: Record<string, string> = {};
  if (w.model) q.model = w.model;
  if (w.effort) q.effort = w.effort;
  for (const [k, v] of Object.entries(f)) q[k] = typeof v === "string" ? v : Array.isArray(v) ? v.join(",") : JSON.stringify(v);
  return q;
}
// THE START: the body fields beside cwd/plan/fassung, for the open door or the branch door
export function tuer(w: Wahl): Record<string, unknown> {
  const f = felder(w, w.branch !== null);
  const ziel = w.aufgabe?.trim();
  return { ...f, ...(ziel ? { goal: ziel } : {}) };
}

// THE CONTEXT PACKS IT GETS: the list it carries, else the library whole (an agent saved before packs came one by one), else what the place
// gives. A pack that takes another's place (trigger seat-choice, `statt`) never comes with it: the server drops the replaced one
// (server/sitz-wissen.ts#bibliothekGewaehlt), and so does this
export interface PackPlatz { id: string; statt?: string }
export function packsAktiv(w: Wahl, ort: readonly string[], ganz: readonly string[], katalog: readonly PackPlatz[]): string[] {
  const liste = w.packs ?? (w.bibliothek ? [...ganz] : [...ort]);
  const weg = new Set(katalog.flatMap((p) => p.statt && liste.includes(p.id) ? [p.statt] : []));
  return liste.filter((id) => !weg.has(id));
}
// A SWITCH FLIPPED: on takes out the variant it replaces or that replaces it, off brings back the variant this place gives; the list keeps
// `reihe` (the library's order, own packs after it), and the same as the place gives is no choice at all
export function schaltePack(w: Wahl, id: string, ort: readonly string[], ganz: readonly string[], katalog: readonly PackPlatz[], reihe: readonly string[]): void {
  const aktiv = packsAktiv(w, ort, ganz, katalog), an = aktiv.includes(id), statt = katalog.find((p) => p.id === id)?.statt;
  const varianten = new Set([...(statt ? [statt] : []), ...katalog.filter((p) => p.statt === id).map((p) => p.id)]);
  const neu = an ? [...aktiv.filter((x) => x !== id), ...(statt && ort.includes(statt) ? [statt] : [])]
    : [...aktiv.filter((x) => !varianten.has(x)), id];
  setzePacks(w, neu, ort, reihe);
}
// exactly these packs, in the library's order; the same as the place gives is no choice at all
export function setzePacks(w: Wahl, neu: readonly string[], ort: readonly string[], reihe: readonly string[]): void {
  const platz = (x: string) => { const i = reihe.indexOf(x); return i < 0 ? reihe.length : i; };
  const liste = [...new Set(neu)].sort((a, b) => platz(a) - platz(b));
  w.bibliothek = false;
  w.packs = liste.length === ort.length && liste.every((x) => ort.includes(x)) ? null : liste;
}

// WHAT DIFFERS FROM NORMAL, one entry per choice, in the order the window shows them: + added, − left out, ~ changed
export interface Abweichung { id: string; zeichen: "+" | "−" | "~"; wort: string }
// `ort`: the packs this place gives without a choice, and a pack's name as a person reads it
export function abweichungen(w: Wahl, modellWort: (id: string) => string = (x) => x,
  ort: { standard: readonly string[]; wort: (id: string) => string } = { standard: [], wort: (x) => x }): Abweichung[] {
  const D: Abweichung[] = [];
  if (w.model || w.effort) D.push({ id: "model", zeichen: "~", wort: `Model: ${w.model ? modellWort(w.model) : "your default"}${w.effort ? `, ${w.effort} effort` : ""}` });
  if (!w.eigeneRegeln) D.push({ id: "rules", zeichen: "−", wort: "Your rules left out" });
  if (!w.gedaechtnis) D.push({ id: "memory", zeichen: "−", wort: "Memory off" });
  const aus = w.pluginsAus.length + w.agentenAus.length + (w.tools ? Math.max(0, TOOL_ZAHL - w.tools.length) : 0);
  if (aus) D.push({ id: "skills", zeichen: "~", wort: `Skills & tools: ${aus} out` });
  if (w.mcpAus.length) D.push({ id: "connectors", zeichen: "−", wort: `Connectors: ${w.mcpAus.length} left out` });
  if (w.permissionMode) D.push({ id: "permissions", zeichen: "~", wort: `Asks you: ${MODI.find((m) => m.id === w.permissionMode)?.wort ?? w.permissionMode}` });
  if (w.planFirst) D.push({ id: "plan", zeichen: "+", wort: "Plan first" });
  if (!w.hooks) D.push({ id: "hooks", zeichen: "−", wort: "Hooks off" });
  if (w.aufgabe !== null) D.push({ id: "task", zeichen: "+", wort: "First task" });
  if (w.bibliothek && w.packs === null) D.push({ id: "knowledge", zeichen: "+", wort: "Fleet's library" });
  if (w.packs) {
    for (const id of w.packs) if (!ort.standard.includes(id)) D.push({ id: `pack:${id}`, zeichen: "+", wort: `Context pack: ${ort.wort(id)}` });
    for (const id of ort.standard) if (!w.packs.includes(id)) D.push({ id: `pack:${id}`, zeichen: "−", wort: `Context pack: ${ort.wort(id)}` });
  }
  if (w.rechte) D.push({ id: "rights", zeichen: "+", wort: `Rights: ${STUFEN.find((s) => s.id === w.rechte)?.wort ?? w.rechte}` });
  if (w.branch !== null) D.push({ id: "branch", zeichen: "+", wort: "Branch & land" });
  if (w.branch !== null && w.notizbuch) D.push({ id: "notebook", zeichen: "+", wort: "Own notebook" });
  if (w.schwelle !== null) D.push({ id: "succession", zeichen: "~", wort: `Succession at ${w.schwelle} %` });
  return D;
}
// Claude Code's built-in tools that stand at the start with their schema, as measured in .fleet/werkzeug-schemas.json (claude 2.1.309,
// 23.10.); the others stand there by name only and load through ToolSearch
export const TOOLS: readonly string[] = ["Artifact", "SendFeedback", "Workflow", "AskUserQuestion", "Agent", "ScheduleWakeup", "Bash",
  "ReportFindings", "Read", "Skill", "ToolSearch", "ListAgents", "Edit", "Write"];
const TOOL_ZAHL = TOOLS.length;

// A SAVED AGENT (server/agenten.ts) carries its choices under the doors' names. What the window can set comes back as a Wahl; what it
// can't (a role, a profile, a seat of the old window, another harness, an agent file) stays in `fremd`, and such an agent starts whole,
// by its id. A task is never part of an agent: it comes at the door.
export function wahlenVon(w: Wahl): Record<string, unknown> {
  return { ...(w.model ? { model: w.model } : {}), ...(w.effort ? { effort: w.effort } : {}), ...felder(w, true) };
}
const STUFE_IDS: readonly string[] = STUFEN.map((s) => s.id);
const texte = (v: unknown): string[] | null => Array.isArray(v) && v.every((x) => typeof x === "string") ? [...v] as string[] : null;
export function wahlAus(wahlen: Record<string, unknown>): { wahl: Wahl; fremd: string[] } {
  const w = normal(), fremd: string[] = [];
  for (const [k, v] of Object.entries(wahlen)) {
    if (v === undefined || v === null) continue;
    if (k === "model" && typeof v === "string") w.model = v;
    else if (k === "effort" && typeof v === "string") w.effort = v;
    else if (k === "permissionMode" && v === "plan") w.planFirst = true;
    else if (k === "permissionMode" && typeof v === "string") w.permissionMode = v;
    else if (k === "harness" && v === "claude") continue;
    else if (k === "tools" && texte(v)) w.tools = texte(v);
    // true: the library whole, as an agent saved before 25.10. carries it; false: no packs at all, wherever it starts
    else if (k === "bibliothek" && v === true) w.bibliothek = true;
    else if (k === "bibliothek" && v === false) w.packs = [];
    // a list: exactly these packs, as it was saved (an agent saved with its packs came back as foreign, held whole, until 25.10.)
    else if (k === "bibliothek" && texte(v)) w.packs = texte(v);
    else if (k === "schwelle" && typeof v === "number") w.schwelle = v;
    else if (k === "notizbuch" && v === "aus") w.gedaechtnis = false;
    else if (k === "notizbuch" && v === "branch") w.notizbuch = true;
    else if (k === "rechte" && v && typeof v === "object" && STUFE_IDS.includes(String((v as Record<string, unknown>).stufe))
      && !texte((v as Record<string, unknown>).an)?.length && !texte((v as Record<string, unknown>).aus)?.length) w.rechte = (v as { stufe: Stufe }).stufe;
    else if (k === "weglassen" && v && typeof v === "object") {
      const o = v as Record<string, unknown>, rest = Object.keys(o).filter((x) => !["claudeMd", "rules", "hooks", "plugins", "agents", "mcp"].includes(x));
      if (rest.length || (o.claudeMd === true) !== (o.rules === true)) { fremd.push(k); continue; }
      if (o.claudeMd === true) w.eigeneRegeln = false;
      if (o.hooks === true) w.hooks = false;
      w.pluginsAus = texte(o.plugins) ?? [];
      w.agentenAus = texte(o.agents) ?? [];
      w.mcpAus = texte(o.mcp) ?? [];
    } else fremd.push(k);
  }
  return { wahl: w, fremd };
}
// the same agent, field by field (the window's „not saved yet“); a task and a branch come at the door, beside any agent
export const gleich = (a: Wahl, b: Wahl): boolean => JSON.stringify(wahlenVon(a)) === JSON.stringify(wahlenVon(b));
