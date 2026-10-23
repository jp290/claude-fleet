// WAS EIN SITZ MITNIMMT, WENN SEINE KONSTELLATION REIST (docs/start/direction.md Schritt 3: „A setup travels whole … the shareable
// knowledge with a place for personal knowledge“; docs/start/system-concept.md, „Sharing“). Je Position ein Block `sitz`:
// - liest: die Packs, die der Sitz beim Start bekommt, als Text mit ihrer Quelle; die empfangende Fleet liest sie aus der Datei, nicht
//   aus ihrer eigenen Bibliothek, die sie vielleicht nicht hat;
// - persoenlich: die Plätze für persönliches Wissen. In der Datei steht nur, wofür der Platz ist, nie der Text: wer importiert, füllt ihn
//   mit seinem Eigenen (im Fenster oder aus seiner Bibliothek);
// - darf: die Rechte des Sitzes (session-rechte.ts) und der Permission-Mode, mit dem er lief. Der Mode ist Auskunft: die empfangende Fleet
//   startet den Sitz mit ihrem eigenen Mode für einen Sitz ohne Rolle, nie in bypass;
// - notizbuch: was der Sitz in seinem eigenen Notizbuch (server/notizbuch.ts) gelernt hat, ohne die Notizen über den Owner.
// Der Block zählt nicht in die Fassung der Konstellation (server/konst-fassungen.ts#fassungsHash): er ist, was mitreiste, und je Sitz misst
// ihn die Fassung des Agenten (server/fassung.ts). Server und Fenster lesen beide hier; kein DOM.
import { RECHTE_BEFEHLE, RECHTE_STANDARD, befehlAn, rechteAus, stufeGibt, type Rechte } from "../session-rechte";

// WAS PERSÖNLICH IST und darum nie in einer Datei steht, je Kennung der Grund (system-concept.md: „Personal knowledge stays home: the
// owner's corrections, and how to work with this owner in particular“). Hier markiert der Owner, was davon er nicht teilt.
export const PERSOENLICH: Readonly<Record<string, string>> = {
  "working-with-the-owner": "wie man mit diesem einen Owner arbeitet",
  "k-owner-korrekturen": "die Korrekturen des Owners",
};
export const istPersoenlich = (id: string): boolean => Object.hasOwn(PERSOENLICH, id);
// welche Notizen eines Notizbuchs daheim bleiben: die über den Owner (type user) und seine Hinweise zur Arbeit mit ihm (type feedback);
// eine Notiz ohne erkennbare Art bleibt auch daheim, denn ob sie teilbar ist, sagt niemand
export const NOTIZ_TEILBAR: readonly string[] = ["project", "reference"];

export type SitzWeg = "start" | "skill";
export interface SitzQuelle { pfad: string; anker: string }
// weg: wörtlich im Start oder als Skill (server/sitz-wissen.ts); wofuer: die Zeile, die eine Skill in Claudes Liste zeigt
export interface SitzPack { id: string; weg: SitzWeg; quellen: SitzQuelle[]; wofuer: string | null; text: string }
// text: das Eigene dessen, der importiert hat; in einer Datei immer null
export interface PersoenlichPlatz { id: string; weg: SitzWeg; quellen: SitzQuelle[]; wofuer: string | null; text: string | null }
export interface SitzNotiz { datei: string; text: string }
// index: MEMORY.md ohne die Zeilen der Notizen, die daheim blieben; daheim: wie viele das sind
export interface SitzNotizbuch { index: string; notizen: SitzNotiz[]; daheim: number }
// bestaetigt: der Owner der empfangenden Fleet hat die Rechte aus der Datei über den Deckel hinaus freigegeben; steht nur in ihrem Speicher,
// nie in einer Datei (sitzZumTeilen nimmt es heraus, der Import einer Datei auch)
export interface SitzDarf { rechte: Rechte | null; modus: string | null; bestaetigt?: true }
export interface Sitz { liest: SitzPack[]; persoenlich: PersoenlichPlatz[]; darf: SitzDarf; notizbuch: SitzNotizbuch | null }

export const MAX_SITZ_PACKS = 40;
export const MAX_PACK_TEXT = 200_000;
export const MAX_NOTIZEN = 200;
export const MAX_NOTIZ_TEXT = 100_000;
const NOTIZ_DATEI = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.md$/;
const PACK_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/;

const obj = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
const text = (v: unknown, max: number): string | null => typeof v === "string" && v.length <= max ? v : null;

