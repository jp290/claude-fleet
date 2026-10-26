// THE START WINDOW (owner 24.10., round 8 of the mock ~/claude-fleet.local-notes/owner-links/ui-neu/start.html): a free slot opens it.
// Step 1: where it works (the repos, big) and its agents (the repo's own first; copy, import, new). Step 2: the repos shrink to a sliver,
// the session takes the middle — who it is and Start on top, a banner that says whether it starts as your normal Claude Code, then
// „Your Claude Code“ as it is and „Fleet on top“ as switches — and on the right the start brief: what Claude reads when it starts, file
// by file, with − and + lines against `claude` by hand (src/start-brief.ts). What it sends is src/start-wahl.ts; the preview and the
// start read the same fields, so the Fassung hash the brief shows is the one the door checks.
import { el, api, baseName, flotte, starte, zeigeSlot, meldung } from "./k15-haupt";
import { icon, type IconName } from "./icons";
import { S, antwort, hole, info, oeffneOrdner, planUrl, render, repoZeilen, tilde, type St } from "./k15-zustand";
import type { PlanRolle } from "./k15-entwurf-modell";
import { repoMenue } from "./k15-repo";
import { agentVon } from "./k15-agent";
import { modelLabel, modelName } from "./modelname";
import type { Answer } from "./founding";
import type { Antwort } from "./start-tuer";
import type { DirInfoResp } from "./client";
import { morph } from "./dom-morph";
import { mdInto } from "./md";
import { anzeige, fliessend, geaendert, imRepo, nurBeiPfaden, regelDateien, startbrief, uebergabeHinweis, zeilen, type Block, type Fassung } from "./start-brief";
import { FRAGT, MODI, STUFEN, TOOLS, abweichungen, gleich, normal, packsAktiv, schaltePack as schalte, setzePacks, tuer, vorschau, wahlAus, wahlenVon, type Wahl } from "./start-wahl";
import { anatomieVon } from "./k15-anatomie";

// an agent as GET /api/agenten lists it (server/agenten.ts#AgentAnsicht), with `zuletzt` for this repo
export interface AgentZeile {
  id: string; name: string; wahlen: Record<string, unknown>; agentMd: { titel: string; text: string; profil: string } | null;
  art: string; aenderbar: boolean; quelle: string; hash: string; kopieVon?: { id: string; name: string; hash: string };
  abgeleitetVon?: string; importiert?: true; zuletzt?: number | null;
}
type Liste = AgentZeile[] | "laedt" | { fehler: string };
export interface FensterStand {
  schritt: 1 | 2; wechsel: boolean; liste: "agenten" | "kopie" | "import";
  agenten: Map<string, Liste>;
  // the opened agent (null = a new one), its name, the choice now and as saved; `fremd`: what it carries that this window can't set
  agent: AgentZeile | null; name: string; wahl: Wahl; basis: Wahl; fremd: string[];
  // the open block on the left, the unfolded files on the right, „only changes“, what the last change touched (it lights up once)
  offen: string | null; falten: Set<string>; roh: Set<string>; nur: boolean; heiss: string[] | null; blitz: boolean;
  // narrow screens: the start brief over the session; the name field of „Save as agent“ and what is typed in it (null = not yet, it
  // shows the proposal; kept across redraws, which would otherwise put the proposal back); „Delete…“ asked once
  brief: boolean; speichern: boolean; nameEntwurf: string | null; loeschen: boolean;
  letzte: { a: Answer; n: Answer } | null; busy: boolean; fehler: string | null;
}
export const fensterStand0 = (): FensterStand => ({ schritt: 1, wechsel: false, liste: "agenten", agenten: new Map(), agent: null, name: "",
  wahl: normal(), basis: normal(), fremd: [], offen: null, falten: new Set(), roh: new Set(), nur: false, heiss: null, blitz: false, brief: false,
  speichern: false, nameEntwurf: null, loeschen: false, letzte: null, busy: false, fehler: null });

const KB = (b: number): string => b < 1000 ? `${b} B` : `${(b / 1000).toFixed(1)} kB`;
const mehrzahl = (n: number, eins: string, mehr = `${eins}s`): string => `${n} ${n === 1 ? eins : mehr}`;
const schmal = (): boolean => matchMedia("(max-width: 1350px)").matches;
const ruhig = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;
function vor(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 14) return `${mehrzahl(d, "day")} ago`;
  if (d < 63) return `${Math.round(d / 7)} weeks ago`;
  if (d < 365) return `${mehrzahl(Math.round(d / 30), "month")} ago`;
  return `${mehrzahl(Math.round(d / 365), "year")} ago`;
}
function knopf(cls: string, inhalt: (Node | string)[], tu: (e: MouseEvent) => void, titel?: string): HTMLButtonElement {
  const b = el("button", cls) as HTMLButtonElement;
  b.type = "button";
  b.append(...inhalt);
  b.onclick = tu;
  if (titel) b.title = titel;
  return b;
}
const ic = (n: IconName): SVGSVGElement => { const i = icon(n); i.classList.add("sfic"); return i; };

// ---------- what the server says ----------
const fassungVon = (a: Answer | null | undefined): Fassung | null => (a as unknown as { fassung?: Fassung } | null)?.fassung ?? null;
// FLEET'S LIBRARY AS THE PLAN NAMES IT (server.ts#foundingSessionPlan, the rows bibliothek and bibliothek-skills): the packs a start gets when
// it is on, every pack this place can have (server/sitz-wissen.ts#seatKatalog: its title, moment, size, way, and whether it is a concept),
// and the packs sessions wrote (server/eigene-packs.ts); each is a stone of its own, with a switch
// ...and Fleet's packs to choose (trigger seat-choice, `zurWahl`): in the library, never by themselves, `statt` the variant one takes the place of
interface KatalogPack { id: string; titel: string; useWhen: string | null; bytes: number; weg: "start" | "skill"; konzept: boolean; werkzeug?: boolean; satz?: string | null;
  statt?: string; stattTitel?: string }
interface EigenerPack { id: string; titel: string; useWhen: string; bytes: number }
function bibliothekVon(a: Answer | null | undefined): { standard: string[]; katalog: KatalogPack[]; eigene: EigenerPack[] } {
  const d = (id: string) => a?.plan.bausteine.find((b) => b.id === id)?.details as { packs?: unknown; katalog?: unknown; eigene?: unknown; zurWahl?: unknown } | undefined;
  const ids = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const liste = <T extends { id: string }>(v: unknown): T[] => Array.isArray(v) ? (v as T[]).filter((x) => x && typeof x.id === "string") : [];
  const katalog = liste<KatalogPack>(d("bibliothek")?.katalog);
  const zurWahl = liste<EigenerPack & { statt?: string; stattTitel?: string }>(d("bibliothek")?.zurWahl).filter((x) => !katalog.some((k) => k.id === x.id))
    .map((x): KatalogPack => ({ ...x, weg: "start", konzept: false }));
  return { standard: [...ids(d("bibliothek")?.packs), ...ids(d("bibliothek-skills")?.packs)], katalog: [...katalog, ...zurWahl],
    eigene: liste<EigenerPack>(d("bibliothek")?.eigene) };
}
// THE PACKS THIS PLACE GIVES WITHOUT A CHOICE: Fleet's library in Fleet's repo, none in your own setup (server.ts#seatLibraryOn)
const ortPacks = (s: St): string[] => {
  const n = s.sitz.letzte?.n ?? null;
  return n && !eigenesSetup(fassungVon(n)) ? bibliothekVon(n).standard : [];
};
// THE PACKS IT GETS NOW (src/start-wahl.ts#packsAktiv)
const aktivePacks = (s: St): string[] => { const b = bibliothekVon(s.sitz.letzte?.n); return packsAktiv(s.sitz.wahl, ortPacks(s), b.standard, b.katalog); };
const packVon = (s: St, id: string): (KatalogPack | (EigenerPack & { weg: "start"; konzept: false })) | undefined => {
  const { katalog, eigene } = bibliothekVon(s.sitz.letzte?.n), e = eigene.find((x) => x.id === id);
  return katalog.find((x) => x.id === id) ?? (e && { ...e, weg: "start", konzept: false });
};
// the place's packs and a pack's title, for what differs from normal (src/start-wahl.ts#abweichungen)
// (a variant by its stone's name and its own word, as the left shows it)
const ortVon = (s: St): { standard: string[]; wort: (id: string) => string } => ({ standard: ortPacks(s), wort: (id) => {
  const k = bibliothekVon(s.sitz.letzte?.n).katalog, variante = k.some((x) => x.id === id && x.statt) || k.some((x) => x.statt === id);
  return variante ? `${steinTitel(s, id)} (${variantWort(s, id)})` : packVon(s, id)?.titel ?? id;
} });
// A SWITCH FLIPPED (src/start-wahl.ts#schaltePack); a variant that goes with it lights up too
function schaltePack(s: St, id: string): void {
  const { standard, katalog, eigene } = bibliothekVon(s.sitz.letzte?.n), vorher = aktivePacks(s);
  schalte(s.sitz.wahl, id, ortPacks(s), standard, katalog, [...katalog.map((x) => x.id), ...eigene.map((x) => x.id)]);
  const nachher = aktivePacks(s);
  aendere(s, [id, ...vorher.filter((x) => !nachher.includes(x)), ...nachher.filter((x) => !vorher.includes(x))].filter((x, i, a) => a.indexOf(x) === i).map((x) => `pack:${x}`));
}
const ccTokens = (a: Answer | null | undefined): number | null => {
  const t = (a as unknown as { claudeCode?: { messung?: { tokens?: unknown } } } | null)?.claudeCode?.messung?.tokens;
  return typeof t === "number" ? t : null;
};
const abschnitt = (f: Fassung | null, teil: string, id: string): string | null => {
  const t = f?.teile.find((x) => x.id === teil)?.abschnitte.find((a) => a.id === id)?.text;
  return typeof t === "string" && t.length ? t : null;
};
// own setup: the session starts like `claude` there (server/eigenes-setup.ts); Fleet's own repo starts every session as a Fleet seat
const eigenesSetup = (f: Fassung | null): boolean => abschnitt(f, "darf", "eigenes-setup") !== null;
interface Plugin { name: string; an: boolean; skills: number; agenten: number; mcp: boolean }
function plugins(f: Fassung | null): Plugin[] {
  return zeilen(abschnitt(f, "arbeitet", "plugins") ?? "").flatMap((z) => {
    const m = z.match(/^([^@\s]+)@\S+ \S+ · (an|aus)\b/);
    if (!m) return [];
    const zahl = (w: string): number => Number(z.match(new RegExp(`· ${w} (\\d+)`))?.[1] ?? 0);
    return [{ name: m[1], an: m[2] === "an", skills: zahl("Skills"), agenten: zahl("Agenten"), mcp: / · MCP\b/.test(z) }];
  });
}
// your own skills and subagents in ~/.claude, by name (liest arbeitet.claude-eigenes: „Agenten 13: analyst 1224 B …, …“)
function eigene(f: Fassung | null, art: "Agenten" | "Skills"): string[] {
  const z = (abschnitt(f, "arbeitet", "claude-eigenes") ?? "").match(new RegExp(`^${art} \\d+: (.*)$`, "m"))?.[1];
  return z ? z.split(/, (?=[\w-]+ )/).map((x) => x.split(" ")[0]) : [];
}
const hookSkripte = (f: Fassung | null): string[] => zeilen(abschnitt(f, "darf", "hooks-eigene") ?? "")
  .filter((z) => !/^\s/.test(z) && z.includes(" · ")).map((z) => (z.split(" · ").pop() ?? z).split("/").pop()!.replace(/\.sh$/, ""));
// what holds when the window sets nothing: the model and the permission mode the Fassung names (Fleet's repo and a role set their own)
const wirkModell = (f: Fassung | null): string | null => { const t = abschnitt(f, "wer", "modell"); return t && /^[\w.-]+(\[1m\])?$/.test(t) ? t : null; };
const wirkModus = (f: Fassung | null): string | null => { const t = abschnitt(f, "darf", "modus"); return t && MODI.some((m) => m.id === t) ? t : null; };
const notizen = (f: Fassung | null): number => zeilen(abschnitt(f, "liest", "gedaechtnis") ?? "").filter((z) => z.startsWith("- [")).length;
// „Only this repo's“ leaves out your ~/.claude rules; a rule file in a folder above the repo (your ~/AGENTS.md) still comes in
function nurRepoSatz(f: Fassung | null, repo: string): string {
  const a = f?.teile.find((x) => x.id === "liest")?.abschnitte.find((x) => x.id === "projektregeln");
  const oben = regelDateien(a).filter((r) => r.eigentum !== "owner" && !imRepo(r.pfad, repo)).map((r) => anzeige(r.pfad, repo, r.eigentum));
  return oben.length ? `Your ~/.claude rules stay out; ${oben.join(", ")} still comes in, from a folder above.` : "Only this repo's rules; yours stay out.";
}
// A ROLE'S RULES, as its Fassung reads them (the owner's picture 25.10.: the tile said „[Zitat entfernt]“ while the start brief showed the repo's
// AGENTS.md left out and your ~/.claude/CLAUDE.md read): whose files come in, and whose stay out compared with this place without a choice
function regelnHier(fj: Fassung, fn: Fassung | null, repo: string): { wert: HTMLElement; satz: string } {
  const wer = (f: Fassung | null) => {
    const r = regelDateien(f?.teile.find((x) => x.id === "liest")?.abschnitte.find((x) => x.id === "projektregeln"));
    return { deine: r.some((x) => x.eigentum === "owner"), repo: r.some((x) => x.eigentum !== "owner" && imRepo(x.pfad, repo)) };
  };
  const j = wer(fj), n = fn ? wer(fn) : null;
  const wert = j.deine && j.repo ? "Yours + this repo's" : j.deine ? "Only yours" : j.repo ? "This repo's" : "None";
  const raus = [...(n?.repo && !j.repo ? ["this repo's"] : []), ...(n?.deine && !j.deine ? ["your"] : [])];
  return { wert: fest(wert), satz: raus.length ? `${raus.join(" and ").replace(/^./, (c) => c.toUpperCase())} rules stay out.` : "" };
}
// a session on its own branch lands it itself only where the repo has a merge check; elsewhere the owner lands it, as one commit and
// unchecked (server/branch-land.ts)
const landetNicht = (i: DirInfoResp | null): boolean => i?.mergeCheck === false;

