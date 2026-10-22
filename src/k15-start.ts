// K15 · STARTEN (Runde 5, Owner 17.10.: „[Zitat entfernt]“ → das Fenster löst das alte Startfenster ab,
// „[Zitat entfernt]“). Starten startet die gewählte Session des Aufbaus über die Tür ihrer Rolle (src/start-tuer.ts), mit genau den Werten,
// mit denen das Fenster ihren Plan las: Repo, Rolle, Agent, Modell, Effort und die Schalter, dazu was nur ihre Tür braucht (Program einer
// MAIN, Name und Ziel einer Branch-Session, der Worktree einer fortgesetzten Lane). Was keine Tür mitnimmt, ist nicht wählbar und sagt in
// einem Satz, warum: das Fenster startet dann nicht, statt es still zu übergehen. Mehrere Sessions als Einheit startet Fleet noch nicht
// (k15-entwurf-modell.ts#OHNE_KIND_OEFFNEN); der Knopf nennt die eine, die startet.
import { el, api, flotte, baseName, starte, liesPrograms, liesAndere, waehlbar, progSagt, zeigeSlot, meldung } from "./k15-haupt";
import { icon } from "./icons";
import { knopf } from "./k15-teile";
import type { Answer } from "./founding";
import type { Auftrag, ProgZeile } from "./start-tuer";
import type { BranchOtherView } from "./protocol";
import type { Eingang } from "./k15-lader";
import { S, agentMdKommt, antwort, dreier, info, lage, render, rollenStandardGelesen, schwelleWahl, wahlVon, type Lage, type St } from "./k15-zustand";
import { PROFILE0, alle, aspektName, eltern, type Position, type Profil } from "./k15-entwurf-modell";
import { eigeneVon } from "./k15-wortlaut-ui";
import { bindeLauf, laufSatz } from "./k15-lauf";
import { agentVon, agentWort, standardAgent } from "./k15-agent";
import { modelLabel } from "./modelname";
import { fassungZeile } from "./fassung-zeile";

export interface StartStand {
  busy: boolean; fehler: string | null;
  progs: { zeilen: ProgZeile[]; inaktiv: number } | { fehler: string } | null; progSeq: number; program: string | null;
  wt: "neu" | "fort"; worktree: string | null;
  branch: {
    modus: "neu" | "bestehend"; name: string; ziel: string; punkte: string; wahl: string | null;
    andere: { repo: string; zeilen: BranchOtherView[]; gesamt: number } | { repo: string; fehler: string } | null;
    // der Branch, den der Server schon anlegte, als seine Session nicht startete: der nächste Klick startet nur die Session
    gemacht: { repo: string; branch: string } | null; vorhanden: { branch: string; name: string } | null;
  };
}
export const startStand0 = (): StartStand => ({ busy: false, fehler: null, progs: null, progSeq: 0, program: null, wt: "neu", worktree: null,
  branch: { modus: "neu", name: "", ziel: "", punkte: "", wahl: null, andere: null, gemacht: null, vorhanden: null } });

type Tuer = "branch" | "lane" | "main" | "open";
// die Tür je Profil: die Branch-Session (Schiene bau) über /api/branches, sonst die Tür ihrer Rolle
export const tuerVon = (p: Profil): Tuer => p.schiene === "bau" ? "branch" : p.rolle === "lane" ? "lane" : p.rolle === "main" ? "main" : "open";
// das Wort, mit dem der Server die Orchestratorin erkennt (server.ts#isOrchestratorLabel)
const ORCH_LABEL = "Orchestrator";