function quellenAus(v: unknown): SitzQuelle[] | null {
  if (!Array.isArray(v) || v.length > 8) return null;
  const out: SitzQuelle[] = [];
  for (const x of v) {
    const o = obj(x), pfad = text(o?.pfad, 300), anker = text(o?.anker, 300);
    if (!pfad || anker === null) return null;
    out.push({ pfad, anker });
  }
  return out;
}
function packAus(v: unknown, persoenlich: boolean): SitzPack | PersoenlichPlatz | string {
  const o = obj(v);
  const id = typeof o?.id === "string" && PACK_ID.test(o.id) ? o.id : null;
  if (!o || !id) return "ein Pack braucht eine Kennung aus Kleinbuchstaben, Ziffern, . _ -";
  if (o.weg !== "start" && o.weg !== "skill") return `${id}: weg ist „start“ oder „skill“`;
  const quellen = quellenAus(o.quellen);
  if (!quellen) return `${id}: quellen ist eine Liste von { pfad, anker }`;
  const wofuer = o.wofuer === null || o.wofuer === undefined ? null : text(o.wofuer, 400);
  if (wofuer === null && o.wofuer !== null && o.wofuer !== undefined) return `${id}: wofuer ist ein Satz`;
  if (o.weg === "skill" && !wofuer) return `${id}: eine Skill braucht wofuer, die Zeile in Claudes Liste`;
  const t = o.text === null || o.text === undefined ? null : text(o.text, MAX_PACK_TEXT);
  if (persoenlich) {
    if (t === null && o.text !== null && o.text !== undefined) return `${id}: text ist zu lang`;
    return { id, weg: o.weg, quellen, wofuer, text: t };
  }
  if (!t) return `${id}: ein Pack braucht seinen Text`;
  if (istPersoenlich(id)) return `${id} ist persönlich und gehört unter persoenlich, ohne Text`;
  return { id, weg: o.weg, quellen, wofuer, text: t };
}
function notizbuchAus(v: unknown): SitzNotizbuch | string {
  const o = obj(v);
  if (!o) return "notizbuch ist ein Objekt { index, notizen, daheim }";
  const index = text(o.index, MAX_NOTIZ_TEXT);
  if (index === null) return "notizbuch.index ist Text";
  if (!Array.isArray(o.notizen) || o.notizen.length > MAX_NOTIZEN) return `notizbuch.notizen ist eine Liste von höchstens ${MAX_NOTIZEN}`;
  const notizen: SitzNotiz[] = [];
  for (const x of o.notizen) {
    const n = obj(x), datei = typeof n?.datei === "string" && NOTIZ_DATEI.test(n.datei) && n.datei !== "MEMORY.md" ? n.datei : null;
    const t = text(n?.text, MAX_NOTIZ_TEXT);
    if (!datei || t === null) return "eine Notiz ist { datei: <name>.md, text }";
    if (notizen.some((y) => y.datei === datei)) return `die Notiz ${datei} steht zweimal da`;
    notizen.push({ datei, text: t });
  }
  const daheim = Number.isSafeInteger(o.daheim) && Number(o.daheim) >= 0 ? Number(o.daheim) : null;
  if (daheim === null) return "notizbuch.daheim ist eine Zahl ab 0";
  return { index, notizen, daheim };
}

// EIN SITZ-BLOCK, ganz geprüft; sonst ein Satz, warum nicht
export function sitzAus(v: unknown): Sitz | string {
  const o = obj(v);
  if (!o) return "sitz ist ein Objekt { liest, persoenlich, darf, notizbuch }";
  if (!Array.isArray(o.liest) || o.liest.length > MAX_SITZ_PACKS) return `sitz.liest ist eine Liste von höchstens ${MAX_SITZ_PACKS} Packs`;
  if (!Array.isArray(o.persoenlich) || o.persoenlich.length > MAX_SITZ_PACKS) return "sitz.persoenlich ist eine Liste";
  const liest: SitzPack[] = [], persoenlich: PersoenlichPlatz[] = [];
  for (const x of o.liest) {
    const p = packAus(x, false);
    if (typeof p === "string") return p;
    liest.push({ ...p, text: p.text ?? "" });
  }
  for (const x of o.persoenlich) {
    const p = packAus(x, true);
    if (typeof p === "string") return p;
    persoenlich.push(p);
  }
  const ids = [...liest, ...persoenlich].map((p) => p.id);
  if (new Set(ids).size !== ids.length) return "ein Pack steht zweimal im Sitz";
  const d = obj(o.darf);
  if (!d) return "sitz.darf ist ein Objekt { rechte, modus }";
  const rechte = d.rechte === null || d.rechte === undefined ? null : rechteAus(d.rechte);
  if (d.rechte !== null && d.rechte !== undefined && !rechte) return "sitz.darf.rechte passt nicht (session-rechte.ts#rechteAus)";
  const modus = d.modus === null || d.modus === undefined ? null : text(d.modus, 40);
  const notizbuch = o.notizbuch === null || o.notizbuch === undefined ? null : notizbuchAus(o.notizbuch);
  if (typeof notizbuch === "string") return notizbuch;
  return { liest, persoenlich, darf: { rechte, modus, ...(d.bestaetigt === true && rechte ? { bestaetigt: true as const } : {}) }, notizbuch };
}

