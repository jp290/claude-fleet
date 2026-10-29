// FERNPOST: DIE NACHBARN EINER FLEET (branch/fernpost, Owner 29.10.: „[Zitat entfernt]“). Zwei Fleets, Workhorse und Mac, haben je ihr eigenes Postfach; was sie verbindet,
// steht allein in der lokalen Bindung der EMPFANGENDEN Fleet:
//
//   ~/.config/claude-fleet/nachbarn.json      { "nachbarn": [{ "name", "url"?, "ausweisAus"?, "ausweisEin"?, "erlaubt": [{ "von", "an" }] }] }
//   ~/.config/claude-fleet/secrets/<datei>    je ein Ausweis, chmod 600
//
//   name        wie DIESE Fleet den Nachbarn nennt (kleingeschrieben, Ziffern, Bindestrich) — die Adresse {kind:"remote",fleet:name,slot}
//   url         wohin sie dem Nachbarn schreibt (nur zum Senden nötig)
//   ausweisAus  Datei in secrets/: der Ausweis, den diese Fleet dem Nachbarn VORZEIGT
//   ausweisEin  Datei in secrets/: der Ausweis, den der Nachbar DIESER Fleet vorzeigen muss (nur zum Empfangen nötig)
//   erlaubt     die Paare, die diese Fleet freigibt: ein Sitz des Nachbarn (`von`) darf einem Sitz hier (`an`) schreiben.
//               Was nicht dasteht, lehnt die Tür ab; die Antwort an einen Sitz drüben braucht das Paar in der Gegenrichtung
//               in der Liste der ANDEREN Fleet — jede Richtung gibt die Fleet frei, die empfängt.
//
// DIE FREIGABE HÄNGT AM SLOT-PAAR, nicht an der Belegung und nicht am Ordner (Leitung 29.10.): beide Fleets gehören demselben Owner, er
// trägt die Paare von Hand ein und denkt in Slots; eine Bindung an Slot und Ordner (wie bei den Kanten) sperrte jede Nachfolge, die in
// einem anderen Ordner weiterarbeitet, stumm aus.
//
// Ein Ausweis ist nie der Owner-Token und nie ein Self-Token (die Bindung weist beides ab), steht nie in einer getrackten Datei und
// nie in einem Text, einem Log oder einer Antwort: dieses Modul gibt ihn nur an den Vergleich und an den Authorization-Kopf der Tür.
// Rein bis auf das Lesen der Bindung; die Datei wird bei jeder Anfrage gelesen, eine Freigabe gilt also ohne Neustart.
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { BINDUNG_DIR } from "./bindung";

export const NACHBAR_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const AUSWEIS_MIN = 24;
export interface Paar { von: number; an: number }
export interface Nachbar {
  name: string;
  url: string | null;
  // die Werte der Ausweise: nur für den Vergleich und den Authorization-Kopf, nie in Text, Log oder Antwort
  ausweisAus: string | null;
  ausweisEin: string | null;
  erlaubt: Paar[];
}
// `probleme`: was an der Bindung nicht stimmt, je ein Satz, der mit dem Namen des Nachbarn beginnt, wo einer bekannt ist — nie ein Ausweis
export interface Nachbarn { nachbarn: Nachbar[]; probleme: string[] }

export const bindungsOrdner = (): string => process.env.FLEET_BINDUNG_DIR || BINDUNG_DIR;

const nurName = (datei: unknown): string | null =>
  typeof datei === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(datei) && !datei.startsWith(".") ? datei : null;

// Ein Ausweis aus secrets/: nur der Dateiname, nie ein Pfad; die Datei darf Gruppe und Andere nichts erlauben (chmod 600).
function liesAusweis(dir: string, datei: unknown, was: string, verboten: readonly string[]): { wert: string | null; problem?: string } {
  if (datei === undefined || datei === null) return { wert: null };
  const name = nurName(datei);
  if (!name) return { wert: null, problem: `${was}: only a file name in secrets/ is allowed` };
  const pfad = join(dir, "secrets", name);
  try {
    if (statSync(pfad).mode & 0o077) return { wert: null, problem: `${was}: secrets/${name} is readable by group or others — chmod 600` };
    const wert = readFileSync(pfad, "utf8").trim();
    if (wert.length < AUSWEIS_MIN) return { wert: null, problem: `${was}: secrets/${name} holds fewer than ${AUSWEIS_MIN} characters` };
    if (verboten.includes(wert)) return { wert: null, problem: `${was}: secrets/${name} is an owner or self token — fleets exchange a badge of their own` };
    return { wert };
  } catch {
    return { wert: null, problem: `${was}: secrets/${name} is not readable` };
  }
}

