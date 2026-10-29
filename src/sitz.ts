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
import { RECHTE_BEFEHLE, RECHTE_STANDARD, befehlAn, istRechtId, rechteAus, stufeGibt, type Rechte, type RechtId } from "../session-rechte";

// WAS PERSÖNLICH IST und darum nie in einer Datei steht, je Kennung der Grund (system-concept.md: „Personal knowledge stays home: the
// owner's corrections, and how to work with this owner in particular“). Hier markiert der Owner, was davon er nicht teilt.
export const PERSOENLICH: Readonly<Record<string, string>> = {
  "working-with-the-owner": "wie man mit diesem einen Owner arbeitet",
  "k-owner-korrekturen": "die Korrekturen des Owners",
};
// Die Marke steht am Wissen selbst (`personal: true`): ein Pack, ein Konzept oder eine Notiz trägt sie, wo es liegt.
// Die zwei Ids oben sind nur noch der Leseschim für alte Bestände; keine neue Id kommt hier hinein.
export const istPersoenlich = (id: string, mark = false): boolean => mark || Object.hasOwn(PERSOENLICH, id);
// welche Notizen eines Notizbuchs daheim bleiben: die über den Owner (type user) und seine Hinweise zur Arbeit mit ihm (type feedback);
// eine Notiz ohne erkennbare Art bleibt auch daheim, denn ob sie teilbar ist, sagt niemand
export const NOTIZ_TEILBAR: readonly string[] = ["project", "reference"];

export type SitzWeg = "start" | "skill";
export interface SitzQuelle { pfad: string; anker: string }
// weg: wörtlich im Start oder als Skill (server/sitz-wissen.ts); wofuer: die Zeile, die eine Skill in Claudes Liste zeigt
export interface SitzPack { id: string; weg: SitzWeg; quellen: SitzQuelle[]; wofuer: string | null; text: string; personal?: true; author?: string }
// text: das Eigene dessen, der importiert hat; in einer Datei immer null
export interface PersoenlichPlatz { id: string; weg: SitzWeg; quellen: SitzQuelle[]; wofuer: string | null; text: string | null; personal?: true; author?: string }
export interface SitzNotiz { datei: string; text: string }
// Ein Konzept im Sitz-Block: Hash und Text wie bei einem Pack, aber mit seiner Version; persönlich = leerer Platz.
export interface SitzKonzept { id: string; version: number | null; hash: string | null; text: string | null; personal?: true; purpose?: string | null; author?: string }
// index: MEMORY.md ohne die Zeilen der Notizen, die daheim blieben; daheim: wie viele das sind
export interface SitzNotizbuch { index: string; notizen: SitzNotiz[]; daheim: number }
/** Die Richtung: persons own, so a shared setup carries only the empty place. */
export interface SitzRichtung { text: string | null; personal?: true }
// bestaetigt: der Owner der empfangenden Fleet hat die Rechte aus der Datei über den Deckel hinaus freigegeben; steht nur in ihrem Speicher,
// nie in einer Datei (sitzZumTeilen nimmt es heraus, der Import einer Datei auch)
export interface SitzDarf {
  rechte: Rechte | null; modus: string | null; bestaetigt?: true;
  /** das Rechtebundel einer Rolle, das die Datei erbittet: bis zur Freigabe des Owners gibt es keine dieser Rechte */
  rolle?: readonly RechtId[];
}
export interface Sitz { liest: SitzPack[]; persoenlich: PersoenlichPlatz[]; darf: SitzDarf; notizbuch: SitzNotizbuch | null;
  /** die Kennung des Rollensteins, auch wenn das Profil den eingebauten Namen nicht tragen darf */
  rolle?: string;
  /** der leere Platz der Richtung; sein Text bleibt daheim */
  richtung?: SitzRichtung;
  /** die Konzepte, die dieser Sitz liest; persönliche als leerer Platz */
  konzepte?: SitzKonzept[];
  /** die Dateinamen der Notizen, die daheim bleiben: die leeren Plätze eines geteilten Setups */
  persoenlicheNotizen?: string[] }

