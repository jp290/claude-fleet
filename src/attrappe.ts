// ATTRAPPE (Owner 19.10., docs/konstellation/modell.md §4): „[Zitat entfernt]“ mit „[Zitat entfernt]“ und Historie, und die Systemansicht mit
// dem Plus-Kasten. „Neue Session“ ist die echte Fassung 3 (src/sitzung.ts, Owner-Urteil 19.10.: das eigene Formular war „[Zitat entfernt]“
// ); die Attrappe hängt ihr nur an, was es noch nicht gibt: Profile zum Ausgehen, die Agent-MD des Profils im Text, „[Zitat entfernt]“
//  und den Eintrag in der Historie. Profile, Historie und Systembaum sind erfunden und leben nur bis zum Neuladen. Geöffnet über
// #attrappe (src/client.ts → src/k15-lader.ts#openAttrappe), ausgeliefert im K15-Bundle. Zum Wegwerfen, sobald der Owner „[Zitat entfernt]“ gesagt hat.
import { el, api, flotte } from "./k15-haupt";
import { openShell, type Shell } from "./shell";
import { openK15Entwurf } from "./k15-entwurf";
import { render, S, type St } from "./k15-zustand";
import { agentWort } from "./k15-agent";
import { modelLabel } from "./modelname";
import { RECHTE_STANDARD, RECHTE_STUFEN, istStufe, type Rechte, type RechteStufe } from "../session-rechte";
import { HISTORIE_ROUTE } from "./k15-speicher";
import { AUFGABE_FELDER, aufgabeAlsText, aufgabeAus, type Aufgabe } from "./aufgabe";
import type { SitzStand } from "./sitzung";
import type { SitzungModell, SitzungRolle } from "./sitzung-modell";
import type { Profil as K15Profil } from "./k15-entwurf-modell";
import { laufAnsicht } from "./lauf-ansicht";

type Ansicht = "neu" | "historie" | "system";
// was ein Profil trägt: genau die Einstellungen der echten Ansicht, dazu seine Agent-MD
// `profilId`: die Kennung eines am Server gespeicherten Profils; mit ihr nimmt die Tür seine Agent-MD mit (server/agentmd.ts)
interface Einst { agent: string; modell: string; effort: string; rolle: SitzungRolle; rechte: Rechte; md: string; profilId?: string }
interface Profil extends Einst { id: string; name: string; eigen?: true; echt?: true }
// fort: der Branch einer Branch-Session, den „Erneut starten“ fortsetzt; auftrag: das Ziel, das sie als erste Nachricht bekam
interface Fort { branch: string; repo: string | null }
interface Lauf { id: number; name: string; profil: string; einst: Einst; am: Date; ziel: string; slot: number | null; status: "läuft" | "beendet"; erfunden?: true; fort?: Fort; auftrag?: string; aufgabe?: Aufgabe; lauf?: string; laufId?: string }
interface Knoten { id: number; name: string; profil: string; status: "läuft" | "geplant"; slot: number | null; kids: Knoten[] }

const md = (titel: string, satz: string) => `# ${titel}\n\n${satz}\n\n## Was du meldest\nEin Satz Ergebnis, darunter die Stellen mit Datei und Zeile.`;
const rechte = (stufe: RechteStufe): Rechte => ({ stufe, an: [], aus: [] });
const profil = (id: string, name: string, o: Partial<Profil>): Profil =>
  ({ id, name, agent: "claude", modell: "claude-opus-5-5", effort: "high", rolle: "einfach", rechte: rechte("bauen"), md: md(name, ""), ...o });

