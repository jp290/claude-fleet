// K15 · der Speicher des Fensters „Neue Session“ auf dem Server: eigene Profile, Fassungen, Packs und Konstellationen in einer Datei im
// Zustandsverzeichnis (server/state-dir.ts), atomar ersetzt. Eine Route (src/k15-speicher.ts#SPEICHER_ROUTE): GET liest, PUT ersetzt
// das Ganze. server.ts hängt sie hinter das Owner-Tor; dieses Modul prüft kein Credential selbst.
import { open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { MAX_SPEICHER_BYTES, SPEICHER_DATEI, speicherFehler } from "../src/k15-speicher";
import { json } from "./json";
import { merkeFassungen } from "./konst-fassungen";

let seq = 0;

// eigener Temp-Name, 0600 beim Anlegen, fsync vor dem rename: ein Absturz lässt die alte Datei ganz oder die neue ganz
async function ersetze(datei: string, text: string): Promise<void> {
  const tmp = `${datei}.${process.pid}.${seq++}.tmp`;
  try {
    const fh = await open(tmp, "wx", 0o600);
    try {
      await fh.writeFile(text);
      await fh.sync();
    } finally { await fh.close(); }
    await rename(tmp, datei);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
}

// DIE FREIGABE ÜBER DEN DECKEL gibt nur der Owner hier, mit k15Freigabe: Ein PUT trug sie sonst aus jeder Datei herein, die ein Skript oder
// ein Fenster an der Prüfung im Import vorbei schickt (Sicherheitsprüfung Lauf 3, F6). Ein PUT behält eine gespeicherte Freigabe, solange die
// Rechte der Position dieselben sind; jede andere fällt
const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
const darfVon = (pos: Record<string, unknown> | null): Record<string, unknown> | null => rec(rec(pos?.sitz)?.darf);
const freiKey = (konst: unknown, pos: unknown, rechte: unknown, rolle: unknown): string => JSON.stringify([konst, pos, rechte, rolle ?? []]);
function freigaben(alt: unknown): Set<string> {
  const frei = new Set<string>();
  const liste = rec(alt)?.konstellationen;
  for (const k of Array.isArray(liste) ? liste.map(rec) : []) {
    for (const p of Array.isArray(k?.positionen) ? k.positionen.map(rec) : []) {
      const d = darfVon(p);
      if (d?.bestaetigt === true) frei.add(freiKey(k?.id, p?.id, d.rechte, d.rolle));
    }
  }
  return frei;
}
function ohneNeueFreigabe(liste: unknown[], frei: Set<string>): unknown[] {
  return liste.map((k) => {
    const kr = rec(k);
    if (!kr || !Array.isArray(kr.positionen)) return k;
    return { ...kr, positionen: kr.positionen.map((p) => {
      const pr = rec(p), d = darfVon(pr);
      if (!pr || !d || d.bestaetigt === undefined || (d.bestaetigt === true && frei.has(freiKey(kr.id, pr.id, d.rechte, d.rolle)))) return p;
      const { bestaetigt: _, ...ohne } = d;
      return { ...pr, sitz: { ...rec(pr.sitz), darf: ohne } };
    }) };
  });
}

export async function k15Speicher(req: Request, dir: string): Promise<Response> {
  const datei = join(dir, SPEICHER_DATEI);
  if (req.method === "GET") {
    const f = Bun.file(datei);
    if (!(await f.exists())) return json({ eigenes: null });
    try {
      const eigenes: unknown = JSON.parse(await f.text());
      return json({ eigenes });
    } catch { return json({ error: "die gespeicherte Datei ist nicht lesbar" }, 500); }
  }
  if (req.method !== "PUT") return json({ error: "nur GET und PUT" }, 405);
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return json({ error: "erwartet ist JSON" }, 415);
  const roh = await req.arrayBuffer();
  if (roh.byteLength > MAX_SPEICHER_BYTES) return json({ error: `größer als ${MAX_SPEICHER_BYTES / 1_000_000} MB` }, 413);
  const text = new TextDecoder().decode(roh);
  let o: unknown;
  try { o = JSON.parse(text); } catch { return json({ error: "kein gültiges JSON" }, 400); }
  const fehler = speicherFehler(o);
  if (fehler) return json({ error: fehler }, 400);
  // ein Fenster von vor den Konstellationen schickt sie nicht mit: dann bleiben die gespeicherten (src/k15-speicher.ts)
  const ohne = o && typeof o === "object" && !("konstellationen" in o) ? o : null;
  const alt: unknown = await Bun.file(datei).json().catch(() => null);
  const behalten = alt && typeof alt === "object" && "konstellationen" in alt && Array.isArray(alt.konstellationen) ? alt.konstellationen : null;
  const neu: unknown = o && typeof o === "object" && "konstellationen" in o ? o.konstellationen : null;
  const liste = Array.isArray(neu) ? ohneNeueFreigabe(neu, freigaben(alt)) : null;
  // EIN PUT SCHREIBT KEINEN KETTENGLIED (Schritt 3, Runde 3): ein Fenster, das die neuen Felder nicht kennt, darf aber die
  // abgelegte Herkunft nicht verlieren. Fehlt ein Feld im neuen Stand, bleibt der gespeicherte Wert; sonst gilt der neue.
  const altListe = Array.isArray(rec(alt)?.konstellationen) ? rec(alt)!.konstellationen as unknown[] : [];
  const bewahreHerkunft = (vorher: Record<string, unknown>, neu: Record<string, unknown>): Record<string, unknown> => ({
    ...neu,
    ...(typeof neu.setupHash !== "string" && typeof vorher.setupHash === "string" ? { setupHash: vorher.setupHash } : {}),
    ...(typeof neu.abgeleitetVon !== "string" && typeof vorher.abgeleitetVon === "string" ? { abgeleitetVon: vorher.abgeleitetVon } : {}),
    ...(!(Array.isArray(neu.derivedFromLine) && neu.derivedFromLine.length) && Array.isArray(vorher.derivedFromLine) && vorher.derivedFromLine.length
      ? { derivedFromLine: vorher.derivedFromLine } : {}),
  });
  const gekettet = liste?.map((k) => {
    const kr = rec(k);
    if (!kr || typeof kr.id !== "string") return k;
    const vorher = altListe.map(rec).find((x) => x?.id === kr.id) ?? null;
    return vorher ? bewahreHerkunft(vorher, kr) : kr;
  }) ?? null;
  try { await ersetze(datei, ohne && behalten ? JSON.stringify({ ...ohne, konstellationen: behalten }) : gekettet ? JSON.stringify({ ...rec(o), konstellationen: gekettet }) : text); } catch (e) {
    return json({ error: `nicht gespeichert: ${e instanceof Error ? e.message : "Schreibfehler"}` }, 500);
  }
  // je Konstellation eine feste Fassung (server/konst-fassungen.ts); misslingt das, ist der Speicher trotzdem geschrieben und die Antwort sagt es
  if (!gekettet) return json({ ok: true });
  try { return json({ ok: true, fassungen: await merkeFassungen(gekettet, dir) }); } catch (e) {
    return json({ ok: true, fassungenFehler: e instanceof Error ? e.message : "Schreibfehler" });
  }
}

// POST FREIGABE_ROUTE { konst, pos }: der Owner gibt die Rechte, die mit diesem Sitz reisten, über den Deckel hinaus frei, so wie sie jetzt gespeichert
// sind. Zurücknehmen braucht keine eigene Tür: ein PUT ohne die Freigabe nimmt sie
export async function k15Freigabe(req: Request, dir: string): Promise<Response> {
  if (req.method !== "POST") return json({ error: "nur POST" }, 405);
  const body = rec(await req.json().catch(() => null));
  if (typeof body?.konst !== "string" || typeof body.pos !== "string") return json({ error: "erwartet ist { konst, pos }" }, 400);
  const datei = join(dir, SPEICHER_DATEI);
  const alt = rec(await Bun.file(datei).json().catch(() => null));
  const liste = Array.isArray(alt?.konstellationen) ? alt.konstellationen : [];
  const k = liste.map(rec).find((x) => x?.id === body.konst);
  const p = Array.isArray(k?.positionen) ? k.positionen.map(rec).find((x) => x?.id === body.pos) : undefined;
  const d = darfVon(p ?? null);
  if (!k || !p) return json({ error: `keine gespeicherte Position „${body.konst}/${body.pos}“` }, 404);
  // die Freigabe gilt den Rechten des Sitzes UND dem Bundel einer mitgereisten Rolle: beides ist erbeten, nie gewährt
  if (!d?.rechte && !(Array.isArray(d?.rolle) && d.rolle.length)) return json({ error: `„${body.pos}“ trägt keine Rechte aus einer Datei, es gibt nichts freizugeben` }, 400);
  const frei = liste.map((x) => x !== null && rec(x)?.id === body.konst
    ? { ...k, positionen: (k.positionen as unknown[]).map((q) => rec(q)?.id === body.pos ? { ...p, sitz: { ...rec(p.sitz), darf: { ...d, bestaetigt: true } } } : q) }
    : x);
  try { await ersetze(datei, JSON.stringify({ ...alt, konstellationen: frei })); } catch (e) {
    return json({ error: `nicht gespeichert: ${e instanceof Error ? e.message : "Schreibfehler"}` }, 500);
  }
  return json({ ok: true });
}
