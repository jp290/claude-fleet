// Das Journal der gesehenen Transkripte und der Grund einer fehlenden Datei — als Einheit.
// Der Grund darf nie lügen: „nie geschrieben" sagt er nur von einer pi-Besetzung, die NACH dem Beginn
// des Journals startete (sonst hätte das Journal ihre Datei gesehen); eine ältere, deren Datei weg
// ist, kann gelöscht worden sein — für sie heißt es „unknown".
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TRANSKRIPT_JOURNAL, openTranscriptJournal } from "./transkript-gesehen";

const dir = mkdtempSync(join(tmpdir(), "transkript-gesehen-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("transkript-gesehen", () => {
  // Der Zustandsordner ist der Checkout (server/state-dir.ts): eine Datei, die Fleet dort schreibt und git nicht
  // ignoriert, lässt fleet-sync auf dem Folger mit „worktree not clean“ scheitern (26.10.).
  test("das Journal, das Fleet in den Checkout schreibt, ist für git ignoriert", () => {
    const r = Bun.spawnSync(["git", "-C", join(import.meta.dir, ".."), "check-ignore", "-q", TRANSKRIPT_JOURNAL]);
    expect(r.exitCode).toBe(0);
  });

  test("eine pi-Besetzung älter als das Journal bekommt unknown, nicht never-written", () => {
    const file = join(dir, "neu.jsonl");
    const j = openTranscriptJournal(file, () => 1_000);
    expect(existsSync(file)).toBe(false); // Laden hinterlässt keine Spur
    expect(j.pastMissingOf("s-alt", "pi-zai", 999).absent).toBe("unknown");
    expect(j.pastMissingOf("s-alt", "pi-zai", null).absent).toBe("unknown");
    expect(j.pastMissingOf("s-neu", "pi-zai", 1_000).absent).toBe("never-written");
    expect(j.pastMissingOf("s-neu", "pi-zai", 5_000).absent).toBe("never-written");
    expect(j.pastMissingOf("s-claude", "claude", 5_000).absent).toBe("unknown");
  });

  test("gesehen heißt gelöscht — auch für eine ältere Besetzung und über das Neuöffnen hinweg", () => {
    const file = join(dir, "gesehen.jsonl");
    openTranscriptJournal(file, () => 1_000).noteSeen("s-1");
    const j = openTranscriptJournal(file, () => 9_999);
    expect(j.pastMissingOf("s-1", "pi-zai", 10).absent).toBe("deleted");
    expect(j.pastMissingOf("s-1", "claude", 10).absent).toBe("deleted");
    // der Beginn bleibt der erste, nicht das Neuöffnen
    expect(j.pastMissingOf("s-2", "pi-zai", 1_500).absent).toBe("never-written");
    expect(readFileSync(file, "utf8").trim().split("\n")[0]).toBe('{"since":1000}');
  });

  test("ein Journal ohne Beginn oder mit zerrissener Zeile behauptet nie never-written und stürzt nicht", () => {
    const file = join(dir, "alt.jsonl");
    writeFileSync(file, '{"sessionId":"s-1"}\n{"sessionId":"s-\n');
    const j = openTranscriptJournal(file, () => 1_000);
    expect(j.pastMissingOf("s-1", "pi-zai", 5_000).absent).toBe("deleted");
    expect(j.pastMissingOf("s-2", "pi-zai", 5_000).absent).toBe("unknown");
  });
  test("ein abgerissenes Ende ohne Zeilenumbruch klebt die nächste Zeile nicht an: die Sitzung gilt nach dem Neuladen als gesehen", () => {
    const file = join(dir, "abgerissen.jsonl");
    writeFileSync(file, '{"since":1000}\n{"sessionId":"s-1"}\n{"sessionId":"s-ab');
    openTranscriptJournal(file, () => 2_000).noteSeen("s-2");
    const j = openTranscriptJournal(file, () => 3_000);
    expect(j.pastMissingOf("s-2", "pi-zai", 5_000).absent).toBe("deleted");
    expect(j.pastMissingOf("s-1", "pi-zai", 5_000).absent).toBe("deleted");
    // auch ein vollständiges letztes Objekt ohne Umbruch behält seine Aussage
    const ganz = join(dir, "ganz.jsonl");
    writeFileSync(ganz, '{"since":1000}\n{"sessionId":"s-1"}');
    openTranscriptJournal(ganz, () => 2_000).noteSeen("s-2");
    const k = openTranscriptJournal(ganz, () => 3_000);
    expect(k.pastMissingOf("s-1", "pi-zai", 5_000).absent).toBe("deleted");
    expect(k.pastMissingOf("s-2", "pi-zai", 5_000).absent).toBe("deleted");
  });
});
