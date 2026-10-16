// THE CONSTELLATION WINDOW IN A REAL BROWSER (Neuaufbau K16 E2b, src/konstellation.ts). Owner 15.10.: „[Zitat entfernt]“
// 
// ; 16.10.: „[Zitat entfernt]“
// , „[Zitat entfernt]“. Done
// (Bauleitung 16.10.): every active session stands exactly once, the tree shows the build only, the details come under
// the pointer, on a click and with „Alles“; on the phone a first tap is the small card and a second the properties.
// R3 (owner 16.10.: „[Zitat entfernt]“ as K15's Autonomie; „[Zitat entfernt]“
// ): the click reads like K15's Autonomie, every row says who decides it, and a
// fixed one names its reason on a tap; Maschine and Isolation say what could be and that it is not active.
// The real client bundle behind a fixture origin (as e2e/role-address.ts runPostfachDom): /api/sessions names eight
// occupied slots of every kind, /api/programs binds one MAIN, /api/branches names one branch session and one stale
// occupant, the briefs answer per slot, /api/founding-plan answers per role (one repo's plan fails). Every claim reads
// the DOM at 1200×900 and at 390×844, and every claim has a MUTANT in KONST_MUTANTS that swaps one needle in the bundle or the page and must turn exactly that claim red; a needle
// that left the source throws, so a mutant that could not apply fails as itself. Driven by e2e/dom.ts.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export interface KonstDomResult { width: number; height: number; claims: Record<string, boolean>; facts: Record<string, unknown> }
export interface KonstMutant { name: string; claim: string; file: "src/konstellation.ts" | "src/konstellation-model.ts" | "public/index.html"; needle: string; with: string; width?: 1200 | 390 }

export const KONST_CLAIM = {
  once: "the head row's Konstellation button opens the window, and every active session stands in it exactly once — no free slot",
  tree: "Orchestratorin → MAIN → its lane, a session → the lane opened from it (as the left bar stacks it); the lane without either, the branch session and the plain sessions stand in their own groups",
  aufbau: "at rest the tree is the build only: one line per session with its name, its kind, its state and slot — no value and no branch on it — and all of it in one window height",
  peek: "under the pointer a line shows a small card with model, effort, context, handover and branch; it goes with the pointer and moves no line",
  values: "the properties name model, effort, succession (labelled „Succession“, Fleet's word), rights, agent, binding and place as the wire gives them, in the column's words, and Claude Code's rows as her role's plan names them",
  unknown: "what Fleet cannot tell stays a sentence: context „nicht messbar“, a brief or a plan that fails „nicht lesbar“, a permission mode the transcript did not name „nicht gemeldet“; a context below 1 % reads „< 1 %“, never 0",
  wer: "every property row says who decides it, by its own tag or its section's, in K15's three words: model, effort and handover „änderbar“, rights, Maschine and Isolation „Fleet-Standard“, the system prompt „Claude-Code-Standard“, a switch of Fleet's start line „Fleet-Standard“",
  autonomie: "the role card's three lists stand as in K15: „Entscheidet selbst“, „Fragt zuerst“ (whom she asks), „Nie“, with their counts and the points in reading words; a free session says she has no role card",
  grund: "a tap on a standard's tag writes its reason under its row and a second tap takes it away — no pointer needed; the tag's title carries the reason and where it follows from; every standard's reason first says whether and where it can be set today (owner 16.10.: a Fleet that should be customizable never says „steht fest“)",
  start: "a lane shows the role card from her own session file (AGENTS.override.md, „## Rolle“) and says when Fleet gives a new lane another one today; where that file is missing, and for a MAIN and the Orchestratorin, today's card stands marked „Fassung von heute“",
  phone: "on the phone a row keeps its tag right of its value, so a short value with its tag is one line — also beside the widest tag, „Claude-Code-Standard“, the value never breaks inside a word; an indented line may wrap a value only at a space or after a hyphen",
  maschine: "Maschine names this Fleet's instance and, gray, that other machines are possible but not connected, with a link to each other Fleet the wire lists; Isolation reads „keine“ with „Sandbox/VM möglich, nicht aktiv“, gray and without a switch",
  fit: "nothing runs over: a long name gives way with …, the kind always stands whole, and with every property open each line wraps inside the window, no sideways scroll",
  alles: "„Detailgrad: Alles“ writes the card's values as a quiet second line under every session and opens no sheet, the window keeps the choice when it opens again, „Aufbau“ takes the lines away",
  click: "a click on a line opens that session's properties — Autonomie, Rechte, Einstellungen, Claude Code, Aufbau — and the line stays where it stood, and „Session zeigen“ there shows it in the pane and closes the window",
  touch: "without hover a first tap on a line shows the small card and opens nothing, a second tap opens the properties",
  calm: "at rest a line paints no fill; the gray fill comes only under the pointer",
} as const;

