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
import { anzeige, geaendert, imRepo, packDateien, regelDateien, startbrief, uebergabeHinweis, zeilen, type Block, type Fassung } from "./start-brief";
import { MODI, STUFEN, TOOLS, abweichungen, gleich, normal, tuer, vorschau, wahlAus, wahlenVon, type Wahl } from "./start-wahl";

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
  offen: string | null; falten: Set<string>; nur: boolean; heiss: string[] | null; blitz: boolean;
  // narrow screens: the start brief over the session; the name field of „Save as agent“ and what is typed in it (null = not yet, it
  // shows the proposal; kept across redraws, which would otherwise put the proposal back); „Delete…“ asked once
  brief: boolean; speichern: boolean; nameEntwurf: string | null; loeschen: boolean;
  letzte: { a: Answer; n: Answer } | null; busy: boolean; fehler: string | null;
}
export const fensterStand0 = (): FensterStand => ({ schritt: 1, wechsel: false, liste: "agenten", agenten: new Map(), agent: null, name: "",
  wahl: normal(), basis: normal(), fremd: [], offen: null, falten: new Set(), nur: false, heiss: null, blitz: false, brief: false,
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
// FLEET'S LIBRARY AS THE PLAN NAMES IT (server.ts#foundingSessionPlan, the rows bibliothek and bibliothek-skills): the guides a start gets when it
// is on, and the packs sessions wrote (server/eigene-packs.ts), each a stone of its own
interface EigenerPack { id: string; titel: string; useWhen: string; bytes: number }
function bibliothekVon(a: Answer | null | undefined): { standard: string[]; eigene: EigenerPack[] } {
  const d = (id: string) => a?.plan.bausteine.find((b) => b.id === id)?.details as { packs?: unknown; eigene?: unknown } | undefined;
  const ids = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const eigene = Array.isArray(d("bibliothek")?.eigene) ? (d("bibliothek")!.eigene as EigenerPack[]).filter((x) => x && typeof x.id === "string") : [];
  return { standard: [...ids(d("bibliothek")?.packs), ...ids(d("bibliothek-skills")?.packs)], eigene };
}
// what the library gives this start without its own packs: Fleet's guides where they are on — chosen, or by the place outside own setup
const standardVon = (s: St): string[] => {
  const n = s.sitz.letzte?.n ?? null;
  return s.sitz.wahl.bibliothek || (n && !eigenesSetup(fassungVon(n))) ? bibliothekVon(n).standard : [];
};
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
  const d = abweichungen(wahl, modelName).map((x) => x.wort);
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
  Object.assign(z, { schritt: 2, wechsel: z.schritt !== 2, liste: "agenten", agent: a, name: a ? agentName(a) : "New agent", wahl, basis: structuredClone(wahl),
    fremd: a?.agentMd ? [...fremd, "agentMd"] : fremd, offen: null, falten: new Set(), nur: false, heiss: null, blitz: false, brief: false, speichern: false,
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
  const q = new URLSearchParams(alsAgent(z) ? { agent: z.agent!.id } : vorschau(z.wahl, standardVon(s))).toString();
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
  s.shell.setTitle(platz !== null ? `New session · slot ${platz}` : "New session");
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
  // the old system stays reachable as it was (AGENTS.md: switched off, not removed): lanes, a MAIN, the Orchestratorin's constellation
  const aufbau = knopf("sfaufbau", ["Lanes, MAIN and constellations ›"], () => { s.ansicht = "aufbau"; render(); }, "The build of the old start window");
  karte.append(h, liste, knoepfe, aufbau);
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
  inn.append(held(s, p), banner(s, fj));
  if (!p.a || !fj) inn.append(el("div", "sfleer", p.fehler ? `The preview is not readable: ${p.fehler}` : "Reading what this session gets …"));
  else inn.append(zoneCC(s, fj, fn), zoneFleet(s, fj));
  col.classList.toggle("laedt", p.laedt);
  col.append(inn);
  return col;
}
function held(s: St, p: ReturnType<typeof plaene>): HTMLElement {
  const z = s.sitz, h = el("div", "sfhero");
  const links = el("div", "");
  links.append(knopf("sfback", [`‹ ${s.repo ? baseName(s.repo) : ""} · all agents`], () => zurueck(s)), el("h2", "", z.name));
  const a = z.agent, repo = s.repo ? baseName(s.repo) : "";
  links.append(el("div", "sfpurpose", typeof a?.wahlen.rolle === "string" ? "Plans the work, opens the branches and brings back the results."
    : istRepo(a) && a ? `Claude Code in ${repo}, as you would start it there yourself.` : !a ? "Your own setup, starting from your normal Claude Code."
    : agentSatz(a).replace(/^./, (c) => c.toUpperCase()) + "."));
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
  const platz = freierPlatz(s);
  const hint = el("div", `sfhint${z.fehler || p.fehler ? " warn" : ""}`, nein ?? (z.wahl.branch !== null ? "On its own branch; Fleet opens it in a free slot." : `In slot ${platz}, in your checkout.`));
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

// THE BANNER: does it start as my normal Claude Code? If not, what differs, and one click back
function banner(s: St, f: Fassung | null): HTMLElement {
  const z = s.sitz, repo = s.repo ? baseName(s.repo) : "";
  const D = alsAgent(z) && z.fremd.length ? [] : abweichungen(z.wahl, modelName);
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
  if (f && !eigenesSetup(f)) {
    b.classList.add("fleet");
    b.append(el("span", "sfbi", "F"));
    satz("Fleet's own repo", ["Sessions here start as Fleet's seats, not as ", el("code", "", "claude"), " by hand. The start brief on the right shows each part."]);
  } else if (!D.length) {
    b.append(el("span", "sfbi ok", "✓"));
    // until Fleet stops typing its handover note into an own setup without Succession, the banner says it (Slot 16, 24.10.)
    const n = uebergabeHinweis(abschnitt(f, "arbeitet", "schwelle"));
    satz("Your normal Claude Code", ["It starts exactly like ", el("code", "", "claude"), ` in ${repo}. Fleet adds only an id and a key for its board, so it can show the session and bring it back${n !== null ? `, and at ${n} % of its context it types a note asking it to hand over` : ""}.`]);
    return b;
  } else {
    b.classList.add("dev");
    b.append(el("span", "sfbi", String(D.length)), el("h3", "", `${D.length === 1 ? "1 change" : `${D.length} changes`} from your normal Claude Code`));
  }
  if (D.length) {
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
  }
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
interface Kachel { id: string; name: string; icon: IconName; wert: Node | string | null; satz: string; war?: string; weg?: () => void; leise?: boolean; breit?: boolean; koerper?: Node; gehalten?: boolean }
const HOW: Readonly<Record<string, string>> = {
  model: "Claude Code runs on the model it is started with; without a choice, on the one you set.",
  rules: "Claude Code reads a CLAUDE.md at every start: yours in ~/.claude for every project, and the repo's own (CLAUDE.md or AGENTS.md) for this one.",
  memory: "Claude Code keeps a memory folder for each project and reads its index at every start.",
  skills: "Claude Code lists only the names of skills, subagents and plugins at the start, and loads one when it fits.",
  connectors: "Claude Code fetches your claude.ai connectors and your plugins' MCP servers at the start; their tools are there in every session.",
  permissions: "Claude Code's permission mode decides when it stops and asks you.",
  workplace: "Claude Code works in the folder it is started in, and reads its git status when it starts.",
  hooks: "Claude Code runs the hooks from your settings around every tool call, without asking.",
  task: "Fleet types it into the pane as the first message, once Claude Code is ready.",
  knowledge: "Fleet appends these guides to the system prompt; the others wait as skills in a folder it adds.",
  rights: "Fleet sets Claude Code's allow and deny lists, and appends one sentence on what it may change.",
  notebook: "Fleet points Claude Code's memory folder at a notebook of its own, one per branch.",
  branch: "Fleet makes a git worktree on a new branch first and starts Claude Code there; it shows the branch's commits, and Land brings them to main.",
  succession: "Fleet watches the context; at the mark it tells the session to hand over to a fresh one.",
};
const NAME: Readonly<Record<string, string>> = { model: "Model", rules: "Rules", memory: "Memory", skills: "Skills & tools", connectors: "Connectors",
  permissions: "Asks you", workplace: "Workplace", hooks: "Hooks", task: "First task", knowledge: "Fleet's guides", rights: "Rights", branch: "Branch & land",
  notebook: "Own notebook", succession: "Succession" };
const ICON: Readonly<Record<string, IconName>> = { model: "gear", rules: "file", memory: "history", skills: "list", connectors: "link", permissions: "shield",
  workplace: "folder", hooks: "regler", task: "flag", knowledge: "info", rights: "keys", branch: "branch", notebook: "pencil", succession: "reload" };
const SHORT: Readonly<Record<string, string>> = { task: "starts on a goal", knowledge: "how to work with you", rights: "limits what it changes",
  notebook: "its own notes", branch: "its commits, then land", succession: "when to hand over", memory: "what earlier sessions noted", hooks: "your scripts around each step" };
const SCHWELLEN = [35, 40, 45, 60, 75];
// outside Fleet's own repo its guides come as text only: no skills, no folder (server/sitz-wissen.ts)
const howVon = (id: string, eigen: boolean): string => id === "knowledge" && eigen
  ? "Fleet appends these guides to its instructions as text; outside Fleet's own repo there is no folder of skills." : HOW[id] ?? "";

// a picker: the value as a real control, the menu of the browser underneath
function waehler(id: string, opts: [string | null, string][], jetzt: string | null, setze: (v: string | null) => void): HTMLElement {
  const pk = el("span", "sftv sfpk");
  pk.append(opts.find(([v]) => v === jetzt)?.[1] ?? String(jetzt), icon("chevron"));
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

function kacheln(s: St, fj: Fassung, fn: Fassung | null): Map<string, Kachel> {
  const z = s.sitz, w = z.wahl, K = new Map<string, Kachel>();
  const gehalten = z.fremd.length > 0, eigen = eigenesSetup(fj);
  const setze = (id: string, f: (w: Wahl) => void) => (): void => { f(w); aendere(s, [id]); };
  const neben = (b: boolean, wort: string): string | undefined => b ? wort : undefined;
  // YOUR CLAUDE CODE; where the window sets nothing, what holds here (fn: this place without a choice)
  const wm = wirkModell(fj), wmn = wirkModell(fn), wp = wirkModus(fj), wpn = wirkModus(fn);
  const modell = w.model ?? wm;
  K.set("model", { id: "model", name: "Model", icon: "gear", gehalten,
    wert: gehalten ? fest(modell ? modelLabel(modell) : "Your default") : waehler("model", modelle(s, wmn), w.model, (v) => { w.model = v; aendere(s, ["model"]); }),
    satz: `${modell ? `Runs on ${modelName(modell)}.` : "The model you set in Claude Code."}${w.effort ? ` ${w.effort.replace(/^./, (c) => c.toUpperCase())} effort.` : ""}`,
    war: neben(!!(w.model || w.effort), wmn ? `normally ${modelName(wmn)}` : "normally your default") });
  if (eigen) K.set("rules", { id: "rules", name: "Rules", icon: "file", gehalten,
    wert: gehalten ? fest(w.eigeneRegeln ? "Yours + this repo's" : "Only this repo's") : waehler("rules", [["ja", "Yours + this repo's"], ["nein", "Only this repo's"]], w.eigeneRegeln ? "ja" : "nein",
      (v) => { w.eigeneRegeln = v === "ja"; aendere(s, ["rules"]); }),
    satz: w.eigeneRegeln ? "Your rules for every project, and this repo's own." : nurRepoSatz(fn ?? fj, s.repo ?? ""), war: neben(!w.eigeneRegeln, "normally yours + this repo's") });
  else K.set("rules", { id: "rules", name: "Rules", icon: "file", wert: fest("This repo's"), satz: "The rules this repo gives every session." });
  if (w.notizbuch && w.branch !== null) K.set("memory", { id: "memory", name: "Memory", icon: "history", leise: true, wert: fest("Replaced by its own notebook"), satz: "Fleet's notebook takes its place, below." });
  else if (w.gedaechtnis) { const n = notizen(fn ?? fj); K.set("memory", { id: "memory", name: "Memory", icon: "history", wert: fest(n ? `This folder's · ${mehrzahl(n, "note")}` : "This folder's · empty"),
    satz: "Remembers what earlier sessions in this folder noted.", weg: gehalten ? undefined : setze("memory", (x) => { x.gedaechtnis = false; }) }); }
  const pl = plugins(fn ?? fj).filter((x) => x.an), subs = eigene(fn ?? fj, "Agenten"), sk = eigene(fn ?? fj, "Skills");
  const skills = sk.length + pl.reduce((n, x) => n + x.skills, 0), aus = w.pluginsAus.length + w.agentenAus.length + (w.tools ? TOOLS.length - w.tools.length : 0);
  const opener = knopf("sftv sfpk sfopener", [`${mehrzahl(skills, "skill")}${aus ? ` · ${aus} out` : ""}`, icon("chevron")], (e) => { e.stopPropagation(); z.offen = z.offen === "skills" ? null : "skills"; render(); });
  K.set("skills", { id: "skills", name: "Skills & tools", icon: "list", wert: opener, war: neben(aus > 0, "normally all on"),
    satz: `${mehrzahl(subs.length - w.agentenAus.filter((x) => subs.includes(x)).length, "subagent")} and ${mehrzahl(pl.length - w.pluginsAus.length, "plugin")} too; each loads when it fits.` });
  const mcp = pl.filter((x) => x.mcp && !w.pluginsAus.includes(x.name));
  K.set("connectors", { id: "connectors", name: "Connectors", icon: "link", wert: fest(mcp.length ? `${mehrzahl(mcp.length, "plugin server")}` : "Your account's"),
    satz: `${mcp.length ? `${mcp.map((x) => x.name).join(", ")}, ` : ""}and the connectors of your claude.ai account.` });
  const modus = MODI.find((m) => m.id === (w.permissionMode ?? wp)) ?? MODI[0], hier = wpn ? MODI.find((m) => m.id === wpn) : undefined;
  K.set("permissions", { id: "permissions", name: "Asks you", icon: "shield", gehalten,
    wert: gehalten ? fest(modus.wort) : waehler("permissions", MODI.map((m): [string | null, string] => [m.id, m.id === null && hier ? `${hier.wort} · as set here` : m.wort]), w.permissionMode, (v) => { w.permissionMode = v; aendere(s, ["permissions"]); }),
    satz: modus.satz, war: neben(!!w.permissionMode, hier ? `normally ${hier.wort}` : "normally your setting") });
  const i = infoDa(s);
  if (w.branch !== null) K.set("workplace", { id: "workplace", name: "Workplace", icon: "folder", leise: true, wert: fest("Replaced by its own branch"), satz: "Fleet's branch takes its place, below." });
  else K.set("workplace", { id: "workplace", name: "Workplace", icon: "folder", wert: fest(`Your checkout${i?.branch ? ` · ${i.branch}` : ""}`),
    satz: i ? `${i.dirty ? `${mehrzahl(i.dirty, "open change")}` : "All committed"}${i.last ? ` · last commit ${vor(i.last.ts)}` : ""}.` : "Its folder, as it is." });
  const hk = hookSkripte(fj);
  if (w.hooks && hk.length) K.set("hooks", { id: "hooks", name: "Hooks", icon: "regler", wert: fest(mehrzahl(hk.length, "script")),
    satz: `Run around each of its steps, e.g. ${hk[0]}.`, weg: gehalten ? undefined : setze("hooks", (x) => { x.hooks = false; }) });
  // FLEET ON TOP
  if (w.aufgabe !== null) {
    const ta = el("textarea", "sftask") as HTMLTextAreaElement;
    ta.dataset.feld = "aufgabe";
    ta.placeholder = "What should it do? A goal with “done when” works best.";
    ta.value = w.aufgabe;
    ta.oninput = (e) => { w.aufgabe = (e.currentTarget as HTMLTextAreaElement).value; render(); };
    ta.onclick = (e) => e.stopPropagation();
    K.set("task", { id: "task", name: "First task", icon: "flag", wert: null, satz: "", breit: true, koerper: ta, weg: setze("task", (x) => { x.aufgabe = null; }) });
  }
  if (w.bibliothek) { const n = packDateien(fj).length;
    K.set("knowledge", { id: "knowledge", name: "Fleet's guides", icon: "info", wert: fest(n ? mehrzahl(n, "guide") : "On"), satz: "Short guides on how to work well with you.",
      weg: gehalten ? undefined : setze("knowledge", (x) => { x.bibliothek = false; }) }); }
  // A PACK A SESSION WROTE: a stone of its own, its moment as its sentence
  const geschrieben = bibliothekVon(z.letzte?.n).eigene;
  for (const id of w.packs) { const pk = geschrieben.find((x) => x.id === id);
    K.set(`pack:${id}`, { id: `pack:${id}`, name: pk?.titel ?? id, icon: "info", wert: fest(pk ? KB(pk.bytes) : "Pack"), satz: pk?.useWhen ?? "A pack a session wrote.",
      weg: gehalten ? undefined : setze(`pack:${id}`, (x) => { x.packs = x.packs.filter((p) => p !== id); }) }); }
  if (w.rechte) { const st = STUFEN.find((x) => x.id === w.rechte)!;
    K.set("rights", { id: "rights", name: "Rights", icon: "keys", gehalten,
      wert: gehalten ? fest(st.wort) : waehler("rights", STUFEN.map((x): [string, string] => [x.id, x.wort]), w.rechte, (v) => { w.rechte = (v as Wahl["rechte"]) ?? "bauen"; aendere(s, ["rights"]); }),
      satz: st.satz, weg: gehalten ? undefined : setze("rights", (x) => { x.rechte = null; }) }); }
  if (w.branch !== null) {
    const nm = el("input", "sfbranchname") as HTMLInputElement;
    nm.dataset.feld = "branch";
    nm.placeholder = "its name on the board";
    nm.value = w.branch;
    nm.oninput = (e) => { w.branch = (e.currentTarget as HTMLInputElement).value; render(); };
    nm.onclick = (e) => e.stopPropagation();
    K.set("branch", { id: "branch", name: "Branch & land", icon: "branch", wert: nm, satz: landetNicht(i) ? "No merge check here: it lands only when you say so, unchecked."
      : `A new branch from ${i?.branch ?? "here"}; its commits show here and on the board, and Land brings them to main.`,
      weg: setze("branch", (x) => { x.branch = null; x.notizbuch = false; }) });
  }
  if (w.notizbuch && w.branch !== null) K.set("notebook", { id: "notebook", name: "Own notebook", icon: "pencil", wert: fest("One per branch"),
    satz: "Its own notes, kept by Fleet, instead of this folder's memory.", weg: gehalten ? undefined : setze("notebook", (x) => { x.notizbuch = false; }) });
  if (w.schwelle !== null) K.set("succession", { id: "succession", name: "Succession", icon: "reload", gehalten,
    wert: gehalten ? fest(`At ${w.schwelle} %`) : waehler("succession", SCHWELLEN.map((n): [string, string] => [String(n), `At ${n} %`]), String(w.schwelle), (v) => { w.schwelle = Number(v ?? 40); aendere(s, ["succession"]); }),
    satz: `At ${w.schwelle} % of its context, Fleet tells it to hand over to a fresh session.`, weg: gehalten ? undefined : setze("succession", (x) => { x.schwelle = null; }) });
  return K;
}
// what can be switched on, and what switching it on sets
const DAZU: Readonly<Record<string, (w: Wahl, s: St) => void>> = {
  memory: (w) => { w.gedaechtnis = true; }, hooks: (w) => { w.hooks = true; },
  task: (w) => { w.aufgabe = ""; }, knowledge: (w) => { w.bibliothek = true; }, rights: (w) => { w.rechte = "bauen"; },
  branch: (w) => { w.branch = ""; }, notebook: (w) => { w.notizbuch = true; w.branch ??= ""; },
  succession: (w, s) => { w.schwelle = s.env?.migratePct ?? 40; },
};

function kachelEl(s: St, k: Kachel): HTMLElement {
  const z = s.sitz, offen = z.offen === k.id;
  const t = el("div", `sftile${k.war ? " chg" : ""}${k.breit ? " wide" : ""}${k.leise ? " muted" : ""}${offen ? " open" : ""}`);
  t.dataset.b = k.id;
  t.tabIndex = 0;
  t.setAttribute("role", "button");
  t.setAttribute("aria-expanded", String(offen));
  const n = el("span", "sftn");
  n.append(ic(k.icon), k.name);
  if (k.gehalten) n.append(el("span", "sfheld", "· this agent"));
  t.append(n);
  if (k.wert) t.append(k.wert);
  if (k.satz) t.append(el("span", "sfts", k.satz));
  if (k.war) t.append(el("span", "sfwas", k.war));
  if (k.koerper) t.append(k.koerper);
  if (k.weg) {
    const x = knopf("sfxb", ["×"], (e) => { e.stopPropagation(); if (z.offen === k.id) z.offen = null; k.weg!(); }, `Take ${k.name} out`);
    x.setAttribute("aria-label", `Take ${k.name} out`);
    t.append(x);
  }
  t.onclick = (e) => {
    if ((e.target as Element).closest("select,textarea,input,.sfxb,.sfopener")) return;
    z.offen = offen ? null : k.id;
    z.heiss = null;
    render();
    requestAnimationFrame(() => { zeigeImBrief(s); s.shell.detail.querySelector(".sfdrawer")?.scrollIntoView({ block: "nearest", behavior: ruhig() ? "auto" : "smooth" }); });
  };
  t.onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } };
  return t;
}
function geist(s: St, id: string): HTMLElement {
  const b = knopf("sfghost", [], () => { DAZU[id](s.sitz.wahl, s); aendere(s, [id]); });
  b.dataset.add = id;
  const n = el("span", "sftn");
  n.append(ic(ICON[id]), `+ ${NAME[id]}`);
  b.append(n, el("span", "sfts", id === "memory" ? "Remembers what earlier sessions in this folder noted." : "Your scripts that run around each of its steps."));
  return b;
}

function zoneCC(s: St, fj: Fassung, fn: Fassung | null): HTMLElement {
  const z = s.sitz, K = kacheln(s, fj, fn), eigen = eigenesSetup(fj);
  const zone = el("div", "sfzone cc");
  const zh = el("div", "sfzh");
  const h = el("h3", "");
  h.append(el("span", "sfmk cc"), "Your Claude Code");
  const anders = abweichungen(z.wahl).some((d) => ["model", "rules", "memory", "skills", "permissions", "hooks"].includes(d.id));
  zh.append(h, el("span", "", !eigen || z.fremd.length ? "Claude Code's own parts. Here Fleet sets a few of them; the start brief marks each."
    : anders ? "Claude Code as you set it up; what is amber differs from starting claude here yourself." : "Claude Code as you set it up: the same as starting claude here yourself."));
  zone.append(zh);
  const TEILE: [string, string[]][] = [["Who it is", ["model"]], ["What it knows", ["rules", "memory"]], ["What it may do", ["skills", "connectors", "permissions"]], ["How it works", ["workplace", "hooks"]]];
  const hatHooks = hookSkripte(fj).length > 0;
  for (const [wort, ids] of TEILE) {
    const teil = el("div", "sfpart"), tiles = el("div", "sftiles");
    teil.append(el("div", "sfplabel", wort));
    for (const id of ids) {
      const k = K.get(id);
      if (k) tiles.append(kachelEl(s, k));
      else if (!z.fremd.length && ((id === "memory" && !z.wahl.gedaechtnis) || (id === "hooks" && !z.wahl.hooks && hatHooks))) tiles.append(geist(s, id));
    }
    teil.append(tiles);
    if (z.offen && ids.includes(z.offen)) teil.append(lade(s, z.offen, K.get(z.offen), fj, fn));
    zone.append(teil);
  }
  return zone;
}
function zoneFleet(s: St, fj: Fassung): HTMLElement {
  const z = s.sitz, w = z.wahl, K = kacheln(s, fj, null);
  const FLEET = ["task", "knowledge", "rights", "branch", "notebook", "succession"];
  // ...and each pack a session wrote, after Fleet's guides
  const eigene = bibliothekVon(z.letzte?.n).eigene;
  const an = [...FLEET.filter((id) => K.has(id)), ...[...K.keys()].filter((id) => id.startsWith("pack:"))];
  // a role works in your checkout; an agent that starts whole takes only a task beside it
  const moeglich = FLEET.filter((id) => !K.has(id) && (!z.fremd.length || (id === "task" && !rolleVon(z.agent)))
    && (branchGeht(infoDa(s)) || (id !== "branch" && id !== "notebook")));
  const zone = el("div", "sfzone fl");
  const zh = el("div", "sfzh");
  const h = el("h3", "");
  h.append(el("span", "sfmk fl"), "Fleet on top");
  zh.append(h, el("span", "", an.length ? "Switched on for this session. Each adds a text or a setting; the start brief marks it." : "Nothing on. Switch on what helps; each adds a text or a setting, and the start brief marks it."));
  zone.append(zh);
  if (an.length) {
    const tiles = el("div", "sftiles");
    for (const id of an) tiles.append(kachelEl(s, K.get(id)!));
    zone.append(tiles);
  }
  if (z.offen && FLEET.includes(z.offen) && K.has(z.offen)) zone.append(lade(s, z.offen, K.get(z.offen), fj, null));
  if (moeglich.length) {
    const adds = el("div", "sfadds");
    for (const id of moeglich) {
      const kurz = id === "branch" && landetNicht(infoDa(s)) ? "its commits, on their own branch" : SHORT[id];
      const b = knopf("sfaddon", [el("span", "sfpl", "+"), ic(ICON[id]), el("b", "", NAME[id]), el("span", "", kurz)], () => {
        DAZU[id](w, s);
        aendere(s, id === "notebook" ? ["notebook", "branch"] : [id]);
        if (id === "task" || id === "branch") requestAnimationFrame(() => s.shell.detail.querySelector<HTMLElement>(`[data-feld="${id === "task" ? "aufgabe" : "branch"}"]`)?.focus());
      }, howVon(id, eigenesSetup(fj)));
      b.dataset.add = id;
      adds.append(b);
    }
    zone.append(adds);
  }
  // the packs not chosen yet: a + each, as the parts above
  const frei = z.fremd.length ? [] : eigene.filter((pk) => !w.packs.includes(pk.id));
  if (frei.length) {
    const adds = el("div", "sfadds");
    for (const pk of frei) {
      const b = knopf("sfaddon", [el("span", "sfpl", "+"), ic("info"), el("b", "", pk.titel), el("span", "", pk.useWhen)], () => {
        w.packs = [...w.packs, pk.id];
        aendere(s, [`pack:${pk.id}`]);
      }, `A pack a session wrote (${KB(pk.bytes)}). It goes word for word into what this session reads at its start.`);
      b.dataset.add = `pack:${pk.id}`;
      adds.append(b);
    }
    zone.append(adds);
  }
  return zone;
}

// AN OPEN BLOCK: how it works in Claude Code and what you can set; its words are on the right
function lade(s: St, id: string, k: Kachel | undefined, fj: Fassung, fn: Fassung | null): HTMLElement {
  const z = s.sitz, w = z.wahl, frei = !z.fremd.length;
  const d = el("div", "sfdrawer");
  d.setAttribute("role", "region");
  d.setAttribute("aria-label", NAME[id] ?? id);
  const dh = el("div", "sfdh");
  dh.append(el("b", "", NAME[id] ?? id), el("span", "", k?.satz ?? ""), knopf("sfcl", ["✕"], () => { z.offen = null; render(); }, "Close"));
  const how = el("div", "sfhow");
  how.append(el("b", "", "In Claude Code"), howVon(id, eigenesSetup(fj)));
  d.append(dh, how);
  const opts = (liste: { v: string | null; wort: string; satz?: string }[], jetzt: string | null, setze: (v: string | null) => void) => {
    const o = el("div", "sfopts");
    for (const x of liste) { const b = knopf(`sfopt${x.v === jetzt ? " on" : ""}`, [el("b", "", x.wort), ...(x.satz ? [el("span", "", x.satz)] : [])], () => setze(x.v)); b.dataset.set = `${id}:${x.v ?? ""}`; o.append(b); }
    return o;
  };
  const art = (titel: string, sub: string, ...inhalt: Node[]) => { const k2 = el("div", "sfkind"), h = el("h4", ""); h.append(titel, el("span", "", sub)); k2.append(h, ...inhalt); return k2; };
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
      d.append(art("How long it thinks", "", seg));
    }
  }
  if (frei && id === "rules" && eigenesSetup(fj)) d.append(opts([{ v: "ja", wort: "Yours + this repo's", satz: "Your rules for every project, and this repo's own." },
    { v: "nein", wort: "Only this repo's", satz: nurRepoSatz(fn ?? fj, s.repo ?? "") }], w.eigeneRegeln ? "ja" : "nein", (v) => { w.eigeneRegeln = v === "ja"; aendere(s, ["rules"]); }));
  if (frei && id === "permissions") { const wpn = wirkModus(fn ?? fj), hier = wpn ? MODI.find((m) => m.id === wpn) : undefined;
    d.append(opts(MODI.map((m) => m.id === null && hier ? { v: null, wort: `${hier.wort} · as set here`, satz: hier.satz } : { v: m.id, wort: m.wort, satz: m.satz }), w.permissionMode, (v) => { w.permissionMode = v; aendere(s, ["permissions"]); })); }
  if (frei && id === "rights") d.append(opts(STUFEN.map((x) => ({ v: x.id, wort: x.wort, satz: x.satz })), w.rechte, (v) => { w.rechte = v as Wahl["rechte"]; aendere(s, ["rights"]); }));
  if (id === "rights") d.append(el("div", "sfoffnote", "These are rules Claude Code gets at its start, not a lock in Fleet's server."));
  if (frei && id === "succession") d.append(opts(SCHWELLEN.map((n) => ({ v: String(n), wort: `At ${n} %` })), String(w.schwelle), (v) => { w.schwelle = Number(v); aendere(s, ["succession"]); }));
  if (id === "skills") {
    const f = fn ?? fj, tog = (l: string[], x: string) => { const i = l.indexOf(x); if (i >= 0) l.splice(i, 1); else l.push(x); aendere(s, ["skills"]); };
    d.append(art("Plugins", "a plugin brings its own skills, agents and tools", chips(plugins(f).filter((x) => x.an).map((x) => ({ n: x.name,
      klein: [x.skills ? mehrzahl(x.skills, "skill") : "", x.agenten ? mehrzahl(x.agenten, "agent") : "", x.mcp ? "server" : ""].filter(Boolean).join(", "),
      aus: w.pluginsAus.includes(x.name), tu: frei ? () => tog(w.pluginsAus, x.name) : undefined })))));
    d.append(art("Subagents", "helpers it can hand part of the work to", chips(eigene(f, "Agenten").map((x) => ({ n: x, aus: w.agentenAus.includes(x), tu: frei ? () => tog(w.agentenAus, x) : undefined })))));
    d.append(art("Built-in tools", "each one's description goes with every request", chips(TOOLS.map((x) => ({ n: x, aus: !!w.tools && !w.tools.includes(x),
      tu: frei ? () => { const l = w.tools ?? [...TOOLS]; const i = l.indexOf(x); if (i >= 0) l.splice(i, 1); else l.push(x); w.tools = l.length === TOOLS.length ? null : TOOLS.filter((t) => l.includes(t)); aendere(s, ["skills"]); } : undefined })))));
    d.append(art("Your skills", "in ~/.claude, by name; each loads when it fits", chips(eigene(f, "Skills").map((x) => ({ n: x, aus: false })))));
  }
  if (id === "connectors") {
    d.append(art("From your plugins", "their servers start with it", chips(plugins(fn ?? fj).filter((x) => x.an && x.mcp).map((x) => ({ n: x.name, aus: w.pluginsAus.includes(x.name) })))));
    d.append(el("div", "sfoffnote", "Connectors of your claude.ai account come along as they are; Fleet can't switch a single one off yet."));
  }
  if (id === "hooks") d.append(art("Your hooks", "", chips(hookSkripte(fj).map((x) => ({ n: x, aus: false })))), el("div", "sfoffnote", "They go only all together; off also stops your status line."));
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
    } else if (i && id === "branch") {
      zeile("Starts from", el("code", "", i.branch ?? "HEAD"), ...(i.last ? [" at ", el("code", "", i.last.hash)] : []));
      zeile("Its commits", "none yet; each one shows here and on the board as it works");
      zeile("Land", landetNicht(i) ? "only when you say so, in one commit and without a check: this repo has no merge check (ci/merge-check.ts)" : "brings them to main when you say so");
      zeile("Your checkout", `stays as it is${i.dirty ? `, with its ${mehrzahl(i.dirty, "open change")}` : ""}`);
      d.append(dl);
    }
  }
  if (z.fremd.length && ["model", "permissions", "rights", "succession", "rules", "skills"].includes(id)) d.append(el("div", "sfoffnote", "This agent carries it as it was saved. Copy it to change it."));
  const imBrief = knopf("sftoright", [schmal() ? "Show it in the start brief ›" : "Marked in the start brief on the right ›"], () => { z.brief = true; render(); requestAnimationFrame(() => zeigeImBrief(s)); });
  d.append(imBrief);
  return d;
}

