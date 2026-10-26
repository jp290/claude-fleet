// THE START BRIEF (the right side of src/start-fenster.ts), without DOM: what Claude reads when it starts, file by file and in the order it
// reads it, built from the Fassung the preview door returns (GET /api/founding-plan … anlass=neu, server/fassung.ts). Two Fassungen go in,
// the one of this choice and the one of normal (no choice), so every part says what differs from `claude` by hand, as lines: − left out,
// + added (owner 24.10.: „[Zitat entfernt]“).
// The order is the one a session's own context shows (24.10.), in the moments of the pack „Building an agent“ (owner 25.10. 19:50, Soll
// 22:50): with every request — Claude Code's own instructions, then what Fleet appends with --append-system-prompt, each text on its own —;
// once, at the start — the CLAUDE.md and AGENTS.md files, the memory index, the git status, the first message —; when it fits — a rule
// file with `paths:`, the lists by name, each context pack that waits as a skill —. Settings without text come last. A part carries the
// name the left side gives it (a pack its title, never its path); the path stays in `datei`.
export interface Datei { pfad: string; bytes: number; eigentum?: string }
export interface Abschnitt { id: string; quelle?: string | null; bytes?: number | string; text?: string | null; grund?: string | null; dateien?: Datei[] | null }
export interface Fassung { teile: { id: string; abschnitte: Abschnitt[] }[] }

export type Herkunft = "cc" | "fleet" | "du";
export interface Zeile { z: "+" | "−" | " "; t: string }
export interface Block {
  key: string; herkunft: Herkunft; pfad: string; wer: string; satz: string;
  // the file behind a part named otherwise (a pack's path under its title)
  datei?: string;
  // what it adds to what Claude reads; null = no text of its own
  bytes: number | null;
  // its words now; null = it is not read now (left out)
  text: string | null;
  // against normal, only where it differs; zeichen: + only now, − only normally, ~ both but different
  diff: Zeile[] | null; zeichen: "+" | "−" | "~" | null;
  // the blocks on the left that change it (src/start-fenster.ts marks it when one of them is open or changed)
  bausteine: string[];
  kinder?: Block[];
}
export interface Startbrief { anweisungen: Block[]; ersteNachricht: Block[]; wartend: Block[]; einstellungen: Block[] }
// what the window adds that the Fassung doesn't carry: the git status as Claude Code reads it, the first message, the line's own flags,
// and a pack's title and moment as the library names them (the Fassung names a pack that waits as a skill by its id only)
export interface Dazu { repo: string; gitNormal: string | null; gitJetzt: string | null; aufgabe: string | null; hooksAus: boolean; ccTokens: number | null;
  pack?: (id: string) => { titel: string; wann: string | null } | null }

const abschnitte = (f: Fassung | null, teil: string, id: string): Abschnitt[] =>
  f?.teile.find((t) => t.id === teil)?.abschnitte.filter((a) => a.id === id) ?? [];
const text1 = (f: Fassung | null, teil: string, id: string): string | null =>
  abschnitte(f, teil, id).map((a) => a.text).find((t): t is string => typeof t === "string" && t.length > 0) ?? null;
