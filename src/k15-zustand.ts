// K15 ENTWURF D · der Zustand des Fensters und was alle Spalten aus dem Gründungsplan ableiten (src/k15-entwurf.ts zeichnet, die
// Spalten liegen in src/k15-spalte1.ts … src/k15-spalte4.ts). Der Plan kommt vom Server (GET /api/founding-plan), je Rolle, Repo
// und Schalter einmal gelesen.
import { api, flotte, baseName, OMIT_SAY, bausteinName, validAnswer } from "./k15-haupt";
import type { DirInfoResp } from "./client";
import type { Rechte } from "../session-rechte";
import type { Answer, Baustein } from "./founding";
import { nativVon, type WerPlan } from "./k15-wer";
import type { Shell } from "./shell";
import { modelLabel } from "./modelname";
import {
  EFFORT_WORT, GRUPPEN, alle, hatRegler, reglerVon, schalterVon, schwelleVon, stufenSchalter, traegerVon, umfangVon, wirksam,
  exportObjekt, type Ebene, type Env, type GruppeId, type Konst, type PlanRolle, type Position, type Profil, type Regler, type Schalter, type Stufe,
} from "./k15-entwurf-modell";
import { fassungenImport, type TextFassung } from "./k15-wortlaut";
import { agentVon, agentWort, passtEffort, passtModell, standardAgent, type Katalog } from "./k15-agent";
import { packsImport, type PackEntwurf } from "./k15-kontextpack";
import { MAX_FASSUNGEN, MAX_PACKS, MAX_PROFILE, importKonst, profilAus } from "./k15-import";
import { FREIGABE_ROUTE, MAX_KONSTELLATIONEN, SPEICHER_ROUTE } from "./k15-speicher";
import type { Ablauf } from "./k15-agentmd";
import type { Eingang } from "./k15-lader";
import type { StartStand } from "./k15-start";
import type { SitzStand } from "./sitzung";
import type { SitzDarf } from "./sitz";

export type QuelleId = "landet" | "brief" | "packs" | "einst" | "rechte" | "wege" | "bst" | "auto";
// DER DETAILGRAD (Owner 12:3x) zeigt die Gruppen zu oder auf; was sonst erst beim Darüberfahren erscheint, zeigt „[Zitat entfernt]“
// (Owner 16.10.: „[Zitat entfernt]“). Die frühere Stufe „[Zitat entfernt]“ ist darin
// aufgegangen: Sie tat für die Erklärungen dasselbe, was der Knopf jetzt überall tut.
export type Detail = "gruppen" | "bausteine";
export type Sel = { art: "pos"; id: string } | { art: "profil"; id: string };
export type PlanStand = { a: Answer } | { fehler: string } | "laedt";
export type InfoStand = DirInfoResp | { fehler: string } | "laedt";
export interface Ordner { pfad: string; liste: { path: string; parent: string | null; dirs: string[]; repos: string[]; git: boolean } | null; fehler: string | null; seq: number }

export interface St {
  shell: Shell; konst: Konst[]; profile: Profil[]; k: Konst; sel: Sel; quelle: QuelleId; offen: Set<string>;
  exp: boolean; ebene: Ebene; voll: boolean; tief: number; neuAb: number; profilNeu: Set<string>; konstNeu: Set<string>; toastT: number;
  // die Spalte, an der man gerade arbeitet, der Baustein, den Spalte 4 zeigt, der Schritt des Rundgangs (null = aus)
  aktiv: number; bst: string | null; tour: number | null; detail: Detail; alles: boolean;
  // das Repo, dessen Gründungsplan gelesen wird; die Env der Instanz (undefined = wird gelesen, null = nicht lesbar)
  repo: string | null; env: Env | null | undefined; fleetModell: string | null; plaene: Map<string, PlanStand>;
  // die Agenten des Servers mit ihren Modellen (GET /api/harnesses, src/k15-agent.ts); undefined = wird gelesen, null = nicht lesbar
  katalog: Katalog | null | undefined;
  // die gepinnten Ordner (null = wird gelesen), was /api/dirinfo je Repo sagt, die offene Auswahl „Neue Session in“ und ihre Ordnerwahl
  pins: string[] | null; infos: Map<string, InfoStand>; repoMenu: boolean; ordner: Ordner | null;
  // eigene Fassungen je Abschnitt und Kontextpacks als Entwurf (auf dem Server, src/k15-speicher.ts; `speicher` sagt, ob er gelesen
  // ist); welcher Abschnitt im Editor offen ist und welcher Pack gerade bearbeitet wird
  // `bearbeiteText` ist der Text im offenen Editor, solange er nicht gesichert ist: so übersteht er ein Neuzeichnen
  fassungen: Map<string, TextFassung>; bearbeite: string | null; bearbeiteText: string | null; packs: PackEntwurf[]; packEdit: PackEntwurf | null;
  // der Ablauf „Deine Agent-MD“ (src/k15-agentmd.ts), null = zu; wann zuletzt vor ungesichertem Text gewarnt wurde (k15-repo.ts#menueZu)
  ablauf: Ablauf | null; warnAm: number; speicher: "laedt" | "da" | { fehler: string };
  // die eigenen Konstellationen, wie der Server sie zuletzt bestätigt hat, je Kennung (konstForm); was nur im Fenster geändert ist, steht
  // nicht darin, so trägt jedes Sichern von Fassungen und Packs nur gespeicherte Aufbauten mit
  konstGespeichert: Map<string, Record<string, unknown>>;
  // woher das Fenster kam (ein freier Platz, das + eines Repos, ⎇+ an einer Session; null = #k15) und was der Start braucht
  eingang: Eingang | null; start: StartStand;
  // welche Ansicht das Fenster zeigt: „sitzung“ (eine Session aufsetzen, src/sitzung.ts) oder „aufbau“ (die vier Spalten unten); ihr Stand
  ansicht: "sitzung" | "aufbau"; sitz: SitzStand;
}
export let S: St | null = null;
export const setzeS = (s: St | null): void => { S = s; };
let zeichner: () => void = () => undefined;
export const beimZeichnen = (f: () => void): void => { zeichner = f; };
export const render = (): void => zeichner();