export const KONST_MUTANTS: readonly KonstMutant[] = [
  { name: "free slots counted as sessions", claim: KONST_CLAIM.once, file: "src/konstellation-model.ts",
    needle: "const active = slots.filter((s) => !!s.cwd);", with: "const active = slots.filter(() => true);" },
  { name: "a lane's anchor ignored", claim: KONST_CLAIM.tree, file: "src/konstellation-model.ts",
    needle: "const opener = main ?? (anchor ?", with: "const opener = main ?? (false ?" },
  { name: "the values stand on every line at rest", claim: KONST_CLAIM.aufbau, file: "src/konstellation.ts",
    needle: `if (detail === "alles") line.appendChild(werteEl(n));`, with: `line.appendChild(werteEl(n));` },
  { name: "no small card under the pointer", claim: KONST_CLAIM.peek, file: "src/konstellation.ts",
    needle: `row.onpointerenter = (e) => { if (e.pointerType === "mouse" && !isOpen(s) && detail === "aufbau") showPeek(s, false); };`, with: `row.onpointerenter = () => undefined;` },
  { name: "the pane footer's model ignored", claim: KONST_CLAIM.values, file: "src/konstellation.ts",
    needle: "runningModel(s.model, pane?.observedModel, s.paneModel)", with: "runningModel(s.model, pane?.observedModel)" },
  { name: "the permission mode on the wire not shown", claim: KONST_CLAIM.values, file: "src/konstellation.ts",
    needle: `return s.permissionMode ? MODE_WORD[s.permissionMode] ?? s.permissionMode : "nicht gemeldet";`, with: `return "nicht gemeldet";` },
  { name: "an unmeasurable context painted as 0 %", claim: KONST_CLAIM.unknown, file: "src/konstellation.ts",
    needle: `if (s.ctx === null) return "nicht messbar";`, with: `if (s.ctx === null) return "0 %";` },
  { name: "the kind gives way before the name", claim: KONST_CLAIM.fit, file: "public/index.html", width: 390,
    needle: ".krole { flex: none; color: var(--chat-mute); font-size: var(--chat-ui-fs); white-space: nowrap; }",
    with: ".krole { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--chat-mute); font-size: var(--chat-ui-fs); white-space: nowrap; } .kname { flex: none !important; }" },
  { name: "a property value does not wrap", claim: KONST_CLAIM.fit, file: "public/index.html", width: 390,
    needle: ".kx { min-width: 0; color: var(--chat-prose); overflow-wrap: anywhere; }",
    with: ".kx { min-width: 0; color: var(--chat-prose); white-space: nowrap; }" },
  { name: "the Detailgrad is not kept", claim: KONST_CLAIM.alles, file: "src/konstellation.ts",
    needle: "try { localStorage.setItem(DETAIL_KEY, d); }", with: "try { void d; }" },
  { name: "the window grows with a sheet and moves the line", claim: KONST_CLAIM.click, file: "public/index.html",
    needle: "height: min(86vh, 860px); max-height: min(86vh, 860px); }", with: "height: auto; max-height: min(86vh, 860px); }" },
  { name: "„Session zeigen“ closes without showing the session", claim: KONST_CLAIM.click, file: "src/konstellation.ts",
    needle: "go.onclick = () => { if (showSlot(s.id)) shell?.close(); };", with: "go.onclick = () => { shell?.close(); };" },
  { name: "the first tap opens the properties", claim: KONST_CLAIM.touch, file: "src/konstellation.ts", width: 390,
    needle: `if (touch && !isOpen(s) && detail === "aufbau" && peek?.key !== keyOf(s)) { showPeek(s, true); return; }`, with: "void touch;" },
  { name: "a MAIN's recorded spawn ignored", claim: KONST_CLAIM.values, file: "src/konstellation.ts",
    needle: "    if (s.spawn) {", with: "    if (s.spawn && false) {" },
  { name: "the system prompt counted as Fleet's", claim: KONST_CLAIM.wer, file: "src/konstellation.ts",
    needle: "CC_WERT[z.id] ?? z.wert, werBeiClaudeCode(z)", with: "CC_WERT[z.id] ?? z.wert, fest(z.satz, z.quelle)" },
  { name: "a lane read as a free session", claim: KONST_CLAIM.autonomie, file: "src/konstellation.ts",
    needle: `{ orchestrator: "orchestratorin", "program-main": "main", lane: "lane" }`, with: `{ orchestrator: "orchestratorin", "program-main": "main" }` },
  { name: "a standard's reason does not say whether it can be set", claim: KONST_CLAIM.grund, file: "src/konstellation.ts",
    needle: 'fest("Noch nicht einstellbar: Befehle und Dateien', with: 'fest("Befehle und Dateien' },
  { name: "a tap on a tag writes nothing", claim: KONST_CLAIM.grund, file: "src/konstellation.ts", width: 390,
    needle: "t.onclick = () => { if (why.has(id)) why.delete(id); else why.add(id); paint(); };", with: "t.onclick = () => undefined;" },
  { name: "the lane's own session file not read", claim: KONST_CLAIM.start, file: "src/konstellation.ts",
    needle: "if (!s.worktree || !s.cwd) return null;", with: "return null;" },
  { name: "the tag drops under the value on the phone", claim: KONST_CLAIM.phone, file: "public/index.html", width: 390,
    needle: ".kprops .kv { grid-template-columns: 7.5em minmax(0, 1fr) auto; column-gap: 8px; }",
    with: ".kprops .kv { grid-template-columns: 7.5em minmax(0, 1fr); column-gap: 8px; } .kprops .kv > .kwer { grid-column: 2; grid-row: auto; justify-self: start; }" },
  { name: "the widest tag squeezes a short value on the phone", claim: KONST_CLAIM.phone, file: "public/index.html", width: 390,
    needle: ".kprops .kv > .kwer.claude-code { height: auto; min-height: 22px; max-width: 94px; padding: 3px 6px; line-height: 1.2; white-space: normal; text-align: right; }", with: "" },
  { name: "a value breaks inside a word in an indented line", claim: KONST_CLAIM.phone, file: "public/index.html", width: 390,
    needle: ".kprops .kv > .kwer { height: 22px; }", with: ".kprops .kv > .kwer { height: 22px; } .kn .kn > .kprops .kv > .kx { max-width: 3.2em; }" },
  { name: "the other Fleets not linked", claim: KONST_CLAIM.maschine, file: "src/konstellation.ts",
    needle: "for (const l of others) {", with: "for (const l of others.slice(0, 0)) {" },
  { name: "Isolation not gray", claim: KONST_CLAIM.maschine, file: "public/index.html",
    needle: `.kprops .kv[data-k="isolation"] .kx { color: var(--chat-faint); }`, with: "" },
  { name: "a line wears its fill at rest", claim: KONST_CLAIM.calm, file: "public/index.html",
    needle: "text-align: left; background: transparent; border: 0; border-radius: var(--r2);",
    with: "text-align: left; background: var(--chat-raised); border: 0; border-radius: var(--r2);" },
];

const LONG_BRANCH = "lane/ein-sehr-langer-branchname-der-auf-dem-handy-umbrechen-muss-statt-abgeschnitten-zu-werden";