// WAS STARTET: die gewählte Session; ist ein Profil gewählt, die eine Session des Aufbaus, wenn er nur eine hat
export function startZiel(s: St): { q: Position; p: Profil } | null {
  const ps = alle(s.k.wurzeln);
  const q = s.sel.art === "pos" ? ps.find((x) => x.id === s.sel.id) : ps.length === 1 ? ps[0] : undefined;
  if (!q) return null;
  return { q, p: s.profile.find((x) => x.id === q.profil) ?? s.profile[0] };
}
const lanePlatz = (e: Eingang | null): number | undefined => e && "slot" in e ? e.slot : undefined;
const vonPlus = (e: Eingang | null): { repo: string; parent?: { slot: number; openedAt: number } } | null => e && "repo" in e ? e : null;
// der freie Platz für /open und bootstrap-main: der angeklickte, sonst der erste freie der Leiste
function freierPlatz(s: St): number | null {
  const e = lanePlatz(s.eingang);
  if (e !== undefined && !flotte().find((x) => x.id === e)?.cwd) return e;
  return flotte().find((x) => !x.cwd)?.id ?? null;
}
const orchLaeuft = () => flotte().find((x) => x.cwd && x.role === "orchestrator");

// die Ablehnungen der Tür in Owner-Worten: welche Bausteine sie trotz des Plans liefern würde
function abgelehnt(a: Answer): string[] {
  const w: string[] = [];
  for (const r of a.start.refusals) {
    const id = /^([a-z0-9:._-]+) /i.exec(r)?.[1];
    const wort = (id ? a.plan.bausteine.find((b) => b.id === id)?.wort : undefined) ?? r;
    if (!w.includes(wort)) w.push(wort);
  }
  return w;
}
// Nur Ordner, solange ihre Tür den Plan nicht so starten kann: über das bestehende /open ohne Plan, und ein Satz sagt, was es trotzdem gibt
const ohnePlan = (p: Profil, a: Answer): boolean => tuerVon(p) === "open" && p.rolle === "nur-ordner" && !a.start.startbar;

// WAS KEINE TÜR MITNIMMT: Agent, Modell und Effort gehen als Felder mit, die Schalter im Plan (nur bei den Türen, die einen nehmen). Alles
// andere, was an dieser Session oder ihrem Profil geändert ist, käme nicht an — es steht hier, und gestartet wird erst ohne es
function nichtMit(s: St, p: Profil, q: Position, l: Lage, a: Answer): string[] {
  const out: string[] = [];
  const t = tuerVon(p);
  if ((t === "main" || t === "branch") && Object.keys(l.sch).length)
    out.push(`geänderte Bausteine (die Tür ${t === "main" ? "der MAIN" : "der Branch-Session"} nimmt keinen Plan)`);
  // die Datei der Session ist oft die des Profils (k15-agentmd.ts speichert beide): dann kommt sie mit dem Profil (Partner 20.10.)
  if (q.datei && !(agentMdKommt(s, p, q) && JSON.stringify(q.datei) === JSON.stringify(p.datei))) out.push(`die Datei ${q.datei.titel}`);
  // die Agent-MD eines gespeicherten Profils nimmt die Tür über `profil` mit (server/agentmd.ts), bei Claude Code und außer bei MAIN und Lane
  if (p.datei && !agentMdKommt(s, p, q)) out.push(`die Agent-MD ${p.datei.titel}`);
  else if (!p.datei && p.id === "eigen") out.push("deine Agent-MD");
  if (p.autonomie) out.push("deine Fassung der Autonomie");
  const fleet = PROFILE0.find((x) => x.id === p.id)?.werte ?? {};
  const werte = [...Object.keys(q.werteAbw ?? {}), ...Object.keys(p.werte).filter((k) => JSON.stringify(p.werte[k]) !== JSON.stringify(fleet[k]))];
  if (werte.length) out.push([...new Set(werte)].map(aspektName).join(", "));
  // die Schwelle setzt das Fenster nach dem Start über die Owner-Tür des Slots (PATCH …/handover); das Band gibt es nur für Claude Code
  if ((typeof q.abw?.schwelle === "number" || typeof p.schwelle === "number") && wahlVon(s, p, q, "agent").wert !== "claude") out.push("die Succession-Schwelle");
  if (q.ohne?.length) out.push("weggelassene Teile der Session-Datei");
  const eigene = eigeneVon(s, p, q, a).size;
  if (eigene) out.push(`eigene Fassungen in ${eigene === 1 ? "einem Baustein" : `${eigene} Bausteinen`}`);
  return out;
}