export const SCHMAL = matchMedia("(max-width: 1200px), ((pointer: coarse) and (max-height: 500px))");
export const plural = (n: number, eins: string, mehr: string): string => `${n} ${n === 1 ? eins : mehr}`;
export const tilde = (p: string): string => p.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");
export const profilVon = (s: St, id: string): Profil => s.profile.find((p) => p.id === id) ?? s.profile[0];
export function gewaehlt(s: St): { q: Position | null; p: Profil } {
  const q = s.sel.art === "pos" ? (alle(s.k.wurzeln).find((x) => x.id === s.sel.id) ?? null) : null;
  return { q, p: profilVon(s, q ? q.profil : s.sel.id) };
}

// eine Auswahl wechselt: Spalte `tief` zeigt sich am Handy, die Spalten ab `neuAb` blenden weich neu ein
export function gehe(tief: number, neuAb: number): void {
  const s = S;
  if (!s) return;
  s.tief = tief;
  s.aktiv = tief;
  s.neuAb = neuAb;
  render();
}
// Erklärung einer Zeile auf- und zuklappen (Info-Knopf, Antippen am Handy); Hover und Fokus zeigen sie ohnehin
export function zeige(key: string): void {
  const s = S;
  if (!s) return;
  if (s.offen.has(key)) s.offen.delete(key); else s.offen.add(key);
  render();
}
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

// UNGESICHERTER TEXT (Prüfung Punkt 2): Wer schließt, während irgendwo getippter Text ungesichert ist, bekommt einen Satz und schließt
// erst beim zweiten Mal; danach ist der Text verworfen. So geht nichts mit einem einzigen Esc oder Klick daneben verloren, und das Fenster
// lässt sich trotzdem immer schließen (src/shell.ts#setCloseGuard: „The guard must always offer a way out“).
const WARN_MS = 6000;
export function verwirft(s: St, wo: string): boolean {
  if (s.warnAm && Date.now() - s.warnAm < WARN_MS) { s.warnAm = 0; return true; }
  s.warnAm = Date.now();
  toast(`Ungesicherter Text ${wo}. Sichere ihn, oder schließ noch einmal, dann ist er verworfen.`);
  return false;
}

// EIGENE FASSUNGEN, PACK-ENTWÜRFE UND PROFILE MIT EIGENER AGENT-MD liegen auf dem Server (src/k15-speicher.ts; Owner 16.10. 09:1x:
// „[Zitat entfernt]“). Was davor im Browser lag (EIGENES_KEY, davor ALT_KEY), kommt beim
// ersten Öffnen einmal herüber, und ein Satz sagt es; aus dem Browser verschwindet es erst, wenn der Server es bestätigt hat. Eine
// Fassung mit dem Schlüssel von vor dem 16.10. (ohne Profil, k15-wortlaut.ts#schluessel) passt keinem Profil eindeutig: Sie zählt
// `alteFassungen` und wird nicht übernommen.
const EIGENES_KEY = "fleet.k15.eigenes";
const ALT_KEY = "fleet.k15.merkstellen";
interface Eigenes { fassungen: TextFassung[]; packs: PackEntwurf[]; eigeneProfile: Profil[]; alteFassungen: number; konstellationen: Record<string, unknown>[] }
// liest die gespeicherte Form, vom Server oder aus dem Browser; was nicht passt, fällt einzeln heraus
function eigenesAus(o: unknown): Eigenes {
  const r: Record<string, unknown> = o && typeof o === "object" ? { ...o } : {};
  const alle = fassungenImport(r.fassungen, Date.now()).fassungen;
  const fassungen = alle.filter((x) => x.abschnitt.includes("|")).slice(0, MAX_FASSUNGEN);
  const packs = packsImport(r.packs, Date.now()).packs.slice(0, MAX_PACKS);
  const eigeneProfile = (Array.isArray(r.profile) ? r.profile : []).map(profilAus).filter((p): p is Profil => p !== null && !!p.datei).slice(0, MAX_PROFILE);
  const konstellationen = (Array.isArray(r.konstellationen) ? r.konstellationen : []).filter((x): x is Record<string, unknown> =>
    !!x && typeof x === "object" && !Array.isArray(x) && typeof x.id === "string" && typeof x.name === "string").slice(0, MAX_KONSTELLATIONEN);
  return { fassungen, packs, eigeneProfile, alteFassungen: alle.length - fassungen.length, konstellationen };
}
function ausDemBrowser(): Eigenes | null {
  try {
    const t = localStorage.getItem(EIGENES_KEY) ?? localStorage.getItem(ALT_KEY);
    return t === null ? null : eigenesAus(JSON.parse(t));
  } catch { return null; }
}
function ausDemBrowserWeg(): void {
  try { localStorage.removeItem(EIGENES_KEY); localStorage.removeItem(ALT_KEY); } catch { /* ohne Speicher liegt dort nichts */ }
}
// die Form, die eigenesAus liest: die Version heißt dort `version`
const speicherForm = (f: readonly TextFassung[], packs: readonly PackEntwurf[], profile: readonly Profil[], konstellationen: readonly object[]): string =>
  JSON.stringify({ fassungen: f.map((x) => ({ ...x, version: x.v })), packs: packs.map((p) => ({ ...p, version: p.v })),
    profile: profile.map((p) => ({ ...p, version: p.v })), konstellationen });
