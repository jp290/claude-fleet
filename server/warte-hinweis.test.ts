// Der Warte-Hinweis ohne Server (server/warte-hinweis.ts): welche Pane an Claude Codes Rechte-Frage steht, was davon in den
// Hinweis kommt, und wann je Frage genau einmal gemeldet wird.
import { describe, expect, test } from "bun:test";
import { FRAGE_MAX, RUECKFRAGE_RE, rueckfrageAufSchirm, rueckfrageDialog, warteHinweisText, warteSchritt, type WarteEpisode } from "./warte-hinweis";
import { BASH_FRAGE, LEERLAUF, SCHMAL_FRAGE, WRITE_FRAGE, ZITIERT } from "./warte-hinweis.fixtures";

describe("rueckfrageAufSchirm", () => {
  test("die gemessene Bash-Frage: Kopf und Frage, ohne Tipp, Beschreibung und Befehl", () => {
    expect(rueckfrageAufSchirm(BASH_FRAGE)).toBe("Bash command · Do you want to proceed?");
  });
  test("die gemessene Write-Frage: ohne Pfadzeile und Inhalt der Datei", () => {
    expect(rueckfrageAufSchirm(WRITE_FRAGE)).toBe("Create file · Do you want to create notes.txt?");
  });
  // Abnahme 722bedda0: die Beschreibung gibt den Befehl samt Token wieder, und der Hinweis liegt in fleet.json und wird
  // in die Pane des Öffners getippt
  test("ein Token in der Beschreibung oder im Befehl kommt nicht in den Hinweis", () => {
    const token = "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789";
    const frame = BASH_FRAGE.replace("Create sub directory and touch sub/x.txt", `curl with header Authorization: Bearer ${token}`)
      .replace(/^ mkdir -p sub && touch sub\/x\.txt$/m, ` curl -H "Authorization: Bearer ${token}" https://example.invalid`);
    expect(frame).toContain(`curl -H "Authorization: Bearer ${token}"`);
    expect(rueckfrageAufSchirm(frame)).toBe("Bash command · Do you want to proceed?");
    expect(RUECKFRAGE_RE.test(frame)).toBe(true);
  });
  test("eine leer laufende Pane, eine zitierte Frage, ein leerer Schirm: keine Frage", () => {
    for (const frame of [LEERLAUF, ZITIERT, "", "\n\n\n"]) {
      expect(rueckfrageAufSchirm(frame)).toBeNull();
      expect(RUECKFRAGE_RE.test(frame)).toBe(false);
    }
  });
  test("die Tastenleiste ohne Frage darüber, oder die Frage ohne die Wahl „1.“ darunter: keine Frage", () => {
    expect(rueckfrageAufSchirm(" Do you want to proceed?\n\n Esc to cancel · Tab to amend\n")).toBeNull();
    expect(rueckfrageAufSchirm(" Esc to cancel · Tab to amend\n")).toBeNull();
  });
  // Abnahme f4b37685e: Claude Code (Ink) bricht die Frage in einer schmalen Pane SELBST um, mit echtem Zeilenumbruch; der
  // gemessene Schirm (40 Spalten, capture-pane -J) muss treffen, und der Hinweis nennt die ganze Frage
  test("die gemessene, von Ink umbrochene Frage in 40 Spalten trifft, und der Hinweis fügt sie zusammen", () => {
    expect(RUECKFRAGE_RE.test(SCHMAL_FRAGE)).toBe(true);
    expect(rueckfrageAufSchirm(SCHMAL_FRAGE)).toBe("Create file · Do you want to create 2026-10-22-lang.md?");
  });
  test("eine vom Terminal umbrochene Frage (ohne -J gelesen) trifft ebenso", () => {
    const umbrochen = " Do you want to create docs/neuaufbau/befunde/\n2026-10-22-lang.md?\n ❯ 1. Yes\n   2. No\n\n Esc to cancel · Tab to amend\n";
    expect(rueckfrageAufSchirm(umbrochen)).toBe("Do you want to create docs/neuaufbau/befunde/ 2026-10-22-lang.md?");
  });
  test("ein „Do you want to …“ ohne „?“ über dem Dialog nimmt weder Kopf noch Beschreibung mit", () => {
    const frame = BASH_FRAGE.replace("  ⎿  Waiting…", "  ⎿  Do you want to know: the key is sk-ant-api03-geheim")
      .replace("Create sub directory and touch sub/x.txt", "curl with header Authorization: Bearer sk-ant-api03-geheim");
    expect(rueckfrageAufSchirm(frame)).toBe("Bash command · Do you want to proceed?");
  });
  test("eine Frage über mehr als FRAGE_MAX Zeichen trifft nicht", () => {
    expect(RUECKFRAGE_RE.test(` Do you want to ${"x".repeat(FRAGE_MAX + 1)}?\n ❯ 1. Yes\n Esc to cancel\n`)).toBe(false);
  });
  test("ohne Linie darüber nur die Frage; eine lange Hex-Folge in der Frage wird geschwärzt", () => {
    expect(rueckfrageAufSchirm(" Do you want to proceed?\n ❯ 1. Yes\n   2. No\n\n Esc to cancel\n")).toBe("Do you want to proceed?");
    const hex = "a".repeat(40);
    expect(rueckfrageAufSchirm(`${"─".repeat(20)}\n Bash command\n Do you want to use ${hex}?\n 1. Yes\n Esc to cancel\n`))
      .toBe("Bash command · Do you want to use …?");
  });
  // Abnahme 826dc5ba6: die Frage ist nur die LETZTE „Do you want to …?“ vor „1.“ — ein früheres „Do you want to …“ ohne „?“
  // darf nichts dazwischen mitnehmen; eine Frage mit „?“ darin (URL) wird erkannt; ein Kopf, der kein schlichtes Wort
  // ist (MCP-Aufruf mit Token in der URL), bleibt draußen
  test("nur die letzte Frage, ein „?“ darin, und nur ein schlichter Kopf", () => {
    const vorher = `${"─".repeat(20)}\n Tool use\n Do you want to run this and then\n API_KEY=geheim123 weiter\n Do you want to proceed?\n ❯ 1. Yes\n   2. No\n\n Esc to cancel · Tab to amend\n`;
    expect(rueckfrageAufSchirm(vorher)).toBe("Tool use · Do you want to proceed?");
    const url = `${"─".repeat(20)}\n Fetch\n Do you want to fetch https://x.com/?a=1?\n ❯ 1. Yes\n   2. No\n\n Esc to cancel · Tab to amend\n`;
    expect(RUECKFRAGE_RE.test(url)).toBe(true);
    expect(rueckfrageAufSchirm(url)).toBe("Fetch · Do you want to fetch https://x.com/?a=1?");
    const mcp = `${"─".repeat(20)}\n playwright - browser_navigate(url: "https://x.com/cb?token=abc123") (MCP)\n Do you want to proceed?\n ❯ 1. Yes\n   2. No\n\n Esc to cancel · Tab to amend\n`;
    expect(rueckfrageAufSchirm(mcp)).toBe("Do you want to proceed?");
  });
});

