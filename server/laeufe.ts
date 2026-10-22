// DER LAUF EINER KONSTELLATION (Harness 2.0 Schritt 4a; ~/local-notes/grok-auswertung/harness-2-0-antwort.md Lücke 3): Konstellation@Hash
// der Fassung, mit der gestartet wird, × Aufgabe, mit dem Protokoll aus dieser Fassung und je Position dem Slot, der darauf sitzt. Das Fenster startet eine
// Position über ihre gewohnte Tür und bindet den Slot danach hier an den Lauf (wie die Übergabe-Schwelle, k15-start.ts#setzeSchwelle): ein
// neuer Lauf, oder eine weitere Position in einem laufenden. Der Slot trägt die Bindung (Slot.lauf, docs/konstellation/modell.md Änderung 2)
// über die Nachfolge mit. Eine Datei im Zustandsverzeichnis, nur angehängt: ein Lauf ist ein Nachweis, an dem nichts überschrieben wird.
// Nachrichten, Ende und Ergebnis kommen als weitere Zeilen dazu (4b, 4c). server.ts hängt die Route hinter das Owner-Tor.
import { join } from "node:path";
import { aufgabeAus, type Aufgabe } from "../src/aufgabe";
import { LAEUFE_ROUTE } from "../src/k15-speicher";
import { json } from "./json";
import { fassungsHash, fassungVon } from "./konst-fassungen";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { liesHistorie, merkeNachtrag } from "./start-historie";
import { appendEvent, appendEventStrict, binnenGrenze, readEventLog } from "./persist";

export const LAEUFE_DATEI = "k15-laeufe.jsonl";

// was der Slot trägt: an welchem Lauf, auf welcher Position
export interface LaufBindung { id: string; pos: string }
// folgtAuf: das openedAt der Vorgängerin, wenn diese Belegung eine Nachfolge auf derselben Position ist; cwd, branch, repo: wo sie arbeitet
// (das Ergebnis liest dort die Commits); zu: wann ihre Session geschlossen wurde
export interface LaufPosition { pos: string; slot: number; openedAt: number; at: number; folgtAuf?: number; cwd?: string; branch?: string; repo?: string; zu?: number }
// wie ein Lauf endete: von Hand, oder weil alle seine Sessions zu sind
export interface LaufEnde { at: number; wie: "hand" | "zu" }
export interface Lauf {
  id: string; konst: string; hash: string; name: string; version: number | null; at: number;
  aufgabe: Aufgabe | null; protokoll: Record<string, unknown> | null; positionen: LaufPosition[]; ende: LaufEnde | null;
}
// wo eine Belegung arbeitet; der Branch fehlt bei einer Session ohne Lane-Worktree, dann sagt ihn die Historie (Nachtrag der Branch-Tür)
export interface LaufOrt { cwd?: string | null; branch?: string | null; repo?: string | null }
const ortZeile = (o: LaufOrt): Pick<LaufPosition, "cwd" | "branch" | "repo"> =>
  ({ ...(o.cwd ? { cwd: o.cwd } : {}), ...(o.branch ? { branch: o.branch } : {}), ...(o.repo ? { repo: o.repo } : {}) });

// aus fleet.json: nur eine ganze Bindung
export function laufGeladen(raw: unknown): LaufBindung | null {
  if (!raw || typeof raw !== "object") return null;
  const { id, pos } = raw as Record<string, unknown>;
  return typeof id === "string" && /^l[0-9a-f]{12}$/.test(id) && typeof pos === "string" && pos ? { id, pos } : null;
}

