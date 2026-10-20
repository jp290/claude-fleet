// NEUE SESSION · LINKS: AUFSETZEN (src/sitzung.ts zeichnet die drei Spalten). Owner 19.10. 09:5x: „[Zitat entfernt]“
//  — je Wahl ein Symbol, ein Titel, höchstens eine kurze Zeile; die Erklärung steht im Hover. Was er darf (Rechte, A) in
// derselben Form: vier Stufen, die Befehle hinter „Details“ (session-rechte.ts). „Ausprobieren“ lädt ein, eigene Teile mitzugeben.
import { el } from "./k15-haupt";
import { icon, type IconName } from "./icons";
import { render, S, type St } from "./k15-zustand";
import { agentOptionen, agentVon, agentWort, effortVon, modelleVon, standardAgent } from "./k15-agent";
import { modelLabel } from "./modelname";
import { RECHTE_BEFEHLE, RECHTE_STUFEN, RECHTE_ZAUN, abweichung, befehlAn, rechteAlsSatz, stufeGibt, type RechteStufe } from "../session-rechte";
import type { SitzungRolle } from "./sitzung-modell";
import { attrappeFuer, attrappeLinks } from "./attrappe";
import { AUFGABE_FELDER, type AufgabeFeld } from "./aufgabe";
import { nachDemKlick } from "./nach-dem-klick";

export const ROLLEN: readonly { id: SitzungRolle | "ohne" | "andere"; wort: string; zeile: string; hover: string; sym: IconName }[] = [
  { id: "ohne", wort: "Nur mein Agent", zeile: "Ohne Fleet", sym: "terminal",
    hover: "Fleet gibt ihm nichts mit. Kommt mit dem leeren Start; heute gibt Fleet jedem Start etwas mit." },
  { id: "einfach", wort: "Einfach arbeiten", zeile: "Direkt im Ordner", sym: "folder",
    hover: "Er arbeitet direkt im Ordner. Von Fleet weiß er, wo er läuft und wie Nachrichten kommen." },
  { id: "branch", wort: "An einem Ziel", zeile: "Eigener Branch, dein Ziel zuerst", sym: "branch",
    hover: "Dazu ein eigener Branch, und dein Ziel geht als erste Nachricht an ihn. Gelandet wird nach deinem „passt“." },
  { id: "andere", wort: "Mit anderen Sessions", zeile: "Öffnet den Aufbau", sym: "tree",
    hover: "Mehrere Sessions, die zusammenarbeiten (Lane, MAIN, Orchestratorin)." },
];
const STUFE_SYM: Readonly<Record<RechteStufe, IconName>> = { lesen: "search", bauen: "pencil", landen: "commit", deployen: "live" };

function abschnitt(titel: string, hover?: string): HTMLElement {
  const a = el("section", "ksabschn");
  const h = el("h2", "", titel);
  if (hover) h.title = hover;
  a.append(h);
  return a;
}
// eine Kachel: Symbol, Titel, eine Zeile; gewählt = aria-pressed
function kachel(cls: string, sym: IconName, wort: string, zeile: string | null, an: boolean, tu: () => void): HTMLButtonElement {
  const b = el("button", cls) as HTMLButtonElement;
  b.type = "button";
  b.setAttribute("aria-pressed", String(an));
  const t = el("span", "kskt");
  t.append(el("b", "", wort));
  if (zeile) t.append(el("span", "", zeile));
  b.append(icon(sym), t);
  b.onclick = tu;
  return b;
}

