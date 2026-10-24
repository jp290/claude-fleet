// THE CHOICES OF THE START WINDOW (src/start-fenster.ts), without DOM: what the user picks on top of `claude` by hand, how the
// preview door and the start door read it, and what differs from normal. Normal is the empty choice: the door sets nothing, and the
// session starts like `claude` in that folder (server/eigenes-setup.ts#EIGENES_SETUP_MINIMUM). The field names are the doors'
// (server.ts#startVonAdresse for the preview, the open and branch doors for the start).
export type Stufe = "lesen" | "bauen" | "landen" | "deployen";
export interface Wahl {
  model: string | null; effort: string | null; permissionMode: string | null;
  // off = weglassen.claudeMd + rules: the owner's ~/.claude/CLAUDE.md and ~/.claude/rules stay out
  eigeneRegeln: boolean;
  // off = notizbuch "aus": Claude Code's memory of this folder stays out
  gedaechtnis: boolean;
  // off = weglassen.hooks (they go only all together)
  hooks: boolean;
  pluginsAus: string[]; agentenAus: string[];
  // the built-in tools it may use; null = all of them
  tools: string[] | null;
  // the first message, typed into the pane once Claude Code is ready; null = none, "" = switched on and still empty
  aufgabe: string | null;
  bibliothek: boolean; rechte: Stufe | null;
  // a board name for its own branch (POST /api/branches, then /api/branches/open); null = it works in the checkout
  branch: string | null;
  // its own notebook, one per branch; the door takes it only with a branch of its own
  notizbuch: boolean;
  schwelle: number | null;
}
export const NORMAL: Readonly<Wahl> = Object.freeze({ model: null, effort: null, permissionMode: null, eigeneRegeln: true, gedaechtnis: true,
  hooks: true, pluginsAus: [], agentenAus: [], tools: null, aufgabe: null, bibliothek: false, rechte: null, branch: null, notizbuch: false,
  schwelle: null });
export const normal = (): Wahl => ({ ...NORMAL, pluginsAus: [], agentenAus: [] });

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

function weglassen(w: Wahl): Record<string, unknown> | null {
  const o: Record<string, unknown> = {};
  if (!w.eigeneRegeln) { o.claudeMd = true; o.rules = true; }
  if (!w.hooks) o.hooks = true;
  if (w.pluginsAus.length) o.plugins = [...w.pluginsAus];
  if (w.agentenAus.length) o.agents = [...w.agentenAus];
  return Object.keys(o).length ? o : null;
}
// the fields both doors share; the notebook only where a branch carries it
function felder(w: Wahl, mitBranch: boolean): Record<string, unknown> {
  const wg = weglassen(w);
  return { ...(w.permissionMode ? { permissionMode: w.permissionMode } : {}), ...(wg ? { weglassen: wg } : {}),
    ...(w.tools ? { tools: [...w.tools] } : {}), ...(!w.gedaechtnis ? { notizbuch: "aus" } : mitBranch && w.notizbuch ? { notizbuch: "branch" } : {}),
    ...(w.rechte ? { rechte: { stufe: w.rechte, an: [], aus: [] } } : {}), ...(w.bibliothek ? { bibliothek: true } : {}),
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

// WHAT DIFFERS FROM NORMAL, one entry per choice, in the order the window shows them: + added, − left out, ~ changed
export interface Abweichung { id: string; zeichen: "+" | "−" | "~"; wort: string }
export function abweichungen(w: Wahl, modellWort: (id: string) => string = (x) => x): Abweichung[] {
  const D: Abweichung[] = [];
  if (w.model || w.effort) D.push({ id: "model", zeichen: "~", wort: `Model: ${w.model ? modellWort(w.model) : "your default"}${w.effort ? `, ${w.effort} effort` : ""}` });
  if (!w.eigeneRegeln) D.push({ id: "rules", zeichen: "−", wort: "Your rules left out" });
  if (!w.gedaechtnis) D.push({ id: "memory", zeichen: "−", wort: "Memory off" });
  const aus = w.pluginsAus.length + w.agentenAus.length + (w.tools ? Math.max(0, TOOL_ZAHL - w.tools.length) : 0);
  if (aus) D.push({ id: "skills", zeichen: "~", wort: `Skills & tools: ${aus} out` });
  if (w.permissionMode) D.push({ id: "permissions", zeichen: "~", wort: `Asks you: ${MODI.find((m) => m.id === w.permissionMode)?.wort ?? w.permissionMode}` });
  if (!w.hooks) D.push({ id: "hooks", zeichen: "−", wort: "Hooks off" });
  if (w.aufgabe !== null) D.push({ id: "task", zeichen: "+", wort: "First task" });
  if (w.bibliothek) D.push({ id: "knowledge", zeichen: "+", wort: "Fleet's guides" });
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
    else if (k === "permissionMode" && typeof v === "string") w.permissionMode = v;
    else if (k === "harness" && v === "claude") continue;
    else if (k === "tools" && texte(v)) w.tools = texte(v);
    else if (k === "bibliothek" && typeof v === "boolean") w.bibliothek = v;
    else if (k === "schwelle" && typeof v === "number") w.schwelle = v;
    else if (k === "notizbuch" && v === "aus") w.gedaechtnis = false;
    else if (k === "notizbuch" && v === "branch") w.notizbuch = true;
    else if (k === "rechte" && v && typeof v === "object" && STUFE_IDS.includes(String((v as Record<string, unknown>).stufe))
      && !texte((v as Record<string, unknown>).an)?.length && !texte((v as Record<string, unknown>).aus)?.length) w.rechte = (v as { stufe: Stufe }).stufe;
    else if (k === "weglassen" && v && typeof v === "object") {
      const o = v as Record<string, unknown>, rest = Object.keys(o).filter((x) => !["claudeMd", "rules", "hooks", "plugins", "agents"].includes(x));
      if (rest.length || (o.claudeMd === true) !== (o.rules === true)) { fremd.push(k); continue; }
      if (o.claudeMd === true) w.eigeneRegeln = false;
      if (o.hooks === true) w.hooks = false;
      w.pluginsAus = texte(o.plugins) ?? [];
      w.agentenAus = texte(o.agents) ?? [];
    } else fremd.push(k);
  }
  return { wahl: w, fremd };
}
// the same agent, field by field (the window's „not saved yet“); a task and a branch come at the door, beside any agent
export const gleich = (a: Wahl, b: Wahl): boolean => JSON.stringify(wahlenVon(a)) === JSON.stringify(wahlenVon(b));