let profile: Profil[] = [
  profil("orch", "Orchestratorin", { md: md("Orchestratorin", "Du trägst die Richtung und öffnest Sessions für Aufträge.") }),
  profil("main", "MAIN", { md: md("MAIN", "Du führst ein Program: Karten schreiben, Reports prüfen, landen."), rechte: rechte("landen") }),
  profil("lane", "Lane", { md: md("Lane", "Du arbeitest einen Auftrag im eigenen Worktree ab."), effort: "medium" }),
  profil("bau", "Branch-Session", { rolle: "branch", md: md("Branch-Session", "Eigener Branch mit Ziel, du arbeitest bis zum Land.") }),
  profil("auswertung", "Auswertung", { md: md("Auswertung", "Du liest Nachrichtenprotokolle, Anweisungen und Ergebnisse des Laufs und sagst, was die Konstellation beim nächsten Mal besser macht."),
    rechte: rechte("lesen") }),
  profil("grok", "Grok-Auswertung", { eigen: true, md: md("Grok-Auswertung", "Schau dir Fleet nur grob an; das Material liegt im Ordner."), rechte: rechte("lesen") }),
];
const profilNamens = (name: string): Profil | undefined => profile.find((p) => p.name === name);
const einstVon = (p: Profil): Einst => ({ agent: p.agent, modell: p.modell, effort: p.effort, rolle: p.rolle, rechte: p.rechte, md: p.md,
  ...(p.profilId ? { profilId: p.profilId } : {}) });
// DIE HISTORIE IST ECHT (server/start-historie.ts, GET HISTORIE_ROUTE): jeder Start am Server, neueste zuerst. Erfunden bleiben nur die
// Starts aus der Systemansicht, die keine Session öffnen
const laeufe: Lauf[] = [];
let echte: Lauf[] | "laedt" | { fehler: string } | null = null;
const rec = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : {};
// der Lauf einer Konstellation, in dem der Start sitzt (server/laeufe.ts), in einer Zeile
const laufText = (v: unknown): string | null => {
  const l = rec(v);
  return typeof l.id === "string" && typeof l.name === "string" && typeof l.pos === "string" && typeof l.hash === "string"
    ? `Lauf ${l.id} · ${l.name} · Position „${typeof l.posName === "string" ? l.posName : l.pos}“ · Fassung ${typeof l.version === "number" ? `v${l.version} · ` : ""}${l.hash.slice(0, 8)}` : null;
};
function laufAus(x: Record<string, unknown>, i: number): Lauf | null {
  const slot = typeof x.slot === "number" ? x.slot : null, at = typeof x.at === "number" ? x.at : null, cwd = typeof x.cwd === "string" ? x.cwd : null;
  if (slot === null || at === null || cwd === null) return null;
  const branch = typeof x.branch === "string" ? x.branch : null, r = rec(x.rechte), p = rec(x.profil), au = aufgabeAus(x.aufgabe);
  const laeuft = flotte().some((f) => f.id === slot && f.openedAt === x.openedAt);
  return { id: -1 - i, name: typeof x.label === "string" ? x.label : branch ?? cwd.split("/").pop() ?? cwd,
    profil: typeof p.id === "string" ? `Profil ${typeof p.name === "string" ? p.name : p.id}` : "ohne Profil",
    einst: { agent: typeof x.harness === "string" ? x.harness : "claude", modell: typeof x.model === "string" ? x.model : "", effort: typeof x.effort === "string" ? x.effort : "",
      ...(typeof p.id === "string" ? { profilId: p.id } : {}), rolle: branch ? "branch" : "einfach", rechte: istStufe(r.stufe) ? { stufe: r.stufe, an: Array.isArray(r.an) ? r.an.map(String) : [], aus: Array.isArray(r.aus) ? r.aus.map(String) : [] } : rechte(RECHTE_STANDARD), md: "" },
    am: new Date(at), ziel: branch ? `${branch} in ${cwd}` : cwd, slot, status: laeuft ? "läuft" : "beendet",
    ...(branch ? { fort: { branch, repo: typeof x.repo === "string" ? x.repo : null } } : {}), ...(typeof x.goal === "string" ? { auftrag: x.goal } : {}),
    ...(typeof au === "string" ? {} : { aufgabe: au }), ...(laufText(x.lauf) ? { lauf: laufText(x.lauf) ?? "", laufId: String(rec(x.lauf).id) } : {}) };
}
function liesHistorie(): void {
  echte = "laedt";
  api(`${HISTORIE_ROUTE}?max=50`).then(async (r) => {
    const j: unknown = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`Antwort ${r.status}`);
    const starts = Array.isArray(rec(j).starts) ? rec(j).starts as unknown[] : [];
    echte = starts.map((x, i) => laufAus(rec(x), i)).filter((x): x is Lauf => x !== null);
  }).catch((e: unknown) => { echte = { fehler: e instanceof Error ? e.message : "Server nicht erreichbar" }; }).finally(() => { if (ansicht === "historie") zeichne(); });
}
const alleLaeufe = (): Lauf[] => [...laeufe, ...(Array.isArray(echte) ? echte : [])];
let nr = 100;
const knoten = (name: string, prof: string, slot: number | null, kids: Knoten[] = [], status: Knoten["status"] = "läuft"): Knoten =>
  ({ id: nr++, name, profil: prof, status, slot, kids });
