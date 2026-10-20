// K15 · FESTE FASSUNGEN DER GEWÄHLTEN KONSTELLATION (Harness 2.0 Schritt 1, server/konst-fassungen.ts): unter dem Namen im Aufbau eine Zeile
// „Fassungen“; aufgeklappt jede gespeicherte Fassung mit Hash und Zeit, welche aktiv ist, „aktiv setzen“ und ein Vergleich mit der aktiven
// (oder bei der aktiven mit der vorigen), Position für Position und Kante für Kante. Gelesen wird erst, wenn die Konstellation gespeichert ist.
import { el, api, agoDe } from "./k15-haupt";
import { KONST_ROUTE } from "./k15-speicher";
import { letzteFassungen, render, S, toast, type St } from "./k15-zustand";
import { modelLabel } from "./modelname";

interface Kopf { hash: string; at: number; version: number | null; name: string; aktiv: boolean; positionen: number }
interface Aenderung { feld: string; von: unknown; zu: unknown }
interface Diff {
  konst: Aenderung[];
  positionen: { id: string; name: string; art: "neu" | "weg" | "geaendert"; felder: Aenderung[] }[];
  kanten: { id: string; name: string; von: string | null; zu: string | null }[];
}
type Laden<T> = T | "laedt" | { fehler: string };
interface Stand { offen: boolean; liste: Laden<Kopf[]> | null; vergleich: { von: Kopf; zu: Kopf; diff: Laden<Diff> } | null }
const stand = new Map<string, Stand>();
function von(id: string): Stand {
  const da = stand.get(id);
  if (da) return da;
  const neu: Stand = { offen: false, liste: null, vergleich: null };
  stand.set(id, neu);
  return neu;
}
const pfad = (id: string, rest: string): string => `${KONST_ROUTE}/${encodeURIComponent(id)}/${rest}`;
const kurz = (h: string): string => h.slice(0, 8);
const vName = (k: Kopf): string => k.version !== null ? `v${k.version}` : kurz(k.hash);

async function hole(path: string, init?: RequestInit): Promise<unknown> {
  const r = await api(path, init);
  const j: unknown = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j && typeof j === "object" && "error" in j && typeof j.error === "string" ? j.error : `Antwort ${r.status}`);
  return j;
}
const grund = (e: unknown): string => e instanceof Error ? e.message : "Server nicht erreichbar";
function lies(s: St, id: string): void {
  const st = von(id);
  st.liste = "laedt";
  // 404: gespeichert, bevor es Fassungen gab; die erste entsteht beim nächsten Speichern
  api(pfad(id, "fassungen")).then(async (r) => {
    const j: unknown = await r.json().catch(() => null);
    if (r.status === 404) { st.liste = []; return; }
    if (!r.ok) throw new Error(j && typeof j === "object" && "error" in j && typeof j.error === "string" ? j.error : `Antwort ${r.status}`);
    st.liste = j && typeof j === "object" && "fassungen" in j && Array.isArray(j.fassungen) ? j.fassungen as Kopf[] : [];
  }).catch((e: unknown) => { st.liste = { fehler: grund(e) }; }).finally(() => { if (S === s) render(); });
}
// nach einem Speichern: neu lesen, offen bleibt offen. Brachte das Speichern keinen neuen Inhalt, sagt ein Satz, welcher Fassung er gleicht
// (Partner 19.10.: „[Zitat entfernt]“, in der Liste fehlte v6 ohne Wort)
export function fassungenNeu(id: string): void {
  const st = von(id);
  st.liste = null;
  st.vergleich = null;
  const f = letzteFassungen[id];
  if (!f || f.neu) return;
  void api(`${pfad(id, "fassungen")}/${f.hash}`).then((r) => r.json()).then((j: unknown) => {
    const k = j && typeof j === "object" && "fassung" in j ? j.fassung as Kopf : null;
    toast(`Der Inhalt gleicht ${k ? `${vName(k)} (${kurz(f.hash)})` : kurz(f.hash)}: keine neue Fassung.`);
  }).catch(() => undefined);
}