describe("warteSchritt", () => {
  const W = 180_000;
  test("gemeldet wird einmal, wenn die Frage warteMs alt ist, nicht vorher und nicht noch einmal", () => {
    const a = warteSchritt(undefined, 1, "F", 1000, W, true);
    expect(a).toEqual({ episode: { openedAt: 1, frage: "F", seit: 1000, gemeldet: false }, melden: false });
    const b = warteSchritt(a.episode, 1, "F", 1000 + W - 1, W, true);
    expect(b.melden).toBe(false);
    const c = warteSchritt(b.episode, 1, "F", 1000 + W, W, true);
    expect(c).toEqual({ episode: { openedAt: 1, frage: "F", seit: 1000, gemeldet: true }, melden: true });
    expect(warteSchritt(c.episode, 1, "F", 1000 + 10 * W, W, true).melden).toBe(false);
  });
  test("ist die Frage vom Schirm, endet die Episode; kommt sie wieder, ist das eine neue mit neuer Uhr", () => {
    const done: WarteEpisode = { openedAt: 1, frage: "F", seit: 0, gemeldet: true };
    expect(warteSchritt(done, 1, null, W, W, true)).toEqual({ episode: undefined, melden: false });
    const neu = warteSchritt(undefined, 1, "F", 2 * W, W, true);
    expect(neu.episode).toEqual({ openedAt: 1, frage: "F", seit: 2 * W, gemeldet: false });
    expect(warteSchritt(neu.episode, 1, "F", 3 * W, W, true).melden).toBe(true);
  });
  test("eine andere Frage oder eine neue Belegung beginnt eine neue Episode", () => {
    const done: WarteEpisode = { openedAt: 1, frage: "F", seit: 0, gemeldet: true };
    expect(warteSchritt(done, 1, "G", W, W, true).episode).toEqual({ openedAt: 1, frage: "G", seit: W, gemeldet: false });
    expect(warteSchritt(done, 2, "F", W, W, true).episode).toEqual({ openedAt: 2, frage: "F", seit: W, gemeldet: false });
  });
  test("ohne Empfänger läuft die Uhr weiter, und gemeldet wird, sobald einer da ist", () => {
    const a = warteSchritt(undefined, 1, "F", 0, W, false);
    const b = warteSchritt(a.episode, 1, "F", 2 * W, W, false);
    expect(b).toEqual({ episode: { openedAt: 1, frage: "F", seit: 0, gemeldet: false }, melden: false });
    expect(warteSchritt(b.episode, 1, "F", 2 * W + 1, W, true).melden).toBe(true);
  });
});