let baum: Knoten[] = [knoten("Orchestrator", "orch", 1, [knoten("Grok-Auswertung", "grok", 13), knoten("bau/konstellation", "bau", 8)]),
  knoten("Fleet-Betrieb", "main", 2, [knoten("Lane 2A", "lane", 9), knoten("Lane 2B", "lane", 10)])];
const lose = [{ name: "Shell", slot: 7 }, { name: "Sol", slot: 5 }];
let stil: "locker" | "streng" = "streng";
let mitAuswertung = true;

let shell: Shell | null = null;
let ansicht: Ansicht = "neu";
let plusAn: number | "wurzel" | null = null;
let gewaehlt: number | null = null;

export function openAttrappe(): void {
  if (ansicht === "neu") { zurNeuenSession(null); return; }
  shell?.close();
  if (ansicht === "historie") liesHistorie();
  shell = openShell({ id: "attrappe", title: "Attrappe", subtitle: "Neue Session · Historie · System — Profile erfunden, Historie echt",
    onClose: () => { shell = null; } });
  shell.root.classList.add("solo", "attrappe");
  zeichne();
}

function meldung(text: string): void {
  const win = shell?.root.querySelector(".shellwin");
  if (!win) return;
  win.querySelector(".atttoast")?.remove();
  const t = el("div", "atttoast", text);
  win.append(t);
  setTimeout(() => t.remove(), 4500);
}

function zeichne(): void {
  if (!shell) return;
  const box = el("div", "attbox");
  const tabs = el("div", "atttabs");
  for (const [id, wort] of [["neu", "Neue Session"], ["historie", "Historie"], ["system", "System"]] as const) {
    const b = el("button", ansicht === id ? "on" : "", wort);
    b.onclick = () => { if (id === "neu") { zurNeuenSession(null); return; } ansicht = id; if (id === "historie") liesHistorie(); zeichne(); };
    tabs.append(b);
  }
  box.append(tabs, ansicht === "historie" ? historie() : system());
  shell.detail.replaceChildren(box);
}

// ——— 1 · NEUE SESSION: DIE ECHTE ANSICHT, DAZU WAS NOCH FEHLT ———
// das Fenster, das die Attrappe geöffnet hat; nur dort zeigt die echte Ansicht die Zusätze
let fuer: St | null = null;
// was beim ersten Zeichnen in die Ansicht kommt (aus einem Profil, einem Lauf der Historie oder einer Karte im System)
let vorbelegt: { einst: Einst; name: string; ziel: string; aufgabe?: Aufgabe } | null = null;
// der Branch, den dieser Start fortsetzt, solange die Session den Namen aus der Historie trägt
let fortsetzen: (Fort & { name: string }) | null = null;
// das Profil, von dem diese Session ausgeht; seine Agent-MD steht im Text
let ausgehend: Profil | null = null;
let alsProfil = false;
let profilName = "";

export const attrappeFuer = (s: St): boolean => s === fuer;