function vergleiche(s: St, id: string, a: Kopf, b: Kopf): void {
  const st = von(id);
  if (st.vergleich?.von.hash === a.hash && st.vergleich.zu.hash === b.hash) { st.vergleich = null; render(); return; }
  const v: NonNullable<Stand["vergleich"]> = { von: a, zu: b, diff: "laedt" };
  st.vergleich = v;
  render();
  hole(`${pfad(id, "diff")}?von=${a.hash}&zu=${b.hash}`).then((j) => {
    v.diff = j && typeof j === "object" && "diff" in j ? j.diff as Diff : { fehler: "Antwort ohne Vergleich" };
  }).catch((e: unknown) => { v.diff = { fehler: grund(e) }; }).finally(() => { if (S === s) render(); });
}
function setzeAktiv(s: St, id: string, k: Kopf): void {
  hole(pfad(id, "aktiv"), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ hash: k.hash }) }).then(() => {
    if (S !== s) return;
    toast(`${vName(k)} (${kurz(k.hash)}) ist jetzt die aktive Fassung.`);
    fassungenNeu(id);
    von(id).offen = true;
    render();
  }).catch((e: unknown) => { if (S === s) toast(`Nicht umgesetzt: ${grund(e)}`); });
}

// IN WORTEN (Partner 19.10.: „[Zitat entfernt]“modell„[Zitat entfernt]“
// 
const FELD: Readonly<Record<string, string>> = { agent: "Agent", modell: "Modell", effort: "Effort", schwelle: "Übergabe ab", uebergabeAb: "Übergabe ab",
  name: "Name", satz: "Satz", quer: "Querkante", abweichend: "abweichend", eigeneDatei: "eigene Datei", schalter: "Schalter", werteAbw: "Werte",
  ohneTeile: "Teile aus", wann: "wann", profil: "Profil", autor: "Autor", version: "Fassung", rolle: "Rolle",
  protokoll: "Protokoll", ende: "Endbedingung", runden: "Rundendeckel", regel: "Prüfregel" };
const feldWort = (f: string): string => f.split(".").map((x) => FELD[x] ?? x).join(" · ");
const istObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function aufgeklappt(a: Aenderung): Aenderung[] {
  if (!istObj(a.von) && !istObj(a.zu)) return [a];
  const x = istObj(a.von) ? a.von : {}, y = istObj(a.zu) ? a.zu : {};
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]))
    .map((k) => ({ feld: `${a.feld}.${k}`, von: x[k] ?? null, zu: y[k] ?? null }));
}
const wert = (v: unknown, feld = ""): string => {
  if (v === null || v === undefined) return feld.startsWith("protokoll") ? "keine" : "Standard";
  if (typeof v === "string" && /(^|\.)modell$/.test(feld)) return modelLabel(v);
  const t = typeof v === "string" ? v : JSON.stringify(v);
  return t.length > 70 ? `${t.slice(0, 67)}…` : t;
};
const satz = (a: Aenderung): string => `${feldWort(a.feld)}: ${wert(a.von, a.feld)} → ${wert(a.zu, a.feld)}`;
function diffEl(d: Laden<Diff>): HTMLElement {
  const box = el("div", "k15fdiff");
  if (d === "laedt") { box.append(el("div", "k15fz", "wird verglichen …")); return box; }
  if ("fehler" in d) { box.append(el("div", "k15fz warn", `Nicht verglichen: ${d.fehler}`)); return box; }
  const zeile = (text: string, cls = "") => box.append(el("div", `k15fz ${cls}`, text));
  for (const a of d.konst.flatMap(aufgeklappt)) zeile(`Konstellation · ${satz(a)}`);
  for (const p of d.positionen) {
    if (p.art !== "geaendert") { zeile(`${p.art === "neu" ? "+" : "−"} Position „${p.name}“ ${p.art === "neu" ? "kommt dazu" : "fällt weg"}`, p.art); continue; }
    for (const a of p.felder.flatMap(aufgeklappt)) zeile(`„${p.name}“ · ${satz(a)}`);
  }
  for (const k of d.kanten) zeile(`Kante · „${k.name}“ meldet an ${k.von ?? "niemanden"} → ${k.zu ?? "niemanden"}`, "kante");
  if (!box.childElementCount) zeile("Kein Unterschied im Inhalt.");
  return box;
}

