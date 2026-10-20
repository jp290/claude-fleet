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
  const alt: unknown = ohne ? await Bun.file(datei).json().catch(() => null) : null;
  const behalten = alt && typeof alt === "object" && "konstellationen" in alt && Array.isArray(alt.konstellationen) ? alt.konstellationen : null;
  try { await ersetze(datei, ohne && behalten ? JSON.stringify({ ...ohne, konstellationen: behalten }) : text); } catch (e) {
    return json({ error: `nicht gespeichert: ${e instanceof Error ? e.message : "Schreibfehler"}` }, 500);
  }
  // je Konstellation eine feste Fassung (server/konst-fassungen.ts); misslingt das, ist der Speicher trotzdem geschrieben und die Antwort sagt es
  const liste: unknown = o && typeof o === "object" && "konstellationen" in o ? o.konstellationen : null;
  if (!Array.isArray(liste)) return json({ ok: true });
  try { return json({ ok: true, fassungen: await merkeFassungen(liste, dir) }); } catch (e) {
    return json({ ok: true, fassungenFehler: e instanceof Error ? e.message : "Schreibfehler" });
  }
}