const text = (v: unknown): string | null => typeof v === "string" ? v : null;
const zahl = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) ? v : null;
export async function liesLaeufe(dir: string): Promise<Lauf[]> {
  const { rows } = await readEventLog(join(dir, LAEUFE_DATEI));
  const laeufe = new Map<string, Lauf>();
  for (const r of rows) {
    const id = text(r.id);
    if (!id) continue;
    if (r.art === "lauf") {
      const konst = text(r.konst), hash = text(r.hash), at = zahl(r.at);
      if (!konst || !hash || at === null) continue;
      const au = r.aufgabe === null || r.aufgabe === undefined ? null : aufgabeAus(r.aufgabe);
      laeufe.set(id, { id, konst, hash, name: text(r.name) ?? konst, version: zahl(r.version), at, aufgabe: typeof au === "string" ? null : au,
        protokoll: r.protokoll && typeof r.protokoll === "object" && !Array.isArray(r.protokoll) ? r.protokoll as Record<string, unknown> : null, positionen: [], ende: null });
    } else if (r.art === "position") {
      const l = laeufe.get(id), pos = text(r.pos), slot = zahl(r.slot), openedAt = zahl(r.openedAt), at = zahl(r.at);
      const folgt = zahl(r.folgtAuf);
      if (l && pos && slot !== null && openedAt !== null && at !== null)
        laeufe.set(id, { ...l, positionen: [...l.positionen, { pos, slot, openedAt, at, ...(folgt !== null ? { folgtAuf: folgt } : {}),
          ...ortZeile({ cwd: text(r.cwd), branch: text(r.branch), repo: text(r.repo) }) }] });
    } else if (r.art === "zu") {
      const l = laeufe.get(id), slot = zahl(r.slot), openedAt = zahl(r.openedAt), at = zahl(r.at);
      if (l && at !== null) laeufe.set(id, { ...l, positionen: l.positionen.map((p) => p.slot === slot && p.openedAt === openedAt ? { ...p, zu: at } : p) });
    } else if (r.art === "ende") {
      const l = laeufe.get(id), at = zahl(r.at);
      if (l && at !== null && !l.ende) laeufe.set(id, { ...l, ende: { at, wie: "hand" } });
    }
  }
  // ohne Ende von Hand endet ein Lauf, wenn alle seine Sessions zu sind: mit der letzten
  return [...laeufe.values()].map((l) => l.ende || !l.positionen.length || l.positionen.some((p) => p.zu === undefined) ? l
    : { ...l, ende: { at: Math.max(...l.positionen.map((p) => p.zu ?? 0)), wie: "zu" as const } }).reverse();
}

// DIE FASSUNG, MIT DER GESTARTET WIRD: das Fenster startet mit dem gespeicherten Stand im Aufbau, nicht mit dem Zeiger „aktiv“ (Partner 19.10.).
// Ein Lauf ist ein Nachweis, also steht er auf dem Hash dieses Stands; nur ohne gespeicherten Stand auf „aktiv“
async function gespeicherterHash(konst: string, dir: string): Promise<string | null> {
  const o: unknown = await Bun.file(join(dir, SPEICHER_DATEI)).json().catch(() => null);
  const liste = o && typeof o === "object" && "konstellationen" in o && Array.isArray(o.konstellationen) ? o.konstellationen : [];
  const form: unknown = liste.find((k: unknown) => !!k && typeof k === "object" && (k as Record<string, unknown>).id === konst);
  return form && typeof form === "object" ? fassungsHash(form as Record<string, unknown>) : null;
}

// der Name einer Position in ihrer Fassung; ohne Namen ihre Kennung
function posName(form: Record<string, unknown>, pos: string): string {
  const p: unknown = Array.isArray(form.positionen) ? form.positionen.find((x: unknown) => !!x && typeof x === "object" && (x as Record<string, unknown>).id === pos) : null;
  const n = p && typeof p === "object" ? (p as Record<string, unknown>).name : null;
  return typeof n === "string" && n ? n : pos;
}

