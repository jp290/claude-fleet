// K15 · EIN LAUF IN DER HISTORIE (Harness 2.0 Schritt 4c, server/laeufe.ts): ob er läuft oder wie er endete, die Endbedingung seines
// Protokolls (angezeigt, nicht geprüft), seine Positionen, sein Ergebnis (Commits je Branch aus der Zeit des Laufs, Reports seiner Sessions)
// und die Zahl seiner Nachrichten. Ein laufender Lauf lässt sich von Hand beenden; seine Sessions laufen dabei weiter.
import { el, api } from "./k15-haupt";
import { LAEUFE_ROUTE } from "./k15-speicher";
import { vergissLaeufe } from "./k15-lauf";
import { aufgabeAlsText, aufgabeAus } from "./aufgabe";

interface Pos { pos: string; slot: number; zu: number | null; folgtAuf: boolean }
interface Commit { sha: string; subject: string }
interface Daten {
  at: number; aufgabe: string | null; ende: { at: number; wie: string } | null; endbedingung: string | null; positionen: Pos[]; namen: Record<string, string>;
  branches: { branch: string; positionen: string[]; commits: Commit[] | null }[]; reports: { pos: string; status: string | null; text: string }[];
  nachrichten: number; ohneBranch: { pos: string; slot: number }[]; ziele: { pos: string; slot: number; ziel: string }[];
}
const geladen = new Map<string, Daten | "laedt" | { fehler: string }>();
const bestaetigen = new Set<string>();

const rec = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : {};
const liste = (v: unknown): Record<string, unknown>[] => Array.isArray(v) ? v.map(rec) : [];
const zahl = (v: unknown): number | null => typeof v === "number" ? v : null;
const text = (v: unknown): string | null => typeof v === "string" ? v : null;
function daten(lauf: Record<string, unknown>, antwort: Record<string, unknown>): Daten {
  const e = rec(antwort.ergebnis), ende = rec(e.ende);
  return {
    at: zahl(lauf.at) ?? 0, aufgabe: (() => { const a = aufgabeAus(lauf.aufgabe); return typeof a === "string" ? null : aufgabeAlsText(a).split("\n").join(" · "); })(), ende: zahl(ende.at) !== null ? { at: zahl(ende.at) ?? 0, wie: text(ende.wie) ?? "" } : null, endbedingung: text(e.endbedingung),
    positionen: liste(lauf.positionen).map((p) => ({ pos: text(p.pos) ?? "", slot: zahl(p.slot) ?? 0, zu: zahl(p.zu), folgtAuf: zahl(p.folgtAuf) !== null })),
    namen: Object.fromEntries(Object.entries(rec(antwort.namen)).map(([k, v]) => [k, text(v) ?? k])),
    branches: liste(e.branches).map((b) => ({ branch: text(b.branch) ?? "", positionen: Array.isArray(b.positionen) ? b.positionen.map(String) : [],
      commits: Array.isArray(b.commits) ? liste(b.commits).map((c) => ({ sha: text(c.sha) ?? "", subject: text(c.subject) ?? "" })) : null })),
    reports: liste(e.reports).map((r) => ({ pos: text(r.pos) ?? "", status: text(r.status), text: text(r.text) ?? "" })),
    nachrichten: zahl(e.nachrichten) ?? 0, ohneBranch: liste(e.ohneBranch).map((b) => ({ pos: text(b.pos) ?? "", slot: zahl(b.slot) ?? 0 })),
    ziele: liste(e.ziele).map((z) => ({ pos: text(z.pos) ?? "", slot: zahl(z.slot) ?? 0, ziel: text(z.ziel) ?? "" })),
  };
}
function lies(id: string, neu: () => void): void {
  geladen.set(id, "laedt");
  const json = (pfad: string) => api(pfad).then(async (r) => {
    const j: unknown = await r.json().catch(() => null);
    if (!r.ok) throw new Error(text(rec(j).error) ?? `Antwort ${r.status}`);
    return rec(j);
  });
  const pfad = `${LAEUFE_ROUTE}/${encodeURIComponent(id)}`;
  Promise.all([json(pfad), json(`${pfad}/ergebnis`)])
    .then(([l, e]) => { geladen.set(id, daten(rec(l.lauf), e)); })
    .catch((x: unknown) => { geladen.set(id, { fehler: x instanceof Error ? x.message : "Server nicht erreichbar" }); })
    .finally(neu);
}

