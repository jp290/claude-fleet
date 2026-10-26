// K15 · THE STATE OF THE START WINDOW and what it reads from the board: the pinned folders, what /api/dirinfo says about a repo, the
// folder picker of "Add repo", and the founding plan (GET /api/founding-plan), read once per role, repo and switch. src/k15-entwurf.ts
// opens the window, src/start-fenster.ts draws it.
import { api, flotte, baseName, validAnswer } from "./k15-haupt";
import type { DirInfoResp } from "./client";
import type { Rechte } from "../session-rechte";
import type { Answer } from "./founding";
import type { Shell } from "./shell";
import type { PlanRolle, Schalter } from "./k15-entwurf-modell";
import type { Katalog } from "./k15-agent";
import type { Eingang } from "./k15-lader";
import type { FensterStand } from "./start-fenster";
import { echt } from "./start-brief";

export type PlanStand = { a: Answer } | { fehler: string } | "laedt";
export type InfoStand = DirInfoResp | { fehler: string } | "laedt";
export interface Ordner { pfad: string; liste: { path: string; parent: string | null; dirs: string[]; repos: string[]; git: boolean } | null; fehler: string | null; seq: number }

export interface St {
  shell: Shell;
  // the repo whose founding plan is read; the env of the instance (undefined = being read, null = not readable)
  repo: string | null; env: { migratePct: number; laneMigratePct: number } | null | undefined; plaene: Map<string, PlanStand>;
  // the agents of the server with their models (GET /api/harnesses, src/k15-agent.ts); undefined = being read, null = not readable
  katalog: Katalog | null | undefined;
  // the pinned folders (null = being read), what /api/dirinfo says per repo, the open "New session in" menu and its folder picker
  pins: string[] | null; infos: Map<string, InfoStand>; repoMenu: boolean; ordner: Ordner | null;
  // when the window last warned about unsaved text (k15-repo.ts#menueZu); the timer of the toast
  warnAm: number; toastT: number;
  // where the window came from (a free place, the + of a repo, ⎇+ on a session; null = #k15) and the state of the start window
  eingang: Eingang | null; sitz: FensterStand;
}
export let S: St | null = null;
export const setzeS = (s: St | null): void => { S = s; };
let zeichner: () => void = () => undefined;
export const beimZeichnen = (f: () => void): void => { zeichner = f; };
export const render = (): void => zeichner();

export const plural = (n: number, eins: string, mehr: string): string => `${n} ${n === 1 ? eins : mehr}`;
export const tilde = (p: string): string => p.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");

// ein Satz unten im Fenster; mit `aktion` steht ein Knopf dahinter (Rückgängig) und der Satz bleibt länger
export function toast(text: string, aktion?: { wort: string; tu: () => void }): void {
  const s = S;
  const win = s?.shell.root.querySelector<HTMLElement>(".shellwin");
  if (!s || !win) return;
  win.querySelector(".k15toast")?.remove();
  const t = document.createElement("div");
  t.className = "k15toast";
  t.textContent = text;
  t.setAttribute("role", "status");
  if (aktion) {
    const b = document.createElement("button");
    b.className = "k15toastb";
    b.textContent = aktion.wort;
    b.onclick = () => { t.remove(); aktion.tu(); };
    t.append(" ", b);
  }
  win.append(t);
  clearTimeout(s.toastT);
  s.toastT = window.setTimeout(() => t.remove(), aktion ? 9000 : 4200);
}