// EINE NACHFOLGE AUF EINER POSITION (server.ts#respawnInPlace nimmt Slot.lauf mit): die Nachfolgerin kommt mit ihrer Belegung als weitere
// Zeile dazu, die auf die Vorgängerin verweist, und ihr Start steht mit dem Lauf in der Historie (Partner 20.10.: sonst stand sie da wie ein
// freier Start, und der Lauf nannte nur die beendete Belegung). Am besten bemüht wie jedes Ereignisprotokoll (persist.ts#appendEvent):
// eine Nachfolge scheitert nie an ihrem Lauf
export function laufNachfolge(b: LaufBindung, slot: number, openedAt: number, vorher: number, dir: string, jetzt = Date.now()): Promise<void> {
  return binnenGrenze(schreibeNachfolge(b, slot, openedAt, vorher, dir, jetzt));
}
async function schreibeNachfolge(b: LaufBindung, slot: number, openedAt: number, vorher: number, dir: string, jetzt: number): Promise<void> {
  const l = (await liesLaeufe(dir).catch(() => [])).find((x) => x.id === b.id);
  if (!l) return;
  // sie arbeitet, wo die Vorgängerin gearbeitet hat (die Nachfolge bleibt im selben Ordner, server.ts#respawnInPlace)
  const vor = l.positionen.find((p) => p.slot === slot && p.openedAt === vorher);
  await appendEvent(join(dir, LAEUFE_DATEI), { art: "position", id: b.id, pos: b.pos, slot, openedAt, at: jetzt, folgtAuf: vorher, ...(vor ? ortZeile(vor) : {}) });
  const f = await fassungVon(l.konst, l.hash, dir).catch(() => null);
  await merkeNachtrag(slot, openedAt, { lauf: { id: b.id, pos: b.pos, posName: f ? posName(f.form, b.pos) : b.pos, konst: l.konst, name: l.name,
    version: l.version, hash: l.hash } }, dir);
}

// DIE NACHRICHTEN EINES LAUFS (4b, Lücke 3: das Postfach ist ein Ring von 200 für die ganze Fleet, eine Auswerterin fände nach kurzer Zeit
// nichts mehr). Jede Postfach-Nachricht von oder an eine Session eines Laufs geht zusätzlich in seine eigene Datei, nur angehängt. Eine Datei
// je Lauf, damit fremder Verkehr sie nicht wegrotiert; höchstens LAUF_NACHRICHTEN_MAX Zeilen (bei 2000 Zeichen je Nachricht unter der
// Rotationsgrenze von persist.ts), danach eine Zeile „gekappt“ und nichts mehr. Am besten bemüht wie jedes Ereignisprotokoll.
export const LAUF_NACHRICHTEN_MAX = 1000;
export const nachrichtenDatei = (dir: string, id: string): string => join(dir, `k15-lauf-${id}.jsonl`);
export interface LaufNachricht { id: string; at: number; from: unknown; to: unknown; text: string; replyTo: string | null }
const gezaehlt = new Map<string, Promise<number>>();
export function merkeLaufNachricht(laeufe: readonly string[], n: LaufNachricht, dir: string, max = LAUF_NACHRICHTEN_MAX): Promise<void> {
  return binnenGrenze(schreibeLaufNachricht(laeufe, n, dir, max));
}
async function schreibeLaufNachricht(laeufe: readonly string[], n: LaufNachricht, dir: string, max: number): Promise<void> {
  for (const id of new Set(laeufe)) {
    const datei = nachrichtenDatei(dir, id);
    // der Zähler steht, bevor gewartet wird: zwei Nachrichten zugleich zählen nicht dieselbe Zeile
    const vorher = gezaehlt.get(datei) ?? readEventLog(datei).then((r) => r.total, () => 0);
    gezaehlt.set(datei, vorher.then((x) => x + 1));
    const bisher = await vorher;
    if (bisher < max) await appendEvent(datei, { art: "nachricht", ...n });
    else if (bisher === max) await appendEvent(datei, { art: "gekappt", at: n.at, max });
  }
}
export async function liesLaufNachrichten(dir: string, id: string): Promise<{ nachrichten: LaufNachricht[]; gekappt: boolean }> {
  const { rows } = await readEventLog(nachrichtenDatei(dir, id));
  const nachrichten = rows.flatMap((r) => r.art === "nachricht" && typeof r.id === "string" && typeof r.at === "number" && typeof r.text === "string"
    ? [{ id: r.id, at: r.at, from: r.from, to: r.to, text: r.text, replyTo: typeof r.replyTo === "string" ? r.replyTo : null }] : []);
  return { nachrichten, gekappt: rows.some((r) => r.art === "gekappt") };
}