// the git status Claude Code reads along when it starts, from /api/dirinfo; on its own branch it starts clean
function gitText(i: DirInfoResp, branch: string | null): string | null {
  if (!i.git) return null;
  const L = [`Current branch: ${branch ?? i.branch ?? "(none)"}`, "", "Status:"];
  if (branch !== null) L.push("(clean)");
  else if (i.files?.length) L.push(...i.files.map((f) => `${f.st.padStart(2)} ${f.pfad}`), ...(i.dirty && i.dirty > i.files.length ? [`… ${i.dirty - i.files.length} more`] : []));
  else L.push(i.dirty ? mehrzahl(i.dirty, "open change") : "(clean)");
  if (i.recent?.length) L.push("", "Recent commits:", ...i.recent.slice(0, 5).map((c) => `${c.hash} ${c.subject}`));
  return L.join("\n");
}
const infoDa = (s: St): DirInfoResp | null => { if (!s.repo) return null; const i = info(s, s.repo); return typeof i === "object" && !("fehler" in i) ? i : null; };
// a branch needs git, and a repo the branch doors take (a workplace repo); elsewhere the door answers 400 at Start
const branchGeht = (i: DirInfoResp | null): boolean => i?.git === true && i.branches !== false;

// ---------- the agents of a repo ----------
function agenten(s: St): Liste {
  const z = s.sitz, repo = s.repo;
  if (!repo) return [];
  const da = z.agenten.get(repo);
  if (da) return da;
  z.agenten.set(repo, "laedt");
  void api(`/api/agenten?cwd=${encodeURIComponent(repo)}`).then(async (r) => {
    const j = await r.json().catch(() => null) as { agenten?: AgentZeile[]; error?: string } | null;
    return r.ok && Array.isArray(j?.agenten) ? j.agenten : { fehler: j?.error ?? `answer ${r.status}` };
  }).catch((e: unknown) => ({ fehler: e instanceof Error ? e.message : "server not reachable" })).then((l) => {
    if (S !== s) return;
    z.agenten.set(repo, l);
    render();
  });
  return "laedt";
}
const istRepo = (a: AgentZeile | null): boolean => !a || a.id === "repo";
// a role of Fleet's (the Orchestratorin): its preview is its role's plan, and its role card is its first message
const rolleVon = (a: AgentZeile | null): PlanRolle | null => a && typeof a.wahlen.rolle === "string" ? a.wahlen.rolle as PlanRolle : null;
function agentName(a: AgentZeile): string {
  if (a.id === "repo") return "The repo's agent";
  if (a.wahlen.rolle === "orchestratorin") return "Orchestrator";
  return a.name;
}
function agentSatz(a: AgentZeile): string {
  if (a.id === "repo") return "Claude Code as you would start it here yourself";
  const { wahl, fremd } = wahlAus(a.wahlen);
  if (typeof a.wahlen.rolle === "string") return "a role of Fleet's: plans the work, opens the branches, brings back the results";
  if (fremd.includes("profil") || fremd.includes("sitz")) return "from the old start window";
  // its packs as one count: their names are in the window once it is open
  const d = abweichungen(wahl, modelName).filter((x) => !x.id.startsWith("pack:")).map((x) => x.wort);
  if (wahl.packs) d.push(wahl.packs.length ? mehrzahl(wahl.packs.length, "context pack") : "No context packs");
  return [...(a.agentMd ? [a.agentMd.titel] : []), ...d].join(" · ") || "your normal Claude Code, saved with a name";
}
function agentHer(a: AgentZeile): string {
  if (a.id === "repo") return "from the repo";
  if (a.importiert || a.abgeleitetVon) return "imported";
  if (a.kopieVon) return `copy of ${a.kopieVon.name === "Agent des Repos" ? "the repo's agent" : a.kopieVon.name}`;
  if (a.art === "eingebaut") return "built in";
  return a.zuletzt ? `used here ${vor(a.zuletzt)}` : a.art === "eigen" ? "yours" : "";
}

// open step 2 with an agent (null = a new one): its saved choice becomes the window's
function oeffne(s: St, a: AgentZeile | null): void {
  const z = s.sitz;
  const { wahl, fremd } = a ? wahlAus(a.wahlen) : { wahl: normal(), fremd: [] as string[] };
  // ⎇+ under a session (src/k15-lader.ts#Eingang with a parent): it starts on a branch of its own, from that session's branch
  if (abzweig(s) && !fremd.length && wahl.branch === null) wahl.branch = "";
  Object.assign(z, { schritt: 2, wechsel: z.schritt !== 2, liste: "agenten", agent: a, name: a ? agentName(a) : "New agent", wahl, basis: structuredClone(wahl),
    fremd: a?.agentMd ? [...fremd, "agentMd"] : fremd, offen: null, falten: new Set(), roh: new Set(), nur: false, heiss: null, blitz: false, brief: false, speichern: false,
    loeschen: false, fehler: null });
  render();
}
function zurueck(s: St): void {
  Object.assign(s.sitz, { schritt: 1, wechsel: true, offen: null, brief: false, speichern: false, loeschen: false, fehler: null });
  render();
}
// starts as the saved agent, by its id: it carries what the window can't set, or nothing was changed on it
const alsAgent = (z: FensterStand): boolean => !!z.agent && z.agent.id !== "repo" && (z.fremd.length > 0 || gleich(z.wahl, z.basis));
// a saved agent with a choice changed in the window
const ungesichert = (z: FensterStand): boolean => !z.fremd.length && !istRepo(z.agent) && !gleich(z.wahl, z.basis);

// ---------- the two previews: normal, and this choice ----------
function urls(s: St): { n: string; a: string } | null {
  if (!s.repo) return null;
  const z = s.sitz, n = planUrl(s.repo, "nur-ordner", {}), rolle = rolleVon(z.agent);
  if (rolle) return { n, a: planUrl(s.repo, rolle, {}) };
  const q = new URLSearchParams(alsAgent(z) ? { agent: z.agent!.id } : vorschau(z.wahl)).toString();
  return { n, a: q ? `${n}&${q}` : n };
}
function plaene(s: St): { a: Answer | null; n: Answer | null; fehler: string | null; laedt: boolean } {
  const u = urls(s), z = s.sitz;
  if (!u) return { a: null, n: null, fehler: null, laedt: false };
  const sn = hole(s, u.n), sa = hole(s, u.a), an = antwort(sn), aa = antwort(sa);
  if (an && aa) z.letzte = { a: aa, n: an };
  const fehler = [sn, sa].map((x) => typeof x === "object" && "fehler" in x ? x.fehler : null).find(Boolean) ?? null;
  return { a: aa ?? z.letzte?.a ?? null, n: an ?? z.letzte?.n ?? null, fehler, laedt: sn === "laedt" || sa === "laedt" };
}
function freierPlatz(s: St): number | null {
  const e = s.eingang && "slot" in s.eingang ? s.eingang.slot : undefined;
  if (e !== undefined && !flotte().find((x) => x.id === e)?.cwd) return e;
  return flotte().find((x) => !x.cwd)?.id ?? null;
}
const platzGezeichnet = new WeakMap<St, number | null>();
// the board read a new fleet: a slot came free or was taken. Redrawn only when nobody types in the window
export function startFlotteNeu(s: St): void {
  if (platzGezeichnet.get(s) === freierPlatz(s)) return;
  const f = document.activeElement;
  if ((f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) && s.shell.detail.contains(f)) return;
  render();
}