// OB DIESER START JETZT GEHT — null, wenn ja. Der Satz steht neben dem Knopf, nie nur als graues Bedienelement
export function startBlocker(s: St): string | null {
  const z = startZiel(s);
  if (!z) return "Wähle im Aufbau die Session, die startet.";
  const { q, p } = z;
  const t = tuerVon(p);
  if (!s.repo) return "Wähle oben, in welchem Repo die Session startet.";
  const i = info(s, s.repo);
  if (typeof i === "object" && "git" in i && !i.git) return "Hier ist kein Git-Repo — eine Session mit Plan braucht eins.";
  const plus = vonPlus(s.eingang);
  if (plus?.parent && t !== "lane") return `⎇+ hängt eine Lane unter Slot ${plus.parent.slot} — wähle im Aufbau eine Lane.`;
  if (p.rolle === "orchestratorin" && orchLaeuft()) return `Die Orchestratorin läuft schon auf Slot ${orchLaeuft()!.id}.`;
  if ((t === "open" || t === "main") && freierPlatz(s) === null) return "Kein freier Platz in der Leiste.";
  if (t === "main") {
    const pr = s.start.progs;
    if (!pr) return "Die Programs werden gelesen …";
    if ("fehler" in pr) return `${pr.fehler} Ohne sie wird keine MAIN gegründet.`;
    const x = pr.zeilen.find((y) => y.id === s.start.program);
    if (!x) return pr.zeilen.some(waehlbar) ? "Wähle das Program, dessen MAIN du gründest." : "Kein aktives Program ohne lebende MAIN.";
    if (!waehlbar(x)) return `„${x.titel}“ ist nicht wählbar: ${progSagt(x)}.`;
  }
  const agent = wahlVon(s, p, q, "agent").wert;
  const ka = s.katalog ? agentVon(s.katalog, agent) : undefined;
  if (ka?.aus) return `${agentWort(agent)} startet hier nicht: ${ka.aus.grund}.`;
  if (t === "lane" && ka && !ka.lanes) return `${agentWort(agent)} läuft nur als Haupt-Session, nicht als Lane.`;
  if (t === "lane" && s.start.wt === "fort")
    return !s.start.worktree ? "Wähle den Worktree, der weiterlaufen soll." : rollenStandardGelesen(s, p) ? null : "Der Plan für diesen Start wird gelesen …";
  if (t === "branch") {
    const b = s.start.branch;
    if (b.modus === "bestehend" && !b.wahl) return "Wähle den Branch, auf dem die Session weiterarbeitet.";
    if (!b.name.trim()) return "Gib dem Branch einen Namen für das Board.";
  }
  const l = lage(s, p, q);
  if (!l) return "Wähle oben, in welchem Repo die Session startet.";
  if (typeof l.plan === "object" && "fehler" in l.plan) return `Der Plan für diesen Start ist nicht lesbar: ${l.plan.fehler}`;
  const a = antwort(l.plan);
  // ohne den Standard der Rolle schickte der Start nur, was gesetzt ist (k15-zustand.ts#dreier)
  if (!a || !rollenStandardGelesen(s, p)) return "Der Plan für diesen Start wird gelesen …";
  const weg = nichtMit(s, p, q, l, a);
  if (weg.length) return `So startet keine Tür: ${weg.join(", ")} käme nicht an. Nimm es zurück oder wähle eine andere Session.`;
  if ((t === "lane" || t === "open") && !a.start.startbar && !ohnePlan(p, a))
    return `Diese Tür startet den Plan noch nicht genau so: sie liefert trotzdem ${abgelehnt(a).join(", ")}.`;
  return null;
}