function zurNeuenSession(p: Profil | null, name = "", ziel = "", einst?: Einst, fort?: Fort, aufgabe?: Aufgabe): void {
  const e = einst ?? (p ? einstVon(p) : null);
  vorbelegt = e ? { einst: e, name, ziel: aufgabe?.ziel ?? ziel, ...(aufgabe ? { aufgabe } : {}) } : null;
  fortsetzen = fort ? { ...fort, name } : null;
  ausgehend = p;
  wunschProfil = !p && einst?.profilId ? einst.profilId : null;
  alsProfil = false;
  profilName = "";
  shell?.close();
  S?.shell.close();
  ansicht = "neu";
  // die echte Ansicht öffnet über ihre Adresse; danach steht wieder #attrappe da, damit Neuladen hierher zurückführt
  history.replaceState(null, "", "#k15-sitzung");
  openK15Entwurf();
  history.replaceState(null, "", "#attrappe");
  fuer = S;
  if (S && fort?.repo) S.repo = fort.repo;
  render();
}
function zurAttrappe(a: Exclude<Ansicht, "neu">, text?: string): void {
  fuer = null;
  S?.shell.close();
  ansicht = a;
  openAttrappe();
  if (text) meldung(text);
}

export function attrappeVorbelegen(z: SitzStand): void {
  if (!vorbelegt) return;
  const { einst: e, name, ziel, aufgabe } = vorbelegt;
  vorbelegt = null;
  z.agent = e.agent; z.modell = e.modell; z.effort = e.effort; z.rolle = e.rolle; z.rechte = e.rechte;
  z.name = e.rolle === "branch" ? name : ""; z.ziel = ziel;
  if (aufgabe) z.aufgabe = { ...z.aufgabe, ...Object.fromEntries(AUFGABE_FELDER.map(([k]) => [k, aufgabe[k] ?? ""])) };
}

// LINKS OBEN: wohin die Attrappe sonst führt, und von welchem Profil die Session ausgeht
// DIE ECHTEN PROFILE: was das Fenster als eigenes Profil mit Agent-MD am Server gespeichert hat (s.profile mit `datei`)
function echteProfile(s: St): Profil[] {
  return s.profile.filter((p: K15Profil) => !!p.datei).map((p: K15Profil) => ({ id: `echt-${p.id}`, name: p.name, echt: true as const, profilId: p.id,
    agent: p.agent ?? "claude", modell: p.modell ?? "", effort: p.effort ?? "", rolle: p.schiene === "bau" ? "branch" as const : "einfach" as const,
    rechte: rechte(RECHTE_STANDARD), md: p.datei ? p.datei.abschnitte.map((a) => [a.titel, a.text].filter((t) => t.trim()).join("\n")).join("\n\n") : "" }));
}
// ein Lauf aus der Historie mit Profil: es kommt, sobald das Fenster die gespeicherten Profile gelesen hat
let wunschProfil: string | null = null;

export function attrappeLinks(s: St): HTMLElement {
  const echt = echteProfile(s);
  if (wunschProfil) {
    const w = echt.find((p) => p.profilId === wunschProfil);
    if (w) { ausgehend = w; wunschProfil = null; }
  }
  const a = el("section", "ksabschn ksatt");
  const nav = el("div", "ksattnav");
  nav.append(el("span", "ksatttag", "Attrappe"));
  for (const [id, wort] of [["historie", "Historie"], ["system", "System"]] as const) {
    const b = el("button", "ksdetailk", wort) as HTMLButtonElement;
    b.type = "button";
    b.onclick = () => zurAttrappe(id);
    nav.append(b);
  }
  const h = el("h2", "", "Ausgehend von");
  h.title = "Ein Profil setzt Agent, Modell, Effort, was du machen willst und was er darf, und bringt seine Agent-MD mit.";
  const chips = el("div", "ksattchips");
  for (const p of [...echt, ...profile]) {
    const b = el("button", "ksattchip") as HTMLButtonElement;
    b.type = "button";
    b.setAttribute("aria-pressed", String(ausgehend?.id === p.id));
    b.append(el("span", "", p.name));
    if (p.echt) b.append(el("small", "ksattecht", "gespeichert"));
    else if (p.eigen) b.append(el("small", "", "eigen"));
    b.title = p.echt ? "Dein am Server gespeichertes Profil: seine Agent-MD kommt beim Start mit Claude Code mit." : "Erfundenes Profil der Attrappe.";
    b.onclick = () => {
      if (ausgehend?.id === p.id) { ausgehend = null; s.sitz.springen = true; render(); return; }
      vorbelegt = { einst: einstVon(p), name: p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), ziel: s.sitz.ziel };
      ausgehend = p;
      attrappeVorbelegen(s.sitz);
      s.sitz.springen = true;
      render();
    };
    chips.append(b);
  }
  a.append(nav, h, chips);
  return a;
}