// ---------- drawing ----------
export function zeichneStart(s: St): void {
  const z = s.sitz, d = s.shell.detail;
  const platz = freierPlatz(s);
  platzGezeichnet.set(s, platz);
  // one word for each thing (Soll 4): the window opens a session; which slot it takes is the board's to show
  s.shell.setTitle("New session");
  s.shell.setSubtitle("");
  s.shell.foot.replaceChildren();
  // what is kept across a redraw: where each column was scrolled, and the field with the cursor
  const oben = new Map([...d.querySelectorAll<HTMLElement>("[data-scroll]")].map((x) => [x.dataset.scroll!, x.scrollTop]));
  const f = document.activeElement;
  const fokus = (f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) && d.contains(f) && f.dataset.feld
    ? { feld: f.dataset.feld, von: f.selectionStart, bis: f.selectionEnd } : null;
  const p = z.schritt === 2 ? plaene(s) : null;
  const neu = el("div", `sf s${z.wechsel ? (z.schritt === 2 ? 1 : 2) : z.schritt}`);
  neu.append(spalteRepos(s), z.schritt === 1 ? spalteAgenten(s) : spalteSitzung(s, p!), spalteBrief(s, p));
  // a redraw changes only what differs (src/dom-morph.ts): the columns and tiles stay, nothing fades in again
  const alt = d.firstElementChild;
  const stage = alt instanceof HTMLElement && alt.classList.contains("sf") ? (morph(alt, neu), alt) : (d.replaceChildren(neu), neu);
  for (const [k, t] of oben) { const x = stage.querySelector<HTMLElement>(`[data-scroll="${k}"]`); if (x) x.scrollTop = t; }
  const wieder = fokus ? stage.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-feld="${fokus.feld}"]`) : null;
  if (fokus && wieder) {
    wieder.focus({ preventScroll: true });
    if (fokus.von !== null && fokus.bis !== null) wieder.setSelectionRange(fokus.von, fokus.bis);
  }
  // picking an agent: the repos shrink to a sliver and the session takes their place (and back)
  if (z.wechsel) {
    z.wechsel = false;
    if (ruhig()) stage.className = `sf s${z.schritt}`;
    else requestAnimationFrame(() => requestAnimationFrame(() => { stage.className = `sf s${z.schritt}`; }));
  }
  if (z.blitz) { z.blitz = false; requestAnimationFrame(() => zeigeImBrief(s)); }
  pfeilFolgt(s);
  requestAnimationFrame(() => pfeil(s));
}

// LEFT: where it works. Big in step 1, a sliver in step 2
function spalteRepos(s: St): HTMLElement {
  const z = s.sitz, col = el("div", "sfcol sfrepos");
  col.append(el("div", "sflabel", "Where it works"));
  const liste = el("div", "sfrepoliste");
  liste.dataset.scroll = "repos";
  const zeilen = repoZeilen(s);
  for (const r of zeilen) {
    const i = info(s, r.repo);
    const fakten = typeof i !== "object" || "fehler" in i ? (i === "laedt" ? "…" : "not readable")
      : !i.exists ? "the folder is gone" : !i.git ? "no git"
      : [i.branch ?? "no branch", i.dirty ? mehrzahl(i.dirty, "open change") : "clean", ...(r.sessions ? [`${mehrzahl(r.sessions, "session")} running`] : []),
        ...(i.last ? [vor(i.last.ts)] : [])].join(" · ");
    const b = knopf(`sfrepo${r.repo === s.repo ? " sel" : ""}`, [], () => {
      if (s.repo !== r.repo) { s.repo = r.repo; z.liste = "agenten"; }
      if (z.schritt === 2) zurueck(s); else render();
    }, tilde(r.repo));
    b.dataset.repo = r.repo;
    const n = el("div", "sfrn", baseName(r.repo));
    if (typeof i === "object" && !("fehler" in i)) {
      const bd = el("span", "sfbadges");
      bd.append(el("span", `sfbd${i.git ? " ok" : ""}`, i.git ? "git" : "no git"));
      if (Array.isArray(i.packs) && i.packs.length) bd.append(el("span", "sfbd fl", "Fleet"));
      n.append(bd);
    }
    b.append(n, el("div", "sfrf", fakten));
    liste.append(b);
  }
  if (!zeilen.length) liste.append(el("div", "sfleer", s.pins === null ? "Reading your repos …" : "No repo yet: add one below."));
  const anders = knopf("sfanders", ["Another folder…"], () => { s.repoMenu = true; void oeffneOrdner(s, "~"); });
  liste.append(anders);
  const menue = repoMenue(s);
  if (menue) liste.append(menue);
  col.append(liste);
  return col;
}

// MIDDLE IN STEP 1: the agents of this repo, the repo's own first; copy, import, new
function spalteAgenten(s: St): HTMLElement {
  const z = s.sitz, col = el("div", "sfcol sfagenten");
  const karte = el("div", "sfkarte");
  const h = el("div", "sfah");
  h.append("Agents ", el("span", "", s.repo ? `for ${baseName(s.repo)}` : ""));
  const liste = el("div", "sfaliste");
  liste.dataset.scroll = "agenten";
  const l = agenten(s);
  if (l === "laedt") liste.append(el("div", "sfleer", "Reading the agents …"));
  else if (!Array.isArray(l)) liste.append(el("div", "sfleer", `The agents are not readable: ${l.fehler}`));
  else {
    const repoAg = l.find((a) => a.id === "repo");
    const rest = l.filter((a) => a.id !== "repo");
    const hier = rest.filter((a) => a.zuletzt).sort((a, b) => (b.zuletzt ?? 0) - (a.zuletzt ?? 0)), sonst = rest.filter((a) => !a.zuletzt);
    const karteVon = (a: AgentZeile, kopie = false) => {
      const b = knopf(`sfag${a.id === "repo" ? " repoag" : ""}`, [], () => { void (kopie ? kopiere(s, a) : oeffne(s, a)); });
      b.dataset.agent = a.id;
      const t = el("span", "sfagt");
      t.append(el("div", "sfagn", kopie ? `copy of ${agentName(a)}` : agentName(a)), el("div", "sfagf", agentSatz(a)));
      b.append(el("span", "sfav", agentName(a).replace(/^The /, "").charAt(0).toUpperCase()), t, el("span", "sfagher", kopie ? "" : agentHer(a)));
      return b;
    };
    if (z.liste === "kopie") {
      liste.append(el("div", "sfsub", "Copy which one? The copy remembers where it came from."), ...l.map((a) => karteVon(a, true)));
    } else {
      if (repoAg) liste.append(karteVon(repoAg));
      if (hier.length) liste.append(el("div", "sfsub", "Used here"), ...hier.map((a) => karteVon(a)));
      if (sonst.length) liste.append(el("div", "sfsub", hier.length ? "Your other agents" : "Your agents"), ...sonst.map((a) => karteVon(a)));
      if (!rest.some((a) => a.art === "eigen")) liste.append(el("p", "sfleer", "An agent is a set of blocks with a name. Change a block, save it, and it shows up here."));
      if (z.liste === "import") liste.append(einwurf(s));
    }
  }
  if (z.fehler) liste.append(el("div", "sffehler", z.fehler));
  const knoepfe = el("div", "sfbtns");
  const an = (id: FensterStand["liste"]) => () => { z.liste = z.liste === id ? "agenten" : id; z.fehler = null; render(); };
  const k = knopf("", ["Copy an agent"], an("kopie")), i = knopf("", ["Import…"], an("import")), n = knopf("", ["New agent"], () => oeffne(s, null));
  k.setAttribute("aria-pressed", String(z.liste === "kopie"));
  i.setAttribute("aria-pressed", String(z.liste === "import"));
  knoepfe.append(k, i, n);
  karte.append(h, liste, knoepfe);
  col.append(karte);
  return col;
}
// IMPORT: an agent someone shared as a file (GET /api/agenten/:id/datei elsewhere); it never starts with No limits
function einwurf(s: St): HTMLElement {
  const box = el("label", "sfdrop");
  const inp = el("input", "") as HTMLInputElement;
  inp.type = "file";
  inp.accept = ".json,application/json";
  inp.hidden = true;
  inp.onchange = (e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; if (f) void importiere(s, f); };
  box.append(el("b", "", "Drop its file here, or choose one…"),
    el("span", "", "It brings its choices: model, guides, how it asks, and rights up to Builds. It runs on your own Claude Code, with your rules, skills and connectors. A file that asks for No limits or for a role is refused."), inp);
  box.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).classList.add("ueber"); };
  box.ondragleave = (e) => (e.currentTarget as HTMLElement).classList.remove("ueber");
  box.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).classList.remove("ueber"); const f = e.dataTransfer?.files[0]; if (f) void importiere(s, f); };
  return box;
}
async function agentAntwort(s: St, r: Response | null): Promise<AgentZeile | null> {
  const j = r ? await r.json().catch(() => null) as { agent?: AgentZeile; error?: string } | null : null;
  if (S !== s) return null;
  if (!r?.ok || !j?.agent) { s.sitz.fehler = j?.error ?? (r ? `The server answered ${r.status}.` : "The server is not reachable."); render(); return null; }
  if (s.repo) s.sitz.agenten.delete(s.repo);
  return j.agent;
}
const post = (url: string, body: unknown, method = "POST"): Promise<Response | null> =>
  api(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
async function importiere(s: St, f: File): Promise<void> {
  let datei: unknown;
  try { datei = JSON.parse(await f.text()); } catch { s.sitz.fehler = `${f.name} is not an agent file (no JSON).`; render(); return; }
  const roh = datei && typeof datei === "object" && "datei" in datei ? (datei as { datei: unknown }).datei : datei;
  const a = await agentAntwort(s, await post("/api/agenten/import", { datei: roh }));
  if (a) oeffne(s, a);
}
async function kopiere(s: St, a: AgentZeile): Promise<void> {
  const k = await agentAntwort(s, await post(`/api/agenten/${encodeURIComponent(a.id)}/kopie`, {}));
  if (k) oeffne(s, k);
}

// MIDDLE IN STEP 2: the session
function spalteSitzung(s: St, p: ReturnType<typeof plaene>): HTMLElement {
  const z = s.sitz, col = el("div", "sfcol sfsheet");
  col.dataset.scroll = "sheet";
  const inn = el("div", "sfsin");
  const fj = fassungVon(p.a), fn = fassungVon(p.n);
  inn.append(held(s, p));
  const b = banner(s, fj);
  if (b) inn.append(b);
  if (!p.a || !fj) inn.append(el("div", "sfleer", p.fehler ? `The preview is not readable: ${p.fehler}` : "Reading what this session gets …"));
  else inn.append(zoneCC(s, fj, fn), zoneFleet(s, fj, fn));
  col.classList.toggle("laedt", p.laedt);
  col.append(inn);
  return col;
}
function held(s: St, p: ReturnType<typeof plaene>): HTMLElement {
  const z = s.sitz, h = el("div", "sfhero");
  const links = el("div", "");
  links.append(knopf("sfback", [`‹ ${s.repo ? baseName(s.repo) : ""} · all agents`], () => zurueck(s)), el("h2", "", z.name));
  const a = z.agent, repo = s.repo ? baseName(s.repo) : "";
  // under the name only what the agent is for; whether it starts as your normal Claude Code is the banner's to say, its parts the tiles'
  const wozu = typeof a?.wahlen.rolle === "string" ? "Plans the work, opens the branches and brings back the results." : a?.agentMd?.titel ?? null;
  links.append(el("div", "sfpurpose", wozu ?? "Your Claude Code with what Fleet adds on top."));
  const her = a?.importiert || a?.abgeleitetVon ? `Imported from a file · derived from ${(a.abgeleitetVon ?? a.hash).slice(0, 12)}. It brings its choices; your rules, skills and connectors stay yours.`
    : a?.kopieVon ? `Copy of ${a.kopieVon.name === "Agent des Repos" ? "the repo's agent" : a.kopieVon.name} · ${a.hash.slice(0, 12)}` : null;
  const offen = ungesichert(z);
  if (her || offen) {
    const l = el("div", "sflineage", her ?? "");
    if (offen) l.append(el("b", "", `${her ? " · " : ""}not saved yet`));
    links.append(l);
  }
  const rechts = el("div", "sfacts-col");
  const acts = el("div", "sfacts");
  if (z.speichern) {
    const nm = el("input", "sfnm") as HTMLInputElement;
    nm.dataset.feld = "name";
    nm.setAttribute("aria-label", "Name of the agent");
    nm.value = z.nameEntwurf ?? (z.agent?.aenderbar ? z.name : istRepo(z.agent) ? "" : `copy of ${z.name}`);
    nm.placeholder = "Name of the agent";
    nm.oninput = (e) => { z.nameEntwurf = (e.currentTarget as HTMLInputElement).value; };
    const name = (): string => s.shell.detail.querySelector<HTMLInputElement>('[data-feld="name"]')?.value ?? "";
    nm.onkeydown = (e) => { if (e.key === "Enter") void speichere(s, name()); if (e.key === "Escape") { e.stopPropagation(); z.speichern = false; z.nameEntwurf = null; render(); } };
    acts.append(nm, knopf("sfsec", ["Save"], () => void speichere(s, name())));
  } else if (!z.fremd.length && (ungesichert(z) || istRepo(z.agent)))
    acts.append(knopf(`sfsec${ungesichert(z) ? " hot" : ""}`, [z.agent?.aenderbar ? "Save changes" : "Save as agent…"], () => {
      // the proposal is marked once, when the field opens; a later redraw leaves what is typed and where the cursor stands
      z.speichern = true; z.nameEntwurf = null; render();
      requestAnimationFrame(() => s.shell.detail.querySelector<HTMLInputElement>('[data-feld="name"]')?.select());
    }));
  if (z.agent?.art === "eigen") acts.append(knopf("sfsec", ["Share…"], () => void teile(s), "Download it as a file someone else can import"));
  if (z.agent?.art === "eigen" && z.agent.aenderbar && !z.speichern) acts.append(...(z.loeschen
    ? [knopf("sfsec", ["Keep it"], () => { z.loeschen = false; render(); }), knopf("sfsec warn", [`Delete „${z.name}“`], () => void loesche(s))]
    : [knopf("sfsec", ["Delete…"], () => { z.loeschen = true; render(); }, "Delete this agent; it disappears under every repo")]));
  acts.append(knopf("sfsec sfbriefbtn", ["Start brief"], () => { z.brief = !z.brief; render(); }));
  const halt = blocker(s, p.a, p.fehler, p.laedt), nein = z.fehler ?? halt;
  const go = knopf("sfgo", [z.busy ? "Starting …" : "Start"], () => void los(s));
  go.disabled = z.busy || halt !== null;
  acts.append(go);
  // under Start, what happens (Soll 9: the newcomer was only half sure what Start does)
  const ab = abzweig(s)?.branch;
  const hint = el("div", `sfhint${z.fehler || p.fehler ? " warn" : ""}`, nein ?? (z.wahl.branch !== null ? `On its own branch${ab ? ` from ${ab}` : ""}; Fleet opens it in a free slot.`
    : z.wahl.aufgabe?.trim() ? "Starts on its first task right away." : "Opens in your checkout. You give it its task there."));
  rechts.append(acts, hint);
  h.append(links, rechts);
  return h;
}
// what keeps the start back; a preview that can't be read says so, it doesn't read as loading. While the preview of a new choice
// loads, the last one still stands, and its hash would not fit the choice
function blocker(s: St, a: Answer | null, fehler: string | null = null, laedt = false): string | null {
  const z = s.sitz;
  if (!s.repo) return "Pick where it works, on the left.";
  if (fehler) return `The preview is not readable: ${fehler}`;
  if (!a || laedt) return "Reading what this session gets …";
  const cc = s.katalog ? agentVon(s.katalog, "claude") : null;
  if (cc?.aus) return `Claude Code doesn't start here: ${cc.aus.grund}.`;
  if (z.wahl.branch !== null && !z.wahl.branch.trim()) return "Give its branch a name for the board.";
  if (z.wahl.branch === null && freierPlatz(s) === null) return "No free slot in the bar.";
  return null;
}