// WAS NEBEN DEM START GESAGT GEHÖRT, ohne ihn aufzuhalten: dass nur diese eine Session startet, wer den Platz wählt, was eine Tür ohne
// Plan trotzdem gibt
export function startHinweis(s: St): string | null {
  const z = startZiel(s);
  if (!z) return null;
  const { q, p } = z;
  const t = tuerVon(p);
  const n = alle(s.k.wurzeln).length;
  const vater = eltern(s.k, q.id);
  if (n > 1) return `Startet nur ${q.name}${vater ? `, ohne dass sie an ${vater.name} meldet` : ""}: mehrere Sessions als Einheit startet Fleet noch nicht — keine Session öffnet ihre Kinder, und kein Kind meldet an sie.`;
  if (t === "main") return "Den Platz wählt der Server. Die Tür der MAIN nimmt keinen Plan: sie gibt, was bootstrap-main heute gibt.";
  if (t === "lane" && s.start.wt === "fort") return "Setzt den Worktree fort, ohne neuen Plan: Bausteine und Schalter gelten für ihn nicht.";
  if (t === "branch") return flotte().some((x) => !x.cwd) ? "Die Tür der Branch-Session nimmt keinen Plan; das Ziel geht als erste Nachricht an sie."
    : "Alle Plätze sind belegt — der Branch entsteht mit seinen Punkten, die Session startest du, sobald ein Platz frei ist.";
  const l = lage(s, p, q);
  const a = l ? antwort(l.plan) : null;
  if (a && ohnePlan(p, a)) return `Startet ohne Plan über die bestehende Tür; sie gibt heute trotzdem ${abgelehnt(a).join(", ")} mit.`;
  return null;
}

// DIE FASSUNG, DIE DAS FENSTER ZEIGT UND DER START MITSCHICKT: dieselbe Regel für die Zeile im Fuß und für den Auftrag (nur die offene Tür)
const fassungGezeigt = (p: Profil, a: Answer): string | null =>
  tuerVon(p) === "open" && a.fassungsHash && (p.rolle === "orchestratorin" || p.rolle === "nur-ordner") ? a.fassungsHash : null;

// DER AUFTRAG an die Tür, aus genau den Werten, mit denen das Fenster den Plan las (k15-zustand.ts#lage, #dreier)
function auftrag(s: St, q: Position, p: Profil): Auftrag | null {
  const repo = s.repo;
  if (!repo) return null;
  const d = dreier(s, p, q);
  const t = tuerVon(p);
  const st = s.start;
  if (t === "main") return st.program ? { tuer: "main", program: st.program, cwd: repo, dreier: d } : null;
  if (t === "branch") {
    const b = st.branch;
    return { tuer: "branch", repo, name: b.name.trim(), ziel: b.ziel.trim(), punkte: b.punkte.split("\n").map((x) => x.trim()).filter(Boolean), dreier: d,
      ...(agentMdKommt(s, p, q) ? { profil: p.id } : {}),
      ...(b.modus === "bestehend" && b.wahl ? { bestehend: b.wahl } : {}), ...(b.gemacht?.repo === repo ? { gemacht: b.gemacht.branch } : {}) };
  }
  const plus = vonPlus(s.eingang);
  const slot = lanePlatz(s.eingang);
  if (t === "lane" && st.wt === "fort")
    return st.worktree ? { tuer: "lane-fort", repo, worktree: st.worktree, dreier: d, ...(slot !== undefined ? { slot } : {}) } : null;
  const l = lage(s, p, q);
  const a = l ? antwort(l.plan) : null;
  if (!l || !a) return null;
  // die Schalter, wie die Adresse des Plans sie trägt (k15-zustand.ts#planUrl): sortiert, „id=zustand“
  const sw = Object.entries(l.sch).map(([id, v]) => `${id}=${v}`).sort().join(",");
  const plan = { hash: a.plan.planHash, role: p.rolle, ...(sw ? { bausteine: sw } : {}) };
  if (t === "lane") return { tuer: "lane", repo, dreier: d, plan, ...(slot !== undefined ? { slot } : {}), ...(plus?.parent ? { parent: plus.parent } : {}) };
  const frei = freierPlatz(s);
  if (frei === null) return null;
  const gezeigt = fassungGezeigt(p, a);
  return { tuer: "open", cwd: repo, slot: frei, dreier: d, plan: ohnePlan(p, a) ? null : plan, ...(gezeigt ? { fassung: gezeigt } : {}),
    ...(p.rolle === "orchestratorin" ? { label: ORCH_LABEL } : {}),
    ...(agentMdKommt(s, p, q) ? { profil: p.id } : {}) };
}