// IM TEXT: die Agent-MD des Profils, als Datei unter „Auftrag“; was sie mitbringt, zählt in die Summe
export function attrappeModell(m: SitzungModell): SitzungModell {
  if (!ausgehend) return m;
  const text = ausgehend.md, tokens = new TextEncoder().encode(text).length / 2.1;
  const id = "attrappe-profil-md";
  const teil = { id, frage: "auftrag" as const, name: "Agent-MD des Profils", fach: null, zusatz: ausgehend.name, unter: null, mehr: [], herkunft: "du" as const, stand: "an" as const,
    fest: ausgehend.echt ? "Kommt beim Start mit Claude Code in den Systemprompt (server/agentmd.ts)."
      : "Attrappe: ein erfundenes Profil; nur ein gespeichertes bringt seine Agent-MD wirklich mit.", schalter: null, tokens, unbekannt: false };
  const block = { id, teil: id, frage: "auftrag" as const, ort: "dateien" as const, herkunft: "du" as const, titel: `Profil „${ausgehend.name}“ · Agent-MD${ausgehend.echt ? "" : " (Attrappe)"}`,
    text, laden: null, tokens, falte: 12, leise: false };
  const { summe } = m;
  return { teile: [teil, ...m.teile], bloecke: [block, ...m.bloecke], summe: { ...summe, alle: summe.alle + tokens,
    je: { ...summe.je, auftrag: summe.je.auftrag + tokens },
    herkunft: { ...summe.herkunft, auftrag: { ...summe.herkunft.auftrag, du: summe.herkunft.auftrag.du + tokens } } } };
}

// UNTEN: auch als Profil speichern
export function attrappeFuss(s: St): HTMLElement {
  const box = el("div", "ksattfuss");
  const l = el("label", "ksattals");
  const c = document.createElement("input");
  c.type = "checkbox";
  c.checked = alsProfil;
  l.append(c, el("span", "", "auch als Profil speichern"));
  const t = document.createElement("input");
  t.className = "ksein ksattname";
  t.value = profilName;
  t.placeholder = s.sitz.name.trim() || ausgehend?.name || "Name des Profils";
  t.oninput = () => { profilName = t.value; };
  t.hidden = !alsProfil;
  // ohne Neuzeichnen: das verlöre ein Feld, das gerade den Fokus abgibt, und mit ihm diesen Klick
  c.onchange = () => { alsProfil = c.checked; t.hidden = !alsProfil; if (alsProfil) t.focus(); };
  box.append(l, t);
  return box;
}

// NACH DEM ECHTEN START: der Lauf steht in der Historie, auf Wunsch das Profil unter „Ausgehend von“
// WAS DER START MITNIMMT: die Kennung eines gespeicherten Profils, wenn der Agent Claude Code ist (server/agentmd.ts)
export function attrappeProfil(s: St): { profil?: string } {
  const ag = s.sitz.agent || "claude";
  return ausgehend?.profilId && ag === "claude" ? { profil: ausgehend.profilId } : {};
}
// DER BRANCH, DEN DIE BRANCH-TÜR FORTSETZT: aus „Erneut starten“, solange Name und Repo die aus der Historie sind
export function attrappeFortsetzen(s: St): string | null {
  const f = fortsetzen, z = s.sitz;
  return f && z.rolle === "branch" && z.name.trim() === f.name && (!f.repo || s.repo === f.repo) ? f.branch : null;
}

