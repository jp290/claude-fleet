// FESTE FASSUNGEN EINER KONSTELLATION (Harness 2.0, Schritt 1; ~/local-notes/grok-auswertung/harness-2-0-antwort.md Lücke 1). Der Speicher
// des Fensters (server/k15-speicher.ts) hält je Konstellation nur den letzten Stand, ein PUT ersetzt ihn. Daneben legt dieses Modul bei jedem
// Speichern eine Fassung an, die sich nicht mehr ändert: die gespeicherte Form (k15-zustand.ts#konstForm) mit einem sha256 über ihre
// kanonische Form, ohne Kennung und Zähler. Gleicher Inhalt gibt denselben Hash und keine neue Fassung. Je Konstellation zeigt „aktiv“ auf eine
// Fassung: die erste wird es von selbst, jede weitere steht daneben, bis jemand sie aktiv setzt. Eine Datei im Zustandsverzeichnis; die Routen
// hängt server.ts hinter das Owner-Tor wie den Speicher.
import { open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { KONST_ROUTE } from "../src/k15-speicher";
import { json } from "./json";

export const FASSUNGEN_DATEI = "k15-konst-fassungen.json";
// je Konstellation; darüber fällt die älteste heraus, die nicht aktiv ist
export const MAX_FASSUNGEN_JE = 100;

export interface Fassung { hash: string; at: number; version: number | null; name: string; form: Record<string, unknown> }
interface Verlauf { aktiv: string | null; fassungen: Fassung[] }
type Buch = Record<string, Verlauf>;

// kanonisch: Schlüssel sortiert, Kennung und Zähler weg; so hängt der Hash nur am Inhalt
const kanon = (v: unknown): unknown => Array.isArray(v) ? v.map(kanon)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, kanon(x)])) : v;
export function fassungsHash(form: Record<string, unknown>): string {
  const { id: _id, version: _v, ...inhalt } = form;
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(kanon(inhalt))).digest("hex");
}

let seq = 0;
async function ersetze(datei: string, text: string): Promise<void> {
  const tmp = `${datei}.${process.pid}.${seq++}.tmp`;
  try {
    const fh = await open(tmp, "wx", 0o600);
    try { await fh.writeFile(text); await fh.sync(); } finally { await fh.close(); }
    await rename(tmp, datei);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
}
async function liesBuch(dir: string): Promise<Buch> {
  const f = Bun.file(join(dir, FASSUNGEN_DATEI));
  if (!(await f.exists())) return {};
  const o: unknown = JSON.parse(await f.text());
  return o && typeof o === "object" && !Array.isArray(o) ? o as Buch : {};
}
// ein Schreiber nach dem anderen: zwei Fenster, die gleichzeitig speichern, verlieren keine Fassung
let reihe: Promise<unknown> = Promise.resolve();
function nacheinander<T>(tu: () => Promise<T>): Promise<T> {
  const p = reihe.then(tu, tu);
  reihe = p.catch(() => undefined);
  return p;
}

// EINE FASSUNG für einen Lauf (server/laeufe.ts): die mit diesem Hash, ohne Hash die aktive; null = keine
export async function fassungVon(id: string, hash: string | null, dir: string): Promise<Fassung | null> {
  const v = (await liesBuch(dir))[id];
  const h = hash ?? v?.aktiv ?? null;
  return v && h ? v.fassungen.find((f) => f.hash === h) ?? null : null;
}

// NACH EINEM GESPEICHERTEN PUT: je Konstellation die Fassung, die jetzt gilt, und ob sie neu ist
export function merkeFassungen(konstellationen: readonly unknown[], dir: string, jetzt = Date.now()): Promise<Record<string, { hash: string; neu: boolean }>> {
  return nacheinander(async () => {
    const buch = await liesBuch(dir);
    const out: Record<string, { hash: string; neu: boolean }> = {};
    let geaendert = false;
    for (const k of konstellationen) {
      if (!k || typeof k !== "object" || Array.isArray(k)) continue;
      const form = k as Record<string, unknown>;
      if (typeof form.id !== "string") continue;
      const hash = fassungsHash(form);
      const v = buch[form.id] ?? { aktiv: null, fassungen: [] };
      if (v.fassungen.some((f) => f.hash === hash)) { out[form.id] = { hash, neu: false }; continue; }
      const neu: Fassung = { hash, at: jetzt, version: typeof form.version === "number" ? form.version : null, name: typeof form.name === "string" ? form.name : form.id, form };
      let fassungen = [...v.fassungen, neu];
      while (fassungen.length > MAX_FASSUNGEN_JE) {
        const i = fassungen.findIndex((f) => f.hash !== v.aktiv);
        fassungen = fassungen.filter((_, j) => j !== i);
      }
      buch[form.id] = { aktiv: v.aktiv ?? hash, fassungen };
      out[form.id] = { hash, neu: true };
      geaendert = true;
    }
    if (geaendert) await ersetze(join(dir, FASSUNGEN_DATEI), JSON.stringify(buch));
    return out;
  });
}

// DER VERGLEICH zweier Fassungen: Konstellation, Position für Position, Kante für Kante (meldetAn)
export interface Aenderung { feld: string; von: unknown; zu: unknown }
export interface KonstDiff {
  konst: Aenderung[];
  positionen: { id: string; name: string; art: "neu" | "weg" | "geaendert"; felder: Aenderung[] }[];
  kanten: { id: string; name: string; von: string | null; zu: string | null }[];
}
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(kanon(a)) === JSON.stringify(kanon(b));
const rec = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
function felder(a: Record<string, unknown>, b: Record<string, unknown>, ohne: readonly string[], vor = ""): Aenderung[] {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !ohne.includes(k)).sort();
  return keys.filter((k) => !gleich(a[k], b[k])).map((k) => ({ feld: `${vor}${k}`, von: a[k] ?? null, zu: b[k] ?? null }));
}
const positionenVon = (form: Record<string, unknown>): Record<string, unknown>[] => Array.isArray(form.positionen) ? form.positionen.map(rec) : [];
export function konstDiff(von: Record<string, unknown>, zu: Record<string, unknown>): KonstDiff {
  const pa = positionenVon(von), pb = positionenVon(zu);
  const name = (ps: Record<string, unknown>[], id: unknown): string | null => {
    const p = ps.find((x) => x.id === id);
    return p ? String(p.name ?? p.id) : null;
  };
  const positionen: KonstDiff["positionen"] = [], kanten: KonstDiff["kanten"] = [];
  for (const id of [...new Set([...pa, ...pb].map((p) => String(p.id)))]) {
    const a = pa.find((p) => p.id === id), b = pb.find((p) => p.id === id);
    const nm = String((b ?? a)?.name ?? id);
    if (!a || !b) positionen.push({ id, name: nm, art: a ? "weg" : "neu", felder: [] });
    else {
      const f = [...felder(a, b, ["id", "meldetAn", "profil"]), ...felder(rec(a.profil), rec(b.profil), [], "profil.")];
      if (f.length) positionen.push({ id, name: nm, art: "geaendert", felder: f });
    }
    const ka = a ? name(pa, a.meldetAn) : null, kb = b ? name(pb, b.meldetAn) : null;
    if ((a?.meldetAn ?? null) !== (b?.meldetAn ?? null)) kanten.push({ id, name: nm, von: ka, zu: kb });
  }
  return { konst: felder(von, zu, ["id", "version", "positionen", "format", "fleet"]), positionen, kanten };
}