// der Stand von jetzt, nicht der beim Aufruf: so trägt jedes Senden alles, was bis dahin geändert ist
// was der Server beim letzten Sichern je Konstellation als Fassung meldete (server/konst-fassungen.ts): Hash und ob sie neu ist
export let letzteFassungen: Readonly<Record<string, { hash: string; neu: boolean }>> = {};
async function sende(s: St): Promise<void> {
  const res = await api(SPEICHER_ROUTE, { method: "PUT", headers: { "content-type": "application/json" },
    body: speicherForm([...s.fassungen.values()], s.packs, s.profile.filter((p) => !!p.datei), [...s.konstGespeichert.values()]) });
  const j: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const f = j && typeof j === "object" && "fassungen" in j && j.fassungen && typeof j.fassungen === "object" ? j.fassungen : {};
    letzteFassungen = Object.fromEntries(Object.entries(f).filter((e): e is [string, { hash: string; neu: boolean }] =>
      !!e[1] && typeof e[1] === "object" && "hash" in e[1] && typeof e[1].hash === "string" && "neu" in e[1] && typeof e[1].neu === "boolean"));
    return;
  }
  throw new Error(j && typeof j === "object" && "error" in j && typeof j.error === "string" ? j.error : `Antwort ${res.status}`);
}
const grundVon = (e: unknown): string => e instanceof Error ? e.message : "Server nicht erreichbar";
// alles geht der Reihe nach: erst das Lesen beim Öffnen, dann jedes Sichern; ein späterer Stand wird nie von einem früheren überholt
let reihe: Promise<unknown> = Promise.resolve();

// BEIM ÖFFNEN: was der Server hat, dazu was nur im Browser liegt (bei gleichem Schlüssel gilt der Server); was du währenddessen schon
// geändert hast, gilt vor beidem. Ließ sich der Server nicht lesen, sichert das Fenster nichts, damit es nichts Gespeichertes überschreibt
export function ladeEigenes(s: St): void {
  reihe = reihe.then(() => lade(s));
}
async function lade(s: St): Promise<void> {
  let server: Eigenes;
  try {
    const res = await api(SPEICHER_ROUTE);
    const j: unknown = await res.json().catch(() => null);
    const o: Record<string, unknown> = j && typeof j === "object" ? { ...j } : {};
    if (!res.ok) throw new Error(typeof o.error === "string" ? o.error : `Antwort ${res.status}`);
    server = eigenesAus(o.eigenes);
  } catch (e) {
    s.speicher = { fehler: grundVon(e) };
    if (S !== s) return;
    toast(`Deine eigenen Profile, Fassungen, Packs und Konstellationen ließen sich nicht vom Server lesen (${grundVon(e)}). Bis zum nächsten Öffnen sichert dieses Fenster nichts.`);
    render();
    return;
  }
  const lokal = ausDemBrowser();
  const fKeys = new Set(server.fassungen.map((x) => x.abschnitt)), pkIds = new Set(server.packs.map((x) => x.id)), pIds = new Set(server.eigeneProfile.map((x) => x.id));
  const neuF = (lokal?.fassungen ?? []).filter((x) => !fKeys.has(x.abschnitt));
  const neuPk = (lokal?.packs ?? []).filter((x) => !pkIds.has(x.id));
  const neuP = (lokal?.eigeneProfile ?? []).filter((x) => !pIds.has(x.id));
  const jetztP = s.profile.filter((p) => !!p.datei);
  const jetztIds = new Set(jetztP.map((p) => p.id)), jetztPk = new Set(s.packs.map((x) => x.id));
  s.fassungen = new Map([...[...server.fassungen, ...neuF].map((x): [string, TextFassung] => [x.abschnitt, x]), ...s.fassungen]);
  s.packs = [...[...server.packs, ...neuPk].filter((x) => !jetztPk.has(x.id)), ...s.packs];
  s.profile = [...s.profile.filter((p) => !p.datei), ...[...server.eigeneProfile, ...neuP].filter((p) => !jetztIds.has(p.id)), ...jetztP];
  const unlesbar = nimmKonstellationen(s, server.konstellationen);
  s.speicher = "da";
  if (S === s) render();
  if (unlesbar && S === s) toast(`${unlesbar === 1 ? "Eine gespeicherte Konstellation ließ" : `${unlesbar} gespeicherte Konstellationen ließen`} sich nicht lesen; sie ${unlesbar === 1 ? "bleibt" : "bleiben"} auf dem Server, wie ${unlesbar === 1 ? "sie ist" : "sie sind"}.`);
  const teile = [neuP.length ? plural(neuP.length, "Profil", "Profile") : "", neuF.length ? plural(neuF.length, "eigene Fassung", "eigene Fassungen") : "",
    neuPk.length ? plural(neuPk.length, "Pack", "Packs") : ""].filter(Boolean);
  const alte = lokal?.alteFassungen ? ` ${lokal.alteFassungen === 1 ? "Eine eigene Fassung" : `${lokal.alteFassungen} eigene Fassungen`} von vor dem 16.10. galt für jedes Profil gleich und ist nicht übernommen; Fassungen gehören jetzt einem Profil.` : "";
  if (lokal && teile.length) {
    try { await sende(s); } catch (e) {
      if (S === s) toast(`${teile.join(", ")} aus diesem Browser ließen sich nicht auf den Server legen (${grundVon(e)}); sie bleiben im Browser, bis es beim nächsten Öffnen klappt.`);
      return;
    }
    ausDemBrowserWeg();
    if (S === s) toast(`Aus diesem Browser übernommen: ${teile.join(", ")}. Sie liegen jetzt auf dem Server.${alte}`);
    return;
  }
  if (lokal) ausDemBrowserWeg();
  if (alte && S === s) toast(alte.trim());
}

