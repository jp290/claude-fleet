// K15 ENTWURF D (wegwerfbar, Starten nicht verdrahtet): die Neue-Session-UI in vier Spalten von links nach rechts, jede genauer als die
// davor: 1 Konstellation (src/k15-spalte1.ts) · 2 Aufbau (k15-spalte2.ts) · 3 Session (k15-spalte3.ts) · 4 Quelle (k15-spalte4.ts). Der
// Kopf liest sich „Neue Session in [Repo ▾]“ (k15-repo.ts). Satz → Element steht in docs/neuaufbau/befunde/k15-anforderungen.md, das
// Datenmodell in src/k15-entwurf-modell.ts, der Zustand in src/k15-zustand.ts. Spalten 3 und 4 lesen den echten Gründungsplan
// (GET /api/founding-plan) der Rolle im gewählten Repo; jeder Schalter geht als `bausteine` an den Server, der ihn prüft wie bei einem
// Start. Owner 16.10.: Merkstellen zurückgebaut, fehlt ein Thema, legt man einen Kontextpack an (k15-kontextpack.ts); Tokens und
// Einstellungen erst beim Darüberfahren, „[Zitat entfernt]“ blendet sie überall ein. Öffnen: #k15; #k15-eine (Konstellation „[Zitat entfernt]“
// ), #k15-export (Export offen), #k15-profil (ein Profil statt einer Position), #k15-minimal (MAIN + Session mit minimaler
// Anbindung), dazu -t0…-t3 für die Spalte am Handy und @<Pfad> für ein Repo ohne laufende Session. Was man hier ändert, lebt nur im
// Browser; nur „Repo hinzufügen“ pinnt den Ordner in Fleet (POST /api/pins). Dieses Modul ist der Einstieg von public/k15.js, das
// Haupt-Bundle lädt es beim ersten Öffnen nach (src/k15-lader.ts).
import { el, api, baseName } from "./k15-haupt";
import { icon } from "./icons";
import { openShell } from "./shell";
import { KONST0, PROFILE0, alle, fmt, herkunftVon } from "./k15-entwurf-modell";
import { dateiPasst } from "./k15-import";
import {
  S, SCHMAL, antwort, beimZeichnen, gehe, gewaehlt, lage, ladeEigenes, liesPins, plural, profilVon, repos, setzeS, toast, type St,
} from "./k15-zustand";
import { SPALTEN, geaendertTag, kennzeichen } from "./k15-teile";
import { legeMenue, menueZu, repoKopf, repoMenue } from "./k15-repo";
import { spalteLinks } from "./k15-spalte1";
import { spalteAufbau } from "./k15-spalte2";
import { gemerktesDetail, spalteSession } from "./k15-spalte3";
import { ANSICHTEN, spalteQuelle } from "./k15-spalte4";
import { exportPanel, nimm } from "./k15-export";
import { ablaufNimmt, ablaufPanel } from "./k15-agentmd";
import { anatomieKurz, anatomieVon } from "./k15-anatomie-ui";

const RUNDGANG_KEY = "fleet.k15.rundgang";
// „Alles zeigen“ bleibt im Browser wie der Detailgrad; wer vorher den Detailgrad „Text“ gewählt hatte, sieht weiter alles
const ALLES_KEY = "fleet.k15.alles";
function gemerktesAlles(): boolean {
  try { return localStorage.getItem(ALLES_KEY) === "1" || (localStorage.getItem(ALLES_KEY) === null && localStorage.getItem("fleet.k15.detail") === "text"); } catch { return false; }
}
function setzeAlles(s: St, an: boolean): void {
  s.alles = an;
  try { localStorage.setItem(ALLES_KEY, an ? "1" : "0"); } catch { /* ohne Speicher gilt die Wahl bis zum Schließen */ }
  render();
}