export const zeilen = (t: string): string[] => { const L = t.split("\n"); while (L.length && L[L.length - 1] === "") L.pop(); return L; };
// A FILE AS IT READS (owner 25.10.: the text view tore its lines): files wrap their paragraphs by hand at about 120 characters and the
// narrow column wraps them again. Each paragraph and each list item becomes one line again, so Markdown lets it flow; code blocks,
// headings, tables, quotes and rules stay line by line
const NEUER_BLOCK = /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||(?:-{3,}|\*{3,}|_{3,})\s*$)/;
export function fliessend(text: string): string {
  const aus: string[] = [];
  let zaun = false, fliesst = false;
  for (const roh of text.replace(/\r\n?/g, "\n").split("\n")) {
    const t = roh.trimEnd();
    if (/^\s*(?:```|~~~)/.test(t)) { zaun = !zaun; fliesst = false; aus.push(t); continue; }
    if (zaun) { aus.push(roh); continue; }
    if (!t.trim()) { fliesst = false; aus.push(""); continue; }
    const neu = NEUER_BLOCK.test(t);
    if (fliesst && !neu) aus[aus.length - 1] += ` ${t.trim()}`;
    else aus.push(t);
    // a heading, a table row, a quote or a rule takes no next line into itself; a paragraph and a list item do
    fliesst = !neu || /^\s*(?:[-*+]\s|\d+[.)]\s)/.test(t);
  }
  return aus.join("\n");
}
export const kurz = (pfad: string): string => pfad.replace(/^\/(?:Users|home)\/[^/]+(?=\/|$)/, "~");
// macOS keeps /tmp and /var under /private: the server names a file by its real path, a repo may be pinned by the short one
export const echt = (pfad: string): string => pfad.replace(/^\/private(?=\/(?:tmp|var|etc)(?:\/|$))/, "");
export const imRepo = (pfad: string, repo: string): boolean => { const r = echt(repo.replace(/\/$/, "")); return !!r && echt(pfad).startsWith(`${r}/`); };
// the note Fleet types into the pane at a mark of its context, read from the Fassung's text for arbeitet/schwelle
// (server/fassung-umfeld.ts#schwelleAbschnitt: „Übergabe ab 40 % · … · Hinweis an“); null = none
export const uebergabeHinweis = (t: string | null | undefined): number | null => {
  const m = t && /Hinweis an/.test(t) ? /(\d+)\s*%/.exec(t) : null;
  return m ? Number(m[1]) : null;
};
// a file as the window names it: the repo's by its path in the repo (its owner word says „[Zitat entfernt]“), yours under ~/.claude, a project's
// memory folder without its long id
export function anzeige(pfad: string, repo: string, eigentum?: string): string {
  const r = echt(repo.replace(/\/$/, "")), name = r.split("/").pop() ?? r;
  if (imRepo(pfad, repo)) return echt(pfad).slice(r.length + 1);
  const cc = pfad.lastIndexOf("/.claude/");
  const p = eigentum === "owner" && cc >= 0 ? `~${pfad.slice(cc)}` : kurz(pfad);
  return p.replace(/\/projects\/[^/]+\//, "/projects/…/");
}
const bytesVon = (t: string | null): number | null => t === null ? null : new TextEncoder().encode(t).length;

// LINES THAT DIFFER: the longest common sequence of lines, then − for what only the old has and + for what only the new has
export function zeilenDiff(alt: string, neu: string): Zeile[] {
  const a = zeilen(alt), b = zeilen(neu), n = a.length, m = b.length;
  if (n * m > 400_000) return [...a.map((t): Zeile => ({ z: "−", t })), ...b.map((t): Zeile => ({ z: "+", t }))];
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Zeile[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ z: " ", t: a[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ z: "−", t: a[i++] });
    else out.push({ z: "+", t: b[j++] });
  }
  while (i < n) out.push({ z: "−", t: a[i++] });
  while (j < m) out.push({ z: "+", t: b[j++] });
  return out;
}
// one part against normal
function vergleiche(b: Omit<Block, "diff" | "zeichen" | "bytes" | "text">, neu: string | null, alt: string | null): Block {
  const fertig = (diff: Zeile[] | null, zeichen: Block["zeichen"]): Block => ({ ...b, text: neu, bytes: bytesVon(neu), diff, zeichen });
  if (neu === alt) return fertig(null, null);
  if (alt === null) return fertig(zeilen(neu ?? "").map((t): Zeile => ({ z: "+", t })), "+");
  if (neu === null) return fertig(zeilen(alt).map((t): Zeile => ({ z: "−", t })), "−");
  return fertig(zeilenDiff(alt, neu), "~");
}

// THE RULE FILES of liest.projektregeln: one text with markers „--- i/n NAME ---“, the paths in `dateien`
export function regelDateien(a: Abschnitt | undefined): { pfad: string; text: string; eigentum?: string }[] {
  if (!a?.text) return [];
  const t = a.text.split(/^--- (\d+)\/\d+ .+ ---$/m);
  if (t.length < 3) { const d = a.dateien?.[0]; return [{ pfad: d?.pfad ?? "rules", text: a.text, ...(d?.eigentum ? { eigentum: d.eigentum } : {}) }]; }
  const out: { pfad: string; text: string; eigentum?: string }[] = [];
  for (let k = 1; k + 1 < t.length; k += 2) {
    const d = a.dateien?.[Number(t[k]) - 1];
    out.push({ pfad: d?.pfad ?? `file ${t[k]}`, text: t[k + 1].replace(/^\n/, "").replace(/\n+$/, ""), ...(d?.eigentum ? { eigentum: d.eigentum } : {}) });
  }
  return out;
}
// FLEET'S GUIDES of liest.wissen: markers „--- id (path · # Title) ---“, one or more sections
export function packDateien(f: Fassung | null): { id: string; pfad: string; titel: string; text: string }[] {
  const out: { id: string; pfad: string; titel: string; text: string }[] = [];
  for (const a of abschnitte(f, "liest", "wissen")) {
    if (!a.text) continue;
    const t = a.text.split(/^--- (\S+) \((.+?) · #\s*(.*)\) ---$/m);
    for (let k = 1; k + 3 < t.length; k += 4) out.push({ id: t[k], pfad: t[k + 1], titel: t[k + 2], text: t[k + 3].replace(/^\n/, "").replace(/\n+$/, "") });
  }
  return out;
}

// ...and the ones that wait as skills: one line each, „- id: when it fits“ (server/sitz-wissen.ts#seatFassungAbschnitte)
export function packSkills(f: Fassung | null): { id: string; zeile: string }[] {
  return abschnitte(f, "liest", "wissen").flatMap((a) => { const m = /^- ([a-z0-9][a-z0-9-]*): /.exec(a.text ?? ""); return m && !a.text!.includes("\n") ? [{ id: m[1], zeile: a.text! }] : []; });
}

const PACK_SATZ: Readonly<Record<string, string>> = {
  "who-it-is-for": "who meets the work, and how work misses them", "working-with-the-owner": "how to talk with you, and what to decide alone",
  "working-in-few-calls": "how to search and read in few steps", "setting-up-agents": "what to decide when it sets up an agent",
  "how-fleet-remembers": "where a lesson goes, so the next session has it", "made-with-love": "the critical look at visible work",
  "building-an-agent": "how it shapes a better agent with you, one stone at a time",
};
// a rule file with `paths:` in its head loads only when Claude reads a matching file (code.claude.com/docs/en/memory)
export const nurBeiPfaden = (text: string): boolean => /^---\n[\s\S]*?^paths:/m.test(text);
// whose rule file: the owner's own (eigentum), the repo's (under the repo), or one that lies above the folder
function regelWer(pfad: string, eigentum: string | undefined, repo: string): { wer: string; satz: string } {
  if (eigentum === "owner") return { wer: "Yours", satz: "your rules, in every project" };
  if (imRepo(pfad, repo)) return { wer: "This repo", satz: "its rules, for every session here" };
  return { wer: "Yours", satz: "read because it lies in a folder above this one" };
}
// union of two keyed lists, normal's order first, then what only this choice has
function vereint<T>(normal: T[], jetzt: T[], key: (x: T) => string): string[] {
  return [...new Set([...normal.map(key), ...jetzt.map(key)])];
}

export function startbrief(jetzt: Fassung, normal: Fassung, x: Dazu): Startbrief {
  const anweisungen: Block[] = [], ersteNachricht: Block[] = [], wartend: Block[] = [], einstellungen: Block[] = [];
  // ① Claude Code itself: its text is not Fleet's to show; its size is a measurement
  anweisungen.push({ key: "cc", herkunft: "cc", pfad: "Claude Code's system prompt", wer: "Claude Code", satz: "how it works, and what its tools do",
    bytes: null, text: `Claude Code's own instructions, the description of each tool it may use, and its environment.\nFleet doesn't write this text and can't show it word for word${x.ccTokens ? `; it was measured at about ${Math.round(x.ccTokens / 1000)}k tokens` : ""}.`,
    diff: null, zeichen: null, bausteine: ["skills"] });
  // ② from Fleet: what --append-system-prompt carries, each text a part of its own (no group head: the left names each one too)
  const fleetText = (key: string, pfad: string, satz: string, neu: string | null, alt: string | null, bs: string[], datei?: string) => {
    if (neu === null && alt === null) return;
    anweisungen.push(vergleiche({ key, herkunft: "fleet", pfad, wer: "Fleet", satz, bausteine: bs, ...(datei ? { datei } : {}) }, neu, alt));
  };
  fleetText("zusatz", "appended text", "what Fleet adds to its instructions in this place", text1(jetzt, "liest", "systemzusatz"), text1(normal, "liest", "systemzusatz"), ["skills", "permissions"]);
  fleetText("rolle", "its role card", "what its role tells it", text1(jetzt, "liest", "rolle"), text1(normal, "liest", "rolle"), ["role"]);
  fleetText("eigenes", "its agent file", "what it is for, in your words", text1(jetzt, "liest", "eigenes"), text1(normal, "liest", "eigenes"), ["purpose"]);
  // the purpose a predecessor wrote for it (POST /api/self/einrichten): its own text, beside the owner's
  fleetText("zweck", "its purpose", "what it is for, written by the session before it", text1(jetzt, "liest", "zweck"), text1(normal, "liest", "zweck"), ["purpose"]);
  // the rights sentence: appended only when rights are set; without, the Fassung says what holds instead
  const rj = text1(jetzt, "darf", "darf"), rn = text1(normal, "darf", "darf");
  if (rj !== rn) fleetText("rechte", "Rights", "what it may change", rj, null, ["rights"]);
  const pj = packDateien(jetzt), pn = packDateien(normal);
  for (const id of vereint(pn, pj, (p) => p.id)) {
    const a = pj.find((p) => p.id === id), b = pn.find((p) => p.id === id), p = (a ?? b)!;
    fleetText(`pack:${id}`, x.pack?.(id)?.titel ?? (p.titel || id), PACK_SATZ[id] ?? x.pack?.(id)?.wann ?? "", a?.text ?? null, b?.text ?? null, [`pack:${id}`], p.pfad);
  }
  // ③ the rule files: at the start, or when a matching file is read
  const rj2 = regelDateien(abschnitte(jetzt, "liest", "projektregeln")[0]), rn2 = regelDateien(abschnitte(normal, "liest", "projektregeln")[0]);
  for (const pfad of vereint(rn2, rj2, (r) => r.pfad)) {
    const a = rj2.find((r) => r.pfad === pfad), b = rn2.find((r) => r.pfad === pfad), spaeter = nurBeiPfaden((a ?? b)!.text);
    const { wer, satz } = regelWer(pfad, (a ?? b)?.eigentum, x.repo);
    (spaeter ? wartend : ersteNachricht).push(vergleiche({ key: `regel:${pfad}`, herkunft: "du", pfad: anzeige(pfad, x.repo, (a ?? b)?.eigentum), wer,
      satz: spaeter ? "when it reads a matching file" : satz, bausteine: ["rules"] }, a?.text ?? null, b?.text ?? null));
  }
  // ④ what it remembers: the folder's memory, or a notebook of its own
  const mem = (f: Fassung | null) => { const a = abschnitte(f, "liest", "gedaechtnis")[0]; return a?.text ? { pfad: a.dateien?.[0]?.pfad ?? a.quelle ?? "memory", text: a.text, eigen: /notizbuecher/.test(a.quelle ?? "") } : null; };
  const mj = mem(jetzt), mn = mem(normal);
  for (const pfad of vereint(mn ? [mn] : [], mj ? [mj] : [], (m) => m.pfad)) {
    const a = mj?.pfad === pfad ? mj : null, b = mn?.pfad === pfad ? mn : null, eigen = (a ?? b)!.eigen;
    ersteNachricht.push(vergleiche({ key: `mem:${pfad}`, herkunft: eigen ? "fleet" : "du", pfad: eigen ? "Own notebook" : "Memory", datei: anzeige(pfad, x.repo), wer: eigen ? "Fleet" : "Yours",
      satz: eigen ? "its own notes, for the session after it" : "what earlier sessions here noted", bausteine: ["memory", "notebook"] }, a?.text ?? null, b?.text ?? null));
  }
  // ⑤ the git status: Claude Code looks at the folder's git when it starts and reads this along
  if (x.gitJetzt !== null || x.gitNormal !== null)
    ersteNachricht.push(vergleiche({ key: "git", herkunft: "cc", pfad: "git status", wer: "Claude Code", satz: "read from the folder when it starts", bausteine: ["workplace", "branch"] }, x.gitJetzt, x.gitNormal));
  // ⑥ the first message
  ersteNachricht.push(x.aufgabe !== null
    ? vergleiche({ key: "task", herkunft: "fleet", pfad: "first message", wer: "Fleet", satz: "your task, typed in once Claude Code is ready", bausteine: ["task"] }, x.aufgabe || "(still empty: write it in First task)", null)
    : { key: "task", herkunft: "du", pfad: "first message", wer: "Yours", satz: "none: it waits for you to type", bytes: null, text: null, diff: null, zeichen: null, bausteine: ["task"] });
  // ⑦ the lists, names only: Claude sees each name and loads one when it fits
  const liste = (f: Fassung | null) => [text1(f, "arbeitet", "claude-eigenes"), text1(f, "arbeitet", "plugins")].filter(Boolean).join("\n") || null;
  wartend.push(vergleiche({ key: "lists", herkunft: "du", pfad: "skills, agents, plugins, connectors", wer: "Yours", satz: "their names only; each loads when it fits", bausteine: ["skills", "connectors"] }, liste(jetzt), liste(normal)));
  // ⑧ Fleet's context packs that wait as skills, one by one under their titles: Claude sees each one's line and loads its text when it fits
  const sj = packSkills(jetzt), sn = packSkills(normal);
  for (const id of vereint(sn, sj, (p) => p.id)) {
    const a = sj.find((p) => p.id === id), b = sn.find((p) => p.id === id), wann = (a ?? b)!.zeile.replace(/^- [a-z0-9-]+: /, "");
    wartend.push(vergleiche({ key: `skill:${id}`, herkunft: "fleet", pfad: x.pack?.(id)?.titel ?? id, wer: "Fleet", satz: wann, bausteine: [`pack:${id}`] }, a?.zeile ?? null, b?.zeile ?? null));
  }
  // settings without text: the start line as the Fassung records it, then what runs along
  // --settings is one JSON line of 2 kB; one key per line lets a choice mark only the key it changes
  const jeSchluessel = (z: string): string[] => {
    try { const o: unknown = JSON.parse(z); if (o && typeof o === "object" && !Array.isArray(o)) return Object.entries(o).map(([k, v]) => `${k}: ${JSON.stringify(v)}`); } catch { /* not JSON: the line as it is */ }
    return [z];
  };
  const linie = (f: Fassung | null) => ([["model", "wer", "modell"], ["effort", "wer", "effort"], ["permission mode", "darf", "modus"], ["tools", "darf", "werkzeuge"],
    ["--settings", "darf", "einstellungen"], ["MCP", "darf", "mcp"], ["chosen here", "darf", "mitgegeben"], ["left out", "darf", "weggelassen"]] as const)
    .flatMap(([w, t, id]) => { const v = text1(f, t, id); return v === null ? [] : zeilen(v).flatMap((z) => w === "--settings" ? jeSchluessel(z) : [z]).map((z, i) => `${i ? " ".repeat(16) : w.padEnd(16)}${z}`); }).join("\n");
  einstellungen.push(vergleiche({ key: "line", herkunft: "cc", pfad: "Model and permissions", wer: "Claude Code", satz: "how Fleet starts claude: flags and settings, no text",
    bausteine: ["model", "permissions", "plan", "skills", "connectors", "rules", "hooks", "memory", "rights"] }, linie(jetzt), linie(normal)));
  // „(keine Hooks)“: the Fassung's word for none (server/fassung-umfeld.ts)
  const hooks = text1(jetzt, "darf", "hooks-eigene");
  if (hooks && !/^\(keine/.test(hooks)) einstellungen.push(vergleiche({ key: "along", herkunft: "du", pfad: "Hooks", wer: "Yours", satz: x.hooksAus ? "your hooks are off for this session" : "your scripts, around each step", bausteine: ["hooks"] }, x.hooksAus ? null : hooks, hooks));
  const sw = text1(jetzt, "arbeitet", "schwelle"), swn = text1(normal, "arbeitet", "schwelle");
  if (sw || swn) einstellungen.push(vergleiche({ key: "succession", herkunft: "fleet", pfad: "Succession", wer: "Fleet", satz: "when a fresh session takes over", bausteine: ["succession"] }, sw, swn));
  return { anweisungen, ersteNachricht, wartend, einstellungen };
}
// how many parts differ from normal (the Fleet group counts its texts)
export const geaendert = (b: Startbrief): number => [...b.anweisungen, ...b.ersteNachricht, ...b.wartend, ...b.einstellungen]
  .reduce((n, x) => n + (x.kinder ? x.kinder.filter((k) => k.zeichen).length : x.zeichen ? 1 : 0), 0);
// WHAT A SUCCESSOR HAS THAT ITS PREDECESSOR DIDN'T (Info → Setup on the board, POST /api/self/einrichten): the same comparison as the start
// window's, with the predecessor's start in the place of normal, every part that differs, a group's parts one by one. The first message
// and the git status are the window's own inputs and stay out: a succession's first message is its handover, never a stone.
export function gegenVorgaengerin(jetzt: Fassung, vorher: Fassung, repo: string): Block[] {
  const b = startbrief(jetzt, vorher, { repo, gitNormal: null, gitJetzt: null, aufgabe: null, hooksAus: false, ccTokens: null });
  return [...b.anweisungen, ...b.ersteNachricht, ...b.wartend, ...b.einstellungen].flatMap((x) => x.kinder ?? [x]).filter((x) => x.zeichen !== null);
}