// DIE GESPEICHERTEN KONSTELLATIONEN (Konstellation Stück 1) kommen durch dieselbe Prüfung wie ein Import (k15-import.ts#importKonst) und
// behalten ihre Kennungen; ihre mitgereisten Profile finden das hiesige gleiche oder kommen dazu. Eine gleichnamige Fleet-Vorlage (eine
// eigene wie „MAIN ↔ MAIN“) ersetzt sie, außer du hast sie in diesem Fenster schon geändert. Was sich nicht lesen lässt, bleibt in
// `konstGespeichert` und geht beim nächsten Sichern unverändert zurück. Gibt zurück, wie viele das waren.
function nimmKonstellationen(s: St, liste: readonly Record<string, unknown>[]): number {
  let unlesbar = 0;
  for (const roh of liste) {
    const id = String(roh.id);
    s.konstGespeichert.set(id, roh);
    const r = importKonst(JSON.stringify(roh), s.profile, Date.now(), id);
    if (typeof r === "string") { unlesbar++; continue; }
    s.profile = [...s.profile, ...r.neueProfile];
    if (s.konstNeu.has(id)) continue;
    const war = s.konst.find((x) => x.id === id);
    s.konst = war ? s.konst.map((x) => x === war ? r.k : x) : [...s.konst, r.k];
    if (s.k === war) s.k = r.k;
  }
  return unlesbar;
}
// eine bearbeitbare Konstellation, die der Server (gelesen) nicht hat und die hier niemand geändert hat
export const nurImFenster = (s: St, k: Konst): boolean => !!k.eigen && s.speicher === "da" && !s.konstGespeichert.has(k.id) && !s.konstNeu.has(k.id);
// die Form, in der eine Konstellation auf dem Server liegt: der vollständige Export (k15-entwurf-modell.ts#exportObjekt), die Kennung davor
export const konstForm = (s: St, k: Konst): Record<string, unknown> =>
  ({ id: k.id, ...exportObjekt({ ebene: "konst", voll: true, konst: [k], k, profile: s.profile, q: null, p: profilVon(s, k.wurzeln[0]?.profil ?? "") }) });
// EINE KONSTELLATION SICHERN oder vom Server nehmen (null): true erst, wenn er bestätigt hat; sonst gilt wieder der Stand davor
export async function speichereKonst(s: St, id: string, k: Konst | null): Promise<boolean> {
  const vorher = s.konstGespeichert.get(id);
  if (k) s.konstGespeichert.set(id, konstForm(s, k)); else s.konstGespeichert.delete(id);
  const ok = await speichereEigenes(s);
  if (!ok) { if (vorher) s.konstGespeichert.set(id, vorher); else s.konstGespeichert.delete(id); }
  return ok;
}

// DIE FREIGABE ÜBER DEN DECKEL hat ihre eigene Tür (FREIGABE_ROUTE), ein Sichern des Speichers bringt sie nicht mit: erst wird der Stand gesichert,
// den sie freigibt, dann gibt der Server ihn frei. Danach trägt der gespeicherte Stand sie, damit das nächste Sichern sie behält
export async function gibFrei(s: St, k: Konst, pos: string, d: SitzDarf): Promise<boolean> {
  if (!(await speichereKonst(s, k.id, k))) return false;
  const p = reihe.then(async () => {
    const res = await api(FREIGABE_ROUTE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ konst: k.id, pos }) });
    const j: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(j && typeof j === "object" && "error" in j && typeof j.error === "string" ? j.error : `Antwort ${res.status}`);
    d.bestaetigt = true;
    s.konstGespeichert.set(k.id, konstForm(s, k));
    return true;
  }).catch((e: unknown) => {
    if (S === s) toast(`Der Server hat die Freigabe nicht gespeichert (${grundVon(e)}).`);
    return false;
  });
  reihe = p;
  return p;
}

// SICHERN: true erst, wenn der Server bestätigt hat; erst dann sagt der Aufrufer „gesichert“. Schlägt es fehl, sagt das ein Satz, und
// die Änderung gilt nur in diesem Fenster
export function speichereEigenes(s: St): Promise<boolean> {
  const p = reihe.then(async () => {
    if (s.speicher !== "da") throw new Error(s.speicher === "laedt" ? "das Lesen läuft noch" : `beim Öffnen nicht lesbar: ${s.speicher.fehler}`);
    await sende(s);
    return true;
  }).catch((e: unknown) => {
    if (S === s) toast(`Der Server hat deine Änderung nicht gespeichert (${grundVon(e)}): Sie gilt nur, bis du das Fenster schließt.`);
    return false;
  });
  reihe = p;
  return p;
}