// WAS HINAUSGEHT: jeder persönliche Platz leer, gleich was der Importierende hineinschrieb, und keine Freigabe der Rechte
export const sitzZumTeilen = (s: Sitz): Sitz => ({ ...s, persoenlich: s.persoenlich.map((p) => ({ ...p, text: null })),
  darf: { rechte: s.darf.rechte, modus: s.darf.modus } });

// DER DECKEL (Abnahme 22.10., MUSS 1): Rechte aus einer fremden Datei gelten höchstens bis RECHTE_STANDARD („bauen“). Was darüber liegt
// (Landen, Deploy, Arbeitskopien wegwerfen), wird eine Allow-Regel, und die geht im Auto-Mode am Klassifizierer vorbei (session-rechte.ts);
// das gibt nur der Owner der empfangenden Fleet frei. `gedeckelt`: die Befehle, die die Datei erlaubte und der Deckel sperrt
export function rechteGedeckelt(r: Rechte): { rechte: Rechte; gedeckelt: string[] } {
  const gedeckelt = RECHTE_BEFEHLE.filter((b) => befehlAn(r, b.id) && !stufeGibt(RECHTE_STANDARD, b.id)).map((b) => b.id);
  const ueber = (s: Rechte["stufe"]) => RECHTE_BEFEHLE.some((b) => stufeGibt(s, b.id) && !stufeGibt(RECHTE_STANDARD, b.id));
  const rechte: Rechte = { stufe: ueber(r.stufe) ? RECHTE_STANDARD : r.stufe, an: r.an.filter((id) => !gedeckelt.includes(id)), aus: r.aus };
  return { rechte, gedeckelt };
}
// was ein mitgereister Sitz beim Start darf: die Rechte aus der Datei, gedeckelt, außer der Owner hat sie bestätigt
export const sitzRechte = (d: SitzDarf): Rechte | null => !d.rechte ? null : d.bestaetigt ? d.rechte : rechteGedeckelt(d.rechte).rechte;

// DIE ART EINER NOTIZ aus ihrem Frontmatter (`type:` oben oder unter `metadata:`); null = keine erkennbar
export function notizArt(text: string): string | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return m ? /^\s*type:\s*["']?([a-z-]+)/m.exec(m[1]!)?.[1] ?? null : null;
}
// EIN NOTIZBUCH ZUM TEILEN: die teilbaren Notizen; aus dem Index fallen die Zeilen, die auf eine daheim gebliebene zeigen
export function notizbuchZumTeilen(index: string, dateien: readonly SitzNotiz[]): SitzNotizbuch {
  const teilbar = dateien.filter((d) => NOTIZ_DATEI.test(d.datei) && d.datei !== "MEMORY.md" && NOTIZ_TEILBAR.includes(notizArt(d.text) ?? ""));
  const daheim = dateien.filter((d) => d.datei !== "MEMORY.md" && !teilbar.includes(d));
  const zeigtAuf = (z: string, d: SitzNotiz) => z.includes(`](${d.datei})`) || z.includes(`](./${d.datei})`);
  const zeilen = index.split("\n").filter((z) => !daheim.some((d) => zeigtAuf(z, d)));
  return { index: zeilen.join("\n"), notizen: teilbar.slice(0, MAX_NOTIZEN).map((d) => ({ datei: d.datei, text: d.text.slice(0, MAX_NOTIZ_TEXT) })), daheim: daheim.length };
}

// DIE PROBE vor dem Hinausgehen: steht ein persönlicher Text (ab 40 Zeichen, jeder Absatz einzeln) irgendwo in der Datei, ist sie nicht
// teilbar. Zurück kommt der erste Fund, gekürzt, oder null
export function persoenlichIn(datei: string, texte: readonly string[]): string | null {
  for (const t of texte) for (const absatz of t.split(/\n\s*\n/).map((x) => x.trim()).filter((x) => x.length >= 40)) {
    if (datei.includes(absatz) || datei.includes(JSON.stringify(absatz).slice(1, -1))) return absatz.slice(0, 80);
  }
  return null;
}