// DIE REPOS (Z32): die mit laufender Session wie im Startfenster (src/founding.ts#repoList), claude-fleet zuerst, dahinter die
// gepinnten ohne Session (GET /api/dirs → pins). Ein gepinnter Ordner, den /api/dirinfo nicht als Git-Repo kennt, steht nicht darin;
// das gewählte Repo steht immer darin.
export interface RepoZeile { repo: string; sessions: number; gepinnt: boolean }
export function repoZeilen(s: St | null): RepoZeile[] {
  const zahl = new Map<string, number>();
  const pins = s?.pins ?? [];
  // a running session names its folder by the real path (/private/tmp/…), a pin by the one it was given: one repo, one row
  const wie = (p: string): string => pins.find((x) => echt(x) === echt(p)) ?? (s?.repo && echt(s.repo) === echt(p) ? s.repo : p);
  for (const x of flotte()) if (x.cwd) { const r = wie(x.repo ?? x.cwd); zahl.set(r, (zahl.get(r) ?? 0) + 1); }
  const laufend = [...zahl].sort((a, b) => Number(baseName(b[0]) === "claude-fleet") - Number(baseName(a[0]) === "claude-fleet") || b[1] - a[1])
    .map(([repo, n]) => ({ repo, sessions: n, gepinnt: pins.includes(repo) }));
  const keinGit = (p: string) => { const i = s?.infos.get(p); return typeof i === "object" && "git" in i && !i.git; };
  const ohne = pins.filter((p) => !zahl.has(p) && (p === s?.repo || !keinGit(p))).map((repo) => ({ repo, sessions: 0, gepinnt: true }));
  const gewaehlt = s?.repo && ![...zahl.keys(), ...pins].some((r) => echt(r) === echt(s.repo!)) ? [{ repo: s.repo, sessions: 0, gepinnt: false }] : [];
  return [...laufend, ...ohne, ...gewaehlt];
}
export const repos = (): string[] => repoZeilen(S).map((r) => r.repo);
// was /api/dirinfo über ein Repo sagt, einmal je Öffnen gelesen
export function info(s: St, repo: string): InfoStand {
  const da = s.infos.get(repo);
  if (da) return da;
  s.infos.set(repo, "laedt");
  void api(`/api/dirinfo?path=${encodeURIComponent(repo)}`).then(async (res) => {
    const j = (await res.json().catch(() => null)) as DirInfoResp | null;
    return res.ok && j ? j : { fehler: j?.error ?? `Antwort ${res.status}` };
  }).catch((e: unknown) => ({ fehler: e instanceof Error ? e.message : "Server not reachable" })).then((st) => {
    if (S !== s) return;
    s.infos.set(repo, st);
    render();
  });
  return "laedt";
}
const pinsAus = (j: unknown): string[] | null => j && typeof j === "object" && "pins" in j && Array.isArray(j.pins) ? j.pins.filter((x): x is string => typeof x === "string") : null;
// die gepinnten Ordner stehen in jeder Antwort von /api/dirs (server.ts#listDirs)
export async function liesPins(s: St): Promise<void> {
  const res = await api("/api/dirs?path=~").catch(() => null);
  const j: unknown = res?.ok ? await res.json().catch(() => null) : null;
  if (S !== s) return;
  s.pins = pinsAus(j) ?? [];
  render();
}
// pinnen und entpinnen (Prüfung Punkt 7): Entpinnen gilt auf allen Geräten, darum steht Rückgängig im Satz; das holt den Pin und das
// gewählte Repo zurück (`zurueck`). Der Server hält höchstens 20 Pins und lässt beim 21. den ältesten fallen (server.ts MAX_PINS): Wer
// so herausfällt, steht im Satz.
export async function pinne(s: St, pfad: string, an: boolean, zurueck?: string | null): Promise<void> {
  const vorher = s.pins ?? [];
  const repoVorher = s.repo;
  const res = await api("/api/pins", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: pfad, on: an }) }).catch(() => null);
  const j: unknown = res ? await res.json().catch(() => null) : null;
  if (S !== s) return;
  const pins = pinsAus(j);
  if (!res?.ok || !pins) { toast(`${baseName(pfad)}: ${j && typeof j === "object" && "error" in j ? String(j.error) : "Fleet did not save that"}.`); return; }
  s.pins = pins;
  const raus = vorher.filter((x) => x !== pfad && !pins.includes(x));
  const verdraengt = raus.length ? ` The list holds ${pins.length} repos: ${raus.map(baseName).join(", ")} dropped out for it.` : "";
  if (an) {
    s.ordner = null;
    s.repoMenu = false;
    s.repo = zurueck === undefined ? pfad : zurueck;
    toast(zurueck === undefined
      ? `New sessions now start in ${baseName(pfad)}. It stays in the list, without a session too and on your other devices.${verdraengt}`
      : `${baseName(pfad)} is back in the list.${verdraengt}`);
  } else {
    if (s.repo === pfad && !flotte().some((x) => x.cwd && (x.repo ?? x.cwd) === pfad)) s.repo = null;
    toast(`${baseName(pfad)} is removed from the list, on your other devices too. The folder itself stays as it is.`,
      { wort: "Undo", tu: () => { void pinne(s, pfad, true, repoVorher); } });
  }
  render();
}
// die Ordnerwahl von „Repo hinzufügen“: eine Ebene je Schritt über /api/dirs; wählbar ist ein Git-Repo
export async function oeffneOrdner(s: St, pfad: string): Promise<void> {
  const seq = (s.ordner?.seq ?? 0) + 1;
  s.ordner = { pfad, liste: null, fehler: null, seq };
  render();
  const res = await api(`/api/dirs?path=${encodeURIComponent(pfad)}`).catch(() => null);
  const j = (res ? await res.json().catch(() => null) : null) as { path?: string; parent?: string | null; dirs?: string[]; repos?: string[]; git?: boolean; error?: string } | null;
  if (S !== s || s.ordner?.seq !== seq) return;
  s.ordner = res?.ok && j && typeof j.path === "string" && Array.isArray(j.dirs)
    ? { ...s.ordner, pfad: j.path, liste: { path: j.path, parent: j.parent ?? null, dirs: j.dirs, repos: j.repos ?? [], git: j.git === true } }
    : { ...s.ordner, fehler: j?.error ?? `The server answered ${res?.status ?? "nothing"} for this folder.` };
  render();
}