// DIE REPOS (Z32): die mit laufender Session wie im Startfenster (src/founding.ts#repoList), claude-fleet zuerst, dahinter die
// gepinnten ohne Session (GET /api/dirs → pins). Ein gepinnter Ordner, den /api/dirinfo nicht als Git-Repo kennt, steht nicht darin;
// das gewählte Repo steht immer darin.
export interface RepoZeile { repo: string; sessions: number; gepinnt: boolean }
export function repoZeilen(s: St | null): RepoZeile[] {
  const zahl = new Map<string, number>();
  for (const x of flotte()) if (x.cwd) zahl.set(x.repo ?? x.cwd, (zahl.get(x.repo ?? x.cwd) ?? 0) + 1);
  const pins = s?.pins ?? [];
  const laufend = [...zahl].sort((a, b) => Number(baseName(b[0]) === "claude-fleet") - Number(baseName(a[0]) === "claude-fleet") || b[1] - a[1])
    .map(([repo, n]) => ({ repo, sessions: n, gepinnt: pins.includes(repo) }));
  const keinGit = (p: string) => { const i = s?.infos.get(p); return typeof i === "object" && "git" in i && !i.git; };
  const ohne = pins.filter((p) => !zahl.has(p) && (p === s?.repo || !keinGit(p))).map((repo) => ({ repo, sessions: 0, gepinnt: true }));
  const gewaehlt = s?.repo && !zahl.has(s.repo) && !pins.includes(s.repo) ? [{ repo: s.repo, sessions: 0, gepinnt: false }] : [];
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
  }).catch((e: unknown) => ({ fehler: e instanceof Error ? e.message : "Server nicht erreichbar" })).then((st) => {
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
  if (!res?.ok || !pins) { toast(`${baseName(pfad)}: ${j && typeof j === "object" && "error" in j ? String(j.error) : "Fleet hat das nicht gespeichert"}.`); return; }
  s.pins = pins;
  const raus = vorher.filter((x) => x !== pfad && !pins.includes(x));
  const verdraengt = raus.length ? ` Die Auswahl hält ${pins.length} Repos: ${raus.map(baseName).join(", ")} ist dafür herausgefallen.` : "";
  if (an) {
    s.ordner = null;
    s.repoMenu = false;
    s.repo = zurueck === undefined ? pfad : zurueck;
    toast(zurueck === undefined
      ? `Neue Sessions starten jetzt in ${baseName(pfad)}. Es steht in der Auswahl, auch ohne Session und auf deinen anderen Geräten.${verdraengt}`
      : `${baseName(pfad)} steht wieder in der Auswahl.${verdraengt}`);
  } else {
    if (s.repo === pfad && !flotte().some((x) => x.cwd && (x.repo ?? x.cwd) === pfad)) s.repo = null;
    toast(`${baseName(pfad)} ist aus der Auswahl genommen, auch auf deinen anderen Geräten. Der Ordner selbst bleibt, wie er ist.`,
      { wort: "Rückgängig", tu: () => { void pinne(s, pfad, true, repoVorher); } });
  }
  gehe(s.tief, 2);
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
    : { ...s.ordner, fehler: j?.error ?? `Der Server antwortete ${res?.status ?? "nicht"} für diesen Ordner.` };
  render();
}

// DER GRÜNDUNGSPLAN je Rolle, Agent und Schalter, einmal gelesen und gemerkt; ein abgelehnter Schalter kommt als `fehler`. Agent, Modell
// und Effort nimmt die Route wie ein Start (server.ts#foundingPlanAnswer: harness, model, effort); was nicht gesetzt ist, fehlt in der
// Adresse, dann gilt der Standard der Rolle
export interface Dreier { harness?: string; model?: string; effort?: string }
// was die Öffnung außer dem Plan noch liest (server.ts#startVonAdresse): damit die Vorschau die Fassung DIESES Starts rechnet und der gezeigte
// Hash der ist, der läuft. Rechte als JSON, das Profil als Kennung, die Bibliothek nur für einen Start ohne Plan.
export interface Dazu { rechte?: Rechte; profil?: string; bibliothek?: boolean; sitz?: string }
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
    return { fehler: e instanceof Error ? e.message : "Server nicht erreichbar" };
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
// was „wer bestimmt“ (src/k15-wer.ts) außer dem Baustein braucht; der Plan von „Nur Ordner“ sagt, was Claude Code selbst lädt
export function werPlan(s: St, a: Answer): WerPlan {
  const nur = s.repo ? antwort(hole(s, planUrl(s.repo, "nur-ordner", {}))) : null;
  return { traeger: traegerVon(a.plan.bausteine), nativ: nur ? nativVon(nur.plan.bausteine) : null,
    ohneQuelle: new Map(a.omitted.map((o) => [`pack:${o.id}`, OMIT_SAY[o.reason] ?? o.reason])),
    fehlt: new Map(a.plan.bausteine.flatMap((b) => { const f = fehltWeil(a, b); return f === null ? [] : [[b.id, f] as [string, string]]; })), name: bausteinName };
}

// was für eine Position (oder ein Profil) gilt: der volle Plan der Rolle, der Umfang auf dem Regler, die Schalter darunter und darauf.
// Der Regler steht nur an einer Gruppe mit mindestens zwei freien Bausteinen (Begründung: src/k15-entwurf-modell.ts#hatRegler).
export interface Lage { voll: PlanStand; plan: PlanStand; umfang: Partial<Record<GruppeId, Stufe>>; regler: Partial<Record<GruppeId, Regler>>; unten: Schalter;
  eigen: Schalter; sch: Schalter }
export function lage(s: St, p: Profil, q: Position | null): Lage | null {
  if (!s.repo) return null;
  const d = dreier(s, p, q);
  const dazu = dazuDerPosition(s, p, q);
  const voll = hole(s, planUrl(s.repo, p.rolle, {}, d, dazu));
  const va = antwort(voll);
  const umfang: Partial<Record<GruppeId, Stufe>> = {}, regler: Partial<Record<GruppeId, Regler>> = {};
  let vs: Schalter = {};
  if (va && p.rolle !== "nur-ordner") for (const g of GRUPPEN) {
    const r = reglerVon(va, g.id);
    if (!hatRegler(r)) continue;
    const u = umfangVon(p, q, g.id);
    regler[g.id] = r;
    umfang[g.id] = u;
    vs = { ...vs, ...stufenSchalter(u, r) };
  }
  const sch = schalterVon(vs, p, q);
  const wartet = !va && p.rolle !== "nur-ordner" && GRUPPEN.some((g) => umfangVon(p, q, g.id) !== "standard");
  const plan = wartet ? voll : hole(s, planUrl(s.repo, p.rolle, sch, d, dazu));
  return { voll, plan, umfang, regler, unten: q ? { ...vs, ...p.schalter } : vs, eigen: (q ? q.schalter : p.schalter) ?? {}, sch };
}
// die Bausteine, die Spalte 3 und 4 für diese Rolle zeigen; die übrigen schaltet der Plan nur für andere Rollen an. Dazu, was sich in
// einer Gruppe dazuschalten lässt (es steht blass in ihr, auch wenn der Plan der Rolle es nicht anschaltet).
export function bausteineVon(a: Answer, l: Lage): Baustein[] {
  const va = antwort(l.voll);
  const dazu = new Set(va ? GRUPPEN.flatMap((g) => reglerVon(va, g.id).dazu.map((b) => b.id)) : []);
  return a.plan.bausteine.filter((b) => !b.id.startsWith("pack:")
    && (b.rollenDefault !== "aus" || b.zustand !== "aus" || l.sch[b.id] !== undefined || dazu.has(b.id)));
}

// WARUM ETWAS BEI DIESEM START FEHLT, in Menschenworten: die Gründe der Tür (server.ts#planDoorRow, PLAN_NUR_DISPATCH) schreiben
// ae/oe/ue und Fleet-Begriffe; ein Grund, den diese Liste nicht kennt, kommt wörtlich, nur mit Umlauten. Jeder Schlüssel steht so im
// Server (am 16.10. per grep geprüft).
const GRUND_WORT: Record<string, string> = {
  "nur die Dispatch-Gruendung einer Karte liefert das": "kommt nur, wenn Fleet eine Lane für eine Karte gründet; dieser Start hat keine Karte",
  "kein Pack ist an": "kein Pack ist an, also gibt es keine Lesehinweise",
  "die Leiter hat das Pack ausgelassen": "der Plan hat dieses Pack nicht gewählt",
  "es steht im lane-footer, und der ist nicht an": "es steht im Rückweg der Lane, und der ist aus",
  "die Lane-Tuer liefert das nicht": "der Start einer Lane liefert das nicht",
  "der MAIN-Brief traegt das nicht": "die erste Nachricht der MAIN enthält das nicht",
  "/open schreibt keine Session-Datei und sendet das nicht": "dieser Start schreibt keine Session-Datei und schickt es auch nicht",
  "/open sendet das nur mit der Orchestratorin-Karte (Label)": "dieser Start schickt es nur, wenn die Session als Orchestratorin startet",
  "nur der Claude-Adapter traegt den Zustellkopf": "nur der Claude-Weg setzt den Zustell-Kopf",
  "das Pack portable-core ist aus, und nur mit ihm steht der Vertrag in der Lane-Datei": "der Vertrag steht nur mit dem Pack Portable Core in der Session-Datei, und das ist aus",
  "das Pack portable-core ist aus, und Claude laedt AGENTS.md hier nicht nativ (server.ts#agentCmd)": "der Vertrag kommt nur mit dem Pack Portable Core, und das ist aus",
  "nur Claude laedt ein Auto-Memory": "nur Claude lädt ein Auto-Memory",
  "eine Claude-Lane startet ohne Auto-Memory (server.ts#agentCmd)": "eine Lane startet ohne Auto-Memory",
  "kein Claude-Auto-Memory unter diesem Checkout": "in diesem Repo gibt es kein Auto-Memory von Claude",
};
export function grundWort(g: string): string {
  const bekannt = GRUND_WORT[g];
  if (bekannt) return bekannt;
  const aus = /^Plan: aus(?: \(([^)]+)\))?$/.exec(g);
  if (aus) return aus[1] ? `ist aus: ${OMIT_SAY[aus[1]] ?? aus[1]}` : "ist in diesem Plan aus";
  return g.replace(/\bTuer\b/g, "Tür").replace(/\blaedt\b/g, "lädt").replace(/\btraegt\b/g, "trägt").replace(/\bfuer\b/g, "für").replace(/\bnoetig\b/g, "nötig");
}
// an im Plan, aber diese Tür liefert es beim Start nicht: der Grund steht in lieferung.ausgelassen, bei einem von Hand angeschalteten
// Baustein in start.refusals (server.ts#planDoorVerdict); null = kommt an oder ist aus
export function fehltWeil(a: Answer, b: Baustein): string | null {
  if (b.zustand !== "an" || !a.lieferung || a.lieferung.geliefert.some((x) => x.id === b.id)) return null;
  const g = a.lieferung.ausgelassen.find((x) => x.id === b.id)?.grund
    ?? a.start.refusals.map((x) => new RegExp(`^${b.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ist angeschaltet, diese Tuer liefert es nicht: (.+)$`).exec(x)?.[1]).find(Boolean);
  return g ? grundWort(g) : "dieser Start liefert es nicht";
}
export const kommtAn = (a: Answer, b: Baustein): boolean => b.zustand === "an" && fehltWeil(a, b) === null;
// wo ein Baustein landet, in einem Wort (die Orte aus src/k15-entwurf-modell.ts#ORTE); was in einem anderen steckt, sagt worin
const WEG_WORT: Record<string, string> = { "native Datei": "lädt Claude Code", "Session-Datei": "Session-Datei", Prompt: "erste Nachricht",
  plan: "Startzeile", Zustellung: "im Lauf" };