// `verboten`: die Token dieser Fleet (Owner, Self), die nie ein Ausweis sein dürfen. Ohne Datei: keine Nachbarn, keine Probleme.
export function ladeNachbarn(verboten: readonly string[] = [], dir = bindungsOrdner()): Nachbarn {
  let roh: unknown;
  try { roh = JSON.parse(readFileSync(join(dir, "nachbarn.json"), "utf8")); } catch (e) {
    return { nachbarn: [], probleme: (e as NodeJS.ErrnoException).code === "ENOENT" ? [] : ["nachbarn.json is not readable JSON"] };
  }
  const liste = roh && typeof roh === "object" && "nachbarn" in roh && Array.isArray(roh.nachbarn) ? roh.nachbarn as unknown[] : null;
  if (!liste) return { nachbarn: [], probleme: ["nachbarn.json: expected { \"nachbarn\": [...] }"] };
  const probleme: string[] = [];
  const nachbarn: Nachbar[] = [];
  for (const [i, e] of liste.entries()) {
    const r = e && typeof e === "object" && !Array.isArray(e) ? e as Record<string, unknown> : null;
    if (!r || typeof r.name !== "string" || !NACHBAR_NAME.test(r.name)) { probleme.push(`nachbarn.json entry ${i + 1}: name is missing or not a name (lowercase letters, digits, dashes)`); continue; }
    if (nachbarn.some((n) => n.name === r.name)) { probleme.push(`${r.name}: the name appears twice — only the first entry counts`); continue; }
    const aus = liesAusweis(dir, r.ausweisAus, `${r.name}.ausweisAus`, verboten);
    const ein = liesAusweis(dir, r.ausweisEin, `${r.name}.ausweisEin`, verboten);
    for (const p of [aus.problem, ein.problem]) if (p) probleme.push(p);
    let url: string | null = null;
    if (typeof r.url === "string" && /^https?:\/\/[^\s/]+\/?$/.test(r.url)) url = r.url.replace(/\/$/, "");
    else if (r.url !== undefined) probleme.push(`${r.name}.url: expected http(s)://host:port`);
    const erlaubt: Paar[] = [];
    for (const p of Array.isArray(r.erlaubt) ? r.erlaubt as unknown[] : []) {
      const q = p && typeof p === "object" ? p as Record<string, unknown> : null;
      if (q && Number.isInteger(q.von) && Number.isInteger(q.an) && (q.von as number) > 0 && (q.an as number) > 0)
        erlaubt.push({ von: q.von as number, an: q.an as number });
      else probleme.push(`${r.name}.erlaubt: a pair needs von and an as slot numbers`);
    }
    // ein Nachbar mit gleichem Ausweis in beide Richtungen wäre ein Schlüssel, der in beide Türen passt
    if (aus.wert && aus.wert === ein.wert) { probleme.push(`${r.name}: ausweisAus and ausweisEin are the same badge — the neighbour is left out`); continue; }
    nachbarn.push({ name: r.name, url, ausweisAus: aus.wert, ausweisEin: ein.wert, erlaubt });
  }
  return { nachbarn, probleme };
}

// was an der Bindung diesen Nachbarn betrifft, dazu was die ganze Datei betrifft
export const problemeFuer = (n: Nachbarn, name: string): string[] =>
  n.probleme.filter((p) => p.startsWith(`${name}.`) || p.startsWith(`${name}:`) || p.startsWith("nachbarn.json"));

const gleich = (a: string, b: string): boolean => {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
};
// Wer zeigt diesen Ausweis vor? Alle Nachbarn werden verglichen, der Treffer bricht nichts ab.
export function nachbarFuerAusweis(nachbarn: readonly Nachbar[], vorgezeigt: string | null): Nachbar | null {
  if (!vorgezeigt) return null;
  let treffer: Nachbar | null = null;
  for (const n of nachbarn) if (n.ausweisEin && gleich(n.ausweisEin, vorgezeigt) && !treffer) treffer = n;
  return treffer;
}
export const paarErlaubt = (n: Nachbar, von: number, an: number): boolean => n.erlaubt.some((p) => p.von === von && p.an === an);

// DER KOPF AUF DEM DRAHT — und nur er: Ausweis im Authorization-Kopf, im Body nur Slots, Text und Schlüssel
export interface FernNachricht {
  from: { slot: number };
  to: { slot: number };
  payload: { kind: "text"; text: string };
  idempotencyKey: string;
  // der Schlüssel der Nachricht, auf die geantwortet wird (der Absender drüben hat ihn selbst gewählt)
  replyRef?: string;
}

export const FERN_TUER = "/api/fleet-nachbar/messages";