// `fuss` zeichnet nur den Fuß neu: beim Tippen bliebe sonst der Fokus nicht im Feld
export function spalteLinks(s: St, hand: number, fuss: () => void): HTMLElement[] {
  const z = s.sitz;
  const out: HTMLElement[] = attrappeFuer(s) ? [attrappeLinks(s)] : [];

  const agent = abschnitt("Agent");
  const zl = el("div", "ksagent");
  if (s.katalog) {
    const ka = s.katalog;
    zl.append(auswahl("Agent", z.agent, [["", `${agentWort(standardAgent(ka) ?? "claude")} (Standard)`], ...agentOptionen(ka, false).map((o): [string, string, boolean] => [o.wert, o.aus ? `${o.wort} · ${o.aus}` : o.wort, !!o.aus])],
      (v) => { z.agent = v; z.modell = ""; z.effort = ""; }));
    const id = z.agent || standardAgent(ka) || "claude";
    const mo = modelleVon(ka, id), ef = effortVon(ka, id);
    if (mo.length) zl.append(auswahl("Modell", z.modell, [["", "Standard"], ...mo.map((x): [string, string] => [x, modelLabel(x)])], (v) => { z.modell = v; }));
    if (ef.length) zl.append(auswahl("Effort", z.effort, [["", "Standard"], ...ef.map((x): [string, string] => [x, x])], (v) => { z.effort = v; }));
    const aus = agentVon(ka, id)?.aus;
    if (aus) zl.append(el("div", "kswarn", `${agentWort(id)} startet hier nicht: ${aus.grund}.`));
  } else zl.append(el("div", "ksklein", s.katalog === null ? "Die Agenten sind nicht lesbar; es startet der Standard." : "Die Agenten werden gelesen …"));
  agent.append(zl);
  out.push(agent);

  const rollen = abschnitt("Was willst du machen?");
  const raster = el("div", "ksrollen");
  for (const r of ROLLEN) {
    const b = kachel("ksrolle", r.sym, r.wort, r.zeile, r.id === z.rolle, () => {
      if (r.id === "andere") { s.ansicht = "aufbau"; render(); return; }
      if (r.id === "ohne" || r.id === z.rolle) return;
      z.rolle = r.id; z.springen = true; z.fehler = null;
      render();
    });
    b.dataset.rolle = r.id;
    b.title = r.hover;
    if (r.id === "ohne") b.disabled = true;
    raster.append(b);
  }
  rollen.append(raster);
  out.push(rollen);

  if (z.rolle === "branch") out.push(ziel(s, fuss));

  // WAS ER DARF: es sind Claude Codes Regeln (server/rechte.ts); ein anderer Agent startet mit seinen eigenen
  const ag = z.agent || (s.katalog ? standardAgent(s.katalog) ?? "claude" : "claude");
  if (ag === "claude") out.push(wasDarfEr(s));
  else {
    const r = abschnitt("Was darf er?");
    r.append(el("div", "ksklein", `Das stellt Fleet nur für Claude Code ein; ${agentWort(ag)} startet mit seinen eigenen Regeln.`));
    out.push(r);
  }

  // AUSPROBIEREN: eigene Teile mitgeben (Owner 09:5x); was beim Start noch nicht ankommt, sagt es
  const probe = abschnitt("Ausprobieren");
  const knoepfe = el("div", "ksprobe");
  for (const [sym, wort, hover] of [["file", "Eigene Datei anheften", "Eine .md-Datei, die er beim Start liest"],
    ["plus", "Fleet-Baustein anheften", "Ein Teil von Fleet, der hier sonst nicht dabei wäre"]] as const) {
    const b = el("button", "ksprobek") as HTMLButtonElement;
    b.type = "button";
    b.disabled = true;
    b.title = `${hover}. Kommt bald.`;
    b.append(icon(sym), el("span", "", wort), el("small", "", "bald"));
    knoepfe.append(b);
  }
  probe.append(knoepfe);
  if (hand) {
    const zurueck = el("button", "ksmehr", "zurücksetzen") as HTMLButtonElement;
    zurueck.type = "button";
    zurueck.onclick = () => { z.schalter = {}; z.springen = true; render(); };
    const zl2 = el("div", "ksklein ksvonhand");
    zl2.append(`${hand === 1 ? "Ein Teil" : `${hand} Teile`} von dir geändert · `, zurueck);
    probe.append(zl2);
  }
  out.push(probe);
  return out;
}