export async function runKonstellationDom(sourceRoot: string, artifacts?: string,
  only: { widths?: readonly number[]; mutate?: KonstMutant } = {}): Promise<KonstDomResult[]> {
  const scratch = resolve(tmpdir(), `fleet-konst-dom-${process.pid}-${crypto.randomUUID()}`);
  mkdirSync(scratch, { recursive: true });
  if (artifacts) mkdirSync(artifacts, { recursive: true });
  const mutant = only.mutate;
  const htmlMutant = mutant?.file === "public/index.html" ? mutant : null;
  const mutantPath = mutant && !htmlMutant ? resolve(sourceRoot, mutant.file) : null;
  let applied = !mutant;
  const built = await Bun.build({ entrypoints: [resolve(sourceRoot, "src/client.ts")], target: "browser",
    plugins: mutant && mutantPath ? [{ name: "konst-mutant", setup(build) {
      build.onLoad({ filter: /\.ts$/ }, ({ path }) => {
        if (path !== mutantPath) return;
        const source = readFileSync(path, "utf8");
        applied = source.includes(mutant.needle);
        return { contents: source.replace(mutant.needle, mutant.with), loader: "ts" };
      });
    } }] : [] });
  if (!built.success) { rmSync(scratch, { recursive: true, force: true }); throw new Error(built.logs.join("\n")); }
  const appJs = await built.outputs[0]!.text();
  let indexHtml = readFileSync(resolve(sourceRoot, "public/index.html"), "utf8");
  if (htmlMutant) { applied = indexHtml.includes(htmlMutant.needle); indexHtml = indexHtml.replace(htmlMutant.needle, htmlMutant.with); }
  if (!applied) { rmSync(scratch, { recursive: true, force: true }); throw new Error(`konstellation mutant: needle not in ${mutant?.file}: ${mutant?.needle.slice(0, 80)}`); }

  const now = Date.now();
  // seven occupations of every kind; 8–16 free
  const slots = [
    { id: 1, cwd: "/fixture/orch", label: "Orchestratorin", openedAt: 1000, lastOutput: 0, model: "claude-opus-5-5[1m]", effort: "high",
      role: "orchestrator", permissionMode: "auto", ctx: { usedTokens: 316_000, windowTokens: 1_000_000, pct: 31.6 },
      cache: { lastCallAt: now - 60_000, ttlSec: 3600 }, compaction: { at: now - 7_200_000, trigger: "auto", preTokens: 377_619, postTokens: 11_921, idle: true } },
    { id: 2, cwd: "/fixture/main", label: "MAIN Alpha", openedAt: 2000, lastOutput: 0, model: "claude-sonnet-5-5", effort: "medium",
      role: "program-main", ctx: null, succession: { session: 3, taken: null, cap: null }, spawn: { role: "main", tools: 15 } },
    { id: 3, cwd: "/fixture/r.worktrees/a", label: null, openedAt: 3000, lastOutput: 0, model: "claude-opus-5-5[1m]", paneModel: "claude-sonnet-5-5",
      effort: "xhigh", permissionMode: "bypassPermissions", worktree: { repo: "/fixture/r", branch: LONG_BRANCH }, programId: "p-alpha", taskId: "1a2b3c4d5e6f", taskTitle: "Bau A",
      ctx: { usedTokens: 24_000, windowTokens: 200_000, pct: 12 } },
    { id: 4, cwd: "/fixture/r.worktrees/b", label: "Lose Lane mit einem sehr langen Namen, der am Handy gekürzt wird", openedAt: 4000, lastOutput: 0, model: "gpt-5.5", harness: "codex",
      worktree: { repo: "/fixture/r", branch: "lane/b" }, permissions: { sandbox: "workspace-write", approval: "never" },
      ctx: { usedTokens: 50_000, windowTokens: 272_000, pct: 18.4 } },
    { id: 5, cwd: "/fixture/r.worktrees/bau-einstellungen", label: null, openedAt: 5000, lastOutput: 0, model: "claude-opus-5-5[1m]", effort: "xhigh", standingHandover: { at: now - 600_000 },
      ctx: { usedTokens: 100_000, windowTokens: 1_000_000, pct: 10 } },
    { id: 6, cwd: "/fixture/frei", label: "Frei", openedAt: 6000, lastOutput: 0, model: null, git: { branch: "main", dirty: 0, ahead: 0, behind: 0 },
      workplace: { path: "/fixture/frei", mainCheckout: true, measuredAt: now }, compaction: { at: now - 60_000, trigger: "manual", preTokens: 90_000, postTokens: 9_000, idle: false },
      ctx: { usedTokens: 1_000, windowTokens: 200_000, pct: 0.5 } },
    { id: 7, cwd: "/fixture/r.worktrees/bau-alt", label: "Neu auf 7", openedAt: 7000, lastOutput: 0, model: "claude-opus-5-5[1m]", effort: "low",
      ctx: { usedTokens: 2_000, windowTokens: 1_000_000, pct: 0.2 } },
    { id: 8, cwd: "/fixture/frei.worktrees/c", label: "Lane von Frei", openedAt: 8000, lastOutput: 0, model: "claude-opus-5-5[1m]", effort: "high",
      worktree: { repo: "/fixture/frei", branch: "lane/c", anchor: { slot: 6, openedAt: 6000 } }, ctx: { usedTokens: 30_000, windowTokens: 1_000_000, pct: 3 } },
    ...Array.from({ length: 8 }, (_, i) => ({ id: i + 9, cwd: null, label: null, lastOutput: 0 })),
  ];
  const branch = (b: string, name: string, slot: number, openedAt: number) => ({ branch: b, name, base: null, head: "h", text: "", rev: 1,
    seen: null, path: null, session: { slot, openedAt }, distance: null, lands: [], chargeBase: null, chargeCommits: null, check: null });
  const branches = { repos: [{ repo: "/fixture/r", integration: "main", others: [], othersTotal: 0, reasons: [],
    branches: [branch("bau/einstellungen", "Einstellungen (K16)", 5, 5000), branch("bau/alt", "Alt", 7, 1)] }] };
  const programs = { programs: [{ id: "p-alpha", status: "active", title: "Alpha", createdAt: 0, main: { slot: 2, openedAt: 2000 } }] };
  const sc = (o: Record<string, unknown>) => ({ rail: "standard-main", fill: null, nudges: 0, nudgedAt: null, gaveUp: false, maxNudges: 3,
    session: 1, taken: null, cap: null, defaultPct: 45, pctFrom: "fleet", nudgeOn: true, thresholdOff: null, atThreshold: "succeed", ...o });
  const briefOf: Record<number, { status: number; body: unknown }> = {
    1: { status: 200, body: { succession: sc({ thresholdPct: 45 }) } },
    2: { status: 200, body: { succession: sc({ thresholdPct: null, thresholdOff: "session" }) } },
    3: { status: 200, body: { succession: sc({ rail: "lane", thresholdPct: 50, capPct: 55,
      cache: { state: "warm", lastCallAt: now - 60_000, ttlSec: 3600, coldAt: now + 3_000_000 } }) } },
    4: { status: 500, body: "boom" },
    5: { status: 200, body: { succession: sc({ thresholdPct: 40 }) } },
    6: { status: 400, body: { error: "not a git repo", git: "none", succession: sc({ thresholdPct: 45 }) } },
    7: { status: 200, body: { succession: sc({ thresholdPct: 45 }) } },
    8: { status: 200, body: { succession: sc({ rail: "lane", thresholdPct: 37, capPct: 42, atThreshold: "hint",
      cache: { state: "kalt", lastCallAt: now - 4_000_000, ttlSec: 3600, coldAt: now - 400_000 } }) } },
  };
  // the plan per role (GET /api/founding-plan): the role card in the card's own spelling and Claude Code's rows; a free
  // session's plan („Nur Ordner“) writes no session file; the repo /fixture/frei answers no plan at all
  const CARD: Record<string, string> = {
    lane: ["--- ROLLE --- Lane: fuehrst genau eine Karte aus.", "--- DEIN EMPFAENGER --- deine MAIN: Rueckfragen per POST /api/self/clarifications.",
      "--- DU ENTSCHEIDEST --- wie du das DONE erreichst, innerhalb von FLAECHE und VERBOTEN.",
      "--- DEINE GRENZE --- alles ausserhalb der Karte, andere Repos, ~/.claude: stoppen und fragen. Nie landen.",
      "--- BLOCKER (immer) --- nichts landet ohne gruenen Gate · keine Session schliesst eine fremde · Zugangsdaten nie in einer Ausgabe."].join("\n"),
    main: ["--- ROLLE --- Program-MAIN: fuehrt genau ein Program.", "--- DEIN EMPFAENGER --- der Owner: im Gespraech.",
      "--- DU ENTSCHEIDEST --- Zuschnitt, Reihenfolge, Archiv.", "--- DER OWNER ENTSCHEIDET --- Regelwerk, Deploy, Veroeffentlichung.",
      "--- BLOCKER (immer) --- nichts landet ohne gruenen Gate · Geld beim Owner."].join("\n"),
    orchestratorin: ["--- ROLLE --- Orchestratorin: uebersetzt Owner-Absicht.", "--- DEIN EMPFAENGER --- der Owner: im Gespraech.",
      "--- DU ENTSCHEIDEST --- Programs anlegen, Karten schneiden, MAINs wecken.", "--- DER OWNER ENTSCHEIDET --- Regelwerk, Loeschen, Deploy.",
      "--- BLOCKER (immer) --- nichts landet ohne gruenen Gate · Geld beim Owner."].join("\n"),
  };
  const cc = (id: string, wort: string, weg: string, wert: string) => ({ id, wort, weg, wert, satz: `Satz ${id}.`, quelle: `quelle#${id}`, bytes: "unknown" });
  const ccRows = (role: string) => [cc("systemprompt", "Systemprompt", "Claude Code", "nur in der Summe gemessen"),
    role === "lane" ? cc("werkzeuge", "Werkzeuge", "--tools", "14 Werkzeuge") : cc("werkzeuge", "Werkzeuge", "kein --tools", "alle eingebauten"),
    cc("globale-regeln", "Globale Regeln", "native Datei", "1 Datei"),
    role === "lane" ? cc("mcp", "MCP", "--strict-mcp-config", "kein Server") : cc("mcp", "MCP", "Konfiguration des Accounts", "nicht von Fleet gewählt")];
  // the lane in slot 3 has her own session file; its card asks at four points where today's asks at three
  const START_CARD = CARD.lane!.replace("andere Repos, ~/.claude:", "andere Repos, ~/.claude, geteilte Ports:");
  const SESSION_FILE = `## Rolle\n\n${START_CARD}\n\n## Anleitung\n\n\n\n## Wissen\n\nx\n\n## Lane-Ende\n\n--- DEIN EMPFAENGER --- nicht hier.\n`;
  const planReads: string[] = [];
  const planOf = (q: URLSearchParams): { status: number; body: unknown } => {
    const role = q.get("role") ?? "", harness = q.get("harness");
    planReads.push(`${role}@${q.get("repo")}${harness ? `#${harness}` : ""}`);
    if (q.get("repo") === "/fixture/frei") return { status: 500, body: { error: "fixture: no plan" } };
    const card = CARD[role];
    return { status: 200, body: { sessionAgents: card ? { parts: [{ id: "role", content: card, path: "server.ts", anchor: `${role.toUpperCase()}_ROLE_CARD` }] } : null,
      claudeCode: harness && harness !== "claude" ? null : { rolle: role, zeilen: ccRows(role) } } };
  };

  const executable = process.env.FLEET_E2E_BROWSER ?? Bun.which("chromium") ?? Bun.which("chromium-browser") ?? Bun.which("google-chrome") ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!Bun.file(executable).size) { rmSync(scratch, { recursive: true, force: true }); throw new Error("konstellation DOM probe needs Chromium (FLEET_E2E_BROWSER): " + executable); }
  // a mouse whatever the machine (as runPostfachDom): the calm claim reads the edge under the pointer
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
    const json = (requestId: string, value: unknown, status = 200) => reply(requestId, status, typeof value === "string" ? value : JSON.stringify(value));
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
      const { requestId, request } = msg.params as { requestId: string; request: { url: string; method: string } };
      const p = new URL(request.url).pathname;
      if (request.method === "POST") return void json(requestId, { ok: true });
      if (p === "/" || p === "/blank") return void reply(requestId, 200, p === "/" ? indexHtml : "<!doctype html><title>blank</title>", "text/html");
      if (p === "/app.js") return void reply(requestId, 200, appJs, "text/javascript");
      if (p === "/api/sessions") return void json(requestId, { now: Date.now(), chips: [], tasks: [], slots, instance: { name: "mac" },
        instances: [{ name: "mac", url: "http://fleet.fixture" }, { name: "workhorse", url: "http://workhorse.fixture:8790" }],
        programs: programs.programs.map(({ id, status, title, createdAt }) => ({ id, status, title, createdAt })) });
      if (p === "/api/programs") return void json(requestId, programs);
      if (p === "/api/branches") return void json(requestId, branches);
      if (p === "/api/file") return void (new URL(request.url).searchParams.get("path") === "/fixture/r.worktrees/a/AGENTS.override.md"
        ? json(requestId, { text: SESSION_FILE, binary: false, truncated: false, path: "/fixture/r.worktrees/a/AGENTS.override.md", rev: null })
        : json(requestId, { error: "no such file" }, 404));
      if (p === "/api/founding-plan") { const pl = planOf(new URL(request.url).searchParams); return void json(requestId, pl.body, pl.status); }
      const bm = /^\/api\/slots\/(\d+)\/brief$/.exec(p);
      if (bm) { const b = briefOf[Number(bm[1])]; return void json(requestId, b?.body ?? { error: "fixture" }, b?.status ?? 404); }
      return void json(requestId, { error: "fixture: not served" }, 404);
    };
    const evaluate = async <T>(expression: string): Promise<T> => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error("konstellation DOM probe: evaluate failed: " + expression.replace(/\s+/g, " ").slice(0, 120));
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
    const shot = async (name: string) => {
      if (!artifacts) return;
      const png = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      writeFileSync(resolve(artifacts, `${name}.png`), Buffer.from(String(png.data), "base64"));
    };
    const WIN = `document.querySelector('#shell-konstellation')`;
    // per line: its slot, group, parent line, name, role, whether it carries its state sign and any value, where it stands
    const READ = `(() => { const w = ${WIN}; if (!w) return null;
      return [...w.querySelectorAll('.kn')].map((n) => { const r = n.querySelector(':scope > .kline > .krow'); const b = r.getBoundingClientRect();
        const cs = getComputedStyle(r);
        return { slot: Number(n.dataset.slot), kind: n.dataset.kind, group: n.closest('.kgrp')?.dataset.group ?? null,
          parent: n.parentElement?.closest('.kn') ? Number(n.parentElement.closest('.kn').dataset.slot) : null,
          name: r.querySelector('.kname')?.textContent ?? null, role: r.querySelector('.krole')?.textContent ?? null,
          act: !!r.querySelector(':scope > .act'), valuesOnLine: n.querySelector(':scope > .kline .kv, :scope > .kline .kwerte, :scope > .kprops') ? true : false,
          nameCut: (() => { const k = r.querySelector('.kname'); return !!k && k.scrollWidth > k.clientWidth + 1; })(),
          kindWhole: (() => { const k = r.querySelector('.krole'); return !k || (k.scrollWidth <= k.clientWidth + 1 && k.getBoundingClientRect().right <= b.right + 0.5); })(),
          top: Math.round(b.top), bottom: Math.round(b.bottom), fill: cs.backgroundColor }; }); })()`;
    // the properties of every open line: section titles, each value by its key, who decides it (its own tag or its
    // section's), what stands quiet under it, the role card's three lists and the empty sentences
    const PROPS = `(() => { const w = ${WIN}; if (!w) return null; const wer = (t) => t ? t.className.replace('kwer ', '') : null;
      return Object.fromEntries([...w.querySelectorAll('.kprops')].map((p) => [p.dataset.slot, {
        sections: [...p.querySelectorAll('.kpsh')].map((h) => h.textContent),
        vals: Object.fromEntries([...p.querySelectorAll('.kv')].map((v) => [v.dataset.k, v.querySelector('.kx')?.textContent.replace(/\\u00a0/g, ' ') ?? null])),
        wer: Object.fromEntries([...p.querySelectorAll('.kv')].map((v) => [v.dataset.k, wer(v.querySelector(':scope > .kwer'))])),
        secWer: Object.fromEntries([...p.querySelectorAll('.kps')].map((x) => [x.dataset.sec, wer(x.querySelector(':scope > .kpsk > .kwer'))])),
        untagged: [...p.querySelectorAll('.kv')].filter((v) => !v.querySelector(':scope > .kwer') && !v.closest('.kps')?.querySelector(':scope > .kpsk > .kwer')).map((v) => v.dataset.k),
        labels: Object.fromEntries([...p.querySelectorAll('.kv')].map((v) => [v.dataset.k, v.querySelector(':scope > .kk')?.textContent ?? null])),
        words: [...new Set([...p.querySelectorAll('.kwer')].map((t) => t.className.replace('kwer ', '') + '=' + t.textContent))],
        standards: [...p.querySelectorAll('.kwer:not(.du)')].length,
        unsaid: [...p.querySelectorAll('.kwer:not(.du)')].filter((t) => !/^(Noch nicht (je Session )?einstellbar|Nicht in Fleet einstellbar|Einstellbar beim Öffnen)/.test(t.title)).map((t) => t.dataset.why + ': ' + t.title.split('\\n')[0]),
        more: Object.fromEntries([...p.querySelectorAll('.kv')].filter((v) => v.querySelector('.kmore')).map((v) => [v.dataset.k, v.querySelector('.kmore').textContent])),
        links: [...p.querySelectorAll('.klink')].map((a) => a.textContent + ' ' + a.getAttribute('href')),
        auto: Object.fromEntries([...p.querySelectorAll('.kag')].map((g) => [g.dataset.art, { wort: g.querySelector('.kagn')?.textContent ?? null,
          n: g.querySelector('.kagz')?.textContent ?? null, satz: g.querySelector('.kags')?.textContent ?? null, punkte: [...g.querySelectorAll('.kagp')].map((li) => li.textContent) }])),
        fass: p.querySelector('.kps[data-sec="autonomie"] .kfass')?.textContent ?? null,
        autoWhy: p.querySelector('.kps[data-sec="autonomie"] > .kpsk > .kwer')?.title ?? null,
        // the same rows, wrapping allowed, but only where a line may break: each character's box by a Range, and where the next line
        // starts, the character before it is a space or a hyphen (or it is itself a space)
        wordWhole: ['modell', 'effort', 'befehle', 'maschine', 'cc-systemprompt'].every((k) => { const v = p.querySelector('.kv[data-k="' + k + '"]'); const x = v?.querySelector(':scope > .kx'), t = v?.querySelector(':scope > .kwer');
          if (!x || !t || Math.abs(x.getBoundingClientRect().top - t.getBoundingClientRect().top) >= 6 || t.getBoundingClientRect().left <= x.getBoundingClientRect().left) return false;
          const chars = []; const walk = document.createTreeWalker(x, NodeFilter.SHOW_TEXT);
          for (let n = walk.nextNode(); n; n = walk.nextNode()) for (let i = 0; i < n.data.length; i++) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const b = r.getClientRects()[0]; chars.push({ c: n.data[i], top: b && b.width > 0 ? b.top : null }); }
          let last = null;
          return chars.every((ch, i) => { if (ch.top === null) return true; const neu = last !== null && ch.top > last + 4; last = ch.top; return !neu || /[\\s-]/.test(chars[i - 1].c) || /\\s/.test(ch.c); }); }),
        oneLine: ['modell', 'effort', 'befehle', 'maschine', 'cc-systemprompt'].every((k) => { const v = p.querySelector('.kv[data-k="' + k + '"]'); const x = v?.querySelector(':scope > .kx'), t = v?.querySelector(':scope > .kwer');
          return !!x && !!t && Math.abs(x.getBoundingClientRect().top - t.getBoundingClientRect().top) < 6 && t.getBoundingClientRect().left > x.getBoundingClientRect().left
            && x.getBoundingClientRect().height < 1.6 * (parseFloat(getComputedStyle(x).lineHeight) || 18); }),
        leer: Object.fromEntries([...p.querySelectorAll('.kps')].filter((x) => x.querySelector('.kleer')).map((x) => [x.dataset.sec, x.querySelector('.kleer').textContent])),
        gray: (() => { const x = p.querySelector('.kv[data-k="isolation"] .kx'), m = p.querySelector('.kv[data-k="isolation"] .kmehr'), v = p.querySelector('.kv[data-k="modell"] .kx');
          return !!x && !!m && !!v && getComputedStyle(x).color === getComputedStyle(m).color && getComputedStyle(x).color !== getComputedStyle(v).color; })(),
        switches: p.querySelectorAll('.kv[data-k="isolation"] :is(input, button:not(.kwer), [role="switch"]), .kv[data-k="maschine"] :is(input, button:not(.kwer), [role="switch"])').length,
        hover: Object.fromEntries([...p.querySelectorAll('.kv[title]')].map((v) => [v.dataset.k, v.title])) }])); })()`;
    const PEEK = `(() => { const p = ${WIN}?.querySelector('.kpeek'); if (!p) return null;
      return { slot: Number(p.closest('.kn')?.dataset.slot), vals: Object.fromEntries([...p.querySelectorAll('.kv')].map((v) => [v.dataset.k, v.querySelector('.kx')?.textContent.replace(/\\u00a0/g, ' ') ?? null])),
        hint: p.querySelector('.kpeekh')?.textContent ?? null }; })()`;
    const FITS = `(() => { const w = ${WIN}; if (!w) return false; const win = w.querySelector('.shellwin').getBoundingClientRect();
      const d = w.querySelector('.shelldetail'); const xs = [...w.querySelectorAll('.krow, .kprops, .kx, .krole, .kgo, .kwer, .kagp')];
      return document.documentElement.scrollWidth <= innerWidth && !!d && d.scrollWidth <= d.clientWidth + 1
        && xs.every((x) => { const r = x.getBoundingClientRect(); return r.left >= win.left - 0.5 && r.right <= win.right + 0.5
          && x.scrollWidth <= x.clientWidth + 1; }); })()`;
    type Line = { slot: number; kind: string; group: string | null; parent: number | null; name: string | null; role: string | null;
      act: boolean; valuesOnLine: boolean; nameCut: boolean; kindWhole: boolean; top: number; bottom: number; fill: string };
    type Props = Record<string, { sections: string[]; vals: Record<string, string | null>; wer: Record<string, string | null>;
      secWer: Record<string, string | null>; untagged: string[]; labels: Record<string, string | null>; words: string[]; standards: number; unsaid: string[]; more: Record<string, string>; links: string[];
      auto: Record<string, { wort: string | null; n: string | null; satz: string | null; punkte: string[] }>; leer: Record<string, string>;
      gray: boolean; switches: number; hover: Record<string, string>; fass: string | null; autoWhy: string | null; oneLine: boolean; wordWhole: boolean }>;
    type Peek = { slot: number; vals: Record<string, string | null>; hint: string | null } | null;
    const clear = (c: string) => c === "none" || c === "transparent" || /^rgba\([^)]*,\s*0\)$/.test(c);
    const center = (slot: number) => evaluate<{ x: number; y: number } | null>(`(() => { const r = ${WIN}?.querySelector('.kn[data-slot="${slot}"] > .kline > .krow')?.getBoundingClientRect(); return r ? { x: r.left + Math.min(60, r.width / 2), y: r.top + r.height / 2 } : null; })()`);
    const mouse = async (x: number, y: number) => { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); await settle(200); };
    const mouseClick = async (x: number, y: number) => {
      for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
      await settle(250);
    };
    const tap = async (x: number, y: number) => {
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await settle(350);
    };
    const seg = (d: string) => evaluate(`${WIN}?.querySelector('.kseg button[data-detail="${d}"]')?.click()`);
    const briefsRead = () => wait(`${WIN} && ${WIN}.querySelectorAll('.kprops').length > 0 && ![...${WIN}.querySelectorAll('.kprops .kx, .kprops .kleer')].some((x) => x.textContent.startsWith('wird gelesen'))`, 10000);
    const results: KonstDomResult[] = [];
    let targetId = "";
    for (const [width, height, phone] of ([[1200, 900, false], [390, 844, true]] as const).filter(([w]) => !only.widths || only.widths.includes(w))) {
      const claims: Record<string, boolean> = {};
      const facts: Record<string, unknown> = {};
      if (targetId) { const old = targetId; sessionId = undefined; await send("Target.closeTarget", { targetId: old }).catch(() => undefined); }
      targetId = String((await send("Target.createTarget", { url: "about:blank" })).targetId);
      sessionId = String((await send("Target.attachToTarget", { targetId, flatten: true })).sessionId);
      await send("Fetch.enable", { patterns: [{ urlPattern: "http://fleet.fixture/*" }] });
      await send("Page.enable"); await send("Runtime.enable");
      await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };` });
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: phone });
      if (phone) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
      await navigate("http://fleet.fixture/blank");
      await evaluate(`(() => { localStorage.clear(); localStorage.setItem('fleet.view', JSON.stringify({ layout: 1, panes: [6], focused: 0 })); localStorage.setItem('fleet.board', '0'); })()`);
      await navigate("http://fleet.fixture/");
      if (!await wait("document.querySelector('#konstbtn') && document.querySelector('#comptarget')?.dataset.slot === '6'", 15000))
        throw new Error(`konstellation DOM probe ${width}: the board never showed slot 6: ` + await evaluate<string>("document.body.innerText.slice(0, 300)"));
      await evaluate("document.querySelector('#konstbtn').click()");
      // ready = the whole tree of the fixture: eight lines, the lane under its MAIN under the Orchestratorin, the MAIN by its name
      facts.ready = await wait(`${WIN} && ${WIN}.querySelectorAll('.kn').length === 8 && !!${WIN}.querySelector('.kn[data-slot="1"] .kn[data-slot="2"] .kn[data-slot="3"]') && ${WIN}.querySelector('.kn[data-slot="2"] .kname')?.textContent.includes('Alpha')`, 10000);
      await settle(200);

      // STEP ONE, the build
      const lines = (await evaluate<Line[] | null>(READ)) ?? [];
      facts.lines = lines;
      facts.subtitle = await evaluate<string | null>(`${WIN}?.querySelector('.shellsub')?.textContent ?? null`);
      const by = (slot: number) => lines.find((c) => c.slot === slot);
      claims[KONST_CLAIM.once] = JSON.stringify(lines.map((c) => c.slot).sort((a, b) => a - b)) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]) && facts.subtitle === "8 Sessions laufen";
      claims[KONST_CLAIM.tree] = by(1)?.group === "orchester" && by(1)?.parent === null
        && by(2)?.parent === 1 && by(3)?.parent === 2 && by(3)?.kind === "lane"
        && by(4)?.group === "lanes" && by(4)?.parent === null
        && by(5)?.group === "branches" && by(5)?.kind === "bau" && by(5)?.name === "Einstellungen (K16)" && by(5)?.role === "Bau-Session"
        && by(6)?.group === "sessions" && by(6)?.role === "Session" && by(7)?.group === "sessions" && by(7)?.kind === "session"
        && by(8)?.parent === 6 && by(8)?.kind === "lane" && by(2)?.role === "Program-MAIN" && by(3)?.role === "Lane" && by(1)?.role === null;
      const glance = await evaluate<{ tree: number; room: number; values: number; pressed: string | null } | null>(`(() => { const w = ${WIN}; if (!w) return null;
        const d = w.querySelector('.shelldetail'); const box = w.querySelector('.kbaum').getBoundingClientRect();
        return { tree: Math.round(box.height), room: d.clientHeight, values: w.querySelectorAll('.kv, .kprops, .kpeek, .kwerte').length,
          pressed: w.querySelector('.kseg button[aria-pressed="true"]')?.textContent ?? null }; })()`);
      facts.glance = glance;
      const KINDS = ["Orchestratorin", "Program-MAIN", "Lane", "Bau-Session", "Session"];
      claims[KONST_CLAIM.aufbau] = lines.length === 8 && lines.every((c) => c.act && !c.valuesOnLine && (c.role === null || KINDS.includes(c.role)))
        && !!glance && glance.values === 0 && glance.pressed === "Aufbau" && glance.tree <= glance.room;
      await shot(`konstellation-${width}-aufbau`);

      if (!phone) {
        // the calm line and the small card, under a mouse
        const at6 = await center(6), at1 = await center(1);
        if (at6) await mouse(at6.x, at6.y);
        const hovered = (await evaluate<Line[] | null>(READ)) ?? [];
        await mouse(1, 1);
        const h6 = hovered.find((c) => c.slot === 6);
        facts.calm = { rest: lines.map((c) => [c.slot, c.fill]), hovered: h6?.fill };
        claims[KONST_CLAIM.calm] = lines.every((c) => clear(c.fill)) && !!h6 && !clear(h6.fill) && hovered.filter((c) => c.slot !== 6).every((c) => clear(c.fill));
        if (at1) await mouse(at1.x, at1.y);
        await settle(150);
        const peek = await evaluate<Peek>(PEEK);
        const under = (await evaluate<Line[] | null>(READ)) ?? [];
        await shot(`konstellation-${width}-karte`);
        await mouse(1, 1);
        const gone = await evaluate<Peek>(PEEK);
        facts.peek = { peek, gone };
        claims[KONST_CLAIM.peek] = peek?.slot === 1
          && JSON.stringify(peek.vals) === JSON.stringify({ modell: "Opus 5.5 · 1M", effort: "high", kontext: "32 %", uebergabe: "ab 45 %" })
          && peek.hint === "Klick: alle Eigenschaften" && gone === null
          && JSON.stringify(under.map((c) => [c.slot, c.top])) === JSON.stringify(lines.map((c) => [c.slot, c.top]));
      }

      // STEP TWO, one session after the other: every line clicked open (a click without a pointer type, as a keyboard's)
      for (const slot of [1, 2, 3, 4, 5, 6, 7, 8]) await evaluate(`${WIN}?.querySelector('.kn[data-slot="${slot}"] > .kline > .krow')?.click()`);
      facts.allRead = await briefsRead();
      await settle(150);
      const props = (await evaluate<Props | null>(PROPS)) ?? {};
      facts.props = props;
      const p = (slot: number) => props[String(slot)]?.vals ?? {};
      const LANE_SELBST = ["wie du das Fertig-Kriterium der Karte erreichst, innerhalb ihrer Fläche und Verbote"];
      claims[KONST_CLAIM.values] =
        p(1).modell === "Opus 5.5 · 1M" && p(1).effort === "high" && p(1).uebergabe === "ab 45 %" && p(1).befehle === "Fleet-Standard"
        && props["1"]?.labels.uebergabe === "Succession"
        && p(1).modus === "Auto Mode, ein Prüfmodell sieht Shell- und Netzaktionen" && p(3).modus === "ohne Prüfung (bypass)"
        && p(1).art === "Orchestratorin" && p(1).haengt === "keiner, sie führt" && p(1).agent === "Claude Code" && !("program" in p(1)) && !("auftrag" in p(1))
        && p(2).modell?.startsWith("Sonnet 5.5") === true && p(2).effort === "medium" && p(2).uebergabe === "aus · 3. Session der Linie"
        && p(2).program === "„Alpha“, sie führt es" && p(2).haengt === "Orchestratorin · Slot 1" && p(2)["cc-werkzeuge"] === "15 Werkzeuge" && props["2"]?.wer["cc-werkzeuge"] === "fleet"
        && p(3).modell?.startsWith("Sonnet 5.5") === true && p(3).effort === "xhigh" && p(3).uebergabe === "ab 50 %, solange der Cache warm ist bis 55 %"
        && p(3).program === "„Alpha“" && p(3).auftrag === "„Bau A“" && p(3).branch === LONG_BRANCH && p(3).haengt === "MAIN Alpha · Slot 2"
        && p(3).ordner === "a · eigener Worktree" && props["3"]?.hover.ordner === "/fixture/r.worktrees/a\nRepo /fixture/r"
        && p(3)["cc-systemprompt"] === "eingebaut" && p(3)["cc-werkzeuge"] === "14 Werkzeuge" && p(3)["cc-mcp"] === "kein Server"
        && props["3"]?.hover["cc-mcp"] === "Satz mcp." && p(5)["cc-werkzeuge"] === "alle eingebauten"
        && p(4).modell?.startsWith("codex · ") === true && p(4).agent === "codex" && p(4).effort === "Standard" && p(4).befehle === "workspace-write, never"
        && !("modus" in p(4)) && !props["4"]?.sections.includes("Claude Code")
        && p(5).haengt === "nicht gemeldet" && p(5).branch === "bau/einstellungen"
        && p(6).modell === "Standard des Agenten" && p(6).uebergabe === "ab 45 %" && p(6).ordner === "frei · Haupt-Checkout"
        && p(8).haengt === "Frei · Slot 6" && p(8).uebergabe === "ab 37 %, der Cache ist kalt: Fleet tippt nichts"
        && planReads.includes("lane@/fixture/r") && planReads.includes("lane@/fixture/r#codex") && planReads.includes("nur-ordner@/fixture/r.worktrees/bau-einstellungen")
        && planReads.includes("main@/fixture/main") && planReads.includes("orchestratorin@/fixture/orch");
      claims[KONST_CLAIM.unknown] = p(4).uebergabe === "nicht lesbar"
        && props["6"]?.leer["claude-code"] === "nicht lesbar" && props["8"]?.leer.autonomie === "nicht lesbar"
        && [2, 5, 6, 7, 8].every((n) => p(n).modus === "nicht gemeldet");
      const pr = (slot: number) => props[String(slot)];
      claims[KONST_CLAIM.wer] = Object.keys(props).length === 8 && Object.values(props).every((x) => x.untagged.length === 0)
        && [1, 3, 5].every((n) => pr(n)?.wer.modell === "du" && pr(n)?.wer.effort === "du" && pr(n)?.wer.uebergabe === "du"
          && pr(n)?.wer.befehle === "fleet" && pr(n)?.wer.modus === "fleet" && pr(n)?.wer.maschine === "fleet" && pr(n)?.wer.isolation === "fleet"
          && pr(n)?.wer.agent === "fleet" && pr(n)?.wer["cc-systemprompt"] === "claude-code" && pr(n)?.wer["cc-globale-regeln"] === "claude-code"
          && pr(n)?.secWer.aufbau === "fleet" && pr(n)?.wer.art === null)
        && pr(3)?.wer["cc-werkzeuge"] === "fleet" && pr(3)?.wer["cc-mcp"] === "fleet" && pr(5)?.wer["cc-mcp"] === "claude-code"
        && pr(3)?.secWer.autonomie === "fleet" && pr(6)?.secWer.autonomie === "fleet"
        && JSON.stringify([...new Set(Object.values(props).flatMap((x) => x.words))].sort())
          === JSON.stringify(["claude-code=Claude-Code-Standard", "du=änderbar", "fleet=Fleet-Standard"]);
      claims[KONST_CLAIM.autonomie] = JSON.stringify(pr(3)?.auto) === JSON.stringify({
          selbst: { wort: "Entscheidet selbst", n: "1", satz: "ohne Rückfrage", punkte: LANE_SELBST },
          fragt: { wort: "Fragt zuerst", n: "4", satz: "fragt ihre MAIN", punkte: ["alles außerhalb der Karte", "andere Repos", "~/.claude", "geteilte Ports"] },
          nie: { wort: "Nie", n: "3", satz: "gilt für jede Rolle gleich", punkte: ["nichts landet ohne grüne Land-Prüfung", "keine Session schließt eine fremde", "Zugangsdaten nie in einer Ausgabe"] } })
        && pr(4)?.auto.selbst?.n === "1" && pr(4)?.auto.fragt?.n === "3" && pr(1)?.auto.selbst?.n === "3" && pr(1)?.auto.fragt?.satz === "fragt den Owner" && pr(2)?.auto.fragt?.n === "3"
        && pr(6)?.leer.autonomie === "Keine Rollenkarte · sie arbeitet nach der AGENTS.md ihres Ordners" && !pr(6)?.auto.selbst
        && pr(5)?.leer.autonomie === pr(6)?.leer.autonomie;
      claims[KONST_CLAIM.start] = pr(3)?.fass === "heute gibt Fleet eine andere"
        && pr(3)?.autoWhy?.startsWith("Noch nicht einstellbar: Diese Rollenkarte hat Fleet ihr beim Start in die Session-Datei geschrieben") === true
        && pr(3)?.autoWhy?.endsWith("/fixture/r.worktrees/a/AGENTS.override.md · Abschnitt „Rolle“") === true
        && [1, 2, 4].every((n) => pr(n)?.fass === "Fassung von heute" && pr(n)?.autoWhy?.startsWith("Noch nicht einstellbar: Fleet gibt jeder ") === true)
        && pr(5)?.fass === null && pr(8)?.fass === null;
      // one line where the line stands at the top (Orchestratorin, branch session); the lane two levels in has 34 px less, and a wider
      // fallback font (DejaVu Sans on the Linux helper) wraps „Fleet-Standard“ there after its hyphen: allowed, a break inside a word not
      claims[KONST_CLAIM.phone] = [1, 5].every((n) => pr(n)?.oneLine === true) && pr(3)?.wordWhole === true;
      claims[KONST_CLAIM.maschine] = [1, 3, 4, 6].every((n) => p(n).maschine === "mac" && p(n).isolation === "keine"
          && pr(n)?.more.maschine === "andere Maschinen möglich, nicht verbundenworkhorse" && pr(n)?.more.isolation === "Sandbox/VM möglich, nicht aktiv"
          && JSON.stringify(pr(n)?.links) === JSON.stringify(["workhorse http://workhorse.fixture:8790"]) && pr(n)?.gray === true && pr(n)?.switches === 0);
      const fitLines = (await evaluate<Line[] | null>(READ)) ?? [];
      facts.fit = fitLines.map((c) => [c.slot, c.nameCut, c.kindWhole]);
      claims[KONST_CLAIM.fit] = Object.keys(props).length === 8 && await evaluate<boolean>(FITS) && fitLines.length === 8
        && fitLines.every((c) => c.kindWhole) && (!phone || fitLines.find((c) => c.slot === 4)?.nameCut === true);
      await shot(`konstellation-${width}-blaetter`);
      for (const slot of [1, 2, 3, 4, 5, 6, 7, 8]) await evaluate(`${WIN}?.querySelector('.kn[data-slot="${slot}"] > .kline > .krow')?.click()`);
      await evaluate(`${WIN}?.querySelector('.shelldetail')?.scrollTo(0, 0)`);
      await settle(150);

      // „Alles“: the card's values as a second line, no sheet; kept across a reopening; „Aufbau“ takes them away
      await seg("alles");
      await wait(`${WIN} && ${WIN}.querySelectorAll('.kwerte').length === 8 && ![...${WIN}.querySelectorAll('.kwerte .kx')].some((x) => x.textContent.startsWith('wird gelesen'))`, 5000);
      await settle(150);
      const werte = await evaluate<{ lines: number; sheets: number; one: Record<string, string | null>; ctx: Record<string, string | null>; tree: number; room: number }>(`(() => { const w = ${WIN};
        const one = Object.fromEntries([...w.querySelectorAll('.kn[data-slot="1"] > .kline > .kwerte .kv')].map((v) => [v.dataset.k, v.querySelector('.kx')?.textContent.replace(/\\u00a0/g, ' ') ?? null]));
        const ctx = Object.fromEntries([...w.querySelectorAll('.kn')].map((n) => [n.dataset.slot, n.querySelector(':scope > .kline > .kwerte .kv[data-k="kontext"] .kx')?.textContent.replace(/\\u00a0/g, ' ') ?? null]));
        return { lines: w.querySelectorAll('.kwerte').length, sheets: w.querySelectorAll('.kprops').length, one, ctx,
          tree: Math.round(w.querySelector('.kbaum').getBoundingClientRect().height), room: w.querySelector('.shelldetail').clientHeight }; })()`);
      await shot(`konstellation-${width}-alles`);
      await evaluate(`${WIN}?.querySelector('.shellclose')?.click()`);
      await settle(200);
      const closed = !await evaluate<boolean>(`!!${WIN}`);
      await evaluate("document.querySelector('#konstbtn').click()");
      await wait(`${WIN} && ${WIN}.querySelectorAll('.kn').length === 8`, 5000);
      await settle(150);
      const reopened = await evaluate<number>(`${WIN}?.querySelectorAll('.kwerte').length ?? -1`);
      await seg("aufbau"); await settle(150);
      const after = await evaluate<{ lines: number; pressed: string | null }>(`({ lines: ${WIN}?.querySelectorAll('.kwerte').length ?? -1, pressed: ${WIN}?.querySelector('.kseg button[aria-pressed="true"]')?.textContent ?? null })`);
      facts.alles = { werte, closed, reopened, after };
      claims[KONST_CLAIM.alles] = werte.lines === 8 && werte.sheets === 0
        && JSON.stringify(werte.one) === JSON.stringify({ modell: "Opus 5.5 · 1M", effort: "high", kontext: "32 %", uebergabe: "ab 45 %" })
        && closed && reopened === 8 && after.lines === 0 && after.pressed === "Aufbau";
      // the context's unknowns stand on the card's values (the properties leave the context to the card)
      claims[KONST_CLAIM.unknown] = claims[KONST_CLAIM.unknown]! && werte.ctx["2"] === "nicht messbar" && werte.ctx["7"] === "< 1 %"
        && Object.values(werte.ctx).every((c) => c !== null && !/^0 %|^0$/.test(c));

      // a single line: a click (desktop) or two taps (phone), the line stays, then „Session zeigen“
      const at3 = await center(3), at6 = await center(6);
      if (phone && at6) {
        await tap(at6.x, at6.y);
        const first = { peek: await evaluate<Peek>(PEEK), open: await evaluate<number>(`${WIN}?.querySelectorAll('.kprops').length ?? -1`) };
        await shot(`konstellation-${width}-tipp`);
        await tap(at6.x, at6.y);
        const second = { peek: await evaluate<Peek>(PEEK), open: Object.keys((await evaluate<Props | null>(PROPS)) ?? {}) };
        facts.touch = { first, second };
        claims[KONST_CLAIM.touch] = first.peek?.slot === 6 && first.peek.hint === "Noch einmal tippen: alle Eigenschaften" && first.open === 0
          && second.peek === null && JSON.stringify(second.open) === JSON.stringify(["6"]);
        await tap(at6.x, at6.y);
      }
      const before3 = (await center(3))?.y ?? null;
      if (at3) { if (phone) { await tap(at3.x, at3.y); await tap(at3.x, at3.y); } else await mouseClick(at3.x, at3.y); }
      await briefsRead();
      const after3 = (await center(3))?.y ?? null;
      const one = (await evaluate<Props | null>(PROPS)) ?? {};
      await shot(`konstellation-${width}-klick`);
      // the reason of a fixed tag, without a pointer on the phone: one tap writes it under the row, a second takes it away
      const tagAt = () => evaluate<{ x: number; y: number } | null>(`(() => { const t = ${WIN}?.querySelector('.kprops[data-slot="3"] .kv[data-k="isolation"] > .kwer');
        if (!t) return null; t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      const reason = () => evaluate<{ text: string | null; expanded: string | null; title: string | null }>(`(() => { const v = ${WIN}?.querySelector('.kprops[data-slot="3"] .kv[data-k="isolation"]');
        const t = v?.querySelector(':scope > .kwer'); return { text: v?.querySelector(':scope > .kgrund')?.textContent ?? null, expanded: t?.getAttribute('aria-expanded') ?? null, title: t?.title ?? null }; })()`);
      const press = async () => { await settle(100); const at = await tagAt(); await settle(100); if (at) { if (phone) await tap(at.x, at.y); else await mouseClick(at.x, at.y); } };
      await press();
      const shown = await reason();
      await shot(`konstellation-${width}-grund`);
      await press();
      const hidden = await reason();
      facts.grund = { shown, hidden };
      const ISO = "Noch nicht einstellbar: Container und VM schneiden den Rückweg zu Fleet ab; Claude Codes Sandbox ginge, ist aber nicht eingeschaltet.";
      claims[KONST_CLAIM.grund] = shown.text === ISO && shown.expanded === "true" && shown.title === `${ISO}\ndocs/neuaufbau/befunde/19-isolation.md`
        && hidden.text === null && hidden.expanded === "false"
        && Object.values(props).reduce((n, x) => n + x.standards, 0) > 0 && Object.values(props).every((x) => x.unsaid.length === 0);
      await evaluate(`${WIN}?.querySelector('.kprops[data-slot="3"] .kgo')?.click()`);
      await settle(300);
      facts.click = { open: Object.keys(one), sections: one["3"]?.sections, before3, after3, closed: !await evaluate<boolean>(`!!${WIN}`),
        target: await evaluate<string | null>("document.querySelector('#comptarget')?.dataset.slot ?? null") };
      claims[KONST_CLAIM.click] = JSON.stringify(Object.keys(one)) === JSON.stringify(["3"])
        && JSON.stringify(one["3"]?.sections) === JSON.stringify(["Autonomie", "Rechte", "Einstellungen", "Claude Code", "Aufbau"])
        && before3 !== null && before3 === after3
        && !await evaluate<boolean>(`!!${WIN}`) && await evaluate<boolean>("document.querySelector('#comptarget')?.dataset.slot === '3'");
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