// DAS ENDE EINER BELEGUNG IM LAUF (server.ts#teardownSlotOccupant, auch die Vorgängerin einer Nachfolge): ihre Session ist zu. Sind alle zu,
// ist der Lauf zu Ende (liesLaeufe). Am besten bemüht wie jedes Ereignisprotokoll: ein Schließen scheitert nie an seinem Lauf
export function laufZu(b: LaufBindung, slot: number, openedAt: number, dir: string, jetzt = Date.now()): Promise<void> {
  return binnenGrenze(appendEvent(join(dir, LAEUFE_DATEI), { art: "zu", id: b.id, pos: b.pos, slot, openedAt, at: jetzt }));
}

// DAS ERGEBNIS EINES LAUFS (4c, harness-2-0-antwort.md Lücke 3: „Ergebnisse (Reports, Commits, Dateien) … und Ende“): je Branch seiner
// Positionen die Commits aus der Zeit des Laufs, und die Reports seiner Sessions aus dem Report-Buch (server.ts#ledgerReportOpen, dort nur
// mit Slot, also nach Slot und der Zeit von der Bindung bis zum Schließen). Die Endbedingung des Protokolls steht dabei; Fleet prüft sie nicht (Owner 19.10.: optional).
export const BERICHTE_DATEI = "fleet-reports.jsonl"; // server.ts#FLEET_REPORT_LEDGER_FILE
export interface LaufCommit { sha: string; at: number; subject: string }
// was server.ts gibt: die Commits eines Branches über seiner Basis, neueste zuerst; null = nicht lesbar
export type Commits = (repo: string, branch: string) => Promise<LaufCommit[] | null>;
export interface LaufErgebnis {
  endbedingung: string | null; ende: LaufEnde | null;
  branches: { branch: string; repo: string; positionen: string[]; commits: LaufCommit[] | null }[];
  reports: { id: string; at: number; slot: number; pos: string; status: string | null; text: string }[];
  // ohneBranch: Belegungen, deren Branch Fleet nicht kennt (kein Lane-Worktree, kein Nachtrag der Branch-Tür); ziele: was eine Belegung beim
  // Start als Ziel bekam (Historie), denn die Aufgabe des Laufs ist die seines ersten Starts
  nachrichten: number; ohneBranch: { pos: string; slot: number }[]; ziele: { pos: string; slot: number; ziel: string }[];
}
export async function laufErgebnis(l: Lauf, commits: Commits, dir: string, jetzt = Date.now()): Promise<LaufErgebnis> {
  const bis = l.ende?.at ?? jetzt, seit = Math.floor(l.at / 1000) * 1000;
  const je = new Map<string, { branch: string; repo: string; positionen: string[] }>();
  for (const p of l.positionen) {
    const repo = p.repo ?? p.cwd;
    if (!p.branch || !repo) continue;
    const k = `${repo}\0${p.branch}`, da = je.get(k);
    je.set(k, { branch: p.branch, repo, positionen: [...new Set([...(da?.positionen ?? []), p.pos])] });
  }
  const branches = await Promise.all([...je.values()].map(async (b) => {
    const c = await commits(b.repo, b.branch).catch(() => null);
    return { ...b, commits: c && c.filter((x) => x.at >= seit && x.at <= bis) };
  }));
  const { rows } = await readEventLog(join(dir, BERICHTE_DATEI));
  const reports = rows.flatMap((r) => {
    const at = zahl(r.at), slot = zahl(r.slot), id = text(r.id), t = text(r.text);
    const p = r.kind === "open" && at !== null ? l.positionen.find((x) => x.slot === slot && at >= x.at && at <= (x.zu ?? bis)) : undefined;
    return p && id && t !== null && slot !== null ? [{ id, at: at ?? 0, slot, pos: p.pos, status: text(r.status), text: t }] : [];
  });
  const pr = l.protokoll?.ende;
  const historie = await liesHistorie(dir).catch(() => []);
  const ziele = l.positionen.flatMap((p) => {
    const ziel = historie.find((e) => e.slot === p.slot && e.openedAt === p.openedAt)?.goal;
    return ziel ? [{ pos: p.pos, slot: p.slot, ziel }] : [];
  });
  return { endbedingung: typeof pr === "string" ? pr : null, ende: l.ende, branches, reports,
    nachrichten: (await liesLaufNachrichten(dir, l.id)).nachrichten.length,
    ohneBranch: l.positionen.filter((p) => !p.branch).map((p) => ({ pos: p.pos, slot: p.slot })), ziele };
}