export function wegVon(a: Answer, b: Baustein): string {
  if (b.zustand !== "an") return "";
  const da = a.lieferung?.geliefert.find((x) => x.id === b.id);
  if (!da) return a.lieferung ? "fehlt bei diesem Start" : "";
  const worin = b.enthaltenIn ? a.plan.bausteine.find((x) => x.id === b.enthaltenIn) : undefined;
  return worin && worin.zustand === "an" ? `in ${bausteinName(worin)}` : WEG_WORT[da.weg] ?? da.weg;
}
// die Bytes eines Bausteins, die keinem Baustein in ihm gehören: so zählt jedes Byte einmal, beim innersten, der es nennt, und die
// Gruppen ergeben zusammen Fleets Teil des Starts (startSumme.fleetBytes)
export const zahl = (b: Baustein): number | null => typeof b.bytes === "number" ? b.bytes : null;
export function eigeneBytes(a: Answer): Map<string, number> {
  const an = a.plan.bausteine.filter((b) => b.zustand === "an");
  const out = new Map<string, number>();
  for (const b of an) {
    const n = zahl(b);
    if (n === null) continue;
    out.set(b.id, Math.max(0, n - an.filter((k) => k.enthaltenIn === b.id).reduce((m, k) => m + (zahl(k) ?? 0), 0)));
  }
  return out;
}

