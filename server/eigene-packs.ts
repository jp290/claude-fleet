// EIGENE PACKS (Harness 2.0, Kern „einrichten“, Owner 24.10. über Slot 6: eine Session baut mit ihrem Nutzer den Agenten, den er haben will):
// ein Pack, den eine Session schreibt, liegt privat in Fleets Zustand, nie in einem Repo, und gilt sofort, ohne Land. Er steht neben den
// Packs aus Fleets Register (.fleet/context-packs.json) im Katalog, kommt aber zu keinem Sitz von selbst: nur wer ihn wählt, liest ihn — im
// Startfenster als Stein (eine Liste an der Tür, `bibliothek`), oder die Nachfolgerin einer Session, die ihn sich gibt (server/selbst-einrichten.ts).
// Ein Pack im Repo bleibt der Weg über docs/packs, das Register und den Land (docs/packs/making-a-pack.md).
//
// Die Datei: ein Kopf aus `schlüssel: JSON`-Zeilen zwischen zwei `---`, dann der Text ab seiner Titelzeile `# …`.
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MAX_AGENTMD_BYTES } from "./agentmd";

export const EIGENE_PACKS_ORDNER = "eigene-packs";
// so groß wie ein Purpose an der Owner-Tür (server/agentmd.ts): eine ganze AGENTS.md, die jemand ins Startfenster zieht, passt hinein
export const EIGENER_PACK_MAX_BYTES = MAX_AGENTMD_BYTES;
const PACK_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const USE_WHEN_MAX = 120;

export interface EigenerPack {
  readonly id: string;
  readonly useWhen: string;
  /** der Text ab der Titelzeile, wie er im Start steht */
  readonly text: string;
  /** die Titelzeile ohne `# ` */
  readonly titel: string;
  readonly pfad: string;
  readonly bytes: number;
  /** wer ihn geschrieben hat, etwa „Slot 8“; null bei einer Datei von Hand */
  readonly von: string | null;
  readonly am: number | null;
}

export const eigenePacksDir = (stateDir: string): string => join(stateDir, EIGENE_PACKS_ORDNER);
const titelVon = (text: string): string | null => /^# (.+)$/m.exec(text.trimStart().split("\n")[0] ?? "")?.[1]?.trim() || null;

/** Eine Datei als Pack; null, wenn sie keiner ist (kein Kopf, keine Titelzeile, zu groß). Rein. */
export function eigenerPackAus(id: string, roh: string, pfad: string): EigenerPack | null {
  if (!PACK_ID.test(id)) return null;
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(roh);
  if (!m) return null;
  const kopf: Record<string, unknown> = {};
  for (const zeile of m[1]!.split("\n")) {
    const k = /^([a-zA-Z]+): (.*)$/.exec(zeile);
    if (!k) continue;
    try { kopf[k[1]!] = JSON.parse(k[2]!); } catch { return null; }
  }
  const text = m[2]!.trim();
  const titel = titelVon(text);
  const bytes = Buffer.byteLength(text);
  if (typeof kopf.useWhen !== "string" || !titel || bytes > EIGENER_PACK_MAX_BYTES) return null;
  return { id, useWhen: kopf.useWhen, text, titel, pfad, bytes, von: typeof kopf.von === "string" ? kopf.von : null,
    am: typeof kopf.am === "number" ? kopf.am : null };
}

/** Alle eigenen Packs, nach Id; eine Datei, die keiner ist, wird übersprungen. */
export function liesEigenePacks(stateDir: string): EigenerPack[] {
  const dir = eigenePacksDir(stateDir);
  let namen: string[];
  try { namen = readdirSync(dir); } catch { return []; }
  return namen.filter((name) => name.endsWith(".md")).sort().flatMap((name) => {
    const pfad = join(dir, name);
    try {
      const pack = eigenerPackAus(name.slice(0, -3), readFileSync(pfad, "utf8"), pfad);
      return pack ? [pack] : [];
    } catch { return []; }
  });
}

/** DER PACK AN DER TÜR (POST /api/self/packs): genau id, useWhen, text. `register` sind die Ids aus Fleets Register: ein eigener Pack
 *  schattet keinen von dort. Rein. */
export function eigenerPackDerTuer(body: unknown, register: ReadonlySet<string>):
  { ok: true; pack: { id: string; useWhen: string; text: string } } | { ok: false; error: string } {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  if (!b) return { ok: false, error: 'expected { "id", "useWhen", "text" }' };
  const fremd = Object.keys(b).filter((k) => !["id", "useWhen", "text"].includes(k));
  if (fremd.length) return { ok: false, error: `a pack is only text — the door reads id, useWhen, text, not ${fremd.join(", ")}` };
  if (typeof b.id !== "string" || !PACK_ID.test(b.id)) return { ok: false, error: "id must be lowercase letters, digits and hyphens (at most 80)" };
  if (register.has(b.id)) return { ok: false, error: `„${b.id}“ is a pack of Fleet's register — give yours its own id` };
  if (typeof b.useWhen !== "string" || !b.useWhen.trim() || b.useWhen.length > USE_WHEN_MAX || /[\r\n]/.test(b.useWhen))
    return { ok: false, error: `useWhen must be one line of at most ${USE_WHEN_MAX} characters: the moment to read it` };
  if (typeof b.text !== "string" || !titelVon(b.text)) return { ok: false, error: "text must begin with its title line `# …`" };
  const text = b.text.trim();
  if (Buffer.byteLength(text) > EIGENER_PACK_MAX_BYTES) return { ok: false, error: `text is larger than ${EIGENER_PACK_MAX_BYTES / 1000} KB` };
  return { ok: true, pack: { id: b.id, useWhen: b.useWhen.trim(), text } };
}

/** THE OWNER'S PRIVATE PACK (owner 26.10.: the personal part of working-with-the-owner must not be published). The pack itself lives
 *  in Fleet's state dir and is written by the Orchestratorin through POST /api/self/packs; no sentence of it stands in this tree. Here
 *  only its id, so the Orchestratorin's start can find it when it exists. */
export const PRIVATER_OWNER_PACK_ID = "working-with-this-owner";

/** Schreibt den Pack, ganz oder gar nicht; `ersetzt`, wenn es ihn schon gab. */
export function schreibEigenenPack(stateDir: string, pack: { id: string; useWhen: string; text: string }, von: string, am = Date.now()):
  { pack: EigenerPack; ersetzt: boolean } {
  const dir = eigenePacksDir(stateDir);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const pfad = join(dir, `${pack.id}.md`);
  let ersetzt = true;
  try { readFileSync(pfad); } catch { ersetzt = false; }
  const roh = `---\nuseWhen: ${JSON.stringify(pack.useWhen)}\nvon: ${JSON.stringify(von)}\nam: ${am}\n---\n${pack.text}\n`;
  const tmp = `${pfad}.${process.pid}.tmp`;
  writeFileSync(tmp, roh, { mode: 0o600 });
  renameSync(tmp, pfad);
  return { pack: eigenerPackAus(pack.id, roh, pfad)!, ersetzt };
}