export async function los(s: St): Promise<void> {
  const z = startZiel(s);
  if (!z || s.start.busy || startBlocker(s) !== null) return;
  const a = auftrag(s, z.q, z.p);
  if (!a) return;
  s.start.busy = true;
  s.start.fehler = null;
  render();
  const r = await starte(a);
  if (S !== s) return;
  s.start.busy = false;
  if (a.tuer === "main") void ladePrograms(s);
  if (r.ok) {
    const nach = gelesen(s, z.q, z.p, r.slot);
    const sw = schwelleWahl(s, z.p, z.q);
    s.shell.close();
    zeigeSlot(r.slot);
    const schwelle = sw.gesetzt && sw.pct !== null ? await setzeSchwelle(r.slot, sw.pct) : null;
    const lauf = await bindeLauf(s, z.q.id, r.slot, a.tuer === "branch" && a.ziel ? { ziel: a.ziel } : null);
    if (r.hinweis || nach || schwelle || lauf)
      meldung(`${z.q.name} steht auf Slot ${r.slot}${lauf ? ` ${lauf}` : ""}${nach ? `, ${nach}` : ""}${schwelle ? `. ${schwelle}` : ""}${r.hinweis ? `. ${r.hinweis}` : ""}`);
    return;
  }
  s.start.fehler = r.fehler;
  if (r.gemacht && s.repo) s.start.branch.gemacht = { repo: s.repo, branch: r.gemacht };
  if (r.vorhanden) s.start.branch.vorhanden = r.vorhanden;
  // DER PLAN HAT SICH BEWEGT: der Plan von jetzt ersetzt den gezeigten; der nächste Klick nimmt seinen Hash
  if (r.bewegt) s.plaene.clear();
  render();
}

// DIE ÜBERGABE-SCHWELLE DES PROFILS (Harness 2.0 Schritt 2, modell.md Änderung 1) über die Tür, mit der der Owner sie je Slot setzt: in
// 5er-Schritten von 5 bis 95; der Satz sagt, was gilt
async function setzeSchwelle(slot: number, pct: number): Promise<string> {
  const wert = Math.min(95, Math.max(5, Math.round(pct / 5) * 5));
  try {
    const j: unknown = await (await api("/api/sessions")).json();
    const zeilen = j && typeof j === "object" && "slots" in j && Array.isArray(j.slots) ? j.slots : [];
    const row: unknown = zeilen.find((x: unknown) => !!x && typeof x === "object" && "id" in x && x.id === slot);
    const openedAt = row && typeof row === "object" && "openedAt" in row && typeof row.openedAt === "number" ? row.openedAt : null;
    if (openedAt === null) return "Die Übergabe-Schwelle ist nicht gesetzt: die Session ist nicht zu finden";
    const r = await api(`/api/slots/${slot}/handover`, { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedOpenedAt: openedAt, thresholdPct: wert }) });
    if (r.ok) return `Übergabe ab ${wert} %`;
    const e: unknown = await r.json().catch(() => null);
    return `Die Übergabe-Schwelle ist nicht gesetzt: ${e && typeof e === "object" && "error" in e && typeof e.error === "string" ? e.error : `Antwort ${r.status}`}`;
  } catch (e) {
    return `Die Übergabe-Schwelle ist nicht gesetzt: ${e instanceof Error ? e.message : "Server nicht erreichbar"}`;
  }
}