// AGENT, MODELL UND EFFORT: gesetzt, sonst der Standard der Rolle aus dem Plan (model-register.ts#MODEL_DEFAULTS); eine Session ohne Rolle
// startet mit Fleets Standard-Agenten, FLEET_MODEL und ohne --effort (server.ts#agentCmd). Rangfolge aus dem Modell (`wirksam`): Session
// vor Profil vor Standard. Modell und Effort gelten nur, wenn sie zum wirksamen Agenten passen (src/k15-agent.ts#passtModell): Der Server
// lehnte sie beim Start ab. Der Standard der Rolle gilt nur für ihren eigenen Agenten; ein anderer nimmt sein eigenes. `herkunft` steht
// vorne in Menschenworten, `quelle` (Datei und Funktion) nur im Title.
export type WahlFeld = "agent" | "modell" | "effort";
// `rolle`: der Wert ist der Standard der Rolle aus dem Modell-Register (der Plan nennt ihn); ein Start schickt ihn ausdrücklich mit
export interface Wahl { wert: string; wort: string; herkunft: string; quelle: string; gesetzt: boolean; rolle?: true }
// der Standard der Rolle aus ihrem Plan ohne Agent und Schalter (jeder Plan nennt ihn für alle Rollen gleich); null = ohne Rolle
const rollenStd = (s: St, p: Profil) => s.repo ? antwort(hole(s, planUrl(s.repo, p.rolle, {})))?.rollen.find((r) => r.id === p.rolle)?.standard ?? null : null;
// ob der Plan, der den Standard der Rolle nennt, schon da ist: vorher schickte ein Start ihn nicht mit (#dreier)
export const rollenStandardGelesen = (s: St, p: Profil): boolean => !!s.repo && antwort(hole(s, planUrl(s.repo, p.rolle, {}))) !== null;
// ob die Agent-MD des Profils mitkommt: die Türen /open und Branch nehmen `profil`, der Server liest es aus dem Speicher, und nur Claude Code
// liest den Block; die Tür der MAIN und der Lane nehmen es noch nicht. Hier statt im Start, weil auch die Vorschau das Profil mitrechnet.
export const agentMdKommt = (s: St, p: Profil, q: Position | null): boolean =>
  !!p.datei && s.speicher === "da" && (p.schiene === "bau" || (p.rolle !== "lane" && p.rolle !== "main")) && wahlVon(s, p, q, "agent").wert === "claude";
// was an einer Position einer gespeicherten Konstellation hängt und die Tür nimmt (server/sitz-reise.ts#sitzDerTuer): ihr Sitz-Block, ihre eigene
// Datei als Auftrag und die Agent-MD ihres Profils, so wie der Server sie gespeichert hat; nur Claude Code, nur ohne Rolle. Jede solche Position
// startet als ihr Sitz, auch ohne Block: so kennt der Slot seine Konstellation und öffnet ihre anderen Sitze an der Self-Tür mit ihrem Setup.
// Hier statt im Start, weil auch die Vorschau es mitrechnet (der gezeigte Hash ist der des Starts).
export const sitzKommt = (s: St, p: Profil, q: Position): boolean =>
  s.konstGespeichert.has(s.k.id) && !s.konstNeu.has(s.k.id) && p.rolle === "nur-ordner" && wahlVon(s, p, q, "agent").wert === "claude";
// was die Vorschau einer Position außer dem Plan mitnimmt, wie ihr Start es an die Tür schickt (k15-start.ts#auftrag): Profil, Sitz und die Rechte der Position
export const dazuDerPosition = (s: St, p: Profil, q: Position | null): Dazu => ({ ...(agentMdKommt(s, p, q) ? { profil: p.id } : {}),
  ...(q && sitzKommt(s, p, q) ? { sitz: `${s.k.id}/${q.id}` } : {}), ...(q?.rechte ? { rechte: q.rechte } : {}) });