// THE BANNER, only where it differs (Soll 4, 25.10.): an agent that starts whole, or what this start changes and one click back. A start
// as every session here starts needs no banner: the zones say what is yours and what Fleet adds, and the start brief says it is the usual
function banner(s: St, f: Fassung | null): HTMLElement | null {
  const z = s.sitz, repo = s.repo ? baseName(s.repo) : "";
  const D = alsAgent(z) && z.fremd.length ? [] : abweichungen(z.wahl, modelName, ortVon(s));
  const b = el("div", "sfbanner");
  const satz = (h: string, p: (Node | string)[]) => { const pp = el("p", ""); pp.append(...p); b.append(el("h3", "", h), pp); };
  if (z.fremd.length) {
    b.classList.add("fleet");
    b.append(el("span", "sfbi", "F"));
    satz(typeof z.agent?.wahlen.rolle === "string" ? `${z.name}: a role of Fleet's` : `${z.name}: starts as it was saved`,
      [typeof z.agent?.wahlen.rolle === "string" ? "It reads its role, Fleet's direction and your corrections, and its role sets how it works. " : "It brings what it carries whole. ",
        "Copy it to change a block."]);
    b.append(knopf("sfsec sfbb", ["Copy it"], () => { if (z.agent) void kopiere(s, z.agent); }));
    return b;
  }
  if (!D.length) return null;
  b.classList.add("dev");
  b.append(el("span", "sfbi", String(D.length)), el("h3", "", `${D.length === 1 ? "1 change" : `${D.length} changes`} from ${f && !eigenesSetup(f) ? `how every session in ${repo} starts` : "your normal Claude Code"}`));
  const chips = el("div", "sfdchips");
  for (const d of D) {
    const c = knopf("sfdchip", [el("span", "sfsym", d.zeichen), d.wort], () => { z.offen = d.id; z.heiss = null; render(); requestAnimationFrame(() => zeigeImBrief(s)); });
    c.dataset.dev = d.id;
    chips.append(c);
  }
  b.append(chips);
  const zuruck = knopf("sfsec sfbb", [istRepo(z.agent) ? "Back to normal" : "Your normal Claude Code instead"], () => {
    if (istRepo(z.agent)) { z.wahl = normal(); z.offen = null; z.heiss = null; render(); }
    else { const l = agenten(s); oeffne(s, Array.isArray(l) ? l.find((a) => a.id === "repo") ?? null : null); }
  });
  zuruck.dataset.normal = "1";
  b.append(zuruck);
  return b;
}
// a change on the left: the window draws anew, and what it touched in the start brief lights up once
function aendere(s: St, ids: string[]): void {
  const z = s.sitz;
  z.heiss = ids;
  z.blitz = true;
  render();
}

// ---------- the blocks on the left ----------
// EVERY PLACE ANSWERS ONE QUESTION (Soll 25.10. 22:50, owner 26.10.): the middle says what the session gets and what it can do with it,
// the start brief on the right when it reads what, and the zone whose it is. A tile of Your Claude Code carries its name, its value (a
// choice only where this start may differ) and what it gives; a stone of Fleet on top (`stein`) its name, what it gives the agent and its
// switch, its controls once it is on, dashed while it is off. Moment and size stand only on the right
interface Kachel { id: string; name: string; icon: IconName; wert: Node | string | null; satz: string; war?: string; leise?: boolean; breit?: boolean; koerper?: Node;
  gehalten?: boolean; stein?: boolean; schalter?: { an: boolean; wort: string; tu?: () => void } }
// WHAT EACH BLOCK GIVES THE AGENT, short (owner 26.10. on soll.html: „[Zitat entfernt]“
// ), in words a newcomer reads without Fleet's own (cold read 26.10.: owner, seat, successor, land stopped him)
const GIBT: Readonly<Record<string, string>> = {
  model: "The model that thinks, and how much it can hold.",
  memory: "Remembers what earlier sessions in this folder noted.",
  rules: "Your rules and this repo's, followed in every session.",
  skills: "Your skills, helper agents and plugins, each when it fits.",
  permissions: "When it stops and asks you first.",
  plan: "Plans first; changes nothing until you agree.",
  hooks: "Your scripts that run around each of its steps.",
  task: "Starts at once on a goal you give it.",
  rights: "Limits what it may touch: files, landing, deploying.",
  notebook: "Keeps its own notes for the session after it, in place of Memory.",
  branch: "Works on its own branch; brings its work back when done.",
  succession: "Hands its work to a fresh session before it runs out of room.",
};
// ...and each of Fleet's packs; one the window doesn't know says when it is read, in the library's words
const PACK_GIBT: Readonly<Record<string, string>> = {
  "working-with-the-owner": "Answers you short and leaves your decisions to you.",
  "who-it-is-for": "Checks its work from the user's side, not only with tests.",
  "building-an-agent": "Helps you improve how this agent works, round by round.",
  "advanced-features": "Knows Fleet's extras: second computer, helpers, test instances.",
  "no-longer-humans-gentle": "When it hands work to other agents, it asks them for proof.",
  "your-seat-in-fleet": "Checks its work and brings it back the way Fleet expects.",
  "sharpening-an-order": "Sharpens its orders before it sends them to other sessions.",
  "system-concept": "Knows what Fleet is and where it is going.",
  "sharpen3": "Turns your rough order into a sharp one, on request.",
};
// a pack with variants is one stone with a choice (Soll 6); its name without the variant, and one line of what differs
const STEIN_NAME: Readonly<Record<string, string>> = { "no-longer-humans-gentle": "No longer working with humans" };
const VARIANTE_SATZ: Readonly<Record<string, string>> = { "no-longer-humans-gentle": "gentle: where a wrong result costs most · hard: every time" };
// AN OPEN BLOCK SAYS ONE THING (owner 25.10.: „[Zitat entfernt]“): how it works, in one sentence;
// the controls follow, and the arrow shows where it stands in the start brief
const HOW: Readonly<Record<string, string>> = {
  model: "The Claude model it runs on, and how long it thinks.",
  rules: "Files you and this repo wrote for every session; each is read at its moment.",
  memory: "What earlier sessions in this folder noted; it reads the index at its start.",
  skills: "It sees only their names, and loads one when it fits.",
  connectors: "The MCP servers of your claude.ai account, your plugins and this repo. Untick one it should not use.",
  permissions: "When it stops and asks you before it acts.",
  plan: "It starts in plan mode: it reads and plans, and changes nothing until you agree.",
  workplace: "The folder it works in, as it is now.",
  hooks: "Scripts from your settings that run around each of its steps, without asking.",
  task: "Fleet types it in as its first message, once it is ready.",
  rights: "What it may change: rules Claude Code gets at its start, not a lock in Fleet's server.",
  notebook: "Its own notes, one per branch, in place of this folder's memory.",
  branch: "It works on a new branch beside your checkout, and its commits land when you say so.",
  succession: "When its context reaches this mark, Fleet tells it to hand over to a fresh session.",
};
const NAME: Readonly<Record<string, string>> = { model: "Model", rules: "Rule files", memory: "Memory", skills: "Skills & tools", connectors: "Connectors",
  permissions: "Asks you", plan: "Plan first", workplace: "Workplace", hooks: "Hooks", task: "First task", rights: "Rights", branch: "Branch & land",
  notebook: "Own notebook", succession: "Succession" };
const ICON: Readonly<Record<string, IconName>> = { model: "gear", rules: "file", memory: "history", skills: "list", connectors: "link", permissions: "shield",
  plan: "receipt", workplace: "folder", hooks: "regler", task: "flag", rights: "keys", branch: "branch", notebook: "pencil", succession: "reload" };
const SCHWELLEN = [35, 40, 45, 60, 75];
const howVon = (id: string): string => HOW[id] ?? "";
const und = (l: readonly string[]): string => l.length < 2 ? l.join("") : `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}`;

// a picker: the value as a real control, the menu of the browser underneath; `zeig` is what the pill says where it isn't the option's word
function waehler(id: string, opts: [string | null, string][], jetzt: string | null, setze: (v: string | null) => void, zeig?: string): HTMLElement {
  const pk = el("span", "sftv sfpk");
  pk.append(zeig ?? opts.find(([v]) => v === jetzt)?.[1] ?? String(jetzt), icon("chevron"));
  const sel = el("select", "") as HTMLSelectElement;
  sel.setAttribute("aria-label", NAME[id] ?? id);
  sel.dataset.k = id;
  for (const [v, w] of opts) { const o = el("option", "", w) as HTMLOptionElement; o.value = v ?? ""; o.selected = v === jetzt; sel.append(o); }
  sel.onclick = (e) => e.stopPropagation();
  sel.onchange = (e) => setze((e.currentTarget as HTMLSelectElement).value || null);
  pk.append(sel);
  return pk;
}
const fest = (t: string): HTMLElement => el("span", "sftv", t);
// Claude Code's models from the server's register (GET /api/harnesses): the superseded ones out, one row per name as a person reads it
function modelle(s: St, wirk: string | null = null): [string | null, string][] {
  const k = s.katalog, a = k ? agentVon(k, "claude") : undefined, da = new Set<string>(), out: [string | null, string][] = [[null, wirk ? `${modelLabel(wirk)} · as set here` : "Your default"]];
  for (const m of a?.models ?? []) {
    const wort = modelLabel(m);
    if (k?.abgeloest.has(`claude|${m}`) || da.has(wort)) continue;
    da.add(wort);
    out.push([m, wort]);
  }
  if (s.sitz.wahl.model && !out.some(([m]) => m === s.sitz.wahl.model)) out.push([s.sitz.wahl.model, modelLabel(s.sitz.wahl.model)]);
  return out;
}

// THE RULE FILES, each with whose it is and its moment (owner 25.10. 19:50: „[Zitat entfernt]“); the files
// normal reads and this choice leaves out stay in the list as left out. `key` is the part of the start brief the file is
interface RegelZeile { key: string; name: string; wer: string; wann: string; an: boolean }
function regelListe(fj: Fassung, fn: Fassung | null, repo: string): RegelZeile[] {
  const liest = (f: Fassung | null) => regelDateien(f?.teile.find((x) => x.id === "liest")?.abschnitte.find((x) => x.id === "projektregeln"));
  const j = liest(fj), n = liest(fn);
  return [...n, ...j.filter((x) => !n.some((y) => y.pfad === x.pfad))].map((r) => {
    const an = j.some((x) => x.pfad === r.pfad);
    return { key: `regel:${r.pfad}`, name: anzeige(r.pfad, repo, r.eigentum), wer: r.eigentum !== "owner" && imRepo(r.pfad, repo) ? "this repo's" : "yours",
      wann: !an ? "left out" : nurBeiPfaden(r.text) ? "read with a matching file" : "read at the start", an };
  });
}
function regelListeEl(l: RegelZeile[]): HTMLElement {
  const box = el("div", "sffiles");
  for (const r of l) {
    const z = el("div", r.an ? "" : "out");
    z.dataset.ziel = r.key;
    z.append(el("code", "", r.name), el("span", "", `${r.wer} · ${r.wann}`));
    box.append(z);
  }
  return box;
}

// THE MCP SERVERS, at one place (owner 26.10., „[Zitat entfernt]“: Connectors as a choice, not a switch below): the servers Claude Code showed at
// the start Fleet measured (src/k15-anatomie.ts, group mcp), each with its key; unticking one leaves out its tools (weglassen.mcp)
interface Server { key: string; name: string; von: string }
function server(a: Answer | null | undefined): Server[] {
  const g = anatomieVon((a as unknown as { claudeCode?: unknown } | null)?.claudeCode)?.gruppen.find((x) => x.id === "mcp");
  return (g?.teile ?? []).flatMap((t) => t.schluessel && t.stand !== "aus" ? [{ key: t.schluessel, name: t.name.replace(/^claude\.ai /, ""),
    von: t.weg === "claude.ai-Anbindung" ? "claude.ai" : t.weg.startsWith("Plugin") ? "plugin" : t.weg === "Repo" ? "this repo" : "yours" }] : []);
}
const reicht = (namen: readonly string[]): string => !namen.length ? "Reaches none of your servers." : `Lets it reach ${namen.length <= 4 ? und(namen) : `${namen.slice(0, 3).join(", ")} and ${namen.length - 3} more`}.`;

// a pack's variant as its title says it („… (hard)“), else the last word of its id
const variantWort = (s: St, id: string): string => packVon(s, id)?.titel.match(/\(([^)]+)\)\s*$/)?.[1] ?? id.split("-").pop() ?? id;
// exactly these packs (src/start-wahl.ts#setzePacks); what came or went lights up once
function stellePacks(s: St, neu: string[]): void {
  const { katalog, eigene } = bibliothekVon(s.sitz.letzte?.n), vorher = aktivePacks(s);
  setzePacks(s.sitz.wahl, neu, ortPacks(s), [...katalog.map((x) => x.id), ...eigene.map((x) => x.id)]);
  const nachher = aktivePacks(s);
  aendere(s, [...vorher.filter((x) => !nachher.includes(x)), ...nachher.filter((x) => !vorher.includes(x))].map((x) => `pack:${x}`));
}
// ⎇+ UNDER A SESSION (an Eingang with a parent, src/k15-lader.ts): its own branch starts from that session's branch
function abzweig(s: St): { slot: number; branch: string | null } | null {
  const e = s.eingang;
  if (!e || !("parent" in e) || !e.parent) return null;
  const cwd = flotte().find((x) => x.id === e.parent!.slot)?.cwd, i = cwd ? info(s, cwd) : null;
  return { slot: e.parent.slot, branch: i && typeof i === "object" && !("fehler" in i) ? i.branch ?? null : null };
}
// what switching a stone of How it works on sets, and what switching it off takes back
const DAZU: Readonly<Record<string, (w: Wahl, s: St) => void>> = {
  task: (w) => { w.aufgabe = ""; }, rights: (w) => { w.rechte = "bauen"; },
  branch: (w) => { w.branch = ""; }, notebook: (w) => { w.notizbuch = true; w.branch ??= ""; },
  succession: (w, s) => { w.schwelle = s.env?.migratePct ?? 40; },
};
const WEG: Readonly<Record<string, (w: Wahl) => void>> = {
  task: (w) => { w.aufgabe = null; }, rights: (w) => { w.rechte = null; },
  branch: (w) => { w.branch = null; w.notizbuch = false; }, notebook: (w) => { w.notizbuch = false; },
  succession: (w) => { w.schwelle = null; },
};