// DER GRÜNDUNGSPLAN je Rolle, Agent und Schalter, einmal gelesen und gemerkt; ein abgelehnter Schalter kommt als `fehler`. Agent, Modell
// und Effort nimmt die Route wie ein Start (server.ts#foundingPlanAnswer: harness, model, effort); was nicht gesetzt ist, fehlt in der
// Adresse, dann gilt der Standard der Rolle
export interface Dreier { harness?: string; model?: string; effort?: string }
// was die Öffnung außer dem Plan noch liest (server.ts#startVonAdresse): damit die Vorschau die Fassung DIESES Starts rechnet und der gezeigte
// Hash der ist, der läuft. Rechte als JSON, das Profil als Kennung, die Bibliothek nur für einen Start ohne Plan.
export interface Dazu { rechte?: Rechte; profil?: string; bibliothek?: boolean; sitz?: string; schwelle?: number }
export const planUrl = (repo: string, rolle: PlanRolle, sch: Schalter, d: Dreier = {}, dazu: Dazu = {}): string => {
  // `anlass=neu`: die Antwort trägt den fassungsHash, den die Tür beim Start gegenprüft (server.ts#fassungGezeigtPruefung)
  const q = new URLSearchParams({ repo, role: rolle, anlass: "neu" });
  if (d.harness) q.set("harness", d.harness);
  if (d.model) q.set("model", d.model);
  if (d.effort) q.set("effort", d.effort);
  if (dazu.rechte) q.set("rechte", JSON.stringify(dazu.rechte));
  if (dazu.profil) q.set("profil", dazu.profil);
  if (dazu.sitz) q.set("sitz", dazu.sitz);
  if (dazu.bibliothek !== undefined) q.set("bibliothek", String(dazu.bibliothek));
  if (dazu.schwelle !== undefined) q.set("schwelle", String(dazu.schwelle));
  const b = Object.entries(sch).map(([id, v]) => `${id}=${v}`).sort().join(",");
  if (b) q.set("bausteine", b);
  return `/api/founding-plan?${q}`;
};
export async function lies(url: string): Promise<{ a: Answer } | { fehler: string }> {
  try {
    const res = await api(url);
    const j: unknown = await res.json().catch(() => null);
    if (res.ok && validAnswer(j)) return { a: j };
    return { fehler: j && typeof j === "object" && "error" in j ? String(j.error) : `Antwort ${res.status}` };
  } catch (e) {
    return { fehler: e instanceof Error ? e.message : "Server not reachable" };
  }
}
// ein Fehler bleibt nicht für immer (Prüfung Punkt 10): Nach FEHLER_MS liest das nächste Zeichnen den Plan neu, früher nicht, damit ein
// dauerhafter Fehler keine Schleife aus Zeichnen und Lesen wird
const FEHLER_MS = 8000;
const fehlerAm = new WeakMap<object, number>();
export function hole(s: St, url: string): PlanStand {
  const da = s.plaene.get(url);
  if (da && !(typeof da === "object" && "fehler" in da && Date.now() - (fehlerAm.get(da) ?? 0) > FEHLER_MS)) return da;
  s.plaene.set(url, "laedt");
  void lies(url).then((st) => {
    if (S !== s) return;
    if ("fehler" in st) fehlerAm.set(st, Date.now());
    s.plaene.set(url, st);
    render();
  });
  return "laedt";
}
export const antwort = (st: PlanStand): Answer | null => typeof st === "object" && "a" in st ? st.a : null;