export function fassungenTeil(s: St): HTMLElement | null {
  const id = s.k.id;
  if (!s.konstGespeichert.has(id)) return null;
  const st = von(id);
  if (st.liste === null) lies(s, id);
  const liste = Array.isArray(st.liste) ? st.liste : null;
  const aktiv = liste?.find((f) => f.aktiv);
  const box = el("div", `k15fass${st.offen ? " offen" : ""}`);
  const k = el("button", "k15fkopf") as HTMLButtonElement;
  k.type = "button";
  k.setAttribute("aria-expanded", String(st.offen));
  k.append(el("b", "", "Fassungen"), el("span", "", st.liste === "laedt" || st.liste === null ? "werden gelesen …"
    : !liste ? `nicht lesbar: ${typeof st.liste === "object" && "fehler" in st.liste ? st.liste.fehler : ""}`
    : !liste.length ? "noch keine; die erste entsteht beim nächsten Speichern"
    : `${liste.length} gespeichert${aktiv ? ` · aktiv ${vName(aktiv)} · ${kurz(aktiv.hash)}` : ""}`));
  // „aktiv“ ist heute ein Zeiger, den noch niemand liest; gestartet wird mit dem Stand im Aufbau (Partner 19.10., bis zum Lauf in Schritt 4)
  k.title = "Jedes Speichern legt eine Fassung an, die sich nicht mehr ändert. „aktiv“ markiert die gültige Fassung; gestartet wird heute noch mit dem Stand im Aufbau.";
  k.onclick = () => { st.offen = !st.offen; render(); };
  box.append(k);
  if (!st.offen || !liste) return box;
  if (aktiv) box.append(el("div", "k15fvon", "„aktiv“ markiert die gültige Fassung. Gestartet wird heute noch mit dem Stand im Aufbau."));
  liste.forEach((f, i) => {
    const r = el("div", `k15frow${f.aktiv ? " aktiv" : ""}`);
    const h = el("code", "", kurz(f.hash));
    h.title = f.hash;
    r.append(el("b", "", vName(f)), h, el("span", "k15fwann", agoDe(Date.now() - f.at)));
    if (f.aktiv) r.append(el("span", "k15tag k15faktiv", "aktiv"));
    else {
      const b = el("button", "k15link", "aktiv setzen") as HTMLButtonElement;
      b.type = "button";
      b.onclick = () => setzeAktiv(s, id, f);
      r.append(b);
    }
    // die aktive mit der vorigen, jede andere mit der aktiven
    const gegen = f.aktiv ? liste[i + 1] : aktiv;
    if (gegen) {
      const c = el("button", "k15link", f.aktiv ? `mit ${vName(gegen)} vergleichen` : "mit aktiver vergleichen") as HTMLButtonElement;
      c.type = "button";
      c.setAttribute("aria-pressed", String(st.vergleich?.von.hash === gegen.hash && st.vergleich.zu.hash === f.hash));
      c.onclick = () => vergleiche(s, id, gegen, f);
      r.append(c);
    }
    box.append(r);
    if (st.vergleich?.zu.hash === f.hash) {
      box.append(el("div", "k15fvon", `von ${vName(st.vergleich.von)} (${kurz(st.vergleich.von.hash)}) nach ${vName(f)} (${kurz(f.hash)})`), diffEl(st.vergleich.diff));
    }
  });
  return box;
}