function kacheln(s: St, fj: Fassung, fn: Fassung | null): Map<string, Kachel> {
  const z = s.sitz, w = z.wahl, K = new Map<string, Kachel>();
  const gehalten = z.fremd.length > 0, eigen = eigenesSetup(fj), repo = s.repo ?? "";
  const neben = (b: boolean, wort: string): string | undefined => b ? wort : undefined;
  // a choice of this start; an agent that starts whole shows what it carries
  const wahl = (id: string, opts: [string | null, string][], jetzt: string | null, setze: (v: string | null) => void, zeig?: string): Node =>
    gehalten ? fest(zeig ?? opts.find(([v]) => v === jetzt)?.[1] ?? String(jetzt)) : waehler(id, opts, jetzt, (v) => { setze(v); aendere(s, [id]); }, zeig);
  // YOUR CLAUDE CODE; where the window sets nothing, what holds here (fn: this place without a choice)
  const wm = wirkModell(fj), wmn = wirkModell(fn), wp = wirkModus(fj), wpn = wirkModus(fn);
  const modell = w.model ?? wm;
  K.set("model", { id: "model", name: NAME.model, icon: ICON.model, gehalten,
    wert: gehalten ? fest(modell ? modelLabel(modell) : "Your default") : waehler("model", modelle(s, wmn), w.model, (v) => { w.model = v; aendere(s, ["model"]); }),
    satz: GIBT.model, war: neben(!!(w.model || w.effort), [...(w.effort ? [`${w.effort} effort`] : []), wmn ? `normally ${modelName(wmn)}` : "normally your default"].join(" · ")) });
  if (w.notizbuch && w.branch !== null) K.set("memory", { id: "memory", name: NAME.memory, icon: ICON.memory, leise: true, wert: fest("Replaced by its own notebook"), satz: "Its own notebook takes its place." });
  else {
    const n = notizen(fn ?? fj);
    K.set("memory", { id: "memory", name: NAME.memory, icon: ICON.memory, gehalten, satz: GIBT.memory, war: neben(!w.gedaechtnis, "normally on"),
      wert: wahl("memory", [["an", n ? `This folder's · ${mehrzahl(n, "note")}` : "This folder's · empty"], ["aus", "Off"]], w.gedaechtnis ? "an" : "aus", (v) => { w.gedaechtnis = v !== "aus"; }) });
  }
  const regeln = regelListe(fj, fn, repo), liest = regeln.filter((r) => r.an).length;
  K.set("rules", { id: "rules", name: NAME.rules, icon: ICON.rules, breit: true, wert: fest(liest ? mehrzahl(liest, "file") : "None"), satz: GIBT.rules,
    war: eigen ? neben(!w.eigeneRegeln, "normally yours + this repo's") : regelnHier(fj, fn, repo).satz || undefined, koerper: regeln.length ? regelListeEl(regeln) : undefined });
  const pl = plugins(fn ?? fj).filter((x) => x.an), sk = eigene(fn ?? fj, "Skills");
  const skills = sk.length + pl.reduce((n, x) => n + x.skills, 0), aus = w.pluginsAus.length + w.agentenAus.length + (w.tools ? TOOLS.length - w.tools.length : 0);
  const oeffner = (id: string, wort: string) => knopf("sftv sfpk sfopener", [wort, icon("chevron")], (e) => {
    e.stopPropagation(); z.offen = z.offen === id ? null : id; z.heiss = null; render(); requestAnimationFrame(() => zeigeImBrief(s));
  });
  K.set("skills", { id: "skills", name: NAME.skills, icon: ICON.skills, wert: oeffner("skills", `${mehrzahl(skills, "skill")}${aus ? ` · ${aus} out` : ""}`),
    war: neben(aus > 0, "normally all on"), satz: GIBT.skills });
  const sv = server(z.letzte?.n ?? z.letzte?.a), weg = sv.filter((x) => w.mcpAus.includes(x.key)).length;
  K.set("connectors", sv.length
    ? { id: "connectors", name: NAME.connectors, icon: ICON.connectors, wert: oeffner("connectors", weg ? `${sv.length - weg} of ${mehrzahl(sv.length, "server")}` : mehrzahl(sv.length, "server")),
      satz: reicht(sv.filter((x) => !w.mcpAus.includes(x.key)).map((x) => x.name.replace(/^Google /, ""))), war: neben(weg > 0, `normally all ${sv.length}`) }
    : { id: "connectors", name: NAME.connectors, icon: ICON.connectors, wert: fest("Your claude.ai account's"), satz: "Your claude.ai connectors and your plugins' servers." });
  // ASKS YOU: four choices, and what holds without one says its level (cold read 26.10.: „[Zitat entfernt]“ said nothing)
  const hier = MODI.find((m) => m.id === (wpn ?? "manual")) ?? MODI[1], gilt = MODI.find((m) => m.id === (w.permissionMode ?? wp ?? "manual")) ?? hier;
  K.set("permissions", { id: "permissions", name: NAME.permissions, icon: ICON.permissions, gehalten, satz: GIBT.permissions, war: neben(!!w.permissionMode, `normally ${hier.wort}`),
    wert: wahl("permissions", [[null, `${hier.wort} · your setting`], ...MODI.filter((m) => m.id !== null && (FRAGT.includes(m.id) || m.id === w.permissionMode))
      .map((m): [string, string] => [m.id!, m.wort])], w.permissionMode, (v) => { w.permissionMode = v; }, gehalten ? gilt.wort : w.permissionMode === null ? hier.wort : undefined) });
  const i = infoDa(s);
  if (w.branch !== null) K.set("workplace", { id: "workplace", name: NAME.workplace, icon: ICON.workplace, leise: true, wert: fest("Replaced by its own branch"), satz: "Its own branch takes its place." });
  else K.set("workplace", { id: "workplace", name: NAME.workplace, icon: ICON.workplace, wert: fest(`Your checkout${i?.branch ? ` · ${i.branch}` : ""}`),
    satz: i ? `The folder it changes; ${i.dirty ? mehrzahl(i.dirty, "open change") : "all committed"}.` : "The folder it changes." });
  K.set("plan", { id: "plan", name: NAME.plan, icon: ICON.plan, gehalten, satz: GIBT.plan, war: neben(w.planFirst, "normally off"),
    wert: wahl("plan", [[null, "Off"], ["an", "On"]], w.planFirst ? "an" : null, (v) => { w.planFirst = v === "an"; }) });
  const hk = hookSkripte(fj);
  if (hk.length) K.set("hooks", { id: "hooks", name: NAME.hooks, icon: ICON.hooks, gehalten, satz: GIBT.hooks, war: neben(!w.hooks, "normally on"),
    wert: wahl("hooks", [["an", mehrzahl(hk.length, "script")], ["aus", "Off"]], w.hooks ? "an" : "aus", (v) => { w.hooks = v !== "aus"; }) });
  // FLEET ON TOP: each context pack a stone of its own (owner 25.10.: „[Zitat entfernt]“), Fleet's and the ones
  // sessions wrote; a pack with variants is one stone with its choice; amber where it differs from what this place gives
  const { katalog, eigene: geschrieben } = bibliothekVon(z.letzte?.n), an = aktivePacks(s), ort = ortPacks(s);
  const istVariante = (id: string) => katalog.some((x) => x.id === id && x.statt);
  for (const id of [...new Set([...katalog.map((x) => x.id), ...geschrieben.map((x) => x.id), ...an])].filter((x) => !istVariante(x))) {
    const pk = packVon(s, id), alle = [id, ...katalog.filter((x) => x.statt === id).map((x) => x.id)];
    const aktiv = alle.find((x) => an.includes(x)) ?? null, ueblich = alle.find((x) => ort.includes(x)) ?? null, name = STEIN_NAME[id] ?? pk?.titel ?? id;
    let koerper: HTMLElement | undefined;
    if (alle.length > 1) {
      koerper = el("div", "sfvar");
      const seg = el("span", "sfseg");
      for (const v of alle) {
        const b = knopf((aktiv ?? id) === v ? "on" : "", [variantWort(s, v)], (e) => { e.stopPropagation(); if (aktiv !== v) stellePacks(s, [...an.filter((x) => !alle.includes(x)), v]); });
        b.dataset.variante = v;
        b.disabled = gehalten;
        seg.append(b);
      }
      koerper.append(seg, ...(VARIANTE_SATZ[id] ? [el("span", "", VARIANTE_SATZ[id])] : []));
    }
    K.set(`pack:${id}`, { id: `pack:${id}`, name, icon: "info", stein: true, leise: !aktiv, wert: null, koerper,
      satz: !pk ? "Not in this library." : PACK_GIBT[id] ?? pk.useWhen ?? "",
      war: neben(aktiv !== ueblich, aktiv && ueblich ? `normally ${variantWort(s, ueblich)}` : aktiv ? "normally off" : "normally on"),
      schalter: { an: !!aktiv, wort: name, tu: gehalten || (!pk && !aktiv) ? undefined : () => aktiv ? stellePacks(s, an.filter((x) => !alle.includes(x))) : schaltePack(s, id) } });
  }
  // the stones of How it works and Rights: there on or off, a switch each; on, their controls (owner, Soll 8: no footnotes)
  // a task comes at the door beside any agent, also one that starts whole
  const stein = (id: string, ist: boolean, wert: Node | null = null, koerper?: Node, satz = GIBT[id]) => K.set(id, { id, name: NAME[id], icon: ICON[id], stein: true,
    leise: !ist, wert, satz, koerper, gehalten, breit: id === "task" && ist, schalter: { an: ist, wort: NAME[id], tu: gehalten && id !== "task" ? undefined : () => {
      if (ist) WEG[id](w); else DAZU[id](w, s);
      aendere(s, id === "notebook" || id === "branch" ? ["notebook", "branch"] : [id]);
      if (!ist && (id === "task" || id === "branch")) requestAnimationFrame(() => s.shell.detail.querySelector<HTMLElement>(`[data-feld="${id === "task" ? "aufgabe" : "branch"}"]`)?.focus());
    } } });
  if (w.aufgabe !== null) {
    const ta = el("textarea", "sftask") as HTMLTextAreaElement;
    ta.dataset.feld = "aufgabe";
    ta.placeholder = "What should it do? A goal with “done when” works best.";
    ta.value = w.aufgabe;
    ta.oninput = (e) => { w.aufgabe = (e.currentTarget as HTMLTextAreaElement).value; render(); };
    ta.onclick = (e) => e.stopPropagation();
    stein("task", true, null, ta);
  } else stein("task", false);
  if (w.rechte) { const st = STUFEN.find((x) => x.id === w.rechte)!;
    stein("rights", true, gehalten ? fest(st.wort) : waehler("rights", STUFEN.map((x): [string, string] => [x.id, x.wort]), w.rechte, (v) => { w.rechte = (v as Wahl["rechte"]) ?? "bauen"; aendere(s, ["rights"]); }), undefined, st.satz); }
  else stein("rights", false);
  const ab = abzweig(s)?.branch ?? i?.branch ?? null;
  if (w.branch !== null) {
    const nm = el("input", "sfbranchname") as HTMLInputElement;
    nm.dataset.feld = "branch";
    nm.placeholder = "its name on the board";
    nm.value = w.branch;
    nm.oninput = (e) => { w.branch = (e.currentTarget as HTMLInputElement).value; render(); };
    nm.onclick = (e) => e.stopPropagation();
    stein("branch", true, nm, undefined, landetNicht(i) ? "No merge check here: it lands only when you say so, unchecked." : `A new branch from ${ab ?? "here"}; it brings its work back when done.`);
  } else stein("branch", false, null, undefined, landetNicht(i) ? "Works on its own branch; you bring its commits back yourself." : GIBT.branch);
  stein("notebook", w.notizbuch && w.branch !== null);
  // SUCCESSION: where this place already hands over at a mark (an own setup: Fleet types the note at 40 %), it is on, and the choice is the
  // mark; nothing to switch on (Befund 25.10.: „[Zitat entfernt]“ stood offered while the start brief showed the handover)
  const mark = uebergabeHinweis(abschnitt(fn ?? fj, "arbeitet", "schwelle"));
  const marken = SCHWELLEN.map((n): [string, string] => [String(n), `At ${n} %`]);
  if (mark !== null) K.set("succession", { id: "succession", name: NAME.succession, icon: ICON.succession, stein: true, gehalten, satz: GIBT.succession,
    wert: wahl("succession", [[null, `At ${mark} % · as set here`], ...marken.filter(([v]) => v !== String(mark))], w.schwelle === null ? null : String(w.schwelle),
      (v) => { w.schwelle = v === null ? null : Number(v); }, w.schwelle === null ? `At ${mark} %` : undefined), war: neben(w.schwelle !== null, `normally at ${mark} %`) });
  else if (w.schwelle !== null) stein("succession", true, gehalten ? fest(`At ${w.schwelle} %`) : waehler("succession", marken, String(w.schwelle), (v) => { w.schwelle = Number(v ?? 40); aendere(s, ["succession"]); }));
  else stein("succession", false);
  return K;
}