// DER START, ZURÜCKGELESEN an der Zeile, die er ergab: weicht Agent, Modell oder Effort von der Wahl ab, sagt es die Meldung danach. Ein
// Feld, das die Zeile nicht trägt, ist keine Abweichung (der Server meldet es erst, wenn er es kennt)
function gelesen(s: St, q: Position, p: Profil, slot: number): string | null {
  const row = flotte().find((x) => x.id === slot);
  if (!row) return null;
  const agent = wahlVon(s, p, q, "agent").wert, modell = wahlVon(s, p, q, "modell").wert, effort = wahlVon(s, p, q, "effort").wert;
  const laeuft = row.harness ?? (s.katalog ? standardAgent(s.katalog) : null);
  const weg: string[] = [];
  if (agent && laeuft && laeuft !== agent) weg.push(`${agentWort(laeuft)} statt ${agentWort(agent)}`);
  if (modell && row.model && row.model !== modell) weg.push(`${modelLabel(row.model)} statt ${modelLabel(modell)}`);
  if (effort && row.effort && row.effort !== effort) weg.push(`Effort ${row.effort} statt ${effort}`);
  return weg.length ? `läuft aber mit ${weg.join(", ")}` : null;
}

// die Programs, frisch bei jedem Öffnen und nach jeder Antwort der MAIN-Tür: ob eine MAIN lebt, bewegt sich
export async function ladePrograms(s: St): Promise<void> {
  const seq = ++s.start.progSeq;
  const r = await liesPrograms();
  if (S !== s || seq !== s.start.progSeq) return;
  s.start.progs = r;
  if ("zeilen" in r && !(s.start.program && r.zeilen.some((x) => x.id === s.start.program && waehlbar(x))))
    s.start.program = r.zeilen.find(waehlbar)?.id ?? null;
  render();
}

// --- die Felder, die nur der Start braucht: oben in Spalte 3, unter dem Kopf der Session, die startet --------------------------------

const feld = (wort: string, f: HTMLElement): HTMLElement => {
  const l = el("label", "k15stf");
  l.append(el("span", "k15stl", wort), f);
  return l;
};
function eingabe(s: St, key: string, wert: string, platzhalter: string, zeilen: number, nimmt: (v: string) => void): HTMLInputElement | HTMLTextAreaElement {
  const f = zeilen ? document.createElement("textarea") : document.createElement("input");
  f.className = zeilen ? "k15stin k15stta" : "k15stin";
  if (f instanceof HTMLTextAreaElement) f.rows = zeilen;
  else f.maxLength = 80;
  f.value = wert;
  f.placeholder = platzhalter;
  f.dataset.feld = `start-${key}`;
  // die Eingabe zeichnet nur den Fuß neu, nicht das Fenster: so bleibt der Cursor, wo man tippt
  f.oninput = () => { nimmt(f.value); s.start.fehler = null; fuss?.(); };
  return f;
}
let fuss: (() => void) | null = null;
export const beimFuss = (f: () => void): void => { fuss = f; };

function wahlZeile(an: boolean, wort: string, sub: string, tu: (() => void) | null, title?: string): HTMLButtonElement {
  const b = knopf(`k15opt k15stopt${an ? " on" : ""}${tu ? "" : " grau"}`);
  b.setAttribute("role", "radio");
  b.setAttribute("aria-checked", String(an));
  b.disabled = !tu;
  if (title) b.title = title;
  const w = el("span", "k15optw");
  w.append(el("span", "", wort), el("span", "k15stsub", sub));
  b.append(w);
  if (an) b.append(icon("check"));
  if (tu) b.onclick = tu;
  return b;
}