// DIE ROUTEN unter KONST_ROUTE/:id: …/fassungen (Liste), …/fassungen/:hash (eine), …/diff?von=&zu=, PUT …/aktiv {hash}. Ein Hash darf
// gekürzt sein, solange er eindeutig ist (ab 8 Zeichen)
const finde = (v: Verlauf, h: string | null): Fassung | string => {
  if (!h || !/^[0-9a-f]{8,64}$/.test(h)) return "ein Hash hat 8 bis 64 Hex-Zeichen";
  const treffer = v.fassungen.filter((f) => f.hash.startsWith(h));
  return treffer.length === 1 ? treffer[0]! : treffer.length ? `„${h}“ ist nicht eindeutig` : `keine Fassung „${h}“`;
};
const kopf = (f: Fassung, aktiv: string | null) => ({ hash: f.hash, at: f.at, version: f.version, name: f.name, aktiv: f.hash === aktiv,
  positionen: positionenVon(f.form).length });

export async function konstFassungen(req: Request, url: URL, dir: string): Promise<Response> {
  const m = new RegExp(`^${KONST_ROUTE}/([^/]{1,80})/(fassungen|diff|aktiv)(?:/([^/]+))?$`).exec(url.pathname);
  if (!m) return json({ error: "unbekannter Pfad" }, 404);
  const id = decodeURIComponent(m[1]!), was = m[2]!, hash = m[3] ?? null;
  let buch: Buch;
  try { buch = await liesBuch(dir); } catch { return json({ error: "die Fassungen sind nicht lesbar" }, 500); }
  const v = buch[id];
  if (!v) return json({ error: `keine gespeicherte Fassung von „${id}“` }, 404);
  if (was === "fassungen" && req.method === "GET") {
    if (!hash) return json({ aktiv: v.aktiv, fassungen: [...v.fassungen].reverse().map((f) => kopf(f, v.aktiv)) });
    const f = finde(v, hash);
    return typeof f === "string" ? json({ error: f }, 404) : json({ fassung: kopf(f, v.aktiv), form: f.form });
  }
  if (was === "diff" && req.method === "GET" && !hash) {
    const a = finde(v, url.searchParams.get("von")), b = finde(v, url.searchParams.get("zu") ?? v.aktiv);
    if (typeof a === "string") return json({ error: `von: ${a}` }, 400);
    if (typeof b === "string") return json({ error: `zu: ${b}` }, 400);
    return json({ von: kopf(a, v.aktiv), zu: kopf(b, v.aktiv), diff: konstDiff(a.form, b.form) });
  }
  if (was === "aktiv" && req.method === "PUT" && !hash) {
    const body: unknown = await req.json().catch(() => null);
    const f = finde(v, body && typeof body === "object" && "hash" in body && typeof body.hash === "string" ? body.hash : null);
    if (typeof f === "string") return json({ error: f }, 400);
    return nacheinander(async () => {
      const frisch = await liesBuch(dir);
      const fv = frisch[id];
      if (!fv) return json({ error: `keine gespeicherte Fassung von „${id}“` }, 404);
      await ersetze(join(dir, FASSUNGEN_DATEI), JSON.stringify({ ...frisch, [id]: { ...fv, aktiv: f.hash } }));
      return json({ ok: true, aktiv: f.hash });
    });
  }
  return json({ error: "diese Methode nimmt der Pfad nicht" }, 405);
}