function kachelEl(s: St, k: Kachel): HTMLElement {
  const z = s.sitz, offen = z.offen === k.id;
  const t = el("div", `sftile${k.stein ? " stein" : ""}${k.war ? " chg" : ""}${k.breit ? " wide2" : ""}${k.leise ? " muted" : ""}${k.schalter ? " sw" : ""}${offen ? " open" : ""}`);
  t.dataset.b = k.id;
  t.tabIndex = 0;
  t.setAttribute("role", "button");
  t.setAttribute("aria-expanded", String(offen));
  if (k.stein) t.append(el("span", "sftv sfsn", k.name));
  else {
    const n = el("span", "sftn");
    n.append(ic(k.icon), k.name);
    if (k.gehalten) n.append(el("span", "sfheld", "· this agent"));
    t.append(n);
  }
  if (k.wert) t.append(k.wert);
  if (k.satz) t.append(el("span", "sfts", k.satz));
  if (k.koerper) t.append(k.koerper);
  if (k.war) t.append(el("span", "sfwas", k.war));
  if (k.schalter) {
    const sw = knopf(`sfsw${k.schalter.an ? " on" : ""}`, [el("span", "")], (e) => { e.stopPropagation(); k.schalter!.tu?.(); }, k.schalter.tu ? undefined : "This agent carries it as it was saved.");
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", String(k.schalter.an));
    sw.setAttribute("aria-label", k.schalter.wort);
    sw.disabled = !k.schalter.tu;
    t.append(sw);
  }
  t.onclick = (e) => {
    if ((e.target as Element).closest("select,textarea,input,.sfsw,.sfopener,.sfseg")) return;
    z.offen = offen ? null : k.id;
    z.heiss = null;
    render();
    requestAnimationFrame(() => { zeigeImBrief(s); s.shell.detail.querySelector(".sfdrawer")?.scrollIntoView({ block: "nearest", behavior: ruhig() ? "auto" : "smooth" }); });
  };
  t.onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } };
  return t;
}
// a row of tiles under its question, and the open block below it
function teil(s: St, wort: string, inhalt: Node[], ids: string[], K: Map<string, Kachel>, fj: Fassung, fn: Fassung | null): HTMLElement {
  const z = s.sitz, p = el("div", "sfpart"), rechts = el("div", "sfprow");
  p.append(el("div", "sfplabel", wort));
  rechts.append(...inhalt);
  p.append(rechts);
  if (z.offen && ids.includes(z.offen)) p.append(lade(s, z.offen, K.get(z.offen), fj, fn));
  return p;
}
const reihe = (s: St, K: Map<string, Kachel>, ids: string[]): HTMLElement => { const t = el("div", "sftiles"); for (const id of ids) { const k = K.get(id); if (k) t.append(kachelEl(s, k)); } return t; };
// a kind of stone inside a row: its name and the sentence of what it is (owner 24.10.: each kind its name and one visible sentence)
const art = (name: string, satz: string): HTMLElement => { const a = el("div", "sfart"); a.append(el("b", "", name), satz); return a; };

function zoneCC(s: St, fj: Fassung, fn: Fassung | null): HTMLElement {
  const K = kacheln(s, fj, fn), zone = el("div", "sfzone cc"), zh = el("div", "sfzh"), h = el("h3", "");
  h.append(el("span", "sfmk cc"), "Your Claude Code");
  // the trust sentence once, here (Soll 3 and 7)
  zh.append(h, el("span", "", "What it already has. A choice here changes only this start, never your files."));
  zone.append(zh);
  const TEILE: [string, string[]][] = [["Who it is", ["model"]], ["What it knows", ["memory", "rules"]], ["What it may do", ["skills", "connectors", "permissions"]],
    ["How it works", ["workplace", "plan", "hooks"]]];
  for (const [wort, ids] of TEILE) zone.append(teil(s, wort, [reihe(s, K, ids)], ids, K, fj, fn));
  return zone;
}
// FLEET ON TOP in the same four questions as Your Claude Code above it (das Ganze, 25.10.): what it knows — context packs, its notebook,
// concepts, and the thought behind them —, what it may do — Fleet's skills and rights —, and how it works
function zoneFleet(s: St, fj: Fassung, fn: Fassung | null): HTMLElement {
  const z = s.sitz, K = kacheln(s, fj, fn), i = infoDa(s);
  const { katalog } = bibliothekVon(z.letzte?.n);
  const packs = [...K.keys()].filter((id) => id.startsWith("pack:")), von = (id: string) => katalog.find((x) => `pack:${x.id}` === id);
  // a skill Fleet gives is a tool it runs when you ask, not knowledge (owner 25.10.: „[Zitat entfernt]“)
  const wissen = packs.filter((id) => !von(id)?.konzept && !von(id)?.werkzeug), konzepte = packs.filter((id) => von(id)?.konzept), werkzeuge = packs.filter((id) => von(id)?.werkzeug);
  // an agent that starts whole shows only what it carries, and takes a task beside it (a role none); a branch needs git and a repo the
  // branch doors take
  const da = (id: string) => (!z.fremd.length || K.get(id)?.schalter?.an || (id === "task" && !rolleVon(z.agent)))
    && (branchGeht(i) || (id !== "branch" && id !== "notebook"));
  const zone = el("div", "sfzone fl"), zh = el("div", "sfzh"), h = el("h3", "");
  h.append(el("span", "sfmk fl"), "Fleet on top");
  zh.append(h, el("span", "", "What Fleet adds. Switch on what helps."));
  zone.append(zh);
  const weiss: Node[] = [];
  if (wissen.length) weiss.push(art("Context packs", "how-tos Fleet wrote, next to your rule files"), reihe(s, K, wissen));
  const paar = el("div", "sfpaar");
  if (da("notebook")) { const b = el("div", ""); b.append(art("Notebook", ""), reihe(s, K, ["notebook"])); paar.append(b); }
  if (konzepte.length) { const b = el("div", ""); b.append(art("Concepts", ""), reihe(s, K, konzepte)); paar.append(b); }
  if (paar.childElementCount) weiss.push(paar);
  // the thought behind the kinds, once (owner 25.10. 19:50; the system concept's words)
  if (weiss.length) weiss.push(el("div", "sfgedanke", "What a session learns goes into its notebook. What should hold for every session moves into a context pack or a concept, where everyone can see it."));
  if (weiss.length) zone.append(teil(s, "What it knows", weiss, [...wissen, "notebook", ...konzepte], K, fj, fn));
  const darf = [...werkzeuge, ...(da("rights") ? ["rights"] : [])];
  if (darf.length) zone.append(teil(s, "What it may do", [reihe(s, K, darf)], darf, K, fj, fn));
  const wie = ["branch", "task", "succession"].filter(da);
  if (wie.length) zone.append(teil(s, "How it works", [reihe(s, K, wie)], wie, K, fj, fn));
  return zone;
}

// AN OPEN BLOCK: how it works in Claude Code and what you can set; its words are on the right
function lade(s: St, id: string, k: Kachel | undefined, fj: Fassung, fn: Fassung | null): HTMLElement {
  const z = s.sitz, w = z.wahl, frei = !z.fremd.length;
  const d = el("div", "sfdrawer");
  d.setAttribute("role", "region");
  d.setAttribute("aria-label", k?.name ?? NAME[id] ?? id);
  // its name and the one sentence of what it is; the controls follow, and the arrow points at its place in the start brief
  const dh = el("div", "sfdh");
  // a pack's one sentence is its moment, in its own words („Read this when …“), else the register's line for Claude
  const pk = id.startsWith("pack:") ? packVon(s, id.slice(5)) : undefined;
  const packSatz = pk && "satz" in pk && pk.satz ? pk.satz : pk?.useWhen ?? "";
  dh.append(el("b", "", k?.name ?? NAME[id] ?? id), el("span", "", pk ? packSatz : howVon(id)), knopf("sfcl", ["✕"], () => { z.offen = null; render(); }, "Close"));
  d.append(dh);
  const opts = (liste: { v: string | null; wort: string; satz?: string }[], jetzt: string | null, setze: (v: string | null) => void) => {
    const o = el("div", "sfopts");
    for (const x of liste) { const b = knopf(`sfopt${x.v === jetzt ? " on" : ""}`, [el("b", "", x.wort), ...(x.satz ? [el("span", "", x.satz)] : [])], () => setze(x.v)); b.dataset.set = `${id}:${x.v ?? ""}`; o.append(b); }
    return o;
  };
  const art2 = (titel: string, sub: string, ...inhalt: Node[]) => { const k2 = el("div", "sfkind"), h = el("h4", ""); h.append(titel, el("span", "", sub)); k2.append(h, ...inhalt); return k2; };
  const chips = (namen: { n: string; klein?: string; aus: boolean; tu?: () => void }[]) => {
    const c = el("div", "sfchips");
    for (const x of namen) { const b = knopf(`sfchip${x.aus ? " out" : ""}`, [x.n, ...(x.klein ? [el("small", "", x.klein)] : [])], () => x.tu?.()); b.disabled = !x.tu; c.append(b); }
    return c;
  };
  if (frei && id === "model") {
    d.append(opts(modelle(s, wirkModell(fn ?? fj)).map(([v, wort]) => ({ v, wort })), w.model, (v) => { w.model = v; aendere(s, ["model"]); }));
    const cc = s.katalog ? agentVon(s.katalog, "claude") : undefined;
    if (cc?.effortLevels.length) {
      const seg = el("span", "sfseg");
      for (const e of [null, ...cc.effortLevels]) { const b = knopf(w.effort === e ? "on" : "", [e ?? "your default"], () => { w.effort = e; aendere(s, ["model"]); }); b.dataset.effort = e ?? ""; seg.append(b); }
      d.append(art2("How long it thinks", "", seg));
    }
  }
  if (frei && id === "rules" && eigenesSetup(fj)) d.append(opts([{ v: "ja", wort: "Yours + this repo's", satz: "Your rules for every project, and this repo's own." },
    { v: "nein", wort: "Only this repo's", satz: nurRepoSatz(fn ?? fj, s.repo ?? "") }], w.eigeneRegeln ? "ja" : "nein", (v) => { w.eigeneRegeln = v === "ja"; aendere(s, ["rules"]); }));
  if (frei && id === "permissions") { const hier = MODI.find((m) => m.id === (wirkModus(fn ?? fj) ?? "manual")) ?? MODI[1];
    d.append(opts([{ v: null, wort: `${hier.wort} · your setting`, satz: hier.satz }, ...MODI.filter((m) => m.id !== null && (FRAGT.includes(m.id) || m.id === w.permissionMode))
      .map((m) => ({ v: m.id, wort: m.wort, satz: m.satz }))], w.permissionMode, (v) => { w.permissionMode = v; aendere(s, ["permissions"]); })); }
  if (frei && id === "rights") d.append(opts(STUFEN.map((x) => ({ v: x.id, wort: x.wort, satz: x.satz })), w.rechte, (v) => { w.rechte = v as Wahl["rechte"]; aendere(s, ["rights"]); }));
  if (frei && id === "succession" && w.schwelle !== null) d.append(opts(SCHWELLEN.map((n) => ({ v: String(n), wort: `At ${n} %` })), String(w.schwelle), (v) => { w.schwelle = Number(v); aendere(s, ["succession"]); }));
  if (id === "skills") {
    const f = fn ?? fj, tog = (l: string[], x: string) => { const i = l.indexOf(x); if (i >= 0) l.splice(i, 1); else l.push(x); aendere(s, ["skills"]); };
    d.append(art2("Plugins", "a plugin brings its own skills, agents and tools", chips(plugins(f).filter((x) => x.an).map((x) => ({ n: x.name,
      klein: [x.skills ? mehrzahl(x.skills, "skill") : "", x.agenten ? mehrzahl(x.agenten, "agent") : "", x.mcp ? "server" : ""].filter(Boolean).join(", "),
      aus: w.pluginsAus.includes(x.name), tu: frei ? () => tog(w.pluginsAus, x.name) : undefined })))));
    d.append(art2("Subagents", "helpers it can hand part of the work to", chips(eigene(f, "Agenten").map((x) => ({ n: x, aus: w.agentenAus.includes(x), tu: frei ? () => tog(w.agentenAus, x) : undefined })))));
    d.append(art2("Built-in tools", "each one's description goes with every request", chips(TOOLS.map((x) => ({ n: x, aus: !!w.tools && !w.tools.includes(x),
      tu: frei ? () => { const l = w.tools ?? [...TOOLS]; const i = l.indexOf(x); if (i >= 0) l.splice(i, 1); else l.push(x); w.tools = l.length === TOOLS.length ? null : TOOLS.filter((t) => l.includes(t)); aendere(s, ["skills"]); } : undefined })))));
    d.append(art2("Your skills", "in ~/.claude, by name; each loads when it fits", chips(eigene(f, "Skills").map((x) => ({ n: x, aus: false })))));
  }
  // THE SERVERS AS A CHOICE (owner 26.10.): each one ticked or not, where it comes from, and what holds later in the session (measured at
  // Claude Code 2.1.310: /mcp turns a server on or off; an untick here denies its tools, the server itself still starts)
  if (id === "connectors") {
    const sv = server(z.letzte?.n ?? z.letzte?.a), liste = el("div", "sfserver");
    for (const x of sv) {
      const an = !w.mcpAus.includes(x.key);
      const b = knopf(`sfcheck${an ? " on" : ""}`, [el("span", "sfbox", an ? "✓" : ""), el("b", "", x.name), el("span", "", x.von)], () => {
        w.mcpAus = an ? [...w.mcpAus, x.key] : w.mcpAus.filter((y) => y !== x.key);
        aendere(s, ["connectors"]);
      });
      b.setAttribute("role", "checkbox");
      b.setAttribute("aria-checked", String(an));
      b.dataset.server = x.key;
      b.disabled = !frei;
      liste.append(b);
    }
    d.append(liste);
    const spaeter = el("div", "sfoffnote");
    spaeter.append("Later, in the session: ", el("code", "", "/mcp"), " turns a server on or off.");
    d.append(spaeter);
  }
  if (id === "workplace" || id === "branch") {
    const i = infoDa(s), dl = el("dl", "sfgit");
    const zeile = (dt: string, ...dd: (Node | string)[]) => { const x = el("dd", ""); x.append(...dd); dl.append(el("dt", "", dt), x); };
    if (i && id === "workplace" && w.branch === null) {
      zeile("Branch", el("code", "", i.branch ?? "(none)"));
      const offen = el("div", "");
      if (i.files?.length) for (const f2 of i.files) { const r = el("div", ""); r.append(el("span", "sfst", f2.st.includes("?") ? "new" : "changed"), el("code", "", f2.pfad)); offen.append(r); }
      else offen.append(i.dirty ? mehrzahl(i.dirty, "open change") : "nothing; all committed");
      zeile("Not committed", offen);
      if (i.last) zeile("Last commit", el("code", "", i.last.hash), ` ${vor(i.last.ts)}: ${i.last.subject}`);
      d.append(dl, el("div", "sfoffnote", `It works right in these files, as claude here would${i.dirty ? ", next to your open changes" : ""}. To keep your checkout as it is:`));
      if (frei && branchGeht(i)) d.append(opts([{ v: "branch", wort: "+ Branch & land", satz: landetNicht(i) ? "From Fleet: it works on its own branch; you see its commits and land them yourself, unchecked."
        : "From Fleet: it works on its own branch; you see its commits and land them on main." }], null,
        () => { DAZU.branch(w, s); z.offen = null; aendere(s, ["branch"]); requestAnimationFrame(() => s.shell.detail.querySelector<HTMLElement>('[data-feld="branch"]')?.focus()); }));
    } else if (i && id === "branch" && w.branch !== null) {
      zeile("Starts from", el("code", "", abzweig(s)?.branch ?? i.branch ?? "HEAD"), ...(i.last && !abzweig(s) ? [" at ", el("code", "", i.last.hash)] : []));
      zeile("Its commits", "none yet; each one shows here and on the board as it works");
      zeile("Land", landetNicht(i) ? "only when you say so, in one commit and without a check: this repo has no merge check (ci/merge-check.ts)" : "brings them to main when you say so");
      zeile("Your checkout", `stays as it is${i.dirty ? `, with its ${mehrzahl(i.dirty, "open change")}` : ""}; Fleet makes a git worktree next to it`);
      d.append(dl);
    }
  }
  if (z.fremd.length && (["model", "permissions", "plan", "rights", "succession", "rules", "skills", "connectors", "memory"].includes(id) || id.startsWith("pack:"))) d.append(el("div", "sfoffnote", "This agent carries it as it was saved. Copy it to change it."));
  // beside the start brief the arrow shows where it stands (pfeil); where the brief opens over the session, a link takes you there
  if (schmal()) d.append(knopf("sftoright", ["Show it in the start brief ›"], () => { z.brief = true; render(); requestAnimationFrame(() => zeigeImBrief(s)); }));
  return d;
}