const uhr = (ms: number): string => new Date(ms).toLocaleString("de-DE", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
function zeile(wort: string, inhalt: string): HTMLElement {
  const z = el("div", "attsatz");
  z.append(el("span", "attwort", `${wort} · `), document.createTextNode(inhalt));
  return z;
}

export function laufAnsicht(id: string, neu: () => void): HTMLElement {
  const box = el("div", "attdetail");
  const d = geladen.get(id);
  if (d === undefined) lies(id, neu);
  if (d === undefined || d === "laedt") { box.append(el("div", "attsatz", "Lauf wird gelesen …")); return box; }
  if ("fehler" in d) { box.append(el("div", "attsatz", `Der Lauf ist nicht lesbar: ${d.fehler}`)); return box; }
  const name = (pos: string): string => d.namen[pos] ?? pos;
  box.append(zeile("Stand", d.ende ? `zu Ende seit ${uhr(d.ende.at)}, ${d.ende.wie === "hand" ? "von Hand beendet" : "alle seine Sessions sind zu"}`
    : `läuft seit ${uhr(d.at)}; er endet von Hand oder wenn alle seine Sessions zu sind`));
  box.append(zeile("Aufgabe", d.aufgabe ?? "keine am Lauf"));
  box.append(zeile("Endbedingung", d.endbedingung ? `${d.endbedingung} (steht im Protokoll; Fleet prüft sie nicht)` : "keine im Protokoll"));
  box.append(zeile("Positionen", d.positionen.map((p) => `${name(p.pos)}${p.folgtAuf ? " (Nachfolge)" : ""} auf Slot ${p.slot}, Session ${p.zu === null ? "offen" : "zu"}`).join(" · ")));
  box.append(zeile("Nachrichten", `${d.nachrichten} im Protokoll des Laufs`));
  for (const b of d.branches)
    box.append(zeile(`Commits auf ${b.branch}`, b.commits === null ? "nicht lesbar"
      : b.commits.length ? b.commits.slice(0, 10).map((c) => `${c.sha.slice(0, 8)} ${c.subject}`).join(" · ") + (b.commits.length > 10 ? ` · und ${b.commits.length - 10} weitere` : "")
      : "noch keiner im Lauf"));
  for (const z of d.ziele) box.append(zeile(`Ziel von ${name(z.pos)} (Slot ${z.slot})`, z.ziel.split("\n").join(" · ")));
  for (const b of d.ohneBranch) box.append(zeile(`${name(b.pos)} (Slot ${b.slot})`, "Branch unbekannt, dort zählt Fleet keine Commits"));
  box.append(zeile("Reports", d.reports.length ? d.reports.map((r) => `${name(r.pos)}${r.status ? ` (${r.status})` : ""}: ${r.text.split("\n")[0]}`).join(" · ") : "keiner"));
  if (!d.ende) {
    const knopf = document.createElement("button");
    knopf.className = "attghost";
    knopf.textContent = bestaetigen.has(id) ? "Ja, Lauf beenden (die Sessions laufen weiter)" : "Lauf beenden";
    knopf.onclick = () => {
      if (!bestaetigen.has(id)) { bestaetigen.add(id); neu(); return; }
      bestaetigen.delete(id);
      knopf.disabled = true;
      void api(`${LAEUFE_ROUTE}/${encodeURIComponent(id)}/ende`, { method: "POST" }).then(async (r) => {
        if (!r.ok) throw new Error(text(rec(await r.json().catch(() => null)).error) ?? `Antwort ${r.status}`);
      }).then(() => { geladen.delete(id); vergissLaeufe(); }, (x: unknown) => {
        geladen.set(id, { fehler: x instanceof Error ? x.message : "Server nicht erreichbar" });
      }).finally(neu);
    };
    const k = el("div", "attknoepfe");
    k.append(knopf);
    box.append(k);
  }
  return box;
}