// Owner 22.10. 08:30: der Öffner oder die Orchestratorin gibt die Frage bewusst frei — der Hinweis sagt, wie: erst den
// Dialog lesen (GET), dann mit dessen Kennung wählen; der Dialog selbst steht nie im Hinweis
test("warteHinweisText nennt Slot, Name, Frage und wie lange schon, und wie man bewusst freigibt oder ablehnt", () => {
  const t = warteHinweisText({ slot: 5, label: "Sperren im Lauf", frage: "Bash command · Do you want to proceed?", seit: 0, now: 4 * 60_000 + 5 });
  expect(t).toStartWith("[fleet · warte-hinweis] Slot 5 (Sperren im Lauf) wartet seit ");
  expect(t).toContain("(4 min) auf eine Antwort in seiner Pane: „Bash command · Do you want to proceed?“");
  expect(t).toContain('GET /api/self/rueckfrage?slot=5, dann POST /api/self/rueckfrage mit {"slot":5,"kennung":"<kennung aus dem GET>","wahl":"freigeben"} oder "wahl":"ablehnen"');
  expect(warteHinweisText({ slot: 5, label: null, frage: "F", seit: 0, now: 0 })).toStartWith("[fleet · warte-hinweis] Slot 5 wartet seit ");
});

// Abnahme 76c28e2a2: zwei Bash-Fragen haben dieselbe Frage; die Freigabe muss an den ganzen Dialog gebunden sein
describe("rueckfrageDialog", () => {
  const RM = BASH_FRAGE.replace(/^ mkdir -p sub && touch sub\/x\.txt$/m, " rm -rf ~/claude-fleet");
  const ganz = (screen: string) => {
    const d = rueckfrageDialog(screen);
    if (d === null || d === "zu-hoch") throw new Error(`kein ganzer Dialog: ${String(d)}`);
    return d;
  };
  test("der ganze Dialog samt Befehl, und eine Kennung, die am Befehl hängt", () => {
    const a = ganz(BASH_FRAGE), b = ganz(RM);
    expect(a?.frage).toBe("Bash command · Do you want to proceed?");
    expect(b?.frage).toBe(a?.frage ?? "");
    expect(a?.dialog.split("\n").slice(0, 2)).toEqual(["Bash command", 'Tip: auto mode handles these prompts for you — choose "switch to auto mode" below']);
    expect(a?.dialog).toContain("mkdir -p sub && touch sub/x.txt");
    expect(a?.dialog.split("\n").at(-1)).toBe("Esc to cancel · Tab to amend");
    expect(b?.dialog).toContain("rm -rf ~/claude-fleet");
    expect(a?.kennung).toMatch(/^[0-9a-f]{16}$/);
    expect(b?.kennung).not.toBe(a?.kennung ?? "");
    expect(ganz(BASH_FRAGE).kennung).toBe(a.kennung);
  });
  // Abnahme ca46648f5: ein Dialog, höher als die Pane, verliert oben seine Linie und den Anfang des Befehls; zwei Befehle,
  // die sich nur dort unterscheiden, ergäben dieselbe Kennung — darum gibt es keine
  test("ein Dialog ohne seine obere Linie auf dem Schirm ist zu hoch: keine Kennung", () => {
    const unten = (erste: string) => [` ${erste}`, ...Array.from({ length: 25 }, (_, i) => `   echo zeile ${i}`), "╌".repeat(40),
      " Do you want to proceed?", " ❯ 1. Yes", "   2. No", "", " Esc to cancel · Tab to amend", ""].join("\n");
    expect(rueckfrageDialog(unten("ls -la"))).toBe("zu-hoch");
    expect(rueckfrageDialog(unten("rm -rf ~/claude-fleet"))).toBe("zu-hoch");
    expect(rueckfrageAufSchirm(unten("ls -la"))).toBe("Do you want to proceed?");
  });
  // Abnahme 9d7f7d588: eine Zeile nur aus ─ im Befehl (Heredoc-Trenner) ist nicht der Rand des Dialogs — sonst fehlen der
  // Kennung die Zeilen darüber, und die Zeile darunter wird zum Kopf des Hinweises
  test("eine ─-Zeile im Befehl ist nicht der Rand: Kennung über den ganzen Befehl, Kopf bleibt „Bash command“", () => {
    const heredoc = (erste: string) => BASH_FRAGE.replace(/^ mkdir -p sub && touch sub\/x\.txt$/m,
      [` ${erste}`, ` ${"─".repeat(30)}`, " API_KEY=geheim123", " echo ende", " EOF"].join("\n"));
    const harmlos = ganz(heredoc("cat > notiz.md <<EOF")), boese = ganz(heredoc("rm -rf ~/claude-fleet; cat > notiz.md <<EOF"));
    expect(harmlos.kennung).not.toBe(boese.kennung);
    expect(harmlos.dialog.split("\n")[0]).toBe("Bash command");
    expect(boese.dialog).toContain("rm -rf ~/claude-fleet; cat > notiz.md <<EOF");
    expect(harmlos.frage).toBe("Bash command · Do you want to proceed?");
    expect(rueckfrageAufSchirm(heredoc("cat > notiz.md <<EOF"))).toBe("Bash command · Do you want to proceed?");
  });
  test("ohne Frage auf dem Schirm kein Dialog", () => {
    expect(rueckfrageDialog(LEERLAUF)).toBeNull();
    expect(rueckfrageDialog(ZITIERT)).toBeNull();
  });
});