export function attrappeGestartet(s: St, slot: number): void {
  const z = s.sitz;
  const einst: Einst = { agent: z.agent || "claude", modell: z.modell, effort: z.effort, rolle: z.rolle, rechte: z.rechte, md: ausgehend?.md ?? "" };
  const name = z.name.trim() || ausgehend?.name || `Slot ${slot}`;
  const pn = profilName.trim() || name;
  if (alsProfil) speichereProfil(pn, einst);
  zurAttrappe("historie", `${name} steht auf Slot ${slot}${alsProfil ? `, und das Profil „${pn}“ ist gespeichert` : ""}. Die Historie hat den Start.`);
}

function speichereProfil(name: string, e: Einst): void {
  profile = [...profile.filter((x) => !(x.eigen && x.name === name)), { ...e, id: `e${nr++}`, name, eigen: true }];
}
const wer = (e: Einst): string => `${agentWort(e.agent)} · ${e.modell ? modelLabel(e.modell) : "Standard-Modell"}`;
const stufeWort = (r: Rechte): string => RECHTE_STUFEN.find((x) => x.id === r.stufe)?.wort ?? r.stufe;

function feld(wort: string, f: HTMLElement, satz?: string): HTMLElement {
  const l = el("label", "attfeld");
  l.append(el("span", "attwort", wort), f);
  if (satz) l.append(el("span", "attsatz", satz));
  return l;
}

// ——— HISTORIE ———
// welche Einträge ihren Lauf aufgeklappt zeigen (src/lauf-ansicht.ts)
const offeneLaeufe = new Set<string>();
const wann = (d: Date): string => {
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  return min < 1 ? "gerade eben" : min < 60 ? `vor ${min} Min.` : min < 60 * 24 ? `vor ${Math.round(min / 60)} Std.` : Math.round(min / 60 / 24) === 1 ? "gestern" : `vor ${Math.round(min / 60 / 24)} Tagen`;
};
function historie(): HTMLElement {
  const col = el("div", "atthist");
  col.append(el("p", "attsatz", "Jeder Start am Server mit seinen Einstellungen, neueste zuerst. Von hier startest du ihn neu oder machst ein Profil daraus."));
  if (echte === "laedt" || echte === null) col.append(el("p", "attsatz", "wird gelesen …"));
  else if (!Array.isArray(echte)) col.append(el("p", "attsatz", `Die Historie ist nicht lesbar: ${echte.fehler}`));
  for (const x of alleLaeufe()) {
    const z = el("div", "attzeile");
    const kopf = el("div", "attzk");
    kopf.append(el("span", "attzn", x.name), el("span", `atttag ${x.status === "läuft" ? "an" : ""}`, x.status), ...(x.erfunden ? [el("span", "atttag", "erfunden")] : []),
      el("span", "attsatz", `${x.slot ? `Slot ${x.slot} · ` : ""}${wann(x.am)}`));
    z.append(kopf, el("div", "attsatz", `${x.profil} · ${wer(x.einst)} · ${x.einst.rolle === "branch" ? "an einem Ziel" : "einfach arbeiten"} · ${stufeWort(x.einst.rechte)}`), el("div", "attziel", x.ziel));
    if (x.aufgabe) z.append(el("div", "attsatz", `Aufgabe · ${aufgabeAlsText(x.aufgabe).split("\n").join(" · ")}`));
    if (x.lauf) z.append(el("div", "attsatz", x.lauf));
    const knoepfe = el("div", "attknoepfe");
    const laufId = x.laufId, offen = `${String(x.slot)}@${x.am.getTime()}`;
    if (laufId) {
      const zeigen = el("button", "attghost", offeneLaeufe.has(offen) ? "Lauf zuklappen" : "Lauf ansehen");
      zeigen.onclick = () => { if (!offeneLaeufe.delete(offen)) offeneLaeufe.add(offen); zeichne(); };
      knoepfe.append(zeigen);
    }
    const neu = el("button", "attghost", "Erneut starten");
    neu.onclick = () => zurNeuenSession(profilNamens(x.profil) ?? null, x.name, x.auftrag ?? "", x.einst, x.fort, x.aufgabe);
    const pr = el("button", "attghost", "Als Profil speichern");
    pr.onclick = () => { speichereProfil(x.name, x.einst); meldung(`Profil „${x.name}“ gespeichert; es steht jetzt in „Neue Session“ unter „Ausgehend von“.`); zeichne(); };
    knoepfe.append(neu, pr);
    z.append(knoepfe);
    if (laufId && offeneLaeufe.has(offen)) z.append(laufAnsicht(laufId, () => { if (ansicht === "historie") zeichne(); }));
    col.append(z);
  }
  return col;
}