export const MAX_SITZ_PACKS = 40;
export const MAX_PACK_TEXT = 200_000;
export const MAX_NOTIZEN = 200;
export const MAX_NOTIZ_TEXT = 100_000;
const NOTIZ_DATEI = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.md$/;
const PACK_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const KONZEPT_ID = /^k-[a-z0-9-]{1,64}$/;

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
  const author = o.author === null || o.author === undefined ? null : text(o.author, 120);
  if (author === null && o.author !== null && o.author !== undefined) return `${id}: author ist ein Name`;
  const t = o.text === null || o.text === undefined ? null : text(o.text, MAX_PACK_TEXT);
  if (persoenlich) {
    if (t === null && o.text !== null && o.text !== undefined) return `${id}: text ist zu lang`;
    return { id, weg: o.weg, quellen, wofuer, text: t, ...(o.personal === true ? { personal: true as const } : {}),
      ...(author ? { author } : {}) };
  }
  if (!t) return `${id}: ein Pack braucht seinen Text`;
  if (istPersoenlich(id, o.personal === true)) return `${id} ist persönlich und gehört unter persoenlich, ohne Text`;
  return { id, weg: o.weg, quellen, wofuer, text: t, ...(o.personal === true ? { personal: true as const } : {}), ...(author ? { author } : {}) };
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
  const rolle = d.rolle === undefined || d.rolle === null ? [] : Array.isArray(d.rolle) && d.rolle.every(istRechtId) ? [...new Set(d.rolle as RechtId[])] : null;
  if (rolle === null) return "sitz.darf.rolle passt nicht (session-rechte.ts#RECHT_IDS)";
  const notizbuch = o.notizbuch === null || o.notizbuch === undefined ? null : notizbuchAus(o.notizbuch);
  if (typeof notizbuch === "string") return notizbuch;
  const konzepte: SitzKonzept[] = [];
  if (o.konzepte !== undefined) {
    if (!Array.isArray(o.konzepte) || o.konzepte.length > MAX_SITZ_PACKS) return "sitz.konzepte ist eine Liste";
    for (const x of o.konzepte) {
      const c = obj(x), id = typeof c?.id === "string" && KONZEPT_ID.test(c.id) ? c.id : null;
      const version = c?.version === null || c?.version === undefined ? null : Number.isSafeInteger(c.version) && Number(c.version) >= 1 ? Number(c.version) : undefined;
      const hash = c?.hash === null || c?.hash === undefined ? null : typeof c.hash === "string" ? c.hash : undefined;
      const t = c?.text === null || c?.text === undefined ? null : typeof c.text === "string" ? c.text : undefined;
      if (!c || !id || version === undefined || hash === undefined || t === undefined) return "ein Konzept ist { id, version, hash, text }";
      if (c.personal === true) {
        if (t !== null || hash !== null) return `${id}: ein persönliches Konzept trägt keinen Text`;
      } else if (t === null || hash === null) return `${id}: ein geteiltes Konzept braucht Text und Hash`;
      konzepte.push({ id, version, hash, text: t, ...(c.personal === true ? { personal: true as const } : {}),
        ...(typeof c.author === "string" ? { author: text(c.author, 120) ?? undefined } : {}),
        ...(typeof c.purpose === "string" ? { purpose: c.purpose } : {}) });
    }
  }
  const persoenlicheNotizen = Array.isArray(o.persoenlicheNotizen)
    ? o.persoenlicheNotizen.filter((x): x is string => typeof x === "string" && NOTIZ_DATEI.test(x) && x !== "MEMORY.md")
    : undefined;
  const sitzRolle = o.rolle === undefined || o.rolle === null ? null : text(o.rolle, 80);
  if (sitzRolle === null && o.rolle !== null && o.rolle !== undefined) return "sitz.rolle ist eine Rollenkennung";
  let richtung: SitzRichtung | undefined;
  if (o.richtung !== undefined && o.richtung !== null) {
    const r = obj(o.richtung);
    if (!r || !(r.text === null || typeof r.text === "string")) return "sitz.richtung ist { text: null|string }";
    richtung = { text: r.text as string | null, ...(r.personal === true ? { personal: true as const } : {}) };
  }
  return { liest, persoenlich, darf: { rechte, modus, ...(rolle.length ? { rolle } : {}),
      ...(d.bestaetigt === true && (rechte || rolle.length) ? { bestaetigt: true as const } : {}) }, notizbuch,
    ...(sitzRolle ? { rolle: sitzRolle } : {}),
    ...(richtung ? { richtung } : {}),
    ...(konzepte.length ? { konzepte } : {}), ...(persoenlicheNotizen?.length ? { persoenlicheNotizen } : {}) };
}

