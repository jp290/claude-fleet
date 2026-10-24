// THE START BRIEF (the right side of src/start-fenster.ts), without DOM: what Claude reads when it starts, file by file and in the order it
// reads it, built from the Fassung the preview door returns (GET /api/founding-plan … anlass=neu, server/fassung.ts). Two Fassungen go in,
// the one of this choice and the one of normal (no choice), so every part says what differs from `claude` by hand, as lines: − left out,
// + added (owner 24.10.: „[Zitat entfernt]“).
// The order is the one a session's own context shows (24.10.): its instructions first — Claude Code's own, then what Fleet appends with
// --append-system-prompt —, then its first turn: the CLAUDE.md and AGENTS.md files, the memory index, the git status, the first message,
// the lists by name. Settings without text come last.
export interface Datei { pfad: string; bytes: number; eigentum?: string }
export interface Abschnitt { id: string; quelle?: string | null; bytes?: number | string; text?: string | null; grund?: string | null; dateien?: Datei[] | null }
export interface Fassung { teile: { id: string; abschnitte: Abschnitt[] }[] }

export type Herkunft = "cc" | "fleet" | "du";
export interface Zeile { z: "+" | "−" | " "; t: string }
export interface Block {
  key: string; herkunft: Herkunft; pfad: string; wer: string; satz: string;
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
export interface Startbrief { anweisungen: Block[]; ersteNachricht: Block[]; einstellungen: Block[] }
// what the window adds that the Fassung doesn't carry: the git status as Claude Code reads it, the first message, the line's own flags
export interface Dazu { repo: string; gitNormal: string | null; gitJetzt: string | null; aufgabe: string | null; hooksAus: boolean; ccTokens: number | null }

const abschnitte = (f: Fassung | null, teil: string, id: string): Abschnitt[] =>
  f?.teile.find((t) => t.id === teil)?.abschnitte.filter((a) => a.id === id) ?? [];
const text1 = (f: Fassung | null, teil: string, id: string): string | null =>
  abschnitte(f, teil, id).map((a) => a.text).find((t): t is string => typeof t === "string" && t.length > 0) ?? null;
export const zeilen = (t: string): string[] => { const L = t.split("\n"); while (L.length && L[L.length - 1] === "") L.pop(); return L; };
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
// a file as the window names it: the repo's by the repo's name, yours under ~/.claude, a project's memory folder without its long id
export function anzeige(pfad: string, repo: string, eigentum?: string): string {
  const r = echt(repo.replace(/\/$/, "")), name = r.split("/").pop() ?? r;
  if (imRepo(pfad, repo)) return `${name}/${echt(pfad).slice(r.length + 1)}`;
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

const PACK_SATZ: Readonly<Record<string, string>> = {
  "who-it-is-for": "who meets the work, and how work misses them", "working-with-the-owner": "how to talk with you, and what to decide alone",
  "working-in-few-calls": "how to search and read in few steps", "setting-up-agents": "what to decide when it sets up an agent",
  "how-fleet-remembers": "where a lesson goes, so the next session has it", "made-with-love": "the critical look at visible work",
};
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
  const anweisungen: Block[] = [], ersteNachricht: Block[] = [], einstellungen: Block[] = [];
  // ① Claude Code itself: its text is not Fleet's to show; its size is a measurement
  anweisungen.push({ key: "cc", herkunft: "cc", pfad: "Claude Code's system prompt", wer: "Claude Code", satz: "how it works, and what its tools do",
    bytes: null, text: `Claude Code's own instructions, the description of each tool it may use, and its environment.\nFleet doesn't write this text and can't show it word for word${x.ccTokens ? `; it was measured at about ${Math.round(x.ccTokens / 1000)}k tokens` : ""}.`,
    diff: null, zeichen: null, bausteine: ["skills"] });
  // ② from Fleet: what --append-system-prompt carries, one part per text
  const kinder: Block[] = [];
  const fleetText = (key: string, pfad: string, satz: string, neu: string | null, alt: string | null, bs: string[]) => {
    if (neu === null && alt === null) return;
    kinder.push(vergleiche({ key, herkunft: "fleet", pfad, wer: "Fleet", satz, bausteine: bs }, neu, alt));
  };
  fleetText("zusatz", "appended text", "what Fleet adds to its instructions in this place", text1(jetzt, "liest", "systemzusatz"), text1(normal, "liest", "systemzusatz"), ["skills", "permissions"]);
  fleetText("rolle", "its role card", "what its role tells it", text1(jetzt, "liest", "rolle"), text1(normal, "liest", "rolle"), ["role"]);
  fleetText("eigenes", "its agent file", "what it is for, in your words", text1(jetzt, "liest", "eigenes"), text1(normal, "liest", "eigenes"), ["purpose"]);
  // the rights sentence: appended only when rights are set; without, the Fassung says what holds instead
  const rj = text1(jetzt, "darf", "darf"), rn = text1(normal, "darf", "darf");
  if (rj !== rn) fleetText("rechte", "its rights sentence", "what it may change", rj, null, ["rights"]);
  const pj = packDateien(jetzt), pn = packDateien(normal);
  for (const id of vereint(pn, pj, (p) => p.id)) {
    const a = pj.find((p) => p.id === id), b = pn.find((p) => p.id === id);
    fleetText(`pack:${id}`, (a ?? b)!.pfad, PACK_SATZ[id] ?? (a ?? b)!.titel, a?.text ?? null, b?.text ?? null, ["knowledge"]);
  }
  if (kinder.length) {
    const da = kinder.filter((k) => k.text !== null);
    anweisungen.push({ key: "fleet", herkunft: "fleet", pfad: "From Fleet", wer: "Fleet", satz: da.length ? `${da.length} text${da.length > 1 ? "s" : ""}, appended to its instructions` : "nothing appended now",
      bytes: da.reduce((t, k) => t + (k.bytes ?? 0), 0), text: null, diff: null, zeichen: kinder.some((k) => k.zeichen) ? (da.length ? "+" : "−") : null,
      bausteine: [...new Set(kinder.flatMap((k) => k.bausteine))], kinder });
  }
  // ③ the rule files, with the first turn
  const rj2 = regelDateien(abschnitte(jetzt, "liest", "projektregeln")[0]), rn2 = regelDateien(abschnitte(normal, "liest", "projektregeln")[0]);
  for (const pfad of vereint(rn2, rj2, (r) => r.pfad)) {
    const a = rj2.find((r) => r.pfad === pfad), b = rn2.find((r) => r.pfad === pfad);
    const { wer, satz } = regelWer(pfad, (a ?? b)?.eigentum, x.repo);
    ersteNachricht.push(vergleiche({ key: `regel:${pfad}`, herkunft: "du", pfad: anzeige(pfad, x.repo, (a ?? b)?.eigentum), wer, satz, bausteine: ["rules"] }, a?.text ?? null, b?.text ?? null));
  }
  // ④ what it remembers: the folder's memory, or a notebook of its own
  const mem = (f: Fassung | null) => { const a = abschnitte(f, "liest", "gedaechtnis")[0]; return a?.text ? { pfad: a.dateien?.[0]?.pfad ?? a.quelle ?? "memory", text: a.text, eigen: /notizbuecher/.test(a.quelle ?? "") } : null; };
  const mj = mem(jetzt), mn = mem(normal);
  for (const pfad of vereint(mn ? [mn] : [], mj ? [mj] : [], (m) => m.pfad)) {
    const a = mj?.pfad === pfad ? mj : null, b = mn?.pfad === pfad ? mn : null, eigen = (a ?? b)!.eigen;
    ersteNachricht.push(vergleiche({ key: `mem:${pfad}`, herkunft: eigen ? "fleet" : "du", pfad: anzeige(pfad, x.repo), wer: eigen ? "Fleet" : "Yours",
      satz: eigen ? "its own notebook" : "what earlier sessions here noted", bausteine: ["memory", "notebook"] }, a?.text ?? null, b?.text ?? null));
  }
  // ⑤ the git status: Claude Code looks at the folder's git when it starts and reads this along
  if (x.gitJetzt !== null || x.gitNormal !== null)
    ersteNachricht.push(vergleiche({ key: "git", herkunft: "cc", pfad: "git status", wer: "Claude Code", satz: "read from the folder when it starts", bausteine: ["workplace", "branch"] }, x.gitJetzt, x.gitNormal));
  // ⑥ the first message
  ersteNachricht.push(x.aufgabe !== null
    ? vergleiche({ key: "task", herkunft: "fleet", pfad: "first message", wer: "Fleet", satz: "your task, typed in once Claude Code is ready", bausteine: ["task"] }, x.aufgabe || "(still empty: write it in First task)", null)
    : { key: "task", herkunft: "du", pfad: "first message", wer: "You", satz: "none: it waits for you to type", bytes: null, text: null, diff: null, zeichen: null, bausteine: ["task"] });
  // ⑦ the lists, names only
  const liste = (f: Fassung | null) => [text1(f, "arbeitet", "claude-eigenes"), text1(f, "arbeitet", "plugins")].filter(Boolean).join("\n") || null;
  ersteNachricht.push(vergleiche({ key: "lists", herkunft: "du", pfad: "skills, agents, plugins, connectors", wer: "Yours", satz: "their names only; each loads when it fits", bausteine: ["skills", "connectors"] }, liste(jetzt), liste(normal)));
  // settings without text: the start line as the Fassung records it, then what runs along
  const linie = (f: Fassung | null) => ([["model", "wer", "modell"], ["effort", "wer", "effort"], ["permission mode", "darf", "modus"], ["tools", "darf", "werkzeuge"],
    ["--settings", "darf", "einstellungen"], ["MCP", "darf", "mcp"], ["chosen here", "darf", "mitgegeben"], ["left out", "darf", "weggelassen"]] as const)
    .flatMap(([w, t, id]) => { const v = text1(f, t, id); return v === null ? [] : zeilen(v).map((z, i) => `${i ? " ".repeat(16) : w.padEnd(16)}${z}`); }).join("\n");
  einstellungen.push(vergleiche({ key: "line", herkunft: "cc", pfad: "start line", wer: "Claude Code", satz: "how Fleet starts claude: flags and settings, no text", bausteine: ["model", "permissions", "skills", "rules", "hooks", "memory", "rights"] }, linie(jetzt), linie(normal)));
  // „(keine Hooks)“: the Fassung's word for none (server/fassung-umfeld.ts)
  const hooks = text1(jetzt, "darf", "hooks-eigene");
  if (hooks && !/^\(keine/.test(hooks)) einstellungen.push(vergleiche({ key: "along", herkunft: "du", pfad: "runs along", wer: "Yours", satz: x.hooksAus ? "your hooks are off for this session" : "your hooks, around each step", bausteine: ["hooks"] }, x.hooksAus ? null : hooks, hooks));
  const sw = text1(jetzt, "arbeitet", "schwelle"), swn = text1(normal, "arbeitet", "schwelle");
  if (sw || swn) einstellungen.push(vergleiche({ key: "succession", herkunft: "fleet", pfad: "handover", wer: "Fleet", satz: "when a fresh session takes over", bausteine: ["succession"] }, sw, swn));
  return { anweisungen, ersteNachricht, einstellungen };
}
// how many parts differ from normal (the Fleet group counts its texts)
export const geaendert = (b: Startbrief): number => [...b.anweisungen, ...b.ersteNachricht, ...b.einstellungen]
  .reduce((n, x) => n + (x.kinder ? x.kinder.filter((k) => k.zeichen).length : x.zeichen ? 1 : 0), 0);