export function openK15Entwurf(): void {
  if (S) return;
  // was das Fenster an document und matchMedia hängt, löst es beim Schließen wieder (Prüfung Punkt 11)
  const zu = new AbortController();
  const shell = openShell({ id: "found", title: "Neue Session", subtitle: "", onClose: () => { zu.abort(); setzeS(null); } });
  shell.root.classList.add("k15");
  shell.root.querySelector(".shellclose")?.replaceChildren(icon("x"));
  // keine Flocken hinter den Spalten (Bauleitung 15.10., AAA „ruhig“)
  const h = location.hash.match(/^#k15(?:-(eine|export|profil|minimal))?(?:-t([0-3]))?(?:@(\/[^#]+))?/);
  const konst = structuredClone(KONST0);
  const k = konst.find((x) => x.id === (h?.[1] === "eine" ? "eine" : h?.[1] === "minimal" ? "main-eigen" : "orch")) ?? konst[0];
  let repo: string | null = null;
  try { repo = h?.[3] ? decodeURIComponent(h[3]) : null; } catch { repo = null; }
  const s: St = { shell, konst, profile: structuredClone(PROFILE0), k,
    sel: h?.[1] === "eine" ? { art: "pos", id: "s" } : h?.[1] === "profil" ? { art: "profil", id: "lane" } : h?.[1] === "minimal" ? { art: "pos", id: "e" } : { art: "pos", id: "l2" },
    quelle: h?.[1] === "profil" ? "einst" : "landet",
    offen: new Set<string>(),
    exp: h?.[1] === "export", ebene: "konst", voll: false, tief: Number(h?.[2] ?? 0), neuAb: 4, profilNeu: new Set(), konstNeu: new Set(), toastT: 0,
    aktiv: h?.[1] ? 2 : 0, bst: null, tour: rundgangGesehen() ? null : 0, detail: gemerktesDetail(), alles: gemerktesAlles(),
    repo: repo ?? repos()[0] ?? null, env: undefined, fleetModell: null, plaene: new Map(),
    pins: null, infos: new Map(), repoMenu: false, ordner: null,
    fassungen: new Map(), packs: [], bearbeite: null, bearbeiteText: null, packEdit: null, ablauf: null, warnAm: 0, speicher: "laedt" };
  setzeS(s);
  ladeEigenes(s);
  beimZeichnen(render);
  void liesPins(s);
  void api("/api/machine-settings").then((r) => r.ok ? r.json() : null).then((j: unknown) => {
    const liste = j && typeof j === "object" && "settings" in j && Array.isArray(j.settings) ? j.settings : null;
    const wert = (name: string): unknown => {
      const x: unknown = liste?.find((y: unknown) => !!y && typeof y === "object" && "name" in y && y.name === name);
      return x && typeof x === "object" && "value" in x ? x.value : undefined;
    };
    const m = wert("FLEET_MIGRATE_PCT"), l = wert("FLEET_LANE_MIGRATE_PCT"), f = wert("FLEET_MODEL");
    if (S !== s) return;
    s.env = typeof m === "number" && typeof l === "number" ? { migratePct: m, laneMigratePct: l } : null;
    s.fleetModell = typeof f === "string" ? f : null;
    render();
  }).catch(() => { if (S === s) { s.env = null; render(); } });
  kopf(s);
  ablage(s, zu.signal);
  menueZu(s, zu.signal);
  SCHMAL.addEventListener("change", render, { signal: zu.signal });
  render();
}

function kopf(s: St): void {
  const box = el("div", "k15hb");
  const imp = el("button", "k15hbtn");
  imp.title = "JSON, Ordner oder .md hineinziehen oder mit ⌘V einfügen; es landet auf seiner Ebene";
  imp.append(icon("export"), el("span", "", "Importieren"));
  imp.onclick = () => toast("Zieh eine exportierte JSON-Datei, eine .md oder einen Ordner ins Fenster, oder füge JSON mit ⌘V ein.");
  const exp = el("button", "k15hbtn k15exp");
  exp.append(icon("share"), el("span", "", "Exportieren"));
  exp.onclick = () => { s.exp = !s.exp; render(); };
  const tour = el("button", "k15hbtn k15tourb");
  tour.title = "Rundgang: die vier Spalten in fünf Schritten";
  tour.append(icon("info"), el("span", "", "Rundgang"));
  tour.onclick = () => { s.tour = 0; s.exp = false; gehe(0, 4); };
  // ALLES ZEIGEN (Owner 16.10.: „[Zitat entfernt]“): Tokens, Größen,
  // Einstellungen und Erklärungen, die sonst erst beim Darüberfahren erscheinen, in allen Spalten
  const alles = el("button", "k15hbtn k15alleb");
  alles.title = "Tokens, Einstellungen und Erklärungen überall zeigen, nicht erst beim Darüberfahren";
  alles.append(icon("list"), el("span", "", "Alles zeigen"));
  alles.onclick = () => setzeAlles(s, !s.alles);
  box.append(tour, alles, imp, exp);
  s.shell.root.querySelector(".shellclose")?.before(box);
}

// HINEINZIEHEN UND EINFÜGEN: eine .md wird die eigene Datei der gewählten Session, ein JSON landet auf seiner Ebene
function ablage(s: St, signal: AbortSignal): void {
  const win = s.shell.root.querySelector<HTMLElement>(".shellwin");
  if (!win) return;
  const ov = el("div", "k15ov");
  win.append(ov);
  let tiefe = 0;
  const dateien = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
  const zeig = (on: boolean) => {
    const { q } = gewaehlt(s);
    ov.replaceChildren(el("div", "k15ovt", "Loslassen"),
      el("div", "k15ovs", `Eine .md wird die eigene Datei von ${q ? q.name : "der gewählten Session"}. Eine exportierte JSON-Datei landet auf ihrer Ebene. Ein Ordner wird eine eigene Rolle.`));
    ov.classList.toggle("on", on);
  };
  win.addEventListener("dragenter", (e) => { if (!dateien(e)) return; e.preventDefault(); tiefe++; zeig(true); });
  win.addEventListener("dragover", (e) => { if (dateien(e)) e.preventDefault(); });
  win.addEventListener("dragleave", (e) => { if (dateien(e) && --tiefe <= 0) { tiefe = 0; zeig(false); } });
  win.addEventListener("drop", (e) => {
    if (!dateien(e)) return;
    e.preventDefault();
    tiefe = 0;
    zeig(false);
    const entry = e.dataTransfer?.items[0]?.webkitGetAsEntry?.();
    if (entry?.isDirectory) { toast(`Ordner „${entry.name}“: wird eine eigene Rolle, sobald der Server-Teil steht.`); return; }
    const f = e.dataTransfer?.files[0];
    if (!f) return;
    const passt = dateiPasst(f.name, f.size);
    if (passt) { toast(passt); return; }
    if (ablaufNimmt(s, f)) return;
    f.text().then((t) => nimm(f.name, t)).catch(() => toast(`${f.name}: Der Browser konnte die Datei nicht lesen.`));
  });
  document.addEventListener("paste", (e) => {
    if (S !== s || (e.target instanceof Element && e.target.closest("input,textarea"))) return;
    const t = e.clipboardData?.getData("text") ?? "";
    if (!t.trim().startsWith("{")) return;
    const passt = dateiPasst("eingefügt.json", new TextEncoder().encode(t).length);
    if (passt) toast(passt); else nimm("eingefügt.json", t);
  }, { signal });
}

function render(): void {
  const s = S;
  if (!s) return;
  if (!s.repo) s.repo = repos()[0] ?? null;
  s.shell.root.classList.toggle("k15alles", s.alles);
  s.shell.root.querySelector(".k15alleb")?.classList.toggle("on", s.alles);
  s.shell.root.querySelector(".k15alleb")?.setAttribute("aria-pressed", String(s.alles));
  s.shell.root.querySelector(".k15exp")?.classList.toggle("on", s.exp);
  s.shell.root.querySelector(".k15menu")?.remove();
  s.shell.root.querySelector(".k15repomenu")?.remove();
  repoKopf(s);
  const d = s.shell.detail;
  const scroll = [...d.querySelectorAll<HTMLElement>(".k15col")].map((c) => c.scrollTop);
  // DAS NEUZEICHNEN HÄLT, WO MAN TIPPT (Prüfung Punkt 3): das Feld mit Fokus (data-feld) samt Auswahl und der Scroll im Ablauf
  const fokus = document.activeElement;
  const feld = (fokus instanceof HTMLInputElement || fokus instanceof HTMLTextAreaElement) && s.shell.root.contains(fokus) && fokus.dataset.feld
    ? { name: fokus.dataset.feld, von: fokus.selectionStart, bis: fokus.selectionEnd, oben: fokus.scrollTop } : null;
  const abAlt = d.querySelector<HTMLElement>(".k15abin");
  const abOben = abAlt && abAlt.dataset.schritt === String(s.ablauf?.schritt) ? abAlt.scrollTop : null;
  const schmal = SCHMAL.matches;
  // erst alles bauen, dann ersetzen: wirft ein Teil, bleibt das Fenster, wie es war (Prüfung Punkt 1)
  const teile: HTMLElement[] = [];
  if (schmal && s.tief > 0) teile.push(brotkrumen(s));
  const grid = el("div", "k15d");
  grid.dataset.tief = String(s.tief);
  grid.dataset.aktiv = String(s.aktiv);
  const ansichten = ANSICHTEN.map((x) => x.id);
  const cols = [spalteLinks(), spalteAufbau(ansichten), spalteSession(), spalteQuelle()];
  cols.forEach((c, i) => {
    c.dataset.i = String(i);
    c.classList.toggle("aktiv", i === s.aktiv);
    // die Spalte, in der man arbeitet, wird die aktive, ohne neu zu zeichnen
    c.addEventListener("pointerdown", () => {
      if (s.aktiv === i) return;
      s.aktiv = i;
      grid.dataset.aktiv = String(i);
      cols.forEach((x, j) => x.classList.toggle("aktiv", j === i));
    });
    if (i >= s.neuAb) c.classList.add("k15neu");
    else if (scroll[i] && !schmal) requestAnimationFrame(() => { c.scrollTop = scroll[i]; });
  });
  s.neuAb = 4;
  grid.append(...cols);
  teile.push(grid);
  if (s.exp) teile.push(exportPanel());
  // der Ablauf dunkelt das Fenster ab und hält Klicks von den Spalten fern, bis er gespeichert oder geschlossen ist
  if (s.ablauf) teile.push(el("div", "k15abdim"), ablaufPanel());
  d.replaceChildren(...teile);
  const abNeu = d.querySelector<HTMLElement>(".k15abin");
  if (abNeu && abOben !== null) abNeu.scrollTop = abOben;
  const wieder = feld ? s.shell.root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-feld="${CSS.escape(feld.name)}"]`) : null;
  if (feld && wieder) {
    wieder.focus({ preventScroll: true });
    try { wieder.setSelectionRange(feld.von, feld.bis); } catch { /* ein Feld ohne Auswahl (z. B. eine Zahl) */ }
    wieder.scrollTop = feld.oben;
  }
  const ziel = s.quelle === "bst" ? cols[3].querySelector<HTMLElement>(".k15bst.ziel") : s.quelle === "packs" && s.packEdit ? cols[3].querySelector<HTMLElement>(".k15packed") : null;
  if (ziel) requestAnimationFrame(() => ziel.scrollIntoView({ block: s.quelle === "bst" ? "center" : "nearest" }));
  const f = s.shell.foot;
  f.replaceChildren();
  f.classList.add("k15foot");
  const n = alle(s.k.wurzeln).length;
  const say = el("span", "k15say");
  say.append(el("span", "k15sayk", s.k.name), ...kennzeichen(herkunftVon(s.k), s.k.v), ...(s.konstNeu.has(s.k.id) ? [geaendertTag("ungespeicherte Änderung am Aufbau")] : []),
    el("span", "", ` ${plural(n, "Session", "Sessions")} · ${s.repo ? baseName(s.repo) : "kein Repo"} · neuer Branch aus main`));
  const go = el("button", "k15go", n === 1 ? "Starten" : `${n} Sessions starten`);
  go.title = "Entwurf: Starten ist hier nicht verdrahtet";
  go.onclick = () => toast("Entwurf: Starten ist hier nicht verdrahtet.");
  const rechts = el("div", "k15footr");
  rechts.append(tokenSumme(s), go);
  f.append(say, rechts);
  const menue = repoMenue(s);
  if (menue) legeMenue(s, menue);
  s.shell.root.querySelector(".k15tour")?.remove();
  if (s.tour !== null) requestAnimationFrame(() => rundgang(s));
}

// DIE TOKEN-SUMME UNTEN (Owner 11:1x: „[Zitat entfernt]“): je Session die Start-Summe ihres
// Gründungsplans, Fleets Teil geschätzt, Claude Codes Teil gemessen
function tokenSumme(s: St): HTMLElement {
  const box = el("div", "k15tok");
  const je = alle(s.k.wurzeln).map((q) => {
    const l = lage(s, profilVon(s, q.profil), q);
    const a = l ? antwort(l.plan) : null;
    return { q, sum: a?.startSumme, cca: a ? anatomieVon(a.claudeCode) : null };
  });
  const offen = je.filter((x) => typeof x.sum?.tokens !== "number").length;
  const summe = je.reduce((n, x) => n + (typeof x.sum?.tokens === "number" ? x.sum.tokens : 0), 0);
  const fleetTeil = je.reduce((n, x) => n + (x.sum?.fleetTokens ?? 0), 0);
  box.append(el("span", "k15tokw", offen ? "Start: wird gelesen …" : `Start ${fmt(summe)}`),
    el("span", "k15toks", offen ? plural(offen, "Session fehlt", "Sessions fehlen") : `davon Fleet ${fmt(fleetTeil)}`));
  box.title = [`Was alle ${plural(je.length, "Session", "Sessions")} beim Start mitladen, je aus ihrem Gründungsplan: Fleets Teil geschätzt, Claude Codes Teil gemessen.`,
    // je Session dieselbe Aufschlüsselung wie in „Wo es landet“: was Claude Code selbst mitbringt, Gruppe für Gruppe
    ...je.map((x) => `${x.q.name}: ${typeof x.sum?.tokens === "number" ? fmt(x.sum.tokens) : "wird gelesen"}${x.cca ? `\n  Claude Code: ${anatomieKurz(x.cca)}` : ""}`)].join("\n");
  return box;
}

// DER RUNDGANG (Owner 11:1x: „[Zitat entfernt]“): einmal von selbst,
// danach über den Knopf „[Zitat entfernt]“; ein Hinweis mit Pfeil je Schritt, die Seite bleibt bedienbar
const RUNDGANG: readonly { spalte: number; ziel: string; titel: string; text: string }[] = [
  { spalte: 0, ziel: ".k15c1 .k15konst.on", titel: "Konstellation",
    text: "Oben steht, in welchem Repo die neue Session startet. Hier wählst du, welche Sessions zusammenarbeiten. „Fleet“ heißt mitgeliefert; eine Kopie wird deine eigene." },
  { spalte: 1, ziel: ".k15c2 .k15baum", titel: "Aufbau",
    text: "Wer wem meldet: oben die Session, die anleitet, darunter die, die an sie melden. Modell und Übergabe einer Session siehst du, wenn du über ihre Karte fährst." },
  { spalte: 2, ziel: ".k15c3 .k15grs0", titel: "Was die Session bekommt",
    text: "Die Bausteine nach Gruppen: wofür sie da sind. Jedes Kästchen ist ein Baustein, kräftig heißt Pflicht. Tokens und Erklärungen erscheinen beim Darüberfahren; „Alles zeigen“ oben blendet sie überall ein." },
  { spalte: 3, ziel: ".k15c4 .k15vseg", titel: "Wo es landet",
    text: "Hier steht, wo jeder Baustein ankommt: im Systemprompt, in einer Datei, die Claude Code lädt, in der Session-Datei oder in der ersten Nachricht. „Wortlaut“ zeigt den Text; fehlt ein Thema, legst du unter „Packs“ einen Kontextpack an." },
  { spalte: -1, ziel: ".k15foot .k15tok", titel: "Starten",
    text: "Unten steht, wie viele Tokens alle Sessions zusammen beim Start mitladen. Starten öffnet sie." },
];
function rundgangGesehen(): boolean {
  try { return localStorage.getItem(RUNDGANG_KEY) === "1"; } catch { return false; }
}
function rundgangEnde(s: St): void {
  s.tour = null;
  try { localStorage.setItem(RUNDGANG_KEY, "1"); } catch { /* ohne Speicher kommt der Rundgang beim nächsten Öffnen wieder */ }
  s.shell.root.querySelector(".k15tour")?.remove();
  render();
}
function rundgang(s: St): void {
  const win = s.shell.root.querySelector<HTMLElement>(".shellwin");
  if (!win || s.tour === null || S !== s) return;
  win.querySelector(".k15tour")?.remove();
  const schritt = RUNDGANG[s.tour];
  const ziel = win.querySelector<HTMLElement>(schritt.ziel) ?? win.querySelector<HTMLElement>(`.k15col[data-i="${schritt.spalte}"] .k15lab`);
  const b = el("div", "k15tour");
  b.setAttribute("role", "dialog");
  b.setAttribute("aria-label", `Rundgang, Schritt ${s.tour + 1} von ${RUNDGANG.length}`);
  const kopfz = el("div", "k15tourk");
  kopfz.append(el("span", "k15touri", `${s.tour + 1} / ${RUNDGANG.length}`), el("span", "k15tourt", schritt.titel));
  const knoepfe = el("div", "k15tourb");
  const weg = el("button", "k15link", "Überspringen");
  weg.onclick = () => rundgangEnde(s);
  const weiter = el("button", "k15ghost k15tourw", s.tour + 1 < RUNDGANG.length ? "Weiter" : "Fertig");
  weiter.onclick = () => {
    if (s.tour === null || s.tour + 1 >= RUNDGANG.length) { rundgangEnde(s); return; }
    s.tour += 1;
    const n = RUNDGANG[s.tour].spalte;
    if (n === 2 && s.sel.art === "pos" && !alle(s.k.wurzeln).some((x) => x.id === s.sel.id)) s.sel = { art: "pos", id: alle(s.k.wurzeln)[0]?.id ?? "" };
    if (n === 3) s.quelle = "landet";
    gehe(n < 0 ? s.tief : n, 4);
  };
  knoepfe.append(weg, weiter);
  b.append(kopfz, el("div", "k15tourx", schritt.text), knoepfe);
  win.append(b);
  if (!ziel || SCHMAL.matches) { b.classList.add("unten"); return; }
  ziel.classList.add("k15tourziel");
  setTimeout(() => ziel.classList.remove("k15tourziel"), 1600);
  const z = ziel.getBoundingClientRect(), w = win.getBoundingClientRect(), bw = b.offsetWidth, bh = b.offsetHeight;
  const unten = schritt.spalte < 0;
  const rechtsPlatz = w.right - z.right > bw + 28;
  const x = unten ? Math.min(z.left - w.left + z.width / 2 - bw / 2, w.width - bw - 12) : rechtsPlatz ? z.right - w.left + 14 : z.left - w.left - bw - 14;
  const y = unten ? z.top - w.top - bh - 14 : Math.min(Math.max(12, z.top - w.top + Math.min(z.height, 120) / 2 - 28), w.height - bh - 12);
  b.classList.add(unten ? "pfeil-unten" : rechtsPlatz ? "pfeil-links" : "pfeil-rechts");
  b.style.left = `${Math.max(12, x)}px`;
  b.style.top = `${y}px`;
  if (!unten) b.style.setProperty("--pfeil-y", `${Math.max(14, Math.min(bh - 14, z.top - w.top + Math.min(z.height, 120) / 2 - y))}px`);
}

// AM HANDY: eine Spalte nach der anderen; oben der Weg zurück
function brotkrumen(s: St): HTMLElement {
  const bar = el("div", "k15crumb");
  const { q, p } = gewaehlt(s);
  const b = el("button", "k15crumbb");
  b.append(icon("chevron"), el("span", "", SPALTEN[s.tief - 1]));
  b.onclick = () => gehe(s.tief - 1, 4);
  const weg = [s.k.name, q ? q.name : `Profil ${p.name}`].slice(0, s.tief);
  bar.append(b, el("span", "k15crumbw", weg.join(" › ")));
  return bar;
}
