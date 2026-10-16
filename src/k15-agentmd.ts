// K15 · DEINE AGENT-MD IN VIER SCHRITTEN (Owner 16.10. 00:5x: „[Zitat entfernt]“
// ). Jeder
// Schritt zeigt eine Sache: 1 die Datei (wählen, hineinziehen, neu beginnen), 2 ihre Abschnitte (lesen, ändern, anfügen), 3 was Fleet
// darum herum mitgibt (wie viel davon, regelt ein Regler in Graustufen: src/k15-anbindung-ui.ts; dazu Kontextpacks), 4 als Profil speichern. Das Profil lebt wie
// gespeichert wie Fassungen und Packs auf dem Server (k15-zustand.ts#speichereEigenes); deine Datei und Packs gibt Fleet beim
// Start noch nicht mit (Schnittplan Schritt 4).
import { el, baseName, bausteinName } from "./k15-haupt";
import { icon } from "./icons";
import { modelLabel } from "./modelname";
import { DU, EFFORT_WORT, GRUPPEN, REVIEW_MD, WAHL, alle, fmt, gruppeVon, tokVon, type Abschnitt, type Profil, type Quelle, type Schiene } from "./k15-entwurf-modell";
import { ANBINDUNGEN, anbindungRolle, ankommend, fleetTeil, type Anbindung } from "./k15-anbindung";
import { startZahl } from "./k15-startzahl";
import { VORSCHAU, aenderung, regler, stufenPlan, vorschauWahl, type StufenPlan, type Vorschau } from "./k15-anbindung-ui";
import { abschnitte, dateiPasst } from "./k15-import";
import { istPackRolle, neuerPack, packBytes, packLandung } from "./k15-kontextpack";
import { packEditor } from "./k15-packs-ui";
import { knopf } from "./k15-teile";
import { S, gehe, gewaehlt, plural, render, speichereEigenes, toast, verwirft, type St } from "./k15-zustand";