// was server.ts dem Modul gibt. binde: den Slot binden, wenn er belegt ist (und, falls genannt, noch von derselben Belegung), und sagen, wo
// er arbeitet; null = nicht. loese: die Bindung aller Slots an einem beendeten Lauf lösen. commits: siehe Commits
export type Binde = (slot: number, openedAt: number | null, b: LaufBindung) => ({ openedAt: number } & LaufOrt) | null;
export interface LaufServer { binde: Binde; loese: (id: string) => void; commits: Commits }

// der Branch einer Session ohne Lane-Worktree steht in der Historie (die Branch-Tür trägt ihn nach)
async function ortAusHistorie(slot: number, openedAt: number, dir: string): Promise<LaufOrt> {
  const e = (await liesHistorie(dir).catch(() => [])).find((x) => x.slot === slot && x.openedAt === openedAt);
  return e ? { cwd: e.cwd, branch: e.branch, repo: e.repo } : {};
}

// POST LAEUFE_ROUTE {konst, pos, slot, openedAt?, lauf?, aufgabe?}: ohne `lauf` ein neuer Lauf auf der gespeicherten Fassung, mit `lauf` eine
// weitere Position in ihm. POST LAEUFE_ROUTE/:id/ende: der Lauf endet von Hand. GET LAEUFE_ROUTE: alle, neueste zuerst; GET LAEUFE_ROUTE/:id:
// einer; GET LAEUFE_ROUTE/:id/nachrichten: sein Protokoll; GET LAEUFE_ROUTE/:id/ergebnis: sein Ergebnis
export async function k15Laeufe(req: Request, url: URL, server: LaufServer, dir: string, jetzt = Date.now): Promise<Response> {
  const datei = join(dir, LAEUFE_DATEI);
  const einer = url.pathname.startsWith(`${LAEUFE_ROUTE}/`) ? decodeURIComponent(url.pathname.slice(LAEUFE_ROUTE.length + 1)) : null;
  const unter = einer === null ? null : /^([^/]+)\/(nachrichten|ergebnis|ende)$/.exec(einer);
  if (unter) {
    const [, id = "", was] = unter;
    const l = (await liesLaeufe(dir)).find((x) => x.id === id);
    if (!l) return json({ error: `kein Lauf „${id.slice(0, 40)}“` }, 404);
    if (was === "ende") {
      if (req.method !== "POST") return json({ error: "nur POST" }, 405);
      if (l.ende) return json({ error: `der Lauf ist schon zu Ende (${l.ende.wie === "hand" ? "von Hand" : "seine Sessions sind zu"})` }, 409);
      await appendEventStrict(datei, { art: "ende", id, at: jetzt(), wie: "hand" });
      server.loese(id);
      return json({ lauf: (await liesLaeufe(dir)).find((x) => x.id === id) });
    }
    if (req.method !== "GET") return json({ error: "nur GET" }, 405);
    if (was === "nachrichten") return json(await liesLaufNachrichten(dir, id));
    // dazu die Namen der Positionen in seiner Fassung, damit das Fenster nicht Kennungen zeigt
    const f = await fassungVon(l.konst, l.hash, dir).catch(() => null);
    return json({ ergebnis: await laufErgebnis(l, server.commits, dir, jetzt()),
      namen: Object.fromEntries(l.positionen.map((p) => [p.pos, f ? posName(f.form, p.pos) : p.pos])) });
  }
  if (req.method === "GET") {
    const alle = await liesLaeufe(dir);
    if (einer === null) return json({ laeufe: alle });
    const l = alle.find((x) => x.id === einer);
    return l ? json({ lauf: l }) : json({ error: `kein Lauf „${einer.slice(0, 40)}“` }, 404);
  }
  if (req.method !== "POST" || einer !== null) return json({ error: "nur GET, und POST auf die Liste" }, 405);
  const b: unknown = await req.json().catch(() => null);
  const o = b && typeof b === "object" && !Array.isArray(b) ? b as Record<string, unknown> : null;
  if (!o || typeof o.konst !== "string" || typeof o.pos !== "string" || !o.pos || !Number.isInteger(o.slot)
    || (o.openedAt !== undefined && zahl(o.openedAt) === null) || (o.lauf !== undefined && typeof o.lauf !== "string"))
    return json({ error: "erwartet { konst, pos, slot, openedAt?, lauf?, aufgabe? }" }, 400);
  const aufgabe = o.aufgabe === undefined ? null : aufgabeAus(o.aufgabe);
  if (typeof aufgabe === "string") return json({ error: aufgabe }, 400);
  const alle = await liesLaeufe(dir);
  const da = typeof o.lauf === "string" ? alle.find((x) => x.id === o.lauf) : undefined;
  if (typeof o.lauf === "string" && !da) return json({ error: `kein Lauf „${o.lauf.slice(0, 40)}“` }, 404);
  if (da && da.konst !== o.konst) return json({ error: `der Lauf gehört zu „${da.name}“, nicht zu dieser Konstellation` }, 409);
  if (da?.ende) return json({ error: "der Lauf ist zu Ende; ein neuer Start beginnt einen neuen" }, 409);
  if (da && aufgabe) return json({ error: "ein laufender Lauf hat seine Aufgabe schon" }, 400);
  // die Fassung, auf der der Lauf steht: seine eigene, oder für einen neuen die gespeicherte, mit der gestartet wird
  const f = da ? await fassungVon(o.konst, da.hash, dir)
    : await fassungVon(o.konst, await gespeicherterHash(o.konst, dir), dir) ?? await fassungVon(o.konst, null, dir);
  if (!f) return json({ error: "diese Konstellation hat keine gespeicherte Fassung; erst speichern, dann starten" }, 404);
  const positionen = Array.isArray(f.form.positionen) ? f.form.positionen : [];
  if (!positionen.some((p: unknown) => !!p && typeof p === "object" && (p as Record<string, unknown>).id === o.pos))
    return json({ error: `„${o.pos.slice(0, 40)}“ ist keine Position der Fassung ${f.hash.slice(0, 8)}` }, 400);
  if (da?.positionen.some((p) => p.pos === o.pos && p.slot === o.slot)) return json({ error: "diese Position sitzt schon auf diesem Slot" }, 409);
  const id = da?.id ?? `l${crypto.getRandomValues(new Uint8Array(6)).reduce((t, x) => t + x.toString(16).padStart(2, "0"), "")}`;
  const sitz = server.binde(Number(o.slot), zahl(o.openedAt), { id, pos: o.pos });
  if (!sitz) return json({ error: `Slot ${String(o.slot)} ist nicht (mehr) diese Session` }, 409);
  const ort = sitz.branch ? sitz : { ...sitz, ...await ortAusHistorie(Number(o.slot), sitz.openedAt, dir) };
  const at = jetzt();
  if (!da) {
    const pr = f.form.protokoll;
    await appendEventStrict(datei, { art: "lauf", id, konst: o.konst, hash: f.hash, name: f.name, version: f.version, at, aufgabe,
      protokoll: pr && typeof pr === "object" && !Array.isArray(pr) ? pr : null });
  }
  await appendEventStrict(datei, { art: "position", id, pos: o.pos, slot: o.slot, openedAt: sitz.openedAt, at, ...ortZeile(ort) });
  // die Historie zeigt den Start mit seinem Lauf
  await merkeNachtrag(Number(o.slot), sitz.openedAt, { lauf: { id, pos: o.pos, posName: posName(f.form, o.pos), konst: o.konst, name: f.name, version: f.version, hash: f.hash } }, dir);
  const lauf = (await liesLaeufe(dir)).find((x) => x.id === id);
  return json({ lauf }, da ? 200 : 201);
}