// RIGHT: the start brief. The evidence, not the way in (Soll 5): each part under the name the left gives it and whose it is; its path,
// size and sentence once you point at it or open it (a context pack's sentence stays: it says when it comes); one size, in tokens, in
// the head. The filter and the marks' legend only once something differs (cold read 26.10.: they stood there and marked nothing)
function spalteBrief(s: St, p: ReturnType<typeof plaene> | null): HTMLElement {
  const z = s.sitz, col = el("div", `sfcol sfhood${z.brief ? " show" : ""}`);
  col.setAttribute("role", "complementary");
  col.setAttribute("aria-label", "Start brief");
  if (!p) return col;
  const fj = fassungVon(p.a), fn = fassungVon(p.n), repo = s.repo ? baseName(s.repo) : "";
  const eigen = eigenesSetup(fn ?? fj);
  const hh = el("div", "sfhh"), h = el("h3", "", "Start brief"), hb = el("div", "sfhb");
  hb.dataset.scroll = "brief";
  hh.append(h, el("p", "", "What Claude reads when it starts, word for word and in this order."));
  col.append(hh, hb);
  const zu = knopf("sfcl sfhclose", ["✕"], () => { z.brief = false; render(); }, "Close");
  if (!fj || !fn) { h.append(zu); hb.append(el("div", "sfleer", p.fehler ? `Not readable: ${p.fehler}` : "Reading …")); return col; }
  const i = infoDa(s), w = z.wahl;
  const brief = startbrief(fj, fn, { repo: s.repo ?? "", gitNormal: i ? gitText(i, null) : null, gitJetzt: i ? gitText(i, w.branch !== null ? `<its branch${w.branch.trim() ? ` “${w.branch.trim()}”` : ""}>` : null) : null,
    aufgabe: w.aufgabe, hooksAus: !w.hooks, ccTokens: ccTokens(p.a), pack: (id) => { const pk = packVon(s, id); return pk ? { titel: steinTitel(s, id), wann: pk.useWhen } : null; } });
  const n = geaendert(brief);
  if (!n) z.nur = false;
  // the start in one number (server.ts#startSumme: Claude Code as measured, and what Fleet and your files add)
  const tok = (p.a as Answer | null)?.startSumme?.tokens;
  if (typeof tok === "number") { const t = el("span", "sftok", `≈ ${Math.round(tok / 1000)}k tokens`); t.title = "What it holds when it starts: Claude Code's own part as measured, and every text listed here"; h.append(t); }
  // every part that has words to read, open at once, and closed again
  const lesbar2 = [...brief.anweisungen, ...brief.ersteNachricht, ...brief.wartend, ...brief.einstellungen].filter((b) => b.text !== null || b.diff !== null).map((b) => b.key);
  const alleOffen = lesbar2.length > 0 && lesbar2.every((k) => z.falten.has(k));
  const lies = knopf("sfall", [alleOffen ? "Close them all" : "Read them all ›"], () => { if (alleOffen) z.falten.clear(); else for (const k of lesbar2) z.falten.add(k); render(); });
  h.append(lies, zu);
  if (n && !p.laedt) {
    const bar = el("div", "sfbar"), seg = el("div", "sfseg");
    seg.setAttribute("role", "group");
    for (const [nur, wort] of [[false, "All"], [true, "Only changes"]] as const) {
      const b = knopf(z.nur === nur ? "on" : "", [wort], () => { z.nur = nur; render(); });
      b.dataset.only = nur ? "1" : "0";
      seg.append(b);
    }
    const leg = el("div", "sflegend");
    leg.append(el("span", "sfdm", "+"), "added ", el("span", "sfdm", "−"), "left out ", el("span", "sfdm", "~"), "changed");
    bar.append(seg, leg);
    hh.append(bar);
  }
  col.classList.toggle("laedt", p.laedt);
  // the banner follows the choice at once; until the preview of that choice is read, the brief says it is comparing, not what it was
  // its parts carry keys, so a line that comes or goes doesn't shift the blocks below it into others (src/dom-morph.ts)
  if (p.laedt) { const x = el("div", "sfleer", "Comparing …"); x.dataset.key = "summe"; hb.append(x); }
  else if (!n) { const x = el("div", "sfnone"); x.dataset.key = "summe"; x.append(el("span", "sfok", "✓"), eigen ? "As claude starts here by hand. What you switch will be marked." : `As every session in ${repo} starts. What you switch will be marked.`); hb.append(x); }
  const sek = (titel: string, sub2: string, bl: Block[]) => {
    const out = bl.map((b) => blockEl(s, b, false)).filter((x): x is HTMLElement => x !== null);
    if (!out.length) return;
    const sec = el("div", "sfbsec"), h4 = el("h4", "");
    sec.dataset.key = titel;
    h4.append(titel, el("span", "", sub2));
    sec.append(h4, ...out);
    hb.append(sec);
  };
  // the moments of „Building an agent“ (Where a stone sits), in the order Claude reads
  if (!(z.nur && !n)) {
    sek("With every request", "always in its view", brief.anweisungen);
    sek("Once, at the start", "its first turn, kept like anything said early", brief.ersteNachricht);
    sek("When it fits", "a line waits; the text loads when its moment comes", brief.wartend);
    sek("Settings", "set at its start; nothing to read", brief.einstellungen);
  }
  return col;
}
// a pack by the name its stone has on the left: a variant under its stone's name
function steinTitel(s: St, id: string): string {
  const basis = bibliothekVon(s.sitz.letzte?.n).katalog.find((x) => x.id === id)?.statt ?? id;
  return STEIN_NAME[basis] ?? packVon(s, id)?.titel ?? id;
}
const zeichenWort = { "+": "added", "−": "left out", "~": "changed" } as const;
// a file's text as Markdown, its hand-wrapped lines flowing (src/start-brief.ts#fliessend); a file left out reads dimmed
function lesbar(text: string, weg: boolean): HTMLElement {
  const body = el("div", `sfbk-b sfmd${weg ? " weg" : ""}`);
  mdInto(body, fliessend(text));
  return body;
}
// "+" or "−" when every line that says something carries that mark: the file is wholly new or wholly left out
function ganzeDatei(diff: readonly { z: string; t: string }[]): "+" | "−" | null {
  const sicht = diff.filter((x) => x.t.trim()), z0 = sicht[0]?.z;
  return (z0 === "+" || z0 === "−") && sicht.every((x) => x.z === z0) ? z0 : null;
}
function blockEl(s: St, b: Block, kind: boolean): HTMLElement | null {
  const z = s.sitz;
  if (z.nur && !b.zeichen && !kind && !b.kinder?.some((k) => k.zeichen)) return null;
  const offen = z.falten.has(b.key), gruppe = !!b.kinder;
  const kann = !gruppe && (b.text !== null || b.diff !== null);
  // lit where the open or last changed block makes it; a group only when none of its parts is lit itself
  const trifft = (x: Block): boolean => (z.offen !== null && x.bausteine.includes(z.offen)) || (z.heiss?.some((y) => x.bausteine.includes(y)) ?? false);
  const hl = trifft(b) && !b.kinder?.some(trifft);
  const box = el("div", `sfbk o-${b.herkunft}${gruppe ? " grp" : ""}${b.zeichen ? " chg" : ""}${offen ? " open" : ""}${hl ? " hl" : ""}`);
  box.dataset.ob = b.key;
  if (b.bausteine.length) box.dataset.teile = b.bausteine.join(" ");
  const kopf = el("div", `sfbk-h${kann ? " can" : ""}`);
  if (kann) {
    kopf.setAttribute("role", "button");
    kopf.tabIndex = 0;
    kopf.setAttribute("aria-expanded", String(offen));
    kopf.onclick = () => { if (offen) z.falten.delete(b.key); else z.falten.add(b.key); render(); };
    kopf.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } };
  }
  // a file by its path in the mono face, a part named by the left in the sans face
  const p = el("span", `sfbk-p${/^[~/]|\.md$/.test(b.pfad) ? " datei" : ""}`, b.pfad);
  p.title = b.datei ?? b.pfad;
  const dm = b.zeichen ? el("span", "sfdm", b.zeichen) : el("span", "");
  if (b.zeichen) dm.title = `${zeichenWort[b.zeichen]}, compared with claude by hand`;
  const ox = el("span", "sfox");
  if (kann) ox.append(icon("chevron"));
  // whose it is, always; a context pack's moment and a mark's reason too; the rest when you point at it or open it
  const l = el("span", "sfbk-l");
  const satz = b.zeichen === "−" && b.text === null ? `left out: ${b.satz}` : b.satz, sicht = b.key.startsWith("pack:") || b.key.startsWith("skill:") || !!b.zeichen;
  const mehr = [sicht ? "" : satz, b.datei ?? "", b.key !== "cc" && b.bytes ? KB(b.bytes) : ""].filter(Boolean).join(" · ");
  l.append(el("span", "sfog", b.wer), ...(sicht ? [satz] : []), ...(mehr ? [el("span", "wh", `${sicht ? " · " : ""}${mehr}`)] : []));
  kopf.append(p, dm, ox, l);
  box.append(kopf);
  const zeile = (zz: string, t: string) => { const r = el("div", `sfln${zz === "+" ? " add" : zz === "−" ? " del" : ""}`); r.append(el("span", "sfg", zz === " " ? "" : zz), el("span", "sft", t || " ")); return r; };
  // a file wholly added or wholly left out carries its one mark at the head; open, it reads as Markdown, its lines one click behind
  const ganz = b.diff && !gruppe ? ganzeDatei(b.diff) : null;
  const umschalten = (wort: string) => knopf("sfmore", [wort], () => { if (z.roh.has(b.key)) z.roh.delete(b.key); else z.roh.add(b.key); render(); });
  if (ganz && b.diff && !(offen && z.roh.has(b.key))) {
    if (offen) {
      const body = lesbar(b.diff.map((x) => x.t).join("\n"), ganz === "−");
      body.append(umschalten(`Show its ${mehrzahl(b.diff.filter((x) => x.t.trim()).length, "line")}`));
      box.append(body);
    }
  } else if (b.diff && !gruppe) {
    const alle = b.diff, sicht2 = alle.filter((x) => x.t.trim()), zeig = offen ? alle : sicht2.filter((x) => x.z !== " ").slice(0, 4);
    const body = el("div", "sfbk-b");
    body.append(...zeig.map((x) => zeile(x.z, x.t)));
    const rest = sicht2.filter((x) => x.z !== " ").length - zeig.length;
    if (!offen && rest > 0) body.append(knopf("sfmore", [`… ${mehrzahl(rest, "more line")}`], () => { z.falten.add(b.key); render(); }));
    if (ganz) body.append(umschalten("Show as text"));
    box.append(body);
  } else if (offen && b.text !== null) box.append(lesbar(b.text, false));
  if (b.kinder) {
    const kids = el("div", "sfkids");
    for (const k of b.kinder) { const x = blockEl(s, k, true); if (x) kids.append(x); }
    box.append(kids);
  }
  return box;
}