// WAS HINAUSGEHT: jeder persönliche Platz leer, gleich was der Importierende hineinschrieb, und keine Freigabe der Rechte
export const sitzZumTeilen = (s: Sitz): Sitz => ({ ...s, persoenlich: s.persoenlich.map((p) => ({ ...p, text: null })),
  ...(s.richtung ? { richtung: { text: null, personal: true as const } } : {}),
  darf: { rechte: s.darf.rechte, modus: s.darf.modus, ...(s.darf.rolle?.length ? { rolle: s.darf.rolle } : {}) } });

// DER DECKEL (Abnahme 22.10., MUSS 1): Rechte aus einer fremden Datei gelten höchstens bis RECHTE_STANDARD („bauen“). Was darüber liegt
// (Landen, Deploy, Arbeitskopien wegwerfen), wird eine Allow-Regel, und die geht im Auto-Mode am Klassifizierer vorbei (session-rechte.ts);
// das gibt nur der Owner der empfangenden Fleet frei. `gedeckelt`: die Befehle, die die Datei erlaubte und der Deckel sperrt
export function rechteGedeckelt(r: Rechte): { rechte: Rechte; gedeckelt: string[] } {
  const gedeckelt = RECHTE_BEFEHLE.filter((b) => befehlAn(r, b.id) && !stufeGibt(RECHTE_STANDARD, b.id)).map((b) => b.id);
  const ueber = (s: Rechte["stufe"]) => RECHTE_BEFEHLE.some((b) => stufeGibt(s, b.id) && !stufeGibt(RECHTE_STANDARD, b.id));
  const rechte: Rechte = { stufe: ueber(r.stufe) ? RECHTE_STANDARD : r.stufe, an: r.an.filter((id) => !gedeckelt.includes(id)), aus: r.aus };
  return { rechte, gedeckelt };
}
// was ein mitgereister Sitz beim Start darf: die Rechte aus der Datei, gedeckelt, außer der Owner hat sie bestätigt.
// Ein Rollenbundel kommt erst nach seiner Freigabe dazu; vorher ist es nur erbeten, nie gewährt.
export const sitzRechte = (d: SitzDarf): Rechte | null => {
  const base = !d.rechte ? null : d.bestaetigt ? d.rechte : rechteGedeckelt(d.rechte).rechte;
  const rolle = d.bestaetigt && d.rolle?.length ? d.rolle : [];
  if (!base && !rolle.length) return null;
  const r: Rechte = base ?? { stufe: RECHTE_STANDARD, an: [], aus: [] };
  return { ...r, ...(rolle.length ? { recht: [...new Set([...(r.recht ?? []), ...rolle])] } : {}) };
};

// DIE ART EINER NOTIZ aus ihrem Frontmatter (`type:` oben oder unter `metadata:`); null = keine erkennbar
export function notizArt(text: string): string | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return m ? /^\s*type:\s*["']?([a-z-]+)/m.exec(m[1]!)?.[1] ?? null : null;
}
/** Eine Marke im Frontmatter, oben oder unter metadata:; null = keine. */
export function frontMatterFlag(text: string, key: string): boolean | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const hit = new RegExp(`^\\s*${key}:\\s*["']?(true|false)\\s*$`, "m").exec(m[1]!);
  return hit ? hit[1] === "true" : null;
}
// Eine Notiz ist persönlich, wenn sie es selbst sagt; alte Notizen ohne Marke bleiben über die Art-Liste daheim (Leseschim).
export const notizIstPersoenlich = (text: string): boolean =>
  frontMatterFlag(text, "personal") === true || !NOTIZ_TEILBAR.includes(notizArt(text) ?? "");
// EIN NOTIZBUCH ZUM TEILEN: die teilbaren Notizen; aus dem Index fallen die Zeilen, die auf eine daheim gebliebene zeigen
export function notizbuchZumTeilen(index: string, dateien: readonly SitzNotiz[]): SitzNotizbuch {
  const teilbar = dateien.filter((d) => NOTIZ_DATEI.test(d.datei) && d.datei !== "MEMORY.md" && !notizIstPersoenlich(d.text));
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