export function wahlVon(s: St, p: Profil, q: Position | null, feld: WahlFeld): Wahl {
  const std = rollenStd(s, p), kat = s.katalog ?? null;
  const gesetzt = (v: unknown, gilt: (x: string) => boolean) => typeof v === "string" && v !== "" && gilt(v);
  if (feld === "agent") {
    const qa = q?.abw?.agent, pa = p.agent;
    const w = wirksam<{ v: string | null; quelle: string }>({
      ...(gesetzt(qa, () => true) ? { position: { wert: { v: String(qa), quelle: "" }, herkunft: "für diese Session gesetzt" } } : {}),
      ...(gesetzt(pa, () => true) ? { profil: { wert: { v: String(pa), quelle: "" }, herkunft: `im Profil ${p.name} gesetzt` } } : {}),
      standard: std ? { wert: { v: std.harness, quelle: "model-register.ts#MODEL_DEFAULTS" }, herkunft: "Fleets Standard für diese Rolle" }
        : { wert: { v: kat ? standardAgent(kat) : null, quelle: "GET /api/harnesses (default) · server.ts CLAUDE_HARNESS" }, herkunft: "ohne Rolle: der Agent, mit dem Fleet jede Session startet" },
    });
    const v = w?.wert.v ?? null;
    return { wert: v ?? "", wort: v ? agentWort(v) : "unbekannt", herkunft: w?.herkunft ?? "", quelle: w?.wert.quelle ?? "", gesetzt: w?.rang === "position" || w?.rang === "profil",
      ...(w?.rang === "standard" && std ? { rolle: true as const } : {}) };
  }
  const agent = wahlVon(s, p, q, "agent").wert;
  const ka = kat ? agentVon(kat, agent) : undefined;
  if (kat && ka && !(feld === "modell" ? ka.modell : ka.effort))
    return { wert: "", wort: "keins", herkunft: `${agentWort(agent)} nimmt ${feld === "modell" ? "kein Modell" : "keinen Effort"} an`, quelle: `GET /api/harnesses (supports.${feld === "modell" ? "model" : "effort"})`, gesetzt: false };
  const passt = (v: string) => feld === "modell" ? passtModell(kat, agent, v) : passtEffort(kat, agent, v);
  const qa = q?.abw?.[feld], pa = p[feld];
  const eigenes = { v: null, quelle: `kein --${feld === "modell" ? "model" : "effort"} · server.ts#agentCmd`, herkunft: `${agentWort(agent)} nimmt ${feld === "modell" ? "sein eigenes Standardmodell" : "seinen eigenen Standard"}` };
  const standard: { v: string | null; quelle: string; herkunft: string } = std && std.harness === agent
    ? { v: feld === "modell" ? std.modell : std.effort, quelle: "model-register.ts#MODEL_DEFAULTS", herkunft: "Fleets Standard für diese Rolle" }
    : feld === "modell" && !std && (!kat || agent === standardAgent(kat))
      ? { v: s.fleetModell, quelle: "FLEET_MODEL · server.ts#agentCmd", herkunft: "ohne Rolle: das Modell, mit dem Fleet jede Session startet" }
      : feld === "modell" && kat && agent === standardAgent(kat) && kat.standardModell
        ? { v: kat.standardModell, quelle: "server.ts DEFAULT_MODEL", herkunft: `ohne Modell startet ${agentWort(agent)} mit Fleets Standardmodell` }
        : eigenes;
  const w = wirksam<{ v: string | null; quelle: string }>({
    ...(gesetzt(qa, passt) ? { position: { wert: { v: String(qa), quelle: "" }, herkunft: "für diese Session gesetzt" } } : {}),
    ...(gesetzt(pa, passt) ? { profil: { wert: { v: String(pa), quelle: "" }, herkunft: `im Profil ${p.name} gesetzt` } } : {}),
    standard: { wert: { v: standard.v, quelle: standard.quelle }, herkunft: standard.herkunft },
  });
  const v = w?.wert.v ?? null;
  const wort = v !== null ? (feld === "modell" ? modelLabel(v) : EFFORT_WORT[v] ?? v)
    : standard.quelle.startsWith("FLEET_MODEL") ? "unbekannt" : `Standard von ${agentWort(agent)}`;
  return { wert: v ?? "", wort, herkunft: w?.herkunft ?? "", quelle: w?.wert.quelle ?? "", gesetzt: w?.rang === "position" || w?.rang === "profil",
    ...(w?.rang === "standard" && std && std.harness === agent && v !== null ? { rolle: true as const } : {}) };
}
// was der Plan einer Position über ihren Agenten wissen muss und ein Start mitschickt: was gesetzt ist und passt, und der Standard der
// Rolle (Runde 5): ohne ihn startete der Server mit seinem eigenen Standard, nicht mit dem, den das Fenster zeigt (das alte Fenster schickte
// ihn ebenso, founding.ts#applyStandard bis Runde 5). Was keine Rolle vorgibt (Nur Ordner), bleibt dem Agenten
export function dreier(s: St, p: Profil, q: Position | null): Dreier {
  const a = wahlVon(s, p, q, "agent"), m = wahlVon(s, p, q, "modell"), e = wahlVon(s, p, q, "effort");
  const mit = (w: Wahl) => w.wert !== "" && (w.gesetzt || w.rolle === true);
  return { ...(mit(a) ? { harness: a.wert } : {}), ...(mit(m) ? { model: m.wert } : {}), ...(mit(e) ? { effort: e.wert } : {}) };
}
// DIE SUCCESSION-SCHWELLE: ist die Succession auf der ganzen Instanz aus (FLEET_MIGRATE_PCT 0), wirkt kein eigener Wert; der Server prüft
// den Hauptschalter vor dem Wert der Session (server.ts#succeedAtThreshold)
export function schwelleWahl(s: St, p: Profil, q: Position | null): { pct: number | null; herkunft: string; quelle: string; gesetzt: boolean } {
  const std = schwelleVon(p.schiene, s.env ?? null);
  if (s.env && s.env.migratePct <= 0) return { pct: 0, herkunft: std.herkunft, quelle: std.quelle, gesetzt: false };
  const qa = q?.abw?.schwelle, pa = p.schwelle;
  const w = wirksam<number | null>({
    ...(typeof qa === "number" ? { position: { wert: qa, herkunft: "für diese Session gesetzt" } } : {}),
    ...(typeof pa === "number" ? { profil: { wert: pa, herkunft: `im Profil ${p.name} gesetzt` } } : {}),
    standard: { wert: std.pct, herkunft: std.herkunft },
  });
  return { pct: w?.wert ?? null, herkunft: w?.herkunft ?? std.herkunft, quelle: w?.rang === "standard" ? std.quelle : "", gesetzt: w?.rang === "position" || w?.rang === "profil" };
}