export function startFelder(s: St, q: Position, p: Profil): HTMLElement | null {
  const z = startZiel(s);
  if (!z || z.q.id !== q.id) return null;
  const t = tuerVon(p);
  const box = el("div", "k15start");
  const st = s.start;
  if (t === "main") {
    if (!st.progs) void ladePrograms(s);
    const liste = el("div", "k15stl2");
    liste.setAttribute("role", "radiogroup");
    liste.setAttribute("aria-label", "Program der MAIN");
    const pr = st.progs;
    if (!pr) liste.append(el("div", "k15hinweis", "Programs werden gelesen …"));
    else if ("fehler" in pr) {
      const nochmal = el("button", "k15ghost", "Neu lesen");
      nochmal.onclick = () => { s.start.progs = null; void ladePrograms(s); };
      liste.append(el("div", "k15stwarn", pr.fehler), nochmal);
    } else {
      for (const x of pr.zeilen) {
        const b = wahlZeile(st.program === x.id, x.titel, progSagt(x), waehlbar(x) ? () => { st.program = x.id; st.fehler = null; render(); } : null);
        b.dataset.program = x.id;
        liste.append(b);
      }
      if (!pr.zeilen.length) liste.append(el("div", "k15hinweis", "Kein aktives Program — eine MAIN gehört immer zu einem."));
      if (pr.inaktiv) liste.append(el("div", "k15hinweis", `${pr.inaktiv} weitere nicht aktiv — bootstrap-main nimmt nur ein aktives Program.`));
    }
    box.append(feld("Program", liste));
  } else if (t === "lane") {
    const i = s.repo ? info(s, s.repo) : null;
    const waisen = i && typeof i === "object" && "orphans" in i ? i.orphans ?? [] : [];
    const basis = i && typeof i === "object" && "branch" in i ? i.branch ?? null : null;
    const liste = el("div", "k15stl2");
    liste.setAttribute("role", "radiogroup");
    liste.setAttribute("aria-label", "Worktree");
    const neu = wahlZeile(st.wt === "neu", "Neu", `aus ${basis ?? "dem Integrationsbranch"}`, () => { st.wt = "neu"; st.worktree = null; st.fehler = null; render(); });
    neu.dataset.wt = "neu";
    liste.append(neu);
    for (const w of waisen) {
      const b = wahlZeile(st.wt === "fort" && st.worktree === w.path, `Fortsetzen: ${w.branch || baseName(w.path)}`, "liegt brach — die Arbeit darauf bleibt",
        () => { st.wt = "fort"; st.worktree = w.path; st.fehler = null; render(); });
      b.dataset.wt = "fort";
      b.dataset.worktree = w.path;
      liste.append(b);
    }
    if (!waisen.length) liste.append(el("div", "k15hinweis", "Fortsetzen: jeder Worktree dieses Repos hat eine Session."));
    box.append(feld("Worktree", liste));
  } else if (t === "branch") {
    const b = st.branch;
    const seg = el("div", "k15seg");
    seg.setAttribute("role", "radiogroup");
    seg.setAttribute("aria-label", "Neuer oder bestehender Branch");
    for (const [id, wort] of [["neu", "Neu"], ["bestehend", "Bestehend"]] as const) {
      const k = el("button", b.modus === id ? "on" : "", wort);
      k.dataset.modus = id;
      k.setAttribute("role", "radio");
      k.setAttribute("aria-checked", String(b.modus === id));
      k.onclick = () => { b.modus = id; b.wahl = null; b.vorhanden = null; st.fehler = null; render(); };
      seg.append(k);
    }
    box.append(feld("Branch", seg));
    if (b.modus === "bestehend") box.append(andereListe(s));
    box.append(feld("Name auf dem Board", eingabe(s, "name", b.name, "z. B. Task = Branch", 0, (v) => { b.name = v; b.vorhanden = null; b.gemacht = null; })));
    box.append(feld("Ziel", eingabe(s, "ziel", b.ziel, "In wenigen Sätzen — geht als erste Nachricht an die Session.", 3, (v) => { b.ziel = v; })));
    box.append(feld("Punkte", eingabe(s, "punkte", b.punkte, "Ein Punkt je Zeile — sie gehören zum Branch und bleiben, auch wenn die Session endet.", 3, (v) => { b.punkte = v; })));
    if (b.vorhanden) {
      const ex = b.vorhanden;
      const geh = el("button", "k15ghost", `Zu „${ex.name}“ (${ex.branch}) — dort weiterarbeiten`);
      geh.onclick = () => { b.gemacht = s.repo ? { repo: s.repo, branch: ex.branch } : null; b.name = ex.name; b.vorhanden = null; void los(s); };
      box.append(geh);
    }
  } else if (p.rolle === "orchestratorin") {
    const o = orchLaeuft();
    if (!o) return null;
    const zu = el("button", "k15ghost", `Zu ihr auf Slot ${o.id}`);
    zu.onclick = () => { s.shell.close(); zeigeSlot(o.id); };
    box.append(el("div", "k15hinweis", `Die Orchestratorin läuft schon auf Slot ${o.id}; eine zweite startet das Fenster nicht.`), zu);
  } else return null;
  return box;
}