// WAS ER DARF (Owner 10:1x: „[Zitat entfernt]“): ein Satz mit dem Symbol seiner Stufe, darunter nur die Ausnahmen.
// „[Zitat entfernt]“ zeigt die vier Stufen untereinander, je mit ihrem Satz; „[Zitat entfernt]“ alle Befehle mit Schalter
function wasDarfEr(s: St): HTMLElement {
  const z = s.sitz, r = z.rechte;
  const a = abschnitt("Was darf er?", RECHTE_ZAUN);
  const karte = el("div", "ksrecht");
  const satz = el("div", "ksrsatz");
  const aendern = el("button", "ksdetailk", z.rechteWahl === "stufe" ? "zu" : "ändern") as HTMLButtonElement;
  aendern.type = "button";
  aendern.dataset.tu = "stufe";
  aendern.setAttribute("aria-expanded", String(z.rechteWahl === "stufe"));
  aendern.onclick = () => { z.rechteWahl = z.rechteWahl === "stufe" ? "zu" : "stufe"; render(); };
  // die Stufe steht über dem Satz, auch wenn die Stufen zugeklappt sind (Gegenprobe 10:4x)
  const text = el("span", "");
  text.append(el("small", "ksrstufe", `Stufe „${RECHTE_STUFEN.find((x) => x.id === r.stufe)?.wort ?? r.stufe}“`), rechteAlsSatz(r));
  satz.append(icon(STUFE_SYM[r.stufe]), text, aendern);
  karte.append(satz);
  if (z.rechteWahl === "stufe") {
    const stufen = el("div", "ksstufen");
    for (const st of RECHTE_STUFEN) {
      const b = kachel("ksstufe", STUFE_SYM[st.id], st.wort, st.satz, r.stufe === st.id, () => { z.rechte = { stufe: st.id, an: [], aus: [] }; z.rechteWahl = "zu"; render(); });
      b.dataset.stufe = st.id;
      stufen.append(b);
    }
    karte.append(stufen);
  }
  const alle = z.rechteWahl === "ausnahme";
  const zeilen = RECHTE_BEFEHLE.filter((b) => alle || abweichung(r, b.id));
  if (zeilen.length) {
    const liste = el("div", "ksbefehle");
    for (const b of zeilen) {
      const an = befehlAn(r, b.id);
      const zeile = el("div", `ksbefehl${an ? "" : " aus"}`);
      zeile.title = b.befehl;
      const t = el("span", "");
      t.append(el("b", "", b.wort));
      if (abweichung(r, b.id)) t.append(el("small", "", an ? "Ausnahme: erlaubt" : "Ausnahme: gesperrt"));
      const sw = el("button", "kssw") as HTMLButtonElement;
      sw.type = "button";
      sw.setAttribute("role", "switch");
      sw.setAttribute("aria-checked", String(an));
      sw.setAttribute("aria-label", b.wort);
      sw.dataset.befehl = b.id;
      // was die Stufe ohnehin sagt, ist keine Ausnahme
      sw.onclick = () => {
        const ohne = (xs: readonly string[]) => xs.filter((x) => x !== b.id), will = !an;
        z.rechte = { ...r, an: will && !stufeGibt(r.stufe, b.id) ? [...ohne(r.an), b.id] : ohne(r.an),
          aus: !will && stufeGibt(r.stufe, b.id) ? [...ohne(r.aus), b.id] : ohne(r.aus) };
        render();
      };
      zeile.append(t, sw);
      liste.append(zeile);
    }
    karte.append(liste);
  }
  const mehr = el("button", "ksmehr", alle ? "nur die Ausnahmen" : "+ Ausnahme") as HTMLButtonElement;
  mehr.type = "button";
  mehr.dataset.tu = "ausnahme";
  mehr.onclick = () => { z.rechteWahl = alle ? "zu" : "ausnahme"; render(); };
  karte.append(mehr);
  a.append(karte);
  return a;
}


const AUFGABE_HINWEIS: Readonly<Record<AufgabeFeld, string>> = { grenze: "was er nicht anfasst", fertig: "woran man es sieht",
  beleg: "welcher Check es zeigt", rueckweg: "an wen er meldet" };

function ziel(s: St, fuss: () => void): HTMLElement {
  const z = s.sitz;
  const a = abschnitt("Ziel");
  const name = document.createElement("input");
  name.className = "ksein";
  name.placeholder = "Name im Board, z. B. planer-a";
  name.maxLength = 80;
  name.value = z.name;
  name.dataset.feld = "sitz-name";
  name.oninput = () => { z.name = name.value; z.fehler = null; fuss(); };
  const ta = document.createElement("textarea");
  ta.className = "ksein ksziel";
  ta.rows = 3;
  ta.placeholder = "Was auf dem Branch entstehen soll. Geht als erste Nachricht an ihn.";
  ta.value = z.ziel;
  ta.dataset.feld = "sitz-ziel";
  ta.onchange = () => { z.ziel = ta.value; z.springen = true; nachDemKlick(render); };
  ta.oninput = () => { z.ziel = ta.value; fuss(); };
  // DIE AUFGABE UM DAS ZIEL (src/aufgabe.ts): je Feld eine Zeile, alle frei; sie gehen mit dem Ziel als erste Nachricht
  const mehr = AUFGABE_FELDER.map(([k, wort]) => {
    const i = document.createElement("input");
    i.className = "ksein";
    i.placeholder = AUFGABE_HINWEIS[k];
    i.value = z.aufgabe[k];
    i.dataset.feld = `sitz-${k}`;
    i.oninput = () => { z.aufgabe = { ...z.aufgabe, [k]: i.value }; fuss(); };
    i.onchange = () => { nachDemKlick(render); };
    const l = el("label", "ksaufz");
    l.append(el("small", "", wort), i);
    return l;
  });
  a.append(name, ta, ...mehr);
  return a;
}

function auswahl(wort: string, wert: string, opts: readonly (readonly [string, string, boolean?])[], nimm: (v: string) => void): HTMLElement {
  const l = el("label", "kschip");
  l.append(el("small", "", wort));
  const sel = document.createElement("select");
  sel.setAttribute("aria-label", wort);
  for (const [v, w, aus] of opts) { const o = new Option(w, v, false, v === wert); o.disabled = !!aus; sel.append(o); }
  sel.onchange = () => { const z = S?.sitz; nimm(sel.value); if (z) { z.springen = true; z.fehler = null; } render(); };
  l.append(sel);
  return l;
}