// `entwurf` ist der offene Abschnitt, wie er gerade getippt ist: Er lebt im Zustand, so übersteht er jedes Neuzeichnen (Prüfung Punkt 3)
export interface Ablauf {
  schritt: number; datei: Quelle | null; vorher: Abschnitt[]; offen: number | null; entwurf: { titel: string; text: string } | null;
  // wie viel Fleet mitkommt und als welche Rolle die Vorschau rechnet (Bauleitung f6edd1e7: die Rolle gehört zur Position, hier nur Vorschau)
  stufe: Anbindung; rolle: Vorschau; packs: string[]; name: string; modell: string; effort: string;
}
const SCHRITTE = ["Datei", "Abschnitte", "Was Fleet dazugibt", "Speichern"] as const;
const NEU: Abschnitt[] = [
  { titel: "# Rolle", text: "Wer du bist und wofür du da bist, in zwei Sätzen." },
  { titel: "## Wie du arbeitest", text: "- Was du zuerst liest\n- Was du nie tust" },
  { titel: "## Was du meldest", text: "Ein Satz Ergebnis, darunter die Stellen mit Datei und Zeile." },
];
const bytes = (a: Abschnitt): number => new TextEncoder().encode(`${a.titel}\n${a.text}`).length;
const ohneRaute = (t: string): string => t.replace(/^#+\s*/, "");
const geaenderte = (a: Ablauf): number => a.datei ? a.datei.abschnitte.filter((x, i) => !a.vorher[i] || a.vorher[i].titel !== x.titel || a.vorher[i].text !== x.text).length : 0;
// hat der Ablauf etwas, das ein Schließen verwürfe? (Prüfung Punkt 2) Ein geänderter Abschnitt oder einer, der gerade getippt wird
export function ablaufUngesichert(a: Ablauf): boolean {
  const offen = a.offen !== null && a.datei ? a.datei.abschnitte[a.offen] : undefined;
  return geaenderte(a) > 0 || (!!a.entwurf && (!offen || a.entwurf.titel !== offen.titel || a.entwurf.text !== offen.text));
}
export function schliesseAblauf(s: St): void {
  if (s.ablauf && ablaufUngesichert(s.ablauf) && !verwirft(s, "im Ablauf „Deine Agent-MD“")) return;
  s.ablauf = null;
  s.packEdit = null;
  render();
}
// wer den Schritt wechselt, nimmt den offenen Abschnitt mit, wie er getippt ist; verworfen wird nur mit „Abbrechen“
function wechsle(a: Ablauf, schritt: number): void {
  if (a.offen !== null && a.entwurf && a.datei?.abschnitte[a.offen]) {
    const x = a.datei.abschnitte[a.offen];
    a.datei.abschnitte[a.offen] = { titel: a.entwurf.titel.trim() || x.titel, text: a.entwurf.text.trim() };
  }
  a.schritt = schritt;
  a.offen = null;
  a.entwurf = null;
  render();
}
const neueId = (): string => `md${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function oeffneAblauf(s: St): void {
  const { q, p } = gewaehlt(s);
  const datei = q?.datei ? structuredClone(q.datei) : null;
  s.ablauf = { schritt: datei ? 1 : 0, datei, vorher: datei ? structuredClone(datei.abschnitte) : [], offen: null, entwurf: null,
    stufe: p.id === "eigen" || !istPackRolle(p.rolle) ? "ordner" : "standard", rolle: p.rolle === "main" ? "main" : "lane",
    packs: [], name: "", modell: WAHL.modell[0], effort: "high" };
  s.exp = false;
  render();
}
// der Name des Profils: was die erste Überschrift sagt, sonst der Dateiname; eine neue Datei heißt „Meine Agent-MD“
function nimmDatei(a: Ablauf, d: Quelle, name?: string): void {
  a.datei = d;
  a.vorher = structuredClone(d.abschnitte);
  a.name = a.name || name || ohneRaute(d.abschnitte[0]?.titel ?? "").slice(0, 40) || d.titel.replace(/\.md$/i, "");
  a.schritt = 1;
  render();
}
function liesDatei(s: St, a: Ablauf, f: File): void {
  if (!/\.md$/i.test(f.name)) { toast(`${f.name}: Nur eine .md wird eine Agent-MD.`); return; }
  const passt = dateiPasst(f.name, f.size);
  if (passt) { toast(passt); return; }
  f.text().then((t) => { if (S === s && s.ablauf === a) nimmDatei(a, { id: neueId(), titel: f.name, v: 1, pfad: "eigene Datei · gewählt", abschnitte: abschnitte(t, "Anfang") }); })
    .catch(() => toast(`${f.name}: Der Browser konnte die Datei nicht lesen.`));
}
// eine .md, die bei offenem Ablauf ins Fenster gezogen wird, wird seine Datei
export function ablaufNimmt(s: St, f: File): boolean {
  const a = s.ablauf;
  if (!a || !/\.md$/i.test(f.name)) return false;
  liesDatei(s, a, f);
  return true;
}

// SCHRITT 1 · DIE DATEI: wählen, hineinziehen oder neu beginnen; darunter die, die es im Entwurf schon gibt
function schrittDatei(s: St, a: Ablauf): HTMLElement[] {
  const kacheln = el("div", "k15abk");
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".md,text/markdown";
  input.hidden = true;
  input.onchange = () => { const f = input.files?.[0]; if (f) liesDatei(s, a, f); };
  const kachel = (cls: string, glyph: "file" | "export" | "plus", wort: string, satz: string, los: () => void) => {
    const b = el("button", `k15abt ${cls}`);
    const g = el("span", "k15abtg");
    g.append(icon(glyph));
    b.append(g, el("span", "k15abtw", wort), el("span", "k15abts", satz));
    b.onclick = los;
    kacheln.append(b);
    return b;
  };
  kachel("", "file", "Datei wählen", "eine .md von deinem Rechner", () => input.click());
  const zieh = kachel("zieh", "export", "Hierher ziehen", "eine .md auf dieses Feld", () => toast("Zieh eine .md auf das Feld „Hierher ziehen“."));
  zieh.addEventListener("dragover", (e) => { if (e.dataTransfer?.types.includes("Files")) { e.preventDefault(); e.stopPropagation(); zieh.classList.add("ziel"); } });
  zieh.addEventListener("dragleave", () => zieh.classList.remove("ziel"));
  zieh.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer?.files[0]; if (f) liesDatei(s, a, f); });
  kachel("", "plus", "Neu beginnen", "mit drei Überschriften, die du füllst", () => nimmDatei(a, { id: neueId(), titel: "meine-agent.md", v: 1, pfad: "eigene Datei · neu", abschnitte: structuredClone(NEU) }, "Meine Agent-MD"));
  const da = el("div", "k15abda");
  da.append(el("div", "k15abl", "Oder nimm eine, die es schon gibt"));
  const vorhanden: Quelle[] = [REVIEW_MD, ...alle(s.k.wurzeln).flatMap((x) => x.datei && x.datei.titel !== REVIEW_MD.titel ? [x.datei] : [])];
  for (const d of vorhanden) {
    const b = el("button", "k15abz");
    b.append(icon("file"), el("span", "k15abzn", d.titel), el("span", "k15abzs", plural(d.abschnitte.length, "Abschnitt", "Abschnitte")));
    b.onclick = () => nimmDatei(a, structuredClone(d));
    da.append(b);
  }
  return [el("div", "k15abh", "Womit fängst du an?"),
    el("div", "k15abs2", "Deine Agent-MD sagt der Session, wer sie ist und wie sie arbeitet. Fleet legt seine Bausteine darum herum; was genau, wählst du in Schritt 3."),
    kacheln, input, da];
}

// SCHRITT 2 · IHRE ABSCHNITTE: so liest die Session die Datei, von oben nach unten; jeder lässt sich ändern
function schrittAbschnitte(_s: St, a: Ablauf): HTMLElement[] {
  const d = a.datei;
  if (!d) return [el("div", "k15leer", "Wähl zuerst eine Datei.")];
  const liste = el("div", "k15abal");
  d.abschnitte.forEach((x, i) => {
    const geaendert = !a.vorher[i] || a.vorher[i].titel !== x.titel || a.vorher[i].text !== x.text;
    const r = el("div", `k15aba${a.offen === i ? " offen" : ""}`);
    if (a.offen !== i) {
      const kopf = el("div", "k15abak");
      kopf.append(el("span", "k15abat", ohneRaute(x.titel)), ...(geaendert ? [el("span", "k15tag neu", a.vorher[i] ? "geändert" : "neu")] : []),
        el("span", "k15abab k15n", tokVon(bytes(x))));
      r.append(kopf);
    }
    if (a.offen === i) {
      const e = a.entwurf ?? (a.entwurf = { titel: x.titel, text: x.text });
      const t = document.createElement("input");
      t.className = "k15packin k15abti";
      t.value = e.titel;
      t.dataset.feld = "ab-titel";
      t.setAttribute("aria-label", "Überschrift");
      t.oninput = () => { e.titel = t.value; };
      const ta = document.createElement("textarea");
      ta.className = "k15editt";
      ta.value = e.text;
      ta.dataset.feld = "ab-text";
      ta.spellcheck = false;
      ta.setAttribute("aria-label", `Text von ${ohneRaute(x.titel)}`);
      ta.oninput = () => { e.text = ta.value; };
      const knoepfe = el("div", "k15row2");
      const ok = el("button", "k15ghost k15editok", "Übernehmen");
      ok.onclick = () => { d.abschnitte[i] = { titel: e.titel.trim() || x.titel, text: e.text.trim() }; a.offen = null; a.entwurf = null; render(); };
      const ab = el("button", "k15ghost", "Abbrechen");
      ab.onclick = () => { a.offen = null; a.entwurf = null; render(); };
      knoepfe.append(ok, ab);
      r.append(t, ta, knoepfe);
      requestAnimationFrame(() => { ta.style.height = `${Math.max(90, ta.scrollHeight + 4)}px`; r.scrollIntoView({ block: "nearest" }); });
    } else {
      r.append(el("div", "k15abax", x.text || "leer"));
      r.tabIndex = 0;
      r.setAttribute("role", "button");
      r.title = `${ohneRaute(x.titel)} ändern`;
      const oeffne = () => { a.offen = i; a.entwurf = { titel: x.titel, text: x.text }; render(); };
      r.onclick = oeffne;
      r.onkeydown = (e) => { if (e.key === "Enter") oeffne(); };
    }
    liste.append(r);
  });
  const plus = el("button", "k15ghost");
  plus.append(icon("plus"), el("span", "", "Abschnitt anfügen"));
  plus.onclick = () => { d.abschnitte = [...d.abschnitte, { titel: "## Neuer Abschnitt", text: "" }]; a.offen = d.abschnitte.length - 1; a.entwurf = null; render(); };
  const n = geaenderte(a);
  return [el("div", "k15abh", `${d.titel} · ${plural(d.abschnitte.length, "Abschnitt", "Abschnitte")}`),
    el("div", "k15abs2", `So liest die Session deine Datei: Abschnitt für Abschnitt, von oben nach unten. Tipp einen an, um ihn zu ändern.${n ? ` ${plural(n, "Abschnitt ist", "Abschnitte sind")} geändert.` : ""}`),
    liste, plus];
}

// SCHRITT 3 · WAS FLEET DAZUGIBT: als welche Rolle, wie viel davon (der Regler), je Gruppe, was der Plan dieser Stufe bei diesem Start liefert,
// was gegenüber der Stufe darunter dazukommt; dazu die Packs
const plaeneVon = (s: St, a: Ablauf): StufenPlan[] | null => s.repo ? ANBINDUNGEN.map((x) => stufenPlan(s, s.repo as string, a.rolle, x.id)) : null;
function schrittFleet(s: St, a: Ablauf): HTMLElement[] {
  const plaene = plaeneVon(s, a);
  const i0 = ANBINDUNGEN.findIndex((x) => x.id === a.stufe);
  const wahl = plaene?.[i0] ?? null;
  const offen = wahl?.a ? fleetTeil(wahl.a)?.offen ?? [] : [];
  const out = [el("div", "k15abh", "Was Fleet um deine Datei herum mitgibt"), vorschauWahl(a)];
  if (plaene) out.push(regler(a, plaene));
  out.push(el("div", "k15abs2 k15abrs", ANBINDUNGEN[i0].satz),
    el("div", "k15abrc", `Die Zahl je Stufe ist, was Fleet dazugibt, ohne Claude Code und die Dateien deines Repos.${offen.length && wahl?.a ? ` Nicht gemessen: ${offen.map((id) => { const b = wahl.a?.plan.bausteine.find((x) => x.id === id); return b ? bausteinName(b) : id; }).join(", ")}.` : ""}`));
  const plan = wahl?.a ?? null;
  const { dazu, zeilen } = plaene ? aenderung(plaene, i0) : { dazu: new Set<string>(), zeilen: [] };
  const tab = el("div", "k15abg");
  const zeile = (wort: string, satz: string, was: string | HTMLElement, eigen = false) => {
    const r = el("div", `k15abgz${eigen ? " eigen" : ""}`);
    const t = el("span", "k15kt");
    t.append(el("span", "k15abgw", wort), el("span", "k15abgs", satz));
    const v = el("span", "k15abgv");
    v.append(was);
    r.append(t, v);
    tab.append(r);
  };
  zeile("Deine Datei", a.datei ? `${a.datei.titel} · ${plural(a.datei.abschnitte.length, "Abschnitt", "Abschnitte")}` : "noch keine",
    `${a.stufe === "ordner" ? "käme als eigene Datei dazu" : "stünde vor dem, was Fleet schreibt"}; heute gibt Fleet sie noch nicht mit`, true);
  if (!plan) tab.append(el("div", "k15leer", !s.repo ? "Kein Repo gewählt." : wahl?.fehler ? `Der Plan lehnt ab: ${wahl.fehler}` : "Der Gründungsplan wird gelesen …"));
  else {
    // was ankommt (src/k15-anbindung.ts#ankommend, wie Spalte 3); was gegenüber der Stufe darunter dazukommt, steht hervorgehoben
    const an = ankommend(plan);
    for (const g of GRUPPEN) {
      const bs = plan.plan.bausteine.filter((b) => gruppeVon(b) === g.id && an.has(b.id));
      const v = el("span", "");
      bs.forEach((b, i) => { const n = el("span", dazu.has(b.id) ? "k15abneu" : "", bausteinName(b)); n.dataset.id = b.id; v.append(...(i ? [", "] : []), n); });
      zeile(g.wort, g.satz, bs.length ? v : "nichts");
    }
  }
  out.push(tab);
  if (zeilen.length) { const d = el("div", "k15abdl"); d.append(...zeilen); out.push(d); }
  // DIE PACKS: nur mit Lesehinweisen, also nur mit einer Rolle (src/k15-kontextpack.ts#packLandung)
  out.push(el("div", "k15abl", "Kontextpacks"));
  const rolle = anbindungRolle(a.stufe, a.rolle);
  if (!istPackRolle(rolle)) {
    out.push(el("div", "k15hinweis", "Ohne Rolle bekommt die Session keine Lesehinweise, also auch keinen Pack; ab „Standard“ nimmt sie einen mit."));
    return out;
  }
  if (s.packEdit) { out.push(packEditor(s, s.packEdit)); return out; }
  for (const pk of s.packs) {
    const la = packLandung({ ...pk, orte: { ...pk.orte, [rolle]: pk.orte[rolle] === "nicht" ? "text" : pk.orte[rolle] } }, rolle, plan);
    const on = a.packs.includes(pk.id);
    const r = el("button", `k15abp${on ? " on" : ""}`);
    r.setAttribute("role", "checkbox");
    r.setAttribute("aria-checked", String(on));
    const box = el("span", "k15abpc");
    if (on) box.append(icon("check"));
    const t = el("span", "k15kt");
    t.append(el("span", "k15abpn", pk.name), el("span", "k15abps", la.art === "mit" ? `${la.ort === "text" ? "als Text" : "auf Abruf"} in den Lesehinweisen` : la.grund));
    r.append(box, t, ...(la.art === "mit" ? [el("span", "k15abab k15n", tokVon(packBytes(pk, la.ort)))] : []));
    r.onclick = () => { a.packs = on ? a.packs.filter((x) => x !== pk.id) : [...a.packs, pk.id]; render(); };
    out.push(r);
  }
  const neu = el("button", "k15ghost k15packneu");
  neu.append(icon("plus"), el("span", "", "Neuer Kontextpack"));
  neu.onclick = () => { s.packEdit = neuerPack(rolle, DU, Date.now()); render(); };
  out.push(neu);
  return out;
}

// SCHRITT 4 · ALS PROFIL SPEICHERN: Name, Modell, Effort und was beim Start zusammenkäme
function schrittSpeichern(s: St, a: Ablauf): HTMLElement[] {
  const feld = (wort: string, f: HTMLElement) => { const l = el("label", "k15packf"); l.append(el("span", "k15packl", wort), f); return l; };
  const reihe = (...x: HTMLElement[]) => { const r = el("div", "k15abreihe"); r.append(...x); return r; };
  const name = document.createElement("input");
  name.className = "k15packin";
  name.maxLength = 40;
  name.value = a.name;
  name.placeholder = "z. B. Review";
  name.dataset.feld = "ab-name";
  name.oninput = () => { a.name = name.value; };
  const auswahl = (werte: string[], jetzt: string, wort: (v: string) => string, nimm: (v: string) => void) => {
    const sel = document.createElement("select");
    sel.className = "k15absel";
    for (const v of werte) { const o = document.createElement("option"); o.value = v; o.textContent = wort(v); o.selected = v === jetzt; sel.append(o); }
    sel.onchange = () => nimm(sel.value);
    return sel;
  };
  const plan = plaeneVon(s, a)?.[ANBINDUNGEN.findIndex((x) => x.id === a.stufe)]?.a ?? null;
  const rolle = anbindungRolle(a.stufe, a.rolle);
  const packs = s.packs.filter((pk) => a.packs.includes(pk.id));
  const dateiB = a.datei ? a.datei.abschnitte.reduce((n, x) => n + bytes(x), 0) : 0;
  const packB = packs.reduce((n, pk) => n + packBytes(pk, "text"), 0);
  const geaendert = geaenderte(a);
  const dl = el("div", "k15bstz k15absum");
  const z = (k: string, v: string) => dl.append(el("span", "k15bstzk", k), el("span", "k15bstzv", v));
  z("Datei", a.datei ? `${a.datei.titel} · ${plural(a.datei.abschnitte.length, "Abschnitt", "Abschnitte")}${geaendert ? `, ${geaendert} geändert` : ""}` : "keine");
  z("Wie viel Fleet", `${ANBINDUNGEN.find((x) => x.id === a.stufe)?.wort ?? a.stufe}${a.stufe === "ordner" ? "" : ` · als ${VORSCHAU.find((x) => x.id === a.rolle)?.wort ?? a.rolle}`}`);
  z("Packs", packs.length ? packs.map((pk) => pk.name).join(" · ") : istPackRolle(rolle) ? "keiner" : "ohne Rolle keiner");
  // gerechnet wie die Summe unten (src/k15-startzahl.ts); die Dateien des Repos misst der Server nur ohne Rolle, fehlen sie, sagt die Zeile es
  const start = plan ? startZahl(plan) : null;
  if (start) z("Beim Start", `${fmt(Math.round(start.tokens + (dateiB + packB) / 2.1))}, davon deine Datei ${tokVon(dateiB) || "0 Tok"}${start.repo === null ? "; ohne die Dateien des Repos (nicht gemessen)" : ""}`);
  const fehler = !a.name.trim() ? "Gib dem Profil einen Namen." : !a.datei ? "Wähl in Schritt 1 eine Datei." : null;
  return [el("div", "k15abh", "Als Profil speichern"),
    el("div", "k15abs2", "Das Profil steht danach links unter Rollen. Du ziehst es auf eine Session oder startest es allein."),
    feld("Name", name),
    reihe(feld("Modell", auswahl(WAHL.modell, a.modell, modelLabel, (v) => { a.modell = v; })),
      feld("Effort", auswahl(WAHL.effort, a.effort, (v) => EFFORT_WORT[v] ?? v, (v) => { a.effort = v; }))),
    dl,
    el("div", "k15hinweis", "Noch ein Entwurf: Beim Start gibt Fleet deine Datei und die Packs heute nicht mit, dafür fehlt noch ein Schritt am Server. Gespeichert wird das Profil schon."),
    ...(fehler ? [el("div", "k15abf", fehler)] : [])];
}

function speichere(s: St, a: Ablauf): void {
  if (!a.name.trim() || !a.datei) { toast(!a.datei ? "Wähl in Schritt 1 eine Datei." : "Gib dem Profil einen Namen."); a.schritt = a.datei ? 3 : 0; render(); return; }
  // die Schalter der Stufe, wie der Plan sie annimmt (stufenPlan); solange er gelesen wird, speichert nichts
  const schalter = a.stufe === "ordner" || a.stufe === "standard" ? {} : s.repo ? stufenPlan(s, s.repo, a.rolle, a.stufe).schalter : null;
  if (!schalter) { toast("Der Plan dieser Stufe wird noch gelesen; speichere gleich noch einmal."); return; }
  const rolle = anbindungRolle(a.stufe, a.rolle);
  const schiene: Schiene = rolle === "lane" ? "lane" : rolle === "main" ? "program-main" : "session";
  // das Profil trägt seine Datei: so bekommt jede neue Session mit ihm sie mit, und es übersteht ein Neuladen (Prüfung Punkt 4)
  const datei: Quelle = { ...structuredClone(a.datei), id: a.datei.id ?? neueId(), v: 1 };
  const p: Profil = { id: neueId(), name: a.name.trim(), glyph: "file", v: 1, kurz: "deine Agent-MD", satz: `arbeitet nach ${a.datei.titel}`, autor: DU,
    rolle, schiene, modell: a.modell, effort: a.effort, schwelle: null, schalter, nativ: null, einV: 1, rechteV: 1, werte: {}, autonomie: null, datei };
  s.profile = [...s.profile, p];
  s.profilNeu.add(p.id);
  const { q } = gewaehlt(s);
  if (q) { q.profil = p.id; q.datei = structuredClone(datei); s.konstNeu.add(s.k.id); }
  s.packs = s.packs.map((pk) => a.packs.includes(pk.id) && istPackRolle(rolle) && pk.orte[rolle] === "nicht" ? { ...pk, orte: { ...pk.orte, [rolle]: "text" } } : pk);
  s.ablauf = null;
  s.sel = q ? { art: "pos", id: q.id } : { art: "profil", id: p.id };
  void speichereEigenes(s).then((ok) => { if (ok) toast(`Profil „${p.name}“ v1 ist gespeichert und steht links unter Rollen.${q ? ` ${q.name} trägt es jetzt; das gilt bis zum Neuladen, wie jede Änderung am Aufbau.` : ""}`); });
  gehe(2, 0);
}

export function ablaufPanel(): HTMLElement {
  const s = S;
  const box = el("div", "k15ab");
  const a = s?.ablauf;
  if (!s || !a) return box;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Deine Agent-MD einrichten");
  const kopf = el("div", "k15abkopf");
  const zu = el("button", "k15popx");
  zu.title = "schließen";
  zu.append(icon("x"));
  zu.onclick = () => schliesseAblauf(s);
  const leiste = el("ol", "k15abschritte");
  SCHRITTE.forEach((w, i) => {
    const li = el("li", `${i === a.schritt ? "on" : ""}${i < a.schritt ? " fertig" : ""}`);
    const b = knopf("");
    b.append(el("span", "k15abi", i < a.schritt ? "✓" : String(i + 1)), el("span", "", w));
    b.disabled = i > 0 && !a.datei;
    b.onclick = () => wechsle(a, i);
    li.append(b);
    leiste.append(li);
  });
  kopf.append(el("span", "k15abtitel", "Deine Agent-MD"), leiste, zu);
  const inhalt = el("div", "k15abin");
  inhalt.dataset.schritt = String(a.schritt);
  inhalt.append(...[schrittDatei, schrittAbschnitte, schrittFleet, schrittSpeichern][a.schritt](s, a));
  const fuss = el("div", "k15abfuss");
  const zurueck = el("button", "k15ghost", "Zurück");
  zurueck.onclick = () => wechsle(a, Math.max(0, a.schritt - 1));
  if (a.schritt === 0) zurueck.style.visibility = "hidden";
  const weiter = el("button", "k15go", a.schritt < 3 ? `Weiter: ${SCHRITTE[a.schritt + 1]}` : "Als Profil speichern");
  if (a.schritt === 0 && !a.datei) weiter.setAttribute("disabled", "");
  weiter.onclick = () => { if (a.schritt < 3) wechsle(a, a.schritt + 1); else speichere(s, a); };
  fuss.append(zurueck, el("span", "k15abwo", s.repo ? `startet in ${baseName(s.repo)}` : ""), weiter);
  box.append(kopf, inhalt, fuss);
  return box;
}