function andereListe(s: St): HTMLElement {
  const b = s.start.branch;
  const box = el("div", "k15stl2");
  box.setAttribute("role", "radiogroup");
  box.setAttribute("aria-label", "Bestehender Branch");
  const repo = s.repo;
  const da = b.andere;
  if (!repo) return box;
  if (!da || da.repo !== repo) {
    b.andere = { repo, zeilen: [], gesamt: -1 };
    void liesAndere(repo).then((r) => { if (S === s) { b.andere = { repo, ...r }; render(); } });
    box.append(el("div", "k15hinweis", "liest die Branches …"));
    return box;
  }
  if ("fehler" in da) { box.append(el("div", "k15stwarn", da.fehler)); return box; }
  if (da.gesamt < 0) { box.append(el("div", "k15hinweis", "liest die Branches …")); return box; }
  if (!da.zeilen.length) { box.append(el("div", "k15hinweis", "Dieses Repo hat keinen Branch ohne Board-Namen.")); return box; }
  for (const o of da.zeilen) {
    const z = wahlZeile(b.wahl === o.branch, o.branch, o.path ? "ausgecheckt" : "ohne Worktree", () => {
      b.wahl = o.branch;
      if (!b.name.trim()) b.name = o.branch.replace(/^.*\//, "").replace(/[-_]+/g, " ");
      s.start.fehler = null;
      render();
    });
    z.dataset.branch = o.branch;
    box.append(z);
  }
  if (da.gesamt > da.zeilen.length) box.append(el("div", "k15hinweis", `die jüngsten ${da.zeilen.length} von ${da.gesamt}`));
  return box;
}

// der Knopf: er nennt, was startet; ein Fehler der Tür steht über ihrem Satz
export function startKnopf(s: St): { knopf: HTMLButtonElement; satz: HTMLElement | null; fassung: HTMLElement | null } {
  const z = startZiel(s);
  const l = z ? lage(s, z.p, z.q) : null;
  const a = l ? antwort(l.plan) : null;
  const h = z && a ? fassungGezeigt(z.p, a) : null;
  const fassung = h ? el("span", "k15stfass", fassungZeile(h)) : null;
  if (fassung && h) fassung.title = h;
  const block = startBlocker(s);
  const go = knopf("k15go");
  go.textContent = s.start.busy ? "Startet …" : z ? `${z.q.name} starten` : "Starten";
  go.disabled = s.start.busy || block !== null;
  go.onclick = () => { void los(s); };
  const text = s.start.fehler ?? block ?? [startHinweis(s), laufSatz(s)].filter(Boolean).join(" ");
  if (!text) return { knopf: go, satz: null, fassung };
  const satz = el("span", `k15stsatz${s.start.fehler || block ? " warn" : ""}`, text);
  satz.setAttribute("role", "status");
  return { knopf: go, satz, fassung };
}