// ——— 2 · SYSTEM ———
const profilVon = (id: string): Profil => profile.find((p) => p.id === id) ?? profile[3]!;
function alleK(ks: Knoten[]): Knoten[] { return ks.flatMap((k) => [k, ...alleK(k.kids)]); }
function system(): HTMLElement {
  const col = el("div", "attsys");
  const laufend = alleK(baum).filter((k) => k.status === "läuft").length + lose.length;
  const kopf = el("div", "attsyskopf");
  kopf.append(el("span", "attzn", `Läuft gerade: ${laufend} Sessions`), el("span", "attsatz", "Konstellation „Fleet heute“ v2 · gespeichert am Server"));
  const seg = el("div", "attseg");
  for (const s of ["locker", "streng"] as const) {
    const b = el("button", stil === s ? "on" : "", s);
    b.onclick = () => { stil = s; zeichne(); };
    seg.append(b);
  }
  kopf.append(feld("Stil", seg, stil === "streng" ? "Jede Session meldet nur an die über ihr." : "Geschwister lesen auch die Berichte der anderen."));
  col.append(kopf);
  const geplant = alleK(baum).filter((k) => k.status === "geplant");
  if (geplant.length) {
    const b = el("button", "attprim", `${geplant.length} geplante ${geplant.length === 1 ? "Session" : "Sessions"} starten`);
    b.onclick = () => {
      let slot = 14;
      const los = (ks: Knoten[]): Knoten[] => ks.map((k) => ({ ...k, ...(k.status === "geplant" ? { status: "läuft" as const, slot: slot++ } : {}), kids: los(k.kids) }));
      for (const k of geplant) laeufe.unshift({ id: nr++, name: k.name, profil: profilVon(k.profil).name, einst: einstVon(profilVon(k.profil)), am: new Date(), ziel: "(aus der Systemansicht)", slot: null, status: "läuft", erfunden: true });
      baum = los(baum);
      meldung("Gestartet; jede neue Session hängt unter der, die sie geöffnet hat, und steht in der Historie.");
      zeichne();
    };
    col.append(b);
  }
  const flaeche = el("div", "attflaeche");
  const ast = (k: Knoten, vater: Knoten | null): HTMLElement => {
    const a = el("div", "attast");
    const p = profilVon(k.profil);
    const karte = el("button", `attkarte${k.status === "geplant" ? " geplant" : ""}${gewaehlt === k.id ? " on" : ""}`);
    const top = el("span", "attkt");
    top.append(el("span", `attpunkt${k.status === "läuft" ? " an" : ""}`), el("span", "attzn", k.name), el("span", "attsatz", k.slot ? `Slot ${k.slot}` : "geplant"));
    karte.append(top, el("span", "attsatz", `${p.name} · ${wer(p)}`));
    if (vater) karte.append(el("span", "attkante", `meldet an ${vater.name}${stil === "locker" ? " · liest Geschwister" : ""}`));
    karte.onclick = () => { gewaehlt = gewaehlt === k.id ? null : k.id; zeichne(); };
    a.append(karte);
    if (gewaehlt === k.id) a.append(details(k, p));
    const kids = el("div", "attkids");
    for (const c of k.kids) kids.append(ast(c, k));
    // der Plus-Kasten unter einer Session, die schon Kinder hat, und unter der gewählten; sonst bliebe an jeder Karte einer stehen
    if (k.kids.length || gewaehlt === k.id || plusAn === k.id) kids.append(plus(k.id, k.name));
    if (kids.childElementCount) a.append(kids);
    return a;
  };
  for (const k of baum) flaeche.append(ast(k, null));
  flaeche.append(plus("wurzel", null));
  if (mitAuswertung) {
    const a = el("div", "attkarte attauswertung");
    const top = el("span", "attkt");
    top.append(el("span", "attpunkt"), el("span", "attzn", "Auswertung"), el("span", "atttag", "Standard"));
    a.append(top, el("span", "attsatz", "läuft am Ende · liest alle Nachrichten, Anweisungen und Berichte · meldet an Orchestrator"),
      el("span", "attsatz", "Context Pack „Konstellation ausbauen“: schlägt die nächste Fassung dieser Konstellation vor"));
    flaeche.append(a);
  }
  const ma = el("label", "attpack");
  const c = document.createElement("input");
  c.type = "checkbox"; c.checked = mitAuswertung;
  c.onchange = () => { mitAuswertung = c.checked; zeichne(); };
  ma.append(c, el("span", "", "Am Ende auswerten (Standard)"));
  col.append(flaeche, ma);
  const ohne = el("div", "attlose");
  ohne.append(el("span", "attwort", "Ohne Konstellation"));
  for (const x of lose) ohne.append(el("span", "attchip", `${x.name} · Slot ${x.slot}`));
  col.append(ohne);
  return col;
}
function details(k: Knoten, p: Profil): HTMLElement {
  const d = el("div", "attdetail");
  d.append(el("div", "attsatz", `Profil ${p.name}${p.eigen ? " (eigen)" : ""} · darf: ${stufeWort(p.rechte)} · Agent-MD ${p.md.split("\n").length} Zeilen`));
  const knoepfe = el("div", "attknoepfe");
  const auf = el("button", "attghost", "Einstellungen öffnen");
  auf.onclick = () => zurNeuenSession(p, k.name);
  knoepfe.append(auf);
  if (k.status === "geplant") {
    const weg = el("button", "attghost", "Wieder herausnehmen");
    weg.onclick = () => {
      const raus = (ks: Knoten[]): Knoten[] => ks.filter((x) => x.id !== k.id).map((x) => ({ ...x, kids: raus(x.kids) }));
      baum = raus(baum); gewaehlt = null; zeichne();
    };
    knoepfe.append(weg);
  }
  d.append(knoepfe);
  return d;
}
function plus(an: number | "wurzel", name: string | null): HTMLElement {
  const box = el("div", "attplusbox");
  if (plusAn !== an) {
    const b = el("button", "attplus", name ? `+  Session unter ${name}` : "+  Session für sich");
    b.onclick = () => { plusAn = an; zeichne(); };
    box.append(b);
    return box;
  }
  box.classList.add("offen");
  box.append(el("span", "attwort", "Welches Profil?"));
  for (const p of profile) {
    const b = el("button", "attchip", p.name);
    if (p.eigen) b.append(el("span", "atttag", "eigen"));
    b.onclick = () => {
      const neu = knoten(p.name, p.id, null, [], "geplant");
      const ein = (ks: Knoten[]): Knoten[] => ks.map((k) => k.id === an ? { ...k, kids: [...k.kids, neu] } : { ...k, kids: ein(k.kids) });
      baum = an === "wurzel" ? [...baum, neu] : ein(baum);
      plusAn = null;
      meldung(`${p.name} ist geplant${name ? ` unter ${name}` : ""}. „Starten“ oben öffnet sie.`);
      zeichne();
    };
    box.append(b);
  }
  const zu = el("button", "attghost", "Abbrechen");
  zu.onclick = () => { plusAn = null; zeichne(); };
  box.append(zu);
  return box;
}
