## Geschmack — wie Code und Prosa in diesem Repo aussehen

> **ENTWURF — UNPROMOVIERT.** Dies ist ein VORSCHLAG für ein achtes Regelbuch-Fragment
> (`rulebook/geschmack.md`), nicht geltendes Recht. Es ist in `rulebook.ts` NICHT registriert und
> steht in keinem gerenderten `CLAUDE.md`. Bis der Owner es promotet, bindet es niemanden — und
> keine Zeile hier darf als Begründung dafür herhalten, eine harte Invariante aus `AGENTS.md` oder
> dem Regelbuch zu schwächen. Abgeleitet am 2026-08-25 aus dem Code, der schon so aussieht; jede
> Regel nennt ihre Fundstelle, damit sie widerlegbar ist. Promotion: Datei nach `rulebook/` kopieren,
> in `RULEBOOK_FRAGMENTS` + `FRAGMENT_BY_RULE_PREFIX` eintragen, `CLAUDE.md` neu rendern.

Der globale Default „200–400 Zeilen, 800 max" gilt in diesem Repo **nicht**, und die
Ein-Datei-Bauweise ist keine Schuld, die man abträgt. Was hier gilt:

- **Bun ist die Laufzeit, nicht eine Abhängigkeit.** Prozess, HTTP, Datei, Sleep laufen über
  `Bun.*` (`server.ts` hat 104 Zeilen mit `Bun.` gegen 5 `node:`-Importzeilen). `node:`-Builtins
  nur dort, wo Bun nichts Eigenes hat: `fs`, `path`, `crypto`, `os` (`server.ts:1-5`).
- **Der Server hat null Laufzeit-Abhängigkeiten.** `server.ts` importiert ausschließlich `node:`,
  `bun` und `./`-Nachbarn. Alle fünf `dependencies` in `package.json` gehören dem Client-Bundle
  (xterm ×3, qrcode-generator, `src/client.ts:1-5`). Eine neue Server-Abhängigkeit ist eine
  Entscheidung mit Begründung, kein Handgriff.
- **Eine Datei darf groß sein; sie darf nicht unehrlich sein.** `server.ts` hat 21 405 Zeilen, und
  `AGENTS.md` §Overridable defaults sagt „avoid new files". Eine neue Top-Level-Datei begründet
  sich, nicht das Wachstum der bestehenden.
- **Ausgelagert wird, was REIN ist — nicht, was groß ist.** `rulebook.ts`, `verify-proportion.ts`,
  `context-plan.ts`, `merge-prompt.ts`, `lane-signals.ts`: Logik ohne I/O, damit eine Sonde sie ohne
  Server prüfen kann. `rulebook.ts:11-13` nennt den Grund selbst: „it reads NOTHING … the caller is
  the only side that knows which checkout it is allowed to read."
- **Ein Kommentar erklärt den Mechanismus und seinen Preis, nie was die Zeile tut.**
  `e2e/harness.ts:98-101` erklärt eine Falle und schreibt dazu, was sie gekostet hat („12 red checks
  in a later module (2026-08-03)"). Ein Kommentar ohne Mechanismus ist Rauschen.
- **Ein Verbot trägt seine Messung im selben Absatz.** `e2e/harness.ts:12-27` verbietet den Lauf
  gegen die Live-Fleet und schreibt daneben, welche Verwechslung real passiert wäre und warum die
  Regel in dem Modul steht, das alle importieren — „as the FIRST thing it does".
- **Eine Fehlermeldung sagt, was der Leser jetzt tun soll.** `e2e/harness.ts:27` nennt die Wrapper
  UND die Fluchttür; `e2e/harness.ts:117` sagt nicht „timeout", sondern „the rest of this run would
  be meaningless". Ein Fehlertext ohne Konsequenz ist ein halber Fehlertext.
- **`check()` nimmt einen SATZ, keinen Namen.** Signatur `check(name, ok, detail)`
  (`e2e/harness.ts:66`); der `name` ist die Behauptung, die widerlegt würde
  (`e2e/watch.ts:235`: „the ACP-21 loss signature is RESIDUE, not acceptance"). `detail` trägt den
  gemessenen Wert, damit ein Rot lesbar ist, ohne den Code zu öffnen.
- **Genau eine Emit-Stelle je Fakt.** `check()` ist zugleich die einzige Schreibstelle des Trails,
  „no call site able to opt out" (`e2e/harness.ts:70-72`). Ein zweiter Schreibweg wäre eine zweite
  Wahrheit.
- **Eine Konstante, die eine Server-Zahl spiegelt, sagt das im Namen und im Kommentar.**
  `AUTO_MIN_EVERY_SEC_MS` (`e2e/harness.ts:56`) nennt die gespiegelte Größe; eine hart kodierte
  Zahl hört still auf zu stimmen, wenn der Default wandert.
- **Deutsch für Messprosa, Englisch für Code, Verträge und Fehlertexte.** `docs/messungen/*` ist
  deutsch, `AGENTS.md` und jeder `check()`-Satz englisch. Nicht mischen innerhalb eines Artefakts.
- **Ein Mess-Dokument trägt sein Datum im Dateinamen** (`docs/messungen/<slug>-YYYY-MM-DD.md`), weil
  eine Messung ohne Datum nicht altern kann und darum nie widerlegt wird.
- **Zahl statt Wertung, Beleg statt Beteuerung, gemessen getrennt von abgeleitet**
  (`.claude/skills/mess-notiz/SKILL.md`). „Sauber", „robust", „deutlich besser" sind keine Befunde.
- **Ein Name trägt seine Unsicherheit mit.** `laneDoneLooking` heißt *looking*, weil es ein
  Server-Prädikat ist und kein Bericht der Lane (`lane-signals.ts:61`); `IsolatedPreview` ist
  `true | false | "self-assess"` statt eines Booleans (`verify-proportion.ts:16`). Ein Feld, das
  „unbekannt" kann, bekommt einen dritten Zustand — nie einen Default, der sich wie eine Messung
  liest.
- **Ein Vorschlag markiert sich als Vorschlag.** Wer eine dauerhafte Regel formuliert, schreibt sie
  als ENTWURF und nennt den Promotionsweg — so wie dieser Kopf es tut.

**Was hier bewusst NICHT steht:** Verify-Ketten, Flake-Familien, Suite-Disziplin, wo ein Check
hinkommt. Die stehen in `lane-discipline`, und `rulebook.ts:34-38` verlangt Partition: eine Regel
lebt in genau einem Fragment, sonst bekommt der Loader-Vertrag eine zweite Widerspruchsfläche.