// the first part a change touched, scrolled into view and lit once
function zeigeImBrief(s: St): void {
  const hb = s.shell.detail.querySelector<HTMLElement>(".sfhb");
  const ziel = hb?.querySelector<HTMLElement>(".sfbk.hl");
  if (!hb || !ziel) return;
  const fr = ziel.getBoundingClientRect(), br = hb.getBoundingClientRect();
  if (fr.top < br.top + 8 || fr.top > br.bottom - 60) hb.scrollBy({ top: fr.top - br.top - 40, behavior: ruhig() ? "auto" : "smooth" });
  for (const x of hb.querySelectorAll<HTMLElement>(".sfbk.hl")) { x.classList.remove("flash"); void x.offsetWidth; x.classList.add("flash"); }
}

// THE ARROW (owner 25.10.: „[Zitat entfernt]“): from the open block to
// each part of the start brief it makes, drawn over the gap between the two columns. It follows both columns as they scroll; a part
// scrolled out of view gets no arrow, and where the brief opens over the session (narrow screens) there is none
const SVG = "http://www.w3.org/2000/svg";
const pfeilPlan = new WeakMap<HTMLElement, number>();
function pfeil(s: St): void {
  const d = s.shell.detail, z = s.sitz;
  let svg = d.querySelector<SVGSVGElement>(":scope > svg.sfpfeil");
  const dr = d.querySelector<HTMLElement>(".sfdrawer"), hb = d.querySelector<HTMLElement>(".sfhb"), sheet = d.querySelector<HTMLElement>('[data-scroll="sheet"]');
  const wege: { p: string; fl: boolean }[] = [];
  if (z.schritt === 2 && z.offen && dr && hb && sheet && !schmal()) {
    if (!svg) {
      svg = document.createElementNS(SVG, "svg");
      svg.classList.add("sfpfeil");
      svg.setAttribute("aria-hidden", "true");
      d.append(svg);
    }
    const o = svg.getBoundingClientRect(), kopf = (dr.querySelector(".sfdh") ?? dr).getBoundingClientRect(), da = dr.getBoundingClientRect();
    const sh = sheet.getBoundingClientRect(), hr = hb.getBoundingClientRect(), y0 = kopf.top + kopf.height / 2;
    const fl = !!dr.closest(".sfzone.fl");
    // A TILE THAT LISTS ITS FILES draws one line from each file to its entry (cold read 25.10.: the arrow met one of three files), each
    // leaving the zone at its own x so the lines stay apart
    const tile = d.querySelector<HTMLElement>(".sftile.open"), reihen = [...(tile?.querySelectorAll<HTMLElement>("[data-ziel]") ?? [])];
    if (tile && reihen.length) {
      const tr = tile.getBoundingClientRect(), zr = (tile.closest(".sfzone") ?? tile).getBoundingClientRect();
      reihen.forEach((r, nr) => {
        const t = hb.querySelector<HTMLElement>(`.sfbk[data-ob="${CSS.escape(r.dataset.ziel!)}"]`), rr = r.getBoundingClientRect(), ya = rr.top + rr.height / 2;
        if (!t || ya < sh.top + 4 || ya > sh.bottom - 4) return;
        const k = (t.querySelector(".sfbk-h") ?? t).getBoundingClientRect(), y1 = k.top + Math.min(k.height, 44) / 2;
        if (y1 < hr.top + 4 || y1 > hr.bottom - 4) return;
        const x0 = zr.right + 3 + nr * 9 - o.left, x1 = t.getBoundingClientRect().left - 5 - o.left, a = ya - o.top, b = y1 - o.top;
        const xe = Math.max(x0 + 8, x1 - 14), m = Math.max(8, (xe - x0) / 2);
        wege.push({ p: `M${tr.right - o.left},${a} L ${x0},${a} C${x0 + m},${a} ${xe - m},${b} ${xe},${b} L ${x1},${b}`, fl });
      });
    }
    // else to the deepest part it makes: a pack's own entry, not the group of Fleet's texts around it
    const trifft = reihen.length ? [] : [...hb.querySelectorAll<HTMLElement>(".sfbk[data-teile]")].filter((x) => x.dataset.teile!.split(" ").includes(z.offen!));
    if (y0 > sh.top + 4 && y0 < sh.bottom - 4) for (const t of trifft.filter((x) => !trifft.some((y) => y !== x && x.contains(y))).slice(0, 6)) {
      const k = (t.querySelector(".sfbk-h") ?? t).getBoundingClientRect(), y1 = k.top + Math.min(k.height, 44) / 2;
      if (y1 < hr.top + 4 || y1 > hr.bottom - 4) continue;
      // the curve ends in a straight run longer than the tip (owner 25.10.: a steep arrow lay on its own tip), so the tip sits on a level line
      const x0 = da.right + 3 - o.left, x1 = t.getBoundingClientRect().left - 5 - o.left, a = y0 - o.top, b = y1 - o.top;
      const xe = Math.max(x0 + 8, x1 - 14), m = Math.max(10, (xe - x0) / 2);
      wege.push({ p: `M${x0},${a} C${x0 + m},${a} ${xe - m},${b} ${xe},${b} L ${x1},${b}`, fl });
    }
  }
  if (!svg) return;
  const neu = wege.map((w) => { const p = document.createElementNS(SVG, "path"); p.setAttribute("d", w.p); if (w.fl) p.classList.add("fl"); return p; });
  const spitzen = wege.map((w) => { const e = w.p.split(" ").pop()!.split(","), x = Number(e[0]), y = Number(e[1]);
    const p = document.createElementNS(SVG, "path"); p.setAttribute("d", `M${x - 7},${y - 4} L${x},${y} L${x - 7},${y + 4}`); p.classList.add("tip"); if (w.fl) p.classList.add("fl"); return p; });
  svg.replaceChildren(...neu, ...spitzen);
}
// once per window: both columns and the window itself move the arrow, one frame at a time
function pfeilFolgt(s: St): void {
  const d = s.shell.detail;
  if (pfeilPlan.has(d)) return;
  pfeilPlan.set(d, 0);
  const plan = (): void => { if (pfeilPlan.get(d)) return; pfeilPlan.set(d, requestAnimationFrame(() => { pfeilPlan.set(d, 0); pfeil(s); })); };
  d.addEventListener("scroll", plan, true);
  addEventListener("resize", plan);
}

// ---------- save, share, start ----------
async function speichere(s: St, name: string): Promise<void> {
  const z = s.sitz, n = name.trim();
  if (!n) return;
  const aendern = !!z.agent?.aenderbar;
  const a = await agentAntwort(s, await post(aendern ? `/api/agenten/${encodeURIComponent(z.agent!.id)}` : "/api/agenten", { name: n, wahlen: wahlenVon(z.wahl) }, aendern ? "PUT" : "POST"));
  if (!a) return;
  Object.assign(z, { agent: a, name: a.name, basis: structuredClone(z.wahl), speichern: false, nameEntwurf: null, fehler: null });
  meldung(`Saved as „${a.name}“. It shows under the agents of every repo.`);
  render();
}
async function teile(s: St): Promise<void> {
  const z = s.sitz, a = z.agent;
  if (!a) return;
  const r = await api(`/api/agenten/${encodeURIComponent(a.id)}/datei`).catch(() => null);
  const j = r ? await r.json().catch(() => null) as { datei?: unknown; error?: string } | null : null;
  if (!r?.ok || !j?.datei) { z.fehler = j?.error ?? "The file could not be made."; render(); return; }
  const url = URL.createObjectURL(new Blob([JSON.stringify(j.datei, null, 2)], { type: "application/json" }));
  const l = document.createElement("a");
  l.href = url;
  l.download = `${a.name.replace(/[^\w.-]+/g, "-")}.fleet-agent.json`;
  l.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function loesche(s: St): Promise<void> {
  const z = s.sitz, a = z.agent;
  if (!a) return;
  const r = await api(`/api/agenten/${encodeURIComponent(a.id)}`, { method: "DELETE" }).catch(() => null);
  if (S !== s) return;
  if (!r?.ok) {
    const j = r ? await r.json().catch(() => null) as { error?: string } | null : null;
    Object.assign(z, { loeschen: false, fehler: j?.error ?? (r ? `The server answered ${r.status}.` : "The server is not reachable.") });
    render();
    return;
  }
  if (s.repo) z.agenten.delete(s.repo);
  meldung(`„${a.name}“ is deleted.`);
  zurueck(s);
}
async function los(s: St): Promise<void> {
  const z = s.sitz, p = plaene(s), a = p.a, w = z.wahl;
  if (z.busy || blocker(s, a, p.fehler, p.laedt) !== null || !a || !s.repo) return;
  z.busy = true;
  z.fehler = null;
  render();
  const ganz = alsAgent(z), ziel = w.aufgabe?.trim() ?? "", rolle = rolleVon(z.agent);
  const { goal: _g, ...felder } = tuer(w);
  const wahl = ganz ? {} : felder;
  const dreier = ganz ? {} : { ...(w.model ? { model: w.model } : {}), ...(w.effort ? { effort: w.effort } : {}) };
  const agent = ganz ? { agent: z.agent!.id } : {};
  const slot = freierPlatz(s);
  const r: Antwort = w.branch !== null
    ? await starte({ tuer: "branch", repo: s.repo, name: w.branch.trim(), punkte: [], ziel, dreier, wahl, ...agent, ...(abzweig(s)?.branch ? { base: abzweig(s)!.branch! } : {}) })
    : slot === null ? { ok: false, fehler: "No free slot in the bar." }
    : await starte({ tuer: "open", cwd: s.repo, slot, dreier, plan: a.start.startbar ? { hash: a.plan.planHash, role: rolle ?? "nur-ordner" } : null,
      // a role's door writes its label and card itself: its Fassung is not the preview's of its plan, so it carries no hash to check
      ...(a.fassungsHash && !rolle ? { fassung: a.fassungsHash } : {}), wahl: { ...wahl, ...(ziel ? { goal: ziel } : {}) }, ...agent });
  if (S !== s) return;
  z.busy = false;
  if (r.ok) {
    s.shell.close();
    zeigeSlot(r.slot);
    if (r.hinweis) meldung(`The session is on slot ${r.slot}. ${r.hinweis}`);
    return;
  }
  z.fehler = r.fehler;
  if (r.bewegt) s.plaene.clear();
  render();
}
// Escape closes what is open in the window first: the name field, the open block, the start brief over the session
export function startSchliesst(s: St): boolean {
  const z = s.sitz;
  if (s.ansicht !== "sitzung") return false;
  if (z.speichern) { z.speichern = false; z.nameEntwurf = null; render(); return true; }
  if (z.loeschen) { z.loeschen = false; render(); return true; }
  if (z.offen) { z.offen = null; render(); return true; }
  if (z.brief && schmal()) { z.brief = false; render(); return true; }
  if (z.liste !== "agenten") { z.liste = "agenten"; render(); return true; }
  return false;
}