// RIGHT: the start brief
function spalteBrief(s: St, p: ReturnType<typeof plaene> | null): HTMLElement {
  const z = s.sitz, col = el("div", `sfcol sfhood${z.brief ? " show" : ""}`);
  col.setAttribute("role", "complementary");
  col.setAttribute("aria-label", "Start brief");
  if (!p) return col;
  const fj = fassungVon(p.a), fn = fassungVon(p.n), repo = s.repo ? baseName(s.repo) : "";
  const eigen = eigenesSetup(fn ?? fj);
  const hh = el("div", "sfhh");
  const h = el("h3", "", "Start brief");
  h.append(knopf("sfcl sfhclose", ["✕"], () => { z.brief = false; render(); }, "Close"));
  const sub = el("p", "");
  sub.append("What Claude reads when it starts, word for word and in this order. ", ...(eigen ? ["Compared with ", el("code", "", "claude"), ` in ${repo} by hand.`] : [`Compared with a plain start in ${repo}.`]));
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
  hh.append(h, sub, bar);
  const hb = el("div", "sfhb");
  hb.dataset.scroll = "brief";
  col.append(hh, hb);
  if (!fj || !fn) { hb.append(el("div", "sfleer", p.fehler ? `Not readable: ${p.fehler}` : "Reading …")); return col; }
  const i = infoDa(s), w = z.wahl;
  const brief = startbrief(fj, fn, { repo: s.repo ?? "", gitNormal: i ? gitText(i, null) : null, gitJetzt: i ? gitText(i, w.branch !== null ? `<its branch${w.branch.trim() ? ` “${w.branch.trim()}”` : ""}>` : null) : null,
    aufgabe: w.aufgabe, hooksAus: !w.hooks, ccTokens: ccTokens(p.a) });
  const n = geaendert(brief);
  col.classList.toggle("laedt", p.laedt);
  // the banner follows the choice at once; until the preview of that choice is read, the brief says it is comparing, not what it was
  // its parts carry keys, so a line that comes or goes doesn't shift the blocks below it into others (src/dom-morph.ts)
  if (p.laedt) { const x = el("div", "sfleer", "Comparing …"); x.dataset.key = "summe"; hb.append(x); }
  else if (!n) { const x = el("div", "sfnone"); x.dataset.key = "summe"; x.append(el("span", "sfok", "✓"), ...(eigen ? ["Nothing differs from ", el("code", "", "claude"), " by hand."] : ["Nothing differs from a plain start here."]), " Click a file to read it."); hb.append(x); }
  let nr = 0;
  const sek = (titel: string, sub2: string, bl: Block[], zaehlen: boolean) => {
    const out = bl.map((b) => blockEl(s, b, zaehlen ? nr++ : null, false)).filter((x): x is HTMLElement => x !== null);
    if (!out.length) return;
    const sec = el("div", "sfbsec"), h4 = el("h4", "");
    sec.dataset.key = titel;
    h4.append(titel, el("span", "", sub2));
    sec.append(h4, ...out);
    hb.append(sec);
  };
  if (!(z.nur && !n)) {
    sek("Its instructions", "with every request", brief.anweisungen, true);
    sek("Its first turn", "read once, at the start", brief.ersteNachricht, true);
    sek("Set at the start", "settings, no text", brief.einstellungen, false);
  }
  // outside Fleet's own repo the guides come as text only, without a folder (server/sitz-wissen.ts)
  const macht = [...(w.bibliothek && !eigen ? ["a folder with its guides, in Fleet's own state"] : []), ...(w.notizbuch && w.branch !== null ? ["a notebook for its branch"] : []),
    ...(w.branch !== null ? ["a git worktree on a new branch, next to your checkout"] : [])];
  const schluss = el("div", "sfclosing"), t = el("div", "");
  schluss.dataset.key = "schluss";
  t.append("None of your files change: your CLAUDE.md, settings, skills and hooks stay as they are.");
  if (macht.length) { const ul = el("ul", ""); for (const m of macht) ul.append(el("li", "", `Fleet makes ${m}.`)); t.append(ul); }
  schluss.append(el("span", "sfok", "✓"), t);
  hb.append(schluss);
  return col;
}
const zeichenWort = { "+": "added", "−": "left out", "~": "changed" } as const;
function blockEl(s: St, b: Block, nr: number | null, kind: boolean): HTMLElement | null {
  const z = s.sitz;
  if (z.nur && !b.zeichen && !kind && !b.kinder?.some((k) => k.zeichen)) return null;
  const offen = z.falten.has(b.key), gruppe = !!b.kinder;
  const kann = !gruppe && (b.text !== null || b.diff !== null);
  const hl = !kind && ((z.offen !== null && b.bausteine.includes(z.offen)) || (z.heiss?.some((x) => b.bausteine.includes(x)) ?? false));
  const box = el("div", `sfbk o-${b.herkunft}${gruppe ? " grp" : ""}${b.zeichen ? " chg" : ""}${offen ? " open" : ""}${hl ? " hl" : ""}`);
  box.dataset.ob = b.key;
  const kopf = el("div", `sfbk-h${kann ? " can" : ""}`);
  if (kann) {
    kopf.setAttribute("role", "button");
    kopf.tabIndex = 0;
    kopf.setAttribute("aria-expanded", String(offen));
    kopf.onclick = () => { if (offen) z.falten.delete(b.key); else z.falten.add(b.key); render(); };
    kopf.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } };
  }
  const p = el("span", "sfbk-p", b.pfad);
  p.title = b.pfad;
  const groesse = b.key === "cc" ? "" : b.bytes ? KB(b.bytes) : "";
  const dm = b.zeichen ? el("span", "sfdm", b.zeichen) : el("span", "");
  if (b.zeichen) dm.title = `${zeichenWort[b.zeichen]}, compared with claude by hand`;
  const ox = el("span", "sfox");
  if (kann) ox.append(icon("chevron"));
  const l = el("span", "sfbk-l");
  l.append(el("span", "sfog", b.wer), b.zeichen === "−" && b.text === null ? `left out: ${b.satz}` : b.satz);
  kopf.append(...(kind ? [] : [nr !== null ? el("span", "sfnum", String(nr + 1)) : el("span", "")]), p, el("span", "sfbk-z", groesse), dm, ox, l);
  box.append(kopf);
  const zeile = (zz: string, t: string) => { const r = el("div", `sfln${zz === "+" ? " add" : zz === "−" ? " del" : ""}`); r.append(el("span", "sfg", zz === " " ? "" : zz), el("span", "sft", t || " ")); return r; };
  if (b.diff && !gruppe) {
    const alle = b.diff, sicht = alle.filter((x) => x.t.trim()), zeig = offen ? alle : sicht.filter((x) => x.z !== " ").slice(0, 4);
    const body = el("div", "sfbk-b");
    body.append(...zeig.map((x) => zeile(x.z, x.t)));
    const rest = sicht.filter((x) => x.z !== " ").length - zeig.length;
    if (!offen && rest > 0) body.append(knopf("sfmore", [`… ${mehrzahl(rest, "more line")}`], () => { z.falten.add(b.key); render(); }));
    box.append(body);
  } else if (offen && b.text !== null) {
    const body = el("div", "sfbk-b");
    body.append(...zeilen(b.text).map((t) => zeile(" ", t)));
    box.append(body);
  }
  if (b.kinder) {
    const kids = el("div", "sfkids");
    for (const k of b.kinder) { const x = blockEl(s, k, null, true); if (x) kids.append(x); }
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

// ---------- save, share, start ----------
async function speichere(s: St, name: string): Promise<void> {
  const z = s.sitz, n = name.trim();
  if (!n) return;
  const aendern = !!z.agent?.aenderbar;
  const a = await agentAntwort(s, await post(aendern ? `/api/agenten/${encodeURIComponent(z.agent!.id)}` : "/api/agenten", { name: n, wahlen: wahlenVon(z.wahl, standardVon(s)) }, aendern ? "PUT" : "POST"));
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
  const { goal: _g, ...felder } = tuer(w, standardVon(s));
  const wahl = ganz ? {} : felder;
  const dreier = ganz ? {} : { ...(w.model ? { model: w.model } : {}), ...(w.effort ? { effort: w.effort } : {}) };
  const agent = ganz ? { agent: z.agent!.id } : {};
  const slot = freierPlatz(s);
  const r: Antwort = w.branch !== null
    ? await starte({ tuer: "branch", repo: s.repo, name: w.branch.trim(), punkte: [], ziel, dreier, wahl, ...agent })
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
